/* =========================================================
   HeroHealth Groups Race Run Mobile Waiting Fix
   PATCH: v20260527-groups-race-run-mobile-waiting-fix-v01
   File: /herohealth/vr-groups/groups-race-run-mobile-waiting-fix-v01.js

   Purpose:
   - Fix waiting room mobile overflow
   - Compact countdown circle / meta boxes / top actions
   - Keep Race room logic untouched
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260527-groups-race-run-mobile-waiting-fix-v01';

  if (window.__HHA_GROUPS_RACE_RUN_MOBILE_WAITING_FIX_V01__) return;
  window.__HHA_GROUPS_RACE_RUN_MOBILE_WAITING_FIX_V01__ = true;

  function addStyle(){
    if (document.getElementById('hha-race-run-mobile-waiting-fix-v01-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-race-run-mobile-waiting-fix-v01-style';

    style.textContent = `
      html,
      body{
        width:100% !important;
        max-width:100% !important;
        overflow-x:hidden !important;
      }

      body.hha-race-mobile-waiting .page{
        width:100% !important;
        max-width:100vw !important;
        margin:0 !important;
        padding:
          calc(8px + env(safe-area-inset-top,0px))
          calc(8px + env(safe-area-inset-right,0px))
          calc(76px + env(safe-area-inset-bottom,0px))
          calc(8px + env(safe-area-inset-left,0px)) !important;
        gap:10px !important;
      }

      body.hha-race-mobile-waiting .topbar{
        display:grid !important;
        grid-template-columns:1fr !important;
        gap:8px !important;
        align-items:stretch !important;
      }

      body.hha-race-mobile-waiting .brand{
        width:100% !important;
        min-width:0 !important;
        padding:10px !important;
        border-radius:20px !important;
        gap:10px !important;
      }

      body.hha-race-mobile-waiting .brandMark{
        width:48px !important;
        height:48px !important;
        min-width:48px !important;
        border-radius:15px !important;
        font-size:25px !important;
      }

      body.hha-race-mobile-waiting .brandTitle{
        font-size:20px !important;
        line-height:1.02 !important;
      }

      body.hha-race-mobile-waiting .brandSub{
        margin-top:4px !important;
        font-size:11px !important;
        line-height:1.15 !important;
      }

      body.hha-race-mobile-waiting .topActions{
        width:100% !important;
        display:grid !important;
        grid-template-columns:1fr 1fr 1fr !important;
        gap:7px !important;
      }

      body.hha-race-mobile-waiting .btn{
        min-height:40px !important;
        padding:0 8px !important;
        border-radius:15px !important;
        font-size:12px !important;
        white-space:nowrap !important;
      }

      body.hha-race-mobile-waiting .heroGrid{
        width:100% !important;
        max-width:100% !important;
        display:grid !important;
        grid-template-columns:1fr !important;
        gap:10px !important;
      }

      body.hha-race-mobile-waiting .card{
        width:100% !important;
        max-width:100% !important;
        border-radius:22px !important;
        padding:12px !important;
      }

      body.hha-race-mobile-waiting .countCard{
        min-height:auto !important;
        padding:12px !important;
      }

      body.hha-race-mobile-waiting .countLabel{
        min-height:30px !important;
        padding:0 10px !important;
        margin-bottom:8px !important;
        font-size:12px !important;
      }

      body.hha-race-mobile-waiting .count{
        width:min(190px,56vw) !important;
        height:min(190px,56vw) !important;
        font-size:clamp(42px,18vw,82px) !important;
      }

      body.hha-race-mobile-waiting .status-text{
        margin-top:10px !important;
        font-size:13px !important;
        line-height:1.35 !important;
        padding:0 4px !important;
      }

      body.hha-race-mobile-waiting .metaGrid{
        grid-template-columns:1fr !important;
        gap:8px !important;
        margin-top:10px !important;
      }

      body.hha-race-mobile-waiting .metaBox{
        border-radius:18px !important;
        padding:10px !important;
      }

      body.hha-race-mobile-waiting .metaLabel{
        font-size:11px !important;
        margin-bottom:4px !important;
      }

      body.hha-race-mobile-waiting .metaValue{
        font-size:26px !important;
        line-height:1.05 !important;
        text-align:center !important;
        letter-spacing:.04em !important;
      }

      body.hha-race-mobile-waiting .sideStack{
        gap:10px !important;
      }

      body.hha-race-mobile-waiting .cardTitle{
        display:flex !important;
        flex-direction:row !important;
        align-items:center !important;
        justify-content:space-between !important;
        gap:8px !important;
        margin-bottom:9px !important;
      }

      body.hha-race-mobile-waiting .cardTitle h2{
        font-size:18px !important;
      }

      body.hha-race-mobile-waiting .pill{
        min-height:30px !important;
        padding:0 10px !important;
        font-size:11px !important;
      }

      body.hha-race-mobile-waiting .roomState{
        font-size:13px !important;
        line-height:1.35 !important;
      }

      body.hha-race-mobile-waiting .infoList{
        gap:8px !important;
        margin-top:9px !important;
      }

      body.hha-race-mobile-waiting .infoItem{
        padding:9px !important;
        border-radius:15px !important;
        font-size:11px !important;
        line-height:1.35 !important;
      }

      body.hha-race-mobile-waiting .infoIcon{
        font-size:17px !important;
      }

      body.hha-race-mobile-waiting .playersWrap{
        max-height:none !important;
        gap:8px !important;
        overflow:visible !important;
        padding-right:0 !important;
      }

      body.hha-race-mobile-waiting .player{
        padding:10px !important;
        border-radius:17px !important;
        gap:8px !important;
      }

      body.hha-race-mobile-waiting .avatar{
        width:38px !important;
        height:38px !important;
        min-width:38px !important;
        border-radius:13px !important;
        font-size:21px !important;
      }

      body.hha-race-mobile-waiting .name{
        font-size:15px !important;
      }

      body.hha-race-mobile-waiting .tag{
        font-size:10px !important;
        line-height:1.25 !important;
      }

      body.hha-race-mobile-waiting .right{
        min-width:58px !important;
        min-height:30px !important;
        padding:0 9px !important;
        font-size:11px !important;
      }

      body.hha-race-mobile-waiting #hhaRaceInlineForceBanner,
      body.hha-race-mobile-waiting .hha-race-safe-banner,
      body.hha-race-mobile-waiting .hha-race-capacity-banner{
        width:calc(100vw - 18px) !important;
        bottom:calc(8px + env(safe-area-inset-bottom,0px)) !important;
        padding:9px 11px !important;
        border-radius:16px !important;
        font-size:11px !important;
        line-height:1.25 !important;
      }

      @media (orientation:landscape) and (max-height:520px){
        body.hha-race-mobile-waiting .page{
          padding:
            calc(6px + env(safe-area-inset-top,0px))
            calc(8px + env(safe-area-inset-right,0px))
            calc(58px + env(safe-area-inset-bottom,0px))
            calc(8px + env(safe-area-inset-left,0px)) !important;
        }

        body.hha-race-mobile-waiting .topbar{
          grid-template-columns:1fr auto !important;
          align-items:center !important;
        }

        body.hha-race-mobile-waiting .topActions{
          width:auto !important;
          min-width:300px !important;
          grid-template-columns:repeat(3,1fr) !important;
        }

        body.hha-race-mobile-waiting .brand{
          min-height:54px !important;
        }

        body.hha-race-mobile-waiting .heroGrid{
          grid-template-columns:.82fr 1.18fr !important;
          align-items:start !important;
        }

        body.hha-race-mobile-waiting .count{
          width:min(150px,28vw) !important;
          height:min(150px,28vw) !important;
          font-size:52px !important;
        }

        body.hha-race-mobile-waiting .countCard{
          min-height:300px !important;
        }

        body.hha-race-mobile-waiting .infoList{
          display:none !important;
        }

        body.hha-race-mobile-waiting .metaValue{
          font-size:22px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function isMobileLike(){
    return (
      window.innerWidth <= 820 ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
    );
  }

  function scan(){
    if (isMobileLike()) {
      document.body.classList.add('hha-race-mobile-waiting');
      document.documentElement.classList.add('hha-race-mobile-waiting');
    }
  }

  function boot(){
    addStyle();
    scan();

    window.addEventListener('resize', function(){
      setTimeout(scan, 80);
      setTimeout(scan, 300);
    }, { passive:true });

    window.addEventListener('orientationchange', function(){
      setTimeout(scan, 250);
      setTimeout(scan, 800);
    }, { passive:true });

    [80, 200, 500, 1000, 1800].forEach(function(ms){
      setTimeout(scan, ms);
    });

    console.info('[Groups Race Mobile Waiting Fix]', PATCH_ID, 'ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();