import type { Context } from '../../context.js';
import type { Balance } from './simplify.js';

// Net balance per member, in the group's base currency (minor units).
// Uses each expense's baseAmount so mixed-currency groups net out correctly.
export async function computeBalances(ctx: Context, groupId: string): Promise<Balance[]> {
  const [members, expenses, settlements] = await Promise.all([
    ctx.prisma.membership.findMany({ where: { groupId }, select: { id: true } }),
    ctx.prisma.expense.findMany({ where: { groupId }, include: { splits: true } }),
    ctx.prisma.settlement.findMany({ where: { groupId } }),
  ]);

  const net = new Map<string, number>();
  for (const m of members) net.set(m.id, 0);
  const add = (id: string, delta: number) => net.set(id, (net.get(id) ?? 0) + delta);

  for (const exp of expenses) {
    add(exp.paidById, exp.baseAmount);
    for (const split of exp.splits) add(split.membershipId, -split.amount);
  }
  for (const s of settlements) {
    add(s.fromId, s.amount);
    add(s.toId, -s.amount);
  }

  return members.map((m) => ({ membershipId: m.id, amount: net.get(m.id) ?? 0 }));
}
