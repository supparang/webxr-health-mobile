import assert from "node:assert/strict";
import {
  neonTargetIdentity,
  assertIsolatedRecoveryTarget,
  parseRecoveryPoint,
} from "../scripts/verify-recovery-database.mjs";

const prod = "postgresql://user:secret@ep-production-123.us-east-2.aws.neon.tech/neondb?sslmode=require";
const recovery = "postgresql://user:secret@ep-recovery-456.us-east-2.aws.neon.tech/neondb?sslmode=require";

assert.deepEqual(neonTargetIdentity(recovery), {
  hostname: "ep-recovery-456.us-east-2.aws.neon.tech",
  database: "neondb",
});

const isolated = assertIsolatedRecoveryTarget(recovery, prod);
assert.equal(isolated.recovery.hostname.includes("recovery"), true);

assert.throws(
  () => assertIsolatedRecoveryTarget(prod, prod),
  /RECOVERY_TARGET_MATCHES_PRODUCTION/
);

assert.throws(
  () => neonTargetIdentity("postgresql://u:p@db.example.com/neondb"),
  /RECOVERY_DATABASE_MUST_BE_NEON/
);

assert.equal(
  parseRecoveryPoint("2026-09-30T13:00:00Z").toISOString(),
  "2026-09-30T13:00:00.000Z"
);

assert.throws(() => parseRecoveryPoint("not-a-time"), /RECOVERY_POINT_UTC_INVALID/);

console.log("ACTIVA-AI isolated Neon recovery verifier guard tests passed");
