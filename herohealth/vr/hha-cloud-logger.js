// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened) — LATEST
// ✅ Listens: hha:end -> sends session summary JSON
// ✅ Listens: hha:ml_row -> sends ML telemetry rows (1Hz from game)
// ✅ Listens: hha:predict (optional) -> sends prediction stream if you emit it
// ✅ Queue persist localStorage (offline-safe)
// ✅ keepalive + sendBeacon fallback
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload
// ✅ FIX: DO NOT hardcode gameMode='goodjunk' (use event.detail.gameMode)

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

  function detectDevice(){
    const v = String(qs('view','')||'').toLowerCase();
    if (v) return v;
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    return isTouch ? 'mobile' : 'pc';
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
      else break; // stop if offline / failing
    }

    if(sent > 0){
      queue = q.slice(sent);
      saveQ(queue);
    }

    flushing = false;
  }

  // --- Pack helpers ---
  function packCommonFromDetail(d){
    const device = d.device || detectDevice();
    const runMode = d.runMode || qs('run','play');
    const diff = d.diff || qs('diff','normal');
    const seed = d.seed || qs('seed','') || '';
    const sessionId =
      d.sessionId ||
      qs('sessionId','') ||
      qs('studentKey','') ||
      qs('studyId','') ||
      '';

    const gameMode =
      d.gameMode ||
      d.game ||
      qs('gameMode','') ||
      qs('game','') ||
      'unknown';

    return { device, runMode, diff, seed, sessionId, gameMode };
  }

  // --- Session end ---
  function onEnd(ev){
    try{
      const d = ev?.detail || {};
      const common = packCommonFromDetail(d);

      // Keep original payload as much as possible, but normalize core identifiers
      const pack = Object.assign(payloadBase(), d, common, {
        kind: 'session',
      });

      // Ensure numeric sanity for key fields (won't break if absent)
      pack.durationPlannedSec = Number(pack.durationPlannedSec || qs('time','0') || 0) || 0;
      pack.durationPlayedSec  = Number(pack.durationPlayedSec || 0) || 0;
      pack.scoreFinal         = Number(pack.scoreFinal || 0) || 0;
      pack.misses             = Number(pack.misses || 0) || 0;

      enqueue(pack);
      flush(); // best-effort immediate
    }catch(_){}
  }

  // --- ML telemetry row (1Hz) ---
  function onMLRow(ev){
    try{
      const d = ev?.detail || {};
      const common = packCommonFromDetail(d);

      const pack = Object.assign(payloadBase(), d, common, {
        kind: 'ml_row',
      });

      enqueue(pack);
      // ไม่ต้อง flush ทุกแถวก็ได้ แต่ตอนนี้ให้ flush best-effort (มี queue กันอยู่แล้ว)
      flush();
    }catch(_){}
  }

  // --- Prediction stream (optional) ---
  function onPredict(ev){
    try{
      const d = ev?.detail || {};
      const common = packCommonFromDetail(d);

      const pack = Object.assign(payloadBase(), d, common, {
        kind: 'predict',
      });

      enqueue(pack);
      flush();
    }catch(_){}
  }

  WIN.addEventListener('hha:end', onEnd, { passive:true });
  WIN.addEventListener('hha:ml_row', onMLRow, { passive:true });
  WIN.addEventListener('hha:predict', onPredict, { passive:true });

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

  // Expose minimal state (optional)
  WIN.HHA_LOGGER = {
    enabled: !!ENDPOINT,
    endpoint: ENDPOINT,
    flush,
    getQueueSize: ()=> (queue?.length|0),
  };

})();