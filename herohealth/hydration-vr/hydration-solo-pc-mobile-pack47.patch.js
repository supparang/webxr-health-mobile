/* =========================================================
   HeroHealth Hydration Solo PC/Mobile Final Polish Patch
   File: /herohealth/hydration-vr/hydration-solo-pc-mobile-pack47.patch.js
   Version: v20260527-pack47-pc-mobile-final-polish

   Purpose:
   - Final PC/Mobile polish after Core + Pack41–46
   - PC: hover/aim clarity, denser game feel on large screens
   - Mobile: tap feedback, safer target placement, compact HUD guard
   - Performance guard: reduce heavy FX on slower devices
   - Summary scroll/spacing polish
   - Keeps cVR mostly untouched except not breaking it
   - Does NOT depend on old hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var VERSION = 'v20260527-pack47-pc-mobile-final-polish';

  if(window.HHA_HYDRATION_SOLO_PC_MOBILE_PACK47){
    console.warn('[Hydration Solo PC/Mobile Pack47] already loaded');
    return;
  }

  window.HHA_HYDRATION_SOLO_PC_MOBILE_PACK47 = true;

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function currentView(){
    var ctx = window.HHA_HYDRATION_RUN_CONTEXT || {};
    return String(ctx.view || document.body.dataset.view || 'mobile').toLowerCase();
  }

  function isMobile(){
    return currentView() === 'mobile';
  }

  function isPc(){
    return currentView() === 'pc';
  }

  function isCvr(){
    return currentView() === 'cvr';
  }

  function viewport(){
    return {
      w: window.innerWidth || document.documentElement.clientWidth || 390,
      h: window.innerHeight || document.documentElement.clientHeight || 800
    };
  }

  function injectStyle(){
    if(q('#hha-hydration-solo-pc-mobile-pack47-css')) return;

    var style = document.createElement('style');
    style.id = 'hha-hydration-solo-pc-mobile-pack47-css';
    style.textContent = `
      /* =========================================================
         Pack47 PC/Mobile Final Polish
         ========================================================= */

      body.hha-view-pc .hha-solo-target,
      body.hha-view-pc .hha-hydration-target{
        width:108px !important;
        min-height:122px !important;
        border-radius:28px !important;
        transition:
          transform .14s ease,
          box-shadow .14s ease,
          filter .14s ease,
          border-color .14s ease;
      }

      body.hha-view-pc .hha-solo-target:hover,
      body.hha-view-pc .hha-hydration-target:hover,
      body.hha-view-pc .hha-solo-target.hha-pack47-hover,
      body.hha-view-pc .hha-hydration-target.hha-pack47-hover{
        transform:scale(1.075) translateY(-3px);
        filter:saturate(1.12) brightness(1.04);
        box-shadow:
          0 20px 48px rgba(30,75,115,.26),
          0 0 0 7px rgba(67,199,255,.14),
          0 0 30px rgba(67,199,255,.22);
      }

      body.hha-view-pc .hha-solo-target.bad:hover,
      body.hha-view-pc .hha-hydration-target.bad:hover,
      body.hha-view-pc .hha-solo-target.is-bad:hover,
      body.hha-view-pc .hha-hydration-target.is-bad:hover{
        box-shadow:
          0 20px 48px rgba(30,75,115,.24),
          0 0 0 7px rgba(255,153,111,.16),
          0 0 30px rgba(255,96,96,.20);
      }

      body.hha-view-mobile .hha-solo-target,
      body.hha-view-mobile .hha-hydration-target{
        transition:
          transform .10s ease,
          box-shadow .10s ease,
          filter .10s ease;
      }

      body.hha-view-mobile .hha-solo-target.hha-pack47-press,
      body.hha-view-mobile .hha-hydration-target.hha-pack47-press{
        transform:scale(.94);
        filter:brightness(1.06) saturate(1.12);
      }

      .hha-pack47-ripple{
        position:fixed;
        z-index:16005;
        width:18px;
        height:18px;
        border-radius:999px;
        border:4px solid rgba(67,199,255,.72);
        background:rgba(255,255,255,.18);
        pointer-events:none;
        transform:translate(-50%,-50%) scale(.35);
        animation:hhaPack47Ripple .45s ease-out forwards;
      }

      .hha-pack47-ripple.bad{
        border-color:rgba(255,107,107,.70);
      }

      @keyframes hhaPack47Ripple{
        0%{ opacity:.95; transform:translate(-50%,-50%) scale(.35); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(3.4); }
      }

      .hha-pack47-soft-guide{
        position:fixed;
        left:50%;
        top:calc(50% - 110px);
        z-index:10008;
        transform:translateX(-50%);
        width:min(420px,84vw);
        padding:9px 13px;
        border-radius:999px;
        background:rgba(255,255,255,.90);
        border:2px solid #d7f3ff;
        color:#24445c;
        box-shadow:0 12px 30px rgba(30,75,115,.12);
        text-align:center;
        font-size:13px;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
        transition:.18s ease;
      }

      .hha-pack47-soft-guide.show{
        opacity:1;
        transform:translateX(-50%) translateY(-3px);
      }

      body.hha-view-pc .hha-pack47-soft-guide{
        top:calc(50% - 150px);
        font-size:14px;
      }

      body.hha-view-mobile .hha-pack47-soft-guide{
        top:calc(50% - 118px);
        width:min(320px,82vw);
        padding:8px 11px;
        font-size:12px;
      }

      body.hha-pack47-lowfx .hha-solo-burst,
      body.hha-pack47-lowfx .hha-solo-hit-ring,
      body.hha-pack47-lowfx .hha-solo-screen-flash,
      body.hha-pack47-lowfx .hha-boss42-alert,
      body.hha-pack47-lowfx .hha-solo-mission-pop{
        animation-duration:.28s !important;
      }

      body.hha-pack47-lowfx .hha-solo-burst,
      body.hha-pack47-lowfx .hha-solo-hit-ring{
        opacity:.62;
        transform:scale(.72);
      }

      .hha-pack47-perf-badge{
        position:fixed;
        left:50%;
        bottom:calc(66px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%) translateY(8px);
        z-index:13000;
        padding:7px 10px;
        border-radius:999px;
        background:rgba(255,255,255,.92);
        border:2px solid #d7f3ff;
        color:#24445c;
        box-shadow:0 12px 28px rgba(30,75,115,.12);
        font-size:12px;
        font-weight:1000;
        opacity:0;
        pointer-events:none;
        transition:.18s ease;
      }

      .hha-pack47-perf-badge.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }

      body.hha-view-mobile .hha-solo-summary,
      body.hha-view-pc .hha-solo-summary{
        scroll-behavior:smooth;
        -webkit-overflow-scrolling:touch;
      }

      body.hha-view-mobile .hha-solo-summary-card{
        padding-bottom:calc(28px + env(safe-area-inset-bottom,0px));
      }

      body.hha-view-mobile .hha-solo-actions button,
      body.hha-view-mobile .hha-solo-actions a{
        min-height:54px;
      }

      body.hha-view-pc .hha-solo-summary-card{
        max-width:760px;
      }

      .hha-pack47-summary-note{
        margin:10px 0 0;
        padding:10px 12px;
        border-radius:18px;
        background:#f2fbff;
        border:2px solid #d7f3ff;
        color:#42677d;
        font-weight:950;
        font-size:13px;
        line-height:1.35;
        text-align:center;
      }

      @media (max-width:520px){
        body.hha-view-mobile .hha-solo-hud{
          max-width:304px;
        }

        body.hha-view-mobile .hha-solo-controls button{
          width:46px;
          height:46px;
        }

        .hha-pack47-perf-badge{
          bottom:calc(58px + env(safe-area-inset-bottom,0px));
          font-size:11px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function centerOf(el){
    try{
      var r = el.getBoundingClientRect();
      return { x:r.left + r.width/2, y:r.top + r.height/2, w:r.width, h:r.height };
    }catch(e){
      var v = viewport();
      return { x:v.w/2, y:v.h/2, w:0, h:0 };
    }
  }

  function rippleAt(x, y, bad){
    try{
      var n = document.createElement('div');
      n.className = 'hha-pack47-ripple' + (bad ? ' bad' : '');
      n.style.left = Math.round(x) + 'px';
      n.style.top = Math.round(y) + 'px';
      document.body.appendChild(n);
      setTimeout(function(){ try{ n.remove(); }catch(e){} }, 520);
    }catch(e){}
  }

  function ensureGuide(){
    var n = q('.hha-pack47-soft-guide');
    if(n) return n;

    n = document.createElement('div');
    n.className = 'hha-pack47-soft-guide';
    document.body.appendChild(n);
    return n;
  }

  function showGuide(text, ms){
    try{
      if(isCvr()) return;
      var n = ensureGuide();
      n.textContent = text;
      n.classList.add('show');
      clearTimeout(n._timer);
      n._timer = setTimeout(function(){
        n.classList.remove('show');
      }, ms || 1400);
    }catch(e){}
  }

  function bindPcHover(){
    document.addEventListener('mouseover', function(ev){
      if(!isPc()) return;
      var t = ev.target && ev.target.closest ? ev.target.closest('.hha-solo-target, .hha-hydration-target') : null;
      if(t) t.classList.add('hha-pack47-hover');
    }, true);

    document.addEventListener('mouseout', function(ev){
      if(!isPc()) return;
      var t = ev.target && ev.target.closest ? ev.target.closest('.hha-solo-target, .hha-hydration-target') : null;
      if(t) t.classList.remove('hha-pack47-hover');
    }, true);
  }

  function bindTapFeedback(){
    ['pointerdown','touchstart','mousedown'].forEach(function(type){
      document.addEventListener(type, function(ev){
        if(isCvr()) return;
        var t = ev.target && ev.target.closest ? ev.target.closest('.hha-solo-target, .hha-hydration-target') : null;
        if(!t) return;

        t.classList.add('hha-pack47-press');
        var c = centerOf(t);
        rippleAt(c.x, c.y, t.dataset.good !== '1');

        setTimeout(function(){
          try{ t.classList.remove('hha-pack47-press'); }catch(e){}
        }, 180);
      }, { capture:true, passive:true });
    });
  }

  function safeNumber(v, fallback){
    var n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function keepTargetsInPlayArea(){
    if(isCvr()) return;

    var v = viewport();
    var view = currentView();
    var topSafe = view === 'mobile' ? 238 : 150;
    var bottomSafe = view === 'mobile' ? 76 : 42;
    var sideSafe = view === 'mobile' ? 16 : 72;

    qa('.hha-solo-target, .hha-hydration-target').forEach(function(t){
      if(!t || !t.isConnected || t.dataset.hhaPack47Placed === '1') return;

      var r = t.getBoundingClientRect();
      if(r.width <= 0 || r.height <= 0) return;

      var changed = false;
      var left = safeNumber(parseFloat(t.style.left), r.left);
      var top = safeNumber(parseFloat(t.style.top), r.top);

      if(r.top < topSafe){
        top = top + (topSafe - r.top) + 8;
        changed = true;
      }

      if(r.bottom > v.h - bottomSafe){
        top = top - (r.bottom - (v.h - bottomSafe)) - 8;
        changed = true;
      }

      if(r.left < sideSafe){
        left = left + (sideSafe - r.left) + 8;
        changed = true;
      }

      if(r.right > v.w - sideSafe){
        left = left - (r.right - (v.w - sideSafe)) - 8;
        changed = true;
      }

      if(isPc() && v.w >= 900){
        var centerBandLeft = Math.round(v.w * 0.12);
        var centerBandRight = Math.round(v.w * 0.88);
        if(r.left < centerBandLeft){
          left += Math.min(120, centerBandLeft - r.left);
          changed = true;
        }
        if(r.right > centerBandRight){
          left -= Math.min(120, r.right - centerBandRight);
          changed = true;
        }
      }

      if(changed){
        t.style.left = Math.round(left) + 'px';
        t.style.top = Math.round(top) + 'px';
      }

      t.dataset.hhaPack47Placed = '1';
    });
  }

  function readText(sel){
    var el = q(sel);
    return String((el && el.textContent) || '').trim();
  }

  var hintState = {
    lastAt:0,
    lastText:''
  };

  function smartGuide(){
    if(isCvr()) return;

    var now = Date.now();
    if(now - hintState.lastAt < 4200) return;

    var hydration = Number(readText('#hha-solo-hydration').replace(/[^0-9.-]/g,''));
    var combo = Number(readText('#hha-solo-combo').replace(/[^0-9.-]/g,''));
    var fever = Number(readText('#hha-solo-fever').replace(/[^0-9.-]/g,''));
    var hasHud = !!q('.hha-solo-hud');
    var hasSummary = !!q('.hha-solo-summary');

    if(!hasHud || hasSummary) return;

    var text = '';

    if(Number.isFinite(hydration) && hydration <= 35){
      text = '💧 Hydration ต่ำ รีบเก็บน้ำดีใกล้ตัวก่อน';
    }else if(Number.isFinite(fever) && fever >= 80){
      text = '⚡ ใกล้ Fever แล้ว เก็บน้ำดีต่อเนื่องอีกนิด';
    }else if(Number.isFinite(combo) && combo >= 10){
      text = '🔥 คอมโบดีมาก ระวังเป้าของเสียที่เข้ามาเร็วขึ้น';
    }else if(isPc()){
      text = '🖱️ ชี้เป้าแล้วคลิก เก็บน้ำดีให้ต่อเนื่อง';
    }else if(isMobile()){
      text = '👆 แตะเป้าน้ำดีเร็ว ๆ แต่หลบของหวานกับแดดแรง';
    }

    if(text && text !== hintState.lastText){
      hintState.lastAt = now;
      hintState.lastText = text;
      showGuide(text, 1700);
    }
  }

  var perf = {
    frames:0,
    last:0,
    fps:60,
    low:false,
    noticeShown:false
  };

  function ensurePerfBadge(){
    var n = q('.hha-pack47-perf-badge');
    if(n) return n;

    n = document.createElement('div');
    n.className = 'hha-pack47-perf-badge';
    n.textContent = 'โหมดลื่นไหล: ลด FX เพื่อให้เล่นสบายขึ้น';
    document.body.appendChild(n);
    return n;
  }

  function showPerfBadge(){
    var n = ensurePerfBadge();
    n.classList.add('show');
    clearTimeout(n._timer);
    n._timer = setTimeout(function(){
      n.classList.remove('show');
    }, 1800);
  }

  function perfLoop(ts){
    try{
      if(!perf.last) perf.last = ts;
      perf.frames += 1;

      if(ts - perf.last >= 1000){
        perf.fps = perf.frames;
        perf.frames = 0;
        perf.last = ts;

        var hasHud = !!q('.hha-solo-hud');
        var hasSummary = !!q('.hha-solo-summary');

        if(hasHud && !hasSummary && perf.fps > 0 && perf.fps < 36){
          perf.low = true;
          document.body.classList.add('hha-pack47-lowfx');
          if(!perf.noticeShown){
            perf.noticeShown = true;
            showPerfBadge();
          }
        }

        if(perf.low && perf.fps >= 48){
          perf.low = false;
          document.body.classList.remove('hha-pack47-lowfx');
        }
      }
    }catch(e){}

    requestAnimationFrame(perfLoop);
  }

  function summaryPolish(){
    var summary = q('.hha-solo-summary');
    if(!summary || summary.dataset.hhaPack47Summary === '1') return;

    summary.dataset.hhaPack47Summary = '1';

    try{
      var lesson = q('.hha-solo-lesson', summary);
      var note = document.createElement('div');
      note.className = 'hha-pack47-summary-note';
      note.textContent = isMobile()
        ? 'สรุปผลเลื่อนได้ครบแล้ว กดเล่นอีกครั้งหรือทำ Cooldown ได้ด้านล่าง'
        : 'พร้อมเล่นซ้ำเพื่อทำคะแนนและ Hydration ให้ดีขึ้น หรือทำ Cooldown เพื่อจบภารกิจ';

      if(lesson && lesson.parentNode){
        lesson.parentNode.insertBefore(note, lesson.nextSibling);
      }
    }catch(e){}
  }

  function observer(){
    var mo = new MutationObserver(function(){
      try{
        keepTargetsInPlayArea();
        summaryPolish();
      }catch(e){}
    });

    mo.observe(document.body, { childList:true, subtree:true });
  }

  function periodic(){
    setInterval(function(){
      try{
        keepTargetsInPlayArea();
        smartGuide();
        summaryPolish();
      }catch(e){}
    }, 500);
  }

  function boot(){
    injectStyle();
    bindPcHover();
    bindTapFeedback();
    observer();
    periodic();
    requestAnimationFrame(perfLoop);

    console.info('[Hydration Solo PC/Mobile Pack47] loaded', VERSION, { view:currentView() });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
