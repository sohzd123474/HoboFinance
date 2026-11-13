import { describe, expect, it } from 'vitest';
import { clampMonths, monthlyCompoundInterest, parkingResult, simpleInterest } from './parking';

describe('simpleInterest', () => {
  it('pays half a year of interest for six months', () => {
    // S$10,000 at 3% for 6 months = S$150
    expect(simpleInterest(10000, 3, 6)).toBeCloseTo(150, 10);
  });
  it('is zero at 0%', () => {
    expect(simpleInterest(10000, 0, 12)).toBe(0);
  });
});

describe('monthlyCompoundInterest', () => {
  it('matches the compound formula over a year', () => {
    expect(monthlyCompoundInterest(10000, 3, 12)).toBeCloseTo(10000 * (Math.pow(1.0025, 12) - 1), 8);
    // Known value: 3% compounded monthly is an effective 3.0416%
    expect(monthlyCompoundInterest(10000, 3, 12)).toBeCloseTo(304.16, 2);
  });
  it('equals simple interest for a single month', () => {
    expect(monthlyCompoundInterest(10000, 3, 1)).toBeCloseTo(simpleInterest(10000, 3, 1), 10);
  });
  it('is zero at 0%', () => {
    expect(monthlyCompoundInterest(10000, 0, 24)).toBe(0);
  });
});

describe('clampMonths', () => {
  it('keeps months within 1 to 24', () => {
    expect(clampMonths(0)).toBe(1);
    expect(clampMonths(36)).toBe(24);
    expect(clampMonths(6.4)).toBe(6);
    expect(clampMonths(NaN)).toBe(1);
  });
});

describe('parkingResult', () => {
  it('adds interest to the amount', () => {
    expect(parkingResult(10000, 3, 6, 'simple')).toEqual({ interest: 150, ending: 10150 });
  });
  it('pays more with monthly compounding than simple interest over the same time', () => {
    const s = parkingResult(10000, 3, 24, 'simple');
    const c = parkingResult(10000, 3, 24, 'monthly');
    expect(s.interest).toBeCloseTo(600, 10);
    expect(c.interest).toBeGreaterThan(s.interest);
  });
  it('clamps the months', () => {
    expect(parkingResult(10000, 3, 60, 'simple').interest).toBeCloseTo(600, 10);
  });
});
