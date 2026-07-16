import { GraphQLError } from 'graphql';
import type { Expense, ExpenseSplit, Group } from '@prisma/client';
import type { Context } from '../../context.js';
import { requireMembership } from '../groups/permissions.js';
import { recordAudit } from '../audit/audit.js';
import { notifyExpenseAdded } from '../notifications/notify.js';
import {
  buildSplits,
  convertSplitsToBase,
  type SplitInput,
  type ItemInput,
  type SplitModeValue,
  type ComputedSplit,
} from './split.js';

const expenseInclude = { splits: true } as const;

function parseDate(input?: string | null): Date {
  if (!input) return new Date();
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new GraphQLError('Invalid date.');
  return d;
}

function validateAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new GraphQLError('Amount must be a positive whole number of minor units.');
  }
}

// Resolve the expense currency + rate against the group's base currency.
function resolveCurrency(
  group: Group,
  currencyArg?: string | null,
  rateArg?: number | null,
): { currency: string; exchangeRate: number } {
  const base = group.baseCurrency;
  const currency = (currencyArg ?? base).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new GraphQLError('Currency must be a 3-letter code.');
  }
  if (currency === base) return { currency, exchangeRate: 1 };
  if (rateArg == null || !(rateArg > 0)) {
    throw new GraphQLError('A positive exchange rate is required for a foreign currency.');
  }
  return { currency, exchangeRate: rateArg };
}

const toBaseAmount = (amountMinor: number, rate: number) => Math.round(amountMinor * rate);

async function assertMembersInGroup(
  ctx: Context,
  groupId: string,
  membershipIds: string[],
): Promise<void> {
  const rows = await ctx.prisma.membership.findMany({
    where: { groupId, id: { in: membershipIds } },
    select: { id: true },
  });
  const found = new Set(rows.map((r) => r.id));
  for (const id of membershipIds) {
    if (!found.has(id)) throw new GraphQLError('A referenced member does not belong to this group.');
  }
}

function modeNeedsSplits(mode: SplitModeValue): boolean {
  return mode === 'EXACT' || mode === 'PERCENTAGE' || mode === 'SHARES' || mode === 'ADJUSTMENT';
}

interface AddExpenseArgs {
  groupId: string;
  description: string;
  amount: number;
  paidById: string;
  splitMode: SplitModeValue;
  splits?: SplitInput[];
  items?: ItemInput[];
  currency?: string;
  exchangeRate?: number;
  date?: string;
  notes?: string;
}

interface UpdateExpenseArgs {
  expenseId: string;
  description?: string;
  amount?: number;
  paidById?: string;
  splitMode?: SplitModeValue;
  splits?: SplitInput[];
  items?: ItemInput[];
  currency?: string;
  exchangeRate?: number;
  date?: string;
  notes?: string;
}

export const expensesResolvers = {
  Query: {
    expense: async (_p: unknown, args: { id: string }, ctx: Context) => {
      const expense = await ctx.prisma.expense.findUnique({
        where: { id: args.id },
        include: expenseInclude,
      });
      if (!expense) return null;
      await requireMembership(ctx, expense.groupId);
      return expense;
    },
  },

  Mutation: {
    addExpense: async (_p: unknown, args: AddExpenseArgs, ctx: Context) => {
      await requireMembership(ctx, args.groupId);
      const description = args.description.trim();
      if (!description) throw new GraphQLError('Description is required.');
      validateAmount(args.amount);

      const group = await ctx.prisma.group.findUniqueOrThrow({ where: { id: args.groupId } });
      const { currency, exchangeRate } = resolveCurrency(group, args.currency, args.exchangeRate);
      const baseAmount = toBaseAmount(args.amount, exchangeRate);

      const origSplits = buildSplits(args.splitMode, args.amount, args.splits ?? [], args.items ?? []);
      const baseSplits = convertSplitsToBase(origSplits, baseAmount);

      await assertMembersInGroup(ctx, args.groupId, [
        args.paidById,
        ...baseSplits.map((s) => s.membershipId),
      ]);

      const expense = await ctx.prisma.expense.create({
        data: {
          groupId: args.groupId,
          description,
          amount: args.amount,
          currency,
          baseAmount,
          exchangeRate,
          date: parseDate(args.date),
          notes: args.notes?.trim() || null,
          splitMode: args.splitMode,
          paidById: args.paidById,
          splits: { create: baseSplits.map((c) => ({ membershipId: c.membershipId, amount: c.amount })) },
        },
        include: expenseInclude,
      });
      await recordAudit(ctx, args.groupId, 'Expense', expense.id, 'CREATE', `Added "${description}"`);
      void notifyExpenseAdded(ctx, expense);
      return expense;
    },

    updateExpense: async (_p: unknown, args: UpdateExpenseArgs, ctx: Context) => {
      const existing = await ctx.prisma.expense.findUnique({
        where: { id: args.expenseId },
        include: expenseInclude,
      });
      if (!existing) throw new GraphQLError('Expense not found.');
      await requireMembership(ctx, existing.groupId);
      const group = await ctx.prisma.group.findUniqueOrThrow({ where: { id: existing.groupId } });

      const newAmount = args.amount ?? existing.amount;
      if (args.amount !== undefined) validateAmount(newAmount);
      const newMode = (args.splitMode ?? existing.splitMode) as SplitModeValue;

      // Effective currency/rate: recompute only if the caller touched them.
      const currencyTouched = args.currency !== undefined || args.exchangeRate !== undefined;
      const { currency, exchangeRate } = currencyTouched
        ? resolveCurrency(group, args.currency ?? existing.currency, args.exchangeRate ?? existing.exchangeRate)
        : { currency: existing.currency, exchangeRate: existing.exchangeRate };
      const baseAmount = toBaseAmount(newAmount, exchangeRate);

      const splitStructureProvided = args.splits !== undefined || args.items !== undefined;
      const modeChanged = args.splitMode !== undefined && args.splitMode !== existing.splitMode;
      const totalChanged = baseAmount !== existing.baseAmount;

      let baseSplits: ComputedSplit[] | null = null;
      if (splitStructureProvided || modeChanged) {
        let splitInput = args.splits;
        if (!splitInput && newMode === 'EQUAL') {
          splitInput = existing.splits.map((s) => ({ membershipId: s.membershipId }));
        }
        if (modeNeedsSplits(newMode) && !args.splits) {
          throw new GraphQLError('Provide the split details when changing to this split type.');
        }
        if (newMode === 'ITEMIZED' && !args.items) {
          throw new GraphQLError('Provide items when using an itemized split.');
        }
        const origSplits = buildSplits(newMode, newAmount, splitInput ?? [], args.items ?? []);
        baseSplits = convertSplitsToBase(origSplits, baseAmount);
      } else if (totalChanged) {
        // Same structure, new total/rate: reproportion the existing shares.
        baseSplits = convertSplitsToBase(
          existing.splits.map((s) => ({ membershipId: s.membershipId, amount: s.amount })),
          baseAmount,
        );
      }

      const referenced = [args.paidById ?? existing.paidById, ...(baseSplits?.map((s) => s.membershipId) ?? [])];
      await assertMembersInGroup(ctx, existing.groupId, referenced);

      const updated = await ctx.prisma.$transaction(async (tx) => {
        if (baseSplits) {
          await tx.expenseSplit.deleteMany({ where: { expenseId: existing.id } });
          await tx.expenseSplit.createMany({
            data: baseSplits.map((c) => ({ expenseId: existing.id, membershipId: c.membershipId, amount: c.amount })),
          });
        }
        return tx.expense.update({
          where: { id: existing.id },
          data: {
            description: args.description?.trim() ?? undefined,
            amount: args.amount ?? undefined,
            currency: currencyTouched ? currency : undefined,
            exchangeRate: currencyTouched ? exchangeRate : undefined,
            baseAmount: baseSplits || totalChanged ? baseAmount : undefined,
            paidById: args.paidById ?? undefined,
            splitMode: args.splitMode ?? undefined,
            notes: args.notes !== undefined ? args.notes.trim() || null : undefined,
            date: args.date !== undefined ? parseDate(args.date) : undefined,
          },
          include: expenseInclude,
        });
      });
      await recordAudit(ctx, existing.groupId, 'Expense', existing.id, 'UPDATE', `Updated "${updated.description}"`);
      return updated;
    },

    deleteExpense: async (_p: unknown, args: { expenseId: string }, ctx: Context) => {
      const existing = await ctx.prisma.expense.findUnique({ where: { id: args.expenseId } });
      if (!existing) throw new GraphQLError('Expense not found.');
      await requireMembership(ctx, existing.groupId);
      await ctx.prisma.expense.delete({ where: { id: existing.id } });
      await recordAudit(ctx, existing.groupId, 'Expense', existing.id, 'DELETE', `Deleted "${existing.description}"`);
      return true;
    },
  },

  Group: {
    expenses: async (
      g: { id: string },
      args: { search?: string; memberId?: string },
      ctx: Context,
    ) => {
      await requireMembership(ctx, g.id);
      const search = args.search?.trim();
      const memberId = args.memberId;
      return ctx.prisma.expense.findMany({
        where: {
          groupId: g.id,
          ...(search ? { description: { contains: search, mode: 'insensitive' } } : {}),
          // "involves" a member = they paid or they have a split.
          ...(memberId
            ? { OR: [{ paidById: memberId }, { splits: { some: { membershipId: memberId } } }] }
            : {}),
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: expenseInclude,
      });
    },
  },

  Expense: {
    date: (e: Expense) => e.date.toISOString(),
    createdAt: (e: Expense) => e.createdAt.toISOString(),
    paidBy: (e: Expense, _a: unknown, ctx: Context) =>
      ctx.prisma.membership.findUnique({ where: { id: e.paidById } }),
    splits: (e: Expense & { splits?: ExpenseSplit[] }, _a: unknown, ctx: Context) =>
      e.splits ?? ctx.prisma.expenseSplit.findMany({ where: { expenseId: e.id } }),
  },

  ExpenseSplit: {
    member: (s: ExpenseSplit, _a: unknown, ctx: Context) =>
      ctx.prisma.membership.findUnique({ where: { id: s.membershipId } }),
  },
};
