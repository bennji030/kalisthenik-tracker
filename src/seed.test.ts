import { describe, expect, it } from 'vitest';
import type { Exercise, Template } from './db';
import { seed, type SeedStore } from './seed';

// In-memory store; transaction() runs callbacks one at a time like IndexedDB rw transactions.
function memStore(init: { seeded?: boolean; templates?: number } = {}) {
  const data = {
    seeded: init.seeded ?? false,
    exercises: [] as Exercise[],
    templates: Array.from({ length: init.templates ?? 0 }, (_, i) => ({ id: `t${i}` }) as Template),
  };
  let lock = Promise.resolve();
  const store: SeedStore = {
    transaction: (fn) => {
      const run = lock.then(fn);
      lock = run.catch(() => {});
      return run;
    },
    isSeeded: async () => data.seeded || data.templates.length > 0,
    write: async (exercises, templates) => {
      await Promise.resolve();
      data.exercises.push(...exercises);
      data.templates.push(...templates);
      data.seeded = true;
    },
  };
  return { store, data };
}

describe('seed', () => {
  it('two parallel calls on an empty store seed once', async () => {
    const { store, data } = memStore();
    await Promise.all([seed(store), seed(store)]);
    expect(data.templates).toHaveLength(4);
    expect(data.exercises).toHaveLength(12);
    expect(data.seeded).toBe(true);
    expect(data.templates.map((t) => t.name)).toEqual([
      'Pull A · schwer', 'Push A · schwer', 'Pull B · leicht', 'Push B · leicht',
    ]);
  });

  it('a call after seeding adds nothing', async () => {
    const { store, data } = memStore();
    await seed(store);
    await seed(store);
    expect(data.templates).toHaveLength(4);
    expect(data.exercises).toHaveLength(12);
  });

  it('existing templates without seeded flag → nothing added', async () => {
    const { store, data } = memStore({ templates: 2 });
    await seed(store);
    expect(data.templates).toHaveLength(2);
    expect(data.exercises).toHaveLength(0);
  });

  it('seeded flag with 0 templates → nothing added', async () => {
    const { store, data } = memStore({ seeded: true });
    await seed(store);
    expect(data.templates).toHaveLength(0);
    expect(data.exercises).toHaveLength(0);
  });
});
