import assert from "node:assert/strict";
const base = process.env.ACTIVA_BASE_URL || "http://127.0.0.1:3001";
const origin = "https://supparang.github.io";
const response = await fetch(base + "/api/health", { headers: { Origin: origin } });
assert.equal(response.status, 200);
assert.equal(response.headers.get("access-control-allow-origin"), origin);
assert.equal(response.headers.get("cache-control"), "no-store");
const health = await response.json();
assert.equal(health.database, "connected");
assert.equal(health.releaseVersion, "ACTIVA-AI-1.0.15");
assert.equal(health.authentication.mode, "GOOGLE_OIDC");
assert.equal(health.authentication.configurationReady, true);
assert.equal(health.authentication.googleClientId, "517090311491-u00q8g6aonuj2251ak7erqcose70gg2h.apps.googleusercontent.com");
assert.deepEqual(health.authentication.allowedDomains, ["chandra.ac.th"]);
assert.equal(health.productionGoEnabled, false);
for (const headers of [{}, { "x-activa-user-id": "ADM001" }]) {
  const res = await fetch(base + "/api/me", { headers });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, "GOOGLE_ID_TOKEN_REQUIRED");
}
assert.equal((await fetch(base + "/api/health", { headers: { Origin: "https://unapproved.example.test" } })).status, 403);
for (const path of ["/server/auth.js", "/prisma/schema.prisma", "/package-lock.json", "/.env", "/node_modules/express/package.json", "/scripts/bootstrap-admin.mjs"]) assert.equal((await fetch(base + path)).status, 404, path);
for (const path of ["/", "/app.js", "/runtime-config.js"]) assert.equal((await fetch(base + path)).status, 200, path);
console.log("Production container HTTP, PostgreSQL, OIDC configuration, CORS and private-file boundaries passed; live Google sign-in remains separate");
