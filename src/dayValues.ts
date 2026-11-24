import type { DayValues } from './db';
import { lastDayKeys } from './habits';
import { isDayKey } from './profile';
import { fmtShortDate } from './util';
import { dayTs } from './weight';

export type DayField = 'steps' | 'kcal' | 'proteinG';
export type DayPatch = Partial<Pick<DayValues, DayField>>;

const FIELDS: DayField[] = ['steps', 'kcal', 'proteinG'];

function intIn(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
}

export const isValidSteps = (n: unknown): n is number => intIn(n, 0, 100000);
export const isValidKcal = (n: unknown): n is number => intIn(n, 0, 10000);
export const isValidProtein = (n: unknown): n is number => intIn(n, 0, 1000);

/** Felder aus dem Patch überschreiben, fehlende bleiben; manuell gesetzt. */
export function mergeDay(existing: DayValues | undefined, date: string, patch: DayPatch, now: number): DayValues {
  const next: DayValues = { ...existing, date, source: 'manual', updatedAt: now };
  for (const k of FIELDS) if (patch[k] !== undefined) next[k] = patch[k];
  return next;
}

/** Von Hand gesetzte Felder; alte manuelle Zeilen ohne Liste gelten komplett als manuell. */
export function manualFields(row: DayValues | undefined): DayField[] {
  if (!row) return [];
  if (row.manual) return row.manual;
  if (row.source === 'manual') return FIELDS.filter((k) => row[k] != null);
  return [];
}

/**
 * Manuelle Felder nach einer Eingabe von Hand; next sind die Werte der Zeile danach.
 * Bisher manuelle Felder mit Wert bleiben manuell, dazu kommt jedes geänderte Feld.
 * Ein unverändert übernommener (vorausgefüllter) Wert wird nicht manuell, ein geleertes Feld nicht mehr.
 */
export function nextManual(existing: DayValues | undefined, next: DayPatch): DayField[] {
  const before = manualFields(existing);
  return FIELDS.filter((k) => next[k] != null && (before.includes(k) || next[k] !== existing?.[k]));
}

/** Die letzten 7 lokalen Tage, ältester zuerst, heute zuletzt. */
export function stepsWeek(days: DayValues[], now: number): { date: string; steps: number | null }[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return lastDayKeys(now).slice(-7).map((date) => ({ date, steps: byDate.get(date)?.steps ?? null }));
}

export function goalProgress(value: number | null | undefined, goal: number): number {
  if (value == null || goal <= 0) return 0;
  return Math.min(Math.max(value / goal, 0), 1);
}

/** Kurvenpunkte der letzten 30 Tage für ein Feld, aufsteigend; Tage ohne Wert fehlen. */
export function dayTrend(days: DayValues[], field: DayField, now: number): { x: number; y: number; label: string }[] {
  const window = new Set(lastDayKeys(now));
  return days
    .filter((d) => window.has(d.date) && d[field] != null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((d) => ({ x: dayTs(d.date), y: d[field]!, label: fmtShortDate(dayTs(d.date)) }));
}

function isFieldList(x: unknown): boolean {
  return Array.isArray(x) && x.every((k) => FIELDS.includes(k as DayField)) && new Set(x).size === x.length;
}

export function isDayValuesList(x: unknown): x is DayValues[] {
  if (!Array.isArray(x)) return false;
  const seen = new Set<string>();
  for (const e of x) {
    if (typeof e !== 'object' || e == null || Array.isArray(e)) return false;
    const v = e as Record<string, unknown>;
    if (!isDayKey(v.date) || seen.has(v.date)) return false;
    for (const k of FIELDS) {
      const n = v[k];
      if (n !== undefined && (typeof n !== 'number' || !Number.isFinite(n) || n < 0)) return false;
    }
    const b = v.burnedKcal;
    if (b !== undefined && (typeof b !== 'number' || !Number.isFinite(b) || b < 0)) return false;
    if (v.manual !== undefined && !isFieldList(v.manual)) return false;
    if (v.source !== 'manual' && v.source !== 'health') return false;
    if (typeof v.updatedAt !== 'number' || !Number.isFinite(v.updatedAt)) return false;
    seen.add(v.date);
  }
  return true;
}

export type Goals = { kcal: number; proteinG: number; steps: number };

export const DEFAULT_GOALS: Goals = { kcal: 2200, proteinG: 160, steps: 8000 };

export const isValidKcalGoal = (n: unknown): n is number => intIn(n, 1000, 6000);
export const isValidProteinGoal = (n: unknown): n is number => intIn(n, 20, 400);
export const isValidStepsGoal = (n: unknown): n is number => intIn(n, 1000, 50000);

/** Gespeicherte Ziele (meta `goals`); fehlende oder ungültige Felder bekommen den Standard. */
export function parseGoals(value: unknown): Goals {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    kcal: isValidKcalGoal(v.kcal) ? v.kcal : DEFAULT_GOALS.kcal,
    proteinG: isValidProteinGoal(v.proteinG) ? v.proteinG : DEFAULT_GOALS.proteinG,
    steps: isValidStepsGoal(v.steps) ? v.steps : DEFAULT_GOALS.steps,
  };
}
