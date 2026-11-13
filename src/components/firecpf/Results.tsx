import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addMonths, type FireCheck, type FireResult, type Inputs, type Milestone, type SimResult } from '../../lib/firecpf';
import { pct, sgd } from '../../lib/storage';
import { monthName } from './Fields';
import { ageText, startAges, type PlanState } from './plan';

export interface Calc {
  fire: FireResult;
  sens: { returnPct: number; result: FireResult }[];
  /** Month work stops in the table and chart; null when it never does. */
  stopMonth: number | null;
  /** The two conditions tested at the chosen stop-work age. */
  chosen: FireCheck | null;
  sim: SimResult;
  marks: Milestone[];
}

export default function Results({ plan, inputs, calc }: { plan: PlanState; inputs: Inputs; calc: Calc }) {
  const ages0 = startAges(inputs);
  const couple = inputs.people.length > 1;
  const date = (month: number) => monthName(addMonths(inputs.start, month));
  const who = (month: number) =>
    couple ? `person 1 aged ${ageText(ages0[0] + month)}, person 2 aged ${ageText(ages0[1] + month)}` : `aged ${ageText(ages0[0] + month)}`;
  const when = (month: number) => (month === 0 ? `Now (${who(0)})` : `${date(month)}, ${who(month)}`);

  const { fire, sim, chosen } = calc;
  const shown = plan.stopMode === 'age' ? chosen : fire.check;
  const wr = plan.withdrawalRatePct;
  const realReturn = (r: number) => (1 + r / 100) / (1 + plan.inflationPct / 100) - 1;

  const chartRows = sim.rows.map((r) => ({ age: r.ages[0], date: r.date, liquid: Math.round(r.liquid), cpf: Math.round(r.cpf) }));
  const axisMoney = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`);

  const milestoneCell = (month: number | null, peak: { value: number; month: number }) =>
    month === null
      ? `Not reached: the highest is ${sgd(peak.value)}, ${peak.month === 0 ? 'now' : `in ${date(peak.month)}`}`
      : month === 0
        ? 'Already there'
        : when(month);

  return (
    <>
      <section>
        <h2>Earliest age to stop work</h2>
        <div className="panel">
          <p className="ctl-label">Earliest stop-work age at a {wr}% withdrawal rate{couple ? ' (person 1)' : ''}</p>
          <p className="stat">{fire.month === null ? 'Not reached' : ageText(ages0[0] + fire.month)}</p>
          {fire.month === null ? (
            <p>{fire.reason}</p>
          ) : (
            <p>{when(fire.month)}.</p>
          )}
          <p className="note">
            This is the first month in which both of these are true. First, the liquid portfolio alone pays the target
            spending from that month until {couple ? 'the younger of you turns' : 'you turn'} 55, without running out.
            Second, the liquid portfolio plus CPF (leaving out MediSave, which can only pay medical costs) at 55 is at
            least the yearly spending divided by the withdrawal rate. If work stops after 55, the second test is made
            on the day work stops.
          </p>
        </div>

        {plan.stopMode === 'age' && chosen && (
          <p className={chosen.bridgeOk && chosen.totalOk ? 'note' : 'warn'}>
            Stopping at your chosen age of {plan.stopAge} ({date(chosen.month)}){' '}
            {chosen.bridgeOk && chosen.totalOk ? 'passes both tests.' : 'does not pass both tests. See the table below.'}
          </p>
        )}

        {shown && (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th className="wrap-cell">Test, stopping work in {date(shown.month)}</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="wrap-cell">
                    Amount needed: {sgd(plan.annualSpend)} a year divided by {wr}%
                  </td>
                  <td>{Number.isFinite(fire.target) ? sgd(fire.target) : 'n/a: withdrawal rate is 0%'}</td>
                </tr>
                <tr>
                  <td className="wrap-cell">Liquid portfolio plus CPF without MediSave in {date(shown.bridgeEnd)}</td>
                  <td>
                    {sgd(shown.totalAtEnd)} ({shown.totalOk ? 'enough' : 'not enough'})
                  </td>
                </tr>
                <tr>
                  <td className="wrap-cell">Liquid portfolio pays for everything until {date(shown.bridgeEnd)}</td>
                  <td>{shown.bridgeOk ? 'Yes' : `No: it runs out in ${date(shown.firstShort ?? shown.month)}`}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <h3>At other returns</h3>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Expected return</th>
                <th>After {plan.inflationPct}% inflation</th>
                <th>Earliest stop-work age{couple ? ' (person 1)' : ''}</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {calc.sens.map((s) => (
                <tr key={s.returnPct}>
                  <td>{s.returnPct}%</td>
                  <td>{pct(realReturn(s.returnPct))}</td>
                  {s.result.month === null ? (
                    <td colSpan={2} className="wrap-cell">
                      Not reached. {s.result.reason}
                    </td>
                  ) : (
                    <>
                      <td>{ageText(ages0[0] + s.result.month)}</td>
                      <td>{s.result.month === 0 ? 'Now' : date(s.result.month)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Same inputs, with only the expected return changed. CPFIS investments follow the same return less the fee.</p>
      </section>

      <section>
        <h2>Net worth milestones</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Net worth</th>
                <th className="wrap-cell">Liquid portfolio only</th>
                <th className="wrap-cell">Liquid portfolio plus all CPF</th>
              </tr>
            </thead>
            <tbody>
              {calc.marks.map((m) => (
                <tr key={m.threshold}>
                  <td>{sgd(m.threshold)}</td>
                  <td className="wrap-cell">{milestoneCell(m.liquidMonth, m.liquidPeak)}</td>
                  <td className="wrap-cell">{milestoneCell(m.totalMonth, m.totalPeak)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          In today’s dollars, with work stopping{' '}
          {calc.stopMonth === null ? 'never (no stop-work age was found, so the plan assumes work continues)' : `in ${date(calc.stopMonth)}`}. “All
          CPF” counts OA, CPFIS, Special or Retirement Account and MediSave.
        </p>
      </section>

      <section>
        <h2>Year by year</h2>
        {calc.stopMonth === null && (
          <p className="warn">
            No stop-work age was found, so this table assumes salary and investing continue for the whole period. Choose
            a stop-work age above to see what happens if you stop anyway.
          </p>
        )}
        {sim.shortMonths.length > 0 && (
          <p className="warn">
            The liquid portfolio cannot pay for everything in this plan. The first month with a gap is {date(sim.shortMonths[0])}.
            See the notes column.
          </p>
        )}
        {chartRows.length > 0 && (
          <div>
            <h3>Liquid portfolio and CPF</h3>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartRows} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="age" minTickGap={28} stroke="var(--ink-soft)" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} />
                  <YAxis width={56} stroke="var(--ink-soft)" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} tickFormatter={axisMoney} />
                  <Tooltip
                    contentStyle={{ background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: 3, color: 'var(--ink)' }}
                    labelFormatter={(age) => `Age ${age}`}
                    formatter={(value, name) => [sgd(Number(value)), name === 'liquid' ? 'Liquid portfolio' : 'CPF']}
                  />
                  <Area dataKey="cpf" stackId="nw" stroke="var(--c4)" fill="var(--c4)" fillOpacity={0.35} strokeWidth={2} isAnimationActive={false} />
                  <Area dataKey="liquid" stackId="nw" stroke="var(--c1)" fill="var(--c1)" fillOpacity={0.35} strokeWidth={2} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="note">
              <span className="swatch" style={{ background: 'var(--c1)' }} />
              Liquid portfolio, stacked on <span className="swatch" style={{ background: 'var(--c4)', marginLeft: '0.3em' }} />
              CPF (all accounts). The top edge is net worth. Today’s dollars, by {couple ? 'person 1’s age' : 'age'}.
            </p>
          </div>
        )}

        <div className="table-scroll" style={{ maxHeight: '34rem', overflowY: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Year</th>
                <th>{couple ? 'Ages' : 'Age'}</th>
                <th>Liquid</th>
                <th>OA</th>
                <th>CPFIS</th>
                <th>SA or RA</th>
                <th>MediSave</th>
                <th>Total CPF</th>
                <th>Net worth</th>
                <th>Spending drawn</th>
                <th className="wrap-cell">Notes</th>
              </tr>
            </thead>
            <tbody>
              {sim.rows.map((r) => (
                <tr key={r.month}>
                  <td>{r.month === 0 ? 'Now' : monthName(r.date)}</td>
                  <td>{r.ages.join(' and ')}</td>
                  <td>{sgd(r.liquid)}</td>
                  <td>{sgd(r.oa)}</td>
                  <td>{sgd(r.cpfis)}</td>
                  <td>{sgd(r.sara)}</td>
                  <td>{sgd(r.ma)}</td>
                  <td>{sgd(r.cpf)}</td>
                  <td>{sgd(r.netWorth)}</td>
                  <td>{sgd(r.spent)}</td>
                  <td className="wrap-cell">{r.notes.join('. ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          Each row is the position at that date, in today’s dollars. Spending drawn and the notes cover the 12 months
          before it. SA or RA is the Special Account before 55 and the Retirement Account after. Net worth is the
          liquid portfolio plus total CPF; it leaves out your home and the mortgage on it.
        </p>
      </section>
    </>
  );
}
