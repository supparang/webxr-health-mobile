// === /herohealth/api/api-probe.js ===
// Lightweight probe (no Apollo). If 401/403 -> disableRemote.

'use strict';

import { disableRemote, isRemoteDisabled } from './api-status.js';

export async function probeApi({ uri }){
  if(!uri) return { ok:false, status:0, reason:'missing_uri' };
  if(isRemoteDisabled()) return { ok:false, status:403, reason:'disabled' };

  // Try POST first (your error is POST 403). If blocked, still safe.
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 3500);

  try{
    const res = await fetch(uri, {
      method: 'POST',
      mode: 'cors',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op:'probe', ts:Date.now(), from:'herohealth-hub' }),
      signal: controller.signal
    });

    const status = res.status || 0;

    if(status >= 200 && status < 300){
      return { ok:true, status, reason:'ok' };
    }

    if(status === 401 || status === 403){
      disableRemote(status, 'auth');
      return { ok:false, status, reason:'forbidden' };
    }

    return { ok:false, status, reason:'http_error' };
  }catch(e){
    // network / CORS / timeout
    return { ok:false, status:0, reason:'fetch_error', error:String(e?.message||e) };
  }finally{
    clearTimeout(timeout);
  }
}
