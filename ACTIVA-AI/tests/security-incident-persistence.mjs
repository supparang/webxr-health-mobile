// S3.3 — disposable PostgreSQL only. No production traffic or actual GitHub calls.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {prisma} from "../server/db.js";
import {
  createDurableSecurityIncidentStore,
  incidentPersistenceConfigErrors,
  sanitizeSecuritySample,
} from "../server/security-incident-store.js";
import {deploymentConfigurationErrors} from "../server/deployment-config.js";
const env=process.env;
if(env.CI!=="true"||env.ALLOW_SYNTHETIC_CI!=="true"||
   env.ACTIVA_TEST_DATABASE_ONLY!=="true"||
   env.ACTIVA_DEPLOYMENT_TIER!=="STAGING"||
   !/^postgres(?:ql)?:\/\/[^@]+@(?:localhost|127\.0\.0\.1):5432\//.test(env.DATABASE_URL||"")){
  throw Error("S33_DISPOSABLE_LOCAL_POSTGRES_REQUIRED");
}
const blockers=incidentPersistenceConfigErrors({
  ACTIVA_DEPLOYMENT_TIER:"PRODUCTION",
  ACTIVA_PRODUCTION_GO_ENABLED:"true",
  ACTIVA_SECURITY_INCIDENT_STORE:"DISABLED",
  ACTIVA_SECURITY_ALERT_MODE:"DISABLED",
});
assert(blockers.includes("PRODUCTION_DURABLE_SECURITY_MONITOR_REQUIRED"));
assert(blockers.includes("PRODUCTION_SECURITY_ALERT_DELIVERY_REQUIRED"));
assert(deploymentConfigurationErrors({
  NODE_ENV:"production",ACTIVA_DEPLOYMENT_TIER:"PRODUCTION",
  ACTIVA_PRODUCTION_GO_ENABLED:"true",
}).includes("PRODUCTION_DURABLE_SECURITY_MONITOR_REQUIRED"));
assert(incidentPersistenceConfigErrors({
  ACTIVA_SECURITY_INCIDENT_STORE:"INVALID",
}).includes("SECURITY_INCIDENT_STORE_INVALID"));

const confidential={
  type:"security_event",category:"AUTH_DENIED",method:"POST",
  route:"/api/activities/:activityId",
  scope:"GUEST",status:401,action:"USER_STATUS_CHANGED",
  ip:"198.51.100.26",token:"SECRET_PRIVATE_TOKEN_777",
  employeeId:"PRIVATE_EMPLOYEE_36",requestId:"REQUEST_777",
};
const sample=sanitizeSecuritySample(confidential);
assert(sample);
assert(!JSON.stringify(sample).includes("SECRET_"));
assert(!JSON.stringify(sample).includes("198.51.100."));
assert(!JSON.stringify(sample).includes("PRIVATE_EMPLOYEE"));
assert(!JSON.stringify(sample).includes("REQUEST_777"));
assert.equal(sanitizeSecuritySample({...confidential,route:"/api/SECRET_PRIVATE_TOKEN_777"}).route,null);

let createCount=0;
const logs=[];
const fakeDispatcher={
  enqueue:async(alert)=>{
    assert.equal(alert.type,"security_alert");
    assert(["AUTH_DENIED","ACCESS_DENIED","SERVER_ERROR","RATE_LIMITED"].includes(alert.category));
    assert(!JSON.stringify(alert).includes(confidential.token));
    createCount++;
    return {status:"ACKNOWLEDGED_BY_GITHUB",action:"CREATED"};
  },
};
const storeA=createDurableSecurityIncidentStore({
  prisma,dispatcher:fakeDispatcher,log:x=>logs.push(x),
});
const storeB=createDurableSecurityIncidentStore({
  prisma,dispatcher:fakeDispatcher,log:x=>logs.push(x),
});
try{
  await prisma.securityEventSample.deleteMany({});
  await prisma.securityIncidentWindow.deleteMany({});
  // 40+ HTTP denials across two replica-like store objects must create ONE
  // durable 15-minute incident, not per-process alerts.
  await Promise.all(Array.from({length:51},(_,i)=>
    (i%2?storeA:storeB).recordCategory("AUTH_DENIED")));
  const incidents=await prisma.securityIncidentWindow.findMany();
  assert.equal(incidents.length,1);
  assert.equal(incidents[0].count,51);
  assert.equal(incidents[0].status,"PENDING");
  assert(incidents[0].id.startsWith("AUTH_DENIED:"));
  const claimResults=await Promise.all([storeA.pump(),storeB.pump()]);
  assert.equal(claimResults.filter(x=>x.delivered===true).length,1,
    "Cross-instance claim must only deliver one incident");
  assert.equal(createCount,1);
  let sent=await prisma.securityIncidentWindow.findUnique({where:{id:incidents[0].id}});
  assert.equal(sent.status,"DELIVERED");
  assert.equal(sent.attempts,1);
  assert.equal(sent.acknowledgedAt,null);
  assert.equal((await storeA.summary()).persistent,true);
  assert.equal((await storeB.summary()).deliveryIsHumanAcknowledgment,false);
  assert.equal((await storeA.recent())[0].acknowledgedAt,null);

  // A real, seeded admin actor must acknowledge a delivered incident.
  // The storage change and permanent AuditLog must succeed atomically.
  const admin=await prisma.user.findFirst({where:{role:"ADMIN"}});
  assert(admin?.id,"CI bootstrap must seed one dedicated synthetic admin");
  assert.equal(await storeA.acknowledge(incidents[0].id,admin.id),true);
  assert.equal(await storeB.acknowledge(incidents[0].id,admin.id),false);
  assert.equal(await storeB.acknowledge("AUTH_DENIED:BAD-ID",admin.id),false);
  sent=await prisma.securityIncidentWindow.findUnique({where:{id:incidents[0].id}});
  assert(sent.acknowledgedAt instanceof Date);
  assert.equal(sent.acknowledgedBy,admin.id);
  const audit=await prisma.auditLog.findMany({where:{
    action:"SECURITY_INCIDENT_ACKNOWLEDGED",entityId:incidents[0].id,
  }});
  assert.equal(audit.length,1);
  assert.equal(audit[0].actorId,admin.id);

  // A second incident fails delivery, survives lease and restarts, then
  // succeeds when a separate store instance processes its pending row.
  await Promise.all(Array.from({length:21},()=>
    storeA.recordCategory("ACCESS_DENIED")));
  let failures=0;
  const badStore=createDurableSecurityIncidentStore({
    prisma,dispatcher:{enqueue:async()=>{failures++;return {status:"FAILED"};}},
  });
  let result=await badStore.pump();
  assert.equal(result.processed,true);
  assert.equal(result.delivered,false);
  assert.equal(failures,1);
  let failed=await prisma.securityIncidentWindow.findFirst({
    where:{category:"ACCESS_DENIED"},
  });
  assert.equal(failed.status,"PENDING");
  assert.equal(failed.attempts,1);
  assert.equal(failed.deliveredAt,null);
  assert.equal(await badStore.acknowledge(failed.id,admin.id),false);
  // Simulate retry due after clock passes, without sleeping.
  await prisma.securityIncidentWindow.update({
    where:{id:failed.id},
    data:{nextAttemptAt:new Date(Date.now()-5000)},
  });
  result=await storeB.pump();
  assert.equal(result.delivered,true);
  failed=await prisma.securityIncidentWindow.findUnique({where:{id:failed.id}});
  assert.equal(failed.status,"DELIVERED");
  assert.equal(failed.attempts,2);

  // Recover from a replica killed after claiming its lease.
  await Promise.all(Array.from({length:10},()=>
    storeA.recordCategory("SERVER_ERROR")));
  const leaseRow=await prisma.securityIncidentWindow.findFirst({
    where:{category:"SERVER_ERROR"},
  });
  await prisma.securityIncidentWindow.update({where:{id:leaseRow.id},data:{
    status:"LEASED",leaseId:"abandoned-lease",leaseUntil:new Date(Date.now()-5000),
  }});
  assert.equal((await storeA.pump()).delivered,true,
    "Expired lease must be reclaimed after process restart");

  // Persist only sanitized sampled data, never provided raw metadata.
  assert.equal(await storeA.recordSample(confidential),true);
  const rows=await prisma.securityEventSample.findMany();
  assert.equal(rows.length,1);
  const serialized=JSON.stringify(rows);
  for(const secret of ["SECRET_PRIVATE_TOKEN_777","198.51.100.26",
    "PRIVATE_EMPLOYEE_36","REQUEST_777"]){
    assert(!serialized.includes(secret),"PII was persisted in incident event sample");
  }
  const summary=await storeA.summary();
  assert.equal(summary.statusCounts.DELIVERED,3);
  assert(!JSON.stringify({summary,logs}).includes(confidential.token));

  // 30-day retention removes old benign/delivered data, but NEVER silently
  // drops an undelivered alert still waiting for a remote incident channel.
  const old=new Date(Date.now()-31*86400000);
  await prisma.securityIncidentWindow.update({
    where:{id:leaseRow.id},data:{firstSeenAt:old},
  });
  await Promise.all(Array.from({length:25},()=>storeA.recordCategory("RATE_LIMITED")));
  const queued=await prisma.securityIncidentWindow.findFirst({
    where:{category:"RATE_LIMITED"},
  });
  await prisma.securityIncidentWindow.update({
    where:{id:queued.id},data:{firstSeenAt:old},
  });
  await prisma.securityEventSample.updateMany({data:{occurredAt:old}});
  const deleted=await storeA.cleanup();
  assert(deleted[0]>=1);
  assert(deleted[1]>=1);
  assert(await prisma.securityIncidentWindow.findUnique({where:{id:queued.id}}),
    "Failed or pending alerts must survive retention cleanup");

  const server=await readFile(new URL("../server/index.js",import.meta.url),"utf8");
  assert(server.includes('requireRoles("ADMIN"),async(req,res,next)'));
  assert(server.includes('durableSecurityStore.acknowledge(req.params.id,req.activaUser.id)'));
  assert(server.includes("durableSecurityStore?.start();"));
  assert(server.includes("durableSecurityStore?.stop();"));
  console.log("ACTIVA-AI S3.3 durable cross-replica incident outbox, retry/recovery, sanitized samples, atomic human audit: PASS");
} finally{
  storeA.stop();storeB.stop();
  await prisma.securityEventSample.deleteMany({});
  await prisma.securityIncidentWindow.deleteMany({});
  await prisma.auditLog.deleteMany({
    where:{action:"SECURITY_INCIDENT_ACKNOWLEDGED"},
  });
  await prisma.$disconnect();
}
