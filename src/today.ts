import type { Slot, Template, WeightEntry } from './db';
import { lastDayKeys } from './habits';
import { WEEKDAYS_LONG, fmtShortDate } from './util';
import { dayTs, rollingAverages } from './weight';

/** Sekunden Arbeit pro Satz; die Pause nach dem letzten Satz zählt als Wechselzeit. */
const SET_WORK_SEC = 45;

/** Geschätzte Dauer in Minuten, auf 5 gerundet, mindestens 5; 0 ohne Übungen. */
export function estimateMinutes(slots: Pick<Slot, 'sets' | 'restSec'>[]): number {
  if (!slots.length) return 0;
  const sec = slots.reduce((s, x) => s + x.sets * (SET_WORK_SEC + x.restSec), 0);
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

/** Nächster geplanter Trainingstag in den 7 Tagen nach heute. */
export function nextTraining(
  templates: Pick<Template, 'name' | 'weekdays'>[],
  now: number,
): { label: string; names: string[] } | null {
  const today = new Date(now).getDay();
  for (let i = 1; i <= 7; i++) {
    const wd = (today + i) % 7;
    const names = templates.filter((t) => t.weekdays.includes(wd)).map((t) => t.name);
    if (names.length) return { label: i === 1 ? 'Morgen' : WEEKDAYS_LONG[wd], names };
  }
  return null;
}

/** 7-Tage-Schnitt der letzten 30 Tage; der Schnitt nutzt auch ältere Einträge. */
export function weightTrend(entries: WeightEntry[], now: number): { x: number; y: number; label: string }[] {
  const first = lastDayKeys(now)[0];
  return rollingAverages(entries)
    .filter((p) => p.date >= first)
    .map((p) => ({ x: dayTs(p.date), y: p.avg, label: fmtShortDate(dayTs(p.date)) }));
}
