-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ORGANIZER', 'STAFF', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "ActivityPermissionKey" AS ENUM ('CAN_CREATE_ACTIVITY', 'CAN_EDIT_OWN_ACTIVITY', 'CAN_ASSIGN_CO_ORGANIZER', 'CAN_ASSIGN_VERIFIER', 'CAN_CLOSE_ACTIVITY', 'CAN_MANAGE_ALL_ACTIVITIES');

-- CreateEnum
CREATE TYPE "ActivityAssignmentRole" AS ENUM ('CO_ORGANIZER', 'VERIFIER');

-- CreateEnum
CREATE TYPE "ParticipationMode" AS ENUM ('OPEN', 'ROSTER', 'GROUP');

-- CreateEnum
CREATE TYPE "ActivityParticipantStatus" AS ENUM ('INVITED', 'REGISTERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('REGISTERED', 'CHECKED_IN', 'CHECKED_OUT', 'LATE', 'EARLY_LEAVE');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('COMPLETE', 'INCOMPLETE', 'CONSISTENT', 'INCONSISTENT', 'REVIEW_REQUIRED', 'VERIFIED', 'OVERRIDE_VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HumanDecision" AS ENUM ('VERIFY', 'OVERRIDE_VERIFY', 'CORRECT', 'REQUEST_EVIDENCE', 'REJECT');

-- CreateEnum
CREATE TYPE "GroundTruthTarget" AS ENUM ('REVIEW_REQUIRED', 'NO_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "GroundTruthCaseStatus" AS ENUM ('OPEN', 'ADJUDICATED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ModelRunStatus" AS ENUM ('CANDIDATE', 'EVALUATED', 'APPROVED', 'DEPLOYED', 'RETIRED');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PARTICIPANT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivityPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "ActivityPermissionKey" NOT NULL,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "reason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserActivityPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalQrCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalQrCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "checkinOpenAt" TIMESTAMP(3),
    "checkinCloseAt" TIMESTAMP(3),
    "checkoutOpenAt" TIMESTAMP(3),
    "checkoutCloseAt" TIMESTAMP(3),
    "organizerId" TEXT,
    "participationMode" "ParticipationMode" NOT NULL DEFAULT 'OPEN',
    "allowedDepartmentCodes" JSONB,
    "assignmentsUpdatedAt" TIMESTAMP(3),
    "pilotClosedAt" TIMESTAMP(3),
    "pilotClosedById" TEXT,
    "pilotClosureNote" TEXT,
    "pilotClosureVersion" TEXT,
    "pilotClosureHash" TEXT,
    "pilotClosureSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityRoleAssignment" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ActivityAssignmentRole" NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityParticipant" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ActivityParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityPolicy" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "qrRequired" BOOLEAN NOT NULL DEFAULT true,
    "identityRequired" BOOLEAN NOT NULL DEFAULT true,
    "checkinRequired" BOOLEAN NOT NULL DEFAULT true,
    "checkoutRequired" BOOLEAN NOT NULL DEFAULT true,
    "durationRequired" BOOLEAN NOT NULL DEFAULT true,
    "staffRequired" BOOLEAN NOT NULL DEFAULT true,
    "signatureRequired" BOOLEAN NOT NULL DEFAULT false,
    "minDurationRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrToken" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkinAt" TIMESTAMP(3),
    "checkoutAt" TIMESTAMP(3),
    "checkoutQrValid" BOOLEAN NOT NULL DEFAULT false,
    "checkoutMethod" TEXT,
    "checkoutExceptionReason" TEXT,
    "durationMinutes" INTEGER,
    "attendancePercentage" DOUBLE PRECISION,
    "attendanceStatus" "AttendanceStatus" NOT NULL DEFAULT 'REGISTERED',
    "qrValid" BOOLEAN NOT NULL DEFAULT false,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "scanAttempts" INTEGER NOT NULL DEFAULT 0,
    "finalEvidenceStatus" "EvidenceStatus",
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffVerification" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "verifierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VERIFIED_PRESENT',
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsistencyResult" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "status" "EvidenceStatus" NOT NULL,
    "completenessRatio" DOUBLE PRECISION NOT NULL,
    "missingCodes" JSONB NOT NULL,
    "reasonCodes" JSONB NOT NULL,
    "durationRatio" DOUBLE PRECISION,
    "ruleVersion" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsistencyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanReview" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "HumanDecision" NOT NULL,
    "reason" TEXT,
    "reviewStartedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewDurationSeconds" INTEGER,

    CONSTRAINT "HumanReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroundTruthLabel" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "target" "GroundTruthTarget" NOT NULL,
    "reasonCodes" JSONB NOT NULL,
    "notes" TEXT,
    "adjudicated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroundTruthLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroundTruthCase" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "finalTarget" "GroundTruthTarget",
    "reasonCodes" JSONB NOT NULL,
    "status" "GroundTruthCaseStatus" NOT NULL DEFAULT 'OPEN',
    "adjudicatorId" TEXT,
    "notes" TEXT,
    "adjudicatedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroundTruthCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelRun" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "modelFamily" TEXT NOT NULL,
    "status" "ModelRunStatus" NOT NULL DEFAULT 'CANDIDATE',
    "dataProvenance" TEXT NOT NULL,
    "selectedMetric" TEXT,
    "selectedMetricValue" DOUBLE PRECISION,
    "validationMetrics" JSONB NOT NULL,
    "testMetrics" JSONB,
    "calibration" JSONB,
    "explainability" JSONB,
    "notes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "deployedBy" TEXT,
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIPrediction" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "modelRunId" TEXT,
    "modelVersion" TEXT NOT NULL,
    "predictedLabel" TEXT NOT NULL,
    "riskProbability" DOUBLE PRECISION NOT NULL,
    "explanation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserActivityPermission_userId_revokedAt_idx" ON "UserActivityPermission"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "UserActivityPermission_permission_revokedAt_idx" ON "UserActivityPermission"("permission", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserActivityPermission_userId_permission_key" ON "UserActivityPermission"("userId", "permission");

-- CreateIndex
CREATE INDEX "PersonalQrCredential_userId_revokedAt_idx" ON "PersonalQrCredential"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "ActivityRoleAssignment_activityId_role_idx" ON "ActivityRoleAssignment"("activityId", "role");

-- CreateIndex
CREATE INDEX "ActivityRoleAssignment_userId_role_idx" ON "ActivityRoleAssignment"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityRoleAssignment_activityId_userId_role_key" ON "ActivityRoleAssignment"("activityId", "userId", "role");

-- CreateIndex
CREATE INDEX "ActivityParticipant_activityId_status_idx" ON "ActivityParticipant"("activityId", "status");

-- CreateIndex
CREATE INDEX "ActivityParticipant_userId_status_idx" ON "ActivityParticipant"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityParticipant_activityId_userId_key" ON "ActivityParticipant"("activityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityPolicy_activityId_key" ON "ActivityPolicy"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "QrToken_tokenHash_key" ON "QrToken"("tokenHash");

-- CreateIndex
CREATE INDEX "QrToken_activityId_expiresAt_idx" ON "QrToken"("activityId", "expiresAt");

-- CreateIndex
CREATE INDEX "AttendanceRecord_activityId_userId_idx" ON "AttendanceRecord"("activityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffVerification_attendanceId_key" ON "StaffVerification"("attendanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsistencyResult_attendanceId_key" ON "ConsistencyResult"("attendanceId");

-- CreateIndex
CREATE INDEX "HumanReview_attendanceId_reviewedAt_idx" ON "HumanReview"("attendanceId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroundTruthLabel_attendanceId_reviewerId_key" ON "GroundTruthLabel"("attendanceId", "reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "GroundTruthCase_attendanceId_key" ON "GroundTruthCase"("attendanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelRun_version_key" ON "ModelRun"("version");

-- CreateIndex
CREATE INDEX "AIPrediction_attendanceId_modelVersion_idx" ON "AIPrediction"("attendanceId", "modelVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AIPrediction_attendanceId_modelRunId_key" ON "AIPrediction"("attendanceId", "modelRunId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivityPermission" ADD CONSTRAINT "UserActivityPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivityPermission" ADD CONSTRAINT "UserActivityPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivityPermission" ADD CONSTRAINT "UserActivityPermission_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalQrCredential" ADD CONSTRAINT "PersonalQrCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_pilotClosedById_fkey" FOREIGN KEY ("pilotClosedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRoleAssignment" ADD CONSTRAINT "ActivityRoleAssignment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRoleAssignment" ADD CONSTRAINT "ActivityRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRoleAssignment" ADD CONSTRAINT "ActivityRoleAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPolicy" ADD CONSTRAINT "ActivityPolicy_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrToken" ADD CONSTRAINT "QrToken_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffVerification" ADD CONSTRAINT "StaffVerification_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffVerification" ADD CONSTRAINT "StaffVerification_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsistencyResult" ADD CONSTRAINT "ConsistencyResult_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanReview" ADD CONSTRAINT "HumanReview_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanReview" ADD CONSTRAINT "HumanReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundTruthLabel" ADD CONSTRAINT "GroundTruthLabel_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundTruthLabel" ADD CONSTRAINT "GroundTruthLabel_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundTruthCase" ADD CONSTRAINT "GroundTruthCase_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundTruthCase" ADD CONSTRAINT "GroundTruthCase_adjudicatorId_fkey" FOREIGN KEY ("adjudicatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIPrediction" ADD CONSTRAINT "AIPrediction_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIPrediction" ADD CONSTRAINT "AIPrediction_modelRunId_fkey" FOREIGN KEY ("modelRunId") REFERENCES "ModelRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
