# EAP Word Quest — Google Sheets Setup (Group 122)

## Deploy once

1. Open the Google Sheet that will collect EAP Word Quest data.
2. Choose **Extensions → Apps Script**.
3. Replace the default `Code.gs` with `Code.gs` from this folder.
4. Run `setupEapWordQuest()` once and allow permission.
5. Choose **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the deployed URL ending in `/exec`.
7. Open `herohealth/eap-word-quest/eap-word-sheet-config.js` and put that URL in:

```js
endpoint: "PASTE_YOUR_EXEC_URL_HERE",
```

8. Commit and wait for GitHub Pages to refresh.

## Verify

Open the deployed URL with:

```text
?action=health
```

Expected response includes `ok: true` and `service: EAP Word Quest Sheets`.

Then open the Teacher Dashboard:

```text
/herohealth/eap-word-quest/teacher.html
```

Paste the same `/exec` URL into **Google Sheets Connection**, click **บันทึก URL**, then **โหลดจาก Google Sheets**.

## Fresh-student smoke test

Use a new Student ID that has never been used in the browser:

1. Enter name + new Student ID and keep group `122`.
2. Complete S1 once.
3. Wait a few seconds, then load Google Sheets from the teacher dashboard.
4. Confirm the student appears with S1 attempt, accuracy, XP, status, and Weak Words.
5. Replay S1 with a lower score: the student should still keep the best-pass progress.
6. Continue through one Boss Gate and confirm its 70% gate rule; BG5 uses 75% and 24 questions.

## Sheets created automatically

- `eap_word_profiles`
- `eap_word_attempts`
- `eap_word_summary`

The sheet stores every attempt plus one best-progress summary per student and session. The Teacher Dashboard reads the attempt history to show students, session overview, Weak Words, and individual Arc progress.
