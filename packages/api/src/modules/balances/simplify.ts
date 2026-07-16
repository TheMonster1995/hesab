// Pure debt-simplification. All amounts are integer minor units.

export interface Balance {
  membershipId: string;
  // Net position: positive = the group owes them (creditor); negative = they owe (debtor).
  amount: number;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amount: number;
}

// Greedy settlement: repeatedly send from the largest debtor to the largest
// creditor. Produces at most (n-1) transfers and always clears every balance,
// provided the balances sum to zero (which they do by construction).
export function simplifyDebts(balances: Balance[]): Transfer[] {
  const creditors = balances
    .filter((b) => b.amount > 0)
    .map((b) => ({ membershipId: b.membershipId, amount: b.amount }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter((b) => b.amount < 0)
    .map((b) => ({ membershipId: b.membershipId, amount: -b.amount }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) {
      transfers.push({
        fromId: debtors[i].membershipId,
        toId: creditors[j].membershipId,
        amount: pay,
      });
    }
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  return transfers;
}
