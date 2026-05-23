/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260523-groups-solo-cvr-pc-shell-18
   File: /herohealth/patches/groups/18-groups-solo-cvr-pc-shell.js

   Purpose:
   - Cardboard/cVR uses stable PC layout
   - Enable crosshair/tap via cvr=1/vr=1
   - Do NOT use broken view=cvr layout
   - Keep Mobile and normal PC untouched
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260523-groups-solo-cvr-pc-shell-18';

  if (window.__HHA_GROUPS_SOLO_CVR_PC_SHELL_18__) return;
  window.__HHA_GROUPS_SOLO_CVR_PC_SHELL_18__ = true;

  var qs = new URLSearchParams(location.search);

  var isCvrShell =
    qs.get('cvrShell') === '1' ||
    qs.get('device') === 'cvr' ||
    qs.get('cvr') === '1' ||
    qs.get('vr') === '1';

  if (!isCvrShell) {
    console.info('[Groups cVR PC Shell 18]', PATCH_ID, 'skipped');
    return;
  }

  function addStyle(){
    if (document.getElementById('hha-groups-cvr-pc-shell-18-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-groups-cvr-pc-shell-18-style';

    style.textContent = `
      body.hha-cvr-pc-shell{
        overflow:hidden !important;
        touch-action:none !important;
      }

      /*
        ใช้ PC layout เป็นฐาน ห้าม fixed stage ใหม่
      */
      body.hha-cvr-pc-shell .game{
        height:100dvh !important;
        overflow:hidden !important;
      }

      body.hha-cvr-pc-shell .stage{
        min-height:0 !important;
        overflow:hidden !important;
      }

      body.hha-cvr-pc-shell .playfield{
        min-height:0 !important;
        overflow:hidden !important;
      }

      /*
        ลบขนาดใหญ่เดิมของ body.view-cvr
        ในไฟล์หลักเดิม view-cvr ทำ food 150px และ gate 118px ซึ่งทำให้แน่นมาก
      */
      body.hha-cvr-pc-shell.view-cvr .food,
      body.hha-cvr-pc-shell.view-cvr .foodActor,
      body.hha-cvr-pc-shell .food,
      body.hha-cvr-pc-shell .foodActor{
        width:92px !important;
        height:92px !important;
        border-width:3px !important;
        z-index:42 !important;
        pointer-events:auto !important;
      }

      body.hha-cvr-pc-shell.view-cvr .food .emoji,
      body.hha-cvr-pc-shell.view-cvr .foodActor .emoji,
      body.hha-cvr-pc-shell .food .emoji,
      body.hha-cvr-pc-shell .foodActor .emoji{
        font-size:46px !important;
      }

      body.hha-cvr-pc-shell .food .name,
      body.hha-cvr-pc-shell .foodActor .name{
        max-width:86px !important;
        font-size:.62rem !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-pc-shell.view-cvr .gate,
      body.hha-cvr-pc-shell .gate{
        min-height:82px !important;
        border-radius:20px !important;
        border-width:2px !important;
        padding:5px !important;
      }

      body.hha-cvr-pc-shell .gate .num{
        width:28px !important;
        height:28px !important;
        border-radius:10px !important;
        font-size:.82rem !important;
      }

      body.hha-cvr-pc-shell .gate .label{
        font-size:.68rem !important;
        line-height:1.05 !important;
      }

      body.hha-cvr-pc-shell .gate .ex{
        display:none !important;
      }

      /*
        ระหว่างเล่น ซ่อนของที่บังสนาม
      */
      body.hha-cvr-pc-shell.isPlaying .navs,
      body.hha-cvr-pc-shell.hha-groups-gameplay-active .navs,
      body.hha-cvr-pc-shell.isPlaying #btnTeacher,
      body.hha-cvr-pc-shell.isPlaying #btnHowto,
      body.hha-cvr-pc-shell.hha-groups-gameplay-active #btnTeacher,
      body.hha-cvr-pc-shell.hha-groups-gameplay-active #btnHowto{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-cvr-pc-shell #startOverlay{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-cvr-pc-shell #summaryOverlay.hidden{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-cvr-pc-shell #summaryOverlay{
        touch-action:pan-y !important;
        overflow-y:auto !important;
      }

      body.hha-cvr-pc-shell .cvrCross{
        display:block !important;
        z-index:160 !important;
      }

      body.hha-cvr-pc-shell .cvrHint{
        z-index:161 !important;
        font-size:.72rem !important;
        padding:6px 10px !important;
        opacity:.88 !important;
      }

      body.hha-cvr-pc-shell .toast{
        transform:translateX(-50%) scale(.78) !important;
        transform-origin:bottom center !important;
        max-width:min(460px,70vw) !important;
        font-size:.72rem !important;
        opacity:.82 !important;
      }

      body.hha-cvr-pc-shell .coach,
      body.hha-cvr-pc-shell .coachCue{
        transform:translate(-50%,-50%) scale(.72) !important;
        opacity:.55 !important;
        pointer-events:none !important;
      }

      .hha-cvr-pc-shell-help{
        position:fixed;
        left:50%;
        top:calc(50% + 58px);
        transform:translateX(-50%);
        z-index:162;
        width:min(520px,76vw);
        padding:6px 10px;
        border-radius:999px;
        background:rgba(255,255,255,.90);
        border:1px solid rgba(214,237,247,.96);
        color:#397b9c;
        text-align:center;
        font:900 11px/1.25 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 10px 24px rgba(47,149,255,.14);
        pointer-events:none;
      }

      body.summaryOpen .hha-cvr-pc-shell-help{
        display:none !important;
      }
    `;

    document.head.appendChild(style);
  }

  function mark(){
    document.body.classList.add('hha-cvr-pc-shell');
    document.documentElement.classList.add('hha-cvr-pc-shell');

    /*
      ให้ core เดิมเปิด crosshair เพราะ core ใช้ body.view-cvr แสดง cvrCross/cvrHint
    */
    document.body.classList.add('view-cvr');
    document.body.dataset.hhaView = 'cvr';

    if (qs.get('run') === 'play' || qs.get('autostart') === '1' || qs.get('direct') === '1') {
      document.body.classList.add('hha-groups-gameplay-active');
    }
  }

  function ensureHelp(){
    if (document.querySelector('.hha-cvr-pc-shell-help')) return;

    var pill = document.createElement('div');
    pill.className = 'hha-cvr-pc-shell-help';
    pill.textContent = 'Cardboard/cVR: ใช้ layout PC • เล็งอาหารแล้วแตะ • เล็งประตูหมู่ 1–5 แล้วแตะ';
    document.body.appendChild(pill);

    setTimeout(function(){
      pill.style.opacity = '.55';
    }, 7000);
  }

  function bindTapShoot(){
    if (document.__hhaGroupsCvrPcShellTapShoot18Bound) return;
    document.__hhaGroupsCvrPcShellTapShoot18Bound = true;

    document.addEventListener('click', function(ev){
      if (!document.body.classList.contains('isPlaying') &&
          !document.body.classList.contains('hha-groups-gameplay-active')) return;

      if (document.body.classList.contains('summaryOpen')) return;

      var target = ev.target;

      if (
        target &&
        target.closest &&
        target.closest('#summaryOverlay,#startOverlay,.navs,#btnTeacher,#btnHowto,.drawer,.bigBtn,.navBtn,.floatBtn')
      ) {
        return;
      }

      try {
        document.dispatchEvent(new CustomEvent('hha:shoot', {
          detail:{
            source:'cvr-pc-shell-18',
            patch:PATCH_ID
          }
        }));
      } catch(e) {}
    }, true);
  }

  function scan(){
    mark();
    ensureHelp();
  }

  function boot(){
    addStyle();
    bindTapShoot();
    scan();

    [80,180,360,700,1200,2000,3500,5500].forEach(function(ms){
      setTimeout(scan, ms);
    });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_CVR_PC_SHELL_18_SCAN__);
      window.__HHA_CVR_PC_SHELL_18_SCAN__ = setTimeout(scan, 60);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      characterData:true,
      attributeFilter:['class','style']
    });

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      view: qs.get('view'),
      cvr: qs.get('cvr'),
      vr: qs.get('vr'),
      cvrShell: qs.get('cvrShell')
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
