/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-balance-v849a.js === */
/* FULL PATCH v20260606-v849a2
   Purpose:
   - ทำให้ Solo Boss ใช้เวลานานขึ้นแบบพอดี
   - ไม่ชนะเร็วเกินไปจากการตีเพียง 15-20 ครั้ง
   - เพิ่มโอกาส power-up ให้ active จริง
   - ปรับตามเวลา 60/90/120/150/180 และระดับ easy/normal/hard/challenge
   - Safe patch: ไม่พังถ้า core ไม่มี object/function ที่คาดไว้
*/

(function(){
  'use strict';

  const PATCH = 'v20260606-v849a2';

  if(window.GJ_SOLO_BOSS_BALANCE_V849A_LOADED){
    return;
  }
  window.GJ_SOLO_BOSS_BALANCE_V849A_LOADED = true;

  const qs = new URLSearchParams(location.search || '');

  function q(name, fallback){
    const v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function num(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  const diff = String(q('diff', 'normal')).toLowerCase();
  const time = Math.max(60, num(q('time', '120'), 120));

  const DIFF_MULT = {
    easy: 0.88,
    normal: 1.00,
    hard: 1.16,
    challenge: 1.30
  };

  const TIME_MULT = {
    60: 0.88,
    90: 1.00,
    120: 1.16,
    150: 1.30,
    180: 1.45
  };

  function nearestTimeBucket(t){
    if(t <= 60) return 60;
    if(t <= 90) return 90;
    if(t <= 120) return 120;
    if(t <= 150) return 150;
    return 180;
  }

  const bucket = nearestTimeBucket(time);
  const diffMul = DIFF_MULT[diff] || 1;
  const timeMul = TIME_MULT[bucket] || 1;

  /*
    เป้าหมายใหม่:
    - 60s: ควรจบประมาณ 25-32 hit
    - 90s: ควรจบประมาณ 32-42 hit
    - 120s: ควรจบประมาณ 42-55 hit
    - 150s: ควรจบประมาณ 52-66 hit
    - 180s: ควรจบประมาณ 62-78 hit
  */
  const BALANCE = {
    patch: PATCH,
    diff: diff,
    time: time,
    bucket: bucket,

    bossHpBase: Math.round(1180 * diffMul * timeMul),
    bossHpMin: bucket <= 60 ? 1050 : bucket <= 90 ? 1220 : bucket <= 120 ? 1450 : bucket <= 150 ? 1650 : 1880,
    bossHpMax: bucket <= 60 ? 1450 : bucket <= 90 ? 1700 : bucket <= 120 ? 2050 : bucket <= 150 ? 2320 : 2600,

    goodDamageBase: bucket <= 60 ? 40 : bucket <= 90 ? 38 : bucket <= 120 ? 35 : bucket <= 150 ? 33 : 31,
    comboDamageCap: bucket <= 60 ? 1.18 : bucket <= 90 ? 1.22 : bucket <= 120 ? 1.25 : bucket <= 150 ? 1.28 : 1.30,

    powerupFirstAtSec: bucket <= 60 ? 12 : bucket <= 90 ? 14 : 16,
    powerupEverySec: bucket <= 60 ? 14 : bucket <= 90 ? 16 : bucket <= 120 ? 18 : 20,
    powerupChance: bucket <= 60 ? 0.34 : bucket <= 90 ? 0.38 : bucket <= 120 ? 0.42 : 0.46,

    fakeFoodStartSec: bucket <= 60 ? 18 : bucket <= 90 ? 20 : 24,
    junkPressureStartSec: bucket <= 60 ? 20 : bucket <= 90 ? 24 : 28
  };

  BALANCE.bossHp = Math.max(
    BALANCE.bossHpMin,
    Math.min(BALANCE.bossHpMax, BALANCE.bossHpBase)
  );

  window.GJ_SOLO_BOSS_BALANCE = Object.assign(
    {},
    window.GJ_SOLO_BOSS_BALANCE || {},
    BALANCE
  );

  window.GJ_BALANCE_V849A = BALANCE;

  function patchKnownConfigs(){
    const configNames = [
      'GJ_CONFIG',
      'GJ_SOLO_CONFIG',
      'GJ_SOLO_BOSS_CONFIG',
      'GJ_BOSS_CONFIG',
      'GOODJUNK_CONFIG',
      'GOODJUNK_SOLO_CONFIG'
    ];

    configNames.forEach(function(name){
      const obj = window[name];
      if(!obj || typeof obj !== 'object') return;

      try{
        obj.bossHp = BALANCE.bossHp;
        obj.bossHP = BALANCE.bossHp;
        obj.maxBossHp = BALANCE.bossHp;
        obj.maxBossHP = BALANCE.bossHp;

        obj.goodDamage = BALANCE.goodDamageBase;
        obj.goodHitDamage = BALANCE.goodDamageBase;
        obj.damageGood = BALANCE.goodDamageBase;

        obj.comboDamageCap = BALANCE.comboDamageCap;

        obj.powerupChance = BALANCE.powerupChance;
        obj.powerUpChance = BALANCE.powerupChance;
        obj.powerupEverySec = BALANCE.powerupEverySec;
        obj.powerUpEverySec = BALANCE.powerupEverySec;
        obj.powerupFirstAtSec = BALANCE.powerupFirstAtSec;
        obj.powerUpFirstAtSec = BALANCE.powerupFirstAtSec;
      }catch(e){}
    });
  }

  function patchHudInitial(){
    const timeEl = document.getElementById('gjmTime');
    if(timeEl){
      const current = Number(timeEl.textContent);
      if(!Number.isFinite(current) || current < time){
        timeEl.textContent = String(time);
      }
    }
  }

  function patchBossBars(){
    const candidates = document.querySelectorAll(
      '[data-boss-hp], [data-bosshp], .boss-hp, .gj-boss-hp, .gjm-boss-hp, #bossHp, #gjBossHp'
    );

    candidates.forEach(function(el){
      try{
        el.dataset.balancePatch = PATCH;
        if(!el.dataset.maxHp){
          el.dataset.maxHp = String(BALANCE.bossHp);
        }
      }catch(e){}
    });
  }

  function exposeDamageHelper(){
    window.GJ_V849A_DAMAGE = function(input){
      const combo = Math.max(0, Number(input && input.combo || 0));
      const base = Number(input && input.base || BALANCE.goodDamageBase);

      const comboMul = Math.min(
        BALANCE.comboDamageCap,
        1 + Math.max(0, combo - 1) * 0.018
      );

      return Math.max(1, Math.round(base * comboMul));
    };
  }

  function boostPowerupVisibility(){
    try{
      document.documentElement.style.setProperty('--gj-powerup-patch', PATCH);
    }catch(e){}

    const styleId = 'gj-powerup-visibility-v849a';
    if(document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .gjpu-root{
        opacity:1 !important;
        visibility:visible !important;
      }

      .gjpu-card{
        pointer-events:auto !important;
      }

      .gjpu-card.on,
      .gjpu-card.active,
      .gjpu-card[data-active="1"]{
        opacity:1 !important;
        transform:scale(1.03) !important;
        box-shadow:0 12px 28px rgba(15,23,42,.22) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function emitBalanceEvent(){
    try{
      window.dispatchEvent(new CustomEvent('gj:balance-v849a-ready', {
        detail: Object.assign({}, BALANCE)
      }));
    }catch(e){}
  }

  function patchLocalStorage(){
    try{
      localStorage.setItem('GJ_SOLO_BOSS_BALANCE_V849A', JSON.stringify({
        patch: PATCH,
        balance: BALANCE,
        savedAt: new Date().toISOString()
      }));
    }catch(e){}
  }

  function boot(){
    patchKnownConfigs();
    patchHudInitial();
    patchBossBars();
    exposeDamageHelper();
    boostPowerupVisibility();
    emitBalanceEvent();
    patchLocalStorage();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

  window.addEventListener('load', boot);
  window.addEventListener('gj:game-start', boot);
  window.addEventListener('gj:boss-spawned', boot);
  window.addEventListener('gj:round-start', boot);

  setTimeout(boot, 80);
  setTimeout(boot, 400);
  setTimeout(boot, 1000);
  setTimeout(boot, 2200);

  console.info('[GoodJunk balance v849a]', BALANCE);
})();
