import { describe, expect, it } from 'vitest';
import { moneyWeightedReturn, simulateIlp, welcomeBonusRate, type IlpParams } from './ilp';

// Everything switched off: no charges, no bonuses, no growth.
const ZERO: IlpParams = {
  basePremium: 12000,
  monthlyTopUp: 0,
  iipYears: 10,
  keepPaying: false,
  years: 30,
  grossReturnPct: 0,
  ilpFundFeePct: 0,
  suppChargePct: 0,
  suppChargeYears: 10,
  suppOnTopUps: false,
  topUpChargePct: 0,
  welcomeBonusPct: [0, 0, 0],
  specialBonusFromYear: 10,
  specialBonusPct: 0,
  specialBonusLaterFromYear: 21,
  specialBonusLaterPct: 0,
  diyTerPct: 0,
  diyCommission: 0,
  diyPurchasesPerYear: 12,
};

describe('simulateIlp', () => {
  it('gives identical values for both routes when there are no charges or bonuses', () => {
    const r = simulateIlp({ ...ZERO, monthlyTopUp: 200, grossReturnPct: 6 });
    expect(r.rows).toHaveLength(30);
    r.rows.forEach((row) => expect(row.ilp).toBeCloseTo(row.diy, 6));
    expect(r.ilp.totalCharges).toBe(0);
    expect(r.diy.totalCharges).toBe(0);
    expect(r.paidIn).toBe(10 * 12000 + 120 * 200);
  });

  it('matches compound growth for a single premium', () => {
    const r = simulateIlp({ ...ZERO, iipYears: 1, grossReturnPct: 6 });
    expect(r.rows[0].ilp).toBeCloseTo(12000 * 1.06, 6);
    expect(r.ilp.finalValue).toBeCloseTo(12000 * Math.pow(1.06, 30), 4);
  });

  it('stops premiums at the end of the IIP unless told to keep paying', () => {
    expect(simulateIlp(ZERO).ilp.finalValue).toBe(120000);
    expect(simulateIlp({ ...ZERO, keepPaying: true }).ilp.finalValue).toBe(360000);
  });

  it('takes exactly 5% from top-ups', () => {
    const r = simulateIlp({ ...ZERO, basePremium: 0, monthlyTopUp: 100, iipYears: 1, years: 1, topUpChargePct: 5 });
    expect(r.paidIn).toBe(1200);
    expect(r.ilp.topUpCharge).toBeCloseTo(60, 9);
    expect(r.ilp.finalValue).toBeCloseTo(1140, 9);
    expect(r.diy.finalValue).toBeCloseTo(1200, 9);
  });

  it('takes the supplementary charge monthly on the account value', () => {
    const r = simulateIlp({ ...ZERO, basePremium: 1200, iipYears: 1, years: 1, suppChargePct: 3.9 });
    const expected = 1200 * Math.pow(1 - 0.039 / 12, 12);
    expect(r.ilp.finalValue).toBeCloseTo(expected, 9);
    expect(r.ilp.supplementary).toBeCloseTo(1200 - expected, 9);
  });

  it('stops the supplementary charge after year 10', () => {
    const r = simulateIlp({ ...ZERO, suppChargePct: 3.9 });
    const y9 = r.rows[8].ilp;
    const y10 = r.rows[9].ilp;
    // Year 10 still charged: 12,000 comes in and the whole account loses 12 monthly charges.
    expect(y10).toBeCloseTo((y9 + 12000) * Math.pow(1 - 0.039 / 12, 12), 6);
    // Nothing changes afterwards.
    expect(r.rows[10].ilp).toBeCloseTo(y10, 9);
    expect(r.rows[29].ilp).toBeCloseTo(y10, 9);
    expect(r.ilp.supplementary).toBeCloseTo(120000 - y10, 6);
  });

  it('leaves top-up units out of the supplementary charge unless asked', () => {
    const base = { ...ZERO, basePremium: 0, monthlyTopUp: 100, iipYears: 1, years: 1, suppChargePct: 3.9 };
    expect(simulateIlp(base).ilp.supplementary).toBe(0);
    expect(simulateIlp({ ...base, suppOnTopUps: true }).ilp.supplementary).toBeGreaterThan(0);
  });

  it('takes the fund fee for the whole projection', () => {
    const r = simulateIlp({ ...ZERO, basePremium: 1000, iipYears: 1, years: 2, ilpFundFeePct: 1.2 });
    expect(r.ilp.finalValue).toBeCloseTo(1000 * Math.pow(1 - 0.001, 24), 9);
    expect(r.ilp.fundFee).toBeCloseTo(1000 - r.ilp.finalValue, 9);
  });

  it('adds the welcome bonus as a share of the base premium in the years given', () => {
    const r = simulateIlp({ ...ZERO, welcomeBonusPct: [75, 75, 75] });
    expect(r.rows[0].ilp).toBeCloseTo(12000 * 1.75, 9);
    expect(r.ilp.welcomeBonus).toBeCloseTo(3 * 9000, 9);
    expect(r.ilp.finalValue).toBeCloseTo(120000 + 27000, 9);
  });

  it('pays the special bonus only with premiums actually paid', () => {
    const p = { ...ZERO, specialBonusPct: 5, specialBonusLaterPct: 8 };
    // IIP 10: only the 10th premium qualifies.
    expect(simulateIlp(p).ilp.specialBonus).toBeCloseTo(600, 9);
    // Paying for 30 years: premiums 10 to 20 at 5% (11 of them), 21 to 30 at 8% (10 of them).
    expect(simulateIlp({ ...p, keepPaying: true }).ilp.specialBonus).toBeCloseTo(11 * 600 + 10 * 960, 9);
  });

  it('charges one commission per purchase and the TER on the DIY side', () => {
    const r = simulateIlp({ ...ZERO, iipYears: 2, years: 2, diyCommission: 2, diyPurchasesPerYear: 12 });
    expect(r.diy.commissions).toBe(48);
    expect(r.diy.finalValue).toBe(24000 - 48);
    const once = simulateIlp({ ...ZERO, iipYears: 2, years: 2, diyCommission: 2, diyPurchasesPerYear: 1 });
    expect(once.diy.commissions).toBe(4);
    const ter = simulateIlp({ ...ZERO, basePremium: 1000, iipYears: 1, years: 1, diyTerPct: 0.12 });
    expect(ter.diy.finalValue).toBeCloseTo(1000 * Math.pow(1 - 0.0001, 12), 9);
  });

  it('reports no reduction in yield when nothing is charged', () => {
    const r = simulateIlp({ ...ZERO, monthlyTopUp: 100, grossReturnPct: 6 });
    expect(r.ilp.irr).toBeCloseTo(0.06, 8);
    expect(r.ilp.reductionInYield).toBeCloseTo(0, 8);
    expect(r.diy.reductionInYield).toBeCloseTo(0, 8);
  });

  it('reports a reduction in yield close to the yearly fee for a steady fee', () => {
    const r = simulateIlp({ ...ZERO, grossReturnPct: 6, diyTerPct: 0.24 });
    // (1.06)^(1/12) x (1 - 0.0002) each month.
    const net = Math.pow(Math.pow(1.06, 1 / 12) * (1 - 0.0002), 12) - 1;
    expect(r.diy.irr).toBeCloseTo(net, 8);
  });
});

describe('moneyWeightedReturn', () => {
  it('recovers the rate of a single deposit', () => {
    const deposits = [1000, ...Array(23).fill(0)];
    expect(moneyWeightedReturn(deposits, 1210)).toBeCloseTo(0.1, 8);
  });

  it('is null when nothing was paid in', () => {
    expect(moneyWeightedReturn([0, 0], 0)).toBeNull();
  });
});

describe('welcomeBonusRate', () => {
  it('reads the table by IIP and premium band', () => {
    expect(welcomeBonusRate(20, 12000)).toBe(75);
    expect(welcomeBonusRate(20, 11999)).toBe(60);
    expect(welcomeBonusRate(10, 2400)).toBe(5);
    expect(welcomeBonusRate(15, 5000)).toBe(33);
  });

  it('is null below the lowest band or for an IIP not in the table', () => {
    expect(welcomeBonusRate(20, 2399)).toBeNull();
    expect(welcomeBonusRate(12, 12000)).toBeNull();
  });
});
