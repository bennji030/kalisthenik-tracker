import { describe, expect, it } from 'vitest';
import type { Exercise } from './db';
import {
  defaultMuscles, ensureMuscleDefaults, MUSCLES, muscleLoad, parseMuscles, type Muscle, type MuscleDefaultsStore,
} from './muscles';

const SEEDED = [
  'Muscle-up (Skill)', 'Handstand (Skill)', 'Pull-ups (Zusatzgewicht)', 'Australian Pull-ups (Zusatzgewicht)',
  'Hanging Leg Raises', 'Dips (Zusatzgewicht)', 'Pike Push-ups (erhöht)', 'Pull-ups', 'Chin-ups',
  'Australian Pull-ups', 'Liegestütze (Zusatzgewicht)', 'Dips',
];

const ex = (id: string, name: string, muscles?: unknown): Exercise =>
  ({ id, name, type: 'reps', ...(muscles !== undefined ? { muscles: muscles as Muscle[] } : {}) });

describe('MUSCLES', () => {
  it('has the 13 groups in order with German labels', () => {
    expect(MUSCLES.map((m) => m.id)).toEqual([
      'chest', 'frontDelts', 'sideDelts', 'rearDelts', 'biceps', 'triceps', 'forearms',
      'lats', 'lowerBack', 'abs', 'glutes', 'thighs', 'calves',
    ]);
    expect(MUSCLES.find((m) => m.id === 'lats')?.label).toBe('Oberer Rücken/Lat');
  });
});

describe('parseMuscles', () => {
  it('keeps valid ids once and drops everything else', () => {
    expect(parseMuscles(['lats', 'foo', 'lats', 3])).toEqual(['lats']);
    expect(parseMuscles(['abs', 'chest'])).toEqual(['abs', 'chest']);
  });
  it('non-arrays give []', () => {
    expect(parseMuscles('x')).toEqual([]);
    expect(parseMuscles(undefined)).toEqual([]);
    expect(parseMuscles(null)).toEqual([]);
    expect(parseMuscles({ 0: 'lats' })).toEqual([]);
  });
});

describe('defaultMuscles', () => {
  it('Pull-ups', () => {
    expect(defaultMuscles('Pull-ups')).toEqual(expect.arrayContaining(['lats', 'biceps', 'rearDelts']));
  });
  it('Dips (Zusatzgewicht)', () => {
    expect(defaultMuscles('Dips (Zusatzgewicht)')).toEqual(expect.arrayContaining(['chest', 'triceps', 'frontDelts']));
  });
  it('every seeded exercise gets a non-empty list', () => {
    for (const name of SEEDED) expect(defaultMuscles(name), name).not.toEqual([]);
  });
  it('first match wins and case does not matter', () => {
    expect(defaultMuscles('MUSCLE-UP (Skill)')).toEqual(['lats', 'biceps', 'triceps', 'chest']);
    expect(defaultMuscles('Pike Push-ups (erhöht)')).toEqual(['frontDelts', 'sideDelts', 'triceps']);
    expect(defaultMuscles('Australian Pull-ups')).toEqual(['lats', 'rearDelts', 'biceps']);
    expect(defaultMuscles('Chin-ups')).toEqual(['lats', 'biceps', 'forearms']);
    expect(defaultMuscles('Liegestütze (Zusatzgewicht)')).toEqual(['chest', 'triceps', 'frontDelts']);
    expect(defaultMuscles('Hanging Leg Raises')).toEqual(['abs', 'forearms']);
    expect(defaultMuscles('Kniebeugen')).toEqual(['thighs', 'glutes']);
  });
  it('unknown name gives []', () => {
    expect(defaultMuscles('Plank')).toEqual([]);
    expect(defaultMuscles('')).toEqual([]);
  });
  it('matches whole words only, with plural endings', () => {
    expect(defaultMuscles('Chest Machine')).toEqual([]);
    expect(defaultMuscles('Arrow')).toEqual([]);
    expect(defaultMuscles('Dipping')).toEqual([]);
    expect(defaultMuscles('Pullover')).toEqual([]);
    expect(defaultMuscles('Rows')).toEqual(['lats', 'rearDelts', 'biceps']);
    expect(defaultMuscles('Ring Dip')).toEqual(['chest', 'triceps', 'frontDelts']);
    expect(defaultMuscles('Squats')).toEqual(['thighs', 'glutes']);
    expect(defaultMuscles('Kniebeugen')).toEqual(['thighs', 'glutes']);
  });
  it('a name that is not a string gives []', () => {
    expect(defaultMuscles(undefined)).toEqual([]);
    expect(defaultMuscles(5)).toEqual([]);
    expect(defaultMuscles(null)).toEqual([]);
  });
});

// In-memory store; transaction() runs callbacks one at a time like IndexedDB rw transactions.
function memStore(init: { done?: boolean; exercises?: Exercise[] } = {}) {
  const data = { done: init.done ?? false, exercises: (init.exercises ?? []).map((e) => structuredClone(e)), updates: 0 };
  let lock = Promise.resolve();
  const store: MuscleDefaultsStore = {
    transaction: (fn) => {
      const run = lock.then(fn);
      lock = run.catch(() => {});
      return run;
    },
    isDone: async () => data.done,
    exercises: async () => data.exercises.map((e) => structuredClone(e)),
    update: async (id, muscles) => {
      await Promise.resolve();
      data.updates++;
      const e = data.exercises.find((x) => x.id === id);
      if (e) e.muscles = muscles;
    },
    markDone: async () => { data.done = true; },
  };
  return { store, data };
}

describe('ensureMuscleDefaults', () => {
  it('fills empty ones, keeps existing ones, leaves no-match ones empty and sets the flag', async () => {
    const { store, data } = memStore({
      exercises: [
        ex('a', 'Pull-ups'),
        ex('b', 'Dips', ['abs']),
        ex('c', 'Plank'),
        ex('d', 'Chin-ups', 'junk'),
        ex('e', 'Dips', []),
      ],
    });
    await ensureMuscleDefaults(store);
    expect(data.exercises[0]).toEqual({ id: 'a', name: 'Pull-ups', type: 'reps', muscles: ['lats', 'biceps', 'rearDelts', 'forearms'] });
    expect(data.exercises[1].muscles).toEqual(['abs']);
    expect(data.exercises[2]).toEqual({ id: 'c', name: 'Plank', type: 'reps' });
    expect(data.exercises[3].muscles).toEqual(['lats', 'biceps', 'forearms']);
    expect(data.exercises[4].muscles).toEqual(['chest', 'triceps', 'frontDelts']);
    expect(data.done).toBe(true);
  });
  it('skips exercises without a string name and still sets the flag', async () => {
    const odd = [{ id: 'x', type: 'reps' }, { id: 'y', name: 5, type: 'reps' }] as unknown as Exercise[];
    const { store, data } = memStore({ exercises: [...odd, ex('a', 'Dips')] });
    await ensureMuscleDefaults(store);
    expect(data.exercises.slice(0, 2)).toEqual(odd);
    expect(data.exercises[2].muscles).toEqual(['chest', 'triceps', 'frontDelts']);
    expect(data.done).toBe(true);
  });
  it('does nothing once the flag is set', async () => {
    const { store, data } = memStore({ done: true, exercises: [ex('a', 'Pull-ups')] });
    await ensureMuscleDefaults(store);
    expect(data.exercises[0].muscles).toBeUndefined();
    expect(data.updates).toBe(0);
  });
  it('second run (also in parallel) changes nothing', async () => {
    const { store, data } = memStore({ exercises: [ex('a', 'Pull-ups')] });
    await Promise.all([ensureMuscleDefaults(store), ensureMuscleDefaults(store)]);
    expect(data.updates).toBe(1);
    data.exercises.push(ex('b', 'Dips'));
    await ensureMuscleDefaults(store);
    expect(data.updates).toBe(1);
    expect(data.exercises[1].muscles).toBeUndefined();
  });
});

describe('muscleLoad', () => {
  const exercises = [
    ex('pull', 'Pull-ups', ['lats', 'biceps']),
    ex('legs', 'Leg Raises', ['abs']),
    ex('none', 'Plank'),
    ex('junk', 'Junk', 'junk'),
  ];
  it('sums sets across exercises and normalises to the largest sum', () => {
    const load = muscleLoad([{ exerciseId: 'pull', sets: 4 }, { exerciseId: 'legs', sets: 2 }], exercises);
    expect(load).toEqual({ lats: 1, biceps: 1, abs: 0.5 });
  });
  it('adds sets of the same muscle from several exercises', () => {
    const more = [...exercises, ex('chin', 'Chin-ups', ['lats'])];
    const load = muscleLoad([{ exerciseId: 'pull', sets: 3 }, { exerciseId: 'chin', sets: 3 }], more);
    expect(load).toEqual({ lats: 1, biceps: 0.5 });
  });
  it('ignores unknown ids, exercises without muscles and sets <= 0', () => {
    const load = muscleLoad([
      { exerciseId: 'gone', sets: 9 },
      { exerciseId: 'none', sets: 9 },
      { exerciseId: 'junk', sets: 9 },
      { exerciseId: 'legs', sets: 0 },
      { exerciseId: 'legs', sets: -2 },
      { exerciseId: 'pull', sets: 2 },
    ], exercises);
    expect(load).toEqual({ lats: 1, biceps: 1 });
  });
  it('empty input gives {}', () => {
    expect(muscleLoad([], exercises)).toEqual({});
    expect(muscleLoad([{ exerciseId: 'none', sets: 3 }], exercises)).toEqual({});
  });
});
