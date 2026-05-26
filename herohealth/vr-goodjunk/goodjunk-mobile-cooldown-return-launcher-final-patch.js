/* =========================================================
   GOODJUNK MOBILE COOLDOWN RETURN LAUNCHER FINAL PATCH
   FILE: /herohealth/vr-goodjunk/goodjunk-mobile-cooldown-return-launcher-final-patch.js
   PATCH: v20260526-GOODJUNK-MOBILE-COOLDOWN-RETURN-LAUNCHER-FINAL
   PURPOSE:
   - Mobile/PC หลังจบเกม → Cooldown → กลับ goodjunk-launcher.html เท่านั้น
   - override URL ที่ยังพากลับ Nutrition Zone / Hub ผิด
========================================================= */

(function(){
  'use strict';

  if (window.__GJ_MOBILE_COOLDOWN_RETURN_LAUNCHER_FINAL__) return;
  window.__GJ_MOBILE_COOLDOWN_RETURN_LAUNCHER_FINAL__ = true;

  const PATCH = 'v20260526-GOODJUNK-MOBILE-COOLDOWN-RETURN-LAUNCHER-FINAL';

  const CANONICAL = {
    launcher: 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html',
    warmupGate: 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html',
    hub: 'https://supparang.github.io/webxr-health-mobile/herohealth/hub-v2.html'
  };

  const qs = new URLSearchParams(location.search || '');

  function q(k, fallback){
    const v = qs.get(k);
    return v === null || v === '' ? fallback : v;
  }

  function playerName(){
    return q('name', q('nick', 'Hero'));
  }

  function launcherUrl(){
    return CANONICAL.launcher;
  }

  function buildCooldownUrl(extra){
    extra = extra || {};

    const p = new URLSearchParams();

    p.set('zone', 'nutrition');
    p.set('cat', 'nutrition');
    p.set('game', 'goodjunk');
    p.set('gameId', 'goodjunk');
    p.set('mode', 'solo_boss');
    p.set('phase', 'cooldown');

    p.set('pid', q('pid', 'anon'));
    p.set('name', playerName());
    p.set('diff', q('diff', 'normal'));
    p.set('time', q('time', '90'));
    p.set('view', q('view', 'mobile'));

    /*
      สำคัญมาก:
      warmup-gate / cooldown gate บางเวอร์ชันอ่าน next, บางเวอร์ชันอ่าน back,
      บางเวอร์ชัน fallback ไป hub
      ดังนั้นล็อกทั้ง 4 ค่าให้เป็น launcher เหมือนกันหมด
    */
    p.set('next', launcherUrl());
    p.set('back', launcherUrl());
    p.set('hub', launcherUrl());
    p.set('launcher', launcherUrl());
    p.set('return', launcherUrl());

    if (extra.reason) p.set('reason', String(extra.reason));
    if (extra.score !== undefined) p.set('score', String(extra.score));
    if (extra.stars !== undefined) p.set('stars', String(extra.stars));
    if (extra.rank !== undefined) p.set('rank', String(extra.rank));

    p.set('v', 'goodjunk-mobile-cooldown-return-launcher-final');

    return CANONICAL.warmupGate + '?' + p.toString();
  }

  function goLauncher(){
    location.href = launcherUrl();
  }

  function goCooldown(extra){
    location.href = buildCooldownUrl(extra || {});
  }

  function patchShellApi(){
    const shell = window.GJ_SOLO_BOSS_SHELL;

    if (shell && !shell.__gjCooldownReturnLauncherFinal){
      shell.__gjCooldownReturnLauncherFinal = true;

      shell.buildGoodJunkLauncherUrl = launcherUrl;
      shell.safeBackUrl = launcherUrl;
      shell.buildCooldownUrl = buildCooldownUrl;
      shell.goGoodJunkLauncher = goLauncher;
      shell.goCooldown = goCooldown;

      if (shell.canonical){
        shell.canonical.goodjunkLauncher = launcherUrl();
      }
    }
  }

  function patchBackButton(){
    const btn = document.getElementById('shellBackBtn');

    if (!btn || btn.__gjCooldownReturnBackPatched) return;

    btn.__gjCooldownReturnBackPatched = true;
    btn.innerHTML = '🎮 กลับเลือกโหมด GoodJunk';

    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      goLauncher();
      return false;
    }, true);
  }

  function looksLikeCooldownButton(el){
    const t = String(el && el.textContent || '').replace(/\s+/g, ' ').trim();

    return (
      /cooldown/i.test(t) ||
      /คูลดาวน์/i.test(t) ||
      /ผ่อนคลาย/i.test(t) ||
      /กลับเลือกโหมด/i.test(t) ||
      /กลับโหมด/i.test(t) ||
      el.id === 'gjrZoneBtn' ||
      el.dataset && (
        el.dataset.goCooldown === '1' ||
        el.dataset.goCooldown === 'true'
      )
    );
  }

  function patchCooldownButtons(){
    document.querySelectorAll('button,a,[role="button"]').forEach(function(el){
      if (!looksLikeCooldownButton(el)) return;
      if (el.__gjCooldownReturnLauncherPatched) return;

      el.__gjCooldownReturnLauncherPatched = true;

      if (el.id === 'gjrZoneBtn'){
        el.innerHTML = '🧘 Cooldown แล้วกลับเลือกโหมด';
        el.dataset.goCooldown = '1';
      }

      if (el.tagName === 'A'){
        el.setAttribute('href', buildCooldownUrl({
          reason: 'anchor-patched'
        }));
      }

      el.addEventListener('click', function(ev){
        const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();

        if (
          /เล่นอีก|replay|retry/i.test(text) &&
          !/cooldown|คูลดาวน์|ผ่อนคลาย|กลับ/i.test(text)
        ){
          return;
        }

        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        goCooldown({
          reason: 'patched-cooldown-button'
        });

        return false;
      }, true);
    });
  }

  function patchRewardSummaryEvent(){
    if (window.__GJ_MOBILE_COOLDOWN_RETURN_EVENT_PATCHED__) return;
    window.__GJ_MOBILE_COOLDOWN_RETURN_EVENT_PATCHED__ = true;

    window.addEventListener('gj:reward-summary-shown', function(ev){
      const detail = ev && ev.detail ? ev.detail : {};

      setTimeout(function(){
        patchShellApi();
        patchCooldownButtons();

        try{
          localStorage.setItem('GJ_MOBILE_COOLDOWN_RETURN_LAUNCHER_LAST', JSON.stringify({
            patch: PATCH,
            cooldownUrl: buildCooldownUrl({
              reason: 'reward-summary-shown',
              score: detail.score,
              stars: detail.stars,
              rank: detail.rank
            }),
            finalReturn: launcherUrl(),
            detail: detail,
            savedAt: new Date().toISOString()
          }));
        }catch(_){}
      }, 50);
    });
  }

  function patchLocationAssignForWrongCooldown(){
    if (window.__GJ_MOBILE_LOCATION_ASSIGN_PATCHED__) return;
    window.__GJ_MOBILE_LOCATION_ASSIGN_PATCHED__ = true;

    /*
      ไม่ override location.href โดยตรง เพราะ browser ไม่อนุญาตปลอดภัย
      ใช้วิธี intercept click และ shell API แทน
    */
  }

  function boot(){
    patchShellApi();
    patchBackButton();
    patchCooldownButtons();
    patchRewardSummaryEvent();
    patchLocationAssignForWrongCooldown();

    let count = 0;
    const timer = setInterval(function(){
      count++;

      patchShellApi();
      patchBackButton();
      patchCooldownButtons();

      if (count > 7200){
        clearInterval(timer);
      }
    }, 300);

    window.GJ_MOBILE_COOLDOWN_RETURN_LAUNCHER_FINAL_CHECK = function(){
      const snap = {
        patch: PATCH,
        href: location.href,
        cooldownUrl: buildCooldownUrl({
          reason: 'check'
        }),
        launcherUrl: launcherUrl(),
        shellPatched: !!(
          window.GJ_SOLO_BOSS_SHELL &&
          window.GJ_SOLO_BOSS_SHELL.__gjCooldownReturnLauncherFinal
        ),
        cooldownButtons: Array.from(document.querySelectorAll('button,a,[role="button"]')).filter(function(el){
          return el.__gjCooldownReturnLauncherPatched;
        }).map(function(el){
          return {
            id: el.id || '',
            text: String(el.textContent || '').replace(/\s+/g, ' ').trim()
          };
        })
      };

      console.log('[GJ_MOBILE_COOLDOWN_RETURN_LAUNCHER_FINAL_CHECK]', snap);
      return snap;
    };

    try{
      localStorage.setItem('GJ_MOBILE_COOLDOWN_RETURN_LAUNCHER_BOOT', JSON.stringify({
        patch: PATCH,
        href: location.href,
        cooldownUrl: buildCooldownUrl({reason:'boot'}),
        launcherUrl: launcherUrl(),
        savedAt: new Date().toISOString()
      }));
    }catch(_){}

    console.info('[GoodJunk Mobile Cooldown Return Launcher Final]', PATCH, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }
})();
