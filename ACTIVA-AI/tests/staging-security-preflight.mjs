import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  validateS210Target,verifyS210Staging,
} from "../scripts/verify-staging-security.mjs";

// Mock-only acceptance testing. There are NO network requests in this test.
// Staging must be explicitly approved and must be a separate non-Production URL.
const SHA="a".repeat(40);
const API="https://activa-staging.example.test";
const ORIGIN="https://supparang.github.io";
const options={
  apiUrl:API,approvedOrigin:API,
  frontendOrigin:ORIGIN,expectedSourceCommit:SHA,
};
assert.equal(validateS210Target(options).expectedSourceCommit,SHA);
for(const url of [
  "https://activa-ai-production-api.onrender.com",
  "https://activa-production.example.test",
  "https://activa-prod.example.test",
  "https://localhost:443",
  "https://127.0.0.1:443",
  "https://activa-staging.internal",
  "https://activa-staging.example.test/other/path",
  "https://activa-staging.example.test?key=secret",
  "https://user:secret@activa-staging.example.test",
  "http://activa-staging.example.test",
  "file:///etc/passwd",
  "https://unapproved.example.test",
]) {
  assert.throws(()=>validateS210Target({...options,apiUrl:url}),
    "Unsafe target accepted: "+url.replace(/secret/g,"***"));
}
for(const value of [
  {...options,approvedOrigin:""},
  {...options,approvedOrigin:"https://other-staging.example.test"},
  {...options,frontendOrigin:""},
  {...options,expectedSourceCommit:""},
  {...options,expectedSourceCommit:"not-a-commit"},
])assert.throws(()=>validateS210Target(value),"Required explicit approval not enforced");

const inventory=JSON.parse(await readFile(new URL("./browser-asset-integrity.json",import.meta.url),"utf8"));
const metaPolicy=[
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "script-src-attr 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");
const headerPolicy=metaPolicy+"; frame-ancestors 'none'";
const html='<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="'+
  metaPolicy+'"></head><body><div id="app"></div>'+
  inventory.assets.map(a=>'<script src="'+a.url+'" integrity="'+a.sha384+
    '" crossorigin="anonymous" defer></script>').join("")+'</body></html>';
const health={
  ok:true,database:"connected",releaseVersion:"ACTIVA-AI-1.0.15",
  deploymentTier:"STAGING",productionGoEnabled:false,sourceCommit:SHA,
  authentication:{
    mode:"GOOGLE_OIDC",provider:"GOOGLE",configurationReady:true,
    googleClientId:"517090311491-u00q8g6aonuj2251ak7erqcose70gg2h.apps.googleusercontent.com",
    allowedDomains:["chandra.ac.th"],
  },
};
function mock({production=false,tampered=false,commit=SHA,
  wrongHeaders=false,redirected=false,slow=false}={}){
  const calls=[];
  const fixture=async (url,init)=>{
    calls.push({url,method:init.method,redirect:init.redirect,
      credentials:init.credentials,headers:init.headers});
    assert(url.startsWith(API+"/"),"Only approved Staging may be requested");
    assert(["GET","OPTIONS"].includes(init.method),"Preflight must never mutate state");
    assert.equal(init.credentials,"omit");
    assert.equal(init.redirect,"error");
    assert(!Object.keys(init.headers).some(x=>/authorization|cookie/i.test(x)));
    if(redirected) throw Error("S210_SECRET_ERROR_BODY_TOKEN");
    const p=new URL(url).pathname;
    const authOrigin=init.headers.Origin;
    if(authOrigin==="https://unapproved.activa.invalid")return new Response(
      JSON.stringify({error:"ORIGIN_NOT_ALLOWED",token:"SECRET_CANNOT_LOG"}),
      {status:403});
    const headers={
      "access-control-allow-origin":ORIGIN,
      "cache-control":"no-store",
      "x-content-type-options":"nosniff",
      "x-frame-options":"DENY",
      "referrer-policy":"strict-origin-when-cross-origin",
      "permissions-policy":"camera=(self), microphone=(), geolocation=()",
      "cross-origin-opener-policy":"same-origin-allow-popups",
      "x-request-id":"s210-synthetic-req-0001",
    };
    if(init.method==="OPTIONS")return new Response(null,{
      status:204,headers:{...headers,
        "access-control-allow-methods":"GET,POST",
        "access-control-allow-headers":"authorization,content-type",
      },
    });
    if(p==="/api/me")return new Response(JSON.stringify({
      error:"GOOGLE_ID_TOKEN_REQUIRED", privateToken:"SECRET_CANNOT_LOG",
    }),{status:401});
    const tier=production?"PRODUCTION":"STAGING";
    if(p==="/api/live")return new Response(JSON.stringify({
      ok:true,service:"ACTIVA-AI",releaseVersion:"ACTIVA-AI-1.0.15",
      deploymentTier:tier,sourceCommit:commit,
    }),{status:200,headers});
    if(p==="/api/ready")return new Response(JSON.stringify({
      ok:true,ready:true,releaseVersion:"ACTIVA-AI-1.0.15",
      deploymentTier:tier,sourceCommit:commit,
      database:"connected",authenticationReady:true,
    }),{status:200,headers});
    if(p==="/api/health")return new Response(JSON.stringify({
      ...health,sourceCommit:commit,deploymentTier:tier,
      productionGoEnabled:production,
    }),{status:200,headers});
    if(["/","/index.html","/Login.html","/guest.html","/blind-review.html"].includes(p)){
      const body=tampered && p==="/index.html"
        ? html.replace(inventory.assets[0].sha384,"sha384-BAD")
        : html;
      return new Response(body,{status:200,headers:{
        ...headers,"content-type":"text/html; charset=utf-8",
        "content-security-policy":wrongHeaders?"default-src 'self'":headerPolicy,
      }});
    }
    if(["/app.js","/runtime-config.js"].includes(p)){
      return new Response("export const demo=true;",{status:200,headers});
    }
    return new Response(null,{status:404});
  };
  return {fixture,calls};
}
const positive=mock();
const pass=await verifyS210Staging(options,positive.fixture);
assert.equal(pass.automatedChecksPassed,true,
  "Preflight mock should pass, failed "+JSON.stringify(pass.checks.filter(x=>!x.passed)));
assert.equal(pass.manualAcceptanceStatus,"NOT_TESTED");
assert.equal(pass.productionGoApproved,false);
assert.equal(pass.researchEthicsApproved,false);
assert.equal(pass.expectedSourceCommit,SHA);
assert(pass.baselineCheckCount>=24);
assert(pass.checks.some(x=>x.id==="QR_CDN_SRI_IN_SERVED_HTML"&&x.passed));
assert(positive.calls.every(c=>["GET","OPTIONS"].includes(c.method)&&
  c.credentials==="omit"&&c.redirect==="error"));
const allResults=[pass];
for (const failure of [
  {production:true},
  {tampered:true},
  {commit:"b".repeat(40)},
  {wrongHeaders:true},
  {redirected:true},
]) {
  const simulated=mock(failure);
  const report=await verifyS210Staging(options,simulated.fixture);
  assert.equal(report.automatedChecksPassed,false,
    "Unsafe fixture incorrectly passed: "+JSON.stringify(failure));
  assert.equal(report.productionGoApproved,false);
  assert.equal(report.manualAcceptanceStatus,"NOT_TESTED");
  allResults.push(report);
}
assert(!JSON.stringify(allResults).includes("SECRET_CANNOT_LOG"),
  "Sensitive mock API response content leaked into result");
console.log("ACTIVA-AI S2.10 explicit staging approval, read-only HTTP/CSP/SRI and governance tests: PASS");
