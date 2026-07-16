// Money is handled in integer minor units everywhere except display and input.

export function toMinor(input: string): number {
  const value = Number.parseFloat(input);
  if (Number.isNaN(value)) return NaN;
  return Math.round(value * 100);
}

export function toMajor(minor: number): string {
  return (minor / 100).toFixed(2);
}

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
  } catch {
    // Unknown currency code — fall back to a plain number with the code appended.
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}
