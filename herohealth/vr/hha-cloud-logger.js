// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened, universal)
// ✅ Listens: hha:end  -> sends session summary JSON (queue + retry)
// ✅ Optional: hha:log -> enqueue event objects (kind:'event')
// ✅ Offline-safe queue persisted in localStorage
// ✅ keepalive + sendBeacon fallback (unload-friendly)
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange(hidden), beforeunload, online
// ✅ FIX: gameMode is NOT hardcoded (auto from detail/query)
// ------------------------------------------------------------

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_CLOUD_LOGGER__) return;
  WIN.__HHA_CLOUD_LOGGER__ = true;

  const qs = (k,d=null)=>{ try{return new URL(location.href).searchParams.get(k) ?? d;}catch{return d;} };
  const nowIso = ()=> new Date().toISOString();

  // Endpoint priority:
  // 1) ?log=...
  // 2) window.HHA_LOG_ENDPOINT
  // 3) data-log on <html> (rare, optional)
  const ENDPOINT = (qs('log','') || WIN.HHA_LOG_ENDPOINT || DOC.documentElement?.dataset?.log || '').trim();
  const ENABLED = !!ENDPOINT;

  const LS_KEY = 'HHA_LOG_QUEUE_V2';
  const MAX_KEEP = 120;

  function loadQ(){
    try{
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    }catch(_){ return []; }
  }
  function saveQ(q){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(q.slice(-MAX_KEEP))); }catch(_){}
  }

  let queue = loadQ();
  let flushing = false;

  function detectDevice(){
    const view = String(qs('view','')||'').toLowerCase();
    if(view) return view;
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    return isTouch ? 'mobile' : 'pc';
  }

  function payloadBase(){
    return {
      timestampIso: nowIso(),
      href: location.href,
      ua: navigator.userAgent || '',
      projectTag: qs('projectTag','HeroHealth'),
      app: 'HeroHealth',
      device: detectDevice(),
      ts: String(qs('ts','') || ''),
      seed: String(qs('seed','') || ''),
      sessionId: String(qs('sessionId', qs('studentKey','')) || ''),
      studyId: String(qs('studyId','') || ''),
      phase: String(qs('phase','') || ''),
      conditionGroup: String(qs('conditionGroup','') || ''),
      runMode: String(qs('run', qs('runMode','play')) || 'play'),
      diff: String(qs('diff','normal') || 'normal'),
      durationPlannedSec: Number(qs('time', qs('durationPlannedSec','0')) || 0) || 0,
      hub: String(qs('hub','') || '')
    };
  }

  function safeNum(v){ v=Number(v); return Number.isFinite(v)?v:0; }

  function enqueue(obj){
    queue.push(obj);
    saveQ(queue);
  }

  async function postJson(url, obj){
    try{
      const body = JSON.stringify(obj);

      // sendBeacon (best for unload)
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
    if(!ENABLED) return;
    if(queue.length === 0) return;

    flushing = true;

    const q = queue.slice();
    let sent = 0;

    for(let i=0;i<q.length;i++){
      const ok = await postJson(ENDPOINT, q[i]);
      if(ok) sent++;
      else break; // stop if offline / failed
    }

    if(sent > 0){
      queue = q.slice(sent);
      saveQ(queue);
    }

    flushing = false;
  }

  // ---- Main: session end ----
  function inferGameMode(detail){
    // priority: detail.gameMode / detail.game / query gameMode / query game / fallback
    const d = detail || {};
    return String(
      d.gameMode ||
      d.game ||
      qs('gameMode', qs('game','')) ||
      qs('mode','') ||
      'unknown'
    );
  }

  function onEnd(ev){
    try{
      const d = ev?.detail || {};
      const base = payloadBase();

      const pack = Object.assign(base, {
        kind: 'session',
        gameMode: inferGameMode(d),

        // common summary fields (keep universal)
        durationPlayedSec: safeNum(d.durationPlayedSec || d.durationSec || 0),
        scoreFinal: safeNum(d.scoreFinal || d.score || 0),
        misses: safeNum(d.misses || 0),
        grade: String(d.grade || '—'),
        reason: String(d.reason || 'end'),

        // allow extra fields through (but don't explode size)
        // e.g., hydration: accuracyGoodPct, stormCycles, stormSuccess, bossClearCount, etc.
        extra: (()=> {
          const allow = [
            'accuracyGoodPct','comboMax','streakMax','goalsCleared','goalsTotal',
            'miniCleared','miniTotal','stormCycles','stormSuccess','stormRatePct',
            'bossClearCount','stageCleared','kids','practiceSec',
            'waterPct','waterZone'
          ];
          const ex = {};
          for(const k of allow){
            if(d[k] !== undefined) ex[k] = d[k];
          }
          return ex;
        })()
      });

      enqueue(pack);
      flush(); // best-effort immediate
    }catch(_){}
  }

  // ---- Optional: event log ----
  function onLog(ev){
    try{
      const d = ev?.detail || {};
      const base = payloadBase();

      const pack = Object.assign(base, {
        kind: 'event',
        gameMode: inferGameMode(d),
        event: String(d.event || d.type || 'event'),
        t: safeNum(d.t || performance.now()),
        data: d.data || d
      });

      enqueue(pack);
      flush();
    }catch(_){}
  }

  // Public handle (used by engine "avoid duplicate send" checks)
  WIN.HHA_LOGGER = {
    enabled: ENABLED,
    endpoint: ENDPOINT,
    flush,
    enqueue
  };

  WIN.addEventListener('hha:end', onEnd, { passive:true });
  WIN.addEventListener('hha:log', onLog, { passive:true });

  // Manual flush hook
  WIN.addEventListener('hha:flush', ()=>flush(), { passive:true });

  // unload flush
  WIN.addEventListener('pagehide', ()=>flush(), { passive:true });
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flush();
  }, { passive:true });
  WIN.addEventListener('beforeunload', ()=>flush(), { passive:true });

  // retry when back online
  WIN.addEventListener('online', ()=>flush(), { passive:true });

  // periodic flush (offline -> online scenarios)
  setInterval(()=>flush(), 3500);

})();