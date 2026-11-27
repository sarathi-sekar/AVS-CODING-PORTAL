import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { friendlyError } from '../../lib/errors';
import { istDateKey, mondayOf } from '../../shared/streak';
import { EmptyState, ErrorNote, PageHeader, Spinner, SuccessNote } from '../../components/ui';

interface Q { id: string; title: string; difficulty: string; status: string }
interface Ch { id: string; type: 'daily' | 'weekly'; date: string; questionIds: string[]; bonusXp: number }

export default function ManageChallenges() {
  const { profile } = useAuth();
  const [qs, setQs] = useState<Q[]>([]);
  const [list, setList] = useState<Ch[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [type, setType] = useState<'daily' | 'weekly'>('daily');
  const [date, setDate] = useState(istDateKey(new Date()));
  const [picked, setPicked] = useState<string[]>([]);
  const [bonus, setBonus] = useState(20);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([getDocs(query(collection(db, 'questions'), orderBy('title'))), getDocs(collection(db, 'challenges'))]);
      setQs(a.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Q, 'id'>) })));
      setList(b.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Ch, 'id'>) })).sort((x, y) => y.date.localeCompare(x.date)));
    } catch (e) { setErr(friendlyError(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => void load(), [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setOk('');
    if (picked.length === 0) return setErr('Pick at least one question.');
    setBusy(true);
    try {
      const day = type === 'weekly' ? mondayOf(date) : date;
      await setDoc(doc(db, 'challenges', `${type}_${day}`), { type, date: day, questionIds: picked, bonusXp: Math.min(100, Math.max(0, bonus)), createdBy: profile?.uid, createdAt: serverTimestamp() });
      setOk(`${type === 'weekly' ? 'Weekly challenge for the week starting' : 'Daily challenge for'} ${day} saved.`); setPicked([]); await load();
    } catch (x) { setErr(friendlyError(x)); } finally { setBusy(false); }
  };
  const remove = async (c: Ch) => { if (!window.confirm('Delete this challenge?')) return; try { await deleteDoc(doc(db, 'challenges', c.id)); setList((l) => l.filter((x) => x.id !== c.id)); } catch (x) { setErr(friendlyError(x)); } };
  const title = (id: string) => qs.find((q) => q.id === id)?.title ?? id;
  const published = qs.filter((q) => q.status === 'published');

  return (
    <>
      <PageHeader title="Daily & weekly challenges" subtitle="Students earn bonus XP for solving a scheduled problem for the first time while its challenge is running (Asia/Kolkata dates)." />
      {err && <div className="mb-3"><ErrorNote message={err} /></div>}
      {ok && <div className="mb-3"><SuccessNote message={ok} /></div>}
      <form onSubmit={save} className="card mb-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label" htmlFor="c-t">Type</label><select id="c-t" className="input" value={type} onChange={(e) => setType(e.target.value as 'daily' | 'weekly')}><option value="daily">Daily challenge</option><option value="weekly">Weekly challenge</option></select></div>
          <div><label className="label" htmlFor="c-d">{type === 'daily' ? 'Date' : 'Any date in the week'}</label><input id="c-d" type="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="label" htmlFor="c-b">Bonus XP (0-100)</label><input id="c-b" type="number" min={0} max={100} className="input" value={bonus} onChange={(e) => setBonus(Number(e.target.value))} /></div>
        </div>
        <fieldset><legend className="label">Published questions</legend>
          {published.length === 0 ? <p className="text-sm text-muted">No published questions yet. Publish some in Questions first.</p> : (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-line p-2">{published.map((q) => (
              <label key={q.id} className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-subtle"><input type="checkbox" checked={picked.includes(q.id)} onChange={() => setPicked((p) => (p.includes(q.id) ? p.filter((x) => x !== q.id) : [...p, q.id]))} /><span className="min-w-0 flex-1 truncate">{q.title}</span><span className="text-xs capitalize text-muted">{q.difficulty}</span></label>))}</div>
          )}
        </fieldset>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save challenge'}</button>
      </form>
      <div className="card !p-0">{loading ? <Spinner /> : list.length === 0 ? <EmptyState title="No challenges scheduled" /> : <ul>{list.map((c) => (
        <li key={c.id} className="flex items-center gap-2 border-b border-line px-4 py-2 last:border-0"><div className="min-w-0 flex-1"><p className="text-sm font-medium capitalize">{c.type} · {c.type === 'weekly' ? 'week of ' : ''}{c.date} <span className="font-normal text-muted">· +{c.bonusXp} XP</span></p><p className="truncate text-xs text-muted">{c.questionIds.map(title).join(', ')}</p></div><button type="button" aria-label="Delete challenge" onClick={() => void remove(c)} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-red-600"><Trash2 className="h-4 w-4" /></button></li>))}</ul>}</div>
    </>
  );
}
