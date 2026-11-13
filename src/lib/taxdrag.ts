// Pure maths for the ETF tax-drag calculator. All rates are fractions (0.01 = 1%).

/** Yearly cost of holding a fund: its fee plus the dividend tax lost. */
export function dragRate(expenseRatio: number, dividendYield: number, withholding: number): number {
  return expenseRatio + dividendYield * withholding;
}

/** Extra commission paid in a year. Nothing is paid in a year with no purchases. */
export function yearlyCommission(perOrder: number, ordersPerYear: number, yearlyAdded: number): number {
  if (yearlyAdded <= 0) return 0;
  return Math.max(0, perOrder) * Math.max(0, Math.round(ordersPerYear));
}

export interface ProjectionInput {
  start: number;
  yearlyAdded: number;
  /** Return before fund fees and dividend tax. */
  grossReturn: number;
  /** From dragRate(). */
  drag: number;
  years: number;
  /** Commission taken out of each year's new money before it is invested. */
  yearlyCost: number;
}

export interface YearRow {
  year: number;
  value: number;
  /** Starting amount plus everything added so far, before commission. */
  contributed: number;
}

/**
 * Year-by-year value. New money goes in at the start of each year, less that
 * year's commission, and the whole balance then grows at gross return minus drag.
 * Row 0 is the starting position.
 */
export function project(i: ProjectionInput): YearRow[] {
  const years = Math.max(0, Math.round(i.years));
  const net = i.grossReturn - i.drag;
  let value = i.start;
  let contributed = i.start;
  const rows: YearRow[] = [{ year: 0, value, contributed }];
  for (let y = 1; y <= years; y++) {
    value = (value + i.yearlyAdded - i.yearlyCost) * (1 + net);
    contributed += i.yearlyAdded;
    rows.push({ year: y, value, contributed });
  }
  return rows;
}

export type BreakEven = { ok: true; size: number } | { ok: false; reason: string };

/**
 * Portfolio size at which the Irish fund's lower yearly drag equals its extra
 * yearly commission: size × (otherDrag − irishDrag) = extraYearlyCost.
 */
export function breakEvenSize(otherDrag: number, irishDrag: number, extraYearlyCost: number): BreakEven {
  const saving = otherDrag - irishDrag;
  if (!(saving > 0)) {
    return { ok: false, reason: 'the Irish fund’s yearly drag is not lower than the other fund’s, so it never pays for the extra commission' };
  }
  return { ok: true, size: Math.max(0, extraYearlyCost) / saving };
}
