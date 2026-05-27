/* =========================================================
   HeroHealth Hydration Solo Player Assist / Hydro Coach Patch
   File: /herohealth/hydration-vr/hydration-solo-assist-pack46.patch.js
   Version: v20260527-pack46-player-assist-hydro-coach

   Purpose:
   - Add fair player assistance for Hydration Solo
   - Help beginners without making the game too easy
   - Designed to load AFTER:
       1) hydration-solo-core.js
       2) hydration-solo-effects-pack41.patch.js
       3) hydration-solo-boss-pack42.patch.js
       4) hydration-solo-balance-pack43.patch.js
       5) hydration-solo-sfx-pack44.patch.js
       6) hydration-solo-cvr-pack45.patch.js
   - Does NOT depend on old hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var VERSION = 'v20260527-pack46-player-assist-hydro-coach';

  if(window.HHA_HYDRATION_SOLO_ASSIST_PACK46){
    console.warn('[Hydration Solo Assist Pack46] already loaded');
    return;
  }

  window.HHA_HYDRATION_SOLO_ASSIST_PACK46 = true;

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

  function readNumber(sel, fallback){
    var el = q(sel);
    if(!el) return fallback;
    var raw = String(el.textContent || '').replace(/[^0-9.-]/g,'');
    var n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function currentView(){
    var ctx = window.HHA_HYDRATION_RUN_CONTEXT || {};
    return String(ctx.view || document.body.dataset.view || 'mobile').toLowerCase();
  }

  function currentDiff(){
    var ctx = window.HHA_HYDRATION_RUN_CONTEXT || {};
    return String(ctx.diff || 'normal').toLowerCase();
  }

  function isChallenge(){
    return currentDiff() === 'challenge';
  }

  function now(){ return Date.now(); }

  function readHud(){
    return {
      hydration:readNumber('#hha-solo-hydration', 60),
      score:readNumber('#hha-solo-score', 0),
      combo:readNumber('#hha-solo-combo', 0),
      shield:readNumber('#hha-solo-shield', 0),
      fever:readNumber('#hha-solo-fever', 0),
      time:readNumber('#hha-solo-time', 0),
      hasHud:!!q('.hha-solo-hud'),
      hasSummary:!!q('.hha-solo-summary'),
      hasStart:!!q('.hha-solo-start')
    };
  }

  var assist = {
    coachUsed:0,
    emergencyUsed:0,
    shieldUsed:0,
    aimUsed:0,
    maxCoach:3,
    maxEmergency:2,
    maxShield:1,
    lastCoachAt:0,
    lastEmergencyAt:0,
    lastAimAt:0,
    lastHint:'',
    enabled:true,
    started:false
  };

  function limits(){
    var diff = currentDiff();
    var view = currentView();

    assist.maxCoach = diff === 'easy' ? 5 : diff === 'normal' ? 4 : diff === 'hard' ? 3 : 1;
    assist.maxEmergency = diff === 'easy' ? 3 : diff === 'normal' ? 2 : diff === 'hard' ? 1 : 0;
    assist.maxShield = diff === 'easy' ? 2 : diff === 'normal' ? 1 : diff === 'hard' ? 1 : 0;

    if(view === 'cvr'){
      assist.maxCoach += 1;
      assist.maxEmergency += diff === 'challenge' ? 0 : 1;
    }
  }

  function injectStyle(){
    if(q('#hha-hydration-solo-assist-pack46-css')) return;

    var style = document.createElement('style');
    style.id = 'hha-hydration-solo-assist-pack46-css';
    style.textContent = `
      .hha-assist46-coach{
        position:fixed;
        left:50%;
        top:calc(280px + env(safe-area-inset-top,0px));
        z-index:16020;
        transform:translateX(-50%) translateY(8px);
        width:min(460px,86vw);
        display:grid;
        grid-template-columns:52px 1fr auto;
        align-items:center;
        gap:10px;
        padding:12px 14px;
        border-radius:26px;
        background:rgba(255,255,255,.96);
        border:3px solid #d7f3ff;
        box-shadow:0 18px 46px rgba(30,75,115,.18);
        color:#24445c;
        pointer-events:none;
        opacity:0;
        transition:.22s ease;
      }

      .hha-assist46-coach.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }

      .hha-assist46-face{
        width:48px;
        height:48px;
        display:grid;
        place-items:center;
        border-radius:18px;
        background:linear-gradient(180deg,#eaffff,#d5f5ff);
        font-size:28px;
      }

      .hha-assist46-text b{
        display:block;
        font-size:15px;
        line-height:1.15;
        font-weight:1000;
      }

      .hha-assist46-text small{
        display:block;
        margin-top:3px;
        color:#66879c;
        font-size:12px;
        font-weight:900;
        line-height:1.18;
      }

      .hha-assist46-count{
        padding:5px 8px;
        border-radius:999px;
        background:#fff4c5;
        color:#85631b;
        font-size:11px;
        font-weight:1000;
        white-space:nowrap;
      }

      .hha-assist46-panel{
        position:fixed;
        left:12px;
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        z-index:14002;
        display:flex;
        align-items:center;
        gap:8px;
        padding:8px 10px;
        border-radius:999px;
        background:rgba(255,255,255,.92);
        border:2px solid #d7f3ff;
        box-shadow:0 12px 30px rgba(30,75,115,.14);
        color:#24445c;
        font-weight:1000;
        pointer-events:none;
      }

      .hha-assist46-panel span{
        font-size:18px;
      }

      .hha-assist46-panel small{
        color:#66879c;
        font-size:11px;
      }

      .hha-assist46-glow{
        box-shadow:
          0 18px 42px rgba(30,75,115,.22),
          0 0 0 7px rgba(116,220,255,.20),
          0 0 34px rgba(116,220,255,.34) !important;
        transform:scale(1.05) !important;
      }

      .hha-assist46-safe{
        border-color:#74dcff !important;
        background:rgba(245,253,255,.98) !important;
      }

      .hha-assist46-safe .icon{
        filter:drop-shadow(0 6px 10px rgba(67,199,255,.28));
      }

      .hha-assist46-aim-note{
        position:fixed;
        left:50%;
        top:calc(50% + 46px);
        z-index:21010;
        transform:translateX(-50%);
        padding:7px 11px;
        border-radius:999px;
        background:rgba(255,255,255,.93);
        border:2px solid #b9efc5;
        color:#24445c;
        font-weight:1000;
        font-size:12px;
        pointer-events:none;
        opacity:0;
        transition:.18s ease;
      }

      .hha-assist46-aim-note.show{
        opacity:1;
        transform:translateX(-50%) translateY(-3px);
      }

      body.hha-view-cvr .hha-assist46-coach{
        top:calc(268px + env(safe-area-inset-top,0px));
        width:min(430px,80vw);
      }

      @media (max-width:520px){
        .hha-assist46-coach{
          top:calc(286px + env(safe-area-inset-top,0px));
          width:min(330px,88vw);
          grid-template-columns:42px 1fr;
          padding:10px 12px;
          border-radius:22px;
        }

        .hha-assist46-face{
          width:40px;
          height:40px;
          border-radius:15px;
          font-size:24px;
        }

        .hha-assist46-count{
          grid-column:1 / -1;
          justify-self:center;
          margin-top:-2px;
          font-size:10px;
        }

        .hha-assist46-text b{font-size:13px}
        .hha-assist46-text small{font-size:11px}

        .hha-assist46-panel{
          left:8px;
          bottom:calc(8px + env(safe-area-inset-bottom,0px));
          padding:7px 9px;
        }

        .hha-assist46-panel small{font-size:10px}
      }
    `;

    document.head.appendChild(style);
  }

  function ensureCoach(){
    var coach = q('.hha-assist46-coach');
    if(coach) return coach;

    coach = document.createElement('div');
    coach.className = 'hha-assist46-coach';
    coach.innerHTML = `
      <div class="hha-assist46-face">💧</div>
      <div class="hha-assist46-text"><b>Hydro Coach</b><small>พร้อมช่วยแนะนำระหว่างเล่น</small></div>
      <div class="hha-assist46-count">Assist 0/0</div>
    `;
    document.body.appendChild(coach);
    return coach;
  }

  function ensurePanel(){
    var panel = q('.hha-assist46-panel');
    if(panel) return panel;

    panel = document.createElement('div');
    panel.className = 'hha-assist46-panel';
    panel.innerHTML = '<span>💧</span><small>Coach ready</small>';
    document.body.appendChild(panel);
    return panel;
  }

  function ensureAimNote(){
    var n = q('.hha-assist46-aim-note');
    if(n) return n;

    n = document.createElement('div');
    n.className = 'hha-assist46-aim-note';
    n.textContent = 'ใกล้เป้าแล้ว แตะเพื่อเก็บ!';
    document.body.appendChild(n);
    return n;
  }

  function showCoach(title, sub, force){
    limits();

    var timeOk = now() - assist.lastCoachAt > 3600;
    if(!force && !timeOk) return;
    if(!force && assist.coachUsed >= assist.maxCoach) return;

    assist.lastCoachAt = now();
    assist.coachUsed += force ? 0 : 1;

    var coach = ensureCoach();
    var count = q('.hha-assist46-count', coach);
    coach.innerHTML = `
      <div class="hha-assist46-face">💧</div>
      <div class="hha-assist46-text"><b>${esc(title || 'Hydro Coach')}</b><small>${esc(sub || '')}</small></div>
      <div class="hha-assist46-count">Coach ${assist.coachUsed}/${assist.maxCoach}</div>
    `;

    coach.classList.add('show');
    clearTimeout(coach._timer);
    coach._timer = setTimeout(function(){
      coach.classList.remove('show');
    }, 2600);

    if(count) count.textContent = 'Coach ' + assist.coachUsed + '/' + assist.maxCoach;
  }

  function updatePanel(h){
    limits();
    var panel = ensurePanel();
    var left = Math.max(0, assist.maxCoach - assist.coachUsed);
    var emergency = Math.max(0, assist.maxEmergency - assist.emergencyUsed);
    panel.innerHTML = '<span>💧</span><small>Coach ' + left + ' • Rescue ' + emergency + '</small>';
    panel.style.display = h.hasHud && !h.hasSummary ? 'flex' : 'none';
  }

  function viewport(){
    return {
      w: window.innerWidth || document.documentElement.clientWidth || 390,
      h: window.innerHeight || document.documentElement.clientHeight || 800
    };
  }

  function moveGoodTargetCloser(h){
    if(assist.emergencyUsed >= assist.maxEmergency) return false;
    if(now() - assist.lastEmergencyAt < 7000) return false;

    var goods = qa('.hha-solo-target, .hha-hydration-target').filter(function(t){
      return t && t.isConnected && t.dataset.good === '1' && t.dataset.hha46Moved !== '1';
    });

    if(!goods.length) return false;

    var target = goods[0];
    var v = viewport();
    var view = currentView();

    target.dataset.hha46Moved = '1';
    target.classList.add('hha-assist46-glow');

    if(view === 'cvr'){
      target.style.left = Math.round(v.w / 2 - 42) + 'px';
      target.style.top = Math.round(v.h / 2 - 128) + 'px';
    }else if(view === 'mobile'){
      target.style.left = Math.round(v.w * 0.50 - 34) + 'px';
      target.style.top = Math.round(v.h * 0.54) + 'px';
    }else{
      target.style.left = Math.round(v.w * 0.48) + 'px';
      target.style.top = Math.round(v.h * 0.42) + 'px';
    }

    assist.emergencyUsed += 1;
    assist.lastEmergencyAt = now();

    showCoach('Emergency Water!', 'Hydration ต่ำ ระบบดันน้ำดีมาใกล้ขึ้น 1 ครั้ง', true);
    return true;
  }

  function convertBadToSafe(t){
    limits();
    if(!t || !t.isConnected) return false;
    if(t.dataset.good !== '0') return false;
    if(assist.shieldUsed >= assist.maxShield) return false;
    if(isChallenge()) return false;

    t.dataset.good = '1';
    t.dataset.score = '35';
    t.dataset.hydrate = '6';
    t.dataset.shield = '1';
    t.dataset.hha46Safe = '1';
    t.classList.remove('bad','is-bad','hha-balance43-converted');
    t.classList.add('good','is-good','shield','hha-assist46-safe','hha-assist46-glow');
    t.innerHTML = '<span><span class="icon">🧊</span><span class="title">Coach Shield</span><span class="sub">ช่วยกัน 1 ครั้ง</span></span>';

    assist.shieldUsed += 1;
    showCoach('Coach Shield!', 'ครั้งนี้เปลี่ยนของเสียเป็น Shield เพื่อช่วยผู้เล่นใหม่', true);
    return true;
  }

  function maybeShieldAssist(ev){
    try{
      var h = readHud();
      if(!h.hasHud || h.hasSummary) return;
      if(h.hydration > 42 && h.combo > 5) return;
      if(!ev || !ev.target || !ev.target.closest) return;

      var t = ev.target.closest('.hha-solo-target, .hha-hydration-target');
      if(!t) return;
      convertBadToSafe(t);
    }catch(e){}
  }

  function centerTarget(){
    var v = viewport();
    var cx = v.w / 2;
    var cy = v.h / 2;
    var best = null;
    var bestD = Infinity;

    qa('.hha-solo-target, .hha-hydration-target').forEach(function(t){
      if(!t || !t.isConnected) return;
      var r = t.getBoundingClientRect();
      if(r.width <= 0 || r.height <= 0) return;
      var tx = r.left + r.width / 2;
      var ty = r.top + r.height / 2;
      var d = Math.hypot(tx - cx, ty - cy);
      if(d < bestD){
        best = t;
        bestD = d;
      }
    });

    return { target:best, distance:bestD };
  }

  function aimAssist(h){
    var view = currentView();
    var note = ensureAimNote();

    if(!(view === 'mobile' || view === 'cvr') || !h.hasHud || h.hasSummary){
      note.classList.remove('show');
      return;
    }

    var hit = centerTarget();
    if(!hit.target || !Number.isFinite(hit.distance)){
      note.classList.remove('show');
      return;
    }

    var limit = view === 'cvr' ? 110 : 84;
    if(hit.distance <= limit && hit.target.dataset.good === '1'){
      note.classList.add('show');
      hit.target.classList.add('hha-assist46-glow');
      if(now() - assist.lastAimAt > 5000){
        assist.lastAimAt = now();
        assist.aimUsed += 1;
        showCoach('Aim Assist', 'เป้าอยู่ใกล้แล้ว แตะเพื่อเก็บน้ำดี', false);
      }
    }else{
      note.classList.remove('show');
    }
  }

  function coachLogic(h){
    if(!h.hasHud || h.hasSummary) return;

    if(h.hydration <= 30){
      showCoach('Hydration ต่ำแล้ว!', 'มองหา 💧 น้ำเปล่า / 🍉 แตงโม / 🥒 แตงกวาก่อนนะ', false);
      moveGoodTargetCloser(h);
      return;
    }

    if(h.hydration <= 45 && h.combo <= 3){
      showCoach('เริ่มใหม่ได้!', 'เก็บน้ำดี 2–3 ชิ้นติดกันเพื่อฟื้น Hydration', false);
      return;
    }

    if(h.combo >= 10 && h.combo % 10 === 0){
      showCoach('คอมโบดีมาก!', 'รักษาจังหวะต่อ แต่อย่าเผลอแตะน้ำหวานหรือแดดแรง', false);
      return;
    }

    if(h.fever >= 80){
      showCoach('ใกล้ Fever แล้ว!', 'เก็บน้ำดีต่ออีกนิดเพื่อระเบิดคะแนน', false);
    }
  }

  function bindEvents(){
    document.addEventListener('pointerdown', maybeShieldAssist, { capture:true, passive:true });
    document.addEventListener('touchstart', maybeShieldAssist, { capture:true, passive:true });
    document.addEventListener('mousedown', maybeShieldAssist, { capture:true, passive:true });
  }

  function loop(){
    setInterval(function(){
      try{
        var h = readHud();
        updatePanel(h);
        coachLogic(h);
        aimAssist(h);
      }catch(e){}
    }, 420);
  }

  function boot(){
    limits();
    injectStyle();
    ensureCoach();
    ensurePanel();
    ensureAimNote();
    bindEvents();
    loop();

    console.info('[Hydration Solo Assist Pack46] loaded', VERSION, {
      view:currentView(),
      diff:currentDiff(),
      maxCoach:assist.maxCoach,
      maxEmergency:assist.maxEmergency,
      maxShield:assist.maxShield
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
