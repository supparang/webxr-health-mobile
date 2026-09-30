import assert from "node:assert/strict";
import { deploymentConfigurationErrors, productionGoEnabled, deploymentTier } from "../server/deployment-config.js";

const valid = {
  NODE_ENV: "production", ACTIVA_DEPLOYMENT_TIER: "STAGING", ACTIVA_AUTH_MODE: "GOOGLE_OIDC",
  PORT: "3000", QR_TOKEN_TTL_SECONDS: "45", REVIEW_TARGET_HOURS: "24", RULE_VERSION: "ACTIVA-RULES-0.2.0",
  GOOGLE_CLIENT_ID: "517090311491-u00q8g6aonuj2251ak7erqcose70gg2h.apps.googleusercontent.com",
  GOOGLE_PILOT_CLIENT_ID: "",
  GOOGLE_ALLOWED_DOMAINS: "chandra.ac.th", GOOGLE_ALLOWED_EMAILS: "", ALLOWED_ORIGINS: "https://supparang.github.io",
  DATABASE_URL: "postgresql://user:unit-only-db-password@db.internal:5432/activa?sslmode=require",
  QR_SIGNING_SECRET: "5e6c9d8a".repeat(8), RESEARCH_HASH_SALT: "7a3f4b2c".repeat(8),
  ACTIVA_PRODUCTION_GO_ENABLED: "false"
};
assert.deepEqual(deploymentConfigurationErrors(valid), []);
assert.equal(deploymentTier(valid), "STAGING");
assert.equal(deploymentTier({}), "STAGING");
assert.equal(deploymentTier({ ACTIVA_DEPLOYMENT_TIER: "production" }), "PRODUCTION");
assert.ok(deploymentConfigurationErrors({ ...valid, ACTIVA_DEPLOYMENT_TIER: "LIVE" }).includes("ACTIVA_DEPLOYMENT_TIER_INVALID"));
assert.ok(deploymentConfigurationErrors({ ...valid, ACTIVA_PRODUCTION_GO_ENABLED: "true" }).includes("STAGING_REQUIRES_PRODUCTION_GO_DISABLED"));
assert.deepEqual(deploymentConfigurationErrors({ ...valid, ACTIVA_DEPLOYMENT_TIER: "PRODUCTION", ACTIVA_PRODUCTION_GO_ENABLED: "true" }), []);
assert.ok(deploymentConfigurationErrors({ ...valid, PORT: "0" }).includes("PORT_INVALID"));
assert.ok(deploymentConfigurationErrors({ ...valid, PORT: "70000" }).includes("PORT_INVALID"));
assert.ok(deploymentConfigurationErrors({ ...valid, QR_TOKEN_TTL_SECONDS: "5" }).includes("QR_TOKEN_TTL_SECONDS_INVALID"));
assert.ok(deploymentConfigurationErrors({ ...valid, QR_TOKEN_TTL_SECONDS: "301" }).includes("QR_TOKEN_TTL_SECONDS_INVALID"));
assert.ok(deploymentConfigurationErrors({ ...valid, REVIEW_TARGET_HOURS: "0" }).includes("REVIEW_TARGET_HOURS_INVALID"));
assert.ok(deploymentConfigurationErrors({ ...valid, REVIEW_TARGET_HOURS: "169" }).includes("REVIEW_TARGET_HOURS_INVALID"));
assert.ok(deploymentConfigurationErrors({ ...valid, RULE_VERSION: "bad rule value" }).includes("RULE_VERSION_INVALID"));
assert.ok(deploymentConfigurationErrors({
  ...valid,
  ACTIVA_DEPLOYMENT_TIER: "PRODUCTION",
  ALLOWED_ORIGINS: "https://localhost"
}).includes("PRODUCTION_ORIGIN_MUST_NOT_BE_LOCALHOST"));
assert.equal(productionGoEnabled(valid), false);
assert.equal(productionGoEnabled({}), false);
assert.equal(productionGoEnabled({ ACTIVA_PRODUCTION_GO_ENABLED: "TRUE" }), false);
for (const [key, values] of Object.entries({
  NODE_ENV: ["development"], ACTIVA_AUTH_MODE: ["DEMO_HEADER", "DISABLED", "SSO"],
  GOOGLE_CLIENT_ID: ["", "placeholder"], GOOGLE_PILOT_CLIENT_ID: ["placeholder","https://999999999999-pilotclient123.apps.googleusercontent.com"], GOOGLE_ALLOWED_DOMAINS: ["*", "@chandra.ac.th", "https://chandra.ac.th"],
  GOOGLE_ALLOWED_EMAILS: ["*", "@gmail.com", "https://gmail.com", "person@gmail"],
  ALLOWED_ORIGINS: ["", "*", "http://supparang.github.io", "https://supparang.github.io/", "https://supparang.github.io/path", "https://user:pass@supparang.github.io"],
  DATABASE_URL: ["", "https://db.internal", "postgresql://activa:activa_password@db.internal/activa"],
  QR_SIGNING_SECRET: ["", "change-this-to-a-long-random-secret-before-real-use"],
  RESEARCH_HASH_SALT: ["", "ci-research-hash-salt-not-for-production"],
  ACTIVA_PRODUCTION_GO_ENABLED: ["yes"]
})) for (const value of values) assert.ok(deploymentConfigurationErrors({ ...valid, [key]: value }).length, key + " must reject invalid config");
assert.ok(deploymentConfigurationErrors({ ...valid, GOOGLE_ALLOWED_DOMAINS: "", GOOGLE_ALLOWED_EMAILS: "" }).includes("GOOGLE_IDENTITY_ALLOWLIST_REQUIRED"));
assert.deepEqual(deploymentConfigurationErrors({ ...valid, GOOGLE_ALLOWED_DOMAINS: "", GOOGLE_ALLOWED_EMAILS: "pilot.user@gmail.com" }), []);
assert.ok(deploymentConfigurationErrors({ ...valid, RESEARCH_HASH_SALT: valid.QR_SIGNING_SECRET }).includes("SIGNING_SECRET_AND_RESEARCH_SALT_MUST_DIFFER"));
console.log("Deployment configuration checks passed; Production GO defaults to disabled");
