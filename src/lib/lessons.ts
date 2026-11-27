import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { apiConfigured, callApi } from './api';
import { db } from './firebase';
import { friendlyError } from './errors';

export interface CompleteResult { alreadyCompleted: boolean; minutes: number; xp: number; tracked: boolean }

/** Records that the student opened a lesson. Uses the judge server when connected, otherwise Firestore directly (rules enforce the timing). */
export async function startLesson(uid: string, lessonId: string, courseId: string): Promise<void> {
  try {
    if (apiConfigured) { await callApi('/lesson/start', { lessonId }); return; }
    const ref = doc(db, 'lessonProgress', `${uid}_${lessonId}`);
    if (!(await getDoc(ref)).exists()) await setDoc(ref, { uid, courseId, lessonId, startedAt: serverTimestamp(), completed: false });
  } catch { /* progress tracking must never block watching a lesson */ }
}

export async function completeLesson(uid: string, lessonId: string, courseId: string): Promise<CompleteResult> {
  if (apiConfigured) {
    const r = await callApi<{ alreadyCompleted: boolean; minutes: number; xp: number }>('/lesson/complete', { lessonId });
    return { ...r, tracked: true };
  }
  const ref = doc(db, 'lessonProgress', `${uid}_${lessonId}`);
  try {
    let snap = await getDoc(ref);
    if (!snap.exists()) { await setDoc(ref, { uid, courseId, lessonId, startedAt: serverTimestamp(), completed: false }); snap = await getDoc(ref); }
    if (snap.data()?.completed === true) return { alreadyCompleted: true, minutes: 0, xp: 0, tracked: false };
    await updateDoc(ref, { completed: true, completedAt: serverTimestamp() });
    return { alreadyCompleted: false, minutes: 0, xp: 0, tracked: false };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'permission-denied') throw new Error('Please spend a little more time on this lesson, then try again.');
    throw new Error(friendlyError(e));
  }
}
