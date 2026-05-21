/* =========================================================
   HeroHealth Groups Solo Launcher Canonical Guard
   PATCH: v20260521-groups-solo-launcher-canonical-guard-01
   File: /herohealth/vr-groups/groups-solo-launcher-canonical-guard.js

   Purpose:
   - Force all Solo buttons/links to canonical run file
   - Canonical Solo run: /herohealth/vr-groups/groups.html
   - Preserve pid/name/diff/time/view/seed/log/api/hub
   - Prevent Solo from going to old versioned files or race pages
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260521-groups-solo-launcher-canonical-guard-01';
  if (window.__HHA_GROUPS_SOLO_LAUNCHER_CANONICAL_GUARD__) return;
  window.__HHA_GROUPS_SOLO_LAUNCHER_CANONICAL_GUARD__ = true;

  const qs = new URLSearchParams(location.search);

  const BASE = 'https://supparang.github.io/webxr-health-mobile';
  const HERO = BASE + '/herohealth';

  const CANONICAL_SOLO = HERO + '/vr-groups/groups.html';
  const NUTRITION_ZONE = HERO + '/nutrition-zone.html';

  function getParam(name, fallback){
    const v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function normalizeView(v){
    const raw = String(v || '').toLowerCase();

    if (['pc','desktop'].includes(raw)) return 'pc';
    if (['mobile','phone','touch'].includes(raw)) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(raw)) return 'cvr';

    return isMobileUA() ? 'mobile' : 'pc';
  }

  function buildSoloUrl(extra){
    const out = new URL(CANONICAL_SOLO);

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
      'log'
    ].forEach(k => {
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('pid', getParam('pid', 'anon'));
    out.searchParams.set('name', getParam('name', 'Hero'));
    out.searchParams.set('diff', getParam('diff', 'normal'));
    out.searchParams.set('time', getParam('time', '90'));
    out.searchParams.set('view', normalizeView(getParam('view', '')));
    out.searchParams.set('run', 'play');
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'groups');
    out.searchParams.set('gameId', 'groups');
    out.searchParams.set('mode', 'solo');
    out.searchParams.set('entry', 'groups-launcher');
    out.searchParams.set('theme', 'food-groups');
    out.searchParams.set('seed', String(Date.now()));
    out.searchParams.set('hub', getParam('hub', NUTRITION_ZONE));

    Object.entries(extra || {}).forEach(([k,v]) => {
      if (v === null || v === undefined) out.searchParams.delete(k);
      else out.searchParams.set(k, String(v));
    });

    return out.toString();
  }

  function buildZoneUrl(){
    const out = new URL(NUTRITION_ZONE);

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
      'hub'
    ].forEach(k => {
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'groups');

    return out.toString();
  }

  function textOf(el){
    return String(el && (el.innerText || el.textContent || el.getAttribute('aria-label') || '') || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isSoloLink(el){
    const text = textOf(el).toLowerCase();
    const href = String(el.getAttribute && el.getAttribute('href') || '').toLowerCase();

    const mentionsSolo =
      text.includes('solo') ||
      text.includes('เล่นเดี่ยว') ||
      text.includes('ฝึกเดี่ยว') ||
      text.includes('เริ่มเล่น') ||
      text.includes('play solo') ||
      text.includes('start solo');

    const mentionsGroupsRun =
      href.includes('/vr-groups/groups.html') ||
      href.includes('groups-v') ||
      href.includes('groups-solo') ||
      href.includes('mode=solo');

    const isNotRace =
      !text.includes('race') &&
      !text.includes('แข่ง') &&
      !href.includes('race');

    const isNotBattle =
      !text.includes('battle') &&
      !text.includes('duet') &&
      !text.includes('coop') &&
      !href.includes('battle') &&
      !href.includes('duet') &&
      !href.includes('coop');

    return isNotRace && isNotBattle && (mentionsSolo || mentionsGroupsRun);
  }

  function patchSoloButtons(){
    const soloUrl = buildSoloUrl();

    Array.from(document.querySelectorAll('a,button,[role="button"],.btn')).forEach(el => {
      if (!isSoloLink(el)) return;

      el.classList.add('hha-groups-solo-canonical-link');
      el.setAttribute('data-hha-solo-target', soloUrl);

      if (el.tagName === 'A') {
        el.href = soloUrl;
      }

      if (!el.__hhaGroupsSoloCanonicalBound) {
        el.__hhaGroupsSoloCanonicalBound = true;

        el.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          location.href = buildSoloUrl({
            seed: Date.now()
          });
        }, true);
      }
    });
  }

  function patchBackZoneButtons(){
    const zoneUrl = buildZoneUrl();

    Array.from(document.querySelectorAll('a,button,[role="button"],.btn')).forEach(el => {
      const text = textOf(el);
      const href = String(el.getAttribute && el.getAttribute('href') || '');

      const isZone =
        text.includes('Nutrition Zone') ||
        text.includes('กลับโซน') ||
        text.includes('กลับ Zone') ||
        href.includes('/nutrition-zone.html');

      if (!isZone) return;

      if (el.tagName === 'A') el.href = zoneUrl;

      if (!el.__hhaGroupsZoneBound) {
        el.__hhaGroupsZoneBound = true;

        el.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          location.href = zoneUrl;
        }, true);
      }
    });
  }

  function addStyle(){
    if (document.getElementById('hha-groups-solo-launcher-canonical-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-solo-launcher-canonical-style';
    style.textContent = `
      .hha-groups-solo-canonical-link{
        position:relative;
      }

      .hha-groups-solo-canonical-link::after{
        content:" SOLO";
        display:inline-flex;
        align-items:center;
        justify-content:center;
        margin-left:7px;
        padding:3px 7px;
        border-radius:999px;
        background:rgba(126,217,87,.18);
        color:#2f7a31;
        border:1px solid rgba(126,217,87,.55);
        font:900 10px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        vertical-align:middle;
      }

      .hha-groups-solo-launcher-pill{
        position:fixed;
        right:12px;
        bottom:calc(12px + env(safe-area-inset-bottom, 0px));
        z-index:999998;
        padding:8px 11px;
        border-radius:999px;
        background:rgba(255,255,255,.92);
        color:#17304a;
        border:1px solid rgba(126,217,87,.65);
        box-shadow:0 10px 24px rgba(0,0,0,.16);
        font:900 11px/1.1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        pointer-events:none;
      }
    `;

    document.head.appendChild(style);
  }

  function ensurePill(){
    if (document.querySelector('.hha-groups-solo-launcher-pill')) return;

    addStyle();

    const pill = document.createElement('div');
    pill.className = 'hha-groups-solo-launcher-pill';
    pill.textContent = 'Solo → canonical groups.html';
    document.body.appendChild(pill);
  }

  function scan(){
    patchSoloButtons();
    patchBackZoneButtons();
    ensurePill();
  }

  function boot(){
    addStyle();

    scan();

    setTimeout(scan, 300);
    setTimeout(scan, 900);
    setTimeout(scan, 1600);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_SOLO_LAUNCHER_CANONICAL_TIMER__);
      window.__HHA_GROUPS_SOLO_LAUNCHER_CANONICAL_TIMER__ = setTimeout(scan, 120);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['href','class','style']
    });

    console.info('[Groups Solo Launcher Canonical Guard]', PATCH_ID, {
      solo: buildSoloUrl(),
      zone: buildZoneUrl()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }

})();
