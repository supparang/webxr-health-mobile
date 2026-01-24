// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened + queue + de-dup)
// ✅ Listens: hha:end -> enqueue + send JSON to ?log=...
// ✅ Queue persist localStorage (offline-safe)
// ✅ keepalive + sendBeacon fallback
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload
// ✅ De-dup: avoid enqueue same run twice (seed+timestampIso/sessionId key)
// ✅ Expose window.HHA_LOGGER = { enabled, flush, queueLength, endpoint }

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_CLOUD_LOGGER__) return;
  WIN.__HHA_CLOUD_LOGGER__ = true;

  const qs = (k,d=null)=>{ try{return new URL(location.href).searchParams.get(k) ?? d;}catch{return d;} };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const ENDPOINT = (qs('log','')||'').trim(); // ?log=...
  const LS_KEY_Q = 'HHA_LOG_QUEUE_V2';
  const LS_KEY_SENT = 'HHA_LOG_SENT_KEYS_V1'; // small rolling set for de-dup

  function loadQ(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY_Q) || '[]') || []; }catch(_){ return []; }
  }
  function saveQ(q){
    try{ localStorage.setItem(LS_KEY_Q, JSON.stringify(q.slice(-120))); }catch(_){}
  }

  function loadSent(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY_SENT) || '[]') || []; }catch(_){ return []; }
  }
  function saveSent(arr){
    try{ localStorage.setItem(LS_KEY_SENT, JSON.stringify(arr.slice(-120))); }catch(_){}
  }

  let queue = loadQ();
  let sentKeys = loadSent();
  let flushing = false;

  function payloadBase(){
    return {
      timestampIso: new Date().toISOString(),
      href: location.href,
      ua: navigator.userAgent || '',
      projectTag: qs('projectTag','HeroHealth'),
    };
  }

  function makeKey(pack){
    // stable-ish id to avoid duplicates across reload/unload
    const sid = String(pack.sessionId||pack.studentKey||'');
    const seed = String(pack.seed||'');
    const tiso = String(pack.timestampIso||'');
    const game = String(pack.gameMode||pack.game||'');
    return [game, sid, seed, tiso].join('|').slice(0, 260);
  }

  function isDup(key){
    if(!key) return false;
    return sentKeys.includes(key) || queue.some(it => (it && it.__key) === key);
  }

  function markSent(key){
    if(!key) return;
    sentKeys.push(key);
    if(sentKeys.length > 120) sentKeys = sentKeys.slice(-120);
    saveSent(sentKeys);
  }

  function enqueue(pack){
    if(!pack) return false;
    const key = makeKey(pack);
    if(isDup(key)) return false;

    pack.__key = key;
    queue.push(pack);
    saveQ(queue);
    return true;
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

    // oldest-first
    const q = queue.slice();
    let sent = 0;

    for(let i=0;i<q.length;i++){
      const item = q[i];
      if(!item) { sent++; continue; }

      // remove internal key before sending (optional)
      const sendObj = Object.assign({}, item);
      delete sendObj.__key;

      const ok = await postJson(ENDPOINT, sendObj);
      if(ok){
        sent++;
        if(item.__key) markSent(item.__key);
      }else{
        break; // stop if offline / error
      }
    }

    if(sent > 0){
      queue = q.slice(sent);
      saveQ(queue);
    }

    flushing = false;
  }

  // public handle (engine can check)
  WIN.HHA_LOGGER = {
    enabled: !!ENDPOINT,
    endpoint: ENDPOINT,
    flush,
    queueLength: ()=> (queue.length|0),
  };

  // Listen end summary
  function onEnd(ev){
    try{
      const d = ev?.detail || {};

      // IMPORTANT: do NOT hardcode gameMode
      // Prefer detail.gameMode; fallback to qs('game') or path inference
      const gameMode = String(d.gameMode || d.game || qs('gameMode','') || qs('game','') || '').toLowerCase()
        || (location.pathname.includes('hydration') ? 'hydration' : 'herohealth');

      const pack = Object.assign(payloadBase(), d, {
        kind: 'session',
        game: 'HeroHealth',
        gameMode,                         // ✅ hydration here
        runMode: d.runMode || qs('run','play'),
        diff: d.diff || qs('diff','normal'),
        device: d.device || qs('view',''),
        view: qs('view',''),
        seed: d.seed || qs('seed','') || '',
        sessionId: d.sessionId || qs('sessionId', qs('studentKey','')) || '',
      });

      // normalize common numeric fields (safe)
      pack.durationPlannedSec = Number(pack.durationPlannedSec || qs('time','0')) || 0;
      pack.durationPlayedSec  = Number(pack.durationPlayedSec || 0) || 0;
      pack.scoreFinal         = Number(pack.scoreFinal || 0) || 0;
      pack.misses             = Number(pack.misses || 0) || 0;

      const ok = enqueue(pack);
      if(ok) flush(); // best-effort immediate
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