# Firestore schema

| Collection | Doc id | Key fields | Written by |
|---|---|---|---|
| users | uid | displayName, email, registerNumber, department, academicYear, section, role, status, theme | self (pending student) / admin |
| registerNumbers | REGISTER NO | uid | self at registration (uniqueness guard) |
| departments, announcements | auto | name / title, body | admin |
| courses | auto | title, description, category, level, status, order, lessonCount | admin, faculty |
| modules | auto | courseId, title, order, status | admin, faculty |
| lessons | auto | courseId, moduleId, title, order, level, estimatedMinutes, content (markdown), status, prerequisiteId, relatedQuestionIds | admin, faculty |
| questions | auto | title, description, difficulty, topic, constraints, inputFormat, outputFormat, examples, visibleTests, hiddenCount, timeLimitMs, memoryLimitKb, languages, starter, hints, editorial, status | admin, faculty |
| **questionTests** | question id | hidden: [{input, expected}] | admin, faculty only; judge reads |
| assessments | auto | title, category, company, durationMinutes, maxAttempts, questions (no answers), status | staff |
| **assessmentKeys** | assessment id | answers, explanations | staff only; judge reads |
| assessmentAttempts | `${uid}_${assessmentId}_${n}` | status, startedAt, endsAt, answers (student autosave until endsAt), score, review, topicBreakdown | judge (student may only update `answers` before endsAt) |
| assessmentCounters | `${uid}_${assessmentId}` | count, activeAttemptId | judge only |
| submissions | `${uid}_${ms}` | questionId, language, code, verdict, passed, total, visible[], hidden[] (status only) | judge only |
| attempts | `${uid}_${questionId}` | submissions, solved, startedAt, lastCreditAt, lastSubmitAt | judge only |
| lessonProgress | `${uid}_${lessonId}` | startedAt, completed, completedAt, creditedMinutes | judge only |
| dailyActivity | `${uid}_${YYYY-MM-DD}` | attemptedIds, attempted, solved, minutes (IST date) | judge only |
| streaks | uid | currentStreak, longestStreak, activeDays, lastGoalDate, totalSolved, hardSolved | judge only |
| achievements | uid | xp, level, badges{id: date} | judge only |
| skills | uid | topics{slug: attempted, solved, easy, medium, hard, submissions, accepted} | judge only |
| leaderboard | uid | displayName, department, points, solved | judge only |
| bookmarks | `${uid}_${kind}_${refId}` | uid, kind, refId, title, courseId | owner |
| studentNotes | `${uid}_${questionId}` | uid, questionId, title, text | owner |
| config/academic | academic | years[], sections[] | admin |
| system/bootstrap | bootstrap | createdAt (first admin created) | first admin, once |
| challenges | `daily_YYYY-MM-DD` / `weekly_<Monday>` | questionIds, bonusXp | admin, faculty |

Indexes: `firestore.indexes.json` (note: add the `questions (status, title)` index is included).

Added: `resources` (type notes|company|interview, title, subject, company, description, body, url, path, status), `jobs` (company, role, location, salary, eligibility, description, applyUrl, lastDate, status), `applications` (`${uid}_${jobId}`), `events` (title, date, time, program, link), `config/features` ({storage}). Lessons also carry `videoUrl`, `videoPath`, `attachments[]`; courses carry `moduleCount`, `totalMinutes`. Submissions use ids `${uid}_${9999999999999-ms}` (newest first); `dailyActivity` has a numeric `year`. No composite indexes are required.
