import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Clock } from 'lucide-react';
import { db } from '../lib/firebase';
import { callApi } from '../lib/api';
import { friendlyError } from '../lib/errors';
import type { Assessment, Attempt } from '../types';
import { ErrorNote, Spinner } from '../components/ui';

export default function TakeTest() {
  const { attemptId = '' } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [ass, setAss] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    (async () => {
      try {
        const a = await getDoc(doc(db, 'assessmentAttempts', attemptId));
        if (!a.exists()) return setErr('Attempt not found.');
        const at = { id: a.id, ...(a.data() as Omit<Attempt, 'id'>) };
        const s = await getDoc(doc(db, 'assessments', at.assessmentId));
        if (!s.exists()) return setErr('Assessment not found.');
        setAttempt(at); setAnswers(at.answers ?? {}); setAss({ id: s.id, ...(s.data() as Omit<Assessment, 'id'>) });
      } catch (e) { setErr(friendlyError(e)); }
    })();
  }, [attemptId]);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true; setSubmitting(true); setErr('');
    try { await callApi('/assessment/submit', { attemptId }); navigate(`/tests/result/${attemptId}`, { replace: true }); }
    catch (e) { submitted.current = false; setSubmitting(false); setErr(e instanceof Error ? e.message : 'Submit failed. Try again.'); }
  }, [attemptId, navigate]);

  // Countdown uses the deadline stored by the server; the server (rules + grading) is the real authority.
  useEffect(() => {
    const end = attempt?.endsAt?.toDate().getTime();
    if (!end) return;
    const tick = () => { const ms = end - Date.now(); setLeft(Math.max(0, ms)); if (ms <= 0) void submit(); };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [attempt, submit]);

  const choose = (qid: string, opt: number) => {
    const next = { ...answers, [qid]: opt };
    setAnswers(next); setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      updateDoc(doc(db, 'assessmentAttempts', attemptId), { answers: next }).then(() => setSaveState('saved')).catch(() => setSaveState('failed'));
    }, 400);
  };

  if (err && !attempt) return <ErrorNote message={err} />;
  if (!attempt || !ass) return <Spinner />;
  if (attempt.status !== 'in_progress') return <Navigate to={`/tests/result/${attemptId}`} replace />;
  const q = ass.questions[idx];
  const mm = left === null ? '--' : String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = left === null ? '--' : String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  const answered = Object.keys(answers).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-14 z-20 -mx-3 mb-4 flex items-center justify-between gap-3 border-b border-line bg-surface px-3 py-2 sm:mx-0 sm:rounded-xl sm:border lg:top-2">
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{ass.title}</p><p className="text-xs text-muted">{answered}/{ass.questions.length} answered · {saveState === 'saving' ? 'Saving...' : saveState === 'failed' ? 'Autosave failed - check connection' : 'Autosaved'}</p></div>
        <span className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums ${left !== null && left < 60000 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-subtle'}`} role="timer" aria-label="Time left"><Clock className="h-4 w-4" />{mm}:{ss}</span>
      </div>
      {err && <div className="mb-3"><ErrorNote message={err} /></div>}
      <div className="card">
        <p className="mb-1 text-xs text-muted">Question {idx + 1} of {ass.questions.length} · {q.marks} mark{q.marks > 1 ? 's' : ''}</p>
        <h2 className="mb-4 whitespace-pre-line break-words text-base font-medium">{q.text}</h2>
        <div className="space-y-2" role="radiogroup" aria-label="Options">
          {q.options.map((o, i) => (
            <button key={i} type="button" role="radio" aria-checked={answers[q.id] === i} onClick={() => choose(q.id, i)} className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm ${answers[q.id] === i ? 'border-brand-ink bg-brand-soft' : 'border-line hover:bg-subtle'}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold">{String.fromCharCode(65 + i)}</span><span className="break-words">{o}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <button type="button" className="btn-outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</button>
          {idx < ass.questions.length - 1 ? <button type="button" className="btn-primary" onClick={() => setIdx(idx + 1)}>Next</button> : <button type="button" className="btn-primary" disabled={submitting} onClick={() => { if (window.confirm(`Submit now? You answered ${answered} of ${ass.questions.length}.`)) void submit(); }}>{submitting ? 'Submitting...' : 'Submit test'}</button>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Question navigator">
        {ass.questions.map((x, i) => <button key={x.id} type="button" aria-label={`Go to question ${i + 1}`} onClick={() => setIdx(i)} className={`h-10 w-10 rounded-lg border text-sm ${i === idx ? 'border-brand-ink bg-brand text-white' : answers[x.id] !== undefined ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950' : 'border-line'}`}>{i + 1}</button>)}
      </div>
      <div className="mt-4 text-center"><button type="button" className="btn-outline" disabled={submitting} onClick={() => { if (window.confirm('Submit the test now?')) void submit(); }}>Submit test</button></div>
    </div>
  );
}
