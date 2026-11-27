import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { ArrowDown, ArrowUp, FileText, ListVideo, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { friendlyError } from '../../lib/errors';
import { clearQueryCache } from '../../lib/useDocs';
import { deleteUploaded, fetchFeatures } from '../../lib/storage';
import { parseVideoUrl } from '../../lib/video';
import type { Course, Lesson, ModuleDoc } from '../../types';
import { EmptyState, ErrorNote, Modal, PageHeader, Spinner, SuccessNote } from '../../components/ui';
import { ImportBox } from './ImportBox';
import { BannerPicker } from '../../components/BannerPicker';
import { LessonEditor } from './LessonEditor';

const TEMPLATE = JSON.stringify({ title: 'Java Programming', description: 'Learn Java step by step.', category: 'Java', level: 'Beginner', status: 'draft', modules: [{ title: 'Introduction', lessons: [{ title: 'What is Java?', estimatedMinutes: 15, level: 'Beginner', videoUrl: 'https://www.youtube.com/watch?v=VIDEO_ID', content: 'Short notes in markdown.' }] }] }, null, 2);
type Status = 'draft' | 'published';

export default function ManageContent() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sel, setSel] = useState('');
  const [mods, setMods] = useState<ModuleDoc[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [storageOn, setStorageOn] = useState(false);
  const [c, setC] = useState({ title: '', description: '', category: '', level: 'Beginner', banner: '' });
  const [modTitle, setModTitle] = useState('');
  const [editor, setEditor] = useState<{ moduleId: string; lesson?: Lesson } | null>(null);
  const [bulk, setBulk] = useState<string | null>(null);
  const [editCourse, setEditCourse] = useState(false);

  const flash = (m: string) => { setOk(m); setTimeout(() => setOk(''), 3000); };
  const loadCourses = useCallback(async () => {
    try { const s = await getDocs(query(collection(db, 'courses'), orderBy('title'))); setCourses(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Course, 'id'>) }))); }
    catch (e) { setErr(friendlyError(e)); } finally { setLoading(false); }
  }, []);
  const loadCourse = useCallback(async (id: string) => {
    if (!id) { setMods([]); setLessons([]); return; }
    try {
      const [ms, ls] = await Promise.all([getDocs(query(collection(db, 'modules'), where('courseId', '==', id))), getDocs(query(collection(db, 'lessons'), where('courseId', '==', id)))]);
      setMods(ms.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ModuleDoc, 'id'>) })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      setLessons(ls.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lesson, 'id'>) })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    } catch (e) { setErr(friendlyError(e)); }
  }, []);
  useEffect(() => { void loadCourses(); void fetchFeatures().then((f) => setStorageOn(f.storage)); }, [loadCourses]);
  useEffect(() => void loadCourse(sel), [sel, loadCourse]);

  /** Keeps the numbers shown to students (lessons, modules, minutes) in step with what is published. */
  const recount = async (courseId: string) => {
    const [ls, ms] = await Promise.all([getDocs(query(collection(db, 'lessons'), where('courseId', '==', courseId), where('status', '==', 'published'))), getDocs(query(collection(db, 'modules'), where('courseId', '==', courseId), where('status', '==', 'published')))]);
    await updateDoc(doc(db, 'courses', courseId), { lessonCount: ls.size, moduleCount: ms.size, totalMinutes: ls.docs.reduce((n, d) => n + Number(d.data().estimatedMinutes ?? 0), 0) });
  };
  const refresh = async () => { clearQueryCache(); await Promise.all([loadCourses(), loadCourse(sel)]); };
  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true); setErr('');
    try { await fn(); if (sel) await recount(sel); await refresh(); if (done) flash(done); } catch (e) { setErr(friendlyError(e)); } finally { setBusy(false); }
  };

  const course = courses.find((x) => x.id === sel);
  const addCourse = (e: FormEvent) => { e.preventDefault(); void (async () => { setBusy(true); setErr(''); try { const r = await addDoc(collection(db, 'courses'), { ...c, status: 'draft', order: courses.length, lessonCount: 0, moduleCount: 0, totalMinutes: 0, createdBy: profile?.uid, createdAt: serverTimestamp() }); setC({ title: '', description: '', category: c.category, level: c.level, banner: '' }); await loadCourses(); setSel(r.id); flash('Course created. Now add a module, then lessons with videos.'); } catch (x) { setErr(friendlyError(x)); } finally { setBusy(false); } })(); };
  const setCourseStatus = (st: Status) => run(async () => { await updateDoc(doc(db, 'courses', sel), { status: st }); }, st === 'published' ? 'Course published. Students can see it now.' : 'Course hidden from students.');
  const deleteCourse = async () => {
    if (!course || !window.confirm(`Delete "${course.title}" with all its modules, lessons and uploaded files? This cannot be undone.`)) return;
    setBusy(true); setErr('');
    try {
      for (const l of lessons) { await deleteUploaded(l.videoPath); for (const a of l.attachments ?? []) await deleteUploaded(a.path); }
      const b = writeBatch(db); lessons.forEach((l) => b.delete(doc(db, 'lessons', l.id))); mods.forEach((m) => b.delete(doc(db, 'modules', m.id))); b.delete(doc(db, 'courses', course.id));
      await b.commit(); setSel(''); clearQueryCache(); await loadCourses(); flash('Course deleted.');
    } catch (x) { setErr(friendlyError(x)); } finally { setBusy(false); }
  };

  const addModule = (e: FormEvent) => { e.preventDefault(); void run(async () => { await addDoc(collection(db, 'modules'), { courseId: sel, title: modTitle.trim(), order: mods.length, status: 'published' }); setModTitle(''); }, 'Module added.'); };
  const deleteModule = (m: ModuleDoc) => { const ls = lessons.filter((l) => l.moduleId === m.id); if (!window.confirm(`Delete module "${m.title}"${ls.length ? ` and its ${ls.length} lesson(s)` : ''}?`)) return; void run(async () => { for (const l of ls) { await deleteUploaded(l.videoPath); for (const a of l.attachments ?? []) await deleteUploaded(a.path); } const b = writeBatch(db); ls.forEach((l) => b.delete(doc(db, 'lessons', l.id))); b.delete(doc(db, 'modules', m.id)); await b.commit(); }, 'Module deleted.'); };
  const renameModule = (m: ModuleDoc) => { const t = window.prompt('Module name', m.title)?.trim(); if (t && t !== m.title) void run(async () => { await updateDoc(doc(db, 'modules', m.id), { title: t }); }); };
  const moveModule = (i: number, d: -1 | 1) => { const a = [...mods]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; void run(async () => { const b = writeBatch(db); a.forEach((m, k) => b.update(doc(db, 'modules', m.id), { order: k })); await b.commit(); }); };

  const inMod = (id: string) => lessons.filter((l) => l.moduleId === id);
  const moveLesson = (moduleId: string, i: number, d: -1 | 1) => { const a = [...inMod(moduleId)]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; void run(async () => { const b = writeBatch(db); a.forEach((l, k) => b.update(doc(db, 'lessons', l.id), { order: k })); await b.commit(); }); };
  const toggleLesson = (l: Lesson) => run(async () => { await updateDoc(doc(db, 'lessons', l.id), { status: l.status === 'published' ? 'draft' : 'published' }); });
  const deleteLesson = (l: Lesson) => { if (!window.confirm(`Delete lesson "${l.title}"${l.videoPath ? ' and its uploaded video' : ''}?`)) return; void run(async () => { await deleteUploaded(l.videoPath); for (const a of l.attachments ?? []) await deleteUploaded(a.path); await deleteDoc(doc(db, 'lessons', l.id)); }, 'Lesson deleted.'); };
  const deleteVideo = (l: Lesson) => { if (!window.confirm('Remove only the video from this lesson?')) return; void run(async () => { await deleteUploaded(l.videoPath); await updateDoc(doc(db, 'lessons', l.id), { videoUrl: '', videoPath: '' }); }, 'Video removed.'); };

  const bulkAdd = (moduleId: string, text: string, publish: boolean) => run(async () => {
    const lines = text.split('\n').map((x) => x.trim()).filter(Boolean);
    if (lines.length === 0) throw new Error('Paste at least one line.');
    const start = inMod(moduleId).length; const b = writeBatch(db);
    lines.forEach((line, i) => {
      const parts = line.split(/\s*[|\t]\s*/);
      const url = parts.find((p) => /^https:\/\//i.test(p)) ?? '';
      if (parseVideoUrl(url).kind === 'none') throw new Error(`Line ${i + 1}: no valid https video link found.`);
      const title = parts.find((p) => p && p !== url && !/^\d+$/.test(p)) ?? `Lesson ${start + i + 1}`;
      const mins = Number(parts.find((p) => /^\d+$/.test(p)) ?? 10);
      b.set(doc(collection(db, 'lessons')), { courseId: sel, moduleId, title, order: start + i, level: 'Beginner', estimatedMinutes: Math.max(1, Math.min(600, mins)), content: '', status: publish ? 'published' : 'draft', videoUrl: url, videoPath: '', attachments: [], prerequisiteId: '', relatedQuestionIds: [], createdAt: serverTimestamp() });
    });
    await b.commit(); setBulk(null);
  }, 'Videos added.');

  const importCourse = async (json: unknown): Promise<string> => {
    const items = Array.isArray(json) ? json : [json]; let total = 0;
    for (const it of items) {
      const o = it as { title?: string; description?: string; category?: string; level?: string; status?: string; modules?: { title?: string; lessons?: { title?: string; estimatedMinutes?: number; level?: string; content?: string; videoUrl?: string }[] }[] };
      if (!o.title || !Array.isArray(o.modules)) throw new Error('Each course needs a "title" and a "modules" list.');
      const batch = writeBatch(db); const cref = doc(collection(db, 'courses')); const published = o.status === 'published'; let count = 0; let mins = 0;
      o.modules.forEach((mod, mi) => {
        if (!mod.title) throw new Error(`Module ${mi + 1} needs a title.`);
        const mref = doc(collection(db, 'modules')); batch.set(mref, { courseId: cref.id, title: mod.title, order: mi, status: 'published' });
        (mod.lessons ?? []).forEach((ls, li) => {
          if (!ls.title || (!ls.content && !ls.videoUrl)) throw new Error(`Lesson ${li + 1} in "${mod.title}" needs a title and a videoUrl or content.`);
          if (ls.videoUrl && parseVideoUrl(ls.videoUrl).kind === 'none') throw new Error(`Lesson "${ls.title}": invalid video link.`);
          const m = Math.max(1, Math.min(600, Number(ls.estimatedMinutes ?? 10))); mins += m;
          batch.set(doc(collection(db, 'lessons')), { courseId: cref.id, moduleId: mref.id, title: ls.title, order: count, level: ls.level ?? 'Beginner', estimatedMinutes: m, content: ls.content ?? '', videoUrl: ls.videoUrl ?? '', videoPath: '', attachments: [], prerequisiteId: '', relatedQuestionIds: [], status: published ? 'published' : 'draft' });
          count++;
        });
      });
      batch.set(cref, { title: o.title, description: o.description ?? '', category: o.category ?? 'General', level: o.level ?? 'Beginner', status: published ? 'published' : 'draft', order: courses.length, lessonCount: published ? count : 0, moduleCount: o.modules.length, totalMinutes: published ? mins : 0, createdBy: profile?.uid, createdAt: serverTimestamp() });
      await batch.commit(); total += count;
    }
    await refresh();
    return `Imported ${items.length} course(s) with ${total} lesson(s). They are drafts unless "status" is "published".`;
  };

  if (loading) return <Spinner />;
  const categories = [...new Set(courses.map((x) => x.category).filter(Boolean))];

  return (
    <>
      <PageHeader title="Courses & videos" subtitle="Create a subject (Java, Python, C, C++...), add modules, then lessons with videos and notes. Students see them in order." />
      {err && <div className="mb-3"><ErrorNote message={err} /></div>}
      {ok && <div className="mb-3"><SuccessNote message={ok} /></div>}

      <form onSubmit={addCourse} className="card mb-4 grid gap-3 sm:grid-cols-2">
        <h2 className="h-section sm:col-span-2">New course</h2>
        <input className="input" required placeholder="Course title (e.g. Java Programming)" aria-label="Course title" value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} />
        <div><input className="input" list="cats" required placeholder="Subject (Java, Python, C, C++...)" aria-label="Subject" value={c.category} onChange={(e) => setC({ ...c, category: e.target.value })} /><datalist id="cats">{categories.map((x) => <option key={x} value={x} />)}</datalist></div>
        <input className="input sm:col-span-2" required placeholder="Short description" aria-label="Description" value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} />
        <select className="input" aria-label="Level" value={c.level} onChange={(e) => setC({ ...c, level: e.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select>
        <div className="sm:col-span-2"><BannerPicker value={c.banner} onChange={(v) => setC({ ...c, banner: v })} /></div>
        <button className="btn-primary sm:col-span-2" disabled={busy}><Plus className="h-4 w-4" /> Create course</button>
      </form>

      <div className="card mb-4 !p-0">
        {courses.length === 0 ? <EmptyState icon={<ListVideo className="h-6 w-6" />} title="No courses yet" hint="Create your first course above." /> : (
          <ul>{courses.map((x) => (
            <li key={x.id} className={`border-b border-line last:border-0 ${x.id === sel ? 'bg-brand-soft' : ''}`}>
              <button type="button" className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left" onClick={() => setSel(x.id === sel ? '' : x.id)} aria-expanded={x.id === sel}>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{x.title}</span><span className="block text-xs text-muted">{x.category} · {x.lessonCount ?? 0} published lessons</span></span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${x.status === 'published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>{x.status}</span>
              </button>
            </li>))}</ul>
        )}
      </div>

      {course && (
        <section className="space-y-4" aria-label={`Edit ${course.title}`}>
          <div className="card flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold">{course.title}</h2><p className="text-xs text-muted">{course.category} · {course.level} · {course.status === 'published' ? 'visible to students' : 'draft, hidden from students'}</p></div>
            <button type="button" className="btn-outline !min-h-[40px]" onClick={() => setEditCourse(true)}><Pencil className="h-4 w-4" /> Edit</button>
            <button type="button" className="btn-primary !min-h-[40px]" disabled={busy} onClick={() => void setCourseStatus(course.status === 'published' ? 'draft' : 'published')}>{course.status === 'published' ? 'Unpublish' : 'Publish course'}</button>
            <button type="button" className="btn-outline !min-h-[40px] text-red-600" disabled={busy} onClick={() => void deleteCourse()}><Trash2 className="h-4 w-4" /> Delete</button>
          </div>

          <form onSubmit={addModule} className="card flex flex-col gap-3 sm:flex-row"><input className="input" required placeholder="New module name (e.g. Basics, OOP, Collections)" aria-label="Module name" value={modTitle} onChange={(e) => setModTitle(e.target.value)} /><button className="btn-primary sm:w-44" disabled={busy}><Plus className="h-4 w-4" /> Add module</button></form>

          {mods.length === 0 ? <div className="card"><EmptyState title="No modules yet" hint="A module groups lessons, e.g. 'Introduction' or 'Loops'. Add one above." /></div> : mods.map((m, mi) => {
            const ls = inMod(m.id);
            return (
              <div key={m.id} className="card !p-0 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 border-b border-line bg-subtle px-4 py-2.5">
                  <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{mi + 1}. {m.title} <span className="font-normal text-muted">· {ls.length} lessons</span></h3>
                  <button type="button" aria-label="Move module up" disabled={mi === 0 || busy} onClick={() => moveModule(mi, -1)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-line/50 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label="Move module down" disabled={mi === mods.length - 1 || busy} onClick={() => moveModule(mi, 1)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-line/50 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" aria-label="Rename module" onClick={() => renameModule(m)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-line/50"><Pencil className="h-4 w-4" /></button>
                  <button type="button" aria-label="Delete module" onClick={() => deleteModule(m)} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-line/50"><Trash2 className="h-4 w-4" /></button>
                </div>
                {ls.length === 0 && <p className="px-4 py-4 text-sm text-muted">No lessons in this module yet.</p>}
                <ul>{ls.map((l, li) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 last:border-0">
                    {l.videoUrl ? <Play className="h-4 w-4 shrink-0 text-brand-ink" aria-label="Has video" /> : <FileText className="h-4 w-4 shrink-0 text-muted" aria-label="Notes only" />}
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm">{li + 1}. {l.title}</span><span className="block text-xs text-muted">{l.estimatedMinutes} min · {l.videoUrl ? (l.videoPath ? 'uploaded video' : 'video link') : 'notes only'}{(l.attachments?.length ?? 0) > 0 ? ` · ${l.attachments!.length} file(s)` : ''}</span></span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${l.status === 'published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>{l.status}</span>
                    <button type="button" aria-label="Move lesson up" disabled={li === 0 || busy} onClick={() => moveLesson(m.id, li, -1)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-subtle disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label="Move lesson down" disabled={li === ls.length - 1 || busy} onClick={() => moveLesson(m.id, li, 1)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-subtle disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" className="btn-outline !min-h-[36px] !px-3 text-xs" disabled={busy} onClick={() => void toggleLesson(l)}>{l.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                    <button type="button" aria-label="Edit lesson" onClick={() => setEditor({ moduleId: m.id, lesson: l })} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-subtle"><Pencil className="h-4 w-4" /></button>
                    {l.videoUrl && <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => deleteVideo(l)}>Delete video</button>}
                    <button type="button" aria-label="Delete lesson" onClick={() => deleteLesson(l)} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-subtle"><Trash2 className="h-4 w-4" /></button>
                  </li>))}</ul>
                <div className="flex flex-wrap gap-2 border-t border-line p-3">
                  <button type="button" className="btn-primary !min-h-[40px]" onClick={() => setEditor({ moduleId: m.id })}><Plus className="h-4 w-4" /> Add lesson / video</button>
                  <button type="button" className="btn-outline !min-h-[40px]" onClick={() => setBulk(m.id)}><ListVideo className="h-4 w-4" /> Add many videos at once</button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <div className="mt-6"><ImportBox label="Advanced: import whole courses from JSON" template={TEMPLATE} onImport={importCourse} /></div>

      {editor && <LessonEditor courseId={sel} moduleId={editor.moduleId} order={inMod(editor.moduleId).length} lessons={lessons} existing={editor.lesson} storageOn={storageOn} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void run(async () => undefined, 'Lesson saved.'); }} />}
      {bulk && <BulkModal onClose={() => setBulk(null)} onAdd={(t, p) => void bulkAdd(bulk, t, p)} busy={busy} />}
      {editCourse && course && <EditCourse course={course} categories={categories} onClose={() => setEditCourse(false)} onSaved={() => { setEditCourse(false); void refresh(); flash('Course updated.'); }} />}
    </>
  );
}

function BulkModal({ onClose, onAdd, busy }: { onClose: () => void; onAdd: (text: string, publish: boolean) => void; busy: boolean }) {
  const [t, setT] = useState(''); const [pub, setPub] = useState(false);
  return (
    <Modal title="Add many videos at once" onClose={onClose}>
      <p className="mb-2 text-sm text-muted">One lesson per line: <code>Title | https://video-link | minutes</code>. Title and minutes are optional. Perfect for a YouTube playlist.</p>
      <textarea className="input min-h-[180px] py-2 font-mono text-xs" aria-label="Video lines" value={t} onChange={(e) => setT(e.target.value)} placeholder={'Variables | https://youtu.be/abc123def45 | 12\nLoops | https://youtu.be/xyz987uvw65 | 18'} />
      <label className="mt-2 flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} /> Publish immediately (otherwise saved as drafts)</label>
      <div className="mt-3 flex justify-end gap-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" disabled={busy || !t.trim()} onClick={() => onAdd(t, pub)}>{busy ? 'Adding...' : 'Add videos'}</button></div>
    </Modal>
  );
}

function EditCourse({ course, categories, onClose, onSaved }: { course: Course; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: course.title, description: course.description, category: course.category, level: course.level, banner: course.banner ?? '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { if (f.banner && !f.banner.startsWith('data:') && !/^https:\/\//i.test(f.banner)) { setErr('The banner link must start with https://'); setBusy(false); return; } await updateDoc(doc(db, 'courses', course.id), f); onSaved(); } catch (x) { setErr(friendlyError(x)); } finally { setBusy(false); } };
  return (
    <Modal title="Edit course" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <input className="input" required aria-label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className="input" list="cats2" required aria-label="Subject" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /><datalist id="cats2">{categories.map((x) => <option key={x} value={x} />)}</datalist>
        <input className="input" required aria-label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <select className="input" aria-label="Level" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select>
        <BannerPicker value={f.banner} onChange={(v) => setF({ ...f, banner: v })} />
        {err && <ErrorNote message={err} />}
        <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>Save</button></div>
      </form>
    </Modal>
  );
}
