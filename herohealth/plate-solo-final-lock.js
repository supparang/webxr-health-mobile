// === /herohealth/plate-solo-final-lock.js ===
// HeroHealth Plate Solo — FINAL LOCK PATCH
// v20260514-PLATE-SOLO-FINAL-LOCK-NO-INTERNAL-SCOPE
// ✅ ไม่เรียก balanceScore/state ภายใน plate-solo.js
// ✅ แก้ปุ่ม Cooldown ให้เข้า warmup-gate phase=cooldown
// ✅ หลัง Cooldown กลับ Nutrition Zone ตาม URL ที่ต้องการ
// ✅ ปุ่มกลับ Zone กลับ nutrition-zone.html แน่นอน
// ✅ ปุ่มเล่นอีกครั้ง reload กลับ plate-solo.html พร้อม params เดิม
// ✅ ใช้เป็น external patch หลัง plate-solo.js ได้ปลอดภัย

(function(){
  'use strict';

  var VERSION = '20260514-PLATE-SOLO-FINAL-LOCK-NO-INTERNAL-SCOPE';
  var WIN = window;
  var DOC = document;

  function log(){
    try {
      console.info.apply(console, ['[Plate Solo Final Lock]', VERSION].concat([].slice.call(arguments)));
    } catch(e) {}
  }

  function warn(){
    try {
      console.warn.apply(console, ['[Plate Solo Final Lock]', VERSION].concat([].slice.call(arguments)));
    } catch(e) {}
  }

  var Q = new URL(WIN.location.href).searchParams;

  function qs(k, d){
    var v = Q.get(k);
    return v == null || v === '' ? (d || '') : v;
  }

  function $(id){
    return DOC.getElementById(id);
  }

  function textOf(el){
    return String(el && (el.textContent || el.innerText) || '').trim();
  }

  function hasText(el, words){
    var t = textOf(el).toLowerCase();
    return words.some(function(w){
      return t.indexOf(String(w).toLowerCase()) >= 0;
    });
  }

  function allButtons(){
    return Array.from(DOC.querySelectorAll('button, a, [role="button"], .btn'));
  }

  function findByIds(ids){
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el) return el;
    }
    return null;
  }

  function findButtonByText(words){
    return allButtons().find(function(el){
      return hasText(el, words);
    }) || null;
  }

  function safeUrl(base){
    try {
      return new URL(base, WIN.location.href);
    } catch(e) {
      return new URL('https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html');
    }
  }

  function preserveParams(url, keys){
    keys.forEach(function(k){
      var v = qs(k, '');
      if (v !== '') url.searchParams.set(k, v);
    });
    return url;
  }

  function nutritionZoneUrl(fromTag){
    var u = safeUrl('https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html');

    preserveParams(u, [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'run',
      'seed',
      'studyId',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api'
    ]);

    u.searchParams.set('pid', qs('pid', 'anon'));
    u.searchParams.set('diff', qs('diff', 'normal'));
    u.searchParams.set('time', qs('time', '120'));
    u.searchParams.set('view', qs('view', 'mobile'));
    u.searchParams.set('run', 'play');
    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('game', 'plate');
    u.searchParams.set('gameId', 'plate');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'plate-solo');
    u.searchParams.set('from', fromTag || 'plate-solo');

    var hub = qs('hub', '');
    if (hub) {
      u.searchParams.set('hub', hub);
    } else {
      u.searchParams.set(
        'hub',
        'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html'
      );
    }

    return u;
  }

  function plateSoloUrl(){
    var u = safeUrl('https://supparang.github.io/webxr-health-mobile/herohealth/plate-solo.html');

    preserveParams(u, [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'seed',
      'studyId',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api'
    ]);

    u.searchParams.set('pid', qs('pid', 'anon'));
    u.searchParams.set('name', qs('name', qs('nick', 'Hero')));
    u.searchParams.set('diff', qs('diff', 'normal'));
    u.searchParams.set('time', qs('time', '120'));
    u.searchParams.set('view', qs('view', 'mobile'));
    u.searchParams.set('run', 'play');
    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('game', 'plate');
    u.searchParams.set('gameId', 'plate');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'plate-solo');

    var hub = qs('hub', '');
    if (hub) {
      u.searchParams.set('hub', hub);
    } else {
      u.searchParams.set(
        'hub',
        nutritionZoneUrl('plate-solo-replay').toString()
      );
    }

    u.searchParams.set('v', Date.now().toString());

    return u;
  }

  function cooldownGateUrl(){
    var zone = nutritionZoneUrl('plate-solo-cooldown-done');

    var gate = safeUrl('https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html');

    preserveParams(gate, [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'seed',
      'studyId',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api'
    ]);

    gate.searchParams.set('pid', qs('pid', 'anon'));
    gate.searchParams.set('name', qs('name', qs('nick', 'Hero')));
    gate.searchParams.set('diff', qs('diff', 'normal'));
    gate.searchParams.set('time', qs('time', '120'));
    gate.searchParams.set('view', qs('view', 'mobile'));
    gate.searchParams.set('run', 'play');

    gate.searchParams.set('phase', 'cooldown');
    gate.searchParams.set('zone', 'nutrition');
    gate.searchParams.set('cat', 'nutrition');
    gate.searchParams.set('game', 'plate');
    gate.searchParams.set('gameId', 'plate');
    gate.searchParams.set('mode', 'solo');
    gate.searchParams.set('entry', 'plate-solo');
    gate.searchParams.set('from', 'plate-solo-summary');

    // สำคัญมาก: หลัง cooldown ให้กลับ Nutrition Zone
    gate.searchParams.set('next', zone.toString());
    gate.searchParams.set('hub', zone.toString());
    gate.searchParams.set('back', zone.toString());

    gate.searchParams.set('v', Date.now().toString());

    return gate;
  }

  function go(url){
    try {
      WIN.location.href = url.toString();
    } catch(e) {
      WIN.location.assign(String(url));
    }
  }

  function bindHard(el, handler, label){
    if (!el || el.__plateFinalLockBound) return false;

    el.__plateFinalLockBound = true;

    el.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      handler();
      return false;
    }, true);

    el.addEventListener('pointerdown', function(ev){
      // ไม่ redirect ตอน pointerdown เพื่อกัน mobile double-fire
      ev.stopPropagation();
    }, true);

    try {
      el.dataset.plateFinalLock = label || 'bound';
    } catch(e) {}

    return true;
  }

  function bindCooldown(){
    var btn =
      findByIds([
        'btnCooldown',
        'cooldownBtn',
        'summaryCooldownBtn',
        'btnSummaryCooldown',
        'cooldownButton'
      ]) ||
      findButtonByText([
        'cooldown',
        'ทำ cooldown',
        'คูลดาวน์',
        'ทำคูลดาวน์'
      ]);

    if (!btn) {
      warn('Cooldown button not found yet');
      return false;
    }

    return bindHard(btn, function(){
      var url = cooldownGateUrl();
      log('go cooldown', url.toString());
      go(url);
    }, 'cooldown');
  }

  function bindBackZone(){
    var btn =
      findByIds([
        'btnSummaryBack',
        'nutritionZoneBtn',
        'btnZone',
        'zoneBtn',
        'backZoneBtn',
        'btnBackZone'
      ]) ||
      findButtonByText([
        'nutrition zone',
        'กลับ nutrition',
        'กลับ zone',
        'กลับโซน',
        'กลับหน้า zone'
      ]);

    if (!btn) {
      warn('Back Zone button not found yet');
      return false;
    }

    return bindHard(btn, function(){
      var url = nutritionZoneUrl('plate-solo-summary-back');
      log('go zone', url.toString());
      go(url);
    }, 'zone');
  }

  function bindReplay(){
    var btn =
      findByIds([
        'btnReplay',
        'replayBtn',
        'playAgainBtn',
        'btnPlayAgain',
        'summaryReplayBtn'
      ]) ||
      findButtonByText([
        'เล่นอีกครั้ง',
        'play again',
        'replay'
      ]);

    if (!btn) {
      warn('Replay button not found yet');
      return false;
    }

    return bindHard(btn, function(){
      var url = plateSoloUrl();
      log('go replay', url.toString());
      go(url);
    }, 'replay');
  }

  function installCss(){
    if ($('plateSoloFinalLockCss')) return;

    var st = DOC.createElement('style');
    st.id = 'plateSoloFinalLockCss';
    st.textContent = `
      [data-plate-final-lock="cooldown"]{
        background:linear-gradient(135deg,#6ee7b7,#34d399)!important;
        color:#073b2a!important;
        font-weight:1000!important;
      }

      [data-plate-final-lock="zone"]{
        font-weight:1000!important;
      }

      [data-plate-final-lock="replay"]{
        font-weight:1000!important;
      }
    `;

    DOC.head.appendChild(st);
  }

  function install(){
    installCss();

    var ok1 = bindCooldown();
    var ok2 = bindBackZone();
    var ok3 = bindReplay();

    WIN.HHA_PLATE_FINAL_LOCK = {
      version: VERSION,
      cooldownUrl: cooldownGateUrl().toString(),
      zoneUrl: nutritionZoneUrl('debug').toString(),
      soloUrl: plateSoloUrl().toString(),
      bound: {
        cooldown: !!ok1,
        zone: !!ok2,
        replay: !!ok3
      }
    };

    log('installed', WIN.HHA_PLATE_FINAL_LOCK);
  }

  function boot(){
    install();

    // summary overlay อาจถูกสร้าง/เปิดหลังจบเกม จึงต้อง bind ซ้ำแบบเบา ๆ
    var tries = 0;
    var timer = WIN.setInterval(function(){
      tries++;
      install();

      if (tries >= 20) {
        WIN.clearInterval(timer);
      }
    }, 700);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();ข
