import { describe, expect, it } from 'vitest';
import { breakEvenSize, dragRate, project, yearlyCommission } from './taxdrag';

describe('dragRate', () => {
  it('is the fee plus yield times withholding', () => {
    // VOO-like: 0.03% fee, 1.5% yield, 30% withheld = 0.03% + 0.45% = 0.48%
    expect(dragRate(0.0003, 0.015, 0.3)).toBeCloseTo(0.0048, 10);
    // CSPX-like: 0.07% + 1.5% × 15% = 0.295%
    expect(dragRate(0.0007, 0.015, 0.15)).toBeCloseTo(0.00295, 10);
  });

  it('is just the fee when there is no dividend', () => {
    expect(dragRate(0.002, 0, 0.3)).toBe(0.002);
  });
});

describe('yearlyCommission', () => {
  it('multiplies commission by orders', () => {
    expect(yearlyCommission(5, 12, 12000)).toBe(60);
  });
  it('is zero when nothing is bought', () => {
    expect(yearlyCommission(5, 12, 0)).toBe(0);
  });
});

describe('project', () => {
  it('is the starting amount plus deposits at zero return and zero drag', () => {
    const rows = project({ start: 10000, yearlyAdded: 1000, grossReturn: 0, drag: 0, years: 5, yearlyCost: 0 });
    expect(rows).toHaveLength(6);
    expect(rows[0].value).toBe(10000);
    expect(rows[5].value).toBe(15000);
    expect(rows[5].contributed).toBe(15000);
  });

  it('takes commission out of each deposit', () => {
    const rows = project({ start: 0, yearlyAdded: 1000, grossReturn: 0, drag: 0, years: 3, yearlyCost: 60 });
    expect(rows[3].value).toBe(2820);
    expect(rows[3].contributed).toBe(3000);
  });

  it('matches compound growth for a lump sum', () => {
    const rows = project({ start: 100000, yearlyAdded: 0, grossReturn: 0.07, drag: 0.005, years: 30, yearlyCost: 0 });
    expect(rows[30].value).toBeCloseTo(100000 * Math.pow(1.065, 30), 4);
  });

  it('matches the annuity-due formula with yearly deposits', () => {
    const r = 0.06;
    const n = 20;
    const expected = 5000 * Math.pow(1 + r, n) + (1200 * (1 + r) * (Math.pow(1 + r, n) - 1)) / r;
    const rows = project({ start: 5000, yearlyAdded: 1200, grossReturn: 0.07, drag: 0.01, years: n, yearlyCost: 0 });
    expect(rows[n].value).toBeCloseTo(expected, 4);
  });

  it('shrinks by the drag each year when the gross return is zero', () => {
    const rows = project({ start: 1000, yearlyAdded: 0, grossReturn: 0, drag: 0.01, years: 2, yearlyCost: 0 });
    expect(rows[2].value).toBeCloseTo(980.1, 8);
  });
});

describe('breakEvenSize', () => {
  it('divides the extra commission by the drag saved', () => {
    // 0.48% against 0.295% saves 0.185% a year; S$60 ÷ 0.00185 = S$32,432.43
    const b = breakEvenSize(0.0048, 0.00295, 60);
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.size).toBeCloseTo(32432.43, 2);
  });

  it('is zero when there is no extra commission', () => {
    const b = breakEvenSize(0.0048, 0.00295, 0);
    expect(b).toEqual({ ok: true, size: 0 });
  });

  it('gives a reason when the Irish fund is not cheaper to hold', () => {
    expect(breakEvenSize(0.002, 0.002, 60).ok).toBe(false);
    expect(breakEvenSize(0.001, 0.002, 60).ok).toBe(false);
  });
});
