import { useEffect, useState, type FormEvent } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Paperclip, Trash2, Upload } from 'lucide-react';
import { db } from '../../lib/firebase';
import { friendlyError } from '../../lib/errors';
import { parseVideoUrl, VIDEO_KIND_LABEL } from '../../lib/video';
import { deleteUploaded, uploadFile, uploadProblem } from '../../lib/storage';
import type { Attachment, Lesson } from '../../types';
import { ErrorNote, Modal } from '../../components/ui';
import { VideoPlayer } from '../../components/VideoPlayer';

interface Props { courseId: string; moduleId: string; order: number; lessons: Lesson[]; existing?: Lesson; storageOn: boolean; onClose: () => void; onSaved: () => void }

function videoMinutes(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video'); const url = URL.createObjectURL(file);
    v.preload = 'metadata'; v.onloadedmetadata = () => { resolve(Number.isFinite(v.duration) ? Math.max(1, Math.round(v.duration / 60)) : null); URL.revokeObjectURL(url); };
    v.onerror = () => { resolve(null); URL.revokeObjectURL(url); }; v.src = url;
  });
}

export function LessonEditor({ courseId, moduleId, order, lessons, existing, storageOn, onClose, onSaved }: Props) {
  const [f, setF] = useState({
    title: existing?.title ?? '', estimatedMinutes: existing?.estimatedMinutes ?? 10, level: existing?.level ?? 'Beginner', content: existing?.content ?? '',
    status: existing?.status ?? 'draft', prerequisiteId: existing?.prerequisiteId ?? '', related: (existing?.relatedQuestionIds ?? []).join(', '),
    videoUrl: existing?.videoUrl ?? '', videoPath: existing?.videoPath ?? '',
  });
  const [atts, setAtts] = useState<Attachment[]>(existing?.attachments ?? []);
  const [newAtt, setNewAtt] = useState({ name: '', url: '' });
  const [mode, setMode] = useState<'link' | 'upload'>('link');
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!storageOn) setMode('link'); }, [storageOn]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const parsed = parseVideoUrl(f.videoUrl);

  const onVideoFile = async (file: File | undefined) => {
    if (!file) return;
    const p = uploadProblem(file, 'video'); if (p) return setErr(p);
    setErr(''); setPct(0);
    try {
      const mins = await videoMinutes(file);
      const r = await uploadFile('videos', file, setPct);
      if (f.videoPath) await deleteUploaded(f.videoPath);
      setF((x) => ({ ...x, videoUrl: r.url, videoPath: r.path, estimatedMinutes: mins ?? x.estimatedMinutes, title: x.title || file.name.replace(/\.[^.]+$/, '') }));
    } catch (e) { setErr(`Upload failed: ${friendlyError(e)}. If Storage is not enabled on your Firebase plan, use a video link instead.`); } finally { setPct(null); }
  };
  const onDocFile = async (file: File | undefined) => {
    if (!file) return;
    const p = uploadProblem(file, 'document'); if (p) return setErr(p);
    setErr(''); setPct(0);
    try { const r = await uploadFile('materials', file, setPct); setAtts((a) => [...a, { name: file.name, url: r.url, path: r.path }]); }
    catch (e) { setErr(`Upload failed: ${friendlyError(e)}`); } finally { setPct(null); }
  };
  const removeVideo = async () => { if (f.videoPath) await deleteUploaded(f.videoPath); setF((x) => ({ ...x, videoUrl: '', videoPath: '' })); };
  const addAtt = () => {
    const u = newAtt.url.trim();
    if (!/^https:\/\//i.test(u)) return setErr('Material links must start with https://');
    setErr(''); setAtts((a) => [...a, { name: newAtt.name.trim() || 'Material', url: u }]); setNewAtt({ name: '', url: '' });
  };
  const removeAtt = async (a: Attachment) => { if (a.path) await deleteUploaded(a.path); setAtts((x) => x.filter((y) => y !== a)); };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (f.videoUrl.trim() && parsed.kind === 'none') return setErr('The video link is not valid. Use an https:// link (YouTube, Google Drive, Vimeo or a direct .mp4).');
    if (!f.videoUrl.trim() && !f.content.trim()) return setErr('Add a video or some notes for this lesson.');
    setBusy(true);
    try {
      const data = {
        title: f.title.trim(), level: f.level, estimatedMinutes: Math.max(1, Math.min(600, Number(f.estimatedMinutes) || 10)), content: f.content, status: f.status,
        videoUrl: f.videoUrl.trim(), videoPath: f.videoPath, attachments: atts, prerequisiteId: f.prerequisiteId,
        relatedQuestionIds: f.related.split(',').map((x) => x.trim()).filter(Boolean),
      };
      if (existing) await updateDoc(doc(db, 'lessons', existing.id), { ...data, updatedAt: serverTimestamp() });
      else await addDoc(collection(db, 'lessons'), { ...data, courseId, moduleId, order, createdAt: serverTimestamp() });
      onSaved();
    } catch (x) { setErr(friendlyError(x)); } finally { setBusy(false); }
  };

  return (
    <Modal title={existing ? 'Edit lesson' : 'Add lesson'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label" htmlFor="l-t">Lesson title</label><input id="l-t" className="input" required value={f.title} onChange={(e) => set('title', e.target.value)} /></div>

        <fieldset className="rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-medium">Video</legend>
          {storageOn && <div className="mb-2 inline-flex rounded-lg border border-line p-0.5" role="tablist">{(['link', 'upload'] as const).map((m) => <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`min-h-[36px] rounded-md px-3 text-sm ${mode === m ? 'bg-brand text-white' : 'text-muted'}`}>{m === 'link' ? 'Paste link' : 'Upload file'}</button>)}</div>}
          {mode === 'link' ? (
            <div>
              <input className="input" aria-label="Video link" placeholder="https://www.youtube.com/watch?v=... or Google Drive / Vimeo / .mp4 link" value={f.videoPath ? '' : f.videoUrl} disabled={Boolean(f.videoPath)} onChange={(e) => set('videoUrl', e.target.value)} />
              {!storageOn && <p className="mt-1 text-xs text-muted">Tip: upload to YouTube as <b>Unlisted</b>, or share a Google Drive video, and paste the link. (File upload needs Firebase Storage, enabled in Academic setup.)</p>}
            </div>
          ) : (
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-3 text-sm hover:bg-subtle"><Upload className="h-4 w-4" /> Choose video file (max 500 MB)<input type="file" accept="video/*" className="sr-only" onChange={(e) => void onVideoFile(e.target.files?.[0])} /></label>
          )}
          {pct !== null && <div className="mt-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-2 overflow-hidden rounded-full bg-subtle"><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div><p className="mt-1 text-xs text-muted">Uploading {pct}%...</p></div>}
          {f.videoUrl && parsed.kind !== 'none' && (
            <div className="mt-3"><div className="mb-2 flex items-center justify-between text-xs text-muted"><span>{VIDEO_KIND_LABEL[parsed.kind]}{f.videoPath ? ' (uploaded)' : ''}</span><button type="button" className="inline-flex items-center gap-1 font-medium text-red-600" onClick={() => void removeVideo()}><Trash2 className="h-3.5 w-3.5" /> Remove video</button></div><VideoPlayer url={f.videoUrl} title="Preview" /></div>
          )}
          {f.videoUrl && parsed.kind === 'none' && <p className="mt-2 text-xs text-red-600">This does not look like a valid https video link.</p>}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="l-m">Duration (minutes)</label><input id="l-m" type="number" min={1} max={600} className="input" value={f.estimatedMinutes} onChange={(e) => set('estimatedMinutes', Number(e.target.value))} /></div>
          <div><label className="label" htmlFor="l-l">Level</label><select id="l-l" className="input" value={f.level} onChange={(e) => set('level', e.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
        </div>
        <div><label className="label" htmlFor="l-c">Notes (optional, markdown)</label><textarea id="l-c" className="input min-h-[110px] py-2 font-mono text-xs" value={f.content} onChange={(e) => set('content', e.target.value)} placeholder="Summary, syntax, examples, common mistakes..." /></div>

        <fieldset className="rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-medium">Downloadable materials</legend>
          <ul className="mb-2 space-y-1">{atts.map((a) => <li key={a.url} className="flex items-center gap-2 text-sm"><Paperclip className="h-4 w-4 text-muted" /><span className="min-w-0 flex-1 truncate">{a.name}</span><button type="button" aria-label={`Remove ${a.name}`} onClick={() => void removeAtt(a)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button></li>)}</ul>
          <div className="flex flex-col gap-2 sm:flex-row"><input className="input" placeholder="Name" aria-label="Material name" value={newAtt.name} onChange={(e) => setNewAtt({ ...newAtt, name: e.target.value })} /><input className="input" placeholder="https:// link (PDF, Drive...)" aria-label="Material link" value={newAtt.url} onChange={(e) => setNewAtt({ ...newAtt, url: e.target.value })} /><button type="button" className="btn-outline" onClick={addAtt} disabled={!newAtt.url.trim()}>Add</button></div>
          {storageOn && <label className="mt-2 flex min-h-[40px] cursor-pointer items-center gap-2 text-sm text-brand-ink"><Upload className="h-4 w-4" /> Upload a file<input type="file" className="sr-only" onChange={(e) => void onDocFile(e.target.files?.[0])} /></label>}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="l-p">Prerequisite</label><select id="l-p" className="input" value={f.prerequisiteId} onChange={(e) => set('prerequisiteId', e.target.value)}><option value="">None</option>{lessons.filter((l) => l.id !== existing?.id).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></div>
          <div><label className="label" htmlFor="l-s">Visibility</label><select id="l-s" className="input" value={f.status} onChange={(e) => set('status', e.target.value as 'draft' | 'published')}><option value="draft">Draft (hidden from students)</option><option value="published">Published</option></select></div>
        </div>
        <div><label className="label" htmlFor="l-r">Related coding problem IDs (optional, comma separated)</label><input id="l-r" className="input" value={f.related} onChange={(e) => set('related', e.target.value)} /></div>
        {err && <ErrorNote message={err} />}
        <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || pct !== null}>{busy ? 'Saving...' : existing ? 'Save lesson' : 'Add lesson'}</button></div>
      </form>
    </Modal>
  );
}
