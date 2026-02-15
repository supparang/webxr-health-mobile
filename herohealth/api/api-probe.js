// === /herohealth/api/api-probe.js ===
// Probe API reachability without crashing UI
// Strategy: attempt a lightweight POST (GraphQL-ish) and interpret status.
// - 200/2xx => OK
// - 401/403 => forbidden => disable remote
// - other => treat as down (temporary)

'use strict';

import { disableRemote } from './api-status.js';

function timeoutFetch(url, options={}, timeoutMs=4500){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), timeoutMs);
  return fetch(url, { ...options, signal: ctrl.signal })
    .finally(()=> clearTimeout(t));
}

export async function probeApi({ uri, timeoutMs=4500 }){
  if(!uri) return { ok:false, status:0, reason:'missing_uri' };

  let res;
  try{
    // Many API gateways reject GET; POST is closer to actual traffic.
    res = await timeoutFetch(uri, {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ query: 'query Ping{__typename}' })
    }, timeoutMs);
  }catch(err){
    return { ok:false, status:0, reason: String(err?.name || err || 'network_error') };
  }

  const status = res.status || 0;

  if(status >= 200 && status < 300){
    return { ok:true, status, reason:'ok' };
  }

  // 401/403 = not allowed (key/authorizer/policy/WAF)
  if(status === 401 || status === 403){
    disableRemote(status, 'forbidden');
    return { ok:false, status, reason:'forbidden' };
  }

  // Other errors: treat as down (don’t hard-disable forever)
  return { ok:false, status, reason:'down' };
}
