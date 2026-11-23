import { describe, expect, it } from 'vitest';
import { dayStatus, monthGrid, plannedWeekdays, weekKeys } from './calendar';
import { sessionDayKeys } from './habits';

describe('weekKeys', () => {
  it('Montag', () => {
    expect(weekKeys('2026-11-23')).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
  });
  it('Sonntag gehört zur Woche davor', () => {
    const w = weekKeys('2026-11-29');
    expect(w[0]).toBe('2026-11-23');
    expect(w[6]).toBe('2026-11-29');
  });
  it('über die Monatsgrenze', () => {
    expect(weekKeys('2026-12-02')).toEqual(['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06']);
  });
  it('über die Jahresgrenze', () => {
    const w = weekKeys('2027-01-01');
    expect(w[0]).toBe('2026-12-28');
    expect(w[4]).toBe('2027-01-01');
    expect(w[6]).toBe('2027-01-03');
  });
});

describe('monthGrid', () => {
  it('November 2026 beginnt an einem Sonntag', () => {
    const g = monthGrid(2026, 10);
    expect(g[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(g).toHaveLength(6);
    expect(g[5]).toEqual(['2026-11-30', null, null, null, null, null, null]);
  });
  it('Februar 2027 hat genau 4 Wochen', () => {
    const g = monthGrid(2027, 1);
    expect(g).toHaveLength(4);
    expect(g[0][0]).toBe('2027-02-01');
    expect(g[3][6]).toBe('2027-02-28');
  });
  it('Zeitumstellung (März 2026): eindeutige, lückenlose Tage', () => {
    const days = monthGrid(2026, 2).flat().filter((k): k is string => k !== null);
    expect(days).toHaveLength(31);
    expect(new Set(days).size).toBe(31);
    days.forEach((k, i) => expect(k).toBe(`2026-03-${String(i + 1).padStart(2, '0')}`));
  });
});

describe('dayStatus', () => {
  const planned = plannedWeekdays([{ weekdays: [1, 2] }, { weekdays: [4, 5] }]);
  const today = '2026-11-25'; // Mittwoch
  const done = sessionDayKeys([
    { startedAt: new Date(2026, 10, 24, 23, 30).getTime(), finishedAt: new Date(2026, 10, 25, 0, 20).getTime() },
    { startedAt: new Date(2026, 10, 25, 8).getTime(), finishedAt: null },
    { startedAt: new Date(2026, 10, 25, 9).getTime(), finishedAt: new Date(2026, 10, 25, 10).getTime() },
  ]);

  it('plannedWeekdays', () => {
    expect([...planned].sort()).toEqual([1, 2, 4, 5]);
  });
  it('done, auch am ungeplanten Tag', () => {
    expect(dayStatus('2026-11-25', today, done, planned)).toBe('done');
  });
  it('Sitzung um 23:30 zählt am lokalen Tag', () => {
    expect(dayStatus('2026-11-24', today, done, planned)).toBe('done');
  });
  it('laufende Sitzung zählt nicht', () => {
    const running = sessionDayKeys([{ startedAt: new Date(2026, 10, 26, 8).getTime(), finishedAt: null }]);
    expect(dayStatus('2026-11-26', '2026-11-26', running, planned)).toBe('open');
  });
  it('geplant heute und nicht erledigt ist open', () => {
    expect(dayStatus('2026-11-26', '2026-11-26', new Set(), planned)).toBe('open');
    expect(dayStatus('2026-11-27', today, new Set(), planned)).toBe('open');
  });
  it('missed in der Vergangenheit', () => {
    expect(dayStatus('2026-11-23', today, done, planned)).toBe('missed');
  });
  it('none an ungeplanten Tagen', () => {
    expect(dayStatus('2026-11-28', today, done, planned)).toBe('none');
    expect(dayStatus('2026-11-22', today, done, planned)).toBe('none');
  });
});
