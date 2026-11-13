import { PercentInput } from '../PercentInput';
import { MoneyInput } from '../MoneyInput';
import { MAX_MONTHS, MIN_MONTHS } from '../../lib/parking';
import { num, sgd, useStored } from '../../lib/storage';
import { Presets } from '../Presets';
import { DEFAULTS, METHOD_NAME, PLACEHOLDER_RATE, compute, storageKey, type Option } from './state';

const MAS_SSB = 'https://www.mas.gov.sg/bonds-and-bills/singapore-savings-bonds';
const MAS_TBILL = 'https://www.mas.gov.sg/bonds-and-bills/singapore-government-t-bills-information-for-individuals';

const BOOKS = [
  {
    title: 'The Little Book of Common Sense Investing',
    author: 'John C. Bogle',
    why: 'Makes the case for buying a low-cost index fund and holding it, by the person who started the first one.',
  },
  {
    title: 'The Psychology of Money',
    author: 'Morgan Housel',
    why: 'Short chapters on how behaviour, patience and luck shape results more than cleverness does.',
  },
  {
    title: 'A Random Walk Down Wall Street',
    author: 'Burton Malkiel',
    why: 'Explains why picking stocks and timing the market rarely beat the index, with the history behind it.',
  },
];

const TOOLS = [
  { name: 'justETF', url: 'https://www.justetf.com/', use: 'Look up and compare UCITS ETFs: fees, size, domicile and holdings.' },
  { name: 'Curvo', url: 'https://curvo.eu/backtest/', use: 'Backtest portfolios of UCITS index funds.' },
  { name: 'Macrotrends', url: 'https://www.macrotrends.net/', use: 'Long-run charts of company financials, prices and economic series.' },
  { name: 'Koyfin', url: 'https://www.koyfin.com/', use: 'Charts and financial data for shares, funds and markets.' },
  { name: 'FRED', url: 'https://fred.stlouisfed.org/', use: 'Economic data series from the Federal Reserve Bank of St. Louis: interest rates, inflation, employment.' },
  { name: 'Finviz', url: 'https://finviz.com/', use: 'Screen US shares and see the market at a glance on a heat map.' },
];

export default function Parking() {
  const [o, setO] = useStored(storageKey, DEFAULTS);
  const { options, months, results } = compute(o);
  const setOption = (i: number, patch: Partial<Option>) =>
    setO((prev) => ({ ...prev, options: options.map((x, k) => (k === i ? { ...x, ...patch } : x)) }));

  return (
    <div className="tool">
      <section>
        <h2>The rule</h2>
        <div className="panel">
          <p>
            <strong>
              Money you need within about 2 years belongs in Singapore Savings Bonds, T-bills or a money market fund,
              not in shares.
            </strong>
          </p>
          <p>Shares can fall by a third or more and take years to recover, which is longer than you can wait.</p>
        </div>
      </section>

      <section>
        <h2>What it would earn</h2>
        <div className="panel">
          <div className="controls">
            <div>
              <label htmlFor="pk-amount">Amount (S$)</label>
              <MoneyInput id="pk-amount" value={o.amount} onChange={(v) => setO((p) => ({ ...p, amount: v }))} />
              <Presets label="Amount" options={[5000, 10000, 50000, 100000]} current={o.amount} onPick={(v) => setO((p) => ({ ...p, amount: v }))} />
            </div>
            <div>
              <label htmlFor="pk-months">
                Months ({MIN_MONTHS} to {MAX_MONTHS})
              </label>
              <input
                id="pk-months"
                type="number"
                min={MIN_MONTHS}
                max={MAX_MONTHS}
                step={1}
                value={o.months}
                onChange={(e) => setO((p) => ({ ...p, months: num(e.target.value) }))}
              />
              <Presets label="Months" options={[3, 6, 12, 18, 24]} current={o.months} onPick={(v) => setO((p) => ({ ...p, months: v }))} />
            </div>
          </div>
          {options.map((x, i) => (
            <div className="controls" key={i}>
              <div>
                <label htmlFor={`pk-label-${i}`}>Option {i + 1} name</label>
                <input id={`pk-label-${i}`} type="text" value={x.label} onChange={(e) => setOption(i, { label: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`pk-rate-${i}`}>Option {i + 1} rate (% a year)</label>
                <PercentInput id={`pk-rate-${i}`} value={x.rate} onChange={(v) => setOption(i, { rate: v })} />
                <Presets label={`Option ${i + 1} rate`} options={[1, 1.5, 2, 2.5, 3, 3.5, 4]} current={x.rate} onPick={(v) => setOption(i, { rate: v })} />
              </div>
              <div>
                <label htmlFor={`pk-method-${i}`}>Option {i + 1} interest</label>
                <select id={`pk-method-${i}`} value={x.method} onChange={(e) => setOption(i, { method: e.target.value === 'simple' ? 'simple' : 'monthly' })}>
                  <option value="monthly">{METHOD_NAME.monthly}</option>
                  <option value="simple">{METHOD_NAME.simple}</option>
                </select>
              </div>
            </div>
          ))}
          <p className="note">
            The {PLACEHOLDER_RATE.toFixed(1)}% rates are placeholders, not today’s rates. Enter today’s rate for each
            option: see the <a href={MAS_SSB}>MAS Savings Bonds page</a> and the <a href={MAS_TBILL}>MAS T-bills page</a>
            , and your fund’s own page for a money market fund.
          </p>
          <button type="button" className="btn" onClick={() => setO(DEFAULTS)}>
            Reset
          </button>
        </div>

        {o.months !== months && (
          <p className="warn">
            Months must be a whole number from {MIN_MONTHS} to {MAX_MONTHS}. Using {months}.
          </p>
        )}

        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Option</th>
                <th>Rate a year</th>
                <th>Interest method</th>
                <th>Interest earned</th>
                <th>Ending amount</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{r.label || `Option ${i + 1}`}</td>
                  <td>{r.rate.toFixed(2)}%</td>
                  <td>{METHOD_NAME[r.method]}</td>
                  <td>{sgd(r.interest, 2)}</td>
                  <td>{sgd(r.ending, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          {sgd(o.amount)} held for {months} {months === 1 ? 'month' : 'months'}. Simple interest is amount × rate ×
          months ÷ 12, used for T-bills because they pay nothing until they mature. Monthly compounding adds interest to
          the balance each month, used for the other two by default. These are estimates: Savings Bonds pay a rate that
          steps up each year and pay it out every six months, a T-bill runs for a fixed 6 or 12 months, and a money
          market fund’s rate changes daily and is not guaranteed.
        </p>
      </section>

      <section>
        <h2>Reading list</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th className="wrap-cell">Why read it</th>
              </tr>
            </thead>
            <tbody>
              {BOOKS.map((b) => (
                <tr key={b.title}>
                  <td>{b.title}</td>
                  <td>{b.author}</td>
                  <td className="wrap-cell">{b.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Tools</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Link</th>
                <th className="wrap-cell">What it is for</th>
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((t) => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td>
                    <a href={t.url}>{t.url.replace('https://', '').replace(/^www\./, '').replace(/\/$/, '')}</a>
                  </td>
                  <td className="wrap-cell">{t.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
