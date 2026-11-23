import { db, getMeta, setMeta, type Session, type Template } from './db';
import { entryNoon } from './entryDay';
import { uid } from './util';
import { dayKey } from './weight';

type Kinded = { kind?: unknown };

export function isCardio(t: Kinded): boolean {
  return t.kind === 'cardio';
}

export function isCardioSession(s: Kinded): boolean {
  return s.kind === 'cardio';
}

/** Krafttage und Krafttrainings: alles ohne kind 'cardio' (auch alte Daten und Backups). */
export function strengthOnly<T extends Kinded>(items: T[]): T[] {
  return items.filter((x) => x.kind !== 'cardio');
}

export function cardioOnly<T extends Kinded>(items: T[]): T[] {
  return items.filter((x) => x.kind === 'cardio');
}

/** "30 min · Laufen", "30 min", "Laufen" oder "Erledigt"; ungültige Werte (z. B. aus Backups) werden ignoriert. */
export function cardioSummary(s: { minutes?: unknown; note?: unknown }): string {
  const parts: string[] = [];
  const min = typeof s.minutes === 'number' && Number.isFinite(s.minutes) ? Math.round(s.minutes) : 0;
  if (min > 0) parts.push(`${min} min`);
  if (typeof s.note === 'string' && s.note.trim()) parts.push(s.note.trim());
  return parts.length ? parts.join(' · ') : 'Erledigt';
}

/** Abgehaktes Cardio als abgeschlossene Session; day = anderer Tag (YYYY-MM-DD), sonst jetzt. */
export function cardioSession(
  template: Pick<Template, 'id' | 'name'>,
  day: string | undefined,
  minutes: number | null,
  note: string,
  now: number,
): Session {
  const at = day && day !== dayKey(now) ? entryNoon(day) : now;
  const session: Session = {
    id: uid(),
    templateId: template.id,
    templateName: template.name,
    startedAt: at,
    finishedAt: at,
    entries: [],
    kind: 'cardio',
  };
  if (minutes != null && Number.isFinite(minutes) && Math.round(minutes) > 0) session.minutes = Math.round(minutes);
  if (note.trim()) session.note = note.trim();
  return session;
}

export async function logCardio(template: Template, day: string | undefined, minutes: number | null, note: string) {
  await db.sessions.add(cardioSession(template, day, minutes, note, Date.now()));
}

/** Storage used by ensureCardioDay(); transaction() must run its callbacks one at a time. */
export interface CardioDayStore {
  transaction(fn: () => Promise<void>): Promise<void>;
  isDone(): Promise<boolean>;
  templates(): Promise<Template[]>;
  add(template: Template): Promise<void>;
  markDone(): Promise<void>;
}

/** Einmalig: legt den Cardio-Tag (Mittwoch) an, falls es noch keinen gibt; danach nie wieder. */
export function ensureCardioDay(store: CardioDayStore): Promise<void> {
  return store.transaction(async () => {
    if (await store.isDone()) return;
    const templates = await store.templates();
    if (!templates.some(isCardio)) {
      const order = templates.length ? Math.max(...templates.map((t) => t.order)) + 1 : 0;
      await store.add({ id: uid(), name: 'Cardio', weekdays: [3], kind: 'cardio', order, slots: [] });
    }
    await store.markDone();
  });
}

const dbStore: CardioDayStore = {
  transaction: (fn) => db.transaction('rw', db.templates, db.meta, fn),
  isDone: async () => (await getMeta('cardioDay', false)) === true,
  templates: () => db.templates.toArray(),
  add: async (t) => { await db.templates.add(t); },
  markDone: () => setMeta('cardioDay', true),
};

export function ensureCardioDayInDb(): Promise<void> {
  return ensureCardioDay(dbStore);
}
