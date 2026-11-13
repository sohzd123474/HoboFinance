import { describe, expect, it } from 'vitest';
import raw from '../../public/data/ssb.json';
import {
  averageReturn,
  beatsOaKept,
  beatsOaReinvested,
  breakEvenSimpleRate,
  breakEvenTable,
  change,
  clampYears,
  compare,
  oaTotal,
  simpleAverage,
  ssbTotalKept,
  ssbTotalReinvested,
  tenYearAverage,
  yearlyInterest,
  type SsbData,
} from './ssb';

const data = raw as SsbData;
// The first issue, GX15100F (October 2015), as published by MAS.
const FIRST = [0.96, 1.09, 1.93, 2.93, 3.25, 3.25, 3.25, 3.25, 3.3, 3.7];
const FIRST_PUBLISHED = [0.96, 1.02, 1.32, 1.71, 2.01, 2.2, 2.34, 2.44, 2.53, 2.63];

describe('interest paid out', () => {
  it('is simple interest on the amount each year', () => {
    const paid = yearlyInterest(FIRST, 10000);
    expect(paid[0]).toBeCloseTo(96, 9);
    expect(paid[9]).toBeCloseTo(370, 9);
  });

  it('adds up to the amount plus the interest for the years held', () => {
    expect(ssbTotalKept(FIRST, 10000, 1)).toBeCloseTo(10096, 9);
    expect(ssbTotalKept(FIRST, 10000, 2)).toBeCloseTo(10205, 9);
    expect(ssbTotalKept(FIRST, 10000, 10)).toBeCloseTo(12691, 9);
  });

  it('keeps the holding period between 1 and 10 whole years', () => {
    expect(clampYears(0)).toBe(1);
    expect(clampYears(14)).toBe(10);
    expect(clampYears(2.6)).toBe(3);
    expect(clampYears(NaN)).toBe(1);
    expect(ssbTotalKept(FIRST, 10000, 25)).toBeCloseTo(12691, 9);
  });
});

describe('interest reinvested', () => {
  it('equals interest kept when the reinvestment rate is 0', () => {
    for (const n of [1, 5, 10]) expect(ssbTotalReinvested(FIRST, 5000, n, 0)).toBeCloseTo(ssbTotalKept(FIRST, 5000, n), 9);
  });

  it('grows each half-yearly payment from the day it is paid', () => {
    // 2 years at 4%: year 1 pays 1 + 1 (at 0.5 and 1 years), year 2 pays 2 + 2 (at 1.5 and 2 years).
    const expected = 100 + 1 * Math.pow(1.04, 1.5) + 1 * 1.04 + 2 * Math.pow(1.04, 0.5) + 2;
    expect(ssbTotalReinvested([2, 4], 100, 2, 4)).toBeCloseTo(expected, 9);
  });

  it('is worth more than keeping the interest when the rate is positive', () => {
    expect(ssbTotalReinvested(FIRST, 10000, 10, 2.5)).toBeGreaterThan(ssbTotalKept(FIRST, 10000, 10));
  });
});

describe('average return per year', () => {
  it('matches MAS for the first issue', () => {
    FIRST_PUBLISHED.forEach((published, i) => {
      expect(Math.abs(averageReturn(FIRST, i + 1) - published)).toBeLessThan(0.00501);
    });
  });

  it('matches every published figure in ssb.json to rounding', () => {
    expect(data.issues.length).toBeGreaterThan(100);
    let checked = 0;
    for (const issue of data.issues) {
      expect(issue.coupons).toHaveLength(10);
      if (!issue.avgReturn) continue;
      issue.avgReturn.forEach((published, i) => {
        const ours = averageReturn(issue.coupons, i + 1);
        expect(Math.abs(ours - published), `${issue.code} year ${i + 1}: ${ours} against ${published}`).toBeLessThan(0.00501);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('equals the coupon when the coupon is flat', () => {
    expect(averageReturn(Array(10).fill(3), 10)).toBeCloseTo(3, 8);
    expect(simpleAverage(Array(10).fill(3), 10)).toBeCloseTo(3, 12);
  });

  it('simple average is total interest over years held', () => {
    expect(simpleAverage(FIRST, 10)).toBeCloseTo(2.691, 9);
    expect(simpleAverage(FIRST, 2)).toBeCloseTo(1.025, 9);
  });

  it('uses the published 10-year figure when there is one', () => {
    expect(tenYearAverage({ code: 'x', issueDate: '2015-10-01', month: '2015-10', coupons: FIRST, avgReturn: FIRST_PUBLISHED })).toBe(2.63);
    expect(tenYearAverage({ code: 'x', issueDate: '2015-10-01', month: '2015-10', coupons: FIRST, avgReturn: null })).toBeCloseTo(2.63, 2);
  });
});

describe('CPF OA and the break-even rate', () => {
  it('compounds once a year', () => {
    expect(oaTotal(10000, 2.5, 1)).toBeCloseTo(10250, 9);
    expect(oaTotal(10000, 2.5, 10)).toBeCloseTo(10000 * Math.pow(1.025, 10), 9);
    expect(oaTotal(10000, 2.5, 10)).toBeCloseTo(12800.85, 2);
  });

  it('break-even for 2.5% over 10 years is about 2.80% a year', () => {
    expect(breakEvenSimpleRate(2.5, 10)).toBeCloseTo(2.80085, 4);
    expect(breakEvenSimpleRate(2.5, 1)).toBeCloseTo(2.5, 12);
  });

  it('a flat bond paying exactly the break-even rate ends level with the OA', () => {
    const table = breakEvenTable(2.5);
    expect(table).toHaveLength(10);
    table.forEach((rate, i) => {
      const n = i + 1;
      expect(ssbTotalKept(Array(10).fill(rate), 10000, n)).toBeCloseTo(oaTotal(10000, 2.5, n), 6);
    });
  });

  it('says whether a bond beats the OA', () => {
    expect(beatsOaKept(FIRST, 2.5)).toBe(false); // 26.91 of interest against 28.01
    expect(beatsOaKept(Array(10).fill(2.9), 2.5)).toBe(true);
    expect(beatsOaKept(Array(10).fill(2.7), 2.5)).toBe(false);
    // A flat 2.5% bond with interest reinvested at 2.5% beats the OA slightly, because half is paid six months early.
    expect(beatsOaReinvested(Array(10).fill(2.5), 2.5, 2.5)).toBe(true);
    expect(beatsOaReinvested(Array(10).fill(2.4), 2.5, 2.5)).toBe(false);
  });

  it('compares all three outcomes', () => {
    const c = compare(FIRST, 10000, 10, 2.5, 2.5);
    expect(c.years).toBe(10);
    expect(c.ssbKept).toBeCloseTo(12691, 9);
    expect(c.oa).toBeCloseTo(12800.85, 2);
    expect(c.keptMinusOa).toBeCloseTo(12691 - 10000 * Math.pow(1.025, 10), 9);
    expect(c.reinvestedMinusOa).toBeCloseTo(c.ssbReinvested - c.oa, 9);
    expect(c.ssbReinvested).toBeGreaterThan(c.ssbKept);
  });
});

describe('change', () => {
  it('is the difference in percentage points, or null', () => {
    expect(change(2.39, 2.3)).toBeCloseTo(0.09, 9);
    expect(change(2.39, null)).toBeNull();
    expect(change(undefined, 2)).toBeNull();
  });
});
