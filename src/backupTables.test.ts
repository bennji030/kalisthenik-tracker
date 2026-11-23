import { describe, expect, it } from 'vitest';
import { isBackup } from './backupFormat';

const base = { app: 'kalisthenik-tracker', version: 1, exercises: [], templates: [], sessions: [], meta: [] };

describe('isBackup table arrays', () => {
  it('accepts a backup with weights', () => expect(isBackup({ ...base, weights: [] })).toBe(true));
  it('rejects missing or non-array exercises', () => {
    expect(isBackup({ ...base, exercises: undefined })).toBe(false);
    expect(isBackup({ ...base, exercises: {} })).toBe(false);
  });
  it('rejects missing or non-array templates', () => {
    expect(isBackup({ ...base, templates: undefined })).toBe(false);
    expect(isBackup({ ...base, templates: 'x' })).toBe(false);
  });
});
