// === /herohealth/api/api-probe.js ===
// 403-safe API probe (best-effort)
// ✅ never throws
// ✅ returns { ok, status, hint, elapsedMs }

'use strict';

function normalizeEndpoint(endpoint){
  const ep = String(endpoint || '').trim();
  if(!ep) return '';
  // Ensure ends with /
  return ep.endsWith('/') ? ep : (ep + '/');
}

async function doFetch(url, timeoutMs=5500){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), timeoutMs);
  try{
    const res = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ ping:true }),
      signal: ctrl.signal
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

/**
 * probe(endpoint, { timeoutMs })
 * endpoint: base like https://xxxx.execute-api....amazonaws.com/  OR full /graphql
 */
export async function probe(endpoint, opts={}){
  const t0 = (performance?.now ? performance.now() : Date.now());
  const timeoutMs = Math.max(1500, Math.min(12000, Number(opts.timeoutMs||5500)));

  const ep = String(endpoint || '').trim();
  if(!ep){
    return { ok:false, status:0, hint:'no-endpoint', elapsedMs:0 };
  }

  // Try a small list of candidates
  const base = normalizeEndpoint(ep);
  const candidates = [];

  // If user passed full path (contains /graphql or has trailing path), try as-is first
  candidates.push(ep);

  // Then common GraphQL routes (if base looks like domain root)
  if(base){
    candidates.push(base); // POST to root sometimes works (returns 403/404)
    candidates.push(base + 'graphql');
    candidates.push(base + 'prod/graphql');
    candidates.push(base + 'dev/graphql');
  }

  let lastStatus = 0;
  let lastHint = 'network';
  for(const url of candidates){
    if(!url) continue;
    try{
      const res = await doFetch(url, timeoutMs);

      lastStatus = res.status || 0;

      if(res.status === 200){
        const t1 = (performance?.now ? performance.now() : Date.now());
        return { ok:true, status:200, hint:'ok', url, elapsedMs: Math.round(t1 - t0) };
      }

      if(res.status === 403){
        const t1 = (performance?.now ? performance.now() : Date.now());
        return {
          ok:false, status:403, hint:'forbidden',
          url, elapsedMs: Math.round(t1 - t0)
        };
      }

      // 401/404/500 etc -> still return warn but keep trying next candidate
      lastHint = (res.status === 404) ? 'not-found'
               : (res.status === 401) ? 'unauthorized'
               : (res.status >= 500) ? 'server'
               : 'http';
    }catch(e){
      lastHint = (String(e||'').includes('AbortError')) ? 'timeout' : 'network';
      // keep trying next candidate
    }
  }

  const t1 = (performance?.now ? performance.now() : Date.now());
  return { ok:false, status:lastStatus||0, hint:lastHint, elapsedMs: Math.round(t1 - t0) };
}