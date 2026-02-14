// === /herohealth/api/apolloClient.safe.js ===
// Safe Apollo wrapper (403-safe + degrade gracefully)
// ✅ If Apollo not available -> returns stub client that never throws hard
// ✅ If network 403 -> surfaces status via HHA_API_STATUS and resolves to {data:null, errors:[...]}

'use strict';

function getGlobalApollo(){
  // You might have Apollo on window (bundled) e.g. window.apolloClient or window.Apollo
  // Keep it loose.
  const W = window;
  return {
    ApolloClient: W?.ApolloClient || W?.apolloClient || W?.Apollo?.ApolloClient,
    InMemoryCache: W?.InMemoryCache || W?.Apollo?.InMemoryCache,
    HttpLink: W?.HttpLink || W?.Apollo?.HttpLink,
    ApolloLink: W?.ApolloLink || W?.Apollo?.ApolloLink,
    from: W?.from || W?.Apollo?.from,
    gql: W?.gql || W?.Apollo?.gql
  };
}

function makeStubClient(reason='offline'){
  const errObj = { message:`API disabled (${reason})`, code:reason };

  const stub = {
    __stub: true,
    reason,
    query: async ()=>({ data:null, errors:[errObj] }),
    mutate: async ()=>({ data:null, errors:[errObj] }),
    subscribe: ()=>({ unsubscribe(){}, closed:true }),
    clearStore: async ()=>true,
    resetStore: async ()=>true
  };
  return stub;
}

// Basic fetch wrapper that returns JSON or throws with status
async function safePostJSON(url, body, headers={}){
  const res = await fetch(url, {
    method:'POST',
    mode:'cors',
    headers: Object.assign({ 'content-type':'application/json' }, headers||{}),
    body: JSON.stringify(body||{})
  });
  const txt = await res.text().catch(()=> '');
  let json = null;
  try{ json = txt ? JSON.parse(txt) : null; }catch{ json = null; }

  if(!res.ok){
    const e = new Error(`HTTP ${res.status}`);
    e.status = res.status;
    e.bodyText = txt;
    e.bodyJson = json;
    throw e;
  }
  return json;
}

/**
 * createSafeClient({ endpoint, onStatus })
 * - endpoint: GraphQL endpoint
 * - onStatus: function({state, title, msg}) optional
 */
export function createSafeClient(opts={}){
  const endpoint = String(opts.endpoint || '').trim();
  const onStatus = (typeof opts.onStatus === 'function') ? opts.onStatus : null;

  if(!endpoint){
    onStatus?.({ state:'bad', title:'API ไม่ได้ตั้งค่า', msg:'ไม่มี endpoint • ใช้โหมดออฟไลน์' });
    return makeStubClient('no-endpoint');
  }

  // If Apollo libs exist, you can build real client; if not, fallback to lightweight client.
  const A = getGlobalApollo();

  // Lightweight "client" compatible subset (query/mutate) without Apollo dependency.
  // This is safest for GitHub Pages + 403 scenarios.
  const lightClient = {
    __light: true,
    endpoint,
    query: async ({ query, variables })=>{
      try{
        const payload = {
          query: String(query?.loc?.source?.body || query || ''),
          variables: variables || {}
        };
        const out = await safePostJSON(endpoint, payload);
        onStatus?.({ state:'ok', title:'ออนไลน์ ✅', msg:'API ตอบกลับปกติ' });
        return out || { data:null };
      }catch(e){
        const st = Number(e?.status || 0);
        if(st === 403){
          onStatus?.({ state:'bad', title:'403 Forbidden ⚠️', msg:'API ปฏิเสธสิทธิ์/Origin • หน้าไม่พัง' });
          return { data:null, errors:[{ message:'403 Forbidden', code:'403' }] };
        }
        onStatus?.({ state:'warn', title:'API มีปัญหา', msg:`ยิง API ไม่สำเร็จ (${st||'network'}) • หน้าไม่พัง` });
        return { data:null, errors:[{ message:String(e?.message||'network error'), code:String(st||'network') }] };
      }
    },
    mutate: async ({ mutation, variables })=>{
      // same as query
      return lightClient.query({ query: mutation, variables });
    }
  };

  // Prefer lightClient always (less fragile) unless user explicitly wants Apollo.
  if(opts.preferApollo !== true){
    return lightClient;
  }

  // Try real Apollo (best-effort); if anything fails, return light client.
  try{
    if(!A.ApolloClient || !A.InMemoryCache || !A.HttpLink){
      return lightClient;
    }

    const link = new A.HttpLink({
      uri: endpoint,
      fetch: async (uri, options)=>{
        try{
          const res = await fetch(uri, options);
          if(res.status === 403){
            onStatus?.({ state:'bad', title:'403 Forbidden ⚠️', msg:'API ปฏิเสธสิทธิ์/Origin • หน้าไม่พัง' });
          }
          return res;
        }catch(e){
          onStatus?.({ state:'bad', title:'ออฟไลน์/เชื่อมต่อไม่ได้', msg:'เครือข่าย/ CORS • หน้าไม่พัง' });
          throw e;
        }
      }
    });

    const client = new A.ApolloClient({
      link,
      cache: new A.InMemoryCache(),
      defaultOptions: {
        watchQuery: { fetchPolicy:'network-only', errorPolicy:'all' },
        query: { fetchPolicy:'network-only', errorPolicy:'all' },
        mutate: { errorPolicy:'all' }
      }
    });

    return client;
  }catch(_){
    return lightClient;
  }
}