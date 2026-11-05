// S2.5 — Integration contract for throttling -> security aggregation -> optional
// GitHub alert delivery. Uses ONLY localhost + mocked GitHub API and no database.
import assert from "node:assert/strict";
import express from "express";
import {createActivaRateLimiters} from "../server/rate-limit.js";
import {createSecurityMonitor} from "../server/security-monitor.js";
import {createSecurityAlertDispatcher} from "../server/security-alert-delivery.js";

const token = "github_pat_"+"T".repeat(56);
const messages = [];
const issues = [];
const requests = [];
const fakeGitHub = async (url,opts) => {
  assert(url.startsWith("https://api.github.com/repos/ci-fixture/integration-security/"));
  assert.equal(opts.redirect, "error");
  assert.equal(opts.headers.Authorization, "Bearer "+token);
  const path = new URL(url).pathname;
  requests.push({path,method:opts.method,body:opts.body||""});
  if(opts.method === "GET") return {
    ok:true,status:200,json:async()=>issues.map(x=>({number:x.number,title:x.title})),
  };
  if(opts.method === "POST" && path.endsWith("/issues")) {
    const data=JSON.parse(opts.body);
    issues.push({number:issues.length+1,title:data.title,body:data.body});
    return {ok:true,status:201,json:async()=>({number:issues.length})};
  }
  if(opts.method === "POST" && path.includes("/issues/") &&
      path.endsWith("/comments")) return {ok:true,status:201,json:async()=>({id:201})};
  throw Error("UNEXPECTED_GITHUB_MOCK_REQUEST");
};
const delivery=createSecurityAlertDispatcher({
  env:{
    ACTIVA_SECURITY_ALERT_MODE:"GITHUB_ISSUE",
    ACTIVA_SECURITY_ALERT_GITHUB_REPO:"ci-fixture/integration-security",
    ACTIVA_SECURITY_ALERT_GITHUB_TOKEN:token,
  },
  fetchImpl:fakeGitHub,
  write:(e)=>messages.push(e),
});
const emitted=[];
const monitor=createSecurityMonitor({
  thresholds:{RATE_LIMITED:2,ACCESS_DENIED:1},
  write:event=>{
    emitted.push(event);
    if(event.type==="security_alert") void delivery.enqueue(event);
  },
});
const limiter=createActivaRateLimiters({
  NODE_ENV:"test",ACTIVA_RATE_LIMIT_ENABLED:"true",
  ACTIVA_RATE_LIMIT_ALL_IP:"200",
  ACTIVA_RATE_LIMIT_GUEST_IP:"100",ACTIVA_RATE_LIMIT_GUEST_PASS:"2",
  ACTIVA_RATE_LIMIT_REVIEWER_IP:"100",ACTIVA_RATE_LIMIT_REVIEWER_PASS:"2",
  ACTIVA_RATE_LIMIT_ACTOR:"100",ACTIVA_RATE_LIMIT_ACTOR_WRITE:"2",
});
const app=express();
app.disable("x-powered-by");
app.use((req,res,next)=>{
  req.activaRequestId="ci-integration-request";
  res.on("finish",()=>monitor.recordHttp(req,res.statusCode));
  next();
});
app.use("/api",limiter.perIp);
app.use("/api/public/guest",limiter.guestIp,limiter.guestPass);
app.use("/api/public/blind-review",limiter.reviewerIp,limiter.reviewerPass);
app.get("/api/live",(_req,res)=>res.json({ok:true}));
app.get("/api/public/guest/session",(_req,res)=>res.json({ok:true}));
app.use("/api",(req,_res,next)=>{req.activaUser={id:req.get("x-fixture-actor")||"person-a"};next();});
app.use("/api",limiter.authenticated,limiter.authenticatedWrite);
app.post("/api/activities/:activityId/evaluate",(req,res)=>{
  if(req.params.activityId!=="authorized-activity")
    return res.status(403).json({ok:false,error:"FORBIDDEN"});
  return res.json({ok:true});
});
app.get("/api/operations/security-summary",(req,res)=>{
  if(req.activaUser.id!=="admin")return res.status(403).json({ok:false,error:"FORBIDDEN"});
  return res.json({ok:true,monitor:monitor.snapshot(),delivery:delivery.snapshot()});
});
const server=await new Promise(resolve=>{
  const listener=app.listen(0,"127.0.0.1",()=>resolve(listener));
});
const base="http://127.0.0.1:"+server.address().port;
async function call(route,{method="GET",headers={}}={}) {
  const response=await fetch(base+route,{method,headers});
  return {status:response.status,data:await response.json(),
    retry:response.headers.get("Retry-After")};
}
try {
  assert.equal((await call("/api/live")).status,200);
  // An authenticated actor can modify an assigned activity, not another.
  const headers={"x-fixture-actor":"person-a"};
  const bad=await call("/api/activities/unassigned/evaluate",{method:"POST",headers});
  assert.equal(bad.status,403);
  assert.equal((await call("/api/activities/authorized-activity/evaluate",
    {method:"POST",headers})).status,200);
  const rejected=await call("/api/activities/authorized-activity/evaluate",
    {method:"POST",headers});
  assert.equal(rejected.status,429,"Third state-changing request must be throttled");
  assert(rejected.retry && Number(rejected.retry)>0,"Client must get Retry-After");
  assert.equal((await call("/api/activities/authorized-activity/evaluate",
    {method:"POST",headers})).status,429);

  // The same network must not share actor quotas.
  assert.equal((await call("/api/activities/authorized-activity/evaluate",
    {method:"POST",headers:{"x-fixture-actor":"person-b"}})).status,200);

  const g="GuestPass "+"A".repeat(43);
  assert.equal((await call("/api/public/guest/session",
    {headers:{Authorization:g}})).status,200);
  assert.equal((await call("/api/public/guest/session",
    {headers:{Authorization:g}})).status,200);
  assert.equal((await call("/api/public/guest/session",
    {headers:{Authorization:g}})).status,429);
  assert.equal((await call("/api/public/guest/session",
    {headers:{Authorization:"GuestPass "+"B".repeat(43)}})).status,200);

  await delivery.drain();
  const summary=await call("/api/operations/security-summary",
    {headers:{"x-fixture-actor":"admin"}});
  assert.equal(summary.status,200);
  assert.equal(summary.data.monitor.categories.RATE_LIMITED,3);
  assert.equal(summary.data.monitor.categories.ACCESS_DENIED,1);
  assert(summary.data.monitor.alerts.some(x=>x.category==="RATE_LIMITED"));
  assert.equal(summary.data.delivery.delivered,2);
  assert.equal(issues.length,2,"One issue per alert category");
  assert.equal((await call("/api/operations/security-summary",
    {headers:{"x-fixture-actor":"person-a"}})).status,403);

  const payload=JSON.stringify({issues,requests,messages,emitted,summary:summary.data});
  for(const forbidden of [token,"person-a","person-b",g,"Authorization:",
    "unassigned","authorized-activity"]) {
    assert(!payload.includes(forbidden),"Private request details leaked: "+forbidden);
  }
  assert.equal(summary.data.delivery.configured,true);
  assert.equal(summary.data.delivery.persistent,false);
  console.log("ACTIVA-AI S2.5 integrated limits, security events and mock alert delivery: PASS");
} finally {
  await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
}
