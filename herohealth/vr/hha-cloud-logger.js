// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened) — UNIVERSAL
// ✅ Listens: hha:end -> sends session summary JSON (universal across games)
// ✅ Queue persist localStorage (offline-safe)
// ✅ keepalive + sendBeacon fallback
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload
// ✅ FIX: gameMode NOT hardcoded; derive from event detail / URL

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
    };
  }

  function normStr(v){ return String(v ?? '').trim(); }
  function normNum(v, d=0){
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function detectGameModeFromURL(){
    // fallback only — prefer event detail
    // try qs('gameMode'), qs('mode'), qs('game'), else derive from path keywords
    const q1 = normStr(qs('gameMode','') || qs('mode','') || qs('game',''));
    if (q1) return q1.toLowerCase();

    const p = (location.pathname || '').toLowerCase();
    if (p.includes('goodjunk')) return 'goodjunk';
    if (p.includes('groups')) return 'groups';
    if (p.includes('hydration')) return 'hydration';
    if (p.includes('plate')) return 'plate';
    return 'unknown';
  }

  function detectDevice(){
    const v = normStr(qs('view',''));
    if (v) return v;
    // fallback heuristic
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    return isTouch ? 'mobile' : 'pc';
  }

  function enqueue(obj){
    queue.push(obj);
    saveQ(queue);
  }

  async function postJson(url, obj){
    try{
      const body = JSON.stringify(obj);

      // best for unload
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

    const q = queue.slice(); // oldest-first
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

  // Listen end summary (UNIVERSAL)
  function onEnd(ev){
    try{
      const d = ev?.detail || {};

      const gameMode =
        normStr(d.gameMode) ||
        normStr(d.game) ||
        normStr(d.gameId) ||
        normStr(qs('gameMode','')) ||
        detectGameModeFromURL();

      const runMode =
        normStr(d.runMode) ||
        normStr(qs('run','play')) ||
        'play';

      const diff =
        normStr(d.diff) ||
        normStr(qs('diff','normal')) ||
        'normal';

      const device =
        normStr(d.device) ||
        detectDevice();

      // carry-through fields commonly used in research ctx
      const pack = Object.assign(payloadBase(), {
        kind: 'session',

        // ✅ universal identity
        gameMode,
        runMode,
        diff,
        device,

        // research ids (optional)
        sessionId: normStr(d.sessionId || qs('sessionId','') || qs('studentKey','')),
        studyId:   normStr(d.studyId   || qs('studyId','')),
        phase:     normStr(d.phase     || qs('phase','')),
        conditionGroup: normStr(d.conditionGroup || qs('conditionGroup','')),

        // timing & score
        durationPlannedSec: normNum(d.durationPlannedSec || qs('time','0'), 0),
        durationPlayedSec:  normNum(d.durationPlayedSec  || 0, 0),
        scoreFinal:         normNum(d.scoreFinal || 0, 0),
        misses:             normNum(d.misses || 0, 0),
        grade:              normStr(d.grade || '—'),
        reason:             normStr(d.reason || 'end'),

        // seed
        seed: normStr(d.seed || qs('seed','') || ''),

        // optional telemetry passthrough (keep whatever game sends)
        // NOTE: we *do not* override existing keys; we just keep base fields above.
      });

      // If detail is an object, merge remaining keys safely (but don't override base)
      if (d && typeof d === 'object'){
        for (const k of Object.keys(d)){
          if (pack[k] !== undefined) continue;
          pack[k] = d[k];
        }
      }

      enqueue(pack);
      flush();
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

  // periodic flush
  setInterval(()=>flush(), 3500);

  // expose minimal status (optional)
  WIN.HHA_LOGGER = WIN.HHA_LOGGER || {};
  WIN.HHA_LOGGER.enabled = true;

})();