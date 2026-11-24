export interface VerifiedToken { uid: string }

interface Jwk { kid: string; n: string; e: string; kty: string; alg?: string }
let jwksCache: { keys: Jwk[]; exp: number } | null = null;

const fromB64url = (s: string): Uint8Array => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function getKeys(): Promise<Jwk[]> {
  if (jwksCache && jwksCache.exp > Date.now()) return jwksCache.keys;
  const res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!res.ok) throw new Error('Could not load Firebase signing keys');
  const j = (await res.json()) as { keys: Jwk[] };
  jwksCache = { keys: j.keys, exp: Date.now() + 3600_000 };
  return j.keys;
}

/** Verifies a Firebase ID token (RS256, issuer, audience, expiry). Throws on any problem. */
export async function verifyFirebaseToken(token: string, projectId: string): Promise<VerifiedToken> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [h, p, s] = parts;
  const dec = new TextDecoder();
  const header = JSON.parse(dec.decode(fromB64url(h))) as { alg?: string; kid?: string };
  const payload = JSON.parse(dec.decode(fromB64url(p))) as { aud?: string; iss?: string; sub?: string; exp?: number; iat?: number };
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported token');
  const jwk = (await getKeys()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown signing key');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64url(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('Bad signature');
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Wrong project');
  if (!payload.sub || typeof payload.exp !== 'number' || payload.exp < now || (payload.iat ?? 0) > now + 60) throw new Error('Token expired');
  return { uid: payload.sub };
}
