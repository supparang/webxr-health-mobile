/* =========================================================
   HeroHealth • Groups Race Route v15 Guard
   File: /herohealth/vr-groups/groups-race-route-v15-guard-v19.js
   PATCH: v20260609-GROUPS-RACE-ROUTE-V15-GUARD-V19

   Purpose:
   - Freeze routing ให้ Groups Race ใช้ groups-race-run-v15.html
   - แก้/ดัก link เก่าที่ชี้ไป v09/v10/v11/v12
   - preserve room/name/view/diff/time/mock
   - ใช้ได้ทั้ง groups-race-lobby.html / groups-vr.html / launcher
   ========================================================= */

(function(){
  'use strict';

  const PATCH = 'v20260609-GROUPS-RACE-ROUTE-V15-GUARD-V19';
  const TARGET = 'groups-race-run-v15.html';

  if (window.__HHA_GROUPS_RACE_ROUTE_V15_GUARD_V19__) return;
  window.__HHA_GROUPS_RACE_ROUTE_V15_GUARD_V19__ = true;

  const qs = new URLSearchParams(location.search || '');

  function norm(v){
    return String(v == null ? '' : v).trim();
  }

  function getStored(keys){
    for (const k of keys) {
      try {
        const v = sessionStorage.getItem(k) || localStorage.getItem(k);
        if (v) return v;
      } catch(_) {}
    }
    return '';
  }

  function getRoom(){
    return norm(
      qs.get('room') ||
      qs.get('roomId') ||
      qs.get('code') ||
      getStored([
        'HHA_GROUPS_RACE_ROOM',
        'HHA_GROUPS_RACE_ROOM_CODE',
        'HHA_RACE_ROOM'
      ])
    ).toUpperCase();
  }

  function getName(){
    return norm(
      qs.get('name') ||
      qs.get('playerName') ||
      getStored([
        'HHA_GROUPS_RACE_NAME',
        'HHA_GROUPS_RACE_PLAYER_NAME',
        'HHA_PLAYER_NAME'
      ]) ||
      'Hero'
    ) || 'Hero';
  }

  function getView(){
    return norm(qs.get('view') || getStored(['HHA_GROUPS_VIEW']) || 'mobile') || 'mobile';
  }

  function getDiff(){
    return norm(qs.get('diff') || getStored(['HHA_GROUPS_DIFF']) || 'normal') || 'normal';
  }

  function getTime(){
    return norm(qs.get('time') || qs.get('timeSec') || getStored(['HHA_GROUPS_RACE_TIME']) || '45') || '45';
  }

  function repoBase(){
    const path = location.pathname || '';
    const marker = '/herohealth/';
    const idx = path.indexOf(marker);
    if (idx >= 0) return location.origin + path.slice(0, idx);
    return location.origin + '/webxr-health-mobile';
  }

  function runUrl(extra){
    const out = new URL(repoBase() + '/herohealth/vr-groups/' + TARGET);

    const room = getRoom();
    if (room) {
      out.searchParams.set('room', room);
      out.searchParams.set('roomId', room);
      out.searchParams.set('code', room);
    }

    out.searchParams.set('name', getName());
    out.searchParams.set('view', getView());
    out.searchParams.set('diff', getDiff());
    out.searchParams.set('time', getTime());

    if (qs.get('mock') === '1') out.searchParams.set('mock', '1');
    if (qs.get('qa') === '1') out.searchParams.set('qa', '1');
    if (qs.get('debug') === '1') out.searchParams.set('debug', '1');

    Object.keys(extra || {}).forEach(function(k){
      if (extra[k] == null) out.searchParams.delete(k);
      else out.searchParams.set(k, String(extra[k]));
    });

    return out.toString();
  }

  function isOldRaceRunUrl(url){
    const s = String(url || '');
    return (
      s.includes('groups-race-run-v09.html') ||
      s.includes('groups-race-run-v10.html') ||
      s.includes('groups-race-run-v11.html') ||
      s.includes('groups-race-run-v12.html') ||
      s.includes('groups-race-run-v13.html') ||
      s.includes('groups-race-run-v14.html') ||
      s.includes('groups-race-run.html')
    );
  }

  function isRaceStartText(t){
    t = String(t || '').toLowerCase();

    return (
      t.includes('race') ||
      t.includes('เริ่มแข่ง') ||
      t.includes('เริ่ม race') ||
      t.includes('start race') ||
      t.includes('เข้าแข่ง') ||
      t.includes('แข่ง')
    );
  }

  function rewriteLinks(){
    const links = Array.from(document.querySelectorAll('a[href]'));

    links.forEach(function(a){
      const href = a.getAttribute('href') || '';

      if (isOldRaceRunUrl(href)) {
        a.setAttribute('href', runUrl({
          from:'route-v19-link-rewrite'
        }));
        a.dataset.hhaRaceRouteV19 = 'rewritten';
      }
    });
  }

  function interceptClicks(){
    document.addEventListener('click', function(ev){
      const el = ev.target && ev.target.closest
        ? ev.target.closest('a,button,[role="button"],.btn,.button')
        : null;

      if (!el) return;

      const href = el.getAttribute && el.getAttribute('href');
      const txt = norm(el.textContent || el.innerText || '');

      if (href && isOldRaceRunUrl(href)) {
        ev.preventDefault();
        location.href = runUrl({
          from:'route-v19-old-link'
        });
        return;
      }

      /*
        ใช้เฉพาะหน้า lobby/launcher:
        ถ้าปุ่มข้อความเหมือนเริ่ม Race แต่ไม่มี href ชัดเจน
        ให้พาไป v15
      */
      const path = location.pathname || '';
      const onLobbyLikePage =
        path.includes('groups-race-lobby') ||
        path.includes('groups-vr') ||
        path.includes('groups-race');

      const alreadyRunPage = path.includes(TARGET);

      if (!alreadyRunPage && onLobbyLikePage && isRaceStartText(txt)) {
        const id = String(el.id || '').toLowerCase();
        const cls = String(el.className || '').toLowerCase();

        const looksStart =
          id.includes('start') ||
          id.includes('race') ||
          cls.includes('start') ||
          cls.includes('race') ||
          txt.includes('เริ่ม') ||
          txt.includes('start');

        if (looksStart) {
          ev.preventDefault();
          location.href = runUrl({
            from:'route-v19-start-button'
          });
        }
      }
    }, true);
  }

  function exposeHelper(){
    window.HHA_GROUPS_RACE_V15_URL = function(extra){
      return runUrl(extra || {});
    };

    window.HHA_GROUPS_RACE_GO_V15 = function(extra){
      location.href = runUrl(extra || {
        from:'route-v19-helper'
      });
    };
  }

  function boot(){
    rewriteLinks();
    interceptClicks();
    exposeHelper();

    setInterval(rewriteLinks, 1200);

    console.info('[GroupsRaceRouteV15GuardV19]', {
      patch: PATCH,
      target: TARGET,
      room: getRoom(),
      name: getName(),
      view: getView(),
      diff: getDiff(),
      time: getTime()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
