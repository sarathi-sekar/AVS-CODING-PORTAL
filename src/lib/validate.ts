import { isLanguageId, type LanguageId } from '../shared/languages';
import type { Difficulty } from '../shared/gamification';
import { CATEGORIES, type AssessmentQuestion, type Example, type Question, type TestCase } from '../types';

type R<T> = { ok: true; value: T } | { ok: false; errors: string[] };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const s = (v: unknown) => (typeof v === 'string' ? v : '');

function tests(v: unknown, label: string, errors: string[]): TestCase[] {
  if (!Array.isArray(v)) { errors.push(`${label} must be a list`); return []; }
  return v.map((t, i) => {
    if (!isObj(t) || typeof t.input !== 'string' || typeof t.expected !== 'string') { errors.push(`${label} #${i + 1}: needs "input" and "expected" text`); return { input: '', expected: '' }; }
    return { input: t.input, expected: t.expected };
  });
}

export type QuestionInput = Omit<Question, 'id' | 'hiddenCount'>;

export function validateQuestion(raw: unknown): R<{ question: QuestionInput; hidden: TestCase[] }> {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['Not an object'] };
  const title = s(raw.title).trim();
  if (!title) errors.push('title is required');
  if (!s(raw.description).trim()) errors.push('description is required');
  if (!s(raw.topic).trim()) errors.push('topic is required');
  const difficulty = s(raw.difficulty) as Difficulty;
  if (!['easy', 'medium', 'hard'].includes(difficulty)) errors.push('difficulty must be easy, medium or hard');
  const languages = (Array.isArray(raw.languages) ? raw.languages : []).filter(isLanguageId) as LanguageId[];
  if (languages.length === 0) errors.push('languages must include at least one of c, cpp, java, python, sql');
  const visible = tests(raw.visibleTests, 'visibleTests', errors);
  const hidden = tests(raw.hiddenTests ?? [], 'hiddenTests', errors);
  if (visible.length === 0) errors.push('add at least 1 visible test case');
  if (hidden.length === 0) errors.push('add at least 1 hidden test case');
  if (visible.length > 10) errors.push('at most 10 visible test cases');
  if (visible.length + hidden.length > 30) errors.push('at most 30 test cases in total');
  const examples: Example[] = Array.isArray(raw.examples) ? raw.examples.filter(isObj).map((e) => ({ input: s(e.input), output: s(e.output), explanation: s(e.explanation) || undefined })) : [];
  const tl = Number(raw.timeLimitMs ?? 2000);
  const ml = Number(raw.memoryLimitKb ?? 262144);
  if (!(tl >= 500 && tl <= 10000)) errors.push('timeLimitMs must be 500-10000');
  if (!(ml >= 32768 && ml <= 512000)) errors.push('memoryLimitKb must be 32768-512000');
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      hidden,
      question: {
        title, description: s(raw.description), difficulty, topic: s(raw.topic).trim(), constraints: s(raw.constraints), inputFormat: s(raw.inputFormat), outputFormat: s(raw.outputFormat),
        examples, visibleTests: visible, timeLimitMs: tl, memoryLimitKb: ml, languages,
        starter: isObj(raw.starter) ? (Object.fromEntries(Object.entries(raw.starter).filter(([k, v]) => isLanguageId(k) && typeof v === 'string')) as Partial<Record<LanguageId, string>>) : {},
        hints: Array.isArray(raw.hints) ? raw.hints.filter((h): h is string => typeof h === 'string') : [], editorial: s(raw.editorial) || undefined,
        status: raw.status === 'published' ? 'published' : 'draft',
      },
    },
  };
}

export interface AssessmentInput {
  title: string; category: string; company: string; description: string; durationMinutes: number; maxAttempts: number; status: 'draft' | 'published';
  questions: AssessmentQuestion[]; answers: Record<string, number>; explanations: Record<string, string>;
}

export function validateAssessment(raw: unknown): R<AssessmentInput> {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['Not an object'] };
  if (!s(raw.title).trim()) errors.push('title is required');
  if (!(s(raw.category) in CATEGORIES)) errors.push(`category must be one of: ${Object.keys(CATEGORIES).join(', ')}`);
  const dur = Number(raw.durationMinutes ?? 30);
  if (!(dur >= 1 && dur <= 240)) errors.push('durationMinutes must be 1-240');
  const qs = Array.isArray(raw.questions) ? raw.questions : [];
  if (qs.length === 0) errors.push('add at least 1 question');
  const questions: AssessmentQuestion[] = [];
  const answers: Record<string, number> = {};
  const explanations: Record<string, string> = {};
  qs.forEach((q, i) => {
    const n = i + 1;
    if (!isObj(q)) return errors.push(`question ${n}: invalid`);
    const options = Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === 'string' && o.trim() !== '') : [];
    if (!s(q.text).trim()) errors.push(`question ${n}: text is required`);
    if (options.length < 2 || options.length > 6) errors.push(`question ${n}: needs 2-6 options`);
    const ai = q.answerIndex;
    if (typeof ai !== 'number' || !Number.isInteger(ai) || ai < 0 || ai >= options.length) errors.push(`question ${n}: answerIndex must be a valid option number starting at 0`);
    const id = `q${n}`;
    questions.push({ id, text: s(q.text), options, topic: s(q.topic).trim() || 'General', marks: Math.max(1, Number(q.marks ?? 1) || 1) });
    answers[id] = typeof ai === 'number' ? ai : -1;
    if (s(q.explanation)) explanations[id] = s(q.explanation);
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { title: s(raw.title).trim(), category: s(raw.category), company: s(raw.company).trim(), description: s(raw.description), durationMinutes: dur, maxAttempts: Math.max(0, Number(raw.maxAttempts ?? 0) || 0), status: raw.status === 'published' ? 'published' : 'draft', questions, answers, explanations } };
}
