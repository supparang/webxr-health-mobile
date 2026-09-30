import assert from "node:assert/strict";
import { stagingOptions, validatedTarget, verifyStaging } from "../scripts/verify-staging.mjs";

const options = { apiUrl: "https://pilot.example.test", frontendOrigin: "https://supparang.github.io" };
const health = {
  ok: true, database: "connected", releaseVersion: "ACTIVA-AI-1.0.15", deploymentTier: "STAGING", productionGoEnabled: false,
  authentication: { mode: "GOOGLE_OIDC", provider: "GOOGLE", configurationReady: true, googleClientId: "517090311491-u00q8g6aonuj2251ak7erqcose70gg2h.apps.googleusercontent.com", allowedDomains: ["chandra.ac.th"] }
};
assert.deepEqual(stagingOptions(["--api-url", options.apiUrl], {}), { ...options, allowLocalHttp: false });
for (const args of [["--token", "secret"], ["--api-url"], ["--unknown"]]) assert.throws(() => stagingOptions(args, {}));
for (const apiUrl of ["http://remote.example.test", "http://localhost:3000", "https://user:secret@pilot.example.test", "https://pilot.example.test?token=secret", "https://pilot.example.test#secret", "https://pilot.example.test?", "file:///etc/passwd"]) assert.throws(() => validatedTarget({ ...options, apiUrl }));
assert.throws(() => validatedTarget({ ...options, apiUrl: "http://remote.example.test", allowLocalHttp: true }));
assert.equal(validatedTarget({ ...options, apiUrl: "http://127.0.0.1:3001", allowLocalHttp: true }).base, "http://127.0.0.1:3001");
assert.throws(() => validatedTarget({ ...options, frontendOrigin: "https://supparang.github.io/path" }));

function fixture({ data = health, preflight = true, preflightMethod = "GET", exposed = false, redirect = false, malformed = false, unauthStatus = 401 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    assert.ok(["GET", "OPTIONS"].includes(init.method));
    assert.equal(init.redirect, "error");
    assert.equal(init.credentials, "omit");
    assert.equal(new Headers(init.headers).has("authorization"), false);
    if (redirect) throw new Error("Untrusted failure containing secret-body-token");
    const path = new URL(url).pathname;
    const headers = {
      "Access-Control-Allow-Origin": options.frontendOrigin,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
    };
    if (init.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": preflightMethod, "Access-Control-Allow-Headers": preflight ? "authorization,content-type" : "content-type" } });
    if (path === "/api/health") {
      if (init.headers.Origin !== options.frontendOrigin) return new Response(null, { status: 403 });
      return new Response(malformed ? "secret-body-token" : JSON.stringify(data), { status: 200, headers });
    }
    if (path === "/api/me") return new Response(JSON.stringify({ error: "GOOGLE_ID_TOKEN_REQUIRED", privateField: "secret-body-token" }), { status: unauthStatus });
    return new Response(null, { status: ["/", "/app.js", "/runtime-config.js"].includes(path) || exposed ? 200 : 404 });
  };
  return { fetchImpl, calls };
}
const good = fixture();
const report = await verifyStaging(options, good.fetchImpl);
assert.equal(report.automatedChecksPassed, true);
assert.equal(report.productionGoApproved, false);
assert.equal(report.checks.length, 24);
assert.ok(report.manualAcceptanceRequired.includes("GOOGLE_SIGN_IN_TO_APPROVED_ACTIVE_USER"));
assert.equal(good.calls.length, 14);
assert.ok(good.calls.every(x => !x.url.includes("release-decision")));
for (const overrides of [
  { data: { ...health, productionGoEnabled: true } },
  { data: { ...health, deploymentTier: "PRODUCTION" } },
  { data: { ...health, releaseVersion: "wrong-release" } },
  { data: { ...health, authentication: { ...health.authentication, allowedDomains: ["chandra.ac.th", "other.test"] } } },
  { data: { ...health, authentication: { ...health.authentication, googleClientId: "wrong-audience" } } },
  { data: { ...health, authentication: { ...health.authentication, mode: "DEMO_HEADER" } } },
  { preflight: false }, { preflightMethod: "POST" }, { exposed: true }, { redirect: true }, { malformed: true }, { unauthStatus: 200 }
]) {
  const result = await verifyStaging(options, fixture(overrides).fetchImpl);
  assert.equal(result.automatedChecksPassed, false);
  assert.equal(result.productionGoApproved, false);
  assert.ok(!JSON.stringify(result).includes("secret-body-token"), "No response bodies or failure details may reach reports");
}
console.log("Read-only staging verifier URL, HTTP, failure, redaction and pending-acceptance checks passed");
