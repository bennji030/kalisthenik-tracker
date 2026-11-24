import { describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUT, ERRORS, MAX_BODY, runHealthSync, type FetchFn, type HealthConfig, type RemoteDay } from './health';

const NOW = new Date(2026, 2, 3, 15, 0).getTime();
const config: HealthConfig = { url: 'https://sync.example.com', token: 'secret-token-123', shortcut: DEFAULT_SHORTCUT };

function once(res: Response): FetchFn {
  return async () => res;
}

describe('runHealthSync response size', () => {
  it('rejects a body larger than MAX_BODY without saving', async () => {
    const big = JSON.stringify({ days: [], pad: 'x'.repeat(MAX_BODY) });
    let saved: RemoteDay[] | null = null;
    const r = await runHealthSync(config, NOW, once(new Response(big, { status: 200 })), async d => { saved = d; });
    expect(r).toEqual({ kind: 'failed', error: ERRORS.invalid });
    expect(saved).toBeNull();
  });
  it('rejects a too large Content-Length before reading the body', async () => {
    const res = new Response('{"days":[]}', { status: 200, headers: { 'Content-Length': String(MAX_BODY + 1) } });
    let read = false;
    const orig = res.text.bind(res);
    res.text = async () => { read = true; return orig(); };
    expect(await runHealthSync(config, NOW, once(res), async () => {})).toEqual({ kind: 'failed', error: ERRORS.invalid });
    expect(read).toBe(false);
  });
  it('still accepts a normal response', async () => {
    const res = new Response(JSON.stringify({ days: [{ date: '2026-03-03', steps: 5000 }] }), { status: 200 });
    const calls: string[] = [];
    const fn: FetchFn = async url => { calls.push(url); return calls.length === 1 ? res : new Response(null, { status: 204 }); };
    let saved: RemoteDay[] = [];
    expect(await runHealthSync(config, NOW, fn, async d => { saved = d; })).toEqual({ kind: 'synced', error: null });
    expect(saved).toEqual([{ date: '2026-03-03', steps: 5000 }]);
  });
});
