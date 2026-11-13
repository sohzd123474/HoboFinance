import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  checkFire,
  earliestFire,
  milestones,
  monthIndex,
  monthlyContribution,
  retirementSumFor,
  sellCpfis,
  sensitivity,
  sepMedisave,
  simulate,
  type Inputs,
  type PersonInput,
  type Rules,
} from './firecpf';

// CPF interest switched off so results can be worked out by hand.
const FLAT: Rules = {
  ...DEFAULT_RULES,
  oaRatePct: 0,
  smraRatePct: 0,
  extra: { ...DEFAULT_RULES.extra, below55Pct: 0, from55FirstPct: 0, from55NextPct: 0 },
  frsGrowthPct: 0,
};

const person = (over: Partial<PersonInput> = {}): PersonInput => ({
  birthYear: 1996, // 30 at the start
  birthMonth: 1,
  liquid: 0,
  oa: 0,
  cpfis: 0,
  sa: 0,
  ma: 0,
  salary: 0,
  monthlyInvest: 0,
  exitOn: false,
  exitDate: '',
  selfEmployed: false,
  sepMedisaveAnnual: 0,
  ...over,
});

const inputs = (over: Partial<Inputs> = {}, p: Partial<PersonInput> = {}): Inputs => ({
  start: '2026-01',
  people: [person(p)],
  returnPct: 0,
  inflationPct: 0,
  annualSpend: 0,
  withdrawalRatePct: 4,
  investOaSurplus: false,
  cpfisFeePct: 0,
  retirementSum: 'frs',
  bto: { on: false, date: '', downpaymentOa: 0, loanAmount: 0, ratePct: 0, tenureYears: 0, instalment: 0 },
  reno: { on: false, date: '', amount: 0 },
  reduced: { on: false, start: '', end: '', monthly: 0 },
  fireMonth: null,
  rules: FLAT,
  ...over,
});

describe('helpers', () => {
  it('counts months between dates', () => {
    expect(monthIndex('2026-11', '2027-02')).toBe(3);
    expect(monthIndex('2026-11', '2026-01')).toBe(-10);
    expect(monthIndex('2026-11', '')).toBeNull();
  });

  it('applies the 2026 contribution rate, allocation and wage ceiling', () => {
    const c = monthlyContribution(5000, 30 * 12, DEFAULT_RULES);
    expect(c.total).toBeCloseTo(1850, 6);
    expect(c.employee).toBeCloseTo(1000, 6);
    expect(c.ma).toBeCloseTo(1850 * 0.2162, 6);
    expect(c.sa).toBeCloseTo(1850 * 0.1621, 6);
    expect(c.oa + c.sa + c.ma).toBeCloseTo(1850, 6);
    // Capped at S$8,000 of wages: the published maximum is S$2,960.
    expect(monthlyContribution(10000, 30 * 12, DEFAULT_RULES).total).toBeCloseTo(2960, 6);
    // Above 55 to 60: 34%, published maximum S$2,720.
    expect(monthlyContribution(8000, 56 * 12, DEFAULT_RULES).total).toBeCloseTo(2720, 6);
    expect(monthlyContribution(0, 30 * 12, DEFAULT_RULES).total).toBe(0);
  });

  it('follows the self-employed MediSave table', () => {
    expect(sepMedisave(5000, 30)).toBe(0);
    expect(sepMedisave(10000, 30)).toBeCloseTo(400, 6);
    expect(sepMedisave(15000, 30)).toBeCloseTo(480 + 0.16 * 3000, 6);
    expect(sepMedisave(18000, 30)).toBeCloseTo(1440, 6);
    expect(sepMedisave(50000, 40)).toBeCloseTo(4500, 6);
    expect(sepMedisave(200000, 30)).toBe(7680);
    expect(sepMedisave(200000, 55)).toBe(10080);
  });

  it('returns CPFIS sale proceeds to OA', () => {
    const acct = { oa: 1000, cpfis: 5000 };
    expect(sellCpfis(acct, 2000)).toBe(2000);
    expect(acct).toEqual({ oa: 3000, cpfis: 3000 });
    expect(sellCpfis(acct, 99999)).toBe(3000);
    expect(acct).toEqual({ oa: 6000, cpfis: 0 });
  });

  it('grows the retirement sum for later cohorts and deflates it', () => {
    expect(retirementSumFor(1971, DEFAULT_RULES, 2.5, 'frs')).toBe(220400);
    expect(retirementSumFor(1971, DEFAULT_RULES, 2.5, 'brs')).toBe(110200);
    const rules = { ...DEFAULT_RULES, frsGrowthPct: 5 };
    expect(retirementSumFor(1973, rules, 0, 'frs')).toBeCloseTo(220400 * 1.05 * 1.05, 6);
    expect(retirementSumFor(1973, rules, 5, 'frs')).toBeCloseTo(220400, 6);
  });
});

describe('simulate', () => {
  it('is just the deposits at zero return and zero salary', () => {
    const sim = simulate(inputs({}, { liquid: 100000, monthlyInvest: 1000, oa: 30000, sa: 10000, ma: 5000 }));
    expect(sim.rows[0].liquid).toBe(100000);
    expect(sim.rows[1].liquid).toBeCloseTo(112000, 6);
    expect(sim.rows[1].cpf).toBeCloseTo(45000, 6);
    expect(sim.rows[1].netWorth).toBeCloseTo(157000, 6);
    expect(sim.rows[1].ages).toEqual([31]);
    expect(sim.rows[1].date).toBe('2027-01');
    // Runs until age 90.
    expect(sim.horizonMonths).toBe(60 * 12);
    expect(sim.rows).toHaveLength(61);
  });

  it('draws spending after the stop-work month and stops investing', () => {
    const sim = simulate(inputs({ fireMonth: 12, annualSpend: 24000 }, { liquid: 100000, monthlyInvest: 1000 }));
    expect(sim.rows[1].liquid).toBeCloseTo(112000, 6);
    expect(sim.rows[1].spent).toBe(0);
    expect(sim.rows[2].liquid).toBeCloseTo(88000, 6);
    expect(sim.rows[2].spent).toBeCloseTo(24000, 6);
    expect(sim.rows[2].notes.join(' ')).toContain('Stopped work');
  });

  it('treats returns in real terms', () => {
    const sim = simulate(inputs({ returnPct: 2.5, inflationPct: 2.5 }, { liquid: 100000 }));
    expect(sim.rows[5].liquid).toBeCloseTo(100000, 4);
    const real = simulate(inputs({ returnPct: 7, inflationPct: 2.5 }, { liquid: 100000 }));
    expect(real.rows[1].liquid).toBeCloseTo((100000 * 1.07) / 1.025, 4);
  });

  it('keeps the first S$20,000 of OA out of CPFIS', () => {
    const on = simulate(inputs({ investOaSurplus: true }, { oa: 50000 }));
    expect(on.rows[1].oa).toBeCloseTo(20000, 6);
    expect(on.rows[1].cpfis).toBeCloseTo(30000, 6);
    const low = simulate(inputs({ investOaSurplus: true }, { oa: 15000 }));
    expect(low.rows[1].oa).toBeCloseTo(15000, 6);
    expect(low.rows[1].cpfis).toBe(0);
    const off = simulate(inputs({ investOaSurplus: false }, { oa: 50000 }));
    expect(off.rows[1].cpfis).toBe(0);
  });

  it('grows CPFIS at the expected return less the fee', () => {
    const sim = simulate(inputs({ returnPct: 7, cpfisFeePct: 1 }, { cpfis: 10000 }));
    expect(sim.rows[1].cpfis).toBeCloseTo(10600, 4);
  });

  it('sells CPFIS into OA to pay a downpayment, leaving cash alone', () => {
    const sim = simulate(
      inputs(
        { bto: { on: true, date: '2026-01', downpaymentOa: 30000, loanAmount: 0, ratePct: 0, tenureYears: 25, instalment: 0 } },
        { oa: 10000, cpfis: 50000, liquid: 5000 },
      ),
    );
    expect(sim.rows[1].oa).toBeCloseTo(0, 6);
    expect(sim.rows[1].cpfis).toBeCloseTo(30000, 6);
    expect(sim.rows[1].liquid).toBeCloseTo(5000, 6);
  });

  it('at 55 sells CPFIS into OA, sets aside the retirement sum and withdraws the rest', () => {
    // Born February 1971: turns 55 one month after the start.
    const sim = simulate(inputs({}, { birthYear: 1971, birthMonth: 2, cpfis: 300000, sa: 20000 }));
    expect(sim.monthsTo55).toEqual([1]);
    expect(sim.rows[1].cpfis).toBe(0);
    expect(sim.rows[1].oa).toBe(0);
    expect(sim.rows[1].sara).toBeCloseTo(220400, 6);
    expect(sim.rows[1].liquid).toBeCloseTo(320000 - 220400, 6);
    // Nothing is created or lost.
    expect(sim.rows[1].netWorth).toBeCloseTo(320000, 6);
  });

  it('lets only S$5,000 out at 55 when the retirement sum is not met', () => {
    const sim = simulate(inputs({}, { birthYear: 1971, birthMonth: 2, oa: 50000, sa: 20000 }));
    expect(sim.rows[1].liquid).toBeCloseTo(5000, 6);
    expect(sim.rows[1].sara).toBeCloseTo(65000, 6);
  });

  it('pays the mortgage from OA first, then from the liquid portfolio', () => {
    const sim = simulate(
      inputs(
        { bto: { on: true, date: '2026-01', downpaymentOa: 0, loanAmount: 0, ratePct: 0, tenureYears: 25, instalment: 600 } },
        { oa: 1000, liquid: 10000 },
      ),
    );
    // 12 x 600 = 7,200 due; OA covers 1,000 and the liquid portfolio 6,200.
    expect(sim.rows[1].oa).toBeCloseTo(0, 6);
    expect(sim.rows[1].liquid).toBeCloseTo(3800, 6);
    expect(sim.rows[1].mortgageFromLiquid).toBeCloseTo(6200, 6);
    expect(sim.rows[1].notes.join(' ')).toContain('OA was short');
    expect(sim.instalment).toBe(600);
  });

  it('works out the instalment from the loan and stops at the end of the tenure', () => {
    const sim = simulate(
      inputs(
        { bto: { on: true, date: '2026-01', downpaymentOa: 0, loanAmount: 12000, ratePct: 0, tenureYears: 1, instalment: 0 } },
        { oa: 50000 },
      ),
    );
    expect(sim.instalment).toBe(1000);
    expect(sim.rows[1].oa).toBeCloseTo(38000, 6);
    expect(sim.rows[2].oa).toBeCloseTo(38000, 6);
  });

  it('shares the mortgage between two people', () => {
    const sim = simulate(
      inputs({
        people: [person({ oa: 600, liquid: 5000 }), person({ oa: 600 })],
        bto: { on: true, date: '2026-01', downpaymentOa: 0, loanAmount: 0, ratePct: 0, tenureYears: 1, instalment: 1000 },
      }),
    );
    // 12,000 due; OA covers 1,200 and the liquid portfolio 5,000; 5,800 cannot be paid.
    expect(sim.rows[1].oa).toBeCloseTo(0, 6);
    expect(sim.rows[1].liquid).toBeCloseTo(0, 6);
    expect(sim.rows[1].mortgageFromLiquid).toBeCloseTo(5000, 6);
    expect(sim.rows[1].shortfall).toBeCloseTo(5800, 6);
  });

  it('takes renovation cash from the liquid portfolio', () => {
    const sim = simulate(inputs({ reno: { on: true, date: '2026-06', amount: 40000 } }, { liquid: 100000 }));
    expect(sim.rows[1].liquid).toBeCloseTo(60000, 6);
  });

  it('stops contributions at job exit', () => {
    const sim = simulate(inputs({}, { salary: 5000, exitOn: true, exitDate: '2026-07' }));
    // Six months at 37% of 5,000.
    expect(sim.rows[1].cpf).toBeCloseTo(6 * 1850, 6);
    expect(sim.rows[2].cpf).toBeCloseTo(6 * 1850, 6);
    expect(sim.rows[1].oa).toBeCloseTo(6 * (1850 - 1850 * 0.2162 - 1850 * 0.1621), 6);
  });

  it('keeps only MediSave going when self-employed after job exit', () => {
    const sim = simulate(inputs({}, { salary: 5000, exitOn: true, exitDate: '2026-07', selfEmployed: true, sepMedisaveAnnual: 4800 }));
    expect(sim.rows[1].ma).toBeCloseTo(6 * 1850 * 0.2162 + 6 * 400, 6);
    expect(sim.rows[2].ma - sim.rows[1].ma).toBeCloseTo(4800, 6);
    expect(sim.rows[2].oa).toBeCloseTo(sim.rows[1].oa, 6);
  });

  it('stops contributions when work stops', () => {
    const sim = simulate(inputs({ fireMonth: 3 }, { salary: 5000, liquid: 1000 }));
    expect(sim.rows[1].cpf).toBeCloseTo(3 * 1850, 6);
  });

  it('uses the reduced amount during a reduced-investing period', () => {
    const sim = simulate(
      inputs({ reduced: { on: true, start: '2026-04', end: '2026-06', monthly: 200 } }, { monthlyInvest: 1000 }),
    );
    expect(sim.rows[1].liquid).toBeCloseTo(9 * 1000 + 3 * 200, 6);
  });

  it('sends MediSave contributions above the Basic Healthcare Sum to the Special Account', () => {
    const sim = simulate(inputs({}, { salary: 5000, ma: DEFAULT_RULES.bhs }));
    expect(sim.rows[1].ma).toBeCloseTo(DEFAULT_RULES.bhs, 6);
    expect(sim.rows[1].sara).toBeCloseTo(12 * 1850 * (0.1621 + 0.2162), 6);
  });

  it('pays OA interest and extra interest on the first S$60,000', () => {
    const sim = simulate(inputs({ rules: DEFAULT_RULES }, { oa: 10000 }));
    let oa = 10000;
    let sa = 0;
    for (let m = 0; m < 12; m++) {
      const extra = ((oa + sa) * 0.01) / 12;
      sa = sa * (1 + 0.04 / 12) + extra;
      oa = oa * (1 + 0.025 / 12);
    }
    expect(sim.rows[1].oa).toBeCloseTo(oa, 6);
    expect(sim.rows[1].sara).toBeCloseTo(sa, 6);
    // Only S$20,000 of OA earns the extra 1%.
    const big = simulate(inputs({ rules: DEFAULT_RULES }, { oa: 500000 }));
    expect(big.liquid).toHaveLength(big.horizonMonths + 1);
    const first = big.cpf[1] - big.cpf[0];
    expect(first).toBeCloseTo((500000 * 0.025) / 12 + (20000 * 0.01) / 12, 6);
  });

  it('records a shortfall when the liquid portfolio runs out', () => {
    const sim = simulate(inputs({ fireMonth: 0, annualSpend: 12000 }, { liquid: 6000 }));
    expect(sim.rows[1].liquid).toBeCloseTo(0, 6);
    expect(sim.rows[1].spent).toBeCloseTo(6000, 6);
    expect(sim.rows[1].shortfall).toBeCloseTo(6000, 6);
    expect(sim.shortMonths[0]).toBe(6);
  });

  it('has no NaN when optional fields are blank or zero', () => {
    const blank = {
      start: 'nonsense',
      people: [
        person({ birthYear: NaN, birthMonth: NaN, liquid: NaN, oa: NaN, cpfis: NaN, sa: NaN, ma: NaN, salary: NaN, monthlyInvest: NaN, exitOn: true, exitDate: '', selfEmployed: true, sepMedisaveAnnual: NaN }),
        person({ exitOn: true, exitDate: 'x' }),
      ],
      returnPct: NaN,
      inflationPct: NaN,
      annualSpend: NaN,
      withdrawalRatePct: NaN,
      investOaSurplus: true,
      cpfisFeePct: NaN,
      retirementSum: 'frs',
      bto: { on: true, date: '', downpaymentOa: NaN, loanAmount: NaN, ratePct: NaN, tenureYears: NaN, instalment: NaN },
      reno: { on: true, date: '', amount: NaN },
      reduced: { on: true, start: '', end: '', monthly: NaN },
      fireMonth: NaN,
      rules: DEFAULT_RULES,
    } as unknown as Inputs;
    const zero = inputs({
      bto: { on: true, date: '2026-01', downpaymentOa: 0, loanAmount: 0, ratePct: 0, tenureYears: 0, instalment: 0 },
      reno: { on: true, date: '2026-01', amount: 0 },
      reduced: { on: true, start: '2026-01', end: '2026-01', monthly: 0 },
      fireMonth: 0,
      rules: DEFAULT_RULES,
    });
    for (const input of [blank, zero]) {
      const sim = simulate(input);
      expect(sim.rows.length).toBeGreaterThan(1);
      for (const r of sim.rows) {
        for (const v of [r.liquid, r.oa, r.cpfis, r.sara, r.ma, r.cpf, r.netWorth, r.spent, r.mortgageFromLiquid, r.shortfall, ...r.ages]) {
          expect(Number.isFinite(v)).toBe(true);
        }
      }
      for (const s of [sim.liquid, sim.cpf, sim.spendable]) expect(s.every(Number.isFinite)).toBe(true);
      const f = earliestFire(input);
      expect(f.month === null || Number.isFinite(f.month)).toBe(true);
      for (const m of milestones(sim)) expect(Number.isFinite(m.totalPeak.value)).toBe(true);
    }
    expect(simulate(inputs({ people: [] })).rows).toHaveLength(0);
    expect(earliestFire(inputs({ people: [] })).month).toBeNull();
  });
});

describe('milestones', () => {
  it('finds the month each threshold is crossed, for liquid alone and with CPF', () => {
    const sim = simulate(inputs({}, { liquid: 700000, monthlyInvest: 10000, oa: 100000 }));
    const [a, b, c] = milestones(sim);
    expect(a.liquidMonth).toBe(5);
    expect(a.totalMonth).toBe(0);
    expect(b.liquidMonth).toBe(30);
    expect(b.totalMonth).toBe(20);
    expect(c.liquidMonth).toBe(50);
    expect(c.totalMonth).toBe(40);
  });

  it('reports null and the peak when a threshold is never reached', () => {
    const sim = simulate(inputs({}, { liquid: 1000 }));
    const [a] = milestones(sim);
    expect(a.liquidMonth).toBeNull();
    expect(a.totalMonth).toBeNull();
    expect(a.liquidPeak.value).toBe(1000);
  });
});

describe('earliestFire', () => {
  // Aged 50, S$500k liquid, S$500k in OA, spending S$36k a year, nothing earned.
  // Target at 4% is S$900k. Total at 55 = 1,000,000 - 3,000 x (60 - stop month),
  // so the stop month must be at least 27 (26.67 rounded up).
  const plan = inputs({ annualSpend: 36000 }, { birthYear: 1976, liquid: 500000, oa: 500000 });

  it('finds the first month that passes both conditions', () => {
    const f = earliestFire(plan);
    expect(f.target).toBeCloseTo(900000, 6);
    expect(f.month).toBe(27);
    expect(f.check!.bridgeEnd).toBe(60);
    expect(f.check!.totalAtEnd).toBeCloseTo(1000000 - 3000 * 33, 4);
  });

  it('fails the total condition when stopping too early', () => {
    const c = checkFire(plan, 0);
    expect(c.bridgeOk).toBe(true);
    expect(c.totalOk).toBe(false);
    expect(c.totalAtEnd).toBeCloseTo(820000, 4);
  });

  it('fails the bridge condition when the liquid portfolio runs out before 55', () => {
    const c = checkFire(inputs({ annualSpend: 36000 }, { birthYear: 1976, liquid: 90000, oa: 2000000 }), 0);
    expect(c.bridgeOk).toBe(false);
    expect(c.firstShort).toBe(30);
    expect(c.totalOk).toBe(true);
  });

  it('reports not reached with a reason', () => {
    const f = earliestFire(inputs({ annualSpend: 40000 }, { liquid: 1000 }));
    expect(f.month).toBeNull();
    expect(f.reason).toContain('short of');
    expect(earliestFire(inputs({ annualSpend: 40000, withdrawalRatePct: 0 })).reason).toContain('withdrawal rate');
  });

  it('is immediate when the money is already there', () => {
    expect(earliestFire(inputs({ annualSpend: 40000 }, { liquid: 5000000 })).month).toBe(0);
  });

  it('gives an earlier or equal age at a higher return', () => {
    const s = sensitivity(inputs({ annualSpend: 48000, inflationPct: 2.5, rules: DEFAULT_RULES }, { liquid: 200000, oa: 80000, sa: 40000, ma: 30000, salary: 7000, monthlyInvest: 2500 }));
    expect(s.map((x) => x.returnPct)).toEqual([5, 7, 9]);
    const months = s.map((x) => x.result.month);
    expect(months.every((m) => m !== null)).toBe(true);
    expect(months[1]!).toBeLessThanOrEqual(months[0]!);
    expect(months[2]!).toBeLessThanOrEqual(months[1]!);
  });
});
