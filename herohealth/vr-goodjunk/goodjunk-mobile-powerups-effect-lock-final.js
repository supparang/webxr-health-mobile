/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-powerups-effect-lock-final.js
   PATCH v20260527-GOODJUNK-MOBILE-POWERUPS-EFFECT-LOCK-FINAL

   PURPOSE:
   - แก้ปัญหา powerup effect/status overlay บังการตีเป้าอาหารบน Mobile
   - ให้การ์ด Shield / Magnet / Fever แสดงสถานะได้
   - แต่ wrapper ทั้งชุดต้องไม่กิน hitbox ของเป้า
   - คลิกได้เฉพาะตัวการ์ด powerup ที่ต้องการใช้จริง
   - ไม่แตะ score / boss HP / cooldown / summary
   - ไม่ปิดระบบ powerup เดิม แค่ “จัดเลเยอร์ + ปลด hitbox ที่บังเกม”

   SAFE:
   - ถ้าไม่มี powerup UI ก็ไม่ error
   - ถ้าเกมยังไม่สร้าง .gjpu-root จะรอและจัดซ้ำ
   - ใช้ capture listener เฉพาะกรณีคลิกโดนพื้นที่ว่างของ powerup wrapper
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527-GOODJUNK-MOBILE-POWERUPS-EFFECT-LOCK-FINAL';

  if (window.__GJ_MOBILE_POWERUPS_EFFECT_LOCK_FINAL__) return;
  window.__GJ_MOBILE_POWERUPS_EFFECT_LOCK_FINAL__ = true;

  const ROOT_SELECTORS = [
    '.gjpu-root',
    '#gjPowerups',
    '#gjPowerupRoot',
    '.powerup-root',
    '.powerups-root',
    '[data-gj-powerups-root]'
  ];

  const CARD_SELECTORS = [
    '.gjpu-card',
    '.gjpu-power',
    '.powerup-card',
    '.powerup-btn',
    '[data-powerup]',
    '[data-power]',
    '[data-gj-powerup]',
    'button'
  ];

  const TARGET_SELECTORS = [
    '.gjpu-item',
    '.gjm-item',
    '.food-item',
    '.target',
    '[data-food]',
    '[data-kind]',
    '[data-target]',
    '[data-gj-target]'
  ];

  function isMobileLike(){
    const qs = new URLSearchParams(location.search || '');
    const view = String(qs.get('view') || '').toLowerCase();
    return (
      view === 'mobile' ||
      view === 'touch' ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
      window.innerWidth <= 820
    );
  }

  function qsa(sel, root){
    try {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    } catch(e) {
      return [];
    }
  }

  function matchesAny(el, selectors){
    if (!el || !el.matches) return false;
    for (let i = 0; i < selectors.length; i++){
      try {
        if (el.matches(selectors[i])) return true;
      } catch(e){}
    }
    return false;
  }

  function closestAny(el, selectors){
    if (!el || !el.closest) return null;
    for (let i = 0; i < selectors.length; i++){
      try {
        const found = el.closest(selectors[i]);
        if (found) return found;
      } catch(e){}
    }
    return null;
  }

  function setStyle(el, styles){
    if (!el || !el.style) return;
    Object.keys(styles).forEach(function(k){
      try {
        el.style.setProperty(k, styles[k], 'important');
      } catch(e) {
        try { el.style[k] = styles[k]; } catch(_){}
      }
    });
  }

  function allRoots(){
    let out = [];
    ROOT_SELECTORS.forEach(function(sel){
      out = out.concat(qsa(sel));
    });
    return Array.from(new Set(out));
  }

  function allCards(root){
    let out = [];
    CARD_SELECTORS.forEach(function(sel){
      out = out.concat(qsa(sel, root));
    });

    out = out.filter(function(el){
      if (!el || el === root) return false;

      const text = String(el.textContent || '').toLowerCase();
      const ds = el.dataset || {};
      const cls = String(el.className || '').toLowerCase();

      return (
        cls.includes('gjpu') ||
        cls.includes('power') ||
        text.includes('shield') ||
        text.includes('magnet') ||
        text.includes('fever') ||
        text.includes('พร้อมใช้') ||
        text.includes('กำลังใช้') ||
        ds.powerup ||
        ds.power ||
        ds.gjPowerup ||
        el.tagName === 'BUTTON'
      );
    });

    return Array.from(new Set(out));
  }

  function allTargets(){
    let out = [];
    TARGET_SELECTORS.forEach(function(sel){
      out = out.concat(qsa(sel));
    });
    return Array.from(new Set(out));
  }

  function normalizePowerupRoot(root){
    if (!root) return;

    /*
      สำคัญที่สุด:
      wrapper ต้อง pointer-events:none
      เพื่อไม่บังเป้าอาหารที่อยู่ด้านหลัง
    */
    setStyle(root, {
      'pointer-events': 'none',
      'z-index': '100020',
      'touch-action': 'manipulation'
    });

    if (isMobileLike()) {
      setStyle(root, {
        'position': 'fixed',
        'right': 'calc(8px + env(safe-area-inset-right, 0px))',
        'bottom': 'calc(8px + env(safe-area-inset-bottom, 0px))',
        'top': 'auto',
        'left': 'auto',
        'width': 'auto',
        'max-width': 'calc(100vw - 156px)',
        'display': 'flex',
        'flex-direction': 'row',
        'align-items': 'flex-end',
        'justify-content': 'flex-end',
        'gap': '6px'
      });
    }

    const cards = allCards(root);

    cards.forEach(function(card){
      /*
        เฉพาะ card เท่านั้นที่คลิกได้
        ส่วนพื้นที่ว่างรอบ ๆ card ไม่บังเป้า
      */
      setStyle(card, {
        'pointer-events': 'auto',
        'touch-action': 'manipulation',
        'user-select': 'none',
        '-webkit-user-select': 'none',
        'z-index': '100021'
      });

      if (isMobileLike()) {
        setStyle(card, {
          'min-width': '48px',
          'width': 'auto',
          'min-height': '48px',
          'max-width': '142px'
        });
      }

      /*
        กัน pseudo/child ภายใน card ขยาย hitbox เกินตัวการ์ด
      */
      qsa('*', card).forEach(function(child){
        if (!child) return;

        const tag = String(child.tagName || '').toLowerCase();
        const role = String(child.getAttribute('role') || '').toLowerCase();

        if (
          tag === 'button' ||
          role === 'button' ||
          child.hasAttribute('data-powerup') ||
          child.hasAttribute('data-power') ||
          child.hasAttribute('data-gj-powerup')
        ) {
          setStyle(child, {
            'pointer-events': 'auto',
            'touch-action': 'manipulation'
          });
        } else {
          /*
            ลูกข้างในไม่ต้องรับ event เอง ให้ event ไปที่การ์ด
          */
          setStyle(child, {
            'pointer-events': 'none'
          });
        }
      });
    });
  }

  function unlockFoodTargets(){
    allTargets().forEach(function(target){
      if (!target) return;

      /*
        เป้าอาหารต้องคลิก/แตะได้เสมอ
      */
      setStyle(target, {
        'pointer-events': 'auto',
        'touch-action': 'manipulation',
        'user-select': 'none',
        '-webkit-user-select': 'none'
      });

      /*
        ถ้าเป็น card เป้าอาหาร ห้ามถูก powerup lock ทำให้จาง/ปิด
      */
      if (
        target.classList &&
        (
          target.classList.contains('gjpu-item') ||
          target.classList.contains('gjm-item')
        )
      ) {
        setStyle(target, {
          'z-index': '38'
        });
      }
    });
  }

  function unlockGameArea(){
    const ids = [
      'gjSoloBossArea',
      'gjSoloBossMain',
      'gameArea',
      'playArea'
    ];

    ids.forEach(function(id){
      const el = document.getElementById(id);
      if (!el) return;
      setStyle(el, {
        'pointer-events': 'auto',
        'touch-action': 'manipulation'
      });
    });

    qsa('.gjm-area,.gjm-root,.game-area,.play-area').forEach(function(el){
      setStyle(el, {
        'pointer-events': 'auto',
        'touch-action': 'manipulation'
      });
    });
  }

  function preventBlankPowerupWrapperCapture(){
    /*
      ถ้าผู้ใช้แตะโดนพื้นที่ว่างของ wrapper powerup
      อย่าให้มันกิน event จนเป้าอาหารข้างหลังไม่ทำงาน

      หมายเหตุ:
      โดยปกติ pointer-events:none ที่ root จะแก้แล้ว
      listener นี้เป็น safety net สำหรับกรณีมี patch อื่นเปลี่ยนกลับ
    */
    if (window.__GJ_POWERUP_BLANK_CAPTURE_GUARD__) return;
    window.__GJ_POWERUP_BLANK_CAPTURE_GUARD__ = true;

    ['pointerdown','mousedown','touchstart','click'].forEach(function(type){
      document.addEventListener(type, function(ev){
        const t = ev.target;
        const root = closestAny(t, ROOT_SELECTORS);
        if (!root) return;

        const card = closestAny(t, CARD_SELECTORS);
        if (card && root.contains(card)) {
          /*
            คลิกบนการ์ดจริง ปล่อยให้ระบบ powerup เดิมทำงาน
          */
          return;
        }

        /*
          แตะพื้นที่ว่างของ root ไม่ควรกินเกม
        */
        try {
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        } catch(e){}
      }, true);
    });
  }

  function markPowerupVisualState(){
    /*
      ช่วยให้สถานะพร้อมใช้/กำลังใช้ไม่กระพริบจนดูเหมือนปิด
      แต่ไม่แตะ logic จริงของ powerup
    */
    allRoots().forEach(function(root){
      const cards = allCards(root);

      cards.forEach(function(card){
        const text = String(card.textContent || '');
        const active =
          text.includes('กำลังใช้') ||
          text.includes('พร้อมใช้') ||
          card.classList.contains('on') ||
          card.classList.contains('active') ||
          card.getAttribute('aria-pressed') === 'true';

        if (active) {
          card.classList.add('gj-powerup-visible-ready');
          setStyle(card, {
            'opacity': '1',
            'filter': 'none'
          });
        }
      });
    });
  }

  function apply(){
    unlockGameArea();

    const roots = allRoots();

    roots.forEach(function(root){
      normalizePowerupRoot(root);
    });

    unlockFoodTargets();
    markPowerupVisualState();
  }

  function installCss(){
    if (document.getElementById('gjMobilePowerupsEffectLockFinalCss')) return;

    const style = document.createElement('style');
    style.id = 'gjMobilePowerupsEffectLockFinalCss';
    style.textContent = `
      /* PATCH ${VERSION} */

      .gjpu-root,
      #gjPowerups,
      #gjPowerupRoot,
      .powerup-root,
      .powerups-root,
      [data-gj-powerups-root]{
        pointer-events:none !important;
      }

      .gjpu-root .gjpu-card,
      .gjpu-root .gjpu-power,
      .gjpu-root .powerup-card,
      .gjpu-root .powerup-btn,
      .gjpu-root [data-powerup],
      .gjpu-root [data-power],
      .gjpu-root [data-gj-powerup],
      #gjPowerups .gjpu-card,
      #gjPowerups button,
      #gjPowerupRoot .gjpu-card,
      #gjPowerupRoot button{
        pointer-events:auto !important;
        touch-action:manipulation !important;
      }

      .gjpu-root .gjpu-card *,
      .gjpu-root .gjpu-power *,
      .gjpu-root .powerup-card *,
      .gjpu-root .powerup-btn *{
        pointer-events:none !important;
      }

      .gjpu-item,
      .gjm-item,
      .food-item,
      .target,
      [data-food],
      [data-kind],
      [data-target],
      [data-gj-target]{
        pointer-events:auto !important;
        touch-action:manipulation !important;
      }

      .gj-powerup-visible-ready{
        opacity:1 !important;
        filter:none !important;
      }

      @media (max-width:720px){
        .gjpu-root,
        #gjPowerups,
        #gjPowerupRoot,
        .powerup-root,
        .powerups-root,
        [data-gj-powerups-root]{
          top:auto !important;
          left:auto !important;
          right:calc(8px + env(safe-area-inset-right, 0px)) !important;
          bottom:calc(8px + env(safe-area-inset-bottom, 0px)) !important;
          width:auto !important;
          max-width:calc(100vw - 156px) !important;
          display:flex !important;
          flex-direction:row !important;
          align-items:flex-end !important;
          justify-content:flex-end !important;
          gap:6px !important;
          z-index:100020 !important;
          pointer-events:none !important;
        }

        .gjpu-root .gjpu-card,
        .gjpu-root .gjpu-power,
        .gjpu-root .powerup-card,
        .gjpu-root .powerup-btn,
        .gjpu-root [data-powerup],
        .gjpu-root [data-power],
        .gjpu-root [data-gj-powerup]{
          pointer-events:auto !important;
          min-width:48px !important;
          min-height:48px !important;
          z-index:100021 !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function observe(){
    if (!window.MutationObserver) return;

    let pending = false;

    const mo = new MutationObserver(function(){
      if (pending) return;
      pending = true;

      requestAnimationFrame(function(){
        pending = false;
        apply();
      });
    });

    try {
      mo.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class','style','data-state','aria-pressed']
      });
    } catch(e){}
  }

  function boot(){
    installCss();
    preventBlankPowerupWrapperCapture();

    apply();

    setTimeout(apply, 120);
    setTimeout(apply, 360);
    setTimeout(apply, 900);
    setTimeout(apply, 1600);

    observe();

    console.info('[GoodJunk Mobile Powerups Effect Lock Final]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
