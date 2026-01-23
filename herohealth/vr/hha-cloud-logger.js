// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened, cross-game)
// ✅ Listens: hha:end -> sends session summary JSON
// ✅ Queue persist localStorage (offline-safe)
// ✅ keepalive + sendBeacon fallback
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload
// ✅ FIX: do NOT hardcode gameMode; use ev.detail.gameMode (hydration/plate/groups/goodjunk)
// ✅ FIX: preserve the original summary payload (research fields, stage, minis, etc.)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_CLOUD_LOGGER__) return;
  WIN.__HHA_CLOUD_LOGGER__ = true;

  const qs = (k,d=null)=>{ try{return new URL(location.href).searchParams.get(k) ?? d;}catch{return d;} };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // Endpoint from ?log=
  const ENDPOINT = (qs('log','')||'').trim();
  const LS_KEY = 'HHA_LOG_QUEUE_V2';

  function loadQ(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY) || '[]') || []; }catch(_){ return []; }
  }
  function saveQ(q){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(q.slice(-120))); }catch(_){}
  }

  let queue = loadQ();
  let flushing = false;

  const LOGGER = {
    enabled: !!ENDPOINT,
    queueSize: ()=>queue.length,
    flush: ()=>flush()
  };
  WIN.HHA_LOGGER = LOGGER;

  function payloadBase(){
    return {
      timestampIso: new Date().toISOString(),
      href: location.href,
      ua: navigator.userAgent || '',
      projectTag: qs('projectTag','HeroHealth'),
      view: qs('view','') || '',
      runMode: qs('run', qs('runMode','play')) || 'play',
      diff: qs('diff','normal') || 'normal',
      seed: qs('seed','') || '',
      sessionId: qs('sessionId', qs('studentKey','')) || ''
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

    // send oldest-first
    const q = queue.slice();
    let sent = 0;

    for(let i=0;i<q.length;i++){
      const ok = await postJson(ENDPOINT, q[i]);
      if(ok) sent++;
      else break; // stop if offline/failed
    }

    if(sent > 0){
      queue = q.slice(sent);
      saveQ(queue);
    }

    flushing = false;
  }

  // --- core: capture session end summary ---
  function onEnd(ev){
    try{
      const d = ev?.detail || {};
      const base = payloadBase();

      // prefer summary truth (d.*) over qs
      const gameMode = String(d.gameMode || d.game || qs('gameMode','') || 'unknown');

      // pack keeps full summary (do not lose fields)
      const pack = Object.assign({}, base, d, {
        kind: 'session',
        gameMode,
        // normalize a few common fields (safe)
        runMode: d.runMode || base.runMode,
        diff: d.diff || base.diff,
        view: d.device || d.view || base.view,
        durationPlannedSec: Number(d.durationPlannedSec ?? base.durationPlannedSec ?? 0) || 0,
        durationPlayedSec: Number(d.durationPlayedSec ?? 0) || 0,
        scoreFinal: Number(d.scoreFinal ?? 0) || 0,
        misses: Number(d.misses ?? 0) || 0,
        grade: d.grade || '—',
        reason: d.reason || 'end',
        seed: String(d.seed || base.seed || ''),
        sessionId: String(d.sessionId || base.sessionId || '')
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