// === /herohealth/vr-goodjunk/goodjunk-solo-v848-final-freeze.js ===
// FINAL FREEZE PATCH v8.48
// Purpose:
// 1) Lock GoodJunk Solo Boss flow
// 2) Fix replay / return buttons
// 3) Harden cooldown return
// 4) Reduce stuck loading / blocking overlay
// 5) Normalize PC / Mobile / Cardboard-cVR target feeling
// 6) Do not modify core scoring logic

(function () {
  'use strict';

  const PATCH_NAME = 'GOODJUNK_SOLO_V848_FINAL_FREEZE';
  const VERSION = '20260603-v848-final';

  const qs = new URLSearchParams(location.search);

  const state = {
    installed: false,
    summarySeen: false,
    cooldownRequested: false,
    lastPatchToast: 0
  };

  function log() {
    try {
      console.log.apply(console, ['[' + PATCH_NAME + ']'].concat([].slice.call(arguments)));
    } catch (_) {}
  }

  function isGoodJunkPage() {
    const p = location.pathname.toLowerCase();
    return (
      p.includes('goodjunk') ||
      p.includes('good-junk') ||
      document.title.toLowerCase().includes('goodjunk') ||
      document.title.toLowerCase().includes('good junk')
    );
  }

  if (!isGoodJunkPage()) {
    return;
  }

  function getRepoBase() {
    const path = location.pathname;
    const marker = '/herohealth/';
    const idx = path.indexOf(marker);

    if (idx >= 0) {
      return location.origin + path.slice(0, idx + marker.length);
    }

    return location.origin + '/herohealth/';
  }

  const HERO_BASE = getRepoBase();

  function cleanUrl(u) {
    try {
      return new URL(u, location.href).toString();
    } catch (_) {
      return String(u || '');
    }
  }

  function getHubUrl() {
    const hub = qs.get('hub');
    if (hub) return cleanUrl(hub);

    const zone = qs.get('zone') || 'nutrition';
    if (zone === 'nutrition') return HERO_BASE + 'nutrition-zone.html';

    return HERO_BASE + 'hub.html';
  }

  function getLauncherUrl() {
    const keep = new URLSearchParams();

    [
      'pid',
      'name',
      'studyId',
      'diff',
      'time',
      'view',
      'zone',
      'classId',
      'room',
      'seed'
    ].forEach(function (k) {
      const v = qs.get(k);
      if (v !== null && v !== '') keep.set(k, v);
    });

    keep.set('mode', 'solo');
    keep.set('from', 'goodjunk-summary');
    keep.set('hub', getHubUrl());

    return HERO_BASE + 'vr-goodjunk/goodjunk-launcher.html?' + keep.toString();
  }

  function getReplayUrl() {
    const keep = new URLSearchParams(qs.toString());

    keep.set('run', 'play');
    keep.set('mode', 'solo');
    keep.set('restart', String(Date.now()));
    keep.set('from', 'summary-replay');

    if (!keep.get('hub')) keep.set('hub', getHubUrl());

    return location.pathname + '?' + keep.toString();
  }

  function getNutritionZoneUrl() {
    const keep = new URLSearchParams();

    [
      'pid',
      'name',
      'studyId',
      'diff',
      'time',
      'view',
      'classId'
    ].forEach(function (k) {
      const v = qs.get(k);
      if (v !== null && v !== '') keep.set(k, v);
    });

    keep.set('from', 'goodjunk');
    keep.set('hub', HERO_BASE + 'hub.html');

    return HERO_BASE + 'nutrition-zone.html?' + keep.toString();
  }

  function getCooldownUrl() {
    const keep = new URLSearchParams();

    [
      'pid',
      'name',
      'studyId',
      'diff',
      'time',
      'view',
      'zone',
      'classId'
    ].forEach(function (k) {
      const v = qs.get(k);
      if (v !== null && v !== '') keep.set(k, v);
    });

    keep.set('game', 'goodjunk');
    keep.set('mode', 'solo');
    keep.set('from', 'goodjunk-summary');
    keep.set('return', getLauncherUrl());
    keep.set('hub', getHubUrl());

    return HERO_BASE + 'cooldown-gate.html?' + keep.toString();
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function makeToast(msg) {
    const now = Date.now();
    if (now - state.lastPatchToast < 900) return;
    state.lastPatchToast = now;

    let box = document.getElementById('gjFinalToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'gjFinalToast';
      box.setAttribute('aria-live', 'polite');
      box.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:calc(18px + env(safe-area-inset-bottom,0px))',
        'transform:translateX(-50%)',
        'z-index:2147483647',
        'background:rgba(15,23,42,.92)',
        'color:#fff',
        'border:1px solid rgba(255,255,255,.25)',
        'border-radius:999px',
        'padding:10px 15px',
        'font:800 13px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'box-shadow:0 12px 36px rgba(0,0,0,.28)',
        'max-width:min(92vw,520px)',
        'text-align:center',
        'pointer-events:none',
        'opacity:0',
        'transition:opacity .18s ease, transform .18s ease'
      ].join(';');
      document.body.appendChild(box);
    }

    box.textContent = msg;
    box.style.opacity = '1';
    box.style.transform = 'translateX(-50%) translateY(-4px)';

    setTimeout(function () {
      box.style.opacity = '0';
      box.style.transform = 'translateX(-50%) translateY(0)';
    }, 1700);
  }

  function injectStyle() {
    if (document.getElementById('gjV848FinalStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjV848FinalStyle';
    style.textContent = `
      html.gj-final-freeze,
      html.gj-final-freeze body{
        overscroll-behavior:none;
      }

      .gj-final-safe-action-row{
        position:fixed;
        left:50%;
        bottom:calc(16px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:2147483200;
        width:min(94vw,760px);
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        justify-content:center;
        gap:10px;
        pointer-events:auto;
      }

      .gj-final-safe-btn{
        appearance:none;
        border:0;
        border-radius:999px;
        padding:12px 16px;
        min-height:44px;
        font:900 14px/1.15 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        cursor:pointer;
        background:linear-gradient(135deg,#22c55e,#16a34a);
        color:white;
        box-shadow:0 10px 26px rgba(22,163,74,.28);
      }

      .gj-final-safe-btn.secondary{
        background:linear-gradient(135deg,#38bdf8,#2563eb);
        box-shadow:0 10px 26px rgba(37,99,235,.26);
      }

      .gj-final-safe-btn.ghost{
        background:rgba(15,23,42,.88);
        color:#fff;
        border:1px solid rgba(255,255,255,.22);
        box-shadow:0 10px 26px rgba(15,23,42,.22);
      }

      .gj-final-safe-btn:active{
        transform:translateY(1px) scale(.99);
      }

      .gj-force-hide-loading{
        opacity:0 !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      .gj-summary-final-mode .gj-final-safe-action-row{
        display:flex !important;
      }

      @media (max-width:640px){
        .gj-final-safe-action-row{
          bottom:calc(10px + env(safe-area-inset-bottom,0px));
          gap:8px;
        }

        .gj-final-safe-btn{
          min-height:40px;
          padding:10px 12px;
          font-size:12px;
        }
      }

      html[data-gj-view="mobile"] .target,
      html[data-gj-view="mobile"] .food,
      html[data-gj-view="mobile"] .junk,
      html[data-gj-view="mobile"] [data-target],
      html[data-gj-view="mobile"] [data-food],
      html[data-gj-view="mobile"] [data-junk]{
        max-width:min(22vw,96px);
        max-height:min(22vw,96px);
      }

      html[data-gj-view="cvr"] .target,
      html[data-gj-view="cvr"] .food,
      html[data-gj-view="cvr"] .junk,
      html[data-gj-view="cardboard"] .target,
      html[data-gj-view="cardboard"] .food,
      html[data-gj-view="cardboard"] .junk{
        max-width:72px;
        max-height:72px;
      }
    `;
    document.head.appendChild(style);
  }

  function detectView() {
    const v = (qs.get('view') || '').toLowerCase();

    if (v.includes('cvr')) return 'cvr';
    if (v.includes('cardboard')) return 'cardboard';
    if (v.includes('mobile')) return 'mobile';
    if (v.includes('pc')) return 'pc';

    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';

    return 'pc';
  }

  function normalizeViewClass() {
    const view = detectView();
    document.documentElement.classList.add('gj-final-freeze');
    document.documentElement.setAttribute('data-gj-view', view);

    if (view === 'cvr' || view === 'cardboard') {
      document.documentElement.classList.add('gj-cvr-final');
    }

    if (view === 'mobile') {
      document.documentElement.classList.add('gj-mobile-final');
    }
  }

  function hideBadBlockingOverlays() {
    const selectors = [
      '#loading',
      '#loader',
      '.loading',
      '.loader',
      '.loading-screen',
      '.splash',
      '.boot',
      '.boot-screen',
      '[data-loading]',
      '[aria-label="loading"]'
    ];

    selectors.forEach(function (sel) {
      $all(sel).forEach(function (el) {
        const txt = (el.textContent || '').trim().toLowerCase();
        const idc = ((el.id || '') + ' ' + (el.className || '')).toLowerCase();

        if (
          idc.includes('loading') ||
          idc.includes('loader') ||
          idc.includes('splash') ||
          idc.includes('boot') ||
          txt === 'loading' ||
          txt.includes('กำลังโหลด')
        ) {
          el.classList.add('gj-force-hide-loading');
        }
      });
    });
  }

  function isSummaryVisible() {
    const candidates = [
      '#summary',
      '#summaryScreen',
      '#result',
      '#resultScreen',
      '.summary',
      '.summary-screen',
      '.result',
      '.result-screen',
      '[data-summary]',
      '[data-screen="summary"]'
    ];

    return candidates.some(function (sel) {
      return $all(sel).some(function (el) {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        return (
          cs.display !== 'none' &&
          cs.visibility !== 'hidden' &&
          Number(cs.opacity || 1) > 0.05 &&
          rect.width > 80 &&
          rect.height > 60
        );
      });
    });
  }

  function hasEndText() {
    const text = (document.body.innerText || '').slice(-6000);
    return (
      /สรุปผล|ผลการเล่น|คะแนนรวม|accuracy|score|เล่นอีกครั้ง|กลับหน้า|จบเกม|summary|result/i.test(text)
    );
  }

  function ensureSummaryActions() {
    if (!isSummaryVisible() && !hasEndText()) return;

    state.summarySeen = true;
    document.documentElement.classList.add('gj-summary-final-mode');

    let row = document.getElementById('gjFinalActionRow');
    if (row) return;

    row = document.createElement('div');
    row.id = 'gjFinalActionRow';
    row.className = 'gj-final-safe-action-row';

    const replay = document.createElement('button');
    replay.type = 'button';
    replay.className = 'gj-final-safe-btn';
    replay.textContent = 'เล่นอีกครั้ง';
    replay.addEventListener('click', function () {
      makeToast('เริ่ม GoodJunk Solo ใหม่');
      location.href = getReplayUrl();
    });

    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'gj-final-safe-btn secondary';
    launcher.textContent = 'กลับหน้า GoodJunk';
    launcher.addEventListener('click', function () {
      makeToast('กลับหน้า GoodJunk');
      location.href = getLauncherUrl();
    });

    const zone = document.createElement('button');
    zone.type = 'button';
    zone.className = 'gj-final-safe-btn ghost';
    zone.textContent = 'Nutrition Zone';
    zone.addEventListener('click', function () {
      makeToast('กลับ Nutrition Zone');
      location.href = getNutritionZoneUrl();
    });

    row.appendChild(replay);
    row.appendChild(launcher);
    row.appendChild(zone);

    document.body.appendChild(row);

    makeToast('GoodJunk Solo จบเกมแล้ว');
  }

  function patchExistingButtons() {
    const textButtons = $all('button,a,[role="button"],.btn');

    textButtons.forEach(function (btn) {
      const txt = (btn.textContent || '').trim().toLowerCase();

      if (!txt) return;

      const isReplay =
        txt.includes('เล่นอีก') ||
        txt.includes('replay') ||
        txt.includes('restart') ||
        txt.includes('again');

      const isLauncher =
        txt.includes('goodjunk') ||
        txt.includes('good junk') ||
        txt.includes('กลับโหมด') ||
        txt.includes('เลือกโหมด');

      const isZone =
        txt.includes('nutrition') ||
        txt.includes('zone') ||
        txt.includes('โซน');

      const isHub =
        txt === 'hub' ||
        txt.includes('หน้าหลัก');

      if (isReplay && !btn.dataset.gjFinalReplay) {
        btn.dataset.gjFinalReplay = '1';
        btn.addEventListener(
          'click',
          function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            location.href = getReplayUrl();
          },
          true
        );
      }

      if (isLauncher && !btn.dataset.gjFinalLauncher) {
        btn.dataset.gjFinalLauncher = '1';
        btn.addEventListener(
          'click',
          function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            location.href = getLauncherUrl();
          },
          true
        );
      }

      if ((isZone || isHub) && !btn.dataset.gjFinalZone) {
        btn.dataset.gjFinalZone = '1';
        btn.addEventListener(
          'click',
          function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            location.href = isHub ? getHubUrl() : getNutritionZoneUrl();
          },
          true
        );
      }
    });
  }

  function patchCooldownCalls() {
    if (window.__gjV848CooldownPatched) return;
    window.__gjV848CooldownPatched = true;

    window.GJ_FINAL_COOLDOWN_URL = getCooldownUrl;
    window.GJ_FINAL_LAUNCHER_URL = getLauncherUrl;
    window.GJ_FINAL_ZONE_URL = getNutritionZoneUrl;

    window.addEventListener('goodjunk:cooldown', function () {
      if (state.cooldownRequested) return;
      state.cooldownRequested = true;
      location.href = getCooldownUrl();
    });

    window.addEventListener('hha:cooldown', function (ev) {
      const detail = ev && ev.detail ? ev.detail : {};
      const game = String(detail.game || detail.key || '').toLowerCase();

      if (game && !game.includes('goodjunk')) return;

      if (state.cooldownRequested) return;
      state.cooldownRequested = true;
      location.href = getCooldownUrl();
    });
  }

  function createSafetyMenu() {
    if (document.getElementById('gjFinalSafetyMini')) return;

    const mini = document.createElement('button');
    mini.id = 'gjFinalSafetyMini';
    mini.type = 'button';
    mini.textContent = 'GoodJunk';
    mini.setAttribute('aria-label', 'GoodJunk safety menu');
    mini.style.cssText = [
      'position:fixed',
      'right:calc(10px + env(safe-area-inset-right,0px))',
      'top:calc(10px + env(safe-area-inset-top,0px))',
      'z-index:2147482500',
      'border:1px solid rgba(255,255,255,.22)',
      'border-radius:999px',
      'padding:8px 11px',
      'font:900 11px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'background:rgba(15,23,42,.74)',
      'color:#fff',
      'box-shadow:0 8px 20px rgba(0,0,0,.24)',
      'backdrop-filter:blur(8px)',
      'cursor:pointer'
    ].join(';');

    mini.addEventListener('click', function () {
      makeToast('GoodJunk Solo v8.48 FINAL');
    });

    document.body.appendChild(mini);
  }

  function hardenTouchAndClick() {
    document.addEventListener(
      'touchstart',
      function () {},
      { passive: true }
    );

    document.addEventListener(
      'click',
      function (ev) {
        const t = ev.target;
        if (!t) return;

        const text = (t.textContent || '').trim();

        if (/กลับหน้า\s*HUB|HUB/i.test(text) && state.summarySeen) {
          ev.preventDefault();
          ev.stopPropagation();
          location.href = getLauncherUrl();
        }
      },
      true
    );
  }

  function observeSummary() {
    const mo = new MutationObserver(function () {
      hideBadBlockingOverlays();
      ensureSummaryActions();
      patchExistingButtons();
    });

    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'aria-hidden']
    });

    setInterval(function () {
      hideBadBlockingOverlays();
      ensureSummaryActions();
      patchExistingButtons();
    }, 1200);
  }

  function dispatchReadySignal() {
    try {
      window.dispatchEvent(
        new CustomEvent('goodjunk:v848-final-ready', {
          detail: {
            patch: PATCH_NAME,
            version: VERSION,
            view: detectView(),
            launcher: getLauncherUrl(),
            nutritionZone: getNutritionZoneUrl(),
            cooldown: getCooldownUrl()
          }
        })
      );
    } catch (_) {}
  }

  function install() {
    if (state.installed) return;
    state.installed = true;

    injectStyle();
    normalizeViewClass();
    hideBadBlockingOverlays();
    patchCooldownCalls();
    patchExistingButtons();
    createSafetyMenu();
    hardenTouchAndClick();
    observeSummary();
    dispatchReadySignal();

    log('installed', {
      version: VERSION,
      view: detectView(),
      launcher: getLauncherUrl(),
      zone: getNutritionZoneUrl(),
      cooldown: getCooldownUrl()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();