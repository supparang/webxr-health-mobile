/* === HeroHealth Warmup Gate Patch
 * PATCH v20260506i-GATE-COOLDOWN-ONCE-FORCE-FIX
 *
 * PURPOSE:
 * - If warmup-gate.html is opened as phase=cooldown&forceCooldownOnce=1,
 *   the first cooldown of the day must NOT be skipped to zone immediately.
 * - Existing cooldown-done keys for today are ignored/cleared only for this forced first entry.
 * - Prevents early "cooldown done" marking during the first few seconds of gate boot.
 *
 * WHERE TO PLACE:
 * - Put this script as early as possible in warmup-gate.html,
 *   ideally inside <head> BEFORE the existing gate-core / daily-skip script.
 */

(function(){
  'use strict';

  var PATCH = 'v20260506i-GATE-COOLDOWN-ONCE-FORCE-FIX';

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
    }catch(_){}

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
    }catch(_){}
  }

  function installLocalStorageGuard(){
    if(!forceCooldown || window.__HHA_COOLDOWN_FORCE_GUARD__) return;
    window.__HHA_COOLDOWN_FORCE_GUARD__ = true;

    var bootUntil = Date.now() + 4500;
    var realGet = Storage.prototype.getItem;
    var realSet = Storage.prototype.setItem;

    Storage.prototype.getItem = function(k){
      if(isCooldownKey(k)){
        return null;
      }
      return realGet.call(this, k);
    };

    Storage.prototype.setItem = function(k, v){
      // Some gate versions mark cooldown done immediately on load.
      // Block that only during initial boot; after the activity is actually completed,
      // normal setItem works again.
      if(isCooldownKey(k) && Date.now() < bootUntil){
        try{
          console.warn('[HHA Gate Patch] blocked early cooldown-done set:', k);
        }catch(_){}
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
    }catch(_){}
  }

  // General helper for console inspection.
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
