import { describe, expect, it } from 'vitest';
import { authorize, tokensEqual } from './auth';

const TOKEN = 'test-token-not-real';

describe('tokensEqual', () => {
  it('is true only for identical strings', async () => {
    expect(await tokensEqual(TOKEN, TOKEN)).toBe(true);
    expect(await tokensEqual(TOKEN + 'x', TOKEN)).toBe(false);
    expect(await tokensEqual('', TOKEN)).toBe(false);
    expect(await tokensEqual(TOKEN.toUpperCase(), TOKEN)).toBe(false);
  });
});

describe('authorize', () => {
  it('accepts the correct bearer token', async () => {
    expect(await authorize(`Bearer ${TOKEN}`, TOKEN)).toBe('ok');
  });
  it('rejects missing, malformed and wrong headers', async () => {
    for (const h of [null, '', 'Bearer', 'Bearer ', `Basic ${TOKEN}`, TOKEN, `Bearer  ${TOKEN}`, `Bearer ${TOKEN} x`, 'Bearer wrong']) {
      expect(await authorize(h, TOKEN)).toBe('unauthorized');
    }
  });
  it('fails closed when the server token is unset or empty', async () => {
    expect(await authorize(`Bearer ${TOKEN}`, undefined)).toBe('misconfigured');
    expect(await authorize('Bearer ', '')).toBe('misconfigured');
    expect(await authorize(null, '')).toBe('misconfigured');
  });
});
