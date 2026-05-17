// === /herohealth/vr-groups/groups-cvr-summary-metrics-v22.js ===
// HeroHealth Groups cVR — v2.2 Summary Metrics Clean + Badge Rank Filter
// Fixes:
// - Too many badges in summary/research metrics.
// - Lower rank badges shown even when player already got VR Food Hero.
// - "Hit Rate" looks confusing beside 100% accuracy.
// - Makes final summary cleaner for production.
// PATCH v20260517-GROUPS-CVR-V22-SUMMARY-METRICS-CLEAN

(function () {
  'use strict';

  const VERSION = 'v2.2-cvr-summary-metrics-clean-20260517';

  if (window.__HHA_GROUPS_CVR_SUMMARY_METRICS_V22__) return;
  window.__HHA_GROUPS_CVR_SUMMARY_METRICS_V22__ = true;

  const DOC = document;
  const WIN = window;

  function $(id) {
    return DOC.getElementById(id);
  }

  function isSummaryActive() {
    const summary = $('summary');
    return Boolean(summary && summary.classList.contains('active'));
  }

  function injectStyle() {
    if ($('groups-cvr-v22-summary-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v22-summary-style';
    style.textContent = `
      body.cvr-summary-active #summary .summary-badges{
        max-width:920px !important;
        margin-left:auto !important;
        margin-right:auto !important;
      }

      body.cvr-summary-active #summary .summary-badge{
        font-size:clamp(12px,2.4vw,16px) !important;
        padding:7px 11px !important;
        border-radius:999px !important;
      }

      body.cvr-summary-active .cvr-v22-hide{
        display:none !important;
      }

      body.cvr-summary-active .cvr-v22-metric-note{
        display:block;
        margin-top:4px;
        color:#7193a8;
        font-size:12px;
        font-weight:850;
      }

      body.cvr-summary-active #summary .card{
        padding-bottom:calc(28px + env(safe-area-inset-bottom,0px)) !important;
      }

      body.cvr-summary-active #summary .actions{
        margin-top:28px !important;
      }

      @media (max-width:640px){
        body.cvr-summary-active #summary .summary-badge{
          font-size:11px !important;
          padding:6px 8px !important;
        }
      }
    `;
    DOC.head.appendChild(style);
  }

  function textOf(el) {
    return (el && el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function dedupeBadges(scope) {
    const badges = Array.from(scope.querySelectorAll('.summary-badge, .badge, [class*="badge"]'));
    const seen = new Set();

    badges.forEach(badge => {
      const txt = textOf(badge);
      if (!txt) return;

      if (seen.has(txt)) {
        badge.classList.add('cvr-v22-hide');
        return;
      }

      seen.add(txt);
    });
  }

  function filterRankBadges(scope) {
    const all = Array.from(scope.querySelectorAll('.summary-badge, .badge, [class*="badge"]'));

    const hasHero = all.some(el => /VR Food Hero/i.test(textOf(el)));
    const hasSmart = all.some(el => /Smart VR Eater/i.test(textOf(el)));
    const hasExplorer = all.some(el => /VR Food Explorer/i.test(textOf(el)));

    all.forEach(el => {
      const txt = textOf(el);

      if (hasHero && /VR Food Rookie|VR Food Explorer|Smart VR Eater/i.test(txt)) {
        el.classList.add('cvr-v22-hide');
        return;
      }

      if (!hasHero && hasSmart && /VR Food Rookie|VR Food Explorer/i.test(txt)) {
        el.classList.add('cvr-v22-hide');
        return;
      }

      if (!hasHero && !hasSmart && hasExplorer && /VR Food Rookie/i.test(txt)) {
        el.classList.add('cvr-v22-hide');
      }
    });
  }

  function capBadgeRows(scope) {
    const badges = Array.from(scope.querySelectorAll('.summary-badge, .badge, [class*="badge"]'))
      .filter(el => !el.classList.contains('cvr-v22-hide'));

    /*
      Keep summary impressive but not cluttered.
      Main achievement badges should stay visible.
    */
    const priority = [
      /VR Food Hero/i,
      /Boss Breaker/i,
      /Golden Shooter/i,
      /Fever Finisher/i,
      /Shield Collector/i,
      /Mission Clear/i,
      /Aim Lock/i,
      /Recenter Ready/i,
      /VR Shooter/i,
      /Keep Growing/i
    ];

    badges.sort((a, b) => {
      const ta = textOf(a);
      const tb = textOf(b);

      const ia = priority.findIndex(rx => rx.test(ta));
      const ib = priority.findIndex(rx => rx.test(tb));

      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    badges.forEach((badge, index) => {
      if (index >= 8) badge.classList.add('cvr-v22-hide');
    });
  }

  function renameHitRate() {
    const summary = $('summary');
    if (!summary) return;

    const nodes = Array.from(summary.querySelectorAll('*'));
    const hitRateLabel = nodes.find(el => textOf(el) === 'Hit Rate');

    if (hitRateLabel) {
      hitRateLabel.textContent = 'Aim Hit Rate';

      if (!hitRateLabel.parentElement.querySelector('.cvr-v22-metric-note')) {
        const note = DOC.createElement('span');
        note.className = 'cvr-v22-metric-note';
        note.textContent = 'อัตราเล็งโดนเป้า ไม่ใช่คะแนนความถูกต้อง';
        hitRateLabel.parentElement.appendChild(note);
      }
    }
  }

  function cleanMetricsPanel() {
    const summary = $('summary');
    if (!summary) return;

    dedupeBadges(summary);
    filterRankBadges(summary);
    capBadgeRows(summary);
    renameHitRate();
  }

  function enforce() {
    if (!isSummaryActive()) return;

    DOC.body.classList.add('cvr-summary-active');
    cleanMetricsPanel();

    try {
      WIN.dispatchEvent(new CustomEvent('groups-cvr:v22-summary-metrics-cleaned', {
        detail: { version: VERSION }
      }));
    } catch (e) {}
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_SUMMARY_METRICS_V22 = {
      version: VERSION,
      clean: enforce,
      getState: function () {
        return {
          version: VERSION,
          summaryActive: isSummaryActive()
        };
      }
    };
  }

  function init() {
    injectStyle();
    expose();

    setInterval(enforce, 450);

    console.info('[Groups cVR v2.2] summary metrics clean installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
