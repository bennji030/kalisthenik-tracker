import { describe, expect, it } from 'vitest';
import { parseTrainingPrefs } from './lockScreen';

describe('parseTrainingPrefs', () => {
  it('defaults', () => {
    expect(parseTrainingPrefs(undefined)).toEqual({ restSound: true });
    expect(parseTrainingPrefs(null)).toEqual({ restSound: true });
    expect(parseTrainingPrefs([])).toEqual({ restSound: true });
    expect(parseTrainingPrefs('x')).toEqual({ restSound: true });
  });
  it('non-boolean restSound falls back', () => {
    expect(parseTrainingPrefs({ restSound: 'no' })).toEqual({ restSound: true });
  });
  it('stored value', () => {
    expect(parseTrainingPrefs({ restSound: false })).toEqual({ restSound: false });
  });
  it('ignores an old lockScreen field', () => {
    expect(parseTrainingPrefs({ restSound: false, lockScreen: true })).toEqual({ restSound: false });
  });
});
