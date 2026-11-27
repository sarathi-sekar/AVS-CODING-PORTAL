import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Award, Lock } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/errors';
import { BADGES, levelFromXp, xpForLevel } from '../shared/gamification';
import { ErrorNote, PageHeader, Spinner } from '../components/ui';

export default function Achievements() {
  const { profile } = useAuth();
  const [xp, setXp] = useState<number | null>(null);
  const [badges, setBadges] = useState<Record<string, { toDate(): Date }>>({});
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!profile) return;
    getDoc(doc(db, 'achievements', profile.uid)).then((s) => { setXp((s.data()?.xp as number | undefined) ?? 0); setBadges((s.data()?.badges ?? {}) as typeof badges); }).catch((e) => setErr(friendlyError(e)));
  }, [profile]);
  if (err) return <ErrorNote message={err} />;
  if (xp === null) return <Spinner />;
  const level = levelFromXp(xp);
  const lo = xpForLevel(level);
  const hi = xpForLevel(level + 1);
  const pct = Math.round(((xp - lo) / (hi - lo)) * 100);
  return (
    <>
      <PageHeader title="Achievements" subtitle="XP and badges are awarded only for verified activity." />
      <div className="card mb-4">
        <div className="flex items-end justify-between"><p className="text-3xl font-semibold">Level {level}</p><p className="text-sm text-muted">{xp} XP</p></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next level"><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div>
        <p className="mt-1 text-xs text-muted">{hi - xp} XP to level {level + 1}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BADGES.map((b) => {
          const earned = badges[b.id];
          return (
            <div key={b.id} className={`card flex items-start gap-3 ${earned ? '' : 'opacity-60'}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${earned ? 'bg-brand-soft text-brand-ink' : 'bg-subtle text-muted'}`}>{earned ? <Award className="h-5 w-5" /> : <Lock className="h-5 w-5" />}</span>
              <div><p className="text-sm font-semibold">{b.title}</p><p className="text-xs text-muted">{b.description}</p>{earned && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Earned {earned.toDate().toLocaleDateString('en-IN')}</p>}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
