(() => {
  'use strict';

  const PATCH = 'groups-ar-runtime-compat-v5.0.1-thai-strict-ar';
  const params = new URLSearchParams(location.search);

  function passportMode() {
    return window.parent !== window ||
      params.get('classroom') === '1' ||
      params.get('passport') === '1' ||
      params.get('embedded') === '1' ||
      params.get('from') === 'passport';
  }

  function summaryVisible(summary) {
    if (!summary) return false;
    const style = getComputedStyle(summary);
    return !summary.classList.contains('hidden') &&
      style.display !== 'none' && style.visibility !== 'hidden';
  }

  function fallbackPassportUrl() {
    let target = null;
    try {
      if (window.parent !== window) {
        const shellUrl = new URL(window.top.location.href);
        const returnValue = shellUrl.searchParams.get('return');
        if (returnValue) target = new URL(returnValue, shellUrl);
      }
    } catch (_) {}

    if (!target) {
      const requested = params.get('return') || params.get('returnUrl') || '';
      try { if (requested) target = new URL(requested, location.href); }
      catch (_) {}
    }

    if (!target) {
      try {
        if (document.referrer) {
          const referrer = new URL(document.referrer);
          if (referrer.origin === location.origin && referrer.href !== location.href) target = referrer;
        }
      } catch (_) {}
    }

    if (!target) target = new URL('../HeroHealth_Learning1/index.html', location.href);
    const sid = params.get('studentId') || params.get('pid') || '';
    if (sid) target.searchParams.set('sid', sid);
    target.searchParams.set('authorityRefresh', String(Date.now()));
    target.searchParams.set('gameSync', '1');
    target.searchParams.set('pendingGameSync', 'nutrition:groups');
    return target;
  }

  function applyStudentUi() {
    if (!passportMode()) return;
    const controls = document.querySelector('.footer .controls');
    if (controls) controls.style.display = 'none';
    ['qaBtn', 'zoneBtn', 'menuBtn', 'menuZoneBtn', 'arOnlyZone'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.style.display = 'none';
    });
    try {
      const parentDoc = window.parent.document;
      const parentStatus = parentDoc.getElementById('status');
      if (parentStatus) parentStatus.style.display = 'none';
      const parentTitle = parentDoc.getElementById('title');
      if (parentTitle) parentTitle.textContent = 'ภารกิจอาหาร 5 หมู่';
    } catch (_) {}
  }

  function cleanStudentText() {
    const replacements = new Map([
      ['เปิด Camera AR ไม่สำเร็จ', 'เปิดกล้องไม่สำเร็จ'],
      ['AR ยังไม่พร้อม', 'กล้องยังไม่พร้อม'],
      ['Camera Check', 'ตรวจกล้องและมือ'],
      ['Hand AR', 'พร้อมใช้มือ'],
      ['Touch Fallback', ''],
      ['Touch AR', '']
    ]);
    ['arOnlyTitle', 'cameraText', 'phaseTitle', 'phaseSub', 'feedback'].forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;
      const replacement = replacements.get(element.textContent.trim());
      if (replacement !== undefined) element.textContent = replacement;
    });
  }

  function installArErrorCameraRelease() {
    const block = document.getElementById('arOnlyBlock');
    const video = document.getElementById('camera');
    if (!block || !video) return;
    const release = () => {
      if (block.classList.contains('hidden')) return;
      try { video.srcObject?.getTracks?.().forEach((track) => track.stop()); }
      catch (_) {}
      video.srcObject = null;
    };
    new MutationObserver(release).observe(block, { attributes: true, attributeFilter: ['class'] });
    release();
  }

  function installStandaloneReturn() {
    if (window.parent !== window || !passportMode()) return;
    const summary = document.getElementById('summary');
    if (!summary) return;
    let returning = false;
    const check = () => {
      if (returning || !summaryVisible(summary)) return;
      returning = true;
      const delivery = document.getElementById('delivery');
      if (delivery) delivery.textContent = 'กำลังกลับ Hero Passport…';
      setTimeout(() => location.replace(fallbackPassportUrl().href), 1400);
    };
    new MutationObserver(check).observe(summary, {
      attributes: true, childList: true, subtree: true, characterData: true
    });
    setInterval(check, 500);
    check();
  }

  function installSafetyButton() {
    if (window.parent === window || !passportMode()) return;
    const summary = document.getElementById('summary');
    const actions = document.getElementById('summaryActions') || summary?.querySelector('.sheetActions');
    if (!summary || !actions || document.getElementById('passportSafetyReturn')) return;

    const button = document.createElement('button');
    button.id = 'passportSafetyReturn';
    button.type = 'button';
    button.className = 'big alt';
    button.textContent = '← กลับ Hero Passport';
    button.hidden = true;
    actions.appendChild(button);

    let armed = false;
    const show = () => {
      if (!summaryVisible(summary) || armed) return;
      armed = true;
      setTimeout(() => {
        if (!summaryVisible(summary)) return;
        actions.hidden = false;
        button.hidden = false;
        const delivery = document.getElementById('delivery');
        if (delivery) delivery.textContent = 'หากยังไม่กลับอัตโนมัติ กดปุ่มด้านล่างได้';
      }, 6000);
    };

    button.onclick = () => {
      button.disabled = true;
      button.textContent = 'กำลังกลับ Passport…';
      try {
        const shellBack = window.top.document.getElementById('back');
        if (shellBack) {
          shellBack.click();
          return;
        }
      } catch (_) {}
      try { window.top.location.replace(fallbackPassportUrl().href); }
      catch (_) { location.replace(fallbackPassportUrl().href); }
    };

    new MutationObserver(show).observe(summary, {
      attributes: true, childList: true, subtree: true, characterData: true
    });
    setInterval(show, 500);
    show();
  }

  function installTextGuard() {
    const run = () => {
      cleanStudentText();
      applyStudentUi();
    };
    new MutationObserver(run).observe(document.documentElement, {
      childList: true, characterData: true, subtree: true
    });
    run();
  }

  function renderLoadError() {
    document.body.innerHTML = [
      '<main style="min-height:100dvh;padding:28px;font-family:system-ui;background:#103c3a;color:white">',
      '<h1>เปิดเกมไม่สำเร็จ</h1>',
      '<p>ไฟล์เกมโหลดไม่ครบ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่</p>',
      '<button onclick="location.reload()" style="min-height:48px;padding:10px 16px;border:0;border-radius:14px;font:inherit;font-weight:900">ลองใหม่</button>',
      '</main>'
    ].join('');
  }

  const script = document.createElement('script');
  script.src = './vr-groups/groups-ar-runtime-v311.js?v=20260730-thai-strict-ar-v500';
  script.async = false;
  script.dataset.groupsRuntimeLoader = PATCH;
  script.onload = () => {
    installArErrorCameraRelease();
    installStandaloneReturn();
    installSafetyButton();
    installTextGuard();
    window.dispatchEvent(new CustomEvent('groups-runtime-ready', {
      detail: { patch: PATCH, mode: 'hand-ar-only' }
    }));
    console.info('[Groups AR Runtime]', PATCH);
  };
  script.onerror = renderLoadError;
  document.head.appendChild(script);
})();
