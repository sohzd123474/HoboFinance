import { describe, expect, it } from 'vitest';
import { formatAmount, parseAmount } from './amount';

describe('formatAmount', () => {
  it('adds thousands separators', () => {
    expect(formatAmount('10000')).toBe('10,000');
    expect(formatAmount('1234567')).toBe('1,234,567');
    expect(formatAmount('999')).toBe('999');
  });

  it('keeps what is being typed after a decimal point', () => {
    expect(formatAmount('1234.')).toBe('1,234.');
    expect(formatAmount('1234.50')).toBe('1,234.50');
    expect(formatAmount('.5')).toBe('0.5');
  });

  it('re-groups text that already has separators or symbols', () => {
    expect(formatAmount('1,0000')).toBe('10,000');
    expect(formatAmount('S$5,000')).toBe('5,000');
    expect(formatAmount('1.2.3')).toBe('1.23');
  });

  it('drops leading zeros but keeps a lone zero and an empty box', () => {
    expect(formatAmount('007')).toBe('7');
    expect(formatAmount('0')).toBe('0');
    expect(formatAmount('')).toBe('');
  });
});

describe('parseAmount', () => {
  it('reads formatted amounts', () => {
    expect(parseAmount('10,000')).toBe(10000);
    expect(parseAmount('1,234.5')).toBe(1234.5);
  });

  it('treats an empty box as zero', () => {
    expect(parseAmount('')).toBe(0);
  });
});
