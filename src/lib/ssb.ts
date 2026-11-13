// Pure Savings Bond maths. No DOM, no formatting — everything here is unit tested.
// Rates are in percent (2.5 means 2.5% a year); money is in dollars.

export interface SsbIssue {
  code: string;
  /** ISO date, e.g. "2026-11-02". */
  issueDate: string;
  /** "YYYY-MM" */
  month: string;
  /** Interest paid in each of years 1 to 10, % of the amount held. */
  coupons: number[];
  /** MAS's published average return per year for holding 1 to 10 years, %. */
  avgReturn: number[] | null;
}

export interface SsbData {
  builtAt: string;
  source: string;
  issues: SsbIssue[];
  missing: { month: string; reason: string }[];
}

export const MAX_YEARS = 10;

/** Whole years between 1 and the life of the bond. */
export function clampYears(years: number, max = MAX_YEARS): number {
  if (!Number.isFinite(years)) return 1;
  return Math.min(max, Math.max(1, Math.round(years)));
}

/** Dollars of interest paid in each year. Simple interest: it is paid out, not added to the bond. */
export function yearlyInterest(coupons: number[], amount: number): number[] {
  return coupons.map((c) => (amount * c) / 100);
}

/** Amount back plus all interest received, with the interest kept as cash earning nothing. */
export function ssbTotalKept(coupons: number[], amount: number, years: number): number {
  const n = clampYears(years, coupons.length);
  return amount + yearlyInterest(coupons, amount).slice(0, n).reduce((a, b) => a + b, 0);
}

/**
 * Amount back plus all interest, with each payment put somewhere earning `ratePct` a year
 * (compounded yearly) from the day it is paid. Savings Bonds pay half of each year's interest
 * every six months, so the two halves of year k are paid at k − 0.5 and k years.
 */
export function ssbTotalReinvested(coupons: number[], amount: number, years: number, ratePct: number): number {
  const n = clampYears(years, coupons.length);
  const g = 1 + ratePct / 100;
  let total = amount;
  for (let k = 1; k <= n; k++) {
    const half = (amount * coupons[k - 1]) / 200;
    total += half * Math.pow(g, n - k + 0.5) + half * Math.pow(g, n - k);
  }
  return total;
}

/** Total interest over the holding period divided by the years held, % a year. Not compounded. */
export function simpleAverage(coupons: number[], years: number): number {
  const n = clampYears(years, coupons.length);
  return coupons.slice(0, n).reduce((a, b) => a + b, 0) / n;
}

/**
 * Average return per year the way MAS publishes it: the single yearly rate that, compounded,
 * is worth the same as the stepped-up interest (the internal rate of return of 100 paid in,
 * each year's interest received at the end of that year, and 100 back at the end).
 * It is a little lower than simpleAverage because later, larger payments count for less.
 */
export function averageReturn(coupons: number[], years: number): number {
  const n = clampYears(years, coupons.length);
  // Present value, minus the 100 paid, of holding n years when discounted at y (a fraction).
  const npv = (y: number) => {
    let pv = -100;
    for (let k = 1; k <= n; k++) pv += (coupons[k - 1] + (k === n ? 100 : 0)) / Math.pow(1 + y, k);
    return pv;
  };
  let lo = -0.99;
  let hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

/** Money left in the CPF Ordinary Account at a flat rate, compounded once a year. */
export function oaTotal(amount: number, ratePct: number, years: number): number {
  return amount * Math.pow(1 + ratePct / 100, clampYears(years, Infinity));
}

/**
 * The flat simple-interest rate (% a year, paid out and not reinvested) that ends with the
 * same money as `ratePct` compounded yearly for `years` years: ((1 + r)^n − 1) / n.
 */
export function breakEvenSimpleRate(ratePct: number, years: number): number {
  const n = clampYears(years, Infinity);
  return ((Math.pow(1 + ratePct / 100, n) - 1) / n) * 100;
}

/** Break-even simple rate for each holding period from 1 to `maxYears` years. */
export function breakEvenTable(ratePct: number, maxYears = MAX_YEARS): number[] {
  return Array.from({ length: maxYears }, (_, i) => breakEvenSimpleRate(ratePct, i + 1));
}

/** Does the bond, with interest kept as cash, end with more than the OA would? */
export function beatsOaKept(coupons: number[], oaRatePct: number, years = MAX_YEARS): boolean {
  return ssbTotalKept(coupons, 100, years) > oaTotal(100, oaRatePct, years);
}

/** Does the bond, with interest reinvested at `reinvestPct`, end with more than the OA would? */
export function beatsOaReinvested(coupons: number[], oaRatePct: number, reinvestPct: number, years = MAX_YEARS): boolean {
  return ssbTotalReinvested(coupons, 100, years, reinvestPct) > oaTotal(100, oaRatePct, years);
}

export interface Comparison {
  years: number;
  ssbKept: number;
  ssbReinvested: number;
  oa: number;
  /** SSB (interest kept) minus OA. Negative means the bond pays less. */
  keptMinusOa: number;
  /** SSB (interest reinvested) minus OA. */
  reinvestedMinusOa: number;
}

export function compare(coupons: number[], amount: number, years: number, oaRatePct: number, reinvestPct: number): Comparison {
  const n = clampYears(years, coupons.length);
  const ssbKept = ssbTotalKept(coupons, amount, n);
  const ssbReinvested = ssbTotalReinvested(coupons, amount, n, reinvestPct);
  const oa = oaTotal(amount, oaRatePct, n);
  return { years: n, ssbKept, ssbReinvested, oa, keptMinusOa: ssbKept - oa, reinvestedMinusOa: ssbReinvested - oa };
}

/** Change from the previous value in percentage points, or null if either is missing. */
export function change(now: number | null | undefined, before: number | null | undefined): number | null {
  if (now == null || before == null || !Number.isFinite(now) || !Number.isFinite(before)) return null;
  return now - before;
}

/** The 10-year average return for an issue: MAS's published figure, or ours if it was not published. */
export function tenYearAverage(issue: SsbIssue): number {
  return issue.avgReturn?.[MAX_YEARS - 1] ?? averageReturn(issue.coupons, MAX_YEARS);
}
