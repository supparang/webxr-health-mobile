import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { prisma } from "./db.js";
import { registerGuestPublicRoutes, registerGuestAdminRoutes } from "./guest.js";
import { classificationForNewActivity, EMPIRICAL_ATTENDANCE_FILTER, EMPIRICAL_LOCKED_CASE_FILTER } from "./research-scope.js";
import { empiricalCollectionGate } from "./empirical-gate.js";
import { deployedSourceCommit } from "./source-revision.js";
import { createEventToken, verifyEventToken, createPersonalToken, verifyPersonalToken } from "./qr.js";
import { evaluateEvidence } from "./evidence.js";
import { attachActor, requireRoles, resolveUserRef, authenticationMode, productionAuthenticationReady, googleClientId, googlePilotClientId, googlePilotEmailReady, googleAllowedDomains, googleAllowedEmails } from "./auth.js";
import { configuredOrigins, deploymentConfigurationErrors, productionGoEnabled, deploymentTier } from "./deployment-config.js";

if (process.env.NODE_ENV === "production") {
  const errors = deploymentConfigurationErrors();
  if (errors.length) throw new Error("UNSAFE_DEPLOYMENT_CONFIGURATION: " + errors.join(", "));
}

const app = express();
const port = Number(process.env.PORT || 3000);
const qrTtl = Number(process.env.QR_TOKEN_TTL_SECONDS || 45);
const ruleVersion = process.env.RULE_VERSION || "ACTIVA-RULES-0.2.0";

const allowedOrigins = configuredOrigins();

app.disable("x-powered-by");
app.use((req, res, next) => {
  const incoming = String(req.get("x-request-id") || "").trim();
  const requestId = /^[A-Za-z0-9._:-]{8,128}$/.test(incoming) ? incoming : crypto.randomUUID();
  req.activaRequestId = requestId;
  res.set("X-Request-Id", requestId);
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    if (!req.path.startsWith("/api/")) return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(JSON.stringify({
      type: "http_access",
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      deploymentTier: deploymentTier()
    }));
  });
  next();
});
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  // Google Identity Services popup login requires opener compatibility.
  res.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.set("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production" && deploymentTier() === "PRODUCTION") {
    res.set("Strict-Transport-Security", "max-age=31536000");
  }
  next();
});
app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || (allowedOrigins.length === 0 && process.env.NODE_ENV !== "production")) {
      return callback(null, true);
    }
    const error = new Error("CORS_ORIGIN_NOT_ALLOWED");
    error.status = 403;
    return callback(error);
  },
}));
app.use(express.json({ limit: "1mb" }));

function actorId(req) {
  return req.activaUser?.id || null;
}

const ACTIVITY_PERMISSION_KEYS = [
  "CAN_CREATE_ACTIVITY",
  "CAN_EDIT_OWN_ACTIVITY",
  "CAN_ASSIGN_CO_ORGANIZER",
  "CAN_ASSIGN_VERIFIER",
  "CAN_CLOSE_ACTIVITY",
  "CAN_MANAGE_ALL_ACTIVITIES",
];

function permissionWindowWhere(at = new Date()) {
  return {
    revokedAt: null,
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: at } }] },
      { OR: [{ validUntil: null }, { validUntil: { gte: at } }] },
    ],
  };
}

async function effectiveActivityPermissionKeys(userId, at = new Date()) {
  const rows = await prisma.userActivityPermission.findMany({
    where: { userId, ...permissionWindowWhere(at) },
    select: { permission: true },
  });
  return rows.map((x) => x.permission);
}

async function userHasActivityPermission(user, key) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const row = await prisma.userActivityPermission.findFirst({
    where: { userId: user.id, permission: key, ...permissionWindowWhere(new Date()) },
    select: { id: true },
  });
  return Boolean(row);
}

function requireActivityPermission(key) {
  return async function activityPermissionGuard(req, res, next) {
    try {
      if (await userHasActivityPermission(req.activaUser, key)) return next();
      return res.status(403).json({
        ok: false,
        error: "ACTIVITY_PERMISSION_REQUIRED",
        permission: key,
      });
    } catch (error) {
      next(error);
    }
  };
}

async function activeActivityAssignment(userId, activityId, role) {
  if (!userId || !activityId) return null;
  return prisma.activityRoleAssignment.findFirst({
    where: {
      userId,
      activityId,
      ...(role ? { role } : {}),
    },
    select: { id: true, role: true },
  });
}

async function canAccessPersonnelDirectory(user) {
  if (!user) return false;
  if (["ADMIN","STAFF","ORGANIZER"].includes(user.role)) return true;
  if ((await effectiveActivityPermissionKeys(user.id)).length > 0) return true;
  const assignment = await prisma.activityRoleAssignment.findFirst({
    where: { userId: user.id, role: "CO_ORGANIZER" },
    select: { id: true },
  });
  return Boolean(assignment);
}

async function personnelDirectoryGuard(req, res, next) {
  try {
    if (await canAccessPersonnelDirectory(req.activaUser)) return next();
    return res.status(403).json({ ok:false, error:"PERSONNEL_DIRECTORY_FORBIDDEN" });
  } catch (error) {
    next(error);
  }
}

async function canAssignActivityRole(req, activity, permissionKey) {
  if (req.activaUser?.role === "ADMIN") return true;
  const isPrimary = activity?.organizerId === req.activaUser?.id;
  const managesAll = await userHasActivityPermission(req.activaUser, "CAN_MANAGE_ALL_ACTIVITIES");
  if (!isPrimary && !managesAll) return false;
  return userHasActivityPermission(req.activaUser, permissionKey);
}

function activityLifecycle(activity, at = new Date()) {
  const now = at.getTime();
  const start = new Date(activity?.startAt).getTime();
  const end = new Date(activity?.endAt).getTime();
  if (Number.isFinite(start) && now < start) return "BEFORE_START";
  if (Number.isFinite(end) && now > end) return "ENDED";
  return "ACTIVE";
}

function activityTimeWindows(activity) {
  const start = new Date(activity.startAt).getTime();
  const end = new Date(activity.endAt).getTime();
  return {
    checkinOpenAt: activity.checkinOpenAt || new Date(start - 30 * 60000),
    checkinCloseAt: activity.checkinCloseAt || new Date(start + 30 * 60000),
    checkoutOpenAt: activity.checkoutOpenAt || new Date(end - 30 * 60000),
    checkoutCloseAt: activity.checkoutCloseAt || new Date(end + 30 * 60000),
  };
}

function checkinWindowState(activity, at = new Date()) {
  const w = activityTimeWindows(activity);
  const now = at.getTime();
  const open = new Date(w.checkinOpenAt).getTime();
  const close = new Date(w.checkinCloseAt).getTime();
  if (now < open) return { ok:false, code:"QR_CHECKIN_NOT_OPEN", ...w };
  if (now > close) return { ok:false, code:"QR_CHECKIN_CLOSED", ...w };
  return { ok:true, code:"QR_CHECKIN_OPEN", ...w };
}

function checkoutWindowState(activity, at = new Date()) {
  const w = activityTimeWindows(activity);
  const now = at.getTime();
  const open = new Date(w.checkoutOpenAt).getTime();
  const close = new Date(w.checkoutCloseAt).getTime();
  if (now < open) return { ok:false, code:"QR_CHECKOUT_NOT_OPEN", ...w };
  if (now > close) return { ok:false, code:"QR_CHECKOUT_CLOSED", ...w };
  return { ok:true, code:"QR_CHECKOUT_OPEN", ...w };
}

async function coAssignmentGovernance(req, activity) {
  const lifecycle = activityLifecycle(activity);
  const base = await canAssignActivityRole(req, activity, "CAN_ASSIGN_CO_ORGANIZER");
  if (lifecycle === "BEFORE_START") {
    return { lifecycle, canEdit: base, reasonRequired: false, adminOverrideRequired: false };
  }
  if (lifecycle === "ACTIVE") {
    return { lifecycle, canEdit: base, reasonRequired: base, adminOverrideRequired: false };
  }
  const isAdmin = req.activaUser?.role === "ADMIN";
  return { lifecycle, canEdit: isAdmin, reasonRequired: isAdmin, adminOverrideRequired: isAdmin };
}

async function canManageActivity(req, activity) {
  if (req.activaUser?.role === "ADMIN") return true;
  if (await userHasActivityPermission(req.activaUser, "CAN_MANAGE_ALL_ACTIVITIES")) return true;

  if (activity?.organizerId === req.activaUser?.id) {
    return (
      await userHasActivityPermission(req.activaUser, "CAN_EDIT_OWN_ACTIVITY") ||
      await userHasActivityPermission(req.activaUser, "CAN_CREATE_ACTIVITY")
    );
  }

  return Boolean(await activeActivityAssignment(req.activaUser?.id, activity?.id, "CO_ORGANIZER"));
}

async function canReviewActivity(req, activityId) {
  if (req.activaUser?.role === "ADMIN") return true;
  if (req.activaUser?.role !== "STAFF") return false;
  return Boolean(await activeActivityAssignment(req.activaUser.id, activityId, "VERIFIER"));
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

const RELEASE_VERSION = "ACTIVA-AI-1.0.15";
const BACKUP_FORMAT = "ACTIVA_AI_BACKUP_V1";

async function ensureActivityOperationallyMutable(res, activityId) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, pilotClosedAt: true, pilotClosureHash: true, pilotClosureVersion: true },
  });
  if (!activity) {
    res.status(404).json({ ok: false, error: "ACTIVITY_NOT_FOUND" });
    return false;
  }
  if (activity.pilotClosedAt) {
    res.status(423).json({
      ok: false,
      error: "ACTIVITY_PILOT_CLOSED_IMMUTABLE",
      pilotClosedAt: activity.pilotClosedAt,
      pilotClosureHash: activity.pilotClosureHash,
      pilotClosureVersion: activity.pilotClosureVersion,
    });
    return false;
  }
  return true;
}

async function activityCloseAssessment(activityId) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      policy: true,
      attendanceRecords: {
        where: { isVoided: false },
        include: {
          consistencyResult: true,
          humanReviews: { orderBy: { reviewedAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!activity) return null;

  const terminal = new Set(["VERIFIED", "OVERRIDE_VERIFIED", "REJECTED"]);
  const records = activity.attendanceRecords;
  const criticalIssues = [];
  const duplicateMap = new Map();

  records.forEach((row) => {
    const ownerKey=row.guestParticipantId ? "GUEST|"+row.guestParticipantId : "USER|"+row.userId;
    if (!duplicateMap.has(ownerKey)) duplicateMap.set(ownerKey, []);
    duplicateMap.get(ownerKey).push(row);
  });
  duplicateMap.forEach((group) => {
    if (group.length > 1) criticalIssues.push("DUPLICATE_NONVOID_ATTENDANCE");
  });

  records.forEach((row) => {
    const blockers = [
      ...(Array.isArray(row.consistencyResult?.missingCodes) ? row.consistencyResult.missingCodes : []),
      ...(Array.isArray(row.consistencyResult?.reasonCodes) ? row.consistencyResult.reasonCodes : []),
    ];
    if (row.checkinAt && row.checkoutAt && row.checkoutAt < row.checkinAt) {
      criticalIssues.push("CHECKOUT_BEFORE_CHECKIN");
    }
    if (terminal.has(row.finalEvidenceStatus) && !row.humanReviews[0]) {
      criticalIssues.push("FINAL_STATUS_WITHOUT_HUMAN_REVIEW");
    }
    if (
      row.finalEvidenceStatus === "VERIFIED" &&
      (!row.consistencyResult || row.consistencyResult.status !== "COMPLETE" || blockers.length > 0)
    ) {
      criticalIssues.push("NORMAL_VERIFY_WITH_SYSTEM_BLOCKERS");
    }
  });

  const unevaluatedCount = records.filter((row) => !row.consistencyResult).length;
  const unresolvedCount = records.filter((row) => !terminal.has(row.finalEvidenceStatus)).length;
  const ended = activity.endAt.getTime() < Date.now();
  const uniqueCriticalIssues = [...new Set(criticalIssues)];
  const checklist = [
    { key: "ACTIVITY_ENDED", passed: ended },
    { key: "ALL_RECORDS_EVALUATED", passed: unevaluatedCount === 0 },
    { key: "NO_UNRESOLVED_HUMAN_REVIEW", passed: unresolvedCount === 0 },
    { key: "NO_CRITICAL_DATA_QUALITY", passed: uniqueCriticalIssues.length === 0 },
  ];

  return {
    activity,
    ended,
    recordCount: records.length,
    unevaluatedCount,
    unresolvedCount,
    criticalIssues: uniqueCriticalIssues,
    closeReady: checklist.every((item) => item.passed),
    checklist,
  };
}


function releaseSecurityStatus() {
  const qrSecret = String(process.env.QR_SIGNING_SECRET || "");
  const researchSalt = String(process.env.RESEARCH_HASH_SALT || "");
  const unsafeMarker = /change-this|demo|example|not-for-production|^ci-|test/i;
  const qrSigningReady =
    qrSecret.length >= 32 &&
    !unsafeMarker.test(qrSecret);
  const researchSaltReady =
    researchSalt.length >= 16 &&
    !unsafeMarker.test(researchSalt) &&
    !/ACTIVA-DEMO-SALT/i.test(researchSalt);
  const authenticationReady=productionAuthenticationReady();
  return {
    qrSigningReady,
    researchSaltReady,
    authenticationMode: authenticationMode(),
    authenticationReady,
    ready: qrSigningReady && researchSaltReady && authenticationReady,
    secretsExposed: false,
  };
}

async function buildOperationalBackup() {
  const [
    departments,
    users,
    userActivityPermissions,
    activities,
    activityPolicies,
    activityRoleAssignments,
    activityParticipants,
    guestParticipants,
    attendanceRecords,
    staffVerifications,
    consistencyResults,
    humanReviews,
    groundTruthLabels,
    blindReviewBatches,
    externalGroundTruthLabels,
    groundTruthCases,
    modelRuns,
    aiPredictions,
    auditLogs,
  ] = await prisma.$transaction([
    prisma.department.findMany({ orderBy: { code: "asc" } }),
    prisma.user.findMany({ orderBy: { employeeId: "asc" } }),
    prisma.userActivityPermission.findMany({ orderBy: { grantedAt: "asc" } }),
    prisma.activity.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.activityPolicy.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.activityRoleAssignment.findMany({ orderBy: { assignedAt: "asc" } }),
    prisma.activityParticipant.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.guestParticipant.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.attendanceRecord.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.staffVerification.findMany({ orderBy: { verifiedAt: "asc" } }),
    prisma.consistencyResult.findMany({ orderBy: { evaluatedAt: "asc" } }),
    prisma.humanReview.findMany({ orderBy: { reviewedAt: "asc" } }),
    prisma.groundTruthLabel.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.blindReviewBatch.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.externalGroundTruthLabel.findMany({
      where:{ invite:{ batch:{ status:"COMPLETED" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.groundTruthCase.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.modelRun.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.aIPrediction.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const payload = {
    departments,
    users,
    userActivityPermissions,
    activities,
    activityPolicies,
    activityRoleAssignments,
    activityParticipants,
    guestParticipants: guestParticipants.map(({passTokenHash,...rest})=>rest),
    attendanceRecords,
    staffVerifications,
    consistencyResults,
    humanReviews,
    groundTruthLabels,
    blindReviewBatches,
    externalGroundTruthLabels,
    groundTruthCases,
    modelRuns,
    aiPredictions,
    auditLogs,
  };
  const serialized = JSON.stringify(payload);
  const checksum = crypto.createHash("sha256").update(serialized).digest("hex");
  const counts = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])
  );

  return {
    format: BACKUP_FORMAT,
    releaseVersion: RELEASE_VERSION,
    generatedAt: new Date().toISOString(),
    containsPII: true,
    containsSecrets: false,
    excludedEphemeralSecurityData: ["QrToken", "PersonalQrCredential", "BlindReviewInvite", "GuestParticipant.passTokenHash"],
    checksumAlgorithm: "SHA-256",
    checksum,
    counts,
    payload,
  };
}

function validateOperationalBackup(backup) {
  if (!backup || backup.format !== BACKUP_FORMAT || !backup.payload || !backup.checksum) {
    return { valid: false, error: "INVALID_BACKUP_FORMAT" };
  }
  const requiredCollections = [
    "departments","users","activities","attendanceRecords","humanReviews",
    "consistencyResults","groundTruthCases","modelRuns","aiPredictions","auditLogs"
  ];
  const missingCollections = requiredCollections.filter((key) => !Array.isArray(backup.payload[key]));
  if (missingCollections.length) {
    return { valid: false, error: "BACKUP_COLLECTIONS_MISSING", missingCollections };
  }
  const checksum = crypto
    .createHash("sha256")
    .update(JSON.stringify(backup.payload))
    .digest("hex");
  if (checksum !== backup.checksum) {
    return { valid: false, error: "BACKUP_CHECKSUM_MISMATCH", expected: backup.checksum, actual: checksum };
  }
  const countMismatches = Object.entries(backup.counts || {}).filter(([key, expected]) =>
    Array.isArray(backup.payload[key]) && backup.payload[key].length !== Number(expected)
  );
  if (countMismatches.length) {
    return { valid: false, error: "BACKUP_COUNT_MISMATCH", countMismatches };
  }
  return {
    valid: true,
    checksum,
    releaseVersion: backup.releaseVersion || null,
    currentReleaseVersionMatch: backup.releaseVersion === RELEASE_VERSION,
    containsPII: Boolean(backup.containsPII),
    containsSecrets: Boolean(backup.containsSecrets),
  };
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
// Stable anonymous grouping across events when a study uses the same
// offline subject code. Never export that code or the internal study HMAC.
function participantResearchHash(r) {
  if (r.guestParticipantId) {
    if (!r.guestParticipant?.studyHash) throw new Error("GUEST_RESEARCH_STUDY_HASH_MISSING");
    return hashParticipant("GUEST|"+r.guestParticipant.studyHash);
  }
  if(!r.userId)throw new Error("ATTENDANCE_OWNER_MISSING");
  return hashParticipant(r.userId);
}
function participantGroupingKey(r) {
  if(r.guestParticipantId) {
    if(!r.guestParticipant?.studyHash)throw new Error("GUEST_RESEARCH_STUDY_HASH_MISSING");
    return "GUEST|"+r.guestParticipant.studyHash;
  }
  return "USER|"+r.userId;
}

function inferenceFeatureRow(r) {
  const a = r.activity;
  const scheduledMinutes = Math.max(
    1,
    Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60000)
  );
  const actualMinutes =
    r.checkinAt && r.checkoutAt
      ? Math.max(0, Math.round((r.checkoutAt.getTime() - r.checkinAt.getTime()) / 60000))
      : null;
  const durationRatio =
    actualMinutes === null ? null : Math.min(1, actualMinutes / scheduledMinutes);
  const checkinOffsetMinutes = r.checkinAt
    ? Math.round((r.checkinAt.getTime() - a.startAt.getTime()) / 60000)
    : null;
  const checkoutOffsetMinutes = r.checkoutAt
    ? Math.round((r.checkoutAt.getTime() - a.endAt.getTime()) / 60000)
    : null;

  return {
    record_id: r.id,
    participant_hash: participantResearchHash(r),
    event_id: r.activityId,
    activity_type: a.category,
    qr_valid: Number(r.qrValid),
    identity_verified: Number(r.identityVerified),
    checkin_present: Number(Boolean(r.checkinAt)),
    checkout_present: Number(Boolean(r.checkoutAt)),
    checkout_qr_valid: Number(Boolean(r.checkoutQrValid)),
    checkout_method: r.checkoutMethod || null,
    scheduled_duration_minutes: scheduledMinutes,
    actual_duration_minutes: actualMinutes,
    duration_ratio: durationRatio,
    checkin_offset_minutes: checkinOffsetMinutes,
    checkout_offset_minutes: checkoutOffsetMinutes,
    staff_verified: Number(Boolean(r.staffVerification)),
    signature_verified: Number(r.signatureVerified),
    scan_attempts: r.scanAttempts,
  };
}

app.get("/api/live", (_req, res) => {
  res.json({
    ok: true,
    service: "ACTIVA-AI",
    releaseVersion: RELEASE_VERSION,
    sourceCommit: deployedSourceCommit(),
    deploymentTier: deploymentTier(),
  });
});

app.get("/api/ready", async (_req, res) => {
  try {
    const configErrors = process.env.NODE_ENV === "production" ? deploymentConfigurationErrors() : [];
    if (configErrors.length) {
      return res.status(503).json({
        ok: false,
        ready: false,
        releaseVersion: RELEASE_VERSION,
        deploymentTier: deploymentTier(),
        error: "UNSAFE_DEPLOYMENT_CONFIGURATION",
        blockers: configErrors,
      });
    }
    await prisma.$queryRawUnsafe("SELECT 1");
    if (!productionAuthenticationReady()) {
      return res.status(503).json({
        ok: false,
        ready: false,
        releaseVersion: RELEASE_VERSION,
        deploymentTier: deploymentTier(),
        database: "connected",
        error: "AUTHENTICATION_NOT_READY",
      });
    }
    res.json({
      ok: true,
      ready: true,
      releaseVersion: RELEASE_VERSION,
      sourceCommit: deployedSourceCommit(),
      deploymentTier: deploymentTier(),
      database: "connected",
      authenticationReady: true,
    });
  } catch (error) {
    console.error("Readiness check failed:", error?.name || "Error");
    res.status(503).json({
      ok: false,
      ready: false,
      releaseVersion: RELEASE_VERSION,
      deploymentTier: deploymentTier(),
      database: "unavailable",
      error: "DATABASE_UNAVAILABLE",
    });
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    const deployedModel = await prisma.modelRun.findFirst({
      where: { status: "DEPLOYED" },
      orderBy: { deployedAt: "desc" },
      select: { version: true },
    });
    res.json({
      ok: true,
      version: "1.0.15",
      releaseVersion: RELEASE_VERSION,
      sourceCommit: deployedSourceCommit(),
      database: "connected",
      ai: deployedModel ? "decision-support-active" : "no-deployed-model",
      deployedModelVersion: deployedModel?.version || null,
      autonomousDecision: false,
      deploymentTier: deploymentTier(),
      productionGoEnabled: productionGoEnabled(),
      authentication: {
        mode: authenticationMode(),
        productionReady: productionAuthenticationReady(),
        configurationReady: productionAuthenticationReady(),
        provider: authenticationMode()==="GOOGLE_OIDC" ? "GOOGLE" : null,
        googleClientId: authenticationMode()==="GOOGLE_OIDC" ? googleClientId() : null,
        googlePilotClientId: authenticationMode()==="GOOGLE_OIDC" ? (googlePilotClientId() || null) : null,
        pilotEmailReady: authenticationMode()==="GOOGLE_OIDC" ? googlePilotEmailReady() : false,
        allowedDomains: authenticationMode()==="GOOGLE_OIDC" ? googleAllowedDomains() : [],
        allowedEmailCount: authenticationMode()==="GOOGLE_OIDC" ? googleAllowedEmails().length : 0,
      },
    });
  } catch (error) {
    console.error("Database health check failed:", error?.name || "Error");
    res.status(503).json({ ok: false, version: "1.0.15",
      releaseVersion: RELEASE_VERSION, deploymentTier: deploymentTier(), database: "unavailable", error: "DATABASE_UNAVAILABLE" });
  }
});



const BLIND_REVIEW_REASON_CODES = new Set([
  "MISSING_QR",
  "MISSING_IDENTITY",
  "MISSING_CHECKOUT",
  "MISSING_STAFF_VERIFICATION",
  "SHORT_DURATION",
  "DUPLICATE_SCAN",
  "TEMPORAL_CONFLICT",
  "STAFF_WITHOUT_CHECKIN",
  "OTHER",
]);

function blindReviewTokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function blindReviewTokenFromRequest(req) {
  const auth = String(req.get("authorization") || "").trim();
  const match = auth.match(/^BlindReview\s+([A-Za-z0-9_-]{32,256})$/);
  return match ? match[1] : "";
}

function blindReviewEvidence(attendance) {
  const activity = attendance.activity;
  const scheduledMinutes = Math.max(
    1,
    Math.round((activity.endAt.getTime() - activity.startAt.getTime()) / 60000)
  );
  const actualMinutes = attendance.checkinAt && attendance.checkoutAt
    ? Math.max(0, Math.round((attendance.checkoutAt.getTime() - attendance.checkinAt.getTime()) / 60000))
    : null;
  return {
    activity: {
      title: activity.title,
      category: activity.category,
      startAt: activity.startAt,
      endAt: activity.endAt,
    },
    evidence: {
      qrValid: Boolean(attendance.qrValid),
      identityVerified: Boolean(attendance.identityVerified),
      checkinPresent: Boolean(attendance.checkinAt),
      checkoutPresent: Boolean(attendance.checkoutAt),
      checkinAt: attendance.checkinAt,
      checkoutAt: attendance.checkoutAt,
      checkoutQrValid: Boolean(attendance.checkoutQrValid),
      scheduledDurationMinutes: scheduledMinutes,
      actualDurationMinutes: actualMinutes,
      staffVerified: Boolean(attendance.staffVerification),
      signatureVerified: Boolean(attendance.signatureVerified),
      scanAttempts: attendance.scanAttempts,
    },
  };
}

async function resolveBlindReviewInvite(req) {
  const token = blindReviewTokenFromRequest(req);
  if (!token) return { error: "BLIND_REVIEW_TOKEN_REQUIRED", status: 401 };

  const invite = await prisma.blindReviewInvite.findUnique({
    where: { tokenHash: blindReviewTokenHash(token) },
    include: {
      batch: {
        include: {
          attendance: {
            include: {
              activity: true,
              staffVerification: true,
              groundTruthCase: true,
            },
          },
        },
      },
    },
  });

  if (!invite) return { error: "BLIND_REVIEW_LINK_INVALID", status: 404 };
  const now = new Date();
  if (invite.revokedAt || invite.batch.revokedAt || invite.batch.status === "REVOKED") {
    return { error: "BLIND_REVIEW_LINK_REVOKED", status: 410 };
  }
  if (invite.expiresAt <= now || invite.batch.expiresAt <= now) {
    return { error: "BLIND_REVIEW_LINK_EXPIRED", status: 410 };
  }
  if (invite.submittedAt) {
    return { error: "BLIND_REVIEW_ALREADY_SUBMITTED", status: 409 };
  }
  if (invite.batch.status !== "OPEN") {
    return { error: "BLIND_REVIEW_BATCH_NOT_OPEN", status: 409 };
  }
  if (invite.batch.attendance?.isVoided) {
    return { error: "BLIND_REVIEW_CASE_UNAVAILABLE", status: 410 };
  }
  if (invite.batch.attendance?.groundTruthCase?.status === "LOCKED") {
    return { error: "GROUND_TRUTH_ALREADY_LOCKED", status: 409 };
  }
  return { invite, token };
}

// Public blind-review endpoints intentionally bypass organization login.
// The high-entropy one-time token is carried only in the Authorization header;
// access logs record path/status only and never record the token.
app.get("/api/public/blind-review/session", async (req, res, next) => {
  try {
    const resolved = await resolveBlindReviewInvite(req);
    if (resolved.error) return res.status(resolved.status).json({ ok:false, error:resolved.error });

    const { invite } = resolved;
    const attendance = invite.batch.attendance;
    res.json({
      ok: true,
      blind: true,
      oneTime: true,
      containsDirectPII: false,
      aiPredictionIncluded: false,
      ruleConsistencyIncluded: false,
      peerLabelsIncluded: false,
      reviewerSlot: invite.reviewerSlot,
      expiresAt: invite.expiresAt,
      caseRef: attendance.id.slice(-8),
      ...blindReviewEvidence(attendance),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/public/blind-review/submit", async (req, res, next) => {
  try {
    const resolved = await resolveBlindReviewInvite(req);
    if (resolved.error) return res.status(resolved.status).json({ ok:false, error:resolved.error });

    const { invite } = resolved;
    const body = req.body || {};
    if (!["REVIEW_REQUIRED","NO_REVIEW_REQUIRED"].includes(body.target)) {
      return res.status(400).json({ ok:false, error:"INVALID_TARGET" });
    }
    if (body.independenceAttested !== true) {
      return res.status(400).json({ ok:false, error:"INDEPENDENCE_ATTESTATION_REQUIRED" });
    }
    const reasonCodes = Array.isArray(body.reasonCodes)
      ? [...new Set(body.reasonCodes.map(String))]
      : [];
    const invalidCodes = reasonCodes.filter((code) => !BLIND_REVIEW_REASON_CODES.has(code));
    if (invalidCodes.length) {
      return res.status(400).json({ ok:false, error:"INVALID_REASON_CODES", invalidCodes });
    }
    const notes = String(body.notes || "").trim();
    if (body.target === "REVIEW_REQUIRED" && reasonCodes.length === 0) {
      return res.status(400).json({ ok:false, error:"REVIEW_REASON_REQUIRED" });
    }
    if (reasonCodes.includes("OTHER") && notes.length < 3) {
      return res.status(400).json({ ok:false, error:"OTHER_REASON_REQUIRES_NOTES" });
    }
    if (notes.length > 2000) {
      return res.status(400).json({ ok:false, error:"NOTES_TOO_LONG" });
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.blindReviewInvite.findUnique({
        where: { id: invite.id },
        include: {
          batch: {
            include: {
              attendance: { include: { groundTruthCase: true } },
            },
          },
        },
      });
      if (!current || current.revokedAt || current.batch.revokedAt || current.batch.status !== "OPEN") {
        throw Object.assign(new Error("BLIND_REVIEW_LINK_NO_LONGER_ACTIVE"), { status:409 });
      }
      if (current.submittedAt) {
        throw Object.assign(new Error("BLIND_REVIEW_ALREADY_SUBMITTED"), { status:409 });
      }
      if (current.expiresAt <= now || current.batch.expiresAt <= now) {
        throw Object.assign(new Error("BLIND_REVIEW_LINK_EXPIRED"), { status:410 });
      }
      if (current.batch.attendance?.groundTruthCase?.status === "LOCKED") {
        throw Object.assign(new Error("GROUND_TRUTH_ALREADY_LOCKED"), { status:409 });
      }

      await tx.externalGroundTruthLabel.create({
        data: {
          attendanceId: current.batch.attendanceId,
          inviteId: current.id,
          reviewerSlot: current.reviewerSlot,
          target: body.target,
          reasonCodes,
          notes: notes || null,
        },
      });
      await tx.blindReviewInvite.update({
        where: { id: current.id },
        data: { submittedAt: now, independenceAttested: true },
      });

      const submittedCount = await tx.blindReviewInvite.count({
        where: { batchId: current.batchId, submittedAt: { not: null }, revokedAt: null },
      });
      if (submittedCount >= 2) {
        await tx.blindReviewBatch.update({
          where: { id: current.batchId },
          data: { status: "COMPLETED" },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: null,
          action: "EXTERNAL_BLIND_REVIEW_SUBMITTED",
          entityType: "AttendanceRecord",
          entityId: current.batch.attendanceId,
          metadata: {
            batchId: current.batchId,
            reviewerSlot: current.reviewerSlot,
            target: body.target,
            independenceAttested: true,
          },
        },
      });

      return { submittedCount, batchId: current.batchId };
    });

    res.status(201).json({
      ok: true,
      submitted: true,
      immutable: true,
      reviewerSlot: invite.reviewerSlot,
      batchComplete: result.submittedCount >= 2,
      note: "Blind review submitted. The one-time link can no longer be used.",
    });
  } catch (error) {
    if (Number(error?.status)) {
      return res.status(Number(error.status)).json({ ok:false, error:String(error.message || "BLIND_REVIEW_SUBMIT_FAILED") });
    }
    next(error);
  }
});

registerGuestPublicRoutes(app,{prisma,verifyEventToken,checkinWindowState,checkoutWindowState});

app.use("/api", attachActor);
registerGuestAdminRoutes(app,{prisma,requireRoles,audit});

app.get("/api/me", async (req, res) => {
  const activityPermissions = req.activaUser.role === "ADMIN"
    ? [...ACTIVITY_PERMISSION_KEYS]
    : await effectiveActivityPermissionKeys(req.activaUser.id);
  const activityAssignments = await prisma.activityRoleAssignment.findMany({
    where: { userId: req.activaUser.id },
    select: { activityId:true, role:true },
    orderBy: { assignedAt:"desc" },
  });

  res.json({
    ok: true,
    user: {
      id: req.activaUser.id,
      employeeId: req.activaUser.employeeId,
      name: req.activaUser.name,
      positionTitle: req.activaUser.positionTitle || null,
      role: req.activaUser.role,
      status: req.activaUser.status,
      activityPermissions,
      activityAssignments,
    },
  });
});

app.get("/api/personal-qr/me", async (req, res) => {
  let credential = await prisma.personalQrCredential.findFirst({
    where:{userId:req.activaUser.id,revokedAt:null},
    orderBy:{issuedAt:"desc"},
  });
  if(!credential){
    credential=await prisma.personalQrCredential.create({data:{userId:req.activaUser.id}});
    await audit(req,"PERSONAL_QR_ISSUED","User",req.activaUser.id,{credentialId:credential.id});
  }
  const issued=createPersonalToken(credential.id);
  res.json({
    ok:true,
    token:issued.token,
    credentialId:credential.id,
    issuedAt:credential.issuedAt,
    reusableAcrossActivities:true,
    containsDirectPII:false,
  });
});

app.post("/api/personal-qr/reissue", async (req,res)=>{
  await prisma.personalQrCredential.updateMany({
    where:{userId:req.activaUser.id,revokedAt:null},
    data:{revokedAt:new Date()},
  });
  const credential=await prisma.personalQrCredential.create({data:{userId:req.activaUser.id}});
  const issued=createPersonalToken(credential.id);
  await audit(req,"PERSONAL_QR_REISSUED","User",req.activaUser.id,{credentialId:credential.id});
  res.status(201).json({
    ok:true,token:issued.token,credentialId:credential.id,issuedAt:credential.issuedAt,
    reusableAcrossActivities:true,containsDirectPII:false,
  });
});

app.post("/api/personal-qr/resolve", requireRoles("ADMIN","STAFF"), async (req,res)=>{
  const verified=verifyPersonalToken(req.body?.token);
  if(!verified.ok) return res.status(400).json({ok:false,error:verified.reason});

  const credential=await prisma.personalQrCredential.findUnique({
    where:{id:verified.payload.credentialId},
    include:{user:{select:{id:true,employeeId:true,name:true,status:true,role:true}}},
  });
  if(!credential || credential.revokedAt){
    return res.status(410).json({ok:false,error:"PERSONAL_QR_REVOKED_OR_UNKNOWN"});
  }
  if(credential.user.status!=="ACTIVE"){
    return res.status(409).json({ok:false,error:"PERSONAL_QR_USER_INACTIVE"});
  }

  const activityId=String(req.body?.activityId||"").trim()||null;
  const rows=await prisma.attendanceRecord.findMany({
    where:{
      userId:credential.userId,
      isVoided:false,
      ...(activityId?{activityId}:{}),
    },
    include:{
      user:{select:{id:true,employeeId:true,name:true}},
      activity:{select:{id:true,title:true,category:true,startAt:true,endAt:true,policy:true}},
      staffVerification:true,
      consistencyResult:true,
      humanReviews:{orderBy:{reviewedAt:"desc"},take:1},
    },
    orderBy:{createdAt:"desc"},
  });

  await audit(req,"PERSONAL_QR_RESOLVED","User",credential.userId,{
    activityId,attendanceMatches:rows.length,
  });
  res.json({ok:true,user:credential.user,attendance:rows});
});

app.get("/api/users", personnelDirectoryGuard, async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      employeeId: true,
      name: true,
      email: true,
      positionTitle: true,
      role: true,
      status: true,
      department: { select: { code: true, name: true } },
      activityPermissions: {
        select: {
          id: true,
          permission: true,
          grantedAt: true,
          validFrom: true,
          validUntil: true,
          reason: true,
          revokedAt: true,
          revokedById: true,
          revokeReason: true,
        },
        orderBy: { permission: "asc" },
      },
    },
    orderBy: { employeeId: "asc" },
  });
  res.json({ ok: true, users });
});

function normalizeRole(value, allowAdmin = true) {
  const role=String(value||"PARTICIPANT").trim().toUpperCase();
  const allowed=allowAdmin
    ? ["ADMIN","ORGANIZER","STAFF","PARTICIPANT"]
    : ["ORGANIZER","STAFF","PARTICIPANT"];
  return allowed.includes(role)?role:null;
}

async function resolveDepartmentByName(name) {
  const departmentName=String(name||"").trim();
  if(!departmentName) return null;
  const code="DEPT-"+crypto.createHash("sha1").update(departmentName.toLowerCase()).digest("hex").slice(0,10).toUpperCase();
  return prisma.department.upsert({
    where:{code},
    create:{code,name:departmentName},
    update:{name:departmentName},
  });
}

app.post("/api/users", requireRoles("ADMIN"), async (req,res)=>{
  const b=req.body||{};
  const employeeId=String(b.employeeId||"").trim().toUpperCase();
  const name=String(b.name||"").trim();
  const email=String(b.email||"").trim()||null;
  const positionTitle=String(b.positionTitle||"").trim()||null;
  const role=normalizeRole(b.role,true);
  if(!employeeId||!name) return res.status(400).json({ok:false,error:"EMPLOYEE_ID_AND_NAME_REQUIRED"});
  if(!role) return res.status(400).json({ok:false,error:"INVALID_ROLE"});

  const existing=await prisma.user.findUnique({where:{employeeId}});
  if(existing) return res.status(409).json({ok:false,error:"EMPLOYEE_ID_ALREADY_EXISTS"});
  if(email){
    const sameEmail=await prisma.user.findUnique({where:{email}});
    if(sameEmail) return res.status(409).json({ok:false,error:"EMAIL_ALREADY_EXISTS"});
  }

  const department=await resolveDepartmentByName(b.department);
  const user=await prisma.user.create({
    data:{employeeId,name,email,positionTitle,role,status:"ACTIVE",departmentId:department?.id||null},
    include:{department:{select:{code:true,name:true}}},
  });
  await audit(req,"USER_CREATED","User",user.id,{employeeId,positionTitle,role,department:department?.name||null});
  res.status(201).json({ok:true,user});
});

app.patch("/api/users/:userId", requireRoles("ADMIN"), async (req,res)=>{
  const current=await prisma.user.findUnique({where:{id:req.params.userId}});
  if(!current) return res.status(404).json({ok:false,error:"USER_NOT_FOUND"});
  const b=req.body||{};
  const name=String(b.name||current.name).trim();
  const email=String(b.email||"").trim()||null;
  const positionTitle=Object.prototype.hasOwnProperty.call(b,"positionTitle")
    ? (String(b.positionTitle||"").trim()||null)
    : current.positionTitle;
  const role=normalizeRole(b.role||current.role,true);
  if(!name) return res.status(400).json({ok:false,error:"NAME_REQUIRED"});
  if(!role) return res.status(400).json({ok:false,error:"INVALID_ROLE"});
  if(email){
    const sameEmail=await prisma.user.findUnique({where:{email}});
    if(sameEmail && sameEmail.id!==current.id) return res.status(409).json({ok:false,error:"EMAIL_ALREADY_EXISTS"});
  }
  const department=await resolveDepartmentByName(b.department);
  const user=await prisma.user.update({
    where:{id:current.id},
    data:{name,email,positionTitle,role,departmentId:department?.id||null},
    include:{department:{select:{code:true,name:true}}},
  });
  await audit(req,"USER_UPDATED","User",user.id,{employeeId:user.employeeId,positionTitle,role,department:department?.name||null});
  res.json({ok:true,user});
});

app.patch("/api/users/:userId/status", requireRoles("ADMIN"), async (req,res)=>{
  const current=await prisma.user.findUnique({where:{id:req.params.userId}});
  if(!current) return res.status(404).json({ok:false,error:"USER_NOT_FOUND"});
  const status=String(req.body?.status||"").toUpperCase();
  if(!["ACTIVE","INACTIVE"].includes(status)) return res.status(400).json({ok:false,error:"INVALID_USER_STATUS"});
  if(current.id===req.activaUser.id && status==="INACTIVE"){
    return res.status(409).json({ok:false,error:"CANNOT_DEACTIVATE_SELF"});
  }
  const user=await prisma.user.update({
    where:{id:current.id},data:{status},
    include:{department:{select:{code:true,name:true}}},
  });
  await audit(req,"USER_STATUS_CHANGED","User",user.id,{employeeId:user.employeeId,status});
  res.json({ok:true,user});
});

app.patch("/api/users/:userId/activity-permissions", requireRoles("ADMIN"), async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

  const requested = Array.isArray(req.body?.permissions)
    ? [...new Set(req.body.permissions.map(String))]
    : [];
  const invalid = requested.filter((x) => !ACTIVITY_PERMISSION_KEYS.includes(x));
  if (invalid.length) {
    return res.status(400).json({ ok: false, error: "INVALID_ACTIVITY_PERMISSION", invalid });
  }

  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 3) {
    return res.status(400).json({ ok: false, error: "PERMISSION_REASON_REQUIRED" });
  }

  const validFrom = req.body?.validFrom ? toIso(req.body.validFrom) : null;
  const validUntil = req.body?.validUntil ? toIso(req.body.validUntil) : null;
  if (validFrom && validUntil && validUntil < validFrom) {
    return res.status(400).json({ ok: false, error: "INVALID_PERMISSION_DATE_RANGE" });
  }

  const existing = await prisma.userActivityPermission.findMany({
    where: { userId: target.id },
  });
  const byKey = new Map(existing.map((x) => [x.permission, x]));
  const now = new Date();
  const granted = [];
  const revoked = [];
  const updated = [];

  for (const key of ACTIVITY_PERMISSION_KEYS) {
    const current = byKey.get(key);
    const want = requested.includes(key);

    if (want) {
      if (!current) {
        await prisma.userActivityPermission.create({
          data: {
            userId: target.id,
            permission: key,
            grantedById: req.activaUser.id,
            grantedAt: now,
            validFrom,
            validUntil,
            reason,
          },
        });
        granted.push(key);
        await audit(req, "ACTIVITY_PERMISSION_GRANTED", "User", target.id, {
          employeeId: target.employeeId,
          permission: key,
          validFrom: validFrom?.toISOString() || null,
          validUntil: validUntil?.toISOString() || null,
          reason,
        });
      } else {
        const wasRevoked = Boolean(current.revokedAt);
        await prisma.userActivityPermission.update({
          where: { id: current.id },
          data: {
            grantedById: req.activaUser.id,
            grantedAt: wasRevoked ? now : current.grantedAt,
            validFrom,
            validUntil,
            reason,
            revokedAt: null,
            revokedById: null,
            revokeReason: null,
          },
        });
        (wasRevoked ? granted : updated).push(key);
        await audit(req, wasRevoked ? "ACTIVITY_PERMISSION_GRANTED" : "ACTIVITY_PERMISSION_UPDATED", "User", target.id, {
          employeeId: target.employeeId,
          permission: key,
          validFrom: validFrom?.toISOString() || null,
          validUntil: validUntil?.toISOString() || null,
          reason,
        });
      }
    } else if (current && !current.revokedAt) {
      await prisma.userActivityPermission.update({
        where: { id: current.id },
        data: {
          revokedAt: now,
          revokedById: req.activaUser.id,
          revokeReason: reason,
        },
      });
      revoked.push(key);
      await audit(req, "ACTIVITY_PERMISSION_REVOKED", "User", target.id, {
        employeeId: target.employeeId,
        permission: key,
        reason,
      });
    }
  }

  const activityPermissions = await prisma.userActivityPermission.findMany({
    where: { userId: target.id },
    orderBy: { permission: "asc" },
  });

  res.json({
    ok: true,
    employeeId: target.employeeId,
    activityPermissions,
    changes: { granted, updated, revoked },
  });
});

app.post("/api/users/import", requireRoles("ADMIN"), async (req,res)=>{
  const rows=Array.isArray(req.body?.users)?req.body.users:[];
  if(!rows.length) return res.status(400).json({ok:false,error:"USERS_REQUIRED"});
  if(rows.length>2000) return res.status(413).json({ok:false,error:"USER_IMPORT_TOO_LARGE",max:2000});

  let createdCount=0,skippedCount=0,errorCount=0;
  const errors=[];
  for(const raw of rows){
    try{
      const employeeId=String(raw.employeeId||"").trim().toUpperCase();
      const name=String(raw.name||"").trim();
      const email=String(raw.email||"").trim()||null;
      const positionTitle=String(raw.positionTitle||"").trim()||null;
      const role=normalizeRole(raw.role,false);
      if(!employeeId||!name||!role){errorCount++;errors.push({employeeId,error:"INVALID_ROW"});continue;}
      const exists=await prisma.user.findUnique({where:{employeeId}});
      if(exists){skippedCount++;continue;}
      if(email){
        const sameEmail=await prisma.user.findUnique({where:{email}});
        if(sameEmail){errorCount++;errors.push({employeeId,error:"EMAIL_ALREADY_EXISTS"});continue;}
      }
      const department=await resolveDepartmentByName(raw.department);
      await prisma.user.create({
        data:{employeeId,name,email,positionTitle,role,status:"ACTIVE",departmentId:department?.id||null},
      });
      createdCount++;
    }catch(error){
      errorCount++;errors.push({employeeId:String(raw.employeeId||""),error:String(error.message||error)});
    }
  }
  await audit(req,"USER_IMPORT","User","BATCH",{createdCount,skippedCount,errorCount});
  res.json({ok:true,createdCount,skippedCount,errorCount,errors:errors.slice(0,50)});
});


app.get("/api/dashboard/summary", async (req, res) => {
  const isParticipant = req.activaUser.role === "PARTICIPANT";
  const attendanceWhere = isParticipant
    ? { userId: req.activaUser.id, isVoided: false }
    : { isVoided: false };
  const consistencyWhere = isParticipant
    ? { attendance: { userId: req.activaUser.id, isVoided: false } }
    : { attendance: { isVoided: false } };

  const [activityCount, recordCount, verifiedCount, overrideVerifiedCount, reviewCount, incompleteCount] = await Promise.all([
    prisma.activity.count(),
    prisma.attendanceRecord.count({ where: attendanceWhere }),
    prisma.attendanceRecord.count({
      where: { ...attendanceWhere, finalEvidenceStatus: { in: ["VERIFIED", "OVERRIDE_VERIFIED"] } },
    }),
    prisma.attendanceRecord.count({
      where: { ...attendanceWhere, finalEvidenceStatus: "OVERRIDE_VERIFIED" },
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
      overrideVerifiedCount,
      reviewRequiredCount: reviewCount,
      incompleteCount,
    },
  });
});

app.get("/api/attendance", async (req, res) => {
  const filters = [];
  const includeVoided =
    String(req.query.includeVoided || "false") === "true" &&
    ["ADMIN", "STAFF"].includes(req.activaUser.role);
  if (!includeVoided) filters.push({ isVoided: false });
  if (req.query.activityId) filters.push({ activityId: String(req.query.activityId) });
  if (req.activaUser.role === "PARTICIPANT") {
    filters.push({ userId: req.activaUser.id });
  }
  const where = filters.length === 0 ? {} : { AND: filters };

  const rows = await prisma.attendanceRecord.findMany({
    where,
    include: {
      user: { select: { id: true, employeeId: true, name: true } },
      guestParticipant:{select:{id:true,consentAt:true,withdrawnAt:true,revokedAt:true}},
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
      humanReviews: {
        orderBy: { reviewedAt: "desc" },
        take: 1,
        include: { reviewer: { select: { id: true, employeeId: true, name: true } } },
      },
      participantResponses: { orderBy: { submittedAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ ok: true, attendance: rows.map((row)=>({
    ...row,
    participantResponse: row.participantResponses?.[0] || null,
    participantResponses: undefined,
  })) });
});

app.get("/api/activities", async (_req, res) => {
  const rows = await prisma.activity.findMany({
    include: {
      policy: true,
      organizer: { select: { id: true, employeeId: true, name: true } },
      roleAssignments: {
        include: { user: { select: { id:true, employeeId:true, name:true } } },
        orderBy: { assignedAt:"asc" },
      },
      _count: { select: { participants:true } },
    },
    orderBy: { startAt: "desc" },
  });
  res.json({ ok: true, activities: rows });
});

app.post("/api/activities", requireActivityPermission("CAN_CREATE_ACTIVITY"), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title || !b.category || !b.location || !b.startAt || !b.endAt) {
      return res.status(400).json({ ok: false, error: "MISSING_REQUIRED_FIELDS" });
    }

    let primaryOrganizer = req.activaUser;
    if (req.activaUser.role === "ADMIN" && b.primaryOrganizerId) {
      const selected = await resolveUserRef(b.primaryOrganizerId);
      if (!selected || selected.status !== "ACTIVE") {
        return res.status(400).json({ ok: false, error: "PRIMARY_ORGANIZER_NOT_FOUND_OR_INACTIVE" });
      }
      if (!(await userHasActivityPermission(selected, "CAN_CREATE_ACTIVITY")) && selected.role !== "ADMIN") {
        return res.status(409).json({ ok: false, error: "PRIMARY_ORGANIZER_LACKS_CREATE_PERMISSION" });
      }
      primaryOrganizer = selected;
    }

    const startAt = toIso(b.startAt);
    const endAt = toIso(b.endAt);
    if (endAt <= startAt) {
      return res.status(400).json({ ok:false, error:"INVALID_ACTIVITY_TIME_RANGE" });
    }
    const provenance = classificationForNewActivity(b, req.activaUser.role, startAt);
    if (provenance.error) {
      return res.status(409).json({ ok:false, error:provenance.error });
    }
    // New empirical activities require the separately enabled Phase 4 study gate.
    // The ADMIN provenance checkbox by itself is not institutional authorization.
    if (provenance.value === "EMPIRICAL" && !empiricalCollectionGate().enabled) {
      return res.status(409).json({ ok:false, error:"EMPIRICAL_COLLECTION_GATE_HOLD" });
    }

    const checkinOpenAt = b.checkinOpenAt ? toIso(b.checkinOpenAt) : new Date(startAt.getTime() - 30 * 60000);
    const checkinCloseAt = b.checkinCloseAt ? toIso(b.checkinCloseAt) : new Date(startAt.getTime() + 30 * 60000);
    const checkoutOpenAt = b.checkoutOpenAt ? toIso(b.checkoutOpenAt) : new Date(endAt.getTime() - 30 * 60000);
    const checkoutCloseAt = b.checkoutCloseAt ? toIso(b.checkoutCloseAt) : new Date(endAt.getTime() + 30 * 60000);

    if (checkinOpenAt >= checkinCloseAt) {
      return res.status(400).json({ ok:false, error:"INVALID_CHECKIN_WINDOW" });
    }
    if (checkoutOpenAt >= checkoutCloseAt) {
      return res.status(400).json({ ok:false, error:"INVALID_CHECKOUT_WINDOW" });
    }
    if (checkinCloseAt > endAt) {
      return res.status(400).json({ ok:false, error:"CHECKIN_WINDOW_AFTER_ACTIVITY_END" });
    }
    if (checkoutOpenAt < startAt) {
      return res.status(400).json({ ok:false, error:"CHECKOUT_WINDOW_BEFORE_ACTIVITY_START" });
    }

    // Idempotency guard for the activity-creation UI: an accidental second tap
    // with the same organizer, title, location and exact time range must not
    // create a second event with a different activity ID.
    const duplicateActivity = await prisma.activity.findFirst({
      where: {
        organizerId: primaryOrganizer.id,
        title: { equals: String(b.title).trim(), mode: "insensitive" },
        location: String(b.location).trim(),
        startAt,
        endAt,
      },
      select: { id:true, title:true, createdAt:true },
    });
    if (duplicateActivity) {
      return res.status(409).json({
        ok:false,
        error:"ACTIVITY_DUPLICATE",
        existingActivityId:duplicateActivity.id,
        existingCreatedAt:duplicateActivity.createdAt,
      });
    }

    const activity = await prisma.activity.create({
      data: {
        title: b.title,
        category: b.category,
        dataClassification: provenance.value,
        classifiedAt: provenance.classifiedAt,
        description: b.description || null,
        location: b.location,
        startAt,
        endAt,
        checkinOpenAt,
        checkinCloseAt,
        checkoutOpenAt,
        checkoutCloseAt,
        organizerId: primaryOrganizer.id,
        participationMode: "OPEN",
        allowedDepartmentCodes: [],
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
      include: {
        policy: true,
        organizer: { select: { id: true, employeeId: true, name: true } },
      },
    });

    await audit(req, "ACTIVITY_CREATED", "Activity", activity.id, {
      title: activity.title,
      primaryOrganizerId: primaryOrganizer.id,
      primaryOrganizerEmployeeId: primaryOrganizer.employeeId,
      dataClassification: provenance.value,
      empiricalAttestation: provenance.value === "EMPIRICAL",
    });
    res.status(201).json({ ok: true, activity });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.patch("/api/activities/:activityId", async (req, res) => {
  try {
    const activity = await prisma.activity.findUnique({
      where:{id:req.params.activityId},
      include:{policy:true},
    });
    if (!activity) return res.status(404).json({ok:false,error:"ACTIVITY_NOT_FOUND"});
    if (!(await canManageActivity(req, activity))) {
      return res.status(403).json({ok:false,error:"ACTIVITY_MANAGEMENT_FORBIDDEN"});
    }
    if (activity.pilotClosedAt) {
      return res.status(423).json({ok:false,error:"ACTIVITY_PILOT_CLOSED_IMMUTABLE"});
    }

    const lifecycle=activityLifecycle(activity);
    if (lifecycle==="ENDED") {
      return res.status(409).json({ok:false,error:"ACTIVITY_EDIT_LOCKED_AFTER_END",lifecycle});
    }

    const b=req.body||{};
    if (Object.prototype.hasOwnProperty.call(b,"dataClassification") || Object.prototype.hasOwnProperty.call(b,"classifiedAt")) {
      return res.status(409).json({ok:false,error:"DATA_CLASSIFICATION_IMMUTABLE_USE_QA_DOWNGRADE"});
    }
    const reason=String(b.changeReason||"").trim();
    const title=String(b.title ?? activity.title).trim();
    const category=String(b.category ?? activity.category).trim();
    const location=String(b.location ?? activity.location).trim();
    if (!title || !category || !location) {
      return res.status(400).json({ok:false,error:"MISSING_REQUIRED_FIELDS"});
    }

    const currentWindows=activityTimeWindows(activity);
    const startAt=b.startAt!==undefined ? toIso(b.startAt) : new Date(activity.startAt);
    const endAt=b.endAt!==undefined ? toIso(b.endAt) : new Date(activity.endAt);
    const checkinOpenAt=b.checkinOpenAt!==undefined ? toIso(b.checkinOpenAt) : new Date(currentWindows.checkinOpenAt);
    const checkinCloseAt=b.checkinCloseAt!==undefined ? toIso(b.checkinCloseAt) : new Date(currentWindows.checkinCloseAt);
    const checkoutOpenAt=b.checkoutOpenAt!==undefined ? toIso(b.checkoutOpenAt) : new Date(currentWindows.checkoutOpenAt);
    const checkoutCloseAt=b.checkoutCloseAt!==undefined ? toIso(b.checkoutCloseAt) : new Date(currentWindows.checkoutCloseAt);

    if (endAt <= startAt) return res.status(400).json({ok:false,error:"INVALID_ACTIVITY_TIME_RANGE"});
    if (checkinOpenAt >= checkinCloseAt) return res.status(400).json({ok:false,error:"INVALID_CHECKIN_WINDOW"});
    if (checkoutOpenAt >= checkoutCloseAt) return res.status(400).json({ok:false,error:"INVALID_CHECKOUT_WINDOW"});
    if (checkinCloseAt > endAt) return res.status(400).json({ok:false,error:"CHECKIN_WINDOW_AFTER_ACTIVITY_END"});
    if (checkoutOpenAt < startAt) return res.status(400).json({ok:false,error:"CHECKOUT_WINDOW_BEFORE_ACTIVITY_START"});

    const currentPolicy=activity.policy||{
      qrRequired:true,identityRequired:true,checkinRequired:true,checkoutRequired:true,
      durationRequired:true,staffRequired:true,signatureRequired:false,minDurationRatio:0.75,
    };
    const policyInput=b.policy&&typeof b.policy==="object"?b.policy:{};
    const nextPolicy={
      qrRequired:policyInput.qrRequired ?? currentPolicy.qrRequired,
      identityRequired:policyInput.identityRequired ?? currentPolicy.identityRequired,
      checkinRequired:policyInput.checkinRequired ?? currentPolicy.checkinRequired,
      checkoutRequired:policyInput.checkoutRequired ?? currentPolicy.checkoutRequired,
      durationRequired:policyInput.durationRequired ?? currentPolicy.durationRequired,
      staffRequired:policyInput.staffRequired ?? currentPolicy.staffRequired,
      signatureRequired:policyInput.signatureRequired ?? currentPolicy.signatureRequired,
      minDurationRatio:Number(policyInput.minDurationRatio ?? currentPolicy.minDurationRatio),
    };
    if (!Number.isFinite(nextPolicy.minDurationRatio) || nextPolicy.minDurationRatio<0 || nextPolicy.minDurationRatio>1) {
      return res.status(400).json({ok:false,error:"INVALID_MIN_DURATION_RATIO"});
    }

    const iso=(value)=>new Date(value).toISOString();
    const before={
      title:activity.title,category:activity.category,location:activity.location,
      startAt:iso(activity.startAt),endAt:iso(activity.endAt),
      checkinOpenAt:iso(activity.checkinOpenAt),checkinCloseAt:iso(activity.checkinCloseAt),
      checkoutOpenAt:iso(activity.checkoutOpenAt),checkoutCloseAt:iso(activity.checkoutCloseAt),
      policy:{
        qrRequired:Boolean(currentPolicy.qrRequired),
        identityRequired:Boolean(currentPolicy.identityRequired),
        checkinRequired:Boolean(currentPolicy.checkinRequired),
        checkoutRequired:Boolean(currentPolicy.checkoutRequired),
        durationRequired:Boolean(currentPolicy.durationRequired),
        staffRequired:Boolean(currentPolicy.staffRequired),
        signatureRequired:Boolean(currentPolicy.signatureRequired),
        minDurationRatio:Number(currentPolicy.minDurationRatio),
      },
    };
    const after={
      title,category,location,
      startAt:iso(startAt),endAt:iso(endAt),
      checkinOpenAt:iso(checkinOpenAt),checkinCloseAt:iso(checkinCloseAt),
      checkoutOpenAt:iso(checkoutOpenAt),checkoutCloseAt:iso(checkoutCloseAt),
      policy:{...nextPolicy},
    };

    const changedFields=[];
    for (const key of ["title","category","location","startAt","endAt","checkinOpenAt","checkinCloseAt","checkoutOpenAt","checkoutCloseAt"]) {
      if (before[key]!==after[key]) changedFields.push(key);
    }
    for (const key of ["qrRequired","identityRequired","checkinRequired","checkoutRequired","durationRequired","staffRequired","signatureRequired","minDurationRatio"]) {
      if (before.policy[key]!==after.policy[key]) changedFields.push("policy."+key);
    }

    if (!changedFields.length) {
      return res.json({ok:true,noChange:true,lifecycle,activity});
    }

    if (lifecycle==="ACTIVE") {
      const allowedActiveFields=new Set(["title","category","location"]);
      const restricted=changedFields.filter(key=>!allowedActiveFields.has(key));
      if (restricted.length) {
        return res.status(409).json({
          ok:false,error:"ACTIVITY_EDIT_RESTRICTED_DURING_ACTIVITY",
          lifecycle,restrictedFields:restricted,
        });
      }
      if (reason.length<10) {
        return res.status(400).json({ok:false,error:"ACTIVITY_EDIT_REASON_REQUIRED",lifecycle});
      }
    }

    const duplicate=await prisma.activity.findFirst({
      where:{
        id:{not:activity.id},
        organizerId:activity.organizerId,
        title:{equals:title,mode:"insensitive"},
        location,
        startAt,
        endAt,
      },
      select:{id:true,title:true},
    });
    if (duplicate) {
      return res.status(409).json({
        ok:false,error:"ACTIVITY_DUPLICATE",
        existingActivityId:duplicate.id,
      });
    }

    const scheduleOrQrChanged=changedFields.some(key=>
      ["startAt","endAt","checkinOpenAt","checkinCloseAt","checkoutOpenAt","checkoutCloseAt","policy.qrRequired"].includes(key)
    );

    const result=await prisma.$transaction(async(tx)=>{
      let qrTokensRevoked=0;
      if (scheduleOrQrChanged) {
        const revoked=await tx.qrToken.updateMany({
          where:{activityId:activity.id,revokedAt:null,expiresAt:{gt:new Date()}},
          data:{revokedAt:new Date()},
        });
        qrTokensRevoked=revoked.count;
      }

      const updated=await tx.activity.update({
        where:{id:activity.id},
        data:{
          title,category,location,startAt,endAt,
          checkinOpenAt,checkinCloseAt,checkoutOpenAt,checkoutCloseAt,
          policy:{
            upsert:{
              create:{...nextPolicy},
              update:{...nextPolicy},
            },
          },
        },
        include:{
          policy:true,
          organizer:{select:{id:true,employeeId:true,name:true}},
          roleAssignments:{
            include:{user:{select:{id:true,employeeId:true,name:true}}},
            orderBy:{assignedAt:"asc"},
          },
          _count:{select:{participants:true}},
        },
      });

      await tx.auditLog.create({
        data:{
          actorId:actorId(req),
          action:lifecycle==="ACTIVE"?"ACTIVITY_UPDATED_DURING_ACTIVE":"ACTIVITY_UPDATED",
          entityType:"Activity",
          entityId:activity.id,
          metadata:{
            lifecycle,
            changedFields,
            reason:reason||null,
            before,
            after,
            qrTokensRevoked,
          },
        },
      });
      return {updated,qrTokensRevoked};
    });

    res.json({
      ok:true,
      lifecycle,
      changedFields,
      qrTokensRevoked:result.qrTokensRevoked,
      activity:result.updated,
    });
  } catch(error) {
    res.status(400).json({ok:false,error:error.message});
  }
});

// One-way administrative quarantine of legacy or contaminated activity data.
// There is deliberately no endpoint to promote existing activity/attendance to EMPIRICAL.
app.post("/api/activities/:activityId/quarantine-qa", requireRoles("ADMIN"), async (req,res) => {
  const reason=String(req.body?.reason||"").trim();
  if (reason.length<10) return res.status(400).json({ok:false,error:"QA_QUARANTINE_REASON_REQUIRED"});
  const id=req.params.activityId;
  const existing=await prisma.activity.findUnique({where:{id},select:{id:true,dataClassification:true}});
  if (!existing) return res.status(404).json({ok:false,error:"ACTIVITY_NOT_FOUND"});
  if (existing.dataClassification==="QA_TEST") return res.json({ok:true,noChange:true,classification:"QA_TEST"});
  const result=await prisma.activity.updateMany({
    where:{id,dataClassification:{not:"QA_TEST"}},
    data:{dataClassification:"QA_TEST",classifiedAt:new Date()},
  });
  if (!result.count) return res.status(409).json({ok:false,error:"CLASSIFICATION_CHANGED_RETRY"});
  await audit(req,"ACTIVITY_QUARANTINED_QA","Activity",id,{
    from:existing.dataClassification,to:"QA_TEST",reason,irreversiblePromotionBlocked:true,
  });
  res.json({ok:true,activityId:id,classification:"QA_TEST",excludedFromResearch:true});
});

app.get("/api/activities/:activityId/manage", async (req, res) => {
  const activity = await prisma.activity.findUnique({
    where: { id:req.params.activityId },
    include: {
      policy:true,
      organizer:{ select:{ id:true, employeeId:true, name:true } },
      roleAssignments:{
        include:{ user:{ select:{ id:true, employeeId:true, name:true, department:{select:{code:true,name:true}} } } },
        orderBy:{ assignedAt:"asc" },
      },
      participants:{
        include:{ user:{ select:{ id:true, employeeId:true, name:true, department:{select:{code:true,name:true}} } } },
        orderBy:{ createdAt:"asc" },
      },
    },
  });
  if (!activity) return res.status(404).json({ok:false,error:"ACTIVITY_NOT_FOUND"});
  if (!(await canManageActivity(req, activity))) {
    return res.status(403).json({ok:false,error:"ACTIVITY_MANAGEMENT_FORBIDDEN"});
  }

  const coGov = await coAssignmentGovernance(req, activity);
  const canAssignVerifier = await canAssignActivityRole(req, activity, "CAN_ASSIGN_VERIFIER");

  res.json({
    ok:true,
    activity,
    capabilities:{
      canManage:true,
      canManageParticipants:true,
      canAssignCo:coGov.canEdit,
      canAssignVerifier,
      lifecycle:coGov.lifecycle,
      coChangeReasonRequired:coGov.reasonRequired,
      coAdminOverrideRequired:coGov.adminOverrideRequired,
    },
  });
});

app.delete("/api/activities/:activityId", requireRoles("ADMIN"), async (req, res) => {
  const activity = await prisma.activity.findUnique({
    where:{id:req.params.activityId},
    include:{
      _count:{
        select:{
          participants:true,
          roleAssignments:true,
          qrTokens:true,
          attendanceRecords:true,
        },
      },
    },
  });
  if (!activity) return res.status(404).json({ok:false,error:"ACTIVITY_NOT_FOUND"});
  if (activity.pilotClosedAt) {
    return res.status(423).json({ok:false,error:"ACTIVITY_PILOT_CLOSED_IMMUTABLE"});
  }

  const linked={
    participants:activity._count.participants,
    assignments:activity._count.roleAssignments,
    qrTokens:activity._count.qrTokens,
    attendanceRecords:activity._count.attendanceRecords,
  };
  if (Object.values(linked).some(Number)) {
    return res.status(409).json({
      ok:false,
      error:"ACTIVITY_DELETE_BLOCKED_HAS_LINKED_DATA",
      linked,
    });
  }

  await prisma.$transaction([
    prisma.auditLog.create({
      data:{
        actorId:actorId(req),
        action:"EMPTY_ACTIVITY_DELETED",
        entityType:"Activity",
        entityId:activity.id,
        metadata:{
          title:activity.title,
          startAt:activity.startAt,
          endAt:activity.endAt,
          createdAt:activity.createdAt,
          reason:"empty-duplicate-or-draft-cleanup",
        },
      },
    }),
    prisma.activity.delete({where:{id:activity.id}}),
  ]);

  res.json({ok:true,deletedActivityId:activity.id});
});

app.put("/api/activities/:activityId/assignments", async (req, res) => {
  const activity = await prisma.activity.findUnique({ where:{id:req.params.activityId} });
  if (!activity) return res.status(404).json({ok:false,error:"ACTIVITY_NOT_FOUND"});
  if (activity.pilotClosedAt) return res.status(423).json({ok:false,error:"ACTIVITY_PILOT_CLOSED_IMMUTABLE",pilotClosedAt:activity.pilotClosedAt});

  const hasCoPayload = Array.isArray(req.body?.coOrganizerIds);
  const hasVerifierPayload = Array.isArray(req.body?.verifierIds);
  if (!hasCoPayload && !hasVerifierPayload) {
    return res.status(400).json({ok:false,error:"ASSIGNMENT_LIST_REQUIRED"});
  }

  const coGov = await coAssignmentGovernance(req, activity);
  if (hasCoPayload && !coGov.canEdit) {
    return res.status(403).json({
      ok:false,
      error:coGov.lifecycle==="ENDED"
        ? "CO_ORGANIZER_LOCKED_AFTER_ACTIVITY"
        : "CO_ORGANIZER_ASSIGNMENT_FORBIDDEN",
      lifecycle:coGov.lifecycle,
    });
  }
  if (hasVerifierPayload && !(await canAssignActivityRole(req, activity, "CAN_ASSIGN_VERIFIER"))) {
    return res.status(403).json({ok:false,error:"VERIFIER_ASSIGNMENT_FORBIDDEN"});
  }

  async function resolveActiveIds(values) {
    const refs=[...new Set(values.map(String).filter(Boolean))];
    const users=[];
    for (const ref of refs) {
      const u=await resolveUserRef(ref);
      if (!u || u.status!=="ACTIVE") {
        const e=new Error("ASSIGNEE_NOT_FOUND_OR_INACTIVE:"+ref);
        e.code="ASSIGNEE_NOT_FOUND_OR_INACTIVE";
        throw e;
      }
      users.push(u);
    }
    return users;
  }

  try {
    const before = await prisma.activityRoleAssignment.findMany({
      where:{activityId:activity.id},
      select:{userId:true,role:true},
    });

    const coUsers = hasCoPayload ? await resolveActiveIds(req.body.coOrganizerIds) : null;
    const verifierUsers = hasVerifierPayload ? await resolveActiveIds(req.body.verifierIds) : null;
    const changeReason=String(req.body?.changeReason||"").trim();

    if (coUsers && coUsers.some(u=>u.id===activity.organizerId)) {
      return res.status(409).json({ok:false,error:"PRIMARY_ORGANIZER_CANNOT_BE_CO_ORGANIZER"});
    }

    if (verifierUsers && verifierUsers.some(u=>u.role!=="STAFF")) {
      return res.status(409).json({ok:false,error:"VERIFIER_MUST_BE_STAFF"});
    }
    if (verifierUsers && verifierUsers.some(u=>u.id===activity.organizerId)) {
      return res.status(409).json({ok:false,error:"ORGANIZER_CANNOT_REVIEW_OWN_ACTIVITY"});
    }

    const effectiveCoIds = new Set(
      (coUsers || before.filter(x=>x.role==="CO_ORGANIZER").map(x=>({id:x.userId}))).map(x=>x.id)
    );
    const effectiveVerifierIds = new Set(
      (verifierUsers || before.filter(x=>x.role==="VERIFIER").map(x=>({id:x.userId}))).map(x=>x.id)
    );
    const assignmentConflict=[...effectiveVerifierIds].find(id=>effectiveCoIds.has(id));
    if (assignmentConflict) {
      return res.status(409).json({ok:false,error:"REVIEWER_CANNOT_BE_CO_ORGANIZER",userId:assignmentConflict});
    }

    let coAdded=[],coRemoved=[];
    if (coUsers) {
      const beforeIds=before.filter(x=>x.role==="CO_ORGANIZER").map(x=>x.userId).sort();
      const afterIds=coUsers.map(x=>x.id).sort();
      coAdded=afterIds.filter(id=>!beforeIds.includes(id));
      coRemoved=beforeIds.filter(id=>!afterIds.includes(id));
      const changed=coAdded.length>0||coRemoved.length>0;

      if (changed && coGov.reasonRequired && changeReason.length<10) {
        return res.status(400).json({
          ok:false,
          error:coGov.lifecycle==="ENDED"
            ? "ADMIN_OVERRIDE_REASON_REQUIRED"
            : "CHANGE_REASON_REQUIRED_DURING_ACTIVITY",
          lifecycle:coGov.lifecycle,
        });
      }

      if (!changed && !hasVerifierPayload) {
        return res.json({
          ok:true,
          assignments:await prisma.activityRoleAssignment.findMany({
            where:{activityId:activity.id},
            include:{user:{select:{id:true,employeeId:true,name:true}}},
            orderBy:{assignedAt:"asc"},
          }),
          noChange:true,
          lifecycle:coGov.lifecycle,
          assignmentsUpdatedAt:activity.assignmentsUpdatedAt,
        });
      }
    }

    const updatedAt=new Date();
    await prisma.$transaction(async (tx)=>{
      if (coUsers) {
        await tx.activityRoleAssignment.deleteMany({where:{activityId:activity.id,role:"CO_ORGANIZER"}});
        if (coUsers.length) {
          await tx.activityRoleAssignment.createMany({
            data:coUsers.map(u=>({
              activityId:activity.id,userId:u.id,role:"CO_ORGANIZER",assignedById:req.activaUser.id
            })),
            skipDuplicates:true,
          });
        }
      }
      if (verifierUsers) {
        await tx.activityRoleAssignment.deleteMany({where:{activityId:activity.id,role:"VERIFIER"}});
        if (verifierUsers.length) {
          await tx.activityRoleAssignment.createMany({
            data:verifierUsers.map(u=>({
              activityId:activity.id,userId:u.id,role:"VERIFIER",assignedById:req.activaUser.id
            })),
            skipDuplicates:true,
          });
        }
      }
      await tx.activity.update({
        where:{id:activity.id},
        data:{assignmentsUpdatedAt:updatedAt},
      });
    });

    const after = await prisma.activityRoleAssignment.findMany({
      where:{activityId:activity.id},
      include:{user:{select:{id:true,employeeId:true,name:true}}},
      orderBy:{assignedAt:"asc"},
    });

    const action=hasCoPayload
      ? (coGov.lifecycle==="ENDED"
          ? "CO_ORGANIZER_ADMIN_OVERRIDE_AFTER_END"
          : coGov.lifecycle==="ACTIVE"
            ? "CO_ORGANIZER_CHANGED_DURING_ACTIVITY"
            : "CO_ORGANIZER_ASSIGNMENTS_UPDATED")
      : "ACTIVITY_ASSIGNMENTS_UPDATED";

    await audit(req,action,"Activity",activity.id,{
      lifecycle:coGov.lifecycle,
      changeReason:changeReason||null,
      coAdded,
      coRemoved,
      before,
      after:after.map(x=>({userId:x.userId,role:x.role,employeeId:x.user.employeeId})),
    });

    res.json({
      ok:true,
      assignments:after,
      noChange:false,
      lifecycle:coGov.lifecycle,
      assignmentsUpdatedAt:updatedAt.toISOString(),
    });
  } catch(error) {
    res.status(400).json({ok:false,error:error.code||error.message});
  }
});

app.put("/api/activities/:activityId/participants", async (req, res) => {
  const activity = await prisma.activity.findUnique({ where:{id:req.params.activityId} });
  if (!activity) return res.status(404).json({ok:false,error:"ACTIVITY_NOT_FOUND"});
  if (activity.pilotClosedAt) return res.status(423).json({ok:false,error:"ACTIVITY_PILOT_CLOSED_IMMUTABLE",pilotClosedAt:activity.pilotClosedAt});
  if (!(await canManageActivity(req, activity))) {
    return res.status(403).json({ok:false,error:"ACTIVITY_MANAGEMENT_FORBIDDEN"});
  }

  const mode=String(req.body?.mode||"OPEN").toUpperCase();
  if (!["OPEN","ROSTER","GROUP"].includes(mode)) {
    return res.status(400).json({ok:false,error:"INVALID_PARTICIPATION_MODE"});
  }

  const userIds=[...new Set((Array.isArray(req.body?.userIds)?req.body.userIds:[]).map(String).filter(Boolean))];
  const departmentCodes=[...new Set((Array.isArray(req.body?.departmentCodes)?req.body.departmentCodes:[]).map(x=>String(x).trim()).filter(Boolean))];

  const rosterUsers=[];
  if (mode==="ROSTER") {
    if (!userIds.length) return res.status(400).json({ok:false,error:"ROSTER_REQUIRES_PARTICIPANTS"});
    for (const ref of userIds) {
      const u=await resolveUserRef(ref);
      if (!u || u.status!=="ACTIVE") return res.status(400).json({ok:false,error:"PARTICIPANT_NOT_FOUND_OR_INACTIVE",ref});
      rosterUsers.push(u);
    }
  }
  if (mode==="GROUP" && !departmentCodes.length) {
    return res.status(400).json({ok:false,error:"GROUP_REQUIRES_DEPARTMENT"});
  }

  await prisma.$transaction(async (tx)=>{
    await tx.activity.update({
      where:{id:activity.id},
      data:{
        participationMode:mode,
        allowedDepartmentCodes:mode==="GROUP"?departmentCodes:[],
      },
    });
    await tx.activityParticipant.deleteMany({where:{activityId:activity.id}});
    if (mode==="ROSTER") {
      await tx.activityParticipant.createMany({
        data:rosterUsers.map(u=>({
          activityId:activity.id,
          userId:u.id,
          status:"INVITED",
          addedById:req.activaUser.id,
        })),
        skipDuplicates:true,
      });
    }
  });

  await audit(req,"ACTIVITY_PARTICIPATION_UPDATED","Activity",activity.id,{
    mode,
    participantCount:mode==="ROSTER"?rosterUsers.length:null,
    departmentCodes:mode==="GROUP"?departmentCodes:[],
  });

  const updated=await prisma.activity.findUnique({
    where:{id:activity.id},
    include:{
      participants:{include:{user:{select:{id:true,employeeId:true,name:true,department:{select:{code:true,name:true}}}}}},
    },
  });
  res.json({ok:true,activity:updated});
});

app.post("/api/activities/:activityId/qr", async (req, res) => {
  const activity = await prisma.activity.findUnique({ where: { id: req.params.activityId } });
  if (!activity) return res.status(404).json({ ok: false, error: "ACTIVITY_NOT_FOUND" });
  if (activity.pilotClosedAt) return res.status(423).json({ok:false,error:"ACTIVITY_PILOT_CLOSED_IMMUTABLE",pilotClosedAt:activity.pilotClosedAt});
  if (!(await canManageActivity(req, activity))) {
    return res.status(403).json({ ok: false, error: "ACTIVITY_MANAGEMENT_FORBIDDEN" });
  }

  const purpose = String(req.body?.purpose || "CHECKIN").toUpperCase();
  if (!["CHECKIN","CHECKOUT"].includes(purpose)) {
    return res.status(400).json({ ok:false, error:"INVALID_QR_PURPOSE" });
  }
  // Checkout remains operationally available for someone already checked in,
  // but no fresh empirical CHECKIN QR can be issued while research is paused.
  if (purpose === "CHECKIN" && activity.dataClassification === "EMPIRICAL" && !empiricalCollectionGate().enabled) {
    return res.status(409).json({ok:false,error:"EMPIRICAL_COLLECTION_GATE_HOLD"});
  }

  const windowState = purpose === "CHECKOUT"
    ? checkoutWindowState(activity)
    : checkinWindowState(activity);

  if (!windowState.ok) {
    return res.status(409).json({
      ok:false,
      error:windowState.code,
      purpose,
      checkinOpenAt:new Date(windowState.checkinOpenAt).toISOString(),
      checkinCloseAt:new Date(windowState.checkinCloseAt).toISOString(),
      checkoutOpenAt:new Date(windowState.checkoutOpenAt).toISOString(),
      checkoutCloseAt:new Date(windowState.checkoutCloseAt).toISOString(),
    });
  }

  const closeAt = purpose === "CHECKOUT" ? windowState.checkoutCloseAt : windowState.checkinCloseAt;
  const secondsUntilClose = Math.max(1, Math.floor((new Date(closeAt).getTime() - Date.now()) / 1000));
  const issued = createEventToken(activity.id, purpose, Math.min(qrTtl, secondsUntilClose));
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
    purpose,
    expiresAt: new Date(issued.payload.exp * 1000).toISOString(),
  });

  res.json({
    ok: true,
    purpose,
    token: issued.token,
    issuedAt: new Date(issued.payload.iat * 1000).toISOString(),
    expiresAt: new Date(issued.payload.exp * 1000).toISOString(),
    checkinOpenAt: new Date(windowState.checkinOpenAt).toISOString(),
    checkinCloseAt: new Date(windowState.checkinCloseAt).toISOString(),
    checkoutOpenAt: new Date(windowState.checkoutOpenAt).toISOString(),
    checkoutCloseAt: new Date(windowState.checkoutCloseAt).toISOString(),
  });
});

app.post("/api/attendance/checkin", async (req, res) => {
  const b = req.body || {};
  const tokenResult = verifyEventToken(b.token);
  if (!tokenResult.ok) {
    return res.status(400).json({ ok: false, error: tokenResult.reason });
  }
  if (tokenResult.payload.purpose !== "CHECKIN") {
    return res.status(409).json({
      ok:false,
      error:"QR_PURPOSE_MISMATCH",
      expectedPurpose:"CHECKIN",
      actualPurpose:tokenResult.payload.purpose,
    });
  }

  const activityId = tokenResult.payload.eventId;
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { policy: true },
  });
  if (!activity) return res.status(404).json({ ok: false, error: "ACTIVITY_NOT_FOUND" });
  if (activity.pilotClosedAt) return res.status(423).json({ok:false,error:"ACTIVITY_PILOT_CLOSED_IMMUTABLE",pilotClosedAt:activity.pilotClosedAt});
  if (activity.dataClassification === "EMPIRICAL" && !empiricalCollectionGate().enabled) {
    return res.status(409).json({ok:false,error:"EMPIRICAL_COLLECTION_GATE_HOLD"});
  }

  const windowState = checkinWindowState(activity);
  if (!windowState.ok) {
    return res.status(409).json({
      ok:false,
      error:windowState.code,
      checkinOpenAt:new Date(windowState.checkinOpenAt).toISOString(),
      checkinCloseAt:new Date(windowState.checkinCloseAt).toISOString(),
    });
  }

  const user = await resolveUserRef(b.userId);
  if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

  let participationAllowed = activity.participationMode === "OPEN";
  if (activity.participationMode === "ROSTER") {
    participationAllowed = Boolean(await prisma.activityParticipant.findUnique({
      where:{activityId_userId:{activityId:activity.id,userId:user.id}},
      select:{id:true,status:true},
    }).then(x=>x && x.status!=="CANCELLED"));
  } else if (activity.participationMode === "GROUP") {
    const department = user.departmentId
      ? await prisma.department.findUnique({where:{id:user.departmentId},select:{code:true}})
      : null;
    const allowed = Array.isArray(activity.allowedDepartmentCodes) ? activity.allowedDepartmentCodes : [];
    participationAllowed = Boolean(department?.code && allowed.includes(department.code));
  }
  if (!participationAllowed) {
    return res.status(403).json({
      ok:false,
      error:"ACTIVITY_PARTICIPATION_NOT_ALLOWED",
      participationMode:activity.participationMode,
    });
  }

  if (req.activaUser.id !== user.id) {
    return res.status(403).json({
      ok:false,
      error:"CHECKIN_SELF_ONLY",
      note:"Dynamic QR check-in is personal attendance evidence for the authenticated user, regardless of activity role."
    });
  }

  const existing = await prisma.attendanceRecord.findFirst({
    where: { activityId, userId: user.id, isVoided: false },
  });
  if (existing) {
    return res.status(409).json({
      ok: false,
      error: existing.checkoutAt ? "ACTIVITY_ALREADY_COMPLETED" : "ALREADY_CHECKED_IN",
      attendanceId: existing.id,
      checkinAt: existing.checkinAt,
      checkoutAt: existing.checkoutAt,
      attendanceStatus: existing.attendanceStatus,
    });
  }

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
  if (!(await ensureActivityOperationallyMutable(res, current.activityId))) return;
  if (current.isVoided) return res.status(409).json({ ok: false, error: "ATTENDANCE_VOIDED" });
  if (current.userId !== req.activaUser.id) {
    return res.status(403).json({
      ok:false,
      error:"CHECKOUT_SELF_ONLY",
      note:"Normal Dynamic QR checkout is personal attendance evidence. Operational exceptions must use the separate assisted workflow."
    });
  }
  if (!current.checkinAt) return res.status(409).json({ ok: false, error: "CHECKIN_REQUIRED" });
  if (current.checkoutAt) return res.status(409).json({
    ok: false,
    error: "ALREADY_CHECKED_OUT",
    attendanceId: current.id,
    checkoutAt: current.checkoutAt,
  });

  const token = req.body?.token;
  if (!token) return res.status(400).json({ ok:false, error:"CHECKOUT_QR_REQUIRED" });

  const tokenResult = verifyEventToken(token);
  if (!tokenResult.ok) {
    return res.status(400).json({ ok:false, error:tokenResult.reason });
  }
  if (tokenResult.payload.purpose !== "CHECKOUT") {
    return res.status(409).json({
      ok:false,
      error:"QR_PURPOSE_MISMATCH",
      expectedPurpose:"CHECKOUT",
      actualPurpose:tokenResult.payload.purpose,
    });
  }
  if (tokenResult.payload.eventId !== current.activityId) {
    return res.status(409).json({
      ok:false,
      error:"CHECKOUT_QR_ACTIVITY_MISMATCH",
      expectedActivityId:current.activityId,
      actualActivityId:tokenResult.payload.eventId,
    });
  }

  const windowState = checkoutWindowState(current.activity);
  if (!windowState.ok) {
    return res.status(409).json({
      ok:false,
      error:windowState.code,
      checkoutOpenAt:new Date(windowState.checkoutOpenAt).toISOString(),
      checkoutCloseAt:new Date(windowState.checkoutCloseAt).toISOString(),
    });
  }

  const checkoutAt = new Date();
  const durationMinutes = Math.max(0, Math.round((checkoutAt.getTime() - current.checkinAt.getTime()) / 60000));
  const expectedMinutes = Math.max(1, Math.round((current.activity.endAt.getTime() - current.activity.startAt.getTime()) / 60000));
  const attendancePercentage = Math.min(100, (durationMinutes / expectedMinutes) * 100);

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.attendanceRecord.update({
      where: { id: current.id },
      data: {
        checkoutAt,
        checkoutQrValid:true,
        checkoutMethod:"DYNAMIC_QR",
        checkoutExceptionReason:null,
        durationMinutes,
        attendancePercentage,
        attendanceStatus: "CHECKED_OUT",
        finalEvidenceStatus: null,
      },
    });
    await tx.consistencyResult.deleteMany({ where: { attendanceId: current.id } });
    return updated;
  });

  if (current.finalEvidenceStatus) {
    await audit(req, "FINAL_DECISION_INVALIDATED", "AttendanceRecord", row.id, {
      previousFinal: current.finalEvidenceStatus,
      reason: "CHECKOUT_CHANGED",
    });
  }
  await audit(req, "CHECKOUT", "AttendanceRecord", row.id, {
    durationMinutes,
    attendancePercentage,
    method:"DYNAMIC_QR",
    checkoutQrValid:true,
  });
  res.json({ ok: true, attendance: row });
});

app.post("/api/attendance/:attendanceId/checkout-assist", async (req, res) => {
  const current = await prisma.attendanceRecord.findUnique({
    where:{id:req.params.attendanceId},
    include:{activity:true},
  });
  if (!current) return res.status(404).json({ok:false,error:"ATTENDANCE_NOT_FOUND"});
  if (!(req.activaUser?.role==="ADMIN" || await canManageActivity(req,current.activity))) {
    return res.status(403).json({
      ok:false,
      error:"OPERATIONAL_ACTIVITY_ASSIGNMENT_REQUIRED",
      note:"Staff-assisted checkout is an operational Owner/Co-organizer action; Reviewer assignment alone is not sufficient."
    });
  }
  if (!(await ensureActivityOperationallyMutable(res, current.activityId))) return;
  if (current.isVoided) return res.status(409).json({ok:false,error:"ATTENDANCE_VOIDED"});
  if (!current.checkinAt) return res.status(409).json({ok:false,error:"CHECKIN_REQUIRED"});
  if (current.checkoutAt) return res.status(409).json({ok:false,error:"ALREADY_CHECKED_OUT",checkoutAt:current.checkoutAt});

  const reason=String(req.body?.reason||"").trim();
  if (reason.length<10) return res.status(400).json({ok:false,error:"CHECKOUT_EXCEPTION_REASON_REQUIRED"});

  const checkoutAt=new Date();
  const durationMinutes=Math.max(0,Math.round((checkoutAt.getTime()-current.checkinAt.getTime())/60000));
  const expectedMinutes=Math.max(1,Math.round((current.activity.endAt.getTime()-current.activity.startAt.getTime())/60000));
  const attendancePercentage=Math.min(100,(durationMinutes/expectedMinutes)*100);
  const windowState=checkoutWindowState(current.activity,checkoutAt);

  const row=await prisma.$transaction(async (tx)=>{
    const updated=await tx.attendanceRecord.update({
      where:{id:current.id},
      data:{
        checkoutAt,
        checkoutQrValid:false,
        checkoutMethod:"STAFF_ASSISTED",
        checkoutExceptionReason:reason,
        durationMinutes,
        attendancePercentage,
        attendanceStatus:"CHECKED_OUT",
        finalEvidenceStatus:null,
      },
    });
    await tx.consistencyResult.deleteMany({where:{attendanceId:current.id}});
    return updated;
  });

  if(current.finalEvidenceStatus){
    await audit(req,"FINAL_DECISION_INVALIDATED","AttendanceRecord",row.id,{
      previousFinal:current.finalEvidenceStatus,
      reason:"STAFF_ASSISTED_CHECKOUT",
    });
  }
  await audit(req,"STAFF_ASSISTED_CHECKOUT","AttendanceRecord",row.id,{
    reason,
    durationMinutes,
    attendancePercentage,
    checkoutWindowState:windowState.code,
  });
  res.json({ok:true,attendance:row,exception:true,windowState:windowState.code});
});

app.post("/api/attendance/:attendanceId/staff-verify", requireRoles("ADMIN", "STAFF"), async (req, res) => {
  const verifierId = actorId(req);
  if (!verifierId) return res.status(401).json({ ok: false, error: "X_ACTIVA_USER_ID_REQUIRED" });

  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: req.params.attendanceId },
    include: { staffVerification: true },
  });
  if (!attendance) return res.status(404).json({ ok: false, error: "ATTENDANCE_NOT_FOUND" });
  if (attendance.userId === verifierId) {
    return res.status(409).json({
      ok:false,
      error:"SELF_REVIEW_FORBIDDEN",
      note:"A reviewer may participate in the activity, but another assigned reviewer must verify the reviewer's own attendance."
    });
  }
  if (!(await canReviewActivity(req, attendance.activityId))) {
    return res.status(403).json({
      ok:false,
      error:"REVIEWER_NOT_ASSIGNED_TO_ACTIVITY",
      activityId:attendance.activityId,
      note:"STAFF must be assigned as VERIFIER for this activity. ADMIN may review as governance override."
    });
  }
  if (!(await ensureActivityOperationallyMutable(res, attendance.activityId))) return;
  if (attendance.isVoided) return res.status(409).json({ ok: false, error: "ATTENDANCE_VOIDED" });
  if (attendance.guestParticipantId && req.body?.guestIdentityWitnessed !== true) {
    return res.status(400).json({ok:false,error:"GUEST_IN_PERSON_IDENTITY_ATTESTATION_REQUIRED"});
  }
  if (attendance.staffVerification) {
    return res.json({ ok: true, verification: attendance.staffVerification, idempotent: true });
  }

  const row = await prisma.$transaction(async (tx) => {
    const verification = await tx.staffVerification.create({
      data: { attendanceId: attendance.id, verifierId, status: "VERIFIED_PRESENT" },
    });
    await tx.attendanceRecord.update({
      where: { id: attendance.id },
      data: {
        finalEvidenceStatus: null,
        ...(attendance.guestParticipantId?{identityVerified:true}:{}),
      },
    });
    await tx.consistencyResult.deleteMany({ where: { attendanceId: attendance.id } });
    return verification;
  });

  if (attendance.finalEvidenceStatus) {
    await audit(req, "FINAL_DECISION_INVALIDATED", "AttendanceRecord", attendance.id, {
      previousFinal: attendance.finalEvidenceStatus,
      reason: "STAFF_VERIFICATION_CHANGED",
    });
  }
  await audit(req, attendance.guestParticipantId ? "GUEST_IDENTITY_WITNESSED" : "STAFF_VERIFIED", "AttendanceRecord", attendance.id, {
    verifierId,method:attendance.guestParticipantId?"IN_PERSON_WITNESSED":"REGISTERED_USER",
  });
  res.json({ ok: true, verification: row });
});

app.post("/api/attendance/:attendanceId/void", requireRoles("ADMIN", "STAFF"), async (req, res) => {
  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: req.params.attendanceId },
    include: { groundTruthCase: true },
  });
  if (!attendance) return res.status(404).json({ ok: false, error: "ATTENDANCE_NOT_FOUND" });
  if (!(await canReviewActivity(req, attendance.activityId))) {
    return res.status(403).json({ok:false,error:"REVIEWER_NOT_ASSIGNED_TO_ACTIVITY",activityId:attendance.activityId});
  }
  if (attendance.userId === req.activaUser.id) {
    return res.status(409).json({ok:false,error:"SELF_REVIEW_FORBIDDEN"});
  }
  if (!(await ensureActivityOperationallyMutable(res, attendance.activityId))) return;
  if (attendance.isVoided) return res.json({ ok: true, attendance, idempotent: true });
  if (attendance.groundTruthCase?.status === "LOCKED") {
    return res.status(409).json({ ok: false, error: "LOCKED_GROUND_TRUTH_CANNOT_BE_VOIDED" });
  }
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 5) {
    return res.status(400).json({ ok: false, error: "VOID_REASON_REQUIRED" });
  }

  const row = await prisma.attendanceRecord.update({
    where: { id: attendance.id },
    data: {
      isVoided: true,
      voidedAt: new Date(),
      voidedById: req.activaUser.id,
      voidReason: reason,
    },
  });

  await audit(req, "ATTENDANCE_VOIDED_BY_REVIEWER", "AttendanceRecord", attendance.id, { reason });
  res.json({ ok: true, attendance: row });
});

app.post("/api/evidence/:attendanceId/evaluate", requireRoles("ADMIN", "ORGANIZER", "STAFF"), async (req, res) => {
  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: req.params.attendanceId },
    include: {
      activity: { include: { policy: true } },
      staffVerification: true,
      consistencyResult: true,
      humanReviews: { orderBy: { reviewedAt: "desc" }, take: 1 },
      participantResponses: { orderBy: { submittedAt: "desc" }, take: 1 },
    },
  });
  if (!attendance) return res.status(404).json({ ok: false, error: "ATTENDANCE_NOT_FOUND" });
  if (!(await ensureActivityOperationallyMutable(res, attendance.activityId))) return;
  if (attendance.isVoided) return res.status(409).json({ ok: false, error: "ATTENDANCE_VOIDED" });
  const checkoutState = checkoutWindowState(attendance.activity);
  if (!attendance.checkoutAt && checkoutState.code !== "QR_CHECKOUT_CLOSED") {
    return res.status(409).json({
      ok:false,
      error:"ATTENDANCE_STILL_ACTIVE",
      note:"Evidence should not be evaluated while checkout is still possible.",
      checkoutOpenAt:new Date(checkoutState.checkoutOpenAt).toISOString(),
      checkoutCloseAt:new Date(checkoutState.checkoutCloseAt).toISOString(),
    });
  }
  if (!attendance.activity.policy) return res.status(409).json({ ok: false, error: "POLICY_NOT_CONFIGURED" });

  const latestReview = attendance.humanReviews?.[0] || null;
  const latestParticipantResponse = attendance.participantResponses?.[0] || null;
  const requestedAt =
    latestReview?.decision === "REQUEST_EVIDENCE" && latestReview.reviewedAt
      ? new Date(latestReview.reviewedAt).getTime()
      : 0;
  const responseMatchesRequest = Boolean(
    latestParticipantResponse &&
    (!latestParticipantResponse.requestReviewId || latestParticipantResponse.requestReviewId === latestReview?.id)
  );
  const respondedAt =
    responseMatchesRequest && latestParticipantResponse?.submittedAt
      ? new Date(latestParticipantResponse.submittedAt).getTime()
      : 0;
  const previousConsistency = attendance.consistencyResult || null;
  const previousBlockers = previousConsistency
    ? [
        ...(Array.isArray(previousConsistency.missingCodes) ? previousConsistency.missingCodes : []),
        ...(Array.isArray(previousConsistency.reasonCodes) ? previousConsistency.reasonCodes : []),
      ]
    : [];
  const previousEvaluatedAt = previousConsistency?.evaluatedAt
    ? new Date(previousConsistency.evaluatedAt).getTime()
    : 0;
  const requestAlreadyResolved = Boolean(
    requestedAt &&
    (
      respondedAt > requestedAt ||
      (
        previousConsistency?.status === "COMPLETE" &&
        previousBlockers.length === 0 &&
        previousEvaluatedAt > requestedAt
      )
    )
  );

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

  if (attendance.finalEvidenceStatus === "VERIFIED" && stored.status !== "COMPLETE") {
    await prisma.attendanceRecord.update({
      where: { id: attendance.id },
      data: { finalEvidenceStatus: null },
    });
    await audit(req, "FINAL_DECISION_INVALIDATED", "AttendanceRecord", attendance.id, {
      previousFinal: "VERIFIED",
      reason: "POLICY_BLOCKERS_AFTER_REEVALUATION",
    });
  }

  await audit(req, "EVIDENCE_EVALUATED", "AttendanceRecord", attendance.id, {
    status: stored.status,
    ruleVersion,
  });

  const storedBlockers = [
    ...(Array.isArray(stored.missingCodes) ? stored.missingCodes : []),
    ...(Array.isArray(stored.reasonCodes) ? stored.reasonCodes : []),
  ];
  const requestResolvedByEvidence = Boolean(
    requestedAt &&
    !requestAlreadyResolved &&
    stored.status === "COMPLETE" &&
    storedBlockers.length === 0 &&
    new Date(stored.evaluatedAt).getTime() > requestedAt
  );

  if (requestResolvedByEvidence) {
    await audit(req, "INFO_REQUEST_RESOLVED_BY_EVIDENCE_UPDATE", "AttendanceRecord", attendance.id, {
      requestReviewId: latestReview?.id || null,
      requestedAt: latestReview?.reviewedAt || null,
      evaluatedAt: stored.evaluatedAt,
      status: stored.status,
    });
  }

  res.json({
    ok: true,
    result: stored,
    workflowStatus: requestResolvedByEvidence ? "READY_DECISION" : undefined,
    infoRequestResolvedByEvidenceUpdate: requestResolvedByEvidence,
    finalDecisionInvalidated:
      attendance.finalEvidenceStatus === "VERIFIED" && stored.status !== "COMPLETE",
    note: "Rule-based result; not AI risk probability.",
  });
});

app.post("/api/participant-response/:attendanceId", requireRoles("PARTICIPANT"), async (req, res) => {
  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: req.params.attendanceId },
    include: {
      humanReviews: { orderBy: { reviewedAt: "desc" }, take: 1 },
      consistencyResult: true,
      participantResponses: { orderBy: { submittedAt: "desc" }, take: 1 },
    },
  });
  if (!attendance) return res.status(404).json({ ok:false, error:"ATTENDANCE_NOT_FOUND" });
  if (attendance.userId !== req.activaUser.id) {
    return res.status(403).json({ ok:false, error:"PARTICIPANT_RESPONSE_FORBIDDEN" });
  }
  if (!(await ensureActivityOperationallyMutable(res, attendance.activityId))) return;
  const latest = attendance.humanReviews[0] || null;
  if (latest?.decision !== "REQUEST_EVIDENCE") {
    return res.status(409).json({ ok:false, error:"PARTICIPANT_RESPONSE_NOT_REQUESTED" });
  }

  const requestedAt = latest.reviewedAt ? new Date(latest.reviewedAt).getTime() : 0;
  const latestResponse = attendance.participantResponses?.[0] || null;
  const responseMatchesRequest = Boolean(
    latestResponse && (!latestResponse.requestReviewId || latestResponse.requestReviewId === latest.id)
  );
  const respondedAt =
    responseMatchesRequest && latestResponse?.submittedAt
      ? new Date(latestResponse.submittedAt).getTime()
      : 0;
  const c = attendance.consistencyResult || null;
  const blockers = c
    ? [
        ...(Array.isArray(c.missingCodes) ? c.missingCodes : []),
        ...(Array.isArray(c.reasonCodes) ? c.reasonCodes : []),
      ]
    : [];
  const evaluatedAt = c?.evaluatedAt ? new Date(c.evaluatedAt).getTime() : 0;
  const requestResolved = Boolean(
    requestedAt &&
    (
      respondedAt > requestedAt ||
      (c?.status === "COMPLETE" && blockers.length === 0 && evaluatedAt > requestedAt)
    )
  );
  if (requestResolved) {
    return res.status(409).json({
      ok:false,
      error:"PARTICIPANT_RESPONSE_REQUEST_ALREADY_RESOLVED",
      workflowStatus:"READY_DECISION",
    });
  }

  const response = String(req.body?.response || "").trim();
  if (response.length < 3) {
    return res.status(400).json({ ok:false, error:"PARTICIPANT_RESPONSE_REQUIRED" });
  }
  const item = await prisma.participantResponse.create({
    data: {
      attendanceId: attendance.id,
      userId: req.activaUser.id,
      response,
      requestReviewId: latest.id,
    },
  });
  await prisma.attendanceRecord.update({
    where: { id: attendance.id },
    data: { finalEvidenceStatus: "REVIEW_REQUIRED" },
  });
  await audit(req, "PARTICIPANT_EVIDENCE_RESPONSE", "AttendanceRecord", attendance.id, {
    requestReviewId: latest.id,
    participantResponseId: item.id,
    submittedAt: item.submittedAt,
  });
  res.status(201).json({ ok:true, participantResponse:item, workflowStatus:"READY_DECISION" });
});

app.post("/api/reviews/:attendanceId", requireRoles("ADMIN", "STAFF"), async (req, res) => {
  const reviewerId = actorId(req);
  if (!reviewerId) return res.status(401).json({ ok: false, error: "X_ACTIVA_USER_ID_REQUIRED" });

  const b = req.body || {};
  const allowed = ["VERIFY", "OVERRIDE_VERIFY", "CORRECT", "REQUEST_EVIDENCE", "REJECT"];
  if (!allowed.includes(b.decision)) {
    return res.status(400).json({ ok: false, error: "INVALID_DECISION" });
  }

  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: req.params.attendanceId },
    include: { consistencyResult: true },
  });
  if (!attendance) return res.status(404).json({ ok: false, error: "ATTENDANCE_NOT_FOUND" });
  if (!(await canReviewActivity(req, attendance.activityId))) {
    return res.status(403).json({
      ok:false,
      error:"REVIEWER_NOT_ASSIGNED_TO_ACTIVITY",
      activityId:attendance.activityId,
      note:"STAFF must be assigned as VERIFIER for this activity. ADMIN may review as governance override."
    });
  }
  if (attendance.userId === reviewerId) {
    return res.status(409).json({
      ok:false,
      error:"SELF_REVIEW_FORBIDDEN",
      note:"A reviewer may also be a participant, but cannot decide their own attendance record."
    });
  }
  if (!(await ensureActivityOperationallyMutable(res, attendance.activityId))) return;
  if (attendance.isVoided) return res.status(409).json({ ok: false, error: "ATTENDANCE_VOIDED" });
  if (!attendance.consistencyResult) {
    return res.status(409).json({ ok: false, error: "EVIDENCE_EVALUATION_REQUIRED" });
  }

  const missingCodes = Array.isArray(attendance.consistencyResult.missingCodes)
    ? attendance.consistencyResult.missingCodes
    : [];
  const reasonCodes = Array.isArray(attendance.consistencyResult.reasonCodes)
    ? attendance.consistencyResult.reasonCodes
    : [];
  const blockers = [...missingCodes, ...reasonCodes];
  const reason = String(b.reason || "").trim();

  if (b.decision === "VERIFY" && blockers.length > 0) {
    return res.status(409).json({
      ok: false,
      error: "REVIEW_BLOCKERS_PRESENT",
      blockers,
      systemEvidenceStatus: attendance.consistencyResult.status,
    });
  }

  if (b.decision === "OVERRIDE_VERIFY") {
    if (!["ADMIN", "STAFF"].includes(req.activaUser.role)) {
      return res.status(403).json({ ok: false, error: "AUTHORIZED_REVIEWER_REQUIRED" });
    }
    if (blockers.length === 0) {
      return res.status(409).json({ ok: false, error: "OVERRIDE_NOT_NEEDED" });
    }
  }

  if (reason.length < 3) {
    return res.status(400).json({
      ok: false,
      error: "REVIEW_REASON_REQUIRED",
      note: "Every human decision must carry an explicit rationale for auditability.",
    });
  }

  if (b.decision === "OVERRIDE_VERIFY" && reason.length < 10) {
    return res.status(400).json({ ok: false, error: "OVERRIDE_REASON_REQUIRED" });
  }

  const previousFinalStatus = attendance.finalEvidenceStatus || null;

  const review = await prisma.humanReview.create({
    data: {
      attendanceId: attendance.id,
      reviewerId,
      decision: b.decision,
      reason: reason || null,
      reviewStartedAt: b.reviewStartedAt ? toIso(b.reviewStartedAt) : null,
      reviewDurationSeconds: b.reviewDurationSeconds ? Number(b.reviewDurationSeconds) : null,
    },
  });

  let finalEvidenceStatus = "REVIEW_REQUIRED";
  if (b.decision === "VERIFY") finalEvidenceStatus = "VERIFIED";
  if (b.decision === "OVERRIDE_VERIFY") finalEvidenceStatus = "OVERRIDE_VERIFIED";
  if (b.decision === "REJECT") finalEvidenceStatus = "REJECTED";

  await prisma.attendanceRecord.update({
    where: { id: attendance.id },
    data: { finalEvidenceStatus },
  });

  await audit(
    req,
    b.decision === "OVERRIDE_VERIFY" ? "MANUAL_OVERRIDE_VERIFIED" : "HUMAN_REVIEW",
    "AttendanceRecord",
    attendance.id,
    {
      reviewId: review.id,
      reviewerId,
      decision: b.decision,
      reason,
      previousFinalStatus,
      finalEvidenceStatus,
      systemEvidenceStatus: attendance.consistencyResult.status,
      blockers,
      reviewStartedAt: review.reviewStartedAt,
      reviewedAt: review.reviewedAt,
      reviewDurationSeconds: review.reviewDurationSeconds,
    }
  );

  res.status(201).json({
    ok: true,
    review,
    previousFinalStatus,
    finalEvidenceStatus,
    systemEvidenceStatus: attendance.consistencyResult.status,
    blockers,
  });
});


async function combinedGroundTruthLabels(attendanceId) {
  const [internal, external] = await Promise.all([
    prisma.groundTruthLabel.findMany({
      where: { attendanceId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.externalGroundTruthLabel.findMany({
      where: {
        attendanceId,
        invite: { batch: { status: "COMPLETED" } },
      },
      include: {
        invite: { select: { id:true, reviewerSlot:true, batchId:true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return [
    ...internal.map((x) => ({
      ...x,
      reviewerKey: "USER:" + x.reviewerId,
      reviewerType: "INTERNAL",
      reviewerSlot: null,
    })),
    ...external.map((x) => ({
      ...x,
      reviewerKey: "EXTERNAL:" + x.inviteId,
      reviewerType: "EXTERNAL_BLIND",
      reviewerId: null,
    })),
  ];
}

app.get("/api/ground-truth/:attendanceId/blind-batches", requireRoles("ADMIN"), async (req, res) => {
  const batches = await prisma.blindReviewBatch.findMany({
    where: { attendanceId: req.params.attendanceId },
    include: {
      invites: {
        orderBy: { reviewerSlot: "asc" },
        select: {
          id:true,
          reviewerSlot:true,
          expiresAt:true,
          submittedAt:true,
          revokedAt:true,
          independenceAttested:true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    ok:true,
    tokenValuesIncluded:false,
    batches:batches.map((b) => ({
      id:b.id,
      status:b.status,
      expiresAt:b.expiresAt,
      revokedAt:b.revokedAt,
      createdAt:b.createdAt,
      submittedCount:b.invites.filter((x) => Boolean(x.submittedAt)).length,
      invites:b.invites,
    })),
  });
});

app.post("/api/ground-truth/:attendanceId/blind-batch", requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const attendanceId = req.params.attendanceId;
    const attendance = await prisma.attendanceRecord.findUnique({
      where: { id: attendanceId },
      include: { activity:true, groundTruthCase:true },
    });
    if (!attendance || attendance.isVoided) {
      return res.status(404).json({ ok:false, error:"ATTENDANCE_NOT_FOUND" });
    }
    if (attendance.groundTruthCase?.status === "LOCKED") {
      return res.status(409).json({ ok:false, error:"GROUND_TRUTH_ALREADY_LOCKED" });
    }
    if (!attendance.checkoutAt && checkoutWindowState(attendance.activity).code !== "QR_CHECKOUT_CLOSED") {
      return res.status(409).json({
        ok:false,
        error:"GROUND_TRUTH_ATTENDANCE_NOT_MATURE",
        note:"Wait until checkout is complete or the checkout window has closed.",
      });
    }

    const rawHours = Number(req.body?.expiresHours ?? 24);
    if (!Number.isInteger(rawHours) || rawHours < 1 || rawHours > 168) {
      return res.status(400).json({ ok:false, error:"BLIND_REVIEW_EXPIRY_HOURS_INVALID" });
    }
    const replaceActive = req.body?.replaceActive === true;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + rawHours * 3600000);

    const active = await prisma.blindReviewBatch.findFirst({
      where: {
        attendanceId,
        status:"OPEN",
        revokedAt:null,
        expiresAt:{ gt:now },
      },
      orderBy:{ createdAt:"desc" },
    });
    if (active && !replaceActive) {
      return res.status(409).json({
        ok:false,
        error:"ACTIVE_BLIND_REVIEW_BATCH_EXISTS",
        batchId:active.id,
        expiresAt:active.expiresAt,
      });
    }

    const tokens = {
      A: crypto.randomBytes(32).toString("base64url"),
      B: crypto.randomBytes(32).toString("base64url"),
    };

    const batch = await prisma.$transaction(async (tx) => {
      if (active && replaceActive) {
        await tx.blindReviewInvite.updateMany({
          where:{ batchId:active.id, submittedAt:null },
          data:{ revokedAt:now },
        });
        await tx.blindReviewBatch.update({
          where:{ id:active.id },
          data:{ status:"REVOKED", revokedAt:now },
        });
      }

      return tx.blindReviewBatch.create({
        data:{
          attendanceId,
          createdById:req.activaUser.id,
          status:"OPEN",
          expiresAt,
          invites:{
            create:[
              { reviewerSlot:"A", tokenHash:blindReviewTokenHash(tokens.A), expiresAt },
              { reviewerSlot:"B", tokenHash:blindReviewTokenHash(tokens.B), expiresAt },
            ],
          },
        },
        include:{ invites:{ orderBy:{ reviewerSlot:"asc" } } },
      });
    });

    await audit(req,"EXTERNAL_BLIND_REVIEW_BATCH_CREATED","AttendanceRecord",attendanceId,{
      batchId:batch.id,
      expiresAt:expiresAt.toISOString(),
      reviewerSlots:["A","B"],
      replacedBatchId:active && replaceActive ? active.id : null,
      rawTokensPersisted:false,
    });

    res.status(201).json({
      ok:true,
      batchId:batch.id,
      expiresAt,
      tokenReturnedOnce:true,
      rawTokensPersisted:false,
      containsPII:false,
      links:[
        { reviewerSlot:"A", path:"/blind-review#token=" + encodeURIComponent(tokens.A) },
        { reviewerSlot:"B", path:"/blind-review#token=" + encodeURIComponent(tokens.B) },
      ],
      note:"Share each link with a different real reviewer. Tokens are not recoverable after this response.",
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/ground-truth/queue", requireRoles("ADMIN", "STAFF"), async (req, res) => {
  // Limit STAFF reviewer records at DB-query level to their assigned VERIFIER
  // activities. Merely having the STAFF role is not a research-case assignment.
  const allowedActivityIds=req.activaUser.role==="ADMIN" ? null :
    (await prisma.activityRoleAssignment.findMany({
      where:{userId:req.activaUser.id,role:"VERIFIER"},
      select:{activityId:true},
    })).map(x=>x.activityId);
  const rows = await prisma.attendanceRecord.findMany({
    where: {
      isVoided:false,
      ...(allowedActivityIds===null ? {} : {activityId:{in:allowedActivityIds}}),
    },
    include: {
      user: { select: { id: true, employeeId: true, name: true } },
      guestParticipant:{select:{id:true,consentAt:true,withdrawnAt:true,revokedAt:true}},
      activity: { include: { policy: true } },
      staffVerification: true,
      groundTruthLabels: true,
      externalGroundTruthLabels: {
        include: {
          invite: {
            select: {
              id:true,
              reviewerSlot:true,
              batchId:true,
              batch:{ select:{ status:true } },
            },
          },
        },
      },
      blindReviewBatches: {
        include: {
          invites: {
            orderBy:{ reviewerSlot:"asc" },
            select:{
              id:true,
              reviewerSlot:true,
              expiresAt:true,
              submittedAt:true,
              revokedAt:true,
              independenceAttested:true,
            },
          },
        },
        orderBy:{ createdAt:"desc" },
      },
      groundTruthCase: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Intentionally excludes aiPredictions and consistencyResult:
  // ground-truth reviewers see raw evidence, not AI/rule recommendations.
  // STAFF reviewers only receive their own labels to preserve independent labeling.
  const eligibleRows = rows.filter((row) => {
    if (req.activaUser.role !== "ADMIN" && row.userId === req.activaUser.id) return false;
    if (row.checkoutAt) return true;
    return checkoutWindowState(row.activity).code === "QR_CHECKOUT_CLOSED";
  });

  const safeRows = eligibleRows.map((row) => ({
    ...row,
    // Identity disclosure is unnecessary for AI-blinded Ground Truth review.
    // ADMIN retains the existing case-management view; assigned STAFF sees only
    // an attendance reference and evidence, not name/employee ID/user ID.
    ...(req.activaUser.role === "ADMIN" ? {} : {
      user:null,userId:null,guestParticipant:null,guestParticipantId:null,
    }),
    groundTruthLabels:
      req.activaUser.role === "ADMIN"
        ? row.groundTruthLabels
        : row.groundTruthLabels.filter((label) => label.reviewerId === req.activaUser.id),
    externalGroundTruthLabels:
      req.activaUser.role === "ADMIN"
        ? (row.externalGroundTruthLabels || []).filter((label) => label.invite?.batch?.status === "COMPLETED")
        : [],
    blindReviewBatches:
      req.activaUser.role === "ADMIN"
        ? (row.blindReviewBatches || []).map((batch) => ({
            id:batch.id,
            status:batch.status,
            expiresAt:batch.expiresAt,
            revokedAt:batch.revokedAt,
            createdAt:batch.createdAt,
            submittedCount:(batch.invites || []).filter((x) => Boolean(x.submittedAt)).length,
            invites:batch.invites || [],
          }))
        : [],
  }));
  res.json({
    ok: true,
    blinded: true,
    eligibility: "CHECKOUT_COMPLETE_OR_WINDOW_CLOSED",
    noSelfLabeling: req.activaUser.role !== "ADMIN",
    records: safeRows,
  });
});

app.post("/api/ground-truth/:attendanceId/labels", requireRoles("ADMIN", "STAFF"), async (req, res) => {
  const reviewerId = actorId(req);
  if (!reviewerId) return res.status(401).json({ ok: false, error: "X_ACTIVA_USER_ID_REQUIRED" });

  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: req.params.attendanceId },
    include: { activity: true },
  });
  if (!attendance || attendance.isVoided) {
    return res.status(404).json({ ok: false, error: "ATTENDANCE_NOT_FOUND" });
  }
  if (!(await canReviewActivity(req,attendance.activityId))) {
    return res.status(403).json({ok:false,error:"GROUND_TRUTH_REVIEWER_NOT_ASSIGNED_TO_ACTIVITY"});
  }
  // Administrators may manage/resolve Ground Truth, but must not substitute
  // their own label for one of the two independent empirical reviewers.
  if (attendance.activity.dataClassification==="EMPIRICAL" && req.activaUser.role==="ADMIN") {
    return res.status(409).json({ok:false,error:"EMPIRICAL_REQUIRES_INDEPENDENT_REVIEWER"});
  }
  if (attendance.userId === reviewerId) {
    return res.status(409).json({ ok: false, error: "GROUND_TRUTH_SELF_LABEL_FORBIDDEN" });
  }
  if (!attendance.checkoutAt && checkoutWindowState(attendance.activity).code !== "QR_CHECKOUT_CLOSED") {
    return res.status(409).json({
      ok: false,
      error: "GROUND_TRUTH_ATTENDANCE_NOT_MATURE",
      note: "Wait until checkout is complete or the checkout window has closed.",
    });
  }

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

  // Internal and external blinded reviewers must follow the SAME frozen
  // codebook, otherwise identical clinical/operational evidence could produce
  // incompatible reason sets before Ground Truth adjudication.
  const reasonCodes=Array.isArray(b.reasonCodes)
    ? [...new Set(b.reasonCodes.map(String))] : [];
  const invalidCodes=reasonCodes.filter(code=>!BLIND_REVIEW_REASON_CODES.has(code));
  if(invalidCodes.length)return res.status(400).json({ok:false,error:"INVALID_REASON_CODES",invalidCodes});
  const notes=String(b.notes||"").trim();
  if(b.target==="REVIEW_REQUIRED" && !reasonCodes.length)
    return res.status(400).json({ok:false,error:"REVIEW_REASON_REQUIRED"});
  if(reasonCodes.includes("OTHER") && notes.length<3)
    return res.status(400).json({ok:false,error:"OTHER_REASON_REQUIRES_NOTES"});
  if(notes.length>2000)return res.status(400).json({ok:false,error:"NOTES_TOO_LONG"});

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
      reasonCodes,
      notes: notes || null,
    },
    update: {
      target: b.target,
      reasonCodes,
      notes: notes || null,
    },
  });

  await audit(req, "GROUND_TRUTH_LABEL", "AttendanceRecord", req.params.attendanceId, {
    target: b.target,
    reasonCodes,
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

  const attendanceIds = [...new Set(
    logs
      .filter((x) => x.entityType === "AttendanceRecord")
      .map((x) => x.entityId)
      .filter(Boolean)
  )];

  const attendanceRows = attendanceIds.length
    ? await prisma.attendanceRecord.findMany({
        where: { id: { in: attendanceIds } },
        include: {
          user: { select: { employeeId: true, name: true } },
          activity: { select: { id: true, title: true, category: true } },
        },
      })
    : [];

  const attendanceMap = new Map(attendanceRows.map((r) => [r.id, r]));
  const enriched = logs.map((log) => {
    const row = log.entityType === "AttendanceRecord"
      ? attendanceMap.get(log.entityId)
      : null;
    return {
      ...log,
      context: row
        ? {
            participant: {
              employeeId: row.user?.employeeId || "",
              name: row.user?.name || "",
            },
            activity: {
              id: row.activity?.id || "",
              title: row.activity?.title || "",
              category: row.activity?.category || "",
            },
            isVoided: Boolean(row.isVoided),
          }
        : null,
    };
  });

  res.json({ ok: true, logs: enriched });
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

  const labels = await combinedGroundTruthLabels(attendanceId);
  const reviewerCount = new Set(labels.map((x) => x.reviewerKey)).size;
  if (reviewerCount < 2) {
    return res.status(409).json({
      ok: false,
      error: "TWO_INDEPENDENT_LABELS_REQUIRED",
      labelCount: labels.length,
      reviewerCount,
    });
  }

  const labelSignature = (x) => JSON.stringify([
    x.target || "",
    [...new Set(Array.isArray(x.reasonCodes) ? x.reasonCodes.map(String) : [])].sort(),
  ]);
  const signatures = [...new Set(labels.map(labelSignature))];
  if (signatures.length < 2) {
    return res.status(409).json({
      ok: false,
      error: "ADJUDICATION_REQUIRES_DISAGREEMENT",
      labelCount: labels.length,
      reviewerCount,
    });
  }
  if (!String(b.notes || "").trim()) {
    return res.status(400).json({
      ok: false,
      error: "DISAGREEMENT_REQUIRES_ADJUDICATION_NOTES",
    });
  }

  const reasonCodes = Array.isArray(b.reasonCodes)
    ? [...new Set(b.reasonCodes.map(String))]
    : [];

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
    reviewerCount,
    disagreement: true,
  });

  res.json({ ok: true, groundTruthCase, labelCount: labels.length, reviewerCount });
});

app.post("/api/ground-truth/:attendanceId/lock", requireRoles("ADMIN"), async (req, res) => {
  const attendanceId = req.params.attendanceId;
  const labels = await combinedGroundTruthLabels(attendanceId);
  const reviewerCount = new Set(labels.map((x) => x.reviewerKey)).size;
  if (reviewerCount < 2) {
    return res.status(409).json({
      ok: false,
      error: "TWO_INDEPENDENT_LABELS_REQUIRED",
      labelCount: labels.length,
      reviewerCount,
    });
  }

  const labelSignature = (x) => JSON.stringify([
    x.target || "",
    [...new Set(Array.isArray(x.reasonCodes) ? x.reasonCodes.map(String) : [])].sort(),
  ]);
  const signatures = [...new Set(labels.map(labelSignature))];
  const hasDisagreement = signatures.length > 1;
  const current = await prisma.groundTruthCase.findUnique({ where: { attendanceId } });

  let groundTruthCase;
  if (hasDisagreement) {
    if (!current || current.status !== "ADJUDICATED" || !current.finalTarget) {
      return res.status(409).json({ ok: false, error: "ADJUDICATION_REQUIRED_BEFORE_LOCK" });
    }
    groundTruthCase = await prisma.groundTruthCase.update({
      where: { attendanceId },
      data: { status: "LOCKED", lockedAt: new Date() },
    });
  } else {
    const consensus = labels[0];
    const consensusReasonCodes = [...new Set(
      Array.isArray(consensus.reasonCodes) ? consensus.reasonCodes.map(String) : []
    )].sort();

    if (current?.status === "ADJUDICATED" && current.finalTarget) {
      groundTruthCase = await prisma.groundTruthCase.update({
        where: { attendanceId },
        data: { status: "LOCKED", lockedAt: new Date() },
      });
    } else {
      groundTruthCase = await prisma.groundTruthCase.upsert({
        where: { attendanceId },
        create: {
          attendanceId,
          finalTarget: consensus.target,
          reasonCodes: consensusReasonCodes,
          status: "LOCKED",
          adjudicatorId: null,
          notes: "CONSENSUS_DIRECT_LOCK: Independent labels agreed; no adjudication required.",
          adjudicatedAt: null,
          lockedAt: new Date(),
        },
        update: {
          finalTarget: consensus.target,
          reasonCodes: consensusReasonCodes,
          status: "LOCKED",
          adjudicatorId: null,
          notes: "CONSENSUS_DIRECT_LOCK: Independent labels agreed; no adjudication required.",
          adjudicatedAt: null,
          lockedAt: new Date(),
        },
      });
    }
  }

  const lockedAt = groundTruthCase.lockedAt || new Date();
  await prisma.$transaction([
    prisma.blindReviewInvite.updateMany({
      where:{ batch:{ attendanceId }, submittedAt:null, revokedAt:null },
      data:{ revokedAt:lockedAt },
    }),
    prisma.blindReviewBatch.updateMany({
      where:{ attendanceId, status:"OPEN", revokedAt:null },
      data:{ status:"REVOKED", revokedAt:lockedAt },
    }),
  ]);

  await audit(req, "GROUND_TRUTH_LOCKED", "AttendanceRecord", attendanceId, {
    finalTarget: groundTruthCase.finalTarget,
    labelCount: labels.length,
    reviewerCount,
    resolutionMode: hasDisagreement ? "ADJUDICATED" : "CONSENSUS",
  });

  res.json({
    ok: true,
    groundTruthCase,
    resolutionMode: hasDisagreement ? "ADJUDICATED" : "CONSENSUS",
  });
});

// Read-only stage-specific governance readiness: no decision refs or consent hashes exposed.
app.get("/api/research/collection-preflight", requireRoles("ADMIN"), (_req, res) => {
  const gate=empiricalCollectionGate();
  res.json({
    ok:true,collectionEnabled:gate.enabled,studyStage:gate.studyStage,
    blockers:gate.blockers,consentVersion:gate.approvedConsentVersion,
    actualInstitutionalApprovalAuthenticatedBySoftware:false,caution:gate.caution,
  });
});

app.get("/api/ml/readiness", requireRoles("ADMIN"), async (_req, res) => {
  const empiricalAttendance = EMPIRICAL_ATTENDANCE_FILTER;
  const [internalLabelCount, externalLabelCount, adjudicatedCount, adjudicatedEverCount, lockedCount, reviewLocked, noReviewLocked, models] = await Promise.all([
    prisma.groundTruthLabel.count({where:{attendance:empiricalAttendance}}),
    prisma.externalGroundTruthLabel.count({
      where:{ invite:{ batch:{ status:"COMPLETED" } },attendance:empiricalAttendance },
    }),
    prisma.groundTruthCase.count({ where: { status: "ADJUDICATED",attendance:empiricalAttendance } }),
    prisma.groundTruthCase.count({ where: { adjudicatedAt: { not: null },attendance:empiricalAttendance } }),
    prisma.groundTruthCase.count({ where: EMPIRICAL_LOCKED_CASE_FILTER }),
    prisma.groundTruthCase.count({ where: { ...EMPIRICAL_LOCKED_CASE_FILTER,finalTarget:"REVIEW_REQUIRED" } }),
    prisma.groundTruthCase.count({ where: { ...EMPIRICAL_LOCKED_CASE_FILTER,finalTarget:"NO_REVIEW_REQUIRED" } }),
    prisma.modelRun.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, version: true, modelFamily: true, status: true, dataProvenance: true, createdAt: true, approvedAt: true, deployedAt: true },
    }),
  ]);

  const labelCount = internalLabelCount + externalLabelCount;
  const evaluatedModels = models.filter((m) => ["EVALUATED", "APPROVED", "DEPLOYED", "RETIRED"].includes(m.status));
  const approvedModels = models.filter((m) => ["APPROVED", "DEPLOYED", "RETIRED"].includes(m.status));
  const deployedModel = models.find((m) => m.status === "DEPLOYED") || null;
  const empiricalDeployed = Boolean(deployedModel && deployedModel.dataProvenance !== "SYNTHETIC_CI_ONLY");

  res.json({
    ok: true,
    aiEnabled: empiricalDeployed,
    note: empiricalDeployed
      ? "A deployed empirical model is available for decision support only; human review remains final."
      : "AI remains disabled until an evaluated and approved empirical model is deployed.",
    counts: { labelCount, adjudicatedCount, adjudicatedEverCount, lockedCount, reviewLocked, noReviewLocked },
    scope:"EMPIRICAL_ONLY",
    modelReadiness: {
      modelCount: models.length,
      evaluatedCount: evaluatedModels.length,
      approvedCount: approvedModels.length,
      offlineEvaluationPassed: evaluatedModels.length > 0,
      deploymentReviewPassed: empiricalDeployed,
      deployedModel,
      latestModel: models[0] || null,
    },
  });
});

app.get("/api/ml/planning-summary", requireRoles("ADMIN"), async (req, res) => {
  const rawCutoff = String(req.query.lockedBefore || "").trim();
  const cutoff = rawCutoff ? new Date(rawCutoff) : new Date();
  if (Number.isNaN(cutoff.getTime())) {
    return res.status(400).json({ ok:false, error:"INVALID_PLANNING_COHORT_CUTOFF" });
  }

  const cases = await prisma.groundTruthCase.findMany({
    where: {
      ...EMPIRICAL_LOCKED_CASE_FILTER,
      lockedAt: { lte: cutoff },
    },
    include: {
      attendance: {
        include: { activity: true,guestParticipant:{select:{studyHash:true}} },
      },
    },
    orderBy: { lockedAt: "asc" },
  });

  const participants = new Set();
  const events = new Set();
  const activityTypes = new Set();
  let reviewRequired = 0;
  let noReviewRequired = 0;

  for (const c of cases) {
    const r = c.attendance;
    if (!r) continue;
    participants.add(participantGroupingKey(r));
    events.add(r.activityId);
    if (r.activity?.category) activityTypes.add(String(r.activity.category));
    if (c.finalTarget === "REVIEW_REQUIRED") reviewRequired += 1;
    if (c.finalTarget === "NO_REVIEW_REQUIRED") noReviewRequired += 1;
  }

  const lockedCount = reviewRequired + noReviewRequired;
  res.json({
    ok: true,
    planningOnly: true,
    aggregateOnly: true,
    scope:"EMPIRICAL_ONLY",
    directIdentifiersIncluded: false,
    finalTestEligible: false,
    note: "Records included in this planning snapshot must remain development-only after the sample plan is frozen.",
    snapshotCutoffUtc: cutoff.toISOString(),
    counts: {
      lockedCount,
      reviewRequired,
      noReviewRequired,
      anticipatedReviewRequiredPrevalence: lockedCount ? reviewRequired / lockedCount : null,
      uniqueParticipants: participants.size,
      uniqueEvents: events.size,
      activityTypeLevels: activityTypes.size,
    },
    activityTypes: [...activityTypes].sort(),
  });
});

app.get("/api/ml/dataset", requireRoles("ADMIN"), async (_req, res) => {
  const cases = await prisma.groundTruthCase.findMany({
    where: EMPIRICAL_LOCKED_CASE_FILTER,
    include: {
      attendance: {
        include: {
          activity: true,
          staffVerification: true,
          guestParticipant:{select:{studyHash:true}},
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
      participant_hash: participantResearchHash(r),
      event_id: r.activityId,
      activity_type: a.category,
      data_classification:"EMPIRICAL",
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
    dataProvenance:"EMPIRICAL_LOCKED_GROUND_TRUTH",
    scope:"EMPIRICAL_ONLY",
    syntheticDemo:deploymentTier()!=="PRODUCTION",
    aiPredictionsIncluded: false,
    deidentified: true,
    records,
  });
});

app.get("/api/ml/inference-dataset", requireRoles("ADMIN"), async (req, res) => {
  const deployed = await prisma.modelRun.findFirst({
    where: { status: "DEPLOYED" },
    orderBy: { deployedAt: "desc" },
  });

  if (!deployed) {
    return res.json({
      ok: true,
      deployedModel: null,
      deidentified: true,
      groundTruthIncluded: false,
      records: [],
    });
  }

  const includeScored = String(req.query.includeScored || "false") === "true";
  const rows = await prisma.attendanceRecord.findMany({
    where: EMPIRICAL_ATTENDANCE_FILTER,
    include: {
      activity: true,
      staffVerification: true,
      guestParticipant:{select:{studyHash:true}},
      aiPredictions: {
        where: { modelRunId: deployed.id },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const visible = includeScored
    ? rows
    : rows.filter((r) => (r.aiPredictions || []).length === 0);

  res.json({
    ok: true,
    deployedModel: {
      id: deployed.id,
      version: deployed.version,
      modelFamily: deployed.modelFamily,
      status: deployed.status,
    },
    datasetStatus: "LIVE_INFERENCE_FEATURES",
    scope:"EMPIRICAL_ONLY",
    deidentified: true,
    groundTruthIncluded: false,
    alreadyScoredExcluded: !includeScored,
    records: visible.map(inferenceFeatureRow),
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

  const predictedLabel = String(
    b.predictedLabel || (probability >= 0.5 ? "REVIEW_REQUIRED" : "NO_REVIEW_REQUIRED")
  );
  if (!["REVIEW_REQUIRED", "NO_REVIEW_REQUIRED"].includes(predictedLabel)) {
    return res.status(400).json({ ok: false, error: "INVALID_PREDICTED_LABEL" });
  }

  const data = {
    attendanceId: attendance.id,
    modelRunId: model.id,
    modelVersion: model.version,
    predictedLabel,
    riskProbability: probability,
    explanation: b.explanation || null,
  };

  const prediction = await prisma.aIPrediction.upsert({
    where: {
      attendanceId_modelRunId: {
        attendanceId: attendance.id,
        modelRunId: model.id,
      },
    },
    create: data,
    update: data,
  });

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

app.post("/api/predictions/import-batch", requireRoles("ADMIN"), async (req, res) => {
  const b = req.body || {};
  const predictions = Array.isArray(b.predictions) ? b.predictions : [];
  if (!b.modelVersion || predictions.length === 0) {
    return res.status(400).json({ ok: false, error: "MODEL_VERSION_AND_PREDICTIONS_REQUIRED" });
  }
  if (predictions.length > 5000) {
    return res.status(413).json({ ok: false, error: "PREDICTION_BATCH_TOO_LARGE", max: 5000 });
  }

  const model = await prisma.modelRun.findUnique({
    where: { version: String(b.modelVersion) },
  });
  if (!model) return res.status(404).json({ ok: false, error: "MODEL_NOT_FOUND" });
  if (model.status !== "DEPLOYED") {
    return res.status(409).json({ ok: false, error: "ONLY_DEPLOYED_MODEL_PREDICTIONS_CAN_BE_IMPORTED" });
  }

  const ids = [...new Set(predictions.map((p) => String(p.attendanceId || "")).filter(Boolean))];
  const existingRows = await prisma.attendanceRecord.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const validIds = new Set(existingRows.map((r) => r.id));
  const missingIds = ids.filter((id) => !validIds.has(id));
  if (missingIds.length) {
    return res.status(400).json({
      ok: false,
      error: "ATTENDANCE_IDS_NOT_FOUND",
      missingIds,
    });
  }

  const normalized = predictions.map((p, index) => {
    const probability = Number(p.riskProbability);
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new Error("INVALID_RISK_PROBABILITY_AT_INDEX_" + index);
    }
    const label = String(
      p.predictedLabel || (probability >= 0.5 ? "REVIEW_REQUIRED" : "NO_REVIEW_REQUIRED")
    );
    if (!["REVIEW_REQUIRED", "NO_REVIEW_REQUIRED"].includes(label)) {
      throw new Error("INVALID_PREDICTED_LABEL_AT_INDEX_" + index);
    }
    return {
      attendanceId: String(p.attendanceId),
      riskProbability: probability,
      predictedLabel: label,
      explanation: p.explanation || null,
    };
  });

  try {
    await prisma.$transaction(
      normalized.map((p) =>
        prisma.aIPrediction.upsert({
          where: {
            attendanceId_modelRunId: {
              attendanceId: p.attendanceId,
              modelRunId: model.id,
            },
          },
          create: {
            attendanceId: p.attendanceId,
            modelRunId: model.id,
            modelVersion: model.version,
            predictedLabel: p.predictedLabel,
            riskProbability: p.riskProbability,
            explanation: p.explanation,
          },
          update: {
            modelVersion: model.version,
            predictedLabel: p.predictedLabel,
            riskProbability: p.riskProbability,
            explanation: p.explanation,
          },
        })
      )
    );
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }

  await audit(req, "AI_PREDICTION_BATCH_IMPORTED", "ModelRun", model.id, {
    modelVersion: model.version,
    count: normalized.length,
  });

  res.status(201).json({
    ok: true,
    importedCount: normalized.length,
    modelVersion: model.version,
    decisionSupportOnly: true,
    note: "Batch import never changes final attendance/evidence status automatically.",
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
    where: { modelRunId: deployed.id, attendance: { isVoided: false } },
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

  const ranked = predictions.map((prediction, index) => ({
    ...prediction,
    priorityRank: index + 1,
    riskPercent: Math.round(Number(prediction.riskProbability) * 100),
    modelFlaggedForReview: prediction.predictedLabel === "REVIEW_REQUIRED",
  }));

  res.json({
    ok: true,
    deployedModel: deployed,
    decisionSupportOnly: true,
    rankingBasis: "deployed_model_risk_probability_desc",
    records: ranked,
  });
});

app.get("/api/operations/release-gate", requireRoles("ADMIN", "STAFF"), async (_req, res) => {
  const now = new Date();
  const security = releaseSecurityStatus();
  const configuredTarget = Number(process.env.REVIEW_TARGET_HOURS || 24);
  const reviewTargetHours = Number.isFinite(configuredTarget) && configuredTarget > 0 ? configuredTarget : 24;
  const terminal = new Set(["VERIFIED", "OVERRIDE_VERIFIED", "REJECTED"]);

  const [endedActivities, unresolvedRows, recoveryLogs, releaseLogs] = await Promise.all([
    prisma.activity.findMany({
      where: { endAt: { lt: now } },
      select: {
        id: true, title: true, category: true, endAt: true,
        pilotClosedAt: true, pilotClosureHash: true, pilotClosureVersion: true,
      },
      orderBy: { endAt: "desc" },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        isVoided: false,
        OR: [
          { finalEvidenceStatus: null },
          { finalEvidenceStatus: { notIn: ["VERIFIED", "OVERRIDE_VERIFIED", "REJECTED"] } },
        ],
      },
      include: {
        activity: { select: { id: true, endAt: true } },
        consistencyResult: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { action: "BACKUP_RECOVERY_CHECK_PASSED" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.auditLog.findMany({
      where: { action: { in: ["PILOT_RELEASE_GO", "PILOT_RELEASE_HOLD"] } },
      orderBy: { createdAt: "desc" },
      take: 1,
    }),
  ]);

  const activityAssessments = await Promise.all(
    endedActivities.map(async (activity) => {
      if (activity.pilotClosedAt) {
        return {
          ...activity,
          closeReady: true,
          alreadyClosed: true,
          unresolvedCount: 0,
          unevaluatedCount: 0,
          criticalIssues: [],
          checklist: [{ key: "IMMUTABLE_CLOSURE_RECORDED", passed: true }],
        };
      }
      const assessment = await activityCloseAssessment(activity.id);
      return {
        ...activity,
        closeReady: Boolean(assessment?.closeReady),
        alreadyClosed: false,
        unresolvedCount: assessment?.unresolvedCount ?? 0,
        unevaluatedCount: assessment?.unevaluatedCount ?? 0,
        criticalIssues: assessment?.criticalIssues || [],
        checklist: assessment?.checklist || [],
      };
    })
  );

  const criticalIssues = [...new Set(activityAssessments.flatMap((x) => x.criticalIssues || []))];
  const endedNotClosed = activityAssessments.filter((x) => !x.alreadyClosed);

  const backlog = unresolvedRows.map((row) => {
    const activityEnded = new Date(row.activity?.endAt || 0).getTime() < now.getTime();
    if (!row.consistencyResult && !activityEnded) return null;
    const queueStartedAt = row.consistencyResult?.evaluatedAt || row.activity?.endAt || row.createdAt;
    return {
      ageHours: Math.max(0, (now.getTime() - new Date(queueStartedAt).getTime()) / 3600000),
    };
  }).filter(Boolean);
  const overTargetCount = backlog.filter((x) => x.ageHours >= reviewTargetHours).length;

  const recoveryPass = recoveryLogs.find((log) =>
    log.metadata?.backupReleaseVersion === RELEASE_VERSION &&
    log.metadata?.valid === true
  ) || null;
  const recoveryFresh = recoveryPass
    ? (now.getTime() - new Date(recoveryPass.createdAt).getTime()) <= 24 * 3600000
    : false;

  const blockers = [];
  if (deploymentTier() !== "PRODUCTION") blockers.push("PRODUCTION_TIER_REQUIRED");
  if (!productionGoEnabled()) blockers.push("PRODUCTION_GO_DISABLED");
  if (!security.ready) blockers.push("SECURITY_CONFIGURATION_NOT_PRODUCTION_READY");
  if (criticalIssues.length) blockers.push("CRITICAL_DATA_QUALITY");
  if (endedNotClosed.length) blockers.push("ENDED_ACTIVITIES_NOT_IMMUTABLY_CLOSED");
  if (overTargetCount > 0) blockers.push("REVIEW_BACKLOG_OVER_TARGET");
  if (!recoveryFresh) blockers.push("RECENT_BACKUP_RECOVERY_CHECK_REQUIRED");

  const gate = blockers.length ? "HOLD" : "GO";
  const scenarios = [
    {
      id: "DEPLOYMENT_TIER",
      title: "Production GO is available only on the production deployment tier",
      status: deploymentTier() === "PRODUCTION" ? "PASS" : "HOLD",
      evidence: { deploymentTier: deploymentTier(), productionGoEnabled: productionGoEnabled() },
    },
    {
      id: "SECURITY_CONFIG",
      title: "Production signing and research hashing configuration",
      status: security.ready ? "PASS" : "HOLD",
      evidence: {
        qrSigningReady: security.qrSigningReady,
        researchSaltReady: security.researchSaltReady,
        authenticationMode: security.authenticationMode,
        authenticationReady: security.authenticationReady
      },
    },
    {
      id: "HUMAN_FINAL_DECISION",
      title: "Human decision remains final authority",
      status: "PASS",
      evidence: { aiAutonomousDecision: false, humanFinalDecisionRequired: true },
    },
    {
      id: "ACTIVITY_IMMUTABILITY",
      title: "Ended activities are immutably closed before release",
      status: endedNotClosed.length === 0 ? "PASS" : "HOLD",
      evidence: { endedActivityCount: endedActivities.length, notClosedCount: endedNotClosed.length },
    },
    {
      id: "BACKLOG_TARGET",
      title: "Review backlog is within operational target",
      status: overTargetCount === 0 ? "PASS" : "HOLD",
      evidence: { targetHours: reviewTargetHours, overTargetCount },
    },
    {
      id: "DATA_QUALITY",
      title: "No critical operational data-quality issue remains",
      status: criticalIssues.length === 0 ? "PASS" : "HOLD",
      evidence: { criticalIssues },
    },
    {
      id: "BACKUP_RECOVERY",
      title: "Current-release backup has passed recovery verification within 24 hours",
      status: recoveryFresh ? "PASS" : "HOLD",
      evidence: {
        passedAt: recoveryPass?.createdAt || null,
        backupChecksum: recoveryPass?.metadata?.checksum || null,
      },
    },
  ];

  res.json({
    ok: true,
    releaseVersion: RELEASE_VERSION,
    deploymentTier: deploymentTier(),
    productionGoEnabled: productionGoEnabled(),
    gate,
    blockers,
    generatedAt: now.toISOString(),
    containsPII: false,
    security,
    reviewMonitoring: {
      targetHours: reviewTargetHours,
      backlogCount: backlog.length,
      overTargetCount,
    },
    activityClosure: {
      endedActivityCount: endedActivities.length,
      closedCount: activityAssessments.filter((x) => x.alreadyClosed).length,
      notClosedCount: endedNotClosed.length,
      activities: activityAssessments,
    },
    backupRecovery: {
      required: true,
      freshnessHours: 24,
      passed: recoveryFresh,
      lastPassedAt: recoveryPass?.createdAt || null,
    },
    scenarios,
    latestReleaseDecision: releaseLogs[0]
      ? {
          action: releaseLogs[0].action,
          createdAt: releaseLogs[0].createdAt,
          metadata: releaseLogs[0].metadata,
        }
      : null,
    note: "GO/HOLD is a release-process gate. It is not a personnel evaluation and does not make autonomous participation decisions.",
  });
});

app.post("/api/operations/activities/:activityId/close", requireRoles("ADMIN"), async (req, res) => {
  const assessment = await activityCloseAssessment(req.params.activityId);
  if (!assessment) return res.status(404).json({ ok: false, error: "ACTIVITY_NOT_FOUND" });
  if (assessment.activity.pilotClosedAt) {
    return res.json({
      ok: true,
      idempotent: true,
      activityId: assessment.activity.id,
      pilotClosedAt: assessment.activity.pilotClosedAt,
      pilotClosureHash: assessment.activity.pilotClosureHash,
      pilotClosureVersion: assessment.activity.pilotClosureVersion,
    });
  }
  if (!assessment.closeReady) {
    return res.status(409).json({
      ok: false,
      error: "ACTIVITY_NOT_CLOSE_READY",
      checklist: assessment.checklist,
      unevaluatedCount: assessment.unevaluatedCount,
      unresolvedCount: assessment.unresolvedCount,
      criticalIssues: assessment.criticalIssues,
    });
  }

  const note = String(req.body?.reason || "").trim();
  if (note.length < 10) {
    return res.status(400).json({ ok: false, error: "ACTIVITY_CLOSURE_REASON_REQUIRED" });
  }

  const snapshot = {
    releaseVersion: RELEASE_VERSION,
    activityId: assessment.activity.id,
    title: assessment.activity.title,
    category: assessment.activity.category,
    startAt: assessment.activity.startAt,
    endAt: assessment.activity.endAt,
    policy: assessment.activity.policy,
    checklist: assessment.checklist,
    recordCount: assessment.recordCount,
    records: assessment.activity.attendanceRecords.map((row) => ({
      attendanceId: row.id,
      systemEvidenceStatus: row.consistencyResult?.status || null,
      finalEvidenceStatus: row.finalEvidenceStatus || null,
      latestHumanReview: row.humanReviews[0]
        ? {
            reviewId: row.humanReviews[0].id,
            decision: row.humanReviews[0].decision,
            reviewedAt: row.humanReviews[0].reviewedAt,
          }
        : null,
    })),
  };
  const closureHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
  const closedAt = new Date();

  const activity = await prisma.activity.update({
    where: { id: assessment.activity.id },
    data: {
      pilotClosedAt: closedAt,
      pilotClosedById: req.activaUser.id,
      pilotClosureNote: note,
      pilotClosureVersion: RELEASE_VERSION,
      pilotClosureHash: closureHash,
      pilotClosureSnapshot: snapshot,
    },
  });

  await audit(req, "ACTIVITY_PILOT_CLOSED", "Activity", activity.id, {
    releaseVersion: RELEASE_VERSION,
    closureHash,
    note,
    recordCount: assessment.recordCount,
    checklist: assessment.checklist,
  });

  res.status(201).json({
    ok: true,
    immutableOperationalClosure: true,
    activityId: activity.id,
    pilotClosedAt: activity.pilotClosedAt,
    pilotClosureHash: activity.pilotClosureHash,
    pilotClosureVersion: activity.pilotClosureVersion,
  });
});

app.get("/api/operations/backup", requireRoles("ADMIN"), async (req, res) => {
  const backup = await buildOperationalBackup();
  await audit(req, "BACKUP_EXPORTED", "System", RELEASE_VERSION, {
    releaseVersion: RELEASE_VERSION,
    checksum: backup.checksum,
    counts: backup.counts,
    containsPII: true,
    containsSecrets: false,
  });
  res.json({
    ok: true,
    warning: "ADMIN-ONLY backup contains PII. Store it securely. Cryptographic QR credentials are intentionally excluded and must be reissued after disaster recovery.",
    backup,
  });
});

app.post("/api/operations/recovery-check", requireRoles("ADMIN"), async (req, res) => {
  const result = validateOperationalBackup(req.body?.backup);
  await audit(
    req,
    result.valid ? "BACKUP_RECOVERY_CHECK_PASSED" : "BACKUP_RECOVERY_CHECK_FAILED",
    "System",
    RELEASE_VERSION,
    {
      valid: result.valid,
      checksum: result.checksum || req.body?.backup?.checksum || null,
      backupReleaseVersion: req.body?.backup?.releaseVersion || null,
      currentReleaseVersionMatch: Boolean(result.currentReleaseVersionMatch),
      error: result.error || null,
    }
  );
  if (!result.valid) return res.status(422).json({ ok: false, ...result });
  res.json({
    ok: true,
    restorableStructureVerified: true,
    destructiveRestorePerformed: false,
    ...result,
    note: "This check validates backup structure, counts, and checksum. It intentionally does not overwrite the live database.",
  });
});

app.post("/api/operations/release-decision", requireRoles("ADMIN"), async (req, res) => {
  const decision = String(req.body?.decision || "").toUpperCase();
  const reason = String(req.body?.reason || "").trim();
  if (!["GO", "HOLD"].includes(decision)) {
    return res.status(400).json({ ok: false, error: "INVALID_RELEASE_DECISION" });
  }
  if (reason.length < 10) {
    return res.status(400).json({ ok: false, error: "RELEASE_DECISION_REASON_REQUIRED" });
  }

  const now = new Date();
  const security = releaseSecurityStatus();
  const configuredTarget = Number(process.env.REVIEW_TARGET_HOURS || 24);
  const reviewTargetHours = Number.isFinite(configuredTarget) && configuredTarget > 0 ? configuredTarget : 24;

  const [endedActivities, unresolvedRows, recoveryLogs] = await Promise.all([
    prisma.activity.findMany({
      where: { endAt: { lt: now } },
      select: { id: true, pilotClosedAt: true },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        isVoided: false,
        OR: [
          { finalEvidenceStatus: null },
          { finalEvidenceStatus: { notIn: ["VERIFIED", "OVERRIDE_VERIFIED", "REJECTED"] } },
        ],
      },
      include: {
        activity: { select: { endAt: true } },
        consistencyResult: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { action: "BACKUP_RECOVERY_CHECK_PASSED" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const notClosedCount = endedActivities.filter((x) => !x.pilotClosedAt).length;
  const recoveryPass = recoveryLogs.find((log) =>
    log.metadata?.backupReleaseVersion === RELEASE_VERSION &&
    log.metadata?.valid === true &&
    now.getTime() - new Date(log.createdAt).getTime() <= 24 * 3600000
  );

  const backlog = unresolvedRows.map((row) => {
    const activityEnded = new Date(row.activity?.endAt || 0).getTime() < now.getTime();
    if (!row.consistencyResult && !activityEnded) return null;
    const queueStartedAt = row.consistencyResult?.evaluatedAt || row.activity?.endAt || row.createdAt;
    return Math.max(0, (now.getTime() - new Date(queueStartedAt).getTime()) / 3600000);
  }).filter((ageHours) => ageHours !== null);
  const overTargetCount = backlog.filter((ageHours) => ageHours >= reviewTargetHours).length;

  const hardBlockers = [];
  if (deploymentTier() !== "PRODUCTION") hardBlockers.push("PRODUCTION_TIER_REQUIRED");
  if (!productionGoEnabled()) hardBlockers.push("PRODUCTION_GO_DISABLED");
  if (!security.ready) hardBlockers.push("SECURITY_CONFIGURATION_NOT_PRODUCTION_READY");
  if (notClosedCount > 0) hardBlockers.push("ENDED_ACTIVITIES_NOT_IMMUTABLY_CLOSED");
  if (overTargetCount > 0) hardBlockers.push("REVIEW_BACKLOG_OVER_TARGET");
  if (!recoveryPass) hardBlockers.push("RECENT_BACKUP_RECOVERY_CHECK_REQUIRED");

  if (decision === "GO" && hardBlockers.length) {
    return res.status(409).json({
      ok: false,
      error: "RELEASE_GATE_HOLD",
      blockers: hardBlockers,
    });
  }

  const action = decision === "GO" ? "PILOT_RELEASE_GO" : "PILOT_RELEASE_HOLD";
  await audit(req, action, "System", RELEASE_VERSION, {
    releaseVersion: RELEASE_VERSION,
    decision,
    reason,
    blockersAtDecision: hardBlockers,
    security,
    endedActivityCount: endedActivities.length,
    notClosedCount,
    reviewTargetHours,
    overTargetCount,
    recoveryCheckPassedAt: recoveryPass?.createdAt || null,
  });

  res.status(201).json({
    ok: true,
    releaseVersion: RELEASE_VERSION,
    decision,
    reason,
    blockersAtDecision: hardBlockers,
    recordedAt: new Date().toISOString(),
  });
});

app.get("/api/operations/pilot-readiness", requireRoles("ADMIN", "STAFF"), async (_req, res) => {
  const now = new Date();
  const nowMs = now.getTime();
  const configuredTarget = Number(process.env.REVIEW_TARGET_HOURS || 24);
  const reviewTargetHours = Number.isFinite(configuredTarget) && configuredTarget > 0 ? configuredTarget : 24;
  const terminalStatuses = new Set(["VERIFIED", "OVERRIDE_VERIFIED", "REJECTED"]);

  const [rows, activities, deployedModel] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { isVoided: false },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            category: true,
            startAt: true,
            endAt: true,
            checkoutCloseAt: true,
            policy: true,
          },
        },
        consistencyResult: true,
        humanReviews: { orderBy: { reviewedAt: "desc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.activity.findMany({
      include: { policy: true },
      orderBy: { endAt: "desc" },
    }),
    prisma.modelRun.findFirst({
      where: { status: "DEPLOYED" },
      orderBy: { deployedAt: "desc" },
      select: { version: true, modelFamily: true, deployedAt: true },
    }),
  ]);

  const alertMap = new Map();
  const activityCriticalCounts = new Map();
  const addAlert = (code, severity, activityId = null) => {
    const key = severity + "::" + code;
    const current = alertMap.get(key) || { code, severity, count: 0 };
    current.count += 1;
    alertMap.set(key, current);
    if (severity === "CRITICAL" && activityId) {
      activityCriticalCounts.set(activityId, (activityCriticalCounts.get(activityId) || 0) + 1);
    }
  };

  const duplicateMap = new Map();
  rows.forEach((r) => {
    const key = r.activityId + "::" + (r.guestParticipantId || r.userId);
    if (!duplicateMap.has(key)) duplicateMap.set(key, []);
    duplicateMap.get(key).push(r);
  });
  duplicateMap.forEach((group) => {
    if (group.length > 1) addAlert("DUPLICATE_NONVOID_ATTENDANCE", "CRITICAL", group[0].activityId);
  });

  rows.forEach((r) => {
    const latestReview = r.humanReviews[0] || null;
    const blockers = [
      ...(Array.isArray(r.consistencyResult?.missingCodes) ? r.consistencyResult.missingCodes : []),
      ...(Array.isArray(r.consistencyResult?.reasonCodes) ? r.consistencyResult.reasonCodes : []),
    ];
    if (r.checkinAt && r.checkoutAt && new Date(r.checkoutAt) < new Date(r.checkinAt)) {
      addAlert("CHECKOUT_BEFORE_CHECKIN", "CRITICAL", r.activityId);
    }
    if (terminalStatuses.has(r.finalEvidenceStatus) && !latestReview) {
      addAlert("FINAL_STATUS_WITHOUT_HUMAN_REVIEW", "CRITICAL", r.activityId);
    }
    if (r.finalEvidenceStatus === "VERIFIED" &&
        (!r.consistencyResult || r.consistencyResult.status !== "COMPLETE" || blockers.length > 0)) {
      addAlert("NORMAL_VERIFY_WITH_SYSTEM_BLOCKERS", "CRITICAL", r.activityId);
    }
    if (latestReview && String(latestReview.reason || "").trim().length < 3) {
      addAlert("HUMAN_REVIEW_REASON_MISSING", "WARNING", r.activityId);
    }
    const activityEnded = new Date(r.activity?.endAt || 0).getTime() < nowMs;
    if (activityEnded && !terminalStatuses.has(r.finalEvidenceStatus) && !r.consistencyResult) {
      addAlert("ENDED_ACTIVITY_RECORD_NOT_EVALUATED", "WARNING", r.activityId);
    }
  });

  const backlogRows = rows.map((r) => {
    if (terminalStatuses.has(r.finalEvidenceStatus)) return null;
    const activityEnded = new Date(r.activity?.endAt || 0).getTime() < nowMs;
    if (!r.consistencyResult && !activityEnded) return null;
    const queueStartedAt = r.consistencyResult?.evaluatedAt || r.activity?.endAt || r.createdAt;
    const ageHours = Math.max(0, (nowMs - new Date(queueStartedAt).getTime()) / 3600000);
    return {
      activityId: r.activityId,
      queueStartedAt,
      ageHours,
      systemEvidenceStatus: r.consistencyResult?.status || "NOT_EVALUATED",
    };
  }).filter(Boolean);

  const aging = {
    under4h: backlogRows.filter((x) => x.ageHours < 4).length,
    h4to24: backlogRows.filter((x) => x.ageHours >= 4 && x.ageHours < 24).length,
    h24to48: backlogRows.filter((x) => x.ageHours >= 24 && x.ageHours < 48).length,
    over48h: backlogRows.filter((x) => x.ageHours >= 48).length,
  };
  const overTargetCount = backlogRows.filter((x) => x.ageHours >= reviewTargetHours).length;
  const oldestBacklogHours = backlogRows.length
    ? Math.max(...backlogRows.map((x) => x.ageHours))
    : null;

  const activityRows = new Map();
  rows.forEach((r) => {
    if (!activityRows.has(r.activityId)) activityRows.set(r.activityId, []);
    activityRows.get(r.activityId).push(r);
  });

  const endedActivities = activities
    .filter((a) => new Date(a.endAt).getTime() < nowMs)
    .map((a) => {
      const records = activityRows.get(a.id) || [];
      const unevaluatedCount = records.filter((r) => !r.consistencyResult).length;
      const unresolvedCount = records.filter((r) => !terminalStatuses.has(r.finalEvidenceStatus)).length;
      const criticalDataQualityCount = activityCriticalCounts.get(a.id) || 0;
      const checklist = [
        { key: "ACTIVITY_ENDED", passed: true },
        { key: "ALL_RECORDS_EVALUATED", passed: unevaluatedCount === 0 },
        { key: "NO_UNRESOLVED_HUMAN_REVIEW", passed: unresolvedCount === 0 },
        { key: "NO_CRITICAL_DATA_QUALITY", passed: criticalDataQualityCount === 0 },
      ];
      return {
        activityId: a.id,
        title: a.title,
        category: a.category,
        endedAt: a.endAt,
        recordCount: records.length,
        unevaluatedCount,
        unresolvedCount,
        criticalDataQualityCount,
        closeReady: checklist.every((x) => x.passed),
        checklist,
      };
    });

  const alerts = [...alertMap.values()]
    .sort((a, b) =>
      (a.severity === b.severity ? b.count - a.count : a.severity === "CRITICAL" ? -1 : 1) ||
      a.code.localeCompare(b.code)
    );
  const criticalAlertCount = alerts
    .filter((x) => x.severity === "CRITICAL")
    .reduce((sum, x) => sum + x.count, 0);
  const warningAlertCount = alerts
    .filter((x) => x.severity === "WARNING")
    .reduce((sum, x) => sum + x.count, 0);
  const endedNotCloseReadyCount = endedActivities.filter((x) => !x.closeReady).length;

  let pilotStatus = "READY";
  const blockers = [];
  const warnings = [];
  if (criticalAlertCount > 0) {
    pilotStatus = "BLOCKED";
    blockers.push("CRITICAL_DATA_QUALITY");
  }
  if (pilotStatus !== "BLOCKED" && (overTargetCount > 0 || warningAlertCount > 0 || endedNotCloseReadyCount > 0)) {
    pilotStatus = "WATCH";
  }
  if (overTargetCount > 0) warnings.push("REVIEW_BACKLOG_OVER_TARGET");
  if (warningAlertCount > 0) warnings.push("DATA_QUALITY_WARNINGS");
  if (endedNotCloseReadyCount > 0) warnings.push("ENDED_ACTIVITIES_NOT_CLOSE_READY");

  res.json({
    ok: true,
    aggregated: true,
    containsPII: false,
    generatedAt: now.toISOString(),
    pilotStatus,
    blockers,
    warnings,
    governance: {
      humanFinalDecisionRequired: true,
      aiAutonomousDecision: false,
      groundTruthBlindedFromAiDuringLabeling: true,
      analyticsAggregateOnly: true,
      deployedModel: deployedModel || null,
      aiRequiredForPilot: false,
    },
    reviewMonitoring: {
      targetHours: reviewTargetHours,
      targetType: "OPERATIONAL_MONITORING_TARGET_NOT_PERSONNEL_SCORE",
      backlogCount: backlogRows.length,
      overTargetCount,
      oldestBacklogHours,
      aging,
    },
    dataQuality: {
      criticalAlertCount,
      warningAlertCount,
      alerts,
    },
    activityClosing: {
      endedActivityCount: endedActivities.length,
      closeReadyCount: endedActivities.filter((x) => x.closeReady).length,
      notCloseReadyCount: endedNotCloseReadyCount,
      activities: endedActivities,
      note: "closeReady is a checklist result only; V0.9 does not mutate or lock activity records.",
    },
  });
});

app.get("/api/analytics/verified", requireRoles("ADMIN", "STAFF"), async (_req, res) => {
  const deployed = await prisma.modelRun.findFirst({
    where: { status: "DEPLOYED" },
    orderBy: { deployedAt: "desc" },
    select: { id: true, version: true, modelFamily: true, deployedAt: true },
  });

  const rows = await prisma.attendanceRecord.findMany({
    where: { isVoided: false },
    include: {
      activity: { select: { id: true, title: true, category: true, dataClassification:true, startAt: true, endAt: true } },
      consistencyResult: true,
      humanReviews: { orderBy: { reviewedAt: "desc" } },
      groundTruthCase: true,
      guestParticipant:{select:{consentAt:true,withdrawnAt:true,revokedAt:true}},
      groundTruthLabels: true,
      externalGroundTruthLabels: {
        where:{ invite:{ batch:{ status:"COMPLETED" } } },
      },
      aiPredictions: deployed
        ? { where: { modelRunId: deployed.id }, take: 1 }
        : { where: { id: "__NO_DEPLOYED_MODEL__" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  const terminalStatuses = new Set(["VERIFIED", "OVERRIDE_VERIFIED", "REJECTED"]);
  const finalizedRows = rows.filter((r) => terminalStatuses.has(r.finalEvidenceStatus));
  const unresolvedRows = rows.filter((r) => !terminalStatuses.has(r.finalEvidenceStatus));

  const verifiedCount = finalizedRows.filter((r) =>
    ["VERIFIED", "OVERRIDE_VERIFIED"].includes(r.finalEvidenceStatus)
  ).length;
  const overrideVerifiedCount = finalizedRows.filter((r) => r.finalEvidenceStatus === "OVERRIDE_VERIFIED").length;
  const rejectedCount = finalizedRows.filter((r) => r.finalEvidenceStatus === "REJECTED").length;

  const reviewDurations = finalizedRows
    .map((r) => r.humanReviews[0]?.reviewDurationSeconds)
    .filter((x) => Number.isFinite(Number(x)) && Number(x) >= 0)
    .map(Number);

  const resolutionHours = finalizedRows
    .map((r) => {
      const reviewedAt = r.humanReviews[0]?.reviewedAt;
      if (!reviewedAt) return null;
      const delta = new Date(reviewedAt).getTime() - new Date(r.createdAt).getTime();
      return delta >= 0 ? delta / 3600000 : null;
    })
    .filter((x) => x !== null && Number.isFinite(x));

  const mean = (values) => values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

  const exceptionCounts = new Map();
  finalizedRows.forEach((r) => {
    const codes = [
      ...(Array.isArray(r.consistencyResult?.missingCodes) ? r.consistencyResult.missingCodes : []),
      ...(Array.isArray(r.consistencyResult?.reasonCodes) ? r.consistencyResult.reasonCodes : []),
    ];
    [...new Set(codes.map(String))].forEach((code) => {
      exceptionCounts.set(code, (exceptionCounts.get(code) || 0) + 1);
    });
  });

  const activityMap = new Map();
  rows.forEach((r) => {
    const key = r.activityId;
    if (!activityMap.has(key)) {
      activityMap.set(key, {
        activityId: key,
        title: r.activity?.title || "",
        category: r.activity?.category || "",
        recordCount: 0,
        finalizedCount: 0,
        verifiedCount: 0,
        overrideVerifiedCount: 0,
        rejectedCount: 0,
        unresolvedCount: 0,
      });
    }
    const item = activityMap.get(key);
    item.recordCount += 1;
    if (terminalStatuses.has(r.finalEvidenceStatus)) item.finalizedCount += 1;
    else item.unresolvedCount += 1;
    if (["VERIFIED", "OVERRIDE_VERIFIED"].includes(r.finalEvidenceStatus)) item.verifiedCount += 1;
    if (r.finalEvidenceStatus === "OVERRIDE_VERIFIED") item.overrideVerifiedCount += 1;
    if (r.finalEvidenceStatus === "REJECTED") item.rejectedCount += 1;
  });

  const byActivity = [...activityMap.values()]
    .map((x) => ({
      ...x,
      finalizationRate: x.recordCount ? x.finalizedCount / x.recordCount : 0,
      verifiedOutcomeRate: x.finalizedCount ? x.verifiedCount / x.finalizedCount : null,
    }))
    .sort((a, b) => b.recordCount - a.recordCount || a.title.localeCompare(b.title));

  // Research-only aggregates must use the same versioned-consent eligibility
  // as /api/ml/dataset and /api/research/export, not merely activity class.
  const researchRows = rows.filter((r) => r.activity?.dataClassification === "EMPIRICAL" &&
    Boolean(r.guestParticipantId && r.guestParticipant?.consentAt &&
      !r.guestParticipant?.withdrawnAt && !r.guestParticipant?.revokedAt));
  const lockedRows = researchRows.filter((r) =>
    r.groundTruthCase?.status === "LOCKED" && r.groundTruthCase?.finalTarget
  );
  const comparable = lockedRows.filter((r) => r.aiPredictions[0]);
  let tp = 0, fp = 0, tn = 0, fn = 0, agreementCount = 0;
  comparable.forEach((r) => {
    const actual = r.groundTruthCase.finalTarget;
    const predicted = r.aiPredictions[0].predictedLabel;
    if (actual === predicted) agreementCount += 1;
    if (actual === "REVIEW_REQUIRED" && predicted === "REVIEW_REQUIRED") tp += 1;
    else if (actual === "NO_REVIEW_REQUIRED" && predicted === "REVIEW_REQUIRED") fp += 1;
    else if (actual === "NO_REVIEW_REQUIRED" && predicted === "NO_REVIEW_REQUIRED") tn += 1;
    else if (actual === "REVIEW_REQUIRED" && predicted === "NO_REVIEW_REQUIRED") fn += 1;
  });

  const researchLabels = (r) => [
    ...(r.groundTruthLabels || []),
    ...(r.externalGroundTruthLabels || []),
  ];
  const doubleLabeled = researchRows.filter((r) => researchLabels(r).length >= 2);
  const reviewerAgreementCount = doubleLabeled.filter((r) => {
    const targets = [...new Set(researchLabels(r).map((x) => x.target))];
    return targets.length === 1;
  }).length;

  res.json({
    ok: true,
    aggregated: true,
    containsPII: false,
    scope: "ORGANIZATION",
    generatedAt: new Date().toISOString(),
    operational: {
      recordCount: rows.length,
      finalizedCount: finalizedRows.length,
      unresolvedCount: unresolvedRows.length,
      verifiedCount,
      overrideVerifiedCount,
      rejectedCount,
      finalizationRate: rows.length ? finalizedRows.length / rows.length : 0,
      verifiedOutcomeRate: finalizedRows.length ? verifiedCount / finalizedRows.length : null,
      averageReviewDurationSeconds: mean(reviewDurations),
      averageResolutionHours: mean(resolutionHours),
      turnaroundDefinition: "attendance_record_created_at_to_latest_terminal_human_review",
      exceptionPatterns: [...exceptionCounts.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
      byActivity,
    },
    researchSnapshot: {
      separatedFromOperationalOutcomes: true,
      scope:"EMPIRICAL_ONLY",
      includedRecords:researchRows.length,
      deployedModel: deployed,
      lockedGroundTruthCount: lockedRows.length,
      comparableModelGroundTruthCount: comparable.length,
      modelGroundTruthAgreementCount: agreementCount,
      modelGroundTruthAgreementRate: comparable.length ? agreementCount / comparable.length : null,
      confusionMatrix: { tp, fp, tn, fn },
      doubleLabeledCaseCount: doubleLabeled.length,
      reviewerAgreementCount,
      reviewerAgreementRate: doubleLabeled.length ? reviewerAgreementCount / doubleLabeled.length : null,
      note: "Research metrics compare deployed-model predictions with locked ground truth; they are not personnel performance scores.",
    },
  });
});

app.get("/api/research/export", requireRoles("ADMIN"), async (_req, res) => {
  const rows = await prisma.attendanceRecord.findMany({
    where: EMPIRICAL_ATTENDANCE_FILTER,
    include: {
      activity: true,
      staffVerification: true,
      guestParticipant:{select:{studyHash:true}},
      consistencyResult: true,
      humanReviews: { orderBy: { reviewedAt: "desc" }, take: 1 },
      groundTruthLabels: true,
      externalGroundTruthLabels: {
        where:{ invite:{ batch:{ status:"COMPLETED" } } },
      },
      aiPredictions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const dataset = rows.map((r) => ({
    record_id: r.id,
    participant_hash: participantResearchHash(r),
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
    ground_truth_labels: [
      ...(r.groundTruthLabels || []).map((g) => g.target),
      ...(r.externalGroundTruthLabels || []).map((g) => g.target),
    ],
    final_status: r.finalEvidenceStatus || r.consistencyResult?.status || "",
  }));

  res.json({
    ok: true,
    scope:"EMPIRICAL_ONLY",
    excludedClasses:["UNCLASSIFIED","QA_TEST"],
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
// Only public browser assets may be served. Never serve server, prisma,
// scripts, dependency, backup, or environment files from the application tree.
const publicFiles = ["index.html", "Login.html", "app.js", "demo-api.js", "runtime-config.js", "styles.css", "blind-review.html", "blind-review.js", "guest.html", "guest.js"];
for (const file of publicFiles) {
  app.get("/" + file, (_req, res) => {
    if (["runtime-config.js","blind-review.html","blind-review.js","guest.html","guest.js"].includes(file)) {
      res.set("Cache-Control", "no-store");
    }
    res.sendFile(path.join(staticDir, file));
  });
}
app.get("/", (_req, res) => res.sendFile(path.join(staticDir, "index.html")));
app.get("/blind-review", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(staticDir, "blind-review.html"));
});
app.get("/guest", (_req,res) => {
  res.set("Cache-Control","no-store");
  res.sendFile(path.join(staticDir,"guest.html"));
});
app.use((_req, res) => res.status(404).json({ ok: false, error: "NOT_FOUND" }));

app.use((error, _req, res, _next) => {
  console.error("Request failed:", error?.name || "Error");
  const status=Number(error?.status)||500;
  const code=error?.message==="CORS_ORIGIN_NOT_ALLOWED" ? "CORS_ORIGIN_NOT_ALLOWED" : "INTERNAL_SERVER_ERROR";
  res.status(status).json({ ok:false, error:code });
});

const server = app.listen(port, () => {
  console.log("ACTIVA-AI V1.0.15 server running on http://localhost:" + port);
});

// Bound idle/header/request lifetimes so a production instance does not keep
// incomplete HTTP connections open indefinitely.
server.keepAliveTimeout = 5000;
server.headersTimeout = 35000;
server.requestTimeout = 30000;

let shutdownStarted = false;
async function gracefulShutdown(signal) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  console.log("ACTIVA-AI graceful shutdown:", signal);
  const forceTimer = setTimeout(() => {
    console.error("ACTIVA-AI forced shutdown after timeout");
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  server.close(async () => {
    try {
      await prisma.$disconnect();
      clearTimeout(forceTimer);
      process.exit(0);
    } catch {
      process.exit(1);
    }
  });
}
process.on("SIGTERM", () => { void gracefulShutdown("SIGTERM"); });
process.on("SIGINT", () => { void gracefulShutdown("SIGINT"); });
