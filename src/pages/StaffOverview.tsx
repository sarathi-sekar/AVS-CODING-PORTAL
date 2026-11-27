import { useEffect, useState } from 'react';
import { collection, doc, getCountFromServer, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardCheck, Code2, GraduationCap, Megaphone, UserCheck, Users, Building2, Trophy, type LucideIcon } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { greeting } from '../lib/date';
import { friendlyError } from '../lib/errors';
import { ROLE_LABEL, type LeaderboardEntry, type UserProfile } from '../types';
import { fetchDepartments } from '../lib/departments';
import { usePendingUsers } from '../lib/usePendingUsers';
import { Avatar, EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';

const count = async (q: ReturnType<typeof query>) => (await getCountFromServer(q)).data().count;

function Tile({ to, icon: Icon, value, label }: { to: string; icon: LucideIcon; value: number | string; label: string }) {
  return (
    <Link to={to} className="card flex items-center gap-3 !p-4 hover:bg-subtle">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="text-2xl font-semibold leading-tight">{value}</p><p className="truncate text-sm text-muted">{label}</p></div>
    </Link>
  );
}

interface Stats { students: number; faculty: number; coordinators: number; courses: number; questions: number; assessments: number; byDept: { name: string; n: number }[]; top: LeaderboardEntry[] }

export default function StaffOverview() {
  const { profile } = useAuth();
  const [s, setS] = useState<Stats | null>(null);
  const pendingLive = usePendingUsers();
  const isAdminRole = profile?.role === 'admin';
  const [error, setError] = useState('');
  const isAdmin = profile?.role === 'admin';
  const canContent = profile?.role === 'admin' || profile?.role === 'faculty';

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const u = collection(db, 'users');
        const [students, depts, top] = await Promise.all([
          count(query(u, where('role', '==', 'student'), where('status', '==', 'active'))),
          fetchDepartments(),
          getDocs(query(collection(db, 'leaderboard'), orderBy('points', 'desc'), limit(5))),
        ]);
        const byDept = await Promise.all(depts.map(async (d) => ({ name: d.name, n: await count(query(u, where('role', '==', 'student'), where('status', '==', 'active'), where('department', '==', d.name))) })));
        const extra = isAdmin ? await Promise.all([
          count(query(u, where('role', '==', 'faculty'))), count(query(u, where('role', '==', 'placement_coordinator'))),
        ]) : null;
        const content = canContent ? await Promise.all([count(query(collection(db, 'courses'))), count(query(collection(db, 'questions'))), count(query(collection(db, 'assessments')))]) : [0, 0, 0];
        if (off) return;
        setS({
          students, faculty: extra?.[0] ?? 0, coordinators: extra?.[1] ?? 0, courses: content[0], questions: content[1], assessments: content[2], byDept,
          top: top.docs.map((d) => ({ ...(d.data() as Omit<LeaderboardEntry, 'uid'>), uid: d.id })),
        });
      } catch (e) { if (!off) setError(friendlyError(e)); }
    })();
    return () => { off = true; };
  }, [isAdmin, canContent]);

  const approve = async (u: UserProfile) => {
    try { await updateDoc(doc(db, 'users', u.uid), { status: 'active', updatedAt: serverTimestamp() }); setS((x) => x && { ...x, students: x.students + (u.role === 'student' ? 1 : 0) }); }
    catch (e) { setError(friendlyError(e)); }
  };

  if (!profile) return null;
  void isAdminRole;
  const maxDept = Math.max(1, ...(s?.byDept.map((d) => d.n) ?? [1]));
  return (
    <>
      <PageHeader title={`${greeting()}, ${profile.displayName.split(' ')[0]}`} subtitle={`${ROLE_LABEL[profile.role]} dashboard`} />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      {!s && !error ? <Spinner /> : s && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile to="/students" icon={GraduationCap} value={s.students} label="Active students" />
            {isAdmin && <Tile to="/admin/users" icon={UserCheck} value={pendingLive.rows.length} label="Pending approvals" />}
            {isAdmin && <Tile to="/admin/users" icon={Users} value={s.faculty} label="Faculty" />}
            {isAdmin && <Tile to="/admin/users" icon={Users} value={s.coordinators} label="Placement coordinators" />}
            {canContent && <Tile to="/manage/content" icon={BookOpen} value={s.courses} label="Courses" />}
            {canContent && <Tile to="/manage/questions" icon={Code2} value={s.questions} label="Coding questions" />}
            <Tile to="/manage/assessments" icon={ClipboardCheck} value={s.assessments || '-'} label="Assessments" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card lg:col-span-2">
              <div className="flex items-center justify-between"><h2 className="h-section flex items-center gap-2"><Building2 className="h-4 w-4 text-brand-ink" /> Students by department</h2>{isAdmin && <Link to="/admin/departments" className="text-xs font-medium text-brand-ink">Manage</Link>}</div>
              {s.byDept.length === 0 ? <EmptyState title="No departments yet" hint={isAdmin ? 'Add departments in Academic setup so students can register.' : 'The admin has not added departments yet.'} /> : (
                <ul className="mt-3 space-y-2.5">{s.byDept.map((d) => (
                  <li key={d.name} className="flex items-center gap-3 text-sm"><span className="w-40 shrink-0 truncate sm:w-56" title={d.name}>{d.name}</span><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-brand" style={{ width: `${(d.n / maxDept) * 100}%` }} /></div><span className="w-8 text-right font-medium">{d.n}</span></li>
                ))}</ul>
              )}
            </section>
            <section className="card">
              <h2 className="h-section flex items-center gap-2"><Trophy className="h-4 w-4 text-brand-ink" /> Top performers</h2>
              {s.top.length === 0 ? <EmptyState title="No rankings yet" /> : <ol className="mt-3 space-y-2">{s.top.map((t, i) => <li key={t.uid} className="flex items-center gap-2 text-sm"><span className="w-4 text-center text-muted">{i + 1}</span><Avatar name={t.displayName} size={28} /><span className="min-w-0 flex-1 truncate">{t.displayName}</span><span className="font-medium">{t.points}</span></li>)}</ol>}
              <Link to="/leaderboard" className="mt-3 inline-block text-xs font-medium text-brand-ink">Full leaderboard</Link>
            </section>
          </div>

          {isAdmin && (
            <section className="card">
              <div className="flex items-center justify-between"><h2 className="h-section">Recent registrations awaiting approval</h2><Link to="/admin/users" className="text-xs font-medium text-brand-ink">All users</Link></div>
              {pendingLive.rows.length === 0 ? <EmptyState title="Nothing waiting for approval" /> : (
                <ul className="mt-2">{pendingLive.rows.slice(0, 5).map((u) => (
                  <li key={u.uid} className="flex flex-wrap items-center gap-3 border-b border-line py-2.5 last:border-0"><Avatar name={u.displayName} size={32} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{u.displayName} <span className="font-normal text-muted">· {u.registerNumber}</span></p><p className="truncate text-xs text-muted">{u.department} · {u.academicYear} · {u.section}</p></div><button type="button" className="btn-primary !min-h-[40px]" onClick={() => void approve(u)}>Approve</button></li>
                ))}</ul>
              )}
            </section>
          )}

          {isAdmin && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Quick actions">
              {[['/admin/users', 'Add or approve users', Users], ['/admin/departments', 'Academic setup', Building2], ['/admin/announcements', 'Post announcement', Megaphone], ['/manage/challenges', 'Schedule challenges', Trophy]].map(([to, label, Icon]) => {
                const I = Icon as LucideIcon;
                return <Link key={to as string} to={to as string} className="card flex items-center gap-3 !p-3 text-sm font-medium hover:bg-subtle"><I className="h-4 w-4 text-brand-ink" />{label as string}</Link>;
              })}
            </section>
          )}
        </div>
      )}
    </>
  );
}
