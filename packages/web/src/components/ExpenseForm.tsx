import { useMemo, useState, type FormEvent } from 'react';
import { gql, useMutation } from '@apollo/client';
import { Field, TextInput, Button, FormError } from '../ui';
import { toMinor } from '../money';

const ADD_EXPENSE = gql`
  mutation AddExpense(
    $groupId: ID!
    $description: String!
    $amount: Int!
    $paidById: ID!
    $splitMode: SplitMode!
    $splits: [SplitInput!]
    $items: [ItemInput!]
    $currency: String
    $exchangeRate: Float
    $notes: String
  ) {
    addExpense(
      groupId: $groupId
      description: $description
      amount: $amount
      paidById: $paidById
      splitMode: $splitMode
      splits: $splits
      items: $items
      currency: $currency
      exchangeRate: $exchangeRate
      notes: $notes
    ) {
      id
    }
  }
`;

type Mode = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES' | 'ADJUSTMENT' | 'ITEMIZED';
interface Member {
  id: string;
  name: string;
}
interface Item {
  description: string;
  amount: string;
  members: Set<string>;
}

const MODES: { value: Mode; label: string }[] = [
  { value: 'EQUAL', label: 'Equally' },
  { value: 'EXACT', label: 'Exact amounts' },
  { value: 'PERCENTAGE', label: 'Percentages' },
  { value: 'SHARES', label: 'Shares' },
  { value: 'ADJUSTMENT', label: 'Adjustments' },
  { value: 'ITEMIZED', label: 'By item' },
];

export function ExpenseForm({
  groupId,
  members,
  baseCurrency,
  onAdded,
}: {
  groupId: string;
  members: Member[];
  baseCurrency: string;
  onAdded: () => void | Promise<unknown>;
}) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [rate, setRate] = useState('');
  const [paidById, setPaidById] = useState(members[0]?.id ?? '');
  const [mode, setMode] = useState<Mode>('EQUAL');

  const [included, setIncluded] = useState<Set<string>>(new Set(members.map((m) => m.id)));
  const [fields, setFields] = useState<Record<string, string>>({}); // per-member value (exact/pct/shares/adjustment)
  const [items, setItems] = useState<Item[]>([{ description: '', amount: '', members: new Set(members.map((m) => m.id)) }]);
  const [localError, setLocalError] = useState<string>();

  const [addExpense, { loading }] = useMutation(ADD_EXPENSE);

  const isForeign = currency.trim().toUpperCase() !== baseCurrency.toUpperCase();
  const itemsTotalMinor = useMemo(
    () => items.reduce((a, it) => a + (toMinor(it.amount) || 0), 0),
    [items],
  );

  function toggleIncluded(id: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function setField(id: string, v: string) {
    setFields((prev) => ({ ...prev, [id]: v }));
  }
  function toggleItemMember(idx: number, id: string) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = new Set(it.members);
        next.has(id) ? next.delete(id) : next.add(id);
        return { ...it, members: next };
      }),
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(undefined);

    let amountMinor: number;
    let splits: { membershipId: string; amount?: number; value?: number }[] | undefined;
    let itemsPayload: { description: string; amount: number; membershipIds: string[] }[] | undefined;

    if (mode === 'ITEMIZED') {
      amountMinor = itemsTotalMinor;
      itemsPayload = items.map((it) => ({
        description: it.description || 'Item',
        amount: toMinor(it.amount) || 0,
        membershipIds: [...it.members],
      }));
      if (itemsPayload.some((it) => it.amount <= 0 || it.membershipIds.length === 0)) {
        setLocalError('Each item needs an amount and at least one person.');
        return;
      }
    } else {
      amountMinor = toMinor(amount);
      if (Number.isNaN(amountMinor) || amountMinor <= 0) {
        setLocalError('Enter a valid amount.');
        return;
      }
      if (mode === 'EQUAL') {
        const ids = [...included];
        if (ids.length === 0) return setLocalError('Select at least one person.');
        splits = ids.map((membershipId) => ({ membershipId }));
      } else if (mode === 'EXACT') {
        splits = members
          .map((m) => ({ membershipId: m.id, amount: toMinor(fields[m.id] ?? '') }))
          .filter((s) => !Number.isNaN(s.amount) && s.amount > 0);
      } else if (mode === 'PERCENTAGE') {
        splits = members
          .map((m) => ({ membershipId: m.id, value: Math.round((Number.parseFloat(fields[m.id] ?? '') || 0) * 100) }))
          .filter((s) => s.value > 0);
      } else if (mode === 'SHARES') {
        splits = members
          .map((m) => ({ membershipId: m.id, value: Math.round(Number.parseFloat(fields[m.id] ?? '') || 0) }))
          .filter((s) => s.value > 0);
      } else if (mode === 'ADJUSTMENT') {
        splits = [...included].map((membershipId) => ({
          membershipId,
          value: toMinor(fields[membershipId] ?? '0') || 0,
        }));
      }
    }

    if (isForeign && !(Number.parseFloat(rate) > 0)) {
      setLocalError(`Enter an exchange rate (${baseCurrency} per 1 ${currency.toUpperCase()}).`);
      return;
    }

    try {
      await addExpense({
        variables: {
          groupId,
          description,
          amount: amountMinor,
          paidById,
          splitMode: mode,
          splits,
          items: itemsPayload,
          currency: currency.trim().toUpperCase(),
          exchangeRate: isForeign ? Number.parseFloat(rate) : null,
          notes: notes || null,
        },
      });
      setDescription('');
      setAmount('');
      setNotes('');
      setFields({});
      setItems([{ description: '', amount: '', members: new Set(members.map((m) => m.id)) }]);
      await onAdded();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not add the expense.');
    }
  }

  const perMemberLabel: Record<Mode, string> = {
    EQUAL: '',
    EXACT: 'amount',
    PERCENTAGE: '%',
    SHARES: 'shares',
    ADJUSTMENT: '+/-',
    ITEMIZED: '',
  };

  return (
    <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
      <Field label="Description">
        <TextInput required value={description} placeholder="Dinner" onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        {mode !== 'ITEMIZED' && (
          <Field label="Amount">
            <TextInput inputMode="decimal" value={amount} placeholder="30.00" onChange={(e) => setAmount(e.target.value)} />
          </Field>
        )}
        <Field label="Currency">
          <TextInput value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </Field>
        <Field label="Paid by">
          <select
            value={paidById}
            onChange={(e) => setPaidById(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>
      </div>

      {isForeign && (
        <Field label={`Exchange rate — ${baseCurrency} per 1 ${currency.toUpperCase()}`}>
          <TextInput inputMode="decimal" value={rate} placeholder="1.08" onChange={(e) => setRate(e.target.value)} />
        </Field>
      )}

      <Field label="Split">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </Field>

      <div className="rounded-lg border border-line p-3">
        {mode === 'EQUAL' && (
          <ul className="flex flex-col gap-1">
            {members.map((m) => (
              <li key={m.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={included.has(m.id)} onChange={() => toggleIncluded(m.id)} />
                  {m.name}
                </label>
              </li>
            ))}
          </ul>
        )}

        {(mode === 'EXACT' || mode === 'PERCENTAGE' || mode === 'SHARES') && (
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="text-sm">{m.name}</span>
                <span className="flex items-center gap-1">
                  <input
                    inputMode="decimal"
                    value={fields[m.id] ?? ''}
                    onChange={(e) => setField(m.id, e.target.value)}
                    className="w-24 rounded-md border border-line bg-paper px-2 py-1 text-right text-sm outline-none focus:border-accent"
                  />
                  <span className="w-10 font-mono text-xs text-muted">{perMemberLabel[mode]}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {mode === 'ADJUSTMENT' && (
          <ul className="flex flex-col gap-2">
            <li className="text-xs text-muted">Everyone splits equally; these amounts are added/subtracted first.</li>
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={included.has(m.id)} onChange={() => toggleIncluded(m.id)} />
                  {m.name}
                </label>
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={fields[m.id] ?? ''}
                  onChange={(e) => setField(m.id, e.target.value)}
                  className="w-24 rounded-md border border-line bg-paper px-2 py-1 text-right text-sm outline-none focus:border-accent"
                />
              </li>
            ))}
          </ul>
        )}

        {mode === 'ITEMIZED' && (
          <div className="flex flex-col gap-3">
            {items.map((it, idx) => (
              <div key={idx} className="rounded-md border border-line p-2">
                <div className="flex gap-2">
                  <input
                    placeholder="Item"
                    value={it.description}
                    onChange={(e) =>
                      setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))
                    }
                    className="flex-1 rounded-md border border-line bg-paper px-2 py-1 text-sm outline-none focus:border-accent"
                  />
                  <input
                    inputMode="decimal"
                    placeholder="0.00"
                    value={it.amount}
                    onChange={(e) =>
                      setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))
                    }
                    className="w-24 rounded-md border border-line bg-paper px-2 py-1 text-right text-sm outline-none focus:border-accent"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {members.map((m) => (
                    <label key={m.id} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={it.members.has(m.id)} onChange={() => toggleItemMember(idx, m.id)} />
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { description: '', amount: '', members: new Set(members.map((m) => m.id)) }])}
                className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
              >
                + Add item
              </button>
              <span className="font-mono text-xs text-muted">total {(itemsTotalMinor / 100).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <Field label="Notes (optional)">
        <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <FormError message={localError} />
      <Button type="submit" disabled={loading}>
        {loading ? 'Adding…' : 'Add expense'}
      </Button>
    </form>
  );
}
