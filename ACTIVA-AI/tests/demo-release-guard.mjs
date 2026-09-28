#!/usr/bin/env node
import assert from "node:assert/strict";

class MemoryStorage {
  constructor(){ this.map=new Map(); }
  getItem(key){ return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key,value){ this.map.set(key,String(value)); }
  removeItem(key){ this.map.delete(key); }
  clear(){ this.map.clear(); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = {
  addEventListener(){},
  ACTIVA_DEMO_API:null,
};

await import("../demo-api.js");

const api=globalThis.window.ACTIVA_DEMO_API;
assert(api && typeof api.request==="function","Demo API did not initialize");
api.reset();

let goError=null;
try {
  await api.request(
    "/api/operations/release-decision",
    {
      method:"POST",
      body:JSON.stringify({
        decision:"GO",
        reason:"CI must reject Production GO from Demo Mode"
      })
    },
    "ADM001"
  );
} catch (error) {
  goError=error;
}

assert(goError,"Demo GO attempt must be rejected");
assert.equal(goError.status,409,"Demo GO rejection must return HTTP-equivalent 409");
assert.equal(
  goError.data?.error,
  "DEMO_MODE_CANNOT_AUTHORIZE_PRODUCTION_GO",
  "Demo GO rejection must use the canonical guard code"
);

const hold=await api.request(
  "/api/operations/release-decision",
  {
    method:"POST",
    body:JSON.stringify({
      decision:"HOLD",
      reason:"CI confirms Demo Mode records HOLD only"
    })
  },
  "ADM001"
);
assert.equal(hold.decision,"HOLD","Demo HOLD decision must be recorded");
assert.equal(hold.syntheticDemo,true,"Demo HOLD response must remain marked synthetic");

const audit=await api.request("/api/audit",{method:"GET"},"ADM001");
const holdAudit=(audit.logs||[]).find(x=>x.action==="PILOT_RELEASE_HOLD");
assert(holdAudit,"Demo HOLD audit event missing");
assert.equal(holdAudit.metadata?.decision,"HOLD","Demo HOLD audit decision mismatch");
assert.equal(holdAudit.metadata?.releaseVersion,"ACTIVA-AI-1.0.15","Demo HOLD audit release version mismatch");
assert.deepEqual(
  holdAudit.metadata?.blockersAtDecision,
  ["DEMO_MODE_NOT_PRODUCTION"],
  "Demo HOLD audit must retain the non-production blocker"
);

console.log("ACTIVA-AI V1.0.15 demo release guard test passed");
