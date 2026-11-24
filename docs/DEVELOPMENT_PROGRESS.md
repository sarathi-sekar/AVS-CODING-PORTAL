# Development progress

| Phase | Status |
|---|---|
| 1-4 Analysis, design, architecture | Done (docs/REFERENCE_ANALYSIS.md, this folder) |
| 5 Auth + roles | Done |
| 6 Dashboard + profile | Done (streak, weekly/monthly, heatmap, leaderboard, recent submissions, recommendation) |
| 7 Courses and lessons | Done: student player (prerequisites, server-verified completion), faculty editor + JSON import. **Content itself must still be written/imported**; `seed/` has 2 sample lessons only |
| 8 Editor + question bank | Done: Monaco editor, tabs on mobile / resizable split on desktop, drafts, history, hints, filters, question editor + JSON import |
| 9 Real judge + hidden tests | Code done and tested with a local-compiler judge. **Not yet run against a real Judge0 server** - see docs/JUDGE_SETUP.md |
| 10 Streak engine | Done (server-side, IST, tested incl. missed days) |
| 11 Assessments + placement | Done: timer, autosave, server grading, expiry, attempt limits, topic breakdown, weak topics, company filters. **No question content included** except 1 sample set |
| 12 Faculty/admin tools | Done: users, departments, announcements, students list + detail, CSV export, content/question/assessment management. Not done: faculty-to-student assignment, Excel export (CSV only) |
| 13 Analytics, gamification | XP, levels, 9 badges, leaderboard, skill profile done. Not done: daily/weekly challenges, monthly contests, charts-based analytics |
| 14 Responsive + dark mode | Done and smoke-tested at 320-1440 px |
| 15 Testing | 21 automated tests + 22-screen browser smoke test (mock backend) |
| 16 Deploy | **Not done**: needs your Firebase project, Worker and Judge0 server |

Added later: first-admin /setup, admin-created accounts, admin-managed departments/years/sections (no hard-coded lists), profile-recovery screen, password strength meter, reset-email resend, daily/weekly challenges with bonus XP, bookmarks, notes, completion certificate (print/PDF), richer admin dashboard, user search/filter/edit/export.

Not built: monthly contests, discussions, email notifications, profile pictures (needs Storage), interview collections, revision mode, performance comparison, real .xlsx export (CSV opens in Excel), faculty-to-student assignment.


## Update: admin/student feature round
* Root cause of "The query requires an index": Firestore composite indexes were not deployed. All queries were rewritten to need none (client-side sorting, newest-first document ids, a `year` field on daily activity).
* Fixed: saving a question with an empty optional field crashed (`undefined` value). Firestore now ignores undefined fields.
* New students appear on the admin side instantly (realtime listener + red badge on Users).
* Courses are now TAP-style: course grid -> player with video on the left and "Course content" (modules, durations, progress ring, search) on the right. Admin builder: modules, lessons with video link / optional upload, notes, downloadable materials, reorder, publish/unpublish, delete (course, module, lesson, video), add many videos at once.
* Tests: paste questions from ChatGPT/Claude/Word, preview, fix answers, publish. Publish/unpublish/delete for tests, questions, library items, jobs.
* Programming questions: guided test-case editor (visible + hidden), AI prompt to copy, JSON import.
* Library: notes, company question papers, interview questions (link, upload or typed text).
* Jobs & drives with applications and applicant export; Schedule calendar; My learning bars; leaderboard podium; companies now come from data (not hard-coded).
* Speed: lazy-loaded pages, stale-while-revalidate cache for lists, persistent Firestore cache, long-polling fallback.

Not built: Ask-AI chat (needs a paid AI API), attendance marking, profile pictures, monthly contests, discussions, e-mail notifications.
