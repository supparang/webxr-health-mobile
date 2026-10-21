// S2.10 — Read-only acceptance of a *known, approved* Staging origin.
// Safety: target must exactly match a separately entered approved origin;
// no Production requests, no credentials/cookies, no user data or mutations.
// Browser hardware/OIDC, human alerts, load and ethics approval are NOT covered.
import {pathToFileURL} from "node:url";
import {readFile} from "node:fs/promises";
import {validatedTarget, verifyStaging} from "./verify-staging.mjs";

const SAFE_ERRORS=new Set([
  "S210_STAGING_URL_REQUIRED",
  "S210_APPROVED_ORIGIN_REQUIRED",
  "S210_STAGING_ORIGIN_MISMATCH",
  "S210_PRODUCTION_OR_NON_STAGING_TARGET_BLOCKED",
  "S210_EXPECTED_COMMIT_REQUIRED",
  "S210_FRONTEND_ORIGIN_REQUIRED",
  "S210_REQUIRES_EXPLICIT_READ_ONLY_OPT_IN",
  "S210_NON_ROOT_API_TARGET_FORBIDDEN",
]);

export function validateS210Target({
  apiUrl, approvedOrigin, frontendOrigin, expectedSourceCommit,
}={}) {
  if (!apiUrl) throw Error("S210_STAGING_URL_REQUIRED");
  if (!approvedOrigin) throw Error("S210_APPROVED_ORIGIN_REQUIRED");
  if (!frontendOrigin) throw Error("S210_FRONTEND_ORIGIN_REQUIRED");
  const safe=validatedTarget({apiUrl,frontendOrigin,allowLocalHttp:false});
  let url,approved;
  try { url=new URL(apiUrl);approved=new URL(approvedOrigin); }
  catch { throw Error("S210_STAGING_ORIGIN_MISMATCH"); }
  // Exact approval and root-only path. No query, hash, redirects, embedded
  // credentials, attacker-provided API paths, IP literal, or local host.
  if (url.origin!==approved.origin || approvedOrigin!==approved.origin ||
      url.origin!==apiUrl.replace(/\/$/,"")) {
    throw Error("S210_STAGING_ORIGIN_MISMATCH");
  }
  if (url.pathname!=="/") throw Error("S210_NON_ROOT_API_TARGET_FORBIDDEN");
  const host=url.hostname.toLowerCase();
  if (/production|(?:^|[.-])prod(?:[.-]|$)/.test(host) ||
      !(host.includes("staging") || host.includes("stage") || host.includes("pilot")) ||
      host==="localhost" || host.endsWith(".local") || host.endsWith(".internal") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":") ||
      !host.includes(".")) {
    throw Error("S210_PRODUCTION_OR_NON_STAGING_TARGET_BLOCKED");
  }
  if (!/^[0-9a-f]{40}$/.test(String(expectedSourceCommit||"").toLowerCase())) {
    throw Error("S210_EXPECTED_COMMIT_REQUIRED");
  }
  return {...safe,expectedSourceCommit:String(expectedSourceCommit).toLowerCase()};
}

function safeResponseHeaders(headers) {
  const value=(key)=>headers?.get?.(key)||"";
  return {
    csp:value("content-security-policy"),
    xFrame:value("x-frame-options"),
    contentType:value("content-type"),
    cache:value("cache-control"),
    nosniff:value("x-content-type-options"),
  };
}

export async function verifyS210Staging(options,fetchImpl=fetch) {
  const target=validateS210Target(options);
  const baseline=await verifyStaging({
    apiUrl:options.apiUrl,
    frontendOrigin:options.frontendOrigin,
    allowLocalHttp:false,
  },fetchImpl);
  const inventory=JSON.parse(await readFile(new URL("../tests/browser-asset-integrity.json",import.meta.url),"utf8"));
  const checks=baseline.checks.map(x=>({id:"BASE_"+x.id,passed:Boolean(x.passed)}));
  const record=(id,passed)=>checks.push({id,passed:passed===true});
  const base=target.base;
  async function get(path,readText=false) {
    try{
      const response=await fetchImpl(base+path,{
        method:"GET",headers:{Accept:readText?"text/html":"application/json",Origin:target.origin},
        credentials:"omit",redirect:"error",signal:AbortSignal.timeout(10000),
      });
      let body=null;
      if(readText && response.status===200) {
        const length=Number(response.headers.get("content-length")||0);
        if(length>256000)throw Error("S210_HTML_TOO_LARGE");
        body=await response.text();
        if(body.length>256000)throw Error("S210_HTML_TOO_LARGE");
      } else if(!readText && response.status===200) {
        try{body=await response.json();}catch{}
      } else await response.body?.cancel();
      return {status:response.status,headers:safeResponseHeaders(response.headers),body};
    }catch{return null;}
  }
  // Re-check the explicit deployment SHA. This is a mandatory release gate;
  // the underlying existing staging verifier checks tier and GO-disabled.
  const live=await get("/api/live");
  const ready=await get("/api/ready");
  const health=await get("/api/health");
  record("LIVE_SOURCE_COMMIT",live?.status===200 &&
    live.body?.sourceCommit===target.expectedSourceCommit);
  record("READY_SOURCE_COMMIT",ready?.status===200 &&
    ready.body?.sourceCommit===target.expectedSourceCommit);
  record("HEALTH_SOURCE_COMMIT",health?.status===200 &&
    health.body?.sourceCommit===target.expectedSourceCommit);
  record("LIVE_STAGING",live?.body?.deploymentTier==="STAGING");
  record("HEALTH_STAGING_GO_DISABLED",health?.body?.deploymentTier==="STAGING" &&
    health.body?.productionGoEnabled===false);

  const pages=["/","/index.html","/Login.html","/guest.html","/blind-review.html"];
  let mainHtml=null;
  for(const path of pages) {
    const response=await get(path,true);
    const name=path==="/"?"ROOT":path.slice(1).replace(/\W+/g,"_").toUpperCase();
    record(name+"_HTML_HTTP",response?.status===200 &&
      /^text\/html/i.test(response.headers.contentType));
    const csp=response?.headers.csp||"";
    record(name+"_CSP",csp.includes("script-src-attr 'none'") &&
      csp.includes("object-src 'none'") &&
      csp.includes("frame-ancestors 'none'") &&
      !csp.includes("script-src 'unsafe-inline'") &&
      !csp.includes("unsafe-eval"));
    record(name+"_HEADERS",response?.headers.xFrame==="DENY" &&
      response?.headers.nosniff==="nosniff" &&
      response?.headers.cache.toLowerCase().includes("no-store"));
    const meta=response?.body?.match?.(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1]||"";
    record(name+"_CSP_META",meta.includes("script-src-attr 'none'") &&
      meta.includes("object-src 'none'"));
    if(path==="/index.html")mainHtml=response?.body||null;
  }
  let intact=typeof mainHtml==="string";
  for(const asset of inventory.assets){
    if(!mainHtml?.includes(
      '<script src="'+asset.url+'" integrity="'+asset.sha384+
      '" crossorigin="anonymous" defer></script>'
    ))intact=false;
  }
  record("QR_CDN_SRI_IN_SERVED_HTML",intact);
  return {
    schemaVersion:1,
    type:"ACTIVA_S210_READ_ONLY_STAGING_PREFLIGHT",
    checkedAtUtc:new Date().toISOString(),
    automatedChecksPassed:checks.every(x=>x.passed),
    checks,
    baselineCheckCount:baseline.checks.length,
    expectedSourceCommit:target.expectedSourceCommit,
    productionGoApproved:false,
    researchEthicsApproved:false,
    manualAcceptanceStatus:"NOT_TESTED",
    manualAcceptanceRequired:[
      "GOOGLE_OIDC_REAL_APPROVED_STAGING_ACCOUNT",
      "ANDROID_CHROME_REAL_CAMERA_DYNAMIC_QR",
      "IOS_SAFARI_REAL_CAMERA_DYNAMIC_QR",
      "GUEST_CHECKIN_CHECKOUT_SYNTHETIC_PASS",
      "BLIND_REVIEW_REAL_STAGING_SCOPED_INVITE",
      "REAL_GITHUB_INCIDENT_ALERT_AND_OPERATOR_ACKNOWLEDGEMENT",
      "REAL_STAGING_CSP_CONSOLE_AND_NETWORK",
      "SHARED_NETWORK_PEAK_LOAD_AND_PROXY_IDENTITY",
      "SECURITY_REVIEW_AND_OPERATOR_RELEASE_GO",
    ],
  };
}

async function main(){
  try{
    if(process.env.ACTIVA_S210_READ_ONLY_CONFIRM!=="true"){
      throw Error("S210_REQUIRES_EXPLICIT_READ_ONLY_OPT_IN");
    }
    const result=await verifyS210Staging({
      apiUrl:process.env.ACTIVA_S210_STAGING_URL,
      approvedOrigin:process.env.ACTIVA_S210_APPROVED_ORIGIN,
      frontendOrigin:process.env.ACTIVA_S210_FRONTEND_ORIGIN,
      expectedSourceCommit:process.env.ACTIVA_S210_EXPECTED_COMMIT,
    });
    console.log(JSON.stringify(result,null,2));
    process.exitCode=result.automatedChecksPassed?0:1;
  }catch(error){
    const code=String(error?.message||"");
    console.error(JSON.stringify({automatedChecksPassed:false,
      reason:SAFE_ERRORS.has(code)?code:"S210_PREFLIGHT_REJECTED",
      productionGoApproved:false,manualAcceptanceStatus:"NOT_TESTED"}));
    process.exitCode=1;
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  await main();
}
