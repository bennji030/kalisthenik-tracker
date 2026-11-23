import type { Session } from './db';
import { dayKey } from './weight';

export const MIN_MONTHS = 3;

export type MonthRef = { year: number; month: number };

/** Monate (month 0-basiert) von now rückwärts bis zum Monat von earliest (YYYY-MM-DD), mindestens 3; neuester zuerst. */
export function monthList(earliest: string | null, now: number): MonthRef[] {
  const d = new Date(now);
  let n = MIN_MONTHS;
  if (earliest) {
    const [y, m] = earliest.split('-').map(Number);
    n = Math.max(n, (d.getFullYear() - y) * 12 + d.getMonth() - (m - 1) + 1);
  }
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    return { year: x.getFullYear(), month: x.getMonth() };
  });
}

/** Frühester Tag-Key einer Menge, sonst null. */
export function earliestKey(days: Iterable<string>): string | null {
  let min: string | null = null;
  for (const k of days) if (min === null || k < min) min = k;
  return min;
}

function prefix(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Abgeschlossene Trainings, die im Monat gestartet wurden (lokal); jede Session zählt. */
export function sessionMonthCount(sessions: Pick<Session, 'startedAt' | 'finishedAt'>[], year: number, month: number): number {
  const p = prefix(year, month);
  return sessions.filter((s) => s.finishedAt != null && dayKey(s.startedAt).startsWith(p)).length;
}

/** Tage aus days, die im Monat liegen. */
export function dayMonthCount(days: Set<string>, year: number, month: number): number {
  const p = prefix(year, month);
  let n = 0;
  for (const k of days) if (k.startsWith(p)) n++;
  return n;
}

export function sessionSummary(n: number): string {
  return n === 1 ? '1 Training' : `${n} Trainings`;
}

export function weighSummary(n: number): string {
  return n === 1 ? '1 Tag gewogen' : `${n} Tage gewogen`;
}
