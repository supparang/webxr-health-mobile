/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-powerups-hitbox-unblock-final.js
   PATCH v20260527-GOODJUNK-MOBILE-POWERUPS-HITBOX-UNBLOCK-FINAL

   เป้าหมาย:
   1) ตัวช่วย Shield / Magnet / Fever ต้องกดได้
   2) แต่แผงตัวช่วย / overlay / effect ห้ามบังการตีเป้า
   3) แก้ข้อความ "กำลังใช้" ซ้อนหลายบรรทัดจนการ์ดยืด
   4) ไม่แตะ scoring / boss / summary / cooldown
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527-GOODJUNK-MOBILE-POWERUPS-HITBOX-UNBLOCK-FINAL';

  if (window.__GJ_MOBILE_POWERUPS_HITBOX_UNBLOCK_FINAL__) return;
  window.__GJ_MOBILE_POWERUPS_HITBOX_UNBLOCK_FINAL__ = true;

  const POWER_CARD_SELECTOR = [
    '.gjpu-card',
    '.gj-power-card',
    '.power-card',
    '[data-power]',
    '[data-powerup]',
    '[data-gj-power]',
    '[data-gj-powerup]'
  ].join(',');

  const TARGET_SELECTOR = [
    '.gjpu-item',
    '.gjm-item',
    '.gjm-food',
    '.gj-food',
    '.food',
    '.target',
    '[data-kind]',
    '[data-type]',
    '[data-goodjunk-target]',
    '[data-gj-target]'
  ].join(',');

  function injectStyle(){
    if (document.getElementById('gjMobilePowerupsHitboxUnblockStyle')) return;

    const css = `
      /* === ${VERSION} === */

      /*
        สำคัญที่สุด:
        root/panel/overlay ของตัวช่วยห้ามกิน click ทั้งจอ
        ให้กดได้เฉพาะตัวการ์ด powerup เท่านั้น
      */
      .gjpu-root,
      .gj-powerups,
      .gj-powerup-panel,
      .gj-mobile-powerups,
      [data-gj-powerups-root],
      [data-powerups-root]{
        pointer-events:none !important;
      }

      .gjpu-card,
      .gj-power-card,
      .power-card,
      [data-power],
      [data-powerup],
      [data-gj-power],
      [data-gj-powerup]{
        pointer-events:auto !important;
        touch-action:manipulation !important;
      }

      /*
        effect / glow / shield / magnet / fever เป็นภาพประกอบเท่านั้น
        ห้ามบังเป้า
      */
      .gjpu-effect,
      .gjpu-fx,
      .gjpu-glow,
      .gjpu-shield,
      .gjpu-shield-fx,
      .gjpu-magnet,
      .gjpu-magnet-fx,
      .gjpu-fever,
      .gjpu-fever-fx,
      .gj-power-effect,
      .gj-power-overlay,
      .gj-mobile-power-effect,
      [data-gj-power-effect],
      [data-power-effect],
      [data-power-overlay],
      .powerup-effect,
      .powerup-overlay{
        pointer-events:none !important;
      }

      /*
        เป้า/อาหารต้องรับการกดเสมอ
      */
      .gjpu-item,
      .gjm-item,
      .gjm-food,
      .gj-food,
      .food,
      .target,
      [data-kind],
      [data-type],
      [data-goodjunk-target],
      [data-gj-target]{
        pointer-events:auto !important;
        touch-action:manipulation !important;
      }

      /*
        กันการ์ดตัวช่วยยืดเพราะข้อความสถานะซ้ำ
      */
      .gjpu-card,
      .gj-power-card,
      .power-card{
        overflow:hidden !important;
        contain:layout paint !important;
      }

      .gjpu-card span,
      .gj-power-card span,
      .power-card span{
        display:block !important;
        max-height:18px !important;
        overflow:hidden !important;
        white-space:nowrap !important;
        text-overflow:ellipsis !important;
      }

      /*
        มือถือ: ให้แผงตัวช่วยอยู่ขวาเท่านั้น ไม่บังพื้นที่เล่นกลางจอ
      */
      @media (max-width:720px){
        .gjpu-root,
        .gj-powerups,
        .gj-powerup-panel,
        .gj-mobile-powerups,
        [data-gj-powerups-root],
        [data-powerups-root]{
          left:auto !important;
          width:auto !important;
          max-width:170px !important;
          right:calc(8px + env(safe-area-inset-right, 0px)) !important;
          z-index:100020 !important;
        }

        .gjpu-card,
        .gj-power-card,
        .power-card{
          max-width:160px !important;
        }
      }
    `;

    const style = document.createElement('style');
    style.id = 'gjMobilePowerupsHitboxUnblockStyle';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function isPowerCard(el){
    return !!(el && el.closest && el.closest(POWER_CARD_SELECTOR));
  }

  function isTarget(el){
    return !!(el && el.closest && el.closest(TARGET_SELECTOR));
  }

  /*
    ตัวนี้คือหัวใจ:
    ถ้ากดโดนตัวช่วยจริง ๆ ให้ปล่อยให้ตัวช่วยทำงาน
    ถ้าไม่ได้กดตัวช่วย ห้าม powerup layer preventDefault / stopPropagation
  */
  function protectTargetEvents(){
    const eventNames = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click'];

    eventNames.forEach(function(type){
      document.addEventListener(type, function(ev){
        const t = ev.target;

        if (isPowerCard(t)) {
          return;
        }

        if (isTarget(t)) {
          return;
        }

        /*
          ไม่ block อะไรทั้งนั้น
          ปล่อยให้ game core รับ event ตามเดิม
        */
      }, true);
    });
  }

  /*
    แก้ข้อความสถานะซ้ำ เช่น "กำลังใช้" ซ้อนหลายบรรทัด
    ไม่ลบปุ่ม ไม่ลบ icon แค่บีบ status ให้เหลือสั้น ๆ
  */
  function normalizePowerCards(){
    const cards = Array.from(document.querySelectorAll(POWER_CARD_SELECTOR));
    if (!cards.length) return;

    cards.forEach(function(card){
      card.style.pointerEvents = 'auto';

      const spans = Array.from(card.querySelectorAll('span'));
      if (!spans.length) return;

      spans.forEach(function(span){
        const raw = String(span.textContent || '').replace(/\s+/g, ' ').trim();

        if (!raw) return;

        if (raw.includes('กำลังใช้')) {
          span.textContent = 'กำลังใช้';
        } else if (raw.includes('พร้อมใช้')) {
          span.textContent = 'พร้อมใช้';
        } else if (raw.includes('ยังไม่มี')) {
          span.textContent = 'ยังไม่มี';
        } else if (raw.includes('ปิดอยู่')) {
          span.textContent = 'ปิดอยู่';
        } else if (raw.includes('Combo')) {
          span.textContent = raw.replace(/.*Combo/i, 'Combo').slice(0, 16);
        }
      });
    });
  }

  /*
    ถ้า effect lock patch สร้าง overlay แบบ inline style pointer-events:auto
    ให้บังคับคืนเป็น none
  */
  function unlockEffectLayers(){
    const nodes = Array.from(document.querySelectorAll([
      '.gjpu-effect',
      '.gjpu-fx',
      '.gjpu-glow',
      '.gjpu-shield',
      '.gjpu-shield-fx',
      '.gjpu-magnet',
      '.gjpu-magnet-fx',
      '.gjpu-fever',
      '.gjpu-fever-fx',
      '.gj-power-effect',
      '.gj-power-overlay',
      '.gj-mobile-power-effect',
      '[data-gj-power-effect]',
      '[data-power-effect]',
      '[data-power-overlay]',
      '.powerup-effect',
      '.powerup-overlay'
    ].join(',')));

    nodes.forEach(function(n){
      n.style.pointerEvents = 'none';
    });
  }

  function tick(){
    normalizePowerCards();
    unlockEffectLayers();
  }

  function boot(){
    injectStyle();
    protectTargetEvents();

    tick();
    setInterval(tick, 450);

    try{
      const mo = new MutationObserver(function(){
        tick();
      });
      mo.observe(document.documentElement, {
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:['class', 'style']
      });
    }catch(e){}

    console.info('[GoodJunk Mobile Powerups Hitbox Unblock Final]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
