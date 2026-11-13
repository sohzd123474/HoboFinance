import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Daily } from '../../lib/backtest';
import { assetPath, leveragedPath, pathStats, type Path } from '../../lib/leverage';
import { pct, num, useJson, useStored } from '../../lib/storage';
import { Presets } from '../Presets';

const DEFAULTS = { start: '2010-02-11', end: '', leverage: 3, cost: 0.95 };
const INDEX = 'QQQ';
const PRODUCT = 'TQQQ';

const times = (v: number) => `${v >= 100 ? v.toFixed(0) : v.toFixed(2)}x`;

export default function Leverage() {
  const { data: daily, error } = useJson<Daily>('/data/daily.json');
  const [o, setO] = useStored('leverage', DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) => setO((p) => ({ ...p, [k]: v }));

  const calc = useMemo(() => {
    if (!daily) return null;
    const idx = daily.series[INDEX];
    if (!idx) return { missing: `No daily prices for ${INDEX} in this site's data.` } as const;
    const lastDate = daily.dates[daily.dates.length - 1];
    const firstIndex = daily.dates.find((_, i) => idx.c[i] != null) ?? daily.dates[0];
    const firstProduct = daily.series[PRODUCT] ? daily.dates.find((_, i) => daily.series[PRODUCT].c[i] != null) ?? null : null;
    const start = o.start >= firstIndex && o.start < lastDate ? o.start : firstIndex;
    const end = o.end && o.end > start && o.end <= lastDate ? o.end : lastDate;
    const index = assetPath(daily.dates, idx.c, start, end);
    if (!index) return { missing: 'There are not enough prices between these dates.' } as const;
    const sim = leveragedPath(index, o.leverage, o.cost);
    const real = daily.series[PRODUCT] ? assetPath(daily.dates, daily.series[PRODUCT].c, index.dates[0], end) : null;
    // The real product is only comparable when it traded on the first day of the window.
    const realOk = real && real.dates[0] === index.dates[0] ? real : null;
    return { index, sim, real: realOk, start, end, firstIndex, firstProduct, lastDate };
  }, [daily, o.start, o.end, o.leverage, o.cost]);

  if (error) return <p className="warn">{error}</p>;
  if (!daily || !calc) return <p>Loading daily prices…</p>;
  if ('missing' in calc) return <p className="warn">n/a: {calc.missing}</p>;

  const { index, sim, real, firstIndex, firstProduct, lastDate } = calc;
  const rows: { name: string; color: string; path: Path }[] = [
    { name: `${INDEX} (the index fund, 1x)`, color: 'var(--c2)', path: index },
    { name: `${o.leverage}x daily, simulated`, color: 'var(--c3)', path: sim },
    ...(real ? [{ name: `${PRODUCT} (the real 3x fund)`, color: 'var(--c4)', path: real }] : []),
  ];
  const stats = rows.map((r) => ({ ...r, s: pathStats(r.path) }));
  const naive = o.leverage * stats[0].s.totalReturn;

  // Thin the series so the chart stays light: about 400 points.
  const step = Math.max(1, Math.floor(index.dates.length / 400));
  const realByDate = real ? new Map(real.dates.map((d, i) => [d, real.values[i]])) : null;
  const chart = index.dates
    .map((d, i) => ({ date: d, index: index.values[i], sim: sim.values[i] > 0 ? sim.values[i] : null, real: realByDate?.get(d) ?? null }))
    .filter((_, i) => i % step === 0 || i === index.dates.length - 1);

  const windows = [
    { label: 'Since TQQQ began', start: firstProduct ?? firstIndex, end: lastDate },
    { label: 'Dot-com crash', start: '2000-03-01', end: '2002-12-31' },
    { label: '2008 crisis', start: '2007-10-01', end: '2009-03-31' },
    { label: '2020 crash', start: '2020-02-01', end: '2020-04-30' },
    { label: '2022', start: '2022-01-01', end: '2022-12-31' },
    { label: 'All data', start: firstIndex, end: lastDate },
  ];

  return (
    <div className="tool">
      <section>
        <div className="panel">
          <div>
            <span className="ctl-label">Period</span>
            <div className="chips" role="group" aria-label="Period">
              {windows.map((w) => (
                <button key={w.label} type="button" aria-pressed={calc.start === w.start && calc.end === w.end} onClick={() => setO((p) => ({ ...p, start: w.start, end: w.end }))}>
                  {w.label}
                </button>
              ))}
            </div>
          </div>
          <div className="controls">
            <div>
              <label htmlFor="lv-start">From</label>
              <input id="lv-start" type="text" inputMode="numeric" placeholder="YYYY-MM-DD" value={o.start} onChange={(e) => set('start', e.target.value)} />
            </div>
            <div>
              <label htmlFor="lv-end">To</label>
              <input id="lv-end" type="text" inputMode="numeric" placeholder={lastDate} value={o.end} onChange={(e) => set('end', e.target.value)} />
            </div>
            <div>
              <label htmlFor="lv-x">Leverage</label>
              <input id="lv-x" type="number" min={1} max={5} step={0.5} value={o.leverage} onChange={(e) => set('leverage', num(e.target.value, 3))} />
              <Presets label="Leverage" options={[{ label: '2x', value: 2 }, { label: '3x', value: 3 }, { label: '5x', value: 5 }]} current={o.leverage} onPick={(v) => set('leverage', v)} />
            </div>
            <div>
              <label htmlFor="lv-cost">Yearly cost (%)</label>
              <input id="lv-cost" type="number" min={0} max={10} step={0.05} value={o.cost} onChange={(e) => set('cost', num(e.target.value))} />
              <Presets label="Yearly cost" options={[{ label: '0%', value: 0 }, { label: '0.95%', value: 0.95 }, { label: '2%', value: 2 }, { label: '5%', value: 5 }]} current={o.cost} onPick={(v) => set('cost', v)} />
            </div>
          </div>
          <p className="note">
            Showing {index.dates[0]} to {index.dates[index.dates.length - 1]}. Dates outside the data ({firstIndex} to {lastDate}) fall back to
            the nearest end. The yearly cost stands for the fund’s fees and borrowing costs; 0.95% is a starting value, so
            check the fund’s own page for its current expense ratio. Borrowing costs rise with interest rates and are not
            in that figure.
          </p>
        </div>
      </section>

      <section>
        <h2>Result</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>What you held</th>
                <th>1 became</th>
                <th>Total return</th>
                <th>Growth a year</th>
                <th>Worst fall</th>
                <th>Volatility</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((r) => (
                <tr key={r.name}>
                  <td>
                    <span className="swatch" style={{ background: r.color }} />
                    {r.name}
                  </td>
                  <td>{times(r.s.totalReturn + 1)}</td>
                  <td>{pct(r.s.totalReturn)}</td>
                  <td>{pct(r.s.cagr)}</td>
                  <td>{pct(r.s.maxDrawdown)}</td>
                  <td>{pct(r.s.volatility)}</td>
                </tr>
              ))}
              {!real && (
                <tr>
                  <td>{PRODUCT} (the real 3x fund)</td>
                  <td colSpan={5} className="wrap-cell">
                    n/a: {firstProduct ? `${PRODUCT} only started trading on ${firstProduct}, after this period begins.` : `${PRODUCT} prices are not in this site's data.`}
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
                <th className="wrap-cell">Is it {o.leverage} times the return?</th>
                <th>Total return</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="wrap-cell">
                  What “{o.leverage}x” sounds like: {o.leverage} times the index’s total return
                </td>
                <td>{pct(naive)}</td>
              </tr>
              <tr>
                <td className="wrap-cell">What {o.leverage}x each day delivered</td>
                <td>{pct(stats[1].s.totalReturn)}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Difference</td>
                <td>{`${((stats[1].s.totalReturn - naive) * 100).toFixed(1)} points`}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note">
          The fund multiplies each day’s move, not the move over the whole period. In a steady rise that compounds in
          your favour. When prices swing up and down, every swing takes a piece that is never given back, and a fall of{' '}
          {pct(1 / o.leverage, 0)} or more in a single day would wipe the fund out.
        </p>

        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(0, 4)} minTickGap={40} stroke="var(--ink-soft)" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} />
              <YAxis scale="log" domain={['auto', 'auto']} allowDataOverflow width={56} stroke="var(--ink-soft)" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} tickFormatter={(v: number) => times(v)} />
              <Tooltip
                contentStyle={{ background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: 3, color: 'var(--ink)' }}
                formatter={(value, name) => [times(Number(value)), name === 'index' ? INDEX : name === 'sim' ? `${o.leverage}x simulated` : PRODUCT]}
              />
              <Line dataKey="index" stroke="var(--c2)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="sim" stroke="var(--c3)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
              {real && <Line dataKey="real" stroke="var(--c4)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="note">Growth of 1 on a log scale, so equal distances are equal percentage moves.</p>
      </section>

      <section>
        <h2>Other leveraged products</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Product</th>
                <th className="wrap-cell">What this site can show</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>FNGU and similar 3x notes</td>
                <td className="wrap-cell">
                  n/a: they track the NYSE FANG+ index, whose daily history is not in this site’s data. The same daily
                  multiplying applies, on a narrower and more volatile index.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <p>
            <strong>Exchange-traded notes carry issuer risk.</strong> FNGU-style products are notes, not funds. A note is
            an unsecured promise from the bank that issued it. If the bank fails, holders are creditors, whatever the
            index did. The issuer can also redeem or delist a note early.
          </p>
        </div>
      </section>
    </div>
  );
}
