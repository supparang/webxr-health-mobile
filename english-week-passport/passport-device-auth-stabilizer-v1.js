(function(){
'use strict';
const VERSION='2026-08-21-DEVICE-AUTH-STABILIZER-R29';
const AUTH_RESTORE_TIMEOUT_MS=3500;
const ANON_SIGNIN_TIMEOUT_MS=8000;
const base=window.EW_AUTHORITY;
if(!base || !window.firebase?.auth){
  console.warn('[LEXICON X] device auth stabilizer: authority/auth unavailable');
  return;
}

const clean=v=>String(v==null?'':v).trim();
function withTimeout(promise,ms,label){
  let timer=0;
  const guard=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      const e=new Error(label||'AUTH_TIMEOUT');
      e.code=label||'AUTH_TIMEOUT';
      reject(e);
    },ms);
  });
  return Promise.race([Promise.resolve(promise),guard]).finally(()=>clearTimeout(timer));
}

function getAuth(){
  const app=(firebase.apps||[]).find(a=>a.name==='[DEFAULT]') || firebase.app();
  return firebase.auth(app);
}

async function waitForInitialAuthState(auth){
  if(auth.currentUser) return auth.currentUser;
  return withTimeout(new Promise(resolve=>{
    let done=false;
    const off=auth.onAuthStateChanged(user=>{
      if(done) return;
      done=true;
      try{off();}catch(_){}
      resolve(user||null);
    },()=>{
      if(done) return;
      done=true;
      try{off();}catch(_){}
      resolve(null);
    });
  }),AUTH_RESTORE_TIMEOUT_MS,'AUTH_RESTORE_TIMEOUT').catch(()=>null);
}

let deviceReadyPromise=null;
async function ensureDeviceAuth(){
  if(deviceReadyPromise) return deviceReadyPromise;
  deviceReadyPromise=(async()=>{
    const auth=getAuth();
    try{
      const persistence=firebase.auth.Auth?.Persistence?.LOCAL;
      if(persistence) await auth.setPersistence(persistence);
    }catch(error){
      console.warn('[LEXICON X] auth persistence setup warning',error);
    }

    // IMPORTANT: wait for Firebase to restore a persisted anonymous user first.
    // Calling signInAnonymously before this point can create a new account on every reload.
    let user=auth.currentUser || await waitForInitialAuthState(auth);
    if(user){
      window.dispatchEvent(new CustomEvent('ew-device-auth-ready',{detail:{uid:user.uid,reused:true,version:VERSION}}));
      return user;
    }

    const result=await withTimeout(auth.signInAnonymously(),ANON_SIGNIN_TIMEOUT_MS,'ANON_SIGNIN_TIMEOUT');
    user=result?.user || auth.currentUser;
    if(!user) throw new Error('ANON_AUTH_NO_USER');
    window.dispatchEvent(new CustomEvent('ew-device-auth-ready',{detail:{uid:user.uid,reused:false,version:VERSION}}));
    return user;
  })().catch(error=>{
    deviceReadyPromise=null;
    window.dispatchEvent(new CustomEvent('ew-device-auth-error',{detail:{code:clean(error?.code||error?.message||'AUTH_ERROR'),version:VERSION}}));
    throw error;
  });
  return deviceReadyPromise;
}

function afterDeviceAuth(fn){
  if(typeof fn!=='function') return fn;
  return async function(){
    await ensureDeviceAuth();
    return fn.apply(base,arguments);
  };
}

const wrapped={...base};
wrapped.profileLookup=afterDeviceAuth(base.profileLookup);
wrapped.resume=afterDeviceAuth(base.resume);
wrapped.health=afterDeviceAuth(base.health);
window.EW_AUTHORITY=Object.freeze(wrapped);
window.EW_DEVICE_AUTH_READY=ensureDeviceAuth();
window.EW_DEVICE_AUTH_STABILIZER=Object.freeze({
  version:VERSION,
  persistence:'LOCAL',
  restoreTimeoutMs:AUTH_RESTORE_TIMEOUT_MS,
  anonymousSigninTimeoutMs:ANON_SIGNIN_TIMEOUT_MS,
  ensureDeviceAuth,
  getUid:()=>{try{return getAuth().currentUser?.uid||'';}catch(_){return '';}}
});
}());