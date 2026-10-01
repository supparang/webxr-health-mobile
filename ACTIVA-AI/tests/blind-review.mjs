import { prisma } from "../server/db.js";

const base = process.env.ACTIVA_BASE_URL || "http://127.0.0.1:3000";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, { actor, method = "GET", body, blindToken } = {}) {
  const headers = { Accept:"application/json" };
  if (actor) headers["x-activa-user-id"] = actor;
  if (blindToken) headers.Authorization = "BlindReview " + blindToken;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  return { response, data, text };
}

function tokenFromPath(path) {
  const url = new URL(path, "https://blind.example.test");
  return new URLSearchParams(url.hash.replace(/^#/, "")).get("token") || "";
}

const admin = await prisma.user.findUnique({ where:{ employeeId:"ADM001" } });
const participant = await prisma.user.findUnique({ where:{ employeeId:"P002" } });
const verifier = await prisma.user.findUnique({ where:{ employeeId:"STF001" } });
assert(admin && participant && verifier, "blind-review CI users missing");

const now = Date.now();
const activity = await prisma.activity.create({
  data:{
    title:"CI External Blind Review Activity",
    dataClassification:"QA_TEST",
    classifiedAt:new Date(),
    category:"วิจัย",
    location:"CI",
    startAt:new Date(now - 2*3600000),
    endAt:new Date(now - 60*60000),
    checkinOpenAt:new Date(now - 150*60000),
    checkinCloseAt:new Date(now - 110*60000),
    checkoutOpenAt:new Date(now - 75*60000),
    checkoutCloseAt:new Date(now - 45*60000),
    organizerId:admin.id,
    policy:{ create:{
      qrRequired:true,
      identityRequired:true,
      checkinRequired:true,
      checkoutRequired:true,
      durationRequired:true,
      staffRequired:true,
      signatureRequired:false,
      minDurationRatio:0.75,
    }},
  },
});

const attendance = await prisma.attendanceRecord.create({
  data:{
    activityId:activity.id,
    userId:participant.id,
    checkinAt:new Date(now - 115*60000),
    checkoutAt:new Date(now - 62*60000),
    checkoutQrValid:true,
    checkoutMethod:"DYNAMIC_QR",
    durationMinutes:53,
    attendancePercentage:0.8833,
    attendanceStatus:"CHECKED_OUT",
    qrValid:true,
    identityVerified:true,
    signatureVerified:false,
    scanAttempts:1,
  },
});
await prisma.staffVerification.create({
  data:{
    attendanceId:attendance.id,
    verifierId:verifier.id,
    status:"VERIFIED_PRESENT",
  },
});

const page = await fetch(base + "/blind-review");
assert(page.status === 200, "blind-review public page missing");
const script = await fetch(base + "/blind-review.js");
assert(script.status === 200, "blind-review public client missing");

const created = await api("/api/ground-truth/" + encodeURIComponent(attendance.id) + "/blind-batch", {
  actor:"ADM001",
  method:"POST",
  body:{ expiresHours:24 },
});
assert(created.response.status === 201, "blind review batch creation failed: " + created.text);
assert(created.data.tokenReturnedOnce === true, "token-return-once contract missing");
assert(created.data.rawTokensPersisted === false, "raw token persistence contract failed");
assert(Array.isArray(created.data.links) && created.data.links.length === 2, "expected two blind review links");

const tokenA = tokenFromPath(created.data.links.find((x) => x.reviewerSlot === "A")?.path || "");
const tokenB = tokenFromPath(created.data.links.find((x) => x.reviewerSlot === "B")?.path || "");
assert(tokenA.length >= 32 && tokenB.length >= 32 && tokenA !== tokenB, "blind tokens invalid");

const sessionA = await api("/api/public/blind-review/session", { blindToken:tokenA });
assert(sessionA.response.status === 200 && sessionA.data.ok, "Reviewer A session failed");
assert(sessionA.data.containsDirectPII === false, "blind session must declare no direct PII");
assert(sessionA.data.aiPredictionIncluded === false, "blind session leaked AI prediction flag");
assert(sessionA.data.ruleConsistencyIncluded === false, "blind session leaked rule consistency flag");
assert(sessionA.data.peerLabelsIncluded === false, "blind session leaked peer-label flag");
assert(sessionA.data.reviewerSlot === "A", "Reviewer A slot mismatch");
const serializedA = JSON.stringify(sessionA.data);
for (const prohibited of ["employeeId","participant_hash","riskProbability","predictedLabel","consistencyResult","groundTruthLabels"]) {
  assert(!serializedA.includes(prohibited), "blind review payload leaked prohibited field: " + prohibited);
}

const missingAttestation = await api("/api/public/blind-review/submit", {
  blindToken:tokenA,
  method:"POST",
  body:{ target:"NO_REVIEW_REQUIRED", reasonCodes:[], independenceAttested:false },
});
assert(missingAttestation.response.status === 400, "independence attestation must be required");

const submitA = await api("/api/public/blind-review/submit", {
  blindToken:tokenA,
  method:"POST",
  body:{
    target:"NO_REVIEW_REQUIRED",
    reasonCodes:[],
    notes:"Independent CI reviewer A",
    independenceAttested:true,
  },
});
assert(submitA.response.status === 201 && submitA.data.submitted, "Reviewer A submit failed");
assert(submitA.data.batchComplete === false, "batch must remain incomplete after first reviewer");

const replayA = await api("/api/public/blind-review/submit", {
  blindToken:tokenA,
  method:"POST",
  body:{ target:"NO_REVIEW_REQUIRED", reasonCodes:[], independenceAttested:true },
});
assert(replayA.response.status === 409, "one-time Reviewer A token replay must fail");

const queueAfterA = await api("/api/ground-truth/queue", { actor:"ADM001" });
const adminRowAfterA = (queueAfterA.data.records || []).find((x) => x.id === attendance.id);
assert(adminRowAfterA, "blind-review attendance missing from admin Ground Truth queue");
assert((adminRowAfterA.externalGroundTruthLabels || []).length === 0, "ADMIN must not see external target before both reviewers submit");

const submitB = await api("/api/public/blind-review/submit", {
  blindToken:tokenB,
  method:"POST",
  body:{
    target:"NO_REVIEW_REQUIRED",
    reasonCodes:[],
    notes:"Independent CI reviewer B",
    independenceAttested:true,
  },
});
assert(submitB.response.status === 201 && submitB.data.batchComplete === true, "Reviewer B should complete batch");

const queueAdmin = await api("/api/ground-truth/queue", { actor:"ADM001" });
const adminRow = (queueAdmin.data.records || []).find((x) => x.id === attendance.id);
assert((adminRow?.externalGroundTruthLabels || []).length === 2, "ADMIN must see both labels after batch completion");

const queueStaff = await api("/api/ground-truth/queue", { actor:"STF002" });
const staffRow = (queueStaff.data.records || []).find((x) => x.id === attendance.id);
assert(staffRow, "STAFF Ground Truth queue missing eligible attendance");
assert((staffRow.externalGroundTruthLabels || []).length === 0, "STAFF must not see external blind labels");

const lock = await api("/api/ground-truth/" + encodeURIComponent(attendance.id) + "/lock", {
  actor:"ADM001",
  method:"POST",
});
assert(lock.response.status === 200, "external blind consensus lock failed: " + lock.text);
assert(lock.data.groundTruthCase?.status === "LOCKED", "external blind labels did not create LOCKED Ground Truth");
assert(lock.data.resolutionMode === "CONSENSUS", "agreeing external blind labels should direct-lock by consensus");

const labels = await prisma.externalGroundTruthLabel.findMany({
  where:{ attendanceId:attendance.id },
  include:{ invite:true },
});
assert(labels.length === 2, "expected two persisted external labels");
assert(labels.every((x) => x.invite.independenceAttested === true), "independence attestation not persisted");
assert(labels.every((x) => /^[a-f0-9]{64}$/.test(x.invite.tokenHash)), "only SHA-256 token hashes should persist");

const auditCount = await prisma.auditLog.count({
  where:{ action:"EXTERNAL_BLIND_REVIEW_SUBMITTED", entityId:attendance.id },
});
assert(auditCount === 2, "external blind review audit trail incomplete");

// A locked QA record must be excluded by EVERY empirical research endpoint,
// while staying visible in operational Ground Truth/audit for QA traceability.
const [planning, dataset, exportData, readiness, analytics] = await Promise.all([
  api("/api/ml/planning-summary",{actor:"ADM001"}),
  api("/api/ml/dataset",{actor:"ADM001"}),
  api("/api/research/export",{actor:"ADM001"}),
  api("/api/ml/readiness",{actor:"ADM001"}),
  api("/api/analytics/verified",{actor:"ADM001"}),
]);
assert(planning.data.scope==="EMPIRICAL_ONLY", "planning provenance scope missing");
assert(dataset.data.scope==="EMPIRICAL_ONLY", "ML provenance scope missing");
assert(exportData.data.scope==="EMPIRICAL_ONLY", "research export provenance scope missing");
assert(readiness.data.scope==="EMPIRICAL_ONLY", "ML readiness provenance scope missing");
assert(analytics.data.researchSnapshot?.scope==="EMPIRICAL_ONLY", "research analytics scope missing");
assert(!(dataset.data.records||[]).some(x=>x.record_id===attendance.id), "LOCKED QA leaked into ML dataset");
assert(!(exportData.data.records||[]).some(x=>x.record_id===attendance.id), "QA leaked into research export");
assert(planning.data.counts.lockedCount===readiness.data.counts.lockedCount, "QA contaminated planning/readiness counts");

// Legacy/unclassified locked rows must also fail closed, even if labels are present.
const legacyActivity = await prisma.activity.create({
  data:{
    title:"CI legacy unclassified",
    category:"ประชุม",
    location:"CI",
    startAt:new Date(now-3*3600000),
    endAt:new Date(now-2*3600000),
    organizerId:admin.id,
  },
});
const legacyAttendance = await prisma.attendanceRecord.create({
  data:{
    activityId:legacyActivity.id,
    userId:participant.id,
    checkinAt:new Date(now-175*60000),
    checkoutAt:new Date(now-135*60000),
    qrValid:true,
    identityVerified:true,
  },
});
await prisma.groundTruthCase.create({
  data:{
    attendanceId:legacyAttendance.id,
    status:"LOCKED",
    finalTarget:"REVIEW_REQUIRED",
    reasonCodes:["OTHER"],
    lockedAt:new Date(),
  },
});
const [afterPlan, afterDataset, afterExport] = await Promise.all([
  api("/api/ml/planning-summary",{actor:"ADM001"}),
  api("/api/ml/dataset",{actor:"ADM001"}),
  api("/api/research/export",{actor:"ADM001"}),
]);
assert(afterPlan.data.counts.lockedCount===planning.data.counts.lockedCount, "legacy locked records leaked into planning");
assert(!(afterDataset.data.records||[]).some(x=>x.record_id===legacyAttendance.id), "UNCLASSIFIED leaked into ML");
assert(!(afterExport.data.records||[]).some(x=>x.record_id===legacyAttendance.id), "UNCLASSIFIED leaked into research export");

console.log("ACTIVA-AI external blind reviewer + QA isolation test passed");
await prisma.$disconnect();
