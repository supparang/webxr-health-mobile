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
assert(health.version === "1.0.0", "health version must report ACTIVA-AI 1.0.0");

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

const ciNow=Date.now();
const activeActivityCreate=await req("/api/activities",{
  actor:"ORG001",
  method:"POST",
  body:{
    title:"CI active check-in window",
    category:"ทดสอบ",
    location:"CI",
    startAt:new Date(ciNow-30*60000).toISOString(),
    endAt:new Date(ciNow+20*60000).toISOString(),
    checkinOpenAt:new Date(ciNow-40*60000).toISOString(),
    checkinCloseAt:new Date(ciNow+10*60000).toISOString(),
    checkoutOpenAt:new Date(ciNow-10*60000).toISOString(),
    checkoutCloseAt:new Date(ciNow+30*60000).toISOString(),
    policy:{}
  }
});
const activity=activeActivityCreate.activity;
assert(activity?.id,"active-window activity creation failed");

// V0.5.6 QR/check-in time-window enforcement
const futureActivity=await req("/api/activities",{
  actor:"ORG001",
  method:"POST",
  body:{
    title:"CI future QR window",
    category:"ทดสอบ",
    location:"CI",
    startAt:new Date(ciNow+90*60000).toISOString(),
    endAt:new Date(ciNow+180*60000).toISOString(),
    checkinOpenAt:new Date(ciNow+60*60000).toISOString(),
    checkinCloseAt:new Date(ciNow+100*60000).toISOString(),
    checkoutOpenAt:new Date(ciNow+150*60000).toISOString(),
    checkoutCloseAt:new Date(ciNow+210*60000).toISOString(),
    policy:{}
  }
});
const futureQr=await reqError("/api/activities/"+encodeURIComponent(futureActivity.activity.id)+"/qr",{
  actor:"ORG001",method:"POST"
});
assert(futureQr.status===409 && futureQr.data?.error==="QR_CHECKIN_NOT_OPEN","future QR window should block issuance");

const futureCheckoutQr=await reqError("/api/activities/"+encodeURIComponent(futureActivity.activity.id)+"/qr",{
  actor:"ORG001",method:"POST",body:{purpose:"CHECKOUT"}
});
assert(futureCheckoutQr.status===409 && futureCheckoutQr.data?.error==="QR_CHECKOUT_NOT_OPEN","future checkout QR window should block issuance");

const closedActivity=await req("/api/activities",{
  actor:"ORG001",
  method:"POST",
  body:{
    title:"CI closed QR window",
    category:"ทดสอบ",
    location:"CI",
    startAt:new Date(ciNow-60*60000).toISOString(),
    endAt:new Date(ciNow+60*60000).toISOString(),
    checkinOpenAt:new Date(ciNow-90*60000).toISOString(),
    checkinCloseAt:new Date(ciNow-30*60000).toISOString(),
    checkoutOpenAt:new Date(ciNow+30*60000).toISOString(),
    checkoutCloseAt:new Date(ciNow+90*60000).toISOString(),
    policy:{}
  }
});
const closedQr=await reqError("/api/activities/"+encodeURIComponent(closedActivity.activity.id)+"/qr",{
  actor:"ORG001",method:"POST"
});
assert(closedQr.status===409 && closedQr.data?.error==="QR_CHECKIN_CLOSED","closed QR window should block issuance");

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
    changeReason: "CI active activity assignment update",
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
  body: { purpose:"CHECKIN" },
});
assert(qr.token && qr.expiresAt && qr.purpose==="CHECKIN", "signed CHECKIN QR issuance failed");

const checkoutQr = await req("/api/activities/" + encodeURIComponent(activity.id) + "/qr", {
  actor:"ORG001",
  method:"POST",
  body:{purpose:"CHECKOUT"},
});
assert(checkoutQr.token && checkoutQr.purpose==="CHECKOUT","signed CHECKOUT QR issuance failed");

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

const checkoutWithoutQr=await reqError("/api/attendance/" + encodeURIComponent(attendanceId) + "/checkout", {
  actor:"P001",method:"POST"
});
assert(checkoutWithoutQr.status===400 && checkoutWithoutQr.data?.error==="CHECKOUT_QR_REQUIRED","checkout must require CHECKOUT QR");

const wrongPurposeCheckout=await reqError("/api/attendance/" + encodeURIComponent(attendanceId) + "/checkout", {
  actor:"P001",method:"POST",body:{token:qr.token}
});
assert(wrongPurposeCheckout.status===409 && wrongPurposeCheckout.data?.error==="QR_PURPOSE_MISMATCH","CHECKIN QR must not work for checkout");

const wrongPurposeCheckin=await reqError("/api/attendance/checkin",{
  actor:"P001",method:"POST",body:{userId:"P001",token:checkoutQr.token}
});
assert(wrongPurposeCheckin.status===409 && wrongPurposeCheckin.data?.error==="QR_PURPOSE_MISMATCH","CHECKOUT QR must not work for checkin");

const checkedOut=await req("/api/attendance/" + encodeURIComponent(attendanceId) + "/checkout", {
  actor: "P001",
  method: "POST",
  body:{token:checkoutQr.token}
});
assert(checkedOut.attendance?.checkoutQrValid===true && checkedOut.attendance?.checkoutMethod==="DYNAMIC_QR","checkout QR evidence not stored");

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

const assistActivity=await req("/api/activities",{
  actor:"ORG001",method:"POST",
  body:{
    title:"CI staff-assisted checkout",
    category:"ทดสอบ",location:"CI",
    startAt:new Date(ciNow-5*60000).toISOString(),
    endAt:new Date(ciNow+120*60000).toISOString(),
    checkinOpenAt:new Date(ciNow-10*60000).toISOString(),
    checkinCloseAt:new Date(ciNow+20*60000).toISOString(),
    checkoutOpenAt:new Date(ciNow+90*60000).toISOString(),
    checkoutCloseAt:new Date(ciNow+150*60000).toISOString(),
    policy:{}
  }
});
const assistCheckinQr=await req("/api/activities/"+encodeURIComponent(assistActivity.activity.id)+"/qr",{
  actor:"ORG001",method:"POST",body:{purpose:"CHECKIN"}
});
const assistCheckin=await req("/api/attendance/checkin",{
  actor:"P002",method:"POST",body:{userId:"P002",token:assistCheckinQr.token}
});
const assisted=await req("/api/attendance/"+encodeURIComponent(assistCheckin.attendance.id)+"/checkout-assist",{
  actor:"STF001",method:"POST",body:{reason:"CI official duty early checkout exception"}
});
assert(assisted.attendance?.checkoutMethod==="STAFF_ASSISTED" && assisted.attendance?.checkoutQrValid===false,"staff-assisted checkout evidence missing");
const assistedEvidence=await req("/api/evidence/"+encodeURIComponent(assistCheckin.attendance.id)+"/evaluate",{
  actor:"STF001",method:"POST"
});
assert((assistedEvidence.result?.reasonCodes||[]).includes("STAFF_ASSISTED_CHECKOUT"),"assisted checkout must be review-required");

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

const personalQr=await req("/api/personal-qr/me",{actor:"P001"});
assert(personalQr.token&&personalQr.reusableAcrossActivities===true,"personal QR issuance failed");

const resolvedPersonal=await req("/api/personal-qr/resolve",{
  actor:"STF001",method:"POST",body:{token:personalQr.token}
});
assert(resolvedPersonal.user?.employeeId==="P001","personal QR resolve failed");
assert((resolvedPersonal.attendance||[]).some(r=>r.id===attendanceId),"personal QR should retrieve attendance records");

const reissuedPersonal=await req("/api/personal-qr/reissue",{actor:"P001",method:"POST"});
assert(reissuedPersonal.token&&reissuedPersonal.token!==personalQr.token,"personal QR reissue failed");

const oldPersonal=await reqError("/api/personal-qr/resolve",{
  actor:"STF001",method:"POST",body:{token:personalQr.token}
});
assert(oldPersonal.status===410&&oldPersonal.data?.error==="PERSONAL_QR_REVOKED_OR_UNKNOWN","old personal QR should be revoked");

const resolvedReissued=await req("/api/personal-qr/resolve",{
  actor:"STF001",method:"POST",body:{token:reissuedPersonal.token}
});
assert(resolvedReissued.user?.employeeId==="P001","reissued personal QR should resolve");

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

const missingReasonReview = await reqError("/api/reviews/" + encodeURIComponent(attendanceId), {
  actor: "ADM001",
  method: "POST",
  body: {
    decision: "OVERRIDE_VERIFY",
    reason: "",
    reviewDurationSeconds: 1,
  },
});
assert(missingReasonReview.status === 400, "every human review decision must require a reason");
assert(missingReasonReview.data?.error === "REVIEW_REASON_REQUIRED", "wrong missing-reason review error");

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
    predictions: [
      {
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
      },
      {
        attendanceId: assistCheckin.attendance.id,
        riskProbability: 0.32,
        predictedLabel: "NO_REVIEW_REQUIRED",
        explanation: {
          method: "single_feature_reference_perturbation",
          causal: false,
          threshold: 0.5,
          reasons: [
            { feature: "staff_verified", label: "หลักฐานจากเจ้าหน้าที่", contribution: -0.12 }
          ]
        }
      }
    ]
  },
});
assert(batchPrediction.importedCount === 2, "AI batch prediction import failed");

const xai = await req("/api/xai/queue", { actor: "STF001" });
assert(xai.decisionSupportOnly === true, "XAI queue must remain decision support only");
assert(xai.rankingBasis === "deployed_model_risk_probability_desc", "XAI queue ranking basis mismatch");
const xaiRecord = xai.records.find((p) => p.attendanceId === attendanceId);
const xaiLowerRisk = xai.records.find((p) => p.attendanceId === assistCheckin.attendance.id);
assert(xaiRecord && xaiLowerRisk, "XAI queue missing ranked predictions");
assert(xaiRecord.modelVersion === "ACTIVA-CI-SYNTHETIC-001", "XAI model version mismatch");
assert(Math.abs(xaiRecord.riskProbability - 0.84) < 1e-9, "XAI risk probability mismatch");
assert(xaiRecord.riskPercent === 84, "XAI riskPercent mismatch");
assert(xaiRecord.modelFlaggedForReview === true, "XAI flagged-for-review metadata mismatch");
assert(xaiLowerRisk.modelFlaggedForReview === false, "XAI no-review metadata mismatch");
assert(xaiRecord.priorityRank < xaiLowerRisk.priorityRank, "higher AI risk must receive earlier queue priority");

const afterPrediction = await req("/api/attendance", { actor: "ADM001" });
const afterStatus = afterPrediction.attendance.find((r) => r.id === attendanceId)?.finalEvidenceStatus;
assert(beforeStatus === afterStatus, "AI prediction changed final evidence status automatically");
assert(afterStatus === "OVERRIDE_VERIFIED", "manual override status was not preserved after AI prediction");

const audit = await req("/api/audit", { actor: "ADM001" });
assert(audit.logs.length > 0, "audit trail empty");
const reviewAudit = audit.logs.find((x) =>
  x.entityType === "AttendanceRecord" &&
  x.entityId === attendanceId &&
  ["HUMAN_REVIEW","MANUAL_OVERRIDE_VERIFIED"].includes(x.action)
);
assert(reviewAudit, "human review audit entry missing");
assert(reviewAudit.metadata?.reviewId, "review audit missing reviewId");
assert(Object.prototype.hasOwnProperty.call(reviewAudit.metadata || {}, "previousFinalStatus"), "review audit missing previousFinalStatus");
assert(reviewAudit.metadata?.finalEvidenceStatus === "OVERRIDE_VERIFIED", "review audit finalEvidenceStatus mismatch");
assert(reviewAudit.metadata?.systemEvidenceStatus, "review audit missing systemEvidenceStatus");
assert(String(reviewAudit.metadata?.reason || "").length >= 3, "review audit missing rationale");

const analytics = await req("/api/analytics/verified", { actor: "ADM001" });
assert(analytics.ok === true, "verified analytics endpoint failed");
assert(analytics.aggregated === true, "verified analytics must be aggregate-only");
assert(analytics.containsPII === false, "verified analytics must not expose PII");
assert(analytics.operational?.recordCount >= 2, "verified analytics record count is incomplete");
assert(analytics.operational?.finalizedCount >= 1, "verified analytics finalized count is missing");
assert(analytics.operational?.unresolvedCount >= 1, "verified analytics unresolved workload is missing");
assert(analytics.operational?.verifiedCount >= 1, "verified analytics verified outcome is missing");
assert(Array.isArray(analytics.operational?.byActivity), "verified analytics activity comparison missing");
assert(Array.isArray(analytics.operational?.exceptionPatterns), "verified analytics exception patterns missing");
assert(analytics.researchSnapshot?.lockedGroundTruthCount >= 1, "research snapshot locked ground truth missing");
assert(analytics.researchSnapshot?.comparableModelGroundTruthCount >= 1, "research snapshot model-ground-truth comparison missing");
assert(
  analytics.researchSnapshot?.modelGroundTruthAgreementRate !== null,
  "research snapshot agreement rate missing"
);

const staffAnalytics = await req("/api/analytics/verified", { actor: "STF001" });
assert(staffAnalytics.containsPII === false, "staff aggregate analytics exposed PII");

const participantAnalytics = await reqError("/api/analytics/verified", { actor: "P001" });
assert(participantAnalytics.status === 403, "participant must not access organization analytics");

const pilot = await req("/api/operations/pilot-readiness", { actor: "ADM001" });
assert(pilot.ok === true, "pilot readiness endpoint failed");
assert(pilot.aggregated === true, "pilot readiness must be aggregate-only");
assert(pilot.containsPII === false, "pilot readiness must not expose PII");
assert(["READY","WATCH","BLOCKED"].includes(pilot.pilotStatus), "invalid pilot readiness status");
assert(pilot.governance?.humanFinalDecisionRequired === true, "pilot governance lost human final decision requirement");
assert(pilot.governance?.aiAutonomousDecision === false, "pilot governance must prohibit autonomous AI personnel decisions");
assert(pilot.governance?.aiRequiredForPilot === false, "AI must not be mandatory for pilot operation");
assert(pilot.reviewMonitoring?.targetHours > 0, "review monitoring target missing");
assert(
  pilot.reviewMonitoring?.targetType === "OPERATIONAL_MONITORING_TARGET_NOT_PERSONNEL_SCORE",
  "review target must be labeled as operational, not personnel scoring"
);
assert(Array.isArray(pilot.dataQuality?.alerts), "pilot data-quality alerts missing");
assert(Array.isArray(pilot.activityClosing?.activities), "activity closing checklist missing");

const staffPilot = await req("/api/operations/pilot-readiness", { actor: "STF001" });
assert(staffPilot.containsPII === false, "staff pilot readiness exposed PII");

const participantPilot = await reqError("/api/operations/pilot-readiness", { actor: "P001" });
assert(participantPilot.status === 403, "participant must not access pilot readiness");

// V1.0 pilot release gate, immutable closure, backup and recovery verification
const releaseNow=Date.now();
const releaseActivity=await req("/api/activities",{
  actor:"ORG001",
  method:"POST",
  body:{
    title:"CI V1 immutable closure",
    category:"ทดสอบ Release",
    location:"CI",
    startAt:new Date(releaseNow-120*60000).toISOString(),
    endAt:new Date(releaseNow-60*60000).toISOString(),
    policy:{}
  }
});
assert(releaseActivity.activity?.id,"V1 closure activity creation failed");

const gateBeforeClose=await req("/api/operations/release-gate",{actor:"ADM001"});
assert(gateBeforeClose.releaseVersion==="ACTIVA-AI-1.0.0","release gate version mismatch");
assert(["GO","HOLD"].includes(gateBeforeClose.gate),"release gate status invalid");
assert(gateBeforeClose.containsPII===false,"release gate must not expose PII");
assert(Array.isArray(gateBeforeClose.scenarios),"release acceptance scenarios missing");
assert(gateBeforeClose.activityClosure?.activities?.some(x=>x.id===releaseActivity.activity.id||x.activityId===releaseActivity.activity.id),"ended activity missing from release closure gate");

const closure=await req("/api/operations/activities/"+encodeURIComponent(releaseActivity.activity.id)+"/close",{
  actor:"ADM001",
  method:"POST",
  body:{reason:"CI confirms immutable V1 operational closure"}
});
assert(closure.immutableOperationalClosure===true,"activity immutable closure failed");
assert(closure.pilotClosureHash,"activity closure hash missing");
assert(closure.pilotClosureVersion==="ACTIVA-AI-1.0.0","activity closure version mismatch");

const closureAgain=await req("/api/operations/activities/"+encodeURIComponent(releaseActivity.activity.id)+"/close",{
  actor:"ADM001",
  method:"POST",
  body:{reason:"CI idempotent closure confirmation"}
});
assert(closureAgain.idempotent===true,"activity closure must be idempotent");

const mutateClosedActivity=await reqError("/api/activities/"+encodeURIComponent(releaseActivity.activity.id)+"/participants",{
  actor:"ADM001",
  method:"PUT",
  body:{mode:"OPEN",userIds:[],departmentCodes:[]}
});
assert(mutateClosedActivity.status===423,"closed activity operational mutation must be locked");
assert(mutateClosedActivity.data?.error==="ACTIVITY_PILOT_CLOSED_IMMUTABLE","wrong closed activity mutation error");

const participantGate=await reqError("/api/operations/release-gate",{actor:"P001"});
assert(participantGate.status===403,"participant must not access V1 release gate");

const participantBackup=await reqError("/api/operations/backup",{actor:"P001"});
assert(participantBackup.status===403,"participant must not export operational backup");

const backupExport=await req("/api/operations/backup",{actor:"ADM001"});
assert(backupExport.backup?.format==="ACTIVA_AI_BACKUP_V1","backup format mismatch");
assert(backupExport.backup?.releaseVersion==="ACTIVA-AI-1.0.0","backup release version mismatch");
assert(backupExport.backup?.containsPII===true,"operational backup must explicitly declare PII");
assert(backupExport.backup?.containsSecrets===false,"operational backup must exclude secrets");
assert(backupExport.backup?.checksum,"backup checksum missing");

const recoveryCheck=await req("/api/operations/recovery-check",{
  actor:"ADM001",
  method:"POST",
  body:{backup:backupExport.backup}
});
assert(recoveryCheck.restorableStructureVerified===true,"backup recovery structure check failed");
assert(recoveryCheck.destructiveRestorePerformed===false,"recovery check must not overwrite live database");
assert(recoveryCheck.currentReleaseVersionMatch===true,"recovery check release version mismatch");

const tamperedBackup=JSON.parse(JSON.stringify(backupExport.backup));
tamperedBackup.payload.users.push({id:"tampered"});
const tamperedCheck=await reqError("/api/operations/recovery-check",{
  actor:"ADM001",
  method:"POST",
  body:{backup:tamperedBackup}
});
assert(tamperedCheck.status===422,"tampered backup must fail recovery verification");
assert(tamperedCheck.data?.error==="BACKUP_CHECKSUM_MISMATCH","tampered backup checksum error mismatch");

const gateAfterRecovery=await req("/api/operations/release-gate",{actor:"ADM001"});
assert(gateAfterRecovery.backupRecovery?.passed===true,"recent V1 recovery check must satisfy backup gate");

const holdDecision=await req("/api/operations/release-decision",{
  actor:"ADM001",
  method:"POST",
  body:{decision:"HOLD",reason:"CI records a deliberate HOLD decision for release audit"}
});
assert(holdDecision.decision==="HOLD","release HOLD decision was not recorded");

console.log("ACTIVA-AI V1.0.0 smoke test passed");
