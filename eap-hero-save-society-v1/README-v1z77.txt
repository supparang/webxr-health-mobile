EAP Hero v1z77 — Speaking Evidence Fix + Teacher Review Fields

Upload index.html and eap-hero.js. Open once with ?x=v1z77.

Changes:
- Fixes safeToast recursion that could make validation/submit appear to fail.
- Speaking pass uses only timer + completed checklist. Optional transcript cannot lower score, block submission, or affect pronunciation/grammar judgement.
- Speaking evidence now stores durationSec, targetRange, oralChecklist, optional transcript status, attempts, replay status, and teacher review fields.
- Teacher review is marked pending for Boss speaking sessions S3/S6/S9/S12/S15.
- Adds EAPHero.saveTeacherSpeakingReview(evidenceId,{code,score,comment}) for dashboard integration. Valid codes: CL PR FL ST EV QA.
- CSV export includes speaking evidence and teacher-review columns.
