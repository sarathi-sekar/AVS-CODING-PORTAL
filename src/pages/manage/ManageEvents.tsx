import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { friendlyError } from '../../lib/errors';
import { clearQueryCache } from '../../lib/useDocs';
import { istDateKey } from '../../shared/streak';
import type { EventDoc } from '../../types';
import { EmptyState, ErrorNote, PageHeader, Spinner, SuccessNote } from '../../components/ui';

export default function ManageEvents() {
  const { profile } = useAuth();
  const [list, setList] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: '', date: istDateKey(new Date()), time: '', program: '', link: '', description: '' });
  const load = useCallback(async () => { try { const s = await getDocs(collection(db, 'events')); setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventDoc, 'id'>) })).sort((a, b) => b.date.localeCompare(a.date))); } catch (e) { setErr(friendlyError(e)); } finally { setLoading(false); } }, []);
  useEffect(() => void load(), [load]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (f.link && !/^https:\/\//i.test(f.link.trim())) return setErr('The meeting link must start with https://');
    setBusy(true);
    try { await addDoc(collection(db, 'events'), { ...f, title: f.title.trim(), program: f.program.trim(), link: f.link.trim(), createdBy: profile?.uid, createdAt: serverTimestamp() }); setF({ ...f, title: '', link: '', description: '' }); clearQueryCache(); await load(); setOk('Event added to the student schedule.'); setTimeout(() => setOk(''), 3000); }
    catch (x) { setErr(friendlyError(x)); } finally { setBusy(false); }
  };
  const remove = async (x: EventDoc) => { if (!window.confirm(`Delete "${x.title}"?`)) return; try { await deleteDoc(doc(db, 'events', x.id)); clearQueryCache(); setList((l) => l.filter((y) => y.id !== x.id)); } catch (e) { setErr(friendlyError(e)); } };
  return (
    <>
      <PageHeader title="Schedule" subtitle="Live classes, workshops and test dates shown in every student's calendar." />
      {err && <div className="mb-3"><ErrorNote message={err} /></div>}
      {ok && <div className="mb-3"><SuccessNote message={ok} /></div>}
      <form onSubmit={submit} className="card mb-4 grid gap-3 sm:grid-cols-2">
        <input className="input sm:col-span-2" required placeholder="Title (e.g. Java - Collections live class)" aria-label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <label className="text-sm">Date<input type="date" required className="input mt-1" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className="text-sm">Time (optional)<input type="time" className="input mt-1" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label>
        <input className="input" placeholder="Subject (Java, Python...)" aria-label="Subject" value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })} />
        <input className="input" placeholder="Meeting link (https://...)" aria-label="Meeting link" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
        <input className="input sm:col-span-2" placeholder="Note (optional)" aria-label="Note" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? 'Saving...' : 'Add to schedule'}</button>
      </form>
      <div className="card !p-0">{loading ? <Spinner /> : list.length === 0 ? <EmptyState title="Nothing scheduled" /> : <ul>{list.map((x) => (
        <li key={x.id} className="flex items-center gap-2 border-b border-line px-4 py-3 last:border-0"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{x.title}</span><span className="block text-xs text-muted">{x.date}{x.time ? ` ${x.time}` : ''}{x.program ? ` · ${x.program}` : ''}</span></span><button type="button" aria-label={`Delete ${x.title}`} onClick={() => void remove(x)} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-subtle"><Trash2 className="h-4 w-4" /></button></li>))}</ul>}</div>
    </>
  );
}
