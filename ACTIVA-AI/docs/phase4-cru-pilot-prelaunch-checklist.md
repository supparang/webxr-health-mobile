# ACTIVA-AI P4.3 — CRU Prospective Pilot Pre-launch and Evidence Handoff

**Document ID:** ACTIVA-P4-PREFLIGHT-001 | Draft v0.1 | **Decision: HOLD — NOT AUTHORIZED TO RECRUIT**
**Recruitment population:** adult lecturers and support/academic staff (18+) of Chandrakasem Rajabhat University; actual participating units need written site permission.
**Baseline protocol:** ACTIVA-P3-RP-001. Research instruments: ACTIVA-P4-INST-001. Technical baseline: P3.3 plus Phase 4 prep on main.

This is a field execution gate, NOT an order to start the study. Do not manufacture an ethics decision, a prospective event, a participant, a second human reviewer, ground truth or model performance merely to satisfy this list.

## 1. Previous evidence we REUSE (do not repeat accepted software E2E)

| Completed software evidence | Source / relevance | What it does NOT establish |
| --- | --- | --- |
| Production Guest acceptance | [Closed Issue #110, final acceptance report](https://github.com/supparang/webxr-health-mobile/issues/110#issuecomment-5934162413): authorized ADMIN and separate Guest completed `QA_TEST` Guest Pass, consent, dynamic QR check-in/out, recorded identity witness attestation, persistence/audit, research exclusion | Does not turn the guest into an EMPIRICAL subject or independently authenticate physical witnessing |
| Dynamic QR renderer regression | PR #112 merged; `tests/qr-render.mjs`; postmerge CI recorded PASS | Does not independently certify visual disclosure/rotation observation on a real smartphone |
| Integrated software QA | [Main ACTIVA-AI CI #668](https://github.com/supparang/webxr-health-mobile/actions/runs/36889883526): guest E2E, blind review, QA isolation, sample planner, final-test firewall, synthetic ML/prediction bundle all PASS | No real blind human agreement, approved recruitment or empirical accuracy |
| Production availability | [Production Monitor #10](https://github.com/supparang/webxr-health-mobile/actions/runs/36884289025): push-triggered SUCCESS, classified `TRANSIENT_RESPONSE_RECOVERED` | Not proof of a naturally scheduled monitor pass or Render cold-start root cause |

Do not ask the operator to redo the whole Guest Check-in/Check-out merely because the research workstream is at P4.3. Only narrowly unresolved visual/deployment checks should be requested when strict sign-off requires them.

## 2. Blocking pre-launch release matrix — complete with actual evidence

| Gate | Evidence required | Owner | At draft |
| --- | --- | --- | --- |
| G01 | Relevant CRU ethics determination, decision reference, effective dates, approved protocol and consent versions | PI / competent ethics authority | **HOLD: NOT SUBMITTED** |
| G02 | Written CRU permission listing participating faculties/offices, activity types and recruitment route | Authorized CRU site office | HOLD |
| G03 | Source-backed Riley/pmsampsize assumptions and approved `ml/phase3-sample-plan.json`; if the committee authorizes feasibility-only staging, scope and amendments must be documented before any main AI evaluation | PI / statistician / ethics as applicable | HOLD: PENDING |
| G04 | Neutral coordinator independent of direct personnel evaluation; named role stored privately; no HR access to refusal list | PI/site | HOLD |
| G05 | Actual operational attendance alternative usable by staff declining research consent, with site signoff | Event organizer/site | HOLD |
| G06 | `phase4-participant-information-consent-th.md` and `phase4-instruments.md` reviewed, versioned, comprehensibility/quality review actually documented | PI / ethics / instrument reviewers | HOLD: DRAFT |
| G07 | `phase4-cru-data-management-plan-draft.md` completed for actual controller, custodian, access roles, storage, retention, backup, incident and withdrawal process | PI / CRU data authority | HOLD: DRAFT |
| G08 | Actual separate reviewer A, reviewer B and adjudicator recruited/trained; no shared actor/two links; AI-blinded codebook version | PI / research coordinator | HOLD |
| G09 | Redacted Render release/operation evidence and mobile QR-specific visual acceptance if independently required | Authorized technical operator | PARTIAL: prior software QA passed |
| G10 | Final CRU activity calendar, prospective eligibility, incident reporting channel, audit/event retention and independent research safety contact | PI / CRU authorized office | HOLD |

**Release rule:** Start any prospective human research activity only after every relevant gate is independently confirmed and the PI signs a protected dated `P4.3 GO` decision. An ethics-reviewed feasibility-only study is not authorization to skip a later protocol amendment or to inspect a held-out final test early. Research export/training may have stricter gates than permission to conduct initial feasibility observation.

## 3. Workflow after genuine human P4.3 GO (not before)

1. PI freezes the approved protocol, actual CRU units and dates, inclusion/exclusion, informed-consent version, authorized data roles, privacy/retention and the intended study stage (feasibility or main AI development). Keep private signed approval artifacts outside public GitHub.
2. Record the real neutral recruitment channel and demonstrate normal attendance remains available to nonresearch participants. Never send named refusal lists to line managers/HR.
3. ADMIN creates a new future authorized `EMPIRICAL` activity only if the stage is approved for research and prospective provenance attestation is true. `QA_TEST` acceptance cases stay quarantined forever and never become prior empirical data.
4. Coordinator privately assigns pseudonymous offline `SUBJ-...` code and logs actual consent. System delivers private Guest Pass; participant checks in/out using signed purpose-specific fresh QR within time windows; separate assigned staff witnesses physical identity.
5. Operator collects actual U01–U10 responses and event/incident records only as approved, with UTC timestamps and denominator tracking. Missing, refused and failed steps remain missing/failed, never reconstructed as successful.
6. Two different real blinded reviewers independently annotate each eligible attendance using frozen `ground-truth-codebook.md`; adjudicate disagreements and LOCK only with recorded rationale. Exclude unresolved/HOLD records rather than assigning convenient targets.
7. Before each extract, resolve withdrawals and verify classification, consent, non-voided status and provenance. Store de-identified export in restricted approved storage, with checksum and cutoff. Do not add participant rows or bearer tokens to public CI or GitHub.
8. When the **approved** sample plan's distinct participant/event/record/class minima are met, validate the eligible LOCKED export and run offline analysis. The prospective unseen-participant final-test firewall and human decision authority are mandatory.
9. Evaluate/approve model and any permitted shadow trial separately. Freeze aggregate scientific reports and record limitations, discrepancies and genuine human closure sign-off.

## 4. Blank P4.3 field logs (not participant data)

Complete these forms only in authorized **restricted study storage**. The public document shows schema/blank placeholders, not completed fieldwork.

### Pilot Session Log
`study_protocol_version` [ ], `ethics_permission_reference` [ ], `site_permission_reference` [ ], `consent_version` [ ], `event_ref` [ ], `event_start_utc` [ ], `event_end_utc` [ ], `activity_data_classification` [ ], `observer_role` [ ], `environment_browser_device` [ ], `invited_n` [ ], `consented_n` [ ], `checkin_attempt_n` [ ], `checkin_success_n` [ ], `identity_witnessed_n` [ ], `checkout_attempt_n` [ ], `checkout_success_n` [ ], `withdrawn_n` [ ], `locked_ground_truth_n` [ ], `incident_count_n` [ ], `study_stage` [ ], `versioned_extract_hash` [ ].

### Deviation and Incident Register
`incident_ref` [ ], `UTC_detected_at` [ ], `phase` [ ], `classification` [ ], `impact_without_identity` [ ], `containment` [ ], `deviation_from_approved_protocol` [ ], `withdrawal_affected_extracts` [ ], `human_reporting_authority` [ ], `corrective_action` [ ], `closeout_decision` [ ], `UTC_closed_at` [ ]. Stop and report promptly according to the actual approved institutional incident procedure.

### A/B Ground Truth Handoff
`case_ref` [ ], `evidence_cutoff_utc` [ ], `codebook_version` [ ], `reviewer_A_assignment_ref` [ ], `reviewer_B_assignment_ref` [ ], `independence_attested` [ ], `both_labels_received_before_peer_unblinding` [ ], `target_agreement` [ ], `reason_code_agreement` [ ], `adjudication_ref` [ ], `locked_at_utc` [ ], `withdrawal_check_utc` [ ]. Store reviewer identity/control under the authorized restricted registry, never in repository comments.

## 5. Scientific readiness/closure interpretation

- **AUTOMATED_QA_PASS:** existing evidence confirmed, does not assert human ethics/site permission.
- **P4.3_PREFLIGHT_HOLD:** current authoritative status while any relevant G01–G10 remains unsatisfied.
- **P4.3_GO_FOR_SPECIFIED_STAGE:** only a real, dated human authorization for a defined feasibility/main study stage after all applicable gates are met.
- **FULL_RESEARCH_COMPLETE:** only when the independent empirical/ground-truth/model/shadow/report criteria in `research/phase4-closure.json` pass an actual evidence audit and human sign-off.

The public repo must continue to show ethics NOT SUBMITTED, sample plan PENDING, research HOLD until real externally generated approvals and appropriate study observations are available.
