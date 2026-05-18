// === /herohealth/plate-solo-final-lock.js ===
// HeroHealth Plate Solo — Final Lock Patch
// v20260514-PLATE-SOLO-FINAL-LOCK-COOLDOWN-NUTRITION-ZONE
// ✅ Patch เสริมหลัง plate-solo.js
// ✅ ล็อกปุ่ม Cooldown ให้เข้า warmup-gate.html?phase=cooldown
// ✅ หลัง cooldown กลับ Nutrition Zone ถูกที่
// ✅ ปุ่มกลับ Zone กลับ Nutrition Zone ถูกที่
// ✅ ใส่ next/hub/back/return/done/redirect ครบ เผื่อ warmup-gate อ่าน key คนละชื่อ
// ✅ DOM-safe / ไม่พังถ้าปุ่มบางตัวไม่มี

(function(){
  'use strict';

  var VERSION = '20260514-PLATE-SOLO-FINAL-LOCK-COOLDOWN-NUTRITION-ZONE';
  var DOC = window.document;
  var WIN = window;

  try {
    console.info('[Plate Solo Final Lock]', VERSION, 'loaded');
  } catch(e) {}

  var Q = new URL(location.href).searchParams;

  function qs(k, d){
    var v = Q.get(k);
    if (v === null || v === undefined || String(v).trim() === '') return d || '';
    return v;
  }

  function $(id){
    return DOC.getElementById(id);
  }

  function safeUrl(raw, fallback){
    try {
      return new URL(raw, location.href);
    } catch(e) {
      return new URL(fallback, location.href);
    }
  }

  var BASE = 'https://supparang.github.io/webxr-health-mobile';
  var HERO = BASE + '/herohealth';

  var HUB_URL = HERO + '/hub.html';
  var NUTRITION_ZONE_URL = HERO + '/nutrition-zone.html';
  var WARMUP_GATE_URL = HERO + '/warmup-gate.html';
  var PLATE_SOLO_URL = HERO + '/plate-solo.html';

  function setIfExists(url, key, value){
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      url.searchParams.set(key, value);
    }
  }

  function copyOptionalParams(url){
    [
      'seed',
      'studyId',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api',
      'cat',
      'theme',
      'variant'
    ].forEach(function(k){
      setIfExists(url, k, qs(k, ''));
    });
  }

  function hardNutritionZoneUrl(fromTag){
    var u = safeUrl(NUTRITION_ZONE_URL, NUTRITION_ZONE_URL);

    u.searchParams.set('pid', qs('pid', 'anon'));
    setIfExists(u, 'name', qs('name', qs('nick', 'Hero')));
    setIfExists(u, 'nick', qs('nick', qs('name', 'Hero')));

    u.searchParams.set('diff', qs('diff', 'normal'));
    u.searchParams.set('time', qs('time', '120'));
    u.searchParams.set('view', qs('view', 'mobile'));
    u.searchParams.set('run', 'play');

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'plate');
    u.searchParams.set('gameId', 'plate');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'plate-solo');
    u.searchParams.set('from', fromTag || 'plate-solo');

    // สำคัญ: หน้า Nutrition Zone ควรมี hub เป็น hub.html ไม่ใช่ plate หรือ warmup-gate
    u.searchParams.set('hub', HUB_URL);

    copyOptionalParams(u);

    return u;
  }

  function plateSoloUrl(fromTag){
    var u = safeUrl(PLATE_SOLO_URL, PLATE_SOLO_URL);

    u.searchParams.set('pid', qs('pid', 'anon'));
    setIfExists(u, 'name', qs('name', qs('nick', 'Hero')));
    setIfExists(u, 'nick', qs('nick', qs('name', 'Hero')));

    u.searchParams.set('diff', qs('diff', 'normal'));
    u.searchParams.set('time', qs('time', '120'));
    u.searchParams.set('view', qs('view', 'mobile'));
    u.searchParams.set('run', 'play');

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'plate');
    u.searchParams.set('gameId', 'plate');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'plate-solo');
    u.searchParams.set('from', fromTag || 'plate-solo-replay');

    u.searchParams.set('hub', NUTRITION_ZONE_URL);

    copyOptionalParams(u);

    return u;
  }

  function cooldownGateUrl(){
    var doneZone = hardNutritionZoneUrl('plate-solo-cooldown-done');

    var gate = safeUrl(WARMUP_GATE_URL, WARMUP_GATE_URL);

    gate.searchParams.set('pid', qs('pid', 'anon'));
    gate.searchParams.set('name', qs('name', qs('nick', 'Hero')));
    setIfExists(gate, 'nick', qs('nick', qs('name', 'Hero')));

    gate.searchParams.set('diff', qs('diff', 'normal'));
    gate.searchParams.set('time', qs('time', '120'));
    gate.searchParams.set('view', qs('view', 'mobile'));
    gate.searchParams.set('run', 'play');

    gate.searchParams.set('phase', 'cooldown');
    gate.searchParams.set('gate', 'cooldown');
    gate.searchParams.set('cooldown', '1');

    gate.searchParams.set('zone', 'nutrition');
    gate.searchParams.set('cat', 'nutrition');
    gate.searchParams.set('game', 'plate');
    gate.searchParams.set('gameId', 'plate');
    gate.searchParams.set('mode', 'solo');
    gate.searchParams.set('entry', 'plate-solo');
    gate.searchParams.set('from', 'plate-solo-summary');

    // HARD LOCK: warmup-gate แต่ละเวอร์ชันอาจอ่านคนละ key
    // จึงส่งกลับ Nutrition Zone ครบทุกชื่อที่เป็นไปได้
    gate.searchParams.set('next', doneZone.toString());
    gate.searchParams.set('hub', doneZone.toString());
    gate.searchParams.set('back', doneZone.toString());
    gate.searchParams.set('return', doneZone.toString());
    gate.searchParams.set('returnUrl', doneZone.toString());
    gate.searchParams.set('done', doneZone.toString());
    gate.searchParams.set('doneUrl', doneZone.toString());
    gate.searchParams.set('redirect', doneZone.toString());
    gate.searchParams.set('redirectUrl', doneZone.toString());
    gate.searchParams.set('after', doneZone.toString());
    gate.searchParams.set('afterUrl', doneZone.toString());

    copyOptionalParams(gate);

    // กัน cache / กัน gate ใช้ค่าเก่า
    gate.searchParams.set('v', VERSION + '-' + Date.now());

    return gate;
  }

  function goNutritionZone(fromTag){
    try {
      if (WIN.HHA_PLATE_FLUSH_LOGS && typeof WIN.HHA_PLATE_FLUSH_LOGS === 'function') {
        WIN.HHA_PLATE_FLUSH_LOGS(true);
      }
    } catch(e) {}

    location.href = hardNutritionZoneUrl(fromTag || 'plate-solo-back').toString();
  }

  function goCooldown(){
    try {
      if (WIN.HHA_PLATE_FLUSH_LOGS && typeof WIN.HHA_PLATE_FLUSH_LOGS === 'function') {
        WIN.HHA_PLATE_FLUSH_LOGS(true);
      }
    } catch(e) {}

    location.href = cooldownGateUrl().toString();
  }

  function goReplay(){
    location.href = plateSoloUrl('plate-solo-replay').toString();
  }

  function isCooldownButton(el){
    if (!el) return false;

    var id = String(el.id || '').toLowerCase();
    var txt = String(el.textContent || '').toLowerCase();
    var aria = String(el.getAttribute('aria-label') || '').toLowerCase();
    var data = String(el.getAttribute('data-action') || '').toLowerCase();

    return (
      id === 'btncooldown' ||
      id === 'cooldownbtn' ||
      id === 'cooldownbutton' ||
      id.indexOf('cooldown') >= 0 ||
      data === 'cooldown' ||
      txt.indexOf('cooldown') >= 0 ||
      txt.indexOf('คูลดาวน์') >= 0 ||
      txt.indexOf('ผ่อนคลาย') >= 0 ||
      aria.indexOf('cooldown') >= 0
    );
  }

  function isZoneButton(el){
    if (!el) return false;

    var id = String(el.id || '').toLowerCase();
    var txt = String(el.textContent || '').toLowerCase();
    var aria = String(el.getAttribute('aria-label') || '').toLowerCase();
    var data = String(el.getAttribute('data-action') || '').toLowerCase();

    return (
      id === 'btnsummaryback' ||
      id === 'nutritionsonebtn' ||
      id === 'nutritionzonebtn' ||
      id === 'btnzone' ||
      id === 'backbtn' ||
      id === 'btnback' ||
      data === 'zone' ||
      data === 'nutrition-zone' ||
      txt.indexOf('กลับ zone') >= 0 ||
      txt.indexOf('กลับโซน') >= 0 ||
      txt.indexOf('nutrition zone') >= 0 ||
      txt.indexOf('โภชนาการ') >= 0 ||
      aria.indexOf('nutrition') >= 0
    );
  }

  function isReplayButton(el){
    if (!el) return false;

    var id = String(el.id || '').toLowerCase();
    var txt = String(el.textContent || '').toLowerCase();
    var data = String(el.getAttribute('data-action') || '').toLowerCase();

    return (
      id === 'btnreplay' ||
      id === 'replaybtn' ||
      data === 'replay' ||
      txt.indexOf('เล่นอีกครั้ง') >= 0 ||
      txt.indexOf('replay') >= 0
    );
  }

  function hardBindButton(btn, actionName, handler){
    if (!btn || btn.__plateFinalLockBound) return;

    btn.__plateFinalLockBound = true;
    btn.setAttribute('data-plate-final-lock', actionName);

    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      handler();
      return false;
    }, true);
  }

  function normalizeButtonText(btn, actionName){
    if (!btn) return;

    if (actionName === 'cooldown') {
      if (!String(btn.textContent || '').trim()) {
        btn.textContent = '🧘 ทำ Cooldown';
      }
      btn.setAttribute('title', 'ทำ Cooldown แล้วกลับ Nutrition Zone');
    }

    if (actionName === 'zone') {
      if (!String(btn.textContent || '').trim()) {
        btn.textContent = '🥗 กลับ Nutrition Zone';
      }
      btn.setAttribute('title', 'กลับ Nutrition Zone');
    }

    if (actionName === 'replay') {
      if (!String(btn.textContent || '').trim()) {
        btn.textContent = '🔁 เล่นอีกครั้ง';
      }
      btn.setAttribute('title', 'เล่น Plate Solo อีกครั้ง');
    }
  }

  function bindKnownButtons(){
    [
      'btnCooldown',
      'cooldownBtn',
      'cooldownButton',
      'summaryCooldownBtn'
    ].forEach(function(id){
      var el = $(id);
      if (el) {
        normalizeButtonText(el, 'cooldown');
        hardBindButton(el, 'cooldown', goCooldown);
      }
    });

    [
      'btnSummaryBack',
      'nutritionZoneBtn',
      'btnZone',
      'btnBack',
      'backBtn',
      'zoneBtn'
    ].forEach(function(id){
      var el = $(id);
      if (el) {
        normalizeButtonText(el, 'zone');
        hardBindButton(el, 'zone', function(){
          goNutritionZone('plate-solo-back');
        });
      }
    });

    [
      'btnReplay',
      'replayBtn'
    ].forEach(function(id){
      var el = $(id);
      if (el) {
        normalizeButtonText(el, 'replay');
        hardBindButton(el, 'replay', goReplay);
      }
    });
  }

  function bindDynamicButtons(){
    var nodes = DOC.querySelectorAll('button, a, [role="button"]');

    Array.prototype.forEach.call(nodes, function(el){
      if (isCooldownButton(el)) {
        normalizeButtonText(el, 'cooldown');
        hardBindButton(el, 'cooldown', goCooldown);
        return;
      }

      if (isZoneButton(el)) {
        normalizeButtonText(el, 'zone');
        hardBindButton(el, 'zone', function(){
          goNutritionZone('plate-solo-back');
        });
        return;
      }

      if (isReplayButton(el)) {
        normalizeButtonText(el, 'replay');
        hardBindButton(el, 'replay', goReplay);
      }
    });
  }

  function ensureSummaryButtons(){
    var overlay =
      $('summaryOverlay') ||
      $('summaryModal') ||
      $('resultModal');

    if (!overlay) return;

    var footer =
      overlay.querySelector('.summaryActions') ||
      overlay.querySelector('.summary-actions') ||
      overlay.querySelector('.modal-actions') ||
      overlay.querySelector('.actions');

    if (!footer) {
      footer = DOC.createElement('div');
      footer.className = 'summaryActions plateFinalLockActions';
      overlay.appendChild(footer);
    }

    if (!$('btnCooldown') && !footer.querySelector('[data-plate-final-lock="cooldown"]')) {
      var cooldown = DOC.createElement('button');
      cooldown.id = 'btnCooldown';
      cooldown.className = 'btn primary';
      cooldown.type = 'button';
      cooldown.textContent = '🧘 ทำ Cooldown';
      footer.appendChild(cooldown);
    }

    if (!$('btnSummaryBack') && !footer.querySelector('[data-plate-final-lock="zone"]')) {
      var zone = DOC.createElement('button');
      zone.id = 'btnSummaryBack';
      zone.className = 'btn secondary';
      zone.type = 'button';
      zone.textContent = '🥗 กลับ Nutrition Zone';
      footer.appendChild(zone);
    }

    if (!$('btnReplay') && !footer.querySelector('[data-plate-final-lock="replay"]')) {
      var replay = DOC.createElement('button');
      replay.id = 'btnReplay';
      replay.className = 'btn ghost';
      replay.type = 'button';
      replay.textContent = '🔁 เล่นอีกครั้ง';
      footer.appendChild(replay);
    }
  }

  function installCaptureInterceptor(){
    if (DOC.__plateFinalLockCaptureInstalled) return;
    DOC.__plateFinalLockCaptureInstalled = true;

    DOC.addEventListener('click', function(ev){
      var target = ev.target;
      if (!target || !target.closest) return;

      var el = target.closest('button, a, [role="button"]');
      if (!el) return;

      if (isCooldownButton(el)) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        goCooldown();
        return false;
      }

      if (isZoneButton(el)) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        goNutritionZone('plate-solo-back');
        return false;
      }

      if (isReplayButton(el)) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        goReplay();
        return false;
      }
    }, true);
  }

  function installStyles(){
    if ($('plateSoloFinalLockStyles')) return;

    var st = DOC.createElement('style');
    st.id = 'plateSoloFinalLockStyles';
    st.textContent = `
      .plateFinalLockActions,
      .summaryActions{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        justify-content:center;
        align-items:center;
        margin-top:14px;
      }

      [data-plate-final-lock]{
        cursor:pointer;
      }

      [data-plate-final-lock="cooldown"]{
        font-weight:900;
      }
    `;

    DOC.head.appendChild(st);
  }

  function refresh(){
    ensureSummaryButtons();
    bindKnownButtons();
    bindDynamicButtons();
  }

  function installObserver(){
    if (DOC.__plateFinalLockObserverInstalled) return;
    DOC.__plateFinalLockObserverInstalled = true;

    try {
      var mo = new MutationObserver(function(){
        refresh();
      });

      mo.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true
      });
    } catch(e) {}
  }

  function exposeGlobals(){
    WIN.HHA_PLATE_SOLO_FINAL_LOCK = {
      version: VERSION,
      nutritionZoneUrl: function(){
        return hardNutritionZoneUrl('plate-solo-back').toString();
      },
      cooldownGateUrl: function(){
        return cooldownGateUrl().toString();
      },
      plateSoloUrl: function(){
        return plateSoloUrl('plate-solo-replay').toString();
      },
      goNutritionZone: goNutritionZone,
      goCooldown: goCooldown,
      goReplay: goReplay,
      refresh: refresh
    };

    // เผื่อ HTML มี onclick เดิมเรียกชื่อพวกนี้
    WIN.goCooldown = goCooldown;
    WIN.goBack = function(){
      goNutritionZone('plate-solo-back');
    };
    WIN.goNutritionZone = function(){
      goNutritionZone('plate-solo-back');
    };
    WIN.nutritionZoneUrl = function(){
      return hardNutritionZoneUrl('plate-solo-back');
    };
    WIN.cooldownGateUrl = cooldownGateUrl;
  }

  function init(){
    installStyles();
    installCaptureInterceptor();
    exposeGlobals();
    refresh();
    installObserver();

    // กัน DOM สร้างปุ่ม summary หลังจบเกม
    setTimeout(refresh, 250);
    setTimeout(refresh, 800);
    setTimeout(refresh, 1600);
    setInterval(refresh, 2500);

    try {
      console.info('[Plate Solo Final Lock] cooldown URL:', cooldownGateUrl().toString());
      console.info('[Plate Solo Final Lock] zone URL:', hardNutritionZoneUrl('debug').toString());
    } catch(e) {}
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
