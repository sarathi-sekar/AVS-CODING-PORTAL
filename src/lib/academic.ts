import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { CATEGORIES } from '../types';
import { CURRICULUM, topicSlug } from '../shared/skills';

export interface Category { id: string; label: string }
export interface AcademicConfig { years: string[]; sections: string[]; categories: Category[]; topics: string[] }

/** Starting values, used only until the admin saves their own lists on the Academic setup page. */
export const DEFAULT_YEARS = ['I Year', 'II Year', 'III Year', 'IV Year'];
export const DEFAULT_CATEGORIES: Category[] = Object.entries(CATEGORIES).map(([id, label]) => ({ id, label }));
export const DEFAULT_TOPICS: string[] = [...CURRICULUM];
export const DEFAULT_ACADEMIC: AcademicConfig = { years: DEFAULT_YEARS, sections: [], categories: DEFAULT_CATEGORIES, topics: DEFAULT_TOPICS };

const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export async function fetchAcademic(): Promise<AcademicConfig> {
  const s = await getDoc(doc(db, 'config', 'academic'));
  const d = s.data() as Record<string, unknown> | undefined;
  const years = list(d?.years); const topics = list(d?.topics);
  const cats = Array.isArray(d?.categories) ? (d!.categories as unknown[]).filter((c): c is Category => typeof c === 'object' && c !== null && typeof (c as Category).id === 'string' && typeof (c as Category).label === 'string') : [];
  return { years: years.length ? years : DEFAULT_YEARS, sections: list(d?.sections), categories: cats.length ? cats : DEFAULT_CATEGORIES, topics: topics.length ? topics : DEFAULT_TOPICS };
}
export async function saveAcademic(c: AcademicConfig): Promise<void> {
  await setDoc(doc(db, 'config', 'academic'), c);
  cached = null;
}

let cached: Promise<AcademicConfig> | null = null;
export function loadAcademic(): Promise<AcademicConfig> {
  if (!cached) cached = fetchAcademic().catch(() => { cached = null; return DEFAULT_ACADEMIC; });
  return cached;
}

/** Admin-managed lists (years, sections, test categories, practice topics). Shows sensible defaults instantly, then the saved lists. */
export function useAcademic(): AcademicConfig {
  const [cfg, setCfg] = useState<AcademicConfig>(DEFAULT_ACADEMIC);
  useEffect(() => { let off = false; void loadAcademic().then((c) => !off && setCfg(c)); return () => { off = true; }; }, []);
  return cfg;
}

export const categoryLabel = (cfg: AcademicConfig, id: string): string => cfg.categories.find((c) => c.id === id)?.label ?? CATEGORIES[id] ?? id.replace(/_/g, ' ');
export const labelToCategory = (label: string, existing: Category[]): Category => existing.find((c) => c.label === label) ?? { id: topicSlug(label), label };
