// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened) — FIX gameMode + richer payload
// ✅ Listens: hha:end -> sends session summary JSON
// ✅ Queue persist localStorage (offline-safe)
// ✅ keepalive + sendBeacon fallback
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload
// ✅ FIX: gameMode no longer hard-coded to 'goodjunk' (uses event detail / url fallback)

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
      kind: 'session',
      view: qs('view','') || '',        // pc/mobile/cvr...
      device: qs('device','') || '',    // optional if caller passes
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

      // try sendBeacon first for unload safety
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
    if(!ENDPOINT) return;     // no endpoint => do nothing
    if(queue.length === 0) return;

    flushing = true;

    const q = queue.slice();  // oldest-first
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

  // pick safe fields from summary detail (avoid sending giant objects)
  function packFromDetail(d){
    const base = payloadBase();

    // FIX: gameMode priority: event detail -> url -> fallback
    const gameMode =
      (d && (d.gameMode || d.game || d.mode)) ||
      qs('gameMode', qs('game','')) ||
      '';

    // whitelist common summary fields (works cross-game)
    const out = Object.assign(base, {
      gameMode: String(gameMode || '').toLowerCase() || 'unknown',

      // timing / score
      durationPlannedSec: Number(d?.durationPlannedSec || qs('time','0')) || 0,
      durationPlayedSec: Number(d?.durationPlayedSec || 0) || 0,
      scoreFinal: Number(d?.scoreFinal || 0) || 0,
      misses: Number(d?.misses || 0) || 0,
      grade: d?.grade || '—',
      reason: d?.reason || 'end',

      // optional metrics if present (Hydration/Plate/Groups/GoodJunk etc.)
      accuracyGoodPct: (d?.accuracyGoodPct != null) ? Number(d.accuracyGoodPct) : undefined,
      comboMax: (d?.comboMax != null) ? Number(d.comboMax) : undefined,
      stageCleared: (d?.stageCleared != null) ? Number(d.stageCleared) : undefined,

      // quests
      goalsCleared: (d?.goalsCleared != null) ? Number(d.goalsCleared) : undefined,
      goalsTotal: (d?.goalsTotal != null) ? Number(d.goalsTotal) : undefined,
      miniCleared: (d?.miniCleared != null) ? Number(d.miniCleared) : undefined,
      miniTotal: (d?.miniTotal != null) ? Number(d.miniTotal) : undefined,

      // hydration-specific (if exists)
      stormCycles: (d?.stormCycles != null) ? Number(d.stormCycles) : undefined,
      stormSuccess: (d?.stormSuccess != null) ? Number(d.stormSuccess) : undefined,
      bossClearCount: (d?.bossClearCount != null) ? Number(d.bossClearCount) : undefined,
      greenHoldSec: (d?.greenHoldSec != null) ? Number(d.greenHoldSec) : undefined,

      // DD (if you added in Hydration)
      ddAvg: (d?.ddAvg != null) ? Number(d.ddAvg) : undefined,
      ddMax: (d?.ddMax != null) ? Number(d.ddMax) : undefined,
      ddState: (d?.ddState != null) ? String(d.ddState) : undefined,

      kids: (d?.kids != null) ? !!d.kids : undefined,
      practiceSec: (d?.practiceSec != null) ? Number(d.practiceSec) : undefined
    });

    // remove undefined fields (clean payload)
    Object.keys(out).forEach(k => out[k] === undefined && delete out[k]);
    return out;
  }

  // Listen end summary
  function onEnd(ev){
    try{
      const d = ev?.detail || {};
      const pack = packFromDetail(d);
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

  // expose small handle (optional)
  WIN.HHA_LOGGER = { enabled: !!ENDPOINT, flush };

})();