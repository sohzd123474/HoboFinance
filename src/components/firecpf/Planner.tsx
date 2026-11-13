import { useMemo, useState } from 'react';
import {
  ALLOCATION_RATES,
  BHS,
  CONTRIBUTION_RATES,
  CPF_RULES,
  EXTRA_INTEREST,
  FRS_BY_YEAR,
  FRS_GROWTH_PCT,
  PAYOUT_AGE,
  SEP_MEDISAVE,
  WITHDRAWAL_RULE,
  type Sourced,
} from '../../data/cpf';
import { checkFire, earliestFire, milestones, monthIndex, monthlyContribution, sensitivity, sepMedisave, simulate } from '../../lib/firecpf';
import { sgd, useStored } from '../../lib/storage';
import { MONTHS, MonthField, NumField, Toggle, k, pctChips } from './Fields';
import Results, { type Calc } from './Results';
import { PUBLISHED_RULES, ageText, defaultPlan, normalise, startAges, thisMonth, toInputs, toRules, type PersonState, type PlanState, type RuleEdits } from './plan';

const unverified = <span className="tag-unsure">unverified</span>;

const bandName = (bands: { upToAge: number }[], i: number) =>
  i === 0 ? `${bands[0].upToAge} and below` : i === bands.length - 1 ? `above ${bands[i - 1].upToAge}` : `above ${bands[i - 1].upToAge} to ${bands[i].upToAge}`;
const share = (n: number) => `${Math.round(n * 1000) / 10}%`;

/** The value of a rule from the data file, as text for the sources table. */
function ruleText(rule: Sourced<unknown>): string {
  if (rule === CONTRIBUTION_RATES) {
    const b = CONTRIBUTION_RATES.value;
    return b.map((x, i) => `${bandName(b, i)}: ${share(x.total)} (employee ${share(x.employee)})`).join('; ');
  }
  if (rule === ALLOCATION_RATES) {
    const b = ALLOCATION_RATES.value;
    return b.map((x, i) => `${bandName(b, i)}: OA ${x.oa}, SA or RA ${x.sa}, MediSave ${x.ma}`).join('; ');
  }
  if (rule === EXTRA_INTEREST) {
    const x = EXTRA_INTEREST.value;
    return `Below 55: ${x.below55Pct}% on the first ${sgd(x.combinedCap)}. From 55: ${x.from55FirstPct}% on the first ${sgd(x.firstTier)} and ${x.from55NextPct}% on the next ${sgd(x.combinedCap - x.firstTier)}. At most ${sgd(x.oaCap)} of OA counts.`;
  }
  if (rule === FRS_BY_YEAR) {
    return Object.entries(FRS_BY_YEAR.value)
      .map(([year, v]) => `${year}: ${sgd(v)}`)
      .join('; ');
  }
  if (rule === WITHDRAWAL_RULE) return `From age ${WITHDRAWAL_RULE.value.age}; ${sgd(WITHDRAWAL_RULE.value.minimum)} in any case`;
  if (rule === SEP_MEDISAVE) {
    const s = SEP_MEDISAVE.value;
    return (
      `Nothing at or below ${sgd(s.threshold)} of yearly net trade income. Above ${sgd(s.fullFrom)}: ` +
      s.bands
        .map((b, i) => `${i === 0 ? `below ${b.belowAge}` : i === s.bands.length - 1 ? `${s.bands[i - 1].belowAge} and above` : `${s.bands[i - 1].belowAge} to below ${b.belowAge}`}: ${share(b.fullRate)}, at most ${sgd(b.max)}`)
        .join('; ')
    );
  }
  if (typeof rule.value === 'number') {
    if (rule.label.includes('%')) return `${rule.value}%`;
    if (rule.label.includes('S$')) return sgd(rule.value);
    return String(rule.value);
  }
  return typeof rule.value === 'string' ? rule.value : 'n/a: no text form for this rule';
}

export default function Planner() {
  const [start] = useState(thisMonth);
  const [saved, setSaved] = useStored<PlanState>('firecpf', defaultPlan(start));
  const plan = useMemo(() => normalise(saved, start), [saved, start]);
  const thisYear = Number(start.slice(0, 4));

  const update = (fn: (p: PlanState) => PlanState) => setSaved((prev) => fn(normalise(prev, start)));
  const set = <K extends keyof PlanState>(key: K, value: PlanState[K]) => update((p) => ({ ...p, [key]: value }));
  const setPerson = (i: number, patch: Partial<PersonState>) =>
    update((p) => ({ ...p, people: p.people.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const setBto = (patch: Partial<PlanState['bto']>) => update((p) => ({ ...p, bto: { ...p.bto, ...patch } }));
  const setReno = (patch: Partial<PlanState['reno']>) => update((p) => ({ ...p, reno: { ...p.reno, ...patch } }));
  const setReduced = (patch: Partial<PlanState['reduced']>) => update((p) => ({ ...p, reduced: { ...p.reduced, ...patch } }));
  const setRule = (patch: Partial<RuleEdits>) => update((p) => ({ ...p, rules: { ...p.rules, ...patch } }));

  const inputs = useMemo(() => toInputs(plan, start), [plan, start]);
  const ages0 = startAges(inputs);
  const calc: Calc = useMemo(() => {
    const fire = earliestFire(inputs);
    const firstAge = startAges(inputs)[0] ?? 0;
    const stopMonth = plan.stopMode === 'age' ? Math.max(0, Math.round(plan.stopAge * 12) - firstAge) : fire.month;
    const sim = simulate({ ...inputs, fireMonth: stopMonth });
    return {
      fire,
      sens: sensitivity(inputs),
      stopMonth,
      chosen: plan.stopMode === 'age' && stopMonth !== null ? checkFire(inputs, stopMonth) : null,
      sim,
      marks: milestones(sim),
    };
  }, [inputs, plan.stopMode, plan.stopAge]);

  const rules = toRules(plan.rules);
  const count = plan.couple ? 2 : 1;
  const name = (i: number) => (plan.couple ? `Person ${i + 1}` : 'You');
  const published = (key: keyof RuleEdits, unit: 'pct' | 'sgd' | 'age') => {
    const v = PUBLISHED_RULES[key];
    return [{ label: `Published: ${unit === 'pct' ? `${v}%` : unit === 'sgd' ? sgd(v) : v}`, value: v }];
  };
  const rulesChanged = (Object.keys(PUBLISHED_RULES) as (keyof RuleEdits)[]).some((key) => plan.rules[key] !== PUBLISHED_RULES[key]);
  const past = (dateYm: string) => (monthIndex(start, dateYm) ?? 0) < 0;

  return (
    <div className="tool">
      <section>
        <h2>People</h2>
        <div>
          <span className="ctl-label" id="fc-mode">
            Plan for
          </span>
          <div className="seg" role="group" aria-labelledby="fc-mode">
            <button type="button" aria-pressed={!plan.couple} onClick={() => set('couple', false)}>
              One person
            </button>
            <button type="button" aria-pressed={plan.couple} onClick={() => set('couple', true)}>
              Couple
            </button>
          </div>
        </div>
        {plan.people.slice(0, count).map((p, i) => {
          const id = `fc-p${i}`;
          const c = monthlyContribution(p.salary, ages0[i] ?? 0, rules);
          return (
            <div className="panel" key={i}>
              <h3>{name(i)}</h3>
              <div className="controls">
                <NumField
                  id={`${id}-by`}
                  label="Birth year"
                  value={p.birthYear}
                  min={thisYear - 100}
                  onChange={(v) => setPerson(i, { birthYear: Math.round(v) })}
                  presets={[25, 30, 35, 40, 45, 50].map((age) => ({ label: `Age ${age}`, value: thisYear - age }))}
                />
                <div>
                  <label htmlFor={`${id}-bm`}>Birth month</label>
                  <select id={`${id}-bm`} value={p.birthMonth} onChange={(e) => setPerson(i, { birthMonth: Number(e.target.value) })}>
                    {MONTHS.map((m, j) => (
                      <option key={m} value={j + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <NumField money id={`${id}-liq`} label="Liquid portfolio (S$)" value={p.liquid} step={1000} onChange={(v) => setPerson(i, { liquid: v })} presets={k([0, 50000, 100000, 250000, 500000])} />
                <NumField money id={`${id}-oa`} label="CPF OA cash (S$)" value={p.oa} step={1000} onChange={(v) => setPerson(i, { oa: v })} presets={k([20000, 50000, 100000, 200000])} />
                <NumField money id={`${id}-is`} label="CPFIS-invested amount (S$)" value={p.cpfis} step={1000} onChange={(v) => setPerson(i, { cpfis: v })} presets={k([0, 20000, 50000, 100000])} />
                <NumField money id={`${id}-sa`} label="CPF Special Account (S$)" value={p.sa} step={1000} onChange={(v) => setPerson(i, { sa: v })} presets={k([20000, 50000, 100000, 200000])} />
                <NumField money id={`${id}-ma`} label="CPF MediSave (S$)" value={p.ma} step={1000} onChange={(v) => setPerson(i, { ma: v })} presets={k([20000, 40000, 60000, BHS.value])} />
                <NumField money id={`${id}-sal`} label="Monthly gross salary (S$)" value={p.salary} step={100} onChange={(v) => setPerson(i, { salary: v })} presets={k([0, 4000, 6000, 8000, 10000, 12000])} />
                <NumField money id={`${id}-inv`} label="Invested each month (S$)" value={p.monthlyInvest} step={100} onChange={(v) => setPerson(i, { monthlyInvest: v })} presets={k([500, 1000, 2000, 3000, 5000])} />
              </div>
              <p className="note">
                Age now: {ageText(ages0[i] ?? 0)}. CPF contributions at this salary: {sgd(c.total)} a month ({sgd(c.oa)} to OA,{' '}
                {sgd(c.sa)} to the {(ages0[i] ?? 0) > 55 * 12 ? 'Retirement' : 'Special'} Account, {sgd(c.ma)} to MediSave), of which{' '}
                {sgd(c.employee)} comes out of your pay. If you are already past 55, enter your Retirement Account
                balance as the Special Account.
              </p>
              {p.salary > 0 && p.salary <= 750 && (
                <p className="warn">Salaries of S$750 a month or less use lower graduated rates. This tool applies the full rates, so contributions are overstated.</p>
              )}
            </div>
          );
        })}
        {plan.couple && <p className="note">For a couple, both liquid portfolios are treated as one pot that pays the household spending. CPF stays separate for each person.</p>}
      </section>

      <section>
        <h2>Returns and spending</h2>
        <div className="panel">
          <div className="controls">
            <NumField id="fc-ret" label="Expected return (% a year)" value={plan.returnPct} step={0.1} min={-50} onChange={(v) => set('returnPct', v)} presets={pctChips([5, 7, 9])} />
            <NumField id="fc-inf" label="Inflation (% a year)" value={plan.inflationPct} step={0.1} min={-50} onChange={(v) => set('inflationPct', v)} presets={pctChips([2, 2.5, 3])} />
            <NumField money id="fc-spend" label="Household spending a year (S$, today’s dollars)" value={plan.annualSpend} step={1000} onChange={(v) => set('annualSpend', v)} presets={k([36000, 48000, 60000, 72000, 96000])} />
            <NumField id="fc-wr" label="Withdrawal rate (% a year)" value={plan.withdrawalRatePct} step={0.1} onChange={(v) => set('withdrawalRatePct', v)} presets={pctChips([3, 3.5, 4, 4.5])} />
          </div>
          <p className="note">
            Everything on this page is in today’s dollars. The expected return and the CPF interest rates are entered
            before inflation; the model takes inflation off each of them every month, so a {plan.returnPct}% return with{' '}
            {plan.inflationPct}% inflation grows your buying power by about{' '}
            {(((1 + plan.returnPct / 100) / (1 + plan.inflationPct / 100) - 1) * 100).toFixed(1)}% a year. Salary, monthly investing and spending are
            assumed to keep pace with inflation.
          </p>
          <div className="controls">
            <div>
              <span className="ctl-label" id="fc-stop">
                Stop work
              </span>
              <div className="seg" role="group" aria-labelledby="fc-stop">
                <button type="button" aria-pressed={plan.stopMode === 'earliest'} onClick={() => set('stopMode', 'earliest')}>
                  At the earliest age found
                </button>
                <button type="button" aria-pressed={plan.stopMode === 'age'} onClick={() => set('stopMode', 'age')}>
                  At an age I choose
                </button>
              </div>
            </div>
            {plan.stopMode === 'age' && (
              <NumField id="fc-stopage" label={plan.couple ? 'Person 1’s age when you both stop work' : 'Age when you stop work'} value={plan.stopAge} onChange={(v) => set('stopAge', v)} presets={[40, 45, 50, 55, 60]} />
            )}
          </div>
          <Toggle id="fc-cpfis" label="Invest OA surplus through CPFIS" checked={plan.investOaSurplus} onChange={(v) => set('investOaSurplus', v)} />
          {plan.investOaSurplus && (
            <div className="controls">
              <NumField id="fc-fee" label="CPFIS fees (% a year, taken off the return)" value={plan.cpfisFeePct} step={0.1} onChange={(v) => set('cpfisFeePct', v)} presets={pctChips([0, 0.3, 0.5, 1])} />
            </div>
          )}
          <p className="note">
            With this on, any OA cash above {sgd(plan.rules.cpfisOaFloor)} moves into CPFIS investments each month until 55. The
            first {sgd(plan.rules.cpfisOaFloor)} of OA cannot be invested. When CPFIS investments are sold the money goes back to OA,
            not to your bank account.
          </p>
        </div>
      </section>

      <section>
        <h2>Events</h2>
        <p className="note">All optional. Switch on the ones that apply and set a date.</p>

        <details className="panel" open={plan.bto.on}>
          <summary>
            <strong>BTO key collection and mortgage</strong> ({plan.bto.on ? `on, ${past(plan.bto.date) ? 'already running' : plan.bto.date}` : 'off'})
          </summary>
          <Toggle id="fc-bto-on" label="Include a flat purchase" checked={plan.bto.on} onChange={(v) => setBto({ on: v })} />
          <div className="controls">
            <MonthField id="fc-bto-date" label="Key collection" value={plan.bto.date} onChange={(v) => setBto({ date: v })} fromYear={thisYear - 30} toYear={thisYear + 40} yearsAhead={[0, 1, 2, 3, 5]} thisYear={thisYear} />
            <NumField money id="fc-bto-dp" label="Downpayment from OA (S$)" value={plan.bto.downpaymentOa} step={1000} onChange={(v) => setBto({ downpaymentOa: v })} presets={k([0, 20000, 50000, 100000])} />
            <NumField money id="fc-bto-loan" label="Loan amount (S$)" value={plan.bto.loanAmount} step={1000} onChange={(v) => setBto({ loanAmount: v })} presets={k([200000, 300000, 400000, 500000])} />
            <NumField id="fc-bto-rate" label="Loan interest (% a year)" value={plan.bto.ratePct} step={0.05} onChange={(v) => setBto({ ratePct: v })} presets={pctChips([2.6, 3, 3.5])} />
            <NumField id="fc-bto-ten" label="Loan tenure (years)" value={plan.bto.tenureYears} onChange={(v) => setBto({ tenureYears: v })} presets={[15, 20, 25, 30]} />
            <NumField
              money
              id="fc-bto-inst"
              label="Monthly instalment (S$), 0 to work it out"
              value={plan.bto.instalment}
              step={50}
              onChange={(v) => setBto({ instalment: v })}
              presets={[{ label: 'Work it out', value: 0 }, ...k([1000, 1500, 2000, 2500])]}
            />
          </div>
          {plan.bto.on && (
            <p className="note">
              Instalment used: {calc.sim.instalment > 0 ? `${sgd(calc.sim.instalment)} a month for ${plan.bto.tenureYears} years from key collection` : 'n/a: enter a loan amount and tenure, or an instalment'}.
            </p>
          )}
          <p className="note">
            The downpayment comes from OA, shared equally for a couple. If OA cash is short, CPFIS investments are sold
            into OA to cover it, then the liquid portfolio pays the rest. Each instalment is paid from OA first; if OA
            is short the liquid portfolio pays the remainder, and the year-by-year table says so. A key collection date
            in the past means the loan is already running: no downpayment is taken and the instalment applies from now. Instalments are paid on top of the household spending figure, so leave the mortgage out of that figure.
          </p>
        </details>

        <details className="panel" open={plan.reno.on}>
          <summary>
            <strong>Renovation</strong> ({plan.reno.on ? `on, ${plan.reno.date}` : 'off'})
          </summary>
          <Toggle id="fc-reno-on" label="Include a renovation" checked={plan.reno.on} onChange={(v) => setReno({ on: v })} />
          <div className="controls">
            <MonthField id="fc-reno-date" label="Paid in" value={plan.reno.date} onChange={(v) => setReno({ date: v })} fromYear={thisYear} toYear={thisYear + 40} yearsAhead={[0, 1, 2, 3, 5]} thisYear={thisYear} />
            <NumField money id="fc-reno-amt" label="Cash cost (S$)" value={plan.reno.amount} step={1000} onChange={(v) => setReno({ amount: v })} presets={k([30000, 50000, 80000, 100000])} />
          </div>
          <p className="note">Taken from the liquid portfolio in one go. CPF cannot be used for renovation.</p>
          {plan.reno.on && past(plan.reno.date) && <p className="warn">This date is in the past, so nothing is taken.</p>}
        </details>

        <details className="panel" open={plan.people.slice(0, count).some((p) => p.exitOn)}>
          <summary>
            <strong>Job exit</strong> ({plan.people.slice(0, count).some((p) => p.exitOn) ? 'on' : 'off'})
          </summary>
          <p className="note">
            Leaving employment before you stop work for good, for example to freelance. Salary CPF contributions stop
            from this date; monthly investing carries on unless you also set a reduced-investing period.
          </p>
          {plan.people.slice(0, count).map((p, i) => {
            const id = `fc-exit${i}`;
            const exitAge = Math.floor(((ages0[i] ?? 0) + Math.max(0, monthIndex(start, p.exitDate) ?? 0)) / 12);
            const table = sepMedisave(p.sepIncome, exitAge, rules.sep);
            return (
              <div key={i}>
                {plan.couple && <p className="ctl-label">{name(i)}</p>}
                <Toggle id={`${id}-on`} label={`${name(i)}: include a job exit`} checked={p.exitOn} onChange={(v) => setPerson(i, { exitOn: v })} />
                <div className="controls">
                  <MonthField id={`${id}-date`} label={`${name(i)}: last month of employment ends before`} value={p.exitDate} onChange={(v) => setPerson(i, { exitDate: v })} fromYear={thisYear - 30} toYear={thisYear + 50} yearsAhead={[1, 2, 3, 5, 10]} thisYear={thisYear} />
                </div>
                <Toggle id={`${id}-sep`} label={`${name(i)}: self-employed after that (only MediSave contributions continue)`} checked={p.selfEmployed} onChange={(v) => setPerson(i, { selfEmployed: v })} />
                {p.selfEmployed && (
                  <div className="controls">
                    <NumField money id={`${id}-nti`} label={`${name(i)}: net trade income a year (S$)`} value={p.sepIncome} step={1000} onChange={(v) => setPerson(i, { sepIncome: v })} presets={k([30000, 60000, 100000])} />
                    <NumField
                      money
                      id={`${id}-ma`}
                      label={`${name(i)}: MediSave contribution a year (S$)`}
                      value={p.sepMedisaveAnnual}
                      step={100}
                      onChange={(v) => setPerson(i, { sepMedisaveAnnual: v })}
                      presets={[{ label: `2026 table for this income: ${sgd(table)}`, value: Math.round(table) }]}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <p className="note">
            Self-employed people must contribute to MediSave only, based on yearly net trade income and age. Enter your
            income and press the button to fill in the amount from the 2026 table (using your age at the exit date), or
            type your own. The contribution is assumed to be paid from income outside this plan and stops when you stop
            work.
          </p>
        </details>

        <details className="panel" open={plan.reduced.on}>
          <summary>
            <strong>Period of reduced investing</strong> ({plan.reduced.on ? `on, ${plan.reduced.start} to ${plan.reduced.end}` : 'off'})
          </summary>
          <Toggle id="fc-red-on" label="Include a period of reduced investing" checked={plan.reduced.on} onChange={(v) => setReduced({ on: v })} />
          <div className="controls">
            <MonthField id="fc-red-start" label="From" value={plan.reduced.start} onChange={(v) => setReduced({ start: v })} fromYear={thisYear} toYear={thisYear + 50} yearsAhead={[0, 1, 2, 3, 5]} thisYear={thisYear} />
            <MonthField id="fc-red-end" label="To the end of" value={plan.reduced.end} onChange={(v) => setReduced({ end: v })} fromYear={thisYear} toYear={thisYear + 50} yearsAhead={[1, 2, 3, 5, 10]} thisYear={thisYear} />
            <NumField money id="fc-red-amt" label={plan.couple ? 'Household investing each month in that period (S$)' : 'Invested each month in that period (S$)'} value={plan.reduced.monthly} step={100} onChange={(v) => setReduced({ monthly: v })} presets={k([0, 500, 1000, 1500])} />
          </div>
          {plan.reduced.on && (monthIndex(start, plan.reduced.end) ?? 0) < (monthIndex(start, plan.reduced.start) ?? 0) && (
            <p className="warn">The end is before the start, so this period has no effect.</p>
          )}
        </details>
      </section>

      <section>
        <h2>Assumptions</h2>
        <div className="panel">
          <div>
            <span className="ctl-label" id="fc-rs">
              Set aside in the Retirement Account at 55
            </span>
            <div className="seg" role="group" aria-labelledby="fc-rs">
              <button type="button" aria-pressed={plan.retirementSum === 'frs'} onClick={() => set('retirementSum', 'frs')}>
                Full Retirement Sum
              </button>
              <button type="button" aria-pressed={plan.retirementSum === 'brs'} onClick={() => set('retirementSum', 'brs')}>
                Basic Retirement Sum (own a property)
              </button>
            </div>
          </div>
          <p className="note">
            At 55 the Special Account closes. The model sells CPFIS investments into OA, moves Special Account then OA
            savings into the Retirement Account up to the sum chosen here, and moves whatever is left to the liquid
            portfolio. If your savings do not reach the sum, only {sgd(WITHDRAWAL_RULE.value.minimum)} comes out.
          </p>
        </div>

        <details className="panel">
          <summary>
            <strong>CPF rates used</strong> ({rulesChanged ? 'changed from the published values' : `as published, checked ${FRS_BY_YEAR.asOf}`})
          </summary>
          <p className="note">CPF rules change. If a figure here is out of date, correct it and the plan updates.</p>
          <div className="controls">
            <NumField id="fc-r-oa" label="OA interest (% a year)" value={plan.rules.oaRatePct} step={0.1} onChange={(v) => setRule({ oaRatePct: v })} presets={published('oaRatePct', 'pct')} />
            <NumField id="fc-r-sm" label="Special, MediSave and Retirement Account interest (% a year)" value={plan.rules.smraRatePct} step={0.1} onChange={(v) => setRule({ smraRatePct: v })} presets={published('smraRatePct', 'pct')} />
            <NumField id="fc-r-ex" label="Extra interest on the first S$60,000, below 55 (% a year)" value={plan.rules.extraPct} step={0.1} onChange={(v) => setRule({ extraPct: v })} presets={published('extraPct', 'pct')} />
            <NumField id="fc-r-rate" label="Contribution rate at 55 and below (% of wages, employer plus employee)" value={plan.rules.ratePct55} step={0.5} onChange={(v) => setRule({ ratePct55: v })} presets={published('ratePct55', 'pct')} />
            <NumField money id="fc-r-ow" label="Ordinary wage ceiling (S$ a month)" value={plan.rules.owCeiling} step={100} onChange={(v) => setRule({ owCeiling: v })} presets={published('owCeiling', 'sgd')} />
            <NumField money id="fc-r-floor" label="OA that cannot be invested (S$)" value={plan.rules.cpfisOaFloor} step={1000} onChange={(v) => setRule({ cpfisOaFloor: v })} presets={published('cpfisOaFloor', 'sgd')} />
            <NumField money id="fc-r-frs" label={`Full Retirement Sum, ${rules.frsBaseYear} (S$)`} value={plan.rules.frs} step={100} onChange={(v) => setRule({ frs: v })} presets={published('frs', 'sgd')} />
            <NumField money id="fc-r-brs" label={`Basic Retirement Sum, ${rules.frsBaseYear} (S$)`} value={plan.rules.brs} step={100} onChange={(v) => setRule({ brs: v })} presets={published('brs', 'sgd')} />
            <NumField id="fc-r-grow" label="Yearly rise in the retirement sums (%, before inflation)" tag={FRS_GROWTH_PCT.verified ? null : unverified} value={plan.rules.frsGrowthPct} step={0.1} onChange={(v) => setRule({ frsGrowthPct: v })} presets={[{ label: `From 2026 to 2027: ${PUBLISHED_RULES.frsGrowthPct}%`, value: PUBLISHED_RULES.frsGrowthPct }, { label: 'Same as inflation', value: plan.inflationPct }]} />
            <NumField money id="fc-r-bhs" label="Basic Healthcare Sum (S$)" value={plan.rules.bhs} step={100} onChange={(v) => setRule({ bhs: v })} presets={published('bhs', 'sgd')} />
            <NumField id="fc-r-pay" label="Age from which the Retirement Account can pay spending" tag={PAYOUT_AGE.verified ? null : unverified} value={plan.rules.payoutAge} onChange={(v) => setRule({ payoutAge: v })} presets={published('payoutAge', 'age')} />
          </div>
          <button type="button" className="btn" onClick={() => set('rules', PUBLISHED_RULES)} disabled={!rulesChanged}>
            Reset to the published values
          </button>
          <p className="note">
            Contribution rates above 55 and the split between accounts are in the table below and cannot be changed here.
            Figures marked {unverified} could not be confirmed on cpf.gov.sg.
          </p>
        </details>

        <details className="panel">
          <summary>
            <strong>Where each CPF rule comes from</strong>
          </summary>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th className="wrap-cell">Rule</th>
                  <th className="wrap-cell">Published value</th>
                  <th>Checked on</th>
                  <th>Status</th>
                  <th className="wrap-cell">Note and source</th>
                </tr>
              </thead>
              <tbody>
                {CPF_RULES.map((r) => (
                  <tr key={r.label}>
                    <td className="wrap-cell">{r.label}</td>
                    <td className="wrap-cell">{ruleText(r)}</td>
                    <td>{r.asOf}</td>
                    <td>{r.verified ? 'Confirmed' : unverified}</td>
                    <td className="wrap-cell">
                      {r.note ? `${r.note} ` : ''}
                      <a href={r.source}>Source</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <Results plan={plan} inputs={inputs} calc={calc} />

      <section>
        <button type="button" className="btn" onClick={() => setSaved(defaultPlan(start))}>
          Reset all inputs to the examples
        </button>
        <p className="note">Your inputs are saved in this browser only. The starting figures are examples, not advice or anyone’s real numbers.</p>
      </section>
    </div>
  );
}
