// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (Queue + Flush-hardened)
// ✅ Listens to: hha:start, hha:time, hha:score, hha:judge, hha:coach, quest:update, hha:end
// ✅ Sends to endpoint from ?log= (POST JSON)  / supports sendBeacon fallback
// ✅ Queue (localStorage) so data doesn't drop on mobile/VR
// ✅ Flush triggers: visibilitychange(hidden), pagehide, beforeunload, freeze
// ✅ Safe: no-op if no ?log=

// Payload schema (suggested):
// { type, ts, sessionId, runMode, gameMode, diff, seed, studyId, conditionGroup, data }

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const LS_Q = 'HHA_LOG_QUEUE_V1';

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const now = ()=> Date.now();

  // ---------- Config via query params ----------
  const endpoint = String(qs('log','') || '');
  if (!endpoint){
    // No endpoint => still expose helper for debugging but do nothing.
    WIN.HHA_LOGGER = { enabled:false, flush: async()=>false, enqueue: ()=>false };
    return;
  }

  const runMode = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const gameMode = String(qs('gameMode', qs('game','')) || '').toLowerCase(); // optional
  const diff = String(qs('diff','normal')).toLowerCase();
  const seed = String(qs('seed', qs('ts', String(now()))) || '');
  const sessionId = String(qs('sessionId', qs('studentKey','')) || '');
  const studyId = String(qs('studyId','') || '');
  const conditionGroup = String(qs('conditionGroup', qs('cond','')) || '');

  const projectTag = String(qs('projectTag','HeroHealth') || 'HeroHealth');
  const maxQueue = clamp(qs('logMax', 800), 50, 5000);      // max items in queue
  const batchSize = clamp(qs('logBatch', 25), 5, 100);      // per flush batch
  const minFlushGapMs = clamp(qs('logGap', 900), 200, 8000);
  const sampleScoreEvery = clamp(qs('logScoreEvery', 2), 1, 30); // sample every N score events

  // ---------- Queue helpers ----------
  function loadQ(){
    try{
      const raw = localStorage.getItem(LS_Q);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(_){ return []; }
  }
  function saveQ(arr){
    try{ localStorage.setItem(LS_Q, JSON.stringify(arr)); }catch(_){}
  }

  let Q = loadQ();
  let flushing = false;
  let lastFlushAt = -1e9;

  // ---------- transport ----------
  async function postJson(url, payload, useKeepalive=true){
    // Try sendBeacon first in shutdown-y cases (caller can decide)
    try{
      const body = JSON.stringify(payload);
      // fetch keepalive
      const res = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body,
        keepalive: !!useKeepalive,
        cache:'no-store',
        credentials:'omit'
      });
      return !!res && res.ok;
    }catch(_){
      return false;
    }
  }

  function beaconJson(url, payload){
    try{
      const blob = new Blob([JSON.stringify(payload)], { type:'application/json' });
      return navigator.sendBeacon ? navigator.sendBeacon(url, blob) : false;
    }catch(_){ return false; }
  }

  // ---------- build envelope ----------
  function envelope(type, data){
    return {
      type,
      ts: now(),
      projectTag,
      sessionId,
      runMode,
      gameMode: gameMode || String(qs('gameMode', qs('game','')) || ''),
      diff,
      seed,
      studyId,
      conditionGroup,
      url: location.href,
      ua: navigator.userAgent || '',
      data: data ?? {}
    };
  }

  // ---------- enqueue ----------
  function enqueue(type, data){
    try{
      Q.push(envelope(type, data));

      // trim oldest if too big
      if (Q.length > maxQueue){
        Q.splice(0, Q.length - maxQueue);
      }
      saveQ(Q);
      return true;
    }catch(_){
      return false;
    }
  }

  // ---------- flush ----------
  async function flush(opts={}){
    if (flushing) return false;

    const t = now();
    if (!opts.force && (t - lastFlushAt) < minFlushGapMs) return false;
    if (!Q.length) return false;

    flushing = true;
    lastFlushAt = t;

    // send in batches
    try{
      while (Q.length){
        const batch = Q.slice(0, batchSize);
        const payload = { batch, meta:{ projectTag, sessionId, runMode, seed, diff, studyId, conditionGroup } };

        let ok = false;

        // if shutdown-ish, prefer beacon first
        if (opts.useBeaconFirst){
          ok = beaconJson(endpoint, payload);
          if (!ok){
            ok = await postJson(endpoint, payload, true);
          }
        }else{
          ok = await postJson(endpoint, payload, true);
          if (!ok) ok = beaconJson(endpoint, payload);
        }

        if (!ok){
          // stop; keep remaining
          break;
        }

        // drop sent
        Q.splice(0, batch.length);
        saveQ(Q);
      }
      return true;
    }finally{
      flushing = false;
    }
  }

  // ---------- event listeners ----------
  let scoreTick = 0;

  function onEvent(type){
    return function(ev){
      const d = (ev && ev.detail) ? ev.detail : {};
      // Sampling for noisy streams
      if (type === 'hha:score'){
        scoreTick++;
        if ((scoreTick % sampleScoreEvery) !== 0) return;
      }
      enqueue(type, d);

      // auto-flush lightly (don’t spam)
      // flush more aggressively for end events
      if (type === 'hha:end'){
        flush({ force:true, useBeaconFirst:true });
      } else if (type === 'hha:start'){
        flush({ force:false });
      }
    };
  }

  // Attach
  const EVENTS = ['hha:start','hha:time','hha:score','hha:judge','hha:coach','quest:update','hha:end'];
  EVENTS.forEach(name => WIN.addEventListener(name, onEvent(name)));

  // ---------- flush-hardened triggers ----------
  function flushSoonShutdown(){
    flush({ force:true, useBeaconFirst:true });
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if (DOC.visibilityState === 'hidden') flushSoonShutdown();
  });

  WIN.addEventListener('pagehide', flushSoonShutdown);
  WIN.addEventListener('beforeunload', flushSoonShutdown);

  // Some browsers fire "freeze" on bfcache / background
  WIN.addEventListener('freeze', flushSoonShutdown);

  // Attempt periodic flush (very light)
  setInterval(()=>{ flush({ force:false }); }, 3500);

  // ---------- expose ----------
  WIN.HHA_LOGGER = {
    enabled:true,
    endpoint,
    enqueue,
    flush,
    getQueueSize: ()=> Q.length,
    clearQueue: ()=>{
      Q = [];
      saveQ(Q);
    }
  };

  // Prime flush once at boot
  flush({ force:false });

})();