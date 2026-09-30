#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PHASE3_PROTOCOL_ID = "ACTIVA-P3-RP-001";

const NUMERIC_FEATURES = [
  "qr_valid","identity_verified","checkin_present","checkout_present",
  "scheduled_duration_minutes","actual_duration_minutes","duration_ratio",
  "checkin_offset_minutes","checkout_offset_minutes","staff_verified",
  "signature_verified","scan_attempts",
];
const CATEGORICAL_FEATURES = ["activity_type"];
const REQUIRED_RECORD_FIELDS = [
  "record_id","participant_hash","event_id","final_target",
  ...NUMERIC_FEATURES,...CATEGORICAL_FEATURES,
];
const BINARY_FEATURES = new Set([
  "qr_valid","identity_verified","checkin_present","checkout_present",
  "staff_verified","signature_verified",
]);
const VALID_TARGETS = new Set(["REVIEW_REQUIRED","NO_REVIEW_REQUIRED"]);
const PROHIBITED_DIRECT = new Set([
  "name","full_name","email","employee_id","employeeid","user_id","userid",
  "phone","national_id","citizen_id",
]);
const PROHIBITED_LEAKAGE = new Set([
  "humandecision","human_decision","finalevidencestatus","final_evidence_status",
  "reviewoutcome","review_outcome","riskprobability","risk_probability",
  "predictedlabel","predicted_label","modelversion","model_version",
  "aiprediction","ai_prediction",
]);

function normKey(value) {
  return String(value || "").replace(/[- ]/g, "_").toLowerCase();
}

function finiteOrNull(value) {
  return value === null || value === undefined || value === "" || Number.isFinite(Number(value));
}

function positiveInt(value, fallback = 0) {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n < 0) throw new Error("Thresholds must be non-negative integers.");
  return n;
}

export function validatePhase3Dataset(payload, options = {}) {
  const errors = [];
  const warnings = [];
  const fail = (code, detail = "") => errors.push(detail ? `${code}: ${detail}` : code);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok:false, protocolId:PHASE3_PROTOCOL_ID, errors:["DATASET_PAYLOAD_MUST_BE_OBJECT"], warnings, counts:{} };
  }

  if (payload.datasetStatus !== "LOCKED_GROUND_TRUTH_ONLY") {
    fail("DATASET_STATUS_NOT_LOCKED_GROUND_TRUTH_ONLY", String(payload.datasetStatus ?? "missing"));
  }
  if (payload.deidentified !== true) fail("DATASET_MUST_BE_DEIDENTIFIED");
  if (payload.aiPredictionsIncluded !== false) fail("AI_PREDICTIONS_MUST_BE_EXCLUDED");
  if (payload.syntheticDemo === true || payload.synthetic === true) fail("SYNTHETIC_DATA_NOT_ALLOWED_FOR_EMPIRICAL_PHASE3");

  const records = Array.isArray(payload.records) ? payload.records : [];
  if (!Array.isArray(payload.records)) fail("DATASET_RECORDS_ARRAY_REQUIRED");
  if (!records.length) fail("DATASET_RECORDS_EMPTY");

  const ids = new Set();
  const participants = new Set();
  const events = new Set();
  const targetCounts = { REVIEW_REQUIRED:0, NO_REVIEW_REQUIRED:0 };

  records.forEach((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      fail("RECORD_MUST_BE_OBJECT", `index=${index}`);
      return;
    }

    for (const field of REQUIRED_RECORD_FIELDS) {
      if (!(field in row)) fail("REQUIRED_FIELD_MISSING", `index=${index} field=${field}`);
    }

    for (const key of Object.keys(row)) {
      const nk = normKey(key);
      if (PROHIBITED_DIRECT.has(nk)) fail("DIRECT_IDENTIFIER_PROHIBITED", `index=${index} field=${key}`);
      if (PROHIBITED_LEAKAGE.has(nk)) fail("PREDICTION_OR_HUMAN_OUTCOME_LEAKAGE_PROHIBITED", `index=${index} field=${key}`);
    }

    const recordId = String(row.record_id ?? "").trim();
    if (!recordId) fail("RECORD_ID_REQUIRED", `index=${index}`);
    else if (ids.has(recordId)) fail("DUPLICATE_RECORD_ID", recordId);
    else ids.add(recordId);

    const participant = String(row.participant_hash ?? "").trim();
    const eventId = String(row.event_id ?? "").trim();
    if (!participant) fail("PARTICIPANT_HASH_REQUIRED", `index=${index}`);
    else participants.add(participant);
    if (!eventId) fail("EVENT_ID_REQUIRED", `index=${index}`);
    else events.add(eventId);

    if (!VALID_TARGETS.has(row.final_target)) {
      fail("FINAL_TARGET_INVALID", `index=${index} value=${String(row.final_target)}`);
    } else {
      targetCounts[row.final_target] += 1;
    }

    for (const feature of NUMERIC_FEATURES) {
      const value = row[feature];
      if (!finiteOrNull(value)) fail("NUMERIC_FEATURE_INVALID", `index=${index} field=${feature}`);
      if (BINARY_FEATURES.has(feature) && value !== null && value !== undefined && value !== "") {
        const n = Number(value);
        if (n !== 0 && n !== 1) fail("BINARY_FEATURE_INVALID", `index=${index} field=${feature} value=${value}`);
      }
    }

    if (finiteOrNull(row.duration_ratio) && row.duration_ratio !== null && row.duration_ratio !== undefined && row.duration_ratio !== "") {
      const ratio = Number(row.duration_ratio);
      if (ratio < 0 || ratio > 1) fail("DURATION_RATIO_OUT_OF_RANGE", `index=${index} value=${row.duration_ratio}`);
    }
    if (finiteOrNull(row.scan_attempts) && row.scan_attempts !== null && row.scan_attempts !== undefined && row.scan_attempts !== "") {
      if (Number(row.scan_attempts) < 0) fail("SCAN_ATTEMPTS_NEGATIVE", `index=${index}`);
    }
    if (typeof row.activity_type !== "string" || !row.activity_type.trim()) {
      fail("ACTIVITY_TYPE_REQUIRED", `index=${index}`);
    }
  });

  if (records.length && (targetCounts.REVIEW_REQUIRED === 0 || targetCounts.NO_REVIEW_REQUIRED === 0)) {
    fail("BOTH_TARGET_CLASSES_REQUIRED");
  }

  const minRecords = positiveInt(options.minRecords);
  const minParticipants = positiveInt(options.minParticipants);
  const minEvents = positiveInt(options.minEvents);
  const minPerClass = positiveInt(options.minPerClass);
  const samplePlanApproved = options.samplePlanApproved === true;

  if (minRecords && records.length < minRecords) fail("MIN_RECORDS_NOT_MET", `${records.length}<${minRecords}`);
  if (minParticipants && participants.size < minParticipants) fail("MIN_PARTICIPANTS_NOT_MET", `${participants.size}<${minParticipants}`);
  if (minEvents && events.size < minEvents) fail("MIN_EVENTS_NOT_MET", `${events.size}<${minEvents}`);
  if (minPerClass) {
    for (const [label,count] of Object.entries(targetCounts)) {
      if (count < minPerClass) fail("MIN_PER_CLASS_NOT_MET", `${label}:${count}<${minPerClass}`);
    }
  }

  if (!minRecords || !minParticipants || !minEvents || !minPerClass) {
    warnings.push("SAMPLE_SIZE_THRESHOLDS_NOT_FULLY_SPECIFIED: structural PASS is not approval to train empirical research models.");
  }
  if (!samplePlanApproved) {
    warnings.push("SAMPLE_PLAN_NOT_APPROVED: empirical training remains HOLD until a version-controlled sample plan is APPROVED.");
  }

  return {
    ok: errors.length === 0,
    protocolId: PHASE3_PROTOCOL_ID,
    predictionMoment: "AFTER_EVIDENCE_COLLECTION_BEFORE_HUMAN_FINAL_DECISION",
    errors,
    warnings,
    counts: {
      records: records.length,
      uniqueParticipants: participants.size,
      uniqueEvents: events.size,
      targets: targetCounts,
    },
    sampleThresholds: { minRecords, minParticipants, minEvents, minPerClass },
    samplePlanApproved,
    researchTrainingAuthorized: errors.length === 0 && samplePlanApproved && minRecords > 0 && minParticipants > 0 && minEvents > 0 && minPerClass > 0,
  };
}

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const input = argValue(args, "--input");
  const samplePlanPath = argValue(args, "--sample-plan");
  if (!input) {
    console.error("Usage: node scripts/validate-phase3-dataset.mjs --input locked_dataset.json --sample-plan ml/phase3-sample-plan.json");
    process.exitCode = 2;
    return;
  }

  const full = path.resolve(input);
  const payload = JSON.parse(fs.readFileSync(full, "utf8"));

  let plan = null;
  if (samplePlanPath) {
    plan = JSON.parse(fs.readFileSync(path.resolve(samplePlanPath), "utf8"));
  }
  const planApproved = Boolean(
    plan &&
    plan.protocolId === PHASE3_PROTOCOL_ID &&
    plan.status === "APPROVED" &&
    plan.minimums
  );
  const minimums = plan?.minimums || {};

  const report = validatePhase3Dataset(payload, {
    minRecords: minimums.records ?? argValue(args, "--min-records"),
    minParticipants: minimums.uniqueParticipants ?? argValue(args, "--min-participants"),
    minEvents: minimums.uniqueEvents ?? argValue(args, "--min-events"),
    minPerClass: minimums.perTargetClass ?? argValue(args, "--min-per-class"),
    samplePlanApproved: planApproved,
  });
  report.samplePlan = plan ? {
    samplePlanId: plan.samplePlanId || null,
    protocolId: plan.protocolId || null,
    status: plan.status || null,
    approvedAt: plan.approvedAt || null,
  } : null;
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok || !report.researchTrainingAuthorized) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
