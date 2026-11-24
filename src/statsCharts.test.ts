import { describe, expect, it } from 'vitest';
import type { DayValues } from './db';
import { cardioWeeks, dayBars, weightWeek, weightWeekChange } from './statsCharts';

const NOW = new Date(2026, 2, 4, 12, 0).getTime(); // Mi 4. März 2026
const w = (date: string, kg: number) => ({ date, kg });
const row = (date: string, v: Partial<DayValues> = {}): DayValues => ({ date, source: 'manual', updatedAt: 1, ...v });
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min).getTime();
const cardio = (startedAt: number, finished = true) => ({ startedAt, finishedAt: finished ? startedAt + 1000 : null, kind: 'cardio' as const });

describe('weightWeek', () => {
  it('keeps the last 7 days, today included, sorted ascending', () => {
    const r = weightWeek([w('2026-03-04', 85), w('2026-02-26', 86), w('2026-02-25', 87), w('2026-03-05', 80)], NOW);
    expect(r.map((e) => e.date)).toEqual(['2026-02-26', '2026-03-04']);
  });
  it('is empty for empty input', () => {
    expect(weightWeek([], NOW)).toEqual([]);
  });
});

describe('weightWeekChange', () => {
  it('is null with 0 or 1 entries', () => {
    expect(weightWeekChange([])).toBeNull();
    expect(weightWeekChange([w('2026-03-04', 85)])).toBeNull();
  });
  it('is newest minus oldest, rounded', () => {
    expect(weightWeekChange([w('2026-03-01', 85.5), w('2026-03-04', 85.1)])).toBe(-0.4);
    expect(weightWeekChange([w('2026-03-01', 85), w('2026-03-02', 90), w('2026-03-04', 85.34)])).toBe(0.3);
  });
});

describe('dayBars', () => {
  it('gives 7 items, today last, null gaps and keeps 0', () => {
    const bars = dayBars([row('2026-03-04', { kcal: 2000 }), row('2026-03-03', { kcal: 0 }), row('2026-03-02', { steps: 5 })], 'kcal', NOW);
    expect(bars).toHaveLength(7);
    expect(bars[6]).toEqual({ date: '2026-03-04', value: 2000 });
    expect(bars[5].value).toBe(0);
    expect(bars[4].value).toBeNull();
    expect(bars[0].date).toBe('2026-02-26');
  });
  it('reads the protein field and handles no rows', () => {
    expect(dayBars([row('2026-03-04', { proteinG: 150 })], 'proteinG', NOW)[6].value).toBe(150);
    expect(dayBars([], 'kcal', NOW).every((b) => b.value === null)).toBe(true);
  });
});

describe('cardioWeeks', () => {
  it('gives 8 Mondays, current week last', () => {
    const r = cardioWeeks([], NOW);
    expect(r).toHaveLength(8);
    expect(r[7].start).toBe('2026-03-02');
    expect(r[0].start).toBe('2026-01-12');
    expect(r.every((x) => x.count === 0)).toBe(true);
  });
  it('counts Sunday 23:00 to its week and Monday 00:30 to the next', () => {
    const r = cardioWeeks([cardio(at(2026, 2, 1, 23)), cardio(at(2026, 2, 2, 0, 30))], NOW);
    expect(r[6]).toEqual({ start: '2026-02-23', count: 1 });
    expect(r[7]).toEqual({ start: '2026-03-02', count: 1 });
  });
  it('ignores sessions older than 8 weeks, strength and unfinished', () => {
    const r = cardioWeeks([
      cardio(at(2026, 0, 11, 12)),
      cardio(at(2026, 2, 3), false),
      { startedAt: at(2026, 2, 3), finishedAt: at(2026, 2, 3) + 1000 },
    ], NOW);
    expect(r.reduce((n, x) => n + x.count, 0)).toBe(0);
  });
  it('counts several in one week', () => {
    expect(cardioWeeks([cardio(at(2026, 2, 2)), cardio(at(2026, 2, 4))], NOW)[7].count).toBe(2);
  });
});
