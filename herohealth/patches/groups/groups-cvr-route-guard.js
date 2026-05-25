/* =========================================================
   HeroHealth Groups cVR Route Guard
   PATCH: v20260525-groups-cvr-route-guard-01
   File: /herohealth/patches/groups/groups-cvr-route-guard.js

   Purpose:
   - Prevent broken cVR layout from loading through /vr-groups/groups.html?view=cvr
   - Hard redirect old cVR links to standalone /vr-groups/groups-cvr.html
   - Keep PC/Mobile untouched
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260525-groups-cvr-route-guard-01';

  if (window.__HHA_GROUPS_CVR_ROUTE_GUARD_01__) return;
  window.__HHA_GROUPS_CVR_ROUTE_GUARD_01__ = true;

  var qs = new URLSearchParams(location.search);
  var path = location.pathname || '';
  var view = String(qs.get('view') || '').toLowerCase();

  var isGroupsCore = /\/herohealth\/vr-groups\/groups\.html$/i.test(path);
  var isCvrIntent =
    view === 'cvr' ||
    view === 'cardboard' ||
    view === 'cardboard-vr' ||
    view === 'vr' ||
    qs.get('device') === 'cvr' ||
    qs.get('cvr') === '1' ||
    qs.get('vr') === '1' ||
    qs.get('input') === 'tap-scan';

  if (!isGroupsCore || !isCvrIntent) {
    console.info('[Groups cVR Route Guard]', PATCH_ID, 'skipped', {
      path: path,
      view: view,
      isGroupsCore: isGroupsCore,
      isCvrIntent: isCvrIntent
    });
    return;
  }

  function repoBase(){
    var marker = '/herohealth/';
    var idx = path.indexOf(marker);
    if (idx >= 0) return location.origin + path.slice(0, idx);
    return location.origin + '/webxr-health-mobile';
  }

  var target = new URL(repoBase() + '/herohealth/vr-groups/groups-cvr.html');

  qs.forEach(function(value, key){
    if (
      key === 'startFix' ||
      key === 'intro' ||
      key === 'nointro' ||
      key === 'skipIntro' ||
      key === 'direct' ||
      key === 'autostart' ||
      key === 'cvrShell'
    ) return;

    target.searchParams.set(key, value);
  });

  target.searchParams.set('mode', 'solo');
  target.searchParams.set('variant', qs.get('variant') || 'arena');
  target.searchParams.set('view', 'cvr');
  target.searchParams.set('run', 'play');
  target.searchParams.set('device', 'cvr');
  target.searchParams.set('cvr', '1');
  target.searchParams.set('vr', '1');
  target.searchParams.set('input', 'tap-scan');
  target.searchParams.set('entry', 'groups-cvr-route-guard');
  target.searchParams.set('from', 'groups-html-cvr-redirect');
  target.searchParams.set('t', String(Date.now()));

  try {
    sessionStorage.setItem('HHA_GROUPS_CVR_ROUTE_GUARD_LAST', target.toString());
  } catch(e) {}

  console.warn('[Groups cVR Route Guard]', PATCH_ID, 'redirecting broken cVR core route to standalone cVR', {
    from: location.href,
    to: target.toString()
  });

  location.replace(target.toString());
})();
