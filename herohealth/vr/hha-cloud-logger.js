// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened) — FIXED
// ✅ Listens: hha:end -> sends session summary JSON
// ✅ Queue persist localStorage (offline-safe)
// ✅ keepalive + sendBeacon fallback
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload
// ✅ FIX: do NOT hardcode gameMode (was goodjunk). Use event detail.

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

  function enqueue(obj){
    queue.push(obj);
    saveQ(queue);
  }

  async function postJson(url, obj){
    try{
      const body = JSON.stringify(obj);

      // unload-safe first
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

  // Normalize device/view
  function detectDevice(){
    const v = (qs('view','')||'').toLowerCase();
    if(v) return v;
    const b = DOC.body;
    if(b?.classList.contains('view-cvr')) return 'cvr';
    if(b?.classList.contains('view-vr')) return 'vr';
    if(b?.classList.contains('view-mobile')) return 'mobile';
    if(b?.classList.contains('view-pc')) return 'pc';
    return '';
  }

  // Listen end summary
  function onEnd(ev){
    try{
      const d = ev?.detail || {};

      // IMPORTANT: take from summary first, then fallback to query
      const gameMode = d.gameMode || d.game || qs('gameMode', qs('game','')) || 'unknown';
      const runMode  = d.runMode  || qs('run', qs('runMode','play')) || 'play';
      const diff     = d.diff     || qs('diff','normal') || 'normal';
      const device   = d.device   || detectDevice();
      const seed     = d.seed     || qs('seed','') || '';

      const sessionId = d.sessionId || qs('sessionId', qs('studentKey','')) || '';
      const studyId = d.studyId || qs('studyId','') || '';
      const phase = d.phase || qs('phase','') || '';
      const conditionGroup = d.conditionGroup || qs('conditionGroup','') || '';

      const pack = Object.assign(payloadBase(), {
        kind: 'session',

        gameMode,
        runMode,
        diff,
        device,

        sessionId,
        studyId,
        phase,
        conditionGroup,

        seed,

        durationPlannedSec: Number(d.durationPlannedSec || qs('time','0')) || 0,
        durationPlayedSec:  Number(d.durationPlayedSec || 0) || 0,

        scoreFinal: Number(d.scoreFinal || 0) || 0,
        comboMax:   Number(d.comboMax || 0) || 0,
        misses:     Number(d.misses || 0) || 0,
        grade: d.grade || '—',
        reason: d.reason || 'end',

        // passthrough extras if present
        kids: (d.kids===true || String(qs('kids','0')).toLowerCase()==='1'),
        practiceSec: Number(d.practiceSec || qs('practice','0')) || 0
      });

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

  // periodic flush (offline -> online)
  setInterval(()=>flush(), 3500);

  // expose status
  WIN.HHA_LOGGER = { enabled: !!ENDPOINT, flush };

})();