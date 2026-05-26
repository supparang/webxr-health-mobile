/* =========================================================
  GOODJUNK GLOBAL NAV FINAL PATCH
  PATCH: v20260526-GOODJUNK-GLOBAL-NAV-FINAL-HTML-LOCK
  FILE: /herohealth/vr-goodjunk/goodjunk-global-nav-final-patch.js

  PURPOSE:
    - Lock GoodJunk mode/launcher return to:
      /herohealth/goodjunk-launcher.html
    - Fix wrong .htm return
    - Fix mobile cooldown return
    - Fix buttons: กลับเลือกโหมด / โหมดเกม / launcher / summary / final
    - Preserve pid/name/diff/time/view/hub context
========================================================= */

(function(){
  'use strict';

  if (window.__GOODJUNK_GLOBAL_NAV_FINAL_PATCH__) return;
  window.__GOODJUNK_GLOBAL_NAV_FINAL_PATCH__ = true;

  const PATCH = 'v20260526-GOODJUNK-GLOBAL-NAV-FINAL-HTML-LOCK';

  const CANONICAL = {
    goodjunkLauncher: 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html',
    nutritionZone: 'https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html',
    hub: 'https://supparang.github.io/webxr-health-mobile/herohealth/hub-v2.html',
    warmupGate: 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html'
  };

  function qs(){
    return new URLSearchParams(location.search || '');
  }

  function q(name, fallback){
    const v = qs().get(name);
    return v === null || v === '' ? fallback : v;
  }

  function playerName(){
    return q('name', q('nick', 'Hero'));
  }

  function normalizeGoodJunkUrl(raw){
    let url = raw || CANONICAL.goodjunkLauncher;

    try{
      const u = new URL(url, location.href);

      if (/goodjunk-launcher\.htm$/i.test(u.pathname)){
        u.pathname = u.pathname.replace(/goodjunk-launcher\.htm$/i, 'goodjunk-launcher.html');
      }

      if (/goodjunk-launcher\.html$/i.test(u.pathname)){
        return u.href;
      }

      return CANONICAL.goodjunkLauncher;
    }catch(_){
      return CANONICAL.goodjunkLauncher;
    }
  }

  function buildGoodJunkLauncherUrl(){
    const u = new URL(CANONICAL.goodjunkLauncher);

    const keep = [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'studyId',
      'conditionGroup',
      'phase',
      'run'
    ];

    keep.forEach(function(k){
      const v = q(k, '');
      if (v) u.searchParams.set(k, v);
    });

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');

    if (!u.searchParams.get('pid')) u.searchParams.set('pid', 'anon');
    if (!u.searchParams.get('name')) u.searchParams.set('name', playerName());
    if (!u.searchParams.get('diff')) u.searchParams.set('diff', 'normal');
    if (!u.searchParams.get('time')) u.searchParams.set('time', '120');
    if (!u.searchParams.get('view')) u.searchParams.set('view', q('view', 'mobile'));

    u.searchParams.set('hub', CANONICAL.hub);
    u.searchParams.set('v', 'goodjunk-nav-final-html');

    return u.href;
  }

  function buildNutritionZoneUrl(){
    const u = new URL(CANONICAL.nutritionZone);

    u.searchParams.set('pid', q('pid', 'anon'));
    u.searchParams.set('name', playerName());
    u.searchParams.set('diff', q('diff', 'normal'));
    u.searchParams.set('time', q('time', '120'));
    u.searchParams.set('view', q('view', 'mobile'));
    u.searchParams.set('hub', CANONICAL.hub);

    return u.href;
  }

  function buildCooldownUrl(extra){
    extra = extra || {};

    const launcherUrl = buildGoodJunkLauncherUrl();
    const u = new URL(CANONICAL.warmupGate);

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('mode', q('mode', 'solo_boss'));
    u.searchParams.set('phase', 'cooldown');

    u.searchParams.set('pid', q('pid', 'anon'));
    u.searchParams.set('name', playerName());
    u.searchParams.set('diff', q('diff', 'normal'));
    u.searchParams.set('time', q('time', '120'));
    u.searchParams.set('view', q('view', 'mobile'));

    u.searchParams.set('hub', CANONICAL.hub);

    /*
      สำคัญที่สุด:
      หลัง cooldown ต้องกลับหน้าเลือกโหมด GoodJunk .html เท่านั้น
    */
    u.searchParams.set('next', launcherUrl);
    u.searchParams.set('back', launcherUrl);
    u.searchParams.set('launcher', launcherUrl);
    u.searchParams.set('return', launcherUrl);

    if (extra.reason) u.searchParams.set('reason', String(extra.reason));
    if (extra.score !== undefined) u.searchParams.set('score', String(extra.score));
    if (extra.stars !== undefined) u.searchParams.set('stars', String(extra.stars));
    if (extra.rank !== undefined) u.searchParams.set('rank', String(extra.rank));

    u.searchParams.set('v', 'goodjunk-cooldown-return-html');

    return u.href;
  }

  function goGoodJunkLauncher(){
    location.href = buildGoodJunkLauncherUrl();
  }

  function goNutritionZone(){
    location.href = buildNutritionZoneUrl();
  }

  function goCooldown(extra){
    location.href = buildCooldownUrl(extra || {});
  }

  function textOf(el){
    return String(el && el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function looksLikeGoodJunkModeButton(el){
    const id = String(el.id || '').toLowerCase();
    const href = String(el.getAttribute && el.getAttribute('href') || '').toLowerCase();
    const txt = textOf(el).toLowerCase();

    return (
      id.includes('launcher') ||
      id.includes('backbtn') ||
      id.includes('finallauncher') ||
      id.includes('mode') ||
      href.includes('goodjunk-launcher.htm') ||
      href.includes('goodjunk-launcher.html') ||
      txt.includes('เลือกโหมด') ||
      txt.includes('โหมดเกม') ||
      txt.includes('กลับโหมด') ||
      txt.includes('goodjunk') ||
      txt.includes('mode')
    );
  }

  function looksLikeNutritionZoneButton(el){
    const id = String(el.id || '').toLowerCase();
    const href = String(el.getAttribute && el.getAttribute('href') || '').toLowerCase();
    const txt = textOf(el).toLowerCase();

    return (
      id.includes('zone') ||
      href.includes('nutrition-zone.html') ||
      txt.includes('nutrition zone') ||
      txt.includes('โซนโภชนาการ') ||
      txt.includes('กลับ zone') ||
      txt.includes('กลับโซน')
    );
  }

  function looksLikeCooldownButton(el){
    const id = String(el.id || '').toLowerCase();
    const txt = textOf(el).toLowerCase();
    const data = String(el.dataset && (el.dataset.goCooldown || el.dataset.cooldown) || '').toLowerCase();

    return (
      id.includes('cooldown') ||
      data === '1' ||
      txt.includes('cooldown') ||
      txt.includes('คูลดาวน์') ||
      txt.includes('ผ่อนคลาย') ||
      txt.includes('ทำ 3d cooldown')
    );
  }

  function patchAnchorHref(el, url){
    if (!el || !el.tagName) return;

    if (String(el.tagName).toUpperCase() === 'A'){
      el.setAttribute('href', url);
    }
  }

  function patchButtons(){
    const launcherUrl = buildGoodJunkLauncherUrl();
    const zoneUrl = buildNutritionZoneUrl();

    document.querySelectorAll('a,button,[role="button"],.btn').forEach(function(el){
      if (!el || el.__gjGlobalNavFinalPatched) return;

      if (looksLikeCooldownButton(el)){
        el.__gjGlobalNavFinalPatched = true;
        el.dataset.goCooldown = '1';

        el.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

          goCooldown({
            reason: 'patched-cooldown-button'
          });

          return false;
        }, true);

        return;
      }

      if (looksLikeGoodJunkModeButton(el)){
        el.__gjGlobalNavFinalPatched = true;
        patchAnchorHref(el, launcherUrl);

        el.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

          location.href = launcherUrl;
          return false;
        }, true);

        return;
      }

      if (looksLikeNutritionZoneButton(el)){
        el.__gjGlobalNavFinalPatched = true;
        patchAnchorHref(el, zoneUrl);

        el.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

          location.href = zoneUrl;
          return false;
        }, true);
      }
    });
  }

  function patchKnownIds(){
    const launcherUrl = buildGoodJunkLauncherUrl();

    [
      'shellBackBtn',
      'backBtn',
      'launcherBtn',
      'finalLauncherBtn',
      'gjrModeBtn',
      'gjrLauncherBtn'
    ].forEach(function(id){
      const btn = document.getElementById(id);
      if (!btn || btn.__gjKnownLauncherPatched) return;

      btn.__gjKnownLauncherPatched = true;

      if (btn.tagName && String(btn.tagName).toUpperCase() === 'A'){
        btn.setAttribute('href', launcherUrl);
      }

      btn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        location.href = launcherUrl;
        return false;
      }, true);
    });

    const rewardZoneBtn = document.getElementById('gjrZoneBtn');
    if (rewardZoneBtn && !rewardZoneBtn.__gjRewardCooldownPatched){
      rewardZoneBtn.__gjRewardCooldownPatched = true;
      rewardZoneBtn.dataset.goCooldown = '1';
      rewardZoneBtn.innerHTML = '🧘 Cooldown แล้วกลับเลือกโหมด';

      rewardZoneBtn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        goCooldown({
          reason: 'reward-zone-button'
        });

        return false;
      }, true);
    }
  }

  function patchWindowApis(){
    window.GOODJUNK_CANONICAL_NAV = {
      patch: PATCH,
      canonical: CANONICAL,
      normalizeGoodJunkUrl: normalizeGoodJunkUrl,
      buildGoodJunkLauncherUrl: buildGoodJunkLauncherUrl,
      buildNutritionZoneUrl: buildNutritionZoneUrl,
      buildCooldownUrl: buildCooldownUrl,
      goGoodJunkLauncher: goGoodJunkLauncher,
      goNutritionZone: goNutritionZone,
      goCooldown: goCooldown
    };

    if (window.GJ_SOLO_BOSS_SHELL){
      try{
        window.GJ_SOLO_BOSS_SHELL.version = PATCH;
        window.GJ_SOLO_BOSS_SHELL.buildGoodJunkLauncherUrl = buildGoodJunkLauncherUrl;
        window.GJ_SOLO_BOSS_SHELL.buildNutritionZoneUrl = buildNutritionZoneUrl;
        window.GJ_SOLO_BOSS_SHELL.buildCooldownUrl = buildCooldownUrl;
        window.GJ_SOLO_BOSS_SHELL.goGoodJunkLauncher = goGoodJunkLauncher;
        window.GJ_SOLO_BOSS_SHELL.goNutritionZone = goNutritionZone;
        window.GJ_SOLO_BOSS_SHELL.goCooldown = goCooldown;
      }catch(_){}
    }
  }

  function saveCheck(){
    try{
      localStorage.setItem('GOODJUNK_GLOBAL_NAV_FINAL_LAST', JSON.stringify({
        patch: PATCH,
        href: location.href,
        launcherUrl: buildGoodJunkLauncherUrl(),
        cooldownUrl: buildCooldownUrl({reason:'check'}),
        nutritionZoneUrl: buildNutritionZoneUrl(),
        savedAt: new Date().toISOString()
      }));
    }catch(_){}
  }

  function boot(){
    patchWindowApis();
    patchButtons();
    patchKnownIds();
    saveCheck();

    let count = 0;
    const timer = setInterval(function(){
      count++;

      patchWindowApis();
      patchButtons();
      patchKnownIds();

      if (count > 1200){
        clearInterval(timer);
      }
    }, 300);

    window.GOODJUNK_GLOBAL_NAV_FINAL_CHECK = function(){
      const snap = {
        patch: PATCH,
        href: location.href,
        launcherUrl: buildGoodJunkLauncherUrl(),
        cooldownUrl: buildCooldownUrl({reason:'manual-check'}),
        nutritionZoneUrl: buildNutritionZoneUrl(),
        patchedButtons: document.querySelectorAll('[data-go-cooldown="1"]').length,
        wrongHtmLinks: Array.from(document.querySelectorAll('a[href*="goodjunk-launcher.htm"]')).map(function(a){
          return a.getAttribute('href');
        })
      };

      console.log('[GOODJUNK_GLOBAL_NAV_FINAL_CHECK]', snap);
      return snap;
    };

    console.info('[GoodJunk Global Nav Final Patch]', PATCH, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }
})();
