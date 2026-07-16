export const sharingTypeDefs = /* GraphQL */ `
  type ShareLink {
    id: ID!
    token: String!
    revoked: Boolean!
    createdAt: String!
  }

  # Read-only, account-free view of a group. Deliberately excludes emails,
  # invite tokens, roles, and share links.
  type SharedGroup {
    name: String!
    baseCurrency: String!
    members: [SharedMember!]!
    expenses: [SharedExpense!]!
    balances: [SharedBalance!]!
    suggestedTransfers: [SharedTransfer!]!
  }
  type SharedMember {
    id: ID!
    name: String!
  }
  type SharedExpense {
    id: ID!
    description: String!
    amount: Int!
    currency: String!
    baseAmount: Int!
    date: String!
    paidByName: String!
    splits: [SharedSplit!]!
  }
  type SharedSplit {
    name: String!
    amount: Int!
  }
  type SharedBalance {
    name: String!
    amount: Int!
  }
  type SharedTransfer {
    fromName: String!
    toName: String!
    amount: Int!
  }

  extend type Group {
    shareLinks: [ShareLink!]!
  }

  extend type Query {
    "Public read-only group view for a share token; null if the link is invalid."
    sharedGroup(token: String!): SharedGroup
  }

  extend type Mutation {
    createShareLink(groupId: ID!): ShareLink!
    revokeShareLink(groupId: ID!, shareLinkId: ID!): Boolean!
  }
`;
