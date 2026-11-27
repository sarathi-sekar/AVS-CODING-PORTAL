# Architecture

```
React + Vite + TS + Tailwind (Firebase Hosting)
   |  Firebase Auth (email/password)       Firestore + Security Rules
   |                                         ^
   +--- Bearer ID token ---> Cloudflare Worker (worker/)  --service account--+
                                  |
                                  +--> Judge0 CE (self-hosted, sandboxed execution)
```
* `src/shared/*` - pure logic used by both the app and the Worker: streak rules (IST), verdicts, XP/levels/badges, skill levels. Unit tested.
* `worker/src/core.ts` - all trusted operations (run, submit, practice/lesson start+complete, assessment start/submit). Works against a `Store` and a `Judge` interface, so it is tested with an in-memory store and real local compilers.
* Firestore rules deny every client write to progress data, hidden tests and answer keys.
* Theme tokens in `src/index.css` (`:root`, `.dark`), saved locally and on the account.
* Layout: icon rail on desktop, header + drawer on mobile; the code page uses tabs on mobile and a draggable split on desktop; Run/Submit stay in a sticky bar on mobile.
