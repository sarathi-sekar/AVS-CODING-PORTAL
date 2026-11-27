import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, limit, query, where } from 'firebase/firestore';
import { ClipboardCheck } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useQueryDocs } from '../lib/useDocs';
import { callApi } from '../lib/api';
import { topicSlug } from '../shared/skills';
import { type Assessment, type Attempt } from '../types';
import { categoryLabel, useAcademic } from '../lib/academic';
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';

export default function Tests() {
  const { profile } = useAuth();
  const cfg = useAcademic();
  const uid = profile?.uid ?? '';
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const category = params.get('category') ?? '';
  const company = params.get('company') ?? '';
  const topic = params.get('topic') ?? '';
  const [tab, setTab] = useState<'available' | 'history'>('available');
  const [busyId, setBusyId] = useState('');
  const [err, setErr] = useState('');

  const list = useQueryDocs<Assessment>(() => query(collection(db, 'assessments'), where('status', '==', 'published'), limit(200)), 'ass', (id, d) => ({ id, ...(d as Omit<Assessment, 'id'>) }));
  const hist = useQueryDocs<Attempt>(() => (uid ? query(collection(db, 'assessmentAttempts'), where('uid', '==', uid), limit(200)) : null), `h${uid}`, (id, d) => ({ id, ...(d as Omit<Attempt, 'id'>) }));
  const setParam = (k: string, v: string) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); };

  const rows = useMemo(() => list.data.filter((a) => (!category || a.category === category) && (!company || a.company?.toLowerCase() === company.toLowerCase()) && (!topic || a.questions.some((q) => topicSlug(q.topic) === topicSlug(topic)))), [list.data, category, company, topic]);

  const start = async (a: Assessment) => {
    setBusyId(a.id); setErr('');
    try { const r = await callApi<{ attemptId: string }>('/assessment/start', { assessmentId: a.id }); navigate(`/tests/attempt/${r.attemptId}`); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed to start'); } finally { setBusyId(''); }
  };

  return (
    <>
      <PageHeader title="Tests" subtitle="Timed assessments with automatic scoring and explanations." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist">
          {(['available', 'history'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={`min-h-[40px] rounded-lg px-4 text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'text-muted'}`}>{t === 'available' ? 'Available' : 'History'}</button>)}
        </div>
        {tab === 'available' && <select className="input !w-auto" aria-label="Category" value={category} onChange={(e) => setParam('category', e.target.value)}><option value="">All categories</option>{cfg.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>}
        {(company || topic) && <button type="button" className="btn-outline !min-h-[40px]" onClick={() => { setParam('company', ''); setParam('topic', ''); }}>Clear {company ? `company: ${company}` : `topic: ${topic}`}</button>}
      </div>
      {(err || list.error || hist.error) && <div className="mb-3"><ErrorNote message={err || list.error || hist.error} /></div>}
      {tab === 'available' ? (list.loading ? <Spinner /> : rows.length === 0 ? <div className="card"><EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title="No tests available" hint="Faculty and placement coordinators publish tests. Check back soon." /></div> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((a) => (
            <div key={a.id} className="card flex flex-col gap-1">
              <span className="w-fit rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-ink">{categoryLabel(cfg, a.category)}{a.company ? ` · ${a.company}` : ''}</span>
              <h2 className="text-base font-semibold">{a.title}</h2>
              <p className="text-xs text-muted">{a.questions.length} questions · {a.durationMinutes} min · {a.maxAttempts > 0 ? `${a.maxAttempts} attempt(s)` : 'unlimited attempts'}</p>
              <button type="button" className="btn-primary mt-3" disabled={busyId === a.id} onClick={() => void start(a)}>{busyId === a.id ? 'Starting...' : 'Start / resume'}</button>
            </div>
          ))}
        </div>
      )) : hist.loading ? <Spinner /> : hist.data.length === 0 ? <div className="card"><EmptyState title="No attempts yet" /></div> : (
        <div className="card !p-0"><ul>
          {[...hist.data].sort((a, b) => (b.startedAt?.toMillis() ?? 0) - (a.startedAt?.toMillis() ?? 0)).map((h) => (
            <li key={h.id} className="border-b border-line last:border-0">
              <Link to={h.status === 'in_progress' ? `/tests/attempt/${h.id}` : `/tests/result/${h.id}`} className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-2 hover:bg-subtle">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{h.title} <span className="text-muted">· attempt {h.attemptNo}</span></p><p className="text-xs text-muted">{h.startedAt?.toDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p></div>
                <span className="shrink-0 text-sm font-medium">{h.status === 'in_progress' ? 'Resume' : `${h.score}/${h.totalMarks}`}</span>
              </Link>
            </li>
          ))}
        </ul></div>
      )}
    </>
  );
}
