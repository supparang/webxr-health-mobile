/* =========================================================
   HeroHealth • Plate Solo Kill Blur Hard Patch
   File: /herohealth/plate-solo-kill-blur-hard-patch.js
   PATCH v20260512-PLATE-SOLO-KILL-BLUR-HARD-RC2

   แก้อาการ:
   ✅ overlay blur ค้างทั้งหน้า
   ✅ backdrop-filter/filter ค้างจาก element ที่ไม่รู้ชื่อ class
   ✅ full-screen scrim/backdrop/glass/cover ทับจอ
   ✅ summary ต้องชัด ไม่มัว
   ✅ ถ้ามี overlay เต็มจอแต่ไม่มี summary card จะซ่อนทันที
   ========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260512-PLATE-SOLO-KILL-BLUR-HARD-RC2';
  const WIN = window;
  const DOC = document;

  const nativeSetTimeout = WIN.setTimeout.bind(WIN);

  let scheduled = false;
  let booted = false;

  const SUMMARY_CARD_SELECTOR = [
    '.summary-card',
    '.result-card',
    '.modal-card',
    '[data-summary-card="1"]',
    '[data-result-card="1"]'
  ].join(',');

  const SUMMARY_SHELL_SELECTOR = [
    '#summaryModal',
    '#resultModal',
    '.summary-modal',
    '.result-modal',
    '[data-summary="1"]',
    '[data-result="1"]'
  ].join(',');

  const SAFE_ROOT_SELECTOR = [
    'html',
    'body',
    '.plate-app',
    '#plateApp',
    '#app',
    '.game-app',
    '.hh-game',
    '.main',
    '.plate-main',
    '.game-main',
    '.content',
    '.stage',
    '.plate-stage',
    '.game-stage',
    '#stage',
    '#gameStage'
  ].join(',');

  const qs = (s, root = DOC) => root.querySelector(s);
  const qsa = (s, root = DOC) => Array.from(root.querySelectorAll(s));

  function isVisible(el){
    if (!el) return false;

    const cs = WIN.getComputedStyle(el);
    const r = el.getBoundingClientRect();

    return (
      cs.display !== 'none' &&
      cs.visibility !== 'hidden' &&
      cs.opacity !== '0' &&
      r.width > 20 &&
      r.height > 20
    );
  }

  function hasVisibleSummaryCard(el){
    if (!el) return false;

    if (el.matches && el.matches(SUMMARY_CARD_SELECTOR)) {
      return isVisible(el);
    }

    const card = qs(SUMMARY_CARD_SELECTOR, el);
    return !!(card && isVisible(card));
  }

  function summaryIsVisible(){
    return qsa(SUMMARY_SHELL_SELECTOR).some(el => {
      const cs = WIN.getComputedStyle(el);
      return (
        hasVisibleSummaryCard(el) ||
        el.classList.contains('show') ||
        el.classList.contains('open') ||
        el.getAttribute('aria-hidden') === 'false' ||
        cs.display === 'flex' ||
        cs.display === 'grid'
      );
    });
  }

  function bodyEnded(){
    return (
      DOC.body.classList.contains('plate-ended') ||
      DOC.body.classList.contains('plate-hard-ended') ||
      DOC.body.classList.contains('is-ended') ||
      summaryIsVisible()
    );
  }

  function cssText(el){
    return [
      el.id || '',
      el.getAttribute('class') || '',
      el.getAttribute('role') || '',
      el.getAttribute('data-overlay') || '',
      el.getAttribute('data-modal') || '',
      el.getAttribute('data-screen') || ''
    ].join(' ');
  }

  function hasBlur(cs){
    const f =
      cs.filter ||
      cs.webkitFilter ||
      '';

    const bf =
      cs.backdropFilter ||
      cs.webkitBackdropFilter ||
      '';

    return (
      f && f !== 'none' ||
      bf && bf !== 'none'
    );
  }

  function backgroundAlpha(cs){
    const bg = cs.backgroundColor || '';

    if (!bg || bg === 'transparent') return 0;

    const rgba = bg.match(/rgba?\(([^)]+)\)/i);
    if (!rgba) return 0;

    const parts = rgba[1].split(',').map(v => v.trim());

    if (parts.length < 3) return 0;
    if (parts.length === 3) return 1;

    const a = Number(parts[3]);
    return Number.isFinite(a) ? a : 0;
  }

  function coversScreen(el){
    const r = el.getBoundingClientRect();
    const vw = WIN.innerWidth || DOC.documentElement.clientWidth || 1;
    const vh = WIN.innerHeight || DOC.documentElement.clientHeight || 1;

    return (
      r.width >= vw * 0.68 &&
      r.height >= vh * 0.68 &&
      r.left <= vw * 0.18 &&
      r.top <= vh * 0.18
    );
  }

  function isLikelyBlockingOverlay(el){
    if (!el || el.nodeType !== 1) return false;
    if (el.matches && el.matches(SAFE_ROOT_SELECTOR)) return false;
    if (el.closest && el.closest(SUMMARY_CARD_SELECTOR)) return false;

    const cs = WIN.getComputedStyle(el);
    const label = cssText(el);

    const pos = cs.position;
    const positioned =
      pos === 'fixed' ||
      pos === 'absolute' ||
      pos === 'sticky';

    const nameHit = /(overlay|backdrop|blur|modal|veil|shade|scrim|glass|curtain|cover|loading|intro|howto|start|pause|screen|layer)/i.test(label);

    const full = coversScreen(el);
    const blur = hasBlur(cs);
    const alpha = backgroundAlpha(cs);

    return (
      full &&
      positioned &&
      (
        blur ||
        nameHit ||
        alpha >= 0.10
      )
    );
  }

  function setImportant(el, prop, value){
    try {
      el.style.setProperty(prop, value, 'important');
    } catch (_) {}
  }

  function clearBlur(el){
    if (!el) return;

    setImportant(el, 'filter', 'none');
    setImportant(el, '-webkit-filter', 'none');
    setImportant(el, 'backdrop-filter', 'none');
    setImportant(el, '-webkit-backdrop-filter', 'none');
  }

  function hideBlocker(el){
    if (!el) return;

    el.classList.add('plate-kill-blur-hidden');
    el.setAttribute('aria-hidden', 'true');

    clearBlur(el);

    setImportant(el, 'display', 'none');
    setImportant(el, 'visibility', 'hidden');
    setImportant(el, 'opacity', '0');
    setImportant(el, 'pointer-events', 'none');
    setImportant(el, 'background', 'transparent');
  }

  function keepSummaryShell(el){
    if (!el) return;

    el.classList.add('plate-summary-shell-safe');
    el.classList.remove('plate-kill-blur-hidden');
    el.setAttribute('aria-hidden', 'false');

    clearBlur(el);

    setImportant(el, 'display', 'flex');
    setImportant(el, 'visibility', 'visible');
    setImportant(el, 'opacity', '1');
    setImportant(el, 'pointer-events', 'auto');
    setImportant(el, 'background', 'rgba(29,64,85,.10)');
    setImportant(el, 'z-index', '99999');

    const card = qs(SUMMARY_CARD_SELECTOR, el);
    if (card) {
      clearBlur(card);
      setImportant(card, 'display', '');
      setImportant(card, 'visibility', 'visible');
      setImportant(card, 'opacity', '1');
      setImportant(card, 'pointer-events', 'auto');
      setImportant(card, 'z-index', '100000');
    }
  }

  function clearRootFilters(){
    DOC.documentElement.classList.add('plate-kill-blur-root');
    DOC.body.classList.add('plate-kill-blur-root');

    clearBlur(DOC.documentElement);
    clearBlur(DOC.body);

    const app =
      qs('.plate-app') ||
      qs('#plateApp') ||
      qs('#app') ||
      qs('.game-app') ||
      qs('.hh-game');

    if (app) clearBlur(app);
  }

  function killBlurHard(reason){
    clearRootFilters();

    const ended = bodyEnded();

    /*
      1) รักษา summary shell ที่มี card จริงให้ชัดก่อน
    */
    qsa(SUMMARY_SHELL_SELECTOR).forEach(el => {
      if (hasVisibleSummaryCard(el) || ended) {
        keepSummaryShell(el);
      }
    });

    /*
      2) สแกน element ทั้งหน้า
         ถ้าเป็น full-screen overlay/backdrop/blur ที่ไม่ใช่ summary ให้ซ่อน
    */
    const all = Array.from(DOC.body.getElementsByTagName('*'));

    all.forEach(el => {
      if (!el || el.nodeType !== 1) return;

      if (el.matches && el.matches(SUMMARY_CARD_SELECTOR)) {
        clearBlur(el);
        return;
      }

      if (el.matches && el.matches(SUMMARY_SHELL_SELECTOR)) {
        if (hasVisibleSummaryCard(el) || ended) {
          keepSummaryShell(el);
        }
        return;
      }

      if (hasVisibleSummaryCard(el)) {
        keepSummaryShell(el);
        return;
      }

      clearBlur(el);

      if (isLikelyBlockingOverlay(el)) {
        const label = cssText(el);

        /*
          ถ้ายังไม่เริ่มเกม และเป็น start/howto ที่มี card ให้ไม่ซ่อน
          แต่ลบ blur ออก
        */
        const isStartLike = /(start|howto|intro)/i.test(label);
        const canKeepStart =
          !ended &&
          isStartLike &&
          qs('.start-card,.howto-card,.overlay-card', el) &&
          isVisible(qs('.start-card,.howto-card,.overlay-card', el));

        if (canKeepStart) {
          setImportant(el, 'backdrop-filter', 'none');
          setImportant(el, '-webkit-backdrop-filter', 'none');
          setImportant(el, 'background', 'rgba(255,255,255,.18)');
          return;
        }

        hideBlocker(el);
      }
    });

    /*
      3) เก็บกวาด overlay ที่มักค้างแบบไม่เข้าเงื่อนไข
    */
    if (ended) {
      qsa('.overlay,.start-overlay,.howto-overlay,#startOverlay,#howtoOverlay,.backdrop,.scrim,.glass,.blur-layer,.loading-overlay,.screen-cover').forEach(el => {
        if (hasVisibleSummaryCard(el)) {
          keepSummaryShell(el);
        } else {
          hideBlocker(el);
        }
      });
    }
  }

  function scheduleKill(reason){
    if (scheduled) return;
    scheduled = true;

    nativeSetTimeout(() => {
      scheduled = false;
      killBlurHard(reason || 'scheduled');
    }, 30);
  }

  function addStyle(){
    if (qs('#plateSoloKillBlurHardStyle')) return;

    const style = DOC.createElement('style');
    style.id = 'plateSoloKillBlurHardStyle';

    style.textContent = `
      html.plate-kill-blur-root,
      body.plate-kill-blur-root,
      body.plate-kill-blur-root *{
        filter:none !important;
        -webkit-filter:none !important;
        backdrop-filter:none !important;
        -webkit-backdrop-filter:none !important;
      }

      body.plate-kill-blur-root .plate-kill-blur-hidden{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
        background:transparent !important;
        filter:none !important;
        -webkit-filter:none !important;
        backdrop-filter:none !important;
        -webkit-backdrop-filter:none !important;
      }

      body.plate-kill-blur-root .plate-summary-shell-safe{
        display:flex !important;
        visibility:visible !important;
        opacity:1 !important;
        pointer-events:auto !important;
        background:rgba(29,64,85,.10) !important;
        filter:none !important;
        -webkit-filter:none !important;
        backdrop-filter:none !important;
        -webkit-backdrop-filter:none !important;
        z-index:99999 !important;
      }

      body.plate-kill-blur-root .summary-card,
      body.plate-kill-blur-root .result-card,
      body.plate-kill-blur-root .modal-card{
        filter:none !important;
        -webkit-filter:none !important;
        backdrop-filter:none !important;
        -webkit-backdrop-filter:none !important;
        opacity:1 !important;
        visibility:visible !important;
        z-index:100000 !important;
      }

      body.plate-ended .overlay:not(.plate-summary-shell-safe),
      body.plate-ended .start-overlay,
      body.plate-ended .howto-overlay,
      body.plate-ended #startOverlay,
      body.plate-ended #howtoOverlay,
      body.plate-hard-ended .overlay:not(.plate-summary-shell-safe),
      body.plate-hard-ended .start-overlay,
      body.plate-hard-ended .howto-overlay,
      body.plate-hard-ended #startOverlay,
      body.plate-hard-ended #howtoOverlay,
      body.is-ended .overlay:not(.plate-summary-shell-safe),
      body.is-ended .start-overlay,
      body.is-ended .howto-overlay,
      body.is-ended #startOverlay,
      body.is-ended #howtoOverlay{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
        background:transparent !important;
        backdrop-filter:none !important;
        -webkit-backdrop-filter:none !important;
      }
    `;

    DOC.head.appendChild(style);
  }

  function observe(){
    if (WIN.__PLATE_SOLO_KILL_BLUR_HARD_OBSERVER__) return;

    const mo = new MutationObserver(() => {
      scheduleKill('mutation');
    });

    mo.observe(DOC.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class', 'style', 'aria-hidden']
    });

    WIN.__PLATE_SOLO_KILL_BLUR_HARD_OBSERVER__ = mo;
  }

  function patchHooks(){
    [
      'showSummary',
      'openSummary',
      'renderSummary',
      'endGame',
      'finishGame',
      'gameOver',
      'completeGame'
    ].forEach(name => {
      const fn = WIN[name];

      if (typeof fn !== 'function') return;
      if (fn.__plateKillBlurHardPatched) return;

      const patched = function(){
        const result = fn.apply(this, arguments);

        [0, 50, 120, 300, 700, 1200].forEach(ms => {
          nativeSetTimeout(() => killBlurHard('hook:' + name), ms);
        });

        return result;
      };

      patched.__plateKillBlurHardPatched = true;
      WIN[name] = patched;
    });
  }

  function expose(){
    WIN.PlateSoloKillBlurHardPatch = {
      version:VERSION,
      kill:killBlurHard,
      scan(){
        const blockers = [];

        Array.from(DOC.body.getElementsByTagName('*')).forEach(el => {
          if (isLikelyBlockingOverlay(el)) {
            blockers.push({
              tag:el.tagName,
              id:el.id,
              className:el.getAttribute('class') || '',
              text:(el.textContent || '').trim().slice(0,60)
            });
          }
        });

        console.table(blockers);
        return blockers;
      }
    };
  }

  function boot(){
    if (booted) return;
    booted = true;

    addStyle();
    patchHooks();
    observe();
    expose();

    [0, 80, 240, 600, 1200, 2200].forEach(ms => {
      nativeSetTimeout(() => killBlurHard('boot'), ms);
    });
  }

  [
    'hha:game-end',
    'hha:summary',
    'hha:plate:end',
    'game:end',
    'game:summary',
    'plate:end'
  ].forEach(eventName => {
    WIN.addEventListener(eventName, () => {
      [0, 80, 240, 600].forEach(ms => {
        nativeSetTimeout(() => killBlurHard('event:' + eventName), ms);
      });
    }, true);
  });

  WIN.addEventListener('DOMContentLoaded', boot);

  if (DOC.readyState === 'interactive' || DOC.readyState === 'complete') {
    boot();
  }

})();
