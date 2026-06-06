/* === /herohealth/goodjunk-pc-mobile-cooldown-precore-path-lock.js === */
/* FULL PATCH v20260606-precore-final
   Purpose:
   - ใช้เฉพาะ /herohealth/warmup-gate.html
   - ทำงานเฉพาะ game=goodjunk + phase=cooldown
   - บังคับ next/back/hub/return/done/cdnext ให้กลับ /herohealth/goodjunk-launcher.html
   - ต้องโหลดก่อน gate-core.js
*/

(function(){
  'use strict';

  const PATCH = 'v20260606-precore-final';

  if(window.HHA_GJ_PRECORE_PATH_LOCK_LOADED){
    return;
  }
  window.HHA_GJ_PRECORE_PATH_LOCK_LOADED = true;

  const GOODJUNK_LAUNCHER =
    'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';

  const qs = new URLSearchParams(location.search || '');

  function val(name, fallback){
    const v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function isGoodJunkCooldown(){
    const game = String(
      qs.get('game') ||
      qs.get('gameId') ||
      qs.get('theme') ||
      ''
    ).toLowerCase();

    const phase = String(
      qs.get('phase') ||
      qs.get('gatePhase') ||
      ''
    ).toLowerCase();

    return game === 'goodjunk' && phase === 'cooldown';
  }

  if(!isGoodJunkCooldown()){
    return;
  }

  function normalizeGoodJunkPath(url){
    let s = String(url || '');

    s = s.replace(
      'https://supparang.github.io/webxr-health-mobile/goodjunk-launcher.html',
      GOODJUNK_LAUNCHER
    );

    s = s.replace(
      '/webxr-health-mobile/goodjunk-launcher.html',
      '/webxr-health-mobile/herohealth/goodjunk-launcher.html'
    );

    s = s.replace(
      '/herohealth/herohealth/goodjunk-launcher.html',
      '/herohealth/goodjunk-launcher.html'
    );

    s = s.replace(
      'https://supparang.github.io/webxr-health-mobile/herohealth/herohealth/goodjunk-launcher.html',
      GOODJUNK_LAUNCHER
    );

    return s;
  }

  function launcherUrl(){
    const u = new URL(GOODJUNK_LAUNCHER);

    u.searchParams.set('pid', val('pid', 'anon'));
    u.searchParams.set('name', val('name', val('nick', 'Hero')));
    u.searchParams.set('diff', val('diff', 'normal'));
    u.searchParams.set('time', val('time', '120'));
    u.searchParams.set('view', val('view', 'mobile'));

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'cooldown-return');
    u.searchParams.set('theme', 'goodjunk');

    [
      'studyId',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api',
      'seed'
    ].forEach(function(k){
      const v = qs.get(k);
      if(v) u.searchParams.set(k, v);
    });

    return normalizeGoodJunkPath(u.toString());
  }

  const TARGET = launcherUrl();

  [
    'next',
    'back',
    'hub',
    'launcher',
    'return',
    'returnTo',
    'returnUrl',
    'after',
    'done',
    'doneUrl',
    'cdnext'
  ].forEach(function(k){
    qs.set(k, TARGET);
  });

  qs.set('zone', 'nutrition');
  qs.set('cat', 'nutrition');
  qs.set('game', 'goodjunk');
  qs.set('gameId', 'goodjunk');
  qs.set('theme', 'goodjunk');
  qs.set('phase', 'cooldown');

  try{
    history.replaceState(
      null,
      '',
      location.pathname + '?' + qs.toString() + (location.hash || '')
    );
  }catch(e){}

  window.HH_GATE_FORCE_NEXT = TARGET;
  window.HH_GATE_FORCE_BACK = TARGET;
  window.HH_GATE_FORCE_HUB = TARGET;

  window.HHA_GATE_RETURN_URL = TARGET;
  window.HHA_GATE_DONE_URL = TARGET;
  window.HHA_NEXT_URL = TARGET;
  window.HHA_BACK_URL = TARGET;
  window.HHA_HUB_URL = TARGET;
  window.HHA_GOODJUNK_COOLDOWN_TARGET = TARGET;

  if(window.HHA_GATE_BOOT){
    window.HHA_GATE_BOOT.nextHref = TARGET;
    window.HHA_GATE_BOOT.backHref = TARGET;
    window.HHA_GATE_BOOT.hubHref = TARGET;
    window.HHA_GATE_BOOT.goodjunkCooldownTarget = TARGET;
    window.HHA_GATE_BOOT.goodjunkPrecorePatch = PATCH;
  }

  function go(reason){
    try{
      localStorage.setItem('HHA_GJ_PRECORE_PATH_LOCK_LAST', JSON.stringify({
        patch: PATCH,
        target: TARGET,
        reason: reason || '',
        savedAt: new Date().toISOString()
      }));
    }catch(e){}

    location.replace(TARGET);
  }

  window.goDone = function(){ go('goDone'); };
  window.goNext = function(){ go('goNext'); };
  window.goBack = function(){ go('goBack'); };
  window.goHub = function(){ go('goHub'); };
  window.finishGate = function(){ go('finishGate'); };
  window.finishCooldown = function(){ go('finishCooldown'); };
  window.completeCooldown = function(){ go('completeCooldown'); };
  window.HHA_GATE_GO_NEXT = function(){ go('HHA_GATE_GO_NEXT'); };
  window.HHA_GATE_GO_BACK = function(){ go('HHA_GATE_GO_BACK'); };
  window.HHA_GATE_GO_HUB = function(){ go('HHA_GATE_GO_HUB'); };

  function labelOf(el){
    return String(
      el && (
        el.textContent ||
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        ''
      ) || ''
    ).replace(/\s+/g, ' ').trim();
  }

  function isReturnControl(el){
    if(!el || !el.closest) return false;

    const btn = el.closest('a,button,[role="button"]');
    if(!btn) return false;

    const label = labelOf(btn);
    const href = String(btn.getAttribute && btn.getAttribute('href') || '');

    return (
      label.includes('กลับ') ||
      label.includes('ไปต่อ') ||
      label.includes('เสร็จ') ||
      label.includes('จบ') ||
      label.includes('Home') ||
      label.includes('Zone') ||
      label.includes('โหมด') ||
      label.includes('GoodJunk') ||
      href.includes('goodjunk-launcher.html') ||
      href.includes('hub.html') ||
      href.includes('nutrition-zone.html')
    );
  }

  function markLinks(){
    try{
      document.querySelectorAll('a,button,[role="button"]').forEach(function(el){
        if(!isReturnControl(el)) return;

        el.dataset.hhaGoodJunkCooldownTarget = 'launcher';

        if(el.tagName && el.tagName.toLowerCase() === 'a'){
          el.setAttribute('href', TARGET);
        }
      });
    }catch(e){}
  }

  document.addEventListener('click', function(ev){
    if(!isReturnControl(ev.target)) return;

    ev.preventDefault();
    ev.stopPropagation();
    if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

    go('captured-click');
    return false;
  }, true);

  window.addEventListener('pointerup', function(ev){
    if(!isReturnControl(ev.target)) return;

    ev.preventDefault();
    ev.stopPropagation();
    if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

    go('captured-pointerup');
    return false;
  }, true);

  window.addEventListener('touchend', function(ev){
    if(!isReturnControl(ev.target)) return;

    ev.preventDefault();
    ev.stopPropagation();
    if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

    go('captured-touchend');
    return false;
  }, { passive:false, capture:true });

  function boot(){
    markLinks();

    try{
      const mo = new MutationObserver(markLinks);
      mo.observe(document.documentElement, {
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:['href','class','style','data-action']
      });
    }catch(e){}

    setTimeout(markLinks, 80);
    setTimeout(markLinks, 300);
    setTimeout(markLinks, 900);
    setTimeout(markLinks, 1800);
    setTimeout(markLinks, 3000);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

  try{
    localStorage.setItem('HHA_GJ_PRECORE_PATH_LOCK_READY', JSON.stringify({
      patch: PATCH,
      target: TARGET,
      page: location.href,
      savedAt: new Date().toISOString()
    }));
  }catch(e){}

  console.info('[GoodJunk precore path lock]', PATCH, TARGET);
})();
