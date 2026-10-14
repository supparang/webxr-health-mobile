import assert from "node:assert/strict";
import { createSecurityAlertDispatcher, securityAlertDeliveryErrors } from "../server/security-alert-delivery.js";
import { createSecurityMonitor } from "../server/security-monitor.js";

// No network, Production credentials or database. fetchImpl is fully mocked.
const token="github_pat_"+"Z".repeat(56);
const config={
  ACTIVA_SECURITY_ALERT_MODE:"GITHUB_ISSUE",
  ACTIVA_SECURITY_ALERT_GITHUB_REPO:"supparang/webxr-health-mobile",
  ACTIVA_SECURITY_ALERT_GITHUB_TOKEN:token,
  ACTIVA_SECURITY_ALERT_GITHUB_ASSIGNEE:"supparang",
};
const alert={
  type:"security_alert",category:"AUTH_DENIED",
  count:25,threshold:25,periodMinutes:15,
  severity:"HIGH",timestampUtc:"2026-10-14T00:00:00.000Z",
  url:"/api/secret-person-123",userId:"CONFIDENTIAL-USER",
  authorization:"Bearer CONFIDENTIAL-TOKEN",
};
assert.deepEqual(securityAlertDeliveryErrors(config),[]);
assert.ok(securityAlertDeliveryErrors({...config,ACTIVA_SECURITY_ALERT_MODE:"UNSUPPORTED"})
  .includes("ACTIVA_SECURITY_ALERT_MODE_INVALID"));
assert.ok(securityAlertDeliveryErrors({...config,ACTIVA_SECURITY_ALERT_GITHUB_REPO:"localhost/../../x"})
  .includes("ACTIVA_SECURITY_ALERT_GITHUB_REPO_INVALID"));
assert.ok(securityAlertDeliveryErrors({...config,ACTIVA_SECURITY_ALERT_GITHUB_TOKEN:"not-private"})
  .includes("ACTIVA_SECURITY_ALERT_GITHUB_TOKEN_REQUIRED"));
assert.ok(securityAlertDeliveryErrors({...config,ACTIVA_SECURITY_ALERT_GITHUB_ASSIGNEE:"a@example.test"})
  .includes("ACTIVA_SECURITY_ALERT_GITHUB_ASSIGNEE_INVALID"));

const calls=[];
const logs=[];
let exists=false;
const fakeFetch=async (url,init)=>{
  calls.push({url,init});
  assert.ok(url.startsWith("https://api.github.com/repos/supparang/webxr-health-mobile/"),
    "No request may leave the fixed GitHub API endpoint");
  assert.equal(init.redirect,"error","Never follow redirects with GitHub credentials");
  assert.equal(init.headers.Authorization,"Bearer "+token);
  if(init.method==="GET")return{
    ok:true,status:200,
    json:async()=>exists?[{number:612,title:"[SECURITY ALERT] ACTIVA-AI AUTH_DENIED"}]:[],
  };
  if(init.method==="POST"&&url.endsWith("/issues")){
    const payload=JSON.parse(init.body);
    assert.equal(payload.title,"[SECURITY ALERT] ACTIVA-AI AUTH_DENIED");
    assert.deepEqual(payload.assignees,["supparang"]);
    exists=true;
    return {ok:true,status:201,json:async()=>({number:612})};
  }
  if(init.method==="POST"&&url.endsWith("/issues/612/comments")) {
    assert.ok(init.body.includes("AUTH_DENIED"));
    return {ok:true,status:201,json:async()=>({id:300})};
  }
  throw new Error("Unexpected outbound API action");
};

const dispatcher=createSecurityAlertDispatcher({
  env:config,fetchImpl:fakeFetch,write:e=>logs.push(e),
});
let sent=await dispatcher.enqueue(alert);
assert.deepEqual(sent,{status:"ACKNOWLEDGED_BY_GITHUB",action:"CREATED"});
assert.equal(dispatcher.snapshot().delivered,1);
assert.equal(dispatcher.snapshot().failed,0);
assert.equal(dispatcher.snapshot().configured,true);
assert.equal(calls.length,2);
assert.equal(calls[0].init.method,"GET");
assert.equal(calls[1].init.method,"POST");
sent=await dispatcher.enqueue({...alert,timestampUtc:"2026-10-14T00:15:00.000Z",count:26});
assert.equal(sent.action,"COMMENTED","Reuse same open category issue");
assert.equal(calls.length,4);
assert.ok(calls[3].url.endsWith("/issues/612/comments"));
assert.equal((await dispatcher.enqueue({...alert,category:"NOT_ALLOWED"})).status,"REJECTED");
assert.equal(dispatcher.snapshot().rejected,1);

// Log/Summary/issue content MUST NEVER expose identity, URLs or credentials.
const serialized=JSON.stringify({logs,issues:calls.map(x=>x.init.body||""),
  snapshot:dispatcher.snapshot()});
for (const privateValue of [
  token,"CONFIDENTIAL-USER","CONFIDENTIAL-TOKEN",
  "/api/secret-person-123","a@example.test",
])assert.equal(serialized.includes(privateValue),false,"Sensitive value leaked to alert payload");

// S2.3 creates one security_alert per category/window, not per bad request.
let tick=Date.parse("2026-10-14T12:00:00.000Z");
const monitorDispatches=[];
const monitor=createSecurityMonitor({
  now:()=>tick, thresholds:{AUTH_DENIED:3},
  write:event=>{
    if(event.type==="security_alert")monitorDispatches.push(event);
  },
});
for(let i=0;i<45;i++)monitor.recordHttp({
  originalUrl:"/api/me",method:"GET",activaRequestId:"test-request-id",
},401);
assert.equal(monitorDispatches.length,1,"Repeated requests must not fan out alerts within 15 minutes");
tick+=15*60*1000;
for(let i=0;i<3;i++)monitor.recordHttp({originalUrl:"/api/me",method:"GET"},401);
assert.equal(monitorDispatches.length,2,"A new 15 minute window may issue next update");

// Disabled mode must never call network.
const disabled=createSecurityAlertDispatcher({
  env:{ACTIVA_SECURITY_ALERT_MODE:"DISABLED"},
  fetchImpl:async()=>{throw new Error("DISABLED_NOTIFICATION_MUST_NOT_SEND");},
  write:()=>{},
});
assert.equal((await disabled.enqueue(alert)).status,"DISABLED");
assert.equal(disabled.snapshot().delivered,0);

// A rejected or failed GitHub API request does not crash API processing, and
// failure output contains no HTTP response, token, repo URL, or request payload.
const failedLogs=[];
const failed=createSecurityAlertDispatcher({
  env:config,
  fetchImpl:async()=>({ok:false,status:403,json:async()=>({message:"secret"})}),
  write:e=>failedLogs.push(e),
});
assert.equal((await failed.enqueue(alert)).status,"FAILED");
assert.equal(failed.snapshot().failed,1);
assert.equal(failedLogs[0].status,"FAILED");
assert.ok(!JSON.stringify(failedLogs).includes(token));
assert.ok(!JSON.stringify(failedLogs).includes("secret"));

// Simulate temporarily stuck calls: no more than 4 notifications in-flight.
let release;
const held=new Promise(resolve=>{release=resolve;});
const saturated=createSecurityAlertDispatcher({
  env:config,
  fetchImpl:async (url,init)=>{
    await held;
    return {ok:true,status:200,json:async()=>[]};
  },
  write:()=>{},
});
const pending=[...Array(4)].map(()=>saturated.enqueue(alert));
assert.equal(saturated.snapshot().pending,4);
const fifth=await saturated.enqueue(alert);
assert.equal(fifth.status,"OVER_CAPACITY");
assert.equal(saturated.snapshot().failed,1);
release();
await Promise.all(pending);
await saturated.drain();
assert.equal(saturated.snapshot().pending,0);
console.log("ACTIVA-AI S2.4 alert delivery (mock GitHub API) checks: PASS");
