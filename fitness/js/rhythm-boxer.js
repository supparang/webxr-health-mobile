// === /fitness/js/rhythm-boxer.js ===
// Rhythm Boxer UI Controller — LOCAL-FIRST + 403-safe remote logging
// ✅ Menu / Play / Result flow
// ✅ Wires engine HUD + renderer
// ✅ CSV download (events/sessions)
// ✅ Optional remote logging (?log=1&api=...)
// ✅ Auto-disable remote on 401/403 (no retry spam)
// ✅ Flush status badge on result page
'use strict';

(function () {
  const WIN = window;
  const DOC = document;

  const $ = (s, root = DOC) => root.querySelector(s);
  const $$ = (s, root = DOC) => Array.from(root.querySelectorAll(s));

  function qs(name, fallback = '') {
    try {
      const u = new URL(WIN.location.href);
      const v = u.searchParams.get(name);
      return (v == null || v === '') ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function clamp(v, a, b) {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function fmtNum(n, d = 2) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(d) : '-';
  }

  // ---------------------------
  // Remote log guard (403-safe)
  // ---------------------------
  const REMOTE_LATCH_KEY = 'RB_REMOTE_DISABLED';
  const REMOTE_LATCH_TTL_MS = 15 * 60 * 1000;

  function disableRemote(code, reason) {
    try {
      sessionStorage.setItem(REMOTE_LATCH_KEY, JSON.stringify({
        code: Number(code) || 403,
        reason: String(reason || ''),
        ts: Date.now()
      }));
    } catch (_) {}
  }

  function clearRemoteDisable() {
    try { sessionStorage.removeItem(REMOTE_LATCH_KEY); } catch (_) {}
  }

  function getRemoteDisableInfo() {
    try {
      const raw = sessionStorage.getItem(REMOTE_LATCH_KEY);
      if (!raw) return { disabled: false };
      const d = JSON.parse(raw);
      if (!d || !d.ts) return { disabled: false };
      const age = Date.now() - Number(d.ts || 0);
      if (age > REMOTE_LATCH_TTL_MS) {
        sessionStorage.removeItem(REMOTE_LATCH_KEY);
        return { disabled: false };
      }
      return {
        disabled: true,
        code: Number(d.code || 403),
        reason: String(d.reason || ''),
        ts: Number(d.ts || 0)
      };
    } catch (_) {
      return { disabled: false };
    }
  }

  function isRemoteDisabled() {
    return !!getRemoteDisableInfo().disabled;
  }

  // ---------------------------
  // Optional remote logger
  // ---------------------------
  class RhythmRemoteLogger {
    constructor(opts = {}) {
      this.enabled = !!opts.enabled;
      this.api = String(opts.api || '').trim();
      this.timeoutMs = clamp(opts.timeoutMs || 3500, 1000, 15000);

      this.queue = []; // { kind:'events'|'sessions', csv, meta }
      this.flushing = false;
      this.lastFlushStatus = 'idle'; // idle | queued | flushing | ok | disabled | error
      this.lastFlushMsg = '';
      this.lastFlushAt = 0;
    }

    get canUseRemote() {
      return this.enabled && !!this.api && !isRemoteDisabled();
    }

    enqueue(kind, csv, meta = {}) {
      if (!csv || typeof csv !== 'string') return;
      this.queue.push({ kind, csv, meta, ts: Date.now() });
      this.lastFlushStatus = 'queued';
      this.lastFlushMsg = `คิว ${this.queue.length} รายการ`;
      this._emitStatus();
    }

    getStatus() {
      const disabled = getRemoteDisableInfo();
      if (disabled.disabled) {
        return {
          state: 'disabled',
          text: `Remote log ปิดชั่วคราว (${disabled.code})`,
          queue: this.queue.length
        };
      }
      return {
        state: this.lastFlushStatus,
        text: this.lastFlushMsg || this.lastFlushStatus,
        queue: this.queue.length
      };
    }

    _emitStatus() {
      const detail = this.getStatus();
      WIN.dispatchEvent(new CustomEvent('rb:flush-status', { detail }));
    }

    async flushAll() {
      if (this.flushing) return { ok: false, reason: 'busy' };

      if (!this.canUseRemote) {
        const info = getRemoteDisableInfo();
        this.lastFlushStatus = info.disabled ? 'disabled' : 'idle';
        this.lastFlushMsg = info.disabled
          ? `Remote log ถูกปิด (${info.code})`
          : (!this.enabled ? 'Remote log = OFF' : 'ยังไม่ได้ตั้ง API');
        this._emitStatus();
        return { ok: false, reason: this.lastFlushMsg };
      }

      if (!this.queue.length) {
        this.lastFlushStatus = 'ok';
        this.lastFlushMsg = 'ไม่มีข้อมูลค้างส่ง';
        this.lastFlushAt = Date.now();
        this._emitStatus();
        return { ok: true, sent: 0 };
      }

      this.flushing = true;
      this.lastFlushStatus = 'flushing';
      this.lastFlushMsg = `กำลังส่ง ${this.queue.length} รายการ...`;
      this._emitStatus();

      let sent = 0;
      try {
        while (this.queue.length) {
          const item = this.queue[0];
          await this._postCsv(item);
          this.queue.shift();
          sent++;
          this.lastFlushStatus = 'flushing';
          this.lastFlushMsg = `ส่งแล้ว ${sent} รายการ`;
          this._emitStatus();
        }

        this.lastFlushStatus = 'ok';
        this.lastFlushMsg = `ส่งสำเร็จ ${sent} รายการ`;
        this.lastFlushAt = Date.now();
        this._emitStatus();
        return { ok: true, sent };
      } catch (err) {
        const msg = String(err && err.message || err || 'flush failed');
        this.lastFlushStatus = isRemoteDisabled() ? 'disabled' : 'error';
        this.lastFlushMsg = msg;
        this._emitStatus();
        return { ok: false, sent, error: msg };
      } finally {
        this.flushing = false;
      }
    }

    async _postCsv(item) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const payload = {
          kind: item.kind,
          csv: item.csv,
          meta: item.meta || {},
          client: 'rhythm-boxer',
          ts: new Date().toISOString()
        };

        const res = await fetch(this.api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (!res.ok) {
          // 401/403 => latch disable per-tab to prevent spam
          if (res.status === 401 || res.status === 403) {
            disableRemote(res.status, 'forbidden');
          }
          throw new Error(`Remote log HTTP ${res.status}`);
        }

        // tolerate non-json
        return true;
      } catch (err) {
        if (String(err && err.name) === 'AbortError') {
          throw new Error('Remote log timeout');
        }
        throw err;
      } finally {
        clearTimeout(t);
      }
    }
  }

  // ---------------------------
  // DOM refs
  // ---------------------------
  const viewMenu   = $('#rb-view-menu');
  const viewPlay   = $('#rb-view-play');
  const viewResult = $('#rb-view-result');

  const rbWrap = $('#rb-wrap');

  // menu
  const modeInputs = $$('input[name="rb-mode"]');
  const trackInputs = $$('input[name="rb-track"]');
  const modeDesc = $('#rb-mode-desc');
  const researchFields = $('#rb-research-fields');
  const trackModeLabel = $('#rb-track-mode-label');
  const btnStart = $('#rb-btn-start');

  const inParticipant = $('#rb-participant');
  const inGroup = $('#rb-group');
  const inNote = $('#rb-note');

  // play
  const btnStop = $('#rb-btn-stop');
  const fieldEl = $('#rb-field');
  const lanesEl = $('#rb-lanes');
  const audioEl = $('#rb-audio');
  const feedbackEl = $('#rb-feedback');

  // HUD
  const hud = {
    mode: $('#rb-hud-mode'),
    track: $('#rb-hud-track'),
    score: $('#rb-hud-score'),
    combo: $('#rb-hud-combo'),
    acc: $('#rb-hud-acc'),
    hp: $('#rb-hud-hp'),
    shield: $('#rb-hud-shield'),
    time: $('#rb-hud-time'),
    countPerfect: $('#rb-hud-perfect'),
    countGreat: $('#rb-hud-great'),
    countGood: $('#rb-hud-good'),
    countMiss: $('#rb-hud-miss'),
    feverFill: $('#rb-fever-fill'),
    feverStatus: $('#rb-fever-status'),
    progFill: $('#rb-progress-fill'),
    progText: $('#rb-progress-text'),
    aiFatigue: $('#rb-hud-ai-fatigue'),
    aiSkill: $('#rb-hud-ai-skill'),
    aiSuggest: $('#rb-hud-ai-suggest'),
    aiTip: $('#rb-hud-ai-tip')
  };

  // result
  const resMode = $('#rb-res-mode');
  const resTrack = $('#rb-res-track');
  const resEndReason = $('#rb-res-endreason');
  const resScore = $('#rb-res-score');
  const resMaxCombo = $('#rb-res-maxcombo');
  const resDetailHit = $('#rb-res-detail-hit');
  const resAcc = $('#rb-res-acc');
  const resDuration = $('#rb-res-duration');
  const resRank = $('#rb-res-rank');
  const resOffsetAvg = $('#rb-res-offset-avg');
  const resOffsetStd = $('#rb-res-offset-std');
  const resParticipant = $('#rb-res-participant');
  const resQualityNote = $('#rb-res-quality-note');

  const btnAgain = $('#rb-btn-again');
  const btnBackMenu = $('#rb-btn-back-menu');
  const btnDlEvents = $('#rb-btn-dl-events');
  const btnDlSessions = $('#rb-btn-dl-sessions');

  // flush status UI (created dynamically if not in HTML)
  let flushBadge = null;
  let flushHint = null;

  // runtime
  let renderer = null;
  let engine = null;
  let lastSummary = null;
  let lastTrackId = 'n1';
  let lastMode = 'normal';

  // config from query
  const Q = {
    run: String(qs('run', '')).toLowerCase(),
    mode: String(qs('mode', '')).toLowerCase(),
    diff: String(qs('diff', 'normal')).toLowerCase(),
    time: clamp(qs('time', '60'), 20, 300),
    seed: qs('seed', ''),
    pid: qs('pid', ''),
    log: String(qs('log', '0')) === '1',
    api: qs('api', '')
  };

  // Remote logger (OFF by default unless ?log=1&api=...)
  const remoteLogger = new RhythmRemoteLogger({
    enabled: Q.log,
    api: Q.api,
    timeoutMs: 3500
  });

  function ensureResultFlushUi() {
    if (flushBadge && flushHint) return;
    const card = viewResult && viewResult.querySelector('.rb-research-box.rb-section');
    if (!card) return;

    const wrap = DOC.createElement('div');
    wrap.className = 'rb-section';
    wrap.style.marginTop = '12px';

    const row = DOC.createElement('div');
    row.className = 'rb-btn-row';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '8px';

    flushBadge = DOC.createElement('span');
    flushBadge.className = 'rb-chip';
    flushBadge.textContent = 'Flush: idle';

    const btnFlush = DOC.createElement('button');
    btnFlush.className = 'rb-btn rb-btn-sm';
    btnFlush.textContent = '☁ ส่ง log (ถ้ามี API)';
    btnFlush.addEventListener('click', async () => {
      await flushRemoteNow();
    });

    row.appendChild(flushBadge);
    row.appendChild(btnFlush);

    flushHint = DOC.createElement('p');
    flushHint.className = 'rb-hint-inline';
    flushHint.style.marginTop = '8px';
    flushHint.textContent = 'Local CSV ใช้งานได้เสมอ · Remote จะส่งเมื่อเปิด ?log=1&api=...';

    wrap.appendChild(row);
    wrap.appendChild(flushHint);
    card.appendChild(wrap);

    WIN.addEventListener('rb:flush-status', (ev) => {
      const d = ev && ev.detail ? ev.detail : {};
      updateFlushUi(d);
    });

    // initial status
    updateFlushUi(remoteLogger.getStatus());
  }

  function updateFlushUi(status) {
    if (!flushBadge || !flushHint) return;
    const st = status || remoteLogger.getStatus();
    flushBadge.textContent = `Flush: ${st.state || 'idle'}${typeof st.queue === 'number' ? ` · q=${st.queue}` : ''}`;

    let msg = st.text || '';
    if (!Q.log) {
      msg = 'Remote log = OFF (ตอนนี้ใช้ Local CSV อย่างเดียว)';
    } else if (!Q.api) {
      msg = 'เปิด log=1 แล้ว แต่ยังไม่มี api=...';
    }
    flushHint.textContent = msg;
  }

  async function flushRemoteNow() {
    // queue current CSV (if there is any completed run)
    if (engine) {
      try {
        const evCsv = engine.getEventsCsv();
        const seCsv = engine.getSessionCsv();
        if (evCsv && evCsv.split('\n').length > 1) {
          remoteLogger.enqueue('events', evCsv, { source: 'result-click' });
        }
        if (seCsv && seCsv.split('\n').length > 1) {
          remoteLogger.enqueue('sessions', seCsv, { source: 'result-click' });
        }
      } catch (_) {}
    }
    const out = await remoteLogger.flushAll();
    return out;
  }

  function showView(name) {
    [viewMenu, viewPlay, viewResult].forEach(v => v && v.classList.add('hidden'));
    if (name === 'menu' && viewMenu) viewMenu.classList.remove('hidden');
    if (name === 'play' && viewPlay) viewPlay.classList.remove('hidden');
    if (name === 'result' && viewResult) viewResult.classList.remove('hidden');
  }

  function getSelectedMode() {
    const el = modeInputs.find(i => i.checked);
    return el ? el.value : 'normal';
  }

  function getSelectedTrack() {
    const el = trackInputs.find(i => i.checked);
    return el ? el.value : 'n1';
  }

  function setModeUI(mode) {
    const isResearch = mode === 'research';
    researchFields && researchFields.classList.toggle('hidden', !isResearch);

    if (modeDesc) {
      modeDesc.textContent = isResearch
        ? 'Research: ใช้เก็บข้อมูลการเล่น (Participant / Group / Note) และดาวน์โหลด CSV สำหรับวิเคราะห์'
        : 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
    }

    if (trackModeLabel) {
      trackModeLabel.textContent = isResearch
        ? 'โหมด Research — แนะนำใช้ Research Track 120 เพื่อความสม่ำเสมอ'
        : 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
    }

    // hide/show track options by data-mode
    $$('[data-mode="research"]').forEach(x => {
      x.style.display = isResearch ? '' : 'none';
    });
    $$('[data-mode="normal"]').forEach(x => {
      x.style.display = isResearch ? 'none' : '';
    });

    // auto select a valid track
    const current = getSelectedTrack();
    const currentEl = trackInputs.find(i => i.value === current);
    const visible = currentEl && currentEl.closest('[data-mode]') &&
      currentEl.closest('[data-mode]').style.display !== 'none';

    if (!visible) {
      const fallback = isResearch ? 'r1' : 'n1';
      const f = trackInputs.find(i => i.value === fallback);
      if (f) f.checked = true;
    }
  }

  function collectMeta(mode) {
    const meta = {
      id: (inParticipant && inParticipant.value || '').trim(),
      group: (inGroup && inGroup.value || '').trim(),
      note: (inNote && inNote.value || '').trim(),
      pid: Q.pid || ''
    };

    if (mode !== 'research') {
      // keep optional note only if user typed something
      if (!meta.note) meta.note = '';
    }
    return meta;
  }

  function attachRendererHooks() {
    // dom-renderer-rhythm.js expected API
    if (WIN.RhythmDomRenderer) {
      renderer = new WIN.RhythmDomRenderer({
        field: fieldEl,
        lanesEl: lanesEl,
        feedbackEl: feedbackEl
      });
      return;
    }

    // fallback dummy renderer (so engine still runs)
    renderer = {
      showHitFx({ judgment }) {
        if (!feedbackEl) return;
        feedbackEl.textContent = String(judgment || 'HIT').toUpperCase();
        feedbackEl.classList.remove('rb-fb-miss');
        feedbackEl.classList.add('rb-fb-hit');
      },
      showMissFx() {
        if (!feedbackEl) return;
        feedbackEl.textContent = 'MISS';
        feedbackEl.classList.remove('rb-fb-hit');
        feedbackEl.classList.add('rb-fb-miss');
      }
    };
  }

  function createEngine() {
    if (!WIN.RhythmBoxerEngine) {
      console.error('[Rhythm Boxer] RhythmBoxerEngine not found');
      return null;
    }

    engine = new WIN.RhythmBoxerEngine({
      wrap: rbWrap,
      field: fieldEl,
      lanesEl: lanesEl,
      audio: audioEl,
      renderer,
      hud,
      hooks: {
        onStart(info) {
          // HUD top labels
          if (hud.mode) hud.mode.textContent = info.mode === 'research' ? 'Research' : 'Normal';
          if (hud.track) hud.track.textContent = info.track && info.track.name ? info.track.name : '-';

          // clear feedback
          if (feedbackEl) {
            feedbackEl.textContent = 'พร้อม!';
            feedbackEl.classList.remove('rb-fb-hit', 'rb-fb-miss');
          }
        },
        onEnd(summary) {
          lastSummary = summary || null;
          renderResult(summary || {});
          showView('result');

          // queue local-generated CSV for remote (if enabled)
          try {
            const evCsv = engine.getEventsCsv();
            const seCsv = engine.getSessionCsv();

            if (evCsv && evCsv.split('\n').length > 1) {
              remoteLogger.enqueue('events', evCsv, { source: 'onEnd' });
            }
            if (seCsv && seCsv.split('\n').length > 1) {
              remoteLogger.enqueue('sessions', seCsv, { source: 'onEnd' });
            }
          } catch (_) {}

          // auto flush one-shot (safe; disabled on 401/403)
          remoteLogger.flushAll().catch(() => {});
        }
      }
    });

    // calibration from query if provided (ms)
    const calMs = Number(qs('cal', '0'));
    if (Number.isFinite(calMs)) {
      engine.calOffsetSec = calMs / 1000;
    }

    return engine;
  }

  function renderResult(summary) {
    ensureResultFlushUi();

    resMode && (resMode.textContent = summary.modeLabel || '-');
    resTrack && (resTrack.textContent = summary.trackName || '-');
    resEndReason && (resEndReason.textContent = summary.endReason || '-');
    resScore && (resScore.textContent = String(summary.finalScore ?? 0));
    resMaxCombo && (resMaxCombo.textContent = String(summary.maxCombo ?? 0));
    resDetailHit && (resDetailHit.textContent =
      `${summary.hitPerfect ?? 0} / ${summary.hitGreat ?? 0} / ${summary.hitGood ?? 0} / ${summary.hitMiss ?? 0}`);
    resAcc && (resAcc.textContent = `${fmtNum(summary.accuracyPct, 1)} %`);
    resDuration && (resDuration.textContent = `${fmtNum(summary.durationSec, 1)} s`);
    resRank && (resRank.textContent = summary.rank || '-');
    resOffsetAvg && (resOffsetAvg.textContent = `${fmtNum(summary.offsetMean, 4)} s`);
    resOffsetStd && (resOffsetStd.textContent = `${fmtNum(summary.offsetStd, 4)} s`);
    resParticipant && (resParticipant.textContent = summary.participant || '-');

    if (resQualityNote) {
      const note = String(summary.qualityNote || '').trim();
      resQualityNote.textContent = note;
      resQualityNote.classList.toggle('hidden', !note);
    }

    updateFlushUi(remoteLogger.getStatus());
  }

  function startGame() {
    const mode = getSelectedMode();
    const trackId = getSelectedTrack();
    const meta = collectMeta(mode);

    lastMode = mode;
    lastTrackId = trackId;

    if (!renderer) attachRendererHooks();
    if (!engine) createEngine();
    if (!engine) return;

    showView('play');

    // HUD seed labels right before start (engine also updates in onStart)
    if (hud.mode) hud.mode.textContent = mode === 'research' ? 'Research' : 'Normal';

    engine.start(mode, trackId, meta);
  }

  function stopGame() {
    if (engine && engine.running) {
      engine.stop('manual-stop');
    }
  }

  function playAgainSameTrack() {
    // return to play and restart with same mode/track + current field values
    if (!renderer) attachRendererHooks();
    if (!engine) createEngine();
    if (!engine) return;

    // sync radios for UI consistency
    const m = modeInputs.find(x => x.value === lastMode);
    if (m) m.checked = true;
    setModeUI(lastMode);

    const t = trackInputs.find(x => x.value === lastTrackId);
    if (t) t.checked = true;

    showView('play');
    engine.start(lastMode, lastTrackId, collectMeta(lastMode));
  }

  function downloadEventsCsv() {
    if (!engine) return;
    const csv = engine.getEventsCsv();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(`rhythm-boxer-events-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
  }

  function downloadSessionCsv() {
    if (!engine) return;
    const csv = engine.getSessionCsv();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(`rhythm-boxer-sessions-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
  }

  function wireEvents() {
    modeInputs.forEach(i => i.addEventListener('change', () => setModeUI(getSelectedMode())));
    btnStart && btnStart.addEventListener('click', startGame);
    btnStop && btnStop.addEventListener('click', stopGame);

    btnAgain && btnAgain.addEventListener('click', playAgainSameTrack);
    btnBackMenu && btnBackMenu.addEventListener('click', () => {
      showView('menu');
      updateFlushUi(remoteLogger.getStatus());
    });

    btnDlEvents && btnDlEvents.addEventListener('click', downloadEventsCsv);
    btnDlSessions && btnDlSessions.addEventListener('click', downloadSessionCsv);

    // keyboard shortcuts (optional)
    DOC.addEventListener('keydown', (ev) => {
      const k = (ev.key || '').toLowerCase();
      if (k === 'escape' && viewPlay && !viewPlay.classList.contains('hidden')) {
        stopGame();
      }
    });

    // page leave: best-effort one last flush (won't block)
    WIN.addEventListener('beforeunload', () => {
      try { remoteLogger.flushAll(); } catch (_) {}
    });
  }

  function initFromQuery() {
    // mode
    let mode = 'normal';
    if (Q.mode === 'research') mode = 'research';
    const m = modeInputs.find(x => x.value === mode);
    if (m) m.checked = true;
    setModeUI(mode);

    // diff -> default track in normal mode
    if (mode === 'normal') {
      const diffMap = { easy: 'n1', normal: 'n2', hard: 'n3' };
      const want = diffMap[Q.diff] || 'n1';
      const t = trackInputs.find(x => x.value === want);
      if (t) t.checked = true;
    } else {
      const r = trackInputs.find(x => x.value === 'r1');
      if (r) r.checked = true;
    }

    // prefill participant from query if present
    if (Q.pid && inParticipant && !inParticipant.value) {
      inParticipant.value = Q.pid;
    }

    // clear disable latch manually if query says so
    if (String(qs('resetlog', '0')) === '1') {
      clearRemoteDisable();
    }

    // auto-run if query asks
    if (Q.run === 'play') {
      setTimeout(() => startGame(), 50);
    }
  }

  function init() {
    attachRendererHooks();
    createEngine();
    wireEvents();
    initFromQuery();
    ensureResultFlushUi();

    // show remote status in console once
    const info = getRemoteDisableInfo();
    if (info.disabled) {
      console.warn('[Rhythm Boxer] Remote log disabled (latch):', info);
    } else if (Q.log && Q.api) {
      console.info('[Rhythm Boxer] Remote log enabled:', Q.api);
    } else {
      console.info('[Rhythm Boxer] Local CSV mode (remote disabled/off)');
    }
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();