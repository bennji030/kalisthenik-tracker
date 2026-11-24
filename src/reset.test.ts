import { describe, expect, it } from 'vitest';
import type { DayValues, Exercise, Meta, Session, Template, WeightEntry } from './db';
import { isCardio } from './cardio';
import { parseMuscles } from './muscles';
import { keptMeta, resetAll, RESET_KEPT_META_KEYS, type ResetStore } from './reset';

const ALL_META: Meta[] = [
  { key: 'seeded', value: true },
  { key: 'cardioDay', value: true },
  { key: 'muscleDefaults', value: true },
  { key: 'goals', value: { kcal: 2500 } },
  { key: 'profile', value: { name: 'Test' } },
  { key: 'lastBackup', value: 1 },
  { key: 'weighSkip', value: '2026-11-24' },
  { key: 'entryDay', value: '2026-11-20' },
  { key: 'theme', value: 'light' },
  { key: 'health', value: { url: 'https://example.org', token: 'abc', shortcut: 'Sync' } },
  { key: 'healthStatus', value: { lastSync: 5, error: null } },
];

interface Data {
  exercises: Exercise[];
  templates: Template[];
  sessions: Session[];
  weights: WeightEntry[];
  days: DayValues[];
  meta: Meta[];
}

function populated(): Data {
  return {
    exercises: [{ id: 'e1', name: 'Eigene Übung', type: 'reps' }],
    templates: [{ id: 't1', name: 'Mein Tag', weekdays: [6], order: 0, slots: [] }],
    sessions: [
      { id: 's1', templateId: 't1', templateName: 'Mein Tag', startedAt: 1, finishedAt: 2, entries: [] },
      { id: 's2', templateId: 'c', templateName: 'Cardio', startedAt: 3, finishedAt: 3, entries: [], kind: 'cardio' },
    ],
    weights: [{ date: '2026-11-24', kg: 80 }],
    days: [{ date: '2026-11-24', steps: 9000, kcal: 2100, source: 'manual', updatedAt: 1 }],
    meta: structuredClone(ALL_META),
  };
}

// In-memory store; transaction() restores a snapshot when fn throws, like an aborted IndexedDB transaction.
function memStore(init: Data, failOnMuscles = false) {
  let data = init;
  const flag = async (key: string) => data.meta.find((m) => m.key === key)?.value === true;
  const setFlag = async (key: string) => {
    data.meta = [...data.meta.filter((m) => m.key !== key), { key, value: true }];
  };
  let transactions = 0;
  const inside = (fn: () => Promise<void>) => fn();
  const store: ResetStore = {
    transaction: async (fn) => {
      transactions++;
      const snapshot = structuredClone(data);
      try {
        await fn();
      } catch (e) {
        data = snapshot;
        throw e;
      }
    },
    meta: async () => data.meta,
    clearAll: async () => {
      data = { exercises: [], templates: [], sessions: [], weights: [], days: [], meta: [] };
    },
    putMeta: async (rows) => { data.meta.push(...rows); },
    seed: {
      transaction: inside,
      isSeeded: async () => (await flag('seeded')) || data.templates.length > 0,
      write: async (exercises, templates) => {
        data.exercises.push(...exercises);
        data.templates.push(...templates);
        await setFlag('seeded');
      },
    },
    cardioDay: {
      transaction: inside,
      isDone: () => flag('cardioDay'),
      templates: async () => data.templates,
      add: async (t) => { data.templates.push(t); },
      markDone: () => setFlag('cardioDay'),
    },
    muscleDefaults: {
      transaction: inside,
      isDone: () => flag('muscleDefaults'),
      exercises: async () => data.exercises,
      update: async (id, muscles) => {
        if (failOnMuscles) throw new Error('kaputt');
        data.exercises = data.exercises.map((e) => (e.id === id ? { ...e, muscles } : e));
      },
      markDone: () => setFlag('muscleDefaults'),
    },
  };
  return { store, data: () => data, transactions: () => transactions };
}

const metaValue = (d: Data, key: string) => d.meta.find((m) => m.key === key)?.value;

describe('keptMeta', () => {
  it('keeps only health, healthStatus and theme', () => {
    expect(RESET_KEPT_META_KEYS).toEqual(['health', 'healthStatus', 'theme']);
    expect(keptMeta(ALL_META).map((m) => m.key).sort()).toEqual(['health', 'healthStatus', 'theme']);
  });
  it('an empty meta list stays empty', () => {
    expect(keptMeta([])).toEqual([]);
  });
});

describe('resetAll', () => {
  it('clears everything and recreates the fresh-install state', async () => {
    const { store, data } = memStore(populated());
    await resetAll(store);
    const d = data();
    expect(d.sessions).toEqual([]);
    expect(d.weights).toEqual([]);
    expect(d.days).toEqual([]);

    expect(d.templates.filter((t) => !isCardio(t)).map((t) => t.name)).toEqual([
      'Pull A · schwer', 'Push A · schwer', 'Pull B · leicht', 'Push B · leicht',
    ]);
    const cardio = d.templates.filter(isCardio);
    expect(cardio).toHaveLength(1);
    expect(cardio[0].weekdays).toEqual([3]);
    expect(d.exercises).toHaveLength(12);
    expect(d.exercises.every((e) => parseMuscles(e.muscles).length > 0)).toBe(true);

    for (const k of ['seeded', 'cardioDay', 'muscleDefaults']) expect(metaValue(d, k)).toBe(true);
    for (const k of ['profile', 'goals', 'lastBackup', 'weighSkip', 'entryDay']) expect(d.meta.some((m) => m.key === k)).toBe(false);

    for (const k of ['health', 'healthStatus', 'theme']) expect(metaValue(d, k)).toEqual(metaValue(populated(), k));
    expect(d.meta).toHaveLength(6);
  });

  it('runs in a single store transaction', async () => {
    const { store, transactions } = memStore(populated());
    await resetAll(store);
    expect(transactions()).toBe(1);
  });

  it('a second reset gives the same plan, no duplicates', async () => {
    const { store, data } = memStore(populated());
    await resetAll(store);
    await resetAll(store);
    expect(data().templates).toHaveLength(5);
    expect(data().exercises).toHaveLength(12);
  });

  it('a failure in the middle leaves the data unchanged', async () => {
    const before = populated();
    const { store, data } = memStore(populated(), true);
    await expect(resetAll(store)).rejects.toThrow('kaputt');
    expect(data()).toEqual(before);
  });
});
