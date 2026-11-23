import Dexie, { type Table } from 'dexie';

/** weighted = Wdh. + Zusatzgewicht, reps = nur Wdh., hold = Haltezeit in Sekunden */
export type ExType = 'weighted' | 'reps' | 'hold';

export interface Exercise {
  id: string;
  name: string;
  type: ExType;
}

/** Eine Übung innerhalb eines Trainingstags, mit eigenen Zielen. */
export interface Slot {
  id: string;
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  increment: number; // kg pro Steigerung
  startWeight: number; // kg beim allerersten Mal
  restSec: number;
  progression: boolean; // false = frei (z. B. Skill-Training)
}

export interface Template {
  id: string;
  name: string;
  weekdays: number[]; // 0 = So, 1 = Mo, ...
  order: number;
  slots: Slot[];
}

export interface SetLog {
  targetReps: number | null;
  targetWeight: number | null;
  targetSec: number | null;
  reps: number | null;
  weight: number | null;
  sec: number | null;
  done: boolean;
}

export type SuggestKind = 'first' | 'up-reps' | 'up-weight' | 'repeat' | 'deload' | 'maxed' | 'free';

export interface EntryLog {
  slotId: string;
  exerciseId: string;
  restSec: number;
  sets: SetLog[];
  kind: SuggestKind;
  label: string;
  lastSummary: string | null;
}

export interface Session {
  id: string;
  templateId: string;
  templateName: string;
  startedAt: number;
  finishedAt: number | null;
  entries: EntryLog[];
}

export interface Meta {
  key: string;
  value: unknown;
}

class KalisthenikDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<Template, string>;
  sessions!: Table<Session, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super('kalisthenik');
    this.version(1).stores({
      exercises: 'id, name',
      templates: 'id, order',
      sessions: 'id, templateId, startedAt, finishedAt',
      meta: 'key',
    });
  }
}

export const db = new KalisthenikDB();

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const m = await db.meta.get(key);
  return m ? (m.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}
