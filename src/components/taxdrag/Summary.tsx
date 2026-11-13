import { useMemo } from 'react';
import type { Etf } from '../../data/etfs';
import { pct, readStored, sgd } from '../../lib/storage';
import { DEFAULTS, compute, storageKey, type State } from './state';

export { storageKey };

function Unverified({ etf }: { etf: Etf }) {
  if (etf.verified) return null;
  return (
    <span className="tag-unsure" title={etf.note}>
      unverified
    </span>
  );
}

/** Report summary for the ETF tax-drag calculator: tables only, from the saved inputs. */
export default function Summary() {
  const { o, r } = useMemo(() => {
    const saved = readStored<State>(storageKey, DEFAULTS);
    // Ignore anything saved that is not a usable value.
    const clean = { ...DEFAULTS } as Record<string, number | string>;
    for (const [k, d] of Object.entries(DEFAULTS)) {
      const v = (saved as Record<string, unknown>)[k];
      if (typeof d === 'number' ? typeof v === 'number' && Number.isFinite(v) : typeof v === 'string') clean[k] = v as number | string;
    }
    const state = clean as State;
    return { o: state, r: compute(state) };
  }, []);
  const { a, b, years, irish, other, breakEven, nameA, nameB, perYear } = r;
  const funds = [
    { f: a, name: nameA, er: o.erA, wht: o.whtA },
    { f: b, name: nameB, er: o.erB, wht: o.whtB },
  ];

  const breakEvenText = !irish || !breakEven
    ? `n/a: both funds are ${a.etf.domicile === 'IE' ? 'Ireland' : 'US'}-domiciled. It needs one US-domiciled fund and one Ireland-domiciled fund`
    : breakEven.ok
      ? sgd(breakEven.size)
      : `n/a: ${breakEven.reason} (${pct(irish.drag, 3)} for ${irish.etf.ticker} against ${pct(other.drag, 3)} for ${other.etf.ticker})`;

  const unverified = funds.filter(({ f }, i) => !f.etf.verified && (i === 0 || f.etf.ticker !== a.etf.ticker));

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
                <td className="wrap-cell">Portfolio size</td>
                <td>{sgd(o.size)}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Added each year</td>
                <td>{sgd(o.added)}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Return before costs</td>
                <td>{o.grossReturn}% a year</td>
              </tr>
              <tr>
                <td className="wrap-cell">Dividend yield</td>
                <td>{o.dividendYield}% a year</td>
              </tr>
              <tr>
                <td className="wrap-cell">Years</td>
                <td>{years}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Extra commission per LSE order</td>
                <td>{sgd(o.commission, 2)}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Buy orders a year</td>
                <td>{o.orders}</td>
              </tr>
              {funds.map(({ f, name, er, wht }, i) => (
                <tr key={i}>
                  <td className="wrap-cell">
                    Fund {i === 0 ? 'A' : 'B'}: {name} ({f.etf.domicile === 'IE' ? 'Ireland' : 'US'}-domiciled) <Unverified etf={f.etf} />
                  </td>
                  <td>
                    {er}% expense ratio, {wht}% withholding
                  </td>
                </tr>
              ))}
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
              <tr>
                <td className="wrap-cell">
                  <strong>
                    Difference after {years} years ({nameB} minus {nameA})
                  </strong>
                </td>
                <td>
                  <strong>{sgd(b.ending - a.ending)}</strong>
                </td>
              </tr>
              {funds.map(({ f, name }, i) => (
                <tr key={i}>
                  <td className="wrap-cell">{name} ending value</td>
                  <td>{sgd(f.ending)}</td>
                </tr>
              ))}
              <tr>
                <td className="wrap-cell">Put in</td>
                <td>{sgd(a.rows[a.rows.length - 1].contributed)}</td>
              </tr>
              {funds.map(({ f, name }, i) => (
                <tr key={i}>
                  <td className="wrap-cell">{name} yearly drag</td>
                  <td>
                    {pct(f.drag, 3)}, {sgd(o.size * f.drag)} on {sgd(o.size)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="wrap-cell">Extra commission a year for an Ireland-domiciled fund</td>
                <td>{sgd(perYear)}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Break-even portfolio size</td>
                <td className="wrap-cell">{breakEvenText}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {o.years !== years && <p className="warn">Years must be a whole number from 1 to 60. Using {years}.</p>}
      {unverified.map(({ f }) => (
        <p className="warn" key={f.etf.ticker}>
          {f.etf.ticker} <Unverified etf={f.etf} /> {f.etf.note ?? 'This fund’s figures could not be checked on the issuer’s page.'}
        </p>
      ))}

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
              <th>Return after drag</th>
            </tr>
          </thead>
          <tbody>
            {funds.map(({ f, name }, i) => (
              <tr key={i}>
                <td>
                  {name} <Unverified etf={f.etf} />
                </td>
                <td>{pct(f.feeRate, 3)}</td>
                <td>{pct(f.taxRate, 3)}</td>
                <td>{pct(f.drag, 3)}</td>
                <td>{sgd(o.size * f.drag)}</td>
                <td>{sgd(f.commission)}</td>
                <td>{pct(o.grossReturn / 100 - f.drag, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-scroll">
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
            {a.rows.slice(1).map((row, i) => {
              const rb = b.rows[i + 1];
              return (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td>{sgd(row.contributed)}</td>
                  <td>{sgd(row.value)}</td>
                  <td>{sgd(rb.value)}</td>
                  <td>{sgd(rb.value - row.value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
