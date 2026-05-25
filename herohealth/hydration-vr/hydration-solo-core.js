/* =========================================================
   HeroHealth Hydration Solo Clean Core
   File: /herohealth/hydration-vr/hydration-solo-core.js
   Version: v20260523-pack40-pc-view-balance

   Purpose:
   - Clean Solo core only
   - Supports PC / Mobile / Cardboard cVR
   - Start → Gameplay → Summary → Cooldown → Nutrition Zone
   - Does not depend on old hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var VERSION = 'v20260523-pack40-pc-view-balance';

  if(window.HHA_HYDRATION_SOLO_CORE_PACK37_LOADED){
    console.warn('[Hydration Solo Pack37] already loaded');
    return;
  }

  window.HHA_HYDRATION_SOLO_CORE_PACK37_LOADED = true;

  window.HHA = window.HHA || {};
  window.HHA.Hydration = window.HHA.Hydration || {};
  window.HHA.Hydration.VERSION = VERSION;
  window.HHA.Hydration.booted = false;
  window.HHA.Hydration.started = false;
  window.HHA.Hydration.destroyed = false;

  var $ = function(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  };

  var $$ = function(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  };

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

  function getUrl(){
    try{ return new URL(location.href); }
    catch(e){ return new URL('./run.html', location.origin); }
  }

  function qs(k, d){
    try{ return getUrl().searchParams.get(k) || d; }
    catch(e){ return d; }
  }

  function heroBase(){
    try{
      var marker = '/herohealth/';
      var idx = location.pathname.indexOf(marker);
      if(idx >= 0){
        return location.origin + location.pathname.slice(0, idx + marker.length);
      }
      return new URL('../', location.href).toString();
    }catch(e){
      return 'https://supparang.github.io/webxr-health-mobile/herohealth/';
    }
  }

  function nutritionZoneUrl(){
    var u = new URL('nutrition-zone.html', heroBase());

    [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'log',
      'api',
      'studyId',
      'conditionGroup'
    ].forEach(function(k){
      var v = qs(k, '');
      if(v) u.searchParams.set(k, v);
    });

    u.searchParams.set('hub', new URL('hub.html', heroBase()).toString());
    return u.toString();
  }

  function cooldownGateUrl(){
    var ctx = STATE.ctx;
    var zone = nutritionZoneUrl();
    var gate = new URL('warmup-gate.html', heroBase());

    gate.searchParams.set('phase', 'cooldown');
    gate.searchParams.set('gatePhase', 'cooldown');
    gate.searchParams.set('studyPhase', 'cooldown');
    gate.searchParams.set('game', 'hydration');
    gate.searchParams.set('gameId', 'hydration');
    gate.searchParams.set('zone', 'nutrition');
    gate.searchParams.set('cat', 'nutrition');
    gate.searchParams.set('theme', 'hydration');
    gate.searchParams.set('mode', 'solo');
    gate.searchParams.set('view', ctx.view);
    gate.searchParams.set('pid', ctx.pid);
    gate.searchParams.set('name', ctx.name);
    gate.searchParams.set('nick', ctx.nick);
    gate.searchParams.set('diff', ctx.diff);
    gate.searchParams.set('time', String(ctx.time));
    gate.searchParams.set('seed', ctx.seed);

    gate.searchParams.set('next', zone);
    gate.searchParams.set('cdnext', zone);
    gate.searchParams.set('return', zone);
    gate.searchParams.set('back', zone);
    gate.searchParams.set('hub', zone);
    gate.searchParams.set('forceReturn', 'nutrition-zone');
    gate.searchParams.set('fromGame', 'hydration');

    return gate.toString();
  }

  function hashSeed(str){
    str = String(str || 'hydration');
    var h = 2166136261;
    for(var i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed){
    var a = seed >>> 0;
    return function(){
      a += 0x6D2B79F5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rand(min, max){
    return min + STATE.rng() * (max - min);
  }

  function pick(arr){
    return arr[Math.floor(STATE.rng() * arr.length)] || arr[0];
  }

  function normalizeView(v){
    v = String(v || '').toLowerCase();
    if(v === 'pc' || v === 'mobile' || v === 'cvr') return v;
    return 'mobile';
  }

  function normalizeDiff(v){
    v = String(v || '').toLowerCase();
    if(['easy','normal','hard','challenge'].indexOf(v) >= 0) return v;
    return 'normal';
  }

  function getCtx(){
    var runCtx = window.HHA_HYDRATION_RUN_CONTEXT || {};
    var view = normalizeView(runCtx.view || qs('view','mobile'));
    var diff = normalizeDiff(runCtx.diff || qs('diff','normal'));

    return {
      pid: qs('pid', runCtx.pid || 'anon'),
      name: qs('name', runCtx.name || qs('nick','Hero')),
      nick: qs('nick', runCtx.nick || qs('name','Hero')),
      mode: 'solo',
      view: view,
      diff: diff,
      time: clamp(Number(qs('time', runCtx.time || 90)), 45, 240),
      seed: qs('seed', runCtx.seed || String(Date.now())),
      hub: qs('hub', nutritionZoneUrl())
    };
  }

  var ITEMS = {
    good: [
      { icon:'💧', title:'น้ำเปล่า', sub:'เก็บน้ำ!', score:90, hydrate:9 },
      { icon:'🍉', title:'แตงโม', sub:'ฉ่ำน้ำ!', score:80, hydrate:7 },
      { icon:'🥒', title:'แตงกวา', sub:'น้ำเยอะ!', score:75, hydrate:6 },
      { icon:'🧊', title:'Ice Shield', sub:'กันแดด!', score:60, hydrate:4, shield:1 }
    ],
    bad: [
      { icon:'🧋', title:'น้ำหวาน', sub:'หลบเลย!', score:-80, hydrate:-11 },
      { icon:'🍟', title:'เค็มจัด', sub:'กระหายน้ำ!', score:-70, hydrate:-9 },
      { icon:'☀️', title:'แดดแรง', sub:'ทำให้น้ำลด!', score:-60, hydrate:-12 },
      { icon:'🍩', title:'หวานมาก', sub:'เสียคอมโบ!', score:-70, hydrate:-10 }
    ]
  };

  var DIFF = {
    easy:      { spawn:1250, life:2500, goodRate:.78, maxTargets:3, drain:.20, bossAt:.72 },
    normal:    { spawn:1050, life:2200, goodRate:.70, maxTargets:4, drain:.28, bossAt:.65 },
    hard:      { spawn:900,  life:1900, goodRate:.64, maxTargets:5, drain:.36, bossAt:.58 },
    challenge: { spawn:760,  life:1650, goodRate:.58, maxTargets:6, drain:.46, bossAt:.52 }
  };

  var STATE = {
    ctx: null,
    rng: Math.random,
    booted:false,
    started:false,
    ended:false,
    paused:false,

    score:0,
    hydration:60,
    combo:0,
    maxCombo:0,
    shield:0,
    fever:0,
    feverUntil:0,

    goodHits:0,
    badHits:0,
    misses:0,
    targets:0,
    missions:0,
    bossDefeated:false,
    bossHp:100,
    bossActive:false,

    startAt:0,
    endAt:0,
    remaining:90,
    timerId:0,
    spawnId:0,
    decayId:0,
    rafId:0
  };

  function injectStyle(){
    if($('#hha-hydration-solo-pack37-css')) return;

    var style = document.createElement('style');
    style.id = 'hha-hydration-solo-pack37-css';
    style.textContent = `
      .hha-solo-start{
        position:fixed;
        inset:0;
        z-index:30000;
        display:grid;
        place-items:center;
        padding:18px;
        background:
          radial-gradient(circle at 18% 18%,rgba(120,230,255,.45),transparent 30%),
          radial-gradient(circle at 82% 18%,rgba(130,255,220,.35),transparent 30%),
          linear-gradient(180deg,#e9fcff,#dff8ff);
      }

      .hha-solo-card{
        width:min(92vw,520px);
        border-radius:34px;
        padding:26px;
        background:rgba(255,255,255,.94);
        border:3px solid rgba(204,238,251,.9);
        box-shadow:0 24px 70px rgba(30,75,115,.24);
        text-align:center;
        color:#24445c;
      }

      .hha-solo-logo{
        width:90px;
        height:90px;
        border-radius:28px;
        margin:0 auto 12px;
        display:grid;
        place-items:center;
        font-size:54px;
        background:linear-gradient(180deg,#eaffff,#d5f5ff);
      }

      .hha-solo-badge{
        display:inline-flex;
        gap:8px;
        align-items:center;
        justify-content:center;
        padding:8px 14px;
        border-radius:999px;
        background:#eefbff;
        color:#1884cf;
        font-weight:1000;
        font-size:13px;
        margin-bottom:8px;
      }

      .hha-solo-card h1{
        margin:4px 0 4px;
        font-size:clamp(34px,7vw,54px);
        line-height:1;
        color:#1884cf;
        font-weight:1000;
      }

      .hha-solo-card p{
        margin:0 0 12px;
        color:#66879c;
        font-weight:900;
        line-height:1.35;
      }

      .hha-solo-rules{
        margin:14px 0;
        display:grid;
        gap:10px;
        text-align:left;
      }

      .hha-solo-rule{
        display:grid;
        grid-template-columns:42px 1fr;
        gap:10px;
        align-items:center;
        padding:12px;
        border-radius:18px;
        background:#f2fbff;
        font-weight:950;
      }

      .hha-solo-rule span{
        font-size:24px;
        text-align:center;
      }

      .hha-solo-rule small{
        display:block;
        color:#66879c;
        font-weight:900;
      }

      .hha-solo-meta{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:8px;
        margin:12px 0 16px;
      }

      .hha-solo-chip{
        border-radius:999px;
        padding:8px 14px;
        background:#fff4c5;
        color:#85631b;
        font-weight:1000;
      }

      .hha-solo-start-btn,
      .hha-solo-back-btn{
        width:100%;
        border:0;
        border-radius:22px;
        padding:15px 18px;
        font-size:22px;
        font-weight:1000;
        cursor:pointer;
        touch-action:manipulation;
      }

      .hha-solo-start-btn{
        color:white;
        background:linear-gradient(180deg,#43c7ff,#2388ff);
        box-shadow:0 12px 28px rgba(35,136,255,.28);
      }

      .hha-solo-back-btn{
        margin-top:10px;
        color:#22749e;
        background:#fff;
        border:3px solid #d8f3ff;
      }

      .hha-solo-hud{
        position:fixed;
        top:calc(10px + env(safe-area-inset-top,0px));
        left:10px;
        right:10px;
        z-index:10020;
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        pointer-events:none;
      }

      .hha-solo-pill{
        min-width:92px;
        padding:8px 12px;
        border-radius:16px;
        background:rgba(255,255,255,.94);
        border:2px solid #d7f1ff;
        box-shadow:0 8px 20px rgba(30,75,115,.14);
        color:#24445c;
        font-weight:1000;
        text-align:center;
      }

      .hha-solo-pill b{
        display:block;
        font-size:22px;
        line-height:1;
      }

      .hha-solo-pill small{
        display:block;
        color:#66879c;
        font-size:11px;
        margin-top:2px;
      }

      .hha-solo-pill.hot{
        border-color:#ffd28c;
      }

      .hha-solo-topbar{
        position:fixed;
        top:calc(86px + env(safe-area-inset-top,0px));
        left:50%;
        z-index:10015;
        transform:translateX(-50%);
        width:min(360px,54vw);
        display:flex;
        align-items:center;
        gap:10px;
        pointer-events:none;
      }

      .hha-solo-bar{
        flex:1;
        height:14px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(255,255,255,.72);
        box-shadow:inset 0 0 0 2px rgba(204,238,251,.9);
      }

      .hha-solo-bar-fill{
        height:100%;
        width:100%;
        border-radius:999px;
        background:linear-gradient(90deg,#62e68f,#43c7ff);
        transition:width .2s linear;
      }

      .hha-solo-time{
        min-width:54px;
        padding:8px 10px;
        border-radius:999px;
        background:rgba(255,255,255,.96);
        color:#24445c;
        font-weight:1000;
        text-align:center;
      }

      .hha-solo-controls{
        position:fixed;
        top:calc(12px + env(safe-area-inset-top,0px));
        right:12px;
        z-index:10040;
        display:flex;
        gap:8px;
      }

      .hha-solo-controls button{
        width:52px;
        height:52px;
        border:0;
        border-radius:18px;
        background:rgba(255,255,255,.94);
        box-shadow:0 8px 20px rgba(30,75,115,.14);
        font-size:24px;
        cursor:pointer;
      }

      .hha-solo-banner{
        position:fixed;
        top:calc(126px + env(safe-area-inset-top,0px));
        left:50%;
        transform:translateX(-50%);
        z-index:10010;
        max-width:min(90vw,520px);
        padding:10px 16px;
        border-radius:999px;
        background:rgba(255,255,255,.94);
        color:#24445c;
        font-weight:1000;
        text-align:center;
        box-shadow:0 10px 28px rgba(30,75,115,.16);
        opacity:0;
        pointer-events:none;
        transition:opacity .18s, transform .18s;
      }

      .hha-solo-banner.show{
        opacity:1;
        transform:translateX(-50%) translateY(4px);
      }

      .hha-solo-target{
        position:absolute;
        z-index:80;
        width:86px;
        min-height:96px;
        border-radius:24px;
        border:5px solid #62e68f;
        background:rgba(255,255,255,.95);
        box-shadow:0 16px 38px rgba(30,75,115,.22);
        display:grid;
        place-items:center;
        padding:8px;
        color:#24445c;
        font-weight:1000;
        text-align:center;
        cursor:pointer;
        user-select:none;
        touch-action:manipulation;
        animation:hhaSoloPop .2s ease-out both, hhaSoloFloat 1.5s ease-in-out infinite alternate;
      }

      .hha-solo-target.bad{
        border-color:#ff996f;
      }

      .hha-solo-target.shield{
        border-color:#74dcff;
      }

      .hha-solo-target .icon{
        display:block;
        font-size:34px;
        line-height:1;
      }

      .hha-solo-target .title{
        display:block;
        font-size:13px;
        line-height:1.1;
        margin-top:3px;
      }

      .hha-solo-target .sub{
        display:block;
        font-size:10px;
        color:#66879c;
        line-height:1.1;
        margin-top:2px;
      }

      @keyframes hhaSoloPop{
        from{ transform:scale(.65); opacity:0; }
        to{ transform:scale(1); opacity:1; }
      }

      @keyframes hhaSoloFloat{
        from{ margin-top:0; }
        to{ margin-top:-8px; }
      }

      .hha-solo-cvr-crosshair{
        position:fixed;
        left:50%;
        top:50%;
        z-index:11000;
        width:42px;
        height:42px;
        transform:translate(-50%,-50%);
        pointer-events:none;
        display:none;
      }

      .hha-solo-cvr-crosshair::before,
      .hha-solo-cvr-crosshair::after{
        content:'';
        position:absolute;
        background:#24536f;
        opacity:.88;
        border-radius:999px;
      }

      .hha-solo-cvr-crosshair::before{
        left:50%;
        top:0;
        width:4px;
        height:100%;
        transform:translateX(-50%);
      }

      .hha-solo-cvr-crosshair::after{
        top:50%;
        left:0;
        height:4px;
        width:100%;
        transform:translateY(-50%);
      }

      .hha-solo-cvr-crosshair span{
        position:absolute;
        inset:8px;
        border:3px solid #43c7ff;
        border-radius:999px;
        background:rgba(255,255,255,.25);
      }

      body.hha-view-cvr .hha-solo-cvr-crosshair{
        display:block;
      }

      body.hha-view-cvr .hha-solo-target{
        cursor:default;
      }

      .hha-solo-summary{
        position:fixed;
        inset:0;
        z-index:25000;
        overflow:auto;
        padding:
          calc(16px + env(safe-area-inset-top,0px))
          16px
          calc(28px + env(safe-area-inset-bottom,0px));
        background:
          radial-gradient(circle at 20% 8%,rgba(128,230,255,.45),transparent 28%),
          linear-gradient(180deg,#f5feff,#eafaff);
        color:#24445c;
      }

      .hha-solo-summary-card{
        width:min(96vw,720px);
        margin:0 auto;
        background:rgba(255,255,255,.96);
        border:3px solid #d7f3ff;
        border-radius:34px;
        padding:24px;
        box-shadow:0 24px 70px rgba(30,75,115,.24);
      }

      .hha-solo-rank{
        font-size:clamp(44px,9vw,76px);
        font-weight:1000;
        line-height:1;
        text-align:center;
        margin:6px 0;
      }

      .hha-solo-stars{
        text-align:center;
        font-size:42px;
        margin:8px 0 18px;
      }

      .hha-solo-bigscore{
        border-radius:26px;
        padding:22px;
        border:3px solid #d7f3ff;
        background:#f2fbff;
        text-align:center;
        font-size:clamp(58px,14vw,106px);
        color:#1884cf;
        font-weight:1000;
        line-height:1;
      }

      .hha-solo-bigscore small{
        display:block;
        font-size:16px;
        color:#66879c;
        margin-top:8px;
      }

      .hha-solo-grid{
        display:grid;
        grid-template-columns:repeat(2, minmax(0,1fr));
        gap:12px;
        margin:16px 0;
      }

      .hha-solo-stat{
        border:3px solid #e0f4ff;
        border-radius:24px;
        padding:16px;
        text-align:center;
        font-weight:1000;
        background:#fff;
      }

      .hha-solo-stat b{
        display:block;
        font-size:38px;
        line-height:1;
      }

      .hha-solo-stat small{
        color:#66879c;
      }

      .hha-solo-lesson{
        display:grid;
        grid-template-columns:52px 1fr;
        gap:12px;
        align-items:center;
        padding:16px;
        margin:14px 0;
        border-radius:24px;
        background:#f2fff6;
        border:3px solid #b9efc5;
        font-weight:950;
      }

      .hha-solo-actions{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:12px;
        margin-top:18px;
      }

      .hha-solo-actions button{
        border:0;
        border-radius:22px;
        padding:16px;
        font-size:20px;
        font-weight:1000;
        cursor:pointer;
      }

      .hha-solo-actions .primary{
        color:white;
        background:linear-gradient(180deg,#43c7ff,#2388ff);
      }

      .hha-solo-actions .green{
        color:white;
        background:linear-gradient(180deg,#62e68f,#35c76d);
      }

      .hha-solo-actions .white{
        color:#22749e;
        background:#fff;
        border:3px solid #d7f3ff;
      }

      @media (max-width:520px){
        .hha-solo-hud{
         top:calc(6px + env(safe-area-inset-top,0px));
         left:8px;
         right:8px;
         gap:6px;
         max-width:310px;
      }
      .hha-solo-pill{
        min-width:76px;
        padding:7px 8px;
        border-radius:16px;
      }

      .hha-solo-pill b{
         font-size:20px;
      }

      .hha-solo-pill small{
        font-size:10px;
      }

      .hha-solo-controls{
        top:calc(10px + env(safe-area-inset-top,0px));
        right:8px;
        gap:7px;
      }

      .hha-solo-controls button{
        width:48px;
        height:48px;
        border-radius:16px;
        font-size:22px;
      }

      .hha-solo-topbar{
        top:calc(126px + env(safe-area-inset-top,0px));
        width:min(290px,62vw);
      }

      .hha-solo-time{
        min-width:48px;
        padding:7px 9px;
      }

      .hha-solo-banner{
        top:calc(168px + env(safe-area-inset-top,0px));
        width:74vw;
        max-width:310px;
        padding:9px 13px;
        border-radius:24px;
        font-size:16px;
        line-height:1.2;
      }

      .hha-solo-target{
        width:58px;
        min-height:70px;
        border-radius:18px;
        border-width:3px;
        padding:6px;
        box-shadow:0 10px 26px rgba(30,75,115,.18);
      }

      .hha-solo-target .icon{
        font-size:26px;
      }

      .hha-solo-target .title{
        font-size:10.5px;
        line-height:1.05;
      }

      .hha-solo-target .sub{
        font-size:9px;
        line-height:1.05;
        margin-top:1px;
      }

        .hha-solo-grid{
          grid-template-columns:1fr 1fr;
        }

        .hha-solo-actions{
          grid-template-columns:1fr;
        }
      }

      @media (min-width:900px){
        .hha-solo-target{
          width:92px;
          min-height:104px;
        }

        .hha-solo-hud{
          right:auto;
          max-width:760px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function clearAll(){
    clearInterval(STATE.timerId);
    clearInterval(STATE.spawnId);
    clearInterval(STATE.decayId);
    cancelAnimationFrame(STATE.rafId);

    STATE.timerId = 0;
    STATE.spawnId = 0;
    STATE.decayId = 0;
    STATE.rafId = 0;

    $$('.hha-solo-target').forEach(function(n){
      try{ n.remove(); }catch(e){}
    });

    ['.hha-solo-start','.hha-solo-hud','.hha-solo-topbar','.hha-solo-controls','.hha-solo-banner','.hha-solo-summary','.hha-solo-cvr-crosshair'].forEach(function(sel){
      $$(sel).forEach(function(n){
        try{ n.remove(); }catch(e){}
      });
    });
  }

  function playfield(){
    return $('#hha-hydration-playfield') || $('#hha-hydration-stage') || document.body;
  }

  function showBanner(text, ms){
    var b = $('.hha-solo-banner');
    if(!b){
      b = document.createElement('div');
      b.className = 'hha-solo-banner';
      document.body.appendChild(b);
    }

    b.textContent = text || '';
    b.classList.add('show');

    clearTimeout(b._timer);
    b._timer = setTimeout(function(){
      b.classList.remove('show');
    }, ms || 1100);
  }

  function renderStart(){
    clearAll();

    STATE.ctx = getCtx();
    STATE.rng = mulberry32(hashSeed(STATE.ctx.seed + '-' + STATE.ctx.view + '-' + STATE.ctx.diff));
    STATE.started = false;
    STATE.ended = false;
    STATE.paused = false;

    document.body.classList.remove('hha-view-pc','hha-view-mobile','hha-view-cvr');
    document.body.classList.add('hha-view-' + STATE.ctx.view);
    document.body.dataset.view = STATE.ctx.view;
    document.body.dataset.mode = 'solo';

    var card = document.createElement('div');
    card.className = 'hha-solo-start hha-hydration-start';
    card.dataset.hhaHydrationStart = '1';

    card.innerHTML = `
      <div class="hha-solo-card hha-start-card">
        <div class="hha-solo-logo">💧</div>
        <div class="hha-solo-badge">HeroHealth Hydration</div>
        <h1>Aqua Rush</h1>
        <p>ช่วยร่างกายเติมน้ำ หลบของหวาน สู้ Heat Monster!</p>

        <div class="hha-solo-rules">
          <div class="hha-solo-rule">
            <span>💧</span>
            <div>เก็บ <small>น้ำเปล่า / แตงโม / แตงกวา / Ice Shield</small></div>
          </div>
          <div class="hha-solo-rule">
            <span>🧋</span>
            <div>หลบ <small>น้ำหวาน / เค็มจัด / แดดแรง</small></div>
          </div>
          <div class="hha-solo-rule">
            <span>🎯</span>
            <div>ทำ Mission <small>รักษา Hydration ให้พอเพื่อชนะบอส</small></div>
          </div>
        </div>

        <div class="hha-solo-meta">
          <span class="hha-solo-chip">ระดับ: ${esc(STATE.ctx.diff)}</span>
          <span class="hha-solo-chip">เวลา: ${esc(STATE.ctx.time)}s</span>
          <span class="hha-solo-chip">View: ${esc(STATE.ctx.view)}</span>
        </div>

        <button type="button" class="hha-solo-start-btn hha-start-btn" data-hha-hydration-start-btn="1">
          เริ่มภารกิจ 💧
        </button>

        <button type="button" class="hha-solo-back-btn" data-hha-hydration-back-btn="1">
          กลับ Nutrition Zone
        </button>
      </div>
    `;

    document.body.appendChild(card);

    var startBtn = $('.hha-solo-start-btn', card);
    var backBtn = $('.hha-solo-back-btn', card);

    if(startBtn){
      startBtn.addEventListener('click', beginHydrationFromOverlay);
      startBtn.addEventListener('pointerup', beginHydrationFromOverlay);
      startBtn.addEventListener('touchend', function(ev){
        try{ ev.preventDefault(); }catch(e){}
        beginHydrationFromOverlay();
      }, { passive:false });
    }

    if(backBtn){
      backBtn.addEventListener('click', goHydrationBackHub);
    }

    window.HHA.Hydration.booted = true;
    window.HHA.Hydration.started = false;
    window.HHA.Hydration.destroyed = false;

    console.info('[Hydration Solo Pack37] start rendered', STATE.ctx);
  }

  function renderHud(){
    var hud = document.createElement('div');
    hud.className = 'hha-solo-hud hha-hydration-hud';
    hud.innerHTML = `
      <div class="hha-solo-pill hot"><b id="hha-solo-hydration">60%</b><small>Hydration</small></div>
      <div class="hha-solo-pill"><b id="hha-solo-score">0</b><small>Score</small></div>
      <div class="hha-solo-pill"><b id="hha-solo-combo">0</b><small>Combo</small></div>
      <div class="hha-solo-pill"><b id="hha-solo-shield">0</b><small>Shield</small></div>
      <div class="hha-solo-pill"><b id="hha-solo-fever">0%</b><small>Fever</small></div>
    `;
    document.body.appendChild(hud);

    var top = document.createElement('div');
    top.className = 'hha-solo-topbar hha-timebar';
    top.innerHTML = `
      <div class="hha-solo-bar"><div id="hha-solo-time-fill" class="hha-solo-bar-fill"></div></div>
      <div id="hha-solo-time" class="hha-solo-time">${STATE.remaining}s</div>
    `;
    document.body.appendChild(top);

    var controls = document.createElement('div');
    controls.className = 'hha-solo-controls';
    controls.innerHTML = `
      <button type="button" id="hha-solo-pause" aria-label="pause">⏸️</button>
      <button type="button" id="hha-solo-home" aria-label="home">🏠</button>
    `;
    document.body.appendChild(controls);

    $('#hha-solo-pause').addEventListener('click', toggleHydrationPause);
    $('#hha-solo-home').addEventListener('click', goHydrationBackHub);

    if(STATE.ctx.view === 'cvr'){
      var cross = document.createElement('div');
      cross.className = 'hha-solo-cvr-crosshair';
      cross.innerHTML = '<span></span>';
      document.body.appendChild(cross);
    }
  }

  function updateHud(){
    var hp = $('#hha-solo-hydration');
    var sc = $('#hha-solo-score');
    var co = $('#hha-solo-combo');
    var sh = $('#hha-solo-shield');
    var fe = $('#hha-solo-fever');
    var tm = $('#hha-solo-time');
    var fill = $('#hha-solo-time-fill');

    if(hp) hp.textContent = Math.round(STATE.hydration) + '%';
    if(sc) sc.textContent = Math.round(STATE.score);
    if(co) co.textContent = STATE.combo;
    if(sh) sh.textContent = STATE.shield;
    if(fe) fe.textContent = Math.round(STATE.fever) + '%';
    if(tm) tm.textContent = Math.max(0, Math.ceil(STATE.remaining)) + 's';

    if(fill){
      var pct = clamp(STATE.remaining / STATE.ctx.time * 100, 0, 100);
      fill.style.width = pct + '%';
    }
  }

  function targetSize(){
  /*
    Pack40 View Balance
    - Mobile เล็กพอดีแล้ว
    - PC เพิ่มขนาดนิดให้ไม่โล่งเกินไป
    - cVR ใหญ่กว่ามือถือเพื่อเล็งด้วย crosshair ง่ายขึ้น
  */
   if(STATE.ctx.view === 'mobile') return { w:58, h:70 };
   if(STATE.ctx.view === 'cvr') return { w:78, h:92 };
   return { w:104, h:118 };
   }

  function safeArea(){
    var pf = playfield().getBoundingClientRect();
    var view = STATE.ctx.view;
    var vw = window.innerWidth || pf.width || 390;
    var vh = window.innerHeight || pf.height || 800;


  /*
  Pack40:
  - Mobile เว้นจาก HUD แล้ว
  - PC ลดพื้นที่ขอบซ้าย/ขวาแบบ “สนามเล่นกลางจอ” ให้ไม่โล่งเกินไป
  - cVR ยังเว้นกลางจอสำหรับ crosshair
*/
      var top = view === 'mobile' ? 250 : view === 'cvr' ? 190 : 170;
      var bottom = view === 'mobile' ? 110 : view === 'cvr' ? 80 : 90;
      var left = view === 'mobile' ? 24 : view === 'cvr' ? 40 : 90;
      var right = view === 'mobile' ? 24 : view === 'cvr' ? 40 : 90;

    return {
      width: pf.width || vw,
      height: pf.height || vh,
      top: top,
      bottom: bottom,
      left: left,
      right: right
    };
  }

  function placeTarget(el){
    var area = safeArea();
    var size = targetSize();

    var maxX = Math.max(area.left, area.width - size.w - area.right);
    var maxY = Math.max(area.top + 20, area.height - size.h - area.bottom);

    var x = rand(area.left, maxX);
    var y = rand(area.top, maxY);

    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
  }

  function activeTargets(){
    return $$('.hha-solo-target').filter(function(t){ return t.isConnected; });
  }

  function spawnTarget(){
    if(!STATE.started || STATE.ended || STATE.paused) return;

    var cfg = DIFF[STATE.ctx.diff] || DIFF.normal;
    if(activeTargets().length >= cfg.maxTargets) return;

    var isGood = STATE.rng() < cfg.goodRate;
    var item = isGood ? pick(ITEMS.good) : pick(ITEMS.bad);

    if(STATE.bossActive && STATE.rng() < .28){
      isGood = false;
      item = { icon:'☀️', title:'Heat Boss', sub:'แดดแรง!', score:-100, hydrate:-14, boss:true };
    }

    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'hha-solo-target hha-hydration-target ' + (isGood ? 'good is-good' : 'bad is-bad');
    if(item.shield) el.classList.add('shield');

    el.dataset.good = isGood ? '1' : '0';
    el.dataset.score = String(item.score || 0);
    el.dataset.hydrate = String(item.hydrate || 0);
    el.dataset.shield = String(item.shield || 0);
    el.dataset.boss = item.boss ? '1' : '0';

    el.innerHTML = `
      <span>
        <span class="icon">${esc(item.icon)}</span>
        <span class="title">${esc(item.title)}</span>
        <span class="sub">${esc(item.sub)}</span>
      </span>
    `;

    placeTarget(el);
    playfield().appendChild(el);
    STATE.targets++;

    el.addEventListener('click', function(ev){
      if(STATE.ctx.view === 'cvr') return;
      try{ ev.preventDefault(); }catch(e){}
      hitTarget(el);
    });

    var life = (DIFF[STATE.ctx.diff] || DIFF.normal).life;
    el._life = setTimeout(function(){
      if(!el.isConnected || STATE.ended) return;

      if(el.dataset.good === '1'){
        STATE.misses++;
        STATE.combo = 0;
        STATE.hydration = clamp(STATE.hydration - 3, 0, 100);
        showBanner('พลาดน้ำดี! เติมน้ำให้ทันนะ');
      }

      try{ el.remove(); }catch(e){}
      updateHud();
    }, life);
  }

  function hitTarget(el){
    if(!el || !el.isConnected || STATE.ended || STATE.paused) return;

    clearTimeout(el._life);

    var good = el.dataset.good === '1';
    var score = Number(el.dataset.score || 0);
    var hydrate = Number(el.dataset.hydrate || 0);
    var shield = Number(el.dataset.shield || 0);
    var boss = el.dataset.boss === '1';

    if(good){
      STATE.goodHits++;
      STATE.combo++;
      STATE.maxCombo = Math.max(STATE.maxCombo, STATE.combo);
      STATE.score += score + Math.min(STATE.combo * 8, 160);
      STATE.hydration = clamp(STATE.hydration + hydrate, 0, 100);
      STATE.fever = clamp(STATE.fever + 8 + STATE.combo, 0, 100);

      if(shield){
        STATE.shield += shield;
        showBanner('🧊 ได้ Ice Shield กันแดด!');
      }else{
        showBanner('💧 ดีมาก! เติมน้ำสำเร็จ');
      }

      if(STATE.combo > 0 && STATE.combo % 8 === 0){
        STATE.missions++;
        STATE.score += 180;
        STATE.bossHp = clamp(STATE.bossHp - 18, 0, 100);
        showBanner('🎯 Mission สำเร็จ! ลดพลัง Heat Boss');
      }
    }else{
      if(STATE.shield > 0){
        STATE.shield--;
        STATE.score += 20;
        showBanner('🛡️ Shield บล็อกของเสีย!');
      }else{
        STATE.badHits++;
        STATE.combo = 0;
        STATE.score = Math.max(0, STATE.score + score);
        STATE.hydration = clamp(STATE.hydration + hydrate, 0, 100);
        STATE.fever = clamp(STATE.fever - 12, 0, 100);
        STATE.bossHp = clamp(STATE.bossHp + (boss ? 7 : 3), 0, 100);
        showBanner('หลบของหวาน/เค็มนะ เติมน้ำให้ทัน');
      }
    }

    if(STATE.fever >= 100){
      STATE.score += 280;
      STATE.fever = 20;
      showBanner('⚡ Fever! คะแนนพุ่ง');
    }

    if(STATE.bossActive && STATE.hydration >= 70 && STATE.missions >= 3 && STATE.bossHp <= 40){
      STATE.bossDefeated = true;
      STATE.bossActive = false;
      STATE.score += 600;
      showBanner('🌞 ชนะ Heat Monster แล้ว!');
    }

    try{ el.remove(); }catch(e){}
    updateHud();
  }

  function shootCvr(){
    if(STATE.ctx.view !== 'cvr') return;

    var cx = (window.innerWidth || 0) / 2;
    var cy = (window.innerHeight || 0) / 2;
    var best = null;
    var bestD = Infinity;

    activeTargets().forEach(function(t){
      var r = t.getBoundingClientRect();
      var tx = r.left + r.width / 2;
      var ty = r.top + r.height / 2;
      var dx = tx - cx;
      var dy = ty - cy;
      var d = Math.sqrt(dx * dx + dy * dy);

      if(
        cx >= r.left - 48 &&
        cx <= r.right + 48 &&
        cy >= r.top - 48 &&
        cy <= r.bottom + 48 &&
        d < bestD
      ){
        best = t;
        bestD = d;
      }
    });

    if(best){
      hitTarget(best);
    }else{
      STATE.combo = 0;
      STATE.misses++;
      STATE.hydration = clamp(STATE.hydration - 1, 0, 100);
      showBanner('เล็งให้ตรงเป้าก่อนยิง');
      updateHud();
    }
  }

  function bindCvrShoot(){
    if(STATE.ctx.view !== 'cvr') return;

    document.addEventListener('click', function(ev){
      var target = ev.target;
      if(target && target.closest && target.closest('button, a, input, .hha-solo-summary, .hha-solo-start')){
        return;
      }
      shootCvr();
    }, true);

    window.addEventListener('hha:shoot', function(){
      shootCvr();
    });
  }

  function tick(){
    if(!STATE.started || STATE.ended) return;
    if(STATE.paused) return;

    var now = Date.now();
    STATE.remaining = Math.max(0, STATE.ctx.time - ((now - STATE.startAt) / 1000));

    var cfg = DIFF[STATE.ctx.diff] || DIFF.normal;
    STATE.hydration = clamp(STATE.hydration - cfg.drain, 0, 100);

    if(!STATE.bossActive && STATE.remaining <= STATE.ctx.time * cfg.bossAt){
      STATE.bossActive = true;
      showBanner('🌞 Heat Monster มาแล้ว! รักษา Hydration ให้ดี', 1700);
    }

    if(STATE.hydration <= 20){
      showBanner('⚠️ Hydration ต่ำมาก รีบเก็บน้ำดี!');
    }

    if(STATE.remaining <= 0 || STATE.hydration <= 0){
      endGame();
      return;
    }

    updateHud();
  }

  function beginHydrationFromOverlay(ev){
    if(ev){
      try{ ev.preventDefault(); }catch(e){}
      try{ ev.stopPropagation(); }catch(e){}
    }

    if(STATE.started && !STATE.ended) return true;

    STATE.ctx = getCtx();
    STATE.rng = mulberry32(hashSeed(STATE.ctx.seed + '-' + STATE.ctx.view + '-' + STATE.ctx.diff));

    clearAll();

    STATE.started = true;
    STATE.ended = false;
    STATE.paused = false;
    STATE.score = 0;
    STATE.hydration = 60;
    STATE.combo = 0;
    STATE.maxCombo = 0;
    STATE.shield = 0;
    STATE.fever = 0;
    STATE.goodHits = 0;
    STATE.badHits = 0;
    STATE.misses = 0;
    STATE.targets = 0;
    STATE.missions = 0;
    STATE.bossDefeated = false;
    STATE.bossHp = 100;
    STATE.bossActive = false;
    STATE.remaining = STATE.ctx.time;
    STATE.startAt = Date.now();

    document.body.classList.remove('hha-view-pc','hha-view-mobile','hha-view-cvr');
    document.body.classList.add('hha-view-' + STATE.ctx.view);
    document.body.dataset.view = STATE.ctx.view;
    document.body.dataset.mode = 'solo';

    renderHud();
    bindCvrShoot();

    updateHud();
    showBanner('เริ่มภารกิจเติมน้ำ!');

    STATE.spawnId = setInterval(spawnTarget, (DIFF[STATE.ctx.diff] || DIFF.normal).spawn);
    STATE.timerId = setInterval(tick, 250);

    for(var i=0; i<3; i++){
      setTimeout(spawnTarget, i * 420);
    }

    window.HHA.Hydration.started = true;
    window.HHA.Hydration.booted = true;
    window.HHA.Hydration.destroyed = false;

    console.info('[Hydration Solo Pack37] game started', STATE.ctx);

    return true;
  }

  function toggleHydrationPause(){
    if(!STATE.started || STATE.ended) return;

    STATE.paused = !STATE.paused;

    var btn = $('#hha-solo-pause');
    if(btn) btn.textContent = STATE.paused ? '▶️' : '⏸️';

    showBanner(STATE.paused ? 'พักเกมไว้ก่อน' : 'เล่นต่อ!');
  }

  function resumeHydrationGame(){
    STATE.paused = false;
    var btn = $('#hha-solo-pause');
    if(btn) btn.textContent = '⏸️';
    showBanner('เล่นต่อ!');
  }

  function rank(){
    if(STATE.score >= 3000 && STATE.hydration >= 70 && STATE.bossDefeated) return 'Diamond';
    if(STATE.score >= 2000 && STATE.hydration >= 55) return 'Gold';
    if(STATE.score >= 1200 && STATE.hydration >= 35) return 'Silver';
    return 'Bronze';
  }

  function stars(){
    var s = 1;
    if(STATE.score >= 1200) s++;
    if(STATE.hydration >= 60 || STATE.bossDefeated) s++;
    return '⭐'.repeat(s) + '☆'.repeat(3 - s);
  }

  function lessonText(){
    if(STATE.hydration < 35) return 'เมื่ออากาศร้อนหรือเสียเหงื่อ ต้องเติมน้ำให้เพียงพอ';
    if(STATE.badHits >= 5) return 'น้ำหวาน/ของเค็มทำให้กระหายน้ำและเสียสมดุลได้ง่าย';
    if(STATE.bossDefeated) return 'เลือกน้ำเปล่าได้ดีมาก เป็นตัวเลือกหลักของร่างกาย';
    return 'ดื่มน้ำให้พอดีและเลือกเครื่องดื่มที่เหมาะกับร่างกาย';
  }

  function saveSummary(){
    try{
      var data = {
        game:'hydration',
        mode:'solo',
        view:STATE.ctx.view,
        score:Math.round(STATE.score),
        hydration:Math.round(STATE.hydration),
        combo:STATE.maxCombo,
        missions:STATE.missions,
        bossDefeated:STATE.bossDefeated,
        rank:rank(),
        endedAt:new Date().toISOString(),
        version:VERSION
      };

      localStorage.setItem('HHA_LAST_SUMMARY_HYDRATION', JSON.stringify(data));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(data));
    }catch(e){}
  }

  function endGame(){
    if(STATE.ended) return;

    STATE.ended = true;
    STATE.started = false;
    STATE.endAt = Date.now();

    clearInterval(STATE.timerId);
    clearInterval(STATE.spawnId);
    clearInterval(STATE.decayId);

    activeTargets().forEach(function(t){
      try{ t.remove(); }catch(e){}
    });

    saveSummary();

    window.HHA.Hydration.started = false;
    window.HHA.Hydration.booted = true;

    var summary = document.createElement('div');
    summary.className = 'hha-solo-summary hha-hydration-summary';
    summary.id = 'hha-hydration-summary';
    summary.dataset.hhaSummary = '1';

    summary.innerHTML = `
      <div class="hha-solo-summary-card">
        <div style="text-align:center;font-weight:1000;color:#85631b;background:#fff4c5;border-radius:999px;padding:10px 16px;width:max-content;max-width:100%;margin:0 auto 12px;">
          ภารกิจเติมน้ำสำเร็จ!
        </div>

        <div class="hha-solo-rank">${esc(rank())} 💧</div>
        <div class="hha-solo-stars">${stars()}</div>

        <div class="hha-solo-bigscore">
          ${Math.round(STATE.score)}
          <small>คะแนนรวม</small>
        </div>

        <div class="hha-solo-grid">
          <div class="hha-solo-stat"><b>${Math.round(STATE.hydration)}%</b><small>Hydration</small></div>
          <div class="hha-solo-stat"><b>${STATE.maxCombo}</b><small>Combo สูงสุด</small></div>
          <div class="hha-solo-stat"><b>${STATE.missions}</b><small>Mission สำเร็จ</small></div>
          <div class="hha-solo-stat"><b>${STATE.bossDefeated ? 'ชนะ' : 'ยังไม่ชนะ'}</b><small>Heat Boss</small></div>
        </div>

        <div class="hha-solo-lesson">
          <div style="font-size:36px">💧</div>
          <div>
            <b>บทเรียนรอบนี้</b><br>
            ${esc(lessonText())}
          </div>
        </div>

        <div class="hha-solo-grid">
          <div class="hha-solo-stat"><b>${STATE.goodHits}</b><small>เก็บของดี</small></div>
          <div class="hha-solo-stat"><b>${STATE.badHits}</b><small>โดนของเสีย</small></div>
          <div class="hha-solo-stat"><b>${STATE.misses}</b><small>พลาด</small></div>
          <div class="hha-solo-stat"><b>${STATE.ctx.view}</b><small>View</small></div>
        </div>

        <div class="hha-solo-actions">
          <button type="button" class="primary" id="hha-solo-replay">เล่นอีกครั้ง</button>
          <button type="button" class="green" id="hha-solo-new">Challenge ใหม่</button>
          <button type="button" class="white" id="hha-solo-cooldown">ทำ Cooldown</button>
          <button type="button" class="white" id="hha-solo-zone">กลับ Nutrition Zone</button>
        </div>
      </div>
    `;

    document.body.appendChild(summary);

    $('#hha-solo-replay').addEventListener('click', restartHydrationSameChallenge);
    $('#hha-solo-new').addEventListener('click', restartHydrationNewSeed);
    $('#hha-solo-cooldown').addEventListener('click', goHydrationCooldownThenHub);
    $('#hha-solo-zone').addEventListener('click', goHydrationBackHub);

    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';

    console.info('[Hydration Solo Pack37] summary shown');
  }

  function restartHydrationSameChallenge(){
    var u = getUrl();
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('view', STATE.ctx.view);
    u.searchParams.set('run', 'play');
    u.searchParams.set('hub', nutritionZoneUrl());
    location.href = u.toString();
  }

  function restartHydrationNewSeed(){
    var u = getUrl();
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('view', STATE.ctx.view);
    u.searchParams.set('run', 'play');
    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.set('hub', nutritionZoneUrl());
    location.href = u.toString();
  }

  function goHydrationCooldownThenHub(){
    location.href = cooldownGateUrl();
  }

  function goHydrationBackHub(){
    location.href = nutritionZoneUrl();
  }

  function answerHydrationQuickCheck(){
    return true;
  }

  function boot(){
    injectStyle();

    STATE.ctx = getCtx();
    STATE.rng = mulberry32(hashSeed(STATE.ctx.seed + '-' + STATE.ctx.view + '-' + STATE.ctx.diff));

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    var pf = playfield();
    if(!pf){
      console.error('[Hydration Solo Pack37] missing playfield');
      return;
    }

    renderStart();

    window.beginHydrationFromOverlay = beginHydrationFromOverlay;
    window.toggleHydrationPause = toggleHydrationPause;
    window.resumeHydrationGame = resumeHydrationGame;
    window.goHydrationBackHub = goHydrationBackHub;
    window.goHydrationCooldownThenHub = goHydrationCooldownThenHub;
    window.restartHydrationSameChallenge = restartHydrationSameChallenge;
    window.restartHydrationNewSeed = restartHydrationNewSeed;
    window.answerHydrationQuickCheck = answerHydrationQuickCheck;

    window.HHA_HYDRATION_FORCE_START = function(){
      return beginHydrationFromOverlay();
    };

    window.HHA.Hydration.booted = true;
    window.HHA.Hydration.started = false;
    window.HHA.Hydration.destroyed = false;

    console.info('[Hydration Solo Pack37] clean solo core booted', VERSION);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
