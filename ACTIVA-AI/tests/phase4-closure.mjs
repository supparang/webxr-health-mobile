import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyPhase4Closure } from "../scripts/verify-phase4-closure.mjs";

const manifest = JSON.parse(readFileSync(new URL("../research/phase4-closure.json", import.meta.url), "utf8"));
const plan = JSON.parse(readFileSync(new URL("../ml/phase3-sample-plan.json", import.meta.url), "utf8"));
const initial = verifyPhase4Closure(manifest, plan);
assert.equal(initial.ok, false, "Repository must begin research workstream on HOLD");
assert(initial.blockers.includes("PROSPECTIVE_SAMPLE_PLAN_NOT_APPROVED"));
assert(initial.blockers.includes("EMPIRICAL_DATASET_PROVENANCE_OR_VALIDATION_MISSING"));
assert(initial.blockers.includes("HUMAN_RESEARCH_GOVERNANCE_MISSING"));
const forced = verifyPhase4Closure({...manifest, status:"COMPLETE"},plan);
assert.equal(forced.ok,false,"Manually changing the declared status cannot bypass evidence gates");

// Structural-only synthetic fixtures. These values are local test inputs and
// NEVER represent an ethics decision, human participation or empirical findings.
const evidence = structuredClone(manifest);
const approvedPlan = structuredClone(plan);
const H = "a".repeat(64);
const T = "2026-10-01T10:00:00Z";
Object.assign(approvedPlan,{
  status:"APPROVED",approvedBy:"CI structural test role",approvedAt:T,
  minimums:{records:8,uniqueParticipants:4,uniqueEvents:2,reviewRequired:3,noReviewRequired:5},
  finalTestMinimums:{records:2,reviewRequired:1,noReviewRequired:1},
  planningSnapshot:{cutoffUtc:T,developmentOnly:true,snapshotSha256:H},
});
evidence.status="COMPLETE";
Object.assign(evidence.operational,{
  renderCommit:"b".repeat(40),
  monitorRunUrl:"https://github.com/organization/repository/actions/runs/123456",
  mobileQrAcceptanceRef:"controlled-operational-report-reference",
});
Object.assign(evidence.governance,{
  ethicsDecision:"APPROVED",decisionRef:"institutional-register-reference",
  approvedConsentVersion:"INST-CONSENT-2026-V1",
  sitePermissionRef:"site-register-reference",
  retentionPlanRef:"institutional-retention-register",
});
Object.assign(evidence.samplePlan,{
  approval:"APPROVED",planningSnapshotSha256:H,planningCutoffUtc:T,
});
Object.assign(evidence.fieldPilot,{
  pilotReportSha256:H,consentedParticipants:5,
  eligibleAttendanceRecords:8,uniqueParticipants:4,uniqueEvents:2,
  withdrawalReconciliationRef:"institutional-withdrawal-log-reference",
});
Object.assign(evidence.groundTruth,{
  distinctRealReviewersConfirmed:true,lockedEmpiricalCases:8,
  reviewRequiredCount:3,noReviewRequiredCount:5,
  agreementReportSha256:H,adjudicationReportSha256:H,
});
Object.assign(evidence.dataset,{
  scope:"EMPIRICAL_ONLY",datasetStatus:"LOCKED_GROUND_TRUTH_ONLY",
  deidentified:true,aiPredictionsIncluded:false,syntheticDemo:false,
  qaRecordsIncluded:false,validatorAuthorized:true,
  datasetSha256:H,validatorReportSha256:H,
});
Object.assign(evidence.evaluation,{
  modelStatus:"EVALUATED",modelProvenance:"EMPIRICAL_LOCKED_GROUND_TRUTH",
  finalTestFirewallPass:true,finalTestReportSha256:H,
  modelManifestSha256:H,humanModelApprovalRef:"human-review-board-reference",
});
Object.assign(evidence.shadowPilot,{
  status:"COMPLETED",humanAuthorityPreserved:true,reportSha256:H,
});
Object.assign(evidence.closure,{
  reproducibilityIndexSha256:H,finalResearchReportSha256:H,
  humanSignoffRef:"approved-human-closeout-record",decisionAtUtc:T,
});
const structural = verifyPhase4Closure(evidence,approvedPlan);
assert.equal(structural.ok,true,JSON.stringify(structural.blockers));
assert.equal(structural.status,"EVIDENCE_STRUCTURALLY_READY_FOR_INDEPENDENT_AUDIT");
assert.match(structural.caution,/cannot independently authenticate/i);

function mustFail(modify, code) {
  const next=structuredClone(evidence);
  const nextPlan=structuredClone(approvedPlan);
  modify(next,nextPlan);
  const report=verifyPhase4Closure(next,nextPlan);
  assert.equal(report.ok,false,"Gate must fail closed: "+code);
  assert(report.blockers.includes(code),JSON.stringify(report.blockers));
}
mustFail(m=>{m.dataset.qaRecordsIncluded=true;},"EMPIRICAL_DATASET_PROVENANCE_OR_VALIDATION_MISSING");
mustFail(m=>{m.dataset.syntheticDemo=true;},"EMPIRICAL_DATASET_PROVENANCE_OR_VALIDATION_MISSING");
mustFail(m=>{m.dataset.validatorAuthorized=false;},"EMPIRICAL_DATASET_PROVENANCE_OR_VALIDATION_MISSING");
mustFail(m=>{m.groundTruth.distinctRealReviewersConfirmed=false;},"INDEPENDENT_LOCKED_GROUND_TRUTH_MISSING");
mustFail(m=>{m.groundTruth.lockedEmpiricalCases=7;},"INDEPENDENT_LOCKED_GROUND_TRUTH_MISSING");
mustFail(m=>{m.evaluation.finalTestFirewallPass=false;},"EMPIRICAL_MODEL_FINAL_TEST_OR_HUMAN_APPROVAL_MISSING");
mustFail(m=>{m.shadowPilot.humanAuthorityPreserved=false;},"NON_AUTONOMOUS_SHADOW_PILOT_NOT_COMPLETED");
mustFail(m=>{m.closure.humanSignoffRef=null;},"FINAL_RESEARCH_REPORT_OR_HUMAN_SIGNOFF_MISSING");
mustFail(m=>{m.operational.mobileQrAcceptanceRef="https://host/guest#token=unsafe";},"OPERATIONAL_SIGNOFF_MISSING");
mustFail((_m,p)=>{p.status="PENDING";},"PROSPECTIVE_SAMPLE_PLAN_NOT_APPROVED");
mustFail((m,p)=>{p.planningSnapshot.snapshotSha256="b".repeat(64);},"PROSPECTIVE_SAMPLE_PLAN_NOT_APPROVED");
mustFail(m=>{m.status="HOLD";},"HUMAN_CLOSEOUT_DECISION_NOT_RECORDED");
console.log("ACTIVA-AI Phase 4 research closure gate PASS: actual manifest stays HOLD; structural synthetic regressions fail closed.");
