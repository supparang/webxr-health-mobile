// /english/js/techpath-guard.js
// Production-safe guard for TechPath
// No debugger, no blocking loops, no main-thread freeze.

(function () {
  'use strict';

  const doc = document;
  const win = window;
  const html = doc.documentElement;
  const body = doc.body;

  const CONFIG = {
    devtoolsThreshold: 170,
    checkIntervalMs: 1200,
    blockContextMenu: true,
    blockSelection: true,
    blockCopyOutsideInputs: true,
    blockSaveViewSource: true,
    blurProtectedUI: false, // true = blur page under overlay, false = overlay only
    tamperRedirectUrl: '',  // optional
    showToastMs: 1800
  };

  const state = {
    devtoolsOpen: false,
    overlayMounted: false,
    toastTimer: 0
  };

  function isEditable(el) {
    return !!(el && el.closest('input, textarea, [contenteditable="true"]'));
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
      html.techpath-protected,
      html.techpath-protected body {
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }

      html.techpath-protected input,
      html.techpath-protected textarea,
      html.techpath-protected [contenteditable="true"] {
        -webkit-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
      }

      img, canvas, a {
        -webkit-user-drag: none;
        user-drag: none;
      }

      #techpath-guard-overlay {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(2, 6, 23, .86);
        backdrop-filter: blur(8px);
        z-index: 999999;
      }

      #techpath-guard-overlay.show {
        display: flex;
      }

      #techpath-guard-card {
        width: min(92vw, 520px);
        border: 1px solid rgba(123, 237, 255, .24);
        border-radius: 18px;
        background: rgba(15, 23, 42, .94);
        box-shadow: 0 20px 60px rgba(0,0,0,.35);
        padding: 22px 18px;
        text-align: center;
      }

      #techpath-guard-title {
        color: #7bedff;
        font-size: 1.15rem;
        font-weight: 900;
        margin-bottom: 8px;
      }

      #techpath-guard-sub {
        color: #e5f6ff;
        font-size: .95rem;
        line-height: 1.5;
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
        z-index: 999999;
        box-shadow: 0 10px 28px rgba(0,0,0,.24);
      }

      #techpath-guard-toast.show {
        display: block;
      }

      body.techpath-guard-blur #ui-container,
      body.techpath-guard-blur a-scene {
        filter: blur(10px);
        pointer-events: none !important;
      }
    `;
    doc.head.appendChild(style);
  }

  function ensureOverlay() {
    if (doc.getElementById('techpath-guard-overlay')) return;

    const overlay = doc.createElement('div');
    overlay.id = 'techpath-guard-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div id="techpath-guard-card">
        <div id="techpath-guard-title">Protected Lesson Mode</div>
        <div id="techpath-guard-sub">
          กรุณาปิด Developer Tools เพื่อกลับเข้าใช้งาน
        </div>
      </div>
    `;
    doc.body.appendChild(overlay);
  }

  function ensureToast() {
    if (doc.getElementById('techpath-guard-toast')) return;
    const toast = doc.createElement('div');
    toast.id = 'techpath-guard-toast';
    doc.body.appendChild(toast);
  }

  function showToast(msg) {
    ensureToast();
    const toast = doc.getElementById('techpath-guard-toast');
    if (!toast) return;

    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, CONFIG.showToastMs);
  }

  function setDevtoolsGuard(on) {
    ensureOverlay();
    const overlay = doc.getElementById('techpath-guard-overlay');
    if (!overlay) return;

    state.devtoolsOpen = !!on;
    overlay.classList.toggle('show', !!on);
    overlay.setAttribute('aria-hidden', on ? 'false' : 'true');

    if (CONFIG.blurProtectedUI) {
      body.classList.toggle('techpath-guard-blur', !!on);
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
      (((e.ctrlKey || e.metaKey) && ['u', 's'].includes(key)));

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

  function init() {
    ensureStyle();
    html.classList.add('techpath-protected');

    doc.addEventListener('keydown', onKeydown, true);
    doc.addEventListener('contextmenu', onContextMenu, true);
    doc.addEventListener('selectstart', onSelectStart, true);
    doc.addEventListener('copy', onCopyLike, true);
    doc.addEventListener('cut', onCopyLike, true);
    doc.addEventListener('dragstart', function (e) {
      if (!isEditable(e.target)) stopEvent(e);
    }, true);

    setInterval(() => {
      const open = detectDevtoolsBySize();
      if (open !== state.devtoolsOpen) {
        setDevtoolsGuard(open);

        if (open && CONFIG.tamperRedirectUrl) {
          setTimeout(() => {
            win.location.href = CONFIG.tamperRedirectUrl;
          }, 400);
        }
      }
    }, CONFIG.checkIntervalMs);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
