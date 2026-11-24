import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getCountFromServer, limit, query, where } from 'firebase/firestore';
import { BookOpen, ClipboardCheck, Code2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useQueryDocs } from '../lib/useDocs';
import type { Assessment, Attempt, Course, LessonProgress } from '../types';

function Bar({ icon: Icon, label, pct, detail, tone }: { icon: typeof Code2; label: string; pct: number; detail: string; tone: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-1.5 font-medium"><Icon className="h-4 w-4 text-muted" />{label}</span><span className="text-muted">{pct}%</span></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} progress`}><div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} /></div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

/** "My learning": real progress across courses, practice problems and tests, plus a resume shortcut. */
export function MyLearning({ solved }: { solved: number }) {
  const { profile } = useAuth();
  const uid = profile?.uid ?? '';
  const courses = useQueryDocs<Course>(() => query(collection(db, 'courses'), where('status', '==', 'published')), 'courses', (id, d) => ({ id, ...(d as Omit<Course, 'id'>) }));
  const prog = useQueryDocs<LessonProgress>(() => (uid ? query(collection(db, 'lessonProgress'), where('uid', '==', uid)) : null), `lp${uid}`, (_i, d) => d as unknown as LessonProgress);
  const tests = useQueryDocs<Assessment>(() => query(collection(db, 'assessments'), where('status', '==', 'published'), limit(200)), 'ass', (id, d) => ({ id, ...(d as Omit<Assessment, 'id'>) }));
  const atts = useQueryDocs<Attempt>(() => (uid ? query(collection(db, 'assessmentAttempts'), where('uid', '==', uid), limit(200)) : null), `h${uid}`, (id, d) => ({ id, ...(d as Omit<Attempt, 'id'>) }));
  const [qCount, setQCount] = useState<number | null>(null);
  useEffect(() => { getCountFromServer(query(collection(db, 'questions'), where('status', '==', 'published'))).then((s) => setQCount(s.data().count)).catch(() => setQCount(0)); }, []);

  const m = useMemo(() => {
    const done: Record<string, number> = {};
    prog.data.filter((p) => p.completed).forEach((p) => { done[p.courseId] = (done[p.courseId] ?? 0) + 1; });
    const total = courses.data.reduce((n, c) => n + (c.lessonCount ?? 0), 0);
    const doneAll = courses.data.reduce((n, c) => n + Math.min(done[c.id] ?? 0, c.lessonCount ?? 0), 0);
    const resume = courses.data.filter((c) => (c.lessonCount ?? 0) > 0).map((c) => ({ c, d: done[c.id] ?? 0 })).filter((x) => x.d > 0 && x.d < x.c.lessonCount)[0]
      ?? courses.data.filter((c) => (c.lessonCount ?? 0) > 0 && !done[c.id]).map((c) => ({ c, d: 0 }))[0];
    const finished = new Set(atts.data.filter((a) => a.status !== 'in_progress').map((a) => a.assessmentId));
    const pubIds = new Set(tests.data.map((t) => t.id));
    const testsDone = [...finished].filter((id) => pubIds.has(id)).length;
    const running = atts.data.find((a) => a.status === 'in_progress');
    return { total, doneAll, resume, testsDone, testsTotal: tests.data.length, running };
  }, [courses.data, prog.data, tests.data, atts.data]);

  const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
  return (
    <section className="card" aria-labelledby="ml">
      <div className="flex items-center justify-between"><h2 id="ml" className="h-section">My learning</h2><span className="text-xs text-muted">Pick up where you left off</span></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Bar icon={BookOpen} label="Courses" tone="bg-sky-500" pct={pct(m.doneAll, m.total)} detail={`${m.doneAll} of ${m.total} lessons`} />
        <Bar icon={Code2} label="Practice" tone="bg-emerald-500" pct={pct(solved, qCount ?? 0)} detail={qCount === null ? 'Loading...' : `${solved} of ${qCount} problems solved`} />
        <Bar icon={ClipboardCheck} label="Tests" tone="bg-violet-500" pct={pct(m.testsDone, m.testsTotal)} detail={`${m.testsDone} of ${m.testsTotal} tests taken`} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {m.resume ? <Link to={`/courses/${m.resume.c.id}`} className="rounded-xl border border-line p-3 hover:bg-subtle"><p className="text-xs font-semibold uppercase tracking-wide text-brand-ink">Course</p><p className="mt-1 truncate text-sm font-medium">{m.resume.c.title}</p><p className="text-xs text-muted">{m.resume.d > 0 ? `${m.resume.d}/${m.resume.c.lessonCount} lessons - Resume` : 'Start learning'}</p></Link>
          : <Link to="/courses" className="rounded-xl border border-line p-3 hover:bg-subtle"><p className="text-xs font-semibold uppercase tracking-wide text-brand-ink">Course</p><p className="mt-1 text-sm font-medium">Browse courses</p></Link>}
        {m.running ? <Link to={`/tests/attempt/${m.running.id}`} className="rounded-xl border border-line p-3 hover:bg-subtle"><p className="text-xs font-semibold uppercase tracking-wide text-brand-ink">Test in progress</p><p className="mt-1 truncate text-sm font-medium">{m.running.title}</p><p className="text-xs text-muted">Resume</p></Link>
          : <Link to="/practice" className="rounded-xl border border-line p-3 hover:bg-subtle"><p className="text-xs font-semibold uppercase tracking-wide text-brand-ink">Practice</p><p className="mt-1 text-sm font-medium">Solve a problem</p></Link>}
      </div>
    </section>
  );
}
