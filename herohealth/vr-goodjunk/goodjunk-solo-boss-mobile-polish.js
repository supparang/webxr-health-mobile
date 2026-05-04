// === /herohealth/vr-goodjunk/goodjunk-solo-boss-mobile-polish.js ===
// GoodJunk Solo Boss Mobile / Touch Polish
// PATCH v8.41.2-MOBILE-TOUCH-POLISH
// ✅ larger touch target on mobile
// ✅ safer HUD / back button spacing
// ✅ mobile/cVR spawn rhythm tuning
// ✅ food overlap soft guard
// ✅ Cardboard/cVR center-shoot helper via hha:shoot
// ✅ touch feedback hints
// ✅ works with v8.40.x + v8.41.0 main + v8.41.1 shell
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.41.2-MOBILE-TOUCH-POLISH';

  const VIEW = String(QS.get('view') || '').toLowerCase();
  const DEBUG = QS.get('debugBoss') === '1';

  const IS_COARSE = (() => {
    try{ return WIN.matchMedia && WIN.matchMedia('(pointer: coarse)').matches; }
    catch(e){ return false; }
  })();

  const IS_SMALL = Math.min(WIN.innerWidth || 999, WIN.innerHeight || 999) <= 760;
  const IS_MOBILE = VIEW === 'mobile' || IS_COARSE || IS_SMALL;
  const IS_CVR = /cvr|cardboard|vr-cardboard|cardboard-vr/i.test(VIEW);

  const PROFILE = IS_CVR ? {
    name:'cvr',
    foodW:82,
    foodMinH:92,
    icon:42,
    label:11,
    spawnMul:1.08,
    speedMul:0.88,
    lowLifeSpawnMul:1.18,
    lowLifeSpeedMul:0.88,
    minDelay:680,
    maxDelay:1750,
    aimRadius:104,
    hitPad:16
  } : IS_MOBILE ? {
    name:'mobile',
    foodW:74,
    foodMinH:84,
    icon:38,
    label:11,
    spawnMul:0.98,
    speedMul:0.94,
    lowLifeSpawnMul:1.12,
    lowLifeSpeedMul:0.90,
    minDelay:560,
    maxDelay:1550,
    aimRadius:78,
    hitPad:14
  } : {
    name:'desktop',
    foodW:76,
    foodMinH:86,
    icon:38,
    label:11,
    spawnMul:0.94,
    speedMul:0.98,
    lowLifeSpawnMul:1.06,
    lowLifeSpeedMul:0.94,
    minDelay:480,
    maxDelay:1450,
    aimRadius:70,
    hitPad:10
  };

  const state = {
    patched:false,
    observer:null,
    lastLefts:[],
    hintTimer:null,
    debugBox:null,
    shootBound:false,
    lastShootAt:0
  };

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch]));
  }

  function getMainState(){
    try{
      return WIN.GJSBM?.getState?.() || WIN.GoodJunkSoloBossMain?.getState?.() || {};
    }catch(e){
      return {};
    }
  }

  function lifeMul(kind){
    const s = getMainState();
    const lives = n(s.lives, 3);

    if(lives <= 1){
      return kind === 'speed' ? PROFILE.lowLifeSpeedMul : PROFILE.lowLifeSpawnMul;
    }

    return 1;
  }

  function ensureStyle(){
    if(DOC.getElementById('gjMobilePolishStyle')) return;

    const css = DOC.createElement('style');
    css.id = 'gjMobilePolishStyle';
    css.textContent = `
      html.gjmp-touch,
      html.gjmp-touch body{
        touch-action:manipulation;
        overscroll-behavior:none;
      }

      html.gjmp-touch .gjm-food{
        width:${PROFILE.foodW}px !important;
        min-height:${PROFILE.foodMinH}px !important;
        border-radius:${Math.round(PROFILE.foodW * 0.32)}px !important;
        padding:9px 6px !important;
        touch-action:manipulation;
        will-change:transform, opacity;
      }

      html.gjmp-touch .gjm-food::after{
        content:"";
        position:absolute;
        inset:-${PROFILE.hitPad}px;
        border-radius:${Math.round(PROFILE.foodW * 0.42)}px;
      }

      html.gjmp-touch .gjm-food b{
        font-size:${PROFILE.icon}px !important;
      }

      html.gjmp-touch .gjm-food span{
        font-size:${PROFILE.label}px !important;
        line-height:1.08 !important;
        max-width:${PROFILE.foodW - 10}px !important;
      }

      html.gjmp-touch .gjm-hud{
        pointer-events:none;
      }

      html.gjmp-touch .shell-back{
        z-index:100040;
      }

      html.gjmp-mobile .gjm-start-card{
        max-height:calc(100dvh - 28px);
        overflow:auto;
      }

      html.gjmp-mobile .gjm-message{
        top:56%;
      }

      html.gjmp-mobile .gjd-card{
        bottom:calc(8px + env(safe-area-inset-bottom)) !important;
      }

      html.gjmp-mobile .gjj-mute{
        bottom:calc(86px + env(safe-area-inset-bottom)) !important;
      }

      html.gjmp-mobile .gjdir-pressure{
        bottom:calc(94px + env(safe-area-inset-bottom)) !important;
      }

      html.gjmp-mobile .gjdir-coach{
        bottom:calc(94px + env(safe-area-inset-bottom)) !important;
      }

      html.gjmp-cvr .gjm-food{
        filter:drop-shadow(0 0 10px rgba(255,255,255,.35));
      }

      html.gjmp-cvr .gjdir-coach{
        left:50% !important;
        bottom:calc(138px + env(safe-area-inset-bottom)) !important;
        transform:translateX(-50%) translateY(12px) scale(.96) !important;
        width:min(390px, calc(100vw - 30px)) !important;
      }

      html.gjmp-cvr .gjdir-coach.show{
        transform:translateX(-50%) translateY(0) scale(1) !important;
      }

      .gjmp-hint{
        position:fixed;
        left:50%;
        bottom:calc(156px + env(safe-area-inset-bottom));
        transform:translateX(-50%) translateY(10px) scale(.96);
        z-index:100055;
        width:min(420px, calc(100vw - 28px));
        border-radius:999px;
        padding:10px 14px;
        background:rgba(15,23,42,.82);
        color:#fff;
        border:2px solid rgba(255,255,255,.78);
        box-shadow:0 14px 34px rgba(15,23,42,.25);
        text-align:center;
        font-size:13px;
        font-weight:900;
        line-height:1.25;
        pointer-events:none;
        opacity:0;
        transition:opacity .18s ease, transform .18s ease;
        backdrop-filter:blur(8px);
      }

      .gjmp-hint.show{
        opacity:1;
        transform:translateX(-50%) translateY(0) scale(1);
      }

      .gjmp-aim-flash{
        position:fixed;
        left:50%;
        top:50%;
        z-index:100050;
        width:${IS_CVR ? 86 : 68}px;
        height:${IS_CVR ? 86 : 68}px;
        border-radius:999px;
        border:4px solid rgba(255,255,255,.95);
        box-shadow:0 0 0 8px rgba(34,197,94,.22),0 0 24px rgba(34,197,94,.35);
        transform:translate(-50%,-50%) scale(.4);
        opacity:0;
        pointer-events:none;
        animation:gjmpAim .34s ease forwards;
      }

      .gjmp-food-polished{
        backface-visibility:hidden;
      }

      .gjmp-food-polished[data-food-type="good"]{
        box-shadow:
          0 16px 30px rgba(15,23,42,.18),
          0 0 0 2px rgba(34,197,94,.14),
          inset 0 -5px 0 rgba(15,23,42,.06) !important;
      }

      .gjmp-food-polished[data-food-type="fake"]{
        box-shadow:
          0 16px 30px rgba(15,23,42,.18),
          0 0 0 2px rgba(250,204,21,.22),
          inset 0 -5px 0 rgba(15,23,42,.06) !important;
      }

      .gjmp-food-polished[data-food-type="junk"]{
        box-shadow:
          0 16px 30px rgba(15,23,42,.18),
          0 0 0 2px rgba(249,115,22,.20),
          inset 0 -5px 0 rgba(15,23,42,.06) !important;
      }

      .gjmp-debug{
        position:fixed;
        right:10px;
        bottom:calc(10px + env(safe-area-inset-bottom));
        z-index:100100;
        width:min(280px, calc(100vw - 20px));
        border-radius:16px;
        padding:10px;
        background:rgba(15,23,42,.86);
        color:#e5e7eb;
        font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        font-size:11px;
        line-height:1.35;
        white-space:pre-wrap;
        pointer-events:none;
      }

      @keyframes gjmpAim{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.35); }
        35%{ opacity:1; transform:translate(-50%,-50%) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(1.35); }
      }

      @media (max-width:420px){
        html.gjmp-touch .gjm-food{
          width:${Math.max(68, PROFILE.foodW - 4)}px !important;
          min-height:${Math.max(78, PROFILE.foodMinH - 4)}px !important;
        }

        html.gjmp-touch .gjm-food b{
          font-size:${Math.max(34, PROFILE.icon - 3)}px !important;
        }

        .gjmp-hint{
          bottom:calc(142px + env(safe-area-inset-bottom));
          font-size:12px;
        }
      }
    `;

    DOC.head.appendChild(css);

    DOC.documentElement.classList.add('gjmp-touch');
    if(IS_MOBILE) DOC.documentElement.classList.add('gjmp-mobile');
    if(IS_CVR) DOC.documentElement.classList.add('gjmp-cvr');
  }

  function waitForShim(cb, tries){
    tries = tries || 0;

    const shim = WIN.GJBS || WIN.GoodJunkSoloBossShim;
    if(shim || tries >= 80){
      cb(shim || null);
      return;
    }

    setTimeout(() => waitForShim(cb, tries + 1), 100);
  }

  function patchShim(shim){
    if(!shim || shim.__gjMobilePolishPatched) return;

    const originalDelay = typeof shim.getSpawnDelay === 'function'
      ? shim.getSpawnDelay.bind(shim)
      : null;

    const originalSpeed = typeof shim.getItemSpeed === 'function'
      ? shim.getItemSpeed.bind(shim)
      : null;

    shim.getSpawnDelay = function(baseDelay){
      const raw = originalDelay ? originalDelay(baseDelay) : n(baseDelay, 1000);
      const tuned = raw * PROFILE.spawnMul * lifeMul('delay');
      return clamp(tuned, PROFILE.minDelay, PROFILE.maxDelay);
    };

    shim.getItemSpeed = function(baseSpeed){
      const raw = originalSpeed ? originalSpeed(baseSpeed) : n(baseSpeed, 1);
      const tuned = raw * PROFILE.speedMul * lifeMul('speed');
      return clamp(tuned, 0.55, 1.9);
    };

    shim.__gjMobilePolishPatched = true;

    WIN.dispatchEvent(new CustomEvent('gj:mobile-polish-patched', {
      detail:{
        patch:PATCH,
        profile:PROFILE.name,
        isMobile:IS_MOBILE,
        isCVR:IS_CVR
      }
    }));

    renderDebug();
  }

  function getFoodNodes(){
    return Array.from(DOC.querySelectorAll('.gjm-food,.goodjunk-food,.food-target,[data-food-type]'));
  }

  function polishFood(el){
    if(!el || el.dataset.gjmpPolished === '1') return;

    el.dataset.gjmpPolished = '1';
    el.classList.add('gjmp-food-polished');

    const type = el.dataset.foodType || el.dataset.type || 'good';
    const name = el.dataset.foodName || el.textContent || 'อาหาร';

    if(!el.getAttribute('aria-label')){
      el.setAttribute('aria-label', `${type}: ${name}`);
    }

    avoidOverlap(el);
  }

  function avoidOverlap(el){
    if(!el || !el.style) return;

    const left = parseFloat(el.style.left);
    if(!Number.isFinite(left)) return;

    const t = performance.now();

    state.lastLefts = state.lastLefts.filter(x => t - x.t < 850);

    const close = state.lastLefts.find(x => Math.abs(x.left - left) < 11);

    if(close){
      const dir = left < 50 ? 1 : -1;
      const shifted = clamp(left + dir * (12 + Math.random() * 7), 6, 84);
      el.style.left = `${shifted}%`;
      state.lastLefts.push({ left:shifted, t });
    }else{
      state.lastLefts.push({ left, t });
    }
  }

  function polishAllFoods(){
    getFoodNodes().forEach(polishFood);
  }

  function observeFoods(){
    if(state.observer) return;

    state.observer = new MutationObserver(mutations => {
      let should = false;

      for(const m of mutations){
        if(m.addedNodes && m.addedNodes.length){
          should = true;
          break;
        }
      }

      if(should){
        setTimeout(polishAllFoods, 20);
      }
    });

    state.observer.observe(DOC.body || DOC.documentElement, {
      childList:true,
      subtree:true
    });
  }

  function showHint(text, ms){
    ensureStyle();

    let el = DOC.getElementById('gjmpHint');
    if(!el){
      el = DOC.createElement('div');
      el.id = 'gjmpHint';
      el.className = 'gjmp-hint';
      DOC.body.appendChild(el);
    }

    el.textContent = text;
    el.classList.add('show');

    clearTimeout(state.hintTimer);
    state.hintTimer = setTimeout(() => {
      el.classList.remove('show');
    }, ms || 2200);
  }

  function aimFlash(){
    const el = DOC.createElement('div');
    el.className = 'gjmp-aim-flash';
    DOC.body.appendChild(el);
    setTimeout(() => el.remove(), 380);
  }

  function findCenterTarget(){
    const cx = WIN.innerWidth / 2;
    const cy = WIN.innerHeight / 2;

    let best = null;
    let bestScore = Infinity;

    getFoodNodes().forEach(el => {
      if(!el || el.dataset.consumed === '1' || el.dataset.gjConsumed === '1') return;

      const r = el.getBoundingClientRect();
      if(!r.width || !r.height) return;

      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;

      const dx = ex - cx;
      const dy = ey - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const radius = Math.max(PROFILE.aimRadius, Math.max(r.width, r.height) * 0.88);

      if(dist <= radius && dist < bestScore){
        best = el;
        bestScore = dist;
      }
    });

    return best;
  }

  function bindCVRShoot(){
    if(!IS_CVR || state.shootBound) return;

    state.shootBound = true;

    WIN.addEventListener('hha:shoot', function(){
      const t = performance.now();
      if(t - state.lastShootAt < 180) return;
      state.lastShootAt = t;

      const target = findCenterTarget();
      aimFlash();

      if(target){
        target.click();
      }else{
        showHint('เล็งอาหารให้อยู่กลางจอ แล้วแตะเพื่อเลือก', 900);
      }
    });
  }

  function bindStartHints(){
    WIN.addEventListener('gj:solo-boss-start', function(){
      if(IS_CVR){
        showHint('โหมด Cardboard: เล็งอาหารไว้กลางจอ แล้วแตะเพื่อยิง/เลือก', 2600);
      }else if(IS_MOBILE){
        showHint('แตะอาหารดีให้ทัน ระวัง junk และอาหารหลอกตา!', 2200);
      }
    });

    WIN.addEventListener('gj:director-fair-help', function(e){
      const d = e.detail || {};
      if(d.assist){
        showHint('โค้ชช่วยลดความเร็วให้นิดหนึ่ง ตั้งใจเลือกอาหารดีทีละชิ้น', 2200);
      }
    });

    WIN.addEventListener('gj:boss-frenzy', function(){
      showHint('บอสใกล้แพ้แล้ว! เก็บอาหารดีต่อเนื่องเพื่อปิดฉาก', 2100);
    });
  }

  function renderDebug(){
    if(!DEBUG) return;

    ensureStyle();

    let box = DOC.getElementById('gjmpDebug');
    if(!box){
      box = DOC.createElement('pre');
      box.id = 'gjmpDebug';
      box.className = 'gjmp-debug';
      DOC.body.appendChild(box);
    }

    const s = getMainState();
    const shim = WIN.GJBS || WIN.GoodJunkSoloBossShim;

    box.textContent =
`GoodJunk Mobile Polish
${PATCH}

profile: ${PROFILE.name}
mobile: ${IS_MOBILE}
cVR: ${IS_CVR}
shimPatched: ${Boolean(shim && shim.__gjMobilePolishPatched)}

foodW: ${PROFILE.foodW}
spawnMul: ${PROFILE.spawnMul}
speedMul: ${PROFILE.speedMul}

lives: ${s.lives ?? '-'}
timeLeft: ${Math.ceil(n(s.timeLeft, 0))}
activeFoods: ${getFoodNodes().length}`;
  }

  function boot(){
    ensureStyle();

    waitForShim(patchShim);

    polishAllFoods();
    observeFoods();
    bindCVRShoot();
    bindStartHints();

    setInterval(() => {
      waitForShim(patchShim);
      polishAllFoods();
      renderDebug();
    }, DEBUG ? 1000 : 2500);

    WIN.dispatchEvent(new CustomEvent('gj:mobile-polish-ready', {
      detail:{
        patch:PATCH,
        profile:PROFILE.name,
        isMobile:IS_MOBILE,
        isCVR:IS_CVR
      }
    }));
  }

  WIN.GoodJunkSoloBossMobilePolish = {
    version:PATCH,
    profile:PROFILE,
    isMobile:IS_MOBILE,
    isCVR:IS_CVR,
    polishAllFoods,
    findCenterTarget,
    showHint,
    patchShim,
    getState:()=>({
      patch:PATCH,
      profile:PROFILE.name,
      isMobile:IS_MOBILE,
      isCVR:IS_CVR,
      patched:Boolean((WIN.GJBS || WIN.GoodJunkSoloBossShim)?.__gjMobilePolishPatched),
      activeFoods:getFoodNodes().length
    })
  };

  WIN.GJMP = WIN.GoodJunkSoloBossMobilePolish;

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();
