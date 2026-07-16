import { gql, useQuery } from '@apollo/client';
import { useParams } from 'react-router-dom';
import { Screen, Card, Eyebrow, Badge } from '../ui';
import { formatMoney } from '../money';

const SHARED = gql`
  query SharedGroup($token: String!) {
    sharedGroup(token: $token) {
      name
      baseCurrency
      members {
        id
        name
      }
      expenses {
        id
        description
        amount
        currency
        baseAmount
        date
        paidByName
      }
      balances {
        name
        amount
      }
      suggestedTransfers {
        fromName
        toName
        amount
      }
    }
  }
`;

interface SharedData {
  sharedGroup: {
    name: string;
    baseCurrency: string;
    members: { id: string; name: string }[];
    expenses: {
      id: string;
      description: string;
      amount: number;
      currency: string;
      baseAmount: number;
      date: string;
      paidByName: string;
    }[];
    balances: { name: string; amount: number }[];
    suggestedTransfers: { fromName: string; toName: string; amount: number }[];
  } | null;
}

export function SharedGroup() {
  const { token = '' } = useParams();
  const { data, loading } = useQuery<SharedData>(SHARED, { variables: { token } });

  if (loading) return <Screen><p className="text-muted">Loading…</p></Screen>;
  const g = data?.sharedGroup;
  if (!g)
    return (
      <Screen>
        <Card className="max-w-md text-center">
          <h1 className="font-serif text-2xl">Link unavailable</h1>
          <p className="mt-2 text-muted">This share link is invalid or has been revoked.</p>
        </Card>
      </Screen>
    );

  return (
    <Screen>
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <Eyebrow>hesab &middot; shared view</Eyebrow>
          <h1 className="mt-2 font-serif text-4xl">{g.name}</h1>
          <p className="mt-1 text-sm text-muted">Read-only · {g.baseCurrency}</p>
        </div>

        <Card>
          <h2 className="font-serif text-2xl">Balances</h2>
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {g.balances.map((b, i) => {
              const settled = b.amount === 0;
              const owed = b.amount > 0;
              return (
                <li key={i} className="flex items-center justify-between py-2.5">
                  <span className="font-medium">{b.name}</span>
                  <span className={`font-mono text-sm tabular-nums ${settled ? 'text-muted' : owed ? 'text-accent' : 'text-red-500'}`}>
                    {settled ? 'settled up' : owed ? `is owed ${formatMoney(b.amount, g.baseCurrency)}` : `owes ${formatMoney(-b.amount, g.baseCurrency)}`}
                  </span>
                </li>
              );
            })}
          </ul>
          {g.suggestedTransfers.length > 0 && (
            <>
              <h3 className="mt-6 font-mono text-xs uppercase tracking-wider text-accent">Suggested payments</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {g.suggestedTransfers.map((t, i) => (
                  <li key={i} className="rounded-lg border border-line p-3 text-sm">
                    <span className="font-medium">{t.fromName}</span> pays{' '}
                    <span className="font-medium">{t.toName}</span>{' '}
                    <span className="font-mono tabular-nums">{formatMoney(t.amount, g.baseCurrency)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card className="mt-4">
          <h2 className="font-serif text-2xl">Expenses</h2>
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {g.expenses.map((ex) => (
              <li key={ex.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{ex.description}</p>
                  <p className="text-sm text-muted">
                    {ex.paidByName} paid &middot; {new Date(ex.date).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-right">
                  <span className="block font-mono tabular-nums">{formatMoney(ex.amount, ex.currency)}</span>
                  {ex.currency !== g.baseCurrency && (
                    <Badge>{formatMoney(ex.baseAmount, g.baseCurrency)}</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Screen>
  );
}
