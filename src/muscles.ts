import { db, getMeta, setMeta, type Exercise } from './db';

export type Muscle =
  | 'chest' | 'frontDelts' | 'sideDelts' | 'rearDelts' | 'biceps' | 'triceps' | 'forearms'
  | 'lats' | 'lowerBack' | 'abs' | 'glutes' | 'thighs' | 'calves';

export const MUSCLES: { id: Muscle; label: string }[] = [
  { id: 'chest', label: 'Brust' },
  { id: 'frontDelts', label: 'Schulter vorne' },
  { id: 'sideDelts', label: 'Schulter seitlich' },
  { id: 'rearDelts', label: 'Schulter hinten' },
  { id: 'biceps', label: 'Bizeps' },
  { id: 'triceps', label: 'Trizeps' },
  { id: 'forearms', label: 'Unterarme' },
  { id: 'lats', label: 'Oberer Rücken/Lat' },
  { id: 'lowerBack', label: 'Unterer Rücken' },
  { id: 'abs', label: 'Bauch' },
  { id: 'glutes', label: 'Gesäß' },
  { id: 'thighs', label: 'Oberschenkel' },
  { id: 'calves', label: 'Waden' },
];

const IDS = new Set<string>(MUSCLES.map((m) => m.id));

/** Gültige, eindeutige Muskel-IDs; alles andere (z. B. Müll aus Backups) ergibt []. */
export function parseMuscles(value: unknown): Muscle[] {
  if (!Array.isArray(value)) return [];
  const out: Muscle[] = [];
  for (const v of value) {
    if (typeof v === 'string' && IDS.has(v) && !out.includes(v as Muscle)) out.push(v as Muscle);
  }
  return out;
}

// Reihenfolge zählt: der erste passende Begriff gewinnt.
const DEFAULTS: [keywords: string[], muscles: Muscle[]][] = [
  [['muscle-up'], ['lats', 'biceps', 'triceps', 'chest']],
  [['handstand'], ['frontDelts', 'sideDelts', 'triceps']],
  [['pike'], ['frontDelts', 'sideDelts', 'triceps']],
  [['australian', 'row', 'rudern'], ['lats', 'rearDelts', 'biceps']],
  [['chin'], ['lats', 'biceps', 'forearms']],
  [['pull'], ['lats', 'biceps', 'rearDelts', 'forearms']],
  [['leg raise', 'toes to bar'], ['abs', 'forearms']],
  [['dip'], ['chest', 'triceps', 'frontDelts']],
  [['liegestütz', 'push-up', 'push up'], ['chest', 'triceps', 'frontDelts']],
  [['trizeps', 'triceps'], ['triceps']],
  [['kniebeug', 'squat'], ['thighs', 'glutes']],
];

// Ganze Wörter: Stichwort am Wortanfang, danach höchstens eine Endung wie in Dips, Liegestütze, Kniebeugen.
const escape = (k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERNS = DEFAULTS.map(([keys, muscles]) =>
  [keys.map((k) => new RegExp(`(^|[^\\p{L}])${escape(k)}(s|e|en|n)?($|[^\\p{L}])`, 'u')), muscles] as const);

/** Standard-Muskeln nach Stichwort im Übungsnamen, [] wenn nichts passt oder der Name kein Text ist (z. B. aus einem Backup). */
export function defaultMuscles(name: unknown): Muscle[] {
  if (typeof name !== 'string') return [];
  const n = name.toLowerCase();
  const hit = PATTERNS.find(([res]) => res.some((re) => re.test(n)));
  return hit ? [...hit[1]] : [];
}

/** Sätze pro Muskel, geteilt durch die größte Summe: der meisttrainierte Muskel hat 1. */
export function muscleLoad(
  items: { exerciseId: string; sets: number }[],
  exercises: Exercise[],
): Partial<Record<Muscle, number>> {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const sums: Partial<Record<Muscle, number>> = {};
  for (const item of items) {
    const ex = byId.get(item.exerciseId);
    if (!ex || !(item.sets > 0)) continue;
    for (const m of parseMuscles(ex.muscles)) sums[m] = (sums[m] ?? 0) + item.sets;
  }
  const max = Math.max(0, ...Object.values(sums));
  const load: Partial<Record<Muscle, number>> = {};
  for (const [m, v] of Object.entries(sums) as [Muscle, number][]) load[m] = v / max;
  return load;
}

/** Storage used by ensureMuscleDefaults(); transaction() must run its callbacks one at a time. */
export interface MuscleDefaultsStore {
  transaction(fn: () => Promise<void>): Promise<void>;
  isDone(): Promise<boolean>;
  exercises(): Promise<Exercise[]>;
  update(id: string, muscles: Muscle[]): Promise<void>;
  markDone(): Promise<void>;
}

/** Einmalig: Übungen ohne Muskeln bekommen die Standard-Muskeln nach Namen; danach nie wieder. */
export function ensureMuscleDefaults(store: MuscleDefaultsStore): Promise<void> {
  return store.transaction(async () => {
    if (await store.isDone()) return;
    for (const ex of await store.exercises()) {
      if (parseMuscles(ex.muscles).length) continue;
      const muscles = defaultMuscles(ex.name);
      if (muscles.length) await store.update(ex.id, muscles);
    }
    await store.markDone();
  });
}

const dbStore: MuscleDefaultsStore = {
  transaction: (fn) => db.transaction('rw', db.exercises, db.meta, fn),
  isDone: async () => (await getMeta('muscleDefaults', false)) === true,
  exercises: () => db.exercises.toArray(),
  update: async (id, muscles) => { await db.exercises.update(id, { muscles }); },
  markDone: () => setMeta('muscleDefaults', true),
};

export function ensureMuscleDefaultsInDb(): Promise<void> {
  return ensureMuscleDefaults(dbStore);
}
