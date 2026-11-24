import { beepWav, silentWav } from './lockScreen';

type Action = MediaSessionAction;
const ACTIONS: Action[] = ['nexttrack', 'play', 'pause', 'previoustrack', 'seekbackward', 'seekforward', 'seekto'];

let el: HTMLAudioElement | null = null;
let silentUrl: string | null = null;
let beepUrl: string | null = null;
let last = '';

export function lockScreenSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

const url = (bytes: Uint8Array) => URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'audio/wav' }));

function handler(action: Action, fn: MediaSessionActionHandler | null) {
  try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* nicht unterstützt */ }
}

function playLoop() {
  if (!el || !silentUrl) return;
  el.src = silentUrl;
  el.loop = true;
  void el.play().catch(() => { /* blockiert */ });
}

/** Aus einem Tipp heraus aufrufen: startet die stille Spur, die iOS als "Wiedergabe" anzeigt. */
export function startNowPlaying(handlers: { skipRest: () => void }) {
  if (!lockScreenSupported()) return;
  if (el) {
    void el.play().catch(() => { /* blockiert */ });
    return;
  }
  el = new Audio();
  silentUrl = url(silentWav());
  beepUrl = url(beepWav());
  el.addEventListener('ended', () => { if (el && !el.loop) playLoop(); });
  playLoop();
  handler('nexttrack', handlers.skipRest);
  handler('play', () => { void el?.play().catch(() => { /* blockiert */ }); });
  handler('pause', () => { void el?.play().catch(() => { /* blockiert */ }); });
  for (const a of ['previoustrack', 'seekbackward', 'seekforward', 'seekto'] as const) handler(a, null);
}

export function updateNowPlaying(title: string, artist: string) {
  if (!el || !lockScreenSupported()) return;
  const key = `${title}\n${artist}`;
  if (key === last) return;
  last = key;
  const base = import.meta.env.BASE_URL;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: 'Calisthenics',
      artwork: [
        { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png' },
      ],
    });
    navigator.mediaSession.playbackState = 'playing';
  } catch { /* nicht unterstützt */ }
}

/** Piep über dasselbe Element; false, wenn die Sperrbildschirm-Spur nicht läuft. */
export function restEndBeep(): boolean {
  if (!el || !beepUrl) return false;
  el.src = beepUrl;
  el.loop = false;
  void el.play().catch(() => { /* blockiert */ });
  return true;
}

export function stopNowPlaying() {
  if (el) {
    el.pause();
    el.removeAttribute('src');
    el.load();
    el = null;
  }
  if (silentUrl) URL.revokeObjectURL(silentUrl);
  if (beepUrl) URL.revokeObjectURL(beepUrl);
  silentUrl = beepUrl = null;
  last = '';
  if (!lockScreenSupported()) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  } catch { /* nicht unterstützt */ }
  for (const a of ACTIONS) handler(a, null);
}
