-- ACTIVA-AI V1.1.0 Phase 3
-- External blind reviewer sessions with one-time hashed tokens.

CREATE TABLE "BlindReviewBatch" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlindReviewBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlindReviewInvite" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "reviewerSlot" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "independenceAttested" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlindReviewInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalGroundTruthLabel" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "reviewerSlot" TEXT NOT NULL,
    "target" "GroundTruthTarget" NOT NULL,
    "reasonCodes" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalGroundTruthLabel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BlindReviewBatch_attendanceId_status_idx"
    ON "BlindReviewBatch"("attendanceId", "status");
CREATE INDEX "BlindReviewBatch_expiresAt_idx"
    ON "BlindReviewBatch"("expiresAt");
CREATE UNIQUE INDEX "BlindReviewInvite_tokenHash_key"
    ON "BlindReviewInvite"("tokenHash");
CREATE UNIQUE INDEX "BlindReviewInvite_batchId_reviewerSlot_key"
    ON "BlindReviewInvite"("batchId", "reviewerSlot");
CREATE INDEX "BlindReviewInvite_expiresAt_idx"
    ON "BlindReviewInvite"("expiresAt");
CREATE UNIQUE INDEX "ExternalGroundTruthLabel_inviteId_key"
    ON "ExternalGroundTruthLabel"("inviteId");
CREATE INDEX "ExternalGroundTruthLabel_attendanceId_createdAt_idx"
    ON "ExternalGroundTruthLabel"("attendanceId", "createdAt");

ALTER TABLE "BlindReviewBatch"
    ADD CONSTRAINT "BlindReviewBatch_attendanceId_fkey"
    FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlindReviewBatch"
    ADD CONSTRAINT "BlindReviewBatch_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BlindReviewInvite"
    ADD CONSTRAINT "BlindReviewInvite_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "BlindReviewBatch"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalGroundTruthLabel"
    ADD CONSTRAINT "ExternalGroundTruthLabel_attendanceId_fkey"
    FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalGroundTruthLabel"
    ADD CONSTRAINT "ExternalGroundTruthLabel_inviteId_fkey"
    FOREIGN KEY ("inviteId") REFERENCES "BlindReviewInvite"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
