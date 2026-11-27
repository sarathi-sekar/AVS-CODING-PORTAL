import type { Data, Store, Tx } from './store';

type FV = Record<string, unknown>;

export function toValue(v: unknown): FV {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v as Data) } };
}
export function toFields(d: Data): Record<string, FV> {
  const out: Record<string, FV> = {};
  for (const [k, v] of Object.entries(d)) if (v !== undefined) out[k] = toValue(v);
  return out;
}
export function fromValue(v: FV): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return new Date(v.timestampValue as string);
  if ('arrayValue' in v) return (((v.arrayValue as FV).values as FV[] | undefined) ?? []).map(fromValue);
  if ('mapValue' in v) return fromFields(((v.mapValue as FV).fields as Record<string, FV> | undefined) ?? {});
  return null;
}
export function fromFields(f: Record<string, FV>): Data {
  const out: Data = {};
  for (const [k, v] of Object.entries(f)) out[k] = fromValue(v);
  return out;
}

export interface ServiceAccount { client_email: string; private_key: string }

const b64url = (b: ArrayBuffer | Uint8Array) => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let cachedToken: { value: string; exp: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  const nowS = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > nowS) return cachedToken.value;
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: nowS, exp: nowS + 3600,
  })));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${head}.${claims}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`Service account token request failed (${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: j.access_token, exp: nowS + j.expires_in };
  return j.access_token;
}

export class FirestoreRestStore implements Store {
  private readonly root: string;
  constructor(projectId: string, private readonly sa: ServiceAccount) {
    this.root = `projects/${projectId}/databases/(default)/documents`;
  }

  private async call(method: string, url: string, body?: unknown): Promise<Response> {
    const token = await accessToken(this.sa);
    return fetch(`https://firestore.googleapis.com/v1/${url}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private async batchGet(paths: string[], transaction?: string): Promise<(Data | null)[]> {
    const res = await this.call('POST', `${this.root}:batchGet`, {
      documents: paths.map((p) => `${this.root}/${p}`),
      ...(transaction ? { transaction } : {}),
    });
    if (!res.ok) throw new Error(`Firestore read failed (${res.status})`);
    const rows = (await res.json()) as { found?: { name: string; fields?: Record<string, FV> }; missing?: string }[];
    const byName = new Map<string, Data | null>();
    for (const r of rows) {
      if (r.found) byName.set(r.found.name, fromFields(r.found.fields ?? {}));
      else if (r.missing) byName.set(r.missing, null);
    }
    return paths.map((p) => byName.get(`${this.root}/${p}`) ?? null);
  }

  async get(path: string): Promise<Data | null> {
    return (await this.batchGet([path]))[0];
  }

  async transact<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const begin = await this.call('POST', `${this.root}:beginTransaction`, { options: { readWrite: {} } });
      if (!begin.ok) throw new Error(`Firestore transaction failed to start (${begin.status})`);
      const { transaction } = (await begin.json()) as { transaction: string };
      const writes: Record<string, Data> = {};
      const tx: Tx = {
        get: async (p) => (await this.batchGet([p], transaction))[0],
        getMany: (ps) => this.batchGet(ps, transaction),
        set: (p, d) => { writes[p] = d; },
      };
      const result = await fn(tx);
      const commit = await this.call('POST', `${this.root}:commit`, {
        transaction,
        writes: Object.entries(writes).map(([p, d]) => ({ update: { name: `${this.root}/${p}`, fields: toFields(d) } })),
      });
      if (commit.ok) return result;
      if (commit.status === 409 && attempt < 2) continue; // contention: retry
      throw new Error(`Firestore commit failed (${commit.status})`);
    }
  }
}
