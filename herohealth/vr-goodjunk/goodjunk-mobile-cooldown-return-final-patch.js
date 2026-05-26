/* =========================================================
  GOODJUNK MOBILE COOLDOWN RETURN FINAL PATCH
  PATCH: v20260526-GOODJUNK-MOBILE-COOLDOWN-RETURN-FINAL
  FILE: /herohealth/vr-goodjunk/goodjunk-mobile-cooldown-return-final-patch.js

  PURPOSE:
    - Mobile/PC solo boss summary cooldown button must go:
      warmup-gate.html?phase=cooldown
      then next/back/launcher = goodjunk-launcher.html
    - Fix old wrong return to .htm / nutrition-zone / hub
========================================================= */

(function(){
  'use strict';

  if (window.__GOODJUNK_MOBILE_COOLDOWN_RETURN_FINAL__) return;
  window.__GOODJUNK_MOBILE_COOLDOWN_RETURN_FINAL__ = true;

  const PATCH = 'v20260526-GOODJUNK-MOBILE-COOLDOWN-RETURN-FINAL';

  const URLS = {
    launcher: 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html',
    warmupGate: 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html',
    hub: 'https://supparang.github.io/webxr-health-mobile/herohealth/hub-v2.html'
  };

  function qs(){
    return new URLSearchParams(location.search || '');
  }

  function q(k, d){
    const v = qs().get(k);
    return v === null || v === '' ? d : v;
  }

  function playerName(){
    return q('name', q('nick', 'Hero'));
  }

  function launcherUrl(){
    const u = new URL(URLS.launcher);

    u.searchParams.set('pid', q('pid', 'anon'));
    u.searchParams.set('name', playerName());
    u.searchParams.set('diff', q('diff', 'normal'));
    u.searchParams.set('time', q('time', '120'));
    u.searchParams.set('view', q('view', 'mobile'));
    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', q('mode', 'solo_boss'));
    u.searchParams.set('hub', URLS.hub);
    u.searchParams.set('v', 'mobile-return-final');

    return u.href;
  }

  function cooldownUrl(extra){
    extra = extra || {};

    const back = launcherUrl();
    const u = new URL(URLS.warmupGate);

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

    u.searchParams.set('hub', URLS.hub);

    /*
      ตัวล็อกสำคัญ:
      หลัง cooldown ต้องกลับ goodjunk-launcher.html เท่านั้น
    */
    u.searchParams.set('next', back);
    u.searchParams.set('back', back);
    u.searchParams.set('launcher', back);
    u.searchParams.set('return', back);

    if (extra.reason) u.searchParams.set('reason', String(extra.reason));
    if (extra.score !== undefined) u.searchParams.set('score', String(extra.score));
    if (extra.stars !== undefined) u.searchParams.set('stars', String(extra.stars));
    if (extra.rank !== undefined) u.searchParams.set('rank', String(extra.rank));

    u.searchParams.set('v', 'mobile-cooldown-return-final');

    return u.href;
  }

  function textOf(el){
    return String(el && el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function isCooldownControl(el){
    const id = String(el && el.id || '').toLowerCase();
    const txt = textOf(el);
    const data = String(el && el.dataset && (el.dataset.goCooldown || el.dataset.cooldown) || '');

    return (
      id.includes('cooldown') ||
      data === '1' ||
      txt.includes('cooldown') ||
      txt.includes('คูลดาวน์') ||
      txt.includes('ผ่อนคลาย') ||
      txt.includes('ทำ 3d cooldown')
    );
  }

  function isModeBackControl(el){
    const id = String(el && el.id || '').toLowerCase();
    const txt = textOf(el);
    const href = String(el && el.getAttribute && el.getAttribute('href') || '').toLowerCase();

    return (
      id === 'shellbackbtn' ||
      id === 'backbtn' ||
      id === 'launcherbtn' ||
      id === 'finallauncherbtn' ||
      id.includes('launcher') ||
      href.includes('goodjunk-launcher') ||
      txt.includes('เลือกโหมด') ||
      txt.includes('โหมดเกม') ||
      txt.includes('กลับโหมด')
    );
  }

  function patchCooldownControls(){
    document.querySelectorAll('button,a,[role="button"],.btn').forEach(function(el){
      if (!el || el.__gjMobileCooldownReturnFinal) return;

      if (isCooldownControl(el)){
        el.__gjMobileCooldownReturnFinal = true;
        el.dataset.goCooldown = '1';

        if (el.tagName && String(el.tagName).toUpperCase() === 'A'){
          el.setAttribute('href', cooldownUrl({reason:'anchor'}));
        }

        el.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

          location.href = cooldownUrl({
            reason: 'cooldown-control-click'
          });

          return false;
        }, true);
      }
    });
  }

  function patchModeBackControls(){
    document.querySelectorAll('button,a,[role="button"],.btn').forEach(function(el){
      if (!el || el.__gjMobileModeBackFinal) return;

      if (isModeBackControl(el)){
        el.__gjMobileModeBackFinal = true;

        if (el.tagName && String(el.tagName).toUpperCase() === 'A'){
          el.setAttribute('href', launcherUrl());
        }

        el.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

          location.href = launcherUrl();

          return false;
        }, true);
      }
    });
  }

  function patchRewardSummaryEvent(){
    window.addEventListener('gj:reward-summary-shown', function(ev){
      const detail = ev && ev.detail ? ev.detail : {};

      setTimeout(function(){
        const btn = document.getElementById('gjrZoneBtn');
        if (!btn) return;

        btn.innerHTML = '🧘 Cooldown แล้วกลับเลือกโหมด';
        btn.dataset.goCooldown = '1';

        btn.__gjMobileCooldownReturnFinal = false;
        patchCooldownControls();

        try{
          localStorage.setItem('GOODJUNK_MOBILE_COOLDOWN_RETURN_LAST', JSON.stringify({
            patch: PATCH,
            source: 'gj:reward-summary-shown',
            score: detail.score,
            stars: detail.stars,
            rank: detail.rank,
            cooldownUrl: cooldownUrl({
              reason: 'reward-summary',
              score: detail.score,
              stars: detail.stars,
              rank: detail.rank
            }),
            launcherUrl: launcherUrl(),
            savedAt: new Date().toISOString()
          }));
        }catch(_){}
      }, 40);
    });
  }

  function exposeApi(){
    window.GOODJUNK_MOBILE_COOLDOWN_RETURN = {
      patch: PATCH,
      launcherUrl: launcherUrl,
      cooldownUrl: cooldownUrl,
      goLauncher: function(){
        location.href = launcherUrl();
      },
      goCooldown: function(extra){
        location.href = cooldownUrl(extra || {});
      }
    };

    if (window.GJ_SOLO_BOSS_SHELL){
      try{
        window.GJ_SOLO_BOSS_SHELL.version = PATCH;
        window.GJ_SOLO_BOSS_SHELL.buildGoodJunkLauncherUrl = launcherUrl;
        window.GJ_SOLO_BOSS_SHELL.buildCooldownUrl = cooldownUrl;
        window.GJ_SOLO_BOSS_SHELL.goGoodJunkLauncher = function(){
          location.href = launcherUrl();
        };
        window.GJ_SOLO_BOSS_SHELL.goCooldown = function(extra){
          location.href = cooldownUrl(extra || {});
        };
      }catch(_){}
    }
  }

  function saveBoot(){
    try{
      localStorage.setItem('GOODJUNK_MOBILE_COOLDOWN_RETURN_BOOT', JSON.stringify({
        patch: PATCH,
        href: location.href,
        launcherUrl: launcherUrl(),
        cooldownUrl: cooldownUrl({reason:'boot'}),
        savedAt: new Date().toISOString()
      }));
    }catch(_){}
  }

  function boot(){
    exposeApi();
    patchCooldownControls();
    patchModeBackControls();
    patchRewardSummaryEvent();
    saveBoot();

    let count = 0;
    const timer = setInterval(function(){
      count++;

      exposeApi();
      patchCooldownControls();
      patchModeBackControls();

      if (count > 1200){
        clearInterval(timer);
      }
    }, 300);

    window.GOODJUNK_MOBILE_COOLDOWN_RETURN_CHECK = function(){
      const snap = {
        patch: PATCH,
        href: location.href,
        launcherUrl: launcherUrl(),
        cooldownUrl: cooldownUrl({reason:'manual-check'}),
        cooldownControls: Array.from(document.querySelectorAll('[data-go-cooldown="1"]')).map(function(el){
          return {
            id: el.id || '',
            text: textOf(el),
            tag: el.tagName || ''
          };
        }),
        badHtmLinks: Array.from(document.querySelectorAll('a[href*="goodjunk-launcher.htm"]')).map(function(a){
          return a.getAttribute('href');
        })
      };

      console.log('[GOODJUNK_MOBILE_COOLDOWN_RETURN_CHECK]', snap);
      return snap;
    };

    console.info('[GoodJunk Mobile Cooldown Return Final]', PATCH, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }
})();
