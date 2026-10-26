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


## QA fixes for teacher progress display (21 October 2026)

The existing privately deployed standalone Teacher Progress Web App needs **only two source-file replacements and a new deployment version**:

- Latest UXQuestIndividualProgress-v1.gs (adds **read-only section-scoped identity audit**; never changes student data).
- Latest UXQuestIndividualProgressDashboard-v1.html (fixes missing review score, Mission vs Studio dates, more explicit retry message).

After copying both files into the **standalone UXQuest-Teacher-Progress** project, Save, then **Deploy → Manage deployments → Edit pencil → New version → Deploy**. The existing private /exec URL stays unchanged. Do **not** update, deploy, or change access rights of the old shared uxui receiver project.

### Fixed cases

- Empty/missing/unset Teacher Review score: hide the score suffix, never display "undefined/100", but preserve valid zero scores.
- A Mission play does not imply Studio was submitted: display distinct **Mission last played** and **Studio last submitted** columns, using "—" when no Studio submission exists.
- W1 Mission with 1 attempt / 1 star: show **played 1 time, not yet passed**, and suggest which saved answer stages need additional reasoning. Questions answered != Mission passed.
- New **ตรวจสอบความต่างของจำนวนนักศึกษาในชีต** disclosure: compares unique student IDs from UXQuest_Attempts in the currently selected Section against IDs eligible for this progress dashboard. Shows excluded identities and event/course/mission metadata for teacher-only troubleshooting. It cannot reconcile a mismatch if Dashboard v6.2 uses a different data source, a different section filter, or a separate roster. Do not assume the 16-vs-17 discrepancy has been resolved before checking real data.

Regression test from repository root: node test_uxq_teacher_progress_display_qa.js.


## Teacher-only matrix clarification (26 Oct 2026)

This release changes ONLY the standalone private UXQuest-Teacher-Progress read-only view. It does NOT change the student Receiver or public games, and it does not update/delete Google Sheet rows.

**Crucial distinctions:**
- **ผ่าน Mission** (historic): student's saved game passes on the 19-node path. Never retract historical results.
- **ครบ 3/3 (รวม)**: saved Mission + Studio + student-authored Reflection for any node. Teacher Review is NOT required.
- **ครบ 3/3 (ต่อเนื่อง)**: full 3/3 from W1 in order, used to calculate the next allowable node under the proposed policy.
- In the W/B matrix **🔒 2/3 เกม✓** means the student previously passed the game and submitted two parts, **but W/B entry would be locked under the 3/3 policy**. Selecting the cell still shows preserved historical evidence.
- **○ 2/3** on W1 means W1 is accessible to finish missing Studio/Reflection, not that the entire W1 assignment is complete.
- **✓ 3/3** means all three activities are recorded in sequence.

**This teacher view is a policy simulation on saved Sheet evidence, not proof the production Student Receiver enforces 3/3.** The production receiver and web runtime remain gated by draft PR #170. Do not tell students they are locked until backend-first deployment QA is finished.

### Upgrade the already-deployed private teacher Web App

1. Open the standalone Apps Script project UXQuest-Teacher-Progress, NOT the old shared uxui receiver.
2. Replace the full source of UXQuestIndividualProgress-v1.gs and UXQuestIndividualProgressDashboard-v1.html with the latest files from the GitHub main branch.
3. Keep the existing รหัส.gs, Script properties, teacher allowlist and the same Google Sheet ID. Do not create a new Sheet.
4. Save and select Deploy → Manage deployments → Edit → New version → Deploy. The old private teacher /exec URL stays the same.
5. Test a student with 18 historic Mission passes but 0 complete 3/3: the teacher view should show 18/19 historic and 0/19 full, W1 accessible to complete, W2–W15/B nodes locked under policy. Prior scores remain viewable.
6. The Section 201 count discrepancy (16 versus 17 students) still needs roster reconciliation. This patch does not create/edit a roster.

Regression from the repository root:
node test_uxq_teacher_three_part_matrix.js


## 2026-10-26: Read-only Reflection evidence audit (investigate widespread 2/3)

The standalone **UXQuest-Teacher-Progress** private Web App now shows an additional section:
**ตรวจหลักฐาน Weekly Reflection (อ่านอย่างเดียว)**.

The section aggregates the latest saved artifact_submitted event for each (student ID, W/B node) in the selected Section. It reports:
- Explicit Reflection field found and nonblank in either rawJson.artifactFields or the separate artifactFields sheet column.
- Explicit Reflection field exists but is blank.
- Top-level reflection text exists but no explicit nonblank field exists (ambiguous: an old Receiver may synthesize that text from other responses).
- No usable evidence or parse problems.
- **Explicit Reflection is present in a source but the old Teacher Progress calculation did not count it.** This is a diagnostic mismatch, NOT automatic approval or unlock.

The summary includes a 19-node breakdown and source counts; it does **not** display student Reflection response text. The individual W/B detail shows only evidence category/source and a nonconclusive synthesized-text indicator.

**Caution:** A high count of 2/3 can mean missing submissions, missing explicit Reflection fields, old Receiver fallback, truncated rawJson, or inconsistent parsing precedence. None of these possibilities alone proves a student failed to do the work. Do not tell all students to resubmit, adjust scores, approve old text or enforce the 3/3 live student gate until the real production source is reconciled.

Only source files for the private teacher project are updated. No Sheets are written, no roster added/edited, no account permissions changed, no student receiver or public game JS changed. The existing draft student-enforcement PR #170 remains unmerged.

To upgrade the private teacher Apps Script project:
1. Replace the contents of its UXQuestIndividualProgress-v1.gs and UXQuestIndividualProgressDashboard-v1.html with the current GitHub main branch versions.
2. Keep รหัส.gs, Script properties and the existing private deployment permissions unchanged.
3. Save → Deploy → Manage deployments → Edit → New version → Deploy. Reuse the existing /exec URL, select Section 201 and inspect the new Reflection audit panel.
4. Compare audit evidence counts with the per-person W/B details before any grading/policy decision.

Synthetic regression test (no student data involved):
node test_uxq_reflection_provenance_audit.js
