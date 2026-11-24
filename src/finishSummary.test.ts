import { describe, expect, it } from 'vitest';
import type { EntryLog, Session, SetLog } from './db';
import { backdatedLabel, flameGain, sessionStats, trainingNumber } from './finishSummary';

const at = (d: number, h = 12) => new Date(2026, 10, d, h).getTime(); // November 2026
const now = at(11); // Mittwoch 11.11., Woche ab Mo 9.11.

const set = (p: Partial<SetLog> = {}): SetLog => ({
  targetReps: 5, targetWeight: null, targetSec: null, reps: 5, weight: null, sec: null, done: true, ...p,
});
const entry = (sets: SetLog[], kind: EntryLog['kind'] = 'repeat'): EntryLog =>
  ({ slotId: 'a', exerciseId: 'x', kind, label: '', restSec: 60, lastSummary: null, sets }) as EntryLog;
const sess = (id: string, d: number, p: Partial<Session> = {}): Session => ({
  id, templateId: 't', templateName: 'Pull A', startedAt: at(d), finishedAt: at(d) + 3600e3, entries: [], ...p,
});

describe('trainingNumber', () => {
  it('counts finished strength sessions only', () => {
    const list = [
      sess('a', 2), sess('b', 3), sess('c', 4, { kind: 'cardio' }),
      sess('d', 5, { finishedAt: null }), sess('e', 9),
    ];
    expect(trainingNumber(list)).toBe(3);
  });
});

describe('flameGain', () => {
  it('gains when the session adds to the current week', () => {
    const list = [sess('a', 9), sess('b', 10)];
    expect(flameGain(list, 'b', 4, now)).toEqual({ before: 1, after: 2, gain: 1 });
  });
  it('gains the whole week when it completes a past week', () => {
    const past = [sess('a', 2), sess('b', 3), sess('c', 4), sess('d', 5)];
    const r = flameGain(past, 'd', 4, now);
    expect(r.before).toBe(0);
    expect(r.after).toBe(4);
    expect(r.gain).toBe(4);
  });
  it('is 0 when a backdated session does not change the count', () => {
    const old = { ...sess('b', 1), startedAt: new Date(2026, 8, 1).getTime() };
    const r = flameGain([sess('a', 9), old], 'b', 4, now);
    expect(r.gain).toBe(0);
  });
  it('ignores cardio', () => {
    const list = [sess('a', 9), sess('c', 11, { kind: 'cardio' })];
    expect(flameGain(list, 'c', 4, now).gain).toBe(0);
  });
});

describe('sessionStats', () => {
  it('counts only done sets, reps of done sets, holds add nothing', () => {
    const s = sess('a', 9, {
      finishedAt: at(9) + 45 * 60e3 + 20e3,
      entries: [
        entry([set({ reps: 8 }), set({ reps: 6 }), set({ reps: 9, done: false })]),
        entry([set({ reps: null, sec: 30 }), set({ reps: null })]),
      ],
    });
    expect(sessionStats(s)).toMatchObject({ sets: 4, reps: 14, minutes: 45 });
  });
  it('goals ignore free entries', () => {
    const s = sess('a', 9, {
      entries: [entry([set()]), entry([set({ reps: 1 })]), entry([set({ reps: 1 })], 'free')],
    });
    const r = sessionStats(s);
    expect(r.judged).toBe(2);
    expect(r.hits).toBe(1);
  });
  it('no judged entries gives judged 0', () => {
    expect(sessionStats(sess('a', 9, { entries: [entry([set()], 'free')] })).judged).toBe(0);
  });
});

describe('backdatedLabel', () => {
  it('Monday 23 Nov', () => expect(backdatedLabel(new Date(2026, 10, 23, 12).getTime())).toBe('Mo 23.11.'));
});
