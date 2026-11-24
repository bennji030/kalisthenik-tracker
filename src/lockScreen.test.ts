import { describe, expect, it } from 'vitest';
import { beepWav, fmtClock, nowPlaying, parseTrainingPrefs, silentWav } from './lockScreen';

describe('parseTrainingPrefs', () => {
  it('defaults', () => {
    expect(parseTrainingPrefs(undefined)).toEqual({ restSound: true, lockScreen: false });
    expect(parseTrainingPrefs(null)).toEqual({ restSound: true, lockScreen: false });
    expect(parseTrainingPrefs([])).toEqual({ restSound: true, lockScreen: false });
  });
  it('garbage fields fall back', () => {
    expect(parseTrainingPrefs({ restSound: 'no', lockScreen: 1 })).toEqual({ restSound: true, lockScreen: false });
    expect(parseTrainingPrefs('x')).toEqual({ restSound: true, lockScreen: false });
  });
  it('stored values', () => {
    expect(parseTrainingPrefs({ restSound: false, lockScreen: true })).toEqual({ restSound: false, lockScreen: true });
    expect(parseTrainingPrefs({ lockScreen: true })).toEqual({ restSound: true, lockScreen: true });
  });
});

describe('fmtClock', () => {
  it('formats m:ss', () => {
    expect(fmtClock(72)).toBe('1:12');
    expect(fmtClock(5)).toBe('0:05');
    expect(fmtClock(0)).toBe('0:00');
    expect(fmtClock(600)).toBe('10:00');
  });
  it('handles odd input', () => {
    expect(fmtClock(-3)).toBe('0:00');
    expect(fmtClock(NaN)).toBe('0:00');
    expect(fmtClock(Infinity)).toBe('0:00');
    expect(fmtClock(71.2)).toBe('1:12');
  });
});

describe('nowPlaying', () => {
  const d = (n: number) => Array.from({ length: n }, () => ({ done: true }));
  const o = (n: number) => Array.from({ length: n }, () => ({ done: false }));
  const entries = [
    { name: 'Klimmzug', sets: [...d(2), ...o(2)] },
    { name: 'Dip', sets: o(3) },
  ];
  it('rest running', () => {
    expect(nowPlaying({ endAt: 72_000, now: 0, entries })).toEqual({ state: 'rest', title: 'Pause 1:12' });
  });
  it('rest ended shows the open set', () => {
    expect(nowPlaying({ endAt: 1000, now: 1000, entries })).toEqual({ state: 'set', title: 'Klimmzug · Satz 3/4' });
    expect(nowPlaying({ endAt: null, now: 0, entries })).toEqual({ state: 'set', title: 'Klimmzug · Satz 3/4' });
  });
  it('moves on to the next exercise', () => {
    const e = [{ name: 'Klimmzug', sets: d(4) }, entries[1]];
    expect(nowPlaying({ endAt: null, now: 0, entries: e }).title).toBe('Dip · Satz 1/3');
  });
  it('skips unknown exercises', () => {
    const e = [{ name: undefined, sets: o(2) }, entries[1]];
    expect(nowPlaying({ endAt: null, now: 0, entries: e }).title).toBe('Dip · Satz 1/3');
  });
  it('done', () => {
    expect(nowPlaying({ endAt: null, now: 0, entries: [{ name: 'A', sets: d(3) }] })).toEqual({ state: 'done', title: 'Alle Sätze erledigt' });
    expect(nowPlaying({ endAt: null, now: 0, entries: [] }).state).toBe('done');
  });
});

function parse(b: Uint8Array) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (o: number) => String.fromCharCode(...b.slice(o, o + 4));
  const samples = Array.from({ length: v.getUint32(40, true) / 2 }, (_, i) => v.getInt16(44 + i * 2, true));
  return { riff: tag(0), wave: tag(8), fmt: tag(12), data: tag(36), rate: v.getUint32(24, true), dataLen: v.getUint32(40, true), samples, total: b.length };
}

describe('wav', () => {
  it('silent track', () => {
    const w = parse(silentWav(5));
    expect([w.riff, w.wave, w.fmt, w.data]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(w.rate).toBeLessThanOrEqual(22050);
    expect(w.dataLen).toBe(w.rate * 5 * 2);
    expect(w.total).toBe(44 + w.dataLen);
    expect(Math.max(...w.samples.map(Math.abs))).toBeLessThanOrEqual(4);
    expect(w.samples.some((s) => s !== 0)).toBe(true);
  });
  it('beep track', () => {
    const w = parse(beepWav());
    expect([w.riff, w.wave, w.fmt, w.data]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(w.dataLen / 2 / w.rate).toBeCloseTo(0.75, 2);
    expect(w.samples.filter((s) => s !== 0).length).toBeGreaterThan(100);
  });
});
