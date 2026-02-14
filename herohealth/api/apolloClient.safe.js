// === /herohealth/api/apolloClient.safe.js ===
// Apollo Client SAFE — 403-safe + offline fallback
// ✅ GraphQL request ที่โดน 403/Network จะไม่ทำให้ทั้งเว็บพัง
// ✅ ส่งสถานะไปที่ window.HHA_API_STATUS (api-status.js) ถ้ามี
// ✅ Retry แบบนิ่ม ๆ (เฉพาะ network error ที่ควรลองใหม่)
// Usage:
//   import { getApolloClient } from './apolloClient.safe.js';
//   const client = getApolloClient({ endpoint: 'https://.../graphql' });
//   client.query(...)

'use strict';

import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  from,
} from 'https://cdn.skypack.dev/@apollo/client/core@3.10.8';

import { onError } from 'https://cdn.skypack.dev/@apollo/client/link/error@3.10.8';

const WIN = window;

function safeCall(fn, ...args){
  try { return fn?.(...args); } catch { return undefined; }
}

// ---- Status bridge (optional) ----
function setApiStatus(state){
  // state: { level:'ok'|'warn'|'bad', title, msg, detail?, endpoint?, ts? }
  try{
    if(WIN.HHA_API_STATUS && typeof WIN.HHA_API_STATUS.set === 'function'){
      WIN.HHA_API_STATUS.set(state);
    }else{
      // fallback event for anyone listening
      WIN.dispatchEvent(new CustomEvent('hha:api-status', { detail: state }));
    }
  }catch(_){}
}

function normUrl(url){
  try { return String(url || '').trim(); } catch { return ''; }
}

function isProbablyGraphQLEndpoint(url){
  const u = normUrl(url);
  if(!u) return false;
  // allow root too (some setups put graphql at root)
  return true;
}

// ---- Gentle retry link (network errors only) ----
function makeRetryLink({ maxRetries=1, baseDelayMs=250 } = {}){
  // Very small retry to smooth transient issues.
  return new (class RetryLink {
    request(operation, forward){
      let count = 0;

      return new Observable((observer)=>{
        const sub = { current:null };
        const attempt = ()=>{
          count++;
          sub.current = forward(operation).subscribe({
            next: (v)=> observer.next(v),
            error: (err)=>{
              const isNetwork = !!err?.networkError;
              const status = err?.networkError?.statusCode || err?.networkError?.status || 0;

              // Retry only when it makes sense:
              // - fetch failed / network down (no status)
              // - 502/503/504 transient
              const retryable =
                isNetwork && (
                  !status ||
                  status === 502 || status === 503 || status === 504
                );

              if(retryable && count <= maxRetries){
                const delay = baseDelayMs * count;
                setTimeout(attempt, delay);
                return;
              }
              observer.error(err);
            },
            complete: ()=> observer.complete()
          });
        };

        attempt();
        return ()=> { try { sub.current?.unsubscribe?.(); } catch(_){} };
      });
    }
  })();
}

// Apollo Observable polyfill (skypack sometimes requires it)
class Observable {
  constructor(subscribe){ this._subscribe = subscribe; }
  subscribe(observer){ return this._subscribe(observer); }
}

// ---- Main factory ----
let _client = null;
let _lastEndpoint = '';

export function getApolloClient(opts = {}){
  const endpoint = normUrl(opts.endpoint || WIN.HHA_API_ENDPOINT || '');
  const headers = opts.headers || {};

  if(!endpoint || !isProbablyGraphQLEndpoint(endpoint)){
    // no endpoint => return a tiny stub that never crashes
    setApiStatus({
      level:'warn',
      title:'ยังไม่ได้ตั้งค่า API',
      msg:'ไม่ได้กำหนด endpoint (Hub/เกมยังเล่นได้ปกติ)',
      detail:'ตั้งค่า WIN.HHA_API_ENDPOINT หรือส่ง opts.endpoint ตอนเรียก getApolloClient()',
      endpoint,
      ts: Date.now()
    });
    return makeStubClient('NO_ENDPOINT');
  }

  if(_client && _lastEndpoint === endpoint) return _client;
  _lastEndpoint = endpoint;

  // ---- HttpLink ----
  const httpLink = new HttpLink({
    uri: endpoint,
    fetch: (url, init)=>{
      // add default headers
      const h = new Headers(init?.headers || {});
      try{
        for(const k of Object.keys(headers)) h.set(k, String(headers[k]));
      }catch(_){}
      // Force JSON
      if(!h.get('content-type')) h.set('content-type', 'application/json');
      // Optional: attach origin hint (some gateways check)
      // h.set('x-client', 'herohealth');

      return fetch(url, { ...init, headers: h });
    }
  });

  // ---- Error link: convert errors to status; avoid breaking app ----
  const errorLink = onError(({ graphQLErrors, networkError, operation })=>{
    const opName = operation?.operationName || 'anonymous';
    const ne = networkError || null;
    const status = ne?.statusCode || ne?.status || 0;
    const msg = ne?.message || '';

    if(status === 403){
      setApiStatus({
        level:'bad',
        title:'403 Forbidden ⚠️',
        msg:'API ปฏิเสธสิทธิ์/Origin (แต่หน้าเว็บไม่พังแล้ว)',
        detail:`endpoint: ${endpoint}\noperation: ${opName}\nstatus: 403\nhint: ตรวจ CORS/Authorizer/IAM + allow Origin: https://supparang.github.io`,
        endpoint,
        ts: Date.now()
      });
      return;
    }

    if(ne){
      // network error (offline, CORS blocked, dns, etc.)
      setApiStatus({
        level:'bad',
        title:'เชื่อมต่อ API ไม่ได้',
        msg:'เข้าโหมดออฟไลน์ชั่วคราว (Hub/เกมยังเล่นได้)',
        detail:`endpoint: ${endpoint}\noperation: ${opName}\nstatus: ${status || 'n/a'}\n${msg || ''}`.trim(),
        endpoint,
        ts: Date.now()
      });
      return;
    }

    if(Array.isArray(graphQLErrors) && graphQLErrors.length){
      // GraphQL-level errors (still got 200)
      const lines = graphQLErrors.slice(0,3).map(e=>`- ${e?.message || 'GraphQL error'}`).join('\n');
      setApiStatus({
        level:'warn',
        title:'GraphQL error',
        msg:'API ตอบกลับแต่มี error บางอย่าง (UI จะพยายามทำงานต่อ)',
        detail:`endpoint: ${endpoint}\noperation: ${opName}\n${lines}`,
        endpoint,
        ts: Date.now()
      });
    }
  });

  // ---- Gentle retry link (only for transient) ----
  const retryLink = makeRetryLink({ maxRetries: 1, baseDelayMs: 220 });

  // ---- Client ----
  _client = new ApolloClient({
    link: from([ errorLink, retryLink, httpLink ]),
    cache: new InMemoryCache(),
    connectToDevTools: false,
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network', errorPolicy: 'all' },
      query:      { fetchPolicy: 'network-only',     errorPolicy: 'all' },
      mutate:     { errorPolicy: 'all' }
    }
  });

  // optimistic "online" (we'll update if request fails)
  setApiStatus({
    level:'warn',
    title:'API พร้อมใช้งาน (ยังไม่ตรวจ)',
    msg:'ถ้า 403/ล่ม จะสลับไปโหมดออฟไลน์อัตโนมัติ',
    detail:`endpoint: ${endpoint}`,
    endpoint,
    ts: Date.now()
  });

  return _client;
}

// ---- Stub client ----
function makeStubClient(reason){
  const fail = async ()=> {
    const err = new Error(`Apollo stub: ${reason}`);
    // mimic apollo error shape
    err.networkError = { statusCode: 0, message: reason };
    throw err;
  };
  return {
    query: fail,
    mutate: fail,
    subscribe: fail,
    resetStore: async ()=>{},
    clearStore: async ()=>{},
    readQuery: ()=>null,
    writeQuery: ()=>{}
  };
}