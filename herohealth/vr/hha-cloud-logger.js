// === /herohealth/vr/hha-cloud-logger.js ===
// Minimal Cloud Logger (SAFE)
// ✅ If no endpoint -> NOOP (ไม่ทำให้เกมพัง)
// ✅ logEvent(type,data) queue
// ✅ flush({reason}) best effort
(function (root) {
  'use strict';

  const S = {
    endpoint: '',
    queue: [],
    maxQueue: 500
  };

  function setEndpoint(url){
    S.endpoint = String(url||'').trim();
  }

  function getEndpoint(){
    // allow override via global or query param
    try{
      const u = new URL(root.location.href);
      const q = u.searchParams.get('log');
      if (q) return String(q);
    }catch(_){}
    return S.endpoint || root.HHA_LOG_ENDPOINT || '';
  }

  function push(row){
    if (S.queue.length >= S.maxQueue) S.queue.shift();
    S.queue.push(row);
  }

  function logEvent(type, data){
    push({
      kind: 'event',
      type: String(type||'event'),
      data: data || {},
      ts: Date.now(),
      iso: new Date().toISOString()
    });
  }

  async function flush(meta){
    const endpoint = String(getEndpoint()||'').trim();
    if (!endpoint) return false;
    if (S.queue.length === 0) return true;

    const payload = {
      meta: meta || {},
      batch: S.queue.splice(0, S.queue.length)
    };

    // try sendBeacon first
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(endpoint, new Blob([JSON.stringify(payload)], { type:'application/json' }));
        if (ok) return true;
      }
    }catch(_){}

    // fallback fetch
    try{
      const res = await fetch(endpoint, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
      return !!res && res.ok;
    }catch(_){
      // if fail, re-queue (best effort)
      try{
        const back = (payload.batch || []);
        for (let i=0;i<back.length;i++) push(back[i]);
      }catch(_){}
      return false;
    }
  }

  const api = { setEndpoint, logEvent, flush };

  root.HHA_CLOUD_LOGGER = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.CloudLogger = api;
})(typeof window !== 'undefined' ? window : globalThis);