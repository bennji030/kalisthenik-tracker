import { db, type Meta } from './db';
import { DEVICE_META_KEYS } from './backupFormat';
import { cardioDayDbStore, ensureCardioDay, type CardioDayStore } from './cardio';
import { ensureMuscleDefaults, muscleDefaultsDbStore, type MuscleDefaultsStore } from './muscles';
import { seed, seedDbStore, type SeedStore } from './seed';

/** Bleiben beim Löschen aller Daten erhalten: Apple-Health-Verbindung und Darstellung. */
export const RESET_KEPT_META_KEYS = [...DEVICE_META_KEYS, 'theme'];

export function keptMeta(meta: Meta[]): Meta[] {
  return meta.filter((m) => RESET_KEPT_META_KEYS.includes(m.key));
}

/**
 * Storage used by resetAll(); transaction() wraps the whole reset and rolls back on error.
 * The three fresh-install stores run inside it, so their own transaction() just calls fn.
 */
export interface ResetStore {
  transaction(fn: () => Promise<void>): Promise<void>;
  meta(): Promise<Meta[]>;
  clearAll(): Promise<void>;
  putMeta(rows: Meta[]): Promise<void>;
  seed: SeedStore;
  cardioDay: CardioDayStore;
  muscleDefaults: MuscleDefaultsStore;
}

/** Löscht alles außer den behaltenen Meta-Schlüsseln und legt den Zustand nach der ersten Installation neu an. */
export function resetAll(store: ResetStore): Promise<void> {
  return store.transaction(async () => {
    const kept = keptMeta(await store.meta());
    await store.clearAll();
    await store.putMeta(kept);
    await seed(store.seed);
    await ensureCardioDay(store.cardioDay);
    await ensureMuscleDefaults(store.muscleDefaults);
  });
}

const inside = (fn: () => Promise<void>) => fn();

const dbStore: ResetStore = {
  transaction: (fn) => db.transaction('rw', [db.exercises, db.templates, db.sessions, db.meta, db.weights, db.days], fn),
  meta: () => db.meta.toArray(),
  clearAll: async () => {
    await Promise.all([db.exercises.clear(), db.templates.clear(), db.sessions.clear(), db.meta.clear(), db.weights.clear(), db.days.clear()]);
  },
  putMeta: async (rows) => { await db.meta.bulkAdd(rows); },
  seed: { ...seedDbStore, transaction: inside },
  cardioDay: { ...cardioDayDbStore, transaction: inside },
  muscleDefaults: { ...muscleDefaultsDbStore, transaction: inside },
};

export function resetAllInDb(): Promise<void> {
  return resetAll(dbStore);
}
