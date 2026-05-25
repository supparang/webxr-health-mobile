/* =========================================================
   HeroHealth Groups cVR
   PATCH: v20260524-groups-cvr-vr-feeling-v3-portal-throw
   File: /herohealth/patches/groups/groups-cvr-vr-feeling-v3-portal-throw.js

   Purpose:
   - Add deeper VR feeling to standalone groups-cvr.html
   - Curved portal gate deck
   - Food fly-to-portal animation after choosing gate
   - Success / wrong particles + shake + haptic
   - Visual-only: does not change scoring logic
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260524-groups-cvr-vr-feeling-v3-portal-throw';

  if (window.__HHA_GROUPS_CVR_VR_FEELING_V3_PORTAL_THROW__) return;
  window.__HHA_GROUPS_CVR_VR_FEELING_V3_PORTAL_THROW__ = true;

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
    if ($('#hha-groups-cvr-vr-feeling-v3-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-groups-cvr-vr-feeling-v3-style';

    style.textContent = `
      body.hha-cvr-vrfeel-v3 .gates{
        perspective:620px !important;
        transform-style:preserve-3d !important;
        align-items:end !important;
      }

      body.hha-cvr-vrfeel-v3 .gate{
        transform-style:preserve-3d !important;
        overflow:visible !important;
      }

      body.hha-cvr-vrfeel-v3 .gate.hha-portal-gate{
        position:relative !important;
        transform-origin:50% 95% !important;
        isolation:isolate !important;
      }

      body.hha-cvr-vrfeel-v3 .gate.hha-portal-gate::before{
        content:"" !important;
        position:absolute !important;
        left:50% !important;
        top:50% !important;
        width:58px !important;
        height:58px !important;
        transform:translate(-50%,-50%) !important;
        border-radius:999px !important;
        background:
          radial-gradient(circle, rgba(255,255,255,.95) 0 26%, rgba(66,165,255,.18) 28% 44%, transparent 48%) !important;
        border:2px solid rgba(66,165,255,.26) !important;
        box-shadow:
          inset 0 0 18px rgba(255,255,255,.85),
          0 0 18px rgba(66,165,255,.18) !important;
        opacity:.65 !important;
        pointer-events:none !important;
        z-index:-1 !important;
      }

      body.hha-cvr-vrfeel-v3 .gate.hha-portal-gate::after{
        content:"" !important;
        position:absolute !important;
        left:50% !important;
        bottom:-12px !important;
        width:70% !important;
        height:12px !important;
        transform:translateX(-50%) rotateX(68deg) !important;
        border-radius:999px !important;
        background:radial-gradient(ellipse, rgba(33,79,100,.24), transparent 70%) !important;
        filter:blur(2px) !important;
        opacity:.52 !important;
        pointer-events:none !important;
        z-index:-2 !important;
      }

      body.hha-cvr-vrfeel-v3 .gate.hha-gate-1{
        transform:translateY(7px) rotateZ(-4deg) rotateX(4deg) scale(.94) !important;
      }

      body.hha-cvr-vrfeel-v3 .gate.hha-gate-2{
        transform:translateY(-2px) rotateZ(-2deg) rotateX(2deg) scale(.98) !important;
      }

      body.hha-cvr-vrfeel-v3 .gate.hha-gate-3{
        transform:translateY(-8px) rotateX(0deg) scale(1.03) !important;
      }

      body.hha-cvr-vrfeel-v3 .gate.hha-gate-4{
        transform:translateY(-2px) rotateZ(2deg) rotateX(2deg) scale(.98) !important;
      }

      body.hha-cvr-vrfeel-v3 .gate.hha-gate-5{
        transform:translateY(7px) rotateZ(4deg) rotateX(4deg) scale(.94) !important;
      }

      body.hha-cvr-vrfeel-v3 .gate.hha-portal-gate.active{
        transform:translateY(-12px) scale(1.08) !important;
        z-index:20 !important;
      }

      body.hha-cvr-vrfeel-v3 .gate.hha-portal-gate.active::before{
        opacity:1 !important;
        border-color:rgba(255,184,77,.90) !important;
        background:
          radial-gradient(circle, rgba(255,255,255,1) 0 24%, rgba(255,217,102,.38) 28% 46%, transparent 50%) !important;
        box-shadow:
          inset 0 0 20px rgba(255,255,255,.95),
          0 0 24px rgba(255,184,77,.45),
          0 0 44px rgba(255,184,77,.22) !important;
        animation:hhaPortalV3Spin .72s linear infinite !important;
      }

      body.hha-cvr-vrfeel-v3 .gate.hha-target-portal{
        box-shadow:
          0 0 0 4px rgba(66,165,255,.18),
          0 0 28px rgba(66,165,255,.28) !important;
      }

      body.hha-cvr-vrfeel-v3 .gate.hha-target-portal::before{
        border-color:rgba(66,165,255,.78) !important;
        box-shadow:
          inset 0 0 20px rgba(255,255,255,.95),
          0 0 28px rgba(66,165,255,.42) !important;
      }

      @keyframes hhaPortalV3Spin{
        0%{filter:hue-rotate(0deg) brightness(1)}
        50%{filter:hue-rotate(12deg) brightness(1.08)}
        100%{filter:hue-rotate(0deg) brightness(1)}
      }

      .hha-food-ghost{
        position:fixed;
        width:72px;
        height:72px;
        border-radius:999px;
        display:grid;
        place-items:center;
        z-index:210;
        pointer-events:none;
        background:rgba(255,255,255,.94);
        border:4px solid rgba(255,217,102,.95);
        box-shadow:
          0 0 0 8px rgba(255,217,102,.18),
          0 18px 42px rgba(255,160,67,.24),
          inset 0 0 18px rgba(255,255,255,.85);
        transform:translate(-50%,-50%);
      }

      .hha-food-ghost .hha-food-ghost-emoji{
        font-size:36px;
        line-height:1;
        transform:translateY(-2px);
      }

      .hha-food-ghost.good{
        border-color:#7ed957;
        box-shadow:
          0 0 0 10px rgba(126,217,87,.18),
          0 0 32px rgba(126,217,87,.38),
          0 18px 42px rgba(126,217,87,.24);
      }

      .hha-food-ghost.bad{
        border-color:#ff6b6b;
        box-shadow:
          0 0 0 10px rgba(255,107,107,.16),
          0 0 30px rgba(255,107,107,.34),
          0 18px 42px rgba(255,107,107,.18);
      }

      .hha-portal-particle{
        position:fixed;
        width:8px;
        height:8px;
        border-radius:999px;
        z-index:212;
        pointer-events:none;
        transform:translate(-50%,-50%);
        opacity:0;
      }

      .hha-portal-particle.good{
        background:#7ed957;
        box-shadow:0 0 16px rgba(126,217,87,.90);
      }

      .hha-portal-particle.bad{
        background:#ff6b6b;
        box-shadow:0 0 16px rgba(255,107,107,.90);
      }

      .hha-portal-ripple{
        position:fixed;
        width:26px;
        height:26px;
        border-radius:999px;
        z-index:211;
        pointer-events:none;
        transform:translate(-50%,-50%);
        border:3px solid rgba(255,255,255,.85);
        box-shadow:0 0 24px rgba(255,255,255,.46);
        opacity:0;
      }

      .hha-portal-ripple.good{
        border-color:rgba(126,217,87,.92);
        box-shadow:0 0 28px rgba(126,217,87,.50);
      }

      .hha-portal-ripple.bad{
        border-color:rgba(255,107,107,.90);
        box-shadow:0 0 26px rgba(255,107,107,.42);
      }

      body.hha-cvr-vrfeel-v3.hha-vr-shake{
        animation:hhaV3Shake .24s ease-in-out;
      }

      @keyframes hhaV3Shake{
        0%,100%{transform:translateX(0)}
        20%{transform:translateX(-5px)}
        40%{transform:translateX(5px)}
        60%{transform:translateX(-3px)}
        80%{transform:translateX(3px)}
      }

      .hha-vr-score-pop{
        position:fixed;
        left:50%;
        top:50%;
        transform:translate(-50%,-50%);
        z-index:213;
        pointer-events:none;
        padding:7px 12px;
        border-radius:999px;
        background:rgba(255,255,255,.92);
        border:1px solid rgba(207,238,250,.95);
        color:#214f64;
        font:1000 16px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 14px 30px rgba(33,79,100,.15);
        opacity:0;
      }

      .hha-vr-score-pop.good{
        color:#24794c;
      }

      .hha-vr-score-pop.bad{
        color:#b73a3a;
      }

      body.summaryOpen .hha-food-ghost,
      body.summaryOpen .hha-portal-particle,
      body.summaryOpen .hha-portal-ripple,
      body.summaryOpen .hha-vr-score-pop{
        display:none !important;
      }

      @media (max-height:620px){
        .hha-food-ghost{
          width:56px;
          height:56px;
        }

        .hha-food-ghost .hha-food-ghost-emoji{
          font-size:28px;
        }

        .hha-vr-score-pop{
          font-size:12px;
          padding:5px 9px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function markGates(){
    $all('.gate').forEach(function(gate, idx){
      gate.classList.add('hha-portal-gate');
      gate.classList.add('hha-gate-' + (idx + 1));
    });
  }

  function getGateNumber(gate){
    if (!gate) return null;

    var d = Number(gate.dataset && gate.dataset.gate);
    if (d >= 1 && d <= 5) return d;

    var t = textOf(gate);
    var m = t.match(/[1-5]/);

    return m ? Number(m[0]) : null;
  }

  function getActiveGate(){
    return $('.gate.active') || $('.gate.hha-active');
  }

  function getTargetGroup(){
    var selected = textOf($('#selectedFood'));
    var target = textOf($('#targetText'));
    var foodName = textOf($('#foodName'));
    var all = selected + ' ' + target + ' ' + foodName;

    var m = all.match(/หมู่\s*([1-5])/);
    if (m) return Number(m[1]);

    var map = {
      'ไข่':1,'ปลา':1,'ไก่':1,'นม':1,'ถั่ว':1,
      'ข้าว':2,'ขนมปัง':2,'มันเทศ':2,'เส้นก๋วยเตี๋ยว':2,'ข้าวโพด':2,
      'บรอกโคลี':3,'แครอท':3,'ผักใบเขียว':3,'มะเขือเทศ':3,'แตงกวา':3,
      'กล้วย':4,'ส้ม':4,'แอปเปิล':4,'องุ่น':4,'มะม่วง':4,
      'น้ำมัน':5,'เนย':5,'กะทิ':5,'อะโวคาโด':5,'ถั่วเปลือกแข็ง':5
    };

    return map[foodName] || null;
  }

  function isSelectedMode(){
    var selected = textOf($('#selectedFood'));
    return (
      selected.indexOf('เลือกแล้ว') >= 0 ||
      selected.indexOf('ประตูที่ถูก') >= 0 ||
      selected.indexOf('ส่งเข้าหมู่') >= 0
    );
  }

  function currentFoodSnapshot(){
    var food = $('#foodToken');
    var emojiEl = $('#foodEmoji');
    var nameEl = $('#foodName');

    if (!food) return null;

    var r = food.getBoundingClientRect();

    return {
      rect: {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2
      },
      emoji: textOf(emojiEl) || '🥦',
      name: textOf(nameEl) || '',
      selected: isSelectedMode(),
      targetGroup: getTargetGroup(),
      activeGate: getGateNumber(getActiveGate())
    };
  }

  function centerOf(el){
    if (!el) return {x: window.innerWidth / 2, y: window.innerHeight / 2};

    var r = el.getBoundingClientRect();

    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2
    };
  }

  function vibrate(pattern){
    try {
      if (navigator.vibrate) navigator.vibrate(pattern || 20);
    } catch(e) {}
  }

  function makeRipple(x, y, kind){
    var ripple = document.createElement('div');
    ripple.className = 'hha-portal-ripple ' + (kind || 'good');
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    document.body.appendChild(ripple);

    try {
      ripple.animate([
        {opacity:0, transform:'translate(-50%,-50%) scale(.2)'},
        {opacity:1, transform:'translate(-50%,-50%) scale(1.4)', offset:.35},
        {opacity:0, transform:'translate(-50%,-50%) scale(2.4)'}
      ], {
        duration: 430,
        easing: 'ease-out'
      }).onfinish = function(){ ripple.remove(); };
    } catch(e) {
      setTimeout(function(){ ripple.remove(); }, 450);
    }
  }

  function makeParticles(x, y, kind){
    var count = kind === 'good' ? 14 : 10;

    for (var i = 0; i < count; i++) {
      var p = document.createElement('div');
      p.className = 'hha-portal-particle ' + (kind || 'good');
      p.style.left = x + 'px';
      p.style.top = y + 'px';

      document.body.appendChild(p);

      var angle = (Math.PI * 2) * (i / count) + (Math.random() * .45);
      var dist = 30 + Math.random() * 42;
      var dx = Math.cos(angle) * dist;
      var dy = Math.sin(angle) * dist;

      try {
        p.animate([
          {opacity:0, transform:'translate(-50%,-50%) scale(.5)'},
          {opacity:1, transform:'translate(-50%,-50%) scale(1)', offset:.18},
          {opacity:0, transform:'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.15)'}
        ], {
          duration: 520 + Math.random() * 180,
          easing: 'cubic-bezier(.2,.9,.2,1)'
        }).onfinish = function(){ this.effect.target.remove(); };
      } catch(e) {
        setTimeout(function(node){ node.remove(); }, 700, p);
      }
    }
  }

  function scorePop(text, kind, x, y){
    var pop = document.createElement('div');
    pop.className = 'hha-vr-score-pop ' + (kind || 'good');
    pop.textContent = text;
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
    document.body.appendChild(pop);

    try {
      pop.animate([
        {opacity:0, transform:'translate(-50%,-30%) scale(.72)'},
        {opacity:1, transform:'translate(-50%,-80%) scale(1)', offset:.28},
        {opacity:0, transform:'translate(-50%,-135%) scale(.88)'}
      ], {
        duration: 720,
        easing: 'cubic-bezier(.2,.9,.2,1)'
      }).onfinish = function(){ pop.remove(); };
    } catch(e) {
      setTimeout(function(){ pop.remove(); }, 760);
    }
  }

  function animateFoodToPortal(snapshot){
    if (!snapshot || !snapshot.selected) return;

    var chosenGate = snapshot.activeGate;
    var targetGroup = snapshot.targetGroup;
    var gate = $('.gate[data-gate="' + chosenGate + '"]') ||
      $all('.gate').find(function(g){ return getGateNumber(g) === chosenGate; });

    if (!gate) return;

    var to = centerOf(gate);
    var kind = chosenGate === targetGroup ? 'good' : 'bad';

    var ghost = document.createElement('div');
    ghost.className = 'hha-food-ghost ' + kind;
    ghost.innerHTML = '<div class="hha-food-ghost-emoji">' + snapshot.emoji + '</div>';

    ghost.style.left = snapshot.rect.cx + 'px';
    ghost.style.top = snapshot.rect.cy + 'px';

    document.body.appendChild(ghost);

    var midX = (snapshot.rect.cx + to.x) / 2;
    var midY = Math.min(snapshot.rect.cy, to.y) - 70;

    try {
      ghost.animate([
        {
          left: snapshot.rect.cx + 'px',
          top: snapshot.rect.cy + 'px',
          transform:'translate(-50%,-50%) scale(1) rotate(0deg)',
          opacity:1
        },
        {
          left: midX + 'px',
          top: midY + 'px',
          transform:'translate(-50%,-50%) scale(1.18) rotate(8deg)',
          opacity:1,
          offset:.48
        },
        {
          left: to.x + 'px',
          top: to.y + 'px',
          transform:'translate(-50%,-50%) scale(.28) rotate(18deg)',
          opacity:.1
        }
      ], {
        duration: kind === 'good' ? 520 : 430,
        easing: 'cubic-bezier(.18,.82,.25,1)'
      }).onfinish = function(){
        ghost.remove();
      };
    } catch(e) {
      setTimeout(function(){ ghost.remove(); }, 560);
    }

    setTimeout(function(){
      makeRipple(to.x, to.y, kind);
      makeParticles(to.x, to.y, kind);
      scorePop(kind === 'good' ? '+100' : 'ลองใหม่!', kind, to.x, to.y - 18);

      if (kind === 'good') {
        vibrate([22, 18, 28]);
      } else {
        vibrate([35, 20, 35]);
        document.body.classList.add('hha-vr-shake');
        setTimeout(function(){
          document.body.classList.remove('hha-vr-shake');
        }, 280);
      }
    }, 250);
  }

  function enhanceInstruction(){
    var hint = $('.hint');
    if (hint && hint.getAttribute('data-hha-v3-enhanced') !== PATCH_ID) {
      hint.setAttribute('data-hha-v3-enhanced', PATCH_ID);
      hint.textContent = 'VR: เล็งอาหารแล้วแตะ • เล็งประตูหมู่ที่ถูก แล้วแตะส่งเข้า Portal';
    }

    var selected = $('#selectedFood');
    var target = getTargetGroup();

    if (selected && isSelectedMode() && target) {
      selected.textContent = 'เลือกแล้ว • คำตอบคือหมู่ ' + target + ' • เล็ง Portal หมู่ ' + target + ' แล้วแตะ';
    }
  }

  function scan(){
    document.body.classList.add('hha-cvr-vrfeel-v3');
    document.documentElement.classList.add('hha-cvr-vrfeel-v3');

    markGates();
    enhanceInstruction();
  }

  function bindTapSnapshot(){
    if (document.__hhaGroupsCvrV3TapSnapshotBound) return;
    document.__hhaGroupsCvrV3TapSnapshotBound = true;

    var beforeTap = null;

    document.addEventListener('pointerdown', function(){
      if (document.body.classList.contains('summaryOpen')) return;
      beforeTap = currentFoodSnapshot();
    }, true);

    document.addEventListener('click', function(){
      if (document.body.classList.contains('summaryOpen')) return;

      var snap = beforeTap;
      beforeTap = null;

      setTimeout(function(){
        if (snap && snap.selected) {
          animateFoodToPortal(snap);
        }

        scan();
      }, 30);
    }, false);
  }

  function boot(){
    addStyle();
    bindTapSnapshot();
    scan();

    [160,420,900,1600,2600,4200].forEach(function(ms){
      setTimeout(scan, ms);
    });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_CVR_V3_SCAN_TIMER__);
      window.__HHA_CVR_V3_SCAN_TIMER__ = setTimeout(scan, 80);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','style']
    });

    console.info('[HeroHealth Groups cVR]', PATCH_ID, 'ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
