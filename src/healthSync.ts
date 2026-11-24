import { db, getMeta, setMeta } from './db';
import {
  isConfigured, mergeHealth, nextStatus, parseHealthConfig, parseHealthStatus, runHealthSync, shouldSync,
  type RemoteDay, type SyncResult,
} from './health';
import { runNativeHealthSync } from './healthKit';
import { native } from './native';

// Nur im Speicher: ein frischer App-Start holt immer.
let lastAttempt: number | null = null;
let running = false;
let forceNext = false;
const listeners = new Set<() => void>();

function setRunning(v: boolean) {
  running = v;
  listeners.forEach((l) => l());
}

export function isSyncRunning(): boolean {
  return running;
}

export function subscribeSyncRunning(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Der nächste Wechsel zurück in die App holt sofort, ohne die Minute abzuwarten. */
export function forceNextSync() {
  forceNext = true;
}

export function takeForceNext(): boolean {
  const f = forceNext;
  forceNext = false;
  return f;
}

/** Schreibt alle Tage in einer Transaktion; von Hand gesetzte Felder bleiben. */
async function saveHealthDays(days: RemoteDay[]) {
  await db.transaction('rw', db.days, async () => {
    const existing = await db.days.bulkGet(days.map((d) => d.date));
    const now = Date.now();
    await db.days.bulkPut(days.map((d, i) => mergeHealth(existing[i], d, now)));
  });
}

/** Ein Abgleich mit dem Server, in der nativen App direkt mit HealthKit; null = gedrosselt oder läuft schon. Wirft nie. */
export async function syncHealth(force: boolean): Promise<SyncResult | null> {
  if (running) return null;
  setRunning(true);
  try {
    const config = parseHealthConfig(await getMeta<unknown>('health', undefined));
    // Die native App nutzt nie den Server, nur HealthKit, und das erst nach „Zugriff erlauben“.
    const viaKit = native.isNative();
    if (viaKit ? !(native.healthAvailable() && config.healthKit === true) : !isConfigured(config)) return { kind: 'skipped' };
    const now = Date.now();
    if (!shouldSync(lastAttempt, now, force)) return null;
    lastAttempt = now;
    const result = viaKit
      ? await runNativeHealthSync(native.readHealthDays, now, saveHealthDays)
      : await runHealthSync(config, now, (input, init) => fetch(input, init), saveHealthDays);
    await db.transaction('rw', db.meta, async () => {
      const prev = parseHealthStatus(await getMeta<unknown>('healthStatus', undefined));
      await setMeta('healthStatus', nextStatus(prev, result, Date.now()));
    });
    return result;
  } catch {
    return null;
  } finally {
    setRunning(false);
  }
}
