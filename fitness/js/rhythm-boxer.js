// === js/rhythm-boxer.js — UI glue (menu / play / result) ===
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
  const trackLabels   = $$('#rb-track-options .rb-radio');
  const modeDescEl    = $('#rb-mode-desc');
  const trackModeLbl  = $('#rb-track-mode-label');
  const trackHintEl   = $('#rb-track-hint');
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
    progText:     $('#rb-progress-text')
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
  let lastTrackKey = 'n1';
  let lastMode = 'normal';

  function getSelectedMode() {
    const r = modeRadios.find(x => x.checked);
    return r ? r.value : 'normal';
  }

  function getSelectedTrackKey() {
    const r = trackRadios.find(x => x.checked);
    return r ? r.value : 'n1';
  }

  function setSelectedTrackKey(key) {
    trackRadios.forEach(r => {
      r.checked = (r.value === key);
    });
    lastTrackKey = key;
  }

  function updateModeUI() {
    const mode = getSelectedMode();
    lastMode = mode;

    if (mode === 'normal') {
      modeDescEl.textContent =
        'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
      trackModeLbl.textContent = 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
      trackHintEl.textContent =
        'แนะนำให้เริ่มจาก Warm-up Groove (ง่าย) ก่อน แล้วค่อยลองเพลงที่ยากขึ้น';
      researchBox.classList.add('hidden');

      trackLabels.forEach(lbl => {
        const m = lbl.getAttribute('data-mode') || 'normal';
        if (m === 'research') lbl.classList.add('hidden');
        else lbl.classList.remove('hidden');
      });

      if (!TRACK_CONFIG[getSelectedTrackKey()] ||
          getSelectedTrackKey() === 'r1') {
        setSelectedTrackKey('n1');
      }
    } else {
      modeDescEl.textContent =
        'Research: ใช้เก็บข้อมูลเชิงวิจัย พร้อมดาวน์โหลด CSV (ปิด AI/Practice เพื่อความคงที่)';
      trackModeLbl.textContent = 'โหมด Research — เพลงวิจัย Research Track 120';
      trackHintEl.textContent =
        'ใช้ Research Track 120 สำหรับเก็บ Reaction Time, Accuracy และตัวแปรงานวิจัย';
      researchBox.classList.remove('hidden');

      trackLabels.forEach(lbl => {
        const m = lbl.getAttribute('data-mode') || 'normal';
        if (m === 'research') lbl.classList.remove('hidden');
        else lbl.classList.add('hidden');
      });

      setSelectedTrackKey('r1');
    }
  }

  function switchView(name) {
    viewMenu.classList.add('hidden');
    viewPlay.classList.add('hidden');
    viewResult.classList.add('hidden');

    if (name === 'menu') viewMenu.classList.remove('hidden');
    else if (name === 'play') viewPlay.classList.remove('hidden');
    else if (name === 'result') viewResult.classList.remove('hidden');
  }

  // ===== Mobile audio unlock (tap-to-start) =====
  function unlockAudioOnce(){
    if (!audioEl) return;
    if (audioEl.__rb_unlocked) return;
    audioEl.__rb_unlocked = true;

    try{
      audioEl.muted = true;
      const p = audioEl.play();
      if (p && p.catch) p.catch(()=>{});
      setTimeout(()=>{
        try{
          audioEl.pause();
          audioEl.currentTime = 0;
          audioEl.muted = false;
        }catch(_){}
      }, 60);
    }catch(_){}
  }
  document.addEventListener('pointerdown', unlockAudioOnce, { once:true });

  function createEngine() {
    const renderer = new window.RbDomRenderer(fieldEl, {
      flashEl,
      feedbackEl,
      fieldEl,
      lanesEl,
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
        onEnd: handleEngineEnd
      }
    });
  }

  function startGame() {
    if (!engine) createEngine();

    const mode = getSelectedMode();
    const trackKey = getSelectedTrackKey();
    const cfg = TRACK_CONFIG[trackKey] || TRACK_CONFIG.n1;

    // ปรับขนาดโน้ตตามระดับ (CSS)
    wrap.dataset.diff = cfg.diff;

    hud.mode.textContent  = (mode === 'research') ? 'Research' : 'Normal';
    hud.track.textContent = cfg.labelShort;

    const meta = {
      id:   inputParticipant.value.trim(),
      group: inputGroup.value.trim(),
      note: inputNote.value.trim()
    };

    engine.start(mode, cfg.engineId, meta);
    switchView('play');
  }

  function stopGame(reason) {
    if (engine) {
      engine.stop(reason || 'manual-stop');
    }
  }

  function handleEngineEnd(summary) {
    res.mode.textContent      = summary.modeLabel;
    res.track.textContent     = summary.trackName;
    res.endReason.textContent = summary.endReason;
    res.score.textContent     = summary.finalScore;
    res.maxCombo.textContent  = summary.maxCombo;
    res.hits.textContent      =
      `${summary.hitPerfect} / ${summary.hitGreat} / ` +
      `${summary.hitGood} / ${summary.hitMiss}`;
    res.acc.textContent       = summary.accuracyPct.toFixed(1) + ' %';
    res.duration.textContent  = summary.durationSec.toFixed(1) + ' s';
    res.rank.textContent      = summary.rank;
    res.offsetAvg.textContent =
      summary.offsetMean.toFixed ? summary.offsetMean.toFixed(3) + ' s' : '-';
    res.offsetStd.textContent =
      summary.offsetStd.toFixed ? summary.offsetStd.toFixed(3) + ' s' : '-';
    res.participant.textContent = summary.participant || '-';

    if (summary.qualityNote) {
      res.qualityNote.textContent = summary.qualityNote;
      res.qualityNote.classList.remove('hidden');
    } else {
      res.qualityNote.textContent = '';
      res.qualityNote.classList.add('hidden');
    }

    switchView('result');
  }

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

  // ===== Crosshair shoot support (HHA VR UI) =====
  // vr-ui.js emits: hha:shoot {x,y,lockPx,source}
  function laneFromXY(x, y){
    if (!lanesEl) return null;
    const r = lanesEl.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;

    const laneEls = $$('.rb-lane');
    if (!laneEls.length) return null;

    let bestLane = null;
    let bestDist = Infinity;
    for (const el of laneEls){
      const lr = el.getBoundingClientRect();
      const cx = lr.left + lr.width/2;
      const cy = lr.top + lr.height/2;
      const dx = x - cx, dy = y - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestDist){
        bestDist = d2;
        bestLane = parseInt(el.dataset.lane || '0', 10);
      }
    }
    return bestLane;
  }

  window.addEventListener('hha:shoot', (ev)=>{
    if (!engine) return;
    if (viewPlay.classList.contains('hidden')) return;
    const d = ev && ev.detail ? ev.detail : {};
    const lane = laneFromXY(d.x, d.y);
    if (lane == null) return;
    engine.handleLaneTap(lane);
  });

  // ===== event wiring =====
  modeRadios.forEach(r => r.addEventListener('change', updateModeUI));

  btnStart.addEventListener('click', () => startGame());
  btnStop.addEventListener('click', () => stopGame('manual-stop'));

  btnAgain.addEventListener('click', () => {
    switchView('menu');
    startGame();
  });

  btnBackMenu.addEventListener('click', () => switchView('menu'));

  btnDlEvents.addEventListener('click', () => {
    if (!engine) return;
    downloadCsv(engine.getEventsCsv(), 'rb-events.csv');
  });

  btnDlSessions.addEventListener('click', () => {
    if (!engine) return;
    downloadCsv(engine.getSessionCsv(), 'rb-sessions.csv');
  });

  updateModeUI();
  switchView('menu');

})();
