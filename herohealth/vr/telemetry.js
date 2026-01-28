// === /herohealth/vr/telemetry.js ===
// HHA Telemetry — PRODUCTION (Lite/Full/Off + throttle + flush-hardened)
// ✅ window.HHATelemetry.init({game})
// ✅ window.HHATelemetry.event(name, data?)
// ✅ window.HHATelemetry.flush(reason?)
// ✅ Auto-capture common HHA events + errors + unload/pagehide/visibilitychange
// ✅ Queue persisted to localStorage; best-effort sendBeacon/fetch(keepalive)
// ✅ Modes: telemetry=off|lite|full (default lite)
// ✅ Endpoint: ?log=<url> (optional). If missing -> only local queue.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!WIN || WIN.__HHA_TLM_LOADED__) return;
  WIN.__HHA_TLM_LOADED__ = true;

  const nowMs = ()=>{ try { return performance.now(); } catch { return Date.now(); } };
  const nowIso = ()=>{ try { return new Date().toISOString(); } catch { return String(Date.now()); } };

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const safeJson = (x)=>{ try { return JSON.stringify(x); } catch { return '"[unserializable]"'; } };

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function pickMode(){
    const v = String(qs('telemetry', qs('tlm','lite')) || 'lite').toLowerCase();
    if (v === '0' || v === 'false' || v === 'off' || v === 'none') return 'off';
    if (v === 'full' || v === '2') return 'full';
    return 'lite';
  }

  function makeId(prefix){
    const p = String(prefix||'id');
    try{
      const a = new Uint32Array(2);
      crypto.getRandomValues(a);
      return `${p}-${a[0].toString(16)}${a[1].toString(16)}`;
    }catch{
      return `${p}-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
    }
  }

  function bestViewport(){
    const w = Math.max(0, Math.floor(WIN.innerWidth||0));
    const h = Math.max(0, Math.floor(WIN.innerHeight||0));
    const dpr = Number(WIN.devicePixelRatio||1);
    return { w, h, dpr: Math.round(dpr*100)/100 };
  }

  // ---- Sender ----
  async function postJson(url, payload){
    const body = safeJson(payload);
    // Prefer sendBeacon (works well on pagehide/unload)
    try{
      if (navigator && typeof navigator.sendBeacon === 'function'){
        const ok = navigator.sendBeacon(url, new Blob([body], { type:'application/json' }));
        if (ok) return true;
      }
    }catch{}

    // Fallback fetch keepalive
    try{
      const res = await fetch(url, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body,
        keepalive:true,
        credentials:'omit',
        mode:'cors'
      });
      return !!(res && (res.ok || (res.status>=200 && res.status<300)));
    }catch{
      return false;
    }
  }

  // ---- Telemetry core ----
  const Telemetry = (function(){
    const STATE = {
      inited:false,
      game:'HHA',
      mode:'lite',
      endpoint:'',
      sessionId:'',
      run:'',
      diff:'',
      view:'',
      seed:'',
      studyId:'',
      conditionGroup:'',
      createdIso:'',
      t0: nowMs(),

      // queue
      q: [],
      maxQ: 1800,
      maxBatch: 40,
      flushCooldownMs: 800,
      lastFlushAt: 0,

      // throttles
      lastByName: new Map(), // name -> ms
      throttleMs: 90,        // drop same event if too frequent
      sampleShoot: 0.25,     // sample rate for noisy events in lite
      sampleMove: 0.08
    };

    function key(){
      return `HHA_TLM_QUEUE_${String(STATE.game||'HHA').toUpperCase()}`;
    }

    function loadQ(){
      try{
        const raw = localStorage.getItem(key());
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) STATE.q = arr.slice(-STATE.maxQ);
      }catch{}
    }

    function saveQ(){
      try{
        localStorage.setItem(key(), JSON.stringify(STATE.q.slice(-STATE.maxQ)));
      }catch{}
    }

    function meta(){
      const ua = (navigator && navigator.userAgent) ? String(navigator.userAgent) : '';
      const vw = bestViewport();
      return {
        game: STATE.game,
        mode: STATE.mode,
        sessionId: STATE.sessionId,
        run: STATE.run,
        diff: STATE.diff,
        view: STATE.view,
        seed: STATE.seed,
        studyId: STATE.studyId,
        conditionGroup: STATE.conditionGroup,
        page: location.pathname || '',
        href: location.href || '',
        ua: (STATE.mode==='full') ? ua : undefined,
        viewport: vw,
      };
    }

    function shouldKeep(name){
      if (STATE.mode === 'full') return true;

      // lite: keep important + sample noisy
      const n = String(name||'').toLowerCase();
      if (!n) return false;

      // always keep
      if (n.startsWith('hha:start')) return true;
      if (n.startsWith('hha:end')) return true;
      if (n.startsWith('hha:score')) return true;
      if (n.startsWith('hha:time')) return true;
      if (n.startsWith('quest:')) return true;
      if (n.includes('error')) return true;
      if (n.includes('judge')) return true;

      // noisy sampling
      if (n.includes('shoot')) return Math.random() < STATE.sampleShoot;
      if (n.includes('move') || n.includes('tick') || n.includes('spawn')) return Math.random() < STATE.sampleMove;

      // default keep
      return true;
    }

    function throttled(name){
      const n = String(name||'');
      const t = nowMs();
      const last = STATE.lastByName.get(n) || 0;
      if ((t - last) < STATE.throttleMs) return true;
      STATE.lastByName.set(n, t);
      return false;
    }

    function push(name, data){
      if (STATE.mode === 'off') return;

      const n = String(name||'');
      if (!n) return;

      if (!shouldKeep(n)) return;
      if (throttled(n)) return;

      const t = nowMs();
      const ev = {
        t: Math.round(t - STATE.t0),
        ts: nowIso(),
        name: n,
        data: (STATE.mode === 'full') ? (data ?? null) : (data ? sanitizeLite(data) : null),
      };

      STATE.q.push(ev);
      if (STATE.q.length > STATE.maxQ) STATE.q.splice(0, STATE.q.length - STATE.maxQ);

      saveQ();
    }

    function sanitizeLite(data){
      // lite: avoid big payloads; keep small numeric/string/booleans and a few keys
      try{
        if (data == null) return null;
        if (typeof data !== 'object') return data;
        const out = {};
        const allow = ['x','y','z','score','combo','miss','hit','ok','type','phase','group','target','reason','timeLeft','hp','idx','k','v'];
        for (const k of Object.keys(data)){
          if (allow.includes(k)){
            const v = data[k];
            if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' || v == null) out[k] = v;
          }
        }
        return out;
      }catch{
        return null;
      }
    }

    async function flush(reason){
      if (STATE.mode === 'off') return false;
      const url = String(STATE.endpoint||'');
      if (!url) return false; // no endpoint -> local only

      const t = nowMs();
      if ((t - STATE.lastFlushAt) < STATE.flushCooldownMs && (STATE.q.length < STATE.maxBatch)) return false;
      STATE.lastFlushAt = t;

      // take batches until empty or send fails
      let okAny = false;
      while (STATE.q.length){
        const batch = STATE.q.slice(0, STATE.maxBatch);
        const payload = {
          meta: meta(),
          reason: String(reason||'flush'),
          sentAt: nowIso(),
          events: batch,
        };

        const ok = await postJson(url, payload);
        if (!ok) break;

        okAny = true;
        STATE.q.splice(0, batch.length);
        saveQ();
      }
      return okAny;
    }

    function init(opts){
      if (STATE.inited) return WIN.HHATelemetry;

      STATE.game = String((opts && opts.game) || 'HHA');
      STATE.mode = pickMode();

      STATE.endpoint = String(qs('log','') || '');
      STATE.run = String(qs('run','') || '');
      STATE.diff = String(qs('diff','') || '');
      STATE.view = String(qs('view','') || '');
      STATE.seed = String(qs('seed','') || '');
      STATE.studyId = String(qs('studyId','') || '');
      STATE.conditionGroup = String(qs('conditionGroup','') || '');
      STATE.createdIso = nowIso();

      // if research -> default to lite (still log key outcomes)
      if (String(STATE.run||'').toLowerCase()==='research' && STATE.mode==='full') {
        // allow full if explicitly set; otherwise keep as chosen
      }

      // stable-ish session id: game + study + seed + random
      const base = `${STATE.game}-${STATE.studyId||'na'}-${STATE.seed||Date.now()}`;
      STATE.sessionId = String(qs('sid','') || '') || makeId(base);

      loadQ();

      // capture common events
      const capture = [
        'hha:start','hha:end','hha:score','hha:time','hha:coach','hha:judge','hha:celebrate',
        'quest:update','hha:shoot','gj:measureSafe','hha:recenter'
      ];
      capture.forEach((evt)=>{
        try{
          WIN.addEventListener(evt, (e)=>{
            push(evt, (e && e.detail) ? e.detail : null);
          }, { passive:true });
        }catch{}
      });

      // errors
      try{
        WIN.addEventListener('error', (e)=>{
          push('error', {
            type:'error',
            msg: String(e && e.message || 'error'),
            src: (STATE.mode==='full') ? String(e && e.filename || '') : undefined,
            line: (STATE.mode==='full') ? Number(e && e.lineno || 0) : undefined,
            col: (STATE.mode==='full') ? Number(e && e.colno || 0) : undefined,
          });
          flush('error');
        });
      }catch{}
      try{
        WIN.addEventListener('unhandledrejection', (e)=>{
          push('error:unhandledrejection', { type:'unhandledrejection', msg: String(e && e.reason || 'rejection') });
          flush('unhandledrejection');
        });
      }catch{}

      // flush-hardened
      const hardFlush = (why)=>{ flush(why); };
      try{ DOC.addEventListener('visibilitychange', ()=>{ if (DOC.visibilityState==='hidden') hardFlush('hidden'); }, { passive:true }); }catch{}
      try{ WIN.addEventListener('pagehide', ()=> hardFlush('pagehide'), { passive:true }); }catch{}
      try{ WIN.addEventListener('beforeunload', ()=> hardFlush('beforeunload'), { passive:true }); }catch{}

      // initial marker
      push('hha:telemetry:init', { ok:true, mode: STATE.mode, hasEndpoint: !!STATE.endpoint });

      // auto periodic flush (only if endpoint)
      const autoMs = clamp(Number(qs('flushMs','')) || 5000, 1500, 30000);
      if (STATE.endpoint){
        setInterval(()=>{ flush('interval'); }, autoMs);
      }

      STATE.inited = true;
      return WIN.HHATelemetry;
    }

    return {
      init,
      event: (name, data)=>push(name, data),
      flush,
      getState: ()=>({ ...STATE, qLen: STATE.q.length })
    };
  })();

  WIN.HHATelemetry = Telemetry;

})();