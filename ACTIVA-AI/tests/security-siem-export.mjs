// S3.4: Real disposable localhost PostgreSQL + mocked HTTPS receiver.
// NEVER sends requests to institution or actual third-party endpoint.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {prisma} from "../server/db.js";
import {createDurableSecurityIncidentStore} from "../server/security-incident-store.js";
import {createSiemIncidentExporter,siemExportConfigErrors}
  from "../server/security-siem-export.js";
import {deploymentConfigurationErrors} from "../server/deployment-config.js";

const env=process.env;
if(env.CI!=="true"||env.ALLOW_SYNTHETIC_CI!=="true"||
  env.ACTIVA_TEST_DATABASE_ONLY!=="true"||
  env.ACTIVA_DEPLOYMENT_TIER!=="STAGING"||
  !/^postgres(?:ql)?:\/\/[^@]+@(?:localhost|127\.0\.0\.1):5432\//.test(env.DATABASE_URL||"")){
  throw Error("S34_DISPOSABLE_LOCAL_POSTGRES_REQUIRED");
}
const secret="S34_ONLY_DISPOSABLE_CI_EXTERNAL_SIEM_KEY_"+ "P".repeat(40);
const config={
  ACTIVA_SIEM_EXPORT_MODE:"HTTPS_WEBHOOK",
  ACTIVA_SIEM_EXPORT_ORIGIN:"https://siem.chandra.ac.th",
  ACTIVA_SIEM_EXPORT_HMAC_SECRET:secret,
};
assert.deepEqual(siemExportConfigErrors(config),[]);
for(const bad of [
  "http://siem.chandra.ac.th","https://127.0.0.1",
  "https://localhost","https://siem.local",
  "https://siem.chandra.ac.th/extra","https://siem.chandra.ac.th?token=x",
  "https://u:pwd@siem.chandra.ac.th",
  "https://siem.example","https://siem.chandra.ac.th:8443",
]){
  assert(siemExportConfigErrors({...config,ACTIVA_SIEM_EXPORT_ORIGIN:bad})
    .includes("ACTIVA_SIEM_EXPORT_ORIGIN_INVALID"),bad);
}
assert(siemExportConfigErrors({...config,ACTIVA_SIEM_EXPORT_HMAC_SECRET:"weak"})
  .includes("ACTIVA_SIEM_EXPORT_HMAC_SECRET_REQUIRED"));
assert(siemExportConfigErrors({...config,QR_SIGNING_SECRET:secret})
  .includes("ACTIVA_SIEM_EXPORT_KEY_MUST_BE_DISTINCT"));
assert(siemExportConfigErrors({
  ACTIVA_DEPLOYMENT_TIER:"PRODUCTION",ACTIVA_PRODUCTION_GO_ENABLED:"true",
}).includes("PRODUCTION_INDEPENDENT_SIEM_EXPORT_REQUIRED"));
assert(deploymentConfigurationErrors({
  NODE_ENV:"production",ACTIVA_DEPLOYMENT_TIER:"PRODUCTION",
  ACTIVA_PRODUCTION_GO_ENABLED:"true",
}).includes("PRODUCTION_INDEPENDENT_SIEM_EXPORT_REQUIRED"));

const alerts={enqueue:async()=>({status:"ACKNOWLEDGED_BY_GITHUB",action:"CREATED"})};
const store=createDurableSecurityIncidentStore({
  prisma,dispatcher:alerts,siemEnabled:true,log:()=>{},
});
let fetches=[];
function acceptReceiver({failure=false,invalid=false}={}){
  return async(url,options)=>{
    assert.equal(url,"https://siem.chandra.ac.th/v1/activa-security-events");
    assert.equal(options.method,"POST");
    assert.equal(options.redirect,"error");
    assert.equal(options.headers["Content-Type"],"application/json");
    const digest=crypto.createHmac("sha256",secret)
      .update(options.body).digest("hex");
    assert.equal(options.headers["X-Activa-Signature-SHA256"],digest);
    const event=JSON.parse(options.body);
    assert.equal(options.headers["X-Activa-Event-Id"],event.eventId);
    assert(/^ACTIVA-S34-[a-f0-9]{32}$/.test(event.eventId));
    assert.equal(event.schema,"ACTIVA_AI_SIEM_INCIDENT_V1");
    assert(!JSON.stringify(event).includes("PRIVATE"));
    assert(!JSON.stringify(event).includes("198.51.100"));
    assert(!("userId" in event) && !("requestId" in event));
    fetches.push(event);
    if(failure)return {ok:false,status:503,text:async()=>"hidden-secret"};
    return {ok:true,status:202,text:async()=>JSON.stringify({
      accepted:true,
      eventId:invalid?"ACTIVA-S34-"+"f".repeat(32):event.eventId,
      receiptId:"S34RECEIPT_000001",
    })};
  };
}
try{
  await prisma.securityIncidentWindow.deleteMany({});
  await Promise.all(Array.from({length:27},()=>store.recordCategory("AUTH_DENIED")));
  let item=await prisma.securityIncidentWindow.findFirst({where:{category:"AUTH_DENIED"}});
  assert.equal(item.count,27);
  assert.equal(item.status,"PENDING");
  assert.equal(item.siemStatus,"PENDING");
  const a=createSiemIncidentExporter({prisma,env:config,fetchImpl:acceptReceiver()});
  const b=createSiemIncidentExporter({prisma,env:config,fetchImpl:acceptReceiver()});
  const jobs=await Promise.all([a.pump(),b.pump()]);
  assert.equal(jobs.filter(x=>x.delivered===true).length,1);
  assert.equal(fetches.length,1);
  item=await prisma.securityIncidentWindow.findUnique({where:{id:item.id}});
  assert.equal(item.siemStatus,"DELIVERED");
  assert.equal(item.status,"PENDING","SIEM does not overwrite GitHub delivery state");
  assert.equal(item.acknowledgedAt,null,"SIEM is not human ACK");
  assert.equal(item.siemReceiptId,"S34RECEIPT_000001");
  assert.equal((await a.summary()).deliveredToReceiverIsHumanAcknowledgment,false);

  await Promise.all(Array.from({length:22},()=>store.recordCategory("ACCESS_DENIED")));
  const broken=createSiemIncidentExporter({prisma,env:config,
    fetchImpl:acceptReceiver({invalid:true})});
  let result=await broken.pump();
  assert.equal(result.processed,true);
  assert.equal(result.delivered,false,"A mismatched 2xx ACK must remain pending");
  let pending=await prisma.securityIncidentWindow.findFirst({
    where:{category:"ACCESS_DENIED"},
  });
  assert.equal(pending.siemStatus,"PENDING");
  assert.equal(pending.siemDeliveredAt,null);
  await prisma.securityIncidentWindow.update({
    where:{id:pending.id},data:{siemNextAttemptAt:new Date(Date.now()-2000)},
  });
  result=await b.pump();
  assert.equal(result.delivered,true);
  pending=await prisma.securityIncidentWindow.findUnique({where:{id:pending.id}});
  assert.equal(pending.siemAttempts,2);
  assert.equal(pending.siemStatus,"DELIVERED");
  assert.equal(fetches.filter(x=>x.category==="ACCESS_DENIED").length,2);
  assert.equal(fetches.at(-1).eventId,fetches.at(-2).eventId,
    "Retry must reuse stable eventId for receiver-side deduplication");

  await Promise.all(Array.from({length:10},()=>store.recordCategory("SERVER_ERROR")));
  const stale=await prisma.securityIncidentWindow.findFirst({
    where:{category:"SERVER_ERROR"},
  });
  await prisma.securityIncidentWindow.update({where:{id:stale.id},data:{
    siemStatus:"LEASED",siemLeaseId:"ABANDONED-LEASE",
    siemLeaseUntil:new Date(Date.now()-3000),
  }});
  assert.equal((await a.pump()).delivered,true,
    "Crash-recovery must reclaim expired SIEM lease");
  assert.equal((await prisma.securityIncidentWindow.findUnique({
    where:{id:stale.id},
  })).siemStatus,"DELIVERED");
  await Promise.all(Array.from({length:20},()=>store.recordCategory("RATE_LIMITED")));
  const retrying=createSiemIncidentExporter({prisma,env:config,
    fetchImpl:acceptReceiver({failure:true})});
  result=await retrying.pump();
  assert.equal(result.delivered,false);
  const failed=await prisma.securityIncidentWindow.findFirst({
    where:{category:"RATE_LIMITED"},
  });
  assert.equal(failed.siemStatus,"PENDING");
  const old=new Date(Date.now()-32*86400000);
  await prisma.securityIncidentWindow.update({where:{id:failed.id},data:{
    firstSeenAt:old,status:"DELIVERED",
  }});
  await store.cleanup();
  assert(await prisma.securityIncidentWindow.findUnique({where:{id:failed.id}}),
    "Retention must preserve pending SIEM events even if GitHub DELIVERED");
  assert.equal((await a.summary()).statusCounts.PENDING,1);
  assert(!JSON.stringify(fetches).includes(secret));
  console.log("ACTIVA-AI S3.4 SIEM external sink signed export, cross-worker claim, retry/recovery, strict ACK and privacy: PASS");
}finally{
  store.stop();
  await prisma.securityIncidentWindow.deleteMany({});
  await prisma.$disconnect();
}
