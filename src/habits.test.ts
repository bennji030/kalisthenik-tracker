import { describe, expect, it } from 'vitest';
import { dotGrid, lastDayKeys, sessionDayKeys, weekDayCount, weekSessionCount } from './habits';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const done = (ts: number) => ({ startedAt: ts, finishedAt: ts + 3600e3 });

describe('lastDayKeys', () => {
  it('has 30 days, oldest first, today last', () => {
    const k = lastDayKeys(at(2026, 6, 15));
    expect(k).toHaveLength(30);
    expect(k[0]).toBe('2026-05-17');
    expect(k[29]).toBe('2026-06-15');
  });
  it('crosses a month boundary', () => {
    const k = lastDayKeys(at(2026, 3, 5));
    expect(k).toContain('2026-02-28');
    expect(k).toContain('2026-03-01');
    expect(k[0]).toBe('2026-02-04');
  });
  it('crosses a year boundary', () => {
    const k = lastDayKeys(at(2026, 1, 10));
    expect(k[0]).toBe('2025-12-12');
    expect(k).toContain('2025-12-31');
    expect(k).toContain('2026-01-01');
  });
  it('crosses the DST change of 29.03.2026 with 30 distinct consecutive days', () => {
    const k = lastDayKeys(at(2026, 4, 10, 0, 30));
    expect(new Set(k).size).toBe(30);
    expect(k).toContain('2026-03-28');
    expect(k).toContain('2026-03-29');
    expect(k).toContain('2026-03-30');
    expect(k[0]).toBe('2026-03-12');
    expect(k[29]).toBe('2026-04-10');
  });
});

describe('sessions and grid', () => {
  const now = at(2026, 6, 17);
  it('late evening counts on its local day', () => {
    const days = sessionDayKeys([done(at(2026, 6, 16, 23, 30))]);
    expect([...days]).toEqual(['2026-06-16']);
    const g = dotGrid(days, now);
    expect(g[28]).toBe(true);
    expect(g.filter(Boolean)).toHaveLength(1);
  });
  it('ignores unfinished sessions', () => {
    const days = sessionDayKeys([{ startedAt: at(2026, 6, 17), finishedAt: null }]);
    expect(days.size).toBe(0);
    expect(weekSessionCount([{ startedAt: at(2026, 6, 17, 8), finishedAt: null }], now)).toBe(0);
  });
  it('two sessions on one day: count 2, one dot', () => {
    const s = [done(at(2026, 6, 17, 8)), done(at(2026, 6, 17, 10))];
    expect(weekSessionCount(s, at(2026, 6, 17, 18))).toBe(2);
    expect(dotGrid(sessionDayKeys(s), now).filter(Boolean)).toHaveLength(1);
  });
  it('empty input', () => {
    expect(dotGrid(new Set(), now)).toEqual(Array(30).fill(false));
    expect(weekDayCount(new Set(), now)).toBe(0);
    expect(weekSessionCount([], now)).toBe(0);
  });
});

describe('current week Mo-So', () => {
  // 2026-06-15 is a Monday, 2026-06-21 a Sunday
  const days = new Set(['2026-06-14', '2026-06-15', '2026-06-17', '2026-06-21', '2026-06-22']);
  it('Monday: only Monday counts, last Sunday does not', () => {
    expect(weekDayCount(days, at(2026, 6, 15, 9))).toBe(1);
  });
  it('mid-week', () => {
    expect(weekDayCount(days, at(2026, 6, 17, 9))).toBe(2);
  });
  it('Sunday: full week, next Monday is not counted', () => {
    expect(weekDayCount(days, at(2026, 6, 21, 22))).toBe(3);
  });
  it('future keys are not counted', () => {
    expect(weekDayCount(new Set(['2026-06-18', '2026-06-19']), at(2026, 6, 17))).toBe(0);
  });
  it('session counts per week, last Sunday excluded', () => {
    const s = [done(at(2026, 6, 14, 23, 30)), done(at(2026, 6, 15, 0, 10)), done(at(2026, 6, 17, 7))];
    expect(weekSessionCount(s, at(2026, 6, 17, 20))).toBe(2);
    expect(weekSessionCount(s, at(2026, 6, 21, 22))).toBe(2);
  });
});
