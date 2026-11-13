import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Presets } from '../Presets';
import { DEFAULT_US_SHARE_PCT, SP500_FUNDS, SP500_TOP, SP500_TOP_AS_OF, SP500_TOP_SOURCES, WORLD_FUNDS } from '../../data/sp500-top';
import {
  VERDICT_THRESHOLD,
  effectiveHoldings,
  findConstituent,
  hhi,
  verdict,
  type ParseError,
} from '../../lib/concentration';
import { num, pct, useStored } from '../../lib/storage';
import { DCA_MONTHS, DEFAULTS, STORAGE_KEY, compute, type State } from './state';

const CHART_ROWS = 10;

const amount = (n: number) => n.toLocaleString('en-SG', { maximumFractionDigits: 0 });
const eff = (n: number | null) => (n === null ? 'n/a' : n.toFixed(1));
const index = (n: number | null) => (n === null ? 'n/a' : n.toFixed(4));
const dateLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function Errors({ what, errors }: { what: string; errors: ParseError[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="warn" role="alert">
      <strong>
        {errors.length} {errors.length === 1 ? 'line' : 'lines'} in {what} could not be read and {errors.length === 1 ? 'is' : 'are'} left out
      </strong>
      <ul>
        {errors.map((e) => (
          <li key={e.line}>
            Line {e.line}, “{e.text}”: {e.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Concentration() {
  const [o, setO] = useStored<State>(STORAGE_KEY, DEFAULTS);
  const set = <K extends keyof State>(k: K, v: State[K]) => setO((prev) => ({ ...prev, [k]: v }));

  const calc = useMemo(() => compute(o), [o.holdingsText, o.dcaText, o.spFunds, o.worldFunds, o.usShare]);

  const { held, dca, now, later, ltNow, ltLater, redundant } = calc;
  // Tickers the user has typed that could be funds: everything that is not a listed company.
  const candidates = [...new Set([...held.rows, ...dca.rows].map((h) => h.ticker))].filter((t) => !findConstituent(t, SP500_TOP));
  const tickedWorld = candidates.filter((t) => o.worldFunds.includes(t));
  const listedWeight = SP500_TOP.reduce((a, c) => a + c.weight, 0);
  const toggle = (list: 'spFunds' | 'worldFunds', other: 'spFunds' | 'worldFunds', t: string, on: boolean) =>
    setO((prev) => ({
      ...prev,
      [list]: on ? [...prev[list].filter((x) => x !== t), t] : prev[list].filter((x) => x !== t),
      [other]: on ? prev[other].filter((x) => x !== t) : prev[other],
    }));

  const v = verdict(ltNow.hhi, ltLater.hhi);
  const hasDca = dca.rows.length > 0;
  const empty = held.rows.length === 0;
  const chartRows = ltNow.rows.slice(0, CHART_ROWS).map((r) => ({
    key: r.key,
    direct: ltNow.total > 0 ? (r.direct / ltNow.total) * 100 : 0,
    viaFunds: ltNow.total > 0 ? (r.viaFunds / ltNow.total) * 100 : 0,
  }));
  const SERIES: Record<string, string> = { direct: 'Held directly', viaFunds: 'Through funds' };
  const hhiRows = [
    { label: 'As listed (each fund counted as one holding)', a: hhi(now.positions.map((p) => p.value)), b: hhi(later.positions.map((p) => p.value)) },
    { label: 'Look-through (funds split into companies)', a: ltNow.hhi, b: ltLater.hhi },
  ];

  return (
    <div className="tool">
      <section>
        <h2>Your holdings and monthly plan</h2>
        <div className="panel">
          <div className="controls" style={{ alignItems: 'start' }}>
            <div>
              <label htmlFor="con-holdings">What you hold now: one line each, ticker then value</label>
              <textarea id="con-holdings" rows={8} spellCheck={false} value={o.holdingsText} onChange={(e) => set('holdingsText', e.target.value)} />
            </div>
            <div>
              <label htmlFor="con-dca">What you plan to buy each month: ticker then amount</label>
              <textarea id="con-dca" rows={8} spellCheck={false} value={o.dcaText} onChange={(e) => set('dcaText', e.target.value)} />
            </div>
          </div>
          <ul className="points">
            <li>
              <strong>One currency.</strong> Use the same currency for every value.
            </li>
            <li>
              <strong>Format.</strong> Commas, tabs, currency symbols and thousands separators are accepted, for example{' '}
              <code>AAPL, S$5,000</code>.
            </li>
            <li>
              <strong>Repeated tickers.</strong> A ticker that appears twice is added together.
            </li>
            <li>
              <strong>Example data.</strong> The starting example is made up.
            </li>
          </ul>
          <button type="button" className="btn" onClick={() => setO(DEFAULTS)}>
            Reset to the example
          </button>
        </div>
        <Errors what="your holdings" errors={held.errors} />
        <Errors what="your monthly plan" errors={dca.errors} />

        <div className="panel">
          <h3>Which of these are index funds?</h3>
          {candidates.length === 0 ? (
            <p className="note">No tickers to mark yet. Companies in the S&amp;P 500 list below are never treated as funds.</p>
          ) : (
            <>
              <div>
                <span className="ctl-label" id="con-sp">
                  S&amp;P 500 index funds
                </span>
                <div className="checks" role="group" aria-labelledby="con-sp">
                  {candidates.map((t) => (
                    <label key={t} htmlFor={`con-sp-${t}`}>
                      <input id={`con-sp-${t}`} type="checkbox" checked={o.spFunds.includes(t)} onChange={(e) => toggle('spFunds', 'worldFunds', t, e.target.checked)} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="ctl-label" id="con-world">
                  World index funds
                </span>
                <div className="checks" role="group" aria-labelledby="con-world">
                  {candidates.map((t) => (
                    <label key={t} htmlFor={`con-w-${t}`}>
                      <input id={`con-w-${t}`} type="checkbox" checked={o.worldFunds.includes(t)} onChange={(e) => toggle('worldFunds', 'spFunds', t, e.target.checked)} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              {tickedWorld.length > 0 && (
                <div className="controls">
                  {tickedWorld.map((t) => {
                    const known = WORLD_FUNDS.find((f) => f.ticker === t);
                    const value = o.usShare[t] ?? DEFAULT_US_SHARE_PCT;
                    return (
                      <div key={t}>
                        <label htmlFor={`con-us-${t}`}>
                          US share of {t} (%) {!known?.verified && <span className="tag-unsure">unverified</span>}
                        </label>
                        <input
                          id={`con-us-${t}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step={0.1}
                          value={value}
                          onChange={(e) => set('usShare', { ...o.usShare, [t]: Math.min(100, Math.max(0, num(e.target.value))) })}
                        />
                        <Presets
                          label={`US share of ${t}`}
                          options={[50, 60, ...new Set(WORLD_FUNDS.map((f) => f.usSharePct))].map((x) => ({ label: `${x}%`, value: x }))}
                          current={value}
                          onPick={(x) => set('usShare', { ...o.usShare, [t]: x })}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          <ul className="points">
            <li>
              <strong>Pre-ticked funds.</strong> S&amp;P 500 funds: {SP500_FUNDS.join(', ')}. World funds:{' '}
              {WORLD_FUNDS.map((f) => f.ticker).join(', ')}.
            </li>
            <li>
              <strong>How a fund is split.</strong> A fund is spread across the companies in the S&amp;P 500 list below,
              by weight.
            </li>
            <li>
              <strong>World funds.</strong> Only the US share is spread this way. This assumes the US part is weighted
              like the S&amp;P 500.
            </li>
          </ul>
        </div>
      </section>

      {empty ? (
        <section>
          <p className="warn">n/a: no holdings could be read. Enter at least one line such as CSPX 30000.</p>
        </section>
      ) : (
        <>
          <section>
            <h2>Your positions</h2>
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Measure</th>
                    <th>Now</th>
                    <th>After {DCA_MONTHS} months of the plan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Largest position</td>
                    <td>
                      {now.positions[0].ticker} {pct(now.top1)}
                    </td>
                    <td>{hasDca ? `${later.positions[0].ticker} ${pct(later.top1)}` : 'n/a: no monthly plan entered'}</td>
                  </tr>
                  <tr>
                    <td>Largest 3 positions together</td>
                    <td>{pct(now.top3)}</td>
                    <td>{hasDca ? pct(later.top3) : 'n/a: no monthly plan entered'}</td>
                  </tr>
                  <tr>
                    <td>Total value</td>
                    <td>{amount(now.total)}</td>
                    <td>{hasDca ? amount(later.total) : 'n/a: no monthly plan entered'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Value now</th>
                    <th>Share now</th>
                    <th>Bought each month</th>
                    <th>Share after {DCA_MONTHS} months</th>
                  </tr>
                </thead>
                <tbody>
                  {later.positions
                    .map((p) => ({ after: p, before: now.positions.find((x) => x.ticker === p.ticker) }))
                    .sort((a, b) => (b.before?.value ?? 0) - (a.before?.value ?? 0))
                    .map(({ after, before }) => (
                      <tr key={after.ticker}>
                        <td>{after.ticker}</td>
                        <td>{amount(before?.value ?? 0)}</td>
                        <td>{pct(before?.share ?? 0)}</td>
                        <td>{amount(dca.rows.find((d) => d.ticker === after.ticker)?.value ?? 0)}</td>
                        <td>{pct(after.share)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="note">Each fund counts as one position here. Prices are assumed not to change for the {DCA_MONTHS} months, so only your purchases change the shares.</p>
          </section>

          <section>
            <h2>Look-through exposure</h2>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" horizontal={false} />
                  <XAxis type="number" stroke="var(--ink-soft)" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} tickFormatter={(x: number) => `${x}%`} />
                  <YAxis type="category" dataKey="key" width={60} stroke="var(--ink-soft)" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} interval={0} />
                  <Tooltip
                    cursor={{ fill: 'var(--stock)' }}
                    contentStyle={{ background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: 3, color: 'var(--ink)' }}
                    formatter={(value, name) => [`${Number(value).toFixed(1)}%`, SERIES[String(name)] ?? String(name)]}
                  />
                  <Bar dataKey="direct" stackId="x" fill="var(--c1)" isAnimationActive={false} />
                  <Bar dataKey="viaFunds" stackId="x" fill="var(--c4)" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="note">
              <span className="swatch" style={{ background: 'var(--c1)' }} />
              Held directly <span className="swatch" style={{ background: 'var(--c4)', marginLeft: '0.8em' }} />
              Through funds. Share of your portfolio today, largest {Math.min(CHART_ROWS, chartRows.length)} companies.
            </p>
            <div className="table-scroll" style={{ maxHeight: '32rem', overflowY: 'auto' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Held directly</th>
                    <th>Through funds</th>
                    <th>Total</th>
                    <th>Share of portfolio</th>
                  </tr>
                </thead>
                <tbody>
                  {ltNow.rows.map((r) => (
                    <tr key={r.key}>
                      <td>{r.key === r.label ? r.key : `${r.key} · ${r.label}`}</td>
                      <td>{amount(r.direct)}</td>
                      <td>{amount(r.viaFunds)}</td>
                      <td>{amount(r.total)}</td>
                      <td>{pct(r.share)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Other US companies in your funds (outside the {SP500_TOP.length} listed)</td>
                    <td>{amount(0)}</td>
                    <td>{amount(ltNow.otherUs)}</td>
                    <td>{amount(ltNow.otherUs)}</td>
                    <td>{pct(ltNow.total > 0 ? ltNow.otherUs / ltNow.total : null)}</td>
                  </tr>
                  <tr>
                    <td>Companies outside the US in your world funds</td>
                    <td>{amount(0)}</td>
                    <td>{amount(ltNow.nonUs)}</td>
                    <td>{amount(ltNow.nonUs)}</td>
                    <td>{pct(ltNow.total > 0 ? ltNow.nonUs / ltNow.total : null)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="note">
              A ticker this page does not recognise as a fund or as one of the {SP500_TOP.length} listed companies is
              treated as a single company held directly.
            </p>
          </section>

          <section>
            <h2>Does the monthly plan concentrate you?</h2>
            {!hasDca ? (
              <p className="warn">n/a: no monthly plan could be read, so there is nothing to compare.</p>
            ) : (
              <p className="stat">{v === null ? 'n/a' : `The plan ${v} concentration`}</p>
            )}
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Measure</th>
                    <th>Now</th>
                    <th>After {DCA_MONTHS} months</th>
                  </tr>
                </thead>
                <tbody>
                  {hhiRows.flatMap((row) => [
                    <tr key={row.label + 'h'}>
                      <td>Herfindahl index: {row.label}</td>
                      <td>{index(row.a)}</td>
                      <td>{hasDca ? index(row.b) : 'n/a'}</td>
                    </tr>,
                    <tr key={row.label + 'e'}>
                      <td>Effective number of holdings: {row.label}</td>
                      <td>{eff(effectiveHoldings(row.a))}</td>
                      <td>{hasDca ? eff(effectiveHoldings(row.b)) : 'n/a'}</td>
                    </tr>,
                  ])}
                </tbody>
              </table>
            </div>
            <ul className="points">
              <li>
                <strong>Herfindahl index.</strong> The sum of each holding’s share squared. 1 means everything is in one
                holding, and a lower number means more spread.
              </li>
              <li>
                <strong>Effective number of holdings.</strong> 1 divided by the index.
              </li>
              <li>
                <strong>The verdict.</strong> It uses the look-through figures. It says “barely changes” when the index
                moves by less than {pct(VERDICT_THRESHOLD, 0)} of its starting value.
              </li>
              <li>
                <strong>Slightly overstated.</strong> The look-through effective number is slightly too high. Fund money
                outside the {SP500_TOP.length} listed companies is spread over hundreds of small holdings and is counted
                as adding nothing to the index.
              </li>
            </ul>
          </section>

          <section>
            <h2>Single stocks you already buy through a fund</h2>
            {redundant.length === 0 ? (
              <p className="note">
                None found. This lists single stocks in your monthly plan that are among the {SP500_TOP.length} largest
                S&amp;P 500 companies while you also hold or buy an index fund.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Monthly purchase</th>
                      <th>Amount</th>
                      <th className="wrap-cell">Why it is flagged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redundant.map((x) => (
                      <tr key={x.ticker}>
                        <td>{x.ticker}</td>
                        <td>{amount(x.monthly)}</td>
                        <td className="wrap-cell">
                          Redundant: {x.name} is already {x.funds.map((f) => `${pct(f.weightInFund, 2)} of ${f.fund}`).join(' and ')}. You hold{' '}
                          {amount(x.viaFundsNow)} of it through funds today ({pct(ltNow.total > 0 ? x.viaFundsNow / ltNow.total : null, 2)} of your
                          portfolio), before any direct purchase.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <section>
        <h2>The S&amp;P 500 weights used</h2>
        <ul className="points">
          <li>
            <strong>Date.</strong> Weights are as of {dateLabel(SP500_TOP_AS_OF)} and change every trading day.
          </li>
          <li>
            <strong>Taken from SPY.</strong> They are the largest holdings of the SPDR S&amp;P 500 ETF (SPY), used in
            place of the index. They cover {listedWeight.toFixed(1)}% of it.
          </li>
          <li>
            <strong>Alphabet.</strong> Its two share classes (GOOGL and GOOG) are combined.
          </li>
          <li>
            <strong>Sources.</strong>{' '}
            {SP500_TOP_SOURCES.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ', '}
                <a href={s.url}>{s.label}</a>
              </span>
            ))}
            .
          </li>
        </ul>
        <div className="table-scroll" style={{ maxHeight: '24rem', overflowY: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Company</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {SP500_TOP.map((c) => (
                <tr key={c.ticker}>
                  <td>{c.ticker === 'GOOGL' ? 'GOOGL, GOOG' : c.ticker}</td>
                  <td>{c.name}</td>
                  <td>{c.weight.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>World fund</th>
                <th>US share</th>
                <th>As of</th>
                <th>Status</th>
                <th className="wrap-cell">Source</th>
              </tr>
            </thead>
            <tbody>
              {WORLD_FUNDS.map((f) => (
                <tr key={f.ticker}>
                  <td>{f.ticker}</td>
                  <td>{f.usSharePct.toFixed(2)}%</td>
                  <td>{dateLabel(f.asOf)}</td>
                  <td>{f.verified ? 'Confirmed' : <span className="tag-unsure">unverified</span>}</td>
                  <td className="wrap-cell">
                    <a href={f.url}>{f.source}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
