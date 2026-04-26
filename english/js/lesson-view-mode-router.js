// === /english/js/lesson-view-mode-router.js ===
// PATCH v20260424f-LESSON-VIEW-MODE-ROUTER
// Detect 3 display modes: PC, Mobile, Cardboard VR
// Sets document classes + global LESSON_VIEW_MODE for all lesson modules.

(function () {
  'use strict';

  const VERSION = 'v20260424f-LESSON-VIEW-MODE-ROUTER';

  const MODE = {
    PC: 'pc',
    MOBILE: 'mobile',
    CARDBOARD: 'cardboard'
  };

  function q() {
    return new URLSearchParams(location.search || '');
  }

  function safe(v) {
    return String(v == null ? '' : v).trim();
  }

  function normalizeView(v) {
    const raw = safe(v).toLowerCase();

    if (
      raw === 'pc' ||
      raw === 'desktop' ||
      raw === 'web' ||
      raw === 'mouse' ||
      raw === 'keyboard'
    ) {
      return MODE.PC;
    }

    if (
      raw === 'mobile' ||
      raw === 'phone' ||
      raw === 'touch' ||
      raw === 'portrait'
    ) {
      return MODE.MOBILE;
    }

    if (
      raw === 'vr' ||
      raw === 'cvr' ||
      raw === 'cardboard' ||
      raw === 'cardboard-vr' ||
      raw === 'viewer' ||
      raw === 'headset'
    ) {
      return MODE.CARDBOARD;
    }

    return '';
  }

  function isCoarsePointer() {
    try {
      return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    } catch (err) {
      return false;
    }
  }

  function isSmallScreen() {
    return Math.min(window.innerWidth || 9999, window.innerHeight || 9999) <= 760;
  }

  function isPortrait() {
    return (window.innerHeight || 0) >= (window.innerWidth || 0);
  }

  function isMobileUA() {
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
  }

  function detectMode() {
    const p = q();

    // 1) URL always wins.
    const explicit = normalizeView(
      p.get('view') ||
      p.get('display') ||
      p.get('device') ||
      p.get('modeView') ||
      ''
    );

    if (explicit) return explicit;

    // 2) Legacy mode values.
    const mode = normalizeView(p.get('mode') || '');
    if (mode) return mode;

    // 3) If A-Frame enters VR later, another listener will switch to Cardboard.
    // Default device inference:
    if (isMobileUA() || isCoarsePointer() || isSmallScreen()) {
      return MODE.MOBILE;
    }

    return MODE.PC;
  }

  let currentMode = detectMode();

  function modeLabel(mode) {
    if (mode === MODE.PC) return 'PC';
    if (mode === MODE.MOBILE) return 'Mobile';
    if (mode === MODE.CARDBOARD) return 'Cardboard VR';
    return 'Unknown';
  }

  function modeConfig(mode) {
    if (mode === MODE.PC) {
      return {
        mode,
        label: 'PC',
        input: 'mouse-keyboard',
        layout: 'wide-panel',
        useHtmlPanel: true,
        useVrBoard: false,
        useCrosshair: false,
        allowTyping: true,
        allowSpeech: true,
        compactHud: false,
        notes: 'Show full dashboard, large cards, mouse/keyboard controls.'
      };
    }

    if (mode === MODE.MOBILE) {
      return {
        mode,
        label: 'Mobile',
        input: 'touch',
        layout: 'bottom-sheet',
        useHtmlPanel: true,
        useVrBoard: false,
        useCrosshair: false,
        allowTyping: true,
        allowSpeech: true,
        compactHud: true,
        notes: 'Show touch-friendly bottom panel with large buttons.'
      };
    }

    return {
      mode: MODE.CARDBOARD,
      label: 'Cardboard VR',
      input: 'gaze-tap',
      layout: 'vr-board',
      useHtmlPanel: false,
      useVrBoard: true,
      useCrosshair: true,
      allowTyping: false,
      allowSpeech: true,
      compactHud: true,
      notes: 'Use in-scene board, crosshair/gaze/tap, minimal HTML overlay.'
    };
  }

  function ensureCSS() {
    if (document.getElementById('lesson-view-mode-router-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-view-mode-router-css';
    style.textContent = `
      html.lesson-mode-pc,
      html.lesson-mode-mobile,
      html.lesson-mode-cardboard{
        --lesson-safe-bottom: max(12px, env(safe-area-inset-bottom));
      }

      html.lesson-mode-pc body{
        overflow:auto;
      }

      html.lesson-mode-pc #lessonSpeakingPanel{
        left:auto !important;
        right:20px !important;
        bottom:20px !important;
        width:min(520px, calc(100vw - 40px)) !important;
        max-width:520px !important;
      }

      html.lesson-mode-mobile #lessonSpeakingPanel{
        left:8px !important;
        right:8px !important;
        bottom:var(--lesson-safe-bottom) !important;
        width:auto !important;
        max-width:none !important;
        border-radius:18px !important;
      }

      html.lesson-mode-mobile .lesson-speaking-buttons button{
        min-height:46px;
      }

      html.lesson-mode-cardboard body{
        overflow:hidden !important;
        touch-action:none !important;
      }

      html.lesson-mode-cardboard #lessonSpeakingPanel{
        display:none !important;
      }

      html.lesson-mode-cardboard #lessonNextSessionBar{
        left:50% !important;
        right:auto !important;
        bottom:14px !important;
        transform:translateX(-50%) !important;
        width:min(92vw, 720px) !important;
        padding:8px 10px !important;
        border-radius:999px !important;
      }

      html.lesson-mode-cardboard #lessonNextSessionText{
        font-size:12px !important;
      }

      html.lesson-mode-cardboard #lessonNextSessionBtn{
        padding:9px 12px !important;
        font-size:12px !important;
      }

      #lessonViewModeBadge{
        position:fixed;
        top:max(10px, env(safe-area-inset-top));
        right:10px;
        z-index:2147483646;
        padding:7px 10px;
        border-radius:999px;
        background:rgba(15,23,42,.76);
        color:#fff;
        border:1px solid rgba(125,211,252,.55);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:12px;
        font-weight:900;
        pointer-events:none;
        backdrop-filter:blur(10px);
      }

      html.lesson-mode-cardboard #lessonViewModeBadge{
        top:8px;
        right:8px;
        font-size:11px;
        opacity:.72;
      }
    `;
    document.head.appendChild(style);
  }

  function applyMode(mode, reason) {
    mode = normalizeView(mode) || MODE.PC;
    currentMode = mode;

    const html = document.documentElement;

    html.classList.remove('lesson-mode-pc', 'lesson-mode-mobile', 'lesson-mode-cardboard');
    html.classList.add(`lesson-mode-${mode}`);

    html.dataset.lessonViewMode = mode;
    html.dataset.lessonViewLabel = modeLabel(mode);
    html.dataset.lessonInputMode = modeConfig(mode).input;

    const config = modeConfig(mode);

    window.LESSON_VIEW_MODE = mode;
    window.LESSON_VIEW_CONFIG = config;

    let badge = document.getElementById('lessonViewModeBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'lessonViewModeBadge';
      document.body.appendChild(badge);
    }

    badge.textContent = config.label;

    const detail = {
      version: VERSION,
      mode,
      label: config.label,
      config,
      reason: reason || 'apply'
    };

    window.dispatchEvent(new CustomEvent('lesson:view-mode-ready', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:view-mode-ready', { detail }));

    console.log('[LessonViewModeRouter]', VERSION, detail);
    return config;
  }

  function attachAframeVrDetection() {
    function bind() {
      const scene = document.querySelector('a-scene');
      if (!scene || scene.__lessonViewModeBound) return;

      scene.__lessonViewModeBound = true;

      scene.addEventListener('enter-vr', function () {
        applyMode(MODE.CARDBOARD, 'a-scene enter-vr');
      });

      scene.addEventListener('exit-vr', function () {
        // If URL says cVR/cardboard, stay Cardboard.
        const explicit = normalizeView(q().get('view') || '');
        if (explicit === MODE.CARDBOARD) {
          applyMode(MODE.CARDBOARD, 'a-scene exit-vr but URL forced cardboard');
        } else {
          applyMode(detectMode(), 'a-scene exit-vr');
        }
      });
    }

    bind();
    setTimeout(bind, 500);
    setTimeout(bind, 1500);
    setTimeout(bind, 3000);
  }

  function updateModeOnResize() {
    const explicit = normalizeView(q().get('view') || q().get('display') || q().get('device') || '');

    // If URL forces a mode, do not auto-switch on resize.
    if (explicit) return;

    const next = detectMode();
    if (next !== currentMode) {
      applyMode(next, 'resize/device inference');
    }
  }

  function boot() {
    ensureCSS();
    applyMode(currentMode, 'boot');
    attachAframeVrDetection();

    window.addEventListener('resize', debounce(updateModeOnResize, 180));
    window.addEventListener('orientationchange', function () {
      setTimeout(updateModeOnResize, 250);
    });

    window.LESSON_VIEW_ROUTER = {
      version: VERSION,
      modes: MODE,
      detect: detectMode,
      apply: applyMode,
      getMode: () => currentMode,
      getConfig: () => modeConfig(currentMode),
      normalizeView
    };
  }

  function debounce(fn, wait) {
    let t = 0;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
