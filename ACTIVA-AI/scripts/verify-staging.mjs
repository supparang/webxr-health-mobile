import { pathToFileURL } from "node:url";

const CLIENT_ID = "517090311491-u00q8g6aonuj2251ak7erqcose70gg2h.apps.googleusercontent.com";
const DOMAIN = "chandra.ac.th";
const RELEASE = "ACTIVA-AI-1.0.15";

export function stagingOptions(args = process.argv.slice(2), env = process.env) {
  const options = { apiUrl: env.ACTIVA_BASE_URL || "", frontendOrigin: env.ACTIVA_FRONTEND_ORIGIN || "https://supparang.github.io", allowLocalHttp: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--allow-local-http") options.allowLocalHttp = true;
    else if (["--api-url", "--frontend-origin"].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith("--")) {
      options[args[i] === "--api-url" ? "apiUrl" : "frontendOrigin"] = args[++i];
    } else throw new Error("INVALID_STAGING_ARGUMENTS");
  }
  return options;
}

export function validatedTarget({ apiUrl, frontendOrigin, allowLocalHttp = false }) {
  let api, origin;
  try { api = new URL(apiUrl); origin = new URL(frontendOrigin); }
  catch { throw new Error("STAGING_REQUIRES_VALID_URLS"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(api.hostname);
  if (api.protocol !== "https:" && !(allowLocalHttp && local && api.protocol === "http:")) throw new Error("STAGING_REQUIRES_HTTPS");
  if (api.username || api.password || api.search || api.hash || /[?#]/.test(apiUrl)) throw new Error("STAGING_URL_MUST_NOT_CONTAIN_CREDENTIALS_QUERY_OR_FRAGMENT");
  if (origin.protocol !== "https:" || frontendOrigin !== origin.origin) throw new Error("FRONTEND_REQUIRES_EXACT_HTTPS_ORIGIN");
  return { base: api.origin + api.pathname.replace(/\/$/, ""), origin: origin.origin };
}

// Unauthenticated GET/OPTIONS only. No token, cookies, database writes, sign-in,
// provisioning, release decisions or external redirects are permitted here.
export async function verifyStaging(options, fetchImpl = fetch) {
  const { base, origin } = validatedTarget(options);
  const checks = [];
  const record = (id, passed) => checks.push({ id, passed: Boolean(passed) });
  async function request(path, { method = "GET", headers = {}, json = false } = {}) {
    try {
      const response = await fetchImpl(base + path, {
        method, headers: { Accept: "application/json", ...headers },
        credentials: "omit", redirect: "error", signal: AbortSignal.timeout(10000)
      });
      let body = null;
      if (json) { try { body = await response.json(); } catch {} }
      else await response.body?.cancel();
      return { status: response.status, headers: response.headers, body };
    } catch {
      // Raw error messages and response bodies may contain sensitive data.
      return null;
    }
  }
  function report() {
    return {
      schemaVersion: 1, scope: "UNAUTHENTICATED_READ_ONLY", checkedAt: new Date().toISOString(),
      automatedChecksPassed: checks.every(c => c.passed), checks,
      productionGoApproved: false,
      manualAcceptanceRequired: ["GOOGLE_CONSOLE_ORIGIN_AND_AUDIENCE", "REAL_WORKSPACE_DOMAIN_CONFIRMATION", "GOOGLE_SIGN_IN_TO_APPROVED_ACTIVE_USER", "ROLE_AND_INACTIVE_USER_ACCEPTANCE", "POSTGRESQL_BACKUP_RESTORE", "OPERATIONAL_AND_PRIVACY_SIGN_OFF"]
    };
  }
  const health = await request("/api/health", { headers: { Origin: origin }, json: true });
  record("HEALTH_REACHABLE", health?.status === 200);
  if (!health || health.status !== 200) return report();
  record("DATABASE_AND_RELEASE", health.body?.ok === true && health.body.database === "connected" && health.body.releaseVersion === RELEASE);
  record("DEPLOYMENT_TIER", health.body?.deploymentTier === "STAGING");
  const auth = health.body?.authentication;
  record("GOOGLE_OIDC_CONFIGURATION", auth?.mode === "GOOGLE_OIDC" && auth?.provider === "GOOGLE" && auth?.configurationReady === true && auth?.googleClientId === CLIENT_ID && Array.isArray(auth.allowedDomains) && auth.allowedDomains.length === 1 && auth.allowedDomains[0] === DOMAIN);
  record("PRODUCTION_GO_DISABLED", health.body?.productionGoEnabled === false);
  record("HEALTH_NOT_CACHED", health.headers.get("cache-control")?.split(",").some(x => x.trim().toLowerCase() === "no-store"));
  record("REQUEST_ID_HEADER", /^[A-Za-z0-9._:-]{8,128}$/.test(health.headers.get("x-request-id") || ""));
  record("SECURITY_HEADERS",
    health.headers.get("x-content-type-options") === "nosniff" &&
    health.headers.get("x-frame-options") === "DENY" &&
    health.headers.get("referrer-policy") === "strict-origin-when-cross-origin" &&
    (health.headers.get("permissions-policy") || "").includes("camera=(self)") &&
    health.headers.get("cross-origin-opener-policy") === "same-origin-allow-popups"
  );
  record("APPROVED_ORIGIN", health.headers.get("access-control-allow-origin") === origin);
  const preflight = await request("/api/me", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization,content-type" } });
  const allowedHeaders = (preflight?.headers.get("access-control-allow-headers") || "").toLowerCase().split(",").map(x => x.trim());
  const allowedMethods = (preflight?.headers.get("access-control-allow-methods") || "").toUpperCase().split(",").map(x => x.trim());
  record("BEARER_PREFLIGHT", [200, 204].includes(preflight?.status) && preflight.headers.get("access-control-allow-origin") === origin && allowedMethods.includes("GET") && ["authorization", "content-type"].every(x => allowedHeaders.includes(x)));
  const rejected = await request("/api/health", { headers: { Origin: "https://unapproved.activa.invalid" } });
  record("UNAPPROVED_ORIGIN_REJECTED", rejected?.status === 403);
  for (const [id, headers] of [["TOKEN_REQUIRED", {}], ["DEMO_HEADER_REJECTED", { "x-activa-user-id": "ADM001" }]]) {
    const response = await request("/api/me", { headers, json: true });
    record(id, response?.status === 401 && response.body?.error === "GOOGLE_ID_TOKEN_REQUIRED");
  }
  for (const [id, path] of [
    ["SERVER_FILES_PRIVATE", "/server/auth.js"], ["DATABASE_SCHEMA_PRIVATE", "/prisma/schema.prisma"],
    ["PACKAGE_FILES_PRIVATE", "/package-lock.json"], ["ENVIRONMENT_PRIVATE", "/.env"],
    ["DEPENDENCIES_PRIVATE", "/node_modules/express/package.json"], ["BOOTSTRAP_PRIVATE", "/scripts/bootstrap-admin.mjs"]
  ]) record(id, (await request(path))?.status === 404);
  for (const [id, path] of [["FRONTEND_AVAILABLE", "/"], ["APP_AVAILABLE", "/app.js"], ["PUBLIC_CONFIG_AVAILABLE", "/runtime-config.js"]]) record(id, (await request(path))?.status === 200);
  return report();
}

async function main() {
  try {
    const report = await verifyStaging(stagingOptions());
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.automatedChecksPassed ? 0 : 1;
  } catch (error) {
    const safeCodes = ["INVALID_STAGING_ARGUMENTS", "STAGING_REQUIRES_VALID_URLS", "STAGING_REQUIRES_HTTPS", "STAGING_URL_MUST_NOT_CONTAIN_CREDENTIALS_QUERY_OR_FRAGMENT", "FRONTEND_REQUIRES_EXACT_HTTPS_ORIGIN"];
    console.error(JSON.stringify({ automatedChecksPassed: false, error: safeCodes.includes(error.message) ? error.message : "STAGING_CHECK_FAILED", productionGoApproved: false }));
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
