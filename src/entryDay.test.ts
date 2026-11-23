import { describe, expect, it } from 'vitest';
import { defaultTemplate, entryNoon, entryTimes } from './entryDay';
import { dayKey } from './weight';

// 2026-11-23 ist ein Montag
const plan = [
  { id: 'pullA', weekdays: [1] },
  { id: 'pushA', weekdays: [2] },
  { id: 'pullB', weekdays: [4] },
  { id: 'pushB', weekdays: [5] },
];

describe('entryNoon', () => {
  it('liegt um 12 Uhr lokal am selben Tag', () => {
    const ts = entryNoon('2026-11-23');
    expect(new Date(ts).getHours()).toBe(12);
    expect(new Date(ts).getMinutes()).toBe(0);
    expect(dayKey(ts)).toBe('2026-11-23');
  });
  it('funktioniert an Tagen der Zeitumstellung', () => {
    for (const k of ['2026-03-29', '2026-10-25']) {
      expect(new Date(entryNoon(k)).getHours()).toBe(12);
      expect(dayKey(entryNoon(k))).toBe(k);
    }
  });
});

describe('defaultTemplate', () => {
  it('nimmt den Plan des Wochentags', () => {
    expect(defaultTemplate(plan, '2026-11-23')?.id).toBe('pullA');
    expect(defaultTemplate(plan, '2026-11-26')?.id).toBe('pullB');
  });
  it('nimmt an einem freien Tag den nächsten geplanten', () => {
    expect(defaultTemplate(plan, '2026-11-25')?.id).toBe('pullB'); // Mi → Do
  });
  it('springt über Sonntag zum Montag', () => {
    expect(defaultTemplate(plan, '2026-11-28')?.id).toBe('pullA'); // Sa → Mo
    expect(defaultTemplate(plan, '2026-11-29')?.id).toBe('pullA'); // So → Mo
  });
  it('nimmt bei mehreren Plänen am Tag den ersten in Planreihenfolge', () => {
    const two = [{ id: 'a', weekdays: [3] }, { id: 'b', weekdays: [1] }, { id: 'c', weekdays: [1] }];
    expect(defaultTemplate(two, '2026-11-23')?.id).toBe('b');
  });
  it('nimmt ohne Wochentage den ersten Plan', () => {
    expect(defaultTemplate([{ id: 'x', weekdays: [] }, { id: 'y', weekdays: [] }], '2026-11-23')?.id).toBe('x');
  });
  it('gibt bei leerer Liste undefined zurück', () => {
    expect(defaultTemplate([], '2026-11-23')).toBeUndefined();
  });
});

describe('entryTimes', () => {
  const realStart = new Date(2026, 10, 24, 18, 3).getTime();
  const now = realStart + 47 * 60000;
  it('behält die Dauer für einen vergangenen Tag', () => {
    const t = entryTimes('2026-11-23', realStart, now);
    expect(t.startedAt).toBe(entryNoon('2026-11-23'));
    expect(t.finishedAt - t.startedAt).toBe(47 * 60000);
  });
  it('behält die Dauer für einen zukünftigen Tag', () => {
    const t = entryTimes('2026-11-26', realStart, now);
    expect(dayKey(t.startedAt)).toBe('2026-11-26');
    expect(t.finishedAt - t.startedAt).toBe(47 * 60000);
  });
  it('setzt eine negative Dauer auf 0', () => {
    const t = entryTimes('2026-11-23', now, realStart);
    expect(t.finishedAt).toBe(t.startedAt);
  });
});
