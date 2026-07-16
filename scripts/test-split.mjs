// Unit test for the pure split math (no DB needed).
import {
  allocateByWeights,
  computeEqualSplits,
  validateExactSplits,
  computePercentageSplits,
  computeSharesSplits,
  computeAdjustmentSplits,
  computeItemizedSplits,
  convertSplitsToBase,
  buildSplits,
} from '../packages/api/dist/modules/expenses/split.js';

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}`); }
}
function throws(fn) { try { fn(); return false; } catch { return true; } }
const sum = (arr) => arr.reduce((a, s) => a + s.amount, 0);
const amounts = (arr) => arr.map((s) => s.amount);

console.log('Phase 3+5 — split math unit test');

// allocateByWeights
check('allocate 1000 by [1,1,1] = [334,333,333]', JSON.stringify(allocateByWeights(1000, [1, 1, 1])) === '[334,333,333]');
check('allocate 1000 by [1,1,1] sums to 1000', allocateByWeights(1000, [1, 1, 1]).reduce((a, b) => a + b, 0) === 1000);
check('allocate 1000 by [3,1] = [750,250]', JSON.stringify(allocateByWeights(1000, [3, 1])) === '[750,250]');
check('allocate rejects all-zero weights', throws(() => allocateByWeights(100, [0, 0])));

// EQUAL / EXACT
check('equal 1000/3 sums to 1000', sum(computeEqualSplits(1000, ['a', 'b', 'c'])) === 1000);
check('equal duplicate members throws', throws(() => computeEqualSplits(100, ['a', 'a'])));
check('exact valid', sum(validateExactSplits(1000, [{ membershipId: 'a', amount: 600 }, { membershipId: 'b', amount: 400 }])) === 1000);
check('exact wrong sum throws', throws(() => validateExactSplits(1000, [{ membershipId: 'a', amount: 600 }, { membershipId: 'b', amount: 300 }])));

// PERCENTAGE (basis points)
const pct = computePercentageSplits(1000, [{ membershipId: 'a', value: 5000 }, { membershipId: 'b', value: 5000 }]);
check('percentage 50/50 of 1000 = [500,500]', JSON.stringify(amounts(pct)) === '[500,500]');
check('percentage must sum to 100%', throws(() => computePercentageSplits(1000, [{ membershipId: 'a', value: 5000 }, { membershipId: 'b', value: 4000 }])));
const pct3 = computePercentageSplits(1000, [{ membershipId: 'a', value: 3333 }, { membershipId: 'b', value: 3333 }, { membershipId: 'c', value: 3334 }]);
check('percentage odd split sums to total', sum(pct3) === 1000);

// SHARES
const sh = computeSharesSplits(900, [{ membershipId: 'a', value: 2 }, { membershipId: 'b', value: 1 }]);
check('shares 2:1 of 900 = [600,300]', JSON.stringify(amounts(sh)) === '[600,300]');
check('shares sum to total', sum(sh) === 900);

// ADJUSTMENT: a pays 200 extra, remainder equal
const adj = computeAdjustmentSplits(1000, [{ membershipId: 'a', value: 200 }, { membershipId: 'b', value: 0 }, { membershipId: 'c', value: 0 }]);
check('adjustment sums to total', sum(adj) === 1000);
check('adjustment: a owes 200 more than equal base', adj.find((s) => s.membershipId === 'a').amount === 200 + Math.floor(800 / 3) + (800 % 3 > 0 ? 1 : 0));
check('adjustment negative-share throws', throws(() => computeAdjustmentSplits(100, [{ membershipId: 'a', value: -500 }, { membershipId: 'b', value: 0 }])));

// ITEMIZED
const items = [
  { description: 'Pizza', amount: 900, membershipIds: ['a', 'b', 'c'] },
  { description: 'Beer', amount: 600, membershipIds: ['a', 'b'] },
];
const it = computeItemizedSplits(1500, items);
check('itemized sums to total', sum(it) === 1500);
check('itemized: a = 300+300 = 600', it.find((s) => s.membershipId === 'a').amount === 600);
check('itemized: c = 300 only', it.find((s) => s.membershipId === 'c').amount === 300);
check('itemized wrong total throws', throws(() => computeItemizedSplits(9999, items)));

// convertSplitsToBase
const base = convertSplitsToBase([{ membershipId: 'a', amount: 600 }, { membershipId: 'b', amount: 400 }], 1080);
check('convert to base sums exactly to baseTotal', sum(base) === 1080);
check('convert to base preserves proportion (a:648, b:432)', JSON.stringify(amounts(base)) === '[648,432]');
check('convert identity when total unchanged', JSON.stringify(amounts(convertSplitsToBase([{ membershipId: 'a', amount: 600 }, { membershipId: 'b', amount: 400 }], 1000))) === '[600,400]');

// buildSplits dispatch
check('buildSplits ITEMIZED dispatches', sum(buildSplits('ITEMIZED', 1500, [], items)) === 1500);
check('buildSplits unknown mode throws', throws(() => buildSplits('BOGUS', 900, [{ membershipId: 'a' }])));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
