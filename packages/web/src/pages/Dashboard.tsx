import { useState, type FormEvent } from 'react';
import { gql, useQuery, useMutation, useApolloClient } from '@apollo/client';
import { Link, useNavigate } from 'react-router-dom';
import { clearToken } from '../auth';
import { Screen, Card, Eyebrow, Field, TextInput, Button, Badge, FormError, ThemeToggle } from '../ui';

const DASHBOARD = gql`
  query Dashboard {
    me {
      id
      name
    }
    myGroups {
      id
      name
      baseCurrency
      memberCount
      myRole
    }
  }
`;

const CREATE_GROUP = gql`
  mutation CreateGroup($name: String!, $baseCurrency: String) {
    createGroup(name: $name, baseCurrency: $baseCurrency) {
      id
    }
  }
`;

const ACCEPT_INVITE = gql`
  mutation AcceptInvite($token: String!) {
    acceptInvite(token: $token) {
      id
    }
  }
`;

interface DashboardData {
  me: { id: string; name: string } | null;
  myGroups: {
    id: string;
    name: string;
    baseCurrency: string;
    memberCount: number;
    myRole: 'ADMIN' | 'MEMBER' | null;
  }[];
}

export function Dashboard() {
  const navigate = useNavigate();
  const client = useApolloClient();
  const { data, loading, refetch } = useQuery<DashboardData>(DASHBOARD);

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [inviteToken, setInviteToken] = useState('');

  const [createGroup, { loading: creating, error: createError }] = useMutation(CREATE_GROUP);
  const [acceptInvite, { loading: joining, error: joinError }] = useMutation(ACCEPT_INVITE);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const res = await createGroup({ variables: { name, baseCurrency: currency } });
    setName('');
    await refetch();
    navigate(`/groups/${res.data.createGroup.id}`);
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await acceptInvite({ variables: { token: inviteToken.trim() } });
      setInviteToken('');
      await refetch();
      navigate(`/groups/${res.data.acceptInvite.id}`);
    } catch {
      /* surfaced below */
    }
  }

  async function onLogout() {
    clearToken();
    await client.clearStore();
    navigate('/login');
  }

  return (
    <Screen>
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <Eyebrow>hesab &middot; dashboard</Eyebrow>
            <h1 className="mt-2 font-serif text-4xl">
              {loading ? '…' : `Hello, ${data?.me?.name ?? 'friend'}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={onLogout}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>

        <Card>
          <h2 className="font-serif text-2xl">Your groups</h2>
          {data?.myGroups.length === 0 && (
            <p className="mt-3 text-muted">No groups yet — create one below to get started.</p>
          )}
          <ul className="mt-4 flex flex-col gap-2">
            {data?.myGroups.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/groups/${g.id}`}
                  className="flex items-center justify-between rounded-xl border border-line p-4 transition hover:border-accent"
                >
                  <span className="flex items-center gap-3">
                    <span className="font-medium">{g.name}</span>
                    {g.myRole === 'ADMIN' && <Badge tone="accent">admin</Badge>}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'} &middot; {g.baseCurrency}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card>
            <h3 className="font-serif text-xl">New group</h3>
            <form className="mt-4 flex flex-col gap-3" onSubmit={onCreate}>
              <Field label="Name">
                <TextInput
                  required
                  value={name}
                  placeholder="Ski trip"
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Base currency">
                <TextInput
                  value={currency}
                  maxLength={3}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
              </Field>
              <FormError message={createError?.message} />
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create group'}
              </Button>
            </form>
          </Card>

          <Card>
            <h3 className="font-serif text-xl">Join a group</h3>
            <p className="mt-1 text-sm text-muted">Paste an invite token you were given.</p>
            <form className="mt-4 flex flex-col gap-3" onSubmit={onJoin}>
              <Field label="Invite token">
                <TextInput
                  required
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                />
              </Field>
              <FormError message={joinError?.message} />
              <Button type="submit" disabled={joining}>
                {joining ? 'Joining…' : 'Join group'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </Screen>
  );
}
