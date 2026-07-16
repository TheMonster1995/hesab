import type { Context } from '../../context.js';
import { requireMembership } from '../groups/permissions.js';
import { computeBalances } from '../balances/compute.js';

function csvCell(value: string | number): string {
  const s = String(value);
  // Quote if the value contains a comma, quote, or newline.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function money(minor: number): string {
  return (minor / 100).toFixed(2);
}

export const opsResolvers = {
  Query: {
    exportGroupCsv: async (_p: unknown, args: { groupId: string }, ctx: Context) => {
      await requireMembership(ctx, args.groupId);
      const group = await ctx.prisma.group.findUniqueOrThrow({ where: { id: args.groupId } });
      const [members, expenses, balances] = await Promise.all([
        ctx.prisma.membership.findMany({ where: { groupId: args.groupId } }),
        ctx.prisma.expense.findMany({
          where: { groupId: args.groupId },
          include: { splits: true },
          orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        }),
        computeBalances(ctx, args.groupId),
      ]);
      const nameById = new Map(members.map((m) => [m.id, m.name]));
      const name = (id: string) => nameById.get(id) ?? '—';

      const lines: string[] = [];
      lines.push(`hesab export — ${group.name} (base ${group.baseCurrency})`);
      lines.push('');
      lines.push('Expenses');
      lines.push(
        ['Date', 'Description', 'Paid by', 'Amount', 'Currency', `Amount (${group.baseCurrency})`, 'Split']
          .map(csvCell)
          .join(','),
      );
      for (const e of expenses) {
        lines.push(
          [
            e.date.toISOString().slice(0, 10),
            e.description,
            name(e.paidById),
            money(e.amount),
            e.currency,
            money(e.baseAmount),
            e.splitMode,
          ]
            .map(csvCell)
            .join(','),
        );
      }
      lines.push('');
      lines.push('Balances');
      lines.push(['Member', `Net (${group.baseCurrency})`].map(csvCell).join(','));
      for (const b of balances) {
        lines.push([name(b.membershipId), money(b.amount)].map(csvCell).join(','));
      }
      return lines.join('\n');
    },
  },
};
