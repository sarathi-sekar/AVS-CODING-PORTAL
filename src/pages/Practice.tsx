import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, limit, query, where } from 'firebase/firestore';
import { CheckCircle2, Code2, Search } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useQueryDocs } from '../lib/useDocs';
import { LANGUAGES, LANGUAGE_IDS } from '../shared/languages';
import { topicSlug } from '../shared/skills';
import type { Question } from '../types';
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';

const DIFF_STYLE = { easy: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300', medium: 'text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300', hard: 'text-red-700 bg-red-100 dark:bg-red-950 dark:text-red-300' };

export default function Practice() {
  const { profile } = useAuth();
  const uid = profile?.uid ?? '';
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const diff = params.get('difficulty') ?? '';
  const topic = params.get('topic') ?? '';
  const lang = params.get('language') ?? '';
  const [status, setStatus] = useState('');
  const setParam = (k: string, v: string) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); };

  const questions = useQueryDocs<Question>(() => query(collection(db, 'questions'), where('status', '==', 'published'), limit(500)), 'questions', (id, d) => ({ id, ...(d as Omit<Question, 'id'>) }));
  const attempts = useQueryDocs<{ questionId: string; solved: boolean }>(() => (uid ? query(collection(db, 'attempts'), where('uid', '==', uid)) : null), `a${uid}`, (_i, d) => d as unknown as { questionId: string; solved: boolean });
  const solved = useMemo(() => new Set(attempts.data.filter((a) => a.solved).map((a) => a.questionId)), [attempts.data]);
  const attempted = useMemo(() => new Set(attempts.data.map((a) => a.questionId)), [attempts.data]);
  const topics = useMemo(() => [...new Set(questions.data.map((x) => x.topic))].sort(), [questions.data]);

  const rows = [...questions.data].sort((a, b) => a.title.localeCompare(b.title)).filter((x) =>
    (!diff || x.difficulty === diff) && (!topic || topicSlug(x.topic) === topicSlug(topic)) && (!lang || x.languages.includes(lang as never)) &&
    (!q || x.title.toLowerCase().includes(q.toLowerCase())) &&
    (!status || (status === 'solved' ? solved.has(x.id) : status === 'attempted' ? attempted.has(x.id) && !solved.has(x.id) : !attempted.has(x.id))));

  return (
    <>
      <PageHeader title="Practice" subtitle="Real compilers, hidden test cases. Only accepted submissions count as solved." />
      <div className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search problems" aria-label="Search problems" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input" aria-label="Difficulty" value={diff} onChange={(e) => setParam('difficulty', e.target.value)}><option value="">All difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
        <select className="input" aria-label="Topic" value={topic} onChange={(e) => setParam('topic', e.target.value)}><option value="">All topics</option>{topics.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="input" aria-label="Language" value={lang} onChange={(e) => setParam('language', e.target.value)}><option value="">All languages</option>{LANGUAGE_IDS.map((l) => <option key={l} value={l}>{LANGUAGES[l].label}</option>)}</select>
        <select className="input" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option><option value="solved">Solved</option><option value="attempted">Attempted</option><option value="todo">Not attempted</option></select>
      </div>
      {(questions.error || attempts.error) && <ErrorNote message={questions.error || attempts.error} />}
      <div className="card !p-0">
        {questions.loading ? <Spinner /> : rows.length === 0 ? (
          <EmptyState icon={<Code2 className="h-6 w-6" />} title={questions.data.length === 0 ? 'No problems published yet' : 'No problems match your filters'} hint={questions.data.length === 0 ? 'Faculty add problems from the Questions page.' : undefined} />
        ) : (
          <ul>
            {rows.map((x) => (
              <li key={x.id} className="border-b border-line last:border-0">
                <Link to={`/practice/${x.id}`} className="flex min-h-[56px] items-center gap-3 px-4 py-2 hover:bg-subtle">
                  {solved.has(x.id) ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Solved" /> : <span className="h-5 w-5 shrink-0 rounded-full border border-line" aria-label="Not solved" />}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{x.title}</p><p className="truncate text-xs text-muted">{x.topic} · {x.languages.map((l) => LANGUAGES[l].label).join(', ')}</p></div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${DIFF_STYLE[x.difficulty]}`}>{x.difficulty}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
