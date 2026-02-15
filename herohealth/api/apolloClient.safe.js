// === /herohealth/api/apolloClient.safe.js ===
// Safe Apollo-like wrapper (NO hard dependency).
// If you already have real ApolloClient, you can adapt this pattern.

'use strict';

import { isRemoteDisabled, disableRemote } from './api-status.js';

export function createSafeClient({ uri }){
  const endpoint = String(uri||'').trim();

  async function safePost(body){
    if(!endpoint) return { ok:false, status:0, json:null, reason:'missing_uri' };
    if(isRemoteDisabled()) return { ok:false, status:403, json:null, reason:'disabled' };

    try{
      const res = await fetch(endpoint, {
        method:'POST',
        mode:'cors',
        headers:{ 'content-type':'application/json' },
        body: JSON.stringify(body||{})
      });

      const status = res.status || 0;

      if(status === 401 || status === 403){
        disableRemote(status, 'auth');
        return { ok:false, status, json:null, reason:'forbidden' };
      }

      let json = null;
      try{ json = await res.json(); }catch{ /* ignore */ }

      if(status >= 200 && status < 300){
        return { ok:true, status, json, reason:'ok' };
      }
      return { ok:false, status, json, reason:'http_error' };
    }catch(e){
      return { ok:false, status:0, json:null, reason:'fetch_error', error:String(e?.message||e) };
    }
  }

  // Apollo-compatible-ish: client.query / client.mutate returning Promise without throw
  return {
    async query({ query, variables }){
      const body = { query, variables };
      const r = await safePost(body);

      if(!r.ok){
        return {
          data: null,
          errors: [{ message:`API ${r.status||0} ${r.reason||'error'}` }],
          extensions: { status:r.status||0, reason:r.reason||'error' }
        };
      }
      // GraphQL servers usually return {data, errors}
      return r.json || { data:null };
    },

    async mutate({ mutation, variables }){
      const body = { query: mutation, variables };
      const r = await safePost(body);

      if(!r.ok){
        return {
          data: null,
          errors: [{ message:`API ${r.status||0} ${r.reason||'error'}` }],
          extensions: { status:r.status||0, reason:r.reason||'error' }
        };
      }
      return r.json || { data:null };
    }
  };
}
