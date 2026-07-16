// Unit test for the pure debt-simplification (no DB needed).
import { simplifyDebts } from '../packages/api/dist/modules/balances/simplify.js';

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}`); }
}

// Apply transfers back onto the balances; everything must end at zero.
function settlesToZero(balances, transfers) {
  const net = new Map(balances.map((b) => [b.membershipId, b.amount]));
  for (const t of transfers) {
    net.set(t.fromId, net.get(t.fromId) + t.amount);
    net.set(t.toId, net.get(t.toId) - t.amount);
  }
  return [...net.values()].every((v) => v === 0);
}
const allPositive = (ts) => ts.every((t) => t.amount > 0);

console.log('Phase 4 — debt simplification unit test');

// one creditor, two debtors
const a = [
  { membershipId: 'alice', amount: 2000 },
  { membershipId: 'bob', amount: -1000 },
  { membershipId: 'charlie', amount: -1000 },
];
const ta = simplifyDebts(a);
check('scenario A settles to zero', settlesToZero(a, ta));
check('scenario A uses <= n-1 transfers', ta.length <= 2);
check('scenario A amounts all positive', allPositive(ta));

// already settled
const b = [{ membershipId: 'x', amount: 0 }, { membershipId: 'y', amount: 0 }];
check('already-settled yields no transfers', simplifyDebts(b).length === 0);

// chain: a owes b owes c pattern via nets
const c = [
  { membershipId: 'a', amount: -700 },
  { membershipId: 'b', amount: 200 },
  { membershipId: 'c', amount: 500 },
];
const tc = simplifyDebts(c);
check('scenario C settles to zero', settlesToZero(c, tc));
check('scenario C uses <= n-1 transfers', tc.length <= 2);

// larger random-ish set that sums to zero
const d = [
  { membershipId: 'p', amount: 1500 },
  { membershipId: 'q', amount: -400 },
  { membershipId: 'r', amount: -1100 },
  { membershipId: 's', amount: 300 },
  { membershipId: 't', amount: -300 },
];
const td = simplifyDebts(d);
check('scenario D settles to zero', settlesToZero(d, td));
check('scenario D uses <= n-1 transfers', td.length <= 4);
check('scenario D amounts all positive', allPositive(td));

// uneven remainder cents
const e = [
  { membershipId: 'a', amount: 67 },
  { membershipId: 'b', amount: -34 },
  { membershipId: 'c', amount: -33 },
];
check('scenario E (odd cents) settles to zero', settlesToZero(e, simplifyDebts(e)));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
