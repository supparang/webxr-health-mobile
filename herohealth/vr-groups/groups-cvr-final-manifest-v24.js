// === /herohealth/vr-groups/groups-cvr-final-manifest-v24.js ===
// HeroHealth Groups cVR — v2.4 Final Production Lock
// Purpose:
// - Final manifest validation for Groups Solo cVR.
// - Ensures old v11/v17 shoot files are not present.
// - Provides production-ready status object.
// - Adds safe replay/zone fallbacks.
// - Hides QA overlays unless ?qa=1 or ?debug=1.
// PATCH v20260517-GROUPS-CVR-V24-FINAL-PRODUCTION-LOCK

(function () {
  'use strict';

  const VERSION = 'v2.4-cvr-final-production-lock-20260517';

  if (window.__HHA_GROUPS_CVR_FINAL_MANIFEST_V24__) return;
  window.__HHA_GROUPS_CVR_FINAL_MANIFEST_V24__ = true;

  const WIN = window;
  const DOC = document;

  const REQUIRED = [
    'groups-cvr-aim-assist-v12',
    'groups-cvr-comfort-v13',
    'groups-cvr-event-boss-v14',
    'groups-cvr-replay-metrics-v15',
    'groups-cvr-final-guard-v16',
    'groups-cvr-direct-shoot-v18',
    'groups-cvr-qa-balance-v19',
    'groups-cvr-game-feel-v20',
    'groups-cvr-decoy-guard-v19d',
    'groups-cvr-summary-lock-v21',
    'groups-cvr-summary-metrics-v22',
    'groups-cvr-score-balance-v23',
    'groups-cvr-summary-fit-v23b',
    'groups-cvr-final-manifest-v24'
  ];

  const BANNED = [
    'groups-cvr-shoot-fix-v11',
    'groups-cvr-shoot-halo-fix-v17'
  ];

  const state = {
    lastValidation: null,
    validationCount: 0,
    buttonPatchDone: false
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function qs(name, fallback) {
    try {
      return new URL(location.href).searchParams.get(name) || fallback || '';
    } catch (e) {
      return fallback || '';
    }
  }

  function qaEnabled() {
    return qs('qa', '') === '1' || qs('debug', '') === '1';
  }

  function isSummaryActive() {
    const summary = $('summary');
    return Boolean(summary && summary.classList.contains('active'));
  }

  function scriptSrcs() {
    return Array.from(DOC.scripts).map(s => s.getAttribute('src') || '').filter(Boolean);
  }

  function hasScript(key) {
    return scriptSrcs().some(src => src.includes(key));
  }

  function validate() {
    const loaded = scriptSrcs();

    const missing = REQUIRED.filter(key => !hasScript(key));
    const bannedLoaded = BANNED.filter(key => hasScript(key));

    const apis = {
      core: Boolean(WIN.HHA_GROUPS_CVR_V1),
      directShoot: Boolean(WIN.HHA_GROUPS_CVR_DIRECT_SHOOT_V18),
      qaBalance: Boolean(WIN.HHA_GROUPS_CVR_QA_BALANCE_V19),
      gameFeel: Boolean(WIN.HHA_GROUPS_CVR_GAME_FEEL_V20),
      decoyGuard: Boolean(WIN.HHA_GROUPS_CVR_DECOY_GUARD_V19D),
      summaryLock: Boolean(WIN.HHA_GROUPS_CVR_SUMMARY_LOCK_V21),
      summaryMetrics: Boolean(WIN.HHA_GROUPS_CVR_SUMMARY_METRICS_V22),
      scoreBalance: Boolean(WIN.HHA_GROUPS_CVR_SCORE_BALANCE_V23),
      summaryFit: Boolean(WIN.HHA_GROUPS_CVR_SUMMARY_FIT_V23B)
    };

    const ok = missing.length === 0 && bannedLoaded.length === 0 && apis.core && apis.directShoot;

    const result = {
      version: VERSION,
      ok,
      mode: 'groups-solo-cvr',
      timestamp: new Date().toISOString(),
      required: REQUIRED.slice(),
      missing,
      bannedLoaded,
      apis,
      loaded
    };

    state.lastValidation = result;
    state.validationCount += 1;

    try {
      localStorage.setItem('HHA_GROUPS_CVR_FINAL_MANIFEST', JSON.stringify(result));
    } catch (e) {}

    return result;
  }

  function injectStyle() {
    if ($('groups-cvr-v24-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v24-style';
    style.textContent = `
      .cvr-v24-status{
        position:fixed;
        left:8px;
        top:calc(8px + env(safe-area-inset-top,0px));
        z-index:2147483700;
        display:none;
        max-width:min(360px,calc(100vw - 16px));
        border-radius:16px;
        padding:8px 10px;
        background:rgba(36,78,104,.94);
        color:#fff;
        font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        white-space:pre-wrap;
        box-shadow:0 16px 48px rgba(35,81,107,.2);
        pointer-events:none;
      }

      body.cvr-v24-qa-on .cvr-v24-status{
        display:block;
      }

      body:not(.cvr-v24-qa-on) #cvrV19Qa,
      body:not(.cvr-v24-qa-on) #cvrV19dQa,
      body:not(.cvr-v24-qa-on) .cvr-v19-qa,
      body:not(.cvr-v24-qa-on) .cvr-v19d-qa{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.cvr-final-ready #summary .card::after{
        content:"";
        display:block;
        clear:both;
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureStatusUi() {
    if ($('cvrV24Status')) return;

    const el = DOC.createElement('div');
    el.id = 'cvrV24Status';
    el.className = 'cvr-v24-status';
    DOC.body.appendChild(el);
  }

  function nutritionZoneUrl() {
    const hub = qs('hub', '');

    if (hub && hub.includes('nutrition-zone.html')) return hub;

    const u = new URL('https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html');

    ['pid','name','diff','time','view','seed','studyId','conditionGroup'].forEach(k => {
      const v = qs(k, '');
      if (v) u.searchParams.set(k, v);
    });

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('from', 'groups-cvr-final');
    u.searchParams.set('hub', 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html');

    return u.toString();
  }

  function replayUrl() {
    const u = new URL(location.href);
    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.set('run', 'play');
    return u.toString();
  }

  function patchButtons() {
    if (state.buttonPatchDone) return;

    const replayBtn = $('replayBtn');
    const zoneBtn = $('zoneBtn');

    if (!replayBtn || !zoneBtn) return;

    state.buttonPatchDone = true;

    replayBtn.addEventListener('click', function () {
      setTimeout(() => {
        if (!isSummaryActive()) return;
        location.href = replayUrl();
      }, 180);
    });

    zoneBtn.addEventListener('click', function () {
      setTimeout(() => {
        if (!isSummaryActive()) return;
        location.href = nutritionZoneUrl();
      }, 180);
    });
  }

  function updateStatusUi() {
    DOC.body.classList.toggle('cvr-v24-qa-on', qaEnabled());

    if (!qaEnabled()) return;

    const el = $('cvrV24Status');
    if (!el) return;

    const r = state.lastValidation || validate();

    el.textContent = [
      `Groups cVR FINAL ${VERSION}`,
      `ok=${r.ok}`,
      `missing=${r.missing.length ? r.missing.join(', ') : '-'}`,
      `banned=${r.bannedLoaded.length ? r.bannedLoaded.join(', ') : '-'}`,
      `core=${r.apis.core}`,
      `direct=${r.apis.directShoot}`,
      `summary=${isSummaryActive()}`,
      `validated=${state.validationCount}`
    ].join('\n');
  }

  function enforceFinalClasses() {
    const r = state.lastValidation || validate();

    DOC.body.classList.toggle('cvr-final-ready', Boolean(r.ok));
    DOC.body.classList.toggle('cvr-final-warning', !r.ok);

    if (r.bannedLoaded.length) {
      console.warn('[Groups cVR Final] banned scripts found:', r.bannedLoaded);
    }

    if (r.missing.length) {
      console.warn('[Groups cVR Final] missing scripts:', r.missing);
    }
  }

  function storeProductionSummary() {
    if (!isSummaryActive()) return;

    try {
      const final = {
        ts: new Date().toISOString(),
        game: 'groups',
        mode: 'solo-cvr',
        status: 'production-ready',
        finalPatch: VERSION,
        manifest: state.lastValidation || validate()
      };

      localStorage.setItem('HHA_GROUPS_CVR_PRODUCTION_READY', JSON.stringify(final));

      WIN.dispatchEvent(new CustomEvent('groups-cvr:v24-production-ready', {
        detail: final
      }));
    } catch (e) {}
  }

  function loop() {
    validate();
    patchButtons();
    enforceFinalClasses();
    updateStatusUi();
    storeProductionSummary();
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_FINAL_MANIFEST_V24 = {
      version: VERSION,
      validate,
      nutritionZoneUrl,
      replayUrl,
      getState: function () {
        return {
          version: VERSION,
          lastValidation: state.lastValidation,
          validationCount: state.validationCount,
          qa: qaEnabled(),
          summaryActive: isSummaryActive()
        };
      }
    };
  }

  function init() {
    injectStyle();
    ensureStatusUi();
    expose();

    loop();
    setInterval(loop, 900);

    console.info('[Groups cVR v2.4] final production lock installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
