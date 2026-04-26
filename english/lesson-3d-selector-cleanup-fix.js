// === /english/js/lesson-3d-selector-cleanup-fix.js ===
// PATCH v20260426c-LESSON-3D-SELECTOR-CLEANUP
// Fix: 3D blue/white blocks and S1-S15 labels block lesson selection.
// PC/Mobile should use HTML session picker only.
// Cardboard can keep VR scene UI.

(function () {
  'use strict';

  const VERSION = 'v20260426c-LESSON-3D-SELECTOR-CLEANUP';

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

  function looksLikeSessionText(value) {
    const s = safe(value);

    return (
      /^S([1-9]|1[0-5])\b/i.test(s) ||
      /\bS([1-9]|1[0-5])\b/i.test(s) ||
      /Self.?Introduction/i.test(s) ||
      /Academic.?Background/i.test(s) ||
      /Tech.?Jobs/i.test(s) ||
      /Bug/i.test(s) ||
      /Client/i.test(s) ||
      /Career/i.test(s) ||
      /Graduation/i.test(s) ||
      /VRLessonReady/i.test(s) ||
      /VR Lesson Ready/i.test(s)
    );
  }

  function getTextValue(el) {
    if (!el) return '';

    const value = el.getAttribute('value');
    if (value) return String(value);

    const text = el.getAttribute('text');
    if (text && typeof text === 'object' && text.value) return String(text.value);
    if (typeof text === 'string') return text;

    return '';
  }

  function hideEntity(el, reason) {
    if (!el) return;

    el.setAttribute('visible', 'false');
    el.setAttribute('data-lesson-hidden-by-cleanup', reason || 'cleanup');

    try {
      el.object3D.visible = false;
    } catch (err) {}
  }

  function isBlueWhiteBlock(el) {
    const tag = String(el.tagName || '').toLowerCase();
    if (!['a-box', 'a-plane', 'a-entity'].includes(tag)) return false;

    const material = el.getAttribute('material');
    const color =
      typeof material === 'object'
        ? String(material.color || '')
        : String(material || '');

    const cls = String(el.className || '').toLowerCase();
    const id = String(el.id || '').toLowerCase();

    const role = `${id} ${cls}`;

    if (
      role.includes('session') ||
      role.includes('lesson') ||
      role.includes('select') ||
      role.includes('card') ||
      role.includes('panel') ||
      role.includes('block') ||
      role.includes('gate')
    ) {
      return true;
    }

    return (
      color.includes('#fff') ||
      color.includes('white') ||
      color.includes('#ffffff') ||
      color.includes('#2563eb') ||
      color.includes('blue') ||
      color.includes('#1d4ed8') ||
      color.includes('#0ea5e9')
    );
  }

  function cleanupScene(reason) {
    const mode = getViewMode();

    // Cardboard VR may need scene objects, so do not hide them there.
    if (mode === 'cardboard') return;

    const scene = $('a-scene');
    if (!scene) return;

    // Hide old 3D S1-S15 text labels.
    $all('a-text, [text]', scene).forEach((el) => {
      const v = getTextValue(el);

      if (looksLikeSessionText(v)) {
        hideEntity(el, 'session-text');
      }
    });

    // Hide likely blocking blue/white cards/planes around 3D selector.
    $all('a-box, a-plane, a-entity', scene).forEach((el) => {
      const txt = getTextValue(el);

      if (looksLikeSessionText(txt) || isBlueWhiteBlock(el)) {
        hideEntity(el, 'blocking-selector-object');
      }
    });

    // Keep the core scene visible but remove mouse picking from old selector objects.
    $all('[class*="click"], [class*="select"], [class*="session"], [id*="session"], [id*="lesson"]', scene)
      .forEach((el) => {
        if (String(el.id || '').includes('lessonSpeakingVr')) return;
        if (String(el.id || '').includes('lessonVrReadableBoard')) return;

        hideEntity(el, 'old-clickable-selector');
      });

    console.log('[Lesson3DSelectorCleanup]', VERSION, { mode, reason });
  }

  function ensureHtmlPickerHint() {
    if ($('#lesson3dCleanupHint')) return;

    const hint = document.createElement('div');
    hint.id = 'lesson3dCleanupHint';
    hint.textContent = 'ใช้ปุ่ม ☰ เลือก S1–S15 มุมซ้ายบนเพื่อเลือกด่าน';
    hint.style.cssText = [
      'position:fixed',
      'left:12px',
      'top:56px',
      'z-index:2147483645',
      'max-width:300px',
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

    cleanupScene('boot');
    makePickerButtonStronger();

    setTimeout(() => cleanupScene('t500'), 500);
    setTimeout(() => cleanupScene('t1500'), 1500);
    setTimeout(() => cleanupScene('t3000'), 3000);
    setTimeout(() => cleanupScene('t5000'), 5000);

    [
      'lesson:view-mode-ready',
      'lesson:router-ready',
      'lesson:data-skill-ready',
      'lesson:item-ready'
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
