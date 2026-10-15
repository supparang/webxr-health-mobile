-- S3.2 — atomic shared counters for multi-instance ACTIVA-AI.
-- Run migrations with an isolated privileged migration identity only.
CREATE TABLE "SecurityRateLimitBucket" (
  "id" VARCHAR(64) NOT NULL,
  "windowId" BIGINT NOT NULL,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "SecurityRateLimitBucket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityRateLimitBucket_expiresAt_idx"
  ON "SecurityRateLimitBucket"("expiresAt");
