import { useSyncExternalStore } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { friendlyError } from './errors';
import type { UserProfile } from '../types';

interface State { rows: UserProfile[]; loading: boolean; error: string }
let state: State = { rows: [], loading: true, error: '' };
const listeners = new Set<() => void>();
let unsub: (() => void) | null = null;

function start() {
  unsub = onSnapshot(
    query(collection(db, 'users'), where('status', '==', 'pending')),
    (snap) => {
      const rows = snap.docs.map((d) => ({ ...(d.data() as Omit<UserProfile, 'uid'>), uid: d.id }));
      rows.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      state = { rows, loading: false, error: '' };
      listeners.forEach((l) => l());
    },
    (e) => { state = { rows: [], loading: false, error: friendlyError(e) }; listeners.forEach((l) => l()); },
  );
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) { unsub?.(); unsub = null; state = { rows: [], loading: true, error: '' }; }
  };
}

/** Live list of users waiting for approval. One shared Firestore listener, updates the moment a student registers. */
export function usePendingUsers(): State {
  return useSyncExternalStore(subscribe, () => state);
}
