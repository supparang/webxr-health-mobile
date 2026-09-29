#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  authenticationMode,
  productionAuthenticationReady,
  googleAllowedDomains,
  googleClientId,
} from "../server/auth.js";

for (const key of ["GOOGLE_CLIENT_ID","GOOGLE_ALLOWED_DOMAINS"]) delete process.env[key];

for (const mode of ["DISABLED", "DEMO_HEADER", "OIDC", "SSO", "UNKNOWN"]) {
  process.env.ACTIVA_AUTH_MODE=mode;
  assert.equal(authenticationMode(),mode);
  assert.equal(
    productionAuthenticationReady(),
    false,
    mode+" must not be production-ready"
  );
}

process.env.ACTIVA_AUTH_MODE="GOOGLE_OIDC";
assert.equal(productionAuthenticationReady(),false,"Google OIDC without config must fail closed");

process.env.GOOGLE_CLIENT_ID="1234567890-example.apps.googleusercontent.com";
assert.equal(productionAuthenticationReady(),false,"Google OIDC without domain allowlist must fail closed");

process.env.GOOGLE_ALLOWED_DOMAINS="university.example, staff.university.example";
assert.equal(googleClientId(),"1234567890-example.apps.googleusercontent.com");
assert.deepEqual(googleAllowedDomains(),["university.example","staff.university.example"]);
assert.equal(productionAuthenticationReady(),true,"Configured Google OIDC should be production-ready");

console.log("ACTIVA-AI V1.0.15 authentication readiness guard passed");
