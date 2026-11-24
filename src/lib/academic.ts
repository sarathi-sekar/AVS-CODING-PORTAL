import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface AcademicConfig { years: string[]; sections: string[] }
/** Used only until the admin saves their own list on the Academic setup page. */
export const DEFAULT_YEARS = ['I Year', 'II Year', 'III Year', 'IV Year'];

export async function fetchAcademic(): Promise<AcademicConfig> {
  const s = await getDoc(doc(db, 'config', 'academic'));
  const d = s.data() as Partial<AcademicConfig> | undefined;
  const years = Array.isArray(d?.years) && d.years.length > 0 ? d.years : DEFAULT_YEARS;
  const sections = Array.isArray(d?.sections) ? d.sections : [];
  return { years, sections };
}
export async function saveAcademic(c: AcademicConfig): Promise<void> {
  await setDoc(doc(db, 'config', 'academic'), c);
}
