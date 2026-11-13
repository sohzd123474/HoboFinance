// Saved inputs and small formatters shared by the Savings Bonds page (Ssb.tsx)
// and its printable summary (Summary.tsx), so both show the same figures.

import { clampYears } from '../../lib/ssb';

/** The key passed to useStored / readStored. */
export const STORAGE_KEY = 'ssb';

export const DEFAULTS = {
  amount: 10000,
  years: 10,
  oaRate: 2.5,
  /** null means "same as the OA rate" until the reader sets one. */
  reinvestRate: null as number | null,
  /** Issue code; empty means the latest issue. */
  issue: '',
};

export type SsbInputs = typeof DEFAULTS;

/** Turn whatever was saved into the numbers the calculation uses. */
export function resolveInputs(o: SsbInputs) {
  const oaRate = Number.isFinite(o.oaRate) ? o.oaRate : DEFAULTS.oaRate;
  const reinvestRate = o.reinvestRate ?? oaRate;
  const holdYears = clampYears(o.years);
  const amount = Number.isFinite(o.amount) && o.amount > 0 ? o.amount : 0;
  return { oaRate, reinvestRate, holdYears, amount };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const dayName = (iso: string) => `${Number(iso.slice(8, 10))} ${monthName(iso.slice(0, 7))}`;
export const rate = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? 'n/a' : `${n.toFixed(2)}%`);
/** A change in percentage points, with its sign. */
export const points = (n: number | null) => {
  if (n === null) return 'n/a';
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 'No change' : `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(2)} pts`;
};
/** Trim a rate for use in a sentence: 2.5, not 2.50. */
export const plain = (n: number) => `${Number(n.toFixed(2))}%`;
export const years = (n: number) => `${n} ${n === 1 ? 'year' : 'years'}`;
