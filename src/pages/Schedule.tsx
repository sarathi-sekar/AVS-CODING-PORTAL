import { useMemo, useState } from 'react';
import { collection, limit, query } from 'firebase/firestore';
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { db } from '../lib/firebase';
import { useQueryDocs } from '../lib/useDocs';
import { istDateKey } from '../shared/streak';
import type { EventDoc } from '../types';
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Schedule() {
  const today = istDateKey(new Date());
  const [ym, setYm] = useState(today.slice(0, 7));
  const [prog, setProg] = useState('');
  const ev = useQueryDocs<EventDoc>(() => query(collection(db, 'events'), limit(1000)), 'events', (id, d) => ({ id, ...(d as Omit<EventDoc, 'id'>) }));
  const programs = useMemo(() => [...new Set(ev.data.map((e) => e.program).filter(Boolean) as string[])].sort(), [ev.data]);
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)); const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array.from({ length: first.getUTCDay() + days }, (_, i) => (i < first.getUTCDay() ? null : i - first.getUTCDay() + 1));
  const inMonth = ev.data.filter((e) => e.date.startsWith(ym) && (!prog || e.program === prog)).sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
  const byDay = (d: number) => inMonth.filter((e) => e.date === `${ym}-${String(d).padStart(2, '0')}`);
  const shift = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setYm(d.toISOString().slice(0, 7)); };
  const label = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <>
      <PageHeader title="Schedule" subtitle="Live classes, workshops and test dates." action={programs.length > 0 ? <select className="input !w-auto" aria-label="Filter by subject" value={prog} onChange={(e) => setProg(e.target.value)}><option value="">All subjects</option>{programs.map((p) => <option key={p}>{p}</option>)}</select> : undefined} />
      {ev.error && <ErrorNote message={ev.error} />}
      {ev.loading ? <Spinner /> : (
        <>
          <div className="mb-3 flex items-center justify-between"><button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-subtle"><ChevronLeft className="h-5 w-5" /></button><h2 className="text-base font-semibold">{label}</h2><button type="button" aria-label="Next month" onClick={() => shift(1)} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-subtle"><ChevronRight className="h-5 w-5" /></button></div>
          <div className="card hidden !p-0 sm:block">
            <div className="grid grid-cols-7 border-b border-line text-center text-xs font-medium text-muted">{DOW.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
            <div className="grid grid-cols-7">{cells.map((d, i) => {
              const key = d ? `${ym}-${String(d).padStart(2, '0')}` : '';
              return <div key={i} className={`min-h-[96px] border-b border-r border-line p-1.5 text-xs ${key === today ? 'bg-brand-soft' : ''}`}>{d && <><span className="font-medium">{d}</span>{byDay(d).slice(0, 3).map((e) => <p key={e.id} className="mt-1 truncate rounded bg-brand px-1.5 py-0.5 text-white" title={e.title}>{e.time ? `${e.time} ` : ''}{e.title}</p>)}{byDay(d).length > 3 && <p className="mt-1 text-muted">+{byDay(d).length - 3} more</p>}</>}</div>;
            })}</div>
          </div>
          <h3 className="mb-2 mt-4 text-sm font-semibold">This month</h3>
          {inMonth.length === 0 ? <div className="card"><EmptyState icon={<CalendarDays className="h-6 w-6" />} title="Nothing scheduled this month" /></div> : (
            <ul className="space-y-2">{inMonth.map((e) => (
              <li key={e.id} className="card flex flex-wrap items-center gap-3 !p-3"><div className="w-14 shrink-0 rounded-lg bg-brand-soft py-1 text-center text-brand-ink"><p className="text-lg font-bold leading-tight">{Number(e.date.slice(8))}</p><p className="text-[10px] uppercase">{DOW[new Date(e.date + 'T00:00:00Z').getUTCDay()]}</p></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{e.title}</p><p className="truncate text-xs text-muted">{[e.time, e.program, e.description].filter(Boolean).join(' · ')}</p></div>
                {e.link && <a className="btn-outline !min-h-[40px]" href={e.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Join</a>}</li>))}</ul>
          )}
        </>
      )}
    </>
  );
}
