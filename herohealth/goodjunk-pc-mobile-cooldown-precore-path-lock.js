// === /herohealth/goodjunk-pc-mobile-cooldown-precore-path-lock.js ===
// PATCH v20260605-GOODJUNK-PC-MOBILE-COOLDOWN-PRECORE-PATH-LOCK
//
// Purpose:
// - Fix GoodJunk cooldown return path on PC/Mobile before gate-core auto redirect.
// - Force all GoodJunk cooldown return paths to:
//   https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html
// - Prevent wrong return path:
//   https://supparang.github.io/webxr-health-mobile/goodjunk-launcher.html
//
// IMPORTANT:
// - Must load BEFORE ./gate/gate-core.js
// - Keep old file goodjunk-mobile-cooldown-gate-summary-return-final.js disabled for now.

(function(){
  'use strict';

  const PATCH = 'v20260605-GOODJUNK-PC-MOBILE-COOLDOWN-PRECORE-PATH-LOCK';

  const GOODJUNK_LAUNCHER =
    'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';

  const qs = new URLSearchParams(location.search || '');

  function getParam(name, fallback){
    const v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function lowerParam(name){
    return String(qs.get(name) || '').toLowerCase();
  }

  function isGoodJunkCooldown(){
    const raw = [
      lowerParam('game'),
      lowerParam('gameId'),
      lowerParam('theme'),
      lowerParam('entry'),
      lowerParam('mode'),
      lowerParam('from'),
      lowerParam('fromGame')
    ].join(' ');

    const phase = lowerParam('phase') || lowerParam('gatePhase');

    return raw.includes('goodjunk') && phase === 'cooldown';
  }

  if(!isGoodJunkCooldown()){
    return;
  }

  function normalizeGoodJunkUrl(url){
    let s = String(url || '');

    s = s.replace(
      'https://supparang.github.io/webxr-health-mobile/goodjunk-launcher.html',
      'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html'
    );

    s = s.replace(
      '/webxr-health-mobile/goodjunk-launcher.html',
      '/webxr-health-mobile/herohealth/goodjunk-launcher.html'
    );

    s = s.replace(
      'https://supparang.github.io/webxr-health-mobile/herohealth/herohealth/goodjunk-launcher.html',
      'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html'
    );

    s = s.replace(
      '/herohealth/herohealth/goodjunk-launcher.html',
      '/herohealth/goodjunk-launcher.html'
    );

    return s;
  }

  function fixedLauncherUrl(){
    const u = new URL(GOODJUNK_LAUNCHER);

    u.searchParams.set('pid', getParam('pid', 'anon'));
    u.searchParams.set('name', getParam('name', getParam('nick', 'Hero')));
    u.searchParams.set('diff', getParam('diff', 'normal'));
    u.searchParams.set('time', getParam('time', '120'));
    u.searchParams.set('view', getParam('view', 'pc'));

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', getParam('mode', 'solo'));
    u.searchParams.set('entry', 'cooldown-return');

    const keepKeys = [
      'studyId',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api',
      'seed'
    ];

    keepKeys.forEach(function(key){
      const v = qs.get(key);
      if(v !== null && v !== ''){
        u.searchParams.set(key, v);
      }
    });

    return u.toString();
  }

  const TARGET = fixedLauncherUrl();

  /*
    Force query params before gate-core reads them.
  */
  qs.set('hub', TARGET);
  qs.set('next', TARGET);
  qs.set('back', TARGET);
  qs.set('launcher', TARGET);
  qs.set('return', TARGET);
  qs.set('returnUrl', TARGET);
  qs.set('after', TARGET);
  qs.set('done', TARGET);
  qs.set('doneUrl', TARGET);
  qs.set('cdnext', TARGET);

  qs.set('phase', 'cooldown');
  qs.set('zone', 'nutrition');
  qs.set('cat', 'nutrition');
  qs.set('game', 'goodjunk');
  qs.set('gameId', 'goodjunk');

  history.replaceState(
    null,
    '',
    location.pathname + '?' + qs.toString() + (location.hash || '')
  );

  /*
    Global force values used by gate-core / gate modules.
  */
  window.HH_GATE_FORCE_NEXT = TARGET;
  window.HH_GATE_FORCE_BACK = TARGET;
  window.HH_GATE_FORCE_HUB = TARGET;

  window.HHA_GATE_RETURN_URL = TARGET;
  window.HHA_GATE_DONE_URL = TARGET;
  window.HHA_NEXT_URL = TARGET;
  window.HHA_BACK_URL = TARGET;
  window.HHA_HUB_URL = TARGET;

  window.HHA_GATE_BOOT = window.HHA_GATE_BOOT || {};
  window.HHA_GATE_BOOT.nextHref = TARGET;
  window.HHA_GATE_BOOT.backHref = TARGET;
  window.HHA_GATE_BOOT.hubHref = TARGET;
  window.HHA_GATE_BOOT.goodjunkCooldownPcMobilePathLock = PATCH;

  function goTarget(reason){
    try{
      localStorage.setItem('GJ_GATE_PRE_CORE_PATH_LOCK_GO_LAST', JSON.stringify({
        patch: PATCH,
        reason: reason || '',
        target: TARGET,
        at: new Date().toISOString()
      }));
    }catch(_){}

    location.replace(TARGET);
  }

  /*
    Common gate functions that may be called by gate-core.
  */
  window.goDone = function(){ goTarget('goDone'); };
  window.goNext = function(){ goTarget('goNext'); };
  window.goBack = function(){ goTarget('goBack'); };
  window.goHub = function(){ goTarget('goHub'); };

  window.finishGate = function(){ goTarget('finishGate'); };
  window.finishCooldown = function(){ goTarget('finishCooldown'); };
  window.completeCooldown = function(){ goTarget('completeCooldown'); };

  window.HHA_GATE_GO_NEXT = function(){ goTarget('HHA_GATE_GO_NEXT'); };
  window.HHA_GATE_GO_BACK = function(){ goTarget('HHA_GATE_GO_BACK'); };
  window.HHA_GATE_GO_HUB = function(){ goTarget('HHA_GATE_GO_HUB'); };

  window.GJ_GATE_PRE_CORE_PATH_LOCK = {
    version: PATCH,
    target: TARGET,
    launcher: GOODJUNK_LAUNCHER,
    normalize: normalizeGoodJunkUrl,
    go: goTarget
  };

  function labelOf(el){
    return String(
      el && (
        el.textContent ||
        el.getAttribute && (
          el.getAttribute('aria-label') ||
          el.getAttribute('title')
        ) ||
        ''
      ) || ''
    ).replace(/\s+/g, ' ').trim();
  }

  function isReturnButton(el){
    if(!el || !el.closest) return false;

    const btn = el.closest('a,button,[role="button"]');
    if(!btn) return false;

    const text = labelOf(btn);
    const href = String(btn.getAttribute && btn.getAttribute('href') || '');

    return (
      text.includes('กลับ') ||
      text.includes('ไปต่อ') ||
      text.includes('เสร็จ') ||
      text.includes('จบ') ||
      text.includes('Home') ||
      text.includes('Zone') ||
      text.includes('โหมด') ||
      text.includes('GoodJunk') ||
      text.includes('เลือกเกม') ||
      text.includes('เลือกโหมด') ||
      href.includes('goodjunk-launcher.html') ||
      href.includes('hub.html')
    );
  }

  function markReturnButtons(){
    const nodes = document.querySelectorAll('a,button,[role="button"]');

    Array.prototype.forEach.call(nodes, function(el){
      if(!isReturnButton(el)) return;

      el.dataset.gjPreCorePathLock = PATCH;

      if(el.tagName && el.tagName.toLowerCase() === 'a'){
        el.setAttribute('href', TARGET);
      }
    });
  }

  function captureReturnClick(ev){
    const el = ev.target && ev.target.closest
      ? ev.target.closest('a,button,[role="button"]')
      : null;

    if(!el) return;
    if(!isReturnButton(el)) return;

    ev.preventDefault();
    ev.stopPropagation();

    if(ev.stopImmediatePropagation){
      ev.stopImmediatePropagation();
    }

    goTarget('captured-return-click');

    return false;
  }

  document.addEventListener('click', captureReturnClick, true);
  document.addEventListener('pointerup', captureReturnClick, true);
  document.addEventListener('touchend', captureReturnClick, { capture:true, passive:false });

  function boot(){
    markReturnButtons();

    try{
      localStorage.setItem('GJ_GATE_PRE_CORE_PATH_LOCK_LAST', JSON.stringify({
        patch: PATCH,
        target: TARGET,
        current: location.href,
        at: new Date().toISOString()
      }));
    }catch(_){}

    console.log('[GoodJunk cooldown pre-core path lock]', TARGET);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

  setTimeout(markReturnButtons, 120);
  setTimeout(markReturnButtons, 400);
  setTimeout(markReturnButtons, 900);
  setTimeout(markReturnButtons, 1800);
})();
