# Firebase setup (project: avs-coding-portal)

The web keys are already in `.env`. Do these ONE-TIME steps, otherwise login/registration will hang or fail:

1. **Authentication** -> Sign-in method -> enable **Email/Password**.
2. **Firestore Database** -> Create database (production mode, region `asia-south1`). *Without it every screen keeps loading.*
3. **Publish the security rules** (needed for registration, admin pages and security):
   ```
   npm i -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules
   ```
   **No Firestore indexes are needed any more** (the app was changed to avoid them; `firestore.indexes.json` is empty). If you ever see "The query requires an index", you are running an old build.
4. `npm install && npm run dev` -> http://localhost:5173
5. **Create the first admin**: open `/setup`. The first account created there becomes the admin and the page closes itself. If you already registered a student account, sign in and open `/setup` to turn it into the admin. Do this right after step 3.
6. As admin open **Academic setup**: add departments (students cannot register until one exists), years and sections.
7. **Users** -> *Add user* creates faculty / placement coordinator accounts. New student registrations appear there instantly (and as a red badge on the menu).
8. Judge Worker (coding practice, XP, streaks, leaderboard): free setup in `docs/JUDGE_SETUP.md`. Security checklist: `docs/SECURITY.md`.
9. Deploy the site: `npm run build && firebase deploy --only hosting`.

## Videos and notes
* **Links (free, default):** upload the video to YouTube as *Unlisted* (or Google Drive: share "anyone with the link") and paste the link in *Courses & videos*. YouTube, Vimeo, Google Drive and direct `.mp4` links play inside the portal.
* **File upload (optional):** needs Cloud Storage for Firebase, which requires the **Blaze (pay-as-you-go) plan**. If you decide to use it: enable Storage, `firebase deploy --only storage`, then tick *Allow file uploads* in Academic setup. Until then the upload buttons stay hidden.

## Password-reset emails not arriving?
Firebase sends from `noreply@avs-coding-portal.firebaseapp.com`; Gmail/Outlook often put it in **Spam/Junk**. It only sends to an email that has an account. Better delivery: Authentication -> Templates -> set up a custom SMTP sender. The app has a 60-second resend button.

## Security notes
* The Firebase web API key is public by design; protection comes from the rules. You can restrict the key to your domains in Google Cloud Console -> Credentials.
* First-admin setup is open until the first admin exists.
