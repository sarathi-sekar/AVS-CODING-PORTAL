import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Clock, Ban, Settings, UserCog } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { firebaseConfigured } from '../lib/firebase';
import { fetchDepartments } from '../lib/departments';
import { fetchAcademic, DEFAULT_YEARS } from '../lib/academic';
import { friendlyError } from '../lib/errors';
import { isSetupOpen } from '../lib/accounts';
import type { Role } from '../types';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { ErrorNote, Spinner } from './ui';

function Frame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="absolute right-3 top-3"><ThemeToggle /></div>
      <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-card border border-line bg-surface p-6 text-center`}>
        <Logo className="mx-auto mb-4 h-14 w-14" />
        {children}
      </div>
    </div>
  );
}

function Notice({ icon, title, children, extra }: { icon: ReactNode; title: string; children: ReactNode; extra?: ReactNode }) {
  const { logout, user } = useAuth();
  return (
    <Frame>
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-ink">{icon}</div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="mt-2 text-sm text-muted">{children}</div>
      {extra}
      {user && <button type="button" onClick={() => void logout()} className="btn-outline mt-4 w-full">Log out</button>}
    </Frame>
  );
}

export function SetupRequired() {
  return <Notice icon={<Settings className="h-5 w-5" />} title="Firebase setup required"><p>Copy <code>.env.example</code> to <code>.env</code>, fill in the Firebase web app keys and restart. Steps are in <code>FIREBASE_SETUP.md</code>.</p></Notice>;
}

/** Loading screen that explains itself if it takes too long instead of spinning forever. */
export function Splash({ message }: { message: string }) {
  const { logout, user } = useAuth();
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(t); }, []);
  return (
    <Frame>
      <Spinner label={message} />
      {slow && (
        <div className="mt-2 space-y-3 text-sm text-muted">
          <p>This is taking longer than usual. Check your internet connection. If it keeps happening, the Firestore database may not be created or its rules not published (see FIREBASE_SETUP.md).</p>
          <div className="flex gap-2"><button type="button" className="btn-primary flex-1" onClick={() => window.location.reload()}>Retry</button>{user && <button type="button" className="btn-outline flex-1" onClick={() => void logout()}>Log out</button>}</div>
        </div>
      )}
    </Frame>
  );
}

/** Shown when someone has a login but no profile (for example, an interrupted registration). */
function CompleteProfile() {
  const { user, completeProfile, logout } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [regNo, setRegNo] = useState('');
  const [dept, setDept] = useState('');
  const [year, setYear] = useState(DEFAULT_YEARS[0]);
  const [section, setSection] = useState('');
  const [departments, setDepartments] = useState<string[] | null>(null);
  const [years, setYears] = useState(DEFAULT_YEARS);
  const [sections, setSections] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  useEffect(() => {
    Promise.all([fetchDepartments(), fetchAcademic()]).then(([d, a]) => { setDepartments(d.map((x) => x.name)); setYears(a.years); setSections(a.sections); setYear(a.years[0]); }).catch(() => setDepartments([]));
    isSetupOpen().then(setSetup).catch(() => undefined);
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await completeProfile({ displayName: name, registerNumber: regNo, department: dept, academicYear: year, section }); } catch (x) { setErr(friendlyError(x)); } finally { setBusy(false); }
  };
  return (
    <Frame wide>
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-ink"><UserCog className="h-5 w-5" /></div>
      <h1 className="text-lg font-semibold">Complete your profile</h1>
      <p className="mt-1 text-sm text-muted">Your login ({user?.email}) has no student details yet. Fill them in to continue.</p>
      <form onSubmit={submit} className="mt-4 space-y-3 text-left">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="cp-n">Full name</label><input id="cp-n" className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="label" htmlFor="cp-r">Register number</label><input id="cp-r" className="input" required minLength={4} maxLength={20} pattern="[A-Za-z0-9]+" value={regNo} onChange={(e) => setRegNo(e.target.value)} /></div>
        </div>
        <div><label className="label" htmlFor="cp-d">Department</label><select id="cp-d" className="input" required value={dept} onChange={(e) => setDept(e.target.value)}><option value="">{departments === null ? 'Loading...' : 'Select department'}</option>{(departments ?? []).map((d) => <option key={d}>{d}</option>)}</select>
          {departments?.length === 0 && <p className="mt-1 text-xs text-red-600">No departments exist yet. The admin must add them first.</p>}</div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="cp-y">Academic year</label><select id="cp-y" className="input" value={year} onChange={(e) => setYear(e.target.value)}>{years.map((y) => <option key={y}>{y}</option>)}</select></div>
          <div><label className="label" htmlFor="cp-s">Section</label>{sections.length > 0 ? <select id="cp-s" className="input" required value={section} onChange={(e) => setSection(e.target.value)}><option value="">Select</option>{sections.map((x) => <option key={x}>{x}</option>)}</select> : <input id="cp-s" className="input" required maxLength={3} value={section} onChange={(e) => setSection(e.target.value)} />}</div>
        </div>
        {err && <ErrorNote message={err} />}
        <button className="btn-primary w-full" disabled={busy || !departments?.length}>{busy ? 'Saving...' : 'Save and continue'}</button>
      </form>
      {setup && <p className="mt-3 text-xs text-muted">Are you the portal owner? <Link to="/setup" className="font-medium text-brand-ink hover:underline">Make this account the admin</Link></p>}
      <button type="button" onClick={() => void logout()} className="btn-outline mt-3 w-full">Log out</button>
    </Frame>
  );
}

/** Requires a signed-in, approved account. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, profile, loading, registering } = useAuth();
  const location = useLocation();
  const [setup, setSetup] = useState(false);
  const pending = profile?.status === 'pending';
  useEffect(() => { if (pending) isSetupOpen().then(setSetup).catch(() => undefined); }, [pending]);

  if (!firebaseConfigured) return <SetupRequired />;
  if (registering) return <Splash message="Creating your account" />;
  if (loading) return <Splash message="Loading your account" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile) return <CompleteProfile />;
  if (profile.status === 'pending') {
    return (
      <Notice icon={<Clock className="h-5 w-5" />} title="Waiting for approval"
        extra={setup ? <p className="mt-3 text-xs text-muted">Portal owner? <Link to="/setup" className="font-medium text-brand-ink hover:underline">Make this account the admin</Link></p> : undefined}>
        <p>Your account has been created. An admin must approve it before you can use the portal. This page updates by itself once you are approved.</p>
      </Notice>
    );
  }
  if (profile.status === 'suspended') return <Notice icon={<Ban className="h-5 w-5" />} title="Account suspended"><p>Your account is suspended. Please contact the college admin.</p></Notice>;
  return <>{children}</>;
}

/** Route-level role check. The real enforcement is in Firestore rules; this only keeps the UI honest. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile } = useAuth();
  if (!profile || !roles.includes(profile.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

