// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION v2 (flush-hardened, cross-game)
// ✅ Listens: hha:end -> sends session summary JSON (per-game)
// ✅ Queue persist localStorage (offline-safe)
// ✅ keepalive + sendBeacon fallback
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload
// ✅ PATCH: no hardcode gameMode; uses event detail + query ctx

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_CLOUD_LOGGER_V2__) return;
  WIN.__HHA_CLOUD_LOGGER_V2__ = true;

  const qs = (k,d=null)=>{ try{return new URL(location.href).searchParams.get(k) ?? d;}catch{return d;} };
  const num = (v, def=0)=>{ v = Number(v); return Number.isFinite(v) ? v : def; };
  const boolQ = (k, def=false)=>{
    const v = String(qs(k, def ? '1':'0')).toLowerCase();
    return (v==='1'||v==='true'||v==='yes'||v==='on');
  };

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

  function payloadBase(){
    return {
      timestampIso: new Date().toISOString(),
      href: location.href,
      ua: navigator.userAgent || '',
      projectTag: qs('projectTag','HeroHealth'),
      kind: 'session',
    };
  }

  function ctxFromQuery(){
    // ctx that should exist across all games
    const view = String(qs('view','') || qs('device','') || '').toLowerCase();
    return {
      runMode: String(qs('run', qs('runMode','play')) || 'play').toLowerCase(),
      diff: String(qs('diff','normal')).toLowerCase(),
      device: view,
      hub: qs('hub','') || '',
      seed: qs('seed','') || '',
      ts: qs('ts','') || '',
      sessionId: qs('sessionId', qs('studentKey','')) || '',
      studentKey: qs('studentKey','') || '',
      studyId: qs('studyId','') || '',
      conditionGroup: qs('conditionGroup','') || qs('group','') || '',
      phase: qs('phase','') || '',
      kids: boolQ('kids', false),
      practiceSec: num(qs('practice','0'), 0),
      durationPlannedSec: num(qs('time', qs('durationPlannedSec','0')), 0),
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

    // send oldest-first
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

  function normalizeGameMode(d){
    // prioritize event detail
    const gm =
      d.gameMode || d.game || d.gameId ||
      qs('gameMode','') || qs('game','') || '';
    return String(gm || 'unknown').toLowerCase();
  }

  function onEnd(ev){
    try{
      const d = ev?.detail || {};
      const base = payloadBase();
      const ctx = ctxFromQuery();
      const gameMode = normalizeGameMode(d);

      // Merge: event detail should win over query for metrics
      const pack = Object.assign({}, base, ctx, {
        gameMode,

        // most important session metrics (try common keys)
        durationPlannedSec: num(d.durationPlannedSec, ctx.durationPlannedSec),
        durationPlayedSec:  num(d.durationPlayedSec, 0),
        scoreFinal:         num(d.scoreFinal, 0),
        misses:             num(d.misses, 0),
        grade:              d.grade || '—',
        reason:             d.reason || 'end',

        // helpful extras if present
        accuracyGoodPct:    num(d.accuracyGoodPct, null),
        comboMax:           num(d.comboMax, null),
        stageCleared:       num(d.stageCleared, null),
        goalsCleared:       num(d.goalsCleared, null),
        goalsTotal:         num(d.goalsTotal, null),

        miniCleared:        num(d.miniCleared, null),
        miniTotal:          num(d.miniTotal, null),
        stormCycles:        num(d.stormCycles, null),
        stormSuccess:       num(d.stormSuccess, null),
        stormRatePct:       num(d.stormRatePct, null),
        bossClearCount:     num(d.bossClearCount, null),

        greenHoldSec:       (d.greenHoldSec != null ? num(d.greenHoldSec, null) : null),
        practiceSec:        (d.practiceSec != null ? num(d.practiceSec, ctx.practiceSec) : ctx.practiceSec),

        // keep raw keys if you want to analyze later
        _raw: d
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

  // periodic flush (in case offline -> online)
  setInterval(()=>flush(), 3500);

  // expose status (optional)
  WIN.HHA_LOGGER = {
    enabled: !!ENDPOINT,
    flush: ()=>flush(),
    getQueueSize: ()=>queue.length
  };

})();