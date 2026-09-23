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

app.get("/api/me", (req, res) => {
  res.json({
    ok: true,
    user: {
      id: req.activaUser.id,
      employeeId: req.activaUser.employeeId,
      name: req.activaUser.name,
      role: req.activaUser.role,
      status: req.activaUser.status,
    },
  });
});

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

app.get("/api/dashboard/summary", async (req, res) => {
  const isParticipant = req.activaUser.role === "PARTICIPANT";
  const attendanceWhere = isParticipant ? { userId: req.activaUser.id } : {};
  const consistencyWhere = isParticipant
    ? { attendance: { userId: req.activaUser.id } }
    : {};

  const [activityCount, recordCount, verifiedCount, reviewCount, incompleteCount] = await Promise.all([
    prisma.activity.count(),
    prisma.attendanceRecord.count({ where: attendanceWhere }),
    prisma.attendanceRecord.count({
      where: { ...attendanceWhere, finalEvidenceStatus: "VERIFIED" },
    }),
    prisma.consistencyResult.count({
      where: { ...consistencyWhere, status: "REVIEW_REQUIRED" },
    }),
    prisma.consistencyResult.count({
      where: { ...consistencyWhere, status: "INCOMPLETE" },
    }),
  ]);

  res.json({
    ok: true,
    scope: isParticipant ? "SELF" : "ORGANIZATION",
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
  const filters = [];
  if (req.query.activityId) filters.push({ activityId: String(req.query.activityId) });
  if (req.activaUser.role === "PARTICIPANT") {
    filters.push({ userId: req.activaUser.id });
  }
  const where = filters.length === 0 ? {} : { AND: filters };

  const rows = await prisma.attendanceRecord.findMany({
    where,
    include: {
      user: { select: { id: true, employeeId: true, name: true } },
      activity: {
        select: {
          id: true,
          title: true,
          category: true,
          startAt: true,
          endAt: true,
          policy: true,
        },
      },
      staffVerification: true,
      consistencyResult: true,
      humanReviews: { orderBy: { reviewedAt: "desc" }, take: 1 },
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
  if (req.activaUser.role === "PARTICIPANT" && current.userId !== req.activaUser.id) {
    return res.status(403).json({ ok: false, error: "PARTICIPANT_CAN_ONLY_CHECKOUT_SELF" });
  }
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

app.post("/api/evidence/:attendanceId/evaluate", requireRoles("ADMIN", "ORGANIZER", "STAFF"), async (req, res) => {
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

app.get("/api/ground-truth/queue", requireRoles("ADMIN", "STAFF"), async (req, res) => {
  const rows = await prisma.attendanceRecord.findMany({
    include: {
      user: { select: { id: true, employeeId: true, name: true } },
      activity: { include: { policy: true } },
      staffVerification: true,
      groundTruthLabels: true,
      groundTruthCase: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Intentionally excludes aiPredictions and consistencyResult:
  // ground-truth reviewers see raw evidence, not AI/rule recommendations.
  // STAFF reviewers only receive their own labels to preserve independent labeling.
  const safeRows = rows.map((row) => ({
    ...row,
    groundTruthLabels:
      req.activaUser.role === "ADMIN"
        ? row.groundTruthLabels
        : row.groundTruthLabels.filter((label) => label.reviewerId === req.activaUser.id),
  }));
  res.json({ ok: true, blinded: true, records: safeRows });
});

app.post("/api/ground-truth/:attendanceId/labels", requireRoles("ADMIN", "STAFF"), async (req, res) => {
  const reviewerId = actorId(req);
  if (!reviewerId) return res.status(401).json({ ok: false, error: "X_ACTIVA_USER_ID_REQUIRED" });

  const existingCase = await prisma.groundTruthCase.findUnique({
    where: { attendanceId: req.params.attendanceId },
  });
  if (existingCase?.status === "LOCKED") {
    return res.status(409).json({ ok: false, error: "GROUND_TRUTH_LOCKED_NO_MORE_LABEL_CHANGES" });
  }

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

app.get("/api/audit", requireRoles("ADMIN"), async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    include: {
      actor: {
        select: { employeeId: true, name: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  res.json({ ok: true, logs });
});

app.post("/api/ground-truth/:attendanceId/adjudicate", requireRoles("ADMIN"), async (req, res) => {
  const attendanceId = req.params.attendanceId;
  const existingCase = await prisma.groundTruthCase.findUnique({ where: { attendanceId } });
  if (existingCase?.status === "LOCKED") {
    return res.status(409).json({ ok: false, error: "GROUND_TRUTH_LOCKED_NO_READJUDICATION" });
  }

  const b = req.body || {};
  const allowedTargets = ["REVIEW_REQUIRED", "NO_REVIEW_REQUIRED"];
  if (!allowedTargets.includes(b.finalTarget)) {
    return res.status(400).json({ ok: false, error: "INVALID_FINAL_TARGET" });
  }

  const labels = await prisma.groundTruthLabel.findMany({
    where: { attendanceId },
    orderBy: { createdAt: "asc" },
  });
  if (labels.length < 2 && b.force !== true) {
    return res.status(409).json({
      ok: false,
      error: "TWO_INDEPENDENT_LABELS_REQUIRED",
      labelCount: labels.length,
    });
  }

  const distinctTargets = [...new Set(labels.map((x) => x.target))];
  if (distinctTargets.length > 1 && !String(b.notes || "").trim()) {
    return res.status(400).json({
      ok: false,
      error: "DISAGREEMENT_REQUIRES_ADJUDICATION_NOTES",
    });
  }

  const reasonCodes = Array.isArray(b.reasonCodes)
    ? [...new Set(b.reasonCodes.map(String))]
    : [...new Set(labels.flatMap((x) => Array.isArray(x.reasonCodes) ? x.reasonCodes.map(String) : []))];

  const groundTruthCase = await prisma.groundTruthCase.upsert({
    where: { attendanceId },
    create: {
      attendanceId,
      finalTarget: b.finalTarget,
      reasonCodes,
      status: "ADJUDICATED",
      adjudicatorId: req.activaUser.id,
      notes: b.notes || null,
      adjudicatedAt: new Date(),
    },
    update: {
      finalTarget: b.finalTarget,
      reasonCodes,
      status: "ADJUDICATED",
      adjudicatorId: req.activaUser.id,
      notes: b.notes || null,
      adjudicatedAt: new Date(),
      lockedAt: null,
    },
  });

  await audit(req, "GROUND_TRUTH_ADJUDICATED", "AttendanceRecord", attendanceId, {
    finalTarget: b.finalTarget,
    labelCount: labels.length,
    distinctTargets,
  });

  res.json({ ok: true, groundTruthCase, labelCount: labels.length, distinctTargets });
});

app.post("/api/ground-truth/:attendanceId/lock", requireRoles("ADMIN"), async (req, res) => {
  const attendanceId = req.params.attendanceId;
  const current = await prisma.groundTruthCase.findUnique({ where: { attendanceId } });
  if (!current || current.status !== "ADJUDICATED" || !current.finalTarget) {
    return res.status(409).json({ ok: false, error: "ADJUDICATION_REQUIRED_BEFORE_LOCK" });
  }

  const groundTruthCase = await prisma.groundTruthCase.update({
    where: { attendanceId },
    data: { status: "LOCKED", lockedAt: new Date() },
  });

  await audit(req, "GROUND_TRUTH_LOCKED", "AttendanceRecord", attendanceId, {
    finalTarget: groundTruthCase.finalTarget,
  });

  res.json({ ok: true, groundTruthCase });
});

app.get("/api/ml/readiness", requireRoles("ADMIN"), async (_req, res) => {
  const [labelCount, adjudicatedCount, lockedCount, reviewLocked, noReviewLocked] = await Promise.all([
    prisma.groundTruthLabel.count(),
    prisma.groundTruthCase.count({ where: { status: "ADJUDICATED" } }),
    prisma.groundTruthCase.count({ where: { status: "LOCKED" } }),
    prisma.groundTruthCase.count({ where: { status: "LOCKED", finalTarget: "REVIEW_REQUIRED" } }),
    prisma.groundTruthCase.count({ where: { status: "LOCKED", finalTarget: "NO_REVIEW_REQUIRED" } }),
  ]);

  res.json({
    ok: true,
    aiEnabled: false,
    note: "Readiness counts only; model training remains offline until locked ground truth is adequate.",
    counts: { labelCount, adjudicatedCount, lockedCount, reviewLocked, noReviewLocked },
  });
});

app.get("/api/ml/dataset", requireRoles("ADMIN"), async (_req, res) => {
  const cases = await prisma.groundTruthCase.findMany({
    where: { status: "LOCKED", finalTarget: { not: null } },
    include: {
      attendance: {
        include: {
          activity: true,
          staffVerification: true,
        },
      },
    },
    orderBy: { lockedAt: "asc" },
  });

  const records = cases.map((c) => {
    const r = c.attendance;
    const a = r.activity;

    const scheduledMinutes = Math.max(1, Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60000));
    const actualMinutes = r.checkinAt && r.checkoutAt
      ? Math.max(0, Math.round((r.checkoutAt.getTime() - r.checkinAt.getTime()) / 60000))
      : null;
    const durationRatio = actualMinutes === null ? null : actualMinutes / scheduledMinutes;
    const checkinOffsetMinutes = r.checkinAt
      ? Math.round((r.checkinAt.getTime() - a.startAt.getTime()) / 60000)
      : null;
    const checkoutOffsetMinutes = r.checkoutAt
      ? Math.round((r.checkoutAt.getTime() - a.endAt.getTime()) / 60000)
      : null;

    return {
      record_id: r.id,
      participant_hash: hashParticipant(r.userId),
      event_id: r.activityId,
      activity_type: a.category,
      qr_valid: Number(r.qrValid),
      identity_verified: Number(r.identityVerified),
      checkin_present: Number(Boolean(r.checkinAt)),
      checkout_present: Number(Boolean(r.checkoutAt)),
      scheduled_duration_minutes: scheduledMinutes,
      actual_duration_minutes: actualMinutes,
      duration_ratio: durationRatio,
      checkin_offset_minutes: checkinOffsetMinutes,
      checkout_offset_minutes: checkoutOffsetMinutes,
      staff_verified: Number(Boolean(r.staffVerification)),
      signature_verified: Number(r.signatureVerified),
      scan_attempts: r.scanAttempts,
      final_target: c.finalTarget,
      reason_codes: c.reasonCodes,
      locked_at: c.lockedAt?.toISOString() || "",
    };
  });

  res.json({
    ok: true,
    datasetStatus: "LOCKED_GROUND_TRUTH_ONLY",
    aiPredictionsIncluded: false,
    deidentified: true,
    records,
  });
});

app.get("/api/models", requireRoles("ADMIN", "STAFF"), async (_req, res) => {
  const models = await prisma.modelRun.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json({ ok: true, models });
});

app.post("/api/models/import-evaluation", requireRoles("ADMIN"), async (req, res) => {
  const b = req.body || {};
  if (!b.version || !b.modelFamily || !b.dataProvenance || !b.validationMetrics) {
    return res.status(400).json({ ok: false, error: "MISSING_MODEL_EVALUATION_FIELDS" });
  }

  const status = b.testMetrics ? "EVALUATED" : "CANDIDATE";
  const model = await prisma.modelRun.upsert({
    where: { version: String(b.version) },
    create: {
      version: String(b.version),
      modelFamily: String(b.modelFamily),
      status,
      dataProvenance: String(b.dataProvenance),
      selectedMetric: b.selectedMetric ? String(b.selectedMetric) : null,
      selectedMetricValue: Number.isFinite(Number(b.selectedMetricValue)) ? Number(b.selectedMetricValue) : null,
      validationMetrics: b.validationMetrics,
      testMetrics: b.testMetrics || null,
      calibration: b.calibration || null,
      explainability: b.explainability || null,
      notes: b.notes || null,
    },
    update: {
      modelFamily: String(b.modelFamily),
      status,
      dataProvenance: String(b.dataProvenance),
      selectedMetric: b.selectedMetric ? String(b.selectedMetric) : null,
      selectedMetricValue: Number.isFinite(Number(b.selectedMetricValue)) ? Number(b.selectedMetricValue) : null,
      validationMetrics: b.validationMetrics,
      testMetrics: b.testMetrics || null,
      calibration: b.calibration || null,
      explainability: b.explainability || null,
      notes: b.notes || null,
    },
  });

  await audit(req, "MODEL_EVALUATION_IMPORTED", "ModelRun", model.id, {
    version: model.version,
    status: model.status,
    dataProvenance: model.dataProvenance,
  });

  res.status(201).json({
    ok: true,
    model,
    note: "Importing evaluation does not approve or deploy a model.",
  });
});

app.post("/api/models/:modelId/approve", requireRoles("ADMIN"), async (req, res) => {
  const model = await prisma.modelRun.findUnique({ where: { id: req.params.modelId } });
  if (!model) return res.status(404).json({ ok: false, error: "MODEL_NOT_FOUND" });
  if (model.status !== "EVALUATED" || !model.testMetrics) {
    return res.status(409).json({ ok: false, error: "MODEL_MUST_BE_EVALUATED_BEFORE_APPROVAL" });
  }

  const approved = await prisma.modelRun.update({
    where: { id: model.id },
    data: {
      status: "APPROVED",
      approvedBy: req.activaUser.id,
      approvedAt: new Date(),
    },
  });

  await audit(req, "MODEL_APPROVED", "ModelRun", model.id, { version: model.version });
  res.json({
    ok: true,
    model: approved,
    note: "Approval is a governance gate; it does not deploy the model.",
  });
});

app.post("/api/models/:modelId/deploy", requireRoles("ADMIN"), async (req, res) => {
  const model = await prisma.modelRun.findUnique({ where: { id: req.params.modelId } });
  if (!model) return res.status(404).json({ ok: false, error: "MODEL_NOT_FOUND" });
  if (model.status !== "APPROVED") {
    return res.status(409).json({ ok: false, error: "MODEL_MUST_BE_APPROVED_BEFORE_DEPLOYMENT" });
  }

  const synthetic = model.dataProvenance === "SYNTHETIC_CI_ONLY";
  if (synthetic && process.env.ALLOW_SYNTHETIC_CI !== "true") {
    return res.status(409).json({ ok: false, error: "SYNTHETIC_MODEL_CANNOT_BE_DEPLOYED" });
  }

  const deployed = await prisma.$transaction(async (tx) => {
    await tx.modelRun.updateMany({
      where: { status: "DEPLOYED", id: { not: model.id } },
      data: { status: "RETIRED" },
    });
    return tx.modelRun.update({
      where: { id: model.id },
      data: {
        status: "DEPLOYED",
        deployedBy: req.activaUser.id,
        deployedAt: new Date(),
      },
    });
  });

  await audit(req, "MODEL_DEPLOYED", "ModelRun", model.id, {
    version: model.version,
    dataProvenance: model.dataProvenance,
  });

  res.json({
    ok: true,
    model: deployed,
    note: "Deployment enables decision-support predictions; human review remains final.",
  });
});

app.post("/api/predictions/import", requireRoles("ADMIN"), async (req, res) => {
  const b = req.body || {};
  const model = await prisma.modelRun.findUnique({ where: { version: String(b.modelVersion || "") } });
  if (!model) return res.status(404).json({ ok: false, error: "MODEL_NOT_FOUND" });
  if (model.status !== "DEPLOYED") {
    return res.status(409).json({ ok: false, error: "ONLY_DEPLOYED_MODEL_PREDICTIONS_CAN_BE_IMPORTED" });
  }

  const attendance = await prisma.attendanceRecord.findUnique({ where: { id: String(b.attendanceId || "") } });
  if (!attendance) return res.status(404).json({ ok: false, error: "ATTENDANCE_NOT_FOUND" });

  const probability = Number(b.riskProbability);
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    return res.status(400).json({ ok: false, error: "RISK_PROBABILITY_MUST_BE_0_TO_1" });
  }

  const existing = await prisma.aIPrediction.findFirst({
    where: { attendanceId: attendance.id, modelRunId: model.id },
  });

  const data = {
    attendanceId: attendance.id,
    modelRunId: model.id,
    modelVersion: model.version,
    predictedLabel: String(b.predictedLabel || (probability >= 0.5 ? "REVIEW_REQUIRED" : "NO_REVIEW_REQUIRED")),
    riskProbability: probability,
    explanation: b.explanation || null,
  };

  const prediction = existing
    ? await prisma.aIPrediction.update({ where: { id: existing.id }, data })
    : await prisma.aIPrediction.create({ data });

  await audit(req, "AI_PREDICTION_IMPORTED", "AttendanceRecord", attendance.id, {
    modelVersion: model.version,
    riskProbability: probability,
  });

  res.status(201).json({
    ok: true,
    prediction,
    decisionSupportOnly: true,
    note: "Prediction import never changes final attendance/evidence status automatically.",
  });
});

app.get("/api/xai/queue", requireRoles("ADMIN", "STAFF"), async (_req, res) => {
  const deployed = await prisma.modelRun.findFirst({
    where: { status: "DEPLOYED" },
    orderBy: { deployedAt: "desc" },
  });
  if (!deployed) {
    return res.json({ ok: true, deployedModel: null, records: [], decisionSupportOnly: true });
  }

  const predictions = await prisma.aIPrediction.findMany({
    where: { modelRunId: deployed.id },
    include: {
      attendance: {
        include: {
          user: { select: { id: true, employeeId: true, name: true } },
          activity: true,
          staffVerification: true,
          consistencyResult: true,
          humanReviews: { orderBy: { reviewedAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { riskProbability: "desc" },
  });

  res.json({
    ok: true,
    deployedModel: deployed,
    decisionSupportOnly: true,
    records: predictions,
  });
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

app.use("/api", (_req, res) => {
  res.status(404).json({ ok: false, error: "API_ROUTE_NOT_FOUND" });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticDir = path.resolve(__dirname, "..");
app.use(express.static(staticDir));

app.use((_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, error: "INTERNAL_SERVER_ERROR" });
});

app.listen(port, () => {
  console.log("ACTIVA-AI V0.3.2 server running on http://localhost:" + port);
});
