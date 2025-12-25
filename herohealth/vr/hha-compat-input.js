// === /herohealth/vr/hha-compat-input.js ===
// HeroHealth — Input Compatibility Layer (UNIVERSAL)
// ✅ FIX: กัน "ต้องกด 2 ที" / กัน click ซ้ำหลัง touch (mobile browsers ชอบยิงซ้อน)
// ✅ FIX: ลด double-fire เมื่อมีทั้ง touchstart + click + pointerdown
// ✅ Works: Android Chrome / Samsung Internet / iOS Safari / Desktop
// ✅ Safe: ไม่แตะเกม logic โดยตรง แค่กัน event ซ้ำ + normalize บางเคส

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // -------------------- Config --------------------
  const CLICK_AFTER_TOUCH_BLOCK_MS = 650;  // กัน click ที่ตามมาหลัง touch
  const POINTER_AFTER_TOUCH_BLOCK_MS = 80; // กัน pointerdown ซ้อนทันทีหลัง touchstart (บางเครื่องยิงติดกัน)

  // -------------------- State --------------------
  let lastTouchAt = 0;
  let lastTouchTarget = null;

  // กันซ้ำ per-target (บาง element จะยิงทั้ง pointerdown + click)
  const lastFire = new WeakMap(); // target -> time

  function now() { return performance.now(); }
  function isInteractiveTarget(t) {
    if (!t) return false;
    // ถ้ากดบน UI/button ให้ผ่าน (ไม่ block)
    return !!(t.closest && (t.closest('button') || t.closest('.btn') || t.closest('a') || t.closest('input') || t.closest('select') || t.closest('textarea')));
  }

  function markFire(t) {
    try { lastFire.set(t, now()); } catch (_) {}
  }
  function firedRecently(t, ms) {
    try {
      const v = lastFire.get(t);
      return (typeof v === 'number') && (now() - v <= ms);
    } catch (_) { return false; }
  }

  // -------------------- Core: touch -> click dedupe --------------------
  // หลักการ: บนมือถือ "touchstart" แล้วเบราเซอร์จะยิง "click" ซ้ำตามมา
  // ถ้าเกมผูกทั้ง touch + click (หรือ pointer) จะดูเหมือน "ต้องกด 2 ที" หรือ "กดทีเดียวแต่นับ 2"
  function onTouchStartCapture(e) {
    // อย่ารบกวนปุ่ม UI
    if (isInteractiveTarget(e.target)) return;

    lastTouchAt = now();
    lastTouchTarget = e.target || null;

    // IMPORTANT: ไม่ preventDefault ที่นี่ เพื่อไม่ทำให้ pointer events บางรุ่นมีพฤติกรรมแปลก
    // แต่เราจะ block click ที่ตามมาทีหลังแทน
  }

  function shouldBlockSyntheticClick(e) {
    const t = now();
    if (!lastTouchAt) return false;
    if (t - lastTouchAt > CLICK_AFTER_TOUCH_BLOCK_MS) return false;

    // ถ้าเป็น UI/button ให้ผ่าน
    if (isInteractiveTarget(e.target)) return false;

    // ถ้า click มาจาก target เดียวกัน (หรือใกล้เคียง) ให้ block
    // หมายเหตุ: บาง browser target ไม่ตรง 100% จึงเช็คแค่ “ภายใต้ช่วงเวลา” ก็พอ
    return true;
  }

  function onClickCapture(e) {
    // ถ้าเป็น click ที่ตามหลัง touch -> block เพื่อลด double-fire
    if (shouldBlockSyntheticClick(e)) {
      try {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation && e.stopImmediatePropagation();
      } catch (_) {}
      return;
    }

    // กัน click ซ้ำเร็ว ๆ บน element เดิม
    if (e && e.target && firedRecently(e.target, 55)) {
      try {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation && e.stopImmediatePropagation();
      } catch (_) {}
      return;
    }
    if (e && e.target) markFire(e.target);
  }

  // -------------------- Core: pointerdown/touchstart dedupe --------------------
  function onPointerDownCapture(e) {
    // ถ้าเป็น UI/button ให้ผ่าน
    if (isInteractiveTarget(e.target)) return;

    // ถ้า pointerdown ซ้อนหลัง touchstart ทันที (บางเครื่องยิงติดกัน) -> block
    const t = now();
    if (lastTouchAt && (t - lastTouchAt <= POINTER_AFTER_TOUCH_BLOCK_MS)) {
      try {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation && e.stopImmediatePropagation();
      } catch (_) {}
      return;
    }

    // กัน pointerdown ซ้ำเร็ว ๆ บน target เดิม
    if (e && e.target && firedRecently(e.target, 45)) {
      try {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation && e.stopImmediatePropagation();
      } catch (_) {}
      return;
    }
    if (e && e.target) markFire(e.target);
  }

  // -------------------- Optional: normalize touch-action --------------------
  // เกมส่วนใหญ่ต้องการ “แตะแล้วเกิด action ทันที” + ไม่ให้ browser delay/zoom
  function injectTouchActionSafety() {
    const st = doc.createElement('style');
    st.textContent = `
      html,body{ touch-action: manipulation; }
      a-scene, canvas{ touch-action: none; }
      .plate-layer, .hha-fx-layer{ touch-action: none; }
    `;
    doc.head && doc.head.appendChild(st);
  }

  // -------------------- Attach listeners (capture phase สำคัญ) --------------------
  // ใช้ capture เพื่อ "ดักก่อน" ที่เกมจะรับ event
  doc.addEventListener('touchstart', onTouchStartCapture, { passive: true, capture: true });
  doc.addEventListener('click', onClickCapture, { passive: false, capture: true });

  // PointerEvent มีใน browser ใหม่เกือบหมด
  if (root.PointerEvent) {
    doc.addEventListener('pointerdown', onPointerDownCapture, { passive: false, capture: true });
  } else {
    // fallback: mousedown
    doc.addEventListener('mousedown', onPointerDownCapture, { passive: false, capture: true });
  }

  injectTouchActionSafety();

  // -------------------- Export tiny debug hook (optional) --------------------
  root.HHAInputCompat = {
    get lastTouchAt() { return lastTouchAt; },
    get lastTouchTarget() { return lastTouchTarget; }
  };

})(typeof window !== 'undefined' ? window : globalThis);