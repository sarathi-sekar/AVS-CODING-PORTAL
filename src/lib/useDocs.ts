import { useEffect, useState } from 'react';
import { getDocs, type Query } from 'firebase/firestore';
import { friendlyError } from './errors';

const cache = new Map<string, unknown[]>();

/**
 * One-shot query loader with stale-while-revalidate: if this key was loaded before, the old rows show
 * immediately and are refreshed in the background, so navigation feels instant.
 * `build` must only change when `key` changes.
 */
export function useQueryDocs<T>(build: () => Query | null, key: string, map: (id: string, data: Record<string, unknown>) => T) {
  const cached = cache.get(key) as T[] | undefined;
  const [data, setDataState] = useState<T[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');
  useEffect(() => {
    const q = build();
    if (!q) { setLoading(false); return; }
    let cancelled = false;
    const hit = cache.get(key) as T[] | undefined;
    if (hit) { setDataState(hit); setLoading(false); } else setLoading(true);
    getDocs(q)
      .then((snap) => { if (!cancelled) { const rows = snap.docs.map((d) => map(d.id, d.data())); cache.set(key, rows); setDataState(rows); setError(''); } })
      .catch((e) => !cancelled && setError(friendlyError(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const setData = (v: T[] | ((p: T[]) => T[])) => setDataState((prev) => { const next = typeof v === 'function' ? (v as (p: T[]) => T[])(prev) : v; cache.set(key, next); return next; });
  return { data, loading, error, setData };
}

/** Drop cached lists (call after an admin changes content). */
export function clearQueryCache(prefix = ''): void {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}
