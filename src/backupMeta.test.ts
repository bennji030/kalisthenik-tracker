import { describe, expect, it } from 'vitest';
import { exportMeta, importMeta } from './backupFormat';

const health = { key: 'health', value: { url: 'https://a.b', token: 'device-token', shortcut: 'Calisthenics Sync' } };
const status = { key: 'healthStatus', value: { lastSync: 1, error: null } };

describe('backup meta', () => {
  it('export drops health, healthStatus and lastBackup', () => {
    const meta = [{ key: 'theme', value: 'dark' }, health, status, { key: 'lastBackup', value: 5 }, { key: 'goals', value: {} }];
    expect(exportMeta(meta)).toEqual([{ key: 'theme', value: 'dark' }, { key: 'goals', value: {} }]);
  });
  it('import keeps the device values and ignores the backup values for those keys', () => {
    const backup = [
      { key: 'theme', value: 'light' },
      { key: 'health', value: { url: 'https://old', token: 'old-token', shortcut: 'x' } },
      { key: 'healthStatus', value: { lastSync: 9, error: 'x' } },
    ];
    expect(importMeta(backup, [health, status])).toEqual([{ key: 'theme', value: 'light' }, health, status]);
  });
  it('import leaves the keys out when the device has none', () => {
    const backup = [{ key: 'theme', value: 'light' }, { key: 'health', value: { url: 'https://old', token: 'old', shortcut: 'x' } }];
    expect(importMeta(backup, [undefined, undefined])).toEqual([{ key: 'theme', value: 'light' }]);
  });
});
