// === /english/js/lesson-speaking-lazy-open-fix.js ===
// PATCH v20260426a-LESSON-SPEAKING-LAZY-OPEN
// Speaking panel should NOT pop up every time on page load.
// It shows a small open button first, then opens the panel only when learner clicks.

(function () {
  'use strict';

  const VERSION = 'v20260426a-LESSON-SPEAKING-LAZY-OPEN';

  let panelOpen = false;
  let observer = null;

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function safe(v) {
    return String(v == null ? '' : v).trim();
  }

  function getViewMode() {
    try {
      if (window.LESSON_VIEW_MODE) return String(window.LESSON_VIEW_MODE);
    } catch (err) {}

    const ds = document.documentElement.dataset.lessonViewMode;
    if (ds) return ds;

    const q = new URLSearchParams(location.search || '');
    const view = safe(q.get('view')).toLowerCase();

    if (['vr', 'cvr', 'cardboard', 'cardboard-vr'].includes(view)) return 'cardboard';
    if (['mobile', 'phone'].includes(view)) return 'mobile';

    return 'pc';
  }

  function currentSkill() {
    try {
      if (window.LESSON_DATA_GUARD?.getDataSkill) {
        return window.LESSON_DATA_GUARD.getDataSkill();
      }
    } catch (err) {}

    try {
      if (window.LESSON_ROUTER?.getCurrentSkill) {
        return window.LESSON_ROUTER.getCurrentSkill();
      }
    } catch (err) {}

    return document.documentElement.dataset.lessonSkill || 'unknown';
  }

  function isSpeaking() {
    return currentSkill() === 'speaking';
  }

  function ensureCSS() {
    if ($('#lesson-speaking-lazy-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-speaking-lazy-css';
    style.textContent = `
      html.lesson-speaking-lazy:not(.lesson-speaking-open) #lessonSpeakingPanel {
        display: none !important;
      }

      html.lesson-speaking-lazy:not(.lesson-speaking-open) #lessonSpeakingVrBoard {
        display: none !important;
      }

      #lessonSpeakingOpenBtn {
        position: fixed;
        right: 18px;
        bottom: max(18px, env(safe-area-inset-bottom));
        z-index: 2147483646;
        border: 1px solid rgba(125,211,252,.55);
        border-radius: 999px;
        padding: 12px 16px;
        background: linear-gradient(90deg,#0ea5e9,#2563eb);
        color: #fff;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-weight: 1000;
        cursor: pointer;
        box-shadow: 0 16px 40px rgba(0,0,0,.34);
      }

      #lessonSpeakingOpenBtn:hover {
        transform: translateY(-1px);
      }

      html.lesson-speaking-open #lessonSpeakingOpenBtn {
        display: none !important;
      }

      html:not(.lesson-has-speaking) #lessonSpeakingOpenBtn {
        display: none !important;
      }

      html.lesson-mode-cardboard #lessonSpeakingOpenBtn {
        display: none !important;
      }

      @media (max-width: 640px) {
        #lessonSpeakingOpenBtn {
          right: 10px;
          bottom: max(10px, env(safe-area-inset-bottom));
          padding: 11px 13px;
          font-size: 13px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureOpenButton() {
    let btn = $('#lessonSpeakingOpenBtn');
    if (btn) return btn;

    btn = document.createElement('button');
    btn.id = 'lessonSpeakingOpenBtn';
    btn.type = 'button';
    btn.textContent = '🎤 เปิดด่านพูด';
    btn.addEventListener('click', openPanel);

    document.body.appendChild(btn);
    return btn;
  }

  function openPanel() {
    panelOpen = true;

    document.documentElement.classList.add('lesson-speaking-open');
    document.documentElement.classList.remove('lesson-speaking-lazy');

    try {
      window.LESSON_SPEAKING_FIX?.activate?.('lazy-open');
      window.LESSON_SPEAKING_FIX?.refresh?.();
    } catch (err) {}

    const panel = $('#lessonSpeakingPanel');
    if (panel) {
      panel.classList.remove('is-collapsed');
      panel.style.display = '';
    }

    const toggle = $('#lessonSpeakingToggle');
    if (toggle) toggle.textContent = 'ย่อ';
  }

  function closePanelToLazy() {
    panelOpen = false;

    document.documentElement.classList.add('lesson-speaking-lazy');
    document.documentElement.classList.remove('lesson-speaking-open');

    const panel = $('#lessonSpeakingPanel');
    if (panel) {
      panel.classList.add('is-collapsed');
    }
  }

  function applyState(reason) {
    ensureCSS();

    const speaking = isSpeaking();
    const mode = getViewMode();

    document.documentElement.classList.toggle('lesson-has-speaking', speaking);

    // Cardboard VR ใช้ VR board / gaze เอง ไม่ต้องมีปุ่ม HTML ลอย
    if (mode === 'cardboard') {
      document.documentElement.classList.remove('lesson-speaking-lazy');
      document.documentElement.classList.remove('lesson-speaking-open');
      return;
    }

    if (!speaking) {
      document.documentElement.classList.remove('lesson-speaking-lazy');
      document.documentElement.classList.remove('lesson-speaking-open');

      const btn = $('#lessonSpeakingOpenBtn');
      if (btn) btn.style.display = 'none';

      return;
    }

    ensureOpenButton();

    if (!panelOpen) {
      document.documentElement.classList.add('lesson-speaking-lazy');
      document.documentElement.classList.remove('lesson-speaking-open');
    }

    console.log('[LessonSpeakingLazyOpen]', VERSION, {
      reason,
      speaking,
      mode,
      panelOpen
    });
  }

  function startObserver() {
    if (observer) return;

    observer = new MutationObserver(() => {
      if (!isSpeaking()) return;

      if (!panelOpen) {
        document.documentElement.classList.add('lesson-speaking-lazy');
        document.documentElement.classList.remove('lesson-speaking-open');
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function bindEvents() {
    [
      'lesson:data-skill-ready',
      'lesson:router-ready',
      'lesson:item-ready',
      'lesson:view-mode-ready'
    ].forEach((name) => {
      window.addEventListener(name, () => applyState(name));
      document.addEventListener(name, () => applyState(`document:${name}`));
    });

    window.addEventListener('lesson:mission-pass', () => {
      closePanelToLazy();
    });

    document.addEventListener('lesson:mission-pass', () => {
      closePanelToLazy();
    });
  }

  function boot() {
    ensureCSS();
    ensureOpenButton();
    bindEvents();
    startObserver();

    applyState('boot');

    setTimeout(() => applyState('t500'), 500);
    setTimeout(() => applyState('t1200'), 1200);
    setTimeout(() => applyState('t2500'), 2500);

    window.LESSON_SPEAKING_LAZY_OPEN_FIX = {
      version: VERSION,
      open: openPanel,
      close: closePanelToLazy,
      apply: applyState
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
