/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-balance-v849b.js === */
/* FULL PATCH v20260606-GOODJUNK-SOLO-BOSS-BALANCE-V849B
   Purpose:
   - ทำให้ Solo Boss ไม่ชนะเร็วเกินไป
   - ปรับเวลา 60/90/120/150/180 ให้มีความหมายจริง
   - บังคับให้ Power-up active/เห็นผลระหว่างเล่น
   - ไม่แตะ path/cooldown/launcher
*/

(function(){
  'use strict';

  const PATCH = 'v20260606-GOODJUNK-SOLO-BOSS-BALANCE-V849B';

  if(window.GJ_SOLO_BOSS_BALANCE_V849B_LOADED){
    return;
  }
  window.GJ_SOLO_BOSS_BALANCE_V849B_LOADED = true;

  const qs = new URLSearchParams(location.search || '');

  function num(v, d){
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function getTime(){
    return Math.max(60, num(qs.get('time'), 90));
  }

  function getDiff(){
    return String(qs.get('diff') || 'normal').toLowerCase();
  }

  const GAME_TIME = getTime();
  const DIFF = getDiff();

  /*
    เป้าหมายใหม่:
    60s  = Quick แต่ไม่ควรจบด้วย 18 hit
    90s  = Normal class play
    120s = Recommended Boss
    150s = Hard / longer
    180s = Marathon
  */
  const TIME_PROFILE = (function(){
    if(GAME_TIME <= 60){
      return {
        label:'quick',
        targetGoodHits:30,
        targetPowerups:2,
        bossHpMult:1.55,
        damageMult:.64,
        powerupFirstMs:9000,
        powerupEveryMs:14500
      };
    }

    if(GAME_TIME <= 90){
      return {
        label:'normal-class',
        targetGoodHits:40,
        targetPowerups:3,
        bossHpMult:1.95,
        damageMult:.58,
        powerupFirstMs:10000,
        powerupEveryMs:13500
      };
    }

    if(GAME_TIME <= 120){
      return {
        label:'recommended-boss',
        targetGoodHits:52,
        targetPowerups:4,
        bossHpMult:2.35,
        damageMult:.52,
        powerupFirstMs:11000,
        powerupEveryMs:12500
      };
    }

    if(GAME_TIME <= 150){
      return {
        label:'hard-long',
        targetGoodHits:62,
        targetPowerups:5,
        bossHpMult:2.75,
        damageMult:.47,
        powerupFirstMs:12000,
        powerupEveryMs:12000
      };
    }

    return {
      label:'marathon',
      targetGoodHits:75,
      targetPowerups:6,
      bossHpMult:3.15,
      damageMult:.43,
      powerupFirstMs:12000,
      powerupEveryMs:11000
    };
  })();

  const DIFF_PROFILE = (function(){
    if(DIFF === 'easy'){
      return {
        hp:.86,
        damage:1.10,
        spawn:.92,
        powerup:.90
      };
    }

    if(DIFF === 'hard'){
      return {
        hp:1.18,
        damage:.88,
        spawn:1.08,
        powerup:1.08
      };
    }

    if(DIFF === 'challenge'){
      return {
        hp:1.34,
        damage:.78,
        spawn:1.14,
        powerup:1.15
      };
    }

    return {
      hp:1,
      damage:1,
      spawn:1,
      powerup:1
    };
  })();

  const BALANCE = {
    patch:PATCH,
    time:GAME_TIME,
    diff:DIFF,
    profile:TIME_PROFILE.label,
    targetGoodHits:TIME_PROFILE.targetGoodHits,
    targetPowerups:TIME_PROFILE.targetPowerups,
    bossHpMult:TIME_PROFILE.bossHpMult * DIFF_PROFILE.hp,
    damageMult:TIME_PROFILE.damageMult * DIFF_PROFILE.damage,
    spawnMult:DIFF_PROFILE.spawn,
    powerupFirstMs:Math.round(TIME_PROFILE.powerupFirstMs * DIFF_PROFILE.powerup),
    powerupEveryMs:Math.round(TIME_PROFILE.powerupEveryMs * DIFF_PROFILE.powerup),
    installedAt:Date.now()
  };

  window.GJ_SOLO_BOSS_BALANCE = Object.assign(
    {},
    window.GJ_SOLO_BOSS_BALANCE || {},
    BALANCE
  );

  window.GJ_BALANCE_V849B = BALANCE;

  /*
    1) Patch ตัวเลข balance กลาง ถ้ามี engine/module อ่านค่าเหล่านี้
  */
  function installGlobalBalance(){
    window.GJ_BOSS_HP_MULT = BALANCE.bossHpMult;
    window.GJ_BOSS_DAMAGE_MULT = BALANCE.damageMult;
    window.GJ_DAMAGE_MULT = BALANCE.damageMult;
    window.GJ_TARGET_GOOD_HITS = BALANCE.targetGoodHits;
    window.GJ_TARGET_POWERUPS = BALANCE.targetPowerups;

    window.GJ_SOLO_TUNING = Object.assign(
      {},
      window.GJ_SOLO_TUNING || {},
      {
        bossHpMult:BALANCE.bossHpMult,
        damageMult:BALANCE.damageMult,
        targetGoodHits:BALANCE.targetGoodHits,
        targetPowerups:BALANCE.targetPowerups,
        powerupFirstMs:BALANCE.powerupFirstMs,
        powerupEveryMs:BALANCE.powerupEveryMs,
        patch:PATCH
      }
    );
  }

  installGlobalBalance();

  /*
    2) ลด damage แบบครอบ function ที่อาจถูกเรียกตอนตีบอส
    ไม่รู้ชื่อ function แน่นอนทุกเวอร์ชัน จึง patch หลายชื่อแบบปลอดภัย
  */
  const DAMAGE_FUNCTION_NAMES = [
    'damageBoss',
    'hitBoss',
    'attackBoss',
    'bossDamage',
    'gjDamageBoss',
    'GJ_DAMAGE_BOSS',
    'GJ_HIT_BOSS'
  ];

  function wrapDamageFunction(name){
    const fn = window[name];

    if(typeof fn !== 'function') return;
    if(fn.__gjBalanceV849bWrapped) return;

    const wrapped = function(){
      const args = Array.prototype.slice.call(arguments);

      if(typeof args[0] === 'number'){
        args[0] = Math.max(1, Math.round(args[0] * BALANCE.damageMult));
      }

      return fn.apply(this, args);
    };

    wrapped.__gjBalanceV849bWrapped = true;
    wrapped.__gjOriginal = fn;

    try{
      window[name] = wrapped;
    }catch(_){}
  }

  function wrapDamageFunctions(){
    DAMAGE_FUNCTION_NAMES.forEach(wrapDamageFunction);
  }

  /*
    3) ปรับ Boss HP ถ้าเจอตัวแปร/DOM ที่ใช้เก็บ HP
  */
  function hardenBossHp(){
    const candidates = [
      'bossHp',
      'bossHP',
      'GJ_BOSS_HP',
      'gjBossHp',
      'currentBossHp',
      'maxBossHp',
      'bossMaxHp',
      'bossMaxHP'
    ];

    candidates.forEach(function(k){
      try{
        if(typeof window[k] === 'number' && !window['__v849b_' + k]){
          window[k] = Math.round(window[k] * BALANCE.bossHpMult);
          window['__v849b_' + k] = true;
        }
      }catch(_){}
    });

    try{
      const hpEls = document.querySelectorAll('[data-boss-hp],[data-hp],.boss-hp,.gj-boss-hp');
      hpEls.forEach(function(el){
        if(el.dataset.gjBalanceV849b) return;
        el.dataset.gjBalanceV849b = '1';
      });
    }catch(_){}
  }

  /*
    4) Power-up active จริง:
    - ถ้ามี API เดิม ให้เรียก API เดิม
    - ถ้าไม่มี ให้สร้าง visual power-up fallback ให้ผู้เล่นกด
  */
  const POWERUPS = [
    {
      id:'shield',
      icon:'🛡️',
      title:'Shield',
      sub:'กัน miss 1 ครั้ง',
      duration:6500
    },
    {
      id:'magnet',
      icon:'🧲',
      title:'Magnet',
      sub:'ดูดอาหารดีใกล้ตัว',
      duration:6000
    },
    {
      id:'fever',
      icon:'⚡',
      title:'Fever',
      sub:'คะแนนและพลังโจมตีเพิ่ม',
      duration:5500
    }
  ];

  let powerupCount = 0;
  let fallbackRoot = null;
  let toastEl = null;

  function ensureToast(){
    if(toastEl && document.body.contains(toastEl)) return toastEl;

    toastEl = document.createElement('div');
    toastEl.id = 'gjBalanceV849bToast';
    toastEl.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:calc(74px + env(safe-area-inset-bottom,0px))',
      'transform:translateX(-50%)',
      'z-index:2147483646',
      'width:min(420px,calc(100vw - 28px))',
      'padding:11px 14px',
      'border-radius:999px',
      'background:rgba(15,23,42,.90)',
      'color:#fff',
      'font:900 13px system-ui,-apple-system,Segoe UI,sans-serif',
      'text-align:center',
      'box-shadow:0 16px 34px rgba(15,23,42,.28)',
      'opacity:0',
      'pointer-events:none',
      'transition:opacity .18s ease, transform .18s ease'
    ].join(';');

    document.documentElement.appendChild(toastEl);
    return toastEl;
  }

  function toast(msg){
    const el = ensureToast();
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(-4px)';

    clearTimeout(toast._t);
    toast._t = setTimeout(function(){
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(0)';
    }, 1700);
  }

  function ensureFallbackRoot(){
    if(fallbackRoot && document.body.contains(fallbackRoot)) return fallbackRoot;

    fallbackRoot = document.createElement('div');
    fallbackRoot.id = 'gjBalanceV849bPowerups';
    fallbackRoot.style.cssText = [
      'position:fixed',
      'right:calc(10px + env(safe-area-inset-right,0px))',
      'bottom:calc(72px + env(safe-area-inset-bottom,0px))',
      'z-index:2147483645',
      'display:flex',
      'flex-direction:column',
      'gap:8px',
      'pointer-events:auto'
    ].join(';');

    document.documentElement.appendChild(fallbackRoot);
    return fallbackRoot;
  }

  function callExistingPowerupApi(pu){
    const names = [
      'GJ_EARN_POWERUP',
      'GJ_ACTIVATE_POWERUP',
      'gjEarnPowerup',
      'gjActivatePowerup',
      'spawnPowerup',
      'earnPowerup',
      'activatePowerup'
    ];

    for(const name of names){
      try{
        if(typeof window[name] === 'function'){
          window[name](pu.id, {
            source:'balance-v849b',
            patch:PATCH,
            title:pu.title,
            duration:pu.duration
          });

          return true;
        }
      }catch(e){}
    }

    try{
      window.dispatchEvent(new CustomEvent('gj:powerup-earned', {
        detail:{
          id:pu.id,
          icon:pu.icon,
          title:pu.title,
          sub:pu.sub,
          duration:pu.duration,
          source:'balance-v849b',
          patch:PATCH
        }
      }));

      window.dispatchEvent(new CustomEvent('gj:powerup-spawn', {
        detail:{
          id:pu.id,
          icon:pu.icon,
          title:pu.title,
          sub:pu.sub,
          duration:pu.duration,
          source:'balance-v849b',
          patch:PATCH
        }
      }));
    }catch(_){}

    return false;
  }

  function applyFallbackEffect(pu){
    const now = Date.now();

    window.GJ_ACTIVE_POWERUPS = window.GJ_ACTIVE_POWERUPS || {};
    window.GJ_ACTIVE_POWERUPS[pu.id] = {
      active:true,
      until:now + pu.duration,
      patch:PATCH
    };

    if(pu.id === 'shield'){
      window.GJ_SHIELD_ACTIVE = true;
      window.GJ_HAS_SHIELD = true;
      setTimeout(function(){
        window.GJ_SHIELD_ACTIVE = false;
      }, pu.duration);

      toast('🛡️ Shield active! กันพลาดได้ชั่วคราว');
    }

    if(pu.id === 'magnet'){
      window.GJ_MAGNET_ACTIVE = true;
      setTimeout(function(){
        window.GJ_MAGNET_ACTIVE = false;
      }, pu.duration);

      toast('🧲 Magnet active! อาหารดีเข้าหาง่ายขึ้น');
    }

    if(pu.id === 'fever'){
      window.GJ_FEVER_ACTIVE = true;
      window.GJ_SCORE_MULT = 2;
      window.GJ_DAMAGE_MULT = Math.max(BALANCE.damageMult, .85);

      setTimeout(function(){
        window.GJ_FEVER_ACTIVE = false;
        window.GJ_SCORE_MULT = 1;
        window.GJ_DAMAGE_MULT = BALANCE.damageMult;
      }, pu.duration);

      toast('⚡ Fever active! เร่งพลังโจมตี');
    }

    try{
      window.dispatchEvent(new CustomEvent('gj:powerup-active', {
        detail:{
          id:pu.id,
          title:pu.title,
          duration:pu.duration,
          patch:PATCH
        }
      }));
    }catch(_){}
  }

  function spawnFallbackPowerup(pu){
    const root = ensureFallbackRoot();

    if(root.querySelector('[data-pu="' + pu.id + '"]')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.pu = pu.id;
    btn.style.cssText = [
      'width:76px',
      'min-height:76px',
      'border:0',
      'border-radius:22px',
      'padding:7px',
      'background:rgba(255,255,255,.94)',
      'box-shadow:0 14px 30px rgba(15,23,42,.22)',
      'color:#0f172a',
      'font:900 11px system-ui,-apple-system,Segoe UI,sans-serif',
      'cursor:pointer',
      'display:grid',
      'place-items:center',
      'gap:2px'
    ].join(';');

    btn.innerHTML =
      '<b style="font-size:28px;line-height:1">' + pu.icon + '</b>' +
      '<span style="font-size:10px;font-weight:1000">' + pu.title + '</span>';

    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();

      btn.remove();
      applyFallbackEffect(pu);
    }, true);

    root.appendChild(btn);

    toast(pu.icon + ' Power-up พร้อมใช้: แตะเพื่อเปิด ' + pu.title);

    setTimeout(function(){
      if(btn && btn.parentNode){
        btn.remove();
      }
    }, 9000);
  }

  function spawnPowerup(reason){
    powerupCount += 1;

    const pu = POWERUPS[(powerupCount - 1) % POWERUPS.length];

    const apiWorked = callExistingPowerupApi(pu);

    /*
      แม้ API จะมีอยู่ ก็ยังสร้าง fallback button เล็ก ๆ เพื่อให้ผู้เล่นเห็นว่า active ได้แน่
      แต่ไม่รก เพราะจะหายเอง
    */
    spawnFallbackPowerup(pu);

    try{
      localStorage.setItem('GJ_POWERUP_V849B_LAST', JSON.stringify({
        patch:PATCH,
        reason:reason || '',
        powerup:pu.id,
        count:powerupCount,
        apiWorked:apiWorked,
        savedAt:new Date().toISOString()
      }));
    }catch(_){}
  }

  function schedulePowerups(){
    if(schedulePowerups.done) return;
    schedulePowerups.done = true;

    setTimeout(function(){
      spawnPowerup('first-timed');
    }, BALANCE.powerupFirstMs);

    const iv = setInterval(function(){
      if(powerupCount >= BALANCE.targetPowerups){
        clearInterval(iv);
        return;
      }

      spawnPowerup('interval');
    }, BALANCE.powerupEveryMs);

    setTimeout(function(){
      clearInterval(iv);
    }, Math.max(65000, GAME_TIME * 1000 + 5000));
  }

  /*
    5) hook ปุ่มเริ่มเกม เพื่อเริ่ม power-up หลังเริ่มจริง
  */
  function bindStart(){
    const btn = document.getElementById('gjmStartBtn');

    if(btn && !btn.dataset.gjBalanceV849b){
      btn.dataset.gjBalanceV849b = '1';

      btn.addEventListener('click', function(){
        installGlobalBalance();
        wrapDamageFunctions();
        hardenBossHp();
        schedulePowerups();

        toast('Boss balance v849b: บอสอึดขึ้น + Power-up จะมาแน่นอน');
      }, true);
    }
  }

  /*
    6) กันกรณีเกม autostart / overlay หายเอง
  */
  let bootCount = 0;
  const bootIv = setInterval(function(){
    bootCount += 1;

    installGlobalBalance();
    wrapDamageFunctions();
    hardenBossHp();
    bindStart();

    const start = document.getElementById('gjmStartOverlay');
    const startVisible = start && getComputedStyle(start).display !== 'none' && start.offsetParent !== null;

    if(!startVisible && bootCount >= 3){
      schedulePowerups();
    }

    if(bootCount > 40){
      clearInterval(bootIv);
    }
  }, 500);

  window.addEventListener('DOMContentLoaded', function(){
    installGlobalBalance();
    wrapDamageFunctions();
    hardenBossHp();
    bindStart();
  });

  window.addEventListener('load', function(){
    installGlobalBalance();
    wrapDamageFunctions();
    hardenBossHp();
    bindStart();
  });

  /*
    7) เก็บ QA trace
  */
  try{
    localStorage.setItem('GJ_SOLO_BOSS_BALANCE_V849B', JSON.stringify({
      patch:PATCH,
      balance:BALANCE,
      savedAt:new Date().toISOString()
    }));
  }catch(_){}

  console.log('[GoodJunk Solo Boss Balance v849b]', BALANCE);
})();
