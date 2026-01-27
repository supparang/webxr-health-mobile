// === /herohealth/vr-groups/telemetry.js ===
// GroupsVR Telemetry (PACK 13) — PRODUCTION
// ✅ Modes: off | lite | full  (persist in localStorage + allow ?telemetry=off|lite|full)
// ✅ Gated: research/practice => OFF hard
// ✅ Throttle per event + batch send (no spam)
// ✅ Recovery: unsent batches saved to localStorage, resent on next load
// ✅ Flush-hardened: pagehide/hidden/freeze/beforeunload flushNow()
// ✅ Export pending: Telemetry.exportPending()

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

  // ---------------- storage keys ----------------
  const LS_MODE = 'HHA_TELEMETRY_MODE_GroupsVR';         // 'off'|'lite'|'full'
  const LS_QUEUE = 'HHA_TELEMETRY_QUEUE_GroupsVR';       // array of batches
  const LS_SEQ = 'HHA_TELEMETRY_SEQ_GroupsVR';           // seq counter

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
      // default throttle per eventName
      'hha:score': 600,
      'hha:rank': 800,
      'quest:update': 900,
      'groups:power': 900,
      'groups:progress': 250,
      'hha:judge': 80,           // only in FULL
      'groups:ai_predict': 800   // from your predictor
    },
    ui: {
      hudId: 'vTele'             // optional <span id="vTele">
    }
  };

  let _batch = [];               // current events
  let _flushIt = 0;
  let _inFlight = false;
  let _lastEventAt = Object.create(null);
  let _seq = loadSeq();
  let _installed = false;

  // ---------------- public API ----------------
  Telemetry.init = function init(opt){
    opt = opt || {};

    const rm = String(opt.runMode || qs('run','play') || 'play').toLowerCase();
    CFG.runMode = (rm === 'research') ? 'research' : (rm === 'practice' ? 'practice' : 'play');

    CFG.endpoint = String(opt.endpoint || endpointFromParams() || '');
    CFG.flushEveryMs = clamp(opt.flushEveryMs ?? CFG.flushEveryMs, 600, 6000);
    CFG.maxEventsPerBatch = clamp(opt.maxEventsPerBatch ?? CFG.maxEventsPerBatch, 20, 120);
    CFG.maxQueueBatches = clamp(opt.maxQueueBatches ?? CFG.maxQueueBatches, 6, 30);

    // mode resolution:
    // 1) research/practice => OFF hard
    // 2) ?telemetry=... (for play only) else localStorage else default 'lite'
    let mode = 'lite';
    const q = String(qs('telemetry','')||'').toLowerCase().trim();
    const ls = String(loadMode()||'').toLowerCase().trim();

    if (q === 'off' || q === 'lite' || q === 'full') mode = q;
    else if (ls === 'off' || ls === 'lite' || ls === 'full') mode = ls;

    if (CFG.runMode !== 'play') mode = 'off';
    setModeInternal(mode, true);

    // attach listeners (always attach safe; push() will no-op if disabled)
    attachEventListeners();

    // attempt resend queue on init
    tryResendQueue();

    // start periodic flushing
    startTimer();

    // hard flush handlers
    installLeaveFlush();

    return true;
  };

  Telemetry.setMode = function setMode(mode){
    mode = String(mode||'').toLowerCase();
    if (!(mode === 'off' || mode === 'lite' || mode === 'full')) mode = 'lite';
    if (CFG.runMode !== 'play') mode = 'off'; // hard gate
    setModeInternal(mode, false);
  };

  Telemetry.getMode = function getMode(){ return CFG.mode; };

  Telemetry.push = function push(name, detail, level){
    // level: 'lite'|'full' (optional). If omitted, depends on mode.
    if (!CFG.enabled) return false;

    name = String(name||'evt');
    const t = nowMs();

    // throttle
    const thr = Number(CFG.throttle[name] ?? 0) || 0;
    const last = Number(_lastEventAt[name] || 0) || 0;
    if (thr > 0 && (t - last) < thr) return false;
    _lastEventAt[name] = t;

    // mode gate
    if (CFG.mode === 'lite' && level === 'full') return false;

    // shrink detail if huge
    const d = sanitizeDetail(detail);

    _batch.push({
      t: Math.round(t),
      name,
      d
    });

    // auto flush if too big
    if (_batch.length >= CFG.maxEventsPerBatch) {
      flushSoon('batch_full');
    }
    return true;
  };

  Telemetry.flushNow = async function flushNow(reason){
    reason = String(reason||'flush');
    // pack current batch -> queue -> send
    packBatch(reason);
    return await sendQueued('flushNow');
  };

  Telemetry.exportPending = function exportPending(){
    const q = loadQueue();
    const payload = {
      exportedAt: isoNow(),
      gameTag: 'GroupsVR',
      runMode: CFG.runMode,
      mode: CFG.mode,
      endpoint: CFG.endpoint,
      queueBatches: q
    };
    return safeJson(payload, '{"error":"export_failed"}');
  };

  // ---------------- internal helpers ----------------
  function sanitizeDetail(detail){
    // keep telemetry light: drop functions, clamp strings
    if (detail == null) return null;
    const t = typeof detail;
    if (t === 'string') return (detail.length > 240) ? detail.slice(0,240) : detail;
    if (t === 'number' || t === 'boolean') return detail;
    if (t === 'object') {
      // shallow copy + clamp
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
    try {
      const s = Number(localStorage.getItem(LS_SEQ)||'0')||0;
      return s;
    } catch { return 0; }
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

    // in OFF => clear batch timer only; keep queue for export
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
      const m = CFG.mode.toUpperCase();
      el.textContent = (CFG.enabled ? m : 'OFF');
    }catch(_){}
  }

  function packBatch(reason){
    if (!_batch.length) return;
    const seq = bumpSeq();
    const seed = String(qs('seed','')||'');
    const diff = String(qs('diff','')||'');
    const view = String(qs('view','')||'');
    const style= String(qs('style','')||'');

    const batch = {
      v: 1,
      kind: 'telemetry',
      gameTag: 'GroupsVR',
      runMode: CFG.runMode,
      mode: CFG.mode,
      reason: String(reason||'tick'),
      ts: isoNow(),
      seq,
      meta: { seed, diff, view, style, url: String(location.href||'') },
      events: _batch.splice(0, _batch.length)
    };

    // push to queue storage (recovery)
    const q = loadQueue();
    q.push(batch);
    while (q.length > CFG.maxQueueBatches) q.shift();
    saveQueue(q);
  }

  function flushSoon(reason){
    // pack immediately (so it survives tab crash)
    packBatch(reason || 'soon');
    // then try send soon
    sendQueued('flushSoon').catch(()=>{});
  }

  async function sendQueued(reason){
    if (_inFlight) return { ok:false, reason:'in_flight' };
    if (!CFG.endpoint) return { ok:false, reason:'no_endpoint' };

    const q = loadQueue();
    if (!q.length) return { ok:true, reason:'empty' };

    _inFlight = true;

    // send at most 2 batches per call to avoid heavy unload
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

    // sendBeacon first (best for unload)
    let ok = false;
    try{
      if (navigator && typeof navigator.sendBeacon === 'function') {
        ok = navigator.sendBeacon(endpoint, new Blob([body], { type:'application/json' }));
      }
    }catch(_){}

    // fallback fetch keepalive
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
      // pack if any events, then try send
      if (_batch.length) packBatch('tick');
      sendQueued('tick').catch(()=>{});
    }, CFG.flushEveryMs);
  }

  function tryResendQueue(){
    // no-op if disabled; but still okay to resend in enabled mode
    if (!CFG.endpoint) return;
    sendQueued('init').catch(()=>{});
  }

  // ---------------- event listeners (no engine edits required) ----------------
  let _eventsAttached = false;
  function attachEventListeners(){
    if (_eventsAttached) return;
    _eventsAttached = true;

    // Lite & Full: score/rank/quest/power/progress/ai_predict
    root.addEventListener('hha:score', (ev)=>{
      const d = ev.detail||{};
      Telemetry.push('hha:score', {
        score: d.score|0, combo: d.combo|0, miss: d.misses|0
      }, 'lite');
    }, { passive:true });

    root.addEventListener('hha:rank', (ev)=>{
      const d = ev.detail||{};
      Telemetry.push('hha:rank', {
        grade: String(d.grade||''), acc: Number(d.accuracy||0)
      }, 'lite');
    }, { passive:true });

    root.addEventListener('quest:update', (ev)=>{
      const d = ev.detail||{};
      Telemetry.push('quest:update', {
        g: String(d.groupKey||''), gName: String(d.groupName||''),
        goalNow: d.goalNow|0, goalTot: d.goalTotal|0, goalPct: Math.round(Number(d.goalPct||0)),
        miniNow: d.miniNow|0, miniTot: d.miniTotal|0, miniLeft: d.miniTimeLeftSec|0,
        miniCleared: d.miniCountCleared|0, miniTotal: d.miniCountTotal|0
      }, 'lite');
    }, { passive:true });

    root.addEventListener('groups:power', (ev)=>{
      const d = ev.detail||{};
      Telemetry.push('groups:power', { cur:d.charge|0, thr:d.threshold|0 }, 'lite');
    }, { passive:true });

    root.addEventListener('groups:progress', (ev)=>{
      const d = ev.detail||{};
      Telemetry.push('groups:progress', d, 'lite');
    }, { passive:true });

    root.addEventListener('groups:ai_predict', (ev)=>{
      // comes from your predictor in groups-vr.html
      const d = ev.detail||{};
      Telemetry.push('groups:ai_predict', d, 'lite');
    }, { passive:true });

    // FULL: judge events (hit/miss/score popups) — heavy, so gated inside push by mode
    root.addEventListener('hha:judge', (ev)=>{
      const d = ev.detail||{};
      Telemetry.push('hha:judge', d, 'full');
    }, { passive:true });

    // When game ends: pack+flush
    root.addEventListener('hha:end', ()=>{
      // pack whatever remains and send
      Telemetry.flushNow('end').catch(()=>{});
    }, { passive:true });
  }

  // ---------------- flush hardened ----------------
  function installLeaveFlush(){
    if (_installed) return;
    _installed = true;

    const hard = ()=> {
      // pack batch first (recovery)
      if (_batch.length) packBatch('leave');
      // try send quickly
      Telemetry.flushNow('leave').catch(()=>{});
    };

    root.addEventListener('pagehide', hard, { capture:true });
    root.addEventListener('beforeunload', hard, { capture:true });
    root.addEventListener('freeze', hard, { capture:true });
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') hard();
    }, { capture:true });

    root.addEventListener('online', ()=>{
      tryResendQueue();
    }, { passive:true });
  }

})(typeof window !== 'undefined' ? window : globalThis);