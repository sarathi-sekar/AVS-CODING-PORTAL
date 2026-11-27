import { useEffect, useState } from 'react';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/errors';
import { ErrorNote, SuccessNote } from './ui';

export function BookmarkButton({ kind, refId, title, courseId }: { kind: 'question' | 'lesson'; refId: string; title: string; courseId?: string }) {
  const { profile } = useAuth();
  const uid = profile?.uid ?? '';
  const id = `${uid}_${kind}_${refId}`;
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (uid) getDoc(doc(db, 'bookmarks', id)).then((s) => setOn(s.exists())).catch(() => undefined); }, [uid, id]);
  const toggle = async () => {
    setBusy(true); setErr('');
    try {
      if (on) await deleteDoc(doc(db, 'bookmarks', id)); else await setDoc(doc(db, 'bookmarks', id), { uid, kind, refId, title, ...(courseId ? { courseId } : {}), createdAt: serverTimestamp() });
      setOn(!on);
    } catch (e) { setErr(friendlyError(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" onClick={() => void toggle()} disabled={busy} aria-pressed={on} aria-label={on ? 'Remove bookmark' : 'Bookmark'} title={on ? 'Remove bookmark' : 'Bookmark'} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-subtle ${on ? 'text-brand-ink' : 'text-muted'}`}>{on ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}</button>
      {err && <span className="sr-only" role="alert">{err}</span>}
    </>
  );
}

export function NotesBox({ questionId, title }: { questionId: string; title: string }) {
  const { profile } = useAuth();
  const uid = profile?.uid ?? '';
  const id = `${uid}_${questionId}`;
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  useEffect(() => { if (uid) getDoc(doc(db, 'studentNotes', id)).then((s) => { const t = (s.data()?.text as string | undefined) ?? ''; setText(t); setSaved(t); }).catch(() => undefined); }, [uid, id]);
  const save = async () => {
    setMsg(null);
    try {
      if (text.trim() === '') { await deleteDoc(doc(db, 'studentNotes', id)); } else await setDoc(doc(db, 'studentNotes', id), { uid, questionId, title, text: text.trim(), updatedAt: serverTimestamp() });
      setSaved(text); setMsg({ ok: true, t: 'Note saved.' });
    } catch (e) { setMsg({ ok: false, t: friendlyError(e) }); }
  };
  return (
    <details className="mt-4 rounded-xl border border-line p-3">
      <summary className="min-h-[36px] cursor-pointer text-sm font-medium">My notes{saved ? ' (saved)' : ''}</summary>
      <textarea className="input mt-2 min-h-[100px] py-2" maxLength={5000} aria-label="My notes" placeholder="Write your own notes for this problem" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="button" className="btn-outline mt-2 !min-h-[40px]" disabled={text === saved} onClick={() => void save()}>Save note</button>
      {msg && <div className="mt-2">{msg.ok ? <SuccessNote message={msg.t} /> : <ErrorNote message={msg.t} />}</div>}
    </details>
  );
}
