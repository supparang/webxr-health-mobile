/* =========================================================
   HeroHealth Groups Launcher Device Run Router
   PATCH: v20260522-groups-vr-device-run-router-01
   File: /herohealth/patches/groups/groups-vr-device-run-router.js
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260522-groups-vr-device-run-router-01';

  if (window.__HHA_GROUPS_VR_DEVICE_RUN_ROUTER_01__) return;
  window.__HHA_GROUPS_VR_DEVICE_RUN_ROUTER_01__ = true;

  var qs = new URLSearchParams(location.search);

  function repoBase(){
    var path = location.pathname;
    var marker = '/herohealth/';
    var idx = path.indexOf(marker);
    if (idx >= 0) return location.origin + path.slice(0, idx);
    return location.origin + '/webxr-health-mobile';
  }

  var BASE = repoBase();
  var HERO = BASE + '/herohealth';

  var RUNS = {
    pc: HERO + '/vr-groups/groups-pc.html',
    mobile: HERO + '/vr-groups/groups-mobile.html',
    cvr: HERO + '/vr-groups/groups.html'
  };

  var ZONE = HERO + '/nutrition-zone.html';

  function getParam(name, fallback){
    var v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function normalizeView(v){
    var raw = String(v || '').toLowerCase();

    if (['pc','desktop','notebook','laptop'].indexOf(raw) >= 0) return 'pc';
    if (['mobile','phone','touch','tablet'].indexOf(raw) >= 0) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].indexOf(raw) >= 0) return 'cvr';

    return isMobileUA() ? 'mobile' : 'pc';
  }

  function textOf(el){
    return String(el && (
      el.innerText ||
      el.textContent ||
      (el.getAttribute && el.getAttribute('aria-label')) ||
      el.value ||
      ''
    ) || '').replace(/\s+/g, ' ').trim();
  }

  function activeAttr(selector, attr, fallback){
    var active = document.querySelector(selector + '.active');
    var val = active && active.getAttribute(attr);
    return val || fallback;
  }

  function launcherState(){
    var s =
      window.HHA_GROUPS_LAUNCHER &&
      window.HHA_GROUPS_LAUNCHER.state ||
      {};

    return {
      mode: String(s.mode || activeAttr('[data-mode]', 'data-mode', 'solo') || 'solo').toLowerCase(),
      view: normalizeView(s.view || activeAttr('[data-view]', 'data-view', qs.get('view') || 'pc')),
      variant: String(s.variant || activeAttr('[data-variant]', 'data-variant', 'arena') || 'arena').toLowerCase()
    };
  }

  function buildZoneUrl(view){
    var out = new URL(ZONE);

    [
      'pid','name','studentId','studentName','classSection',
      'studyId','conditionGroup','api','log','qa','debug','teacher'
    ].forEach(function(k){
      var v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('pid', getParam('pid', 'anon'));
    out.searchParams.set('name', getParam('name', 'Hero'));
    out.searchParams.set('diff', getParam('diff', 'normal'));
    out.searchParams.set('time', getParam('time', '90'));
    out.searchParams.set('view', view || 'pc');
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'groups');
    out.searchParams.set('gameId', 'groups');

    return out.toString();
  }

  function buildRunUrl(){
    var st = launcherState();
    var runBase = RUNS[st.view] || RUNS.pc;
    var out = new URL(runBase);
    var zoneUrl = buildZoneUrl(st.view);

    [
      'pid','name','studentId','studentName','classSection',
      'studyId','conditionGroup','api','log','qa','debug','teacher'
    ].forEach(function(k){
      var v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('pid', getParam('pid', 'anon'));
    out.searchParams.set('name', getParam('name', 'Hero'));

    out.searchParams.set('mode', 'solo');
    out.searchParams.set('variant', st.variant);
    out.searchParams.set('view', st.view);
    out.searchParams.set('run', 'play');
    if (st.view === 'cvr') {
     out.searchParams.set('cvr', '1');
     out.searchParams.set('vr', '1');
     out.searchParams.set('device', 'cvr');
     out.searchParams.set('cvrShell', '1');
     out.searchParams.set('input', 'gaze');
      }

    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'groups');
    out.searchParams.set('gameId', 'groups');

    out.searchParams.set('entry', 'groups-vr-device-router');
    out.searchParams.set('from', 'groups-vr');
    out.searchParams.set('theme', 'food-groups');

    out.searchParams.set('hub', getParam('hub', zoneUrl));
    out.searchParams.set('back', getParam('back', zoneUrl));
    out.searchParams.set('return', getParam('return', zoneUrl));
    out.searchParams.set('returnTo', getParam('returnTo', zoneUrl));

    out.searchParams.set('skipIntro', '1');
    out.searchParams.set('nointro', '1');
    out.searchParams.set('autostart', '1');
    out.searchParams.set('direct', '1');
    out.searchParams.set('intro', '0');
    out.searchParams.set('startFix', '1');

    if (st.variant === 'practice') {
      out.searchParams.set('diff', 'easy');
      out.searchParams.set('time', getParam('time', '120'));
      out.searchParams.set('assist', '1');
      out.searchParams.set('practice', '1');
    } else {
      out.searchParams.set('diff', getParam('diff', 'normal'));
      out.searchParams.set('time', getParam('time', '90'));
    }

    out.searchParams.set('seed', String(Date.now()));
    out.searchParams.set('t', String(Date.now()));

    return out.toString();
  }

  function toast(message){
    var box = document.querySelector('.hha-device-router-toast');

    if (!box) {
      box = document.createElement('div');
      box.className = 'hha-device-router-toast';
      box.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:calc(18px + env(safe-area-inset-bottom,0px))',
        'transform:translateX(-50%) translateY(14px)',
        'z-index:1000001',
        'width:min(92vw,560px)',
        'padding:12px 16px',
        'border-radius:20px',
        'background:rgba(21,48,74,.94)',
        'color:white',
        'text-align:center',
        'font:900 14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
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

    clearTimeout(window.__HHA_DEVICE_ROUTER_TOAST_TIMER__);
    window.__HHA_DEVICE_ROUTER_TOAST_TIMER__ = setTimeout(function(){
      box.style.opacity = '0';
      box.style.transform = 'translateX(-50%) translateY(14px)';
    }, 1100);
  }

  function findStartButton(){
    var byId = document.getElementById('startBtn');
    if (byId) return byId;

    var all = Array.prototype.slice.call(
      document.querySelectorAll('button,a,[role="button"],.btn,div,span')
    );

    return all.find(function(el){
      var t = textOf(el);
      var r = el.getBoundingClientRect();

      return (
        r.width > 40 &&
        r.height > 25 &&
        (
          t === 'เริ่มเล่น' ||
          t.indexOf('เริ่มเล่น') >= 0 ||
          t.indexOf('Start') >= 0 ||
          t.indexOf('Play') >= 0
        )
      );
    }) || null;
  }

  function replaceStartButton(){
    var oldBtn = findStartButton();
    if (!oldBtn) return false;

    if (oldBtn.getAttribute('data-hha-device-router') === PATCH_ID) return true;

    var newBtn = oldBtn.cloneNode(true);

    newBtn.removeAttribute('onclick');
    newBtn.setAttribute('data-hha-device-router', PATCH_ID);
    newBtn.setAttribute('role', 'button');
    newBtn.setAttribute('tabindex', '0');

    if (newBtn.tagName === 'A') {
      newBtn.setAttribute('href', '#start-groups-device-router');
    }

    newBtn.disabled = false;
    newBtn.textContent = 'เริ่มเล่น';

    newBtn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      startDirect('click');
      return false;
    }, true);

    newBtn.addEventListener('keydown', function(ev){
      if (ev.key !== 'Enter' && ev.key !== ' ') return;

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      startDirect('key');
      return false;
    }, true);

    oldBtn.parentNode.replaceChild(newBtn, oldBtn);

    return true;
  }

  function patchCopyButton(){
    var oldBtn = document.getElementById('copyBtn');
    if (!oldBtn) return;
    if (oldBtn.getAttribute('data-hha-device-router-copy') === PATCH_ID) return;

    var newBtn = oldBtn.cloneNode(true);
    newBtn.removeAttribute('onclick');
    newBtn.setAttribute('data-hha-device-router-copy', PATCH_ID);

    newBtn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      var url = buildRunUrl();

      try {
        navigator.clipboard.writeText(url);
        toast('คัดลอกลิงก์เข้าเกมแล้ว');
      } catch(e) {
        toast(url);
      }

      return false;
    }, true);

    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
  }

  function updateDebugUrl(){
    var debug = document.getElementById('debugUrl');
    if (debug) debug.textContent = buildRunUrl();
  }

  function startDirect(reason){
    var st = launcherState();

    if (st.mode !== 'solo') {
      toast('Multiplayer ยังเป็น TEST ตอนนี้ปิด Solo ก่อน');
      return;
    }

    if (['arena','practice'].indexOf(st.variant) < 0) {
      toast('โหมดนี้เตรียมทำต่อ');
      return;
    }

    var url = buildRunUrl();

    try {
      sessionStorage.setItem('HHA_GROUPS_DEVICE_ROUTER_START_URL', url);
      sessionStorage.setItem('HHA_GROUPS_DEVICE_ROUTER_STATE', JSON.stringify(st));
    } catch(e) {}

    console.info('[HeroHealth Groups Launcher]', PATCH_ID, {
      reason: reason,
      state: st,
      url: url
    });

    toast('กำลังเข้าเกม...');

    setTimeout(function(){
      location.assign(url);
    }, 60);
  }

  function patch(){
    replaceStartButton();
    patchCopyButton();
    updateDebugUrl();
  }

  function boot(){
    patch();

    setTimeout(patch, 150);
    setTimeout(patch, 500);
    setTimeout(patch, 1100);
    setTimeout(patch, 1800);

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_DEVICE_ROUTER_SCAN_TIMER__);
      window.__HHA_DEVICE_ROUTER_SCAN_TIMER__ = setTimeout(patch, 70);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','disabled','href','style']
    });

    console.info('[HeroHealth Groups Launcher]', PATCH_ID, 'ready', {
      pc: RUNS.pc,
      mobile: RUNS.mobile,
      cvr: RUNS.cvr
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
