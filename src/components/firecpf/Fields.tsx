import type { ReactNode } from 'react';
import { MoneyInput } from '../MoneyInput';
import { Presets, type Preset } from '../Presets';
import { num } from '../../lib/storage';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2031-03" to "Mar 2031". */
export const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1] ?? ''} ${ym.slice(0, 4)}`.trim();

/** Short dollar labels for quick-pick buttons: 50000 to "50k". */
export const k = (values: number[]): Preset[] =>
  values.map((value) => ({
    label: value >= 1e6 ? `${value / 1e6}M` : value >= 10000 ? `${value / 1000}k` : value.toLocaleString('en-SG'),
    value,
  }));

export const pctChips = (values: number[]): Preset[] => values.map((value) => ({ label: `${value}%`, value }));

/** A typed number input with optional quick-pick buttons underneath. */
export function NumField({
  id,
  label,
  value,
  onChange,
  presets,
  step = 1,
  min = 0,
  tag,
  money = false,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  presets?: (Preset | number)[];
  step?: number;
  min?: number;
  /** Marker shown after the label, e.g. "unverified". */
  tag?: ReactNode;
  /** A dollar amount: shown with thousands separators. */
  money?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id}>
        {label} {tag}
      </label>
      {money ? (
        <MoneyInput id={id} value={Number.isFinite(value) ? value : 0} onChange={onChange} />
      ) : (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(num(e.target.value))}
        />
      )}
      {presets && presets.length > 0 && <Presets label={label} options={presets} current={value} onPick={onChange} />}
    </div>
  );
}

/** Year and month pickers for a YYYY-MM value, with optional "in N years" buttons. */
export function MonthField({
  id,
  label,
  value,
  onChange,
  fromYear,
  toYear,
  yearsAhead,
  thisYear,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  fromYear: number;
  toYear: number;
  /** Quick picks, counted in years from `thisYear`. */
  yearsAhead?: number[];
  thisYear?: number;
}) {
  const y = Number(value.slice(0, 4)) || fromYear;
  const m = Number(value.slice(5, 7)) || 1;
  const years: number[] = [];
  for (let yr = Math.min(fromYear, y); yr <= Math.max(toYear, y); yr++) years.push(yr);
  const make = (yr: number, mo: number) => `${yr}-${String(mo).padStart(2, '0')}`;
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <div className="pair">
        <select id={id} value={y} onChange={(e) => onChange(make(Number(e.target.value), m))}>
          {years.map((yr) => (
            <option key={yr} value={yr}>
              {yr}
            </option>
          ))}
        </select>
        <select aria-label={`${label}: month`} value={m} onChange={(e) => onChange(make(y, Number(e.target.value)))}>
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {yearsAhead && thisYear !== undefined && (
        <Presets
          label={label}
          options={yearsAhead.map((n) => ({ label: n === 0 ? 'This year' : `In ${n} ${n === 1 ? 'year' : 'years'}`, value: thisYear + n }))}
          current={y}
          onPick={(yr) => onChange(make(yr, m))}
        />
      )}
    </div>
  );
}

/** A labelled on/off switch. */
export function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
