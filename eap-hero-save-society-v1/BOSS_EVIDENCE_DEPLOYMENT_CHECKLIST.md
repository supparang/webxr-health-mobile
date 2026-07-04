# EAP Hero Boss Evidence — Deployment & Acceptance Checklist

## 1. Student site

The GitHub Pages build now includes:

- `eap-boss-review-event-bridge-v1.js` v2: writes **all four** B1–B5 skill evidences through the active `submit_event` receiver; only Speaking enters Teacher Review.
- `eap-boss-completion-sync-v1.js`: writes a separate `B1–B5 | Boss Clash` pass after the real `Boss Defeated!` screen.
- `eap-boss-speaking-audio-ui-v1.js` v2: optional, consent-based recording for the current Boss Speaking UI. It does not affect the game score or automatic pass rule.

Reload the student page with **Ctrl + Shift + R** before testing.

## 2. Apps Script files to add

Add these repository files to the **same Apps Script project** that contains the deployed `EAP_Code.gs` router:

1. `EAP_EvidenceReview.gs`
2. `EAP_BossFourSkillLedger.gs`
3. `EAP_BossEvidenceReview.html`
4. `EAP_BossFourSkillLedger.html`
5. `EAP_BossEvidenceReviewLauncher.gs`

Then apply the two-branch router change shown in `BOSS_EVIDENCE_ROUTER_PATCH.md` inside the current `doPost(e)`.

Save the project, run `showEapBossEvidenceReview` once to authorize the new UI, and deploy a new Web App version if the student endpoint is public.

## 3. What must appear in Google Sheets

### `events`

Each new Boss Gate should create four skill-evidence rows:

- `eventType`: `eap_boss_skill_evidence` for Reading, Listening, and Writing
- `eventType`: `eap_boss_speaking_evidence` for Speaking
- `sessionId`: `B1` through `B5`
- learner output stored in `valueJson.output`
- Speaking additionally stores duration, checklist, consent flag, and `pending_teacher_review`

### `summary`

After the actual Boss victory screen, a separate row should appear:

- `sessionId`: `B1` through `B5`
- `skill`: `Boss Clash`
- `passed`: `TRUE`

It is intentionally separate from the four skill-evidence rows and the Speaking review item.

### `evidence_audio`

Only when a learner actively gives consent and records audio:

- one file metadata row per evidence ID
- Drive file link accessible to the teacher account

## 4. Teacher acceptance test

1. Open `showEapBossFourSkillLedger` and confirm B1 has Reading, Listening, Writing, and Speaking evidence.
2. Open `showEapBossEvidenceReview` and confirm the B1 Speaking row appears as **รอตรวจ**.
3. Inspect its duration, checklist, speaking note, and optional audio.
4. Select concise codes from `CL, PR, FL, ST, EV, QA` and add an optional note.
5. Save as **ตรวจแล้ว** or **ให้ฝึกซ้ำ**.
6. Refresh both dashboards: the proof and review state must persist.

The teacher review gives formative feedback only. It does not replace the game score or automatically judge grammar/pronunciation.

## 5. Scope boundary

Previously completed B1 records from before this update are not reconstructed from Reflection text. That would misrepresent learner evidence. New or replayed Boss submissions are captured correctly.
