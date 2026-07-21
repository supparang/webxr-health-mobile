/* =========================================================
   HeroHealth Groups Launcher → Production AR Gameplay Router
   PATCH: v20260721-groups-production-gameplay-router-v2
   File: /herohealth/patches/groups/groups-vr-device-run-router.js
   Canonical flow:
   Launcher → Warmup Gate → Groups AR → Cooldown Gate → Nutrition Zone
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260721-groups-production-gameplay-router-v2';
  if (window.__HHA_GROUPS_PRODUCTION_GAMEPLAY_ROUTER_V2__) return;
  window.__HHA_GROUPS_PRODUCTION_GAMEPLAY_ROUTER_V2__ = true;

  var qs = new URLSearchParams(location.search);

  function repoBase(){
    var path = location.pathname;
    var marker = '/herohealth/';
    var index = path.indexOf(marker);
    if (index >= 0) return location.origin + path.slice(0, index);
    return location.origin + '/webxr-health-mobile';
  }

  var BASE = repoBase();
  var HERO = BASE + '/herohealth';
  var GATE = HERO + '/groups-ar-gate.html';
  var GAME = HERO + '/groups-ar.html';
  var ZONE = HERO + '/nutrition-zone.html';

  function getParam(name, fallback){
    var value = qs.get(name);
    return value === null || value === '' ? fallback : value;
  }

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function normalizeView(value){
    var raw = String(value || '').toLowerCase();
    if (['pc','desktop','notebook','laptop'].indexOf(raw) >= 0) return 'pc';
    if (['mobile','phone','touch','tablet'].indexOf(raw) >= 0) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].indexOf(raw) >= 0) return 'cvr';
    return isMobileUA() ? 'mobile' : 'pc';
  }

  function activeAttr(selector, attr, fallback){
    var active = document.querySelector(selector + '.active');
    var value = active && active.getAttribute(attr);
    return value || fallback;
  }

  function launcherState(){
    var state = window.HHA_GROUPS_LAUNCHER && window.HHA_GROUPS_LAUNCHER.state || {};
    return {
      mode: String(state.mode || activeAttr('[data-mode]', 'data-mode', 'solo') || 'solo').toLowerCase(),
      view: normalizeView(state.view || activeAttr('[data-view]', 'data-view', qs.get('view') || 'pc')),
      variant: String(state.variant || activeAttr('[data-variant]', 'data-variant', 'arena') || 'arena').toLowerCase()
    };
  }

  function copyIdentity(source, target){
    [
      'pid','name','studentId','studentName','section','classSection',
      'studyId','conditionGroup','debug','qa','teacher'
    ].forEach(function(key){
      var value = source.get(key);
      if (value !== null && value !== '') target.searchParams.set(key, value);
    });
  }

  function buildZoneUrl(view){
    var out = new URL(ZONE);
    copyIdentity(qs, out);
    out.searchParams.set('pid', getParam('pid', getParam('studentId', 'anon')));
    out.searchParams.set('name', getParam('name', getParam('studentName', 'Hero')));
    out.searchParams.set('view', view || 'pc');
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'groups');
    out.searchParams.set('gameId', 'groups');
    return out.toString();
  }

  function buildRunUrl(){
    var state = launcherState();
    var zoneUrl = buildZoneUrl(state.view);
    var out = new URL(GATE);

    copyIdentity(qs, out);
    out.searchParams.set('pid', getParam('pid', getParam('studentId', 'anon')));
    out.searchParams.set('name', getParam('name', getParam('studentName', 'Hero')));
    out.searchParams.set('phase', 'warmup');
    out.searchParams.set('next', GAME);
    out.searchParams.set('back', zoneUrl);
    out.searchParams.set('hub', zoneUrl);
    out.searchParams.set('view', state.view);
    out.searchParams.set('diff', state.variant === 'practice' ? 'easy' : getParam('diff', 'normal'));
    out.searchParams.set('variant', 'normal');
    out.searchParams.set('time', state.variant === 'practice' ? getParam('time', '360') : getParam('time', '300'));
    out.searchParams.set('game', 'groups');
    out.searchParams.set('gameId', 'groups');
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('entry', 'groups-production-gameplay-router-v2');
    out.searchParams.set('storage', 'local-only');
    out.searchParams.set('log', '0');
    out.searchParams.set('seed', String(Date.now()));

    return out.toString();
  }

  function toast(message){
    var box = document.querySelector('.hha-groups-production-toast');
    if (!box) {
      box = document.createElement('div');
      box.className = 'hha-groups-production-toast';
      box.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:calc(18px + env(safe-area-inset-bottom,0px))',
        'transform:translateX(-50%) translateY(14px)',
        'z-index:1000001',
        'width:min(92vw,560px)',
        'padding:12px 16px',
        'border-radius:20px',
        'background:rgba(21,74,57,.95)',
        'color:white',
        'text-align:center',
        'font:900 14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif',
        'box-shadow:0 18px 42px rgba(0,0,0,.24)',
        'opacity:0',
        'pointer-events:none',
        'transition:.18s ease'
      ].join(';');
      document.body.appendChild(box);
    }

    box.textContent = String(message || '');
    box.style.opacity = '1';
    box.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(window.__HHA_GROUPS_PRODUCTION_TOAST_TIMER__);
    window.__HHA_GROUPS_PRODUCTION_TOAST_TIMER__ = setTimeout(function(){
      box.style.opacity = '0';
      box.style.transform = 'translateX(-50%) translateY(14px)';
    }, 1300);
  }

  function findStartButton(){
    return document.getElementById('startBtn') || document.querySelector('[data-action="start"],.startBtn,.start-btn');
  }

  function startDirect(reason){
    var state = launcherState();

    if (state.mode !== 'solo') {
      toast('รอบ Production Gameplay นี้เปิด Solo ก่อน');
      return;
    }

    if (['arena','practice'].indexOf(state.variant) < 0) {
      toast('Variant นี้ยังไม่อยู่ในรอบ Production Gameplay');
      return;
    }

    var url = buildRunUrl();
    try {
      sessionStorage.setItem('HHA_GROUPS_PRODUCTION_START_URL', url);
      sessionStorage.setItem('HHA_GROUPS_PRODUCTION_START_STATE', JSON.stringify(state));
    } catch (_) {}

    console.info('[Groups Production Gameplay Router]', PATCH_ID, {
      reason: reason || 'start',
      state: state,
      url: url
    });

    toast('กำลังเข้า Warmup Groups AR…');
    setTimeout(function(){ location.assign(url); }, 80);
  }

  function patchStartButton(){
    var oldButton = findStartButton();
    if (!oldButton) return false;
    if (oldButton.getAttribute('data-groups-production-router') === PATCH_ID) return true;

    var newButton = oldButton.cloneNode(true);
    newButton.removeAttribute('onclick');
    newButton.setAttribute('data-groups-production-router', PATCH_ID);
    newButton.setAttribute('role', 'button');
    newButton.setAttribute('tabindex', '0');
    newButton.disabled = false;

    /* Avoid the legacy global listener that matches “เริ่มเล่น / Start / Play”. */
    newButton.textContent = '🥦 เข้า Groups AR';
    if (newButton.tagName === 'A') newButton.setAttribute('href', '#groups-production-ar');

    newButton.addEventListener('click', function(event){
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      startDirect('button-click');
      return false;
    }, true);

    newButton.addEventListener('keydown', function(event){
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      startDirect('button-key');
      return false;
    }, true);

    oldButton.parentNode.replaceChild(newButton, oldButton);
    return true;
  }

  function patchCopyButton(){
    var oldButton = document.getElementById('copyBtn');
    if (!oldButton || oldButton.getAttribute('data-groups-production-copy') === PATCH_ID) return;

    var newButton = oldButton.cloneNode(true);
    newButton.removeAttribute('onclick');
    newButton.setAttribute('data-groups-production-copy', PATCH_ID);
    newButton.addEventListener('click', function(event){
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      var url = buildRunUrl();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function(){
          toast('คัดลอกลิงก์ Warmup → Groups AR แล้ว');
        }).catch(function(){ toast(url); });
      } else {
        toast(url);
      }
      return false;
    }, true);
    oldButton.parentNode.replaceChild(newButton, oldButton);
  }

  function updateDebugUrl(){
    var debug = document.getElementById('debugUrl');
    if (debug) debug.textContent = buildRunUrl();
  }

  function patch(){
    patchStartButton();
    patchCopyButton();
    updateDebugUrl();
  }

  function boot(){
    patch();
    [120, 420, 900, 1600].forEach(function(delay){ setTimeout(patch, delay); });

    var observer = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_PRODUCTION_PATCH_TIMER__);
      window.__HHA_GROUPS_PRODUCTION_PATCH_TIMER__ = setTimeout(patch, 70);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class','disabled','href','style']
    });

    console.info('[Groups Production Gameplay Router]', PATCH_ID, 'ready', {
      gate: GATE,
      game: GAME,
      storage: 'local-only'
    });
  }

  window.HHA_GROUPS_PRODUCTION_ROUTER = {
    patch: PATCH_ID,
    buildRunUrl: buildRunUrl,
    start: startDirect
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
