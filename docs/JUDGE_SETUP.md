# Code judge: feasibility, cost and setup

## Findings (checked Nov 2026 - re-check before launch, limits change)
| Option | Result |
|---|---|
| Piston public API (emkc.org) | No longer open: public access was restricted from 15 Feb 2026 (needs an approved token). Self-hosting Piston is still possible. |
| Judge0 hosted (RapidAPI / managed) | Free tier is tiny (reports say ~50 requests/day) - not enough for a college. |
| **Judge0 CE, self-hosted (chosen)** | Free, open source. Needs a Linux server with Docker (a small VPS). Must be tested on your server; Judge0 has kernel/cgroup requirements - follow its official docs. Cost = the server. |
| Firebase Cloud Functions | Needs the Blaze (billing) plan, so not used. |
| **Cloudflare Workers (chosen for the trusted API)** | Free plan: 100k requests/day, 10 ms CPU per request, 50 sub-requests per request. A submission uses (number of test cases + about 9) sub-requests, so questions are capped at 30 tests. If you see CPU-limit errors, the paid Workers plan ($5/month) removes that limit. |

## Architecture
Browser -> Worker (verifies the Firebase login token) -> reads hidden tests with a service account -> Judge0 -> Worker writes submission, streak, XP, skills, leaderboard to Firestore. Browsers can never read `questionTests`, `assessmentKeys` or write progress collections (Firestore rules).

## Setup
1. Install Judge0 CE on a server (https://github.com/judge0/judge0). Put it behind HTTPS and an auth token (`X-Auth-Token`).
2. Verify languages against YOUR instance:
   `JUDGE0_URL=https://judge.example.com JUDGE0_AUTH_TOKEN=... npm run judge:verify`
   It runs hello-world, compile error, runtime error and infinite-loop programs for C, C++, Java, Python and a SQL query, and prints which languages passed. If your Judge0 uses other language ids, pass `JUDGE0_LANG_IDS='{"c":103}'`.
3. `cd worker`, edit `wrangler.toml` (project id, origins, `JUDGE0_URL`, `ENABLED_LANGUAGES` = only the languages that passed).
4. `npx wrangler secret put FIREBASE_SA_JSON` (Firebase console -> Project settings -> Service accounts -> Generate key; paste the JSON) and `npx wrangler secret put JUDGE0_AUTH_TOKEN`.
5. `npx wrangler deploy`, then put the Worker URL in `.env` as `VITE_JUDGE_API_URL` and redeploy the site.

A language stays hidden from students until it is in `ENABLED_LANGUAGES`.

## Rules the judge enforces
Compile + run in the sandbox, output compared after normalising line endings / trailing spaces; statuses Accepted, Partial, Wrong Answer, Compilation Error, Runtime Error, Time Limit, Memory Limit. Hidden tests return only pass/fail + time. Run never marks a problem solved. First accepted submission gives XP once. 3-second gap between submissions. SQL uses SQLite: put CREATE/INSERT setup in the test "input".

## Known limits (honest)
* Coding time credit is capped (max 10 min per passing/partial submission, 180 min/day) and failed attempts earn no minutes, but it is still an approximation of "meaningful" time.
* Memory limit detection depends on Judge0 reporting; Judge0 has no separate MLE status.
