/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260523-groups-solo-pc-spacious-layout-14
   File: /herohealth/patches/groups/14-groups-solo-pc-spacious-layout.js

   Purpose:
   - Make PC gameplay actually playable
   - Fix cramped PC layout when browser/devtools narrows viewport
   - Hide navigation buttons during gameplay
   - Hide premature "summary booster" panel during active play
   - Keep Mobile flow untouched
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260523-groups-solo-pc-spacious-layout-14';

  if (window.__HHA_GROUPS_SOLO_PC_SPACIOUS_LAYOUT_14__) return;
  window.__HHA_GROUPS_SOLO_PC_SPACIOUS_LAYOUT_14__ = true;

  var qs = new URLSearchParams(location.search);
  var view = String(qs.get('view') || '').toLowerCase();

  if (view !== 'pc') {
    console.info('[Groups PC Layout 14]', PATCH_ID, 'skipped: view=' + view);
    return;
  }

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function textOf(el){
    return String(el && (el.innerText || el.textContent || '') || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function addStyle(){
    if (document.getElementById('hha-groups-pc-spacious-layout-14-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-groups-pc-spacious-layout-14-style';
    style.textContent = `
      html.hha-groups-pc-spacious,
      body.hha-groups-pc-spacious{
        width:100% !important;
        height:100% !important;
        overflow:hidden !important;
      }

      body.hha-groups-pc-spacious .game{
        width:100vw !important;
        height:100dvh !important;
        display:grid !important;
        grid-template-rows:64px minmax(0,1fr) 42px !important;
        gap:5px !important;
        padding:6px 8px !important;
        overflow:hidden !important;
      }

      body.hha-groups-pc-spacious .topHud{
        height:64px !important;
        min-height:64px !important;
        display:grid !important;
        grid-template-columns:minmax(240px,1fr) auto !important;
        gap:6px !important;
        align-items:stretch !important;
        overflow:hidden !important;
      }

      body.hha-groups-pc-spacious .brand{
        min-width:0 !important;
        border-radius:20px !important;
        padding:6px 9px !important;
        gap:8px !important;
        overflow:hidden !important;
      }

      body.hha-groups-pc-spacious .brandIcon{
        width:42px !important;
        height:42px !important;
        border-radius:16px !important;
        font-size:25px !important;
      }

      body.hha-groups-pc-spacious .brand h1{
        font-size:clamp(1.18rem,2.1vw,1.8rem) !important;
        line-height:1 !important;
        max-width:100% !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-groups-pc-spacious .brand p{
        font-size:.70rem !important;
        margin-top:2px !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-groups-pc-spacious .stats{
        display:grid !important;
        grid-template-columns:repeat(5,64px) !important;
        gap:5px !important;
        align-items:stretch !important;
      }

      body.hha-groups-pc-spacious .stat{
        min-width:0 !important;
        width:64px !important;
        border-radius:16px !important;
        padding:5px 4px !important;
        overflow:hidden !important;
      }

      body.hha-groups-pc-spacious .stat small{
        font-size:.55rem !important;
        line-height:1.05 !important;
      }

      body.hha-groups-pc-spacious .stat b{
        font-size:.92rem !important;
        line-height:1.05 !important;
      }

      body.hha-groups-pc-spacious .stage{
        min-height:0 !important;
        border-radius:22px !important;
        display:grid !important;
        grid-template-rows:58px minmax(0,1fr) 88px !important;
        overflow:hidden !important;
      }

      body.hha-groups-pc-spacious .waveHud{
        height:58px !important;
        padding:7px 10px !important;
        gap:6px !important;
        pointer-events:none !important;
        overflow:hidden !important;
      }

      body.hha-groups-pc-spacious .waveTitle{
        font-size:clamp(.92rem,1.7vw,1.28rem) !important;
        line-height:1.05 !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-groups-pc-spacious .waveSub{
        margin-top:3px !important;
        font-size:.68rem !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-groups-pc-spacious .chips{
        gap:4px !important;
        flex-wrap:nowrap !important;
      }

      body.hha-groups-pc-spacious .chip{
        min-height:24px !important;
        padding:3px 7px !important;
        font-size:.62rem !important;
        white-space:nowrap !important;
      }

      body.hha-groups-pc-spacious .playfield{
        min-height:0 !important;
        padding-bottom:0 !important;
        overflow:hidden !important;
      }

      body.hha-groups-pc-spacious .actorLayer{
        top:0 !important;
        left:0 !important;
        right:0 !important;
        bottom:0 !important;
        z-index:18 !important;
      }

      body.hha-groups-pc-spacious .floor,
      body.hha-groups-pc-spacious .floorLine{
        bottom:4px !important;
      }

      body.hha-groups-pc-spacious .gates{
        position:relative !important;
        left:auto !important;
        right:auto !important;
        bottom:auto !important;
        display:grid !important;
        grid-template-columns:repeat(5,minmax(0,1fr)) !important;
        gap:6px !important;
        padding:5px 8px 8px !important;
        z-index:55 !important;
      }

      body.hha-groups-pc-spacious .gate{
        min-height:74px !important;
        border-radius:18px !important;
        border-width:2px !important;
        padding:4px !important;
      }

      body.hha-groups-pc-spacious .gate .num{
        width:28px !important;
        height:28px !important;
        border-radius:10px !important;
        font-size:.88rem !important;
      }

      body.hha-groups-pc-spacious .gate .label{
        font-size:.70rem !important;
        line-height:1.05 !important;
        margin-top:2px !important;
      }

      body.hha-groups-pc-spacious .gate .ex{
        display:none !important;
      }

      body.hha-groups-pc-spacious .food,
      body.hha-groups-pc-spacious .foodActor{
        width:72px !important;
        height:72px !important;
        border-width:3px !important;
      }

      body.hha-groups-pc-spacious .food .emoji,
      body.hha-groups-pc-spacious .foodActor .emoji{
        font-size:36px !important;
      }

      body.hha-groups-pc-spacious .food .name,
      body.hha-groups-pc-spacious .foodActor .name{
        font-size:.54rem !important;
        bottom:3px !important;
        padding:2px 5px !important;
        max-width:70px !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-groups-pc-spacious .miniHud{
        top:66px !important;
        width:min(230px,38vw) !important;
        transform:scale(.92) !important;
        transform-origin:top left !important;
      }

      body.hha-groups-pc-spacious .phase{
        right:8px !important;
        transform-origin:top right !important;
      }

      body.hha-groups-pc-spacious .objective{
        left:8px !important;
      }

      body.hha-groups-pc-spacious .bossOrder{
        top:68px !important;
        width:min(420px,72vw) !important;
      }

      body.hha-groups-pc-spacious .boss{
        top:4px !important;
        width:min(420px,78%) !important;
      }

      body.hha-groups-pc-spacious .bottomBar{
        min-height:42px !important;
        height:42px !important;
        display:grid !important;
        grid-template-columns:1fr !important;
        gap:0 !important;
        overflow:hidden !important;
      }

      body.hha-groups-pc-spacious .feedback{
        min-height:40px !important;
        border-radius:18px !important;
        padding:7px 10px !important;
        font-size:.78rem !important;
        overflow:hidden !important;
        white-space:nowrap !important;
        text-overflow:ellipsis !important;
      }

      body.hha-groups-pc-spacious.isPlaying .navs,
      body.hha-groups-pc-spacious.hha-groups-gameplay-active .navs,
      body.hha-groups-pc-spacious.hha-groups-direct-play-active .navs{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-groups-pc-spacious.isPlaying .teacher,
      body.hha-groups-pc-spacious.isPlaying .howto,
      body.hha-groups-pc-spacious.isPlaying #btnTeacher,
      body.hha-groups-pc-spacious.isPlaying #btnHowto,
      body.hha-groups-pc-spacious.hha-groups-gameplay-active .teacher,
      body.hha-groups-pc-spacious.hha-groups-gameplay-active .howto,
      body.hha-groups-pc-spacious.hha-groups-gameplay-active #btnTeacher,
      body.hha-groups-pc-spacious.hha-groups-gameplay-active #btnHowto{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-groups-pc-spacious.isPlaying .power,
      body.hha-groups-pc-spacious.hha-groups-gameplay-active .power{
        left:8px !important;
        bottom:50px !important;
        min-width:112px !important;
        min-height:38px !important;
        border-radius:16px !important;
        padding:5px 8px !important;
        grid-template-columns:26px 1fr !important;
        opacity:.88 !important;
      }

      body.hha-groups-pc-spacious .powerIcon{
        font-size:18px !important;
      }

      body.hha-groups-pc-spacious .powerText b{
        font-size:.68rem !important;
      }

      body.hha-groups-pc-spacious .powerText small{
        font-size:.52rem !important;
      }

      body.hha-groups-pc-spacious .coach,
      body.hha-groups-pc-spacious .coachCue{
        top:30% !important;
        width:min(320px,calc(100% - 28px)) !important;
        transform:translate(-50%,-50%) scale(.86) !important;
      }

      body.hha-groups-pc-spacious .combo,
      body.hha-groups-pc-spacious .orderToast{
        top:18% !important;
        width:min(340px,calc(100vw - 34px)) !important;
        min-width:auto !important;
        padding:7px 10px !important;
        font-size:.70rem !important;
      }

      body.hha-groups-pc-spacious .toast{
        min-width:min(420px,calc(100vw - 28px)) !important;
        padding:9px 11px !important;
        font-size:.78rem !important;
      }

      /*
        ถ้าหน้ากว้างจริง ให้ขยายสนามอีก
      */
      @media (min-width:1180px){
        body.hha-groups-pc-spacious .game{
          grid-template-rows:76px minmax(0,1fr) 48px !important;
          padding:8px 12px !important;
          gap:8px !important;
        }

        body.hha-groups-pc-spacious .stage{
          grid-template-rows:68px minmax(0,1fr) 104px !important;
        }

        body.hha-groups-pc-spacious .food,
        body.hha-groups-pc-spacious .foodActor{
          width:86px !important;
          height:86px !important;
        }

        body.hha-groups-pc-spacious .food .emoji,
        body.hha-groups-pc-spacious .foodActor .emoji{
          font-size:43px !important;
        }

        body.hha-groups-pc-spacious .gate{
          min-height:88px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function markPcLayout(){
    document.documentElement.classList.add('hha-groups-pc-spacious');
    document.body.classList.add('hha-groups-pc-spacious');
    document.body.classList.add('view-pc');

    if (qs.get('run') === 'play' || qs.get('autostart') === '1' || qs.get('direct') === '1') {
      document.body.classList.add('hha-groups-gameplay-active');
    }
  }

  function hideEarlySummary(){
    var overlay = $('#summaryOverlay');

    if (overlay && !overlay.classList.contains('hidden') && !document.body.classList.contains('summaryOpen')) {
      overlay.classList.add('hidden');
      overlay.setAttribute('data-hha-pc-layout-hidden-early-summary', PATCH_ID);
    }

    $all('main,section,article,div').forEach(function(el){
      var t = textOf(el);

      if (
        t.indexOf('สรุปเสริม Groups Solo') >= 0 &&
        !document.body.classList.contains('summaryOpen')
      ) {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.setAttribute('data-hha-pc-layout-hidden-extra-summary', PATCH_ID);
      }
    });
  }

  function hideGameplayNav(){
    if (
      document.body.classList.contains('isPlaying') ||
      document.body.classList.contains('hha-groups-gameplay-active') ||
      qs.get('run') === 'play'
    ) {
      var navs = $('.navs');
      if (navs) {
        navs.style.display = 'none';
        navs.style.visibility = 'hidden';
        navs.style.opacity = '0';
        navs.style.pointerEvents = 'none';
      }

      ['btnTeacher','btnHowto'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        }
      });
    }
  }

  function scan(){
    markPcLayout();
    hideEarlySummary();
    hideGameplayNav();
  }

  function boot(){
    addStyle();
    scan();

    [80,180,360,700,1200,2000,3200,5000].forEach(function(ms){
      setTimeout(scan, ms);
    });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_PC_LAYOUT_14_SCAN__);
      window.__HHA_GROUPS_PC_LAYOUT_14_SCAN__ = setTimeout(scan, 60);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      characterData:true,
      attributeFilter:['class','style']
    });

    window.addEventListener('resize', function(){
      setTimeout(scan, 80);
    }, { passive:true });

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      view: view,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
