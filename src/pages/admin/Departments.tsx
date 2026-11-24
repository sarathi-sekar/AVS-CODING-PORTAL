import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Pencil, Trash2, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { fetchDepartments } from '../../lib/departments';
import { fetchAcademic, saveAcademic, type AcademicConfig } from '../../lib/academic';
import { fetchFeatures, saveFeatures } from '../../lib/storage';
import { friendlyError } from '../../lib/errors';
import type { Department } from '../../types';
import { EmptyState, ErrorNote, PageHeader, Spinner, SuccessNote } from '../../components/ui';

function ChipEditor({ title, hint, items, onChange, placeholder }: { title: string; hint: string; items: string[]; onChange: (v: string[]) => Promise<void>; placeholder: string }) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    const t = v.trim();
    if (!t || items.some((i) => i.toLowerCase() === t.toLowerCase())) return setV('');
    setBusy(true); try { await onChange([...items, t]); setV(''); } finally { setBusy(false); }
  };
  return (
    <section className="card">
      <h2 className="h-section">{title}</h2>
      <p className="mb-3 text-xs text-muted">{hint}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {items.length === 0 && <span className="text-sm text-muted">Nothing added yet.</span>}
        {items.map((i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full border border-line bg-subtle py-1 pl-3 pr-1 text-sm">{i}
            <button type="button" aria-label={`Remove ${i}`} disabled={busy} onClick={async () => { setBusy(true); try { await onChange(items.filter((x) => x !== i)); } finally { setBusy(false); } }} className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-line hover:text-red-600"><X className="h-3.5 w-3.5" /></button></span>
        ))}
      </div>
      <form onSubmit={add} className="flex gap-2"><input className="input" aria-label={placeholder} placeholder={placeholder} maxLength={30} value={v} onChange={(e) => setV(e.target.value)} /><button className="btn-primary" disabled={busy || !v.trim()}>Add</button></form>
    </section>
  );
}

export default function Departments() {
  const [list, setList] = useState<Department[]>([]);
  const [cfg, setCfg] = useState<AcademicConfig>({ years: [], sections: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [storageOn, setStorageOn] = useState(false);

  const load = useCallback(async () => {
    try { const [d, a, f] = await Promise.all([fetchDepartments(), fetchAcademic(), fetchFeatures()]); setList(d); setCfg(a); setStorageOn(f.storage); }
    catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => void load(), [load]);

  const flash = (m: string) => { setOk(m); setTimeout(() => setOk(''), 2500); };
  const add = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (list.some((d) => d.name.toLowerCase() === n.toLowerCase())) return setError('That department already exists.');
    setBusy(true); setError('');
    try { await addDoc(collection(db, 'departments'), { name: n, createdAt: serverTimestamp() }); setName(''); await load(); flash('Department added.'); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  };
  const rename = async (d: Department) => {
    const n = editName.trim();
    if (!n || n === d.name) return setEditId('');
    if (list.some((x) => x.id !== d.id && x.name.toLowerCase() === n.toLowerCase())) return setError('That department already exists.');
    setBusy(true); setError('');
    try { await updateDoc(doc(db, 'departments', d.id), { name: n }); setEditId(''); await load(); flash('Renamed. Existing students keep the old name until you edit them in Users.'); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  };
  const remove = async (d: Department) => {
    if (!window.confirm(`Delete "${d.name}"? Students already in it keep their stored department name.`)) return;
    setError('');
    try { await deleteDoc(doc(db, 'departments', d.id)); setList((l) => l.filter((x) => x.id !== d.id)); flash('Department deleted.'); } catch (err) { setError(friendlyError(err)); }
  };
  const saveCfg = (next: AcademicConfig) => async () => { await saveAcademic(next); setCfg(next); flash('Saved.'); };

  return (
    <>
      <PageHeader title="Academic setup" subtitle="Departments, academic years and sections shown on the registration form. Nothing here is built into the code." />
      {error && <div className="mb-3"><ErrorNote message={error} /></div>}
      {ok && <div className="mb-3"><SuccessNote message={ok} /></div>}
      {loading ? <Spinner /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card lg:row-span-2">
            <h2 className="h-section">Departments</h2>
            <p className="mb-3 text-xs text-muted">Students cannot register until at least one department exists.</p>
            <form onSubmit={add} className="mb-3 flex gap-2"><input className="input" aria-label="Department name" placeholder="e.g. Computer Science and Engineering" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /><button className="btn-primary" disabled={busy || !name.trim()}>Add</button></form>
            {list.length === 0 ? <EmptyState title="No departments yet" hint="Add your first department above." /> : (
              <ul className="rounded-xl border border-line">
                {list.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-0">
                    {editId === d.id ? (
                      <><input className="input !min-h-[40px]" aria-label="New name" autoFocus value={editName} maxLength={80} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void rename(d); if (e.key === 'Escape') setEditId(''); }} /><button type="button" className="btn-primary !min-h-[40px]" disabled={busy} onClick={() => void rename(d)}>Save</button><button type="button" className="btn-outline !min-h-[40px]" onClick={() => setEditId('')}>Cancel</button></>
                    ) : (
                      <><span className="min-w-0 flex-1 break-words text-sm">{d.name}</span>
                        <button type="button" aria-label={`Rename ${d.name}`} onClick={() => { setEditId(d.id); setEditName(d.name); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink"><Pencil className="h-4 w-4" /></button>
                        <button type="button" aria-label={`Delete ${d.name}`} onClick={() => void remove(d)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-red-600"><Trash2 className="h-4 w-4" /></button></>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <ChipEditor title="Academic years" hint="Shown in this order on the registration form." items={cfg.years} placeholder="e.g. I Year" onChange={(v) => saveCfg({ ...cfg, years: v })()} />
          <section className="card lg:col-span-2">
            <h2 className="h-section">File uploads (videos, notes)</h2>
            <p className="mb-3 text-xs text-muted">Direct uploads use Firebase Storage, which needs the Blaze (pay-as-you-go) plan. Until then, keep this off and paste video / document links (YouTube, Google Drive...). Turn it on only after you enabled Storage and deployed <code>storage.rules</code>.</p>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" className="h-5 w-5" checked={storageOn} onChange={async (e) => { const v = e.target.checked; try { await saveFeatures({ storage: v }); setStorageOn(v); flash(v ? 'Uploads enabled.' : 'Uploads disabled. Links still work.'); } catch (x) { setError(friendlyError(x)); } }} /> Allow file uploads</label>
          </section>
          <ChipEditor title="Sections" hint="Optional. If empty, students type their section (A, B, C...)." items={cfg.sections} placeholder="e.g. A" onChange={(v) => saveCfg({ ...cfg, sections: v })()} />
        </div>
      )}
    </>
  );
}
