/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260523-groups-solo-cvr-clear-stage-17
   File: /herohealth/patches/groups/17-groups-solo-cvr-clear-stage.js

   Purpose:
   - Fix cVR blank/empty stage after patch 16
   - Remove bad cVR layout 16 if loaded
   - Force stage/playfield/gates into visible viewport
   - cVR = no scroll, crosshair + tap-to-shoot
   - Keep PC/Mobile untouched
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260523-groups-solo-cvr-clear-stage-17';

  if (window.__HHA_GROUPS_SOLO_CVR_CLEAR_STAGE_17__) return;
  window.__HHA_GROUPS_SOLO_CVR_CLEAR_STAGE_17__ = true;

  var qs = new URLSearchParams(location.search);
  var view = String(qs.get('view') || '').toLowerCase();

  var isCvr =
    view === 'cvr' ||
    view === 'cardboard' ||
    view === 'cardboard-vr' ||
    view === 'vr' ||
    qs.get('cvr') === '1' ||
    qs.get('vr') === '1';

  if (!isCvr) {
    console.info('[Groups cVR Clear Stage 17]', PATCH_ID, 'skipped view=' + view);
    return;
  }

  function textOf(el){
    return String(el && (el.innerText || el.textContent || '') || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isPlaying(){
    return (
      document.body.classList.contains('isPlaying') ||
      document.body.classList.contains('hha-groups-gameplay-active') ||
      qs.get('run') === 'play'
    ) && !document.body.classList.contains('summaryOpen');
  }

  function removeBadPatch16(){
    var bad = document.getElementById('hha-groups-cvr-playable-layout-16-style');
    if (bad) bad.remove();

    document.documentElement.classList.remove('hha-cvr-playable');
    document.body.classList.remove('hha-cvr-playable');
  }

  function addStyle(){
    if (document.getElementById('hha-groups-cvr-clear-stage-17-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-groups-cvr-clear-stage-17-style';
    style.textContent = `
      html.hha-cvr-clear-stage,
      body.hha-cvr-clear-stage{
        width:100% !important;
        height:100% !important;
        overflow:hidden !important;
        touch-action:none !important;
        overscroll-behavior:none !important;
      }

      body.hha-cvr-clear-stage .game{
        position:relative !important;
        width:100vw !important;
        height:100dvh !important;
        overflow:hidden !important;
        padding:0 !important;
        margin:0 !important;
        display:block !important;
      }

      body.hha-cvr-clear-stage .topHud{
        position:fixed !important;
        top:4px !important;
        left:6px !important;
        right:6px !important;
        height:50px !important;
        min-height:50px !important;
        z-index:50 !important;
        display:grid !important;
        grid-template-columns:minmax(210px,1fr) auto !important;
        gap:5px !important;
        overflow:hidden !important;
        pointer-events:none !important;
      }

      body.hha-cvr-clear-stage .brand{
        min-width:0 !important;
        border-radius:16px !important;
        padding:4px 7px !important;
        gap:6px !important;
        overflow:hidden !important;
      }

      body.hha-cvr-clear-stage .brandIcon{
        width:34px !important;
        height:34px !important;
        border-radius:12px !important;
        font-size:20px !important;
      }

      body.hha-cvr-clear-stage .brand h1{
        font-size:.96rem !important;
        line-height:1 !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-clear-stage .brand p{
        font-size:.52rem !important;
        margin-top:2px !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-clear-stage .stats{
        display:grid !important;
        grid-template-columns:repeat(5,46px) !important;
        gap:4px !important;
        pointer-events:none !important;
      }

      body.hha-cvr-clear-stage .stat{
        width:46px !important;
        min-width:0 !important;
        border-radius:12px !important;
        padding:3px 2px !important;
        overflow:hidden !important;
      }

      body.hha-cvr-clear-stage .stat small{
        font-size:.46rem !important;
        line-height:1 !important;
      }

      body.hha-cvr-clear-stage .stat b{
        font-size:.70rem !important;
        line-height:1 !important;
      }

      body.hha-cvr-clear-stage .stage{
        position:fixed !important;
        top:58px !important;
        left:6px !important;
        right:6px !important;
        bottom:86px !important;
        min-height:0 !important;
        height:auto !important;
        z-index:20 !important;
        display:block !important;
        visibility:visible !important;
        opacity:1 !important;
        overflow:hidden !important;
        border-radius:18px !important;
      }

      body.hha-cvr-clear-stage .waveHud{
        position:absolute !important;
        top:0 !important;
        left:0 !important;
        right:0 !important;
        height:42px !important;
        z-index:35 !important;
        padding:4px 7px !important;
        pointer-events:none !important;
        overflow:hidden !important;
      }

      body.hha-cvr-clear-stage .waveTitle{
        font-size:.82rem !important;
        line-height:1 !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-clear-stage .waveSub{
        margin-top:2px !important;
        font-size:.50rem !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-clear-stage .chips{
        gap:3px !important;
        flex-wrap:nowrap !important;
      }

      body.hha-cvr-clear-stage .chip{
        min-height:18px !important;
        padding:2px 5px !important;
        font-size:.46rem !important;
      }

      body.hha-cvr-clear-stage .playfield{
        position:absolute !important;
        top:42px !important;
        left:0 !important;
        right:0 !important;
        bottom:0 !important;
        min-height:0 !important;
        height:auto !important;
        z-index:21 !important;
        display:block !important;
        visibility:visible !important;
        opacity:1 !important;
        overflow:hidden !important;
      }

      body.hha-cvr-clear-stage .actorLayer{
        position:absolute !important;
        inset:0 !important;
        z-index:30 !important;
        display:block !important;
        visibility:visible !important;
        opacity:1 !important;
        pointer-events:auto !important;
      }

      body.hha-cvr-clear-stage .floor,
      body.hha-cvr-clear-stage .floorLine{
        position:absolute !important;
        left:0 !important;
        right:0 !important;
        bottom:4px !important;
        height:8px !important;
        z-index:22 !important;
      }

      body.hha-cvr-clear-stage .food,
      body.hha-cvr-clear-stage .foodActor{
        width:76px !important;
        height:76px !important;
        border-width:3px !important;
        z-index:42 !important;
        pointer-events:auto !important;
      }

      body.hha-cvr-clear-stage .food .emoji,
      body.hha-cvr-clear-stage .foodActor .emoji{
        font-size:38px !important;
      }

      body.hha-cvr-clear-stage .food .name,
      body.hha-cvr-clear-stage .foodActor .name{
        max-width:72px !important;
        bottom:3px !important;
        padding:2px 5px !important;
        font-size:.52rem !important;
        overflow:hidden !important;
        white-space:nowrap !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-clear-stage .gates{
        position:fixed !important;
        left:6px !important;
        right:6px !important;
        bottom:30px !important;
        height:52px !important;
        z-index:70 !important;
        display:grid !important;
        grid-template-columns:repeat(5,minmax(0,1fr)) !important;
        gap:4px !important;
        padding:0 !important;
        visibility:visible !important;
        opacity:1 !important;
        pointer-events:auto !important;
      }

      body.hha-cvr-clear-stage .gate{
        min-height:52px !important;
        height:52px !important;
        border-radius:14px !important;
        border-width:2px !important;
        padding:3px !important;
        overflow:hidden !important;
        pointer-events:auto !important;
      }

      body.hha-cvr-clear-stage .gate .num{
        width:20px !important;
        height:20px !important;
        border-radius:8px !important;
        font-size:.62rem !important;
      }

      body.hha-cvr-clear-stage .gate .label{
        font-size:.52rem !important;
        line-height:1 !important;
        margin-top:1px !important;
      }

      body.hha-cvr-clear-stage .gate .ex{
        display:none !important;
      }

      body.hha-cvr-clear-stage .bottomBar{
        position:fixed !important;
        left:6px !important;
        right:6px !important;
        bottom:0 !important;
        height:26px !important;
        min-height:26px !important;
        z-index:68 !important;
        display:block !important;
        overflow:hidden !important;
        pointer-events:none !important;
      }

      body.hha-cvr-clear-stage .feedback{
        min-height:24px !important;
        border-radius:999px !important;
        padding:3px 8px !important;
        font-size:.52rem !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-clear-stage .navs,
      body.hha-cvr-clear-stage #btnTeacher,
      body.hha-cvr-clear-stage #btnHowto,
      body.hha-cvr-clear-stage .teacher,
      body.hha-cvr-clear-stage .howto{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-cvr-clear-stage #startOverlay{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-cvr-clear-stage #summaryOverlay.hidden{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-cvr-clear-stage #summaryOverlay{
        z-index:200 !important;
        touch-action:pan-y !important;
        overflow-y:auto !important;
      }

      body.hha-cvr-clear-stage #btnPowerSort:disabled{
        display:none !important;
      }

      body.hha-cvr-clear-stage #btnPowerSort:not(:disabled){
        transform:scale(.55) !important;
        transform-origin:left bottom !important;
        left:6px !important;
        bottom:58px !important;
        opacity:.72 !important;
        z-index:65 !important;
      }

      body.hha-cvr-clear-stage .toast{
        left:50% !important;
        top:4px !important;
        bottom:auto !important;
        transform:translateX(-50%) scale(.66) !important;
        transform-origin:top center !important;
        max-width:min(360px,58vw) !important;
        min-width:auto !important;
        padding:5px 8px !important;
        font-size:.55rem !important;
        opacity:.78 !important;
        z-index:90 !important;
      }

      body.hha-cvr-clear-stage .coach,
      body.hha-cvr-clear-stage .coachCue{
        transform:translate(-50%,-50%) scale(.58) !important;
        opacity:.45 !important;
        pointer-events:none !important;
        z-index:64 !important;
      }

      body.hha-cvr-clear-stage .miniHud{
        top:62px !important;
        transform:scale(.62) !important;
        opacity:.58 !important;
        pointer-events:none !important;
        z-index:62 !important;
      }

      body.hha-cvr-clear-stage .objective{
        left:6px !important;
        transform-origin:top left !important;
      }

      body.hha-cvr-clear-stage .phase{
        right:6px !important;
        transform-origin:top right !important;
      }

      body.hha-cvr-clear-stage .cvrCross{
        display:block !important;
        z-index:150 !important;
        width:40px !important;
        height:40px !important;
      }

      body.hha-cvr-clear-stage .cvrHint{
        top:calc(50% + 32px) !important;
        z-index:151 !important;
        width:min(360px,56vw) !important;
        min-width:auto !important;
        padding:4px 8px !important;
        font-size:.52rem !important;
        opacity:.78 !important;
        pointer-events:none !important;
      }

      .hha-cvr-clear-help{
        position:fixed;
        left:50%;
        top:calc(50% + 56px);
        transform:translateX(-50%);
        z-index:152;
        width:min(430px,66vw);
        padding:5px 9px;
        border-radius:999px;
        background:rgba(255,255,255,.88);
        border:1px solid rgba(214,237,247,.96);
        color:#397b9c;
        text-align:center;
        font:900 10px/1.25 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 10px 24px rgba(47,149,255,.14);
        pointer-events:none;
      }

      body.summaryOpen .hha-cvr-clear-help{
        display:none !important;
      }

      @media (max-height:620px){
        body.hha-cvr-clear-stage .topHud{
          height:42px !important;
        }

        body.hha-cvr-clear-stage .brandIcon{
          width:30px !important;
          height:30px !important;
          font-size:18px !important;
        }

        body.hha-cvr-clear-stage .brand h1{
          font-size:.82rem !important;
        }

        body.hha-cvr-clear-stage .brand p{
          font-size:.46rem !important;
        }

        body.hha-cvr-clear-stage .stats{
          grid-template-columns:repeat(5,42px) !important;
        }

        body.hha-cvr-clear-stage .stat{
          width:42px !important;
        }

        body.hha-cvr-clear-stage .stage{
          top:48px !important;
          bottom:76px !important;
        }

        body.hha-cvr-clear-stage .waveHud{
          height:34px !important;
        }

        body.hha-cvr-clear-stage .playfield{
          top:34px !important;
        }

        body.hha-cvr-clear-stage .food,
        body.hha-cvr-clear-stage .foodActor{
          width:60px !important;
          height:60px !important;
        }

        body.hha-cvr-clear-stage .food .emoji,
        body.hha-cvr-clear-stage .foodActor .emoji{
          font-size:30px !important;
        }

        body.hha-cvr-clear-stage .gates{
          bottom:26px !important;
          height:46px !important;
        }

        body.hha-cvr-clear-stage .gate{
          min-height:46px !important;
          height:46px !important;
        }

        body.hha-cvr-clear-stage .gate .label{
          font-size:.46rem !important;
        }

        body.hha-cvr-clear-stage .bottomBar{
          height:24px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function mark(){
    document.documentElement.classList.add('hha-cvr-clear-stage');
    document.body.classList.add('hha-cvr-clear-stage');
    document.body.classList.add('view-cvr');
    document.body.dataset.hhaView = 'cvr';

    if (qs.get('run') === 'play' || qs.get('autostart') === '1' || qs.get('direct') === '1') {
      document.body.classList.add('hha-groups-gameplay-active');
    }
  }

  function ensureHelp(){
    if (document.querySelector('.hha-cvr-clear-help')) return;

    var pill = document.createElement('div');
    pill.className = 'hha-cvr-clear-help';
    pill.textContent = 'cVR: ไม่ต้องเลื่อนจอ • เล็งอาหารแล้วแตะ • เล็งประตูหมู่ 1–5 แล้วแตะ';
    document.body.appendChild(pill);

    setTimeout(function(){
      pill.style.opacity = '.55';
    }, 7000);
  }

  function hideBlockers(){
    if (!isPlaying()) return;

    var startOverlay = document.getElementById('startOverlay');
    if (startOverlay) {
      startOverlay.classList.add('hidden');
      startOverlay.style.display = 'none';
    }

    var summaryOverlay = document.getElementById('summaryOverlay');
    if (summaryOverlay && !document.body.classList.contains('summaryOpen')) {
      summaryOverlay.classList.add('hidden');
      summaryOverlay.style.display = 'none';
    }

    ['btnTeacher','btnHowto'].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    });

    var navs = document.querySelector('.navs');
    if (navs) {
      navs.style.display = 'none';
      navs.style.visibility = 'hidden';
      navs.style.opacity = '0';
      navs.style.pointerEvents = 'none';
    }

    Array.prototype.slice.call(document.querySelectorAll('main,section,article,div')).forEach(function(el){
      var t = textOf(el);

      if (
        t.indexOf('สรุปเสริม Groups Solo') >= 0 ||
        (t.indexOf('Keep Trying') >= 0 && t.indexOf('Mission') >= 0)
      ) {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.setAttribute('data-hha-cvr-clear-hidden-extra-summary', PATCH_ID);
      }
    });
  }

  function bindTapShoot(){
    if (document.__hhaGroupsCvrClearTapShoot17Bound) return;
    document.__hhaGroupsCvrClearTapShoot17Bound = true;

    document.addEventListener('click', function(ev){
      if (!isPlaying()) return;
      if (document.body.classList.contains('summaryOpen')) return;

      var target = ev.target;

      if (
        target &&
        target.closest &&
        target.closest('#summaryOverlay,#startOverlay,.navs,#btnTeacher,#btnHowto,.drawer')
      ) {
        return;
      }

      try {
        document.dispatchEvent(new CustomEvent('hha:shoot', {
          detail:{
            source:'cvr-clear-stage-17',
            patch:PATCH_ID
          }
        }));
      } catch(e) {}
    }, true);
  }

  function scan(){
    removeBadPatch16();
    mark();
    ensureHelp();
    hideBlockers();
  }

  function boot(){
    addStyle();
    bindTapShoot();
    scan();

    [80,180,360,700,1200,2000,3500,5500,8000].forEach(function(ms){
      setTimeout(scan, ms);
    });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_CVR_CLEAR_STAGE_17_SCAN__);
      window.__HHA_CVR_CLEAR_STAGE_17_SCAN__ = setTimeout(scan, 50);
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
      view:view,
      width:window.innerWidth,
      height:window.innerHeight
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
