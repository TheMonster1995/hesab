export const authTypeDefs = /* GraphQL */ `
  type User {
    id: ID!
    email: String!
    name: String!
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  extend type Query {
    "The currently authenticated user, or null if signed out."
    me: User
  }

  type Mutation {
    signup(email: String!, password: String!, name: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    logout: Boolean!
  }
`;
