/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260523-groups-solo-cvr-arcade-compact-19
   File: /herohealth/patches/groups/19-groups-solo-cvr-arcade-compact.js

   Purpose:
   - Final cVR playable compact layout
   - Force gates 1-5 visible at bottom
   - Hide premature supplemental summary while playing
   - Hide Teacher/Howto/old nav/Power blockers
   - Keep PC/Mobile untouched
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260523-groups-solo-cvr-arcade-compact-19';

  if (window.__HHA_GROUPS_SOLO_CVR_ARCADE_COMPACT_19__) return;
  window.__HHA_GROUPS_SOLO_CVR_ARCADE_COMPACT_19__ = true;

  var qs = new URLSearchParams(location.search);

  var isCvr =
    qs.get('cvrShell') === '1' ||
    qs.get('device') === 'cvr' ||
    qs.get('cvr') === '1' ||
    qs.get('vr') === '1' ||
    String(qs.get('view') || '').toLowerCase() === 'cvr';

  if (!isCvr) {
    console.info('[Groups cVR Compact 19]', PATCH_ID, 'skipped');
    return;
  }

  function textOf(el){
    return String(el && (el.innerText || el.textContent || '') || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function removeBadCvrPatches(){
    [
      'hha-groups-cvr-playable-layout-16-style',
      'hha-groups-cvr-clear-stage-17-style',
      'hha-groups-cvr-pc-shell-18-style'
    ].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.remove();
    });

    document.documentElement.classList.remove('hha-cvr-playable','hha-cvr-clear-stage','hha-cvr-pc-shell');
    document.body.classList.remove('hha-cvr-playable','hha-cvr-clear-stage','hha-cvr-pc-shell');
  }

  function isPlaying(){
    return (
      document.body.classList.contains('isPlaying') ||
      document.body.classList.contains('hha-groups-gameplay-active') ||
      qs.get('run') === 'play'
    ) && !document.body.classList.contains('summaryOpen');
  }

  function addStyle(){
    if (document.getElementById('hha-groups-cvr-arcade-compact-19-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-groups-cvr-arcade-compact-19-style';
    style.textContent = `
      html.hha-cvr-arcade-compact,
      body.hha-cvr-arcade-compact{
        width:100% !important;
        height:100% !important;
        overflow:hidden !important;
        touch-action:none !important;
        overscroll-behavior:none !important;
      }

      body.hha-cvr-arcade-compact .game{
        position:fixed !important;
        inset:0 !important;
        width:100vw !important;
        height:100dvh !important;
        max-width:none !important;
        max-height:none !important;
        margin:0 !important;
        padding:4px 6px 74px !important;
        overflow:hidden !important;
        transform:none !important;
        display:block !important;
      }

      body.hha-cvr-arcade-compact .topHud{
        position:fixed !important;
        top:4px !important;
        left:6px !important;
        right:6px !important;
        height:48px !important;
        z-index:40 !important;
        display:grid !important;
        grid-template-columns:minmax(180px,1fr) auto !important;
        gap:4px !important;
        pointer-events:none !important;
        overflow:hidden !important;
      }

      body.hha-cvr-arcade-compact .brand{
        min-width:0 !important;
        max-width:none !important;
        height:48px !important;
        border-radius:16px !important;
        padding:4px 7px !important;
        gap:6px !important;
        overflow:hidden !important;
      }

      body.hha-cvr-arcade-compact .brandIcon{
        width:34px !important;
        height:34px !important;
        border-radius:12px !important;
        font-size:20px !important;
      }

      body.hha-cvr-arcade-compact .brand h1{
        font-size:clamp(.82rem,1.5vw,1.1rem) !important;
        line-height:1 !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-arcade-compact .brand p{
        font-size:.50rem !important;
        line-height:1.05 !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-arcade-compact .stats{
        display:grid !important;
        grid-template-columns:repeat(5,44px) !important;
        gap:3px !important;
      }

      body.hha-cvr-arcade-compact .stat{
        width:44px !important;
        min-width:0 !important;
        height:48px !important;
        border-radius:12px !important;
        padding:3px 2px !important;
        overflow:hidden !important;
      }

      body.hha-cvr-arcade-compact .stat small{
        font-size:.43rem !important;
        line-height:1 !important;
      }

      body.hha-cvr-arcade-compact .stat b{
        font-size:.68rem !important;
        line-height:1 !important;
      }

      body.hha-cvr-arcade-compact .stage{
        position:fixed !important;
        top:56px !important;
        left:6px !important;
        right:6px !important;
        bottom:76px !important;
        width:auto !important;
        height:auto !important;
        max-width:none !important;
        max-height:none !important;
        margin:0 !important;
        border-radius:18px !important;
        overflow:hidden !important;
        display:block !important;
        visibility:visible !important;
        opacity:1 !important;
        z-index:20 !important;
      }

      body.hha-cvr-arcade-compact .waveHud{
        position:absolute !important;
        top:0 !important;
        left:0 !important;
        right:0 !important;
        height:42px !important;
        padding:4px 7px !important;
        z-index:35 !important;
        pointer-events:none !important;
        overflow:hidden !important;
      }

      body.hha-cvr-arcade-compact .waveTitle{
        font-size:.78rem !important;
        line-height:1.02 !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-arcade-compact .waveSub{
        font-size:.48rem !important;
        line-height:1.05 !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-arcade-compact .chips{
        gap:3px !important;
        flex-wrap:nowrap !important;
      }

      body.hha-cvr-arcade-compact .chip{
        min-height:18px !important;
        padding:2px 5px !important;
        font-size:.44rem !important;
        white-space:nowrap !important;
      }

      body.hha-cvr-arcade-compact .playfield{
        position:absolute !important;
        top:42px !important;
        left:0 !important;
        right:0 !important;
        bottom:0 !important;
        width:auto !important;
        height:auto !important;
        min-height:0 !important;
        overflow:hidden !important;
        display:block !important;
        visibility:visible !important;
        opacity:1 !important;
        z-index:21 !important;
      }

      body.hha-cvr-arcade-compact .actorLayer{
        position:absolute !important;
        inset:0 !important;
        display:block !important;
        visibility:visible !important;
        opacity:1 !important;
        z-index:30 !important;
        pointer-events:auto !important;
      }

      body.hha-cvr-arcade-compact .floor,
      body.hha-cvr-arcade-compact .floorLine{
        position:absolute !important;
        left:0 !important;
        right:0 !important;
        bottom:4px !important;
        height:8px !important;
        z-index:23 !important;
      }

      body.hha-cvr-arcade-compact .food,
      body.hha-cvr-arcade-compact .foodActor,
      body.hha-cvr-arcade-compact.view-cvr .food,
      body.hha-cvr-arcade-compact.view-cvr .foodActor{
        width:66px !important;
        height:66px !important;
        min-width:66px !important;
        min-height:66px !important;
        border-width:3px !important;
        z-index:45 !important;
        pointer-events:auto !important;
      }

      body.hha-cvr-arcade-compact .food .emoji,
      body.hha-cvr-arcade-compact .foodActor .emoji,
      body.hha-cvr-arcade-compact.view-cvr .food .emoji,
      body.hha-cvr-arcade-compact.view-cvr .foodActor .emoji{
        font-size:33px !important;
      }

      body.hha-cvr-arcade-compact .food .name,
      body.hha-cvr-arcade-compact .foodActor .name{
        max-width:62px !important;
        font-size:.48rem !important;
        bottom:2px !important;
        padding:1px 4px !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-arcade-compact .gates{
        position:fixed !important;
        left:6px !important;
        right:6px !important;
        bottom:26px !important;
        height:48px !important;
        z-index:100 !important;
        display:grid !important;
        grid-template-columns:repeat(5,minmax(0,1fr)) !important;
        gap:4px !important;
        padding:0 !important;
        margin:0 !important;
        visibility:visible !important;
        opacity:1 !important;
        pointer-events:auto !important;
        transform:none !important;
      }

      body.hha-cvr-arcade-compact .gate,
      body.hha-cvr-arcade-compact.view-cvr .gate{
        min-height:48px !important;
        height:48px !important;
        border-radius:13px !important;
        border-width:2px !important;
        padding:3px !important;
        display:flex !important;
        flex-direction:column !important;
        align-items:center !important;
        justify-content:center !important;
        overflow:hidden !important;
        pointer-events:auto !important;
      }

      body.hha-cvr-arcade-compact .gate .num{
        width:19px !important;
        height:19px !important;
        border-radius:8px !important;
        font-size:.58rem !important;
        line-height:19px !important;
      }

      body.hha-cvr-arcade-compact .gate .label{
        font-size:.46rem !important;
        line-height:1 !important;
        margin-top:1px !important;
        max-width:100% !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-arcade-compact .gate .ex{
        display:none !important;
      }

      body.hha-cvr-arcade-compact .bottomBar{
        position:fixed !important;
        left:6px !important;
        right:6px !important;
        bottom:0 !important;
        height:24px !important;
        min-height:24px !important;
        z-index:80 !important;
        display:block !important;
        overflow:hidden !important;
        pointer-events:none !important;
      }

      body.hha-cvr-arcade-compact .feedback{
        min-height:22px !important;
        border-radius:999px !important;
        padding:2px 8px !important;
        font-size:.48rem !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-arcade-compact .navs,
      body.hha-cvr-arcade-compact #btnTeacher,
      body.hha-cvr-arcade-compact #btnHowto,
      body.hha-cvr-arcade-compact .teacher,
      body.hha-cvr-arcade-compact .howto{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-cvr-arcade-compact #startOverlay{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-cvr-arcade-compact #summaryOverlay.hidden{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-cvr-arcade-compact #summaryOverlay{
        z-index:300 !important;
        touch-action:pan-y !important;
        overflow-y:auto !important;
      }

      body.hha-cvr-arcade-compact #btnPowerSort,
      body.hha-cvr-arcade-compact .power,
      body.hha-cvr-arcade-compact .floatBtn,
      body.hha-cvr-arcade-compact .bigBtn{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-cvr-arcade-compact .toast{
        left:50% !important;
        top:3px !important;
        bottom:auto !important;
        transform:translateX(-50%) scale(.58) !important;
        transform-origin:top center !important;
        max-width:min(320px,50vw) !important;
        min-width:auto !important;
        padding:4px 7px !important;
        font-size:.48rem !important;
        opacity:.72 !important;
        z-index:130 !important;
      }

      body.hha-cvr-arcade-compact .coach,
      body.hha-cvr-arcade-compact .coachCue,
      body.hha-cvr-arcade-compact .miniHud,
      body.hha-cvr-arcade-compact .objective,
      body.hha-cvr-arcade-compact .phase,
      body.hha-cvr-arcade-compact .bossOrder,
      body.hha-cvr-arcade-compact .boss{
        transform:scale(.55) !important;
        opacity:.50 !important;
        pointer-events:none !important;
        z-index:70 !important;
      }

      body.hha-cvr-arcade-compact .cvrCross{
        display:block !important;
        z-index:180 !important;
        width:38px !important;
        height:38px !important;
      }

      body.hha-cvr-arcade-compact .cvrHint{
        top:calc(50% + 30px) !important;
        z-index:181 !important;
        width:min(330px,54vw) !important;
        min-width:auto !important;
        padding:4px 8px !important;
        font-size:.50rem !important;
        opacity:.80 !important;
        pointer-events:none !important;
      }

      .hha-cvr-arcade-help{
        position:fixed;
        left:50%;
        top:calc(50% + 54px);
        transform:translateX(-50%);
        z-index:182;
        width:min(400px,60vw);
        padding:4px 8px;
        border-radius:999px;
        background:rgba(255,255,255,.88);
        border:1px solid rgba(214,237,247,.96);
        color:#397b9c;
        text-align:center;
        font:900 9px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 10px 24px rgba(47,149,255,.14);
        pointer-events:none;
      }

      body.summaryOpen .hha-cvr-arcade-help{
        display:none !important;
      }

      @media (max-height:620px){
        body.hha-cvr-arcade-compact .topHud{
          height:42px !important;
        }

        body.hha-cvr-arcade-compact .stage{
          top:48px !important;
          bottom:66px !important;
        }

        body.hha-cvr-arcade-compact .waveHud{
          height:34px !important;
        }

        body.hha-cvr-arcade-compact .playfield{
          top:34px !important;
        }

        body.hha-cvr-arcade-compact .food,
        body.hha-cvr-arcade-compact .foodActor,
        body.hha-cvr-arcade-compact.view-cvr .food,
        body.hha-cvr-arcade-compact.view-cvr .foodActor{
          width:54px !important;
          height:54px !important;
          min-width:54px !important;
          min-height:54px !important;
        }

        body.hha-cvr-arcade-compact .food .emoji,
        body.hha-cvr-arcade-compact .foodActor .emoji{
          font-size:27px !important;
        }

        body.hha-cvr-arcade-compact .gates{
          bottom:22px !important;
          height:42px !important;
        }

        body.hha-cvr-arcade-compact .gate,
        body.hha-cvr-arcade-compact.view-cvr .gate{
          height:42px !important;
          min-height:42px !important;
          border-radius:11px !important;
        }

        body.hha-cvr-arcade-compact .gate .num{
          width:17px !important;
          height:17px !important;
          font-size:.52rem !important;
          line-height:17px !important;
        }

        body.hha-cvr-arcade-compact .gate .label{
          font-size:.40rem !important;
        }

        body.hha-cvr-arcade-compact .bottomBar{
          height:20px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function hidePrematureSummary(){
    Array.prototype.slice.call(document.querySelectorAll('main,section,article,div')).forEach(function(el){
      var t = textOf(el);

      if (
        t.indexOf('สรุปเสริม Groups Solo') >= 0 ||
        (
          t.indexOf('Keep Trying') >= 0 &&
          t.indexOf('Hero Rank') >= 0 &&
          !document.body.classList.contains('summaryOpen')
        )
      ) {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.setAttribute('data-hha-cvr-arcade-hidden-summary', PATCH_ID);
      }
    });
  }

  function mark(){
    document.documentElement.classList.add('hha-cvr-arcade-compact');
    document.body.classList.add('hha-cvr-arcade-compact');
    document.body.classList.add('view-cvr');
    document.body.dataset.hhaView = 'cvr';

    if (qs.get('run') === 'play' || qs.get('autostart') === '1' || qs.get('direct') === '1') {
      document.body.classList.add('hha-groups-gameplay-active');
    }
  }

  function ensureHelp(){
    if (document.querySelector('.hha-cvr-arcade-help')) return;

    var pill = document.createElement('div');
    pill.className = 'hha-cvr-arcade-help';
    pill.textContent = 'cVR: ไม่ต้องเลื่อนจอ • เล็งอาหารแล้วแตะ • เล็งประตู 1–5 แล้วแตะ';
    document.body.appendChild(pill);

    setTimeout(function(){
      pill.style.opacity = '.50';
    }, 6500);
  }

  function bindTapShoot(){
    if (document.__hhaGroupsCvrArcadeTapShoot19Bound) return;
    document.__hhaGroupsCvrArcadeTapShoot19Bound = true;

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
            source:'cvr-arcade-compact-19',
            patch:PATCH_ID
          }
        }));
      } catch(e) {}
    }, true);
  }

  function scan(){
    removeBadCvrPatches();
    mark();
    hidePrematureSummary();
    ensureHelp();
  }

  function boot(){
    addStyle();
    bindTapShoot();
    scan();

    [80,180,360,700,1200,2000,3500,5500,8500].forEach(function(ms){
      setTimeout(scan, ms);
    });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_CVR_ARCADE_19_SCAN__);
      window.__HHA_CVR_ARCADE_19_SCAN__ = setTimeout(scan, 45);
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
      view: qs.get('view'),
      cvr: qs.get('cvr'),
      vr: qs.get('vr'),
      device: qs.get('device')
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
