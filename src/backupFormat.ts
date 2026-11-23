export const BACKUP_APP = 'kalisthenik-tracker';

export function isBackup(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as { app?: unknown; sessions?: unknown };
  return d.app === BACKUP_APP && Array.isArray(d.sessions);
}
