# Code judge setup: 100% free (OnlineCompiler.io + Cloudflare Workers free plan)

## How it works
Student's browser -> **Worker** (checks the login, holds the secrets, reads hidden tests) -> **OnlineCompiler.io** (compiles and runs the code) -> Worker saves the result, streak, XP in Firestore.
The browser never sees the API key, the hidden tests or the answer keys.

## Free limits (checked Nov 2026, re-check before launch)
* OnlineCompiler.io free plan: **100,000 runs per month**, 46 languages including Python, C, C++, Java and SQL (SQLite). One "Submit" runs every test case, so a problem with 7 tests uses 7 runs (about 14,000 submissions a month).
* Cloudflare Workers free plan: 100,000 requests/day, no card needed. A submit uses (tests + ~9) sub-requests; the limit is 50, so a question can have at most 30 tests (the question form enforces this).

## One-time setup (about 10 minutes)
1. **Regenerate your OnlineCompiler API key** (a key pasted in a chat or screenshot should be treated as public) and keep the new one private.
2. Create a free Cloudflare account (https://dash.cloudflare.com/sign-up). No payment details are required for Workers free.
3. Open a terminal in the `worker` folder: `npm install` then `npx wrangler login`.
4. Firebase console -> Project settings -> Service accounts -> **Generate new private key** (a .json file). Then:
   * PowerShell: `Get-Content .\key.json -Raw | npx wrangler secret put FIREBASE_SA_JSON`
   * Mac/Linux: `npx wrangler secret put FIREBASE_SA_JSON < key.json`
   Delete `key.json` from your computer afterwards.
5. `npx wrangler secret put ONLINECOMPILER_API_KEY` and paste the key when asked.
6. **Verify the languages on your own computer** (this really runs programs):
   * PowerShell: `$env:ONLINECOMPILER_API_KEY="YOUR_KEY"; node scripts/verify-judge.mjs`
   * Mac/Linux: `ONLINECOMPILER_API_KEY=YOUR_KEY node scripts/verify-judge.mjs`
   It prints PASS/FAIL per language and the exact `ENABLED_LANGUAGES = "..."` line. Paste that line into `wrangler.toml`. A language stays hidden from students until it passes. If it says a compiler id is not accepted, look up the right id at https://onlinecompiler.io/docs/compilers and set `ONLINECOMPILER_IDS` in `wrangler.toml` (for example `{"java":"openjdk-21"}`).
7. `npx wrangler deploy`. It prints a URL such as `https://avs-judge.YOURNAME.workers.dev`.
8. Put that URL in the project's `.env`: `VITE_JUDGE_API_URL=https://avs-judge.YOURNAME.workers.dev`, then `npm run build && firebase deploy --only hosting`.
9. In `wrangler.toml` make sure `ALLOWED_ORIGINS` has your real website addresses, then deploy the Worker again.

## What works before the judge is connected
Courses, videos, tests, library, jobs, schedule, lesson completion (with the time check) all work. Running/submitting code, XP, streaks and the leaderboard need the Worker.

## What the judge enforces
Hidden tests are returned as passed/failed only. Run never counts as solved. XP once per problem. 3 s between submissions and 20 runs/minute per student. SQL uses SQLite: put CREATE/INSERT setup in the test input.

## Not verified by me
My build machine cannot reach onlinecompiler.io, so the API calls were tested against a fake server built from the official documentation. Run step 6 to confirm on the real service. How compile errors, timeouts and memory kills are reported by the real API is handled defensively, and step 6 checks each one.
