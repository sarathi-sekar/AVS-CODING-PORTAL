import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { createStudentProfile, type ProfileInput } from '../lib/accounts';
import { auth, db, firebaseConfigured } from '../lib/firebase';
import type { UserProfile } from '../types';

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
  registerNumber: string;
  department: string;
  academicYear: string;
  section: string;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  registering: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  completeProfile: (input: ProfileInput) => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [registering, setRegistering] = useState(false);
  const unsubProfile = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!firebaseConfigured) return;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      unsubProfile.current?.();
      unsubProfile.current = null;
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      unsubProfile.current = onSnapshot(
        doc(db, 'users', u.uid),
        (snap) => {
          setProfile(snap.exists() ? ({ ...(snap.data() as Omit<UserProfile, 'uid'>), uid: snap.id } as UserProfile) : null);
          setLoading(false);
        },
        () => {
          setProfile(null);
          setLoading(false);
        },
      );
    });
    return () => {
      unsubAuth();
      unsubProfile.current?.();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setRegistering(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
      try {
        await Promise.all([
          updateProfile(cred.user, { displayName: input.displayName.trim() }).catch(() => undefined),
          createStudentProfile(cred.user.uid, input.email, input),
        ]);
      } catch (inner) {
        // Roll back the auth account so the student can try again with the same email.
        await deleteUser(cred.user).catch(() => undefined);
        await signOut(auth).catch(() => undefined);
        throw inner;
      }
    } finally {
      setRegistering(false);
    }
  }, []);

  const completeProfile = useCallback(async (input: ProfileInput) => {
    if (!auth.currentUser) throw new Error('Please log in again.');
    await createStudentProfile(auth.currentUser.uid, auth.currentUser.email ?? '', input);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const value = useMemo(
    () => ({ user, profile, loading, registering, login, register, logout, resetPassword, completeProfile }),
    [user, profile, loading, registering, login, register, logout, resetPassword, completeProfile],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
