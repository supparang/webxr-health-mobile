# EAP Session Acceptance Audit — 2026-07-31

## Goal
Revalidate the current EAP Session production candidate after the EAP Vocabulary completion work and other repository updates.

## Authoritative flow under test
1. Official Section 122 identity resolves from Google Sheet.
2. A learner with no official progress starts at S1 only.
3. S1 Core + Support results are written to Sheet.
4. Navigation remains locked until the Sheet receipt and `player_resume` confirmation succeed.
5. Passing S1 unlocks S2; failing S1 remains at S1.
6. Closing and reopening restores the Sheet-authoritative current route.
7. Boss Speaking pending review remains blocked; reviewed/approved evidence advances.
8. Local storage cannot unlock a route.

## Findings

### Frontend authority mismatch
The production runtime had already moved to `server-resume-only`, but the old QA still expected `live-sheet-only` and browser-side raw-record route evaluation. This caused a false browser failure.

**Fix:** Production QA and Playwright contracts now validate server-issued route envelopes, localStorage tamper resistance, Boss pending/reviewed envelopes, and lock-guard diagnostics.

### S1 acceptance gap
The previous live test confirmed only that Reading and Speaking rows returned from Sheet. It did not assert that `currentRoute` became S2. The deployed Cloud Resume policy still represented normal routes as four-skill completion.

**Fix:** Apps Script Session Authority v137 defines the canonical Core + Support pair for every S1–S15 route and four required skills for every Boss. The live gate now requires S1 Core + Support to return `currentRoute: S2`, and a failed Support result to remain at S1.

### Boss evidence visibility failure
The deployed `submit_evidence` endpoint acknowledged successful Boss evidence creation, but deployed `player_resume` returned only S1 summary records. Boss pending/reviewed evidence was therefore unavailable to both progression and the Teacher Dashboard.

**Fix:** Authority v137 writes evidence into a resume-readable `events` row, merges evidence into `player_resume`, ranks reviewed evidence above pending evidence, and keeps Boss Speaking failed until reviewed/approved.

## Implemented files
- `eap-production-authority-v20260714.js` — server-resume diagnostics and lock contract.
- `eap-production-qa-v20260714.js` — current server-resume production QA.
- `qa/eap-browser-release.mjs` — tamper, resume-envelope, Boss and lobby tests.
- `apps-script/EAP_SessionAuthority_v137.gs` — Core + Support and Boss evidence authority.
- `herohealth/eap-word-quest/apps-script/SharedWebAppRouter.gs` — routes live resume/evidence to v137.
- `qa/eap-session-authority-v137-contract.mjs` — deterministic policy test.
- `qa/eap-live-progression-policy.mjs` — live pass/fail route test.
- `apps-script/EAP_SESSION_V137_DEPLOY_CHECKLIST.md` — safe deployment procedure.

## Current gate status
- Session Authority v137 static contract: **PASS**
- Canonical analytics contract: **PASS**
- Browser release contract: **PASS**
- Progressive dashboard contract: **PASS**
- Apps Script dashboard v7 UI contract: **PASS**
- Existing Apps Script endpoint probe: **PASS**
- Existing S1 write/read visibility: **PASS**
- Live S1 Core + Support → S2: **BLOCKED UNTIL V137 DEPLOYMENT**
- Live Boss evidence in `player_resume`: **BLOCKED UNTIL V137 DEPLOYMENT**
- Live Teacher Dashboard Boss evidence: **BLOCKED UNTIL V137 DEPLOYMENT**

## Release rule
PR #73 must remain unmerged until the existing Web App deployment is updated to Authority v137 and the complete live gate becomes green.
