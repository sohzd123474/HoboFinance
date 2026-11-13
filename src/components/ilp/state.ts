// Saved inputs for the ILP vs DIY page, shared by the page and the report
// summary so both compute exactly the same figures.

import { ILP_DEFAULTS, WELCOME_BONUS_YEARS, welcomeBonusRate, type IlpParams } from '../../lib/ilp';

export const STORAGE_KEY = 'ilp';
export const YEARS = 30;

export type Tab = 'chart' | 'table' | 'fees';

export const DEFAULTS = {
  basePremium: 6000,
  monthlyTopUp: 0,
  iipYears: 20,
  keepPaying: false,
  grossReturnPct: 6,
  ilpFundFeePct: ILP_DEFAULTS.ilpFundFeePct as number,
  suppChargePct: ILP_DEFAULTS.suppChargePct as number,
  suppChargeYears: ILP_DEFAULTS.suppChargeYears as number,
  suppOnTopUps: false,
  topUpChargePct: ILP_DEFAULTS.topUpChargePct as number,
  /** When true the welcome bonus follows the table for the chosen IIP and premium. */
  bonusFromTable: true,
  welcomeBonusPct: [0, 0, 0],
  specialBonusFromYear: ILP_DEFAULTS.specialBonusFromYear as number,
  specialBonusPct: ILP_DEFAULTS.specialBonusPct as number,
  specialBonusLaterFromYear: ILP_DEFAULTS.specialBonusLaterFromYear as number,
  specialBonusLaterPct: ILP_DEFAULTS.specialBonusLaterPct as number,
  diyTerPct: ILP_DEFAULTS.diyTerPct as number,
  diyCommission: ILP_DEFAULTS.diyCommission as number,
  diyPurchasesPerYear: ILP_DEFAULTS.diyPurchasesPerYear as number,
  tab: 'chart' as Tab,
};
export type State = typeof DEFAULTS;

/** Turn saved state into the inputs of simulateIlp. */
export function toParams(o: State): { params: IlpParams; tableRate: number | null; manual: number[] } {
  const tableRate = welcomeBonusRate(o.iipYears, o.basePremium);
  const manual = Array.from({ length: WELCOME_BONUS_YEARS }, (_, i) => o.welcomeBonusPct[i] ?? 0);
  const welcome = o.bonusFromTable ? Array.from({ length: WELCOME_BONUS_YEARS }, () => tableRate ?? 0) : manual;
  const params: IlpParams = {
    basePremium: o.basePremium,
    monthlyTopUp: o.monthlyTopUp,
    iipYears: o.iipYears,
    keepPaying: o.keepPaying,
    years: YEARS,
    grossReturnPct: o.grossReturnPct,
    ilpFundFeePct: o.ilpFundFeePct,
    suppChargePct: o.suppChargePct,
    suppChargeYears: o.suppChargeYears,
    suppOnTopUps: o.suppOnTopUps,
    topUpChargePct: o.topUpChargePct,
    welcomeBonusPct: welcome,
    specialBonusFromYear: o.specialBonusFromYear,
    specialBonusPct: o.specialBonusPct,
    specialBonusLaterFromYear: o.specialBonusLaterFromYear,
    specialBonusLaterPct: o.specialBonusLaterPct,
    diyTerPct: o.diyTerPct,
    diyCommission: o.diyCommission,
    diyPurchasesPerYear: o.diyPurchasesPerYear,
  };
  return { params, tableRate, manual };
}
