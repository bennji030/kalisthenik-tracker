async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/** Compares the SHA-256 digests over all bytes, so timing reveals neither contents nor length. */
export async function tokensEqual(presented: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(presented), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export type AuthResult = 'ok' | 'unauthorized' | 'misconfigured';

/** Checks `Authorization: Bearer <token>`. An unset or empty server token fails closed. */
export async function authorize(header: string | null, token: string | undefined): Promise<AuthResult> {
  if (!token) return 'misconfigured';
  const match = /^Bearer (\S+)$/.exec(header ?? '');
  if (!match) return 'unauthorized';
  return (await tokensEqual(match[1], token)) ? 'ok' : 'unauthorized';
}
