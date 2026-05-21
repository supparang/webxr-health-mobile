/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260520-groups-solo-3view-stabilizer-01
   File: /herohealth/patches/groups/01-groups-solo-3view-stabilizer.js
   Purpose:
   - Stabilize Solo for PC / Mobile / Cardboard VR
   - Compact mobile targets
   - Enable cVR crosshair shooting fallback
   - Fix back links to Nutrition Zone / Groups Launcher
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260520-groups-solo-3view-stabilizer-01';
  if (window.__HHA_GROUPS_SOLO_3VIEW_STABILIZER__) return;
  window.__HHA_GROUPS_SOLO_3VIEW_STABILIZER__ = true;

  const qs = new URLSearchParams(location.search);

  const BASE = 'https://supparang.github.io/webxr-health-mobile';
  const HERO = BASE + '/herohealth';
  const DEFAULT_ZONE = HERO + '/nutrition-zone.html';
  const DEFAULT_LAUNCHER = HERO + '/groups-vr.html';

  const rawView = String(
    qs.get('view') ||
    qs.get('modeView') ||
    qs.get('device') ||
    ''
  ).toLowerCase();

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function normalizeView(){
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(rawView)) return 'cvr';
    if (['mobile','phone','touch'].includes(rawView)) return 'mobile';
    if (['pc','desktop'].includes(rawView)) return 'pc';
    return isMobileUA() ? 'mobile' : 'pc';
  }

  const VIEW = normalizeView();
  const MODE = String(qs.get('mode') || 'solo').toLowerCase();

  document.documentElement.classList.add('hha-groups-solo-stable');
  document.documentElement.classList.add('hha-view-' + VIEW);
  document.body.classList.add('hha-groups-solo-stable');
  document.body.classList.add('hha-view-' + VIEW);

  document.documentElement.dataset.hhaView = VIEW;
  document.body.dataset.hhaView = VIEW;
  document.body.dataset.hhaMode = MODE;

  function addStyle(css){
    const el = document.createElement('style');
    el.id = 'hha-groups-solo-3view-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  addStyle(`
    html.hha-groups-solo-stable,
    body.hha-groups-solo-stable{
      width:100%;
      min-height:100%;
      overflow-x:hidden !important;
      touch-action:manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    body.hha-groups-solo-stable{
      --hha-target-scale: 1;
      --hha-hud-scale: 1;
      --hha-safe-top: env(safe-area-inset-top, 0px);
      --hha-safe-bottom: env(safe-area-inset-bottom, 0px);
    }

    body.hha-view-mobile{
      --hha-target-scale: .74;
      --hha-hud-scale: .86;
    }

    body.hha-view-cvr{
      --hha-target-scale: .58;
      --hha-hud-scale: .74;
      cursor:none;
    }

    body.hha-view-mobile .target,
    body.hha-view-mobile .food,
    body.hha-view-mobile .food-card,
    body.hha-view-mobile .foodItem,
    body.hha-view-mobile .item,
    body.hha-view-mobile .orb,
    body.hha-view-mobile [data-food],
    body.hha-view-mobile [data-target],
    body.hha-view-mobile [data-group],
    body.hha-view-mobile .gate,
    body.hha-view-mobile .choice{
      max-width: clamp(52px, 17vw, 92px) !important;
      max-height: clamp(52px, 17vw, 92px) !important;
      font-size: clamp(20px, 6vw, 34px) !important;
    }

    body.hha-view-cvr .target,
    body.hha-view-cvr .food,
    body.hha-view-cvr .food-card,
    body.hha-view-cvr .foodItem,
    body.hha-view-cvr .item,
    body.hha-view-cvr .orb,
    body.hha-view-cvr [data-food],
    body.hha-view-cvr [data-target],
    body.hha-view-cvr [data-group],
    body.hha-view-cvr .gate,
    body.hha-view-cvr .choice{
      max-width: clamp(42px, 11vw, 70px) !important;
      max-height: clamp(42px, 11vw, 70px) !important;
      font-size: clamp(18px, 4.8vw, 28px) !important;
    }

    body.hha-view-mobile .hud,
    body.hha-view-mobile #hud,
    body.hha-view-mobile .topbar,
    body.hha-view-mobile .scorebar,
    body.hha-view-mobile .statusbar,
    body.hha-view-mobile .gameHud,
    body.hha-view-mobile .panel{
      transform-origin: top center;
      font-size: clamp(11px, 2.7vw, 14px) !important;
    }

    body.hha-view-cvr .hud,
    body.hha-view-cvr #hud,
    body.hha-view-cvr .topbar,
    body.hha-view-cvr .scorebar,
    body.hha-view-cvr .statusbar,
    body.hha-view-cvr .gameHud,
    body.hha-view-cvr .panel{
      font-size: clamp(10px, 2.2vw, 13px) !important;
      opacity:.92;
    }

    body.hha-view-mobile button,
    body.hha-view-mobile .btn,
    body.hha-view-mobile a.button{
      min-height: 38px;
      border-radius: 16px;
    }

    body.hha-view-cvr button,
    body.hha-view-cvr .btn,
    body.hha-view-cvr a.button{
      min-height: 34px;
      border-radius: 14px;
    }

    body.hha-view-mobile .modal,
    body.hha-view-mobile .dialog,
    body.hha-view-mobile .summary,
    body.hha-view-mobile .overlay-card{
      max-width: min(94vw, 680px) !important;
      max-height: min(86vh, 720px) !important;
      overflow:auto !important;
    }

    body.hha-view-cvr .modal,
    body.hha-view-cvr .dialog,
    body.hha-view-cvr .summary,
    body.hha-view-cvr .overlay-card{
      max-width: min(88vw, 640px) !important;
      max-height: min(76vh, 620px) !important;
      overflow:auto !important;
    }

    body.hha-view-cvr .hha-cvr-crosshair{
      position: fixed;
      left: 50%;
      top: 50%;
      width: 34px;
      height: 34px;
      transform: translate(-50%, -50%);
      z-index: 999999;
      pointer-events: none;
      border: 3px solid rgba(255,255,255,.95);
      border-radius: 999px;
      box-shadow:
        0 0 0 2px rgba(25,48,74,.45),
        0 0 20px rgba(255,220,90,.65);
    }

    body.hha-view-cvr .hha-cvr-crosshair::before,
    body.hha-view-cvr .hha-cvr-crosshair::after{
      content:"";
      position:absolute;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      background:rgba(255,255,255,.95);
      border-radius:99px;
    }

    body.hha-view-cvr .hha-cvr-crosshair::before{
      width:4px;
      height:22px;
    }

    body.hha-view-cvr .hha-cvr-crosshair::after{
      width:22px;
      height:4px;
    }

    .hha-solo-view-pill{
      position:fixed;
      right:10px;
      bottom:calc(10px + var(--hha-safe-bottom));
      z-index:999998;
      padding:7px 10px;
      border-radius:999px;
      background:rgba(255,255,255,.88);
      color:#15304a;
      border:1px solid rgba(30,60,90,.18);
      box-shadow:0 8px 22px rgba(0,0,0,.12);
      font:700 11px/1.1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      pointer-events:none;
    }

    body.hha-view-cvr .hha-solo-view-pill{
      left:10px;
      right:auto;
      bottom:calc(10px + var(--hha-safe-bottom));
      opacity:.7;
    }
  `);

  function buildUrl(base, extra){
    const out = new URL(base, location.href);
    const keep = [
      'pid','name','diff','time','view','seed',
      'studyId','phase','conditionGroup','run',
      'zone','cat','game','gameId','mode','theme',
      'api','log'
    ];

    keep.forEach(k => {
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    Object.entries(extra || {}).forEach(([k,v]) => {
      if (v === null || v === undefined) out.searchParams.delete(k);
      else out.searchParams.set(k, String(v));
    });

    return out.toString();
  }

  function zoneUrl(){
    const hub = qs.get('hub');
    const explicitZone = qs.get('zoneUrl') || qs.get('backZone');

    if (explicitZone && /^https?:\/\//.test(explicitZone)) {
      return explicitZone;
    }

    if (hub && hub.includes('/nutrition-zone.html')) {
      return hub;
    }

    return buildUrl(DEFAULT_ZONE, {
      zone:'nutrition',
      cat:'nutrition',
      game:'groups',
      gameId:'groups',
      mode:'solo',
      run:null
    });
  }

  function launcherUrl(){
    return buildUrl(DEFAULT_LAUNCHER, {
      zone:'nutrition',
      cat:'nutrition',
      game:'groups',
      gameId:'groups',
      mode:null,
      run:null
    });
  }

  function patchBackButtons(){
    const zone = zoneUrl();
    const launcher = launcherUrl();

    const candidates = Array.from(document.querySelectorAll('a,button,[role="button"]'));

    candidates.forEach(el => {
      const text = String(el.textContent || el.getAttribute('aria-label') || '').trim().toLowerCase();
      const href = el.getAttribute && el.getAttribute('href') || '';

      const looksZone =
        text.includes('zone') ||
        text.includes('โซน') ||
        text.includes('nutrition') ||
        href.includes('nutrition-zone');

      const looksLauncher =
        text.includes('launcher') ||
        text.includes('โหมด') ||
        text.includes('mode') ||
        text.includes('เลือกเกม') ||
        href.includes('groups-vr') ||
        href.includes('groups-launcher');

      if (looksZone) {
        if (el.tagName === 'A') el.href = zone;
        else {
          el.onclick = function(ev){
            ev.preventDefault();
            location.href = zone;
          };
        }
      }

      if (looksLauncher) {
        if (el.tagName === 'A') el.href = launcher;
        else {
          el.onclick = function(ev){
            ev.preventDefault();
            location.href = launcher;
          };
        }
      }
    });
  }

  function ensureViewPill(){
    if (document.querySelector('.hha-solo-view-pill')) return;
    const pill = document.createElement('div');
    pill.className = 'hha-solo-view-pill';
    pill.textContent = 'Groups Solo • ' + VIEW.toUpperCase() + ' • ' + PATCH_ID.replace('v20260520-groups-solo-','');
    document.body.appendChild(pill);
  }

  function ensureCvrCrosshair(){
    if (VIEW !== 'cvr') return;
    if (document.querySelector('.hha-cvr-crosshair')) return;

    const cross = document.createElement('div');
    cross.className = 'hha-cvr-crosshair';
    document.body.appendChild(cross);
  }

  function loadVrUiIfNeeded(){
    if (VIEW !== 'cvr') return;
    if (window.__HHA_VR_UI_LOADING__ || window.__HHA_VR_UI_LOADED__) return;

    const existing = Array.from(document.scripts).some(s => String(s.src || '').includes('/herohealth/vr/vr-ui.js'));
    if (existing) {
      window.__HHA_VR_UI_LOADED__ = true;
      return;
    }

    window.__HHA_VR_UI_LOADING__ = true;
    const s = document.createElement('script');
    s.src = HERO + '/vr/vr-ui.js?v=20260520-groups-solo';
    s.async = true;
    s.onload = () => {
      window.__HHA_VR_UI_LOADED__ = true;
      window.__HHA_VR_UI_LOADING__ = false;
    };
    s.onerror = () => {
      window.__HHA_VR_UI_LOADING__ = false;
      console.warn('[Groups Solo] vr-ui.js not loaded; fallback cVR shoot still active.');
    };
    document.head.appendChild(s);
  }

  function getShootableElements(){
    const selectors = [
      '[data-food]',
      '[data-target]',
      '[data-group]',
      '[data-choice]',
      '.target',
      '.food',
      '.food-card',
      '.foodItem',
      '.item',
      '.orb',
      '.gate',
      '.choice',
      '.answer',
      'button'
    ];

    return Array.from(document.querySelectorAll(selectors.join(',')))
      .filter(el => {
        if (!el || !el.getBoundingClientRect) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 12 || r.height < 12) return false;
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) <= 0.05) return false;
        if (el.disabled) return false;
        return true;
      });
  }

  function centerDistance(rect){
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = cx - innerWidth / 2;
    const dy = cy - innerHeight / 2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function findBestCenterTarget(){
    const maxRadius = VIEW === 'cvr'
      ? Math.max(52, Math.min(innerWidth, innerHeight) * 0.22)
      : Math.max(70, Math.min(innerWidth, innerHeight) * 0.28);

    let best = null;
    let bestScore = Infinity;

    getShootableElements().forEach(el => {
      const r = el.getBoundingClientRect();
      const d = centerDistance(r);

      const inCenter =
        innerWidth / 2 >= r.left - 16 &&
        innerWidth / 2 <= r.right + 16 &&
        innerHeight / 2 >= r.top - 16 &&
        innerHeight / 2 <= r.bottom + 16;

      const score = inCenter ? d * 0.35 : d;

      if (score < bestScore && d <= maxRadius) {
        best = el;
        bestScore = score;
      }
    });

    return best;
  }

  function safeClick(el){
    if (!el) return false;

    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;

    try {
      ['pointerdown','mousedown','mouseup','click'].forEach(type => {
        el.dispatchEvent(new MouseEvent(type, {
          bubbles:true,
          cancelable:true,
          clientX:x,
          clientY:y,
          view:window
        }));
      });
      return true;
    } catch(e) {
      try {
        el.click();
        return true;
      } catch(err) {
        return false;
      }
    }
  }

  function flashTarget(el){
    if (!el) return;
    const old = el.style.filter;
    el.style.filter = 'drop-shadow(0 0 18px rgba(255,217,90,.95)) brightness(1.12)';
    setTimeout(() => {
      el.style.filter = old;
    }, 130);
  }

  function bindCvrShootFallback(){
    if (VIEW !== 'cvr') return;
    if (window.__HHA_GROUPS_CVR_SHOOT_FALLBACK__) return;
    window.__HHA_GROUPS_CVR_SHOOT_FALLBACK__ = true;

    function shoot(){
      const target = findBestCenterTarget();
      if (target) {
        flashTarget(target);
        safeClick(target);
        return true;
      }
      return false;
    }

    window.addEventListener('hha:shoot', function(ev){
      const ok = shoot();
      if (!ok) {
        window.dispatchEvent(new CustomEvent('hha:toast', {
          detail:{
            type:'warn',
            message:'เล็งให้ตรงอาหารหรือประตูหมู่ก่อนยิงนะ'
          }
        }));
      }
    }, true);

    document.addEventListener('keydown', function(ev){
      if (ev.code === 'Space' || ev.key === 'Enter') {
        shoot();
      }
    }, true);

    document.addEventListener('click', function(ev){
      const tag = String(ev.target && ev.target.tagName || '').toLowerCase();
      if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select') return;

      const now = Date.now();
      if (window.__HHA_GROUPS_LAST_CVR_TAP__ && now - window.__HHA_GROUPS_LAST_CVR_TAP__ < 220) return;
      window.__HHA_GROUPS_LAST_CVR_TAP__ = now;

      shoot();
    }, true);
  }

  function installToastFallback(){
    if (window.__HHA_GROUPS_TOAST_FALLBACK__) return;
    window.__HHA_GROUPS_TOAST_FALLBACK__ = true;

    const css = document.createElement('style');
    css.textContent = `
      .hha-toast-fallback{
        position:fixed;
        left:50%;
        bottom:calc(58px + env(safe-area-inset-bottom, 0px));
        transform:translateX(-50%);
        z-index:999999;
        max-width:min(92vw,520px);
        padding:10px 14px;
        border-radius:18px;
        background:rgba(21,48,74,.92);
        color:#fff;
        box-shadow:0 14px 30px rgba(0,0,0,.22);
        font:800 13px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        text-align:center;
        opacity:0;
        pointer-events:none;
        transition:.18s ease;
      }
      .hha-toast-fallback.show{
        opacity:1;
        transform:translateX(-50%) translateY(-4px);
      }
    `;
    document.head.appendChild(css);

    const box = document.createElement('div');
    box.className = 'hha-toast-fallback';
    document.body.appendChild(box);

    let timer = null;

    window.addEventListener('hha:toast', function(ev){
      const msg =
        ev.detail && (ev.detail.message || ev.detail.text) ||
        ev.message ||
        '';

      if (!msg) return;

      box.textContent = msg;
      box.classList.add('show');

      clearTimeout(timer);
      timer = setTimeout(() => {
        box.classList.remove('show');
      }, 1700);
    });
  }

  function announceReady(){
    console.info('[HeroHealth Groups Solo]', PATCH_ID, {
      view: VIEW,
      mode: MODE,
      zone: zoneUrl(),
      launcher: launcherUrl()
    });

    window.dispatchEvent(new CustomEvent('hha:toast', {
      detail:{
        type:'ok',
        message:'Groups Solo พร้อมโหมด ' + VIEW.toUpperCase()
      }
    }));
  }

  function boot(){
    installToastFallback();
    patchBackButtons();
    ensureViewPill();
    ensureCvrCrosshair();
    loadVrUiIfNeeded();
    bindCvrShootFallback();

    setTimeout(patchBackButtons, 500);
    setTimeout(patchBackButtons, 1500);
    setTimeout(announceReady, 350);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }

})();
