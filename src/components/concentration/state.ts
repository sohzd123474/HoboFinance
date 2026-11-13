// Saved inputs for the concentration checker, shared by the page and the
// report summary so both compute exactly the same figures.

import { DEFAULT_US_SHARE_PCT, SP500_FUNDS, SP500_TOP, WORLD_FUNDS } from '../../data/sp500-top';
import { applyDca, lookThrough, parseHoldings, redundantDca, summarisePositions, type FundConfig } from '../../lib/concentration';

export const STORAGE_KEY = 'concentration';
export const DCA_MONTHS = 12;

// Placeholder example, not anyone's real portfolio. D05 is DBS on the Singapore exchange.
export const DEFAULTS = {
  holdingsText: 'CSPX 30000\nAAPL 5000\nNVDA 4000\nD05 6000',
  dcaText: 'CSPX 1000\nNVDA 300\nAAPL 200',
  spFunds: SP500_FUNDS,
  worldFunds: WORLD_FUNDS.map((f) => f.ticker),
  usShare: Object.fromEntries(WORLD_FUNDS.map((f) => [f.ticker, f.usSharePct])) as Record<string, number>,
};
export type State = typeof DEFAULTS;

/** Everything the page and the report show, worked out from saved state. */
export function compute(o: State) {
  const held = parseHoldings(o.holdingsText);
  const dca = parseHoldings(o.dcaText);
  const cfg: FundConfig = {
    spFunds: o.spFunds,
    worldFunds: Object.fromEntries(o.worldFunds.map((t) => [t, o.usShare[t] ?? DEFAULT_US_SHARE_PCT])),
    constituents: SP500_TOP,
  };
  const after = applyDca(held.rows, dca.rows, DCA_MONTHS);
  return {
    held,
    dca,
    cfg,
    now: summarisePositions(held.rows),
    later: summarisePositions(after),
    ltNow: lookThrough(held.rows, cfg),
    ltLater: lookThrough(after, cfg),
    redundant: redundantDca(held.rows, dca.rows, cfg),
  };
}
