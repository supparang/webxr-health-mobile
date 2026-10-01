# ACTIVA-AI — Phase 4 Research Results and Manuscript Framework

Version ACTIVA-P4-REPORT-001 | STATUS: TEMPLATE — NO EMPIRICAL RESULTS AVAILABLE.
Source protocol: ACTIVA-P3-RP-001. Study execution SOP: phase4-field-pilot-sop.md.
All brackets below are unfilled analysis placeholders; do not publish or describe them as observed results.

## Proposed title (subject to protocol/journal fit)

Prospective Evaluation of ACTIVA-AI: A Human-Governed Participation-Evidence Verification System with Accountless Guest Access and Explainable Review Prioritization

## Abstract (fill only after data lock)
Background: [document the specific operational and scientific gap with verified citations].
Objective: examine feasibility, integrity and predictive discrimination/calibration for REVIEW_REQUIRED versus NO_REVIEW_REQUIRED without autonomous personnel decisions.
Methods: [actual design, approved recruitment window, participant/event denominators, ethics/exemption ref, two independent blind reviewers, adjudication, prespecified sample plan, unseen-participant final-test firewall].
Results: [NO RESULTS — insert observed counts and metrics only after reproducible analysis].
Conclusion: [to be written after observed results and limitations are assessed].

## Methods to reproduce
- Setting, sample frame, recruitment, non-response, consent/withdrawal, activity eligibility, approval dates and protocol deviations.
- Application revision and version, operational policy and absence/presence of a deployed AI model during each observation period.
- Data provenance (EMPIRICAL_ONLY, LOCKED_GROUND_TRUTH_ONLY, deidentified, no AI prediction in predictors); codebook and blinded independent reviewers.
- A priori sample-size assumptions, calculation output, source dates, frozen planning cutoff/sha, participant/event clustering and final-test minimums.
- Reproducible modelling: Logistic Regression, Random Forest, Gradient Boosting, preprocessing, fixed feature contract, validation-based PR-AUC selection, calibration and validation-frozen threshold.
- Prospective unseen-participant final test, leakage checks, interval estimation, missingness strategy and prespecified shadow pilot.

## Tables and figures — EMPTY UNTIL RESULTS
Table 1: recruitment and participant/event flow (invited, consented, checked in, checked out, identity witnessed, withdrawn, eligible).
Table 2: device/browser pilot feasibility and error rates, with separate denominators.
Table 3: questionnaire U01–U10 item distributions, NA and missing rates (not an unvalidated global score).
Table 4: independent reviewer A×B confusion/cross-tab, agreement, disagreements, adjudication.
Table 5: eligible LOCKED case class distribution and activity breakdown; QA_TEST and withdrawn count separately excluded.
Table 6: development vs final-test groups, dates, class minima, zero participant overlap and data quality.
Table 7: candidate model validation metrics without final-test leakage.
Table 8: selected/frozen model final-test precision/recall/specificity/F1/ROC-AUC/PR-AUC/Brier/calibration and cluster-bootstrap intervals.
Table 9: optional shadow pilot workload, overrides, agreement, human review time and incident summary.
Figure 1: user-role + evidence pipeline with guest consent, independent witnessed identity and human-final-decision boundary.
Figure 2: prospective research flow and locked snapshot/held-out cohort.
Figure 3: ground-truth A/B adjudication path.
Figure 4: calibration and PR/ROC plots **only from observed final-test predictions**; do not display synthetic CI plots as research findings.

## Reporting checks
- Report all planned outcomes, null/negative findings, participant/event denominators and uncertainty. Don't infer causality from an observational pilot or explanatory importance.
- Distinguish software CI QA results, retrospective operational acceptance and prospective empirical study findings in separate subsections.
- Model state path CANDIDATE → EVALUATED → APPROVED → DEPLOYED is controlled by humans; do not label CI trained models clinically/operationally validated.
- Report approval/exemption and consent honestly. If ethics not granted, state not recruited, not ethics-approved and no empirical results.
- Validate references and in-text citations against original sources before submission; publication is a separate journal decision.

## Non-identifying release index to finalize
- protocol/instruments/SOP versions;
- approval register IDs under restricted institutional custody;
- source commit and runtime release evidence;
- sample plan SHA-256, planning snapshot SHA-256 and cutoff UTC;
- deidentified locked dataset hash and validation report hash;
- final-test firewall/split/model/evaluation artifacts and software versions;
- deviation log and withdrawal reconciliation;
- model governance sign-off, shadow pilot, report and human closure decision.

**Current report conclusion: NOT YET ESTABLISHED.** Do not fill the Results section from CI, QA_TEST or a manually simulated dataset.
