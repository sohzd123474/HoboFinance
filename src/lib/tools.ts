// The tools index. `ready: false` keeps a tool off the site until its page exists.
export interface Tool {
  slug: string;
  title: string;
  blurb: string;
  ready: boolean;
}

export const tools: Tool[] = [
  { slug: 'snp1', title: 'SNP1 strategy', blurb: 'Hold the largest US company, check once a month. Backtested from 2000 against SPY.', ready: true },
  { slug: 'etf-tax-drag', title: 'ETF tax drag', blurb: 'US-listed against Ireland-domiciled ETFs for a Singapore investor: fees, dividend tax and break-even size.', ready: true },
  { slug: 'fire-cpf', title: 'FIRE and CPF bridge', blurb: 'Plan the years between leaving work and 55, for one person or a couple.', ready: true },
  { slug: 'concentration', title: 'Concentration checker', blurb: 'See how concentrated your holdings are and whether your monthly buying makes it worse.', ready: true },
  { slug: 'ilp-vs-diy', title: 'ILP against DIY', blurb: 'An investment-linked policy against buying a world ETF yourself, over 30 years.', ready: true },
  { slug: 'leveraged-etf', title: 'Leveraged ETF check', blurb: 'What a 3x daily product does over years, from real prices.', ready: true },
  { slug: 'ssb', title: 'Savings Bonds tracker', blurb: 'Every Singapore Savings Bonds issue since 2015, and whether it beats leaving money in CPF OA.', ready: true },
  { slug: 'drawdowns', title: 'Falls within a year', blurb: 'How far markets fell at some point in each year, and how often those years still ended up.', ready: true },
  { slug: 'lump-sum-vs-dca', title: 'Lump sum or spread it out', blurb: 'Investing a windfall at once against feeding it in over months, tested on every starting month since 1999.', ready: true },
  { slug: 'parking', title: 'Short-term parking', blurb: 'Where to keep money you need within two years, and what it earns.', ready: true },
];
