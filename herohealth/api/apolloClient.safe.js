// === /herohealth/api/apolloClient.safe.js ===
// Apollo Client SAFE wrapper (403-safe, no retry flood, offline-friendly)
// Exposes: window.HHA_API (client/query/mutate/enabled/disableInfo)

'use strict';

import { isRemoteDisabled, disableRemote, disabledInfo } from './api-status.js';

// Optional: prevent red error floods from unhandled Apollo promises
(function installUnhandledGuard(){
  if(window.__HHA_APOLLO_GUARD__) return;
  window.__HHA_APOLLO_GUARD__ = 1;

  window.addEventListener('unhandledrejection', (ev)=>{
    const msg = String(ev?.reason?.message || ev?.reason || '');
    // swallow known Apollo 403 noise
    if(msg.includes('Received status code 403') || msg.includes('status code 401') || msg.includes('ApolloError')){
      ev.preventDefault?.();
    }
  });
})();

function hasApollo(){
  return !!(window.ApolloClient && window.ApolloClient.ApolloClient);
}

function safeErrCode(err){
  const ne = err?.networkError || err?.cause || err;
  const sc = ne?.statusCode || ne?.status || ne?.response?.status || 0;
  return Number(sc||0)||0;
}

function createClient({ uri }){
  // If Apollo is not available (or blocked), just return null
  if(!hasApollo()) return null;

  const { ApolloClient, InMemoryCache, HttpLink, from } = window.ApolloClient;

  // Some builds also expose onError in ApolloLinkError
  const onErrorFn =
    window.ApolloClient?.onError ||
    window.ApolloLinkError?.onError ||
    null;

  const httpLink = new HttpLink({
    uri,
    fetch: (u, opt)=> fetch(u, opt),
  });

  const links = [];

  if(typeof onErrorFn === 'function'){
    links.push(onErrorFn(({ networkError })=>{
      const status = Number(networkError?.statusCode || networkError?.status || 0) || 0;
      if(status === 401 || status === 403){
        // Hard-disable remote for this session to stop retries
        disableRemote(status, 'forbidden');
      }
    }));
  }

  links.push(httpLink);

  const link = (typeof from === 'function') ? from(links) : httpLink;

  return new ApolloClient({
    link,
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { fetchPolicy: 'no-cache', errorPolicy:'all' },
      watchQuery: { fetchPolicy: 'no-cache', errorPolicy:'all' },
      mutate: { errorPolicy:'all' }
    }
  });
}

async function safeQuery(client, args){
  if(isRemoteDisabled()) return { data:null, error:{ code:403, message:'remote_disabled' } };
  if(!client) return { data:null, error:{ code:0, message:'apollo_missing' } };

  try{
    const r = await client.query(args);
    return { data: r?.data ?? null, error: null };
  }catch(err){
    const code = safeErrCode(err);

    if(code === 401 || code === 403){
      disableRemote(code, 'forbidden');
      // swallow: return controlled error
      return { data:null, error:{ code, message:'forbidden' } };
    }
    return { data:null, error:{ code, message: String(err?.message || err || 'query_failed') } };
  }
}

async function safeMutate(client, args){
  if(isRemoteDisabled()) return { data:null, error:{ code:403, message:'remote_disabled' } };
  if(!client) return { data:null, error:{ code:0, message:'apollo_missing' } };

  try{
    const r = await client.mutate(args);
    return { data: r?.data ?? null, error: null };
  }catch(err){
    const code = safeErrCode(err);

    if(code === 401 || code === 403){
      disableRemote(code, 'forbidden');
      return { data:null, error:{ code, message:'forbidden' } };
    }
    return { data:null, error:{ code, message: String(err?.message || err || 'mutate_failed') } };
  }
}

export function initApolloSafe({ uri }){
  // create once
  if(window.HHA_API && window.HHA_API.__inited) return window.HHA_API;

  const client = createClient({ uri });

  window.HHA_API = {
    __inited: true,
    uri: String(uri||''),
    client,
    enabled: ()=> !isRemoteDisabled() && !!client,
    disableInfo: ()=> disabledInfo(),
    query: (args)=> safeQuery(client, args),
    mutate: (args)=> safeMutate(client, args),
  };

  return window.HHA_API;
}
