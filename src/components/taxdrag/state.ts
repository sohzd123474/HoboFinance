// Saved inputs for the ETF tax-drag calculator and the one path that turns
// them into results. Shared by the page and the report summary so both show
// the same figures.
import { ETFS, etfByTicker, type Etf } from '../../data/etfs';
import { breakEvenSize, dragRate, project, yearlyCommission, type BreakEven, type YearRow } from '../../lib/taxdrag';

export const storageKey = 'taxdrag';

// Fractions in the data file become percentages in the inputs.
export const toPct = (fraction: number) => Math.round(fraction * 1e6) / 1e4;

export const DEFAULT_A = etfByTicker('VOO') ?? ETFS[0];
export const DEFAULT_B = etfByTicker('CSPX') ?? ETFS[1];

export const DEFAULTS = {
  size: 100000,
  added: 12000,
  grossReturn: 7,
  dividendYield: toPct(DEFAULT_A.dividendYield ?? 0),
  years: 30,
  commission: 0,
  orders: 12,
  fundA: DEFAULT_A.ticker,
  erA: toPct(DEFAULT_A.expenseRatio),
  whtA: toPct(DEFAULT_A.withholding),
  fundB: DEFAULT_B.ticker,
  erB: toPct(DEFAULT_B.expenseRatio),
  whtB: toPct(DEFAULT_B.withholding),
};
export type State = typeof DEFAULTS;

export interface FundResult {
  etf: Etf;
  feeRate: number;
  taxRate: number;
  drag: number;
  commission: number;
  rows: YearRow[];
  ending: number;
}

export interface TaxDragResult {
  etfA: Etf;
  etfB: Etf;
  /** Years actually used: a whole number from 1 to 60. */
  years: number;
  a: FundResult;
  b: FundResult;
  /** Extra commission a year for an Ireland-domiciled fund. */
  perYear: number;
  /** Set only when exactly one of the two funds is Ireland-domiciled. */
  irish: FundResult | null;
  other: FundResult;
  breakEven: BreakEven | null;
  nameA: string;
  nameB: string;
}

export function compute(o: State): TaxDragResult {
  const etfA = etfByTicker(o.fundA) ?? DEFAULT_A;
  const etfB = etfByTicker(o.fundB) ?? DEFAULT_B;
  const years = Math.min(60, Math.max(1, Math.round(o.years)));
  const y = o.dividendYield / 100;
  const perYear = yearlyCommission(o.commission, o.orders, o.added);
  const make = (etf: Etf, erPct: number, whtPct: number): FundResult => {
    const feeRate = erPct / 100;
    const taxRate = dragRate(0, y, whtPct / 100);
    const drag = dragRate(feeRate, y, whtPct / 100);
    const commission = etf.domicile === 'IE' ? perYear : 0;
    const rows = project({ start: o.size, yearlyAdded: o.added, grossReturn: o.grossReturn / 100, drag, years, yearlyCost: commission });
    return { etf, feeRate, taxRate, drag, commission, rows, ending: rows[rows.length - 1].value };
  };
  const a = make(etfA, o.erA, o.whtA);
  const b = make(etfB, o.erB, o.whtB);
  const irish = a.etf.domicile === 'IE' && b.etf.domicile !== 'IE' ? a : b.etf.domicile === 'IE' && a.etf.domicile !== 'IE' ? b : null;
  const other = irish === a ? b : a;
  const breakEven = irish ? breakEvenSize(other.drag, irish.drag, perYear) : null;
  const nameA = a.etf.ticker;
  const nameB = a.etf.ticker === b.etf.ticker ? `${b.etf.ticker} (second)` : b.etf.ticker;
  return { etfA, etfB, years, a, b, perYear, irish, other, breakEven, nameA, nameB };
}
