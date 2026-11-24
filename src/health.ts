import type { DayValues } from './db';
import { isValidKcal, isValidProtein, isValidSteps, manualFields, type DayField, type DayPatch } from './dayValues';
import { lastDayKeys } from './habits';
import { isDayKey } from './profile';
import { dayKey } from './weight';

/** Apple-Health-Abgleich über den eigenen Server (meta `health`), nur auf diesem Gerät. */
export type HealthConfig = { url: string; token: string; shortcut: string };

/** Ergebnis des letzten Abgleichs (meta `healthStatus`). */
export type HealthStatus = { lastSync: number | null; error: string | null };

/** Ein Tag vom Server, schon auf die App-Grenzen gebracht. */
export type RemoteDay = { date: string } & DayPatch;

export type SyncResult =
  | { kind: 'skipped' } // nicht eingerichtet, keine Anfrage
  | { kind: 'synced'; error: string | null } // gespeichert; error nur, wenn das Löschen alter Tage fehlschlug
  | { kind: 'failed'; error: string };

export const DEFAULT_SHORTCUT = 'Calisthenics Sync';
export const SYNC_INTERVAL_MS = 60000;
export const TIMEOUT_MS = 10000;

const FIELDS: DayField[] = ['steps', 'kcal', 'proteinG'];

export const ERRORS = {
  network: 'Keine Verbindung zum Server',
  unauthorized: 'Schlüssel ungültig',
  misconfigured: 'Server nicht eingerichtet (kein Schlüssel gesetzt)',
  invalid: 'Ungültige Antwort vom Server',
  save: 'Speichern fehlgeschlagen',
  delete: 'Alte Tage konnten nicht gelöscht werden',
};

/** Ohne Leerraum und ohne abschließende "/". */
export function normalizeUrl(s: string): string {
  return s.trim().replace(/\/+$/, '');
}

export function isValidServerUrl(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const v = normalizeUrl(s);
  if (v.includes('?') || v.includes('#')) return false;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return false;
  }
  if (u.username || u.password || u.search || u.hash) return false;
  if (u.protocol === 'https:') return true;
  return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
}

/** Passt zur Server-Prüfung `Bearer (\S+)`: druckbares ASCII ohne Leerzeichen. */
export function isValidToken(s: unknown): s is string {
  return typeof s === 'string' && s.length >= 1 && s.length <= 512 && /^[\x21-\x7E]+$/.test(s);
}

export function parseHealthConfig(value: unknown): HealthConfig {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const shortcut = typeof v.shortcut === 'string' ? v.shortcut.trim() : '';
  return {
    url: typeof v.url === 'string' ? v.url : '',
    token: typeof v.token === 'string' ? v.token : '',
    shortcut: shortcut || DEFAULT_SHORTCUT,
  };
}

export function isConfigured(c: HealthConfig): boolean {
  return isValidServerUrl(c.url) && isValidToken(c.token);
}

export function parseHealthStatus(value: unknown): HealthStatus {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    lastSync: typeof v.lastSync === 'number' && Number.isFinite(v.lastSync) ? v.lastSync : null,
    error: typeof v.error === 'string' ? v.error : null,
  };
}

/** Neuer Status nach einem Lauf; ein Fehler lässt die letzte Aktualisierung stehen. */
export function nextStatus(prev: HealthStatus, result: SyncResult, now: number): HealthStatus {
  if (result.kind === 'skipped') return prev;
  if (result.kind === 'failed') return { lastSync: prev.lastSync, error: result.error };
  return { lastSync: now, error: result.error };
}

/** Höchstens ein Abgleich pro Minute, gemessen ab dem Start des letzten Versuchs. */
export function shouldSync(lastAttempt: number | null, now: number, force: boolean): boolean {
  return force || lastAttempt == null || now - lastAttempt >= SYNC_INTERVAL_MS;
}

/** Der lokale Kalendertag vor heute. */
export function yesterdayKey(now: number): string {
  const d = new Date(now);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime());
}

export function shortcutUrl(name: string): string {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
}

/** z. B. "abcd…"; der Schlüssel wird nie ganz angezeigt. */
export function maskToken(token: string): string {
  return token ? `${token.slice(0, 4)}…` : '';
}

export function errorForStatus(status: number): string {
  if (status === 401) return ERRORS.unauthorized;
  if (status === 500) return ERRORS.misconfigured;
  return `Server-Fehler (${status})`;
}

const LIMITS: Record<DayField, { max: number; int: boolean }> = {
  steps: { max: 200000, int: true },
  kcal: { max: 20000, int: false },
  proteinG: { max: 1000, int: false },
};

const APP_VALID: Record<DayField, (n: unknown) => boolean> = {
  steps: isValidSteps,
  kcal: isValidKcal,
  proteinG: isValidProtein,
};

function inServerRange(n: unknown, k: DayField): n is number {
  const l = LIMITS[k];
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= l.max && (!l.int || Number.isInteger(n));
}

/**
 * Prüft die Antwort von GET /v1/days streng; null = ungültig, dann wird nichts gespeichert.
 * kcal und Protein werden gerundet, Werte außerhalb der App-Grenzen fallen weg,
 * Tage nach heute und Tage ohne Wert werden übersprungen.
 */
export function parseDaysResponse(status: number, body: string, now: number): RemoteDay[] | null {
  if (status !== 200) return null;
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const days = (data as { days?: unknown }).days;
  if (!Array.isArray(days)) return null;
  const today = dayKey(now);
  const seen = new Set<string>();
  const out: RemoteDay[] = [];
  for (const e of days) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
    const v = e as Record<string, unknown>;
    if (Object.keys(v).some((k) => k !== 'date' && !(FIELDS as string[]).includes(k))) return null;
    if (!isDayKey(v.date) || seen.has(v.date)) return null;
    seen.add(v.date);
    const day: RemoteDay = { date: v.date };
    for (const k of FIELDS) {
      if (!(k in v)) continue;
      if (!inServerRange(v[k], k)) return null;
      const n = k === 'steps' ? v[k] as number : Math.round(v[k] as number);
      if (APP_VALID[k](n)) day[k] = n;
    }
    if (day.date > today || FIELDS.every((k) => day[k] === undefined)) continue;
    out.push(day);
  }
  return out;
}

/**
 * Health-Werte in eine Zeile übernehmen: von Hand gesetzte Felder bleiben,
 * alle anderen kommen vom Server oder fallen weg, wenn der Server sie nicht hat.
 */
export function mergeHealth(existing: DayValues | undefined, remote: RemoteDay, now: number): DayValues {
  const keep = manualFields(existing);
  const next: DayValues = { date: remote.date, source: 'health', updatedAt: now };
  const manual: DayField[] = [];
  for (const k of FIELDS) {
    const own = existing?.[k];
    if (keep.includes(k) && own != null) {
      next[k] = own;
      manual.push(k);
    } else if (remote[k] !== undefined) {
      next[k] = remote[k];
    }
  }
  if (manual.length) {
    next.manual = manual;
    next.source = 'manual';
  }
  return next;
}

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

/** Eine Anfrage mit Schlüssel im Header und 10 s Zeitlimit; null = keine Verbindung. */
async function request(fetchFn: FetchFn, url: string, method: 'GET' | 'DELETE', token: string): Promise<{ status: number; body: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      credentials: 'omit',
      signal: ctrl.signal,
    });
    return { status: res.status, body: await res.text() };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Holt die letzten 30 Tage, speichert sie über save und löscht danach auf dem Server alles bis gestern.
 * Wirft nie; jeder Fehler wird ein Ergebnis mit deutschem Text (ohne Schlüssel).
 */
export async function runHealthSync(
  config: HealthConfig,
  now: number,
  fetchFn: FetchFn,
  save: (days: RemoteDay[]) => Promise<void>,
): Promise<SyncResult> {
  if (!isConfigured(config)) return { kind: 'skipped' };
  const base = normalizeUrl(config.url);
  const got = await request(fetchFn, `${base}/v1/days?since=${lastDayKeys(now)[0]}`, 'GET', config.token);
  if (!got) return { kind: 'failed', error: ERRORS.network };
  if (got.status < 200 || got.status > 299) return { kind: 'failed', error: errorForStatus(got.status) };
  const days = parseDaysResponse(got.status, got.body, now);
  if (!days) return { kind: 'failed', error: ERRORS.invalid };
  try {
    await save(days);
  } catch {
    return { kind: 'failed', error: ERRORS.save };
  }
  const del = await request(fetchFn, `${base}/v1/days?until=${yesterdayKey(now)}`, 'DELETE', config.token);
  const deleted = del != null && del.status >= 200 && del.status <= 299;
  return { kind: 'synced', error: deleted ? null : ERRORS.delete };
}
