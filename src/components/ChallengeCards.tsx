import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { Flame } from 'lucide-react';
import { db } from '../lib/firebase';
import { istDateKey, mondayOf } from '../shared/streak';

interface Item { label: string; bonus: number; questions: { id: string; title: string }[] }

export function ChallengeCards() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    (async () => {
      const today = istDateKey(new Date());
      const out: Item[] = [];
      for (const [label, id] of [['Today\'s challenge', `daily_${today}`], ['This week\'s challenge', `weekly_${mondayOf(today)}`]] as const) {
        try {
          const c = await getDoc(doc(db, 'challenges', id));
          if (!c.exists()) continue;
          const ids = (c.data().questionIds as string[]) ?? [];
          const questions = await Promise.all(ids.map(async (qid) => { const q = await getDoc(doc(db, 'questions', qid)); return { id: qid, title: (q.data()?.title as string | undefined) ?? 'Problem' }; }));
          out.push({ label, bonus: Number(c.data().bonusXp ?? 0), questions });
        } catch { /* challenges are optional */ }
      }
      setItems(out);
    })();
  }, []);
  if (items.length === 0) return null;
  return (
    <section className="grid gap-3 sm:grid-cols-2" aria-label="Challenges">
      {items.map((c) => (
        <div key={c.label} className="card !p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><Flame className="h-4 w-4 text-brand-ink" /> {c.label} <span className="ml-auto rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-ink">+{c.bonus} XP</span></p>
          <ul className="mt-2 space-y-1">{c.questions.map((q) => <li key={q.id}><Link className="text-sm text-brand-ink hover:underline" to={`/practice/${q.id}`}>{q.title}</Link></li>)}</ul>
          <p className="mt-2 text-xs text-muted">Bonus applies to your first accepted solve while the challenge runs.</p>
        </div>
      ))}
    </section>
  );
}
