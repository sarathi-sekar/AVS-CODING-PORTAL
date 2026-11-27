# Testing checklist

## Automated (run `npm test`, `npm run build`, `npm run typecheck:worker`)
- [x] Streak: goal once per day, consecutive days, missed day resets, longest kept, month/year boundary, IST midnight
- [x] Verdict logic: output normalisation, WA / RE / TLE / MLE / CE, partial
- [x] Judge flow with REAL gcc / g++ / python execution: accepted, wrong answer, partial, compile error, runtime error, time limit
- [x] Hidden test inputs/outputs absent from API response and stored submission
- [x] Run never gives XP/solved; XP only once per problem; 3 s submit gap; language not enabled rejected
- [x] Lessons: dwell time enforced, credited once; assessments: autosave, grading, expiry, max attempts, other student's attempt rejected, perfect badge
- [x] Challenge bonus XP once; password strength rules; Monday-of-week
- [x] Import validators, CSV formula-injection protection, markdown HTML escaping
- [x] Strict TypeScript for app and worker; production build
- [ ] **Java path** - no JDK on the build machine, so Java execution was NOT tested

## Browser smoke test (mock backend, Chromium)
- [x] 22 screens x student/faculty/admin at 320, 360, 375, 390, 412, 768, 1024, 1440 px, light and dark: no horizontal overflow, no console errors, student redirected away from admin URL
- [x] Mobile code page: Code tab, Submit, results with hidden summary; test taking: choose answer, next, timer
- [ ] Real Monaco editor on a phone (mock used a plain textarea) - test on an Android device

## Needs your Firebase / server (NOT verified - I cannot reach your Firebase project from here)
- [ ] First admin via /setup; Firestore rules for the claim-admin batch (Rules Playground)
- [ ] Registration -> pending -> admin approves -> login; reset email delivery
- [ ] Real Firebase Auth: register, duplicate register number, login, wrong password, reset mail
- [ ] Firestore rules (use the Rules Playground / emulator): student cannot read `questionTests`, `assessmentKeys`; cannot write progress; cannot change own role
- [ ] Worker against real Firestore REST (token exchange, transactions) and real Judge0 (`npm run judge:verify`)
- [ ] CORS from the hosted site to the Worker; Workers free-plan CPU limit under load
- [ ] Load: ~100 students submitting at once

## Latest round
- [x] OnlineCompiler adapter: mapping of results, header-only key, 401/429/network errors, full submit flow through a fake API that really runs code
- [x] Sideways-scroll audit: 32 screens x 8 widths (320, 360, 375, 412, 430, 768) - none scroll sideways; tables become cards on phones
- [x] App runs under the strict CSP (mock backend)
- [ ] NOT verified: real onlinecompiler.io responses (run `worker/scripts/verify-judge.mjs` yourself), real Firebase rules for lessonProgress fallback, CSP with real Firebase + Monaco CDN
