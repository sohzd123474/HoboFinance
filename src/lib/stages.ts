import { calculators } from './calculators';
import { tools } from './tools';

// The "start here" path: life stages in order, each with the tools that answer
// the questions people have at that point. The home page shows the stages and
// every tool page links to the next step along the path.

export interface Step {
  href: string;
  title: string;
  /** The question this step answers, in the reader's words. */
  question: string;
}

export interface Stage {
  title: string;
  intro: string;
  steps: Step[];
}

const calc = (slug: string, question: string): Step | null => {
  const c = calculators.find((x) => x.slug === slug);
  return c ? { href: `/calculators/${slug}/`, title: c.title, question } : null;
};
const tool = (slug: string, question: string): Step | null => {
  const t = tools.find((x) => x.slug === slug && x.ready);
  return t ? { href: `/tools/${slug}/`, title: t.title, question } : null;
};
const stage = (title: string, intro: string, steps: (Step | null)[]): Stage => ({
  title,
  intro,
  steps: steps.filter((s): s is Step => s !== null),
});

export const stages: Stage[] = [
  stage('Know where your money goes', 'A budget is a map of your money. Start by seeing the split, then look at what the regular costs add up to.', [
    calc('budget', 'How should I split my pay between needs, wants and saving?'),
    calc('recurring-cost', 'What do my subscriptions and daily habits really cost?'),
  ]),
  stage('Build a safety net', 'Before investing, set aside cash for a job loss or a large bill, somewhere you can reach it quickly.', [
    calc('emergency-fund', 'How big should my emergency fund be, and how long will it take?'),
    tool('parking', 'Where do I keep money I will need within two years?'),
    tool('ssb', 'Are Savings Bonds worth it this month?'),
  ]),
  stage('Understand your CPF', 'CPF is saving you are already doing. See what it adds and what steady saving grows into.', [
    calc('early-retirement', 'How much am I really saving once CPF is counted?'),
    calc('dollar-at-retirement', 'What is a dollar saved today worth when I retire?'),
  ]),
  stage('Protect yourself', 'Insurance is protection, not an investment. Cover the events that could wipe out everything else.', [
    calc('insurance-cover', 'Roughly how much cover do I need, and what does MediSave pay for?'),
  ]),
  stage('Save for the next few years', 'Money for a wedding, a renovation or a home should not be in shares.', [
    calc('savings-goal', 'How much a month gets me to a goal by a set date?'),
    calc('loan-repayment', 'What will a home loan cost each month, and how much is interest?'),
    calc('flat-rate-loan', 'What does a car or personal loan really cost, behind the advertised rate?'),
  ]),
  stage('Start investing', 'Buy the whole market at low cost and keep adding. Know what each layer of fees takes.', [
    calc('compound-interest', 'What does investing every month grow into?'),
    calc('time-to-target', 'How long until I reach 1 million?'),
    tool('etf-tax-drag', 'Which S&P 500 or world fund costs a Singapore investor least?'),
    calc('fx-cost', 'What does my broker’s exchange rate cost me?'),
    tool('ilp-vs-diy', 'Someone is selling me an investment-linked policy. How does it compare?'),
  ]),
  stage('Stay invested', 'Falls are normal. Knowing how often they happen makes it easier not to sell.', [
    tool('drawdowns', 'How far do markets fall in a normal year?'),
    tool('lump-sum-vs-dca', 'Should a bonus go in at once or bit by bit?'),
  ]),
  stage('Shape your portfolio', 'Decide how much risk to carry, and check what you really hold before adding more.', [
    calc('allocation', 'How much should be in stocks, if CPF counts as my bonds?'),
    tool('concentration', 'Am I more concentrated in a few companies than I think?'),
    tool('snp1', 'Does holding only the largest US company beat the index?'),
    tool('leveraged-etf', 'What does a 3x fund do over years?'),
  ]),
  stage('Plan to stop work', 'Find the number you need and the years left to reach it.', [
    calc('financial-independence', 'How big a pot do I need to live off?'),
    tool('fire-cpf', 'Can my savings carry me to 55, when CPF opens up?'),
  ]),
  stage('Get your report', 'Everything you have worked out, in one printable page.', [
    { href: '/report/', title: 'Your report', question: 'See all my numbers together and save them as a PDF' },
  ]),
].filter((s) => s.steps.length > 0);

/** Every step once, in path order. */
export const path: Step[] = stages.flatMap((s) => s.steps).filter((s, i, all) => all.findIndex((x) => x.href === s.href) === i);

export function nextStep(pathname: string): Step | null {
  const here = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const i = path.findIndex((s) => s.href === here);
  return i === -1 || i === path.length - 1 ? null : path[i + 1];
}
