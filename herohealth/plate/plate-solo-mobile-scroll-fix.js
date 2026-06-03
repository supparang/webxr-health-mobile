/* =========================================================
   HeroHealth Plate Solo • Mobile Intro Scroll Fix
   PATCH: v20260525-plate-mobile-scroll-fix
   Fix:
   - Mobile intro / instruction screen cannot scroll
   - Android Chrome bottom bar hides lower content
   - Keep gameplay locked, but allow scroll before game / modal / guide
========================================================= */

(function(){
  'use strict';

  const PATCH_ID = 'v20260525-plate-mobile-scroll-fix';

  function injectCss(){
    if (document.getElementById('hha-plate-mobile-scroll-fix-css')) return;

    const css = `
      /* เปิด scroll เฉพาะตอนมี intro / modal / instruction */
      html.hha-plate-scroll-open,
      body.hha-plate-scroll-open{
        height:auto !important;
        min-height:100dvh !important;
        overflow-y:auto !important;
        overflow-x:hidden !important;
        touch-action:pan-y !important;
        overscroll-behavior-y:contain !important;
      }

      body.hha-plate-scroll-open #app{
        height:auto !important;
        min-height:100dvh !important;
        overflow:visible !important;
        touch-action:pan-y !important;
      }

      body.hha-plate-scroll-open #stage{
        touch-action:pan-y !important;
      }

      body.hha-plate-scroll-open .overlay[aria-hidden="false"]{
        display:block !important;
        overflow-y:auto !important;
        overflow-x:hidden !important;
        -webkit-overflow-scrolling:touch !important;
        touch-action:pan-y !important;
        padding-top:max(18px, env(safe-area-inset-top, 0px)) !important;
        padding-bottom:calc(120px + env(safe-area-inset-bottom, 0px)) !important;
      }

      body.hha-plate-scroll-open .overlay[aria-hidden="false"] .modal{
        max-height:none !important;
        overflow:visible !important;
        margin:0 auto !important;
      }

      body.hha-plate-scroll-open .drawer[aria-hidden="false"]{
        max-height:calc(100dvh - 40px) !important;
        overflow-y:auto !important;
        -webkit-overflow-scrolling:touch !important;
        touch-action:pan-y !important;
        padding-bottom:calc(90px + env(safe-area-inset-bottom, 0px)) !important;
      }

      /* สำหรับ intro/start screen ที่ไม่ได้ใช้ class overlay */
      body.hha-plate-scroll-open .hha-scroll-host{
        overflow-y:auto !important;
        overflow-x:hidden !important;
        -webkit-overflow-scrolling:touch !important;
        touch-action:pan-y !important;
        max-height:none !important;
      }

      body.hha-plate-scroll-open .hha-scroll-card{
        margin-top:max(18px, env(safe-area-inset-top, 0px)) !important;
        margin-bottom:calc(120px + env(safe-area-inset-bottom, 0px)) !important;
      }

      @media (max-width:760px){
        body.hha-plate-scroll-open{
          padding-bottom:calc(88px + env(safe-area-inset-bottom, 0px)) !important;
        }

        body.hha-plate-scroll-open .modal,
        body.hha-plate-scroll-open .hha-scroll-card{
          width:min(92vw, 560px) !important;
          border-radius:24px !important;
        }
      }
    `;

    const style = document.createElement('style');
    style.id = 'hha-plate-mobile-scroll-fix-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function isVisible(el){
    if (!el) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 20 && r.height > 20 && r.bottom > 0 && r.right > 0;
  }

  function hasActiveGameplay(){
    const bodyText = document.body.textContent || '';

    const hasTarget = !!document.querySelector('.plateTarget');
    const hasHud = !!document.querySelector('#uiTime, #uiScore, #stage');

    const introWords =
      bodyText.includes('อ่านภารกิจ') ||
      bodyText.includes('ดู goal ก่อน') ||
      bodyText.includes('ภารกิจรอบนี้') ||
      bodyText.includes('แตะเฉพาะ') ||
      bodyText.includes('ก่อนเริ่ม');

    return hasTarget && hasHud && !introWords;
  }

  function findIntroHost(){
    const selectors = [
      '#startOverlay',
      '#introOverlay',
      '#preStartOverlay',
      '#prestartOverlay',
      '#guideOverlay',
      '#instructionOverlay',
      '.startOverlay',
      '.introOverlay',
      '.preStartOverlay',
      '.prestartOverlay',
      '.guideOverlay',
      '.instructionOverlay',
      '.startScreen',
      '.introScreen',
      '.plateIntro',
      '.plate-start',
      '.modal',
      '.overlay[aria-hidden="false"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (isVisible(el)) return el;
    }

    const cards = Array.from(document.querySelectorAll('div,section,main,article'));
    return cards.find(el => {
      if (!isVisible(el)) return false;

      const text = (el.textContent || '').replace(/\s+/g, ' ');
      const r = el.getBoundingClientRect();

      const looksLikePlateIntro =
        text.includes('Plate Solo') &&
        (
          text.includes('อ่านภารกิจ') ||
          text.includes('ดู goal ก่อน') ||
          text.includes('ภารกิจรอบนี้') ||
          text.includes('แตะเฉพาะ')
        );

      return looksLikePlateIntro && r.height > innerHeight * 0.55;
    }) || null;
  }

  function markScrollParents(el){
    document.querySelectorAll('.hha-scroll-host,.hha-scroll-card').forEach(x => {
      x.classList.remove('hha-scroll-host', 'hha-scroll-card');
    });

    if (!el) return;

    el.classList.add('hha-scroll-card');

    let host = el;
    for (let i = 0; i < 6 && host && host !== document.body; i += 1) {
      const st = getComputedStyle(host);
      const pos = st.position;

      if (
        host.scrollHeight > host.clientHeight + 12 ||
        pos === 'fixed' ||
        pos === 'absolute' ||
        host.classList.contains('overlay') ||
        host.id === 'app'
      ) {
        host.classList.add('hha-scroll-host');
      }

      host = host.parentElement;
    }

    document.body.classList.add('hha-scroll-host');
  }

  function shouldOpenScroll(){
    const openOverlay = Array.from(document.querySelectorAll('.overlay[aria-hidden="false"], .drawer[aria-hidden="false"]'))
      .some(isVisible);

    if (openOverlay) return true;

    const intro = findIntroHost();
    if (!intro) return false;

    if (hasActiveGameplay()) return false;

    return true;
  }

  function sync(){
    const open = shouldOpenScroll();
    const intro = findIntroHost();

    document.documentElement.classList.toggle('hha-plate-scroll-open', open);
    document.body.classList.toggle('hha-plate-scroll-open', open);
    document.body.dataset.plateScrollFix = open ? PATCH_ID : '';

    if (open) markScrollParents(intro);
  }

  function boot(){
    injectCss();
    sync();

    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', () => setTimeout(sync, 250));

    const mo = new MutationObserver(() => {
      requestAnimationFrame(sync);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','style','aria-hidden','hidden']
    });

    setInterval(sync, 700);

    console.log('[Plate Mobile Scroll Fix]', PATCH_ID);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();