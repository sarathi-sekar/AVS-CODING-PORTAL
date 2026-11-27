import { useCallback, useEffect, useRef, useState } from 'react';
import { getDocs, limit, query, startAfter, type DocumentSnapshot, type QueryConstraint } from 'firebase/firestore';
import { collection } from 'firebase/firestore';
import { db } from './firebase';
import { friendlyError } from './errors';
import type { UserProfile } from '../types';

const PAGE = 50;

/** Cursor-paginated user list. `constraints` must be stable (memoised) between renders. */
export function usePagedUsers(constraints: QueryConstraint[], resetKey: string, sortBy: 'name' | 'created' | 'none' = 'none') {
  const [rows, setRowsState] = useState<UserProfile[]>([]);
  const setRows = (v: UserProfile[]) => { rowsRef.current = v; setRowsState(v); };
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const cursor = useRef<DocumentSnapshot | null>(null);
  const rowsRef = useRef<UserProfile[]>([]);
  const prev = () => rowsRef.current;
  const constraintsRef = useRef(constraints);
  constraintsRef.current = constraints;

  const load = useCallback(async (reset: boolean) => {
    setLoading(true);
    setError('');
    try {
      const extra: QueryConstraint[] = [limit(PAGE)];
      if (!reset && cursor.current) extra.unshift(startAfter(cursor.current));
      const snap = await getDocs(query(collection(db, 'users'), ...constraintsRef.current, ...extra));
      const next = snap.docs.map((d) => ({ ...(d.data() as Omit<UserProfile, 'uid'>), uid: d.id }));
      cursor.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === PAGE);
      const merged = reset ? next : [...prev(), ...next];
      setRows(sortBy === 'name' ? merged.sort((a, b) => a.displayName.localeCompare(b.displayName)) : merged);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    cursor.current = null;
    void load(true);
  }, [resetKey, load]);

  const patch = useCallback((uid: string, change: Partial<UserProfile>) => {
    const next = rowsRef.current.map((r) => (r.uid === uid ? { ...r, ...change } : r));
    rowsRef.current = next; setRowsState(next);
  }, []);

  return { rows, loading, hasMore, error, loadMore: () => load(false), reload: () => load(true), patch };
}
