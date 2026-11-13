import { useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { formatAmount, parseAmount } from '../lib/amount';

// A text input for money that shows thousands separators as you type
// (10000 becomes 10,000). Use it for every dollar amount instead of
// <input type="number">, which cannot display commas.

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (value: number) => void;
};

export function MoneyInput({ value, onChange, ...rest }: Props) {
  const [text, setText] = useState(() => formatAmount(String(value)));
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  // Follow changes made elsewhere (quick-pick buttons, reset, import).
  useEffect(() => {
    if (parseAmount(text) !== value) setText(formatAmount(String(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Put the caret back after the same number of digits it was after before formatting.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && caret.current !== null) {
      let seen = 0;
      let pos = 0;
      while (pos < text.length && seen < caret.current) {
        if (/[\d.]/.test(text[pos])) seen++;
        pos++;
      }
      el.setSelectionRange(pos, pos);
      caret.current = null;
    }
  }, [text]);

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        const before = raw.slice(0, e.target.selectionStart ?? raw.length);
        caret.current = before.replace(/[^\d.]/g, '').length;
        const next = formatAmount(raw);
        setText(next);
        onChange(parseAmount(next));
      }}
    />
  );
}
