// === /herohealth/vr-goodjunk/goodjunk-mobile-viewport-clamp-v848g.js ===
// PATCH v20260605-v848g
// Purpose:
// 1) When view=mobile runs inside desktop/emulator wide viewport,
//    clamp gameplay targets into a phone-sized center column.
// 2) Prevent targets from spreading across the whole desktop browser.
// 3) Keep actual phone behavior natural.
// 4) Do NOT change score / hit / boss logic.

(function () {
  'use strict';

  const PATCH = 'GJ_MOBILE_VIEWPORT_CLAMP_V848G';

  function isGoodJunk() {
    return /goodjunk|good-junk/i.test(location.pathname + ' ' + document.title);
  }

  if (!isGoodJunk()) return;

  const qs = new URLSearchParams(location.search || '');
  const view = String(qs.get('view') || '').toLowerCase();
  const device = String(qs.get('device') || '').toLowerCase();

  const forcedMobile =
    view === 'mobile' ||
    device === 'mobile';

  const realMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  if (!forcedMobile && !realMobile) return;

  const state = {
    installed: false,
    lastRun: 0
  };

  function injectStyle() {
    if (document.getElementById('gjMobileViewportClampV848gStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjMobileViewportClampV848gStyle';
    style.textContent = `
      html.gj-mobile-viewport-clamp-v848g .gj-mobile-clamped-target-v848g{
        transition:left .10s ease, top .10s ease !important;
      }

      /*
        On desktop browser running view=mobile, visually guide the playfield
        without adding a visible phone frame.
      */
      html.gj-mobile-viewport-clamp-v848g[data-gj-wide-mobile="1"] #gjSoloBossArea::before{
        content:"";
        position:absolute;
        left:50%;
        top:0;
        width:min(460px, 100vw);
        height:100%;
        transform:translateX(-50%);
        pointer-events:none;
        border-left:1px solid rgba(255,255,255,.08);
        border-right:1px solid rgba(255,255,255,.08);
        opacity:.18;
      }
    `;

    document.head.appendChild(style);
  }

  function selector() {
    return [
      '.gj-mini-target-v848e',
      '.gjpu-item',
      '.gj-target',
      '.target',
      '.food',
      '.junk',
      '[data-target]',
      '[data-food]',
      '[data-junk]',
      '[data-kind="good"]',
      '[data-kind="junk"]',
      '[data-kind="fake"]',
      '#gjSoloBossArea [class*="target"]',
      '#gjSoloBossArea [class*="food"]',
      '#gjSoloBossArea [class*="junk"]',
      '#gjSoloBossArea [class*="item"]'
    ].join(',');
  }

  function isGameplayTarget(el) {
    if (!el || !el.getBoundingClientRect) return false;

    if (
      el.closest('.gjpu-root') ||
      el.closest('.gjpu-card') ||
      el.closest('.gjm-hud') ||
      el.closest('.gjm-message') ||
      el.closest('.shell-back') ||
      el.closest('.gj-final-safe-action-row') ||
      el.closest('.gjm-start')
    ) {
      return false;
    }

    const area = document.getElementById('gjSoloBossArea');
    if (area && !el.closest('#gjSoloBossArea')) return false;

    const r = el.getBoundingClientRect();
    return r.width >= 18 && r.height >= 18;
  }

  function getTargets() {
    return Array.prototype.slice.call(document.querySelectorAll(selector()))
      .filter(isGameplayTarget);
  }

  function px(n) {
    return Math.round(n) + 'px';
  }

  function getMobileColumnBounds() {
    const vw = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 360);
    const vh = Math.max(520, window.innerHeight || document.documentElement.clientHeight || 640);

    const isWide = vw > 520 && forcedMobile;
    const columnW = isWide ? 430 : vw;

    const left = Math.round((vw - columnW) / 2);
    const right = left + columnW;

    document.documentElement.setAttribute('data-gj-wide-mobile', isWide ? '1' : '0');

    return {
      vw,
      vh,
      isWide,
      columnW,
      left: left + 16,
      right: right - 16,
      top: Math.min(Math.max(220, Math.round(vh * 0.30)), 305),
      bottom: vh - Math.min(Math.max(205, Math.round(vh * 0.27)), 265)
    };
  }

  function currentPosition(el, rect) {
    const left = parseFloat(el.style.left);
    const top = parseFloat(el.style.top);

    return {
      left: Number.isFinite(left) ? left : rect.left,
      top: Number.isFinite(top) ? top : rect.top
    };
  }

  function setPosition(el, left, top) {
    const cs = getComputedStyle(el);

    if (cs.position === 'static') {
      el.style.position = 'absolute';
    }

    el.style.left = px(left);
    el.style.top = px(top);
    el.classList.add('gj-mobile-clamped-target-v848g');
    el.dataset.gjViewportClamp = '1';
  }

  function clampIntoColumn() {
    const bounds = getMobileColumnBounds();
    const targets = getTargets();

    targets.forEach(function (el, index) {
      const r = el.getBoundingClientRect();
      const pos = currentPosition(el, r);

      const w = Math.max(36, r.width);
      const h = Math.max(42, r.height);

      const minLeft = bounds.left;
      const maxLeft = bounds.right - w;
      const minTop = bounds.top;
      const maxTop = bounds.bottom - h;

      let nextLeft = pos.left;
      let nextTop = pos.top;

      if (r.left < minLeft) nextLeft = minLeft + (index % 3) * 12;
      if (r.right > bounds.right) nextLeft = maxLeft - (index % 3) * 12;
      if (r.top < minTop) nextTop = minTop + (index % 3) * 15;
      if (r.bottom > bounds.bottom) nextTop = maxTop - (index % 3) * 12;

      nextLeft = Math.min(maxLeft, Math.max(minLeft, nextLeft));
      nextTop = Math.min(maxTop, Math.max(minTop, nextTop));

      if (
        Math.abs(nextLeft - pos.left) > 2 ||
        Math.abs(nextTop - pos.top) > 2
      ) {
        setPosition(el, nextLeft, nextTop);
      }
    });
  }

  function distributeIfWide() {
    const bounds = getMobileColumnBounds();
    if (!bounds.isWide) return;

    const targets = getTargets();
    if (!targets.length) return;

    const cols = Math.min(4, Math.max(2, targets.length));
    const usableW = bounds.right - bounds.left - 48;
    const rowGap = 74;

    targets.forEach(function (el, index) {
      const r = el.getBoundingClientRect();

      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = bounds.left + 20 + (usableW / Math.max(1, cols - 1)) * col;
      const y = bounds.top + 18 + row * rowGap;

      const maxY = bounds.bottom - Math.max(42, r.height);
      const finalY = Math.min(maxY, y);

      setPosition(el, x, finalY);
    });
  }

  function run() {
    const now = Date.now();
    if (now - state.lastRun < 90) return;
    state.lastRun = now;

    clampIntoColumn();
    distributeIfWide();
  }

  function install() {
    if (state.installed) return;
    state.installed = true;

    document.documentElement.classList.add('gj-mobile-viewport-clamp-v848g');

    injectStyle();

    const mo = new MutationObserver(function () {
      setTimeout(run, 20);
      setTimeout(run, 140);
    });

    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'data-kind', 'data-target', 'data-food', 'data-junk']
    });

    [80, 200, 420, 760, 1200, 1800].forEach(function (ms) {
      setTimeout(run, ms);
    });

    setInterval(run, 450);

    window.addEventListener('resize', function () {
      setTimeout(run, 100);
    });

    window.GJ_MOBILE_VIEWPORT_CLAMP = {
      version: '20260605-v848g',
      run,
      bounds: getMobileColumnBounds,
      targets: getTargets
    };

    try {
      console.log('[' + PATCH + '] installed');
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
