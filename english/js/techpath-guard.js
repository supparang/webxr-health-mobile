// === /english/js/techpath-guard.js ===
// PATCH v20260426a-TECHPATH-PRODUCTION-GUARD
// Production-safe guard for TechPath / English Lesson
// - no debugger
// - no requestAnimationFrame loop
// - no main-thread blocking
// - safe for mobile / VR / desktop
// - blocks common inspect shortcuts / right click / copy outside inputs
// - shows shield when devtools-like window gap is detected

(function () {
  'use strict';

  const doc = document;
  const win = window;

  const CONFIG = {
    devtoolsThreshold: 160,
    checkIntervalMs: 1500,
    blockContextMenu: true,
    blockSelection: true,
    blockCopyOutsideInputs: true,
    blockSaveViewSource: true,
    showToastMs: 1500,
    showShieldOnDevtools: true
  };

  const state = {
    devtoolsOpen: false,
    toastTimer: 0
  };

  function isEditable(el) {
    return !!(el && el.closest('input, textarea, select, [contenteditable="true"], .allow-copy'));
  }

  function stopEvent(e) {
    e.preventDefault();
    e.stopPropagation();

    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }

    return false;
  }

  function ensureStyle() {
    if (doc.getElementById('techpath-guard-style')) return;

    const style = doc.createElement('style');
    style.id = 'techpath-guard-style';
    style.textContent = `
      html.protected,
      html.protected body {
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }

      html.protected input,
      html.protected textarea,
      html.protected select,
      html.protected [contenteditable="true"],
      html.protected .allow-copy {
        -webkit-user-select: text;
        user-select: text;
        -webkit-touch-callout: default;
      }

      #techpath-guard-toast {
        position: fixed;
        left: 50%;
        bottom: max(18px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        display: none;
        min-width: 220px;
        max-width: min(92vw, 420px);
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(10,18,34,.95);
        border: 1px solid rgba(123,237,255,.22);
        color: #eaf6ff;
        font-size: .9rem;
        font-weight: 800;
        text-align: center;
        z-index: 2147483647;
        box-shadow: 0 10px 28px rgba(0,0,0,.24);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: none;
      }

      #source-shield {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background:
          radial-gradient(circle at top, rgba(14,165,233,.22), transparent 42%),
          rgba(2,6,23,.92);
        color: #eaf6ff;
        text-align: center;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: auto;
      }

      body.devtools-guard #source-shield {
        display: flex;
      }

      #source-shield .shield-card {
        width: min(520px, 92vw);
        padding: 24px;
        border-radius: 28px;
        border: 1px solid rgba(125,211,252,.35);
        background: rgba(15,23,42,.92);
        box-shadow: 0 24px 80px rgba(0,0,0,.42);
      }

      #source-shield .shield-title {
        font-size: 24px;
        font-weight: 1000;
        margin-bottom: 8px;
      }

      #source-shield .shield-text {
        color: #bae6fd;
        font-size: 14px;
        font-weight: 800;
        line-height: 1.55;
      }

      html.lesson-mode-cardboard #techpath-guard-toast {
        bottom: 14px;
        font-size: 12px;
        opacity: .86;
      }
    `;

    doc.head.appendChild(style);
  }

  function ensureToast() {
    if (doc.getElementById('techpath-guard-toast')) return;

    const toast = doc.createElement('div');
    toast.id = 'techpath-guard-toast';
    doc.body.appendChild(toast);
  }

  function ensureShield() {
    if (doc.getElementById('source-shield')) return;

    const shield = doc.createElement('div');
    shield.id = 'source-shield';
    shield.setAttribute('aria-hidden', 'true');
    shield.innerHTML = `
      <div class="shield-card">
        <div class="shield-title">Protected Mode</div>
        <div class="shield-text">
          หน้านี้อยู่ในโหมดป้องกันสำหรับการเรียน/การทดสอบ<br>
          กรุณาปิด Developer Tools เพื่อกลับไปใช้งานบทเรียน
        </div>
      </div>
    `;

    doc.body.appendChild(shield);
  }

  function showToast(message) {
    ensureToast();

    const toast = doc.getElementById('techpath-guard-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.style.display = 'block';

    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, CONFIG.showToastMs);
  }

  function setDevtoolsGuard(on) {
    state.devtoolsOpen = !!on;

    if (doc.body) {
      doc.body.classList.toggle('devtools-guard', !!on && CONFIG.showShieldOnDevtools);
    }

    const shield = doc.getElementById('source-shield');
    if (shield) {
      shield.setAttribute('aria-hidden', on ? 'false' : 'true');
    }
  }

  function detectDevtoolsBySize() {
    const widthGap = Math.abs((win.outerWidth || 0) - (win.innerWidth || 0));
    const heightGap = Math.abs((win.outerHeight || 0) - (win.innerHeight || 0));

    return widthGap > CONFIG.devtoolsThreshold || heightGap > CONFIG.devtoolsThreshold;
  }

  function onKeydown(e) {
    const key = String(e.key || '').toLowerCase();

    const blockedInspect =
      e.key === 'F12' ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(key));

    const blockedSourceSave =
      CONFIG.blockSaveViewSource &&
      ((e.ctrlKey || e.metaKey) && ['u', 's'].includes(key));

    const blockedCopy =
      CONFIG.blockCopyOutsideInputs &&
      ((e.ctrlKey || e.metaKey) && ['c', 'x'].includes(key)) &&
      !isEditable(e.target);

    if (blockedInspect || blockedSourceSave || blockedCopy) {
      showToast('Protected mode');
      return stopEvent(e);
    }
  }

  function onContextMenu(e) {
    if (!CONFIG.blockContextMenu) return;
    if (isEditable(e.target)) return;

    showToast('ปิดเมนูคลิกขวาแล้ว');
    return stopEvent(e);
  }

  function onSelectStart(e) {
    if (!CONFIG.blockSelection) return;
    if (isEditable(e.target)) return;

    return stopEvent(e);
  }

  function onCopyLike(e) {
    if (!CONFIG.blockCopyOutsideInputs) return;
    if (isEditable(e.target)) return;

    showToast('คัดลอกถูกปิดไว้');
    return stopEvent(e);
  }

  function onDragStart(e) {
    if (isEditable(e.target)) return;
    return stopEvent(e);
  }

  function bindEvents() {
    doc.addEventListener('keydown', onKeydown, true);
    doc.addEventListener('contextmenu', onContextMenu, true);
    doc.addEventListener('selectstart', onSelectStart, true);
    doc.addEventListener('copy', onCopyLike, true);
    doc.addEventListener('cut', onCopyLike, true);
    doc.addEventListener('dragstart', onDragStart, true);
  }

  function startDevtoolsCheck() {
    setInterval(() => {
      const open = detectDevtoolsBySize();

      if (open !== state.devtoolsOpen) {
        setDevtoolsGuard(open);

        if (open) {
          showToast('Protected mode');
        }
      }
    }, CONFIG.checkIntervalMs);
  }

  function init() {
    ensureStyle();

    doc.documentElement.classList.add('protected');

    if (doc.body) {
      ensureToast();
      ensureShield();
      bindEvents();
      startDevtoolsCheck();
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  win.TECHPATH_GUARD = {
    version: 'v20260426a-TECHPATH-PRODUCTION-GUARD',
    config: CONFIG,
    state,
    showToast,
    setDevtoolsGuard
  };
})();
