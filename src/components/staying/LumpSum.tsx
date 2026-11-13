import { useMemo } from 'react';
import type { Monthly } from '../../lib/backtest';
import { lumpVsSpread } from '../../lib/staying';
import { pct, useJson, useStored } from '../../lib/storage';
import { PercentInput } from '../PercentInput';
import { Presets } from '../Presets';

const SPREADS = [3, 6, 12, 18];

export default function LumpSum() {
  const { data: monthly, error } = useJson<Monthly>('/data/monthly.json');
  const [o, setO] = useStored('lumpsum', { holdYears: 10, cashRate: 3 });

  const rows = useMemo(() => {
    if (!monthly || !monthly.series.SPY) return [];
    return SPREADS.map((m) => ({ months: m, r: lumpVsSpread(monthly.series.SPY, m, o.holdYears * 12, o.cashRate) }));
  }, [monthly, o.holdYears, o.cashRate]);

  if (error) return <p className="warn">{error}</p>;
  if (!monthly) return <p>Loading price data…</p>;
  if (!monthly.series.SPY) return <p className="warn">n/a: SPY prices are not in this site’s data.</p>;

  const first = monthly.dates[0];
  const last = monthly.dates[monthly.dates.length - 1];

  return (
    <div className="tool">
      <section>
        <div className="panel">
          <div className="controls">
            <div>
              <label htmlFor="ls-hold">Years invested in total</label>
              <input id="ls-hold" type="number" min={1} max={25} step={1} value={o.holdYears} onChange={(e) => setO((p) => ({ ...p, holdYears: Math.max(1, Math.round(Number(e.target.value) || 1)) }))} />
              <Presets label="Years invested" options={[2, 5, 10, 15, 20]} current={o.holdYears} onPick={(v) => setO((p) => ({ ...p, holdYears: v }))} />
            </div>
            <div>
              <label htmlFor="ls-cash">Interest on money waiting to be invested (% a year)</label>
              <PercentInput id="ls-cash" value={o.cashRate} onChange={(v) => setO((p) => ({ ...p, cashRate: v }))} />
              <Presets label="Cash interest" options={[0, 1, 2, 3, 4].map((v) => ({ label: `${v}%`, value: v }))} current={o.cashRate} onPick={(v) => setO((p) => ({ ...p, cashRate: v }))} />
            </div>
          </div>
          <p className="note">
            You have a sum to invest in the S&amp;P 500 (SPY, dividends reinvested). Either it all goes in on day one, or it
            goes in equal monthly parts while the rest earns interest. Every month from {first} that leaves room for the
            full period, up to {last}, is used as a starting point.
          </p>
        </div>
      </section>

      <section>
        <h2>Result over {o.holdYears} years</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Spread over</th>
                <th>Lump sum ahead</th>
                <th>Lump sum, a year</th>
                <th>Spread out, a year</th>
                <th>Typical gap</th>
                <th>Starts tested</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ months, r }) =>
                r ? (
                  <tr key={months}>
                    <td>{months} months</td>
                    <td>{pct(r.lumpWins, 0)} of the time</td>
                    <td>{pct(r.meanLump, 2)}</td>
                    <td>{pct(r.meanSpread, 2)}</td>
                    <td>{`${r.medianGap >= 0 ? '+' : ''}${(r.medianGap * 100).toFixed(2)} points`}</td>
                    <td>{r.windows}</td>
                  </tr>
                ) : (
                  <tr key={months}>
                    <td>{months} months</td>
                    <td colSpan={5} className="wrap-cell">
                      n/a: the price data is too short for a {o.holdYears}-year period.
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <p className="note">
          The two return columns are averages across all starting months. Typical gap compares the two approaches from
          the same starting month and takes the middle result; a plus sign means the lump sum was ahead. The starting
          months overlap heavily, and all of them
          fall between {first.slice(0, 4)} and {last.slice(0, 4)}, so treat the percentages as a guide from one stretch of
          history, not a law. Longer periods have fewer starting months to test.
        </p>
        <div className="panel">
          <p>
            <strong>Putting it all in at once has come out ahead more often than not, and the gap is small either way.</strong>{' '}
            Markets rise more often than they fall, so money that waits tends to buy at higher prices. Spreading out did
            better for people who started just before the falls of 2000 and 2008. If investing everything on one day
            would make you sell at the first fall, spreading it over 6 to 12 months is far better than leaving it in cash
            for years.
          </p>
          <p className="note">
            This is about a sum you already have. Investing part of each month’s pay as it arrives is a different thing,
            and is simply investing as early as you can.
          </p>
        </div>
      </section>
    </div>
  );
}
