// === /herohealth/js/hha-cloud-logger.js ===
// HeroHealth Cloud Logger Client — PRODUCTION (queue + offline + retry + flush-hardened)
// Works with Google Apps Script doPost endpoint (object_rows mode)
'use strict';

(function (global) {
  const WIN = global;
  const DOC = WIN.document;

  const VERSION = 'hha-cloud-logger-client-v1';
  const DEFAULT_SCHEMA = 'hha-cloud-logger-v1';

  const DEFAULTS = {
    endpoint: '',                 // required (Apps Script Web App URL)
    enabled: true,                // can be overridden by ?log=0
    autoFlushMs: 8000,            // periodic flush
    maxBatchEvents: 200,          // events per flush
    maxBatchSessions: 20,         // sessions per flush
    maxBatchProfiles: 20,         // profiles per flush
    maxQueueSize: 5000,           // cap total events in queue
    storageKey: 'HHA_CLOUD_LOGGER_QUEUE_V1',
    stateKey: 'HHA_CLOUD_LOGGER_STATE_V1',
    lastErrorKey: 'HHA_CLOUD_LOGGER_LAST_ERROR_V1',
    sendBeaconFallback: true,
    debug: false,
    game: '',
    zone: '',
    run: 'play',
    pid: 'anon',
    seed: '',
    view: '',
    difficulty: '',
    studyId: '',
    researchPhase: '',
    conditionGroup: '',
    variant: '',
    appVersion: '',
    gameVersion: '',
    schemaVersionSessions: 'hha-sessions-v1',
    schemaVersionEvents: 'hha-events-v1',
    onStatus: null, // fn(statusObj)
  };

  function nowMs() { return Date.now(); }
  function nowIso() { return new Date().toISOString(); }
  function randId(n = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < n; i++) s += chars[(Math.random() * chars.length) | 0];
    return s;
  }
  function clamp(v, a, b) {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function safeJson(v, fb) { try { return JSON.stringify(v); } catch { return fb || '{}'; } }
  function parseJson(s, fb) { try { return JSON.parse(s); } catch { return fb; } }

  function getQS() {
    try { return new URL(WIN.location.href).searchParams; }
    catch { return new URLSearchParams(); }
  }
  const QS = getQS();
  function qs(k, d = '') { return QS.get(k) ?? d; }

  function truthyLogParam(v) {
    const s = String(v ?? '').trim().toLowerCase();
    if (s === '' || s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
    if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
    return true;
  }

  function localDateParts() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return {
      date_local: `${yyyy}-${mm}-${dd}`,
      time_local: `${hh}:${mi}:${ss}`,
      timezone: tz
    };
  }

  function detectDeviceType() {
    const ua = navigator.userAgent || '';
    const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
    const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    if (mobileUA) return 'mobile';
    if (touch) return 'tablet_or_touch';
    return 'desktop';
  }

  function detectPlatform() {
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Win/i.test(ua)) return 'windows';
    if (/Mac/i.test(ua)) return 'mac';
    if (/Linux/i.test(ua)) return 'linux';
    return 'unknown';
  }

  function computeBackoffMs(attempt) {
    // 1s, 2s, 4s, 8s ... cap 60s + jitter
    const base = Math.min(60000, Math.pow(2, Math.max(0, attempt - 1)) * 1000);
    const jitter = (Math.random() * 400) | 0;
    return base + jitter;
  }

  function makeSessionId(game, pid) {
    return `${String(game || 'game')}_${String(pid || 'anon')}_${nowMs()}_${randId(6)}`;
  }

  class HHACloudLogger {
    constructor(userCfg = {}) {
      const endpointFromQS = String(qs('api', '')).trim(); // user sometimes passes ?api=
      const logFromQS = qs('log', '');
      const enabledFromQS = (logFromQS === '') ? undefined : truthyLogParam(logFromQS);

      this.cfg = Object.assign({}, DEFAULTS, userCfg || {});
      if (endpointFromQS && !this.cfg.endpoint) this.cfg.endpoint = endpointFromQS;
      if (enabledFromQS !== undefined) this.cfg.enabled = enabledFromQS;

      // normalize research params from QS if absent
      this.cfg.run = String(this.cfg.run || qs('run', 'play') || 'play').toLowerCase();
      this.cfg.pid = String(this.cfg.pid || qs('pid', 'anon') || 'anon').trim() || 'anon';
      this.cfg.seed = String(this.cfg.seed || qs('seed', '') || '');
      this.cfg.view = String(this.cfg.view || qs('view', '') || '');
      this.cfg.difficulty = String(this.cfg.difficulty || qs('diff', '') || '');
      this.cfg.studyId = String(this.cfg.studyId || qs('studyId', '') || '');
      this.cfg.researchPhase = String(this.cfg.researchPhase || qs('researchPhase', '') || qs('phase', '') || '');
      this.cfg.conditionGroup = String(this.cfg.conditionGroup || qs('conditionGroup', '') || '');
      this.cfg.variant = String(this.cfg.variant || qs('variant', '') || '');

      this._timer = 0;
      this._flushInFlight = false;
      this._destroyed = false;

      this.state = {
        attempt: 0,
        nextRetryAt: 0,
        lastFlushAt: 0,
        lastOkAt: 0,
        lastErrorAt: 0,
        lastError: '',
      };

      this.queue = {
        sessions: [],
        events: [],
        students_profile: []
      };

      this.currentSession = null;   // runtime session object (not yet finalized)
      this._eventSeq = 0;

      this._loadPersisted();
      this._bindLifecycle();
      this._startAutoFlush();

      this._emitStatus('init', { enabled: this.cfg.enabled, endpoint: !!this.cfg.endpoint });
      this.debug('init complete', { cfg: this.cfg, queueLens: this.lengths() });
    }

    /* ---------- public helpers ---------- */
    debug(...args) {
      if (!this.cfg.debug) return;
      try { console.log('[HHACloudLogger]', ...args); } catch (_) {}
    }

    enabled() {
      return !!this.cfg.enabled && !!String(this.cfg.endpoint || '').trim();
    }

    lengths() {
      return {
        sessions: this.queue.sessions.length,
        events: this.queue.events.length,
        students_profile: this.queue.students_profile.length,
        total: this.queue.sessions.length + this.queue.events.length + this.queue.students_profile.length
      };
    }

    setContext(ctx = {}) {
      Object.assign(this.cfg, ctx || {});
      this._persistStateOnly();
      return this;
    }

    setEndpoint(url) {
      this.cfg.endpoint = String(url || '').trim();
      this._persistStateOnly();
      return this;
    }

    setEnabled(flag) {
      this.cfg.enabled = !!flag;
      this._persistStateOnly();
      return this;
    }

    /* ---------- session orchestration ---------- */
    startSession(partial = {}) {
      const t0 = nowMs();
      const lp = localDateParts();
      const sessionId = partial.session_id || makeSessionId(partial.game || this.cfg.game, partial.pid || this.cfg.pid);

      this._eventSeq = 0;

      this.currentSession = Object.assign({
        session_id: sessionId,
        start_ts: t0,
        end_ts: '',
        date_local: lp.date_local,
        time_local: lp.time_local,
        timezone: lp.timezone,

        pid: partial.pid || this.cfg.pid || 'anon',
        player_name: partial.player_name || '',
        student_code: partial.student_code || '',
        grade: partial.grade || '',
        class_room: partial.class_room || '',
        school: partial.school || '',

        game: partial.game || this.cfg.game || '',
        game_title: partial.game_title || '',
        zone: partial.zone || this.cfg.zone || '',
        mode: partial.mode || '',
        run: partial.run || this.cfg.run || 'play',
        research_phase: partial.research_phase || this.cfg.researchPhase || '',
        study_id: partial.study_id || this.cfg.studyId || '',
        condition_group: partial.condition_group || this.cfg.conditionGroup || '',
        variant: partial.variant || this.cfg.variant || '',
        pick_mode: partial.pick_mode || '',

        difficulty: partial.difficulty || this.cfg.difficulty || '',
        session_time_sec_setting: partial.session_time_sec_setting ?? '',
        actual_duration_sec: '',
        view_mode: partial.view_mode || this.cfg.view || '',
        device_type: partial.device_type || detectDeviceType(),
        platform: partial.platform || detectPlatform(),
        user_agent: partial.user_agent || (navigator.userAgent || ''),

        seed: partial.seed || this.cfg.seed || '',
        deterministic_flag: partial.deterministic_flag ?? ((String(this.cfg.run) === 'research') ? 1 : 0),

        warmup_used: partial.warmup_used ?? '',
        warmup_type: partial.warmup_type || '',
        warmup_pct: partial.warmup_pct ?? '',
        warmup_rank: partial.warmup_rank || '',
        cooldown_used: partial.cooldown_used ?? '',

        completed: partial.completed ?? 0,
        quit_reason: partial.quit_reason || '',

        score: partial.score ?? 0,
        hits: partial.hits ?? 0,
        miss: partial.miss ?? 0,
        accuracy_pct: partial.accuracy_pct ?? 0,
        combo_max: partial.combo_max ?? '',
        level_reached: partial.level_reached ?? '',
        boss_phase_reached: partial.boss_phase_reached ?? '',

        hints_used: partial.hints_used ?? 0,
        coach_tips_shown: partial.coach_tips_shown ?? 0,
        coach_tips_used: partial.coach_tips_used ?? 0,
        safety_flags: partial.safety_flags || '',
        summary_json: partial.summary_json || {},

        api_log_enabled: this.enabled() ? 1 : 0,
        log_endpoint: this.cfg.endpoint || '',
        sync_status: 'queued',
        offline_cached: 0,
        retry_count: 0,

        app_version: partial.app_version || this.cfg.appVersion || '',
        game_version: partial.game_version || this.cfg.gameVersion || '',
        schema_version: partial.schema_version || this.cfg.schemaVersionSessions || 'hha-sessions-v1',
        created_at: nowIso(),
        updated_at: nowIso()
      }, partial || {});

      this.debug('startSession', this.currentSession.session_id);
      return this.currentSession.session_id;
    }

    patchSession(patch = {}) {
      if (!this.currentSession) return;
      Object.assign(this.currentSession, patch || {});
      this.currentSession.updated_at = nowIso();
    }

    endSession(patch = {}, opts = {}) {
      if (!this.currentSession) return null;

      const t1 = nowMs();
      const s = Object.assign({}, this.currentSession, patch || {});
      s.end_ts = s.end_ts || t1;
      s.actual_duration_sec = (s.actual_duration_sec !== '' && s.actual_duration_sec !== undefined)
        ? s.actual_duration_sec
        : Math.max(0, Math.round((Number(s.end_ts) - Number(s.start_ts)) / 1000));

      // auto accuracy if not supplied
      if (isBlankNumLike_(s.accuracy_pct)) {
        const denom = Number(s.hits || 0) + Number(s.miss || 0);
        s.accuracy_pct = denom > 0 ? round2_(Number(s.hits || 0) * 100 / denom) : 0;
      }

      s.api_log_enabled = this.enabled() ? 1 : 0;
      s.log_endpoint = this.cfg.endpoint || '';
      s.sync_status = 'queued';
      s.updated_at = nowIso();

      this.queue.sessions.push(s);
      this.currentSession = null;

      this._trimQueueIfNeeded();
      this._persistQueue();

      this.debug('endSession queued', s.session_id);

      if (opts.flushNow) {
        this.flush({ reason: 'endSession', urgent: true });
      }

      return s.session_id;
    }

    /* ---------- event logging ---------- */
    logEvent(evt = {}) {
      // lightweight no-op if disabled and no queue desired?
      // We STILL queue locally if enabled flag true but endpoint down. If disabled completely, skip.
      if (!this.cfg.enabled) return null;

      const lp = localDateParts();
      const ts = Number(evt.ts_ms || nowMs());
      const sessionId = evt.session_id || (this.currentSession && this.currentSession.session_id) || '';

      this._eventSeq += 1;

      const row = Object.assign({
        event_id: evt.event_id || `evt_${ts}_${this._eventSeq}_${randId(4)}`,
        session_id: sessionId,
        event_seq: evt.event_seq ?? this._eventSeq,
        ts_ms: ts,
        ts_iso: evt.ts_iso || new Date(ts).toISOString(),
        date_local: evt.date_local || lp.date_local,
        time_local: evt.time_local || lp.time_local,

        pid: evt.pid || (this.currentSession && this.currentSession.pid) || this.cfg.pid || 'anon',
        game: evt.game || (this.currentSession && this.currentSession.game) || this.cfg.game || '',
        zone: evt.zone || (this.currentSession && this.currentSession.zone) || this.cfg.zone || '',
        mode: evt.mode || (this.currentSession && this.currentSession.mode) || '',
        run: evt.run || (this.currentSession && this.currentSession.run) || this.cfg.run || 'play',
        research_phase: evt.research_phase || (this.currentSession && this.currentSession.research_phase) || this.cfg.researchPhase || '',
        study_id: evt.study_id || (this.currentSession && this.currentSession.study_id) || this.cfg.studyId || '',
        condition_group: evt.condition_group || (this.currentSession && this.currentSession.condition_group) || this.cfg.conditionGroup || '',
        variant: evt.variant || (this.currentSession && this.currentSession.variant) || this.cfg.variant || '',
        difficulty: evt.difficulty || (this.currentSession && this.currentSession.difficulty) || this.cfg.difficulty || '',
        view_mode: evt.view_mode || (this.currentSession && this.currentSession.view_mode) || this.cfg.view || '',
        seed: evt.seed || (this.currentSession && this.currentSession.seed) || this.cfg.seed || '',

        phase: evt.phase || '',
        event_type: evt.event_type || 'event',
        event_name: evt.event_name || '',
        action: evt.action || '',

        target_id: evt.target_id || '',
        target_type: evt.target_type || '',
        target_label: evt.target_label || '',

        scenario_id: evt.scenario_id || '',
        scenario_type: evt.scenario_type || '',
        step_id: evt.step_id || '',
        step_name: evt.step_name || '',
        item_id: evt.item_id || '',
        item_name: evt.item_name || '',
        food_group: evt.food_group || '',
        lane: evt.lane ?? '',
        slot: evt.slot ?? '',

        expected: toCell_(evt.expected),
        actual: toCell_(evt.actual),
        choice: toCell_(evt.choice),
        correct: evt.correct ?? '',
        score_delta: evt.score_delta ?? 0,
        combo: evt.combo ?? '',

        hp: evt.hp ?? '',
        shield: evt.shield ?? '',
        energy: evt.energy ?? '',
        resource_type: evt.resource_type || '',
        resource_delta: evt.resource_delta ?? '',

        value_num: evt.value_num ?? '',
        value_num2: evt.value_num2 ?? '',
        rt_ms: evt.rt_ms ?? '',
        timing_offset_ms: evt.timing_offset_ms ?? '',

        x: evt.x ?? '',
        y: evt.y ?? '',
        z: evt.z ?? '',
        norm_x: evt.norm_x ?? '',
        norm_y: evt.norm_y ?? '',
        zone_hit: evt.zone_hit ?? '',
        in_target_zone: evt.in_target_zone ?? '',

        hint_shown: evt.hint_shown ?? '',
        coach_tip_id: evt.coach_tip_id || '',
        coach_tip_type: evt.coach_tip_type || '',
        rationale_score: evt.rationale_score ?? '',
        priority_rank: evt.priority_rank ?? '',
        constraint_id: evt.constraint_id || '',
        constraint_ok: evt.constraint_ok ?? '',

        meta_json: evt.meta_json || evt.meta || {},
        client_ts: nowMs(),
        sync_status: 'queued',
        created_at: nowIso()
      }, evt || {});

      this.queue.events.push(row);
      this._trimQueueIfNeeded();
      this._persistQueue();

      return row.event_id;
    }

    logEvents(arr) {
      if (!Array.isArray(arr)) return 0;
      let n = 0;
      for (const e of arr) { if (this.logEvent(e)) n++; }
      return n;
    }

    upsertStudentProfile(profile = {}) {
      if (!this.cfg.enabled) return null;
      const lp = localDateParts();
      const row = Object.assign({
        pid: profile.pid || this.cfg.pid || 'anon',
        student_code: profile.student_code || '',
        prefix: profile.prefix || '',
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        display_name: profile.display_name || '',
        grade: profile.grade || '',
        class_room: profile.class_room || '',
        school: profile.school || '',
        campus: profile.campus || '',
        age: profile.age ?? '',
        sex: profile.sex || '',
        group_assignment: profile.group_assignment || '',
        condition_group: profile.condition_group || this.cfg.conditionGroup || '',
        consent_flag: profile.consent_flag ?? '',
        assent_flag: profile.assent_flag ?? '',
        parent_consent_flag: profile.parent_consent_flag ?? '',
        notes: profile.notes || '',
        active_flag: profile.active_flag ?? 1,
        created_at: profile.created_at || nowIso(),
        updated_at: nowIso()
      }, profile || {});
      this.queue.students_profile.push(row);
      this._persistQueue();
      return row.pid;
    }

    /* ---------- flushing ---------- */
    async flush(opts = {}) {
      const reason = String(opts.reason || 'manual');
      const urgent = !!opts.urgent;
      const force = !!opts.force;

      if (this._destroyed) return { ok: false, skipped: 'destroyed' };
      if (!this.enabled()) return { ok: false, skipped: 'disabled_or_no_endpoint' };

      const lens = this.lengths();
      if (lens.total <= 0) return { ok: true, skipped: 'empty' };

      if (this._flushInFlight && !force) return { ok: false, skipped: 'in_flight' };

      if (!force && this.state.nextRetryAt && nowMs() < this.state.nextRetryAt && !urgent) {
        return { ok: false, skipped: 'backoff', nextRetryAt: this.state.nextRetryAt };
      }

      this._flushInFlight = true;
      this._emitStatus('flush_start', { reason, lens });

      const payload = this._buildBatchPayload();
      if (!payload) {
        this._flushInFlight = false;
        return { ok: true, skipped: 'nothing_batched' };
      }

      let ok = false;
      let respData = null;
      let errMsg = '';

      try {
        // pagehide/beforeunload path: prefer sendBeacon for best effort
        if (urgent && this.cfg.sendBeaconFallback && navigator.sendBeacon) {
          const sent = this._sendViaBeacon(payload);
          if (sent) {
            // treat as best-effort success locally to avoid data loss loop on unload.
            this._commitBatchSuccess(payload, { beacon: true });
            this._flushInFlight = false;
            this._emitStatus('flush_ok', { reason, beacon: true, counts: payload._counts });
            return { ok: true, beacon: true, counts: payload._counts };
          }
        }

        const resp = await fetch(this.cfg.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.body),
          keepalive: urgent ? true : false,
          credentials: 'omit',
          cache: 'no-store'
        });

        let text = '';
        try { text = await resp.text(); } catch (_) {}
        respData = parseJson(text, { raw: text });

        // GAS often returns 200 always, so inspect body.ok too
        ok = !!(resp && resp.ok && (!isObj(respData) || respData.ok !== false));

        if (!ok) {
          errMsg = `HTTP ${resp.status} ${resp.statusText || ''}`.trim();
          if (respData && respData.message) errMsg += ` | ${respData.message}`;
        }
      } catch (err) {
        ok = false;
        errMsg = String(err && err.message ? err.message : err);
      }

      if (ok) {
        this._commitBatchSuccess(payload, respData);
        this._flushInFlight = false;
        this._emitStatus('flush_ok', { reason, counts: payload._counts, response: respData || null });
        return { ok: true, counts: payload._counts, response: respData };
      }

      this._commitBatchFailure(errMsg, payload);
      this._flushInFlight = false;
      this._emitStatus('flush_fail', { reason, error: errMsg });
      return { ok: false, error: errMsg, response: respData };
    }

    flushNow(reason = 'manual') {
      return this.flush({ reason, urgent: true, force: true });
    }

    /* ---------- internals ---------- */
    _buildBatchPayload() {
      const evN = Math.min(this.cfg.maxBatchEvents, this.queue.events.length);
      const ssN = Math.min(this.cfg.maxBatchSessions, this.queue.sessions.length);
      const spN = Math.min(this.cfg.maxBatchProfiles, this.queue.students_profile.length);

      if (evN + ssN + spN <= 0) return null;

      const sessions = this.queue.sessions.slice(0, ssN).map(x => Object.assign({}, x));
      const events = this.queue.events.slice(0, evN).map(x => Object.assign({}, x));
      const students_profile = this.queue.students_profile.slice(0, spN).map(x => Object.assign({}, x));

      // stamp sync metadata
      const queuedAt = nowIso();
      sessions.forEach(r => {
        r.sync_status = 'sending';
        r.retry_count = Number(r.retry_count || 0);
        r.updated_at = queuedAt;
      });
      events.forEach(r => { r.sync_status = 'sending'; });
      students_profile.forEach(r => { r.updated_at = queuedAt; });

      const body = {
        schema: DEFAULT_SCHEMA,
        mode: 'object_rows',
        client: VERSION,
        sent_at: queuedAt,
        rows: { sessions, events, students_profile }
      };

      return {
        body,
        _counts: { sessions: ssN, events: evN, students_profile: spN },
        _peekIds: {
          sessions: sessions.map(r => r.session_id),
          events: events.map(r => r.event_id),
          students_profile: students_profile.map(r => r.pid)
        }
      };
    }

    _sendViaBeacon(payload) {
      try {
        const blob = new Blob([JSON.stringify(payload.body)], { type: 'application/json' });
        return navigator.sendBeacon(this.cfg.endpoint, blob);
      } catch (_) {
        return false;
      }
    }

    _commitBatchSuccess(payload, respData) {
      const c = payload._counts || { sessions: 0, events: 0, students_profile: 0 };

      // Remove sent head rows (FIFO)
      if (c.sessions > 0) this.queue.sessions.splice(0, c.sessions);
      if (c.events > 0) this.queue.events.splice(0, c.events);
      if (c.students_profile > 0) this.queue.students_profile.splice(0, c.students_profile);

      this.state.attempt = 0;
      this.state.nextRetryAt = 0;
      this.state.lastFlushAt = nowMs();
      this.state.lastOkAt = nowMs();
      this.state.lastError = '';

      this._persistQueue();
      this._persistStateOnly();

      try {
        sessionStorage.removeItem(this.cfg.lastErrorKey);
      } catch (_) {}

      this.debug('flush success', c, respData || null);
    }

    _commitBatchFailure(errMsg, payload) {
      this.state.attempt = Number(this.state.attempt || 0) + 1;
      this.state.lastFlushAt = nowMs();
      this.state.lastErrorAt = nowMs();
      this.state.lastError = String(errMsg || 'Unknown flush error');
      this.state.nextRetryAt = nowMs() + computeBackoffMs(this.state.attempt);

      // mark queued rows as retried (best effort, only for current head batch sizes)
      const c = payload && payload._counts ? payload._counts : { sessions: 0, events: 0, students_profile: 0 };
      for (let i = 0; i < Math.min(c.sessions || 0, this.queue.sessions.length); i++) {
        const r = this.queue.sessions[i];
        r.sync_status = 'queued';
        r.retry_count = Number(r.retry_count || 0) + 1;
        r.offline_cached = 1;
        r.updated_at = nowIso();
      }
      for (let i = 0; i < Math.min(c.events || 0, this.queue.events.length); i++) {
        const r = this.queue.events[i];
        r.sync_status = 'queued';
      }

      this._persistQueue();
      this._persistStateOnly();
      try {
        localStorage.setItem(this.cfg.lastErrorKey, safeJson({
          ts: nowIso(),
          attempt: this.state.attempt,
          nextRetryAt: this.state.nextRetryAt,
          error: this.state.lastError
        }));
      } catch (_) {}

      this.debug('flush fail', errMsg, { attempt: this.state.attempt, nextRetryAt: this.state.nextRetryAt });
    }

    _trimQueueIfNeeded() {
      const lens = this.lengths();
      if (lens.total <= this.cfg.maxQueueSize) return;

      // drop oldest events first (most numerous), keep sessions if possible
      let over = lens.total - this.cfg.maxQueueSize;

      while (over > 0 && this.queue.events.length > 0) {
        this.queue.events.shift();
        over--;
      }
      while (over > 0 && this.queue.sessions.length > 0) {
        this.queue.sessions.shift();
        over--;
      }
      while (over > 0 && this.queue.students_profile.length > 0) {
        this.queue.students_profile.shift();
        over--;
      }

      this._emitStatus('queue_trim', { lens: this.lengths() });
    }

    _loadPersisted() {
      try {
        const rawQ = localStorage.getItem(this.cfg.storageKey);
        if (rawQ) {
          const q = parseJson(rawQ, null);
          if (q && isObj(q)) {
            this.queue.sessions = Array.isArray(q.sessions) ? q.sessions : [];
            this.queue.events = Array.isArray(q.events) ? q.events : [];
            this.queue.students_profile = Array.isArray(q.students_profile) ? q.students_profile : [];
          }
        }
      } catch (_) {}

      try {
        const rawS = localStorage.getItem(this.cfg.stateKey);
        if (rawS) {
          const s = parseJson(rawS, null);
          if (s && isObj(s)) this.state = Object.assign(this.state, s);
        }
      } catch (_) {}
    }

    _persistQueue() {
      try {
        localStorage.setItem(this.cfg.storageKey, JSON.stringify(this.queue));
      } catch (err) {
        // If storage full, trim aggressively and retry once
        this._trimStorageEmergency();
        try { localStorage.setItem(this.cfg.storageKey, JSON.stringify(this.queue)); } catch (_) {}
      }
      this._persistStateOnly();
    }

    _persistStateOnly() {
      try {
        localStorage.setItem(this.cfg.stateKey, JSON.stringify({
          attempt: this.state.attempt,
          nextRetryAt: this.state.nextRetryAt,
          lastFlushAt: this.state.lastFlushAt,
          lastOkAt: this.state.lastOkAt,
          lastErrorAt: this.state.lastErrorAt,
          lastError: this.state.lastError,
          cfgMeta: {
            endpoint: this.cfg.endpoint || '',
            enabled: !!this.cfg.enabled,
            game: this.cfg.game || '',
            zone: this.cfg.zone || '',
            pid: this.cfg.pid || 'anon'
          },
          saved_at: nowIso()
        }));
      } catch (_) {}
    }

    _trimStorageEmergency() {
      // keep sessions, trim events heavily
      if (this.queue.events.length > 100) {
        this.queue.events = this.queue.events.slice(-100);
      } else if (this.queue.events.length > 20) {
        this.queue.events = this.queue.events.slice(-20);
      }
    }

    _startAutoFlush() {
      if (this._timer) clearInterval(this._timer);
      this._timer = setInterval(() => {
        if (this._destroyed) return;
        if (!this.enabled()) return;
        const lens = this.lengths();
        if (lens.total <= 0) return;
        this.flush({ reason: 'interval' });
      }, clamp(this.cfg.autoFlushMs, 2000, 60000));
    }

    _bindLifecycle() {
      const onOnline = () => {
        this._emitStatus('online', {});
        this.flush({ reason: 'online', force: true });
      };
      const onHidden = () => {
        if (DOC.hidden) this.flush({ reason: 'visibility_hidden', urgent: true });
      };
      const onPageHide = () => this.flush({ reason: 'pagehide', urgent: true });
      const onBeforeUnload = () => this.flush({ reason: 'beforeunload', urgent: true });

      WIN.addEventListener('online', onOnline);
      DOC.addEventListener('visibilitychange', onHidden);
      WIN.addEventListener('pagehide', onPageHide);
      WIN.addEventListener('beforeunload', onBeforeUnload);

      this._unbinders = [
        () => WIN.removeEventListener('online', onOnline),
        () => DOC.removeEventListener('visibilitychange', onHidden),
        () => WIN.removeEventListener('pagehide', onPageHide),
        () => WIN.removeEventListener('beforeunload', onBeforeUnload),
      ];
    }

    _emitStatus(type, extra) {
      const payload = Object.assign({
        type,
        ts: nowMs(),
        enabled: this.enabled(),
        queue: this.lengths(),
        attempt: this.state.attempt,
        nextRetryAt: this.state.nextRetryAt,
        lastOkAt: this.state.lastOkAt,
        lastErrorAt: this.state.lastErrorAt,
        lastError: this.state.lastError || ''
      }, extra || {});
      if (typeof this.cfg.onStatus === 'function') {
        try { this.cfg.onStatus(payload); } catch (_) {}
      }
    }

    destroy(opts = {}) {
      this._destroyed = true;
      if (this._timer) clearInterval(this._timer);
      this._timer = 0;
      try { (this._unbinders || []).forEach(fn => fn()); } catch (_) {}
      if (opts.flush) this.flush({ reason: 'destroy', urgent: true, force: true });
    }

    /* ---------- convenience wrappers for HHA Standard ---------- */
    hhaSessionStart(meta = {}) {
      return this.startSession(meta);
    }

    hhaEvent(name, patch = {}) {
      return this.logEvent(Object.assign({ event_name: name }, patch || {}));
    }

    hhaSummaryAndEnd(summary = {}, patch = {}, opts = { flushNow: true }) {
      // summary -> session.summary_json + key metrics if supplied
      const s = Object.assign({}, patch || {});
      s.summary_json = summary || {};
      if (summary && typeof summary === 'object') {
        if (summary.score != null && s.score == null) s.score = summary.score;
        if (summary.hits != null && s.hits == null) s.hits = summary.hits;
        if (summary.miss != null && s.miss == null) s.miss = summary.miss;
        if (summary.combo_max != null && s.combo_max == null) s.combo_max = summary.combo_max;
        if (summary.completed != null && s.completed == null) s.completed = summary.completed;
      }
      return this.endSession(s, opts || { flushNow: true });
    }
  }

  /* ---------- utility ---------- */
  function toCell_(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return safeJson(v, '{}');
    return v;
  }
  function isBlankNumLike_(v) {
    return v === '' || v === null || v === undefined || Number.isNaN(Number(v));
  }
  function round2_(n) {
    n = Number(n || 0);
    return Math.round(n * 100) / 100;
  }

  /* ---------- factory helpers ---------- */
  function createHHACloudLogger(cfg = {}) {
    return new HHACloudLogger(cfg);
  }

  // expose
  global.HHACloudLogger = HHACloudLogger;
  global.createHHACloudLogger = createHHACloudLogger;

})(window);