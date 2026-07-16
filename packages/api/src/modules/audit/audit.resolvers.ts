import type { AuditLog } from '@prisma/client';
import type { Context } from '../../context.js';
import { requireMembership } from '../groups/permissions.js';
import { publicUser } from '../auth/auth.resolvers.js';

export const auditResolvers = {
  Group: {
    changeLog: async (g: { id: string }, _a: unknown, ctx: Context) => {
      await requireMembership(ctx, g.id);
      return ctx.prisma.auditLog.findMany({
        where: { groupId: g.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    },
  },

  AuditEntry: {
    createdAt: (e: AuditLog) => e.createdAt.toISOString(),
    actor: async (e: AuditLog, _a: unknown, ctx: Context) => {
      if (!e.actorUserId) return null;
      const user = await ctx.prisma.user.findUnique({ where: { id: e.actorUserId } });
      return user ? publicUser(user) : null;
    },
  },
};
