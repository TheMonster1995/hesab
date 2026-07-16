import type { Context } from '../../context.js';

type AuditActionValue = 'CREATE' | 'UPDATE' | 'DELETE';

// Append an edit-history entry. Best-effort: never let logging break a mutation.
export async function recordAudit(
  ctx: Context,
  groupId: string,
  entity: string,
  entityId: string,
  action: AuditActionValue,
  summary: string,
): Promise<void> {
  try {
    await ctx.prisma.auditLog.create({
      data: { groupId, entity, entityId, action, summary, actorUserId: ctx.userId ?? null },
    });
  } catch {
    // history is non-critical; swallow
  }
}
