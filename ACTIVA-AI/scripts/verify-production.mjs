import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "https://activa-ai-production-api.onrender.com";
const DEFAULT_EXPECTED_RELEASE = "ACTIVA-AI-1.0.15";

function cleanBaseUrl(value) {
  const raw = String(value || DEFAULT_BASE_URL).trim().replace(/\\/+$/, "");
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("ACTIVA_PRODUCTION_URL must use HTTPS");
  return url.origin + url.pathname.replace(/\\/$/, "");
}

async function getJson(baseUrl, path) {
  const started = Date.now();
  const response = await fetch(baseUrl + path, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "User-Agent": "ACTIVA-AI-Production-Monitor/1.0",
    },
    signal: AbortSignal.timeout(15000),
  });
  const durationMs = Date.now() - started;
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { status: response.status, durationMs, body };
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
} = {}) {
  const normalizedBaseUrl = cleanBaseUrl(baseUrl);
  const [live, ready, health] = await Promise.all([
    getJson(normalizedBaseUrl, "/api/live"),
    getJson(normalizedBaseUrl, "/api/ready"),
    getJson(normalizedBaseUrl, "/api/health"),
  ]);
  const result = validateProductionSnapshot({ live, ready, health, expectedRelease, expectedGoogleDomain });
  return { ...result, checkedAt: new Date().toISOString(), baseUrl: normalizedBaseUrl };
}

async function main() {
  try {
    const result = await verifyProduction();
    console.log(JSON.stringify(result, null, 2));
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
