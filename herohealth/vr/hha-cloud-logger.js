// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION v2 (universal, flush-hardened)
// ✅ Listens: hha:end (session summary) + optional hha:event (telemetry)
// ✅ Queue persist localStorage (offline-safe)
// ✅ keepalive + sendBeacon fallback
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_CLOUD_LOGGER_V2__) return;
  WIN.__HHA_CLOUD_LOGGER_V2__ = true;

  const qs = (k,d=null)=>{ try{return new URL(location.href).searchParams.get(k) ?? d;}catch{return d;} };
  const ENDPOINT = (qs('log','')||'').trim(); // ?log=...
  const LS_KEY = 'HHA_LOG_QUEUE_V2';

  function loadQ(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY) || '[]') || []; }catch(_){ return []; }
  }
  function saveQ(q){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(q.slice(-120))); }catch(_){}
  }

  let queue = loadQ();
  let flushing = false;

  function guessGameMode(){
    // 1) explicit query
    const g = (qs('game','')||qs('mode','')||'').toLowerCase().trim();
    if (g) return g;

    // 2) path heuristic
    const p = (location.pathname||'').toLowerCase();
    if (p.includes('hydration')) return 'hydration';
    if (p.includes('goodjunk')) return 'goodjunk';
    if (p.includes('groups')) return 'groups';
    if (p.includes('plate')) return 'plate';

    // 3) default
    return 'unknown';
  }

  function payloadBase(){
    return {
      timestampIso: new Date().toISOString(),
      href: location.href,
      ua: navigator.userAgent || '',
      projectTag: qs('projectTag','HeroHealth'),
      game: 'HeroHealth'
    };
  }

  function enqueue(obj){
    queue.push(obj);
    saveQ(queue);
  }

  async function postJson(url, obj){
    try{
      const body = JSON.stringify(obj);

      // sendBeacon first (unload-safe)
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
      else break; // stop if offline
    }

    if(sent > 0){
      queue = q.slice(sent);
      saveQ(queue);
    }

    flushing = false;
  }

  // ---- SESSION SUMMARY ----
  function onEnd(ev){
    try{
      const d = ev?.detail || {};
      const gameMode = (d.gameMode || qs('gameMode','') || guessGameMode()).toString().toLowerCase();

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
        seed: qs('seed','') || d.seed || '',
        sessionId: d.sessionId || qs('sessionId','') || '',
        kids: !!(d.kids || (qs('kids','0')==='1'))
      });

      enqueue(pack);
      flush();
    }catch(_){}
  }

  WIN.addEventListener('hha:end', onEnd, { passive:true });

  // ---- OPTIONAL TELEMETRY ----
  function onEvent(ev){
    try{
      const d = ev?.detail || {};
      const gameMode = (d.gameMode || qs('gameMode','') || guessGameMode()).toString().toLowerCase();

      const pack = Object.assign(payloadBase(), {
        kind: 'event',
        gameMode,
        t: Number(d.t || 0) || 0,
        name: String(d.name || 'event'),
        data: d.data || {},
        seed: qs('seed','') || d.seed || '',
        sessionId: d.sessionId || qs('sessionId','') || ''
      });

      enqueue(pack);
      // do NOT flush every event aggressively; logger already has periodic flush
    }catch(_){}
  }
  WIN.addEventListener('hha:event', onEvent, { passive:true });

  // Manual flush hook
  WIN.addEventListener('hha:flush', ()=>flush(), { passive:true });

  // unload flush
  WIN.addEventListener('pagehide', ()=>flush(), { passive:true });
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flush();
  }, { passive:true });
  WIN.addEventListener('beforeunload', ()=>flush(), { passive:true });

  // periodic flush
  setInterval(()=>flush(), 3500);

})();