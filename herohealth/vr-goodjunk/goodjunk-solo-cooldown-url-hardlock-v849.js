// === /herohealth/vr-goodjunk/goodjunk-solo-cooldown-url-hardlock-v849.js ===
// PATCH v20260605-v849
// Purpose: force GoodJunk Solo Boss cooldown URL to correct /herohealth/goodjunk-launcher.html for PC/Mobile.

(function(){
  'use strict';

  const PATCH = 'v20260605-v849-GOODJUNK-SOLO-COOLDOWN-URL-HARDLOCK';

  const GOODJUNK_LAUNCHER =
    'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';

  const WARMUP_GATE =
    'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html';

  function qs(){
    return new URLSearchParams(location.search || '');
  }

  function get(name, fallback){
    const q = qs();
    const v = q.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function playerName(){
    return get('name', get('nick', 'Hero'));
  }

  function launcherUrl(){
    const q = qs();
    const u = new URL(GOODJUNK_LAUNCHER);

    u.searchParams.set('pid', get('pid', 'anon'));
    u.searchParams.set('name', playerName());
    u.searchParams.set('diff', get('diff', 'normal'));
    u.searchParams.set('time', get('time', '120'));
    u.searchParams.set('view', get('view', 'mobile'));

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', get('view', 'mobile') === 'pc' ? 'pc-solo-boss-return' : 'mobile-solo-boss-return');
    u.searchParams.set('theme', 'goodjunk');

    ['studyId','conditionGroup','section','session_code','log','api','seed'].forEach(function(k){
      const v = q.get(k);
      if(v) u.searchParams.set(k, v);
    });

    return u.toString();
  }

  function cooldownUrl(extra){
    extra = extra || {};

    const target = launcherUrl();
    const q = qs();
    const u = new URL(WARMUP_GATE);

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo_boss');
    u.searchParams.set('phase', 'cooldown');

    u.searchParams.set('pid', get('pid', 'anon'));
    u.searchParams.set('name', playerName());
    u.searchParams.set('diff', get('diff', 'normal'));
    u.searchParams.set('time', get('time', '120'));
    u.searchParams.set('view', get('view', 'mobile'));

    u.searchParams.set('hub', target);
    u.searchParams.set('next', target);
    u.searchParams.set('back', target);
    u.searchParams.set('launcher', target);
    u.searchParams.set('return', target);
    u.searchParams.set('returnUrl', target);
    u.searchParams.set('returnTo', target);
    u.searchParams.set('after', target);
    u.searchParams.set('done', target);
    u.searchParams.set('doneUrl', target);
    u.searchParams.set('cdnext', target);

    const score = extra.score ?? q.get('score') ?? '0';
    const miss = extra.miss ?? extra.misses ?? q.get('miss') ?? q.get('misses') ?? '0';

    u.searchParams.set('score', String(score || 0));
    u.searchParams.set('miss', String(miss || 0));

    [
      ['stars', extra.stars ?? q.get('stars')],
      ['rank', extra.rank ?? q.get('rank')],
      ['accuracy', extra.accuracy ?? extra.acc ?? q.get('accuracy') ?? q.get('acc')],
      ['goodHits', extra.goodHits ?? extra.good ?? q.get('goodHits') ?? q.get('good')],
      ['junkHits', extra.junkHits ?? extra.junk ?? q.get('junkHits') ?? q.get('junk')],
      ['fakeHits', extra.fakeHits ?? extra.fake ?? q.get('fakeHits') ?? q.get('fake')],
      ['bestCombo', extra.bestCombo ?? extra.combo ?? q.get('bestCombo') ?? q.get('combo')],
      ['coins', extra.coins ?? q.get('coins')],
      ['badge', extra.badge ?? q.get('badge')],
      ['missionDone', extra.missionDone ?? extra.mission ?? q.get('missionDone') ?? q.get('mission')]
    ].forEach(function(pair){
      if(pair[1] !== null && pair[1] !== undefined && pair[1] !== ''){
        u.searchParams.set(pair[0], String(pair[1]));
      }
    });

    if(extra.reason) u.searchParams.set('reason', String(extra.reason));
    u.searchParams.set('from', 'goodjunk-solo-boss');
    u.searchParams.set('v', PATCH);

    return u.toString();
  }

  function goCooldown(extra){
    location.href = cooldownUrl(extra || {});
  }

  window.GJ_SOLO_BOSS_SHELL = window.GJ_SOLO_BOSS_SHELL || {};
  window.GJ_SOLO_BOSS_SHELL.buildGoodJunkLauncherUrl = launcherUrl;
  window.GJ_SOLO_BOSS_SHELL.buildCooldownUrl = cooldownUrl;
  window.GJ_SOLO_BOSS_SHELL.goCooldown = goCooldown;

  document.addEventListener('click', function(ev){
    const btn = ev.target && ev.target.closest
      ? ev.target.closest('#gjrZoneBtn,[data-go-cooldown="1"]')
      : null;

    if(!btn) return;

    ev.preventDefault();
    ev.stopPropagation();
    if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

    let latest = {};
    try{
      latest = JSON.parse(
        localStorage.getItem('GJ_SOLO_BOSS_LAST_SUMMARY') ||
        localStorage.getItem('GJ_FULL_3D_VR_LAST_SUMMARY') ||
        '{}'
      ) || {};
    }catch(_){}

    goCooldown(Object.assign({}, latest, { reason:'v849-hardlock-click' }));
  }, true);

  try{
    localStorage.setItem('GJ_SOLO_COOLDOWN_URL_HARDLOCK_LAST', JSON.stringify({
      patch: PATCH,
      launcher: launcherUrl(),
      cooldown: cooldownUrl({ reason:'install-preview' }),
      at: new Date().toISOString()
    }));
  }catch(_){}

  console.log('[GoodJunk Solo cooldown URL hardlock]', launcherUrl());
})();
