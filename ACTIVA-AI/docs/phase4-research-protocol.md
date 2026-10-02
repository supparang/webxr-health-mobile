# ACTIVA-AI Phase 4 — Prospective Research Evaluation Protocol (DRAFT FOR HUMAN APPROVAL)

Protocol: ACTIVA-P3-RP-001 (existing scientific baseline; Phase 4 is the **research execution workstream**, not a replacement protocol).
Software baseline: Phase 3 P3.3 merge commit `10b8b60e7ed9081bd5e3eb1640824c77d9f2071a`.
Status: RESEARCH_HOLD — pending ethics/governance decision, sourced sample plan, real cohort and outcome evidence.
Protocol owner: designated principal investigator. No AI agent may approve participant recruitment, ethics, model deployment or a personnel outcome.

## Scientific objective and questions

Primary question (unchanged from the established protocol): can ACTIVA-AI distinguish records needing review (`REVIEW_REQUIRED`) from `NO_REVIEW_REQUIRED` using only pre-final-decision evidence, with acceptable calibration and without identity, participant, target or temporal leakage?

Secondary prospective questions, with estimands to be finalized before recruitment:
- How feasible is the accountless Guest Pass/check-in/check-out and human identity-witness process in real use?
- What is the completeness and timeliness of operational attendance evidence?
- How consistently do two independent, AI-blinded reviewers apply the versioned Ground Truth codebook?
- In a shadow pilot, what review workload, disagreement and timing are observed when AI advice is **non-binding**?

Do not claim improvements, superiority or statistical significance without a pre-specified comparator and observed data. The production health value `ai=no-deployed-model` is compatible with the current software baseline; it is not an evaluated empirical AI model.

## Design and eligibility

1. Controlled feasibility pilot, then prospective observational empirical data collection, then a temporally and participant-separated final test and optional shadow decision-support evaluation after human model approval.
2. The proposed P4.1.2 recruitment setting is **adult lecturers and staff (18+) at Chandrakasem Rajabhat University (CRU)** within authorized activities and sites; students and external organizations are not included in this draft setting. Site permission, selected CRU units, precise study dates, expected number of events, eligibility/exclusions and withdrawal handling remain subject to PI and relevant ethics/institutional review. An independent coordinator should invite staff; a direct manager/HR evaluator must not pressure subordinates or use named research opt-ins in performance assessment. Employment, activity certification, attendance approval and benefits must not depend on joining research. An authorized non-research operational attendance route must be evidenced before recruitment, not presumed.
3. ADMIN creates a **new prospective** `EMPIRICAL` activity with `empiricalAttestation=true` only after approvals. Preserve the `QA_TEST` designation for all acceptance fixtures; never promote or relabel QA data retrospectively.
   **Current software eligibility rule:** only an explicitly consented, non-withdrawn/revoked GuestParticipant linked to an eligible attendance may enter empirical research extracts. A registered User can still record normal operational attendance in an EMPIRICAL activity, but that record is excluded from research because a separately versioned registered-user research-consent registry is not yet implemented. To join the approved CRU research, an eligible adult uses the approved private pseudonymous Guest route; do not reinterpret login/activity assignment as research consent.
4. Guest flow: privately assigned pseudonymous `SUBJ-...` offline code, approved versioned consent, anonymous bearer pass, freshly signed in/out QR, separate on-site identity witness, immutable audit. Store identity-code mapping outside GitHub/exports under the approved retention/access schedule.
5. Individual can refuse/withdraw without operational penalty; revocation and exclusion logic are applied before each refreshed extract. Identify and invalidate historical exported extracts following withdrawal.

## Measurement and provenance

Primary binary target: `REVIEW_REQUIRED` versus `NO_REVIEW_REQUIRED`. Two **different** AI-blinded human reviewers independently label the same eligible case using `docs/ground-truth-codebook.md`; record disagreement and adjudication; lock before empirical modelling. A single ADMIN attestation is not two independent reviews.

Prediction moment: `AFTER_EVIDENCE_COLLECTION_BEFORE_HUMAN_FINAL_DECISION`.

Eligible research export: `GET /api/ml/dataset`; use `scripts/validate-phase3-dataset.mjs`, `ml/phase3-feature-contract.json` and the approved `ml/phase3-sample-plan.json`. `GET /api/research/export` is a distinct broader operational/research extract and must not substitute for the LOCKED Ground Truth model-training contract. No raw bearer token or direct participant identity in the dataset, research report or repository.

## Sample size: blocking prespecification

For the bounded CRU lecturer/staff recruitment frame, additionally document how the required numbers of **unique adults**, activities and unseen future participants can actually be recruited without counting repeated attendance as independent persons; see `docs/phase4-cru-sample-planning-worksheet.md`. If single-site feasibility cannot support the approved predictive study, seek a prospective model-complexity/design amendment or ethics-authorized staged feasibility study rather than reducing minima after inspecting outcomes. Complete the existing Riley/pmsampsize planning method (`docs/v1.1.0-phase3-sample-size-method.md`) using documented development-only prevalence, model-strength source, candidate parameters (12 numeric/binary plus K-1 for K prespecified activity types), shrinkage target, final test holdout, participant/event clustering minima and optional high-discrimination simulation. `ml/phase3-sample-plan.json` currently remains PENDING, and MUST NOT be marked APPROVED using guesses or by reading final-test labels. Freeze the `GET /api/ml/planning-summary` cutoff and SHA-256 of its approved aggregate snapshot. An appropriate institutional human reviews/signs approval.

## Analysis plan (prospective; no results asserted)

- Feasibility: invitation, consent, check-in, witnessed identity, completed check-out and withdrawal denominators; report missingness and reasons.
- Usability: use the separately versioned instrument in `docs/phase4-instruments.md`; report item-level frequency and descriptive summaries. Do not call custom items a validated scale without validation.
- Ground Truth: cross-tab of two blinded reviewers and Cohen's kappa where appropriate; adjudication count/time; assess class imbalance and missingness.
- Prediction: participant-group development split; development-only model selection by validation PR-AUC; fixed threshold/calibration; prospective unseen-participant final-test firewall. Report precision, recall, specificity, F1, ROC-AUC, PR-AUC, Brier score, calibration curve and cluster-bootstrap 95% CIs. Describe denominators and uncertainty; do not retune on final test.
- Models: existing Logistic Regression, Random Forest, Gradient Boosting. Interpret permutation importance as predictive, not causal.
- Optional operational comparison: record separately specified reference workflow, observation window, common eligibility and reviewer workload/time measures; if not prespecified or observed, label exploratory only.
- Shadow AI: human retains decision authority; report AI ↔ locked ground truth and human agreement, overridden recommendations, review timing and any adverse effects. No autonomous personnel decisions.
- Deviations, missing data, duplicate records, withdrawal and infrastructure incidents belong in the deviation register before analysis.

## Safety and stop rules

STOP/HOLD if consent/approval missing or expired; non-EMPIRICAL/withdrawn/revoked/voided data enters an extract; tokens or PII leak; same human serves as both blinded reviewers; labels can see model predictions; sample plan remains PENDING; leakage/final-test group overlap; deployment lacks human approval; or data provenance is irreproducible. Record corrective action and human sign-off before restarting.

## Execution sequence and artifacts

1. Operational sign-off, including real-device QR disclosure QA and Render release confirmation.
2. PI/ethics review of this protocol, consent and instruments; register approval/reference and applicable dates in an access-controlled location.
3. Approved sample plan and its aggregate planning snapshot; field-site readiness and staff/reviewer training.
4. Small prospective feasibility pilot, log deviations, revise only with documented amendment; do not quietly pool a contaminated pilot with the final cohort.
5. Empirical collection; two-reviewer ground truth/adjudication; re-export and validate the eligible LOCKED dataset.
6. Offline model evaluation and final-test firewall; human model approval; shadow pilot if approved.
7. Freeze dataset, code, model manifest, evaluation, decision log, anonymized outputs and manuscript; archive according to institutional policy.

Completion is determined by the fail-closed `scripts/verify-phase4-closure.mjs` gate plus independent human review; an automated PASS is evidence of completeness, never proof that an ethics approval or field observation is authentic.
