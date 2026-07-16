import { GraphQLError } from 'graphql';
import type { Group, Membership, Invite } from '@prisma/client';
import type { Context } from '../../context.js';
import { requireUserId } from '../../auth/guards.js';
import { publicUser } from '../auth/auth.resolvers.js';
import {
  getMembership,
  requireMembership,
  requireAdmin,
  assertNotLastAdmin,
} from './permissions.js';

type RoleValue = 'ADMIN' | 'MEMBER';

function normalizeCurrency(input?: string | null): string {
  const code = (input ?? 'EUR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new GraphQLError('Currency must be a 3-letter code, e.g. EUR.');
  }
  return code;
}

export const groupsResolvers = {
  Query: {
    myGroups: async (_p: unknown, _a: unknown, ctx: Context) => {
      const userId = requireUserId(ctx);
      return ctx.prisma.group.findMany({
        where: { memberships: { some: { userId } } },
        orderBy: { createdAt: 'desc' },
      });
    },
    group: async (_p: unknown, args: { id: string }, ctx: Context) => {
      await requireMembership(ctx, args.id);
      return ctx.prisma.group.findUnique({ where: { id: args.id } });
    },
  },

  Mutation: {
    createGroup: async (
      _p: unknown,
      args: { name: string; baseCurrency?: string },
      ctx: Context,
    ) => {
      const userId = requireUserId(ctx);
      const name = args.name.trim();
      if (!name) throw new GraphQLError('Group name is required.');
      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      return ctx.prisma.group.create({
        data: {
          name,
          baseCurrency: normalizeCurrency(args.baseCurrency),
          memberships: { create: { userId, name: user.name, role: 'ADMIN' } },
        },
      });
    },

    addMember: async (
      _p: unknown,
      args: { groupId: string; name: string },
      ctx: Context,
    ) => {
      await requireAdmin(ctx, args.groupId);
      const name = args.name.trim();
      if (!name) throw new GraphQLError('Member name is required.');
      return ctx.prisma.membership.create({
        data: { groupId: args.groupId, name, role: 'MEMBER' },
      });
    },

    inviteByEmail: async (
      _p: unknown,
      args: { groupId: string; email: string; role?: RoleValue },
      ctx: Context,
    ) => {
      await requireAdmin(ctx, args.groupId);
      const email = args.email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new GraphQLError('A valid email is required.');
      }
      // Reuse an existing pending invite for the same email rather than duplicating.
      const existing = await ctx.prisma.invite.findFirst({
        where: { groupId: args.groupId, email, status: 'PENDING' },
      });
      if (existing) return existing;
      return ctx.prisma.invite.create({
        data: { groupId: args.groupId, email, role: args.role ?? 'MEMBER' },
      });
    },

    revokeInvite: async (
      _p: unknown,
      args: { groupId: string; inviteId: string },
      ctx: Context,
    ) => {
      await requireAdmin(ctx, args.groupId);
      const invite = await ctx.prisma.invite.findUnique({ where: { id: args.inviteId } });
      if (!invite || invite.groupId !== args.groupId) {
        throw new GraphQLError('Invite not found.');
      }
      await ctx.prisma.invite.update({
        where: { id: args.inviteId },
        data: { status: 'REVOKED' },
      });
      return true;
    },

    acceptInvite: async (_p: unknown, args: { token: string }, ctx: Context) => {
      const userId = requireUserId(ctx);
      const invite = await ctx.prisma.invite.findUnique({ where: { token: args.token } });
      if (!invite || invite.status !== 'PENDING') {
        throw new GraphQLError('This invite is no longer valid.');
      }
      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const already = await ctx.prisma.membership.findFirst({
        where: { groupId: invite.groupId, userId },
      });
      if (!already) {
        await ctx.prisma.membership.create({
          data: { groupId: invite.groupId, userId, name: user.name, role: invite.role },
        });
      }
      await ctx.prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });
      return ctx.prisma.group.findUniqueOrThrow({ where: { id: invite.groupId } });
    },

    updateMemberRole: async (
      _p: unknown,
      args: { groupId: string; membershipId: string; role: RoleValue },
      ctx: Context,
    ) => {
      await requireAdmin(ctx, args.groupId);
      const target = await ctx.prisma.membership.findUnique({
        where: { id: args.membershipId },
      });
      if (!target || target.groupId !== args.groupId) {
        throw new GraphQLError('Member not found.');
      }
      if (target.role === 'ADMIN' && args.role === 'MEMBER') {
        await assertNotLastAdmin(ctx, args.groupId, target);
      }
      return ctx.prisma.membership.update({
        where: { id: args.membershipId },
        data: { role: args.role },
      });
    },

    removeMember: async (
      _p: unknown,
      args: { groupId: string; membershipId: string },
      ctx: Context,
    ) => {
      await requireAdmin(ctx, args.groupId);
      const target = await ctx.prisma.membership.findUnique({
        where: { id: args.membershipId },
      });
      if (!target || target.groupId !== args.groupId) {
        throw new GraphQLError('Member not found.');
      }
      await assertNotLastAdmin(ctx, args.groupId, target);
      await ctx.prisma.membership.delete({ where: { id: args.membershipId } });
      return true;
    },
  },

  Group: {
    createdAt: (g: Group) => g.createdAt.toISOString(),
    members: (g: Group, _a: unknown, ctx: Context) =>
      ctx.prisma.membership.findMany({
        where: { groupId: g.id },
        orderBy: { createdAt: 'asc' },
      }),
    memberCount: (g: Group, _a: unknown, ctx: Context) =>
      ctx.prisma.membership.count({ where: { groupId: g.id } }),
    invites: async (g: Group, _a: unknown, ctx: Context) => {
      await requireMembership(ctx, g.id);
      return ctx.prisma.invite.findMany({
        where: { groupId: g.id, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
    },
    myRole: async (g: Group, _a: unknown, ctx: Context) => {
      const membership = await getMembership(ctx, g.id);
      return membership?.role ?? null;
    },
  },

  Membership: {
    createdAt: (m: Membership) => m.createdAt.toISOString(),
    isYou: (m: Membership, _a: unknown, ctx: Context) =>
      m.userId != null && m.userId === ctx.userId,
    user: async (m: Membership, _a: unknown, ctx: Context) => {
      if (!m.userId) return null;
      const user = await ctx.prisma.user.findUnique({ where: { id: m.userId } });
      return user ? publicUser(user) : null;
    },
  },

  Invite: {
    createdAt: (i: Invite) => i.createdAt.toISOString(),
  },
};
