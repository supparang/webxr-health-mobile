// === /herohealth/vr-groups/groups-cvr-summary-fit-v23b.js ===
// HeroHealth Groups cVR — v2.3b Summary Top Fit + Score Note Clean
// Fixes:
// - Summary title slightly clipped at top.
// - "Balanced score" note feels odd when display score > raw score.
// - Ensures displayed cVR summary score never exceeds raw score.
// - Cleans wording to "คะแนนสรุปมาตรฐาน cVR".
// PATCH v20260517-GROUPS-CVR-V23B-SUMMARY-TOP-FIT-SCORE-NOTE

(function () {
  'use strict';

  const VERSION = 'v2.3b-cvr-summary-top-fit-score-note-20260517';

  if (window.__HHA_GROUPS_CVR_SUMMARY_FIT_V23B__) return;
  window.__HHA_GROUPS_CVR_SUMMARY_FIT_V23B__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    appliedCount: 0,
    lastSig: '',
    observerInstalled: false
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function n(v, fallback) {
    const x = Number(String(v || '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function isSummaryActive() {
    const summary = $('summary');
    return Boolean(summary && summary.classList.contains('active'));
  }

  function injectStyle() {
    if ($('groups-cvr-v23b-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v23b-style';
    style.textContent = `
      body.cvr-summary-active #summary{
        padding-top:calc(48px + env(safe-area-inset-top,0px)) !important;
        padding-bottom:calc(34px + env(safe-area-inset-bottom,0px)) !important;
        overflow:auto !important;
        -webkit-overflow-scrolling:touch !important;
      }

      body.cvr-summary-active #summary .card{
        margin-top:0 !important;
      }

      body.cvr-summary-active #summary h1{
        margin-top:8px !important;
        line-height:1.08 !important;
        padding-top:2px !important;
      }

      body.cvr-summary-active #summary .hero-icon{
        margin-top:2px !important;
        margin-bottom:16px !important;
      }

      body.cvr-summary-active #summary .cvr-v23-note{
        background:linear-gradient(135deg,#f5fff1,#ffffff) !important;
        border-color:#d8f4cf !important;
        color:#4f7c5a !important;
      }

      body.cvr-summary-active #summary .cvr-v23-note .cvr-v23-raw{
        color:#7193a8 !important;
        font-weight:850 !important;
      }

      body.cvr-summary-active #summary .cvr-v23b-clean-note{
        display:block;
        margin-top:4px;
        color:#7193a8;
        font-size:11px;
        font-weight:850;
      }

      @media (max-width:640px){
        body.cvr-summary-active #summary{
          padding-top:calc(38px + env(safe-area-inset-top,0px)) !important;
        }

        body.cvr-summary-active #summary h1{
          font-size:clamp(38px,11vw,58px) !important;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function getStorageSummary() {
    try {
      const raw = localStorage.getItem('HHA_GROUPS_CVR_SUMMARY');
      if (raw) return JSON.parse(raw);
    } catch (e) {}

    return null;
  }

  function setStorageSummary(patch) {
    try {
      const raw = localStorage.getItem('HHA_GROUPS_CVR_SUMMARY');
      if (raw) {
        const data = JSON.parse(raw);
        Object.assign(data, patch);
        localStorage.setItem('HHA_GROUPS_CVR_SUMMARY', JSON.stringify(data));
      }

      const last = localStorage.getItem('HHA_LAST_SUMMARY');
      if (last) {
        const obj = JSON.parse(last);
        if (obj && obj.summary && obj.summary.game === 'groups') {
          Object.assign(obj.summary, patch);
          localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(obj));
        }
      }
    } catch (e) {}
  }

  function rawScoreFromNote() {
    const note = $('cvrV23Note');
    const txt = note ? note.textContent || '' : '';
    const m = txt.match(/Raw:\s*([\d,]+)/i);
    return m ? n(m[1], 0) : 0;
  }

  function rawComboFromNote() {
    const note = $('cvrV23Note');
    const txt = note ? note.textContent || '' : '';
    const m = txt.match(/Combo raw:\s*([\d,]+)/i);
    return m ? n(m[1], 0) : 0;
  }

  function getMetrics() {
    const stored = getStorageSummary() || {};

    const shownScore = n(($('scoreText') || {}).textContent, 0);
    const shownCombo = n(($('comboText') || {}).textContent, 0);

    const rawScore =
      n(stored.rawScore, 0) ||
      rawScoreFromNote() ||
      n(stored.score, shownScore) ||
      shownScore;

    const rawCombo =
      n(stored.rawBestCombo, 0) ||
      rawComboFromNote() ||
      n(stored.bestCombo, shownCombo) ||
      shownCombo;

    const correct = n(($('correctText') || {}).textContent, n(stored.correct, 0));
    const accuracy = n(($('accuracyText') || {}).textContent, n(stored.accuracy, 0));

    return {
      shownScore,
      shownCombo,
      rawScore,
      rawCombo,
      correct,
      accuracy
    };
  }

  function cleanScore(m) {
    /*
      Important:
      Summary score should never be higher than raw score.
      If v23 makes a display score above raw, clamp it back down.
    */
    if (m.rawScore > 0) return Math.min(m.shownScore || m.rawScore, m.rawScore);
    return m.shownScore;
  }

  function cleanCombo(m) {
    if (m.rawCombo > 0) return Math.min(m.shownCombo || m.rawCombo, m.rawCombo);
    return m.shownCombo;
  }

  function updateNote(m, displayScore, displayCombo) {
    let note = $('cvrV23Note');

    if (!note) {
      const stats = DOC.querySelector('#summary .summary-stats');
      if (!stats || !stats.parentNode) return;

      note = DOC.createElement('div');
      note.id = 'cvrV23Note';
      note.className = 'cvr-v23-note';
      stats.parentNode.insertBefore(note, stats.nextSibling);
    }

    const scoreChanged = displayScore !== m.rawScore;
    const comboChanged = displayCombo !== m.rawCombo;

    if (scoreChanged || comboChanged) {
      note.innerHTML =
        `คะแนนสรุปมาตรฐาน cVR เพื่อให้อ่านง่ายและเปรียบเทียบได้ยุติธรรม` +
        `<span class="cvr-v23-raw">Raw: ${m.rawScore} คะแนน • Combo raw: ${m.rawCombo}</span>`;
    } else {
      note.innerHTML =
        `คะแนนสรุปมาตรฐาน cVR ตรงกับผลการเล่นจริง` +
        `<span class="cvr-v23-raw">Raw: ${m.rawScore} คะแนน • Combo raw: ${m.rawCombo}</span>`;
    }
  }

  function apply() {
    if (!isSummaryActive()) return;

    DOC.body.classList.add('cvr-summary-active');

    const m = getMetrics();
    const displayScore = cleanScore(m);
    const displayCombo = cleanCombo(m);

    const sig = [
      m.shownScore,
      m.shownCombo,
      m.rawScore,
      m.rawCombo,
      displayScore,
      displayCombo,
      m.correct,
      m.accuracy
    ].join('|');

    if ($('scoreText')) $('scoreText').textContent = displayScore;
    if ($('comboText')) $('comboText').textContent = displayCombo;

    updateNote(m, displayScore, displayCombo);

    setStorageSummary({
      displayScore,
      displayCombo,
      rawScore: m.rawScore,
      rawBestCombo: m.rawCombo,
      scoreNotePatch: VERSION
    });

    state.lastSig = sig;
    state.appliedCount += 1;

    try {
      WIN.dispatchEvent(new CustomEvent('groups-cvr:v23b-summary-fit-cleaned', {
        detail: {
          version: VERSION,
          displayScore,
          rawScore: m.rawScore,
          displayCombo,
          rawCombo: m.rawCombo
        }
      }));
    } catch (e) {}
  }

  function installObserver() {
    if (state.observerInstalled) return;

    const summary = $('summary');
    if (!summary) return;

    state.observerInstalled = true;

    const mo = new MutationObserver(() => {
      setTimeout(apply, 30);
    });

    mo.observe(summary, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_SUMMARY_FIT_V23B = {
      version: VERSION,
      apply,
      getState: function () {
        return {
          version: VERSION,
          summaryActive: isSummaryActive(),
          metrics: getMetrics(),
          appliedCount: state.appliedCount
        };
      }
    };
  }

  function init() {
    injectStyle();
    expose();
    installObserver();

    setInterval(apply, 240);

    WIN.addEventListener('groups-cvr:v23-score-balanced', () => {
      setTimeout(apply, 40);
    });

    WIN.addEventListener('groups-cvr:v22-summary-metrics-cleaned', () => {
      setTimeout(apply, 60);
    });

    console.info('[Groups cVR v2.3b] summary top fit + score note clean installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
