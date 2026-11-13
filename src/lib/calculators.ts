import { fire, futureValue, loanRepayment, savingsGoal, type YearPoint } from './finance';

export type ValueKind = 'money' | 'years' | 'text';

export interface Field {
  id: string;
  label: string;
  unit: 'money' | 'percent' | 'years' | 'count';
  value: number;
  /** Quick-pick buttons shown under the input. */
  presets?: (number | { label: string; value: number })[];
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

/**
 * CPF contributions for an employee aged 55 or under: 20% of the wage from the
 * employee and 17% from the employer. Take-home pay is the other 80% of the
 * wage, so total CPF is 37 / 80 = 46.25% of take-home pay.
 * Source: https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay
 */
export const CPF_EMPLOYEE_RATE = 20;
export const CPF_EMPLOYER_RATE = 17;
export const CPF_SHARE_OF_TAKE_HOME = ((CPF_EMPLOYEE_RATE + CPF_EMPLOYER_RATE) / (100 - CPF_EMPLOYEE_RATE)) * 100;

/** Rates compared in the "what a dollar becomes" calculator. */
export const DOLLAR_RATES = [
  { rate: 2.5, label: 'CPF Ordinary Account' },
  { rate: 4, label: 'CPF Special and MediSave' },
  { rate: 5, label: 'dividend shares' },
  { rate: 7, label: 'S&P 500 after inflation' },
  { rate: 10, label: 'S&P 500 long-run average' },
  { rate: 15, label: 'an exceptional run' },
];

export const calculators: Calculator[] = [
  {
    slug: 'compound-interest',
    title: 'Compound interest',
    blurb: 'See what regular saving grows into once interest starts earning interest.',
    fields: [
      { id: 'principal', label: 'Starting amount', unit: 'money', value: 1000, min: 0, max: 100000000, step: 100, presets: [0, 1000, 10000, 50000] },
      { id: 'monthly', label: 'Added each month', unit: 'money', value: 200, min: 0, max: 1000000, step: 10, presets: [100, 200, 500, 1000, 2000] },
      { id: 'rate', label: 'Yearly growth', unit: 'percent', value: 6, min: 0, max: 30, step: 0.1, presets: [2.5, 4, 6, 8, 10] },
      { id: 'years', label: 'Time', unit: 'years', value: 20, min: 1, max: 60, step: 1, presets: [5, 10, 20, 30, 40] },
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
      { id: 'amount', label: 'Amount borrowed', unit: 'money', value: 300000, min: 100, max: 100000000, step: 1000, presets: [20000, 100000, 300000, 500000, 800000] },
      { id: 'rate', label: 'Interest rate per year', unit: 'percent', value: 4, min: 0, max: 40, step: 0.05, presets: [2.6, 3, 3.5, 4, 5] },
      { id: 'years', label: 'Loan length', unit: 'years', value: 25, min: 1, max: 40, step: 1, presets: [5, 7, 15, 25, 30] },
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
      { id: 'target', label: 'Target amount', unit: 'money', value: 50000, min: 1, max: 100000000, step: 500, presets: [10000, 50000, 100000, 500000] },
      { id: 'current', label: 'Saved so far', unit: 'money', value: 5000, min: 0, max: 100000000, step: 100, presets: [0, 5000, 20000, 50000] },
      { id: 'rate', label: 'Yearly interest', unit: 'percent', value: 3, min: 0, max: 30, step: 0.1, presets: [0, 2.5, 3, 4, 6] },
      { id: 'years', label: 'Time to get there', unit: 'years', value: 5, min: 1, max: 50, step: 1, presets: [1, 3, 5, 10, 20] },
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
      { id: 'spend', label: 'Yearly spending', unit: 'money', value: 36000, min: 1, max: 10000000, step: 500, presets: [24000, 36000, 48000, 60000, 90000] },
      { id: 'withdrawal', label: 'Withdrawal rate', unit: 'percent', value: 4, min: 1, max: 10, step: 0.1, hint: 'Share of the pot you spend each year. 4% is the usual starting point.', presets: [3, 3.5, 4, 5] },
      { id: 'current', label: 'Invested so far', unit: 'money', value: 20000, min: 0, max: 100000000, step: 1000, presets: [0, 20000, 100000, 300000] },
      { id: 'monthly', label: 'Invested each month', unit: 'money', value: 1500, min: 0, max: 1000000, step: 50, presets: [500, 1000, 1500, 3000, 5000] },
      { id: 'rate', label: 'Yearly return after inflation', unit: 'percent', value: 5, min: 0, max: 15, step: 0.1, presets: [3, 4, 5, 7] },
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
  {
    slug: 'early-retirement',
    title: 'Early retirement',
    blurb: 'How many years until you can stop working, based on how much of your income you save.',
    fields: [
      { id: 'income', label: 'Take-home pay a year', unit: 'money', value: 60000, min: 1, max: 10000000, step: 1000, presets: [36000, 60000, 84000, 120000, 180000] },
      { id: 'rate', label: 'Share of pay you save', unit: 'percent', value: 30, min: 0, max: 99, step: 1, presets: [10, 20, 30, 50, 70] },
      {
        id: 'cpf',
        label: 'CPF paid in on top of take-home pay',
        unit: 'percent',
        value: 0,
        min: 0,
        max: 100,
        step: 0.01,
        hint: 'As a share of take-home pay. An employee aged 55 or under gets 20% from their own pay plus 17% from the employer, which is 46.25% of take-home pay.',
        presets: [
          { label: 'Leave out CPF', value: 0 },
          { label: 'Employee, 55 or under', value: CPF_SHARE_OF_TAKE_HOME },
        ],
      },
      { id: 'current', label: 'Invested so far', unit: 'money', value: 0, min: 0, max: 100000000, step: 1000, presets: [0, 20000, 100000, 300000] },
      { id: 'ret', label: 'Yearly return after inflation', unit: 'percent', value: 5, min: 0, max: 15, step: 0.1, presets: [3, 4, 5, 7] },
      { id: 'withdrawal', label: 'Withdrawal rate', unit: 'percent', value: 4, min: 1, max: 10, step: 0.1, hint: 'Share of the pot you spend each year once retired.', presets: [3, 3.5, 4, 5] },
    ],
    compute: (v) => {
      const saved = (v.income * v.rate) / 100;
      const spend = v.income - saved;
      const cpf = (v.income * (v.cpf ?? 0)) / 100;
      const at = (ratePct: number) =>
        fire(v.income * (1 - ratePct / 100), v.withdrawal, v.current, ((v.income * ratePct) / 100 + cpf) / 12, v.ret);
      const f = at(v.rate);
      const others = [10, 25, 50, 75].filter((r) => r !== v.rate);
      const yearsRow = (label: string, y: number | null): Figure =>
        y === null ? { label, value: 'More than 100 years', kind: 'text' } : { label, value: y, kind: 'years' };
      return {
        headline: yearsRow('Years until you can retire', f.years),
        rows: [
          { label: 'You save each year', value: saved, kind: 'money' },
          ...(cpf > 0
            ? [
                { label: 'CPF adds each year', value: cpf, kind: 'money' as const },
                { label: 'Real savings rate, counting CPF', value: `${(((saved + cpf) / (v.income + cpf)) * 100).toFixed(0)}%`, kind: 'text' as const },
              ]
            : []),
          { label: 'You spend each year', value: spend, kind: 'money' },
          { label: 'Pot you need', value: f.target, kind: 'money' },
          ...others.map((r) => yearsRow(`If you saved ${r}% instead`, at(r).years)),
        ],
        series: f.series,
        legend: ['You put in', 'Growth'],
        note: f.years === null ? 'At this savings rate the pot never reaches the target. Try saving a larger share.' : undefined,
      };
    },
    explain: [
      'Whatever you do not save, you spend. The pot you need is that yearly spending divided by the withdrawal rate. Saving more helps twice: the pot grows faster and the target gets smaller, because you have shown you can live on less.',
      'CPF is saving you are made to do. An employee aged 55 or under puts in 20% of their wage and the employer adds another 17%, so 37% of the wage is saved before any of it reaches the bank account. Someone who saves nothing from take-home pay is still saving about 32% of everything they earn (37 out of 117), and someone who saves 30% of take-home pay is really saving about 52%. Choose “Employee, 55 or under” above to count it.',
      'Counting CPF makes the answer optimistic in two ways. CPF savings cannot be spent before 55, and only the part above your retirement sum can be withdrawn then, so they cannot fund the years before that. And CPF earns its own rates (2.5% in the Ordinary Account, about 4% in the others), not the return entered here. The rates apply up to the monthly wage ceiling and are lower above age 55.',
      'It assumes your pay and spending stay the same in today’s money, and that returns arrive evenly.',
    ],
  },
  {
    slug: 'recurring-cost',
    title: 'Recurring cost',
    blurb: 'What a regular expense really costs over time, and the capital that would pay for it from investment income.',
    fields: [
      { id: 'amount', label: 'Cost each time', unit: 'money', value: 20, min: 0.01, max: 1000000, step: 1, presets: [5, 10, 20, 50, 100, 500] },
      {
        id: 'times',
        label: 'How often',
        unit: 'count',
        value: 12,
        min: 1,
        max: 1000,
        step: 1,
        hint: 'Times a year. Use the buttons or type any number.',
        presets: [
          { label: 'Daily', value: 365 },
          { label: 'Weekdays', value: 260 },
          { label: 'Weekly', value: 52 },
          { label: 'Monthly', value: 12 },
          { label: 'Yearly', value: 1 },
        ],
      },
      { id: 'years', label: 'Over how long', unit: 'years', value: 10, min: 1, max: 60, step: 1, presets: [5, 10, 20, 30] },
      { id: 'ret', label: 'Return if invested instead', unit: 'percent', value: 6, min: 0, max: 30, step: 0.1, presets: [2.5, 4, 6, 8] },
      { id: 'yield', label: 'Income your capital pays', unit: 'percent', value: 4, min: 0.1, max: 20, step: 0.1, hint: 'Dividend yield, or the share of the capital you would draw each year.', presets: [2.5, 3, 4, 5, 6] },
    ],
    compute: (v) => {
      const yearly = v.amount * v.times;
      const g = futureValue(0, yearly / 12, v.ret, v.years);
      return {
        headline: { label: 'Capital that makes it free', value: yearly / (v.yield / 100), kind: 'money' },
        rows: [
          { label: 'Cost each year', value: yearly, kind: 'money' },
          { label: `Paid over ${v.years} years`, value: yearly * v.years, kind: 'money' },
          { label: `Worth if invested instead`, value: g.balance, kind: 'money' },
          { label: 'Growth you give up', value: g.interest, kind: 'money' },
        ],
        series: g.series,
        legend: ['You paid', 'Growth given up'],
      };
    },
    explain: [
      'The capital that makes it free is the yearly cost divided by the income rate: at 4%, that is 25 times the yearly cost. Invested capital of that size pays the expense from its income, leaving the capital itself untouched.',
      'Worth if invested instead is what the same payments would grow to if you put them into investments each month at the return you chose. Dividends and returns are not guaranteed, prices rise over time, and dividends may be taxed depending on where the fund is based.',
    ],
  },
  {
    slug: 'dollar-at-retirement',
    title: 'What a dollar becomes',
    blurb: 'What money set aside today is worth by the time you retire, at six different rates of return.',
    fields: [
      { id: 'amount', label: 'Amount today', unit: 'money', value: 1, min: 0.01, max: 100000000, step: 1, presets: [1, 100, 1000, 10000, 100000] },
      { id: 'age', label: 'Your age', unit: 'years', value: 30, min: 0, max: 99, step: 1, presets: [{ label: '20', value: 20 }, { label: '25', value: 25 }, { label: '30', value: 30 }, { label: '35', value: 35 }, { label: '40', value: 40 }, { label: '50', value: 50 }] },
      { id: 'retire', label: 'Age you want to retire', unit: 'years', value: 65, min: 1, max: 100, step: 1, presets: [{ label: '45', value: 45 }, { label: '55', value: 55 }, { label: '60', value: 60 }, { label: '65', value: 65 }, { label: '70', value: 70 }] },
    ],
    compute: (v) => {
      const span = Math.max(0, v.retire - v.age);
      return {
        headline: { label: 'Time to grow', value: span, kind: 'years' },
        rows: DOLLAR_RATES.map((r) => ({ label: `${r.rate}%: ${r.label}`, value: v.amount * Math.pow(1 + r.rate / 100, span), kind: 'money' as const })),
        series: [],
        legend: [],
        note: v.retire <= v.age ? 'Choose a retirement age above your current age to see any growth.' : undefined,
      };
    },
    explain: [
      'Each line is the amount multiplied by (1 + rate) once for every year until you retire, with nothing added along the way. The same sum grows very differently depending on the rate, and the gap widens with every extra year.',
      'The rates are examples, not promises. 2.5% and 4% are the current floor rates on CPF accounts. 7% is close to what the S&P 500 has returned after inflation over the long run and 10% before inflation. 15% a year has happened over single decades but has never lasted a working lifetime. Amounts are not adjusted for rising prices.',
    ],
  },
];

export const bySlug = (slug: string) => calculators.find((c) => c.slug === slug);
