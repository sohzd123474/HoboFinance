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
  stage('Your first pay', 'See where your money goes and what saving a part of it does.', [
    calc('recurring-cost', 'What do my subscriptions and daily habits really cost?'),
    calc('dollar-at-retirement', 'What is a dollar saved today worth when I retire?'),
    calc('early-retirement', 'How does the share of pay I save change when I can stop working?'),
  ]),
  stage('A safety buffer', 'Before investing, set aside money you can reach quickly.', [
    calc('savings-goal', 'How much a month gets me to my emergency fund?'),
    tool('parking', 'Where do I keep money I will need within two years?'),
    tool('ssb', 'Are Savings Bonds worth it this month?'),
  ]),
  stage('Starting to invest', 'Pick a low-cost way in and understand what you are paying.', [
    calc('compound-interest', 'What does investing every month grow into?'),
    tool('etf-tax-drag', 'Which S&P 500 or world fund costs a Singapore investor least?'),
    tool('ilp-vs-diy', 'Someone is selling me an investment-linked policy. How does it compare?'),
  ]),
  stage('Buying a home', 'Work out the loan and what it does to the rest of your plan.', [
    calc('loan-repayment', 'What will the monthly repayment be, and how much is interest?'),
    tool('fire-cpf', 'How do the downpayment and mortgage change my CPF and savings?'),
  ]),
  stage('Growing your portfolio', 'Check what you really hold before adding risk.', [
    tool('concentration', 'Am I more concentrated in a few companies than I think?'),
    tool('snp1', 'Does holding only the largest US company beat the index?'),
    tool('leveraged-etf', 'What does a 3x fund do over years?'),
  ]),
  stage('Planning to stop work', 'Find the number you need and the years left to reach it.', [
    calc('financial-independence', 'How big a pot do I need to live off?'),
    tool('fire-cpf', 'Can my savings carry me to 55, when CPF opens up?'),
  ]),
].filter((s) => s.steps.length > 0);

/** Every step once, in path order. */
export const path: Step[] = stages.flatMap((s) => s.steps).filter((s, i, all) => all.findIndex((x) => x.href === s.href) === i);

export function nextStep(pathname: string): Step | null {
  const here = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const i = path.findIndex((s) => s.href === here);
  return i === -1 || i === path.length - 1 ? null : path[i + 1];
}
