-- Phase 3 research provenance: existing records fail closed (UNCLASSIFIED).
CREATE TYPE "ActivityDataClass" AS ENUM ('UNCLASSIFIED', 'QA_TEST', 'EMPIRICAL');
ALTER TABLE "Activity"
  ADD COLUMN "dataClassification" "ActivityDataClass" NOT NULL DEFAULT 'UNCLASSIFIED',
  ADD COLUMN "classifiedAt" TIMESTAMP(3);

-- Explicit, auditable backfill of the known Production blind-review QA activity.
-- This does not promote any legacy activity to EMPIRICAL.
UPDATE "Activity"
SET "dataClassification" = 'QA_TEST',
    "classifiedAt" = CURRENT_TIMESTAMP
WHERE "title" = 'ACTIVA Phase 3 Blind Review QA'
  AND "location" = 'QA Test'
  AND "category" = 'วิจัย'
  AND "dataClassification" = 'UNCLASSIFIED';

CREATE INDEX "Activity_dataClassification_idx" ON "Activity"("dataClassification");
