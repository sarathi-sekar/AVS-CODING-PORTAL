import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Download, Trash2, Users } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { friendlyError } from '../../lib/errors';
import { clearQueryCache } from '../../lib/useDocs';
import { downloadCsv, toCsv } from '../../lib/csv';
import { istDateKey } from '../../shared/streak';
import type { Application, Job } from '../../types';
import { EmptyState, ErrorNote, Modal, PageHeader, Spinner, SuccessNote } from '../../components/ui';

export default function ManageJobs() {
  const { profile } = useAuth();
  const [list, setList] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ company: '', role: '', location: '', salary: '', eligibility: '', description: '', applyUrl: '', lastDate: istDateKey(new Date()), publish: true });
  const [viewing, setViewing] = useState<{ job: Job; apps: Application[] } | null>(null);
  const flash = (m: string) => { setOk(m); setTimeout(() => setOk(''), 3500); };
  const load = useCallback(async () => {
    try { const s = await getDocs(collection(db, 'jobs')); setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Job, 'id'>) })).sort((a, b) => b.lastDate.localeCompare(a.lastDate))); }
    catch (e) { setErr(friendlyError(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => void load(), [load]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (f.applyUrl && !/^https:\/\//i.test(f.applyUrl.trim())) return setErr('The apply link must start with https://');
    setBusy(true);
    try { await addDoc(collection(db, 'jobs'), { company: f.company.trim(), role: f.role.trim(), location: f.location.trim(), salary: f.salary.trim(), eligibility: f.eligibility.trim(), description: f.description, applyUrl: f.applyUrl.trim(), lastDate: f.lastDate, status: f.publish ? 'published' : 'draft', createdBy: profile?.uid, createdAt: serverTimestamp() }); setF({ ...f, company: '', role: '', description: '', applyUrl: '' }); clearQueryCache(); await load(); flash(f.publish ? 'Drive published for students.' : 'Saved as draft.'); }
    catch (x) { setErr(friendlyError(x)); } finally { setBusy(false); }
  };
  const toggle = async (j: Job) => { try { await updateDoc(doc(db, 'jobs', j.id), { status: j.status === 'published' ? 'draft' : 'published' }); clearQueryCache(); await load(); } catch (x) { setErr(friendlyError(x)); } };
  const remove = async (j: Job) => { if (!window.confirm(`Delete the drive "${j.role}" at ${j.company}?`)) return; try { await deleteDoc(doc(db, 'jobs', j.id)); clearQueryCache(); setList((l) => l.filter((x) => x.id !== j.id)); flash('Deleted.'); } catch (x) { setErr(friendlyError(x)); } };
  const showApps = async (j: Job) => { try { const s = await getDocs(query(collection(db, 'applications'), where('jobId', '==', j.id))); setViewing({ job: j, apps: s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Application, 'id'>) })).sort((a, b) => a.displayName.localeCompare(b.displayName)) }); } catch (x) { setErr(friendlyError(x)); } };

  return (
    <>
      <PageHeader title="Jobs & placement drives" subtitle="Post drives, see who applied and export the list." />
      {err && <div className="mb-3"><ErrorNote message={err} /></div>}
      {ok && <div className="mb-3"><SuccessNote message={ok} /></div>}
      <form onSubmit={submit} className="card mb-4 grid gap-3 sm:grid-cols-2">
        <h2 className="h-section sm:col-span-2">Post a drive</h2>
        <input className="input" required placeholder="Company *" aria-label="Company" value={f.company} onChange={(e) => set('company', e.target.value)} />
        <input className="input" required placeholder="Role *" aria-label="Role" value={f.role} onChange={(e) => set('role', e.target.value)} />
        <input className="input" placeholder="Location" aria-label="Location" value={f.location} onChange={(e) => set('location', e.target.value)} />
        <input className="input" placeholder="Package (e.g. 4 LPA)" aria-label="Package" value={f.salary} onChange={(e) => set('salary', e.target.value)} />
        <input className="input" placeholder="Eligibility (e.g. CSE/IT, 60% and above)" aria-label="Eligibility" value={f.eligibility} onChange={(e) => set('eligibility', e.target.value)} />
        <label className="text-sm">Last date to apply<input type="date" required className="input mt-1" value={f.lastDate} onChange={(e) => set('lastDate', e.target.value)} /></label>
        <input className="input sm:col-span-2" placeholder="Company application link (optional, https://...)" aria-label="Apply link" value={f.applyUrl} onChange={(e) => set('applyUrl', e.target.value)} />
        <textarea className="input min-h-[100px] py-2 sm:col-span-2" placeholder="Job description, rounds, skills (markdown)" aria-label="Description" value={f.description} onChange={(e) => set('description', e.target.value)} />
        <label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" checked={f.publish} onChange={(e) => set('publish', e.target.checked)} /> Publish immediately</label>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Post drive'}</button>
      </form>
      <div className="card !p-0">{loading ? <Spinner /> : list.length === 0 ? <EmptyState title="No drives yet" /> : <ul>{list.map((j) => (
        <li key={j.id} className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 last:border-0">
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{j.role} · {j.company}</span><span className="block text-xs text-muted">Last date {j.lastDate}{j.salary ? ` · ${j.salary}` : ''}</span></span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${j.status === 'published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>{j.status}</span>
          <button type="button" className="btn-outline !min-h-[40px] !px-3" onClick={() => void showApps(j)}><Users className="h-4 w-4" /> Applicants</button>
          <button type="button" className="btn-outline !min-h-[40px] !px-3" onClick={() => void toggle(j)}>{j.status === 'published' ? 'Unpublish' : 'Publish'}</button>
          <button type="button" aria-label={`Delete ${j.role}`} onClick={() => void remove(j)} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-subtle"><Trash2 className="h-4 w-4" /></button>
        </li>))}</ul>}</div>
      {viewing && (
        <Modal title={`Applicants: ${viewing.job.role} (${viewing.apps.length})`} onClose={() => setViewing(null)}>
          {viewing.apps.length === 0 ? <p className="text-sm text-muted">Nobody has applied yet.</p> : <>
            <button type="button" className="btn-outline mb-3" onClick={() => downloadCsv(`applicants-${viewing.job.company}.csv`, toCsv(['Name', 'Register no.', 'Email', 'Department', 'Year'], viewing.apps.map((a) => [a.displayName, a.registerNumber, a.email, a.department, a.academicYear])))}><Download className="h-4 w-4" /> Export (Excel / CSV)</button>
            <ul className="divide-y divide-line text-sm">{viewing.apps.map((a) => <li key={a.id} className="py-2"><p className="font-medium">{a.displayName} <span className="font-normal text-muted">· {a.registerNumber}</span></p><p className="text-xs text-muted">{a.department} · {a.academicYear} · {a.email}</p></li>)}</ul></>}
        </Modal>
      )}
    </>
  );
}
