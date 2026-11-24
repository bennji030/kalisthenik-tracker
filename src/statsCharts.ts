import type { DayValues, Session, WeightEntry } from './db';
import { isCardioSession } from './cardio';
import { lastDayKeys } from './habits';
import { weekStart } from './streak';
import { dayKey, roundKg } from './weight';

export const CARDIO_WEEKS = 8;

/** Gewichtseinträge der letzten 7 lokalen Tage (heute eingeschlossen), älteste zuerst. */
export function weightWeek(entries: WeightEntry[], now: number): WeightEntry[] {
  const keys = new Set(lastDayKeys(now).slice(-7));
  return entries.filter((e) => keys.has(e.date)).sort((a, b) => a.date.localeCompare(b.date));
}

/** Neuester minus ältester Eintrag, auf 0,1 gerundet; null unter 2 Einträgen. */
export function weightWeekChange(points: WeightEntry[]): number | null {
  if (points.length < 2) return null;
  return roundKg(points[points.length - 1].kg - points[0].kg);
}

/** Genau 7 Tage (heute zuletzt); Tage ohne Zeile oder ohne das Feld sind null. */
export function dayBars(days: DayValues[], field: 'kcal' | 'proteinG', now: number): { date: string; value: number | null }[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return lastDayKeys(now).slice(-7).map((date) => ({ date, value: byDate.get(date)?.[field] ?? null }));
}

/** Genau 8 Wochen (Mo–So, laufende zuletzt) mit der Zahl abgeschlossener Cardio-Einträge. */
export function cardioWeeks(sessions: Pick<Session, 'startedAt' | 'finishedAt' | 'kind'>[], now: number): { start: string; count: number }[] {
  const first = weekStart(now);
  const starts = Array.from({ length: CARDIO_WEEKS }, (_, i) =>
    dayKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() - 7 * (CARDIO_WEEKS - 1 - i)).getTime()));
  const counts = new Map(starts.map((s) => [s, 0]));
  for (const s of sessions) {
    if (!s.finishedAt || !isCardioSession(s)) continue;
    const k = dayKey(weekStart(s.startedAt).getTime());
    if (counts.has(k)) counts.set(k, counts.get(k)! + 1);
  }
  return starts.map((start) => ({ start, count: counts.get(start)! }));
}
