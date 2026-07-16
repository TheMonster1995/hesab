import { authTypeDefs } from './modules/auth/auth.typeDefs.js';
import { groupsTypeDefs } from './modules/groups/groups.typeDefs.js';
import { expensesTypeDefs } from './modules/expenses/expenses.typeDefs.js';
import { balancesTypeDefs } from './modules/balances/balances.typeDefs.js';
import { auditTypeDefs } from './modules/audit/audit.typeDefs.js';
import { sharingTypeDefs } from './modules/sharing/sharing.typeDefs.js';
import { opsTypeDefs } from './modules/ops/ops.typeDefs.js';

// Base schema. `Query` is defined here; feature modules `extend` it and add
// their own types and mutations. The array is passed straight to createSchema.
const baseTypeDefs = /* GraphQL */ `
  type Query {
    "Liveness check for the API."
    health: Health!
  }

  type Health {
    status: String!
    service: String!
    version: String!
  }
`;

export const typeDefs = [
  baseTypeDefs,
  authTypeDefs,
  groupsTypeDefs,
  expensesTypeDefs,
  balancesTypeDefs,
  auditTypeDefs,
  sharingTypeDefs,
  opsTypeDefs,
];
