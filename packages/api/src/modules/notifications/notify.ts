import type { Expense, ExpenseSplit, Settlement } from '@prisma/client';
import type { Context } from '../../context.js';
import { getMailer } from './mailer.js';
import {
  buildExpenseNotifications,
  buildSettlementNotifications,
  type NotifyMember,
} from './notifications.js';

// Load a membership with its (optional) linked user's email.
async function notifyMember(ctx: Context, membershipId: string): Promise<NotifyMember | null> {
  const m = await ctx.prisma.membership.findUnique({
    where: { id: membershipId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!m) return null;
  return { name: m.name, email: m.user?.email ?? null, userId: m.user?.id ?? null };
}

async function deliver(messages: { to: string; subject: string; body: string }[]): Promise<void> {
  const mailer = getMailer();
  await Promise.allSettled(messages.map((msg) => mailer.send(msg)));
}

// Fire-and-forget: notify split members that a new expense was added.
export async function notifyExpenseAdded(
  ctx: Context,
  expense: Expense & { splits: ExpenseSplit[] },
): Promise<void> {
  try {
    const group = await ctx.prisma.group.findUnique({ where: { id: expense.groupId } });
    const payer = await ctx.prisma.membership.findUnique({ where: { id: expense.paidById } });
    if (!group || !payer) return;
    const members = (
      await Promise.all(expense.splits.map((s) => notifyMember(ctx, s.membershipId)))
    ).filter((m): m is NotifyMember => m !== null);

    await deliver(
      buildExpenseNotifications({
        groupName: group.name,
        description: expense.description,
        payerName: payer.name,
        actorUserId: ctx.userId,
        amountMinor: expense.amount,
        currency: expense.currency,
        members,
      }),
    );
  } catch {
    // notifications must never break the mutation
  }
}

export async function notifySettlementAdded(ctx: Context, settlement: Settlement): Promise<void> {
  try {
    const group = await ctx.prisma.group.findUnique({ where: { id: settlement.groupId } });
    const from = await ctx.prisma.membership.findUnique({ where: { id: settlement.fromId } });
    const toMember = await notifyMember(ctx, settlement.toId);
    if (!group || !from || !toMember) return;

    await deliver(
      buildSettlementNotifications({
        groupName: group.name,
        fromName: from.name,
        toMember,
        actorUserId: ctx.userId,
        amountMinor: settlement.amount,
        currency: settlement.currency,
      }),
    );
  } catch {
    // swallow
  }
}
