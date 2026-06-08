/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-balance-v850j.js === */
/* PATCH v20260607-GOODJUNK-SOLO-BOSS-BALANCE-V850J
   หน้าที่:
   - ปรับสมดุลบอสให้ชนะยากขึ้นแบบพอดี
   - ไม่เปิด summary เอง
   - ไม่ยิง event จบเกมเอง
   - ไม่อ่าน text ซ้ำจน console spam
   - ไม่เพิ่ม goodHits / score / summary metrics เอง
*/

(function(){
  'use strict';

  var PATCH = 'v20260607-GOODJUNK-SOLO-BOSS-BALANCE-V850J';

  if(window.GJ_BALANCE_V850J_LOADED){
    return;
  }
  window.GJ_BALANCE_V850J_LOADED = true;

  var qs = new URLSearchParams(location.search || '');
  var diff = String(qs.get('diff') || 'normal').toLowerCase();
  var time = Math.max(45, Number(qs.get('time') || 90) || 90);

  var profile = {
    easy: {
      bossHpBase: 130,
      targetGoodHits: 16,
      minRealSeconds: 25,
      spawnNote: 'friendly'
    },
    normal: {
      bossHpBase: 180,
      targetGoodHits: 22,
      minRealSeconds: 35,
      spawnNote: 'balanced'
    },
    hard: {
      bossHpBase: 240,
      targetGoodHits: 28,
      minRealSeconds: 45,
      spawnNote: 'challenge'
    },
    challenge: {
      bossHpBase: 300,
      targetGoodHits: 34,
      minRealSeconds: 55,
      spawnNote: 'boss'
    }
  }[diff] || {
    bossHpBase: 180,
    targetGoodHits: 22,
    minRealSeconds: 35,
    spawnNote: 'balanced'
  };

  if(time >= 120){
    profile.bossHpBase += 40;
    profile.targetGoodHits += 5;
    profile.minRealSeconds += 10;
  }

  if(time >= 150){
    profile.bossHpBase += 70;
    profile.targetGoodHits += 8;
    profile.minRealSeconds += 15;
  }

  window.GJ_BALANCE_PROFILE_V850J = {
    patch: PATCH,
    diff: diff,
    time: time,
    bossHpBase: profile.bossHpBase,
    targetGoodHits: profile.targetGoodHits,
    minRealSeconds: profile.minRealSeconds,
    spawnNote: profile.spawnNote
  };

  /*
    ใส่ config กลางให้ไฟล์อื่นอ่านได้
    แต่ไม่ยุ่งกับ summary โดยตรง
  */
  window.GJ_SOLO_BOSS_BALANCE = Object.assign(
    {},
    window.GJ_SOLO_BOSS_BALANCE || {},
    {
      patch: PATCH,
      bossHpBase: profile.bossHpBase,
      targetGoodHits: profile.targetGoodHits,
      minRealSeconds: profile.minRealSeconds,
      noAutoSummary: true,
      noEarlyWin: true,
      noTextSpam: true
    }
  );

  /*
    ถ้ามี boss hp bar อยู่แล้ว ให้ปรับ max แบบไม่ทำลาย UI
  */
  function patchBossHp(){
    try{
      var candidates = Array.from(document.querySelectorAll('*')).filter(function(el){
        var txt = String(el.textContent || '').toLowerCase();
        var id = String(el.id || '').toLowerCase();
        var cls = String(el.className || '').toLowerCase();

        return (
          id.includes('boss') ||
          cls.includes('boss') ||
          txt.includes('boss') ||
          txt.includes('บอส')
        );
      });

      candidates.forEach(function(el){
        if(!el.dataset) return;
        if(el.dataset.gjBalanceV850j) return;

        el.dataset.gjBalanceV850j = PATCH;
        el.dataset.bossHpBase = String(profile.bossHpBase);
        el.dataset.targetGoodHits = String(profile.targetGoodHits);
      });
    }catch(_){}
  }

  /*
    กัน console spam จาก balance เดิม:
    ปิดเฉพาะ log ที่ขึ้นถี่มาก ไม่ปิด error จริง
  */
  (function quietNoisyLogs(){
    var oldLog = console.log;
    var oldInfo = console.info;
    var oldWarn = console.warn;

    function noisy(args){
      var s = Array.prototype.map.call(args, function(x){
        try{ return typeof x === 'string' ? x : JSON.stringify(x); }
        catch(_){ return String(x); }
      }).join(' ');

      return (
        s.includes('[GoodJunk balance v850a] boss candidate') ||
        s.includes('candidate: text-detected') ||
        s.includes('candidate: win-gate-text')
      );
    }

    console.log = function(){
      if(noisy(arguments)) return;
      return oldLog.apply(console, arguments);
    };

    console.info = function(){
      if(noisy(arguments)) return;
      return oldInfo.apply(console, arguments);
    };

    console.warn = function(){
      if(noisy(arguments)) return;
      return oldWarn.apply(console, arguments);
    };
  })();

  /*
    Guard: ถ้ามีตัวเก่าพยายามบอกว่า early win ให้ไม่ถือว่าเป็น summary trigger
  */
  window.GJ_CAN_OPEN_SUMMARY = function(state){
    state = state || {};

    var elapsed = Number(state.elapsedSec || state.elapsed || 0) || 0;
    var goodHits = Number(state.goodHits || state.good || 0) || 0;
    var score = Number(state.score || 0) || 0;
    var timeLeft = Number(state.timeLeft ?? 999) || 999;
    var lives = Number(state.lives ?? 1) || 1;

    if(timeLeft <= 0) return true;
    if(lives <= 0 && elapsed >= 10) return true;

    if(elapsed < profile.minRealSeconds) return false;
    if(goodHits < profile.targetGoodHits && score < profile.bossHpBase * 2.2) return false;

    return true;
  };

  window.addEventListener('DOMContentLoaded', patchBossHp);
  window.addEventListener('load', patchBossHp);
  setTimeout(patchBossHp, 500);
  setTimeout(patchBossHp, 1500);

  console.info('[GoodJunk balance v850j] installed', window.GJ_BALANCE_PROFILE_V850J);
})();
