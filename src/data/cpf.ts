// CPF rule constants used by the FIRE + CPF bridge planner.
// Every entry carries the page it was read from, the date it was read, and
// whether the figure was confirmed on that page. Anything with verified: false
// is shown with an "unverified" marker on the tool page.

export interface Sourced<T> {
  label: string;
  value: T;
  /** Page the figure was read from. */
  source: string;
  /** Date the page was read (YYYY-MM-DD). */
  asOf: string;
  verified: boolean;
  note?: string;
}

export const CPF_AS_OF = '2026-11-13';

export interface ContributionBand {
  /** Band applies up to and including the month of this birthday. */
  upToAge: number;
  /** Employer plus employee, as a fraction of ordinary wages. */
  total: number;
  /** Employee share, as a fraction of ordinary wages. */
  employee: number;
}

// Source: "CPF Contribution Rate Table from 1 January 2026", Table 1 (Singapore
// citizens and PRs from the third year, monthly wages above $750).
// https://www.cpf.gov.sg/service/sfc/servlet.shepherd/document/download/069IW00000DuRCiYAN
// linked from https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay
export const CONTRIBUTION_RATES: Sourced<ContributionBand[]> = {
  label: 'Contribution rates by age (wages above S$750 a month)',
  value: [
    { upToAge: 55, total: 0.37, employee: 0.2 },
    { upToAge: 60, total: 0.34, employee: 0.18 },
    { upToAge: 65, total: 0.25, employee: 0.125 },
    { upToAge: 70, total: 0.165, employee: 0.075 },
    { upToAge: 999, total: 0.125, employee: 0.05 },
  ],
  source: 'https://www.cpf.gov.sg/service/sfc/servlet.shepherd/document/download/069IW00000DuRCiYAN',
  asOf: CPF_AS_OF,
  verified: true,
  note: 'Rates in force from 1 January 2026. Lower graduated rates apply to wages of S$750 or less and to PRs in their first two years; these are not modelled.',
};

export interface AllocationBand {
  upToAge: number;
  /** Share of the contribution going to MediSave. */
  ma: number;
  /** Share going to the Special Account (Retirement Account from 55). */
  sa: number;
  /** Share going to the Ordinary Account. Published figure; the model uses the remainder after MA and SA. */
  oa: number;
}

// Source: "CPF Allocation Rates from 1 January 2026".
// https://www.cpf.gov.sg/service/sfc/servlet.shepherd/document/download/069IW000005qFrJYAU
export const ALLOCATION_RATES: Sourced<AllocationBand[]> = {
  label: 'Allocation of contributions by age (ratio of contribution)',
  value: [
    { upToAge: 35, oa: 0.6217, sa: 0.1621, ma: 0.2162 },
    { upToAge: 45, oa: 0.5677, sa: 0.1891, ma: 0.2432 },
    { upToAge: 50, oa: 0.5136, sa: 0.2162, ma: 0.2702 },
    { upToAge: 55, oa: 0.4055, sa: 0.3108, ma: 0.2837 },
    { upToAge: 60, oa: 0.353, sa: 0.3382, ma: 0.3088 },
    { upToAge: 65, oa: 0.14, sa: 0.44, ma: 0.42 },
    { upToAge: 70, oa: 0.0607, sa: 0.303, ma: 0.6363 },
    { upToAge: 999, oa: 0.08, sa: 0.08, ma: 0.84 },
  ],
  source: 'https://www.cpf.gov.sg/service/sfc/servlet.shepherd/document/download/069IW000005qFrJYAU',
  asOf: CPF_AS_OF,
  verified: true,
  note: 'MediSave is computed first, then the Special or Retirement Account; the remainder goes to the Ordinary Account. From 55 the Special Account share goes to the Retirement Account up to the Full Retirement Sum, then to the Ordinary Account.',
};

// Source: https://www.cpf.gov.sg/service/article/what-is-the-ordinary-wage-ow-ceiling
export const OW_CEILING: Sourced<number> = {
  label: 'Ordinary wage ceiling (S$ a month)',
  value: 8000,
  source: 'https://www.cpf.gov.sg/service/article/what-is-the-ordinary-wage-ow-ceiling',
  asOf: CPF_AS_OF,
  verified: true,
  note: 'In force from 1 January 2026.',
};

// Source: https://www.cpf.gov.sg/member/growing-your-savings/earning-higher-returns/earning-attractive-interest
export const OA_RATE_PCT: Sourced<number> = {
  label: 'Ordinary Account interest (% a year)',
  value: 2.5,
  source: 'https://www.cpf.gov.sg/member/growing-your-savings/earning-higher-returns/earning-attractive-interest',
  asOf: CPF_AS_OF,
  verified: true,
  note: 'Rate for 1 October to 31 December 2026. 2.5% is the legislated minimum.',
};

export const SMRA_RATE_PCT: Sourced<number> = {
  label: 'Special, MediSave and Retirement Account interest (% a year)',
  value: 4,
  source: 'https://www.cpf.gov.sg/member/growing-your-savings/earning-higher-returns/earning-attractive-interest',
  asOf: CPF_AS_OF,
  verified: true,
  note: 'Rate for 1 October to 31 December 2026. The 4% floor is extended to 31 December 2027; the rate after that is not known.',
};

export interface ExtraInterest {
  /** Extra % a year paid below 55 on the first `combinedCap` of combined balances. */
  below55Pct: number;
  /** From 55: extra % a year on the first `firstTier`. */
  from55FirstPct: number;
  /** From 55: extra % a year on the next tier up to `combinedCap`. */
  from55NextPct: number;
  firstTier: number;
  combinedCap: number;
  /** At most this much of the Ordinary Account counts towards the combined balance. */
  oaCap: number;
}

// Source: https://www.cpf.gov.sg/service/article/how-much-extra-interest-can-i-earn-on-my-cpf-savings
export const EXTRA_INTEREST: Sourced<ExtraInterest> = {
  label: 'Extra interest on the first S$60,000',
  value: { below55Pct: 1, from55FirstPct: 2, from55NextPct: 1, firstTier: 30000, combinedCap: 60000, oaCap: 20000 },
  source: 'https://www.cpf.gov.sg/service/article/how-much-extra-interest-can-i-earn-on-my-cpf-savings',
  asOf: CPF_AS_OF,
  verified: true,
  note: 'Balances count in this order: Retirement Account, Ordinary Account (up to S$20,000), Special Account, MediSave. Extra interest earned on Ordinary Account savings is paid into the Special Account (Retirement Account from 55).',
};

// Source: https://www.cpf.gov.sg/member/growing-your-savings/earning-higher-returns/investing-your-cpf-savings
export const CPFIS_OA_FLOOR: Sourced<number> = {
  label: 'Ordinary Account savings that cannot be invested (S$)',
  value: 20000,
  source: 'https://www.cpf.gov.sg/member/growing-your-savings/earning-higher-returns/investing-your-cpf-savings',
  asOf: CPF_AS_OF,
  verified: true,
  note: 'Stocks are also capped at 35% and gold at 10% of investible savings; those caps are not modelled.',
};

// Source: https://www.cpf.gov.sg/service/article/what-happens-when-i-sell-my-investments-under-the-cpf-investment-scheme-cpfis
export const CPFIS_SALE_RULE: Sourced<string> = {
  label: 'Where CPFIS sale proceeds go',
  value: 'Back to the CPF Investment Account, then to the Ordinary Account if not reinvested. Never to cash.',
  source: 'https://www.cpf.gov.sg/service/article/what-happens-when-i-sell-my-investments-under-the-cpf-investment-scheme-cpfis',
  asOf: CPF_AS_OF,
  verified: true,
};

// Source: https://www.cpf.gov.sg/service/article/how-much-is-my-full-retirement-sum
export const FRS_BY_YEAR: Sourced<Record<number, number>> = {
  label: 'Full Retirement Sum by year of 55th birthday (S$)',
  value: { 2024: 205800, 2025: 213000, 2026: 220400, 2027: 228200 },
  source: 'https://www.cpf.gov.sg/service/article/how-much-is-my-full-retirement-sum',
  asOf: CPF_AS_OF,
  verified: true,
};

/** The retirement sum year the model starts from. */
export const FRS_BASE_YEAR = 2026;

// The Basic Retirement Sum is half the Full Retirement Sum.
// Source: https://www.cpf.gov.sg/service/article/how-much-is-my-basic-retirement-sum
export const BRS_2026: Sourced<number> = {
  label: 'Basic Retirement Sum for those turning 55 in 2026 (S$)',
  value: 110200,
  source: 'https://www.cpf.gov.sg/service/article/how-much-is-my-basic-retirement-sum',
  asOf: CPF_AS_OF,
  verified: true,
  note: 'Read from a search result of this page, not the full page. It equals half the 2026 Full Retirement Sum.',
};

// No retirement sums are published beyond 2027. The growth figure is the rise
// from the 2026 to the 2027 Full Retirement Sum (228,200 / 220,400 - 1),
// rounded to one decimal, carried forward as an assumption.
export const FRS_GROWTH_PCT: Sourced<number> = {
  label: 'Yearly rise in the retirement sums after 2026 (%, before inflation)',
  value: Math.round((FRS_BY_YEAR.value[2027] / FRS_BY_YEAR.value[2026] - 1) * 1000) / 10,
  source: 'https://www.cpf.gov.sg/service/article/how-much-is-my-full-retirement-sum',
  asOf: CPF_AS_OF,
  verified: false,
  note: 'Computed from the published 2026 and 2027 sums. Sums for 2028 onwards have not been announced, so carrying this rate forward is an assumption.',
};

// Source: https://www.cpf.gov.sg/member/infohub/educational-resources/closure-of-special-account-for-members-aged-55-and-above-in-early-2025
// and https://www.cpf.gov.sg/member/retirement-income/milestones/reaching-age-55
export const SA_CLOSURE_RULE: Sourced<string> = {
  label: 'Special Account at 55',
  value:
    'Since January 2025 the Special Account closes at 55. Its savings move to the Retirement Account up to the Full Retirement Sum, followed by Ordinary Account savings if needed. Any Special Account savings left over move to the Ordinary Account.',
  source: 'https://www.cpf.gov.sg/member/retirement-income/milestones/reaching-age-55',
  asOf: CPF_AS_OF,
  verified: true,
};

export interface WithdrawalRule {
  age: number;
  /** Amount that can be withdrawn at 55 even when the retirement sum is not met. */
  minimum: number;
}

// Source: https://www.cpf.gov.sg/member/retirement-income/retirement-withdrawals/withdrawing-for-immediate-retirement-needs
export const WITHDRAWAL_RULE: Sourced<WithdrawalRule> = {
  label: 'Withdrawal from 55',
  value: { age: 55, minimum: 5000 },
  source: 'https://www.cpf.gov.sg/member/retirement-income/retirement-withdrawals/withdrawing-for-immediate-retirement-needs',
  asOf: CPF_AS_OF,
  verified: true,
  note: 'From 55 you can withdraw S$5,000, or your savings above the Full Retirement Sum. Property owners can pledge the property for up to half the Full Retirement Sum and withdraw savings above the Basic Retirement Sum.',
};

// Source: https://www.cpf.gov.sg/service/article/what-is-the-basic-healthcare-sum
export const BHS: Sourced<number> = {
  label: 'Basic Healthcare Sum, the most MediSave can hold (S$)',
  value: 79000,
  source: 'https://www.cpf.gov.sg/service/article/what-is-the-basic-healthcare-sum',
  asOf: CPF_AS_OF,
  verified: true,
  note: 'Figure for 2026, for members below 65. It is adjusted every year.',
};

// Source: https://www.cpf.gov.sg/service/article/i-have-saved-the-basic-healthcare-sum-bhs-in-my-medisave-account-what-happens-to-the-savings-in-my-ma-above-the-bhs
export const BHS_OVERFLOW_RULE: Sourced<string> = {
  label: 'MediSave contributions above the Basic Healthcare Sum',
  value:
    'Go to the Special Account below 55 or the Retirement Account from 55. Once the Full Retirement Sum is set aside there, they go to the Ordinary Account.',
  source:
    'https://www.cpf.gov.sg/service/article/i-have-saved-the-basic-healthcare-sum-bhs-in-my-medisave-account-what-happens-to-the-savings-in-my-ma-above-the-bhs',
  asOf: CPF_AS_OF,
  verified: true,
  note: 'Read from search results of this page, not the full page.',
};

export interface SepBand {
  /** Band applies while age on 1 January is below this. */
  belowAge: number;
  /** Rate on net trade income above S$6,000 and up to S$12,000. */
  lowRate: number;
  /** Rate on net trade income above S$18,000. */
  fullRate: number;
  /** Most that can be due in a year. */
  max: number;
}

export interface SepMedisave {
  /** No contribution at or below this yearly net trade income. */
  threshold: number;
  lowUpTo: number;
  fullFrom: number;
  bands: SepBand[];
}

// Source: "MediSave Contribution Rates for SEPs (Non-Pensioners) - Applicable for 2026".
// https://www.cpf.gov.sg/service/sfc/servlet.shepherd/document/download/069IW00000G4S1QYAV
// linked from https://www.cpf.gov.sg/MAconrate
// Between S$12,000 and S$18,000 the amount is phased in:
// lowRate x 12,000 + (2 x fullRate) x (income - 12,000).
export const SEP_MEDISAVE: Sourced<SepMedisave> = {
  label: 'Self-employed MediSave contribution (2026 work year)',
  value: {
    threshold: 6000,
    lowUpTo: 12000,
    fullFrom: 18000,
    bands: [
      { belowAge: 35, lowRate: 0.04, fullRate: 0.08, max: 7680 },
      { belowAge: 45, lowRate: 0.045, fullRate: 0.09, max: 8640 },
      { belowAge: 50, lowRate: 0.05, fullRate: 0.1, max: 9600 },
      { belowAge: 999, lowRate: 0.0525, fullRate: 0.105, max: 10080 },
    ],
  },
  source: 'https://www.cpf.gov.sg/service/sfc/servlet.shepherd/document/download/069IW00000G4S1QYAV',
  asOf: CPF_AS_OF,
  verified: true,
  note: 'Based on yearly net trade income and age on 1 January. Self-employed people are only required to contribute to MediSave.',
};

// Not confirmed on cpf.gov.sg during research. Used only to decide when the
// model may draw spending from the Retirement Account.
export const PAYOUT_AGE: Sourced<number> = {
  label: 'Age from which Retirement Account savings can be paid out',
  value: 65,
  source: 'https://www.cpf.gov.sg/member/retirement-income/monthly-payouts',
  asOf: CPF_AS_OF,
  verified: false,
  note: 'Not confirmed from the source page. CPF LIFE monthly payouts are not modelled; the model simply lets spending be drawn from the Retirement Account from this age once the liquid portfolio is empty.',
};

/** Rows for the sources table on the tool page. */
export const CPF_RULES: Sourced<unknown>[] = [
  CONTRIBUTION_RATES,
  ALLOCATION_RATES,
  OW_CEILING,
  OA_RATE_PCT,
  SMRA_RATE_PCT,
  EXTRA_INTEREST,
  CPFIS_OA_FLOOR,
  CPFIS_SALE_RULE,
  FRS_BY_YEAR,
  BRS_2026,
  FRS_GROWTH_PCT,
  SA_CLOSURE_RULE,
  WITHDRAWAL_RULE,
  BHS,
  BHS_OVERFLOW_RULE,
  SEP_MEDISAVE,
  PAYOUT_AGE,
];
