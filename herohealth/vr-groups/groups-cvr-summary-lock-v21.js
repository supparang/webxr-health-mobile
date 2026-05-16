// === /herohealth/vr-groups/groups-cvr-summary-lock-v21.js ===
// HeroHealth Groups cVR — v2.1 Summary Clean + Production Lock
// Fixes:
// - Gameplay coach/toast/hint remains visible on summary.
// - Crosshair/VR overlay appears on summary.
// - Bottom hint overlaps summary badges.
// - Locks summary screen to clean card-only presentation.
// PATCH v20260516-GROUPS-CVR-V21-SUMMARY-PRODUCTION-LOCK

(function () {
  'use strict';

  const VERSION = 'v2.1-cvr-summary-production-lock-20260516';

  if (window.__HHA_GROUPS_CVR_SUMMARY_LOCK_V21__) return;
  window.__HHA_GROUPS_CVR_SUMMARY_LOCK_V21__ = true;

  const WIN = window;
  const DOC = document;

  function $(id) {
    return DOC.getElementById(id);
  }

  function injectStyle() {
    if ($('groups-cvr-v21-summary-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v21-summary-style';
    style.textContent = `
      body.cvr-summary-active #scene,
      body.cvr-summary-active a-scene{
        opacity:0 !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      body.cvr-summary-active #bottomHint,
      body.cvr-summary-active #toast,
      body.cvr-summary-active #crosshair,
      body.cvr-summary-active .hud,
      body.cvr-summary-active .bottom-hint,
      body.cvr-summary-active .center-toast,
      body.cvr-summary-active .cvr-v18-fire,
      body.cvr-summary-active .cvr-v18b-fire,
      body.cvr-summary-active .cvr-v18c-fire,
      body.cvr-summary-active .cvr-v18d-fire,
      body.cvr-summary-active .cvr-v19-tip,
      body.cvr-summary-active .cvr-v19d-toast,
      body.cvr-summary-active .cvr-v20-coach,
      body.cvr-summary-active .cvr-v20-mini,
      body.cvr-summary-active .cvr-v20-flash,
      body.cvr-summary-active #cvrV18FireBtn,
      body.cvr-summary-active #cvrV18bFireBtn,
      body.cvr-summary-active #cvrV18cFireBtn,
      body.cvr-summary-active #cvrV18dFireBtn,
      body.cvr-summary-active #cvrV19Tip,
      body.cvr-summary-active #cvrV19dToast,
      body.cvr-summary-active #cvrV20Coach,
      body.cvr-summary-active #cvrV20Mini,
      body.cvr-summary-active #cvrV20Flash,
      body.cvr-summary-active #cvrV13Controls,
      body.cvr-summary-active #cvrV13ComfortCard,
      body.cvr-summary-active #cvrV16Rescue{
        display:none !important;
        opacity:0 !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      body.cvr-summary-active #summary{
        z-index:2147483000 !important;
        background:
          radial-gradient(circle at 50% 0%,rgba(255,244,177,.55),rgba(255,244,177,0) 32%),
          linear-gradient(180deg,#eefbff,#c9f1ff) !important;
      }

      body.cvr-summary-active #summary .card{
        position:relative !important;
        z-index:2147483100 !important;
        background:rgba(255,255,255,.97) !important;
        box-shadow:0 28px 82px rgba(35,81,107,.18) !important;
      }

      body.cvr-summary-active #summary .summary-badges{
        margin-top:18px !important;
        margin-bottom:16px !important;
        gap:10px !important;
      }

      body.cvr-summary-active #summary .summary-badge{
        white-space:nowrap !important;
      }

      body.cvr-summary-active #summary .actions{
        margin-top:24px !important;
        padding-bottom:calc(18px + env(safe-area-inset-bottom,0px)) !important;
      }

      body.cvr-summary-active #summary .btn{
        min-width:220px !important;
      }

      @media (max-width:640px){
        body.cvr-summary-active #summary{
          padding-left:10px !important;
          padding-right:10px !important;
        }

        body.cvr-summary-active #summary .card{
          border-radius:28px !important;
          padding:18px 12px !important;
        }

        body.cvr-summary-active #summary .summary-stats{
          gap:8px !important;
        }

        body.cvr-summary-active #summary .stat{
          padding:12px 6px !important;
        }

        body.cvr-summary-active #summary .stat b{
          font-size:clamp(30px,10vw,48px) !important;
        }

        body.cvr-summary-active #summary .summary-badges{
          gap:7px !important;
        }

        body.cvr-summary-active #summary .summary-badge{
          font-size:12px !important;
          padding:7px 9px !important;
        }

        body.cvr-summary-active #summary .btn{
          width:min(100%,320px) !important;
          min-width:0 !important;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function isSummaryActive() {
    const summary = $('summary');
    return Boolean(summary && summary.classList.contains('active'));
  }

  function hideGameplayOverlays() {
    const selectors = [
      '#bottomHint',
      '#toast',
      '#cvrV18FireBtn',
      '#cvrV18bFireBtn',
      '#cvrV18cFireBtn',
      '#cvrV18dFireBtn',
      '#cvrV19Tip',
      '#cvrV19dToast',
      '#cvrV20Coach',
      '#cvrV20Mini',
      '#cvrV20Flash',
      '#cvrV13Controls',
      '#cvrV13ComfortCard',
      '#cvrV16Rescue',
      '.cvr-v18-fire',
      '.cvr-v18b-fire',
      '.cvr-v18c-fire',
      '.cvr-v18d-fire',
      '.cvr-v19-tip',
      '.cvr-v19d-toast',
      '.cvr-v20-coach',
      '.cvr-v20-mini',
      '.cvr-v20-flash'
    ];

    selectors.forEach(sel => {
      DOC.querySelectorAll(sel).forEach(el => {
        try {
          el.style.display = 'none';
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          el.style.pointerEvents = 'none';
        } catch (e) {}
      });
    });
  }

  function cleanSummaryBadges() {
    const badges = Array.from(DOC.querySelectorAll('#summary .summary-badge'));
    if (!badges.length) return;

    const seen = new Set();

    badges.forEach(badge => {
      const txt = (badge.textContent || '').trim();

      if (seen.has(txt)) {
        badge.remove();
        return;
      }

      seen.add(txt);
    });
  }

  function enforceSummaryMode() {
    const active = isSummaryActive();

    DOC.body.classList.toggle('cvr-summary-active', active);

    if (!active) return;

    DOC.body.classList.remove('playing');

    hideGameplayOverlays();
    cleanSummaryBadges();

    try {
      WIN.dispatchEvent(new CustomEvent('groups-cvr:v21-summary-cleaned', {
        detail: { version: VERSION }
      }));
    } catch (e) {}
  }

  function patchCoreEnd() {
    const core = WIN.HHA_GROUPS_CVR_V1;
    if (!core || core.__v21SummaryPatched || typeof core.end !== 'function') return;

    const oldEnd = core.end;

    core.__v21SummaryPatched = true;

    core.end = function () {
      const result = oldEnd.apply(core, arguments);

      setTimeout(enforceSummaryMode, 50);
      setTimeout(enforceSummaryMode, 250);
      setTimeout(enforceSummaryMode, 800);

      return result;
    };
  }

  function installObserver() {
    const summary = $('summary');
    if (!summary || summary.__v21Observed) return;

    summary.__v21Observed = true;

    const mo = new MutationObserver(() => {
      enforceSummaryMode();
    });

    mo.observe(summary, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_SUMMARY_LOCK_V21 = {
      version: VERSION,
      clean: enforceSummaryMode,
      hideGameplayOverlays,
      getState: function () {
        return {
          version: VERSION,
          summaryActive: isSummaryActive(),
          bodySummaryClass: DOC.body.classList.contains('cvr-summary-active')
        };
      }
    };
  }

  function init() {
    injectStyle();
    expose();
    installObserver();

    setInterval(() => {
      patchCoreEnd();
      enforceSummaryMode();
    }, 350);

    console.info('[Groups cVR v2.1] summary production lock installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
