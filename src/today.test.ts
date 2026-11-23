import { describe, expect, it } from 'vitest';
import { estimateMinutes, nextTraining, weightTrend } from './today';

const week = [
  { name: 'Pull A · schwer', weekdays: [1] },
  { name: 'Push A · schwer', weekdays: [2] },
  { name: 'Pull B · leicht', weekdays: [4] },
  { name: 'Push B · leicht', weekdays: [5] },
];
// 2026-11-22 ist ein Sonntag
const day = (d: number) => new Date(2026, 10, 22 + d, 12).getTime();

describe('estimateMinutes', () => {
  it('schätzt Pull A auf 40 min', () => {
    const slots = [
      { sets: 3, restSec: 120 }, { sets: 4, restSec: 180 }, { sets: 3, restSec: 120 }, { sets: 3, restSec: 90 },
    ];
    expect(estimateMinutes(slots)).toBe(40);
  });
  it('gibt 0 ohne Übungen zurück', () => expect(estimateMinutes([])).toBe(0));
  it('rundet auf mindestens 5', () => expect(estimateMinutes([{ sets: 1, restSec: 0 }])).toBe(5));
});

describe('nextTraining', () => {
  it('Sonntag: morgen Pull A', () => {
    expect(nextTraining(week, day(0))).toEqual({ label: 'Morgen', names: ['Pull A · schwer'] });
  });
  it('Mittwoch: morgen Pull B', () => {
    expect(nextTraining(week, day(3))).toEqual({ label: 'Morgen', names: ['Pull B · leicht'] });
  });
  it('Samstag: Montag', () => {
    expect(nextTraining(week, day(6))).toEqual({ label: 'Montag', names: ['Pull A · schwer'] });
  });
  it('Freitag: Montag, nicht heute', () => {
    expect(nextTraining(week, day(5))).toEqual({ label: 'Montag', names: ['Pull A · schwer'] });
  });
  it('mehrere Vorlagen am selben Tag', () => {
    const t = [{ name: 'A', weekdays: [3] }, { name: 'B', weekdays: [3] }];
    expect(nextTraining(t, day(1))).toEqual({ label: 'Mittwoch', names: ['A', 'B'] });
  });
  it('null ohne Wochentage', () => {
    expect(nextTraining([{ name: 'A', weekdays: [] }], day(0))).toBeNull();
  });
});

describe('weightTrend', () => {
  it('gibt [] ohne Einträge zurück', () => expect(weightTrend([], day(0))).toEqual([]));
  it('lässt alte Einträge weg, nutzt sie aber für den Schnitt', () => {
    const now = new Date(2026, 10, 22, 12).getTime();
    const entries = [
      { date: '2026-09-01', kg: 90 },
      { date: '2026-11-21', kg: 80 },
      { date: '2026-11-22', kg: 82 },
    ];
    const t = weightTrend(entries, now);
    expect(t).toHaveLength(2);
    expect(t[0].y).toBeCloseTo(85);
    expect(t[1].y).toBeCloseTo(84);
    expect(t[0].x).toBeLessThan(t[1].x);
    expect(t[1].label).toBe('22.11.');
  });
});
