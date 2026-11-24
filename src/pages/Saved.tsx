import { useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, deleteDoc, doc, query, where } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useQueryDocs } from '../lib/useDocs';
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';

interface Bm { id: string; kind: 'question' | 'lesson'; refId: string; title: string; courseId?: string }
interface Note { id: string; questionId: string; title: string; text: string }

export default function Saved() {
  const { profile } = useAuth();
  const uid = profile?.uid ?? '';
  const [tab, setTab] = useState<'bookmarks' | 'notes'>('bookmarks');
  const bm = useQueryDocs<Bm>(() => (uid ? query(collection(db, 'bookmarks'), where('uid', '==', uid)) : null), `b${uid}`, (id, d) => ({ id, ...(d as Omit<Bm, 'id'>) }));
  const nt = useQueryDocs<Note>(() => (uid ? query(collection(db, 'studentNotes'), where('uid', '==', uid)) : null), `n${uid}`, (id, d) => ({ id, ...(d as Omit<Note, 'id'>) }));
  const [err, setErr] = useState('');
  const del = async (col: 'bookmarks' | 'studentNotes', id: string) => {
    try { await deleteDoc(doc(db, col, id)); if (col === 'bookmarks') bm.setData((l) => l.filter((x) => x.id !== id)); else nt.setData((l) => l.filter((x) => x.id !== id)); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  };
  const cur = tab === 'bookmarks' ? bm : nt;
  return (
    <>
      <PageHeader title="Saved" subtitle="Your bookmarked problems and personal notes." />
      <div className="mb-4 inline-flex rounded-xl border border-line bg-surface p-1" role="tablist">
        {(['bookmarks', 'notes'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={`min-h-[40px] rounded-lg px-4 text-sm font-medium capitalize ${tab === t ? 'bg-brand text-white' : 'text-muted'}`}>{t}</button>)}
      </div>
      {(err || cur.error) && <ErrorNote message={err || cur.error} />}
      <div className="card !p-0">
        {cur.loading ? <Spinner /> : cur.data.length === 0 ? <EmptyState title={tab === 'bookmarks' ? 'No bookmarks yet' : 'No notes yet'} hint={tab === 'bookmarks' ? 'Tap the bookmark icon on a problem to save it here.' : 'Open a problem and write a note under the description.'} /> : (
          <ul>
            {tab === 'bookmarks' ? bm.data.map((b) => (
              <li key={b.id} className="flex items-center gap-2 border-b border-line px-4 py-2 last:border-0"><Link className="min-w-0 flex-1 truncate text-sm font-medium hover:underline" to={b.kind === 'question' ? `/practice/${b.refId}` : `/courses/${b.courseId ?? ''}/${b.refId}`}>{b.title}</Link><span className="text-xs text-muted">{b.kind}</span><button type="button" aria-label="Remove bookmark" onClick={() => void del('bookmarks', b.id)} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-red-600"><Trash2 className="h-4 w-4" /></button></li>
            )) : nt.data.map((n) => (
              <li key={n.id} className="border-b border-line px-4 py-3 last:border-0"><div className="flex items-center justify-between gap-2"><Link className="min-w-0 truncate text-sm font-medium hover:underline" to={`/practice/${n.questionId}`}>{n.title}</Link><button type="button" aria-label="Delete note" onClick={() => void del('studentNotes', n.id)} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div><p className="mt-1 whitespace-pre-line break-words text-sm text-muted">{n.text}</p></li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
