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
    actualMinutes === null ? null : actualMinutes / scheduledMinutes;
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
  };
}

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    res.json({ ok: true, version: "0.5.5", database: "connected", ai: "disabled-until-ground-truth" });
  } catch (error) {
    res.status(503).json({ ok: false, version: "0.5.5", database: "unavailable", error: error.message });
  }
});


app.use("/api", attachActor);

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
      role: req.activaUser.role,
      status: req.activaUser.status,
      activityPermissions,
      activityAssignments,
    },
  });
});

app.get("/api/users", personnelDirectoryGuard, async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      employeeId: true,
      name: true,
      email: true,
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
    data:{employeeId,name,email,role,status:"ACTIVE",departmentId:department?.id||null},
    include:{department:{select:{code:true,name:true}}},
  });
  await audit(req,"USER_CREATED","User",user.id,{employeeId,role,department:department?.name||null});
  res.status(201).json({ok:true,user});
});

app.patch("/api/users/:userId", requireRoles("ADMIN"), async (req,res)=>{
  const current=await prisma.user.findUnique({where:{id:req.params.userId}});
  if(!current) return res.status(404).json({ok:false,error:"USER_NOT_FOUND"});
  const b=req.body||{};
  const name=String(b.name||current.name).trim();
  const email=String(b.email||"").trim()||null;
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
    data:{name,email,role,departmentId:department?.id||null},
    include:{department:{select:{code:true,name:true}}},
  });
  await audit(req,"USER_UPDATED","User",user.id,{employeeId:user.employeeId,role,department:department?.name||null});
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
        data:{employeeId,name,email,role,status:"ACTIVE",departmentId:department?.id||null},
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
    });
    res.status(201).json({ ok: true, activity });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
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

app.put("/api/activities/:activityId/assignments", async (req, res) => {
  const activity = await prisma.activity.findUnique({ where:{id:req.params.activityId} });
  if (!activity) return res.status(404).json({ok:false,error:"ACTIVITY_NOT_FOUND"});

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
  if (!(await canManageActivity(req, activity))) {
    return res.status(403).json({ ok: false, error: "ACTIVITY_MANAGEMENT_FORBIDDEN" });
  }

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

  if (req.activaUser.role === "PARTICIPANT" && req.activaUser.id !== user.id) {
    return res.status(403).json({ ok: false, error: "PARTICIPANT_CAN_ONLY_CHECKIN_SELF" });
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
  if (current.isVoided) return res.status(409).json({ ok: false, error: "ATTENDANCE_VOIDED" });
  if (req.activaUser.role === "PARTICIPANT" && current.userId !== req.activaUser.id) {
    return res.status(403).json({ ok: false, error: "PARTICIPANT_CAN_ONLY_CHECKOUT_SELF" });
  }
  if (!current.checkinAt) return res.status(409).json({ ok: false, error: "CHECKIN_REQUIRED" });
  if (current.checkoutAt) return res.status(409).json({
    ok: false,
    error: "ALREADY_CHECKED_OUT",
    attendanceId: current.id,
    checkoutAt: current.checkoutAt,
  });

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
      finalEvidenceStatus: null,
    },
  });

  if (current.finalEvidenceStatus) {
    await audit(req, "FINAL_DECISION_INVALIDATED", "AttendanceRecord", row.id, {
      previousFinal: current.finalEvidenceStatus,
      reason: "CHECKOUT_CHANGED",
    });
  }
  await audit(req, "CHECKOUT", "AttendanceRecord", row.id, { durationMinutes, attendancePercentage });
  res.json({ ok: true, attendance: row });
});

app.post("/api/attendance/:attendanceId/staff-verify", requireRoles("ADMIN", "ORGANIZER", "STAFF"), async (req, res) => {
  const verifierId = actorId(req);
  if (!verifierId) return res.status(401).json({ ok: false, error: "X_ACTIVA_USER_ID_REQUIRED" });

  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: req.params.attendanceId },
    include: { staffVerification: true },
  });
  if (!attendance) return res.status(404).json({ ok: false, error: "ATTENDANCE_NOT_FOUND" });
  if (attendance.isVoided) return res.status(409).json({ ok: false, error: "ATTENDANCE_VOIDED" });
  if (attendance.staffVerification) {
    return res.json({ ok: true, verification: attendance.staffVerification, idempotent: true });
  }

  const row = await prisma.$transaction(async (tx) => {
    const verification = await tx.staffVerification.create({
      data: { attendanceId: attendance.id, verifierId, status: "VERIFIED_PRESENT" },
    });
    await tx.attendanceRecord.update({
      where: { id: attendance.id },
      data: { finalEvidenceStatus: null },
    });
    return verification;
  });

  if (attendance.finalEvidenceStatus) {
    await audit(req, "FINAL_DECISION_INVALIDATED", "AttendanceRecord", attendance.id, {
      previousFinal: attendance.finalEvidenceStatus,
      reason: "STAFF_VERIFICATION_CHANGED",
    });
  }
  await audit(req, "STAFF_VERIFIED", "AttendanceRecord", attendance.id, { verifierId });
  res.json({ ok: true, verification: row });
});

app.post("/api/attendance/:attendanceId/void", requireRoles("ADMIN", "STAFF"), async (req, res) => {
  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: req.params.attendanceId },
    include: { groundTruthCase: true },
  });
  if (!attendance) return res.status(404).json({ ok: false, error: "ATTENDANCE_NOT_FOUND" });
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
    },
  });
  if (!attendance) return res.status(404).json({ ok: false, error: "ATTENDANCE_NOT_FOUND" });
  if (attendance.isVoided) return res.status(409).json({ ok: false, error: "ATTENDANCE_VOIDED" });
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

  res.json({
    ok: true,
    result: stored,
    finalDecisionInvalidated:
      attendance.finalEvidenceStatus === "VERIFIED" && stored.status !== "COMPLETE",
    note: "Rule-based result; not AI risk probability.",
  });
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
    if (req.activaUser.role !== "ADMIN") {
      return res.status(403).json({ ok: false, error: "ADMIN_ONLY_MANUAL_OVERRIDE" });
    }
    if (blockers.length === 0) {
      return res.status(409).json({ ok: false, error: "OVERRIDE_NOT_NEEDED" });
    }
    if (reason.length < 10) {
      return res.status(400).json({ ok: false, error: "OVERRIDE_REASON_REQUIRED" });
    }
  }

  if (["CORRECT", "REQUEST_EVIDENCE", "REJECT"].includes(b.decision) && reason.length < 3) {
    return res.status(400).json({ ok: false, error: "REVIEW_REASON_REQUIRED" });
  }

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
    { decision: b.decision, reason, blockers }
  );

  res.status(201).json({
    ok: true,
    review,
    finalEvidenceStatus,
    systemEvidenceStatus: attendance.consistencyResult.status,
    blockers,
  });
});

app.get("/api/ground-truth/queue", requireRoles("ADMIN", "STAFF"), async (req, res) => {
  const rows = await prisma.attendanceRecord.findMany({
    where: { isVoided: false },
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
    where: { isVoided: false },
    include: {
      activity: true,
      staffVerification: true,
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

  res.json({
    ok: true,
    deployedModel: deployed,
    decisionSupportOnly: true,
    records: predictions,
  });
});

app.get("/api/research/export", requireRoles("ADMIN"), async (_req, res) => {
  const rows = await prisma.attendanceRecord.findMany({
    where: { isVoided: false },
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
  console.log("ACTIVA-AI V0.3.3 server running on http://localhost:" + port);
});
