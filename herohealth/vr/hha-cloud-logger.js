// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened) — LATEST
// ✅ Listens: hha:end -> sends session summary JSON
// ✅ Queue persist localStorage (offline-safe)
// ✅ keepalive + sendBeacon fallback
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload
// ✅ FIX: gameMode NOT hardcoded (use ev.detail.gameMode) + infer fallback
// ✅ Adds: window.HHA_LOGGER = { enabled, endpoint, flush }  (so engine can avoid duplicate send)

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
    try{ localStorage.setItem(LS_KEY, JSON.stringify(q.slice(-120))); }catch(_){}
  }

  let queue = loadQ();
  let flushing = false;

  function payloadBase(){
    return {
      timestampIso: new Date().toISOString(),
      href: location.href,
      ua: navigator.userAgent || '',
      projectTag: qs('projectTag','HeroHealth'),
      kind: 'session'
    };
  }

  function inferGameMode(){
    try{
      const p = (location.pathname || '').toLowerCase();
      if (p.includes('hydration')) return 'hydration';
      if (p.includes('plate')) return 'plate';
      if (p.includes('groups')) return 'groups';
      if (p.includes('goodjunk')) return 'goodjunk';
    }catch(_){}
    return (qs('gameMode','')||qs('game','')||'').toLowerCase() || 'unknown';
  }

  function enqueue(obj){
    queue.push(obj);
    saveQ(queue);
  }

  async function postJson(url, obj){
    try{
      const body = JSON.stringify(obj);

      // sendBeacon (ดีที่สุดตอน unload)
      if (navigator.sendBeacon){
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
    if(!ENDPOINT) return;         // no endpoint => do nothing
    if(queue.length === 0) return;

    flushing = true;

    // oldest-first
    const q = queue.slice();
    let sent = 0;

    for(let i=0;i<q.length;i++){
      const ok = await postJson(ENDPOINT, q[i]);
      if(ok) sent++;
      else break; // stop if offline
    }

    if(sent > 0){
      queue = q.slice(sent);
      saveQ(queue);
    }

    flushing = false;
  }

  // expose for engines to detect + avoid duplicate send
  WIN.HHA_LOGGER = {
    enabled: !!ENDPOINT,
    endpoint: ENDPOINT,
    flush
  };

  // Listen end summary
  function onEnd(ev){
    try{
      const d = ev?.detail || {};

      // IMPORTANT: use summary fields directly (don’t overwrite gameMode)
      const gameMode = (d.gameMode || d.game || qs('gameMode','') || inferGameMode() || 'unknown');

      const pack = Object.assign(payloadBase(), {
        // routing/meta
        gameMode,
        runMode: d.runMode || qs('run','play'),
        diff: d.diff || qs('diff','normal'),
        device: d.device || qs('view',''),

        // identity / research
        sessionId: d.sessionId || qs('sessionId', qs('studentKey','')) || '',
        seed: d.seed || qs('seed','') || '',
        ts: d.ts || qs('ts','') || '',

        // core results (safe numbers)
        durationPlannedSec: Number(d.durationPlannedSec || qs('time','0')) || 0,
        durationPlayedSec: Number(d.durationPlayedSec || 0) || 0,
        scoreFinal: Number(d.scoreFinal || 0) || 0,
        misses: Number(d.misses || 0) || 0,
        grade: d.grade || '—',
        reason: d.reason || 'end',

        // keep the full original summary too (so you don’t lose fields)
        summary: d
      });

      enqueue(pack);
      flush(); // best-effort immediate
    }catch(_){}
  }

  WIN.addEventListener('hha:end', onEnd, { passive:true });

  // Manual flush hook
  WIN.addEventListener('hha:flush', ()=>flush(), { passive:true });

  // unload flush
  WIN.addEventListener('pagehide', ()=>flush(), { passive:true });
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flush();
  }, { passive:true });
  WIN.addEventListener('beforeunload', ()=>flush(), { passive:true });

  // periodic flush (offline -> online)
  setInterval(()=>flush(), 3500);

})();