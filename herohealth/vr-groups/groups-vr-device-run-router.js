/* =========================================================
   HeroHealth Groups Launcher Device Run Router
   PATCH: v20260524-groups-vr-device-run-router-cvr-standalone-02
   File: /herohealth/patches/groups/groups-vr-device-run-router.js

   Purpose:
   - Hard route Groups launcher Start button by selected device
   - PC        -> /herohealth/vr-groups/groups-pc.html
   - Mobile    -> /herohealth/vr-groups/groups-mobile.html
   - Cardboard -> /herohealth/vr-groups/groups-cvr.html
   - Prevent old launcher handlers from sending user back to mode page
   - Keep Solo only active for now; multiplayer cards remain "เตรียมทำต่อ"
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260524-groups-vr-device-run-router-cvr-standalone-02';

  if (window.__HHA_GROUPS_VR_DEVICE_RUN_ROUTER_CVR_STANDALONE_02__) return;
  window.__HHA_GROUPS_VR_DEVICE_RUN_ROUTER_CVR_STANDALONE_02__ = true;

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
    cvr: HERO + '/vr-groups/groups-cvr.html'
  };

  var ZONE = HERO + '/nutrition-zone.html';
  var MODE = HERO + '/groups-vr.html';

  function getParam(name, fallback){
    var v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function textOf(el){
    return String(el && (
      el.innerText ||
      el.textContent ||
      (el.getAttribute && el.getAttribute('aria-label')) ||
      el.value ||
      ''
    ) || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function normalizeMode(v){
    var raw = String(v || '').toLowerCase();

    if (['solo','single','arena','practice'].indexOf(raw) >= 0) return 'solo';
    if (['race','battle','duet','coop','co-op','cooperative'].indexOf(raw) >= 0) return raw === 'co-op' ? 'coop' : raw;

    return 'solo';
  }

  function normalizeView(v){
    var raw = String(v || '').toLowerCase();

    if (['pc','desktop','notebook','laptop'].indexOf(raw) >= 0) return 'pc';
    if (['mobile','phone','touch','tablet'].indexOf(raw) >= 0) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr','cardboardvr'].indexOf(raw) >= 0) return 'cvr';

    return isMobileUA() ? 'mobile' : 'pc';
  }

  function normalizeVariant(v){
    var raw = String(v || '').toLowerCase();

    if (['arena','solo','main','play'].indexOf(raw) >= 0) return 'arena';
    if (['practice','train','training','ซ้อม'].indexOf(raw) >= 0) return 'practice';
    if (['challenge','hard'].indexOf(raw) >= 0) return 'challenge';
    if (['storm','storm-focus','stormfocus'].indexOf(raw) >= 0) return 'storm';

    return 'arena';
  }

  function activeAttr(selector, attr, fallback){
    var active =
      document.querySelector(selector + '.active') ||
      document.querySelector(selector + '.selected') ||
      document.querySelector(selector + '[aria-pressed="true"]') ||
      document.querySelector(selector + '[data-active="1"]');

    var val = active && active.getAttribute(attr);

    return val || fallback;
  }

  function inferModeFromCards(){
    var active =
      document.querySelector('[data-mode].active') ||
      document.querySelector('[data-mode].selected') ||
      document.querySelector('[data-mode][aria-pressed="true"]') ||
      document.querySelector('[data-mode][data-active="1"]');

    if (active) return active.getAttribute('data-mode');

    var all = Array.prototype.slice.call(document.querySelectorAll('[data-mode]'));

    var selected = all.find(function(el){
      var t = textOf(el);
      var r = el.getBoundingClientRect();

      return (
        r.width > 30 &&
        r.height > 30 &&
        (
          el.className && String(el.className).match(/active|selected|ready/i) ||
          t.indexOf('พร้อมเล่น') >= 0
        )
      );
    });

    return selected && selected.getAttribute('data-mode') || null;
  }

  function inferViewFromCards(){
    var active =
      document.querySelector('[data-view].active') ||
      document.querySelector('[data-view].selected') ||
      document.querySelector('[data-view][aria-pressed="true"]') ||
      document.querySelector('[data-view][data-active="1"]');

    if (active) return active.getAttribute('data-view');

    var all = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));

    var selected = all.find(function(el){
      var t = textOf(el);
      var r = el.getBoundingClientRect();

      return (
        r.width > 30 &&
        r.height > 30 &&
        (
          el.className && String(el.className).match(/active|selected|ready/i) ||
          t.indexOf('พร้อมเล่น') >= 0
        )
      );
    });

    return selected && selected.getAttribute('data-view') || null;
  }

  function inferVariantFromCards(){
    var active =
      document.querySelector('[data-variant].active') ||
      document.querySelector('[data-variant].selected') ||
      document.querySelector('[data-variant][aria-pressed="true"]') ||
      document.querySelector('[data-variant][data-active="1"]');

    if (active) return active.getAttribute('data-variant');

    var all = Array.prototype.slice.call(document.querySelectorAll('[data-variant]'));

    var selected = all.find(function(el){
      var t = textOf(el);
      var r = el.getBoundingClientRect();

      return (
        r.width > 30 &&
        r.height > 30 &&
        (
          el.className && String(el.className).match(/active|selected|ready/i) ||
          t.indexOf('พร้อมเล่น') >= 0
        )
      );
    });

    return selected && selected.getAttribute('data-variant') || null;
  }

  function launcherState(){
    var s =
      window.HHA_GROUPS_LAUNCHER &&
      window.HHA_GROUPS_LAUNCHER.state ||
      {};

    var mode =
      s.mode ||
      inferModeFromCards() ||
      activeAttr('[data-mode]', 'data-mode', qs.get('mode') || 'solo');

    var view =
      s.view ||
      inferViewFromCards() ||
      activeAttr('[data-view]', 'data-view', qs.get('view') || '');

    var variant =
      s.variant ||
      inferVariantFromCards() ||
      activeAttr('[data-variant]', 'data-variant', qs.get('variant') || 'arena');

    return {
      mode: normalizeMode(mode),
      view: normalizeView(view),
      variant: normalizeVariant(variant)
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

  function buildModeUrl(view){
    var out = new URL(MODE);

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
    out.searchParams.set('mode', 'solo');
    out.searchParams.set('variant', 'arena');

    out.searchParams.set('hub', getParam('hub', buildZoneUrl(view || 'pc')));

    return out.toString();
  }

  function buildRunUrl(extra){
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

    if (st.view === 'pc') {
      out.searchParams.set('device', 'pc');
      out.searchParams.set('input', 'mouse-keyboard');
      out.searchParams.delete('cvr');
      out.searchParams.delete('vr');
      out.searchParams.delete('cvrShell');
    }

    if (st.view === 'mobile') {
      out.searchParams.set('device', 'mobile');
      out.searchParams.set('input', 'touch');
      out.searchParams.delete('cvr');
      out.searchParams.delete('vr');
      out.searchParams.delete('cvrShell');
    }

    if (st.view === 'cvr') {
      out.searchParams.set('device', 'cvr');
      out.searchParams.set('cvr', '1');
      out.searchParams.set('vr', '1');
      out.searchParams.set('input', 'tap-scan');
      out.searchParams.set('cvrShell', 'standalone');
    }

    out.searchParams.set('seed', String(Date.now()));
    out.searchParams.set('t', String(Date.now()));

    Object.entries(extra || {}).forEach(function(pair){
      var k = pair[0];
      var v = pair[1];

      if (v === null || v === undefined) out.searchParams.delete(k);
      else out.searchParams.set(k, String(v));
    });

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
    }, 1200);
  }

  function markSelectedCard(el, groupSelector){
    if (!el) return;

    document.querySelectorAll(groupSelector).forEach(function(x){
      x.classList.remove('active');
      x.classList.remove('selected');
      x.removeAttribute('aria-pressed');
      x.removeAttribute('data-active');
    });

    el.classList.add('active');
    el.classList.add('selected');
    el.setAttribute('aria-pressed', 'true');
    el.setAttribute('data-active', '1');
  }

  function bindSelectionCards(){
    if (document.__hhaGroupsRouterSelectionBound) return;
    document.__hhaGroupsRouterSelectionBound = true;

    document.addEventListener('click', function(ev){
      var modeCard = ev.target && ev.target.closest && ev.target.closest('[data-mode]');
      var viewCard = ev.target && ev.target.closest && ev.target.closest('[data-view]');
      var variantCard = ev.target && ev.target.closest && ev.target.closest('[data-variant]');

      if (modeCard) {
        markSelectedCard(modeCard, '[data-mode]');
        updateReadyPanel();
      }

      if (viewCard) {
        markSelectedCard(viewCard, '[data-view]');
        updateReadyPanel();
      }

      if (variantCard) {
        markSelectedCard(variantCard, '[data-variant]');
        updateReadyPanel();
      }
    }, true);
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

  function updateReadyPanel(){
    var st = launcherState();

    var title =
      st.view === 'pc' ? 'พร้อมเริ่ม: Solo Arena • PC' :
      st.view === 'mobile' ? 'พร้อมเริ่ม: Solo Arena • Mobile' :
      'พร้อมเริ่ม: Solo Arena • Cardboard VR';

    var detail =
      st.view === 'pc'
        ? 'ระบบจะเปิด /herohealth/vr-groups/groups-pc.html'
        : st.view === 'mobile'
          ? 'ระบบจะเปิด /herohealth/vr-groups/groups-mobile.html'
          : 'ระบบจะเปิด /herohealth/vr-groups/groups-cvr.html';

    var readyTitle =
      document.getElementById('readyTitle') ||
      document.querySelector('[data-ready-title]');

    var readyDetail =
      document.getElementById('readyDetail') ||
      document.querySelector('[data-ready-detail]');

    if (readyTitle) readyTitle.textContent = title;
    if (readyDetail) readyDetail.textContent = detail;

    updateDebugUrl();
  }

  function startDirect(reason){
    var st = launcherState();

    if (st.mode !== 'solo') {
      toast('Multiplayer ยังเตรียมทำต่อ ตอนนี้เปิด Solo ก่อน');
      return;
    }

    if (['arena','practice'].indexOf(st.variant) < 0) {
      toast('โหมดนี้เตรียมทำต่อ หลังปิด Solo ให้ครบ');
      return;
    }

    var url = buildRunUrl({
      startReason: reason || 'start'
    });

    try {
      sessionStorage.setItem('HHA_GROUPS_DEVICE_ROUTER_START_URL', url);
      sessionStorage.setItem('HHA_GROUPS_DEVICE_ROUTER_STATE', JSON.stringify(st));
    } catch(e) {}

    console.info('[HeroHealth Groups Launcher]', PATCH_ID, {
      reason: reason,
      state: st,
      url: url
    });

    toast(
      st.view === 'cvr'
        ? 'กำลังเข้า Cardboard/cVR...'
        : st.view === 'mobile'
          ? 'กำลังเข้า Mobile...'
          : 'กำลังเข้า PC...'
    );

    setTimeout(function(){
      location.assign(url);
    }, 80);
  }

  function patch(){
    bindSelectionCards();
    replaceStartButton();
    patchCopyButton();
    updateReadyPanel();
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
      attributeFilter:['class','disabled','href','style','aria-pressed','data-active']
    });

    window.HHA_GROUPS_DEVICE_RUN_ROUTER = {
      patch: PATCH_ID,
      base: BASE,
      hero: HERO,
      runs: RUNS,
      buildRunUrl: buildRunUrl,
      buildZoneUrl: buildZoneUrl,
      buildModeUrl: buildModeUrl,
      state: launcherState,
      start: startDirect
    };

    console.info('[HeroHealth Groups Launcher]', PATCH_ID, 'ready', {
      pc: RUNS.pc,
      mobile: RUNS.mobile,
      cvr: RUNS.cvr,
      currentState: launcherState()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();