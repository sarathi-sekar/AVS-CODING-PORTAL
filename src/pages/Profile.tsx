import { useState, type FormEvent } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/errors';
import { ROLE_LABEL } from '../types';
import { Avatar, ErrorNote, PageHeader, SuccessNote } from '../components/ui';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

export default function Profile() {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [section, setSection] = useState(profile?.section ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  if (!profile) return null;

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setOk('');
    setBusy(true);
    try {
      const n = name.trim();
      const s = section.trim().toUpperCase();
      await updateDoc(doc(db, 'users', profile.uid), { displayName: n, section: s, updatedAt: serverTimestamp() });
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: n });
      setOk('Profile updated.');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Profile" subtitle="Your account details." />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={profile.displayName} size={56} />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{profile.displayName}</p>
              <p className="text-sm text-muted">{ROLE_LABEL[profile.role]}</p>
            </div>
          </div>
          <dl>
            <Row label="Email" value={profile.email} />
            <Row label="Register number" value={profile.registerNumber} />
            <Row label="Department" value={profile.department} />
            <Row label="Academic year" value={profile.academicYear} />
            <Row label="Section" value={profile.section} />
            <Row label="Account status" value={profile.status === 'active' ? 'Active' : profile.status} />
          </dl>
        </section>
        <section className="card">
          <h2 className="h-section mb-3">Edit details</h2>
          <form onSubmit={onSave} className="space-y-4">
            <div>
              <label className="label" htmlFor="p-name">Full name</label>
              <input id="p-name" className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="p-sec">Section</label>
              <input id="p-sec" className="input" required maxLength={3} value={section} onChange={(e) => setSection(e.target.value)} />
            </div>
            <p className="text-xs text-muted">Email, register number, department and year are managed by the college admin.</p>
            {error && <ErrorNote message={error} />}
            {ok && <SuccessNote message={ok} />}
            <button type="submit" disabled={busy} className="btn-primary w-full sm:w-auto">{busy ? 'Saving...' : 'Save changes'}</button>
          </form>
        </section>
      </div>
    </>
  );
}
