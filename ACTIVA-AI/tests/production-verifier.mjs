import assert from "node:assert/strict";
import { validateProductionSnapshot } from "../scripts/verify-production.mjs";

const expectedRelease = "ACTIVA-AI-1.0.15";
const good = {
  live: {
    status: 200,
    durationMs: 50,
    body: { ok: true, service: "ACTIVA-AI", releaseVersion: expectedRelease, deploymentTier: "PRODUCTION" },
  },
  ready: {
    status: 200,
    durationMs: 70,
    body: {
      ok: true,
      ready: true,
      releaseVersion: expectedRelease,
      deploymentTier: "PRODUCTION",
      database: "connected",
      authenticationReady: true,
    },
  },
  health: {
    status: 200,
    durationMs: 80,
    body: {
      ok: true,
      releaseVersion: expectedRelease,
      deploymentTier: "PRODUCTION",
      database: "connected",
      autonomousDecision: false,
      productionGoEnabled: true,
      authentication: { productionReady: true, allowedDomains: ["chandra.ac.th"] },
    },
  },
};

const pass = validateProductionSnapshot({ ...good, expectedRelease, expectedGoogleDomain: "chandra.ac.th" });
assert.equal(pass.ok, true);
assert.deepEqual(pass.errors, []);
assert.equal(pass.summary.aiAutonomousDecision, false);

const wrongTier = validateProductionSnapshot({
  ...good,
  live: { ...good.live, body: { ...good.live.body, deploymentTier: "STAGING" } },
  expectedRelease,
});
assert.equal(wrongTier.ok, false);
assert(wrongTier.errors.includes("LIVE_NOT_PRODUCTION"));

const autonomousAi = validateProductionSnapshot({
  ...good,
  health: { ...good.health, body: { ...good.health.body, autonomousDecision: true } },
  expectedRelease,
});
assert.equal(autonomousAi.ok, false);
assert(autonomousAi.errors.includes("HEALTH_AUTONOMOUS_DECISION_MUST_BE_FALSE"));

const authDown = validateProductionSnapshot({
  ...good,
  ready: { ...good.ready, status: 503, body: { ok: false, ready: false } },
  expectedRelease,
});
assert.equal(authDown.ok, false);
assert(authDown.errors.includes("READY_HTTP_NOT_200"));
assert(authDown.errors.includes("READY_NOT_READY"));

console.log("ACTIVA-AI production monitor validation tests passed");
