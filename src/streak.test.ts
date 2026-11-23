import { describe, expect, it } from 'vitest';
import { streak } from './streak';

const done = (y: number, m: number, d: number, h = 12) => {
  const t = new Date(y, m, d, h).getTime();
  return { startedAt: t, finishedAt: t + 3600e3 };
};
// Dienstag 10.11.2026; Woche Mo 9.11., Vorwoche Mo 2.11., davor Mo 26.10.
const now = new Date(2026, 10, 10, 10).getTime();
const week = (mon: number, month = 10, n = 4) =>
  Array.from({ length: n }, (_, i) => done(2026, month, mon + i));

describe('streak', () => {
  it('no sessions → 0', () => expect(streak([], 4, now)).toBe(0));
  it('current week only', () => expect(streak([done(2026, 10, 10, 8)], 4, now)).toBe(1));
  it('one full past week + empty current', () => expect(streak(week(2), 4, now)).toBe(4));
  it('two full past weeks + 2 current', () => {
    const s = [...week(2), ...week(26, 9), done(2026, 10, 9), done(2026, 10, 10, 8)];
    expect(streak(s, 4, now)).toBe(10);
  });
  it('Sunday 23:30 belongs to old week, Monday 00:30 to new', () => {
    const sun = [...week(2).slice(0, 3), done(2026, 10, 8, 23)];
    sun[3] = { startedAt: new Date(2026, 10, 8, 23, 30).getTime(), finishedAt: 1 };
    expect(streak(sun, 4, now)).toBe(4);
    const mon = { startedAt: new Date(2026, 10, 9, 0, 30).getTime(), finishedAt: 1 };
    expect(streak([...week(2).slice(0, 3), mon], 4, now)).toBe(1);
  });
  it('missed past week resets', () => {
    expect(streak([...week(2, 10, 3), ...week(26, 9)], 4, now)).toBe(0);
    expect(streak([...week(2), ...week(26, 9, 3), ...week(19, 9)], 4, now)).toBe(4);
  });
  it('empty past week resets', () => {
    expect(streak([...week(26, 9), done(2026, 10, 10, 8)], 4, now)).toBe(1);
  });
  it('sessions moved within the week still count', () => {
    const s = [done(2026, 10, 7), done(2026, 10, 7, 18), done(2026, 10, 8, 9), done(2026, 10, 8, 18)];
    expect(streak(s, 4, now)).toBe(4);
  });
  it('two sessions on the same day both count', () => {
    expect(streak([done(2026, 10, 10, 7), done(2026, 10, 10, 9)], 4, now)).toBe(2);
  });
  it('more sessions than target all count', () => {
    expect(streak(week(2, 10, 5), 4, now)).toBe(5);
  });
  it('unfinished session ignored', () => {
    expect(streak([{ startedAt: new Date(2026, 10, 10, 8).getTime(), finishedAt: null }], 4, now)).toBe(0);
  });
  it('target changes the result', () => {
    const s = week(2, 10, 4);
    expect(streak(s, 3, now)).toBe(4);
    expect(streak(s, 5, now)).toBe(0);
  });
  it('target 0 behaves like 1', () => {
    const s = [done(2026, 10, 3)];
    expect(streak(s, 0, now)).toBe(streak(s, 1, now));
    expect(streak([], 0, now)).toBe(0);
  });
  it('sessions after the current week are ignored', () => {
    expect(streak([done(2026, 10, 17)], 1, now)).toBe(0);
  });
});
