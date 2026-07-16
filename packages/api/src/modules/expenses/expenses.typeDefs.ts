export const expensesTypeDefs = /* GraphQL */ `
  enum SplitMode {
    EQUAL
    EXACT
    PERCENTAGE
    SHARES
    ADJUSTMENT
    ITEMIZED
  }

  type Expense {
    id: ID!
    description: String!
    "Total in the expense's own currency (integer minor units)."
    amount: Int!
    currency: String!
    "Total converted into the group's base currency (minor units)."
    baseAmount: Int!
    "Base-currency units per 1 unit of the expense currency."
    exchangeRate: Float!
    date: String!
    notes: String
    splitMode: SplitMode!
    paidBy: Membership!
    "Each member's share, in the group's base currency (minor units)."
    splits: [ExpenseSplit!]!
    createdAt: String!
  }

  type ExpenseSplit {
    id: ID!
    member: Membership!
    "This member's share in the group's base currency (minor units)."
    amount: Int!
  }

  input SplitInput {
    membershipId: ID!
    "EXACT: minor units."
    amount: Int
    "PERCENTAGE: basis points (10000 = 100%). SHARES: weight. ADJUSTMENT: minor units +/-."
    value: Int
  }

  input ItemInput {
    description: String!
    amount: Int!
    membershipIds: [ID!]!
  }

  extend type Group {
    "Expenses, newest first. Optionally filter by text and/or a member involved."
    expenses(search: String, memberId: ID): [Expense!]!
  }

  extend type Query {
    expense(id: ID!): Expense
  }

  extend type Mutation {
    addExpense(
      groupId: ID!
      description: String!
      amount: Int!
      paidById: ID!
      splitMode: SplitMode!
      splits: [SplitInput!]
      items: [ItemInput!]
      currency: String
      exchangeRate: Float
      date: String
      notes: String
    ): Expense!
    updateExpense(
      expenseId: ID!
      description: String
      amount: Int
      paidById: ID
      splitMode: SplitMode
      splits: [SplitInput!]
      items: [ItemInput!]
      currency: String
      exchangeRate: Float
      date: String
      notes: String
    ): Expense!
    deleteExpense(expenseId: ID!): Boolean!
  }
`;
