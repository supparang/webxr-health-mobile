// Configuration checks expose key names only, never environment values.
import { validGoogleClientId, validGoogleDomain, validGoogleEmail } from "./google-config.js";
export function productionGoEnabled(env = process.env) {
  return env.ACTIVA_PRODUCTION_GO_ENABLED === "true";
}

export function deploymentTier(env = process.env) {
  const tier = String(env.ACTIVA_DEPLOYMENT_TIER || "STAGING").trim().toUpperCase();
  return ["STAGING", "PRODUCTION"].includes(tier) ? tier : "INVALID";
}

export function configuredOrigins(env = process.env) {
  return String(env.ALLOWED_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
}

function validIntegerRange(value, min, max) {
  if (value === undefined || value === null || String(value).trim() === "") return true;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max;
}

export function deploymentConfigurationErrors(env = process.env) {
  const errors = [];
  const tier = deploymentTier(env);
  if (tier === "INVALID") errors.push("ACTIVA_DEPLOYMENT_TIER_INVALID");
  if (env.NODE_ENV !== "production") errors.push("NODE_ENV_MUST_BE_PRODUCTION");
  if (String(env.ACTIVA_AUTH_MODE || "").trim().toUpperCase() !== "GOOGLE_OIDC") errors.push("GOOGLE_OIDC_REQUIRED");
  if (!validGoogleClientId(String(env.GOOGLE_CLIENT_ID || "").trim())) errors.push("GOOGLE_CLIENT_ID_INVALID");
  const pilotClientId=String(env.GOOGLE_PILOT_CLIENT_ID || "").trim();
  if (pilotClientId && !validGoogleClientId(pilotClientId)) errors.push("GOOGLE_PILOT_CLIENT_ID_INVALID");
  const domains = String(env.GOOGLE_ALLOWED_DOMAINS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  const emails = String(env.GOOGLE_ALLOWED_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (domains.some(value => !validGoogleDomain(value))) errors.push("GOOGLE_ALLOWED_DOMAINS_INVALID");
  if (emails.some(value => !validGoogleEmail(value))) errors.push("GOOGLE_ALLOWED_EMAILS_INVALID");
  if (!domains.length && !emails.length) errors.push("GOOGLE_IDENTITY_ALLOWLIST_REQUIRED");
  const origins = configuredOrigins(env);
  if (!origins.length || origins.some(value => {
    try {
      const url = new URL(value);
      return url.protocol !== "https:" || url.origin !== value;
    } catch { return true; }
  })) errors.push("ALLOWED_ORIGINS_REQUIRE_EXACT_HTTPS_ORIGINS");
  if (tier === "PRODUCTION" && origins.some(value => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
    } catch { return false; }
  })) errors.push("PRODUCTION_ORIGIN_MUST_NOT_BE_LOCALHOST");
  if (!validIntegerRange(env.PORT, 1, 65535)) errors.push("PORT_INVALID");
  if (!validIntegerRange(env.QR_TOKEN_TTL_SECONDS, 15, 300)) errors.push("QR_TOKEN_TTL_SECONDS_INVALID");
  if (!validIntegerRange(env.REVIEW_TARGET_HOURS, 1, 168)) errors.push("REVIEW_TARGET_HOURS_INVALID");
  if (env.RULE_VERSION && !/^[A-Za-z0-9._-]{3,80}$/.test(String(env.RULE_VERSION))) errors.push("RULE_VERSION_INVALID");
  try {
    const url = new URL(env.DATABASE_URL || "");
    if (!["postgresql:", "postgres:"].includes(url.protocol) || !url.username || !url.password || url.pathname.length < 2 || /change[-_]?me|replace|activa_password|<|>/i.test(url.password)) errors.push("DATABASE_URL_INVALID_OR_PLACEHOLDER");
  } catch { errors.push("DATABASE_URL_INVALID_OR_PLACEHOLDER"); }
  for (const key of ["QR_SIGNING_SECRET", "RESEARCH_HASH_SALT"]) {
    const value = String(env[key] || "");
    if (value.length < 32 || /change-this|replace|placeholder|demo|example|not-for-production|^ci-|test/i.test(value)) errors.push(key + "_REQUIRES_STRONG_PRIVATE_VALUE");
  }
  if (env.QR_SIGNING_SECRET && env.QR_SIGNING_SECRET === env.RESEARCH_HASH_SALT) errors.push("SIGNING_SECRET_AND_RESEARCH_SALT_MUST_DIFFER");
  if (env.ACTIVA_PRODUCTION_GO_ENABLED && !["true", "false"].includes(env.ACTIVA_PRODUCTION_GO_ENABLED)) errors.push("ACTIVA_PRODUCTION_GO_ENABLED_INVALID");
  if (tier === "STAGING" && productionGoEnabled(env)) errors.push("STAGING_REQUIRES_PRODUCTION_GO_DISABLED");
  return errors;
}
