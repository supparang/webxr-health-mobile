// === /herohealth/vr-groups/telemetry.js ===
// GroupsVR Telemetry — PRODUCTION (PACK 13.95)
// ✅ Modes: full | lite | off
// ✅ Throttle: per-event min interval + global cap
// ✅ Flush-hardened: pagehide/visibilitychange/beforeunload + sendBeacon
// ✅ Auto-downgrade by FPS (full -> lite -> off) + emits 'groups:telemetry_auto'
// ✅ Safe defaults: research/practice forces OFF
// API:
//   window.GroupsVR.Telemetry.init({ runMode, endpoint, flushEveryMs, maxEventsPerBatch, maxQueueBatches, statusEveryMs })
//   window.GroupsVR.Telemetry.event(name, data?)          // push telemetry event
//   window.GroupsVR.Telemetry.setMode('full'|'lite'|'off')
//   window.GroupsVR.Telemetry.getMode() -> string
//   window.GroupsVR.Telemetry.flush(reason?)
// Notes:
//   - endpoint should be given from ?log=... or similar by caller
//   - For performance, lite captures fewer UI events than full
//   - Auto downgrade: keeps game smooth; never auto-upgrade during a run

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};
  if (WIN.GroupsVR.Telemetry && WIN.GroupsVR.Telemetry.__loaded) return;

  // ---------------- helpers ----------------
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };
  const nowTs = ()=>Date.now();
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function qMode(){
    // accept tele= | telemetry= | t=  (off|lite|full)
    const v = String(qs('tele', qs('telemetry', qs('t',''))) || '').toLowerCase();
    if (!v) return '';
    if (v==='0' || v==='off' || v==='false' || v==='none') return 'off';
    if (v==='1' || v==='lite' || v==='light' || v==='min') return 'lite';
    if (v==='2' || v==='full' || v==='all' || v==='max') return 'full';
    return '';
  }

  function emitAuto(detail){
    try{ WIN.dispatchEvent(new CustomEvent('groups:telemetry_auto', { detail })); }catch(_){}
  }

  function safeJson(obj){
    try{ return JSON.stringify(obj); }catch(_){ return ''; }
  }

  function postJson(url, payload, onDone){
    // Prefer sendBeacon where possible (especially on pagehide)
    try{
      const body = safeJson(payload);
      if (!url || !body) { onDone && onDone(false); return; }

      // sendBeacon for unload/pagehide safety
      if (navigator && typeof navigator.sendBeacon === 'function'){
        const blob = new Blob([body], { type:'application/json' });
        const ok = navigator.sendBeacon(url, blob);
        onDone && onDone(!!ok);
        return;
      }

      fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body,
        keepalive:true,
        mode:'cors'
      }).then(()=> onDone && onDone(true))
        .catch(()=> onDone && onDone(false));
    }catch(_){
      onDone && onDone(false);
    }
  }

  // ---------------- core state ----------------
  const STATE = {
    inited: false,
    runMode: 'play',
    endpoint: '',
    mode: 'off',          // 'off'|'lite'|'full'
    autoMode: true,       // auto downgrade allowed
    startedAtIso: new Date().toISOString(),
    seed: String(qs('seed','')||''),
    view: String(qs('view','')||''),
    diff: String(qs('diff','')||''),
    style: String(qs('style','')||''),
    flushEveryMs: 2000,
    statusEveryMs: 850,

    maxEventsPerBatch: 60,
    maxQueueBatches: 16,

    // throttles
    globalCapPerSec: 35, // hard cap to avoid spam even in full
    perEventMinMs: {     // default min intervals per event
      'groups:metrics': 250,   // engine metrics can be frequent
      'hha:score': 180,
      'hha:time': 250,
      'hha:rank': 450,
      'quest:update': 350,
      'groups:power': 350,
      'groups:progress': 0,
      'hha:coach': 450,
      'hha:end': 0
    },

    // queues
    batches: [],      // array of batches; each batch is array of events
    cur: [],          // current batch
    lastFlushAt: 0,
    lastStatusAt: 0,

    // throttling trackers
    lastEventAt: Object.create(null),
    capWindowStart: 0,
    capCount: 0,

    // listeners
    hooked: false,
    flushTmr: 0,
    statusTmr: 0,

    // fps monitor
    fpsOn: false,
    fpsTmr: 0,
    fpsLastTick: 0,
    fpsFrames: 0,
    fps: 60,
    fpsStage: 0 // 0=none,1=full->lite,2=lite->off
  };

  // ---------------- queue ops ----------------
  function canCollect(){
    if (!STATE.inited) return false;
    if (STATE.mode === 'off') return false;
    return true;
  }

  function hardCapOk(){
    const t = nowMs();
    if (!STATE.capWindowStart || (t - STATE.capWindowStart) >= 1000){
      STATE.capWindowStart = t;
      STATE.capCount = 0;
      return true;
    }
    if (STATE.capCount >= STATE.globalCapPerSec) return false;
    return true;
  }

  function eventAllowed(name){
    // global hard cap
    if (!hardCapOk()) return false;

    // per-event min interval
    const minMs = STATE.perEventMinMs[name];
    if (minMs == null || minMs <= 0) return true;

    const t = nowMs();
    const last = STATE.lastEventAt[name] || 0;
    if ((t - last) < minMs) return false;

    STATE.lastEventAt[name] = t;
    return true;
  }

  function pushEvt(name, data){
    if (!canCollect()) return;

    if (!eventAllowed(name)) return;

    // lite mode: drop noisy UI events
    if (STATE.mode === 'lite'){
      const allow = (name === 'groups:metrics' || name === 'hha:end' || name === 'groups:progress');
      if (!allow) return;
    }

    STATE.capCount++;

    const evt = {
      ts: nowTs(),
      t: Math.round(nowMs()),
      n: String(name || ''),
      d: data || null
    };

    STATE.cur.push(evt);

    // rotate batch if too big
    if (STATE.cur.length >= STATE.maxEventsPerBatch){
      rotateBatch('cap');
    }
  }

  function rotateBatch(reason){
    if (!STATE.cur.length) return;

    const batch = STATE.cur;
    STATE.cur = [];

    STATE.batches.push({
      reason: reason || 'tick',
      at: nowTs(),
      events: batch
    });

    // prevent memory blow
    while (STATE.batches.length > STATE.maxQueueBatches){
      STATE.batches.shift();
    }
  }

  // ---------------- flushing ----------------
  function buildEnvelope(kind, extra){
    const ctx = (WIN.GroupsVR && typeof WIN.GroupsVR.getResearchCtx === 'function')
      ? (WIN.GroupsVR.getResearchCtx() || {})
      : {};

    return Object.assign({
      kind: kind || 'telemetry',
      projectTag: 'HeroHealth',
      gameTag: 'GroupsVR',
      runMode: STATE.runMode,
      mode: STATE.mode,
      view: STATE.view || String(qs('view','')||''),
      diff: STATE.diff || String(qs('diff','')||''),
      style: STATE.style || String(qs('style','')||''),
      seed: STATE.seed || String(qs('seed','')||''),
      startedAtIso: STATE.startedAtIso,
      sentAtIso: new Date().toISOString()
    }, ctx, extra || {});
  }

  function flush(reason){
    if (!STATE.inited) return;
    if (!STATE.endpoint) { rotateBatch(reason||'flush_no_endpoint'); return; }

    // move current into batches first
    rotateBatch(reason || 'flush');

    if (!STATE.batches.length) return;

    // merge all batches into one payload (bounded by maxQueueBatches already)
    const payload = buildEnvelope('telemetry', {
      flushReason: String(reason || 'flush'),
      batchCount: STATE.batches.length,
      batches: STATE.batches
    });

    const url = STATE.endpoint;
    const sending = STATE.batches;
    STATE.batches = []; // optimistic clear

    postJson(url, payload, (ok)=>{
      if (!ok){
        // restore if failed (but keep bounded)
        STATE.batches = sending.concat(STATE.batches);
        while (STATE.batches.length > STATE.maxQueueBatches){
          STATE.batches.shift();
        }
      }
    });

    STATE.lastFlushAt = nowMs();
  }

  function scheduleFlushLoop(){
    clearInterval(STATE.flushTmr);
    STATE.flushTmr = setInterval(()=>{
      if (!STATE.inited) return;
      if (STATE.mode === 'off') return;
      flush('tick');
    }, clamp(STATE.flushEveryMs, 600, 6000));
  }

  // ---------------- FPS auto downgrade ----------------
  function startFPSMonitor(){
    if (STATE.fpsOn) return;
    STATE.fpsOn = true;
    STATE.fpsFrames = 0;
    STATE.fpsLastTick = nowMs();

    function raf(){
      if (!STATE.fpsOn) return;
      STATE.fpsFrames++;
      WIN.requestAnimationFrame(raf);
    }
    WIN.requestAnimationFrame(raf);

    clearInterval(STATE.fpsTmr);
    STATE.fpsTmr = setInterval(()=>{
      if (!STATE.fpsOn) return;
      const t = nowMs();
      const dt = (t - STATE.fpsLastTick) || 1;
      const fps = (STATE.fpsFrames * 1000) / dt;
      STATE.fps = fps;
      STATE.fpsFrames = 0;
      STATE.fpsLastTick = t;

      // auto downgrade only in PLAY and only if telemetry enabled
      if (!STATE.autoMode) return;
      if (STATE.runMode !== 'play') return;
      if (STATE.mode === 'off') return;

      // thresholds (tuned conservative)
      // stage1: full->lite if fps < 26
      // stage2: lite->off if fps < 20
      if (STATE.mode === 'full' && fps < 26 && STATE.fpsStage < 1){
        const from = 'full';
        const to = 'lite';
        STATE.fpsStage = 1;
        setMode(to, { auto:true, fps:Math.round(fps) });
        emitAuto({ kind:'switch', from, to, fps: Math.round(fps) });
      } else if (STATE.mode === 'lite' && fps < 20 && STATE.fpsStage < 2){
        const from = 'lite';
        const to = 'off';
        STATE.fpsStage = 2;
        setMode(to, { auto:true, fps:Math.round(fps) });
        emitAuto({ kind:'switch', from, to, fps: Math.round(fps) });
      }
    }, 2000);
  }

  function stopFPSMonitor(){
    STATE.fpsOn = false;
    clearInterval(STATE.fpsTmr);
    STATE.fpsTmr = 0;
  }

  // ---------------- capture hooks ----------------
  function hookWindowEvents(){
    if (STATE.hooked) return;
    STATE.hooked = true;

    // NOTE: In lite mode, only groups:metrics + hha:end + groups:progress are kept
    const on = (name)=> (ev)=>{
      const d = ev && ev.detail != null ? ev.detail : null;
      pushEvt(name, d);
    };

    WIN.addEventListener('groups:metrics', on('groups:metrics'), { passive:true });
    WIN.addEventListener('groups:progress', on('groups:progress'), { passive:true });

    // UI-ish events (full mode only, lite will drop by canCollect rules)
    WIN.addEventListener('hha:score', on('hha:score'), { passive:true });
    WIN.addEventListener('hha:time', on('hha:time'), { passive:true });
    WIN.addEventListener('hha:rank', on('hha:rank'), { passive:true });
    WIN.addEventListener('quest:update', on('quest:update'), { passive:true });
    WIN.addEventListener('groups:power', on('groups:power'), { passive:true });
    WIN.addEventListener('hha:coach', on('hha:coach'), { passive:true });
    WIN.addEventListener('hha:end', on('hha:end'), { passive:true });

    // flush-hardened exits
    WIN.addEventListener('pagehide', ()=>{ flush('pagehide'); }, { capture:true });
    WIN.addEventListener('beforeunload', ()=>{ flush('beforeunload'); }, { capture:true });
    DOC && DOC.addEventListener && DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') flush('hidden');
    }, { capture:true });

    // Optional bindFlushOnLeave integration point used elsewhere
    try{
      WIN.GroupsVR.bindFlushOnLeave = function(getSummaryFn){
        // allow others to provide lastSummary for final flush
        WIN.addEventListener('pagehide', ()=>{
          try{
            const sum = getSummaryFn && getSummaryFn();
            if (sum) pushEvt('hha:last_summary', sum);
          }catch(_){}
          flush('bindFlushOnLeave');
        }, { capture:true });
      };
    }catch(_){}
  }

  // ---------------- mode handling ----------------
  function setMode(m, meta){
    const want = String(m||'off').toLowerCase();
    const mode = (want==='full' || want==='lite') ? want : 'off';

    const prev = STATE.mode;
    STATE.mode = mode;

    // when off -> stop loops (but keep listeners safe)
    if (STATE.mode === 'off'){
      stopFPSMonitor();
      // flush remaining once
      flush('mode_off');
      return;
    }

    // telemetry on: ensure loops
    scheduleFlushLoop();

    // fps monitor only in play + when telemetry is on (so we can downgrade)
    if (STATE.runMode === 'play') startFPSMonitor();
    else stopFPSMonitor();

    // record mode switch as event (only if already on before)
    if (prev !== mode){
      pushEvt('telemetry:mode', Object.assign({
        from: prev, to: mode
      }, meta || {}));
    }
  }

  // ---------------- init ----------------
  function init(cfg){
    cfg = cfg || {};

    STATE.inited = true;
    STATE.runMode = String(cfg.runMode || 'play').toLowerCase();
    STATE.endpoint = String(cfg.endpoint || '').trim();

    STATE.flushEveryMs = clamp(cfg.flushEveryMs ?? 2000, 600, 6000);
    STATE.statusEveryMs = clamp(cfg.statusEveryMs ?? 850, 300, 2000);

    STATE.maxEventsPerBatch = clamp(cfg.maxEventsPerBatch ?? 60, 10, 200);
    STATE.maxQueueBatches = clamp(cfg.maxQueueBatches ?? 16, 2, 40);

    STATE.startedAtIso = new Date().toISOString();
    STATE.seed = String(qs('seed', STATE.seed)||STATE.seed||'');
    STATE.view = String(qs('view', STATE.view)||STATE.view||'');
    STATE.diff = String(qs('diff', STATE.diff)||STATE.diff||'');
    STATE.style= String(qs('style', STATE.style)||STATE.style||'');

    hookWindowEvents();

    // Determine base mode:
    // - research/practice ALWAYS OFF
    // - else use query override (tele=lite/full/off)
    // - else default to lite when endpoint exists, otherwise off
    if (STATE.runMode === 'research' || STATE.runMode === 'practice'){
      setMode('off', { forcedByRunMode: STATE.runMode });
      return;
    }

    const q = qMode();
    if (q){
      setMode(q, { forcedByQuery:true });
    } else {
      // default: lite if have endpoint, else off (avoid silent queue growth)
      setMode(STATE.endpoint ? 'lite' : 'off', { defaulted:true });
    }
  }

  // ---------------- public API ----------------
  const API = {
    __loaded: true,
    init,
    event: pushEvt,
    flush,
    setMode,
    getMode: ()=>STATE.mode,
    getFps: ()=>Math.round(STATE.fps || 0),
    setAuto: (on)=>{ STATE.autoMode = !!on; },
    debugDump: ()=>{
      return {
        inited: STATE.inited,
        mode: STATE.mode,
        runMode: STATE.runMode,
        endpoint: !!STATE.endpoint,
        fps: Math.round(STATE.fps||0),
        queuedBatches: STATE.batches.length,
        curEvents: STATE.cur.length
      };
    }
  };

  WIN.GroupsVR.Telemetry = API;

})();