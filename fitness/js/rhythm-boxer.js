// === js/rhythm-boxer.js — Rhythm Boxer bootstrap + UI wiring (2025-11-30) ===
'use strict';

(function () {
  const $  = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  let engine = null;
  let lastConfig = null;

  function showView(name) {
    const views = ['rb-view-menu', 'rb-view-play', 'rb-view-result'];
    views.forEach(id => {
      const el = $(id);
      if (!el) return;
      el.classList.toggle('hidden', id !== name);
    });
  }

  function getSelectedMode() {
    const r = document.querySelector('input[name="mode"]:checked');
    return r ? r.value : 'normal';
  }

  function getSelectedTrackId(mode) {
    const sel = $('rb-track');
    if (!sel) return 't1';
    let v = sel.value || 't1';
    // ถ้าเลือกโหมดวิจัย ให้ล็อกเพลงเป็น research track
    if (mode === 'research') {
      v = 'research';
      sel.value = 'research';
    }
    return v;
  }

  function collectResearchMeta() {
    return {
      id:    ($('rb-participant')?.value || '').trim(),
      group: ($('rb-group')?.value || '').trim(),
      note:  ($('rb-note')?.value || '').trim(),
    };
  }

  function updateResearchFieldsVisibility() {
    const mode = getSelectedMode();
    const box  = $('rb-research-fields');
    if (!box) return;
    box.classList.toggle('hidden', mode !== 'research');
  }

  function bindUI() {
    const wrap    = $('rb-wrap');
    const field   = $('rb-field');
    const lanes   = $('rb-lanes');
    const audioEl = $('rb-audio');
    const flashEl = $('rb-flash');
    const feedbackEl = $('rb-feedback');

    if (!wrap || !field || !lanes) {
      console.error('[RhythmBoxer] Missing core DOM elements.');
      return;
    }

    const renderer = new window.RbDomRenderer(field, {
      flashEl,
      feedbackEl,
      wrapEl: wrap
    });

    engine = new window.RhythmBoxerEngine({
      wrap,
      field,
      lanesEl: lanes,
      audio: audioEl,
      renderer,
      hud: {
        mode:   $('rb-hud-mode'),
        track:  $('rb-hud-track'),
        score:  $('rb-hud-score'),
        combo:  $('rb-hud-combo'),
        acc:    $('rb-hud-acc'),
        hp:     $('rb-hud-hp'),
        shield: $('rb-hud-shield'),
        time:   $('rb-hud-time'),

        feverFill:   $('rb-fever-fill'),
        feverStatus: $('rb-fever-status'),
        progFill:    $('rb-progress-fill'),
        progText:    $('rb-progress-text'),

        countPerfect: $('rb-hud-perfect'),
        countGreat:   $('rb-hud-great'),
        countGood:    $('rb-hud-good'),
        countMiss:    $('rb-hud-miss'),
      },
      hooks: {
        onEnd: (summary) => {
          // เติมหน้าผลลัพธ์
          const setText = (id, v) => {
            const el = $(id);
            if (el) el.textContent = v;
          };

          setText('rb-res-mode',  summary.modeLabel || '-');
          setText('rb-res-track', summary.trackName || '-');
          setText('rb-res-endreason', summary.endReason || '-');
          setText('rb-res-score', summary.finalScore);
          setText('rb-res-maxcombo', summary.maxCombo);
          setText(
            'rb-res-detail-hit',
            `${summary.hitPerfect} / ${summary.hitGreat} / ${summary.hitGood} / ${summary.hitMiss}`
          );
          setText('rb-res-acc', summary.accuracyPct.toFixed(1) + ' %');
          setText(
            'rb-res-offset-avg',
            summary.offsetMean != null
              ? (summary.offsetMean.toFixed(3) + ' s')
              : '-'
          );
          setText(
            'rb-res-offset-std',
            summary.offsetStd != null
              ? (summary.offsetStd.toFixed(3) + ' s')
              : '-'
          );
          setText('rb-res-duration', summary.durationSec.toFixed(1) + ' s');
          setText('rb-res-participant', summary.participant || '-');
          setText('rb-res-rank', summary.rank || '-');

          const qnote = $('rb-res-quality-note');
          if (qnote) {
            if (summary.qualityNote) {
              qnote.textContent = summary.qualityNote;
              qnote.classList.remove('hidden');
            } else {
              qnote.classList.add('hidden');
            }
          }

          showView('rb-view-result');
        }
      }
    });

    // ====== Events ======

    // เปลี่ยนโหมด → แสดง/ซ่อนฟอร์มวิจัย
    $$('input[name="mode"]').forEach(radio => {
      radio.addEventListener('change', updateResearchFieldsVisibility);
    });
    updateResearchFieldsVisibility();

    // ปุ่มเริ่มเกม
    const btnStart = $('rb-btn-start');
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        if (!engine) return;
        const mode = getSelectedMode();
        const trackId = getSelectedTrackId(mode);
        const meta = mode === 'research' ? collectResearchMeta() : {};

        lastConfig = { mode, trackId, meta };

        engine.start(mode, trackId, meta);

        // HUD เบื้องต้น
        const trackMeta = window.RB_TRACKS_META?.find(t => t.id === trackId) || null;
        if ($('rb-hud-mode'))  $('rb-hud-mode').textContent  = (mode === 'research' ? 'Research' : 'Normal');
        if ($('rb-hud-track')) $('rb-hud-track').textContent = trackMeta ? trackMeta.nameShort : trackId;

        showView('rb-view-play');
      });
    }

    // ปุ่มหยุดก่อนเวลา
    const btnStop = $('rb-btn-stop');
    if (btnStop) {
      btnStop.addEventListener('click', () => {
        if (!engine) return;
        engine.stop('manual-stop');
      });
    }

    // ปุ่มกลับเมนูจาก result
    const btnBackMenu = $('rb-btn-back-menu');
    if (btnBackMenu) {
      btnBackMenu.addEventListener('click', () => {
        showView('rb-view-menu');
      });
    }

    // ปุ่มเล่นซ้ำเพลงเดิม
    const btnAgain = $('rb-btn-again');
    if (btnAgain) {
      btnAgain.addEventListener('click', () => {
        if (!engine || !lastConfig) return;
        engine.start(lastConfig.mode, lastConfig.trackId, lastConfig.meta || {});
        showView('rb-view-play');
      });
    }

    // โหลด CSV
    function downloadCsv(name, text) {
      if (!text) {
        alert('ยังไม่มีข้อมูล CSV ลองเล่นเกมให้จบก่อนค่ะ');
        return;
      }
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    const btnEv = $('rb-btn-dl-events');
    if (btnEv) {
      btnEv.addEventListener('click', () => {
        if (!engine) return;
        downloadCsv('rhythm-boxer-events.csv', engine.getEventsCsv());
      });
    }

    const btnSess = $('rb-btn-dl-sessions');
    if (btnSess) {
      btnSess.addEventListener('click', () => {
        if (!engine) return;
        downloadCsv('rhythm-boxer-sessions.csv', engine.getSessionCsv());
      });
    }

    // แตะ lane → ส่งให้ engine judge
    if (lanes) {
      lanes.addEventListener('pointerdown', (ev) => {
        if (!engine) return;
        const laneEl = ev.target.closest('.rb-lane');
        if (!laneEl) return;
        const lane = parseInt(laneEl.dataset.lane || '0', 10);
        engine.handleLaneTap(lane);
      });
    }

    // เริ่มต้นเปิดที่หน้าเมนู
    showView('rb-view-menu');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUI);
  } else {
    bindUI();
  }
})();
