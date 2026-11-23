import { describe, expect, it } from 'vitest';
import { BACKUP_APP, isBackup } from './backupFormat';

const old = { app: 'kalisthenik-tracker', version: 1, exercises: [], templates: [], sessions: [], meta: [] };

describe('isBackup', () => {
  it('keeps the identifier', () => expect(BACKUP_APP).toBe('kalisthenik-tracker'));
  it('accepts an old backup', () => expect(isBackup(old)).toBe(true));
  it('rejects a wrong or missing app', () => {
    expect(isBackup({ ...old, app: 'calisthenics-tracker' })).toBe(false);
    expect(isBackup({ ...old, app: undefined })).toBe(false);
  });
  it('rejects missing or non-array sessions', () => {
    expect(isBackup({ ...old, sessions: undefined })).toBe(false);
    expect(isBackup({ ...old, sessions: {} })).toBe(false);
  });
  it('rejects null and non-objects', () => {
    expect(isBackup(null)).toBe(false);
    expect(isBackup('x')).toBe(false);
    expect(isBackup(5)).toBe(false);
  });
});
