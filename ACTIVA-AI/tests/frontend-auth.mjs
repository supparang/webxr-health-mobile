#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source=await readFile(new URL("../app.js",import.meta.url),"utf8");
const configSource=await readFile(new URL("../runtime-config.js",import.meta.url),"utf8");
assert.match(source,/immutableClosed=Boolean\(a\.pilotClosedAt\)/,"activity-management UI must lock immutable activities");
assert.match(source,/recordLockMsg/,"attendance UI must surface immutable record lock state");
assert.match(source,/reviewerDisplay=latestReview\?\.reviewer/,"Human Review history must prefer reviewer employee identity over internal IDs");
const CLIENT_ID="517090311491-u00q8g6aonuj2251ak7erqcose70gg2h.apps.googleusercontent.com";
const API="https://pilot.example.test";
const TOKEN_KEY="activa_ai_google_id_token";
const SESSION_KEY="activa_ai_v034_session";
const MODE_KEY="activa_ai_mode";
const health={
  database:"connected",releaseVersion:"ACTIVA-AI-1.0.15",
  authentication:{mode:"GOOGLE_OIDC",provider:"GOOGLE",configurationReady:true,googleClientId:CLIENT_ID,allowedDomains:["chandra.ac.th"]},
};
const user={id:"user-1",employeeId:"TEST001",name:"Test",role:"PARTICIPANT"};
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
const deferred=()=>{let resolve; const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

function harness({storage={},google=true,fetchImpl,locationHref="https://supparang.github.io/webxr-health-mobile/ACTIVA-AI/"}={}) {
  const saved=new Map(Object.entries(storage));
  const elements=new Map();
  const calls=[];
  const callbacks=[];
  const scripts=[];
  const timers=new Map();
  let timerId=0;
  let script=null;
  let rendered=0;
  const element=id=>{
    if(!elements.has(id)) elements.set(id,{id,innerHTML:"",value:"",hidden:true});
    return elements.get(id);
  };
  const googleApi={accounts:{id:{
    initialize:options=>callbacks.push(options),renderButton:()=>{},cancel:()=>{},disableAutoSelect:()=>{},
  }}};
  const window={addEventListener:()=>{}};
  if(google) window.google=googleApi;
  const context=vm.createContext({
    window,URL,Headers,console,
    location:new URL(locationHref),
    sessionStorage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,String(value)),removeItem:key=>saved.delete(key)},
    document:{
      getElementById:element,
      querySelector:selector=>selector.includes("data-activa-google-identity")?script:null,
      createElement:()=>{const created={dataset:{},remove:()=>{if(script===created)script=null;}}; return created;},
      head:{appendChild:value=>{script=value;scripts.push(value);}},
    },
    setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),
    clearInterval:()=>{},setInterval:()=>1,
    fetch:async(url,options)=>{
      calls.push({url,options});
      return fetchImpl ? fetchImpl(url,options) : response(url.endsWith("/api/health")?health:{user});
    },
    __rendered:()=>rendered++,
  });
  vm.runInContext(configSource,context);
  // Expose closure functions only in this VM; the shipped application has no test hooks.
  const marker=/  render\(\);\r?\n\}\)\(\);\s*$/;
  assert.match(source,marker);
  vm.runInContext(source.replace(marker,`  render=()=>__rendered();
    window.test={normalizeApiBase,setApiBaseUrl,clearPilotAuthentication,loadGoogleIdentityServices,renderLogin,api,setMode,
      state:()=>({apiBaseUrl,pilotAuthToken,pilotAuthBase,session,appMode,authGeneration})};
  })();`),context);
  const app=window.test;
  function loginScreen(base=API) {
    app.renderLogin();
    element("apiBaseUrl").value=base;
    element("loginId").value="ADM001";
  }
  return {app,window,saved,element,calls,callbacks,scripts,timers,googleApi,loginScreen,rendered:()=>rendered};
}

{
  const h=harness({storage:{[TOKEN_KEY]:"legacy-secret",[SESSION_KEY]:JSON.stringify(user),[MODE_KEY]:"server"}});
  assert.equal(h.window.ACTIVA_CONFIG.googleClientId,CLIENT_ID);
  assert.equal(h.app.state().pilotAuthToken,"");
  assert.equal(h.app.state().session,null);
  assert.equal(h.saved.has(TOKEN_KEY),false);
  assert.equal(h.saved.has(SESSION_KEY),false,"server sessions require sign-in after reload");
  for(const url of ["https://api.example.test","https://api.example.test/pilot","http://localhost:3000","http://127.0.0.1:3000","http://[::1]:3000"]) {
    assert.equal(h.app.normalizeApiBase(url),url);
  }
  for(const url of ["http://api.example.test","http://localhost.evil.test","https://user:pass@api.example.test","https://api.example.test/?secret=x","https://api.example.test/#x","https://api.example.test/?","https://api.example.test/#","ftp://localhost","invalid"]) {
    assert.equal(h.app.normalizeApiBase(url),"",url);
  }
}

{
  const h=harness({fetchImpl:()=>response({...health,authentication:{...health.authentication,googleClientId:"other.apps.googleusercontent.com"}})});
  h.loginScreen();
  await h.element("serverLogin").onclick();
  assert.equal(h.callbacks.length,0,"mismatched audience must never initialize Google");
  assert.match(h.element("loginMsg").innerHTML,/GOOGLE_CLIENT_ID_MISMATCH/);
}

{
  const productionClientId="999999999999-productionclient123.apps.googleusercontent.com";
  const productionHealth={...health,authentication:{...health.authentication,googleClientId:productionClientId}};
  const h=harness({
    locationHref:"https://activa-ai-production-api.onrender.com/",
    fetchImpl:url=>response(url.endsWith("/api/health")?productionHealth:{user})
  });
  h.loginScreen("https://activa-ai-production-api.onrender.com");
  await h.element("serverLogin").onclick();
  assert.equal(h.callbacks.length,1,"same-origin Render must accept the backend-declared OAuth audience");
  assert.equal(h.callbacks[0].client_id,productionClientId);
}

{
  const h=harness();
  h.loginScreen();
  await h.element("serverLogin").onclick();
  assert.equal(h.callbacks[0].client_id,CLIENT_ID);
  await h.callbacks[0].callback({credential:"id-token"});
  assert.equal(h.app.state().session.employeeId,user.employeeId);
  assert.equal(h.saved.has(TOKEN_KEY),false,"Google token must never be persisted");
  assert.equal(h.saved.has(SESSION_KEY),false,"server profile must remain in memory");
  const authenticated=h.calls.find(c=>c.url.endsWith("/api/me"));
  assert.equal(authenticated.options.headers.get("Authorization"),"Bearer id-token");
  assert.equal(authenticated.options.redirect,"error");
  assert.equal(authenticated.options.credentials,"omit");
  h.app.setApiBaseUrl("https://different.example.test");
  assert.equal(h.app.state().pilotAuthToken,"");
  assert.equal(h.app.state().session,null);
  const count=h.calls.length;
  await h.callbacks[0].callback({credential:"late-token"});
  assert.equal(h.calls.length,count,"late callback must not send a token to the new host");
  await h.app.api("/api/me");
  assert.equal(h.calls.at(-1).options.headers.get("Authorization"),null);
}

{
  const h=harness();
  h.loginScreen();
  await h.element("serverLogin").onclick();
  const count=h.calls.length;
  h.element("apiBaseUrl").value="http://untrusted.example.test";
  h.element("apiBaseUrl").oninput();
  await h.callbacks[0].callback({credential:"late-token"});
  assert.equal(h.calls.length,count,"editing the field invalidates callbacks immediately");
  assert.equal(h.app.state().apiBaseUrl,"");
}

{
  const pending=deferred();
  const h=harness({fetchImpl:()=>pending.promise});
  h.loginScreen();
  const attempt=h.element("serverLogin").onclick();
  h.app.setApiBaseUrl("https://different.example.test");
  pending.resolve(response(health));
  await attempt;
  assert.equal(h.callbacks.length,0,"health from an old destination must be discarded");
}

{
  const h=harness({google:false});
  h.loginScreen();
  const attempt=h.element("serverLogin").onclick();
  // Drain the asynchronous health response and body before completing the script load.
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.scripts.length,1);
  h.app.setApiBaseUrl("https://different.example.test");
  h.window.google=h.googleApi;
  h.scripts[0].onload();
  await attempt;
  assert.equal(h.callbacks.length,0,"URL changes during GIS loading invalidate sign-in");
}

{
  const pending=deferred();
  const h=harness({fetchImpl:url=>url.endsWith("/api/health")?response(health):pending.promise});
  h.loginScreen();
  await h.element("serverLogin").onclick();
  const attempt=h.callbacks[0].callback({credential:"id-token"});
  h.app.clearPilotAuthentication();
  pending.resolve(response({user}));
  await attempt;
  assert.equal(h.app.state().session,null,"logout must discard in-flight user responses");
  assert.equal(h.app.state().pilotAuthToken,"");
}

{
  const h=harness({fetchImpl:url=>response(url.endsWith("/api/health")?health:{error:"GOOGLE_ID_TOKEN_INVALID"},url.endsWith("/api/health")?200:401)});
  h.loginScreen();
  await h.element("serverLogin").onclick();
  await h.callbacks[0].callback({credential:"expired-token"});
  assert.equal(h.app.state().pilotAuthToken,"");
  assert.equal(h.app.state().session,null);
  assert.equal(h.app.state().appMode,"server");
  assert.match(h.element("loginMsg").innerHTML,/Google/);
  const count=h.calls.length;
  await h.callbacks[0].callback({credential:"late-token"});
  assert.equal(h.calls.length,count,"401 invalidates the prior Google callback");
}

{
  const h=harness({google:false});
  const first=h.app.loadGoogleIdentityServices();
  h.scripts[0].onerror();
  await assert.rejects(first,/GOOGLE_IDENTITY_SCRIPT_LOAD_FAILED/);
  const retry=h.app.loadGoogleIdentityServices();
  assert.equal(h.scripts.length,2,"a failed loader must be retryable");
  h.window.google=h.googleApi;
  h.scripts[1].onload();
  assert.equal(await retry,h.googleApi);
  assert.equal(h.timers.size,0);
}

{
  const h=harness({google:false});
  const first=h.app.loadGoogleIdentityServices();
  h.timers.values().next().value();
  await assert.rejects(first,/GOOGLE_IDENTITY_SCRIPT_LOAD_FAILED/);
  const retry=h.app.loadGoogleIdentityServices();
  assert.equal(h.scripts.length,2,"a timed-out Google loader must also be retryable");
  h.window.google=h.googleApi;
  h.scripts[1].onload();
  await retry;
}

{
  const h=harness({fetchImpl:url=>response(url.endsWith("/api/health")?health:{error:"GOOGLE_ACCOUNT_NOT_PROVISIONED"},url.endsWith("/api/health")?200:403)});
  h.loginScreen();
  await h.element("serverLogin").onclick();
  await h.callbacks[0].callback({credential:"unprovisioned-token"});
  assert.equal(h.app.state().pilotAuthToken,"");
  assert.equal(h.app.state().session,null);
  assert.match(h.element("loginMsg").innerHTML,/GOOGLE_ACCOUNT_NOT_PROVISIONED/);
}

{
  const h=harness({storage:{[SESSION_KEY]:JSON.stringify(user),[MODE_KEY]:"demo"}});
  assert.equal(h.app.state().session.employeeId,user.employeeId,"demo session survives reload");
  h.loginScreen();
  h.window.ACTIVA_DEMO_API={request:async()=>({user})};
  await h.element("serverLogin").onclick();
  const googleCallback=h.callbacks[0].callback;
  await h.element("demoLogin").onclick();
  assert.equal(h.app.state().appMode,"demo");
  assert.equal(h.saved.has(SESSION_KEY),true);
  const count=h.calls.length;
  await googleCallback({credential:"late-token"});
  assert.equal(h.calls.length,count,"switching to demo invalidates pending Google callbacks");
}

console.log("ACTIVA-AI frontend authentication boundary tests passed (mocked Google; no live sign-in).");
