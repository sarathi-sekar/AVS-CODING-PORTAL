import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface Features { storage: boolean }

/** File upload needs Cloud Storage for Firebase, which requires the Blaze plan. The admin switches it on once it is available. */
export async function fetchFeatures(): Promise<Features> {
  try { const s = await getDoc(doc(db, 'config', 'features')); return { storage: s.data()?.storage === true }; } catch { return { storage: false }; }
}
export async function saveFeatures(f: Features): Promise<void> { await setDoc(doc(db, 'config', 'features'), f); }

export interface UploadResult { url: string; path: string }

export async function uploadFile(folder: string, file: File, onProgress: (pct: number) => void): Promise<UploadResult> {
  const { getStorage, ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
  const { getApp } = await import('firebase/app');
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${folder}/${Date.now()}_${safe}`;
  const r = ref(getStorage(getApp()), path);
  const task = uploadBytesResumable(r, file, { contentType: file.type || undefined });
  await new Promise<void>((resolve, reject) => {
    task.on('state_changed', (s) => onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)), reject, () => resolve());
  });
  return { url: await getDownloadURL(r), path };
}

export async function deleteUploaded(path: string | undefined): Promise<void> {
  if (!path) return;
  try {
    const { getStorage, ref, deleteObject } = await import('firebase/storage');
    const { getApp } = await import('firebase/app');
    await deleteObject(ref(getStorage(getApp()), path));
  } catch { /* already gone or storage not enabled */ }
}

export const MAX_UPLOAD_MB = 500;
export function uploadProblem(file: File, kind: 'video' | 'document'): string | null {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `File is larger than ${MAX_UPLOAD_MB} MB.`;
  if (kind === 'video' && !file.type.startsWith('video/')) return 'Please choose a video file (mp4, webm...).';
  return null;
}
