/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260523-groups-solo-cvr-playable-layout-16
   File: /herohealth/patches/groups/16-groups-solo-cvr-playable-layout.js

   Purpose:
   - Make Cardboard/cVR playable
   - No scrolling: cVR uses crosshair + tap-to-shoot
   - Shrink gates/food for cVR landscape
   - Hide Teacher / Howto / nav buttons during active cVR play
   - Add clear cVR instruction pill
   - Keep PC and Mobile untouched
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260523-groups-solo-cvr-playable-layout-16';

  if (window.__HHA_GROUPS_SOLO_CVR_PLAYABLE_LAYOUT_16__) return;
  window.__HHA_GROUPS_SOLO_CVR_PLAYABLE_LAYOUT_16__ = true;

  var qs = new URLSearchParams(location.search);
  var rawView = String(qs.get('view') || '').toLowerCase();

  var isCvr =
    rawView === 'cvr' ||
    rawView === 'cardboard' ||
    rawView === 'cardboard-vr' ||
    rawView === 'vr' ||
    qs.get('cvr') === '1' ||
    qs.get('vr') === '1';

  if (!isCvr) {
    console.info('[Groups cVR Layout 16]', PATCH_ID, 'skipped view=' + rawView);
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

  function isPlaying(){
    return (
      document.body.classList.contains('isPlaying') ||
      document.body.classList.contains('hha-groups-gameplay-active') ||
      qs.get('run') === 'play'
    ) && !document.body.classList.contains('summaryOpen');
  }

  function addStyle(){
    if (document.getElementById('hha-groups-cvr-playable-layout-16-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-groups-cvr-playable-layout-16-style';

    style.textContent = `
      html.hha-cvr-playable,
      body.hha-cvr-playable{
        width:100% !important;
        height:100% !important;
        overflow:hidden !important;
        touch-action:none !important;
        overscroll-behavior:none !important;
      }

      body.hha-cvr-playable .game{
        width:100vw !important;
        height:100dvh !important;
        display:grid !important;
        grid-template-rows:52px minmax(0,1fr) 32px !important;
        gap:4px !important;
        padding:4px 6px !important;
        overflow:hidden !important;
      }

      body.hha-cvr-playable .topHud{
        height:52px !important;
        min-height:52px !important;
        display:grid !important;
        grid-template-columns:minmax(220px,1fr) auto !important;
        gap:5px !important;
        overflow:hidden !important;
      }

      body.hha-cvr-playable .brand{
        border-radius:18px !important;
        padding:5px 7px !important;
        gap:7px !important;
        overflow:hidden !important;
        min-width:0 !important;
      }

      body.hha-cvr-playable .brandIcon{
        width:38px !important;
        height:38px !important;
        border-radius:14px !important;
        font-size:22px !important;
      }

      body.hha-cvr-playable .brand h1{
        font-size:1.05rem !important;
        line-height:1 !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-playable .brand p{
        font-size:.58rem !important;
        margin-top:2px !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-playable .stats{
        display:grid !important;
        grid-template-columns:repeat(5,52px) !important;
        gap:4px !important;
      }

      body.hha-cvr-playable .stat{
        min-width:0 !important;
        width:52px !important;
        border-radius:14px !important;
        padding:4px 3px !important;
        overflow:hidden !important;
      }

      body.hha-cvr-playable .stat small{
        font-size:.48rem !important;
        line-height:1 !important;
      }

      body.hha-cvr-playable .stat b{
        font-size:.74rem !important;
        line-height:1 !important;
      }

      body.hha-cvr-playable .stage{
        min-height:0 !important;
        border-radius:18px !important;
        overflow:hidden !important;
        display:grid !important;
        grid-template-rows:48px minmax(0,1fr) 74px !important;
      }

      body.hha-cvr-playable .waveHud{
        height:48px !important;
        padding:5px 7px !important;
        gap:5px !important;
        pointer-events:none !important;
        overflow:hidden !important;
      }

      body.hha-cvr-playable .waveTitle{
        font-size:.90rem !important;
        line-height:1.02 !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-playable .waveSub{
        margin-top:2px !important;
        font-size:.58rem !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-playable .chips{
        gap:3px !important;
        flex-wrap:nowrap !important;
      }

      body.hha-cvr-playable .chip{
        min-height:20px !important;
        padding:2px 6px !important;
        font-size:.52rem !important;
        white-space:nowrap !important;
      }

      body.hha-cvr-playable .playfield{
        min-height:0 !important;
        overflow:hidden !important;
        padding-bottom:0 !important;
      }

      body.hha-cvr-playable .actorLayer{
        inset:0 !important;
        bottom:0 !important;
        z-index:20 !important;
        pointer-events:auto !important;
      }

      body.hha-cvr-playable .floor,
      body.hha-cvr-playable .floorLine{
        bottom:4px !important;
        height:8px !important;
        z-index:19 !important;
      }

      body.hha-cvr-playable.view-cvr .food,
      body.hha-cvr-playable.view-cvr .foodActor,
      body.hha-cvr-playable .food,
      body.hha-cvr-playable .foodActor{
        width:78px !important;
        height:78px !important;
        border-width:3px !important;
        z-index:42 !important;
      }

      body.hha-cvr-playable.view-cvr .food .emoji,
      body.hha-cvr-playable.view-cvr .foodActor .emoji,
      body.hha-cvr-playable .food .emoji,
      body.hha-cvr-playable .foodActor .emoji{
        font-size:39px !important;
      }

      body.hha-cvr-playable .food .name,
      body.hha-cvr-playable .foodActor .name{
        font-size:.54rem !important;
        bottom:3px !important;
        padding:2px 5px !important;
        max-width:74px !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-playable .food.cvrAim,
      body.hha-cvr-playable .foodActor.cvrAim{
        box-shadow:
          0 0 0 5px rgba(97,187,255,.22),
          0 18px 42px rgba(97,187,255,.32) !important;
      }

      body.hha-cvr-playable .gates{
        position:relative !important;
        left:auto !important;
        right:auto !important;
        bottom:auto !important;
        z-index:65 !important;
        display:grid !important;
        grid-template-columns:repeat(5,minmax(0,1fr)) !important;
        gap:4px !important;
        padding:4px 5px 5px !important;
        pointer-events:auto !important;
      }

      body.hha-cvr-playable.view-cvr .gate,
      body.hha-cvr-playable .gate{
        min-height:64px !important;
        border-radius:15px !important;
        border-width:2px !important;
        padding:3px !important;
        overflow:hidden !important;
      }

      body.hha-cvr-playable .gate .num{
        width:24px !important;
        height:24px !important;
        border-radius:9px !important;
        font-size:.74rem !important;
      }

      body.hha-cvr-playable .gate .label{
        font-size:.62rem !important;
        line-height:1.02 !important;
        margin-top:1px !important;
      }

      body.hha-cvr-playable .gate .ex{
        display:none !important;
      }

      body.hha-cvr-playable .gate.cvrAim{
        transform:translateY(-2px) scale(1.02) !important;
        box-shadow:
          0 0 0 5px rgba(97,187,255,.22),
          0 18px 36px rgba(97,187,255,.26) !important;
      }

      body.hha-cvr-playable .miniHud{
        top:56px !important;
        width:min(210px,34vw) !important;
        transform:scale(.72) !important;
        opacity:.68 !important;
        pointer-events:none !important;
      }

      body.hha-cvr-playable .objective{
        left:6px !important;
        transform-origin:top left !important;
      }

      body.hha-cvr-playable .phase{
        right:6px !important;
        transform-origin:top right !important;
      }

      body.hha-cvr-playable .bossOrder{
        top:54px !important;
        width:min(340px,68vw) !important;
        transform:translateX(-50%) scale(.76) !important;
        transform-origin:top center !important;
      }

      body.hha-cvr-playable .boss{
        top:3px !important;
        width:min(360px,72vw) !important;
        transform:translateX(-50%) scale(.78) !important;
        transform-origin:top center !important;
      }

      body.hha-cvr-playable .bottomBar{
        height:32px !important;
        min-height:32px !important;
        display:block !important;
        overflow:hidden !important;
      }

      body.hha-cvr-playable .feedback{
        min-height:30px !important;
        border-radius:14px !important;
        padding:4px 8px !important;
        font-size:.62rem !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-playable.isPlaying .navs,
      body.hha-cvr-playable.hha-groups-gameplay-active .navs,
      body.hha-cvr-playable.isPlaying #btnTeacher,
      body.hha-cvr-playable.isPlaying #btnHowto,
      body.hha-cvr-playable.hha-groups-gameplay-active #btnTeacher,
      body.hha-cvr-playable.hha-groups-gameplay-active #btnHowto,
      body.hha-cvr-playable.isPlaying .teacher,
      body.hha-cvr-playable.isPlaying .howto,
      body.hha-cvr-playable.hha-groups-gameplay-active .teacher,
      body.hha-cvr-playable.hha-groups-gameplay-active .howto{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-cvr-playable.isPlaying #btnPowerSort:disabled,
      body.hha-cvr-playable.hha-groups-gameplay-active #btnPowerSort:disabled{
        display:none !important;
      }

      body.hha-cvr-playable.isPlaying #btnPowerSort:not(:disabled){
        transform:scale(.58) !important;
        transform-origin:left bottom !important;
        opacity:.70 !important;
        left:6px !important;
        bottom:34px !important;
        z-index:45 !important;
      }

      body.hha-cvr-playable .toast{
        left:50% !important;
        top:5px !important;
        bottom:auto !important;
        transform:translateX(-50%) translateY(-4px) scale(.72) !important;
        max-width:min(360px,64vw) !important;
        min-width:auto !important;
        padding:6px 9px !important;
        font-size:.62rem !important;
        opacity:.82 !important;
        z-index:74 !important;
      }

      body.hha-cvr-playable .toast.show{
        transform:translateX(-50%) translateY(0) scale(.72) !important;
      }

      body.hha-cvr-playable .coach,
      body.hha-cvr-playable .coachCue{
        transform:translate(-50%,-50%) scale(.62) !important;
        opacity:.50 !important;
        pointer-events:none !important;
        z-index:54 !important;
      }

      body.hha-cvr-playable .combo,
      body.hha-cvr-playable .orderToast{
        top:18% !important;
        width:min(300px,60vw) !important;
        min-width:auto !important;
        padding:6px 9px !important;
        font-size:.62rem !important;
        z-index:73 !important;
      }

      body.hha-cvr-playable .cvrCross{
        display:block !important;
        z-index:140 !important;
        width:42px !important;
        height:42px !important;
      }

      body.hha-cvr-playable .cvrCross:before{
        width:28px !important;
        height:3px !important;
      }

      body.hha-cvr-playable .cvrCross:after{
        width:3px !important;
        height:28px !important;
      }

      body.hha-cvr-playable .cvrRing{
        inset:4px !important;
        border-width:2px !important;
      }

      body.hha-cvr-playable .cvrHint{
        top:calc(50% + 34px) !important;
        min-width:auto !important;
        width:min(360px,62vw) !important;
        padding:5px 9px !important;
        font-size:.60rem !important;
        opacity:.86 !important;
        z-index:141 !important;
      }

      .hha-cvr-help-pill{
        position:fixed;
        left:50%;
        top:calc(50% + 64px);
        transform:translateX(-50%);
        z-index:142;
        width:min(470px,78vw);
        padding:6px 10px;
        border-radius:999px;
        background:rgba(255,255,255,.90);
        border:1px solid rgba(214,237,247,.98);
        color:#397b9c;
        text-align:center;
        font:900 11px/1.25 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 12px 28px rgba(47,149,255,.16);
        pointer-events:none;
      }

      body.summaryOpen .hha-cvr-help-pill{
        display:none !important;
      }

      body.hha-cvr-playable #summaryOverlay{
        touch-action:pan-y !important;
        overflow-y:auto !important;
      }

      /*
        ถ้าจอเตี้ยมาก เช่น browser landscape เปิดแถบเยอะ ให้บีบอีกนิด
      */
      @media (max-height:620px){
        body.hha-cvr-playable .game{
          grid-template-rows:44px minmax(0,1fr) 28px !important;
          gap:3px !important;
          padding:3px 5px !important;
        }

        body.hha-cvr-playable .topHud{
          height:44px !important;
          min-height:44px !important;
        }

        body.hha-cvr-playable .brandIcon{
          width:32px !important;
          height:32px !important;
          font-size:19px !important;
        }

        body.hha-cvr-playable .brand h1{
          font-size:.92rem !important;
        }

        body.hha-cvr-playable .brand p{
          font-size:.52rem !important;
        }

        body.hha-cvr-playable .stats{
          grid-template-columns:repeat(5,46px) !important;
        }

        body.hha-cvr-playable .stat{
          width:46px !important;
          border-radius:12px !important;
          padding:3px 2px !important;
        }

        body.hha-cvr-playable .stage{
          grid-template-rows:40px minmax(0,1fr) 58px !important;
        }

        body.hha-cvr-playable .waveHud{
          height:40px !important;
          padding:4px 6px !important;
        }

        body.hha-cvr-playable .waveTitle{
          font-size:.78rem !important;
        }

        body.hha-cvr-playable .waveSub{
          font-size:.50rem !important;
        }

        body.hha-cvr-playable .chip{
          min-height:18px !important;
          font-size:.46rem !important;
          padding:2px 5px !important;
        }

        body.hha-cvr-playable.view-cvr .food,
        body.hha-cvr-playable.view-cvr .foodActor,
        body.hha-cvr-playable .food,
        body.hha-cvr-playable .foodActor{
          width:62px !important;
          height:62px !important;
        }

        body.hha-cvr-playable.view-cvr .food .emoji,
        body.hha-cvr-playable.view-cvr .foodActor .emoji,
        body.hha-cvr-playable .food .emoji,
        body.hha-cvr-playable .foodActor .emoji{
          font-size:31px !important;
        }

        body.hha-cvr-playable.view-cvr .gate,
        body.hha-cvr-playable .gate{
          min-height:50px !important;
          border-radius:12px !important;
        }

        body.hha-cvr-playable .gate .num{
          width:20px !important;
          height:20px !important;
          font-size:.62rem !important;
        }

        body.hha-cvr-playable .gate .label{
          font-size:.52rem !important;
        }

        body.hha-cvr-playable .bottomBar{
          height:28px !important;
          min-height:28px !important;
        }

        body.hha-cvr-playable .feedback{
          min-height:26px !important;
          font-size:.54rem !important;
        }

        .hha-cvr-help-pill{
          top:calc(50% + 50px);
          font-size:10px;
          padding:5px 8px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function markCvr(){
    document.documentElement.classList.add('hha-cvr-playable');
    document.body.classList.add('hha-cvr-playable');
    document.body.classList.add('view-cvr');
    document.body.dataset.hhaView = 'cvr';

    if (qs.get('run') === 'play' || qs.get('autostart') === '1' || qs.get('direct') === '1') {
      document.body.classList.add('hha-groups-gameplay-active');
    }
  }

  function ensureHelpPill(){
    if (document.querySelector('.hha-cvr-help-pill')) return;

    var pill = document.createElement('div');
    pill.className = 'hha-cvr-help-pill';
    pill.textContent = 'Cardboard/cVR: ไม่ต้องเลื่อนจอ • มองอาหารแล้วแตะ • มองประตูหมู่ 1–5 แล้วแตะเพื่อส่ง';
    document.body.appendChild(pill);

    setTimeout(function(){
      try {
        pill.style.opacity = '.55';
      } catch(e) {}
    }, 6500);
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

    $all('main,section,article,div').forEach(function(el){
      var t = textOf(el);

      if (
        t.indexOf('สรุปเสริม Groups Solo') >= 0 ||
        (t.indexOf('Keep Trying') >= 0 && t.indexOf('Mission') >= 0)
      ) {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.setAttribute('data-hha-cvr-hidden-extra-summary', PATCH_ID);
      }
    });
  }

  function boostTapShoot(){
    if (document.__hhaGroupsCvrTapShoot16Bound) return;
    document.__hhaGroupsCvrTapShoot16Bound = true;

    document.addEventListener('click', function(ev){
      if (!isPlaying()) return;
      if (document.body.classList.contains('summaryOpen')) return;

      var target = ev.target;
      if (
        target &&
        target.closest &&
        target.closest('.bigBtn,.floatBtn,.navBtn,#summaryOverlay,#startOverlay,.drawer')
      ) {
        return;
      }

      /*
        ให้ cVR แตะตรงไหนก็เท่ากับ shoot จาก crosshair
        ตัวเกมเดิมมี handleCvrShoot อยู่ใน closure และฟัง event hha:shoot แล้ว
      */
      try {
        document.dispatchEvent(new CustomEvent('hha:shoot', {
          detail: {
            source: 'cvr-playable-layout-16',
            patch: PATCH_ID
          }
        }));
      } catch(e) {}
    }, true);
  }

  function scan(){
    markCvr();
    ensureHelpPill();
    hideBlockers();
  }

  function boot(){
    addStyle();
    boostTapShoot();
    scan();

    [80,180,360,700,1200,2000,3500,5500,8000].forEach(function(ms){
      setTimeout(scan, ms);
    });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_CVR_PLAYABLE_16_SCAN__);
      window.__HHA_CVR_PLAYABLE_16_SCAN__ = setTimeout(scan, 50);
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
      view: rawView,
      width: window.innerWidth,
      height: window.innerHeight
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
