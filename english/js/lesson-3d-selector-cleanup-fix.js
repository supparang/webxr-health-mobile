// === /english/js/lesson-3d-selector-cleanup-fix.js ===
// PATCH v20260426f-LESSON-3D-SELECTOR-VISUAL-BLOCKER-ONLY
// ✅ remove blue/white visual blocker bars behind S1-S15
// ✅ keep S1-S15 text labels visible
// ✅ keep scene selector usable
// ✅ do not hide whole lesson selector groups
// ✅ safe null material handling
// ✅ PC/Mobile cleanup only; Cardboard keeps scene as-is

(function () {
  'use strict';

  const VERSION = 'v20260426f-LESSON-3D-SELECTOR-VISUAL-BLOCKER-ONLY';

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function safe(v) {
    return String(v == null ? '' : v).trim();
  }

  function q() {
    return new URLSearchParams(location.search || '');
  }

  function getViewMode() {
    try {
      if (window.LESSON_VIEW_MODE) return String(window.LESSON_VIEW_MODE);
    } catch (err) {}

    const ds = document.documentElement.dataset.lessonViewMode;
    if (ds) return ds;

    const view = safe(q().get('view')).toLowerCase();

    if (['vr', 'cvr', 'cardboard', 'cardboard-vr'].includes(view)) return 'cardboard';
    if (['mobile', 'phone'].includes(view)) return 'mobile';

    return 'pc';
  }

  function getClassText(el) {
    if (!el) return '';

    try {
      if (typeof el.className === 'string') return el.className;
      if (el.className && typeof el.className.baseVal === 'string') return el.className.baseVal;
      if (el.getAttribute) return safe(el.getAttribute('class'));
    } catch (err) {}

    return '';
  }

  function getTextValue(el) {
    if (!el) return '';

    try {
      const value = el.getAttribute('value');
      if (value) return String(value);
    } catch (err) {}

    try {
      const text = el.getAttribute('text');

      if (text && typeof text === 'object' && text.value) return String(text.value);
      if (typeof text === 'string') return text;
    } catch (err) {}

    return '';
  }

  function looksLikeSessionText(value) {
    const s = safe(value);

    return (
      /^S([1-9]|1[0-5])\b/i.test(s) ||
      /\bS([1-9]|1[0-5])\b/i.test(s) ||
      /Self.?Introduction/i.test(s) ||
      /Academic.?Background/i.test(s) ||
      /Tech.?Jobs/i.test(s) ||
      /Emails?/i.test(s) ||
      /Chat/i.test(s) ||
      /Bug/i.test(s) ||
      /Client/i.test(s) ||
      /Career/i.test(s) ||
      /Final/i.test(s) ||
      /Capstone/i.test(s)
    );
  }

  function getMaterialColorText(el) {
    if (!el) return '';

    try {
      const material = el.getAttribute('material');

      if (!material) return '';

      if (typeof material === 'object') {
        return safe(
          material.color ||
          material.src ||
          material.shader ||
          ''
        );
      }

      return safe(material);
    } catch (err) {
      return '';
    }
  }

  function getSizeScore(el) {
    let w = 0;
    let h = 0;
    let d = 0;

    try {
      w = Number(el.getAttribute('width') || 0);
    } catch (err) {}

    try {
      h = Number(el.getAttribute('height') || 0);
    } catch (err) {}

    try {
      d = Number(el.getAttribute('depth') || 0);
    } catch (err) {}

    try {
      const scale = el.getAttribute('scale');
      if (scale && typeof scale === 'object') {
        w = Math.max(w, Math.abs(Number(scale.x || 0)));
        h = Math.max(h, Math.abs(Number(scale.y || 0)));
        d = Math.max(d, Math.abs(Number(scale.z || 0)));
      }
    } catch (err) {}

    return Math.max(w, h, d);
  }

  function shouldSkipEntity(el) {
    if (!el) return true;

    const tag = safe(el.tagName).toLowerCase();
    const id = safe(el.id).toLowerCase();
    const cls = getClassText(el).toLowerCase();
    const role = `${id} ${cls}`;

    // ห้ามซ่อน text S1-S15 เอง
    if (tag === 'a-text') return true;

    // ห้ามซ่อน UI ใหม่ของเรา
    if (
      id.includes('lessonmission') ||
      id.includes('lessonspeaking') ||
      id.includes('lessonwriting') ||
      id.includes('lessonai') ||
      id.includes('lessonpcsession')
    ) {
      return true;
    }

    // ห้ามซ่อน entity ที่มีข้อความ S เพราะอาจเป็น label/group ที่ใช้ route
    const txt = getTextValue(el);
    if (looksLikeSessionText(txt)) return true;

    // ห้ามซ่อนสิ่งที่ router mark ไว้เป็น selector โดยตรง
    if (
      safe(el.getAttribute && el.getAttribute('data-lesson-scene-sid')) ||
      role.includes('lesson-scene-sid-router')
    ) {
      // ยกเว้นถ้าเป็น a-plane/a-box สีฟ้า-ขาวจริง ๆ จะตรวจต่อใน visual blocker
      const tagOk = ['a-plane', 'a-box'].includes(tag);
      if (!tagOk) return true;
    }

    return false;
  }

  function isBlueWhiteVisualBlocker(el) {
    if (!el) return false;

    const tag = safe(el.tagName).toLowerCase();

    // สำคัญ: ซ่อนเฉพาะวัตถุภาพ เช่น plane/box เท่านั้น
    // ไม่ซ่อน a-entity ทั้งก้อน เพราะจะทำให้ selector ใช้ไม่ได้
    if (!['a-plane', 'a-box'].includes(tag)) return false;

    const color = getMaterialColorText(el).toLowerCase();
    const cls = getClassText(el).toLowerCase();
    const id = safe(el.id).toLowerCase();
    const role = `${id} ${cls}`;

    const isBlue =
      color.includes('#2563eb') ||
      color.includes('#1d4ed8') ||
      color.includes('#0ea5e9') ||
      color.includes('#0000ff') ||
      color.includes('blue');

    const isWhite =
      color.includes('#fff') ||
      color.includes('#ffffff') ||
      color.includes('white');

    const looksPanel =
      role.includes('background') ||
      role.includes('backdrop') ||
      role.includes('panel') ||
      role.includes('block') ||
      role.includes('card') ||
      role.includes('selector') ||
      role.includes('lesson') ||
      role.includes('session') ||
      role.includes('gate') ||
      getSizeScore(el) >= 1.2;

    // ถ้าเป็นกล่อง/แถบสีฟ้า-ขาวและมีลักษณะเป็น panel ให้เอาออก
    return (isBlue || isWhite) && looksPanel;
  }

  function hideVisualBlocker(el, reason) {
    if (!el) return;

    try {
      el.setAttribute('visible', 'false');
      el.setAttribute('data-lesson-visual-blocker-hidden', reason || 'blue-white-blocker');
      el.removeAttribute('class');
    } catch (err) {}

    try {
      if (el.object3D) {
        el.object3D.visible = false;
      }
    } catch (err) {}
  }

  function makeTextReadable(el) {
    if (!el) return;

    try {
      const tag = safe(el.tagName).toLowerCase();
      if (tag !== 'a-text') return;

      const text = getTextValue(el);
      if (!looksLikeSessionText(text)) return;

      // ให้ตัวหนังสืออยู่หน้า และอ่านง่ายขึ้น
      el.setAttribute('visible', 'true');
      el.setAttribute('color', '#ffffff');
      el.setAttribute('align', el.getAttribute('align') || 'center');
      el.setAttribute('side', 'double');
      el.setAttribute('data-lesson-session-text-kept', VERSION);

      if (el.object3D) {
        el.object3D.visible = true;
        el.object3D.renderOrder = 999;
      }
    } catch (err) {}
  }

  function cleanupScene(reason) {
    const mode = getViewMode();

    // Cardboard VR ยังไม่แตะ scene เพื่อไม่ให้ raycast/VR selector พัง
    if (mode === 'cardboard') return;

    const scene = $('a-scene');
    if (!scene) return;

    let hidden = 0;
    let keptText = 0;

    // 1) รักษา text S1-S15 ไว้
    $all('a-text, [text]', scene).forEach((el) => {
      const txt = getTextValue(el);
      if (looksLikeSessionText(txt)) {
        makeTextReadable(el);
        keptText += 1;
      }
    });

    // 2) เอาเฉพาะแถบ/กล่องฟ้า-ขาวออก
    $all('a-plane, a-box', scene).forEach((el) => {
      if (shouldSkipEntity(el) && !isBlueWhiteVisualBlocker(el)) return;

      if (isBlueWhiteVisualBlocker(el)) {
        hideVisualBlocker(el, 'blue-white-visual-blocker');
        hidden += 1;
      }
    });

    // 3) กัน raycast ของวัตถุที่ถูกซ่อนแล้ว
    $all('[data-lesson-visual-blocker-hidden]', scene).forEach((el) => {
      try {
        el.setAttribute('visible', 'false');
        if (el.object3D) el.object3D.visible = false;
      } catch (err) {}
    });

    console.log('[Lesson3DSelectorCleanup]', VERSION, {
      mode,
      reason,
      hiddenBlueWhiteBlocks: hidden,
      keptSessionText: keptText
    });
  }

  function ensureHtmlPickerHint() {
    if ($('#lesson3dCleanupHint')) return;

    const hint = document.createElement('div');
    hint.id = 'lesson3dCleanupHint';
    hint.textContent = 'เลือก S1–S15 ได้จากตัวหนังสือในฉาก หรือปุ่ม ☰ มุมซ้ายบน';
    hint.style.cssText = [
      'position:fixed',
      'left:12px',
      'top:56px',
      'z-index:2147483645',
      'max-width:360px',
      'padding:8px 12px',
      'border-radius:999px',
      'background:rgba(15,23,42,.84)',
      'border:1px solid rgba(125,211,252,.42)',
      'color:#e0faff',
      'font:800 12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'box-shadow:0 12px 30px rgba(0,0,0,.24)',
      'pointer-events:none'
    ].join(';');

    document.body.appendChild(hint);

    setTimeout(() => {
      hint.style.display = 'none';
    }, 5000);
  }

  function makePickerButtonStronger() {
    const btn = $('#lessonPcSessionOpenBtn');
    if (!btn) return;

    btn.style.zIndex = '2147483647';
    btn.style.pointerEvents = 'auto';
    btn.style.background = 'rgba(8,18,38,.96)';
    btn.style.border = '1px solid rgba(125,211,252,.82)';
    btn.style.boxShadow = '0 16px 42px rgba(0,0,0,.38)';
  }

  function boot() {
    ensureHtmlPickerHint();
    makePickerButtonStronger();

    cleanupScene('boot');

    setTimeout(() => cleanupScene('t500'), 500);
    setTimeout(() => cleanupScene('t1500'), 1500);
    setTimeout(() => cleanupScene('t3000'), 3000);
    setTimeout(() => cleanupScene('t5000'), 5000);

    [
      'lesson:view-mode-ready',
      'lesson:router-ready',
      'lesson:data-skill-ready',
      'lesson:item-ready',
      'loaded',
      'renderstart'
    ].forEach((name) => {
      window.addEventListener(name, () => {
        cleanupScene(name);
        makePickerButtonStronger();
      });

      document.addEventListener(name, () => {
        cleanupScene(`document:${name}`);
        makePickerButtonStronger();
      });
    });

    window.LESSON_3D_SELECTOR_CLEANUP_FIX = {
      version: VERSION,
      cleanup: cleanupScene
    };

    console.log('[Lesson3DSelectorCleanup]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
