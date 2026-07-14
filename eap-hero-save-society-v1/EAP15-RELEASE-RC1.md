# EAP Hero 15-Session Production Release

## Scope
- Section 122; Year 2; CEFR A2–B1+.
- S1–S15 plus B1–B5.
- Google Sheet/Cloud is the sole official source for progress and unlock decisions.
- localStorage is limited to UI/profile/runtime cache and cannot unlock a route.
- Boss Speaking remains blocked while review is pending/revise and advances only after reviewed/approved evidence.

## Production pages
- Student game: `eap-hero-save-society-v1/index.html`
- Fast Teacher Console: `eap-hero-save-society-v1/teacher-dashboard-fast.html`
- Teaching Pack: `eap-hero-save-society-v1/teaching-pack-15-sessions.html`
- Browser QA: add `?eapqa=1` to the student game URL.

## Automated release evidence
- Content and choice contract: 584/584 checks.
- Browser contract: localStorage tamper cannot open B5; fresh Sheet-shaped S1 records open S2; Boss pending stays at B1; reviewed advances to S4.
- Live Apps Script/Sheet contract: new identity has no progress; S1 Reading/Speaking write and restore; Boss pending blocks; reviewed evidence passes; fast teacher roster and selected-student evidence resolve correctly.
- QA writes only to Section `122-QA` and does not mix with teaching Section `122`.

## Canonical policy
1. Normal Session: Core + Support at least 60; Exposure does not block.
2. Boss Gate: Reading + Listening + Writing + Speaking at least 60.
3. Boss Speaking additionally requires reviewed/approved teacher status.
4. A student without a matching live Sheet record starts at S1 only.
5. Best score is retained, while latest evidence metadata remains visible through Cloud records.
