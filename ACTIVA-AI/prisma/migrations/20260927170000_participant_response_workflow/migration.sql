-- ACTIVA-AI V1.0.2 participant evidence response workflow
CREATE TABLE "ParticipantResponse" (
  "id" TEXT NOT NULL,
  "attendanceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "response" TEXT NOT NULL,
  "requestReviewId" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParticipantResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParticipantResponse_attendanceId_submittedAt_idx"
  ON "ParticipantResponse"("attendanceId", "submittedAt");
CREATE INDEX "ParticipantResponse_userId_submittedAt_idx"
  ON "ParticipantResponse"("userId", "submittedAt");

ALTER TABLE "ParticipantResponse"
  ADD CONSTRAINT "ParticipantResponse_attendanceId_fkey"
  FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParticipantResponse"
  ADD CONSTRAINT "ParticipantResponse_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
