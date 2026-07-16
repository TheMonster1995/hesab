export const balancesTypeDefs = /* GraphQL */ `
  type Balance {
    member: Membership!
    "Net minor units: positive = owed to them, negative = they owe."
    amount: Int!
  }

  type Transfer {
    from: Membership!
    to: Membership!
    amount: Int!
  }

  type Settlement {
    id: ID!
    from: Membership!
    to: Membership!
    amount: Int!
    currency: String!
    date: String!
    note: String
  }

  extend type Group {
    balances: [Balance!]!
    settlements: [Settlement!]!
    "The minimal set of payments that would settle every balance."
    suggestedTransfers: [Transfer!]!
  }

  extend type Mutation {
    addSettlement(
      groupId: ID!
      fromId: ID!
      toId: ID!
      amount: Int!
      date: String
      note: String
    ): Settlement!
    deleteSettlement(settlementId: ID!): Boolean!
  }
`;
