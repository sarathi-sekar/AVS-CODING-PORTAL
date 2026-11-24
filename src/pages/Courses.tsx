import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { BookOpen, Search } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useQueryDocs } from '../lib/useDocs';
import type { Course, LessonProgress } from '../types';
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';

const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`);
const TONES = ['bg-sky-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-teal-600'];

export default function Courses() {
  const { profile } = useAuth();
  const uid = profile?.uid ?? '';
  const [tab, setTab] = useState<'all' | 'progress' | 'done'>('all');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const courses = useQueryDocs<Course & { totalMinutes?: number; moduleCount?: number }>(() => query(collection(db, 'courses'), where('status', '==', 'published')), 'courses', (id, d) => ({ id, ...(d as Omit<Course, 'id'>) }));
  const progress = useQueryDocs<LessonProgress>(() => (uid ? query(collection(db, 'lessonProgress'), where('uid', '==', uid)) : null), `lp${uid}`, (_id, d) => d as unknown as LessonProgress);
  const doneBy = useMemo(() => { const m: Record<string, number> = {}; progress.data.filter((p) => p.completed).forEach((p) => { m[p.courseId] = (m[p.courseId] ?? 0) + 1; }); return m; }, [progress.data]);
  const sorted = useMemo(() => [...courses.data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title)), [courses.data]);
  const cats = useMemo(() => [...new Set(sorted.map((c) => c.category).filter(Boolean))], [sorted]);
  const state = (c: Course) => { const d = doneBy[c.id] ?? 0; return c.lessonCount > 0 && d >= c.lessonCount ? 'done' : d > 0 ? 'progress' : 'new'; };
  const rows = sorted.filter((c) => (tab === 'all' || (tab === 'done' ? state(c) === 'done' : state(c) === 'progress')) && (!cat || c.category === cat) && (!q || c.title.toLowerCase().includes(q.toLowerCase())));
  const count = (t: 'progress' | 'done') => sorted.filter((c) => state(c) === t).length;

  return (
    <>
      <PageHeader title="Courses" subtitle="Pick a course and follow the lessons in order." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist">
          {([['all', `All ${sorted.length}`], ['progress', `In progress ${count('progress')}`], ['done', `Completed ${count('done')}`]] as const).map(([t, l]) => <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={`min-h-[40px] rounded-lg px-3 text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'text-muted'}`}>{l}</button>)}
        </div>
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search courses" aria-label="Search courses" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {cats.length > 1 && <div className="mb-4 flex flex-wrap gap-2">{['', ...cats].map((c) => <button key={c || 'all'} type="button" onClick={() => setCat(c)} className={`min-h-[36px] rounded-full border px-3 text-sm ${cat === c ? 'border-brand-ink bg-brand-soft text-brand-ink' : 'border-line text-muted'}`}>{c || 'All subjects'}</button>)}</div>}
      {(courses.error || progress.error) && <ErrorNote message={courses.error || progress.error} />}
      {courses.loading ? <Spinner /> : rows.length === 0 ? (
        <div className="card"><EmptyState icon={<BookOpen className="h-6 w-6" />} title={sorted.length === 0 ? 'No courses published yet' : 'No courses match'} hint={sorted.length === 0 ? 'Faculty publish courses from Courses & videos. Check back soon.' : undefined} /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c, i) => {
            const d = doneBy[c.id] ?? 0; const pct = c.lessonCount > 0 ? Math.min(100, Math.round((d / c.lessonCount) * 100)) : 0;
            return (
              <Link key={c.id} to={`/courses/${c.id}`} className="overflow-hidden rounded-card border border-line bg-surface transition hover:shadow-md">
                <div className={`flex h-28 items-end justify-between p-4 text-white ${TONES[i % TONES.length]}`}><span className="text-2xl font-bold leading-tight">{c.category || c.title}</span><span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs">{c.level}</span></div>
                <div className="p-4">
                  <h2 className="text-base font-semibold">{c.title}</h2>
                  <p className="mt-0.5 text-xs text-muted">{c.moduleCount ? `${c.moduleCount} module${c.moduleCount === 1 ? '' : 's'} · ` : ''}{c.lessonCount} lesson{c.lessonCount === 1 ? '' : 's'}{c.totalMinutes ? ` · ${hm(c.totalMinutes)}` : ''}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{c.description}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.title} progress`}><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div>
                  <p className="mt-1 text-xs text-muted">{state(c) === 'done' ? 'Completed' : state(c) === 'progress' ? `${pct}% complete - resume` : 'Ready to start'}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
