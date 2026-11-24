import { describe, expect, it } from 'vitest';
import { entryDayFor } from './entryDay';

describe('entryDayFor', () => {
  it('returns a valid day for the matching session', () => {
    expect(entryDayFor({ sessionId: 's1', day: '2026-03-14' }, 's1')).toBe('2026-03-14');
  });
  it('rejects a wrong sessionId', () => {
    expect(entryDayFor({ sessionId: 's2', day: '2026-03-14' }, 's1')).toBeNull();
  });
  it('rejects bad formats and non-existent dates', () => {
    for (const day of ['2026-1-5', 'abc', 20260314, '2026-02-30']) {
      expect(entryDayFor({ sessionId: 's1', day: day as string }, 's1')).toBeNull();
    }
  });
  it('rejects null and undefined', () => {
    expect(entryDayFor(null, 's1')).toBeNull();
    expect(entryDayFor(undefined, 's1')).toBeNull();
  });
});
