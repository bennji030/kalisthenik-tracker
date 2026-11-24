import type { Meta } from './db';

export const BACKUP_APP = 'kalisthenik-tracker';

export function isBackup(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as { app?: unknown; sessions?: unknown; exercises?: unknown; templates?: unknown };
  return d.app === BACKUP_APP && Array.isArray(d.sessions) && Array.isArray(d.exercises) && Array.isArray(d.templates);
}

/** Bleiben auf dem Gerät: weder exportiert noch beim Import ersetzt (Server-Adresse und Schlüssel). */
export const DEVICE_META_KEYS = ['health', 'healthStatus'];

/** Meta-Zeilen für den Export: ohne lastBackup und ohne gerätelokale Schlüssel. */
export function exportMeta(meta: Meta[]): Meta[] {
  return meta.filter((m) => m.key !== 'lastBackup' && !DEVICE_META_KEYS.includes(m.key));
}

/** Meta-Zeilen nach dem Import: die des Backups ohne gerätelokale Schlüssel, dazu die bisherigen Gerätewerte. */
export function importMeta(backup: Meta[], device: (Meta | undefined)[]): Meta[] {
  const kept = device.filter((m): m is Meta => m != null && DEVICE_META_KEYS.includes(m.key));
  return [...backup.filter((m) => !DEVICE_META_KEYS.includes(m.key)), ...kept];
}
