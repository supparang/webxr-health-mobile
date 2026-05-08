/* =========================================================
 * /english/js/techpath-white-screen-rescue.js
 * PATCH v20260508a-WHITE-SCREEN-RESCUE
 *
 * ใช้เพื่อกู้หน้า lesson.html ที่ขึ้นหน้าขาว/ค้าง Loading
 * ✅ ไม่สร้าง Route ซ้ำ
 * ✅ ไม่ยุ่ง voice picker
 * ✅ ไม่ยุ่ง copy guard
 * ✅ ไม่ลบข้อมูลผู้เรียน
 * ✅ แค่เปิด body/app และซ่อน loading overlay ที่ค้าง
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'techpath-white-screen-rescue-v20260508a';

  function textOf(el) {
    return String(el && el.textContent ? el.textContent : '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function setI(el, prop, value) {
    if (el && el.style) {
      el.style.setProperty(prop, value, 'important');
    }
  }

  function looksLikeLoading(el) {
    const t = textOf(el);

    return (
      /Loading TechPath/i.test(t) ||
      /Preparing S1.?S15/i.test(t) ||
      /Preparing S1–S15/i.test(t) ||
      /Loading.*VR/i.test(t)
    );
  }

  function looksLikeMainLesson(el) {
    const t = textOf(el);

    return (
      /TechPath English VR Quest/i.test(t) ||
      /Session Learning/i.test(t) ||
      /Attendance Tracker/i.test(t) ||
      /Player Status/i.test(t) ||
      /ข้อมูลผู้เรียน/i.test(t)
    );
  }

  function hideOnlyLoading() {
    let count = 0;

    Array.from(document.querySelectorAll('div, section, article')).forEach(function (el) {
      if (!looksLikeLoading(el)) return;
      if (looksLikeMainLesson(el)) return;

      setI(el, 'display', 'none');
      setI(el, 'visibility', 'hidden');
      setI(el, 'opacity', '0');
      setI(el, 'pointer-events', 'none');
      el.setAttribute('aria-hidden', 'true');
      count += 1;
    });

    return count;
  }

  function revealLesson() {
    setI(document.documentElement, 'visibility', 'visible');
    setI(document.documentElement, 'opacity', '1');
    setI(document.documentElement, 'background', '#07111f');
    setI(document.documentElement, 'overflow-y', 'auto');

    setI(document.body, 'display', 'block');
    setI(document.body, 'visibility', 'visible');
    setI(document.body, 'opacity', '1');
    setI(document.body, 'background', '#07111f');
    setI(document.body, 'overflow-y', 'auto');
    setI(document.body, 'pointer-events', 'auto');

    Array.from(document.querySelectorAll('#app,#root,main,.app,.lesson-app,.lesson-shell,.tp-app,.screen,.page')).forEach(function (el) {
      if (looksLikeLoading(el) && !looksLikeMainLesson(el)) return;

      setI(el, 'display', '');
      setI(el, 'visibility', 'visible');
      setI(el, 'opacity', '1');
      setI(el, 'pointer-events', 'auto');
    });
  }

  function fixWhiteScreen() {
    revealLesson();
    const hidden = hideOnlyLoading();

    window.TECHPATH_READY = true;
    window.LESSON_READY = true;

    window.dispatchEvent(new CustomEvent('techpath:white-screen-rescue', {
      detail: {
        patch: PATCH_ID,
        hiddenLoading: hidden
      }
    }));

    console.log('[TechPathWhiteScreenRescue]', {
      patch: PATCH_ID,
      hiddenLoading: hidden,
      bodyTextLength: document.body ? textOf(document.body).length : 0
    });

    return hidden;
  }

  function expose() {
    window.TechPathWhiteScreenRescue = {
      run: fixWhiteScreen,
      debug: function () {
        const loading = Array.from(document.querySelectorAll('div, section, article'))
          .filter(looksLikeLoading)
          .map(function (el) {
            return {
              id: el.id || '',
              className: String(el.className || ''),
              text: textOf(el).slice(0, 120),
              display: getComputedStyle(el).display,
              visibility: getComputedStyle(el).visibility,
              opacity: getComputedStyle(el).opacity
            };
          });

        return {
          patch: PATCH_ID,
          loadingCount: loading.length,
          loading,
          bodyTextLength: document.body ? textOf(document.body).length : 0,
          ready: !!window.TECHPATH_READY
        };
      }
    };
  }

  function start() {
    expose();

    setTimeout(fixWhiteScreen, 900);
    setTimeout(fixWhiteScreen, 2500);
    setTimeout(fixWhiteScreen, 5000);

    let tries = 0;
    const timer = setInterval(function () {
      tries += 1;
      fixWhiteScreen();

      if (tries >= 10) clearInterval(timer);
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
