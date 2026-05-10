/* =========================================================
 * /english/js/techpath-boot-watchdog.js
 * PATCH v20260510b-BOOT-WATCHDOG-RECOVER-APP
 *
 * ✅ แสดง error จริงถ้า boot ไม่ผ่าน
 * ✅ ถ้า data ครบ + QA ผ่าน แต่จอดำ จะกู้หน้า app/homeView กลับมา
 * ✅ ไม่ยุ่ง lesson engine หลัก
 * ✅ ไม่ซ่อน error จริง
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'techpath-boot-watchdog-v20260510b-recover-app';
  const CHECK_DELAY_MS = 3200;
  const RECOVER_DELAY_MS = 5200;

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

  function byId(id) {
    return document.getElementById(id);
  }

  function getDataReport() {
    const data = window.TECHPATH_LESSON_DATA || null;
    const sessions = data && Array.isArray(data.SESSIONS) ? data.SESSIONS.length : 0;
    const banks = data && data.SESSION_BANK ? Object.keys(data.SESSION_BANK).length : 0;

    return {
      hasData: !!data,
      dataVersion: data && data.VERSION ? data.VERSION : '',
      sessions,
      banks,
      dataOk: !!data && sessions === 15 && banks === 15
    };
  }

  function getStatus() {
    const boot = byId('boot');
    const app = byId('app');
    const homeView = byId('homeView');
    const gameView = byId('gameView');
    const summaryView = byId('summaryView');
    const data = getDataReport();

    return {
      patch: PATCH_ID,
      TECHPATH_BOOT_OK: window.TECHPATH_BOOT_OK,
      qaReport: window.TECHPATH_QA_REPORT,
      bootExists: !!boot,
      bootClass: boot ? boot.className : '',
      appExists: !!app,
      appClass: app ? app.className : '',
      appDisplay: app ? getComputedStyle(app).display : '',
      appVisibility: app ? getComputedStyle(app).visibility : '',
      homeExists: !!homeView,
      homeClass: homeView ? homeView.className : '',
      gameClass: gameView ? gameView.className : '',
      summaryClass: summaryView ? summaryView.className : '',
      hasData: data.hasData,
      dataVersion: data.dataVersion,
      sessions: data.sessions,
      banks: data.banks,
      dataOk: data.dataOk,
      aiHelpStable: !!window.TechPathAIHelpStable,
      aiHelpDebug: window.TechPathAIHelpStable && typeof window.TechPathAIHelpStable.debug === 'function'
        ? safeCall(function () { return window.TechPathAIHelpStable.debug(); })
        : null,
      lastError,
      lastRejection,
      location: location.href
    };
  }

  function safeCall(fn) {
    try {
      return fn();
    } catch (e) {
      return { error: String(e && (e.stack || e.message) || e) };
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

  function shouldIgnoreError(msg) {
    msg = String(msg || '');

    if (/A listener indicated an asynchronous response/i.test(msg)) return true;
    if (/message channel closed/i.test(msg)) return true;
    if (/Extension context invalidated/i.test(msg)) return true;
    if (/chrome-extension:/i.test(msg)) return true;
    if (/moz-extension:/i.test(msg)) return true;
    if (/favicon.ico/i.test(msg)) return true;

    return false;
  }

  function renderBootError(title, subtitle, detail) {
    const boot = byId('boot');

    if (!boot || window.TECHPATH_BOOT_OK === true) return;

    rendered = true;

    const status = getStatus();

    boot.classList.remove('off');
    boot.style.display = 'flex';
    boot.style.visibility = 'visible';
    boot.style.opacity = '1';

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

  function recoverApp() {
    const data = getDataReport();
    const boot = byId('boot');
    const app = byId('app');
    const homeView = byId('homeView');
    const gameView = byId('gameView');
    const summaryView = byId('summaryView');

    if (!data.dataOk || !app || !homeView) return false;

    const qaOk = Array.isArray(window.TECHPATH_QA_REPORT)
      ? window.TECHPATH_QA_REPORT.length === 0
      : true;

    if (!qaOk) return false;

    window.TECHPATH_BOOT_OK = true;

    if (boot) {
      boot.classList.add('off');
      boot.style.opacity = '0';
      boot.style.visibility = 'hidden';
      boot.style.pointerEvents = 'none';
    }

    app.classList.remove('hidden');
    app.style.display = '';
    app.style.visibility = 'visible';
    app.style.opacity = '1';

    homeView.classList.remove('hidden');
    homeView.style.display = '';

    if (gameView) gameView.classList.remove('on');
    if (summaryView) summaryView.classList.remove('on');

    document.body.style.background = '';
    document.body.style.minHeight = '100dvh';

    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (e) {
      window.scrollTo(0, 0);
    }

    console.log('[TechPath Boot Watchdog] recovered app/homeView safely', getStatus());

    return true;
  }

  function checkBoot() {
    const status = getStatus();

    console.log('[TechPath Boot Watchdog]', status);

    if (window.TECHPATH_BOOT_OK === true) {
      recoverApp();
      return;
    }

    if (recoverApp()) return;

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
      'boot() ไม่สำเร็จ แต่ data ครบ',
      'ระบบพบ data ครบแล้ว แต่ boot ไม่ตั้ง TECHPATH_BOOT_OK=true\nลองเรียก window.TechPathBootWatchdog.recover() ใน Console'
    );
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
      console.warn('[TechPath Boot Watchdog] ignored noise error:', lastError);
      return;
    }

    if (window.TECHPATH_BOOT_OK !== true) {
      renderBootError('Boot Error', 'JS Error', msg);
    }
  });

  window.addEventListener('unhandledrejection', function (e) {
    const msg = formatRejectionEvent(e);

    lastRejection = { detail: msg };

    if (shouldIgnoreError(msg)) {
      console.warn('[TechPath Boot Watchdog] ignored promise noise:', lastRejection);
      return;
    }

    if (window.TECHPATH_BOOT_OK !== true) {
      renderBootError('Boot Error', 'Promise Error', msg);
    }
  });

  window.TechPathBootWatchdog = {
    version: PATCH_ID,
    debug: getStatus,
    check: checkBoot,
    recover: recoverApp,
    show: function () {
      renderBootError(
        'Boot Debug',
        'Manual Debug',
        JSON.stringify(getStatus(), null, 2)
      );
    },
    reloadUrl
  };

  function schedule() {
    setTimeout(checkBoot, CHECK_DELAY_MS);
    setTimeout(recoverApp, RECOVER_DELAY_MS);
    setTimeout(recoverApp, RECOVER_DELAY_MS + 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
})();
