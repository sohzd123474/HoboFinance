// FIRE + CPF bridge model. Pure functions: an inputs object in, rows out.
// No DOM and no storage. Everything is in today's dollars: each month every
// balance earns its nominal return and is then divided by one month of
// inflation.

import {
  ALLOCATION_RATES,
  BHS,
  BRS_2026,
  CONTRIBUTION_RATES,
  CPFIS_OA_FLOOR,
  EXTRA_INTEREST,
  FRS_BASE_YEAR,
  FRS_BY_YEAR,
  FRS_GROWTH_PCT,
  OA_RATE_PCT,
  OW_CEILING,
  PAYOUT_AGE,
  SEP_MEDISAVE,
  SMRA_RATE_PCT,
  WITHDRAWAL_RULE,
  type AllocationBand,
  type ContributionBand,
  type ExtraInterest,
  type SepMedisave,
} from '../data/cpf';
import { loanRepayment } from './finance';

export interface Rules {
  oaRatePct: number;
  smraRatePct: number;
  extra: ExtraInterest;
  owCeiling: number;
  contribution: ContributionBand[];
  allocation: AllocationBand[];
  cpfisOaFloor: number;
  /** Full Retirement Sum for someone turning 55 in `frsBaseYear`. */
  frs: number;
  brs: number;
  frsBaseYear: number;
  /** Yearly rise in the retirement sums, before inflation. */
  frsGrowthPct: number;
  bhs: number;
  withdrawalAge: number;
  withdrawalMinimum: number;
  payoutAge: number;
  sep: SepMedisave;
}

export const DEFAULT_RULES: Rules = {
  oaRatePct: OA_RATE_PCT.value,
  smraRatePct: SMRA_RATE_PCT.value,
  extra: EXTRA_INTEREST.value,
  owCeiling: OW_CEILING.value,
  contribution: CONTRIBUTION_RATES.value,
  allocation: ALLOCATION_RATES.value,
  cpfisOaFloor: CPFIS_OA_FLOOR.value,
  frs: FRS_BY_YEAR.value[FRS_BASE_YEAR],
  brs: BRS_2026.value,
  frsBaseYear: FRS_BASE_YEAR,
  frsGrowthPct: FRS_GROWTH_PCT.value,
  bhs: BHS.value,
  withdrawalAge: WITHDRAWAL_RULE.value.age,
  withdrawalMinimum: WITHDRAWAL_RULE.value.minimum,
  payoutAge: PAYOUT_AGE.value,
  sep: SEP_MEDISAVE.value,
};

export interface PersonInput {
  birthYear: number;
  /** 1 to 12. */
  birthMonth: number;
  /** Cash and investments outside CPF. */
  liquid: number;
  oa: number;
  cpfis: number;
  sa: number;
  ma: number;
  /** Monthly gross salary. */
  salary: number;
  /** Monthly amount added to the liquid portfolio while working. */
  monthlyInvest: number;
  exitOn: boolean;
  /** YYYY-MM. CPF contributions from salary stop from this month. */
  exitDate: string;
  selfEmployed: boolean;
  /** Yearly MediSave contribution while self-employed. */
  sepMedisaveAnnual: number;
}

export interface Inputs {
  /** First simulated month, YYYY-MM. */
  start: string;
  /** One or two people. */
  people: PersonInput[];
  /** Expected yearly return on the liquid portfolio, before inflation. */
  returnPct: number;
  inflationPct: number;
  /** Household spending a year, in today's dollars. */
  annualSpend: number;
  withdrawalRatePct: number;
  investOaSurplus: boolean;
  /** Taken off the expected return for CPFIS investments. */
  cpfisFeePct: number;
  /** Which sum is set aside in the Retirement Account at 55. */
  retirementSum: 'frs' | 'brs';
  bto: {
    on: boolean;
    /** Key collection, YYYY-MM. A past date means the loan is already running. */
    date: string;
    downpaymentOa: number;
    loanAmount: number;
    ratePct: number;
    tenureYears: number;
    /** Monthly instalment. Zero or blank means work it out from the loan. */
    instalment: number;
  };
  reno: { on: boolean; date: string; amount: number };
  reduced: { on: boolean; start: string; end: string; monthly: number };
  /** Months from the start at which the household stops work. Null means never. */
  fireMonth: number | null;
  rules: Rules;
}

export interface YearRow {
  /** Months from the start. */
  month: number;
  /** YYYY-MM. */
  date: string;
  /** Age in whole years of each person. */
  ages: number[];
  liquid: number;
  oa: number;
  cpfis: number;
  /** Special Account before 55, Retirement Account after. */
  sara: number;
  ma: number;
  cpf: number;
  netWorth: number;
  /** Spending paid out during the year ending at this row. */
  spent: number;
  /** Mortgage paid from the liquid portfolio because OA was short. */
  mortgageFromLiquid: number;
  /** Spending or bills that could not be paid. */
  shortfall: number;
  notes: string[];
}

export interface SimResult {
  rows: YearRow[];
  /** Month-by-month values, index 0 is the start. */
  liquid: number[];
  cpf: number[];
  /** Liquid plus CPF without MediSave. */
  spendable: number[];
  /** Months in which something could not be paid. */
  shortMonths: number[];
  horizonMonths: number;
  /** Months from the start until each person turns 55 (0 if already 55). */
  monthsTo55: number[];
  /** Monthly mortgage instalment at key collection, 0 if none. */
  instalment: number;
}

const fin = (x: unknown, fallback = 0): number => (typeof x === 'number' && Number.isFinite(x) ? x : fallback);
const pos = (x: unknown): number => Math.max(0, fin(x));
const money = (x: number): string => `S$${Math.round(x).toLocaleString('en-SG')}`;

export function parseYm(s: unknown): { y: number; m: number } | null {
  if (typeof s !== 'string') return null;
  const hit = /^(\d{4})-(\d{1,2})$/.exec(s.trim());
  if (!hit) return null;
  const y = Number(hit[1]);
  const m = Number(hit[2]);
  return m >= 1 && m <= 12 ? { y, m } : null;
}

/** Months from `start` to `date`; null if either is not YYYY-MM. */
export function monthIndex(start: string, date: string): number | null {
  const a = parseYm(start);
  const b = parseYm(date);
  return a && b ? (b.y - a.y) * 12 + (b.m - a.m) : null;
}

export function addMonths(start: string, months: number): string {
  const a = parseYm(start) ?? { y: 2026, m: 1 };
  const total = a.y * 12 + (a.m - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Age in months at `start`. */
export function ageInMonths(start: string, birthYear: number, birthMonth: number): number {
  const a = parseYm(start) ?? { y: 2026, m: 1 };
  const by = fin(birthYear, a.y - 30);
  const bm = Math.min(12, Math.max(1, Math.round(fin(birthMonth, 1))));
  return Math.max(0, (a.y - by) * 12 + (a.m - bm));
}

function band<T extends { upToAge: number }>(bands: T[], ageMonths: number): T {
  return bands.find((b) => ageMonths <= b.upToAge * 12) ?? bands[bands.length - 1];
}

export interface Contribution {
  total: number;
  employee: number;
  oa: number;
  sa: number;
  ma: number;
}

/** One month of CPF contributions from a salary, split by account. */
export function monthlyContribution(salary: number, ageMonths: number, rules: Rules): Contribution {
  const wage = Math.min(pos(salary), pos(rules.owCeiling));
  if (wage <= 0) return { total: 0, employee: 0, oa: 0, sa: 0, ma: 0 };
  const c = band(rules.contribution, ageMonths);
  const a = band(rules.allocation, ageMonths);
  const total = wage * pos(c.total);
  const ma = total * a.ma;
  const sa = total * a.sa;
  return { total, employee: wage * pos(c.employee), oa: total - ma - sa, sa, ma };
}

/** Yearly MediSave contribution for a self-employed person, from the published table. */
export function sepMedisave(netTradeIncome: number, age: number, sep: SepMedisave = DEFAULT_RULES.sep): number {
  const nti = pos(netTradeIncome);
  if (nti <= sep.threshold) return 0;
  const b = sep.bands.find((x) => fin(age) < x.belowAge) ?? sep.bands[sep.bands.length - 1];
  if (nti <= sep.lowUpTo) return b.lowRate * nti;
  if (nti <= sep.fullFrom) return b.lowRate * sep.lowUpTo + 2 * b.fullRate * (nti - sep.lowUpTo);
  return Math.min(b.fullRate * nti, b.max);
}

/** Selling CPFIS investments: the money goes back to OA, never to cash. */
export function sellCpfis<T extends { oa: number; cpfis: number }>(acct: T, amount: number): number {
  const sold = Math.min(pos(acct.cpfis), pos(amount));
  acct.cpfis -= sold;
  acct.oa += sold;
  return sold;
}

/** Retirement sum that applies to someone born in `birthYear`, in today's dollars. */
export function retirementSumFor(birthYear: number, rules: Rules, inflationPct: number, kind: 'frs' | 'brs'): number {
  const years = Math.max(0, fin(birthYear, rules.frsBaseYear - 55) + 55 - rules.frsBaseYear);
  const real = (1 + fin(rules.frsGrowthPct) / 100) / (1 + fin(inflationPct) / 100);
  const base = kind === 'brs' ? pos(rules.brs) : pos(rules.frs);
  return base * Math.pow(real > 0 ? real : 1, years);
}

interface Person {
  label: string;
  ageM: number;
  oa: number;
  cpfis: number;
  sa: number;
  ra: number;
  ma: number;
  raDone: boolean;
  /** Sum set aside at 55 (full or basic). */
  target: number;
  /** Full Retirement Sum, the cap on contributions flowing to RA. */
  full: number;
  salary: number;
  invest: number;
  exitMonth: number | null;
  selfEmployed: boolean;
  sepMonthly: number;
}

/** Pay a bill from OA, shared equally, then from whoever has OA left. Returns the amount paid. */
function payFromOa(people: Person[], amount: number, sellInvestments: boolean): number {
  let left = amount;
  const share = amount / people.length;
  for (const p of people) {
    const pay = Math.min(p.oa, share);
    p.oa -= pay;
    left -= pay;
  }
  for (const p of people) {
    if (left <= 0) break;
    const pay = Math.min(p.oa, left);
    p.oa -= pay;
    left -= pay;
  }
  if (sellInvestments) {
    for (const p of people) {
      if (left <= 0) break;
      const sold = sellCpfis(p, left);
      p.oa -= sold;
      left -= sold;
    }
  }
  return amount - Math.max(0, left);
}

export function simulate(input: Inputs): SimResult {
  const rules = input.rules ?? DEFAULT_RULES;
  const start = parseYm(input.start) ? input.start : '2026-01';
  const infl = fin(input.inflationPct) / 100;
  const deflate = Math.pow(1 + Math.max(-0.99, infl), 1 / 12);
  const growth = (pctNominal: number) => Math.pow(Math.max(0, 1 + pctNominal / 100), 1 / 12) / deflate;
  const liquidGrowth = growth(fin(input.returnPct));
  const cpfisGrowth = growth(fin(input.returnPct) - fin(input.cpfisFeePct));
  const oaRate = fin(rules.oaRatePct) / 100 / 12;
  const smraRate = fin(rules.smraRatePct) / 100 / 12;
  const startAge = rules.withdrawalAge * 12;
  const payoutAgeM = rules.payoutAge * 12;

  const raw = (Array.isArray(input.people) ? input.people : []).slice(0, 2);
  const people: Person[] = raw.map((p, i) => ({
    label: raw.length > 1 ? `Person ${i + 1}` : 'You',
    ageM: ageInMonths(start, p.birthYear, p.birthMonth),
    oa: pos(p.oa),
    cpfis: pos(p.cpfis),
    sa: pos(p.sa),
    ra: 0,
    ma: pos(p.ma),
    raDone: false,
    target: retirementSumFor(p.birthYear, rules, input.inflationPct, input.retirementSum === 'brs' ? 'brs' : 'frs'),
    full: retirementSumFor(p.birthYear, rules, input.inflationPct, 'frs'),
    salary: pos(p.salary),
    invest: pos(p.monthlyInvest),
    exitMonth: p.exitOn ? monthIndex(start, p.exitDate) : null,
    selfEmployed: !!p.selfEmployed,
    sepMonthly: pos(p.sepMedisaveAnnual) / 12,
  }));
  let liquid = raw.reduce((s, p) => s + pos(p.liquid), 0);

  const monthsTo55 = people.map((p) => Math.max(0, startAge - p.ageM));
  const youngest = people.length ? Math.min(...people.map((p) => p.ageM)) : 0;
  const horizon = people.length ? Math.max(12, Math.ceil((90 * 12 - youngest) / 12) * 12) : 0;
  const fire = input.fireMonth === null || input.fireMonth === undefined ? null : Math.max(0, Math.round(fin(input.fireMonth)));

  const bto = input.bto ?? { on: false, date: '', downpaymentOa: 0, loanAmount: 0, ratePct: 0, tenureYears: 0, instalment: 0 };
  const keyMonth = bto.on ? monthIndex(start, bto.date) : null;
  const tenureMonths = Math.round(pos(bto.tenureYears) * 12);
  const instalment =
    keyMonth === null || tenureMonths <= 0
      ? 0
      : pos(bto.instalment) > 0
        ? pos(bto.instalment)
        : pos(bto.loanAmount) > 0
          ? loanRepayment(pos(bto.loanAmount), pos(bto.ratePct), tenureMonths / 12).payment
          : 0;
  const reno = input.reno ?? { on: false, date: '', amount: 0 };
  const renoMonth = reno.on ? monthIndex(start, reno.date) : null;
  const reduced = input.reduced ?? { on: false, start: '', end: '', monthly: 0 };
  const redStart = reduced.on ? monthIndex(start, reduced.start) : null;
  const redEnd = reduced.on ? monthIndex(start, reduced.end) : null;
  const spendMonthly = pos(input.annualSpend) / 12;

  const creditSa = (p: Person, amount: number) => {
    if (!p.raDone) {
      if (p.sa < p.full) p.sa += amount;
      else p.oa += amount;
      return;
    }
    const toRa = Math.min(amount, Math.max(0, p.full - p.ra));
    p.ra += toRa;
    p.oa += amount - toRa;
  };
  const creditMa = (p: Person, amount: number) => {
    p.ma += amount;
    const over = p.ma - pos(rules.bhs);
    if (over > 0) {
      p.ma -= over;
      creditSa(p, over);
    }
  };

  const liquidSeries: number[] = [];
  const cpfSeries: number[] = [];
  const spendableSeries: number[] = [];
  const shortMonths: number[] = [];
  const rows: YearRow[] = [];
  let notes: string[] = [];
  let spent = 0;
  let mortgageFromLiquid = 0;
  let shortfall = 0;
  let t = 0;

  const totals = () => {
    const oa = people.reduce((s, p) => s + p.oa, 0);
    const cpfis = people.reduce((s, p) => s + p.cpfis, 0);
    const sara = people.reduce((s, p) => s + p.sa + p.ra, 0);
    const ma = people.reduce((s, p) => s + p.ma, 0);
    return { oa, cpfis, sara, ma, cpf: oa + cpfis + sara + ma };
  };
  const record = () => {
    const x = totals();
    liquidSeries.push(liquid);
    cpfSeries.push(x.cpf);
    spendableSeries.push(liquid + x.cpf - x.ma);
  };
  const pushRow = (month: number) => {
    const x = totals();
    rows.push({
      month,
      date: addMonths(start, month),
      ages: people.map((p) => Math.floor(p.ageM / 12)),
      liquid,
      ...x,
      netWorth: liquid + x.cpf,
      spent,
      mortgageFromLiquid,
      shortfall,
      notes: [
        ...notes,
        ...(mortgageFromLiquid > 0.5 ? [`OA was short: ${money(mortgageFromLiquid)} of mortgage paid from the liquid portfolio`] : []),
        ...(shortfall > 0.5 ? [`Liquid portfolio ran out: ${money(shortfall)} could not be paid`] : []),
      ],
    });
    notes = [];
    spent = 0;
    mortgageFromLiquid = 0;
    shortfall = 0;
  };
  /** Take money from the liquid portfolio; anything it cannot cover is a shortfall. */
  const takeLiquid = (amount: number): number => {
    const paid = Math.min(liquid, amount);
    liquid -= paid;
    if (amount - paid > 0.005) {
      shortfall += amount - paid;
      if (shortMonths[shortMonths.length - 1] !== t) shortMonths.push(t);
    }
    return paid;
  };

  if (people.length === 0) {
    return { rows, liquid: [], cpf: [], spendable: [], shortMonths, horizonMonths: 0, monthsTo55: [], instalment };
  }

  pushRow(0);
  for (t = 0; t < horizon; t++) {
    record();
    const working = fire === null || t < fire;

    // One-off events
    if (fire !== null && t === fire) notes.push('Stopped work: salary, CPF contributions and investing end; spending is drawn');
    if (renoMonth !== null && t === renoMonth && pos(reno.amount) > 0) {
      takeLiquid(pos(reno.amount));
      notes.push(`Renovation: ${money(pos(reno.amount))} from the liquid portfolio`);
    }
    if (keyMonth !== null && t === keyMonth) {
      const due = pos(bto.downpaymentOa);
      const before = people.reduce((s, p) => s + p.cpfis, 0);
      const paid = payFromOa(people, due, true);
      const sold = before - people.reduce((s, p) => s + p.cpfis, 0);
      const rest = due - paid;
      if (rest > 0.005) takeLiquid(rest);
      notes.push(
        `BTO keys: ${money(paid)} downpayment from OA` +
          (sold > 0.5 ? ` (${money(sold)} of CPFIS sold into OA first)` : '') +
          (rest > 0.5 ? `, ${money(rest)} from the liquid portfolio because OA was short` : '') +
          (instalment > 0 ? `; mortgage of ${money(instalment)} a month starts` : ''),
      );
    }
    if (instalment > 0 && keyMonth !== null && t === keyMonth + tenureMonths && t > 0) notes.push('Mortgage fully repaid');
    if (redStart !== null && t === redStart && working) notes.push(`Reduced investing starts: ${money(pos(reduced.monthly))} a month`);
    if (redEnd !== null && redStart !== null && t === redEnd + 1 && working) notes.push('Reduced investing ends');
    for (const p of people) {
      if (p.exitMonth !== null && t === Math.max(0, p.exitMonth) && working) {
        notes.push(
          `${p.label}: job exit, salary CPF contributions stop` +
            (p.selfEmployed ? `; self-employed MediSave of ${money(p.sepMonthly * 12)} a year continues` : ''),
        );
      }
      // Turning 55: Special Account closes, Retirement Account is set aside, the rest can be withdrawn.
      if (!p.raDone && p.ageM >= startAge) {
        sellCpfis(p, p.cpfis);
        const avail = p.sa + p.oa;
        const out = avail >= p.target + rules.withdrawalMinimum ? avail - p.target : Math.min(pos(rules.withdrawalMinimum), avail);
        p.ra = avail - out;
        p.sa = 0;
        p.oa = 0;
        p.raDone = true;
        liquid += out;
        notes.push(`${p.label} at ${rules.withdrawalAge}: ${money(p.ra)} set aside in the Retirement Account, ${money(out)} withdrawn to the liquid portfolio`);
      }
    }

    // Salary contributions and investing
    for (const p of people) {
      const exited = p.exitMonth !== null && t >= p.exitMonth;
      if (working && !exited) {
        const c = monthlyContribution(p.salary, p.ageM, rules);
        p.oa += c.oa;
        creditSa(p, c.sa);
        creditMa(p, c.ma);
      } else if (working && exited && p.selfEmployed) {
        creditMa(p, p.sepMonthly);
      }
    }
    if (working) {
      const inReduced = redStart !== null && redEnd !== null && t >= redStart && t <= redEnd;
      liquid += inReduced ? pos(reduced.monthly) : people.reduce((s, p) => s + p.invest, 0);
    }

    // Mortgage: OA first, then the liquid portfolio
    if (instalment > 0 && keyMonth !== null && t >= keyMonth && t < keyMonth + tenureMonths) {
      const due = instalment / Math.pow(deflate, t - Math.max(0, keyMonth));
      const rest = due - payFromOa(people, due, false);
      if (rest > 0.005) mortgageFromLiquid += takeLiquid(rest);
    }

    // Spending after stopping work
    if (!working && spendMonthly > 0) {
      let rest = spendMonthly - Math.min(liquid, spendMonthly);
      liquid -= spendMonthly - rest;
      for (const p of people) {
        if (rest <= 0.005) break;
        if (p.ageM < payoutAgeM) continue;
        const pay = Math.min(p.ra, rest);
        p.ra -= pay;
        rest -= pay;
      }
      spent += spendMonthly - rest;
      if (rest > 0.005) {
        shortfall += rest;
        if (shortMonths[shortMonths.length - 1] !== t) shortMonths.push(t);
      }
    }

    for (const p of people) {
      // OA above the floor goes into CPFIS before 55
      if (input.investOaSurplus && !p.raDone) {
        const surplus = p.oa - pos(rules.cpfisOaFloor);
        if (surplus > 0) {
          p.oa -= surplus;
          p.cpfis += surplus;
        }
      }
      // After 55, OA is withdrawable once the retirement sum is set aside
      if (p.raDone && p.oa > 0 && p.ra >= p.target - 0.005) {
        liquid += p.oa;
        p.oa = 0;
      }
    }

    // Growth, then one month of inflation
    liquid *= liquidGrowth;
    for (const p of people) {
      const x = rules.extra;
      const tiers = p.raDone
        ? [
            { size: pos(x.firstTier), rate: fin(x.from55FirstPct) },
            { size: Math.max(0, pos(x.combinedCap) - pos(x.firstTier)), rate: fin(x.from55NextPct) },
          ]
        : [{ size: pos(x.combinedCap), rate: fin(x.below55Pct) }];
      // Balances count in this order; extra interest on OA is paid to SA (RA from 55).
      const order: { bal: number; to: 'ra' | 'sa' | 'ma' }[] = [
        { bal: p.ra, to: 'ra' },
        { bal: Math.min(p.oa, pos(x.oaCap)), to: p.raDone ? 'ra' : 'sa' },
        { bal: p.sa, to: 'sa' },
        { bal: p.ma, to: 'ma' },
      ];
      const extra = { ra: 0, sa: 0, ma: 0 };
      let tier = 0;
      let room = tiers[0].size;
      for (const o of order) {
        let bal = o.bal;
        while (bal > 0 && tier < tiers.length) {
          const use = Math.min(bal, room);
          extra[o.to] += (use * tiers[tier].rate) / 100 / 12;
          bal -= use;
          room -= use;
          if (room <= 0) {
            tier++;
            room = tier < tiers.length ? tiers[tier].size : 0;
          }
        }
      }
      p.oa = (p.oa * (1 + oaRate)) / deflate;
      p.sa = (p.sa * (1 + smraRate) + extra.sa) / deflate;
      p.ra = (p.ra * (1 + smraRate) + extra.ra) / deflate;
      p.ma = (p.ma * (1 + smraRate) + extra.ma) / deflate;
      p.cpfis = p.cpfis * cpfisGrowth;
      p.ageM++;
    }

    if ((t + 1) % 12 === 0) pushRow(t + 1);
  }
  record();

  return { rows, liquid: liquidSeries, cpf: cpfSeries, spendable: spendableSeries, shortMonths, horizonMonths: horizon, monthsTo55, instalment };
}

export interface Milestone {
  threshold: number;
  /** Months from the start at which liquid alone first reaches the threshold. */
  liquidMonth: number | null;
  /** Months from the start at which liquid plus all CPF first reaches it. */
  totalMonth: number | null;
  liquidPeak: { value: number; month: number };
  totalPeak: { value: number; month: number };
}

export const MILESTONES = [750000, 1000000, 1200000];

export function milestones(sim: SimResult, thresholds: number[] = MILESTONES): Milestone[] {
  const total = sim.liquid.map((v, i) => v + sim.cpf[i]);
  const first = (s: number[], th: number) => {
    const i = s.findIndex((v) => v >= th);
    return i < 0 ? null : i;
  };
  const peak = (s: number[]) => {
    let month = 0;
    for (let i = 1; i < s.length; i++) if (s[i] > s[month]) month = i;
    return { value: s[month] ?? 0, month };
  };
  return thresholds.map((threshold) => ({
    threshold,
    liquidMonth: first(sim.liquid, threshold),
    totalMonth: first(total, threshold),
    liquidPeak: peak(sim.liquid),
    totalPeak: peak(total),
  }));
}

export interface FireCheck {
  /** Months from the start at which work stops. */
  month: number;
  /** Month the bridge ends: the last person's 55th birthday, or the stop-work month if later. */
  bridgeEnd: number;
  /** Liquid portfolio paid for everything from stopping work to the end of the bridge. */
  bridgeOk: boolean;
  /** Liquid plus CPF without MediSave at the end of the bridge. */
  totalAtEnd: number;
  totalOk: boolean;
  /** First month something could not be paid during the bridge. */
  firstShort: number | null;
}

/** Amount needed so that yearly spending equals the withdrawal rate. */
export function fireTarget(annualSpend: number, withdrawalRatePct: number): number {
  const wr = fin(withdrawalRatePct);
  return wr > 0 ? pos(annualSpend) / (wr / 100) : Infinity;
}

/** Test one stop-work month against the two FIRE conditions. */
export function checkFire(input: Inputs, month: number): FireCheck {
  const sim = simulate({ ...input, fireMonth: month });
  const last55 = sim.monthsTo55.length ? Math.max(...sim.monthsTo55) : 0;
  const bridgeEnd = Math.min(sim.horizonMonths, Math.max(last55, month));
  const upTo = Math.max(bridgeEnd, month + 1);
  const firstShort = sim.shortMonths.find((m) => m >= month && m < upTo) ?? null;
  const totalAtEnd = sim.spendable[bridgeEnd] ?? 0;
  return {
    month,
    bridgeEnd,
    bridgeOk: firstShort === null,
    totalAtEnd,
    totalOk: totalAtEnd >= fireTarget(input.annualSpend, input.withdrawalRatePct),
    firstShort,
  };
}

export interface FireResult {
  /** Earliest stop-work month that passes both conditions, or null. */
  month: number | null;
  target: number;
  /** The check for the earliest month, or for the best failing month when none passes. */
  check: FireCheck | null;
  /** Why no month passed. */
  reason: string | null;
}

/**
 * Earliest month at which the household can stop work. Tries every 12 months
 * from now to the end of the horizon, then narrows to the month within the
 * year before the first pass.
 */
export function earliestFire(input: Inputs): FireResult {
  const target = fireTarget(input.annualSpend, input.withdrawalRatePct);
  const horizon = simulate({ ...input, fireMonth: null }).horizonMonths;
  if (horizon === 0) return { month: null, target, check: null, reason: 'No person entered.' };
  if (!Number.isFinite(target)) return { month: null, target, check: null, reason: 'The withdrawal rate must be above 0%.' };

  let best: FireCheck | null = null;
  let bridgeFails = 0;
  let totalFails = 0;
  for (let m = 0; m < horizon; m += 12) {
    const c = checkFire(input, m);
    if (c.bridgeOk && c.totalOk) {
      for (let r = Math.max(0, m - 11); r < m; r++) {
        const fine = checkFire(input, r);
        if (fine.bridgeOk && fine.totalOk) return { month: r, target, check: fine, reason: null };
      }
      return { month: m, target, check: c, reason: null };
    }
    if (!c.bridgeOk) bridgeFails++;
    if (!c.totalOk) totalFails++;
    if (!best || c.totalAtEnd > best.totalAtEnd) best = c;
  }
  const parts: string[] = [];
  if (totalFails > 0 && best) {
    parts.push(
      `the most the plan reaches at the end of the bridge is ${money(best.totalAtEnd)}, short of the ${money(target)} needed`,
    );
  }
  if (bridgeFails > 0) parts.push('the liquid portfolio runs out before CPF savings can be withdrawn at some stop-work ages');
  return { month: null, target, check: best, reason: `Within the horizon (to age 90), ${parts.join(', and ')}.` };
}

/** Earliest FIRE month at each expected return. */
export function sensitivity(input: Inputs, returns: number[] = [5, 7, 9]): { returnPct: number; result: FireResult }[] {
  return returns.map((returnPct) => ({ returnPct, result: earliestFire({ ...input, returnPct }) }));
}
