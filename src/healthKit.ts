import type { DayValues } from './db';
import { isValidKcal, isValidProtein, isValidSteps, type DayField } from './dayValues';
import { lastDayKeys } from './habits';
import { ERRORS, type RemoteDay, type SyncResult } from './health';
import { isDayKey } from './profile';
import { fmtInt } from './util';
import { dayKey } from './weight';

// Apple Health direkt aus HealthKit (native App, Plugin "HealthDays"); ohne db und ohne Brücke, damit es testbar bleibt.

export const HEALTHKIT_ERRORS = {
  read: 'Apple Health konnte nicht gelesen werden',
  invalid: 'Ungültige Antwort von Apple Health',
};

const FIELDS: DayField[] = ['steps', 'kcal', 'proteinG'];
const KEYS = ['date', ...FIELDS, 'activeKcal', 'basalKcal'];

const APP_VALID: Record<DayField, (n: unknown) => boolean> = {
  steps: isValidSteps,
  kcal: isValidKcal,
  proteinG: isValidProtein,
};

const isAmount = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/**
 * Prüft die Antwort des Plugins streng; null = ungültig, dann wird nichts gespeichert.
 * Werte werden gerundet, Werte außerhalb der App-Grenzen fallen weg. Verbraucht = Aktiv- + Ruheenergie,
 * nur wenn beide da sind. Tage nach heute und Tage ohne Wert werden übersprungen.
 */
export function parseNativeDays(value: unknown, now: number): RemoteDay[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const days = (value as { days?: unknown }).days;
  if (!Array.isArray(days)) return null;
  const today = dayKey(now);
  const seen = new Set<string>();
  const out: RemoteDay[] = [];
  for (const e of days) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
    const v = e as Record<string, unknown>;
    if (Object.keys(v).some((k) => !KEYS.includes(k))) return null;
    if (!isDayKey(v.date) || seen.has(v.date)) return null;
    seen.add(v.date);
    const day: RemoteDay = { date: v.date };
    for (const k of FIELDS) {
      if (!(k in v)) continue;
      if (!isAmount(v[k])) return null;
      const n = Math.round(v[k]);
      if (APP_VALID[k](n)) day[k] = n;
    }
    const { activeKcal, basalKcal } = v;
    if ('activeKcal' in v && !isAmount(activeKcal)) return null;
    if ('basalKcal' in v && !isAmount(basalKcal)) return null;
    if (isAmount(activeKcal) && isAmount(basalKcal)) {
      const burned = Math.round(activeKcal + basalKcal);
      if (isValidKcal(burned)) day.burnedKcal = burned;
    }
    if (day.date > today || (day.burnedKcal === undefined && FIELDS.every((k) => day[k] === undefined))) continue;
    out.push(day);
  }
  return out;
}

/**
 * Liest die letzten 30 Tage aus HealthKit und speichert sie über save.
 * Wirft nie; jeder Fehler wird ein Ergebnis mit deutschem Text.
 */
export async function runNativeHealthSync(
  read: (since: string) => Promise<unknown>,
  now: number,
  save: (days: RemoteDay[]) => Promise<void>,
): Promise<SyncResult> {
  let answer: unknown;
  try {
    answer = await read(lastDayKeys(now)[0]);
  } catch {
    return { kind: 'failed', error: HEALTHKIT_ERRORS.read };
  }
  const days = parseNativeDays(answer, now);
  if (!days) return { kind: 'failed', error: HEALTHKIT_ERRORS.invalid };
  try {
    await save(days);
  } catch {
    return { kind: 'failed', error: ERRORS.save };
  }
  return { kind: 'synced', error: null };
}

/** Verbrauchte Kalorien des Tages und die Bilanz (gegessen − verbraucht); null ohne verbrauchte Kalorien. */
export function kcalBalance(day: DayValues | undefined): { burned: number; balance: number | null } | null {
  if (day?.burnedKcal == null) return null;
  return { burned: day.burnedKcal, balance: day.kcal != null ? day.kcal - day.burnedKcal : null };
}

/** z. B. "−450", "+120", "±0". */
export function fmtBalance(n: number): string {
  const r = Math.round(n);
  if (r === 0) return '±0';
  return `${r < 0 ? '−' : '+'}${fmtInt(Math.abs(r))}`;
}
