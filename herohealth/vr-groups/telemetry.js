// === /herohealth/vr-groups/telemetry.js ===
// GroupsVR Telemetry — PRODUCTION (SAFE)
// ✅ Modes: full | lite | off
// ✅ Auto-downgrade by FPS (switch full->lite->off)
// ✅ Throttled event queue + batching
// ✅ Flush-hardened (visibilitychange/pagehide/beforeunload)
// ✅ Never throws (telemetry must not break gameplay)
// ✅ Emits: window.dispatchEvent(new CustomEvent('groups:telemetry_auto',{detail:{kind:'switch',from,to,fps}}))
// API:
//   GroupsVR.Telemetry.init({ runMode, endpoint, flushEveryMs, maxEventsPerBatch, maxQueueBatches, statusEveryMs })
//   GroupsVR.Telemetry.push(name, payload)
//   GroupsVR.Telemetry.flush(reason)
//   GroupsVR.Telemetry.setMode(mode)
// Notes:
//   - If endpoint empty => telemetry still runs in-memory but won't send.
//   - In research/practice => default to OFF unless explicitly enabled by endpoint.
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};
  const T = WIN.GroupsVR.Telemetry = WIN.GroupsVR.Telemetry || {};

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch{ return Date.now(); } };

  // ---------------- state ----------------
  let inited = false;
  let mode = 'full'; // full|lite|off
  let runMode = 'play'; // play|research|practice
  let endpoint = ''; // ?log=... (optional)

  // queue batches to keep memory bounded
  let batches = []; // [{t0, items:[{t,name,p}...]}]
  let curBatch = null;

  // timing
  let flushEveryMs = 2000;
  let statusEveryMs = 850;
  let maxEventsPerBatch = 60;
  let maxQueueBatches = 16;

  // fps monitor
  let fps = 60;
  let fpsFrame = 0;
  let fpsLastT = nowMs();
  let fpsIt = 0;

  // background flush loop
  let flushIt = 0;
  let statusIt = 0;

  // rate limits
  let lastSendAt = 0;
  let lastPushAt = 0;

  // ---------------- helpers ----------------
  function safeJson(obj){
    try{ return JSON.stringify(obj); }
    catch{
      try{
        // best-effort: remove circular
        const seen = new WeakSet();
        return JSON.stringify(obj, (k,v)=>{
          if (typeof v === 'object' && v){
            if (seen.has(v)) return '[circular]';
            seen.add(v);
          }
          return v;
        });
      }catch{ return '{"err":"json_fail"}'; }
    }
  }

  function emitAutoSwitch(from,to,fpsVal){
    try{
      WIN.dispatchEvent(new CustomEvent('groups:telemetry_auto',{
        detail:{ kind:'switch', from, to, fps: Math.round(fpsVal||0) }
      }));
    }catch(_){}
  }

  function ensureBatch(){
    if (!curBatch){
      curBatch = { t0: Date.now(), items: [] };
      batches.push(curBatch);
      // cap
      if (batches.length > maxQueueBatches){
        batches = batches.slice(-maxQueueBatches);
      }
    }
    return curBatch;
  }

  function shouldCollect(){
    if (mode === 'off') return false;
    // research/practice: be conservative
    if (runMode === 'research' || runMode === 'practice'){
      // only collect if endpoint exists (explicit logging)
      return !!endpoint;
    }
    return true;
  }

  // ---------------- FPS monitor + auto-downgrade ----------------
  function startFps(){
    if (fpsIt) return;
    const tick = ()=>{
      fpsFrame++;
      const t = nowMs();
      const dt = t - fpsLastT;
      if (dt >= 1000){
        fps = (fpsFrame * 1000) / dt;
        fpsFrame = 0;
        fpsLastT = t;

        // downgrade logic (only in play)
        if (runMode === 'play'){
          if (mode === 'full' && fps < 36){
            const from = mode; mode = 'lite';
            emitAutoSwitch(from, mode, fps);
          }else if (mode === 'lite' && fps < 26){
            const from = mode; mode = 'off';
            emitAutoSwitch(from, mode, fps);
          }else if (mode === 'off' && fps > 42){
            // optional gentle recovery
            const from = mode; mode = 'lite';
            emitAutoSwitch(from, mode, fps);
          }else if (mode === 'lite' && fps > 52){
            const from = mode; mode = 'full';
            emitAutoSwitch(from, mode, fps);
          }
        }
      }
      fpsIt = WIN.requestAnimationFrame(tick);
    };
    fpsIt = WIN.requestAnimationFrame(tick);
  }

  function stopFps(){
    try{ if (fpsIt) WIN.cancelAnimationFrame(fpsIt); }catch(_){}
    fpsIt = 0;
  }

  // ---------------- network send (SAFE) ----------------
  async function sendBatch(batch, reason){
    if (!endpoint) return false;

    // throttle send
    const t = nowMs();
    if (t - lastSendAt < 500) return false;
    lastSendAt = t;

    const payload = {
      v: 1,
      tag: 'GroupsVR',
      runMode,
      mode,
      reason: String(reason||''),
      ts: new Date().toISOString(),
      items: batch.items
    };

    // Prefer text/plain no-cors friendly (Apps Script style)
    try{
      const body = safeJson(payload);
      // Use fetch; if blocked, fail silently
      await fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body
      });
      return true;
    }catch(_){
      return false;
    }
  }

  // ---------------- public API ----------------
  T.setMode = function setMode(m){
    const v = String(m||'').toLowerCase();
    if (v === 'full' || v === 'lite' || v === 'off') mode = v;
  };

  T.init = function init(cfg){
    try{
      cfg = cfg || {};
      runMode = String(cfg.runMode||'play').toLowerCase();
      endpoint = String(cfg.endpoint||'').trim();

      flushEveryMs = clamp(cfg.flushEveryMs ?? 2000, 600, 8000);
      statusEveryMs = clamp(cfg.statusEveryMs ?? 850, 400, 2000);
      maxEventsPerBatch = clamp(cfg.maxEventsPerBatch ?? 60, 20, 200);
      maxQueueBatches = clamp(cfg.maxQueueBatches ?? 16, 4, 60);

      // default mode by runMode
      if (runMode === 'research' || runMode === 'practice'){
        mode = endpoint ? 'lite' : 'off';
      } else {
        mode = 'full';
      }

      // begin loops once
      if (!inited){
        inited = true;

        // flush loop
        flushIt = WIN.setInterval(()=>{
          try{ T.flush('timer'); }catch(_){}
        }, flushEveryMs);

        // status loop (emit stats for debugging if needed)
        statusIt = WIN.setInterval(()=>{
          // no heavy work; keep alive
          try{
            // If queue gets too big, downgrade
            const q = batches.reduce((n,b)=> n + (b.items?b.items.length:0), 0);
            if (runMode === 'play'){
              if (mode === 'full' && q > maxEventsPerBatch*6) {
                const from = mode; mode = 'lite';
                emitAutoSwitch(from, mode, fps);
              }
              if (mode !== 'off' && q > maxEventsPerBatch*12){
                const from = mode; mode = 'off';
                emitAutoSwitch(from, mode, fps);
                // hard trim
                batches = batches.slice(-4);
                curBatch = batches[batches.length-1] || null;
              }
            }
          }catch(_){}
        }, statusEveryMs);

        // harden flush on leave
        const hardFlush = ()=>{ try{ T.flush('leave'); }catch(_){ } };
        WIN.addEventListener('visibilitychange', ()=>{ if (DOC.visibilityState === 'hidden') hardFlush(); }, {passive:true});
        WIN.addEventListener('pagehide', hardFlush, {passive:true});
        WIN.addEventListener('beforeunload', hardFlush);

        startFps();
      }

      return true;
    }catch(_){
      // must never fail
      return false;
    }
  };

  T.push = function push(name, payload){
    try{
      if (!shouldCollect()) return;

      // throttle push (lite collects less)
      const t = nowMs();
      const minGap = (mode === 'lite') ? 120 : 35;
      if (t - lastPushAt < minGap) return;
      lastPushAt = t;

      const b = ensureBatch();
      b.items.push({
        t: Date.now(),
        name: String(name||'evt'),
        p: payload || {}
      });

      // rotate batch when big
      if (b.items.length >= maxEventsPerBatch){
        curBatch = null;
      }
    }catch(_){}
  };

  T.flush = function flush(reason){
    try{
      if (!endpoint) {
        // still cap memory
        if (batches.length > maxQueueBatches) batches = batches.slice(-maxQueueBatches);
        return false;
      }
      if (!batches.length) return false;

      // pick the oldest non-empty
      const b = batches[0];
      if (!b || !b.items || !b.items.length) {
        batches.shift();
        return false;
      }

      // In lite: send smaller, keep some to avoid blocking
      if (mode === 'lite' && b.items.length > 30){
        b.items = b.items.slice(0, 30);
      }

      // fire-and-forget (no await)
      sendBatch(b, reason || 'flush').then(()=>{}).catch(()=>{});
      // drop it immediately (no retries; telemetry must not hurt)
      batches.shift();
      if (batches.length) curBatch = batches[batches.length-1];
      else curBatch = null;

      return true;
    }catch(_){
      return false;
    }
  };

  // tiny debug
  T._state = function(){
    try{
      const q = batches.reduce((n,b)=> n + (b.items?b.items.length:0), 0);
      return { inited, runMode, mode, endpoint: !!endpoint, fps: Math.round(fps), q };
    }catch{ return {}; }
  };

})();