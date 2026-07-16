import { useState, type FormEvent } from 'react';
import { gql, useQuery, useMutation, useApolloClient } from '@apollo/client';
import { Link, useParams } from 'react-router-dom';
import { Screen, Card, Eyebrow, Field, TextInput, Button, Badge, FormError, ThemeToggle } from '../ui';
import { ExpenseForm } from '../components/ExpenseForm';
import { formatMoney } from '../money';

const GROUP = gql`
  query Group($id: ID!, $search: String) {
    group(id: $id) {
      id
      name
      baseCurrency
      myRole
      members {
        id
        name
        role
        isYou
        user {
          id
          email
        }
      }
      invites {
        id
        email
        token
        role
        status
      }
      expenses(search: $search) {
        id
        description
        amount
        currency
        date
        splitMode
        notes
        paidBy {
          id
          name
        }
        splits {
          amount
          member {
            id
            name
          }
        }
      }
      balances {
        amount
        member {
          id
          name
        }
      }
      suggestedTransfers {
        amount
        from {
          id
          name
        }
        to {
          id
          name
        }
      }
      settlements {
        id
        amount
        currency
        date
        note
        from {
          id
          name
        }
        to {
          id
          name
        }
      }
      shareLinks {
        id
        token
        revoked
      }
      changeLog {
        id
        entity
        action
        summary
        createdAt
        actor {
          name
        }
      }
    }
  }
`;

const ADD_MEMBER = gql`
  mutation AddMember($groupId: ID!, $name: String!) {
    addMember(groupId: $groupId, name: $name) {
      id
    }
  }
`;
const INVITE = gql`
  mutation Invite($groupId: ID!, $email: String!) {
    inviteByEmail(groupId: $groupId, email: $email) {
      id
      token
    }
  }
`;
const REVOKE = gql`
  mutation Revoke($groupId: ID!, $inviteId: ID!) {
    revokeInvite(groupId: $groupId, inviteId: $inviteId)
  }
`;
const SET_ROLE = gql`
  mutation SetRole($groupId: ID!, $membershipId: ID!, $role: Role!) {
    updateMemberRole(groupId: $groupId, membershipId: $membershipId, role: $role) {
      id
      role
    }
  }
`;
const REMOVE = gql`
  mutation Remove($groupId: ID!, $membershipId: ID!) {
    removeMember(groupId: $groupId, membershipId: $membershipId)
  }
`;
const DELETE_EXPENSE = gql`
  mutation DeleteExpense($expenseId: ID!) {
    deleteExpense(expenseId: $expenseId)
  }
`;
const ADD_SETTLEMENT = gql`
  mutation AddSettlement($groupId: ID!, $fromId: ID!, $toId: ID!, $amount: Int!) {
    addSettlement(groupId: $groupId, fromId: $fromId, toId: $toId, amount: $amount) {
      id
    }
  }
`;
const DELETE_SETTLEMENT = gql`
  mutation DeleteSettlement($settlementId: ID!) {
    deleteSettlement(settlementId: $settlementId)
  }
`;
const CREATE_SHARE_LINK = gql`
  mutation CreateShareLink($groupId: ID!) {
    createShareLink(groupId: $groupId) {
      id
    }
  }
`;
const REVOKE_SHARE_LINK = gql`
  mutation RevokeShareLink($groupId: ID!, $shareLinkId: ID!) {
    revokeShareLink(groupId: $groupId, shareLinkId: $shareLinkId)
  }
`;
const EXPORT_CSV = gql`
  query ExportGroupCsv($groupId: ID!) {
    exportGroupCsv(groupId: $groupId)
  }
`;

interface Member {
  id: string;
  name: string;
  role: 'ADMIN' | 'MEMBER';
  isYou: boolean;
  user: { id: string; email: string } | null;
}
interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  splitMode: 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES' | 'ADJUSTMENT' | 'ITEMIZED';
  notes: string | null;
  paidBy: { id: string; name: string };
  splits: { amount: number; member: { id: string; name: string } }[];
}
interface GroupData {
  group: {
    id: string;
    name: string;
    baseCurrency: string;
    myRole: 'ADMIN' | 'MEMBER' | null;
    members: Member[];
    invites: { id: string; email: string; token: string; role: string; status: string }[];
    expenses: Expense[];
    balances: { amount: number; member: { id: string; name: string } }[];
    suggestedTransfers: { amount: number; from: { id: string; name: string }; to: { id: string; name: string } }[];
    settlements: {
      id: string;
      amount: number;
      currency: string;
      date: string;
      note: string | null;
      from: { id: string; name: string };
      to: { id: string; name: string };
    }[];
    shareLinks: { id: string; token: string; revoked: boolean }[];
    changeLog: {
      id: string;
      entity: string;
      action: string;
      summary: string;
      createdAt: string;
      actor: { name: string } | null;
    }[];
  } | null;
}

export function GroupDetail() {
  const { id = '' } = useParams();
  const [search, setSearch] = useState('');
  const { data, loading, error, refetch } = useQuery<GroupData>(GROUP, {
    variables: { id, search: search || null },
  });

  const [memberName, setMemberName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const [addMember, { loading: adding, error: addError }] = useMutation(ADD_MEMBER);
  const [invite, { loading: inviting, error: inviteError }] = useMutation(INVITE);
  const [revoke] = useMutation(REVOKE);
  const [setRole] = useMutation(SET_ROLE);
  const [remove] = useMutation(REMOVE);
  const [deleteExpense] = useMutation(DELETE_EXPENSE);
  const [addSettlement] = useMutation(ADD_SETTLEMENT);
  const [deleteSettlement] = useMutation(DELETE_SETTLEMENT);
  const [createShareLink] = useMutation(CREATE_SHARE_LINK);
  const [revokeShareLink] = useMutation(REVOKE_SHARE_LINK);
  const apollo = useApolloClient();

  async function onExportCsv() {
    const res = await apollo.query({ query: EXPORT_CSV, variables: { groupId: id }, fetchPolicy: 'network-only' });
    const csv: string = res.data.exportGroupCsv;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hesab-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !data) return <Screen><p className="text-muted">Loading…</p></Screen>;
  if (error || !data?.group)
    return (
      <Screen>
        <Card className="max-w-md">
          <p className="text-muted">{error?.message ?? 'Group not found.'}</p>
          <Link to="/" className="mt-4 inline-block text-accent hover:underline">
            ← Back to dashboard
          </Link>
        </Card>
      </Screen>
    );

  const group = data.group;
  const isAdmin = group.myRole === 'ADMIN';

  async function onAddMember(e: FormEvent) {
    e.preventDefault();
    await addMember({ variables: { groupId: id, name: memberName } });
    setMemberName('');
    await refetch();
  }
  async function onInvite(e: FormEvent) {
    e.preventDefault();
    await invite({ variables: { groupId: id, email: inviteEmail } });
    setInviteEmail('');
    await refetch();
  }

  return (
    <Screen>
      <div className="w-full max-w-2xl">
        <Link to="/" className="text-sm text-muted hover:text-ink">← Dashboard</Link>
        <div className="mt-2 mb-6 flex items-end justify-between">
          <div>
            <Eyebrow>hesab &middot; group</Eyebrow>
            <h1 className="mt-2 font-serif text-4xl">{group.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{group.baseCurrency}</Badge>
            <ThemeToggle />
          </div>
        </div>

        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">Expenses</h2>
            <span className="font-mono text-xs text-muted">{group.expenses.length} shown</span>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses…"
            className="mt-3 w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          {group.expenses.length === 0 && (
            <p className="mt-3 text-muted">No expenses yet — add the first one below.</p>
          )}
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {group.expenses.map((ex) => (
              <li key={ex.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{ex.description}</p>
                  <p className="text-sm text-muted">
                    {ex.paidBy.name} paid &middot; split {ex.splitMode === 'EQUAL' ? 'equally' : 'by amount'} between{' '}
                    {ex.splits.length} &middot; {new Date(ex.date).toLocaleDateString()}
                  </p>
                  {ex.notes && <p className="mt-0.5 text-xs italic text-muted">{ex.notes}</p>}
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-mono tabular-nums">{formatMoney(ex.amount, ex.currency)}</span>
                  <button
                    onClick={async () => {
                      await deleteExpense({ variables: { expenseId: ex.id } });
                      await refetch();
                    }}
                    className="mt-1 text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <details className="mt-4">
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-accent">
              + Add an expense
            </summary>
            <ExpenseForm
              groupId={group.id}
              members={group.members.map((m) => ({ id: m.id, name: m.name }))}
              baseCurrency={group.baseCurrency}
              onAdded={refetch}
            />
          </details>
        </Card>

        <Card>
          <h2 className="font-serif text-2xl">Members</h2>
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {group.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{m.name}</span>
                  {m.isYou && <Badge tone="accent">you</Badge>}
                  {m.role === 'ADMIN' && <Badge>admin</Badge>}
                  {!m.user && <Badge>offline</Badge>}
                </span>
                {isAdmin && !m.isYou && (
                  <span className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await setRole({
                          variables: {
                            groupId: id,
                            membershipId: m.id,
                            role: m.role === 'ADMIN' ? 'MEMBER' : 'ADMIN',
                          },
                        });
                        await refetch();
                      }}
                      className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
                    >
                      {m.role === 'ADMIN' ? 'Make member' : 'Make admin'}
                    </button>
                    <button
                      onClick={async () => {
                        await remove({ variables: { groupId: id, membershipId: m.id } });
                        await refetch();
                      }}
                      className="rounded-md border border-line px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-4">
          <h2 className="font-serif text-2xl">Balances</h2>
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {group.balances.map((b) => {
              const settled = b.amount === 0;
              const owed = b.amount > 0;
              return (
                <li key={b.member.id} className="flex items-center justify-between py-2.5">
                  <span className="font-medium">{b.member.name}</span>
                  <span
                    className={`font-mono text-sm tabular-nums ${
                      settled ? 'text-muted' : owed ? 'text-accent' : 'text-red-500'
                    }`}
                  >
                    {settled
                      ? 'settled up'
                      : owed
                        ? `is owed ${formatMoney(b.amount, group.baseCurrency)}`
                        : `owes ${formatMoney(-b.amount, group.baseCurrency)}`}
                  </span>
                </li>
              );
            })}
          </ul>

          <h3 className="mt-6 font-mono text-xs uppercase tracking-wider text-accent">
            Suggested payments
          </h3>
          {group.suggestedTransfers.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Everyone is settled up. 🎉</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {group.suggestedTransfers.map((t, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line p-3"
                >
                  <span className="text-sm">
                    <span className="font-medium">{t.from.name}</span> pays{' '}
                    <span className="font-medium">{t.to.name}</span>{' '}
                    <span className="font-mono tabular-nums">{formatMoney(t.amount, group.baseCurrency)}</span>
                  </span>
                  <button
                    onClick={async () => {
                      await addSettlement({
                        variables: { groupId: id, fromId: t.from.id, toId: t.to.id, amount: t.amount },
                      });
                      await refetch();
                    }}
                    className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs text-accent hover:bg-accent/20"
                  >
                    Mark paid
                  </button>
                </li>
              ))}
            </ul>
          )}

          {group.settlements.length > 0 && (
            <>
              <h3 className="mt-6 font-mono text-xs uppercase tracking-wider text-muted">
                Settlement history
              </h3>
              <ul className="mt-3 flex flex-col gap-1">
                {group.settlements.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                    <span>
                      {s.from.name} → {s.to.name} &middot;{' '}
                      <span className="font-mono tabular-nums">{formatMoney(s.amount, s.currency)}</span>{' '}
                      <span className="text-muted">({new Date(s.date).toLocaleDateString()})</span>
                    </span>
                    <button
                      onClick={async () => {
                        await deleteSettlement({ variables: { settlementId: s.id } });
                        await refetch();
                      }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {isAdmin && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Card>
              <h3 className="font-serif text-xl">Add a member</h3>
              <p className="mt-1 text-sm text-muted">For someone without an account (tracked by name).</p>
              <form className="mt-4 flex flex-col gap-3" onSubmit={onAddMember}>
                <Field label="Name">
                  <TextInput required value={memberName} onChange={(e) => setMemberName(e.target.value)} />
                </Field>
                <FormError message={addError?.message} />
                <Button type="submit" disabled={adding}>
                  {adding ? 'Adding…' : 'Add member'}
                </Button>
              </form>
            </Card>

            <Card>
              <h3 className="font-serif text-xl">Invite by email</h3>
              <p className="mt-1 text-sm text-muted">They join with the token below.</p>
              <form className="mt-4 flex flex-col gap-3" onSubmit={onInvite}>
                <Field label="Email">
                  <TextInput type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                </Field>
                <FormError message={inviteError?.message} />
                <Button type="submit" disabled={inviting}>
                  {inviting ? 'Inviting…' : 'Send invite'}
                </Button>
              </form>
            </Card>
          </div>
        )}

        {isAdmin && group.invites.length > 0 && (
          <Card className="mt-4">
            <h3 className="font-serif text-xl">Pending invites</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {group.invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{inv.email}</p>
                    <code className="block truncate font-mono text-xs text-muted">token: {inv.token}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigator.clipboard?.writeText(inv.token)}
                      className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
                    >
                      Copy
                    </button>
                    <button
                      onClick={async () => {
                        await revoke({ variables: { groupId: id, inviteId: inv.id } });
                        await refetch();
                      }}
                      className="rounded-md border border-line px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
                    >
                      Revoke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-xl">Read-only share link</h3>
            {isAdmin && (
              <button
                onClick={async () => {
                  await createShareLink({ variables: { groupId: id } });
                  await refetch();
                }}
                className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs text-accent hover:bg-accent/20"
              >
                + New link
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">Anyone with the link can view balances — but not edit.</p>
          {group.shareLinks.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No active links.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {group.shareLinks.map((link) => {
                const url = `${window.location.origin}/shared/${link.token}`;
                return (
                  <li key={link.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
                    <code className="min-w-0 truncate font-mono text-xs text-muted">{url}</code>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigator.clipboard?.writeText(url)}
                        className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
                      >
                        Copy
                      </button>
                      {isAdmin && (
                        <button
                          onClick={async () => {
                            await revokeShareLink({ variables: { groupId: id, shareLinkId: link.id } });
                            await refetch();
                          }}
                          className="rounded-md border border-line px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="mt-4">
          <h3 className="font-serif text-xl">Export</h3>
          <p className="mt-1 text-sm text-muted">Download the ledger as a spreadsheet, or print it to PDF.</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onExportCsv}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition hover:text-ink"
            >
              Download CSV
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition hover:text-ink"
            >
              Print / PDF
            </button>
          </div>
        </Card>

        {group.changeLog.length > 0 && (
          <Card className="mt-4">
            <h3 className="font-serif text-xl">History</h3>
            <ul className="mt-3 flex flex-col gap-1.5">
              {group.changeLog.slice(0, 15).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {e.summary}
                    {e.actor && <span className="text-muted"> — {e.actor.name}</span>}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {new Date(e.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Screen>
  );
}
