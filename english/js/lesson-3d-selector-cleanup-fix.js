// === /english/js/lesson-3d-selector-cleanup-fix.js ===
// PATCH v20260426e-LESSON-3D-SELECTOR-SAFE-NO-HIDE
// ✅ Do NOT hide S1-S15 scene selector anymore
// ✅ Scene selector should remain visible and usable
// ✅ Real routing is handled by lesson-scene-selector-router-fix.js
// ✅ Only strengthens HTML picker button and shows short hint
// ✅ Safe for PC / Mobile / Cardboard

(function () {
  'use strict';

  const VERSION = 'v20260426e-LESSON-3D-SELECTOR-SAFE-NO-HIDE';

  function $(sel, root = document) {
    return root.querySelector(sel);
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

  function ensureHtmlPickerHint() {
    if ($('#lesson3dCleanupHint')) return;

    const mode = getViewMode();

    const hint = document.createElement('div');
    hint.id = 'lesson3dCleanupHint';
    hint.textContent =
      mode === 'cardboard'
        ? 'มอง/เลือก S1–S15 ในฉากเพื่อเริ่มด่าน'
        : 'เลือก S1–S15 ได้จากเมนูในฉาก หรือปุ่ม ☰ มุมซ้ายบน';

    hint.style.cssText = [
      'position:fixed',
      'left:12px',
      'top:56px',
      'z-index:2147483645',
      'max-width:340px',
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

  function cleanupScene(reason) {
    // Intentionally no hiding here.
    // Previous versions hid S1-S15 / blue-white scene objects too aggressively.
    // Scene navigation is now handled by lesson-scene-selector-router-fix.js.
    makePickerButtonStronger();

    console.log('[Lesson3DSelectorSafe]', VERSION, {
      reason,
      mode: getViewMode(),
      note: 'no scene hiding'
    });
  }

  function boot() {
    ensureHtmlPickerHint();
    cleanupScene('boot');

    setTimeout(() => cleanupScene('t500'), 500);
    setTimeout(() => cleanupScene('t1500'), 1500);
    setTimeout(() => cleanupScene('t3000'), 3000);

    [
      'lesson:view-mode-ready',
      'lesson:router-ready',
      'lesson:data-skill-ready',
      'lesson:item-ready'
    ].forEach((name) => {
      window.addEventListener(name, () => cleanupScene(name));
      document.addEventListener(name, () => cleanupScene(`document:${name}`));
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
