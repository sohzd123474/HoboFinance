import { useEffect, useState } from 'react';

// Every saved input lives under an "hf:" key so the footer's export and import
// buttons can find them. Storage can be blocked (private windows), so every
// access is wrapped and the page works without it.

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`hf:${key}`);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    // Merge objects so newly added fields pick up their defaults.
    if (fallback && typeof fallback === 'object' && !Array.isArray(fallback) && parsed && typeof parsed === 'object') {
      return { ...fallback, ...parsed };
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function useStored<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readStored(key, fallback));
  useEffect(() => {
    try {
      localStorage.setItem(`hf:${key}`, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

/** Fetch one of the site's own precomputed JSON files. */
export function useJson<T>(url: string): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    let live = true;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => live && setState({ data, error: null }))
      .catch(() => live && setState({ data: null, error: `The data file ${url} could not be loaded. Reload the page to try again.` }));
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}

export const pct = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? 'n/a' : `${(n * 100).toFixed(digits)}%`;

export const usd = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n)
    ? 'n/a'
    : new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'USD', currencyDisplay: 'code', maximumFractionDigits: 0 }).format(n);

export const sgd = (n: number | null | undefined, digits = 0) =>
  n == null || !Number.isFinite(n)
    ? 'n/a'
    : new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);

export const num = (v: string, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};
