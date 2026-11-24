import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, deleteUser } from 'firebase/auth';
import { ShieldCheck } from 'lucide-react';
import { auth } from '../lib/firebase';
import { firebaseConfigured } from '../lib/firebase';
import { claimAdmin, isSetupOpen } from '../lib/accounts';
import { friendlyError } from '../lib/errors';
import { passwordStrength } from '../lib/password';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { PasswordMeter } from '../components/PasswordMeter';
import { ErrorNote, Spinner } from '../components/ui';
import { SetupRequired } from '../components/Guards';

/** One-time page: the first account created here becomes the admin. After that it closes itself. */
export default function Setup() {
  const { user, profile, loading } = useAuth();
  const [state, setState] = useState<'checking' | 'open' | 'closed' | 'error'>('checking');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => { if (firebaseConfigured) isSetupOpen().then((o) => setState(o ? 'open' : 'closed')).catch((e) => { setErr(friendlyError(e)); setState('error'); }); }, []);
  if (!firebaseConfigured) return <SetupRequired />;
  if (done && profile?.role === 'admin') return <Navigate to="/" replace />;

  const claimExisting = async () => {
    if (!user) return;
    setBusy(true); setErr('');
    try { await claimAdmin(user.uid, user.email ?? '', profile?.displayName ?? user.displayName ?? 'Admin', Boolean(profile)); setDone(true); } catch (e) { setErr(friendlyError(e)); } finally { setBusy(false); }
  };
  const createFirst = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (!passwordStrength(pw).ok) return setErr('Choose a stronger password: at least 8 characters with letters and numbers.');
    setBusy(true);
    let created = false;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
      created = true;
      await updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
      await claimAdmin(cred.user.uid, email, name, false);
      setDone(true);
    } catch (x) {
      if (created && auth.currentUser) await deleteUser(auth.currentUser).catch(() => undefined);
      setErr(friendlyError(x));
    } finally { setBusy(false); }
  };

  return (
    <AuthShell>
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ShieldCheck className="h-6 w-6 text-brand-ink" /> First-time setup</h1>
      {state === 'checking' || loading || busy ? <Spinner label={busy ? 'Setting up' : 'Checking'} /> : state === 'error' ? (
        <div className="mt-4 space-y-3"><ErrorNote message={err || 'Cannot reach the database.'} /><p className="text-sm text-muted">Create the Firestore database in the Firebase console (Build → Firestore Database) and publish the rules from <code>firestore.rules</code>. See FIREBASE_SETUP.md.</p></div>
      ) : state === 'closed' ? (
        <div className="mt-4 space-y-3"><p className="text-sm text-muted">Setup is already complete. Please log in.</p><Link to="/login" className="btn-primary w-full">Go to login</Link></div>
      ) : user ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted">You are signed in as <strong>{user.email}</strong>. Make this account the portal admin?</p>
          {err && <ErrorNote message={err} />}
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => void claimExisting()}>{busy ? 'Please wait...' : 'Make me the admin'}</button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">Create the first admin account. This works only once.</p>
          <form onSubmit={createFirst} className="mt-5 space-y-3.5">
            <div><label className="label" htmlFor="s-n">Full name</label><input id="s-n" className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="label" htmlFor="s-e">Email</label><input id="s-e" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><label className="label" htmlFor="s-p">Password</label><input id="s-p" type="password" className="input" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /><PasswordMeter password={pw} /></div>
            {err && <ErrorNote message={err} />}
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating admin...' : 'Create admin account'}</button>
          </form>
          <p className="mt-4 text-center text-xs text-muted"><Link to="/login" className="hover:underline">Back to login</Link></p>
        </>
      )}
    </AuthShell>
  );
}
