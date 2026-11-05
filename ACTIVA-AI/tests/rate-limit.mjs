import assert from "node:assert/strict";
import express from "express";
import {
  createFixedWindowLimiter,
  createActivaRateLimiters,
  rateLimitingEnabled,
} from "../server/rate-limit.js";
import { deploymentConfigurationErrors } from "../server/deployment-config.js";

// No secrets, database, remote services, or actual Production requests.
// All integration requests target an ephemeral localhost Express server.
assert.equal(rateLimitingEnabled({NODE_ENV:"production"}), true);
assert.equal(rateLimitingEnabled({NODE_ENV:"production",ACTIVA_RATE_LIMIT_ENABLED:"false"}), true);
assert.equal(rateLimitingEnabled({NODE_ENV:"test"}), false);
assert.equal(rateLimitingEnabled({NODE_ENV:"test",ACTIVA_RATE_LIMIT_ENABLED:"true"}), true);

function fakeResponse() {
  return {
    statusCode:200, headers:{}, payload:null,
    set(name,value){this.headers[name.toLowerCase()]=String(value);return this;},
    status(value){this.statusCode=value;return this;},
    json(body){this.payload=body;return this;},
  };
}
let tick=10_000;
const fakeRequest={path:"/test",method:"GET",ip:"127.0.0.1",activaRequestId:"req-test"};
const fixed=createFixedWindowLimiter({
  category:"unit",limit:2,windowMs:1000,keyFor:(req)=>req.ip,now:()=>tick,capacity:1,
});
const invoke=(middleware,req=fakeRequest)=>{
  let nextCount=0;const res=fakeResponse();
  middleware(req,res,()=>{nextCount++;});
  return {res,nextCount};
};
assert.equal(invoke(fixed).nextCount,1);
assert.equal(invoke(fixed).nextCount,1);
let blocked=invoke(fixed);
assert.equal(blocked.res.statusCode,429);
assert.equal(blocked.res.payload.error,"RATE_LIMITED");
assert.equal(blocked.res.headers["retry-after"],"1");
assert.equal(blocked.res.headers["cache-control"],"no-store");
// Under capacity pressure, never evict an active key and thereby permit bypass.
const saturated=invoke(fixed,{...fakeRequest,ip:"127.0.0.2"});
assert.equal(saturated.res.statusCode,503);
assert.equal(saturated.res.payload.error,"RATE_LIMIT_CAPACITY_EXCEEDED");
tick+=1001;
assert.equal(invoke(fixed,{...fakeRequest,ip:"127.0.0.2"}).nextCount,1);

// End-to-end test of middleware installation order, public bearer segmentation,
// shared-IP fairness and separate quotas for authenticated users.
tick=20_000;
const env={
  NODE_ENV:"test", ACTIVA_RATE_LIMIT_ENABLED:"true",
  ACTIVA_RATE_LIMIT_ALL_IP:"100",
  ACTIVA_RATE_LIMIT_GUEST_IP:"30", ACTIVA_RATE_LIMIT_GUEST_PASS:"2",
  ACTIVA_RATE_LIMIT_REVIEWER_IP:"30", ACTIVA_RATE_LIMIT_REVIEWER_PASS:"2",
  ACTIVA_RATE_LIMIT_ACTOR:"30", ACTIVA_RATE_LIMIT_ACTOR_WRITE:"2",
};
const limiters=createActivaRateLimiters(env,()=>tick);
assert.equal(limiters.enabled,true);
const app=express();
app.disable("x-powered-by");
// IMPORTANT: leave Express trust proxy disabled. Untrusted X-Forwarded-For
// values must not select arbitrary rate-limit identities.
app.use("/api",limiters.perIp);
app.use("/api/public/guest",limiters.guestIp,limiters.guestPass);
app.use("/api/public/blind-review",limiters.reviewerIp,limiters.reviewerPass);
app.get("/api/live",(_req,res)=>res.json({ok:true}));
app.get("/api/public/guest/session",(_req,res)=>res.json({ok:true}));
app.post("/api/public/guest/checkin",(_req,res)=>res.json({ok:true}));
app.post("/api/public/blind-review/submit",(_req,res)=>res.json({ok:true}));
app.use("/api",(req,res,next)=>{
  req.activaUser={id:req.get("x-test-actor")||"unit-a"};
  next();
});
app.use("/api",limiters.authenticated,limiters.authenticatedWrite);
app.get("/api/me",(_req,res)=>res.json({ok:true}));
app.post("/api/activities",(_req,res)=>res.json({ok:true}));
const server=await new Promise((resolve)=> {
  const listener=app.listen(0,"127.0.0.1",()=>resolve(listener));
});
const host="http://127.0.0.1:"+server.address().port;
async function fetchLocal(path,{method="GET",headers={}}={}) {
  const response=await fetch(host+path,{method,headers});
  return {status:response.status,body:await response.json(),headers:response.headers};
}
try {
  const passA="A".repeat(43);
  const passB="B".repeat(43);
  for(let i=0;i<2;i++) {
    assert.equal((await fetchLocal("/api/public/guest/session",{
      headers:{Authorization:"GuestPass "+passA},
    })).status,200);
  }
  const rejected=await fetchLocal("/api/public/guest/session",{
    headers:{Authorization:"GuestPass "+passA},
  });
  assert.equal(rejected.status,429);
  assert.equal(rejected.body.error,"RATE_LIMITED");
  assert.equal(rejected.headers.get("retry-after"),"60");
  assert.equal((await fetchLocal("/api/public/guest/session",{
    headers:{Authorization:"GuestPass "+passB},
  })).status,200,"another participant behind the same Wi-Fi must have own quota");

  const blindPass="C".repeat(43);
  assert.equal((await fetchLocal("/api/public/blind-review/submit",{
    method:"POST",headers:{Authorization:"BlindReview "+blindPass},
  })).status,200);
  assert.equal((await fetchLocal("/api/public/blind-review/submit",{
    method:"POST",headers:{Authorization:"BlindReview "+blindPass},
  })).status,200);
  assert.equal((await fetchLocal("/api/public/blind-review/submit",{
    method:"POST",headers:{Authorization:"BlindReview "+blindPass},
  })).status,429,"reviewer link must have a separate limiter");

  assert.equal((await fetchLocal("/api/activities",{
    method:"POST",headers:{"x-test-actor":"actor-a"},
  })).status,200);
  assert.equal((await fetchLocal("/api/activities",{
    method:"POST",headers:{"x-test-actor":"actor-a"},
  })).status,200);
  assert.equal((await fetchLocal("/api/activities",{
    method:"POST",headers:{"x-test-actor":"actor-a"},
  })).status,429,"actor write quota not enforced");
  assert.equal((await fetchLocal("/api/activities",{
    method:"POST",headers:{"x-test-actor":"actor-b"},
  })).status,200,"second authenticated actor must have distinct quota");
  assert.equal((await fetchLocal("/api/me",{
    headers:{"x-test-actor":"actor-a"},
  })).status,200,"write limit should not prevent own read");
  assert.equal((await fetchLocal("/api/live")).status,200,"liveness should not be throttled");

  tick+=60_001;
  assert.equal((await fetchLocal("/api/public/guest/session",{
    headers:{Authorization:"GuestPass "+passA},
  })).status,200,"quota must reset after window");
} finally {
  await new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));
}

// Synthetic classroom fairness: 250 guests, three requests each, sharing one NAT.
// This is a deterministic functional check, NOT a measured concurrency/load test.
const classroomLimiters=createActivaRateLimiters({
  NODE_ENV:"test",ACTIVA_RATE_LIMIT_ENABLED:"true",
},()=>tick);
for(let participant=0;participant<250;participant++) {
  const token=String(participant).padStart(43,"G");
  const req={
    ip:"shared-classroom-gateway",path:"/session",method:"GET",
    get:(name)=>name==="authorization"?"GuestPass "+token:"",
  };
  for(let request=0;request<3;request++) {
    for(const limiter of [
      classroomLimiters.perIp,classroomLimiters.guestIp,classroomLimiters.guestPass
    ]) {
      const result=invoke(limiter,req);
      assert.equal(result.nextCount,1,"Shared NAT must not block legitimate 250-guest synthetic flow");
    }
  }
}

// A forged X-Forwarded-For must not create a fresh IP bucket while
// Express trust proxy remains disabled (the secure default).
const spoofLimits=createActivaRateLimiters({
  NODE_ENV:"test",ACTIVA_RATE_LIMIT_ENABLED:"true",
  ACTIVA_RATE_LIMIT_ALL_IP:"2",
},()=>tick);
const spoofApp=express();
spoofApp.use("/api",spoofLimits.perIp);
spoofApp.get("/api/data",(_req,res)=>res.json({ok:true}));
const spoofServer=await new Promise(resolve=>{
  const listener=spoofApp.listen(0,"127.0.0.1",()=>resolve(listener));
});
try {
  const url="http://127.0.0.1:"+spoofServer.address().port+"/api/data";
  for(const [n,status] of [[1,200],[2,200],[3,429]]) {
    const response=await fetch(url,{
      headers:{"X-Forwarded-For":"198.51.100."+n},
    });
    assert.equal(response.status,status,"Forged X-Forwarded-For must not evade IP quota");
  }
} finally {
  await new Promise((resolve,reject)=>
    spoofServer.close(error=>error?reject(error):resolve()));
}

// Fail-closed quota configuration, with valid full Production mock controls.
const config={
  NODE_ENV:"production",
  ACTIVA_DEPLOYMENT_TIER:"PRODUCTION",
  ACTIVA_AUTH_MODE:"GOOGLE_OIDC",
  GOOGLE_CLIENT_ID:"517090311491-u00q8g6aonuj2251ak7erqcose70gg2h.apps.googleusercontent.com",
  GOOGLE_ALLOWED_DOMAINS:"chandra.ac.th",
  ALLOWED_ORIGINS:"https://supparang.github.io",
  DATABASE_URL:"postgresql://user:unit-only-db-password@db.internal/activa?sslmode=require",
  QR_SIGNING_SECRET:"5e6c9d8a".repeat(8),
  RESEARCH_HASH_SALT:"7a3f4b2c".repeat(8),
  ACTIVA_PRODUCTION_GO_ENABLED:"false",
};
assert.deepEqual(deploymentConfigurationErrors(config),[]);
assert.ok(deploymentConfigurationErrors({...config, ACTIVA_RATE_LIMIT_ENABLED:"false"})
  .includes("PRODUCTION_RATE_LIMIT_MUST_BE_ENABLED"));
assert.ok(deploymentConfigurationErrors({...config, ACTIVA_RATE_LIMIT_GUEST_PASS:"0"})
  .includes("ACTIVA_RATE_LIMIT_GUEST_PASS_INVALID"));
assert.ok(deploymentConfigurationErrors({...config, ACTIVA_RATE_LIMIT_ALL_IP:"not-a-number"})
  .includes("ACTIVA_RATE_LIMIT_ALL_IP_INVALID"));
console.log("ACTIVA-AI S2.2 API rate limiting: all isolated tests PASSED");
