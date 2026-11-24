export interface TrainingPrefs {
  restSound: boolean;
  lockScreen: boolean;
}

/** Meta `training`: Ton bei Pausenende (an) und Sperrbildschirm-Anzeige (aus, Experiment). */
export function parseTrainingPrefs(value: unknown): TrainingPrefs {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    restSound: typeof v.restSound === 'boolean' ? v.restSound : true,
    lockScreen: typeof v.lockScreen === 'boolean' ? v.lockScreen : false,
  };
}

export function fmtClock(sec: number): string {
  const s = Number.isFinite(sec) && sec > 0 ? Math.ceil(sec) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface NowPlayingEntry {
  name: string | undefined;
  sets: { done: boolean }[];
}

export interface NowPlayingInput {
  endAt: number | null;
  now: number;
  entries: NowPlayingEntry[];
}

export function nowPlaying({ endAt, now, entries }: NowPlayingInput): { state: 'rest' | 'set' | 'done'; title: string } {
  if (endAt != null && endAt > now) return { state: 'rest', title: `Pause ${fmtClock((endAt - now) / 1000)}` };
  for (const e of entries) {
    if (!e.name) continue;
    const i = e.sets.findIndex((s) => !s.done);
    if (i >= 0) return { state: 'set', title: `${e.name} · Satz ${i + 1}/${e.sets.length}` };
  }
  return { state: 'done', title: 'Alle Sätze erledigt' };
}

const RATE = 8000;

function wav(samples: Int16Array): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(bytes.buffer);
  const tag = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  tag(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, s, true));
  return bytes;
}

/** Fast stille Schleife (Amplitude 1 von 32767), damit iOS die Spur als laufend wertet. */
export function silentWav(seconds = 5): Uint8Array {
  const s = new Int16Array(RATE * seconds);
  for (let i = 0; i < s.length; i++) s[i] = i % 2 ? 1 : -1;
  return wav(s);
}

/** Dreiklang wie der Web-Audio-Piep: 880, 880, 1320 Hz bei 0 / 0,25 / 0,5 s. */
export function beepWav(): Uint8Array {
  const s = new Int16Array(Math.round(RATE * 0.75));
  [0, 0.25, 0.5].forEach((d, k) => {
    const f = k === 2 ? 1320 : 880;
    const n = Math.round(RATE * 0.2);
    const start = Math.round(RATE * d);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const env = Math.min(1, t / 0.02) * Math.max(0, 1 - Math.max(0, t - 0.02) / 0.16);
      s[start + i] = Math.round(Math.sin(2 * Math.PI * f * t) * env * 0.4 * 32767);
    }
  });
  return wav(s);
}
