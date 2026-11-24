import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { friendlyError } from '../lib/errors';
import type { Assessment, Attempt } from '../types';
import { ErrorNote, PageHeader, Spinner } from '../components/ui';

export default function TestResult() {
  const { attemptId = '' } = useParams();
  const [at, setAt] = useState<Attempt | null>(null);
  const [ass, setAss] = useState<Assessment | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const a = await getDoc(doc(db, 'assessmentAttempts', attemptId));
        if (!a.exists()) return setErr('Result not found.');
        const x = { id: a.id, ...(a.data() as Omit<Attempt, 'id'>) };
        setAt(x);
        const s = await getDoc(doc(db, 'assessments', x.assessmentId));
        if (s.exists()) setAss({ id: s.id, ...(s.data() as Omit<Assessment, 'id'>) });
      } catch (e) { setErr(friendlyError(e)); }
    })();
  }, [attemptId]);
  if (err) return <ErrorNote message={err} />;
  if (!at || !ass) return <Spinner />;
  if (at.status === 'in_progress') return <ErrorNote message="This attempt is still in progress." />;
  const pct = at.totalMarks ? Math.round(((at.score ?? 0) / at.totalMarks) * 100) : 0;
  return (
    <>
      <PageHeader title={at.title} subtitle={`Attempt ${at.attemptNo}${at.status === 'expired' ? ' · time ran out (auto-submitted)' : ''}`} action={<Link to="/tests" className="btn-outline">Back to tests</Link>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card"><p className="text-3xl font-semibold">{at.score}/{at.totalMarks}</p><p className="text-sm text-muted">Score ({pct}%)</p></div>
        <div className="card sm:col-span-2"><p className="mb-2 text-sm font-medium">By topic</p><ul className="space-y-1.5">{Object.entries(at.topicBreakdown ?? {}).map(([t, v]) => <li key={t} className="flex items-center gap-2 text-sm"><span className="w-32 shrink-0 truncate capitalize">{t.replace(/_/g, ' ')}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle"><div className="h-full bg-brand" style={{ width: `${(v.correct / v.total) * 100}%` }} /></div><span className="w-12 text-right text-xs text-muted">{v.correct}/{v.total}</span></li>)}</ul></div>
      </div>
      <div className="space-y-3">
        {at.review?.map((r, i) => {
          const q = ass.questions.find((x) => x.id === r.questionId);
          if (!q) return null;
          return (
            <div key={r.questionId} className="card">
              <p className="mb-2 text-sm font-medium">{i + 1}. {q.text}</p>
              <ul className="space-y-1.5">{q.options.map((o, oi) => <li key={oi} className={`rounded-lg border px-3 py-2 text-sm ${oi === r.correctIndex ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : oi === r.selected ? 'border-red-400 bg-red-50 dark:bg-red-950/40' : 'border-line'}`}>{String.fromCharCode(65 + oi)}. {o}{oi === r.correctIndex ? ' ✓ correct' : oi === r.selected ? ' ✗ your answer' : ''}</li>)}</ul>
              {r.selected === null && <p className="mt-2 text-xs text-muted">Not answered.</p>}
              {r.explanation && <p className="mt-2 rounded-lg bg-subtle p-3 text-sm"><span className="font-medium">Explanation: </span>{r.explanation}</p>}
            </div>
          );
        })}
      </div>
    </>
  );
}
