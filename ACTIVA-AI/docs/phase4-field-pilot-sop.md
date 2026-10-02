# ACTIVA-AI Phase 4 — Field Pilot and Research Operations SOP

SOP version: ACTIVA-P4-SOP-001 | Status: DRAFT for PI/site/ethics sign-off.
Existing protocol: ACTIVA-P3-RP-001. This is research execution, not a replacement feature contract.
P4.3 readiness references: `phase4-cru-pilot-prelaunch-checklist.md` (authoritative human GO/HOLD decision) and `phase4-cru-data-management-plan-draft.md` (data authority/access/retention pending approval). Existing production Guest E2E PASS evidence in Issue #110 is reusable; do not require redundant test recruitment.

## P4 software interlock — implemented prior to field authorization

**Current research state is HOLD:** `ACTIVA_EMPIRICAL_COLLECTION_ENABLED=false` in the Production template. `QA_TEST` and ordinary operational events continue to work. Server-side API prevents new `EMPIRICAL` activities, signed empirical CHECKIN issuance/attendance check-in, empirical Guest Pass issuance/reissue, and empirical Guest consent/check-in while the gate is disabled or its authorization window has expired. Existing CHECKOUT/withdrawal remains available for operational safety.

Only after an authorized human PI verifies the actual CRU site/ethics decision, covered units, approved consent text/version, valid dates, non-research alternative, named independent coordinator and the **specific study stage**, the authorized deployment operator may set these PRIVATE configuration keys (never paste values into public GitHub or chat):

- `ACTIVA_EMPIRICAL_COLLECTION_ENABLED=true`; `ACTIVA_APPROVED_STUDY_STAGE=FEASIBILITY` or `MAIN`.
- `ACTIVA_ETHICS_DECISION_REF`, `ACTIVA_SITE_PERMISSION_REF` (non-placeholder references stored separately in restricted institutional records).
- `ACTIVA_APPROVED_CONSENT_VERSION` and `ACTIVA_APPROVED_CONSENT_TEXT_SHA256` — SHA-256 over the EXACT UTF-8 consent text that ADMIN enters for the Guest Pass, after normal field trimming; version and fingerprint must both match.
- `ACTIVA_ETHICS_VALID_FROM_UTC`, `ACTIVA_ETHICS_VALID_UNTIL_UTC` in UTC ISO format, with start inclusive/end exclusive.
- For `MAIN`, `ACTIVA_SAMPLE_PLAN_SIGNOFF_REF` must also identify the signed, source-backed prospective plan, not QA/test labels.

Production additionally requires normal Google OIDC and Production GO. An ADMIN can inspect `GET /api/research/collection-preflight`; it exposes only booleans, stage and blocking **codes**, never the private refs, signed consent text or hash. `collectionEnabled=true` is a configuration check, NOT independent authentication of institutional approval. The PI must still sign the specific field `P4.3 GO` in protected records. If the decision is revoked, a date expires, a consent version changes, or a new stage requires amendment, turn the switch OFF pending review; do not silently reuse earlier consent or promote QA_TEST rows.

CI uses a clearly synthetic, **disposable STAGING** configuration to exercise this guard; CI labels, synthetic sample counts and synthetic consent never constitute real approval or empirical study data. CI-only reference prefixes are rejected if copied to Production.

## Stage 0 — Before recruiting
- Human PI obtains traceable institutional ethics approval or documented exemption where applicable and site permission. Record authorized consent wording/version, secure retention, data handling, independent contact, withdrawal process and incident escalation. Do not upload personal identity mappings to GitHub.
- Train two different real independent AI-blinded human reviewers plus separate adjudicator using docs/ground-truth-codebook.md. Separate private bearer links do not prove reviewer independence on their own.
- Complete the source-backed assumptions in ml/phase3-sample-plan.json and run: python ml/plan_phase3_sample.py --plan ml/phase3-sample-plan.json --output ml/phase3-sample-plan-result.json. Human approval is required before final-test inspection. Freeze aggregate development-only GET /api/ml/planning-summary cutoff and SHA-256, leaving unknown numbers null.
- Confirm Production /api/live, /api/ready and /api/health, Render release, scheduled monitoring, backups, supported-camera QR behavior and manual fallback; record only redacted evidence.

## Stage 1 — Feasibility rehearsal
- Use QA_TEST only; log actual navigation, camera behavior, checkout, withdrawal, consent comprehensibility and operational incident counts. This is NOT empirical evidence and cannot be retrospectively relabeled EMPIRICAL.
- Staff verify identity in person. Guest bearer possession alone does not establish identity.
- A human reviews deviations and approves any prospective protocol/instrument amendment before recruitment.

## Stage 2 — Prospective EMPIRICAL collection
1. Following approvals, ADMIN creates a new future, OPEN EMPIRICAL activity with proper provenance attestation and time windows.
2. Coordinator privately assigns a pseudonymous offline SUBJ-... code and protects the re-identification key in a separate access-controlled registry. Plain code must not be exported.
3. Explain actual approved participant information and obtain explicit, voluntary, versioned research consent. Provide a non-research operational path where institutionally required.
4. Deliver Guest Pass privately. Never post bearer tokens, QR signatures, direct participant identity or unredacted screenshots into issues/chat.
5. Guest completes dynamic CHECKIN; distinct assigned STAFF/ADMIN witnesses physical identity separately; Guest completes dynamic CHECKOUT within the allowed window.
6. Record failed scans, missingness and exceptions truthfully; never manufacture attendance or late timestamps.
7. Honor consent withdrawal and revocation. Invalidate historical extracts/downstream models affected by a withdrawn case where required.

## Stage 3 — Independent Ground Truth
- Present source evidence without risk probability, AI predictions, peer labels or human-final-decision outcomes to both reviewers independently.
- Reviewer A and Reviewer B label target and reason codes using the same frozen versioned codebook; insufficient evidence follows PI-approved HOLD policy, not a forced invented target.
- After independent completion, adjudicator records disagreements, rationale and lock event. Report eligible paired labels and agreement/denominators. A single operator using two links is not independent review.

## Stage 4 — Empirical dataset and AI evaluation
- ADMIN obtains GET /api/ml/dataset (not the broader GET /api/research/export). Retain the original only in approved restricted storage, not in GitHub/CI/chat.
- Run npm run phase3:dataset-check -- --input [approved-locked-export.json] --sample-plan ml/phase3-sample-plan.json. Structural PASS does NOT authorize training when formal sample plan remains PENDING.
- Only after authorization, run ml/train_baselines.py with the approved sample-plan argument and EMPIRICAL_LOCKED_GROUND_TRUTH provenance.
- Preserve planning cutoff, unseen-participant prospective final-test firewall, development-only model/threshold/calibration selection and complete aggregate metrics with uncertainty. Do not inspect final test for tuning.
- Human research/operator committee reviews the evaluated model before any shadow decision-support pilot. Do not enable autonomous decisions or change personnel outcomes.
- Approved shadow trial, if applicable, logs human overrides and review duration without contaminating blind Ground Truth.

## Stage 5 — Evidence lock and reporting
- Reference, without embedding sensitive files: approval decision, signed sample plan, aggregate planning snapshot and cutoff, instruments/revision, recruitment flow, event summaries, consent/withdrawal handling, blind label/adjudication records, locked eligible dataset SHA-256, validator report, source commit, split/metric/model-card manifest, approved shadow pilot evidence, deviations and final report.
- Node CLI scripts/verify-phase4-closure.mjs produces a sanitized HOLD or completeness checklist; independent human checks the genuine existence/meaning of each cited artifact.
- CI deliberately requires the empty repository template to remain HOLD. A passing automated gate is necessary but never sufficient to authenticate an ethics decision, participant observations or scientific conclusion.

## Mandatory STOP conditions
Missing/expired approval or consent, leaked credential or personal identifier, QA data in an empirical export, reviewer independence breach, prohibited feature/target leakage, group overlap, insufficient approved sample, reuse of final-test labels for tuning, model deployment without human approval, or research provenance that cannot be reconstructed.
