// === /herohealth/api/apolloClient.safe.js ===
// Apollo client (403-safe) + graceful degrade

'use strict';

import { ApolloClient, InMemoryCache, HttpLink, from } from 'https://cdn.skypack.dev/@apollo/client@3.9.7';
import { onError } from 'https://cdn.skypack.dev/@apollo/client@3.9.7/link/error';

function withTimeout(fetchFn, ms){
  return function(url, init){
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), ms);
    const nextInit = Object.assign({}, init || {}, { signal: ctrl.signal });
    return fetchFn(url, nextInit).finally(()=>clearTimeout(t));
  };
}

/**
 * createApolloClientSafe({ endpoint, ui, timeoutMs })
 * - ui: object with set(state,title,msg) (optional)
 */
export function createApolloClientSafe(opts = {}){
  const endpoint = String(opts.endpoint || '').trim();
  const ui = opts.ui || null;
  const timeoutMs = Math.max(1500, Math.min(15000, Number(opts.timeoutMs || 6500)));

  const setUI = (state, title, msg)=>{
    try{ ui && typeof ui.set === 'function' && ui.set(state, title, msg); }catch(_){}
  };

  // error link: catch 403 + network errors
  const errorLink = onError(({ networkError, graphQLErrors, operation }) => {
    // networkError may include statusCode
    const status = Number(networkError?.statusCode || networkError?.status || 0);

    if(status === 403){
      setUI('bad', '403 Forbidden ⚠️', 'API ปฏิเสธสิทธิ์/Origin — ระบบจะทำงานแบบออฟไลน์ (หน้าไม่พัง)');
    }else if(status){
      setUI('warn', `API ตอบ ${status}`, 'ยังเข้าเกมได้ปกติ • ตรวจ route/headers/authorizer');
    }else if(networkError){
      setUI('bad', 'ออฟไลน์/เชื่อมต่อไม่ได้', 'ยังเข้าเกมได้ปกติ • ตรวจ CORS/เครือข่าย');
    }

    // OPTIONAL: log for dev
    try{
      console.warn('[ApolloSafe] error op=', operation?.operationName || '(anon)', { status, networkError, graphQLErrors });
    }catch(_){}
  });

  const httpLink = new HttpLink({
    uri: endpoint,
    fetch: withTimeout(fetch, timeoutMs),
    headers: { 'content-type':'application/json' }
  });

  const client = new ApolloClient({
    link: from([errorLink, httpLink]),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { fetchPolicy: 'no-cache', errorPolicy: 'all' },
      watchQuery: { fetchPolicy: 'no-cache', errorPolicy: 'all' }
    }
  });

  return {
    client,
    endpoint,
    async safeQuery(args){
      try{
        const r = await client.query(args);
        // if errors exist, don't crash caller
        if(r?.errors?.length){
          setUI('warn', 'API ตอบ error', 'แต่หน้าไม่พัง (degrade gracefully)');
        }else{
          setUI('ok', 'ออนไลน์ ✅', 'API ตอบกลับปกติ');
        }
        return { ok:true, result:r };
      }catch(err){
        setUI('bad', 'API ใช้งานไม่ได้', 'แต่หน้าไม่พัง (offline mode)');
        return { ok:false, error: String(err?.message || err || 'QUERY_FAILED') };
      }
    }
  };
}