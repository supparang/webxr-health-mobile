// === /herohealth/vr-groups/groups-mobile-router.js ===
// HeroHealth Groups — Mobile Router Guard
// Purpose:
// - Prevent mobile users from entering old v8 groups.html
// - Redirect Mobile + Solo to clean /vr-groups/groups-mobile.html
// - Keep PC / Cardboard / team modes available for future routing
// PATCH v20260514-GROUPS-MOBILE-ROUTER-V1

(function () {
  'use strict';

  const VERSION = 'v20260514-groups-mobile-router-v1';

  if (window.__HHA_GROUPS_MOBILE_ROUTER__) {
    return;
  }

  window.__HHA_GROUPS_MOBILE_ROUTER__ = true;

  function params() {
    try {
      return new URL(location.href).searchParams;
    } catch (e) {
      return new URLSearchParams();
    }
  }

  function isMobileDevice() {
    const p = params();
    const view = String(p.get('view') || '').toLowerCase();

    if (view === 'mobile') return true;

    const ua = String(navigator.userAgent || '');

    return (
      window.innerWidth <= 760 ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
    );
  }

  function isAlreadyMobileRuntime() {
    return location.pathname.includes('/vr-groups/groups-mobile.html');
  }

  function isOldGroupsRuntime() {
    return location.pathname.includes('/vr-groups/groups.html');
  }

  function isSoloLike() {
    const p = params();

    const mode = String(p.get('mode') || 'solo').toLowerCase();
    const run = String(p.get('run') || 'play').toLowerCase();
    const game = String(p.get('game') || 'groups').toLowerCase();

    return (
      game === 'groups' &&
      (
        mode === '' ||
        mode === 'solo' ||
        mode === 'practice' ||
        run === 'play' ||
        run === 'practice'
      )
    );
  }

  function buildMobileUrl() {
    const p = params();

    const u = new URL('./groups-mobile.html', location.href);

    p.forEach(function (value, key) {
      u.searchParams.set(key, value);
    });

    u.searchParams.set('view', 'mobile');
    u.searchParams.set('game', 'groups');

    const mode = String(p.get('mode') || '').toLowerCase();
    const run = String(p.get('run') || '').toLowerCase();

    if (mode === 'practice' || run === 'practice') {
      u.searchParams.set('mode', 'practice');
      u.searchParams.set('run', 'practice');
    } else {
      u.searchParams.set('mode', 'solo');
      u.searchParams.set('run', 'play');
    }

    u.searchParams.set('zone', p.get('zone') || 'nutrition');

    if (!u.searchParams.get('pid')) {
      u.searchParams.set('pid', 'anon');
    }

    if (!u.searchParams.get('name')) {
      u.searchParams.set('name', 'Hero');
    }

    if (!u.searchParams.get('diff')) {
      u.searchParams.set('diff', 'normal');
    }

    if (!u.searchParams.get('time')) {
      u.searchParams.set('time', '90');
    }

    if (!u.searchParams.get('hub')) {
      u.searchParams.set(
        'hub',
        'https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html'
      );
    }

    u.searchParams.set('router', VERSION);

    return u.toString();
  }

  function redirectIfNeeded() {
    if (isAlreadyMobileRuntime()) return;
    if (!isOldGroupsRuntime()) return;
    if (!isMobileDevice()) return;
    if (!isSoloLike()) return;

    const target = buildMobileUrl();

    console.info('[Groups Mobile Router] redirecting to mobile runtime', {
      version: VERSION,
      from: location.href,
      to: target
    });

    location.replace(target);
  }

  redirectIfNeeded();

  window.HHA_GROUPS_MOBILE_ROUTER = {
    version: VERSION,
    isMobileDevice,
    isOldGroupsRuntime,
    isAlreadyMobileRuntime,
    isSoloLike,
    buildMobileUrl,
    redirectIfNeeded
  };
})();
