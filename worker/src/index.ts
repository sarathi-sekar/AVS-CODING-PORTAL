import { isLanguageId, LANGUAGE_IDS, type LanguageId } from '../../src/shared/languages';
import { verifyFirebaseToken } from './auth';
import { FirestoreRestStore, type ServiceAccount } from './firestoreRest';
import { Judge0, type Judge } from './judge';
import { OnlineCompiler } from './onlinecompiler';
import {
  HttpError, handleAssessmentStart, handleAssessmentSubmit, handleLessonComplete, handleLessonStart, handlePracticeStart, handleRun, handleSubmit,
  type Actor, type Deps,
} from './core';
import { str, type Data } from './store';

export interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_SA_JSON: string;
  ALLOWED_ORIGINS: string;
  JUDGE_PROVIDER?: string; // 'onlinecompiler' (default) or 'judge0'
  ONLINECOMPILER_API_KEY?: string;
  ONLINECOMPILER_IDS?: string;
  JUDGE0_URL?: string;
  JUDGE0_AUTH_TOKEN?: string;
  JUDGE0_LANG_IDS?: string;
  ENABLED_LANGUAGES: string;
}

/** Best-effort per-user limiter (per Worker instance): protects the judge quota from loops and abuse. */
const hits = new Map<string, number[]>();
function allow(uid: string, path: string): boolean {
  const heavy = path === '/run' || path === '/submit';
  const key = `${uid}:${heavy ? 'h' : 'l'}`;
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= (heavy ? 20 : 120)) { hits.set(key, arr); return false; }
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return true;
}

function cors(env: Env, req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'access-control-allow-origin': allowed.includes(origin) ? origin : (allowed[0] ?? ''),
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    vary: 'origin',
  };
}

function enabledLanguages(env: Env): LanguageId[] {
  return env.ENABLED_LANGUAGES.split(',').map((s) => s.trim()).filter(isLanguageId);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = { ...cors(env, req), 'content-type': 'application/json' };
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(req.url);
    try {
      if (url.pathname === '/health') return json(200, { ok: true });
      if (url.pathname === '/languages') return json(200, { enabled: enabledLanguages(env), all: LANGUAGE_IDS });
      if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');

      const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
      if (!token) throw new HttpError(401, 'Please log in again');
      let uid: string;
      try { uid = (await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID)).uid; } catch { throw new HttpError(401, 'Your session is invalid. Please log in again'); }

      const sa = JSON.parse(env.FIREBASE_SA_JSON) as ServiceAccount;
      const store = new FirestoreRestStore(env.FIREBASE_PROJECT_ID, sa);
      const user = await store.get(`users/${uid}`);
      if (!user || str(user.status) !== 'active') throw new HttpError(403, 'Your account is not active');
      const actor: Actor = { uid, displayName: str(user.displayName), department: str(user.department), role: str(user.role) };

      let judge: Judge;
      if ((env.JUDGE_PROVIDER ?? 'onlinecompiler') === 'judge0') {
        if (!env.JUDGE0_URL) throw new HttpError(503, 'The code judge is not configured yet');
        judge = new Judge0({ baseUrl: env.JUDGE0_URL, authToken: env.JUDGE0_AUTH_TOKEN, languageIds: env.JUDGE0_LANG_IDS ? (JSON.parse(env.JUDGE0_LANG_IDS) as never) : undefined });
      } else {
        if (!env.ONLINECOMPILER_API_KEY) throw new HttpError(503, 'The code judge is not configured yet');
        judge = new OnlineCompiler({ apiKey: env.ONLINECOMPILER_API_KEY, compilerIds: env.ONLINECOMPILER_IDS ? (JSON.parse(env.ONLINECOMPILER_IDS) as never) : undefined });
      }
      const deps: Deps = { store, now: () => new Date(), enabled: enabledLanguages(env), judge };

      if (Number(req.headers.get('content-length') ?? 0) > 200_000) throw new HttpError(413, 'Request is too large');
      if (!allow(uid, url.pathname)) throw new HttpError(429, 'Too many requests. Please slow down and try again in a minute');
      const body = (await req.json().catch(() => ({}))) as Data;
      const route = url.pathname;
      if (route === '/run') return json(200, await handleRun(deps, actor, body));
      if (route === '/submit') return json(200, await handleSubmit(deps, actor, body));
      if (route === '/practice/start') return json(200, await handlePracticeStart(deps, actor, body));
      if (route === '/lesson/start') return json(200, await handleLessonStart(deps, actor, body));
      if (route === '/lesson/complete') return json(200, await handleLessonComplete(deps, actor, body));
      if (route === '/assessment/start') return json(200, await handleAssessmentStart(deps, actor, body));
      if (route === '/assessment/submit') return json(200, await handleAssessmentSubmit(deps, actor, body));
      throw new HttpError(404, 'Not found');
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      console.error(e);
      return json(500, { error: 'Something went wrong on the server. Please try again.' });
    }
  },
};
