import { calculators } from './calculators';
import { path } from './stages';
import { tools } from './tools';

// The site search: a small list of every page, matched in the browser.

export interface SearchItem {
  href: string;
  title: string;
  /** One line shown under the title in the results. */
  text: string;
  /** Lower-case text the query is matched against. */
  hay: string;
}

/** Words people type that do not appear in a page's own title or description. */
const KEYWORDS: Record<string, string> = {
  '/calculators/budget/': 'budgeting 50/30/20 salary spending expenses',
  '/calculators/recurring-cost/': 'subscription netflix coffee habit monthly cost',
  '/calculators/emergency-fund/': 'rainy day cash buffer safety net',
  '/tools/parking/': 'fixed deposit t-bill tbill money market cash management savings account',
  '/tools/ssb/': 'ssb singapore savings bonds mas bond rates',
  '/calculators/early-retirement/': 'fire retire early savings rate cpf',
  '/calculators/dollar-at-retirement/': 'future value cpf oa sa growth',
  '/calculators/insurance-cover/': 'term life critical illness medishield shield plan medisave hospital',
  '/calculators/savings-goal/': 'wedding renovation down payment target',
  '/calculators/loan-repayment/': 'mortgage hdb housing home loan bank loan interest eir',
  '/calculators/flat-rate-loan/': 'car loan personal loan eir effective interest rate',
  '/calculators/compound-interest/': 'compounding dca monthly investing growth',
  '/calculators/time-to-target/': 'millionaire 1 million how long',
  '/tools/etf-tax-drag/': 'voo cspx vwra iwda withholding tax ireland etf fees expense ratio s&p 500',
  '/calculators/fx-cost/': 'fx forex usd sgd exchange rate spread broker',
  '/tools/ilp-vs-diy/': 'ilp investment linked policy insurance agent aia',
  '/tools/drawdowns/': 'crash correction drawdown bear market volatility',
  '/tools/lump-sum-vs-dca/': 'dca dollar cost averaging bonus windfall',
  '/calculators/allocation/': 'asset allocation bonds stocks age rule',
  '/tools/concentration/': 'diversification overlap magnificent 7 portfolio',
  '/tools/snp1/': 'largest company apple nvidia microsoft backtest strategy',
  '/tools/leveraged-etf/': 'tqqq upro 3x leverage decay',
  '/calculators/financial-independence/': 'fire 4% rule withdrawal retire number',
  '/tools/fire-cpf/': 'fire cpf 55 retirement sum bridge couple bto',
  '/report/': 'pdf print summary export',
};

export function searchIndex(posts: { href: string; title: string; description: string }[]): SearchItem[] {
  const blurb = (href: string) =>
    tools.find((t) => `/tools/${t.slug}/` === href)?.blurb ?? calculators.find((c) => `/calculators/${c.slug}/` === href)?.blurb ?? '';
  const pages = path.map((s) => {
    const text = blurb(s.href) || s.question;
    return { href: s.href, title: s.title, text, hay: `${s.title} ${s.question} ${text} ${KEYWORDS[s.href] ?? ''}`.toLowerCase() };
  });
  const blog = posts.map((p) => ({ href: p.href, title: p.title, text: p.description, hay: `${p.title} ${p.description} blog guide`.toLowerCase() }));
  return [...pages, ...blog];
}

/** Pages containing every word of the query, title matches first. At most `limit` results. */
export function search(items: SearchItem[], query: string, limit = 5): SearchItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return items
    .filter((i) => words.every((w) => i.hay.includes(w)))
    .map((i) => ({ i, score: words.filter((w) => i.title.toLowerCase().includes(w)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.i);
}
