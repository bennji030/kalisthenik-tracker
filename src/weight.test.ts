import { describe, expect, it } from 'vitest';
import type { WeightEntry } from './db';
import { dayKey, dayTs, fmtDelta, fmtWeight, isValidKg, isWeightList, rollingAverages, roundKg, weightSummary } from './weight';

/** Einträge an aufeinanderfolgenden Tagen ab dem 1. März 2026. */
function daily(kgs: number[], startDay = 1): WeightEntry[] {
  return kgs.map((kg, i) => ({ date: `2026-03-${String(startDay + i).padStart(2, '0')}`, kg }));
}

describe('dayKey', () => {
  it('uses the local date parts', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30).getTime())).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31, 0, 5).getTime())).toBe('2026-12-31');
  });
  it('round-trips with dayTs', () => {
    expect(dayKey(dayTs('2026-03-29'))).toBe('2026-03-29');
    expect(dayTs('2026-03-29')).toBe(new Date(2026, 2, 29).getTime());
  });
});

describe('roundKg', () => {
  it('rounds to one decimal', () => {
    expect(roundKg(82.44)).toBe(82.4);
    expect(roundKg(82.45)).toBe(82.5);
    expect(roundKg(80)).toBe(80);
  });
});

describe('isValidKg', () => {
  it('accepts 20 to 300 inclusive', () => {
    expect(isValidKg(20)).toBe(true);
    expect(isValidKg(300)).toBe(true);
    expect(isValidKg(82.4)).toBe(true);
  });
  it('rejects empty, out of range and non-finite values', () => {
    expect(isValidKg(null)).toBe(false);
    expect(isValidKg(0)).toBe(false);
    expect(isValidKg(19.9)).toBe(false);
    expect(isValidKg(300.1)).toBe(false);
    expect(isValidKg(301)).toBe(false);
    expect(isValidKg(NaN)).toBe(false);
    expect(isValidKg(Infinity)).toBe(false);
  });
});

describe('rollingAverages', () => {
  it('averages all entries when there are fewer than 7', () => {
    const r = rollingAverages(daily([80, 82, 84]));
    expect(r.map((x) => x.avg)).toEqual([80, 81, 82]);
  });
  it('uses exactly 7 entries at the 7th', () => {
    const r = rollingAverages(daily([80, 81, 82, 83, 84, 85, 86]));
    expect(r[6].avg).toBe(83);
  });
  it('drops the oldest entry beyond 7', () => {
    const r = rollingAverages(daily([70, 81, 82, 83, 84, 85, 86, 87]));
    expect(r).toHaveLength(8);
    expect(r[7].avg).toBeCloseTo((81 + 82 + 83 + 84 + 85 + 86 + 87) / 7);
  });
  it('sorts unsorted input ascending by date', () => {
    const r = rollingAverages([
      { date: '2026-03-03', kg: 84 },
      { date: '2026-03-01', kg: 80 },
      { date: '2026-03-02', kg: 82 },
    ]);
    expect(r.map((x) => x.date)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
    expect(r.map((x) => x.kg)).toEqual([80, 82, 84]);
    expect(r[2].avg).toBe(82);
  });
  it('counts entries, not calendar days, across gaps', () => {
    const entries: WeightEntry[] = [
      { date: '2026-01-01', kg: 90 },
      { date: '2026-02-01', kg: 80 },
      { date: '2026-02-15', kg: 81 },
      { date: '2026-03-01', kg: 82 },
      { date: '2026-03-10', kg: 83 },
      { date: '2026-03-11', kg: 84 },
      { date: '2026-03-20', kg: 85 },
      { date: '2026-04-01', kg: 86 },
    ];
    const r = rollingAverages(entries);
    expect(r[6].avg).toBeCloseTo((90 + 80 + 81 + 82 + 83 + 84 + 85) / 7);
    expect(r[7].avg).toBeCloseTo((80 + 81 + 82 + 83 + 84 + 85 + 86) / 7);
  });
});

describe('weightSummary', () => {
  it('is null without entries', () => {
    expect(weightSummary([])).toBeNull();
  });
  it('has no delta with a single entry', () => {
    expect(weightSummary([{ date: '2026-03-01', kg: 82.4 }])).toEqual({ avg: 82.4, delta: null });
  });
  it('has no delta when no entry is 7 days older', () => {
    expect(weightSummary(daily([82, 81, 80, 79, 78, 77, 76]))?.delta).toBeNull();
  });
  it('compares with the average 7 days earlier (falling)', () => {
    // 1. bis 8. März: am 8. ist der 1. genau 7 Tage älter.
    const s = weightSummary(daily([84, 84, 84, 84, 84, 84, 84, 77]))!;
    expect(s.avg).toBeCloseTo(83);
    expect(s.delta).toBeCloseTo(-1);
  });
  it('compares with the average 7 days earlier (rising, unsorted)', () => {
    const s = weightSummary(daily([80, 80, 80, 80, 80, 80, 80, 87]).reverse())!;
    expect(s.delta).toBeCloseTo(1);
  });
  it('uses the latest entry at least 7 days earlier when days are skipped', () => {
    const s = weightSummary([
      { date: '2026-03-01', kg: 90 },
      { date: '2026-03-05', kg: 80 },
      { date: '2026-03-10', kg: 82 },
      { date: '2026-03-14', kg: 81 },
    ])!;
    // Referenz ist der 5. März (Schnitt 85), nicht der 10. (nur 4 Tage vorher).
    expect(s.avg).toBeCloseTo((90 + 80 + 82 + 81) / 4);
    expect(s.delta).toBeCloseTo((90 + 80 + 82 + 81) / 4 - 85);
  });
});

describe('isWeightList', () => {
  it('accepts valid lists and the empty list', () => {
    expect(isWeightList([])).toBe(true);
    expect(isWeightList([{ date: '2026-03-01', kg: 82.4 }, { date: '2026-03-02', kg: 82 }])).toBe(true);
  });
  it('rejects a bad date', () => {
    expect(isWeightList([{ date: 'gestern', kg: 80 }])).toBe(false);
    expect(isWeightList([{ date: '2026-3-1', kg: 80 }])).toBe(false);
  });
  it('rejects a non-numeric kg', () => {
    expect(isWeightList([{ date: '2026-03-01', kg: '80' }])).toBe(false);
    expect(isWeightList([{ date: '2026-03-01', kg: null }])).toBe(false);
    expect(isWeightList([{ date: '2026-03-01' }])).toBe(false);
  });
  it('rejects duplicate dates', () => {
    expect(isWeightList([{ date: '2026-03-01', kg: 80 }, { date: '2026-03-01', kg: 81 }])).toBe(false);
  });
  it('rejects non-arrays and non-objects', () => {
    expect(isWeightList(null)).toBe(false);
    expect(isWeightList({ date: '2026-03-01', kg: 80 })).toBe(false);
    expect(isWeightList('[]')).toBe(false);
    expect(isWeightList([null])).toBe(false);
  });
});

describe('formatting', () => {
  it('formats weights with one decimal', () => {
    expect(fmtWeight(82.4)).toBe('82,4');
    expect(fmtWeight(82)).toBe('82,0');
    expect(fmtWeight(82.46)).toBe('82,5');
  });
  it('formats the delta with a sign', () => {
    expect(fmtDelta(-0.4)).toBe('−0,4 kg');
    expect(fmtDelta(0.3)).toBe('+0,3 kg');
    expect(fmtDelta(0)).toBe('±0,0 kg');
    expect(fmtDelta(-0.04)).toBe('±0,0 kg');
    expect(fmtDelta(-1.25)).toBe('−1,2 kg');
  });
});
