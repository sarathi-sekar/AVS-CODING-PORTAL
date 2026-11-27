import { useEffect, useState } from 'react';
/** True on phone-sized screens. */
export function useNarrow(maxWidth = 639): boolean {
  const q = `(max-width: ${maxWidth}px)`;
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const f = () => setN(m.matches); m.addEventListener('change', f); f(); return () => m.removeEventListener('change', f); }, [q]);
  return n;
}
