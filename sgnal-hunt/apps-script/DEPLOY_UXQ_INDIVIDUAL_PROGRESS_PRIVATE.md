# CSAI2601 UX Quest — Private Teacher Individual Progress (W1–W15 + B1–B4)

**Purpose:** Show each Section 101 student's official game completion for all 19 W/B nodes, independently of Studio submissions and review statuses. This is a **private Google Apps Script web app**, not a GitHub Pages dashboard.

## Files in this change

- UXQuestIndividualProgress-v1.gs: read-only aggregation and strict teacher email authorization
- UXQuestIndividualProgressDashboard-v1.html: roster × 19 missions matrix and selected-student details
- UXQuestStudioRouterPatch-v1.gs: adds the private ?view=progress route and authorization for existing teacher routes
- teacher-dashboard/appsscript.json: declares webapp.access = MYSELF (previous version was anonymous/public)
- test_uxq_teacher_individual_progress.js: run from repo root with Node

## Install in **private teacher** Apps Script (NOT the public Student Receiver)

1. Open the Google Apps Script project that serves the **teacher-only** UX Quest Dashboard, signed in as the teacher. Keep a backup/version before editing.
2. Add the following files from this repository as separate source files:
   - UXQuestIndividualProgress-v1.gs
   - UXQuestIndividualProgressDashboard-v1.html
   - replace/update UXQuestStudioRouterPatch-v1.gs
   - if using the existing ?view=studio and ?view=portfolio, retain UXQuestStudioWorkflow-v1.gs, UXQuestStudioDashboard-v1.html and UXQuestPortfolioBuilder-v1.html
3. Go to **Project Settings → Script properties** and set:
   - UXQ_TEACHER_EMAILS: the **real** Google email used to sign into this teacher deployment. Separate multiple approved teacher emails with commas. This is mandatory; if absent, access is denied.
   - UXQ_IP_SPREADSHEET_ID: the ID of the official UX Quest Google Sheet containing UXQuest_Attempts (for this class the existing sheet ID was 1QYAAxF8q-m8-hLkCiFcwRVWMR0fx60ZkTswqP768Q7U). Use the correct production Sheet, not a test Sheet.
   - UXQ_TEACHER_SECTIONS: 101 (optional; defaults to 101).
4. There must be **only one** doGet(e) in the private teacher project. Before the current fallback/default teacher-dashboard view, route the private pages:

   ~~~javascript
   function doGet(e) {
     const privatePage = UXQ_routeStudioTeacherGet_(e);
     if (privatePage) return privatePage;
     return UXQ_teacherDashboardGet_(e); // existing teacher-only default
   }
   ~~~

   If a doGet(e) already exists, insert only the two lines beginning const privatePage and if (privatePage), instead of creating a duplicate function. Do **not** add this to the public receiver.

5. In the Apps Script Web App deployment choose **Execute as: Me** and **Who has access: Only myself**. Select **New version** and deploy. Pushing code to GitHub does not deploy Apps Script. Double-check actual **Manage deployments** settings: the source manifest alone does not change an existing deployment.
6. Use the actual private Web App URL followed by **?view=progress**, e.g. https://script.google.com/macros/s/YOUR_TEACHER_DEPLOYMENT_ID/exec?view=progress. Replace the placeholder with the already deployed teacher-only URL; no real deployment URL is stored in this repository.
7. Sign in as the whitelisted teacher and confirm Section 101. A logged-out/incognito browser or unlisted account must not see student records. The app deliberately fails closed when Apps Script cannot identify the active Google account.
8. Check one student with W1 passed/W2 not passed and one student with complete W/B history against the UXQuest_Attempts source sheet. Check Studio statuses separately in the optional UXQuest_Studio_Reviews sheet.

### What the screen means

- **✓ ผ่าน**: a confirmed mission_completed record with passed=true **or** at least 2 stars, in the contiguous path from W1. Matches the existing Progress Restore rule.
- **↻ ทบทวน**: attempted next mission, but no confirmed pass.
- **○ พร้อมเริ่ม**: next sequential mission has no attempt.
- **🔒 ยังล็อก**: previous mission not confirmed.
- **! ตรวจลำดับ**: passing evidence exists for this mission, but prior nodes do not form a contiguous chain. Isolated evidence **does not count** toward official completion.
- **Studio ส่งแล้ว/อนุมัติ/แก้ไข**: derived separately from artifact_submitted and UXQuest_Studio_Reviews; sending Figma is **not** equivalent to completing the game.

An optional UXQuest_Roster sheet with headings studentId, studentName, section will include students who have never attempted a mission. Without it, the dashboard shows only students with recorded attempts/submissions; it **cannot** establish nonparticipation from absence in the event log.

### Privacy and release criteria

**Never put student data or private teacher Apps Script URLs in GitHub Pages or a public repository.** Do not reconfigure the teacher deployment to ANYONE_ANONYMOUS. Never use Session.getEffectiveUser().getEmail() to identify viewers. Do not share teacher UI links with students. The private teacher dashboard performs email-allowlist checks on its data endpoint, but the Web App itself must also restrict access.

This repository change does not grant access to Google Apps Script deployments, change the live Web App, edit student rows, or assert the production Google Sheet is healthy. Live activation and teacher-account QA are pending until the owner deploys the private Apps Script code.

## Local non-data checks

From repository root:

~~~shell
node test_uxq_teacher_individual_progress.js
~~~

This tests canonical sequential passes, 2-star evidence, out-of-order W/B completion, Studio and mission separation, review approval tied to the matching artifact, roster-only students, Section/Course isolation, teacher allowlist rejection, and the private deployment manifest. It does not replace a live permission test.


## Upgrade: drill down into each W/B (21 October 2026)

The owner has already deployed a **standalone, private** UXQuest-Teacher-Progress Apps Script (not the original shared uxui receiver). Upgrade **that standalone teacher project only**:

1. In the standalone teacher project's Editor, replace **the full content** of the existing individual-progress .gs file with the latest contents of UXQuestIndividualProgress-v1.gs from this repository. Keep its .gs file type.
2. Replace **the full content** of the existing UXQuestIndividualProgressDashboard-v1 HTML file with the latest contents of UXQuestIndividualProgressDashboard-v1.html. Keep the exact HTML filename that the existing Code.gs calls. Google Apps Script usually displays the .html suffix in the editor, but createHtmlOutputFromFile receives the name without that suffix.
3. Do **not** replace Code.gs or change the existing doGet(e). Do not change Script properties. Do not edit, redeploy, or alter permissions in the shared uxui project/Student Receiver.
4. Save, then **Deploy → Manage deployments → select existing standalone teacher Web App → Edit (pencil) → Version: New version → Deploy**. Only changes deployed as a new version will appear on the same /exec URL. Use the existing private link; no ?view parameter is required in the standalone teacher project.
5. In the teacher Web App choose **Section 201** (or an allowed Section), choose a student, then click a W/B cell. Each cell now shows **x/3** for: official Mission pass + recorded Studio submission + explicitly authored Reflection.
6. In the individual details, click **รายละเอียด** next to a W/B. The expanded panel displays the 3 activity statuses, grouped Mission question-stage results from the latest saved mission attempt, Studio field completion (without showing response text), and separate Teacher Review/revision state.

**Important accuracy limits:** Question-stage answers are written to the Sheet only when the Mission result is submitted; intermediate unsubmitted game clicks are **not** visible. A legacy receiver may synthesize a reflection from evidence/problem/fix text; such text is shown as **unverified** rather than claiming the student completed Reflection. A 3/3 activity status does **not** mean that the teacher approved the artifact, and it does **not** change the existing mission unlock logic. The optional UXQuest_Roster is still needed for a complete class roster including never-active students; the current 16-vs-17 discrepancy cannot be adjudicated from activity data alone.

For regression tests from repo root: node test_uxq_teacher_substeps.js.
