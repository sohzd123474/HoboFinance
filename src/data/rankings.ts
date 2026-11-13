// rankings.ts - which US-listed company was the largest by market capitalisation, Jan 2000 to Nov 2026.
//
// WHAT THIS IS
//   NUMBER_ONE      Month-granularity history of the number one US company by market cap, as seen on a
//                   check made on the 1st of each month (i.e. using the prior month-end closing market caps).
//                   Ordered spans: each entry holds from its start month until the next entry starts.
//                   Consecutive entries may repeat a ticker; that is deliberate, so that a single
//                   too-close-to-call month can carry its own confidence flag without tainting a long span.
//   TOP7_QUARTERLY  Top 7 US-domiciled, US-listed companies by market cap as at the start of each calendar
//                   quarter (prior quarter-end closing market caps), in rank order. Alphabet counted once.
//   Market cap means all share classes (so Alphabet, Meta, Berkshire and Visa include unlisted classes).
//   Non-US companies (PetroChina, TSMC, Saudi Aramco, Toyota, BP, Shell, Nortel, Vodafone, NTT ...) are excluded.
//   Tickers are current Yahoo Finance symbols (Alphabet and pre-2015 Google share one symbol, Meta and
//   Facebook share one symbol, AT&T is the SBC lineage, SpaceX is the 2026 Nasdaq listing).
//
// HOW IT WAS RESEARCHED (on 2026-11-13)
//   1. Primary dataset: the market cap history series embedded in companiesmarketcap.com company pages
//      (month-end points to early 2024, weekly points after), pulled for about 48 US large caps and ranked
//      at every month-end from Dec 1999 to Oct 2026.
//   2. From Mar 2024 the weekly points were scaled to the exact month-end using Yahoo Finance daily closes.
//      The scaled quarter-end values reproduce the Wikipedia quarterly figures (archived companiesmarketcap
//      snapshots) to within about 0.5% for 2024-2026 (about 2% for end-2025, same order).
//   3. Glitch screen: implied share counts (cap / Yahoo split-adjusted close) were checked for jumps. The
//      merger-timing errors that mattered were corrected with price x pre-merger shares: Pfizer end-Mar 2003
//      (Pharmacia) and Bank of America end-Dec 2005 (MBNA). Others found (Citigroup Jul-Aug 2000, P&G
//      Oct-Nov 2005, Pfizer Oct 2009) do not fall on a quarter-end and do not affect number one.
//   4. Google is missing from that dataset before Mar 2014, so its 2004-2014 values were computed from Yahoo
//      prices x total share counts (SEC XBRL facts for 2008-2013; 10-K figures from memory for 2005-2007).
//   5. Cross-checks: Wikipedia "List of public corporations by market capitalization" (FT Global 500 annual
//      snapshots 2000-2005, quarterly top 10 from 2006), and contemporaneous news for specific handovers.
//      The Wikipedia date labels on the 2000-2002 FT snapshots look wrong: judged by their values they are
//      early Jan 2000, 4 Jan 2001 and end-Mar 2002, not 31 Mar 2000 / 31 Mar 2001 / Dec 2002.
//      FT-based lists count only listed share classes, so they rank Google/Alphabet and Facebook lower.
//   6. Intraday or intra-month handovers that reversed before month-end do not create a span. Examples that
//      therefore do NOT appear: Cisco (late Mar 2000), Alphabet (Feb 2016), Nvidia (Jun 2024, Nov 2024,
//      Jan 2025), Apple over Nvidia (Jul 2026). Citigroup, Walmart, Pfizer, Intel, Cisco and Alphabet were
//      never number one at a month-end in this period.
//   Sources not reachable: macrotrends.net (HTTP 403), tweaktown.com article (HTTP 403). FT Global 500
//   archive pages, Slickcharts, S&P factsheets, Visual Capitalist and Statista were not consulted directly.
//
// CONFIDENCE RULE
//   confirmed = supported by the primary dataset with a gap of at least 3%, or a thinner gap that a second
//               independent source (FT/Wikipedia list, or a news report of the closing values) agrees with.
//   unsure    = gap under 3% with no second source, or sources disagree, or a company had to be left out
//               because it is delisted, or the value rests on my own estimate. The note says which.
//   For TOP7_QUARTERLY the gap that matters is rank 7 vs rank 8 (membership). Rank order inside the 7 can
//   still be a near tie on a confirmed row; notes flag the notable ones.
//
// LEAST CERTAIN PERIODS
//   - 2002-07, 2003-08, 2003-10, 2003-11: Microsoft vs GE within 0.3-2.8% at month-end, single dataset.
//   - 2005-08 and 2005-11: ExxonMobil vs GE within 1.1-2.6%, single dataset.
//   - 2011-09 to 2011-11: Apple vs ExxonMobil within 0.1-1.7% at three consecutive month-ends.
//   - 2013-08: ExxonMobil vs Apple within 0.5%.
//   - 2019-11 and 2019-12: Apple vs Microsoft within 1.0-2.8%. 2020-06: Microsoft vs Apple within 0.9%.
//   - TOP7 2000-Q1 and 2001-Q3: a delisted company (Lucent; AOL Time Warner) belongs in the true top 7 and
//     is left out because it has no usable ticker, so those rows have 6 names. 2001-Q2 depends on an
//     AOL Time Warner estimate.
//   - TOP7 2006-Q1 and 2007-Q1: merger-timing questions (BofA/MBNA, AT&T/BellSouth).
//   - TOP7 2008-2013: many quarters where ranks 6-9 sit within 1-2% of each other (PG, JNJ, IBM, CVX, GE,
//     WMT, BRK-B, T, Google), so the 7th name is frequently a toss-up.
//   - TOP7 2015-Q4, 2016-Q1, 2016-Q3, 2017-Q4, 2023-Q3: 7th name within about 2%, or sources disagree.
//   - Everything before 2006 rests mainly on one dataset; FT snapshots only exist about once a year.
//   - Latest data: month-end Oct 2026 (NUMBER_ONE through the 2026-11 check) and quarter-end Sep 2026
//     (TOP7 through 2026-Q4).
//
// Values quoted in notes are USD billions.

export type Confidence = 'confirmed' | 'unsure';

export interface NumberOneSpan {
  /** YYYY-MM (e.g. 2011-10): first month whose 1st-of-month check shows this ticker as number one. */
  start: string;
  ticker: string;
  confidence: Confidence;
  note?: string;
}

export interface Top7Row {
  /** YYYY-Qn (e.g. 2011-Q4): ranking as at the start of this quarter. */
  quarter: string;
  /** Up to 7 tickers in rank order, US-listed only. */
  tickers: string[];
  confidence: Confidence;
  note?: string;
}

export interface Source { label: string; url: string }

export const RANKINGS_RESEARCHED_ON = '2026-11-13';

export const SOURCES: Source[] = [
  { label: "companiesmarketcap.com - per-company market cap history (primary dataset; e.g. Microsoft page)", url: "https://companiesmarketcap.com/microsoft/marketcap/" },
  { label: "Wikipedia - List of public corporations by market capitalization (FT Global 500 annual and quarterly top 10 tables)", url: "https://en.wikipedia.org/wiki/List_of_public_corporations_by_market_capitalization" },
  { label: "FT Global 500 2000 (archived; as cited by Wikipedia, not fetched directly)", url: "https://web.archive.org/web/20100329134002/http://specials.ft.com/ln/specials/global5002a.htm" },
  { label: "Yahoo Finance - daily and monthly closing prices (month-end scaling, glitch screen, Google estimate)", url: "https://finance.yahoo.com/" },
  { label: "SEC EDGAR XBRL company facts - Google Inc share counts 2008-2014", url: "https://data.sec.gov/api/xbrl/companyfacts/CIK0001288776.json" },
  { label: "Motley Fool - Cisco passes Microsoft as largest company, late Mar 2000", url: "https://www.fool.com/investing/general/2013/03/25/a-short-lived-battle-to-be-the-largest-tech-compan.aspx" },
  { label: "AP via NBC News - GE holds spot as most valuable company (Dec 2004)", url: "https://www.nbcnews.com/news/amp/wbna6765986" },
  { label: "AP via NBC News - ExxonMobil knocks GE off perch (18 Feb 2005)", url: "https://www.nbcnews.com/id/wbna6994181" },
  { label: "Reuters via Fox News - ExxonMobil becomes most valuable company (Feb 2005 closing values)", url: "https://www.foxnews.com/story/exxonmobil-becomes-worlds-most-valuable-company" },
  { label: "domain-b - FT Global 500 Q3 2005 report (Exxon from number two at end-June to number one)", url: "https://domain-b.com/news_review/200510oct/20051004newsf.html" },
  { label: "AP via Washington Times - Apple is most valuable US company (10 Aug 2011)", url: "https://www.washingtontimes.com/news/2011/aug/10/the-ipad-trumps-oil-apple-is-most-valuable-us-co/" },
  { label: "Fortune - Exxon Mobil finished 2011 as the most valuable company (2 Jan 2012)", url: "https://fortune.com/2012/01/02/battle-of-the-market-caps-exxon-beat-apple-by-30b/" },
  { label: "Al Jazeera - Exxon replaces Apple as most valued company (25 Jan 2013, intra-month)", url: "https://www.aljazeera.com/amp/economy/2013/1/25/exxon-replaces-apple-as-most-valued-company" },
  { label: "CNBC - Microsoft and Apple end trading, market cap (30 Nov 2018)", url: "https://www.cnbc.com/2018/11/30/microsoft-apple-end-trading-market-cap.html" },
  { label: "CBS News - Amazon surpasses Microsoft as most valuable US company (7 Jan 2019)", url: "https://www.cbsnews.com/amp/news/amazon-surpasses-microsoft-as-most-valuable-u-s-company" },
  { label: "MacRumors - Microsoft overtakes Apple as most valuable company (29 Oct 2021)", url: "https://www.macrumors.com/2021/10/29/microsoft-worlds-most-valuable-company/" },
  { label: "MacRumors - Microsoft overtakes Apple as most valuable company (11 Jan 2024)", url: "https://www.macrumors.com/2024/01/11/microsoft-overtakes-apple-as-most-valuable-company/" },
  { label: "Benzinga via TradingView - Microsoft reclaimed its crown in June 2024", url: "https://de.tradingview.com/news/benzinga:c09391234094b:0-microsoft-reclaimed-its-crown-as-the-world-s-most-valuable-company-with-an-8-surge-in-june-amidst-nvidia-s-turbulent-14-decline" },
  { label: "NPR - SpaceX IPO, first day of trading on Nasdaq as SPCX (12 Jun 2026)", url: "https://www.npr.org/2026/06/12/nx-s1-5855004/stock-ai-spacex-ipo-elon-musk" },
  { label: "Fox Business - Apple briefly overtakes Nvidia (Jul 2026, intra-month)", url: "https://www.foxbusiness.com/markets/apple-briefly-overtakes-nvidia-worlds-most-valuable-company-amid-ai-investment-doubts" },
  { label: "ARY News - Apple hits five trillion dollar valuation to overtake Nvidia (31 Oct 2026)", url: "https://arynews.tv/apple-hits-five-trillion-dollar-valuation-to-overtake-nvidia-in-global-market-cap" },
  { label: "TweakTown - Apple overtakes Nvidia to become the most valuable company (late Oct 2026; page returned 403 to a direct fetch, read via search summary only)", url: "https://www.tweaktown.com/news/114427/apple-overtakes-nvidia-to-become-the-worlds-most-valuable-company-after-a-rough-month-for-ai-stocks/index.html" },
];

// In the source comments below, CMC = companiesmarketcap.com per-company market cap history series.
export const NUMBER_ONE: NumberOneSpan[] = [
  // source: CMC month-end series; FT Global 500 2000; Motley Fool on Cisco, Mar 2000
  { start: '2000-01', ticker: 'MSFT', confidence: 'confirmed', note: "End-1999: MSFT 604 vs GE 510 (USD bn). Cisco first closed above Microsoft only on 24-27 Mar 2000 and was back behind by 31 Mar (MSFT 557 vs CSCO 536, 3.9%); end-Feb margin over Cisco was only about 1.3%." },
  // source: CMC month-end series; FT Global 500 2001 and 2002 snapshots
  { start: '2000-05', ticker: 'GE', confidence: 'confirmed', note: "From end-Apr 2000 (GE 519 vs CSCO 485) GE led every month-end until Jun 2002, mostly by 10-50%." },
  // source: CMC only
  { start: '2002-07', ticker: 'MSFT', confidence: 'unsure', note: "End-Jun 2002: MSFT 293 vs GE 289, a 1.4% gap in a single dataset; no second source found. Could be GE." },
  // source: CMC month-end series
  { start: '2002-08', ticker: 'GE', confidence: 'confirmed', note: "End-Jul 2002 GE 320 vs MSFT 258; end-Sep 2002 GE 245 vs MSFT 234 (4.7%)." },
  // source: CMC month-end series; FT Global 500 2003
  { start: '2002-11', ticker: 'MSFT', confidence: 'confirmed', note: "End-Oct 2002 MSFT 286 vs GE 251. End-Mar 2003 was thin (2.0%) but the FT Global 500 2003 snapshot agrees (MSFT 264.0 vs GE 259.6)." },
  // source: CMC month-end series
  { start: '2003-05', ticker: 'GE', confidence: 'confirmed', note: "End-Apr 2003 GE 294 vs MSFT 274; end-Jun 2003 GE 287 vs MSFT 276 (4.0%)." },
  // source: CMC only
  { start: '2003-08', ticker: 'GE', confidence: 'unsure', note: "End-Jul 2003: GE 285 vs MSFT 284, a 0.4% gap. Effectively a coin flip; could be MSFT." },
  // source: CMC month-end series
  { start: '2003-09', ticker: 'GE', confidence: 'confirmed', note: "End-Aug 2003: GE 298 vs MSFT 287 (3.8%)." },
  // source: CMC only
  { start: '2003-10', ticker: 'MSFT', confidence: 'unsure', note: "End-Sep 2003: MSFT 300 vs GE 299, a 0.3% gap. Effectively a coin flip; could be GE." },
  // source: CMC only
  { start: '2003-11', ticker: 'GE', confidence: 'unsure', note: "End-Oct 2003: GE 291 vs MSFT 283, a 2.8% gap in a single dataset." },
  // source: CMC month-end series; FT Global 500 2004; AP via NBC News Dec 2004
  { start: '2003-12', ticker: 'GE', confidence: 'confirmed', note: "End-Nov 2003 GE 288 vs MSFT 278 (3.6%), widening to 6-18% through 2004. AP reported GE 387.9 vs Exxon 329.3 in Dec 2004." },
  // source: CMC month-end series; AP/Reuters 18 Feb 2005
  { start: '2005-03', ticker: 'XOM', confidence: 'confirmed', note: "Exxon first closed above GE on 18 Feb 2005 (383.3 vs 379.3); end-Feb 2005 XOM 404 vs GE 373." },
  // source: CMC month-end series; FT Global 500 2005; FT Global 500 Q3 2005 via domain-b
  { start: '2005-04', ticker: 'GE', confidence: 'confirmed', note: "End-Mar 2005 GE 382 vs XOM 379 (0.8%) - thin, but the FT Global 500 2005 snapshot agrees (382.2 vs 380.6). End-Jun 2005 GE 367 vs XOM 362 (1.4%), and the FT Q3 2005 report says Exxon was number two at end-June." },
  // source: CMC only
  { start: '2005-08', ticker: 'XOM', confidence: 'unsure', note: "End-Jul 2005: XOM 370 vs GE 366, a 1.1% gap in a single dataset. Could be GE." },
  // source: CMC month-end series; FT Global 500 Q3 2005 via domain-b
  { start: '2005-09', ticker: 'XOM', confidence: 'confirmed', note: "End-Aug 2005 XOM 378 vs GE 356; end-Sep 2005 XOM 395 vs GE 356 (FT also has Exxon first at end-Sep)." },
  // source: CMC only
  { start: '2005-11', ticker: 'GE', confidence: 'unsure', note: "End-Oct 2005: GE 358 vs XOM 349, a 2.6% gap in a single dataset. Could be XOM." },
  // source: CMC month-end series
  { start: '2005-12', ticker: 'GE', confidence: 'confirmed', note: "End-Nov 2005 GE 377 vs XOM 361 (4.4%); end-Dec 2005 GE 365 vs XOM 344 (6.1%)." },
  // source: CMC month-end series; Wikipedia/FT quarterly lists 2006-2011
  { start: '2006-02', ticker: 'XOM', confidence: 'confirmed', note: "End-Jan 2006 XOM 383 vs GE 341. Exxon then led every month-end to Jul 2011 among US companies (PetroChina, not US, was sometimes larger globally). Thinnest: end-Mar 2006 at 1.7%, corroborated by FT (371.6 vs 362.5)." },
  // source: CMC only; AP 10 Aug 2011 for context
  { start: '2011-09', ticker: 'XOM', confidence: 'unsure', note: "End-Aug 2011: XOM 360 vs AAPL 357, a 0.8% gap. Apple first closed above Exxon on 10 Aug 2011 and the two swapped repeatedly; could be AAPL." },
  // source: CMC month-end series; Wikipedia/FT Q3 2011
  { start: '2011-10', ticker: 'AAPL', confidence: 'unsure', note: "End-Sep 2011: AAPL 354 vs XOM 348 (FT: 353.5 vs 353.1, a 0.1% gap). End-Oct 2011: AAPL 376 vs XOM 374 (0.5%). Both month-ends are too close to call; either could be XOM." },
  // source: CMC month-end series; Wikipedia/FT Q4 2011; Fortune 2 Jan 2012
  { start: '2011-12', ticker: 'XOM', confidence: 'confirmed', note: "End-Nov 2011 XOM 386 vs AAPL 355; end-Dec 2011 XOM 406 vs AAPL 378 (FT 406.3 vs 376.4; Fortune: Exxon finished 2011 about 30bn ahead)." },
  // source: CMC month-end series; Wikipedia/FT quarterly lists 2012-2013
  { start: '2012-02', ticker: 'AAPL', confidence: 'confirmed', note: "End-Jan 2012 AAPL 426 vs XOM 395. Exxon briefly retook the lead intra-month on 25 Jan 2013 and in Apr 2013, but Apple led at every month-end; the Feb-May 2013 month-end gaps were only 3.2-4.5% (FT agrees for end-Mar 2013: 415.7 vs 403.7)." },
  // source: CMC month-end series; Wikipedia/FT Q2 2013
  { start: '2013-07', ticker: 'XOM', confidence: 'confirmed', note: "End-Jun 2013 XOM 404 vs AAPL 372 (FT 401.7 vs 372.2)." },
  // source: CMC only
  { start: '2013-08', ticker: 'XOM', confidence: 'unsure', note: "End-Jul 2013: XOM 413 vs AAPL 411, a 0.5% gap. Too close to call; could be AAPL." },
  // source: CMC month-end series; Wikipedia/FT quarterly lists 2013-2018
  { start: '2013-09', ticker: 'AAPL', confidence: 'confirmed', note: "End-Aug 2013 AAPL 443 vs XOM 384. Apple then led every month-end to Oct 2018. Alphabet passed Apple on closing basis for a few days from 2 Feb 2016 but trailed at end-Jan 2016 (540 vs 517) and end-Feb 2016 (536 vs 487), so it never shows on a first-of-month check." },
  // source: CMC month-end series; CNBC 30 Nov 2018; Wikipedia Q4 2018
  { start: '2018-12', ticker: 'MSFT', confidence: 'confirmed', note: "30 Nov 2018 close: MSFT 851.2 vs AAPL 847.4 (0.5%, but reported by CNBC/Reuters). End-Dec 2018 MSFT 780 vs AAPL 746." },
  // source: CMC month-end series (single dataset, gap above 5%); CBS News 7 Jan 2019 for context
  { start: '2019-02', ticker: 'AMZN', confidence: 'confirmed', note: "End-Jan 2019: AMZN 844 vs MSFT 801 (5.4%). Amazon led from 7 Jan 2019 until its 1 Feb post-earnings drop. One month only." },
  // source: CMC month-end series; Wikipedia Q1-Q3 2019
  { start: '2019-03', ticker: 'MSFT', confidence: 'confirmed', note: "End-Feb 2019 MSFT 860 vs AAPL 816. End-Mar 2019 was thin (905 vs 896, 1.0%) but the Wikipedia Q1 2019 list also has Microsoft first. Led through end-Sep 2019." },
  // source: CMC only
  { start: '2019-11', ticker: 'AAPL', confidence: 'unsure', note: "End-Oct 2019: AAPL 1105 vs MSFT 1094 (1.0%); end-Nov 2019: AAPL 1187 vs MSFT 1155 (2.8%). Single dataset and thin gaps; either month could be MSFT." },
  // source: CMC month-end series; Wikipedia Q4 2019
  { start: '2020-01', ticker: 'AAPL', confidence: 'confirmed', note: "End-Dec 2019 AAPL 1288 vs MSFT 1200 (Wikipedia Q4 2019 agrees); end-Jan 2020 AAPL 1354 vs MSFT 1295." },
  // source: CMC month-end series; Wikipedia Q1 2020
  { start: '2020-03', ticker: 'MSFT', confidence: 'confirmed', note: "End-Feb 2020 MSFT 1232 vs AAPL 1196 (3.0%); end-Mar 2020 MSFT 1197 vs AAPL 1100 (Wikipedia Q1 2020 agrees)." },
  // source: CMC only
  { start: '2020-06', ticker: 'MSFT', confidence: 'unsure', note: "End-May 2020: MSFT 1390 vs AAPL 1378, a 0.9% gap in a single dataset. Could be AAPL." },
  // source: CMC month-end series; Wikipedia Q2 2020
  { start: '2020-07', ticker: 'AAPL', confidence: 'confirmed', note: "End-Jun 2020 AAPL 1581 vs MSFT 1543 (2.5%; Wikipedia Q2 2020 agrees with 1576 vs 1551). Apple then led every month-end to Sep 2021 by 10% or more." },
  // source: CMC month-end series; MacRumors 29 Oct 2021
  { start: '2021-11', ticker: 'MSFT', confidence: 'confirmed', note: "29 Oct 2021 close: MSFT about 2490 vs AAPL 2458 (1.3%), widely reported. One month only." },
  // source: CMC month-end series; Wikipedia quarterly lists 2021-2023
  { start: '2021-12', ticker: 'AAPL', confidence: 'confirmed', note: "End-Nov 2021 AAPL 2712 vs MSFT 2482. Apple led every month-end through Dec 2023 (thinnest: end-Nov 2023 at 4.9%)." },
  // source: CMC series scaled to month-end with Yahoo closes; MacRumors 11 Jan 2024; Benzinga Jul 2024
  { start: '2024-02', ticker: 'MSFT', confidence: 'confirmed', note: "End-Jan 2024 MSFT 2954 vs AAPL 2847 (Microsoft passed Apple on 11-12 Jan 2024). End-Jun 2024 MSFT 3322 vs AAPL 3230 (2.8%; Benzinga reports Microsoft reclaimed the top spot in June). Nvidia led for a few days from 18 Jun 2024 but not at month-end. NB the Wikipedia Q2 and Q3 2024 tables attach these same values to the wrong names (Apple/Microsoft swapped)." },
  // source: CMC series scaled to month-end with Yahoo closes; Wikipedia Q4 2024 and Q1 2025
  { start: '2024-08', ticker: 'AAPL', confidence: 'confirmed', note: "End-Jul 2024 AAPL 3377 vs MSFT 3110. Apple led every month-end to Apr 2025; closest was end-Oct 2024 (AAPL 3415 vs NVDA 3254, 4.9%). Nvidia led on various days in Nov 2024 and Jan 2025 but not at a month-end." },
  // source: CMC series scaled to month-end with Yahoo closes (single dataset, gap 3.9%)
  { start: '2025-06', ticker: 'MSFT', confidence: 'confirmed', note: "End-May 2025: MSFT 3422 vs NVDA 3295 (3.9%), AAPL 3000. One month only." },
  // source: CMC series scaled to month-end with Yahoo closes; Wikipedia quarterly lists Q2 2025 - Q3 2026
  { start: '2025-07', ticker: 'NVDA', confidence: 'confirmed', note: "End-Jun 2025 NVDA 3853 vs MSFT 3697 (Wikipedia Q2 2025 agrees). Nvidia led every month-end through Sep 2026; thinnest were end-Nov 2025 (4.0% over AAPL) and end-Apr 2026 (4.9% over GOOGL). Apple passed Nvidia on some days in Jul 2026 but trailed at end-Jul (4537 vs 4862)." },
  // source: CMC series; ARY News 31 Oct 2026; TweakTown
  { start: '2026-11', ticker: 'AAPL', confidence: 'confirmed', note: "30 Oct 2026 close: AAPL about 5030 vs NVDA about 4940 (1.8%), reported by ARY News and TweakTown as Apple retaking the top spot. Still Apple on 13 Nov 2026 (5157 vs NVDA 4013). Latest span; nothing after the Nov 2026 check is known." },
];

export const TOP7_QUARTERLY: Top7Row[] = [
  // source: companiesmarketcap.com month-end series (glitch-screened against Yahoo prices); FT Global 500 annual snapshots (via Wikipedia) as a cross-check where they exist (early 2000, Jan 2001, Mar 2002, Mar 2003, Mar 2004, Mar 2005)
  { quarter: '2000-Q1', tickers: ['MSFT', 'GE', 'CSCO', 'WMT', 'XOM', 'INTC'], confidence: 'unsure', note: "Only 6 listed. Rank 7 at end-1999 was Lucent Technologies (about 233bn; FT Global 500 2000 has it at 237.7bn), which is delisted and has no usable ticker. Next after Lucent was C (201bn)." },
  { quarter: '2000-Q2', tickers: ['MSFT', 'CSCO', 'GE', 'INTC', 'XOM', 'WMT', 'ORCL'], confidence: 'confirmed' },
  { quarter: '2000-Q3', tickers: ['GE', 'INTC', 'CSCO', 'MSFT', 'PFE', 'XOM', 'WMT'], confidence: 'confirmed', note: "INTC (449) and CSCO (446) are a near tie for ranks 2-3. Nortel (Canadian) excluded." },
  { quarter: '2000-Q4', tickers: ['GE', 'CSCO', 'MSFT', 'XOM', 'PFE', 'INTC', 'C'], confidence: 'confirmed' },
  { quarter: '2001-Q1', tickers: ['GE', 'XOM', 'PFE', 'CSCO', 'C', 'WMT', 'MSFT'], confidence: 'unsure', note: "Rank 7/8 too close to call: MSFT 231 vs AIG 230 at end-2000. FT snapshot of 4 Jan 2001 has a different order (CSCO second, INTC in, AIG out)." },
  { quarter: '2001-Q2', tickers: ['GE', 'MSFT', 'XOM', 'PFE', 'C', 'WMT', 'AIG'], confidence: 'unsure', note: "AOL Time Warner (delisted, not in the dataset) was roughly 178bn at end-Mar 2001 by my own price x shares estimate, close below rank 7 AIG (188); not verifiable from a source." },
  { quarter: '2001-Q3', tickers: ['GE', 'MSFT', 'XOM', 'C', 'PFE', 'WMT'], confidence: 'unsure', note: "Only 6 listed. AOL Time Warner (delisted, no usable ticker) was roughly 235bn at end-Jun 2001 by my own price x shares estimate, which would put it at rank 6 ahead of WMT (218); not verifiable from a source. If AOL Time Warner is ignored, rank 7 is AIG (200) narrowly ahead of INTC (197) and IBM (196)." },
  { quarter: '2001-Q4', tickers: ['GE', 'MSFT', 'XOM', 'PFE', 'WMT', 'C', 'AIG'], confidence: 'confirmed' },
  { quarter: '2002-Q1', tickers: ['GE', 'MSFT', 'XOM', 'C', 'WMT', 'PFE', 'INTC'], confidence: 'unsure', note: "Rank 7/8 too close to call: INTC 210 vs IBM 208 (and AIG 208) USD bn at the prior quarter-end." },
  { quarter: '2002-Q2', tickers: ['GE', 'MSFT', 'XOM', 'WMT', 'C', 'PFE', 'INTC'], confidence: 'confirmed' },
  { quarter: '2002-Q3', tickers: ['MSFT', 'GE', 'XOM', 'WMT', 'PFE', 'C', 'AIG'], confidence: 'unsure', note: "Number one is itself uncertain: MSFT 293 vs GE 289 (see NUMBER_ONE 2002-07)." },
  { quarter: '2002-Q4', tickers: ['GE', 'MSFT', 'WMT', 'XOM', 'PFE', 'JNJ', 'C'], confidence: 'confirmed' },
  { quarter: '2003-Q1', tickers: ['MSFT', 'GE', 'XOM', 'WMT', 'PFE', 'C', 'JNJ'], confidence: 'confirmed' },
  { quarter: '2003-Q2', tickers: ['MSFT', 'GE', 'XOM', 'WMT', 'PFE', 'C', 'JNJ'], confidence: 'confirmed', note: "PFE value corrected: the dataset applied the post-Pharmacia share count a month early (246bn); price x pre-merger shares gives about 193bn, matching the FT Global 500 2003 snapshot (195.9bn, rank 5). Order matches FT." },
  { quarter: '2003-Q3', tickers: ['GE', 'MSFT', 'PFE', 'XOM', 'WMT', 'C', 'JNJ'], confidence: 'confirmed' },
  { quarter: '2003-Q4', tickers: ['MSFT', 'GE', 'WMT', 'XOM', 'C', 'PFE', 'INTC'], confidence: 'unsure', note: "Number one is itself uncertain: MSFT 300 vs GE 299 (see NUMBER_ONE 2003-10)." },
  { quarter: '2004-Q1', tickers: ['GE', 'MSFT', 'PFE', 'XOM', 'C', 'WMT', 'INTC'], confidence: 'confirmed' },
  { quarter: '2004-Q2', tickers: ['GE', 'XOM', 'MSFT', 'C', 'PFE', 'WMT', 'AIG'], confidence: 'confirmed', note: "Ranks 2-5 (XOM, MSFT, C, PFE) all within 2%; FT Global 500 2004 snapshot (a few days earlier) orders them MSFT, XOM, PFE, C. Membership agrees." },
  { quarter: '2004-Q3', tickers: ['GE', 'MSFT', 'XOM', 'PFE', 'C', 'WMT', 'AIG'], confidence: 'confirmed' },
  { quarter: '2004-Q4', tickers: ['GE', 'XOM', 'MSFT', 'PFE', 'C', 'WMT', 'AIG'], confidence: 'unsure', note: "Rank 7/8 too close to call: AIG 177 vs BAC 175 USD bn at the prior quarter-end." },
  { quarter: '2005-Q1', tickers: ['GE', 'XOM', 'MSFT', 'C', 'WMT', 'PFE', 'BAC'], confidence: 'unsure', note: "Rank 7/8 too close to call: BAC 190 vs JNJ 188 USD bn at the prior quarter-end." },
  { quarter: '2005-Q2', tickers: ['GE', 'XOM', 'MSFT', 'C', 'WMT', 'JNJ', 'PFE'], confidence: 'confirmed' },
  { quarter: '2005-Q3', tickers: ['GE', 'XOM', 'MSFT', 'C', 'PFE', 'WMT', 'JNJ'], confidence: 'confirmed' },
  { quarter: '2005-Q4', tickers: ['XOM', 'GE', 'MSFT', 'C', 'JNJ', 'PFE', 'WMT'], confidence: 'confirmed' },
  { quarter: '2006-Q1', tickers: ['GE', 'XOM', 'MSFT', 'C', 'WMT', 'PG', 'BAC'], confidence: 'unsure', note: "BAC value corrected: the dataset applied the post-MBNA share count (deal closed 1 Jan 2006) to end-Dec 2005 (215bn); price x pre-merger shares gives about 185bn, moving BAC from rank 5 to rank 7. Ranks 5-9 (WMT 195, PG 190, BAC 185, JNJ 179, AIG 177) are tightly bunched." },
  // source: companiesmarketcap.com month-end series cross-checked against Wikipedia/FT Global 500 quarterly top 10; Google before Mar 2014 computed from Yahoo price x SEC share counts
  { quarter: '2006-Q2', tickers: ['XOM', 'GE', 'MSFT', 'C', 'BAC', 'WMT', 'PG'], confidence: 'confirmed' },
  { quarter: '2006-Q3', tickers: ['XOM', 'GE', 'C', 'MSFT', 'BAC', 'WMT', 'PG'], confidence: 'unsure', note: "Rank 7/8 too close to call: PG 177 vs JNJ 176 USD bn at the prior quarter-end." },
  { quarter: '2006-Q4', tickers: ['XOM', 'GE', 'MSFT', 'C', 'BAC', 'WMT', 'PFE'], confidence: 'confirmed', note: "WMT (206) and PFE (204) near tie for ranks 6-7; FT has PFE (206.8) marginally ahead. Membership agrees." },
  { quarter: '2007-Q1', tickers: ['XOM', 'GE', 'MSFT', 'C', 'BAC', 'T', 'PG'], confidence: 'unsure', note: "T is counted at 223bn including BellSouth shares (merger closed 29 Dec 2006, the last trading day). The FT end-2006 top 10 does not show AT&T at that size, so FT appears to have used the pre-merger count (about 139bn), in which case ranks 6-7 would be PG (203) and WMT (192)." },
  { quarter: '2007-Q2', tickers: ['XOM', 'GE', 'MSFT', 'C', 'T', 'BAC', 'PG'], confidence: 'unsure', note: "Rank 7/8 too close to call: PG 199 vs WMT 194 USD bn at the prior quarter-end." },
  { quarter: '2007-Q3', tickers: ['XOM', 'GE', 'MSFT', 'C', 'T', 'BAC', 'WMT'], confidence: 'confirmed', note: "C (255) and T (253) near tie for ranks 4-5; FT has AT&T marginally ahead." },
  { quarter: '2007-Q4', tickers: ['XOM', 'GE', 'MSFT', 'T', 'C', 'BAC', 'PG'], confidence: 'confirmed' },
  { quarter: '2008-Q1', tickers: ['XOM', 'GE', 'MSFT', 'T', 'PG', 'BRK-B', 'GOOGL'], confidence: 'confirmed', note: "GOOGL (about 216bn) computed from price x total shares (class A+B, 313m); it is absent from the FT top 10, which only reached down to 250bn." },
  { quarter: '2008-Q2', tickers: ['XOM', 'GE', 'MSFT', 'T', 'PG', 'WMT', 'BRK-B'], confidence: 'confirmed' },
  { quarter: '2008-Q3', tickers: ['XOM', 'GE', 'MSFT', 'WMT', 'CVX', 'T', 'BRK-B'], confidence: 'unsure', note: "Rank 7/8 too close to call: BRK-B 187 vs PG 185 USD bn at the prior quarter-end." },
  { quarter: '2008-Q4', tickers: ['XOM', 'GE', 'MSFT', 'WMT', 'PG', 'BRK-B', 'JNJ'], confidence: 'confirmed' },
  { quarter: '2009-Q1', tickers: ['XOM', 'WMT', 'PG', 'MSFT', 'T', 'JNJ', 'GE'], confidence: 'confirmed' },
  { quarter: '2009-Q2', tickers: ['XOM', 'WMT', 'MSFT', 'T', 'JNJ', 'PG', 'CVX'], confidence: 'unsure', note: "Rank 7/8 too close to call: CVX 135 vs BRK-B 134 USD bn at the prior quarter-end." },
  { quarter: '2009-Q3', tickers: ['XOM', 'MSFT', 'WMT', 'JNJ', 'PG', 'T', 'BRK-B'], confidence: 'unsure', note: "Rank 7/8 too close to call: BRK-B 138 vs IBM 137 (and JPM 134) USD bn at the prior quarter-end." },
  { quarter: '2009-Q4', tickers: ['XOM', 'MSFT', 'WMT', 'GE', 'JPM', 'PG', 'JNJ'], confidence: 'unsure', note: "Rank 7/8 too close to call: JNJ 168 vs AAPL 167 USD bn at the prior quarter-end." },
  { quarter: '2010-Q1', tickers: ['XOM', 'MSFT', 'WMT', 'GOOGL', 'AAPL', 'JNJ', 'PG'], confidence: 'unsure', note: "Rank 7/8 too close to call in a single dataset: PG 176 vs IBM 171 (2.9%). GOOGL (197bn) is computed from price x SEC total share count; FT counts class A only and so ranks it lower." },
  { quarter: '2010-Q2', tickers: ['XOM', 'MSFT', 'AAPL', 'WMT', 'BRK-B', 'GE', 'PG'], confidence: 'unsure', note: "Rank 7/8 too close to call: PG 182 vs GOOGL 181 (and JNJ 180) USD bn at the prior quarter-end." },
  { quarter: '2010-Q3', tickers: ['XOM', 'AAPL', 'MSFT', 'BRK-B', 'WMT', 'PG', 'JNJ'], confidence: 'confirmed' },
  { quarter: '2010-Q4', tickers: ['XOM', 'AAPL', 'MSFT', 'BRK-B', 'WMT', 'GE', 'JNJ'], confidence: 'unsure', note: "Rank 7/8 too close to call: JNJ 171 vs T 169 (and GOOGL 168) USD bn at the prior quarter-end." },
  { quarter: '2011-Q1', tickers: ['XOM', 'AAPL', 'MSFT', 'BRK-B', 'GE', 'WMT', 'GOOGL'], confidence: 'confirmed', note: "GOOGL value computed from price x SEC total share count (FT/Wikipedia count class A only)." },
  { quarter: '2011-Q2', tickers: ['XOM', 'AAPL', 'CVX', 'MSFT', 'GE', 'BRK-B', 'IBM'], confidence: 'confirmed' },
  { quarter: '2011-Q3', tickers: ['XOM', 'AAPL', 'MSFT', 'CVX', 'IBM', 'GE', 'BRK-B'], confidence: 'confirmed' },
  { quarter: '2011-Q4', tickers: ['AAPL', 'XOM', 'MSFT', 'IBM', 'CVX', 'WMT', 'BRK-B'], confidence: 'unsure', note: "Rank 7/8 too close to call: BRK-B 176 vs JNJ 175 (and PG 174) USD bn at the prior quarter-end. Number one is itself uncertain: AAPL 354 vs XOM 348 (see NUMBER_ONE 2011-10)." },
  { quarter: '2012-Q1', tickers: ['XOM', 'AAPL', 'MSFT', 'IBM', 'CVX', 'GOOGL', 'WMT'], confidence: 'confirmed', note: "GOOGL value computed from price x SEC total share count (FT/Wikipedia count class A only)." },
  { quarter: '2012-Q2', tickers: ['AAPL', 'XOM', 'MSFT', 'IBM', 'GE', 'CVX', 'GOOGL'], confidence: 'unsure', note: "Rank 7/8 too close to call: GOOGL 209 vs WMT 208 USD bn at the prior quarter-end. GOOGL value computed from price x SEC total share count (FT/Wikipedia count class A only)." },
  { quarter: '2012-Q3', tickers: ['AAPL', 'XOM', 'MSFT', 'WMT', 'IBM', 'GE', 'T'], confidence: 'unsure', note: "Rank 7/8 too close to call: T 209 vs CVX 208 (and BRK-B 206) USD bn at the prior quarter-end." },
  { quarter: '2012-Q4', tickers: ['AAPL', 'XOM', 'MSFT', 'WMT', 'GOOGL', 'GE', 'IBM'], confidence: 'confirmed', note: "MSFT 251, WMT 248 and GOOGL 248 (computed from price x SEC total share count) are a three-way near tie for ranks 3-5. Membership is clear (rank 7 IBM 237 vs rank 8 CVX 229)." },
  { quarter: '2013-Q1', tickers: ['AAPL', 'XOM', 'GOOGL', 'WMT', 'MSFT', 'BRK-B', 'GE'], confidence: 'unsure', note: "Rank 7/8 too close to call: GE 218 vs IBM 214 USD bn at the prior quarter-end. GOOGL value computed from price x SEC total share count (FT/Wikipedia count class A only)." },
  { quarter: '2013-Q2', tickers: ['AAPL', 'XOM', 'GOOGL', 'BRK-B', 'WMT', 'GE', 'MSFT'], confidence: 'unsure', note: "Rank 7/8 too close to call: MSFT 240 vs IBM 238 USD bn at the prior quarter-end. GOOGL value computed from price x SEC total share count (FT/Wikipedia count class A only)." },
  { quarter: '2013-Q3', tickers: ['XOM', 'AAPL', 'GOOGL', 'MSFT', 'BRK-B', 'WMT', 'JNJ'], confidence: 'unsure', note: "Rank 7/8 too close to call: JNJ 241 vs GE 240 USD bn at the prior quarter-end. GOOGL value computed from price x SEC total share count (FT/Wikipedia count class A only)." },
  { quarter: '2013-Q4', tickers: ['AAPL', 'XOM', 'GOOGL', 'BRK-B', 'MSFT', 'JNJ', 'GE'], confidence: 'unsure', note: "Rank 7/8 too close to call: GE 242 vs WMT 241 USD bn at the prior quarter-end. GOOGL value computed from price x SEC total share count (FT/Wikipedia count class A only)." },
  { quarter: '2014-Q1', tickers: ['AAPL', 'XOM', 'GOOGL', 'MSFT', 'BRK-B', 'GE', 'JNJ'], confidence: 'confirmed', note: "GOOGL value computed from price x SEC total share count (FT/Wikipedia count class A only)." },
  { quarter: '2014-Q2', tickers: ['AAPL', 'XOM', 'GOOGL', 'MSFT', 'BRK-B', 'JNJ', 'WFC'], confidence: 'confirmed' },
  // source: companiesmarketcap.com month-end series cross-checked against Wikipedia quarterly top 10 (FT Global 500 to mid-2015, other snapshots after)
  { quarter: '2014-Q3', tickers: ['AAPL', 'XOM', 'GOOGL', 'MSFT', 'BRK-B', 'JNJ', 'WFC'], confidence: 'confirmed' },
  { quarter: '2014-Q4', tickers: ['AAPL', 'XOM', 'GOOGL', 'MSFT', 'BRK-B', 'JNJ', 'WFC'], confidence: 'confirmed' },
  { quarter: '2015-Q1', tickers: ['AAPL', 'XOM', 'MSFT', 'BRK-B', 'GOOGL', 'JNJ', 'WFC'], confidence: 'confirmed' },
  { quarter: '2015-Q2', tickers: ['AAPL', 'GOOGL', 'BRK-B', 'XOM', 'MSFT', 'WFC', 'JNJ'], confidence: 'confirmed' },
  { quarter: '2015-Q3', tickers: ['AAPL', 'GOOGL', 'MSFT', 'XOM', 'BRK-B', 'WFC', 'JNJ'], confidence: 'confirmed' },
  { quarter: '2015-Q4', tickers: ['AAPL', 'GOOGL', 'MSFT', 'BRK-B', 'XOM', 'WFC', 'JNJ'], confidence: 'unsure', note: "Rank 7/8/9 too close to call: JNJ 258, GE 255, META 253 at end-Sep 2015. The Wikipedia Q3 2015 list omits WFC and has GE at 248." },
  { quarter: '2016-Q1', tickers: ['AAPL', 'GOOGL', 'MSFT', 'BRK-B', 'XOM', 'AMZN', 'META'], confidence: 'unsure', note: "Rank 7/8 too close to call: META 297 vs GE 292 at end-2015. The Wikipedia Q4 2015 list has GE at 314 (apparently a stale share count) and omits Facebook." },
  { quarter: '2016-Q2', tickers: ['AAPL', 'GOOGL', 'MSFT', 'BRK-B', 'XOM', 'META', 'JNJ'], confidence: 'confirmed' },
  { quarter: '2016-Q3', tickers: ['AAPL', 'GOOGL', 'MSFT', 'XOM', 'BRK-B', 'AMZN', 'JNJ'], confidence: 'unsure', note: "Rank 7/8 too close to call: JNJ 334 vs META 327 at end-Jun 2016. Wikipedia shows Facebook lower because it counts class A shares only." },
  { quarter: '2016-Q4', tickers: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'XOM', 'BRK-B'], confidence: 'confirmed' },
  { quarter: '2017-Q1', tickers: ['AAPL', 'GOOGL', 'MSFT', 'BRK-B', 'XOM', 'AMZN', 'META'], confidence: 'confirmed' },
  { quarter: '2017-Q2', tickers: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'BRK-B', 'META', 'XOM'], confidence: 'confirmed' },
  { quarter: '2017-Q3', tickers: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'BRK-B', 'JNJ'], confidence: 'confirmed' },
  { quarter: '2017-Q4', tickers: ['AAPL', 'GOOGL', 'MSFT', 'META', 'AMZN', 'BRK-B', 'JNJ'], confidence: 'unsure', note: "Sources disagree on rank 7: dataset has JNJ 349 vs XOM 347; Wikipedia has ExxonMobil 348.2 vs Johnson and Johnson 347.5." },
  { quarter: '2018-Q1', tickers: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'BRK-B', 'JNJ'], confidence: 'confirmed' },
  { quarter: '2018-Q2', tickers: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'BRK-B', 'META', 'JPM'], confidence: 'confirmed' },
  { quarter: '2018-Q3', tickers: ['AAPL', 'AMZN', 'GOOGL', 'MSFT', 'META', 'BRK-B', 'JPM'], confidence: 'confirmed' },
  { quarter: '2018-Q4', tickers: ['AAPL', 'AMZN', 'MSFT', 'GOOGL', 'BRK-B', 'META', 'JPM'], confidence: 'confirmed' },
  { quarter: '2019-Q1', tickers: ['MSFT', 'AAPL', 'AMZN', 'GOOGL', 'BRK-B', 'META', 'JNJ'], confidence: 'confirmed' },
  { quarter: '2019-Q2', tickers: ['MSFT', 'AAPL', 'AMZN', 'GOOGL', 'BRK-B', 'META', 'JNJ'], confidence: 'confirmed' },
  { quarter: '2019-Q3', tickers: ['MSFT', 'AMZN', 'AAPL', 'GOOGL', 'META', 'BRK-B', 'V'], confidence: 'confirmed' },
  { quarter: '2019-Q4', tickers: ['MSFT', 'AAPL', 'AMZN', 'GOOGL', 'BRK-B', 'META', 'V'], confidence: 'confirmed' },
  { quarter: '2020-Q1', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'BRK-B', 'JPM'], confidence: 'confirmed' },
  { quarter: '2020-Q2', tickers: ['MSFT', 'AAPL', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'V'], confidence: 'confirmed' },
  { quarter: '2020-Q3', tickers: ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'V'], confidence: 'confirmed' },
  { quarter: '2020-Q4', tickers: ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'V'], confidence: 'confirmed' },
  { quarter: '2021-Q1', tickers: ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK-B'], confidence: 'confirmed' },
  { quarter: '2021-Q2', tickers: ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK-B'], confidence: 'confirmed' },
  { quarter: '2021-Q3', tickers: ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK-B'], confidence: 'confirmed' },
  { quarter: '2021-Q4', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'BRK-B'], confidence: 'confirmed' },
  { quarter: '2022-Q1', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA'], confidence: 'confirmed' },
  { quarter: '2022-Q2', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'BRK-B', 'NVDA'], confidence: 'confirmed' },
  { quarter: '2022-Q3', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'BRK-B', 'UNH'], confidence: 'confirmed' },
  { quarter: '2022-Q4', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'BRK-B', 'UNH'], confidence: 'confirmed' },
  { quarter: '2023-Q1', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'BRK-B', 'UNH', 'JNJ'], confidence: 'confirmed' },
  { quarter: '2023-Q2', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'BRK-B', 'TSLA'], confidence: 'confirmed' },
  { quarter: '2023-Q3', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'BRK-B'], confidence: 'unsure', note: "Sources disagree on rank 7 at end-Jun 2023: Wikipedia has Berkshire 745 vs Meta 735, the dataset has META 747 vs BRK-B 737. Berkshire listed here (Wikipedia, and price x shares gives about 744 vs 736)." },
  { quarter: '2023-Q4', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META'], confidence: 'confirmed' },
  { quarter: '2024-Q1', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'], confidence: 'confirmed', note: "TSLA (790) vs BRK-B (777-784) is thin for rank 7 but both sources agree." },
  // source: companiesmarketcap.com weekly series scaled to the exact quarter-end with Yahoo closes, cross-checked against Wikipedia quarterly top 10 (archived companiesmarketcap snapshots)
  { quarter: '2024-Q2', tickers: ['MSFT', 'AAPL', 'NVDA', 'GOOGL', 'AMZN', 'META', 'BRK-B'], confidence: 'confirmed' },
  { quarter: '2024-Q3', tickers: ['MSFT', 'AAPL', 'NVDA', 'GOOGL', 'AMZN', 'META', 'BRK-B'], confidence: 'confirmed', note: "Wikipedia Q2 2024 table shows the same values with Apple and Microsoft names swapped; MSFT first is supported by the dataset and by Benzinga." },
  { quarter: '2024-Q4', tickers: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'BRK-B'], confidence: 'confirmed', note: "Wikipedia Q3 2024 table shows the same values with Apple and Microsoft names swapped; AAPL first per dataset (3522 vs 3198)." },
  { quarter: '2025-Q1', tickers: ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'], confidence: 'confirmed' },
  { quarter: '2025-Q2', tickers: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK-B'], confidence: 'confirmed' },
  { quarter: '2025-Q3', tickers: ['NVDA', 'MSFT', 'AAPL', 'AMZN', 'GOOGL', 'META', 'AVGO'], confidence: 'confirmed' },
  { quarter: '2025-Q4', tickers: ['NVDA', 'MSFT', 'AAPL', 'GOOGL', 'AMZN', 'META', 'AVGO'], confidence: 'confirmed' },
  { quarter: '2026-Q1', tickers: ['NVDA', 'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'AVGO'], confidence: 'confirmed', note: "META (1664) and AVGO (1641) near tie for ranks 6-7; Wikipedia agrees on order (1671 vs 1669)." },
  { quarter: '2026-Q2', tickers: ['NVDA', 'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'AVGO', 'META'], confidence: 'confirmed' },
  { quarter: '2026-Q3', tickers: ['NVDA', 'GOOGL', 'AAPL', 'MSFT', 'AMZN', 'SPCX', 'AVGO'], confidence: 'confirmed', note: "SPCX (SpaceX, listed on Nasdaq 12 Jun 2026) is about 2250bn at 30 Jun 2026 from the dataset scaled with Yahoo closes. The Wikipedia Q2 2026 list omits it (newly listed) but includes it at Q3." },
  { quarter: '2026-Q4', tickers: ['NVDA', 'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'SPCX', 'META'], confidence: 'confirmed' },
];
