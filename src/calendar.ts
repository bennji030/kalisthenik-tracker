import type { Template } from './db';
import { weekStart } from './streak';
import { dayKey, dayTs } from './weight';

export type DayStatus = 'done' | 'open' | 'missed' | 'none';

/** Die 7 Tage-Keys (Mo–So) der Woche, die key enthält. */
export function weekKeys(key: string): string[] {
  const s = weekStart(dayTs(key));
  return Array.from({ length: 7 }, (_, i) => dayKey(new Date(s.getFullYear(), s.getMonth(), s.getDate() + i).getTime()));
}

/** Monat (month 0-basiert) als Wochen Mo–So; null = Füllzelle vor dem 1. und nach dem letzten Tag. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => dayKey(new Date(year, month, i + 1).getTime())),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export function dayStatus(
  key: string,
  todayKey: string,
  doneDays: Set<string>,
  plannedWeekdays: Set<number>,
): DayStatus {
  if (doneDays.has(key)) return 'done';
  if (!plannedWeekdays.has(new Date(dayTs(key)).getDay())) return 'none';
  return key >= todayKey ? 'open' : 'missed';
}

export function plannedWeekdays(templates: Pick<Template, 'weekdays'>[]): Set<number> {
  return new Set(templates.flatMap((t) => t.weekdays));
}
