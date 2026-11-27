import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, limit, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useQueryDocs } from '../lib/useDocs';
import { type Assessment, type Attempt, type Resource } from '../types';
import { categoryLabel, useAcademic } from '../lib/academic';
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';


export default function Placement() {
  const { profile } = useAuth();
  const cfg = useAcademic();
  const uid = profile?.uid ?? '';
  const ass = useQueryDocs<Assessment>(() => query(collection(db, 'assessments'), where('status', '==', 'published'), limit(200)), 'ass', (id, d) => ({ id, ...(d as Omit<Assessment, 'id'>) }));
  const att = useQueryDocs<Attempt>(() => (uid ? query(collection(db, 'assessmentAttempts'), where('uid', '==', uid), limit(200)) : null), `at${uid}`, (id, d) => ({ id, ...(d as Omit<Attempt, 'id'>) }));

  const res = useQueryDocs<Resource>(() => query(collection(db, 'resources'), where('status', '==', 'published'), limit(500)), 'resources', (id, d) => ({ id, ...(d as Omit<Resource, 'id'>) }));
  const companies = useMemo(() => { const m = new Map<string, { tests: number; docs: number }>(); ass.data.forEach((a) => { if (a.company) { const c = m.get(a.company) ?? { tests: 0, docs: 0 }; c.tests++; m.set(a.company, c); } }); res.data.forEach((r) => { if (r.type === 'company' && r.company) { const c = m.get(r.company) ?? { tests: 0, docs: 0 }; c.docs++; m.set(r.company, c); } }); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])); }, [ass.data, res.data]);
  const counts = useMemo(() => { const m: Record<string, number> = {}; ass.data.forEach((a) => { m[a.category] = (m[a.category] ?? 0) + 1; }); return m; }, [ass.data]);
  const topics = useMemo(() => {
    const m: Record<string, { correct: number; total: number }> = {};
    att.data.filter((a) => a.status !== 'in_progress').forEach((a) => Object.entries(a.topicBreakdown ?? {}).forEach(([t, v]) => { const c = m[t] ?? { correct: 0, total: 0 }; c.correct += v.correct; c.total += v.total; m[t] = c; }));
    return Object.entries(m).map(([t, v]) => ({ topic: t, ...v, acc: v.correct / v.total })).sort((a, b) => a.acc - b.acc);
  }, [att.data]);
  const done = att.data.filter((a) => a.status !== 'in_progress');
  const overall = done.reduce((s, a) => s + (a.score ?? 0), 0);
  const overallMax = done.reduce((s, a) => s + (a.totalMarks ?? 0), 0);
  const weak = topics.filter((t) => t.total >= 3 && t.acc < 0.6);

  return (
    <>
      <PageHeader title="Placement preparation" subtitle="Aptitude, technical and company-wise practice with real performance tracking." />
      {(ass.error || att.error) && <ErrorNote message={ass.error || att.error} />}
      {ass.loading || att.loading ? <Spinner /> : (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="card"><p className="text-2xl font-semibold">{done.length}</p><p className="text-sm text-muted">Tests completed</p></div>
            <div className="card"><p className="text-2xl font-semibold">{overallMax ? `${Math.round((overall / overallMax) * 100)}%` : '-'}</p><p className="text-sm text-muted">Overall accuracy</p></div>
            <div className="card"><p className="text-2xl font-semibold">{weak.length}</p><p className="text-sm text-muted">Weak topics</p></div>
          </section>
          <section className="card"><h2 className="h-section mb-3">Practice by module</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[...cfg.categories.map((c) => c.id), ...Object.keys(counts).filter((k) => !cfg.categories.some((c) => c.id === k))].map((k) => <Link key={k} to={`/tests?category=${k}`} className="rounded-xl border border-line p-3 hover:bg-subtle"><p className="text-sm font-medium">{categoryLabel(cfg, k)}</p><p className="text-xs text-muted">{counts[k] ?? 0} test{(counts[k] ?? 0) === 1 ? '' : 's'}</p></Link>)}</div>
          </section>
          <section className="card"><h2 className="h-section mb-3">Company-wise preparation</h2>
            {companies.length === 0 ? <EmptyState title="No company material yet" hint="Faculty and the placement team add company tests and question papers." /> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{companies.map(([name, c]) => <div key={name} className="rounded-xl border border-line p-3"><p className="text-sm font-semibold">{name}</p><p className="text-xs text-muted">{c.tests} test{c.tests === 1 ? '' : 's'} · {c.docs} document{c.docs === 1 ? '' : 's'}</p><div className="mt-2 flex gap-3 text-xs font-medium text-brand-ink">{c.tests > 0 && <Link to={`/tests?category=company&company=${encodeURIComponent(name)}`}>Take tests</Link>}{c.docs > 0 && <Link to={`/library?tab=company&group=${encodeURIComponent(name)}`}>Question papers</Link>}</div></div>)}</div>}
          </section>
          <section className="card"><h2 className="h-section mb-3">Weak topics &amp; recommended practice</h2>
            {topics.length === 0 ? <EmptyState title="No data yet" hint="Complete a test and your topic-wise accuracy will appear here." /> : (
              <ul className="space-y-2">{topics.map((t) => (
                <li key={t.topic} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 truncate capitalize">{t.topic.replace(/_/g, ' ')}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle"><div className={`h-full ${t.acc < 0.6 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.round(t.acc * 100)}%` }} /></div>
                  <span className="w-20 text-right text-xs text-muted">{Math.round(t.acc * 100)}% ({t.total} q)</span>
                  {t.total >= 3 && t.acc < 0.6 && <Link to={`/tests?topic=${t.topic}`} className="text-xs font-medium text-brand-ink">Practise</Link>}
                </li>))}</ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
