/* =========================================================
 * /english/js/techpath-copy-guard-safe.js
 * PATCH v20260510a-COPY-GUARD-SAFE
 *
 * ✅ ลดการ copy แบบง่าย ๆ
 * ✅ กัน right click / select / drag / copy / cut / save / print / view-source shortcuts
 * ✅ ไม่บล็อก input / textarea เพื่อให้ผู้เรียนยังพิมพ์คำตอบได้
 * ✅ ไม่ทำให้ lesson boot พัง
 * ✅ ไม่ยุ่ง AI Help / voice / counter
 *
 * หมายเหตุ:
 * กัน source code 100% ไม่ได้ เพราะ browser ต้องโหลดไฟล์มาใช้งาน
 * ไฟล์นี้ใช้เพื่อ discourage casual copying เท่านั้น
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'techpath-copy-guard-safe-v20260510a';

  function isEditable(el) {
    if (!el) return false;

    const tag = String(el.tagName || '').toLowerCase();

    return (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      el.isContentEditable ||
      !!(el.closest && el.closest('input, textarea, select, [contenteditable="true"]'))
    );
  }

  function toast(msg) {
    try {
      let el = document.getElementById('techPathCopyGuardToast');

      if (!el) {
        el = document.createElement('div');
        el.id = 'techPathCopyGuardToast';
        el.style.cssText = [
          'position:fixed',
          'left:50%',
          'bottom:92px',
          'transform:translateX(-50%)',
          'z-index:99999999',
          'width:min(620px,calc(100vw - 24px))',
          'padding:12px 16px',
          'border-radius:18px',
          'background:rgba(5,17,32,.96)',
          'color:#eaffff',
          'border:1px solid rgba(105,232,255,.45)',
          'box-shadow:0 16px 44px rgba(0,0,0,.38)',
          'font:900 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif',
          'text-align:center',
          'pointer-events:none',
          'display:none'
        ].join(';');

        document.body.appendChild(el);
      }

      el.textContent = msg;
      el.style.display = 'block';

      clearTimeout(el._t);
      el._t = setTimeout(function () {
        el.style.display = 'none';
      }, 1800);
    } catch (e) {}
  }

  function blockEvent(e, msg) {
    if (isEditable(e.target)) return true;

    try {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    } catch (err) {}

    if (msg) toast(msg);

    return false;
  }

  function injectStyle() {
    if (document.getElementById(PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = PATCH_ID + '-style';
    style.textContent = `
      body.techpath-copy-guard-on,
      body.techpath-copy-guard-on * {
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }

      body.techpath-copy-guard-on input,
      body.techpath-copy-guard-on textarea,
      body.techpath-copy-guard-on select,
      body.techpath-copy-guard-on [contenteditable="true"],
      body.techpath-copy-guard-on input *,
      body.techpath-copy-guard-on textarea *,
      body.techpath-copy-guard-on select * {
        -webkit-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
      }

      @media print {
        body {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function bindGuards() {
    document.body.classList.add('techpath-copy-guard-on');

    document.addEventListener('contextmenu', function (e) {
      return blockEvent(e, 'โหมดบทเรียน: ปิดคลิกขวาเพื่อป้องกันการคัดลอก');
    }, true);

    document.addEventListener('dragstart', function (e) {
      return blockEvent(e, '');
    }, true);

    document.addEventListener('selectstart', function (e) {
      if (isEditable(e.target)) return true;
      return blockEvent(e, '');
    }, true);

    document.addEventListener('copy', function (e) {
      if (isEditable(e.target)) return true;
      return blockEvent(e, 'ปิดการคัดลอกเนื้อหาบทเรียน');
    }, true);

    document.addEventListener('cut', function (e) {
      if (isEditable(e.target)) return true;
      return blockEvent(e, 'ปิดการตัด/คัดลอกเนื้อหาบทเรียน');
    }, true);

    document.addEventListener('keydown', function (e) {
      const key = String(e.key || '').toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (isEditable(e.target)) {
        return true;
      }

      const blocked =
        key === 'f12' ||
        (ctrl && key === 's') ||
        (ctrl && key === 'p') ||
        (ctrl && key === 'u') ||
        (ctrl && key === 'c') ||
        (ctrl && key === 'x') ||
        (ctrl && key === 'a') ||
        (ctrl && shift && (key === 'i' || key === 'j' || key === 'c'));

      if (blocked) {
        return blockEvent(e, 'ปิด shortcut นี้ในโหมดบทเรียน');
      }

      return true;
    }, true);
  }

  function init() {
    injectStyle();
    bindGuards();

    window.TechPathCopyGuard = {
      version: PATCH_ID,
      enabled: true,
      note: 'Client-side guard only. It discourages casual copying but cannot fully hide browser-delivered source code.'
    };

    console.log('[TechPath Copy Guard] enabled', window.TechPathCopyGuard);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
