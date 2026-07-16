import type { Context } from './context.js';
import { authResolvers } from './modules/auth/auth.resolvers.js';
import { groupsResolvers } from './modules/groups/groups.resolvers.js';
import { expensesResolvers } from './modules/expenses/expenses.resolvers.js';
import { balancesResolvers } from './modules/balances/balances.resolvers.js';
import { auditResolvers } from './modules/audit/audit.resolvers.js';
import { sharingResolvers } from './modules/sharing/sharing.resolvers.js';
import { opsResolvers } from './modules/ops/ops.resolvers.js';

export const resolvers = {
  Query: {
    health: (_parent: unknown, _args: unknown, _ctx: Context) => ({
      status: 'ok',
      service: 'hesab-api',
      version: '0.1.0',
    }),
    ...authResolvers.Query,
    ...groupsResolvers.Query,
    ...expensesResolvers.Query,
    ...sharingResolvers.Query,
    ...opsResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...groupsResolvers.Mutation,
    ...expensesResolvers.Mutation,
    ...balancesResolvers.Mutation,
    ...sharingResolvers.Mutation,
  },
  Group: {
    ...groupsResolvers.Group,
    ...expensesResolvers.Group,
    ...balancesResolvers.Group,
    ...auditResolvers.Group,
    ...sharingResolvers.Group,
  },
  Membership: groupsResolvers.Membership,
  Invite: groupsResolvers.Invite,
  Expense: expensesResolvers.Expense,
  ExpenseSplit: expensesResolvers.ExpenseSplit,
  Balance: balancesResolvers.Balance,
  Transfer: balancesResolvers.Transfer,
  Settlement: balancesResolvers.Settlement,
  AuditEntry: auditResolvers.AuditEntry,
  ShareLink: sharingResolvers.ShareLink,
};
