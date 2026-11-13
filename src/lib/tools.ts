// The tools index. `ready: false` keeps a tool off the site until its page exists.
export interface Tool {
  slug: string;
  title: string;
  blurb: string;
  ready: boolean;
}

export const tools: Tool[] = [
  { slug: 'snp1', title: 'SNP1 strategy', blurb: 'See how holding only the largest US company did against SPY since 2000.', ready: true },
  { slug: 'etf-tax-drag', title: 'ETF tax drag', blurb: 'Compare US-listed and Ireland-domiciled ETFs for a Singapore investor: fees, dividend tax and break-even size.', ready: true },
  { slug: 'fire-cpf', title: 'FIRE and CPF bridge', blurb: 'Plan the years between leaving work and 55, for one person or a couple.', ready: true },
  { slug: 'concentration', title: 'Concentration checker', blurb: 'See how concentrated your holdings are and whether your monthly buying makes it worse.', ready: true },
  { slug: 'ilp-vs-diy', title: 'ILP against DIY', blurb: 'Compare an investment-linked policy with buying a world ETF yourself, over 30 years.', ready: true },
  { slug: 'leveraged-etf', title: 'Leveraged ETF check', blurb: 'See what a 3x daily fund does over years, from real prices.', ready: true },
  { slug: 'ssb', title: 'Savings Bonds tracker', blurb: 'Check every Singapore Savings Bonds issue since 2015 against leaving money in CPF OA.', ready: true },
  { slug: 'drawdowns', title: 'Falls within a year', blurb: 'See how far markets fell within each year, and how often those years still ended higher.', ready: true },
  { slug: 'lump-sum-vs-dca', title: 'Lump sum or spread it out', blurb: 'Compare investing a windfall at once with spreading it over months, tested on every starting month since 1999.', ready: true },
  { slug: 'parking', title: 'Short-term parking', blurb: 'Find where to keep money you need within two years, and what it earns.', ready: true },
];
