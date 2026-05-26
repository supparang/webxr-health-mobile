/* =========================================================
   GOODJUNK MOBILE COOLDOWN RETURN LOCK
   PATCH: v20260526-GOODJUNK-MOBILE-COOLDOWN-RETURN-LOCK-FINAL
   FILE: /herohealth/vr-goodjunk/goodjunk-mobile-cooldown-return-lock.js

   PURPOSE:
   - Mobile/PC Solo Boss ต้องกลับจาก cooldown ไปหน้าเลือกโหมด GoodJunk เท่านั้น
   - Target final:
     https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html
   - แก้กรณีถูก hub / next / back / global nav patch พากลับผิด
========================================================= */

(function(){
  'use strict';

  if (window.__GJ_MOBILE_COOLDOWN_RETURN_LOCK_FINAL__) return;
  window.__GJ_MOBILE_COOLDOWN_RETURN_LOCK_FINAL__ = true;

  const PATCH = 'v20260526-GOODJUNK-MOBILE-COOLDOWN-RETURN-LOCK-FINAL';

  const GOODJUNK_LAUNCHER =
    'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';

  const HUB_V2 =
    'https://supparang.github.io/webxr-health-mobile/herohealth/hub-v2.html';

  const WARMUP_GATE =
    'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html';

  const qs = new URLSearchParams(location.search || '');

  function q(name, fallback){
    const v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function playerName(){
    return q('name', q('nick', 'Hero'));
  }

  function isGoodJunkMobileRun(){
    const path = location.pathname || '';
    const view = String(q('view', '')).toLowerCase();

    return (
      /\/herohealth\/vr-goodjunk\/goodjunk-solo-boss\.html$/i.test(path) ||
      (
        /goodjunk-solo-boss/i.test(path) &&
        (view === 'mobile' || view === 'pc' || view === '')
      )
    );
  }

  function buildGoodJunkLauncherUrl(){
    const u = new URL(GOODJUNK_LAUNCHER);

    u.searchParams.set('pid', q('pid', 'anon'));
    u.searchParams.set('name', playerName());
    u.searchParams.set('diff', q('diff', 'normal'));
    u.searchParams.set('time', q('time', '120'));
    u.searchParams.set('view', q('view', 'mobile'));

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo_boss');
    u.searchParams.set('entry', 'solo_boss_mobile');
    u.searchParams.set('hub', HUB_V2);

    u.searchParams.set('returnLock', 'goodjunk-launcher');
    u.searchParams.set('v', 'mobile-return-lock-final');

    return u.href;
  }

  function buildCooldownGateUrl(extra){
    extra = extra || {};

    const back = buildGoodJunkLauncherUrl();

    const keep = new URLSearchParams();

    keep.set('zone', 'nutrition');
    keep.set('cat', 'nutrition');
    keep.set('gameId', 'goodjunk');
    keep.set('game', 'goodjunk');
    keep.set('mode', 'solo_boss');
    keep.set('entry', 'solo_boss_mobile');
    keep.set('phase', 'cooldown');

    keep.set('pid', q('pid', 'anon'));
    keep.set('name', playerName());
    keep.set('diff', q('diff', 'normal'));
    keep.set('time', q('time', '120'));
    keep.set('view', q('view', 'mobile'));

    /*
      สำคัญมาก:
      warmup-gate ใช้ next/back/hub หลายจุด
      ดังนั้นล็อกทั้ง 3 ค่าเป็น goodjunk-launcher.html
    */
    keep.set('next', back);
    keep.set('back', back);
    keep.set('hub', back);
    keep.set('launcher', back);
    keep.set('return', back);

    keep.set('returnLock', 'goodjunk-launcher');
    keep.set('from', 'goodjunk-mobile-solo-boss');

    if (extra.reason) keep.set('reason', String(extra.reason));
    if (extra.score !== undefined) keep.set('score', String(extra.score));
    if (extra.stars !== undefined) keep.set('stars', String(extra.stars));
    if (extra.rank !== undefined) keep.set('rank', String(extra.rank));

    return WARMUP_GATE + '?' + keep.toString();
  }

  function goLauncher(){
    location.href = buildGoodJunkLauncherUrl();
  }

  function goCooldown(extra){
    location.href = buildCooldownGateUrl(extra || {});
  }

  function patchShellApi(){
    const shell = window.GJ_SOLO_BOSS_SHELL;
    if (!shell || shell.__mobileCooldownReturnLockFinal) return;

    shell.__mobileCooldownReturnLockFinal = true;

    shell.canonical = shell.canonical || {};
    shell.canonical.goodjunkLauncher = GOODJUNK_LAUNCHER;
    shell.canonical.gateMainHub = HUB_V2;
    shell.canonical.warmupGate = WARMUP_GATE;

    shell.buildGoodJunkLauncherUrl = buildGoodJunkLauncherUrl;
    shell.safeBackUrl = buildGoodJunkLauncherUrl;
    shell.buildCooldownUrl = buildCooldownGateUrl;
    shell.goGoodJunkLauncher = goLauncher;
    shell.goCooldown = goCooldown;

    try{
      localStorage.setItem('GJ_MOBILE_COOLDOWN_RETURN_LOCK_SHELL_PATCHED', JSON.stringify({
        patch: PATCH,
        launcherUrl: buildGoodJunkLauncherUrl(),
        cooldownUrl: buildCooldownGateUrl({ reason:'shell-patched' }),
        savedAt: new Date().toISOString()
      }));
    }catch(_){}
  }

  function patchBackButton(){
    const btn = document.getElementById('shellBackBtn');
    if (!btn || btn.__gjMobileReturnLockBack) return;

    btn.__gjMobileReturnLockBack = true;
    btn.innerHTML = '🎮 กลับเลือกโหมด GoodJunk';

    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      goLauncher();
      return false;
    }, true);
  }

  function patchRewardCooldownButton(){
    /*
      ปุ่ม summary เดิมอาจถูก reward/global patch แก้เป็นกลับ zone หรือ hub
      ตรงนี้บังคับให้ปุ่มไป cooldown และหลัง cooldown กลับ goodjunk-launcher.html
    */
    const candidates = [
      '#gjrZoneBtn',
      '#cooldownBtn',
      '[data-go-cooldown="1"]',
      '[data-gj-go-cooldown="1"]'
    ];

    candidates.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(btn){
        if (!btn || btn.__gjMobileReturnLockCooldown) return;

        btn.__gjMobileReturnLockCooldown = true;
        btn.dataset.goCooldown = '1';
        btn.dataset.gjMobileReturnLock = PATCH;

        const text = String(btn.textContent || '');

        if (
          /zone|โซน|กลับ|nutrition|hub/i.test(text) ||
          btn.id === 'gjrZoneBtn' ||
          btn.id === 'cooldownBtn'
        ){
          btn.innerHTML = '🧘 Cooldown แล้วกลับเลือกโหมด';
        }

        btn.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

          const summary = readLastSummary();

          goCooldown({
            reason: 'mobile-summary-cooldown-button',
            score: summary.score,
            stars: summary.stars,
            rank: summary.rank
          });

          return false;
        }, true);
      });
    });
  }

  function patchLauncherButtons(){
    const selectors = [
      '#launcherBtn',
      '#finalLauncherBtn',
      '[data-go-launcher="1"]',
      '[data-gj-go-launcher="1"]'
    ];

    selectors.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(btn){
        if (!btn || btn.__gjMobileReturnLockLauncher) return;

        btn.__gjMobileReturnLockLauncher = true;
        btn.dataset.gjMobileReturnLock = PATCH;

        btn.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

          goLauncher();
          return false;
        }, true);
      });
    });
  }

  function readLastSummary(){
    const fallback = { score:'', stars:'', rank:'' };

    const keys = [
      'GJ_SOLO_BOSS_LAST_SUMMARY',
      'GJ_REWARD_LAST_SUMMARY',
      'GJ_FULL_3D_VR_LAST_SUMMARY'
    ];

    for (const key of keys){
      try{
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const data = JSON.parse(raw);

        return {
          score: data.score !== undefined ? data.score : '',
          stars: data.stars !== undefined ? data.stars : '',
          rank: data.rank !== undefined ? data.rank : ''
        };
      }catch(_){}
    }

    return fallback;
  }

  function patchSummaryEvent(){
    if (window.__GJ_MOBILE_COOLDOWN_RETURN_LOCK_EVENT__) return;
    window.__GJ_MOBILE_COOLDOWN_RETURN_LOCK_EVENT__ = true;

    window.addEventListener('gj:reward-summary-shown', function(ev){
      const summary = ev && ev.detail ? ev.detail : {};

      setTimeout(function(){
        patchRewardCooldownButton();
        patchLauncherButtons();

        try{
          localStorage.setItem('GJ_MOBILE_COOLDOWN_RETURN_LOCK_LAST_SUMMARY', JSON.stringify({
            patch: PATCH,
            summary: summary,
            launcherUrl: buildGoodJunkLauncherUrl(),
            cooldownUrl: buildCooldownGateUrl({
              reason: 'reward-summary-shown',
              score: summary.score,
              stars: summary.stars,
              rank: summary.rank
            }),
            savedAt: new Date().toISOString()
          }));
        }catch(_){}
      }, 30);
    }, true);
  }

  function patchDocumentClickHardLock(){
    if (window.__GJ_MOBILE_COOLDOWN_RETURN_LOCK_CLICK__) return;
    window.__GJ_MOBILE_COOLDOWN_RETURN_LOCK_CLICK__ = true;

    document.addEventListener('click', function(ev){
      const target = ev.target && ev.target.closest
        ? ev.target.closest(
            '#gjrZoneBtn,#cooldownBtn,[data-go-cooldown="1"],[data-gj-go-cooldown="1"]'
          )
        : null;

      if (!target) return;

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      const summary = readLastSummary();

      goCooldown({
        reason: 'document-hard-lock',
        score: summary.score,
        stars: summary.stars,
        rank: summary.rank
      });

      return false;
    }, true);
  }

  function normalizeBadCurrentQuery(){
    /*
      ถ้ามีการเปิด mobile run ด้วย hub/back/next ที่ผิด ให้ replaceState เฉย ๆ
      ไม่ redirect ทันที เพื่อไม่รบกวน gameplay
    */
    try{
      const live = new URL(location.href);
      let changed = false;

      const lockedLauncher = buildGoodJunkLauncherUrl();

      ['back','launcher','return'].forEach(function(k){
        const v = live.searchParams.get(k);

        if (!v || !/goodjunk-launcher\.html/i.test(v)){
          live.searchParams.set(k, lockedLauncher);
          changed = true;
        }
      });

      /*
        hub ใน mobile run ให้เป็น hub-v2 ได้
        แต่ตอน cooldown จะบังคับ hub เป็น launcher
      */
      if (!live.searchParams.get('hub')){
        live.searchParams.set('hub', HUB_V2);
        changed = true;
      }

      live.searchParams.set('zone', 'nutrition');
      live.searchParams.set('cat', 'nutrition');
      live.searchParams.set('game', 'goodjunk');
      live.searchParams.set('gameId', 'goodjunk');

      if (!live.searchParams.get('mode')){
        live.searchParams.set('mode', 'solo_boss');
        changed = true;
      }

      if (changed){
        history.replaceState(null, '', live.pathname + '?' + live.searchParams.toString() + live.hash);
      }
    }catch(_){}
  }

  function saveBootCheck(){
    try{
      localStorage.setItem('GJ_MOBILE_COOLDOWN_RETURN_LOCK_BOOT', JSON.stringify({
        patch: PATCH,
        href: location.href,
        isGoodJunkMobileRun: isGoodJunkMobileRun(),
        launcherUrl: buildGoodJunkLauncherUrl(),
        cooldownUrl: buildCooldownGateUrl({ reason:'boot-check' }),
        savedAt: new Date().toISOString()
      }));
    }catch(_){}
  }

  function tick(){
    patchShellApi();
    patchBackButton();
    patchRewardCooldownButton();
    patchLauncherButtons();
  }

  function boot(){
    if (!isGoodJunkMobileRun()){
      /*
        กันไม่ให้ patch นี้ไปยุ่งกับ cVR หรือไฟล์อื่น
      */
      return;
    }

    normalizeBadCurrentQuery();
    patchShellApi();
    patchBackButton();
    patchRewardCooldownButton();
    patchLauncherButtons();
    patchSummaryEvent();
    patchDocumentClickHardLock();
    saveBootCheck();

    let count = 0;
    const timer = setInterval(function(){
      count++;
      tick();

      if (count > 900){
        clearInterval(timer);
      }
    }, 250);

    window.GJ_MOBILE_COOLDOWN_RETURN_LOCK_CHECK = function(){
      const snap = {
        patch: PATCH,
        href: location.href,
        launcherUrl: buildGoodJunkLauncherUrl(),
        cooldownUrl: buildCooldownGateUrl({ reason:'manual-check' }),
        shellPatched: !!(
          window.GJ_SOLO_BOSS_SHELL &&
          window.GJ_SOLO_BOSS_SHELL.__mobileCooldownReturnLockFinal
        ),
        backButtonPatched: !!(
          document.getElementById('shellBackBtn') &&
          document.getElementById('shellBackBtn').__gjMobileReturnLockBack
        ),
        rewardButton: (function(){
          const b = document.getElementById('gjrZoneBtn') || document.getElementById('cooldownBtn');
          return b ? {
            id: b.id,
            text: b.textContent,
            patched: !!b.__gjMobileReturnLockCooldown,
            dataset: Object.assign({}, b.dataset || {})
          } : null;
        })()
      };

      console.log('[GJ_MOBILE_COOLDOWN_RETURN_LOCK_CHECK]', snap);
      return snap;
    };

    console.info('[GoodJunk Mobile Cooldown Return Lock]', PATCH, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
