/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260523-groups-solo-pc-unblock-playfield-15
   File: /herohealth/patches/groups/15-groups-solo-pc-unblock-playfield.js

   Purpose:
   - Fix PC gameplay blocked by overlays / floating buttons / old nav
   - Undo bad PC spacious layout patch if it exists
   - Keep Mobile untouched
   - Do NOT resize game aggressively
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260523-groups-solo-pc-unblock-playfield-15';

  if (window.__HHA_GROUPS_SOLO_PC_UNBLOCK_PLAYFIELD_15__) return;
  window.__HHA_GROUPS_SOLO_PC_UNBLOCK_PLAYFIELD_15__ = true;

  var qs = new URLSearchParams(location.search);
  var view = String(qs.get('view') || '').toLowerCase();

  if (view !== 'pc') {
    console.info('[Groups PC Unblock 15]', PATCH_ID, 'skipped view=' + view);
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

  function removeBadPatch14(){
    var badStyle = document.getElementById('hha-groups-pc-spacious-layout-14-style');
    if (badStyle) badStyle.remove();

    document.documentElement.classList.remove('hha-groups-pc-spacious');
    document.body.classList.remove('hha-groups-pc-spacious');
  }

  function addStyle(){
    if (document.getElementById('hha-groups-pc-unblock-playfield-15-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-groups-pc-unblock-playfield-15-style';
    style.textContent = `
      body.hha-pc-unblock-playfield .game{
        height:100dvh !important;
        width:100vw !important;
        overflow:hidden !important;
        padding:6px 8px !important;
        gap:6px !important;
      }

      body.hha-pc-unblock-playfield .stage{
        min-height:0 !important;
        overflow:hidden !important;
      }

      body.hha-pc-unblock-playfield .playfield{
        min-height:0 !important;
        overflow:hidden !important;
      }

      body.hha-pc-unblock-playfield .actorLayer{
        z-index:20 !important;
        pointer-events:auto !important;
      }

      body.hha-pc-unblock-playfield .food,
      body.hha-pc-unblock-playfield .foodActor{
        z-index:40 !important;
        pointer-events:auto !important;
      }

      body.hha-pc-unblock-playfield .gates{
        z-index:60 !important;
        pointer-events:auto !important;
      }

      body.hha-pc-unblock-playfield.isPlaying .navs,
      body.hha-pc-unblock-playfield.hha-groups-gameplay-active .navs,
      body.hha-pc-unblock-playfield.isPlaying #btnTeacher,
      body.hha-pc-unblock-playfield.isPlaying #btnHowto,
      body.hha-pc-unblock-playfield.hha-groups-gameplay-active #btnTeacher,
      body.hha-pc-unblock-playfield.hha-groups-gameplay-active #btnHowto{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-pc-unblock-playfield.isPlaying #summaryOverlay.hidden,
      body.hha-pc-unblock-playfield.hha-groups-gameplay-active #summaryOverlay.hidden{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-pc-unblock-playfield.isPlaying #startOverlay,
      body.hha-pc-unblock-playfield.hha-groups-gameplay-active #startOverlay{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-pc-unblock-playfield.isPlaying #btnPowerSort:disabled,
      body.hha-pc-unblock-playfield.hha-groups-gameplay-active #btnPowerSort:disabled{
        display:none !important;
      }

      body.hha-pc-unblock-playfield.isPlaying #btnPowerSort:not(:disabled){
        transform:scale(.72) !important;
        transform-origin:left bottom !important;
        opacity:.78 !important;
        left:8px !important;
        bottom:calc(44px + env(safe-area-inset-bottom,0px)) !important;
        z-index:45 !important;
      }

      body.hha-pc-unblock-playfield .toast{
        left:50% !important;
        top:8px !important;
        bottom:auto !important;
        transform:translateX(-50%) translateY(-8px) scale(.82) !important;
        max-width:min(460px,72vw) !important;
        min-width:auto !important;
        padding:8px 12px !important;
        font-size:.74rem !important;
        opacity:.82 !important;
        z-index:75 !important;
      }

      body.hha-pc-unblock-playfield .toast.show{
        transform:translateX(-50%) translateY(0) scale(.82) !important;
      }

      body.hha-pc-unblock-playfield.isPlaying .coach,
      body.hha-pc-unblock-playfield.isPlaying .coachCue{
        transform:translate(-50%,-50%) scale(.72) !important;
        opacity:.55 !important;
        pointer-events:none !important;
        z-index:55 !important;
      }

      body.hha-pc-unblock-playfield.isPlaying .miniHud{
        transform:scale(.82) !important;
        opacity:.72 !important;
        pointer-events:none !important;
      }

      body.hha-pc-unblock-playfield.isPlaying .objective{
        transform-origin:top left !important;
      }

      body.hha-pc-unblock-playfield.isPlaying .phase{
        transform-origin:top right !important;
      }

      /*
        เวลาเปิด DevTools จอแคบมาก ให้ย่อเฉพาะ HUD/food/gates นิดเดียว
      */
      @media (max-width:1050px){
        body.hha-pc-unblock-playfield .brand h1{
          font-size:1.15rem !important;
          white-space:nowrap !important;
          overflow:hidden !important;
          text-overflow:ellipsis !important;
        }

        body.hha-pc-unblock-playfield .brand p{
          font-size:.68rem !important;
          white-space:nowrap !important;
          overflow:hidden !important;
          text-overflow:ellipsis !important;
        }

        body.hha-pc-unblock-playfield .stat{
          min-width:58px !important;
          padding:5px 4px !important;
        }

        body.hha-pc-unblock-playfield .stat small{
          font-size:.54rem !important;
        }

        body.hha-pc-unblock-playfield .stat b{
          font-size:.82rem !important;
        }

        body.hha-pc-unblock-playfield .food,
        body.hha-pc-unblock-playfield .foodActor{
          width:78px !important;
          height:78px !important;
        }

        body.hha-pc-unblock-playfield .food .emoji,
        body.hha-pc-unblock-playfield .foodActor .emoji{
          font-size:40px !important;
        }

        body.hha-pc-unblock-playfield .gate{
          min-height:72px !important;
          border-radius:18px !important;
        }

        body.hha-pc-unblock-playfield .gate .label{
          font-size:.68rem !important;
        }

        body.hha-pc-unblock-playfield .gate .ex{
          display:none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function hideBadOverlays(){
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

    Array.prototype.slice.call(document.querySelectorAll('main,section,article,div')).forEach(function(el){
      var t = textOf(el);

      if (
        t.indexOf('สรุปเสริม Groups Solo') >= 0 ||
        t.indexOf('Keep Trying') >= 0 && t.indexOf('Mission') >= 0
      ) {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.setAttribute('data-hha-pc-unblocked-hidden', PATCH_ID);
      }
    });
  }

  function hideFloatingBlockers(){
    if (!isPlaying()) return;

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
  }

  function scan(){
    removeBadPatch14();

    document.body.classList.add('hha-pc-unblock-playfield');
    document.documentElement.classList.add('hha-pc-unblock-playfield');

    hideBadOverlays();
    hideFloatingBlockers();
  }

  function boot(){
    addStyle();
    scan();

    [80,180,360,700,1200,2000,3500,5500].forEach(function(ms){
      setTimeout(scan, ms);
    });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_PC_UNBLOCK_15_SCAN__);
      window.__HHA_PC_UNBLOCK_15_SCAN__ = setTimeout(scan, 50);
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

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
