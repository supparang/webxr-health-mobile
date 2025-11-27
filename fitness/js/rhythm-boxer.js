// === js/rhythm-boxer.js — UI Controller (2025-12-02) ===
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const wrap = $('#rb-wrap');
  const viewMenu = $('#rb-view-menu');
  const viewPlay = $('#rb-view-play');
  const viewResult = $('#rb-view-result');

  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const trackOptions = $('#rb-track-options');

  const modeDesc = $('#rb-mode-desc');
  const trackModeLabel = $('#rb-track-mode-label');
  const trackHint = $('#rb-track-hint');

  const researchBox = $('#rb-research-fields');

  const feedbackEl = $('#rb-feedback');
  const flashEl = $('#rb-flash');
  const fieldEl = $('#rb-field');
  const lanesEl = $('#rb-lanes');
  const audioEl = $('#rb-audio');

  const hud = {
    score: $('#rb-hud-score'),
    combo: $('#rb-hud-combo'),
    hp: $('#rb-hud-hp'),
    shield: $('#rb-hud-shield'),
    time: $('#rb-hud-time'),
    acc: $('#rb-hud-acc'),
    countPerfect: $('#rb-hud-perfect'),
    countGreat: $('#rb-hud-great'),
    countGood: $('#rb-hud-good'),
    countMiss: $('#rb-hud-miss'),
    feverFill: $('#rb-fever-fill'),
    feverStatus: $('#rb-fever-status'),
    progFill: $('#rb-progress-fill'),
    progText: $('#rb-progress-text')
  };

  const renderer = new window.RbDomRenderer(fieldEl, {
    flashEl,
    feedbackEl,
    wrapEl: document.body
  });

  const engine = new window.RhythmBoxerEngine({
    wrap,
    field: fieldEl,
    lanesEl,
    audio: audioEl,
    renderer,
    hud,
    hooks: {
      onEnd: handleEnd
    }
  });

  function getCurrentMode() {
    const r = document.querySelector('input[name="mode"]:checked');
    return r ? r.value : 'normal';
  }

  function updateModeUI() {
    const mode = getCurrentMode();
    const isResearch = mode === 'research';

    modeDesc.textContent = isResearch
      ? 'Research: ใช้เก็บข้อมูลเชิงวิจัย พร้อมดาวน์โหลด CSV'
      : 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';

    researchBox.classList.toggle('hidden', !isResearch);

    // โชว์เพลงเฉพาะโหมด
    if (trackOptions) {
      const labels = trackOptions.querySelectorAll('.rb-radio');
      let firstVisible = null;

      labels.forEach((lbl) => {
        const m = lbl.dataset.mode || 'normal';
        const show = isResearch ? m === 'research' : m === 'normal';
        lbl.style.display = show ? 'inline-flex' : 'none';
        const radio = lbl.querySelector('input[type="radio"]');
        if (show && !firstVisible) firstVisible = radio;
        if (!show && radio && radio.checked) {
          radio.checked = false;
        }
      });

      if (!document.querySelector('input[name="track"]:checked') && firstVisible) {
        firstVisible.checked = true;
      }
    }

    trackModeLabel.textContent = isResearch
      ? 'โหมด Research — ใช้ Research Track 120 สำหรับงานทดลอง'
      : 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';

    trackHint.textContent = isResearch
      ? 'เลือก Research Track 120 เพื่อเก็บ Offset / Reaction Time อย่างสม่ำเสมอ'
      : 'แนะนำให้เริ่มจาก Warm-up Groove (ง่าย) แล้วค่อยลองเพลงที่ยากขึ้น';
  }

  modeRadios.forEach((r) => {
    r.addEventListener('change', updateModeUI);
  });
  updateModeUI();

  // เริ่มเล่น
  $('#rb-btn-start').addEventListener('click', () => {
    const mode = getCurrentMode();
    const trackRadio = document.querySelector('input[name="track"]:checked');
    const trackId = trackRadio ? trackRadio.value : 'n1';

    const meta = {};
    if (mode === 'research') {
      meta.id = ($('#rb-participant').value || '').trim();
      meta.group = ($('#rb-group').value || '').trim();
      meta.note = ($('#rb-note').value || '').trim();
    }

    applyDiffForTrack(trackId);

    $('#rb-hud-mode').textContent = mode === 'research' ? 'Research' : 'Normal';
    const tMeta = findTrackMeta(trackId);
    $('#rb-hud-track').textContent = tMeta ? tMeta.nameShort : trackId;

    showView('play');
    engine.start(mode, trackId, meta);
  });

  // หยุดก่อนเวลา
  $('#rb-btn-stop').addEventListener('click', () => {
    engine.stop('user-stop');
  });

  // ปุ่มสรุปผล
  $('#rb-btn-again').addEventListener('click', () => {
    showView('menu');
  });
  $('#rb-btn-back-menu').addEventListener('click', () => {
    showView('menu');
  });

  // ดาวน์โหลด CSV
  $('#rb-btn-dl-events').addEventListener('click', () => {
    downloadCsv(engine.getEventsCsv(), 'rb-events.csv');
  });
  $('#rb-btn-dl-sessions').addEventListener('click', () => {
    downloadCsv(engine.getSessionCsv(), 'rb-sessions.csv');
  });

  function showView(which) {
    viewMenu.classList.add('hidden');
    viewPlay.classList.add('hidden');
    viewResult.classList.add('hidden');

    if (which === 'play') viewPlay.classList.remove('hidden');
    else if (which === 'result') viewResult.classList.remove('hidden');
    else viewMenu.classList.remove('hidden');

    window.scrollTo(0, 0);
  }

  function handleEnd(summary) {
    $('#rb-res-mode').textContent = summary.modeLabel;
    $('#rb-res-track').textContent = summary.trackName;
    $('#rb-res-endreason').textContent =
      summary.endReason === 'song-end'
        ? 'เพลงจบ'
        : summary.endReason === 'user-stop' ||
          summary.endReason === 'manual-stop'
        ? 'หยุดก่อนเวลา'
        : summary.endReason;

    $('#rb-res-score').textContent = summary.finalScore;
    $('#rb-res-maxcombo').textContent = summary.maxCombo;
    $('#rb-res-detail-hit').textContent = `${summary.hitPerfect} / ${summary.hitGreat} / ${summary.hitGood} / ${summary.hitMiss}`;
    $('#rb-res-acc').textContent = summary.accuracyPct.toFixed(1) + ' %';
    $('#rb-res-duration').textContent = summary.durationSec.toFixed(1) + ' s';
    $('#rb-res-rank').textContent = summary.rank;
    $('#rb-res-offset-avg').textContent = summary.offsetMean.toFixed(3) + ' s';
    $('#rb-res-offset-std').textContent = summary.offsetStd.toFixed(3) + ' s';
    $('#rb-res-participant').textContent = summary.participant || '-';

    const q = $('#rb-res-quality-note');
    if (summary.qualityNote) {
      q.textContent = summary.qualityNote;
      q.classList.remove('hidden');
    } else {
      q.classList.add('hidden');
    }

    showView('result');
  }

  function downloadCsv(csv, filename) {
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function findTrackMeta(id) {
    const list = window.RB_TRACKS_META || [];
    return list.find((t) => t.id === id) || null;
  }

  function applyDiffForTrack(trackId) {
    const meta = findTrackMeta(trackId);
    const diff = meta ? meta.diff || 'normal' : 'normal';
    if (!wrap) return;
    if (diff === 'easy' || diff === 'hard') {
      wrap.dataset.diff = diff;
    } else {
      wrap.dataset.diff = 'normal';
    }
  }
})();
