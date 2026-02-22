// === /fitness/js/rb-logger.js ===
// Rhythm Boxer logger (remote optional, local fallback always)
'use strict';

(function(){
  const WIN = window;

  const KEY_QUEUE = 'RB_LOG_QUEUE_V1';
  const KEY_LAST_ERR = 'RB_LOG_LAST_ERR';

  function qs(name, fallback=''){
    try{
      const u = new URL(location.href);
      const v = u.searchParams.get(name);
      return v == null || v === '' ? fallback : v;
    }catch(_){
      return fallback;
    }
  }

  function getApiBase(){
    // ใช้ query ?api=... ได้ ถ้าไม่ใส่ให้ว่าง (ไม่ยิง)
    return String(qs('api', '') || '').trim();
  }

  function shouldUseRemote(){
    const api = getApiBase();
    if(!api) return false;
    if(WIN.RB_REMOTE_GUARD && WIN.RB_REMOTE_GUARD.isRemoteDisabled && WIN.RB_REMOTE_GUARD.isRemoteDisabled()) {
      return false;
    }
    return true;
  }

  function loadQueue(){
    try{
      const raw = localStorage.getItem(KEY_QUEUE);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(_){
      return [];
    }
  }

  function saveQueue(arr){
    try{ localStorage.setItem(KEY_QUEUE, JSON.stringify(arr || [])); }catch(_){}
  }

  function pushQueue(item){
    const q = loadQueue();
    q.push(item);
    // กันบวมเกิน
    const MAX = 300;
    if(q.length > MAX) q.splice(0, q.length - MAX);
    saveQueue(q);
  }

  function setLastErr(msg){
    try{ localStorage.setItem(KEY_LAST_ERR, String(msg || '')); }catch(_){}
  }

  async function postJson(path, payload){
    const base = getApiBase();
    if(!base) throw new Error('no-api');
    const url = String(base).replace(/\/+$/,'') + '/' + String(path).replace(/^\/+/,'');
    let res;
    try{
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
        credentials: 'omit',
        keepalive: true
      });
    }catch(err){
      setLastErr('network:' + (err && err.message ? err.message : 'fetch-failed'));
      throw err;
    }

    if(!res.ok){
      const code = Number(res.status || 0);
      setLastErr('http:' + code);

      if((code === 401 || code === 403) && WIN.RB_REMOTE_GUARD && WIN.RB_REMOTE_GUARD.disableRemote){
        WIN.RB_REMOTE_GUARD.disableRemote(code, 'rb-logger-post');
      }
      throw new Error('http-' + code);
    }

    return res;
  }

  async function logSession(sessionRow){
    const payload = {
      kind: 'session',
      app: 'rhythm-boxer',
      ts: new Date().toISOString(),
      row: sessionRow || {}
    };

    // local fallback always
    pushQueue(payload);

    if(!shouldUseRemote()) return { ok:false, remote:false, queued:true };

    try{
      await postJson('/log/session', payload);
      return { ok:true, remote:true, queued:true };
    }catch(_){
      return { ok:false, remote:false, queued:true };
    }
  }

  async function logEvent(eventRow){
    const payload = {
      kind: 'event',
      app: 'rhythm-boxer',
      ts: new Date().toISOString(),
      row: eventRow || {}
    };

    // ลดโหลด: เก็บ local และจะเลือก remote เฉพาะบาง event ก็ได้
    pushQueue(payload);

    if(!shouldUseRemote()) return { ok:false, remote:false, queued:true };

    try{
      await postJson('/log/event', payload);
      return { ok:true, remote:true, queued:true };
    }catch(_){
      return { ok:false, remote:false, queued:true };
    }
  }

  async function flushQueue(limit = 30){
    if(!shouldUseRemote()) return { ok:false, reason:'remote-disabled' };

    const q = loadQueue();
    if(!q.length) return { ok:true, sent:0 };

    const remain = [];
    let sent = 0;

    for(let i=0; i<q.length; i++){
      const item = q[i];
      if(sent >= limit){
        remain.push(item);
        continue;
      }
      try{
        const path = item.kind === 'session' ? '/log/session' : '/log/event';
        await postJson(path, item);
        sent++;
      }catch(_){
        // ถ้ายิงไม่ผ่านให้เก็บที่เหลือไว้
        remain.push(item, ...q.slice(i+1));
        break;
      }
    }

    saveQueue(remain);
    return { ok:true, sent, remain: remain.length };
  }

  function getStatus(){
    const d = WIN.RB_REMOTE_GUARD && WIN.RB_REMOTE_GUARD.disabledInfo ? WIN.RB_REMOTE_GUARD.disabledInfo() : {disabled:false};
    return {
      api: getApiBase(),
      remoteEnabled: shouldUseRemote(),
      guard: d,
      queueSize: loadQueue().length
    };
  }

  WIN.RB_LOGGER = {
    logEvent,
    logSession,
    flushQueue,
    getStatus
  };
})();