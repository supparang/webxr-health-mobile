// === /english/js/techpath-guard.js ===
// PATCH v20260426b-TECHPATH-PRODUCTION-GUARD-NO-FALSE-SHIELD
// Production-safe guard for TechPath / English Lesson
// ✅ blocks common inspect shortcuts / right click / copy outside inputs
// ✅ no debugger
// ✅ no requestAnimationFrame loop
// ✅ no main-thread blocking
// ✅ safe for mobile / VR / desktop
// ✅ no false full-screen shield by default
// ✅ shield only when URL has ?guard=strict or ?protected=strict

(function () {
  'use strict';

  const doc = document;
  const win = window;

  const VERSION = 'v20260426b-TECHPATH-PRODUCTION-GUARD-NO-FALSE-SHIELD';

  const CONFIG = {
    devtoolsThreshold: 220,
    checkIntervalMs: 1800,

    blockInspectShortcuts: true,
    blockContextMenu: true,
    blockSelection: true,
    blockCopyOutsideInputs: true,
    blockSaveViewSource: true,

    showToastMs: 1500,

    // สำคัญ: default ต้อง false เพื่อไม่บังบทเรียนเองจาก false positive
    showShieldOnDevtools: false,

    // ต้องใช้ ?guard=strict หรือ ?protected=strict ถึงเปิด shield
    strictShieldByQuery: true,

    // ต้อง detect ต่อเนื่องกี่รอบก่อนเปิด shield ใน strict mode
    stableDetectCount: 2
  };

  const state = {
    devtoolsOpen: false,
    toastTimer: 0,
    detectHits: 0,
    strictMode: false,
    bound: false,
    intervalId: 0
  };

  function q() {
    return new URLSearchParams(location.search || '');
  }

  function safe(v) {
    return String(v == null ? '' : v).trim();
  }

  function detectStrictMode() {
    const p = q();

    const guard = safe(p.get('guard') || p.get('protected') || p.get('exam') || '').toLowerCase();

    return (
      guard === 'strict' ||
      guard === 'on' ||
      guard === 'true' ||
      guard === '1'
    );
  }

  function isEditable(el) {
    return !!(
      el &&
      el.closest(
        'input, textarea, select, [contenteditable="true"], .allow-copy, .lesson-allow-copy'
      )
    );
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
      html.protected .allow-copy,
      html.protected .lesson-allow-copy {
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
        <div class="shield-title">Protected Lesson Mode</div>
        <div class="shield-text">
          หน้านี้ถูกป้องกันสำหรับการเรียน/การทดสอบ<br>
          กรุณาปิด Developer Tools เพื่อกลับเข้าใช้งาน
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

  function shouldUseShield() {
    return !!(CONFIG.showShieldOnDevtools || state.strictMode);
  }

  function setDevtoolsGuard(on, reason) {
    state.devtoolsOpen = !!on;

    if (doc.body) {
      doc.body.classList.toggle('devtools-guard', !!on && shouldUseShield());
    }

    const shield = doc.getElementById('source-shield');
    if (shield) {
      shield.setAttribute('aria-hidden', on && shouldUseShield() ? 'false' : 'true');
    }

    try {
      doc.documentElement.dataset.techpathDevtools = on ? '1' : '0';
      doc.documentElement.dataset.techpathGuardStrict = state.strictMode ? '1' : '0';
    } catch (err) {}

    if (on && shouldUseShield()) {
      showToast('Protected mode');
    }

    console.log('[TechPathGuard] devtools guard:', {
      on: !!on,
      reason: reason || '',
      shield: shouldUseShield(),
      strict: state.strictMode
    });
  }

  function detectDevtoolsBySize() {
    const outerW = win.outerWidth || 0;
    const innerW = win.innerWidth || 0;
    const outerH = win.outerHeight || 0;
    const innerH = win.innerHeight || 0;

    if (!outerW || !innerW || !outerH || !innerH) return false;

    // Cardboard/Mobile ห้ามใช้ shield จาก size เพราะ false positive สูง
    const viewMode = safe(win.LESSON_VIEW_MODE || doc.documentElement.dataset.lessonViewMode || '').toLowerCase();
    if (viewMode === 'cardboard' || viewMode === 'mobile') return false;

    const widthGap = Math.abs(outerW - innerW);
    const heightGap = Math.abs(outerH - innerH);

    return widthGap > CONFIG.devtoolsThreshold || heightGap > CONFIG.devtoolsThreshold;
  }

  function onKeydown(e) {
    const key = String(e.key || '').toLowerCase();

    const blockedInspect =
      CONFIG.blockInspectShortcuts &&
      (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(key))
      );

    const blockedSourceSave =
      CONFIG.blockSaveViewSource &&
      ((e.ctrlKey || e.metaKey) && ['u', 's'].includes(key));

    const blockedCopy =
      CONFIG.blockCopyOutsideInputs &&
      ((e.ctrlKey || e.metaKey) && ['c', 'x'].includes(key)) &&
      !isEditable(e.target);

    if (blockedInspect || blockedSourceSave || blockedCopy) {
      showToast('Protected mode');

      // strict mode เท่านั้นที่จะเปิด shield จากการกด shortcut
      if (blockedInspect && state.strictMode) {
        setDevtoolsGuard(true, 'inspect shortcut');
      }

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
    if (state.bound) return;
    state.bound = true;

    doc.addEventListener('keydown', onKeydown, true);
    doc.addEventListener('contextmenu', onContextMenu, true);
    doc.addEventListener('selectstart', onSelectStart, true);
    doc.addEventListener('copy', onCopyLike, true);
    doc.addEventListener('cut', onCopyLike, true);
    doc.addEventListener('dragstart', onDragStart, true);
  }

  function startDevtoolsCheck() {
    clearInterval(state.intervalId);

    state.intervalId = setInterval(() => {
      const open = detectDevtoolsBySize();

      if (open) {
        state.detectHits += 1;
      } else {
        state.detectHits = 0;
      }

      const stableOpen = state.detectHits >= CONFIG.stableDetectCount;

      if (stableOpen !== state.devtoolsOpen) {
        setDevtoolsGuard(stableOpen, 'stable size detection');
      }

      // ไม่ strict แล้ว detect หาย ให้ปลด shield เสมอ
      if (!stableOpen && doc.body) {
        doc.body.classList.remove('devtools-guard');
      }
    }, CONFIG.checkIntervalMs);
  }

  function init() {
    state.strictMode = CONFIG.strictShieldByQuery && detectStrictMode();

    ensureStyle();

    doc.documentElement.classList.add('protected');
    doc.documentElement.dataset.techpathGuard = VERSION;
    doc.documentElement.dataset.techpathGuardStrict = state.strictMode ? '1' : '0';

    if (doc.body) {
      // สำคัญ: กัน shield ค้างจากรอบก่อน
      doc.body.classList.remove('devtools-guard');

      ensureToast();
      ensureShield();
      bindEvents();
      startDevtoolsCheck();
    }

    console.log('[TechPathGuard]', VERSION, {
      strictMode: state.strictMode,
      showShieldOnDevtools: CONFIG.showShieldOnDevtools
    });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  win.TECHPATH_GUARD = {
    version: VERSION,
    config: CONFIG,
    state,

    showToast,
    setDevtoolsGuard,

    setStrict(on) {
      state.strictMode = !!on;
      doc.documentElement.dataset.techpathGuardStrict = state.strictMode ? '1' : '0';

      if (!state.strictMode) {
        setDevtoolsGuard(false, 'strict off');
      }
    },

    disableShield() {
      CONFIG.showShieldOnDevtools = false;
      state.strictMode = false;
      setDevtoolsGuard(false, 'disable shield');
    },

    enableShield() {
      CONFIG.showShieldOnDevtools = true;
    },

    reset() {
      state.detectHits = 0;
      setDevtoolsGuard(false, 'reset');
    }
  };
})();
