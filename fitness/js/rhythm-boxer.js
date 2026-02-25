// === /fitness/js/rhythm-boxer.js — UI glue (menu / play / result) ===
'use strict';

(function () {
  const WIN = window;
  const DOC = document;

  const $ = (sel, el = DOC) => el.querySelector(sel);
  const $$ = (sel, el = DOC) => Array.from(el.querySelectorAll(sel));

  // ---------- Root / Views ----------
  const wrap = $('#rb-wrap');
  const viewMenu   = $('#rb-view-menu');
  const viewPlay   = $('#rb-view-play');
  const viewResult = $('#rb-view-result');

  // ---------- Play field ----------
  const flashEl    = $('#rb-flash');
  const fieldEl    = $('#rb-field');
  const lanesEl    = $('#rb-lanes');
  const feedbackEl = $('#rb-feedback');
  const audioEl    = $('#rb-audio');

  // ---------- Menu controls ----------
  const btnStart      = $('#rb-btn-start');
  const modeRadios    = $$('input[name="rb-mode"]');
  const trackRadios   = $$('input[name="rb-track"]');
  const trackLabels   = $$('#rb-track-options .rb-mode-btn');
  const modeDescEl    = $('#rb-mode-desc');
  const trackModeLbl  = $('#rb-track-mode-label');
  const researchBox   = $('#rb-research-fields');

  // Research fields
  const inputParticipant = $('#rb-participant');
  const inputGroup       = $('#rb-group');
  const inputNote        = $('#rb-note');

  // ---------- Play / Result buttons ----------
  const btnStop        = $('#rb-btn-stop');
  const btnAgain       = $('#rb-btn-again');
  const btnBackMenu    = $('#rb-btn-back-menu');
  const btnDlEvents    = $('#rb-btn-dl-events');
  const btnDlSessions  = $('#rb-btn-dl-sessions');

  // ---------- HUD ----------
  const hud = {
    mode:   $('#rb-hud-mode'),
    track:  $('#rb-hud-track'),
    score:  $('#rb-hud-score'),
    combo:  $('#rb-hud-combo'),
    acc:    $('#rb-hud-acc'),
    hp:     $('#rb-hud-hp'),
    shield: $('#rb-hud-shield'),
    time:   $('#rb-hud-time'),

    countPerfect: $('#rb-hud-perfect'),
    countGreat:   $('#rb-hud-great'),
    countGood:    $('#rb-hud-good'),
    countMiss:    $('#rb-hud-miss'),

    feverFill:    $('#rb-fever-fill'),
    feverStatus:  $('#rb-fever-status'),
    progFill:     $('#rb-progress-fill'),
    progText:     $('#rb-progress-text'),

    aiFatigue:    $('#rb-hud-ai-fatigue'),
    aiSkill:      $('#rb-hud-ai-skill'),
    aiSuggest:    $('#rb-hud-ai-suggest'),
    aiTip:        $('#rb-hud-ai-tip')
  };

  // ---------- Result UI ----------
  const res = {
    mode:        $('#rb-res-mode'),
    track:       $('#rb-res-track'),
    endReason:   $('#rb-res-endreason'),
    score:       $('#rb-res-score'),
    maxCombo:    $('#rb-res-maxcombo'),
    hits:        $('#rb-res-detail-hit'),
    acc:         $('#rb-res-acc'),
    duration:    $('#rb-res-duration'),
    rank:        $('#rb-res-rank'),
    offsetAvg:   $('#rb-res-offset-avg'),
    offsetStd:   $('#rb-res-offset-std'),
    participant: $('#rb-res-participant'),
    qualityNote: $('#rb-res-quality-note')
  };

  // ---------- Track mapping (menu -> engine) ----------
  const TRACK_CONFIG = {
    n1: { engineId: 'n1', labelShort: 'Warm-up Groove', diff: 'easy'   },
    n2: { engineId: 'n2', labelShort: 'Focus Combo',    diff: 'normal' },
    n3: { engineId: 'n3', labelShort: 'Speed Rush',     diff: 'hard'   },
    r1: { engineId: 'r1', labelShort: 'Research 120',   diff: 'normal' }
  };

  let engine = null;
  let lastStart = null; // remember for "play again"

  // =========================================================
  // Helpers
  // =========================================================
  function qsStr(key, def = '') {
    try {
      const v = new URL(location.href).searchParams.get(key);
      return (v == null ? def : String(v));
    } catch (_) {
      return def;
    }
  }

  function qsBool(key, def = false) {
    try {
      const v = (new URL(location.href).searchParams.get(key) || '').toLowerCase();
      if (!v) return !!def;
      return v === '1' || v === 'true' || v === 'yes' || v === 'on';
    } catch (_) {
      return !!def;
    }
  }

  function qsNum(key, def) {
    try {
      const raw = new URL(location.href).searchParams.get(key);
      const n = Number(raw);
      return Number.isFinite(n) ? n : def;
    } catch (_) {
      return def;
    }
  }

  function clamp(n, a, b) {
    n = Number(n);
    if (!Number.isFinite(n)) n = a;
    return Math.max(a, Math.min(b, n));
  }

  function getSelectedMode() {
    const r = modeRadios.find(x => x.checked);
    return r ? r.value : 'normal';
  }

  function getSelectedTrackKey() {
    const r = trackRadios.find(x => x.checked);
    return r ? r.value : 'n1';
  }

  function setSelectedTrackKey(key) {
    trackRadios.forEach(r => { r.checked = (r.value === key); });
  }

  function setModeRadio(mode) {
    const want = (mode === 'research') ? 'research' : 'normal';
    const r = modeRadios.find(x => x.value === want);
    if (r) r.checked = true;
  }

  function switchView(name) {
    [viewMenu, viewPlay, viewResult].forEach(v => v && v.classList.add('hidden'));
    if (name === 'menu' && viewMenu) viewMenu.classList.remove('hidden');
    if (name === 'play' && viewPlay) viewPlay.classList.remove('hidden');
    if (name === 'result' && viewResult) viewResult.classList.remove('hidden');
  }

  function safeText(el, text) {
    if (el) el.textContent = String(text);
  }

  function formatEndReason(reason) {
    const map = {
      'song-end': 'Song End',
      'manual-stop': 'Manual Stop',
      'hp-zero': 'HP Zero'
    };
    return map[reason] || String(reason || '-');
  }

  function downloadCsv(csvText, filename) {
    if (!csvText) return;
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // =========================================================
  // Lane layout preset (3 / 5 lanes) for PC/Mobile/cVR
  // =========================================================
  function applyLanePreset(lanes) {
    if (!lanesEl) return;
    const laneEls = $$('.rb-lane', lanesEl);
    if (!laneEls.length) return;

    const count = (lanes === 3) ? 3 : 5;
    wrap && wrap.setAttribute('data-lanes', String(count));

    // 5-lane default labels
    const labels5 = ['L2', 'L1', 'C', 'R1', 'R2'];
    // 3-lane preset uses indexes 0,2,4 visually relabeled L/C/R
    // but engine reads data-lane values; easiest = keep first 3 lanes visible as 0,1,2 and relabel.
    // To avoid remapping complexity in engine, we will:
    // - show lane 0,1,2
    // - hide 3,4
    // - relabel as L,C,R (data-lane stays 0,1,2 => engine laneCount=3 OK)
    if (count === 3) {
      laneEls.forEach((el, idx) => {
        const show = idx < 3;
        el.classList.toggle('hidden', !show);

        const lbl = $('.rb-lane-label', el);
        if (lbl) {
          const labels3 = ['L', 'C', 'R'];
          if (show) lbl.textContent = labels3[idx] || String(idx);
        }

        // normalize lane ids 0..2 for visible lanes
        if (show) el.setAttribute('data-lane', String(idx));
      });

      // ensure hidden lanes keep ids but hidden (not necessary)
      if (lanesEl) {
        lanesEl.style.gridTemplateColumns = 'repeat(3, minmax(0,1fr))';
        lanesEl.style.maxWidth = '760px';
        lanesEl.style.margin = '0 auto';
      }
    } else {
      laneEls.forEach((el, idx) => {
        el.classList.remove('hidden');
        el.setAttribute('data-lane', String(idx));
        const lbl = $('.rb-lane-label', el);
        if (lbl) lbl.textContent = labels5[idx] || String(idx);
      });

      if (lanesEl) {
        lanesEl.style.gridTemplateColumns = 'repeat(5, minmax(0,1fr))';
        lanesEl.style.maxWidth = '';
        lanesEl.style.margin = '';
      }
    }

    // Update helper text in menu/play if needed
    const howto = $('.rb-howto-inline');
    if (howto) {
      if (count === 3) {
        howto.textContent = 'แตะเลน L / C / R ให้โน้ตตรงเส้นตี (เหมาะกับมือถือ/VR Cardboard)';
      } else {
        howto.textContent = 'แตะเลนให้โน้ตตรงเส้นตี (เส้นอยู่เหนือป้ายเลน) · ใช้ได้ทั้งจอสัมผัสและเมาส์';
      }
    }
  }

  function getLanePresetFromQuery() {
    const q = clamp(qsNum('lanes', 5), 3, 5);
    // only allow 3 or 5
    return (q === 3) ? 3 : 5;
  }

  // =========================================================
  // Mode / Track UI
  // =========================================================
  function updateModeUI() {
    const mode = getSelectedMode();

    if (mode === 'normal') {
      safeText(modeDescEl,
        'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)');
      safeText(trackModeLbl,
        'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก');

      if (researchBox) researchBox.classList.add('hidden');

      trackLabels.forEach(lbl => {
        const m = lbl.getAttribute('data-mode') || 'normal';
        lbl.classList.toggle('hidden', m === 'research');
      });

      if (getSelectedTrackKey() === 'r1') setSelectedTrackKey('n1');

    } else {
      safeText(modeDescEl,
        'Research: ใช้เก็บข้อมูลเชิงวิจัย พร้อมดาวน์โหลด CSV');
      safeText(trackModeLbl,
        'โหมด Research — เพลงวิจัย Research Track 120');

      if (researchBox) researchBox.classList.remove('hidden');

      trackLabels.forEach(lbl => {
        const m = lbl.getAttribute('data-mode') || 'normal';
        lbl.classList.toggle('hidden', m !== 'research');
      });

      setSelectedTrackKey('r1');
    }

    // hint: AI lock badge text (optional, if you want to add DOM later)
    if (hud.aiTip && mode === 'research' && !hud.aiTip.textContent) {
      // keep hidden until engine pushes tip
      hud.aiTip.classList.add('hidden');
    }
  }

  function applyModeFromQuery() {
    const m = (qsStr('mode', '') || '').toLowerCase();
    if (m === 'research') setModeRadio('research');
    else if (m === 'play' || m === 'normal') setModeRadio('normal');
  }

  function applyAutoModeFromHubSource() {
    // Optional: if hub sends ?from=hub&mode=research
    const from = (qsStr('from', '') || '').toLowerCase();
    const mode = (qsStr('mode', '') || '').toLowerCase();
    if (from === 'hub' && mode === 'research') setModeRadio('research');
  }

  // =========================================================
  // Engine wiring
  // =========================================================
  function createEngine() {
    const renderer = new WIN.RbDomRenderer(fieldEl, {
      flashEl,
      feedbackEl,
      wrapEl: DOC.body
    });

    engine = new WIN.RhythmBoxerEngine({
      wrap: wrap,
      field: fieldEl,
      lanesEl: lanesEl,
      audio: audioEl,
      renderer,
      hud,
      hooks: {
        onEnd: handleEngineEnd
      }
    });
  }

  function ensureEngine() {
    if (!engine) createEngine();
    return engine;
  }

  function collectResearchMeta() {
    return {
      id:    ((inputParticipant && inputParticipant.value) || '').trim(),
      group: ((inputGroup && inputGroup.value) || '').trim(),
      note:  ((inputNote && inputNote.value) || '').trim()
    };
  }

  function startGame() {
    if (!WIN.RhythmBoxerEngine) {
      alert('ยังไม่พบ RhythmBoxerEngine (ตรวจสอบ script js/rhythm-engine.js)');
      return;
    }
    if (!WIN.RbDomRenderer) {
      alert('ยังไม่พบ RbDomRenderer (ตรวจสอบ script js/dom-renderer-rhythm.js)');
      return;
    }

    ensureEngine();

    const mode = getSelectedMode();
    const trackKey = getSelectedTrackKey();
    const cfg = TRACK_CONFIG[trackKey] || TRACK_CONFIG.n1;
    const meta = collectResearchMeta();

    // apply diff for CSS theming
    if (wrap) wrap.dataset.diff = cfg.diff;

    // HUD top labels
    safeText(hud.mode, (mode === 'research') ? 'Research' : 'Normal');
    safeText(hud.track, cfg.labelShort);

    // AI header default (before engine starts ticking)
    if (hud.aiFatigue) hud.aiFatigue.textContent = '0%';
    if (hud.aiSkill) hud.aiSkill.textContent = '50%';
    if (hud.aiSuggest) hud.aiSuggest.textContent = 'normal';
    if (hud.aiTip) {
      hud.aiTip.textContent = '';
      hud.aiTip.classList.add('hidden');
    }

    // remember last config for replay
    lastStart = {
      mode,
      trackKey,
      meta: { ...meta }
    };

    try {
      engine.start(mode, cfg.engineId, meta);
      switchView('play');
    } catch (err) {
      console.error(err);
      alert('เริ่มเกมไม่สำเร็จ: ' + (err && err.message ? err.message : err));
    }
  }

  function stopGame(reason) {
    if (engine && typeof engine.stop === 'function') {
      engine.stop(reason || 'manual-stop');
    }
  }

  function replayLastGame() {
    if (!lastStart) {
      startGame();
      return;
    }
    ensureEngine();

    const cfg = TRACK_CONFIG[lastStart.trackKey] || TRACK_CONFIG.n1;
    if (wrap) wrap.dataset.diff = cfg.diff;

    safeText(hud.mode, (lastStart.mode === 'research') ? 'Research' : 'Normal');
    safeText(hud.track, cfg.labelShort);

    engine.start(lastStart.mode, cfg.engineId, { ...(lastStart.meta || {}) });
    switchView('play');
  }

  // =========================================================
  // Results
  // =========================================================
  function handleEngineEnd(summary) {
    summary = summary || {};

    safeText(res.mode, summary.modeLabel || '-');
    safeText(res.track, summary.trackName || '-');
    safeText(res.endReason, formatEndReason(summary.endReason));
    safeText(res.score, summary.finalScore != null ? summary.finalScore : 0);
    safeText(res.maxCombo, summary.maxCombo != null ? summary.maxCombo : 0);

    if (res.hits) {
      const p = summary.hitPerfect || 0;
      const g = summary.hitGreat || 0;
      const gd = summary.hitGood || 0;
      const m = summary.hitMiss || 0;
      res.hits.textContent = `${p} / ${g} / ${gd} / ${m}`;
    }

    if (res.acc) {
      const acc = Number(summary.accuracyPct);
      res.acc.textContent = Number.isFinite(acc) ? (acc.toFixed(1) + ' %') : '-';
    }
    if (res.duration) {
      const d = Number(summary.durationSec);
      res.duration.textContent = Number.isFinite(d) ? (d.toFixed(1) + ' s') : '-';
    }

    safeText(res.rank, summary.rank || '-');

    if (res.offsetAvg) {
      const v = Number(summary.offsetMean);
      res.offsetAvg.textContent = Number.isFinite(v) ? (v.toFixed(3) + ' s') : '-';
    }
    if (res.offsetStd) {
      const v = Number(summary.offsetStd);
      res.offsetStd.textContent = Number.isFinite(v) ? (v.toFixed(3) + ' s') : '-';
    }

    safeText(res.participant, summary.participant || '-');

    if (res.qualityNote) {
      const note = summary.qualityNote || '';
      res.qualityNote.textContent = note;
      res.qualityNote.classList.toggle('hidden', !note);
    }

    switchView('result');
  }

  // =========================================================
  // Optional lane tap visual boost (extra feedback)
  // =========================================================
  function bindLaneTapFlash() {
    if (!lanesEl) return;

    lanesEl.addEventListener('pointerdown', (e) => {
      const laneEl = e.target && e.target.closest ? e.target.closest('.rb-lane') : null;
      if (!laneEl) return;
      laneEl.classList.add('is-hit');
      setTimeout(() => laneEl.classList.remove('is-hit'), 90);
    }, { passive: true });
  }

  // =========================================================
  // Download buttons
  // =========================================================
  function bindDownloadButtons() {
    if (btnDlEvents) {
      btnDlEvents.addEventListener('click', () => {
        if (!engine || typeof engine.getEventsCsv !== 'function') return;
        const mode = getSelectedMode();
        const track = getSelectedTrackKey();
        const pid = ((inputParticipant && inputParticipant.value) || 'anon').trim() || 'anon';
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        downloadCsv(engine.getEventsCsv(), `rb-events-${mode}-${track}-${pid}-${ts}.csv`);
      });
    }

    if (btnDlSessions) {
      btnDlSessions.addEventListener('click', () => {
        if (!engine || typeof engine.getSessionCsv !== 'function') return;
        const mode = getSelectedMode();
        const track = getSelectedTrackKey();
        const pid = ((inputParticipant && inputParticipant.value) || 'anon').trim() || 'anon';
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        downloadCsv(engine.getSessionCsv(), `rb-sessions-${mode}-${track}-${pid}-${ts}.csv`);
      });
    }
  }

  // =========================================================
  // Optional: URL hints for lanes / view
  // =========================================================
  function applyViewHints() {
    const lanes = getLanePresetFromQuery();
    applyLanePreset(lanes);

    // hint for cVR style (CSS can read data-view)
    const view = (qsStr('view', '') || '').toLowerCase();
    if (wrap && view) wrap.dataset.view = view;

    // if view=cvr and lanes not explicitly set => prefer 3 lanes
    if (view === 'cvr' && !new URL(location.href).searchParams.has('lanes')) {
      applyLanePreset(3);
    }
  }

  // =========================================================
  // Wiring
  // =========================================================
  function bindEvents() {
    modeRadios.forEach(r => r.addEventListener('change', updateModeUI));

    if (btnStart) btnStart.addEventListener('click', startGame);
    if (btnStop) btnStop.addEventListener('click', () => stopGame('manual-stop'));

    if (btnAgain) {
      btnAgain.addEventListener('click', () => {
        // keep same song + mode + meta
        replayLastGame();
      });
    }

    if (btnBackMenu) {
      btnBackMenu.addEventListener('click', () => {
        switchView('menu');
      });
    }
  }

  // =========================================================
  // Init
  // =========================================================
  function init() {
    applyModeFromQuery();
    applyAutoModeFromHubSource();
    updateModeUI();
    applyViewHints();
    bindLaneTapFlash();
    bindEvents();
    bindDownloadButtons();
    switchView('menu');

    // Pre-create engine? keep lazy for cleaner startup.
    // ensureEngine();

    // Optional debug info
    if (qsBool('debug', false)) {
      console.log('[RhythmBoxer UI] init', {
        mode: getSelectedMode(),
        track: getSelectedTrackKey(),
        lanes: getLanePresetFromQuery(),
        view: qsStr('view', '')
      });
    }
  }

  init();
})();