export const auditTypeDefs = /* GraphQL */ `
  enum AuditAction {
    CREATE
    UPDATE
    DELETE
  }

  type AuditEntry {
    id: ID!
    entity: String!
    action: AuditAction!
    summary: String!
    actor: User
    createdAt: String!
  }

  extend type Group {
    "Edit history for expenses and settlements, newest first."
    changeLog: [AuditEntry!]!
  }
`;
