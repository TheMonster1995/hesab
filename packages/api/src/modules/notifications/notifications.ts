// Pure notification builders — decide who gets emailed and what it says.
// No I/O here so this is trivially unit-testable.

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface NotifyMember {
  name: string;
  email: string | null;
  userId: string | null;
}

function formatAmount(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

// Notify each split member who has an account, except the person who acted.
export function buildExpenseNotifications(params: {
  groupName: string;
  description: string;
  payerName: string;
  actorUserId: string | null;
  amountMinor: number;
  currency: string;
  members: NotifyMember[];
}): EmailMessage[] {
  return params.members
    .filter((m) => m.email && m.userId && m.userId !== params.actorUserId)
    .map((m) => ({
      to: m.email as string,
      subject: `New expense in ${params.groupName}: ${params.description}`,
      body:
        `${params.payerName} added "${params.description}" ` +
        `(${formatAmount(params.amountMinor, params.currency)}) in "${params.groupName}". ` +
        `Your share has been recorded.`,
    }));
}

// Notify the person who was paid, unless they did the recording themselves.
export function buildSettlementNotifications(params: {
  groupName: string;
  fromName: string;
  toMember: NotifyMember;
  actorUserId: string | null;
  amountMinor: number;
  currency: string;
}): EmailMessage[] {
  const m = params.toMember;
  if (!m.email || !m.userId || m.userId === params.actorUserId) return [];
  return [
    {
      to: m.email,
      subject: `You were paid in ${params.groupName}`,
      body:
        `${params.fromName} recorded a payment of ` +
        `${formatAmount(params.amountMinor, params.currency)} to you in "${params.groupName}".`,
    },
  ];
}
