export const BACKUP_APP = 'kalisthenik-tracker';

export function isBackup(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as { app?: unknown; sessions?: unknown; exercises?: unknown; templates?: unknown };
  return d.app === BACKUP_APP && Array.isArray(d.sessions) && Array.isArray(d.exercises) && Array.isArray(d.templates);
}
