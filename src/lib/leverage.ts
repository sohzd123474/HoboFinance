// Daily-reset leverage, worked out from real daily closes.

export interface Path {
  dates: string[];
  /** Growth of 1 invested on the first date. */
  values: number[];
}

export interface PathStats {
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  volatility: number;
  years: number;
}

/** Growth of 1 in an asset between two dates (inclusive), skipping days without a price. */
export function assetPath(dates: string[], closes: (number | null)[], start: string, end: string): Path | null {
  const out: Path = { dates: [], values: [] };
  let first: number | null = null;
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] < start || dates[i] > end) continue;
    const c = closes[i];
    if (c == null || c <= 0) continue;
    if (first === null) first = c;
    out.dates.push(dates[i]);
    out.values.push(c / first);
  }
  return out.dates.length >= 2 ? out : null;
}

/**
 * A product that delivers `leverage` times the index's return each day, less a
 * yearly cost charged daily. A day's loss is capped at 100%: once the value
 * reaches zero it stays there.
 */
export function leveragedPath(index: Path, leverage: number, yearlyCostPct: number): Path {
  const daily = yearlyCostPct / 100 / 252;
  const values = [1];
  for (let i = 1; i < index.values.length; i++) {
    const r = index.values[i] / index.values[i - 1] - 1;
    const prev = values[i - 1];
    values.push(prev <= 0 ? 0 : Math.max(0, prev * (1 + leverage * r - daily)));
  }
  return { dates: index.dates, values };
}

export function pathStats(path: Path): PathStats {
  const n = path.values.length;
  const years = (Date.parse(path.dates[n - 1]) - Date.parse(path.dates[0])) / (365.25 * 24 * 3600 * 1000);
  const end = path.values[n - 1];
  let peak = path.values[0];
  let maxDrawdown = 0;
  const returns: number[] = [];
  for (let i = 1; i < n; i++) {
    if (path.values[i - 1] > 0) returns.push(path.values[i] / path.values[i - 1] - 1);
    peak = Math.max(peak, path.values[i]);
    if (peak > 0) maxDrawdown = Math.min(maxDrawdown, path.values[i] / peak - 1);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / Math.max(1, returns.length);
  const variance = returns.length > 1 ? returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1) : 0;
  return {
    totalReturn: end - 1,
    cagr: years > 0 && end > 0 ? Math.pow(end, 1 / years) - 1 : -1,
    maxDrawdown,
    volatility: Math.sqrt(variance) * Math.sqrt(252),
    years,
  };
}
