/* =========================================================
   HeroHealth Food Groups Launcher
   PATCH: v20260522-groups-vr-hard-start-override-02
   File: /herohealth/patches/groups/groups-vr-hard-start-override.js

   Purpose:
   - Hard override launcher start button
   - Remove old click handlers by cloning #startBtn
   - Start from groups-vr.html must go directly to Groups Solo run
   - Never return to groups-vr.html when pressing Start
   - Add skipIntro/autostart/nointro for groups.html
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260522-groups-vr-hard-start-override-02';

  if (window.__HHA_GROUPS_VR_HARD_START_OVERRIDE_02__) return;
  window.__HHA_GROUPS_VR_HARD_START_OVERRIDE_02__ = true;

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

  var RUN = HERO + '/vr-groups/groups.html';
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

    var mode =
      s.mode ||
      activeAttr('[data-mode]', 'data-mode', 'solo');

    var view =
      s.view ||
      activeAttr('[data-view]', 'data-view', qs.get('view') || '');

    var variant =
      s.variant ||
      activeAttr('[data-variant]', 'data-variant', 'arena');

    return {
      mode: String(mode || 'solo').toLowerCase(),
      view: normalizeView(view),
      variant: String(variant || 'arena').toLowerCase()
    };
  }

  function buildZoneUrl(view){
    var out = new URL(ZONE);

    [
      'pid',
      'name',
      'studentId',
      'studentName',
      'classSection',
      'studyId',
      'conditionGroup',
      'api',
      'log',
      'qa',
      'debug',
      'teacher'
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

  function buildRunUrl(extra){
    var st = launcherState();
    var out = new URL(RUN);
    var zoneUrl = buildZoneUrl(st.view);

    [
      'pid',
      'name',
      'studentId',
      'studentName',
      'classSection',
      'studyId',
      'conditionGroup',
      'api',
      'log',
      'qa',
      'debug',
      'teacher'
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

    out.searchParams.set('entry', 'groups-vr-hard-start');
    out.searchParams.set('from', 'groups-vr');
    out.searchParams.set('theme', 'food-groups');

    /*
      สำคัญ:
      บอก groups.html ว่าไม่ต้องโชว์หน้า intro ซ้ำ
    */
    out.searchParams.set('skipIntro', '1');
    out.searchParams.set('autostart', '1');
    out.searchParams.set('nointro', '1');
    out.searchParams.set('direct', '1');
    out.searchParams.set('intro', '0');

    out.searchParams.set('hub', getParam('hub', zoneUrl));
    out.searchParams.set('back', getParam('back', zoneUrl));
    out.searchParams.set('return', getParam('return', zoneUrl));
    out.searchParams.set('returnTo', getParam('returnTo', zoneUrl));

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

    Object.entries(extra || {}).forEach(function(pair){
      var k = pair[0];
      var v = pair[1];

      if (v === null || v === undefined) out.searchParams.delete(k);
      else out.searchParams.set(k, String(v));
    });

    return out.toString();
  }

  function toast(message){
    var box = document.querySelector('.hha-hard-start-toast');

    if (!box) {
      box = document.createElement('div');
      box.className = 'hha-hard-start-toast';
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

    clearTimeout(window.__HHA_GROUPS_HARD_START_TOAST_TIMER__);
    window.__HHA_GROUPS_HARD_START_TOAST_TIMER__ = setTimeout(function(){
      box.style.opacity = '0';
      box.style.transform = 'translateX(-50%) translateY(14px)';
    }, 1200);
  }

  function isStartButtonText(t){
    t = String(t || '');

    return (
      t.indexOf('เริ่มเล่น') >= 0 ||
      t.indexOf('Start') >= 0 ||
      t.indexOf('Play') >= 0
    );
  }

  function findStartButton(){
    var byId = document.getElementById('startBtn');
    if (byId) return byId;

    var all = Array.prototype.slice.call(document.querySelectorAll('button,a,[role="button"],.btn,div,span'));

    return all.find(function(el){
      var txt = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      var r = el.getBoundingClientRect();

      return isStartButtonText(txt) && r.width > 40 && r.height > 25;
    }) || null;
  }

  function replaceStartButton(){
    var oldBtn = findStartButton();
    if (!oldBtn) return false;

    if (oldBtn.getAttribute('data-hha-hard-start') === PATCH_ID) return true;

    var newBtn = oldBtn.cloneNode(true);

    newBtn.removeAttribute('onclick');
    newBtn.setAttribute('data-hha-hard-start', PATCH_ID);
    newBtn.setAttribute('role', 'button');
    newBtn.setAttribute('tabindex', '0');

    if (newBtn.tagName === 'A') {
      newBtn.setAttribute('href', '#start-groups-direct');
    }

    newBtn.disabled = false;
    newBtn.textContent = 'เริ่มเล่น';

    newBtn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();

      if (typeof ev.stopImmediatePropagation === 'function') {
        ev.stopImmediatePropagation();
      }

      startDirect('hard-start-click');

      return false;
    }, true);

    newBtn.addEventListener('keydown', function(ev){
      if (ev.key !== 'Enter' && ev.key !== ' ') return;

      ev.preventDefault();
      ev.stopPropagation();

      if (typeof ev.stopImmediatePropagation === 'function') {
        ev.stopImmediatePropagation();
      }

      startDirect('hard-start-key');

      return false;
    }, true);

    oldBtn.parentNode.replaceChild(newBtn, oldBtn);

    return true;
  }

  function replaceCopyButton(){
    var oldBtn = document.getElementById('copyBtn');
    if (!oldBtn) return;

    if (oldBtn.getAttribute('data-hha-hard-copy') === PATCH_ID) return;

    var newBtn = oldBtn.cloneNode(true);
    newBtn.removeAttribute('onclick');
    newBtn.setAttribute('data-hha-hard-copy', PATCH_ID);

    newBtn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();

      if (typeof ev.stopImmediatePropagation === 'function') {
        ev.stopImmediatePropagation();
      }

      var url = buildRunUrl();

      try {
        navigator.clipboard.writeText(url);
        toast('คัดลอกลิงก์เข้าเกมโดยตรงแล้ว');
      } catch(e) {
        toast(url);
      }

      return false;
    }, true);

    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
  }

  function startDirect(reason){
    var st = launcherState();

    if (st.mode !== 'solo') {
      toast('โหมด Multiplayer ยังเป็น TEST');
      return;
    }

    if (['arena','practice'].indexOf(st.variant) < 0) {
      toast('โหมดนี้เตรียมทำต่อ');
      return;
    }

    var url = buildRunUrl({
      startReason: reason || 'hard-start',
      t: Date.now()
    });

    try {
      sessionStorage.setItem('HHA_GROUPS_DIRECT_START_URL', url);
      sessionStorage.setItem('HHA_GROUPS_DIRECT_START_STATE', JSON.stringify(st));
    } catch(e) {}

    console.info('[Groups Hard Start Override]', PATCH_ID, {
      reason: reason,
      state: st,
      url: url
    });

    toast('กำลังเข้าเกม...');

    setTimeout(function(){
      location.assign(url);
    }, 60);
  }

  function updateDebugUrl(){
    var debug = document.getElementById('debugUrl');
    if (debug) debug.textContent = buildRunUrl();
  }

  function patch(){
    replaceStartButton();
    replaceCopyButton();
    updateDebugUrl();
  }

  function boot(){
    patch();

    setTimeout(patch, 200);
    setTimeout(patch, 700);
    setTimeout(patch, 1400);

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_HARD_START_SCAN_TIMER__);
      window.__HHA_GROUPS_HARD_START_SCAN_TIMER__ = setTimeout(patch, 80);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','disabled','href','style']
    });

    console.info('[HeroHealth Groups Launcher]', PATCH_ID, 'ready', {
      run: RUN
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
