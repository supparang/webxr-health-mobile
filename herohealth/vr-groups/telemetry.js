// === /herohealth/vr-groups/telemetry.js ===
// GroupsVR Telemetry — PACK 13.95 (Production SAFE)
// ✅ Modes: full | lite | off (auto-downgrade by FPS)
// ✅ Throttle + batching + queue cap
// ✅ Flush-hardened: pagehide/visibilitychange/beforeunload
// ✅ Emits: groups:telemetry_auto {kind:'switch', from,to,fps}
// ✅ Optional endpoint: init({endpoint}) OR query param ?log=...
// Notes:
// - This is "lite" telemetry for research/play diagnostics, not a heavy analytics SDK.
// - If endpoint is absent, it keeps batches in memory (no throw).

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  WIN.GroupsVR = WIN.GroupsVR || {};
  if (WIN.GroupsVR.Telemetry) return;

  // -----------------------------
  // Utils
  // -----------------------------
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function safeJson(obj){
    try{ return JSON.stringify(obj); }catch(_){ return '{"_err":"json"}'; }
  }

  function fire(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name,{ detail })); }catch(_){}
  }

  // -----------------------------
  // FPS monitor
  // -----------------------------
  const FPS = {
    ok: false,
    t0: 0,
    frames: 0,
    fps: 60,
    last: 60
  };

  function startFps(){
    if (FPS.ok) return;
    FPS.ok = true;
    FPS.t0 = nowMs();
    FPS.frames = 0;

    function raf(){
      FPS.frames++;
      const t = nowMs();
      const dt = t - FPS.t0;
      if (dt >= 1000){
        const f = Math.round((FPS.frames * 1000) / dt);
        FPS.last = FPS.fps;
        FPS.fps = clamp(f, 1, 120);
        FPS.frames = 0;
        FPS.t0 = t;
      }
      WIN.requestAnimationFrame(raf);
    }
    WIN.requestAnimationFrame(raf);
  }

  // -----------------------------
  // Telemetry core
  // -----------------------------
  const STATE = {
    inited: false,
    runMode: 'play',  // play|research|practice
    endpoint: '',
    mode: 'lite',     // full|lite|off
    // batching
    flushEveryMs: 2000,
    maxEventsPerBatch: 60,
    maxQueueBatches: 16,
    statusEveryMs: 900,
    // queue
    cur: [],
    q: [],
    // throttle map
    lastAt: Object.create(null),
    // in-memory sink (if no endpoint)
    memoryBatches: [],
    // timers
    tFlush: 0,
    tStatus: 0,
    // auto switch
    auto: {
      enabled: true,
      minFullFps: 46,
      minLiteFps: 28,
      holdMs: 2200,
      lastSwitchAt: 0,
      downCount: 0
    }
  };

  function setMode(to, why){
    const from = STATE.mode;
    if (to === from) return;

    STATE.mode = to;
    STATE.auto.lastSwitchAt = nowMs();

    fire('groups:telemetry_auto', {
      kind:'switch',
      from,
      to,
      fps: FPS.fps,
      why: String(why||'')
    });
  }

  function decideModeByRunMode(runMode){
    // research/practice should be conservative by default
    if (runMode === 'practice') return 'off';
    if (runMode === 'research') return 'lite'; // not full (avoid load)
    return 'lite';
  }

  function decideAuto(){
    if (!STATE.auto.enabled) return;

    const t = nowMs();
    if (t - STATE.auto.lastSwitchAt < STATE.auto.holdMs) return;

    const fps = FPS.fps;

    // downgrade thresholds
    if (STATE.mode === 'full' && fps < STATE.auto.minFullFps){
      setMode('lite', 'fps_low_full');
      STATE.auto.downCount++;
      return;
    }
    if ((STATE.mode === 'full' || STATE.mode === 'lite') && fps < STATE.auto.minLiteFps){
      setMode('off', 'fps_low_lite');
      STATE.auto.downCount++;
      return;
    }

    // gentle upgrade (only if play)
    if (STATE.runMode === 'play'){
      if (STATE.mode === 'off' && fps > (STATE.auto.minLiteFps + 8)){
        setMode('lite', 'fps_recover');
        return;
      }
      if (STATE.mode === 'lite' && fps > (STATE.auto.minFullFps + 6)){
        // optional: allow full in play only
        setMode('full', 'fps_good');
        return;
      }
    }
  }

  function normalizeEvent(ev){
    const base = {
      t: Date.now(),
      ms: Math.round(nowMs()),
      fps: FPS.fps,
      runMode: STATE.runMode,
      view: String(qs('view','')||''),
      diff: String(qs('diff','')||''),
      seed: String(qs('seed','')||''),
      game: 'GroupsVR'
    };
    return Object.assign(base, ev||{});
  }

  function shouldDrop(name){
    // lite mode allows only essential events
    if (STATE.mode === 'off') return true;
    if (STATE.mode === 'full') return false;

    // lite allowlist
    const allow = {
      'start':1,
      'end':1,
      'score':1,
      'rank':1,
      'quest':1,
      'progress':1,
      'ai_predict':1,
      'telemetry':1,
      'warn':1,
      'err':1,
    };
    return !allow[String(name||'')];
  }

  function throttle(key, ms){
    const k = String(key||'');
    const t = nowMs();
    const last = Number(STATE.lastAt[k]||0);
    if (t - last < ms) return false;
    STATE.lastAt[k] = t;
    return true;
  }

  function push(ev){
    if (!STATE.inited) return;
    if (STATE.mode === 'off') return;

    const name = String(ev && ev.name || '');
    if (shouldDrop(name)) return;

    STATE.cur.push(normalizeEvent(ev));
    if (STATE.cur.length >= STATE.maxEventsPerBatch){
      rotateBatch('max');
    }
  }

  function rotateBatch(reason){
    if (!STATE.cur.length) return;

    const batch = {
      reason: String(reason||'tick'),
      createdAt: Date.now(),
      mode: STATE.mode,
      runMode: STATE.runMode,
      items: STATE.cur
    };
    STATE.cur = [];

    STATE.q.push(batch);
    if (STATE.q.length > STATE.maxQueueBatches){
      // drop oldest
      STATE.q.shift();
      push({ name:'warn', kind:'queue_drop', msg:'telemetry queue overflow -> drop oldest' });
    }
  }

  async function postBatch(endpoint, batch){
    // Silent failure — never break game
    try{
      const ctrl = new AbortController();
      const to = setTimeout(()=>ctrl.abort(), 4500);

      const res = await fetch(endpoint, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body: safeJson(batch),
        signal: ctrl.signal,
        keepalive: true
      });

      clearTimeout(to);
      return !!res && (res.ok || (res.status>=200 && res.status<300));
    }catch(_){
      return false;
    }
  }

  async function flush(reason){
    if (!STATE.inited) return;

    rotateBatch(reason||'flush');

    if (!STATE.q.length) return;

    const endpoint = String(STATE.endpoint||'');
    if (!endpoint){
      // store in memory only
      try{
        const take = STATE.q.splice(0, STATE.q.length);
        STATE.memoryBatches.push(...take);
        // cap memory
        if (STATE.memoryBatches.length > 24) STATE.memoryBatches.splice(0, STATE.memoryBatches.length - 24);
      }catch(_){}
      return;
    }

    // send sequentially (avoid parallel spam)
    const sendMax = 3; // limited per flush
    let sent = 0;

    while (STATE.q.length && sent < sendMax){
      const b = STATE.q[0];
      const ok = await postBatch(endpoint, b);
      if (!ok) break;
      STATE.q.shift();
      sent++;
    }
  }

  function bootTimers(){
    clearInterval(STATE.tFlush);
    clearInterval(STATE.tStatus);

    STATE.tFlush = setInterval(()=> flush('tick'), clamp(STATE.flushEveryMs, 600, 8000));
    STATE.tStatus = setInterval(()=>{
      decideAuto();
      // (optional) low rate status event
      if (STATE.mode !== 'off' && throttle('status', clamp(STATE.statusEveryMs, 500, 2000))){
        push({ name:'telemetry', kind:'status', mode: STATE.mode, q: STATE.q.length, cur: STATE.cur.length, fps: FPS.fps });
      }
    }, clamp(STATE.statusEveryMs, 550, 1600));
  }

  // -----------------------------
  // Flush-hardened
  // -----------------------------
  let leaving = false;

  async function hardFlush(tag){
    if (leaving) return;
    leaving = true;
    try{ await flush(tag||'leave'); }catch(_){}
    leaving = false;
  }

  function bindFlushOnLeave(getSummaryFn){
    // Public hook: caller can provide lastSummary getter and we include it once
    try{
      if (typeof getSummaryFn === 'function'){
        // push summary snapshot once on leave
        const fn = ()=>{
          try{
            const s = getSummaryFn();
            if (s) push({ name:'end', kind:'summary_snapshot', summary: s });
          }catch(_){}
        };

        WIN.addEventListener('pagehide', fn, { passive:true });
        WIN.addEventListener('beforeunload', fn, { passive:true });
      }
    }catch(_){}
  }

  WIN.addEventListener('pagehide', ()=> hardFlush('pagehide'), { passive:true });
  WIN.addEventListener('visibilitychange', ()=>{
    if (DOC.visibilityState === 'hidden') hardFlush('hidden');
  }, { passive:true });
  WIN.addEventListener('beforeunload', ()=> hardFlush('beforeunload'), { passive:true });

  // -----------------------------
  // Public API
  // -----------------------------
  function init(cfg){
    cfg = cfg || {};
    startFps();

    const runMode = String(cfg.runMode || 'play');
    STATE.runMode = runMode;

    // endpoint priority: cfg.endpoint > ?log= > ''
    const qlog = String(qs('log','')||'');
    STATE.endpoint = String(cfg.endpoint || qlog || '');

    STATE.flushEveryMs = clamp(cfg.flushEveryMs ?? 2000, 600, 9000);
    STATE.maxEventsPerBatch = clamp(cfg.maxEventsPerBatch ?? 60, 20, 200);
    STATE.maxQueueBatches = clamp(cfg.maxQueueBatches ?? 16, 6, 80);
    STATE.statusEveryMs = clamp(cfg.statusEveryMs ?? 850, 550, 2000);

    // choose initial mode
    STATE.mode = decideModeByRunMode(runMode);

    // auto in research/practice = still allowed to downgrade; upgrades only for play
    STATE.auto.enabled = true;
    STATE.auto.lastSwitchAt = nowMs();

    STATE.inited = true;
    bootTimers();

    push({ name:'start', kind:'telemetry_init', mode: STATE.mode, endpoint: STATE.endpoint ? 1 : 0 });
    fire('groups:telemetry_auto', { kind:'ready', to: STATE.mode, fps: FPS.fps });
  }

  function emit(name, detail, opt){
    if (!STATE.inited) return;
    name = String(name||'');
    detail = detail || {};
    opt = opt || {};

    // per-event throttle (caller can pass)
    const thKey = opt.thKey || name;
    const thMs  = Number(opt.thMs||0);
    if (thMs > 0 && !throttle('ev:'+thKey, thMs)) return;

    push(Object.assign({ name }, detail));
  }

  function setManualMode(mode){
    // manual override (still may auto-down on severe fps)
    const to = String(mode||'').toLowerCase();
    if (!to) return;
    if (to !== 'full' && to !== 'lite' && to !== 'off') return;
    setMode(to, 'manual');
  }

  function getStatus(){
    return {
      inited: STATE.inited,
      mode: STATE.mode,
      runMode: STATE.runMode,
      endpoint: !!STATE.endpoint,
      qBatches: STATE.q.length,
      curEvents: STATE.cur.length,
      memBatches: STATE.memoryBatches.length,
      fps: FPS.fps
    };
  }

  function getMemoryBatches(){
    // copy (safe)
    try{ return JSON.parse(JSON.stringify(STATE.memoryBatches)); }catch(_){ return []; }
  }

  // expose
  WIN.GroupsVR.Telemetry = {
    init,
    emit,
    flush,
    hardFlush,
    bindFlushOnLeave,
    setMode: setManualMode,
    getStatus,
    getMemoryBatches
  };

})();