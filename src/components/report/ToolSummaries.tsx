import type { ReactNode } from 'react';
import { VARIANTS, runBacktest, type Daily, type Monthly } from '../../lib/backtest';
import { NUMBER_ONE, TOP7_QUARTERLY } from '../../data/rankings';
import { assetPath, leveragedPath, pathStats } from '../../lib/leverage';
import { fallSummary, lumpVsSpread, yearStats } from '../../lib/staying';
import { pct, readStored, usd, useJson } from '../../lib/storage';
import { DEFAULTS as SNP1_DEFAULTS } from '../snp1/Explorer';
import { DEFAULTS as LEVERAGE_DEFAULTS } from '../leverage/Leverage';

// Report summaries for the tools that run on the site's market data. Each one
// reads the visitor's saved settings and repeats the page's calculation.

type Row = [label: string, value: ReactNode];

function Pair({ entered, result }: { entered: Row[]; result: Row[] }) {
  const table = (title: string, rows: Row[], headline: boolean) => (
    <div className="table-scroll">
      <table className="data">
        <thead>
          <tr>
            <th>{title}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={label}>
              <td className="wrap-cell">{headline && i === 0 ? <strong>{label}</strong> : label}</td>
              <td>{headline && i === 0 ? <strong>{value}</strong> : value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="report-pair">
      {table('What you entered', entered, false)}
      {table('Result', result, true)}
    </div>
  );
}

const Loading = ({ error }: { error: string | null }) => (error ? <p className="warn">{error}</p> : <p className="note">Loading price data…</p>);
const times = (v: number) => `${v >= 100 ? v.toFixed(0) : v.toFixed(2)}x`;

export function Snp1Summary() {
  const m = useJson<Monthly>('/data/monthly.json');
  const d = useJson<Daily>('/data/daily.json');
  if (!m.data) return <Loading error={m.error} />;
  const o = readStored('snp1', SNP1_DEFAULTS);
  const months = m.data.dates.filter((x) => x >= '2000-01');
  const start = months.includes(o.start) ? o.start : months[0];
  const end = months.includes(o.end) ? o.end : months[months.length - 1];
  const shown = VARIANTS.filter((v) => o.variants.includes(v.id));
  const rankings = { numberOne: NUMBER_ONE, top7: TOP7_QUARTERLY };
  const runs = shown.map((v) => ({
    v,
    r: runBacktest(m.data!, rankings, { variant: v.id, cadence: o.cadence, start, end, monthly: o.monthly, worstCase: o.worstCase }, d.data ?? undefined),
  }));
  const snp1 = runs.find((x) => x.v.id === 'snp1')?.r;
  const first = runs.find((x) => x.r.ok)?.r;
  return (
    <>
      <Pair
        entered={[
          ['Period', `${start} to ${end}`],
          ['Invested each month', usd(o.monthly)],
          ['Ranking check', o.cadence],
          ['Worst-case execution on rotations', o.worstCase ? 'On' : 'Off'],
          ['Strategies compared', shown.map((v) => v.name).join(', ') || 'None'],
        ]}
        result={
          snp1 && snp1.ok
            ? [
                ['SNP1 final value', usd(snp1.metrics.finalValue)],
                ['Money put in', usd(snp1.metrics.contributed)],
                ['Growth a year', pct(snp1.metrics.cagr)],
                ['Your return a year', pct(snp1.metrics.irr)],
                ['Worst fall', pct(snp1.metrics.maxDrawdown)],
                ['Rotations', snp1.metrics.rotations],
              ]
            : [['SNP1', snp1 ? `n/a: ${snp1.reason}` : 'n/a: SNP1 is not among the strategies you ticked']]
        }
      />
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Growth a year</th>
              <th>Your return a year</th>
              <th>Volatility</th>
              <th>Worst fall</th>
              <th>Final value</th>
              <th>Rotations</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(({ v, r }) =>
              r.ok ? (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td>{pct(r.metrics.cagr)}</td>
                  <td>{pct(r.metrics.irr)}</td>
                  <td>{pct(r.metrics.volatility)}</td>
                  <td>{pct(r.metrics.maxDrawdown)}</td>
                  <td>{usd(r.metrics.finalValue)}</td>
                  <td>{r.metrics.rotations}</td>
                </tr>
              ) : (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td colSpan={6} className="wrap-cell">
                    n/a: {r.reason}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {first && first.ok && (
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>End of</th>
                {runs.filter((x) => x.r.ok).map(({ v }) => (
                  <th key={v.id}>{v.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {first.points
                .map((p, i) => ({ p, i }))
                .filter(({ p, i }) => p.date.endsWith('-12') || i === first.points.length - 1)
                .map(({ p, i }) => (
                  <tr key={p.date}>
                    <td>{p.date}</td>
                    {runs
                      .filter((x) => x.r.ok)
                      .map(({ v, r }) => (
                        <td key={v.id}>{r.ok && r.points[i] ? usd(r.points[i].value) : 'n/a'}</td>
                      ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {snp1 && snp1.ok && snp1.rotations.length > 0 && (
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>SNP1 rotation at check</th>
                <th>Sold</th>
                <th>Bought</th>
              </tr>
            </thead>
            <tbody>
              {snp1.rotations.map((x) => (
                <tr key={x.date}>
                  <td>{x.date}</td>
                  <td>{x.from}</td>
                  <td>{x.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">Values in USD with dividends reinvested, before trading costs, tax and currency conversion. Past results do not predict future ones.</p>
    </>
  );
}

export function LeverageSummary() {
  const { data: daily, error } = useJson<Daily>('/data/daily.json');
  if (!daily) return <Loading error={error} />;
  const o = readStored('leverage', LEVERAGE_DEFAULTS);
  const idx = daily.series.QQQ;
  if (!idx) return <p className="warn">n/a: QQQ prices are not in this site’s data.</p>;
  const lastDate = daily.dates[daily.dates.length - 1];
  const firstIndex = daily.dates.find((_, i) => idx.c[i] != null) ?? daily.dates[0];
  const start = o.start >= firstIndex && o.start < lastDate ? o.start : firstIndex;
  const end = o.end && o.end > start && o.end <= lastDate ? o.end : lastDate;
  const index = assetPath(daily.dates, idx.c, start, end);
  if (!index) return <p className="warn">n/a: there are not enough prices between {start} and {end}.</p>;
  const sim = leveragedPath(index, o.leverage, o.cost);
  const realRaw = daily.series.TQQQ ? assetPath(daily.dates, daily.series.TQQQ.c, index.dates[0], end) : null;
  const real = realRaw && realRaw.dates[0] === index.dates[0] ? realRaw : null;
  const rows = [
    { name: 'QQQ (the index fund, 1x)', path: index },
    { name: `${o.leverage}x daily, simulated`, path: sim },
    ...(real ? [{ name: 'TQQQ (the real 3x fund)', path: real }] : []),
  ].map((r) => ({ ...r, s: pathStats(r.path) }));
  const realByDate = real ? new Map(real.dates.map((x, i) => [x, real.values[i]])) : null;
  return (
    <>
      <Pair
        entered={[
          ['Period', `${index.dates[0]} to ${index.dates[index.dates.length - 1]}`],
          ['Leverage', `${o.leverage}x`],
          ['Yearly cost', `${o.cost}%`],
        ]}
        result={[
          [`1 in the ${o.leverage}x product became`, times(rows[1].s.totalReturn + 1)],
          ['1 in the index became', times(rows[0].s.totalReturn + 1)],
          [`${o.leverage} times the index’s total return would be`, pct(o.leverage * rows[0].s.totalReturn)],
          [`${o.leverage}x each day delivered`, pct(rows[1].s.totalReturn)],
          ['Worst fall of the leveraged product', pct(rows[1].s.maxDrawdown)],
        ]}
      />
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>What you held</th>
              <th>1 became</th>
              <th>Growth a year</th>
              <th>Worst fall</th>
              <th>Volatility</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{times(r.s.totalReturn + 1)}</td>
                <td>{pct(r.s.cagr)}</td>
                <td>{pct(r.s.maxDrawdown)}</td>
                <td>{pct(r.s.volatility)}</td>
              </tr>
            ))}
            {!real && (
              <tr>
                <td>TQQQ (the real 3x fund)</td>
                <td colSpan={4} className="wrap-cell">
                  n/a: TQQQ was not trading at the start of this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>End of</th>
              <th>QQQ</th>
              <th>{o.leverage}x simulated</th>
              {real && <th>TQQQ</th>}
            </tr>
          </thead>
          <tbody>
            {index.dates
              .map((x, i) => ({ x, i }))
              .filter(({ x, i }) => i === index.dates.length - 1 || x.slice(0, 4) !== index.dates[i + 1].slice(0, 4))
              .map(({ x, i }) => (
                <tr key={x}>
                  <td>{x.slice(0, 4)}</td>
                  <td>{times(index.values[i])}</td>
                  <td>{times(sim.values[i])}</td>
                  {real && <td>{realByDate?.has(x) ? times(realByDate.get(x)!) : 'n/a'}</td>}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function DrawdownsSummary() {
  const { data: daily, error } = useJson<Daily>('/data/daily.json');
  if (!daily) return <Loading error={error} />;
  const o = readStored('drawdowns', { ticker: 'SPY', threshold: 10 });
  const ticker = daily.series[o.ticker] ? o.ticker : 'SPY';
  const stats = daily.series[ticker] ? yearStats(daily.dates, daily.series[ticker].c) : [];
  if (stats.length === 0) return <p className="warn">n/a: there are no full years of prices for {ticker} in this site’s data.</p>;
  const s = fallSummary(stats, o.threshold);
  return (
    <>
      <Pair
        entered={[
          ['Market or share', ticker],
          ['A scary year is a fall of at least', `${o.threshold}%`],
        ]}
        result={[
          [`Years that fell ${o.threshold}% or more at some point`, `${s.scary} of ${s.years}`],
          ['Of those, years that still ended higher', s.scary === 0 ? 'n/a: no such years' : `${s.endedUp} of ${s.scary}`],
          ['Typical worst fall within a year', pct(s.medianDrawdown)],
        ]}
      />
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Year</th>
              <th>Worst fall within the year</th>
              <th>Return for the year</th>
            </tr>
          </thead>
          <tbody>
            {[...stats].reverse().map((y) => (
              <tr key={y.year}>
                <td>{y.year}</td>
                <td>{pct(y.maxDrawdown)}</td>
                <td>{pct(y.yearReturn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function LumpSumSummary() {
  const { data: monthly, error } = useJson<Monthly>('/data/monthly.json');
  if (!monthly) return <Loading error={error} />;
  const o = readStored('lumpsum', { holdYears: 10, cashRate: 3 });
  if (!monthly.series.SPY) return <p className="warn">n/a: SPY prices are not in this site’s data.</p>;
  const rows = [3, 6, 12, 18].map((months) => ({ months, r: lumpVsSpread(monthly.series.SPY, months, o.holdYears * 12, o.cashRate) }));
  const twelve = rows.find((x) => x.months === 12)?.r;
  return (
    <>
      <Pair
        entered={[
          ['Years invested in total', o.holdYears],
          ['Interest on money waiting to be invested', `${o.cashRate}%`],
        ]}
        result={
          twelve
            ? [
                ['Lump sum beat spreading over 12 months', `${pct(twelve.lumpWins, 0)} of the time`],
                ['Typical gap a year', `${twelve.medianGap >= 0 ? '+' : ''}${(twelve.medianGap * 100).toFixed(2)} points`],
                ['Starting months tested', twelve.windows],
              ]
            : [['Lump sum against spreading out', `n/a: the price data is too short for a ${o.holdYears}-year period`]]
        }
      />
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Spread over</th>
              <th>Lump sum ahead</th>
              <th>Lump sum, a year</th>
              <th>Spread out, a year</th>
              <th>Typical gap</th>
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
                </tr>
              ) : (
                <tr key={months}>
                  <td>{months} months</td>
                  <td colSpan={4} className="wrap-cell">
                    n/a: the price data is too short.
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <p className="note">S&amp;P 500 (SPY) with dividends reinvested, every starting month the data allows.</p>
    </>
  );
}
