export const groupsTypeDefs = /* GraphQL */ `
  enum Role {
    ADMIN
    MEMBER
  }

  enum InviteStatus {
    PENDING
    ACCEPTED
    REVOKED
  }

  type Group {
    id: ID!
    name: String!
    baseCurrency: String!
    createdAt: String!
    members: [Membership!]!
    memberCount: Int!
    invites: [Invite!]!
    "The signed-in user's role in this group, or null if not a member."
    myRole: Role
  }

  type Membership {
    id: ID!
    name: String!
    role: Role!
    user: User
    "True if this membership is the signed-in user."
    isYou: Boolean!
    createdAt: String!
  }

  type Invite {
    id: ID!
    email: String!
    token: String!
    role: Role!
    status: InviteStatus!
    createdAt: String!
  }

  extend type Query {
    "Groups the signed-in user belongs to."
    myGroups: [Group!]!
    group(id: ID!): Group
  }

  extend type Mutation {
    createGroup(name: String!, baseCurrency: String): Group!
    addMember(groupId: ID!, name: String!): Membership!
    inviteByEmail(groupId: ID!, email: String!, role: Role): Invite!
    revokeInvite(groupId: ID!, inviteId: ID!): Boolean!
    "Join a group using an invite token (requires being signed in)."
    acceptInvite(token: String!): Group!
    updateMemberRole(groupId: ID!, membershipId: ID!, role: Role!): Membership!
    removeMember(groupId: ID!, membershipId: ID!): Boolean!
  }
`;
