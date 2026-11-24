import { initializeApp, deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db, firebaseOptions } from './firebase';
import { withTimeout } from './async';
import type { AccountStatus, Role } from '../types';

export interface ProfileInput { displayName: string; registerNumber: string; department: string; academicYear: string; section: string }
const SLOW = 'The server is taking too long. Check your internet connection. If it keeps happening, the admin must create the Firestore database and publish the security rules (see FIREBASE_SETUP.md).';

export const normRegNo = (v: string) => v.trim().toUpperCase();

/** Throws a friendly error if the register number is already taken. */
export async function assertRegisterNumberFree(regNo: string): Promise<void> {
  const s = await withTimeout(getDoc(doc(db, 'registerNumbers', regNo)), 15000, SLOW);
  if (s.exists()) throw new Error('This register number is already registered. Contact the admin if this is a mistake.');
}

/** Creates the users/ and registerNumbers/ documents for the signed-in user (pending student). */
export async function createStudentProfile(uid: string, email: string, p: ProfileInput): Promise<void> {
  const regNo = normRegNo(p.registerNumber);
  await assertRegisterNumberFree(regNo);
  const batch = writeBatch(db);
  batch.set(doc(db, 'registerNumbers', regNo), { uid, createdAt: serverTimestamp() });
  batch.set(doc(db, 'users', uid), {
    displayName: p.displayName.trim(), email: email.trim().toLowerCase(), registerNumber: regNo, department: p.department,
    academicYear: p.academicYear, section: p.section.trim().toUpperCase(), role: 'student', status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await withTimeout(batch.commit(), 20000, SLOW);
}

/** First-time setup: makes `uid` the admin and closes the setup window (rules allow this only once). */
export async function claimAdmin(uid: string, email: string, name: string, exists: boolean): Promise<void> {
  const batch = writeBatch(db);
  if (exists) batch.update(doc(db, 'users', uid), { role: 'admin', status: 'active', updatedAt: serverTimestamp() });
  else batch.set(doc(db, 'users', uid), { displayName: name.trim(), email: email.trim().toLowerCase(), registerNumber: 'ADMIN', department: 'Administration', academicYear: '-', section: '-', role: 'admin', status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(db, 'system', 'bootstrap'), { createdAt: serverTimestamp() });
  try { await withTimeout(batch.commit(), 20000, SLOW); }
  catch (e) {
    if ((e as { code?: string }).code === 'permission-denied') throw new Error('Setup is already complete, or the Firestore rules have not been published yet.');
    throw e;
  }
}

export async function isSetupOpen(): Promise<boolean> {
  const s = await withTimeout(getDoc(doc(db, 'system', 'bootstrap')), 10000, SLOW);
  return !s.exists();
}

export interface ManagedUserInput extends ProfileInput { email: string; password: string; role: Role; status: AccountStatus; sendReset: boolean }

/**
 * Admin creates an account for someone else. A second, temporary Firebase app instance is used so the
 * admin stays signed in on the main app.
 */
export async function createManagedUser(i: ManagedUserInput): Promise<void> {
  const secondary = initializeApp(firebaseOptions, `create-${Date.now()}`);
  try {
    const sAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(sAuth, i.email.trim(), i.password);
    await updateProfile(cred.user, { displayName: i.displayName.trim() }).catch(() => undefined);
    await signOut(sAuth).catch(() => undefined);
    const regNo = normRegNo(i.registerNumber);
    const batch = writeBatch(db);
    batch.set(doc(db, 'registerNumbers', regNo), { uid: cred.user.uid, createdAt: serverTimestamp() });
    batch.set(doc(db, 'users', cred.user.uid), {
      displayName: i.displayName.trim(), email: i.email.trim().toLowerCase(), registerNumber: regNo, department: i.department,
      academicYear: i.academicYear, section: i.section.trim().toUpperCase(), role: i.role, status: i.status, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await withTimeout(batch.commit(), 20000, SLOW);
    if (i.sendReset) await sendPasswordResetEmail(auth, i.email.trim()).catch(() => undefined);
  } finally {
    await deleteApp(secondary).catch(() => undefined);
  }
}

export { SLOW as SLOW_MESSAGE };
