// === /fitness/js/rhythm-boxer.js ===
// Rhythm Boxer UI Controller — FULL PATCH
// Works with classic scripts:
//   - window.RB_AI
//   - window.DomRendererRhythm (optional)
//   - window.RhythmBoxerEngine
//
// Features
// ✅ Menu / Play / Result view flow
// ✅ Normal / Research mode toggle
// ✅ Track options filtering by mode
// ✅ Start / Stop / Replay
// ✅ CSV download (events/sessions)
// ✅ HUD wiring
// ✅ AI prediction HUD visible, research-lock respected by engine/RB_AI
// ✅ Calibration hotkeys ([ and ]) + reset (\)
// ✅ Pass query params (?mode=research&track=r1&ai=1 etc.)
// ✅ 5-lane HTML works; 3-lane preset can be done by HTML/CSS later

'use strict';

(function () {
  const WIN = window;
  const DOC = document;

  // ---------- helpers ----------
  const $ = (s, root) => (root || DOC).querySelector(s);
  const $$ = (s, root) => Array.from((root || DOC).querySelectorAll(s));

  function safeText(v) { return (v == null ? '' : String(v)); }

  function setHidden(el, yes) {
    if (!el) return;
    el.classList.toggle('hidden', !!yes);
  }

  function readQuery() {
    try { return new URL(WIN.location.href).searchParams; }
    catch (_) { return new URLSearchParams(); }
  }

  function readQueryFlag(params, key, defVal) {
    const v = (params.get(key) || '').toLowerCase();
    if (!v) return !!defVal;
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  }

  function dlBlob(filename, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function fmtNum(n, d) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '-';
    return x.toFixed(d == null ? 2 : d);
  }

  function rankHintClass(rank) {
    const r = String(rank || '').toUpperCase();
    if (r === 'SSS' || r === 'SS' || r === 'S') return 'is-perfect';
    if (r === 'A' || r === 'B') return 'is-great';
    return 'is-good';
  }

  // ---------- DOM refs ----------
  const refs = {
    wrap: $('#rb-wrap'),

    // Views
    viewMenu: $('#rb-view-menu'),
    viewPlay: $('#rb-view-play'),
    viewResult: $('#rb-view-result'),

    // Menu
    modeRadios: $$('input[name="rb-mode"]'),
    modeDesc: $('#rb-mode-desc'),
    researchFields: $('#rb-research-fields'),

    participant: $('#rb-participant'),
    group: $('#rb-group'),
    note: $('#rb-note'),

    trackModeLabel: $('#rb-track-mode-label'),
    trackRadios: $$('input[name="rb-track"]'),
    trackOptionLabels: $$('#rb-track-options .rb-mode-btn'),

    btnStart: $('#rb-btn-start'),

    // Play
    btnStop: $('#rb-btn-stop'),
    audio: $('#rb-audio'),
    field: $('#rb-field'),
    lanes: $('#rb-lanes'),
    feedback: $('#rb-feedback'),

    // Result
    btnAgain: $('#rb-btn-again'),
    btnBackMenu: $('#rb-btn-back-menu'),
    btnDlEvents: $('#rb-btn-dl-events'),
    btnDlSessions: $('#rb-btn-dl-sessions'),

    resMode: $('#rb-res-mode'),
    resTrack: $('#rb-res-track'),
    resEndReason: $('#rb-res-endreason'),
    resScore: $('#rb-res-score'),
    resMaxCombo: $('#rb-res-maxcombo'),
    resDetailHit: $('#rb-res-detail-hit'),
    resAcc: $('#rb-res-acc'),
    resDuration: $('#rb-res-duration'),
    resRank: $('#rb-res-rank'),
    resOffsetAvg: $('#rb-res-offset-avg'),
    resOffsetStd: $('#rb-res-offset-std'),
    resParticipant: $('#rb-res-participant'),
    resQualityNote: $('#rb-res-quality-note'),

    // HUD
    hudMode: $('#rb-hud-mode'),
    hudTrack: $('#rb-hud-track'),
    hudScore: $('#rb-hud-score'),
    hudCombo: $('#rb-hud-combo'),
    hudAcc: $('#rb-hud-acc'),
    hudHp: $('#rb-hud-hp'),
    hudShield: $('#rb-hud-shield'),
    hudTime: $('#rb-hud-time'),

    hudPerfect: $('#rb-hud-perfect'),
    hudGreat: $('#rb-hud-great'),
    hudGood: $('#rb-hud-good'),
    hudMiss: $('#rb-hud-miss'),

    hudAiFatigue: $('#rb-hud-ai-fatigue'),
    hudAiSkill: $('#rb-hud-ai-skill'),
    hudAiSuggest: $('#rb-hud-ai-suggest'),
    hudAiTip: $('#rb-hud-ai-tip'),

    feverFill: $('#rb-fever-fill'),
    feverStatus: $('#rb-fever-status'),
    progFill: $('#rb-progress-fill'),
    progText: $('#rb-progress-text')
  };

  // ---------- controller state ----------
  const state = {
    mode: 'normal', // normal | research
    trackId: 'n1',
    lastSummary: null,
    lastMode: 'normal',
    lastTrackId: 'n1',
    lastMeta: {},
    engine: null,
    renderer: null,
    query: readQuery()
  };

  const TRACK_META = {
    n1: { name: 'Warm-up Groove', label: 'Warm-up Groove · ง่าย · 100 BPM', mode: 'normal' },
    n2: { name: 'Focus Combo', label: 'Focus Combo · ปกติ · 120 BPM', mode: 'normal' },
    n3: { name: 'Speed Rush', label: 'Speed Rush · ยาก · 140 BPM', mode: 'normal' },
    r1: { name: 'Research Track 120', label: 'Research Track 120 · ทดลอง · 120 BPM', mode: 'research' }
  };

  // ---------- view helpers ----------
  function showView(name) {
    setHidden(refs.viewMenu, name !== 'menu');
    setHidden(refs.viewPlay, name !== 'play');
    setHidden(refs.viewResult, name !== 'result');
  }

  function pulseFeedback(text, kind) {
    if (!refs.feedback) return;
    refs.feedback.textContent = text || '';
    refs.feedback.classList.remove('is-perfect', 'is-great', 'is-good', 'is-miss', 'show');
    if (kind) refs.feedback.classList.add(kind);
    // reflow for animation retrigger
    void refs.feedback.offsetWidth;
    refs.feedback.classList.add('show');
    setTimeout(() => refs.feedback && refs.feedback.classList.remove('show'), 120);
  }

  // ---------- mode / track UI ----------
  function getSelectedMode() {
    const r = refs.modeRadios.find(x => x.checked);
    return (r && r.value === 'research') ? 'research' : 'normal';
  }

  function setSelectedMode(mode) {
    const m = (mode === 'research') ? 'research' : 'normal';
    refs.modeRadios.forEach(r => { r.checked = (r.value === m); });
    state.mode = m;
    refreshModeUI();
  }

  function getSelectedTrack() {
    const r = refs.trackRadios.find(x => x.checked);
    return r ? r.value : 'n1';
  }

  function setSelectedTrack(trackId) {
    const t = TRACK_META[trackId] ? trackId : 'n1';
    const target = refs.trackRadios.find(r => r.value === t);
    if (target) target.checked = true;
    state.trackId = t;
    refreshModeUI();
  }

  function refreshModeUI() {
    state.mode = getSelectedMode();

    // Research fields
    setHidden(refs.researchFields, state.mode !== 'research');

    // Description
    if (refs.modeDesc) {
      refs.modeDesc.textContent = (state.mode === 'research')
        ? 'Research: แสดง AI prediction ได้ แต่ล็อกเกม 100% (AI ไม่ปรับความยาก/พฤติกรรมเกม) และบันทึก CSV เพื่อวิเคราะห์'
        : 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
    }

    // Track label
    if (refs.trackModeLabel) {
      refs.trackModeLabel.textContent = (state.mode === 'research')
        ? 'โหมด Research — ใช้ Research Track เพื่อความคงที่ของการทดลอง'
        : 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
    }

    // Show/hide track options by mode
    refs.trackOptionLabels.forEach(label => {
      const mode = (label.getAttribute('data-mode') || 'normal').toLowerCase();
      const hide = (state.mode === 'research') ? (mode !== 'research') : (mode !== 'normal');
      label.classList.toggle('hidden', hide);
    });

    // Force valid track for mode
    const currentTrack = getSelectedTrack();
    const meta = TRACK_META[currentTrack];
    if (!meta || meta.mode !== state.mode) {
      setSelectedTrack(state.mode === 'research' ? 'r1' : 'n1');
    } else {
      state.trackId = currentTrack;
    }

    // Update wrap data-diff (optional visual use)
    if (refs.wrap) {
      const tid = getSelectedTrack();
      let diff = 'normal';
      if (tid === 'n1') diff = 'easy';
      else if (tid === 'n3') diff = 'hard';
      refs.wrap.setAttribute('data-diff', diff);
    }
  }

  function readMetaFromForm() {
    return {
      id: safeText(refs.participant && refs.participant.value).trim(),
      group: safeText(refs.group && refs.group.value).trim(),
      note: safeText(refs.note && refs.note.value).trim()
    };
  }

  // ---------- renderer ----------
  function createRenderer() {
    // Prefer external renderer if available
    if (WIN.DomRendererRhythm && typeof WIN.DomRendererRhythm === 'function') {
      try {
        return new WIN.DomRendererRhythm({
          fieldEl: refs.field,
          lanesEl: refs.lanes,
          feedbackEl: refs.feedback
        });
      } catch (e) {
        console.warn('[RhythmBoxer] DomRendererRhythm init failed, fallback renderer used:', e);
      }
    }

    // Fallback mini renderer (safe)
    return {
      showHitFx({ lane, judgment }) {
        const laneEl = refs.lanes && refs.lanes.querySelector(`.rb-lane[data-lane="${lane}"]`);
        if (!laneEl) return;

        // lane flash class
        const cls = judgment === 'perfect' ? 'fx-hit-perfect'
          : judgment === 'great' ? 'fx-hit-great'
          : judgment === 'good' ? 'fx-hit-good'
          : 'fx-hit-miss';

        laneEl.classList.remove('fx-hit-perfect', 'fx-hit-great', 'fx-hit-good', 'fx-hit-miss');
        void laneEl.offsetWidth;
        laneEl.classList.add(cls);
        setTimeout(() => laneEl.classList.remove(cls), 230);

        // feedback text
        const text = judgment.toUpperCase();
        const kind = judgment === 'perfect' ? 'is-perfect'
          : judgment === 'great' ? 'is-great'
          : judgment === 'good' ? 'is-good'
          : 'is-miss';
        pulseFeedback(text, kind);

        // spark near hit line
        try {
          const spark = DOC.createElement('div');
          spark.className = `rb-fx-spark is-${judgment}`;
          spark.style.left = '50%';
          spark.style.top = 'var(--rb-hitline-y)';
          laneEl.appendChild(spark);
          setTimeout(() => spark.remove(), 260);

          const f = DOC.createElement('div');
          f.className = `rb-fx-float is-${judgment}`;
          f.textContent = text;
          f.style.left = '50%';
          f.style.top = 'var(--rb-hitline-y)';
          laneEl.appendChild(f);
          setTimeout(() => f.remove(), 520);
        } catch (_) {}
      },

      showMissFx({ lane }) {
        const laneEl = refs.lanes && refs.lanes.querySelector(`.rb-lane[data-lane="${lane}"]`);
        if (!laneEl) return;

        laneEl.classList.remove('fx-hit-perfect', 'fx-hit-great', 'fx-hit-good', 'fx-hit-miss');
        void laneEl.offsetWidth;
        laneEl.classList.add('fx-hit-miss');
        setTimeout(() => laneEl.classList.remove('fx-hit-miss'), 230);

        pulseFeedback('MISS', 'is-miss');

        try {
          const spark = DOC.createElement('div');
          spark.className = 'rb-fx-spark is-miss';
          spark.style.left = '50%';
          spark.style.top = 'var(--rb-hitline-y)';
          laneEl.appendChild(spark);
          setTimeout(() => spark.remove(), 260);
        } catch (_) {}
      }
    };
  }

  // ---------- engine ----------
  function createEngine() {
    if (!WIN.RhythmBoxerEngine) {
      throw new Error('RhythmBoxerEngine not found (js/rhythm-engine.js not loaded)');
    }

    const renderer = createRenderer();
    state.renderer = renderer;

    const eng = new WIN.RhythmBoxerEngine({
      wrap: refs.wrap,
      field: refs.field,
      lanesEl: refs.lanes,
      audio: refs.audio,
      renderer,

      hud: {
        score: refs.hudScore,
        combo: refs.hudCombo,
        acc: refs.hudAcc,
        hp: refs.hudHp,
        shield: refs.hudShield,
        time: refs.hudTime,

        countPerfect: refs.hudPerfect,
        countGreat: refs.hudGreat,
        countGood: refs.hudGood,
        countMiss: refs.hudMiss,

        aiFatigue: refs.hudAiFatigue,
        aiSkill: refs.hudAiSkill,
        aiSuggest: refs.hudAiSuggest,
        aiTip: refs.hudAiTip,

        feverFill: refs.feverFill,
        feverStatus: refs.feverStatus,
        progFill: refs.progFill,
        progText: refs.progText
      },

      hooks: {
        onStart(payload) {
          // Optional place to expose session id
          // console.log('[RhythmBoxer] Start', payload);
        },

        onEnd(summary) {
          state.lastSummary = summary || null;
          fillResult(summary || {});
          showView('result');
        }
      }
    });

    return eng;
  }

  function ensureEngine() {
    if (!state.engine) state.engine = createEngine();
    return state.engine;
  }

  // ---------- start / stop ----------
  function applyModeTrackHud(mode, trackId) {
    if (refs.hudMode) refs.hudMode.textContent = (mode === 'research' ? 'Research' : 'Normal');
    if (refs.hudTrack) refs.hudTrack.textContent = (TRACK_META[trackId] && TRACK_META[trackId].name) || trackId;
  }

  function syncQueryToAI(mode) {
    // ai-predictor.js reads query param "mode"; make URL consistent (no reload)
    try {
      const u = new URL(WIN.location.href);
      u.searchParams.set('mode', mode);
      // preserve ai if present or set from current url only
      WIN.history.replaceState(null, '', u.toString());
    } catch (_) {}
  }

  function startGame() {
    const mode = getSelectedMode();
    const trackId = getSelectedTrack();
    const meta = readMetaFromForm();

    // Research mode should have participant optional but recommended
    if (mode === 'research' && !meta.id) {
      // Allow start (don’t block research workflow), but warn visually
      pulseFeedback('ใส่ Participant ID จะดีกว่าสำหรับงานวิจัย', 'is-good');
    }

    state.lastMode = mode;
    state.lastTrackId = trackId;
    state.lastMeta = meta;

    syncQueryToAI(mode);
    applyModeTrackHud(mode, trackId);

    // Reset on-play labels
    if (refs.hudAiTip) {
      refs.hudAiTip.textContent = '';
      refs.hudAiTip.classList.add('hidden');
    }
    if (refs.feedback) {
      refs.feedback.textContent = 'พร้อม!';
      refs.feedback.classList.remove('is-perfect', 'is-great', 'is-good', 'is-miss', 'show');
    }

    showView('play');

    // Start engine
    const eng = ensureEngine();
    eng.start(mode, trackId, meta);

    // show lock hint in feedback for research
    if (mode === 'research') {
      setTimeout(() => pulseFeedback('RESEARCH LOCK', 'is-great'), 120);
    }
  }

  function stopGame(reason) {
    if (!state.engine) return;
    try {
      state.engine.stop(reason || 'manual-stop');
    } catch (e) {
      console.error('[RhythmBoxer] stopGame error:', e);
    }
  }

  function replaySame() {
    if (state.engine && state.engine.running) {
      stopGame('restart');
    }
    // start again same selection/meta
    setSelectedMode(state.lastMode || getSelectedMode());
    setSelectedTrack(state.lastTrackId || getSelectedTrack());

    if (refs.participant) refs.participant.value = safeText(state.lastMeta.id);
    if (refs.group) refs.group.value = safeText(state.lastMeta.group);
    if (refs.note) refs.note.value = safeText(state.lastMeta.note);

    startGame();
  }

  // ---------- result ----------
  function fillResult(summary) {
    const s = summary || {};

    if (refs.resMode) refs.resMode.textContent = safeText(s.modeLabel || '-');
    if (refs.resTrack) refs.resTrack.textContent = safeText(s.trackName || '-');
    if (refs.resEndReason) refs.resEndReason.textContent = safeText(s.endReason || '-');
    if (refs.resScore) refs.resScore.textContent = String(Math.round(Number(s.finalScore) || 0));
    if (refs.resMaxCombo) refs.resMaxCombo.textContent = String(Math.round(Number(s.maxCombo) || 0));

    if (refs.resDetailHit) {
      refs.resDetailHit.textContent =
        `${Math.round(Number(s.hitPerfect)||0)} / ${Math.round(Number(s.hitGreat)||0)} / ${Math.round(Number(s.hitGood)||0)} / ${Math.round(Number(s.hitMiss)||0)}`;
    }

    if (refs.resAcc) refs.resAcc.textContent = `${fmtNum(s.accuracyPct, 1)} %`;
    if (refs.resDuration) refs.resDuration.textContent = `${fmtNum(s.durationSec, 1)} s`;
    if (refs.resRank) {
      refs.resRank.textContent = safeText(s.rank || '-');
      refs.resRank.classList.remove('is-perfect', 'is-great', 'is-good', 'is-miss');
      refs.resRank.classList.add(rankHintClass(s.rank));
    }

    if (refs.resOffsetAvg) refs.resOffsetAvg.textContent = `${fmtNum((Number(s.offsetMean)||0) * 1000, 1)} ms`;
    if (refs.resOffsetStd) refs.resOffsetStd.textContent = `${fmtNum((Number(s.offsetStd)||0) * 1000, 1)} ms`;
    if (refs.resParticipant) refs.resParticipant.textContent = safeText(s.participant || '-');

    if (refs.resQualityNote) {
      const txt = safeText(s.qualityNote || '');
      refs.resQualityNote.textContent = txt;
      refs.resQualityNote.classList.toggle('hidden', !txt);
    }
  }

  // ---------- CSV download ----------
  function downloadEventsCsv() {
    if (!state.engine || typeof state.engine.getEventsCsv !== 'function') return;
    const csv = state.engine.getEventsCsv();
    const t = new Date();
    const ts = [
      t.getFullYear(),
      String(t.getMonth() + 1).padStart(2, '0'),
      String(t.getDate()).padStart(2, '0'),
      '-',
      String(t.getHours()).padStart(2, '0'),
      String(t.getMinutes()).padStart(2, '0'),
      String(t.getSeconds()).padStart(2, '0')
    ].join('');
    dlBlob(`rhythm-boxer-events-${ts}.csv`, csv, 'text/csv;charset=utf-8');
  }

  function downloadSessionCsv() {
    if (!state.engine || typeof state.engine.getSessionCsv !== 'function') return;
    const csv = state.engine.getSessionCsv();
    const t = new Date();
    const ts = [
      t.getFullYear(),
      String(t.getMonth() + 1).padStart(2, '0'),
      String(t.getDate()).padStart(2, '0'),
      '-',
      String(t.getHours()).padStart(2, '0'),
      String(t.getMinutes()).padStart(2, '0'),
      String(t.getSeconds()).padStart(2, '0')
    ].join('');
    dlBlob(`rhythm-boxer-sessions-${ts}.csv`, csv, 'text/csv;charset=utf-8');
  }

  // ---------- calibration (hotkeys only; no extra HTML required) ----------
  function adjustCal(msDelta) {
    if (!state.engine) return;
    const e = state.engine;
    const next = (Number(e.calOffsetSec) || 0) + (msDelta / 1000);
    e.calOffsetSec = Math.max(-0.200, Math.min(0.200, next)); // ±200ms cap
    pulseFeedback(`Cal ${Math.round(e.calOffsetSec * 1000)}ms`, 'is-great');
    if (typeof e._updateCalibrationHud === 'function') e._updateCalibrationHud();
  }

  function resetCal() {
    if (!state.engine) return;
    state.engine.calOffsetSec = 0;
    pulseFeedback('Cal 0ms', 'is-good');
    if (typeof state.engine._updateCalibrationHud === 'function') state.engine._updateCalibrationHud();
  }

  // ---------- query init ----------
  function initFromQuery() {
    const q = state.query;

    // mode
    const qMode = (q.get('mode') || '').toLowerCase();
    if (qMode === 'research' || qMode === 'normal') {
      setSelectedMode(qMode);
    } else {
      setSelectedMode('normal');
    }

    // track
    const qTrack = (q.get('track') || '').toLowerCase();
    if (TRACK_META[qTrack]) {
      setSelectedTrack(qTrack);
    }

    // if track conflicts with mode, refreshModeUI will correct it
    refreshModeUI();

    // optional prefill (nice for research links)
    if (refs.participant && q.get('pid')) refs.participant.value = q.get('pid') || '';
    if (refs.group && q.get('group')) refs.group.value = q.get('group') || '';
    if (refs.note && q.get('note')) refs.note.value = q.get('note') || '';

    // Optional auto mode hint for AI assist
    if (refs.modeDesc) {
      const aiOn = readQueryFlag(q, 'ai', false);
      if (state.mode === 'normal' && aiOn) {
        refs.modeDesc.textContent += ' · AI assist (prediction/assist) ถูกเปิดด้วย ?ai=1';
      }
    }
  }

  // ---------- events ----------
  function bindEvents() {
    refs.modeRadios.forEach(r => {
      r.addEventListener('change', refreshModeUI);
    });

    refs.trackRadios.forEach(r => {
      r.addEventListener('change', () => {
        state.trackId = getSelectedTrack();
        refreshModeUI();
      });
    });

    if (refs.btnStart) refs.btnStart.addEventListener('click', startGame);
    if (refs.btnStop) refs.btnStop.addEventListener('click', () => stopGame('manual-stop'));

    if (refs.btnAgain) refs.btnAgain.addEventListener('click', replaySame);
    if (refs.btnBackMenu) refs.btnBackMenu.addEventListener('click', () => showView('menu'));

    if (refs.btnDlEvents) refs.btnDlEvents.addEventListener('click', downloadEventsCsv);
    if (refs.btnDlSessions) refs.btnDlSessions.addEventListener('click', downloadSessionCsv);

    // Keyboard shortcuts:
    // Space/Enter = start (menu) or tap center lane (play) optional
    // [ / ] = calibration -/+ 5ms
    // \     = reset calibration
    DOC.addEventListener('keydown', (ev) => {
      const key = ev.key || '';

      // Calibration keys (global, only useful after engine created)
      if (key === '[') { adjustCal(-5); ev.preventDefault(); return; }
      if (key === ']') { adjustCal(+5); ev.preventDefault(); return; }
      if (key === '\\') { resetCal(); ev.preventDefault(); return; }

      // Start key on menu
      if (!refs.viewMenu.classList.contains('hidden')) {
        if (key === 'Enter' || key === ' ') {
          ev.preventDefault();
          startGame();
          return;
        }
      }

      // Stop with Escape on play
      if (!refs.viewPlay.classList.contains('hidden') && key === 'Escape') {
        ev.preventDefault();
        stopGame('manual-stop');
      }
    });

    // Mobile visibility pause safeguard
    DOC.addEventListener('visibilitychange', () => {
      if (DOC.hidden && state.engine && state.engine.running) {
        stopGame('visibility-hidden');
      }
    });

    WIN.addEventListener('beforeunload', () => {
      if (state.engine && state.engine.running) {
        try { state.engine.stop('unload'); } catch (_) {}
      }
    });
  }

  // ---------- startup ----------
  function bootstrap() {
    if (!refs.viewMenu || !refs.viewPlay || !refs.viewResult) {
      console.error('[RhythmBoxer] Required views not found');
      return;
    }

    showView('menu');
    bindEvents();
    initFromQuery();
    refreshModeUI();

    // Pre-create engine so calibration/hud exists before start (optional)
    try {
      ensureEngine();
    } catch (e) {
      console.error(e);
      if (refs.modeDesc) {
        refs.modeDesc.textContent = 'โหลด engine ไม่สำเร็จ: ' + (e && e.message ? e.message : e);
      }
    }

    // Initial feedback
    if (refs.feedback) {
      refs.feedback.textContent = 'พร้อม!';
    }

    // If ?autostart=1
    if (readQueryFlag(state.query, 'autostart', false)) {
      setTimeout(startGame, 120);
    }
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();