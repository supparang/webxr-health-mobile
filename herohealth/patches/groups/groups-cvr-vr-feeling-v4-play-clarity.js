/* =========================================================
   HeroHealth Groups cVR
   PATCH: v20260525-groups-cvr-vr-feeling-v4-play-clarity
   File: /herohealth/patches/groups/groups-cvr-vr-feeling-v4-play-clarity.js

   Purpose:
   - Make cVR gameplay instruction crystal clear
   - Show "wait for target portal" / "tap now"
   - Mark correct portal with beacon/arrow
   - Draw path line from crosshair to correct portal
   - Keep standalone groups-cvr.html scoring logic untouched
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260525-groups-cvr-vr-feeling-v4-play-clarity';

  if (window.__HHA_GROUPS_CVR_VR_FEELING_V4_PLAY_CLARITY__) return;
  window.__HHA_GROUPS_CVR_VR_FEELING_V4_PLAY_CLARITY__ = true;

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
    if ($('#hha-groups-cvr-v4-play-clarity-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-groups-cvr-v4-play-clarity-style';

    style.textContent = `
      body.hha-cvr-clarity .hint{
        display:none !important;
      }

      .hha-cvr-clarity-cue{
        position:fixed;
        left:50%;
        top:calc(50% - 94px);
        transform:translateX(-50%);
        z-index:240;
        width:min(620px,82vw);
        min-height:46px;
        padding:9px 14px;
        border-radius:999px;
        background:rgba(255,255,255,.92);
        border:2px solid rgba(207,238,250,.98);
        color:#214f64;
        text-align:center;
        font:1000 15px/1.22 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:
          0 16px 38px rgba(33,79,100,.16),
          inset 0 0 18px rgba(255,255,255,.85);
        pointer-events:none;
        transition:.16s ease;
      }

      .hha-cvr-clarity-cue small{
        display:block;
        margin-top:3px;
        color:#6f8fa1;
        font-size:11px;
        font-weight:950;
      }

      .hha-cvr-clarity-cue.wait{
        border-color:rgba(255,217,102,.98);
        background:linear-gradient(135deg,rgba(255,252,230,.96),rgba(255,255,255,.92));
      }

      .hha-cvr-clarity-cue.ready{
        border-color:rgba(126,217,87,.98);
        background:linear-gradient(135deg,rgba(237,255,232,.96),rgba(255,255,255,.92));
        color:#1f6a43;
        animation:hhaCueReadyPulse .56s ease-in-out infinite;
      }

      .hha-cvr-clarity-cue.pick{
        border-color:rgba(66,165,255,.72);
        background:linear-gradient(135deg,rgba(235,248,255,.96),rgba(255,255,255,.92));
      }

      .hha-cvr-clarity-cue.wrong{
        border-color:rgba(255,107,107,.82);
        background:linear-gradient(135deg,rgba(255,240,240,.96),rgba(255,255,255,.92));
        color:#9c2d2d;
      }

      @keyframes hhaCueReadyPulse{
        0%,100%{
          transform:translateX(-50%) scale(1);
          box-shadow:
            0 16px 38px rgba(33,79,100,.16),
            0 0 0 0 rgba(126,217,87,.30);
        }
        50%{
          transform:translateX(-50%) scale(1.035);
          box-shadow:
            0 18px 42px rgba(33,79,100,.18),
            0 0 0 8px rgba(126,217,87,.16);
        }
      }

      .hha-cvr-step-pills{
        position:fixed;
        left:50%;
        top:calc(50% - 43px);
        transform:translateX(-50%);
        z-index:239;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        pointer-events:none;
      }

      .hha-cvr-step-pill{
        min-width:88px;
        padding:5px 9px;
        border-radius:999px;
        background:rgba(255,255,255,.76);
        border:1px solid rgba(207,238,250,.92);
        color:#6f8fa1;
        font:1000 10px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        text-align:center;
        box-shadow:0 10px 22px rgba(33,79,100,.08);
        opacity:.70;
      }

      .hha-cvr-step-pill.on{
        opacity:1;
        color:#214f64;
        background:rgba(255,255,255,.95);
        border-color:rgba(66,165,255,.50);
        box-shadow:
          0 10px 24px rgba(33,79,100,.12),
          0 0 0 4px rgba(66,165,255,.10);
      }

      .hha-cvr-step-pill.ready{
        color:#1f6a43;
        border-color:rgba(126,217,87,.75);
        box-shadow:
          0 10px 24px rgba(33,79,100,.12),
          0 0 0 4px rgba(126,217,87,.14);
      }

      body.hha-cvr-clarity .gate.hha-answer-gate{
        border-color:#42a5ff !important;
        box-shadow:
          0 0 0 5px rgba(66,165,255,.18),
          0 0 36px rgba(66,165,255,.28),
          0 18px 34px rgba(66,165,255,.12) !important;
      }

      body.hha-cvr-clarity .gate.hha-answer-gate::before{
        border-color:rgba(66,165,255,.72) !important;
        box-shadow:
          inset 0 0 24px rgba(66,165,255,.18),
          0 0 24px rgba(66,165,255,.18) !important;
      }

      body.hha-cvr-clarity .gate.hha-answer-gate .gateLabel::after{
        content:"  🎯";
      }

      body.hha-cvr-clarity .gate.hha-ready-gate{
        border-color:#7ed957 !important;
        background:
          radial-gradient(circle at 50% 12%, #edffe8, rgba(255,255,255,.98) 58%, #dfffd6) !important;
        animation:hhaReadyGateTap .48s ease-in-out infinite;
        box-shadow:
          0 0 0 7px rgba(126,217,87,.18),
          0 0 42px rgba(126,217,87,.42),
          0 20px 42px rgba(126,217,87,.18) !important;
      }

      body.hha-cvr-clarity .gate.hha-ready-gate .gateNum::after{
        content:" แตะ!";
        position:absolute;
        left:50%;
        top:-24px;
        transform:translateX(-50%);
        min-width:58px;
        padding:4px 8px;
        border-radius:999px;
        background:#7ed957;
        color:#154225;
        font-size:10px;
        font-weight:1000;
        box-shadow:0 10px 20px rgba(126,217,87,.24);
      }

      @keyframes hhaReadyGateTap{
        0%,100%{transform:translateY(-12px) scale(1.08)}
        50%{transform:translateY(-18px) scale(1.12)}
      }

      .hha-cvr-target-beacon{
        position:fixed;
        z-index:238;
        width:82px;
        height:82px;
        border-radius:999px;
        border:4px solid rgba(66,165,255,.65);
        box-shadow:
          0 0 0 8px rgba(66,165,255,.14),
          0 0 42px rgba(66,165,255,.30);
        transform:translate(-50%,-50%);
        pointer-events:none;
        opacity:0;
        transition:.12s ease;
      }

      .hha-cvr-target-beacon.show{
        opacity:1;
      }

      .hha-cvr-target-beacon.ready{
        border-color:rgba(126,217,87,.88);
        box-shadow:
          0 0 0 10px rgba(126,217,87,.18),
          0 0 48px rgba(126,217,87,.38);
        animation:hhaBeaconReady .48s ease-in-out infinite;
      }

      @keyframes hhaBeaconReady{
        0%,100%{transform:translate(-50%,-50%) scale(1)}
        50%{transform:translate(-50%,-50%) scale(1.14)}
      }

      .hha-cvr-path-line{
        position:fixed;
        left:50%;
        top:50%;
        height:4px;
        border-radius:999px;
        transform-origin:0 50%;
        z-index:237;
        pointer-events:none;
        opacity:0;
        background:linear-gradient(90deg,rgba(66,165,255,.78),rgba(255,255,255,.45),rgba(66,165,255,0));
        box-shadow:0 0 18px rgba(66,165,255,.30);
        transition:opacity .12s ease;
      }

      .hha-cvr-path-line.show{
        opacity:.72;
      }

      .hha-cvr-path-line.ready{
        background:linear-gradient(90deg,rgba(126,217,87,.90),rgba(255,255,255,.55),rgba(126,217,87,0));
        box-shadow:0 0 22px rgba(126,217,87,.38);
        opacity:.90;
      }

      body.hha-cvr-clarity .foodToken.hha-food-waiting{
        border-color:#42a5ff !important;
      }

      body.hha-cvr-clarity .foodToken.hha-food-selected-clear{
        border-color:#7ed957 !important;
        box-shadow:
          0 0 0 10px rgba(126,217,87,.18),
          0 0 42px rgba(126,217,87,.34),
          0 20px 46px rgba(126,217,87,.20) !important;
      }

      body.hha-cvr-clarity .foodToken.hha-food-selected-clear::after{
        content:"LOCK";
        position:absolute;
        left:50%;
        top:-20px;
        transform:translateX(-50%);
        padding:3px 8px;
        border-radius:999px;
        background:#7ed957;
        color:#154225;
        font-size:10px;
        font-weight:1000;
        box-shadow:0 8px 18px rgba(126,217,87,.22);
      }

      body.summaryOpen .hha-cvr-clarity-cue,
      body.summaryOpen .hha-cvr-step-pills,
      body.summaryOpen .hha-cvr-target-beacon,
      body.summaryOpen .hha-cvr-path-line{
        display:none !important;
      }

      @media (max-height:620px){
        .hha-cvr-clarity-cue{
          top:calc(50% - 72px);
          min-height:36px;
          padding:6px 10px;
          font-size:11px;
        }

        .hha-cvr-clarity-cue small{
          font-size:9px;
        }

        .hha-cvr-step-pills{
          top:calc(50% - 35px);
          gap:4px;
        }

        .hha-cvr-step-pill{
          min-width:70px;
          padding:4px 7px;
          font-size:8px;
        }

        .hha-cvr-target-beacon{
          width:62px;
          height:62px;
          border-width:3px;
        }

        body.hha-cvr-clarity .gate.hha-ready-gate .gateNum::after{
          top:-20px;
          min-width:46px;
          padding:3px 6px;
          font-size:8px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureUi(){
    if (!$('.hha-cvr-clarity-cue')) {
      var cue = document.createElement('div');
      cue.className = 'hha-cvr-clarity-cue pick';
      cue.innerHTML = 'มองอาหารแล้วแตะ<small>ขั้นที่ 1: เลือกอาหารก่อน</small>';
      document.body.appendChild(cue);
    }

    if (!$('.hha-cvr-step-pills')) {
      var steps = document.createElement('div');
      steps.className = 'hha-cvr-step-pills';
      steps.innerHTML = [
        '<div class="hha-cvr-step-pill" data-step="1">1 เลือกอาหาร</div>',
        '<div class="hha-cvr-step-pill" data-step="2">2 รอ Portal</div>',
        '<div class="hha-cvr-step-pill" data-step="3">3 แตะส่ง</div>'
      ].join('');
      document.body.appendChild(steps);
    }

    if (!$('.hha-cvr-target-beacon')) {
      var beacon = document.createElement('div');
      beacon.className = 'hha-cvr-target-beacon';
      document.body.appendChild(beacon);
    }

    if (!$('.hha-cvr-path-line')) {
      var line = document.createElement('div');
      line.className = 'hha-cvr-path-line';
      document.body.appendChild(line);
    }
  }

  function foodGroupMap(name){
    var map = {
      'ไข่':1,
      'ปลา':1,
      'ไก่':1,
      'นม':1,
      'ถั่ว':1,

      'ข้าว':2,
      'ขนมปัง':2,
      'มันเทศ':2,
      'เส้นก๋วยเตี๋ยว':2,
      'ข้าวโพด':2,

      'บรอกโคลี':3,
      'แครอท':3,
      'ผักใบเขียว':3,
      'มะเขือเทศ':3,
      'แตงกวา':3,

      'กล้วย':4,
      'ส้ม':4,
      'แอปเปิล':4,
      'องุ่น':4,
      'มะม่วง':4,

      'น้ำมัน':5,
      'เนย':5,
      'กะทิ':5,
      'อะโวคาโด':5,
      'ถั่วเปลือกแข็ง':5
    };

    return map[name] || null;
  }

  function getTargetGroup(){
    var selected = textOf($('#selectedFood'));
    var target = textOf($('#targetText'));
    var cue = textOf($('.hha-vr-coach'));
    var foodName = textOf($('#foodName'));
    var all = selected + ' ' + target + ' ' + cue;

    var m = all.match(/หมู่\s*([1-5])/);
    if (m) return Number(m[1]);

    return foodGroupMap(foodName);
  }

  function isFoodSelected(){
    var selected = textOf($('#selectedFood'));
    var target = textOf($('#targetText'));
    var coach = textOf($('.hha-vr-coach'));

    return (
      selected.indexOf('เลือกแล้ว') >= 0 ||
      selected.indexOf('คำตอบคือ') >= 0 ||
      selected.indexOf('Portal') >= 0 ||
      target.indexOf('อยู่หมู่ไหน') >= 0 ||
      coach.indexOf('คำตอบคือ') >= 0
    );
  }

  function getGateNumber(gate){
    if (!gate) return null;

    var d = Number(gate.dataset && gate.dataset.gate);
    if (d >= 1 && d <= 5) return d;

    var m = textOf(gate).match(/[1-5]/);
    return m ? Number(m[0]) : null;
  }

  function getActiveGateNumber(){
    var active = $('.gate.active') || $('.gate.hha-ready-gate');
    return getGateNumber(active);
  }

  function getGateByNumber(n){
    return $all('.gate').find(function(gate){
      return getGateNumber(gate) === Number(n);
    }) || null;
  }

  function centerOf(el){
    if (!el) return null;
    var r = el.getBoundingClientRect();

    return {
      x:r.left + r.width / 2,
      y:r.top + r.height / 2,
      w:r.width,
      h:r.height
    };
  }

  function updateLineToGate(gate, ready){
    var line = $('.hha-cvr-path-line');
    var beacon = $('.hha-cvr-target-beacon');

    if (!line || !beacon || !gate) {
      if (line) line.classList.remove('show','ready');
      if (beacon) beacon.classList.remove('show','ready');
      return;
    }

    var centerX = window.innerWidth / 2;
    var centerY = window.innerHeight / 2;
    var c = centerOf(gate);

    if (!c) return;

    var dx = c.x - centerX;
    var dy = c.y - centerY;
    var len = Math.max(20, Math.hypot(dx,dy) - 38);
    var angle = Math.atan2(dy,dx) * 180 / Math.PI;

    line.style.width = len + 'px';
    line.style.transform = 'rotate(' + angle + 'deg)';
    line.classList.add('show');
    line.classList.toggle('ready', !!ready);

    beacon.style.left = c.x + 'px';
    beacon.style.top = c.y + 'px';
    beacon.classList.add('show');
    beacon.classList.toggle('ready', !!ready);
  }

  function setSteps(selected, ready){
    $all('.hha-cvr-step-pill').forEach(function(el){
      el.classList.remove('on','ready');
    });

    var s1 = $('.hha-cvr-step-pill[data-step="1"]');
    var s2 = $('.hha-cvr-step-pill[data-step="2"]');
    var s3 = $('.hha-cvr-step-pill[data-step="3"]');

    if (!selected) {
      if (s1) s1.classList.add('on');
      return;
    }

    if (ready) {
      if (s3) s3.classList.add('on','ready');
    } else {
      if (s2) s2.classList.add('on');
    }
  }

  function updateCue(selected, targetGroup, activeGate, ready){
    var cue = $('.hha-cvr-clarity-cue');
    if (!cue) return;

    cue.classList.remove('pick','wait','ready','wrong');

    if (!selected) {
      cue.classList.add('pick');
      cue.innerHTML = 'มองอาหารกลางฉาก แล้วแตะ 1 ครั้ง<small>ขั้นที่ 1: เลือกอาหารก่อน</small>';
      return;
    }

    if (!targetGroup) {
      cue.classList.add('wait');
      cue.innerHTML = 'เลือกอาหารแล้ว • ดูว่าอยู่หมู่ไหน<small>รอระบบบอกคำตอบ แล้วแตะที่ Portal ที่ถูก</small>';
      return;
    }

    if (ready) {
      cue.classList.add('ready');
      cue.innerHTML = 'แตะเลย! Portal หมู่ ' + targetGroup + ' สว่างแล้ว ✅<small>แตะจอ 1 ครั้งเพื่อส่งอาหารเข้า Portal</small>';
    } else {
      cue.classList.add('wait');
      cue.innerHTML = 'รอ Portal หมู่ ' + targetGroup + ' สว่างก่อน<small>ตอนนี้สว่างอยู่หมู่ ' + (activeGate || '-') + ' • อย่าเพิ่งแตะ</small>';
    }
  }

  function updateGateMarks(targetGroup, activeGate, ready){
    $all('.gate').forEach(function(gate){
      var n = getGateNumber(gate);
      gate.classList.toggle('hha-answer-gate', !!targetGroup && n === targetGroup);
      gate.classList.toggle('hha-ready-gate', !!ready && n === targetGroup);
    });
  }

  function updateFoodState(selected){
    var food = $('#foodToken');
    if (!food) return;

    food.classList.toggle('hha-food-waiting', !selected);
    food.classList.toggle('hha-food-selected-clear', !!selected);
  }

  function updateTargetPanel(selected, targetGroup, ready){
    var targetText = $('#targetText');

    if (!targetText) return;

    if (!selected) {
      targetText.textContent = 'มองอาหาร แล้วแตะเพื่อเลือกก่อน';
      return;
    }

    if (targetGroup && ready) {
      targetText.textContent = 'Portal หมู่ ' + targetGroup + ' สว่างแล้ว แตะเลย!';
      return;
    }

    if (targetGroup) {
      targetText.textContent = 'คำตอบคือหมู่ ' + targetGroup + ' รอ Portal หมู่นี้สว่าง';
    }
  }

  function scan(){
    if (document.body.classList.contains('summaryOpen')) return;

    document.body.classList.add('hha-cvr-clarity');
    document.documentElement.classList.add('hha-cvr-clarity');

    ensureUi();

    var selected = isFoodSelected();
    var targetGroup = getTargetGroup();
    var activeGate = getActiveGateNumber();
    var ready = !!(selected && targetGroup && activeGate === targetGroup);

    var gate = targetGroup ? getGateByNumber(targetGroup) : null;

    updateFoodState(selected);
    updateGateMarks(targetGroup, activeGate, ready);
    updateCue(selected, targetGroup, activeGate, ready);
    updateTargetPanel(selected, targetGroup, ready);
    setSteps(selected, ready);

    if (selected && gate) updateLineToGate(gate, ready);
    else updateLineToGate(null, false);
  }

  function bind(){
    if (document.__hhaGroupsCvrClarityV4Bound) return;
    document.__hhaGroupsCvrClarityV4Bound = true;

    document.addEventListener('click', function(){
      setTimeout(scan, 30);
      setTimeout(scan, 160);
      setTimeout(scan, 340);
    }, true);

    document.addEventListener('keydown', function(){
      setTimeout(scan, 30);
      setTimeout(scan, 160);
      setTimeout(scan, 340);
    }, true);

    window.addEventListener('resize', function(){
      setTimeout(scan, 120);
    }, { passive:true });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_CVR_CLARITY_V4_SCAN__);
      window.__HHA_CVR_CLARITY_V4_SCAN__ = setTimeout(scan, 60);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','style','data-gate']
    });

    setInterval(scan, 260);
  }

  function boot(){
    addStyle();
    ensureUi();
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
