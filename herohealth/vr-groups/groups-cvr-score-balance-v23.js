// === /herohealth/vr-groups/groups-cvr-score-balance-v23.js ===
// HeroHealth Groups cVR — v2.3 Score Balance + Difficulty Fairness
// Purpose:
// - Prevent cVR summary from looking over-scored.
// - Keep real gameplay score untouched during play.
// - Clean display score/combo/rank only on Summary.
// - Adds a fair “Balanced Score” view for production/research presentation.
// - Does not change core gameplay logic.
// PATCH v20260517-GROUPS-CVR-V23-SCORE-BALANCE-FAIRNESS

(function () {
  'use strict';

  const VERSION = 'v2.3-cvr-score-balance-fairness-20260517';

  if (window.__HHA_GROUPS_CVR_SCORE_BALANCE_V23__) return;
  window.__HHA_GROUPS_CVR_SCORE_BALANCE_V23__ = true;

  const DOC = document;
  const WIN = window;

  const state = {
    lastAppliedSig: '',
    appliedCount: 0
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function coreApi() {
    return WIN.HHA_GROUPS_CVR_V1 || null;
  }

  function gs() {
    try {
      const core = coreApi();
      if (core && typeof core.getState === 'function') return core.getState() || {};
    } catch (e) {}
    return {};
  }

  function isSummaryActive() {
    const summary = $('summary');
    return Boolean(summary && summary.classList.contains('active'));
  }

  function n(v, fallback) {
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getSummaryNumbers() {
    const s = gs();

    const rawScore = n(s.score, n(($('scoreText') || {}).textContent, 0));
    const correct = n(s.correct, n(($('correctText') || {}).textContent, 0));
    const miss = n(s.miss, 0);
    const bestCombo = n(s.bestCombo, n(($('comboText') || {}).textContent, 0));
    const duration = n(s.duration, 90);
    const feverCount = n(s.feverCount, 0);
    const missionClear = n(s.missionClear, 0);
    const bossCorrect = n(s.bossCorrect, 0);
    const goldenHit = n(s.goldenHit, 0);

    const total = Math.max(1, correct + miss);
    const accuracy = Math.round((correct / total) * 100);

    return {
      rawScore,
      correct,
      miss,
      total,
      accuracy,
      bestCombo,
      duration,
      feverCount,
      missionClear,
      bossCorrect,
      goldenHit
    };
  }

  function balancedScore(m) {
    /*
      Display-only score:
      - keeps high performance impressive
      - prevents 3000+ looking unrealistic for a short cVR round
      - rewards correct, combo, boss, golden, mission
    */

    const baseCorrect = m.correct * 22;
    const comboBonus = Math.min(m.bestCombo, 30) * 8;
    const accuracyBonus = m.accuracy >= 95 ? 180 : m.accuracy >= 85 ? 110 : m.accuracy >= 70 ? 60 : 0;
    const missionBonus = Math.min(m.missionClear, 5) * 45;
    const bossBonus = Math.min(m.bossCorrect, 8) * 22;
    const goldenBonus = Math.min(m.goldenHit, 4) * 35;
    const feverBonus = Math.min(m.feverCount, 3) * 55;

    let score = baseCorrect + comboBonus + accuracyBonus + missionBonus + bossBonus + goldenBonus + feverBonus;

    /*
      Duration normalization:
      A 150s run can score more, but not explode.
    */
    const durationFactor =
      m.duration <= 90 ? 1 :
      m.duration <= 120 ? 0.92 :
      0.84;

    score = Math.round(score * durationFactor);

    /*
      Soft cap by performance level, not a hard unfair cap.
    */
    const heroCap =
      m.duration <= 90 ? 980 :
      m.duration <= 120 ? 1250 :
      1550;

    if (score > heroCap) {
      score = Math.round(heroCap + Math.sqrt(score - heroCap) * 8);
    }

    return Math.max(0, score);
  }

  function balancedCombo(m) {
    /*
      Combo 77 looks too high in Summary for children/teacher view.
      Keep it impressive but readable.
    */
    if (m.bestCombo <= 30) return m.bestCombo;

    return Math.round(30 + Math.sqrt(m.bestCombo - 30) * 2.2);
  }

  function balancedRank(m, displayScore, displayCombo) {
    if (m.accuracy >= 95 && m.correct >= 20 && displayCombo >= 18) {
      return {
        icon: '🏆',
        title: 'VR Food Hero'
      };
    }

    if (m.accuracy >= 85 && m.correct >= 14) {
      return {
        icon: '⭐',
        title: 'Smart VR Eater'
      };
    }

    if (m.accuracy >= 70 && m.correct >= 8) {
      return {
        icon: '🌱',
        title: 'VR Food Explorer'
      };
    }

    return {
      icon: '💪',
      title: 'VR Food Rookie'
    };
  }

  function injectStyle() {
    if ($('groups-cvr-v23-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v23-style';
    style.textContent = `
      body.cvr-summary-active #summary .cvr-v23-note{
        display:block;
        width:min(760px,100%);
        margin:12px auto 0;
        padding:10px 14px;
        border-radius:22px;
        background:linear-gradient(135deg,#f5fff1,#ffffff);
        border:2px solid #d9f3cf;
        color:#4f7c5a;
        font-size:clamp(12px,2.8vw,15px);
        line-height:1.35;
        font-weight:900;
        text-align:center;
      }

      body.cvr-summary-active #summary .cvr-v23-raw{
        display:block;
        margin-top:4px;
        color:#7193a8;
        font-size:11px;
        font-weight:800;
      }

      body.cvr-summary-active #summary .stat.v23-balanced{
        background:linear-gradient(180deg,#ffffff,#f7fdff) !important;
      }

      body.cvr-summary-active #summary .stat.v23-balanced b{
        letter-spacing:-.03em;
      }

      @media (max-width:640px){
        body.cvr-summary-active #summary .cvr-v23-note{
          font-size:11px;
          padding:8px 10px;
          margin-top:10px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function text(el, value) {
    if (el) el.textContent = String(value);
  }

  function ensureNote(m, displayScore, displayCombo) {
    const card = DOC.querySelector('#summary .card');
    if (!card) return;

    let note = $('cvrV23Note');

    if (!note) {
      note = DOC.createElement('div');
      note.id = 'cvrV23Note';
      note.className = 'cvr-v23-note';

      const stats = DOC.querySelector('#summary .summary-stats');
      if (stats && stats.parentNode) {
        stats.parentNode.insertBefore(note, stats.nextSibling);
      } else {
        card.appendChild(note);
      }
    }

    const rawDifferent = displayScore !== m.rawScore || displayCombo !== m.bestCombo;

    note.innerHTML = rawDifferent
      ? `คะแนนสรุปปรับสมดุลสำหรับ cVR เพื่อให้อ่านง่ายและเปรียบเทียบได้ยุติธรรม
         <span class="cvr-v23-raw">Raw: ${m.rawScore} คะแนน • Combo raw: ${m.bestCombo}</span>`
      : `คะแนนสรุปตรงกับผลการเล่นจริง`;
  }

  function markStats() {
    ['scoreText', 'accuracyText', 'comboText', 'correctText'].forEach(id => {
      const el = $(id);
      if (!el) return;

      const box = el.closest('.stat');
      if (box) box.classList.add('v23-balanced');
    });
  }

  function updateLocalSummary(m, displayScore, displayCombo, rank) {
    try {
      const raw = localStorage.getItem('HHA_GROUPS_CVR_SUMMARY');
      if (!raw) return;

      const data = JSON.parse(raw);
      data.displayScore = displayScore;
      data.displayCombo = displayCombo;
      data.displayRank = rank.title;
      data.displayRankIcon = rank.icon;
      data.rawScore = m.rawScore;
      data.rawBestCombo = m.bestCombo;
      data.scoreBalancePatch = VERSION;

      localStorage.setItem('HHA_GROUPS_CVR_SUMMARY', JSON.stringify(data));

      const last = localStorage.getItem('HHA_LAST_SUMMARY');
      if (last) {
        const lastObj = JSON.parse(last);
        if (lastObj && lastObj.summary && lastObj.summary.game === 'groups') {
          lastObj.summary.displayScore = displayScore;
          lastObj.summary.displayCombo = displayCombo;
          lastObj.summary.displayRank = rank.title;
          lastObj.summary.rawScore = m.rawScore;
          lastObj.summary.rawBestCombo = m.bestCombo;
          lastObj.summary.scoreBalancePatch = VERSION;
          localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(lastObj));
        }
      }
    } catch (e) {}
  }

  function signature(m) {
    return [
      m.rawScore,
      m.correct,
      m.miss,
      m.bestCombo,
      m.accuracy,
      m.duration,
      isSummaryActive() ? 'summary' : 'play'
    ].join('|');
  }

  function applyBalance() {
    if (!isSummaryActive()) return;

    DOC.body.classList.add('cvr-summary-active');

    const m = getSummaryNumbers();
    const sig = signature(m);

    /*
      Reapply when numbers change, but safe to run repeatedly.
    */
    const score = balancedScore(m);
    const combo = balancedCombo(m);
    const rank = balancedRank(m, score, combo);

    text($('scoreText'), score);
    text($('comboText'), combo);
    text($('correctText'), m.correct);
    text($('accuracyText'), m.accuracy + '%');

    const rankText = $('rankText');
    const summaryIcon = $('summaryIcon');

    if (rankText) rankText.textContent = rank.title;
    if (summaryIcon) summaryIcon.textContent = rank.icon;

    ensureNote(m, score, combo);
    markStats();
    updateLocalSummary(m, score, combo, rank);

    state.lastAppliedSig = sig;
    state.appliedCount += 1;

    try {
      WIN.dispatchEvent(new CustomEvent('groups-cvr:v23-score-balanced', {
        detail: {
          version: VERSION,
          rawScore: m.rawScore,
          displayScore: score,
          rawCombo: m.bestCombo,
          displayCombo: combo,
          accuracy: m.accuracy,
          rank: rank.title
        }
      }));
    } catch (e) {}
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_SCORE_BALANCE_V23 = {
      version: VERSION,
      apply: applyBalance,
      balancedScore,
      balancedCombo,
      getState: function () {
        const m = getSummaryNumbers();
        return {
          version: VERSION,
          summaryActive: isSummaryActive(),
          metrics: m,
          displayScore: balancedScore(m),
          displayCombo: balancedCombo(m),
          appliedCount: state.appliedCount
        };
      }
    };
  }

  function init() {
    injectStyle();
    expose();

    setInterval(applyBalance, 500);

    WIN.addEventListener('groups-cvr:v21-summary-cleaned', () => {
      setTimeout(applyBalance, 80);
    });

    WIN.addEventListener('groups-cvr:v22-summary-metrics-cleaned', () => {
      setTimeout(applyBalance, 80);
    });

    console.info('[Groups cVR v2.3] score balance + fairness installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
