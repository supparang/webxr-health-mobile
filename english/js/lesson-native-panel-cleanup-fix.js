// === /english/js/lesson-native-panel-cleanup-fix.js ===
// PATCH v20260426a-LESSON-NATIVE-PANEL-CLEANUP
// Fix duplicate lesson UI:
// - old lesson-main native task card shows behind new mission panel
// - causes S5/S9 mismatch on screen
// ✅ keep profile/dashboard
// ✅ hide only old native task/mission cards
// ✅ keep new overlays: lessonMissionPanel / lessonSpeakingPanel / session picker

(function () {
  'use strict';

  const VERSION = 'v20260426a-LESSON-NATIVE-PANEL-CLEANUP';

  const KEEP_IDS = [
    'lessonMissionPanel',
    'lessonSpeakingPanel',
    'lessonPcSessionOverlay',
    'lessonPcSessionOpenBtn',
    'lessonSpeakingOpenBtn',
    'lessonWritingAiGuide',
    'lesson3dCleanupHint',
    'techpath-guard-toast',
    'source-shield'
  ];

  const OLD_TEXT_PATTERNS = [
    /SYSTEM:\s*/i,
    /\bYOU:\s*/i,
    /\bStarter:\s*/i,
    /OVERLOCK\s+RUSH/i,
    /OVERCLOCK\s+RUSH/i,
    /พิมพ์คำตอบภาษาอังกฤษ/i,
    /Type\s+two\s+simple/i,
    /Write\s+one\s+sentence/i,
    /Look\s+at\s+the\s+card/i,
    /VRLessonReady/i,
    /VR Lesson Ready/i
  ];

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function safe(v) {
    return String(v == null ? '' : v).trim();
  }

  function shouldKeep(el) {
    if (!el) return true;

    const id = safe(el.id);

    if (KEEP_IDS.includes(id)) return true;

    if (id.startsWith('lessonMission')) return true;
    if (id.startsWith('lessonSpeaking')) return true;
    if (id.startsWith('lessonPcSession')) return true;
    if (id.startsWith('lessonWritingAi')) return true;

    try {
      if (el.closest('#lessonMissionPanel,#lessonSpeakingPanel,#lessonPcSessionOverlay,#lessonWritingAiGuide')) {
        return true;
      }
    } catch (err) {}

    return false;
  }

  function textLooksOldMission(text) {
    const s = safe(text);
    if (!s) return false;

    return OLD_TEXT_PATTERNS.some((p) => p.test(s));
  }

  function hideElement(el, reason) {
    if (!el || shouldKeep(el)) return;

    try {
      el.dataset.lessonNativeHidden = reason || 'old-native';
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
    } catch (err) {}
  }

  function findBestHideTarget(el) {
    if (!el || shouldKeep(el)) return null;

    let cur = el;

    for (let depth = 0; depth < 5 && cur && cur !== document.body; depth++) {
      if (shouldKeep(cur)) return null;

      const cls = safe(cur.className).toLowerCase();
      const id = safe(cur.id).toLowerCase();
      const role = `${id} ${cls}`;

      if (
        role.includes('card') ||
        role.includes('mission') ||
        role.includes('question') ||
        role.includes('task') ||
        role.includes('challenge') ||
        role.includes('panel') ||
        role.includes('prompt')
      ) {
        return cur;
      }

      const rect = cur.getBoundingClientRect ? cur.getBoundingClientRect() : null;

      if (
        rect &&
        rect.width >= 260 &&
        rect.height >= 80 &&
        rect.width <= window.innerWidth * 0.9 &&
        rect.height <= window.innerHeight * 0.8
      ) {
        return cur;
      }

      cur = cur.parentElement;
    }

    return el;
  }

  function cleanupHtmlNativeMission(reason) {
    // Hide old HTML mission cards from lesson-main, but keep new overlay panels.
    $all('div, section, article, aside, main, form').forEach((el) => {
      if (shouldKeep(el)) return;

      const text = safe(el.innerText || el.textContent || '');

      if (!textLooksOldMission(text)) return;

      const target = findBestHideTarget(el);

      if (target) {
        hideElement(target, reason || 'old-html-mission');
      }
    });

    // Hide old input/button rows specifically if they are outside the new panels.
    $all('input, textarea, button').forEach((el) => {
      if (shouldKeep(el)) return;

      const text = safe(el.placeholder || el.value || el.textContent || '');

      if (
        /พิมพ์คำตอบภาษาอังกฤษ/i.test(text) ||
        /บันทึกโปรไฟล์/i.test(text) ||
        /Check/i.test(text)
      ) {
        const parent = findBestHideTarget(el);
        if (parent && !shouldKeep(parent)) {
          hideElement(parent, reason || 'old-input-row');
        }
      }
    });
  }

  function getAFrameTextValue(el) {
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

  function hideAFrameEntity(el, reason) {
    if (!el) return;

    try {
      el.setAttribute('visible', 'false');
      el.setAttribute('data-lesson-native-hidden', reason || 'old-aframe-mission');
    } catch (err) {}

    try {
      if (el.object3D) el.object3D.visible = false;
    } catch (err) {}
  }

  function cleanupAFrameNativeMission(reason) {
    const scene = $('a-scene');
    if (!scene) return;

    $all('a-text, [text]', scene).forEach((el) => {
      const txt = getAFrameTextValue(el);

      if (textLooksOldMission(txt)) {
        hideAFrameEntity(el, reason || 'old-aframe-text');
      }
    });

    // Hide old black mission board / old input planes if they are near text-heavy task board.
    $all('a-plane, a-box, a-entity', scene).forEach((el) => {
      const txt = getAFrameTextValue(el);

      if (textLooksOldMission(txt)) {
        hideAFrameEntity(el, reason || 'old-aframe-board');
      }
    });
  }

  function cleanup(reason) {
    cleanupHtmlNativeMission(reason);
    cleanupAFrameNativeMission(reason);

    console.log('[LessonNativePanelCleanup]', VERSION, { reason });
  }

  function boot() {
    cleanup('boot');

    setTimeout(() => cleanup('t500'), 500);
    setTimeout(() => cleanup('t1200'), 1200);
    setTimeout(() => cleanup('t2500'), 2500);
    setTimeout(() => cleanup('t4500'), 4500);

    [
      'lesson:data-skill-ready',
      'lesson:router-ready',
      'lesson:item-ready',
      'lesson:view-mode-ready',
      'lesson:ai-difficulty-updated',
      'lesson:mission-pass'
    ].forEach((name) => {
      window.addEventListener(name, () => cleanup(name));
      document.addEventListener(name, () => cleanup(`document:${name}`));
    });

    const obs = new MutationObserver(() => {
      cleanup('mutation');
    });

    if (document.body) {
      obs.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    window.LESSON_NATIVE_PANEL_CLEANUP_FIX = {
      version: VERSION,
      cleanup
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
