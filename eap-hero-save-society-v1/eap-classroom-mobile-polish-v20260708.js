/* =========================================================
   EAP Hero Classroom Mobile Polish v20260708
   - Stacks floating Sheet / Boss retry controls on mobile.
   - Keeps manual controls available but compact.
   - Adds extra bottom safe space so content can scroll above buttons.
   - UI-only; does not change Sheet sync, Boss retry logic, scoring, or evidence.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-CLASSROOM-MOBILE-POLISH-V2-FLOATING-STACK';
  const STYLE_ID = 'eap-classroom-mobile-polish-style';
  const SHEET_BUTTON_ID = 'eap-sheet-manual-send';
  const BOSS_RETRY_ID = 'eap-boss-review-retry';

  function isMobile(){
    return !!(window.matchMedia && window.matchMedia('(max-width: 760px)').matches);
  }

  function injectStyle(){
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
      html,body{scroll-padding-bottom:230px!important}
      body{padding-bottom:max(210px,env(safe-area-inset-bottom))!important}
      #app{padding-bottom:200px!important}

      #${SHEET_BUTTON_ID},
      #${BOSS_RETRY_ID}{
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }

      @media(min-width:761px){
        #${SHEET_BUTTON_ID}{right:18px!important;bottom:18px!important;max-width:220px!important}
        #${BOSS_RETRY_ID}{right:18px!important;bottom:70px!important;max-width:260px!important}
      }

      @media(max-width:760px){
        #${SHEET_BUTTON_ID}{
          right:10px!important;
          bottom:calc(132px + env(safe-area-inset-bottom))!important;
          padding:8px 10px!important;
          min-width:0!important;
          max-width:92px!important;
          border-radius:999px!important;
          font:900 12px Arial,'Noto Sans Thai',sans-serif!important;
          box-shadow:0 5px 14px rgba(0,0,0,.22)!important;
          opacity:.95!important;
          z-index:99990!important;
        }

        #${BOSS_RETRY_ID}{
          right:10px!important;
          bottom:calc(84px + env(safe-area-inset-bottom))!important;
          padding:9px 12px!important;
          min-width:0!important;
          max-width:156px!important;
          border-radius:999px!important;
          font:900 12px Arial,'Noto Sans Thai',sans-serif!important;
          box-shadow:0 5px 14px rgba(0,0,0,.22)!important;
          opacity:.96!important;
          z-index:99989!important;
        }

        #${SHEET_BUTTON_ID}:active,
        #${BOSS_RETRY_ID}:active{
          transform:scale(.97)!important;
        }
      }
    `;
  }

  function polishSheetButton(){
    const button = document.getElementById(SHEET_BUTTON_ID);
    if (!button) return false;

    button.dataset.classroomPolish = VERSION;
    button.title = 'ส่งผลล่าสุดเข้า Sheet';
    button.setAttribute('aria-label', 'ส่งผลล่าสุดเข้า Sheet');

    const label = isMobile() ? '📤 Sheet' : '📤 ส่งผลล่าสุดเข้า Sheet';
    if (button.textContent !== label) button.textContent = label;

    return true;
  }

  function polishBossRetryButton(){
    const button = document.getElementById(BOSS_RETRY_ID);
    if (!button) return false;

    button.dataset.classroomPolish = VERSION;
    button.title = 'Retry Boss Speaking evidence';
    button.setAttribute('aria-label', 'Retry Boss Speaking evidence');

    const label = isMobile() ? '🎤 Retry Boss' : '📤 Retry Boss Speaking';
    if (button.textContent !== label) button.textContent = label;

    return true;
  }

  function polishAll(){
    injectStyle();
    polishSheetButton();
    polishBossRetryButton();
  }

  function start(){
    polishAll();
    window.setInterval(polishAll, 600);
    window.addEventListener('resize', polishAll);
    window.EAPClassroomMobilePolish = {
      version: VERSION,
      refresh: polishAll
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
