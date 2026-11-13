import { useMemo } from 'react';
import { SP500_TOP, SP500_TOP_AS_OF, WORLD_FUNDS } from '../../data/sp500-top';
import { VERDICT_THRESHOLD, effectiveHoldings, hhi, verdict, type ParseError } from '../../lib/concentration';
import { pct, readStored } from '../../lib/storage';
import { DCA_MONTHS, DEFAULTS, STORAGE_KEY, compute, type State } from './state';

// Report summary for the concentration checker: tables only, from the saved inputs.

export const storageKey = STORAGE_KEY;

const amount = (n: number) => n.toLocaleString('en-SG', { maximumFractionDigits: 0 });
const eff = (n: number | null) => (n === null ? 'n/a' : n.toFixed(1));
const index = (n: number | null) => (n === null ? 'n/a' : n.toFixed(4));
const dateLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const NO_PLAN = 'n/a: no monthly plan entered';

const unread = (what: string, errors: ParseError[]) =>
  errors.length === 0 ? null : (
    <p className="warn">
      {errors.length} {errors.length === 1 ? 'line' : 'lines'} in {what} could not be read and {errors.length === 1 ? 'is' : 'are'} left out:{' '}
      {errors.map((e) => `line ${e.line}, “${e.text}” (${e.reason})`).join('; ')}
    </p>
  );

export default function Summary() {
  const { o, c } = useMemo(() => {
    const o = readStored<State>(storageKey, DEFAULTS);
    return { o, c: compute(o) };
  }, []);
  const { held, dca, cfg, now, later, ltNow, ltLater, redundant } = c;

  const hasDca = dca.rows.length > 0;
  const empty = held.rows.length === 0;
  const v = verdict(ltNow.hhi, ltLater.hhi);
  const tickers = [...new Set([...held.rows, ...dca.rows].map((h) => h.ticker))];
  const spUsed = tickers.filter((t) => cfg.spFunds.includes(t));
  const worldUsed = tickers.filter((t) => t in cfg.worldFunds);
  const list = (rows: { ticker: string; value: number }[]) => rows.map((h) => `${h.ticker} ${amount(h.value)}`).join(', ');
  const hhiRows = [
    { label: 'as listed (each fund counted as one holding)', a: hhi(now.positions.map((p) => p.value)), b: hhi(later.positions.map((p) => p.value)) },
    { label: 'look-through (funds split into companies)', a: ltNow.hhi, b: ltLater.hhi },
  ];

  const result: { label: string; value: string }[] = empty
    ? [{ label: 'Effect of the monthly plan', value: 'n/a: no holdings could be read' }]
    : [
        { label: 'Effect of the monthly plan', value: !hasDca ? NO_PLAN : v === null ? 'n/a' : `The plan ${v} concentration` },
        { label: 'Largest position now', value: `${now.positions[0].ticker} ${pct(now.top1)}` },
        { label: 'Largest 3 positions together now', value: pct(now.top3) },
        { label: 'Largest look-through exposure now', value: ltNow.rows[0] ? `${ltNow.rows[0].key} ${pct(ltNow.rows[0].share)}` : 'n/a: no holdings' },
        { label: 'Effective number of holdings now (look-through)', value: eff(effectiveHoldings(ltNow.hhi)) },
        { label: `Effective number of holdings after ${DCA_MONTHS} months`, value: hasDca ? eff(effectiveHoldings(ltLater.hhi)) : NO_PLAN },
        { label: 'Total value now', value: amount(now.total) },
        { label: `Total value after ${DCA_MONTHS} months`, value: hasDca ? amount(later.total) : NO_PLAN },
      ];

  return (
    <>
      <div className="report-pair">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>What you entered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="wrap-cell">Holdings now</td>
                <td className="wrap-cell">{held.rows.length > 0 ? list(held.rows) : 'n/a: no holdings could be read'}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Bought each month</td>
                <td className="wrap-cell">{hasDca ? list(dca.rows) : NO_PLAN}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Treated as S&amp;P 500 index funds</td>
                <td className="wrap-cell">{spUsed.length > 0 ? spUsed.join(', ') : 'None'}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Treated as world index funds</td>
                <td className="wrap-cell">{worldUsed.length > 0 ? worldUsed.join(', ') : 'None'}</td>
              </tr>
              {worldUsed.map((t) => {
                const known = WORLD_FUNDS.find((f) => f.ticker === t);
                // The tag stays unless the figure is a confirmed default or the visitor's own number.
                const tag = known ? !known.verified && cfg.worldFunds[t] === known.usSharePct : !(t in o.usShare);
                return (
                  <tr key={t}>
                    <td className="wrap-cell">
                      US share of {t} {tag && <span className="tag-unsure">unverified</span>}
                    </td>
                    <td className="wrap-cell">{cfg.worldFunds[t]}%</td>
                  </tr>
                );
              })}
              <tr>
                <td className="wrap-cell">S&amp;P 500 weights used</td>
                <td className="wrap-cell">
                  {SP500_TOP.length} largest companies, as of {dateLabel(SP500_TOP_AS_OF)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Result</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {result.map((f, i) => (
                <tr key={f.label}>
                  <td className="wrap-cell">{i === 0 ? <strong>{f.label}</strong> : f.label}</td>
                  <td className="wrap-cell">{i === 0 ? <strong>{f.value}</strong> : f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {unread('your holdings', held.errors)}
      {unread('your monthly plan', dca.errors)}
      <div className="warn">
        <ul>
          <li>
            <strong>Weights change.</strong> Index weights change every trading day.
          </li>
          <li>
            <strong>Prices assumed unchanged.</strong> Prices are assumed not to change for the {DCA_MONTHS} months, so
            only purchases change the shares.
          </li>
          <li>
            <strong>World funds.</strong> A world fund’s US part is assumed to be weighted like the S&amp;P 500.
          </li>
        </ul>
      </div>

      {!empty && (
        <>
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

          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Company (look-through)</th>
                  <th>Held directly</th>
                  <th>Through funds</th>
                  <th>Total</th>
                  <th>Share of portfolio</th>
                </tr>
              </thead>
              <tbody>
                {ltNow.rows.map((r) => (
                  <tr key={r.key}>
                    <td className="wrap-cell">{r.key === r.label ? r.key : `${r.key} · ${r.label}`}</td>
                    <td>{amount(r.direct)}</td>
                    <td>{amount(r.viaFunds)}</td>
                    <td>{amount(r.total)}</td>
                    <td>{pct(r.share)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="wrap-cell">Other US companies in your funds (outside the {SP500_TOP.length} listed)</td>
                  <td>{amount(0)}</td>
                  <td>{amount(ltNow.otherUs)}</td>
                  <td>{amount(ltNow.otherUs)}</td>
                  <td>{pct(ltNow.total > 0 ? ltNow.otherUs / ltNow.total : null)}</td>
                </tr>
                <tr>
                  <td className="wrap-cell">Companies outside the US in your world funds</td>
                  <td>{amount(0)}</td>
                  <td>{amount(ltNow.nonUs)}</td>
                  <td>{amount(ltNow.nonUs)}</td>
                  <td>{pct(ltNow.total > 0 ? ltNow.nonUs / ltNow.total : null)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Concentration measure</th>
                  <th>Now</th>
                  <th>After {DCA_MONTHS} months</th>
                </tr>
              </thead>
              <tbody>
                {hhiRows.flatMap((row) => [
                  <tr key={row.label + 'h'}>
                    <td className="wrap-cell">Herfindahl index, {row.label}</td>
                    <td>{index(row.a)}</td>
                    <td>{hasDca ? index(row.b) : 'n/a'}</td>
                  </tr>,
                  <tr key={row.label + 'e'}>
                    <td className="wrap-cell">Effective number of holdings, {row.label}</td>
                    <td>{eff(effectiveHoldings(row.a))}</td>
                    <td>{hasDca ? eff(effectiveHoldings(row.b)) : 'n/a'}</td>
                  </tr>,
                ])}
                <tr>
                  <td className="wrap-cell">
                    Verdict, from the look-through index (a move under {pct(VERDICT_THRESHOLD, 0)} counts as no change)
                  </td>
                  <td colSpan={2}>{!hasDca ? NO_PLAN : v === null ? 'n/a' : `The plan ${v} concentration`}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Single stock bought monthly</th>
                  <th>Amount</th>
                  <th className="wrap-cell">Already bought through a fund</th>
                </tr>
              </thead>
              <tbody>
                {redundant.length === 0 && (
                  <tr>
                    <td colSpan={3} className="wrap-cell">
                      None found among the {SP500_TOP.length} largest S&amp;P 500 companies.
                    </td>
                  </tr>
                )}
                {redundant.map((x) => (
                  <tr key={x.ticker}>
                    <td>{x.ticker}</td>
                    <td>{amount(x.monthly)}</td>
                    <td className="wrap-cell">
                      Redundant: {x.name} is already {x.funds.map((f) => `${pct(f.weightInFund, 2)} of ${f.fund}`).join(' and ')}. You hold{' '}
                      {amount(x.viaFundsNow)} of it through funds today ({pct(ltNow.total > 0 ? x.viaFundsNow / ltNow.total : null, 2)} of your portfolio),
                      before any direct purchase.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
