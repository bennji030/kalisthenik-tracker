import { describe, expect, it } from 'vitest';
import { fmtAddedKg, summarizeSets } from './util';

const w = (reps: number, weight: number | null) => ({ reps, weight, sec: null });

describe('fmtAddedKg', () => {
  it('formats added weight', () => {
    expect(fmtAddedKg(25)).toBe('+25 kg');
    expect(fmtAddedKg(1.25)).toBe('+1,25 kg');
    expect(fmtAddedKg(27.5)).toBe('+27,5 kg');
  });
  it('is empty for 0, null, undefined', () => {
    expect(fmtAddedKg(0)).toBe('');
    expect(fmtAddedKg(null)).toBe('');
    expect(fmtAddedKg(undefined)).toBe('');
  });
  it('has no extra plus for negative values', () => {
    expect(fmtAddedKg(-5)).toBe('-5 kg');
  });
});

describe('summarizeSets weighted', () => {
  it('same weight', () => {
    expect(summarizeSets([w(4, 25), w(4, 25), w(4, 25), w(4, 25)], 'weighted')).toBe('4×4 +25 kg');
    expect(summarizeSets([w(5, 25), w(4, 25), w(4, 25), w(4, 25)], 'weighted')).toBe('5, 4, 4, 4 +25 kg');
  });
  it('weight 0', () => {
    expect(summarizeSets([w(4, 0), w(4, 0), w(4, 0), w(4, 0)], 'weighted')).toBe('4×4');
  });
  it('different weights', () => {
    expect(summarizeSets([w(5, 25), w(4, 27.5)], 'weighted')).toBe('5 +25, 4 +27,5 kg');
  });
  it('a set without weight among weighted sets', () => {
    expect(summarizeSets([w(5, 0), w(4, 25)], 'weighted')).toBe('5, 4 +25 kg');
  });
  it('decimal weight', () => {
    expect(summarizeSets([w(8, 1.25), w(8, 1.25)], 'weighted')).toBe('2×8 +1,25 kg');
  });
});

describe('summarizeSets other types unchanged', () => {
  it('reps', () => {
    expect(summarizeSets([w(10, null), w(10, null), w(10, null)], 'reps')).toBe('3×10');
  });
  it('hold', () => {
    expect(summarizeSets([{ reps: null, weight: null, sec: 20 }, { reps: null, weight: null, sec: 18 }], 'hold')).toBe('20, 18 s');
  });
});
