// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened, universal)
// ✅ Listens: hha:end -> sends session summary JSON (FULL PASS-THROUGH)
// ✅ Queue persist localStorage (offline-safe)
// ✅ keepalive + sendBeacon fallback
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload
// ✅ FIX: universal gameMode (no hardcode goodjunk)
// ✅ FIX: sends FULL summary (research-grade) + attaches meta (href, ua, view, diff, seed, etc.)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_CLOUD_LOGGER__) return;
  WIN.__HHA_CLOUD_LOGGER__ = true;

  const qs = (k,d=null)=>{ try{return new URL(location.href).searchParams.get(k) ?? d;}catch{return d;} };

  const ENDPOINT = (qs('log','')||'').trim(); // ?log=...
  const LS_KEY = 'HHA_LOG_QUEUE_V1';

  // public handle (so engines can check logger state)
  WIN.HHA_LOGGER = WIN.HHA_LOGGER || {};
  WIN.HHA_LOGGER.enabled = !!ENDPOINT;

  function loadQ(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY) || '[]') || []; }catch(_){ return []; }
  }
  function saveQ(q){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(q.slice(-80))); }catch(_){}
  }

  let queue = loadQ();
  let flushing = false;

  function payloadMeta(){
    return {
      timestampIso: new Date().toISOString(),
      href: location.href,
      ua: navigator.userAgent || '',
      projectTag: qs('projectTag','HeroHealth') || 'HeroHealth',
      view: (qs('view','')||'').toLowerCase(),
      diff: (qs('diff','')||'').toLowerCase(),
      runMode: (qs('run', qs('runMode','play'))||'play').toLowerCase(),
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

  // Decide gameMode from event detail (preferred) then URL, then fallback
  function inferGameMode(detail){
    const d = detail || {};
    const a =
      d.gameMode ||
      d.game ||
      d.mode ||
      qs('gameMode','') ||
      '';

    const s = String(a||'').toLowerCase();

    // normalize common names
    if (s.includes('hydr')) return 'hydration';
    if (s.includes('group')) return 'groups';
    if (s.includes('plate')) return 'plate';
    if (s.includes('good')) return 'goodjunk';

    // try by path
    const p = (location.pathname || '').toLowerCase();
    if (p.includes('hydration')) return 'hydration';
    if (p.includes('groups')) return 'groups';
    if (p.includes('plate')) return 'plate';
    if (p.includes('goodjunk')) return 'goodjunk';

    return s || 'game';
  }

  // Listen end summary (FULL)
  function onEnd(ev){
    try{
      const d = ev?.detail || {};
      const meta = payloadMeta();

      // Full pass-through summary + meta overlay (meta wins only if summary missing)
      const pack = Object.assign(
        {
          kind: 'session',
          gameMode: inferGameMode(d),
        },
        meta,
        d
      );

      // guarantee some key fields exist (for sheets)
      if(!pack.runMode) pack.runMode = meta.runMode;
      if(!pack.diff) pack.diff = meta.diff;
      if(!pack.view) pack.view = meta.view;
      if(!pack.seed) pack.seed = meta.seed;
      if(!pack.sessionId) pack.sessionId = meta.sessionId;

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