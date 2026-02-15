// === /herohealth/api/api-probe.js ===
// Lightweight probe (no Apollo).
// ✅ GET health endpoint (no POST to root)
// ✅ Optional disableOnAuth (default false to avoid unnecessary global offline)
// PATCH v20260215d

'use strict';

import { disableRemote, isRemoteDisabled } from './api-status.js';

function normalizeHealthUrl(base, healthPath){
  const b = String(base || '').trim();
  if(!b) return '';

  const hp = String(healthPath || '').trim() || '/health';

  try{
    const url = new URL(b);
    // if base already has a meaningful path and caller passed healthPath,
    // we still respect healthPath (probe should be explicit).
    url.pathname = hp.startsWith('/') ? hp : ('/' + hp);
    // clear query for probe (optional)
    url.search = '';
    return url.toString();
  }catch{
    // If it's not an absolute URL, just best-effort concat
    const slash = b.endsWith('/') ? '' : '/';
    const p = hp.startsWith('/') ? hp.slice(1) : hp;
    return b + slash + p;
  }
}

export async function probeApi({
  uri,
  healthPath = '/prod/health', // ✅ set your public probe route here
  timeoutMs = 3500,
  disableOnAuth = false        // ✅ IMPORTANT: false prevents "offline lock" when auth is expected
}){
  if(!uri) return { ok:false, status:0, reason:'missing_uri' };
  if(isRemoteDisabled()) return { ok:false, status:403, reason:'disabled' };

  const url = normalizeHealthUrl(uri, healthPath);
  if(!url) return { ok:false, status:0, reason:'missing_url' };

  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), timeoutMs);

  try{
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'accept': 'application/json' },
      signal: controller.signal
    });

    const status = res.status || 0;

    if(status >= 200 && status < 300){
      return { ok:true, status, reason:'ok', url };
    }

    if(status === 401 || status === 403){
      if(disableOnAuth) disableRemote(status, 'auth');
      return { ok:false, status, reason:'forbidden', url };
    }

    return { ok:false, status, reason:'http_error', url };
  }catch(e){
    // network / CORS / timeout
    return { ok:false, status:0, reason:'fetch_error', url, error:String(e?.message||e) };
  }finally{
    clearTimeout(timeout);
  }
}
