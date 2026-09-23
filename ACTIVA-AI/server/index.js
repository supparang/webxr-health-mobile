import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { prisma } from "./db.js";
import { createEventToken, verifyEventToken } from "./qr.js";
import { evaluateEvidence } from "./evidence.js";
import { attachActor, requireRoles, resolveUserRef } from "./auth.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const qrTtl = Number(process.env.QR_TOKEN_TTL_SECONDS || 45);
const ruleVersion = process.env.RULE_VERSION || "ACTIVA-RULES-0.2.0";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function actorId(req) {
  return req.activaUser?.id || null;
}

async function audit(req, action, entityType, entityId, metadata = {}) {
  await prisma.auditLog.create({
    data: {
      actorId: actorId(req),
      action,
      entityType,
      entityId,
      metadata,
    },
  });
}

function toIso(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("INVALID_DATE");
  return d;
}

function hashParticipant(userId) {
  const salt = process.env.RESEARCH_HASH_SALT || "ACTIVA-DEMO-SALT";
  return crypto.createHash("sha256").update(userId + "|" + salt).digest("hex");
}

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    res.json({ ok: true, version: "0.2.0", database: "connected", ai: "disabled-until-ground-truth" });
  } catch (error) {
    res.status(503).json({ ok: false, version: "0.2.0", database: "unavailable", error: error.message });
  }
});


app.use("/api", attachActor);

app.get("/api/users", requireRoles("ADMIN", "ORGANIZER", "STAFF"), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      employeeId: true,
      name: true,
      role: true,
      status: true,
      department: { select: { code: true, name: true } },
    },
    orderBy: { employeeId: "asc" },
  });
  res.json({ ok: true, users });
});

app.get("/api/dashboard/summary", async (_req, res) => {
  const [activityCount, recordCount, verifiedCount, reviewCount, incompleteCount] = await Promise.all([
    prisma.activity.count(),
    prisma.attendanceRecord.count(),
    prisma.attendanceRecord.count({ where: { finalEvidenceStatus: "VERIFIED" } }),
    prisma.consistencyResult.count({ where: { status: "REVIEW_REQUIRED" } }),
    prisma.consistencyResult.count({ where: { status: "INCOMPLETE" } }),
  ]);

  res.json({
    ok: true,
    summary: {
      activityCount,
      recordCount,
      verifiedCount,
      reviewRequiredCount: reviewCount,
      incompleteCount,
    },
  });
});

app.get("/api/attendance", async (req, res) => {
  const where = req.query.activityId ? { activityId: String(req.query.activityId) } : {};
  const rows = await prisma.attendanceRecord.findMany({
    where,
    include: {
      user: { select: { id: true, employeeId: true, name: true } },
      activity: { select: { id: true, title: true, category: true, startAt: true, endAt: true } },
      staffVerification: true,
      consistencyResult: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ ok: true, attendance: rows });
});

app.get("/api/activities", async (_req, res) => {
  const rows = await prisma.activity.findMany({
    include: { policy: true },
    orderBy: { startAt: "desc" },
  });
  res.json({ ok: true, activities: rows });
});

app.post("/api/activities", requireRoles("ADMIN", "ORGANIZER"), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title || !b.category || !b.location || !b.startAt || !b.endAt) {
      return res.status(400).json({ ok: false, error: "MISSING_REQUIRED_FIELDS" });
    }

    const activity = await prisma.activity.create({
      data: {
        title: b.title,
        category: b.category,
        description: b.description || null,
        location: b.location,
        startAt: toIso(b.startAt),
        endAt: toIso(b.endAt),
        checkinOpenAt: b.checkinOpenAt ? toIso(b.checkinOpenAt) : null,
        checkinCloseAt: b.checkinCloseAt ? toIso(b.checkinCloseAt) : null,
        checkoutOpenAt: b.checkoutOpenAt ? toIso(b.checkoutOpenAt) : null,
        checkoutCloseAt: b.checkoutCloseAt ? toIso(b.checkoutCloseAt) : null,
        organizerId: actorId(req),
        policy: {
          create: {
            qrRequired: b.policy?.qrRequired ?? true,
            identityRequired: b.policy?.identityRequired ?? true,
            checkinRequired: b.policy?.checkinRequired ?? true,
            checkoutRequired: b.policy?.checkoutRequired ?? true,
            durationRequired: b.policy?.durationRequired ?? true,
            staffRequired: b.policy?.staffRequired ?? true,
            signatureRequired: b.policy?.signatureRequired ?? false,
            minDurationRatio: Number(b.policy?.minDurationRatio ?? 0.75),
          },
        },
      },
      include: { policy: true },
    });

    await audit(req, "ACTIVITY_CREATED", "Activity", activity.id, { title: activity.title });
    res.status(201).json({ ok: true, activity });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/api/activities/:activityId/qr", requireRoles("ADMIN", "ORGANIZER"), async (req, res) => {
  const activity = await prisma.activity.findUnique({ where: { id: req.params.activityId } });
  if (!activity) return res.status(404).json({ ok: false, error: "ACTIVITY_NOT_FOUND" });

  const issued = createEventToken(activity.id, qrTtl);
  await prisma.qrToken.create({
    data: {
      activityId: activity.id,
      tokenHash: issued.tokenHash,
      nonce: issued.payload.nonce,
      keyVersion: issued.payload.kv,
      issuedAt: new Date(issued.payload.iat * 1000),
      expiresAt: new Date(issued.payload.exp * 1000),
    },
  });

  await audit(req, "QR_ISSUED", "Activity", activity.id, {
    expiresAt: new Date(issued.payload.exp * 1000).toISOString(),
  });

  res.json({
    ok: true,
    token: issued.token,
    issuedAt: new Date(issued.payload.iat * 1000).toISOString(),
    expiresAt: new Date(issued.payload.exp * 1000).toISOString(),
  });
});

app.post("/api/attendance/checkin", async (req, res) => {
  const b = req.body || {};
  const tokenResult = verifyEventToken(b.token);
  if (!tokenResult.ok) {
    return res.status(400).json({ ok: false, error: tokenResult.reason });
  }

  const activityId = tokenResult.payload.eventId;
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { policy: true },
  });
  if (!activity) return res.status(404).json({ ok: false, error: "ACTIVITY_NOT_FOUND" });

  const user = await resolveUserRef(b.userId);
  if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

  if (req.activaUser.role === "PARTICIPANT" && req.activaUser.id !== user.id) {
    return res.status(403).json({ ok: false, error: "PARTICIPANT_CAN_ONLY_CHECKIN_SELF" });
  }

  const existing = await prisma.attendanceRecord.findFirst({
    where: { activityId, userId: user.id, checkoutAt: null },
  });
  if (existing) return res.status(409).json({ ok: false, error: "OPEN_ATTENDANCE_EXISTS", attendanceId: existing.id });

  const row = await prisma.attendanceRecord.create({
    data: {
      activityId,
      userId: user.id,
      checkinAt: new Date(),
      attendanceStatus: "CHECKED_IN",
      qrValid: true,
      identityVerified: true,
      scanAttempts: 1,
    },
  });

  await audit(req, "CHECKIN", "AttendanceRecord", row.id, { activityId, userId: user.id });
  res.status(201).json({ ok: true, attendance: row });
});

app.post("/api/attendance/:attendanceId/checkout", async (req, res) => {
  const current = await prisma.attendanceRecord.findUnique({
    where: { id: req.params.attendanceId },
    include: { activity: true },
  });
  if (!current) return res.status(404).json({ ok: false, error: "ATTENDANCE_NOT_FOUND" });
  if (!current.checkinAt) return res.status(409).json({ ok: false, error: "CHECKIN_REQUIRED" });

  const checkoutAt = new Date();
  const durationMinutes = Math.max(0, Math.round((checkoutAt.getTime() - current.checkinAt.getTime()) / 60000));
  const expectedMinutes = Math.max(1, Math.round((current.activity.endAt.getTime() - current.activity.startAt.getTime()) / 60000));
  const attendancePercentage = Math.min(100, (durationMinutes / expectedMinutes) * 100);

  const row = await prisma.attendanceRecord.update({
    where: { id: current.id },
    data: {
      checkoutAt,
      durationMinutes,
      attendancePercentage,
      attendanceStatus: "CHECKED_OUT",
    },
  });

  await audit(req, "CHECKOUT", "AttendanceRecord", row.id, { durationMinutes, attendancePercentage });
  res.json({ ok: true, attendance: row });
});

app.post("/api/attendance/:attendanceId/staff-verify", requireRoles("ADMIN", "ORGANIZER", "STAFF"), async (req, res) => {
  const verifierId = actorId(req);
  if (!verifierId) return res.status(401).json({ ok: false, error: "X_ACTIVA_USER_ID_REQUIRED" });

  const attendance = await prisma.attendanceRecord.findUnique({ where: { id: req.params.attendanceId } });
  if (!attendance) return res.status(404).json({ ok: false, error: "ATTENDANCE_NOT_FOUND" });

  const row = await prisma.staffVerification.upsert({
    where: { attendanceId: attendance.id },
    create: { attendanceId: attendance.id, verifierId },
    update: { verifierId, verifiedAt: new Date(), status: "VERIFIED_PRESENT" },
  });

  await audit(req, "STAFF_VERIFIED", "AttendanceRecord", attendance.id, { verifierId });
  res.json({ ok: true, verification: row });
});

app.post("/api/evidence/:attendanceId/evaluate", async (req, res) => {
  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: req.params.attendanceId },
    include: {
      activity: { include: { policy: true } },
      staffVerification: true,
    },
  });
  if (!attendance) return res.status(404).json({ ok: false, error: "ATTENDANCE_NOT_FOUND" });
  if (!attendance.activity.policy) return res.status(409).json({ ok: false, error: "POLICY_NOT_CONFIGURED" });

  const result = evaluateEvidence(
    attendance,
    attendance.activity.policy,
    attendance.staffVerification,
    ruleVersion
  );

  const stored = await prisma.consistencyResult.upsert({
    where: { attendanceId: attendance.id },
    create: {
      attendanceId: attendance.id,
      status: result.status,
      completenessRatio: result.completenessRatio,
      missingCodes: result.missingCodes,
      reasonCodes: result.reasonCodes,
      durationRatio: result.durationRatio,
      ruleVersion: result.ruleVersion,
    },
    update: {
      status: result.status,
      completenessRatio: result.completenessRatio,
      missingCodes: result.missingCodes,
      reasonCodes: result.reasonCodes,
      durationRatio: result.durationRatio,
      ruleVersion: result.ruleVersion,
      evaluatedAt: new Date(),
    },
  });

  await audit(req, "EVIDENCE_EVALUATED", "AttendanceRecord", attendance.id, {
    status: stored.status,
    ruleVersion,
  });

  res.json({ ok: true, result: stored, note: "Rule-based result; not AI risk probability." });
});

app.post("/api/reviews/:attendanceId", requireRoles("ADMIN", "STAFF"), async (req, res) => {
  const reviewerId = actorId(req);
  if (!reviewerId) return res.status(401).json({ ok: false, error: "X_ACTIVA_USER_ID_REQUIRED" });

  const b = req.body || {};
  const allowed = ["VERIFY", "CORRECT", "REQUEST_EVIDENCE", "REJECT"];
  if (!allowed.includes(b.decision)) return res.status(400).json({ ok: false, error: "INVALID_DECISION" });

  const attendance = await prisma.attendanceRecord.findUnique({ where: { id: req.params.attendanceId } });
  if (!attendance) return res.status(404).json({ ok: false, error: "ATTENDANCE_NOT_FOUND" });

  const review = await prisma.humanReview.create({
    data: {
      attendanceId: attendance.id,
      reviewerId,
      decision: b.decision,
      reason: b.reason || null,
      reviewStartedAt: b.reviewStartedAt ? toIso(b.reviewStartedAt) : null,
      reviewDurationSeconds: b.reviewDurationSeconds ? Number(b.reviewDurationSeconds) : null,
    },
  });

  let finalEvidenceStatus = "REVIEW_REQUIRED";
  if (b.decision === "VERIFY") finalEvidenceStatus = "VERIFIED";
  if (b.decision === "REJECT") finalEvidenceStatus = "REJECTED";

  await prisma.attendanceRecord.update({
    where: { id: attendance.id },
    data: { finalEvidenceStatus },
  });

  await audit(req, "HUMAN_REVIEW", "AttendanceRecord", attendance.id, {
    decision: b.decision,
  });

  res.status(201).json({ ok: true, review, finalEvidenceStatus });
});

app.get("/api/ground-truth/queue", requireRoles("ADMIN", "STAFF"), async (_req, res) => {
  const rows = await prisma.attendanceRecord.findMany({
    include: {
      activity: { include: { policy: true } },
      staffVerification: true,
      consistencyResult: true,
      groundTruthLabels: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Intentionally does not include aiPredictions: ground-truth reviewers remain blinded to AI output.
  res.json({ ok: true, records: rows });
});

app.post("/api/ground-truth/:attendanceId/labels", requireRoles("ADMIN", "STAFF"), async (req, res) => {
  const reviewerId = actorId(req);
  if (!reviewerId) return res.status(401).json({ ok: false, error: "X_ACTIVA_USER_ID_REQUIRED" });

  const b = req.body || {};
  if (!["REVIEW_REQUIRED", "NO_REVIEW_REQUIRED"].includes(b.target)) {
    return res.status(400).json({ ok: false, error: "INVALID_TARGET" });
  }

  const label = await prisma.groundTruthLabel.upsert({
    where: {
      attendanceId_reviewerId: {
        attendanceId: req.params.attendanceId,
        reviewerId,
      },
    },
    create: {
      attendanceId: req.params.attendanceId,
      reviewerId,
      target: b.target,
      reasonCodes: Array.isArray(b.reasonCodes) ? b.reasonCodes : [],
      notes: b.notes || null,
    },
    update: {
      target: b.target,
      reasonCodes: Array.isArray(b.reasonCodes) ? b.reasonCodes : [],
      notes: b.notes || null,
    },
  });

  await audit(req, "GROUND_TRUTH_LABEL", "AttendanceRecord", req.params.attendanceId, {
    target: b.target,
    reasonCodes: b.reasonCodes || [],
  });

  res.status(201).json({ ok: true, label });
});

app.get("/api/research/export", requireRoles("ADMIN"), async (_req, res) => {
  const rows = await prisma.attendanceRecord.findMany({
    include: {
      activity: true,
      staffVerification: true,
      consistencyResult: true,
      humanReviews: { orderBy: { reviewedAt: "desc" }, take: 1 },
      groundTruthLabels: true,
      aiPredictions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const dataset = rows.map((r) => ({
    record_id: r.id,
    participant_hash: hashParticipant(r.userId),
    event_id: r.activityId,
    activity_type: r.activity.category,
    qr_valid: Number(r.qrValid),
    identity_verified: Number(r.identityVerified),
    checkin_time: r.checkinAt?.toISOString() || "",
    checkout_time: r.checkoutAt?.toISOString() || "",
    duration_minutes: r.durationMinutes ?? "",
    attendance_percentage: r.attendancePercentage ?? "",
    staff_verified: Number(Boolean(r.staffVerification)),
    signature_verified: Number(r.signatureVerified),
    missing_evidence_count: Array.isArray(r.consistencyResult?.missingCodes)
      ? r.consistencyResult.missingCodes.length
      : "",
    evidence_mismatch_count: Array.isArray(r.consistencyResult?.reasonCodes)
      ? r.consistencyResult.reasonCodes.length
      : "",
    consistency_status: r.consistencyResult?.status || "",
    rule_version: r.consistencyResult?.ruleVersion || "",
    ai_model_version: r.aiPredictions[0]?.modelVersion || "",
    ai_prediction: r.aiPredictions[0]?.predictedLabel || "",
    risk_probability: r.aiPredictions[0]?.riskProbability ?? "",
    human_decision: r.humanReviews[0]?.decision || "",
    ground_truth_labels: r.groundTruthLabels.map((g) => g.target),
    final_status: r.finalEvidenceStatus || r.consistencyResult?.status || "",
  }));

  res.json({
    ok: true,
    deidentified: true,
    generatedAt: new Date().toISOString(),
    records: dataset,
  });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticDir = path.resolve(__dirname, "..");
app.use(express.static(staticDir));

app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, error: "INTERNAL_SERVER_ERROR" });
});

app.listen(port, () => {
  console.log("ACTIVA-AI V0.2 server running on http://localhost:" + port);
});
