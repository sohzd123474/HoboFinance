import { useMemo } from 'react';
import { MAX_MONTHS, MIN_MONTHS } from '../../lib/parking';
import { readStored, sgd } from '../../lib/storage';
import { DEFAULTS, METHOD_NAME, PLACEHOLDER_RATE, compute, storageKey, type State } from './state';

export { storageKey };

const usable = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Report summary for the short-term parking calculator: tables only, from the saved inputs. */
export default function Summary() {
  const { o, r } = useMemo(() => {
    const saved = readStored<State>(storageKey, DEFAULTS);
    // Ignore anything saved that is not a usable value.
    const state: State = {
      amount: usable(saved.amount) ? saved.amount : DEFAULTS.amount,
      months: usable(saved.months) ? saved.months : DEFAULTS.months,
      options: DEFAULTS.options.map((d, i) => {
        const s = Array.isArray(saved.options) ? saved.options[i] : undefined;
        return {
          label: typeof s?.label === 'string' ? s.label : d.label,
          rate: usable(s?.rate) ? s.rate : d.rate,
          method: s?.method === 'simple' || s?.method === 'monthly' ? s.method : d.method,
        };
      }),
    };
    return { o: state, r: compute(state) };
  }, []);
  const { months, results } = r;
  const name = (label: string, i: number) => label || `Option ${i + 1}`;
  const best = results.reduce((top, x) => (x.interest > top.interest ? x : top), results[0]);
  const bestIndex = results.indexOf(best);
  const allPlaceholder = results.every((x) => x.rate === PLACEHOLDER_RATE);

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
                <td className="wrap-cell">Amount</td>
                <td>{sgd(o.amount)}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Months</td>
                <td>{months}</td>
              </tr>
              {results.map((x, i) => (
                <tr key={i}>
                  <td className="wrap-cell">{name(x.label, i)}</td>
                  <td>
                    {x.rate.toFixed(2)}% a year, {METHOD_NAME[x.method].toLowerCase()}
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
                  <strong>Most interest: {name(best.label, bestIndex)}</strong>
                </td>
                <td>
                  <strong>{sgd(best.interest, 2)}</strong>
                </td>
              </tr>
              {results.map((x, i) => (
                <tr key={i}>
                  <td className="wrap-cell">{name(x.label, i)} ending amount</td>
                  <td>{sgd(x.ending, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {o.months !== months && (
        <p className="warn">
          Months must be a whole number from {MIN_MONTHS} to {MAX_MONTHS}. Using {months}.
        </p>
      )}
      {allPlaceholder && (
        <p className="warn">
          All three rates are still the {PLACEHOLDER_RATE.toFixed(1)}% placeholder, not today’s rates. Enter today’s rates on the
          Short-term parking page.
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
            {results.map((x, i) => (
              <tr key={i}>
                <td>{name(x.label, i)}</td>
                <td>{x.rate.toFixed(2)}%</td>
                <td>{METHOD_NAME[x.method]}</td>
                <td>{sgd(x.interest, 2)}</td>
                <td>{sgd(x.ending, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
