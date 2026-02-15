// === /herohealth/api/api-status.js ===
// Remote disable latch (per-tab) for 401/403 to prevent retry spam

'use strict';

const KEY = 'HHA_API_DISABLED';
const TTL_MS = 15 * 60 * 1000; // 15 min

export function disableRemote(code=403, reason='forbidden'){
  try{
    const payload = { code:Number(code)||403, reason:String(reason||''), ts:Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  }catch{}
}

export function clearDisable(){
  try{ sessionStorage.removeItem(KEY); }catch{}
}

export function disabledInfo(){
  try{
    const raw = sessionStorage.getItem(KEY);
    if(!raw) return { disabled:false };
    const d = JSON.parse(raw);
    return { disabled:true, code:d.code||403, reason:d.reason||'', ts:d.ts||0 };
  }catch{
    return { disabled:false };
  }
}

export function isRemoteDisabled(){
  const info = disabledInfo();
  if(!info.disabled) return false;
  const age = Date.now() - (info.ts||0);
  if(age > TTL_MS){
    clearDisable();
    return false;
  }
  return true;
}
