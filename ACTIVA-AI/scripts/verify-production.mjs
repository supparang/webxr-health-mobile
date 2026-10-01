import { pathToFileURL } from "node:url";
import { appendFileSync } from "node:fs";

const DEFAULT_BASE_URL = "https://activa-ai-production-api.onrender.com";
const DEFAULT_EXPECTED_RELEASE = "ACTIVA-AI-1.0.15";

function cleanBaseUrl(value) {
  let raw = String(value || DEFAULT_BASE_URL).trim();
  while (raw.endsWith("/")) raw = raw.slice(0, -1);
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("ACTIVA_PRODUCTION_URL must use HTTPS");
  let pathname = url.pathname;
  while (pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  return url.origin + pathname;
}

// Bounded retry policy for Render Free cold starts. One probe is attempted at
// a time, so /api/live wakes the service before readiness/governance checks.
// Only transport failures and temporary gateway statuses qualify for retry.
export const DEFAULT_PROBE_POLICY = Object.freeze({
  timeoutsMs: Object.freeze([12000, 25000, 65000]),
  backoffMs: Object.freeze([1500, 3500]),
});
const RETRYABLE_HTTP = new Set([408, 429, 502, 503, 504]);
const RETRYABLE_TRANSPORT = new Set(["AbortError", "TimeoutError", "TypeError"]);

async function getJson(baseUrl, path, { timeoutMs, fetchImpl = fetch, now = Date.now } = {}) {
  const started = now();
  const response = await fetchImpl(baseUrl + path, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "ACTIVA-AI-Production-Monitor/1.1",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const durationMs = now() - started;
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { status: response.status, durationMs, body };
}

async function defaultSleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function probeWithRetry(baseUrl, path, {
  request = getJson, sleep = defaultSleep, policy = DEFAULT_PROBE_POLICY,
} = {}) {
  const timeouts = policy.timeoutsMs;
  const backoffs = policy.backoffMs;
  if (!Array.isArray(timeouts) || !timeouts.length ||
      !timeouts.every(n => Number.isInteger(n) && n > 0) ||
      !Array.isArray(backoffs) || backoffs.length !== timeouts.length - 1 ||
      !backoffs.every(n => Number.isInteger(n) && n >= 0)) {
    throw new Error("INVALID_MONITOR_PROBE_POLICY");
  }
  const attempts = [];
  let final = null;
  for (let i = 0; i < timeouts.length; i++) {
    let retryable = false;
    try {
      const response = await request(baseUrl, path, { timeoutMs: timeouts[i] });
      // Never log returned body or request credentials. A malformed 200 response
      // must be evaluated and FAILED by the strict snapshot validator, not retried.
      final = response;
      retryable = RETRYABLE_HTTP.has(response.status);
      attempts.push({ number: i + 1, status: response.status,
        durationMs: response.durationMs ?? null, reason: retryable ? "TRANSIENT_HTTP" : "RESPONSE" });
    } catch (error) {
      const name = String(error?.name || "Error");
      retryable = RETRYABLE_TRANSPORT.has(name);
      final = { status: 0, durationMs: null, body: null };
      attempts.push({ number: i + 1, status: 0, durationMs: null,
        reason: retryable ? "TRANSIENT_TRANSPORT" : "NON_RETRYABLE_TRANSPORT" });
    }
    if (!retryable) return { response: final, attempts, exhaustedTransient: false };
    if (i < timeouts.length - 1) await sleep(backoffs[i]);
  }
  return { response: final, attempts, exhaustedTransient: true };
}

export function validateProductionSnapshot({ live, ready, health, expectedRelease = DEFAULT_EXPECTED_RELEASE, expectedGoogleDomain = "" } = {}) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };

  check(live?.status === 200, "LIVE_HTTP_NOT_200");
  check(live?.body?.ok === true, "LIVE_NOT_OK");
  check(live?.body?.deploymentTier === "PRODUCTION", "LIVE_NOT_PRODUCTION");
  check(live?.body?.releaseVersion === expectedRelease, "LIVE_RELEASE_MISMATCH");

  check(ready?.status === 200, "READY_HTTP_NOT_200");
  check(ready?.body?.ok === true && ready?.body?.ready === true, "READY_NOT_READY");
  check(ready?.body?.deploymentTier === "PRODUCTION", "READY_NOT_PRODUCTION");
  check(ready?.body?.releaseVersion === expectedRelease, "READY_RELEASE_MISMATCH");
  check(ready?.body?.database === "connected", "READY_DATABASE_NOT_CONNECTED");
  check(ready?.body?.authenticationReady === true, "READY_AUTHENTICATION_NOT_READY");

  check(health?.status === 200, "HEALTH_HTTP_NOT_200");
  check(health?.body?.ok === true, "HEALTH_NOT_OK");
  check(health?.body?.deploymentTier === "PRODUCTION", "HEALTH_NOT_PRODUCTION");
  check(health?.body?.releaseVersion === expectedRelease, "HEALTH_RELEASE_MISMATCH");
  check(health?.body?.database === "connected", "HEALTH_DATABASE_NOT_CONNECTED");
  check(health?.body?.autonomousDecision === false, "HEALTH_AUTONOMOUS_DECISION_MUST_BE_FALSE");
  check(health?.body?.productionGoEnabled === true, "HEALTH_PRODUCTION_GO_NOT_ENABLED");
  check(health?.body?.authentication?.mode === "GOOGLE_OIDC", "HEALTH_AUTHENTICATION_MODE_MISMATCH");
  check(health?.body?.authentication?.productionReady === true, "HEALTH_AUTHENTICATION_NOT_PRODUCTION_READY");

  if (expectedGoogleDomain) {
    const domains = Array.isArray(health?.body?.authentication?.allowedDomains) ? health.body.authentication.allowedDomains : [];
    check(domains.includes(expectedGoogleDomain), "HEALTH_EXPECTED_GOOGLE_DOMAIN_MISSING");
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      releaseVersion: live?.body?.releaseVersion || null,
      deploymentTier: live?.body?.deploymentTier || null,
      database: ready?.body?.database || null,
      authenticationReady: ready?.body?.authenticationReady === true,
      productionGoEnabled: health?.body?.productionGoEnabled === true,
      aiAutonomousDecision: health?.body?.autonomousDecision === true,
      probes: { liveMs: live?.durationMs ?? null, readyMs: ready?.durationMs ?? null, healthMs: health?.durationMs ?? null },
    },
  };
}

export async function verifyProduction({
  baseUrl = process.env.ACTIVA_PRODUCTION_URL || DEFAULT_BASE_URL,
  expectedRelease = process.env.ACTIVA_EXPECTED_RELEASE || DEFAULT_EXPECTED_RELEASE,
  expectedGoogleDomain = process.env.ACTIVA_EXPECTED_GOOGLE_DOMAIN || "",
  request = getJson, sleep = defaultSleep, policy = DEFAULT_PROBE_POLICY,
} = {}) {
  const normalizedBaseUrl = cleanBaseUrl(baseUrl);
  // Sequential probes prevent three simultaneous cold-start requests and keep
  // the existing strict readiness/authentication/governance validation intact.
  const liveProbe = await probeWithRetry(normalizedBaseUrl, "/api/live", { request, sleep, policy });
  const readyProbe = await probeWithRetry(normalizedBaseUrl, "/api/ready", { request, sleep, policy });
  const healthProbe = await probeWithRetry(normalizedBaseUrl, "/api/health", { request, sleep, policy });
  const probes = { live: liveProbe, ready: readyProbe, health: healthProbe };
  const result = validateProductionSnapshot({
    live: liveProbe.response, ready: readyProbe.response, health: healthProbe.response,
    expectedRelease, expectedGoogleDomain,
  });
  const hadTransient = Object.values(probes).some(p => p.attempts.some(a => a.reason.startsWith("TRANSIENT")));
  const exhausted = Object.values(probes).some(p => p.exhaustedTransient);
  return {
    ...result, checkedAt: new Date().toISOString(), baseUrl: normalizedBaseUrl,
    monitor: {
      classification: !result.ok ? (exhausted ? "TRANSIENT_PROBE_EXHAUSTED" : "GOVERNANCE_OR_READINESS_FAILURE")
        : hadTransient ? "TRANSIENT_RESPONSE_RECOVERED" : "HEALTHY_FIRST_ATTEMPT",
      // Metadata only; endpoint bodies, tokens and direct participant data are never logged.
      attempts: Object.fromEntries(Object.entries(probes).map(([name, p]) => [name, p.attempts])),
    },
  };
}

async function main() {
  try {
    const result = await verifyProduction();
    console.log(JSON.stringify(result, null, 2));
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, "monitor_classification=" + result.monitor.classification + "\n");
    }
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      checkedAt: new Date().toISOString(),
      error: error?.name || "Error",
      message: String(error?.message || "Production verification failed"),
    }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
