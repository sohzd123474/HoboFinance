// The 25 largest holdings of the SPDR S&P 500 ETF Trust (SPY), used as a
// stand-in for S&P 500 index weights. Weights drift every trading day.
//
// Sources (read 2026-11-13):
//   https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy
//     (State Street's own page; top 10 holdings as of 11 Nov 2026)
//   https://stockanalysis.com/etf/spy/holdings/
//     (top 25 holdings as of 11 Nov 2026; its top 10 match State Street's figures exactly)
//
// Alphabet's two share classes are combined into one row:
//   GOOGL (Class A) 2.62% + GOOG (Class C) 2.10% = 4.72%.

export interface Constituent {
  /** Main ticker, used as the row key. */
  ticker: string;
  /** Other tickers and spellings that mean the same company. */
  aliases: string[];
  name: string;
  /** Weight in the index, in percent. */
  weight: number;
}

export const SP500_TOP_AS_OF = '2026-11-11';

export const SP500_TOP_SOURCES = [
  { label: 'State Street SPY holdings', url: 'https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy' },
  { label: 'Stock Analysis SPY holdings', url: 'https://stockanalysis.com/etf/spy/holdings/' },
];

export const SP500_TOP: Constituent[] = [
  { ticker: 'AAPL', aliases: [], name: 'Apple', weight: 7.89 },
  { ticker: 'NVDA', aliases: [], name: 'Nvidia', weight: 6.39 },
  { ticker: 'MSFT', aliases: [], name: 'Microsoft', weight: 5.89 },
  { ticker: 'GOOGL', aliases: ['GOOG'], name: 'Alphabet (both share classes)', weight: 4.72 },
  { ticker: 'AMZN', aliases: [], name: 'Amazon', weight: 3.97 },
  { ticker: 'AVGO', aliases: [], name: 'Broadcom', weight: 2.5 },
  { ticker: 'META', aliases: [], name: 'Meta Platforms', weight: 2.11 },
  { ticker: 'LLY', aliases: [], name: 'Eli Lilly', weight: 1.75 },
  { ticker: 'TSLA', aliases: [], name: 'Tesla', weight: 1.68 },
  { ticker: 'BRK.B', aliases: ['BRK-B', 'BRKB', 'BRK/B', 'BRK.A', 'BRK-A'], name: 'Berkshire Hathaway', weight: 1.67 },
  { ticker: 'MU', aliases: [], name: 'Micron Technology', weight: 1.39 },
  { ticker: 'JPM', aliases: [], name: 'JPMorgan Chase', weight: 1.39 },
  { ticker: 'AMD', aliases: [], name: 'Advanced Micro Devices', weight: 1.37 },
  { ticker: 'V', aliases: [], name: 'Visa', weight: 1.1 },
  { ticker: 'XOM', aliases: [], name: 'Exxon Mobil', weight: 1.04 },
  { ticker: 'JNJ', aliases: [], name: 'Johnson & Johnson', weight: 1.03 },
  { ticker: 'WMT', aliases: [], name: 'Walmart', weight: 0.85 },
  { ticker: 'MA', aliases: [], name: 'Mastercard', weight: 0.81 },
  { ticker: 'ABBV', aliases: [], name: 'AbbVie', weight: 0.79 },
  { ticker: 'COST', aliases: [], name: 'Costco', weight: 0.73 },
  { ticker: 'CVX', aliases: [], name: 'Chevron', weight: 0.64 },
  { ticker: 'CSCO', aliases: [], name: 'Cisco', weight: 0.6 },
  { ticker: 'PLTR', aliases: [], name: 'Palantir', weight: 0.6 },
  { ticker: 'PG', aliases: [], name: 'Procter & Gamble', weight: 0.59 },
];

// Funds the page pre-ticks.
export const SP500_FUNDS = ['CSPX', 'VOO', 'SPY', 'SPYL', 'IVV', 'VUAA'];

// US share of each world fund, in percent.
//   VWRA 62.24% at 30 Sep 2026 — Vanguard product page:
//     https://www.ch.vanguard/en/professional/product/etf/equity/9679/ftse-all-world-ucits-etf-usd-accumulating
//   VT 61.97% at 31 Aug 2026 — Vanguard product page, as quoted in a web search result; not opened directly:
//     https://www.vanguardsouthamerica.com/en/product/etf/equity/3141/vanguard-total-world-stock-etf
//   IWDA 72.77% — this is the MSCI World index weight at 30 Oct 2026 from an MSCI factsheet
//     (https://www.msci.com/documents/10199/255599/msci-world-index-cad-net.pdf), as quoted in a web search
//     result. iShares' own fund page could not be read, so the fund's figure is unverified.
export interface WorldFund {
  ticker: string;
  usSharePct: number;
  asOf: string;
  source: string;
  url: string;
  verified: boolean;
}

export const WORLD_FUNDS: WorldFund[] = [
  {
    ticker: 'VWRA',
    usSharePct: 62.24,
    asOf: '2026-09-30',
    source: 'Vanguard product page',
    url: 'https://www.ch.vanguard/en/professional/product/etf/equity/9679/ftse-all-world-ucits-etf-usd-accumulating',
    verified: true,
  },
  {
    ticker: 'IWDA',
    usSharePct: 72.77,
    asOf: '2026-10-30',
    source: 'MSCI World index factsheet (the index IWDA tracks, not the fund itself)',
    url: 'https://www.msci.com/documents/10199/255599/msci-world-index-cad-net.pdf',
    verified: false,
  },
  {
    ticker: 'VT',
    usSharePct: 61.97,
    asOf: '2026-08-31',
    source: 'Vanguard product page, read through a search result only',
    url: 'https://www.vanguardsouthamerica.com/en/product/etf/equity/3141/vanguard-total-world-stock-etf',
    verified: false,
  },
];

/** Used for a world fund the user ticks that is not in the list above. */
export const DEFAULT_US_SHARE_PCT = 62.24;
