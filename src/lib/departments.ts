import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';
import type { Department } from '../types';

export async function fetchDepartments(): Promise<Department[]> {
  const snap = await getDocs(query(collection(db, 'departments'), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, name: (d.data() as { name: string }).name }));
}
