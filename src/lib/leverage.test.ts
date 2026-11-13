import { describe, expect, it } from 'vitest';
import { assetPath, leveragedPath, pathStats } from './leverage';

const days = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10));

describe('assetPath', () => {
  it('rebases to 1 and skips missing days', () => {
    const p = assetPath(days(4), [50, null, 55, 60], '2020-01-01', '2020-01-04')!;
    expect(p.dates).toEqual(['2020-01-01', '2020-01-03', '2020-01-04']);
    expect(p.values).toEqual([1, 1.1, 1.2]);
  });

  it('returns null without at least two prices', () => {
    expect(assetPath(days(3), [null, null, 10], '2020-01-01', '2020-01-03')).toBeNull();
  });
});

describe('leveragedPath', () => {
  it('equals the index at 1x with no cost', () => {
    const idx = { dates: days(4), values: [1, 1.1, 0.99, 1.05] };
    const p = leveragedPath(idx, 1, 0);
    p.values.forEach((v, i) => expect(v).toBeCloseTo(idx.values[i], 12));
  });

  it('loses money on a round trip that leaves the index flat', () => {
    // Index: +10% then -9.0909% returns to 1. At 3x: 1.3 x (1 - 0.27273) = 0.94545.
    const idx = { dates: days(3), values: [1, 1.1, 1] };
    const p = leveragedPath(idx, 3, 0);
    expect(p.values[2]).toBeCloseTo(1.3 * (1 - 3 * (1 - 1 / 1.1)), 12);
    expect(p.values[2]).toBeLessThan(1);
  });

  it('compounds a steady rise to more than 3x the index gain', () => {
    const idx = { dates: days(11), values: Array.from({ length: 11 }, (_, i) => Math.pow(1.01, i)) };
    const p = leveragedPath(idx, 3, 0);
    expect(p.values[10]).toBeCloseTo(Math.pow(1.03, 10), 12);
    expect(p.values[10] - 1).toBeGreaterThan(3 * (idx.values[10] - 1));
  });

  it('stays at zero after a fall of a third or more in one day', () => {
    const idx = { dates: days(3), values: [1, 0.6, 0.9] };
    expect(leveragedPath(idx, 3, 0).values).toEqual([1, 0, 0]);
  });

  it('charges the yearly cost a day at a time', () => {
    const idx = { dates: days(253), values: Array(253).fill(1) };
    const p = leveragedPath(idx, 3, 1);
    expect(p.values[252]).toBeCloseTo(Math.pow(1 - 0.01 / 252, 252), 12);
  });
});

describe('pathStats', () => {
  it('measures return and the deepest fall from a peak', () => {
    const s = pathStats({ dates: days(5), values: [1, 2, 1, 1.5, 3] });
    expect(s.totalReturn).toBe(2);
    expect(s.maxDrawdown).toBe(-0.5);
  });

  it('reports a total loss as -100% a year without NaN', () => {
    const s = pathStats({ dates: days(3), values: [1, 0, 0] });
    expect(s.totalReturn).toBe(-1);
    expect(s.cagr).toBe(-1);
    expect(Number.isFinite(s.volatility)).toBe(true);
  });
});
