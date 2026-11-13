// Pure maths for the DCA and concentration checker. No DOM, no formatting.

import type { Constituent } from '../data/sp500-top';

export interface Holding {
  ticker: string;
  value: number;
}

export interface ParseError {
  /** 1-based line number in the pasted text. */
  line: number;
  text: string;
  reason: string;
}

export interface ParseResult {
  rows: Holding[];
  errors: ParseError[];
}

const CURRENCY = /(US\$|S\$|SGD|USD|\$|£|€)/gi;

/**
 * Read "TICKER value" lines. Accepts spaces, tabs, commas, colons, semicolons
 * or "=" between the two, currency symbols, and thousands separators.
 * Lines that cannot be read are returned with a reason, never dropped.
 * The same ticker on several lines is added together.
 */
export function parseHoldings(text: string): ParseResult {
  const errors: ParseError[] = [];
  const totals = new Map<string, number>();
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === '') return;
    const fail = (reason: string) => errors.push({ line: i + 1, text: line, reason });
    const m = line.match(/^([^\s,;:=]+)[\s,;:=]+(.+)$/);
    if (!m) return fail('Needs a ticker and a value, for example AAPL 5000.');
    const ticker = m[1].toUpperCase();
    if (!/^[A-Z][A-Z0-9.\-/]{0,11}$/.test(ticker)) {
      return fail(`“${m[1]}” does not look like a ticker. Put the ticker first, then the value.`);
    }
    const cleaned = m[2].replace(CURRENCY, '').replace(/[\s;:=]/g, '').replace(/^,+|,+$/g, '');
    if (/^-/.test(cleaned)) return fail('The value must be more than zero.');
    if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(cleaned)) {
      return fail(`“${m[2].trim()}” could not be read as a number. Write it like 5000 or 5,000.50.`);
    }
    const value = parseFloat(cleaned.replace(/,/g, ''));
    if (!(value > 0)) return fail('The value must be more than zero.');
    totals.set(ticker, (totals.get(ticker) ?? 0) + value);
  });
  return { rows: [...totals].map(([ticker, value]) => ({ ticker, value })), errors };
}

/** Sum of squared shares. `total` defaults to the sum of the values. */
export function hhi(values: number[], total = values.reduce((a, b) => a + b, 0)): number | null {
  if (!(total > 0)) return null;
  return values.reduce((a, v) => a + (v / total) * (v / total), 0);
}

/** Effective number of holdings: 1 / HHI. */
export const effectiveHoldings = (h: number | null): number | null => (h === null || h <= 0 ? null : 1 / h);

export interface Position extends Holding {
  share: number;
}

export interface PositionSummary {
  total: number;
  positions: Position[];
  /** Share of the largest position, and of the largest three together. Null when empty. */
  top1: number | null;
  top3: number | null;
}

export function summarisePositions(holdings: Holding[]): PositionSummary {
  const total = holdings.reduce((a, h) => a + h.value, 0);
  const positions = holdings
    .map((h) => ({ ...h, share: total > 0 ? h.value / total : 0 }))
    .sort((a, b) => b.value - a.value);
  const top = (n: number) => (positions.length === 0 ? null : positions.slice(0, n).reduce((a, p) => a + p.share, 0));
  return { total, positions, top1: top(1), top3: top(3) };
}

/** Holdings after `months` of the monthly plan, at unchanged prices. */
export function applyDca(holdings: Holding[], monthly: Holding[], months: number): Holding[] {
  const totals = new Map(holdings.map((h) => [h.ticker, h.value]));
  for (const d of monthly) totals.set(d.ticker, (totals.get(d.ticker) ?? 0) + d.value * months);
  return [...totals].map(([ticker, value]) => ({ ticker, value }));
}

export interface FundConfig {
  /** Tickers treated as S&P 500 index funds. */
  spFunds: string[];
  /** Tickers treated as world funds, with the US share of each in percent. */
  worldFunds: Record<string, number>;
  constituents: Constituent[];
}

export function findConstituent(ticker: string, constituents: Constituent[]): Constituent | undefined {
  const t = ticker.toUpperCase();
  return constituents.find((c) => c.ticker === t || c.aliases.includes(t));
}

/** Share of a fund (0 to 1) that is treated as tracking the S&P 500. Null if the ticker is not a fund. */
export function fundUsShare(ticker: string, cfg: FundConfig): number | null {
  if (cfg.spFunds.includes(ticker)) return 1;
  if (ticker in cfg.worldFunds) return Math.min(100, Math.max(0, cfg.worldFunds[ticker])) / 100;
  return null;
}

export interface Exposure {
  key: string;
  label: string;
  direct: number;
  viaFunds: number;
  total: number;
  /** Share of the whole portfolio. */
  share: number;
}

export interface LookThrough {
  total: number;
  /** One row per company, largest first. */
  rows: Exposure[];
  /** Fund money in US companies outside the listed constituents. */
  otherUs: number;
  /** World-fund money outside the US. */
  nonUs: number;
  /** Sum of squared shares of the rows. The two remainders above are left out. */
  hhi: number | null;
}

/**
 * Spread each fund across the listed constituents by weight and add direct
 * holdings. A world fund's US part is assumed to be weighted like the S&P 500.
 */
export function lookThrough(holdings: Holding[], cfg: FundConfig): LookThrough {
  const total = holdings.reduce((a, h) => a + h.value, 0);
  const map = new Map<string, { label: string; direct: number; viaFunds: number }>();
  const row = (key: string, label: string) => {
    let r = map.get(key);
    if (!r) map.set(key, (r = { label, direct: 0, viaFunds: 0 }));
    return r;
  };
  const listed = cfg.constituents.reduce((a, c) => a + c.weight, 0) / 100;
  let otherUs = 0;
  let nonUs = 0;
  for (const h of holdings) {
    const us = fundUsShare(h.ticker, cfg);
    if (us === null) {
      const c = findConstituent(h.ticker, cfg.constituents);
      row(c ? c.ticker : h.ticker, c ? c.name : h.ticker).direct += h.value;
      continue;
    }
    const usValue = h.value * us;
    for (const c of cfg.constituents) row(c.ticker, c.name).viaFunds += (usValue * c.weight) / 100;
    otherUs += usValue * (1 - listed);
    nonUs += h.value - usValue;
  }
  const rows = [...map]
    .map(([key, r]) => ({ key, ...r, total: r.direct + r.viaFunds, share: total > 0 ? (r.direct + r.viaFunds) / total : 0 }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  return { total, rows, otherUs, nonUs, hhi: hhi(rows.map((r) => r.total), total) };
}

export type Verdict = 'increases' | 'reduces' | 'barely changes';

/** A change in HHI smaller than this fraction of the starting HHI counts as no change. */
export const VERDICT_THRESHOLD = 0.02;

export function verdict(before: number | null, after: number | null): Verdict | null {
  if (before === null || after === null || before <= 0) return null;
  const change = (after - before) / before;
  if (Math.abs(change) < VERDICT_THRESHOLD) return 'barely changes';
  return change > 0 ? 'increases' : 'reduces';
}

export interface Redundancy {
  ticker: string;
  name: string;
  monthly: number;
  /** Funds the user holds or buys that already contain this company. */
  funds: { fund: string; weightInFund: number; valueNow: number }[];
  /** Value of this company held through funds today. */
  viaFundsNow: number;
}

/**
 * Single stocks in the monthly plan that are listed constituents and are
 * already bought through a fund the user holds or is buying.
 */
export function redundantDca(holdings: Holding[], monthly: Holding[], cfg: FundConfig): Redundancy[] {
  const fundTickers = [...new Set([...holdings, ...monthly].map((h) => h.ticker))].filter((t) => fundUsShare(t, cfg) !== null);
  const out: Redundancy[] = [];
  for (const d of monthly) {
    if (fundUsShare(d.ticker, cfg) !== null) continue;
    const c = findConstituent(d.ticker, cfg.constituents);
    if (!c || fundTickers.length === 0) continue;
    const funds = fundTickers.map((fund) => {
      const weightInFund = ((fundUsShare(fund, cfg) ?? 0) * c.weight) / 100;
      const held = holdings.find((h) => h.ticker === fund)?.value ?? 0;
      return { fund, weightInFund, valueNow: held * weightInFund };
    });
    out.push({ ticker: d.ticker, name: c.name, monthly: d.value, funds, viaFundsNow: funds.reduce((a, f) => a + f.valueNow, 0) });
  }
  return out;
}
