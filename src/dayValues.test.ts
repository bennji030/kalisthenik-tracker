import { describe, expect, it } from 'vitest';
import type { DayValues } from './db';
import {
  DEFAULT_GOALS, dayTrend, goalProgress, isDayValuesList, isValidKcal, isValidKcalGoal, isValidProtein,
  isValidProteinGoal, isValidSteps, isValidStepsGoal, mergeDay, parseGoals, stepsWeek,
} from './dayValues';
import { dayTs } from './weight';

const NOW = new Date(2026, 2, 3, 15, 0).getTime(); // Di 3. März 2026

const row = (date: string, v: Partial<DayValues> = {}): DayValues => ({ date, source: 'manual', updatedAt: 1, ...v });

describe('value validators', () => {
  it('accepts whole numbers within the bounds', () => {
    expect(isValidSteps(0)).toBe(true);
    expect(isValidSteps(100000)).toBe(true);
    expect(isValidKcal(0)).toBe(true);
    expect(isValidKcal(10000)).toBe(true);
    expect(isValidProtein(0)).toBe(true);
    expect(isValidProtein(1000)).toBe(true);
  });
  it('rejects values out of range', () => {
    expect(isValidSteps(100001)).toBe(false);
    expect(isValidKcal(10001)).toBe(false);
    expect(isValidProtein(1001)).toBe(false);
  });
  it('rejects negatives, non-integers and non-numbers', () => {
    expect(isValidSteps(-5)).toBe(false);
    expect(isValidSteps(12.5)).toBe(false);
    expect(isValidKcal(-1)).toBe(false);
    expect(isValidKcal(1800.5)).toBe(false);
    expect(isValidProtein(-1)).toBe(false);
    expect(isValidProtein(120.5)).toBe(false);
    expect(isValidSteps(null)).toBe(false);
    expect(isValidSteps('8000')).toBe(false);
    expect(isValidKcal(NaN)).toBe(false);
    expect(isValidProtein(Infinity)).toBe(false);
  });
});

describe('mergeDay', () => {
  it('creates a manual row from nothing', () => {
    expect(mergeDay(undefined, '2026-03-03', { steps: 8432 }, 99)).toEqual({ date: '2026-03-03', steps: 8432, source: 'manual', updatedAt: 99 });
  });
  it('keeps fields missing from the patch and overwrites given ones', () => {
    const existing = row('2026-03-03', { steps: 8432, kcal: 2000 });
    expect(mergeDay(existing, '2026-03-03', { kcal: 1800, proteinG: 120 }, 5)).toEqual({
      date: '2026-03-03', steps: 8432, kcal: 1800, proteinG: 120, source: 'manual', updatedAt: 5,
    });
  });
  it('ignores undefined patch fields', () => {
    const existing = row('2026-03-03', { steps: 8432 });
    expect(mergeDay(existing, '2026-03-03', { steps: undefined }, 5).steps).toBe(8432);
  });
  it('always sets updatedAt and turns a health row into a manual one', () => {
    const existing = row('2026-03-03', { steps: 4000, source: 'health', updatedAt: 1 });
    const m = mergeDay(existing, '2026-03-03', { kcal: 1500 }, 77);
    expect(m.source).toBe('manual');
    expect(m.updatedAt).toBe(77);
    expect(m.steps).toBe(4000);
  });
  it('does not change the existing row', () => {
    const existing = row('2026-03-03', { steps: 1 });
    mergeDay(existing, '2026-03-03', { steps: 2 }, 5);
    expect(existing.steps).toBe(1);
  });
});

describe('stepsWeek', () => {
  it('returns 7 days, oldest first, today last, null without value', () => {
    const w = stepsWeek([row('2026-03-03', { steps: 9000 }), row('2026-03-01', { kcal: 2000 }), row('2026-02-25', { steps: 5000 })], NOW);
    expect(w.map((d) => d.date)).toEqual(['2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02', '2026-03-03']);
    expect(w.map((d) => d.steps)).toEqual([5000, null, null, null, null, null, 9000]);
  });
  it('ignores days outside the window', () => {
    const w = stepsWeek([row('2026-02-24', { steps: 1 }), row('2026-03-04', { steps: 2 })], NOW);
    expect(w).toHaveLength(7);
    expect(w.every((d) => d.steps === null)).toBe(true);
  });
  it('works with no data', () => {
    expect(stepsWeek([], NOW).map((d) => d.steps)).toEqual([null, null, null, null, null, null, null]);
  });
});

describe('goalProgress', () => {
  it('returns the fraction of the goal', () => {
    expect(goalProgress(4000, 8000)).toBe(0.5);
    expect(goalProgress(0, 8000)).toBe(0);
  });
  it('clamps to 0–1', () => {
    expect(goalProgress(8432, 8000)).toBe(1);
    expect(goalProgress(-10, 8000)).toBe(0);
  });
  it('returns 0 for a missing value or a goal ≤ 0', () => {
    expect(goalProgress(null, 8000)).toBe(0);
    expect(goalProgress(undefined, 8000)).toBe(0);
    expect(goalProgress(5000, 0)).toBe(0);
    expect(goalProgress(5000, -1)).toBe(0);
  });
});

describe('dayTrend', () => {
  const days = [
    row('2026-03-03', { steps: 9000, kcal: 1800 }),
    row('2026-02-02', { steps: 7000 }), // 29 Tage zurück: noch drin
    row('2026-02-01', { steps: 6000 }), // 30 Tage zurück: draußen
    row('2026-02-20', { kcal: 2100 }),
    row('2026-02-10', { steps: 8000 }),
    row('2026-03-04', { steps: 1 }), // Zukunft: draußen
  ];
  it('keeps the last 30 days in ascending order', () => {
    const t = dayTrend(days, 'steps', NOW);
    expect(t.map((p) => p.y)).toEqual([7000, 8000, 9000]);
    expect(t.map((p) => p.x)).toEqual([dayTs('2026-02-02'), dayTs('2026-02-10'), dayTs('2026-03-03')]);
    expect(t[0].label).toBe('02.02.');
  });
  it('only includes days that have the field', () => {
    expect(dayTrend(days, 'kcal', NOW).map((p) => p.y)).toEqual([2100, 1800]);
    expect(dayTrend(days, 'proteinG', NOW)).toEqual([]);
  });
  it('includes zero values', () => {
    expect(dayTrend([row('2026-03-03', { proteinG: 0 })], 'proteinG', NOW).map((p) => p.y)).toEqual([0]);
  });
});

describe('goals', () => {
  it('validates the goal ranges as whole numbers', () => {
    expect(isValidKcalGoal(1000)).toBe(true);
    expect(isValidKcalGoal(6000)).toBe(true);
    expect(isValidKcalGoal(999)).toBe(false);
    expect(isValidKcalGoal(6001)).toBe(false);
    expect(isValidKcalGoal(2200.5)).toBe(false);
    expect(isValidProteinGoal(20)).toBe(true);
    expect(isValidProteinGoal(400)).toBe(true);
    expect(isValidProteinGoal(19)).toBe(false);
    expect(isValidProteinGoal(401)).toBe(false);
    expect(isValidStepsGoal(1000)).toBe(true);
    expect(isValidStepsGoal(50000)).toBe(true);
    expect(isValidStepsGoal(999)).toBe(false);
    expect(isValidStepsGoal(50001)).toBe(false);
    expect(isValidStepsGoal('10000')).toBe(false);
  });
  it('parseGoals falls back to the defaults', () => {
    expect(DEFAULT_GOALS).toEqual({ kcal: 2200, proteinG: 160, steps: 8000 });
    expect(parseGoals(undefined)).toEqual(DEFAULT_GOALS);
    expect(parseGoals({})).toEqual(DEFAULT_GOALS);
  });
  it('parseGoals takes valid fields from a partial object', () => {
    expect(parseGoals({ steps: 10000 })).toEqual({ kcal: 2200, proteinG: 160, steps: 10000 });
    expect(parseGoals({ kcal: 1900, proteinG: 140, steps: 12000 })).toEqual({ kcal: 1900, proteinG: 140, steps: 12000 });
  });
  it('parseGoals replaces invalid fields with defaults', () => {
    expect(parseGoals({ kcal: 500, proteinG: '150', steps: 10000.5 })).toEqual(DEFAULT_GOALS);
    expect(parseGoals({ kcal: 2500, proteinG: null })).toEqual({ kcal: 2500, proteinG: 160, steps: 8000 });
  });
  it('parseGoals ignores non-objects', () => {
    expect(parseGoals(null)).toEqual(DEFAULT_GOALS);
    expect(parseGoals(2200)).toEqual(DEFAULT_GOALS);
    expect(parseGoals('x')).toEqual(DEFAULT_GOALS);
    expect(parseGoals([2200, 160, 8000])).toEqual(DEFAULT_GOALS);
  });
});

describe('isDayValuesList', () => {
  it('accepts a valid list and an empty list', () => {
    expect(isDayValuesList([])).toBe(true);
    expect(isDayValuesList([
      row('2026-03-03', { steps: 8432, kcal: 1800, proteinG: 120 }),
      row('2026-03-02', { source: 'health', steps: 4321.5 }),
      row('2026-03-01'),
    ])).toBe(true);
  });
  it('rejects duplicate dates', () => {
    expect(isDayValuesList([row('2026-03-03', { steps: 1 }), row('2026-03-03', { kcal: 1 })])).toBe(false);
  });
  it('rejects bad dates', () => {
    expect(isDayValuesList([row('2026-02-30')])).toBe(false);
    expect(isDayValuesList([row('3.3.2026')])).toBe(false);
    expect(isDayValuesList([{ steps: 1, source: 'manual', updatedAt: 1 }])).toBe(false);
  });
  it('rejects negative, string or non-finite numbers', () => {
    expect(isDayValuesList([row('2026-03-03', { steps: -1 })])).toBe(false);
    expect(isDayValuesList([{ ...row('2026-03-03'), steps: 'viel' }])).toBe(false);
    expect(isDayValuesList([{ ...row('2026-03-03'), kcal: '1800' }])).toBe(false);
    expect(isDayValuesList([{ ...row('2026-03-03'), proteinG: null }])).toBe(false);
    expect(isDayValuesList([row('2026-03-03', { kcal: Infinity })])).toBe(false);
  });
  it('rejects a bad source', () => {
    expect(isDayValuesList([{ ...row('2026-03-03'), source: 'apple' }])).toBe(false);
    const { source: _s, ...noSource } = row('2026-03-03');
    expect(isDayValuesList([noSource])).toBe(false);
  });
  it('rejects a missing or bad updatedAt', () => {
    const { updatedAt: _u, ...noTime } = row('2026-03-03');
    expect(isDayValuesList([noTime])).toBe(false);
    expect(isDayValuesList([{ ...row('2026-03-03'), updatedAt: '1' }])).toBe(false);
    expect(isDayValuesList([row('2026-03-03', { updatedAt: NaN })])).toBe(false);
  });
  it('rejects non-arrays and non-object entries', () => {
    expect(isDayValuesList(undefined)).toBe(false);
    expect(isDayValuesList({})).toBe(false);
    expect(isDayValuesList('[]')).toBe(false);
    expect(isDayValuesList([null])).toBe(false);
    expect(isDayValuesList([['2026-03-03']])).toBe(false);
  });
});
