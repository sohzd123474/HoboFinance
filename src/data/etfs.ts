// Fund facts for the ETF tax-drag calculator. Every figure here was read on
// RESEARCHED_ON from the URL beside it. Rates are fractions (0.0003 = 0.03%).
// Rows marked verified: false could not be read from the issuer's own page
// (see the note on each); the page shows an "unverified" marker for them.

export const RESEARCHED_ON = '2026-11-13';

/** US tax withheld on dividends paid to a Singapore resident by a US-domiciled fund.
 *  Singapore has no income tax treaty with the US, so the full statutory rate applies. */
export const US_WITHHOLDING_NO_TREATY = 0.3;
/** US tax withheld on dividends US companies pay to an Irish-domiciled fund (US–Ireland treaty). */
export const US_WITHHOLDING_IRISH_FUND = 0.15;

export type Domicile = 'US' | 'IE';

export interface Etf {
  ticker: string;
  name: string;
  domicile: Domicile;
  /** Yearly fund fee as a fraction of assets. */
  expenseRatio: number;
  distribution: 'accumulating' | 'distributing';
  /** Share of the fund held in US companies; null when not sourced. */
  usWeight: number | null;
  /** Share of dividends lost to US withholding tax for a Singapore resident. */
  withholding: number;
  withholdingNote: string;
  /** Yearly dividend yield before tax; null when no sourced figure was found. */
  dividendYield: number | null;
  yieldNote: string;
  sourceUrl: string;
  asOf: string;
  verified: boolean;
  note?: string;
}

// US weights used for the part-US funds.
// VWRA: 62.24% United States at 30 Sep 2026 — https://www.vanguard.co.uk/professional/product/etf/equity/9679/ftse-all-world-ucits-etf-usd-accumulating
const VWRA_US_WEIGHT = 0.6224;
// IWDA: 70.81% United States at 30 Sep 2026 — https://www.justetf.com/en/etf-profile.html?isin=IE00B4L5Y983 (not the issuer)
const IWDA_US_WEIGHT = 0.7081;

// S&P 500 yield: SPY "fund distribution yield" 1.00% at 11 Nov 2026 —
// https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy
// Reused for the other S&P 500 funds because they hold the same index.
const SP500_YIELD = 0.01;
const SP500_YIELD_NOTE = 'SPY distribution yield at 11 Nov 2026 (State Street); same index';
const NO_YIELD = 'no sourced figure found; enter your own';

const US_NOTE = '30% withheld on every distribution; Singapore has no tax treaty with the US';
const IE_SP500_NOTE = '15% withheld inside the fund on US dividends under the US–Ireland treaty';

export const ETFS: Etf[] = [
  {
    ticker: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    domicile: 'US',
    // Gross expense ratio 0.0945% — https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy
    expenseRatio: 0.000945,
    distribution: 'distributing',
    usWeight: 1,
    withholding: US_WITHHOLDING_NO_TREATY,
    withholdingNote: US_NOTE,
    dividendYield: SP500_YIELD,
    yieldNote: 'Fund distribution yield at 11 Nov 2026 (State Street)',
    sourceUrl: 'https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy',
    asOf: '2026-11-12',
    verified: true,
  },
  {
    ticker: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    domicile: 'US',
    // 0.03% — Vanguard fact sheet dated 30 Sep 2026: https://workplace.vanguard.com/iippdf/pdfs/FS0968R.pdf
    // The PDF and investor.vanguard.com could not be read directly; the figure comes from a
    // search summary of that fact sheet and matches Schwab's fund page.
    expenseRatio: 0.0003,
    distribution: 'distributing',
    usWeight: 1,
    withholding: US_WITHHOLDING_NO_TREATY,
    withholdingNote: US_NOTE,
    dividendYield: SP500_YIELD,
    yieldNote: SP500_YIELD_NOTE,
    sourceUrl: 'https://investor.vanguard.com/investment-products/etfs/profile/voo',
    asOf: '2026-09-30',
    verified: false,
    note: 'Vanguard’s page did not load for checking; 0.03% is from a search summary of Vanguard’s 30 Sep 2026 fact sheet.',
  },
  {
    ticker: 'QQQ',
    name: 'Invesco QQQ Trust',
    domicile: 'US',
    // "Invesco QQQ's total expense ratio is 0.18%" (cut from 0.20% in Dec 2025) —
    // https://www.invesco.com/us/financial-products/etfs/product-detail?audienceType=Investor&ticker=QQQ
    expenseRatio: 0.0018,
    distribution: 'distributing',
    usWeight: null,
    withholding: US_WITHHOLDING_NO_TREATY,
    withholdingNote: US_NOTE,
    dividendYield: null,
    yieldNote: NO_YIELD,
    sourceUrl: 'https://www.invesco.com/us/financial-products/etfs/product-detail?audienceType=Investor&ticker=QQQ',
    asOf: '2026-06-30',
    verified: true,
  },
  {
    ticker: 'CSPX',
    name: 'iShares Core S&P 500 UCITS ETF USD (Acc)',
    domicile: 'IE',
    // TER 0.07% — read on https://www.justetf.com/en/etf-profile.html?isin=IE00B5BMR087 ;
    // the iShares product page was cut off before its key facts section.
    expenseRatio: 0.0007,
    distribution: 'accumulating',
    usWeight: 1,
    withholding: US_WITHHOLDING_IRISH_FUND,
    withholdingNote: IE_SP500_NOTE,
    dividendYield: SP500_YIELD,
    yieldNote: SP500_YIELD_NOTE,
    sourceUrl: 'https://www.ishares.com/uk/individual/en/products/253743/ishares-sp-500-b-ucits-etf-acc-fund',
    asOf: '2026-11-13',
    verified: false,
    note: 'The iShares page did not show its fee table when checked; 0.07% is from justETF.',
  },
  {
    ticker: 'SPYL',
    name: 'State Street SPDR S&P 500 UCITS ETF (Acc)',
    domicile: 'IE',
    // TER 0.03% — https://www.ssga.com/ie/en_gb/intermediary/etfs/state-street-spdr-sp-500-ucits-etf-acc-spyl-gy
    expenseRatio: 0.0003,
    distribution: 'accumulating',
    usWeight: 1,
    withholding: US_WITHHOLDING_IRISH_FUND,
    withholdingNote: IE_SP500_NOTE,
    dividendYield: SP500_YIELD,
    yieldNote: SP500_YIELD_NOTE,
    sourceUrl: 'https://www.ssga.com/ie/en_gb/intermediary/etfs/state-street-spdr-sp-500-ucits-etf-acc-spyl-gy',
    asOf: '2026-11-12',
    verified: true,
  },
  {
    ticker: 'VWRA',
    name: 'Vanguard FTSE All-World UCITS ETF USD (Acc)',
    domicile: 'IE',
    // OCF 0.14% (cut from 0.19% on 28 Jul 2026) —
    // https://www.vanguard.co.uk/professional/product/etf/equity/9679/ftse-all-world-ucits-etf-usd-accumulating
    expenseRatio: 0.0014,
    distribution: 'accumulating',
    usWeight: VWRA_US_WEIGHT,
    withholding: VWRA_US_WEIGHT * US_WITHHOLDING_IRISH_FUND,
    withholdingNote: '15% on the US part only (62.24% of the fund at 30 Sep 2026); tax withheld by other countries is not counted',
    dividendYield: null,
    yieldNote: NO_YIELD,
    sourceUrl: 'https://www.vanguard.co.uk/professional/product/etf/equity/9679/ftse-all-world-ucits-etf-usd-accumulating',
    asOf: '2026-09-30',
    verified: true,
  },
  {
    ticker: 'IWDA',
    name: 'iShares Core MSCI World UCITS ETF USD (Acc)',
    domicile: 'IE',
    // TER 0.20% and US weight 70.81% (30 Sep 2026) — https://www.justetf.com/en/etf-profile.html?isin=IE00B4L5Y983 ;
    // the iShares product page was cut off before its key facts section.
    expenseRatio: 0.002,
    distribution: 'accumulating',
    usWeight: IWDA_US_WEIGHT,
    withholding: IWDA_US_WEIGHT * US_WITHHOLDING_IRISH_FUND,
    withholdingNote: '15% on the US part only (70.81% of the fund at 30 Sep 2026); tax withheld by other countries is not counted',
    dividendYield: null,
    yieldNote: NO_YIELD,
    sourceUrl: 'https://www.ishares.com/uk/individual/en/products/251882/ishares-msci-world-ucits-etf-acc-fund',
    asOf: '2026-11-13',
    verified: false,
    note: 'The iShares page did not show its fee table when checked; 0.20% and the US weight are from justETF.',
  },
  {
    ticker: 'EIMI',
    name: 'iShares Core MSCI EM IMI UCITS ETF USD (Acc)',
    domicile: 'IE',
    // TER 0.18% — read on https://www.justetf.com/en/etf-profile.html?isin=IE00BKM4GZ66 ; a search
    // summary of the iShares page and fact sheet shows the same figure, but the page itself was cut off.
    expenseRatio: 0.0018,
    distribution: 'accumulating',
    // An emerging-markets index holds no US companies, so no US withholding applies.
    usWeight: 0,
    withholding: 0,
    withholdingNote:
      'No US companies, so no US withholding. Emerging-market countries withhold their own tax on dividends; no sourced figure was found, so enter your own estimate',
    dividendYield: null,
    yieldNote: NO_YIELD,
    sourceUrl: 'https://www.ishares.com/uk/individual/en/products/264659/ishares-msci-emerging-markets-imi-ucits-etf',
    asOf: '2026-11-13',
    verified: false,
    note: 'The iShares page did not show its fee table when checked; 0.18% is from justETF. Local dividend tax in emerging markets is not included.',
  },
];

export const etfByTicker = (ticker: string): Etf | undefined => ETFS.find((e) => e.ticker === ticker);

// US estate tax for people who are neither US citizens nor US residents.
// - US$60,000 filing threshold, not indexed for inflation:
//   https://www.irs.gov/businesses/small-businesses-self-employed/estate-tax-for-nonresidents-not-citizens-of-the-united-states
// - "Stock of corporations organized in or under U.S. law" is US-situated; stock of
//   corporations organized outside the US is not:
//   https://www.irs.gov/individuals/international-taxpayers/some-nonresidents-with-us-assets-must-file-estate-tax-returns
//   https://www.irs.gov/instructions/i706na (also gives the US$13,000 unified credit, which shelters US$60,000)
// - Top rate 40% on amounts over US$1,000,000 (Table A, unified rate schedule):
//   https://www.irs.gov/instructions/i706
export const ESTATE_TAX = {
  exemptionUsd: 60_000,
  topRate: 0.4,
  checkedOn: RESEARCHED_ON,
  sources: [
    {
      label: 'IRS: Estate tax for nonresidents not citizens of the United States',
      url: 'https://www.irs.gov/businesses/small-businesses-self-employed/estate-tax-for-nonresidents-not-citizens-of-the-united-states',
    },
    {
      label: 'IRS: Some nonresidents with US assets must file estate tax returns',
      url: 'https://www.irs.gov/individuals/international-taxpayers/some-nonresidents-with-us-assets-must-file-estate-tax-returns',
    },
    { label: 'IRS: Instructions for Form 706-NA', url: 'https://www.irs.gov/instructions/i706na' },
    { label: 'IRS: Instructions for Form 706 (rate table)', url: 'https://www.irs.gov/instructions/i706' },
  ],
};

// CSPX against SPYL. A null value means no figure could be sourced; `why` says why.
export interface Sourced<T> {
  value: T | null;
  why?: string;
  source?: string;
  sourceUrl?: string;
  asOf?: string;
}

export interface FundCompare {
  ticker: string;
  launched: Sourced<string>;
  /** Fund size in millions of euros, both from justETF so the two are like for like. */
  sizeEurM: Sourced<number>;
  /** One quoted bid and offer, to work out a spread. Not an average. */
  quote: Sourced<{ bid: number; offer: number; currency: string; venue: string }>;
}

const JUSTETF_CSPX = 'https://www.justetf.com/en/etf-profile.html?isin=IE00B5BMR087';
const JUSTETF_SPYL = 'https://www.justetf.com/en/etf-profile.html?isin=IE000XZSV718';
const SSGA_SPYL = 'https://www.ssga.com/ie/en_gb/intermediary/etfs/state-street-spdr-sp-500-ucits-etf-acc-spyl-gy';

export const CSPX_VS_SPYL: FundCompare[] = [
  {
    ticker: 'CSPX',
    launched: { value: '2010-05-19', source: 'justETF', sourceUrl: JUSTETF_CSPX, asOf: RESEARCHED_ON },
    // "Fund size EUR 136,881 m"; justETF shows no date for it, so the date is the day it was read.
    sizeEurM: { value: 136_881, source: 'justETF', sourceUrl: JUSTETF_CSPX, asOf: RESEARCHED_ON },
    quote: { value: null, why: 'the iShares page showed no bid and offer when checked, and no other sourced figure was found' },
  },
  {
    ticker: 'SPYL',
    launched: { value: '2023-10-31', source: 'State Street', sourceUrl: SSGA_SPYL, asOf: '2026-11-12' },
    // "Fund size EUR 17,631 m" on justETF. State Street's own page gives share class assets of
    // US$20,036.67M and total fund assets (all share classes) of US$44,989.21M at 12 Nov 2026.
    sizeEurM: { value: 17_631, source: 'justETF', sourceUrl: JUSTETF_SPYL, asOf: RESEARCHED_ON },
    // Bid €17.12, offer €17.13 at 12 Nov 2026 on State Street's page for the Xetra listing.
    quote: {
      value: { bid: 17.12, offer: 17.13, currency: 'EUR', venue: 'Xetra' },
      source: 'State Street',
      sourceUrl: SSGA_SPYL,
      asOf: '2026-11-12',
    },
  },
];
