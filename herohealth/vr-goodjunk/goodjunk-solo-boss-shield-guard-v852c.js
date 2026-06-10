// === /herohealth/vr-goodjunk/goodjunk-solo-boss-shield-guard-v852c.js ===
// PATCH v20260608-GOODJUNK-SOLO-BOSS-SHIELD-GUARD-V852C2
// Purpose:
// - Shield ต้อง block junk ก่อน summary-authority-v852a นับผล
// - ถ้า Shield active แล้วกด junk: junk ไม่ถูกนับ, miss ไม่เพิ่ม, junk หาย
// - ไม่สแกน DOM หนัก ไม่ใช้ MutationObserver
// - ส่ง flag ให้ summary v852a ignore target/event ที่ Shield กันไว้แล้ว

(function(){
  'use strict';

  const PATCH = 'v20260608-GOODJUNK-SHIELD-GUARD-V852C2';

  if(window.__GJ_SHIELD_GUARD_V852C__){
    console.warn('[GJ Shield Guard V852C] already loaded');
    return;
  }
  window.__GJ_SHIELD_GUARD_V852C__ = true;

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

  const S = {
    active:false,
    used:false,
    blockedJunk:0,
    lastActivatedAt:0,
    lastBlockedAt:0
  };

  function log(){
    try{
      console.log.apply(console, ['[GJ Shield Guard V852C]'].concat([].slice.call(arguments)));
    }catch(_){}
  }

  function byId(id){
    return document.getElementById(id);
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

  function ensureStyle(){
    if(byId('gjShieldGuardStyleV852C')) return;

    const style = document.createElement('style');
    style.id = 'gjShieldGuardStyleV852C';
    style.textContent = `
      #gjShieldGuardToast{
        position:fixed;
        left:50%;
        bottom:calc(90px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:2147483001;
        background:rgba(15,23,42,.94);
        color:white;
        padding:12px 18px;
        border-radius:999px;
        font-weight:1000;
        font-size:14px;
        box-shadow:0 18px 42px rgba(15,23,42,.28);
        pointer-events:none;
        opacity:0;
        transition:opacity .16s ease, transform .16s ease;
      }

      #gjShieldGuardToast.show{
        opacity:1;
        transform:translateX(-50%) translateY(-4px);
      }

      .gjShieldBlockedV852C{
        animation:gjShieldBlockedV852C .34s ease both;
      }

      @keyframes gjShieldBlockedV852C{
        0%{ transform:scale(1); filter:brightness(1); opacity:1; }
        45%{ transform:scale(.86); filter:brightness(1.4) saturate(1.4); opacity:.75; }
        100%{ transform:scale(.2); filter:brightness(1.2); opacity:0; }
      }

      .gjShieldReadyV852C{
        box-shadow:0 0 0 4px rgba(59,130,246,.22), 0 0 24px rgba(59,130,246,.38) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function toast(msg){
    ensureStyle();

    let el = byId('gjShieldGuardToast');
    if(!el){
      el = document.createElement('div');
      el.id = 'gjShieldGuardToast';
      document.body.appendChild(el);
    }

    el.textContent = msg;
    el.classList.add('show');

    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function(){
      el.classList.remove('show');
    }, 1200);
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

    if(['junk','bad','unhealthy','trash','sugar','fat','salt'].includes(explicit)){
      return 'junk';
    }

    if(d.junk === '1' || d.isJunk === '1' || d.bad === '1'){
      return 'junk';
    }

    const cls = String(el.className || '').toLowerCase();

    if(
      cls.includes('food-junk') ||
      cls.includes('junk-food') ||
      cls.includes('is-junk') ||
      cls.includes('target-junk')
    ){
      return 'junk';
    }

    return null;
  }

  function isShieldButton(el){
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

    return (
      pack.includes('shield') ||
      pack.includes('โล่') ||
      pack.includes('ป้องกัน')
    );
  }

  function findShieldButton(){
    const candidates = Array.from(document.querySelectorAll(
      'button,[role="button"],.powerup,.power-up,.gjpu-card,.gjpu-item,[data-powerup],[data-kind],[data-type]'
    ));

    for(const el of candidates){
      if(isShieldButton(el)) return el;
    }

    return null;
  }

  function activateShield(){
    S.active = true;
    S.used = false;
    S.lastActivatedAt = Date.now();

    try{
      window.GJ_SHIELD_ACTIVE = true;
      window.GJ_SHIELD_BLOCKED_JUNK = S.blockedJunk;
      window.GJ_LAST_SHIELD_ACTIVATE_AT = S.lastActivatedAt;

      document.body.dataset.gjShieldActive = '1';
      document.documentElement.dataset.gjShieldActive = '1';
    }catch(_){}

    const btn = findShieldButton();
    if(btn){
      btn.classList.add('gjShieldReadyV852C');
      try{
        btn.title = 'Shield active: กัน junk ได้ 1 ครั้ง';
      }catch(_){}
    }

    toast('🛡️ Shield พร้อมกัน junk 1 ครั้ง!');
    log('shield active');
  }

  function deactivateShield(reason){
    S.active = false;
    S.used = true;

    try{
      window.GJ_SHIELD_ACTIVE = false;
      delete document.body.dataset.gjShieldActive;
      delete document.documentElement.dataset.gjShieldActive;
    }catch(_){}

    const btn = findShieldButton();
    if(btn){
      btn.classList.remove('gjShieldReadyV852C');
      try{
        btn.title = 'Shield used';
      }catch(_){}
    }

    log('shield inactive:', reason || 'unknown');
  }

  function bindShieldButton(){
    const btn = findShieldButton();
    if(!btn || btn.dataset.gjShieldGuardBound === '1') return;

    btn.dataset.gjShieldGuardBound = '1';
    btn.style.pointerEvents = 'auto';
    btn.style.cursor = 'pointer';

    btn.addEventListener('pointerdown', function(ev){
      ev.stopPropagation();
    }, true);

    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      activateShield();
    }, true);

    log('bound shield button:', textOf(btn));
  }

  function markTargetIgnored(target){
    if(!target) return;

    try{
      target.dataset.gjShieldBlocked = '1';
      target.dataset.gjIgnoreSummary = '1';
      target.dataset.gjAuthorityIgnore = '1';
      target.dataset.gjShieldBlockedAt = String(Date.now());
      target.classList.add('gjShieldBlockedV852C');
      target.style.setProperty('pointer-events','none','important');
    }catch(_){}
  }

  function blockJunkIfShield(ev){
    if(!S.active) return;

    const target = ev.target && ev.target.closest
      ? ev.target.closest(FOOD_SELECTOR)
      : null;

    if(!target) return;

    const kind = classifyFood(target);
    if(kind !== 'junk') return;

    ev.preventDefault();
    ev.stopPropagation();
    if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

    S.blockedJunk += 1;
    S.lastBlockedAt = Date.now();

    try{
      window.GJ_SHIELD_BLOCKED_JUNK = S.blockedJunk;
      window.GJ_LAST_SHIELD_BLOCK_AT = S.lastBlockedAt;
      window.GJ_IGNORE_NEXT_JUNK_HIT_UNTIL = S.lastBlockedAt + 1200;
    }catch(_){}

    markTargetIgnored(target);

    toast('🛡️ Shield กัน junk ไว้แล้ว!');

    setTimeout(function(){
      try{
        target.remove();
      }catch(_){}
    }, 220);

    deactivateShield('blocked-junk');

    log('blocked junk before summary count', {
      blockedJunk:S.blockedJunk,
      text:textOf(target)
    });
  }

  function expose(){
    window.GJ_SHIELD_GUARD_V852C = {
      patch:PATCH,
      state:S,
      activate:activateShield,
      deactivate:deactivateShield,
      blockedJunk:function(){ return S.blockedJunk; },
      isActive:function(){ return S.active; }
    };
  }

  function boot(){
    ensureStyle();

    bindShieldButton();
    setTimeout(bindShieldButton, 300);
    setTimeout(bindShieldButton, 900);
    setTimeout(bindShieldButton, 1600);
    setTimeout(bindShieldButton, 2500);

    /*
      สำคัญ:
      Shield Guard ต้องโหลดก่อน summary v852a
      เพื่อให้ capture listener นี้ได้สิทธิ์ block junk ก่อน
    */
    document.addEventListener('pointerdown', blockJunkIfShield, true);
    document.addEventListener('click', blockJunkIfShield, true);

    expose();

    log('installed', PATCH);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();