import test from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { HttpError, handleAssessmentStart, handleAssessmentSubmit, handleLessonComplete, handleLessonStart, handlePracticeStart, handleRun, handleSubmit, type Actor, type Deps } from '../worker/src/core';
import { LocalJudge, MemoryStore } from './helpers';

const actor: Actor = { uid: 'u1', displayName: 'Test Student', department: 'CSE', role: 'student' };
const HIDDEN_SECRET_IN = '777 888';
const HIDDEN_SECRET_OUT = '1665';

function setup(start = new Date('2026-11-21T04:00:00Z')) {
  const store = new MemoryStore();
  let t = start.getTime();
  const judge = new LocalJudge();
  const deps: Deps = { store, judge, now: () => new Date(t), enabled: ['c', 'cpp', 'java', 'python'] };
  store.put('questions/q1', {
    title: 'Add two numbers', difficulty: 'easy', topic: 'Basic Programming', status: 'published', languages: ['c', 'cpp', 'java', 'python', 'sql'],
    timeLimitMs: 2000, memoryLimitKb: 262144,
    visibleTests: [{ input: '1 2', expected: '3' }, { input: '10 20', expected: '30' }],
  });
  store.put('questionTests/q1', { hidden: [{ input: '5 5', expected: '10' }, { input: HIDDEN_SECRET_IN, expected: HIDDEN_SECRET_OUT }, { input: '0 0', expected: '0' }] });
  return { store, deps, judge, advance: (ms: number) => { t += ms; } };
}
const PY_OK = 'a,b=map(int,input().split())\nprint(a+b)';
const PY_WRONG = 'a,b=map(int,input().split())\nprint(a+b if a<100 and b<100 and a!=777 else 0)';
const C_OK = '#include <stdio.h>\nint main(){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}';
const CPP_OK = '#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<std::endl;}';
const JAVA_OK = 'import java.util.*;\npublic class Main{public static void main(String[] x){Scanner s=new Scanner(System.in);System.out.println(s.nextInt()+s.nextInt());}}';

test('run: visible tests only, custom input works', async () => {
  const { deps } = setup();
  const r = await handleRun(deps, actor, { questionId: 'q1', language: 'python', code: PY_OK }) as { verdict: string; passed: number; total: number; tests: unknown[] };
  assert.equal(r.verdict, 'accepted');
  assert.equal(r.total, 2);
  const c = await handleRun(deps, actor, { questionId: 'q1', language: 'python', code: PY_OK, stdin: '4 5' }) as { stdout: string };
  assert.equal(c.stdout.trim(), '9');
});

test('submit: accepted in all 4 languages, hidden data never leaks, rewards once', async () => {
  const hasJavac = spawnSync('javac', ['-version']).status === 0; // Java is skipped (and reported) where no JDK is installed
  const langs = [['python', PY_OK], ['c', C_OK], ['cpp', CPP_OK], ...(hasJavac ? [['java', JAVA_OK]] : [])] as const;
  if (!hasJavac) console.log('NOTE: javac not installed here - Java path NOT tested');
  for (const [language, code] of langs) {
    const { deps, store, advance } = setup();
    await handlePracticeStart(deps, actor, { questionId: 'q1' });
    advance(12 * 60000); // 12 minutes of work
    const r = await handleSubmit(deps, actor, { questionId: 'q1', language, code });
    assert.equal(r.verdict, 'accepted', language);
    assert.equal(r.passed, 5);
    assert.equal(r.total, 5);
    assert.equal(r.hidden.length, 3);
    // hidden results carry only index/status/time
    for (const h of r.hidden) assert.deepEqual(Object.keys(h).sort(), ['index', 'status', 'timeMs']);
    const wire = JSON.stringify(r);
    assert.ok(!wire.includes(HIDDEN_SECRET_IN) && !wire.includes(HIDDEN_SECRET_OUT), 'hidden test leaked in response');
    const sub = JSON.stringify([...store.docs.entries()].filter(([k]) => k.startsWith('submissions/')));
    assert.ok(!sub.includes(HIDDEN_SECRET_IN) && !sub.includes(HIDDEN_SECRET_OUT), 'hidden test leaked in stored submission');
    const streak = (await store.get('streaks/u1'))!;
    assert.equal(streak.totalSolved, 1);
    assert.equal(streak.currentStreak, 1);
    assert.equal((await store.get('achievements/u1'))!.xp, 10);
    assert.ok('solved_1' in ((await store.get('achievements/u1'))!.badges as object));
    assert.equal((await store.get('leaderboard/u1'))!.points, 10);
    assert.equal((await store.get('dailyActivity/u1_2026-11-21'))!.solved, 1);
  }
});

test('submit: second accepted submission gives no extra XP or solved count; rate limited when too fast', async () => {
  const { deps, store, advance } = setup();
  await handlePracticeStart(deps, actor, { questionId: 'q1' });
  advance(11 * 60000);
  await handleSubmit(deps, actor, { questionId: 'q1', language: 'python', code: PY_OK });
  advance(1000);
  await assert.rejects(handleSubmit(deps, actor, { questionId: 'q1', language: 'python', code: PY_OK }), (e: unknown) => e instanceof HttpError && e.status === 429);
  advance(10_000);
  const r2 = await handleSubmit(deps, actor, { questionId: 'q1', language: 'python', code: PY_OK });
  assert.equal(r2.firstSolve, false);
  assert.equal((await store.get('achievements/u1'))!.xp, 10);
  assert.equal((await store.get('streaks/u1'))!.totalSolved, 1);
});

test('submit: wrong answer / partial / compile / runtime / timeout verdicts; no credit for failures', async () => {
  const { deps, store, advance } = setup();
  await handlePracticeStart(deps, actor, { questionId: 'q1' });
  advance(15 * 60000);
  const wrong = await handleSubmit(deps, actor, { questionId: 'q1', language: 'python', code: 'print(1)' });
  assert.equal(wrong.verdict, 'wrong_answer');
  assert.equal(wrong.minutes, 0);
  assert.equal(((await store.get('streaks/u1')) ?? { totalSolved: 0 }).totalSolved, 0);
  advance(5000);
  const partial = await handleSubmit(deps, actor, { questionId: 'q1', language: 'python', code: PY_WRONG });
  assert.equal(partial.verdict, 'partial'); // passes visible + some hidden, fails the secret one
  assert.equal(partial.passed, 4);
  assert.equal(partial.firstSolve, false);
  advance(5000);
  const ce = await handleSubmit(deps, actor, { questionId: 'q1', language: 'c', code: 'int main( { return 0 }' });
  assert.equal(ce.verdict, 'compile_error');
  assert.ok(ce.compileOutput.length > 0);
  advance(5000);
  const re = await handleSubmit(deps, actor, { questionId: 'q1', language: 'python', code: 'raise SystemExit(3)' });
  assert.equal(re.verdict, 'runtime_error');
  advance(5000);
  const tle = await handleSubmit(deps, actor, { questionId: 'q1', language: 'python', code: 'while True: pass' });
  assert.equal(tle.verdict, 'time_limit');
  assert.equal((await store.get('achievements/u1'))!.xp, 0);
});

test('submit: language not enabled / not allowed is rejected before running', async () => {
  const { deps, judge } = setup();
  await assert.rejects(handleSubmit(deps, actor, { questionId: 'q1', language: 'sql', code: 'select 1' }), (e: unknown) => e instanceof HttpError && e.status === 400);
  await assert.rejects(handleRun(deps, actor, { questionId: 'nope', language: 'python', code: 'x' }), (e: unknown) => e instanceof HttpError && e.status === 404);
  assert.equal(judge.calls, 0);
});

test('streak across days via real submissions: consecutive, miss, longest', async () => {
  const { deps, store, advance } = setup();
  const day = 24 * 3600_000;
  const solveDay = async (q: string) => {
    store.put(`questions/${q}`, { ...(await store.get('questions/q1'))! });
    store.put(`questionTests/${q}`, (await store.get('questionTests/q1'))!);
    await handlePracticeStart(deps, actor, { questionId: q });
    advance(11 * 60000);
    await handleSubmit(deps, actor, { questionId: q, language: 'python', code: PY_OK });
  };
  await solveDay('d1'); advance(day - 11 * 60000);
  await solveDay('d2'); advance(day - 11 * 60000);
  await solveDay('d3');
  let s = (await store.get('streaks/u1'))!;
  assert.equal(s.currentStreak, 3);
  advance(2 * day); // missed a whole day
  await solveDay('d4');
  s = (await store.get('streaks/u1'))!;
  assert.equal(s.currentStreak, 1);
  assert.equal(s.longestStreak, 3);
  assert.equal(s.totalSolved, 4);
});

test('lessons: dwell time required, credited once', async () => {
  const { deps, store, advance } = setup();
  store.put('lessons/l1', { courseId: 'c1', status: 'published', estimatedMinutes: 12 });
  await handleLessonStart(deps, actor, { lessonId: 'l1' });
  await assert.rejects(handleLessonComplete(deps, actor, { lessonId: 'l1' }), (e: unknown) => e instanceof HttpError && e.status === 409);
  advance(8 * 60000);
  const r = await handleLessonComplete(deps, actor, { lessonId: 'l1' });
  assert.equal(r.alreadyCompleted, false);
  assert.equal(r.minutes, 8);
  const again = await handleLessonComplete(deps, actor, { lessonId: 'l1' });
  assert.equal(again.alreadyCompleted, true);
  assert.equal((await store.get('achievements/u1'))!.xp, 5);
  assert.equal((await store.get('dailyActivity/u1_2026-11-21'))!.minutes, 8);
  assert.equal((await store.get('streaks/u1'))!.currentStreak, 0); // 8 < 10 minutes: goal not met
});

test('assessments: timer, autosave, grading, expiry, attempt limits, perfect badge', async () => {
  const { deps, store, advance } = setup();
  store.put('assessments/a1', {
    title: 'Aptitude 1', category: 'quantitative', status: 'published', durationMinutes: 10, maxAttempts: 2,
    questions: [{ id: 'x', text: '2+2?', options: ['3', '4'], topic: 'Arithmetic', marks: 1 }, { id: 'y', text: '3+3?', options: ['6', '7'], topic: 'Arithmetic', marks: 2 }],
  });
  store.put('assessmentKeys/a1', { answers: { x: 1, y: 0 }, explanations: { x: 'four', y: 'six' } });
  const s1 = await handleAssessmentStart(deps, actor, { assessmentId: 'a1' });
  const again = await handleAssessmentStart(deps, actor, { assessmentId: 'a1' });
  assert.equal(again.resumed, true);
  const att = (await store.get(`assessmentAttempts/${s1.attemptId}`))!;
  assert.ok(!JSON.stringify(att).includes('four'), 'key must not be in attempt before submit');
  store.put(`assessmentAttempts/${s1.attemptId}`, { ...att, answers: { x: 1, y: 0 } }); // client autosave
  advance(4 * 60000);
  const res = await handleAssessmentSubmit(deps, actor, { attemptId: s1.attemptId });
  assert.equal(res.score, 3); assert.equal(res.totalMarks, 3); assert.equal(res.status, 'submitted'); assert.equal(res.xp, 50);
  assert.ok('perfect_assessment' in ((await store.get('achievements/u1'))!.badges as object));
  await assert.rejects(handleAssessmentSubmit(deps, actor, { attemptId: s1.attemptId }), (e: unknown) => e instanceof HttpError && e.status === 409);
  // second attempt: expires
  const s2 = await handleAssessmentStart(deps, actor, { assessmentId: 'a1' });
  assert.equal(s2.resumed, false);
  const att2 = (await store.get(`assessmentAttempts/${s2.attemptId}`))!;
  store.put(`assessmentAttempts/${s2.attemptId}`, { ...att2, answers: { x: 0 } });
  advance(11 * 60000);
  const r2 = await handleAssessmentSubmit(deps, actor, { attemptId: s2.attemptId });
  assert.equal(r2.status, 'expired'); assert.equal(r2.score, 0); assert.equal(r2.xp, 0);
  await assert.rejects(handleAssessmentStart(deps, actor, { assessmentId: 'a1' }), (e: unknown) => e instanceof HttpError && e.status === 409); // max 2 attempts
  // another student cannot submit someone else's attempt
  await assert.rejects(handleAssessmentSubmit(deps, { ...actor, uid: 'u2' }, { attemptId: s1.attemptId }), (e: unknown) => e instanceof HttpError && e.status === 404);
});

test('challenge bonus XP: only for first solve of the scheduled question, once', async () => {
  const { deps, store, advance } = setup();
  store.put('challenges/daily_2026-11-21', { type: 'daily', questionIds: ['q1'], bonusXp: 25 });
  store.put('challenges/weekly_2026-11-16', { type: 'weekly', questionIds: ['q1'], bonusXp: 15 });
  await handlePracticeStart(deps, actor, { questionId: 'q1' });
  advance(11 * 60000);
  const r = await handleSubmit(deps, actor, { questionId: 'q1', language: 'python', code: PY_OK });
  assert.equal(r.bonusXp, 40);
  assert.equal(r.xp, 10 + 40);
  assert.equal((await store.get('achievements/u1'))!.xp, 50);
  advance(10_000);
  const again = await handleSubmit(deps, actor, { questionId: 'q1', language: 'python', code: PY_OK });
  assert.equal(again.xp, 0);
  assert.equal((await store.get('achievements/u1'))!.xp, 50);
});

test('submission ids sort newest-first and daily docs carry the year', async () => {
  const { deps, store, advance } = setup();
  await handlePracticeStart(deps, actor, { questionId: 'q1' });
  advance(11 * 60000);
  const a = await handleSubmit(deps, actor, { questionId: 'q1', language: 'python', code: PY_OK });
  advance(10_000);
  const b = await handleSubmit(deps, actor, { questionId: 'q1', language: 'python', code: PY_OK });
  assert.ok(b.submissionId < a.submissionId, 'newer submission must sort first');
  assert.equal((await store.get('dailyActivity/u1_2026-11-21'))!.year, 2026);
});
