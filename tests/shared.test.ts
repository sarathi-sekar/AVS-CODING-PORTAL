import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDailyMinutes, effectiveStreak, EMPTY_STREAK, addDays, istDateKey } from '../src/shared/streak';
import { aggregateVerdict, classifyRun, outputsMatch } from '../src/shared/verdict';
import { levelFromXp, qualifiedBadges } from '../src/shared/gamification';
import { recommendTopic, skillLevel, recordSubmissionInTopic, EMPTY_TOPIC } from '../src/shared/skills';

test('streak: goal crossing counts once per day', () => {
  let s = applyDailyMinutes(EMPTY_STREAK, '2026-11-01', 0, 6);
  assert.equal(s.currentStreak, 0);
  s = applyDailyMinutes(s, '2026-11-01', 6, 12);
  assert.equal(s.currentStreak, 1);
  const again = applyDailyMinutes(s, '2026-11-01', 12, 30);
  assert.deepEqual(again, s); // no double count
});
test('streak: consecutive days, miss resets, longest preserved', () => {
  let s = EMPTY_STREAK;
  for (const d of ['2026-11-01', '2026-11-02', '2026-11-03']) s = applyDailyMinutes(s, d, 0, 10);
  assert.equal(s.currentStreak, 3);
  s = applyDailyMinutes(s, '2026-11-05', 0, 10); // missed 11-04
  assert.equal(s.currentStreak, 1);
  assert.equal(s.longestStreak, 3);
  assert.equal(s.activeDays, 4);
});
test('streak: display drops to 0 after a missed day', () => {
  const s = { currentStreak: 4, longestStreak: 4, activeDays: 4, lastGoalDate: '2026-11-10' };
  assert.equal(effectiveStreak(s, '2026-11-10'), 4);
  assert.equal(effectiveStreak(s, '2026-11-11'), 4);
  assert.equal(effectiveStreak(s, '2026-11-12'), 0);
});
test('streak: month/year boundaries and IST', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  // 2026-11-20 19:00 UTC is 00:30 IST on 11-21
  assert.equal(istDateKey(new Date('2026-11-20T19:00:00Z')), '2026-11-21');
  assert.equal(istDateKey(new Date('2026-11-20T18:29:00Z')), '2026-11-20');
});
test('verdict: output normalisation', () => {
  assert.ok(outputsMatch('1 2 \r\n3\r\n\r\n', '1 2\n3'));
  assert.ok(!outputsMatch('1 2', '1  2'));
});
test('verdict: classification and aggregation', () => {
  const ok = { statusId: 3, stdout: '5\n', stderr: '', compileOutput: '', timeMs: 10, memoryKb: 1000 };
  assert.equal(classifyRun(ok, '5', 65536), 'passed');
  assert.equal(classifyRun({ ...ok, stdout: '6' }, '5', 65536), 'wrong_answer');
  assert.equal(classifyRun({ ...ok, statusId: 5 }, '5', 65536), 'time_limit');
  assert.equal(classifyRun({ ...ok, statusId: 6 }, '5', 65536), 'compile_error');
  assert.equal(classifyRun({ ...ok, statusId: 11 }, '5', 65536), 'runtime_error');
  assert.equal(classifyRun({ ...ok, statusId: 11, memoryKb: 65000 }, '5', 65536), 'memory_limit');
  assert.equal(aggregateVerdict(['passed', 'passed']), 'accepted');
  assert.equal(aggregateVerdict(['passed', 'wrong_answer']), 'partial');
  assert.equal(aggregateVerdict(['wrong_answer', 'wrong_answer']), 'wrong_answer');
  assert.equal(aggregateVerdict(['time_limit', 'wrong_answer']), 'time_limit');
  assert.equal(aggregateVerdict(['compile_error', 'compile_error']), 'compile_error');
});
test('gamification', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(50), 2);
  assert.equal(levelFromXp(200), 3);
  assert.deepEqual(qualifiedBadges({ totalSolved: 5, hardSolved: 0, longestStreak: 7, perfectAssessment: false }), ['solved_1', 'solved_5', 'streak_7']);
  assert.ok(qualifiedBadges({ totalSolved: 50, hardSolved: 10, longestStreak: 0, perfectAssessment: true }).includes('coding_champion'));
});
test('skills: levels from real results', () => {
  assert.equal(skillLevel(EMPTY_TOPIC), 'not_started');
  assert.equal(skillLevel({ attempted: 5, solved: 1, easy: 1, medium: 0, hard: 0, submissions: 9, accepted: 1 }), 'needs_improvement');
  assert.equal(skillLevel({ attempted: 2, solved: 1, easy: 1, medium: 0, hard: 0, submissions: 2, accepted: 1 }), 'beginner');
  assert.equal(skillLevel({ attempted: 6, solved: 4, easy: 2, medium: 2, hard: 0, submissions: 8, accepted: 4 }), 'intermediate');
  assert.equal(skillLevel({ attempted: 10, solved: 9, easy: 4, medium: 3, hard: 2, submissions: 14, accepted: 9 }), 'strong');
  const t = recordSubmissionInTopic(EMPTY_TOPIC, { firstAttempt: true, accepted: true, firstSolve: true, difficulty: 'medium' });
  assert.deepEqual(t, { attempted: 1, solved: 1, easy: 0, medium: 1, hard: 0, submissions: 1, accepted: 1 });
  const weak = { attempted: 5, solved: 1, easy: 1, medium: 0, hard: 0, submissions: 9, accepted: 1 };
  assert.equal(recommendTopic({ arrays: weak }, ['arrays', 'loops']), 'arrays');
  assert.equal(recommendTopic({}, ['arrays', 'loops']), 'arrays');
});

import { validateAssessment, validateQuestion } from '../src/lib/validate';
test('validate: question import', () => {
  const good = { title: 'A', description: 'd', topic: 'Arrays', difficulty: 'easy', languages: ['python', 'c'], visibleTests: [{ input: '1', expected: '1' }], hiddenTests: [{ input: '2', expected: '2' }], status: 'published' };
  const r = validateQuestion(good);
  assert.ok(r.ok);
  assert.equal(r.ok && r.value.hidden.length, 1);
  const bad = validateQuestion({ ...good, difficulty: 'x', hiddenTests: [], languages: ['cobol'] });
  assert.ok(!bad.ok);
  assert.ok(!bad.ok && bad.errors.length >= 3);
});
test('validate: assessment import never keeps answers in public questions', () => {
  const r = validateAssessment({ title: 'T', category: 'quantitative', questions: [{ text: 'q', options: ['a', 'b'], answerIndex: 1, explanation: 'e' }] });
  assert.ok(r.ok);
  assert.ok(r.ok && !('answerIndex' in r.value.questions[0]) && r.value.answers.q1 === 1);
  assert.ok(!validateAssessment({ title: 'T', category: 'quantitative', questions: [{ text: 'q', options: ['a', 'b'], answerIndex: 5 }] }).ok);
  assert.ok(!validateAssessment({ title: 'T', category: 'Bad Category!', questions: [{ text: 'q', options: ['a', 'b'], answerIndex: 0 }] }).ok);
  assert.ok(!validateAssessment({ title: 'T', category: 'quantitative', questions: [] }).ok);
});

import { csvCell, toCsv } from '../src/lib/csv';
test('csv: quoting and formula injection protection', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(toCsv(['n'], [['x'], [1]]), 'n\r\nx\r\n1');
});

import { passwordStrength } from '../src/lib/password';
test('password strength', () => {
  assert.equal(passwordStrength('abc12').label, 'Too short');
  assert.equal(passwordStrength('abcdefgh').ok, false); // letters only
  assert.equal(passwordStrength('12345678').ok, false);
  assert.equal(passwordStrength('avs12345').label, 'Fair');
  assert.equal(passwordStrength('Avs12345xy').label, 'Good');
  assert.equal(passwordStrength('Avs@College2026').label, 'Strong');
  assert.equal(passwordStrength('password1').ok, false);
});

import { mondayOf } from '../src/shared/streak';
test('mondayOf', () => {
  assert.equal(mondayOf('2026-11-22'), '2026-11-16'); // Sunday -> previous Monday
  assert.equal(mondayOf('2026-11-16'), '2026-11-16');
  assert.equal(mondayOf('2027-01-01'), '2026-12-28');
});

import { parseVideoUrl } from '../src/lib/video';
test('video url parsing', () => {
  assert.equal(parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ').embedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
  assert.equal(parseVideoUrl('https://youtu.be/dQw4w9WgXcQ?t=5').kind, 'youtube');
  assert.equal(parseVideoUrl('https://www.youtube.com/shorts/abcdefghijk').kind, 'youtube');
  assert.equal(parseVideoUrl('https://vimeo.com/123456789').embedUrl, 'https://player.vimeo.com/video/123456789');
  assert.equal(parseVideoUrl('https://drive.google.com/file/d/1AbC_dEf-9/view?usp=sharing').embedUrl, 'https://drive.google.com/file/d/1AbC_dEf-9/preview');
  assert.equal(parseVideoUrl('https://cdn.example.com/lesson1.mp4?x=1').kind, 'file');
  assert.equal(parseVideoUrl('https://example.com/page').kind, 'link');
  assert.equal(parseVideoUrl('http://insecure.example.com/a.mp4').kind, 'none');
  assert.equal(parseVideoUrl('javascript:alert(1)').kind, 'none');
  assert.equal(parseVideoUrl('').kind, 'none');
});

import { parseMcqText } from '../src/lib/mcqParser';
test('mcq parser: ChatGPT style with bold and explanation', () => {
  const r = parseMcqText(`**Q1. What is 20% of 250?**\nA) 40\nB) 50\nC) 60\nD) 25\n**Answer:** B\n**Explanation:** 250 x 20 / 100 = 50.\n\n**Q2. Which is a prime number?**\nA. 9\nB. 15\nC. 17\nD. 21\nCorrect Answer: C. 17\nExplanation: 17 has only two factors.`);
  assert.equal(r.problems.length, 0);
  assert.equal(r.questions.length, 2);
  assert.deepEqual(r.questions[0].options, ['40', '50', '60', '25']);
  assert.equal(r.questions[0].answerIndex, 1);
  assert.equal(r.questions[0].text, 'What is 20% of 250?');
  assert.equal(r.questions[0].explanation, '250 x 20 / 100 = 50.');
  assert.equal(r.questions[1].answerIndex, 2);
});
test('mcq parser: multi-line, answer text, lowercase options, answer key at end', () => {
  const r = parseMcqText(`1. A train travels 60 km\nin 2 hours. Its speed is?\n(a) 20 km/h\n(b) 30 km/h\n(c) 40 km/h\nAnswer: 30 km/h\n\n2) 5 + 5 = ?\na) 9\nb) 10\n\nAnswer Key\n1-B\n2. B`);
  assert.equal(r.questions.length, 2);
  assert.equal(r.questions[0].text, 'A train travels 60 km\nin 2 hours. Its speed is?');
  assert.equal(r.questions[0].answerIndex, 1);
  assert.equal(r.questions[1].answerIndex, 1);
  assert.equal(r.problems.length, 0);
});
test('mcq parser: reports problems instead of guessing', () => {
  const r = parseMcqText(`1. Missing answer?\nA) x\nB) y\n\n2. Only one option\nA) z\nAnswer: A`);
  assert.equal(r.questions.length, 2);
  assert.ok(r.problems.some((p) => p.includes('Question 1') && p.includes('correct answer')));
  assert.ok(r.problems.some((p) => p.includes('Question 2') && p.includes('2 options')));
});
