/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260522-groups-solo-mode-link-fix-09
   File: /herohealth/patches/groups/09-groups-solo-mode-link-fix.js

   Purpose:
   - Fix "โหมดเกม" / mode button going to old group-v1.html
   - Force all Groups mode links to /herohealth/groups-vr.html
   - Preserve pid/name/diff/time/view/hub/back/return/qa/debug
   - Works during intro / gameplay / summary
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260522-groups-solo-mode-link-fix-09';

  if (window.__HHA_GROUPS_SOLO_MODE_LINK_FIX_09__) return;
  window.__HHA_GROUPS_SOLO_MODE_LINK_FIX_09__ = true;

  const qs = new URLSearchParams(location.search);

  function repoBase(){
    const path = location.pathname;
    const marker = '/herohealth/';
    const idx = path.indexOf(marker);

    if (idx >= 0) {
      return location.origin + path.slice(0, idx);
    }

    return location.origin + '/webxr-health-mobile';
  }

  const BASE = repoBase();
  const HERO = BASE + '/herohealth';

  const GROUPS_LAUNCHER = HERO + '/groups-vr.html';
  const NUTRITION_ZONE = HERO + '/nutrition-zone.html';

  window.HHA_GROUPS_SOLO_MODE_LINK_FIX = {
    patch: PATCH_ID,
    launcher: GROUPS_LAUNCHER,
    zone: NUTRITION_ZONE,
    buildLauncherUrl: buildLauncherUrl
  };

  function getParam(name, fallback){
    const v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function normalizeView(v){
    const raw = String(v || '').toLowerCase();

    if (['pc','desktop','notebook','laptop'].includes(raw)) return 'pc';
    if (['mobile','phone','touch','tablet'].includes(raw)) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(raw)) return 'cvr';

    if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '')) {
      return 'mobile';
    }

    return 'pc';
  }

  function buildLauncherUrl(extra){
    const out = new URL(GROUPS_LAUNCHER);

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
    out.searchParams.set('view', normalizeView(getParam('view', 'pc')));

    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'groups');
    out.searchParams.set('gameId', 'groups');
    out.searchParams.set('from', 'groups-solo');
    out.searchParams.set('mode', getParam('mode', 'solo'));
    out.searchParams.set('variant', getParam('variant', 'arena'));

    out.searchParams.set('hub', getParam('hub', NUTRITION_ZONE));
    out.searchParams.set('back', getParam('back', NUTRITION_ZONE));
    out.searchParams.set('return', getParam('return', NUTRITION_ZONE));
    out.searchParams.set('returnTo', getParam('returnTo', NUTRITION_ZONE));

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

  function isModeButton(el){
    if (!el) return false;

    const text = textOf(el);
    const href = String(el.getAttribute && el.getAttribute('href') || '');

    return (
      text.includes('โหมดเกม') ||
      text.includes('เลือกโหมด') ||
      text.includes('Mode') ||
      text.includes('Game Mode') ||
      href.includes('/group-v1.html') ||
      href.includes('/groups-vr.html')
    );
  }

  function addStyle(){
    if (document.getElementById('hha-groups-mode-link-fix-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-mode-link-fix-style';
    style.textContent = `
      .hha-groups-mode-link-fixed{
        position:relative !important;
      }

      .hha-groups-mode-link-fixed::after{
        content:"";
        position:absolute;
        inset:-4px;
        border-radius:inherit;
        pointer-events:none;
        box-shadow:0 0 0 3px rgba(97,187,255,.18);
      }

      .hha-groups-mode-link-toast{
        position:fixed;
        left:50%;
        bottom:calc(18px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%) translateY(14px);
        z-index:1000001;
        width:min(92vw,560px);
        padding:12px 16px;
        border-radius:20px;
        background:rgba(21,48,74,.94);
        color:white;
        text-align:center;
        font:900 14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 18px 42px rgba(0,0,0,.24);
        opacity:0;
        pointer-events:none;
        transition:.18s ease;
      }

      .hha-groups-mode-link-toast.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }
    `;

    document.head.appendChild(style);
  }

  let toastBox = null;
  let toastTimer = null;

  function toast(message){
    addStyle();

    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'hha-groups-mode-link-toast';
      document.body.appendChild(toastBox);
    }

    toastBox.textContent = String(message || '');
    toastBox.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){
      toastBox.classList.remove('show');
    }, 1300);
  }

  function patchModeLinks(){
    const target = buildLauncherUrl();

    Array.from(document.querySelectorAll('a,button,[role="button"],.btn,div,span'))
      .forEach(function(el){
        if (!isModeButton(el)) return;

        el.classList.add('hha-groups-mode-link-fixed');
        el.setAttribute('data-hha-mode-target', target);

        if (el.tagName === 'A') {
          el.href = target;
        }

        if (!el.__hhaGroupsModeLinkFixed) {
          el.__hhaGroupsModeLinkFixed = true;

          el.addEventListener('click', function(ev){
            ev.preventDefault();
            ev.stopPropagation();

            if (typeof ev.stopImmediatePropagation === 'function') {
              ev.stopImmediatePropagation();
            }

            toast('กลับหน้าโหมดเกม Groups');

            setTimeout(function(){
              location.href = buildLauncherUrl({
                t: Date.now()
              });
            }, 80);

            return false;
          }, true);
        }
      });
  }

  function hardBlockOldGroupV1Links(){
    Array.from(document.querySelectorAll('a[href*="group-v1.html"]'))
      .forEach(function(a){
        a.href = buildLauncherUrl();
        a.setAttribute('data-old-group-v1-fixed', PATCH_ID);
      });
  }

  function bindGlobalGuard(){
    if (document.__hhaGroupsModeLinkGlobalGuard) return;
    document.__hhaGroupsModeLinkGlobalGuard = true;

    document.addEventListener('click', function(ev){
      const path = ev.composedPath ? ev.composedPath() : [];
      const hit = path.find(function(x){
        return x && x.nodeType === 1 && isModeButton(x);
      });

      if (!hit) return;

      ev.preventDefault();
      ev.stopPropagation();

      if (typeof ev.stopImmediatePropagation === 'function') {
        ev.stopImmediatePropagation();
      }

      location.href = buildLauncherUrl({
        t: Date.now()
      });

      return false;
    }, true);
  }

  function scan(){
    patchModeLinks();
    hardBlockOldGroupV1Links();
  }

  function boot(){
    addStyle();
    bindGlobalGuard();

    scan();

    setTimeout(scan, 250);
    setTimeout(scan, 800);
    setTimeout(scan, 1600);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_MODE_LINK_FIX_SCAN_TIMER__);
      window.__HHA_GROUPS_MODE_LINK_FIX_SCAN_TIMER__ = setTimeout(scan, 120);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['href','class','style','aria-label','value']
    });

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      launcher: GROUPS_LAUNCHER,
      target: buildLauncherUrl()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
