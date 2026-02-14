// === /herohealth/api/apolloClient.safe.js ===
// HeroHealth — Apollo Client SAFE wrapper (403/offline won't crash UI) — v20260214a
// ✅ Handles 403 Forbidden gracefully (banner + soft-fail)
// ✅ Works even if Apollo isn't loaded (returns null client)
// ✅ Includes safeFetchJSON helper for REST endpoints too

'use strict';

import { showApiBanner, hideApiBanner } from './api-status.js';

function qs(k, d=null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; }
}

function nowTs(){
  return Date.now ? Date.now() : +new Date();
}

function isProbablyCorsOrNetwork(err){
  const msg = String(err?.message || err || '');
  // Browsers often throw TypeError: Failed to fetch for CORS/network
  return /Failed to fetch|NetworkError|CORS|Load failed|fetch/i.test(msg);
}

function parseStatusFromApolloError(err){
  // ApolloError shape varies depending on link/implementation.
  // Try common places:
  // err.networkError.statusCode
  // err.networkError.response.status
  // err.networkError.status
  const ne = err?.networkError;
  const status =
    ne?.statusCode ??
    ne?.status ??
    ne?.response?.status ??
    err?.statusCode ??
    err?.status ??
    null;

  return Number.isFinite(Number(status)) ? Number(status) : null;
}

function defaultApiUrl(){
  // Priority:
  // 1) ?api=...
  // 2) localStorage override
  // 3) hardcoded fallback (your AWS endpoint)
  return (
    qs('api','') ||
    (()=>{
      try{ return localStorage.getItem('HHA_API_URL') || ''; }catch{ return ''; }
    })() ||
    'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/'
  );
}

function shouldUseApi(){
  // allow disabling API easily:
  // ?api=off or ?noapi=1
  const api = String(qs('api','')).toLowerCase();
  if(api === 'off' || api === '0') return false;
  const noapi = String(qs('noapi','')).toLowerCase();
  if(noapi === '1' || noapi === 'true') return false;
  return true;
}

function bannerFor403(url){
  showApiBanner({
    state: 'bad',
    title: 'API 403 (Forbidden)',
    message:
      `ยิงไปที่ API แล้วถูกปฏิเสธ (403)\n` +
      `• URL: ${url}\n` +
      `• สาเหตุที่พบบ่อย: API Gateway/Cognito/Key/Origin ไม่อนุญาต หรือ CORS ไม่เปิด`,
    onRetry: ()=>location.reload()
  });
}

function bannerForNetwork(url, err){
  showApiBanner({
    state: 'warn',
    title: 'API ใช้งานไม่ได้',
    message:
      `ยิงไปที่ API ไม่สำเร็จ (อาจเป็น CORS/Network/Offline)\n` +
      `• URL: ${url}\n` +
      `• ${String(err?.message || err || 'Unknown error')}`,
    onRetry: ()=>location.reload()
  });
}

function bannerOk(){
  hideApiBanner();
}

/** -------------------------------------------------------
 *  SAFE Fetch (REST) — returns {ok,status,data,error}
 *  ----------------------------------------------------- */
export async function safeFetchJSON(url, options = {}){
  const finalUrl = url || defaultApiUrl();

  if(!shouldUseApi()){
    return { ok:false, status:0, data:null, error:new Error('API disabled by query') };
  }

  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {}
  );

  try{
    const res = await fetch(finalUrl, Object.assign({}, options, { headers }));

    if(res.status === 403){
      bannerFor403(finalUrl);
      return { ok:false, status:403, data:null, error:new Error('403 Forbidden') };
    }

    if(!res.ok){
      // try parse body for debugging
      let text = '';
      try{ text = await res.text(); }catch(_){}
      showApiBanner({
        state:'warn',
        title:`API Error ${res.status}`,
        message:`API ตอบกลับไม่สำเร็จ (${res.status})\n• URL: ${finalUrl}\n• ${text.slice(0,220)}`,
        onRetry: ()=>location.reload()
      });
      return { ok:false, status:res.status, data:null, error:new Error(`HTTP ${res.status}`) };
    }

    // OK
    let data = null;
    try{ data = await res.json(); }catch(_){ data = null; }
    bannerOk();
    return { ok:true, status:res.status, data, error:null };

  }catch(err){
    bannerForNetwork(finalUrl, err);
    return { ok:false, status:0, data:null, error:err };
  }
}

/** -------------------------------------------------------
 *  Apollo SAFE Client — returns ApolloClient or null
 *  ----------------------------------------------------- */
export function createApolloClientSafe(opts = {}){
  const apiUrl = String(opts.apiUrl || defaultApiUrl());
  const useApi = shouldUseApi();

  // Apollo must exist (either via bundler or global)
  const Apollo =
    opts.Apollo ||
    (window?.Apollo) ||
    null;

  // If you're bundling @apollo/client, you can pass it in opts.Apollo
  // Otherwise, if nothing is available: return null safely.
  if(!Apollo){
    // No Apollo loaded => do not crash
    showApiBanner({
      state:'warn',
      title:'Apollo ไม่พร้อมใช้งาน',
      message:'ไม่พบ Apollo ในหน้านี้ (ข้ามการเรียก GraphQL แล้ว UI จะไม่พัง)',
      onRetry: ()=>location.reload()
    });
    return null;
  }

  const {
    ApolloClient,
    InMemoryCache,
    HttpLink,
    ApolloLink,
    from
  } = Apollo;

  // Some builds expose "onError" separately; try to resolve:
  const onError =
    opts.onError ||
    Apollo?.onError ||
    window?.apolloLinkError?.onError ||
    null;

  if(!ApolloClient || !InMemoryCache || !HttpLink || !ApolloLink){
    showApiBanner({
      state:'warn',
      title:'Apollo ไม่ครบชุด',
      message:'มี Apollo แต่ไม่มี component ที่ต้องใช้ (ApolloClient/HttpLink/etc.)',
      onRetry: ()=>location.reload()
    });
    return null;
  }

  if(!useApi){
    showApiBanner({
      state:'warn',
      title:'API ถูกปิดไว้',
      message:'ตอนนี้ปิด API ด้วยพารามิเตอร์ใน URL (?noapi=1 หรือ ?api=off)',
      onRetry: ()=>location.reload()
    });
    return null;
  }

  // Build Links
  const httpLink = new HttpLink({
    uri: apiUrl,
    // IMPORTANT: if your API expects cookies/credentials:
    // credentials: 'include',
    // fetchOptions: { mode:'cors' }, // optional
  });

  const statusLink = new ApolloLink((operation, forward)=>{
    const t0 = nowTs();
    return forward(operation).map((result)=>{
      // success
      bannerOk();
      // could add timing if needed
      void(t0);
      return result;
    });
  });

  // Error handler link
  let errorLink = null;

  if(typeof onError === 'function'){
    errorLink = onError(({ networkError })=>{
      const status = networkError?.statusCode || networkError?.status || networkError?.response?.status;

      if(Number(status) === 403){
        bannerFor403(apiUrl);
        // do not throw here; Apollo will still reject, but UI can choose to ignore
        return;
      }

      if(networkError){
        bannerForNetwork(apiUrl, networkError);
        return;
      }
    });
  }else{
    // fallback: simple link that catches downstream errors
    errorLink = new ApolloLink((operation, forward)=>{
      return forward(operation).map((res)=>res).catch((err)=>{
        const st = parseStatusFromApolloError(err);
        if(st === 403) bannerFor403(apiUrl);
        else if(isProbablyCorsOrNetwork(err)) bannerForNetwork(apiUrl, err);
        else{
          showApiBanner({
            state:'warn',
            title:'Apollo Error',
            message:String(err?.message || err || 'Unknown Apollo error'),
            onRetry: ()=>location.reload()
          });
        }
        throw err;
      });
    });
  }

  // Compose link chain: error -> status -> http
  const link = from([ errorLink, statusLink, httpLink ]);

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
    // defaultOptions: { watchQuery: { fetchPolicy: 'no-cache' } } // optional
  });

  return client;
}

/** -------------------------------------------------------
 *  SAFE GraphQL Query helper (won't crash caller)
 *  ----------------------------------------------------- */
export async function safeApolloQuery(client, { query, variables }){
  if(!client){
    return { ok:false, status:0, data:null, error:new Error('Apollo client not available') };
  }

  try{
    const res = await client.query({ query, variables });
    bannerOk();
    return { ok:true, status:200, data:res?.data ?? null, error:null };
  }catch(err){
    const st = parseStatusFromApolloError(err);
    if(st === 403) bannerFor403(defaultApiUrl());
    else if(isProbablyCorsOrNetwork(err)) bannerForNetwork(defaultApiUrl(), err);
    return { ok:false, status:st || 0, data:null, error:err };
  }
}