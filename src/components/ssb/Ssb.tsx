import { PercentInput } from '../PercentInput';
import { MoneyInput } from '../MoneyInput';
import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Presets } from '../Presets';
import {
  MAX_YEARS,
  averageReturn,
  beatsOaKept,
  beatsOaReinvested,
  breakEvenSimpleRate,
  breakEvenTable,
  change,
  compare,
  simpleAverage,
  tenYearAverage,
  yearlyInterest,
  type SsbData,
} from '../../lib/ssb';
import { num, sgd, useJson, useStored } from '../../lib/storage';
import { DEFAULTS, STORAGE_KEY, dayName, monthName, plain, points, rate, resolveInputs, years } from './state';

// Facts read from the pages linked below on this date. They are not part of the calculations,
// except the holding limit, which only triggers a warning.
const CHECKED_ON = '13 November 2026';
const SSB_HOLDING_LIMIT = 200000;
const SRC = {
  masOverview: 'https://www.mas.gov.sg/bonds-and-bills/singapore-savings-bonds',
  masInvesting: 'https://www.mas.gov.sg/bonds-and-bills/investing-in-singapore-savings-bonds',
  masHowToBuy: 'https://www.mas.gov.sg/bonds-and-bills/investing-in-singapore-savings-bonds/how-to-buy',
  cpfInterest: 'https://www.cpf.gov.sg/member/growing-your-savings/earning-higher-returns/earning-attractive-interest',
  cpfExtra: 'https://www.cpf.gov.sg/service/article/how-much-extra-interest-can-i-earn-on-my-cpf-savings',
  cpfComputed: 'https://www.cpf.gov.sg/service/article/how-is-my-cpf-interest-computed-and-credited-into-my-accounts',
};

interface LeftOut {
  point: string;
  ssb: string;
  oa: string;
  sources: { label: string; url: string }[];
}

const LEFT_OUT: LeftOut[] = [
  {
    point: 'What money can buy it',
    ssb: 'Cash, or Supplementary Retirement Scheme (SRS) money through your SRS operator’s internet banking. MAS: “CPF funds are not eligible for Savings Bond purchases.”',
    oa: 'OA money cannot be moved into a Savings Bond, so this compares cash held outside CPF with money already in OA. It is not a switch you can make.',
    sources: [
      { label: 'MAS: how to buy', url: SRC.masHowToBuy },
      { label: 'MAS: Savings Bonds', url: SRC.masOverview },
    ],
  },
  {
    point: 'Getting the money out',
    ssb: 'Can be redeemed in any month with no penalty. The money arrives by the 2nd business day of the following month.',
    oa: 'n/a: the rules for withdrawing OA savings, and for putting cash into OA, were not checked for this page.',
    sources: [{ label: 'MAS: Savings Bonds', url: SRC.masOverview }],
  },
  {
    point: 'Extra interest',
    ssb: 'None. The rates for all 10 years are fixed when the bond is issued.',
    oa: 'Under 55: an extra 1% a year on the first $60,000 of combined CPF balances, of which at most $20,000 can come from OA. 55 and over: an extra 2% on the first $30,000 and 1% on the next $30,000. Extra interest earned on OA savings is paid into the Special or Retirement Account, not OA. The calculator above ignores it.',
    sources: [
      { label: 'CPF: extra interest', url: SRC.cpfExtra },
      { label: 'CPF: interest rates', url: SRC.cpfInterest },
    ],
  },
  {
    point: 'Can the rate change',
    ssb: 'No. Each issue keeps its published rates until it matures.',
    oa: '2.5% a year from 1 October to 31 December 2026. The rate is reviewed every quarter and has a legal minimum of 2.5%. The calculator holds the rate you enter flat for the whole period.',
    sources: [{ label: 'CPF: interest rates', url: SRC.cpfInterest }],
  },
  {
    point: 'When interest is paid',
    ssb: 'Every 6 months, into your bank account (or SRS account). It does not stay in the bond and earn more.',
    oa: 'Computed monthly, credited once a year and compounded annually. The calculator compounds once a year on a balance that does not change.',
    sources: [
      { label: 'MAS: investing in Savings Bonds', url: SRC.masInvesting },
      { label: 'CPF: how interest is computed', url: SRC.cpfComputed },
    ],
  },
  {
    point: 'Limits and fees',
    ssb: `One person can hold at most ${sgd(SSB_HOLDING_LIMIT)} of Savings Bonds. The minimum is $500, in multiples of $500. The bank charges $2 for each application, which the calculator ignores. If an issue is oversubscribed you may be allotted less than you applied for.`,
    oa: 'n/a: no limit on OA balances was checked for this page.',
    sources: [
      { label: 'MAS: investing in Savings Bonds', url: SRC.masInvesting },
      { label: 'MAS: how to buy', url: SRC.masHowToBuy },
    ],
  },
  {
    point: 'Tax',
    ssb: 'n/a: not checked for this page.',
    oa: 'n/a: not checked for this page.',
    sources: [],
  },
];

export default function Ssb() {
  const { data, error } = useJson<SsbData>('/data/ssb.json');
  const [o, setO] = useStored(STORAGE_KEY, DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) => setO((prev) => ({ ...prev, [k]: v }));

  const { oaRate, reinvestRate, holdYears, amount } = resolveInputs(o);

  // One row per issue, oldest first, with everything the tables and chart need.
  const rows = useMemo(() => {
    if (!data) return [];
    return data.issues.map((issue, i) => {
      const prev = i > 0 ? data.issues[i - 1] : null;
      const ten = tenYearAverage(issue);
      return {
        issue,
        month: issue.month,
        year1: issue.coupons[0],
        ten,
        simpleTen: simpleAverage(issue.coupons, MAX_YEARS),
        tenChange: change(ten, prev ? tenYearAverage(prev) : null),
        year1Change: change(issue.coupons[0], prev ? prev.coupons[0] : null),
        // The previous row is only "the previous month" if no month is missing in between.
        prevMonth: prev ? prev.month : null,
        beatsKept: beatsOaKept(issue.coupons, oaRate),
        beatsReinvested: beatsOaReinvested(issue.coupons, oaRate, reinvestRate),
      };
    });
  }, [data, oaRate, reinvestRate]);

  if (error) return <p className="warn">{error}</p>;
  if (!data) return <p>Loading Savings Bond data…</p>;

  const built = data.builtAt.slice(0, 10);
  const sourceUrls = data.source.split(/\s+and\s+|,\s*/).filter((s) => s.startsWith('http'));
  const sourceLine = (
    <p className="note">
      Rates: Monetary Authority of Singapore (
      {sourceUrls.map((u, i) => (
        <span key={u}>
          {i > 0 && ', '}
          <a href={u}>source {i + 1}</a>
        </span>
      ))}
      ), fetched {built}. See also the <a href={SRC.masOverview}>MAS Savings Bonds page</a>.
    </p>
  );
  const missingBlock =
    data.missing.length > 0 ? (
      <div className="warn">
        <strong>
          {data.missing.length} {data.missing.length === 1 ? 'month is' : 'months are'} missing from the data
        </strong>
        <ul>
          {data.missing.map((m) => (
            <li key={m.month + m.reason}>
              {monthName(m.month)}: {m.reason}
            </li>
          ))}
        </ul>
      </div>
    ) : (
      <p className="note">No months are missing. Every month in the range has an issue.</p>
    );

  if (rows.length === 0) {
    return (
      <div className="tool">
        <section>
          <h2>No Savings Bond data</h2>
          <p className="warn">The data file has no issues, so there is nothing to show.</p>
          {missingBlock}
          {sourceLine}
        </section>
      </div>
    );
  }

  const latest = rows[rows.length - 1];
  const previous = rows.length > 1 ? rows[rows.length - 2] : null;
  const chosen = rows.find((r) => r.issue.code === o.issue) ?? latest;
  const breakEven10 = breakEvenSimpleRate(oaRate, MAX_YEARS);
  const breakEvens = breakEvenTable(oaRate);
  const beatCount = rows.filter((r) => r.beatsKept).length;
  const beatReinvestedCount = rows.filter((r) => r.beatsReinvested).length;
  const today = new Date().toISOString().slice(0, 10);

  const result = compare(chosen.issue.coupons, amount, holdYears, oaRate, reinvestRate);
  const paid = yearlyInterest(chosen.issue.coupons, amount);
  const moreOrLess = (diff: number) => (Math.abs(diff) < 0.5 ? 'the same as' : `${sgd(Math.abs(diff))} ${diff > 0 ? 'more than' : 'less than'}`);
  const verdict = `Over ${years(result.years)}, ${sgd(amount)} in the ${monthName(chosen.month)} issue pays ${moreOrLess(result.keptMinusOa)} CPF OA at ${plain(oaRate)} if you keep the interest as cash. It pays ${moreOrLess(result.reinvestedMinusOa)} OA if you reinvest the interest at ${plain(reinvestRate)}.`;

  const chartRows = rows.map((r) => ({ month: r.month, simpleTen: Number(r.simpleTen.toFixed(3)), ten: r.ten, year1: r.year1 }));
  const SERIES = [
    { key: 'simpleTen', name: 'Interest per year over 10 years, not compounded', color: 'var(--c1)', dash: undefined as string | undefined },
    { key: 'ten', name: '10-year average return as MAS publishes it', color: 'var(--c4)', dash: '6 4' },
    { key: 'year1', name: 'Year-1 rate', color: 'var(--c2)', dash: undefined },
  ];
  const seriesName = (key: unknown) => SERIES.find((s) => s.key === key)?.name ?? String(key);

  return (
    <div className="tool">
      <section>
        <h2>Latest issue</h2>
        <div className="panel">
          <p className="ctl-label">
            {latest.issue.code}, {latest.issue.issueDate > today ? 'to be issued' : 'issued'} {dayName(latest.issue.issueDate)}
          </p>
          <p className="stat">{rate(latest.ten)}</p>
          <p className="note">Average return per year if held for all 10 years, as published by MAS.</p>
        </div>

        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Compared with {previous ? monthName(previous.month) : 'the previous issue'}</th>
                <th>This issue</th>
                <th>Previous issue</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>10-year average return</td>
                <td>{rate(latest.ten)}</td>
                <td>{previous ? rate(previous.ten) : 'n/a'}</td>
                <td>{points(latest.tenChange)}</td>
              </tr>
              <tr>
                <td>Year-1 rate</td>
                <td>{rate(latest.year1)}</td>
                <td>{previous ? rate(previous.year1) : 'n/a'}</td>
                <td>{points(latest.year1Change)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note">Changes are in percentage points (pts): from 2.00% to 2.10% is +0.10 pts.</p>

        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Year</th>
                <th>Interest paid that year</th>
                <th>Average return per year if held this long (MAS)</th>
                <th>Same, worked out here</th>
                <th>Interest per year, not compounded</th>
                <th>Needed to match OA at {plain(oaRate)}</th>
              </tr>
            </thead>
            <tbody>
              {latest.issue.coupons.map((c, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{rate(c)}</td>
                  <td>{latest.issue.avgReturn ? rate(latest.issue.avgReturn[i]) : 'n/a: not published'}</td>
                  <td>{rate(averageReturn(latest.issue.coupons, i + 1))}</td>
                  <td>{rate(simpleAverage(latest.issue.coupons, i + 1))}</td>
                  <td>{rate(breakEvens[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="points">
          <li>
            <strong>MAS average return.</strong> A compounded rate. It is the single yearly rate worth the same as the
            stepped-up interest.
          </li>
          <li>
            <strong>Interest per year, not compounded.</strong> Total interest divided by years held. Compare it with
            the last column.
          </li>
          <li>
            <strong>Needed to match OA.</strong> The flat rate a bond must pay out to equal OA at {plain(oaRate)}{' '}
            compounded yearly.
          </li>
          <li>
            <strong>Change the OA rate.</strong> Set it in the calculator below.
          </li>
        </ul>
      </section>

      <section>
        <h2>History</h2>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="month" tickFormatter={(d: string) => d.slice(0, 4)} minTickGap={40} stroke="var(--ink-soft)" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} />
              <YAxis width={44} stroke="var(--ink-soft)" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} tickFormatter={(v: number) => `${v}%`} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: 3, color: 'var(--ink)' }}
                labelFormatter={(d) => monthName(String(d))}
                formatter={(value, name) => [rate(Number(value)), seriesName(name)]}
              />
              <ReferenceLine
                y={breakEven10}
                stroke="var(--c3)"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
                label={{ value: `${rate(breakEven10)} equals CPF OA at ${plain(oaRate)} compounded`, position: 'insideBottomLeft', fill: 'var(--ink)', fontSize: 12 }}
              />
              {SERIES.map((s) => (
                <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={s.key === 'ten' ? 2 : 2.5} strokeDasharray={s.dash} dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="note">
          {SERIES.map((s, i) => (
            <span key={s.key}>
              {i > 0 && ' '}
              <span className="swatch" style={{ background: s.color }} />
              {s.name}
              {s.dash ? ' (dashed)' : ''}.
            </span>
          ))}{' '}
          <span className="swatch" style={{ background: 'var(--c3)' }} />
          Flat line: {rate(breakEven10)} a year.
        </p>
        <p className="note">
          A bond must pay the flat-line rate, not compounded, to equal CPF OA at {plain(oaRate)} compounded over 10
          years. Compare it with the first line, not the dashed one.
        </p>

        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>At OA {plain(oaRate)}, over 10 years</th>
                <th>Issues that beat OA</th>
                <th>Out of</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Interest kept as cash</td>
                <td>{beatCount}</td>
                <td>{rows.length}</td>
              </tr>
              <tr>
                <td>Interest reinvested at {plain(reinvestRate)}</td>
                <td>{beatReinvestedCount}</td>
                <td>{rows.length}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Every issue</h3>
        <div className="table-scroll" style={{ maxHeight: '26rem', overflowY: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Issue month</th>
                <th>Year-1 rate</th>
                <th>10-year average (MAS)</th>
                <th>Change from previous month</th>
                <th>Interest per year over 10 years, not compounded</th>
                <th>Beat OA over 10 years?</th>
                <th>With interest reinvested?</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.issue.code}>
                  <td>{monthName(r.month)}</td>
                  <td>{rate(r.year1)}</td>
                  <td>{rate(r.ten)}</td>
                  <td>{points(r.tenChange)}</td>
                  <td>{rate(r.simpleTen)}</td>
                  <td>{r.beatsKept ? 'Yes' : 'No'}</td>
                  <td>{r.beatsReinvested ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="points">
          <li>
            <strong>{rows.length} issues, newest first.</strong> {monthName(rows[0].month)} to {monthName(latest.month)}.
          </li>
          <li>
            <strong>Change from previous month.</strong> The change in the 10-year average from the issue before it.
          </li>
          <li>
            <strong>Beat OA over 10 years?</strong> Yes if the bond’s total interest, kept as cash, is more than OA at{' '}
            {plain(oaRate)} compounded yearly would earn.
          </li>
          <li>
            <strong>With interest reinvested?</strong> The same test with the interest reinvested at{' '}
            {plain(reinvestRate)}.
          </li>
          <li>
            <strong>Rates used.</strong> Both tests use the rates set in the calculator below. The OA rate stays flat
            for 10 years.
          </li>
        </ul>
        {missingBlock}
      </section>

      <section>
        <h2>SSB or CPF OA for your amount</h2>
        <div className="panel">
          <div className="controls" style={{ alignItems: 'start' }}>
            <div>
              <label htmlFor="ssb-amount">Amount (S$)</label>
              <MoneyInput id="ssb-amount" value={o.amount} onChange={(v) => set('amount', v)} />
              <Presets label="Amount" options={[1000, 10000, 50000, 100000, 200000]} current={o.amount} onPick={(v) => set('amount', v)} />
            </div>
            <div>
              <label htmlFor="ssb-years">Holding period (years, 1 to 10)</label>
              <input id="ssb-years" type="number" min={1} max={MAX_YEARS} step={1} inputMode="numeric" value={o.years} onChange={(e) => set('years', num(e.target.value))} />
              <Presets label="Holding period" options={[1, 2, 3, 5, 10]} current={o.years} onPick={(v) => set('years', v)} />
            </div>
            <div>
              <label htmlFor="ssb-oa">CPF OA rate (% a year)</label>
              <PercentInput id="ssb-oa" value={o.oaRate} onChange={(v) => set('oaRate', v)} />
              <Presets
                label="CPF OA rate"
                options={[2.5, 3, 3.5, 4].map((v) => ({ label: `${v}%`, value: v }))}
                current={o.oaRate}
                onPick={(v) => set('oaRate', v)}
              />
            </div>
            <div>
              <label htmlFor="ssb-reinvest">Reinvestment rate (% a year)</label>
              <PercentInput id="ssb-reinvest" value={reinvestRate} onChange={(v) => set('reinvestRate', v)} />
              <Presets
                label="Reinvestment rate"
                options={[0, 1, 2, 2.5, 4].map((v) => ({ label: `${v}%`, value: v }))}
                current={reinvestRate}
                onPick={(v) => set('reinvestRate', v)}
              />
            </div>
            <div>
              <label htmlFor="ssb-issue">Issue</label>
              <select id="ssb-issue" value={chosen === latest && !rows.some((r) => r.issue.code === o.issue) ? '' : chosen.issue.code} onChange={(e) => set('issue', e.target.value)}>
                <option value="">Latest ({monthName(latest.month)})</option>
                {[...rows].reverse().map((r) => (
                  <option key={r.issue.code} value={r.issue.code}>
                    {monthName(r.month)} ({r.issue.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="note">
            {o.reinvestRate === null
              ? 'The reinvestment rate follows the OA rate until you change it.'
              : 'The reinvestment rate is set separately from the OA rate.'}{' '}
            {o.reinvestRate !== null && (
              <button type="button" className="btn" onClick={() => set('reinvestRate', null)}>
                Use the OA rate
              </button>
            )}
          </p>
        </div>

        {o.years !== holdYears && <p className="warn">A Savings Bond lasts 10 years, so the holding period is taken as {years(holdYears)}.</p>}
        {amount <= 0 && <p className="warn">Enter an amount above 0.</p>}
        {amount > SSB_HOLDING_LIMIT && (
          <p className="warn">
            One person can hold at most {sgd(SSB_HOLDING_LIMIT)} of Savings Bonds (<a href={SRC.masInvesting}>MAS</a>).{' '}
            {sgd(amount)} is over that limit. Enter {sgd(SSB_HOLDING_LIMIT)} or less.
          </p>
        )}

        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>After {years(result.years)}</th>
                <th>Money at the end</th>
                <th>Interest earned</th>
                <th>Against CPF OA</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>SSB, interest kept as cash</td>
                <td>{sgd(result.ssbKept)}</td>
                <td>{sgd(result.ssbKept - amount)}</td>
                <td>{sgd(result.keptMinusOa)}</td>
              </tr>
              <tr>
                <td>SSB, interest reinvested at {plain(reinvestRate)}</td>
                <td>{sgd(result.ssbReinvested)}</td>
                <td>{sgd(result.ssbReinvested - amount)}</td>
                <td>{sgd(result.reinvestedMinusOa)}</td>
              </tr>
              <tr>
                <td>CPF OA at {plain(oaRate)}, compounded yearly</td>
                <td>{sgd(result.oa)}</td>
                <td>{sgd(result.oa - amount)}</td>
                <td>{sgd(0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          <strong>{verdict}</strong>
        </p>

        <h3>Interest paid each year</h3>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Year</th>
                <th>Rate that year</th>
                <th>Interest paid</th>
                <th>SSB total so far, interest kept</th>
                <th>CPF OA balance</th>
              </tr>
            </thead>
            <tbody>
              {paid.slice(0, result.years).map((p, i) => {
                const upTo = compare(chosen.issue.coupons, amount, i + 1, oaRate, reinvestRate);
                return (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{rate(chosen.issue.coupons[i])}</td>
                    <td>{sgd(p)}</td>
                    <td>{sgd(upTo.ssbKept)}</td>
                    <td>{sgd(upTo.oa)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className="points">
          <li>
            <strong>Issue used.</strong> The {monthName(chosen.month)} issue ({chosen.issue.code}), counted from its
            issue date.
          </li>
          <li>
            <strong>Interest kept as cash.</strong> The interest earns nothing after it is paid.
          </li>
          <li>
            <strong>Interest reinvested.</strong> Each six-monthly payment earns the reinvestment rate, compounded
            yearly, from the day it is paid.
          </li>
          <li>
            <strong>CPF OA.</strong> One deposit left untouched at a flat rate. CPF computes interest monthly and
            credits it once a year.
          </li>
          <li>
            <strong>Rounding.</strong> Amounts are rounded to the dollar.
          </li>
        </ul>
      </section>

      <section>
        <h2>What this leaves out</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Point</th>
                <th className="wrap-cell">Savings Bonds</th>
                <th className="wrap-cell">CPF OA</th>
                <th className="wrap-cell">Source</th>
              </tr>
            </thead>
            <tbody>
              {LEFT_OUT.map((row) => (
                <tr key={row.point}>
                  <td>{row.point}</td>
                  <td className="wrap-cell">{row.ssb}</td>
                  <td className="wrap-cell">{row.oa}</td>
                  <td className="wrap-cell">
                    {row.sources.length === 0
                      ? 'n/a'
                      : row.sources.map((s, i) => (
                          <span key={s.url}>
                            {i > 0 && ', '}
                            <a href={s.url}>{s.label}</a>
                          </span>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="points">
          <li>
            <strong>Checked on {CHECKED_ON}.</strong> The rules were read from the linked MAS and CPF Board pages. They
            can change.
          </li>
          <li>
            <strong>Rows marked n/a.</strong> These were not checked.
          </li>
          <li>
            <strong>Not advice.</strong> This page is general information.
          </li>
        </ul>
        {sourceLine}
      </section>
    </div>
  );
}
