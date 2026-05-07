/* =========================================================
 * /english/js/techpath-copy-guard-safe.js
 * PATCH v20260507-COPY-GUARD-SAFE
 *
 * ✅ กัน copy/source แบบไม่ทำให้ lesson พัง
 * ✅ กัน right click / select / drag / Ctrl+U / Ctrl+S / F12
 * ✅ ไม่บล็อก input, textarea, select, contenteditable
 * ✅ ไม่บังปุ่มเข้า Session
 * ✅ ใส่ watermark เบา ๆ
 * ✅ soft warning เมื่อพยายามเปิด DevTools
 *
 * หมายเหตุ:
 * ป้องกันได้ระดับ deterrent เท่านั้น เพราะ source ฝั่ง client
 * ไม่มีทางซ่อนจาก browser ได้ 100%
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'techpath-copy-guard-safe-v20260507';

  const ENABLE_GUARD = true;
  const ENABLE_WATERMARK = true;
  const ENABLE_DEVTOOLS_SOFT_NOTICE = true;

  function isEditableTarget(el) {
    if (!el) return false;

    const tag = String(el.tagName || '').toLowerCase();

    return (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      tag === 'option' ||
      el.isContentEditable ||
      !!(el.closest && el.closest('input, textarea, select, [contenteditable="true"], .allow-copy, [data-allow-copy]'))
    );
  }

  function showNotice(message) {
    let box = document.getElementById('techPathCopyGuardNotice');

    if (!box) {
      box = document.createElement('div');
      box.id = 'techPathCopyGuardNotice';
      box.style.cssText = [
        'position:fixed',
        'left:12px',
        'right:12px',
        'bottom:92px',
        'z-index:9999999',
        'display:none',
        'padding:12px 14px',
        'border-radius:16px',
        'background:rgba(5,17,32,.96)',
        'color:#eaffff',
        'border:1px solid rgba(105,232,255,.45)',
        'box-shadow:0 14px 44px rgba(0,0,0,.38)',
        'font:900 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif',
        'text-align:center',
        'pointer-events:none'
      ].join(';');

      document.body.appendChild(box);
    }

    box.textContent = message || 'This lesson is protected.';
    box.style.display = 'block';

    clearTimeout(box._t);
    box._t = setTimeout(function () {
      box.style.display = 'none';
    }, 2600);
  }

  function injectStyle() {
    if (document.getElementById(PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = PATCH_ID + '-style';

    style.textContent = `
      html.techpath-copy-guard-on,
      html.techpath-copy-guard-on body {
        -webkit-touch-callout: none !important;
      }

      html.techpath-copy-guard-on body,
      html.techpath-copy-guard-on .card,
      html.techpath-copy-guard-on .panel,
      html.techpath-copy-guard-on .glass,
      html.techpath-copy-guard-on button,
      html.techpath-copy-guard-on a {
        -webkit-user-select: none !important;
        user-select: none !important;
      }

      html.techpath-copy-guard-on input,
      html.techpath-copy-guard-on textarea,
      html.techpath-copy-guard-on select,
      html.techpath-copy-guard-on [contenteditable="true"],
      html.techpath-copy-guard-on .allow-copy,
      html.techpath-copy-guard-on [data-allow-copy] {
        -webkit-user-select: text !important;
        user-select: text !important;
      }

      #techPathSourceWatermark {
        position: fixed !important;
        right: 12px !important;
        top: 82px !important;
        z-index: 999990 !important;
        pointer-events: none !important;
        opacity: .16 !important;
        color: #eaffff !important;
        font: 1000 11px/1.25 system-ui,-apple-system,Segoe UI,sans-serif !important;
        letter-spacing: .4px !important;
        text-align: right !important;
        text-shadow: 0 2px 12px rgba(0,0,0,.55) !important;
        max-width: 50vw !important;
      }

      @media print {
        body {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function addWatermark() {
    if (!ENABLE_WATERMARK) return;
    if (document.getElementById('techPathSourceWatermark')) return;

    const qs = new URLSearchParams(location.search);
    const sid = qs.get('studentId') || qs.get('student_id') || qs.get('pid') || window.studentId || '';
    const name = qs.get('name') || qs.get('studentName') || window.studentName || '';

    const wm = document.createElement('div');
    wm.id = 'techPathSourceWatermark';
    wm.innerHTML =
      'TechPath English VR<br>' +
      'Protected Learning Content' +
      (sid || name ? '<br>' + String(sid || name).replace(/[<>&"]/g, '') : '');

    document.body.appendChild(wm);
  }

  function blockEvent(ev, msg) {
    if (!ENABLE_GUARD) return;
    if (isEditableTarget(ev.target)) return;

    ev.preventDefault();
    ev.stopPropagation();

    if (msg) showNotice(msg);

    return false;
  }

  function bindMouseAndTouchGuard() {
    document.addEventListener('contextmenu', function (ev) {
      return blockEvent(ev, 'Right click is disabled for this lesson.');
    }, true);

    document.addEventListener('copy', function (ev) {
      return blockEvent(ev, 'Copy is disabled for protected lesson content.');
    }, true);

    document.addEventListener('cut', function (ev) {
      return blockEvent(ev, 'Cut is disabled for protected lesson content.');
    }, true);

    document.addEventListener('dragstart', function (ev) {
      return blockEvent(ev, '');
    }, true);

    document.addEventListener('selectstart', function (ev) {
      if (isEditableTarget(ev.target)) return;
      ev.preventDefault();
      return false;
    }, true);
  }

  function bindKeyboardGuard() {
    document.addEventListener('keydown', function (ev) {
      if (!ENABLE_GUARD) return;
      if (isEditableTarget(ev.target)) return;

      const key = String(ev.key || '').toLowerCase();
      const ctrl = ev.ctrlKey || ev.metaKey;
      const shift = ev.shiftKey;

      const blocked =
        key === 'f12' ||
        (ctrl && key === 'u') ||
        (ctrl && key === 's') ||
        (ctrl && key === 'p') ||
        (ctrl && key === 'c') ||
        (ctrl && key === 'x') ||
        (ctrl && shift && (key === 'i' || key === 'j' || key === 'c')) ||
        (ctrl && shift && key === 'k');

      if (blocked) {
        ev.preventDefault();
        ev.stopPropagation();
        showNotice('This lesson source is protected.');
        return false;
      }
    }, true);
  }

  function bindDevtoolsSoftNotice() {
    if (!ENABLE_DEVTOOLS_SOFT_NOTICE) return;

    let lastOpen = false;

    setInterval(function () {
      const threshold = 160;
      const open =
        (window.outerWidth - window.innerWidth > threshold) ||
        (window.outerHeight - window.innerHeight > threshold);

      if (open && !lastOpen) {
        lastOpen = true;
        showNotice('Developer tools detected. Please use the lesson normally.');
      }

      if (!open) lastOpen = false;
    }, 1200);
  }

  function protectConsole() {
    try {
      const msg =
        '%cTechPath English VR%c\\nProtected learning content. Unauthorized copying is not allowed.';
      console.log(
        msg,
        'font-size:18px;font-weight:900;color:#65e8ff;',
        'font-size:12px;color:#dff7ff;'
      );
    } catch (e) {}
  }

  function exposeApi() {
    window.TechPathCopyGuard = {
      version: PATCH_ID,
      enable: function () {
        document.documentElement.classList.add('techpath-copy-guard-on');
        showNotice('Copy guard enabled.');
      },
      disable: function () {
        document.documentElement.classList.remove('techpath-copy-guard-on');
        showNotice('Copy guard disabled for this session.');
      },
      status: function () {
        return {
          patch: PATCH_ID,
          enabled: document.documentElement.classList.contains('techpath-copy-guard-on'),
          watermark: !!document.getElementById('techPathSourceWatermark')
        };
      }
    };
  }

  function init() {
    injectStyle();
    document.documentElement.classList.add('techpath-copy-guard-on');

    addWatermark();
    bindMouseAndTouchGuard();
    bindKeyboardGuard();
    bindDevtoolsSoftNotice();
    protectConsole();
    exposeApi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
