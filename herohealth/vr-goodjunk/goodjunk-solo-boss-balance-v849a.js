/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-balance-v849a.js === */
/* PATCH v8.49a-GOODJUNK-SOLO-BOSS-BALANCE
   เป้าหมาย:
   1) Solo Boss ไม่จบเร็วเกินไป
   2) Normal ควรเล่นราว 120s
   3) ชนะบอสควรใช้ประมาณ 35–45 good hits
   4) Power-up ต้อง active เห็นผลจริงอย่างน้อย 2–3 ครั้งต่อรอบ
   5) ไม่แตะ multiplayer / race / battle
*/

(function(){
  'use strict';

  if(window.GJ_SOLO_BOSS_BALANCE_V849A_LOADED) return;
  window.GJ_SOLO_BOSS_BALANCE_V849A_LOADED = true;

  const PATCH = 'v8.49a-GOODJUNK-SOLO-BOSS-BALANCE';

  const qs = new URLSearchParams(location.search || '');

  function isSoloBoss(){
    const mode = String(qs.get('mode') || '').toLowerCase();
    const game = String(qs.get('game') || qs.get('gameId') || '').toLowerCase();
    const path = String(location.pathname || '').toLowerCase();

    return (
      game === 'goodjunk' ||
      path.includes('goodjunk-solo-boss')
    ) && (
      mode === '' ||
      mode === 'solo' ||
      mode === 'solo_boss' ||
      mode === 'boss'
    );
  }

  if(!isSoloBoss()) return;

  function diff(){
    return String(qs.get('diff') || 'normal').toLowerCase();
  }

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  const BALANCE = {
    easy:{
      time:90,
      bossHp:900,
      hitDamage:28,
      bossRageAt:.42,
      powerEvery:18,
      powerMin:2
    },
    normal:{
      time:120,
      bossHp:1180,
      hitDamage:30,
      bossRageAt:.45,
      powerEvery:16,
      powerMin:3
    },
    hard:{
      time:150,
      bossHp:1450,
      hitDamage:29,
      bossRageAt:.50,
      powerEvery:15,
      powerMin:3
    },
    challenge:{
      time:180,
      bossHp:1700,
      hitDamage:27,
      bossRageAt:.55,
      powerEvery:14,
      powerMin:4
    }
  };

  const cfg = BALANCE[diff()] || BALANCE.normal;

  /*
    1) ตั้งเวลาเริ่มต้น
    ถ้า URL เป็น time=60 และไม่ได้ตั้งใจ quick test ให้ดันเป็นค่ามาตรฐานของ diff
  */
  function patchTime(){
    const current = Number(qs.get('time') || 0);
    const shouldOverride =
      !current ||
      current < cfg.time ||
      String(qs.get('quick') || '').toLowerCase() === '0';

    if(!shouldOverride) return;

    const timeEl = document.getElementById('gjmTime');
    if(timeEl) timeEl.textContent = String(cfg.time);

    try{
      if(window.GJ_STATE && typeof window.GJ_STATE === 'object'){
        if('timeLeft' in window.GJ_STATE) window.GJ_STATE.timeLeft = cfg.time;
        if('time' in window.GJ_STATE) window.GJ_STATE.time = cfg.time;
        if('duration' in window.GJ_STATE) window.GJ_STATE.duration = cfg.time;
      }
    }catch(e){}
  }

  /*
    2) เพิ่ม HP บอส / ลด damage ต่อ hit
    กันชนะไวเกินแบบ 19 hit
  */
  function patchBoss(){
    const bossLabels = Array.from(document.querySelectorAll('*')).filter(el => {
      const t = String(el.textContent || '');
      return /HP\s*\d+\s*\/\s*\d+/.test(t);
    });

    bossLabels.forEach(el => {
      const t = String(el.textContent || '');
      const m = t.match(/HP\s*(\d+)\s*\/\s*(\d+)/);
      if(!m) return;

      const cur = clamp(Number(m[1]), 0, cfg.bossHp);
      el.textContent = 'HP ' + cur + '/' + cfg.bossHp;
    });

    try{
      const candidates = [
        window.GJ_SOLO_BOSS,
        window.GJ_BOSS,
        window.GJ_STATE,
        window.goodJunkState,
        window.state
      ].filter(Boolean);

      candidates.forEach(obj => {
        if(!obj || typeof obj !== 'object') return;

        if('bossMaxHp' in obj) obj.bossMaxHp = cfg.bossHp;
        if('bossHP' in obj) obj.bossHP = Math.min(Number(obj.bossHP || cfg.bossHp), cfg.bossHp);
        if('bossHp' in obj) obj.bossHp = Math.min(Number(obj.bossHp || cfg.bossHp), cfg.bossHp);
        if('maxBossHp' in obj) obj.maxBossHp = cfg.bossHp;

        if('hitDamage' in obj) obj.hitDamage = cfg.hitDamage;
        if('goodDamage' in obj) obj.goodDamage = cfg.hitDamage;
        if('damageGood' in obj) obj.damageGood = cfg.hitDamage;
      });
    }catch(e){}
  }

  /*
    3) ทำให้ Power-up active จริง
    - ถ้าเกมมี function เดิม จะเรียกใช้
    - ถ้าไม่มี จะสร้าง visual activate ให้เห็นผล + บันทึกสถานะไว้
  */
  let powerCount = 0;
  let lastPowerAt = 0;

  function powerName(){
    const names = ['shield','magnet','fever'];
    return names[powerCount % names.length];
  }

  function showToast(name){
    let toast = document.getElementById('gjBalancePowerToast');

    if(!toast){
      toast = document.createElement('div');
      toast.id = 'gjBalancePowerToast';
      toast.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:96px',
        'transform:translateX(-50%)',
        'z-index:2147483647',
        'max-width:calc(100vw - 28px)',
        'padding:12px 16px',
        'border-radius:999px',
        'background:rgba(15,23,42,.90)',
        'color:#fff',
        'font:900 14px system-ui,-apple-system,Segoe UI,sans-serif',
        'box-shadow:0 18px 42px rgba(15,23,42,.28)',
        'opacity:0',
        'pointer-events:none',
        'transition:opacity .18s ease, transform .18s ease'
      ].join(';');
      document.documentElement.appendChild(toast);
    }

    const label =
      name === 'shield' ? '🛡️ Shield ใช้งานแล้ว!' :
      name === 'magnet' ? '🧲 Magnet ใช้งานแล้ว!' :
      '⚡ Fever ใช้งานแล้ว!';

    toast.textContent = label;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(-4px)';

    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    }, 1250);
  }

  function activatePower(name){
    powerCount += 1;
    lastPowerAt = Date.now();

    try{
      window.GJ_POWER_ACTIVE = window.GJ_POWER_ACTIVE || {};
      window.GJ_POWER_ACTIVE[name] = {
        active:true,
        patch:PATCH,
        startedAt:Date.now(),
        durationMs:name === 'fever' ? 6500 : 8000
      };
    }catch(e){}

    const possibleFns = [
      'activatePowerup',
      'activatePowerUp',
      'gjActivatePowerup',
      'GJ_activatePowerup',
      'usePowerup',
      'usePowerUp'
    ];

    for(const fn of possibleFns){
      try{
        if(typeof window[fn] === 'function'){
          window[fn](name);
          showToast(name);
          markPowerCards(name);
          return;
        }
      }catch(e){}
    }

    showToast(name);
    markPowerCards(name);
  }

  function markPowerCards(name){
    const map = {
      shield:['shield','โล่','ป้องกัน'],
      magnet:['magnet','แม่เหล็ก','ดูด'],
      fever:['fever','ไฟ','แรง','เร็ว']
    };

    const words = map[name] || [];
    const nodes = Array.from(document.querySelectorAll('.gjpu-card, .powerup, [class*="power"], button, [role="button"]'));

    nodes.forEach(el => {
      const text = String(el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
      const hit = words.some(w => text.includes(String(w).toLowerCase()));
      if(!hit) return;

      el.classList.add('on');
      el.dataset.gjPowerActive = '1';
      el.style.setProperty('opacity','1','important');
      el.style.setProperty('filter','saturate(1.35) brightness(1.05)','important');

      setTimeout(() => {
        el.classList.remove('on');
        el.dataset.gjPowerActive = '0';
        el.style.removeProperty('filter');
      }, name === 'fever' ? 6500 : 8000);
    });
  }

  /*
    4) Trigger power-up ตามจำนวน good hits / score
  */
  function readGoodHits(){
    const text = String(document.body && document.body.innerText || '');
    const m1 = text.match(/อาหารดี\s*เลือก\s*(\d+)/i);
    if(m1) return Number(m1[1]) || 0;

    const m2 = text.match(/good\s*hits?\s*(\d+)/i);
    if(m2) return Number(m2[1]) || 0;

    try{
      const candidates = [
        window.GJ_STATE,
        window.GJ_SOLO_BOSS,
        window.goodJunkState,
        window.state
      ].filter(Boolean);

      for(const obj of candidates){
        const v =
          obj.goodHits ??
          obj.good ??
          obj.correct ??
          obj.hitsGood ??
          obj.goodCount;

        if(Number.isFinite(Number(v))) return Number(v);
      }
    }catch(e){}

    return 0;
  }

  function maybePower(){
    const goodHits = readGoodHits();
    if(!goodHits) return;

    const shouldFire =
      goodHits >= cfg.powerEvery * (powerCount + 1) &&
      Date.now() - lastPowerAt > 6500;

    if(shouldFire){
      activatePower(powerName());
    }
  }

  /*
    5) บันทึกค่า balance สำหรับ QA
  */
  function saveDebug(){
    try{
      localStorage.setItem('GJ_SOLO_BOSS_BALANCE_LAST', JSON.stringify({
        patch:PATCH,
        diff:diff(),
        cfg:cfg,
        url:location.href,
        savedAt:new Date().toISOString()
      }));
    }catch(e){}
  }

  function boot(){
    patchTime();
    patchBoss();
    saveDebug();

    setTimeout(patchTime, 300);
    setTimeout(patchBoss, 500);
    setTimeout(patchBoss, 1200);

    setInterval(maybePower, 700);
    setInterval(patchBoss, 2400);

    console.info('[GoodJunk Balance]', PATCH, cfg);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();
