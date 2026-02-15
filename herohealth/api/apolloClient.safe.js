// === /herohealth/api/apolloClient.safe.js ===
// Safe Apollo-like wrapper (NO hard dependency).
// ✅ No throw, returns {data, errors, extensions}
// ✅ Endpoint normalize (base -> graphqlPath)
// ✅ Optional disableOnAuth, timeout, robust JSON parsing
// PATCH v20260215a

'use strict';

import { isRemoteDisabled, disableRemote } from './api-status.js';

function normalizeEndpoint(input, graphqlPath){
  const u = String(input || '').trim();
  if(!u) return '';

  // If user already provided a clear endpoint with a path (not just "/"), keep it.
  // e.g. https://host/prod/graphql or https://host/graphql
  try{
    const url = new URL(u);
    const p = url.pathname || '/';
    const hasMeaningfulPath = (p !== '/' && p !== '');
    if(hasMeaningfulPath) return url.toString();

    // Base only -> append graphqlPath
    const gp = String(graphqlPath || '').trim() || '/graphql';
    // ensure starts with /
    url.pathname = gp.startsWith('/') ? gp : ('/' + gp);
    return url.toString();
  }catch{
    // If it's not a valid absolute URL, just return as-is (caller can handle)
    return u;
  }
}

async function readJsonSafely(res){
  // Prefer text first to survive HTML errors / empty body
  let text = '';
  try{ text = await res.text(); }catch{ /* ignore */ }
  if(!text) return null;

  try{ return JSON.parse(text); }catch{ return null; }
}

export function createSafeClient({
  uri,
  graphqlPath = '/prod/graphql', // ✅ change default to your real path (adjust!)
  timeoutMs = 6000,
  disableOnAuth = true,          // ✅ set false if 401/403 is "normal" and you don't want global disable
  extraHeaders = null
}){
  const endpoint = normalizeEndpoint(uri, graphqlPath);

  async function safePost(body){
    if(!endpoint) return { ok:false, status:0, json:null, reason:'missing_uri' };
    if(isRemoteDisabled()) return { ok:false, status:403, json:null, reason:'disabled' };

    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), timeoutMs);

    try{
      const headers = {
        'content-type': 'application/json',
        'accept': 'application/json',
        ...(extraHeaders && typeof extraHeaders === 'object' ? extraHeaders : {})
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-store',
        credentials: 'omit',
        headers,
        body: JSON.stringify(body || {}),
        signal: ctrl.signal
      });

      const status = res.status || 0;

      // Try parse body even for errors (GraphQL servers often return JSON with errors)
      const json = await readJsonSafely(res);

      // Auth / forbidden
      if(status === 401 || status === 403){
        if(disableOnAuth) disableRemote(status, 'auth');
        return { ok:false, status, json, reason:'forbidden' };
      }

      if(status >= 200 && status < 300){
        return { ok:true, status, json, reason:'ok' };
      }

      return { ok:false, status, json, reason:'http_error' };
    }catch(e){
      const msg = String(e?.message || e);
      // Optional: you might disableRemote on repeated network errors, but I’d keep it passive.
      return { ok:false, status:0, json:null, reason:'fetch_error', error: msg };
    }finally{
      clearTimeout(t);
    }
  }

  function wrapResult(r){
    // Always return Apollo-ish shape, never throw
    if(!r.ok){
      return {
        data: null,
        errors: [{ message: `API ${r.status || 0} ${r.reason || 'error'}` }],
        extensions: {
          status: r.status || 0,
          reason: r.reason || 'error',
          endpoint
        }
      };
    }
    // GraphQL servers return {data, errors}. If null, normalize.
    return r.json || { data:null };
  }

  return {
    endpoint, // expose for debug
    async query({ query, variables }){
      const r = await safePost({ query, variables });
      return wrapResult(r);
    },
    async mutate({ mutation, variables }){
      const r = await safePost({ query: mutation, variables });
      return wrapResult(r);
    }
  };
}
