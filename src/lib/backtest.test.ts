import { describe, expect, it } from 'vitest';
import {
  dipBuying,
  irrMonthlyDeposits,
  nextMonth,
  numberOneAt,
  quarterOf,
  runBacktest,
  type Daily,
  type Monthly,
  type Options,
  type Rankings,
} from './backtest';

// Synthetic prices: every asset grows at a constant monthly rate, so CAGR and
// IRR are known exactly and volatility and drawdown must be zero.
function months(from: string, count: number): string[] {
  const out = [from];
  while (out.length < count) out.push(nextMonth(out[out.length - 1]));
  return out;
}

function constantGrowth(tickers: Record<string, number>, count = 60, from = '2000-01'): Monthly {
  const dates = months(from, count);
  const series: Monthly['series'] = {};
  for (const [t, g] of Object.entries(tickers)) series[t] = dates.map((_, i) => 100 * Math.pow(1 + g, i));
  return { dates, series };
}

const G = 0.01;
const ANNUAL = Math.pow(1 + G, 12) - 1;

const rankings: Rankings = {
  numberOne: [
    { start: '2000-01', ticker: 'AAA', confidence: 'confirmed' },
    { start: '2001-03', ticker: 'BBB', confidence: 'confirmed' },
    { start: '2002-08', ticker: 'AAA', confidence: 'confirmed' },
  ],
  top7: [],
};

const base: Options = { variant: 'snp1', cadence: 'monthly', start: '2000-01', end: '2004-12', monthly: 1000, worstCase: false };

describe('date helpers', () => {
  it('rolls months and finds quarters', () => {
    expect(nextMonth('2000-12')).toBe('2001-01');
    expect(nextMonth('2000-01')).toBe('2000-02');
    expect(quarterOf('2000-03')).toBe('2000-Q1');
    expect(quarterOf('2000-10')).toBe('2000-Q4');
  });

  it('finds the #1 span in force for a month', () => {
    expect(numberOneAt('2001-02', rankings.numberOne)?.ticker).toBe('AAA');
    expect(numberOneAt('2001-03', rankings.numberOne)?.ticker).toBe('BBB');
    expect(numberOneAt('1999-12', rankings.numberOne)).toBeNull();
  });
});

describe('irrMonthlyDeposits', () => {
  it('recovers a known rate', () => {
    const n = 120;
    const fv = Array.from({ length: n }, (_, t) => 500 * Math.pow(1.01, n - t)).reduce((a, b) => a + b, 0);
    expect(irrMonthlyDeposits(Array(n).fill(500), fv)).toBeCloseTo(ANNUAL, 8);
  });
});

describe('runBacktest on constant growth', () => {
  const data = constantGrowth({ AAA: G, BBB: G, SPY: G });

  it('gives the analytic CAGR and IRR, with no volatility or drawdown', () => {
    const r = runBacktest(data, rankings, base);
    if (!r.ok) throw new Error(r.reason);
    expect(r.metrics.cagr).toBeCloseTo(ANNUAL, 10);
    expect(r.metrics.irr).toBeCloseTo(ANNUAL, 8);
    expect(r.metrics.volatility).toBeCloseTo(0, 10);
    expect(r.metrics.maxDrawdown).toBeCloseTo(0, 10);
    expect(r.metrics.months).toBe(59);
    expect(r.metrics.contributed).toBe(59000);
    const expected = Array.from({ length: 59 }, (_, t) => 1000 * Math.pow(1 + G, 59 - t)).reduce((a, b) => a + b, 0);
    expect(r.metrics.finalValue).toBeCloseTo(expected, 4);
    expect(r.warnings).toEqual([]);
  });

  it('counts each change of #1 as one rotation', () => {
    const r = runBacktest(data, rankings, base);
    if (!r.ok) throw new Error(r.reason);
    expect(r.rotations.map((x) => `${x.date} ${x.from}>${x.to}`)).toEqual(['2001-03 AAA>BBB', '2002-08 BBB>AAA']);
    expect(r.timeline.map((x) => x.label)).toEqual(['AAA', 'BBB', 'AAA']);
  });

  it('matches SPY when everything grows at the same rate', () => {
    const a = runBacktest(data, rankings, base);
    const b = runBacktest(data, rankings, { ...base, variant: 'spy' });
    if (!a.ok || !b.ok) throw new Error('failed');
    expect(a.metrics.finalValue).toBeCloseTo(b.metrics.finalValue, 6);
    expect(b.metrics.rotations).toBe(0);
  });
});

describe('cadence', () => {
  // BBB is #1 only from March to July 2001... a yearly check in January never sees it.
  const short: Rankings = {
    numberOne: [
      { start: '2000-01', ticker: 'AAA', confidence: 'confirmed' },
      { start: '2001-02', ticker: 'BBB', confidence: 'confirmed' },
      { start: '2001-09', ticker: 'AAA', confidence: 'confirmed' },
    ],
    top7: [],
  };
  const data = constantGrowth({ AAA: 0.005, BBB: 0.02, SPY: 0.01 });

  it('uses the ranking at each cadence, so cadences give different results', () => {
    const run = (cadence: Options['cadence']) => {
      const r = runBacktest(data, short, { ...base, cadence });
      if (!r.ok) throw new Error(r.reason);
      return r;
    };
    const m = run('monthly');
    const q = run('quarterly');
    const y = run('yearly');
    expect(m.rotations.map((x) => x.date)).toEqual(['2001-02', '2001-09']);
    // Quarterly checks fall in Jan, Apr, Jul, Oct: BBB is picked up in April and dropped in October.
    expect(q.rotations.map((x) => x.date)).toEqual(['2001-04', '2001-10']);
    expect(y.rotations).toEqual([]);
    expect(m.metrics.finalValue).not.toBeCloseTo(q.metrics.finalValue, 2);
    expect(q.metrics.finalValue).not.toBeCloseTo(y.metrics.finalValue, 2);
  });
});

describe('top-7 variants', () => {
  const data = constantGrowth({ AAA: G, BBB: G, CCC: G, SPY: G }, 36);
  const withTop: Rankings = {
    numberOne: [{ start: '2000-01', ticker: 'AAA', confidence: 'confirmed' }],
    top7: Array.from({ length: 12 }, (_, k) => ({
      quarter: `${2000 + Math.floor(k / 4)}-Q${(k % 4) + 1}`,
      tickers: k < 6 ? ['AAA', 'BBB', 'CCC'] : ['BBB', 'AAA', 'CCC'],
      confidence: 'confirmed' as const,
    })),
  };
  const opts: Options = { ...base, end: '2002-12', cadence: 'quarterly' };

  it('refuses monthly cadence because the table is quarterly', () => {
    const r = runBacktest(data, withTop, { ...opts, variant: 'snp7', cadence: 'monthly' });
    expect(r.ok).toBe(false);
  });

  it('holds the right names for each variant', () => {
    const labels = (variant: Options['variant']) => {
      const r = runBacktest(data, withTop, { ...opts, variant });
      if (!r.ok) throw new Error(r.reason);
      expect(r.metrics.cagr).toBeCloseTo(ANNUAL, 10);
      return r.timeline.map((x) => x.label);
    };
    expect(labels('snp2')).toEqual(['AAA + BBB']);
    expect(labels('rank2')).toEqual(['BBB', 'AAA']);
    expect(labels('snp7')).toEqual(['AAA + BBB + CCC']);
    expect(labels('blend')).toEqual(['AAA + BBB + CCC']);
  });

  it('warns when fewer than seven companies are recorded', () => {
    const r = runBacktest(data, withTop, { ...opts, variant: 'snp7' });
    if (!r.ok) throw new Error(r.reason);
    expect(r.warnings.some((w) => w.includes('Only 3 of 7'))).toBe(true);
  });
});

describe('filters', () => {
  it('momentum holds SPY when #1 lags it and #1 when it leads', () => {
    const one: Rankings = { numberOne: [{ start: '1999-01', ticker: 'AAA', confidence: 'confirmed' }], top7: [] };
    const lag = constantGrowth({ AAA: 0.005, SPY: 0.01 }, 48, '1999-01');
    const lead = constantGrowth({ AAA: 0.02, SPY: 0.01 }, 48, '1999-01');
    const opts: Options = { ...base, variant: 'momentum', start: '2000-01', end: '2002-12' };
    const a = runBacktest(lag, one, opts);
    const b = runBacktest(lead, one, opts);
    if (!a.ok || !b.ok) throw new Error('failed');
    expect(a.timeline.map((x) => x.label)).toEqual(['SPY']);
    expect(b.timeline.map((x) => x.label)).toEqual(['AAA']);
  });

  it('trend goes to cash while SPY is below its 10-month average', () => {
    const one: Rankings = { numberOne: [{ start: '1999-01', ticker: 'AAA', confidence: 'confirmed' }], top7: [] };
    const falling = constantGrowth({ AAA: 0.01, SPY: -0.01 }, 48, '1999-01');
    const r = runBacktest(falling, one, { ...base, variant: 'trend', start: '2000-01', end: '2002-12' });
    if (!r.ok) throw new Error(r.reason);
    expect(r.timeline.map((x) => x.label)).toEqual(['Cash']);
    expect(r.metrics.finalValue).toBeCloseTo(35000, 6);
    expect(r.metrics.cagr).toBeCloseTo(0, 10);
  });
});

describe('missing prices', () => {
  it('never produces NaN when the incoming stock has no price at the rotation month', () => {
    const data = constantGrowth({ AAA: G, BBB: G, SPY: G });
    // The March 2001 check trades at the February 2001 month-end (index 13).
    data.series.BBB[13] = null;
    data.series.BBB[14] = null;
    const r = runBacktest(data, rankings, base);
    if (!r.ok) throw new Error(r.reason);
    for (const p of r.points) {
      expect(Number.isFinite(p.value)).toBe(true);
      expect(Number.isFinite(p.index)).toBe(true);
    }
    expect(r.warnings.some((w) => w.includes('BBB has no price for 2001-02'))).toBe(true);
    // The rotation simply happens once BBB has a price again, and growth is unaffected.
    expect(r.rotations[0].date).toBe('2001-05');
    expect(r.metrics.cagr).toBeCloseTo(ANNUAL, 10);
  });

  it('values a held stock at its last known price when a month is missing', () => {
    const data = constantGrowth({ AAA: G, BBB: G, SPY: G });
    data.series.AAA[5] = null;
    const r = runBacktest(data, rankings, base);
    if (!r.ok) throw new Error(r.reason);
    expect(r.points.every((p) => Number.isFinite(p.value))).toBe(true);
    expect(r.warnings.some((w) => w.includes('last known price'))).toBe(true);
  });

  it('reports missing ranking rows instead of guessing', () => {
    const data = constantGrowth({ AAA: G, SPY: G });
    const r = runBacktest(data, { numberOne: rankings.numberOne, top7: [] }, { ...base, variant: 'snp7', cadence: 'quarterly' });
    if (!r.ok) throw new Error(r.reason);
    expect(r.warnings.some((w) => w.includes('No top-7 ranking'))).toBe(true);
    expect(r.metrics.finalValue).toBe(59000);
  });
});

describe('worst-case execution', () => {
  // Flat prices at 100. On one day in each month the range is 90 to 110.
  function flatDaily(dates: string[]): Daily {
    const d: string[] = [];
    for (const m of dates) for (const day of ['05', '15', '25']) d.push(`${m}-${day}`);
    const mk = () => ({
      h: d.map((x) => (x.endsWith('-15') ? 110 : 100)),
      l: d.map((x) => (x.endsWith('-15') ? 90 : 100)),
      c: d.map(() => 100),
    });
    return { dates: d, series: { AAA: mk(), BBB: mk(), SPY: mk() } };
  }

  it('sells at the low and buys at the high on rotations only', () => {
    const data = constantGrowth({ AAA: 0, BBB: 0, SPY: 0 });
    const daily = flatDaily(data.dates);
    const normal = runBacktest(data, rankings, base, daily);
    const worst = runBacktest(data, rankings, { ...base, worstCase: true }, daily);
    if (!normal.ok || !worst.ok) throw new Error('failed');
    expect(normal.metrics.finalValue).toBe(59000);
    expect(worst.rotations.map((x) => x.worstDay)).toEqual(['2001-03-15', '2002-08-15']);
    // First rotation: 13 deposits (13,000) rotated at 90/110; the 14th buys at the close.
    // Second rotation: everything held before that month's deposit is rotated again.
    const afterFirst = (13000 * 90) / 110;
    const heldAtSecond = afterFirst + 17000; // deposits 14 to 30
    const expected = (heldAtSecond * 90) / 110 + 29000; // deposits 31 to 59
    expect(worst.metrics.finalValue).toBeCloseTo(expected, 6);
  });

  it('falls back to the close, with a warning, when daily prices are absent', () => {
    const data = constantGrowth({ AAA: 0, BBB: 0, SPY: 0 });
    const r = runBacktest(data, rankings, { ...base, worstCase: true });
    if (!r.ok) throw new Error(r.reason);
    expect(r.metrics.finalValue).toBe(59000);
    expect(r.warnings.some((w) => w.includes('No daily prices'))).toBe(true);
  });
});

describe('dipBuying', () => {
  it('equals plain DCA value when prices never move, but leaves cash uninvested', () => {
    const dates: string[] = [];
    for (const m of months('2000-01', 24)) for (const day of ['03', '17']) dates.push(`${m}-${day}`);
    const flat = dates.map(() => 50);
    const daily: Daily = { dates, series: { SPY: { h: flat, l: flat, c: flat } } };
    const r = dipBuying(daily, 'SPY', '2000-01', '2001-12', 100);
    if (!r.ok) throw new Error(r.reason);
    expect(r.dca.finalValue).toBeCloseTo(2400, 8);
    expect(r.dip.buys).toBe(0);
    expect(r.dip.cashLeft).toBe(2400);
    expect(r.dip.finalValue).toBe(2400);
  });

  it('buys when the close is 3 to 5% under the trailing high', () => {
    const dates = ['2000-01-03', '2000-01-10', '2000-02-01', '2000-02-10'];
    const c = [100, 100, 96, 96];
    const daily: Daily = { dates, series: { SPY: { h: c, l: c, c } } };
    const r = dipBuying(daily, 'SPY', '2000-01', '2000-02', 100);
    if (!r.ok) throw new Error(r.reason);
    expect(r.dip.buys).toBe(1);
    expect(r.dip.cashLeft).toBe(0);
    expect(r.dip.finalValue).toBeCloseTo(200, 8);
    expect(r.dca.finalValue).toBeCloseTo(96 + 100, 8);
  });

  it('says so when the ticker has no daily data', () => {
    const r = dipBuying({ dates: [], series: {} }, 'SPY', '2000-01', '2000-02', 100);
    expect(r.ok).toBe(false);
  });
});
