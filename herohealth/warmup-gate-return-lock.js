// === /herohealth/warmup-gate-return-lock.js ===
// HeroHealth Warmup/Cooldown Gate — Return Lock Patch
// v20260514-WARMUP-GATE-RETURN-LOCK-PLATE-NUTRITION
// ✅ แก้ปัญหา cooldown จบแล้วกลับผิดหน้า
// ✅ ถ้า phase=cooldown + zone=nutrition/game=plate จะบังคับกลับ nutrition-zone.html เท่านั้น
// ✅ hub ของ nutrition-zone จะถูกล็อกเป็น /herohealth/hub.html
// ✅ กัน warmup-gate ใช้ next/hub/back/return เก่าผิด
// ✅ DOM-safe / ใช้ได้ทั้งปุ่ม, ลิงก์, onclick, auto function หลายชื่อ

(function(){
  'use strict';

  var VERSION = '20260514-WARMUP-GATE-RETURN-LOCK-PLATE-NUTRITION';
  var DOC = window.document;
  var WIN = window;

  var BASE = 'https://supparang.github.io/webxr-health-mobile';
  var HERO = BASE + '/herohealth';
  var HUB_URL = HERO + '/hub.html';
  var NUTRITION_ZONE_URL = HERO + '/nutrition-zone.html';

  try {
    console.info('[Warmup Gate Return Lock]', VERSION, 'loaded');
  } catch(e) {}

  function params(){
    return new URL(location.href).searchParams;
  }

  function qs(k, d){
    var v = params().get(k);
    if (v === null || v === undefined || String(v).trim() === '') return d || '';
    return v;
  }

  function isCooldown(){
    var phase = String(qs('phase','')).toLowerCase();
    var gate = String(qs('gate','')).toLowerCase();
    var cooldown = String(qs('cooldown','')).toLowerCase();

    return (
      phase === 'cooldown' ||
      gate === 'cooldown' ||
      cooldown === '1' ||
      cooldown === 'true'
    );
  }

  function isPlateNutrition(){
    var zone = String(qs('zone','')).toLowerCase();
    var cat = String(qs('cat','')).toLowerCase();
    var game = String(qs('game','')).toLowerCase();
    var gameId = String(qs('gameId','')).toLowerCase();
    var entry = String(qs('entry','')).toLowerCase();

    return (
      zone === 'nutrition' ||
      cat === 'nutrition' ||
      game === 'plate' ||
      gameId === 'plate' ||
      entry === 'plate-solo' ||
      entry === 'plate'
    );
  }

  function setIf(url, key, value){
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      url.searchParams.set(key, value);
    }
  }

  function copyCommon(url){
    [
      'seed',
      'studyId',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api'
    ].forEach(function(k){
      setIf(url, k, qs(k, ''));
    });
  }

  function nutritionZoneUrl(){
    var u = new URL(NUTRITION_ZONE_URL, location.href);

    u.searchParams.set('pid', qs('pid', 'anon'));
    setIf(u, 'name', qs('name', qs('nick', 'Hero')));
    setIf(u, 'nick', qs('nick', qs('name', 'Hero')));

    u.searchParams.set('diff', qs('diff', 'normal'));
    u.searchParams.set('time', qs('time', '120'));
    u.searchParams.set('view', qs('view', 'mobile'));
    u.searchParams.set('run', 'play');

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'plate');
    u.searchParams.set('gameId', 'plate');
    u.searchParams.set('mode', qs('mode', 'solo'));
    u.searchParams.set('entry', 'plate-solo');
    u.searchParams.set('from', 'cooldown-done');

    // สำคัญมาก: กลับ zone แล้ว hub ต้องเป็น hub.html ไม่ใช่ gate/plate
    u.searchParams.set('hub', HUB_URL);

    copyCommon(u);

    return u;
  }

  function fallbackReturnUrl(){
    var raw =
      qs('next','') ||
      qs('doneUrl','') ||
      qs('done','') ||
      qs('returnUrl','') ||
      qs('return','') ||
      qs('redirectUrl','') ||
      qs('redirect','') ||
      qs('afterUrl','') ||
      qs('after','') ||
      qs('back','') ||
      qs('hub','');

    if (raw) {
      try {
        return new URL(raw, location.href);
      } catch(e) {}
    }

    return nutritionZoneUrl();
  }

  function finalReturnUrl(){
    if (isCooldown() && isPlateNutrition()) {
      return nutritionZoneUrl();
    }

    return fallbackReturnUrl();
  }

  function goFinal(reason){
    var url = finalReturnUrl();

    try {
      console.info('[Warmup Gate Return Lock] redirect:', reason || '', url.toString());
    } catch(e) {}

    location.replace(url.toString());
  }

  function isExitText(el){
    if (!el) return false;

    var txt = String(el.textContent || '').toLowerCase();
    var id = String(el.id || '').toLowerCase();
    var cls = String(el.className || '').toLowerCase();
    var href = String(el.getAttribute && el.getAttribute('href') || '').toLowerCase();
    var action = String(el.getAttribute && el.getAttribute('data-action') || '').toLowerCase();

    return (
      id.indexOf('done') >= 0 ||
      id.indexOf('next') >= 0 ||
      id.indexOf('back') >= 0 ||
      id.indexOf('hub') >= 0 ||
      id.indexOf('zone') >= 0 ||
      id.indexOf('finish') >= 0 ||
      cls.indexOf('done') >= 0 ||
      cls.indexOf('next') >= 0 ||
      cls.indexOf('back') >= 0 ||
      cls.indexOf('hub') >= 0 ||
      cls.indexOf('zone') >= 0 ||
      action === 'done' ||
      action === 'next' ||
      action === 'back' ||
      action === 'hub' ||
      action === 'zone' ||
      txt.indexOf('เสร็จ') >= 0 ||
      txt.indexOf('จบ') >= 0 ||
      txt.indexOf('ต่อไป') >= 0 ||
      txt.indexOf('กลับ') >= 0 ||
      txt.indexOf('zone') >= 0 ||
      txt.indexOf('hub') >= 0 ||
      txt.indexOf('done') >= 0 ||
      txt.indexOf('next') >= 0 ||
      txt.indexOf('finish') >= 0 ||
      href.indexOf('nutrition-zone') >= 0 ||
      href.indexOf('hub.html') >= 0
    );
  }

  function rewriteLinks(){
    if (!isCooldown()) return;

    var url = finalReturnUrl().toString();
    var nodes = DOC.querySelectorAll('a, button, [role="button"]');

    Array.prototype.forEach.call(nodes, function(el){
      if (!isExitText(el)) return;

      el.setAttribute('data-hha-return-lock', VERSION);
      el.setAttribute('data-hha-return-url', url);

      if (el.tagName && el.tagName.toLowerCase() === 'a') {
        el.setAttribute('href', url);
      }

      if (!el.__hhaReturnLockBound) {
        el.__hhaReturnLockBound = true;

        el.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

          goFinal('exit-button');

          return false;
        }, true);
      }
    });
  }

  function exposeGlobals(){
    var url = finalReturnUrl().toString();

    WIN.HHA_GATE_RETURN_LOCK = {
      version: VERSION,
      finalUrl: function(){
        return finalReturnUrl().toString();
      },
      go: function(){
        goFinal('HHA_GATE_RETURN_LOCK.go');
      }
    };

    WIN.HHA_GATE_RETURN_URL = url;
    WIN.HHA_GATE_DONE_URL = url;
    WIN.HHA_NEXT_URL = url;
    WIN.HHA_HUB_URL = url;

    // เผื่อ warmup-gate.html เรียกชื่อ function เหล่านี้
    WIN.goDone = function(){ goFinal('goDone'); };
    WIN.goNext = function(){ goFinal('goNext'); };
    WIN.goBack = function(){ goFinal('goBack'); };
    WIN.goHub = function(){ goFinal('goHub'); };
    WIN.finishGate = function(){ goFinal('finishGate'); };
    WIN.finishCooldown = function(){ goFinal('finishCooldown'); };
    WIN.completeCooldown = function(){ goFinal('completeCooldown'); };
    WIN.returnFromGate = function(){ goFinal('returnFromGate'); };
  }

  function installCapture(){
    if (DOC.__hhaGateReturnLockCapture) return;
    DOC.__hhaGateReturnLockCapture = true;

    DOC.addEventListener('click', function(ev){
      if (!isCooldown()) return;

      var target = ev.target;
      if (!target || !target.closest) return;

      var el = target.closest('a, button, [role="button"]');
      if (!el) return;

      if (!isExitText(el)) return;

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      goFinal('capture-click');

      return false;
    }, true);
  }

  function saveDebug(){
    try {
      sessionStorage.setItem('HHA_GATE_RETURN_LOCK_URL', finalReturnUrl().toString());
      localStorage.setItem('HHA_GATE_RETURN_LOCK_URL', finalReturnUrl().toString());
    } catch(e) {}
  }

  function refresh(){
    exposeGlobals();
    rewriteLinks();
    saveDebug();
  }

  function init(){
    if (!isCooldown()) {
      try {
        console.info('[Warmup Gate Return Lock] not cooldown, standby only');
      } catch(e) {}
    }

    refresh();
    installCapture();

    try {
      var mo = new MutationObserver(refresh);
      mo.observe(DOC.body || DOC.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href', 'onclick', 'class', 'id']
      });
    } catch(e) {}

    // สำคัญ: warmup-gate บางเวอร์ชันสร้างปุ่มตอนท้าย จึง refresh ซ้ำ
    setTimeout(refresh, 100);
    setTimeout(refresh, 300);
    setTimeout(refresh, 800);
    setTimeout(refresh, 1500);
    setInterval(refresh, 1200);

    try {
      console.info('[Warmup Gate Return Lock] final URL:', finalReturnUrl().toString());
    } catch(e) {}
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
