import { isLanguageId, type LanguageId } from '../../src/shared/languages';
import { aggregateVerdict, classifyRun, type RawRun, type TestStatus, type Verdict } from '../../src/shared/verdict';
import { istDateKey, mondayOf } from '../../src/shared/streak';
import { LESSON_XP, SOLVE_XP, type Difficulty } from '../../src/shared/gamification';
import { EMPTY_TOPIC, recordSubmissionInTopic, type TopicStats } from '../../src/shared/skills';
import type { Judge } from './judge';
import { applyProgress, parseProgress, progressPaths, saveProgress } from './progress';
import { arr, num, obj, str, type Data, type Store, type Tx } from './store';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface Deps { store: Store; judge: Judge; now: () => Date; enabled: LanguageId[] }
export interface Actor { uid: string; displayName: string; department: string; role: string }

const MAX_CODE = 64 * 1024;
const MAX_TESTS = 30;
const MIN_SUBMIT_GAP_MS = 3000;
const clip = (s: string, n = 4000) => (s.length > n ? s.slice(0, n) + '\n...[truncated]' : s);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'general';

interface TestCase { input: string; expected: string }
interface Question {
  id: string; title: string; difficulty: Difficulty; topic: string; status: string;
  languages: LanguageId[]; timeLimitMs: number; memoryLimitKb: number; visible: TestCase[];
}

const toTests = (v: unknown): TestCase[] =>
  arr<Data>(v).map((t) => ({ input: str(t.input), expected: str(t.expected) }));

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i], i); }
  }));
  return out;
}

async function loadQuestion(deps: Deps, id: unknown): Promise<Question> {
  if (typeof id !== 'string' || !id) throw new HttpError(400, 'questionId is required');
  const d = await deps.store.get(`questions/${id}`);
  if (!d || str(d.status) !== 'published') throw new HttpError(404, 'Question not found');
  const diff = str(d.difficulty);
  return {
    id, title: str(d.title), difficulty: diff === 'hard' || diff === 'medium' ? diff : 'easy', topic: str(d.topic, 'general'),
    status: str(d.status), languages: arr<string>(d.languages).filter(isLanguageId),
    timeLimitMs: Math.min(Math.max(num(d.timeLimitMs, 2000), 500), 10000),
    memoryLimitKb: Math.min(Math.max(num(d.memoryLimitKb, 262144), 32768), 512000),
    visible: toTests(d.visibleTests).slice(0, 10),
  };
}

function checkSource(deps: Deps, q: Question, language: unknown, code: unknown): { language: LanguageId; code: string } {
  if (!isLanguageId(language)) throw new HttpError(400, 'Unknown language');
  if (!deps.enabled.includes(language)) throw new HttpError(400, 'This language is not enabled yet');
  if (!q.languages.includes(language)) throw new HttpError(400, 'This language is not allowed for this question');
  if (typeof code !== 'string' || code.trim() === '') throw new HttpError(400, 'Write some code first');
  if (code.length > MAX_CODE) throw new HttpError(400, 'Code is too long');
  return { language, code };
}

/** SQL questions: the test input holds the schema/data setup, executed before the student's query. */
async function runOne(deps: Deps, q: Question, language: LanguageId, code: string, input: string): Promise<RawRun> {
  const sql = language === 'sql';
  return deps.judge.run({
    language, code: sql ? `${input}\n${code}` : code, stdin: sql ? '' : input,
    timeLimitMs: q.timeLimitMs, memoryLimitKb: q.memoryLimitKb,
  });
}

async function runAll(deps: Deps, q: Question, language: LanguageId, code: string, tests: TestCase[]): Promise<RawRun[]> {
  if (tests.length === 0) return [];
  const first = await runOne(deps, q, language, code, tests[0].input);
  if (first.statusId === 6) return tests.map(() => first); // compile error: no need to run the rest
  const rest = await pool(tests.slice(1), 4, (t) => runOne(deps, q, language, code, t.input));
  return [first, ...rest];
}

// ---------------------------------------------------------------- run
export async function handleRun(deps: Deps, _a: Actor, body: Data) {
  const q = await loadQuestion(deps, body.questionId);
  const { language, code } = checkSource(deps, q, body.language, body.code);
  if (typeof body.stdin === 'string') {
    if (body.stdin.length > MAX_CODE) throw new HttpError(400, 'Input is too long');
    const run = await runOne(deps, q, language, code, body.stdin);
    return {
      kind: 'custom', status: classifyRun(run, run.stdout, q.memoryLimitKb),
      stdout: clip(run.stdout), stderr: clip(run.stderr), compileOutput: clip(run.compileOutput), timeMs: run.timeMs, memoryKb: run.memoryKb,
    };
  }
  const runs = await runAll(deps, q, language, code, q.visible);
  const statuses = runs.map((r, i) => classifyRun(r, q.visible[i].expected, q.memoryLimitKb));
  return {
    kind: 'visible', verdict: aggregateVerdict(statuses), passed: statuses.filter((s) => s === 'passed').length, total: statuses.length,
    compileOutput: runs[0]?.statusId === 6 ? clip(runs[0].compileOutput) : '',
    tests: runs.map((r, i) => ({
      index: i + 1, status: statuses[i], input: q.visible[i].input, expected: q.visible[i].expected,
      actual: clip(r.stdout), stderr: clip(r.stderr), timeMs: r.timeMs, memoryKb: r.memoryKb,
    })),
  };
}

// ---------------------------------------------------------------- practice start (time reference for credit)
export async function handlePracticeStart(deps: Deps, a: Actor, body: Data) {
  const q = await loadQuestion(deps, body.questionId);
  const path = `attempts/${a.uid}_${q.id}`;
  const now = deps.now();
  await deps.store.transact(async (tx) => {
    const cur = await tx.get(path);
    if (!cur) tx.set(path, { uid: a.uid, questionId: q.id, topic: slug(q.topic), difficulty: q.difficulty, submissions: 0, solved: false, startedAt: now, lastCreditAt: null, lastSubmitAt: null });
  });
  return { ok: true };
}

// ---------------------------------------------------------------- submit
export async function handleSubmit(deps: Deps, a: Actor, body: Data) {
  const q = await loadQuestion(deps, body.questionId);
  const { language, code } = checkSource(deps, q, body.language, body.code);
  const attemptPath = `attempts/${a.uid}_${q.id}`;
  const pre = await deps.store.get(attemptPath);
  const last = pre?.lastSubmitAt instanceof Date ? pre.lastSubmitAt.getTime() : 0;
  if (deps.now().getTime() - last < MIN_SUBMIT_GAP_MS) throw new HttpError(429, 'Please wait a few seconds between submissions');

  const secret = await deps.store.get(`questionTests/${q.id}`); // trusted read: students can never read this document
  const hidden = toTests(secret?.hidden);
  const tests = [...q.visible, ...hidden].slice(0, MAX_TESTS);
  if (tests.length === 0) throw new HttpError(409, 'This question has no test cases yet');

  const runs = await runAll(deps, q, language, code, tests);
  const statuses: TestStatus[] = runs.map((r, i) => classifyRun(r, tests[i].expected, q.memoryLimitKb));
  const verdict = aggregateVerdict(statuses);
  const passed = statuses.filter((s) => s === 'passed').length;
  const nVis = Math.min(q.visible.length, tests.length);

  const visible = runs.slice(0, nVis).map((r, i) => ({
    index: i + 1, status: statuses[i], input: tests[i].input, expected: tests[i].expected, actual: clip(r.stdout), stderr: clip(r.stderr || r.compileOutput), timeMs: r.timeMs,
  }));
  // Hidden tests: status and time only. Never input, expected output, actual output or stderr.
  const hiddenOut = runs.slice(nVis).map((r, i) => ({ index: i + 1, status: statuses[nVis + i], timeMs: r.timeMs }));
  const timeMs = Math.max(0, ...runs.map((r) => r.timeMs));
  const memoryKb = Math.max(0, ...runs.map((r) => r.memoryKb));
  const compileOutput = runs[0]?.statusId === 6 ? clip(runs[0].compileOutput) : '';

  const now = deps.now();
  const day = istDateKey(now);
  // Reversed timestamp: the default (document id) order is newest-first, so no composite index is needed to list history.
  const submissionId = `${a.uid}_${String(9_999_999_999_999 - now.getTime()).padStart(13, '0')}`;
  const rec = await deps.store.transact(async (tx) => {
    const paths = progressPaths(a.uid, day);
    const [att, skills, d, s, ac, daily, weekly] = await tx.getMany([attemptPath, `skills/${a.uid}`, paths.daily, paths.streak, paths.ach, `challenges/daily_${day}`, `challenges/weekly_${mondayOf(day)}`]);
    const submissions = num(att?.submissions);
    const wasSolved = att?.solved === true;
    const firstSolve = verdict === 'accepted' && !wasSolved;
    const startedAt = att?.startedAt instanceof Date ? att.startedAt : now;
    const lastCredit = att?.lastCreditAt instanceof Date ? att.lastCreditAt : startedAt;
    const worthCredit = verdict === 'accepted' || verdict === 'partial';
    const elapsedMin = Math.floor((now.getTime() - lastCredit.getTime()) / 60000);
    const minutes = worthCredit ? Math.max(1, Math.min(10, elapsedMin)) : 0;

    const topic = slug(q.topic);
    const topics = obj(obj(skills).topics);
    const cur = { ...EMPTY_TOPIC, ...obj(topics[topic]) } as TopicStats;
    const nextTopic = recordSubmissionInTopic(cur, { firstAttempt: submissions === 0, accepted: verdict === 'accepted', firstSolve, difficulty: q.difficulty });

    // Challenge bonus: first-time solve of a question that is today's daily or this week's weekly challenge.
    let bonusXp = 0;
    if (firstSolve) {
      for (const c of [daily, weekly]) if (c && arr<string>(c.questionIds).includes(q.id)) bonusXp += Math.min(100, Math.max(0, num(c.bonusXp)));
    }
    const res = applyProgress(parseProgress(a.uid, day, d, s, ac), {
      now, day, minutes, xp: firstSolve ? SOLVE_XP[q.difficulty] + bonusXp : 0, attemptedId: q.id, solvedDifficulty: firstSolve ? q.difficulty : undefined,
    });
    tx.set(attemptPath, {
      uid: a.uid, questionId: q.id, topic, difficulty: q.difficulty, submissions: submissions + 1, solved: wasSolved || firstSolve,
      startedAt, lastCreditAt: worthCredit ? now : lastCredit, lastSubmitAt: now, ...(firstSolve ? { firstSolvedAt: now } : { firstSolvedAt: att?.firstSolvedAt ?? null }),
    });
    tx.set(`skills/${a.uid}`, { topics: { ...topics, [topic]: nextTopic }, updatedAt: now });
    saveProgress(tx, a.uid, day, res.next, a, now);
    tx.set(`submissions/${submissionId}`, {
      uid: a.uid, questionId: q.id, questionTitle: q.title, language, code, verdict, passed, total: tests.length,
      visible, hidden: hiddenOut, compileOutput, timeMs, memoryKb, firstSolve, bonusXp, xpAwarded: firstSolve ? SOLVE_XP[q.difficulty] + bonusXp : 0,
      creditedMinutes: res.creditedMinutes, createdAt: now,
    });
    return { xp: firstSolve ? SOLVE_XP[q.difficulty] + bonusXp : 0, bonusXp, firstSolve, newBadges: res.newBadges, minutes: res.creditedMinutes };
  });

  return { submissionId, verdict: verdict as Verdict, passed, total: tests.length, visible, hidden: hiddenOut, compileOutput, timeMs, memoryKb, ...rec };
}

// ---------------------------------------------------------------- lessons
async function loadLesson(deps: Deps, id: unknown) {
  if (typeof id !== 'string' || !id) throw new HttpError(400, 'lessonId is required');
  const l = await deps.store.get(`lessons/${id}`);
  if (!l || str(l.status) !== 'published') throw new HttpError(404, 'Lesson not found');
  return { id, courseId: str(l.courseId), estimatedMinutes: Math.max(1, Math.min(120, num(l.estimatedMinutes, 10))) };
}

export async function handleLessonStart(deps: Deps, a: Actor, body: Data) {
  const l = await loadLesson(deps, body.lessonId);
  const path = `lessonProgress/${a.uid}_${l.id}`;
  const now = deps.now();
  await deps.store.transact(async (tx) => {
    if (!(await tx.get(path))) tx.set(path, { uid: a.uid, courseId: l.courseId, lessonId: l.id, startedAt: now, completed: false });
  });
  return { ok: true };
}

export async function handleLessonComplete(deps: Deps, a: Actor, body: Data) {
  const l = await loadLesson(deps, body.lessonId);
  const path = `lessonProgress/${a.uid}_${l.id}`;
  const now = deps.now();
  const day = istDateKey(now);
  return deps.store.transact(async (tx) => {
    const paths = progressPaths(a.uid, day);
    const [p, d, s, ac] = await tx.getMany([path, paths.daily, paths.streak, paths.ach]);
    if (!p) throw new HttpError(409, 'Open the lesson first');
    if (p.completed === true) return { alreadyCompleted: true, minutes: 0, xp: 0, newBadges: [] as string[] };
    const startedAt = p.startedAt instanceof Date ? p.startedAt : now;
    const elapsedMin = (now.getTime() - startedAt.getTime()) / 60000;
    const required = Math.max(1, Math.floor(l.estimatedMinutes / 2));
    if (elapsedMin < required) {
      const wait = Math.ceil(required - elapsedMin);
      throw new HttpError(409, `Please spend about ${wait} more minute${wait === 1 ? '' : 's'} on this lesson before completing it`);
    }
    const minutes = Math.max(1, Math.min(l.estimatedMinutes, Math.floor(elapsedMin)));
    const res = applyProgress(parseProgress(a.uid, day, d, s, ac), { now, day, minutes, xp: LESSON_XP });
    tx.set(path, { ...p, completed: true, completedAt: now, creditedMinutes: res.creditedMinutes });
    saveProgress(tx, a.uid, day, res.next, a, now);
    return { alreadyCompleted: false, minutes: res.creditedMinutes, xp: LESSON_XP, newBadges: res.newBadges };
  });
}

// ---------------------------------------------------------------- assessments
interface AQuestion { id: string; marks: number; topic: string }
const aQuestions = (v: unknown): AQuestion[] => arr<Data>(v).map((q) => ({ id: str(q.id), marks: Math.max(1, num(q.marks, 1)), topic: slug(str(q.topic, 'general')) }));

export async function handleAssessmentStart(deps: Deps, a: Actor, body: Data) {
  const id = str(body.assessmentId);
  const ass = id ? await deps.store.get(`assessments/${id}`) : null;
  if (!ass || str(ass.status) !== 'published') throw new HttpError(404, 'Assessment not found');
  const now = deps.now();
  const opens = ass.opensAt instanceof Date ? ass.opensAt : null;
  const closes = ass.closesAt instanceof Date ? ass.closesAt : null;
  if (opens && now < opens) throw new HttpError(409, 'This assessment has not opened yet');
  if (closes && now > closes) throw new HttpError(409, 'This assessment is closed');
  const duration = Math.max(1, Math.min(240, num(ass.durationMinutes, 30)));
  const maxAttempts = Math.max(0, num(ass.maxAttempts, 0));
  const counterPath = `assessmentCounters/${a.uid}_${id}`;
  return deps.store.transact(async (tx) => {
    const c = await tx.get(counterPath);
    const count = num(c?.count);
    const activeId = str(c?.activeAttemptId);
    if (activeId) {
      const active = await tx.get(`assessmentAttempts/${activeId}`);
      if (active && str(active.status) === 'in_progress' && active.endsAt instanceof Date && active.endsAt > now) {
        return { attemptId: activeId, endsAt: active.endsAt.toISOString(), resumed: true };
      }
    }
    if (maxAttempts > 0 && count >= maxAttempts) throw new HttpError(409, 'No attempts left for this assessment');
    const attemptId = `${a.uid}_${id}_${count + 1}`;
    const endsAt = new Date(now.getTime() + duration * 60000);
    if (closes && endsAt > closes) endsAt.setTime(closes.getTime());
    tx.set(`assessmentAttempts/${attemptId}`, {
      uid: a.uid, assessmentId: id, title: str(ass.title), category: str(ass.category), company: str(ass.company), attemptNo: count + 1,
      startedAt: now, endsAt, status: 'in_progress', answers: {}, total: aQuestions(ass.questions).length, createdAt: now,
    });
    tx.set(counterPath, { uid: a.uid, count: count + 1, activeAttemptId: attemptId });
    return { attemptId, endsAt: endsAt.toISOString(), resumed: false };
  });
}

export async function handleAssessmentSubmit(deps: Deps, a: Actor, body: Data) {
  const attemptId = str(body.attemptId);
  if (!attemptId) throw new HttpError(400, 'attemptId is required');
  const now = deps.now();
  const day = istDateKey(now);
  const first = await deps.store.get(`assessmentAttempts/${attemptId}`);
  if (!first || str(first.uid) !== a.uid) throw new HttpError(404, 'Attempt not found');
  const [ass, key] = await Promise.all([deps.store.get(`assessments/${str(first.assessmentId)}`), deps.store.get(`assessmentKeys/${str(first.assessmentId)}`)]);
  if (!ass || !key) throw new HttpError(409, 'Assessment is not available');
  const qs = aQuestions(ass.questions);
  const answerKey = obj(key.answers);
  const explanations = obj(key.explanations);

  return deps.store.transact(async (tx: Tx) => {
    const paths = progressPaths(a.uid, day);
    const [att, d, s, ac] = await tx.getMany([`assessmentAttempts/${attemptId}`, paths.daily, paths.streak, paths.ach]);
    if (!att || str(att.status) !== 'in_progress') throw new HttpError(409, 'This attempt is already submitted');
    const answers = obj(att.answers);
    let score = 0;
    let totalMarks = 0;
    const topicBreakdown: Record<string, { correct: number; total: number }> = {};
    const review = qs.map((q) => {
      const selected = typeof answers[q.id] === 'number' ? (answers[q.id] as number) : null;
      const correct = num(answerKey[q.id], -1);
      const ok = selected !== null && selected === correct;
      totalMarks += q.marks;
      if (ok) score += q.marks;
      const t = topicBreakdown[q.topic] ?? { correct: 0, total: 0 };
      t.total += 1;
      if (ok) t.correct += 1;
      topicBreakdown[q.topic] = t;
      return { questionId: q.id, selected, correctIndex: correct, correct: ok, explanation: str(explanations[q.id]) };
    });
    const endsAt = att.endsAt instanceof Date ? att.endsAt : now;
    const startedAt = att.startedAt instanceof Date ? att.startedAt : now;
    const expired = now > endsAt;
    const answered = Object.keys(answers).length;
    const effectiveEnd = expired ? endsAt : now;
    const elapsedMin = Math.floor((effectiveEnd.getTime() - startedAt.getTime()) / 60000);
    const minutes = answered > 0 ? Math.max(1, elapsedMin) : 0;
    const perfect = totalMarks > 0 && score === totalMarks;
    const xp = num(att.attemptNo) === 1 && totalMarks > 0 ? Math.round((score / totalMarks) * 50) : 0;
    const res = applyProgress(parseProgress(a.uid, day, d, s, ac), { now, day, minutes, xp, perfectAssessment: perfect });
    tx.set(`assessmentAttempts/${attemptId}`, {
      ...att, status: expired ? 'expired' : 'submitted', submittedAt: now, score, totalMarks, topicBreakdown, review, xpAwarded: xp,
    });
    const counterPath = `assessmentCounters/${a.uid}_${str(att.assessmentId)}`;
    const counter = await tx.get(counterPath);
    tx.set(counterPath, { ...(counter ?? { uid: a.uid, count: num(att.attemptNo) }), activeAttemptId: '' });
    saveProgress(tx, a.uid, day, res.next, a, now);
    return { score, totalMarks, status: expired ? 'expired' : 'submitted', xp, newBadges: res.newBadges };
  });
}
