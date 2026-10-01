import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const EXPECTED_MIGRATIONS = [
  "20260926000000_initial_baseline",
  "20260927170000_participant_response_workflow",
  "20260928094500_position_role_separation",
  "20261001110000_external_blind_reviewer_sessions",
  "20261001133000_activity_research_classification",
  "20261001150000_guest_participation",
];

const EXPECTED_TABLES = [
  "_prisma_migrations",
  "User",
  "Activity",
  "AttendanceRecord",
  "BlindReviewBatch",
  "BlindReviewInvite",
  "ExternalGroundTruthLabel",
  "GuestParticipant",
  "AuditLog",
];

function databaseNameFromUrl(url) {
  return decodeURIComponent(url.pathname.replace(/^\//, "").split("/")[0] || "");
}

export function neonTargetIdentity(raw) {
  const url = new URL(String(raw || "").trim());
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("RECOVERY_DATABASE_URL_MUST_BE_POSTGRESQL");
  }
  if (!url.hostname.endsWith(".neon.tech")) {
    throw new Error("RECOVERY_DATABASE_MUST_BE_NEON");
  }
  const database = databaseNameFromUrl(url);
  if (!database) throw new Error("RECOVERY_DATABASE_NAME_MISSING");
  return {
    hostname: url.hostname.toLowerCase(),
    database,
  };
}

export function assertIsolatedRecoveryTarget(recoveryRaw, productionRaw) {
  const recovery = neonTargetIdentity(recoveryRaw);
  const production = neonTargetIdentity(productionRaw);
  if (recovery.hostname === production.hostname && recovery.database === production.database) {
    throw new Error("RECOVERY_TARGET_MATCHES_PRODUCTION");
  }
  return { recovery, production };
}

export function parseRecoveryPoint(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("RECOVERY_POINT_UTC_REQUIRED");
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error("RECOVERY_POINT_UTC_INVALID");
  if (date.getTime() > Date.now() + 60_000) throw new Error("RECOVERY_POINT_UTC_IN_FUTURE");
  return date;
}

async function verifyRecoveryDatabase({
  recoveryUrl = process.env.ACTIVA_RECOVERY_DATABASE_URL,
  productionUrl = process.env.ACTIVA_PRODUCTION_DATABASE_URL,
  recoveryPoint = process.env.ACTIVA_RECOVERY_POINT_UTC,
} = {}) {
  if (!recoveryUrl) throw new Error("ACTIVA_RECOVERY_DATABASE_URL secret is missing");
  if (!productionUrl) throw new Error("ACTIVA_PRODUCTION_DATABASE_URL secret is missing");

  const targets = assertIsolatedRecoveryTarget(recoveryUrl, productionUrl);
  const point = parseRecoveryPoint(recoveryPoint);
  process.env.DATABASE_URL = recoveryUrl;

  const prisma = new PrismaClient();
  try {
    const dbRows = await prisma.$queryRawUnsafe("SELECT current_database() AS database");
    const currentDatabase = String(dbRows?.[0]?.database || "");
    if (currentDatabase !== targets.recovery.database) {
      throw new Error("RECOVERY_DATABASE_NAME_MISMATCH");
    }

    const tableRows = await prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
    );
    const tables = tableRows.map((row) => row.table_name).filter(Boolean);
    const missingTables = EXPECTED_TABLES.filter((name) => !tables.includes(name));
    if (missingTables.length) {
      throw new Error("RECOVERY_SCHEMA_MISSING_TABLES:" + missingTables.join(","));
    }

    const migrationRows = await prisma.$queryRawUnsafe(
      'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name'
    );
    const migrations = migrationRows.map((row) => row.migration_name);
    if (JSON.stringify(migrations) !== JSON.stringify(EXPECTED_MIGRATIONS)) {
      throw new Error("RECOVERY_MIGRATION_SET_MISMATCH");
    }

    const [
      activeAdminCount,
      userCount,
      activityCount,
      attendanceCount,
      auditCount,
      bootstrapCount,
      backupRecoveryCount,
      releaseGoCount,
      releaseHoldCount,
      latestAudit,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.activity.count(),
      prisma.attendanceRecord.count(),
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { action: "ADMIN_BOOTSTRAPPED" } }),
      prisma.auditLog.count({ where: { action: "BACKUP_RECOVERY_CHECK_PASSED" } }),
      prisma.auditLog.count({ where: { action: "PILOT_RELEASE_GO" } }),
      prisma.auditLog.count({ where: { action: "PILOT_RELEASE_HOLD" } }),
      prisma.auditLog.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, action: true },
      }),
    ]);

    if (activeAdminCount !== 1) {
      throw new Error("RECOVERY_EXPECTED_EXACTLY_ONE_ACTIVE_ADMIN");
    }
    if (bootstrapCount < 1) {
      throw new Error("RECOVERY_ADMIN_BOOTSTRAP_AUDIT_MISSING");
    }

    const latestAuditAt = latestAudit?.createdAt ? new Date(latestAudit.createdAt) : null;
    const toleranceMs = 5 * 60 * 1000;
    if (latestAuditAt && latestAuditAt.getTime() > point.getTime() + toleranceMs) {
      throw new Error("RECOVERY_CONTAINS_AUDIT_DATA_AFTER_REQUESTED_POINT");
    }

    return {
      ok: true,
      verifiedAt: new Date().toISOString(),
      recoveryPointUtc: point.toISOString(),
      isolation: {
        productionTargetQueried: false,
        recoveryHostDiffersFromProduction: targets.recovery.hostname !== targets.production.hostname,
        recoveryDatabaseDiffersFromProduction: targets.recovery.database !== targets.production.database,
      },
      schema: {
        migrationCount: migrations.length,
        migrations,
        publicTableCount: tables.length,
      },
      counts: {
        users: userCount,
        activities: activityCount,
        attendance: attendanceCount,
        auditLogs: auditCount,
      },
      governanceMarkers: {
        activeAdminCount,
        adminBootstrapped: bootstrapCount,
        backupRecoveryPassed: backupRecoveryCount,
        productionGo: releaseGoCount,
        productionHold: releaseHoldCount,
        latestAuditAction: latestAudit?.action || null,
        latestAuditAt: latestAuditAt?.toISOString() || null,
      },
      containsPII: false,
      note: "Read-only verification of an isolated Neon recovery target. No production mutation performed.",
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  try {
    const result = await verifyRecoveryDatabase();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      verifiedAt: new Date().toISOString(),
      error: error?.name || "Error",
      message: String(error?.message || "Recovery verification failed"),
    }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
