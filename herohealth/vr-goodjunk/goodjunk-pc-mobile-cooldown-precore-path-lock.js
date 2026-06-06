/* === /herohealth/vr-goodjunk/goodjunk-pc-mobile-cooldown-precore-path-lock.js === */
/* PATCH v20260606-GOODJUNK-PC-MOBILE-COOLDOWN-PRECORE-PATH-LOCK */

(function(){
  'use strict';

  if(window.GJ_COOLDOWN_PRECORE_PATH_LOCK_LOADED) return;
  window.GJ_COOLDOWN_PRECORE_PATH_LOCK_LOADED = true;

  const GOODJUNK_LAUNCHER =
    'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';

  const qs = new URLSearchParams(location.search || '');

  const game = String(qs.get('game') || qs.get('gameId') || qs.get('theme') || '').toLowerCase();
  const phase = String(qs.get('phase') || qs.get('gatePhase') || '').toLowerCase();

  if(game !== 'goodjunk' || phase !== 'cooldown') return;

  function keep(k, fallback){
    return qs.get(k) || fallback || '';
  }

  function launcherUrl(){
    const u = new URL(GOODJUNK_LAUNCHER);

    u.searchParams.set('pid', keep('pid', 'anon'));
    u.searchParams.set('name', keep('name', keep('nick', 'Hero')));
    u.searchParams.set('diff', keep('diff', 'normal'));
    u.searchParams.set('time', keep('time', '120'));
    u.searchParams.set('view', keep('view', 'pc'));

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'cooldown-return');
    u.searchParams.set('theme', 'goodjunk');

    [
      'studyId',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api',
      'seed'
    ].forEach(function(k){
      const v = qs.get(k);
      if(v) u.searchParams.set(k, v);
    });

    return u.toString();
  }

  const TARGET = launcherUrl();

  qs.set('hub', TARGET);
  qs.set('next', TARGET);
  qs.set('back', TARGET);
  qs.set('launcher', TARGET);
  qs.set('return', TARGET);
  qs.set('returnUrl', TARGET);
  qs.set('returnTo', TARGET);
  qs.set('after', TARGET);
  qs.set('done', TARGET);
  qs.set('doneUrl', TARGET);
  qs.set('cdnext', TARGET);

  history.replaceState(
    null,
    '',
    location.pathname + '?' + qs.toString() + (location.hash || '')
  );

  window.HH_GATE_FORCE_NEXT = TARGET;
  window.HH_GATE_FORCE_BACK = TARGET;
  window.HH_GATE_FORCE_HUB = TARGET;

  window.HHA_GATE_RETURN_URL = TARGET;
  window.HHA_GATE_DONE_URL = TARGET;
  window.HHA_NEXT_URL = TARGET;
  window.HHA_BACK_URL = TARGET;
  window.HHA_HUB_URL = TARGET;

  window.HHA_GATE_GO_NEXT = function(){ location.replace(TARGET); };
  window.HHA_GATE_GO_BACK = function(){ location.replace(TARGET); };
  window.HHA_GATE_GO_HUB = function(){ location.replace(TARGET); };
  window.goNext = function(){ location.replace(TARGET); };
  window.goBack = function(){ location.replace(TARGET); };
  window.goHub = function(){ location.replace(TARGET); };
  window.finishGate = function(){ location.replace(TARGET); };
  window.finishCooldown = function(){ location.replace(TARGET); };
  window.completeCooldown = function(){ location.replace(TARGET); };

  try{
    localStorage.setItem('GJ_COOLDOWN_PRECORE_PATH_LOCK_LAST', JSON.stringify({
      patch:'v20260606-GOODJUNK-PC-MOBILE-COOLDOWN-PRECORE-PATH-LOCK',
      target:TARGET,
      url:location.href,
      savedAt:new Date().toISOString()
    }));
  }catch(e){}

  console.log('[GoodJunk cooldown precore path lock]', TARGET);
})();
