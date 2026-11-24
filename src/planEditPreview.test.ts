import { describe, expect, it } from 'vitest';
import type { Suggestion } from './progression';
import { previewText } from './planEdit';

const sug = (patch: Partial<Suggestion>): Suggestion => ({ kind: 'free', weight: null, reps: [], sec: [], label: '', ...patch });

describe('previewText without history', () => {
  it('calls free values start values, not "zuletzt"', () => {
    expect(previewText(sug({ weight: 20, reps: [3, 3] }), 'weighted', false)).toBe('Nächstes Mal: frei · Startwerte 3, 3 +20 kg');
    expect(previewText(sug({ reps: [6, 6, 6] }), 'reps', false)).toBe('Nächstes Mal: frei · Startwerte 6, 6, 6');
  });

  it('stays plain when there are no values', () => {
    expect(previewText(sug({ reps: [null], sec: [null] }), 'hold', false)).toBe('Nächstes Mal: frei');
  });

  it('keeps "zuletzt" with history', () => {
    expect(previewText(sug({ weight: 10, reps: [5, 5] }), 'weighted', true)).toBe('Nächstes Mal: frei · zuletzt 5, 5 +10 kg');
    expect(previewText(sug({ weight: 10, reps: [5, 5] }), 'weighted')).toBe('Nächstes Mal: frei · zuletzt 5, 5 +10 kg');
  });

  it('does not change judged previews', () => {
    expect(previewText(sug({ kind: 'first', weight: 20, reps: [4, 4] }), 'weighted', false)).toBe('Nächstes Mal: 4, 4 · +20 kg');
  });
});
