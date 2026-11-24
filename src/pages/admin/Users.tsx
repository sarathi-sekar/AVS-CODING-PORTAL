import { useMemo, useState } from 'react';
import { doc, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Download, Pencil, Search, UserPlus } from 'lucide-react';
import { db } from '../../lib/firebase';
import { usePagedUsers } from '../../lib/usePagedUsers';
import { friendlyError } from '../../lib/errors';
import { downloadCsv, toCsv } from '../../lib/csv';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABEL, type AccountStatus, type Role, type UserProfile } from '../../types';
import { EmptyState, ErrorNote, PageHeader, Spinner, SuccessNote } from '../../components/ui';
import { UserForm } from './UserForm';
import { usePendingUsers } from '../../lib/usePendingUsers';

type Tab = 'pending' | 'all';
const STATUS_STYLE: Record<AccountStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

export default function Users() {
  const { profile: me } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('');
  const [actionError, setActionError] = useState('');
  const [ok, setOk] = useState('');
  const [busyUid, setBusyUid] = useState('');
  const [form, setForm] = useState<{ existing?: UserProfile } | null>(null);

  const constraints = useMemo(() => [orderBy('createdAt', 'desc')], []);
  const paged = usePagedUsers(constraints, 'all');
  const live = usePendingUsers(); // realtime: new registrations appear instantly
  const pendingTab = tab === 'pending';
  const rows = pendingTab ? live.rows : paged.rows;
  const loading = pendingTab ? live.loading : paged.loading;
  const hasMore = !pendingTab && paged.hasMore;
  const error = pendingTab ? live.error : paged.error;
  const { loadMore, patch, reload } = paged;

  const update = async (u: UserProfile, change: Partial<Pick<UserProfile, 'status' | 'role'>>) => {
    setActionError(''); setBusyUid(u.uid);
    try { await updateDoc(doc(db, 'users', u.uid), { ...change, updatedAt: serverTimestamp() }); patch(u.uid, change); }
    catch (e) { setActionError(friendlyError(e)); } finally { setBusyUid(''); }
  };

  const visible = rows.filter((r) => (tab !== 'pending' || r.status === 'pending') && (!roleF || r.role === roleF) &&
    (!q || `${r.displayName} ${r.email} ${r.registerNumber}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <PageHeader title="Users" subtitle="Approve registrations, create accounts for faculty and staff, assign roles."
        action={<div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" disabled={visible.length === 0} onClick={() => downloadCsv(`users-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(['Name', 'Email', 'Register no.', 'Role', 'Status', 'Department', 'Year', 'Section'], visible.map((r) => [r.displayName, r.email, r.registerNumber, ROLE_LABEL[r.role], r.status, r.department, r.academicYear, r.section])))}><Download className="h-4 w-4" /> Export (Excel / CSV)</button>
          <button type="button" className="btn-primary" onClick={() => setForm({})}><UserPlus className="h-4 w-4" /> Add user</button></div>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist">
          {(['pending', 'all'] as Tab[]).map((t) => <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={`min-h-[40px] rounded-lg px-4 text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}>{t === 'pending' ? `Pending approval${live.rows.length ? ` (${live.rows.length})` : ''}` : 'All users'}</button>)}
        </div>
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search name, email, register no." aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input !w-auto" aria-label="Filter by role" value={roleF} onChange={(e) => setRoleF(e.target.value)}><option value="">All roles</option>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
      </div>
      {(error || actionError) && <div className="mb-3"><ErrorNote message={error || actionError} /></div>}
      {ok && <div className="mb-3"><SuccessNote message={ok} /></div>}

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-line bg-subtle text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3 font-medium">User</th><th className="px-4 py-3 font-medium">Register no.</th><th className="px-4 py-3 font-medium">Dept / Year / Sec</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Actions</th></tr></thead>
            <tbody>
              {visible.map((u) => {
                const self = u.uid === me?.uid; const busy = busyUid === u.uid;
                return (
                  <tr key={u.uid} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-3"><p className="font-medium">{u.displayName}</p><p className="text-xs text-muted">{u.email}</p></td>
                    <td className="px-4 py-3">{u.registerNumber}</td>
                    <td className="px-4 py-3 text-xs">{u.department}<br />{u.academicYear} · {u.section}</td>
                    <td className="px-4 py-3"><select aria-label={`Role for ${u.displayName}`} className="input !min-h-[40px] !w-auto" disabled={self || busy} value={u.role} onChange={(e) => void update(u, { role: e.target.value as Role })}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[u.status]}`}>{u.status}</span></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2">
                      {self ? <span className="text-xs text-muted">You</span> : u.status === 'active' ? <button type="button" disabled={busy} className="btn-outline !min-h-[40px]" onClick={() => void update(u, { status: 'suspended' })}>Suspend</button> : <button type="button" disabled={busy} className="btn-primary !min-h-[40px]" onClick={() => void update(u, { status: 'active' })}>{u.status === 'pending' ? 'Approve' : 'Re-activate'}</button>}
                      <button type="button" aria-label={`Edit ${u.displayName}`} onClick={() => setForm({ existing: u })} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink"><Pencil className="h-4 w-4" /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading && <Spinner />}
        {!loading && visible.length === 0 && <EmptyState title={tab === 'pending' ? 'No pending registrations' : 'No users found'} />}
        {hasMore && !loading && <div className="border-t border-line p-3 text-center"><button type="button" className="btn-outline" onClick={() => void loadMore()}>Load more</button></div>}
      </div>
      {form && <UserForm existing={form.existing} onClose={() => setForm(null)} onDone={(m) => { setForm(null); setOk(m); void reload(); }} />}
    </>
  );
}
