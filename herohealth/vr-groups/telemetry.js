// === /herohealth/vr-groups/telemetry.js ===
// Telemetry — PACK 13.95 (GroupsVR)
// ✅ Modes: full | lite | off (default: lite on mobile, full on pc)
// ✅ Auto downgrade by FPS: full -> lite -> off (emit groups:telemetry_auto)
// ✅ Throttle spammy events + batch queue
// ✅ Flush-hardened: pagehide/visibilitychange/beforeunload + sendBeacon/fetch keepalive
// ✅ Safe when endpoint missing (collect in-memory only, no errors)
// ✅ Can override via ?tele=full|lite|off

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_GROUPS_TELE_LOADED__) return;
  WIN.__HHA_GROUPS_TELE_LOADED__ = true;

  WIN.GroupsVR = WIN.GroupsVR || {};

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function isLikelyMobile(){
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer: coarse)').matches);
  }

  // -------------------------
  // Transport (beacon/fetch)
  // -------------------------
  async function postJson(url, payload){
    if (!url) return false;
    const body = JSON.stringify(payload);

    // try beacon first
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(url, new Blob([body], { type:'application/json' }));
        if (ok) return true;
      }
    }catch(_){}

    // fallback fetch keepalive
    try{
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit'
      });
      return !!res && (res.ok || (res.status>=200 && res.status<300));
    }catch(_){
      return false;
    }
  }

  // -------------------------
  // Telemetry core
  // -------------------------
  const Tele = {
    _inited: false,
    _mode: 'lite',              // full|lite|off
    _runMode: 'play',           // play|research|practice
    _endpoint: '',
    _flushEveryMs: 2000,
    _statusEveryMs: 850,
    _maxEventsPerBatch: 60,
    _maxQueueBatches: 16,

    _queue: [],                 // batches [{t, events:[...]}]
    _cur: null,                 // current batch
    _lastFlushAt: 0,
    _lastStatusAt: 0,
    _lastEventAtByType: Object.create(null),

    _fps: 60,
    _fpsMode: 'full',           // monitoring state
    _autoEnabled: true,
    _rafId: 0,

    // ---- config ----
    init(cfg){
      if (this._inited) return;
      this._inited = true;

      cfg = cfg || {};
      this._runMode = String(cfg.runMode || 'play');
      this._endpoint = String(cfg.endpoint || qs('log','') || '');
      this._flushEveryMs = clamp(cfg.flushEveryMs ?? 2000, 600, 8000);
      this._statusEveryMs= clamp(cfg.statusEveryMs ?? 850, 400, 3000);
      this._maxEventsPerBatch = clamp(cfg.maxEventsPerBatch ?? 60, 20, 200);
      this._maxQueueBatches   = clamp(cfg.maxQueueBatches ?? 16, 4, 60);

      // decide base mode
      let forced = String(qs('tele','') || qs('telemetry','') || '').toLowerCase().trim();
      if (forced === '0' || forced === 'off' || forced === 'false') forced = 'off';
      if (forced === '1' || forced === 'on'  || forced === 'true')  forced = 'lite';

      if (forced === 'full' || forced === 'lite' || forced === 'off'){
        this._mode = forced;
        this._autoEnabled = false;
      } else {
        // default: research/practice => off, play => lite on mobile, full on pc
        if (this._runMode === 'research' || this._runMode === 'practice'){
          this._mode = 'off';
        } else {
          this._mode = isLikelyMobile() ? 'lite' : 'full';
        }
        this._autoEnabled = true;
      }

      // start batch
      this._cur = { t: Date.now(), events: [] };

      // hooks
      this._installListeners();
      this._installFlushHardened();

      // FPS monitor (only if auto enabled and not forced off)
      if (this._autoEnabled && this._mode !== 'off' && this._runMode === 'play'){
        this._startFpsMonitor();
      }

      // ping status
      this._emitAuto('init', { to:this._mode, fps:this._fps, runMode:this._runMode, endpoint: !!this._endpoint });
    },

    mode(){ return this._mode; },

    setMode(m, reason){
      m = String(m||'').toLowerCase();
      if (!(m==='full' || m==='lite' || m==='off')) return;
      if (this._mode === m) return;

      const from = this._mode;
      this._mode = m;

      this._emitAuto('switch', { from, to:m, fps:this._fps, reason: String(reason||'') });
    },

    _emitAuto(kind, extra){
      try{
        WIN.dispatchEvent(new CustomEvent('groups:telemetry_auto', {
          detail: Object.assign({ kind }, extra||{})
        }));
      }catch(_){}
    },

    // ---- event logging ----
    log(type, data, opts){
      if (!this._inited) return;
      if (this._mode === 'off') return;

      type = String(type||'evt');
      data = data || {};
      opts = opts || {};

      // throttle per type
      const minGap = clamp(opts.minGapMs ?? this._throttleFor(type), 0, 5000);
      if (minGap > 0){
        const t = nowMs();
        const last = this._lastEventAtByType[type] || 0;
        if (t - last < minGap) return;
        this._lastEventAtByType[type] = t;
      }

      // lite mode drops heavy payloads
      let payload = data;
      if (this._mode === 'lite'){
        payload = this._liteFilter(type, data);
      }

      // append
      if (!this._cur) this._cur = { t: Date.now(), events: [] };
      this._cur.events.push({
        ts: Date.now(),
        type,
        d: payload
      });

      // rotate batch
      if (this._cur.events.length >= this._maxEventsPerBatch){
        this._queue.push(this._cur);
        this._cur = { t: Date.now(), events: [] };
        if (this._queue.length > this._maxQueueBatches){
          // drop oldest (never throw)
          this._queue.shift();
        }
      }

      // periodic flush
      const tNow = nowMs();
      if (tNow - this._lastFlushAt >= this._flushEveryMs){
        this.flush(false);
        this._lastFlushAt = tNow;
      }
    },

    _throttleFor(type){
      // sane defaults
      if (type === 'hha:time') return 900;         // once/0.9s
      if (type === 'hha:score')return 260;         // ~4/s
      if (type === 'quest:update') return 350;     // ~3/s
      if (type === 'groups:ai_predict') return 1200;
      return 0;
    },

    _liteFilter(type, d){
      // keep key signals only
      try{
        if (type === 'hha:time')  return { left: d.left };
        if (type === 'hha:score') return { score:d.score, combo:d.combo, misses:d.misses };
        if (type === 'hha:rank')  return { grade:d.grade, accuracy:d.accuracy };
        if (type === 'quest:update') return {
          goalNow:d.goalNow, goalTotal:d.goalTotal,
          miniNow:d.miniNow, miniTotal:d.miniTotal,
          miniTimeLeftSec:d.miniTimeLeftSec,
          groupKey:d.groupKey
        };
        if (type === 'hha:judge') return { ok:!!d.ok, group:d.groupKey || d.group };
        if (type === 'groups:progress') return { kind:d.kind };
        if (type === 'groups:ai_predict') return { r:d.r, acc:d.acc, combo:d.combo, left:d.left, storm:d.storm, miniU:d.miniU };
        return d && typeof d === 'object' ? d : { v:d };
      }catch(_){
        return { ok:true };
      }
    },

    // ---- flush ----
    async flush(force){
      if (!this._inited) return false;
      if (this._mode === 'off') return false;

      const endpoint = this._endpoint;
      if (!endpoint){
        // nothing to send (still keep in memory)
        return false;
      }

      // build batches
      const out = [];
      if (this._cur && this._cur.events && this._cur.events.length){
        // keep current as batch too (do not clear if not forced)
        out.push(this._cur);
        if (force){
          this._cur = { t: Date.now(), events: [] };
        }
      }
      while (this._queue.length){
        out.unshift(this._queue.shift());
      }
      if (!out.length) return false;

      const ctx = (WIN.GroupsVR && WIN.GroupsVR.getResearchCtx) ? WIN.GroupsVR.getResearchCtx() : {};
      const meta = {
        projectTag: 'HeroHealth',
        gameTag: 'GroupsVR',
        runMode: this._runMode,
        view: String(qs('view','')||''),
        diff: String(qs('diff','')||''),
        time: Number(qs('time','')||0),
        seed: String(qs('seed','')||''),
        ua: navigator.userAgent || '',
        ts: Date.now()
      };

      const payload = { meta: Object.assign(meta, ctx), batches: out };

      const ok = await postJson(endpoint, payload);
      if (!ok){
        // if failed, re-queue (bounded)
        try{
          for (let i=0;i<out.length;i++){
            this._queue.push(out[i]);
            if (this._queue.length > this._maxQueueBatches){
              this._queue.shift();
            }
          }
        }catch(_){}
      }
      return ok;
    },

    // ---- listeners ----
    _installListeners(){
      const on = (name, fn)=> WIN.addEventListener(name, fn, { passive:true });

      on('hha:time', (ev)=> this.log('hha:time', ev.detail||{}, { minGapMs: this._throttleFor('hha:time') }));
      on('hha:score',(ev)=> this.log('hha:score',ev.detail||{}, { minGapMs: this._throttleFor('hha:score') }));
      on('hha:rank', (ev)=> this.log('hha:rank', ev.detail||{}, { minGapMs: this._throttleFor('hha:rank') }));
      on('hha:judge',(ev)=> this.log('hha:judge',ev.detail||{}, { minGapMs: this._throttleFor('hha:judge') }));
      on('quest:update',(ev)=> this.log('quest:update',ev.detail||{}, { minGapMs: this._throttleFor('quest:update') }));
      on('groups:power',(ev)=> this.log('groups:power',ev.detail||{}, { minGapMs: 280 }));
      on('groups:progress',(ev)=> this.log('groups:progress',ev.detail||{}, { minGapMs: 60 }));
      on('groups:ai_predict',(ev)=> this.log('groups:ai_predict',ev.detail||{}, { minGapMs: this._throttleFor('groups:ai_predict') }));
      on('hha:end',(ev)=> {
        this.log('hha:end', ev.detail||{}, { minGapMs: 0 });
        // force flush at end (best effort)
        this.flush(true);
      });
    },

    _installFlushHardened(){
      const safeFlush = ()=>{ try{ this.flush(true); }catch(_){} };

      // pagehide is best on mobile
      WIN.addEventListener('pagehide', safeFlush, { passive:true });
      WIN.addEventListener('beforeunload', safeFlush, { passive:true });

      DOC.addEventListener('visibilitychange', ()=>{
        if (DOC.visibilityState === 'hidden') safeFlush();
      }, { passive:true });
    },

    // ---- fps monitor + auto downgrade ----
    _startFpsMonitor(){
      let last = 0;
      let frames = 0;
      let lastReport = nowMs();

      const tick = (t)=>{
        frames++;
        if (!last) last = t;

        // report every ~1s
        if (t - lastReport >= 1000){
          const dt = (t - lastReport) || 1000;
          const fps = Math.round((frames * 1000) / dt);
          this._fps = clamp(fps, 5, 90);

          frames = 0;
          lastReport = t;

          this._autoStepByFps();
        }

        this._rafId = WIN.requestAnimationFrame(tick);
      };

      try{
        this._rafId = WIN.requestAnimationFrame(tick);
      }catch(_){}
    },

    _autoStepByFps(){
      if (!this._autoEnabled) return;
      if (this._runMode !== 'play') return;

      // if forced by query, auto disabled earlier
      const fps = this._fps;

      // downgrade thresholds
      // - below 35: full -> lite
      // - below 26: lite -> off
      // - recover: off -> lite when > 40, lite -> full when > 52 (with hysteresis)
      if (this._mode === 'full' && fps < 35){
        this.setMode('lite', 'low_fps');
      } else if (this._mode === 'lite' && fps < 26){
        this.setMode('off', 'very_low_fps');
      } else if (this._mode === 'off' && fps > 40){
        this.setMode('lite', 'fps_recover');
      } else if (this._mode === 'lite' && fps > 52 && !isLikelyMobile()){
        this.setMode('full', 'fps_good');
      }

      // status ping (optional)
      const t = nowMs();
      if (t - this._lastStatusAt > this._statusEveryMs){
        this._lastStatusAt = t;
        try{
          WIN.dispatchEvent(new CustomEvent('groups:telemetry_status', {
            detail:{ mode:this._mode, fps:this._fps, runMode:this._runMode, hasEndpoint: !!this._endpoint }
          }));
        }catch(_){}
      }
    }
  };

  // expose
  WIN.GroupsVR.Telemetry = Tele;

  // tiny ready event (so HUD can debug)
  try{
    WIN.dispatchEvent(new CustomEvent('groups:telemetry_ready', {
      detail:{ ok:true }
    }));
  }catch(_){}
})();