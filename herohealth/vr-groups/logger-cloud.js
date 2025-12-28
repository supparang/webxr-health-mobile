/* === /herohealth/vr-groups/logger-cloud.js ===
Cloud Logger (batch) + flush hardened
- endpoint from ?log= or localStorage.HHA_LOG_ENDPOINT
- queues to localStorage on failure
- flush on end / visibilitychange / beforeunload
*/

(function(root){
  'use strict';
  const DOC = document;

  function qs(k){
    try{ return new URLSearchParams(location.search).get(k); }catch{ return null; }
  }

  const KEY_Q = 'HHA_LOG_QUEUE_GROUPS';
  const endpoint =
    (qs('log')||'').trim() ||
    (localStorage.getItem('HHA_LOG_ENDPOINT')||'').trim();

  const logger = {
    endpoint,
    queue: [],
    busy:false,

    load(){
      try{
        const raw = localStorage.getItem(KEY_Q);
        if (raw){
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) this.queue = arr.concat(this.queue);
        }
      }catch{}
    },
    save(){
      try{ localStorage.setItem(KEY_Q, JSON.stringify(this.queue.slice(-300))); }catch{}
    },
    push(payload){
      if (!payload) return;
      this.queue.push(payload);
      this.save();
    },
    async flush(){
      if (this.busy) return;
      if (!this.endpoint) return;
      if (!this.queue.length) return;

      this.busy = true;
      const batch = this.queue.slice(0, 40);
      try{
        const res = await fetch(this.endpoint, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ rows: batch })
        });
        if (!res.ok) throw new Error('HTTP '+res.status);
        // success: drop sent
        this.queue = this.queue.slice(batch.length);
        this.save();
      }catch(e){
        // keep queue
      }finally{
        this.busy = false;
      }
    }
  };

  logger.load();

  root.HHACloudLogger = logger;

  // auto flush on end
  root.addEventListener('hha:end', ()=>{ try{ logger.flush(); }catch{} });

  DOC.addEventListener('visibilitychange', ()=>{
    if (DOC.visibilityState === 'hidden'){
      try{ logger.flush(); }catch{}
    }
  });
  root.addEventListener('beforeunload', ()=>{
    try{ logger.flush(); }catch{}
  });

})(typeof window !== 'undefined' ? window : globalThis);