// === /herohealth/vr-groups/telemetry.js ===
// GroupsVR Telemetry — PACK 13.95 (Production)
// ✅ Modes: full / lite / off
// ✅ Throttle + queue caps + flush-hardened (sendBeacon/fetch keepalive)
// ✅ Auto-downgrade by FPS + auto-recover
// ✅ Emits: window event "groups:telemetry_auto" {kind:'switch', from,to,fps,reason}
// ✅ Safe: if endpoint missing => still works (buffers) but won't send
//
// Usage (from groups-vr.html):
//   window.GroupsVR.Telemetry.init({ runMode, endpoint, flushEveryMs, maxEventsPerBatch, maxQueueBatches, statusEveryMs });
//
// Notes:
// - Telemetry is forced OFF in runMode: research/practice
// - In play mode: default full (if stable FPS), auto downgrade when FPS drops

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  WIN.GroupsVR = WIN.GroupsVR || {};

  if (WIN.GroupsVR.Telemetry && WIN.GroupsVR.Telemetry.__loaded) return;

  const Telemetry = {
    __loaded: true,
    _cfg: null,
    _mode: 'off',         // full|lite|off
    _runMode: 'play',     // play|research|practice
    _endpoint: '',
    _queue: [],
    _flushT: 0,
    _statusT: 0,
    _fpsT: 0,
    _samplerT: 0,
    _inited: false,

    // fps monitoring
    _fps: 60,
    _fpsFrames: 0,
    _fpsLastTs: 0,
    _lowCount: 0,
    _highCount: 0,

    // listeners refs
    _unsub: [],

    // ---- public api ----
    init(cfg){
      try{
        this.shutdown(); // idempotent reset
        this._cfg = normalizeCfg(cfg || {});
        this._runMode = String(this._cfg.runMode || 'play').toLowerCase();
        this._endpoint = String(this._cfg.endpoint || '').trim();

        // force OFF in research/practice
        if (this._runMode === 'research' || this._runMode === 'practice'){
          this._mode = 'off';
        } else {
          // default mode for play
          this._mode = 'full';
        }

        this._inited = true;

        // capture game events (safe even if engine not loaded)
        this._attachCoreListeners();

        // periodic flush + heartbeat snapshot
        this._startTimers();

        // start fps watcher (auto downgrade/recover)
        this._startFpsMonitor();

        // flush-hardened (leave/hidden)
        this._attachFlushHarden();

        // initial snapshot
        this.snapshot('telemetry:init', { mode:this._mode, runMode:this._runMode, hasEndpoint: !!this._endpoint });

      }catch(e){
        // never throw
        console.warn('[Telemetry] init error', e);
      }
    },

    setMode(mode, reason){
      const to = String(mode||'off').toLowerCase();
      if (!['full','lite','off'].includes(to)) return;

      // never enable in research/practice
      if ((this._runMode === 'research' || this._runMode === 'practice') && to !== 'off') return;

      const from = this._mode;
      if (from === to) return;

      this._mode = to;
      this._emitAutoSwitch(from, to, this._fps, reason || 'manual');
      this.snapshot('telemetry:mode', { from, to, fps:this._fps, reason: reason || 'manual' });
    },

    log(name, detail){
      if (!this._inited) return;
      if (this._mode === 'off') return;
      // in lite mode, drop very chatty streams
      if (this._mode === 'lite'){
        if (name === 'hha:time' || name === 'hha:score') return;
      }
      pushEvent(this, name, detail);
    },

    snapshot(name, detail){
      if (!this._inited) return;
      // snapshots allowed even in off (for end + mode changes)
      pushEvent(this, name, detail, true);
    },

    flush(reason){
      if (!this._inited) return;
      return flushNow(this, reason || 'flush');
    },

    shutdown(){
      // stop timers
      try{ clearInterval(this._flushT); }catch(_){}
      try{ clearInterval(this._statusT); }catch(_){}
      try{ clearInterval(this._fpsT); }catch(_){}
      try{ cancelAnimationFrame(this._samplerT); }catch(_){}
      this._flushT = this._statusT = this._fpsT = 0;
      this._samplerT = 0;

      // remove listeners
      if (this._unsub && this._unsub.length){
        this._unsub.forEach(fn=>{ try{ fn(); }catch(_){ } });
      }
      this._unsub = [];

      // reset state
      this._cfg = null;
      this._queue = [];
      this._endpoint = '';
      this._mode = 'off';
      this._runMode = 'play';
      this._inited = false;

      // fps counters
      this._fps = 60;
      this._fpsFrames = 0;
      this._fpsLastTs = 0;
      this._lowCount = 0;
      this._highCount = 0;
    },

    // ---- internal ----
    _attachCoreListeners(){
      const add = (type, fn, opts)=>{
        WIN.addEventListener(type, fn, opts || { passive:true });
        this._unsub.push(()=> WIN.removeEventListener(type, fn, opts || { passive:true }));
      };

      // core HUD/gameplay signals
      add('hha:score', (ev)=> this.log('hha:score', pick(ev.detail, ['score','combo','misses','hitsGood','hitsBad'])));
      add('hha:time',  (ev)=> this.log('hha:time',  pick(ev.detail, ['left','elapsed','t'])));
      add('hha:rank',  (ev)=> this.log('hha:rank',  pick(ev.detail, ['grade','accuracy'])));
      add('quest:update', (ev)=> this.log('quest:update', trimQuest(ev.detail)));
      add('groups:power', (ev)=> this.log('groups:power', pick(ev.detail, ['charge','threshold'])));
      add('groups:progress', (ev)=> this.log('groups:progress', pick(ev.detail, ['kind','phase','level','storm'])));
      add('groups:ai_predict', (ev)=> this.log('groups:ai_predict', pick(ev.detail, ['r','missRate','acc','combo','left','storm','miniU','group'])));
      add('hha:end', (ev)=>{
        // end is always kept (even off) as snapshot
        this.snapshot('hha:end', safeClone(ev.detail || {}));
        // flush immediately
        flushNow(this, 'end');
      });
      add('error', (ev)=>{
        this.snapshot('js:error', { msg:String(ev.message||'').slice(0,180), file:String(ev.filename||''), line:ev.lineno|0, col:ev.colno|0 });
      });
      add('unhandledrejection', (ev)=>{
        const r = ev && ev.reason;
        this.snapshot('js:rejection', { reason: String(r && (r.message || r) || 'unknown').slice(0,220) });
      });
    },

    _attachFlushHarden(){
      const onHide = ()=>{
        // flush with best-effort
        flushNow(this, 'hide');
      };
      const onPageHide = ()=>{
        flushNow(this, 'pagehide');
      };
      const onVis = ()=>{
        if (DOC.visibilityState === 'hidden') onHide();
      };

      DOC.addEventListener('visibilitychange', onVis, { passive:true });
      WIN.addEventListener('pagehide', onPageHide, { passive:true });
      WIN.addEventListener('beforeunload', onHide);

      this._unsub.push(()=> DOC.removeEventListener('visibilitychange', onVis));
      this._unsub.push(()=> WIN.removeEventListener('pagehide', onPageHide));
      this._unsub.push(()=> WIN.removeEventListener('beforeunload', onHide));
    },

    _startTimers(){
      const flushEvery = clampNum(this._cfg.flushEveryMs, 600, 60000, 2000);
      const statusEvery = clampNum(this._cfg.statusEveryMs, 400, 15000, 850);

      this._flushT = setInterval(()=> flushNow(this, 'tick'), flushEvery);

      // lite heartbeat snapshot (safe; only when not off)
      this._statusT = setInterval(()=>{
        if (!this._inited) return;
        if (this._mode === 'off') return;
        this.snapshot('telemetry:hb', { fps:this._fps, mode:this._mode, q: this._queue.length });
      }, statusEvery);
    },

    _startFpsMonitor(){
      // RAF-based FPS sampling
      this._fpsFrames = 0;
      this._fpsLastTs = nowMs();

      const tick = (t)=>{
        if (!this._inited) return;
        this._fpsFrames++;

        const dt = t - this._fpsLastTs;
        if (dt >= 1000){
          const fps = Math.round((this._fpsFrames * 1000) / dt);
          this._fps = fps;
          this._fpsFrames = 0;
          this._fpsLastTs = t;

          // auto downgrade / recover only in play
          if (this._runMode === 'play'){
            this._autoModeByFps(fps);
          }
        }

        this._samplerT = requestAnimationFrame(tick);
      };

      this._samplerT = requestAnimationFrame(tick);
    },

    _autoModeByFps(fps){
      // thresholds tuned for mobile
      // - <25 : off
      // - <40 : lite
      // - >52 for a while : recover up (lite->full)
      const cur = this._mode;
      if (fps < 25){
        this._lowCount++;
        this._highCount = 0;
        if (cur !== 'off' && this._lowCount >= 2){
          this.setMode('off', 'fps_low');
        }
        return;
      }

      if (fps < 40){
        this._lowCount++;
        this._highCount = 0;
        if (cur === 'full' && this._lowCount >= 2){
          this.setMode('lite', 'fps_mid');
        } else if (cur === 'off' && this._lowCount >= 3){
          // stay off
        }
        return;
      }

      // fps is OK
      this._highCount++;
      this._lowCount = 0;

      // recover ladder
      if (fps > 52){
        if (cur === 'off' && this._highCount >= 3){
          this.setMode('lite', 'fps_recover');
        } else if (cur === 'lite' && this._highCount >= 5){
          this.setMode('full', 'fps_recover');
        }
      }
    },

    _emitAutoSwitch(from, to, fps, reason){
      try{
        WIN.dispatchEvent(new CustomEvent('groups:telemetry_auto', {
          detail: { kind:'switch', from, to, fps: fps|0, reason: String(reason||'') }
        }));
      }catch(_){}
    }
  };

  // ---------------- helpers ----------------
  function nowMs(){
    try{ return performance.now(); }catch(_){ return Date.now(); }
  }
  function clampNum(v, a, b, def){
    v = Number(v);
    if (!isFinite(v)) v = def;
    if (v < a) v = a;
    if (v > b) v = b;
    return v;
  }
  function normalizeCfg(cfg){
    return {
      runMode: String(cfg.runMode || 'play'),
      endpoint: String(cfg.endpoint || ''),
      flushEveryMs: cfg.flushEveryMs,
      maxEventsPerBatch: clampNum(cfg.maxEventsPerBatch, 10, 200, 60),
      maxQueueBatches: clampNum(cfg.maxQueueBatches, 4, 40, 16),
      statusEveryMs: cfg.statusEveryMs
    };
  }

  function safeClone(o){
    try{
      // strip functions + huge objects
      return JSON.parse(JSON.stringify(o || {}));
    }catch(_){
      return {};
    }
  }

  function pick(obj, keys){
    const o = obj || {};
    const out = {};
    keys.forEach(k=>{
      if (o[k] !== undefined) out[k] = o[k];
    });
    return out;
  }

  function trimQuest(d){
    const o = d || {};
    // keep only essentials to avoid huge payload
    return {
      goalNow: o.goalNow|0,
      goalTotal: o.goalTotal|0,
      goalPct: (o.goalPct!==undefined)? Math.round(Number(o.goalPct)||0) : undefined,
      miniNow: o.miniNow|0,
      miniTotal: o.miniTotal|0,
      miniPct: (o.miniPct!==undefined)? Math.round(Number(o.miniPct)||0) : undefined,
      miniTimeLeftSec: o.miniTimeLeftSec|0,
      groupKey: (o.groupKey!==undefined)? String(o.groupKey).slice(0,24) : undefined,
      groupName: (o.groupName!==undefined)? String(o.groupName).slice(0,40) : undefined
    };
  }

  function pushEvent(self, name, detail, force){
    // force allows snapshot even in off mode
    if (!force){
      if (self._mode === 'off') return;
      // in practice/research, keep minimal
      if (self._runMode !== 'play') return;
    }

    const maxBatch = self._cfg ? self._cfg.maxEventsPerBatch : 60;
    const maxBatches = self._cfg ? self._cfg.maxQueueBatches : 16;
    const maxQ = maxBatch * maxBatches;

    const ev = {
      t: Date.now(),
      ts: new Date().toISOString(),
      name: String(name||'event'),
      mode: self._mode,
      runMode: self._runMode,
      fps: self._fps|0,
      d: safeClone(detail || {})
    };

    self._queue.push(ev);

    // cap queue (drop oldest)
    if (self._queue.length > maxQ){
      self._queue.splice(0, self._queue.length - maxQ);
    }
  }

  async function flushNow(self, reason){
    try{
      if (!self._inited) return false;
      if (!self._queue.length) return true;

      const maxBatch = self._cfg ? self._cfg.maxEventsPerBatch : 60;

      // if no endpoint, keep buffer but avoid infinite growth
      if (!self._endpoint){
        // still trim aggressively
        if (self._queue.length > maxBatch * 8){
          self._queue.splice(0, self._queue.length - maxBatch * 8);
        }
        return false;
      }

      // take one batch
      const batch = self._queue.splice(0, maxBatch);

      const payload = {
        v: 1,
        tag: 'GroupsVR',
        reason: String(reason||''),
        sentAt: new Date().toISOString(),
        count: batch.length,
        events: batch
      };

      const ok = await sendPayload(self._endpoint, payload);

      // if failed, requeue to front (best effort, keep caps)
      if (!ok){
        self._queue = batch.concat(self._queue);
        // if too large, drop oldest
        const maxQ = maxBatch * (self._cfg ? self._cfg.maxQueueBatches : 16);
        if (self._queue.length > maxQ){
          self._queue.splice(0, self._queue.length - maxQ);
        }
      }

      return ok;
    }catch(e){
      // never throw
      return false;
    }
  }

  async function sendPayload(endpoint, payload){
    const body = JSON.stringify(payload);

    // prefer sendBeacon for unload safety
    try{
      if (navigator.sendBeacon){
        const blob = new Blob([body], { type:'application/json' });
        const ok = navigator.sendBeacon(endpoint, blob);
        if (ok) return true;
      }
    }catch(_){}

    // fallback fetch keepalive
    try{
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit'
      });
      return !!(res && (res.ok || res.status === 204));
    }catch(_){
      return false;
    }
  }

  // expose
  WIN.GroupsVR.Telemetry = Telemetry;

})();