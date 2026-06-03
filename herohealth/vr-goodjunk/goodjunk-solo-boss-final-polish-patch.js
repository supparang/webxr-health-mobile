// === /herohealth/vr-goodjunk/goodjunk-solo-boss-final-polish-patch.js ===
// PATCH v20260603-v848b
// Purpose: final visual polish, mobile safe layout, summary visibility, loading safety.

(function () {
  'use strict';

  const PATCH = 'GJ_SOLO_BOSS_FINAL_POLISH_V848B';

  function isGoodJunk() {
    return /goodjunk|good-junk/i.test(location.pathname + ' ' + document.title);
  }

  if (!isGoodJunk()) return;

  function injectStyle() {
    if (document.getElementById('gjFinalPolishV848bStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjFinalPolishV848bStyle';
    style.textContent = `
      html.gj-final-polish-v848b,
      html.gj-final-polish-v848b body{
        overflow:hidden !important;
        overscroll-behavior:none !important;
        touch-action:manipulation !important;
      }

      html.gj-final-polish-v848b .shell-loading.gj-killed,
      html.gj-final-polish-v848b #shellLoading.gj-killed{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
        z-index:-1 !important;
      }

      html.gj-final-polish-v848b #gjSoloBossMain{
        display:block !important;
        visibility:visible !important;
        opacity:1 !important;
      }

      html.gj-final-polish-v848b #gjmStartOverlay{
        pointer-events:auto;
      }

      html.gj-final-polish-v848b .shell-back{
        z-index:100030 !important;
      }

      html.gj-final-polish-v848b .gjm-hud{
        z-index:60 !important;
      }

      html.gj-final-polish-v848b .gjm-start{
        z-index:90 !important;
      }

      html.gj-final-polish-v848b .gjm-message{
        z-index:88 !important;
      }

      html.gj-final-polish-v848b .gj-summary,
      html.gj-final-polish-v848b .summary,
      html.gj-final-polish-v848b .summary-screen,
      html.gj-final-polish-v848b .result,
      html.gj-final-polish-v848b .result-screen,
      html.gj-final-polish-v848b #summary,
      html.gj-final-polish-v848b #summaryScreen,
      html.gj-final-polish-v848b #result,
      html.gj-final-polish-v848b #resultScreen{
        max-height:calc(100dvh - 18px) !important;
        overflow:auto !important;
        -webkit-overflow-scrolling:touch !important;
        overscroll-behavior:contain !important;
      }

      html.gj-final-polish-v848b .gjr-card,
      html.gj-final-polish-v848b .gj-reward-card,
      html.gj-final-polish-v848b .reward-card{
        max-height:calc(100dvh - 22px) !important;
        overflow:auto !important;
        -webkit-overflow-scrolling:touch !important;
      }

      html.gj-final-polish-v848b button,
      html.gj-final-polish-v848b a,
      html.gj-final-polish-v848b [role="button"]{
        touch-action:manipulation !important;
      }

      @media (max-width:720px){
        html.gj-final-polish-v848b .gjm-start-card{
          max-height:calc(100dvh - 24px) !important;
          overflow:auto !important;
        }

        html.gj-final-polish-v848b .gjm-start-card h1{
          font-size:clamp(26px,7vw,38px) !important;
        }

        html.gj-final-polish-v848b .gjm-start-card p{
          font-size:14px !important;
        }

        html.gj-final-polish-v848b .gjm-start-btn{
          min-height:48px !important;
          border-radius:20px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function killLoading() {
    const loading = document.getElementById('shellLoading');
    if (loading) {
      loading.classList.add('gj-killed');
      try {
        loading.style.setProperty('display', 'none', 'important');
        loading.style.setProperty('visibility', 'hidden', 'important');
        loading.style.setProperty('opacity', '0', 'important');
        loading.style.setProperty('pointer-events', 'none', 'important');
        loading.style.setProperty('z-index', '-1', 'important');
      } catch (_) {}
    }

    const main = document.getElementById('gjSoloBossMain');
    if (main) {
      main.style.setProperty('display', 'block', 'important');
      main.style.setProperty('visibility', 'visible', 'important');
      main.style.setProperty('opacity', '1', 'important');
    }

    const startBtn = document.getElementById('gjmStartBtn');
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.style.setProperty('pointer-events', 'auto', 'important');
    }
  }

  function normalizeButtons() {
    document.querySelectorAll('button,a,[role="button"]').forEach(function (el) {
      el.style.touchAction = 'manipulation';
    });
  }

  function install() {
    document.documentElement.classList.add('gj-final-polish-v848b');
    injectStyle();

    [60, 160, 350, 700, 1200, 2000].forEach(function (ms) {
      setTimeout(killLoading, ms);
    });

    window.addEventListener('load', killLoading, { once: true });

    normalizeButtons();

    const mo = new MutationObserver(function () {
      normalizeButtons();
      killLoading();
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });

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
