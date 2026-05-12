/* =========================================================
   HeroHealth • Plate Solo Unblur Overlay Patch
   File: /herohealth/plate-solo-unblur-overlay-patch.js
   PATCH v20260512-PLATE-SOLO-UNBLUR-OVERLAY-RC1

   แก้อาการ:
   ✅ หน้าเกมมัวทั้งหน้า
   ✅ backdrop-filter / overlay ค้าง
   ✅ modal ที่ไม่มี .show แต่ยังทับจอ
   ✅ start/howto overlay ค้างหลังเริ่มหรือหลัง summary
   ✅ summary card ต้องชัด ไม่เบลอ
   ========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260512-PLATE-SOLO-UNBLUR-OVERLAY-RC1';
  const WIN = window;
  const DOC = document;

  const qs = (s, root = DOC) => root.querySelector(s);
  const qsa = (s, root = DOC) => Array.from(root.querySelectorAll(s));

  const GAME_OVERLAY_SELECTORS = [
    '.overlay',
    '.start-overlay',
    '.howto-overlay',
    '#startOverlay',
    '#howtoOverlay'
  ].join(',');

  const SUMMARY_SELECTORS = [
    '#summaryModal',
    '#resultModal',
    '.summary-modal',
    '.result-modal'
  ].join(',');

  const GENERIC_MODAL_SELECTORS = [
    '.modal'
  ].join(',');

  function isShownByClass(el){
    if (!el) return false;
    return (
      el.classList.contains('show') ||
      el.classList.contains('open') ||
      el.getAttribute('aria-hidden') === 'false'
    );
  }

  function hasVisibleCard(el){
    if (!el) return false;

    const card = qs(
      '.summary-card, .result-card, .modal-card, .start-card, .howto-card, .overlay-card',
      el
    );

    if (!card) return false;

    const st = WIN.getComputedStyle(card);
    const r = card.getBoundingClientRect();

    return (
      st.display !== 'none' &&
      st.visibility !== 'hidden' &&
      st.opacity !== '0' &&
      r.width > 20 &&
      r.height > 20
    );
  }

  function forceHide(el){
    if (!el) return;

    el.classList.remove('show', 'open', 'active', 'is-visible');
    el.setAttribute('aria-hidden', 'true');

    el.style.display = 'none';
    el.style.visibility = 'hidden';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    el.style.backdropFilter = 'none';
    el.style.webkitBackdropFilter = 'none';
  }

  function forceShowSummary(el){
    if (!el) return;

    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');

    el.style.display = 'flex';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';

    /*
      สำคัญ: ให้ summary เห็นชัด ไม่เบลอทั้งหน้า
      ใช้พื้นหลังโปร่งเล็กน้อยแทน blur หนัก
    */
    el.style.backdropFilter = 'none';
    el.style.webkitBackdropFilter = 'none';
    el.style.background = 'rgba(29,64,85,.22)';
    el.style.zIndex = '9999';
  }

  function summaryVisible(){
    return qsa(SUMMARY_SELECTORS).some(el => {
      const st = WIN.getComputedStyle(el);
      return (
        isShownByClass(el) ||
        st.display === 'flex' ||
        st.display === 'grid'
      ) && hasVisibleCard(el);
    });
  }

  function cleanupBlurOverlays(){
    const hasSummary = summaryVisible();

    /*
      1) ถ้าเป็น overlay เกมเริ่ม/วิธีเล่น
         หลังเล่นหรือหลังจบ ห้ามทับจอ
    */
    qsa(GAME_OVERLAY_SELECTORS).forEach(el => {
      const bodyEnded =
        DOC.body.classList.contains('plate-ended') ||
        DOC.body.classList.contains('plate-hard-ended') ||
        DOC.body.classList.contains('is-ended');

      const bodyPlaying =
        DOC.body.classList.contains('is-playing') ||
        DOC.body.classList.contains('playing');

      if (bodyEnded || bodyPlaying || hasSummary) {
        forceHide(el);
      }
    });

    /*
      2) modal กว้าง ๆ ที่ไม่ใช่ summary/result
         ถ้าไม่มี card หรือไม่ได้ show จริง ให้ซ่อน
    */
    qsa(GENERIC_MODAL_SELECTORS).forEach(el => {
      if (el.matches(SUMMARY_SELECTORS)) return;

      const shouldStay =
        isShownByClass(el) &&
        hasVisibleCard(el) &&
        !DOC.body.classList.contains('plate-hard-ended');

      if (!shouldStay) {
        forceHide(el);
      }
    });

    /*
      3) summary/result ถ้าขึ้นแล้ว ให้แสดงแบบไม่ blur
    */
    qsa(SUMMARY_SELECTORS).forEach(el => {
      if (isShownByClass(el) || hasVisibleCard(el)) {
        forceShowSummary(el);
      }
    });

    /*
      4) กัน class/inline style ที่ทำให้ทั้ง app มัว
    */
    DOC.body.style.filter = 'none';
    DOC.body.style.backdropFilter = 'none';
    DOC.body.style.webkitBackdropFilter = 'none';

    const app =
      qs('.plate-app') ||
      qs('#plateApp') ||
      qs('#app') ||
      qs('.game-app') ||
      qs('.hh-game');

    if (app) {
      app.style.filter = 'none';
      app.style.backdropFilter = 'none';
      app.style.webkitBackdropFilter = 'none';
    }
  }

  function addStyle(){
    if (qs('#plateSoloUnblurOverlayPatchStyle')) return;

    const style = DOC.createElement('style');
    style.id = 'plateSoloUnblurOverlayPatchStyle';

    style.textContent = `
      body,
      .plate-app,
      #plateApp,
      #app,
      .game-app,
      .hh-game{
        filter:none !important;
        -webkit-filter:none !important;
      }

      body.plate-ended .start-overlay,
      body.plate-ended .howto-overlay,
      body.plate-ended #startOverlay,
      body.plate-ended #howtoOverlay,
      body.plate-hard-ended .start-overlay,
      body.plate-hard-ended .howto-overlay,
      body.plate-hard-ended #startOverlay,
      body.plate-hard-ended #howtoOverlay,
      body.is-ended .start-overlay,
      body.is-ended .howto-overlay,
      body.is-ended #startOverlay,
      body.is-ended #howtoOverlay{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
        backdrop-filter:none !important;
        -webkit-backdrop-filter:none !important;
      }

      body.plate-ended .summary-modal,
      body.plate-ended .result-modal,
      body.plate-ended #summaryModal,
      body.plate-ended #resultModal,
      body.plate-hard-ended .summary-modal,
      body.plate-hard-ended .result-modal,
      body.plate-hard-ended #summaryModal,
      body.plate-hard-ended #resultModal,
      body.is-ended .summary-modal,
      body.is-ended .result-modal,
      body.is-ended #summaryModal,
      body.is-ended #resultModal{
        backdrop-filter:none !important;
        -webkit-backdrop-filter:none !important;
        background:rgba(29,64,85,.22) !important;
        z-index:9999 !important;
      }

      body.plate-ended .summary-card,
      body.plate-ended .result-card,
      body.plate-ended .modal-card,
      body.plate-hard-ended .summary-card,
      body.plate-hard-ended .result-card,
      body.plate-hard-ended .modal-card,
      body.is-ended .summary-card,
      body.is-ended .result-card,
      body.is-ended .modal-card{
        filter:none !important;
        -webkit-filter:none !important;
        backdrop-filter:none !important;
        -webkit-backdrop-filter:none !important;
        opacity:1 !important;
        visibility:visible !important;
      }

      /*
        สำคัญมาก:
        modal ธรรมดาที่ไม่ได้ show ห้ามทับจอ
      */
      .modal:not(.show):not(.open),
      .overlay:not(.show):not(.open):not(.start-overlay):not(.howto-overlay){
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
        backdrop-filter:none !important;
        -webkit-backdrop-filter:none !important;
      }
    `;

    DOC.head.appendChild(style);
  }

  function patchSummaryHooks(){
    const names = [
      'showSummary',
      'openSummary',
      'renderSummary',
      'endGame',
      'finishGame',
      'gameOver'
    ];

    names.forEach(name => {
      const fn = WIN[name];

      if (typeof fn !== 'function') return;
      if (fn.__plateUnblurPatched) return;

      const patched = function(){
        const result = fn.apply(this, arguments);

        setTimeout(cleanupBlurOverlays, 0);
        setTimeout(cleanupBlurOverlays, 80);
        setTimeout(cleanupBlurOverlays, 240);
        setTimeout(cleanupBlurOverlays, 600);

        return result;
      };

      patched.__plateUnblurPatched = true;
      WIN[name] = patched;
    });
  }

  function observe(){
    if (WIN.__PLATE_SOLO_UNBLUR_OBSERVER__) return;

    const mo = new MutationObserver(() => {
      cleanupBlurOverlays();
    });

    mo.observe(DOC.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class', 'style', 'aria-hidden']
    });

    WIN.__PLATE_SOLO_UNBLUR_OBSERVER__ = mo;
  }

  function boot(){
    addStyle();
    patchSummaryHooks();
    observe();

    setTimeout(cleanupBlurOverlays, 80);
    setTimeout(cleanupBlurOverlays, 300);
    setTimeout(cleanupBlurOverlays, 800);

    WIN.PlateSoloUnblurOverlayPatch = {
      version:VERSION,
      cleanup:cleanupBlurOverlays
    };
  }

  WIN.addEventListener('hha:game-end', cleanupBlurOverlays, true);
  WIN.addEventListener('hha:summary', cleanupBlurOverlays, true);
  WIN.addEventListener('hha:plate:end', cleanupBlurOverlays, true);

  WIN.addEventListener('DOMContentLoaded', boot);

  if (DOC.readyState === 'interactive' || DOC.readyState === 'complete') {
    boot();
  }

})();
