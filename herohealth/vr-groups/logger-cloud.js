/* === /herohealth/vr-groups/logger-cloud.js ===
HHACloudLogger (minimal, hardened)
- log(type,payload)
- flush()
- auto flush on visibilitychange/pagehide/beforeunload
*/

(function(root){
  'use strict';

  const ENDPOINT =
    (root.HHA_LOGGER_ENDPOINT || '') // ตั้งจากที่อื่นได้
    || ''; // ใส่ URL ของคุณถ้าต้องการ

  const Q = [];
  let flushing = false;

  function post(data){
    if (!ENDPOINT) return Promise.resolve({ skipped:true });
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(data),
      keepalive: true
    }).catch(()=>({ ok:false }));
  }

  const api = {
    endpoint: ENDPOINT,
    log(type, payload){
      const pack = {
        type: String(type || 'log'),
        ts: new Date().toISOString(),
        payload: payload || {}
      };
      Q.push(pack);
    },
    async flush(){
      if (!ENDPOINT) return;
      if (flushing) return;
      if (!Q.length) return;
      flushing = true;

      // send in small batches
      try{
        while(Q.length){
          const batch = Q.splice(0, 10);
          await post({ batch });
        }
      } finally {
        flushing = false;
      }
    }
  };

  // expose
  root.HHACloudLogger = root.HHACloudLogger || api;

  // hardened flush
  function hardFlush(){
    try{ root.HHACloudLogger.flush(); }catch{}
  }
  root.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'hidden') hardFlush();
  });
  root.addEventListener('pagehide', hardFlush);
  root.addEventListener('beforeunload', hardFlush);

})(typeof window !== 'undefined' ? window : globalThis);