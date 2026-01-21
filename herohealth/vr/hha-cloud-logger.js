// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened) — PATCH: dynamic gameMode
// ✅ Listens: hha:end -> sends session summary JSON
// ✅ Queue persist localStorage (offline-safe)
// ✅ keepalive + sendBeacon fallback
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_CLOUD_LOGGER__) return;
  WIN.__HHA_CLOUD_LOGGER__ = true;

  const qs = (k,d=null)=>{ try{return new URL(location.href).searchParams.get(k) ?? d;}catch{return d;} };

  const ENDPOINT = (qs('log','')||'').trim(); // ?log=...
  const LS_KEY = 'HHA_LOG_QUEUE_V1';

  function loadQ(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY) || '[]') || []; }catch(_){ return []; }
  }
  function saveQ(q){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(q.slice(-80))); }catch(_){}
  }

  let queue = loadQ();
  let flushing = false;

  function payloadBase(){
    return {
      timestampIso: new Date().toISOString(),
      href: location.href,
      ua: navigator.userAgent || '',
      projectTag: qs('projectTag','HeroHealth'),
    };
  }

  function enqueue(obj){
    queue.push(obj);
    saveQ(queue);
  }

  async function postJson(url, obj){
    try{
      const body = JSON.stringify(obj);
      if(navigator.sendBeacon){
        const ok = navigator.sendBeacon(url, new Blob([body], {type:'application/json'}));
        if(ok) return true;
      }
      const res = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body,
        keepalive:true,
        mode:'cors'
      });
      return !!res && res.ok;
    }catch(_){
      return false;
    }
  }

  async function flush(){
    if(flushing) return;
    if(!ENDPOINT) return;
    if(queue.length === 0) return;

    flushing = true;

    const q = queue.slice();
    let sent = 0;

    for(let i=0;i<q.length;i++){
      const ok = await postJson(ENDPOINT, q[i]);
      if(ok) sent++;
      else break;
    }

    if(sent > 0){
      queue = q.slice(sent);
      saveQ(queue);
    }

    flushing = false;
  }

  function onEnd(ev){
    try{
      const d = ev?.detail || {};

      // ✅ dynamic gameMode
      const gameMode =
        d.gameMode ||
        qs('gameMode','') ||
        qs('game','') ||
        qs('mode','') ||
        'unknown';

      const pack = Object.assign(payloadBase(), {
        kind: 'session',
        gameMode,
        runMode: d.runMode || qs('run','play'),
        diff: d.diff || qs('diff','normal'),
        device: d.device || qs('view',''),
        durationPlannedSec: Number(d.durationPlannedSec || qs('time','0')) || 0,
        durationPlayedSec: Number(d.durationPlayedSec || 0) || 0,
        scoreFinal: Number(d.scoreFinal || 0) || 0,
        misses: Number(d.misses || 0) || 0,
        grade: d.grade || '—',
        reason: d.reason || 'end',
        seed: d.seed || qs('seed','') || '',
        sessionId: d.sessionId || qs('sessionId','') || qs('studentKey','') || '',
        kids: !!d.kids
      });

      enqueue(pack);
      flush();
    }catch(_){}
  }

  WIN.HHA_LOGGER = { enabled: !!ENDPOINT };

  WIN.addEventListener('hha:end', onEnd, { passive:true });
  WIN.addEventListener('hha:flush', ()=>flush(), { passive:true });

  WIN.addEventListener('pagehide', ()=>flush(), { passive:true });
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flush();
  }, { passive:true });
  WIN.addEventListener('beforeunload', ()=>flush(), { passive:true });

  setInterval(()=>flush(), 3500);
})();