// Brücke zur nativen iOS-Hülle (Capacitor). Im Browser ist alles ein No-op.
// Bewusst ohne Capacitor-Pakete: die Hülle stellt window.Capacitor.nativePromise selbst bereit.
import type { NowPlayingEntry } from './lockScreen';

export interface Bridge {
  nativePromise(plugin: string, method: string, options?: unknown): Promise<unknown>;
  isPluginAvailable?(name: string): boolean;
}

export const REST_NOTICE_ID = 1;

export function bridgeOf(w: unknown): Bridge | null {
  const cap = w && typeof w === 'object' ? (w as { Capacitor?: unknown }).Capacitor : undefined;
  if (!cap || typeof cap !== 'object') return null;
  const c = cap as { nativePromise?: unknown; isNativePlatform?: () => boolean };
  if (typeof c.nativePromise !== 'function') return null;
  if (typeof c.isNativePlatform !== 'function' || !c.isNativePlatform()) return null;
  return cap as Bridge;
}

/** Name der Übung, mit der es nach der Pause weitergeht (der gerade abgehakte Satz zählt schon als erledigt). */
export function nextExercise(entries: NowPlayingEntry[], ei: number): string | null {
  const open = (e: NowPlayingEntry | undefined) => !!e?.name && e.sets.some((s) => !s.done);
  if (open(entries[ei])) return entries[ei].name!;
  return entries.find(open)?.name ?? null;
}

/** Nächster Satz nach der Pause für die Live Activity, z. B. „Dips“ / „Satz 2/4“; gleiche Übungsregel wie nextExercise. */
export function nextSet(entries: NowPlayingEntry[], ei: number): { exercise: string; set: string } | null {
  const open = (e: NowPlayingEntry | undefined) => !!e?.name && e.sets.some((s) => !s.done);
  const e = open(entries[ei]) ? entries[ei] : entries.find(open);
  if (!e) return null;
  return { exercise: e.name!, set: `Satz ${e.sets.findIndex((s) => !s.done) + 1}/${e.sets.length}` };
}

export function restNotice(exercise: string | null): { title: string; body: string } {
  return { title: 'Pause vorbei', body: exercise ? `Weiter mit ${exercise}` : 'Weiter geht’s' };
}

export interface Native {
  requestPermission(): Promise<void>;
  scheduleRest(endAt: number, exercise: string | null, sound: boolean, now?: number): Promise<void>;
  cancelRest(): Promise<void>;
  tap(): Promise<void>;
  success(): Promise<void>;
  startRest(endAt: number, exercise: string, set: string, now?: number): Promise<void>;
  updateRest(endAt: number, now?: number): Promise<void>;
  endRest(): Promise<void>;
}

export function createNative(bridge: Bridge | null): Native {
  let queue: Promise<void> = Promise.resolve();
  let asked = false;
  // Aufrufe strikt nacheinander, damit „planen, dann abbrechen“ nicht vertauscht wird; Fehler werden geschluckt.
  const call = (plugin: string, method: string, options?: unknown): Promise<void> => {
    if (!bridge) return Promise.resolve();
    queue = queue.then(() => bridge.nativePromise(plugin, method, options)).then(() => undefined, () => undefined);
    return queue;
  };
  const cancelRest = () => call('LocalNotifications', 'cancel', { notifications: [{ id: REST_NOTICE_ID }] });
  // Live Activity: das Plugin gibt es nur, wenn es in Xcode von Hand eingebaut wurde (native/README.md, Abschnitt 16).
  const activity = (method: string, options?: unknown): Promise<void> =>
    bridge?.isPluginAvailable?.('RestActivity') === true ? call('RestActivity', method, options) : Promise.resolve();
  const endRest = () => activity('endRest');
  return {
    requestPermission() {
      if (!bridge || asked) return Promise.resolve();
      asked = true;
      return call('LocalNotifications', 'requestPermissions');
    },
    scheduleRest(endAt, exercise, sound, now = Date.now()) {
      if (endAt <= now) return cancelRest();
      const notification = {
        id: REST_NOTICE_ID,
        ...restNotice(exercise),
        schedule: { at: new Date(endAt) },
        silent: true,
        ...(sound ? { sound: 'rest.wav' } : {}),
      };
      return call('LocalNotifications', 'schedule', { notifications: [notification] });
    },
    cancelRest,
    tap: () => call('Haptics', 'impact', { style: 'LIGHT' }),
    success: () => call('Haptics', 'notification', { type: 'SUCCESS' }),
    startRest(endAt, exercise, set, now = Date.now()) {
      if (endAt <= now) return endRest();
      return activity('startRest', { endsAt: endAt, exercise, set });
    },
    updateRest(endAt, now = Date.now()) {
      if (endAt <= now) return endRest();
      return activity('updateRest', { endsAt: endAt });
    },
    endRest,
  };
}

export const native = createNative(bridgeOf(globalThis.window));
