import { describe, expect, it } from 'vitest';
import { fallSummary, lumpVsSpread, median, yearStats } from './staying';
import { yearsToTarget } from './finance';

describe('yearStats', () => {
  const dates = ['2019-12-31', '2020-01-02', '2020-03-01', '2020-06-01', '2020-12-31', '2021-01-04', '2021-12-31'];
  const closes = [100, 100, 120, 90, 110, 110, 99];

  it('finds the largest fall from a high inside each year and the year return', () => {
    const s = yearStats(dates, closes, 2);
    expect(s.map((x) => x.year)).toEqual(['2020', '2021']);
    expect(s[0].maxDrawdown).toBeCloseTo(90 / 120 - 1, 12); // -25%
    expect(s[0].yearReturn).toBeCloseTo(0.1, 12); // 100 at end of 2019 to 110
    expect(s[1].maxDrawdown).toBeCloseTo(-0.1, 12);
    expect(s[1].yearReturn).toBeCloseTo(-0.1, 12);
  });

  it('leaves out years with too few prices and skips missing days', () => {
    expect(yearStats(dates, closes, 200)).toEqual([]);
    const s = yearStats(['2020-01-02', '2020-01-03', '2020-01-06'], [100, null, 80], 2);
    expect(s[0].days).toBe(2);
    expect(s[0].maxDrawdown).toBeCloseTo(-0.2, 12);
  });
});

describe('fallSummary', () => {
  it('counts years with a fall past the threshold and how many still ended up', () => {
    const stats = [
      { year: 'a', maxDrawdown: -0.12, yearReturn: 0.2, days: 250 },
      { year: 'b', maxDrawdown: -0.3, yearReturn: -0.1, days: 250 },
      { year: 'c', maxDrawdown: -0.05, yearReturn: 0.1, days: 250 },
    ];
    expect(fallSummary(stats, 10)).toEqual({ years: 3, scary: 2, endedUp: 1, medianDrawdown: -0.12 });
    expect(fallSummary(stats, 20).scary).toBe(1);
  });
});

describe('median', () => {
  it('handles odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

describe('lumpVsSpread', () => {
  it('always favours the lump sum when prices only rise and cash earns nothing', () => {
    const prices = Array.from({ length: 60 }, (_, i) => 100 * Math.pow(1.01, i));
    const r = lumpVsSpread(prices, 6, 24, 0)!;
    expect(r.windows).toBe(36);
    expect(r.lumpWins).toBe(1);
    expect(r.meanLump).toBeCloseTo(Math.pow(1.01, 12) - 1, 10);
    expect(r.meanSpread).toBeLessThan(r.meanLump);
    expect(r.medianGap).toBeGreaterThan(0);
  });

  it('always favours spreading out when prices only fall', () => {
    const prices = Array.from({ length: 40 }, (_, i) => 100 * Math.pow(0.99, i));
    expect(lumpVsSpread(prices, 6, 24, 0)!.lumpWins).toBe(0);
  });

  it('is a tie on flat prices with no cash interest, and spreading wins once cash earns interest', () => {
    const flat = Array(40).fill(50);
    const tie = lumpVsSpread(flat, 12, 24, 0)!;
    expect(tie.meanLump).toBeCloseTo(0, 12);
    expect(tie.meanSpread).toBeCloseTo(0, 12);
    expect(tie.medianGap).toBeCloseTo(0, 12);
    expect(lumpVsSpread(flat, 12, 24, 3)!.meanSpread).toBeGreaterThan(0);
  });

  it('returns null when there is not enough history', () => {
    expect(lumpVsSpread([1, 2, 3], 3, 24, 0)).toBeNull();
  });
});

describe('yearsToTarget', () => {
  it('is zero when already there and null when unreachable', () => {
    expect(yearsToTarget(100, 0, 5, 100)).toBe(0);
    expect(yearsToTarget(0, 0, 5, 100)).toBeNull();
  });

  it('counts months of saving at no return', () => {
    expect(yearsToTarget(0, 100, 0, 1200)).toBe(1);
  });
});
