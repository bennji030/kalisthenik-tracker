import { describe, expect, it } from 'vitest';
import type { EntryLog, Exercise, Session, SetLog, Slot, Template } from './db';
import { exerciseGroup, exerciseOrder, exerciseWindow, fmtChange, sessionMetric, windowChange } from './stats';

const set = (p: Partial<SetLog> = {}): SetLog => ({ targetReps: null, targetWeight: null, targetSec: null, reps: null, weight: null, sec: null, done: true, ...p });
const entry = (exerciseId: string, sets: SetLog[]): EntryLog => ({ slotId: 's', exerciseId, restSec: 60, sets, kind: 'free', label: '', lastSummary: null });
let n = 0;
const session = (templateName: string, startedAt: number, entries: EntryLog[], p: Partial<Session> = {}): Session => ({
  id: `s${n++}`, templateId: 't', templateName, startedAt, finishedAt: startedAt + 1000, entries, ...p,
});
const slot = (exerciseId: string, progression: boolean): Slot => ({ id: `${exerciseId}${progression}`, exerciseId, sets: 3, repMin: 5, repMax: 8, increment: 1, startWeight: 0, restSec: 60, progression });
const tpl = (id: string, order: number, slots: Slot[]): Template => ({ id, name: id, weekdays: [], order, slots });
const ex = (id: string, type: Exercise['type'], name = id): Exercise => ({ id, name, type });

const row = (id: string) => [entry(id, [set({ reps: 5 })])];

describe('exerciseGroup', () => {
  it('uses the more frequent day type', () => {
    const ss = [session('Pull A · schwer', 1, row('a')), session('Pull B', 2, row('a')), session('Push A', 3, row('a'))];
    expect(exerciseGroup('a', ss, [])).toBe('pull');
    expect(exerciseGroup('a', [session('Push A', 1, row('a'))], [])).toBe('push');
  });
  it('ignores case and whitespace', () => {
    expect(exerciseGroup('a', [session('  PUSH x', 1, row('a'))], [])).toBe('push');
  });
  it('goes to other without pull/push sessions', () => {
    expect(exerciseGroup('a', [], [])).toBe('other');
    expect(exerciseGroup('a', [session('Beine', 1, row('a'))], [])).toBe('other');
  });
  it('breaks a tie with the most recent session', () => {
    const ss = [session('Pull A', 1, row('a')), session('Push A', 5, row('a')), session('Pull A', 3, row('a')), session('Push A', 2, row('a'))];
    expect(exerciseGroup('a', ss, [])).toBe('push');
    const ss2 = [session('Push A', 1, row('a')), session('Pull A', 2, row('a'))];
    expect(exerciseGroup('a', ss2, [])).toBe('pull');
  });
  it('ignores cardio, unfinished sessions and undone sets', () => {
    const ss = [
      session('Pull A', 1, row('a'), { finishedAt: null }),
      session('Pull A', 2, row('a'), { kind: 'cardio' }),
      session('Pull A', 3, [entry('a', [set({ done: false })])]),
      session('Push A', 4, row('a')),
    ];
    expect(exerciseGroup('a', ss, [])).toBe('push');
  });
  it('is skills when every slot is free, even on a pull day', () => {
    const ss = [session('Pull A', 1, row('a'))];
    expect(exerciseGroup('a', ss, [tpl('x', 0, [slot('a', false)]), tpl('y', 1, [slot('a', false)])])).toBe('skills');
  });
  it('is not skills with a progression slot or without a template', () => {
    const ss = [session('Pull A', 1, row('a'))];
    expect(exerciseGroup('a', ss, [tpl('x', 0, [slot('a', false)]), tpl('y', 1, [slot('a', true)])])).toBe('pull');
    expect(exerciseGroup('a', ss, [tpl('x', 0, [slot('b', false)])])).toBe('pull');
  });
});

describe('sessionMetric', () => {
  it('averages added kg of done sets, null as 0', () => {
    const s = session('Pull A', 1, [entry('a', [set({ weight: 10 }), set({ weight: null }), set({ weight: 99, done: false })])]);
    expect(sessionMetric(s, ex('a', 'weighted'))).toBe(5);
  });
  it('averages reps and seconds', () => {
    const s = session('Pull A', 1, [entry('a', [set({ reps: 5, sec: 20 }), set({ reps: 8, sec: 30 })])]);
    expect(sessionMetric(s, ex('a', 'reps'))).toBe(6.5);
    expect(sessionMetric(s, ex('a', 'hold'))).toBe(25);
  });
  it('combines entries of the same exercise', () => {
    const s = session('Pull A', 1, [entry('a', [set({ reps: 4 })]), entry('b', [set({ reps: 100 })]), entry('a', [set({ reps: 8 })])]);
    expect(sessionMetric(s, ex('a', 'reps'))).toBe(6);
  });
  it('is null without done sets', () => {
    expect(sessionMetric(session('Pull A', 1, [entry('a', [set({ done: false })])]), ex('a', 'reps'))).toBeNull();
    expect(sessionMetric(session('Pull A', 1, []), ex('a', 'reps'))).toBeNull();
  });
});

describe('exerciseWindow', () => {
  const mk = (i: number) => session('Pull A', i, [entry('a', [set({ reps: i })])]);
  it('keeps the last 7 in chronological order', () => {
    const w = exerciseWindow([10, 3, 1, 9, 2, 8, 4, 7, 5, 6].map(mk), ex('a', 'reps'));
    expect(w.map((p) => p.value)).toEqual([4, 5, 6, 7, 8, 9, 10]);
  });
  it('returns fewer points when there are fewer', () => {
    expect(exerciseWindow([mk(2), mk(1)], ex('a', 'reps')).map((p) => p.ts)).toEqual([1, 2]);
  });
  it('skips sessions without the exercise, cardio and unfinished', () => {
    const ss = [mk(1), session('Pull A', 2, row('b')), session('Pull A', 3, row('a'), { finishedAt: null }), session('Cardio', 4, [], { kind: 'cardio' })];
    expect(exerciseWindow(ss, ex('a', 'reps'))).toHaveLength(1);
  });
});

describe('windowChange', () => {
  it('is null under 2 points', () => {
    expect(windowChange([])).toBeNull();
    expect(windowChange([{ ts: 1, value: 5 }])).toBeNull();
  });
  it('is last minus first, rounded to one decimal', () => {
    expect(windowChange([{ ts: 1, value: 1 }, { ts: 2, value: 100 }, { ts: 3, value: 2.26 }])).toBe(1.3);
    expect(windowChange([{ ts: 1, value: 5 }, { ts: 2, value: 3.6 }])).toBe(-1.4);
  });
});

describe('fmtChange', () => {
  it('formats with sign and unit', () => {
    expect(fmtChange(6.7, 'weighted')).toBe('+6,7 kg');
    expect(fmtChange(-1.4, 'weighted')).toBe('−1,4 kg');
    expect(fmtChange(1.3, 'reps')).toBe('+1,3 Wdh');
    expect(fmtChange(2.5, 'hold')).toBe('+2,5 s');
    expect(fmtChange(3, 'reps')).toBe('+3 Wdh');
  });
  it('formats zero', () => {
    expect(fmtChange(0, 'weighted')).toBe('±0 kg');
    expect(fmtChange(0, 'reps')).toBe('±0 Wdh');
    expect(fmtChange(-0, 'hold')).toBe('±0 s');
  });
});

describe('exerciseOrder', () => {
  it('follows the plan, then name', () => {
    const exs = [ex('z', 'reps', 'Zeta'), ex('b', 'reps', 'B'), ex('a', 'reps', 'A'), ex('c', 'reps', 'C')];
    const ts = [tpl('t2', 2, [slot('a', true)]), tpl('t1', 1, [slot('b', true), slot('c', true)])];
    expect(exerciseOrder(exs, ts).map((e) => e.id)).toEqual(['b', 'c', 'a', 'z']);
  });
});
