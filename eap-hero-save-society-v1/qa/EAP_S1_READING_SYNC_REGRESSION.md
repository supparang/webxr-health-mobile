# EAP S1 Reading server-receipt regression checklist

This is a **non-destructive safety patch**, not a completed synchronization fix.

## Confirmed defect
- S1 Reading displays 100/100 and is stored locally with `pendingSheetSync: true`.
- The local result bridge only writes localStorage; it does not create a server receipt.
- `eap-evidence-sync-v131.js` uses `fetch(..., {mode:'no-cors'})` and records the evidence ID as sent before any server acknowledgement. This cannot prove persistence.
- Do **not** promote a browser-only score to official `EAP_Progress` or unlock S2 from it.

## Required implementation before release
1. Identify the actual Reading task completion event and its scored attempt payload. Never infer an official score from visible page text or legacy portfolio entries.
2. Send the original attempt to the correct EAP Hero Apps Script endpoint with a stable idempotency key and verify an explicit acknowledgement, or verify its presence through an authoritative read endpoint.
3. On network failure, retain pending state and retry without changing the score; only clear pending on verified persistence.
4. Verify that `player_resume` reports S1 Reading and Speaking both passed, then and only then unlock S2.
5. Regression test: offline/timeout, duplicate submission, 35-point Writing feedback isolation, refresh/new device, and existing student history preservation.

## Data safety
No existing Sheets rows, student records, grades, or saved browser results are changed by this patch. Do not replay a student's backed-up JSON as a server submission without teacher review and server-side validation.
