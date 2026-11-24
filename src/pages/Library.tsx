import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, limit, query, where } from 'firebase/firestore';
import { ExternalLink, FileText, Library as LibIcon, Search } from 'lucide-react';
import { db } from '../lib/firebase';
import { useQueryDocs } from '../lib/useDocs';
import { RESOURCE_LABEL, type Resource, type ResourceType } from '../types';
import { Markdown } from '../components/Markdown';
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';

export default function Library() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as ResourceType | null) && params.get('tab')! in RESOURCE_LABEL ? (params.get('tab') as ResourceType) : 'notes';
  const group = params.get('group') ?? '';
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState('');
  const res = useQueryDocs<Resource>(() => query(collection(db, 'resources'), where('status', '==', 'published'), limit(500)), 'resources', (id, d) => ({ id, ...(d as Omit<Resource, 'id'>) }));
  const setP = (k: string, v: string) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); if (k === 'tab') n.delete('group'); setParams(n, { replace: true }); };

  const ofTab = useMemo(() => res.data.filter((r) => r.type === tab), [res.data, tab]);
  const groups = useMemo(() => [...new Set(ofTab.map((r) => (tab === 'company' ? r.company : r.subject)).filter(Boolean) as string[])].sort(), [ofTab, tab]);
  const rows = ofTab.filter((r) => (!group || (tab === 'company' ? r.company : r.subject) === group) && (!q || `${r.title} ${r.description ?? ''}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.title.localeCompare(b.title));

  return (
    <>
      <PageHeader title="Library" subtitle="Notes, company question papers and interview questions shared by your faculty." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-xl border border-line bg-surface p-1" role="tablist">{(Object.keys(RESOURCE_LABEL) as ResourceType[]).map((t) => <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setP('tab', t === 'notes' ? '' : t)} className={`min-h-[40px] rounded-lg px-3 text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'text-muted'}`}>{RESOURCE_LABEL[t]}</button>)}</div>
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search" aria-label="Search library" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {groups.length > 0 && <div className="mb-4 flex flex-wrap gap-2">{['', ...groups].map((g) => <button key={g || 'all'} type="button" onClick={() => setP('group', g)} className={`min-h-[36px] rounded-full border px-3 text-sm ${group === g ? 'border-brand-ink bg-brand-soft text-brand-ink' : 'border-line text-muted'}`}>{g || (tab === 'company' ? 'All companies' : 'All subjects')}</button>)}</div>}
      {res.error && <ErrorNote message={res.error} />}
      {res.loading ? <Spinner /> : rows.length === 0 ? <div className="card"><EmptyState icon={<LibIcon className="h-6 w-6" />} title="Nothing here yet" hint="Faculty upload materials from Library in their menu." /></div> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <article key={r.id} className="card flex min-w-0 flex-col gap-1">
              <span className="w-fit rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-ink">{(tab === 'company' ? r.company : r.subject) || RESOURCE_LABEL[tab]}</span>
              <h2 className="flex items-start gap-2 text-base font-semibold"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted" /><span className="break-words">{r.title}</span></h2>
              {r.description && <p className="text-sm text-muted">{r.description}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {r.url && <a className="btn-primary !min-h-[40px]" href={r.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Open</a>}
                {r.body && <button type="button" className="btn-outline !min-h-[40px]" aria-expanded={openId === r.id} onClick={() => setOpenId(openId === r.id ? '' : r.id)}>{openId === r.id ? 'Hide' : 'Read here'}</button>}
              </div>
              {openId === r.id && r.body && <div className="mt-3 border-t border-line pt-3"><Markdown source={r.body} /></div>}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
