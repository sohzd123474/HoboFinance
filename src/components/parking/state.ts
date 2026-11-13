// Saved inputs for the short-term parking calculator and the one path that
// turns them into results. Shared by the page and the report summary.
import { clampMonths, parkingResult, type InterestMethod, type ParkingResult } from '../../lib/parking';

export const storageKey = 'parking';

// A neutral starting rate, not a quote. The page tells the reader to replace it.
export const PLACEHOLDER_RATE = 3.0;

export interface Option {
  label: string;
  rate: number;
  method: InterestMethod;
}

export interface State {
  amount: number;
  months: number;
  options: Option[];
}

export const DEFAULTS: State = {
  amount: 10000,
  months: 12,
  options: [
    { label: 'Savings Bonds', rate: PLACEHOLDER_RATE, method: 'monthly' },
    { label: '6-month T-bill', rate: PLACEHOLDER_RATE, method: 'simple' },
    { label: 'Money market fund', rate: PLACEHOLDER_RATE, method: 'monthly' },
  ],
};

export const METHOD_NAME: Record<InterestMethod, string> = {
  simple: 'Simple (not compounded)',
  monthly: 'Compounded monthly',
};

export function compute(o: State): { options: Option[]; months: number; results: (Option & ParkingResult)[] } {
  // Guard against saved data in an older shape.
  const options: Option[] = DEFAULTS.options.map((d, i) => ({ ...d, ...(Array.isArray(o.options) ? o.options[i] : undefined) }));
  const months = clampMonths(o.months);
  const results = options.map((x) => ({ ...x, ...parkingResult(o.amount, x.rate, months, x.method) }));
  return { options, months, results };
}
