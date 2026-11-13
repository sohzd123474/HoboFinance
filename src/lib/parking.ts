// Pure maths for the short-term parking calculator.

export type InterestMethod = 'simple' | 'monthly';

export const MIN_MONTHS = 1;
export const MAX_MONTHS = 24;

/** Whole months, held within 1 to 24. */
export function clampMonths(months: number): number {
  if (!Number.isFinite(months)) return MIN_MONTHS;
  return Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, Math.round(months)));
}

/** Interest that is not reinvested: amount × yearly rate × months ÷ 12. */
export function simpleInterest(amount: number, yearlyRatePct: number, months: number): number {
  return (amount * (yearlyRatePct / 100) * months) / 12;
}

/** Interest added to the balance every month: amount × ((1 + rate ÷ 12)^months − 1). */
export function monthlyCompoundInterest(amount: number, yearlyRatePct: number, months: number): number {
  return amount * (Math.pow(1 + yearlyRatePct / 100 / 12, months) - 1);
}

export interface ParkingResult {
  interest: number;
  ending: number;
}

export function parkingResult(amount: number, yearlyRatePct: number, months: number, method: InterestMethod): ParkingResult {
  const m = clampMonths(months);
  const a = Math.max(0, amount);
  const interest = method === 'simple' ? simpleInterest(a, yearlyRatePct, m) : monthlyCompoundInterest(a, yearlyRatePct, m);
  return { interest, ending: a + interest };
}
