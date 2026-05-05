// === /herohealth/vr-goodjunk/goodjunk-solo-boss-touch-comfort.js ===
// GoodJunk Solo Boss Touch Comfort Patch
// PATCH v8.41.10-TOUCH-COMFORT-PATCH
// ✅ bigger mobile touch comfort
// ✅ tap-near-food assist
// ✅ safer spawn horizontal zone
// ✅ avoid food passing under HUD too much
// ✅ first 5 seconds slower / easier
// ✅ low-life comfort assist
// ✅ works with v8.41.0 main + v8.41.2 mobile polish
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.41.10-TOUCH-COMFORT-PATCH';

  const VIEW = String(QS.get('view') || 'mobile').toLowerCase();
  const DEBUG = QS.get('debugBoss') === '1';
  const ENABLED = QS.get('touchComfort') !== '0';

  const IS_COARSE = (() => {
    try{
      return WIN.matchMedia && WIN.matchMedia('(pointer: coarse)').matches;
    }catch(e){
      return false;
    }
  })();

  const IS_SMALL = Math.min(WIN.innerWidth || 999, WIN.innerHeight || 999) <= 760;
  const IS_MOBILE = VIEW === 'mobile' || VIEW === 'cvr' || IS_COARSE || IS_SMALL;
  const IS_CVR = /cvr|cardboard|vr/i.test(VIEW);

  const PROFILE = IS_CVR ? {
    name:'cvr-comfort',
    foodScale:1.12,
    hitPad:26,
    assistRadius:118,
    safeLeft:10,
    safeRight:78,
    startTop:132,
    firstSeconds:6,
    firstSpeedMul:0.78,
    firstDelayMul:1.18,
    lowLifeSpeedMul:0.82,
    lowLifeDelayMul:1.20
  } : IS_MOBILE ? {
    name:'mobile-comfort',
    foodScale:1.10,
    hitPad:24,
    assistRadius:98,
    safeLeft:9,
    safeRight:80,
    startTop:122,
    firstSeconds:6,
    firstSpeedMul:0.82,
    firstDelayMul:1.14,
    lowLifeSpeedMul:0.86,
    lowLifeDelayMul:1.16
  } : {
    name:'desktop-comfort',
    foodScale:1.04,
    hitPad:16,
    assistRadius:78,
    safeLeft:7,
    safeRight:84,
    startTop:108,
    firstSeconds:4,
    firstSpeedMul:0.90,
    firstDelayMul:1.08,
    lowLifeSpeedMul:0.92,
    lowLifeDelayMul:1.10
  };

  const state = {
    patched:false,
    startedAt:0,
    started:false,
    ended:false,
    observer:null,
    lastAssistTapAt:0,
    assistedTaps:0,
    adjustedFoods:0,
    debugBox:null,
    originalGetSpawnDelay:null,
    originalGetItemSpeed:null
  };

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }

  function getMainState(){
    try{
      return WIN.GJSBM?.getState?.() || WIN.GoodJunkSoloBossMain?.getState?.() || {};
    }catch(e){
      return {};
    }
  }

  function getElapsed(){
    if(!state.startedAt) return 0;
    return Math.max(0, (Date.now() - state.startedAt) / 1000);
  }

  function getLives(){
    const s = getMainState();
    return n(s.lives, 4);
  }

  function comfortSpeedMul(){
    let mul = 1;

    if(getElapsed() <= PROFILE.firstSeconds){
      mul *= PROFILE.firstSpeedMul;
    }

    if(getLives() <= 1){
      mul *= PROFILE.lowLifeSpeedMul;
    }

    return mul;
  }

  function comfortDelayMul(){
    let mul = 1;

    if(getElapsed() <= PROFILE.firstSeconds){
      mul *= PROFILE.firstDelayMul;
    }

    if(getLives() <= 1){
      mul *= PROFILE.lowLifeDelayMul;
    }

    return mul;
  }

  function ensureStyle(){
    if(DOC.getElementById('gjTouchComfortStyle')) return;

    const css = DOC.createElement('style');
    css.id = 'gjTouchComfortStyle';
    css.textContent = `
      html.gjtc-on,
      html.gjtc-on body{
        touch-action:manipulation;
        overscroll-behavior:none;
      }

      html.gjtc-on .gjm-food,
      html.gjtc-on .goodjunk-food.food-target{
        top:calc(${PROFILE.startTop}px + env(safe-area-inset-top)) !important;
        transform-origin:center center;
      }

      html.gjtc-on .gjm-food{
        width:${Math.round(76 * PROFILE.foodScale)}px !important;
        min-height:${Math.round(86 * PROFILE.foodScale)}px !important;
      }

      html.gjtc-on .gjm-food b{
        font-size:${Math.round(38 * PROFILE.foodScale)}px !important;
      }

      html.gjtc-on .gjm-food span{
        font-size:${IS_MOBILE ? 11 : 11}px !important;
        line-height:1.08 !important;
      }

      html.gjtc-on .gjm-food::after,
      html.gjtc-on .goodjunk-food.food-target::after{
        content:"";
        position:absolute;
        inset:-${PROFILE.hitPad}px !important;
        border-radius:34px;
        pointer-events:auto;
      }

      html.gjtc-on .gjm-food.gjtc-near{
        outline:4px solid rgba(56,189,248,.46);
        outline-offset:5px;
        filter:drop-shadow(0 0 18px rgba(56,189,248,.42));
      }

      html.gjtc-on .gjm-food.gjtc-safe-start{
        animation-duration:calc(var(--dur, 4.5s) * 1.05) !important;
      }

      .gjtc-tap-ring{
        position:fixed;
        left:0;
        top:0;
        z-index:100080;
        width:64px;
        height:64px;
        border-radius:999px;
        border:4px solid rgba(56,189,248,.90);
        box-shadow:0 0 0 8px rgba(56,189,248,.20);
        transform:translate(-50%,-50%) scale(.45);
        opacity:0;
        pointer-events:none;
        animation:gjtcRing .42s ease forwards;
      }

      .gjtc-toast{
        position:fixed;
        left:50%;
        bottom:calc(176px + env(safe-area-inset-bottom));
        z-index:100081;
        width:min(390px, calc(100vw - 28px));
        transform:translateX(-50%) translateY(10px) scale(.96);
        border-radius:999px;
        padding:10px 14px;
        background:rgba(15,23,42,.82);
        color:#fff;
        border:2px solid rgba(255,255,255,.72);
        box-shadow:0 14px 34px rgba(15,23,42,.24);
        text-align:center;
        font-size:13px;
        font-weight:900;
        line-height:1.25;
        opacity:0;
        pointer-events:none;
        transition:opacity .18s ease, transform .18s ease;
        backdrop-filter:blur(8px);
      }

      .gjtc-toast.show{
        opacity:1;
        transform:translateX(-50%) translateY(0) scale(1);
      }

      .gjtc-debug{
        position:fixed;
        right:10px;
        bottom:calc(300px + env(safe-area-inset-bottom));
        z-index:100130;
        width:min(290px, calc(100vw - 20px));
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

      @keyframes gjtcRing{
        0%{
          opacity:0;
          transform:translate(-50%,-50%) scale(.35);
        }
        30%{
          opacity:1;
          transform:translate(-50%,-50%) scale(1);
        }
        100%{
          opacity:0;
          transform:translate(-50%,-50%) scale(1.35);
        }
      }

      @media (max-width:420px){
        .gjtc-toast{
          bottom:calc(160px + env(safe-area-inset-bottom));
          font-size:12px;
        }
      }
    `;

    DOC.head.appendChild(css);
    DOC.documentElement.classList.add('gjtc-on');
  }

  function waitForShim(cb, tries){
    tries = tries || 0;

    const shim = WIN.GJBS || WIN.GoodJunkSoloBossShim;
    if(shim || tries >= 100){
      cb(shim || null);
      return;
    }

    setTimeout(() => waitForShim(cb, tries + 1), 80);
  }

  function patchShim(shim){
    if(!shim || shim.__gjTouchComfortPatched) return;

    state.originalGetSpawnDelay = typeof shim.getSpawnDelay === 'function'
      ? shim.getSpawnDelay.bind(shim)
      : null;

    state.originalGetItemSpeed = typeof shim.getItemSpeed === 'function'
      ? shim.getItemSpeed.bind(shim)
      : null;

    shim.getSpawnDelay = function(baseDelay){
      const raw = state.originalGetSpawnDelay ? state.originalGetSpawnDelay(baseDelay) : n(baseDelay, 1000);
      return clamp(raw * comfortDelayMul(), 540, 1900);
    };

    shim.getItemSpeed = function(baseSpeed){
      const raw = state.originalGetItemSpeed ? state.originalGetItemSpeed(baseSpeed) : n(baseSpeed, 1);
      return clamp(raw * comfortSpeedMul(), 0.50, 1.85);
    };

    shim.__gjTouchComfortPatched = true;
    state.patched = true;

    WIN.dispatchEvent(new CustomEvent('gj:touch-comfort-patched', {
      detail:{
        patch:PATCH,
        profile:PROFILE.name
      }
    }));

    renderDebug();
  }

  function foodNodes(){
    return Array.from(DOC.querySelectorAll('.gjm-food,.goodjunk-food.food-target,.food-target[data-food-type]'))
      .filter(el => el && el.dataset && el.dataset.consumed !== '1' && el.dataset.gjConsumed !== '1');
  }

  function adjustFood(el){
    if(!el || el.dataset.gjtcAdjusted === '1') return;

    el.dataset.gjtcAdjusted = '1';
    el.classList.add('gjtc-safe-start');

    const leftRaw = parseFloat(el.style.left);
    if(Number.isFinite(leftRaw)){
      const safe = clamp(leftRaw, PROFILE.safeLeft, PROFILE.safeRight);
      if(Math.abs(safe - leftRaw) > 0.2){
        el.style.left = safe + '%';
        state.adjustedFoods += 1;
      }
    }

    if(!el.getAttribute('role')){
      el.setAttribute('role', 'button');
    }

    if(!el.getAttribute('aria-label')){
      const type = el.dataset.foodType || 'food';
      const name = el.dataset.foodName || el.textContent || 'อาหาร';
      el.setAttribute('aria-label', `${type}: ${name}`);
    }
  }

  function adjustAllFoods(){
    foodNodes().forEach(adjustFood);
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
        setTimeout(adjustAllFoods, 20);
      }
    });

    state.observer.observe(DOC.body || DOC.documentElement, {
      childList:true,
      subtree:true
    });
  }

  function isBlockedTapTarget(target){
    if(!target || !target.closest) return false;

    return Boolean(target.closest(
      [
        '.gjr-panel',
        '.gjr-actions',
        '.gjm-start',
        '.shell-back',
        '.gjj-mute',
        '.gjvh-panel',
        '.gj-guard-debug',
        '.gjm-hud',
        'button:not(.gjm-food):not(.goodjunk-food):not(.food-target)',
        'a',
        'input',
        'textarea',
        'select'
      ].join(',')
    ));
  }

  function centerOf(el){
    const r = el.getBoundingClientRect();
    return {
      x:r.left + r.width / 2,
      y:r.top + r.height / 2,
      w:r.width,
      h:r.height
    };
  }

  function findNearestFood(x, y){
    let best = null;
    let bestDist = Infinity;

    foodNodes().forEach(el => {
      const c = centerOf(el);
      if(!c.w || !c.h) return;

      const dx = c.x - x;
      const dy = c.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const radius = Math.max(
        PROFILE.assistRadius,
        Math.max(c.w, c.h) * 0.92
      );

      if(dist <= radius && dist < bestDist){
        best = el;
        bestDist = dist;
      }
    });

    return best;
  }

  function tapRing(x, y){
    const ring = DOC.createElement('div');
    ring.className = 'gjtc-tap-ring';
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    DOC.body.appendChild(ring);
    setTimeout(() => ring.remove(), 460);
  }

  let toastTimer = null;
  function toast(text){
    let el = DOC.getElementById('gjtcToast');

    if(!el){
      el = DOC.createElement('div');
      el.id = 'gjtcToast';
      el.className = 'gjtc-toast';
      DOC.body.appendChild(el);
    }

    el.textContent = text;
    el.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
  }

  function highlightNearest(){
    const nodes = foodNodes();
    nodes.forEach(el => el.classList.remove('gjtc-near'));

    if(!state.started || state.ended) return;

    const cx = WIN.innerWidth / 2;
    const cy = WIN.innerHeight * 0.58;
    const nearest = findNearestFood(cx, cy);

    if(nearest){
      nearest.classList.add('gjtc-near');
    }
  }

  function bindTapAssist(){
    DOC.addEventListener('pointerdown', function(ev){
      if(!ENABLED) return;
      if(!state.started || state.ended) return;
      if(ev.pointerType === 'mouse' && !IS_MOBILE) return;

      const directFood = ev.target && ev.target.closest
        ? ev.target.closest('.gjm-food,.goodjunk-food.food-target,.food-target[data-food-type]')
        : null;

      if(directFood) return;
      if(isBlockedTapTarget(ev.target)) return;

      const x = n(ev.clientX, WIN.innerWidth / 2);
      const y = n(ev.clientY, WIN.innerHeight / 2);

      const nearest = findNearestFood(x, y);
      if(!nearest) return;

      const t = performance.now();
      if(t - state.lastAssistTapAt < 180) return;
      state.lastAssistTapAt = t;

      ev.preventDefault();
      ev.stopPropagation();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      state.assistedTaps += 1;
      tapRing(x, y);

      try{
        nearest.click();
      }catch(e){}

      renderDebug();
    }, true);
  }

  function bindGameEvents(){
    WIN.addEventListener('gj:solo-boss-start', function(){
      state.started = true;
      state.ended = false;
      state.startedAt = Date.now();

      setTimeout(() => {
        toast('แตะใกล้อาหารได้เลย ระบบช่วยจับเป้าให้นิดหนึ่ง');
      }, 800);

      renderDebug();
    });

    WIN.addEventListener('gj:game-start', function(){
      state.started = true;
      state.ended = false;
      state.startedAt = Date.now();
      renderDebug();
    });

    WIN.addEventListener('gj:boss-start', function(){
      state.started = true;
      state.ended = false;
      state.startedAt = Date.now();
      renderDebug();
    });

    WIN.addEventListener('gj:game-end', function(){
      state.ended = true;
      renderDebug();
    });

    WIN.addEventListener('gj:boss-end', function(){
      state.ended = true;
      renderDebug();
    });

    WIN.addEventListener('gj:boss-defeated', function(){
      state.ended = true;
      renderDebug();
    });

    WIN.addEventListener('gj:director-fair-help', function(e){
      const d = e.detail || {};
      if(d.assist){
        toast('โหมดช่วยแตะทำงาน: อาหารจะช้าลงและแตะง่ายขึ้น');
      }
    });
  }

  function renderDebug(){
    if(!DEBUG) return;

    ensureStyle();

    let box = DOC.getElementById('gjTouchComfortDebug');
    if(!box){
      box = DOC.createElement('pre');
      box.id = 'gjTouchComfortDebug';
      box.className = 'gjtc-debug';
      DOC.body.appendChild(box);
      state.debugBox = box;
    }

    box.textContent =
`GoodJunk Touch Comfort
${PATCH}

profile: ${PROFILE.name}
patched: ${state.patched}
started: ${state.started}
ended: ${state.ended}
elapsed: ${Math.round(getElapsed())}s
lives: ${getLives()}

speedMul: ${comfortSpeedMul().toFixed(2)}
delayMul: ${comfortDelayMul().toFixed(2)}

foods: ${foodNodes().length}
adjusted: ${state.adjustedFoods}
assistedTaps: ${state.assistedTaps}`;
  }

  function boot(){
    if(!ENABLED) return;

    ensureStyle();

    waitForShim(patchShim);
    observeFoods();
    adjustAllFoods();
    bindTapAssist();
    bindGameEvents();

    setInterval(() => {
      waitForShim(patchShim);
      adjustAllFoods();
      highlightNearest();
      renderDebug();
    }, DEBUG ? 700 : 1400);

    WIN.dispatchEvent(new CustomEvent('gj:touch-comfort-ready', {
      detail:{
        patch:PATCH,
        profile:PROFILE.name,
        isMobile:IS_MOBILE,
        isCVR:IS_CVR
      }
    }));
  }

  WIN.GoodJunkSoloBossTouchComfort = {
    version:PATCH,
    profile:PROFILE,
    patchShim,
    adjustAllFoods,
    findNearestFood,
    getState:()=>({
      patch:PATCH,
      profile:PROFILE.name,
      patched:state.patched,
      started:state.started,
      ended:state.ended,
      elapsed:getElapsed(),
      lives:getLives(),
      speedMul:comfortSpeedMul(),
      delayMul:comfortDelayMul(),
      adjustedFoods:state.adjustedFoods,
      assistedTaps:state.assistedTaps,
      activeFoods:foodNodes().length
    })
  };

  WIN.GJTC = WIN.GoodJunkSoloBossTouchComfort;

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();
