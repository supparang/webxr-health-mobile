// === /herohealth/vr-groups/telemetry.js ===
// GroupsVR Telemetry Pack 13 — PRODUCTION
// ✅ Levels: off | lite | full  (query: ?telem=off|lite|full)
// ✅ Defaults: play->lite, research/practice->off (hard gate)
// ✅ Throttle + batching + sampling (anti-spam)
// ✅ Flush-hardened: pagehide/visibilitychange/freeze/beforeunload
// ✅ Recovery: persist queue to localStorage, auto-restore on next run
// ✅ Export: JSON + CSV (for recovery / offline analysis)
// ✅ Optional: send to ?log=<endpoint> via sendBeacon/fetch(keepalive)

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  if (NS.Telemetry && NS.Telemetry.__loaded__) return;

  function nowMs() { return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function isoNow() { try { return new Date().toISOString(); } catch { return String(Date.now()); } }
  function clamp(v, a, b) { v = Number(v); if (!isFinite(v)) v = a; return v < a ? a : (v > b ? b : v); }

  function qs(k, def = null) {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function stableId() {
    // per tab session id (not persisted)
    return 'tlm_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  }

  function pickLevel(runMode) {
    // Hard gate (สำคัญมาก): research/practice => OFF เสมอ
    const rm = String(runMode || '').toLowerCase();
    if (rm === 'research' || rm === 'practice') return 'off';

    const p = String(qs('telem', '') || '').toLowerCase();
    if (p === 'off' || p === '0') return 'off';
    if (p === 'full' || p === '2') return 'full';
    if (p === 'lite' || p === '1') return 'lite';

    // default (play)
    return 'lite';
  }

  function getEndpoint() {
    const u = String(qs('log', '') || '').trim();
    return u ? u : '';
  }

  function csvEscape(v) {
    const s = String(v ?? '');
    if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function flattenToKV(obj, prefix, out) {
    out = out || {};
    prefix = prefix || '';
    if (!obj || typeof obj !== 'object') {
      out[prefix || 'value'] = obj;
      return out;
    }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      const key = prefix ? (prefix + '.' + k) : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flattenToKV(v, key, out);
      else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
    }
    return out;
  }

  const Telemetry = {
    __loaded__: true,

    // config/meta
    level: 'off',
    endpoint: '',
    sid: stableId(),
    gameTag: 'GroupsVR',
    projectTag: 'HeroHealth',
    runMode: 'play',
    diff: '',
    style: '',
    view: '',
    seed: '',
    studyId: '',

    // queue/batching
    q: [],
    maxQ: 900,          // กัน localStorage บวม
    maxBatch: 40,
    flushEveryMs: 1600, // throttle flush
    persistEveryMs: 1200,
    minEventGapMs: 60,  // กันยิง event รัวเกิน

    // lite sampling
    liteSampleRate: 0.18, // 18% สำหรับ event ถี่ ๆ (เช่น hit)
    fullSampleRate: 1.00,

    // internal
    _lastEventAt: 0,
    _lastFlushAt: 0,
    _lastPersistAt: 0,
    _flushTimer: 0,
    _installed: false,

    // keys
    LS_Q: 'HHA_TLMQ_GroupsVR',
    LS_META: 'HHA_TLM_META_GroupsVR',

    init(meta) {
      meta = meta || {};

      this.gameTag = String(meta.gameTag || this.gameTag);
      this.projectTag = String(meta.projectTag || this.projectTag);
      this.runMode = String(meta.runMode || this.runMode);
      this.diff = String(meta.diff || qs('diff', '') || '');
      this.style = String(meta.style || qs('style', '') || '');
      this.view = String(meta.view || qs('view', '') || '');
      this.seed = String(meta.seed || qs('seed', '') || '');
      this.studyId = String(meta.studyId || qs('studyId', '') || '');

      this.level = pickLevel(this.runMode);
      this.endpoint = String(meta.endpoint || getEndpoint() || '');

      // restore queue (recovery)
      this._restore();

      // install flush-hardened listeners once
      if (!this._installed) {
        this._installed = true;
        this._installGuards();
      }

      // emit start (lite/full only)
      this.log('session_start', {
        sid: this.sid,
        level: this.level,
        endpoint: this.endpoint ? 1 : 0,
        runMode: this.runMode,
        diff: this.diff,
        style: this.style,
        view: this.view,
        seed: this.seed,
        studyId: this.studyId
      }, { important: true });

      // schedule periodic flush (only if endpoint)
      this._armFlushLoop();

      return this;
    },

    setLevel(level) {
      level = String(level || '').toLowerCase();
      if (!['off', 'lite', 'full'].includes(level)) level = 'lite';
      // hard gate again
      if (this.runMode === 'research' || this.runMode === 'practice') level = 'off';
      this.level = level;
      this._persistMeta();
      this.log('level_set', { level }, { important: true });
    },

    // main logger
    log(type, data, opt) {
      if (this.level === 'off') return false;

      const t = nowMs();
      if (t - this._lastEventAt < this.minEventGapMs) {
        // allow important even if gap
        opt = opt || {};
        if (!opt.important) return false;
      }
      this._lastEventAt = t;

      type = String(type || 'event');
      data = data || {};
      opt = opt || {};

      // sampling for spammy event types
      const spammy =
        type === 'hit_good' || type === 'hit_wrong' || type === 'hit_junk' ||
        type === 'spawn' || type === 'tick' || type === 'aim_miss';

      if (spammy) {
        const sr = (this.level === 'full') ? this.fullSampleRate : this.liteSampleRate;
        if (Math.random() > sr && !opt.important) return false;
      }

      const evt = {
        t: isoNow(),
        ms: Math.round(t),
        sid: this.sid,
        projectTag: this.projectTag,
        gameTag: this.gameTag,
        runMode: this.runMode,
        diff: this.diff,
        style: this.style,
        view: this.view,
        seed: this.seed,
        studyId: this.studyId,
        type,
        data
      };

      // push with cap
      this.q.push(evt);
      if (this.q.length > this.maxQ) this.q.splice(0, this.q.length - this.maxQ);

      // persist + maybe flush (throttled)
      this._maybePersist();
      this._maybeFlush();

      return true;
    },

    // export
    exportJSON(pretty) {
      const payload = this._buildPayload(this.q);
      try { return JSON.stringify(payload, null, pretty ? 2 : 0); }
      catch { return String(payload); }
    },

    exportCSV() {
      const rows = [];
      const baseCols = [
        't', 'ms', 'sid', 'projectTag', 'gameTag', 'runMode', 'diff', 'style', 'view', 'seed', 'studyId', 'type'
      ];

      // flatten data keys union (bounded)
      const keySet = new Set();
      for (let i = 0; i < this.q.length; i++) {
        const kv = flattenToKV(this.q[i].data || {}, 'data', {});
        Object.keys(kv).forEach(k => keySet.add(k));
        if (keySet.size > 60) break; // cap columns
      }
      const dataCols = Array.from(keySet);

      const header = baseCols.concat(dataCols);
      rows.push(header.map(csvEscape).join(','));

      for (const e of this.q) {
        const kv = flattenToKV(e.data || {}, 'data', {});
        const line = [];
        for (const c of baseCols) line.push(csvEscape(e[c] ?? ''));
        for (const c of dataCols) line.push(csvEscape(kv[c] ?? ''));
        rows.push(line.join(','));
      }
      return rows.join('\n');
    },

    clearQueue() {
      this.q = [];
      this._persistQueue();
    },

    // flush (manual)
    async flushNow(reason) {
      reason = String(reason || 'manual');
      if (!this.endpoint) {
        // even if no endpoint, persist to keep recoverable
        this._persistQueue();
        return { ok: false, reason: 'no-endpoint', queued: this.q.length };
      }

      const batch = this.q.slice(0, this.maxBatch);
      if (!batch.length) return { ok: true, reason: 'empty', sent: 0 };

      const payload = this._buildPayload(batch, { reason });

      // try sendBeacon first (best for unload/pagehide)
      const body = JSON.stringify(payload);
      let ok = false;

      try {
        if (navigator && typeof navigator.sendBeacon === 'function') {
          ok = navigator.sendBeacon(this.endpoint, new Blob([body], { type: 'application/json' }));
        }
      } catch (_) {}

      if (!ok) {
        try {
          const res = await fetch(this.endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
            keepalive: true,
            mode: 'no-cors'
          });
          // no-cors may not give status; treat fetch resolve as ok-ish
          ok = !!res;
        } catch (_) {
          ok = false;
        }
      }

      if (ok) {
        this.q.splice(0, batch.length);
        this._persistQueue();
        return { ok: true, reason: 'sent', sent: batch.length, remaining: this.q.length };
      }

      // fail -> keep queue (recovery)
      this._persistQueue();
      return { ok: false, reason: 'send-failed', queued: this.q.length };
    },

    // ============== internals ==============
    _buildPayload(events, extra) {
      extra = extra || {};
      const ctx = (NS.getResearchCtx && typeof NS.getResearchCtx === 'function') ? (NS.getResearchCtx() || {}) : {};
      return {
        v: 1,
        ts: isoNow(),
        sid: this.sid,
        projectTag: this.projectTag,
        gameTag: this.gameTag,
        runMode: this.runMode,
        diff: this.diff,
        style: this.style,
        view: this.view,
        seed: this.seed,
        studyId: this.studyId,
        level: this.level,
        endpoint: this.endpoint ? 1 : 0,
        ctx,
        extra,
        n: events.length,
        events
      };
    },

    _armFlushLoop() {
      clearInterval(this._flushTimer);
      // flush loop only if endpoint + level on
      if (!this.endpoint || this.level === 'off') return;
      this._flushTimer = setInterval(() => {
        this._maybeFlush(true);
      }, 900);
    },

    _maybeFlush(periodic) {
      if (!this.endpoint) return;
      const t = nowMs();
      if (t - this._lastFlushAt < this.flushEveryMs) return;
      if (this.q.length < (periodic ? 12 : 1)) return; // periodic waits for some buffer
      this._lastFlushAt = t;
      // fire and forget
      this.flushNow(periodic ? 'periodic' : 'auto').catch(() => {});
    },

    _maybePersist() {
      const t = nowMs();
      if (t - this._lastPersistAt < this.persistEveryMs) return;
      this._lastPersistAt = t;
      this._persistQueue();
      this._persistMeta();
    },

    _persistMeta() {
      try {
        const meta = {
          level: this.level,
          endpoint: this.endpoint,
          gameTag: this.gameTag,
          projectTag: this.projectTag
        };
        localStorage.setItem(this.LS_META, JSON.stringify(meta));
      } catch (_) {}
    },

    _persistQueue() {
      try {
        const packed = { ts: isoNow(), sid: this.sid, q: this.q };
        localStorage.setItem(this.LS_Q, JSON.stringify(packed));
      } catch (_) {}
    },

    _restore() {
      // restore meta (only if query didn't override)
      try {
        const meta = safeJsonParse(localStorage.getItem(this.LS_META) || '{}', {});
        if (meta && typeof meta === 'object') {
          // if no explicit query telem param, keep last chosen
          const qLevel = String(qs('telem', '') || '');
          if (!qLevel && meta.level) this.level = String(meta.level);
          // endpoint can be restored only if no ?log=
          if (!getEndpoint() && meta.endpoint) this.endpoint = String(meta.endpoint);
        }
      } catch (_) {}

      // restore queue
      try {
        const packed = safeJsonParse(localStorage.getItem(this.LS_Q) || '', null);
        if (packed && Array.isArray(packed.q) && packed.q.length) {
          // merge (keep current + old)
          const old = packed.q.slice(0, this.maxQ);
          // avoid exploding
          const merged = old.concat(this.q);
          this.q = merged.slice(Math.max(0, merged.length - this.maxQ));
        }
      } catch (_) {}
    },

    _installGuards() {
      // flush at leave/hide/freeze
      const flushHard = () => {
        try { this._persistQueue(); } catch (_) {}
        try { this.flushNow('leave').catch(() => {}); } catch (_) {}
      };

      root.addEventListener('pagehide', flushHard, { capture: true });
      root.addEventListener('beforeunload', flushHard, { capture: true });
      DOC.addEventListener('visibilitychange', () => {
        if (DOC.visibilityState === 'hidden') flushHard();
      }, { capture: true });

      // Chrome "freeze"
      root.addEventListener('freeze', flushHard, { capture: true });

      // best-effort: flush when coming back online
      root.addEventListener('online', () => {
        try { this.flushNow('online').catch(() => {}); } catch (_) {}
      }, { passive: true });
    }
  };

  NS.Telemetry = Telemetry;

})(typeof window !== 'undefined' ? window : globalThis);