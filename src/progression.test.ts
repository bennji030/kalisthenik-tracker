import { describe, expect, it } from 'vitest';
import type { EntryLog, SetLog, Slot } from './db';
import { suggest } from './progression';

const slot: Slot = { id: 's', exerciseId: 'e', sets: 4, repMin: 4, repMax: 6, increment: 2.5, startWeight: 25, restSec: 180, progression: true };

function entry(target: number[], actual: number[], tw = 25, aw = tw): EntryLog {
  const sets: SetLog[] = target.map((t, i) => ({
    targetReps: t, targetWeight: tw, targetSec: null,
    reps: actual[i] ?? null, weight: aw, sec: null, done: actual[i] != null,
  }));
  return { slotId: 's', exerciseId: 'e', restSec: 180, sets, kind: 'repeat', label: '', lastSummary: null };
}

describe('suggest (Dips 4×4–6)', () => {
  it('erstes Mal: 4×4 mit Startgewicht', () => {
    const s = suggest(slot, 'weighted', []);
    expect(s.reps).toEqual([4, 4, 4, 4]);
    expect(s.weight).toBe(25);
  });

  it('4×4 geschafft → 5,4,4,4', () => {
    const s = suggest(slot, 'weighted', [entry([4, 4, 4, 4], [4, 4, 4, 4])]);
    expect(s.kind).toBe('up-reps');
    expect(s.reps).toEqual([5, 4, 4, 4]);
    expect(s.weight).toBe(25);
  });

  it('5,4,4,4 geschafft → 5,5,4,4', () => {
    expect(suggest(slot, 'weighted', [entry([5, 4, 4, 4], [5, 4, 4, 4])]).reps).toEqual([5, 5, 4, 4]);
  });

  it('mehr geschafft als Ziel zählt mit', () => {
    expect(suggest(slot, 'weighted', [entry([5, 4, 4, 4], [6, 5, 4, 4])]).reps).toEqual([6, 5, 5, 4]);
  });

  it('6,6,6,6 geschafft → +2,5 kg, zurück auf 4', () => {
    const s = suggest(slot, 'weighted', [entry([6, 6, 6, 5], [6, 6, 6, 6])]);
    expect(s.kind).toBe('up-weight');
    expect(s.weight).toBe(27.5);
    expect(s.reps).toEqual([4, 4, 4, 4]);
  });

  it('nicht geschafft → gleiches Ziel', () => {
    const s = suggest(slot, 'weighted', [entry([5, 5, 4, 4], [5, 4, 4, 4])]);
    expect(s.kind).toBe('repeat');
    expect(s.reps).toEqual([5, 5, 4, 4]);
    expect(s.weight).toBe(25);
  });

  it('3× in Folge nicht geschafft → −10 %', () => {
    const fail = entry([5, 5, 4, 4], [5, 4, 4, 4], 30);
    const s = suggest(slot, 'weighted', [fail, fail, fail]);
    expect(s.kind).toBe('deload');
    expect(s.weight).toBe(27.5);
    expect(s.reps).toEqual([4, 4, 4, 4]);
  });

  it('Fehlversuche auf anderem Gewicht zählen nicht', () => {
    const s = suggest(slot, 'weighted', [entry([4, 4, 4, 4], [4, 3, 3, 3], 27.5), entry([6, 6, 6, 6], [6, 6, 5, 5]), entry([6, 6, 6, 6], [6, 6, 5, 5])]);
    expect(s.kind).toBe('repeat');
  });

  it('Satz ausgelassen zählt als nicht geschafft', () => {
    expect(suggest(slot, 'weighted', [entry([4, 4, 4, 4], [4, 4, 4])]).kind).toBe('repeat');
  });

  it('Körpergewicht-Übung am Maximum → Hinweis', () => {
    const s = suggest({ ...slot, sets: 2 }, 'reps', [entry([6, 6], [6, 6], 0)]);
    expect(s.kind).toBe('maxed');
  });
});
