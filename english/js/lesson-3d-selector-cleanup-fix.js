// === /english/js/lesson-3d-selector-cleanup-fix.js ===
// PATCH v20260426g-LESSON-3D-SELECTOR-WHITE-BAR-FIX
// ✅ remove blue/white visual blocker bars behind S1-S15
// ✅ stronger detection for white center bars: material/color/object3D mesh/geometry/scale
// ✅ keep S1-S15 text labels visible
// ✅ keep scene selector usable
// ✅ do not hide whole lesson selector groups
// ✅ PC/Mobile cleanup only; Cardboard keeps scene as-is

(function () {
  'use strict';

  const VERSION = 'v20260426g-LESSON-3D-SELECTOR-WHITE-BAR-FIX';

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

  function getAttrColorText(el) {
    const parts = [];

    try {
      parts.push(safe(el.getAttribute('color')));
    } catch (err) {}

    try {
      parts.push(safe(el.getAttribute('opacity')));
    } catch (err) {}

    try {
      const material = el.getAttribute('material');

      if (material) {
        if (typeof material === 'object') {
          parts.push(safe(material.color));
          parts.push(safe(material.src));
          parts.push(safe(material.shader));
          parts.push(safe(material.opacity));
        } else {
          parts.push(safe(material));
        }
      }
    } catch (err) {}

    try {
      parts.push(safe(el.getAttribute('style')));
    } catch (err) {}

    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  function getMeshColorText(el) {
    const parts = [];

    try {
      if (!el.object3D) return '';

      el.object3D.traverse((obj) => {
        if (!obj || !obj.material) return;

        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

        mats.forEach((m) => {
          try {
            if (m.color && typeof m.color.getHexString === 'function') {
              parts.push(`#${m.color.getHexString()}`);
            }

            if (m.emissive && typeof m.emissive.getHexString === 'function') {
              parts.push(`#${m.emissive.getHexString()}`);
            }

            if (typeof m.opacity !== 'undefined') {
              parts.push(`opacity:${m.opacity}`);
            }

            if (m.name) parts.push(m.name);
          } catch (err) {}
        });
      });
    } catch (err) {}

    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  function getFullColorText(el) {
    return `${getAttrColorText(el)} ${getMeshColorText(el)}`.toLowerCase();
  }

  function getSizeInfo(el) {
    const info = {
      w: 0,
      h: 0,
      d: 0,
      max: 0
    };

    try {
      info.w = Math.max(info.w, Math.abs(Number(el.getAttribute('width') || 0)));
    } catch (err) {}

    try {
      info.h = Math.max(info.h, Math.abs(Number(el.getAttribute('height') || 0)));
    } catch (err) {}

    try {
      info.d = Math.max(info.d, Math.abs(Number(el.getAttribute('depth') || 0)));
    } catch (err) {}

    try {
      const geometry = el.getAttribute('geometry');

      if (geometry && typeof geometry === 'object') {
        info.w = Math.max(info.w, Math.abs(Number(geometry.width || 0)));
        info.h = Math.max(info.h, Math.abs(Number(geometry.height || 0)));
        info.d = Math.max(info.d, Math.abs(Number(geometry.depth || 0)));
      } else if (typeof geometry === 'string') {
        const wm = geometry.match(/width\s*:\s*([\d.]+)/i);
        const hm = geometry.match(/height\s*:\s*([\d.]+)/i);
        const dm = geometry.match(/depth\s*:\s*([\d.]+)/i);

        if (wm) info.w = Math.max(info.w, Number(wm[1]));
        if (hm) info.h = Math.max(info.h, Number(hm[1]));
        if (dm) info.d = Math.max(info.d, Number(dm[1]));
      }
    } catch (err) {}

    try {
      const scale = el.getAttribute('scale');

      if (scale && typeof scale === 'object') {
        info.w = Math.max(info.w, Math.abs(Number(scale.x || 0)));
        info.h = Math.max(info.h, Math.abs(Number(scale.y || 0)));
        info.d = Math.max(info.d, Math.abs(Number(scale.z || 0)));
      } else if (typeof scale === 'string') {
        const nums = scale.split(/\s+/).map(Number).filter(Number.isFinite);
        info.w = Math.max(info.w, Math.abs(nums[0] || 0));
        info.h = Math.max(info.h, Math.abs(nums[1] || 0));
        info.d = Math.max(info.d, Math.abs(nums[2] || 0));
      }
    } catch (err) {}

    try {
      if (el.object3D) {
        const s = el.object3D.scale;
        info.w = Math.max(info.w, Math.abs(Number(s.x || 0)));
        info.h = Math.max(info.h, Math.abs(Number(s.y || 0)));
        info.d = Math.max(info.d, Math.abs(Number(s.z || 0)));
      }
    } catch (err) {}

    info.max = Math.max(info.w, info.h, info.d);

    return info;
  }

  function getPositionInfo(el) {
    const info = {
      x: 0,
      y: 0,
      z: 0
    };

    try {
      const p = el.getAttribute('position');

      if (p && typeof p === 'object') {
        info.x = Number(p.x || 0);
        info.y = Number(p.y || 0);
        info.z = Number(p.z || 0);
      } else if (typeof p === 'string') {
        const nums = p.split(/\s+/).map(Number).filter(Number.isFinite);
        info.x = nums[0] || 0;
        info.y = nums[1] || 0;
        info.z = nums[2] || 0;
      }
    } catch (err) {}

    return info;
  }

  function isWhiteLike(colorText) {
    const s = safe(colorText).toLowerCase();

    return (
      s.includes('#fff') ||
      s.includes('#ffffff') ||
      s.includes('white') ||
      s.includes('rgb(255') ||
      s.includes('rgba(255') ||
      s.includes('#f8') ||
      s.includes('#f9') ||
      s.includes('#fafafa') ||
      s.includes('#f1f5f9') ||
      s.includes('#e2e8f0')
    );
  }

  function isBlueLike(colorText) {
    const s = safe(colorText).toLowerCase();

    return (
      s.includes('#2563eb') ||
      s.includes('#1d4ed8') ||
      s.includes('#0ea5e9') ||
      s.includes('#0284c7') ||
      s.includes('#0000ff') ||
      s.includes('blue') ||
      s.includes('rgb(37,99,235') ||
      s.includes('rgba(37,99,235')
    );
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

    // ห้ามซ่อน group router โดยตรง ถ้าไม่ใช่ plane/box
    if (
      safe(el.getAttribute && el.getAttribute('data-lesson-scene-sid')) ||
      role.includes('lesson-scene-sid-router')
    ) {
      const tagOk = ['a-plane', 'a-box'].includes(tag);
      if (!tagOk) return true;
    }

    return false;
  }

  function isLikelyCenterWhiteBar(el) {
    const tag = safe(el.tagName).toLowerCase();
    if (!['a-plane', 'a-box'].includes(tag)) return false;

    const colorText = getFullColorText(el);
    const size = getSizeInfo(el);
    const pos = getPositionInfo(el);

    const white = isWhiteLike(colorText);
    const largeEnough = size.max >= 0.75 || size.h >= 0.75 || size.w >= 0.75;

    // แถบขาวที่บัง S มักอยู่กลางจอ/กลางฉากและเป็น plane/box ใหญ่
    const nearCenter = Math.abs(pos.x) <= 4.5;

    return white && largeEnough && nearCenter;
  }

  function isBlueWhiteVisualBlocker(el) {
    if (!el) return false;

    const tag = safe(el.tagName).toLowerCase();

    // ซ่อนเฉพาะวัตถุภาพ เช่น plane/box เท่านั้น
    if (!['a-plane', 'a-box'].includes(tag)) return false;

    const color = getFullColorText(el);
    const cls = getClassText(el).toLowerCase();
    const id = safe(el.id).toLowerCase();
    const role = `${id} ${cls}`;
    const size = getSizeInfo(el);

    const isBlue = isBlueLike(color);
    const isWhite = isWhiteLike(color);

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
      size.max >= 0.75 ||
      size.w >= 0.75 ||
      size.h >= 0.75;

    return ((isBlue || isWhite) && looksPanel) || isLikelyCenterWhiteBar(el);
  }

  function hideVisualBlocker(el, reason) {
    if (!el) return;

    try {
      el.setAttribute('visible', 'false');
      el.setAttribute('data-lesson-visual-blocker-hidden', reason || 'blue-white-blocker');
      el.removeAttribute('class');
      el.removeAttribute('material');
      el.removeAttribute('color');
      el.removeAttribute('opacity');
    } catch (err) {}

    try {
      if (el.object3D) {
        el.object3D.visible = false;

        el.object3D.traverse((obj) => {
          if (obj) obj.visible = false;
        });
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

    // 2) เอาเฉพาะแถบ/กล่องฟ้า-ขาวออก รวมถึงแถบขาวตรงกลาง
    $all('a-plane, a-box', scene).forEach((el) => {
      if (shouldSkipEntity(el) && !isLikelyCenterWhiteBar(el)) return;

      if (isBlueWhiteVisualBlocker(el)) {
        hideVisualBlocker(el, 'blue-white-center-bar-blocker');
        hidden += 1;
      }
    });

    // 3) enforce ซ้ำสำหรับ object ที่ถูกซ่อนแล้ว
    $all('[data-lesson-visual-blocker-hidden]', scene).forEach((el) => {
      try {
        el.setAttribute('visible', 'false');

        if (el.object3D) {
          el.object3D.visible = false;
          el.object3D.traverse((obj) => {
            if (obj) obj.visible = false;
          });
        }
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
