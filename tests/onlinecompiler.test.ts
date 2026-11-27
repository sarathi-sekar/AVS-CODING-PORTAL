import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlineCompiler, mapOnlineCompilerResult, DEFAULT_COMPILER_IDS } from '../worker/src/onlinecompiler';
import { handleSubmit, handlePracticeStart, type Actor, type Deps } from '../worker/src/core';
import { classifyRun, aggregateVerdict } from '../src/shared/verdict';
import type { LanguageId } from '../src/shared/languages';
import { LocalJudge, MemoryStore } from './helpers';

const req = (language: LanguageId) => ({ language, code: 'x', stdin: '', timeLimitMs: 2000, memoryLimitKb: 262144 });

test('maps OnlineCompiler.io results to verdict inputs', () => {
  const ok = mapOnlineCompilerResult(req('python'), { output: '5\n', error: '', exit_code: 0, time: '0.03', memory: '13296' });
  assert.equal(classifyRun(ok, '5', 262144), 'passed');
  const wa = mapOnlineCompilerResult(req('python'), { output: '6\n', exit_code: 0, time: '0.03', memory: '1000' });
  assert.equal(classifyRun(wa, '5', 262144), 'wrong_answer');
  const ce = mapOnlineCompilerResult(req('c'), { output: '', error: 'a.c:1:11: error: expected declaration specifiers', exit_code: 1, time: '0.1', memory: '2000' });
  assert.equal(ce.statusId, 6); assert.ok(ce.compileOutput.includes('error:'));
  assert.equal(mapOnlineCompilerResult(req('python'), { error: '  File "a.py", line 1\nSyntaxError: invalid syntax', exit_code: 1, time: '0.02', memory: '900' }).statusId, 6);
  assert.equal(mapOnlineCompilerResult(req('java'), { error: 'Main.java:1: error: illegal start of type', exit_code: 1, time: '0.5', memory: '9000' }).statusId, 6);
  assert.equal(mapOnlineCompilerResult(req('java'), { error: 'Exception in thread "main" java.lang.RuntimeException: x', exit_code: 1, time: '0.5', memory: '9000' }).statusId, 11);
  assert.equal(mapOnlineCompilerResult(req('c'), { error: 'Segmentation fault', exit_code: 139, signal: 'SIGSEGV', time: '0.01', memory: '900' }).statusId, 11);
  const tle = mapOnlineCompilerResult(req('python'), { exit_code: 124, time: '2.0', memory: '900' });
  assert.equal(classifyRun(tle, '', 262144), 'time_limit');
  const mle = mapOnlineCompilerResult(req('python'), { exit_code: 137, time: '0.4', memory: '262000' });
  assert.equal(classifyRun(mle, '', 262144), 'memory_limit');
  assert.equal(aggregateVerdict(['passed', 'time_limit']), 'partial');
});

test('adapter sends the key as a header only, uses the documented endpoint, handles 401/429', async () => {
  let seen: { url: string; auth: string | null; body: Record<string, unknown> } | null = null;
  const f = (async (url: string, init: RequestInit) => {
    seen = { url, auth: new Headers(init.headers).get('authorization'), body: JSON.parse(String(init.body)) };
    return new Response(JSON.stringify({ output: '9\n', exit_code: 0, time: '0.01', memory: '1000' }), { status: 200 });
  }) as unknown as typeof fetch;
  const oc = new OnlineCompiler({ apiKey: 'SECRET' }, f);
  const r = await oc.run({ ...req('python'), stdin: '4 5' });
  assert.equal(r.statusId, 3);
  assert.equal(seen!.url, 'https://api.onlinecompiler.io/api/run-code-sync/');
  assert.equal(seen!.auth, 'Bearer SECRET');
  assert.equal(seen!.body.compiler, DEFAULT_COMPILER_IDS.python);
  assert.equal(seen!.body.input, '4 5');
  assert.ok(!JSON.stringify(seen!.body).includes('SECRET'));
  const r401 = await new OnlineCompiler({ apiKey: 'k' }, (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch).run(req('python'));
  assert.equal(r401.statusId, 13);
  const r429 = await new OnlineCompiler({ apiKey: 'k' }, (async () => new Response('{}', { status: 429 })) as unknown as typeof fetch).run(req('python'));
  assert.equal(r429.statusId, 13);
  const down = await new OnlineCompiler({ apiKey: 'k' }, (async () => { throw new Error('net'); }) as unknown as typeof fetch).run(req('python'));
  assert.equal(down.statusId, 13);
});

// A fake OnlineCompiler.io server that really compiles/runs code locally, so the whole submit flow is exercised.
function fakeApi(local: LocalJudge): typeof fetch {
  const byId = Object.fromEntries(Object.entries(DEFAULT_COMPILER_IDS).map(([l, id]) => [id, l])) as Record<string, LanguageId>;
  return (async (_u: string, init: RequestInit) => {
    const b = JSON.parse(String(init.body)) as { compiler: string; code: string; input: string; time_limit: number; memory_limit: number };
    const r = await local.run({ language: byId[b.compiler], code: b.code, stdin: b.input, timeLimitMs: b.time_limit * 1000, memoryLimitKb: b.memory_limit * 1024 });
    const json = r.statusId === 6 ? { output: '', error: r.compileOutput, exit_code: 1, time: '0.1', memory: '2000' }
      : r.statusId === 5 ? { output: '', error: '', exit_code: 124, time: String(b.time_limit), memory: '2000' }
        : r.statusId === 11 ? { output: r.stdout, error: r.stderr, exit_code: 1, time: String(r.timeMs / 1000), memory: '2000' }
          : { output: r.stdout, error: '', exit_code: 0, time: String(r.timeMs / 1000), memory: '2000' };
    return new Response(JSON.stringify(json), { status: 200 });
  }) as unknown as typeof fetch;
}

test('full submit flow through the OnlineCompiler adapter (real local execution behind a fake API)', async () => {
  const store = new MemoryStore(); let t = new Date('2026-11-21T04:00:00Z').getTime();
  const deps: Deps = { store, now: () => new Date(t), enabled: ['python', 'c', 'cpp'], judge: new OnlineCompiler({ apiKey: 'k' }, fakeApi(new LocalJudge())) };
  const actor: Actor = { uid: 'u1', displayName: 'T', department: 'CSE', role: 'student' };
  store.put('questions/q1', { title: 'Add', difficulty: 'easy', topic: 'Basics', status: 'published', languages: ['python', 'c', 'cpp'], timeLimitMs: 1000, memoryLimitKb: 262144, visibleTests: [{ input: '1 2', expected: '3' }] });
  store.put('questionTests/q1', { hidden: [{ input: '5 5', expected: '10' }, { input: '777 888', expected: '1665' }] });
  await handlePracticeStart(deps, actor, { questionId: 'q1' });
  t += 11 * 60000;
  const ok = await handleSubmit(deps, actor, { questionId: 'q1', language: 'python', code: 'a,b=map(int,input().split())\nprint(a+b)' });
  assert.equal(ok.verdict, 'accepted');
  assert.ok(!JSON.stringify(ok).includes('1665'));
  t += 10000;
  const ce = await handleSubmit(deps, actor, { questionId: 'q1', language: 'c', code: 'int main( {' });
  assert.equal(ce.verdict, 'compile_error');
  t += 10000;
  const tle = await handleSubmit(deps, actor, { questionId: 'q1', language: 'python', code: 'while True: pass' });
  assert.equal(tle.verdict, 'time_limit');
  assert.equal((await store.get('streaks/u1'))!.totalSolved, 1);
});
