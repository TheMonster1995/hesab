import { GraphQLError } from 'graphql';
import type { ShareLink } from '@prisma/client';
import type { Context } from '../../context.js';
import { requireAdmin, requireMembership } from '../groups/permissions.js';
import { computeBalances } from '../balances/compute.js';
import { simplifyDebts } from '../balances/simplify.js';

export const sharingResolvers = {
  Query: {
    // Public — no membership required, gated only by possession of the token.
    sharedGroup: async (_p: unknown, args: { token: string }, ctx: Context) => {
      const link = await ctx.prisma.shareLink.findUnique({ where: { token: args.token } });
      if (!link || link.revoked) return null;
      const groupId = link.groupId;

      const group = await ctx.prisma.group.findUnique({ where: { id: groupId } });
      if (!group) return null;

      const [members, expenses, balances] = await Promise.all([
        ctx.prisma.membership.findMany({ where: { groupId }, orderBy: { createdAt: 'asc' } }),
        ctx.prisma.expense.findMany({
          where: { groupId },
          include: { splits: true },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        }),
        computeBalances(ctx, groupId),
      ]);
      const nameById = new Map(members.map((m) => [m.id, m.name]));
      const name = (id: string) => nameById.get(id) ?? '—';
      const transfers = simplifyDebts(balances);

      return {
        name: group.name,
        baseCurrency: group.baseCurrency,
        members: members.map((m) => ({ id: m.id, name: m.name })),
        expenses: expenses.map((e) => ({
          id: e.id,
          description: e.description,
          amount: e.amount,
          currency: e.currency,
          baseAmount: e.baseAmount,
          date: e.date.toISOString(),
          paidByName: name(e.paidById),
          splits: e.splits.map((s) => ({ name: name(s.membershipId), amount: s.amount })),
        })),
        balances: balances.map((b) => ({ name: name(b.membershipId), amount: b.amount })),
        suggestedTransfers: transfers.map((t) => ({
          fromName: name(t.fromId),
          toName: name(t.toId),
          amount: t.amount,
        })),
      };
    },
  },

  Mutation: {
    createShareLink: async (_p: unknown, args: { groupId: string }, ctx: Context) => {
      await requireAdmin(ctx, args.groupId);
      return ctx.prisma.shareLink.create({ data: { groupId: args.groupId } });
    },
    revokeShareLink: async (
      _p: unknown,
      args: { groupId: string; shareLinkId: string },
      ctx: Context,
    ) => {
      await requireAdmin(ctx, args.groupId);
      const link = await ctx.prisma.shareLink.findUnique({ where: { id: args.shareLinkId } });
      if (!link || link.groupId !== args.groupId) throw new GraphQLError('Share link not found.');
      await ctx.prisma.shareLink.update({ where: { id: link.id }, data: { revoked: true } });
      return true;
    },
  },

  Group: {
    shareLinks: async (g: { id: string }, _a: unknown, ctx: Context) => {
      await requireMembership(ctx, g.id);
      return ctx.prisma.shareLink.findMany({
        where: { groupId: g.id, revoked: false },
        orderBy: { createdAt: 'desc' },
      });
    },
  },

  ShareLink: {
    createdAt: (s: ShareLink) => s.createdAt.toISOString(),
  },
};
