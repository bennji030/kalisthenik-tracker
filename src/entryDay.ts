import type { Template } from './db';
import type { EntryDay } from './sessions';
import { isDayKey } from './profile';
import { dayTs } from './weight';

/** 12:00 Uhr (lokal) des Tages YYYY-MM-DD; Mittag ist sicher gegen Zeitumstellungen. */
export function entryNoon(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

/** Vorauswahl: der Plan des Wochentags, sonst der nächste geplante Tag danach, sonst der erste Plan. */
export function defaultTemplate<T extends Pick<Template, 'id' | 'weekdays'>>(templates: T[], day: string): T | undefined {
  const wd = new Date(dayTs(day)).getDay();
  for (let i = 0; i < 7; i++) {
    const t = templates.find((x) => x.weekdays.includes((wd + i) % 7));
    if (t) return t;
  }
  return templates[0];
}

/** Gespeicherte Zeiten: Mittag des gewählten Tages plus die echte Dauer. */
export function entryTimes(day: string, realStart: number, now: number): { startedAt: number; finishedAt: number } {
  const startedAt = entryNoon(day);
  return { startedAt, finishedAt: startedAt + Math.max(0, now - realStart) };
}

/** Der gewählte Tag, nur wenn der Eintrag zu dieser Session gehört und ein echtes Datum ist. */
export function entryDayFor(entry: EntryDay | null | undefined, sessionId: string): string | null {
  return entry && entry.sessionId === sessionId && isDayKey(entry.day) ? entry.day : null;
}
