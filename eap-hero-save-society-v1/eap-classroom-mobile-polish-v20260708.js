/* =========================================================
   EAP Hero Classroom Mobile Polish v20260708
   - Keeps manual Sheet button available but compact on mobile.
   - Adds extra bottom safe space for floating controls.
   - UI-only; does not change Sheet sync behavior or scoring.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-CLASSROOM-MOBILE-POLISH-V1';
  const STYLE_ID = 'eap-classroom-mobile-polish-style';
  const SHEET_BUTTON_ID = 'eap-sheet-manual-send';

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html,body{scroll-padding-bottom:170px!important}
      body{padding-bottom:max(150px,env(safe-area-inset-bottom))!important}
      #app{padding-bottom:140px!important}

      #${SHEET_BUTTON_ID}{
        max-width:220px!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }

      @media(max-width:760px){
        #${SHEET_BUTTON_ID}{
          right:8px!important;
          bottom:calc(74px + env(safe-area-inset-bottom))!important;
          padding:9px 10px!important;
          min-width:0!important;
          max-width:96px!important;
          border-radius:999px!important;
          font:900 12px Arial,'Noto Sans Thai',sans-serif!important;
          box-shadow:0 5px 14px rgba(0,0,0,.22)!important;
          opacity:.94!important;
          z-index:99990!important;
        }

        #${SHEET_BUTTON_ID}:active{
          transform:scale(.97)!important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function polishButton(){
    const button = document.getElementById(SHEET_BUTTON_ID);
    if (!button) return false;

    button.dataset.classroomPolish = VERSION;
    button.title = 'ส่งผลล่าสุดเข้า Sheet';
    button.setAttribute('aria-label', 'ส่งผลล่าสุดเข้า Sheet');

    if (window.matchMedia && window.matchMedia('(max-width: 760px)').matches) {
      if (button.textContent !== '📤 Sheet') {
        button.textContent = '📤 Sheet';
      }
    } else if (button.textContent !== '📤 ส่งผลล่าสุดเข้า Sheet') {
      button.textContent = '📤 ส่งผลล่าสุดเข้า Sheet';
    }

    return true;
  }

  function start(){
    injectStyle();
    polishButton();
    window.setInterval(polishButton, 900);
    window.addEventListener('resize', polishButton);
    window.EAPClassroomMobilePolish = {
      version: VERSION,
      refresh: polishButton
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
