import type { Session } from './db';
import { weekStart } from './streak';
import { dayKey } from './weight';

export const HABIT_DAYS = 30;

/** Die 30 lokalen Tage bis heute (YYYY-MM-DD), ältester zuerst, heute zuletzt. */
export function lastDayKeys(now: number): string[] {
  const d = new Date(now);
  return Array.from({ length: HABIT_DAYS }, (_, i) =>
    dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - (HABIT_DAYS - 1 - i)).getTime()),
  );
}

/** Lokale Tage (nach startedAt) der abgeschlossenen Trainings. */
export function sessionDayKeys(sessions: Pick<Session, 'startedAt' | 'finishedAt'>[]): Set<string> {
  return new Set(sessions.filter((s) => s.finishedAt != null).map((s) => dayKey(s.startedAt)));
}

/** 30 Punkte in der Reihenfolge von lastDayKeys: true, wenn der Tag Daten hat. */
export function dotGrid(days: Set<string>, now: number): boolean[] {
  return lastDayKeys(now).map((k) => days.has(k));
}

/** Tage der laufenden Woche (Mo–So), nicht nach heute, die in days vorkommen. */
export function weekDayCount(days: Set<string>, now: number): number {
  const start = weekStart(now);
  const today = dayKey(now);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const k = dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i).getTime());
    if (k <= today && days.has(k)) n++;
  }
  return n;
}

/** Abgeschlossene Trainings der laufenden Woche (Mo–So, nicht nach heute); jede Session zählt. */
export function weekSessionCount(sessions: Pick<Session, 'startedAt' | 'finishedAt'>[], now: number): number {
  const start = weekStart(now).getTime();
  return sessions.filter((s) => s.finishedAt != null && s.startedAt >= start && s.startedAt <= now).length;
}
