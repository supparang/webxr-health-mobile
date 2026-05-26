// === /herohealth/vr-goodjunk/goodjunk-mobile-return-to-launcher-final-patch.js ===
// PATCH v20260526-GOODJUNK-PC-MOBILE-RETURN-LAUNCHER-FINAL
// Purpose:
// - For /herohealth/vr-goodjunk/goodjunk-solo-boss.html only
// - PC/Mobile Solo Boss must return to /herohealth/goodjunk-launcher.html
// - Cooldown gate must return to GoodJunk launcher, not Nutrition Zone
// - Does NOT affect cVR file: goodjunk-solo-boss-vr-flow.html

(function(){
  'use strict';

  if (window.__GJ_PC_MOBILE_RETURN_LAUNCHER_FINAL__) return;
  window.__GJ_PC_MOBILE_RETURN_LAUNCHER_FINAL__ = true;

  const PATCH = 'v20260526-GOODJUNK-PC-MOBILE-RETURN-LAUNCHER-FINAL';

  const CANONICAL = {
    launcher: 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html',
    nutritionZone: 'https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html',
    hub: 'https://supparang.github.io/webxr-health-mobile/herohealth/hub-v2.html',
    warmupGate: 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html'
  };

  const qs = new URLSearchParams(location.search || '');

  function q(key, fallback){
    const v = qs.get(key);
    return v === null || v === '' ? fallback : v;
  }

  function playerName(){
    return q('name', q('nick', 'Hero'));
  }

  function isCvr(){
    const view = String(q('view', '')).toLowerCase();
    const entry = String(q('entry', '')).toLowerCase();
    const device = String(q('device', '')).toLowerCase();

    return (
      view === 'cvr' ||
      view === 'cardboard' ||
      view === 'vr' ||
      entry === 'cardboard' ||
      device === 'cardboard'
    );
  }

  function buildLauncherUrl(extra){
    const u = new URL(CANONICAL.launcher);

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
    u.searchParams.set('entry', q('entry', 'solo_boss'));
    u.searchParams.set('hub', CANONICAL.hub);

    if (extra && typeof extra === 'object'){
      Object.keys(extra).forEach(function(k){
        if (extra[k] !== undefined && extra[k] !== null && extra[k] !== ''){
          u.searchParams.set(k, String(extra[k]));
        }
      });
    }

    return u.href;
  }

  function buildCooldownUrl(extra){
    const keep = new URLSearchParams();

    keep.set('zone', 'nutrition');
    keep.set('cat', 'nutrition');
    keep.set('game', 'goodjunk');
    keep.set('gameId', 'goodjunk');
    keep.set('mode', q('mode', 'solo_boss'));
    keep.set('phase', 'cooldown');

    keep.set('pid', q('pid', 'anon'));
    keep.set('name', playerName());
    keep.set('diff', q('diff', 'normal'));
    keep.set('time', q('time', '120'));
    keep.set('view', q('view', 'mobile'));

    keep.set('hub', CANONICAL.hub);

    // จุดสำคัญ: หลัง cooldown ต้องกลับหน้าเลือกโหมด GoodJunk
    keep.set('next', buildLauncherUrl({ from: 'cooldown-done' }));
    keep.set('back', buildLauncherUrl({ from: 'cooldown-back' }));
    keep.set('launcher', buildLauncherUrl({ from: 'cooldown-launcher' }));

    if (extra && typeof extra === 'object'){
      Object.keys(extra).forEach(function(k){
        if (extra[k] !== undefined && extra[k] !== null && extra[k] !== ''){
          keep.set(k, String(extra[k]));
        }
      });
    }

    return CANONICAL.warmupGate + '?' + keep.toString();
  }

  function goLauncher(reason){
    try{
      localStorage.setItem('GJ_PC_MOBILE_RETURN_LAST', JSON.stringify({
        patch: PATCH,
        reason: String(reason || 'go-launcher'),
        returnUrl: buildLauncherUrl({ from: reason || 'go-launcher' }),
        href: location.href,
        savedAt: new Date().toISOString()
      }));
    }catch(_){}

    location.href = buildLauncherUrl({ from: reason || 'go-launcher' });
  }

  function goCooldown(reason, summary){
    summary = summary || {};

    try{
      localStorage.setItem('GJ_PC_MOBILE_COOLDOWN_TARGET_LAST', JSON.stringify({
        patch: PATCH,
        reason: String(reason || 'cooldown'),
        cooldownUrl: buildCooldownUrl({
          reason: reason || 'cooldown',
          score: summary.score,
          stars: summary.stars,
          rank: summary.rank
        }),
        expectedAfterCooldown: buildLauncherUrl({ from: 'after-cooldown' }),
        href: location.href,
        savedAt: new Date().toISOString()
      }));
    }catch(_){}

    location.href = buildCooldownUrl({
      reason: reason || 'cooldown',
      score: summary.score,
      stars: summary.stars,
      rank: summary.rank
    });
  }

  function patchBackButton(){
    const btn = document.getElementById('shellBackBtn');
    if (!btn || btn.__gjReturnLauncherPatched) return;

    btn.__gjReturnLauncherPatched = true;
    btn.innerHTML = '🎮 กลับเลือกโหมด GoodJunk';
    btn.setAttribute('aria-label', 'กลับหน้าเลือกโหมด GoodJunk');

    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      goLauncher('shell-back');
      return false;
    }, true);
  }

  function patchKnownButtons(){
    const launcherWords = [
      'กลับเลือกโหมด',
      'เลือกโหมด',
      'โหมดเกม',
      'GoodJunk',
      'launcher',
      'mode'
    ];

    const cooldownWords = [
      'Cooldown',
      'cooldown',
      'คูลดาวน์',
      'ทำ cooldown',
      'ทำ 3D Cooldown',
      'กลับ Zone',
      'กลับโซน',
      'Nutrition Zone'
    ];

    document.querySelectorAll('button,a,[role="button"],.btn').forEach(function(el){
      if (!el || el.__gjMobileReturnTextPatched) return;

      const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();

      const shouldLauncher = launcherWords.some(function(w){
        return text.toLowerCase().includes(String(w).toLowerCase());
      });

      const shouldCooldown = cooldownWords.some(function(w){
        return text.toLowerCase().includes(String(w).toLowerCase());
      });

      if (shouldCooldown && el.id !== 'shellBackBtn'){
        el.__gjMobileReturnTextPatched = true;

        if (el.tagName === 'A'){
          el.setAttribute('href', buildCooldownUrl({ reason: 'button-link' }));
        }

        el.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

          goCooldown('summary-cooldown-button');
          return false;
        }, true);

        return;
      }

      if (shouldLauncher){
        el.__gjMobileReturnTextPatched = true;

        if (el.tagName === 'A'){
          el.setAttribute('href', buildLauncherUrl({ from: 'text-link' }));
        }

        el.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

          goLauncher('text-button');
          return false;
        }, true);
      }
    });
  }

  function patchRewardSummaryEvent(){
    if (window.__GJ_PC_MOBILE_REWARD_EVENT_PATCHED__) return;
    window.__GJ_PC_MOBILE_REWARD_EVENT_PATCHED__ = true;

    window.addEventListener('gj:reward-summary-shown', function(ev){
      const summary = ev && ev.detail ? ev.detail : {};

      setTimeout(function(){
        const btn = document.getElementById('gjrZoneBtn');
        if (!btn) return;

        btn.innerHTML = '🧘 Cooldown แล้วกลับเลือกโหมด';
        btn.setAttribute('aria-label', 'ไป Cooldown แล้วกลับหน้าเลือกโหมด GoodJunk');
        btn.dataset.goCooldown = '1';

        btn.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();

          goCooldown('reward-summary-button', summary);
          return false;
        }, true);
      }, 50);
    });
  }

  function patchDirectCooldownClick(){
    document.addEventListener('click', function(ev){
      const target = ev.target && ev.target.closest
        ? ev.target.closest('#gjrZoneBtn,[data-go-cooldown="1"],[data-gj-cooldown="1"]')
        : null;

      if (!target) return;

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      goCooldown('direct-cooldown-click');
      return false;
    }, true);
  }

  function exposeApi(){
    window.GJ_PC_MOBILE_RETURN_PATCH = {
      patch: PATCH,
      isCvr: isCvr,
      launcherUrl: buildLauncherUrl,
      cooldownUrl: buildCooldownUrl,
      goLauncher: goLauncher,
      goCooldown: goCooldown,
      check: function(){
        const snap = {
          patch: PATCH,
          href: location.href,
          isCvr: isCvr(),
          launcherUrl: buildLauncherUrl({ from: 'check' }),
          cooldownUrl: buildCooldownUrl({ reason: 'check' }),
          shellBackPatched: !!(
            document.getElementById('shellBackBtn') &&
            document.getElementById('shellBackBtn').__gjReturnLauncherPatched
          ),
          gjrZoneBtn: !!document.getElementById('gjrZoneBtn'),
          savedAt: new Date().toISOString()
        };

        console.log('[GJ_PC_MOBILE_RETURN_PATCH_CHECK]', snap);
        return snap;
      }
    };
  }

  function boot(){
    if (isCvr()){
      console.info('[GoodJunk PC/Mobile Return Patch] skipped for cVR', PATCH);
      return;
    }

    patchBackButton();
    patchKnownButtons();
    patchRewardSummaryEvent();
    patchDirectCooldownClick();
    exposeApi();

    let count = 0;
    const timer = setInterval(function(){
      count++;

      patchBackButton();
      patchKnownButtons();

      if (count > 240){
        clearInterval(timer);
      }
    }, 500);

    console.info('[GoodJunk PC/Mobile Return Patch]', PATCH, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
