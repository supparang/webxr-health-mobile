# ACTIVA-AI P4.3 — CRU Research Data Management Plan (DMP) for Ethics Review

**ID:** ACTIVA-P4-DMP-001 | **Version:** draft v0.1 | **Status:** NOT FIELD-APPROVED.
**Population:** consenting adult CRU lecturers and staff (18+), in separately authorized university units.
**Protocol linkage:** ACTIVA-P3-RP-001; `phase4-research-protocol.md`; `phase4-cru-recruitment-plan.md`; `phase4-field-pilot-sop.md`.
**Gate:** no recruitment, EMPIRICAL collection, real participant data exports, or empirical model training is authorized by this DMP.

## 1. Accountable owners and approval fields (human completion required)

| Function | Appointed individual / authority | Current status |
| --- | --- | --- |
| Principal investigator, CRU and protocol amendment owner | [PI to identify in controlled application] | PENDING confirmation |
| CRU site permission signatory / participating units | [Authorized office and units] | PENDING |
| Research coordinator independent of line-management decisions | [Authorized role and contact] | PENDING |
| Controller / responsible institutional data authority | [Confirm with CRU] | PENDING |
| Custodian of offline code-to-identity mapping | [Separate access-controlled custodian] | PENDING |
| System ADMIN and audit/backup custodian | [Approved production operator] | PENDING |
| Two distinct AI-blinded human ground-truth reviewers | [Private staffing register; not public GitHub] | PENDING |
| Independent adjudicator and study statistician | [PI to appoint] | PENDING |
| Ethics approval/exemption reference, effective dates, approved consent/version | [Committee determination] | NOT SUBMITTED |

This document proposes technical safeguards, not a legal-basis decision. The PI/CRU authorized officials must confirm applicable Thai PDPA/institutional rules, operational recordkeeping obligations, and consent/withdrawal wording.

## 2. Data-flow and purpose separation

```text
Ordinary CRU activity attendance (operational basis)
  ├─ attendance, verification, immutable audit and backups (restricted operator domain)
  └─ approved non-research attendance route for staff declining research

Research invitation -> voluntary research consent -> privately assigned SUBJ code
  ├─ code-to-identity mapping (separate encrypted institutionally controlled vault)
  └─ Guest Pass server stores purpose-scoped HMAC study hash / pass-token hash
        -> consent version + dynamic signed QR evidence + STAFF/ADMIN human witness
        -> separate blinded human labels A/B + adjudication + LOCK
        -> EMPIRICAL-only, eligible, de-identified GET /api/ml/dataset extract
        -> restricted research vault -> pre-specified grouped analysis/evaluation
        -> aggregate non-identifying research report / permitted manuscript
```

No raw bearer pass, participant QR secret, plaintext `SUBJ-...` code, full name, work email, employee number, national ID, phone or identity mapping may be stored in GitHub, GitHub Actions logs, public screenshots or ML export. `participant_hash` and `event_id` are grouping fields only, never predictors. Repeated attendance does not equal independent participants.

## 3. Data classes, location, protection, handling

| Classification | Examples | Permitted location/access | Research use and retention rule |
| --- | --- | --- | --- |
| OPERATIONAL_RESTRICTED | ACTIVA attendance, activity and audit, staff witness, operational identity | CRU-authorized production database, backup and named operators | Not automatically research data; statutory/administrative retention to be confirmed |
| IDENTITY_MAPPING_RESTRICTED | Private CRU personnel identity ⇄ pseudonymous study code | Separate approved encrypted vault under designated custodian, distinct from analysis vault | Used only for consent, longitudinal linkage, withdrawal/reconciliation; retention TBD |
| CONSENT_RESTRICTED | Participant information/consent version, timestamp, revocation | Restricted consent register and operational fields as approved | No HR disclosure of research acceptance/refusal; consent retention TBD |
| BEARER_SECRET | Raw Guest Pass, current signed QR and authorization token | Shown ephemerally only in its authorized interface/channel, token hash server side | Never store in research datasets, GitHub, figures, logs or exported forms |
| RESEARCH_PSEUDONYMIZED | Eligible participant_hash, event_id, pre-decision features, locked target, study timestamps | Restricted, versioned research storage controlled by PI/steward | Only new prospectively approved EMPIRICAL cases; withdrawal checks before each export |
| MODEL_RESTRICTED | Trained model and artifacts, splits, predictions, threshold, group-bootstrap reports | Restricted research evaluation environment; controlled manifest hashes | No autonomous personnel decisions; no public row-level predictions |
| PUBLIC_RESEARCH_OUTPUT | Aggregated flow, properly suppressed frequencies, descriptive metrics and methods | Approved report/manuscript | Check potential re-identification from small CRU units, activity categories and timestamp combinations |
| QA_TEST / UNCLASSIFIED | Synthetic/acceptance/old non-authorized activity evidence | QA or operational audit per policy | Never count in empirical enrollment, LOCKED training data or scientific results |

Storage vendors and approved hosting region, encrypted-at-rest and in-transit controls, exact access list, backup/PITR regime, lawful data transfer arrangements, access-review frequency, retention periods and destruction confirmations: **[PI/CRU data authority must fill before ethics submission].** Do not invent a universal retention duration.

## 4. Least-privilege roles

- Site authority approves participating units and lawful operational attendance pathway; must not receive individual research opt-in/out or AI score for personnel evaluation.
- Independent coordinator invites CRU adults, administers consent and coordinates private study-code mapping; direct line managers are not to collect named refusals for appraisal.
- Production ADMIN can issue/revoke approved Guest Passes and view necessary operational records under existing role permissions; cannot falsely be described as wholly unable to see consent-related operational fields.
- Assigned STAFF witnesses real-world identity for a case (bearer pass possession is insufficient); no unattended/automatic `identityVerified=true`.
- Two different real AI-blinded reviewers see only the approved evidence packet, not model predictions, Human Final Decision or each other's label; system link possession alone does not prove reviewer independence.
- Adjudicator acts only after both reviewers submit and records disagreement rationale before Ground Truth LOCK.
- Analyst receives eligible de-identified export and approved sample-plan artifacts, never plaintext subject mapping or direct staff identity; final test labels stay firewalled until all training/tuning decisions are frozen.

## 5. Withdrawal, revocation and versioned extract reconciliation

1. Accept approved withdrawal channel without negative effect on attendance certification or employment; verify the request within the protected code register. Do not put identities into public issue comments.
2. Update Guest consent/authorization status and revoke the pass if applicable; preserve immutable operational audit only to the extent required by applicable administrative/retention policy, separately from voluntary research use.
3. At every new export, apply the existing eligibility filter: only EMPIRICAL, consented, non-withdrawn/non-revoked, non-voided and valid LOCKED targets qualify.
4. Maintain restricted extract ledger (cutoff UTC, source commit/build, selection version, dataset SHA-256, case count and withdrawal-reconciliation status). Identify previous extracts/models/reports affected by withdrawn cases; restrict/retract/rebuild where the approved protocol and publication stage permit. The application does not automatically recall old downloaded exports.
5. If previously published anonymized aggregate results are not recoverable, explain that precise limitation in the approved information sheet; do not claim unconditional deletion of operational audit.
6. An incident involving loss of mapping, token exposure or cross-class data contamination is a STOP condition. Follow approved notification/escalation and document remediation before new research exports.

## 6. Analysis security and release firewall

- `QA_TEST` and `UNCLASSIFIED` must remain excluded, even if software acceptance/operational Ground Truth is LOCKED. Never promote old QA to EMPIRICAL retrospectively.
- Research training input comes from `GET /api/ml/dataset` only; `GET /api/research/export` is a different extract. Require `scope=EMPIRICAL_ONLY`, `datasetStatus=LOCKED_GROUND_TRUTH_ONLY`, `deidentified=true`, `aiPredictionsIncluded=false`, `syntheticDemo=false`, and an APPROVED `ml/phase3-sample-plan.json`.
- Freeze development-only planning snapshot hash and cutoff prospectively. Any participant seen at/before the cutoff remains development-only even for later events; final test uses prospectively unseen participants and pre-set record/class minima.
- Never tune model/threshold/calibration against final-test predictions or use human decision, adjudication outcome, AI score or direct identity as predictors. `aiAutonomousDecision=false` stays enforced.
- Public release contains methodological text, aggregate safe summaries, source commit, code/document versions and SHA-256 of protected artifacts; no recoverable row-level extract or small-cell identifying staff composition without documented disclosure review.

## 7. Pre-submission decisions to resolve

- [ ] CRU decides actual data authority, secure storage and identity-key custodian.
- [ ] PI records source and consent/legal separation for required operational records versus voluntary research.
- [ ] PI/ethics confirm recruitment, access, withdrawal and independent complaints contact.
- [ ] Record per-class retention/deletion schedule and backups, including incident and archival rules.
- [ ] Determine whether any external processor/vendor or cross-border transfer needs explicit approval and data protection controls.
- [ ] Set approved small-cell suppression/reporting policy and risk assessment for identifiable event-time combinations.
- [ ] Version/freeze this DMP with formal protocol before recruitment.

**Not to be inferred:** Producing this document is not ethics approval, institutional site permission, proof of data protection compliance or evidence of real participants.
