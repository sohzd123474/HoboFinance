// What the planner saves, its starting values, and the conversion to the
// model's inputs. The starting values are examples, not anyone's real figures.

import { DEFAULT_RULES, addMonths, ageInMonths, type Inputs, type PersonInput, type Rules } from '../../lib/firecpf';

export interface PersonState extends PersonInput {
  /** Yearly net trade income, used only to look up the MediSave table. */
  sepIncome: number;
}

/** The rule values a user can change in the Assumptions panel. */
export interface RuleEdits {
  oaRatePct: number;
  smraRatePct: number;
  extraPct: number;
  owCeiling: number;
  /** Total contribution rate at 55 and below, in %. */
  ratePct55: number;
  frs: number;
  brs: number;
  frsGrowthPct: number;
  bhs: number;
  cpfisOaFloor: number;
  payoutAge: number;
}

export interface PlanState {
  couple: boolean;
  people: PersonState[];
  returnPct: number;
  inflationPct: number;
  annualSpend: number;
  withdrawalRatePct: number;
  stopMode: 'earliest' | 'age';
  /** Person 1's age when work stops, used when stopMode is 'age'. */
  stopAge: number;
  investOaSurplus: boolean;
  cpfisFeePct: number;
  retirementSum: 'frs' | 'brs';
  bto: Inputs['bto'];
  reno: Inputs['reno'];
  reduced: Inputs['reduced'];
  rules: RuleEdits;
}

export const PUBLISHED_RULES: RuleEdits = {
  oaRatePct: DEFAULT_RULES.oaRatePct,
  smraRatePct: DEFAULT_RULES.smraRatePct,
  extraPct: DEFAULT_RULES.extra.below55Pct,
  owCeiling: DEFAULT_RULES.owCeiling,
  ratePct55: Math.round(DEFAULT_RULES.contribution[0].total * 1000) / 10,
  frs: DEFAULT_RULES.frs,
  brs: DEFAULT_RULES.brs,
  frsGrowthPct: DEFAULT_RULES.frsGrowthPct,
  bhs: DEFAULT_RULES.bhs,
  cpfisOaFloor: DEFAULT_RULES.cpfisOaFloor,
  payoutAge: DEFAULT_RULES.payoutAge,
};

/** This month as YYYY-MM. */
export function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const examplePerson = (start: string, age: number): PersonState => ({
  birthYear: Number(start.slice(0, 4)) - age,
  birthMonth: 1,
  liquid: 100000,
  oa: 60000,
  cpfis: 0,
  sa: 30000,
  ma: 25000,
  salary: 6000,
  monthlyInvest: 1500,
  exitOn: false,
  exitDate: addMonths(start, 60),
  selfEmployed: false,
  sepMedisaveAnnual: 0,
  sepIncome: 0,
});

export function defaultPlan(start: string): PlanState {
  return {
    couple: false,
    people: [examplePerson(start, 35), examplePerson(start, 35)],
    returnPct: 7,
    inflationPct: 2.5,
    annualSpend: 48000,
    withdrawalRatePct: 4,
    stopMode: 'earliest',
    stopAge: 50,
    investOaSurplus: false,
    cpfisFeePct: 0.5,
    retirementSum: 'frs',
    bto: { on: false, date: addMonths(start, 36), downpaymentOa: 50000, loanAmount: 300000, ratePct: 2.6, tenureYears: 25, instalment: 0 },
    reno: { on: false, date: addMonths(start, 36), amount: 50000 },
    reduced: { on: false, start: addMonths(start, 12), end: addMonths(start, 36), monthly: 500 },
    rules: PUBLISHED_RULES,
  };
}

/** Fill any gaps in a saved plan (older saves, hand-edited imports) from the defaults. */
export function normalise(saved: PlanState, start: string): PlanState {
  const d = defaultPlan(start);
  const obj = <T extends object>(v: unknown, fallback: T): T =>
    v && typeof v === 'object' && !Array.isArray(v) ? { ...fallback, ...(v as Partial<T>) } : fallback;
  const people = Array.isArray(saved.people) ? saved.people : [];
  return {
    ...d,
    ...saved,
    people: [obj(people[0], d.people[0]), obj(people[1], d.people[1])],
    bto: obj(saved.bto, d.bto),
    reno: obj(saved.reno, d.reno),
    reduced: obj(saved.reduced, d.reduced),
    rules: obj(saved.rules, d.rules),
  };
}

export function toRules(e: RuleEdits): Rules {
  return {
    ...DEFAULT_RULES,
    oaRatePct: e.oaRatePct,
    smraRatePct: e.smraRatePct,
    extra: { ...DEFAULT_RULES.extra, below55Pct: e.extraPct },
    owCeiling: e.owCeiling,
    contribution: DEFAULT_RULES.contribution.map((b, i) => (i === 0 ? { ...b, total: e.ratePct55 / 100 } : b)),
    frs: e.frs,
    brs: e.brs,
    frsGrowthPct: e.frsGrowthPct,
    bhs: e.bhs,
    cpfisOaFloor: e.cpfisOaFloor,
    payoutAge: e.payoutAge,
  };
}

/** Model inputs for a plan, with the stop-work month left open. */
export function toInputs(plan: PlanState, start: string): Inputs {
  return {
    start,
    people: plan.couple ? plan.people.slice(0, 2) : plan.people.slice(0, 1),
    returnPct: plan.returnPct,
    inflationPct: plan.inflationPct,
    annualSpend: plan.annualSpend,
    withdrawalRatePct: plan.withdrawalRatePct,
    investOaSurplus: plan.investOaSurplus,
    cpfisFeePct: plan.cpfisFeePct,
    retirementSum: plan.retirementSum,
    bto: plan.bto,
    reno: plan.reno,
    reduced: plan.reduced,
    fireMonth: null,
    rules: toRules(plan.rules),
  };
}

/** Each person's age in months at the start. */
export const startAges = (inputs: Inputs): number[] => inputs.people.map((p) => ageInMonths(inputs.start, p.birthYear, p.birthMonth));

/** "47 years 3 months". */
export function ageText(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} years` : `${y} years ${m} ${m === 1 ? 'month' : 'months'}`;
}
