/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.zone-select-fix.js
 * PATCH v20260514-P49-BRUSH-KIDS-ZONE-SELECT-FIX
 *
 * Purpose:
 * - แก้ปัญหาเลือกได้แค่ zone เดียว / คลิก zone ไม่ติด
 * - ทำให้ data-zone และ data-ring-zone กดได้ชัดทั้ง PC/Mobile
 * - ถ้า brushInputLayer ทับ ring จะใช้ elementsFromPoint หา ring ด้านล่างแล้ว click ให้
 * - ไม่ยุ่งกับ logic core ใน brush.js
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const PATCH_ID = 'v20260514-P49-BRUSH-KIDS-ZONE-SELECT-FIX';

  const ZONES = [
    'upper-left',
    'upper-front',
    'upper-right',
    'lower-left',
    'lower-front',
    'lower-right'
  ];

  let lastZoneTapAt = 0;
  let lastZoneId = '';
  let lastPointer = null;

  function log(){
    try{
      console.log('[BrushZoneSelectFix]', PATCH_ID, ...arguments);
    }catch(_){}
  }

  function qs(sel, root){
    try{
      return Array.from((root || DOC).querySelectorAll(sel));
    }catch(_){
      return [];
    }
  }

  function isSummaryOpen(){
    const modal = DOC.getElementById('summaryModal');
    return !!(modal && !modal.hidden);
  }

  function isZoneId(v){
    return ZONES.includes(String(v || ''));
  }

  function zoneIdFromElement(el){
    if(!el) return '';

    const z1 = el.getAttribute && el.getAttribute('data-zone');
    if(isZoneId(z1)) return z1;

    const z2 = el.getAttribute && el.getAttribute('data-ring-zone');
    if(isZoneId(z2)) return z2;

    return '';
  }

  function closestZoneElement(target){
    try{
      if(!target || !target.closest) return null;
      return target.closest('[data-zone],[data-ring-zone]');
    }catch(_){
      return null;
    }
  }

  function elementsFromPoint(x, y){
    try{
      if(typeof DOC.elementsFromPoint === 'function'){
        return DOC.elementsFromPoint(x, y) || [];
      }

      const one = DOC.elementFromPoint(x, y);
      return one ? [one] : [];
    }catch(_){
      return [];
    }
  }

  function zoneElementFromPoint(x, y){
    const els = elementsFromPoint(x, y);

    for(const el of els){
      const direct = closestZoneElement(el);
      if(direct && isZoneId(zoneIdFromElement(direct))){
        return direct;
      }
    }

    return null;
  }

  function markActiveZone(zoneId){
    if(!isZoneId(zoneId)) return;

    qs('[data-zone]').forEach((node) => {
      const id = zoneIdFromElement(node);
      const active = id === zoneId;

      node.classList.toggle('active', active);
      node.classList.toggle('is-zone-active', active);

      if(active && node.dataset.state !== 'done'){
        node.dataset.state = 'active';
      }else if(node.dataset.state === 'active'){
        node.dataset.state = 'idle';
      }
    });

    qs('[data-ring-zone]').forEach((ring) => {
      const id = zoneIdFromElement(ring);
      const active = id === zoneId;

      ring.classList.toggle('is-zone-active', active);
      ring.classList.toggle('is-scene-focus', active);
      ring.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const root = DOC.documentElement;
    if(root){
      root.setAttribute('data-brush-active-zone', zoneId);
    }

    const body = DOC.body;
    if(body){
      body.setAttribute('data-brush-active-zone', zoneId);
    }
  }

  function setCoachHint(zoneId){
    const labels = {
      'upper-left': 'บนซ้าย',
      'upper-front': 'บนหน้า',
      'upper-right': 'บนขวา',
      'lower-left': 'ล่างซ้าย',
      'lower-front': 'ล่างหน้า',
      'lower-right': 'ล่างขวา'
    };

    const line = DOC.getElementById('coachLine');
    if(line && isZoneId(zoneId)){
      line.textContent = `เลือกโซน ${labels[zoneId] || zoneId} แล้ว ลากแปรงที่ช่องปากได้เลย`;
    }

    const banner = DOC.getElementById('targetBannerText');
    if(banner && isZoneId(zoneId)){
      banner.textContent = `กำลังแปรงโซน ${labels[zoneId] || zoneId}`;
    }
  }

  function dispatchZoneSelected(zoneId, source){
    if(!isZoneId(zoneId)) return;

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-zone-selected', {
        detail: {
          zoneId,
          source: source || 'zone-select-fix',
          patch: PATCH_ID
        }
      }));
    }catch(_){}

    try{
      DOC.dispatchEvent(new CustomEvent('hha:brush-zone-selected', {
        bubbles:true,
        detail: {
          zoneId,
          source: source || 'zone-select-fix',
          patch: PATCH_ID
        }
      }));
    }catch(_){}
  }

  function safeClick(el){
    if(!el) return false;

    try{
      el.click();
      return true;
    }catch(_){}

    try{
      const ev = new MouseEvent('click', {
        bubbles:true,
        cancelable:true,
        view:WIN
      });
      el.dispatchEvent(ev);
      return true;
    }catch(_){
      return false;
    }
  }

  function selectZoneElement(el, source){
    const zoneId = zoneIdFromElement(el);
    if(!isZoneId(zoneId)) return false;

    const now = Date.now();

    /*
     * กัน double click จาก native click + synthetic click
     */
    if(zoneId === lastZoneId && now - lastZoneTapAt < 120){
      return true;
    }

    lastZoneId = zoneId;
    lastZoneTapAt = now;

    markActiveZone(zoneId);
    setCoachHint(zoneId);
    dispatchZoneSelected(zoneId, source);

    /*
     * สำคัญ:
     * ให้ click เดิมของ brush.js ทำงาน เพื่อเรียก onZoneSelect() จริง
     */
    safeClick(el);

    log('selected', zoneId, source || '');
    return true;
  }

  function handleDirectZoneTap(ev, source){
    if(isSummaryOpen()) return false;

    const el = closestZoneElement(ev.target);
    if(!el) return false;

    const zoneId = zoneIdFromElement(el);
    if(!isZoneId(zoneId)) return false;

    selectZoneElement(el, source || 'direct');

    return true;
  }

  function handlePointZoneTap(ev, source){
    if(isSummaryOpen()) return false;

    const x = Number(ev.clientX || 0);
    const y = Number(ev.clientY || 0);
    if(!x && !y) return false;

    const el = zoneElementFromPoint(x, y);
    if(!el) return false;

    const zoneId = zoneIdFromElement(el);
    if(!isZoneId(zoneId)) return false;

    selectZoneElement(el, source || 'point');

    return true;
  }

  function bindCaptureZoneTaps(){
    /*
     * Capture phase: จับก่อน brushInputLayer จะกิน event
     */
    DOC.addEventListener('pointerdown', function(ev){
      const direct = handleDirectZoneTap(ev, 'pointerdown-direct');

      if(!direct){
        handlePointZoneTap(ev, 'pointerdown-point');
      }

      lastPointer = {
        x: Number(ev.clientX || 0),
        y: Number(ev.clientY || 0),
        t: Date.now()
      };
    }, true);

    DOC.addEventListener('pointerup', function(ev){
      const direct = handleDirectZoneTap(ev, 'pointerup-direct');

      if(!direct){
        handlePointZoneTap(ev, 'pointerup-point');
      }
    }, true);

    DOC.addEventListener('click', function(ev){
      const ok = handleDirectZoneTap(ev, 'click-direct');

      if(!ok){
        handlePointZoneTap(ev, 'click-point');
      }
    }, true);
  }

  function bindKeyboardZoneHotkeys(){
    WIN.addEventListener('keydown', function(ev){
      if(isSummaryOpen()) return;

      const map = {
        Digit1: 'upper-left',
        Digit2: 'upper-front',
        Digit3: 'upper-right',
        Digit4: 'lower-left',
        Digit5: 'lower-front',
        Digit6: 'lower-right',
        Numpad1: 'upper-left',
        Numpad2: 'upper-front',
        Numpad3: 'upper-right',
        Numpad4: 'lower-left',
        Numpad5: 'lower-front',
        Numpad6: 'lower-right'
      };

      const zoneId = map[ev.code];
      if(!zoneId) return;

      const el =
        DOC.querySelector(`[data-zone="${zoneId}"]`) ||
        DOC.querySelector(`[data-ring-zone="${zoneId}"]`);

      if(el){
        ev.preventDefault();
        selectZoneElement(el, 'keyboard-number');
      }
    }, true);
  }

  function ensureStyle(){
    if(DOC.getElementById('hha-brush-zone-select-fix-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-brush-zone-select-fix-style';
    style.textContent = `
      [data-zone],
      [data-ring-zone]{
        -webkit-tap-highlight-color:rgba(34,197,94,.18);
      }

      [data-zone]{
        pointer-events:auto !important;
        user-select:none;
        cursor:pointer;
        position:relative;
        z-index:90;
      }

      /*
       * ring ต้องอยู่เหนือ brushInputLayer ตอนเลือกโซน
       * แต่ถ้า core ใส่ .is-hidden-scene ให้ยังปิดได้เหมือนเดิม
       */
      [data-ring-zone]:not(.is-hidden-scene){
        pointer-events:auto !important;
        cursor:pointer;
        z-index:120 !important;
      }

      [data-ring-zone].is-hidden-scene{
        pointer-events:none !important;
      }

      [data-zone].is-zone-active,
      [data-zone].active,
      [data-zone][data-state="active"]{
        border-color:#ffd95d !important;
        background:#fff8dc !important;
        box-shadow:0 0 0 4px rgba(255,217,93,.20) !important;
      }

      [data-ring-zone].is-zone-active,
      [data-ring-zone].is-scene-focus{
        outline:5px solid rgba(255,217,93,.30) !important;
        box-shadow:
          0 0 0 8px rgba(255,217,93,.20),
          0 16px 32px rgba(23,56,79,.16) !important;
      }

      body[data-brush-active-zone="upper-left"] [data-ring-zone="upper-left"],
      body[data-brush-active-zone="upper-front"] [data-ring-zone="upper-front"],
      body[data-brush-active-zone="upper-right"] [data-ring-zone="upper-right"],
      body[data-brush-active-zone="lower-left"] [data-ring-zone="lower-left"],
      body[data-brush-active-zone="lower-front"] [data-ring-zone="lower-front"],
      body[data-brush-active-zone="lower-right"] [data-ring-zone="lower-right"]{
        outline:5px solid rgba(255,217,93,.30) !important;
      }

      #brushInputLayer{
        touch-action:none;
      }
    `;

    DOC.head.appendChild(style);
  }

  function expose(){
    WIN.HHA_BRUSH_ZONE_SELECT_FIX = {
      patch: PATCH_ID,
      select(zoneId){
        const el =
          DOC.querySelector(`[data-zone="${zoneId}"]`) ||
          DOC.querySelector(`[data-ring-zone="${zoneId}"]`);

        if(!el) return false;
        return selectZoneElement(el, 'api');
      },
      markActiveZone,
      zoneElementFromPoint,
      last(){
        return {
          zoneId: lastZoneId,
          at: lastZoneTapAt,
          pointer: lastPointer
        };
      }
    };
  }

  function boot(){
    ensureStyle();
    bindCaptureZoneTaps();
    bindKeyboardZoneHotkeys();
    expose();

    markActiveZone('upper-front');

    log('booted');
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();
