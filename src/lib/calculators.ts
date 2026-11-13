import { fire, futureValue, loanRepayment, savingsGoal, yearsToTarget, type YearPoint } from './finance';

export type ValueKind = 'money' | 'years' | 'text';

export interface Field {
  id: string;
  label: string;
  unit: 'money' | 'percent' | 'years' | 'count' | 'plain';
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

/**
 * MediSave that may be used each year for the private-insurer part of an
 * Integrated Shield Plan (the Additional Withdrawal Limits), by age next birthday.
 * Source: Ministry of Health, "About Integrated Shield Plan", last updated 30 April 2026.
 */
export function medisaveLimitForShieldPlan(age: number): number {
  const next = age + 1;
  return next <= 40 ? 300 : next <= 70 ? 600 : 900;
}

const ages = (list: number[]) => list.map((a) => ({ label: String(a), value: a }));

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
  {
    slug: 'budget',
    title: 'Budget split',
    blurb: 'Split your monthly pay into needs, wants and savings, starting from the 50/30/20 guideline.',
    fields: [
      { id: 'pay', label: 'Take-home pay a month', unit: 'money', value: 4000, min: 1, max: 10000000, step: 100, presets: [2500, 4000, 6000, 8000, 12000] },
      { id: 'needs', label: 'Needs', unit: 'percent', value: 50, min: 0, max: 100, step: 1, hint: 'Rent or mortgage, bills, groceries, transport to work.', presets: [40, 50, 60, 70] },
      { id: 'wants', label: 'Wants', unit: 'percent', value: 30, min: 0, max: 100, step: 1, hint: 'Eating out, subscriptions, hobbies, holidays.', presets: [10, 20, 30] },
    ],
    compute: (v) => {
      const share = 100 - v.needs - v.wants;
      const saved = (v.pay * Math.max(0, share)) / 100;
      return {
        headline: { label: 'Left for saving and investing each month', value: saved, kind: 'money' },
        rows: [
          { label: 'Share of pay saved', value: `${Math.max(0, share)}%`, kind: 'text' },
          { label: 'Needs each month', value: (v.pay * v.needs) / 100, kind: 'money' },
          { label: 'Wants each month', value: (v.pay * v.wants) / 100, kind: 'money' },
          { label: 'Saved over a year', value: saved * 12, kind: 'money' },
        ],
        series: [],
        legend: [],
        note: share < 0 ? 'Needs and wants add up to more than your pay. Lower one of them.' : undefined,
      };
    },
    explain: [
      'The 50/30/20 guideline puts half of take-home pay towards needs, 30% towards wants and 20% towards saving and investing. It is a starting point for seeing where your money goes, not a rule to follow exactly.',
      'Track what you actually spend for a month and adjust the shares to match your life. Raising the saved share over time is what moves the date you can stop working. CPF contributions come on top of this, because they are taken before your pay reaches you.',
    ],
  },
  {
    slug: 'emergency-fund',
    title: 'Emergency fund',
    blurb: 'How much cash to keep for a job loss or a medical bill, and how long it takes to build.',
    fields: [
      { id: 'expenses', label: 'Essential spending a month', unit: 'money', value: 2500, min: 1, max: 1000000, step: 100, presets: [1500, 2500, 4000, 6000] },
      { id: 'months', label: 'Months to cover', unit: 'plain', value: 6, min: 1, max: 36, step: 1, hint: '3 to 6 months is usual. Lean towards 6 or more if your income is uneven or others depend on you.', presets: [3, 6, 9, 12] },
      { id: 'saved', label: 'Set aside so far', unit: 'money', value: 2000, min: 0, max: 10000000, step: 100, presets: [0, 2000, 5000, 10000] },
      { id: 'monthly', label: 'Added each month', unit: 'money', value: 500, min: 0, max: 1000000, step: 50, presets: [200, 500, 1000, 2000] },
    ],
    compute: (v) => {
      const target = v.expenses * v.months;
      const gap = Math.max(0, target - v.saved);
      const time: Figure =
        gap === 0
          ? { label: 'Time to get there', value: 'Already there', kind: 'text' }
          : v.monthly > 0
            ? { label: 'Time to get there', value: Math.ceil(gap / v.monthly) / 12, kind: 'years' }
            : { label: 'Time to get there', value: 'Add a monthly amount', kind: 'text' };
      return {
        headline: { label: 'Emergency fund to aim for', value: target, kind: 'money' },
        rows: [{ label: 'Still to save', value: gap, kind: 'money' }, time],
        series: [],
        legend: [],
      };
    },
    explain: [
      'An emergency fund is cash kept apart from your investments, so that a job loss or a large bill does not force you to sell shares at a bad time. Count only spending you could not stop: housing, bills, food, transport, insurance.',
      'Keep it where you can reach it within days and where it cannot fall in value: a savings account, a money market fund or Singapore Savings Bonds, which can be redeemed in any month. Interest is left out here because the point of this money is safety, not growth.',
    ],
  },
  {
    slug: 'insurance-cover',
    title: 'Insurance cover',
    blurb: 'Rough starting figures for life, disability and critical illness cover, and what MediSave pays towards a hospital plan.',
    fields: [
      { id: 'age', label: 'Your age', unit: 'years', value: 30, min: 18, max: 99, step: 1, presets: ages([25, 30, 35, 40, 50]) },
      { id: 'pay', label: 'Take-home pay a year', unit: 'money', value: 60000, min: 1, max: 10000000, step: 1000, presets: [36000, 60000, 84000, 120000] },
      { id: 'expenses', label: 'Spending a year, including dependants', unit: 'money', value: 36000, min: 1, max: 10000000, step: 1000, presets: [24000, 36000, 48000, 72000] },
    ],
    compute: (v) => ({
      headline: { label: 'Death and total disability cover to consider', value: v.expenses * 10, kind: 'money' },
      rows: [
        { label: 'Early critical illness cover to consider', value: v.pay * 3, kind: 'money' },
        { label: 'Keep yearly premiums under', value: v.pay * 0.1, kind: 'money' },
        { label: 'MediSave usable each year for a Shield plan’s private part', value: medisaveLimitForShieldPlan(v.age), kind: 'money' },
      ],
      series: [],
      legend: [],
    }),
    explain: [
      'These are common rules of thumb, not advice: death and total permanent disability cover of about 10 times yearly spending, early critical illness cover of about 3 years of pay, and total premiums of no more than about 10% of take-home pay. Someone with no dependants and no debts may need far less; a sole breadwinner with a home loan may need more.',
      'Hospital cover comes first. Every Singaporean and permanent resident has MediShield Life, sized for B2 and C wards in public hospitals. An Integrated Shield Plan adds private cover for higher wards. The MediShield Life part is paid fully from MediSave; the private part can be paid from MediSave up to 300 a year if you are 40 or under on your next birthday, 600 from 41 to 70 and 900 from 71, and the rest is paid in cash. Riders are paid in cash.',
      'Term insurance gives cover for a set period at a low price. Whole life plans combine cover with savings and cost several times more for the same cover. The Ministry of Health publishes a comparison of Integrated Shield Plans, and compareFIRST (comparefirst.sg) lists life insurance prices across insurers. MediSave figures are from the Ministry of Health page last updated 30 April 2026.',
    ],
  },
  {
    slug: 'time-to-target',
    title: 'Time to a target',
    blurb: 'How many years of monthly investing it takes to reach a sum such as 1 million.',
    fields: [
      { id: 'start', label: 'Invested so far', unit: 'money', value: 10000, min: 0, max: 100000000, step: 1000, presets: [0, 10000, 50000, 100000] },
      { id: 'monthly', label: 'Invested each month', unit: 'money', value: 500, min: 0, max: 1000000, step: 50, presets: [250, 500, 1000, 2000, 5000] },
      { id: 'ret', label: 'Yearly return', unit: 'percent', value: 6, min: 0, max: 30, step: 0.1, presets: [4, 5.5, 6, 8] },
      { id: 'target', label: 'Target', unit: 'money', value: 1000000, min: 1, max: 1000000000, step: 10000, presets: [100000, 500000, 1000000, 2000000] },
    ],
    compute: (v) => {
      const row = (label: string, monthly: number): Figure => {
        const y = yearsToTarget(v.start, monthly, v.ret, v.target);
        return y === null ? { label, value: 'More than 100 years', kind: 'text' } : { label, value: y, kind: 'years' };
      };
      const y = yearsToTarget(v.start, v.monthly, v.ret, v.target);
      const g = y === null ? null : futureValue(v.start, v.monthly, v.ret, y);
      return {
        headline: row('Time to reach the target', v.monthly),
        rows: [
          ...(g ? [{ label: 'You put in', value: g.contributed, kind: 'money' as const }, { label: 'Growth', value: g.interest, kind: 'money' as const }] : []),
          row('With half as much each month', v.monthly / 2),
          row('With twice as much each month', v.monthly * 2),
        ],
        series: g ? g.series : [],
        legend: ['You put in', 'Growth'],
        note: y === null ? 'At these figures the target is not reached within 100 years.' : undefined,
      };
    },
    explain: [
      'The balance grows by one twelfth of the yearly return each month, then the monthly amount is added. Doubling what you invest does not halve the time, because growth does more of the work the longer the money is invested.',
      'In the early years the amount you save matters far more than the return you earn: a 10% return on 1,000 is 100, while saving another 400 a month adds 4,800 a year. Use a cautious return such as 5.5% to 6% for a world share fund; past returns do not promise future ones.',
    ],
  },
  {
    slug: 'allocation',
    title: 'Stocks and bonds split',
    blurb: 'Set a stocks-to-bonds split from your age, counting CPF as the bond part.',
    fields: [
      { id: 'age', label: 'Your age', unit: 'years', value: 35, min: 18, max: 99, step: 1, presets: ages([25, 30, 35, 45, 60]) },
      { id: 'rule', label: 'Rule number', unit: 'plain', value: 110, min: 50, max: 150, step: 5, hint: 'Your stocks share is this number minus your age. 100 is cautious, 120 is aggressive.', presets: [100, 110, 120] },
      { id: 'invest', label: 'Investments outside CPF', unit: 'money', value: 300000, min: 0, max: 1000000000, step: 1000, presets: [50000, 100000, 300000, 500000] },
      { id: 'cpf', label: 'CPF Ordinary and Special Accounts', unit: 'money', value: 100000, min: 0, max: 1000000000, step: 1000, presets: [0, 50000, 100000, 200000] },
    ],
    compute: (v) => {
      const stocksShare = Math.min(100, Math.max(0, v.rule - v.age)) / 100;
      const total = v.invest + v.cpf;
      const bondsTarget = total * (1 - stocksShare);
      const otherBonds = Math.min(v.invest, Math.max(0, bondsTarget - v.cpf));
      const stocks = v.invest - otherBonds;
      return {
        headline: { label: 'Share of your investments to hold in stocks', value: v.invest > 0 ? `${Math.round((stocks / v.invest) * 100)}%` : 'n/a', kind: 'text' },
        rows: [
          { label: 'Target stocks share of everything', value: `${Math.round(stocksShare * 100)}%`, kind: 'text' },
          { label: 'Bond part of everything', value: bondsTarget, kind: 'money' },
          { label: 'Covered by CPF', value: Math.min(v.cpf, bondsTarget), kind: 'money' },
          { label: 'Bonds to hold in your investments', value: otherBonds, kind: 'money' },
          { label: 'Stocks to hold in your investments', value: stocks, kind: 'money' },
        ],
        series: [],
        legend: [],
        note: v.cpf > bondsTarget ? 'Your CPF is larger than the bond part, so even with investments fully in stocks you hold less in stocks overall than the rule suggests.' : undefined,
      };
    },
    explain: [
      'A common starting rule is to hold a share in stocks equal to 110 minus your age, and the rest in bonds: 80% stocks at 30, 65% at 45, 50% at 60. The idea is to take more risk while retirement is far away and less as it gets close. Your own comfort with large falls matters more than the rule.',
      'CPF Ordinary and Special Account balances behave like a government bond: the value does not fall and the interest is set. Counting them as the bond part often means the money you invest yourself can all be in stocks. The catch is that CPF cannot be reached before 55, so if you need safe money sooner, hold some bonds, Savings Bonds or T-bills outside CPF as well.',
    ],
  },
  {
    slug: 'fx-cost',
    title: 'Currency conversion cost',
    blurb: 'What a broker’s exchange-rate spread costs each time you convert, and over years of investing.',
    fields: [
      { id: 'amount', label: 'Amount converted each time', unit: 'money', value: 1000, min: 1, max: 100000000, step: 100, presets: [500, 1000, 5000, 10000, 50000] },
      { id: 'spread', label: 'Spread, one way', unit: 'percent', value: 0.5, min: 0, max: 5, step: 0.01, hint: 'How far the rate you get is from the mid-market rate. Compare your broker’s quote with the rate shown by a search engine.', presets: [0.03, 0.2, 0.5, 1] },
      { id: 'fee', label: 'Fixed fee each time', unit: 'money', value: 0, min: 0, max: 1000, step: 0.5, presets: [0, 2, 5] },
      { id: 'times', label: 'Conversions', unit: 'count', value: 12, min: 1, max: 365, step: 1, presets: [{ label: 'Monthly', value: 12 }, { label: 'Quarterly', value: 4 }, { label: 'Yearly', value: 1 }] },
      { id: 'years', label: 'Over how long', unit: 'years', value: 20, min: 1, max: 60, step: 1, presets: [5, 10, 20, 30] },
    ],
    compute: (v) => {
      const once = (v.amount * v.spread) / 100 + v.fee;
      return {
        headline: { label: 'Cost each time you convert', value: once, kind: 'money' },
        rows: [
          { label: 'As a share of the amount', value: `${((once / v.amount) * 100).toFixed(2)}%`, kind: 'text' },
          { label: 'There and back again', value: once * 2, kind: 'money' },
          { label: 'Each year', value: once * v.times, kind: 'money' },
          { label: `Over ${v.years} years`, value: once * v.times * v.years, kind: 'money' },
        ],
        series: [],
        legend: [],
      };
    },
    explain: [
      'Buying a fund priced in US dollars means converting Singapore dollars first. Brokers and robo-advisers rarely charge a visible fee for this; they give you a rate slightly worse than the market rate and keep the difference. A 0.5% spread is paid again when you convert back, so the round trip costs 1%.',
      'To find your spread, compare the rate your platform quotes with the mid-market rate at the same moment. Spreads differ widely between platforms, from a few hundredths of a percent to half a percent or more. This is a cost on top of the fund’s expense ratio and any commission.',
    ],
  },
];

export const bySlug = (slug: string) => calculators.find((c) => c.slug === slug);
