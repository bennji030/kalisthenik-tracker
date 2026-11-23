import { describe, expect, it } from 'vitest';
import { dayMonthCount, earliestKey, monthList, sessionMonthCount, sessionSummary, weighSummary } from './monthTiles';

const now = new Date(2026, 10, 23, 12).getTime();

describe('monthList', () => {
  it('gives 3 months without entries, newest first', () => {
    expect(monthList(null, now)).toEqual([{ year: 2026, month: 10 }, { year: 2026, month: 9 }, { year: 2026, month: 8 }]);
  });
  it('lists every month back to an older entry', () => {
    const l = monthList('2026-06-15', now);
    expect(l).toHaveLength(6);
    expect(l[5]).toEqual({ year: 2026, month: 5 });
  });
  it('crosses the year boundary', () => {
    const l = monthList('2026-12-30', new Date(2027, 1, 10).getTime());
    expect(l).toEqual([{ year: 2027, month: 1 }, { year: 2027, month: 0 }, { year: 2026, month: 11 }]);
    expect(monthList('2026-11-30', new Date(2027, 1, 10).getTime())).toHaveLength(4);
  });
  it('keeps 3 months when the entry is in the current month', () => {
    expect(monthList('2026-11-02', now)).toHaveLength(3);
  });
});

describe('earliestKey', () => {
  it('finds the minimum or null', () => {
    expect(earliestKey(new Set(['2026-05-02', '2026-01-09']))).toBe('2026-01-09');
    expect(earliestKey([])).toBeNull();
  });
});

describe('counts', () => {
  const t = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();
  it('counts finished sessions by local start month with boundaries', () => {
    const sessions = [
      { startedAt: t(2026, 10, 1, 0), finishedAt: t(2026, 10, 1, 1) },
      { startedAt: t(2026, 10, 30, 23), finishedAt: t(2026, 11, 1, 1) },
      { startedAt: t(2026, 10, 15), finishedAt: null },
      { startedAt: t(2026, 9, 31, 23), finishedAt: t(2026, 10, 1, 1) },
      { startedAt: t(2026, 11, 1, 0), finishedAt: t(2026, 11, 1, 1) },
    ];
    expect(sessionMonthCount(sessions, 2026, 10)).toBe(2);
    expect(sessionMonthCount(sessions, 2026, 9)).toBe(1);
    expect(sessionMonthCount(sessions, 2026, 8)).toBe(0);
  });
  it('counts days per month', () => {
    const days = new Set(['2026-10-31', '2026-11-01', '2026-11-30', '2026-12-01', '2027-11-05']);
    expect(dayMonthCount(days, 2026, 10)).toBe(2);
    expect(dayMonthCount(days, 2026, 11)).toBe(1);
  });
});

describe('summaries', () => {
  it('handles singular and plural', () => {
    expect(sessionSummary(0)).toBe('0 Trainings');
    expect(sessionSummary(1)).toBe('1 Training');
    expect(sessionSummary(5)).toBe('5 Trainings');
    expect(weighSummary(0)).toBe('0 Tage gewogen');
    expect(weighSummary(1)).toBe('1 Tag gewogen');
    expect(weighSummary(3)).toBe('3 Tage gewogen');
  });
});
