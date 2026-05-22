/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260522-groups-solo-gameplay-nav-lock-10c
   File: /herohealth/patches/groups/10-groups-solo-gameplay-nav-lock.js

   Purpose:
   - Fix nav row still appearing during gameplay
   - Do NOT treat "Groups Solo Arena" title as intro
   - During gameplay: hide all โหมดเกม / Nutrition Zone / HUB controls
   - Summary/end screen remains normal
   - Correct mode page remains /herohealth/groups-vr.html
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260522-groups-solo-gameplay-nav-lock-10c';

  if (window.__HHA_GROUPS_SOLO_GAMEPLAY_NAV_LOCK_10C__) return;
  window.__HHA_GROUPS_SOLO_GAMEPLAY_NAV_LOCK_10C__ = true;

  const qs = new URLSearchParams(location.search);

  const ALLOW_EMERGENCY_NAV =
    qs.get('debug') === '1' ||
    qs.get('teacher') === '1' ||
    qs.get('navdebug') === '1';

  function repoBase(){
    const path = location.pathname;
    const marker = '/herohealth/';
    const idx = path.indexOf(marker);
    if (idx >= 0) return location.origin + path.slice(0, idx);
    return location.origin + '/webxr-health-mobile';
  }

  const BASE = repoBase();
  const HERO = BASE + '/herohealth';

  const URLS = {
    mode: HERO + '/groups-vr.html',
    zone: HERO + '/nutrition-zone.html',
    hub: HERO + '/hub.html'
  };

  const state = {
    patch: PATCH_ID,
    view: normalizeView(),
    hiddenCount: 0,
    screen: 'unknown',
    emergencyNav: ALLOW_EMERGENCY_NAV,
    startedAt: Date.now()
  };

  window.HHA_GROUPS_GAMEPLAY_NAV_LOCK = state;

  function getParam(name, fallback){
    const v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function normalizeView(){
    const raw = String(qs.get('view') || '').toLowerCase();

    if (['pc','desktop','notebook','laptop'].includes(raw)) return 'pc';
    if (['mobile','phone','touch','tablet'].includes(raw)) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(raw)) return 'cvr';

    if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '')) {
      return 'mobile';
    }

    return 'pc';
  }

  function buildUrl(base, extra){
    const out = new URL(base);

    [
      'pid',
      'name',
      'studentId',
      'studentName',
      'classSection',
      'diff',
      'time',
      'view',
      'studyId',
      'conditionGroup',
      'api',
      'log',
      'qa',
      'debug',
      'teacher',
      'mpcvr'
    ].forEach(function(k){
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('pid', getParam('pid', 'anon'));
    out.searchParams.set('name', getParam('name', 'Hero'));
    out.searchParams.set('diff', getParam('diff', 'normal'));
    out.searchParams.set('time', getParam('time', '90'));
    out.searchParams.set('view', normalizeView());
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'groups');
    out.searchParams.set('gameId', 'groups');

    if (base.includes('groups-vr.html')) {
      out.searchParams.set('mode', getParam('mode', 'solo'));
      out.searchParams.set('variant', getParam('variant', 'arena'));
      out.searchParams.set('from', 'groups-gameplay-nav-lock');
    }

    Object.entries(extra || {}).forEach(function(pair){
      const k = pair[0];
      const v = pair[1];

      if (v === null || v === undefined) out.searchParams.delete(k);
      else out.searchParams.set(k, String(v));
    });

    return out.toString();
  }

  function textOf(el){
    return String(el && (
      el.innerText ||
      el.textContent ||
      (el.getAttribute && el.getAttribute('aria-label')) ||
      el.value ||
      ''
    ) || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pageText(){
    return String(document.body && document.body.innerText || '');
  }

  function isSummaryVisible(){
    const t = pageText();

    return (
      t.includes('สรุปผลการเล่น') ||
      t.includes('สรุปผลการฝึก') ||
      t.includes('Food Hero') ||
      t.includes('Practice Hero') ||
      t.includes('Best Score') ||
      t.includes('Badge Collection') ||
      t.includes('เล่นอีกครั้ง') ||
      (
        t.includes('กลับ Nutrition Zone') &&
        (
          t.includes('คะแนน') ||
          t.includes('ความแม่นยำ') ||
          t.includes('ตอบถูก') ||
          t.includes('คอมโบสูงสุด')
        )
      )
    );
  }

  function hasStartButtonVisible(){
    const candidates = Array.from(document.querySelectorAll('button,a,[role="button"],.btn,div,span,input'))
      .filter(function(el){
        const t = textOf(el);
        if (!t) return false;

        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 20) return false;

        const start =
          t.includes('เริ่มเล่น') ||
          t.includes('เริ่มเกม') ||
          t.includes('Start') ||
          t.includes('Play');

        const replay =
          t.includes('เล่นอีกครั้ง') ||
          t.includes('Replay') ||
          t.includes('Play Again');

        const back =
          t.includes('กลับ') ||
          t.includes('Nutrition Zone') ||
          t.includes('HUB') ||
          t.includes('Zone');

        return start && !replay && !back;
      });

    return candidates.length > 0;
  }

  function isIntroVisible(){
    if (isSummaryVisible()) return false;

    const t = pageText();

    // สำคัญ: ห้ามใช้แค่ "Groups Solo Arena" เป็นตัวบอก intro
    // เพราะ gameplay ก็มี title นี้อยู่ด้านบน
    return (
      hasStartButtonVisible() &&
      (
        t.includes('แตะหรือ') ||
        t.includes('เริ่มเล่น') ||
        t.includes('โหมดซ้อม') ||
        t.includes('ส่งเข้าประตูหมู่ 1–5')
      )
    );
  }

  function hasStartIntent(){
    try {
      return !!sessionStorage.getItem('HHA_GROUPS_SOLO_START_INTENT');
    } catch(e) {
      return false;
    }
  }

  function isGameplayActive(){
    if (isSummaryVisible()) return false;
    if (isIntroVisible()) return false;

    const t = pageText();

    const hasHud =
      t.includes('คะแนน') ||
      t.includes('เวลา') ||
      t.includes('หัวใจ') ||
      t.includes('คอมโบ') ||
      t.includes('ถูกต้อง') ||
      (
        t.includes('เลือก') &&
        t.includes('ส่งเข้า')
      );

    const hasGameObjects = !!document.querySelector(
      '[data-food],' +
      '[data-target],' +
      '[data-group],' +
      '[data-gate],' +
      '.food,' +
      '.food-card,' +
      '.foodItem,' +
      '.target,' +
      '.orb,' +
      '.item,' +
      '.gate,' +
      '.group,' +
      '.bucket,' +
      '.answer,' +
      '.choice'
    );

    const classStarted =
      document.body.classList.contains('hha-groups-started') ||
      document.body.classList.contains('hha-groups-starting') ||
      document.body.classList.contains('hha-groups-gameplay-active') ||
      document.documentElement.classList.contains('hha-groups-gameplay-active');

    return !!(hasHud || hasGameObjects || classStarted || hasStartIntent());
  }

  function addStyle(){
    if (document.getElementById('hha-groups-gameplay-nav-lock-10c-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-gameplay-nav-lock-10c-style';
    style.textContent = `
      body.hha-groups-gameplay-nav-locked .hha-old-nav-dock-hidden,
      body.hha-groups-gameplay-nav-locked .hha-game-nav-compact,
      body.hha-groups-gameplay-nav-locked .hha-safe-game-nav,
      body.hha-groups-gameplay-nav-locked [data-hha-game-nav-compact],
      body.hha-groups-gameplay-nav-locked [data-hha-old-nav-hidden],
      body.hha-groups-gameplay-nav-locked [data-hha-bg-blocked],
      body.hha-groups-gameplay-nav-locked [data-hha-mode-target]{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      body.hha-groups-gameplay-nav-locked a[href*="group-v1.html"],
      body.hha-groups-gameplay-nav-locked a[href*="groups-vr.html"],
      body.hha-groups-gameplay-nav-locked a[href*="nutrition-zone.html"],
      body.hha-groups-gameplay-nav-locked a[href*="hub.html"]{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      .hha-emergency-game-nav{
        position:fixed;
        right:10px;
        bottom:calc(10px + env(safe-area-inset-bottom,0px));
        z-index:999999;
        display:flex;
        gap:6px;
        align-items:center;
        justify-content:flex-end;
        flex-wrap:wrap;
        opacity:.42;
      }

      .hha-emergency-game-nav:hover{
        opacity:.94;
      }

      .hha-emergency-game-nav a{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:28px;
        padding:5px 8px;
        border-radius:999px;
        border:1px solid rgba(214,237,247,.95);
        background:rgba(255,255,255,.82);
        color:#214f64;
        box-shadow:0 8px 18px rgba(37,89,121,.12);
        font:950 10px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        text-decoration:none;
        white-space:nowrap;
        backdrop-filter:blur(10px);
      }

      body.hha-groups-summary-mode .hha-emergency-game-nav,
      body.hha-groups-intro-lock .hha-emergency-game-nav{
        display:none !important;
      }
    `;

    document.head.appendChild(style);
  }

  function isNavText(t){
    return (
      t.includes('โหมดเกม') ||
      t.includes('Nutrition Zone') ||
      t.includes('กลับ Nutrition') ||
      t.includes('HUB') ||
      t.includes('กลับ HUB') ||
      t.includes('กลับ Hub') ||
      t === 'Zone' ||
      t.includes('กลับ Zone')
    );
  }

  function isNavHref(el){
    const href = String(el && el.getAttribute && el.getAttribute('href') || '');

    return (
      href.includes('/group-v1.html') ||
      href.includes('/groups-vr.html') ||
      href.includes('/nutrition-zone.html') ||
      href.includes('/hub.html')
    );
  }

  function isNavElement(el){
    if (!el) return false;

    if (el.classList && el.classList.contains('hha-emergency-game-nav')) return false;
    if (el.closest && el.closest('.hha-emergency-game-nav')) return false;

    const t = textOf(el);

    return isNavText(t) || isNavHref(el);
  }

  function shouldHideThisNavElement(el){
    if (!isNavElement(el)) return false;

    const t = textOf(el);
    const r = el.getBoundingClientRect();

    if (r.width < 20 || r.height < 16) return false;

    // ซ่อนเฉพาะ control/nav ไม่ซ่อนทั้งคำสั่งเกมยาว ๆ
    if (t.length <= 40) return true;
    if (isNavHref(el)) return true;

    return (
      t.includes('โหมดเกม') &&
      t.includes('Nutrition Zone')
    ) || (
      t.includes('Nutrition Zone') &&
      t.includes('HUB')
    );
  }

  function hideNavElements(){
    if (!isGameplayActive()) return;

    document.body.classList.add('hha-groups-gameplay-nav-locked');
    document.body.classList.add('hha-groups-gameplay-active');

    const all = Array.from(document.querySelectorAll('a,button,[role="button"],.btn,div,span,nav,section'));

    all.forEach(function(el){
      if (!shouldHideThisNavElement(el)) return;

      el.classList.add('hha-old-nav-dock-hidden');
      el.setAttribute('data-hha-old-nav-hidden', PATCH_ID);
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';

      state.hiddenCount += 1;
    });

    document.querySelectorAll('.hha-safe-game-nav,.hha-game-nav-compact,[data-hha-game-nav-compact]').forEach(function(el){
      el.classList.add('hha-old-nav-dock-hidden');
      el.setAttribute('data-hha-old-nav-hidden', PATCH_ID);
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    });
  }

  function restoreWhenNotGameplay(){
    if (isGameplayActive()) return;

    document.body.classList.remove('hha-groups-gameplay-nav-locked');
    document.body.classList.remove('hha-groups-gameplay-active');

    document.querySelectorAll('.hha-old-nav-dock-hidden').forEach(function(el){
      el.classList.remove('hha-old-nav-dock-hidden');
      el.removeAttribute('data-hha-old-nav-hidden');

      if (el.style) {
        el.style.display = '';
        el.style.visibility = '';
        el.style.opacity = '';
        el.style.pointerEvents = '';
      }
    });

    const emergency = document.querySelector('.hha-emergency-game-nav');
    if (emergency) emergency.style.display = 'none';
  }

  function ensureEmergencyNav(){
    if (!ALLOW_EMERGENCY_NAV) {
      const old = document.querySelector('.hha-emergency-game-nav');
      if (old) old.remove();
      return;
    }

    if (!isGameplayActive()) return;

    let nav = document.querySelector('.hha-emergency-game-nav');

    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'hha-emergency-game-nav';
      nav.innerHTML = `
        <a data-emergency-nav="mode" href="#">โหมด</a>
        <a data-emergency-nav="zone" href="#">Zone</a>
        <a data-emergency-nav="hub" href="#">HUB</a>
      `;
      document.body.appendChild(nav);
    }

    nav.style.display = 'flex';

    const mode = nav.querySelector('[data-emergency-nav="mode"]');
    const zone = nav.querySelector('[data-emergency-nav="zone"]');
    const hub = nav.querySelector('[data-emergency-nav="hub"]');

    if (mode) mode.href = buildUrl(URLS.mode, { t: Date.now() });
    if (zone) zone.href = buildUrl(URLS.zone, { t: Date.now() });
    if (hub) hub.href = buildUrl(URLS.hub, { t: Date.now() });
  }

  function fixOldGroupV1Href(){
    document.querySelectorAll('a[href*="group-v1.html"]').forEach(function(a){
      a.href = buildUrl(URLS.mode, { t: Date.now() });
      a.setAttribute('data-hha-group-v1-fixed', PATCH_ID);
    });
  }

  function scan(){
    addStyle();
    fixOldGroupV1Href();

    if (isGameplayActive()) {
      state.screen = 'gameplay';
      hideNavElements();
      ensureEmergencyNav();
      return;
    }

    state.screen = isSummaryVisible() ? 'summary' : isIntroVisible() ? 'intro' : 'unknown';
    restoreWhenNotGameplay();
  }

  function boot(){
    addStyle();

    scan();

    setTimeout(scan, 100);
    setTimeout(scan, 250);
    setTimeout(scan, 600);
    setTimeout(scan, 1000);
    setTimeout(scan, 1600);
    setTimeout(scan, 2600);
    setTimeout(scan, 4000);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_NAV_LOCK_10C_SCAN_TIMER__);
      window.__HHA_GROUPS_NAV_LOCK_10C_SCAN_TIMER__ = setTimeout(scan, 50);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['href','class','style','aria-label','role']
    });

    window.addEventListener('resize', function(){
      setTimeout(scan, 100);
    }, { passive:true });

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      view: state.view,
      emergencyNav: ALLOW_EMERGENCY_NAV,
      launcher: URLS.mode,
      zone: URLS.zone,
      hub: URLS.hub
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
