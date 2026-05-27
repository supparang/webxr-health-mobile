/*
  CSAI2102 AI Quest Cloud Logger
  Version: v1.6
  Sends data to Google Apps Script Web App with local fallback.
*/
(function(){
  'use strict';
  const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbwVkL4eyQM_dq83Asjw6PfkgjG2WxVGgJQ_lCaAtoGhwBcylguZkWZvu7UUwrNR4Np9/exec';

  function storage(){ return window.AIQuestStorage; }
  function getApiUrl(){
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get('api') || params.get('log');
    if(fromUrl && fromUrl.startsWith('https://')){ storage().saveConfig({apiUrl:fromUrl, cloudEnabled:true}); return fromUrl; }
    const cfg = storage().getConfig();
    if(cfg.apiUrl) return cfg.apiUrl;
    return DEFAULT_API_URL;
  }
  function isCloudReady(){
    const api = getApiUrl();
    const cfg = storage().getConfig();
    return !!(cfg.cloudEnabled !== false && api && api.startsWith('https://') && !api.includes('PASTE_'));
  }
  async function post(payload){
    if(!storage()) throw new Error('AIQuestStorage missing');
    const api = getApiUrl();
    if(!isCloudReady()){ storage().addPending(payload); return {ok:false, queued:true, reason:'cloud_not_configured'}; }
    try{
      const res = await fetch(api, {method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload)});
      return {ok:true, opaque:res && res.type === 'opaque'};
    }catch(error){
      storage().addPending(payload);
      return {ok:false, queued:true, error:String(error && error.message || error)};
    }
  }
  async function sendProfile(profile){ return post({type:'profile', profile:{...profile, userAgent:navigator.userAgent, pageUrl:location.href}}); }
  async function sendAttempt(attempt, events){ return post({type:'attempt', attempt, events:Array.isArray(events) ? events : []}); }
  async function sendEvent(event){ return post({type:'event', event}); }
  async function flushPending(limit=25){
    if(!storage()) return {ok:false, reason:'storage_missing'};
    if(!isCloudReady()) return {ok:false, reason:'cloud_not_configured'};
    const queue = storage().getPending();
    if(!queue.length) return {ok:true, sent:0, left:0};
    const remain = [];
    let sent = 0;
    for(const item of queue){
      if(sent >= limit){ remain.push(item); continue; }
      try{
        const api = getApiUrl();
        await fetch(api, {method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(item.payload)});
        sent++;
      }catch(error){
        remain.push({...item, retryCount:(item.retryCount || 0) + 1, lastError:String(error && error.message || error), lastRetryAt:new Date().toISOString()});
      }
    }
    storage().setPending(remain);
    return {ok:true, sent, left:remain.length};
  }
  async function healthCheck(){
    const api = getApiUrl();
    if(!isCloudReady()) return {ok:false, reason:'cloud_not_configured'};
    try{
      await fetch(api + (api.includes('?') ? '&' : '?') + 'action=health', {method:'GET', mode:'no-cors'});
      return {ok:true, opaque:true, message:'Cloud endpoint reachable'};
    }catch(error){ return {ok:false, error:String(error && error.message || error)}; }
  }
  window.AIQuestCloudLogger = {getApiUrl,isCloudReady,sendProfile,sendAttempt,sendEvent,flushPending,healthCheck};
  window.addEventListener('online', () => { flushPending().catch(()=>{}); });
  setTimeout(() => { flushPending().catch(()=>{}); }, 1500);
})();
