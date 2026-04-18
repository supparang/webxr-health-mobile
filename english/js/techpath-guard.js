// /english/js/techpath-guard.js
// Production-safe guard for TechPath
// - no debugger
// - no requestAnimationFrame loop
// - no main-thread blocking
// - safe for mobile / VR / desktop

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
    showToastMs: 1500
  };

  const state = {
    devtoolsOpen: false,
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

  function ensureToast() {
    if (doc.getElementById('techpath-guard-toast')) return;

    const toast = doc.createElement('div');
    toast.id = 'techpath-guard-toast';
    toast.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:max(18px, env(safe-area-inset-bottom))',
      'transform:translateX(-50%)',
      'display:none',
      'min-width:220px',
      'max-width:min(92vw, 420px)',
      'padding:10px 14px',
      'border-radius:999px',
      'background:rgba(10,18,34,.95)',
      'border:1px solid rgba(123,237,255,.22)',
      'color:#eaf6ff',
      'font-size:.9rem',
      'font-weight:800',
      'text-align:center',
      'z-index:999999',
      'box-shadow:0 10px 28px rgba(0,0,0,.24)'
    ].join(';');
    doc.body.appendChild(toast);
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
    doc.body.classList.toggle('devtools-guard', !!on);

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

  function init() {
    doc.documentElement.classList.add('protected');

    doc.addEventListener('keydown', onKeydown, true);
    doc.addEventListener('contextmenu', onContextMenu, true);
    doc.addEventListener('selectstart', onSelectStart, true);
    doc.addEventListener('copy', onCopyLike, true);
    doc.addEventListener('cut', onCopyLike, true);
    doc.addEventListener('dragstart', onDragStart, true);

    setInterval(() => {
      const open = detectDevtoolsBySize();
      if (open !== state.devtoolsOpen) {
        setDevtoolsGuard(open);
      }
    }, CONFIG.checkIntervalMs);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
