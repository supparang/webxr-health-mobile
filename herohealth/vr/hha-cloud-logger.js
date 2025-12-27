// === /herohealth/vr/hha-cloud-logger.js ===
// HeroHealth — Cloud Logger (Google Apps Script Web App)
// Usage: add ?log=<WEB_APP_EXEC_URL>
// Listens:
//  - hha:log_session
//  - hha:log_event
//  - hha:end
// Uses sendBeacon then fetch fallback

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  function getEndpoint(){
    try{
      const u = new URL(location.href);
      const ep = u.searchParams.get('log');
      return ep ? String(ep) : null;
    }catch(_){ return null; }
  }

  const ENDPOINT = getEndpoint();
  const Q = [];
  let flushing = false;

  function post(payload){
    if (!ENDPOINT) return;

    const body = JSON.stringify(payload);
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
        if (ok) return true;
      }
    }catch(_){}
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).then(()=>true).catch(()=>false);
  }

  function enqueue(type, detail){
    if (!ENDPOINT) return;
    Q.push({ type, detail, ts: Date.now() });
    flushSoon();
  }

  function flushSoon(){
    if (flushing) return;
    flushing = true;
    setTimeout(async () => {
      try{
        while(Q.length){
          const item = Q.shift();
          await post(item.detail);
        }
      } finally {
        flushing = false;
      }
    }, 120);
  }

  function flushNow(){
    if (!ENDPOINT) return Promise.resolve();
    return (async () => {
      while(Q.length){
        const item = Q.shift();
        await post(item.detail);
      }
    })();
  }

  root.addEventListener('hha:log_session', (e) => enqueue('session', e.detail || {}));
  root.addEventListener('hha:log_event', (e) => enqueue('event', e.detail || {}));
  root.addEventListener('hha:end', (e) => enqueue('end', e.detail || {}));

  root.HHACloudLogger = { flushNow };
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.HHACloudLogger = root.HHACloudLogger;

})(window);