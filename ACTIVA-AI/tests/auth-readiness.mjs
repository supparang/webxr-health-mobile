#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  authenticationMode,
  productionAuthenticationReady,
  googleAllowedDomains,
  googleAllowedEmails,
  googleClientId,
} from "../server/auth.js";

const keys=["ACTIVA_AUTH_MODE", "GOOGLE_CLIENT_ID", "GOOGLE_ALLOWED_DOMAINS", "GOOGLE_ALLOWED_EMAILS"];
const saved=Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const clientId="517090311491-u00q8g6aonuj2251ak7erqcose70gg2h.apps.googleusercontent.com";

try {
for (const key of ["GOOGLE_CLIENT_ID","GOOGLE_ALLOWED_DOMAINS","GOOGLE_ALLOWED_EMAILS"]) delete process.env[key];

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

process.env.GOOGLE_CLIENT_ID=clientId;
assert.equal(productionAuthenticationReady(),false,"Google OIDC without an identity allowlist must fail closed");

process.env.GOOGLE_ALLOWED_DOMAINS="CHANDRA.AC.TH, staff.chandra.ac.th";
assert.equal(googleClientId(),clientId);
assert.deepEqual(googleAllowedDomains(),["chandra.ac.th","staff.chandra.ac.th"]);
assert.deepEqual(googleAllowedEmails(),[]);
assert.equal(productionAuthenticationReady(),true,"Workspace-domain Google OIDC should be production-ready");

process.env.GOOGLE_ALLOWED_DOMAINS="";
process.env.GOOGLE_ALLOWED_EMAILS=" Pilot.One@gmail.com, pilot.two@gmail.com, pilot.one@gmail.com ";
assert.deepEqual(googleAllowedEmails(),["pilot.one@gmail.com","pilot.two@gmail.com"]);
assert.equal(productionAuthenticationReady(),true,"Exact-email Google OIDC should be production-ready");

process.env.GOOGLE_ALLOWED_DOMAINS="CHANDRA.AC.TH, staff.chandra.ac.th";
process.env.GOOGLE_ALLOWED_EMAILS="";

for (const invalid of ["client-id", "<OAuth 2.0 Web client id>.apps.googleusercontent.com", "https://"+clientId, clientId+".evil.example", "invalid.apps.googleusercontent.com"]) {
  process.env.GOOGLE_CLIENT_ID=invalid;
  assert.equal(productionAuthenticationReady(),false,"Malformed client ID must fail closed: "+invalid);
}
process.env.GOOGLE_CLIENT_ID=clientId;

for (const invalid of ["*", "*.chandra.ac.th", "@chandra.ac.th", "https://chandra.ac.th", "chandra.ac.th/", "chandra.ac.th:443", "localhost", "127.0.0.1", "-chandra.ac.th", "chandra..ac.th", "chandra.ac.th,*.example.org"]) {
  process.env.GOOGLE_ALLOWED_DOMAINS=invalid;
  assert.equal(productionAuthenticationReady(),false,"Malformed domain allowlist must fail closed: "+invalid);
}
process.env.GOOGLE_ALLOWED_DOMAINS="chandra.ac.th";
for (const invalid of ["*", "@gmail.com", "https://gmail.com", "person@", "person@gmail", "person @gmail.com"]) {
  process.env.GOOGLE_ALLOWED_EMAILS=invalid;
  assert.equal(productionAuthenticationReady(),false,"Malformed exact-email allowlist must fail closed: "+invalid);
}
process.env.GOOGLE_ALLOWED_EMAILS="";
process.env.ACTIVA_AUTH_MODE=" google_oidc ";
process.env.GOOGLE_CLIENT_ID=" "+clientId+" ";
process.env.GOOGLE_ALLOWED_DOMAINS=" CHANDRA.AC.TH ";
process.env.GOOGLE_ALLOWED_EMAILS=" Pilot.One@GMAIL.COM ";
assert.equal(productionAuthenticationReady(),true,"Public identifiers may be trimmed and allowlists normalized");
assert.equal(authenticationMode(),"GOOGLE_OIDC");
assert.deepEqual(googleAllowedDomains(),["chandra.ac.th"]);
assert.deepEqual(googleAllowedEmails(),["pilot.one@gmail.com"]);

console.log("ACTIVA-AI V1.0.15 authentication readiness guard passed");
} finally {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key]=saved[key];
  }
}
