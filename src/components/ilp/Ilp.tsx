import { MoneyInput } from '../MoneyInput';
import { PercentInput } from '../PercentInput';
import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Presets, type Preset } from '../Presets';
import {
  ILP_DEFAULTS,
  ILP_DEFAULT_NOTES,
  RESEARCHED_ON,
  WELCOME_BONUS_BANDS,
  WELCOME_BONUS_TABLE,
  WELCOME_BONUS_YEARS,
  simulateIlp,
  welcomeBonusRate,
  type IlpParams,
} from '../../lib/ilp';
import { num, pct, sgd, useStored } from '../../lib/storage';

type Tab = 'chart' | 'table' | 'fees';
const TABS: { id: Tab; label: string }[] = [
  { id: 'chart', label: 'Chart' },
  { id: 'table', label: 'Yearly table' },
  { id: 'fees', label: 'Fee breakdown' },
];
const IIP_CHOICES = Object.keys(WELCOME_BONUS_TABLE).map(Number);
const YEARS = 30;

const DEFAULTS = {
  basePremium: 6000,
  monthlyTopUp: 0,
  iipYears: 20,
  keepPaying: false,
  grossReturnPct: 6,
  ilpFundFeePct: ILP_DEFAULTS.ilpFundFeePct as number,
  suppChargePct: ILP_DEFAULTS.suppChargePct as number,
  suppChargeYears: ILP_DEFAULTS.suppChargeYears as number,
  suppOnTopUps: false,
  topUpChargePct: ILP_DEFAULTS.topUpChargePct as number,
  /** When true the welcome bonus follows the table for the chosen IIP and premium. */
  bonusFromTable: true,
  welcomeBonusPct: [0, 0, 0],
  specialBonusFromYear: ILP_DEFAULTS.specialBonusFromYear as number,
  specialBonusPct: ILP_DEFAULTS.specialBonusPct as number,
  specialBonusLaterFromYear: ILP_DEFAULTS.specialBonusLaterFromYear as number,
  specialBonusLaterPct: ILP_DEFAULTS.specialBonusLaterPct as number,
  diyTerPct: ILP_DEFAULTS.diyTerPct as number,
  diyCommission: ILP_DEFAULTS.diyCommission as number,
  diyPurchasesPerYear: ILP_DEFAULTS.diyPurchasesPerYear as number,
  tab: 'chart' as Tab,
};
type State = typeof DEFAULTS;

const pctLabel = (v: number): Preset => ({ label: `${v}%`, value: v });
const money = (v: number): Preset => ({ label: v.toLocaleString('en-SG'), value: v });

function Field({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  slider,
  presets,
  unverified,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Show a slider over this range as well as the typed input. */
  slider?: { min: number; max: number; step: number };
  presets?: (Preset | number)[];
  unverified?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id}>
        {label} {unverified && <span className="tag-unsure">unverified</span>}
      </label>
      {label.includes('(S$)') ? (
        <MoneyInput id={id} value={value} onChange={(v) => onChange(Math.max(min, v))} />
      ) : label.includes('(%') ? (
        <PercentInput id={id} value={value} onChange={(v) => onChange(Math.max(min, v))} />
      ) : (
        <input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Math.max(min, num(e.target.value)))} />
      )}
      {slider && (
        <input
          type="range"
          aria-label={`${label}: slider`}
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={Math.min(slider.max, Math.max(slider.min, value))}
          onChange={(e) => onChange(num(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--link)', marginTop: '0.4rem' }}
        />
      )}
      {presets && <Presets label={label} options={presets} current={value} onPick={onChange} />}
    </div>
  );
}

export default function Ilp() {
  const [o, setO] = useStored<State>('ilp', DEFAULTS);
  const set = <K extends keyof State>(k: K, v: State[K]) => setO((prev) => ({ ...prev, [k]: v }));

  const tableRate = welcomeBonusRate(o.iipYears, o.basePremium);
  const manual = Array.from({ length: WELCOME_BONUS_YEARS }, (_, i) => o.welcomeBonusPct[i] ?? 0);
  const welcome = o.bonusFromTable ? Array.from({ length: WELCOME_BONUS_YEARS }, () => tableRate ?? 0) : manual;

  const params: IlpParams = {
    basePremium: o.basePremium,
    monthlyTopUp: o.monthlyTopUp,
    iipYears: o.iipYears,
    keepPaying: o.keepPaying,
    years: YEARS,
    grossReturnPct: o.grossReturnPct,
    ilpFundFeePct: o.ilpFundFeePct,
    suppChargePct: o.suppChargePct,
    suppChargeYears: o.suppChargeYears,
    suppOnTopUps: o.suppOnTopUps,
    topUpChargePct: o.topUpChargePct,
    welcomeBonusPct: welcome,
    specialBonusFromYear: o.specialBonusFromYear,
    specialBonusPct: o.specialBonusPct,
    specialBonusLaterFromYear: o.specialBonusLaterFromYear,
    specialBonusLaterPct: o.specialBonusLaterPct,
    diyTerPct: o.diyTerPct,
    diyCommission: o.diyCommission,
    diyPurchasesPerYear: o.diyPurchasesPerYear,
  };
  const key = JSON.stringify(params);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const r = useMemo(() => simulateIlp(params), [key]);

  const nothingPaid = r.paidIn <= 0;
  const diff = r.ilp.finalValue - r.diy.finalValue;
  const diffPct = r.diy.finalValue > 0 ? diff / r.diy.finalValue : null;
  const chartRows = [{ year: 0, ilp: 0, diy: 0, paidIn: 0 }, ...r.rows.map((x) => ({ year: x.year, ilp: Math.round(x.ilp), diy: Math.round(x.diy), paidIn: Math.round(x.paidIn) }))];
  const unverified = ILP_DEFAULT_NOTES.filter((n) => !n.verified);
  const SERIES: Record<string, string> = { ilp: 'ILP', diy: 'DIY (VWRA)', paidIn: 'Paid in' };

  return (
    <div className="tool">
      <section>
        <h2>Your plan</h2>
        <div className="panel">
          <div className="controls">
            <Field
              id="ilp-premium"
              label="Base premium a year (S$)"
              value={o.basePremium}
              step={100}
              slider={{ min: 0, max: 36000, step: 600 }}
              presets={[2400, 3600, 6000, 12000, 24000].map(money)}
              onChange={(v) => set('basePremium', v)}
            />
            <Field
              id="ilp-topup"
              label="Top-up each month (S$)"
              value={o.monthlyTopUp}
              step={50}
              slider={{ min: 0, max: 3000, step: 50 }}
              presets={[0, 100, 200, 500, 1000].map(money)}
              onChange={(v) => set('monthlyTopUp', v)}
            />
            <Field
              id="ilp-return"
              label="Return before charges (% a year)"
              value={o.grossReturnPct}
              min={-20}
              max={30}
              step={0.1}
              slider={{ min: 0, max: 12, step: 0.5 }}
              presets={[4, 5, 6, 7, 8].map(pctLabel)}
              onChange={(v) => set('grossReturnPct', v)}
            />
            <Field
              id="ilp-fundfee"
              label="ILP fund fee (% a year)"
              value={o.ilpFundFeePct}
              max={10}
              step={0.05}
              slider={{ min: 0, max: 3, step: 0.05 }}
              presets={[1, 1.45, 1.5, 1.75].map(pctLabel)}
              unverified
              onChange={(v) => set('ilpFundFeePct', v)}
            />
            <div>
              <span className="ctl-label" id="ilp-iip">
                Initial investment period
              </span>
              <div className="seg" role="group" aria-labelledby="ilp-iip">
                {IIP_CHOICES.map((y) => (
                  <button key={y} type="button" aria-pressed={o.iipYears === y} onClick={() => set('iipYears', y)}>
                    {y} years
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="check" htmlFor="ilp-keep">
            <input id="ilp-keep" type="checkbox" checked={o.keepPaying} onChange={(e) => set('keepPaying', e.target.checked)} />
            Keep paying after the initial investment period, for all {YEARS} years
          </label>
          <p className="note">
            The ILP is a regular-premium investment-linked policy with charges like those of AIA Pro Achiever 3.0. Every
            charge and bonus can be changed further down, so the tool works for other policies. The base premium is paid at the start of each year and the top-up at the start of each month, for{' '}
            {o.keepPaying ? YEARS : Math.min(o.iipYears, YEARS)} years. The DIY route puts the same cash into VWRA on the same
            dates. Both are then left invested until year {YEARS}.
          </p>
        </div>
      </section>

      <section>
        <h2>Result after {YEARS} years</h2>
        {nothingPaid ? (
          <p className="warn">n/a: enter a base premium or a monthly top-up above zero.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th></th>
                    <th>ILP</th>
                    <th>DIY (VWRA)</th>
                    <th>ILP minus DIY</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Final value</td>
                    <td>{sgd(r.ilp.finalValue)}</td>
                    <td>{sgd(r.diy.finalValue)}</td>
                    <td>
                      {sgd(diff)} ({pct(diffPct)})
                    </td>
                  </tr>
                  <tr>
                    <td>Total charges</td>
                    <td>{sgd(r.ilp.totalCharges)}</td>
                    <td>{sgd(r.diy.totalCharges)}</td>
                    <td>{sgd(r.ilp.totalCharges - r.diy.totalCharges)}</td>
                  </tr>
                  <tr>
                    <td>Paid in</td>
                    <td>{sgd(r.paidIn)}</td>
                    <td>{sgd(r.paidIn)}</td>
                    <td>{sgd(0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="note">
              ILP charges are shown before bonuses of {sgd(r.ilp.welcomeBonus + r.ilp.specialBonus)}, which are already
              included in the ILP’s final value. The percentage is the difference as a share of the DIY value.
            </p>

            <div className="seg" role="group" aria-label="Show">
              {TABS.map((t) => (
                <button key={t.id} type="button" aria-pressed={o.tab === t.id} onClick={() => set('tab', t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {o.tab === 'chart' && (
              <div>
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartRows} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                      <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="year" type="number" domain={[0, YEARS]} ticks={[0, 5, 10, 15, 20, 25, 30]} stroke="var(--ink-soft)" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} />
                      <YAxis
                        width={56}
                        stroke="var(--ink-soft)"
                        tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
                        tickFormatter={(v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`)}
                      />
                      <Tooltip
                        contentStyle={{ background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: 3, color: 'var(--ink)' }}
                        labelFormatter={(y) => `End of year ${y}`}
                        formatter={(value, name) => [sgd(Number(value)), SERIES[String(name)] ?? String(name)]}
                      />
                      <Line dataKey="diy" stroke="var(--c1)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                      <Line dataKey="ilp" stroke="var(--c3)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                      <Line dataKey="paidIn" stroke="var(--ink-soft)" strokeWidth={1.5} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="note">
                  <span className="swatch" style={{ background: 'var(--c1)' }} />
                  DIY (VWRA){' '}
                  <span className="swatch" style={{ background: 'var(--c3)', marginLeft: '0.8em' }} />
                  ILP{' '}
                  <span className="swatch" style={{ background: 'var(--ink-soft)', marginLeft: '0.8em' }} />
                  Paid in (dashed). Account value in S$ at the end of each year.
                </p>
              </div>
            )}

            {o.tab === 'table' && (
              <div className="table-scroll" style={{ maxHeight: '32rem', overflowY: 'auto' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Paid in</th>
                      <th>ILP value</th>
                      <th>DIY value</th>
                      <th>ILP minus DIY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.rows.map((x) => (
                      <tr key={x.year}>
                        <td>{x.year}</td>
                        <td>{sgd(x.paidIn)}</td>
                        <td>{sgd(x.ilp)}</td>
                        <td>{sgd(x.diy)}</td>
                        <td>{sgd(x.ilp - x.diy)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {o.tab === 'fees' && (
              <>
                <div className="table-scroll">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Over {YEARS} years</th>
                        <th>ILP</th>
                        <th>DIY (VWRA)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Supplementary charge</td>
                        <td>{sgd(r.ilp.supplementary)}</td>
                        <td>Does not apply</td>
                      </tr>
                      <tr>
                        <td>Fund fee (ILP) or TER (VWRA)</td>
                        <td>{sgd(r.ilp.fundFee)}</td>
                        <td>{sgd(r.diy.ter)}</td>
                      </tr>
                      <tr>
                        <td>Charge on top-ups</td>
                        <td>{sgd(r.ilp.topUpCharge)}</td>
                        <td>Does not apply</td>
                      </tr>
                      <tr>
                        <td>Brokerage commissions</td>
                        <td>Does not apply</td>
                        <td>{sgd(r.diy.commissions)}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Total charges</strong>
                        </td>
                        <td>
                          <strong>{sgd(r.ilp.totalCharges)}</strong>
                        </td>
                        <td>
                          <strong>{sgd(r.diy.totalCharges)}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td>Welcome bonus received</td>
                        <td>{sgd(r.ilp.welcomeBonus)}</td>
                        <td>Does not apply</td>
                      </tr>
                      <tr>
                        <td>Special bonus received</td>
                        <td>{sgd(r.ilp.specialBonus)}</td>
                        <td>Does not apply</td>
                      </tr>
                      <tr>
                        <td>Return before charges</td>
                        <td>{pct(o.grossReturnPct / 100, 2)}</td>
                        <td>{pct(o.grossReturnPct / 100, 2)}</td>
                      </tr>
                      <tr>
                        <td>Return you actually get a year</td>
                        <td>{r.ilp.irr === null ? 'n/a: the account ends at zero' : pct(r.ilp.irr, 2)}</td>
                        <td>{r.diy.irr === null ? 'n/a: the account ends at zero' : pct(r.diy.irr, 2)}</td>
                      </tr>
                      <tr>
                        <td>Reduction in yield (points a year)</td>
                        <td>{r.ilp.reductionInYield === null ? 'n/a' : (r.ilp.reductionInYield * 100).toFixed(2)}</td>
                        <td>{r.diy.reductionInYield === null ? 'n/a' : (r.diy.reductionInYield * 100).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="note">
                  Charges are the dollars taken out over {YEARS} years, not adjusted for when they were taken. The return
                  you actually get is the money-weighted rate on what you paid in, with bonuses counted. Reduction in
                  yield is the return before charges minus that rate: the yearly return lost to charges, net of bonuses.
                </p>
              </>
            )}
          </>
        )}
      </section>

      <section>
        <h2>Assumptions you can change</h2>
        <div className="panel">
          <h3>ILP bonuses</h3>
          <label className="check" htmlFor="ilp-bonus-auto">
            <input id="ilp-bonus-auto" type="checkbox" checked={o.bonusFromTable} onChange={(e) => set('bonusFromTable', e.target.checked)} />
            Set the welcome bonus from the table below, using the premium and period chosen above
          </label>
          {o.bonusFromTable ? (
            <p>
              Welcome bonus used:{' '}
              <strong>
                {tableRate === null
                  ? `n/a: a base premium of ${sgd(o.basePremium)} is below the lowest band in the table, so no bonus is applied`
                  : `${tableRate}% of the base premium in each of years 1 to ${WELCOME_BONUS_YEARS}`}
              </strong>{' '}
              <span className="tag-unsure">unverified</span>
            </p>
          ) : (
            <div className="controls">
              {manual.map((v, i) => (
                <Field
                  key={i}
                  id={`ilp-wb-${i}`}
                  label={`Welcome bonus, year ${i + 1} (% of base premium)`}
                  value={v}
                  max={200}
                  presets={[0, 10, 25, 45, 60, 75].map(pctLabel)}
                  onChange={(nv) => set('welcomeBonusPct', manual.map((x, j) => (j === i ? nv : x)))}
                />
              ))}
            </div>
          )}
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Base premium a year</th>
                  {IIP_CHOICES.map((y) => (
                    <th key={y}>{y}-year period</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WELCOME_BONUS_BANDS.map((b, i) => (
                  <tr key={b.min}>
                    <td>{b.label}</td>
                    {IIP_CHOICES.map((y) => (
                      <td key={y}>{WELCOME_BONUS_TABLE[y][i]}%</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="controls">
            <Field
              id="ilp-sb-rate"
              label="Special bonus (% of base premium)"
              value={o.specialBonusPct}
              max={100}
              step={0.5}
              presets={[0, 5, 8].map(pctLabel)}
              unverified
              onChange={(v) => set('specialBonusPct', v)}
            />
            <Field id="ilp-sb-from" label="…paid from annual premium number" value={o.specialBonusFromYear} min={1} max={YEARS + 1} presets={[5, 10]} unverified onChange={(v) => set('specialBonusFromYear', Math.round(v))} />
            <Field
              id="ilp-sb2-rate"
              label="Later special bonus (% of base premium)"
              value={o.specialBonusLaterPct}
              max={100}
              step={0.5}
              presets={[0, 5, 8].map(pctLabel)}
              unverified
              onChange={(v) => set('specialBonusLaterPct', v)}
            />
            <Field id="ilp-sb2-from" label="…paid from annual premium number" value={o.specialBonusLaterFromYear} min={1} max={YEARS + 1} presets={[21]} unverified onChange={(v) => set('specialBonusLaterFromYear', Math.round(v))} />
          </div>
          <p className="note">
            Bonuses are added to the account with the premium they belong to. A special bonus is paid only in a year
            when a premium is paid, so with a {o.iipYears}-year period and no further premiums,{' '}
            {o.keepPaying ? 'it is paid every year from the starting number' : `premium number ${o.iipYears} is the last that can earn one`}.
          </p>
        </div>

        <div className="panel">
          <h3>ILP charges</h3>
          <div className="controls">
            <Field
              id="ilp-supp"
              label="Supplementary charge (% a year)"
              value={o.suppChargePct}
              max={20}
              step={0.1}
              presets={[0, 2.5, 3.9].map(pctLabel)}
              unverified
              onChange={(v) => set('suppChargePct', v)}
            />
            <Field id="ilp-supp-years" label="Supplementary charge lasts (years)" value={o.suppChargeYears} max={YEARS} presets={[5, 10, 15, 20]} unverified onChange={(v) => set('suppChargeYears', Math.round(v))} />
            <Field
              id="ilp-topup-charge"
              label="Charge on each top-up (%)"
              value={o.topUpChargePct}
              max={100}
              step={0.5}
              presets={[0, 3, 5].map(pctLabel)}
              unverified
              onChange={(v) => set('topUpChargePct', v)}
            />
          </div>
          <label className="check" htmlFor="ilp-supp-top">
            <input id="ilp-supp-top" type="checkbox" checked={o.suppOnTopUps} onChange={(e) => set('suppOnTopUps', e.target.checked)} />
            Also take the supplementary charge on units bought with top-ups
          </label>
        </div>

        <div className="panel">
          <h3>DIY costs</h3>
          <div className="controls">
            <Field
              id="diy-ter"
              label="VWRA total expense ratio (% a year)"
              value={o.diyTerPct}
              max={10}
              step={0.01}
              presets={[0.07, 0.14, 0.19, 0.22].map(pctLabel)}
              onChange={(v) => set('diyTerPct', v)}
            />
            <Field
              id="diy-comm"
              label="Commission per purchase (S$)"
              value={o.diyCommission}
              step={0.5}
              presets={[0, 1, 2.5, 5, 10]}
              unverified
              onChange={(v) => set('diyCommission', v)}
            />
            <Field id="diy-n" label="Purchases a year" value={o.diyPurchasesPerYear} min={1} max={12} presets={[1, 2, 4, 12]} onChange={(v) => set('diyPurchasesPerYear', Math.min(12, Math.max(1, Math.round(v))))} />
          </div>
          <p className="note">
            Purchases a year only sets how many commissions are paid in each year that money goes in. The money itself
            is treated as invested on the day it is paid, the same as in the ILP.
          </p>
          <button type="button" className="btn" onClick={() => setO({ ...DEFAULTS, tab: o.tab })}>
            Reset everything to the defaults
          </button>
        </div>
      </section>

      <section>
        <h2>What this leaves out</h2>
        <div className="warn">
          <ul>
            <li>
              <strong>Insurance cover.</strong> An ILP may include death or other cover that the DIY route does not. The
              cost of that cover inside the ILP (often called a benefit charge) is not deducted here, and its value is
              not counted either.
            </li>
            <li>
              <strong>Early surrender.</strong> Surrender, partial withdrawal, premium holiday and premium reduction
              charges are not modelled, because no year-by-year schedule could be confirmed. Stopping an ILP during its
              initial investment period usually costs a large part of the account. The figures here assume every
              premium is paid on time.
            </li>
            <li>
              <strong>Currency and tax.</strong> VWRA trades in US dollars. Currency conversion costs, bid-offer spreads
              and dividend withholding tax inside either fund are not modelled.
            </li>
            <li>
              <strong>Different investments.</strong> Both routes are given the same return before charges. In practice
              an ILP’s funds and a world index fund will not return the same.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <h2>Where the defaults come from</h2>
        <p className="note">
          The ILP defaults describe a regular-premium investment-linked policy with charges like those of AIA Pro
          Achiever 3.0. They are taken from write-ups of that product’s published summary dated January 2023. The
          insurer’s own documents could not be opened when this page was researched on {RESEARCHED_ON}, so{' '}
          {unverified.length} of the {ILP_DEFAULT_NOTES.length} defaults below are marked unverified. Check them against
          your own policy illustration and change them above.
        </p>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Item</th>
                <th className="wrap-cell">Default</th>
                <th>Status</th>
                <th className="wrap-cell">Source and notes</th>
              </tr>
            </thead>
            <tbody>
              {ILP_DEFAULT_NOTES.map((n) => (
                <tr key={n.item}>
                  <td>{n.item}</td>
                  <td className="wrap-cell">{n.value}</td>
                  <td>{n.verified ? 'Confirmed' : <span className="tag-unsure">unverified</span>}</td>
                  <td className="wrap-cell">
                    {n.url ? <a href={n.url}>{n.source}</a> : n.source}.{n.note ? ` ${n.note}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
