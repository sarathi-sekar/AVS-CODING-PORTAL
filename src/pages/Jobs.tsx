import { useState } from 'react';
import { collection, deleteDoc, doc, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Briefcase, ExternalLink, MapPin } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useQueryDocs } from '../lib/useDocs';
import { friendlyError } from '../lib/errors';
import { istDateKey } from '../shared/streak';
import type { Application, Job } from '../types';
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';
import { Markdown } from '../components/Markdown';

export default function Jobs() {
  const { profile } = useAuth();
  const uid = profile?.uid ?? '';
  const [tab, setTab] = useState<'open' | 'applied'>('open');
  const [openId, setOpenId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const jobs = useQueryDocs<Job>(() => query(collection(db, 'jobs'), where('status', '==', 'published'), limit(200)), 'jobs', (id, d) => ({ id, ...(d as Omit<Job, 'id'>) }));
  const apps = useQueryDocs<Application>(() => (uid ? query(collection(db, 'applications'), where('uid', '==', uid)) : null), `apps${uid}`, (id, d) => ({ id, ...(d as Omit<Application, 'id'>) }));
  const today = istDateKey(new Date());
  const applied = new Set(apps.data.map((a) => a.jobId));

  const apply = async (j: Job) => {
    if (!profile) return;
    setBusy(j.id); setErr('');
    try {
      const a = { uid, jobId: j.id, company: j.company, role: j.role, displayName: profile.displayName, registerNumber: profile.registerNumber, department: profile.department, academicYear: profile.academicYear, email: profile.email, createdAt: serverTimestamp() };
      await setDoc(doc(db, 'applications', `${uid}_${j.id}`), a);
      apps.setData((l) => [...l, { id: `${uid}_${j.id}`, ...a, createdAt: undefined } as Application]);
      if (j.applyUrl) window.open(j.applyUrl, '_blank', 'noopener,noreferrer');
    } catch (e) { setErr(friendlyError(e)); } finally { setBusy(''); }
  };
  const withdraw = async (j: Job) => { setBusy(j.id); try { await deleteDoc(doc(db, 'applications', `${uid}_${j.id}`)); apps.setData((l) => l.filter((a) => a.jobId !== j.id)); } catch (e) { setErr(friendlyError(e)); } finally { setBusy(''); } };

  const rows = [...jobs.data].sort((a, b) => a.lastDate.localeCompare(b.lastDate)).filter((j) => (tab === 'applied' ? applied.has(j.id) : j.lastDate >= today));
  return (
    <>
      <PageHeader title="Jobs & placement drives" subtitle="Drives posted by the placement team. Apply before the last date." />
      <div className="mb-4 inline-flex rounded-xl border border-line bg-surface p-1" role="tablist">{(['open', 'applied'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={`min-h-[40px] rounded-lg px-4 text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'text-muted'}`}>{t === 'open' ? 'Open drives' : `Applied (${applied.size})`}</button>)}</div>
      {(err || jobs.error || apps.error) && <div className="mb-3"><ErrorNote message={err || jobs.error || apps.error} /></div>}
      {jobs.loading ? <Spinner /> : rows.length === 0 ? <div className="card"><EmptyState icon={<Briefcase className="h-6 w-6" />} title={tab === 'open' ? 'No open drives right now' : 'You have not applied to any drive'} /></div> : (
        <div className="space-y-3">{rows.map((j) => (
          <article key={j.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h2 className="text-base font-semibold">{j.role}</h2><p className="text-sm text-muted">{j.company}</p></div><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${j.lastDate < today ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-brand-soft text-brand-ink'}`}>{j.lastDate < today ? 'Closed' : `Last date ${j.lastDate}`}</span></div>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">{j.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{j.location}</span>}{j.salary && <span>Package: {j.salary}</span>}{j.eligibility && <span>Eligibility: {j.eligibility}</span>}</p>
            {openId === j.id && j.description && <div className="mt-3 border-t border-line pt-3"><Markdown source={j.description} /></div>}
            <div className="mt-3 flex flex-wrap gap-2">
              {j.description && <button type="button" className="btn-outline !min-h-[40px]" onClick={() => setOpenId(openId === j.id ? '' : j.id)}>{openId === j.id ? 'Hide details' : 'Details'}</button>}
              {applied.has(j.id) ? <><span className="inline-flex min-h-[40px] items-center rounded-xl bg-emerald-50 px-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Applied</span>{j.applyUrl && <a className="btn-outline !min-h-[40px]" href={j.applyUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Open form</a>}<button type="button" className="text-sm text-muted hover:underline" disabled={busy === j.id} onClick={() => void withdraw(j)}>Withdraw</button></> : <button type="button" className="btn-primary !min-h-[40px]" disabled={busy === j.id || j.lastDate < today} onClick={() => void apply(j)}>{busy === j.id ? 'Applying...' : j.applyUrl ? 'Apply (opens form)' : 'Apply'}</button>}
            </div>
          </article>))}</div>
      )}
    </>
  );
}
