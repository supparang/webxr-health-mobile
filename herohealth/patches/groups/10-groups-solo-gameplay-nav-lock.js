/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260522-groups-solo-gameplay-nav-lock-10
   File: /herohealth/patches/groups/10-groups-solo-gameplay-nav-lock.js

   Purpose:
   - Hide old navigation dock during gameplay
   - Stop "โหมดเกม / Nutrition Zone / HUB" from floating in the middle
   - Add small safe floating nav buttons instead
   - Preserve correct links:
     mode -> /herohealth/groups-vr.html
     zone -> /herohealth/nutrition-zone.html
     hub  -> /herohealth/hub.html
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260522-groups-solo-gameplay-nav-lock-10';

  if (window.__HHA_GROUPS_SOLO_GAMEPLAY_NAV_LOCK_10__) return;
  window.__HHA_GROUPS_SOLO_GAMEPLAY_NAV_LOCK_10__ = true;

  const qs = new URLSearchParams(location.search);

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
    lastMode: '',
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

  function isIntroVisible(){
    const t = pageText();

    if (isSummaryVisible()) return false;

    return (
      t.includes('Groups Solo Arena') ||
      t.includes('Groups Practice Arena') ||
      t.includes('แตะหรือ') ||
      t.includes('เริ่มเล่น')
    );
  }

  function isSummaryVisible(){
    const t = pageText();

    return (
      t.includes('สรุปผลการเล่น') ||
      t.includes('สรุปผลการฝึก') ||
      t.includes('Food Hero') ||
      t.includes('Practice Hero') ||
      t.includes('เล่นอีกครั้ง') ||
      t.includes('Best Score') ||
      t.includes('กลับ Nutrition Zone') && t.includes('คะแนน')
    );
  }

  function isGameplayActive(){
    if (isIntroVisible()) return false;
    if (isSummaryVisible()) return false;

    const t = pageText();

    const hasHud =
      t.includes('คะแนน') ||
      t.includes('เวลา') ||
      t.includes('หัวใจ') ||
      t.includes('คอมโบ') ||
      t.includes('ถูกต้อง') ||
      t.includes('เลือก') && t.includes('ส่งเข้า');

    const hasGameObjects = !!document.querySelector(
      '[data-food],[data-target],[data-group],[data-gate],.food,.food-card,.foodItem,.target,.orb,.item,.gate,.group,.bucket,.answer,.choice'
    );

    const startIntent =
      document.body.classList.contains('hha-groups-started') ||
      document.body.classList.contains('hha-groups-gameplay-active') ||
      sessionStorage.getItem('HHA_GROUPS_SOLO_START_INTENT');

    return !!(hasHud || hasGameObjects || startIntent);
  }

  function addStyle(){
    if (document.getElementById('hha-groups-gameplay-nav-lock-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-gameplay-nav-lock-style';
    style.textContent = `
      body.hha-groups-gameplay-nav-locked .hha-old-nav-dock-hidden{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      .hha-safe-game-nav{
        position:fixed;
        right:12px;
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        z-index:999999;
        display:flex;
        gap:8px;
        align-items:center;
        justify-content:flex-end;
        flex-wrap:wrap;
        max-width:min(94vw, 520px);
        pointer-events:auto;
      }

      .hha-safe-game-nav a{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:5px;
        min-height:34px;
        padding:7px 10px;
        border-radius:999px;
        border:2px solid rgba(214,237,247,.95);
        background:rgba(255,255,255,.86);
        color:#214f64;
        box-shadow:0 10px 22px rgba(37,89,121,.14);
        font:950 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        text-decoration:none;
        white-space:nowrap;
        backdrop-filter:blur(12px);
      }

      .hha-safe-game-nav a.zone{
        background:rgba(239,255,234,.90);
        border-color:rgba(126,217,87,.55);
        color:#2f7a31;
      }

      .hha-safe-game-nav a.mode{
        background:rgba(238,248,255,.90);
        border-color:rgba(97,187,255,.55);
      }

      .hha-safe-game-nav a.hub{
        background:rgba(255,248,223,.90);
        border-color:rgba(255,217,102,.7);
        color:#7b5b10;
      }

      body.hha-groups-summary-mode .hha-safe-game-nav,
      body.hha-groups-intro-lock .hha-safe-game-nav{
        display:none !important;
      }

      @media (max-width:760px){
        .hha-safe-game-nav{
          right:8px;
          bottom:calc(8px + env(safe-area-inset-bottom,0px));
          gap:6px;
        }

        .hha-safe-game-nav a{
          min-height:30px;
          padding:6px 8px;
          font-size:10px;
          opacity:.76;
        }
      }

      body.hha-practice-view-cvr .hha-safe-game-nav,
      body.hha-view-cvr .hha-safe-game-nav{
        transform:scale(.86);
        transform-origin:bottom right;
        opacity:.70;
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
      t.includes('กลับ Hub')
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

    const t = textOf(el);

    return isNavText(t) || isNavHref(el);
  }

  function scoreNavDock(el){
    const t = textOf(el);
    let score = 0;

    if (t.includes('โหมดเกม')) score += 3;
    if (t.includes('Nutrition Zone')) score += 3;
    if (t.includes('HUB')) score += 2;
    if (t.includes('กลับ Nutrition')) score += 2;

    const links = el.querySelectorAll ? el.querySelectorAll('a,button,[role="button"],.btn').length : 0;
    score += Math.min(links, 5);

    const r = el.getBoundingClientRect();
    if (r.width > 250 && r.height < 180) score += 2;
    if (r.top > window.innerHeight * 0.25 && r.top < window.innerHeight * 0.85) score += 2;

    return score;
  }

  function findOldNavDocks(){
    const nodes = Array.from(document.querySelectorAll('a,button,[role="button"],.btn,div,section,nav'));

    const directNavs = nodes.filter(isNavElement);

    const parents = new Set();

    directNavs.forEach(function(el){
      let cur = el;

      for (let depth = 0; depth < 4 && cur && cur !== document.body; depth++) {
        const txt = textOf(cur);

        if (
          isNavText(txt) ||
          txt.includes('โหมดเกม') && txt.includes('Nutrition Zone') ||
          txt.includes('Nutrition Zone') && txt.includes('HUB')
        ) {
          parents.add(cur);
        }

        cur = cur.parentElement;
      }
    });

    return Array.from(parents)
      .map(function(el){
        return {
          el: el,
          score: scoreNavDock(el)
        };
      })
      .filter(function(x){
        if (!x.el || x.el === document.body) return false;

        const r = x.el.getBoundingClientRect();

        if (r.width < 40 || r.height < 20) return false;

        return x.score >= 3;
      })
      .sort(function(a,b){
        return b.score - a.score;
      })
      .map(function(x){
        return x.el;
      });
  }

  function hideOldNavDocks(){
    if (!isGameplayActive()) return;

    document.body.classList.add('hha-groups-gameplay-nav-locked');

    const docks = findOldNavDocks();

    docks.forEach(function(el){
      if (el.classList.contains('hha-safe-game-nav')) return;
      if (el.closest && el.closest('.hha-safe-game-nav')) return;

      el.classList.add('hha-old-nav-dock-hidden');
      el.setAttribute('data-hha-old-nav-hidden', PATCH_ID);
      state.hiddenCount += 1;
    });
  }

  function restoreOldNavOnSummaryOrIntro(){
    if (isGameplayActive()) return;

    document.body.classList.remove('hha-groups-gameplay-nav-locked');

    document.querySelectorAll('.hha-old-nav-dock-hidden').forEach(function(el){
      el.classList.remove('hha-old-nav-dock-hidden');
      el.removeAttribute('data-hha-old-nav-hidden');
    });

    const safe = document.querySelector('.hha-safe-game-nav');
    if (safe && !isGameplayActive()) {
      safe.style.display = 'none';
    }
  }

  function ensureSafeNav(){
    if (!isGameplayActive()) return;

    let nav = document.querySelector('.hha-safe-game-nav');

    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'hha-safe-game-nav';
      nav.innerHTML = `
        <a class="mode" data-safe-nav="mode" href="#">🎮 โหมด</a>
        <a class="zone" data-safe-nav="zone" href="#">🍎 Zone</a>
        <a class="hub" data-safe-nav="hub" href="#">🏠 HUB</a>
      `;
      document.body.appendChild(nav);
    }

    nav.style.display = 'flex';

    const mode = nav.querySelector('[data-safe-nav="mode"]');
    const zone = nav.querySelector('[data-safe-nav="zone"]');
    const hub = nav.querySelector('[data-safe-nav="hub"]');

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
      state.lastMode = 'gameplay';
      hideOldNavDocks();
      ensureSafeNav();
    } else {
      state.lastMode = isSummaryVisible() ? 'summary' : isIntroVisible() ? 'intro' : 'unknown';
      restoreOldNavOnSummaryOrIntro();
    }
  }

  function boot(){
    addStyle();

    scan();

    setTimeout(scan, 250);
    setTimeout(scan, 800);
    setTimeout(scan, 1600);
    setTimeout(scan, 3000);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_NAV_LOCK_SCAN_TIMER__);
      window.__HHA_GROUPS_NAV_LOCK_SCAN_TIMER__ = setTimeout(scan, 90);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['href','class','style','aria-label','role']
    });

    window.addEventListener('resize', function(){
      setTimeout(scan, 120);
    }, { passive:true });

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      view: state.view,
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
