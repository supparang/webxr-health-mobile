// ACTIVA-AI S3.4: privacy-minimized incident export to an operator-approved
// external SIEM HTTP receiver. OFF by default; no outbound production calls
// until institution configures a separate origin and verifies its ownership.
// The receiver MUST independently verify signature, persist durably and
// idempotently acknowledge the exact eventId before returning 200/202.
import crypto from "node:crypto";
import {verifySiemReceipt} from "./siem-receipt-security.js";

const CATEGORIES=new Set(["AUTH_DENIED","ACCESS_DENIED","RATE_LIMITED","SERVER_ERROR"]);
const MODES=new Set(["DISABLED","HTTPS_WEBHOOK"]);
const RECEIPT=/^[A-Za-z0-9_-]{8,100}$/;
const ENVELOPE_ID=/^ACTIVA-S34-[a-f0-9]{32}$/;

function safeOrigin(input) {
  if(typeof input!=="string"||input.length>250)return null;
  try{
    const u=new URL(input);
    const host=u.hostname.toLowerCase();
    if(u.protocol!=="https:"||u.origin!==input||
      u.port||u.username||u.password||u.pathname!=="/"||
      u.search||u.hash||host.length<5||!host.includes(".")||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|example|home|lan)$/.test(host)||
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)||
      host.includes(":") || host.startsWith("xn--")){
      return null;
    }
    return u.origin;
  }catch{return null;}
}
export function siemExportEnabled(env=process.env){
  return env.ACTIVA_SIEM_EXPORT_MODE==="HTTPS_WEBHOOK";
}
export function siemExportConfigErrors(env=process.env) {
  const mode=env.ACTIVA_SIEM_EXPORT_MODE||"DISABLED";
  const result=[];
  if(!MODES.has(mode))result.push("ACTIVA_SIEM_EXPORT_MODE_INVALID");
  if(mode==="HTTPS_WEBHOOK"){
    if(env.ACTIVA_SECURITY_INCIDENT_STORE!=="POSTGRES")
      result.push("ACTIVA_SIEM_REQUIRES_DURABLE_INCIDENT_STORE");
    if(!safeOrigin(env.ACTIVA_SIEM_EXPORT_ORIGIN))result.push("ACTIVA_SIEM_EXPORT_ORIGIN_INVALID");
    const secret=String(env.ACTIVA_SIEM_EXPORT_HMAC_SECRET||"");
    if(secret.length<32||secret.length>4096||
       /^(?:demo|change|replace|example|test|ci-)/i.test(secret)||
       /placeholder|not-for-production/i.test(secret)){
      result.push("ACTIVA_SIEM_EXPORT_HMAC_SECRET_REQUIRED");
    }
    if(secret && [env.QR_SIGNING_SECRET,env.RESEARCH_HASH_SALT,
      env.ACTIVA_RATE_LIMIT_HMAC_SECRET].includes(secret)){
      result.push("ACTIVA_SIEM_EXPORT_KEY_MUST_BE_DISTINCT");
    }
  }
  if(env.ACTIVA_DEPLOYMENT_TIER==="PRODUCTION"&&
    env.ACTIVA_PRODUCTION_GO_ENABLED==="true"&&mode!=="HTTPS_WEBHOOK"){
    result.push("PRODUCTION_INDEPENDENT_SIEM_EXPORT_REQUIRED");
  }
  return result;
}
function safeEnvelope(item){
  if(!item||!CATEGORIES.has(item.category)||
    !/^(AUTH_DENIED|ACCESS_DENIED|RATE_LIMITED|SERVER_ERROR):\d{1,16}$/.test(item.id)||
    !Number.isSafeInteger(item.count)||item.count<1||
    !Number.isSafeInteger(item.threshold)||item.threshold<1||
    !(item.firstSeenAt instanceof Date)||
    !Number.isFinite(item.firstSeenAt.getTime()))throw Error("S34_SIEM_EVENT_INVALID");
  const eventId="ACTIVA-S34-"+
    crypto.createHash("sha256").update("ACTIVA-S34\0"+item.id).digest("hex").slice(0,32);
  return {
    schema:"ACTIVA_AI_SIEM_INCIDENT_V1",eventId,
    type:"security_incident",severity:"HIGH",
    category:item.category,threshold:item.threshold,
    // Always stable across retries: live aggregated count may increase.
    minimumCountAtDetection:item.threshold,
    firstSeenUtc:item.firstSeenAt.toISOString(),
    source:"ACTIVA_AI_APPLICATION",
  };
}
export function createSiemIncidentExporter({
  prisma,env=process.env,fetchImpl=fetch,
  now=Date.now,log=()=>{},
}={}){
  const errors=siemExportConfigErrors(env);
  if(errors.length||!siemExportEnabled(env)||
     typeof prisma?.$queryRaw!=="function" ||
     typeof prisma?.$executeRaw!=="function" ||
     typeof prisma?.securityIncidentWindow?.updateMany!=="function" ||
     typeof fetchImpl!=="function"||typeof now!=="function"){
    throw Error("S34_SIEM_EXPORTER_CONFIGURATION_INVALID");
  }
  const endpoint=safeOrigin(env.ACTIVA_SIEM_EXPORT_ORIGIN)+"/v1/activa-security-events";
  const secret=env.ACTIVA_SIEM_EXPORT_HMAC_SECRET;
  let busy=false,timer=null,stopped=true,lastWarning=0;
  function warn(code) {
    const t=now();
    if(!lastWarning||t-lastWarning>=60000){
      lastWarning=t;
      log({type:"siem_export_warning",code});
    }
  }
  async function claim(){
    const lease=crypto.randomUUID();
    const rows=await prisma.$queryRaw`
      WITH candidate AS (
        SELECT "id" FROM "SecurityIncidentWindow"
        WHERE ("siemStatus"='PENDING' AND "siemNextAttemptAt"<=clock_timestamp())
           OR ("siemStatus"='LEASED' AND "siemLeaseUntil"<clock_timestamp())
        ORDER BY "firstSeenAt" ASC
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE "SecurityIncidentWindow" AS row SET
        "siemStatus"='LEASED',"siemLeaseId"=${lease},
        "siemLeaseUntil"=clock_timestamp()+INTERVAL '45 seconds',
        "siemAttempts"=LEAST(row."siemAttempts"+1,2147483647)
      FROM candidate WHERE row."id"=candidate."id"
      RETURNING row."id",row."category",row."count",row."threshold",
        row."firstSeenAt",row."siemAttempts",row."siemLeaseId"
    `;
    if(!Array.isArray(rows))throw Error("S34_SIEM_CLAIM_INVALID");
    return rows[0]||null;
  }
  async function transmit(item){
    const event=safeEnvelope(item);
    const body=JSON.stringify(event);
    const signature=crypto.createHmac("sha256",secret).update(body).digest("hex");
    const response=await fetchImpl(endpoint,{
      method:"POST",redirect:"error",
      signal:AbortSignal.timeout(5000),
      headers:{
        "Content-Type":"application/json",
        "Accept":"application/json",
        "X-Activa-Event-Id":event.eventId,
        "X-Activa-Signature-SHA256":signature,
      },
      body,
    });
    if(!response||!response.ok||![200,202].includes(response.status)){
      throw Error("S34_SIEM_DELIVERY_FAILED");
    }
    // S3.5 authenticated ACK: no unbounded text() buffering, no unsigned
    // receipt or attacker-controlled JSON can mark a record DELIVERED.
    return verifySiemReceipt(response,{eventId:event.eventId,secret});
  }
  async function processOne(){
    const item=await claim();
    if(!item)return {processed:false};
    let receipt=null;
    try{receipt=await transmit(item);}catch{ /* Never log external payloads. */ }
    if(receipt){
      const updated=await prisma.securityIncidentWindow.updateMany({
        where:{id:item.id,siemStatus:"LEASED",siemLeaseId:item.siemLeaseId},
        data:{
          siemStatus:"DELIVERED",siemDeliveredAt:new Date(),
          siemReceiptId:receipt,siemLeaseId:null,siemLeaseUntil:null,
        },
      });
      return {processed:true,delivered:updated.count===1};
    }
    const backoff=Math.min(3600,15*2**Math.min(8,item.siemAttempts));
    await prisma.$executeRaw`
      UPDATE "SecurityIncidentWindow" SET
        "siemStatus"='PENDING',"siemLeaseId"=NULL,"siemLeaseUntil"=NULL,
        "siemNextAttemptAt"=clock_timestamp()+(${backoff}*INTERVAL '1 second')
      WHERE "id"=${item.id} AND "siemStatus"='LEASED'
        AND "siemLeaseId"=${item.siemLeaseId}
    `;
    warn("S34_SIEM_DELIVERY_PENDING");
    return {processed:true,delivered:false};
  }
  async function pump(){
    if(busy)return {busy:true};
    busy=true;
    try{return await processOne();}
    catch{warn("S34_SIEM_BACKEND_UNAVAILABLE");return {error:true};}
    finally{busy=false;}
  }
  async function summary(){
    const rows=await prisma.securityIncidentWindow.groupBy({
      by:["siemStatus"],_count:{_all:true},
    });
    return {
      mode:"HTTPS_WEBHOOK",persistent:true,
      deliveredToReceiverIsHumanAcknowledgment:false,
      statusCounts:Object.fromEntries(rows.map(x=>[x.siemStatus,x._count._all])),
    };
  }
  function start(){
    if(!stopped)return;
    stopped=false;void pump();
    timer=setInterval(()=>{void pump();},10000);
    timer.unref?.();
  }
  function stop(){stopped=true;if(timer)clearInterval(timer);timer=null;}
  return {pump,summary,start,stop};
}
