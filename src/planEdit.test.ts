import { describe, expect, it } from 'vitest';
import type { Exercise, ExType, Slot } from './db';
import type { Suggestion } from './progression';
import { cleanSlot, dropIndex, moveSlot, previewText, slotSummary } from './planEdit';

const slot = (id: string, patch: Partial<Slot> = {}): Slot => ({
  id, exerciseId: `e-${id}`, sets: 4, repMin: 4, repMax: 8, increment: 2.5, startWeight: 20, restSec: 180, progression: true, ...patch,
});
const ex = (type: ExType): Exercise => ({ id: 'e', name: 'Übung', type });
const sug = (patch: Partial<Suggestion>): Suggestion => ({ kind: 'up-reps', weight: null, reps: [], sec: [], label: '', ...patch });

describe('moveSlot', () => {
  const slots = [slot('a'), slot('b'), slot('c'), slot('d')];
  const ids = (list: Slot[]) => list.map((s) => s.id).join('');

  it('moves up and down', () => {
    expect(ids(moveSlot(slots, 2, 1))).toBe('acbd');
    expect(ids(moveSlot(slots, 1, 2))).toBe('acbd');
    expect(ids(moveSlot(slots, 0, 2))).toBe('bcad');
  });

  it('moves to both ends', () => {
    expect(ids(moveSlot(slots, 0, 3))).toBe('bcda');
    expect(ids(moveSlot(slots, 3, 0))).toBe('dabc');
  });

  it('returns a copy in the same order for out-of-range or equal indexes', () => {
    for (const [from, to] of [[-1, 2], [4, 0], [1, 4], [1, -1], [2, 2], [0.5, 1]]) {
      const out = moveSlot(slots, from, to);
      expect(ids(out)).toBe('abcd');
      expect(out).not.toBe(slots);
    }
  });

  it('never mutates the input and keeps the same slot objects', () => {
    const before = [...slots];
    const out = moveSlot(slots, 0, 3);
    expect(slots).toEqual(before);
    expect(ids(slots)).toBe('abcd');
    expect(out).toHaveLength(4);
    for (const s of slots) expect(out).toContain(s);
    expect(out[3]).toBe(slots[0]);
    expect(out[3]).toEqual(slot('a'));
  });
});

describe('dropIndex', () => {
  const even = [60, 60, 60, 60];

  it('stays for a small drag', () => {
    expect(dropIndex(1, 0, even)).toBe(1);
    expect(dropIndex(1, 59, even)).toBe(1);
    expect(dropIndex(1, -59, even)).toBe(1);
    expect(dropIndex(1, 60, even)).toBe(1);
  });

  it('moves once the centre crosses a neighbour midpoint', () => {
    expect(dropIndex(1, 61, even)).toBe(2);
    expect(dropIndex(1, -61, even)).toBe(0);
    expect(dropIndex(0, 121, even)).toBe(2);
    expect(dropIndex(3, -121, even)).toBe(1);
  });

  it('clamps at both ends', () => {
    expect(dropIndex(1, 5000, even)).toBe(3);
    expect(dropIndex(2, -5000, even)).toBe(0);
    expect(dropIndex(0, -10, even)).toBe(0);
    expect(dropIndex(3, 10, even)).toBe(3);
    expect(dropIndex(0, 100, [60])).toBe(0);
  });

  it('uses each row height', () => {
    // Mitten: 20, 90, 160
    const heights = [40, 100, 40];
    expect(dropIndex(0, 69, heights)).toBe(0);
    expect(dropIndex(0, 71, heights)).toBe(1);
    expect(dropIndex(0, 141, heights)).toBe(2);
    expect(dropIndex(2, -69, heights)).toBe(2);
    expect(dropIndex(2, -71, heights)).toBe(1);
    expect(dropIndex(1, 71, heights)).toBe(2);
  });
});

describe('slotSummary', () => {
  it('shows sets, range, increment and rest for weighted', () => {
    expect(slotSummary(slot('a'), ex('weighted'))).toBe('4 × 4–8 · +2,5 kg · 3 min');
  });

  it('shows no increment for reps and German decimals for the rest', () => {
    expect(slotSummary(slot('a', { sets: 3, repMin: 6, repMax: 10, restSec: 90 }), ex('reps'))).toBe('3 × 6–10 · 1,5 min');
  });

  it('shows free for hold and for progression off', () => {
    expect(slotSummary(slot('a', { sets: 3, restSec: 60 }), ex('hold'))).toBe('3 Sätze · frei · 1 min');
    expect(slotSummary(slot('a', { progression: false }), ex('weighted'))).toBe('4 Sätze · frei · 3 min');
    expect(slotSummary(slot('a', { progression: false, restSec: 120 }), ex('reps'))).toBe('4 Sätze · frei · 2 min');
  });

  it('drops the rest part for 0', () => {
    expect(slotSummary(slot('a', { restSec: 0 }), ex('weighted'))).toBe('4 × 4–8 · +2,5 kg');
    expect(slotSummary(slot('a', { restSec: 0, increment: 1.25 }), ex('weighted'))).toBe('4 × 4–8 · +1,25 kg');
    expect(slotSummary(slot('a', { restSec: 0 }), ex('hold'))).toBe('4 Sätze · frei');
  });

  it('is empty without an exercise', () => {
    expect(slotSummary(slot('a'))).toBe('');
  });
});

describe('previewText', () => {
  it('shows reps and weight for weighted', () => {
    expect(previewText(sug({ weight: 25, reps: [5, 4, 4, 4] }), 'weighted')).toBe('Nächstes Mal: 5, 4, 4, 4 · +25 kg');
    expect(previewText(sug({ kind: 'up-weight', weight: 2.5, reps: [4, 4] }), 'weighted')).toBe('Nächstes Mal: 4, 4 · +2,5 kg');
  });

  it('shows reps only for bodyweight', () => {
    expect(previewText(sug({ reps: [7, 6, 6] }), 'reps')).toBe('Nächstes Mal: 7, 6, 6');
  });

  it('drops the weight part for 0', () => {
    expect(previewText(sug({ kind: 'first', weight: 0, reps: [4, 4, 4, 4] }), 'weighted')).toBe('Nächstes Mal: 4, 4, 4, 4');
  });

  it('shows free with the last values', () => {
    expect(previewText(sug({ kind: 'free', reps: [3, 2, 2] }), 'reps')).toBe('Nächstes Mal: frei · zuletzt 3, 2, 2');
    expect(previewText(sug({ kind: 'free', weight: 10, reps: [5, 5] }), 'weighted')).toBe('Nächstes Mal: frei · zuletzt 5, 5 +10 kg');
    expect(previewText(sug({ kind: 'free', weight: 0, reps: [5, null] }), 'weighted')).toBe('Nächstes Mal: frei · zuletzt 5');
  });

  it('shows free without values', () => {
    expect(previewText(sug({ kind: 'free', reps: [null, null], sec: [null, null] }), 'hold')).toBe('Nächstes Mal: frei');
    expect(previewText(sug({ kind: 'free', weight: 10, reps: [null] }), 'weighted')).toBe('Nächstes Mal: frei');
  });

  it('shows seconds for hold', () => {
    expect(previewText(sug({ kind: 'free', reps: [null, null], sec: [30, 25] }), 'hold')).toBe('Nächstes Mal: frei · zuletzt 30, 25 s');
  });
});

describe('cleanSlot', () => {
  it('keeps valid values and the id', () => {
    expect(cleanSlot(slot('a'))).toEqual(slot('a'));
  });

  it('raises repMax to repMin', () => {
    const out = cleanSlot(slot('a', { repMin: 8, repMax: 5 }));
    expect(out.repMin).toBe(8);
    expect(out.repMax).toBe(8);
  });

  it('lifts zeros to the minimum', () => {
    const out = cleanSlot(slot('a', { sets: 0, repMin: 0, repMax: 0, increment: 0, startWeight: 0, restSec: 0 }));
    expect(out).toMatchObject({ sets: 1, repMin: 1, repMax: 1, increment: 0, startWeight: 0, restSec: 0 });
  });

  it('clamps negatives', () => {
    const out = cleanSlot(slot('a', { sets: -2, repMin: -4, repMax: -1, increment: -2.5, startWeight: -10, restSec: -30 }));
    expect(out).toMatchObject({ sets: 1, repMin: 1, repMax: 1, increment: 0, startWeight: 0, restSec: 0 });
  });

  it('replaces NaN and Infinity with the defaults', () => {
    const out = cleanSlot(slot('a', { sets: NaN, repMin: NaN, repMax: NaN, increment: NaN, startWeight: Infinity, restSec: NaN }));
    expect(out).toMatchObject({ sets: 3, repMin: 6, repMax: 10, increment: 2.5, startWeight: 0, restSec: 120 });
  });

  it('rounds sets, reps and rest to integers but keeps kg decimals', () => {
    const out = cleanSlot(slot('a', { sets: 3.6, repMin: 4.4, repMax: 8.5, restSec: 90.4, increment: 1.25, startWeight: 2.5 }));
    expect(out).toMatchObject({ sets: 4, repMin: 4, repMax: 9, restSec: 90, increment: 1.25, startWeight: 2.5 });
  });
});
