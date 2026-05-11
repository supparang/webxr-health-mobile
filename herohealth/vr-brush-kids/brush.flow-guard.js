/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.flow-guard.js
 * PATCH v20260511-P31-BRUSH-KIDS-FLOW-GUARD
 *
 * Purpose:
 * - กันหน้า brush ค้างหลังออกจาก warmup
 * - normalize params สำหรับ Brush Kids
 * - เพิ่ม safe start bridge สำหรับ PC/Mobile
 * - เตรียมปุ่ม cooldown / กลับ Hygiene Zone ให้ถูกทาง
 * - เตรียม class สำหรับ cVR/Cardboard ภายหลัง
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const PATCH_ID = 'v20260511-P31-BRUSH-KIDS-FLOW-GUARD';

  const DEFAULTS = {
    zone: 'hygiene',
    game: 'brush',
    mode: 'solo',
    variant: 'kids-vr',
    view: 'mobile',
    diff: 'normal',
    time: '90',
    pid: 'anon',
    name: 'Hero'
  };

  function log(){
    try{
      console.log('[BrushFlowGuard]', PATCH_ID, ...arguments);
    }catch(e){}
  }

  function qs(){
    try{
      return new URLSearchParams(WIN.location.search || '');
    }catch(e){
      return new URLSearchParams();
    }
  }

  function getParam(k, fallback){
    const p = qs();
    const v = p.get(k);
    return v === null || v === '' ? fallback : v;
  }

  function enc(v){
    return encodeURIComponent(String(v == null ? '' : v));
  }

  function baseHero(){
    const path = WIN.location.pathname || '';
    const idx = path.indexOf('/herohealth/');
    if(idx >= 0){
      return WIN.location.origin + path.slice(0, idx + '/herohealth/'.length);
    }
    return WIN.location.origin + '/herohealth/';
  }

  function currentCtx(){
    const p = qs();

    const ctx = {
      pid: getParam('pid', DEFAULTS.pid),
      name: getParam('name', DEFAULTS.name),
      diff: getParam('diff', DEFAULTS.diff),
      time: getParam('time', DEFAULTS.time),
      view: getParam('view', DEFAULTS.view),
      run: getParam('run', 'play'),
      zone: getParam('zone', DEFAULTS.zone),
      game: getParam('game', DEFAULTS.game),
      mode: getParam('mode', DEFAULTS.mode),
      variant: getParam('variant', DEFAULTS.variant),
      studyId: getParam('studyId', ''),
      seed: getParam('seed', String(Date.now())),
      phase: getParam('phase', ''),
      conditionGroup: getParam('conditionGroup', ''),
      api: getParam('api', ''),
      log: getParam('log', ''),
      hub: getParam('hub', '')
    };

    if(!ctx.hub){
      ctx.hub = baseHero() + 'hygiene-zone.html';
    }

    // keep unknown useful params
    ['cat','entry','gameId','recommendedMode','theme','multiplayer','nick'].forEach(k => {
      const v = p.get(k);
      if(v !== null && v !== '') ctx[k] = v;
    });

    return ctx;
  }

  function ctxToQuery(ctx, extra){
    const merged = Object.assign({}, ctx || {}, extra || {});
    const out = new URLSearchParams();

    Object.keys(merged).forEach(k => {
      const v = merged[k];
      if(v === undefined || v === null || v === '') return;
      out.set(k, String(v));
    });

    return out.toString();
  }

  function url(path, extra){
    const ctx = currentCtx();
    const q = ctxToQuery(ctx, extra || {});
    return baseHero() + path.replace(/^\/+/, '') + (q ? '?' + q : '');
  }

  function hygieneZoneUrl(extra){
    const ctx = currentCtx();
    const clean = Object.assign({}, ctx, extra || {}, {
      zone: 'hygiene',
      game: 'brush',
      mode: 'solo',
      variant: 'kids-vr'
    });

    clean.hub = clean.hub || (baseHero() + 'hub.html');

    return baseHero() + 'hygiene-zone.html?' + ctxToQuery(clean, {
      run: 'menu'
    });
  }

  function mainGameUrl(extra){
    return url('vr-brush-kids/brush.html', Object.assign({
      zone: 'hygiene',
      game: 'brush',
      mode: 'solo',
      variant: 'kids-vr',
      run: 'play'
    }, extra || {}));
  }

  function warmupUrl(){
    const next = mainGameUrl({ run: 'play', phase: '' });

    return url('warmup-gate.html', {
      zone: 'hygiene',
      game: 'brush',
      mode: 'solo',
      variant: 'kids-vr',
      phase: 'warmup',
      run: 'warmup',
      next: next,
      back: hygieneZoneUrl(),
      hub: hygieneZoneUrl()
    });
  }

  function cooldownUrl(){
    const back = hygieneZoneUrl({ from: 'brush-cooldown' });

    return url('warmup-gate.html', {
      zone: 'hygiene',
      game: 'brush',
      mode: 'solo',
      variant: 'kids-vr',
      phase: 'cooldown',
      run: 'cooldown',
      cooldown: '1',
      once: '1',
      next: back,
      back: back,
      hub: back
    });
  }

  function safeGo(to){
    try{
      WIN.location.href = to;
    }catch(e){
      try{ WIN.location.assign(to); }catch(_){}
    }
  }

  function applyBodyFlags(){
    const ctx = currentCtx();

    DOC.documentElement.setAttribute('data-brush-flow-patch', PATCH_ID);
    DOC.body && DOC.body.setAttribute('data-brush-flow-patch', PATCH_ID);

    const view = String(ctx.view || '').toLowerCase();

    DOC.documentElement.classList.toggle('hha-view-cvr', view === 'cvr' || view === 'cardboard' || view === 'vr');
    DOC.body && DOC.body.classList.toggle('hha-view-cvr', view === 'cvr' || view === 'cardboard' || view === 'vr');

    DOC.documentElement.classList.add('hha-brush-kids');
    DOC.body && DOC.body.classList.add('hha-brush-kids');
  }

  function isProbablyStarted(){
    try{
      if(WIN.HHA_BRUSH_STARTED) return true;
      if(WIN.__BRUSH_STARTED__) return true;
      if(DOC.body && DOC.body.classList.contains('is-playing')) return true;
      if(DOC.body && DOC.body.classList.contains('playing')) return true;

      const playingEls = DOC.querySelectorAll(
        '.game.is-playing, .stage.is-playing, [data-playing="1"], [data-state="playing"]'
      );
      return playingEls && playingEls.length > 0;
    }catch(e){
      return false;
    }
  }

  function callPossibleStart(){
    const names = [
      'startBrushGame',
      'startGame',
      'start',
      'beginGame',
      'beginBrush',
      'HHA_startBrush',
      'HHA_BRUSH_START'
    ];

    for(const n of names){
      try{
        if(typeof WIN[n] === 'function'){
          WIN[n]();
          WIN.HHA_BRUSH_STARTED = true;
          log('called start fn:', n);
          return true;
        }
      }catch(e){
        console.warn('[BrushFlowGuard] start fn failed:', n, e);
      }
    }

    try{
      DOC.dispatchEvent(new CustomEvent('hha:brush:start', {
        bubbles: true,
        detail: {
          source: 'brush.flow-guard',
          patch: PATCH_ID,
          ctx: currentCtx()
        }
      }));
      WIN.dispatchEvent(new CustomEvent('hha:brush:start', {
        detail: {
          source: 'brush.flow-guard',
          patch: PATCH_ID,
          ctx: currentCtx()
        }
      }));
      WIN.HHA_BRUSH_STARTED = true;
      log('dispatched hha:brush:start');
      return true;
    }catch(e){}

    return false;
  }

  function addEmergencyStartButton(){
    if(DOC.getElementById('hha-brush-emergency-start')) return;

    const btn = DOC.createElement('button');
    btn.id = 'hha-brush-emergency-start';
    btn.type = 'button';
    btn.textContent = '🪥 เริ่มแปรงฟัน';
    btn.setAttribute('aria-label', 'เริ่มเกมแปรงฟัน');

    btn.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:calc(18px + env(safe-area-inset-bottom,0px))',
      'transform:translateX(-50%)',
      'z-index:999999',
      'border:0',
      'border-radius:999px',
      'padding:14px 22px',
      'font-weight:900',
      'font-size:18px',
      'line-height:1',
      'color:#17324a',
      'background:linear-gradient(135deg,#fff6a8,#8fffe3)',
      'box-shadow:0 14px 34px rgba(0,0,0,.22)',
      'cursor:pointer',
      'touch-action:manipulation'
    ].join(';');

    function startNow(ev){
      try{ ev && ev.preventDefault && ev.preventDefault(); }catch(e){}
      try{ ev && ev.stopPropagation && ev.stopPropagation(); }catch(e){}

      const ok = callPossibleStart();

      if(ok){
        btn.textContent = '✅ เริ่มแล้ว!';
        setTimeout(() => {
          try{ btn.remove(); }catch(e){}
        }, 450);
      }else{
        btn.textContent = 'แตะอีกครั้งเพื่อเริ่ม';
      }
    }

    btn.addEventListener('click', startNow, { passive:false });
    btn.addEventListener('touchend', startNow, { passive:false });
    btn.addEventListener('pointerup', startNow, { passive:false });

    DOC.body.appendChild(btn);
  }

  function bindExistingStartButtons(){
    const selectors = [
      '#startBtn',
      '#btnStart',
      '#playBtn',
      '#start-game',
      '#startGame',
      '.start-btn',
      '.play-btn',
      '[data-action="start"]',
      '[data-start]',
      'button'
    ];

    let count = 0;

    selectors.forEach(sel => {
      let list = [];
      try{ list = Array.from(DOC.querySelectorAll(sel)); }catch(e){ list = []; }

      list.forEach(el => {
        if(!el || el.__hhaBrushFlowBound) return;

        const txt = String(el.textContent || '').trim();
        const looksStart =
          sel !== 'button' ||
          /เริ่ม|เล่น|start|play|brush|แปรง/i.test(txt);

        if(!looksStart) return;

        el.__hhaBrushFlowBound = true;
        count++;

        const handler = function(){
          setTimeout(() => {
            if(!isProbablyStarted()){
              callPossibleStart();
            }
          }, 80);
        };

        el.addEventListener('click', handler, true);
        el.addEventListener('touchend', handler, true);
        el.addEventListener('pointerup', handler, true);
      });
    });

    if(count) log('bound start buttons:', count);
  }

  function injectFlowButtons(){
    // ใช้ในหน้า summary หรือหน้าที่มี placeholder
    const cooldownTargets = [
      '[data-action="cooldown"]',
      '[data-hha-cooldown]',
      '#cooldownBtn',
      '#btnCooldown',
      '.cooldown-btn'
    ];

    cooldownTargets.forEach(sel => {
      let list = [];
      try{ list = Array.from(DOC.querySelectorAll(sel)); }catch(e){ list = []; }

      list.forEach(el => {
        if(!el || el.__hhaCooldownBound) return;
        el.__hhaCooldownBound = true;
        el.addEventListener('click', function(ev){
          try{ ev.preventDefault(); ev.stopPropagation(); }catch(e){}
          safeGo(cooldownUrl());
        }, true);
      });
    });

    const zoneTargets = [
      '[data-action="zone"]',
      '[data-action="back-zone"]',
      '[data-hha-zone]',
      '#backZoneBtn',
      '#btnBackZone',
      '.back-zone-btn'
    ];

    zoneTargets.forEach(sel => {
      let list = [];
      try{ list = Array.from(DOC.querySelectorAll(sel)); }catch(e){ list = []; }

      list.forEach(el => {
        if(!el || el.__hhaZoneBound) return;
        el.__hhaZoneBound = true;
        el.addEventListener('click', function(ev){
          try{ ev.preventDefault(); ev.stopPropagation(); }catch(e){}
          safeGo(hygieneZoneUrl());
        }, true);
      });
    });
  }

  function mountCVRHint(){
    const ctx = currentCtx();
    const view = String(ctx.view || '').toLowerCase();
    const isCVR = view === 'cvr' || view === 'cardboard' || view === 'vr';

    if(!isCVR) return;
    if(DOC.getElementById('hha-brush-cvr-crosshair')) return;

    const cross = DOC.createElement('div');
    cross.id = 'hha-brush-cvr-crosshair';
    cross.setAttribute('aria-hidden', 'true');
    cross.style.cssText = [
      'position:fixed',
      'left:50%',
      'top:50%',
      'width:34px',
      'height:34px',
      'margin-left:-17px',
      'margin-top:-17px',
      'z-index:999998',
      'border-radius:999px',
      'border:3px solid rgba(255,255,255,.95)',
      'box-shadow:0 0 0 3px rgba(24,74,116,.28),0 8px 24px rgba(0,0,0,.20)',
      'pointer-events:none'
    ].join(';');

    const dot = DOC.createElement('div');
    dot.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:50%',
      'width:8px',
      'height:8px',
      'margin-left:-4px',
      'margin-top:-4px',
      'border-radius:999px',
      'background:#fff'
    ].join(';');

    cross.appendChild(dot);
    DOC.body.appendChild(cross);

    DOC.addEventListener('click', function(){
      try{
        WIN.dispatchEvent(new CustomEvent('hha:brushTap', {
          detail: {
            source: 'cvr-crosshair',
            x: Math.round(WIN.innerWidth / 2),
            y: Math.round(WIN.innerHeight / 2),
            ctx: currentCtx()
          }
        }));
      }catch(e){}
    }, true);
  }

  function exposeAPI(){
    WIN.HHA_BRUSH_FLOW = Object.assign({}, WIN.HHA_BRUSH_FLOW || {}, {
      patch: PATCH_ID,
      ctx: currentCtx,
      mainGameUrl,
      warmupUrl,
      cooldownUrl,
      hygieneZoneUrl,
      goWarmup: () => safeGo(warmupUrl()),
      goCooldown: () => safeGo(cooldownUrl()),
      goZone: () => safeGo(hygieneZoneUrl()),
      safeStart: callPossibleStart
    });
  }

  function boot(){
    applyBodyFlags();
    exposeAPI();
    bindExistingStartButtons();
    injectFlowButtons();
    mountCVRHint();

    // กันกรณี DOM/render ช้า
    setTimeout(bindExistingStartButtons, 400);
    setTimeout(injectFlowButtons, 500);
    setTimeout(mountCVRHint, 700);

    // ถ้าเข้าหน้า main ด้วย run=play แล้วไม่มีปุ่มเริ่มที่กดติด ให้มีปุ่มช่วยเหลือ
    setTimeout(() => {
      const ctx = currentCtx();
      const run = String(ctx.run || '').toLowerCase();
      const phase = String(ctx.phase || '').toLowerCase();

      if(run === 'play' && phase !== 'warmup' && phase !== 'cooldown' && !isProbablyStarted()){
        addEmergencyStartButton();
      }
    }, 1300);

    log('booted', currentCtx());
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();
