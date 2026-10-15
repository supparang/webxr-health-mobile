// S3.2 — PostgreSQL shared fixed-window quotas for multiple Node instances.
// This is NOT a substitute for CDN/WAF/DDoS edge quotas, particularly when
// hundreds of participants share one campus NAT/public IP.
// No IP, account ID, bearer token or secret is stored in the table or logs.
import crypto from "node:crypto";

const SAFE_MODES=new Set(["MEMORY","POSTGRES"]);
const CATEGORIES=new Set([
  "all_ip","guest_ip","guest_pass","reviewer_ip","reviewer_pass",
  "actor","actor_write",
]);

export function distributedRateLimitConfigErrors(env=process.env) {
  const problems=[];
  const mode=String(env.ACTIVA_RATE_LIMIT_STORE||"MEMORY").trim().toUpperCase();
  if(!SAFE_MODES.has(mode)) problems.push("ACTIVA_RATE_LIMIT_STORE_INVALID");
  const productionGo=env.ACTIVA_DEPLOYMENT_TIER==="PRODUCTION" &&
    env.ACTIVA_PRODUCTION_GO_ENABLED==="true";
  if(productionGo&&mode!=="POSTGRES"){
    problems.push("PRODUCTION_DISTRIBUTED_RATE_LIMIT_REQUIRED");
  }
  if(mode==="POSTGRES"){
    const secret=String(env.ACTIVA_RATE_LIMIT_HMAC_SECRET||"");
    if(secret.length<32||secret.length>4096 ||
      /change-this|replace|placeholder|demo|example|^ci-|^test/i.test(secret)){
      problems.push("ACTIVA_RATE_LIMIT_HMAC_SECRET_REQUIRED");
    }
  }
  return problems;
}
export function distributedRateLimitEnabled(env=process.env){
  return String(env.ACTIVA_RATE_LIMIT_STORE||"MEMORY").trim().toUpperCase()==="POSTGRES";
}

function computeBucketId(secret,category,key) {
  return crypto.createHmac("sha256",secret)
    .update("ACTIVA-S3.2-RATE-LIMIT-V1\0")
    .update(category).update("\0").update(String(key)).digest("hex");
}

export function createPostgresWindowStore({
  prisma,secret,clock=Date.now,
}={}) {
  if(!prisma || typeof prisma.$queryRaw!=="function" ||
     typeof prisma.$executeRaw!=="function" ||
     typeof secret!=="string" || secret.length<32 ||
     typeof clock!=="function"){
    throw Error("S32_RATE_LIMIT_STORE_CONFIGURATION_INVALID");
  }
  let uses=0;
  return {
    async consume({category,key,limit,windowMs=60_000}){
      if(!CATEGORIES.has(category) || !key ||
        !Number.isSafeInteger(limit)||limit<1||limit>100_000 ||
        !Number.isSafeInteger(windowMs)||windowMs<1000||windowMs>3_600_000){
        throw Error("S32_RATE_LIMIT_BUCKET_INVALID");
      }
      const id=computeBucketId(secret,category,key);
      // PostgreSQL sets the window boundary with ITS OWN CLOCK, eliminating
      // app-server clock skew and making simultaneous requests atomic.
      // Parameters are bound through Prisma's safe tagged SQL API.
      const rows=await prisma.$queryRaw`
        WITH bucket_clock AS MATERIALIZED (
          SELECT floor(extract(epoch FROM clock_timestamp()) * 1000 /
            ${windowMs}::numeric)::bigint AS window_id
        )
        INSERT INTO "SecurityRateLimitBucket"
          ("id","windowId","count","expiresAt")
        SELECT ${id},window_id,1,
          to_timestamp((window_id + 1) * ${windowMs}::numeric / 1000)
        FROM bucket_clock
        WHERE true
        ON CONFLICT ("id") DO UPDATE SET
          "count" = CASE
            WHEN "SecurityRateLimitBucket"."windowId" = EXCLUDED."windowId"
            THEN CASE
              WHEN "SecurityRateLimitBucket"."count" >= 2147483646
              THEN 2147483647
              ELSE "SecurityRateLimitBucket"."count" + 1
            END
            ELSE 1
          END,
          "windowId" = EXCLUDED."windowId",
          "expiresAt" = EXCLUDED."expiresAt"
        RETURNING "count","expiresAt"
      `;
      if(!Array.isArray(rows)||rows.length!==1 ||
        !Number.isSafeInteger(rows[0].count) ||
        !(rows[0].expiresAt instanceof Date)){
        throw Error("S32_RATE_LIMIT_BACKEND_RECEIPT_INVALID");
      }
      uses++;
      // Opportunistic garbage collection; no unbounded setInterval, no
      // fail-open behavior if DB connectivity is lost.
      if(uses%250===0){
        void prisma.$executeRaw`
          DELETE FROM "SecurityRateLimitBucket"
          WHERE "expiresAt" < NOW() - INTERVAL '2 minutes'
        `.catch(()=>{ /* Service remains guarded by atomic main request. */ });
      }
      const allowed=rows[0].count<=limit;
      const now=clock();
      const retryAfterSeconds=Math.max(1,Math.min(
        Math.ceil(windowMs/1000),
        Math.ceil((rows[0].expiresAt.getTime()-now)/1000)
      ));
      return {allowed,retryAfterSeconds};
    },
  };
}

export function createDistributedWindowLimiter({
  store,category,limit,windowMs=60_000,keyFor,skip=()=>false,
}={}){
  if(!store||typeof store.consume!=="function" ||
    !CATEGORIES.has(category)||typeof keyFor!=="function"||
    typeof skip!=="function"||!Number.isSafeInteger(limit)||limit<1){
    throw Error("S32_DISTRIBUTED_LIMITER_CONFIGURATION_INVALID");
  }
  return function rateLimitRequest(req,res,next){
    if(skip(req))return next();
    const key=keyFor(req);
    if(!key)return next(); // e.g. missing auth still denied by auth handler.
    Promise.resolve().then(()=>store.consume({
      category,key,limit,windowMs,
    })).then(result=>{
      if(result?.allowed===true && Number.isInteger(result.retryAfterSeconds) && result.retryAfterSeconds>=1)return next();
      if(result?.allowed===false &&
         Number.isInteger(result.retryAfterSeconds) &&
         result.retryAfterSeconds>=1){
        res.set("Retry-After",String(result.retryAfterSeconds));
        res.set("Cache-Control","no-store");
        console.warn(JSON.stringify({
          type:"security_rate_limited",category,
          requestId:req.activaRequestId||null,
        }));
        return res.status(429).json({
          ok:false,error:"RATE_LIMITED",
          retryAfterSeconds:result.retryAfterSeconds,
        });
      }
      throw Error("S32_RATE_LIMIT_BACKEND_RECEIPT_INVALID");
    }).catch(()=>{
      // The backend cannot authorize traffic it could not count.
      console.error(JSON.stringify({
        type:"security_rate_limit_backend_unavailable",
        category,requestId:req.activaRequestId||null,
      }));
      if(!res.headersSent)res.status(503).json({
        ok:false,error:"RATE_LIMIT_BACKEND_UNAVAILABLE",
      });
    });
  };
}
