// Unit test for the pure notification builders (no DB / SMTP needed).
import {
  buildExpenseNotifications,
  buildSettlementNotifications,
} from '../packages/api/dist/modules/notifications/notifications.js';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}`); }
}

console.log('Phase 7 — notification builder unit test');

const members = [
  { name: 'Alice', email: 'alice@x.com', userId: 'A' }, // the actor
  { name: 'Bob', email: 'bob@x.com', userId: 'B' },
  { name: 'Cy', email: null, userId: null }, // placeholder, no account
  { name: 'Dana', email: 'dana@x.com', userId: 'D' },
];

const msgs = buildExpenseNotifications({
  groupName: 'Trip',
  description: 'Dinner',
  payerName: 'Alice',
  actorUserId: 'A',
  amountMinor: 3000,
  currency: 'EUR',
  members,
});
check('actor is not notified', !msgs.some((m) => m.to === 'alice@x.com'));
check('placeholder member (no email) is not notified', !msgs.some((m) => m.to === null || m.to === undefined));
check('accounted non-actor members are notified (Bob, Dana)', msgs.length === 2 && msgs.every((m) => ['bob@x.com', 'dana@x.com'].includes(m.to)));
check('subject mentions the group and description', msgs[0].subject.includes('Trip') && msgs[0].subject.includes('Dinner'));
check('body shows formatted amount', msgs[0].body.includes('30.00 EUR'));

// settlement: pay Bob; actor is Alice
const s1 = buildSettlementNotifications({
  groupName: 'Trip', fromName: 'Alice', actorUserId: 'A',
  toMember: { name: 'Bob', email: 'bob@x.com', userId: 'B' }, amountMinor: 1000, currency: 'EUR',
});
check('payee with account is notified', s1.length === 1 && s1[0].to === 'bob@x.com');

// settlement where the payee is the actor -> no email
const s2 = buildSettlementNotifications({
  groupName: 'Trip', fromName: 'Bob', actorUserId: 'B',
  toMember: { name: 'Bob', email: 'bob@x.com', userId: 'B' }, amountMinor: 1000, currency: 'EUR',
});
check('actor-as-payee is not notified', s2.length === 0);

// settlement to a placeholder member -> no email
const s3 = buildSettlementNotifications({
  groupName: 'Trip', fromName: 'Alice', actorUserId: 'A',
  toMember: { name: 'Cy', email: null, userId: null }, amountMinor: 1000, currency: 'EUR',
});
check('placeholder payee is not notified', s3.length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
