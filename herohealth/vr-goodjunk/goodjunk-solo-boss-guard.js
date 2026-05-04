// === /herohealth/vr-goodjunk/goodjunk-solo-boss-guard.js ===
// GoodJunk Solo Boss Final Polish Guard
// PATCH v8.40.8-FINAL-POLISH-GUARD
// ✅ script load health check
// ✅ safe auto-start fallback
// ✅ summary fallback if not shown
// ✅ duplicate event/click guard
// ✅ zone back URL guard
// ✅ debug health panel with ?debugBoss=1
// ✅ works after v8.40.1-8.40.7
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.40.8-FINAL-POLISH-GUARD';

  const CFG = {
    debug: QS.get('debugBoss') === '1',
    run: QS.get('run') || '',
    mode: QS.get('mode') || QS.get('entry') || '',
    time: Math.max(45, Number(QS.get('time')) || 120),
    guardAutoStart: QS.get('guardAutoStart') !== '0',
    guardSummary: QS.get('guardSummary') !== '0',
    guardClicks: QS.get('guardClicks') !== '0',
    guardBack: QS.get('guardBack') !== '0'
  };

  const EXPECTED = [
    { key:'ultimate', label:'Ultimate', global:'GoodJunkSoloBossUltimate' },
    { key:'drama', label:'Drama', global:'GoodJunkSoloBossDrama' },
    { key:'juice', label:'Juice', global:'GoodJunkSoloBossJuice' },
    { key:'reward', label:'Reward', global:'GoodJunkSoloBossReward' },
    { key:'director', label:'Director', global:'GoodJunkSoloBossDirector' },
    { key:'shim', label:'Shim', global:'GoodJunkSoloBossShim' },
    { key:'merge', label:'Merge', global:'GoodJunkSoloBossMerge' }
  ];

  const state = {
    bootAt: Date.now(),
    domReady:false,
    loaded:false,

    started:false,
    startedAt:0,

    ended:false,
    endedAt:0,

    summaryShown:false,
    summaryAt:0,

    bossDefeated:false,

    duplicateBlocked:0,
    lastHitKey:'',
    lastHitAt:0,

    health:{},
    warnings:[],
    debugBox:null,
    debugTimer:null,
    fallbackStartTimer:null,
    fallbackSummaryTimer:null,
    backChecked:false
  };

  function now(){
    return performance.now();
  }

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

  function warn(code, message, extra){
    const item = {
      code,
      message,
      extra:extra || null,
      at:new Date().toISOString()
    };

    state.warnings.push(item);
    if(state.warnings.length > 10) state.warnings.shift();

    if(CFG.debug){
      console.warn('[GJ Boss Guard]', code, message, extra || '');
    }

    renderDebug();
  }

  function shouldPlayMode(){
    return (
      CFG.run === 'play' ||
      CFG.mode === 'solo' ||
      CFG.mode === 'solo_boss' ||
      CFG.mode === 'boss' ||
      QS.get('entry') === 'solo' ||
      QS.get('entry') === 'boss'
    );
  }

  function dispatch(name, detail){
    WIN.dispatchEvent(new CustomEvent(name, {
      detail:{
        patch:PATCH,
        source:'guard',
        ...(detail || {})
      }
    }));
  }

  function getGlobal(name){
    try{
      return WIN[name];
    }catch(e){
      return null;
    }
  }

  function checkHealth(){
    const h = {};

    EXPECTED.forEach(item => {
      h[item.key] = Boolean(getGlobal(item.global));
    });

    h.GJBS = Boolean(WIN.GJBS || WIN.GoodJunkSoloBossShim);
    h.GJBM = Boolean(WIN.GJBM || WIN.GoodJunkSoloBossMerge);
    h.rewardApi = Boolean(WIN.GoodJunkSoloBossReward && WIN.GoodJunkSoloBossReward.showSummary);
    h.summaryLayer = Boolean(DOC.getElementById('gjRewardLayer'));
    h.urlMode = shouldPlayMode();

    state.health = h;
    state.loaded = Boolean(h.shim || h.GJBS);

    return h;
  }

  function missingLabels(){
    const h = checkHealth();

    return EXPECTED
      .filter(item => !h[item.key])
      .map(item => item.label);
  }

  function waitForCore(cb, tries){
    tries = tries || 0;

    const h = checkHealth();

    if(h.GJBS || h.shim || tries >= 40){
      cb(h);
      return;
    }

    setTimeout(() => waitForCore(cb, tries + 1), 100);
  }

  function safeStart(reason){
    if(state.started) return false;
    if(!shouldPlayMode()) return false;

    waitForCore(h => {
      if(state.started) return;

      state.started = true;
      state.startedAt = Date.now();

      if(WIN.GJBS && typeof WIN.GJBS.start === 'function'){
        WIN.GJBS.start({
          reason:reason || 'guard-start',
          source:'guard'
        });
      }else if(WIN.GoodJunkSoloBossShim && typeof WIN.GoodJunkSoloBossShim.start === 'function'){
        WIN.GoodJunkSoloBossShim.start({
          reason:reason || 'guard-start',
          source:'guard'
        });
      }else{
        dispatch('gj:solo-boss-start', {
          reason:reason || 'guard-start-no-shim'
        });
      }

      scheduleSummaryFallback();

      if(!h.GJBS && !h.shim){
        warn('CORE_MISSING_ON_START', 'Shim/GJBS not ready, dispatched start event directly.');
      }

      renderDebug();
    });

    return true;
  }

  function safeEnd(reason, extra){
    if(state.ended) return false;

    state.ended = true;
    state.endedAt = Date.now();

    const payload = {
      reason:reason || 'guard-end',
      source:'guard',
      ...(extra || {})
    };

    if(WIN.GJBS && typeof WIN.GJBS.end === 'function'){
      WIN.GJBS.end(payload.reason, payload);
    }else if(WIN.GJBM && typeof WIN.GJBM.end === 'function'){
      WIN.GJBM.end(payload.reason, payload);
    }else{
      dispatch('gj:game-end', payload);
    }

    scheduleSummaryFallback(900);
    renderDebug();

    return true;
  }

  function scheduleFallbackStart(){
    clearTimeout(state.fallbackStartTimer);

    if(!CFG.guardAutoStart || !shouldPlayMode()) return;

    state.fallbackStartTimer = setTimeout(() => {
      if(!state.started){
        warn('START_FALLBACK', 'No start event detected, guard started Solo Boss.');
        safeStart('fallback-auto-start');
      }
    }, 900);
  }

  function scheduleSummaryFallback(delay){
    if(!CFG.guardSummary) return;

    clearTimeout(state.fallbackSummaryTimer);

    const ms = Number(delay) || Math.max(5000, (CFG.time + 4) * 1000);

    state.fallbackSummaryTimer = setTimeout(() => {
      if(state.summaryShown) return;

      if(state.ended || state.bossDefeated){
        warn('SUMMARY_FALLBACK', 'Summary did not show after end/defeat, forcing reward summary.');
        forceSummary({
          reason:'guard-summary-fallback',
          ended:state.ended,
          bossDefeated:state.bossDefeated
        });
        return;
      }

      // ถ้าเกมเกินเวลานานมากแล้วยังไม่จบ ให้จบแบบกันค้าง
      if(state.started && !state.ended){
        const elapsed = Math.round((Date.now() - state.startedAt) / 1000);
        if(elapsed >= CFG.time + 6){
          warn('TIME_END_FALLBACK', 'Game exceeded configured time, guard ended game.');
          safeEnd('guard-time-fallback', {
            elapsedSec:elapsed
          });
        }
      }
    }, ms);
  }

  function forceSummary(extra){
    if(state.summaryShown) return null;

    if(WIN.GoodJunkSoloBossReward && typeof WIN.GoodJunkSoloBossReward.showSummary === 'function'){
      return WIN.GoodJunkSoloBossReward.showSummary({
        reason:'guard-force-summary',
        ...(extra || {})
      });
    }

    if(WIN.GJBM && typeof WIN.GJBM.forceSummary === 'function'){
      return WIN.GJBM.forceSummary({
        reason:'guard-force-summary',
        ...(extra || {})
      });
    }

    dispatch('gj:game-end', {
      reason:'guard-force-summary-no-reward',
      ...(extra || {})
    });

    warn('REWARD_API_MISSING', 'Reward API not found, dispatched gj:game-end instead.');

    return null;
  }

  function patchDuplicateClickGuard(){
    if(!CFG.guardClicks) return;
    if(DOC.documentElement.dataset.gjGuardClickPatched === '1') return;

    DOC.documentElement.dataset.gjGuardClickPatched = '1';

    DOC.addEventListener('click', function(ev){
      const el = ev.target && ev.target.closest
        ? ev.target.closest('[data-gj-merge-bound="1"],[data-gj-boss-shim="1"],.gj-boss-item,.food-target,.goodjunk-food')
        : null;

      if(!el) return;

      const t = now();
      const id = el.dataset.foodId || el.dataset.foodName || el.id || el.textContent || 'food';
      const key = String(id).slice(0, 80);

      if(el.dataset.gjConsumed === '1'){
        // element นี้ถูกกินไปแล้ว ไม่ให้คะแนนซ้ำ
        ev.preventDefault();
        ev.stopPropagation();
        state.duplicateBlocked += 1;
        renderDebug();
        return;
      }

      if(state.lastHitKey === key && t - state.lastHitAt < 120){
        ev.preventDefault();
        ev.stopPropagation();
        el.dataset.gjConsumed = '1';
        state.duplicateBlocked += 1;
        warn('DUPLICATE_CLICK_BLOCKED', 'Blocked very fast duplicate food click.', { key });
        renderDebug();
        return;
      }

      state.lastHitKey = key;
      state.lastHitAt = t;
    }, true);
  }

  function patchBackUrlGuard(){
    if(!CFG.guardBack) return;
    if(state.backChecked) return;

    state.backChecked = true;

    const hub = QS.get('hub') || '';
    if(!hub){
      warn('NO_HUB_PARAM', 'No hub parameter found. Reward screen will use fallback Nutrition Zone.');
      return;
    }

    try{
      const decoded = decodeURIComponent(hub);
      const url = new URL(decoded, location.href);

      const ok =
        url.origin === location.origin ||
        url.hostname === 'supparang.github.io';

      if(!ok){
        warn('UNSAFE_HUB_PARAM', 'Hub URL was not same-origin or allowed GitHub Pages host.', {
          hub:decoded
        });
      }

      if(!/nutrition-zone\.html/i.test(url.pathname) && !/hub\.html/i.test(url.pathname)){
        warn('HUB_PATH_UNUSUAL', 'Hub path is not nutrition-zone.html or hub.html. Check back button destination.', {
          path:url.pathname
        });
      }
    }catch(e){
      warn('BAD_HUB_PARAM', 'Hub parameter could not be parsed.', {
        hub
      });
    }
  }

  function ensureStyle(){
    if(DOC.getElementById('gjBossGuardStyle')) return;

    const css = DOC.createElement('style');
    css.id = 'gjBossGuardStyle';
    css.textContent = `
      .gj-guard-debug{
        position:fixed;
        left:10px;
        top:calc(10px + env(safe-area-inset-top));
        width:min(340px, calc(100vw - 20px));
        max-height:calc(100dvh - 20px);
        overflow:auto;
        z-index:100090;
        pointer-events:none;
        border-radius:18px;
        background:rgba(15,23,42,.88);
        color:#e5e7eb;
        box-shadow:0 16px 42px rgba(15,23,42,.32);
        border:1px solid rgba(255,255,255,.18);
        padding:11px;
        font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        font-size:11px;
        line-height:1.38;
        white-space:pre-wrap;
      }

      .gj-guard-debug b{
        color:#fde68a;
      }

      .gj-guard-debug .ok{
        color:#86efac;
      }

      .gj-guard-debug .bad{
        color:#fca5a5;
      }

      .gj-guard-debug .warn{
        color:#fcd34d;
      }

      .gj-guard-safe-tap{
        touch-action:manipulation;
      }
    `;
    DOC.head.appendChild(css);
  }

  function renderDebug(){
    if(!CFG.debug) return;

    ensureStyle();

    if(!state.debugBox){
      state.debugBox = DOC.createElement('div');
      state.debugBox.className = 'gj-guard-debug';
      DOC.body.appendChild(state.debugBox);
    }

    const h = checkHealth();
    const missing = missingLabels();

    const line = (label, ok) => `${ok ? '✅' : '❌'} ${label}`;

    const elapsed = state.startedAt
      ? Math.round((Date.now() - state.startedAt) / 1000)
      : 0;

    const warnText = state.warnings.length
      ? state.warnings.slice(-5).map(w => `⚠️ ${w.code}: ${w.message}`).join('\n')
      : 'no warnings';

    state.debugBox.innerHTML =
`<b>GoodJunk Solo Boss Guard</b>
${PATCH}

${line('Ultimate', h.ultimate)}
${line('Drama', h.drama)}
${line('Juice', h.juice)}
${line('Reward', h.reward)}
${line('Director', h.director)}
${line('Shim / GJBS', h.GJBS)}
${line('Merge / GJBM', h.GJBM)}

started: ${state.started}
ended: ${state.ended}
summaryShown: ${state.summaryShown}
bossDefeated: ${state.bossDefeated}
elapsed: ${elapsed}s / ${CFG.time}s

duplicateBlocked: ${state.duplicateBlocked}
missing: ${missing.length ? esc(missing.join(', ')) : 'none'}

warnings:
${esc(warnText)}`;
  }

  function installEventWatchers(){
    WIN.addEventListener('gj:solo-boss-start', function(){
      if(!state.started){
        state.started = true;
        state.startedAt = Date.now();
        scheduleSummaryFallback();
      }
      renderDebug();
    });

    WIN.addEventListener('gj:game-start', function(){
      if(!state.started){
        state.started = true;
        state.startedAt = Date.now();
        scheduleSummaryFallback();
      }
      renderDebug();
    });

    WIN.addEventListener('gj:boss-start', function(){
      if(!state.started){
        state.started = true;
        state.startedAt = Date.now();
        scheduleSummaryFallback();
      }
      renderDebug();
    });

    WIN.addEventListener('gj:game-end', function(){
      state.ended = true;
      state.endedAt = Date.now();
      scheduleSummaryFallback(1000);
      renderDebug();
    });

    WIN.addEventListener('gj:boss-end', function(){
      state.ended = true;
      state.endedAt = Date.now();
      scheduleSummaryFallback(1000);
      renderDebug();
    });

    WIN.addEventListener('gj:boss-defeated', function(){
      state.bossDefeated = true;
      state.ended = true;
      state.endedAt = Date.now();
      scheduleSummaryFallback(1500);
      renderDebug();
    });

    WIN.addEventListener('gj:reward-summary-shown', function(){
      state.summaryShown = true;
      state.summaryAt = Date.now();
      clearTimeout(state.fallbackSummaryTimer);
      renderDebug();
    });

    WIN.addEventListener('error', function(e){
      const msg = e && e.message ? e.message : 'window error';
      if(/goodjunk|boss|GJBS|GJBM|gj:/i.test(msg)){
        warn('WINDOW_ERROR', msg, {
          filename:e.filename,
          lineno:e.lineno,
          colno:e.colno
        });
      }
    });

    WIN.addEventListener('unhandledrejection', function(e){
      const msg = e && e.reason ? String(e.reason.message || e.reason) : 'unhandled rejection';
      if(/goodjunk|boss|GJBS|GJBM|gj:/i.test(msg)){
        warn('PROMISE_ERROR', msg);
      }
    });
  }

  function checkScriptHealthLater(){
    setTimeout(() => {
      const missing = missingLabels();

      if(missing.includes('Shim')){
        warn('SHIM_MISSING', 'goodjunk-solo-boss-shim.js may not be loaded. Main bridge APIs may not work.');
      }

      if(missing.includes('Reward')){
        warn('REWARD_MISSING', 'goodjunk-solo-boss-reward.js may not be loaded. Summary may not show.');
      }

      if(missing.length >= 4){
        warn('MANY_ADDONS_MISSING', 'Several Solo Boss addons are missing. Check script order/path.', {
          missing
        });
      }

      renderDebug();
    }, 1600);

    setTimeout(() => {
      const h = checkHealth();

      if(shouldPlayMode() && !state.started){
        warn('NO_START_AFTER_LOAD', 'No start event after page load.');
      }

      if(!h.summaryLayer && h.reward){
        warn('SUMMARY_LAYER_NOT_CREATED_YET', 'Reward loaded but summary layer not mounted yet. This is okay before end.');
      }

      renderDebug();
    }, 3200);
  }

  function hardenFoodElements(){
    try{
      const nodes = DOC.querySelectorAll('.food-target,.goodjunk-food,.gj-boss-item,[data-food-type],[data-gj-food]');
      nodes.forEach(el => {
        el.classList.add('gj-guard-safe-tap');
      });
    }catch(e){}
  }

  function startDebugLoop(){
    if(!CFG.debug) return;

    clearInterval(state.debugTimer);
    state.debugTimer = setInterval(() => {
      checkHealth();
      hardenFoodElements();
      renderDebug();
    }, 1000);
  }

  function init(){
    state.domReady = true;

    ensureStyle();
    installEventWatchers();
    patchDuplicateClickGuard();
    patchBackUrlGuard();
    hardenFoodElements();
    checkScriptHealthLater();
    scheduleFallbackStart();
    startDebugLoop();

    renderDebug();

    dispatch('gj:guard-ready', {
      patch:PATCH,
      debug:CFG.debug,
      health:checkHealth()
    });
  }

  WIN.GoodJunkSoloBossGuard = {
    version:PATCH,
    checkHealth,
    missingLabels,
    safeStart,
    safeEnd,
    forceSummary,
    renderDebug,
    warn,
    getState:()=>JSON.parse(JSON.stringify({
      bootAt:state.bootAt,
      domReady:state.domReady,
      loaded:state.loaded,
      started:state.started,
      ended:state.ended,
      summaryShown:state.summaryShown,
      bossDefeated:state.bossDefeated,
      duplicateBlocked:state.duplicateBlocked,
      health:state.health,
      warnings:state.warnings
    }))
  };

  WIN.GJBG = WIN.GoodJunkSoloBossGuard;

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

  WIN.addEventListener('load', function(){
    setTimeout(hardenFoodElements, 250);
    setTimeout(renderDebug, 500);
  });
})();
