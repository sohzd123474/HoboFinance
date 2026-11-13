import { describe, expect, it } from 'vitest';
import { effectiveRate, fire, flatLoan, futureValue, loanRepayment, savingsGoal } from './finance';

describe('futureValue', () => {
  it('matches the closed-form annuity formula', () => {
    const r = 0.06 / 12;
    const n = 240;
    const expected = 1000 * Math.pow(1 + r, n) + (200 * (Math.pow(1 + r, n) - 1)) / r;
    const g = futureValue(1000, 200, 6, 20);
    expect(g.balance).toBeCloseTo(expected, 4);
    expect(g.contributed).toBe(1000 + 200 * 240);
    expect(g.interest).toBeCloseTo(expected - g.contributed, 4);
    expect(g.series).toHaveLength(20);
  });

  it('is just the deposits at 0%', () => {
    const g = futureValue(500, 100, 0, 2);
    expect(g.balance).toBe(2900);
    expect(g.interest).toBe(0);
  });
});

describe('loanRepayment', () => {
  it('gives the textbook payment for 300k at 6% over 30 years', () => {
    const l = loanRepayment(300000, 6, 30);
    expect(l.payment).toBeCloseTo(1798.65, 2);
    expect(l.series.at(-1)!.base).toBeCloseTo(0, 4);
    expect(l.totalInterest).toBeCloseTo(l.payment * 360 - 300000, 6);
  });

  it('splits evenly at 0%', () => {
    expect(loanRepayment(12000, 0, 1).payment).toBe(1000);
  });
});

describe('savingsGoal', () => {
  it('finds a deposit that lands on the target', () => {
    const s = savingsGoal(50000, 5000, 4, 5);
    const check = futureValue(5000, s.monthly, 4, 5);
    expect(check.balance).toBeCloseTo(50000, 4);
  });

  it('needs nothing when existing savings already grow past the target', () => {
    expect(savingsGoal(1000, 5000, 4, 5).monthly).toBe(0);
  });
});

describe('fire', () => {
  it('uses spend divided by withdrawal rate as the target', () => {
    expect(fire(40000, 4, 0, 1000, 5).target).toBeCloseTo(1000000, 6);
  });

  it('reports zero years when already there', () => {
    expect(fire(40000, 4, 1000000, 0, 5).years).toBe(0);
  });

  it('reports null when it can never be reached', () => {
    expect(fire(40000, 4, 0, 0, 5).years).toBeNull();
  });

  it('reaches the target in the month the balance crosses it', () => {
    const f = fire(12000, 4, 0, 1000, 0);
    expect(f.target).toBeCloseTo(300000, 6);
    expect(f.years).toBeCloseTo(25, 6);
  });
});

describe('effectiveRate', () => {
  it('is the advertised rate compounded monthly on a reducing-balance loan with no fees', () => {
    const l = loanRepayment(300000, 4, 25);
    expect(effectiveRate(300000, l.payment, 300)).toBeCloseTo(Math.pow(1 + 0.04 / 12, 12) - 1, 8);
  });

  it('rises when a fee is taken upfront', () => {
    const l = loanRepayment(300000, 4, 25);
    expect(effectiveRate(300000 - 3000, l.payment, 300)!).toBeGreaterThan(effectiveRate(300000, l.payment, 300)!);
  });

  it('is zero when the repayments only return the money', () => {
    expect(effectiveRate(12000, 1000, 12)).toBeCloseTo(0, 8);
  });

  it('is null when the repayments do not cover the amount received', () => {
    expect(effectiveRate(12000, 900, 12)).toBeNull();
    expect(effectiveRate(0, 100, 12)).toBeNull();
  });
});

describe('flatLoan', () => {
  it('charges interest on the full amount for the whole term', () => {
    const l = flatLoan(20000, 3.5, 5);
    expect(l.totalInterest).toBeCloseTo(3500, 8);
    expect(l.payment).toBeCloseTo(23500 / 60, 8);
    expect(l.series.at(-1)!.base).toBeCloseTo(0, 6);
  });

  it('has an EIR close to double the flat rate', () => {
    // The repayments must be worth the 20,000 received when discounted at the EIR.
    const l = flatLoan(20000, 3.5, 5);
    const r = Math.pow(1 + l.eir!, 1 / 12) - 1;
    const present = (l.payment * (1 - Math.pow(1 + r, -60))) / r;
    expect(present).toBeCloseTo(20000, 4);
    expect(l.eir!).toBeGreaterThan(0.065);
    expect(l.eir!).toBeLessThan(0.07);
  });

  it('has a zero EIR at a 0% flat rate and no fee', () => {
    expect(flatLoan(12000, 0, 1).eir).toBeCloseTo(0, 8);
  });
});
