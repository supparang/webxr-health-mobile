(() => {
  'use strict';

  const PATCH = 'groups-ar-runtime-compat-v5.1.0-grade5-easy-grab';
  const params = new URLSearchParams(location.search);
  const ASSIST = {
    effectiveGrabRadiusPx: 152,
    grabDistanceScale: 0.66,
    binStartRatio: 0.645,
    stickyGrabUntilBin: true,
    visualFollowMs: 55
  };

  function passportMode() {
    return window.parent !== window ||
      params.get('classroom') === '1' ||
      params.get('passport') === '1' ||
      params.get('embedded') === '1' ||
      params.get('from') === 'passport';
  }

  function installEasyInteractionAssist() {
    if (window.__HH_GROUPS_EASY_GRAB_INSTALLED__) return;
    window.__HH_GROUPS_EASY_GRAB_INSTALLED__ = true;
    window.HH_GROUPS_INTERACTION_ASSIST = { ...ASSIST, patch: PATCH };

    const url = new URL(location.href);
    const currentClose = Number(url.searchParams.get('pinchClose')) || 0;
    const currentOpen = Number(url.searchParams.get('pinchOpen')) || 0;
    if (currentClose < 0.085) url.searchParams.set('pinchClose', '0.085');
    if (currentOpen < 0.145) url.searchParams.set('pinchOpen', '0.145');
    url.searchParams.set('interactionAssist', 'grade5-easy-grab-v1');
    history.replaceState(null, '', url.href);

    const arena = document.getElementById('arena');
    if (arena && !arena.__hhOriginalRect) {
      const originalRect = arena.getBoundingClientRect.bind(arena);
      arena.__hhOriginalRect = originalRect;
      arena.getBoundingClientRect = function assistedArenaRect() {
        const rect = originalRect();
        const stack = String(new Error().stack || '');
        if (!/\bbinAt\b/.test(stack)) return rect;
        const assistedHeight = rect.height * 0.86;
        return {
          x: rect.x, y: rect.y, top: rect.top, left: rect.left,
          right: rect.right, bottom: rect.top + assistedHeight,
          width: rect.width, height: assistedHeight,
          toJSON: () => ({
            x: rect.x, y: rect.y, top: rect.top, left: rect.left,
            right: rect.right, bottom: rect.top + assistedHeight,
            width: rect.width, height: assistedHeight
          })
        };
      };
    }

    if (!Math.__hhGroupsOriginalHypot) {
      const originalHypot = Math.hypot.bind(Math);
      Math.__hhGroupsOriginalHypot = originalHypot;
      Math.hypot = function assistedHypot(...values) {
        const distance = originalHypot(...values);
        if (values.length !== 2) return distance;

        const maxMagnitude = Math.max(Math.abs(Number(values[0]) || 0), Math.abs(Number(values[1]) || 0));
        if (maxMagnitude > 2) return distance * ASSIST.grabDistanceScale;

        const selected = document.querySelector('.food.selected');
        if (selected && distance >= 0.145) {
          const hand = document.getElementById('hand');
          const gameArena = document.getElementById('arena');
          const handY = Number.parseFloat(hand?.style.top || '0');
          const height = gameArena?.clientHeight || 1;
          if (handY < height * ASSIST.binStartRatio) return 0.12;
        }
        return distance;
      };
    }

    const style = document.createElement('style');
    style.id = 'hh-groups-grade5-easy-grab-style';
    style.textContent = `
      .food{box-shadow:0 0 0 7px rgba(255,255,255,.18),0 19px 54px rgba(0,0,0,.25)!important}
      .food.selected{transition:left ${ASSIST.visualFollowMs}ms linear,top ${ASSIST.visualFollowMs}ms linear,filter .1s,box-shadow .1s!important;box-shadow:0 0 0 13px rgba(67,207,123,.34),0 25px 70px rgba(0,0,0,.3)!important;filter:brightness(1.1) saturate(1.15)!important}
      .hand{width:66px!important;height:66px!important;margin:-33px 0 0 -33px!important;box-shadow:0 0 0 12px rgba(101,201,255,.18),0 10px 30px rgba(0,0,0,.25)!important}
      .hand.pinch{box-shadow:0 0 0 14px rgba(67,207,123,.24),0 10px 30px rgba(0,0,0,.25)!important}
      .bin{min-height:74px!important;border-width:2px!important}
      .bin.hover{transform:translateY(-9px) scale(1.07)!important;outline:4px solid rgba(67,207,123,.9)!important;box-shadow:0 0 0 8px rgba(67,207,123,.2),0 15px 46px rgba(0,0,0,.18)!important}
      @media(max-width:520px){.food{width:94px!important;height:94px!important}.food .emoji{font-size:44px!important}.bin{min-height:69px!important}}
    `;
    document.head.appendChild(style);

    const feedback = document.getElementById('feedback');
    const foodLayer = document.getElementById('foodLayer');
    if (foodLayer && feedback) {
      const updateGrabHint = () => {
        const selected = foodLayer.querySelector('.food.selected');
        if (selected) feedback.textContent = '✅ หยิบติดมือแล้ว • เลื่อนลงเหนือหมู่ที่เลือก แล้วกางนิ้ว';
      };
      new MutationObserver(updateGrabHint).observe(foodLayer, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['class']
      });
    }

    const summary = document.getElementById('summary');
    if (summary) {
      const annotate = () => {
        if (summary.classList.contains('hidden')) return;
        try {
          const key = 'HHA_GROUPS_AR_LAST_RESULT';
          const result = JSON.parse(localStorage.getItem(key) || 'null');
          if (!result || result.interactionAssistProfile) return;
          result.interactionAssistProfile = { ...ASSIST, profile: 'grade5-easy-grab-v1' };
          localStorage.setItem(key, JSON.stringify(result));
        } catch (_) {}
      };
      new MutationObserver(annotate).observe(summary, { attributes: true, childList: true, subtree: true });
    }
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

  installEasyInteractionAssist();

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
      detail: { patch: PATCH, mode: 'hand-ar-only', interactionAssist: ASSIST }
    }));
    console.info('[Groups AR Runtime]', PATCH, ASSIST);
  };
  script.onerror = renderLoadError;
  document.head.appendChild(script);
})();
