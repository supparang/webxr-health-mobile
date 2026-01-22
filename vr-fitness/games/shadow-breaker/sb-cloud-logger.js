// === ShadowBreaker Cloud Logger (flush-hardened) ===
// Listens:
// - hha:start / hha:score / hha:end / hha:flush
// - sb:* events (predict/director/coach_tip/wave/boss/time)
// Sends to endpoint from ?log=...  (Apps Script / API)
// Queue persisted in localStorage for offline resilience

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const LSQ = 'SB_CLOUD_QUEUE_V1';
  const LSM = 'SB_CLOUD_META_V1';

  function qs(k,d=''){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }
  const ENDPOINT = (qs('log','')||'').trim();
  if(!ENDPOINT){
    // Silent if no endpoint, but still keep queue for later debugging.
    console.info('[SB Cloud] no ?log= endpoint provided. Cloud logger idle.');
  }

  const GAME = 'shadow-breaker';

  function nowISO(){ return new Date().toISOString(); }
  function safeJsonParse(s, d){ try{ return JSON.parse(s); }catch{ return d; } }

  function loadQ(){ return safeJsonParse(localStorage.getItem(LSQ), []) || []; }
  function saveQ(q){ try{ localStorage.setItem(LSQ, JSON.stringify(q)); }catch{} }

  function loadMeta(){ return safeJsonParse(localStorage.getItem(LSM), {}) || {}; }
  function saveMeta(m){ try{ localStorage.setItem(LSM, JSON.stringify(m||{})); }catch{} }

  function enqueue(kind, payload){
    const q = loadQ();
    q.push({
      kind,
      game: GAME,
      t: nowISO(),
      url: location.href,
      payload
    });
    // keep last 5000
    if(q.length>5000) q.splice(0, q.length-5000);
    saveQ(q);
  }

  async function postJSON(url, data){
    // try fetch keepalive
    try{
      const res = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      });
      if(!res.ok) throw new Error('HTTP '+res.status);
      return true;
    }catch(e){
      // fallback sendBeacon
      try{
        const blob = new Blob([JSON.stringify(data)], { type:'application/json' });
        if(navigator.sendBeacon && navigator.sendBeacon(url, blob)) return true;
      }catch(_){}
      return false;
    }
  }

  let flushing = false;

  async function flush(reason='tick'){
    if(flushing) return;
    if(!ENDPOINT) return;
    flushing = true;

    try{
      const q = loadQ();
      if(!q.length){ flushing=false; return; }

      // batch send (max 120 per request)
      let idx = 0;
      let okAll = true;

      while(idx < q.length){
        const batch = q.slice(idx, idx+120);
        const ok = await postJSON(ENDPOINT, {
          kind:'sb_batch',
          game: GAME,
          reason,
          meta: loadMeta(),
          batch
        });
        if(!ok){ okAll=false; break; }
        idx += batch.length;
      }

      if(okAll){
        saveQ([]);
      }else{
        // keep remaining (do not drop)
        const remain = q.slice(idx);
        saveQ(remain);
      }
    }catch(err){
      console.warn('[SB Cloud] flush error:', err);
    }finally{
      flushing = false;
    }
  }

  // --- capture meta from hha:start / session record ---
  WIN.addEventListener('hha:start', (ev)=>{
    const d = ev.detail || {};
    const m = loadMeta();
    m.lastStart = nowISO();
    m.gameVersion = d.gameVersion || m.gameVersion || '';
    m.seed = d.seed || m.seed || '';
    m.research = d.research || m.research || 0;
    m.ai = d.ai || m.ai || 0;
    saveMeta(m);

    enqueue('hha:start', d);
    flush('start');
  });

  WIN.addEventListener('hha:score', (ev)=>{
    const d = ev.detail || {};
    // keep lightweight
    enqueue('hha:score', {
      score:d.score, gained:d.gained, combo:d.combo, hit:d.hit, miss:d.miss, rtMs:d.rtMs, boss:d.boss
    });
  });

  WIN.addEventListener('hha:end', (ev)=>{
    const d = ev.detail || {};
    enqueue('hha:end', d);
    flush('end');
  });

  WIN.addEventListener('hha:flush', (ev)=>{
    const d = ev.detail || {};
    flush(d.reason || 'flush');
  });

  // --- ShadowBreaker ML events ---
  const SB_EVENTS = [
    'sb:predict','sb:director','sb:coach_tip','sb:wave','sb:boss','sb:time','sb:pause','sb:session_start','sb:session_end'
  ];
  SB_EVENTS.forEach(name=>{
    WIN.addEventListener(name, (ev)=>{
      enqueue(name, ev.detail || {});
    });
  });

  // periodic flush
  setInterval(()=>flush('interval'), 8000);

  // flush on lifecycle
  function flushHard(reason){
    enqueue('sb:lifecycle', { reason });
    flush(reason);
  }
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flushHard('hidden');
  });
  WIN.addEventListener('pagehide', ()=>flushHard('pagehide'));
  WIN.addEventListener('beforeunload', ()=>flushHard('beforeunload'));
})();