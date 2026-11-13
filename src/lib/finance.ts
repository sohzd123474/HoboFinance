// Pure money maths. No DOM, no formatting — everything here is unit tested.

export interface YearPoint {
  year: number;
  /** Money you put in yourself (or, for loans, balance still owed). */
  base: number;
  /** Growth earned on top (unused for loans). */
  extra: number;
}

export interface GrowthResult {
  balance: number;
  contributed: number;
  interest: number;
  series: YearPoint[];
}

/** Growth of a starting amount plus a fixed monthly deposit, compounded monthly. */
export function futureValue(
  principal: number,
  monthly: number,
  annualRatePct: number,
  years: number,
): GrowthResult {
  const r = annualRatePct / 100 / 12;
  const months = Math.round(years * 12);
  let balance = principal;
  let contributed = principal;
  const series: YearPoint[] = [];
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + r) + monthly;
    contributed += monthly;
    if (m % 12 === 0 || m === months) {
      series.push({ year: Math.ceil(m / 12), base: contributed, extra: balance - contributed });
    }
  }
  return { balance, contributed, interest: balance - contributed, series };
}

export interface LoanResult {
  payment: number;
  totalPaid: number;
  totalInterest: number;
  series: YearPoint[];
}

/** Standard reducing-balance loan with equal monthly repayments. */
export function loanRepayment(amount: number, annualRatePct: number, years: number): LoanResult {
  const r = annualRatePct / 100 / 12;
  const n = Math.max(1, Math.round(years * 12));
  const payment = r === 0 ? amount / n : (amount * r) / (1 - Math.pow(1 + r, -n));
  let balance = amount;
  const series: YearPoint[] = [];
  for (let m = 1; m <= n; m++) {
    balance = balance * (1 + r) - payment;
    if (m % 12 === 0 || m === n) {
      series.push({ year: Math.ceil(m / 12), base: Math.max(0, balance), extra: 0 });
    }
  }
  const totalPaid = payment * n;
  return { payment, totalPaid, totalInterest: totalPaid - amount, series };
}

export interface GoalResult {
  monthly: number;
  contributed: number;
  interest: number;
  series: YearPoint[];
}

/** Monthly deposit needed to reach a target, given what you already have. */
export function savingsGoal(
  target: number,
  current: number,
  annualRatePct: number,
  years: number,
): GoalResult {
  const r = annualRatePct / 100 / 12;
  const n = Math.max(1, Math.round(years * 12));
  const grown = current * Math.pow(1 + r, n);
  const gap = target - grown;
  let monthly = 0;
  if (gap > 0) {
    monthly = r === 0 ? gap / n : (gap * r) / (Math.pow(1 + r, n) - 1);
  }
  const g = futureValue(current, monthly, annualRatePct, years);
  return { monthly, contributed: g.contributed, interest: g.interest, series: g.series };
}

export interface FireResult {
  target: number;
  /** Null when the target is not reached within 100 years. */
  years: number | null;
  series: YearPoint[];
}

/**
 * Financial independence: the pot needed so yearly spending equals the chosen
 * withdrawal rate, and how long saving takes to get there. Use a return after
 * inflation so the answer is in today's money.
 */
export function fire(
  annualSpend: number,
  withdrawalRatePct: number,
  current: number,
  monthlySaving: number,
  realReturnPct: number,
): FireResult {
  const target = withdrawalRatePct > 0 ? annualSpend / (withdrawalRatePct / 100) : Infinity;
  const r = realReturnPct / 100 / 12;
  let balance = current;
  let contributed = current;
  let months: number | null = balance >= target ? 0 : null;
  const series: YearPoint[] = [];
  const cap = 100 * 12;
  for (let m = 1; m <= cap && months === null; m++) {
    balance = balance * (1 + r) + monthlySaving;
    contributed += monthlySaving;
    if (balance >= target) months = m;
    if (m % 12 === 0 || months !== null) {
      series.push({ year: Math.ceil(m / 12), base: contributed, extra: Math.max(0, balance - contributed) });
    }
  }
  return { target, years: months === null ? null : months / 12, series: months === null ? [] : series };
}

/** Years of monthly saving until a balance reaches a target; null if not within 100 years. */
export function yearsToTarget(start: number, monthly: number, annualRatePct: number, target: number): number | null {
  if (start >= target) return 0;
  const r = annualRatePct / 100 / 12;
  let balance = start;
  for (let m = 1; m <= 1200; m++) {
    balance = balance * (1 + r) + monthly;
    if (balance >= target) return m / 12;
  }
  return null;
}
