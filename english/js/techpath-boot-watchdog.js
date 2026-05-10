/* =========================================================
 * /english/js/techpath-boot-watchdog.js
 * PATCH v20260509-BOOT-WATCHDOG
 *
 * ✅ แสดง error จริงถ้า lesson.html boot ไม่ผ่าน
 * ✅ ไม่แก้ engine หลัก
 * ✅ ถ้า boot สำเร็จแต่ overlay ไม่หาย จะปลด #boot.off ให้
 * ✅ มีปุ่ม Reload S1
 * ✅ มี debug API: window.TechPathBootWatchdog.debug()
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'techpath-boot-watchdog-v20260509';
  const CHECK_DELAY_MS = 3500;
  const FORCE_OFF_DELAY_MS = 6500;

  let lastError = null;
  let lastRejection = null;
  let rendered = false;

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m];
    });
  }

  function getBoot() {
    return document.getElementById('boot');
  }

  function getDataReport() {
    const data = window.TECHPATH_LESSON_DATA || null;
    const sessions = data && Array.isArray(data.SESSIONS) ? data.SESSIONS.length : 0;
    const banks = data && data.SESSION_BANK ? Object.keys(data.SESSION_BANK).length : 0;

    return {
      hasData: !!data,
      dataVersion: data && data.VERSION ? data.VERSION : '',
      sessions: sessions,
      banks: banks
    };
  }

  function getStatus() {
    const boot = getBoot();
    const data = getDataReport();

    return {
      patch: PATCH_ID,
      TECHPATH_BOOT_OK: window.TECHPATH_BOOT_OK,
      bootExists: !!boot,
      bootClass: boot ? boot.className : '',
      appExists: !!document.getElementById('app'),
      hasData: data.hasData,
      dataVersion: data.dataVersion,
      sessions: data.sessions,
      banks: data.banks,
      aiHelpStable: !!window.TechPathAIHelpStable,
      aiHelpDebug: window.TechPathAIHelpStable && typeof window.TechPathAIHelpStable.debug === 'function'
        ? safeCall(function () { return window.TechPathAIHelpStable.debug(); })
        : null,
      lastError: lastError,
      lastRejection: lastRejection,
      location: location.href
    };
  }

  function safeCall(fn) {
    try {
      return fn();
    } catch (e) {
      return {
        error: String(e && (e.stack || e.message) || e)
      };
    }
  }

  function reloadUrl() {
    try {
      const url = new URL(location.href);
      url.searchParams.set('s', url.searchParams.get('s') || '1');
      url.searchParams.set('diff', url.searchParams.get('diff') || 'normal');
      url.searchParams.set('level', url.searchParams.get('level') || 'normal');
      url.searchParams.set('run', url.searchParams.get('run') || 'play');
      url.searchParams.set('v', String(Date.now()));
      return url.toString();
    } catch (e) {
      return './lesson.html?s=1&diff=normal&level=normal&run=play&v=' + Date.now();
    }
  }

  function renderBootError(title, subtitle, detail) {
    const boot = getBoot();

    if (!boot || window.TECHPATH_BOOT_OK === true) return;

    rendered = true;

    const status = getStatus();

    boot.classList.remove('off');
    boot.innerHTML = `
      <div class="bootBox" style="max-width:980px;width:min(980px,calc(100vw - 28px));">
        <h1 class="bootTitle">${esc(title || 'Boot Error')}</h1>
        <p class="bootSub">${esc(subtitle || 'เปิด Console เพื่อดู error ล่าสุด')}</p>

        <pre style="
          white-space:pre-wrap;
          text-align:left;
          color:#ffd5dc;
          background:rgba(0,0,0,.35);
          padding:14px;
          border-radius:16px;
          font-size:13px;
          max-width:980px;
          max-height:46vh;
          overflow:auto;
          line-height:1.45;
          border:1px solid rgba(255,255,255,.14);
        ">${esc(detail || '')}

---- BOOT STATUS ----
${esc(JSON.stringify(status, null, 2))}</pre>

        <button onclick="location.href='${esc(reloadUrl())}'"
          style="
            margin-top:18px;
            padding:14px 22px;
            border-radius:18px;
            border:0;
            background:#72e8ff;
            color:#06111f;
            font-weight:1000;
            cursor:pointer;
          ">
          Reload S1
        </button>
      </div>
    `;
  }

  function formatErrorEvent(e) {
    const lines = [];

    lines.push(String(e && e.message ? e.message : 'JS Error'));

    if (e && e.filename) {
      lines.push(String(e.filename) + ':' + String(e.lineno || '') + ':' + String(e.colno || ''));
    }

    if (e && e.error && e.error.stack) {
      lines.push('');
      lines.push(String(e.error.stack));
    }

    return lines.join('\n');
  }

  function formatRejectionEvent(e) {
    const reason = e ? e.reason : null;

    if (!reason) return 'Unhandled promise rejection';

    if (reason.stack) return String(reason.stack);
    if (reason.message) return String(reason.message);

    try {
      return JSON.stringify(reason, null, 2);
    } catch (err) {
      return String(reason);
    }
  }

  function shouldIgnoreError(msg) {
    msg = String(msg || '');

    /*
     * Chrome extension noise เช่น:
     * A listener indicated an asynchronous response...
     * ไม่ควรทำให้เกมขึ้น Boot Error
     */
    if (/A listener indicated an asynchronous response/i.test(msg)) return true;
    if (/message channel closed/i.test(msg)) return true;
    if (/Extension context invalidated/i.test(msg)) return true;
    if (/chrome-extension:/i.test(msg)) return true;
    if (/moz-extension:/i.test(msg)) return true;

    return false;
  }

  window.addEventListener('error', function (e) {
    const msg = formatErrorEvent(e);

    lastError = {
      message: String(e && e.message || ''),
      filename: String(e && e.filename || ''),
      lineno: e && e.lineno,
      colno: e && e.colno,
      detail: msg
    };

    if (shouldIgnoreError(msg)) {
      console.warn('[TechPath Boot Watchdog] Ignored extension/noise error:', lastError);
      return;
    }

    if (window.TECHPATH_BOOT_OK !== true) {
      renderBootError('Boot Error', 'JS Error', msg);
    }
  });

  window.addEventListener('unhandledrejection', function (e) {
    const msg = formatRejectionEvent(e);

    lastRejection = {
      detail: msg
    };

    if (shouldIgnoreError(msg)) {
      console.warn('[TechPath Boot Watchdog] Ignored promise noise:', lastRejection);
      return;
    }

    if (window.TECHPATH_BOOT_OK !== true) {
      renderBootError('Boot Error', 'Promise Error', msg);
    }
  });

  function checkBoot() {
    const status = getStatus();

    console.log('[TechPath Boot Watchdog]', status);

    if (window.TECHPATH_BOOT_OK === true) {
      const boot = getBoot();

      if (boot && !boot.classList.contains('off')) {
        boot.classList.add('off');
      }

      return;
    }

    if (rendered) return;

    if (!status.hasData) {
      renderBootError(
        'Boot Error',
        'lesson-data.js ไม่โหลด หรือ TECHPATH_LESSON_DATA หาย',
        'ตรวจสอบไฟล์ ./js/lesson-data.js ในแท็บ Network ว่าเป็น 200 หรือ 404'
      );
      return;
    }

    if (status.sessions !== 15 || status.banks !== 15) {
      renderBootError(
        'Boot Error',
        'ข้อมูล S1–S15 ไม่ครบ',
        'SESSIONS = ' + status.sessions + '\nSESSION_BANK = ' + status.banks
      );
      return;
    }

    renderBootError(
      'Boot Error',
      'boot() ไม่สำเร็จ แต่ยังไม่พบ error สีแดง',
      'เปิด Console แล้วดู [TechPath Boot Watchdog] เพื่อเช็กค่า TECHPATH_BOOT_OK / data / aiHelp'
    );
  }

  function forceOverlayOffIfBootOk() {
    const boot = getBoot();

    if (window.TECHPATH_BOOT_OK === true && boot) {
      boot.classList.add('off');
      return;
    }

    /*
     * ไม่บังคับปิดถ้า boot ไม่ผ่านจริง
     * เพราะจะซ่อนปัญหาหลักและทำให้หน้าโล่งแต่เกมใช้ไม่ได้
     */
  }

  window.TechPathBootWatchdog = {
    version: PATCH_ID,
    debug: getStatus,
    check: checkBoot,
    show: function () {
      renderBootError(
        'Boot Debug',
        'Manual Debug',
        JSON.stringify(getStatus(), null, 2)
      );
    },
    hideBootIfOk: forceOverlayOffIfBootOk,
    reloadUrl: reloadUrl
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(checkBoot, CHECK_DELAY_MS);
      setTimeout(forceOverlayOffIfBootOk, FORCE_OFF_DELAY_MS);
    }, { once: true });
  } else {
    setTimeout(checkBoot, CHECK_DELAY_MS);
    setTimeout(forceOverlayOffIfBootOk, FORCE_OFF_DELAY_MS);
  }
})();
