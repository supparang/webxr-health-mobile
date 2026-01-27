// === /herohealth/vr-groups/telemetry.js ===
// GroupsVR Telemetry (PACK 13) — PRODUCTION v3
// ✅ Modes: off | lite | full  (persist LS + ?telemetry=off|lite|full)
// ✅ Gated: research/practice => OFF hard
// ✅ Throttle per event + batch send (no spam)
// ✅ Recovery: unsent batches saved to localStorage, resent on next load
// ✅ Flush-hardened: pagehide/hidden/freeze/beforeunload flushNow()
// ✅ Export pending: Telemetry.exportPending()
// ✅ Sampling (FULL): ลด event หนักๆ เช่น spawn/hit/expire
//    - Default sample rates in CFG.sample
//    - Override via ?teleSample=spawn:0.2,hit:0.25,expire:0.15 (0..1)
// ✅ API: getQueueSize(), getQueueBatches(), clearQueue(), getConfig()

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
  const LS_MODE  = 'HHA_TELEMETRY_MODE_GroupsVR';   // 'off'|'lite'|'full'
  const LS_QUEUE = 'HHA_TELEMETRY_QUEUE_GroupsVR';  // array of batches
  const LS_SEQ   = 'HHA_TELEMETRY_SEQ_GroupsVR';    // seq counter

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
    throttle: {
      'hha:score': 600,
      'hha:rank': 800,
      'quest:update': 900,
      'groups:power': 900,
      'groups:progress': 250,
      'groups:ai_predict': 800,

      // FULL-heavy (ยัง throttle ต่ออยู่)
      'groups:spawn': 120,
      'groups:hit': 80,
      'groups:expire': 160,
      'hha:judge': 80
    },
    // ✅ Sampling for FULL-heavy events (0..1)
    // NOTE: lite ignores these (because lite doesn't record full-level anyway)
    sample: {
      'groups:spawn': 0.22,
      'groups:hit': 0.30,
      'groups:expire': 0.18,
      'hha:judge': 0.35
    },
    ui: { hudId: 'vTele' }       // optional <span id="vTele">
  };

  let _batch = [];
  let _flushIt = 0;
  let _inFlight = false;
  let _lastEventAt = Object.create(null);
  let _seq = loadSeq();
  let _installed = false;
  let _eventsAttached = false;

  // deterministic sampling counter per event
  let _sampleCounter = Object.create(null);

  // ---------------- public API ----------------
  Telemetry.init = function init(opt){
    opt = opt || {};

    const rm = String(opt.runMode || qs('run','play') || 'play').toLowerCase();
    CFG.runMode = (rm === 'research') ? 'research' : (rm === 'practice' ? 'practice' : 'play');

    CFG.endpoint = String(opt.endpoint || endpointFromParams() || '');
    CFG.flushEveryMs = clamp(opt.flushEveryMs ?? CFG.flushEveryMs, 600, 6000);
    CFG.maxEventsPerBatch = clamp(opt.maxEventsPerBatch ?? CFG.maxEventsPerBatch, 20, 120);
    CFG.maxQueueBatches = clamp(opt.maxQueueBatches ?? CFG.maxQueueBatches, 6, 30);

    // sampling override
    applySampleOverrideFromQuery();

    // mode resolution:
    // 1) research/practice => OFF hard
    // 2) ?telemetry=... (for play only) else localStorage else default 'lite'
    let mode = 'lite';
    const q  = String(qs('telemetry','')||'').toLowerCase().trim();
    const ls = String(loadMode()||'').toLowerCase().trim();

    if (q === 'off' || q === 'lite' || q === 'full') mode = q;
    else if (ls === 'off' || ls === 'lite' || ls === 'full') mode = ls;

    if (CFG.runMode !== 'play') mode = 'off';
    setModeInternal(mode, true);

    attachEventListeners();
    tryResendQueue();
    startTimer();
    installLeaveFlush();
    updateHudMode();

    return true;
  };

  Telemetry.setMode = function setMode(mode){
    mode = String(mode||'').toLowerCase();
    if (!(mode === 'off' || mode === 'lite' || mode === 'full')) mode = 'lite';
    if (CFG.runMode !== 'play') mode = 'off'; // hard gate
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
      sample: Object.assign({}, CFG.sample)
    };
  };

  Telemetry.getQueueBatches = function getQueueBatches(){
    return loadQueue();
  };

  Telemetry.getQueueSize = function getQueueSize(){
    const q = loadQueue();
    let ev = 0;
    for (const b of q) ev += (b && b.events && b.events.length) ? b.events.length : 0;
    return { batches: q.length, events: ev };
  };

  Telemetry.clearQueue = function clearQueue(){
    try { localStorage.removeItem(LS_QUEUE); } catch {}
    return true;
  };

  Telemetry.push = function push(name, detail, level){
    if (!CFG.enabled) return false;

    name = String(name||'evt');
    const t = nowMs();

    // mode gate
    if (CFG.mode === 'lite' && level === 'full') return false;

    // sampling for FULL-heavy events
    if (level === 'full' && CFG.mode === 'full') {
      const rate = Number(CFG.sample[name]);
      if (isFinite(rate)) {
        if (!shouldSample(name, clamp(rate, 0, 1))) return false;
      }
    }

    // throttle (after sampling)
    const thr  = Number(CFG.throttle[name] ?? 0) || 0;
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
    return await sendQueued('flushNow');
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
      sample: Object.assign({}, CFG.sample),
      pending: { batches: q.length, events: ev },
      queueBatches: q
    };
    return safeJson(payload, '{"error":"export_failed"}');
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

  function setModeInternal(mode, silent){
    CFG.mode = mode;
    CFG.enabled = (mode !== 'off' && CFG.runMode === 'play');
    saveMode(mode);
    updateHudMode();

    if (!silent) {
      try { root.dispatchEvent(new CustomEvent('groups:telemetry_mode', { detail:{ mode } })); } catch (_) {}
    }
  }

  function updateHudMode(){
    try{
      const id = CFG.ui && CFG.ui.hudId;
      if (!id) return;
      const el = DOC.getElementById(id);
      if (!el) return;
      el.textContent = (CFG.enabled ? CFG.mode.toUpperCase() : 'OFF');
    }catch(_){}
  }

  function packBatch(reason){
    if (!_batch.length) return;
    const seq  = bumpSeq();
    const seed = String(qs('seed','')||'');
    const diff = String(qs('diff','')||'');
    const view = String(qs('view','')||'');
    const style= String(qs('style','')||'');

    const batch = {
      v: 3,
      kind: 'telemetry',
      gameTag: 'GroupsVR',
      runMode: CFG.runMode,
      mode: CFG.mode,
      reason: String(reason||'tick'),
      ts: isoNow(),
      seq,
      meta: { seed, diff, view, style, url: String(location.href||'') },
      sample: Object.assign({}, CFG.sample),
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
      const nq = loadQueue().slice(sent);
      saveQueue(nq);
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
      if (!CFG.enabled) return;
      if (_batch.length) packBatch('tick');
      sendQueued('tick').catch(()=>{});
    }, CFG.flushEveryMs);
  }

  function tryResendQueue(){
    if (!CFG.endpoint) return;
    sendQueued('init').catch(()=>{});
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

    // teleSample format: "spawn:0.2,hit:0.25,expire:0.15,judge:0.3"
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
      if (evt) CFG.sample[evt] = v;
    }
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

    root.addEventListener('online', ()=>{ tryResendQueue(); }, { passive:true });
  }

})(typeof window !== 'undefined' ? window : globalThis);