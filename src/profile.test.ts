import { describe, expect, it } from 'vitest';
import { ageOn, isValidBirthDate, isValidBodyFat, isValidHeight, parseProfile } from './profile';

const now = new Date(2026, 5, 15, 12, 0).getTime();

describe('isValidHeight', () => {
  it('checks bounds', () => {
    expect(isValidHeight(99)).toBe(false);
    expect(isValidHeight(100)).toBe(true);
    expect(isValidHeight(250)).toBe(true);
    expect(isValidHeight(251)).toBe(false);
    expect(isValidHeight(NaN)).toBe(false);
  });
});

describe('isValidBodyFat', () => {
  it('checks bounds', () => {
    expect(isValidBodyFat(2.9)).toBe(false);
    expect(isValidBodyFat(3)).toBe(true);
    expect(isValidBodyFat(60)).toBe(true);
    expect(isValidBodyFat(60.1)).toBe(false);
    expect(isValidBodyFat(12.5)).toBe(true);
  });
});

describe('isValidBirthDate', () => {
  it('accepts only real past days', () => {
    expect(isValidBirthDate('2026-06-14', now)).toBe(true);
    expect(isValidBirthDate('2026-06-15', now)).toBe(false);
    expect(isValidBirthDate('2026-06-16', now)).toBe(false);
    expect(isValidBirthDate('2026-02-30', now)).toBe(false);
    expect(isValidBirthDate('garbage', now)).toBe(false);
  });
});

describe('ageOn', () => {
  it('counts full years around the birthday', () => {
    expect(ageOn('1990-06-16', now)).toBe(35);
    expect(ageOn('1990-06-15', now)).toBe(36);
    expect(ageOn('1990-06-14', now)).toBe(36);
  });
});

describe('parseProfile', () => {
  it('returns empty for broken values', () => {
    expect(parseProfile(undefined, now)).toEqual({});
    expect(parseProfile(null, now)).toEqual({});
    expect(parseProfile('abc', now)).toEqual({});
    expect(parseProfile({}, now)).toEqual({});
  });
  it('keeps a fully valid object', () => {
    const p = { name: 'Benni', gender: 'male', heightCm: 180, birthDate: '1990-01-01', bodyFat: 15.5, bodyFatDate: '2026-06-01' };
    expect(parseProfile(p, now)).toEqual(p);
  });
  it('drops invalid fields only', () => {
    expect(parseProfile({ name: '  ', gender: 'x', heightCm: 'abc', birthDate: '2999-01-01', bodyFat: 99, bodyFatDate: '2026-06-01' }, now))
      .toEqual({ bodyFatDate: '2026-06-01' });
    expect(parseProfile({ name: ' Ann ', heightCm: 170, bodyFat: 99, gender: 'female' }, now))
      .toEqual({ name: 'Ann', heightCm: 170, gender: 'female' });
  });
});
