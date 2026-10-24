# S1 Reading verified-receipt repair — staged release checklist

## Root cause and scope

S1 Reading 100/100 can be stored in the browser while `EAP_Progress` still has
no Reading receipt. The old core used `fetch(..., {mode:'no-cors'})`, then
immediately marked `state.sheetSync.sent[attemptId]` even though the response
was not verifiable. Transport v124 also fabricated HTTP 204 after an iframe
submission. A local result bridge creates browser-only result evidence and
**must not be used to fabricate an official submission**.

## Changes on draft PR #172

- `eap-hero.js`: no longer marks a new attempt `sent` without a server receipt.
  Existing `sheetSync.sent` and historical results are kept unchanged.
- `eap-sheet-transport-v124.js`: captures only the **fresh core-game**
  `submit_attempt` for S1–S15; queues its **original stable attemptId**,
  sends POST `text/plain` to the configured Hero endpoint, and retries using
  the same ID after transport failures. No local portfolio scan or backfill.
  Boss submissions retain their previous transport and teacher-review flow.
- `SharedWebAppRouter.gs`: explicit `submit_attempt` POST branch validates
  score/identity/receipt key, calls `eapHeroSubmitAttemptGuarded_`, then
  `eapRouterRequireProgressV153_` to mirror the accepted attempt.
- The posted `evidenceId` is exactly `attemptId`. A queued result is marked
  confirmed only when a fresh, matching **authoritative** `player_resume`
  returns the same section/student, S1/skill, best score and evidence ID.
  An opaque HTTP response is **never** a confirmation.
- `index.html` busts the previous script cache.

## Offline regression test

`node eap-hero-save-society-v1/qa/eap-reading-receipt-contract.mjs`

This test uses Node VM mocks, not the production Apps Script or real student
identities. It covers no synthetic ACK, durable pending, incorrect evidence
receipt, score downgrade, conflicting duplicate ID, identical-ID retry,
confirmation, no browser-only local backfill, and guarded receiver mirroring.
The existing browser CI imports this test before launching Playwright.

## Release sequence (NOT YET EXECUTED)

1. Confirm GitHub CI `browser-contract` succeeds. Existing
   `live-sheet-contract` is against the **current deployed** backend and
   does not prove this new Apps Script/router has been deployed.
2. In the same Apps Script project as the official `EAP_ProgressAuthority_v150.gs`,
   install/update `SharedWebAppRouter.gs`; confirm the guarded
   `eapHeroSubmitAttemptGuarded_` and `submitAttempt_` functions are
   available and **exactly one active** `doGet` and `doPost` are present.
   The repo contains legacy router implementations; do not deploy them together.
3. Deploy a new Apps Script **version** at the configured Hero `/exec` URL.
   Read-only `?action=router_health` should show
   `progressAuthorityInstalled:true`,
   `attemptReceiverInstalled:true`, and
   `guardedAttemptReceiverInstalled:true`.
4. Using a fresh **QA-only Section 122-QA identity** (not an enrolled student),
   exercise S1 Reading then Speaking. Confirm `EAP_Progress` contains
   the matching `readingEvidenceId` and `speakingEvidenceId`, and
   `player_resume.currentRoute` becomes `S2`.
5. Only after this round trip succeeds, approve merging PR #172 into the
   branch used by GitHub Pages. Verify the new transport query version loaded
   and `window.EAPHeroTrustedTransportV124.diagnostics()` moves from
   pending to confirmed for the QA attempt.
6. Check an offline retry, reopen in the same browser, lower-score second
   attempt, Boss Speaking pending review, and existing student record
   preservation before declaring the fix released.

## Existing student's prior Reading 100

That student's browser-only `localResult:true,pendingSheetSync:true` record
is preserved. The repair **does not retroactively submit or trust** such
a record. Verify an original game-generated attempt ID and its evidence,
then use an instructor-reviewed reconciliation process through the supported
backend. Never clear localStorage, delete Sheets rows, manually set S2 unlocked,
or replay the DOM-derived local score as an unquestioned official attempt.

## Known limits

- The patch has not been merged or deployed. CI verifies code contracts only.
- A later lower-scoring retry may remain pending if `EAP_Progress` deliberately
  preserves a different, higher-scoring evidence ID. That case needs a
  read-only per-attempt server receipt before implementing automatic resolution.
- Existing legacy Boss transport is intentionally unchanged.
- The backend still relies on its existing learner authentication and
  attempt validation model; `submissionKind` by itself is **not** an
  authentication credential.
