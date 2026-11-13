import { fire, futureValue, loanRepayment, savingsGoal, type YearPoint } from './finance';

export type ValueKind = 'money' | 'years' | 'text';

export interface Field {
  id: string;
  label: string;
  unit: 'money' | 'percent' | 'years';
  value: number;
  min: number;
  max: number;
  step: number;
  hint?: string;
}

export interface Figure {
  label: string;
  value: number | string;
  kind: ValueKind;
}

export interface Result {
  headline: Figure;
  rows: Figure[];
  series: YearPoint[];
  /** Names for the two stacked parts of each bar; one name means a single series. */
  legend: string[];
  note?: string;
}

export interface Calculator {
  slug: string;
  title: string;
  blurb: string;
  fields: Field[];
  compute: (v: Record<string, number>) => Result;
  explain: string[];
}

export const calculators: Calculator[] = [
  {
    slug: 'compound-interest',
    title: 'Compound interest',
    blurb: 'See what regular saving grows into once interest starts earning interest.',
    fields: [
      { id: 'principal', label: 'Starting amount', unit: 'money', value: 1000, min: 0, max: 100000000, step: 100 },
      { id: 'monthly', label: 'Added each month', unit: 'money', value: 200, min: 0, max: 1000000, step: 10 },
      { id: 'rate', label: 'Yearly growth', unit: 'percent', value: 6, min: 0, max: 30, step: 0.1 },
      { id: 'years', label: 'Time', unit: 'years', value: 20, min: 1, max: 60, step: 1 },
    ],
    compute: (v) => {
      const g = futureValue(v.principal, v.monthly, v.rate, v.years);
      return {
        headline: { label: `Balance after ${v.years} years`, value: g.balance, kind: 'money' },
        rows: [
          { label: 'You put in', value: g.contributed, kind: 'money' },
          { label: 'Growth earned', value: g.interest, kind: 'money' },
        ],
        series: g.series,
        legend: ['You put in', 'Growth'],
      };
    },
    explain: [
      'Each month the balance grows by one twelfth of the yearly rate, then your monthly amount is added. Growth is worked out on the whole balance, including earlier growth, which is why the curve bends upward.',
      'The rate is a steady average. Real investments move up and down from year to year, and fees and tax are not included.',
    ],
  },
  {
    slug: 'loan-repayment',
    title: 'Loan repayment',
    blurb: 'Work out the monthly repayment on a home, car or personal loan, and what it costs in interest.',
    fields: [
      { id: 'amount', label: 'Amount borrowed', unit: 'money', value: 300000, min: 100, max: 100000000, step: 1000 },
      { id: 'rate', label: 'Interest rate per year', unit: 'percent', value: 4, min: 0, max: 40, step: 0.05 },
      { id: 'years', label: 'Loan length', unit: 'years', value: 25, min: 1, max: 40, step: 1 },
    ],
    compute: (v) => {
      const l = loanRepayment(v.amount, v.rate, v.years);
      return {
        headline: { label: 'Monthly repayment', value: l.payment, kind: 'money' },
        rows: [
          { label: 'Total repaid', value: l.totalPaid, kind: 'money' },
          { label: 'Of which interest', value: l.totalInterest, kind: 'money' },
        ],
        series: l.series,
        legend: ['Still owed'],
      };
    },
    explain: [
      'This is a reducing-balance loan with equal monthly repayments. Interest is charged each month on what you still owe, so early repayments are mostly interest and later ones mostly pay off the loan.',
      'It assumes the rate stays the same for the whole loan and leaves out fees and insurance. Flat-rate loans, common for cars, are worked out differently and cost more than the same headline rate here.',
    ],
  },
  {
    slug: 'savings-goal',
    title: 'Savings goal',
    blurb: 'Find the monthly amount that gets you to a target by a date you choose.',
    fields: [
      { id: 'target', label: 'Target amount', unit: 'money', value: 50000, min: 1, max: 100000000, step: 500 },
      { id: 'current', label: 'Saved so far', unit: 'money', value: 5000, min: 0, max: 100000000, step: 100 },
      { id: 'rate', label: 'Yearly interest', unit: 'percent', value: 3, min: 0, max: 30, step: 0.1 },
      { id: 'years', label: 'Time to get there', unit: 'years', value: 5, min: 1, max: 50, step: 1 },
    ],
    compute: (v) => {
      const s = savingsGoal(v.target, v.current, v.rate, v.years);
      return {
        headline: { label: 'Save each month', value: s.monthly, kind: 'money' },
        rows: [
          { label: 'You put in', value: s.contributed, kind: 'money' },
          { label: 'Interest earned', value: s.interest, kind: 'money' },
        ],
        series: s.series,
        legend: ['You put in', 'Interest'],
        note: s.monthly === 0 ? 'What you have already saved reaches the target on interest alone.' : undefined,
      };
    },
    explain: [
      'First your existing savings are grown for the full period. Whatever is still missing is spread into equal monthly deposits, allowing for the interest those deposits earn along the way.',
      'Prices rise over time. For a goal several years away, raise the target a little or use a lower interest rate to allow for that.',
    ],
  },
  {
    slug: 'financial-independence',
    title: 'Financial independence',
    blurb: 'Estimate the pot you need to live off your investments, and how many years of saving it takes.',
    fields: [
      { id: 'spend', label: 'Yearly spending', unit: 'money', value: 36000, min: 1, max: 10000000, step: 500 },
      { id: 'withdrawal', label: 'Withdrawal rate', unit: 'percent', value: 4, min: 1, max: 10, step: 0.1, hint: 'Share of the pot you spend each year. 4% is the usual starting point.' },
      { id: 'current', label: 'Invested so far', unit: 'money', value: 20000, min: 0, max: 100000000, step: 1000 },
      { id: 'monthly', label: 'Invested each month', unit: 'money', value: 1500, min: 0, max: 1000000, step: 50 },
      { id: 'rate', label: 'Yearly return after inflation', unit: 'percent', value: 5, min: 0, max: 15, step: 0.1 },
    ],
    compute: (v) => {
      const f = fire(v.spend, v.withdrawal, v.current, v.monthly, v.rate);
      return {
        headline: { label: 'Pot you need', value: f.target, kind: 'money' },
        rows: [
          f.years === null
            ? { label: 'Time to get there', value: 'More than 100 years', kind: 'text' }
            : { label: 'Time to get there', value: f.years, kind: 'years' },
        ],
        series: f.series,
        legend: ['You put in', 'Growth'],
        note: f.years === null ? 'At this rate the pot never reaches the target. Try a larger monthly amount.' : undefined,
      };
    },
    explain: [
      'The pot is your yearly spending divided by the withdrawal rate: at 4%, that is 25 times what you spend in a year. The time is how long your monthly investing takes to grow to that pot.',
      'Using a return after inflation keeps every figure in today’s money. The 4% rate comes from studies of 30-year retirements in US markets; a longer retirement or different markets may call for a lower rate.',
    ],
  },
];

export const bySlug = (slug: string) => calculators.find((c) => c.slug === slug);
