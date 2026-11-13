import { MoneyInput } from '../MoneyInput';
import { Presets } from '../Presets';
import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  VARIANTS,
  dipBuying,
  numberOneAt,
  runBacktest,
  type BacktestResult,
  type Cadence,
  type Daily,
  type Monthly,
  type Options,
  type VariantId,
} from '../../lib/backtest';
import { NUMBER_ONE, RANKINGS_RESEARCHED_ON, SOURCES, TOP7_QUARTERLY } from '../../data/rankings';
import { pct, usd, useJson, useStored } from '../../lib/storage';

interface Meta {
  builtAt: string;
  lastMonth: string;
  firstMonth: Record<string, string | null>;
  missing: Record<string, string>;
}

const rankings = { numberOne: NUMBER_ONE, top7: TOP7_QUARTERLY };
const COLOR: Record<VariantId, string> = {
  snp1: 'var(--c1)',
  snp2: 'var(--c4)',
  snp7: 'var(--c5)',
  blend: 'var(--c6)',
  rank2: 'var(--c7)',
  momentum: 'var(--c3)',
  trend: 'var(--c8)',
  spy: 'var(--c2)',
};
const TICKER_COLORS = ['var(--c1)', 'var(--c4)', 'var(--c3)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)', 'var(--c2)'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export const DEFAULTS = {
  start: '2000-01',
  end: '',
  monthly: 1000,
  cadence: 'monthly' as Cadence,
  worstCase: false,
  variants: ['snp1', 'spy'] as VariantId[],
  dipTicker: 'SPY',
};

function MonthPicker({ id, value, months, onChange }: { id: string; value: string; months: string[]; onChange: (v: string) => void }) {
  const years = [...new Set(months.map((m) => m.slice(0, 4)))];
  const y = value.slice(0, 4);
  const inYear = months.filter((m) => m.startsWith(y));
  return (
    <div className="pair">
      <select
        id={id}
        value={y}
        onChange={(e) => {
          const options = months.filter((m) => m.startsWith(e.target.value));
          onChange(options.find((m) => m.slice(5) === value.slice(5)) ?? options[0]);
        }}
      >
        {years.map((yr) => (
          <option key={yr}>{yr}</option>
        ))}
      </select>
      <select aria-label="Month" value={value} onChange={(e) => onChange(e.target.value)}>
        {inYear.map((m) => (
          <option key={m} value={m}>
            {MONTHS[Number(m.slice(5)) - 1]}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusCard() {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const current = numberOneAt(thisMonth, NUMBER_ONE);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [done, setDone] = useStored<Record<string, boolean[]>>('snp1-checklist', {});
  const ticks = done[thisMonth] ?? [false, false, false];
  const steps = [
    'Open Slickcharts and look at the top of the S&P 500 list.',
    'If #1 has changed, sell the old holding and buy the new #1 with the proceeds.',
    'Invest this month’s new money in the current #1.',
  ];
  return (
    <div className="panel">
      <p className="ctl-label">Largest US company in this site’s table</p>
      <p className="stat">{current ? current.ticker : 'n/a'}</p>
      {current ? (
        <p className="note">
          Recorded as #1 since {monthName(current.start)}. The table was last researched on {RANKINGS_RESEARCHED_ON}, so
          check the live ranking before acting. {current.confidence === 'unsure' && <span className="tag-unsure">unsure</span>}
        </p>
      ) : (
        <p className="note">No ranking is recorded for this month.</p>
      )}
      <p>
        <strong>Next check:</strong>{' '}
        {next.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      <div>
        <p className="ctl-label">Checklist for {monthName(thisMonth)}</p>
        {steps.map((s, i) => (
          <label className="check" key={i} style={{ display: 'flex' }}>
            <input
              type="checkbox"
              checked={ticks[i]}
              onChange={(e) => {
                const copy = [...ticks];
                copy[i] = e.target.checked;
                setDone({ [thisMonth]: copy });
              }}
            />
            <span>
              {i === 0 ? (
                <>
                  Open <a href="https://www.slickcharts.com/sp500">Slickcharts</a> and look at the top of the S&amp;P 500 list.
                </>
              ) : (
                s
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function Explorer() {
  const monthlyData = useJson<Monthly>('/data/monthly.json');
  const dailyData = useJson<Daily>('/data/daily.json');
  const metaData = useJson<Meta>('/data/meta.json');
  const [o, setO] = useStored('snp1', DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) => setO((prev) => ({ ...prev, [k]: v }));

  const monthly = monthlyData.data;
  const daily = dailyData.data;

  // Months the user may pick: from January 2000 to the last complete month.
  const months = useMemo(() => (monthly ? monthly.dates.filter((d) => d >= '2000-01') : []), [monthly]);
  const last = months[months.length - 1] ?? '';
  const start = months.includes(o.start) ? o.start : months[0];
  const end = months.includes(o.end) ? o.end : last;

  const run = useMemo(() => {
    if (!monthly) return null;
    const make = (variant: VariantId, over: Partial<Options> = {}): BacktestResult =>
      runBacktest(monthly, rankings, { variant, cadence: o.cadence, start, end, monthly: o.monthly, worstCase: o.worstCase, ...over }, daily ?? undefined);
    const results = Object.fromEntries(VARIANTS.map((v) => [v.id, make(v.id)])) as Record<VariantId, BacktestResult>;

    const regimes = [
      { name: '2000 to 2011', start: '2000-01', end: '2011-12' },
      { name: '2012 to now', start: '2012-01', end: last },
      { name: '2022 to now', start: '2022-01', end: last },
    ].map((r) => ({
      ...r,
      results: Object.fromEntries(VARIANTS.map((v) => [v.id, make(v.id, { start: r.start, end: r.end, worstCase: false })])) as Record<VariantId, BacktestResult>,
    }));

    // The same checks every time, over the full history, so they do not move with the controls.
    const full = (variant: VariantId, cadence: Cadence, worstCase = false) =>
      runBacktest(monthly, rankings, { variant, cadence, start: months[0], end: last, monthly: 1000, worstCase }, daily ?? undefined);
    return { results, regimes, full };
  }, [monthly, daily, o.cadence, o.monthly, o.worstCase, start, end, last, months]);

  if (monthlyData.error) return <p className="warn">{monthlyData.error}</p>;
  if (!monthly || !run) return <p>Loading price data…</p>;

  const shown = VARIANTS.filter((v) => o.variants.includes(v.id));
  const okShown = shown.filter((v) => run.results[v.id].ok);

  // One row per month for the chart.
  const chartRows = (() => {
    const rows: Record<string, number | string>[] = [];
    const first = okShown[0] && run.results[okShown[0].id];
    if (!first || !first.ok) return rows;
    first.points.forEach((p, i) => {
      const row: Record<string, number | string> = { date: p.date };
      for (const v of okShown) {
        const r = run.results[v.id];
        if (r.ok && r.points[i]) row[v.id] = Math.round(r.points[i].value);
      }
      rows.push(row);
    });
    return rows;
  })();

  const snp1 = run.results.snp1;
  const tickerColor = (() => {
    const map: Record<string, string> = {};
    let k = 0;
    for (const s of NUMBER_ONE) if (!(s.ticker in map)) map[s.ticker] = TICKER_COLORS[k++ % TICKER_COLORS.length];
    return map;
  })();

  const warnings = [...new Set(shown.flatMap((v) => (run.results[v.id].ok ? (run.results[v.id] as any).warnings : [])))] as string[];
  const missing = metaData.data ? Object.entries(metaData.data.missing) : [];
  const unsureSpans = NUMBER_ONE.filter((s) => s.confidence === 'unsure');
  const unsureRows = TOP7_QUARTERLY.filter((r) => r.confidence === 'unsure');

  const dipTickers = daily ? Object.keys(daily.series).filter((t) => t !== 'TQQQ' && t !== 'QQQ') : [];
  const dip = daily ? dipBuying(daily, o.dipTicker, start, end, o.monthly) : null;

  // Earlier findings, recomputed from the data each time the page loads.
  const checks = (() => {
    const rows: { claim: string; result: string }[] = [];
    const m = run.full('snp1', 'monthly');
    const q = run.full('snp1', 'quarterly');
    const y = run.full('snp1', 'yearly');
    const spy = run.full('spy', 'monthly');
    const w = run.full('snp1', 'monthly', true);
    const fullDip = daily ? dipBuying(daily, 'SPY', months[0], last, 1000) : null;
    rows.push({
      claim: 'Dip-buying adds only about 0.3 to 0.5 points a year',
      result:
        fullDip && fullDip.ok && fullDip.dip.irr !== null && fullDip.dca.irr !== null
          ? `Dip-buying SPY returned ${pct(fullDip.dip.irr, 2)} a year against ${pct(fullDip.dca.irr, 2)} for plain monthly buying: a difference of ${((fullDip.dip.irr - fullDip.dca.irr) * 100).toFixed(2)} points.`
          : 'n/a: daily prices are not loaded.',
    });
    rows.push({
      claim: 'Yearly rebalancing underperformed SPY',
      result: y.ok && spy.ok ? `Yearly SNP1 grew ${pct(y.metrics.cagr)} a year against ${pct(spy.metrics.cagr)} for SPY.` : 'n/a',
    });
    rows.push({
      claim: 'Monthly and quarterly checks give similar results, with about 10 rotations',
      result:
        m.ok && q.ok
          ? `Monthly: ${pct(m.metrics.cagr)} a year with ${m.metrics.rotations} rotations. Quarterly: ${pct(q.metrics.cagr)} a year with ${q.metrics.rotations} rotations.`
          : 'n/a',
    });
    rows.push({
      claim: 'Worst-case execution costs only about 1.5%',
      result:
        m.ok && w.ok
          ? `Final value was ${pct(w.metrics.finalValue / m.metrics.finalValue - 1, 2)} different with every rotation executed on its worst day (${w.rotations.filter((r) => r.worstDay).length} of ${w.rotations.length} rotations had daily prices).`
          : 'n/a',
    });
    const recent = run.regimes[2];
    const a = recent.results.snp1;
    const b = recent.results.spy;
    rows.push({
      claim: 'From 2022, SNP1 has been close to SPY',
      result: a.ok && b.ok ? `SNP1 grew ${pct(a.metrics.cagr)} a year against ${pct(b.metrics.cagr)} for SPY.` : 'n/a',
    });
    return rows;
  })();

  return (
    <div className="tool">
      <section>
        <h2>This month</h2>
        <StatusCard />
      </section>

      <section>
        <h2>Backtest</h2>
        <div className="panel">
          <div className="controls">
            <div>
              <label htmlFor="bt-start">First purchase</label>
              <MonthPicker id="bt-start" value={start} months={months.slice(0, -1)} onChange={(v) => set('start', v)} />
            </div>
            <div>
              <label htmlFor="bt-end">End</label>
              <MonthPicker id="bt-end" value={end} months={months.slice(1)} onChange={(v) => set('end', v)} />
            </div>
            <div>
              <label htmlFor="bt-monthly">Invested each month (USD)</label>
              <MoneyInput id="bt-monthly" value={o.monthly} onChange={(v) => set('monthly', v)} />
              <Presets label="Invested each month" options={[100, 500, 1000, 2000, 5000]} current={o.monthly} onPick={(v) => set('monthly', v)} />
            </div>
            <div>
              <span className="ctl-label" id="cad">Ranking check</span>
              <div className="seg" role="group" aria-labelledby="cad">
                {(['monthly', 'quarterly', 'yearly'] as Cadence[]).map((c) => (
                  <button key={c} type="button" aria-pressed={o.cadence === c} onClick={() => set('cadence', c)}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <span className="ctl-label">Strategies to compare</span>
            <div className="checks">
              {VARIANTS.map((v) => (
                <label key={v.id} title={v.rule}>
                  <input
                    type="checkbox"
                    checked={o.variants.includes(v.id)}
                    onChange={(e) => set('variants', e.target.checked ? [...o.variants, v.id] : o.variants.filter((x) => x !== v.id))}
                  />
                  {v.name}
                </label>
              ))}
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={o.worstCase} onChange={(e) => set('worstCase', e.target.checked)} />
            Worst-case execution on rotations
          </label>
          <ul className="points">
            <li>
              <strong>What worst-case does.</strong> For each rotation, it finds the day that month with the widest high-to-low
              range. It sells the outgoing holding at that day’s low and buys the incoming one at that day’s high.
            </li>
            <li>
              <strong>Where it applies.</strong> One-for-one rotations only. Monthly purchases still use the month-end close.
            </li>
          </ul>
        </div>

        {end <= start && <p className="warn">The end date is not after the first purchase. Choose a later end date.</p>}

        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Growth a year</th>
                <th>Your return a year</th>
                <th>Volatility</th>
                <th>Sharpe</th>
                <th>Worst fall</th>
                <th>Final value</th>
                <th>Put in</th>
                <th>Rotations</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={9}>Tick at least one strategy above.</td>
                </tr>
              )}
              {shown.map((v) => {
                const r = run.results[v.id];
                if (!r.ok)
                  return (
                    <tr key={v.id}>
                      <td>{v.name}</td>
                      <td colSpan={8} className="wrap-cell">
                        n/a: {r.reason}
                      </td>
                    </tr>
                  );
                const m = r.metrics;
                return (
                  <tr key={v.id}>
                    <td>
                      <span className="swatch" style={{ background: COLOR[v.id] }} />
                      {v.name}
                    </td>
                    <td>{pct(m.cagr)}</td>
                    <td>{pct(m.irr)}</td>
                    <td>{pct(m.volatility)}</td>
                    <td>{m.sharpe === null ? 'n/a' : m.sharpe.toFixed(2)}</td>
                    <td>{pct(m.maxDrawdown)}</td>
                    <td>{usd(m.finalValue)}</td>
                    <td>{usd(m.contributed)}</td>
                    <td>{m.rotations}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className="points">
          <li>
            <strong>Growth a year.</strong> The time-weighted rate (CAGR). It ignores when money went in.
          </li>
          <li>
            <strong>Your return a year.</strong> The money-weighted rate (IRR) on the monthly deposits.
          </li>
          <li>
            <strong>Volatility and Sharpe.</strong> Volatility is the yearly spread of monthly returns. Sharpe uses a risk-free
            rate of 0.
          </li>
          <li>
            <strong>Worst fall.</strong> The largest drop from a peak, measured at month ends.
          </li>
          <li>
            <strong>Prices.</strong> They include reinvested dividends. They exclude trading costs, tax and currency conversion.
          </li>
        </ul>

        {warnings.length > 0 && (
          <div className="warn">
            <strong>Data gaps in this run</strong>
            <ul>
              {warnings.slice(0, 12).map((w) => (
                <li key={w}>{w}</li>
              ))}
              {warnings.length > 12 && <li>and {warnings.length - 12} more.</li>}
            </ul>
          </div>
        )}

        {chartRows.length > 0 && (
          <div>
            <h3>Portfolio value</h3>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(0, 4)} minTickGap={40} stroke="var(--ink-soft)" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} />
                  <YAxis
                    width={56}
                    stroke="var(--ink-soft)"
                    tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
                    tickFormatter={(v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`)}
                  />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--rule)', borderRadius: 8, color: 'var(--ink)' }}
                    labelFormatter={(d) => monthName(String(d))}
                    formatter={(value, name) => [usd(Number(value)), VARIANTS.find((v) => v.id === name)?.name ?? String(name)]}
                  />
                  {okShown.map((v) => (
                    <Line key={v.id} dataKey={v.id} stroke={COLOR[v.id]} strokeWidth={v.id === 'spy' ? 2 : 2.5} strokeDasharray={v.id === 'spy' ? '6 4' : undefined} dot={false} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="note">Hover or tap the chart to see any month. Values are in USD and include the money paid in each month; SPY is the dashed line.</p>
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '0.4rem 0' }}>Show the value at the end of every year</summary>
              <div className="table-scroll" style={{ maxHeight: '24rem', overflowY: 'auto', marginTop: '0.5rem' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>End of</th>
                      {okShown.map((v) => (
                        <th key={v.id}>{v.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chartRows
                      .filter((r, i) => String(r.date).endsWith('-12') || i === chartRows.length - 1)
                      .map((r) => (
                        <tr key={String(r.date)}>
                          <td>{monthName(String(r.date))}</td>
                          {okShown.map((v) => (
                            <td key={v.id}>{usd(Number(r[v.id]))}</td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        )}
      </section>

      <section>
        <h2>Who was held, and when</h2>
        {snp1.ok ? (
          <>
            <div className="timeline" role="img" aria-label={`SNP1 holdings: ${snp1.timeline.map((s) => `${s.label} from ${monthName(s.start)}`).join(', ')}`}>
              {snp1.timeline.map((s, i) => {
                const span = months.indexOf(s.end) - months.indexOf(s.start) + 1;
                return (
                  <span key={i} style={{ flex: Math.max(1, span), background: tickerColor[s.label] ?? 'var(--ink-soft)', color: 'var(--paper)' }} title={`${s.label}: ${monthName(s.start)} to ${monthName(s.end)}`}>
                    {span > 14 ? s.label : ''}
                  </span>
                );
              })}
            </div>
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Held</th>
                    <th>From check</th>
                    <th>To check</th>
                    <th>Months</th>
                  </tr>
                </thead>
                <tbody>
                  {snp1.timeline.map((s, i) => (
                    <tr key={i}>
                      <td>
                        <span className="swatch" style={{ background: tickerColor[s.label] ?? 'var(--ink-soft)' }} />
                        {s.label}
                      </td>
                      <td>{monthName(s.start)}</td>
                      <td>{monthName(s.end)}</td>
                      <td>{months.indexOf(s.end) - months.indexOf(s.start) + 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">SNP1 holdings for the dates and check frequency chosen above.</p>
          </>
        ) : (
          <p className="warn">n/a: {snp1.reason}</p>
        )}
      </section>

      <section>
        <h2>By period</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Strategy</th>
                {run.regimes.map((r) => (
                  <th key={r.name} colSpan={2}>
                    {r.name}
                  </th>
                ))}
              </tr>
              <tr>
                <th></th>
                {run.regimes.map((r) => [<th key={r.name + 'g'}>Growth a year</th>, <th key={r.name + 'd'}>Worst fall</th>])}
              </tr>
            </thead>
            <tbody>
              {VARIANTS.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  {run.regimes.map((r) => {
                    const x = r.results[v.id];
                    return x.ok
                      ? [<td key={r.name + 'g'}>{pct(x.metrics.cagr)}</td>, <td key={r.name + 'd'}>{pct(x.metrics.maxDrawdown)}</td>]
                      : [
                          <td key={r.name + 'g'} colSpan={2}>
                            n/a at this check frequency
                          </td>,
                        ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          Each period is run separately with the check frequency chosen above and the same monthly amount. The start and
          end dates above do not change these results.
        </p>
      </section>

      <section>
        <h2>Buying dips against buying every month</h2>
        <div className="panel">
          <div className="controls">
            <div>
              <label htmlFor="dip-t">Asset</label>
              <select id="dip-t" value={o.dipTicker} onChange={(e) => set('dipTicker', e.target.value)}>
                {dipTickers.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <ul className="points">
            <li>
              <strong>Same money.</strong> Both savers receive the same amount on the first trading day of each month.
            </li>
            <li>
              <strong>Buy every month.</strong> This saver invests it that day.
            </li>
            <li>
              <strong>Buy dips only.</strong> This saver holds it as cash. They invest everything on any day the close is 3% to
              5% below the highest close of the past year.
            </li>
            <li>
              <strong>Same settings.</strong> The dates and monthly amount come from the backtest above.
            </li>
          </ul>
        </div>
        {dailyData.error && <p className="warn">{dailyData.error}</p>}
        {!daily && !dailyData.error && <p>Loading daily prices…</p>}
        {dip && !dip.ok && <p className="warn">n/a: {dip.reason}</p>}
        {dip && dip.ok && (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Approach</th>
                  <th>Your return a year</th>
                  <th>Final value</th>
                  <th>Put in</th>
                  <th>Purchases</th>
                  <th>Cash left uninvested</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Buy every month</td>
                  <td>{pct(dip.dca.irr, 2)}</td>
                  <td>{usd(dip.dca.finalValue)}</td>
                  <td>{usd(dip.dca.contributed)}</td>
                  <td>{Math.round(dip.dca.contributed / o.monthly)}</td>
                  <td>{usd(0)}</td>
                </tr>
                <tr>
                  <td>Buy dips only</td>
                  <td>{pct(dip.dip.irr, 2)}</td>
                  <td>{usd(dip.dip.finalValue)}</td>
                  <td>{usd(dip.dip.contributed)}</td>
                  <td>{dip.dip.buys}</td>
                  <td>{usd(dip.dip.cashLeft)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>Earlier findings, rechecked</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th className="wrap-cell">Earlier finding</th>
                <th className="wrap-cell">What the data on this site gives</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.claim}>
                  <td className="wrap-cell">{c.claim}</td>
                  <td className="wrap-cell">{c.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          Worked out over {monthName(months[0])} to {monthName(last)} with USD 1,000 a month. The controls above do not
          change these results.
        </p>
      </section>

      <section>
        <h2>What the table is built on</h2>
        <ul className="points">
          <li>
            <strong>Hand-researched table.</strong> The #1 history is not a data feed.
          </li>
          <li>
            <strong>Marked unsure.</strong> {unsureSpans.length} of {NUMBER_ONE.length} changes of #1 and {unsureRows.length} of{' '}
            {TOP7_QUARTERLY.length} quarterly top-7 rows could not be confirmed from two sources.
          </li>
        </ul>
        <div className="table-scroll" style={{ maxHeight: '24rem', overflowY: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>#1 from</th>
                <th>Company</th>
                <th>Status</th>
                <th className="wrap-cell">Note</th>
              </tr>
            </thead>
            <tbody>
              {NUMBER_ONE.map((s) => (
                <tr key={s.start}>
                  <td>{monthName(s.start)}</td>
                  <td>{s.ticker}</td>
                  <td>{s.confidence === 'unsure' ? <span className="tag-unsure">unsure</span> : 'Confirmed'}</td>
                  <td className="wrap-cell">{s.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {missing.length > 0 && (
          <div className="warn">
            <strong>Prices not available</strong>
            <ul>
              {missing.map(([t, why]) => (
                <li key={t}>
                  {t}: {why}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="note">
          Sources:{' '}
          {SOURCES.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ', '}
              <a href={s.url}>{s.label}</a>
            </span>
          ))}
          . Prices: Yahoo Finance, adjusted for splits and dividends
          {metaData.data ? `, built ${metaData.data.builtAt.slice(0, 10)} and complete to ${monthName(metaData.data.lastMonth)}` : ''}.
        </p>
      </section>
    </div>
  );
}
