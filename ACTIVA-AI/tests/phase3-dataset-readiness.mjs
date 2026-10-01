import assert from "node:assert/strict";
import { validatePhase3Dataset, PHASE3_PROTOCOL_ID } from "../scripts/validate-phase3-dataset.mjs";

function record(i, target) {
  return {
    record_id: `R${i}`,
    data_classification:"EMPIRICAL",
    participant_hash: `P${Math.floor(i / 2)}`,
    event_id: `E${i % 3}`,
    activity_type: i % 2 ? "อบรม" : "ประชุม",
    qr_valid: 1,
    identity_verified: 1,
    checkin_present: 1,
    checkout_present: 1,
    scheduled_duration_minutes: 120,
    actual_duration_minutes: 110,
    duration_ratio: 0.92,
    checkin_offset_minutes: -5,
    checkout_offset_minutes: 0,
    staff_verified: 1,
    signature_verified: 0,
    scan_attempts: 1,
    final_target: target,
    reason_codes: [],
    locked_at: "2026-09-30T12:00:00Z",
  };
}

const records = Array.from({ length: 12 }, (_, i) =>
  record(i, i % 2 ? "REVIEW_REQUIRED" : "NO_REVIEW_REQUIRED")
);
const good = {
  ok: true,
  datasetStatus: "LOCKED_GROUND_TRUTH_ONLY",
  dataProvenance:"EMPIRICAL_LOCKED_GROUND_TRUTH",
  scope:"EMPIRICAL_ONLY",
  aiPredictionsIncluded: false,
  deidentified: true,
  records,
};

const pass = validatePhase3Dataset(good, {
  minRecords: 12,
  minParticipants: 6,
  minEvents: 3,
  minPerClass: 6,
  samplePlanApproved: true,
});
assert.equal(pass.ok, true);
assert.equal(pass.researchTrainingAuthorized, true);
assert.equal(pass.protocolId, PHASE3_PROTOCOL_ID);
assert.deepEqual(pass.counts.targets, { REVIEW_REQUIRED:6, NO_REVIEW_REQUIRED:6 });

const noThresholds = validatePhase3Dataset(good);
assert.equal(noThresholds.ok, true);
assert.equal(noThresholds.researchTrainingAuthorized, false);
assert(noThresholds.warnings.some(x => x.includes("SAMPLE_SIZE_THRESHOLDS")));

const thresholdsWithoutApproval = validatePhase3Dataset(good, {
  minRecords: 12,
  minParticipants: 6,
  minEvents: 3,
  minPerClass: 6,
  samplePlanApproved: false,
});
assert.equal(thresholdsWithoutApproval.ok, true);
assert.equal(thresholdsWithoutApproval.researchTrainingAuthorized, false);
assert(thresholdsWithoutApproval.warnings.some(x => x.includes("SAMPLE_PLAN_NOT_APPROVED")));

const qaRows = records.map(x => ({ ...x }));
qaRows[0].data_classification = "QA_TEST";
const qa = validatePhase3Dataset({ ...good, records:qaRows });
assert.equal(qa.ok,false);
assert(qa.errors.some(x=>x.includes("NON_EMPIRICAL_RECORD_PROHIBITED")));
const unknown = validatePhase3Dataset({ ...good, scope:"UNCLASSIFIED" });
assert.equal(unknown.ok,false);
assert(unknown.errors.some(x=>x.includes("EMPIRICAL_RESEARCH_PROVENANCE_REQUIRED")));

const synthetic = validatePhase3Dataset({ ...good, syntheticDemo:true });
assert.equal(synthetic.ok, false);
assert(synthetic.errors.some(x => x.includes("SYNTHETIC_DATA_NOT_ALLOWED")));

const leakageRows = records.map(x => ({ ...x }));
leakageRows[0].risk_probability = 0.8;
const leakage = validatePhase3Dataset({ ...good, records:leakageRows });
assert.equal(leakage.ok, false);
assert(leakage.errors.some(x => x.includes("LEAKAGE_PROHIBITED")));

const piiRows = records.map(x => ({ ...x }));
piiRows[0].email = "person@example.test";
const pii = validatePhase3Dataset({ ...good, records:piiRows });
assert.equal(pii.ok, false);
assert(pii.errors.some(x => x.includes("DIRECT_IDENTIFIER_PROHIBITED")));

const duplicateRows = records.map(x => ({ ...x }));
duplicateRows[1].record_id = duplicateRows[0].record_id;
const duplicate = validatePhase3Dataset({ ...good, records:duplicateRows });
assert.equal(duplicate.ok, false);
assert(duplicate.errors.some(x => x.includes("DUPLICATE_RECORD_ID")));

const badRatioRows = records.map(x => ({ ...x }));
badRatioRows[0].duration_ratio = 1.2;
const badRatio = validatePhase3Dataset({ ...good, records:badRatioRows });
assert.equal(badRatio.ok, false);
assert(badRatio.errors.some(x => x.includes("DURATION_RATIO_OUT_OF_RANGE")));

const oneClass = validatePhase3Dataset({
  ...good,
  records: records.map((x, i) => ({ ...x, record_id:`ONE${i}`, final_target:"NO_REVIEW_REQUIRED" })),
});
assert.equal(oneClass.ok, false);
assert(oneClass.errors.includes("BOTH_TARGET_CLASSES_REQUIRED"));

console.log("ACTIVA-AI Phase 3 dataset readiness guard tests passed");
