# CSAI2601 UX Quest — Strict 3/3 unlocking: safe rollout (21 Oct 2026)

## Confirmed classroom rule

Every W/B next node requires **all three prior-node activities**, verified from Google Sheet UXQuest_Attempts with an exact student ID, Section and course:
1. Mission: mission_completed passed=true or 2+ stars, in canonical order.
2. Studio Practice: artifact_submitted.
3. Weekly Reflection: latest Studio artifact must include an explicitly written, nonblank artifactFields entry with key reflection.

A teacher's later Review approval is separate; waiting for instructor feedback must NOT stop classroom progression. All 19 W/B nodes are in scope. Historical student rows are never modified or deleted.

Example: W1 mission passed and Studio not submitted = 1/3; W2 stays locked. When Studio + authored Reflection are recorded in the Sheet, W1 becomes 3/3 and W2 opens. W3 still requires W2 3/3.

## CRITICAL RELEASE ORDER: Receiver first, student GitHub Pages second

The live Apps Script project **uxui** is a combined project containing UXQuestUnifiedReceiver-v4.2.gs, Studio Confirmation, and a teacher v6.2 interface. Do NOT replace its unified receiver with the standalone UXQuestStudentReceiver-v4-Artifacts.gs from GitHub. That standalone source is a reference for new receivers, not a replacement for the deployed uxui project.

GitHub Pages may update immediately when changes enter main. If frontend JS enforcing 3/3 ships before Apps Script returns the new explicit Reflection status, students can be permanently locked even when they have the required work. **Keep the PR unmerged until backend production QA passes.**

### 1. Prepare STAGING

Back up the current uxui project and production deployment version. Create a STAGING Apps Script project and use a nonproduction copy of UXQuest_Attempts. Preserve the single existing doGet and doPost, Student Receiver URL, and allowed Section configuration. NEVER test destructive changes on real student rows.

### 2. Install backend into the existing unified Receiver *in STAGING*

- Add UXQuestThreePartWriteGate-v1.gs as a new source file. It defines UXQ_WG_check_ but NO doGet/doPost.
- Replace the Studio Confirmation Production Patch v2 source file with latest UXQuestStudioConfirmationProductionPatch-v2.gs from the repository (preserve required integration).
- In the existing UXQuestUnifiedReceiver-v4.2.gs source file, find UXQ_receivePost_. Insert the following check **after the duplicate eventId check and before UXQ_appendRow_(sheet, row)**:

~~~javascript
if (typeof UXQ_WG_check_ !== 'function') {
  return UXQ_json_({ok:false,error:'three_part_write_gate_not_installed'});
}
const gate = UXQ_WG_check_(sheet,row);
if (!gate.ok) {
  return UXQ_json_({
    ok:false,error:gate.error,
    blockedBy:gate.blockedBy||'',missing:gate.missing||'',
    missionId:row.missionId
  });
}
~~~

- In doGet(e), insert this route **before the progress-actions / hasIdentity fallback**, because Studio GET also carries studentId and section:

~~~javascript
const studio = UXQ_routeStudioConfirmationV2_(e);
if (studio) return studio;
~~~

Do not introduce duplicate doGet/doPost functions. Do not alter existing student rows or history.

### 3. STAGING verification before production

- GET action=uxq_student_progress: response must include ok:true plus diagnostics.canonicalPassedMissionIds.
- GET action=uxq_student_studio_progress: response must contain exact studentId/section/courseId and the new per-node reflectionEvidence property.
- POST W1 Mission: accepted.
- POST W2 Mission when W1 Mission passed but Studio not submitted: rejected with three_part_node_locked, blockedBy=w1, missing=studio.
- POST W1 Studio with blank Reflection: accepted but W2 still blocked (missing=reflection).
- POST W1 Studio with authored nonblank Reflection: W2 accepted.
- W3 remains blocked until W2 is 3/3.
- No progress from another Section or student ID is accepted as a prerequisite.
- Duplicate eventIds remain idempotent, and existing real rows are unchanged.
- A reflection text synthesized from problem/fix fields without a real authored reflection field is not accepted.

Once the tests pass, update the original production uxui Apps Script project, choose **Deploy → Manage deployments → Edit → New version → Deploy**, then verify its real /exec endpoint with controlled test accounts/records.

### 4. Release GitHub runtime

**Only after step 3 is production-verified**, merge the student runtime Pull Request:
- Direct W/B entry checks both Google Sheet endpoints and blocks until all previous 3/3 nodes are verified.
- Mission Control uses the same three-part rule; old mission-only button overrides cannot reopen locked nodes.
- Student UI no longer says the next node is unlocked immediately after a Mission pass.
- Student UI explicitly distinguishes a locally passed Mission from a Sheet-confirmed result.
- New query versions prevent stale script caches.

### 5. Update the standalone private teacher Web App

In UXQuest-Teacher-Progress (separate from uxui), replace:
- UXQuestIndividualProgress-v1.gs
- UXQuestIndividualProgressDashboard-v1.html

Save, then Deploy → Manage deployments → Edit → New version. This makes W2 display **locked** while W1 is 1/3 and retains historical Mission scores.

## Historical students and limitations

Do not delete or rewrite prior Mission, Studio, or Reflection evidence. Some students had previously accessed future nodes before the new rule; keep their records but require 3/3 for future submissions under the new policy.

Old saved reflection text may have been assembled automatically by the Receiver. Those rows remain unverified unless an explicit Reflection artifactFields entry exists; a fresh Reflection submission may be needed.

Client-side JavaScript alone cannot enforce a secure authentication boundary. The crucial authoritative layer is the write-side rejection of new events for future nodes without the 3/3 prerequisites. Public QA preview mode does not count as official Sheet completion.

Regression tests:
- node test_uxq_three_part_unlock_policy.js
- node test_uxq_teacher_substeps.js
- node test_uxq_teacher_progress_display_qa.js

**Production status must remain PENDING until Apps Script production deployment and real Student Mode E2E tests pass.**
