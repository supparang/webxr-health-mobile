// S3.5 — independently constructed HMAC receipt verification tests.
// Synthetic ONLY; never contact an external SIEM or use real credentials.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  computeSiemAckSignature,verifySiemReceipt,SIEM_ACK_MAC_HEADER,
} from "../server/siem-receipt-security.js";

const key="S35_EphemeralOnlyReceiverAgreement_"+
  crypto.randomBytes(36).toString("hex");
const wrongKey="S35_WrongKey_"+
  crypto.randomBytes(36).toString("hex");
const id="ACTIVA-S34-"+"a".repeat(32);
const goodReceipt={accepted:true,eventId:id,receiptId:"S35_RECEIPT_000123"};
const domain=Buffer.from("ACTIVA-AI-SIEM-ACK-V1\n","ascii");
const canonical=(item)=>Buffer.from(JSON.stringify(item),"utf8");
// Produce an *independent* expected MAC to catch regressions in shared helper.
const receiverHmac=(bytes,secret=key)=>crypto.createHmac("sha256",secret)
  .update(domain).update(bytes).digest("hex");
function mock(item=goodReceipt,{secret=key,signature,stream=true,status=202}={}){
  const bytes=Buffer.isBuffer(item)?item:canonical(item);
  const mac=signature===undefined?receiverHmac(bytes,secret):signature;
  if(!stream){
    return {ok:true,status,headers:new Headers({
      [SIEM_ACK_MAC_HEADER]:mac,
    }),text:async()=>bytes.toString("utf8")};
  }
  return new Response(bytes,{status,headers:{
    [SIEM_ACK_MAC_HEADER]:mac,
  }});
}
assert.equal(computeSiemAckSignature(canonical(goodReceipt),key),
  receiverHmac(canonical(goodReceipt)));
assert.equal(await verifySiemReceipt(mock(),{eventId:id,secret:key}),
  "S35_RECEIPT_000123");

// The remote *receiver* must ensure it stores each event idempotently;
// this independent in-memory CI mock represents receiver-side duplicate
// contract logic, NOT an actually deployed SIEM.
const ingested=new Map();
function receiverDeliver(messageBytes,outboundMac){
  const correct=crypto.createHmac("sha256",key).update(messageBytes).digest("hex");
  if(!/^[a-f0-9]{64}$/.test(outboundMac) ||
    !crypto.timingSafeEqual(Buffer.from(correct,"hex"),Buffer.from(outboundMac,"hex"))) {
    return {status:401};
  }
  const event=JSON.parse(messageBytes.toString("utf8"));
  const inputId=event.eventId;
  const digest=crypto.createHash("sha256").update(messageBytes).digest("hex");
  const old=ingested.get(inputId);
  if(old&&old.digest!==digest)return {status:409};
  if(!old)ingested.set(inputId,{digest,receiptId:"S35_RECEIPT_000123"});
  const ack={accepted:true,eventId:inputId,
    receiptId:ingested.get(inputId).receiptId};
  return {status:202,bytes:canonical(ack)};
}
const payload=canonical({
  schema:"ACTIVA_AI_SIEM_INCIDENT_V1",eventId:id,
  category:"AUTH_DENIED",threshold:25,minimumCountAtDetection:25,
});
const outbound=crypto.createHmac("sha256",key).update(payload).digest("hex");
const first=receiverDeliver(payload,outbound);
const second=receiverDeliver(payload,outbound);
assert.equal(ingested.size,1);
assert.deepEqual(first,second);
assert.equal(receiverDeliver(payload,"0".repeat(64)).status,401);
const changed=canonical({...JSON.parse(payload.toString()),threshold:999});
assert.equal(receiverDeliver(changed,crypto.createHmac("sha256",key)
  .update(changed).digest("hex")).status,409);
assert.equal(await verifySiemReceipt(
  mock(JSON.parse(first.bytes.toString())),{eventId:id,secret:key}
),"S35_RECEIPT_000123");

async function reject(name,response,sourceId=id,secret=key){
  await assert.rejects(async()=>verifySiemReceipt(response,{
    eventId:sourceId,secret,
  }),undefined,name);
}
await reject("untrusted receiver key",mock(goodReceipt,{secret:wrongKey}));
await reject("missing MAC",new Response(canonical(goodReceipt),{status:200}));
await reject("forged static string",mock(goodReceipt,{signature:"0".repeat(64)}));
await reject("missing signature bytes",mock(goodReceipt,{signature:"bad"}));
await reject("same valid MAC but wrong source event",mock(), "ACTIVA-S34-"+"b".repeat(32));
await reject("malicious receipt id",mock({...goodReceipt,receiptId:"../passwd"}));
await reject("extra privacy fields",mock({...goodReceipt,email:"secret@private.tld"}));
await reject("false accepted",mock({...goodReceipt,accepted:false}));
await reject("invalid response data",mock(Buffer.from("not json")));
await reject("invalid UTF8",mock(Buffer.from([0xc3,0x28])));
await reject("misleading 200 body",mock(goodReceipt,{stream:false}));
await reject("unacceptable HTTP status",mock(goodReceipt,{status:201}));
await reject("large hostile receipt",mock(Buffer.alloc(5000,65)));
const chunks=[canonical(goodReceipt).subarray(0,7),canonical(goodReceipt).subarray(7)];
const split=new Response(new ReadableStream({
  start(controller){for(const piece of chunks)controller.enqueue(piece);controller.close();}
}),{status:202,headers:{
  [SIEM_ACK_MAC_HEADER]:receiverHmac(canonical(goodReceipt)),
}});
assert.equal(await verifySiemReceipt(split,{eventId:id,secret:key}),
  goodReceipt.receiptId);
assert(!JSON.stringify(goodReceipt).includes(key));
console.log("ACTIVA-AI S3.5 SIEM authenticated bounded receipts, anti-forgery, idempotent receiver contract: PASS");
