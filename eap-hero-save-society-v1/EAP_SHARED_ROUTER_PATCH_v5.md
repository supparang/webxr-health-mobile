# EAP_Code.gs Shared Router Patch v5

Apply these additions in the **existing** `EAP_Code.gs` Apps Script file. Keep one `doGet()` and one `doPost()` only.

## A. Add inside `doGet(e)`

Place this after the existing `teacher_students` branch and before the Word Quest branches:

```javascript
if (action === 'player_resume') {
  return out_(eapPlayerResume_(p), callback);
}
```

## B. Add inside `doPost(e)`

Place these after the existing `submit_event` branch and before the Word Quest branch:

```javascript
if (action === 'submit_evidence') {
  return out_(submitEvidence_(payload));
}

if (action === 'submit_speaking_audio') {
  return out_(submitSpeakingAudio_(payload));
}
```

## C. Add these files to the same Apps Script project

- `EAP_PlayerResume.gs`
- `EAP_EvidenceReview.gs`
- `EAP_BossFourSkillLedger.gs`
- `EAP_BossEvidenceReviewLauncher.gs`
- `EAP_BossEvidenceReview.html`
- `EAP_BossFourSkillLedger.html`

Save, authorize once if prompted, then **Deploy → Manage deployments → Edit → New version → Deploy**. The public endpoint used by the student site must point to this deployed version.
