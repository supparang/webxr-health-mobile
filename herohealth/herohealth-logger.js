(function (W) {
  'use strict';

  function rid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function nowMs() { return Date.now(); }
  function nowIso() { return new Date().toISOString(); }

  function dateParts(ts) {
    const d = new Date(ts || Date.now());
    const pad = n => String(n).padStart(2, '0');
    return {
      date_local: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
      time_local: pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
    };
  }

  function safeJson(x) {
    try { return JSON.stringify(x); } catch { return '[]'; }
  }

  async function postJson(url, body, keepalive) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      keepalive: !!keepalive
    });

    const txt = await res.text();
    try { return JSON.parse(txt); }
    catch { return { ok: res.ok, raw: txt, status: res.status }; }
  }

  class HeroHealthLogger {
    constructor(opts) {
      opts = opts || {};
      this.endpoint = String(opts.endpoint || W.HHA_APPS_SCRIPT_URL || '').trim();
      this.secret = String(opts.secret || W.HHA_INGEST_SECRET || '').trim();
      this.flushEvery = Number(opts.flushEvery || 25);
      this.flushMs = Number(opts.flushMs || 8000);
      this.storageKey = opts.storageKey || 'HHA_PENDING_EVENTS';
      this.session = null;
      this.eventSeq = 0;
      this.queue = [];
      this.timer = null;
      this.appVersion = opts.appVersion || W.HHA_APP_VERSION || 'dev';
      this.disabledReason = '';
      this.base = Object.assign({
        pid: 'anon',
        uid: '',
        display_name: '',
        student_code: '',
        class_room: '',
        school_code: '',
        study_id: '',
        game: '',
        zone: '',
        mode: 'solo',
        role: '',
        team_id: '',
        run: 'play',
        diff: 'normal',
        time_sec: 90,
        seed: String(Date.now()),
        view: '',
        device_type: '',
        hub: '',
        referrer: document.referrer || '',
        app_version: this.appVersion
      }, opts.base || {});

      this.loadPending_();
      this.installUnload_();
    }

    setBase(patch) {
      Object.assign(this.base, patch || {});
    }

    setEndpoint(endpoint) {
      this.endpoint = String(endpoint || '').trim();
      return this.endpoint;
    }

    isEnabled() {
      return !!this.endpoint;
    }

    startSession(patch) {
      const started = nowMs();
      const base = Object.assign({}, this.base, patch || {});
      this.session = Object.assign({}, base, {
        session_id: rid('S'),
        started_at_ms: started,
        ended_at_ms: '',
        duration_ms: '',
        score: '',
        correct: '',
        wrong: '',
        miss: '',
        best_streak: '',
        accuracy: '',
        rank: '',
        stars: '',
        medal: '',
        contribution: '',
        team_score: '',
        outcome: ''
      });
      this.eventSeq = 0;
      this.startTimer_();

      this.send_({
        type: 'session_start',
        row: this.session,
        secret: this.secret
      }).catch(() => {});

      return this.session;
    }

    event(eventType, detail) {
      if (!this.session) return null;

      const ts = nowMs();
      const dp = dateParts(ts);
      const d = detail || {};

      const row = {
        event_id: rid('E'),
        session_id: this.session.session_id,
        match_id: d.match_id || this.session.match_id || '',
        room_id: d.room_id || this.session.room_id || '',
        event_seq: ++this.eventSeq,
        ts_ms: ts,
        ts_iso: nowIso(),
        date_local: dp.date_local,
        time_local: dp.time_local,
        uid: d.uid || this.base.uid || '',
        pid: d.pid || this.base.pid || 'anon',
        game: d.game || this.base.game || '',
        zone: d.zone || this.base.zone || '',
        mode: d.mode || this.base.mode || 'solo',
        phase: d.phase || '',
        event_type: eventType,
        target_id: d.target_id || '',
        item_id: d.item_id || '',
        action: d.action || '',
        result: d.result || '',
        score_delta: numOrBlank_(d.score_delta),
        score_total: numOrBlank_(d.score_total),
        streak: numOrBlank_(d.streak),
        miss_total: numOrBlank_(d.miss_total),
        hp: numOrBlank_(d.hp),
        lives: numOrBlank_(d.lives),
        progress: numOrBlank_(d.progress),
        x: numOrBlank_(d.x),
        y: numOrBlank_(d.y),
        z: numOrBlank_(d.z),
        payload_json: d.payload_json || {}
      };

      this.queue.push(row);
      this.persistPending_();

      if (this.queue.length >= this.flushEvery) {
        this.flush('size').catch(() => {});
      }

      return row;
    }

    async flush(reason) {
      if (!this.queue.length) {
        return { ok: true, skipped: true, reason: 'empty_queue' };
      }

      if (!this.endpoint) {
        this.disabledReason = 'missing_endpoint';
        console.warn('[HeroHealthLogger] missing Apps Script endpoint, skip flush');
        return { ok: false, skipped: true, error: 'missing_endpoint' };
      }

      const rows = this.queue.slice();
      try {
        const out = await this.send_({
          type: 'event_batch',
          rows,
          reason: reason || 'manual',
          secret: this.secret
        });

        if (out && out.ok) {
          this.queue.splice(0, rows.length);
          this.persistPending_();
        }

        return out;
      } catch (err) {
        this.persistPending_();
        return {
          ok: false,
          skipped: true,
          error: err && err.message ? err.message : String(err)
        };
      }
    }

    async endSession(summary) {
      summary = summary || {};
      if (!this.session) return { ok: false, error: 'no_session' };

      await this.flush('before_end').catch(() => ({ ok: false, skipped: true }));

      const ended = nowMs();
      const row = Object.assign({}, this.session, summary, {
        ended_at_ms: ended,
        duration_ms: ended - Number(this.session.started_at_ms || ended)
      });

      const out = await this.send_({
        type: 'session_end',
        row,
        secret: this.secret
      }).catch((err) => ({
        ok: false,
        skipped: true,
        error: err && err.message ? err.message : String(err)
      }));

      this.stopTimer_();
      this.session = null;
      return out;
    }

    async modeResults(rows) {
      rows = Array.isArray(rows) ? rows : [];
      if (!rows.length) return { ok: true, skipped: true, reason: 'empty_rows' };

      return this.send_({
        type: 'mode_results_batch',
        rows,
        secret: this.secret
      }).catch((err) => ({
        ok: false,
        skipped: true,
        error: err && err.message ? err.message : String(err)
      }));
    }

    async roomAudit(action, detail) {
      const row = {
        audit_id: rid('A'),
        room_id: detail && detail.room_id || '',
        match_id: detail && detail.match_id || '',
        game: detail && detail.game || this.base.game || '',
        mode: detail && detail.mode || this.base.mode || '',
        actor_uid: detail && detail.actor_uid || this.base.uid || '',
        actor_pid: detail && detail.actor_pid || this.base.pid || '',
        action: action || '',
        detail_json: detail || {},
        ts_ms: nowMs(),
        ts_iso: nowIso()
      };

      return this.send_({
        type: 'room_audit_batch',
        rows: [row],
        secret: this.secret
      }).catch((err) => ({
        ok: false,
        skipped: true,
        error: err && err.message ? err.message : String(err)
      }));
    }

    async error(err, extra) {
      const row = {
        error_id: rid('ERR'),
        session_id: this.session && this.session.session_id || '',
        match_id: this.session && this.session.match_id || '',
        room_id: this.session && this.session.room_id || '',
        uid: this.base.uid || '',
        pid: this.base.pid || '',
        game: this.base.game || '',
        mode: this.base.mode || '',
        stage: extra && extra.stage || '',
        message: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : '',
        extra_json: extra || {},
        ts_ms: nowMs(),
        ts_iso: nowIso()
      };

      return this.send_({
        type: 'error_batch',
        rows: [row],
        secret: this.secret
      }).catch((sendErr) => ({
        ok: false,
        skipped: true,
        error: sendErr && sendErr.message ? sendErr.message : String(sendErr)
      }));
    }

    async profileUpsert(row) {
      return this.send_({
        type: 'profile_upsert',
        row,
        secret: this.secret
      }).catch((err) => ({
        ok: false,
        skipped: true,
        error: err && err.message ? err.message : String(err)
      }));
    }

    async dryRun() {
      return this.send_({
        type: 'event_batch',
        rows: [],
        dry_run: true,
        secret: this.secret
      }).catch((err) => ({
        ok: false,
        skipped: true,
        error: err && err.message ? err.message : String(err)
      }));
    }

    async send_(body) {
      if (!this.endpoint) {
        this.disabledReason = 'missing_endpoint';
        console.warn('[HeroHealthLogger] missing Apps Script endpoint, skip log:', body && body.type);
        return { ok: false, skipped: true, error: 'missing_endpoint' };
      }

      try {
        const out = await postJson(this.endpoint, body, false);
        return out && typeof out === 'object'
          ? out
          : { ok: true, raw: out };
      } catch (err) {
        console.warn('[HeroHealthLogger] send failed:', err && err.message ? err.message : err);
        return {
          ok: false,
          skipped: true,
          error: err && err.message ? err.message : String(err)
        };
      }
    }

    startTimer_() {
      this.stopTimer_();
      this.timer = setInterval(() => {
        this.flush('interval').catch(() => {});
      }, this.flushMs);
    }

    stopTimer_() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }

    persistPending_() {
      try {
        localStorage.setItem(this.storageKey, safeJson(this.queue));
      } catch (_) {}
    }

    loadPending_() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) this.queue = arr.concat(this.queue);
      } catch (_) {}
    }

    installUnload_() {
      W.addEventListener('pagehide', () => {
        if (!this.endpoint || !this.queue.length) return;
        try {
          navigator.sendBeacon(
            this.endpoint,
            new Blob([JSON.stringify({
              type: 'event_batch',
              rows: this.queue,
              secret: this.secret,
              reason: 'pagehide'
            })], { type: 'text/plain;charset=utf-8' })
          );
        } catch (_) {}
      });
    }
  }

  function numOrBlank_(v) {
    return Number.isFinite(Number(v)) ? Number(v) : '';
  }

  W.HeroHealthLogger = HeroHealthLogger;
})(window);