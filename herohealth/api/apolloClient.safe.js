// === /herohealth/api/apolloClient.safe.js ===
// HeroHealth — Apollo Client SAFE (403/Network guard + graceful fallback) — v20260214a
// ✅ Create client safely (no crash if Apollo libs missing)
// ✅ Uniform safe query wrapper that NEVER throws
// ✅ Detects 401/403/5xx/network and shows banner via api-status.js
// ✅ Retry helper
//
// Usage:
//   import { createApolloClientSafe, safeApolloQuery } from './apolloClient.safe.js';
//   const client = createApolloClientSafe({ apiUrl: 'https://.../graphql' });
//   const res = await safeApolloQuery(client, { query: MY_QUERY, variables: {...} });
//   if(res.ok) ... else fallback ...

'use strict';

import { showApiBanner, hideApiBanner } from './api-status.js';

function noop(){}

function looksLikeBundledApollo(){
  // You might have Apollo injected by your bundler; try common globals
  const W = window;
  return {
    ApolloClient: W.ApolloClient || W.apolloClient || null,
    InMemoryCache: W.InMemoryCache || W.apolloCache || null,
    HttpLink: W.HttpLink || null,
    ApolloLink: W.ApolloLink || null,
    from: W.from || null,
    onError: W.onError || null,
    gql: W.gql || null
  };
}

function normalizeUrl(u){
  try{
    if(!u) return '';
    return String(u).trim();
  }catch{ return ''; }
}

function defaultApiUrl(){
  // allow override via querystring ?api=...
  try{
    const q = new URL(location.href).searchParams;
    const api = q.get('api');
    if(api) return String(api);
  }catch(_){}
  return '';
}

function isLikely403(err){
  const msg = String(err?.message || err || '');
  if(msg.includes('403')) return true;
  const status = err?.networkError?.statusCode || err?.statusCode || err?.status;
  return Number(status) === 403;
}

function isLikely401(err){
  const msg = String(err?.message || err || '');
  if(msg.includes('401')) return true;
  const status = err?.networkError?.statusCode || err?.statusCode || err?.status;
  return Number(status) === 401;
}

function statusFromApolloError(err){
  // ApolloError often has: networkError.statusCode
  const status = err?.networkError?.statusCode
    || err?.statusCode
    || err?.status
    || null;

  if(Number.isFinite(Number(status))) return Number(status);

  // fallback parse message
  const m = String(err?.message || '');
  const match = m.match(/\b(401|403|404|429|500|502|503|504)\b/);
  if(match) return Number(match[1]);
  return null;
}

function bannerForStatus(status){
  if(status === 401) return { state:'warn', title:'API 401', message:'ยังไม่ได้รับอนุญาต (Unauthorized) — ตรวจ token / auth' };
  if(status === 403) return { state:'warn', title:'API 403', message:'ถูกปฏิเสธสิทธิ์ (Forbidden) — endpoint / API key / CORS / IAM อาจไม่อนุญาต' };
  if(status === 429) return { state:'warn', title:'API 429', message:'เรียกถี่เกิน (Rate limit) — ลองใหม่อีกครั้ง' };
  if(status >= 500) return { state:'warn', title:`API ${status}`, message:'ฝั่งเซิร์ฟเวอร์มีปัญหา (5xx) — ใช้โหมด offline ชั่วคราว' };
  if(status) return { state:'warn', title:`API ${status}`, message:'เรียก API ไม่สำเร็จ — ใช้โหมด offline ชั่วคราว' };
  return { state:'warn', title:'API offline', message:'เชื่อมต่อ API ไม่ได้ — ใช้โหมด offline ชั่วคราว' };
}

function safeShowBannerFromError(err){
  const status = statusFromApolloError(err);
  const b = bannerForStatus(status);
  showApiBanner({
    state: b.state,
    title: b.title,
    message: b.message,
    detail: String(err?.message || err || ''),
    onRetry: ()=>location.reload()
  });
  return status;
}

/**
 * Create Apollo client safely.
 * - If libs not available => returns null (caller must fallback)
 * - If apiUrl empty => returns null
 */
export function createApolloClientSafe(opts = {}){
  const apiUrl = normalizeUrl(opts.apiUrl || defaultApiUrl());
  if(!apiUrl){
    // No URL => don't create client, let caller go offline
    return null;
  }

  // libs can be passed in or discovered from globals
  const L = Object.assign({}, looksLikeBundledApollo(), opts.libs || {});
  const ApolloClient = opts.ApolloClient || L.ApolloClient;
  const InMemoryCache = opts.InMemoryCache || L.InMemoryCache;
  const HttpLink = opts.HttpLink || L.HttpLink;
  const ApolloLink = opts.ApolloLink || L.ApolloLink;
  const from = opts.from || L.from;
  const onError = opts.onError || L.onError;

  if(!ApolloClient || !InMemoryCache || !HttpLink){
    // Apollo not present in this build
    showApiBanner({
      state:'warn',
      title:'Apollo missing',
      message:'ไม่มี Apollo ใน build นี้ → ใช้โหมด offline',
      onRetry: ()=>location.reload()
    });
    return null;
  }

  // Build link chain with error guard if possible
  let link = null;

  try{
    const httpLink = new HttpLink({
      uri: apiUrl,
      // IMPORTANT: GitHub Pages + Lambda/API Gateway often needs CORS headers server-side
      // keep credentials off by default
      fetchOptions: { mode: 'cors' }
    });

    // error link
    if(onError && (ApolloLink || from)){
      const errLink = onError(({ graphQLErrors, networkError })=>{
        // GraphQL errors (200 but errors[]) still should not crash UI
        if(graphQLErrors && graphQLErrors.length){
          // show only once-ish; keep it gentle
          showApiBanner({
            state:'warn',
            title:'GraphQL error',
            message:'มีข้อผิดพลาดจาก GraphQL — ใช้โหมด offline/ข้อมูลล่าสุด',
            detail: graphQLErrors.map(e=>e?.message).filter(Boolean).join(' | ') || '',
            onRetry: ()=>location.reload()
          });
        }
        if(networkError){
          safeShowBannerFromError(networkError);
        }
      });

      if(from){
        link = from([errLink, httpLink]);
      }else if(ApolloLink && typeof ApolloLink.from === 'function'){
        link = ApolloLink.from([errLink, httpLink]);
      }else{
        link = httpLink;
      }
    }else{
      link = httpLink;
    }

    const cache = new InMemoryCache();

    const client = new ApolloClient({
      link,
      cache,
      // avoid noisy warnings if you have partial errors
      defaultOptions: {
        watchQuery: { errorPolicy: 'all', fetchPolicy: 'network-only' },
        query: { errorPolicy: 'all', fetchPolicy: 'network-only' },
        mutate: { errorPolicy: 'all' }
      }
    });

    return client;
  }catch(err){
    // Construction failed => fallback
    safeShowBannerFromError(err);
    return null;
  }
}

/**
 * Safe Apollo query wrapper.
 * - NEVER throws
 * - returns: { ok:boolean, data:any|null, error:any|null, status:number|null }
 */
export async function safeApolloQuery(client, req){
  if(!client || !req || !req.query){
    return { ok:false, data:null, error:'NO_CLIENT_OR_QUERY', status:null };
  }

  try{
    const res = await client.query(req);

    // Apollo can return res.errors (GraphQL errors) even if data present
    // Treat as ok if data exists, but still show banner softly
    if(res?.errors && res.errors.length){
      showApiBanner({
        state:'warn',
        title:'GraphQL warnings',
        message:'API ตอบกลับพร้อม error บางส่วน — แสดงข้อมูลเท่าที่มี',
        detail: res.errors.map(e=>e?.message).filter(Boolean).join(' | ') || '',
        onRetry: ()=>location.reload()
      });
    }else{
      // success => hide banner
      hideApiBanner();
    }

    const data = res?.data ?? null;
    return { ok: !!data, data, error: (res?.errors || null), status: null };
  }catch(err){
    const status = safeShowBannerFromError(err);

    // IMPORTANT: do not throw — caller will fallback
    return { ok:false, data:null, error: err, status: status ?? null };
  }
}

/**
 * Optional helper: safe mutate
 */
export async function safeApolloMutate(client, req){
  if(!client || !req || !req.mutation){
    return { ok:false, data:null, error:'NO_CLIENT_OR_MUTATION', status:null };
  }
  try{
    const res = await client.mutate(req);
    if(res?.errors && res.errors.length){
      showApiBanner({
        state:'warn',
        title:'GraphQL warnings',
        message:'Mutate สำเร็จบางส่วน/มี error — โปรดตรวจสอบ',
        detail: res.errors.map(e=>e?.message).filter(Boolean).join(' | ') || '',
        onRetry: ()=>location.reload()
      });
    }else{
      hideApiBanner();
    }
    const data = res?.data ?? null;
    return { ok: !!data, data, error: (res?.errors || null), status:null };
  }catch(err){
    const status = safeShowBannerFromError(err);
    return { ok:false, data:null, error: err, status: status ?? null };
  }
}

/**
 * Tiny helper: call any promise and never throw (useful for non-apollo fetch too)
 */
export async function safeCall(fn, fallbackValue=null){
  try{
    const v = await fn();
    return { ok:true, value:v, error:null };
  }catch(err){
    safeShowBannerFromError(err);
    return { ok:false, value:fallbackValue, error:err };
  }
}