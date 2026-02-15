// === /herohealth/api/api-status.js ===
// HHA API Status — 403-safe + session disable
// Stores: sessionStorage (per-tab) + localStorage (optional hint)

'use strict';

const KEY_DISABLED = 'HHA_REMOTE_DISABLED';
const KEY_DISABLED_CODE = 'HHA_REMOTE_DISABLED_CODE';
const KEY_DISABLED_REASON = 'HHA_REMOTE_DISABLED_REASON';
const KEY_DISABLED_UNTIL = 'HHA_REMOTE_DISABLED_UNTIL';

const now = () => Date.now();

function ssGet(k){
  try{ return sessionStorage.getItem(k); }catch{ return null; }
}
function ssSet(k,v){
  try{ sessionStorage.setItem(k, String(v)); }catch{}
}
function ssDel(k){
  try{ sessionStorage.removeItem(k); }catch{}
}

export function disableRemote(code=0, reason=''){
  // Disable for this tab session (no background retry flood)
  ssSet(KEY_DISABLED, '1');
  ssSet(KEY_DISABLED_CODE, String(code||0));
  ssSet(KEY_DISABLED_REASON, String(reason||''));
  // optional: disable for 10 minutes (so reloads don't instantly spam)
  ssSet(KEY_DISABLED_UNTIL, String(now() + 10*60*1000));
}

export function clearDisable(){
  ssDel(KEY_DISABLED);
  ssDel(KEY_DISABLED_CODE);
  ssDel(KEY_DISABLED_REASON);
  ssDel(KEY_DISABLED_UNTIL);
}

export function isRemoteDisabled(){
  const flag = ssGet(KEY_DISABLED) === '1';
  if(!flag) return false;

  const until = Number(ssGet(KEY_DISABLED_UNTIL) || 0) || 0;
  if(until && now() > until){
    // expire disable window => allow probe again
    clearDisable();
    return false;
  }
  return true;
}

export function disabledInfo(){
  return {
    disabled: isRemoteDisabled(),
    code: Number(ssGet(KEY_DISABLED_CODE) || 0) || 0,
    reason: String(ssGet(KEY_DISABLED_REASON) || ''),
    until: Number(ssGet(KEY_DISABLED_UNTIL) || 0) || 0
  };
}
