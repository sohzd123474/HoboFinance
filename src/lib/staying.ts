// Two "staying invested" studies worked out from the site's own price data:
// falls within each calendar year, and lump sum against spreading money out.

export interface YearStat {
  year: string;
  /** Largest fall from a high to a later low inside the year (negative). */
  maxDrawdown: number;
  /** Return from the previous year's last close (or the year's first close) to the year's last close. */
  yearReturn: number;
  days: number;
}

/** One row per calendar year that has at least `minDays` prices. */
export function yearStats(dates: string[], closes: (number | null)[], minDays = 200): YearStat[] {
  const out: YearStat[] = [];
  let year = '';
  let peak = 0;
  let worst = 0;
  let first = 0;
  let last = 0;
  let days = 0;
  let prevClose: number | null = null;
  let base: number | null = null;
  const flush = () => {
    if (year && days >= minDays) out.push({ year, maxDrawdown: worst, yearReturn: last / (base ?? first) - 1, days });
  };
  for (let i = 0; i < dates.length; i++) {
    const c = closes[i];
    if (c == null || c <= 0) continue;
    const y = dates[i].slice(0, 4);
    if (y !== year) {
      flush();
      year = y;
      base = prevClose;
      first = c;
      peak = c;
      worst = 0;
      days = 0;
    }
    peak = Math.max(peak, c);
    worst = Math.min(worst, c / peak - 1);
    last = c;
    prevClose = c;
    days++;
  }
  flush();
  return out;
}

export interface FallSummary {
  years: number;
  /** Years whose worst fall was at least the threshold. */
  scary: number;
  /** Of those, years that still ended higher than they began. */
  endedUp: number;
  medianDrawdown: number;
}

export function fallSummary(stats: YearStat[], thresholdPct: number): FallSummary {
  const scary = stats.filter((s) => s.maxDrawdown <= -thresholdPct / 100);
  return {
    years: stats.length,
    scary: scary.length,
    endedUp: scary.filter((s) => s.yearReturn > 0).length,
    medianDrawdown: median(stats.map((s) => s.maxDrawdown)),
  };
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface LumpResult {
  windows: number;
  /** Share of starting months in which the lump sum ended ahead. */
  lumpWins: number;
  /** Average yearly return across all starting months. */
  meanLump: number;
  meanSpread: number;
  /** Middle value of (lump sum minus spread out), each pair sharing a starting month. */
  medianGap: number;
}

/**
 * Invest 1 at once, or in equal parts over `spreadMonths` months, then hold
 * until `holdMonths` after the start. Money waiting to be invested earns
 * `cashRatePct` a year. Every month in the data that leaves room for a full
 * holding period is used as a start. Returns are annualised.
 */
export function lumpVsSpread(prices: (number | null)[], spreadMonths: number, holdMonths: number, cashRatePct: number): LumpResult | null {
  const rc = Math.pow(1 + cashRatePct / 100, 1 / 12) - 1;
  const lump: number[] = [];
  const spread: number[] = [];
  let wins = 0;
  for (let i = 0; i + holdMonths < prices.length; i++) {
    const end = prices[i + holdMonths];
    const start = prices[i];
    if (start == null || end == null) continue;
    let units = 0;
    let ok = true;
    for (let k = 0; k < spreadMonths; k++) {
      const pk = prices[i + k];
      if (pk == null) {
        ok = false;
        break;
      }
      units += (Math.pow(1 + rc, k) / spreadMonths) / pk;
    }
    if (!ok) continue;
    const a = end / start;
    const b = units * end;
    lump.push(Math.pow(a, 12 / holdMonths) - 1);
    spread.push(Math.pow(b, 12 / holdMonths) - 1);
    if (a > b) wins++;
  }
  if (lump.length === 0) return null;
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  return {
    windows: lump.length,
    lumpWins: wins / lump.length,
    meanLump: mean(lump),
    meanSpread: mean(spread),
    medianGap: median(lump.map((x, i) => x - spread[i])),
  };
}
