import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ExternalLink, Trash2, Upload } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { friendlyError } from '../../lib/errors';
import { clearQueryCache } from '../../lib/useDocs';
import { deleteUploaded, fetchFeatures, uploadFile, uploadProblem } from '../../lib/storage';
import { RESOURCE_LABEL, type Resource, type ResourceType } from '../../types';
import { EmptyState, ErrorNote, PageHeader, Spinner, SuccessNote } from '../../components/ui';

const HINT: Record<ResourceType, string> = {
  notes: 'Study notes, PDFs, slides, cheat-sheets for a subject.',
  company: 'Questions asked by a company (previous papers, patterns, coding questions). Attach a document or type the questions below.',
  interview: 'Common interview questions and answers.',
};

export default function ManageLibrary() {
  const { profile } = useAuth();
  const [list, setList] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [storageOn, setStorageOn] = useState(false);
  const [tab, setTab] = useState<ResourceType>('notes');
  const [f, setF] = useState({ title: '', subject: '', company: '', description: '', body: '', url: '', path: '', publish: true });
  const [pct, setPct] = useState<number | null>(null);

  const load = useCallback(async () => {
    try { const s = await getDocs(query(collection(db, 'resources'))); setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Resource, 'id'>) })).sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))); }
    catch (e) { setErr(friendlyError(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); void fetchFeatures().then((x) => setStorageOn(x.storage)); }, [load]);
  const flash = (m: string) => { setOk(m); setTimeout(() => setOk(''), 3500); };

  const subjects = useMemo(() => [...new Set(list.map((r) => r.subject).filter(Boolean) as string[])], [list]);
  const companies = useMemo(() => [...new Set(list.map((r) => r.company).filter(Boolean) as string[])], [list]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const onFile = async (file?: File) => {
    if (!file) return;
    const p = uploadProblem(file, 'document'); if (p) return setErr(p);
    setErr(''); setPct(0);
    try { if (f.path) await deleteUploaded(f.path); const r = await uploadFile('library', file, setPct); setF((x) => ({ ...x, url: r.url, path: r.path, title: x.title || file.name.replace(/\.[^.]+$/, '') })); }
    catch (e) { setErr(`Upload failed: ${friendlyError(e)}. If Storage is not enabled, paste a link instead.`); } finally { setPct(null); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (f.url && !/^https:\/\//i.test(f.url.trim())) return setErr('The link must start with https://');
    if (!f.url.trim() && !f.body.trim()) return setErr('Add a link / file, or type the content below.');
    if (tab === 'company' && !f.company.trim()) return setErr('Enter the company name.');
    setBusy(true);
    try {
      await addDoc(collection(db, 'resources'), { type: tab, title: f.title.trim(), subject: f.subject.trim(), company: f.company.trim(), description: f.description.trim(), body: f.body, url: f.url.trim(), path: f.path, status: f.publish ? 'published' : 'draft', createdBy: profile?.uid, createdAt: serverTimestamp() });
      setF({ ...f, title: '', description: '', body: '', url: '', path: '' }); clearQueryCache(); await load(); flash(f.publish ? 'Published. Students can see it in Library.' : 'Saved as draft.');
    } catch (x) { setErr(friendlyError(x)); } finally { setBusy(false); }
  };
  const toggle = async (r: Resource) => { try { await updateDoc(doc(db, 'resources', r.id), { status: r.status === 'published' ? 'draft' : 'published' }); clearQueryCache(); await load(); } catch (e) { setErr(friendlyError(e)); } };
  const remove = async (r: Resource) => { if (!window.confirm(`Delete "${r.title}"${r.path ? ' and its uploaded file' : ''}?`)) return; try { await deleteUploaded(r.path); await deleteDoc(doc(db, 'resources', r.id)); clearQueryCache(); setList((l) => l.filter((x) => x.id !== r.id)); flash('Deleted.'); } catch (e) { setErr(friendlyError(e)); } };
  const shown = list.filter((r) => r.type === tab);

  return (
    <>
      <PageHeader title="Library: notes & company questions" subtitle="Upload study notes, company question papers and interview questions for students." />
      {err && <div className="mb-3"><ErrorNote message={err} /></div>}
      {ok && <div className="mb-3"><SuccessNote message={ok} /></div>}
      <div className="mb-4 inline-flex flex-wrap rounded-xl border border-line bg-surface p-1" role="tablist">{(Object.keys(RESOURCE_LABEL) as ResourceType[]).map((t) => <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={`min-h-[40px] rounded-lg px-4 text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'text-muted'}`}>{RESOURCE_LABEL[t]}</button>)}</div>

      <form onSubmit={submit} className="card mb-4 grid gap-3 sm:grid-cols-2">
        <h2 className="h-section sm:col-span-2">Add to {RESOURCE_LABEL[tab]}</h2>
        <p className="-mt-2 text-xs text-muted sm:col-span-2">{HINT[tab]}</p>
        <input className="input sm:col-span-2" required placeholder="Title" aria-label="Title" value={f.title} onChange={(e) => set('title', e.target.value)} />
        {tab === 'company' ? <div><input className="input" list="comp" required placeholder="Company (TCS, Infosys, Zoho...)" aria-label="Company" value={f.company} onChange={(e) => set('company', e.target.value)} /><datalist id="comp">{companies.map((c) => <option key={c} value={c} />)}</datalist></div>
          : <div><input className="input" list="subj" placeholder="Subject (Java, Python, DBMS...)" aria-label="Subject" value={f.subject} onChange={(e) => set('subject', e.target.value)} /><datalist id="subj">{subjects.map((c) => <option key={c} value={c} />)}</datalist></div>}
        <input className="input" placeholder="Short description (optional)" aria-label="Description" value={f.description} onChange={(e) => set('description', e.target.value)} />
        <div className="sm:col-span-2">
          <input className="input" placeholder="Link to PDF / Google Drive / document (https://...)" aria-label="Link" disabled={Boolean(f.path)} value={f.path ? '' : f.url} onChange={(e) => set('url', e.target.value)} />
          {f.path && <p className="mt-1 flex items-center gap-2 text-xs text-muted">Uploaded file attached. <button type="button" className="font-medium text-red-600" onClick={async () => { await deleteUploaded(f.path); setF((x) => ({ ...x, url: '', path: '' })); }}>Remove file</button></p>}
          {storageOn ? <label className="mt-2 flex min-h-[40px] cursor-pointer items-center gap-2 text-sm text-brand-ink"><Upload className="h-4 w-4" /> Or upload a file (PDF, DOCX, PPT...)<input type="file" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} /></label> : <p className="mt-1 text-xs text-muted">Tip: upload the file to Google Drive (share: anyone with the link can view) and paste the link here. Direct file upload needs Firebase Storage (enable in Academic setup).</p>}
          {pct !== null && <div className="mt-2 h-2 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={pct}><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div>}
        </div>
        <textarea className="input min-h-[120px] py-2 sm:col-span-2" placeholder={tab === 'notes' ? 'Or type notes here (markdown)' : 'Or type the questions and answers here (markdown)'} aria-label="Content" value={f.body} onChange={(e) => set('body', e.target.value)} />
        <label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" checked={f.publish} onChange={(e) => set('publish', e.target.checked)} /> Publish immediately</label>
        <button className="btn-primary" disabled={busy || pct !== null}>{busy ? 'Saving...' : 'Add'}</button>
      </form>

      <div className="card !p-0">{loading ? <Spinner /> : shown.length === 0 ? <EmptyState title={`No ${RESOURCE_LABEL[tab].toLowerCase()} yet`} /> : <ul>{shown.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 last:border-0">
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.title}</span><span className="block truncate text-xs text-muted">{r.type === 'company' ? r.company : r.subject}{r.url ? ' · link/file' : ''}{r.body ? ' · text' : ''}</span></span>
          {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${r.title}`} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-subtle"><ExternalLink className="h-4 w-4" /></a>}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.status === 'published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>{r.status}</span>
          <button type="button" className="btn-outline !min-h-[40px] !px-3" onClick={() => void toggle(r)}>{r.status === 'published' ? 'Unpublish' : 'Publish'}</button>
          <button type="button" aria-label={`Delete ${r.title}`} onClick={() => void remove(r)} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-subtle"><Trash2 className="h-4 w-4" /></button>
        </li>))}</ul>}</div>
    </>
  );
}
