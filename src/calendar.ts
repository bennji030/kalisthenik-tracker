import type { Template } from './db';
import { weekStart } from './streak';
import { dayKey, dayTs } from './weight';

export type DayStatus = 'done' | 'open' | 'missed' | 'none' | 'cardio' | 'cardio-open';

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

/** Vorrang: Kraft erledigt > Cardio erledigt > Kraft geplant > Cardio geplant > nichts. */
export function dayStatus(
  key: string,
  todayKey: string,
  doneDays: Set<string>,
  plannedWeekdays: Set<number>,
  cardioDays: Set<string> = new Set(),
  cardioWeekdays: Set<number> = new Set(),
): DayStatus {
  if (doneDays.has(key)) return 'done';
  if (cardioDays.has(key)) return 'cardio';
  const wd = new Date(dayTs(key)).getDay();
  if (plannedWeekdays.has(wd)) return key >= todayKey ? 'open' : 'missed';
  if (cardioWeekdays.has(wd)) return key >= todayKey ? 'cardio-open' : 'missed';
  return 'none';
}

export function plannedWeekdays(templates: Pick<Template, 'weekdays'>[]): Set<number> {
  return new Set(templates.flatMap((t) => t.weekdays));
}
