# EAP Analytics Canonical v7 — Deployment and Live Acceptance

Target Apps Script Web App:

`AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A`

This is item 5 after Analytics items 1–4 have passed and merged.

## A. Files to place in the SAME Sheet-bound Apps Script project

Do not change `EAP_Code.gs`, `SharedWebAppRouter.gs`, Hero receivers, Word Quest receivers, Identity Map, Player Resume, or Evidence Review during this deployment.

1. **Add or replace Apps Script file `EAP_AnalyticsCanonicalV7.gs`**
   - Source: `eap-hero-save-society-v1/EAP_AnalyticsCanonicalV7.gs`

2. **Replace all content in Apps Script file `EAP_TeacherDashboard.gs`**
   - Source: `eap-hero-save-society-v1/EAP_TeacherDashboardDeployV7.gs`
   - This preserves the public names used by the Sheet menu and Web App router.

3. **Replace all content in Apps Script HTML file `EAP_DashboardTeacher`**
   - Source: `eap-hero-save-society-v1/EAP_DashboardTeacherCanonicalV7.html`
   - The Apps Script HTML file name must remain exactly `EAP_DashboardTeacher`.

## B. Preflight before deployment

1. Click **Save project**.
2. Select function `eapAnalyticsV7Preflight`.
3. Click **Run** and authorize if asked.
4. The execution must finish successfully and return an object with:
   - `ok: true`
   - `version: v7.0-CANONICAL-OFFICIAL-LEARNERS-122`
   - no Guest/QA learner leak
   - Word average `null` when Word player count is zero

Do not deploy if the preflight throws an error.

## C. Create a new Web App version

1. Open **Deploy → Manage deployments**.
2. Edit the existing Web App deployment.
3. Under **Version**, choose **New version**.
4. Description: `EAP Analytics Canonical v7 — official learners + canonical Hero/Boss/Word`.
5. Keep the existing execution identity and access setting. The public game endpoint must remain accessible as before.
6. Click **Deploy**.

The `/exec` URL must remain the same.

## D. Live acceptance immediately after deployment

Open:

`/exec?action=eap_teacher_dashboard&section=122&v=analytics-v7`

Confirm the subtitle contains:

`Canonical official-learner view v7`

Expected invariants:

1. `Guest` is absent from the official learner table.
2. Guest/QA rows are visible only in **Data quality → Quarantined** count.
3. Hero records are deduplicated by learner + canonical Session + Skill.
4. Boss Speaking is at most one latest record per learner per B1–B5.
5. A learner with `pending_teacher_review` or `resubmit_support` is shown in Teacher Action / Needs Support, not plain Active.
6. Word Quest player count and Word Best Accuracy use the same official learner population.
7. If Word Quest player count is zero, Word Best Accuracy displays `—`.
8. KK / ID 50 remains at B1 while B1 Speaking is pending.
9. KAT / ID 2 remains at S1 if required S1 mastery is incomplete, regardless of later historical rows.

## E. Automated live verification

Run GitHub Actions workflow:

`EAP Analytics v7 Live Acceptance`

It calls:

`qa/eap-analytics-v7-live-acceptance.mjs`

The workflow must verify:

- endpoint version is canonical v7
- no Guest/test learner leak
- canonical Boss count <= learners × 5
- Word count and average population agree
- pending Boss learners have `review` status
- canonical counts do not exceed raw counts

## F. Teacher Review acceptance

After v7 Analytics is confirmed:

1. Open **EAP Analytics → เปิด Boss Speaking Review**.
2. Filter Section 122 and `รอตรวจ`.
3. Open KK / ID 50 / B1.
4. Select concise feedback codes as appropriate: `CL, PR, FL, ST, EV, QA`.
5. Save as `ตรวจแล้ว` or `ให้ฝึกซ้ำ`.
6. Refresh Boss Review and Canonical Analytics.
7. Confirm the latest B1 record persists with the selected status.
8. If marked reviewed/approved and the other B1 skills pass, reload the student game and confirm KK advances to S4; if marked resubmit, KK remains at B1.

## Rollback

If v7 acceptance fails:

1. Open **Deploy → Manage deployments**.
2. Edit the deployment and select the previous working version.
3. Deploy without changing the `/exec` URL.
4. Keep v7 source files in the project for diagnosis; do not delete Sheet history.
