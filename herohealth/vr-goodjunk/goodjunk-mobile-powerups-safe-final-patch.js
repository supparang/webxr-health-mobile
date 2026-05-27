/* =========================================================
   HeroHealth • GoodJunk Mobile Powerups Safe Final
   PATCH: v20260526b-GOODJUNK-MOBILE-POWERUPS-SAFE-FINAL
   FILE: /herohealth/vr-goodjunk/goodjunk-mobile-powerups-safe-final-patch.js

   FIX:
   - ไม่ดัก click/touch ทั้งหน้า
   - ไม่บล็อกการตีเป้าอาหาร
   - Powerup card กดได้เฉพาะตัวการ์ดด้านขวา
   - ถ้า Shield / Magnet / Fever ขึ้น “กำลังใช้” แล้ว จะไม่ spam ซ้ำ
   - มี visual feedback ชัด แต่ไม่ยุ่ง hit target
========================================================= */

(function(){
  'use strict';

  if (window.__GJ_MOBILE_POWERUPS_SAFE_FINAL__) return;
  window.__GJ_MOBILE_POWERUPS_SAFE_FINAL__ = true;

  const PATCH = 'v20260526b-GOODJUNK-MOBILE-POWERUPS-SAFE-FINAL';
  const qs = new URLSearchParams(location.search || '');

  const view = String(qs.get('view') || '').toLowerCase();
  const isMobile =
    view === 'mobile' ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  if (!isMobile) return;

  const state = {
    shield: false,
    magnetUntil: 0,
    feverUntil: 0
  };

  function text(el){
    return String(el && el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function isPowerCard(el){
    if (!el || !el.closest) return null;

    const card = el.closest('.gjpu-card, [data-power], .power-card, .powerup-card');

    if (!card) return null;

    const t = text(card).toLowerCase();

    if (/shield|โล่|🛡/.test(t)) return { card, type:'shield' };
    if (/magnet|แม่เหล็ก|🧲/.test(t)) return { card, type:'magnet' };
    if (/fever|⚡/.test(t)) return { card, type:'fever' };

    return null;
  }

  function toast(msg){
    let t = document.getElementById('gjPowerSafeToast');

    if (!t){
      t = document.createElement('div');
      t.id = 'gjPowerSafeToast';
      t.style.position = 'fixed';
      t.style.left = '50%';
      t.style.bottom = 'calc(84px + env(safe-area-inset-bottom,0px))';
      t.style.transform = 'translateX(-50%) translateY(8px) scale(.96)';
      t.style.zIndex = '2147482500';
      t.style.width = 'min(390px, calc(100vw - 24px))';
      t.style.borderRadius = '999px';
      t.style.padding = '10px 14px';
      t.style.background = 'rgba(15,23,42,.88)';
      t.style.color = '#fff';
      t.style.border = '2px solid rgba(255,255,255,.76)';
      t.style.boxShadow = '0 16px 34px rgba(15,23,42,.28)';
      t.style.textAlign = 'center';
      t.style.fontSize = '13px';
      t.style.fontWeight = '1000';
      t.style.pointerEvents = 'none';
      t.style.opacity = '0';
      t.style.transition = '.18s ease';
      document.body.appendChild(t);
    }

    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0) scale(1)';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function(){
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(8px) scale(.96)';
    }, 1200);
  }

  function bigFx(msg){
    let fx = document.getElementById('gjPowerSafeFx');

    if (!fx){
      fx = document.createElement('div');
      fx.id = 'gjPowerSafeFx';
      fx.style.position = 'fixed';
      fx.style.left = '50%';
      fx.style.top = '46%';
      fx.style.zIndex = '2147482600';
      fx.style.transform = 'translate(-50%,-50%) scale(.72)';
      fx.style.minWidth = 'min(330px, calc(100vw - 34px))';
      fx.style.borderRadius = '28px';
      fx.style.padding = '15px 18px';
      fx.style.color = '#fff';
      fx.style.textAlign = 'center';
      fx.style.fontSize = 'clamp(28px, 8vw, 52px)';
      fx.style.fontWeight = '1000';
      fx.style.lineHeight = '1';
      fx.style.letterSpacing = '-.05em';
      fx.style.textShadow = '0 4px 16px rgba(15,23,42,.32)';
      fx.style.pointerEvents = 'none';
      fx.style.opacity = '0';
      fx.style.transition = '.18s ease';
      fx.style.background = 'linear-gradient(135deg,rgba(37,99,235,.96),rgba(14,165,233,.90))';
      document.body.appendChild(fx);
    }

    fx.textContent = msg;
    fx.style.opacity = '1';
    fx.style.transform = 'translate(-50%,-50%) scale(1.05)';

    clearTimeout(bigFx._timer1);
    clearTimeout(bigFx._timer2);

    bigFx._timer1 = setTimeout(function(){
      fx.style.transform = 'translate(-50%,-50%) scale(1)';
    }, 100);

    bigFx._timer2 = setTimeout(function(){
      fx.style.opacity = '0';
      fx.style.transform = 'translate(-50%,-58%) scale(.92)';
    }, 720);
  }

  function markCard(card, active, label){
    if (!card) return;

    card.classList.toggle('on', !!active);
    card.classList.toggle('active', !!active);
    card.classList.toggle('ready', !active);

    if (active){
      card.setAttribute('data-gj-power-active', '1');
      card.style.boxShadow = '0 0 0 4px rgba(34,197,94,.34), 0 16px 34px rgba(15,23,42,.22)';
      card.style.opacity = '1';

      const span = card.querySelector('span');
      if (span) span.textContent = 'กำลังใช้';
    }else{
      card.removeAttribute('data-gj-power-active');
      card.style.boxShadow = '';
      card.style.opacity = '';

      const span = card.querySelector('span');
      if (span) span.textContent = label || 'พร้อมใช้';
    }
  }

  function activateShield(card){
    if (state.shield){
      toast('🛡️ Shield กำลังใช้อยู่แล้ว');
      return;
    }

    state.shield = true;
    document.body.setAttribute('data-gj-shield-active', '1');

    markCard(card, true, 'พร้อมใช้');
    bigFx('SHIELD!');
    toast('🛡️ Shield เปิดใช้: กันพลาด 1 ครั้ง');

    setTimeout(function(){
      state.shield = false;
      document.body.removeAttribute('data-gj-shield-active');
      markCard(card, false, 'พร้อมใช้');
    }, 9000);
  }

  function activateMagnet(card){
    const now = Date.now();

    if (state.magnetUntil > now){
      toast('🧲 Magnet กำลังใช้อยู่แล้ว');
      return;
    }

    state.magnetUntil = now + 7000;
    document.body.setAttribute('data-gj-magnet-active', '1');

    markCard(card, true, 'พร้อมใช้');
    bigFx('MAGNET!');
    toast('🧲 Magnet เปิดใช้: ช่วยเล็งอาหารดี 7 วินาที');

    clearTimeout(activateMagnet._timer);
    activateMagnet._timer = setTimeout(function(){
      state.magnetUntil = 0;
      document.body.removeAttribute('data-gj-magnet-active');
      markCard(card, false, 'พร้อมใช้');
    }, 7000);
  }

  function activateFever(card){
    const now = Date.now();

    if (state.feverUntil > now){
      toast('⚡ Fever กำลังใช้อยู่แล้ว');
      return;
    }

    state.feverUntil = now + 8000;
    document.body.setAttribute('data-gj-fever-active', '1');

    markCard(card, true, 'พร้อมใช้');
    bigFx('FEVER!');
    toast('⚡ Fever เปิดใช้: โจมตีแรงขึ้น 8 วินาที');

    clearTimeout(activateFever._timer);
    activateFever._timer = setTimeout(function(){
      state.feverUntil = 0;
      document.body.removeAttribute('data-gj-fever-active');
      markCard(card, false, 'พร้อมใช้');
    }, 8000);
  }

  function patchPointerEvents(){
    const styleId = 'gj-mobile-powerups-safe-pointer-css';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      body[data-gj-mobile-powerups-safe="1"] .gjpu-root{
        pointer-events:none !important;
      }

      body[data-gj-mobile-powerups-safe="1"] .gjpu-card,
      body[data-gj-mobile-powerups-safe="1"] [data-power],
      body[data-gj-mobile-powerups-safe="1"] .power-card,
      body[data-gj-mobile-powerups-safe="1"] .powerup-card{
        pointer-events:auto !important;
        touch-action:manipulation !important;
      }

      body[data-gj-mobile-powerups-safe="1"] .gjpu-item,
      body[data-gj-mobile-powerups-safe="1"] .gjpu-item *,
      body[data-gj-mobile-powerups-safe="1"] .gjm-area,
      body[data-gj-mobile-powerups-safe="1"] .gjm-area *{
        touch-action:manipulation !important;
      }

      body[data-gj-fever-active="1"] .gjm-root{
        filter:saturate(1.12) brightness(1.03);
      }

      body[data-gj-magnet-active="1"] .gjpu-item.good,
      body[data-gj-magnet-active="1"] [data-kind="good"]{
        box-shadow:0 0 0 5px rgba(34,197,94,.28), 0 18px 36px rgba(34,197,94,.20) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function bindSafePowerups(){
    if (document.__gjPowerSafeBound) return;
    document.__gjPowerSafeBound = true;

    document.addEventListener('click', function(ev){
      const info = isPowerCard(ev.target);
      if (!info) return;

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      if (info.type === 'shield') activateShield(info.card);
      if (info.type === 'magnet') activateMagnet(info.card);
      if (info.type === 'fever') activateFever(info.card);

      return false;
    }, true);

    document.addEventListener('pointerdown', function(ev){
      const info = isPowerCard(ev.target);
      if (!info) return;

      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }, true);

    document.addEventListener('touchstart', function(ev){
      const info = isPowerCard(ev.target);
      if (!info) return;

      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }, {
      capture:true,
      passive:false
    });
  }

  function cleanRepeatedUsingText(){
    document.querySelectorAll('.gjpu-card, [data-power], .power-card, .powerup-card').forEach(function(card){
      const spans = Array.from(card.querySelectorAll('span'));
      if (spans.length <= 1) return;

      const first = spans[0];
      spans.slice(1).forEach(function(s){
        const t = text(s);
        if (/กำลังใช้|พร้อมใช้|ปิดอยู่/i.test(t)){
          s.remove();
        }
      });

      if (first && /กำลังใช้\s+กำลังใช้|พร้อมใช้\s+พร้อมใช้/i.test(text(first))){
        first.textContent = text(first).replace(/(กำลังใช้\s*)+/g, 'กำลังใช้').replace(/(พร้อมใช้\s*)+/g, 'พร้อมใช้');
      }
    });
  }

  function boot(){
    document.body.setAttribute('data-gj-mobile-powerups-safe', '1');

    patchPointerEvents();
    bindSafePowerups();

    let count = 0;
    const timer = setInterval(function(){
      count++;
      cleanRepeatedUsingText();
      patchPointerEvents();

      if (count > 2400){
        clearInterval(timer);
      }
    }, 300);

    window.GJ_MOBILE_POWERUPS_SAFE_FINAL_CHECK = function(){
      const snap = {
        patch: PATCH,
        isMobile,
        shieldActive: state.shield,
        magnetActive: state.magnetUntil > Date.now(),
        feverActive: state.feverUntil > Date.now(),
        cards: Array.from(document.querySelectorAll('.gjpu-card, [data-power], .power-card, .powerup-card')).map(function(card){
          return {
            text: text(card),
            active: card.getAttribute('data-gj-power-active') === '1',
            pointerEvents: getComputedStyle(card).pointerEvents
          };
        }),
        areaPointerEvents: (function(){
          const area = document.querySelector('.gjm-area');
          return area ? getComputedStyle(area).pointerEvents : null;
        })()
      };

      console.log('[GJ_MOBILE_POWERUPS_SAFE_FINAL_CHECK]', snap);
      return snap;
    };

    console.info('[GoodJunk Mobile Powerups Safe Final]', PATCH, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }
})();
