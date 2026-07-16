import { GraphQLError } from 'graphql';

// All monetary amounts are integer minor units (e.g. cents).

export interface SplitInput {
  membershipId: string;
  amount?: number | null; // EXACT: minor units
  value?: number | null; // PERCENTAGE: basis points; SHARES: weight; ADJUSTMENT: minor units +/-
}

export interface ItemInput {
  description: string;
  amount: number; // minor units
  membershipIds: string[]; // who shares this item (split equally)
}

export interface ComputedSplit {
  membershipId: string;
  amount: number;
}

export type SplitModeValue = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES' | 'ADJUSTMENT' | 'ITEMIZED';

function assertNoDuplicates(ids: string[]): void {
  if (new Set(ids).size !== ids.length) {
    throw new GraphQLError('A member can only appear once in a split.');
  }
}

// Distribute `total` across positions in proportion to `weights`, using the
// largest-remainder method so the parts always sum to exactly `total`.
// Deterministic: ties in remainder go to earlier indices.
export function allocateByWeights(total: number, weights: number[]): number[] {
  if (weights.length === 0) throw new GraphQLError('Nothing to split between.');
  if (weights.some((w) => w < 0)) throw new GraphQLError('Weights cannot be negative.');
  const sum = weights.reduce((a, w) => a + w, 0);
  if (sum <= 0) throw new GraphQLError('The weights must add up to more than zero.');

  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map((x) => Math.floor(x));
  let remainder = total - floors.reduce((a, x) => a + x, 0);

  // Hand out the leftover units to the largest fractional remainders first.
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const result = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k++) {
    result[order[k].i] += 1;
    remainder -= 1;
  }
  return result;
}

export function computeEqualSplits(totalMinor: number, membershipIds: string[]): ComputedSplit[] {
  if (membershipIds.length === 0) {
    throw new GraphQLError('Select at least one member to split between.');
  }
  assertNoDuplicates(membershipIds);
  const parts = allocateByWeights(totalMinor, membershipIds.map(() => 1));
  return membershipIds.map((membershipId, i) => ({ membershipId, amount: parts[i] }));
}

export function validateExactSplits(totalMinor: number, splits: SplitInput[]): ComputedSplit[] {
  if (splits.length === 0) throw new GraphQLError('Provide at least one split.');
  assertNoDuplicates(splits.map((s) => s.membershipId));
  const computed = splits.map((s) => {
    if (s.amount == null || !Number.isInteger(s.amount) || s.amount < 0) {
      throw new GraphQLError('Each exact split needs a whole, non-negative amount.');
    }
    return { membershipId: s.membershipId, amount: s.amount };
  });
  const sum = computed.reduce((acc, s) => acc + s.amount, 0);
  if (sum !== totalMinor) {
    throw new GraphQLError(
      `Split amounts must add up to the total (${totalMinor}); they add up to ${sum}.`,
    );
  }
  return computed;
}

// PERCENTAGE: value is basis points (10000 = 100%); must sum to 10000.
export function computePercentageSplits(totalMinor: number, splits: SplitInput[]): ComputedSplit[] {
  if (splits.length === 0) throw new GraphQLError('Provide at least one split.');
  assertNoDuplicates(splits.map((s) => s.membershipId));
  const bps = splits.map((s) => {
    if (s.value == null || !Number.isInteger(s.value) || s.value < 0) {
      throw new GraphQLError('Each percentage needs a whole, non-negative basis-point value.');
    }
    return s.value;
  });
  const sum = bps.reduce((a, b) => a + b, 0);
  if (sum !== 10000) {
    throw new GraphQLError(`Percentages must add up to 100% (got ${(sum / 100).toFixed(2)}%).`);
  }
  const parts = allocateByWeights(totalMinor, bps);
  return splits.map((s, i) => ({ membershipId: s.membershipId, amount: parts[i] }));
}

// SHARES: value is an integer weight (e.g. 2 shares vs 1).
export function computeSharesSplits(totalMinor: number, splits: SplitInput[]): ComputedSplit[] {
  if (splits.length === 0) throw new GraphQLError('Provide at least one split.');
  assertNoDuplicates(splits.map((s) => s.membershipId));
  const shares = splits.map((s) => {
    if (s.value == null || !Number.isInteger(s.value) || s.value < 0) {
      throw new GraphQLError('Each share must be a whole, non-negative number.');
    }
    return s.value;
  });
  const parts = allocateByWeights(totalMinor, shares);
  return splits.map((s, i) => ({ membershipId: s.membershipId, amount: parts[i] }));
}

// ADJUSTMENT: value is a +/- amount per member; the remainder splits equally.
export function computeAdjustmentSplits(totalMinor: number, splits: SplitInput[]): ComputedSplit[] {
  if (splits.length === 0) throw new GraphQLError('Provide at least one split.');
  assertNoDuplicates(splits.map((s) => s.membershipId));
  const adjustments = splits.map((s) => {
    if (s.value == null || !Number.isInteger(s.value)) {
      throw new GraphQLError('Each adjustment must be a whole number of minor units.');
    }
    return s.value;
  });
  const adjTotal = adjustments.reduce((a, v) => a + v, 0);
  const base = totalMinor - adjTotal;
  if (base < 0) {
    throw new GraphQLError('Adjustments exceed the total amount.');
  }
  const equalParts = allocateByWeights(base, splits.map(() => 1));
  const computed = splits.map((s, i) => ({
    membershipId: s.membershipId,
    amount: equalParts[i] + adjustments[i],
  }));
  if (computed.some((c) => c.amount < 0)) {
    throw new GraphQLError('An adjustment makes one share negative.');
  }
  return computed;
}

// ITEMIZED: each item is split equally among its members; shares are summed.
export function computeItemizedSplits(
  totalMinor: number,
  items: ItemInput[],
): ComputedSplit[] {
  if (items.length === 0) throw new GraphQLError('Add at least one item.');
  const tally = new Map<string, number>();
  let itemSum = 0;
  for (const item of items) {
    if (!Number.isInteger(item.amount) || item.amount < 0) {
      throw new GraphQLError('Each item needs a whole, non-negative amount.');
    }
    if (item.membershipIds.length === 0) {
      throw new GraphQLError(`Assign "${item.description}" to at least one member.`);
    }
    assertNoDuplicates(item.membershipIds);
    itemSum += item.amount;
    const parts = allocateByWeights(item.amount, item.membershipIds.map(() => 1));
    item.membershipIds.forEach((id, i) => tally.set(id, (tally.get(id) ?? 0) + parts[i]));
  }
  if (itemSum !== totalMinor) {
    throw new GraphQLError(`Items must add up to the total (${totalMinor}); they add up to ${itemSum}.`);
  }
  return [...tally.entries()].map(([membershipId, amount]) => ({ membershipId, amount }));
}

// Re-express a set of splits in another currency total, preserving proportions
// and summing exactly to `baseTotal`.
export function convertSplitsToBase(splits: ComputedSplit[], baseTotal: number): ComputedSplit[] {
  const parts = allocateByWeights(baseTotal, splits.map((s) => s.amount));
  return splits.map((s, i) => ({ membershipId: s.membershipId, amount: parts[i] }));
}

export function buildSplits(
  mode: SplitModeValue,
  totalMinor: number,
  splits: SplitInput[],
  items: ItemInput[] = [],
): ComputedSplit[] {
  switch (mode) {
    case 'EQUAL':
      return computeEqualSplits(totalMinor, splits.map((s) => s.membershipId));
    case 'EXACT':
      return validateExactSplits(totalMinor, splits);
    case 'PERCENTAGE':
      return computePercentageSplits(totalMinor, splits);
    case 'SHARES':
      return computeSharesSplits(totalMinor, splits);
    case 'ADJUSTMENT':
      return computeAdjustmentSplits(totalMinor, splits);
    case 'ITEMIZED':
      return computeItemizedSplits(totalMinor, items);
    default:
      throw new GraphQLError('Unsupported split mode.');
  }
}
