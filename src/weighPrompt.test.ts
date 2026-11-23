import { describe, expect, it } from 'vitest';
import { weighPromptDue } from './weight';

const noon = new Date(2026, 2, 10, 12, 0).getTime();

describe('weighPromptDue', () => {
  it('is due with no entries and no skip', () => {
    expect(weighPromptDue([], null, noon)).toBe(true);
  });
  it('is not due with an entry today', () => {
    expect(weighPromptDue([{ date: '2026-03-10', kg: 82 }], null, noon)).toBe(false);
  });
  it('is due with an entry only yesterday', () => {
    expect(weighPromptDue([{ date: '2026-03-09', kg: 82 }], null, noon)).toBe(true);
  });
  it('is not due when skipped today', () => {
    expect(weighPromptDue([], '2026-03-10', noon)).toBe(false);
  });
  it('is due when skipped yesterday', () => {
    expect(weighPromptDue([], '2026-03-09', noon)).toBe(true);
  });
  it('flips at local midnight', () => {
    const before = new Date(2026, 2, 10, 23, 59, 59).getTime();
    const after = new Date(2026, 2, 11, 0, 0, 1).getTime();
    const weights = [{ date: '2026-03-10', kg: 82 }];
    expect(weighPromptDue(weights, '2026-03-10', before)).toBe(false);
    expect(weighPromptDue(weights, '2026-03-10', after)).toBe(true);
  });
});
