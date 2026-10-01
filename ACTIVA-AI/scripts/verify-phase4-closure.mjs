#!/usr/bin/env node
// ACTIVA-AI Phase 4: structural research closeout guard, not an ethics authority.
// Emits codes and references only. Never reads raw participant records or tokens.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const SHA256 = /^[0-9a-f]{64}$/i;
const SHA40 = /^[0-9a-f]{40}$/i;
const positive = value => Number.isSafeInteger(value) && value > 0;
const nonempty = value => typeof value === "string" && value.trim().length > 3 &&
  !/^(todo|pending|placeholder|example|none|n\/a|null)$/i.test(value.trim());
const safeRef = value => nonempty(value) && !/(#token=|authorization:|guestpass\s|raw[_ -]?token|bearer\s)/i.test(value);
const timestamp = value => typeof value === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));
const checkHash = value => typeof value === "string" && SHA256.test(value);

export function verifyPhase4Closure(manifest, plan) {
  const blockers = [];
  const requireGate = (condition, code) => { if (!condition) blockers.push(code); };
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { ok:false, status:"HOLD", blockers:["PHASE4_MANIFEST_INVALID"] };
  }
  const o = manifest.operational || {};
  const g = manifest.governance || {};
  const s = manifest.samplePlan || {};
  const p = manifest.fieldPilot || {};
  const gt = manifest.groundTruth || {};
  const d = manifest.dataset || {};
  const m = manifest.evaluation || {};
  const shadow = manifest.shadowPilot || {};
  const c = manifest.closure || {};
  const minimum = plan?.minimums || {};
  const finalMinimum = plan?.finalTestMinimums || {};

  requireGate(manifest.workstreamId === "ACTIVA-P4-RESEARCH-001" &&
    manifest.protocolId === "ACTIVA-P3-RP-001" &&
    plan?.protocolId === manifest.protocolId, "PROTOCOL_MISMATCH");
  requireGate(manifest.softwareBaseline === "10b8b60e7ed9081bd5e3eb1640824c77d9f2071a",
    "SOFTWARE_BASELINE_NOT_FROZEN");
  requireGate(SHA40.test(o.renderCommit || "") && safeRef(o.monitorRunUrl) &&
    /github\.com\/[^/]+\/[^/]+\/actions\/runs\/\d+/.test(o.monitorRunUrl || "") &&
    safeRef(o.mobileQrAcceptanceRef), "OPERATIONAL_SIGNOFF_MISSING");

  // A repository flag alone cannot confer an ethics decision; operator must
  // verify the external decision reference and effective dates independently.
  requireGate(["APPROVED","EXEMPT"].includes(g.ethicsDecision) &&
    safeRef(g.decisionRef) && safeRef(g.approvedConsentVersion) &&
    safeRef(g.sitePermissionRef) && safeRef(g.retentionPlanRef),
    "HUMAN_RESEARCH_GOVERNANCE_MISSING");

  requireGate(plan?.status === "APPROVED" && nonempty(plan?.approvedBy) &&
    timestamp(plan?.approvedAt) && s.approval === "APPROVED" &&
    checkHash(s.planningSnapshotSha256) &&
    checkHash(plan?.planningSnapshot?.snapshotSha256) &&
    s.planningSnapshotSha256 === plan.planningSnapshot.snapshotSha256 &&
    timestamp(s.planningCutoffUtc) &&
    s.planningCutoffUtc === plan.planningSnapshot.cutoffUtc &&
    plan.planningSnapshot.developmentOnly === true,
    "PROSPECTIVE_SAMPLE_PLAN_NOT_APPROVED");

  for (const field of ["records","uniqueParticipants","uniqueEvents","reviewRequired","noReviewRequired"]) {
    requireGate(positive(minimum[field]), "SAMPLE_MINIMUM_MISSING_" + field.toUpperCase());
  }
  for (const field of ["records","reviewRequired","noReviewRequired"]) {
    requireGate(positive(finalMinimum[field]), "FINAL_TEST_MINIMUM_MISSING_" + field.toUpperCase());
  }

  requireGate(p.approvedInstrumentVersion === "ACTIVA-P4-INST-001" &&
    checkHash(p.pilotReportSha256) && safeRef(p.withdrawalReconciliationRef) &&
    positive(p.consentedParticipants) && positive(p.eligibleAttendanceRecords) &&
    positive(p.uniqueParticipants) && positive(p.uniqueEvents),
    "PROSPECTIVE_FIELD_PILOT_EVIDENCE_MISSING");
  requireGate(!positive(minimum.records) || p.eligibleAttendanceRecords >= minimum.records,
    "EMPIRICAL_RECORD_MINIMUM_NOT_MET");
  requireGate(!positive(minimum.uniqueParticipants) || p.uniqueParticipants >= minimum.uniqueParticipants,
    "UNIQUE_PARTICIPANT_MINIMUM_NOT_MET");
  requireGate(!positive(minimum.uniqueEvents) || p.uniqueEvents >= minimum.uniqueEvents,
    "UNIQUE_EVENT_MINIMUM_NOT_MET");
  requireGate(p.uniqueParticipants <= p.consentedParticipants,
    "PARTICIPANT_COUNT_INCONSISTENT");

  requireGate(gt.distinctRealReviewersConfirmed === true && checkHash(gt.agreementReportSha256) &&
    checkHash(gt.adjudicationReportSha256) && positive(gt.lockedEmpiricalCases) &&
    positive(gt.reviewRequiredCount) && positive(gt.noReviewRequiredCount) &&
    gt.lockedEmpiricalCases === gt.reviewRequiredCount + gt.noReviewRequiredCount,
    "INDEPENDENT_LOCKED_GROUND_TRUTH_MISSING");
  requireGate(!positive(minimum.records) || gt.lockedEmpiricalCases >= minimum.records,
    "LOCKED_EMPIRICAL_MINIMUM_NOT_MET");
  requireGate(!positive(minimum.reviewRequired) || gt.reviewRequiredCount >= minimum.reviewRequired,
    "REVIEW_REQUIRED_MINIMUM_NOT_MET");
  requireGate(!positive(minimum.noReviewRequired) || gt.noReviewRequiredCount >= minimum.noReviewRequired,
    "NO_REVIEW_REQUIRED_MINIMUM_NOT_MET");
  requireGate(p.eligibleAttendanceRecords >= (gt.lockedEmpiricalCases || 0),
    "GROUND_TRUTH_COUNT_EXCEEDS_ELIGIBLE_ATTENDANCE");

  requireGate(d.scope === "EMPIRICAL_ONLY" &&
    d.datasetStatus === "LOCKED_GROUND_TRUTH_ONLY" &&
    d.deidentified === true && d.aiPredictionsIncluded === false &&
    d.syntheticDemo === false && d.qaRecordsIncluded === false &&
    d.validatorAuthorized === true &&
    checkHash(d.datasetSha256) && checkHash(d.validatorReportSha256),
    "EMPIRICAL_DATASET_PROVENANCE_OR_VALIDATION_MISSING");

  requireGate(["EVALUATED","APPROVED","DEPLOYED"].includes(m.modelStatus) &&
    m.modelProvenance === "EMPIRICAL_LOCKED_GROUND_TRUTH" &&
    m.finalTestFirewallPass === true &&
    checkHash(m.finalTestReportSha256) && checkHash(m.modelManifestSha256) &&
    safeRef(m.humanModelApprovalRef),
    "EMPIRICAL_MODEL_FINAL_TEST_OR_HUMAN_APPROVAL_MISSING");
  requireGate(shadow.status === "COMPLETED" &&
    shadow.humanAuthorityPreserved === true && checkHash(shadow.reportSha256),
    "NON_AUTONOMOUS_SHADOW_PILOT_NOT_COMPLETED");

  requireGate(checkHash(c.reproducibilityIndexSha256) &&
    checkHash(c.finalResearchReportSha256) &&
    safeRef(c.humanSignoffRef) && timestamp(c.decisionAtUtc),
    "FINAL_RESEARCH_REPORT_OR_HUMAN_SIGNOFF_MISSING");

  requireGate(manifest.status === "COMPLETE", "HUMAN_CLOSEOUT_DECISION_NOT_RECORDED");
  return {
    ok:blockers.length === 0,
    status:blockers.length === 0 ? "EVIDENCE_STRUCTURALLY_READY_FOR_INDEPENDENT_AUDIT" : "HOLD",
    blockers,
    caution:"Structural checks cannot independently authenticate ethics approval, human identity, real field observations or the referenced artifact bytes. A responsible human must audit references before public completion claims.",
  };
}

function argValue(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}
async function main() {
  const args = process.argv.slice(2);
  const manifestPath = argValue(args, "--manifest") || "research/phase4-closure.json";
  const planPath = argValue(args, "--sample-plan") || "ml/phase3-sample-plan.json";
  const result = verifyPhase4Closure(
    JSON.parse(fs.readFileSync(manifestPath, "utf8")),
    JSON.parse(fs.readFileSync(planPath, "utf8")),
  );
  console.log(JSON.stringify(result, null, 2));
  // For the CI template contract only: a missing-evidence manifest MUST fail
  // closed. This flag never creates a research authorization.
  if (args.includes("--expect-hold")) {
    if (result.ok || result.status !== "HOLD") process.exitCode = 1;
  } else if (!result.ok) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
