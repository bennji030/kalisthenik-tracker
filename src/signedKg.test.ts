import { describe, expect, it } from 'vitest';
import { fmtSignedKg, summarizeSets } from './util';

describe('fmtSignedKg', () => {
  it('formats positive, decimal and negative values', () => {
    expect(fmtSignedKg(25)).toBe('+25');
    expect(fmtSignedKg(1.25)).toBe('+1,25');
    expect(fmtSignedKg(27.5)).toBe('+27,5');
    expect(fmtSignedKg(-5)).toBe('-5');
  });
  it('is empty for 0, null and undefined', () => {
    expect(fmtSignedKg(0)).toBe('');
    expect(fmtSignedKg(null)).toBe('');
    expect(fmtSignedKg(undefined)).toBe('');
  });
  it('is used for mixed weights in summarizeSets', () => {
    expect(summarizeSets([{ reps: 5, weight: 25, sec: null }, { reps: 4, weight: 27.5, sec: null }], 'weighted')).toBe('5 +25, 4 +27,5 kg');
  });
});
