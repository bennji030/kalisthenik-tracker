import { describe, expect, it } from 'vitest';
import type { DayValues } from './db';
import { isDayValuesList, manualFields, nextManual } from './dayValues';
import {
  DEFAULT_SHORTCUT, ERRORS, errorForStatus, isConfigured, isValidServerUrl, isValidToken, maskToken, mergeHealth,
  nextStatus, parseDaysResponse, parseHealthConfig, parseHealthStatus, runHealthSync, shortcutUrl, shouldSync,
  yesterdayKey, type FetchFn, type HealthConfig, type RemoteDay,
} from './health';

const NOW = new Date(2026, 2, 3, 15, 0).getTime(); // Di 3. März 2026
const T = 99;

const row = (date: string, v: Partial<DayValues> = {}): DayValues => ({ date, source: 'manual', updatedAt: 1, ...v });

describe('mergeHealth', () => {
  it('creates a health row with all remote fields when there is none', () => {
    expect(mergeHealth(undefined, { date: '2026-03-03', steps: 5000, kcal: 2011, proteinG: 120 }, T))
      .toEqual({ date: '2026-03-03', steps: 5000, kcal: 2011, proteinG: 120, source: 'health', updatedAt: T });
  });
  it('replaces a health row and removes a field the remote lacks', () => {
    const old = row('2026-03-03', { steps: 4000, kcal: 1500, source: 'health' });
    expect(mergeHealth(old, { date: '2026-03-03', steps: 6000 }, T))
      .toEqual({ date: '2026-03-03', steps: 6000, source: 'health', updatedAt: T });
  });
  it('keeps a manual field and fills the others from remote', () => {
    const old = row('2026-03-03', { steps: 4000, kcal: 1800, manual: ['kcal'] });
    expect(mergeHealth(old, { date: '2026-03-03', steps: 6000, kcal: 2500, proteinG: 120 }, T))
      .toEqual({ date: '2026-03-03', steps: 6000, kcal: 1800, proteinG: 120, manual: ['kcal'], source: 'manual', updatedAt: T });
  });
  it('treats a legacy manual row without a list as all-manual', () => {
    const old = row('2026-03-03', { steps: 4000, kcal: 1800 });
    expect(mergeHealth(old, { date: '2026-03-03', steps: 6000, kcal: 2500, proteinG: 120 }, T))
      .toEqual({ date: '2026-03-03', steps: 4000, kcal: 1800, proteinG: 120, manual: ['steps', 'kcal'], source: 'manual', updatedAt: T });
  });
  it('fills a manual field that has no value', () => {
    const old = row('2026-03-03', { steps: 4000, manual: ['steps', 'kcal'] });
    expect(mergeHealth(old, { date: '2026-03-03', steps: 6000, kcal: 2500 }, T))
      .toEqual({ date: '2026-03-03', steps: 4000, kcal: 2500, manual: ['steps'], source: 'manual', updatedAt: T });
  });
  it('drops the manual list when no manual field has a value', () => {
    const old = row('2026-03-03', { manual: ['kcal'] });
    expect(mergeHealth(old, { date: '2026-03-03', kcal: 2500 }, T))
      .toEqual({ date: '2026-03-03', kcal: 2500, source: 'health', updatedAt: T });
  });
});

describe('manualFields', () => {
  it('returns nothing without a row or for a health row', () => {
    expect(manualFields(undefined)).toEqual([]);
    expect(manualFields(row('2026-03-03', { steps: 1, source: 'health' }))).toEqual([]);
  });
  it('returns the stored list', () => {
    expect(manualFields(row('2026-03-03', { steps: 1, kcal: 2, manual: ['kcal'] }))).toEqual(['kcal']);
    expect(manualFields(row('2026-03-03', { steps: 1, manual: [] }))).toEqual([]);
  });
  it('returns every present field of a legacy manual row', () => {
    expect(manualFields(row('2026-03-03', { steps: 1, proteinG: 3 }))).toEqual(['steps', 'proteinG']);
  });
});

describe('nextManual', () => {
  const health = row('2026-03-03', { steps: 5000, kcal: 2000, proteinG: 100, source: 'health' });
  it('does not mark prefilled values that did not change', () => {
    expect(nextManual(health, { steps: 5000, kcal: 2000, proteinG: 100 })).toEqual([]);
  });
  it('marks a changed value', () => {
    expect(nextManual(health, { steps: 5000, kcal: 1800, proteinG: 100 })).toEqual(['kcal']);
  });
  it('marks every value of a new day', () => {
    expect(nextManual(undefined, { steps: 5000, kcal: 1800 })).toEqual(['steps', 'kcal']);
  });
  it('keeps earlier manual fields and unmarks a cleared field', () => {
    const old = row('2026-03-03', { steps: 5000, kcal: 1800, proteinG: 100, manual: ['steps', 'kcal'] });
    expect(nextManual(old, { steps: 5000, proteinG: 100 })).toEqual(['steps']);
  });
});

describe('isDayValuesList with manual', () => {
  it('accepts rows without manual and with a valid list', () => {
    expect(isDayValuesList([row('2026-03-01'), row('2026-03-02', { kcal: 1, manual: ['kcal', 'steps'] }), row('2026-03-03', { manual: [] })])).toBe(true);
  });
  it('rejects an invalid manual', () => {
    expect(isDayValuesList([{ ...row('2026-03-01'), manual: 'kcal' }])).toBe(false);
    expect(isDayValuesList([{ ...row('2026-03-01'), manual: ['weight'] }])).toBe(false);
    expect(isDayValuesList([{ ...row('2026-03-01'), manual: ['kcal', 'kcal'] }])).toBe(false);
    expect(isDayValuesList([{ ...row('2026-03-01'), manual: null }])).toBe(false);
  });
});

describe('parseDaysResponse', () => {
  const body = (days: unknown) => JSON.stringify({ days });
  it('accepts a valid response', () => {
    expect(parseDaysResponse(200, body([{ date: '2026-03-02', steps: 7000, kcal: 2000, proteinG: 150 }, { date: '2026-03-03', steps: 5000 }]), NOW))
      .toEqual([{ date: '2026-03-02', steps: 7000, kcal: 2000, proteinG: 150 }, { date: '2026-03-03', steps: 5000 }]);
    expect(parseDaysResponse(200, body([]), NOW)).toEqual([]);
  });
  it('rejects a wrong status', () => {
    expect(parseDaysResponse(204, body([]), NOW)).toBeNull();
    expect(parseDaysResponse(404, body([]), NOW)).toBeNull();
  });
  it('rejects non-JSON and a missing days array', () => {
    expect(parseDaysResponse(200, '<html>', NOW)).toBeNull();
    expect(parseDaysResponse(200, '{}', NOW)).toBeNull();
    expect(parseDaysResponse(200, '[]', NOW)).toBeNull();
    expect(parseDaysResponse(200, 'null', NOW)).toBeNull();
    expect(parseDaysResponse(200, JSON.stringify({ days: {} }), NOW)).toBeNull();
  });
  it('rejects an extra key, a bad or duplicate date and a non-object entry', () => {
    expect(parseDaysResponse(200, body([{ date: '2026-03-02', steps: 1, weight: 80 }]), NOW)).toBeNull();
    expect(parseDaysResponse(200, body([{ date: '2026-02-30', steps: 1 }]), NOW)).toBeNull();
    expect(parseDaysResponse(200, body([{ date: '2.3.2026', steps: 1 }]), NOW)).toBeNull();
    expect(parseDaysResponse(200, body([{ date: '2026-03-02', steps: 1 }, { date: '2026-03-02', steps: 2 }]), NOW)).toBeNull();
    expect(parseDaysResponse(200, body([null]), NOW)).toBeNull();
  });
  it('rejects values outside the server limits', () => {
    expect(parseDaysResponse(200, body([{ date: '2026-03-02', steps: 200001 }]), NOW)).toBeNull();
    expect(parseDaysResponse(200, body([{ date: '2026-03-02', steps: 12.5 }]), NOW)).toBeNull();
    expect(parseDaysResponse(200, body([{ date: '2026-03-02', kcal: -1 }]), NOW)).toBeNull();
    expect(parseDaysResponse(200, body([{ date: '2026-03-02', kcal: 20001 }]), NOW)).toBeNull();
    expect(parseDaysResponse(200, body([{ date: '2026-03-02', proteinG: 1000.5 }]), NOW)).toBeNull();
    expect(parseDaysResponse(200, body([{ date: '2026-03-02', kcal: '2000' }]), NOW)).toBeNull();
    expect(parseDaysResponse(200, body([{ date: '2026-03-02', kcal: null }]), NOW)).toBeNull();
  });
  it('rounds kcal and protein and drops values outside the app limits', () => {
    expect(parseDaysResponse(200, body([{ date: '2026-03-02', kcal: 2010.5, proteinG: 99.4 }]), NOW))
      .toEqual([{ date: '2026-03-02', kcal: 2011, proteinG: 99 }]);
    expect(parseDaysResponse(200, body([{ date: '2026-03-02', steps: 150000, kcal: 15000, proteinG: 100 }]), NOW))
      .toEqual([{ date: '2026-03-02', proteinG: 100 }]);
  });
  it('ignores future days and days with no field left', () => {
    expect(parseDaysResponse(200, body([{ date: '2026-03-03', steps: 1 }, { date: '2026-03-04', steps: 2 }]), NOW))
      .toEqual([{ date: '2026-03-03', steps: 1 }]);
    expect(parseDaysResponse(200, body([{ date: '2026-03-02', steps: 150000 }, { date: '2026-03-01' }]), NOW)).toEqual([]);
  });
});

describe('shouldSync', () => {
  it('runs the first time and when forced', () => {
    expect(shouldSync(null, NOW, false)).toBe(true);
    expect(shouldSync(NOW, NOW, true)).toBe(true);
  });
  it('waits 60 seconds from the last attempt', () => {
    expect(shouldSync(NOW, NOW + 59999, false)).toBe(false);
    expect(shouldSync(NOW, NOW + 60000, false)).toBe(true);
  });
});

describe('yesterdayKey', () => {
  it('handles month and year boundaries', () => {
    expect(yesterdayKey(NOW)).toBe('2026-03-02');
    expect(yesterdayKey(new Date(2026, 2, 1, 0, 30).getTime())).toBe('2026-02-28');
    expect(yesterdayKey(new Date(2027, 0, 1, 12).getTime())).toBe('2026-12-31');
  });
  it('handles a DST change', () => {
    // Europe: Sommerzeit beginnt am 29. März 2026, endet am 25. Oktober 2026.
    expect(yesterdayKey(new Date(2026, 2, 30, 0, 30).getTime())).toBe('2026-03-29');
    expect(yesterdayKey(new Date(2026, 2, 29, 23, 30).getTime())).toBe('2026-03-28');
    expect(yesterdayKey(new Date(2026, 9, 26, 0, 30).getTime())).toBe('2026-10-25');
    expect(yesterdayKey(new Date(2026, 9, 25, 23, 30).getTime())).toBe('2026-10-24');
  });
});

describe('URL and token validation', () => {
  it('accepts https and local http', () => {
    expect(isValidServerUrl('https://sync.example.workers.dev')).toBe(true);
    expect(isValidServerUrl(' https://sync.example.workers.dev/ ')).toBe(true);
    expect(isValidServerUrl('https://example.com/api//')).toBe(true);
    expect(isValidServerUrl('http://localhost:8787')).toBe(true);
    expect(isValidServerUrl('http://127.0.0.1:8787/')).toBe(true);
  });
  it('rejects other values', () => {
    expect(isValidServerUrl('')).toBe(false);
    expect(isValidServerUrl('example.com')).toBe(false);
    expect(isValidServerUrl('http://example.com')).toBe(false);
    expect(isValidServerUrl('ftp://localhost')).toBe(false);
    expect(isValidServerUrl('https://user:pw@example.com')).toBe(false);
    expect(isValidServerUrl('https://example.com?x=1')).toBe(false);
    expect(isValidServerUrl('https://example.com/?')).toBe(false);
    expect(isValidServerUrl('https://example.com#a')).toBe(false);
    expect(isValidServerUrl(42)).toBe(false);
  });
  it('accepts printable ASCII tokens without spaces up to 512 chars', () => {
    expect(isValidToken('test-token')).toBe(true);
    expect(isValidToken('a'.repeat(512))).toBe(true);
    expect(isValidToken('!~')).toBe(true);
  });
  it('rejects empty, too long, spaces and non-ASCII tokens', () => {
    expect(isValidToken('')).toBe(false);
    expect(isValidToken('a'.repeat(513))).toBe(false);
    expect(isValidToken('a b')).toBe(false);
    expect(isValidToken(' abc')).toBe(false);
    expect(isValidToken('schlüssel')).toBe(false);
    expect(isValidToken(undefined)).toBe(false);
  });
});

describe('config and status', () => {
  it('parses missing or malformed config to safe values', () => {
    expect(parseHealthConfig(undefined)).toEqual({ url: '', token: '', shortcut: DEFAULT_SHORTCUT });
    expect(parseHealthConfig([1])).toEqual({ url: '', token: '', shortcut: DEFAULT_SHORTCUT });
    expect(parseHealthConfig({ url: 5, token: null, shortcut: '  ' })).toEqual({ url: '', token: '', shortcut: DEFAULT_SHORTCUT });
    expect(parseHealthConfig({ url: 'https://a.b', token: 't', shortcut: ' Mein Sync ' })).toEqual({ url: 'https://a.b', token: 't', shortcut: 'Mein Sync' });
  });
  it('is configured only with a valid URL and token', () => {
    expect(isConfigured({ url: 'https://a.b', token: 't', shortcut: 'x' })).toBe(true);
    expect(isConfigured({ url: 'https://a.b', token: '', shortcut: 'x' })).toBe(false);
    expect(isConfigured({ url: 'http://a.b', token: 't', shortcut: 'x' })).toBe(false);
  });
  it('parses the status', () => {
    expect(parseHealthStatus(undefined)).toEqual({ lastSync: null, error: null });
    expect(parseHealthStatus({ lastSync: 5, error: 'x' })).toEqual({ lastSync: 5, error: 'x' });
    expect(parseHealthStatus({ lastSync: 'x', error: 3 })).toEqual({ lastSync: null, error: null });
  });
  it('updates the status from a result', () => {
    const prev = { lastSync: 1, error: null };
    expect(nextStatus(prev, { kind: 'skipped' }, T)).toEqual(prev);
    expect(nextStatus(prev, { kind: 'failed', error: 'x' }, T)).toEqual({ lastSync: 1, error: 'x' });
    expect(nextStatus({ lastSync: 1, error: 'x' }, { kind: 'synced', error: null }, T)).toEqual({ lastSync: T, error: null });
    expect(nextStatus(prev, { kind: 'synced', error: ERRORS.delete }, T)).toEqual({ lastSync: T, error: ERRORS.delete });
  });
  it('maps statuses to German errors', () => {
    expect(errorForStatus(401)).toBe('Schlüssel ungültig');
    expect(errorForStatus(500)).toBe('Server nicht eingerichtet (kein Schlüssel gesetzt)');
    expect(errorForStatus(404)).toBe('Server-Fehler (404)');
    expect(errorForStatus(503)).toBe('Server-Fehler (503)');
  });
  it('builds the shortcut link and masks the token', () => {
    expect(shortcutUrl('Calisthenics Sync')).toBe('shortcuts://run-shortcut?name=Calisthenics%20Sync');
    expect(shortcutUrl('A&B')).toBe('shortcuts://run-shortcut?name=A%26B');
    expect(maskToken('test-token')).toBe('test…');
  });
});

describe('runHealthSync', () => {
  const TOKEN = 'secret-token-123';
  const config: HealthConfig = { url: 'https://sync.example.com/', token: TOKEN, shortcut: DEFAULT_SHORTCUT };
  type Call = { url: string; init: RequestInit };

  function fake(responses: (Response | Error)[]) {
    const calls: Call[] = [];
    const fn: FetchFn = async (url, init) => {
      calls.push({ url, init });
      const r = responses.shift();
      if (!r || r instanceof Error) throw r ?? new Error('no response');
      return r;
    };
    return { fn, calls };
  }
  const ok = (days: unknown[]) => new Response(JSON.stringify({ days }), { status: 200 });
  const status = (n: number) => new Response(n === 204 ? null : JSON.stringify({ error: 'x' }), { status: n });
  const noSave = async () => {};
  const noToken = (r: unknown, calls: Call[]) => {
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    for (const c of calls) expect(c.url).not.toContain(TOKEN);
  };

  it('makes no request when not configured', async () => {
    const f = fake([]);
    expect(await runHealthSync({ ...config, token: '' }, NOW, f.fn, noSave)).toEqual({ kind: 'skipped' });
    expect(await runHealthSync({ ...config, url: 'http://example.com' }, NOW, f.fn, noSave)).toEqual({ kind: 'skipped' });
    expect(f.calls).toHaveLength(0);
  });
  it('reports a network error', async () => {
    const f = fake([new TypeError('Failed to fetch')]);
    const r = await runHealthSync(config, NOW, f.fn, noSave);
    expect(r).toEqual({ kind: 'failed', error: 'Keine Verbindung zum Server' });
    expect(f.calls).toHaveLength(1);
    noToken(r, f.calls);
  });
  it('reports 401, 500 and other statuses', async () => {
    for (const [n, error] of [[401, 'Schlüssel ungültig'], [500, 'Server nicht eingerichtet (kein Schlüssel gesetzt)'], [404, 'Server-Fehler (404)']] as const) {
      const f = fake([status(n)]);
      const r = await runHealthSync(config, NOW, f.fn, noSave);
      expect(r).toEqual({ kind: 'failed', error });
      expect(f.calls).toHaveLength(1);
      noToken(r, f.calls);
    }
  });
  it('rejects an invalid body without saving', async () => {
    const f = fake([new Response('{"days":[{"date":"x"}]}', { status: 200 })]);
    let saved = false;
    const r = await runHealthSync(config, NOW, f.fn, async () => { saved = true; });
    expect(r).toEqual({ kind: 'failed', error: 'Ungültige Antwort vom Server' });
    expect(saved).toBe(false);
    expect(f.calls).toHaveLength(1);
  });
  it('sends no DELETE when saving fails', async () => {
    const f = fake([ok([{ date: '2026-03-03', steps: 5000 }])]);
    const r = await runHealthSync(config, NOW, f.fn, async () => { throw new Error('quota'); });
    expect(r).toEqual({ kind: 'failed', error: 'Speichern fehlgeschlagen' });
    expect(f.calls).toHaveLength(1);
  });
  it('fetches the last 30 days, saves them, then deletes until yesterday', async () => {
    const f = fake([ok([{ date: '2026-03-02', steps: 7000, kcal: 2010.5 }, { date: '2026-03-03', steps: 5000 }]), status(204)]);
    let saved: RemoteDay[] = [];
    const r = await runHealthSync(config, NOW, f.fn, async (days) => { saved = days; });
    expect(r).toEqual({ kind: 'synced', error: null });
    expect(saved).toEqual([{ date: '2026-03-02', steps: 7000, kcal: 2011 }, { date: '2026-03-03', steps: 5000 }]);
    expect(f.calls.map((c) => [c.init.method, c.url])).toEqual([
      ['GET', 'https://sync.example.com/v1/days?since=2026-02-02'],
      ['DELETE', 'https://sync.example.com/v1/days?until=2026-03-02'],
    ]);
    for (const c of f.calls) {
      expect(c.init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
      expect(c.init.cache).toBe('no-store');
      expect(c.init.credentials).toBe('omit');
      expect(c.init.signal).toBeInstanceOf(AbortSignal);
    }
    noToken(r, f.calls);
  });
  it('keeps the save but reports a failed DELETE', async () => {
    for (const del of [status(500), new TypeError('offline')]) {
      const f = fake([ok([{ date: '2026-03-03', steps: 5000 }]), del]);
      let saved = false;
      const r = await runHealthSync(config, NOW, f.fn, async () => { saved = true; });
      expect(saved).toBe(true);
      expect(r).toEqual({ kind: 'synced', error: 'Alte Tage konnten nicht gelöscht werden' });
      expect(f.calls).toHaveLength(2);
      noToken(r, f.calls);
    }
  });
});
