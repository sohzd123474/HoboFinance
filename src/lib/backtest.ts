// Backtest engine for the "hold the largest US company" family of strategies.
// Pure functions over precomputed month-end and daily prices. No DOM.
//
// Timing convention: prices[i] is the adjusted close on the last trading day of
// dates[i]. A check "on the 1st of the following month" trades at that close.
// So the ranking used at index i is the one for the month after dates[i].
//
// Missing prices are handled explicitly and reported in `warnings`. Nothing in
// here may ever emit NaN: every result is checked before it is returned.

export interface Monthly {
  dates: string[]; // 'YYYY-MM'
  series: Record<string, (number | null)[]>;
}

export interface Daily {
  dates: string[]; // 'YYYY-MM-DD'
  series: Record<string, { h: (number | null)[]; l: (number | null)[]; c: (number | null)[] }>;
}

export interface NumberOneSpan {
  start: string;
  ticker: string;
  confidence: 'confirmed' | 'unsure';
  note?: string;
}

export interface Top7Row {
  quarter: string; // 'YYYY-Qn'
  tickers: string[];
  confidence: 'confirmed' | 'unsure';
  note?: string;
}

export interface Rankings {
  numberOne: NumberOneSpan[];
  top7: Top7Row[];
}

export type Cadence = 'monthly' | 'quarterly' | 'yearly';
export type VariantId = 'snp1' | 'snp2' | 'snp7' | 'blend' | 'rank2' | 'momentum' | 'trend' | 'spy';

export const VARIANTS: { id: VariantId; name: string; rule: string; needsTop7: boolean; singleName: boolean }[] = [
  { id: 'snp1', name: 'SNP1', rule: 'Hold the #1 company', needsTop7: false, singleName: true },
  { id: 'snp2', name: 'SNP2', rule: 'Top 2, equal weight', needsTop7: true, singleName: false },
  { id: 'snp7', name: 'SNP7', rule: 'Top 7, equal weight', needsTop7: true, singleName: false },
  { id: 'blend', name: '40/60 blend', rule: '40% SNP1, 60% SNP7', needsTop7: true, singleName: false },
  { id: 'rank2', name: '#2 only', rule: 'Hold the #2 company', needsTop7: true, singleName: true },
  { id: 'momentum', name: 'Momentum-filtered SNP1', rule: '#1 only if its 12-month return beats SPY, else SPY', needsTop7: false, singleName: true },
  { id: 'trend', name: 'Trend-filtered SNP1', rule: '#1 only while SPY is above its 10-month average, else cash', needsTop7: false, singleName: true },
  { id: 'spy', name: 'SPY', rule: 'S&P 500 ETF, dividends reinvested', needsTop7: false, singleName: true },
];

export interface Options {
  variant: VariantId;
  cadence: Cadence;
  start: string; // 'YYYY-MM', first purchase at this month-end
  end: string; // 'YYYY-MM'
  monthly: number; // amount invested each month
  worstCase: boolean;
}

export interface Point {
  date: string;
  value: number;
  contributed: number;
  /** Time-weighted growth of 1, ignoring the size of deposits. */
  index: number;
}

export interface Rotation {
  date: string; // check month
  from: string;
  to: string;
  /** Present when worst-case execution was applied. */
  worstDay?: string;
}

export interface Metrics {
  cagr: number;
  irr: number | null;
  volatility: number;
  sharpe: number | null;
  maxDrawdown: number;
  finalValue: number;
  contributed: number;
  rotations: number;
  months: number;
}

export interface Segment {
  start: string;
  end: string;
  label: string;
}

export type BacktestResult =
  | { ok: true; points: Point[]; metrics: Metrics; rotations: Rotation[]; timeline: Segment[]; warnings: string[] }
  | { ok: false; reason: string };

const CASH = 'CASH';
type Weights = Record<string, number>;

export function nextMonth(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function quarterOf(ym: string): string {
  return `${ym.slice(0, 4)}-Q${Math.ceil(Number(ym.slice(5, 7)) / 3)}`;
}

export function numberOneAt(month: string, spans: NumberOneSpan[]): NumberOneSpan | null {
  let found: NumberOneSpan | null = null;
  for (const s of spans) {
    if (s.start <= month) found = s;
    else break;
  }
  return found;
}

function isDecisionMonth(checkMonth: string, cadence: Cadence): boolean {
  const m = Number(checkMonth.slice(5, 7));
  if (cadence === 'monthly') return true;
  if (cadence === 'quarterly') return m % 3 === 1;
  return m === 1;
}

const label = (w: Weights) =>
  Object.keys(w)
    .sort()
    .map((t) => (t === CASH ? 'Cash' : t))
    .join(' + ') || 'Nothing';

const sameSet = (a: Weights, b: Weights) => {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i]);
};

/** Annualised money-weighted return for equal monthly deposits, by bisection. */
export function irrMonthlyDeposits(deposits: number[], finalValue: number): number | null {
  const total = deposits.reduce((a, b) => a + b, 0);
  if (total <= 0 || finalValue <= 0 || !Number.isFinite(finalValue)) return null;
  const n = deposits.length;
  // Future value of the deposits at monthly rate r, minus what we ended with.
  const f = (r: number) => deposits.reduce((acc, d, t) => acc + d * Math.pow(1 + r, n - t), 0) - finalValue;
  let lo = -0.99;
  let hi = 1;
  if (f(lo) > 0 || f(hi) < 0) return null;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return Math.pow(1 + (lo + hi) / 2, 12) - 1;
}

export function metricsFrom(points: Point[], deposits: number[], rotations: number): Metrics {
  const months = points.length - 1;
  const returns: number[] = [];
  let peak = points[0].index;
  let maxDrawdown = 0;
  for (let i = 1; i < points.length; i++) {
    returns.push(points[i].index / points[i - 1].index - 1);
    peak = Math.max(peak, points[i].index);
    maxDrawdown = Math.min(maxDrawdown, points[i].index / peak - 1);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / Math.max(1, returns.length);
  const variance =
    returns.length > 1 ? returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1) : 0;
  const volatility = Math.sqrt(variance) * Math.sqrt(12);
  const last = points[points.length - 1];
  return {
    cagr: months > 0 ? Math.pow(last.index / points[0].index, 12 / months) - 1 : 0,
    irr: irrMonthlyDeposits(deposits, last.value),
    volatility,
    // Risk-free rate taken as 0, so this is mean return over volatility.
    sharpe: volatility > 1e-12 ? (mean * 12) / volatility : null,
    maxDrawdown,
    finalValue: last.value,
    contributed: last.contributed,
    rotations,
    months,
  };
}

/** The trading day inside `month` with the widest high-low range across both legs. */
function worstDay(daily: Daily, month: string, out: string, into: string) {
  const legs = [out, into].filter((t) => t !== CASH);
  if (legs.some((t) => !daily.series[t])) return null;
  let best: { j: number; spread: number } | null = null;
  for (let j = 0; j < daily.dates.length; j++) {
    const d = daily.dates[j];
    if (d.slice(0, 7) < month) continue;
    if (d.slice(0, 7) > month) break;
    let spread = 0;
    let ok = true;
    for (const t of legs) {
      const s = daily.series[t];
      const h = s.h[j];
      const l = s.l[j];
      const c = s.c[j];
      if (h == null || l == null || c == null || c <= 0) {
        ok = false;
        break;
      }
      spread += (h - l) / c;
    }
    if (ok && (!best || spread > best.spread)) best = { j, spread };
  }
  return best;
}

export function runBacktest(monthly: Monthly, rankings: Rankings, opts: Options, daily?: Daily): BacktestResult {
  const meta = VARIANTS.find((v) => v.id === opts.variant)!;
  if (meta.needsTop7 && opts.cadence === 'monthly') {
    return {
      ok: false,
      reason: 'The top-7 table is quarterly, so this variant cannot be tested at a monthly cadence. Choose quarterly or yearly.',
    };
  }
  const s = monthly.dates.indexOf(opts.start);
  const e = monthly.dates.indexOf(opts.end);
  if (s < 0 || e < 0) return { ok: false, reason: 'The chosen dates are outside the price data.' };
  if (e - s < 1) return { ok: false, reason: 'Choose an end date at least one month after the start.' };
  if (!(opts.monthly > 0)) return { ok: false, reason: 'Enter a monthly amount above zero.' };

  const warnings: string[] = [];
  const warn = (m: string) => {
    if (!warnings.includes(m)) warnings.push(m);
  };
  const price = (t: string, i: number): number | null => {
    const v = monthly.series[t]?.[i];
    return v == null || !Number.isFinite(v) || v <= 0 ? null : v;
  };

  /** Desired holdings at index i, or null to keep whatever is held. */
  const target = (i: number): Weights | null => {
    const check = nextMonth(monthly.dates[i]);
    const usable = (tickers: string[]) =>
      tickers.filter((t) => {
        if (price(t, i) !== null) return true;
        warn(`${t} has no price for ${monthly.dates[i]}, so it was left out at the ${check} check.`);
        return false;
      });
    const top1 = () => numberOneAt(check, rankings.numberOne)?.ticker ?? null;
    const top7 = () => rankings.top7.find((r) => r.quarter === quarterOf(check))?.tickers ?? null;
    const equal = (tickers: string[]): Weights | null => {
      const ok = usable(tickers);
      if (ok.length === 0) return null;
      return Object.fromEntries(ok.map((t) => [t, 1 / ok.length]));
    };
    const needTop = (n: number) => {
      const row = top7();
      if (!row) {
        warn(`No top-7 ranking recorded for ${quarterOf(check)}; holdings were left unchanged.`);
        return null;
      }
      if (row.length < n) warn(`Only ${row.length} of ${n} ranked companies are recorded for ${quarterOf(check)}.`);
      return row.slice(0, n);
    };

    switch (opts.variant) {
      case 'spy':
        return equal(['SPY']);
      case 'snp1': {
        const t = top1();
        if (!t) {
          warn(`No #1 company recorded for ${check}; holdings were left unchanged.`);
          return null;
        }
        return equal([t]);
      }
      case 'snp2': {
        const row = needTop(2);
        return row && equal(row);
      }
      case 'snp7': {
        const row = needTop(7);
        return row && equal(row);
      }
      case 'rank2': {
        const row = needTop(2);
        if (!row || row.length < 2) return null;
        return equal([row[1]]);
      }
      case 'blend': {
        const row = needTop(7);
        const seven = row && equal(row);
        if (!row || !seven) return null;
        const w: Weights = {};
        for (const [t, x] of Object.entries(seven)) w[t] = 0.6 * x;
        // The 40% sleeve goes to the top-ranked company that has a price.
        const lead = row.find((t) => t in seven)!;
        w[lead] = (w[lead] ?? 0) + 0.4;
        return w;
      }
      case 'momentum': {
        const t = top1();
        if (!t) return null;
        const now = price(t, i);
        const then = i >= 12 ? price(t, i - 12) : null;
        const spyNow = price('SPY', i);
        const spyThen = i >= 12 ? price('SPY', i - 12) : null;
        if (now === null || then === null || spyNow === null || spyThen === null) {
          warn(`12-month returns could not be worked out at the ${check} check, so SPY was held.`);
          return equal(['SPY']);
        }
        return now / then > spyNow / spyThen ? equal([t]) : equal(['SPY']);
      }
      case 'trend': {
        const t = top1();
        if (!t) return null;
        let sum = 0;
        for (let k = i - 9; k <= i; k++) {
          const p = k >= 0 ? price('SPY', k) : null;
          if (p === null) {
            warn(`SPY's 10-month average could not be worked out at the ${check} check, so cash was held.`);
            return { [CASH]: 1 };
          }
          sum += p;
        }
        return price('SPY', i)! > sum / 10 ? equal([t]) : { [CASH]: 1 };
      }
    }
  };

  const units: Record<string, number> = {};
  const lastKnown: Record<string, number> = {};
  let cash = 0;
  let weights: Weights = {};
  let contributed = 0;
  let index = 1;
  const deposits: number[] = [];
  const points: Point[] = [];
  const rotations: Rotation[] = [];
  const timeline: Segment[] = [];

  const valueAt = (i: number) => {
    let v = cash;
    for (const [t, u] of Object.entries(units)) {
      const p = price(t, i);
      if (p !== null) lastKnown[t] = p;
      else warn(`${t} has no price for ${monthly.dates[i]}; its last known price was used to value the holding.`);
      v += u * (lastKnown[t] ?? 0);
    }
    return v;
  };

  let prevAfter = 0;
  for (let i = s; i <= e; i++) {
    const before = valueAt(i);
    if (i > s && prevAfter > 0) index *= before / prevAfter;
    if (i === e) {
      points.push({ date: monthly.dates[i], value: before, contributed, index });
      break;
    }

    cash += opts.monthly;
    contributed += opts.monthly;
    deposits.push(opts.monthly);
    const check = nextMonth(monthly.dates[i]);

    let next: Weights | null = null;
    if (i === s || isDecisionMonth(check, opts.cadence)) next = target(i);
    const rotating = next !== null && !sameSet(next, weights);
    const multi = next !== null && Object.keys(next).length > 1;

    if (next !== null && (rotating || multi)) {
      const held = Object.keys(units);
      let rotation: Rotation | null = null;
      if (rotating && i > s) {
        rotation = { date: check, from: label(weights), to: label(next) };
        rotations.push(rotation);
      }

      // Worst-case execution: only on a one-for-one rotation, and only the money
      // being rotated. This month's deposit still buys at the month-end close.
      let done = false;
      const wasCash = held.length === 0 && Object.keys(weights)[0] === CASH;
      const oneForOne = (held.length === 1 || wasCash) && Object.keys(next).length === 1;
      if (opts.worstCase && rotation && oneForOne) {
        const out = wasCash ? CASH : held[0];
        const into = Object.keys(next)[0];
        const day = daily ? worstDay(daily, check, out, into) : null;
        if (!daily || !day) {
          warn(`No daily prices for the ${check} rotation (${out} to ${into}); it was executed at the month-end close instead.`);
        } else {
          const j = day.j;
          const deposit = opts.monthly;
          const rotatedCash = cash - deposit;
          // Sell the outgoing holding at that day's low; buy the incoming at its high.
          const sold = out === CASH ? rotatedCash : rotatedCash + units[out] * daily.series[out].l[j]!;
          for (const t of held) delete units[t];
          if (into === CASH) {
            cash = sold + deposit;
          } else {
            const p = price(into, i)!;
            units[into] = sold / daily.series[into].h[j]! + deposit / p;
            cash = 0;
          }
          rotation.worstDay = daily.dates[j];
          done = true;
        }
      }

      if (!done) {
        const total = valueAt(i);
        for (const t of held) delete units[t];
        cash = 0;
        for (const [t, w] of Object.entries(next)) {
          if (t === CASH) cash += total * w;
          else units[t] = (total * w) / price(t, i)!;
        }
      }
      weights = next;
    } else {
      // No change: this month's deposit buys more of what is already held.
      const spend = cash;
      for (const [t, w] of Object.entries(weights)) {
        if (t === CASH) continue;
        const p = price(t, i);
        if (p === null) {
          warn(`${t} has no price for ${monthly.dates[i]}; that month's deposit was kept as cash until the next purchase.`);
          continue;
        }
        units[t] = (units[t] ?? 0) + (spend * w) / p;
        cash -= spend * w;
      }
    }

    const text = label(weights);
    const lastSeg = timeline[timeline.length - 1];
    if (lastSeg && lastSeg.label === text) lastSeg.end = check;
    else timeline.push({ start: check, end: check, label: text });

    const after = valueAt(i);
    // With worst-case execution the cost shows up next month: the units bought
    // on the worst day are fewer than the month-end close would have bought.
    prevAfter = after;
    points.push({ date: monthly.dates[i], value: after, contributed, index });
  }

  for (const p of points) {
    if (!Number.isFinite(p.value) || !Number.isFinite(p.index)) {
      return { ok: false, reason: `The calculation produced an invalid number at ${p.date}. This is a bug; no results are shown.` };
    }
  }
  return { ok: true, points, metrics: metricsFrom(points, deposits, rotations.length), rotations, timeline, warnings };
}

export interface DipResult {
  ok: true;
  dca: { finalValue: number; contributed: number; irr: number | null };
  dip: { finalValue: number; contributed: number; irr: number | null; buys: number; cashLeft: number };
}

/**
 * Dip-buying against plain monthly investing in one asset. Both receive the
 * same deposit on the first trading day of each month. Plain DCA invests it
 * that day. The dip buyer holds it as cash (earning nothing) and invests
 * everything on any day the close is between `minDrop` and `maxDrop` below the
 * highest close of the previous 252 trading days.
 */
export function dipBuying(
  daily: Daily,
  ticker: string,
  start: string,
  end: string,
  monthlyAmount: number,
  minDrop = 0.03,
  maxDrop = 0.05,
): DipResult | { ok: false; reason: string } {
  const s = daily.series[ticker];
  if (!s) return { ok: false, reason: `No daily prices for ${ticker}.` };
  let dcaUnits = 0;
  let dipUnits = 0;
  let dipCash = 0;
  let buys = 0;
  let contributed = 0;
  let lastMonth = '';
  let lastClose: number | null = null;
  const deposits: number[] = [];
  for (let j = 0; j < daily.dates.length; j++) {
    const month = daily.dates[j].slice(0, 7);
    if (month < start) continue;
    if (month > end) break;
    const c = s.c[j];
    if (c == null || c <= 0) continue; // no trade on a day without a price
    lastClose = c;
    if (month !== lastMonth) {
      lastMonth = month;
      contributed += monthlyAmount;
      deposits.push(monthlyAmount);
      dcaUnits += monthlyAmount / c;
      dipCash += monthlyAmount;
    }
    let high = 0;
    for (let k = Math.max(0, j - 252); k < j; k++) {
      const p = s.c[k];
      if (p != null && p > high) high = p;
    }
    if (high > 0 && dipCash > 0) {
      const drop = 1 - c / high;
      if (drop >= minDrop && drop <= maxDrop) {
        dipUnits += dipCash / c;
        dipCash = 0;
        buys++;
      }
    }
  }
  if (lastClose === null || deposits.length < 2) return { ok: false, reason: `Not enough daily prices for ${ticker} in this period.` };
  const dcaFinal = dcaUnits * lastClose;
  const dipFinal = dipUnits * lastClose + dipCash;
  return {
    ok: true,
    dca: { finalValue: dcaFinal, contributed, irr: irrMonthlyDeposits(deposits, dcaFinal) },
    dip: { finalValue: dipFinal, contributed, irr: irrMonthlyDeposits(deposits, dipFinal), buys, cashLeft: dipCash },
  };
}
