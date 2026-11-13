// Pure maths for the ILP vs DIY comparison. No DOM, no formatting.
//
// SOURCES (researched 2026-11-13)
// The ILP defaults describe "a regular-premium investment-linked policy with
// charges like those of AIA Pro Achiever 3.0". AIA's own site and brochure PDF
// could not be opened when this was written (requests timed out), so every ILP
// figure below comes from secondary write-ups that cite AIA's Product Summary
// version 1.0 dated January 2023. They are therefore all flagged "unverified"
// in ILP_DEFAULT_NOTES and on the page.
//   [K] https://thekopinotes.com/?p=9046 (cites the Jan 2023 product summary on comparefirst.sg)
//   [D] https://dollarbureau.com/blog/aia-pro-achiever-3-0-review/ (cites the Jan 2023 summary and brochure)
//   [A] https://www.aia.com.sg/en/our-products/investments/aia-pro-achiever-iii.html (official page; not readable by this tool)
//   [B] https://www.aia.com.sg/content/dam/sg/en/docs/product_brochures/investments/aia-pro-achiever-iii/AIA_Pro_Achiever_3.0_Brochure.pdf (official brochure; not readable by this tool)
// DIY side:
//   [V] https://www.ch.vanguard/en/professional/product/etf/equity/9679/ftse-all-world-ucits-etf-usd-accumulating
//       shows an ongoing charges figure of 0.14%.
//   [V2] https://www.ch.vanguard/en/private-investor/insights/we-are-lowering-fees-on-one-of-our-most-popular-etfs
//       "The ongoing charge for the Vanguard FTSE All-World UCITS ETF will fall from 0.19% to 0.14%", effective 28 July 2026.
//       (It was 0.22% before an earlier cut.)

export interface IlpParams {
  /** Base (regular) premium paid at the start of each policy year. */
  basePremium: number;
  /** Top-up paid at the start of every month while premiums are being paid. */
  monthlyTopUp: number;
  /** Initial investment period: premiums are paid for this many years. */
  iipYears: number;
  /** Keep paying the same amounts after the IIP, to the end of the projection. */
  keepPaying: boolean;
  /** Length of the projection in years. */
  years: number;
  /** Return of the underlying investments before any charge, % a year. */
  grossReturnPct: number;

  /** Fund-level fee inside the ILP, % a year of the whole account. */
  ilpFundFeePct: number;
  /** Supplementary charge, % a year, taken monthly. */
  suppChargePct: number;
  /** The supplementary charge applies for this many policy years. */
  suppChargeYears: number;
  /** If true the supplementary charge is also taken on units bought with top-ups. */
  suppOnTopUps: boolean;
  /** Charge taken from every top-up before it is invested, %. */
  topUpChargePct: number;
  /** Welcome bonus as % of the base premium, for policy year 1, 2, 3, … */
  welcomeBonusPct: number[];
  /** Special bonus as % of the base premium, from this premium number onwards… */
  specialBonusFromYear: number;
  specialBonusPct: number;
  /** …and a second rate from a later premium number. */
  specialBonusLaterFromYear: number;
  specialBonusLaterPct: number;

  /** Total expense ratio of the DIY fund, % a year. */
  diyTerPct: number;
  /** Brokerage commission per purchase, in the same currency as the premiums. */
  diyCommission: number;
  /** Number of commissions paid in each year that money is paid in (1 to 12). */
  diyPurchasesPerYear: number;
}

export interface IlpYearRow {
  year: number;
  /** Cash paid in so far (the same for both routes). */
  paidIn: number;
  ilp: number;
  diy: number;
}

export interface IlpResult {
  rows: IlpYearRow[];
  paidIn: number;
  ilp: {
    finalValue: number;
    supplementary: number;
    fundFee: number;
    topUpCharge: number;
    welcomeBonus: number;
    specialBonus: number;
    totalCharges: number;
    /** Money-weighted return a year, as a fraction. Null when nothing was paid in. */
    irr: number | null;
    /** Gross return minus irr, as a fraction. */
    reductionInYield: number | null;
  };
  diy: {
    finalValue: number;
    ter: number;
    commissions: number;
    totalCharges: number;
    irr: number | null;
    reductionInYield: number | null;
  };
}

// Welcome bonus table, % of the annualised regular premium, by IIP and premium
// band. Source [K], which reads it from the Jan 2023 product summary. Unverified
// against AIA's current summary. AIA's own FAQ only confirms "up to 75% during
// the first 3 policy years".
export const WELCOME_BONUS_BANDS = [
  { min: 2400, label: 'S$2,400 to S$4,799' },
  { min: 4800, label: 'S$4,800 to S$7,199' },
  { min: 7200, label: 'S$7,200 to S$11,999' },
  { min: 12000, label: 'S$12,000 or more' },
] as const;

export const WELCOME_BONUS_TABLE: Record<number, [number, number, number, number]> = {
  10: [5, 23, 38, 53],
  15: [8, 33, 48, 63],
  20: [10, 45, 60, 75],
};

/** Policy years in which the welcome bonus is paid. Source [K], [D]. */
export const WELCOME_BONUS_YEARS = 3;

/**
 * Welcome bonus rate (% of base premium) from the table. Null when the IIP is
 * not in the table or the premium is below the lowest band.
 */
export function welcomeBonusRate(iipYears: number, basePremium: number): number | null {
  const row = WELCOME_BONUS_TABLE[iipYears];
  if (!row) return null;
  let band = -1;
  WELCOME_BONUS_BANDS.forEach((b, i) => {
    if (basePremium >= b.min) band = i;
  });
  return band < 0 ? null : row[band];
}

/** Every default on the page, where it came from, and whether it was confirmed. */
export interface DefaultNote {
  item: string;
  value: string;
  source: string;
  url: string;
  verified: boolean;
  note?: string;
}

export const ILP_DEFAULTS = {
  ilpFundFeePct: 1.5,
  suppChargePct: 3.9,
  suppChargeYears: 10,
  topUpChargePct: 5,
  specialBonusFromYear: 10,
  specialBonusPct: 5,
  specialBonusLaterFromYear: 21,
  specialBonusLaterPct: 8,
  diyTerPct: 0.14,
  diyCommission: 2.5,
  diyPurchasesPerYear: 12,
} as const;

export const RESEARCHED_ON = '2026-11-13';

export const ILP_DEFAULT_NOTES: DefaultNote[] = [
  {
    item: 'Welcome bonus',
    value: `${WELCOME_BONUS_TABLE[10][0]}% to ${WELCOME_BONUS_TABLE[20][3]}% of the base premium, in each of years 1 to ${WELCOME_BONUS_YEARS}`,
    source: 'The Kopi Notes, citing the January 2023 product summary',
    url: 'https://thekopinotes.com/?p=9046',
    verified: false,
    note: 'The table of rates is from a secondary source. It is not clear from that source whether the rate applies to each of the three years or is a total across them. This tool applies it to each year, which favours the ILP.',
  },
  {
    item: 'Supplementary charge',
    value: `${ILP_DEFAULTS.suppChargePct}% a year of the regular-premium account, taken monthly, for the first ${ILP_DEFAULTS.suppChargeYears} years`,
    source: 'Dollar Bureau and The Kopi Notes, citing the January 2023 product summary',
    url: 'https://dollarbureau.com/blog/aia-pro-achiever-3-0-review/',
    verified: false,
    note: 'The sources say it runs until the 11th annual premium is paid, so missed premiums extend it. Whether it also applies to top-up units is not stated; by default this tool does not charge it on top-ups.',
  },
  {
    item: 'Charge on top-ups',
    value: `${ILP_DEFAULTS.topUpChargePct}% of each top-up`,
    source: 'Dollar Bureau and The Kopi Notes, citing the January 2023 product summary',
    url: 'https://dollarbureau.com/blog/aia-pro-achiever-3-0-review/',
    verified: false,
    note: 'The same source gives a minimum top-up of S$1,000, so small monthly top-ups may not be accepted in practice.',
  },
  {
    item: 'Special bonus',
    value: `${ILP_DEFAULTS.specialBonusPct}% of the base premium with the ${ILP_DEFAULTS.specialBonusFromYear}th to ${ILP_DEFAULTS.specialBonusLaterFromYear - 1}th annual premium, ${ILP_DEFAULTS.specialBonusLaterPct}% from the ${ILP_DEFAULTS.specialBonusLaterFromYear}st`,
    source: 'Dollar Bureau and The Kopi Notes, citing the January 2023 product summary',
    url: 'https://dollarbureau.com/blog/aia-pro-achiever-3-0-review/',
    verified: false,
    note: 'Paid only in years when a premium is paid.',
  },
  {
    item: 'ILP fund fee',
    value: `${ILP_DEFAULTS.ilpFundFeePct}% a year`,
    source: 'Dollar Bureau lists management fees of 1.5% to 1.75% a year for the funds it shows',
    url: 'https://dollarbureau.com/blog/aia-pro-achiever-3-0-review/',
    verified: false,
    note: 'Depends on the funds chosen. Check the fund factsheets.',
  },
  {
    item: 'VWRA total expense ratio',
    value: `${ILP_DEFAULTS.diyTerPct}% a year`,
    source: 'Vanguard product page and fee announcement (cut from 0.19% on 28 July 2026)',
    url: 'https://www.ch.vanguard/en/professional/product/etf/equity/9679/ftse-all-world-ucits-etf-usd-accumulating',
    verified: true,
  },
  {
    item: 'Brokerage commission',
    value: `${ILP_DEFAULTS.diyCommission} per purchase, ${ILP_DEFAULTS.diyPurchasesPerYear} purchases a year`,
    source: 'Placeholder, not taken from any broker’s price list',
    url: '',
    verified: false,
    note: 'Replace it with your own broker’s fee.',
  },
];

/**
 * Annual money-weighted return for deposits made at the start of the given
 * months and a single final value at the end of month `months`.
 */
export function moneyWeightedReturn(deposits: number[], finalValue: number): number | null {
  const months = deposits.length;
  const total = deposits.reduce((a, b) => a + b, 0);
  if (total <= 0 || finalValue <= 0) return null;
  // Future value of the deposits at monthly rate r, minus the actual final value.
  const f = (r: number) => {
    let fv = 0;
    for (let m = 0; m < months; m++) fv += deposits[m] * Math.pow(1 + r, months - m);
    return fv - finalValue;
  };
  let lo = -0.5;
  let hi = 0.5;
  if (f(lo) > 0 || f(hi) < 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return Math.pow(1 + (lo + hi) / 2, 12) - 1;
}

/**
 * Month-by-month projection of both routes.
 *
 * Each month: (1) money is paid in at the start, (2) the account grows for the
 * month at the gross return, (3) charges are taken from the grown value.
 * The base premium arrives at the start of each policy year and the top-up at
 * the start of every month, for as long as premiums are being paid. The DIY
 * route receives exactly the same cash on the same dates.
 */
export function simulateIlp(p: IlpParams): IlpResult {
  const years = Math.max(1, Math.round(p.years));
  const months = years * 12;
  const r = Math.pow(1 + p.grossReturnPct / 100, 1 / 12) - 1;
  const purchases = Math.min(12, Math.max(1, Math.round(p.diyPurchasesPerYear)));
  const purchaseMonths = new Set<number>();
  for (let k = 0; k < purchases; k++) purchaseMonths.add(Math.floor((k * 12) / purchases));

  let regular = 0; // units bought with base premiums and bonuses
  let topUps = 0; // units bought with top-ups
  let diy = 0;
  let paidIn = 0;
  const deposits: number[] = [];
  const ilp = { supplementary: 0, fundFee: 0, topUpCharge: 0, welcomeBonus: 0, specialBonus: 0 };
  const d = { ter: 0, commissions: 0 };
  const rows: IlpYearRow[] = [];

  for (let m = 0; m < months; m++) {
    const y = Math.floor(m / 12); // 0-based policy year
    const paying = y < p.iipYears || p.keepPaying;
    let cash = 0;

    if (paying) {
      if (m % 12 === 0 && p.basePremium > 0) {
        cash += p.basePremium;
        regular += p.basePremium;
        const wb = (p.basePremium * (p.welcomeBonusPct[y] ?? 0)) / 100;
        const premiumNo = y + 1;
        const sbRate =
          premiumNo >= p.specialBonusLaterFromYear
            ? p.specialBonusLaterPct
            : premiumNo >= p.specialBonusFromYear
              ? p.specialBonusPct
              : 0;
        const sb = (p.basePremium * sbRate) / 100;
        regular += wb + sb;
        ilp.welcomeBonus += wb;
        ilp.specialBonus += sb;
      }
      if (p.monthlyTopUp > 0) {
        cash += p.monthlyTopUp;
        const charge = (p.monthlyTopUp * p.topUpChargePct) / 100;
        ilp.topUpCharge += charge;
        topUps += p.monthlyTopUp - charge;
      }
      diy += cash;
      if (purchaseMonths.has(m % 12) && (p.basePremium > 0 || p.monthlyTopUp > 0)) {
        const c = Math.min(Math.max(0, p.diyCommission), diy);
        diy -= c;
        d.commissions += c;
      }
    }
    deposits.push(cash);
    paidIn += cash;

    // Growth for the month, then charges on the grown value.
    regular *= 1 + r;
    topUps *= 1 + r;
    diy *= 1 + r;

    const feeRate = p.ilpFundFeePct / 100 / 12;
    const suppRate = y < p.suppChargeYears ? p.suppChargePct / 100 / 12 : 0;
    const feeReg = regular * feeRate;
    const feeTop = topUps * feeRate;
    const suppReg = regular * suppRate;
    const suppTop = p.suppOnTopUps ? topUps * suppRate : 0;
    regular -= feeReg + suppReg;
    topUps -= feeTop + suppTop;
    ilp.fundFee += feeReg + feeTop;
    ilp.supplementary += suppReg + suppTop;

    const ter = (diy * p.diyTerPct) / 100 / 12;
    diy -= ter;
    d.ter += ter;

    if (m % 12 === 11) rows.push({ year: y + 1, paidIn, ilp: regular + topUps, diy });
  }

  const gross = p.grossReturnPct / 100;
  const ilpFinal = regular + topUps;
  const ilpIrr = moneyWeightedReturn(deposits, ilpFinal);
  const diyIrr = moneyWeightedReturn(deposits, diy);
  return {
    rows,
    paidIn,
    ilp: {
      finalValue: ilpFinal,
      ...ilp,
      totalCharges: ilp.supplementary + ilp.fundFee + ilp.topUpCharge,
      irr: ilpIrr,
      reductionInYield: ilpIrr === null ? null : gross - ilpIrr,
    },
    diy: {
      finalValue: diy,
      ...d,
      totalCharges: d.ter + d.commissions,
      irr: diyIrr,
      reductionInYield: diyIrr === null ? null : gross - diyIrr,
    },
  };
}
