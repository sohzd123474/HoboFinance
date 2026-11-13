import { describe, expect, it } from 'vitest';
import { bySlug, calculators, CPF_SHARE_OF_TAKE_HOME, DOLLAR_RATES } from './calculators';

const defaults = (slug: string) => {
  const c = bySlug(slug)!;
  return { c, v: Object.fromEntries(c.fields.map((f) => [f.id, f.value])) as Record<string, number> };
};

describe('every calculator', () => {
  it('produces finite figures from its default inputs', () => {
    for (const c of calculators) {
      const r = c.compute(Object.fromEntries(c.fields.map((f) => [f.id, f.value])));
      for (const f of [r.headline, ...r.rows]) {
        if (f.kind !== 'text') expect(Number.isFinite(f.value as number), `${c.slug}: ${f.label}`).toBe(true);
      }
    }
  });

  it('offers quick-pick buttons within each field\'s limits', () => {
    for (const c of calculators) {
      for (const f of c.fields) {
        expect(f.presets?.length, `${c.slug}: ${f.id}`).toBeGreaterThan(0);
        for (const p of f.presets!) {
          const value = typeof p === 'number' ? p : p.value;
          expect(value).toBeGreaterThanOrEqual(f.min);
          expect(value).toBeLessThanOrEqual(f.max);
        }
      }
    }
  });
});

describe('early retirement', () => {
  it('derives the CPF share of take-home pay from the 20% and 17% rates', () => {
    expect(CPF_SHARE_OF_TAKE_HOME).toBeCloseTo(46.25, 10);
  });

  it('needs 25 times spending at a 4% withdrawal rate', () => {
    const { c, v } = defaults('early-retirement');
    const r = c.compute({ ...v, income: 100000, rate: 40, withdrawal: 4 });
    expect(r.rows.find((x) => x.label === 'You spend each year')!.value).toBe(60000);
    expect(r.rows.find((x) => x.label === 'Pot you need')!.value).toBeCloseTo(1500000, 6);
  });

  it('takes spend/saving x 25 years at zero return', () => {
    const { c, v } = defaults('early-retirement');
    // Save half: each year saved covers one year of spending, so 25 years to reach 25x.
    const r = c.compute({ ...v, income: 80000, rate: 50, current: 0, ret: 0, withdrawal: 4 });
    expect(r.headline.value).toBeCloseTo(25, 6);
  });

  it('counts CPF as extra saving and shortens the wait', () => {
    const { c, v } = defaults('early-retirement');
    const base = { ...v, income: 80000, rate: 25, current: 0, ret: 0, withdrawal: 4 };
    const without = c.compute(base);
    const withCpf = c.compute({ ...base, cpf: 46.25 });
    // Spending 60,000 needs 1.5M. Saving 20,000 a year takes 75 years; with 37,000 of CPF it takes 1.5M / 57,000.
    expect(without.headline.value as number).toBeCloseTo(75, 0);
    expect(withCpf.headline.value as number).toBeCloseTo(1500000 / 57000, 0);
    expect(withCpf.rows.find((x) => x.label === 'CPF adds each year')!.value).toBeCloseTo(37000, 6);
    expect(withCpf.rows.find((x) => x.label.startsWith('Real savings rate'))!.value).toBe('49%');
  });

  it('says so when nothing is saved', () => {
    const { c, v } = defaults('early-retirement');
    const r = c.compute({ ...v, rate: 0, current: 0 });
    expect(r.headline.kind).toBe('text');
    expect(r.note).toBeTruthy();
  });
});

describe('recurring cost', () => {
  it('works out the capital whose income covers the cost', () => {
    const { c, v } = defaults('recurring-cost');
    const r = c.compute({ ...v, amount: 20, times: 12, years: 10, ret: 0, yield: 4 });
    expect(r.headline.value).toBeCloseTo(6000, 6); // 240 a year / 4%
    expect(r.rows[0].value).toBe(240);
    expect(r.rows[1].value).toBe(2400);
    expect(r.rows[2].value).toBeCloseTo(2400, 6); // no growth at 0%
    expect(r.rows[3].value).toBeCloseTo(0, 6);
  });
});

describe('what a dollar becomes', () => {
  it('compounds once a year until retirement at each rate', () => {
    const { c, v } = defaults('dollar-at-retirement');
    const r = c.compute({ ...v, amount: 1, age: 30, retire: 65 });
    expect(r.headline.value).toBe(35);
    expect(r.rows).toHaveLength(DOLLAR_RATES.length);
    expect(r.rows[0].value).toBeCloseTo(Math.pow(1.025, 35), 10);
    expect(r.rows[5].value).toBeCloseTo(Math.pow(1.15, 35), 8);
  });

  it('shows no growth and a note when the retirement age has passed', () => {
    const { c, v } = defaults('dollar-at-retirement');
    const r = c.compute({ ...v, amount: 100, age: 60, retire: 55 });
    expect(r.rows.every((x) => x.value === 100)).toBe(true);
    expect(r.note).toBeTruthy();
  });
});
