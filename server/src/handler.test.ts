import { beforeEach, describe, expect, it } from 'vitest';
import { handle } from './handler';
import { kvStore, type KVNamespace } from './store';

const TOKEN = 'test-token-not-real';
const BASE = 'https://server.example';

/** In-memory KV that pages list() results like Cloudflare does. */
class FakeKv implements KVNamespace {
  data = new Map<string, string>();
  puts: { key: string; options?: { expirationTtl?: number } }[] = [];
  listCalls = 0;
  constructor(private pageSize = 1000) {}
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    this.puts.push({ key, options });
    this.data.set(key, value);
  }
  async delete(key: string) {
    this.data.delete(key);
  }
  async list(options?: { prefix?: string; cursor?: string }) {
    this.listCalls++;
    const names = [...this.data.keys()].filter((k) => k.startsWith(options?.prefix ?? '')).sort();
    const start = options?.cursor ? Number(options.cursor) : 0;
    const end = start + this.pageSize;
    const done = end >= names.length;
    return {
      keys: names.slice(start, end).map((name) => ({ name })),
      list_complete: done,
      ...(done ? {} : { cursor: String(end) }),
    };
  }
}

let kv: FakeKv;
let token: string | undefined;

function send(method: string, path: string, init: { body?: string; auth?: string | null; origin?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...init.headers };
  const auth = init.auth === undefined ? `Bearer ${TOKEN}` : init.auth;
  if (auth !== null) headers.Authorization = auth;
  if (init.origin) headers.Origin = init.origin;
  return handle(new Request(BASE + path, { method, headers, body: init.body }), { token, store: kvStore(kv) });
}

const put = (date: string, body: unknown, init = {}) => send('PUT', `/v1/days/${date}`, { body: JSON.stringify(body), ...init });

async function getDays(since: string) {
  const res = await send('GET', `/v1/days?since=${since}`);
  expect(res.status).toBe(200);
  return (await res.json()).days;
}

beforeEach(() => {
  kv = new FakeKv();
  token = TOKEN;
});

describe('PUT and GET', () => {
  it('stores a day and returns it', async () => {
    const res = await put('2026-11-20', { steps: 8123, kcal: 2010.5, proteinG: 150 });
    expect(res.status).toBe(204);
    expect(await getDays('2026-11-20')).toEqual([{ date: '2026-11-20', steps: 8123, kcal: 2010.5, proteinG: 150 }]);
  });
  it('replaces a day instead of merging', async () => {
    await put('2026-11-20', { steps: 8123, kcal: 2010.5, proteinG: 150 });
    expect((await put('2026-11-20', { steps: 9000 })).status).toBe(204);
    const days = await getDays('2026-11-01');
    expect(days).toEqual([{ date: '2026-11-20', steps: 9000 }]);
    expect(Object.keys(days[0])).toEqual(['date', 'steps']);
  });
  it('filters by since (inclusive) and sorts ascending', async () => {
    await put('2026-11-22', { steps: 3 });
    await put('2026-11-18', { steps: 1 });
    await put('2026-11-20', { kcal: 2 });
    await put('2026-12-01', { proteinG: 4 });
    expect(await getDays('2026-11-20')).toEqual([
      { date: '2026-11-20', kcal: 2 },
      { date: '2026-11-22', steps: 3 },
      { date: '2026-12-01', proteinG: 4 },
    ]);
    expect(await getDays('2026-12-02')).toEqual([]);
  });
  it('answers an empty list as { days: [] } with JSON headers', async () => {
    const res = await send('GET', '/v1/days?since=2026-01-01');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ days: [] });
  });
  it('stores every day with a 30-day TTL and nothing but the values', async () => {
    await put('2026-11-20', { steps: 8123, kcal: 2010.5, proteinG: 150 }, { origin: 'http://localhost:5173' });
    expect(kv.puts).toEqual([{ key: 'day:2026-11-20', options: { expirationTtl: 2592000 } }]);
    expect(JSON.parse(kv.data.get('day:2026-11-20')!)).toEqual({ steps: 8123, kcal: 2010.5, proteinG: 150 });
  });
  it('rejects invalid PUTs with 400 and stores nothing', async () => {
    const cases: [string, string][] = [
      ['2026-11-20', '{"steps":-1}'],
      ['2026-11-20', '{"steps":1.5}'],
      ['2026-11-20', '{"steps":200001}'],
      ['2026-11-20', '{"kcal":20001}'],
      ['2026-11-20', '{"proteinG":"150"}'],
      ['2026-11-20', '{"steps":null}'],
      ['2026-11-20', '{"foo":1}'],
      ['2026-11-20', '{}'],
      ['2026-11-20', '[1]'],
      ['2026-11-20', 'not json'],
      ['2026-11-20', ''],
      ['2026-11-20', `{"steps":1${' '.repeat(1100)}}`],
      ['2026-02-30', '{"steps":1}'],
      ['2026-2-3', '{"steps":1}'],
      ['heute', '{"steps":1}'],
    ];
    for (const [date, body] of cases) {
      const res = await send('PUT', `/v1/days/${date}`, { body });
      expect(res.status, `${date} ${body.slice(0, 20)}`).toBe(400);
      expect(res.headers.get('Content-Type')).toBe('application/json');
      expect(typeof (await res.json()).error).toBe('string');
    }
    expect(kv.data.size).toBe(0);
  });
  it('rejects a Content-Length over 1024 before reading the body', async () => {
    const res = await send('PUT', '/v1/days/2026-11-20', { body: '{"steps":1}', headers: { 'Content-Length': '2048' } });
    expect(res.status).toBe(400);
    expect(kv.data.size).toBe(0);
  });
  it('validates since', async () => {
    for (const q of ['', '?since=', '?since=2026-02-30', '?since=gestern', '?until=2026-01-01']) {
      expect((await send('GET', `/v1/days${q}`)).status).toBe(400);
    }
  });
  it('does not echo request values in errors', async () => {
    const res = await send('PUT', '/v1/days/2026-11-20', { body: '{"secretvalue":1}' });
    expect(await res.text()).not.toContain('secretvalue');
  });
});

describe('DELETE', () => {
  it('removes until (inclusive) and keeps later days', async () => {
    await put('2026-11-18', { steps: 1 });
    await put('2026-11-19', { steps: 2 });
    await put('2026-11-20', { steps: 3 });
    const res = await send('DELETE', '/v1/days?until=2026-11-19');
    expect(res.status).toBe(204);
    expect(await getDays('2000-01-01')).toEqual([{ date: '2026-11-20', steps: 3 }]);
  });
  it('validates until', async () => {
    await put('2026-11-18', { steps: 1 });
    for (const q of ['', '?until=', '?until=2026-02-30', '?since=2026-12-01']) {
      expect((await send('DELETE', `/v1/days${q}`)).status).toBe(400);
    }
    expect(kv.data.size).toBe(1);
  });
});

describe('KV paging', () => {
  it('reads and deletes across several list() pages', async () => {
    kv = new FakeKv(2);
    for (let d = 1; d <= 7; d++) await put(`2026-11-0${d}`, { steps: d });
    kv.listCalls = 0;
    const days = await getDays('2026-11-01');
    expect(days.map((d: { steps: number }) => d.steps)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(kv.listCalls).toBe(4);
    expect((await send('DELETE', '/v1/days?until=2026-11-06')).status).toBe(204);
    expect([...kv.data.keys()]).toEqual(['day:2026-11-07']);
  });
});

describe('auth', () => {
  const routes: [string, string, string?][] = [
    ['GET', '/v1/days?since=2026-01-01'],
    ['DELETE', '/v1/days?until=2026-01-01'],
    ['PUT', '/v1/days/2026-11-20', '{"steps":1}'],
    ['GET', '/unknown'],
    ['PUT', '/v1/days/2026-02-30', 'garbage'],
  ];
  it('answers 401 without, with a malformed or with a wrong token', async () => {
    for (const auth of [null, '', `Basic ${TOKEN}`, TOKEN, 'Bearer ', 'Bearer wrong', `Bearer ${TOKEN}x`]) {
      for (const [method, path, body] of routes) {
        const res = await send(method, path, { auth, body });
        expect(res.status, `${method} ${path} ${auth}`).toBe(401);
        const text = await res.text();
        expect(JSON.parse(text)).toEqual({ error: 'unauthorized' });
        expect(text).not.toContain(TOKEN);
      }
    }
    expect(kv.data.size).toBe(0);
  });
  it('answers 500 when the server token is unset or empty', async () => {
    for (const t of [undefined, '']) {
      token = t;
      for (const auth of [`Bearer ${TOKEN}`, 'Bearer ', null]) {
        for (const [method, path, body] of routes) {
          expect((await send(method, path, { auth, body })).status).toBe(500);
        }
      }
    }
    expect(kv.data.size).toBe(0);
  });
});

describe('routing', () => {
  it('answers 404 for unknown paths', async () => {
    for (const path of ['/', '/v1', '/v1/day', '/v1/days/', '/v1/days/2026-11-20/x', '/v2/days']) {
      const res = await send('GET', path);
      expect(res.status, path).toBe(404);
      expect(await res.json()).toEqual({ error: 'not found' });
    }
  });
  it('answers 405 for a wrong method on a known path', async () => {
    expect((await send('POST', '/v1/days')).status).toBe(405);
    expect((await send('PUT', '/v1/days', { body: '{"steps":1}' })).status).toBe(405);
    expect((await send('GET', '/v1/days/2026-11-20')).status).toBe(405);
    expect((await send('DELETE', '/v1/days/2026-11-20')).status).toBe(405);
  });
});

describe('CORS', () => {
  const allowed = ['https://bennji030.github.io', 'http://localhost:5173', 'http://127.0.0.1:5450'];
  const denied = [
    'https://bennji030.github.io.evil.com',
    'http://bennji030.github.io',
    'https://evil.github.io',
    'http://localhost.evil.com',
    'http://localhost:5173.evil.com',
    'https://localhost:5173',
    'null',
  ];

  it('echoes allowed origins on success and on errors', async () => {
    for (const origin of allowed) {
      for (const [res, status] of [
        [await send('GET', '/v1/days?since=2026-01-01', { origin }), 200],
        [await send('GET', '/v1/days?since=2026-01-01', { origin, auth: null }), 401],
        [await send('GET', '/nope', { origin }), 404],
      ] as const) {
        expect(res.status).toBe(status);
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
        expect(res.headers.get('Vary')).toBe('Origin');
        expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull();
      }
    }
  });
  it('sends no allow headers for look-alike or missing origins but still serves them', async () => {
    for (const origin of [...denied, undefined]) {
      const res = await send('GET', '/v1/days?since=2026-01-01', { origin });
      expect(res.status).toBe(200);
      for (const name of res.headers.keys()) expect(name.startsWith('access-control-')).toBe(false);
    }
  });
  it('answers a preflight from an allowed origin with 204 and no auth', async () => {
    for (const path of ['/v1/days', '/v1/days/2026-11-20']) {
      const res = await send('OPTIONS', path, {
        auth: null,
        origin: 'https://bennji030.github.io',
        headers: { 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization, content-type' },
      });
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://bennji030.github.io');
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, PUT, DELETE, OPTIONS');
      expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, Content-Type');
      expect(Number(res.headers.get('Access-Control-Max-Age'))).toBeGreaterThan(0);
      expect(res.headers.get('Vary')).toBe('Origin');
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    }
  });
  it('works for preflight even when the server token is unset', async () => {
    token = undefined;
    const res = await send('OPTIONS', '/v1/days', { auth: null, origin: 'http://localhost:5173' });
    expect(res.status).toBe(204);
  });
  it('gives a preflight from a disallowed origin no allow headers', async () => {
    const res = await send('OPTIONS', '/v1/days', { auth: null, origin: 'https://bennji030.github.io.evil.com' });
    for (const name of res.headers.keys()) expect(name.startsWith('access-control-')).toBe(false);
  });
  it('answers a preflight on an unknown path with 404', async () => {
    expect((await send('OPTIONS', '/nope', { auth: null, origin: 'http://localhost:5173' })).status).toBe(404);
  });
});
