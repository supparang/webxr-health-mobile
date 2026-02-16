// === /herohealth/vr/hha-cloud-logger.js ===
// HeroHealth Cloud Logger — SAFE — PRODUCTION v20260215a
// ✅ Never crashes the game (all try/catch)
// ✅ Works offline / 401 / 403: keeps queue locally and backs off
// ✅ flush-hardened: flush(reason) with timeout-friendly behavior
// ✅ Provides global:
//    - window.HHACloudLogger (instance)
//    - window.HHA_LOGGER (alias for compatibility)
//    - window.HHA_CloudLogger (compat)
// ✅ Listens to common events and logs automatically (safe):
//    hha:start, hha:score, hha:judge, hha:time, hha:features_1s, hha:labels, hha:end, hha:ai, hha:coach
//
// Endpoint rules:
// - Prefer URL param ?log=<endpoint> or ?api=<endpoint> (base)
// - If ?api is base API Gateway, will POST to `${api}/log` by default
// - You can also set window.HHA_LOG_ENDPOINT before this file loads.
//
// Storage keys:
// - HHA_LOG_QUEUE (events)
// - HHA_SESSION_META (latest session meta)
// - HHA_LOG_BACKOFF (backoff state)

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const LS_QUEUE   = 'HHA_LOG_QUEUE';
  const LS_META    = 'HHA_SESSION_META';
  const LS_BACKOFF = 'HHA_LOG_BACKOFF';

  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();

  function safeJsonParse(s, fallback){
    try{ return s ? JSON.parse(s) : fallback; }catch{ return fallback; }
  }
  function safeJsonStringify(o){
    try{ return JSON.stringify(o); }catch{ return 'null'; }
  }

  function loadQueue(){
    try{
      const q = safeJsonParse(localStorage.getItem(LS_QUEUE), []);
      return Array.isArray(q) ? q : [];
    }catch{ return []; }
  }
  function saveQueue(q){
    try{ localStorage.setItem(LS_QUEUE, safeJsonStringify(q || [])); }catch{}
  }

  function loadBackoff(){
    const def = { until:0, failN:0, lastCode:0, lastAt:0 };
    try{
      const b = safeJsonParse(localStorage.getItem(LS_BACKOFF), def);
      if(!b || typeof b !== 'object') return def;
      return Object.assign(def, b);
    }catch{ return def; }
  }
  function saveBackoff(b){
    try{ localStorage.setItem(LS_BACKOFF, safeJsonStringify(b || {})); }catch{}
  }

  function clamp(v,a,b){
    v = Number(v)||0;
    return v<a?a:(v>b?b:v);
  }

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function resolveEndpoint(){
    // Priority:
    // 1) window.HHA_LOG_ENDPOINT
    // 2) ?log=<endpoint>
    // 3) ?api=<base>  => base + '/log'
    // 4) null (disabled)
    let ep = null;

    try{
      if(typeof WIN.HHA_LOG_ENDPOINT === 'string' && WIN.HHA_LOG_ENDPOINT.trim()){
        ep = WIN.HHA_LOG_ENDPOINT.trim();
      }
    }catch{}

    if(!ep){
      const log = qs('log','');
      if(log) ep = log;
    }

    if(!ep){
      const api = qs('api','');
      if(api){
        // normalize base (no trailing slash)
        const base = String(api).replace(/\/+$/,'');
        ep = base + '/log';
      }
    }

    if(!ep) return null;

    // decode safely if needed (hub-like double encoding)
    try{
      let s = ep;
      try{ s = decodeURIComponent(s); }catch{}
      try{ if(/%2f|%3a/i.test(s)) s = decodeURIComponent(s); }catch{}
      return s;
    }catch{
      return ep;
    }
  }

  function getCtx(){
    const sp = (function(){ try{ return new URL(location.href).searchParams; }catch{ return new URLSearchParams(); } })();
    return {
      pid: sp.get('pid') || (function(){ try{ return localStorage.getItem('HHA_PID') || ''; }catch{ return ''; } })() || 'anon',
      studyId: sp.get('studyId') || '',
      phase: sp.get('phase') || '',
      conditionGroup: sp.get('conditionGroup') || '',
      run: sp.get('run') || sp.get('runMode') || 'play',
      diff: sp.get('diff') || 'normal',
      seed: sp.get('seed') || '',
      view: sp.get('view') || '',
      href: location.href
    };
  }

  function makeId(prefix){
    return `${prefix || 'HHA'}_${Date.now()}_${Math.random().toString(16).slice(2,10)}`;
  }

  // ---- Logger class ----
  class CloudLogger {
    constructor(){
      this.endpoint = resolveEndpoint();
      this.enabled = !!this.endpoint;
      this.queue = loadQueue();
      this.backoff = loadBackoff();

      this.sessionId = null;
      this.sessionMeta = safeJsonParse((function(){ try{ return localStorage.getItem(LS_META) || ''; }catch{ return ''; } })(), null);

      this._flushInFlight = false;
      this._lastEnqAt = 0;

      // auto flush opportunistically
      WIN.addEventListener('online', ()=>{ this.flush('online'); }, {passive:true});
      DOC.addEventListener('visibilitychange', ()=>{ if(DOC.hidden) this.flush('hidden'); }, {passive:true});
      WIN.addEventListener('beforeunload', ()=>{ try{ this.flush('beforeunload'); }catch{} }, {passive:true});
    }

    setEndpoint(ep){
      try{
        this.endpoint = ep ? String(ep) : null;
        this.enabled = !!this.endpoint;
      }catch{}
    }

    setSession(meta){
      // meta: {game, runMode, diff, seed, ...}
      try{
        if(!this.sessionId) this.sessionId = makeId((meta && meta.game) ? String(meta.game).toUpperCase() : 'HHA');
        this.sessionMeta = Object.assign({}, getCtx(), meta || {}, {
          sessionId: this.sessionId,
          startedAtIso: (meta && meta.startTimeIso) ? meta.startTimeIso : new Date().toISOString()
        });
        try{ localStorage.setItem(LS_META, safeJsonStringify(this.sessionMeta)); }catch{}
      }catch{}
    }

    enqueue(type, payload){
      try{
        const t = Date.now();
        this._lastEnqAt = t;

        const base = {
          t: t,
          type: String(type || 'event'),
          sessionId: this.sessionId || (this.sessionMeta && this.sessionMeta.sessionId) || null,
          ctx: getCtx()
        };

        const ev = Object.assign(base, { payload: payload || {} });

        // cap payload size (safety)
        // keep only shallow small snapshot if huge
        const s = safeJsonStringify(ev);
        if(s && s.length > 90000){
          ev.payload = { truncated:true, keys: Object.keys(payload||{}).slice(0,40) };
        }

        this.queue.push(ev);

        // cap queue length
        if(this.queue.length > 2500) this.queue.splice(0, this.queue.length - 2500);

        saveQueue(this.queue);
      }catch{}
    }

    canFlush(){
      if(!this.enabled || !this.endpoint) return false;
      const b = this.backoff || loadBackoff();
      this.backoff = b;
      return nowMs() >= (Number(b.until)||0);
    }

    nextBackoffMs(code){
      // escalating: 0.7s, 1.5s, 3s, 6s, 12s, 20s ... clamp 30s
      const n = clamp((this.backoff && this.backoff.failN) ? this.backoff.failN : 0, 0, 10);
      const base = [700,1500,3000,6000,12000,20000,26000,30000][Math.min(n,7)];
      // 401/403 often permanent unless fixed: increase but still retry slowly
      const mult = (code === 401 || code === 403) ? 2.2 : 1.0;
      return clamp(Math.round(base * mult), 700, 30000);
    }

    markFail(code){
      try{
        const b = this.backoff || loadBackoff();
        b.failN = clamp((Number(b.failN)||0) + 1, 0, 50);
        b.lastCode = Number(code)||0;
        b.lastAt = Date.now();
        const wait = this.nextBackoffMs(b.lastCode);
        b.until = nowMs() + wait;
        this.backoff = b;
        saveBackoff(b);
      }catch{}
    }

    markOk(){
      try{
        const b = this.backoff || loadBackoff();
        b.failN = 0;
        b.lastCode = 0;
        b.lastAt = Date.now();
        b.until = 0;
        this.backoff = b;
        saveBackoff(b);
      }catch{}
    }

    async flush(reason='manual'){
      try{
        if(this._flushInFlight) return { ok:false, reason:'in_flight' };
        if(!this.canFlush()) return { ok:false, reason:'backoff' };
        if(!this.queue || this.queue.length === 0) return { ok:true, reason:'empty' };

        this._flushInFlight = true;

        // prepare batch (limit 120 events per flush)
        const batchSize = Math.min(120, this.queue.length);
        const batch = this.queue.slice(0, batchSize);

        const body = {
          v: 'HHA_LOG_V1',
          reason: String(reason || 'manual'),
          sentAtIso: new Date().toISOString(),
          session: this.sessionMeta || null,
          items: batch
        };

        const ep = this.endpoint;
        if(!ep){
          this._flushInFlight = false;
          return { ok:false, reason:'no_endpoint' };
        }

        // fetch with timeout via AbortController
        let ok = false, status = 0;
        const ctrl = ('AbortController' in WIN) ? new AbortController() : null;
        const timer = setTimeout(()=>{ try{ ctrl && ctrl.abort(); }catch{} }, 2200);

        try{
          const res = await fetch(ep, {
            method:'POST',
            headers:{ 'content-type':'application/json' },
            body: safeJsonStringify(body),
            signal: ctrl ? ctrl.signal : undefined,
            keepalive: true
          });
          status = res.status || 0;
          ok = !!res.ok;
        }catch(e){
          // network / abort / CORS -> treat as fail
          ok = false;
          status = 0;
        }finally{
          try{ clearTimeout(timer); }catch{}
        }

        if(ok){
          // drop sent batch
          this.queue.splice(0, batchSize);
          saveQueue(this.queue);
          this.markOk();
          this._flushInFlight = false;
          return { ok:true, status, sent: batchSize, left: this.queue.length };
        }else{
          // keep queue, backoff
          this.markFail(status || 0);
          this._flushInFlight = false;
          return { ok:false, status, sent:0, left: this.queue.length };
        }
      }catch(e){
        try{ this._flushInFlight = false; }catch{}
        return { ok:false, reason:'exception' };
      }
    }

    // compat name used by some games
    async flushNow(opts){
      try{
        const r = (opts && opts.reason) ? opts.reason : 'manual';
        return await this.flush(r);
      }catch{
        return { ok:false };
      }
    }
  }

  // ---- create singleton ----
  const L = new CloudLogger();
  WIN.HHACloudLogger = L;
  WIN.HHA_LOGGER = L;
  WIN.HHA_CloudLogger = L;

  // ---- auto event wiring ----
  function on(evName, handler){
    try{ WIN.addEventListener(evName, handler, { passive:true }); }catch{}
  }

  function shallowCopy(d){
    try{
      if(!d || typeof d !== 'object') return d;
      // keep small snapshot
      const out = {};
      const keys = Object.keys(d);
      for(let i=0;i<keys.length && i<80;i++){
        const k = keys[i];
        const v = d[k];
        // avoid huge arrays
        if(Array.isArray(v)){
          out[k] = v.length > 40 ? v.slice(0,40) : v;
        }else if(v && typeof v === 'object'){
          // shallow only
          out[k] = Object.assign({}, v);
        }else{
          out[k] = v;
        }
      }
      return out;
    }catch{
      return d;
    }
  }

  on('hha:start', (e)=>{
    try{
      const d = e && e.detail ? e.detail : {};
      // ensure sessionId stable per run
      L.setSession({
        game: d.game || d.gameMode || 'unknown',
        runMode: d.runMode || d.run || 'play',
        diff: d.diff || 'normal',
        seed: d.seed || '',
        timePlannedSec: d.timePlannedSec || d.durationPlannedSec || 0,
        startTimeIso: d.startTimeIso || new Date().toISOString()
      });
      L.enqueue('start', shallowCopy(d));
      // flush quick if possible
      L.flush('start');
    }catch{}
  });

  on('hha:score', (e)=>{
    try{
      const d = e && e.detail ? e.detail : {};
      L.enqueue('score', shallowCopy(d));
    }catch{}
  });

  on('hha:judge', (e)=>{
    try{
      const d = e && e.detail ? e.detail : {};
      L.enqueue('judge', shallowCopy(d));
    }catch{}
  });

  on('hha:time', (e)=>{
    try{
      const d = e && e.detail ? e.detail : {};
      L.enqueue('time', shallowCopy(d));
    }catch{}
  });

  on('hha:features_1s', (e)=>{
    try{
      const d = e && e.detail ? e.detail : {};
      L.enqueue('features_1s', shallowCopy(d));
      // opportunistic flush every ~6s if queue growing
      if(L.queue.length >= 120 && L.canFlush()){
        L.flush('features_batch');
      }
    }catch{}
  });

  on('hha:labels', (e)=>{
    try{
      const d = e && e.detail ? e.detail : {};
      L.enqueue('labels', shallowCopy(d));
    }catch{}
  });

  on('hha:ai', (e)=>{
    try{
      const d = e && e.detail ? e.detail : {};
      L.enqueue('ai', shallowCopy(d));
    }catch{}
  });

  on('hha:coach', (e)=>{
    try{
      const d = e && e.detail ? e.detail : {};
      // keep coach tips but cap
      L.enqueue('coach', shallowCopy(d));
    }catch{}
  });

  on('hha:end', (e)=>{
    try{
      const d = e && e.detail ? e.detail : {};
      L.enqueue('end', shallowCopy(d));
      // flush hard at end
      L.flush('end');
    }catch{}
  });

})();