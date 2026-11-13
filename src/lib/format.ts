// Browser-side money formatting with a visitor-chosen currency.

export const CURRENCIES = ['USD', 'SGD', 'EUR', 'GBP', 'AUD', 'CAD', 'INR', 'JPY', 'MYR', 'IDR', 'PHP'] as const;
const KEY = 'hf-currency';
const BY_REGION: Record<string, string> = {
  US: 'USD', SG: 'SGD', GB: 'GBP', AU: 'AUD', CA: 'CAD', IN: 'INR', JP: 'JPY', MY: 'MYR', ID: 'IDR', PH: 'PHP',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR',
};

export function getCurrency(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (CURRENCIES as readonly string[]).includes(saved)) return saved;
  } catch {}
  const region = (navigator.language || '').split('-')[1]?.toUpperCase();
  return (region && BY_REGION[region]) || 'USD';
}

export function setCurrency(code: string) {
  try {
    localStorage.setItem(KEY, code);
  } catch {}
  document.dispatchEvent(new CustomEvent('hf-currency'));
}

export function money(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: getCurrency(),
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(n);
}

export function currencySymbol(): string {
  const parts = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: getCurrency(),
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value ?? '$';
}

export function years(n: number): string {
  const whole = Math.floor(n);
  const months = Math.round((n - whole) * 12);
  const y = `${whole} ${whole === 1 ? 'year' : 'years'}`;
  if (months === 0) return y;
  if (months === 12) return `${whole + 1} years`;
  return `${y} ${months} ${months === 1 ? 'month' : 'months'}`;
}
