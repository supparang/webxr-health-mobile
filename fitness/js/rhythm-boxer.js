// === /fitness/js/rhythm-boxer.js — UI glue (menu / play / result) [PATCH LATEST] ===
'use strict';

(function () {

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const wrap = $('#rb-wrap');
  const viewMenu   = $('#rb-view-menu');
  const viewPlay   = $('#rb-view-play');
  const viewResult = $('#rb-view-result');

  const flashEl    = $('#rb-flash');
  const fieldEl    = $('#rb-field');
  const lanesEl    = $('#rb-lanes');
  const feedbackEl = $('#rb-feedback');
  const audioEl    = $('#rb-audio');

  // ปุ่มเมนู
  const btnStart      = $('#rb-btn-start');
  const modeRadios    = $$('input[name="rb-mode"]');
  const trackRadios   = $$('input[name="rb-track"]');
  const trackLabels   = $$('#rb-track-options .rb-mode-btn');
  const modeDescEl    = $('#rb-mode-desc');
  const trackModeLbl  = $('#rb-track-mode-label');
  const researchBox   = $('#rb-research-fields');

  // ฟอร์มวิจัย
  const inputParticipant = $('#rb-participant');
  const inputGroup       = $('#rb-group');
  const inputNote        = $('#rb-note');

  // ปุ่มตอนเล่น / สรุปผล
  const btnStop        = $('#rb-btn-stop');
  const btnAgain       = $('#rb-btn-again');
  const btnBackMenu    = $('#rb-btn-back-menu');
  const btnDlEvents    = $('#rb-btn-dl-events');
  const btnDlSessions  = $('#rb-btn-dl-sessions');

  // HUD elements
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

  // แสดงผลสรุป
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

  // mapping เพลงในเมนู → engine trackId + diff + label
  const TRACK_CONFIG = {
    n1: { engineId: 'n1', labelShort: 'Warm-up Groove', diff: 'easy'   },
    n2: { engineId: 'n2', labelShort: 'Focus Combo',    diff: 'normal' },
    n3: { engineId: 'n3', labelShort: 'Speed Rush',     diff: 'hard'   },
    r1: { engineId: 'r1', labelShort: 'Research 120',   diff: 'normal' }
  };

  let engine = null;
  let isStarting = false;
  let lastRun = { mode: 'normal', trackKey: 'n1' };

  // ---------- query helpers ----------
  function readQuery() {
    try {
      return new URL(location.href).searchParams;
    } catch (_) {
      return new URLSearchParams();
    }
  }

  function readQueryMode() {
    const q = readQuery();
    const m = String(q.get('mode') || '').toLowerCase();
    if (m === 'research') return 'research';
    return 'normal'; // play / normal / empty => normal
  }

  function readQueryTrack() {
    const q = readQuery();
    const t = String(q.get('track') || '').toLowerCase();
    return TRACK_CONFIG[t] ? t : null;
  }

  function aiFlagsText() {
    const ai = window.RB_AI;
    if (!ai) return 'AI: predictor unavailable';
    const locked = !!(ai.isLocked && ai.isLocked());
    const assist = !!(ai.isAssistEnabled && ai.isAssistEnabled());
    if (locked) return 'AI: prediction ON · gameplay adjust OFF (Research Lock)';
    return assist
      ? 'AI: prediction ON · assist ON (?ai=1)'
      : 'AI: prediction ON · assist OFF';
  }

  // ---------- mode / track selection ----------
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

  function setSelectedMode(mode) {
    const m = (mode === 'research') ? 'research' : 'normal';
    const r = modeRadios.find(x => x.value === m);
    if (r) r.checked = true;
    updateModeUI();
  }

  function updateModeUI() {
    const mode = getSelectedMode();

    if (mode === 'normal') {
      if (modeDescEl) {
        modeDescEl.textContent =
          'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
      }
      if (trackModeLbl) {
        trackModeLbl.textContent = 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
      }
      if (researchBox) researchBox.classList.add('hidden');

      trackLabels.forEach(lbl => {
        const m = lbl.getAttribute('data-mode') || 'normal';
        if (m === 'research') lbl.classList.add('hidden');
        else lbl.classList.remove('hidden');
      });

      if (getSelectedTrackKey() === 'r1') setSelectedTrackKey('n1');

    } else {
      if (modeDescEl) {
        modeDescEl.textContent =
          'Research: ใช้เก็บข้อมูลเชิงวิจัย พร้อมดาวน์โหลด CSV (AI prediction แสดงได้ แต่ไม่ปรับเกม)';
      }
      if (trackModeLbl) {
        trackModeLbl.textContent = 'โหมด Research — เพลงวิจัย Research Track 120';
      }
      if (researchBox) researchBox.classList.remove('hidden');

      trackLabels.forEach(lbl => {
        const m = lbl.getAttribute('data-mode') || 'normal';
        if (m === 'research') lbl.classList.remove('hidden');
        else lbl.classList.add('hidden');
      });

      setSelectedTrackKey('r1');
    }
  }

  // ---------- view switching ----------
  function switchView(name) {
    if (viewMenu) viewMenu.classList.add('hidden');
    if (viewPlay) viewPlay.classList.add('hidden');
    if (viewResult) viewResult.classList.add('hidden');

    if (name === 'menu' && viewMenu) viewMenu.classList.remove('hidden');
    else if (name === 'play' && viewPlay) viewPlay.classList.remove('hidden');
    else if (name === 'result' && viewResult) viewResult.classList.remove('hidden');
  }

  function setBtnBusy(isBusy) {
    if (!btnStart) return;
    btnStart.disabled = !!isBusy;
    btnStart.style.opacity = isBusy ? '0.75' : '';
    btnStart.style.pointerEvents = isBusy ? 'none' : '';
  }

  // ---------- engine ----------
  function createEngine() {
    const renderer = new window.RbDomRenderer(fieldEl, {
      flashEl,
      feedbackEl,
      wrapEl: document.body
    });

    engine = new window.RhythmBoxerEngine({
      wrap: wrap,
      field: fieldEl,
      lanesEl: lanesEl,
      audio: audioEl,
      renderer: renderer,
      hud: hud,
      hooks: {
        onEnd: handleEngineEnd,
        onAIUpdate: handleAIUpdate
      }
    });
  }

  function startGame() {
    if (isStarting) return;
    isStarting = true;
    setBtnBusy(true);

    try {
      if (!engine) createEngine();

      const mode = getSelectedMode();
      const trackKey = getSelectedTrackKey();
      const cfg = TRACK_CONFIG[trackKey] || TRACK_CONFIG.n1;

      lastRun = { mode, trackKey };

      if (wrap) wrap.dataset.diff = cfg.diff;

      if (hud.mode) hud.mode.textContent  = (mode === 'research') ? 'Research' : 'Normal';
      if (hud.track) hud.track.textContent = cfg.labelShort;

      // reset AI HUD lines before start
      if (hud.aiFatigue) hud.aiFatigue.textContent = '0%';
      if (hud.aiSkill) hud.aiSkill.textContent = '50%';
      if (hud.aiSuggest) hud.aiSuggest.textContent = 'normal';
      if (hud.aiTip) {
        hud.aiTip.textContent = aiFlagsText();
        hud.aiTip.classList.remove('hidden');
      }

      const meta = {
        id:   (inputParticipant && inputParticipant.value || '').trim(),
        group:(inputGroup && inputGroup.value || '').trim(),
        note: (inputNote && inputNote.value || '').trim()
      };

      engine.start(mode, cfg.engineId, meta);
      switchView('play');
    } finally {
      // กัน double-click ช่วงเริ่ม
      setTimeout(() => {
        isStarting = false;
        setBtnBusy(false);
      }, 250);
    }
  }

  function stopGame(reason) {
    if (engine) engine.stop(reason || 'manual-stop');
  }

  function handleEngineEnd(summary) {
    if (!summary) return;

    if (res.mode)        res.mode.textContent      = summary.modeLabel ?? '-';
    if (res.track)       res.track.textContent     = summary.trackName ?? '-';
    if (res.endReason)   res.endReason.textContent = summary.endReason ?? '-';
    if (res.score)       res.score.textContent     = String(summary.finalScore ?? 0);
    if (res.maxCombo)    res.maxCombo.textContent  = String(summary.maxCombo ?? 0);
    if (res.hits) {
      res.hits.textContent = `${summary.hitPerfect ?? 0} / ${summary.hitGreat ?? 0} / ${summary.hitGood ?? 0} / ${summary.hitMiss ?? 0}`;
    }
    if (res.acc)         res.acc.textContent       = (Number(summary.accuracyPct || 0)).toFixed(1) + ' %';
    if (res.duration)    res.duration.textContent  = (Number(summary.durationSec || 0)).toFixed(1) + ' s';
    if (res.rank)        res.rank.textContent      = summary.rank ?? '-';

    if (res.offsetAvg) {
      res.offsetAvg.textContent =
        (summary.offsetMean != null && Number.isFinite(summary.offsetMean))
          ? Number(summary.offsetMean).toFixed(3) + ' s'
          : '-';
    }
    if (res.offsetStd) {
      res.offsetStd.textContent =
        (summary.offsetStd != null && Number.isFinite(summary.offsetStd))
          ? Number(summary.offsetStd).toFixed(3) + ' s'
          : '-';
    }
    if (res.participant) {
      res.participant.textContent = summary.participant || '-';
    }

    if (res.qualityNote) {
      if (summary.qualityNote) {
        res.qualityNote.textContent = summary.qualityNote;
        res.qualityNote.classList.remove('hidden');
      } else {
        res.qualityNote.textContent = '';
        res.qualityNote.classList.add('hidden');
      }
    }

    switchView('result');
  }

  function handleAIUpdate(ai){
    if (!ai || !hud) return;
    if (hud.aiFatigue) hud.aiFatigue.textContent = Math.round((ai.fatigueRisk||0)*100) + '%';
    if (hud.aiSkill)   hud.aiSkill.textContent   = Math.round((ai.skillScore||0)*100) + '%';
    if (hud.aiSuggest) hud.aiSuggest.textContent = (ai.suggestedDifficulty||'normal');
    if (hud.aiTip){
      const txt = ai.tip || aiFlagsText();
      hud.aiTip.textContent = txt;
      hud.aiTip.classList.toggle('hidden', !txt);
    }
  }

  // ---------- CSV ----------
  function downloadCsv(csvText, filename) {
    if (!csvText) return;
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- URL presets ----------
  function applyModeTrackFromQuery(){
    const qMode = readQueryMode();
    const qTrack = readQueryTrack();

    setSelectedMode(qMode);

    if (qTrack) {
      // only apply if visible/allowed in mode
      if (qMode === 'research' && qTrack === 'r1') setSelectedTrackKey('r1');
      if (qMode === 'normal' && qTrack !== 'r1') setSelectedTrackKey(qTrack);
    }

    updateModeUI();
  }

  // ---------- wiring ----------
  modeRadios.forEach(r => r.addEventListener('change', updateModeUI));

  if (btnStart) btnStart.addEventListener('click', startGame);
  if (btnStop) btnStop.addEventListener('click', () => stopGame('manual-stop'));

  if (btnAgain) {
    btnAgain.addEventListener('click', () => {
      // เล่นเพลงเดิม / โหมดเดิมทันที
      setSelectedMode(lastRun.mode);
      setSelectedTrackKey(lastRun.trackKey);
      startGame();
    });
  }

  if (btnBackMenu) {
    btnBackMenu.addEventListener('click', () => {
      switchView('menu');
    });
  }

  if (btnDlEvents) {
    btnDlEvents.addEventListener('click', () => {
      if (!engine || typeof engine.getEventsCsv !== 'function') return;
      const pid = (inputParticipant && inputParticipant.value || '').trim();
      const suffix = pid ? `-${pid}` : '';
      downloadCsv(engine.getEventsCsv(), `rb-events${suffix}.csv`);
    });
  }

  if (btnDlSessions) {
    btnDlSessions.addEventListener('click', () => {
      if (!engine || typeof engine.getSessionCsv !== 'function') return;
      const pid = (inputParticipant && inputParticipant.value || '').trim();
      const suffix = pid ? `-${pid}` : '';
      downloadCsv(engine.getSessionCsv(), `rb-sessions${suffix}.csv`);
    });
  }

  // Keyboard shortcuts (UI level)
  document.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();

    // ESC = stop during play
    if (k === 'escape' && viewPlay && !viewPlay.classList.contains('hidden')) {
      stopGame('manual-stop');
      return;
    }

    // Enter = start from menu
    if (k === 'enter' && viewMenu && !viewMenu.classList.contains('hidden')) {
      if (btnStart && !btnStart.disabled) startGame();
      return;
    }

    // R = replay from result
    if (k === 'r' && viewResult && !viewResult.classList.contains('hidden')) {
      if (btnAgain) btnAgain.click();
      return;
    }
  });

  // ---------- init ----------
  applyModeTrackFromQuery();
  switchView('menu');

})();