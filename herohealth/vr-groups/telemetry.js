// === /herohealth/vr-groups/telemetry.js ===
// GroupsVR Telemetry — PRODUCTION (PACK 13: Lite/Full/Off + Throttle + Flush-hardened)
// ✅ Modes: off | lite | full
// ✅ Default: play => lite, research/practice => off (unless ?tele=... forces)
// ✅ Throttle + batching + cap per second
// ✅ Flush-hardened: pagehide/visibilitychange/beforeunload via sendBeacon/keepalive
// ✅ Auto-downgrade by FPS (dispatch 'groups:telemetry_auto')
// ✅ Recovery/export: exportJSON(), downloadJSON(), downloadCSV()

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || (WIN.GroupsVR && WIN.GroupsVR.Telemetry)) return;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const now = ()=>Date.now();
  const nowMs = ()=>{ try{ return performance.now(); }catch{ return Date.now(); } };

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }
  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // -------- persistent key (session) --------
  const KEY = 'HHA_GROUPS_TELE_QUEUE_V1';
  const KEY_LAST = 'HHA_GROUPS_TELE_LAST_V1';

  function readStore(){
    try{
      const raw = sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(_){ return []; }
  }
  function writeStore(arr){
    try{ sessionStorage.setItem(KEY, JSON.stringify(arr||[])); }catch(_){}
  }
  function saveLast(obj){
    try{ localStorage.setItem(KEY_LAST, JSON.stringify(obj||{})); }catch(_){}
  }

  // -------- CSV utils --------
  function toCSV(rows){
    if (!rows || !rows.length) return '';
    const flat = rows.map(r=>flatten(r));
    const keysSet = new Set();
    flat.forEach(o=>Object.keys(o).forEach(k=>keysSet.add(k)));
    const keys = Array.from(keysSet);
    const esc = (v)=>('"'+String(v??'').replace(/"/g,'""')+'"');
    const lines = [];
    lines.push(keys.map(esc).join(','));
    for (const r of flat){
      lines.push(keys.map(k=>esc(r[k])).join(','));
    }
    return lines.join('\n');
  }
  function flatten(obj, prefix='', out=null){
    out = out || {};
    if (!obj || typeof obj !== 'object') return out;
    for (const k of Object.keys(obj)){
      const v = obj[k];
      const nk = prefix ? (prefix + '.' + k) : k;
      if (v && typeof v === 'object' && !Array.isArray(v)){
        flatten(v, nk, out);
      } else {
        out[nk] = v;
      }
    }
    return out;
  }

  // -------- network --------
  async function postJSON(url, payload, keepalive){
    try{
      const body = JSON.stringify(payload);
      // Prefer sendBeacon on unload
      if (keepalive && navigator.sendBeacon){
        const ok = navigator.sendBeacon(url, new Blob([body], { type:'application/json' }));
        return !!ok;
      }
      const res = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body,
        keepalive: !!keepalive,
        mode:'cors',
        credentials:'omit'
      });
      return res && res.ok;
    }catch(_){ return false; }
  }

  // -------- fps monitor (auto downgrade) --------
  const FPS = { on:false, lastT:0, frames:0, fps:60, lastEmitAt:0 };
  function startFPS(){
    if (FPS.on) return;
    FPS.on = true;
    FPS.lastT = nowMs();
    FPS.frames = 0;

    function tick(t){
      if (!FPS.on) return;
      FPS.frames++;
      const dt = t - FPS.lastT;
      if (dt >= 1000){
        FPS.fps = Math.round((FPS.frames * 1000) / dt);
        FPS.frames = 0;
        FPS.lastT = t;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // -------- core --------
  const Telemetry = {
    cfg: null,
    mode: 'off',            // off|lite|full
    endpoint: '',
    sessionId: '',
    queue: readStore(),     // array of batches [{ts, items:[...]}]
    curBatch: null,         // {ts, items:[]}
    lastFlushAt: 0,
    lastSecAt: 0,
    secCount: 0,
    dropped: 0,
    sentBatches: 0,
    lastStatusAt: 0,
    alive: true,
    _flushTimer: 0,

    init(cfg){
      cfg = cfg || {};
      const runMode = String(cfg.runMode||'play').toLowerCase();
      const forced = String(qs('tele','')||'').toLowerCase(); // off|lite|full
      const defMode = (runMode==='play') ? 'lite' : 'off';
      const mode = (forced==='off'||forced==='lite'||forced==='full') ? forced : defMode;

      this.cfg = {
        runMode,
        flushEveryMs: clamp(cfg.flushEveryMs ?? 2000, 600, 10000),
        statusEveryMs: clamp(cfg.statusEveryMs ?? 900, 500, 5000),
        maxEventsPerBatch: clamp(cfg.maxEventsPerBatch ?? 60, 10, 200),
        maxQueueBatches: clamp(cfg.maxQueueBatches ?? 16, 4, 60),
        capPerSec: clamp(cfg.capPerSec ?? 70, 10, 250),
        endpoint: String(cfg.endpoint||''),
        autoByFps: cfg.autoByFps !== false, // default true
      };

      this.endpoint = this.cfg.endpoint;
      this.sessionId = String(qs('sid','') || (now() + '-' + Math.random().toString(16).slice(2)));
      this.mode = mode;

      // start fps monitor for auto downgrade
      startFPS();

      // flush timer
      clearInterval(this._flushTimer);
      this._flushTimer = setInterval(()=> this.flush(false), this.cfg.flushEveryMs);

      // flush hardened
      this.bindFlushHardened();

      // announce
      emit('groups:telemetry_status', this.status());

      return this;
    },

    status(){
      return {
        mode: this.mode,
        endpoint: !!this.endpoint,
        fps: FPS.fps,
        queuedBatches: this.queue.length + (this.curBatch ? 1 : 0),
        dropped: this.dropped,
        sentBatches: this.sentBatches,
        runMode: this.cfg ? this.cfg.runMode : 'unknown'
      };
    },

    setMode(m){
      m = String(m||'off').toLowerCase();
      if (!(m==='off'||m==='lite'||m==='full')) return;
      if (m === this.mode) return;
      const prev = this.mode;
      this.mode = m;
      emit('groups:telemetry_auto', { kind:'switch', from: prev, to: m, fps: FPS.fps });
      emit('groups:telemetry_status', this.status());
    },

    autoAdjust(){
      if (!this.cfg || !this.cfg.autoByFps) return;
      const runMode = this.cfg.runMode;
      if (runMode !== 'play') return;     // research/practice => fixed off by default
      if (this.mode === 'off') return;    // do not auto turn on

      const fps = FPS.fps || 60;
      // thresholds
      if (fps <= 24 && this.mode !== 'off') this.setMode('off');
      else if (fps <= 35 && this.mode === 'full') this.setMode('lite');
      else if (fps >= 48 && this.mode === 'off') this.setMode('lite');
    },

    shouldKeep(type){
      if (this.mode === 'off') return false;
      if (this.mode === 'full') return true;

      // lite: keep only high-signal events
      // (ยิง, เปลี่ยนหมู่/ภารกิจ, สรุปจบ, metrics สรุป, error)
      return (
        type === 'start' ||
        type === 'shoot' ||
        type === 'quest' ||
        type === 'progress' ||
        type === 'metrics' ||
        type === 'end' ||
        type === 'error'
      );
    },

    throttleOK(){
      const t = now();
      if (t - this.lastSecAt >= 1000){
        this.lastSecAt = t;
        this.secCount = 0;
      }
      if (this.secCount >= (this.cfg ? this.cfg.capPerSec : 60)) return false;
      this.secCount++;
      return true;
    },

    track(type, data){
      if (!this.cfg) return;
      this.autoAdjust();
      if (!this.shouldKeep(type)) return;

      if (!this.throttleOK()){
        this.dropped++;
        return;
      }

      const item = {
        ts: now(),
        t: String(type||'evt'),
        sid: this.sessionId,
        mode: this.mode,
        runMode: this.cfg.runMode,
        data: data || {}
      };

      // start current batch
      if (!this.curBatch) this.curBatch = { ts: now(), items: [] };
      this.curBatch.items.push(item);

      // cap batch
      if (this.curBatch.items.length >= this.cfg.maxEventsPerBatch){
        this.queue.push(this.curBatch);
        this.curBatch = null;

        // cap queue
        while (this.queue.length > this.cfg.maxQueueBatches){
          this.queue.shift();
          this.dropped += 10;
        }
        writeStore(this.queue);
      }

      // periodic status
      const t = now();
      if (t - this.lastStatusAt >= this.cfg.statusEveryMs){
        this.lastStatusAt = t;
        emit('groups:telemetry_status', this.status());
      }
    },

    async flush(isHard){
      if (!this.cfg) return false;
      if (this.mode === 'off') return false;
      if (!this.endpoint) { writeStore(this.queue); return false; }

      const t = now();
      if (!isHard && (t - this.lastFlushAt) < this.cfg.flushEveryMs*0.8) return false;
      this.lastFlushAt = t;

      // include current batch
      const batches = [];
      if (this.queue.length) batches.push(...this.queue);
      if (this.curBatch && this.curBatch.items.length){
        batches.push(this.curBatch);
        this.curBatch = null;
      }

      if (!batches.length) return true;

      // attempt send (keepalive when hard)
      const payload = {
        kind: 'hha_groups_telemetry',
        version: 1,
        at: t,
        sid: this.sessionId,
        status: this.status(),
        batches
      };

      const ok = await postJSON(this.endpoint, payload, !!isHard);
      if (ok){
        this.queue = [];
        writeStore([]);
        this.sentBatches += batches.length;
        saveLast(payload);
        emit('groups:telemetry_sent', { batches: batches.length });
        return true;
      }else{
        // keep in storage for recovery
        this.queue = batches.slice(0, this.cfg.maxQueueBatches);
        writeStore(this.queue);
        emit('groups:telemetry_sent', { ok:false, batches: batches.length });
        return false;
      }
    },

    bindFlushHardened(){
      const hard = ()=>{ try{ this.flush(true); }catch(_){ } };

      // pagehide: best for Safari/ios
      WIN.addEventListener('pagehide', hard, { capture:true });
      WIN.addEventListener('beforeunload', hard, { capture:true });

      DOC.addEventListener('visibilitychange', ()=>{
        if (DOC.visibilityState === 'hidden') hard();
      }, { capture:true });
    },

    exportJSON(){
      const out = {
        kind: 'hha_groups_telemetry_export',
        version: 1,
        at: now(),
        sid: this.sessionId,
        mode: this.mode,
        status: this.status(),
        queue: (this.queue||[]),
        curBatch: this.curBatch
      };
      return out;
    },

    downloadJSON(filename){
      const obj = this.exportJSON();
      const blob = new Blob([JSON.stringify(obj, null, 2)], { type:'application/json;charset=utf-8' });
      const a = DOC.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename || ('groups_telemetry_' + this.sessionId + '.json');
      DOC.body.appendChild(a);
      a.click();
      setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 250);
    },

    downloadCSV(filename){
      const exp = this.exportJSON();
      const rows = [];
      // flatten batches into row list
      const addBatch = (b)=>{
        if (!b || !b.items) return;
        for (const it of b.items){
          rows.push({
            ts: it.ts,
            type: it.t,
            sid: it.sid,
            runMode: it.runMode,
            mode: it.mode,
            fps: (exp.status && exp.status.fps) || '',
            ...flatten(it.data || {}, 'data')
          });
        }
      };
      (exp.queue||[]).forEach(addBatch);
      addBatch(exp.curBatch);

      const csv = toCSV(rows);
      const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
      const a = DOC.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename || ('groups_telemetry_' + this.sessionId + '.csv');
      DOC.body.appendChild(a);
      a.click();
      setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 250);
    }
  };

  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.Telemetry = Telemetry;

})();