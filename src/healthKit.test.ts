import { describe, expect, it } from 'vitest';
import type { DayValues } from './db';
import { isDayValuesList } from './dayValues';
import { lastDayKeys } from './habits';
import { DEFAULT_SHORTCUT, ERRORS, mergeHealth, parseHealthConfig, type RemoteDay } from './health';
import { HEALTHKIT_ERRORS, fmtBalance, kcalBalance, parseNativeDays, runNativeHealthSync } from './healthKit';
import { createNative, type Bridge } from './native';

const NOW = new Date(2026, 2, 3, 15, 0).getTime(); // Di 3. März 2026
const T = 99;

const row = (date: string, v: Partial<DayValues> = {}): DayValues => ({ date, source: 'manual', updatedAt: 1, ...v });

describe('parseNativeDays', () => {
  it('maps and rounds the values', () => {
    const days = [{ date: '2026-03-02', steps: 8123.4, kcal: 2199.6, proteinG: 149.5, activeKcal: 612.3, basalKcal: 1840.4 }];
    expect(parseNativeDays({ days }, NOW)).toEqual([{ date: '2026-03-02', steps: 8123, kcal: 2200, proteinG: 150, burnedKcal: 2453 }]);
  });
  it('accepts an empty list', () => {
    expect(parseNativeDays({ days: [] }, NOW)).toEqual([]);
  });
  it('sets burned only when active and basal are both there', () => {
    const days = [
      { date: '2026-03-01', steps: 10, activeKcal: 500 },
      { date: '2026-03-02', steps: 10, basalKcal: 1800 },
      { date: '2026-03-03', activeKcal: 0, basalKcal: 1800 },
    ];
    expect(parseNativeDays({ days }, NOW)).toEqual([
      { date: '2026-03-01', steps: 10 },
      { date: '2026-03-02', steps: 10 },
      { date: '2026-03-03', burnedKcal: 1800 },
    ]);
  });
  it('never passes activeKcal or basalKcal on', () => {
    const [day] = parseNativeDays({ days: [{ date: '2026-03-03', activeKcal: 400, basalKcal: 1700 }] }, NOW)!;
    expect(Object.keys(day).sort()).toEqual(['burnedKcal', 'date']);
  });
  it('gives null for a wrong shape', () => {
    const bad: unknown[] = [
      undefined, null, 'x', 5, [], {}, { days: {} }, { days: 'x' },
      { days: [null] }, { days: ['2026-03-03'] }, { days: [[]] },
      { days: [{ date: '2026-03-03', steps: 1, extra: 1 }] },
      { days: [{ date: '2026-03-03', burnedKcal: 2000 }] },
      { days: [{ steps: 1 }] },
      { days: [{ date: '3.3.2026', steps: 1 }] },
      { days: [{ date: '2026-02-30', steps: 1 }] },
      { days: [{ date: '2026-03-03', steps: 1 }, { date: '2026-03-03', steps: 2 }] },
      { days: [{ date: '2026-03-03', steps: '5' }] },
      { days: [{ date: '2026-03-03', steps: -1 }] },
      { days: [{ date: '2026-03-03', kcal: NaN }] },
      { days: [{ date: '2026-03-03', proteinG: Infinity }] },
      { days: [{ date: '2026-03-03', proteinG: null }] },
      { days: [{ date: '2026-03-03', activeKcal: -1, basalKcal: 1700 }] },
      { days: [{ date: '2026-03-03', activeKcal: 400, basalKcal: 'x' }] },
      { days: [{ date: '2026-03-03', steps: 1, basalKcal: null }] },
    ];
    for (const b of bad) expect(parseNativeDays(b, NOW), JSON.stringify(b)).toBeNull();
  });
  it('drops values outside the app limits instead of failing', () => {
    const days = [
      { date: '2026-03-01', steps: 100001, kcal: 10001, proteinG: 1001, activeKcal: 9000, basalKcal: 1001 },
      { date: '2026-03-02', steps: 100000, kcal: 10000, proteinG: 1000, activeKcal: 9000, basalKcal: 1000 },
      { date: '2026-03-03', steps: 500, kcal: 10000.4, activeKcal: 9000, basalKcal: 1000.6 },
    ];
    expect(parseNativeDays({ days }, NOW)).toEqual([
      { date: '2026-03-02', steps: 100000, kcal: 10000, proteinG: 1000, burnedKcal: 10000 },
      { date: '2026-03-03', steps: 500, kcal: 10000 },
    ]);
  });
  it('skips days after today and days without a value', () => {
    const days = [
      { date: '2026-03-02' },
      { date: '2026-03-03', steps: 0 },
      { date: '2026-03-04', steps: 4000, activeKcal: 100, basalKcal: 1700 },
    ];
    expect(parseNativeDays({ days }, NOW)).toEqual([{ date: '2026-03-03', steps: 0 }]);
  });
});

describe('runNativeHealthSync', () => {
  const answer = { days: [{ date: '2026-03-03', steps: 5000, activeKcal: 500, basalKcal: 1800 }] };

  it('reads the last 30 days and saves them', async () => {
    const asked: string[] = [];
    const saved: RemoteDay[][] = [];
    const result = await runNativeHealthSync(
      async (since) => { asked.push(since); return answer; },
      NOW,
      async (days) => { saved.push(days); },
    );
    expect(result).toEqual({ kind: 'synced', error: null });
    expect(asked).toEqual([lastDayKeys(NOW)[0]]);
    expect(asked).toEqual(['2026-02-02']);
    expect(saved).toEqual([[{ date: '2026-03-03', steps: 5000, burnedKcal: 2300 }]]);
  });
  it('fails when reading rejects and saves nothing', async () => {
    let saved = 0;
    const result = await runNativeHealthSync(() => Promise.reject(new Error('denied')), NOW, async () => { saved++; });
    expect(result).toEqual({ kind: 'failed', error: 'Apple Health konnte nicht gelesen werden' });
    expect(result).toEqual({ kind: 'failed', error: HEALTHKIT_ERRORS.read });
    expect(saved).toBe(0);
  });
  it('fails when reading throws synchronously', async () => {
    const result = await runNativeHealthSync(() => { throw new Error('boom'); }, NOW, async () => {});
    expect(result).toEqual({ kind: 'failed', error: HEALTHKIT_ERRORS.read });
  });
  it('fails on an invalid answer and saves nothing', async () => {
    let saved = 0;
    const result = await runNativeHealthSync(async () => ({ days: [{ date: 'x' }] }), NOW, async () => { saved++; });
    expect(result).toEqual({ kind: 'failed', error: 'Ungültige Antwort von Apple Health' });
    expect(saved).toBe(0);
  });
  it('fails when saving throws', async () => {
    const result = await runNativeHealthSync(async () => answer, NOW, () => Promise.reject(new Error('db')));
    expect(result).toEqual({ kind: 'failed', error: ERRORS.save });
  });
});

describe('mergeHealth with burnedKcal', () => {
  it('takes burned from the remote day', () => {
    expect(mergeHealth(undefined, { date: '2026-03-03', steps: 5000, burnedKcal: 2650 }, T))
      .toEqual({ date: '2026-03-03', steps: 5000, burnedKcal: 2650, source: 'health', updatedAt: T });
  });
  it('replaces an older burned value', () => {
    const old = row('2026-03-03', { steps: 4000, burnedKcal: 1200, source: 'health' });
    expect(mergeHealth(old, { date: '2026-03-03', steps: 6000, burnedKcal: 2650 }, T))
      .toEqual({ date: '2026-03-03', steps: 6000, burnedKcal: 2650, source: 'health', updatedAt: T });
  });
  it('keeps manual kcal while burned is taken', () => {
    const old = row('2026-03-03', { kcal: 1800, manual: ['kcal'] });
    expect(mergeHealth(old, { date: '2026-03-03', steps: 6000, kcal: 2500, burnedKcal: 2650 }, T))
      .toEqual({ date: '2026-03-03', steps: 6000, kcal: 1800, burnedKcal: 2650, manual: ['kcal'], source: 'manual', updatedAt: T });
  });
  it('keeps the existing burned value when the remote lacks it', () => {
    const old = row('2026-03-03', { steps: 4000, burnedKcal: 2650, source: 'health' });
    expect(mergeHealth(old, { date: '2026-03-03', steps: 6000 }, T))
      .toEqual({ date: '2026-03-03', steps: 6000, burnedKcal: 2650, source: 'health', updatedAt: T });
  });
});

describe('kcalBalance', () => {
  it('is null without burned calories', () => {
    expect(kcalBalance(undefined)).toBeNull();
    expect(kcalBalance(row('2026-03-03', { kcal: 2200 }))).toBeNull();
  });
  it('gives eaten minus burned', () => {
    expect(kcalBalance(row('2026-03-03', { kcal: 2200, burnedKcal: 2650 }))).toEqual({ burned: 2650, balance: -450 });
    expect(kcalBalance(row('2026-03-03', { kcal: 0, burnedKcal: 0 }))).toEqual({ burned: 0, balance: 0 });
  });
  it('has no balance without eaten calories', () => {
    expect(kcalBalance(row('2026-03-03', { burnedKcal: 2650 }))).toEqual({ burned: 2650, balance: null });
  });
});

describe('fmtBalance', () => {
  it('formats with a sign and German digits', () => {
    expect(fmtBalance(-450)).toBe('−450');
    expect(fmtBalance(120)).toBe('+120');
    expect(fmtBalance(0)).toBe('±0');
    expect(fmtBalance(-1250)).toBe('−1.250');
    expect(fmtBalance(2650)).toBe('+2.650');
  });
});

describe('isDayValuesList with burnedKcal', () => {
  it('accepts rows with and without it', () => {
    expect(isDayValuesList([row('2026-03-02', { kcal: 2000 }), row('2026-03-03', { kcal: 2200, burnedKcal: 2650, manual: ['kcal'] })])).toBe(true);
    expect(isDayValuesList([row('2026-03-03', { burnedKcal: 0 })])).toBe(true);
  });
  it('rejects a negative or non-numeric one', () => {
    expect(isDayValuesList([row('2026-03-03', { burnedKcal: -5 })])).toBe(false);
    expect(isDayValuesList([row('2026-03-03', { burnedKcal: NaN })])).toBe(false);
    expect(isDayValuesList([{ ...row('2026-03-03'), burnedKcal: '2650' }])).toBe(false);
    expect(isDayValuesList([{ ...row('2026-03-03'), burnedKcal: null }])).toBe(false);
  });
  it('does not allow burnedKcal in the manual list', () => {
    expect(isDayValuesList([{ ...row('2026-03-03', { burnedKcal: 2650 }), manual: ['burnedKcal'] }])).toBe(false);
  });
});

describe('parseHealthConfig healthKit flag', () => {
  it('keeps only an exact true', () => {
    expect(parseHealthConfig({ healthKit: true })).toEqual({ url: '', token: '', shortcut: DEFAULT_SHORTCUT, healthKit: true });
    for (const v of [false, 1, 'true', null, undefined, {}]) {
      expect(parseHealthConfig({ healthKit: v })).toEqual({ url: '', token: '', shortcut: DEFAULT_SHORTCUT });
      expect('healthKit' in parseHealthConfig({ healthKit: v })).toBe(false);
    }
  });
  it('survives a patch of the other fields', () => {
    const stored = { ...parseHealthConfig({ url: 'https://a.b', healthKit: true }), token: 't' };
    expect(parseHealthConfig(stored)).toEqual({ url: 'https://a.b', token: 't', shortcut: DEFAULT_SHORTCUT, healthKit: true });
  });
});

type Call = [string, string, unknown?];

function fakeBridge(plugins: string[], answer: () => Promise<unknown>): Bridge & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    nativePromise(...args: Call) {
      calls.push(args);
      return answer();
    },
    isPluginAvailable: (name) => plugins.includes(name),
  };
}

describe('createNative: Apple Health', () => {
  it('is native and sees the plugin through isPluginAvailable', () => {
    const asked: string[] = [];
    const bridge: Bridge = { nativePromise: () => Promise.resolve({}), isPluginAvailable: (n) => { asked.push(n); return n === 'HealthDays'; } };
    const n = createNative(bridge);
    expect(n.isNative()).toBe(true);
    expect(n.healthAvailable()).toBe(true);
    expect(asked).toEqual(['HealthDays']);
  });
  it('has no Health without the plugin', async () => {
    const other = fakeBridge(['RestActivity'], () => Promise.resolve({}));
    const n = createNative(other);
    expect(n.isNative()).toBe(true);
    expect(n.healthAvailable()).toBe(false);
    await expect(n.requestHealth()).rejects.toThrow();
    await expect(n.readHealthDays('2026-02-02')).rejects.toThrow();
    expect(other.calls).toEqual([]);
    const old = createNative({ nativePromise: () => Promise.resolve({}) });
    expect(old.healthAvailable()).toBe(false);
    await expect(old.readHealthDays('2026-02-02')).rejects.toThrow();
  });
  it('reads the days and returns the raw answer', async () => {
    const answer = { days: [{ date: '2026-03-03', steps: 5 }] };
    const bridge = fakeBridge(['HealthDays'], () => Promise.resolve(answer));
    await expect(createNative(bridge).readHealthDays('2026-02-02')).resolves.toBe(answer);
    expect(bridge.calls).toEqual([['HealthDays', 'readDays', { since: '2026-02-02' }]]);
  });
  it('asks for authorization', async () => {
    const bridge = fakeBridge(['HealthDays'], () => Promise.resolve({}));
    await expect(createNative(bridge).requestHealth()).resolves.toBeUndefined();
    expect(bridge.calls).toEqual([['HealthDays', 'requestAuthorization']]);
  });
  it('passes errors on', async () => {
    const bridge = fakeBridge(['HealthDays'], () => Promise.reject(new Error('nope')));
    const n = createNative(bridge);
    await expect(n.requestHealth()).rejects.toThrow('nope');
    await expect(n.readHealthDays('2026-02-02')).rejects.toThrow('nope');
  });
  it('does not wait for the notification queue', async () => {
    let release = () => {};
    const bridge: Bridge & { calls: string[] } = {
      calls: [],
      nativePromise(plugin, method) {
        this.calls.push(`${plugin}.${method}`);
        return plugin === 'Haptics' ? new Promise((r) => { release = () => r({}); }) : Promise.resolve({ days: [] });
      },
      isPluginAvailable: () => true,
    };
    const n = createNative(bridge);
    const tap = n.tap();
    await expect(n.readHealthDays('2026-02-02')).resolves.toEqual({ days: [] });
    expect([...bridge.calls].sort()).toEqual(['Haptics.impact', 'HealthDays.readDays']);
    release();
    await tap;
  });
  it('rejects in the browser and is not native', async () => {
    const n = createNative(null);
    expect(n.isNative()).toBe(false);
    expect(n.healthAvailable()).toBe(false);
    await expect(n.requestHealth()).rejects.toThrow();
    await expect(n.readHealthDays('2026-02-02')).rejects.toThrow();
  });
});
