import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { friendlyError } from '../../lib/errors';
import type { Announcement } from '../../types';
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../../components/ui';

export default function Announcements() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(50)));
      setList(snap.docs.map((d) => ({ ...(d.data() as Omit<Announcement, 'id'>), id: d.id })));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await addDoc(collection(db, 'announcements'), { title: title.trim(), body: body.trim(), createdAt: serverTimestamp() });
      setTitle('');
      setBody('');
      await load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Announcement) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', a.id));
      setList((l) => l.filter((x) => x.id !== a.id));
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  return (
    <>
      <PageHeader title="Announcements" subtitle="Shown on every student's dashboard." />
      <form onSubmit={add} className="card mb-4 space-y-3">
        <div>
          <label className="label" htmlFor="a-title">Title</label>
          <input id="a-title" className="input" required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="a-body">Message</label>
          <textarea id="a-body" className="input min-h-[96px] py-2" required maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <button className="btn-primary w-full sm:w-auto" disabled={busy}>{busy ? 'Publishing...' : 'Publish'}</button>
      </form>
      {error && <div className="mb-3"><ErrorNote message={error} /></div>}
      <div className="card !p-0">
        {loading ? <Spinner /> : list.length === 0 ? <EmptyState title="No announcements yet" /> : (
          <ul>
            {list.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="mt-0.5 whitespace-pre-line break-words text-sm text-muted">{a.body}</p>
                </div>
                <button type="button" aria-label={`Delete ${a.title}`} onClick={() => void remove(a)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
