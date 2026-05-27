/* =========================================================
   HeroHealth Hydration Solo Micro Onboarding Patch
   File: /herohealth/hydration-vr/hydration-solo-onboarding-pack48.patch.js
   Version: v20260527-pack48-micro-onboarding

   Purpose:
   - Add short how-to-play guidance without blocking gameplay
   - Improve first-time clarity for PC/Mobile/cVR
   - Designed to load AFTER Pack41–47
   - Safe patch: does not change scoring, spawn logic, or core state
   - Does NOT depend on old hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var VERSION = 'v20260527-pack48-micro-onboarding';

  if(window.HHA_HYDRATION_SOLO_ONBOARDING_PACK48){
    console.warn('[Hydration Solo Onboarding Pack48] already loaded');
    return;
  }

  window.HHA_HYDRATION_SOLO_ONBOARDING_PACK48 = true;

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
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

  function currentDiff(){
    var ctx = window.HHA_HYDRATION_RUN_CONTEXT || {};
    return String(ctx.diff || 'normal').toLowerCase();
  }

  function storageKey(){
    return 'HHA_HYDRATION_ONBOARDING_SEEN_' + currentView();
  }

  function hasSeen(){
    try{ return localStorage.getItem(storageKey()) === '1'; }
    catch(e){ return false; }
  }

  function markSeen(){
    try{ localStorage.setItem(storageKey(), '1'); }catch(e){}
  }

  function injectStyle(){
    if(q('#hha-hydration-solo-onboarding-pack48-css')) return;

    var style = document.createElement('style');
    style.id = 'hha-hydration-solo-onboarding-pack48-css';
    style.textContent = `
      .hha-onboard48-card{
        margin:14px 0 0;
        padding:12px;
        border-radius:24px;
        background:linear-gradient(180deg,#f4fdff,#ffffff);
        border:3px solid #d7f3ff;
        box-shadow:0 12px 28px rgba(30,75,115,.12);
        color:#24445c;
        text-align:left;
      }

      .hha-onboard48-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:9px;
        font-weight:1000;
      }

      .hha-onboard48-title b{
        font-size:15px;
      }

      .hha-onboard48-title span{
        padding:5px 9px;
        border-radius:999px;
        background:#fff4c5;
        color:#85631b;
        font-size:11px;
        white-space:nowrap;
      }

      .hha-onboard48-steps{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .hha-onboard48-step{
        min-width:0;
        padding:10px 8px;
        border-radius:18px;
        background:#f2fbff;
        border:2px solid #e0f4ff;
        text-align:center;
        font-weight:1000;
      }

      .hha-onboard48-step i{
        display:block;
        font-style:normal;
        font-size:26px;
        line-height:1;
        margin-bottom:5px;
      }

      .hha-onboard48-step b{
        display:block;
        font-size:12px;
        line-height:1.1;
      }

      .hha-onboard48-step small{
        display:block;
        margin-top:3px;
        color:#66879c;
        font-size:10px;
        line-height:1.15;
      }

      .hha-onboard48-toggle{
        margin-top:10px;
        width:100%;
        border:0;
        border-radius:18px;
        padding:10px 12px;
        background:#effaff;
        color:#22749e;
        font-weight:1000;
        cursor:pointer;
        touch-action:manipulation;
      }

      .hha-onboard48-overlay{
        position:fixed;
        left:50%;
        top:calc(50% - 26px);
        z-index:22000;
        transform:translate(-50%,-50%) scale(.92);
        width:min(520px,90vw);
        padding:18px 20px;
        border-radius:32px;
        background:rgba(255,255,255,.97);
        border:4px solid #d7f3ff;
        box-shadow:0 28px 80px rgba(30,75,115,.30);
        color:#24445c;
        opacity:0;
        pointer-events:none;
        transition:.22s ease;
      }

      .hha-onboard48-overlay.show{
        opacity:1;
        transform:translate(-50%,-50%) scale(1);
      }

      .hha-onboard48-overlay h3{
        margin:0 0 10px;
        font-size:clamp(24px,5vw,36px);
        line-height:1.05;
        text-align:center;
        color:#1884cf;
      }

      .hha-onboard48-overlay p{
        margin:0 0 12px;
        color:#66879c;
        text-align:center;
        font-weight:900;
        line-height:1.35;
      }

      .hha-onboard48-live{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
        margin-top:12px;
      }

      .hha-onboard48-live div{
        padding:12px 8px;
        border-radius:20px;
        background:#f2fbff;
        border:2px solid #e0f4ff;
        text-align:center;
        font-weight:1000;
      }

      .hha-onboard48-live i{
        display:block;
        font-style:normal;
        font-size:30px;
        line-height:1;
        margin-bottom:5px;
      }

      .hha-onboard48-live small{
        display:block;
        color:#66879c;
        font-size:11px;
        line-height:1.15;
      }

      .hha-onboard48-skip{
        display:block;
        margin:14px auto 0;
        border:0;
        border-radius:999px;
        padding:9px 16px;
        background:#fff4c5;
        color:#85631b;
        font-weight:1000;
        cursor:pointer;
        pointer-events:auto;
      }

      .hha-onboard48-mini{
        position:fixed;
        left:50%;
        top:calc(50% + 94px);
        z-index:21020;
        transform:translateX(-50%) translateY(8px);
        width:min(430px,86vw);
        padding:9px 13px;
        border-radius:999px;
        background:rgba(255,255,255,.94);
        border:2px solid #d7f3ff;
        box-shadow:0 14px 34px rgba(30,75,115,.16);
        color:#24445c;
        text-align:center;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
        transition:.18s ease;
      }

      .hha-onboard48-mini.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }

      body.hha-view-cvr .hha-onboard48-mini{
        top:calc(50% + 112px);
      }

      @media (max-width:520px){
        .hha-onboard48-card{
          padding:10px;
          border-radius:22px;
        }

        .hha-onboard48-steps{
          gap:6px;
        }

        .hha-onboard48-step{
          padding:8px 5px;
          border-radius:16px;
        }

        .hha-onboard48-step i{
          font-size:22px;
        }

        .hha-onboard48-step b{
          font-size:10.5px;
        }

        .hha-onboard48-step small{
          font-size:9px;
        }

        .hha-onboard48-overlay{
          width:min(340px,90vw);
          padding:16px 15px;
          border-radius:28px;
          top:50%;
        }

        .hha-onboard48-live{
          gap:7px;
        }

        .hha-onboard48-live div{
          padding:10px 6px;
          border-radius:18px;
        }

        .hha-onboard48-live i{
          font-size:25px;
        }

        .hha-onboard48-live small{
          font-size:9.5px;
        }

        .hha-onboard48-mini{
          width:min(320px,86vw);
          font-size:12px;
          top:calc(50% + 92px);
        }
      }
    `;

    document.head.appendChild(style);
  }

  function viewActionText(){
    var view = currentView();
    if(view === 'pc') return 'ชี้เมาส์แล้วคลิก';
    if(view === 'cvr') return 'เล็งกลางจอแล้วแตะ';
    return 'แตะเป้าเร็ว ๆ';
  }

  function ensureStartCardHelp(){
    var start = q('.hha-solo-start .hha-solo-card, .hha-hydration-start .hha-start-card');
    if(!start || q('.hha-onboard48-card', start)) return;

    var card = document.createElement('div');
    card.className = 'hha-onboard48-card';
    card.innerHTML = `
      <div class="hha-onboard48-title">
        <b>วิธีเล่น 5 วินาที</b>
        <span>${esc(currentView().toUpperCase())}</span>
      </div>
      <div class="hha-onboard48-steps">
        <div class="hha-onboard48-step"><i>💧</i><b>เก็บน้ำดี</b><small>น้ำเปล่า แตงโม แตงกวา</small></div>
        <div class="hha-onboard48-step"><i>🧋</i><b>หลบของเสีย</b><small>น้ำหวาน เค็มจัด แดดแรง</small></div>
        <div class="hha-onboard48-step"><i>🌞</i><b>สู้บอส</b><small>ต่อคอมโบ รักษา Hydration</small></div>
      </div>
      <button type="button" class="hha-onboard48-toggle">ดูวิธีเล่นอีกครั้ง</button>
    `;

    var startBtn = q('[data-hha-hydration-start-btn], .hha-start-btn, .hha-solo-start-btn', start);
    if(startBtn && startBtn.parentNode){
      startBtn.parentNode.insertBefore(card, startBtn);
    }else{
      start.appendChild(card);
    }

    var btn = q('.hha-onboard48-toggle', card);
    if(btn){
      btn.addEventListener('click', function(ev){
        try{ ev.preventDefault(); ev.stopPropagation(); }catch(e){}
        showOverlay(true);
      }, true);
    }
  }

  function showOverlay(force){
    if(!force && hasSeen()) return;

    var old = q('.hha-onboard48-overlay');
    if(old) old.remove();

    var overlay = document.createElement('div');
    overlay.className = 'hha-onboard48-overlay';
    overlay.innerHTML = `
      <h3>Aqua Rush 💧</h3>
      <p>${esc(viewActionText())} เพื่อเก็บน้ำดี หลบของหวาน/เค็ม/แดดแรง และทำคอมโบเพื่อชนะ Heat Boss</p>
      <div class="hha-onboard48-live">
        <div><i>💧</i>เก็บ<small>เพิ่ม Hydration</small></div>
        <div><i>🧋</i>หลบ<small>ลดคะแนน/คอมโบ</small></div>
        <div><i>⚡</i>ต่อคอมโบ<small>ปล่อย Fever</small></div>
      </div>
      <button type="button" class="hha-onboard48-skip">เข้าใจแล้ว เริ่มลุย!</button>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(function(){
      overlay.classList.add('show');
    });

    var close = function(){
      markSeen();
      overlay.classList.remove('show');
      setTimeout(function(){ try{ overlay.remove(); }catch(e){} }, 240);
    };

    var btn = q('.hha-onboard48-skip', overlay);
    if(btn){
      btn.addEventListener('click', function(ev){
        try{ ev.preventDefault(); ev.stopPropagation(); }catch(e){}
        close();
      }, true);
    }

    setTimeout(close, force ? 5200 : 4200);
  }

  var miniState = {
    step:0,
    lastAt:0,
    shown:false
  };

  var miniTips = [
    '💧 เก็บน้ำดีเพื่อดัน Hydration ให้สูง',
    '🧋 ของหวาน/เค็ม/แดดแรง ทำให้คอมโบหลุด',
    '🎯 คอมโบสูง = Mission + Fever + ลดพลังบอส',
    '🧊 Shield ช่วยกันพลาดได้ 1 ครั้ง'
  ];

  function ensureMini(){
    var n = q('.hha-onboard48-mini');
    if(n) return n;

    n = document.createElement('div');
    n.className = 'hha-onboard48-mini';
    document.body.appendChild(n);
    return n;
  }

  function showMini(text, ms){
    try{
      var n = ensureMini();
      n.textContent = text;
      n.classList.add('show');
      clearTimeout(n._timer);
      n._timer = setTimeout(function(){
        n.classList.remove('show');
      }, ms || 2200);
    }catch(e){}
  }

  function liveMiniTips(){
    var hasHud = !!q('.hha-solo-hud');
    var hasSummary = !!q('.hha-solo-summary');
    if(!hasHud || hasSummary) return;

    if(miniState.shown && Date.now() - miniState.lastAt < 5500) return;

    if(miniState.step < miniTips.length){
      miniState.shown = true;
      miniState.lastAt = Date.now();
      showMini(miniTips[miniState.step], 2300);
      miniState.step += 1;
    }
  }

  function bindStartOverlay(){
    document.addEventListener('click', function(ev){
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-hha-hydration-start-btn], .hha-start-btn, .hha-solo-start-btn') : null;
      if(!btn) return;

      if(!hasSeen()){
        setTimeout(function(){ showOverlay(false); }, 120);
      }
    }, true);
  }

  function observeStart(){
    var mo = new MutationObserver(function(){
      try{ ensureStartCardHelp(); }catch(e){}
    });

    mo.observe(document.body, { childList:true, subtree:true });
  }

  function loop(){
    setInterval(function(){
      try{
        ensureStartCardHelp();
        liveMiniTips();
      }catch(e){}
    }, 500);
  }

  function boot(){
    injectStyle();
    ensureStartCardHelp();
    observeStart();
    bindStartOverlay();
    loop();

    console.info('[Hydration Solo Onboarding Pack48] loaded', VERSION, {
      view:currentView(),
      diff:currentDiff(),
      seen:hasSeen()
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
