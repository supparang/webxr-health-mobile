// === /herohealth/vr-groups/telemetry.js ===
// GroupsVR Telemetry (PACK 13) — PRODUCTION v2
// ✅ Modes: off | lite | full  (persist LS + ?telemetry=off|lite|full)
// ✅ Gated: research/practice => OFF hard
// ✅ Throttle per event + batch send (no spam)
// ✅ Recovery: unsent batches saved to localStorage, resent on next load
// ✅ Flush-hardened: pagehide/hidden/freeze/beforeunload flushNow()
// ✅ Export pending: Telemetry.exportPending()
// ✅ NEW API: getQueueSize(), getQueueBatches(), clearQueue(), getConfig()

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
      'hha:judge': 80,           // FULL only
      'groups:ai_predict': 800
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
      maxQueueBatches: CFG.maxQueueBatches
    };
  };

  Telemetry.getQueueBatches = function getQueueBatches(){
    const q = loadQueue();
    return q;
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

    // throttle
    const thr  = Number(CFG.throttle[name] ?? 0) || 0;
    const last = Number(_lastEventAt[name] || 0) || 0;
    if (thr > 0 && (t - last) < thr) return false;
    _lastEventAt[name] = t;

    // mode gate
    if (CFG.mode === 'lite' && level === 'full') return false;

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
      v: 2,
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