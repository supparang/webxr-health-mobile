/* =========================================================
   HeroHealth Groups cVR
   PATCH: v20260525-groups-cvr-vr-feeling-v5-safe-frame
   File: /herohealth/patches/groups/groups-cvr-vr-feeling-v5-safe-frame.js

   Purpose:
   - Mobile/Cardboard safe frame polish
   - Prevent left/right clipping on mobile landscape
   - Compact top HUD
   - Reduce center cue obstruction
   - Improve portal labels readability
   - Visual/UX only: does not change scoring logic
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260525-groups-cvr-vr-feeling-v5-safe-frame';

  if (window.__HHA_GROUPS_CVR_VR_FEELING_V5_SAFE_FRAME__) return;
  window.__HHA_GROUPS_CVR_VR_FEELING_V5_SAFE_FRAME__ = true;

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
    if ($('#hha-groups-cvr-v5-safe-frame-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-groups-cvr-v5-safe-frame-style';

    style.textContent = `
      html.hha-cvr-safe-frame,
      body.hha-cvr-safe-frame{
        width:100% !important;
        height:100% !important;
        overflow:hidden !important;
        touch-action:none !important;
        overscroll-behavior:none !important;
      }

      body.hha-cvr-safe-frame{
        --hha-cvr-side: max(14px, env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px));
        --hha-cvr-top: max(7px, env(safe-area-inset-top, 0px));
        --hha-cvr-bottom: max(7px, env(safe-area-inset-bottom, 0px));
      }

      /*
        Safe frame: กันขอบซ้าย/ขวาโดนตัดบน Chrome mobile / Android landscape
      */
      body.hha-cvr-safe-frame .game{
        position:fixed !important;
        inset:0 !important;
        width:100vw !important;
        height:100dvh !important;
        max-width:none !important;
        max-height:none !important;
        margin:0 !important;
        padding:
          var(--hha-cvr-top)
          var(--hha-cvr-side)
          var(--hha-cvr-bottom)
          var(--hha-cvr-side) !important;
        overflow:hidden !important;
        display:grid !important;
        grid-template-rows:50px minmax(0,1fr) 70px !important;
        gap:6px !important;
        transform:none !important;
      }

      /*
        Top HUD compact แต่ยังอ่านออก
      */
      body.hha-cvr-safe-frame .top{
        min-width:0 !important;
        height:50px !important;
        display:grid !important;
        grid-template-columns:minmax(180px,1fr) auto !important;
        gap:6px !important;
        overflow:visible !important;
        z-index:60 !important;
      }

      body.hha-cvr-safe-frame .brand{
        min-width:0 !important;
        height:50px !important;
        border-radius:17px !important;
        padding:5px 9px !important;
        gap:8px !important;
        overflow:hidden !important;
        box-shadow:0 10px 22px rgba(33,79,100,.10) !important;
      }

      body.hha-cvr-safe-frame .brandIcon{
        width:38px !important;
        height:38px !important;
        min-width:38px !important;
        border-radius:14px !important;
        font-size:22px !important;
      }

      body.hha-cvr-safe-frame .brand h1{
        font-size:clamp(.95rem,1.45vw,1.22rem) !important;
        line-height:1 !important;
        letter-spacing:-.35px !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-safe-frame .brand p{
        margin-top:3px !important;
        font-size:.54rem !important;
        line-height:1.05 !important;
        max-width:100% !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
      }

      body.hha-cvr-safe-frame .stats{
        display:grid !important;
        grid-template-columns:repeat(5,50px) !important;
        gap:5px !important;
        min-width:0 !important;
      }

      body.hha-cvr-safe-frame .stat{
        width:50px !important;
        height:50px !important;
        min-width:0 !important;
        border-radius:15px !important;
        padding:4px 2px !important;
        overflow:hidden !important;
      }

      body.hha-cvr-safe-frame .stat small{
        font-size:.44rem !important;
        line-height:1 !important;
        white-space:nowrap !important;
      }

      body.hha-cvr-safe-frame .stat b{
        font-size:.76rem !important;
        line-height:1 !important;
      }

      /*
        Arena safe area
      */
      body.hha-cvr-safe-frame .arena{
        min-height:0 !important;
        width:100% !important;
        max-width:100% !important;
        overflow:hidden !important;
        border-radius:21px !important;
      }

      body.hha-cvr-safe-frame .wave{
        top:8px !important;
        left:10px !important;
        right:10px !important;
        min-height:34px !important;
        z-index:50 !important;
      }

      body.hha-cvr-safe-frame .waveText{
        max-width:52% !important;
        min-width:0 !important;
      }

      body.hha-cvr-safe-frame .waveText b{
        font-size:.88rem !important;
        line-height:1.02 !important;
        max-width:100% !important;
      }

      body.hha-cvr-safe-frame .waveText span{
        font-size:.50rem !important;
        line-height:1.05 !important;
      }

      body.hha-cvr-safe-frame .chips{
        gap:5px !important;
        flex-wrap:nowrap !important;
      }

      body.hha-cvr-safe-frame .chip{
        min-height:20px !important;
        padding:3px 8px !important;
        font-size:.50rem !important;
        border-radius:999px !important;
      }

      /*
        Target panel ไม่ให้ติดขอบซ้าย และไม่บังฉากมากเกินไป
      */
      body.hha-cvr-safe-frame .targetPanel{
        left:12px !important;
        top:58px !important;
        width:min(230px,31vw) !important;
        padding:8px 10px !important;
        border-radius:16px !important;
        z-index:45 !important;
        opacity:.94 !important;
      }

      body.hha-cvr-safe-frame .targetPanel b{
        font-size:.70rem !important;
        line-height:1.05 !important;
      }

      body.hha-cvr-safe-frame .targetPanel span{
        margin-top:3px !important;
        font-size:.48rem !important;
        line-height:1.12 !important;
      }

      /*
        Center cue v4 ย่อและยกขึ้นเล็กน้อย ไม่บัง crosshair/portal มากเกินไป
      */
      body.hha-cvr-safe-frame .hha-cvr-clarity-cue{
        top:calc(50% - 82px) !important;
        width:min(560px,72vw) !important;
        min-height:40px !important;
        padding:7px 12px !important;
        font-size:13px !important;
        line-height:1.15 !important;
        border-radius:999px !important;
        z-index:245 !important;
      }

      body.hha-cvr-safe-frame .hha-cvr-clarity-cue small{
        margin-top:2px !important;
        font-size:9.5px !important;
        line-height:1.08 !important;
      }

      body.hha-cvr-safe-frame .hha-cvr-step-pills{
        top:calc(50% - 39px) !important;
        gap:5px !important;
        z-index:244 !important;
      }

      body.hha-cvr-safe-frame .hha-cvr-step-pill{
        min-width:74px !important;
        padding:4px 8px !important;
        font-size:8.5px !important;
        opacity:.76 !important;
      }

      /*
        ลด coach ของ v2 ไม่ให้ชนกับ cue หลัก
      */
      body.hha-cvr-safe-frame .hha-vr-coach{
        top:calc(50% - 125px) !important;
        max-width:min(500px,66vw) !important;
        padding:5px 10px !important;
        font-size:10px !important;
        opacity:.42 !important;
      }

      body.hha-cvr-safe-frame .hha-vr-coach:not(.dim){
        opacity:.62 !important;
      }

      /*
        อาหารที่เลือกแล้วต้องเห็นชัด แต่ไม่ใหญ่จนบัง
      */
      body.hha-cvr-safe-frame .foodToken{
        width:76px !important;
        height:76px !important;
        margin-left:-38px !important;
        margin-top:-38px !important;
        border-width:4px !important;
      }

      body.hha-cvr-safe-frame .foodEmoji{
        font-size:36px !important;
      }

      body.hha-cvr-safe-frame .foodName{
        max-width:72px !important;
        font-size:.50rem !important;
        bottom:5px !important;
      }

      body.hha-cvr-safe-frame .selectedFood,
      body.hha-cvr-safe-frame .selectedFood *,
      body.hha-cvr-safe-frame #selectedFood{
        font-size:.58rem !important;
        line-height:1.1 !important;
      }

      body.hha-cvr-safe-frame .scanPanel{
        bottom:10px !important;
        width:min(560px,72vw) !important;
        min-height:42px !important;
      }

      /*
        Portal deck readability
      */
      body.hha-cvr-safe-frame .gates{
        height:70px !important;
        min-height:70px !important;
        gap:7px !important;
        padding:0 2px !important;
        z-index:120 !important;
      }

      body.hha-cvr-safe-frame .gate{
        height:68px !important;
        min-height:68px !important;
        border-radius:18px !important;
        padding:4px 6px !important;
        overflow:visible !important;
      }

      body.hha-cvr-safe-frame .gateNum{
        position:relative !important;
        width:27px !important;
        height:27px !important;
        min-width:27px !important;
        border-radius:10px !important;
        font-size:.72rem !important;
        line-height:27px !important;
        z-index:3 !important;
      }

      body.hha-cvr-safe-frame .gateLabel{
        margin-top:4px !important;
        font-size:.54rem !important;
        line-height:1.03 !important;
        max-width:100% !important;
        padding:0 4px !important;
        text-align:center !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
        z-index:3 !important;
      }

      body.hha-cvr-safe-frame .gate.hha-portal-gate::before{
        width:56px !important;
        height:56px !important;
      }

      body.hha-cvr-safe-frame .gate.hha-portal-gate.active{
        transform:translateY(-10px) scale(1.06) !important;
      }

      body.hha-cvr-safe-frame .gate.hha-ready-gate{
        transform:translateY(-13px) scale(1.08) !important;
      }

      body.hha-cvr-safe-frame .gate.hha-ready-gate .gateNum::after{
        top:-22px !important;
        min-width:52px !important;
        padding:3px 7px !important;
        font-size:9px !important;
      }

      body.hha-cvr-safe-frame .hha-cvr-target-beacon{
        width:74px !important;
        height:74px !important;
        border-width:3px !important;
      }

      body.hha-cvr-safe-frame .hha-cvr-path-line{
        height:3px !important;
        opacity:.62 !important;
      }

      body.hha-cvr-safe-frame .hha-cvr-path-line.ready{
        opacity:.82 !important;
      }

      /*
        Crosshair ให้เด่นแต่ไม่ใหญ่เกิน
      */
      body.hha-cvr-safe-frame .crosshair{
        width:39px !important;
        height:39px !important;
        z-index:250 !important;
      }

      body.hha-cvr-safe-frame .crosshair::before{
        width:26px !important;
        height:3px !important;
      }

      body.hha-cvr-safe-frame .crosshair::after{
        width:3px !important;
        height:26px !important;
      }

      body.hha-cvr-safe-frame .crossDot{
        width:7px !important;
        height:7px !important;
      }

      /*
        Toast/beam/pop ไม่ให้บังจอมากเกิน
      */
      body.hha-cvr-safe-frame .toast{
        top:calc(8px + env(safe-area-inset-top,0px)) !important;
        max-width:min(460px,66vw) !important;
        padding:6px 10px !important;
        font-size:.60rem !important;
        transform:translateX(-50%) translateY(-8px) scale(.82) !important;
      }

      body.hha-cvr-safe-frame .toast.show{
        transform:translateX(-50%) translateY(0) scale(.82) !important;
      }

      body.hha-cvr-safe-frame .hha-vr-score-pop{
        font-size:13px !important;
        padding:6px 10px !important;
      }

      /*
        Summary ไม่โดน safe frame บีบ
      */
      body.hha-cvr-safe-frame .summary.show{
        padding:
          calc(16px + env(safe-area-inset-top,0px))
          calc(16px + env(safe-area-inset-right,0px))
          calc(18px + env(safe-area-inset-bottom,0px))
          calc(16px + env(safe-area-inset-left,0px)) !important;
      }

      body.hha-cvr-safe-frame .summaryCard{
        max-width:min(760px,94vw) !important;
      }

      /*
        จอเตี้ยมาก เช่นมือถือ landscape + address bar
      */
      @media (max-height:620px){
        body.hha-cvr-safe-frame .game{
          grid-template-rows:43px minmax(0,1fr) 58px !important;
          gap:4px !important;
          padding:
            max(4px, env(safe-area-inset-top,0px))
            max(10px, env(safe-area-inset-left,0px), env(safe-area-inset-right,0px))
            max(4px, env(safe-area-inset-bottom,0px))
            max(10px, env(safe-area-inset-left,0px), env(safe-area-inset-right,0px)) !important;
        }

        body.hha-cvr-safe-frame .top{
          height:43px !important;
          grid-template-columns:minmax(150px,1fr) auto !important;
          gap:4px !important;
        }

        body.hha-cvr-safe-frame .brand{
          height:43px !important;
          border-radius:14px !important;
          padding:4px 7px !important;
          gap:6px !important;
        }

        body.hha-cvr-safe-frame .brandIcon{
          width:31px !important;
          height:31px !important;
          min-width:31px !important;
          border-radius:11px !important;
          font-size:18px !important;
        }

        body.hha-cvr-safe-frame .brand h1{
          font-size:.82rem !important;
        }

        body.hha-cvr-safe-frame .brand p{
          font-size:.43rem !important;
        }

        body.hha-cvr-safe-frame .stats{
          grid-template-columns:repeat(5,41px) !important;
          gap:3px !important;
        }

        body.hha-cvr-safe-frame .stat{
          width:41px !important;
          height:43px !important;
          border-radius:12px !important;
          padding:3px 1px !important;
        }

        body.hha-cvr-safe-frame .stat small{
          font-size:.37rem !important;
        }

        body.hha-cvr-safe-frame .stat b{
          font-size:.60rem !important;
        }

        body.hha-cvr-safe-frame .wave{
          top:5px !important;
          left:7px !important;
          right:7px !important;
        }

        body.hha-cvr-safe-frame .waveText{
          max-width:46% !important;
        }

        body.hha-cvr-safe-frame .waveText b{
          font-size:.68rem !important;
        }

        body.hha-cvr-safe-frame .waveText span{
          font-size:.40rem !important;
        }

        body.hha-cvr-safe-frame .chip{
          min-height:17px !important;
          padding:2px 6px !important;
          font-size:.38rem !important;
        }

        body.hha-cvr-safe-frame .targetPanel{
          top:42px !important;
          left:8px !important;
          width:min(190px,30vw) !important;
          padding:6px 8px !important;
          border-radius:13px !important;
        }

        body.hha-cvr-safe-frame .targetPanel b{
          font-size:.56rem !important;
        }

        body.hha-cvr-safe-frame .targetPanel span{
          font-size:.38rem !important;
        }

        body.hha-cvr-safe-frame .hha-cvr-clarity-cue{
          top:calc(50% - 66px) !important;
          width:min(470px,68vw) !important;
          min-height:32px !important;
          padding:5px 9px !important;
          font-size:10px !important;
        }

        body.hha-cvr-safe-frame .hha-cvr-clarity-cue small{
          font-size:8px !important;
        }

        body.hha-cvr-safe-frame .hha-cvr-step-pills{
          top:calc(50% - 32px) !important;
          gap:4px !important;
        }

        body.hha-cvr-safe-frame .hha-cvr-step-pill{
          min-width:60px !important;
          padding:3px 5px !important;
          font-size:7px !important;
        }

        body.hha-cvr-safe-frame .hha-vr-coach{
          display:none !important;
        }

        body.hha-cvr-safe-frame .foodToken{
          width:60px !important;
          height:60px !important;
          margin-left:-30px !important;
          margin-top:-30px !important;
        }

        body.hha-cvr-safe-frame .foodEmoji{
          font-size:29px !important;
        }

        body.hha-cvr-safe-frame .foodName{
          max-width:56px !important;
          font-size:.40rem !important;
          bottom:3px !important;
        }

        body.hha-cvr-safe-frame .scanPanel{
          bottom:7px !important;
          width:min(460px,66vw) !important;
          min-height:32px !important;
        }

        body.hha-cvr-safe-frame #selectedFood{
          font-size:.46rem !important;
          padding:4px 8px !important;
        }

        body.hha-cvr-safe-frame .gates{
          height:58px !important;
          min-height:58px !important;
          gap:5px !important;
        }

        body.hha-cvr-safe-frame .gate{
          height:56px !important;
          min-height:56px !important;
          border-radius:14px !important;
          padding:3px 4px !important;
        }

        body.hha-cvr-safe-frame .gateNum{
          width:22px !important;
          height:22px !important;
          min-width:22px !important;
          border-radius:8px !important;
          font-size:.58rem !important;
          line-height:22px !important;
        }

        body.hha-cvr-safe-frame .gateLabel{
          margin-top:3px !important;
          font-size:.42rem !important;
        }

        body.hha-cvr-safe-frame .gate.hha-portal-gate::before{
          width:46px !important;
          height:46px !important;
        }

        body.hha-cvr-safe-frame .hha-cvr-target-beacon{
          width:58px !important;
          height:58px !important;
        }

        body.hha-cvr-safe-frame .crosshair{
          width:34px !important;
          height:34px !important;
        }
      }

      /*
        จอแคบ/มือถือจริง ให้ซ่อนข้อความยาวบางจุดแต่คงข้อมูลสำคัญ
      */
      @media (max-width:760px){
        body.hha-cvr-safe-frame .brand p{
          display:none !important;
        }

        body.hha-cvr-safe-frame .brand h1{
          font-size:.92rem !important;
        }

        body.hha-cvr-safe-frame .targetPanel{
          opacity:.88 !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function compactStatLabels(){
    var statMap = [
      ['คะแนน','แต้ม'],
      ['เวลา','เวลา'],
      ['หัวใจ','HP'],
      ['คอมโบ','Combo'],
      ['ถูกต้อง','Acc']
    ];

    var stats = $all('.stat');

    stats.forEach(function(stat, idx){
      var small = stat.querySelector('small');
      if (!small) return;

      var raw = textOf(small);
      var compact = statMap[idx] && statMap[idx][1];

      if (compact && raw !== compact) {
        small.textContent = compact;
      }
    });
  }

  function improveGateLabels(){
    var labels = {
      1:'โปรตีน',
      2:'ข้าว/แป้ง',
      3:'ผัก',
      4:'ผลไม้',
      5:'ไขมัน'
    };

    $all('.gate').forEach(function(gate){
      var n = Number(gate.dataset && gate.dataset.gate);
      if (!n) {
        var m = textOf(gate).match(/[1-5]/);
        n = m ? Number(m[0]) : 0;
      }

      var label = gate.querySelector('.gateLabel');
      if (label && labels[n]) {
        label.textContent = 'หมู่ ' + n + ' ' + labels[n];
      }
    });
  }

  function improveCueText(){
    var cue = $('.hha-cvr-clarity-cue');
    if (!cue || document.body.classList.contains('summaryOpen')) return;

    var txt = textOf(cue);

    if (txt.indexOf('รอ Portal') >= 0) {
      cue.setAttribute('data-hha-cvr-cue-mode', 'wait');
    } else if (txt.indexOf('แตะเลย') >= 0) {
      cue.setAttribute('data-hha-cvr-cue-mode', 'ready');
    } else {
      cue.setAttribute('data-hha-cvr-cue-mode', 'pick');
    }
  }

  function protectLeftEdge(){
    /*
      กรณี Android Chrome บางเครื่อง viewport กว้างกว่าพื้นที่มองเห็นเล็กน้อย
      ใช้ transform เล็กมากดึง content เข้า safe frame
    */
    var game = $('.game');
    if (!game) return;

    game.style.boxSizing = 'border-box';
    game.style.maxWidth = '100vw';
  }

  function scan(){
    document.documentElement.classList.add('hha-cvr-safe-frame');
    document.body.classList.add('hha-cvr-safe-frame');

    compactStatLabels();
    improveGateLabels();
    improveCueText();
    protectLeftEdge();
  }

  function bind(){
    if (document.__hhaGroupsCvrSafeFrameV5Bound) return;
    document.__hhaGroupsCvrSafeFrameV5Bound = true;

    document.addEventListener('click', function(){
      setTimeout(scan, 40);
      setTimeout(scan, 180);
      setTimeout(scan, 360);
    }, true);

    document.addEventListener('keydown', function(){
      setTimeout(scan, 40);
      setTimeout(scan, 180);
      setTimeout(scan, 360);
    }, true);

    window.addEventListener('resize', function(){
      setTimeout(scan, 120);
      setTimeout(scan, 420);
    }, { passive:true });

    window.addEventListener('orientationchange', function(){
      setTimeout(scan, 250);
      setTimeout(scan, 800);
    }, { passive:true });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_CVR_SAFE_FRAME_V5_SCAN__);
      window.__HHA_CVR_SAFE_FRAME_V5_SCAN__ = setTimeout(scan, 70);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','style','data-gate','data-hha-cvr-cue-mode']
    });

    setInterval(scan, 600);
  }

  function boot(){
    addStyle();
    bind();
    scan();

    [120,300,700,1300,2400,4200].forEach(function(ms){
      setTimeout(scan, ms);
    });

    console.info('[HeroHealth Groups cVR]', PATCH_ID, 'ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();