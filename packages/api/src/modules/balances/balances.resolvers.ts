import { GraphQLError } from 'graphql';
import type { Settlement } from '@prisma/client';
import type { Context } from '../../context.js';
import { requireMembership } from '../groups/permissions.js';
import { recordAudit } from '../audit/audit.js';
import { notifySettlementAdded } from '../notifications/notify.js';
import { simplifyDebts } from './simplify.js';
import { computeBalances } from './compute.js';

interface AddSettlementArgs {
  groupId: string;
  fromId: string;
  toId: string;
  amount: number;
  date?: string;
  note?: string;
}

export const balancesResolvers = {
  Mutation: {
    addSettlement: async (_p: unknown, args: AddSettlementArgs, ctx: Context) => {
      await requireMembership(ctx, args.groupId);
      if (args.fromId === args.toId) {
        throw new GraphQLError('A settlement needs two different members.');
      }
      if (!Number.isInteger(args.amount) || args.amount <= 0) {
        throw new GraphQLError('Amount must be a positive whole number of minor units.');
      }
      const rows = await ctx.prisma.membership.findMany({
        where: { groupId: args.groupId, id: { in: [args.fromId, args.toId] } },
        select: { id: true },
      });
      if (rows.length !== 2) {
        throw new GraphQLError('Both members must belong to this group.');
      }
      const group = await ctx.prisma.group.findUniqueOrThrow({ where: { id: args.groupId } });
      const date = args.date ? new Date(args.date) : new Date();
      if (Number.isNaN(date.getTime())) throw new GraphQLError('Invalid date.');

      const settlement = await ctx.prisma.settlement.create({
        data: {
          groupId: args.groupId,
          fromId: args.fromId,
          toId: args.toId,
          amount: args.amount,
          currency: group.baseCurrency,
          date,
          note: args.note?.trim() || null,
        },
      });
      await recordAudit(ctx, args.groupId, 'Settlement', settlement.id, 'CREATE', 'Recorded a settlement');
      void notifySettlementAdded(ctx, settlement);
      return settlement;
    },

    deleteSettlement: async (_p: unknown, args: { settlementId: string }, ctx: Context) => {
      const existing = await ctx.prisma.settlement.findUnique({
        where: { id: args.settlementId },
      });
      if (!existing) throw new GraphQLError('Settlement not found.');
      await requireMembership(ctx, existing.groupId);
      await ctx.prisma.settlement.delete({ where: { id: existing.id } });
      await recordAudit(ctx, existing.groupId, 'Settlement', existing.id, 'DELETE', 'Removed a settlement');
      return true;
    },
  },

  Group: {
    balances: async (g: { id: string }, _a: unknown, ctx: Context) => {
      await requireMembership(ctx, g.id);
      const balances = await computeBalances(ctx, g.id);
      return balances.map((b) => ({ membershipId: b.membershipId, amount: b.amount }));
    },
    settlements: async (g: { id: string }, _a: unknown, ctx: Context) => {
      await requireMembership(ctx, g.id);
      return ctx.prisma.settlement.findMany({
        where: { groupId: g.id },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      });
    },
    suggestedTransfers: async (g: { id: string }, _a: unknown, ctx: Context) => {
      await requireMembership(ctx, g.id);
      const balances = await computeBalances(ctx, g.id);
      return simplifyDebts(balances);
    },
  },

  Balance: {
    member: (b: { membershipId: string }, _a: unknown, ctx: Context) =>
      ctx.prisma.membership.findUnique({ where: { id: b.membershipId } }),
  },

  Transfer: {
    from: (t: { fromId: string }, _a: unknown, ctx: Context) =>
      ctx.prisma.membership.findUnique({ where: { id: t.fromId } }),
    to: (t: { toId: string }, _a: unknown, ctx: Context) =>
      ctx.prisma.membership.findUnique({ where: { id: t.toId } }),
  },

  Settlement: {
    date: (s: Settlement) => s.date.toISOString(),
    from: (s: Settlement, _a: unknown, ctx: Context) =>
      ctx.prisma.membership.findUnique({ where: { id: s.fromId } }),
    to: (s: Settlement, _a: unknown, ctx: Context) =>
      ctx.prisma.membership.findUnique({ where: { id: s.toId } }),
  },
};
