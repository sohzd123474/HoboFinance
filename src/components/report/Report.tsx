import { useMemo, useState } from 'react';
import { stages } from '../../lib/stages';
import { bySlug, type Calculator, type Field, type Figure } from '../../lib/calculators';
import { money, years as yearsText } from '../../lib/format';
import { readStored, sgd } from '../../lib/storage';
import { earliestFire, fireTarget, milestones, simulate } from '../../lib/firecpf';
import TaxDragSummary, { storageKey as taxdragKey } from '../taxdrag/Summary';
import ParkingSummary, { storageKey as parkingKey } from '../parking/Summary';
import SsbSummary, { storageKey as ssbKey } from '../ssb/Summary';
import IlpSummary, { storageKey as ilpKey } from '../ilp/Summary';
import ConcentrationSummary, { storageKey as concentrationKey } from '../concentration/Summary';
import { DrawdownsSummary, LeverageSummary, LumpSumSummary, Snp1Summary } from './ToolSummaries';
import { ageText, defaultPlan, normalise, startAges, thisMonth, toInputs, type PlanState } from '../firecpf/plan';

// The report recomputes every calculator from the numbers saved in this
// browser. Nothing is uploaded: "Save as PDF" uses the browser's own print
// dialog. Pages the visitor has not filled in use the starting examples and
// are labelled as such.

// Tools with a report summary: the path they live at, the key their inputs are saved under, and the summary.
const TOOL_SUMMARIES: Record<string, { key: string; Summary: () => React.ReactNode }> = {
  '/tools/snp1/': { key: 'snp1', Summary: Snp1Summary },
  '/tools/leveraged-etf/': { key: 'leverage', Summary: LeverageSummary },
  '/tools/drawdowns/': { key: 'drawdowns', Summary: DrawdownsSummary },
  '/tools/lump-sum-vs-dca/': { key: 'lumpsum', Summary: LumpSumSummary },
  '/tools/ssb/': { key: ssbKey, Summary: SsbSummary },
  '/tools/etf-tax-drag/': { key: taxdragKey, Summary: TaxDragSummary },
  '/tools/parking/': { key: parkingKey, Summary: ParkingSummary },
  '/tools/ilp-vs-diy/': { key: ilpKey, Summary: IlpSummary },
  '/tools/concentration/': { key: concentrationKey, Summary: ConcentrationSummary },
};

const hasSaved = (key: string) => {
  try {
    return localStorage.getItem(`hf:${key}`) !== null;
  } catch {
    return false;
  }
};

const showFigure = (f: Figure) => (f.kind === 'money' ? money(f.value as number) : f.kind === 'years' ? yearsText(f.value as number) : String(f.value));

const showInput = (f: Field, v: number) =>
  f.unit === 'money'
    ? money(v)
    : f.unit === 'percent'
      ? `${v}%`
      : f.unit === 'years'
        ? `${v} ${v === 1 ? 'year' : 'years'}`
        : f.unit === 'count'
          ? `${v} a year`
          : String(v);

function CalculatorSection({ calc, question, yours }: { calc: Calculator; question: string; yours: boolean }) {
  const values = useMemo(() => {
    const defaults = Object.fromEntries(calc.fields.map((f) => [f.id, f.value])) as Record<string, number>;
    const saved = readStored<Record<string, number>>(`calc:${calc.slug}`, defaults);
    // Ignore anything saved that is not a usable number.
    for (const f of calc.fields) if (typeof saved[f.id] !== 'number' || !Number.isFinite(saved[f.id])) saved[f.id] = f.value;
    return saved;
  }, [calc]);
  const r = calc.compute(values);
  const two = r.legend.length > 1;
  return (
    <section className="report-section">
      <h3>
        {calc.title} {!yours && <span className="tag-unsure">example figures</span>}
      </h3>
      <p className="note">{question}</p>
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
              {calc.fields.map((f) => (
                <tr key={f.id}>
                  <td className="wrap-cell">{f.label}</td>
                  <td>{showInput(f, values[f.id])}</td>
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
              {[r.headline, ...r.rows].map((f, i) => (
                <tr key={f.label}>
                  <td className="wrap-cell">{i === 0 ? <strong>{f.label}</strong> : f.label}</td>
                  <td>{i === 0 ? <strong>{showFigure(f)}</strong> : showFigure(f)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {r.note && <p className="warn">{r.note}</p>}
      {r.series.length > 0 && (
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Year</th>
                <th>{r.legend[0]}</th>
                {two && <th>{r.legend[1]}</th>}
                {two && <th>Total</th>}
              </tr>
            </thead>
            <tbody>
              {r.series.map((p) => (
                <tr key={p.year}>
                  <td>{p.year}</td>
                  <td>{money(p.base)}</td>
                  {two && <td>{money(p.extra)}</td>}
                  {two && <td>{money(p.base + p.extra)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FireSection({ yours }: { yours: boolean }) {
  const data = useMemo(() => {
    const start = thisMonth();
    const plan = normalise(readStored<PlanState>('firecpf', defaultPlan(start)), start);
    const inputs = toInputs(plan, start);
    const fire = earliestFire(inputs);
    const firstAge = startAges(inputs)[0] ?? 0;
    const stopMonth = plan.stopMode === 'age' ? Math.max(0, Math.round(plan.stopAge * 12) - firstAge) : fire.month;
    const sim = simulate({ ...inputs, fireMonth: stopMonth });
    return { plan, inputs, fire, firstAge, stopMonth, sim, marks: milestones(sim) };
  }, []);
  const { plan, inputs, fire, firstAge, stopMonth, sim, marks } = data;
  const at = (m: number | null) => (m === null ? 'Not reached' : `aged ${ageText(firstAge + m)}`);
  return (
    <section className="report-section">
      <h3>
        FIRE and CPF bridge {!yours && <span className="tag-unsure">example figures</span>}
      </h3>
      <p className="note">Can my savings pay for the years until 55, when CPF can be withdrawn?</p>
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
                <td className="wrap-cell">Planning for</td>
                <td>{plan.couple ? 'A couple' : 'One person'}</td>
              </tr>
              {inputs.people.map((p, i) => (
                <tr key={i}>
                  <td className="wrap-cell">Person {i + 1}: age, liquid portfolio, CPF OA</td>
                  <td>
                    {ageText(startAges(inputs)[i])}, {sgd(p.liquid)}, {sgd(p.oa)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="wrap-cell">Household spending a year</td>
                <td>{sgd(inputs.annualSpend)}</td>
              </tr>
              <tr>
                <td className="wrap-cell">Expected return, inflation, withdrawal rate</td>
                <td>
                  {plan.returnPct}%, {plan.inflationPct}%, {inputs.withdrawalRatePct}%
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
              <tr>
                <td className="wrap-cell">
                  <strong>Earliest age to stop work</strong>
                </td>
                <td>
                  <strong>{fire.month === null ? 'Not reached' : ageText(firstAge + fire.month)}</strong>
                </td>
              </tr>
              <tr>
                <td className="wrap-cell">Amount needed at the withdrawal rate</td>
                <td>{sgd(fireTarget(inputs.annualSpend, inputs.withdrawalRatePct))}</td>
              </tr>
              {marks.map((m) => (
                <tr key={m.threshold}>
                  <td className="wrap-cell">Liquid portfolio plus all CPF reaches {sgd(m.threshold)}</td>
                  <td>{at(m.totalMonth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {fire.month === null && fire.reason && <p className="warn">{fire.reason}</p>}
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Year</th>
              <th>Age</th>
              <th>Liquid portfolio</th>
              <th>CPF</th>
              <th>Net worth</th>
              <th>Spent</th>
              <th className="wrap-cell">Notes</th>
            </tr>
          </thead>
          <tbody>
            {sim.rows.map((row) => (
              <tr key={row.date}>
                <td>{row.date.slice(0, 4)}</td>
                <td>{row.ages.join(' and ')}</td>
                <td>{sgd(row.liquid)}</td>
                <td>{sgd(row.cpf)}</td>
                <td>{sgd(row.netWorth)}</td>
                <td>{sgd(row.spent)}</td>
                <td className="wrap-cell">{[...row.notes, row.shortfall > 0 ? `Short by ${sgd(row.shortfall)}` : ''].filter(Boolean).join('; ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        In today’s dollars, with work stopping {stopMonth === null ? 'never (no stop-work age was found)' : `at ${ageText(firstAge + stopMonth)}`}. Returns
        are steady and CPF LIFE payouts are left out. The planner page lists every assumption.
      </p>
    </section>
  );
}

export default function Report() {
  const steps = useMemo(
    () =>
      stages.map((s) => ({
        title: s.title,
        items: s.steps
          .map((step) => {
            const calcSlug = step.href.match(/^\/calculators\/([^/]+)\/$/)?.[1];
            if (calcSlug) {
              const calc = bySlug(calcSlug);
              return calc ? { kind: 'calc' as const, key: step.href, step, calc, yours: hasSaved(`calc:${calcSlug}`) } : null;
            }
            if (step.href === '/tools/fire-cpf/') return { kind: 'fire' as const, key: step.href, step, yours: hasSaved('firecpf') };
            if (step.href === '/report/') return null;
            const t = TOOL_SUMMARIES[step.href];
            if (t) return { kind: 'tool' as const, key: step.href, step, yours: hasSaved(t.key), Summary: t.Summary };
            return { kind: 'link' as const, key: step.href, step, yours: false };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      })),
    [],
  );
  const filled = steps.flatMap((s) => s.items).filter((i) => i.yours).length;
  const [onlyMine, setOnlyMine] = useState(filled > 0);
  const seen = new Set<string>();

  return (
    <div className="tool report">
      <section className="no-print">
        <div className="panel">
          <p>
            <strong>{filled === 0 ? 'You have not filled in any pages yet.' : `This report uses your figures from ${filled} ${filled === 1 ? 'page' : 'pages'}.`}</strong>{' '}
            {filled === 0
              ? 'Work through Start here, then come back. Until then the report shows the starting examples.'
              : 'To update it, change a number on any page and reload this one.'}
          </p>
          <label className="check">
            <input type="checkbox" checked={onlyMine} disabled={filled === 0} onChange={(e) => setOnlyMine(e.target.checked)} />
            Leave out pages I have not filled in
          </label>
          <div className="foot-actions">
            <button type="button" className="btn" onClick={() => window.print()}>
              Save as PDF or print
            </button>
            <span className="note">In the print window, choose “Save as PDF” as the printer.</span>
          </div>
        </div>
      </section>

      <p className="note">
        Made on {new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })} from numbers saved in this browser. Estimates
        only; not financial advice.
      </p>

      {steps.map((s, n) => {
        const items = s.items.filter((i) => {
          if (seen.has(i.key)) return false;
          const keep = i.kind === 'link' ? !onlyMine : !onlyMine || i.yours;
          if (keep) seen.add(i.key);
          return keep;
        });
        if (items.length === 0) return null;
        return (
          <section key={s.title} className="report-stage">
            <h2>
              {n + 1}. {s.title}
            </h2>
            {items.map((i) =>
              i.kind === 'calc' ? (
                <CalculatorSection key={i.key} calc={i.calc} question={i.step.question} yours={i.yours} />
              ) : i.kind === 'fire' ? (
                <FireSection key={i.key} yours={i.yours} />
              ) : i.kind === 'tool' ? (
                <section key={i.key} className="report-section">
                  <h3>
                    {i.step.title} {!i.yours && <span className="tag-unsure">example figures</span>}
                  </h3>
                  <p className="note">{i.step.question}</p>
                  <i.Summary />
                </section>
              ) : (
                <p key={i.key} className="note no-print">
                  {i.step.title} is not included in the report. <a href={i.step.href}>Open it</a> to see its figures.
                </p>
              ),
            )}
          </section>
        );
      })}
    </div>
  );
}
