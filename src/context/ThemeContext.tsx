import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import type { ThemeName } from '../types';

interface ThemeState {
  theme: ThemeName;
  toggle: () => void;
}
const Ctx = createContext<ThemeState | null>(null);

function initial(): ThemeName {
  try {
    return localStorage.getItem('avs-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function apply(t: ThemeName) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  try {
    localStorage.setItem('avs-theme', t);
  } catch {
    /* storage unavailable - theme still applies for this session */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [theme, setTheme] = useState<ThemeName>(initial);

  // Restore the theme saved on the student's account when they log in.
  const savedTheme = profile?.theme;
  useEffect(() => {
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
      apply(savedTheme);
    }
  }, [savedTheme]);

  const uid = profile?.uid;
  const status = profile?.status;
  const toggle = useCallback(() => {
    const next: ThemeName = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    apply(next);
    if (uid && status === 'active') {
      updateDoc(doc(db, 'users', uid), { theme: next }).catch(() => undefined);
    }
  }, [theme, uid, status]);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used inside ThemeProvider');
  return v;
}
