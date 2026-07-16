export const opsTypeDefs = /* GraphQL */ `
  extend type Query {
    "Expenses and balances as CSV text, for download."
    exportGroupCsv(groupId: ID!): String!
  }
`;
