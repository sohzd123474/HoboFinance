import { useEffect, useState, type InputHTMLAttributes } from 'react';

// A percentage box with a visible % sign. The number is always in percent:
// type 1 (or 1%) for one percent, 0.03 for three hundredths of a percent.

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (value: number) => void;
};

const parse = (text: string) => {
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : 0;
};

export function PercentInput({ value, onChange, ...rest }: Props) {
  const [text, setText] = useState(String(value));

  // Follow changes made elsewhere (quick-pick buttons, reset, import).
  useEffect(() => {
    if (parse(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className="suffix-wrap">
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          // Keep digits, one dot and a leading minus; a typed % sign is simply dropped.
          let t = e.target.value.replace(/[^\d.-]/g, '').replace(/(?!^)-/g, '');
          const dot = t.indexOf('.');
          if (dot !== -1) t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, '');
          setText(t);
          onChange(parse(t));
        }}
      />
      <span className="suffix" aria-hidden="true">
        %
      </span>
    </span>
  );
}
