/* =========================================================
   HeroHealth Groups cVR
   PATCH: v20260524-groups-cvr-vr-feeling-v2
   File: /herohealth/patches/groups/groups-cvr-vr-feeling-v2.js

   Purpose:
   - Add VR feeling layer to standalone groups-cvr.html
   - Depth scene / portal gates / lock-on / beam / haptic
   - Safe visual-only upgrade: does not change game scoring logic
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260524-groups-cvr-vr-feeling-v2';

  if (window.__HHA_GROUPS_CVR_VR_FEELING_V2__) return;
  window.__HHA_GROUPS_CVR_VR_FEELING_V2__ = true;

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
    if ($('#hha-groups-cvr-vr-feeling-v2-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-groups-cvr-vr-feeling-v2-style';

    style.textContent = `
      body.hha-cvr-vrfeel{
        background:
          radial-gradient(circle at 50% 8%, rgba(255,255,255,.85), transparent 18%),
          radial-gradient(circle at 18% 18%, rgba(126,217,87,.28), transparent 26%),
          radial-gradient(circle at 86% 18%, rgba(97,187,255,.30), transparent 28%),
          linear-gradient(180deg,#e9ffff 0%,#e6f8ff 48%,#d4f4ff 100%) !important;
      }

      body.hha-cvr-vrfeel .arena{
        background:
          radial-gradient(ellipse at 50% 18%, rgba(255,255,255,.70), transparent 28%),
          linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,.12)),
          linear-gradient(90deg, rgba(33,79,100,.05) 1px, transparent 1px),
          linear-gradient(0deg, rgba(33,79,100,.04) 1px, transparent 1px) !important;
        background-size:auto, auto, 90px 90px, 90px 90px !important;
        border:2px solid rgba(199,238,250,.95) !important;
        box-shadow:
          inset 0 0 90px rgba(255,255,255,.38),
          inset 0 -40px 90px rgba(72,180,255,.10),
          0 16px 45px rgba(33,79,100,.10) !important;
      }

      .hha-depth-scene{
        position:absolute;
        inset:0;
        z-index:1;
        pointer-events:none;
        overflow:hidden;
      }

      .hha-horizon{
        position:absolute;
        left:50%;
        top:47%;
        width:120vw;
        height:2px;
        transform:translateX(-50%);
        background:linear-gradient(90deg, transparent, rgba(72,164,205,.38), transparent);
        box-shadow:0 0 22px rgba(72,164,205,.20);
      }

      .hha-depth-floor{
        position:absolute;
        left:50%;
        bottom:-18%;
        width:120vw;
        height:55%;
        transform:translateX(-50%) perspective(420px) rotateX(64deg);
        transform-origin:50% 100%;
        background:
          linear-gradient(90deg, rgba(54,150,180,.16) 1px, transparent 1px),
          linear-gradient(0deg, rgba(54,150,180,.16) 1px, transparent 1px);
        background-size:70px 70px;
        opacity:.42;
        filter:blur(.15px);
        mask-image:linear-gradient(to top, black, transparent 90%);
      }

      .hha-depth-ring{
        position:absolute;
        left:50%;
        top:50%;
        width:220px;
        height:220px;
        margin-left:-110px;
        margin-top:-110px;
        border-radius:999px;
        border:2px solid rgba(66,165,255,.10);
        box-shadow:0 0 40px rgba(66,165,255,.08);
        animation:hhaCvrRing 4.2s ease-in-out infinite;
      }

      .hha-depth-ring.r2{
        width:420px;
        height:420px;
        margin-left:-210px;
        margin-top:-210px;
        animation-delay:.7s;
        opacity:.7;
      }

      .hha-depth-ring.r3{
        width:680px;
        height:680px;
        margin-left:-340px;
        margin-top:-340px;
        animation-delay:1.4s;
        opacity:.45;
      }

      @keyframes hhaCvrRing{
        0%,100%{transform:scale(.96);opacity:.35}
        50%{transform:scale(1.05);opacity:.75}
      }

      body.hha-cvr-vrfeel .foodToken{
        animation:hhaFoodFloat 2.4s ease-in-out infinite;
        box-shadow:
          0 0 0 8px rgba(255,217,102,.16),
          0 20px 45px rgba(255,170,70,.24),
          inset 0 0 22px rgba(255,255,255,.84) !important;
      }

      body.hha-cvr-vrfeel .foodToken::before{
        content:"";
        position:absolute;
        inset:-14px;
        border-radius:999px;
        border:2px solid rgba(255,217,102,.34);
        box-shadow:0 0 28px rgba(255,217,102,.22);
        animation:hhaFoodAura 1.8s ease-in-out infinite;
        pointer-events:none;
      }

      body.hha-cvr-vrfeel .foodToken.aim,
      body.hha-cvr-vrfeel .foodToken.hha-locking{
        border-color:#42a5ff !important;
        box-shadow:
          0 0 0 10px rgba(66,165,255,.20),
          0 0 36px rgba(66,165,255,.38),
          0 22px 50px rgba(66,165,255,.30) !important;
      }

      body.hha-cvr-vrfeel .foodToken.hha-selected{
        border-color:#7ed957 !important;
        box-shadow:
          0 0 0 10px rgba(126,217,87,.18),
          0 0 36px rgba(126,217,87,.34),
          0 22px 50px rgba(126,217,87,.22) !important;
      }

      @keyframes hhaFoodFloat{
        0%,100%{transform:translate3d(0,-4px,0) scale(1)}
        50%{transform:translate3d(0,5px,0) scale(1.035)}
      }

      @keyframes hhaFoodAura{
        0%,100%{transform:scale(.92);opacity:.36}
        50%{transform:scale(1.08);opacity:.78}
      }

      body.hha-cvr-vrfeel .gate{
        position:relative !important;
        background:
          radial-gradient(circle at 50% 10%, rgba(255,255,255,.96), rgba(255,255,255,.78) 55%, rgba(235,250,255,.90)) !important;
        box-shadow:
          inset 0 0 18px rgba(255,255,255,.85),
          0 10px 22px rgba(33,79,100,.12) !important;
      }

      body.hha-cvr-vrfeel .gate::before{
        content:"";
        position:absolute;
        inset:5px;
        border-radius:14px;
        border:2px solid rgba(66,165,255,.15);
        box-shadow:inset 0 0 16px rgba(66,165,255,.08);
        pointer-events:none;
      }

      body.hha-cvr-vrfeel .gate::after{
        content:"";
        position:absolute;
        left:50%;
        top:50%;
        width:54px;
        height:54px;
        transform:translate(-50%,-50%) scale(.85);
        border-radius:999px;
        border:2px solid rgba(66,165,255,.14);
        opacity:.45;
        pointer-events:none;
      }

      body.hha-cvr-vrfeel .gate.active{
        background:
          radial-gradient(circle at 50% 12%, #fff9cd, rgba(255,255,255,.95) 58%, #fff3b4) !important;
        border-color:#ffb84d !important;
        box-shadow:
          0 0 0 5px rgba(255,184,77,.20),
          0 0 30px rgba(255,184,77,.28),
          0 18px 36px rgba(255,159,67,.18) !important;
      }

      body.hha-cvr-vrfeel .gate.active::before{
        border-color:rgba(255,159,67,.55);
        box-shadow:
          inset 0 0 20px rgba(255,159,67,.20),
          0 0 20px rgba(255,159,67,.16);
      }

      body.hha-cvr-vrfeel .gate.active::after{
        border-color:rgba(255,159,67,.80);
        opacity:.85;
        animation:hhaPortalPulse .62s ease-in-out infinite;
      }

      body.hha-cvr-vrfeel .gate.hha-target-portal{
        border-color:#42a5ff !important;
      }

      body.hha-cvr-vrfeel .gate.hha-target-portal::before{
        border-color:rgba(66,165,255,.50);
      }

      body.hha-cvr-vrfeel .gate.hha-target-portal .gateNum::after{
        content:" 🎯";
      }

      body.hha-cvr-vrfeel .gate.correctFlash{
        box-shadow:
          0 0 0 6px rgba(126,217,87,.22),
          0 0 36px rgba(126,217,87,.42) !important;
      }

      body.hha-cvr-vrfeel .gate.wrongFlash{
        box-shadow:
          0 0 0 6px rgba(255,107,107,.18),
          0 0 32px rgba(255,107,107,.35) !important;
      }

      @keyframes hhaPortalPulse{
        0%,100%{transform:translate(-50%,-50%) scale(.78)}
        50%{transform:translate(-50%,-50%) scale(1.05)}
      }

      body.hha-cvr-vrfeel .crosshair{
        border-color:rgba(33,79,100,.72) !important;
        box-shadow:
          0 0 0 4px rgba(255,255,255,.56),
          0 0 24px rgba(66,165,255,.18) !important;
      }

      body.hha-cvr-vrfeel .crosshair.hha-lock{
        border-color:#42a5ff !important;
        animation:hhaCrossLock .55s ease-in-out infinite;
        box-shadow:
          0 0 0 6px rgba(66,165,255,.18),
          0 0 28px rgba(66,165,255,.38) !important;
      }

      body.hha-cvr-vrfeel .crosshair.hha-ready{
        border-color:#7ed957 !important;
        box-shadow:
          0 0 0 6px rgba(126,217,87,.18),
          0 0 28px rgba(126,217,87,.34) !important;
      }

      @keyframes hhaCrossLock{
        0%,100%{transform:translate(-50%,-50%) scale(1)}
        50%{transform:translate(-50%,-50%) scale(1.09)}
      }

      .hha-vr-beam{
        position:fixed;
        left:50%;
        top:50%;
        width:3px;
        height:46vh;
        transform-origin:50% 0%;
        transform:translate(-50%,0) rotate(var(--beam-rot,0deg));
        z-index:77;
        border-radius:999px;
        background:linear-gradient(to bottom, rgba(66,165,255,.95), rgba(126,217,87,.36), transparent);
        box-shadow:0 0 18px rgba(66,165,255,.55);
        pointer-events:none;
        opacity:0;
        animation:hhaBeam .26s ease-out forwards;
      }

      @keyframes hhaBeam{
        0%{opacity:0; height:0}
        24%{opacity:1; height:46vh}
        100%{opacity:0; height:52vh}
      }

      .hha-vr-flash{
        position:fixed;
        inset:0;
        z-index:76;
        pointer-events:none;
        opacity:0;
        animation:hhaFlash .28s ease-out forwards;
      }

      .hha-vr-flash.good{
        background:radial-gradient(circle at 50% 50%, rgba(126,217,87,.28), transparent 55%);
      }

      .hha-vr-flash.bad{
        background:radial-gradient(circle at 50% 50%, rgba(255,107,107,.22), transparent 55%);
      }

      @keyframes hhaFlash{
        0%{opacity:0}
        35%{opacity:1}
        100%{opacity:0}
      }

      .hha-vr-coach{
        position:fixed;
        left:50%;
        top:calc(50% - 76px);
        transform:translateX(-50%);
        z-index:84;
        max-width:min(520px,76vw);
        padding:7px 12px;
        border-radius:999px;
        background:rgba(255,255,255,.90);
        border:1px solid rgba(207,238,250,.95);
        box-shadow:0 14px 30px rgba(33,79,100,.12);
        color:#397b9c;
        font:1000 12px/1.25 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        text-align:center;
        pointer-events:none;
        opacity:.92;
        transition:.2s ease;
      }

      .hha-vr-coach.dim{
        opacity:.45;
        transform:translateX(-50%) translateY(-4px) scale(.92);
      }

      body.summaryOpen .hha-vr-coach,
      body.summaryOpen .hha-vr-beam,
      body.summaryOpen .hha-vr-flash{
        display:none !important;
      }

      @media (max-height:620px){
        .hha-vr-coach{
          top:calc(50% - 58px);
          font-size:10px;
          padding:5px 9px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureScene(){
    var arena = $('.arena');
    if (!arena) return;

    if (!$('.hha-depth-scene', arena)) {
      var scene = document.createElement('div');
      scene.className = 'hha-depth-scene';
      scene.innerHTML = [
        '<div class="hha-horizon"></div>',
        '<div class="hha-depth-ring r1"></div>',
        '<div class="hha-depth-ring r2"></div>',
        '<div class="hha-depth-ring r3"></div>',
        '<div class="hha-depth-floor"></div>'
      ].join('');
      arena.insertBefore(scene, arena.firstChild);
    }
  }

  function ensureCoach(){
    if ($('.hha-vr-coach')) return;

    var coach = document.createElement('div');
    coach.className = 'hha-vr-coach';
    coach.textContent = 'มองอาหารแล้วแตะ • จากนั้นมองประตูหมู่ที่ถูก แล้วแตะอีกครั้ง';
    document.body.appendChild(coach);

    setTimeout(function(){
      coach.classList.add('dim');
    }, 7000);
  }

  function getFoodGroupFromText(){
    var selected = $('#selectedFood');
    var target = $('#targetText');
    var txt = textOf(selected) + ' ' + textOf(target);

    var m = txt.match(/หมู่\s*([1-5])/);
    if (m) return Number(m[1]);

    var foodName = textOf($('#foodName'));
    var map = {
      'ไข่':1,'ปลา':1,'ไก่':1,'นม':1,'ถั่ว':1,
      'ข้าว':2,'ขนมปัง':2,'มันเทศ':2,'เส้นก๋วยเตี๋ยว':2,'ข้าวโพด':2,
      'บรอกโคลี':3,'แครอท':3,'ผักใบเขียว':3,'มะเขือเทศ':3,'แตงกวา':3,
      'กล้วย':4,'ส้ม':4,'แอปเปิล':4,'องุ่น':4,'มะม่วง':4,
      'น้ำมัน':5,'เนย':5,'กะทิ':5,'อะโวคาโด':5,'ถั่วเปลือกแข็ง':5
    };

    return map[foodName] || null;
  }

  function updateLockState(){
    var food = $('#foodToken');
    var cross = $('.crosshair');
    var selected = textOf($('#selectedFood'));

    if (!food || !cross) return;

    var isSelected =
      selected.indexOf('เลือกแล้ว') >= 0 ||
      selected.indexOf('ประตูที่ถูก') >= 0;

    food.classList.toggle('hha-selected', isSelected);

    var aimingFood = food.classList.contains('aim') || !isSelected;
    cross.classList.toggle('hha-lock', aimingFood && !isSelected);
    cross.classList.toggle('hha-ready', isSelected);

    var targetGroup = getFoodGroupFromText();

    $all('.gate').forEach(function(g){
      var n = Number(g.dataset.gate || textOf(g).match(/[1-5]/)?.[0]);
      g.classList.toggle('hha-target-portal', !!targetGroup && n === targetGroup && isSelected);
    });

    var coach = $('.hha-vr-coach');

    if (coach && !document.body.classList.contains('summaryOpen')) {
      if (isSelected && targetGroup) {
        coach.textContent = 'คำตอบคือหมู่ ' + targetGroup + ' • แตะตอนประตูนี้สว่าง!';
      } else {
        coach.textContent = 'มองอาหารกลางฉาก แล้วแตะเพื่อเลือก';
      }
    }
  }

  function beam(){
    var b = document.createElement('div');
    b.className = 'hha-vr-beam';
    b.style.setProperty('--beam-rot', ((Math.random() * 8) - 4).toFixed(2) + 'deg');
    document.body.appendChild(b);

    setTimeout(function(){
      b.remove();
    }, 360);
  }

  function flash(kind){
    var f = document.createElement('div');
    f.className = 'hha-vr-flash ' + (kind || 'good');
    document.body.appendChild(f);

    setTimeout(function(){
      f.remove();
    }, 360);
  }

  function vibrate(pattern){
    try {
      if (navigator.vibrate) navigator.vibrate(pattern || 24);
    } catch(e) {}
  }

  function bindFeedback(){
    if (document.__hhaGroupsCvrVrFeelFeedbackBound) return;
    document.__hhaGroupsCvrVrFeelFeedbackBound = true;

    document.addEventListener('click', function(){
      if (document.body.classList.contains('summaryOpen')) return;

      beam();
      vibrate(18);

      setTimeout(updateLockState, 40);
      setTimeout(updateLockState, 180);
    }, true);

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_CVR_VRFEEL_SCAN__);
      window.__HHA_CVR_VRFEEL_SCAN__ = setTimeout(function(){
        updateLockState();

        var toast = textOf($('#toast'));
        if (toast.indexOf('ถูกต้อง') >= 0 || toast.indexOf('Mission Clear') >= 0) {
          flash('good');
          vibrate([25,20,25]);
        }

        if (toast.indexOf('ยังไม่ใช่') >= 0 || toast.indexOf('ต้องเข้า') >= 0) {
          flash('bad');
          vibrate([35,20,35]);
        }
      }, 50);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','style']
    });
  }

  function mark(){
    document.body.classList.add('hha-cvr-vrfeel');
    document.documentElement.classList.add('hha-cvr-vrfeel');
  }

  function boot(){
    mark();
    addStyle();
    ensureScene();
    ensureCoach();
    bindFeedback();
    updateLockState();

    [120,300,600,1200,2500,5000].forEach(function(ms){
      setTimeout(function(){
        mark();
        ensureScene();
        ensureCoach();
        updateLockState();
      }, ms);
    });

    console.info('[HeroHealth Groups cVR]', PATCH_ID, 'ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
