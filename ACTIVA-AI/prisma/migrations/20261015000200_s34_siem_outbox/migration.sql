-- S3.4 app-controlled SIEM outbox state, independent of GitHub alerts.
ALTER TABLE "SecurityIncidentWindow"
  ADD COLUMN "siemStatus" VARCHAR(20) NOT NULL DEFAULT 'COUNTING',
  ADD COLUMN "siemNextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "siemLeaseId" VARCHAR(64),
  ADD COLUMN "siemLeaseUntil" TIMESTAMPTZ(3),
  ADD COLUMN "siemAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "siemDeliveredAt" TIMESTAMPTZ(3),
  ADD COLUMN "siemReceiptId" VARCHAR(100);
CREATE INDEX "SecurityIncidentWindow_siemStatus_siemNextAttemptAt_idx"
  ON "SecurityIncidentWindow" ("siemStatus","siemNextAttemptAt");
