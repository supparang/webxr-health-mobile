import assert from "node:assert/strict";
import { getJson, validateProductionSnapshot, probeWithRetry, verifyProduction } from "../scripts/verify-production.mjs";

const expectedRelease = "ACTIVA-AI-1.0.15";
const good = {
  live: {
    status: 200,
    durationMs: 50,
    body: { ok: true, service: "ACTIVA-AI", releaseVersion: expectedRelease, deploymentTier: "PRODUCTION" },
  },
  ready: {
    status: 200,
    durationMs: 70,
    body: {
      ok: true,
      ready: true,
      releaseVersion: expectedRelease,
      deploymentTier: "PRODUCTION",
      database: "connected",
      authenticationReady: true,
    },
  },
  health: {
    status: 200,
    durationMs: 80,
    body: {
      ok: true,
      releaseVersion: expectedRelease,
      deploymentTier: "PRODUCTION",
      database: "connected",
      autonomousDecision: false,
      productionGoEnabled: true,
      authentication: { mode: "GOOGLE_OIDC", productionReady: true, allowedDomains: ["chandra.ac.th"] },
    },
  },
};

const pass = validateProductionSnapshot({ ...good, expectedRelease, expectedGoogleDomain: "chandra.ac.th" });
assert.equal(pass.ok, true);
assert.deepEqual(pass.errors, []);
assert.equal(pass.summary.aiAutonomousDecision, false);

const wrongTier = validateProductionSnapshot({
  ...good,
  live: { ...good.live, body: { ...good.live.body, deploymentTier: "STAGING" } },
  expectedRelease,
});
assert.equal(wrongTier.ok, false);
assert(wrongTier.errors.includes("LIVE_NOT_PRODUCTION"));

const autonomousAi = validateProductionSnapshot({
  ...good,
  health: { ...good.health, body: { ...good.health.body, autonomousDecision: true } },
  expectedRelease,
});
assert.equal(autonomousAi.ok, false);
assert(autonomousAi.errors.includes("HEALTH_AUTONOMOUS_DECISION_MUST_BE_FALSE"));

const goDisabled = validateProductionSnapshot({
  ...good, health:{...good.health,body:{...good.health.body,productionGoEnabled:false}},
  expectedRelease,
});
assert.equal(goDisabled.ok,false);
assert(goDisabled.errors.includes("HEALTH_PRODUCTION_GO_NOT_ENABLED"));
const wrongAuthMode = validateProductionSnapshot({
  ...good, health:{...good.health,body:{...good.health.body,
    authentication:{...good.health.body.authentication,mode:"DEMO_HEADER"}}},
  expectedRelease,
});
assert.equal(wrongAuthMode.ok,false);
assert(wrongAuthMode.errors.includes("HEALTH_AUTHENTICATION_MODE_MISMATCH"));

const authDown = validateProductionSnapshot({
  ...good,
  ready: { ...good.ready, status: 503, body: { ok: false, ready: false } },
  expectedRelease,
});
assert.equal(authDown.ok, false);
assert(authDown.errors.includes("READY_HTTP_NOT_200"));
assert(authDown.errors.includes("READY_NOT_READY"));


// P3.3: each endpoint is attempted sequentially under a bounded, injectable
// policy. These tests never contact Production or mutate a database.
const policy={timeoutsMs:[10,20,30],backoffMs:[1,2]};
const delays=[];
const sleep=async ms=>{delays.push(ms);};
const responses={
  "/api/live":[{throw:"TimeoutError"},good.live],
  "/api/ready":[{status:503,body:{ok:false,ready:false},durationMs:1},good.ready],
  "/api/health":[{status:502,body:null,durationMs:1},good.health],
};
const sequence=[];
const request=async (_base,path,{timeoutMs})=>{
  sequence.push({path,timeoutMs});
  const next=responses[path].shift();
  if(next.throw){const e=new Error("Synthetic transport failure");e.name=next.throw;throw e;}
  return next;
};
const recovered=await verifyProduction({
  baseUrl:"https://safe-monitor.example.test/",
  expectedRelease,expectedGoogleDomain:"chandra.ac.th",
  request,sleep,policy,
});
assert.equal(recovered.ok,true,JSON.stringify(recovered.errors));
assert.equal(recovered.monitor.classification,"TRANSIENT_RESPONSE_RECOVERED");
assert.deepEqual(sequence.map(x=>x.path),[
  "/api/live","/api/live","/api/ready","/api/ready","/api/health","/api/health",
]);
assert.deepEqual(delays,[1,1,1]);
assert.deepEqual(Object.values(recovered.monitor.attempts).map(a=>a.length),[2,2,2]);

let exhaustedCount=0;
const exhausted=await probeWithRetry("https://safe-monitor.example.test","/api/live",{
  policy,sleep,
  request:async()=>{exhaustedCount++;return {status:503,body:null,durationMs:1};},
});
assert.equal(exhaustedCount,3,"transient gateway must stop at fixed max attempts");
assert.equal(exhausted.exhaustedTransient,true);
assert.equal(exhausted.response.status,503);
const exhaustedRun=await verifyProduction({
  baseUrl:"https://safe-monitor.example.test",expectedRelease,
  policy,sleep,
  request:async(_base,path)=>path==="/api/live" ? {status:503,body:null,durationMs:1}
    : path==="/api/ready" ? good.ready : good.health,
});
assert.equal(exhaustedRun.ok,false,"exhausted cold start cannot report success");
assert.equal(exhaustedRun.monitor.classification,"TRANSIENT_PROBE_EXHAUSTED");
assert(exhaustedRun.errors.includes("LIVE_HTTP_NOT_200"));

let fatalCalls=0;
const fatal=await probeWithRetry("https://safe-monitor.example.test","/api/live",{
  policy,sleep,request:async()=>{fatalCalls++;return {status:401,body:{ok:false},durationMs:1};},
});
assert.equal(fatalCalls,1,"authentication failure must not be retried");
assert.equal(fatal.exhaustedTransient,false);
let badJsonCalls=0;
const invalidJson=await probeWithRetry("https://safe-monitor.example.test","/api/health",{
  policy,sleep,request:async()=>{badJsonCalls++;return {status:200,body:null,durationMs:1};},
});
assert.equal(badJsonCalls,1,"malformed HTTP 200 must fail validation, not be retried");

const unsafe=await verifyProduction({
  baseUrl:"https://safe-monitor.example.test",expectedRelease,
  expectedGoogleDomain:"chandra.ac.th",policy,sleep,
  request:async(_base,path)=>path==="/api/live" ? good.live :
    path==="/api/ready" ? good.ready : {...good.health,body:{...good.health.body,autonomousDecision:true}},
});
assert.equal(unsafe.ok,false,"governance breach must never be hidden by retries");
assert.equal(unsafe.monitor.classification,"GOVERNANCE_OR_READINESS_FAILURE");
assert(unsafe.errors.includes("HEALTH_AUTONOMOUS_DECISION_MUST_BE_FALSE"));

const bodyTimeout=Object.assign(new Error("synthetic body timeout"),{name:"TimeoutError"});
await assert.rejects(
  getJson("https://safe-monitor.example.test","/api/live",{
    timeoutMs:50,
    fetchImpl:async()=>({status:200,json:async()=>{throw bodyTimeout;}}),
  }),
  /synthetic body timeout/,
  "aborted JSON body read must remain a retryable transport error"
);
const malformedBody=await getJson("https://safe-monitor.example.test","/api/live",{
  timeoutMs:50,
  fetchImpl:async()=>({status:200,json:async()=>{throw new SyntaxError("bad JSON");}}),
});
assert.equal(malformedBody.status,200);
assert.equal(malformedBody.body,null,"malformed 200 must not be considered valid JSON");

await assert.rejects(
  probeWithRetry("https://safe-monitor.example.test","/api/live",{policy:{timeoutsMs:[],backoffMs:[]}}),
  /INVALID_MONITOR_PROBE_POLICY/
);
console.log("P3.3 bounded cold-start retry, transient exhaustion, malformed response and governance tests PASS.");

console.log("ACTIVA-AI production monitor validation tests passed");
