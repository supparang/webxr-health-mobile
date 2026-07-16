/* === HeroHealth Warmup Gate Patch
 * PATCH v20260716-GATE-COOLDOWN-FORCE-AND-HANDWASH-WHO-ROUTE
 *
 * Keeps the Brush forced-cooldown compatibility behavior and adds a
 * canonical Handwash warmup route that cannot loop back to warmup-gate.
 */

(function(){
  'use strict';

  var PATCH = 'v20260716-GATE-COOLDOWN-FORCE-AND-HANDWASH-WHO-ROUTE';

  function params(){
    try{ return new URLSearchParams(location.search || ''); }
    catch(_){ return new URLSearchParams(''); }
  }

  function bangkokYmd(){
    try{
      return new Intl.DateTimeFormat('en-CA', {
        timeZone:'Asia/Bangkok',
        year:'numeric',
        month:'2-digit',
        day:'2-digit'
      }).format(new Date());
    }catch(_){
      return new Date().toISOString().slice(0,10);
    }
  }

  function bool(v){
    return String(v || '').toLowerCase() === '1' ||
           String(v || '').toLowerCase() === 'true' ||
           String(v || '').toLowerCase() === 'yes';
  }

  var p = params();
  var phase = String(p.get('phase') || p.get('gatePhase') || '').toLowerCase();
  var game = String(p.get('game') || p.get('gameId') || 'brush').toLowerCase();
  var pid = String(p.get('pid') || 'anon');
  var mode = String(p.get('mode') || 'learn').toLowerCase();
  var ymd = bangkokYmd();

  var isCooldown = phase === 'cooldown';
  var isBrush = game === 'brush';
  var forceCooldown =
    isCooldown &&
    isBrush &&
    (
      bool(p.get('forceCooldownOnce')) ||
      bool(p.get('forceGate')) ||
      p.get('skipDaily') === '0' ||
      p.get('source') === 'brush-summary'
    );

  function keyCandidates(){
    var phases = ['COOLDOWN','cooldown'];
    var games = Array.from(new Set(['brush', String(p.get('gameId') || 'brush').toLowerCase(), game]));
    var modes = Array.from(new Set([mode, 'learn']));
    var keys = [];

    phases.forEach(function(ph){
      games.forEach(function(g){
        modes.forEach(function(m){
          keys.push('HHA_GATE_' + ph + '_' + pid + '_' + g + '_' + m + '_' + ymd);
        });
      });
    });

    return Array.from(new Set(keys));
  }

  function isCooldownKey(k){
    if(!k) return false;
    return (
      /^HHA_GATE_(COOLDOWN|cooldown)_/.test(String(k)) &&
      String(k).indexOf('_brush_') !== -1 &&
      String(k).endsWith('_' + ymd)
    );
  }

  function clearCooldownKeys(){
    var removed = [];

    try{
      keyCandidates().forEach(function(k){
        if(localStorage.getItem(k) !== null){
          removed.push(k);
          localStorage.removeItem(k);
        }
      });

      Object.keys(localStorage).forEach(function(k){
        if(isCooldownKey(k)){
          if(removed.indexOf(k) < 0) removed.push(k);
          localStorage.removeItem(k);
        }
      });
    }catch(_){ }

    return removed;
  }

  function markWarmupDoneCompat(){
    var warmPhases = ['WARMUP','warmup'];
    var modes = Array.from(new Set([mode, 'learn']));
    var payload = {
      done:true,
      completed:true,
      phase:'warmup',
      game:'brush',
      mode:mode || 'learn',
      pid:pid,
      ymd:ymd,
      reason:'gate-cooldown-force-compat',
      patch:PATCH,
      at:new Date().toISOString()
    };

    try{
      warmPhases.forEach(function(ph){
        modes.forEach(function(m){
          localStorage.setItem('HHA_GATE_' + ph + '_' + pid + '_brush_' + m + '_' + ymd, JSON.stringify(payload));
        });
      });
    }catch(_){ }
  }

  function installLocalStorageGuard(){
    if(!forceCooldown || window.__HHA_COOLDOWN_FORCE_GUARD__) return;
    window.__HHA_COOLDOWN_FORCE_GUARD__ = true;

    var bootUntil = Date.now() + 4500;
    var realGet = Storage.prototype.getItem;
    var realSet = Storage.prototype.setItem;

    Storage.prototype.getItem = function(k){
      if(isCooldownKey(k)) return null;
      return realGet.call(this, k);
    };

    Storage.prototype.setItem = function(k, v){
      if(isCooldownKey(k) && Date.now() < bootUntil){
        try{ console.warn('[HHA Gate Patch] blocked early cooldown-done set:', k); }catch(_){ }
        return;
      }
      return realSet.call(this, k, v);
    };

    window.HHA_GATE_COOLDOWN_FORCE = {
      patch:PATCH,
      active:true,
      pid:pid,
      mode:mode,
      ymd:ymd,
      keys:keyCandidates,
      clear:clearCooldownKeys,
      removedAtBoot:[],
      bootUntil:bootUntil
    };
  }

  if(forceCooldown){
    var removed = clearCooldownKeys();
    markWarmupDoneCompat();
    installLocalStorageGuard();

    if(window.HHA_GATE_COOLDOWN_FORCE){
      window.HHA_GATE_COOLDOWN_FORCE.removedAtBoot = removed;
    }

    try{
      console.info('[HHA Gate Patch] force cooldown first entry enabled:', {
        patch:PATCH,
        removed:removed,
        phase:phase,
        game:game,
        pid:pid,
        mode:mode,
        ymd:ymd
      });
    }catch(_){ }
  }

  window.HHA_GATE_DEBUG = Object.assign(window.HHA_GATE_DEBUG || {}, {
    patch:PATCH,
    ctx:function(){
      return { phase:phase, game:game, pid:pid, mode:mode, ymd:ymd, forceCooldown:forceCooldown };
    },
    cooldownKeys:keyCandidates,
    clearCooldownToday:clearCooldownKeys,
    list:function(){
      try{
        return Object.keys(localStorage)
          .filter(function(k){ return /HHA_GATE|HHA_BRUSH_GATE/i.test(k); })
          .sort()
          .map(function(k){ return { key:k, value:localStorage.getItem(k) }; });
      }catch(_){ return []; }
    }
  });
})();

(function(){
  'use strict';

  var PATCH = 'v20260716-HANDWASH-WHO-WARMUP-DIRECT-R1';
  var q;
  try{ q = new URLSearchParams(location.search || ''); }
  catch(_){ q = new URLSearchParams(''); }

  var game = String(q.get('game') || q.get('gameId') || q.get('theme') || '').trim().toLowerCase();
  var phase = String(q.get('phase') || q.get('gatePhase') || 'warmup').trim().toLowerCase();

  if(game !== 'handwash' || phase === 'cooldown') return;

  function heroBase(){
    try{
      var marker = '/herohealth/';
      var index = location.pathname.indexOf(marker);
      if(index >= 0){
        return location.origin + location.pathname.slice(0, index + marker.length);
      }
      return new URL('./', location.href).toString();
    }catch(_){
      return 'https://supparang.github.io/webxr-health-mobile/herohealth/';
    }
  }

  function targetUrl(){
    var target = new URL('hygiene-zone/handwash-realistic-v3.html', heroBase());

    [
      'pid','name','nick','studentId','playerId','classId','classLevel','section',
      'diff','time','view','mode','hub','hubRoot','launcher','plannerReturn',
      'studyId','conditionGroup','session_code','log','api','seed','sheet'
    ].forEach(function(key){
      var value = q.get(key);
      if(value) target.searchParams.set(key, value);
    });

    target.searchParams.set('game', 'handwash');
    target.searchParams.set('gameId', 'handwash');
    target.searchParams.set('zone', 'hygiene');
    target.searchParams.set('cat', 'hygiene');
    target.searchParams.set('entry', 'who-warmup-complete');
    target.searchParams.set('fromWarmup', '1');
    target.searchParams.set('wgok', '1');
    target.searchParams.set('who', '1');

    target.searchParams.delete('phase');
    target.searchParams.delete('gatePhase');
    target.searchParams.delete('runFile');
    target.searchParams.delete('runUrl');
    target.searchParams.delete('forcegate');
    target.searchParams.delete('forceGate');
    target.searchParams.delete('resetGate');

    return target.toString();
  }

  var TARGET = targetUrl();
  var fired = false;

  q.set('next', TARGET);
  q.set('runUrl', TARGET);
  q.set('runFile', TARGET);
  q.set('wgok', '1');

  try{
    history.replaceState(null, '', location.pathname + '?' + q.toString() + (location.hash || ''));
  }catch(_){ }

  window.HH_GATE_FORCE_NEXT = TARGET;
  window.HHA_GATE_RETURN_URL = TARGET;
  window.HHA_GATE_DONE_URL = TARGET;
  window.HHA_NEXT_URL = TARGET;
  window.HHA_HANDWASH_WHO_TARGET = TARGET;

  window.HHA_GATE_BOOT = window.HHA_GATE_BOOT || {};
  window.HHA_GATE_BOOT.nextHref = TARGET;
  window.HHA_GATE_BOOT.handwashWhoWarmupTarget = TARGET;
  window.HHA_GATE_BOOT.handwashWarmupPatch = PATCH;

  function mainButton(node){
    if(!node || !node.closest) return null;
    var button = node.closest('button,a,[role="button"]');
    if(!button) return null;

    var text = String(
      button.textContent ||
      button.getAttribute('aria-label') ||
      button.getAttribute('title') ||
      ''
    ).replace(/\s+/g, ' ').trim().toLowerCase();

    var id = String(button.id || '').toLowerCase();
    var cls = String(button.className || '').toLowerCase();

    var isBack = text.indexOf('กลับ') !== -1 || text.indexOf('hub') !== -1;
    if(isBack) return null;

    var isMain =
      text.indexOf('เข้าเกมหลัก') !== -1 ||
      text.indexOf('เริ่มเกมหลัก') !== -1 ||
      text.indexOf('ไปต่อ') !== -1 ||
      id.indexOf('continue') !== -1 ||
      id.indexOf('next') !== -1 ||
      cls.indexOf('primary') !== -1;

    return isMain ? button : null;
  }

  function go(event){
    if(event){
      try{ event.preventDefault(); }catch(_){ }
      try{ event.stopPropagation(); }catch(_){ }
      try{ if(event.stopImmediatePropagation) event.stopImmediatePropagation(); }catch(_){ }
    }

    if(fired) return false;
    fired = true;

    try{
      sessionStorage.setItem('HHA_HANDWASH_WHO_WARMUP_ROUTE', JSON.stringify({
        patch:PATCH,
        target:TARGET,
        at:new Date().toISOString()
      }));
    }catch(_){ }

    location.replace(TARGET);
    return false;
  }

  ['click','pointerup','touchend'].forEach(function(type){
    document.addEventListener(type, function(event){
      if(mainButton(event.target)) return go(event);
    }, type === 'touchend' ? {capture:true,passive:false} : true);
  });

  window.HHA_GATE_GO_NEXT = go;
  window.goNext = go;

  window.HHA_HANDWASH_WHO_WARMUP_FIX = {
    patch:PATCH,
    target:TARGET,
    go:go
  };

  try{ console.info('[Handwash WHO warmup direct]', TARGET); }catch(_){ }
})();
