import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Mail } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '../context/AuthContext';
import { firebaseConfigured } from '../lib/firebase';
import { fetchDepartments } from '../lib/departments';
import { fetchAcademic, DEFAULT_YEARS } from '../lib/academic';
import { isSetupOpen } from '../lib/accounts';
import { friendlyError } from '../lib/errors';
import { passwordStrength } from '../lib/password';
import { AuthShell } from '../components/AuthShell';
import { PasswordMeter } from '../components/PasswordMeter';
import { ErrorNote, SuccessNote } from '../components/ui';
import { SetupRequired } from '../components/Guards';

type Mode = 'login' | 'register' | 'forgot';

export default function Login() {
  const { user, registering, login, register, resetPassword } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [setupOpen, setSetupOpen] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [dept, setDept] = useState('');
  const [year, setYear] = useState(DEFAULT_YEARS[0]);
  const [section, setSection] = useState('');
  const [departments, setDepartments] = useState<string[] | null>(null);
  const [years, setYears] = useState<string[]>(DEFAULT_YEARS);
  const [sections, setSections] = useState<string[]>([]);

  useEffect(() => { if (firebaseConfigured) isSetupOpen().then(setSetupOpen).catch(() => setSetupOpen(false)); }, []);
  useEffect(() => {
    if (!firebaseConfigured || mode !== 'register' || departments !== null) return;
    Promise.all([fetchDepartments(), fetchAcademic()]).then(([d, a]) => { setDepartments(d.map((x) => x.name)); setYears(a.years); setSections(a.sections); setYear(a.years[0]); }).catch(() => setDepartments([]));
  }, [mode, departments]);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  if (!firebaseConfigured) return <SetupRequired />;
  if (user && !registering) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  const switchMode = (m: Mode) => { setMode(m); setError(''); setInfo(''); };

  const sendReset = async () => {
    setError(''); setInfo(''); setBusy(true);
    try {
      await resetPassword(email);
      setCooldown(60);
      setInfo(`If ${email.trim()} is registered, a reset link has been sent. Check your Inbox and also the Spam / Junk folder (sender: noreply@avs-coding-portal.firebaseapp.com).`);
    } catch (err) {
      setError(err instanceof FirebaseError && err.code === 'auth/user-not-found' ? 'No account is registered with this email.' : friendlyError(err));
    } finally { setBusy(false); }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'forgot') return void sendReset();
    setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else {
        if (!dept) throw new Error('Please select your department.');
        if (!passwordStrength(password).ok) throw new Error('Choose a stronger password: at least 8 characters with letters and numbers.');
        await register({ displayName: name, email, password, registerNumber: regNo, department: dept, academicYear: year, section });
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'login' ? 'Login' : mode === 'register' ? 'Create your account' : 'Reset password';
  const sub = mode === 'login' ? 'Enter your email and password to continue.' : mode === 'register' ? 'Register with your college details. An admin will approve your account.' : 'Enter your registered email and we will send you a reset link.';
  const noDepts = mode === 'register' && departments !== null && departments.length === 0;

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">{sub}</p>

      <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
        {mode === 'register' && (
          <>
            {noDepts && <ErrorNote message="Registration is not open yet: the admin has not added any departments. Please contact the admin." />}
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div><label className="label" htmlFor="name">Full name</label><input id="name" className="input" required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><label className="label" htmlFor="regno">Register number</label><input id="regno" className="input" required minLength={4} maxLength={20} pattern="[A-Za-z0-9]+" title="Letters and numbers only" autoCapitalize="characters" value={regNo} onChange={(e) => setRegNo(e.target.value)} /></div>
            </div>
            <div>
              <label className="label" htmlFor="dept">Department</label>
              <select id="dept" className="input" required value={dept} onChange={(e) => setDept(e.target.value)} disabled={departments === null || noDepts}>
                <option value="">{departments === null ? 'Loading...' : 'Select department'}</option>
                {(departments ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div><label className="label" htmlFor="year">Academic year</label><select id="year" className="input" value={year} onChange={(e) => setYear(e.target.value)}>{years.map((y) => <option key={y}>{y}</option>)}</select></div>
              <div><label className="label" htmlFor="section">Section</label>
                {sections.length > 0 ? <select id="section" className="input" required value={section} onChange={(e) => setSection(e.target.value)}><option value="">Select</option>{sections.map((x) => <option key={x}>{x}</option>)}</select>
                  : <input id="section" className="input" required maxLength={3} autoCapitalize="characters" placeholder="A" value={section} onChange={(e) => setSection(e.target.value)} />}
              </div>
            </div>
          </>
        )}

        <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="input" required autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>

        {mode !== 'forgot' && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium" htmlFor="password">Password</label>
              {mode === 'login' && <button type="button" onClick={() => switchMode('forgot')} className="min-h-[28px] text-xs font-medium text-brand-ink hover:underline">Forgot password?</button>}
            </div>
            <div className="relative">
              <input id="password" type={showPw ? 'text' : 'password'} className="input pr-12" required minLength={mode === 'register' ? 8 : 6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted hover:text-ink">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
            {mode === 'register' && <PasswordMeter password={password} />}
          </div>
        )}

        {error && <ErrorNote message={error} />}
        {info && <SuccessNote message={info} />}

        <button type="submit" disabled={busy || (mode === 'forgot' && cooldown > 0) || noDepts} className="btn-primary w-full">
          {busy ? (mode === 'register' ? 'Creating your account...' : mode === 'login' ? 'Logging in...' : 'Sending...') : mode === 'login' ? 'Log in' : mode === 'register' ? 'Create account' : cooldown > 0 ? `Resend in ${cooldown}s` : info ? 'Resend reset link' : 'Send reset link'}
          {!busy && cooldown === 0 && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" /></div>
      {mode === 'login' ? (
        <button type="button" onClick={() => switchMode('register')} className="btn-outline w-full"><Mail className="h-4 w-4 text-brand-ink" /> New student? Create an account</button>
      ) : (
        <button type="button" onClick={() => switchMode('login')} className="btn-outline w-full">Back to login</button>
      )}
      {setupOpen && <p className="mt-4 text-center text-xs text-muted">Portal owner? <Link to="/setup" className="font-medium text-brand-ink hover:underline">Set up the first admin account</Link></p>}
    </AuthShell>
  );
}
