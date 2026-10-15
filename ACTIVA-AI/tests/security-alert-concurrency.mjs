import assert from "node:assert/strict";
import {createSecurityAlertDispatcher} from "../server/security-alert-delivery.js";

// S2.14 — GitHub API fully mocked. Never sends an actual issue or token.
// Concurrent distinct 15-minute anomalies for the SAME category must not
// create competing GitHub Issues within a single Node process.
const credentials="github_pat_"+"Y".repeat(58);
const env={
  ACTIVA_SECURITY_ALERT_MODE:"GITHUB_ISSUE",
  ACTIVA_SECURITY_ALERT_GITHUB_REPO:"test-org/alert-fixtures",
  ACTIVA_SECURITY_ALERT_GITHUB_TOKEN:credentials,
};
const base="https://api.github.com/repos/test-org/alert-fixtures";
const sample=Object.freeze({
  type:"security_alert",category:"RATE_LIMITED",severity:"HIGH",
  timestampUtc:"2026-10-15T00:00:00.000Z",periodMinutes:15,
  threshold:20,count:22,
  ip:"198.51.100.42",userId:"IDENTIFIABLE-PARTICIPANT",
  token:"SENSITIVE-DO-NOT-EMIT",
});
const sampleLater={...sample,timestampUtc:"2026-10-15T00:15:00.000Z",count:30};
let releaseGet;
const paused=new Promise(resolve=>{releaseGet=resolve;});
const apiCalls=[];
const messages=[];
let issueCount=0;
const mock=async (url,req)=>{
  assert(url.startsWith(base+"/"),"API token may only go to GitHub fixed origin");
  assert.equal(req.redirect,"error");
  assert.equal(req.headers.Authorization,"Bearer "+credentials);
  apiCalls.push({url,method:req.method,body:req.body||""});
  if (req.method==="GET"){
    if(apiCalls.length===1)await paused;
    return {ok:true,status:200,json:async()=>
      issueCount?[{number:823,title:"[SECURITY ALERT] ACTIVA-AI RATE_LIMITED"}]:[]};
  }
  if(url.endsWith("/issues")){
    issueCount++;
    return {ok:true,status:201,json:async()=>({number:823})};
  }
  assert(url.endsWith("/issues/823/comments"));
  return {ok:true,status:201,json:async()=>({id:991})};
};
const dispatcher=createSecurityAlertDispatcher({
  env,fetchImpl:mock,write:line=>messages.push(line),
});
const initial=dispatcher.enqueue(sample);
const later=dispatcher.enqueue(sampleLater);
assert.equal(dispatcher.snapshot().pending,2);
await Promise.resolve();
assert.equal(apiCalls.length,1,"Category mutex must wait for first delivery");
releaseGet();
const receipts=await Promise.all([initial,later]);
await dispatcher.drain();
assert.deepEqual(receipts.map(x=>x.action),["CREATED","COMMENTED"]);
assert.equal(issueCount,1,"Concurrent same-category alerts created duplicate GitHub Issues");
assert.deepEqual(apiCalls.map(x=>x.method),["GET","POST","GET","POST"]);
assert.equal(dispatcher.snapshot().delivered,2);
assert.equal(dispatcher.snapshot().failed,0);
assert.equal(dispatcher.snapshot().pending,0);
const exposed=JSON.stringify({apiCalls,messages,snapshot:dispatcher.snapshot()});
for(const v of [credentials,sample.ip,sample.userId,sample.token]){
  assert(!exposed.includes(v),"Security alert leaked private data to logs/Issue");
}

async function checkInvalidReceipt({existing,body}) {
  const lines=[];
  const transport=async (url,req)=>{
    if(req.method==="GET"){
      return {ok:true,status:200,json:async()=>existing?
        [{number:998,title:"[SECURITY ALERT] ACTIVA-AI RATE_LIMITED"}]:[]};
    }
    return {ok:true,status:201,json:async()=>body};
  };
  const service=createSecurityAlertDispatcher({
    env,fetchImpl:transport,write:item=>lines.push(item),
  });
  const result=await service.enqueue(sample);
  assert.equal(result.status,"FAILED","Malformed 2xx receipt must not indicate success");
  assert.equal(service.snapshot().delivered,0);
  assert.equal(service.snapshot().failed,1);
  assert.equal(lines.length,1);
  assert.equal(lines[0].status,"FAILED");
  assert(!JSON.stringify(lines).includes(credentials));
}
await checkInvalidReceipt({existing:false,body:{}});
await checkInvalidReceipt({existing:false,body:{number:0}});
await checkInvalidReceipt({existing:false,body:{number:"998"}});
await checkInvalidReceipt({existing:true,body:{}});
await checkInvalidReceipt({existing:true,body:{id:null}});
await checkInvalidReceipt({existing:true,body:{id:"not-integer"}});

// A downstream network error must not poison later sequential deliveries.
let calls=0;
const recovering=createSecurityAlertDispatcher({
  env,
  fetchImpl:async(url,req)=>{
    if(req.method==="GET"){
      calls++;
      if(calls===1)throw new Error("TOKEN_AND_USER_INFO_MUST_NOT_LOG");
      return {ok:true,status:200,json:async()=>[]};
    }
    return {ok:true,status:201,json:async()=>({number:902})};
  },
  write:()=>{},
});
const pair=await Promise.all([
  recovering.enqueue(sample),recovering.enqueue(sampleLater),
]);
assert.equal(pair[0].status,"FAILED");
assert.equal(pair[1].status,"ACKNOWLEDGED_BY_GITHUB");
assert.equal(recovering.snapshot().delivered,1);
assert.equal(recovering.snapshot().failed,1);

// Production remains disabled until human operators explicitly configure it.
const disabled=createSecurityAlertDispatcher({
  env:{ACTIVA_SECURITY_ALERT_MODE:"DISABLED"},
  fetchImpl:async()=>{throw Error("DISABLED_NETWORK_CALL");},
});
assert.equal((await disabled.enqueue(sample)).status,"DISABLED");
console.log("ACTIVA-AI S2.14 GitHub alert concurrent delivery and strict receipt tests: PASS");
