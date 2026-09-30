#!/usr/bin/env node
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { OAuth2Client } from "google-auth-library";

// Exercise the real Google JWT verifier with ephemeral RSA keys. Only certificate
// retrieval and the database are replaced, so this runs offline without Google
// accounts, credentials or PostgreSQL. Live sign-in is a separate deployment gate.
const { privateKey, publicKey }=generateKeyPairSync("rsa", { modulusLength: 2048 });
const unrelatedKey=generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
const publicPem=publicKey.export({ type: "spki", format: "pem" });
const clientId="517090311491-u00q8g6aonuj2251ak7erqcose70gg2h.apps.googleusercontent.com";
const pilotClientId="999999999999-pilotclient123.apps.googleusercontent.com";
const keys=["NODE_ENV", "ACTIVA_AUTH_MODE", "GOOGLE_CLIENT_ID", "GOOGLE_PILOT_CLIENT_ID", "GOOGLE_ALLOWED_DOMAINS", "GOOGLE_ALLOWED_EMAILS"];
const savedEnv=Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const savedPrisma=globalThis.__activaPrisma;
const savedCertFetch=OAuth2Client.prototype.getFederatedSignonCertsAsync;
let certificateRequests=0;
let databaseQueries=[];
let databaseError=null;
const activeUser={ id: "provisioned-user", employeeId: "EMP001", email: "person@chandra.ac.th", status: "ACTIVE", role: "PARTICIPANT" };
let provisionedUsers=[activeUser];

globalThis.__activaPrisma={
  user: {
    async findFirst(query) {
      databaseQueries.push(query);
      if (databaseError) throw databaseError;
      return provisionedUsers[0] || null;
    },
    async findMany(query) {
      databaseQueries.push(query);
      if (databaseError) throw databaseError;
      return provisionedUsers;
    },
  },
};
OAuth2Client.prototype.getFederatedSignonCertsAsync=async function () {
  certificateRequests++;
  return { certs: { "test-key": publicPem }, format: "PEM" };
};

function idToken(overrides={}, { signingKey=privateKey, kid="test-key" }={}) {
  const now=Math.floor(Date.now()/1000);
  const payload={
    iss: "https://accounts.google.com",
    aud: clientId,
    sub: "google-subject-123",
    iat: now-30,
    exp: now+3600,
    email: "Person@Chandra.ac.th",
    email_verified: true,
    hd: "chandra.ac.th",
    ...overrides,
  };
  const encode=(value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned=encode({ alg: "RS256", typ: "JWT", kid })+"."+encode(payload);
  return unsigned+"."+sign("RSA-SHA256", Buffer.from(unsigned), signingKey).toString("base64url");
}

try {
  process.env.NODE_ENV="test";
  process.env.ACTIVA_AUTH_MODE="GOOGLE_OIDC";
  process.env.GOOGLE_CLIENT_ID=clientId;
  process.env.GOOGLE_PILOT_CLIENT_ID=pilotClientId;
  process.env.GOOGLE_ALLOWED_DOMAINS="chandra.ac.th";
  process.env.GOOGLE_ALLOWED_EMAILS="";
  const { attachActor }=await import("../server/auth.js");

  async function request(headers={}) {
    const req={ header(name) { return headers[name.toLowerCase()]; } };
    const result={ req, status: null, body: null, nextCalls: 0, nextError: null };
    const res={
      status(code) { result.status=code; return this; },
      json(body) { result.body=body; return this; },
    };
    await attachActor(req, res, (error) => {
      result.nextCalls++;
      result.nextError=error || null;
    });
    return result;
  }

  async function rejected(label, token, status, error, { headers={}, queries=0 }={}) {
    const beforeQueries=databaseQueries.length;
    const result=await request({ authorization: "Bearer "+token, ...headers });
    assert.equal(result.status,status,label);
    assert.equal(result.body?.error,error,label);
    assert.equal(result.nextCalls,0,label+" must not reach a protected route");
    assert.equal(result.req.activaUser,undefined,label+" must not attach an actor");
    assert.equal(databaseQueries.length-beforeQueries,queries,label+" database query count");
  }

  const success=await request({ authorization: "Bearer "+idToken(), "x-activa-user-id": "ADMIN001" });
  assert.equal(success.nextCalls,1);
  assert.equal(success.nextError,null);
  assert.equal(success.req.activaUser,activeUser,"The verified account determines the actor, never the demo header");
  assert.deepEqual(success.req.authContext,{
    provider: "GOOGLE", subject: "google-subject-123", email: "person@chandra.ac.th", hostedDomain: "chandra.ac.th",
  });
  assert.deepEqual(databaseQueries.at(-1),{ where: { email: { equals: "person@chandra.ac.th", mode: "insensitive" } }, take: 2 });

  process.env.GOOGLE_ALLOWED_EMAILS="pilot.person@gmail.com";
  const gmailUser={ ...activeUser, id:"gmail-user", employeeId:"PILOT_P01", email:"pilot.person@gmail.com" };
  provisionedUsers=[gmailUser];
  const gmailSuccess=await request({ authorization: "Bearer "+idToken({ aud:pilotClientId, email:"Pilot.Person@gmail.com", hd:undefined }) });
  assert.equal(gmailSuccess.nextCalls,1,"Exact allowlisted Gmail account should authenticate");
  assert.equal(gmailSuccess.nextError,null);
  assert.equal(gmailSuccess.req.activaUser,gmailUser);
  assert.deepEqual(gmailSuccess.req.authContext,{
    provider:"GOOGLE", subject:"google-subject-123", email:"pilot.person@gmail.com", hostedDomain:"",
  });
  await rejected(
    "non-allowlisted Gmail account",
    idToken({ aud:pilotClientId, email:"other.person@gmail.com", hd:undefined }),
    403,
    "GOOGLE_ACCOUNT_NOT_ALLOWED"
  );
  const wrongPilotAudience=await request({ authorization:"Bearer "+idToken({ email:"pilot.person@gmail.com", hd:undefined }) });
  assert.equal(wrongPilotAudience.status,403,"allowlisted Gmail must not reuse Internal OAuth client");
  assert.equal(wrongPilotAudience.body?.error,"GOOGLE_ACCOUNT_NOT_ALLOWED");

  process.env.GOOGLE_ALLOWED_EMAILS="";
  provisionedUsers=[activeUser];

  const noBearer=await request({ "x-activa-user-id": "ADMIN001" });
  assert.equal(noBearer.status,401);
  assert.equal(noBearer.body.error,"GOOGLE_ID_TOKEN_REQUIRED");
  assert.equal(noBearer.nextCalls,0,"Header spoofing must not authenticate in GOOGLE_OIDC mode");
  const wrongScheme=await request({ authorization: "Basic "+idToken(), "x-activa-user-id": "ADMIN001" });
  assert.equal(wrongScheme.body.error,"GOOGLE_ID_TOKEN_REQUIRED");

  const now=Math.floor(Date.now()/1000);
  for (const [label, token] of [
    ["malformed JWT", "not-a-jwt"],
    ["wrong signature", idToken({}, { signingKey: unrelatedKey })],
    ["unknown signing key", idToken({}, { kid: "unknown-key" })],
    ["wrong audience", idToken({ aud: "other-client.apps.googleusercontent.com" })],
    ["missing audience", idToken({ aud: undefined })],
    ["wrong issuer", idToken({ iss: "https://attacker.example" })],
    ["missing issuer", idToken({ iss: undefined })],
    ["expired token", idToken({ iat: now-7200, exp: now-3600 })],
    ["future token", idToken({ iat: now+3600, exp: now+7200 })],
    ["missing expiry", idToken({ exp: undefined })],
    ["missing issue time", idToken({ iat: undefined })],
    ["missing subject", idToken({ sub: undefined })],
    ["empty subject", idToken({ sub: " " })],
    ["non-string subject", idToken({ sub: 123 })],
    ["oversized subject", idToken({ sub: "a".repeat(256) })],
  ]) {
    await rejected(label,token,401,"GOOGLE_ID_TOKEN_INVALID", { headers: { "x-activa-user-id": "ADMIN001" } });
  }

  for (const [label, claims] of [
    ["unverified email", { email_verified: false }],
    ["missing email verification", { email_verified: undefined }],
    ["string email verification", { email_verified: "true" }],
    ["missing email", { email: undefined }],
    ["non-string email", { email: ["person@chandra.ac.th"] }],
  ]) {
    await rejected(label,idToken(claims),401,"GOOGLE_EMAIL_NOT_VERIFIED");
  }

  for (const [label, claims] of [
    ["unapproved email domain", { email: "person@example.org" }],
    ["domain suffix attack", { email: "person@chandra.ac.th.attacker.example" }],
    ["unapproved subdomain", { email: "person@staff.chandra.ac.th" }],
    ["malformed email", { email: "person@attacker@chandra.ac.th" }],
    ["email whitespace", { email: "per son@chandra.ac.th" }],
    ["missing hosted domain", { hd: undefined }],
    ["empty hosted domain", { hd: "" }],
    ["non-string hosted domain", { hd: ["chandra.ac.th"] }],
    ["unapproved hosted domain", { hd: "attacker.example" }],
    ["hosted domain suffix attack", { hd: "chandra.ac.th.attacker.example" }],
    ["unapproved hosted subdomain", { hd: "staff.chandra.ac.th" }],
  ]) {
    await rejected(label,idToken(claims),403,"GOOGLE_WORKSPACE_DOMAIN_NOT_ALLOWED");
  }

  provisionedUsers=[];
  await rejected("unprovisioned account",idToken(),403,"GOOGLE_ACCOUNT_NOT_PROVISIONED", { queries: 1 });
  provisionedUsers=[{ ...activeUser, status: "INACTIVE" }];
  await rejected("inactive account",idToken(),403,"INVALID_OR_INACTIVE_USER", { queries: 1 });
  provisionedUsers=[activeUser, { ...activeUser, id: "duplicate-user", email: "Person@Chandra.ac.th", role: "ADMIN" }];
  await rejected("ambiguous account",idToken(),403,"GOOGLE_ACCOUNT_AMBIGUOUS", { queries: 1 });
  provisionedUsers=[activeUser];

  databaseError=new Error("database unavailable");
  const unavailable=await request({ authorization: "Bearer "+idToken() });
  assert.equal(unavailable.nextCalls,1);
  assert.equal(unavailable.nextError,databaseError,"Database failure must reach the error handler without authenticating");
  assert.equal(unavailable.req.activaUser,undefined);
  databaseError=null;

  const beforeCertificates=certificateRequests;
  process.env.GOOGLE_ALLOWED_DOMAINS="*.chandra.ac.th";
  await rejected("invalid domain configuration",idToken(),503,"GOOGLE_OIDC_NOT_CONFIGURED");
  process.env.GOOGLE_ALLOWED_DOMAINS="chandra.ac.th";
  process.env.GOOGLE_ALLOWED_EMAILS="*";
  await rejected("invalid exact-email configuration",idToken(),503,"GOOGLE_OIDC_NOT_CONFIGURED");
  process.env.GOOGLE_ALLOWED_EMAILS="";
  process.env.GOOGLE_CLIENT_ID="invalid-client-id";
  await rejected("invalid client configuration",idToken(),503,"GOOGLE_OIDC_NOT_CONFIGURED");
  assert.equal(certificateRequests,beforeCertificates,"Invalid configuration must not invoke the verifier");
  process.env.GOOGLE_CLIENT_ID=clientId;

  process.env.ACTIVA_AUTH_MODE="DEMO_HEADER";
  process.env.NODE_ENV="production";
  const beforeProductionQueries=databaseQueries.length;
  const productionDemo=await request({ "x-activa-user-id": "ADMIN001" });
  assert.equal(productionDemo.status,503);
  assert.equal(productionDemo.body.error,"DEMO_HEADER_FORBIDDEN_IN_PRODUCTION");
  assert.equal(productionDemo.nextCalls,0);
  assert.equal(databaseQueries.length,beforeProductionQueries);

  process.env.NODE_ENV="test";
  const demo=await request({ "x-activa-user-id": "EMP001" });
  assert.equal(demo.nextCalls,1,"Explicit nonproduction demo mode remains usable for CI");
  assert.equal(demo.req.authContext.provider,"DEMO_HEADER");

  process.env.ACTIVA_AUTH_MODE="DISABLED";
  await rejected("disabled authentication",idToken(),503,"PRODUCTION_AUTHENTICATION_NOT_CONFIGURED");
  console.log("ACTIVA-AI Google OIDC signed-token, Workspace/exact-email allowlist, provisioning and header-spoof regression checks passed");
} finally {
  OAuth2Client.prototype.getFederatedSignonCertsAsync=savedCertFetch;
  if (savedPrisma === undefined) delete globalThis.__activaPrisma;
  else globalThis.__activaPrisma=savedPrisma;
  for (const key of keys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key]=savedEnv[key];
  }
}
