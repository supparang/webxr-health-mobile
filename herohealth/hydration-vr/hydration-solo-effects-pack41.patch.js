/* =========================================================
   HeroHealth Hydration Solo Effects Patch
   File: /herohealth/hydration-vr/hydration-solo-effects-pack41.patch.js
   Version: v20260523-pack41-solo-effects-feedback
   Purpose:
   - Add game feel / popup / feedback to Hydration Solo Clean Core
   - Does NOT depend on old hydration-vr.js
   - Safe add-on after hydration-solo-core.js
   ========================================================= */

(function(){
  'use strict';

  var VERSION = 'v20260523-pack41-solo-effects-feedback';

  if(window.HHA_HYDRATION_SOLO_EFFECTS_PACK41){
    console.warn('[Hydration Solo Effects Pack41] already loaded');
    return;
  }

  window.HHA_HYDRATION_SOLO_EFFECTS_PACK41 = true;

  function q(sel, root){
    try{
      return (root || document).querySelector(sel);
    }catch(e){
      return null;
    }
  }

  function qa(sel, root){
    try{
      return Array.from((root || document).querySelectorAll(sel));
    }catch(e){
      return [];
    }
  }

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function now(){
    return Date.now();
  }

  function injectStyle(){
    if(q('#hha-hydration-solo-effects-pack41-css')) return;

    var style = document.createElement('style');
    style.id = 'hha-hydration-solo-effects-pack41-css';

    style.textContent = `
      /* =========================================================
         Hydration Solo Pack41 Effects
         ========================================================= */

      .hha-solo-floating-score{
        position:fixed;
        z-index:16000;
        pointer-events:none;
        font-weight:1000;
        font-size:24px;
        color:#1884cf;
        text-shadow:0 4px 14px rgba(255,255,255,.95);
        animation:hhaSoloPack41FloatScore .76s ease-out forwards;
        will-change:transform,opacity;
      }

      .hha-solo-floating-score.bad{
        color:#ff5d5d;
      }

      .hha-solo-floating-score.combo{
        color:#ff9f1c;
        font-size:28px;
      }

      .hha-solo-floating-score.shield{
        color:#1faee9;
        font-size:24px;
      }

      @keyframes hhaSoloPack41FloatScore{
        0%{ transform:translate(-50%,-20%) scale(.78); opacity:0; }
        18%{ transform:translate(-50%,-70%) scale(1.12); opacity:1; }
        100%{ transform:translate(-50%,-150%) scale(.92); opacity:0; }
      }

      .hha-solo-burst{
        position:fixed;
        z-index:15000;
        width:18px;
        height:18px;
        border-radius:999px;
        pointer-events:none;
        background:radial-gradient(circle,#ffffff 0 20%,#43c7ff 22% 58%,transparent 60%);
        box-shadow:
          0 -24px 0 rgba(67,199,255,.65),
          22px -11px 0 rgba(98,230,143,.65),
          22px 13px 0 rgba(67,199,255,.55),
          0 26px 0 rgba(98,230,143,.55),
          -22px 13px 0 rgba(67,199,255,.55),
          -22px -11px 0 rgba(98,230,143,.65);
        animation:hhaSoloPack41Burst .5s ease-out forwards;
        will-change:transform,opacity;
      }

      .hha-solo-burst.bad{
        background:radial-gradient(circle,#ffffff 0 20%,#ff7b62 22% 58%,transparent 60%);
        box-shadow:
          0 -24px 0 rgba(255,93,93,.55),
          22px -11px 0 rgba(255,178,88,.55),
          22px 13px 0 rgba(255,93,93,.45),
          0 26px 0 rgba(255,178,88,.45),
          -22px 13px 0 rgba(255,93,93,.45),
          -22px -11px 0 rgba(255,178,88,.55);
      }

      .hha-solo-burst.shield{
        background:radial-gradient(circle,#ffffff 0 20%,#74dcff 22% 58%,transparent 60%);
        box-shadow:
          0 -24px 0 rgba(116,220,255,.65),
          22px -11px 0 rgba(195,244,255,.70),
          22px 13px 0 rgba(116,220,255,.55),
          0 26px 0 rgba(195,244,255,.65),
          -22px 13px 0 rgba(116,220,255,.55),
          -22px -11px 0 rgba(195,244,255,.70);
      }

      @keyframes hhaSoloPack41Burst{
        from{ transform:translate(-50%,-50%) scale(.4); opacity:1; }
        to{ transform:translate(-50%,-50%) scale(2.25); opacity:0; }
      }

      .hha-solo-hit-ring{
        position:fixed;
        z-index:14990;
        width:80px;
        height:80px;
        border-radius:999px;
        border:5px solid rgba(67,199,255,.75);
        pointer-events:none;
        animation:hhaSoloPack41HitRing .55s ease-out forwards;
        will-change:transform,opacity;
      }

      .hha-solo-hit-ring.bad{
        border-color:rgba(255,93,93,.75);
      }

      .hha-solo-hit-ring.shield{
        border-color:rgba(116,220,255,.85);
      }

      @keyframes hhaSoloPack41HitRing{
        from{ transform:translate(-50%,-50%) scale(.35); opacity:1; }
        to{ transform:translate(-50%,-50%) scale(1.45); opacity:0; }
      }

      .hha-solo-screen-flash{
        position:fixed;
        inset:0;
        z-index:14500;
        pointer-events:none;
        opacity:0;
        animation:hhaSoloPack41Flash .3s ease-out forwards;
      }

      .hha-solo-screen-flash.good{
        background:rgba(98,230,143,.22);
      }

      .hha-solo-screen-flash.bad{
        background:rgba(255,93,93,.20);
      }

      .hha-solo-screen-flash.fever{
        background:radial-gradient(circle,rgba(255,255,255,.48),rgba(67,199,255,.25),transparent 70%);
        animation:hhaSoloPack41Flash .46s ease-out forwards;
      }

      @keyframes hhaSoloPack41Flash{
        0%{ opacity:0; }
        22%{ opacity:1; }
        100%{ opacity:0; }
      }

      .hha-solo-mission-pop{
        position:fixed;
        left:50%;
        top:50%;
        z-index:17000;
        transform:translate(-50%,-50%);
        max-width:min(88vw,430px);
        padding:18px 22px;
        border-radius:28px;
        background:rgba(255,255,255,.97);
        border:4px solid #b9efc5;
        box-shadow:0 24px 70px rgba(30,75,115,.26);
        color:#24445c;
        text-align:center;
        font-weight:1000;
        pointer-events:none;
        animation:hhaSoloPack41MissionPop .96s ease-out forwards;
      }

      .hha-solo-mission-pop.boss{
        border-color:#ffd28c;
      }

      .hha-solo-mission-pop.fever{
        border-color:#74dcff;
      }

      .hha-solo-mission-pop.bad{
        border-color:#ffb2a2;
      }

      .hha-solo-mission-pop b{
        display:block;
        font-size:30px;
        color:#1884cf;
        line-height:1.05;
      }

      .hha-solo-mission-pop small{
        display:block;
        margin-top:5px;
        color:#66879c;
        font-size:15px;
      }

      @keyframes hhaSoloPack41MissionPop{
        0%{ transform:translate(-50%,-42%) scale(.8); opacity:0; }
        18%{ transform:translate(-50%,-50%) scale(1.05); opacity:1; }
        78%{ transform:translate(-50%,-50%) scale(1); opacity:1; }
        100%{ transform:translate(-50%,-62%) scale(.95); opacity:0; }
      }

      body.hha-solo-shake{
        animation:hhaSoloPack41Shake .24s linear both;
      }

      @keyframes hhaSoloPack41Shake{
        0%,100%{ transform:translate3d(0,0,0); }
        25%{ transform:translate3d(-4px,2px,0); }
        50%{ transform:translate3d(4px,-2px,0); }
        75%{ transform:translate3d(-2px,-2px,0); }
      }

      body.hha-solo-fever-on .hha-solo-hud .hha-solo-pill,
      body.hha-solo-fever-on .hha-solo-time{
        box-shadow:
          0 0 0 4px rgba(67,199,255,.18),
          0 12px 30px rgba(35,136,255,.28);
      }

      .hha-solo-target.hha-pack41-hit{
        filter:saturate(1.25) brightness(1.08);
      }

      @media (max-width:520px){
        .hha-solo-floating-score{
          font-size:20px;
        }

        .hha-solo-floating-score.combo{
          font-size:23px;
        }

        .hha-solo-mission-pop{
          padding:15px 18px;
          border-radius:24px;
        }

        .hha-solo-mission-pop b{
          font-size:24px;
        }

        .hha-solo-mission-pop small{
          font-size:13px;
        }

        .hha-solo-hit-ring{
          width:62px;
          height:62px;
          border-width:4px;
        }

        .hha-solo-burst{
          width:14px;
          height:14px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function vibrate(pattern){
    try{
      if(navigator.vibrate){
        navigator.vibrate(pattern || 28);
      }
    }catch(e){}
  }

  function centerOf(el){
    try{
      var r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        w: r.width,
        h: r.height
      };
    }catch(e){
      return {
        x: (window.innerWidth || 0) / 2,
        y: (window.innerHeight || 0) / 2,
        w: 0,
        h: 0
      };
    }
  }

  function removeLater(el, ms){
    setTimeout(function(){
      try{ el.remove(); }catch(e){}
    }, ms || 800);
  }

  function floatingScore(x, y, text, type){
    try{
      var n = document.createElement('div');
      n.className = 'hha-solo-floating-score ' + (type || '');
      n.textContent = String(text || '');
      n.style.left = Math.round(x) + 'px';
      n.style.top = Math.round(y) + 'px';
      document.body.appendChild(n);
      removeLater(n, 860);
    }catch(e){}
  }

  function hitBurst(x, y, type){
    try{
      var b = document.createElement('div');
      b.className = 'hha-solo-burst ' + (type || '');
      b.style.left = Math.round(x) + 'px';
      b.style.top = Math.round(y) + 'px';
      document.body.appendChild(b);

      var ring = document.createElement('div');
      ring.className = 'hha-solo-hit-ring ' + (type || '');
      ring.style.left = Math.round(x) + 'px';
      ring.style.top = Math.round(y) + 'px';
      document.body.appendChild(ring);

      removeLater(b, 700);
      removeLater(ring, 700);
    }catch(e){}
  }

  function screenFlash(type){
    try{
      var n = document.createElement('div');
      n.className = 'hha-solo-screen-flash ' + (type || 'good');
      document.body.appendChild(n);
      removeLater(n, type === 'fever' ? 560 : 380);
    }catch(e){}
  }

  function screenShake(){
    try{
      document.body.classList.remove('hha-solo-shake');
      void document.body.offsetWidth;
      document.body.classList.add('hha-solo-shake');

      setTimeout(function(){
        document.body.classList.remove('hha-solo-shake');
      }, 280);
    }catch(e){}
  }

  function missionPop(title, sub, type){
    try{
      var old = q('.hha-solo-mission-pop');
      if(old) old.remove();

      var n = document.createElement('div');
      n.className = 'hha-solo-mission-pop ' + (type || '');
      n.innerHTML =
        '<b>' + esc(title || 'Mission!') + '</b>' +
        '<small>' + esc(sub || '') + '</small>';

      document.body.appendChild(n);
      removeLater(n, 1040);
    }catch(e){}
  }

  function setFeverVisual(on){
    try{
      document.body.classList.toggle('hha-solo-fever-on', !!on);
    }catch(e){}
  }

  function targetFromEvent(ev){
    try{
      if(!ev || !ev.target || !ev.target.closest) return null;

      var t = ev.target.closest('.hha-solo-target, .hha-hydration-target');

      if(!t) return null;
      if(!t.isConnected) return null;

      if(ev.target.closest('.hha-solo-summary, .hha-solo-start, .hha-solo-controls')){
        return null;
      }

      return t;
    }catch(e){
      return null;
    }
  }

  function targetAtCenter(){
    var cx = (window.innerWidth || 0) / 2;
    var cy = (window.innerHeight || 0) / 2;
    var best = null;
    var bestD = Infinity;

    qa('.hha-solo-target, .hha-hydration-target').forEach(function(t){
      if(!t || !t.isConnected) return;

      var r = t.getBoundingClientRect();
      if(r.width <= 0 || r.height <= 0) return;

      var tx = r.left + r.width / 2;
      var ty = r.top + r.height / 2;
      var dx = tx - cx;
      var dy = ty - cy;
      var d = Math.sqrt(dx * dx + dy * dy);

      if(
        cx >= r.left - 52 &&
        cx <= r.right + 52 &&
        cy >= r.top - 52 &&
        cy <= r.bottom + 52 &&
        d < bestD
      ){
        best = t;
        bestD = d;
      }
    });

    return best;
  }

  function playTargetEffect(t, source){
    if(!t || !t.isConnected) return;

    var last = Number(t.dataset.hhaPack41FxAt || 0);
    var n = now();

    if(n - last < 260) return;
    t.dataset.hhaPack41FxAt = String(n);

    var c = centerOf(t);
    var good = t.dataset.good === '1';
    var shield = Number(t.dataset.shield || 0) > 0;
    var score = Number(t.dataset.score || 0);
    var title = (t.textContent || '').trim();

    t.classList.add('hha-pack41-hit');

    if(good){
      hitBurst(c.x, c.y, shield ? 'shield' : 'good');
      screenFlash(shield ? 'fever' : 'good');
      vibrate(shield ? [24, 24, 24] : 22);

      var shownScore = Math.max(20, Math.round(score || 50));
      floatingScore(c.x, c.y, '+' + shownScore, shield ? 'shield' : 'good');

      if(shield || /shield|ice|น้ำแข็ง/i.test(title)){
        missionPop('Ice Shield!', 'กันแดด 1 ครั้ง', 'fever');
      }
    }else{
      hitBurst(c.x, c.y, 'bad');
      screenFlash('bad');
      screenShake();
      vibrate(55);

      var badScore = Math.round(score || -50);
      floatingScore(c.x, c.y, String(badScore), 'bad');
    }
  }

  function bindHitEffects(){
    ['pointerdown','touchstart','mousedown'].forEach(function(type){
      document.addEventListener(type, function(ev){
        var t = targetFromEvent(ev);
        if(t){
          playTargetEffect(t, type);
        }
      }, { capture:true, passive:true });
    });

    /*
      cVR ยิงด้วย crosshair: target ไม่ได้ถูกแตะตรง ๆ
      จึงต้องดูเป้าที่อยู่กลางจอแล้วเล่น effect ก่อน core ตัดสิน hit
    */
    window.addEventListener('hha:shoot', function(){
      var t = targetAtCenter();
      if(t){
        playTargetEffect(t, 'hha:shoot');
      }
    }, true);

    document.addEventListener('click', function(ev){
      try{
        var view = String((window.HHA_HYDRATION_RUN_CONTEXT || {}).view || document.body.dataset.view || '').toLowerCase();
        if(view !== 'cvr') return;

        if(ev.target && ev.target.closest && ev.target.closest('button, a, input, .hha-solo-summary, .hha-solo-start, .hha-solo-controls')){
          return;
        }

        var t = targetAtCenter();
        if(t){
          playTargetEffect(t, 'cvr-click');
        }
      }catch(e){}
    }, true);
  }

  var lastCombo = -1;
  var lastFever = -1;

  function watchHud(){
    setInterval(function(){
      try{
        var comboEl = q('#hha-solo-combo');
        var feverEl = q('#hha-solo-fever');

        var combo = comboEl ? parseInt(comboEl.textContent || '0', 10) : 0;
        var fever = feverEl ? parseInt(String(feverEl.textContent || '0').replace('%',''), 10) : 0;

        if(Number.isFinite(combo) && combo > 0 && combo !== lastCombo){
          lastCombo = combo;

          if(combo >= 5 && combo % 5 === 0){
            missionPop('Combo Splash!', 'Combo ' + combo + ' ต่อเนื่อง', 'fever');
            screenFlash('fever');
            vibrate([20, 25, 20]);
          }

          if(combo >= 8 && combo % 8 === 0){
            missionPop('Mission Clear!', 'Combo ' + combo + ' • Heat Boss อ่อนแรง', 'fever');
            floatingScore((window.innerWidth || 0) / 2, (window.innerHeight || 0) * .42, '+Mission', 'combo');
          }
        }

        if(Number.isFinite(fever) && fever !== lastFever){
          if(fever >= 90 && lastFever < 90){
            missionPop('FEVER READY!', 'เก็บน้ำดีต่อเนื่องอีกนิด', 'fever');
            screenFlash('fever');
          }

          lastFever = fever;
        }
      }catch(e){}
    }, 380);
  }

  var lastBannerText = '';

  function watchBanner(){
    setInterval(function(){
      try{
        var b = q('.hha-solo-banner.show');
        if(!b) return;

        var text = String(b.textContent || '').trim();
        if(!text || text === lastBannerText) return;

        lastBannerText = text;

        if(/Heat Monster|HEAT|บอส|Boss/i.test(text)){
          missionPop('HEAT MONSTER!', 'รักษา Hydration ให้อยู่โซนเขียว', 'boss');
          screenFlash('bad');
          screenShake();
          vibrate([45, 35, 45]);
          return;
        }

        if(/Fever|คะแนนพุ่ง|FEVER/i.test(text)){
          missionPop('FEVER SPLASH!', '+คะแนนพิเศษ', 'fever');
          screenFlash('fever');
          setFeverVisual(true);
          vibrate([30, 40, 30, 40, 30]);

          setTimeout(function(){
            setFeverVisual(false);
          }, 1400);

          return;
        }

        if(/Mission|สำเร็จ|Combo/i.test(text)){
          missionPop('Mission Clear!', text, 'fever');
          screenFlash('good');
          vibrate([26, 30, 26]);
        }
      }catch(e){}
    }, 260);
  }

  function bootEffects(){
    injectStyle();
    bindHitEffects();
    watchHud();
    watchBanner();

    console.info('[Hydration Solo Effects Pack41] loaded', VERSION);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bootEffects, { once:true });
  }else{
    bootEffects();
  }
})();
