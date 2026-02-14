// === /herohealth/api/apolloClient.safe.js ===
// Apollo client wrapper that will NEVER hard-crash UI on 403/CORS/offline.
// - On 403: marks offline-like state and resolves with graceful error
// - Optional banner integration via api-status.js

'use strict';

import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';

import { setBanner, probeAPI } from './api-status.js';

function safeStr(x){ try{ return String(x ?? ''); }catch{ return ''; } }

export function buildEndpointFromQS(defaultUrl){
  try{
    const u = new URL(location.href);
    const e = u.searchParams.get('api') || '';
    if(e) return e;
  }catch(_){}
  return defaultUrl;
}

export function makeApolloClientSafe({
  endpoint,
  banner = { enabled:true },
  probe = { enabled:true, payload:{ ping:true }, timeoutMs:3200 },
  headers = {}
}){
  const ep = endpoint;

  // --------- banner helpers (safe even if DOM missing) ----------
  const B = {
    enabled: !!banner?.enabled,
    set(state, title, msg){
      if(!B.enabled) return;
      try{ setBanner({}, state, title, msg); }catch(_){}
    }
  };

  let netState = {
    ok: null,
    lastStatus: 0,
    lastAt: 0
  };

  async function doProbe(){
    if(!probe?.enabled) return;
    B.set('warn', 'กำลังตรวจสอบระบบ…', 'กำลัง ping API แบบสั้น ๆ (ถ้า 403 จะใช้โหมดออฟไลน์)');
    const r = await probeAPI(ep, probe?.payload || { ping:true }, probe?.timeoutMs || 3200);
    netState.ok = !!(r.ok && r.status === 200);
    netState.lastStatus = r.status|0;
    netState.lastAt = Date.now();

    if(r.status === 200){
      B.set('ok', 'ออนไลน์ ✅', 'API ตอบกลับปกติ');
    }else if(r.status === 403){
      B.set('bad', '403 Forbidden ⚠️', 'API ปฏิเสธสิทธิ์/Origin — UI ยังใช้งานได้ (แนะนำแก้ CORS/Authorizer)');
    }else if(r.status){
      B.set('warn', `API ตอบ ${r.status}`, 'UI ยังใช้งานได้ • ถ้าต้องใช้ API ให้ตรวจ route/headers');
    }else{
      B.set('bad', 'ออฟไลน์/เชื่อมต่อไม่ได้', 'UI ยังใช้งานได้ • ถ้าต้องใช้ API ให้ตรวจเครือข่าย/CORS');
    }
  }

  // --------- Apollo links ----------
  const httpLink = new HttpLink({
    uri: ep,
    fetch,
    headers
  });

  const errorLink = onError(({ networkError, graphQLErrors }) => {
    // Network errors: CORS, offline, 403, etc.
    const ne = networkError || null;
    const msg = safeStr(ne?.message || '');
    const status = Number(ne?.statusCode || ne?.status || 0) || 0;

    if(status === 403 || /403/.test(msg)){
      netState.ok = false;
      netState.lastStatus = 403;
      netState.lastAt = Date.now();
      B.set('bad', '403 Forbidden ⚠️', 'API ปฏิเสธสิทธิ์/Origin — ระบบจะทำงานแบบออฟไลน์ (เข้าเกมได้ปกติ)');
      return;
    }

    if(status === 0 || /Failed to fetch|NetworkError|CORS/i.test(msg)){
      netState.ok = false;
      netState.lastStatus = 0;
      netState.lastAt = Date.now();
      B.set('bad', 'ออฟไลน์/เชื่อมต่อไม่ได้', 'ไม่สามารถเรียก API ได้ — UI ยังใช้งานได้');
      return;
    }

    if(status){
      netState.ok = false;
      netState.lastStatus = status;
      netState.lastAt = Date.now();
      B.set('warn', `API ตอบ ${status}`, 'UI ยังใช้งานได้ • ตรวจสอบ endpoint/headers');
      return;
    }

    // GraphQL errors (still online)
    if(graphQLErrors && graphQLErrors.length){
      B.set('warn', 'GraphQL error', 'มีข้อผิดพลาดจาก GraphQL แต่ UI ไม่พัง');
    }
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: from([errorLink, httpLink]),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-first', errorPolicy: 'all' },
      query:      { fetchPolicy: 'network-only', errorPolicy: 'all' },
      mutate:     { errorPolicy: 'all' }
    }
  });

  // --------- safe wrappers ----------
  async function safeQuery(q){
    try{
      return await client.query(q);
    }catch(e){
      // never throw to UI
      return { data:null, errors:[{ message: safeStr(e?.message || e || 'query failed') }] };
    }
  }

  async function safeMutate(m){
    try{
      return await client.mutate(m);
    }catch(e){
      return { data:null, errors:[{ message: safeStr(e?.message || e || 'mutate failed') }] };
    }
  }

  return {
    client,
    safeQuery,
    safeMutate,
    probe: doProbe,
    getNetState: ()=>({ ...netState })
  };
}