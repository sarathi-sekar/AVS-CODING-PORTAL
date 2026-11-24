import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Printer } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/errors';
import { COLLEGE } from '../components/AuthShell';
import { ErrorNote, Spinner } from '../components/ui';

/** Completion certificate: available only when every published lesson of the course is completed. Print / save as PDF from the browser. */
export default function Certificate() {
  const { courseId = '' } = useParams();
  const { profile } = useAuth();
  const [state, setState] = useState<{ title: string; done: number; total: number; date: Date } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const [c, ls, ps] = await Promise.all([
          getDoc(doc(db, 'courses', courseId)),
          getDocs(query(collection(db, 'lessons'), where('courseId', '==', courseId), where('status', '==', 'published'))),
          getDocs(query(collection(db, 'lessonProgress'), where('uid', '==', profile.uid), where('courseId', '==', courseId))),
        ]);
        if (!c.exists()) return setErr('Course not found.');
        const ids = new Set(ls.docs.map((d) => d.id));
        const done = ps.docs.filter((d) => d.data().completed === true && ids.has(d.data().lessonId as string));
        const last = done.reduce((m, d) => Math.max(m, (d.data().completedAt as { toDate(): Date } | undefined)?.toDate().getTime() ?? 0), 0);
        setState({ title: c.data().title as string, done: done.length, total: ids.size, date: last ? new Date(last) : new Date() });
      } catch (e) { setErr(friendlyError(e)); }
    })();
  }, [courseId, profile]);
  if (err) return <ErrorNote message={err} />;
  if (!state || !profile) return <Spinner />;
  if (state.total === 0 || state.done < state.total) {
    return <div className="card text-center"><p className="text-sm">Complete every lesson to unlock the certificate ({state.done}/{state.total} done).</p><Link to={`/courses/${courseId}`} className="btn-primary mt-4">Back to course</Link></div>;
  }
  const certId = `AVS-${profile.uid.slice(0, 6)}-${courseId.slice(0, 6)}`.toUpperCase();
  return (
    <div>
      <div className="no-print mb-4 flex justify-end gap-2"><Link to={`/courses/${courseId}`} className="btn-outline">Back</Link><button type="button" className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save as PDF</button></div>
      <div className="print-area mx-auto max-w-3xl border-[6px] border-double border-[#21366F] bg-white p-8 text-center text-[#111827] sm:p-12">
        <img src="/logo.png" alt="AVSEC Salem" className="mx-auto h-24 w-24 object-contain" />
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#21366F]">{COLLEGE}</p>
        <h1 className="mt-6 font-serif text-3xl font-bold sm:text-4xl">Certificate of Completion</h1>
        <p className="mt-6 text-sm text-gray-600">This is to certify that</p>
        <p className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">{profile.displayName}</p>
        <p className="mt-1 text-sm text-gray-600">{profile.registerNumber} · {profile.department}</p>
        <p className="mt-6 text-sm text-gray-600">has successfully completed all {state.total} lessons of the course</p>
        <p className="mt-2 text-xl font-semibold">{state.title}</p>
        <p className="mt-6 text-sm text-gray-600">on {state.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}</p>
        <p className="mt-8 text-xs text-gray-500">AVS Coding &amp; Programming Portal · Certificate ID {certId}</p>
      </div>
    </div>
  );
}
