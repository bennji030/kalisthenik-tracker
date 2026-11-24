import { useEffect, useSyncExternalStore } from 'react';
import { isSyncRunning, subscribeSyncRunning, syncHealth, takeForceNext } from './healthSync';

/** Holt Health-Daten einmal nach dem Start und bei jeder Rückkehr in die App. */
export function useHealthSync(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    void syncHealth(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncHealth(takeForceNext());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [ready]);
}

export function useSyncRunning(): boolean {
  return useSyncExternalStore(subscribeSyncRunning, isSyncRunning);
}
