import { GraphQLError } from 'graphql';
import type { Membership } from '@prisma/client';
import type { Context } from '../../context.js';

function forbidden(message: string): never {
  throw new GraphQLError(message, { extensions: { code: 'FORBIDDEN' } });
}

// The current user's membership in a group, or null.
export async function getMembership(
  ctx: Context,
  groupId: string,
): Promise<Membership | null> {
  if (!ctx.userId) return null;
  return ctx.prisma.membership.findFirst({
    where: { groupId, userId: ctx.userId },
  });
}

export async function requireMembership(ctx: Context, groupId: string): Promise<Membership> {
  const membership = await getMembership(ctx, groupId);
  if (!membership) forbidden('You are not a member of this group.');
  return membership;
}

export async function requireAdmin(ctx: Context, groupId: string): Promise<Membership> {
  const membership = await requireMembership(ctx, groupId);
  if (membership.role !== 'ADMIN') forbidden('Only group admins can do that.');
  return membership;
}

// Guards the "at least one admin" invariant before demoting/removing an admin.
export async function assertNotLastAdmin(
  ctx: Context,
  groupId: string,
  membership: Membership,
): Promise<void> {
  if (membership.role !== 'ADMIN') return;
  const adminCount = await ctx.prisma.membership.count({
    where: { groupId, role: 'ADMIN' },
  });
  if (adminCount <= 1) {
    forbidden('A group must always have at least one admin.');
  }
}
