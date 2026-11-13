import { effectiveRate, fire, flatLoan, futureValue, loanRepayment, savingsGoal, yearsToTarget, type YearPoint } from './finance';

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
  /** Short points under a heading: each point is a bold lead and one or two sentences. Five points at most per group. */
  explain: { title: string; points: [string, string][] }[];
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

const rateText = (r: number | null) => (r === null ? 'n/a: the repayments do not cover the amount received' : `${(r * 100).toFixed(2)}%`);

const ages = (list: number[]) => list.map((a) => ({ label: String(a), value: a }));

export const calculators: Calculator[] = [
  {
    slug: 'compound-interest',
    title: 'Compound interest',
    blurb: 'Enter a monthly amount and a rate to see what your savings grow into.',
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
      {
        title: 'How this is worked out',
        points: [
          ['How it grows.', 'Each month the balance grows by one twelfth of the yearly rate. Then your monthly amount is added.'],
          ['Why the curve bends upward.', 'Growth is worked out on the whole balance, including earlier growth.'],
          ['What is left out.', 'Fees and tax. The rate is a steady average; real investments rise and fall from year to year.'],
        ],
      },
    ],
  },
  {
    slug: 'loan-repayment',
    title: 'Loan repayment',
    blurb: 'Enter a loan to see the monthly repayment and the total interest.',
    fields: [
      { id: 'amount', label: 'Amount borrowed', unit: 'money', value: 300000, min: 100, max: 100000000, step: 1000, presets: [20000, 100000, 300000, 500000, 800000] },
      { id: 'rate', label: 'Advertised interest rate', unit: 'percent', value: 4, min: 0, max: 40, step: 0.05, hint: 'The yearly rate on what you still owe. Home loans are quoted this way. For a flat-rate car or personal loan, use the flat-rate loan calculator.', presets: [2.6, 3, 3.5, 4, 5] },
      { id: 'years', label: 'Loan length', unit: 'years', value: 25, min: 1, max: 40, step: 1, presets: [5, 7, 15, 25, 30] },
      { id: 'fee', label: 'Fees taken upfront', unit: 'money', value: 0, min: 0, max: 1000000, step: 100, hint: 'Processing or legal fees deducted from the loan or paid at the start.', presets: [0, 500, 2000, 5000] },
    ],
    compute: (v) => {
      const l = loanRepayment(v.amount, v.rate, v.years);
      return {
        headline: { label: 'Monthly repayment', value: l.payment, kind: 'money' },
        rows: [
          { label: 'Effective interest rate (EIR)', value: rateText(effectiveRate(v.amount - (v.fee ?? 0), l.payment, Math.max(1, Math.round(v.years * 12)))), kind: 'text' },
          { label: 'Total repaid', value: l.totalPaid, kind: 'money' },
          { label: 'Of which interest', value: l.totalInterest, kind: 'money' },
        ],
        series: l.series,
        legend: ['Still owed'],
      };
    },
    explain: [
      {
        title: 'How this is worked out',
        points: [
          ['Equal monthly repayments.', 'Interest is charged each month on what you still owe. Early repayments are mostly interest; later ones mostly pay off the loan.'],
          ['Compare loans by EIR.', 'The effective interest rate is the yearly cost once monthly compounding and upfront fees are counted. 4% advertised is 4.07% effective before fees.'],
          ['What is left out.', 'Insurance, and any change in the rate during the loan.'],
          ['Car or personal loan?', 'Those are usually quoted as a flat rate, which costs more than the same advertised rate here. Use the flat-rate loan calculator.'],
        ],
      },
    ],
  },
  {
    slug: 'savings-goal',
    title: 'Savings goal',
    blurb: 'Enter a target and a date to see how much to save each month.',
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
      {
        title: 'How this is worked out',
        points: [
          ['What you have counts first.', 'Your existing savings are grown for the full period.'],
          ['The rest is split evenly.', 'The shortfall becomes equal monthly deposits, allowing for the interest those deposits earn.'],
          ['Allow for rising prices.', 'For a goal several years away, raise the target or use a lower interest rate.'],
        ],
      },
    ],
  },
  {
    slug: 'financial-independence',
    title: 'Financial independence',
    blurb: 'Enter your yearly spending to see the pot you need and the years it takes to save it.',
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
      {
        title: 'How this is worked out',
        points: [
          ['The pot you need.', 'Yearly spending divided by the withdrawal rate. At 4%, that is 25 times what you spend in a year.'],
          ['The time it takes.', 'How long your monthly investing takes to grow to that pot.'],
          ['Use a return after inflation.', 'That keeps every figure in today’s money.'],
          ['Where 4% comes from.', 'Studies of 30-year retirements in US markets. A longer retirement or different markets may call for a lower rate.'],
        ],
      },
    ],
  },
  {
    slug: 'early-retirement',
    title: 'Early retirement',
    blurb: 'Enter your pay and the share you save to see how many years until you can stop working.',
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
      {
        title: 'How this is worked out',
        points: [
          ['The pot you need.', 'Whatever you do not save, you spend. The pot is that yearly spending divided by the withdrawal rate.'],
          ['Saving more helps twice.', 'The pot grows faster, and the target gets smaller because you live on less.'],
          ['What is assumed.', 'Pay and spending stay the same in today’s money, and returns arrive evenly.'],
        ],
      },
      {
        title: 'Counting CPF',
        points: [
          ['CPF is saving you already do.', 'An employee aged 55 or under puts in 20% of their wage and the employer adds 17%. That is 37% of the wage saved before pay reaches the bank.'],
          ['Your true saving rate is higher.', 'Saving nothing from take-home pay still saves about 32% of everything you earn (37 out of 117). Saving 30% of take-home pay saves about 52%.'],
          ['To count it.', 'Choose “Employee, 55 or under” above.'],
          ['CPF is locked until 55.', 'Only the part above your retirement sum can be withdrawn then. It cannot pay for the years before 55, so counting it makes the answer optimistic.'],
          ['CPF earns its own rates.', '2.5% in the Ordinary Account and about 4% in the others, not the return entered here. Contribution rates apply up to the monthly wage ceiling and are lower above age 55.'],
        ],
      },
    ],
  },
  {
    slug: 'recurring-cost',
    title: 'Recurring cost',
    blurb: 'Enter a regular expense to see its long-run cost and the capital that would pay for it.',
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
      {
        title: 'How this is worked out',
        points: [
          ['Capital that makes it free.', 'The yearly cost divided by the income rate. At 4%, that is 25 times the yearly cost.'],
          ['How that works.', 'Capital of that size pays the expense from its income. The capital itself is not spent.'],
          ['Worth if invested instead.', 'What the same payments would grow to if invested each month at the return you chose.'],
          ['What is not guaranteed.', 'Dividends and returns. Prices also rise over time, and dividends may be taxed depending on where the fund is based.'],
        ],
      },
    ],
  },
  {
    slug: 'dollar-at-retirement',
    title: 'What a dollar becomes',
    blurb: 'Enter your age and an amount to see what it is worth at retirement, at six rates of return.',
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
      {
        title: 'How this is worked out',
        points: [
          ['Each line.', 'The amount is multiplied by (1 + rate) once for every year until you retire. Nothing is added along the way.'],
          ['The rate matters more each year.', 'The gap between the lines widens with every extra year.'],
          ['What is left out.', 'Rising prices. The rates are examples, not promises.'],
        ],
      },
      {
        title: 'Where the rates come from',
        points: [
          ['2.5% and 4%.', 'The current floor rates on CPF accounts.'],
          ['7% and 10%.', 'Close to what the S&P 500 has returned over the long run: 7% after inflation, 10% before.'],
          ['15%.', 'Has happened over single decades. It has never lasted a working lifetime.'],
        ],
      },
    ],
  },
  {
    slug: 'budget',
    title: 'Budget split',
    blurb: 'Enter your monthly pay to split it into needs, wants and savings.',
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
      {
        title: 'How this is worked out',
        points: [
          ['The 50/30/20 guideline.', 'Half of take-home pay to needs, 30% to wants, 20% to saving and investing. It is a starting point, not a rule.'],
          ['Make it yours.', 'Track what you spend for one month, then change the shares to match.'],
          ['Raise the saved share over time.', 'That brings forward the date you can stop working.'],
          ['CPF is extra.', 'Contributions are taken before your pay reaches you, so they come on top of this.'],
        ],
      },
    ],
  },
  {
    slug: 'emergency-fund',
    title: 'Emergency fund',
    blurb: 'Enter your monthly spending to see how much cash to keep and how long it takes to build.',
    fields: [
      { id: 'expenses', label: 'Essential spending a month', unit: 'money', value: 2500, min: 1, max: 1000000, step: 100, presets: [1500, 2500, 4000, 6000] },
      { id: 'months', label: 'Months to cover', unit: 'plain', value: 6, min: 1, max: 36, step: 1, hint: '3 to 6 months is usual. Choose 6 or more if your income is uneven or others depend on you.', presets: [3, 6, 9, 12] },
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
      {
        title: 'How this is worked out',
        points: [
          ['What it is for.', 'Cash kept apart from investments, so a job loss or a large bill does not force you to sell shares at a low price.'],
          ['What to count.', 'Only spending you could not stop: housing, bills, food, transport, insurance.'],
          ['Where to keep it.', 'Somewhere you can reach within days and that cannot fall in value: a savings account, a money market fund or Singapore Savings Bonds. Savings Bonds can be redeemed in any month.'],
          ['Interest is left out.', 'This money is for safety, not growth.'],
        ],
      },
    ],
  },
  {
    slug: 'insurance-cover',
    title: 'Insurance cover',
    blurb: 'Enter your age, pay and spending to get starting figures for cover and what MediSave pays.',
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
      {
        title: 'How this is worked out',
        points: [
          ['Death and total permanent disability.', 'About 10 times yearly spending.'],
          ['Early critical illness.', 'About 3 years of pay.'],
          ['Premiums.', 'No more than about 10% of take-home pay in total.'],
          ['Rules of thumb, not advice.', 'With no dependants and no debts you may need far less. A sole breadwinner with a home loan may need more.'],
        ],
      },
      {
        title: 'Hospital cover comes first',
        points: [
          ['MediShield Life.', 'Every Singaporean and permanent resident has it. It is sized for B2 and C wards in public hospitals and is paid fully from MediSave.'],
          ['Integrated Shield Plan.', 'Adds private cover for higher wards.'],
          ['MediSave for the private part.', 'Up to 300 a year if you are 40 or under on your next birthday, 600 from 41 to 70, and 900 from 71. The rest is paid in cash.'],
          ['Riders.', 'Paid in cash.'],
          ['Source.', 'MediSave figures are from the Ministry of Health page last updated 30 April 2026.'],
        ],
      },
      {
        title: 'Choosing a plan',
        points: [
          ['Term insurance.', 'Cover for a set period at a low price.'],
          ['Whole life.', 'Combines cover with savings and costs several times more for the same cover.'],
          ['Compare prices.', 'The Ministry of Health publishes a comparison of Integrated Shield Plans. compareFIRST (comparefirst.sg) lists life insurance prices across insurers.'],
        ],
      },
    ],
  },
  {
    slug: 'time-to-target',
    title: 'Time to a target',
    blurb: 'Enter a monthly amount and a target to see how many years it takes.',
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
      {
        title: 'How this is worked out',
        points: [
          ['How it grows.', 'Each month the balance grows by one twelfth of the yearly return. Then the monthly amount is added.'],
          ['Doubling the amount does not halve the time.', 'Growth adds more the longer the money is invested.'],
          ['Early on, saving matters more than return.', 'A 10% return on 1,000 is 100. Saving another 400 a month adds 4,800 a year.'],
          ['Use a cautious return.', '5.5% to 6% for a world share fund. Past returns do not promise future ones.'],
        ],
      },
    ],
  },
  {
    slug: 'allocation',
    title: 'Stocks and bonds split',
    blurb: 'Enter your age and balances to get a stocks and bonds split, with CPF counted as bonds.',
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
      {
        title: 'How this is worked out',
        points: [
          ['The starting rule.', 'Your stocks share is 110 minus your age; the rest is bonds. That is 80% stocks at 30, 65% at 45 and 50% at 60.'],
          ['Why it falls with age.', 'You take more risk while retirement is far away and less as it gets close. Your own comfort with large falls matters more than the rule.'],
          ['CPF acts like a government bond.', 'Ordinary and Special Account balances do not fall in value and the interest is set.'],
          ['What that means.', 'With CPF counted as the bond part, the money you invest yourself can often all be in stocks.'],
          ['CPF is locked until 55.', 'If you need safe money sooner, also hold bonds, Savings Bonds or T-bills outside CPF.'],
        ],
      },
    ],
  },
  {
    slug: 'fx-cost',
    title: 'Currency conversion cost',
    blurb: 'Enter your broker’s spread to see what currency conversion costs, per trade and over years.',
    fields: [
      { id: 'amount', label: 'Amount converted each time', unit: 'money', value: 1000, min: 1, max: 100000000, step: 100, presets: [500, 1000, 5000, 10000, 50000] },
      { id: 'spread', label: 'Spread, one way', unit: 'percent', value: 0.5, min: 0, max: 5, step: 0.01, hint: 'How far your rate is from the mid-market rate. Compare your broker’s quote with the rate a search engine shows.', presets: [0.03, 0.2, 0.5, 1] },
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
      {
        title: 'How this is worked out',
        points: [
          ['Where the cost is.', 'Brokers and robo-advisers rarely charge a visible fee. They give a rate slightly worse than the market rate and keep the difference.'],
          ['You pay it twice.', 'A 0.5% spread is paid again when you convert back, so the round trip costs 1%.'],
          ['Find your spread.', 'Compare the rate your platform quotes with the mid-market rate at the same moment.'],
          ['Spreads differ widely.', 'From a few hundredths of a percent to half a percent or more, depending on the platform.'],
          ['It is an extra cost.', 'It comes on top of the fund’s expense ratio and any commission.'],
        ],
      },
    ],
  },
  {
    slug: 'flat-rate-loan',
    title: 'Flat-rate loan and EIR',
    blurb: 'Enter the flat rate from a car or personal loan advert to see the effective rate you pay.',
    fields: [
      { id: 'amount', label: 'Amount borrowed', unit: 'money', value: 20000, min: 100, max: 100000000, step: 500, presets: [5000, 10000, 20000, 50000, 100000] },
      { id: 'rate', label: 'Advertised flat rate', unit: 'percent', value: 3.5, min: 0, max: 40, step: 0.01, hint: 'The yearly rate in the advertisement. It is charged on the full amount for the whole loan.', presets: [1.88, 2.78, 3.5, 5, 7] },
      { id: 'years', label: 'Loan length', unit: 'years', value: 5, min: 1, max: 10, step: 1, presets: [1, 3, 5, 7] },
      { id: 'fee', label: 'Fees taken upfront', unit: 'money', value: 0, min: 0, max: 100000, step: 50, hint: 'Processing fee deducted from the loan or paid at the start.', presets: [0, 100, 200, 500] },
    ],
    compute: (v) => {
      const l = flatLoan(v.amount, v.rate, v.years, v.fee ?? 0);
      return {
        headline: { label: 'Effective interest rate (EIR)', value: rateText(l.eir), kind: 'text' },
        rows: [
          { label: 'Advertised flat rate', value: `${v.rate}%`, kind: 'text' },
          { label: 'Monthly repayment', value: l.payment, kind: 'money' },
          { label: 'Total interest', value: l.totalInterest, kind: 'money' },
          { label: 'Total repaid', value: l.totalPaid, kind: 'money' },
        ],
        series: l.series,
        legend: ['Still to pay'],
      };
    },
    explain: [
      {
        title: 'How this is worked out',
        points: [
          ['Compare loans by EIR.', 'Never by the flat rate. Lenders in Singapore must show the EIR next to the advertised rate.'],
          ['What a flat rate does.', 'It charges interest on the full amount borrowed for every year of the loan, even though you owe less after each repayment.'],
          ['The interest.', 'Amount × rate × years. It is added to the loan and divided into equal monthly repayments.'],
          ['Why the true cost is higher.', 'You pay interest on money you have already returned. The true cost is close to double the advertised figure.'],
          ['What EIR means.', 'The yearly rate, compounded monthly and counting upfront fees, at which your repayments match the money you received.'],
        ],
      },
    ],
  },
];

export const bySlug = (slug: string) => calculators.find((c) => c.slug === slug);
