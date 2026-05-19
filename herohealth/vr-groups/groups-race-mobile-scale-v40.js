// === /herohealth/vr-groups/groups-race-mobile-scale-v40.js ===
// HeroHealth • Groups Race Mobile Scale Fix
// PATCH v20260519-GROUPS-RACE-V40-MOBILE-SCALE
// Fix:
// - เป้า/การ์ดอาหารใหญ่เกินบน mobile
// - Summary / Leaderboard ใหญ่เกิน
// - ลด vertical space ให้เห็น gameplay มากขึ้น

(function () {
  'use strict';

  const VERSION = 'v20260519-groups-race-v40-mobile-scale';

  if (window.__HHA_GROUPS_RACE_MOBILE_SCALE_V40__) return;
  window.__HHA_GROUPS_RACE_MOBILE_SCALE_V40__ = true;

  function injectStyle() {
    if (document.getElementById('groups-race-mobile-scale-v40-style')) return;

    const style = document.createElement('style');
    style.id = 'groups-race-mobile-scale-v40-style';
    style.textContent = `
      /* =========================
         Mobile / touch scale fix
      ========================== */

      @media (pointer:coarse), (max-width:820px){
        .race-page{
          padding:
            calc(6px + env(safe-area-inset-top,0px))
            6px
            calc(10px + env(safe-area-inset-bottom,0px)) !important;
        }

        .race-top{
          margin-bottom:6px !important;
          gap:6px !important;
        }

        .race-brand{
          padding:8px 10px !important;
          border-radius:18px !important;
          gap:8px !important;
        }

        .race-mark{
          width:42px !important;
          height:42px !important;
          border-radius:14px !important;
          font-size:22px !important;
        }

        .race-brand h1{
          font-size:22px !important;
          line-height:1.02 !important;
        }

        .race-brand p{
          margin-top:2px !important;
          font-size:11px !important;
          line-height:1.25 !important;
        }

        .race-actions{
          gap:6px !important;
        }

        .race-btn{
          min-height:40px !important;
          border-radius:15px !important;
          padding:0 12px !important;
          font-size:13px !important;
        }

        .race-layout{
          grid-template-columns:1fr !important;
          gap:8px !important;
        }

        .race-main-card,
        .race-side-card{
          border-radius:20px !important;
          padding:9px !important;
        }

        .race-status-row{
          gap:5px !important;
          margin-bottom:6px !important;
        }

        .race-chip{
          min-height:30px !important;
          padding:0 9px !important;
          font-size:11px !important;
        }

        .race-hud{
          grid-template-columns:repeat(4,minmax(0,1fr)) !important;
          gap:5px !important;
          margin-bottom:6px !important;
        }

        .hud-card{
          border-radius:14px !important;
          padding:7px 4px !important;
        }

        .hud-card span{
          font-size:10px !important;
        }

        .hud-card b{
          margin-top:2px !important;
          font-size:18px !important;
        }

        .mission-box{
          border-radius:16px !important;
          padding:8px !important;
          margin-bottom:6px !important;
          font-size:12px !important;
        }

        .mission-bar{
          height:7px !important;
          margin-top:5px !important;
        }

        .item-stage{
          min-height:190px !important;
          border-radius:20px !important;
          margin-bottom:7px !important;
        }

        .time-bar{
          left:10px !important;
          right:10px !important;
          top:8px !important;
          height:8px !important;
        }

        /*
          จุดสำคัญ:
          ลด “เป้า/การ์ดอาหาร” บน mobile
        */
        .item-card{
          width:clamp(128px,38vw,180px) !important;
          max-width:180px !important;
          border-radius:24px !important;
          padding:10px !important;
          box-shadow:0 14px 36px rgba(0,0,0,.22) !important;
        }

        .item-icon{
          font-size:clamp(46px,14vw,74px) !important;
        }

        .item-kind{
          margin-top:4px !important;
          font-size:12px !important;
          letter-spacing:.04em !important;
        }

        .item-hint{
          margin-top:3px !important;
          font-size:10px !important;
          line-height:1.2 !important;
        }

        .group-grid{
          grid-template-columns:repeat(5,minmax(0,1fr)) !important;
          gap:5px !important;
        }

        .group-btn{
          min-height:68px !important;
          border-radius:15px !important;
          padding:5px 3px !important;
        }

        .group-id{
          width:21px !important;
          height:21px !important;
          font-size:10px !important;
          margin-bottom:1px !important;
        }

        .group-icon{
          font-size:19px !important;
        }

        .group-btn b{
          margin-top:2px !important;
          font-size:10px !important;
          line-height:1.05 !important;
        }

        .group-btn small{
          margin-top:1px !important;
          font-size:8px !important;
          line-height:1.05 !important;
        }

        .race-toast{
          min-width:min(300px,82vw) !important;
          padding:10px 14px !important;
          font-size:18px !important;
        }

        .race-help{
          display:none !important;
        }

        .side-title h2{
          font-size:18px !important;
        }

        #syncStatus{
          min-height:28px !important;
          font-size:11px !important;
          padding:0 9px !important;
        }

        .leaderboard{
          gap:6px !important;
        }

        .board-row{
          border-radius:15px !important;
          padding:8px !important;
        }

        .place{
          width:28px !important;
          height:28px !important;
          border-radius:10px !important;
        }

        .board-left{
          gap:8px !important;
        }

        .board-left b{
          font-size:14px !important;
          max-width:160px !important;
        }

        .board-left small,
        .board-score small{
          font-size:10px !important;
        }

        .board-score b{
          font-size:18px !important;
        }

        /* Summary mobile */
        .race-summary{
          min-height:auto !important;
          padding:12px 4px 18px !important;
        }

        .summary-icon{
          width:68px !important;
          height:68px !important;
          border-radius:22px !important;
          font-size:36px !important;
          margin-bottom:8px !important;
        }

        .race-summary h2{
          font-size:38px !important;
        }

        .race-summary p{
          margin-top:6px !important;
          font-size:13px !important;
        }

        .summary-grid{
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          gap:7px !important;
          margin:14px auto !important;
        }

        .summary-grid div{
          border-radius:17px !important;
          padding:11px 6px !important;
        }

        .summary-grid b{
          font-size:32px !important;
        }

        .summary-grid span{
          margin-top:4px !important;
          font-size:10px !important;
        }
      }

      /* มือถือแนวนอน / จอเตี้ยมาก */
      @media (pointer:coarse) and (max-height:540px){
        .race-brand h1{
          font-size:19px !important;
        }

        .race-brand p{
          display:none !important;
        }

        .race-main-card{
          padding:7px !important;
        }

        .race-status-row{
          margin-bottom:4px !important;
        }

        .item-stage{
          min-height:150px !important;
        }

        .item-card{
          width:clamp(108px,27vw,145px) !important;
          max-width:145px !important;
          border-radius:20px !important;
          padding:8px !important;
        }

        .item-icon{
          font-size:clamp(38px,10vw,58px) !important;
        }

        .group-grid{
          gap:4px !important;
        }

        .group-btn{
          min-height:54px !important;
          border-radius:13px !important;
        }

        .group-icon{
          font-size:16px !important;
        }

        .group-btn b{
          font-size:9px !important;
        }

        .group-btn small{
          display:none !important;
        }
      }

      /* จอเล็กมาก */
      @media (max-width:420px){
        .race-hud{
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
        }

        .group-grid{
          grid-template-columns:repeat(5,minmax(0,1fr)) !important;
        }

        .item-card{
          width:clamp(118px,42vw,158px) !important;
        }

        .group-btn{
          min-height:62px !important;
        }

        .group-icon{
          font-size:17px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function markVersion() {
    window.HHA_GROUPS_RACE_MOBILE_SCALE_V40 = {
      version: VERSION,
      installedAt: new Date().toISOString()
    };
    console.info('[Groups Race v4.0] mobile scale patch installed', VERSION);
  }

  function init() {
    injectStyle();
    markVersion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
