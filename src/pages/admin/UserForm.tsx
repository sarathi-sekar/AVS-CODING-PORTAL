import { useEffect, useState, type FormEvent } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { fetchDepartments } from '../../lib/departments';
import { fetchAcademic, DEFAULT_YEARS } from '../../lib/academic';
import { createManagedUser } from '../../lib/accounts';
import { friendlyError } from '../../lib/errors';
import { passwordStrength } from '../../lib/password';
import { ROLE_LABEL, type Role, type UserProfile } from '../../types';
import { PasswordMeter } from '../../components/PasswordMeter';
import { ErrorNote, Modal } from '../../components/ui';

/** Add a new account (admin-created) or edit an existing user's college details. */
export function UserForm({ existing, onClose, onDone }: { existing?: UserProfile; onClose: () => void; onDone: (msg: string) => void }) {
  const [depts, setDepts] = useState<string[]>([]);
  const [years, setYears] = useState(DEFAULT_YEARS);
  const [sections, setSections] = useState<string[]>([]);
  const [f, setF] = useState({
    displayName: existing?.displayName ?? '', email: existing?.email ?? '', password: '', registerNumber: existing?.registerNumber ?? '', department: existing?.department ?? '',
    academicYear: existing?.academicYear ?? DEFAULT_YEARS[0], section: existing?.section ?? '', role: (existing?.role ?? 'student') as Role, sendReset: true,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { Promise.all([fetchDepartments(), fetchAcademic()]).then(([d, a]) => { setDepts(d.map((x) => x.name)); setYears(a.years); setSections(a.sections); }).catch((e) => setErr(friendlyError(e))); }, []);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const staff = f.role !== 'student';
  const deptOptions = existing && f.department && !depts.includes(f.department) ? [f.department, ...depts] : depts;

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (!existing && !passwordStrength(f.password).ok) return setErr('Choose a stronger password: at least 8 characters with letters and numbers.');
    setBusy(true);
    try {
      if (existing) {
        await updateDoc(doc(db, 'users', existing.uid), { displayName: f.displayName.trim(), department: f.department, academicYear: f.academicYear, section: f.section.trim().toUpperCase(), role: f.role, updatedAt: serverTimestamp() });
        onDone('User updated.');
      } else {
        await createManagedUser({ displayName: f.displayName, email: f.email, password: f.password, registerNumber: f.registerNumber, department: f.department, academicYear: f.academicYear, section: f.section, role: f.role, status: 'active', sendReset: f.sendReset });
        onDone(`Account created for ${f.email.trim()}. They can log in now${f.sendReset ? ' (a password reset email was also sent).' : '.'}`);
      }
    } catch (x) { setErr(friendlyError(x)); } finally { setBusy(false); }
  };

  return (
    <Modal title={existing ? `Edit ${existing.displayName}` : 'Add user'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="u-n">Full name</label><input id="u-n" className="input" required minLength={2} value={f.displayName} onChange={(e) => set('displayName', e.target.value)} /></div>
          <div><label className="label" htmlFor="u-r">{staff ? 'Staff / register ID' : 'Register number'}</label><input id="u-r" className="input" required disabled={Boolean(existing)} minLength={2} maxLength={20} pattern="[A-Za-z0-9]+" value={f.registerNumber} onChange={(e) => set('registerNumber', e.target.value)} /></div>
        </div>
        {!existing && <div><label className="label" htmlFor="u-e">Email</label><input id="u-e" type="email" className="input" required value={f.email} onChange={(e) => set('email', e.target.value)} /></div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="u-ro">Role</label><select id="u-ro" className="input" value={f.role} onChange={(e) => set('role', e.target.value as Role)}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
          <div><label className="label" htmlFor="u-d">Department</label><select id="u-d" className="input" required value={f.department} onChange={(e) => set('department', e.target.value)}><option value="">Select</option>{deptOptions.map((d) => <option key={d}>{d}</option>)}</select></div>
        </div>
        {!staff && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="u-y">Academic year</label><select id="u-y" className="input" value={f.academicYear} onChange={(e) => set('academicYear', e.target.value)}>{years.map((y) => <option key={y}>{y}</option>)}</select></div>
            <div><label className="label" htmlFor="u-s">Section</label>{sections.length > 0 ? <select id="u-s" className="input" required value={f.section} onChange={(e) => set('section', e.target.value)}><option value="">Select</option>{sections.map((x) => <option key={x}>{x}</option>)}</select> : <input id="u-s" className="input" required maxLength={3} value={f.section} onChange={(e) => set('section', e.target.value)} />}</div>
          </div>
        )}
        {!existing && (
          <>
            <div><label className="label" htmlFor="u-p">Temporary password</label><input id="u-p" type="text" className="input" required minLength={8} autoComplete="off" value={f.password} onChange={(e) => set('password', e.target.value)} /><PasswordMeter password={f.password} /></div>
            <label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" checked={f.sendReset} onChange={(e) => set('sendReset', e.target.checked)} /> Also email a password-reset link so they can choose their own</label>
          </>
        )}
        {err && <ErrorNote message={err} />}
        <div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Saving...' : existing ? 'Save changes' : 'Create account'}</button></div>
      </form>
    </Modal>
  );
}
