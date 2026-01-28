// === /herohealth/vr-groups/telemetry.js ===
// GroupsVR Telemetry (PACK 14.5) — PRODUCTION v4.2
// ✅ Modes: off | lite | full (persist LS + ?telemetry=off|lite|full)
// ✅ Gated: research/practice => OFF hard
// ✅ Throttle + batch send + localStorage queue
// ✅ Flush-hardened: pagehide/hidden/freeze/beforeunload => flushNow()
// ✅ Recovery: keep unsent batches, resend on next load/online
// ✅ Sampling for FULL-heavy events + override: ?teleSample=spawn:0.2,hit:0.25,expire:0.15,judge:0.3
// ✅ Status heartbeat event: groups:telemetry_status
// ✅ PACK 13.95: Auto-downgrade by FPS (FULL→LITE→OFF)
// ✅ PACK 14.5: Smart Throttle + Adaptive Sampling + Backpressure
//    - If queue grows or recent sends fail => auto reduce sampling + increase throttle
//    - If queue is huge => clamp FULL-heavy events harder; may force mode down (optional)
//    - Keeps gameplay smooth & prevents “queue explosion”

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  if (NS.__TELEMETRY_LOADED__) return;
  NS.__TELEMETRY_LOADED__ = true;

  // ---------------- utils ----------------
  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function isoNow(){ try{ return new Date().toISOString(); }catch{ return String(Date.now()); } }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function safeJson(x, fb){ try{ return JSON.stringify(x); }catch{ return fb; } }
  function safeParse(s, fb){ try{ return JSON.parse(s); }catch{ return fb; } }

  function endpointFromParams(){
    const u = String(qs('log','')||'').trim();
    return u ? u : '';
  }

  // stable hash for deterministic sampling (no Math.random)
  function hashSeed(str) {
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function frac01(u32){ return (u32 >>> 0) / 4294967296; }

  // ---------------- storage keys ----------------
  const LS_MODE  = 'HHA_TELEMETRY_MODE_GroupsVR';
  const LS_QUEUE = 'HHA_TELEMETRY_QUEUE_GroupsVR';
  const LS_SEQ   = 'HHA_TELEMETRY_SEQ_GroupsVR';
  const LS_ADAPT = 'HHA_TELEMETRY_ADAPT_GroupsVR'; // store adaptive state snapshot (optional)

  // ---------------- state ----------------
  const Telemetry = NS.Telemetry = NS.Telemetry || {};
  let CFG = {
    enabled: false,
    mode: 'off',                 // off|lite|full
    runMode: 'play',             // play|research|practice
    endpoint: '',
    flushEveryMs: 2000,
    maxEventsPerBatch: 60,
    maxQueueBatches: 16,         // stored in LS
    throttleBase: {              // base throttle (ms)
      'hha:score': 600,
      'hha:rank': 800,
      'quest:update': 900,
      'groups:power': 900,
      'groups:progress': 250,
      'groups:ai_predict': 800,

      // FULL-heavy
      'groups:spawn': 120,
      'groups:hit': 80,
      'groups:expire': 160,
      'hha:judge': 80
    },
    sampleBase: {                // base sample rate
      'groups:spawn': 0.22,
      'groups:hit': 0.30,
      'groups:expire': 0.18,
      'hha:judge': 0.35
    },
    statusEveryMs: 850,

    // ✅ PACK 13.95: auto downgrade (fps)
    auto: {
      enabled: true,
      fpsLow: 42,
      fpsHard: 28,
      holdMs: 2600,
      holdMsHard: 2600,
      cooldownMs: 9000,
      sampleWindowMs: 1000,
      warnEveryMs: 1200
    },

    // ✅ PACK 14.5: adaptive backpressure
    adapt: {
      enabled: true,             // disable: ?teleAdapt=0
      evalEveryMs: 1200,
      // queue thresholds
      qWarnBatches: 6,
      qWarnEvents: 220,
      qHighBatches: 10,
      qHighEvents: 380,
      qCriticalBatches: 14,
      qCriticalEvents: 520,

      // if last send fails and stays failing
      failGraceMs: 2600,         // ignore brief fails
      failHighMs: 6500,          // persistent fail => stronger clamp

      // how hard to clamp
      maxThrottleMul: 3.2,       // throttle multiplier upper bound
      minSampleMul: 0.18,        // sample multiplier lower bound

      // optional mode pressure (keeps it playable)
      allowModeClamp: true,      // can force full->lite / lite->off when critical
      allowModeRecover: true,    // can recover (off->lite->full) if healthy (only if user didn't pin ?telemetry=)
      recoverStableMs: 12000,    // healthy window to recover
      recoverStepMs: 7000,       // step-up interval

      // when queue is huge, increase flush interval a bit to reduce contention
      flushEveryMulMax: 1.8
    }
  };

  let _batch = [];
  let _flushIt = 0;
  let _statusIt = 0;
  let _adaptIt = 0;
  let _inFlight = false;
  let _lastEventAt = Object.create(null);
  let _seq = loadSeq();
  let _installed = false;
  let _eventsAttached = false;

  let _sampleCounter = Object.create(null);

  // status
  let _lastSentAt = 0;
  let _lastFailAt = 0;
  let _lastSendResult = 'idle';
  let _lastStatus = null;

  // optional HUD hook callback
  let _hudHook = null;

  // auto downgrade runtime
  let _fpsRaf = 0;
  let _fpsFrames = 0;
  let _fpsT0 = 0;
  let _fpsAvg = 60;
  let _lowStart = 0;
  let _hardStart = 0;
  let _lastAutoSwitchAt = 0;
  let _lastAutoWarnAt = 0;

  // ✅ adapt runtime (PACK 14.5)
  let ADAPT = {
    // current multipliers (applied on top of base)
    throttleMul: 1.0,
    sampleMul: 1.0,
    flushEveryMul: 1.0,

    // queue health
    pressure: 0, // 0 ok, 1 warn, 2 high, 3 critical
    lastEvalAt: 0,

    // failure health
    failing: false,
    failSince: 0,

    // mode clamp state
    pinnedByQuery: false,
    lastModeStepAt: 0,
    healthySince: 0
  };

  // computed derived maps (throttle/sample)
  let THROTTLE = Object.assign({}, CFG.throttleBase);
  let SAMPLE   = Object.assign({}, CFG.sampleBase);

  // ---------------- public API ----------------
  Telemetry.init = function init(opt){
    opt = opt || {};

    const rm = String(opt.runMode || qs('run','play') || 'play').toLowerCase();
    CFG.runMode = (rm === 'research') ? 'research' : (rm === 'practice' ? 'practice' : 'play');

    CFG.endpoint = String(opt.endpoint || endpointFromParams() || '');
    CFG.flushEveryMs = clamp(opt.flushEveryMs ?? CFG.flushEveryMs, 600, 6000);
    CFG.maxEventsPerBatch = clamp(opt.maxEventsPerBatch ?? CFG.maxEventsPerBatch, 20, 120);
    CFG.maxQueueBatches = clamp(opt.maxQueueBatches ?? CFG.maxQueueBatches, 6, 30);
    CFG.statusEveryMs = clamp(opt.statusEveryMs ?? CFG.statusEveryMs, 350, 2500);

    applySampleOverrideFromQuery();
    applyAutoOverrideFromQuery();
    applyAdaptOverrideFromQuery();

    // mode resolution + detect pinned mode
    let mode = 'lite';
    const q  = String(qs('telemetry','')||'').toLowerCase().trim();
    const ls = String(loadMode()||'').toLowerCase().trim();

    ADAPT.pinnedByQuery = (q === 'off' || q === 'lite' || q === 'full');

    if (q === 'off' || q === 'lite' || q === 'full') mode = q;
    else if (ls === 'off' || ls === 'lite' || ls === 'full') mode = ls;

    if (CFG.runMode !== 'play') mode = 'off';
    setModeInternal(mode, true);

    resetAdaptState();
    recomputeDerivedMaps();

    attachEventListeners();
    tryResendQueue();
    startTimer();
    startStatusHeartbeat();
    installLeaveFlush();

    if (CFG.runMode === 'play' && CFG.auto.enabled) startFpsMonitor();
    if (CFG.runMode === 'play' && CFG.adapt.enabled) startAdaptLoop();

    return true;
  };

  Telemetry.setMode = function setMode(mode){
    mode = String(mode||'').toLowerCase();
    if (!(mode === 'off' || mode === 'lite' || mode === 'full')) mode = 'lite';
    if (CFG.runMode !== 'play') mode = 'off';
    // manual set => consider pinned (user intent)
    ADAPT.pinnedByQuery = true;
    setModeInternal(mode, false);
  };

  Telemetry.getMode = function getMode(){ return CFG.mode; };

  Telemetry.getConfig = function getConfig(){
    return {
      enabled: !!CFG.enabled,
      mode: CFG.mode,
      runMode: CFG.runMode,
      endpoint: CFG.endpoint,
      flushEveryMs: CFG.flushEveryMs,
      maxEventsPerBatch: CFG.maxEventsPerBatch,
      maxQueueBatches: CFG.maxQueueBatches,
      sampleBase: Object.assign({}, CFG.sampleBase),
      throttleBase: Object.assign({}, CFG.throttleBase),
      sampleNow: Object.assign({}, SAMPLE),
      throttleNow: Object.assign({}, THROTTLE),
      statusEveryMs: CFG.statusEveryMs,
      auto: Object.assign({}, CFG.auto),
      adapt: Object.assign({}, CFG.adapt),
      adaptState: Object.assign({}, ADAPT)
    };
  };

  Telemetry.setHudHook = function setHudHook(fn){
    _hudHook = (typeof fn === 'function') ? fn : null;
  };

  Telemetry.getLastStatus = function getLastStatus(){ return _lastStatus; };

  Telemetry.getQueueBatches = function getQueueBatches(){ return loadQueue(); };

  Telemetry.getQueueSize = function getQueueSize(){
    const q = loadQueue();
    let ev = 0;
    for (const b of q) ev += (b && b.events && b.events.length) ? b.events.length : 0;
    return { batches: q.length, events: ev };
  };

  Telemetry.clearQueue = function clearQueue(){
    try { localStorage.removeItem(LS_QUEUE); } catch {}
    publishStatus('clear_queue');
    return true;
  };

  Telemetry.exportPending = function exportPending(){
    const q = loadQueue();
    let ev = 0;
    for (const b of q) ev += (b && b.events && b.events.length) ? b.events.length : 0;

    const payload = {
      exportedAt: isoNow(),
      gameTag: 'GroupsVR',
      runMode: CFG.runMode,
      mode: CFG.mode,
      endpoint: CFG.endpoint,
      sampleNow: Object.assign({}, SAMPLE),
      throttleNow: Object.assign({}, THROTTLE),
      adaptState: Object.assign({}, ADAPT),
      auto: Object.assign({}, CFG.auto),
      pending: { batches: q.length, events: ev },
      queueBatches: q
    };
    return safeJson(payload, '{"error":"export_failed"}');
  };

  Telemetry.resendNow = async function resendNow(){
    if (_batch.length) packBatch('manual');
    const r = await sendQueued('manual');
    publishStatus('manual');
    return r;
  };

  Telemetry.push = function push(name, detail, level){
    if (!CFG.enabled) return false;

    name = String(name||'evt');
    const t = nowMs();

    if (CFG.mode === 'lite' && level === 'full') return false;

    // sampling for FULL-heavy
    if (level === 'full' && CFG.mode === 'full') {
      const rate = Number(SAMPLE[name]);
      if (isFinite(rate)) {
        if (!shouldSample(name, clamp(rate, 0, 1))) return false;
      }
    }

    // throttle
    const thr  = Number(THROTTLE[name] ?? 0) || 0;
    const last = Number(_lastEventAt[name] || 0) || 0;
    if (thr > 0 && (t - last) < thr) return false;
    _lastEventAt[name] = t;

    const d = sanitizeDetail(detail);
    _batch.push({ t: Math.round(t), name, d });

    if (_batch.length >= CFG.maxEventsPerBatch) {
      flushSoon('batch_full');
    }
    return true;
  };

  Telemetry.flushNow = async function flushNow(reason){
    reason = String(reason||'flush');
    packBatch(reason);
    const r = await sendQueued('flushNow');
    publishStatus('flushNow');
    return r;
  };

  // ---------------- internal helpers ----------------
  function sanitizeDetail(detail){
    if (detail == null) return null;
    const t = typeof detail;
    if (t === 'string') return (detail.length > 240) ? detail.slice(0,240) : detail;
    if (t === 'number' || t === 'boolean') return detail;
    if (t === 'object') {
      const out = Array.isArray(detail) ? detail.slice(0, 12) : {};
      if (!Array.isArray(detail)) {
        const keys = Object.keys(detail).slice(0, 24);
        for (const k of keys) {
          const v = detail[k];
          const tv = typeof v;
          if (tv === 'function') continue;
          if (tv === 'string') out[k] = (v.length > 180) ? v.slice(0,180) : v;
          else if (tv === 'number' || tv === 'boolean' || v == null) out[k] = v;
          else if (tv === 'object') out[k] = '[obj]';
          else out[k] = String(v);
        }
      }
      return out;
    }
    return String(detail);
  }

  function loadMode(){
    try { return localStorage.getItem(LS_MODE); } catch { return null; }
  }
  function saveMode(mode){
    try { localStorage.setItem(LS_MODE, String(mode)); } catch {}
  }

  function loadSeq(){
    try { return Number(localStorage.getItem(LS_SEQ)||'0')||0; } catch { return 0; }
  }
  function bumpSeq(){
    _seq = (_seq|0) + 1;
    try { localStorage.setItem(LS_SEQ, String(_seq)); } catch {}
    return _seq;
  }

  function loadQueue(){
    try {
      const s = localStorage.getItem(LS_QUEUE);
      const q = safeParse(s||'[]', []);
      return Array.isArray(q) ? q : [];
    } catch { return []; }
  }
  function saveQueue(q){
    try { localStorage.setItem(LS_QUEUE, safeJson(q, '[]')); } catch {}
  }

  function saveAdaptSnapshot(){
    try { localStorage.setItem(LS_ADAPT, safeJson(ADAPT, '{}')); } catch {}
  }

  function setModeInternal(mode, silent){
    CFG.mode = mode;
    CFG.enabled = (mode !== 'off' && CFG.runMode === 'play');
    saveMode(mode);

    if (!silent) publishStatus('mode_change');

    try { root.dispatchEvent(new CustomEvent('groups:telemetry_mode', { detail:{ mode } })); } catch (_) {}
  }

  function packBatch(reason){
    if (!_batch.length) return;

    const seq  = bumpSeq();
    const seed = String(qs('seed','')||'');
    const diff = String(qs('diff','')||'');
    const view = String(qs('view','')||'');
    const style= String(qs('style','')||'');

    const batch = {
      v: 42,
      kind: 'telemetry',
      gameTag: 'GroupsVR',
      runMode: CFG.runMode,
      mode: CFG.mode,
      reason: String(reason||'tick'),
      ts: isoNow(),
      seq,
      meta: { seed, diff, view, style, url: String(location.href||''), fpsAvg: Math.round(_fpsAvg) },
      adapt: Object.assign({}, ADAPT),
      sampleNow: Object.assign({}, SAMPLE),
      throttleNow: Object.assign({}, THROTTLE),
      events: _batch.splice(0, _batch.length)
    };

    const q = loadQueue();
    q.push(batch);
    while (q.length > CFG.maxQueueBatches) q.shift();
    saveQueue(q);
  }

  function flushSoon(reason){
    packBatch(reason || 'soon');
    sendQueued('flushSoon').catch(()=>{});
    publishStatus('flushSoon');
  }

  async function sendQueued(reason){
    if (_inFlight) return { ok:false, reason:'in_flight' };
    if (!CFG.endpoint) return { ok:false, reason:'no_endpoint' };

    const q = loadQueue();
    if (!q.length) return { ok:true, reason:'empty' };

    _inFlight = true;
    const maxSend = 2;
    let sent = 0;

    try{
      for (let i = 0; i < Math.min(maxSend, q.length); i++){
        const b = q[i];
        const ok = await sendOne(CFG.endpoint, b);
        if (!ok) break;
        sent++;
      }
    } finally {
      _inFlight = false;
    }

    if (sent > 0){
      _lastSentAt = nowMs();
      _lastSendResult = 'ok';
      const nq = loadQueue().slice(sent);
      saveQueue(nq);
    } else {
      _lastFailAt = nowMs();
      _lastSendResult = 'fail';
    }

    return { ok: sent>0, sent, reason: String(reason||'send') };
  }

  async function sendOne(endpoint, batch){
    const body = safeJson(batch, null);
    if (!body) return false;

    let ok = false;
    try{
      if (navigator && typeof navigator.sendBeacon === 'function') {
        ok = navigator.sendBeacon(endpoint, new Blob([body], { type:'application/json' }));
      }
    }catch(_){}

    if (!ok){
      try{
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type':'application/json' },
          body,
          keepalive: true,
          mode: 'no-cors'
        });
        ok = !!res;
      }catch(_){
        ok = false;
      }
    }
    return ok;
  }

  function startTimer(){
    clearInterval(_flushIt);
    _flushIt = setInterval(()=>{
      if (!CFG.enabled) { publishStatus('tick_off'); return; }
      if (_batch.length) packBatch('tick');
      sendQueued('tick').catch(()=>{});
      publishStatus('tick');
    }, Math.round(CFG.flushEveryMs * ADAPT.flushEveryMul));
  }

  function tryResendQueue(){
    if (!CFG.endpoint) return;
    sendQueued('init').catch(()=>{});
    publishStatus('init');
  }

  // ---------------- sampling ----------------
  function shouldSample(name, rate01){
    if (rate01 <= 0) return false;
    if (rate01 >= 1) return true;

    const key = String(name||'evt');
    const c = (_sampleCounter[key] = ((_sampleCounter[key]||0) + 1));
    const seed = String(qs('seed','')||'') + '::tele' + '::' + key + '::' + String(c);
    const u = hashSeed(seed);
    return (frac01(u) < rate01);
  }

  function applySampleOverrideFromQuery(){
    const s = String(qs('teleSample','')||'').trim();
    if (!s) return;

    const map = {
      spawn: 'groups:spawn',
      hit: 'groups:hit',
      expire: 'groups:expire',
      judge: 'hha:judge'
    };

    const parts = s.split(',');
    for (const p of parts){
      const t = p.split(':');
      if (t.length !== 2) continue;
      const k = String(t[0]||'').trim().toLowerCase();
      const v = clamp(t[1], 0, 1);
      const evt = map[k] || '';
      if (evt) CFG.sampleBase[evt] = v;
    }
  }

  // ---------------- auto downgrade (PACK 13.95) ----------------
  function applyAutoOverrideFromQuery(){
    const a = String(qs('teleAuto','')||'').trim();
    if (a === '0' || a === 'false') CFG.auto.enabled = false;

    const fps = qs('teleFps', null);
    if (fps != null) CFG.auto.fpsLow = clamp(fps, 30, 58);

    const fpsH = qs('teleFpsHard', null);
    if (fpsH != null) CFG.auto.fpsHard = clamp(fpsH, 18, 40);
  }

  // ---------------- adapt (PACK 14.5) ----------------
  function applyAdaptOverrideFromQuery(){
    const a = String(qs('teleAdapt','')||'').trim();
    if (a === '0' || a === 'false') CFG.adapt.enabled = false;
  }

  function resetAdaptState(){
    ADAPT.throttleMul = 1.0;
    ADAPT.sampleMul = 1.0;
    ADAPT.flushEveryMul = 1.0;
    ADAPT.pressure = 0;
    ADAPT.lastEvalAt = 0;
    ADAPT.failing = false;
    ADAPT.failSince = 0;
    ADAPT.lastModeStepAt = 0;
    ADAPT.healthySince = 0;
  }

  function recomputeDerivedMaps(){
    // throttle = base * mul, clamp to safe range
    THROTTLE = Object.assign({}, CFG.throttleBase);
    for (const k of Object.keys(THROTTLE)){
      const base = Number(CFG.throttleBase[k]||0);
      THROTTLE[k] = Math.round(clamp(base * ADAPT.throttleMul, Math.max(10, base), base * CFG.adapt.maxThrottleMul));
    }

    // sample = base * mul, clamp
    SAMPLE = Object.assign({}, CFG.sampleBase);
    for (const k of Object.keys(SAMPLE)){
      const base = clamp(CFG.sampleBase[k], 0, 1);
      const v = clamp(base * ADAPT.sampleMul, 0, 1);
      // do not go below minSampleMul unless already tiny
      const minv = clamp(base * CFG.adapt.minSampleMul, 0, 1);
      SAMPLE[k] = clamp(v, Math.min(base, minv), 1);
    }

    // flushEvery multiplier
    ADAPT.flushEveryMul = clamp(ADAPT.flushEveryMul, 1.0, CFG.adapt.flushEveryMulMax);
    startTimer(); // re-arm timer with new interval
    saveAdaptSnapshot();
  }

  function queueCounts(){
    const q = loadQueue();
    let ev = 0;
    for (const b of q) ev += (b && b.events && b.events.length) ? b.events.length : 0;
    return { batches:q.length, events:ev };
  }

  function computePressure(q){
    const A = CFG.adapt;
    if (q.batches >= A.qCriticalBatches || q.events >= A.qCriticalEvents) return 3;
    if (q.batches >= A.qHighBatches     || q.events >= A.qHighEvents)     return 2;
    if (q.batches >= A.qWarnBatches     || q.events >= A.qWarnEvents)     return 1;
    return 0;
  }

  function startAdaptLoop(){
    clearInterval(_adaptIt);
    _adaptIt = setInterval(()=> adaptTick(), CFG.adapt.evalEveryMs);
  }

  function adaptTick(){
    if (!CFG.adapt.enabled) return;
    if (CFG.runMode !== 'play') return;
    if (CFG.mode === 'off') return; // already minimal

    const t = nowMs();
    const q = queueCounts();

    // detect failing state
    const failingNow = (_lastSendResult === 'fail' && _lastFailAt && (t - _lastFailAt) < 5000);
    if (failingNow) {
      if (!ADAPT.failing) { ADAPT.failing = true; ADAPT.failSince = t; }
    } else {
      ADAPT.failing = false;
      ADAPT.failSince = 0;
    }

    const p = computePressure(q);
    ADAPT.pressure = p;

    // adjust multipliers by pressure + failure persistence
    const A = CFG.adapt;
    let thrMul = 1.0;
    let samMul = 1.0;
    let flMul  = 1.0;

    if (p === 1) { thrMul = 1.25; samMul = 0.78; flMul = 1.05; }
    if (p === 2) { thrMul = 1.65; samMul = 0.55; flMul = 1.18; }
    if (p === 3) { thrMul = 2.35; samMul = 0.35; flMul = 1.35; }

    // persistent failures => stronger clamp
    if (ADAPT.failing && ADAPT.failSince){
      const dur = t - ADAPT.failSince;
      if (dur > A.failGraceMs) {
        thrMul = Math.max(thrMul, 2.0);
        samMul = Math.min(samMul, 0.45);
        flMul  = Math.max(flMul, 1.25);
      }
      if (dur > A.failHighMs) {
        thrMul = Math.max(thrMul, 2.8);
        samMul = Math.min(samMul, 0.28);
        flMul  = Math.max(flMul, 1.45);
      }
    }

    // apply
    const changed =
      (Math.abs(ADAPT.throttleMul - thrMul) > 0.05) ||
      (Math.abs(ADAPT.sampleMul - samMul) > 0.05) ||
      (Math.abs(ADAPT.flushEveryMul - flMul) > 0.05);

    ADAPT.throttleMul = clamp(thrMul, 1.0, A.maxThrottleMul);
    ADAPT.sampleMul   = clamp(samMul, 0.05, 1.0);
    ADAPT.flushEveryMul = clamp(flMul, 1.0, A.flushEveryMulMax);

    if (changed) {
      recomputeDerivedMaps();
      try{
        root.dispatchEvent(new CustomEvent('groups:telemetry_adapt', {
          detail:{
            kind:'adapt',
            pressure:p,
            qBatches:q.batches, qEvents:q.events,
            failing:!!ADAPT.failing,
            thrMul:Math.round(ADAPT.throttleMul*100)/100,
            samMul:Math.round(ADAPT.sampleMul*100)/100,
            flMul:Math.round(ADAPT.flushEveryMul*100)/100
          }
        }));
      }catch(_){}
    }

    // optional mode clamp on critical
    if (A.allowModeClamp && !ADAPT.pinnedByQuery) {
      if (p >= 3 || (ADAPT.failing && ADAPT.failSince && (t - ADAPT.failSince) > A.failHighMs)) {
        // step down mode
        if (!ADAPT.lastModeStepAt || (t - ADAPT.lastModeStepAt) > 1800) {
          ADAPT.lastModeStepAt = t;
          if (CFG.mode === 'full') {
            setModeInternal('lite', false);
            announceAuto('mode_clamp', 'full_to_lite', q, p);
          } else if (CFG.mode === 'lite') {
            setModeInternal('off', false);
            announceAuto('mode_clamp', 'lite_to_off', q, p);
          }
          // pack immediately so nothing lost
          if (_batch.length) packBatch('mode_clamp');
          sendQueued('mode_clamp').catch(()=>{});
        }
      }
    }

    // optional mode recover if healthy
    if (A.allowModeRecover && !ADAPT.pinnedByQuery) {
      const healthy = (p === 0) && (!_lastFailAt || (t - _lastFailAt) > 9000);
      if (healthy) {
        if (!ADAPT.healthySince) ADAPT.healthySince = t;
      } else {
        ADAPT.healthySince = 0;
      }

      if (ADAPT.healthySince && (t - ADAPT.healthySince) > A.recoverStableMs) {
        if (!ADAPT.lastModeStepAt || (t - ADAPT.lastModeStepAt) > A.recoverStepMs) {
          ADAPT.lastModeStepAt = t;
          if (CFG.mode === 'off') { setModeInternal('lite', false); announceAuto('mode_recover','off_to_lite', q, p); }
          else if (CFG.mode === 'lite') { setModeInternal('full', false); announceAuto('mode_recover','lite_to_full', q, p); }
        }
      }
    }

    // status publish (so HUD can show)
    publishStatus('adapt');
  }

  function announceAuto(kind, reason, q, p){
    try{
      root.dispatchEvent(new CustomEvent('groups:telemetry_auto', {
        detail:{
          kind:'switch',
          from:'(auto)',
          to:CFG.mode,
          reason:String(kind||'auto') + ':' + String(reason||''),
          fps:Math.round(_fpsAvg),
          qBatches:q.batches|0,
          qEvents:q.events|0,
          pressure:p|0
        }
      }));
    }catch(_){}
  }

  function startFpsMonitor(){
    cancelAnimationFrame(_fpsRaf);
    _fpsFrames = 0;
    _fpsT0 = nowMs();
    _fpsAvg = 60;
    _lowStart = 0;
    _hardStart = 0;
    _lastAutoSwitchAt = 0;
    _lastAutoWarnAt = 0;

    const tick = ()=>{
      _fpsFrames++;
      const t = nowMs();
      const dt = t - _fpsT0;
      if (dt >= CFG.auto.sampleWindowMs){
        const fps = (_fpsFrames * 1000) / dt;
        _fpsAvg = fps;
        _fpsFrames = 0;
        _fpsT0 = t;

        autoDecide(t, fps);
      }
      _fpsRaf = requestAnimationFrame(tick);
    };
    _fpsRaf = requestAnimationFrame(tick);
  }

  function autoDecide(t, fps){
    if (!CFG.auto.enabled) return;
    if (CFG.runMode !== 'play') return;
    if (CFG.mode === 'off') return;

    if (_lastAutoSwitchAt && (t - _lastAutoSwitchAt) < CFG.auto.cooldownMs) {
      maybeWarnLowFps(t, fps);
      return;
    }

    const low = (fps < CFG.auto.fpsLow);
    const hard = (fps < CFG.auto.fpsHard);

    if (hard) { if (!_hardStart) _hardStart = t; } else _hardStart = 0;
    if (low)  { if (!_lowStart)  _lowStart  = t; } else _lowStart  = 0;

    if (CFG.mode === 'full' && _lowStart && (t - _lowStart) >= CFG.auto.holdMs) {
      doAutoSwitch('lite', 'fps_low_full_to_lite', fps);
      _lowStart = 0; _hardStart = 0;
      return;
    }

    if (CFG.mode === 'lite' && _hardStart && (t - _hardStart) >= CFG.auto.holdMsHard) {
      doAutoSwitch('off', 'fps_hard_lite_to_off', fps);
      _lowStart = 0; _hardStart = 0;
      return;
    }

    maybeWarnLowFps(t, fps);
  }

  function maybeWarnLowFps(t, fps){
    if (fps >= CFG.auto.fpsLow) return;
    if (_lastAutoWarnAt && (t - _lastAutoWarnAt) < CFG.auto.warnEveryMs) return;
    _lastAutoWarnAt = t;

    try{
      root.dispatchEvent(new CustomEvent('groups:telemetry_auto', {
        detail:{ kind:'warn', mode:CFG.mode, fps:Math.round(fps), fpsLow:CFG.auto.fpsLow, fpsHard:CFG.auto.fpsHard }
      }));
    }catch(_){}
  }

  function doAutoSwitch(mode, reason, fps){
    const from = CFG.mode;
    setModeInternal(mode, false);
    _lastAutoSwitchAt = nowMs();

    if (_batch.length) packBatch('auto_switch');
    sendQueued('auto_switch').catch(()=>{});
    publishStatus('auto_switch');

    try{
      root.dispatchEvent(new CustomEvent('groups:telemetry_auto', {
        detail:{
          kind:'switch',
          from, to:mode,
          reason:String(reason||'auto'),
          fps:Math.round(fps),
          fpsLow:CFG.auto.fpsLow,
          fpsHard:CFG.auto.fpsHard
        }
      }));
    }catch(_){}
  }

  // ---------------- status heartbeat ----------------
  function publishStatus(tag){
    const q = loadQueue();
    let ev = 0;
    for (const b of q) ev += (b && b.events && b.events.length) ? b.events.length : 0;

    const st = _lastStatus = {
      t: nowMs(),
      tag: String(tag||'status'),
      enabled: !!CFG.enabled,
      mode: CFG.mode,
      runMode: CFG.runMode,
      endpoint: !!CFG.endpoint,
      inFlight: !!_inFlight,
      pendingBatches: q.length,
      pendingEvents: ev,
      lastSentMsAgo: _lastSentAt ? (nowMs() - _lastSentAt) : -1,
      lastFailMsAgo: _lastFailAt ? (nowMs() - _lastFailAt) : -1,
      lastSendResult: _lastSendResult,
      fpsAvg: Math.round(_fpsAvg),

      // ✅ PACK 14.5 fields
      adaptEnabled: !!CFG.adapt.enabled,
      adaptPressure: ADAPT.pressure|0,
      thrMul: Math.round(ADAPT.throttleMul*100)/100,
      samMul: Math.round(ADAPT.sampleMul*100)/100,
      flushMul: Math.round(ADAPT.flushEveryMul*100)/100,
      pinned: !!ADAPT.pinnedByQuery
    };

    try { root.dispatchEvent(new CustomEvent('groups:telemetry_status', { detail: st })); } catch(_){}

    if (_hudHook) {
      try { _hudHook(st); } catch(_){}
    }
  }

  function startStatusHeartbeat(){
    clearInterval(_statusIt);
    _statusIt = setInterval(()=> publishStatus('beat'), CFG.statusEveryMs);
    publishStatus('start');
  }

  // ---------------- event listeners ----------------
  function attachEventListeners(){
    if (_eventsAttached) return;
    _eventsAttached = true;

    root.addEventListener('hha:score', (ev)=>{
      const d = ev.detail||{};
      Telemetry.push('hha:score', { score:d.score|0, combo:d.combo|0, miss:d.misses|0 }, 'lite');
    }, { passive:true });

    root.addEventListener('hha:rank', (ev)=>{
      const d = ev.detail||{};
      Telemetry.push('hha:rank', { grade:String(d.grade||''), acc:Number(d.accuracy||0) }, 'lite');
    }, { passive:true });

    root.addEventListener('quest:update', (ev)=>{
      const d = ev.detail||{};
      Telemetry.push('quest:update', {
        g:String(d.groupKey||''), gName:String(d.groupName||''),
        goalNow:d.goalNow|0, goalTot:d.goalTotal|0, goalPct:Math.round(Number(d.goalPct||0)),
        miniNow:d.miniNow|0, miniTot:d.miniTotal|0, miniLeft:d.miniTimeLeftSec|0,
        miniCleared:d.miniCountCleared|0, miniTotal:d.miniCountTotal|0
      }, 'lite');
    }, { passive:true });

    root.addEventListener('groups:power', (ev)=>{
      const d = ev.detail||{};
      Telemetry.push('groups:power', { cur:d.charge|0, thr:d.threshold|0 }, 'lite');
    }, { passive:true });

    root.addEventListener('groups:progress', (ev)=>{
      Telemetry.push('groups:progress', ev.detail||{}, 'lite');
    }, { passive:true });

    root.addEventListener('groups:ai_predict', (ev)=>{
      Telemetry.push('groups:ai_predict', ev.detail||{}, 'lite');
    }, { passive:true });

    // FULL-heavy (sampled + throttled)
    root.addEventListener('groups:spawn', (ev)=>{
      Telemetry.push('groups:spawn', ev.detail||{}, 'full');
    }, { passive:true });

    root.addEventListener('groups:hit', (ev)=>{
      Telemetry.push('groups:hit', ev.detail||{}, 'full');
    }, { passive:true });

    root.addEventListener('groups:expire', (ev)=>{
      Telemetry.push('groups:expire', ev.detail||{}, 'full');
    }, { passive:true });

    root.addEventListener('hha:judge', (ev)=>{
      Telemetry.push('hha:judge', ev.detail||{}, 'full');
    }, { passive:true });

    root.addEventListener('hha:end', ()=>{
      Telemetry.flushNow('end').catch(()=>{});
    }, { passive:true });

    root.addEventListener('online', ()=>{ tryResendQueue(); }, { passive:true });
  }

  // ---------------- flush hardened ----------------
  function installLeaveFlush(){
    if (_installed) return;
    _installed = true;

    const hard = ()=> {
      if (_batch.length) packBatch('leave');
      Telemetry.flushNow('leave').catch(()=>{});
    };

    root.addEventListener('pagehide', hard, { capture:true });
    root.addEventListener('beforeunload', hard, { capture:true });
    root.addEventListener('freeze', hard, { capture:true });
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') hard();
    }, { capture:true });
  }

})(typeof window !== 'undefined' ? window : globalThis);