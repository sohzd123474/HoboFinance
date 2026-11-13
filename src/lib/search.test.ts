import { describe, expect, it } from 'vitest';
import { search, searchIndex } from './search';

const index = searchIndex([{ href: '/blog/x/', title: 'Where your loan repayments go', description: 'Early repayments are mostly interest.' }]);

describe('site search', () => {
  it('lists every page on the path plus the posts', () => {
    expect(index.length).toBeGreaterThan(20);
    expect(index.some((i) => i.href === '/blog/x/')).toBe(true);
  });

  it('finds a page by a word that is only in its keywords', () => {
    expect(search(index, 'mortgage')[0].href).toBe('/calculators/loan-repayment/');
    expect(search(index, 'ssb')[0].href).toBe('/tools/ssb/');
  });

  it('needs every word to match and ignores case', () => {
    expect(search(index, 'CAR loan').map((i) => i.href)).toContain('/calculators/flat-rate-loan/');
    expect(search(index, 'loan zebra')).toEqual([]);
  });

  it('puts title matches first and returns five at most', () => {
    const hits = search(index, 'loan');
    expect(hits.length).toBeLessThanOrEqual(5);
    expect(hits[0].title.toLowerCase()).toContain('loan');
  });

  it('returns nothing for an empty query', () => {
    expect(search(index, '   ')).toEqual([]);
  });
});
