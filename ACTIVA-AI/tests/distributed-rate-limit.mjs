// S3.2 — real disposable Postgres integration, no Production or accounts.
// Multiple independent limiter instances compete for the same atomic rows.
import assert from "node:assert/strict";
import {prisma} from "../server/db.js";
import {
  createPostgresWindowStore,createDistributedWindowLimiter,
  distributedRateLimitConfigErrors,
} from "../server/distributed-rate-limit.js";
import {createActivaRateLimiters} from "../server/rate-limit.js";
import {deploymentConfigurationErrors} from "../server/deployment-config.js";
const env=process.env;
if(env.CI!=="true" || env.ALLOW_SYNTHETIC_CI!=="true" ||
   env.ACTIVA_TEST_DATABASE_ONLY!=="true" ||
   env.ACTIVA_DEPLOYMENT_TIER!=="STAGING" ||
   !/^postgres(?:ql)?:\/\/[^@]+@(?:localhost|127\.0\.0\.1):5432\//.test(env.DATABASE_URL||"")){
  throw Error("S32_DISPOSABLE_LOCAL_POSTGRES_REQUIRED");
}
const hmac="LOCAL_CI_ONLY_SHARED_RATE_LIMIT_HMAC_"+ "A".repeat(40);
const options={
  NODE_ENV:"test",ACTIVA_RATE_LIMIT_ENABLED:"true",
  ACTIVA_RATE_LIMIT_STORE:"POSTGRES",
  ACTIVA_RATE_LIMIT_HMAC_SECRET:hmac,
  ACTIVA_RATE_LIMIT_ALL_IP:"3000",
  ACTIVA_RATE_LIMIT_GUEST_IP:"900",
  ACTIVA_RATE_LIMIT_GUEST_PASS:"36",
  ACTIVA_RATE_LIMIT_REVIEWER_IP:"900",
  ACTIVA_RATE_LIMIT_REVIEWER_PASS:"36",
  ACTIVA_RATE_LIMIT_ACTOR:"600",
  ACTIVA_RATE_LIMIT_ACTOR_WRITE:"25",
};
assert.deepEqual(distributedRateLimitConfigErrors(options),[]);
assert(distributedRateLimitConfigErrors({
  ACTIVA_DEPLOYMENT_TIER:"PRODUCTION",ACTIVA_PRODUCTION_GO_ENABLED:"true",
}).includes("PRODUCTION_DISTRIBUTED_RATE_LIMIT_REQUIRED"));
assert(distributedRateLimitConfigErrors({
  ACTIVA_RATE_LIMIT_STORE:"POSTGRES",
}).includes("ACTIVA_RATE_LIMIT_HMAC_SECRET_REQUIRED"));
assert(distributedRateLimitConfigErrors({
  ACTIVA_RATE_LIMIT_STORE:"UNSUPPORTED",
}).includes("ACTIVA_RATE_LIMIT_STORE_INVALID"));
const unsafeProduction=deploymentConfigurationErrors({
  ...options, NODE_ENV:"production",
  ACTIVA_DEPLOYMENT_TIER:"PRODUCTION",
  ACTIVA_PRODUCTION_GO_ENABLED:"true",
  ACTIVA_RATE_LIMIT_STORE:"MEMORY",
});
assert(unsafeProduction.includes("PRODUCTION_DISTRIBUTED_RATE_LIMIT_REQUIRED"));
const storeA=createPostgresWindowStore({prisma,secret:hmac});
const storeB=createPostgresWindowStore({prisma,secret:hmac});
const make=(store,category,limit,keyFor,skip=()=>false)=>
  createDistributedWindowLimiter({store,category,limit,keyFor,skip});
function invoke(middleware,req){
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error("S32_ASYNC_MIDDLEWARE_TIMEOUT")),15000);
    const answer=(obj)=>{clearTimeout(timeout);resolve(obj);};
    const res={
      headers:{},statusCode:200,
      set(name,value){this.headers[name.toLowerCase()]=String(value);return this;},
      status(n){this.statusCode=n;return this;},
      json(body){answer({status:this.statusCode,body,headers:this.headers});return this;},
      get headersSent(){return false;},
    };
    try{middleware(req,res,(err)=>err?
      (clearTimeout(timeout),reject(err)):answer({status:200,headers:res.headers}));}
    catch(e){clearTimeout(timeout);reject(e);}
  });
}
const request=(id,token=null,forward="203.0.113.1")=>({
  path:"/api/public/guest/session",method:"GET",
  ip:"198.51.100.20", // one shared campus NAT
  activaUser:{id},activaRequestId:"s32-mock-only",
  get:(name)=>String(name).toLowerCase()==="authorization" && token
    ?"GuestPass "+token:String(name).toLowerCase()==="x-forwarded-for"?forward:"",
});
try{
  // Tests use only the isolated CI database; never the user's persistent DB.
  await prisma.securityRateLimitBucket.deleteMany({});
  const idKey=(r)=>"actor:"+r.activaUser.id;
  const a=make(storeA,"actor_write",25,idKey);
  const b=make(storeB,"actor_write",25,idKey);
  const attempts=await Promise.all(Array.from({length:64},(_,i)=>
    invoke(i%2?a:b,request("S32_ACTOR_SIMULTANEOUS"))));
  assert.equal(attempts.filter(x=>x.status===200).length,25,
    "Concurrent replicas must allow exactly one global quota");
  assert.equal(attempts.filter(x=>x.status===429).length,39);
  assert(attempts.filter(x=>x.status===429).every(x=>
    Number(x.headers["retry-after"])>=1));
  assert.equal((await invoke(a,request("S32_DIFFERENT_ACTOR"))).status,200,
    "A different actor needs an independent bucket");
  assert.equal((await invoke(b,request("S32_ACTOR_SIMULTANEOUS","",
    "198.51.100.99"))).status,429,
    "Forged forwarding header may not allocate new actor quota");
  const classroomA=createActivaRateLimiters(options,Date.now,{prisma});
  const classroomB=createActivaRateLimiters(options,Date.now,{prisma});
  // 210 synthetic participants, each with a distinct Guest token, same NAT.
  // This is a functional concurrency test, NOT a measured peak load/latency SLA.
  let passed=0;
  for(let batch=0;batch<21;batch++){
    const results=await Promise.all(Array.from({length:10},(_,j)=>{
      const n=batch*10+j;
      const req=request("S32_GUEST_"+n,String(n).padStart(43,"Q"),
        "198.51.100."+n);
      const limiters=n%2?classroomA:classroomB;
      return (async()=>{
        for(const middleware of [limiters.perIp,limiters.guestIp,limiters.guestPass]){
          const r=await invoke(middleware,req);
          if(r.status!==200)return r;
        }
        return {status:200};
      })();
    }));
    passed+=results.filter(x=>x.status===200).length;
  }
  assert.equal(passed,210,
    "Campus shared-IP fairness must permit 210 different Guest passes");
  const rows=await prisma.securityRateLimitBucket.findMany({
    select:{id:true,count:true,windowId:true,expiresAt:true},
  });
  assert(rows.length>=200);
  assert(rows.every(r=>/^[a-f0-9]{64}$/.test(r.id)));
  const serialized=JSON.stringify(rows,(k,v)=>typeof v==="bigint"?v.toString():v);
  assert(!serialized.includes("198.51.100.") &&
    !serialized.includes("S32_ACTOR_SIMULTANEOUS"),
    "Persisted state must not include IP or account identifiers");
  // If the shared backend fails, all replicas deny requests: never pass.
  const failedStore={consume:async()=>{throw Error("CI_DB_UNAVAILABLE");}};
  const failure=make(failedStore,"actor_write",5,idKey);
  assert.equal((await invoke(failure,request("S32_FAIL_CLOSED"))).status,503);
  const badReceipt=make({consume:async()=>({allowed:true,wrong:true})},
    "actor_write",5,idKey);
  // Allowed:true is the only accepted success receipt from the store;
  // raw backend errors are trapped separately.
  assert.equal((await invoke(badReceipt,request("S32_BAD_RECEIPT"))).status,200);
  console.log("ACTIVA-AI S3.2 shared PostgreSQL atomic quotas, 2 replicas, 210 shared-NAT guests and fail-closed backend: PASS");
} finally {
  await prisma.securityRateLimitBucket.deleteMany({});
  await prisma.$disconnect();
}
