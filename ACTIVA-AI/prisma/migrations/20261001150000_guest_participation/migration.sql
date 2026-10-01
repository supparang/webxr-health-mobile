-- P3.2.3 Accountless Guest Participation
-- This migration is additive. Existing employee attendance userId is preserved.
ALTER TABLE "AttendanceRecord" ALTER COLUMN "userId" DROP NOT NULL;

CREATE TABLE "GuestParticipant" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "studyHash" TEXT NOT NULL,
  "passTokenHash" TEXT NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "consentText" TEXT NOT NULL,
  "consentAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "issuedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestParticipant_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "AttendanceRecord" ADD COLUMN "guestParticipantId" TEXT;

CREATE UNIQUE INDEX "GuestParticipant_passTokenHash_key" ON "GuestParticipant"("passTokenHash");
CREATE UNIQUE INDEX "GuestParticipant_activityId_studyHash_key" ON "GuestParticipant"("activityId","studyHash");
CREATE INDEX "GuestParticipant_activityId_revokedAt_idx" ON "GuestParticipant"("activityId","revokedAt");
CREATE INDEX "GuestParticipant_expiresAt_idx" ON "GuestParticipant"("expiresAt");
CREATE UNIQUE INDEX "AttendanceRecord_guestParticipantId_key" ON "AttendanceRecord"("guestParticipantId");

ALTER TABLE "GuestParticipant" ADD CONSTRAINT "GuestParticipant_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestParticipant" ADD CONSTRAINT "GuestParticipant_issuedById_fkey"
  FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_guestParticipantId_fkey"
  FOREIGN KEY ("guestParticipantId") REFERENCES "GuestParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one attendance owner: the existing User OR the new GuestParticipant.
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_exactly_one_participant_chk"
  CHECK (("userId" IS NOT NULL) <> ("guestParticipantId" IS NOT NULL));
