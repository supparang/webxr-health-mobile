const base = process.env.ACTIVA_BASE_URL || "http://127.0.0.1:3000";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function reqError(path, { actor, method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (actor) headers["x-activa-user-id"] = actor;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, ok: res.ok, data, text };
}

async function req(path, { actor, method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (actor) headers["x-activa-user-id"] = actor;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}

  if (!res.ok) {
    throw new Error(method + " " + path + " -> " + res.status + " " + text);
  }
  return data;
}

const health = await req("/api/health");
assert(health.ok && health.database === "connected", "health/database check failed");

const me = await req("/api/me", { actor: "ADM001" });
assert(me.user?.employeeId === "ADM001", "admin identity check failed");

const users = await req("/api/users", { actor: "ADM001" });
const p1 = users.users.find((u) => u.employeeId === "P001");
assert(p1, "P001 seed user missing");

// V0.5.0 activity permission grant/revoke
const p1CreateBefore = await reqError("/api/activities", {
  actor: "P001",
  method: "POST",
  body: {
    title: "CI permission should block",
    category: "ทดสอบ",
    location: "CI",
    startAt: new Date(Date.now()+3600000).toISOString(),
    endAt: new Date(Date.now()+7200000).toISOString(),
    policy: {}
  }
});
assert(p1CreateBefore.status === 403, "P001 should not create activity before permission grant");

const p1User = users.users.find((u) => u.employeeId === "P001");
const grantedPerms = await req("/api/users/" + encodeURIComponent(p1User.id) + "/activity-permissions", {
  actor: "ADM001",
  method: "PATCH",
  body: {
    permissions: ["CAN_CREATE_ACTIVITY","CAN_EDIT_OWN_ACTIVITY"],
    reason: "CI activity permission grant/revoke test"
  }
});
assert(grantedPerms.changes?.granted?.includes("CAN_CREATE_ACTIVITY"), "activity permission grant missing");

const p1MeWithPermission = await req("/api/me", { actor: "P001" });
assert(p1MeWithPermission.user?.activityPermissions?.includes("CAN_CREATE_ACTIVITY"), "granted activity permission not effective");

const p1Created = await req("/api/activities", {
  actor: "P001",
  method: "POST",
  body: {
    title: "CI delegated organizer activity",
    category: "ทดสอบ",
    location: "CI",
    startAt: new Date(Date.now()+3600000).toISOString(),
    endAt: new Date(Date.now()+7200000).toISOString(),
    policy: {}
  }
});
assert(p1Created.activity?.organizer?.employeeId === "P001", "creator should become primary organizer");

const revokedPerms = await req("/api/users/" + encodeURIComponent(p1User.id) + "/activity-permissions", {
  actor: "ADM001",
  method: "PATCH",
  body: {
    permissions: [],
    reason: "CI revoke after delegated organizer test"
  }
});
assert(revokedPerms.changes?.revoked?.includes("CAN_CREATE_ACTIVITY"), "activity permission revoke missing");

const p1CreateAfter = await reqError("/api/activities", {
  actor: "P001",
  method: "POST",
  body: {
    title: "CI permission should be revoked",
    category: "ทดสอบ",
    location: "CI",
    startAt: new Date(Date.now()+3600000).toISOString(),
    endAt: new Date(Date.now()+7200000).toISOString(),
    policy: {}
  }
});
assert(p1CreateAfter.status === 403, "P001 should not create activity after permission revoke");

const activities = await req("/api/activities", { actor: "ADM001" });
assert(activities.activities.length > 0, "seed activity missing");
const activity = activities.activities.find((a) => a.organizer?.employeeId === "ORG001") || activities.activities[0];

// V0.5.2 per-activity assignments + participant scope
const activityManage = await req("/api/activities/" + encodeURIComponent(activity.id) + "/manage", {
  actor: "ORG001",
});
assert(activityManage.capabilities?.canAssignCo === true, "primary organizer should be able to assign co-organizer");
assert(activityManage.capabilities?.canAssignVerifier === true, "primary organizer should be able to assign verifier");

const assignments = await req("/api/activities/" + encodeURIComponent(activity.id) + "/assignments", {
  actor: "ORG001",
  method: "PUT",
  body: {
    coOrganizerIds: ["P002"],
    verifierIds: ["STF001"],
  },
});
assert(assignments.assignments.some(x => x.role === "CO_ORGANIZER" && x.user?.employeeId === "P002"), "co-organizer assignment missing");
assert(assignments.assignments.some(x => x.role === "VERIFIER" && x.user?.employeeId === "STF001"), "verifier assignment missing");

const coDirectory = await req("/api/users", { actor: "P002" });
assert(coDirectory.users.some(u => u.employeeId === "P001"), "co-organizer should access personnel directory");

const roster = await req("/api/activities/" + encodeURIComponent(activity.id) + "/participants", {
  actor: "P002",
  method: "PUT",
  body: {
    mode: "ROSTER",
    userIds: ["P001"],
    departmentCodes: [],
  },
});
assert(roster.activity?.participationMode === "ROSTER", "roster participation mode not saved");

const qr = await req("/api/activities/" + encodeURIComponent(activity.id) + "/qr", {
  actor: "ORG001",
  method: "POST",
});
assert(qr.token && qr.expiresAt, "signed QR issuance failed");

const blockedNonRoster = await reqError("/api/attendance/checkin", {
  actor: "P003",
  method: "POST",
  body: { userId: "P003", token: qr.token },
});
assert(blockedNonRoster.status === 403, "non-roster participant should be blocked");
assert(blockedNonRoster.data?.error === "ACTIVITY_PARTICIPATION_NOT_ALLOWED", "wrong non-roster error");

const checkin = await req("/api/attendance/checkin", {
  actor: "P001",
  method: "POST",
  body: { userId: "P001", token: qr.token },
});
const attendanceId = checkin.attendance?.id;
assert(attendanceId, "check-in failed");

await req("/api/attendance/" + encodeURIComponent(attendanceId) + "/checkout", {
  actor: "P001",
  method: "POST",
});

await req("/api/attendance/" + encodeURIComponent(attendanceId) + "/staff-verify", {
  actor: "STF001",
  method: "POST",
});

const evidence = await req("/api/evidence/" + encodeURIComponent(attendanceId) + "/evaluate", {
  actor: "STF001",
  method: "POST",
});
assert(evidence.result?.ruleVersion, "evidence evaluation failed");
assert(evidence.note?.includes("not AI"), "rule-based disclaimer missing");

const duplicateCheckin = await reqError("/api/attendance/checkin", {
  actor: "P001",
  method: "POST",
  body: { userId: "P001", token: qr.token },
});
assert(duplicateCheckin.status === 409, "duplicate active attendance should be blocked");

const queue = await req("/api/ground-truth/queue", { actor: "STF001" });
const gtRecord = queue.records.find((r) => r.id === attendanceId);
assert(gtRecord, "ground-truth queue missing record");
assert(!Object.prototype.hasOwnProperty.call(gtRecord, "aiPredictions"), "AI leakage into ground-truth queue");
assert(gtRecord.user?.employeeId === "P001", "reviewer-safe identity lookup missing");

await req("/api/ground-truth/" + encodeURIComponent(attendanceId) + "/labels", {
  actor: "STF001",
  method: "POST",
  body: {
    target: "REVIEW_REQUIRED",
    reasonCodes: ["SHORT_DURATION"],
    notes: "CI smoke test only",
  },
});

const staffMe = await req("/api/me", { actor: "STF001" });

await req("/api/ground-truth/" + encodeURIComponent(attendanceId) + "/labels", {
  actor: "ADM001",
  method: "POST",
  body: {
    target: "REVIEW_REQUIRED",
    reasonCodes: ["SHORT_DURATION"],
    notes: "Second independent CI label",
  },
});

const staffQueueAfterTwoLabels = await req("/api/ground-truth/queue", { actor: "STF001" });
const staffRecordAfterTwoLabels = staffQueueAfterTwoLabels.records.find((r) => r.id === attendanceId);
assert(
  (staffRecordAfterTwoLabels.groundTruthLabels || []).every((x) => x.reviewerId === staffMe.user.id),
  "independent label privacy failed: STAFF can see peer labels"
);
assert(
  !Object.prototype.hasOwnProperty.call(staffRecordAfterTwoLabels, "consistencyResult"),
  "rule-result leakage into blinded ground-truth queue"
);

const adjudication = await req("/api/ground-truth/" + encodeURIComponent(attendanceId) + "/adjudicate", {
  actor: "ADM001",
  method: "POST",
  body: {
    finalTarget: "REVIEW_REQUIRED",
    reasonCodes: ["SHORT_DURATION"],
    notes: "Two independent labels agree in CI",
  },
});
assert(adjudication.groundTruthCase?.status === "ADJUDICATED", "ground-truth adjudication failed");

const locked = await req("/api/ground-truth/" + encodeURIComponent(attendanceId) + "/lock", {
  actor: "ADM001",
  method: "POST",
});
assert(locked.groundTruthCase?.status === "LOCKED", "ground-truth lock failed");

const readiness = await req("/api/ml/readiness", { actor: "ADM001" });
assert(readiness.counts?.lockedCount >= 1, "ML readiness does not count locked case");

const mlDataset = await req("/api/ml/dataset", { actor: "ADM001" });
const mlRecord = mlDataset.records.find((r) => r.record_id === attendanceId);
assert(mlRecord, "locked ML dataset missing record");
assert(mlRecord.participant_hash && mlRecord.participant_hash !== "P001", "ML dataset is not de-identified");
assert(mlRecord.final_target === "REVIEW_REQUIRED", "ML final target mismatch");
assert(!Object.prototype.hasOwnProperty.call(mlRecord, "risk_probability"), "AI output leaked into training dataset");

const blockedVerify = await reqError("/api/reviews/" + encodeURIComponent(attendanceId), {
  actor: "STF001",
  method: "POST",
  body: {
    decision: "VERIFY",
    reason: "CI should block ordinary verification",
    reviewDurationSeconds: 1,
  },
});
assert(blockedVerify.status === 409, "ordinary VERIFY must be blocked when evidence blockers exist");
assert(blockedVerify.data?.error === "REVIEW_BLOCKERS_PRESENT", "wrong blocker error for VERIFY");

const overrideReview = await req("/api/reviews/" + encodeURIComponent(attendanceId), {
  actor: "ADM001",
  method: "POST",
  body: {
    decision: "OVERRIDE_VERIFY",
    reason: "CI manual override with explicit documented justification",
    reviewDurationSeconds: 1,
  },
});
assert(overrideReview.finalEvidenceStatus === "OVERRIDE_VERIFIED", "manual override final status mismatch");

const participantAttendance = await req("/api/attendance", { actor: "P001" });
assert(participantAttendance.attendance.every((r) => r.user?.employeeId === "P001"), "participant privacy filter failed");

const research = await req("/api/research/export", { actor: "ADM001" });
const exported = research.records.find((r) => r.record_id === attendanceId);
assert(exported, "research export missing test record");
assert(exported.participant_hash && exported.participant_hash !== "P001", "research de-identification failed");

const modelImport = await req("/api/models/import-evaluation", {
  actor: "ADM001",
  method: "POST",
  body: {
    version: "ACTIVA-CI-SYNTHETIC-001",
    modelFamily: "logistic_regression",
    dataProvenance: "SYNTHETIC_CI_ONLY",
    selectedMetric: "validation_pr_auc",
    selectedMetricValue: 0.81,
    validationMetrics: { pr_auc: 0.81 },
    testMetrics: {
      precision: 0.80,
      recall_sensitivity: 0.78,
      specificity: 0.82,
      f1: 0.79,
      roc_auc: 0.84,
      pr_auc: 0.80,
      brier_score: 0.16
    },
    calibration: { method: "sigmoid", ci_only: true },
    explainability: [{ feature: "duration_ratio", mean_importance: 0.2 }],
    notes: "Synthetic CI model; software test only"
  },
});
assert(modelImport.model?.status === "EVALUATED", "model evaluation import failed");

const approvedModel = await req("/api/models/" + encodeURIComponent(modelImport.model.id) + "/approve", {
  actor: "ADM001",
  method: "POST",
});
assert(approvedModel.model?.status === "APPROVED", "model approval failed");

const deployedModel = await req("/api/models/" + encodeURIComponent(modelImport.model.id) + "/deploy", {
  actor: "ADM001",
  method: "POST",
});
assert(deployedModel.model?.status === "DEPLOYED", "model deployment gate failed in CI");

const inferenceDataset = await req("/api/ml/inference-dataset", { actor: "ADM001" });
assert(inferenceDataset.deployedModel?.version === "ACTIVA-CI-SYNTHETIC-001", "inference dataset model version mismatch");
assert(inferenceDataset.groundTruthIncluded === false, "inference dataset must exclude ground truth");
assert(inferenceDataset.records.some((r) => r.record_id === attendanceId), "unscored attendance missing from inference dataset");

const beforePrediction = await req("/api/attendance", { actor: "ADM001" });
const beforeStatus = beforePrediction.attendance.find((r) => r.id === attendanceId)?.finalEvidenceStatus;

const prediction = await req("/api/predictions/import", {
  actor: "ADM001",
  method: "POST",
  body: {
    attendanceId,
    modelVersion: "ACTIVA-CI-SYNTHETIC-001",
    riskProbability: 0.83,
    predictedLabel: "REVIEW_REQUIRED",
    explanation: [
      { feature: "duration_ratio", label: "ระยะเวลาเข้าร่วมต่ำ", contribution: 0.31 },
      { feature: "staff_verified", label: "หลักฐานจากเจ้าหน้าที่", contribution: -0.08 }
    ]
  },
});
assert(prediction.decisionSupportOnly === true, "prediction must be decision support only");

const batchPrediction = await req("/api/predictions/import-batch", {
  actor: "ADM001",
  method: "POST",
  body: {
    modelVersion: "ACTIVA-CI-SYNTHETIC-001",
    predictions: [{
      attendanceId,
      riskProbability: 0.84,
      predictedLabel: "REVIEW_REQUIRED",
      explanation: {
        method: "single_feature_reference_perturbation",
        causal: false,
        threshold: 0.5,
        reasons: [
          { feature: "duration_ratio", label: "สัดส่วนระยะเวลาเข้าร่วม", contribution: 0.30 }
        ]
      }
    }]
  },
});
assert(batchPrediction.importedCount === 1, "AI batch prediction import failed");

const xai = await req("/api/xai/queue", { actor: "STF001" });
const xaiRecord = xai.records.find((p) => p.attendanceId === attendanceId);
assert(xaiRecord, "XAI queue missing imported prediction");
assert(xaiRecord.modelVersion === "ACTIVA-CI-SYNTHETIC-001", "XAI model version mismatch");
assert(Math.abs(xaiRecord.riskProbability - 0.84) < 1e-9, "XAI risk probability mismatch");

const afterPrediction = await req("/api/attendance", { actor: "ADM001" });
const afterStatus = afterPrediction.attendance.find((r) => r.id === attendanceId)?.finalEvidenceStatus;
assert(beforeStatus === afterStatus, "AI prediction changed final evidence status automatically");
assert(afterStatus === "OVERRIDE_VERIFIED", "manual override status was not preserved after AI prediction");

const audit = await req("/api/audit", { actor: "ADM001" });
assert(audit.logs.length > 0, "audit trail empty");

console.log("ACTIVA-AI V0.3.7 smoke test passed");
