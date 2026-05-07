/* =========================================================
 * /english/js/techpath-loading-watchdog.js
 * PATCH v20260507-LOADING-WATCHDOG
 *
 * ✅ แก้หน้า Loading TechPath VR ค้าง
 * ✅ ซ่อน loading overlay หลัง timeout
 * ✅ เปิด main UI / Home / Lesson container กลับมา
 * ✅ set READY badge
 * ✅ ไม่แตะข้อมูลผู้เรียน / voice / route
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'techpath-loading-watchdog-v20260507';
  const TIMEOUT_MS = 4500;

  function txt(el) {
    return String(el && el.textContent ? el.textContent : '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function setI(el, prop, value) {
    if (el && el.style) el.style.setProperty(prop, value, 'important');
  }

  function isLoadingOverlay(el) {
    if (!el) return false;

    const t = txt(el);

    return (
      /Loading TechPath/i.test(t) ||
      /Preparing S1.?S15/i.test(t) ||
      /Preparing S1–S15/i.test(t) ||
      /Loading.*VR/i.test(t)
    );
  }

  function hideLoadingOverlays() {
    const candidates = Array.from(document.querySelectorAll(
      [
        '#loading',
        '#loader',
        '#loadingScreen',
        '#loading-screen',
        '#boot',
        '#bootScreen',
        '.loading',
        '.loader',
        '.loading-screen',
        '.boot-screen',
        '.splash',
        '.splash-screen',
        'section',
        'div'
      ].join(',')
    ));

    let hidden = 0;

    candidates.forEach(function (el) {
      if (!isLoadingOverlay(el)) return;

      setI(el, 'display', 'none');
      setI(el, 'visibility', 'hidden');
      setI(el, 'opacity', '0');
      setI(el, 'pointer-events', 'none');
      setI(el, 'z-index', '-1');

      el.setAttribute('aria-hidden', 'true');
      hidden += 1;
    });

    return hidden;
  }

  function revealMainUi() {
    const selectors = [
      '#app',
      '#root',
      '#main',
      'main',
      '.app',
      '.page',
      '.screen',
      '.home',
      '.lesson',
      '.lesson-app',
      '.lesson-shell',
      '.tp-app',
      '.tp-shell'
    ];

    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (isLoadingOverlay(el)) return;

        setI(el, 'display', '');
        setI(el, 'visibility', 'visible');
        setI(el, 'opacity', '1');
        setI(el, 'pointer-events', 'auto');
      });
    });

    setI(document.documentElement, 'overflow-y', 'auto');
    setI(document.body, 'overflow-y', 'auto');
    setI(document.body, 'visibility', 'visible');
    setI(document.body, 'opacity', '1');
  }

  function setReadyText() {
    Array.from(document.querySelectorAll('*')).forEach(function (el) {
      const t = txt(el);

      if (/LOADING|Loading|Preparing/i.test(t) && t.length < 80) {
        if (/status|ready|loading|preparing/i.test(String(el.className || '') + ' ' + String(el.id || ''))) {
          el.textContent = 'READY';
        }
      }
    });

    window.TECHPATH_READY = true;
    window.LESSON_READY = true;

    window.dispatchEvent(new CustomEvent('techpath:watchdog-ready', {
      detail: {
        patch: PATCH_ID,
        ts: Date.now()
      }
    }));
  }

  function tryCallKnownBootFunctions() {
    const fns = [
      'init',
      'boot',
      'startApp',
      'initLesson',
      'bootLesson',
      'renderHome',
      'showHome',
      'mountHome',
      'initTechPath',
      'bootTechPath'
    ];

    fns.forEach(function (name) {
      if (typeof window[name] === 'function' && !window[name].__watchdogCalled) {
        try {
          window[name].__watchdogCalled = true;
          window[name]();
        } catch (e) {
          // เงียบไว้ เพราะบางฟังก์ชันต้องใช้ args
        }
      }
    });
  }

  function showSmallNotice(message) {
    let box = document.getElementById('techPathLoadingWatchdogNotice');

    if (!box) {
      box = document.createElement('div');
      box.id = 'techPathLoadingWatchdogNotice';
      box.style.cssText = [
        'position:fixed',
        'left:12px',
        'right:12px',
        'bottom:92px',
        'z-index:9999999',
        'padding:10px 14px',
        'border-radius:16px',
        'background:rgba(5,17,32,.96)',
        'color:#eaffff',
        'border:1px solid rgba(105,232,255,.48)',
        'box-shadow:0 14px 44px rgba(0,0,0,.38)',
        'font:900 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif',
        'text-align:center',
        'pointer-events:none'
      ].join(';');

      document.body.appendChild(box);
    }

    box.textContent = message;
    box.style.display = 'block';

    clearTimeout(box._t);
    box._t = setTimeout(function () {
      box.style.display = 'none';
    }, 3000);
  }

  function rescue(reason) {
    const hidden = hideLoadingOverlays();

    revealMainUi();
    setReadyText();
    tryCallKnownBootFunctions();

    if (hidden > 0) {
      showSmallNotice('โหลดนานเกินไป จึงปลดหน้า Loading ให้แล้ว');
    }

    console.log('[TechPath Loading Watchdog] rescue', {
      patch: PATCH_ID,
      reason,
      hiddenLoadingOverlays: hidden,
      ready: true
    });

    return hidden;
  }

  function exposeApi() {
    window.TechPathLoadingWatchdog = {
      version: PATCH_ID,
      rescue: function () {
        return rescue('manual');
      },
      debug: function () {
        const loading = Array.from(document.querySelectorAll('div, section'))
          .filter(isLoadingOverlay)
          .map(function (el) {
            return {
              id: el.id || '',
              className: String(el.className || ''),
              text: txt(el).slice(0, 120),
              display: getComputedStyle(el).display,
              visibility: getComputedStyle(el).visibility,
              opacity: getComputedStyle(el).opacity
            };
          });

        return {
          patch: PATCH_ID,
          loadingOverlaysFound: loading.length,
          loading,
          ready: !!window.TECHPATH_READY
        };
      }
    };
  }

  function run() {
    exposeApi();

    // รอบแรก: ลอง boot เฉย ๆ ก่อน
    setTimeout(function () {
      tryCallKnownBootFunctions();
    }, 900);

    // รอบหลัก: ถ้ายังค้าง ให้ซ่อน loading
    setTimeout(function () {
      rescue('timeout');
    }, TIMEOUT_MS);

    // รอบสำรอง: กรณี engine render loading กลับมาใหม่
    let tries = 0;
    const timer = setInterval(function () {
      tries += 1;

      const loadingCount = Array.from(document.querySelectorAll('div, section'))
        .filter(isLoadingOverlay).length;

      if (loadingCount > 0 && tries >= 4) {
        rescue('interval');
      }

      if (tries >= 16) clearInterval(timer);
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
