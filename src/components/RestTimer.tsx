import { useEffect, useState } from 'react';

let audioCtx: AudioContext | null = null;

/** Muss aus einem Tipp heraus aufgerufen werden, sonst blockiert iOS den Ton. */
export function unlockAudio() {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    /* kein Ton */
  }
}

function beep() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  [0, 0.25, 0.5].forEach((d, i) => {
    const o = audioCtx!.createOscillator();
    const g = audioCtx!.createGain();
    o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.4, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
    o.connect(g).connect(audioCtx!.destination);
    o.start(t + d);
    o.stop(t + d + 0.2);
  });
}

/** Kurzer aufsteigender Dreiklang beim Erfolgs-Bildschirm. */
export function successSound() {
  if (!audioCtx) return;
  const ctx = audioCtx;
  const t = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((f, i) => {
    const d = i * 0.12;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.3, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + (i === 2 ? 0.5 : 0.2));
    o.connect(g).connect(ctx.destination);
    o.start(t + d);
    o.stop(t + d + (i === 2 ? 0.55 : 0.25));
  });
}

interface Props {
  endAt: number;
  total: number;
  onChange: (endAt: number | null, total?: number) => void;
}

export function RestTimer({ endAt, total, onChange }: Props) {
  const [now, setNow] = useState(Date.now());
  const left = Math.max(0, Math.ceil((endAt - now) / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (left === 0) {
      beep();
      const t = setTimeout(() => onChange(null), 4000);
      return () => clearTimeout(t);
    }
  }, [left === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = total > 0 ? Math.min(100, (left / total) * 100) : 0;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className={`rest ${left === 0 ? 'rest-done' : ''}`}>
      <div className="rest-bar" style={{ width: `${pct}%` }} />
      <button className="rest-btn" onClick={() => onChange(endAt - 15000, total)}>−15</button>
      <div className="rest-time">
        <span className="rest-label">{left === 0 ? 'Los geht’s!' : 'Pause'}</span>
        {mm}:{ss}
      </div>
      <button className="rest-btn" onClick={() => onChange(endAt + 15000, total + 15)}>+15</button>
      <button className="rest-btn" onClick={() => onChange(null)} aria-label="Pause beenden">✕</button>
    </div>
  );
}
