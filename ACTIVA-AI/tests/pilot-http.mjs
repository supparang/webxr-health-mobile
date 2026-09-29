import assert from "node:assert/strict";
import { verifyStaging } from "../scripts/verify-staging.mjs";

const report = await verifyStaging({
  apiUrl: process.env.ACTIVA_BASE_URL || "http://127.0.0.1:3001",
  frontendOrigin: "https://supparang.github.io",
  allowLocalHttp: true
});
assert.equal(report.automatedChecksPassed, true, JSON.stringify(report.checks.filter(c => !c.passed)));
assert.equal(report.productionGoApproved, false);
console.log("Production container passed the reusable staging verifier; live Google sign-in remains separate");
