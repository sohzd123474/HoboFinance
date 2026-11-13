// Thousands separators for money typed into a text box.

/** "10000" becomes "10,000"; "1234.5" becomes "1,234.5". Anything that is not a digit or the first dot is dropped. */
export function formatAmount(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  const whole = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, '');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (dot === -1) return grouped;
  return `${grouped || '0'}.${cleaned.slice(dot + 1).replace(/\./g, '')}`;
}

/** The number in a formatted amount; an empty or unreadable box counts as 0. */
export function parseAmount(text: string): number {
  const n = parseFloat(text.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}
