import { useMemo } from 'react';
import type { Daily } from '../../lib/backtest';
import { fallSummary, yearStats } from '../../lib/staying';
import { pct, useJson, useStored } from '../../lib/storage';
import { Presets } from '../Presets';

const NAMES: Record<string, string> = { SPY: 'S&P 500 (SPY)', QQQ: 'Nasdaq-100 (QQQ)' };

export default function Drawdowns() {
  const { data: daily, error } = useJson<Daily>('/data/daily.json');
  const [o, setO] = useStored('drawdowns', { ticker: 'SPY', threshold: 10 });

  const tickers = daily ? Object.keys(daily.series).filter((t) => t !== 'TQQQ') : [];
  const ticker = tickers.includes(o.ticker) ? o.ticker : 'SPY';
  const stats = useMemo(() => (daily && daily.series[ticker] ? yearStats(daily.dates, daily.series[ticker].c) : []), [daily, ticker]);

  if (error) return <p className="warn">{error}</p>;
  if (!daily) return <p>Loading daily prices…</p>;
  if (stats.length === 0) return <p className="warn">n/a: there are no full years of prices for {ticker} in this site’s data.</p>;

  const s = fallSummary(stats, o.threshold);
  const share = (a: number, b: number) => (b === 0 ? 'n/a' : pct(a / b, 0));

  return (
    <div className="tool">
      <section>
        <div className="panel">
          <div className="controls">
            <div>
              <label htmlFor="dd-t">Market or share</label>
              <select id="dd-t" value={ticker} onChange={(e) => setO((p) => ({ ...p, ticker: e.target.value }))}>
                {tickers.map((t) => (
                  <option key={t} value={t}>
                    {NAMES[t] ?? t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="ctl-label">Count a year when it fell at least</span>
              <Presets label="Fall" options={[5, 10, 15, 20, 30].map((v) => ({ label: `${v}%`, value: v }))} current={o.threshold} onPick={(v) => setO((p) => ({ ...p, threshold: v }))} />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>What usually happens</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th className="wrap-cell">
                  {NAMES[ticker] ?? ticker}, {stats[0].year} to {stats[stats.length - 1].year}
                </th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="wrap-cell">Full years in the data</td>
                <td>{s.years}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Typical worst fall within a year (the middle year)</td>
                <td>{pct(s.medianDrawdown)}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Years that fell {o.threshold}% or more at some point</td>
                <td>
                  {s.scary} of {s.years} ({share(s.scary, s.years)})
                </td>
              </tr>
              <tr>
                <td className="wrap-cell">Of those, years that still ended higher than they began</td>
                <td>{s.scary === 0 ? 'n/a: no such years' : `${s.endedUp} of ${s.scary} (${share(s.endedUp, s.scary)})`}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="points">
          <li>
            <strong>Selling makes the loss real.</strong> Selling during a fall turns it into a loss. In many of these
            years the price had recovered by December.
          </li>
          <li>
            <strong>How a fall is measured.</strong> From a high to a later low inside the same calendar year. It uses
            daily closing prices with dividends included.
          </li>
        </ul>
      </section>

      <section>
        <h2>Year by year</h2>
        <div className="table-scroll" style={{ maxHeight: '28rem', overflowY: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Year</th>
                <th>Worst fall within the year</th>
                <th>Return for the year</th>
                <th>Fell {o.threshold}% or more?</th>
              </tr>
            </thead>
            <tbody>
              {[...stats].reverse().map((y) => (
                <tr key={y.year}>
                  <td>{y.year}</td>
                  <td>{pct(y.maxDrawdown)}</td>
                  <td>{pct(y.yearReturn)}</td>
                  <td>{y.maxDrawdown <= -o.threshold / 100 ? (y.yearReturn > 0 ? 'Yes, and ended up' : 'Yes, and ended down') : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          Prices: Yahoo Finance, complete to {daily.dates[daily.dates.length - 1]}. The current year is left out until it
          has at least 200 trading days.
        </p>
      </section>
    </div>
  );
}
