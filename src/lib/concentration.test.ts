import { describe, expect, it } from 'vitest';
import type { Constituent } from '../data/sp500-top';
import { SP500_TOP } from '../data/sp500-top';
import {
  applyDca,
  effectiveHoldings,
  findConstituent,
  hhi,
  lookThrough,
  parseHoldings,
  redundantDca,
  summarisePositions,
  verdict,
  type FundConfig,
} from './concentration';

// A tiny made-up index so the arithmetic can be checked by hand.
const INDEX: Constituent[] = [
  { ticker: 'AAA', aliases: ['AAB'], name: 'Alpha', weight: 10 },
  { ticker: 'BBB', aliases: [], name: 'Beta', weight: 5 },
];
const cfg: FundConfig = { spFunds: ['FUND'], worldFunds: { WORLD: 60 }, constituents: INDEX };

describe('parseHoldings', () => {
  it('reads plain "TICKER value" lines', () => {
    expect(parseHoldings('CSPX 30000\nAAPL 5000').rows).toEqual([
      { ticker: 'CSPX', value: 30000 },
      { ticker: 'AAPL', value: 5000 },
    ]);
  });

  it('tolerates commas, tabs, currency symbols and thousands separators', () => {
    const r = parseHoldings(['aapl, 5,000', 'NVDA\t4000', 'D05  S$6,000.50', 'VWRA: US$ 1,234,567', 'CSPX,30000', 'MSFT = 250 USD'].join('\n'));
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { ticker: 'AAPL', value: 5000 },
      { ticker: 'NVDA', value: 4000 },
      { ticker: 'D05', value: 6000.5 },
      { ticker: 'VWRA', value: 1234567 },
      { ticker: 'CSPX', value: 30000 },
      { ticker: 'MSFT', value: 250 },
    ]);
  });

  it('skips blank lines and adds repeated tickers together', () => {
    const r = parseHoldings('AAPL 100\n\n  \naapl 50\r\n');
    expect(r.rows).toEqual([{ ticker: 'AAPL', value: 150 }]);
    expect(r.errors).toEqual([]);
  });

  it('lists lines it cannot read, with the line number and a reason', () => {
    const r = parseHoldings('AAPL 100\nMSFT\n5000 NVDA\nTSLA abc\nMETA -5\nAMZN 0\nGOOG 1,23');
    expect(r.rows).toEqual([{ ticker: 'AAPL', value: 100 }]);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(r.errors[0].reason).toMatch(/ticker and a value/);
    expect(r.errors[1].reason).toMatch(/does not look like a ticker/);
    expect(r.errors[2].reason).toMatch(/could not be read as a number/);
    expect(r.errors[3].reason).toMatch(/more than zero/);
    expect(r.errors[4].reason).toMatch(/more than zero/);
    expect(r.errors[5].reason).toMatch(/could not be read as a number/);
    expect(r.errors[1].text).toBe('5000 NVDA');
  });
});

describe('hhi', () => {
  it('is 1/n for n equal holdings', () => {
    for (const n of [1, 2, 4, 10]) {
      const h = hhi(Array(n).fill(250));
      expect(h).toBeCloseTo(1 / n, 12);
      expect(effectiveHoldings(h)).toBeCloseTo(n, 9);
    }
  });

  it('is the sum of squared shares for a 50/30/20 split', () => {
    expect(hhi([50, 30, 20])).toBeCloseTo(0.25 + 0.09 + 0.04, 12);
  });

  it('is null for an empty portfolio', () => {
    expect(hhi([])).toBeNull();
    expect(effectiveHoldings(null)).toBeNull();
  });
});

describe('summarisePositions', () => {
  it('gives each share, the top position and the top three', () => {
    const s = summarisePositions([
      { ticker: 'A', value: 10 },
      { ticker: 'B', value: 40 },
      { ticker: 'C', value: 30 },
      { ticker: 'D', value: 20 },
    ]);
    expect(s.total).toBe(100);
    expect(s.positions.map((p) => p.ticker)).toEqual(['B', 'C', 'D', 'A']);
    expect(s.top1).toBeCloseTo(0.4, 12);
    expect(s.top3).toBeCloseTo(0.9, 12);
  });
});

describe('applyDca', () => {
  it('adds twelve months of purchases, including new tickers', () => {
    const after = applyDca([{ ticker: 'A', value: 1000 }], [{ ticker: 'A', value: 100 }, { ticker: 'B', value: 50 }], 12);
    expect(after).toEqual([
      { ticker: 'A', value: 2200 },
      { ticker: 'B', value: 600 },
    ]);
  });
});

describe('lookThrough', () => {
  it('adds direct holdings to the share held through an index fund', () => {
    // 10,000 in the fund: 1,000 Alpha, 500 Beta, 8,500 other. Plus 2,000 Alpha held directly.
    const lt = lookThrough([{ ticker: 'FUND', value: 10000 }, { ticker: 'AAA', value: 2000 }], cfg);
    const alpha = lt.rows.find((r) => r.key === 'AAA')!;
    expect(alpha.direct).toBe(2000);
    expect(alpha.viaFunds).toBeCloseTo(1000, 9);
    expect(alpha.total).toBeCloseTo(3000, 9);
    expect(alpha.share).toBeCloseTo(0.25, 12);
    expect(lt.rows.find((r) => r.key === 'BBB')!.total).toBeCloseTo(500, 9);
    expect(lt.otherUs).toBeCloseTo(8500, 9);
    expect(lt.nonUs).toBe(0);
    expect(lt.rows[0].key).toBe('AAA');
    // HHI of the named rows only: (3000/12000)^2 + (500/12000)^2.
    expect(lt.hhi).toBeCloseTo(0.0625 + (500 / 12000) ** 2, 12);
  });

  it('applies the US share to a world fund', () => {
    // 10,000 at 60% US: 6,000 US, of which 600 Alpha and 300 Beta; 4,000 outside the US.
    const lt = lookThrough([{ ticker: 'WORLD', value: 10000 }], cfg);
    expect(lt.rows.find((r) => r.key === 'AAA')!.viaFunds).toBeCloseTo(600, 9);
    expect(lt.rows.find((r) => r.key === 'BBB')!.viaFunds).toBeCloseTo(300, 9);
    expect(lt.otherUs).toBeCloseTo(5100, 9);
    expect(lt.nonUs).toBeCloseTo(4000, 9);
  });

  it('keeps stocks outside the index as direct-only rows and maps aliases', () => {
    const lt = lookThrough([{ ticker: 'D05', value: 500 }, { ticker: 'AAB', value: 500 }], cfg);
    expect(lt.rows.map((r) => r.key).sort()).toEqual(['AAA', 'D05']);
    expect(lt.hhi).toBeCloseTo(0.5, 12);
  });

  it('accounts for every dollar', () => {
    const lt = lookThrough([{ ticker: 'FUND', value: 700 }, { ticker: 'WORLD', value: 200 }, { ticker: 'ZZZ', value: 100 }], cfg);
    expect(lt.rows.reduce((a, r) => a + r.total, 0) + lt.otherUs + lt.nonUs).toBeCloseTo(1000, 9);
  });
});

describe('real constituent data', () => {
  it('maps both Alphabet tickers to one row', () => {
    expect(findConstituent('GOOG', SP500_TOP)?.ticker).toBe('GOOGL');
    expect(findConstituent('googl', SP500_TOP)?.ticker).toBe('GOOGL');
    expect(findConstituent('BRK-B', SP500_TOP)?.ticker).toBe('BRK.B');
  });

  it('has unique tickers and weights that add up to less than 100%', () => {
    const all = SP500_TOP.flatMap((c) => [c.ticker, ...c.aliases]);
    expect(new Set(all).size).toBe(all.length);
    const sum = SP500_TOP.reduce((a, c) => a + c.weight, 0);
    expect(sum).toBeGreaterThan(30);
    expect(sum).toBeLessThan(100);
  });
});

describe('verdict', () => {
  it('compares the index before and after', () => {
    expect(verdict(0.1, 0.12)).toBe('increases');
    expect(verdict(0.1, 0.08)).toBe('reduces');
    expect(verdict(0.1, 0.1005)).toBe('barely changes');
    expect(verdict(null, 0.1)).toBeNull();
  });
});

describe('redundantDca', () => {
  it('flags a top constituent bought directly while an index fund is held', () => {
    const r = redundantDca([{ ticker: 'FUND', value: 10000 }], [{ ticker: 'AAB', value: 100 }, { ticker: 'ZZZ', value: 100 }, { ticker: 'FUND', value: 500 }], cfg);
    expect(r).toHaveLength(1);
    expect(r[0].ticker).toBe('AAB');
    expect(r[0].funds).toEqual([{ fund: 'FUND', weightInFund: 0.1, valueNow: 1000 }]);
    expect(r[0].viaFundsNow).toBe(1000);
  });

  it('flags nothing when no fund is held or bought', () => {
    expect(redundantDca([{ ticker: 'ZZZ', value: 1 }], [{ ticker: 'AAA', value: 100 }], cfg)).toEqual([]);
  });
});
