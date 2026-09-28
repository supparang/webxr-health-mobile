#!/usr/bin/env node
import assert from "node:assert/strict";
import { authenticationMode, productionAuthenticationReady } from "../server/auth.js";

for (const mode of ["DISABLED", "DEMO_HEADER", "OIDC", "SSO", "UNKNOWN"]) {
  process.env.ACTIVA_AUTH_MODE=mode;
  assert.equal(authenticationMode(),mode);
  assert.equal(
    productionAuthenticationReady(),
    false,
    mode+" must not be production-ready until its verifier is implemented"
  );
}

console.log("ACTIVA-AI V1.0.15 authentication readiness guard passed");
