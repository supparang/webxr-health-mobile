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


## Fix on 26 Oct 2026: explicit ninth Reflection was incorrectly shown as 2/3

A real Teacher Progress screenshot showed Mission passed, Studio submitted,
and the read-only provenance panel reporting **raw_artifactFields explicit
Reflection**, but the activity status remained "2/3 / unverified."

**Root cause:** UXQ_ipFields_(row) displayed and returned only the first
eight Studio fields. UXQ_ipReflectionState_ incorrectly reused this truncated
display list to calculate the official Teacher Progress Reflection activity.
The independent provenance audit correctly scanned the full artifactFields
array, hence the contradiction.

**Read-only fix in the private Teacher Progress backend:**
- Reflection status now uses the complete provenance record from both
  rawJson.artifactFields and the artifactFields spreadsheet column.
- The eight original Studio chips remain, and an explicit ninth Reflection
  field is shown as an additional chip when present.
- A genuine nonblank Reflection field in either source counts toward 3/3.
- Top-level reflection text without the explicit field stays UNVERIFIED:
  legacy receiver may have synthesized it from problem/reason/fix answers.
- A newer submission with an empty Reflection overrides an older submission
  with a filled Reflection; no historical rows are deleted.
- Teacher Review approval is NOT required for 3/3 eligibility.

For the screenshot-style case, **W1 Mission + Studio + explicit ninth
Reflection = 3/3; W2 becomes eligible in this teacher-side read-only
calculation**. This is not proof that the actual student game has deployed
the 3/3 enforcement gate; the production Student Receiver rollout remains
separate in draft PR #170.

**Deploy into the existing private UXQuest-Teacher-Progress** project:
1. Replace only UXQuestIndividualProgress-v1.gs from the latest main branch.
2. Keep the existing HTML, Code.gs, Script properties and Google Sheet untouched.
3. Save → Deploy → Manage deployments → Edit → New version → Deploy.
4. Reopen the same private /exec link, Refresh data for Section 201 and inspect
   the original W1. Verify that the ninth Weekly Reflection chip is present,
   W1 reflects 3/3 and W2 is eligible according to teacher policy.
5. Run the synthetic regression from repository root:
   node test_uxq_reflection_field_over_eight.js

No new or edited Google Sheet records are needed. Do NOT tell students to
resubmit a Reflection that already exists in an explicit saved field.


## 2026-10-26: Action queue for the first incomplete W/B

The private Teacher Progress dashboard now includes **งานที่ควรติดตามต่อ • ด่านแรกที่ยังไม่ครบ 3/3** (read-only).

For each student in the selected Section, it identifies the first W/B in
the full 19-node order which has not satisfied Mission + Studio + explicitly
authored Reflection. It shows historical completed but now-policy-locked
future nodes without changing those records. A student with 18/19 historic
Mission passes and no complete Reflection at W1 appears as **W1: check
Reflection**; 17 later game results remain preserved as history.

Per-student outcomes:
- mission: no contiguous Mission pass at the first incomplete node.
- studio: Mission passed, Studio event not recorded.
- reflection_review: Studio exists, but top-level text or unreadable
  source leaves authorship uncertain; manually inspect source before asking
  the student to resubmit.
- reflection_missing: latest Studio has no explicit authored Reflection
  and no ambiguous text (including a blank explicit Reflection field).
  Inspect existing student work before asking for new submission.
- complete: all 19 nodes have 3/3 in order.

The teacher can filter the action queue by action type or use the existing
name/Student ID search; selecting **เปิดรายบุคคล** jumps to the exact
first-incomplete W/B for detailed evidence. No new data fields or Sheet
columns are created, and Teacher Review remains separate from unlock logic.

This is a **teacher-side policy assessment**, NOT proof that the live
student runtime enforces 3/3. The production student release in draft
PR #170 is still on hold pending backend QA.

Install only into the standalone **UXQuest-Teacher-Progress** Apps Script:
1. Replace the full source of UXQuestIndividualProgress-v1.gs from GitHub main.
2. Replace the full HTML of UXQuestIndividualProgressDashboard-v1.html.
3. Leave Code.gs, Script properties, Sheet ID, original uxui receiver, and
   all student rows unchanged.
4. Save → Deploy → Manage deployments → Edit → New version → Deploy.
5. Test Section 201 action queue and one known student with history past the
   first incomplete W/B. Confirm no history was deleted.

Synthetic regression: node test_uxq_teacher_first_incomplete_action.js.


## 2026-10-26: Correct Action Queue showing everyone as "ครบทุกด่าน" / counters zero

Observed in a real screenshot: one student had "ครบต่อเนื่อง 7/19" in
the action queue but the action column said "ครบทุกด่าน";
every counter (Mission/Studio/Reflection) was zero. Another student
had a genuine W1 Mission 0/3 in the per-node detail.

Root cause: the newer HTML action queue assumed every student had a
nextAction object, which is returned by the newest
UXQuestIndividualProgress-v1.gs backend. A private deployment using
older .gs code returned detailed W/B records but no nextAction. HTML
converted an empty nodeId into the FALSE label "ครบทุกด่าน".

**Teacher-only fix:** if nextAction is missing/invalid, calculate a
read-only fallback from the 19 W/B nodes already in the response,
including fullThreePart, Mission, Studio, and explicit Reflection.
Never infer "course complete" from a missing object.
A visible warning reports incompatible source versions and asks for
a new .gs deployment. If node details are incomplete, display
"ข้อมูลตรวจงานไม่ครบ" instead of inventing completion.
This fallback is provisional and must not be used for official grading
until both source files are from the same version.

**Deployment, no student data changes:**
1. Open existing PRIVATE Apps Script project UXQuest-Teacher-Progress.
2. Replace BOTH the .gs and .html files with the latest GitHub main
   versions of UXQuestIndividualProgress-v1.gs and
   UXQuestIndividualProgressDashboard-v1.html.
3. Preserve รหัส.gs, private teacher allowlist, Script properties,
   spreadsheet ID, student Receiver, and all Sheets/rows.
4. Save. Deploy → Manage deployments → Edit pencil → New version → Deploy.
5. Reload original /exec URL; select Section 201. A student with
   7/19 contiguous completed must not say "ครบทุกด่าน". When the
   version-mismatch warning disappears, the newly deployed backend
   is supplying nextAction as expected.

Synthetic regression: node test_uxq_teacher_action_schema_mismatch.js.

This is read-only reporting. Do not merge or deploy student runtime
draft PR #170 as part of this fix.


## 26 October 2026 — Legacy Receiver Reflection source diagnostics

A real instructor screenshot showed a learner with 18/19 historical Mission passes,
19/19 submitted Studio artifacts, but zero independently confirmed Reflection
fields. The old receiver code has two important documented behaviors:

1. UXQuestStudentReceiver-v4-Artifacts.gs normalizes submissions using
   payload.artifactFields.slice(0, 8). A ninth authored Reflection inside
   artifactFields could therefore have been excluded from this historical
   receiver version's stored rawJson/Sheet artifactFields, **even if the
   browser originally sent it**. This is a possible data-capture limitation,
   not proof of nonparticipation.
2. If payload.reflection is blank, that receiver can set the top-level
   reflection field to a string joined from problemSeen, uxReason and
   fixAndTest with " | " delimiters. Merely finding a nonblank
   top-level reflection cannot establish who authored it.

The private teacher dashboard now reports **READ-ONLY, NON-AUTHORITATIVE**
diagnostic signals for the latest Studio event for each student and W/B:
- Reflection field explicitly nonblank (eligible under the teacher
  3/3 read-only policy assessment).
- Top-level Reflection text matching the old Receiver's concatenation
  formula (indicator ONLY, not proof of automatic generation).
- Exactly eight Studio fields without independently confirmed Reflection
  (possible old eight-field limit; eight fields can also be legitimate).
- Other ambiguous top-level text, missing fields, and parse errors.

Counts per class and W/B are allowed to overlap. The server sends
**category/count only**, not a learner's original Reflection response.
Instructor detail shows the category but not the response text.

Do not treat a pattern match as conclusive evidence that the system created
the student's answer: a student may independently enter the same text.
Conversely, this diagnostic cannot reconstruct a missing ninth field.
Do not silently award 3/3, automatically penalize students or order an
entire class to resubmit based on these indicators.

Installation into existing PRIVATE UXQuest-Teacher-Progress:
1. Update UXQuestIndividualProgress-v1.gs and
   UXQuestIndividualProgressDashboard-v1.html from GitHub main.
2. Leave the existing private Code.gs, Sheet ID, Script properties,
   teacher allowlist, student Receiver, saved attempts and reviews as is.
3. Save → Deploy → Manage deployments → Edit → New version → Deploy.
4. Reopen the current /exec URL; choose Section 201; inspect the
   Reflection audit signal counts and the first stuck W/B per student.

No spreadsheet rows or student scores are edited.
No new Student Receiver or student web runtime is activated.
PR #170 remains draft and withheld pending safe backend-first rollout.
Synthetic test: node test_uxq_teacher_legacy_receiver_signals.js.
