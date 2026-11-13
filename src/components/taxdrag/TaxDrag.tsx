import { PercentInput } from '../PercentInput';
import { MoneyInput } from '../MoneyInput';
import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CSPX_VS_SPYL, ESTATE_TAX, ETFS, RESEARCHED_ON, etfByTicker, type Etf, type Sourced } from '../../data/etfs';
import { num, pct, sgd, useStored } from '../../lib/storage';
import { Presets } from '../Presets';
import { DEFAULTS, DEFAULT_A, compute, storageKey, toPct, type State } from './state';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const whole = (n: number) => n.toLocaleString('en-SG');

function Unverified({ etf }: { etf: Etf }) {
  if (etf.verified) return null;
  return (
    <span className="tag-unsure" title={etf.note}>
      unverified
    </span>
  );
}

function SourceLink<T>({ s }: { s: Sourced<T> }) {
  if (!s.sourceUrl) return null;
  return (
    <>
      {' '}
      (<a href={s.sourceUrl}>{s.source}</a>
      {s.asOf ? `, ${day(s.asOf)}` : ''})
    </>
  );
}

export default function TaxDrag() {
  const [o, setO] = useStored<State>(storageKey, DEFAULTS);
  const set = <K extends keyof State>(k: K, v: State[K]) => setO((prev) => ({ ...prev, [k]: v }));

  const pickFund = (slot: 'A' | 'B', ticker: string) => {
    const e = etfByTicker(ticker);
    if (!e) return;
    setO((prev) =>
      slot === 'A'
        ? { ...prev, fundA: e.ticker, erA: toPct(e.expenseRatio), whtA: toPct(e.withholding) }
        : { ...prev, fundB: e.ticker, erB: toPct(e.expenseRatio), whtB: toPct(e.withholding) },
    );
  };

  const calc = useMemo(() => compute(o), [o]);
  const { etfA, etfB, years, a, b, irish, other, breakEven, nameA, nameB } = calc;

  const chartRows = a.rows.map((r, i) => ({ year: r.year, a: Math.round(r.value), b: Math.round(b.rows[i].value) }));

  const fundControls = (slot: 'A' | 'B') => {
    const etf = slot === 'A' ? etfA : etfB;
    const erKey = slot === 'A' ? 'erA' : 'erB';
    const whtKey = slot === 'A' ? 'whtA' : 'whtB';
    const id = `td-${slot.toLowerCase()}`;
    return (
      <div className="panel">
        <h3>
          Fund {slot}: {etf.ticker} <Unverified etf={etf} />
        </h3>
        <div className="controls">
          <div>
            <label htmlFor={`${id}-fund`}>Fund</label>
            <select id={`${id}-fund`} value={etf.ticker} onChange={(e) => pickFund(slot, e.target.value)}>
              <optgroup label="US-domiciled">
                {ETFS.filter((e) => e.domicile === 'US').map((e) => (
                  <option key={e.ticker} value={e.ticker}>
                    {e.ticker}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Ireland-domiciled (UCITS)">
                {ETFS.filter((e) => e.domicile === 'IE').map((e) => (
                  <option key={e.ticker} value={e.ticker}>
                    {e.ticker}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-er`}>Expense ratio (% a year)</label>
            <PercentInput id={`${id}-er`} value={o[erKey]} onChange={(v) => set(erKey, v)} />
            <Presets
              label={`Fund ${slot} expense ratio`}
              options={[{ label: `${etf.ticker}: ${toPct(etf.expenseRatio)}%`, value: toPct(etf.expenseRatio) }, { label: '0.1%', value: 0.1 }, { label: '0.5%', value: 0.5 }, { label: '1%', value: 1 }]}
              current={o[erKey]}
              onPick={(v) => set(erKey, v)}
            />
          </div>
          <div>
            <label htmlFor={`${id}-wht`}>Dividend withholding (%)</label>
            <PercentInput id={`${id}-wht`} value={o[whtKey]} onChange={(v) => set(whtKey, v)} />
            <Presets
              label={`Fund ${slot} dividend withholding`}
              options={[...new Set([0, 15, 30, toPct(etf.withholding)])].sort((x, y) => x - y)}
              current={o[whtKey]}
              onPick={(v) => set(whtKey, v)}
            />
          </div>
        </div>
        <p className="note">
          {etf.name}. Withholding: {etf.withholdingNote}.{!etf.verified && etf.note ? ` Unverified: ${etf.note}` : ''}
        </p>
      </div>
    );
  };

  return (
    <div className="tool">
      <section>
        <h2>Your numbers</h2>
        <div className="panel">
          <div className="controls">
            <div>
              <label htmlFor="td-size">Portfolio size (S$)</label>
              <MoneyInput id="td-size" value={o.size} onChange={(v) => set('size', v)} />
              <Presets label="Portfolio size" options={[10000, 50000, 100000, 500000]} current={o.size} onPick={(v) => set('size', v)} />
            </div>
            <div>
              <label htmlFor="td-added">Added each year (S$)</label>
              <MoneyInput id="td-added" value={o.added} onChange={(v) => set('added', v)} />
              <Presets label="Added each year" options={[0, 6000, 12000, 24000]} current={o.added} onPick={(v) => set('added', v)} />
            </div>
            <div>
              <label htmlFor="td-return">Return before costs (% a year)</label>
              <PercentInput id="td-return" value={o.grossReturn} onChange={(v) => set('grossReturn', v)} />
              <Presets label="Return before costs" options={[4, 6, 7, 8, 10]} current={o.grossReturn} onPick={(v) => set('grossReturn', v)} />
            </div>
            <div>
              <label htmlFor="td-yield">Dividend yield (% a year)</label>
              <PercentInput id="td-yield" value={o.dividendYield} onChange={(v) => set('dividendYield', v)} />
              <Presets label="Dividend yield" options={[1, 1.5, 2, 3]} current={o.dividendYield} onPick={(v) => set('dividendYield', v)} />
            </div>
            <div>
              <label htmlFor="td-years">Years</label>
              <input id="td-years" type="number" min={1} max={60} step={1} value={o.years} onChange={(e) => set('years', num(e.target.value))} />
              <Presets label="Years" options={[10, 20, 30, 40]} current={o.years} onPick={(v) => set('years', v)} />
            </div>
            <div>
              <label htmlFor="td-comm">Extra commission per LSE order (S$)</label>
              <MoneyInput id="td-comm" value={o.commission} onChange={(v) => set('commission', v)} />
              <Presets label="Extra commission per LSE order" options={[0, 2, 5, 10]} current={o.commission} onPick={(v) => set('commission', v)} />
            </div>
            <div>
              <label htmlFor="td-orders">Buy orders a year</label>
              <input id="td-orders" type="number" min={0} step={1} value={o.orders} onChange={(e) => set('orders', num(e.target.value))} />
              <Presets label="Buy orders a year" options={[1, 4, 12]} current={o.orders} onPick={(v) => set('orders', v)} />
            </div>
          </div>
          <ul className="points">
            <li>
              <strong>Same return for both.</strong> The return and dividend yield apply to both funds. The comparison
              is fair only when both track a similar index.
            </li>
            <li>
              <strong>Starting yield.</strong> The starting yield of {pct(DEFAULT_A.dividendYield, 2)} is the{' '}
              {DEFAULT_A.yieldNote}.
            </li>
            <li>
              <strong>Extra commission.</strong> What a London Stock Exchange order costs you above an order for a
              US-listed fund. Look it up at your broker.
            </li>
            <li>
              <strong>When it is charged.</strong> To Ireland-domiciled funds only, and only in years when you add
              money.
            </li>
          </ul>
        </div>
        {fundControls('A')}
        {fundControls('B')}
        <button type="button" className="btn" onClick={() => setO(DEFAULTS)}>
          Reset all inputs
        </button>
        {o.years !== years && <p className="warn">Years must be a whole number from 1 to 60. Using {years}.</p>}
      </section>

      <section>
        <h2>Yearly drag</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Fund</th>
                <th>Expense ratio</th>
                <th>Dividend tax</th>
                <th>Total drag</th>
                <th>Drag on {sgd(o.size)}</th>
                <th>Extra commission a year</th>
              </tr>
            </thead>
            <tbody>
              {[a, b].map((f, i) => (
                <tr key={i}>
                  <td>
                    <span className="swatch" style={{ background: i === 0 ? 'var(--c2)' : 'var(--c1)' }} />
                    {i === 0 ? nameA : nameB} <Unverified etf={f.etf} />
                  </td>
                  <td>{pct(f.feeRate, 3)}</td>
                  <td>{pct(f.taxRate, 3)}</td>
                  <td>{pct(f.drag, 3)}</td>
                  <td>{sgd(o.size * f.drag)}</td>
                  <td>{sgd(f.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="points">
          <li>
            <strong>Total drag.</strong> Expense ratio plus dividend yield × withholding rate.
          </li>
          <li>
            <strong>Dividend tax.</strong> The part of the yield lost to withholding.
          </li>
          <li>
            <strong>Extra commission.</strong> Commission per order × buy orders a year.
          </li>
        </ul>
      </section>

      <section>
        <h2>After {years} years</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Fund</th>
                <th>Return after drag</th>
                <th>Ending value</th>
                <th>Put in</th>
              </tr>
            </thead>
            <tbody>
              {[a, b].map((f, i) => (
                <tr key={i}>
                  <td>{i === 0 ? nameA : nameB}</td>
                  <td>{pct(o.grossReturn / 100 - f.drag, 2)}</td>
                  <td>{sgd(f.ending)}</td>
                  <td>{sgd(f.rows[f.rows.length - 1].contributed)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  Difference ({nameB} minus {nameA})
                </td>
                <td>{((a.drag - b.drag) * 100).toFixed(2)} points</td>
                <td>{sgd(b.ending - a.ending)}</td>
                <td>{sgd(0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Break-even portfolio size</h3>
        <div className="panel">
          {!irish || !breakEven ? (
            <p>
              <strong>n/a:</strong> {nameA} and {nameB} are both {a.etf.domicile === 'IE' ? 'Ireland' : 'US'}-domiciled.
              Pick one US-domiciled fund and one Ireland-domiciled fund to see a break-even.
            </p>
          ) : breakEven.ok ? (
            <>
              <p className="stat">{sgd(breakEven.size)}</p>
              <p>
                {calc.perYear === 0
                  ? `With no extra commission, ${irish.etf.ticker} costs less each year than ${other.etf.ticker} at any size.`
                  : `Above this size, ${irish.etf.ticker} costs less each year than ${other.etf.ticker}.`}{' '}
                Its lower drag ({pct(irish.drag, 3)} against {pct(other.drag, 3)}) saves more than the{' '}
                {sgd(calc.perYear)} of extra commission.
              </p>
            </>
          ) : (
            <p>
              <strong>n/a:</strong> {breakEven.reason} ({pct(irish.drag, 3)} for {irish.etf.ticker} against{' '}
              {pct(other.drag, 3)} for {other.etf.ticker}).
            </p>
          )}
          <p className="note">Break-even size = extra commission a year ÷ (other fund’s drag − Irish fund’s drag).</p>
        </div>

        <h3>Value each year</h3>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="year" minTickGap={24} stroke="var(--ink-soft)" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} />
              <YAxis
                width={56}
                stroke="var(--ink-soft)"
                tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
                tickFormatter={(v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`)}
              />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--rule)', borderRadius: 8, color: 'var(--ink)' }}
                labelFormatter={(y) => `Year ${y}`}
                formatter={(value, name) => [sgd(Number(value)), name === 'a' ? nameA : nameB]}
              />
              <Line dataKey="a" stroke="var(--c2)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              <Line dataKey="b" stroke="var(--c1)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="note">
          Value in S$ by year. {nameA} is the dashed line, {nameB} the solid line.
        </p>

        <div className="table-scroll" style={{ maxHeight: '24rem', overflowY: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Year</th>
                <th>Put in</th>
                <th>{nameA}</th>
                <th>{nameB}</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              {a.rows.slice(1).map((r, i) => {
                const rb = b.rows[i + 1];
                return (
                  <tr key={r.year}>
                    <td>{r.year}</td>
                    <td>{sgd(r.contributed)}</td>
                    <td>{sgd(r.value)}</td>
                    <td>{sgd(rb.value)}</td>
                    <td>{sgd(rb.value - r.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className="points">
          <li>
            <strong>New money.</strong> Each year’s new money goes in at the start of the year, less any extra
            commission.
          </li>
          <li>
            <strong>Growth.</strong> The balance then grows at the return before costs minus the fund’s drag.
          </li>
          <li>
            <strong>Not included.</strong> Currency conversion, the broker’s standard commission and bid-ask spreads.
          </li>
          <li>
            <strong>Difference.</strong> {nameB} minus {nameA}.
          </li>
        </ul>
      </section>

      <section>
        <h2>Fund data used</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Fund</th>
                <th>Domicile</th>
                <th>Dividends</th>
                <th>Expense ratio</th>
                <th>Withholding</th>
                <th>Dividend yield</th>
                <th>As of</th>
                <th>Status</th>
                <th className="wrap-cell">Notes</th>
              </tr>
            </thead>
            <tbody>
              {ETFS.map((e) => (
                <tr key={e.ticker}>
                  <td>
                    <a href={e.sourceUrl}>{e.ticker}</a>
                  </td>
                  <td>{e.domicile === 'IE' ? 'Ireland' : 'US'}</td>
                  <td>{e.distribution === 'accumulating' ? 'Reinvested' : 'Paid out'}</td>
                  <td>{toPct(e.expenseRatio)}%</td>
                  <td>{pct(e.withholding, 1)}</td>
                  <td>{e.dividendYield === null ? 'n/a' : pct(e.dividendYield, 2)}</td>
                  <td>{day(e.asOf)}</td>
                  <td>{e.verified ? 'Checked on issuer’s page' : <Unverified etf={e} />}</td>
                  <td className="wrap-cell">
                    {e.name}. Withholding: {e.withholdingNote}. Yield: {e.yieldNote}.{e.note ? ` ${e.note}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="points">
          <li>
            <strong>Researched on {day(RESEARCHED_ON)}.</strong> Each ticker links to the issuer’s page.
          </li>
          <li>
            <strong>Funds with non-US shares.</strong> For VWRA, IWDA and EIMI, the withholding shown is 15% × the US
            share of the fund. Only US dividends get the US–Ireland treaty rate.
          </li>
          <li>
            <strong>Other countries’ tax.</strong> Other countries withhold their own tax before dividends reach either
            kind of fund. That tax is not counted here.
          </li>
          <li>
            <strong>Better estimate.</strong> If you have one, change the withholding rate above.
          </li>
        </ul>
      </section>

      <section>
        <h2>US estate tax</h2>
        <div className="panel">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Rule for people who are not US citizens or residents</th>
                  <th>Figure</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>US-situs assets exempt from US estate tax</td>
                  <td>US${whole(ESTATE_TAX.exemptionUsd)}</td>
                </tr>
                <tr>
                  <td>Top rate on the excess</td>
                  <td>{pct(ESTATE_TAX.topRate, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="points">
            <li>
              <strong>The tax.</strong> Your estate can owe US estate tax of up to {pct(ESTATE_TAX.topRate, 0)} on
              US-situs assets above US${whole(ESTATE_TAX.exemptionUsd)}. It applies if you die while not a US citizen or
              resident.
            </li>
            <li>
              <strong>US-domiciled funds count.</strong> Shares in US-domiciled funds such as SPY, VOO and QQQ are
              US-situs.
            </li>
            <li>
              <strong>Irish funds generally do not.</strong> Ireland-domiciled UCITS funds are generally not US-situs,
              even when they hold US shares.
            </li>
          </ul>
          <p>
            <strong>Confirm with a tax professional.</strong>
          </p>
          <p className="note">
            Sources, checked {day(ESTATE_TAX.checkedOn)}:{' '}
            {ESTATE_TAX.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && '; '}
                <a href={s.url}>{s.label}</a>
              </span>
            ))}
            .
          </p>
        </div>
      </section>

      <section>
        <h2>CSPX or SPYL</h2>
        <CspxSpyl />
      </section>
    </div>
  );
}

function CspxSpyl() {
  const rows = CSPX_VS_SPYL.map((c) => ({ c, etf: etfByTicker(c.ticker) }));
  const na = (why?: string) => `n/a: ${why ?? 'no sourced figure'}`;
  const sized = rows.filter((r) => r.c.sizeEurM.value !== null).sort((x, y) => (y.c.sizeEurM.value ?? 0) - (x.c.sizeEurM.value ?? 0));
  const ratio = sized.length === 2 ? (sized[0].c.sizeEurM.value ?? 0) / (sized[1].c.sizeEurM.value ?? 1) : null;
  const cheapest = [...rows].filter((r) => r.etf).sort((x, y) => (x.etf?.expenseRatio ?? 0) - (y.etf?.expenseRatio ?? 0))[0];
  return (
    <>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Measure</th>
              {rows.map((r) => (
                <th key={r.c.ticker} className="wrap-cell">
                  {r.c.ticker}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Fee a year</td>
              {rows.map(({ c, etf }) => (
                <td key={c.ticker} className="wrap-cell">
                  {etf ? (
                    <>
                      {pct(etf.expenseRatio, 2)} (<a href={etf.sourceUrl}>issuer</a>, {day(etf.asOf)}) <Unverified etf={etf} />
                    </>
                  ) : (
                    na()
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td>Launched</td>
              {rows.map(({ c }) => (
                <td key={c.ticker} className="wrap-cell">
                  {c.launched.value ? day(c.launched.value) : na(c.launched.why)}
                  <SourceLink s={c.launched} />
                </td>
              ))}
            </tr>
            <tr>
              <td>Fund size</td>
              {rows.map(({ c }) => (
                <td key={c.ticker} className="wrap-cell">
                  {c.sizeEurM.value !== null ? `€${whole(c.sizeEurM.value)} million` : na(c.sizeEurM.why)}
                  <SourceLink s={c.sizeEurM} />
                </td>
              ))}
            </tr>
            <tr>
              <td>Bid-ask spread</td>
              {rows.map(({ c }) => {
                const q = c.quote.value;
                return (
                  <td key={c.ticker} className="wrap-cell">
                    {q
                      ? `${pct((q.offer - q.bid) / ((q.offer + q.bid) / 2), 2)} from one quote on ${q.venue} (bid ${q.bid.toFixed(2)}, offer ${q.offer.toFixed(2)} ${q.currency}); not an average and not the London listing`
                      : na(c.quote.why)}
                    <SourceLink s={c.quote} />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <ul className="points">
        <li>
          <strong>Lower fee, smaller fund.</strong>{' '}
          {cheapest?.etf && sized.length === 2 && ratio !== null
            ? `${cheapest.c.ticker} has the lower fee. It is the newer and smaller fund: ${sized[0].c.ticker} is about ${ratio.toFixed(1)} times its size.`
            : 'The lower-fee fund is the newer and smaller one.'}
        </li>
        <li>
          <strong>Spread can be wider.</strong> A smaller, newer fund can have a wider bid-ask spread. You pay the
          spread each time you buy or sell.
        </li>
        <li>
          <strong>Check the live spread.</strong> No comparable spread figures were found for the two London listings.
          Compare the live bid and offer at your broker before choosing.
        </li>
        <li>
          <strong>Fund sizes.</strong> Both are from justETF in euros, so they are comparable. justETF does not date
          the figure, so the date shown is the day it was read.
        </li>
        <li>
          <strong>Test the fee difference.</strong> Pick CSPX and SPYL as the two funds above.
        </li>
      </ul>
    </>
  );
}
