-- S3.3 durable incident aggregates, claims and operator acknowledgment.
CREATE TABLE "SecurityIncidentWindow" (
  "id" VARCHAR(72) NOT NULL,
  "category" VARCHAR(32) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "threshold" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'COUNTING',
  "firstSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseId" VARCHAR(64),
  "leaseUntil" TIMESTAMPTZ(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "deliveredAt" TIMESTAMPTZ(3),
  "deliveryAction" VARCHAR(16),
  "acknowledgedAt" TIMESTAMPTZ(3),
  "acknowledgedBy" VARCHAR(80),
  CONSTRAINT "SecurityIncidentWindow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityIncidentWindow_status_nextAttemptAt_idx"
  ON "SecurityIncidentWindow"("status","nextAttemptAt");
CREATE INDEX "SecurityIncidentWindow_firstSeenAt_idx"
  ON "SecurityIncidentWindow"("firstSeenAt");

CREATE TABLE "SecurityEventSample" (
  "id" TEXT NOT NULL,
  "category" VARCHAR(32) NOT NULL,
  "kind" VARCHAR(24) NOT NULL,
  "method" VARCHAR(8),
  "route" VARCHAR(160),
  "scope" VARCHAR(32),
  "statusCode" INTEGER,
  "action" VARCHAR(80),
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityEventSample_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityEventSample_occurredAt_idx"
  ON "SecurityEventSample"("occurredAt");
CREATE INDEX "SecurityEventSample_category_occurredAt_idx"
  ON "SecurityEventSample"("category","occurredAt");
