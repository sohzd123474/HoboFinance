// Printable summary of the Savings Bonds tracker for /report/: tables only,
// built from the inputs the visitor saved on /tools/ssb/. It reads storage and
// never writes to it.

import { useMemo } from 'react';
import { averageReturn, change, compare, tenYearAverage, yearlyInterest, type SsbData } from '../../lib/ssb';
import { readStored, sgd, useJson } from '../../lib/storage';
import { DEFAULTS, STORAGE_KEY, monthName, plain, points, rate, resolveInputs, years } from './state';

export const storageKey = STORAGE_KEY;

export default function Summary() {
  const { data, error } = useJson<SsbData>('/data/ssb.json');
  const o = useMemo(() => readStored(storageKey, DEFAULTS), []);
  const { oaRate, reinvestRate, holdYears, amount } = resolveInputs(o);

  if (error) return <p className="warn">{error}</p>;
  if (!data) return <p>Loading Savings Bond data…</p>;
  if (data.issues.length === 0) {
    const why = data.missing[0]?.reason ?? 'the data file has no issues in it';
    return <p className="warn">n/a: {why}.</p>;
  }

  const issues = data.issues;
  const latest = issues[issues.length - 1];
  const previous = issues.length > 1 ? issues[issues.length - 2] : null;
  const saved = issues.find((i) => i.code === o.issue);
  const chosen = saved ?? latest;
  const result = compare(chosen.coupons, amount, holdYears, oaRate, reinvestRate);
  const paid = yearlyInterest(chosen.coupons, amount);
  const diff = result.keptMinusOa;
  const verdictLabel =
    Math.abs(diff) < 0.5
      ? `SSB pays the same as CPF OA over ${years(result.years)}, interest kept as cash`
      : `SSB pays ${diff > 0 ? 'more' : 'less'} than CPF OA over ${years(result.years)}, interest kept as cash`;

  const issueText = saved
    ? `${monthName(chosen.month)} (${chosen.code})`
    : o.issue
      ? `Latest: ${monthName(latest.month)} (${latest.code}). The saved issue ${o.issue} is not in the data.`
      : `Latest: ${monthName(latest.month)} (${latest.code})`;

  const latestTen = tenYearAverage(latest);
  const previousTen = previous ? tenYearAverage(previous) : null;

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
                <td>{amount > 0 ? sgd(amount) : 'n/a: no amount above 0 was saved'}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Holding period</td>
                <td>{years(holdYears)}</td>
              </tr>
              <tr>
                <td className="wrap-cell">CPF OA rate</td>
                <td>{plain(oaRate)} a year</td>
              </tr>
              <tr>
                <td className="wrap-cell">Rate earned on reinvested interest</td>
                <td>
                  {plain(reinvestRate)} a year{o.reinvestRate === null ? ' (same as OA)' : ''}
                </td>
              </tr>
              <tr>
                <td className="wrap-cell">Issue</td>
                <td className="wrap-cell">{issueText}</td>
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
              <tr>
                <td className="wrap-cell">
                  <strong>{verdictLabel}</strong>
                </td>
                <td>
                  <strong>{Math.abs(diff) < 0.5 ? sgd(0) : sgd(Math.abs(diff))}</strong>
                </td>
              </tr>
              <tr>
                <td className="wrap-cell">SSB, interest kept as cash</td>
                <td>{sgd(result.ssbKept)}</td>
              </tr>
              <tr>
                <td className="wrap-cell">SSB, interest reinvested at {plain(reinvestRate)}</td>
                <td>{sgd(result.ssbReinvested)}</td>
              </tr>
              <tr>
                <td className="wrap-cell">CPF OA at {plain(oaRate)}, compounded yearly</td>
                <td>{sgd(result.oa)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Year ({monthName(chosen.month)} issue)</th>
              <th>Rate that year</th>
              <th>Interest paid that year</th>
              <th>Average return per year if held this long</th>
            </tr>
          </thead>
          <tbody>
            {chosen.coupons.map((c, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{rate(c)}</td>
                <td>{sgd(paid[i])}</td>
                <td>{rate(chosen.avgReturn ? chosen.avgReturn[i] : averageReturn(chosen.coupons, i + 1))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Latest issue</th>
              <th>{monthName(latest.month)}</th>
              <th>{previous ? monthName(previous.month) : 'Previous issue'}</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="wrap-cell">10-year average return</td>
              <td>{rate(latestTen)}</td>
              <td>{previous ? rate(previousTen) : 'n/a: no earlier issue'}</td>
              <td>{points(change(latestTen, previousTen))}</td>
            </tr>
            <tr>
              <td className="wrap-cell">Year-1 rate</td>
              <td>{rate(latest.coupons[0])}</td>
              <td>{previous ? rate(previous.coupons[0]) : 'n/a: no earlier issue'}</td>
              <td>{points(change(latest.coupons[0], previous ? previous.coupons[0] : null))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
