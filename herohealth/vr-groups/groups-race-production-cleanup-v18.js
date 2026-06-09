/* =========================================================
   HeroHealth • Groups Race Production Cleanup v18
   File: /herohealth/vr-groups/groups-race-production-cleanup-v18.js
   Purpose:
   - ซ่อน debug/QA box ไม่ให้บังเกมเด็ก
   - ปรับ UI ตอน gameplay ให้สะอาดขึ้น
   - ใช้หลัง v15 + v16 + v17
   ========================================================= */

(function(){
  'use strict';

  const PATCH = 'v20260609-GROUPS-RACE-PRODUCTION-CLEANUP-V18';

  if (window.__HHA_GROUPS_RACE_PRODUCTION_CLEANUP_V18__) return;
  window.__HHA_GROUPS_RACE_PRODUCTION_CLEANUP_V18__ = true;

  const qs = new URLSearchParams(location.search || '');

  const SHOW_DEBUG =
    qs.get('debug') === '1' ||
    qs.get('showdebug') === '1';

  function $(id){
    return document.getElementById(id);
  }

  function injectStyle(){
    if ($('hhaRaceProductionCleanupV18Style')) return;

    const style = document.createElement('style');
    style.id = 'hhaRaceProductionCleanupV18Style';
    style.textContent = `
      /* ซ่อนกล่อง debug ดำ เว้นแต่ตั้งใจเปิด debug=1 */
      body:not(.hha-race-show-debug-v18) #debugBox,
      body:not(.hha-race-show-debug-v18) #hhaQaV17{
        display:none !important;
        pointer-events:none !important;
      }

      body.hha-race-playing #debugBox,
      body.hha-race-playing #hhaQaV17,
      body.hha-race-playing #hhaDevBotPanel{
        display:none !important;
        pointer-events:none !important;
      }

      body.hha-race-playing .toast{
        max-width:86vw;
      }

      @media (max-width:768px){
        body.hha-race-child-polish-v16 .hha-race-question{
          padding:14px !important;
          border-radius:26px !important;
        }

        body.hha-race-child-polish-v16 .hha-race-food{
          width:min(210px,58vw) !important;
          margin-bottom:8px !important;
        }

        body.hha-race-child-polish-v16 .hha-race-food-name{
          font-size:clamp(30px,9vw,44px) !important;
        }

        body.hha-race-child-polish-v16 .hha-child-coach-v16{
          margin-top:10px !important;
        }

        body.hha-race-child-polish-v16 .hha-race-options{
          gap:8px !important;
        }

        body.hha-race-child-polish-v16 .hha-race-choice{
          min-height:72px !important;
          border-radius:20px !important;
          font-size:clamp(15px,4.4vw,19px) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function cleanup(){
    if (SHOW_DEBUG) {
      document.body.classList.add('hha-race-show-debug-v18');
    } else {
      document.body.classList.remove('debug');
      document.body.classList.remove('hha-race-qa-v17');
      document.body.classList.remove('hha-race-show-debug-v18');

      const debugBox = $('debugBox');
      if (debugBox) {
        debugBox.style.display = 'none';
        debugBox.style.pointerEvents = 'none';
      }

      const qaBox = $('hhaQaV17');
      if (qaBox) {
        qaBox.style.display = 'none';
        qaBox.style.pointerEvents = 'none';
      }
    }

    const play = $('hhaRacePlayV15');
    if (play) {
      document.body.classList.add('hha-race-playing');

      const bot = $('hhaDevBotPanel');
      if (bot) {
        bot.style.display = 'none';
        bot.style.pointerEvents = 'none';
      }
    }
  }

  function boot(){
    injectStyle();
    cleanup();

    setInterval(cleanup, 500);

    console.info('[GroupsRaceProductionCleanupV18]', {
      patch: PATCH,
      showDebug: SHOW_DEBUG,
      status: 'ready'
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
