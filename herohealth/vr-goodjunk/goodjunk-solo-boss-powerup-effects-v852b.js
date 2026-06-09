// === /herohealth/vr-goodjunk/goodjunk-solo-boss-powerup-effects-v852b.js ===
// PATCH v20260608-GOODJUNK-SOLO-BOSS-POWERUP-EFFECTS-V852B
// Purpose:
// - ทำให้ Shield / Magnet / Fever มีผลจริง ไม่ใช่แค่ขึ้น Ready
// - Magnet: กดใช้แล้วช่วยดูด/เน้นอาหารดี 8 วินาที
// - Fever: กดใช้แล้วเพิ่มพลังคะแนน/feedback 8 วินาที
// - Shield: กดใช้แล้วกัน junk / miss 1 ช่วงเวลา
// - ไม่ยุ่งกับ summary calculation owner v852a

(function(){
  'use strict';

  const PATCH = 'v20260608-GOODJUNK-POWERUP-EFFECTS-V852B';

  if(window.__GJ_POWERUP_EFFECTS_V852B__){
    console.warn('[GJ Powerup Effects V852B] already loaded');
    return;
  }
  window.__GJ_POWERUP_EFFECTS_V852B__ = true;

  const P = {
    shield:{
      ready:false,
      active:false,
      until:0,
      duration:9000,
      cooldown:0
    },
    magnet:{
      ready:false,
      active:false,
      until:0,
      duration:8500,
      cooldown:0
    },
    fever:{
      ready:false,
      active:false,
      until:0,
      duration:8500,
      cooldown:0
    },
    timer:null,
    magnetTimer:null,
    lastToastAt:0
  };

  const FOOD_SELECTOR = [
    '.gjpu-item',
    '.gjm-food',
    '.food-target',
    '[data-food-kind]',
    '[data-food-type]',
    '[data-food-id]',
    '[data-food]',
    '[data-kind]',
    '[data-type]',
    '[data-good]',
    '[data-junk]',
    '[data-fake]'
  ].join(',');

  function log(){
    try{
      console.log.apply(console, ['[GJ Powerup Effects V852B]'].concat([].slice.call(arguments)));
    }catch(_){}
  }

  function byId(id){
    return document.getElementById(id);
  }

  function now(){
    return Date.now();
  }

  function textOf(el){
    return String(
      (el && (
        el.textContent ||
        el.innerText ||
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        ''
      )) || ''
    ).replace(/\s+/g,' ').trim();
  }

  function clamp(v, min, max){
    return Math.max(min, Math.min(max, v));
  }

  function ensureStyle(){
    if(byId('gjPowerupEffectsStyleV852B')) return;

    const style = document.createElement('style');
    style.id = 'gjPowerupEffectsStyleV852B';
    style.textContent = `
      .gj-powerup-active-glow{
        box-shadow:0 0 0 4px rgba(34,197,94,.25), 0 0 30px rgba(34,197,94,.45) !important;
        transform:translateZ(0) scale(1.04);
      }

      .gj-magnet-good{
        outline:4px solid rgba(56,189,248,.65) !important;
        box-shadow:0 0 0 6px rgba(56,189,248,.20), 0 0 32px rgba(56,189,248,.55) !important;
        filter:saturate(1.22) brightness(1.08);
        transition:transform .12s linear, box-shadow .12s linear, outline .12s linear;
      }

      .gj-fever-good{
        outline:4px solid rgba(250,204,21,.70) !important;
        box-shadow:0 0 0 7px rgba(250,204,21,.22), 0 0 36px rgba(250,204,21,.65) !important;
        filter:saturate(1.35) brightness(1.12);
      }

      .gj-shield-blocked{
        animation:gjShieldBlockedV852B .38s ease both;
      }

      @keyframes gjShieldBlockedV852B{
        0%{ transform:scale(1); filter:brightness(1); }
        50%{ transform:scale(.92); filter:brightness(1.3) saturate(1.3); }
        100%{ transform:scale(1); filter:brightness(1); }
      }

      #gjPowerupToastV852B{
        position:fixed;
        left:50%;
        bottom:calc(84px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:2147482500;
        min-width:220px;
        max-width:calc(100vw - 28px);
        padding:12px 16px;
        border-radius:999px;
        background:rgba(15,23,42,.92);
        color:#fff;
        font-weight:1000;
        font-size:14px;
        text-align:center;
        box-shadow:0 18px 42px rgba(15,23,42,.28);
        pointer-events:none;
        opacity:0;
        transition:opacity .18s ease, transform .18s ease;
      }

      #gjPowerupToastV852B.show{
        opacity:1;
        transform:translateX(-50%) translateY(-4px);
      }

      .gjPowerupPulseV852B{
        animation:gjPowerupPulseV852B .9s ease-in-out infinite alternate;
      }

      @keyframes gjPowerupPulseV852B{
        from{ transform:scale(1); }
        to{ transform:scale(1.045); }
      }
    `;
    document.head.appendChild(style);
  }

  function toast(msg){
    const t = now();
    if(t - P.lastToastAt < 450) return;
    P.lastToastAt = t;

    ensureStyle();

    let el = byId('gjPowerupToastV852B');
    if(!el){
      el = document.createElement('div');
      el.id = 'gjPowerupToastV852B';
      document.body.appendChild(el);
    }

    el.textContent = msg;
    el.classList.add('show');

    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function(){
      el.classList.remove('show');
    }, 1300);
  }

  function isPowerButton(el, key){
    if(!el) return false;

    const pack = String(
      (el.id || '') + ' ' +
      (el.className || '') + ' ' +
      textOf(el) + ' ' +
      (el.getAttribute && (
        (el.getAttribute('aria-label') || '') + ' ' +
        (el.getAttribute('title') || '') + ' ' +
        (el.getAttribute('data-powerup') || '') + ' ' +
        (el.getAttribute('data-kind') || '') + ' ' +
        (el.getAttribute('data-type') || '')
      ) || '')
    ).toLowerCase();

    if(key === 'shield'){
      return pack.includes('shield') || pack.includes('โล่') || pack.includes('ป้องกัน');
    }

    if(key === 'magnet'){
      return pack.includes('magnet') || pack.includes('แม่เหล็ก') || pack.includes('ดูด');
    }

    if(key === 'fever'){
      return pack.includes('fever') || pack.includes('พลัง') || pack.includes('คูณ') || pack.includes('x2');
    }

    return false;
  }

  function findPowerButton(key){
    const candidates = Array.from(document.querySelectorAll('button, [role="button"], .powerup, .power-up, .gjpu-card, .gjpu-item, div, span'));

    for(const el of candidates){
      if(isPowerButton(el, key)) return el;
    }

    return null;
  }

  function setButtonState(key){
    const b = findPowerButton(key);
    const s = P[key];

    if(!b || !s) return;

    const left = Math.max(0, Math.ceil((s.until - now()) / 1000));

    try{
      b.dataset.powerup = key;
      b.style.cursor = 'pointer';
      b.style.pointerEvents = 'auto';

      if(s.active){
        b.classList.add('gj-powerup-active-glow','gjPowerupPulseV852B');
        b.title = key + ' active ' + left + 's';
      }else{
        b.classList.remove('gj-powerup-active-glow','gjPowerupPulseV852B');
        b.title = key + ' ready';
      }

      const small = b.querySelector('.gjPowerupTimerV852B') || document.createElement('small');
      small.className = 'gjPowerupTimerV852B';
      small.style.display = 'block';
      small.style.fontWeight = '900';
      small.style.fontSize = '11px';
      small.style.opacity = '.72';
      small.textContent = s.active ? (left + 's') : 'Ready!';

      if(!small.parentNode) b.appendChild(small);
    }catch(_){}
  }

  function classifyFood(el){
    if(!el) return null;

    const d = el.dataset || {};

    const explicit = String(
      d.foodKind ||
      d.foodType ||
      d.kind ||
      d.type ||
      d.category ||
      d.group ||
      ''
    ).toLowerCase().trim();

    if([
      'good','healthy','protein','fruit','veg','vegetable','carb','grain','water','milk'
    ].includes(explicit)) return 'good';

    if([
      'junk','bad','unhealthy','trash','sugar','fat','salt'
    ].includes(explicit)) return 'junk';

    if([
      'fake','trap','trick','decoy','bomb'
    ].includes(explicit)) return 'fake';

    if(d.good === '1' || d.isGood === '1' || d.healthy === '1') return 'good';
    if(d.junk === '1' || d.isJunk === '1' || d.bad === '1') return 'junk';
    if(d.fake === '1' || d.isFake === '1' || d.trap === '1') return 'fake';

    const cls = String(el.className || '').toLowerCase();

    if(
      cls.includes('food-good') ||
      cls.includes('good-food') ||
      cls.includes('is-good') ||
      cls.includes('healthy-food') ||
      cls.includes('target-good')
    ) return 'good';

    if(
      cls.includes('food-junk') ||
      cls.includes('junk-food') ||
      cls.includes('is-junk') ||
      cls.includes('target-junk')
    ) return 'junk';

    if(
      cls.includes('food-fake') ||
      cls.includes('fake-food') ||
      cls.includes('is-fake') ||
      cls.includes('target-fake') ||
      cls.includes('trap-food')
    ) return 'fake';

    return null;
  }

  function allFoodTargets(){
    return Array.from(document.querySelectorAll(FOOD_SELECTOR))
      .filter(function(el){
        if(!el || !el.isConnected) return false;
        if(el.closest('#gjAuthoritySummaryOverlay,#gjFreshSummaryOverlay,#gjSummaryOverlay,#gjRewardOverlay,#gjrOverlay')) return false;
        if(el.closest('button,[role="button"],.gjpu-card,.gjpu-toast,#gjmHud')) return false;
        return true;
      });
  }

  function goodTargets(){
    return allFoodTargets().filter(function(el){
      return classifyFood(el) === 'good';
    });
  }

  function getAimPoint(){
    const area = byId('gjSoloBossArea') || document.body;
    const rect = area.getBoundingClientRect ? area.getBoundingClientRect() : {
      left:0,
      top:0,
      width:window.innerWidth,
      height:window.innerHeight
    };

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function magnetStep(){
    if(!P.magnet.active) return;

    const aim = getAimPoint();

    goodTargets().forEach(function(el){
      const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      if(!rect) return;

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = aim.x - cx;
      const dy = aim.y - cy;

      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      /*
        Magnet แบบปลอดภัย:
        - ไม่ย้ายแรงจน layout พัง
        - ช่วยดึงเข้ากลางจอ + ขยาย hitbox/visual
      */
      const pull = clamp(130 / dist, 0.05, 0.22);
      const tx = dx * pull;
      const ty = dy * pull;

      try{
        el.classList.add('gj-magnet-good');
        el.style.setProperty('transform', 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(1.15)', 'important');
        el.style.setProperty('z-index','80','important');
        el.style.setProperty('pointer-events','auto','important');

        if(!el.dataset.gjMagnetHint){
          el.dataset.gjMagnetHint = '1';
          el.setAttribute('title','Magnet กำลังช่วยดูดอาหารดี');
        }
      }catch(_){}
    });
  }

  function clearMagnetVisual(){
    allFoodTargets().forEach(function(el){
      try{
        el.classList.remove('gj-magnet-good');
        if(el.dataset.gjMagnetHint === '1'){
          delete el.dataset.gjMagnetHint;
        }
        el.style.removeProperty('transform');
        el.style.removeProperty('z-index');
      }catch(_){}
    });
  }

  function applyFeverVisual(){
    if(!P.fever.active) return;

    goodTargets().forEach(function(el){
      try{
        el.classList.add('gj-fever-good');
      }catch(_){}
    });

    try{
      document.body.dataset.gjFeverActive = '1';
      window.GJ_FEVER_MULTIPLIER = 2;
    }catch(_){}
  }

  function clearFeverVisual(){
    allFoodTargets().forEach(function(el){
      try{
        el.classList.remove('gj-fever-good');
      }catch(_){}
    });

    try{
      delete document.body.dataset.gjFeverActive;
      window.GJ_FEVER_MULTIPLIER = 1;
    }catch(_){}
  }

  function activate(key){
    const s = P[key];
    if(!s) return;

    const t = now();

    if(s.active){
      toast(keyLabel(key) + ' กำลังทำงานอยู่');
      return;
    }

    if(s.cooldown && t < s.cooldown){
      toast(keyLabel(key) + ' ยังไม่พร้อม');
      return;
    }

    s.ready = false;
    s.active = true;
    s.until = t + s.duration;
    s.cooldown = s.until + 2500;

    if(key === 'shield'){
      try{
        document.body.dataset.gjShieldActive = '1';
        window.GJ_SHIELD_ACTIVE = true;
      }catch(_){}
      toast('🛡️ Shield พร้อมป้องกัน junk!');
    }

    if(key === 'magnet'){
      toast('🧲 Magnet ดูดอาหารดี!');
      if(P.magnetTimer) clearInterval(P.magnetTimer);
      P.magnetTimer = setInterval(magnetStep, 120);
      magnetStep();
    }

    if(key === 'fever'){
      try{
        window.GJ_FEVER_MULTIPLIER = 2;
      }catch(_){}
      toast('⚡ Fever! คะแนนอาหารดีแรงขึ้น');
      applyFeverVisual();
    }

    setButtonState(key);

    log('activated', key);
  }

  function deactivate(key){
    const s = P[key];
    if(!s || !s.active) return;

    s.active = false;
    s.until = 0;

    if(key === 'shield'){
      try{
        delete document.body.dataset.gjShieldActive;
        window.GJ_SHIELD_ACTIVE = false;
      }catch(_){}
      toast('Shield หมดเวลา');
    }

    if(key === 'magnet'){
      if(P.magnetTimer){
        clearInterval(P.magnetTimer);
        P.magnetTimer = null;
      }
      clearMagnetVisual();
      toast('Magnet หมดเวลา');
    }

    if(key === 'fever'){
      clearFeverVisual();
      toast('Fever หมดเวลา');
    }

    setButtonState(key);
    log('deactivated', key);
  }

  function keyLabel(key){
    if(key === 'shield') return 'Shield';
    if(key === 'magnet') return 'Magnet';
    if(key === 'fever') return 'Fever';
    return key;
  }

  function refresh(){
    ['shield','magnet','fever'].forEach(function(key){
      const s = P[key];
      if(!s) return;

      if(s.active && now() >= s.until){
        deactivate(key);
      }

      setButtonState(key);
    });

    if(P.magnet.active){
      magnetStep();
    }

    if(P.fever.active){
      applyFeverVisual();
    }
  }

  function bindPowerButtons(){
    function bindOne(key){
      const b = findPowerButton(key);
      if(!b || b.dataset.gjPowerEffectBound === key) return;

      b.dataset.gjPowerEffectBound = key;
      b.style.pointerEvents = 'auto';
      b.style.cursor = 'pointer';

      b.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        activate(key);
      }, true);

      b.addEventListener('pointerdown', function(ev){
        ev.stopPropagation();
      }, true);

      setButtonState(key);

      log('bound button', key, textOf(b));
    }

    ['shield','magnet','fever'].forEach(bindOne);
  }

  function protectShieldFromJunk(ev){
    if(!P.shield.active) return;

    const target = ev.target && ev.target.closest ? ev.target.closest(FOOD_SELECTOR) : null;
    if(!target) return;

    const kind = classifyFood(target);
    if(kind !== 'junk') return;

    /*
      Shield block:
      - กัน junk ไม่ให้ไปถึง core handler เท่าที่ทำได้
      - ไม่ให้ summary นับเป็น miss จาก junk
    */
    try{
      ev.preventDefault();
      ev.stopPropagation();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      target.classList.add('gj-shield-blocked');
      target.style.setProperty('pointer-events','none','important');

      setTimeout(function(){
        try{ target.remove(); }catch(_){}
      }, 180);
    }catch(_){}

    toast('🛡️ Shield กัน junk ไว้แล้ว!');
    deactivate('shield');
  }

  function boostFeverGood(ev){
    if(!P.fever.active) return;

    const target = ev.target && ev.target.closest ? ev.target.closest(FOOD_SELECTOR) : null;
    if(!target) return;

    const kind = classifyFood(target);
    if(kind !== 'good') return;

    /*
      ให้ core/summary รู้ว่าอยู่ใน Fever
      ถ้า core รองรับ multiplier จะใช้ได้
      ถ้าไม่รองรับ อย่างน้อย visual + flag พร้อมไว้
    */
    try{
      target.dataset.gjFeverHit = '1';
      window.GJ_FEVER_MULTIPLIER = 2;
    }catch(_){}
  }

  function hookFoodProtection(){
    document.addEventListener('pointerdown', function(ev){
      protectShieldFromJunk(ev);
      boostFeverGood(ev);
    }, true);

    document.addEventListener('click', function(ev){
      protectShieldFromJunk(ev);
      boostFeverGood(ev);
    }, true);
  }

  function observeNewButtons(){
    const mo = new MutationObserver(function(){
      bindPowerButtons();
      refresh();
    });

    try{
      mo.observe(document.documentElement || document.body, {
        childList:true,
        subtree:true
      });
    }catch(_){}
  }

  function markReadyFromExistingUI(){
    ['shield','magnet','fever'].forEach(function(key){
      const b = findPowerButton(key);
      if(!b) return;

      const t = textOf(b).toLowerCase();
      if(
        t.includes('ready') ||
        t.includes('พร้อม') ||
        t.includes('ใช้') ||
        !t.includes('0')
      ){
        P[key].ready = true;
      }

      setButtonState(key);
    });
  }

  function expose(){
    window.GJ_POWERUP_EFFECTS_V852B = {
      patch:PATCH,
      state:P,
      activate:activate,
      deactivate:deactivate,
      refresh:refresh,
      classifyFood:classifyFood,
      goodTargets:goodTargets
    };
  }

  function boot(){
    ensureStyle();

    bindPowerButtons();
    markReadyFromExistingUI();
    hookFoodProtection();
    observeNewButtons();

    if(P.timer) clearInterval(P.timer);
    P.timer = setInterval(function(){
      bindPowerButtons();
      refresh();
    }, 450);

    expose();

    log('installed', PATCH);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
