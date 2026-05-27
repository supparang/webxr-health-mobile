/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-pc-return-launcher-final-patch.js
   PATCH v20260527a-GOODJUNK-PC-RETURN-LAUNCHER-FINAL

   PURPOSE:
   - ใช้เฉพาะ PC Solo Boss
   - ปุ่มกลับโหมด / หลัง cooldown ต้องกลับ goodjunk-launcher.html
   - ไม่แตะ gameplay / target / score / powerups
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527a-GOODJUNK-PC-RETURN-LAUNCHER-FINAL';

  const LAUNCHER = 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';
  const WARMUP_GATE = 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html';
  const HUB = 'https://supparang.github.io/webxr-health-mobile/herohealth/hub-v2.html';

  const QS = new URLSearchParams(location.search || '');

  function q(name, fallback){
    const v = QS.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function playerName(){
    return q('name', q('nick', 'Hero'));
  }

  function buildLauncherUrl(){
    const u = new URL(LAUNCHER);

    u.searchParams.set('pid', q('pid', 'anon'));
    u.searchParams.set('name', playerName());
    u.searchParams.set('diff', q('diff', 'normal'));
    u.searchParams.set('time', q('time', '90'));
    u.searchParams.set('view', 'pc');

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'pc-solo-boss');
    u.searchParams.set('theme', 'goodjunk');
    u.searchParams.set('hub', HUB);

    return u.href;
  }

  function buildCooldownUrl(extra){
    extra = extra || {};

    const launcherUrl = buildLauncherUrl();
    const keep = new URLSearchParams();

    keep.set('zone', 'nutrition');
    keep.set('cat', 'nutrition');
    keep.set('gameId', 'goodjunk');
    keep.set('game', 'goodjunk');
    keep.set('mode', 'solo_boss');
    keep.set('phase', 'cooldown');

    keep.set('pid', q('pid', 'anon'));
    keep.set('name', playerName());
    keep.set('diff', q('diff', 'normal'));
    keep.set('time', q('time', '90'));
    keep.set('view', 'pc');

    keep.set('hub', launcherUrl);
    keep.set('next', launcherUrl);
    keep.set('back', launcherUrl);
    keep.set('launcher', launcherUrl);
    keep.set('return', launcherUrl);

    const score = extra.score ?? q('score', '0');
    const stars = extra.stars ?? q('stars', '');
    const rank = extra.rank ?? q('rank', '');
    const accuracy = extra.accuracy ?? extra.acc ?? q('accuracy', q('acc', ''));
    const goodHits = extra.goodHits ?? extra.good ?? q('goodHits', q('good', ''));
    const junkHits = extra.junkHits ?? extra.junk ?? q('junkHits', q('junk', ''));
    const fakeHits = extra.fakeHits ?? extra.fake ?? q('fakeHits', q('fake', ''));
    const miss = extra.miss ?? extra.misses ?? q('miss', q('misses', '0'));
    const combo = extra.combo ?? extra.bestCombo ?? q('combo', q('bestCombo', ''));
    const coins = extra.coins ?? q('coins', '');
    const badge = extra.badge ?? q('badge', '');
    const mission = extra.mission ?? extra.missionDone ?? q('mission', q('missionDone', ''));

    keep.set('score', String(score || 0));
    keep.set('miss', String(miss || 0));

    if (stars !== '') keep.set('stars', String(stars));
    if (rank !== '') keep.set('rank', String(rank));
    if (accuracy !== '') keep.set('accuracy', String(accuracy));
    if (goodHits !== '') keep.set('goodHits', String(goodHits));
    if (junkHits !== '') keep.set('junkHits', String(junkHits));
    if (fakeHits !== '') keep.set('fakeHits', String(fakeHits));
    if (combo !== '') keep.set('bestCombo', String(combo));
    if (coins !== '') keep.set('coins', String(coins));
    if (badge !== '') keep.set('badge', String(badge));
    if (mission !== '') keep.set('missionDone', String(mission));

    if (extra.reason) keep.set('reason', String(extra.reason));

    keep.set('from', 'goodjunk-solo-boss-pc');
    keep.set('v', VERSION);

    return WARMUP_GATE + '?' + keep.toString();
  }

  function goLauncher(){
    location.href = buildLauncherUrl();
  }

  function goCooldown(extra){
    location.href = buildCooldownUrl(extra || {});
  }

  function patchBackButton(){
    const btn = document.getElementById('shellBackBtn');
    if (!btn) return;

    btn.innerHTML = '🎮 กลับเลือกโหมด GoodJunk';
    btn.setAttribute('aria-label', 'กลับหน้าเลือกโหมด GoodJunk');

    btn.onclick = function(ev){
      try{
        ev.preventDefault();
        ev.stopPropagation();
      }catch(e){}
      goLauncher();
    };
  }

  function patchSummaryCooldownButton(){
    window.addEventListener('gj:reward-summary-shown', function(ev){
      const summary = ev && ev.detail ? ev.detail : {};

      setTimeout(function(){
        const btn = document.getElementById('gjrZoneBtn');
        if (!btn) return;

        btn.innerHTML = '🧘 Cooldown แล้วกลับเลือกโหมด';
        btn.setAttribute('aria-label', 'ไป Cooldown แล้วกลับหน้าเลือกโหมด GoodJunk');
        btn.dataset.goCooldown = '1';

        try{
          localStorage.setItem('GJ_PC_SOLO_BOSS_COOLDOWN_TARGET_LAST', JSON.stringify({
            patch: VERSION,
            cooldownUrl: buildCooldownUrl({
              reason:'reward-summary',
              score:summary.score,
              stars:summary.stars,
              rank:summary.rank,
              accuracy:summary.accuracy || summary.acc,
              goodHits:summary.goodHits || summary.good,
              junkHits:summary.junkHits || summary.junk,
              fakeHits:summary.fakeHits || summary.fake,
              miss:summary.miss || summary.misses,
              bestCombo:summary.bestCombo || summary.combo,
              coins:summary.coins,
              badge:summary.badge,
              missionDone:summary.missionDone || summary.mission
            }),
            launcherUrl: buildLauncherUrl(),
            expectedAfterCooldown: LAUNCHER,
            savedAt: new Date().toISOString()
          }));
        }catch(e){}
      }, 30);
    });

    document.addEventListener('click', function(ev){
      const target = ev.target && ev.target.closest
        ? ev.target.closest('#gjrZoneBtn,[data-go-cooldown="1"]')
        : null;

      if (!target) return;

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      let latest = {};
      try{
        latest = JSON.parse(
          localStorage.getItem('GJ_SOLO_BOSS_LAST_SUMMARY') ||
          localStorage.getItem('GJ_FULL_3D_VR_LAST_SUMMARY') ||
          '{}'
        ) || {};
      }catch(e){}

      goCooldown(Object.assign({}, latest, {
        reason:'pc-reward-zone-button'
      }));
    }, true);
  }

  function expose(){
    window.GJ_PC_RETURN_LAUNCHER_FINAL = {
      version: VERSION,
      buildLauncherUrl,
      buildCooldownUrl,
      goLauncher,
      goCooldown
    };
  }

  function boot(){
    expose();
    patchBackButton();
    patchSummaryCooldownButton();

    console.info('[GoodJunk PC Return Launcher Final]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
