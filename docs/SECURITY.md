# Security checklist

## Already built in
* **Secrets never reach the browser.** The OnlineCompiler key and the Firebase service-account key live only as Cloudflare Worker secrets. `.env` contains only public Firebase web identifiers.
* **Firestore rules** (default deny): students cannot read hidden test cases or answer keys, cannot write progress/XP/streaks/leaderboard, cannot change their role or status, cannot see other students' data. Admin-only writes for settings, departments, users.
* **Server-side judging**: the Worker verifies the Firebase login token, checks the account is active, limits request size and rate (20 runs/min/student), and only then calls the judge.
* **Strict website headers** (`firebase.json`): CSP (only your own scripts + Monaco CDN + YouTube/Vimeo/Drive players), HSTS, no framing (clickjacking), no MIME sniffing, referrer and permissions policies.
* Safe rendering: lesson text is rendered without raw HTML (no script injection); video links must be https; external links open with `noopener`.
* CSV exports protect against spreadsheet formula injection. Registration needs admin approval. Duplicate register numbers are rejected.

## Do these in the consoles
1. **Firebase -> Authentication -> Settings**: enable *email enumeration protection*; keep *Authorized domains* to your own domains only.
2. **Google Cloud Console -> APIs & Services -> Credentials**: restrict the browser API key to your website addresses (HTTP referrers).
3. **Firebase App Check** (optional, free reCAPTCHA): protects Firestore/Auth from non-browser abuse.
4. Create the first admin immediately after deploying the rules (`/setup`), use a strong password, and keep few admins.
5. Rotate the OnlineCompiler key if it was ever shared; set a spending/usage alert in Google Cloud if you later add a billing account.

## Known limits
* Firebase enforces only a 6-character minimum for passwords on the server; the app asks for 8+ with letters and numbers, but this is a client-side rule. (Identity Platform password policy would enforce it server-side.)
* The CSP was tested against the app with a mock backend; if a feature is blocked after deploying (check the browser console), add the missing host in `firebase.json`.
