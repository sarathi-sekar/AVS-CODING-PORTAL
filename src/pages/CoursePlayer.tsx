import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, doc, getDoc, query, where } from 'firebase/firestore';
import { ArrowLeft, CheckCircle2, ChevronDown, Circle, FileText, Lock, Paperclip, Play, Search } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useQueryDocs } from '../lib/useDocs';
import { completeLesson, startLesson } from '../lib/lessons';
import { friendlyError } from '../lib/errors';
import type { Course, Lesson, LessonProgress, ModuleDoc } from '../types';
import { Markdown } from '../components/Markdown';
import { VideoPlayer } from '../components/VideoPlayer';
import { BookmarkButton } from '../components/SaveButtons';
import { ErrorNote, Spinner, SuccessNote } from '../components/ui';

function Ring({ pct }: { pct: number }) {
  const r = 17; const c = 2 * Math.PI * r;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" role="img" aria-label={`${pct}% complete`}>
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-subtle" />
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-brand-ink" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" className="fill-ink text-[10px] font-semibold">{pct}%</text>
    </svg>
  );
}

const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`);

export default function CoursePlayer() {
  const { courseId = '', lessonId } = useParams();
  const { profile } = useAuth();
  const uid = profile?.uid ?? '';
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [courseErr, setCourseErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'overview' | 'resources'>('overview');

  const mods = useQueryDocs<ModuleDoc>(() => query(collection(db, 'modules'), where('courseId', '==', courseId), where('status', '==', 'published')), `m${courseId}`, (id, d) => ({ id, ...(d as Omit<ModuleDoc, 'id'>) }));
  const lessons = useQueryDocs<Lesson>(() => query(collection(db, 'lessons'), where('courseId', '==', courseId), where('status', '==', 'published')), `l${courseId}`, (id, d) => ({ id, ...(d as Omit<Lesson, 'id'>) }));
  const prog = useQueryDocs<LessonProgress>(() => (uid ? query(collection(db, 'lessonProgress'), where('uid', '==', uid), where('courseId', '==', courseId)) : null), `p${uid}${courseId}`, (_i, d) => d as unknown as LessonProgress);

  useEffect(() => { getDoc(doc(db, 'courses', courseId)).then((s) => setCourse(s.exists() ? ({ id: s.id, ...(s.data() as Omit<Course, 'id'>) }) : null)).catch((e) => setCourseErr(friendlyError(e))); }, [courseId]);
  useEffect(() => setDone(new Set(prog.data.filter((p) => p.completed).map((p) => p.lessonId))), [prog.data]);

  const sortedMods = useMemo(() => [...mods.data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [mods.data]);
  const ordered = useMemo(() => {
    const mOrder = new Map(sortedMods.map((m, i) => [m.id, i]));
    return [...lessons.data].sort((a, b) => (mOrder.get(a.moduleId) ?? 0) - (mOrder.get(b.moduleId) ?? 0) || (a.order ?? 0) - (b.order ?? 0));
  }, [lessons.data, sortedMods]);
  const locked = (l: Lesson) => Boolean(l.prerequisiteId) && !done.has(l.prerequisiteId as string);
  const nextUp = ordered.find((l) => !done.has(l.id) && !locked(l));
  const current = ordered.find((l) => l.id === lessonId) ?? nextUp ?? ordered[0];
  const idx = current ? ordered.findIndex((l) => l.id === current.id) : -1;
  const following = idx >= 0 ? ordered.slice(idx + 1).find((l) => !locked(l)) : undefined;
  const totalMin = ordered.reduce((n, l) => n + (l.estimatedMinutes || 0), 0);
  const pct = ordered.length ? Math.round((done.size / ordered.length) * 100) : 0;

  useEffect(() => {
    if (current && uid && !locked(current)) void startLesson(uid, current.id, courseId);
    setMsg(null); setTab('overview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const complete = async () => {
    if (!current) return;
    setBusy(true); setMsg(null);
    try {
      const r = await completeLesson(uid, current.id, courseId);
      setDone((s) => new Set(s).add(current.id));
      setMsg({ ok: true, text: r.alreadyCompleted ? 'Already completed.' : r.tracked ? `Lesson completed. +${r.xp} XP, ${r.minutes} min added to today's goal.` : 'Lesson completed.' });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' }); } finally { setBusy(false); }
  };

  if (courseErr) return <ErrorNote message={courseErr} />;
  if (!course) return <Spinner />;
  const q = search.trim().toLowerCase();

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Link to="/courses" aria-label="Back to courses" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-subtle"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0"><h1 className="truncate text-lg font-semibold sm:text-xl">{course.title}</h1><p className="text-xs text-muted">{course.category} · {course.level}</p></div>
        {pct === 100 && ordered.length > 0 && <Link className="btn-primary ml-auto" to={`/courses/${courseId}/certificate`}>Get certificate</Link>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          {!current ? (
            <div className="card py-12 text-center text-sm text-muted">{mods.loading || lessons.loading ? 'Loading lessons...' : 'No lessons have been published in this course yet.'}</div>
          ) : locked(current) ? (
            <div className="card py-12 text-center text-sm text-muted"><Lock className="mx-auto mb-2 h-6 w-6" />Complete the prerequisite lesson first.</div>
          ) : (
            <>
              <VideoPlayer url={current.videoUrl} title={current.title} />
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0"><h2 className="text-base font-semibold sm:text-lg">{current.title}</h2><p className="text-xs text-muted">{current.level} · {hm(current.estimatedMinutes)}</p></div>
                <BookmarkButton kind="lesson" refId={current.id} title={current.title} courseId={courseId} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" disabled={busy || done.has(current.id)} onClick={() => void complete()} className="btn-primary">{done.has(current.id) ? <><CheckCircle2 className="h-4 w-4" /> Completed</> : busy ? 'Checking...' : 'Mark as complete'}</button>
                {following && <button type="button" className="btn-outline" onClick={() => navigate(`/courses/${courseId}/${following.id}`)}>Next lesson</button>}
              </div>
              {msg && <div className="mt-3">{msg.ok ? <SuccessNote message={msg.text} /> : <ErrorNote message={msg.text} />}</div>}
              <p className="mt-2 text-xs text-muted">Completion is verified on the server: spend a reasonable amount of time on the lesson first.</p>

              <div className="mt-4 border-b border-line" role="tablist">
                {(['overview', 'resources'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={`min-h-[44px] px-4 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-brand-ink text-brand-ink' : 'text-muted'}`}>{t === 'resources' ? `Resources${current.attachments?.length ? ` (${current.attachments.length})` : ''}` : 'Notes'}</button>)}
              </div>
              <div className="card mt-3 min-w-0">
                {tab === 'overview' ? (current.content?.trim() ? <Markdown source={current.content} /> : <p className="text-sm text-muted">No written notes for this lesson.</p>) : (
                  current.attachments?.length ? <ul className="space-y-2">{current.attachments.map((a) => <li key={a.url}><a className="flex min-h-[44px] items-center gap-2 rounded-lg border border-line px-3 text-sm hover:bg-subtle" href={a.url} target="_blank" rel="noopener noreferrer"><Paperclip className="h-4 w-4 text-brand-ink" /><span className="min-w-0 flex-1 truncate">{a.name}</span></a></li>)}</ul> : <p className="text-sm text-muted">No downloadable materials for this lesson.</p>
                )}
                {(current.relatedQuestionIds?.length ?? 0) > 0 && (
                  <div className="mt-5 border-t border-line pt-4"><h3 className="h-section mb-2">Related coding problems</h3><div className="flex flex-wrap gap-2">{current.relatedQuestionIds!.map((x) => <Link key={x} to={`/practice/${x}`} className="btn-outline !min-h-[40px]">Open problem</Link>)}</div></div>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="min-w-0 self-start rounded-card border border-line bg-surface lg:sticky lg:top-4" aria-label="Course content">
          <div className="flex items-center gap-3 border-b border-line p-4">
            <Ring pct={pct} />
            <div className="min-w-0"><p className="text-sm font-semibold">Course content</p><p className="text-xs text-muted">{sortedMods.length} module{sortedMods.length === 1 ? '' : 's'} · {ordered.length} lesson{ordered.length === 1 ? '' : 's'} · {hm(totalMin)}</p></div>
          </div>
          <div className="border-b border-line p-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search lessons" aria-label="Search lessons" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
          <div className="max-h-[60vh] overflow-y-auto p-2 lg:max-h-[calc(100vh-14rem)]">
            {(mods.loading || lessons.loading) && ordered.length === 0 && <Spinner />}
            {sortedMods.map((m) => {
              const ls = ordered.filter((l) => l.moduleId === m.id && (!q || l.title.toLowerCase().includes(q)));
              if (ls.length === 0) return null;
              const open = q !== '' || !closed.has(m.id);
              const all = ordered.filter((l) => l.moduleId === m.id);
              const mDone = all.filter((l) => done.has(l.id)).length;
              return (
                <div key={m.id} className="mb-1">
                  <button type="button" aria-expanded={open} onClick={() => setClosed((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} className="flex min-h-[48px] w-full items-center gap-2 rounded-lg bg-subtle px-3 text-left hover:bg-line/50">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{m.title}</span><span className="block text-xs text-muted">{mDone}/{all.length} lessons · {hm(all.reduce((n, l) => n + l.estimatedMinutes, 0))}</span></span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && ls.map((l) => {
                    const lk = locked(l); const sel = l.id === current?.id;
                    const Kind = l.videoUrl ? Play : FileText;
                    const row = `flex min-h-[52px] items-center gap-3 rounded-lg px-3 py-2 text-sm ${sel ? 'bg-brand-soft' : 'hover:bg-subtle'}`;
                    const body = <><Kind className="h-4 w-4 shrink-0 text-muted" /><span className="min-w-0 flex-1"><span className={`block break-words ${sel ? 'font-medium text-brand-ink' : ''}`}>{l.title}</span><span className="block text-xs text-muted">{hm(l.estimatedMinutes)}</span></span>{lk ? <Lock className="h-4 w-4 shrink-0 text-muted" /> : done.has(l.id) ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Completed" /> : <Circle className="h-5 w-5 shrink-0 text-line" aria-hidden />}</>;
                    return lk ? <div key={l.id} className={`${row} cursor-not-allowed opacity-60`} title="Complete the prerequisite lesson first">{body}</div> : <Link key={l.id} to={`/courses/${courseId}/${l.id}`} className={row} aria-current={sel ? 'true' : undefined}>{body}</Link>;
                  })}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </>
  );
}
