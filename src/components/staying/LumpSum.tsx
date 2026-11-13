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
          <ul className="points">
            <li>
              <strong>The choice.</strong> You have a sum to invest in the S&amp;P 500 (SPY, dividends reinvested).
            </li>
            <li>
              <strong>Lump sum.</strong> All of it goes in on day one.
            </li>
            <li>
              <strong>Spread out.</strong> It goes in equal monthly parts while the rest earns interest.
            </li>
            <li>
              <strong>Starting months tested.</strong> Every month from {first} to {last} that leaves room for the full
              period.
            </li>
          </ul>
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
        <ul className="points">
          <li>
            <strong>Return columns.</strong> The two return columns are averages across all starting months.
          </li>
          <li>
            <strong>Typical gap.</strong> It compares the two approaches from the same starting month and takes the
            middle result. A plus sign means the lump sum was ahead.
          </li>
          <li>
            <strong>One period of history.</strong> The starting months overlap heavily, and all fall between{' '}
            {first.slice(0, 4)} and {last.slice(0, 4)}. Treat the percentages as a guide, not a rule.
          </li>
          <li>
            <strong>Longer periods.</strong> They have fewer starting months to test.
          </li>
        </ul>
        <div className="panel">
          <ul className="points">
            <li>
              <strong>Lump sum was ahead more often.</strong> Putting it all in at once has come out ahead more often
              than not. The gap is small either way.
            </li>
            <li>
              <strong>Why.</strong> Markets rise more often than they fall, so money that waits tends to buy at higher
              prices.
            </li>
            <li>
              <strong>When spreading out did better.</strong> For people who started just before the falls of 2000 and
              2008.
            </li>
            <li>
              <strong>If a fall would make you sell.</strong> Spread the sum over 6 to 12 months. That is better than
              leaving it in cash for years.
            </li>
            <li>
              <strong>A sum you already have.</strong> This page is about a sum you already have. Investing part of each
              month’s pay as it arrives is different: it is investing as early as you can.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
