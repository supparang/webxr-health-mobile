// S3.3 — PostgreSQL durable, de-identified security incident outbox.
// All replicas share the same database-clock windows. Claim uses
// UPDATE ... SKIP LOCKED and a random lease for crash recovery.
// A GitHub API receipt NEVER constitutes human acknowledgment.
import crypto from "node:crypto";

export const INCIDENT_THRESHOLDS=Object.freeze({
  AUTH_DENIED:25,ACCESS_DENIED:20,RATE_LIMITED:20,SERVER_ERROR:10,
});
const CATEGORIES=new Set(Object.keys(INCIDENT_THRESHOLDS));
const ACTIONS=new Set(["CREATED","COMMENTED"]);
const WINDOW_MS=900000;

export function incidentPersistenceEnabled(env=process.env) {
  return env.ACTIVA_SECURITY_INCIDENT_STORE==="POSTGRES";
}
export function incidentPersistenceConfigErrors(env=process.env) {
  const mode=env.ACTIVA_SECURITY_INCIDENT_STORE||"DISABLED";
  const errors=[];
  if(!["DISABLED","POSTGRES"].includes(mode)){
    errors.push("SECURITY_INCIDENT_STORE_INVALID");
  }
  if(env.ACTIVA_DEPLOYMENT_TIER==="PRODUCTION" &&
     env.ACTIVA_PRODUCTION_GO_ENABLED==="true"){
    if(mode!=="POSTGRES")errors.push("PRODUCTION_DURABLE_SECURITY_MONITOR_REQUIRED");
    if(env.ACTIVA_SECURITY_ALERT_MODE!=="GITHUB_ISSUE")
      errors.push("PRODUCTION_SECURITY_ALERT_DELIVERY_REQUIRED");
  }
  return errors;
}
const sanitizers={
  method:x=>["GET","POST","PUT","PATCH","DELETE","OTHER"].includes(x)?x:null,
  route:x=>typeof x==="string" && x.length<=160 &&
    (/^\/[A-Za-z0-9_:/.-]+$/.test(x) || x==="UNMATCHED_API")?x:null,
  scope:x=>["GUEST","BLIND_REVIEW","ORGANIZATION"].includes(x)?x:null,
  action:x=>typeof x==="string" && /^[A-Z][A-Z0-9_]{2,79}$/.test(x)?x:null,
};
export function sanitizeSecuritySample(event){
  if(!event || event.type!=="security_event" ||
    typeof event.category!=="string" ||
    !/^[A-Z][A-Z_]{2,31}$/.test(event.category))return null;
  const statusCode=Number.isInteger(event.status)&&event.status>=100 &&
    event.status<=599?event.status:null;
  return {
    category:event.category,
    kind:"SECURITY_EVENT",
    method:sanitizers.method(event.method),
    route:sanitizers.route(event.route),
    scope:sanitizers.scope(event.scope),
    statusCode,
    action:sanitizers.action(event.action),
  };
}
export function createDurableSecurityIncidentStore({
  prisma, dispatcher, log=()=>{}, now=Date.now,
}={}){
  if(!prisma || typeof prisma.$queryRaw!=="function" ||
    typeof prisma.$executeRaw!=="function" ||
    typeof prisma.securityEventSample?.create!=="function" ||
    typeof prisma.securityIncidentWindow?.updateMany!=="function" ||
    typeof dispatcher?.enqueue!=="function" ||
    typeof log!=="function" || typeof now!=="function"){
    throw Error("S33_INCIDENT_STORE_CONFIGURATION_INVALID");
  }
  let busy=false, stopped=true, timer=null, ticks=0;
  let failuresReportedAt=0;
  function warning(code){
    const ts=now();
    if(ts-failuresReportedAt>=60000 || failuresReportedAt===0){
      failuresReportedAt=ts;
      log({type:"security_incident_store_warning",code});
    }
  }

  async function recordCategory(category){
    if(!CATEGORIES.has(category))return false;
    const threshold=INCIDENT_THRESHOLDS[category];
    // Database time provides consistent windows across all replicas.
    // Once delivered, additional events only increment count (no re-send).
    // No client/user identifiers are written to the incident table.
    const rows=await prisma.$queryRaw`
      WITH db_clock AS MATERIALIZED (
        SELECT floor(extract(epoch FROM clock_timestamp())*1000 /
          ${WINDOW_MS}::numeric)::bigint AS win
      )
      INSERT INTO "SecurityIncidentWindow"
        ("id","category","count","threshold","status","firstSeenAt",
         "updatedAt","nextAttemptAt")
      SELECT ${category} || ':' || win::text,${category},1,${threshold},
        CASE WHEN ${threshold}<=1 THEN 'PENDING' ELSE 'COUNTING' END,
        clock_timestamp(),clock_timestamp(),clock_timestamp()
      FROM db_clock
      WHERE true
      ON CONFLICT ("id") DO UPDATE SET
        "count"=CASE
          WHEN "SecurityIncidentWindow"."count">=2147483646 THEN 2147483647
          ELSE "SecurityIncidentWindow"."count"+1 END,
        "status"=CASE
          WHEN "SecurityIncidentWindow"."status"='COUNTING'
           AND "SecurityIncidentWindow"."count"+1>=EXCLUDED."threshold"
          THEN 'PENDING'
          ELSE "SecurityIncidentWindow"."status" END,
        "updatedAt"=clock_timestamp()
      RETURNING "id","count","status"
    `;
    if(!Array.isArray(rows)||rows.length!==1 ||
      typeof rows[0].id!=="string")throw Error("S33_RECORD_RECEIPT_INVALID");
    return true;
  }

  async function recordSample(event){
    const safe=sanitizeSecuritySample(event);
    if(!safe)return false;
    await prisma.securityEventSample.create({data:safe});
    return true;
  }

  async function claimNext(){
    const lease=crypto.randomUUID();
    const rows=await prisma.$queryRaw`
      WITH candidate AS (
        SELECT "id" FROM "SecurityIncidentWindow"
        WHERE ("status"='PENDING' AND "nextAttemptAt"<=clock_timestamp())
           OR ("status"='LEASED' AND "leaseUntil"<clock_timestamp())
        ORDER BY "firstSeenAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "SecurityIncidentWindow" AS incident SET
        "status"='LEASED',
        "leaseId"=${lease},
        "leaseUntil"=clock_timestamp()+INTERVAL '45 seconds',
        "attempts"=LEAST(incident."attempts"+1,2147483647),
        "updatedAt"=clock_timestamp()
      FROM candidate
      WHERE incident."id"=candidate."id"
      RETURNING incident."id",incident."category",incident."count",
        incident."threshold",incident."firstSeenAt",incident."attempts",
        incident."leaseId"
    `;
    if(!Array.isArray(rows))throw Error("S33_CLAIM_RECEIPT_INVALID");
    return rows[0]||null;
  }

  async function processOne(){
    const item=await claimNext();
    if(!item)return {processed:false};
    // Event contains only category/count/threshold/time; never raw PII.
    const response=await dispatcher.enqueue({
      type:"security_alert",
      category:item.category,count:item.count,threshold:item.threshold,
      timestampUtc:item.firstSeenAt.toISOString(),
      periodMinutes:15,severity:"HIGH",
    }).catch(()=>({status:"FAILED"}));
    if(response.status==="ACKNOWLEDGED_BY_GITHUB" &&
      ACTIONS.has(response.action)){
      const write=await prisma.securityIncidentWindow.updateMany({
        where:{id:item.id,status:"LEASED",leaseId:item.leaseId},
        data:{
          status:"DELIVERED",deliveredAt:new Date(),deliveryAction:response.action,
          leaseId:null,leaseUntil:null,
        },
      });
      return {processed:true,delivered:write.count===1};
    }
    const backoffSeconds=Math.min(3600,Math.pow(2,Math.min(10,item.attempts))*15);
    // A failed, disabled or throttled GitHub adapter is NEVER marked delivered.
    // Every retry remains persistent across process restarts.
    await prisma.$executeRaw`
      UPDATE "SecurityIncidentWindow" SET
        "status"='PENDING',"leaseId"=NULL,"leaseUntil"=NULL,
        "nextAttemptAt"=clock_timestamp()+(${backoffSeconds}*INTERVAL '1 second'),
        "updatedAt"=clock_timestamp()
      WHERE "id"=${item.id} AND "status"='LEASED' AND "leaseId"=${item.leaseId}
    `;
    warning("S33_REMOTE_ALERT_NOT_DELIVERED");
    return {processed:true,delivered:false};
  }

  async function pump(){
    if(busy)return {busy:true};
    busy=true;
    try{return await processOne();}
    catch{warning("S33_INCIDENT_BACKEND_UNAVAILABLE");return {error:true};}
    finally{busy=false;}
  }

  async function summary(){
    const rows=await prisma.securityIncidentWindow.groupBy({
      by:["status"],_count:{_all:true},
    });
    return {
      persistent:true,backend:"POSTGRES",deliveryIsHumanAcknowledgment:false,
      statusCounts:Object.fromEntries(rows.map(x=>[x.status,x._count._all])),
    };
  }
  async function recent(limit=20){
    const size=Number.isInteger(limit)?Math.min(30,Math.max(1,limit)):20;
    const rows=await prisma.securityIncidentWindow.findMany({
      orderBy:{firstSeenAt:"desc"},take:size,
      select:{id:true,category:true,count:true,threshold:true,status:true,
        firstSeenAt:true,attempts:true,deliveredAt:true,deliveryAction:true,
        acknowledgedAt:true},
    });
    return rows;
  }
  async function acknowledge(id,actorId){
    if(typeof id!=="string" ||
      !/^(AUTH_DENIED|ACCESS_DENIED|RATE_LIMITED|SERVER_ERROR):\d{1,16}$/.test(id) ||
      typeof actorId!=="string" || !/^[A-Za-z0-9_-]{4,80}$/.test(actorId))
      return false;
    // Acknowledgment and the actor's permanent AuditLog commit atomically.
    // No acknowledgment is recorded if the audit insert fails.
    return prisma.$transaction(async(tx)=>{
      const result=await tx.securityIncidentWindow.updateMany({
        where:{id,status:"DELIVERED",acknowledgedAt:null},
        data:{acknowledgedAt:new Date(),acknowledgedBy:actorId},
      });
      if(result.count!==1)return false;
      await tx.auditLog.create({data:{
        actorId,action:"SECURITY_INCIDENT_ACKNOWLEDGED",
        entityType:"SecurityIncidentWindow",entityId:id,
        metadata:{method:"MANUAL_ADMIN_ACKNOWLEDGMENT"},
      }});
      return true;
    });
  }
  async function cleanup(){
    // Never silently delete PENDING/LEASED incidents, including failed alerts.
    const removed=await Promise.all([
      prisma.securityEventSample.deleteMany({
        where:{occurredAt:{lt:new Date(now()-30*86400000)}},
      }),
      prisma.securityIncidentWindow.deleteMany({
        where:{status:{in:["DELIVERED","COUNTING"]},
          firstSeenAt:{lt:new Date(now()-30*86400000)}},
      }),
    ]);
    return removed.map(x=>x.count);
  }
  function start(){
    if(!stopped)return;
    stopped=false;
    // Delayed jobs after restart are picked up by the next pump.
    void pump();
    timer=setInterval(()=>{
      void pump();
      ticks++;
      if(ticks%360===0)void cleanup().catch(()=>
        warning("S33_RETENTION_CLEANUP_FAILED"));
    },10000);
    timer.unref?.();
  }
  function stop(){stopped=true;if(timer)clearInterval(timer);timer=null;}
  return {recordCategory,recordSample,pump,summary,recent,acknowledge,
    cleanup,start,stop};
}
