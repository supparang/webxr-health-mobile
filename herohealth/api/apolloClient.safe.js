// === /herohealth/api/apolloClient.safe.js ===
// HeroHealth API Safe Client (GraphQL/REST) — v20260214a
// ✅ 403-safe: never crash UI
// ✅ backoff + spam guard
// ✅ offline fallback

'use strict';

const DEFAULT_ENDPOINT = 'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/'; // ปรับได้จาก caller

const sleep = (ms)=>new Promise(r=>setTimeout(r, ms));

function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

function classifyFetchError(err){
  const msg = String(err?.message || err || '');
  // Browsers often say: "Failed to fetch" on CORS/network failures
  const isCorsOrNetwork = /failed to fetch|networkerror|cors|load failed/i.test(msg);
  return { isCorsOrNetwork, message: msg };
}

export function createSafeApiClient(opts={}){
  const endpoint = String(opts.endpoint || DEFAULT_ENDPOINT);
  const getAuthToken = (typeof opts.getAuthToken === 'function') ? opts.getAuthToken : ()=>null;

  const state = {
    lastFailAt: 0,
    failCount: 0,
    inflight: false,
  };

  function backoffMs(){
    // 0, 300, 800, 1600, 3000, 5000 cap
    const fc = Math.min(6, state.failCount|0);
    const arr = [0, 300, 800, 1600, 3000, 5000, 5000];
    return arr[fc] || 1000;
  }

  async function safeFetch(url, init){
    // spam guard (if failing a lot, slow down)
    const bo = backoffMs();
    if(bo > 0) await sleep(bo);

    try{
      const res = await fetch(url, init);
      if(res.ok){
        state.failCount = 0;
        return { ok:true, res };
      }
      // record fail
      state.failCount = Math.min(10, (state.failCount|0) + 1);
      state.lastFailAt = nowMs();
      return { ok:false, res };
    }catch(err){
      state.failCount = Math.min(10, (state.failCount|0) + 1);
      state.lastFailAt = nowMs();
      const info = classifyFetchError(err);
      return { ok:false, err, offline:true, info };
    }
  }

  async function graphql(query, variables={}, extraHeaders={}){
    const token = getAuthToken?.();
    const headers = {
      'content-type':'application/json',
      ...extraHeaders
    };
    if(token) headers['authorization'] = `Bearer ${token}`;

    const init = {
      method:'POST',
      mode:'cors',
      headers,
      body: JSON.stringify({ query, variables })
    };

    const r = await safeFetch(endpoint, init);

    // network/cors fail
    if(!r.ok && r.offline){
      return {
        ok:false,
        offline:true,
        status: 0,
        error: 'NETWORK_OR_CORS',
        message: r.info?.message || 'Failed to fetch'
      };
    }

    const res = r.res;
    const status = res?.status || 0;

    if(!r.ok){
      // 403 / 401 / 5xx
      let bodyText = '';
      try{ bodyText = await res.text(); }catch(_){}
      return {
        ok:false,
        offline:false,
        status,
        error: (status===403) ? 'FORBIDDEN' : (status===401) ? 'UNAUTHORIZED' : 'HTTP_ERROR',
        message: bodyText || `HTTP ${status}`
      };
    }

    // ok
    let json = null;
    try{ json = await res.json(); }catch(_){}

    if(json?.errors?.length){
      return {
        ok:false,
        offline:false,
        status,
        error:'GRAPHQL_ERROR',
        message: json.errors[0]?.message || 'GraphQL error',
        details: json.errors
      };
    }

    return { ok:true, offline:false, status, data: json?.data ?? null };
  }

  // REST ping (optional)
  async function ping(){
    const r = await safeFetch(endpoint, {
      method:'POST',
      mode:'cors',
      headers:{ 'content-type':'application/json' },
      body: JSON.stringify({ ping:true })
    });
    if(r.ok) return { ok:true, status:r.res.status };
    if(r.offline) return { ok:false, offline:true, status:0 };
    return { ok:false, offline:false, status:r.res?.status||0 };
  }

  return { graphql, ping, endpoint };
}