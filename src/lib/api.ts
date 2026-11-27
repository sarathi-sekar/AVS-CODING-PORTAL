import { auth } from './firebase';
import type { LanguageId } from '../shared/languages';

const BASE = ((import.meta.env.VITE_JUDGE_API_URL as string | undefined) ?? '').replace(/\/$/, '');
export const apiConfigured = BASE !== '';

export async function callApi<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!apiConfigured) throw new Error('The judge service is not configured yet. Ask the admin to finish the judge setup.');
  const user = auth.currentUser;
  if (!user) throw new Error('Please log in again.');
  const token = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Cannot reach the server. Check your internet connection and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export async function fetchEnabledLanguages(): Promise<LanguageId[]> {
  if (!apiConfigured) return [];
  try {
    const res = await fetch(`${BASE}/languages`);
    const j = (await res.json()) as { enabled?: LanguageId[] };
    return j.enabled ?? [];
  } catch {
    return [];
  }
}

export type TestStatus = 'passed' | 'wrong_answer' | 'runtime_error' | 'time_limit' | 'memory_limit' | 'compile_error' | 'internal_error';
export interface VisibleResult { index: number; status: TestStatus; input: string; expected: string; actual: string; stderr: string; timeMs: number }
export interface HiddenResult { index: number; status: TestStatus; timeMs: number }
export interface RunVisibleResponse { kind: 'visible'; verdict: string; passed: number; total: number; compileOutput: string; tests: VisibleResult[] }
export interface RunCustomResponse { kind: 'custom'; status: TestStatus; stdout: string; stderr: string; compileOutput: string; timeMs: number; memoryKb: number }
export interface SubmitResponse {
  submissionId: string; verdict: string; passed: number; total: number; visible: VisibleResult[]; hidden: HiddenResult[]; compileOutput: string;
  timeMs: number; memoryKb: number; xp: number; bonusXp: number; firstSolve: boolean; newBadges: string[]; minutes: number;
}
