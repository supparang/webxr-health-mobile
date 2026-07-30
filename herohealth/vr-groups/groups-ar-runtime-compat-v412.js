(() => {
  'use strict';

  const PATCH = 'groups-ar-runtime-compat-v5.1.3-stable-no-freeze';
  const params = new URLSearchParams(location.search);
  const ASSIST = {
    profile: 'grade5-stable-easy-v2',
    pinchClose: 0.085,
    pinchOpen: 0.14,
    visualGrabAssist: true,
    globalMathPatch: false
  };

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

    if (!target) target = new URL('../HeroHealth_Learning1/index.html', location.href);
    const sid = params.get('studentId') || params.get('pid') || '';
    if (sid) target.searchParams.set('sid', sid);
    target.searchParams.set('authorityRefresh', String(Date.now()));
    target.searchParams.set('gameSync', '1');
    target.searchParams.set('pendingGameSync', 'nutrition:groups');
    return target;
  }

  function installStableAssist() {
    const url = new URL(location.href);
    const close = Number(url.searchParams.get('pinchClose')) || 0;
    const open = Number(url.searchParams.get('pinchOpen')) || 0;
    if (close < ASSIST.pinchClose) url.searchParams.set('pinchClose', String(ASSIST.pinchClose));
    if (open < ASSIST.pinchOpen) url.searchParams.set('pinchOpen', String(ASSIST.pinchOpen));
    url.searchParams.set('interactionAssist', ASSIST.profile);
    history.replaceState(null, '', url.href);
    window.HH_GROUPS_INTERACTION_ASSIST = { ...ASSIST, patch: PATCH };

    const style = document.createElement('style');
    style.id = 'hh-groups-stable-assist-v513';
    style.textContent = `
      .food{box-shadow:0 0 0 7px rgba(255,255,255,.18),0 19px 54px rgba(0,0,0,.25)!important}
      .food.selected{box-shadow:0 0 0 13px rgba(67,207,123,.34),0 25px 70px rgba(0,0,0,.3)!important;filter:brightness(1.1) saturate(1.15)!important}
      .hand{width:66px!important;height:66px!important;margin:-33px 0 0 -33px!important;box-shadow:0 0 0 12px rgba(101,201,255,.18),0 10px 30px rgba(0,0,0,.25)!important}
      .hand.pinch{box-shadow:0 0 0 14px rgba(67,207,123,.24),0 10px 30px rgba(0,0,0,.25)!important}
      .bin{min-height:72px!important;border-width:2px!important}
      .bin.hover{transform:translateY(-7px) scale(1.05)!important;outline:4px solid rgba(67,207,123,.9)!important;box-shadow:0 0 0 8px rgba(67,207,123,.2),0 15px 46px rgba(0,0,0,.18)!important}
      @media(max-width:520px){.food{width:92px!important;height:92px!important}.food .emoji{font-size:43px!important}.bin{min-height:67px!important}}
    `;
    document.head.appendChild(style);

    const foodLayer = document.getElementById('foodLayer');
    const feedback = document.getElementById('feedback');
    if (foodLayer && feedback) {
      new MutationObserver(() => {
        if (foodLayer.querySelector('.food.selected')) {
          feedback.textContent = '✅ หยิบติดแล้ว • เลื่อนลงเหนือหมู่ที่เลือก แล้วกางนิ้ว';
        }
      }).observe(foodLayer, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  }

  function applyStudentUi() {
    if (!passportMode()) return;
    const controls = document.querySelector('.footer .controls');
    if (controls) controls.style.display = 'none';
    ['qaBtn', 'zoneBtn', 'menuBtn', 'menuZoneBtn', 'arOnlyZone'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.style.display = 'none';
    });
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
      setTimeout(() => location.replace(fallbackPassportUrl().href), 1800);
    };
    new MutationObserver(check).observe(summary, { attributes: true, childList: true, subtree: true });
    setInterval(check, 500);
  }

  function installPassportReturnButton() {
    const summary = document.getElementById('summary');
    const actions = document.getElementById('summaryActions') || summary?.querySelector('.sheetActions');
    if (!summary || !actions) return;

    let button = document.getElementById('passportSafetyReturn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'passportSafetyReturn';
      button.type = 'button';
      button.className = 'big alt';
      button.textContent = '← กลับ Hero Passport';
      actions.appendChild(button);
    }

    button.onclick = () => {
      button.disabled = true;
      button.textContent = 'กำลังกลับ Hero Passport…';
      try {
        const shellBack = window.top.document.getElementById('back');
        if (window.parent !== window && shellBack) {
          shellBack.click();
          return;
        }
      } catch (_) {}
      try { window.top.location.replace(fallbackPassportUrl().href); }
      catch (_) { location.replace(fallbackPassportUrl().href); }
    };

    const show = () => {
      if (!summaryVisible(summary)) return;
      actions.hidden = false;
      actions.style.display = 'flex';
      button.hidden = false;
    };
    new MutationObserver(show).observe(summary, { attributes: true, childList: true, subtree: true });
    setInterval(show, 500);
  }

  function renderLoadError() {
    document.body.innerHTML = '<main style="min-height:100dvh;padding:28px;font-family:system-ui;background:#103c3a;color:white"><h1>เปิดเกมไม่สำเร็จ</h1><p>ไฟล์เกมโหลดไม่ครบ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่</p><button onclick="location.reload()" style="min-height:48px;padding:10px 16px;border:0;border-radius:14px;font:inherit;font-weight:900">ลองใหม่</button></main>';
  }

  installStableAssist();
  applyStudentUi();

  const script = document.createElement('script');
  script.src = './vr-groups/groups-ar-runtime-v311.js?v=20260730-stable-no-freeze-v513';
  script.async = false;
  script.dataset.groupsRuntimeLoader = PATCH;
  script.onload = () => {
    installStandaloneReturn();
    installPassportReturnButton();
    applyStudentUi();
    window.dispatchEvent(new CustomEvent('groups-runtime-ready', {
      detail: { patch: PATCH, mode: 'hand-ar-only', interactionAssist: ASSIST }
    }));
    console.info('[Groups AR Runtime]', PATCH, ASSIST);
  };
  script.onerror = renderLoadError;
  document.head.appendChild(script);
})();
