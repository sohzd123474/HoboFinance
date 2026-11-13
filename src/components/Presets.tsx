// Quick-pick buttons that sit under an input. The input stays editable; these
// only fill it in. Use on every numeric input that has sensible common values.

export interface Preset {
  label: string;
  value: number;
}

export function Presets({
  label,
  options,
  current,
  onPick,
}: {
  /** What the buttons set, for screen readers, e.g. "Expected return". */
  label: string;
  options: (Preset | number)[];
  current: number;
  onPick: (value: number) => void;
}) {
  return (
    <div className="chips" role="group" aria-label={`${label}: common values`}>
      {options.map((o) => {
        const p = typeof o === 'number' ? { label: o.toLocaleString('en-SG'), value: o } : o;
        return (
          <button key={p.label} type="button" aria-pressed={current === p.value} onClick={() => onPick(p.value)}>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
