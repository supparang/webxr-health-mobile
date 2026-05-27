/* =========================================================
   GOODJUNK MOBILE RETURN + COOLDOWN + POWERUPS SINGLE LOCK
   FILE: /herohealth/vr-goodjunk/goodjunk-mobile-return-cooldown-powerups-final-single.js
   PATCH: v20260526-GOODJUNK-MOBILE-RETURN-COOLDOWN-POWERUPS-FINAL-SINGLE
   PURPOSE:
   - Mobile/PC Solo Boss กลับหน้าเลือกโหมด GoodJunk ให้ถูก
   - Cooldown next/back/launcher ต้องไป goodjunk-launcher.html
   - ส่ง summary params ไป warmup-gate ให้ครบที่สุดเท่าที่หาได้
   - ทำให้ powerups กดแล้วมี feedback ชัด
   - รวม patch หลายตัวให้เหลือตัวเดียว ลดการ override กันเอง
========================================================= */
(function(){
  'use strict';

  if (window.__GJ_MOBILE_RETURN_COOLDOWN_POWERUPS_FINAL_SINGLE__) return;
  window.__GJ_MOBILE_RETURN_COOLDOWN_POWERUPS_FINAL_SINGLE__ = true;

  const PATCH = 'v20260526-GOODJUNK-MOBILE-RETURN-COOLDOWN-POWERUPS-FINAL-SINGLE';
  const qs = new URLSearchParams(location.search || '');

  const URLS = {
    launcher: 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html',
    warmupGate: 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html',
    hub: 'https://supparang.github.io/webxr-health-mobile/herohealth/hub-v2.html'
  };

  function q(k, fallback){
    const v = qs.get(k);
    return v === null || v === '' ? fallback : v;
  }

  function playerName(){
    return q('name', q('nick', 'Hero'));
  }

  function launcherUrl(){
    const u = new URL(URLS.launcher);
    u.searchParams.set('pid', q('pid', 'anon'));
    u.searchParams.set('name', playerName());
    u.searchParams.set('diff', q('diff', 'normal'));
    u.searchParams.set('time', q('time', '90'));
    u.searchParams.set('view', q('view', 'mobile'));

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'mobile-solo-boss');
    u.searchParams.set('theme', 'goodjunk');

    u.searchParams.set('v', 'mobile-return-final-single');
    return u.href;
  }

  function readJson(keys){
    for (const key of keys){
      try{
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') return data;
      }catch(_){}
    }
    return {};
  }

  function normalizeSummary(input){
    input = input || {};

    const latest = readJson([
      'GJ_SOLO_BOSS_LAST_SUMMARY',
      'GJ_SOLO_BOSS_REWARD_LAST',
      'GJ_REWARD_LAST_SUMMARY',
      'GJ_FULL_3D_VR_LAST_SUMMARY'
    ]);

    const s = Object.assign({}, latest, input);

    return {
      score: s.score ?? s.totalScore ?? q('score', '0'),
      stars: s.stars ?? s.star ?? q('stars', ''),
      rank: s.rank ?? s.rankTitle ?? q('rank', ''),
      accuracy: s.accuracy ?? s.acc ?? q('accuracy', q('acc', '')),
      goodHits: s.goodHits ?? s.good ?? s.goodCount ?? q('goodHits', q('good', '')),
      junkHits: s.junkHits ?? s.junk ?? s.junkCount ?? q('junkHits', q('junk', '')),
      fakeHits: s.fakeHits ?? s.fake ?? s.fakeCount ?? q('fakeHits', q('fake', '')),
      miss: s.miss ?? s.misses ?? s.watchOut ?? q('miss', q('misses', '0')),
      bestCombo: s.bestCombo ?? s.combo ?? s.maxCombo ?? q('bestCombo', q('combo', '')),
      coins: s.coins ?? q('coins', ''),
      badge: s.badge ?? s.badgeTitle ?? q('badge', ''),
      missionDone: s.missionDone ?? s.mission ?? s.completedMissions ?? q('missionDone', q('mission', ''))
    };
  }

  function cooldownUrl(extra){
    const summary = normalizeSummary(extra || {});
    const back = launcherUrl();

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
    keep.set('time', q('time', '60'));
    keep.set('view', q('view', 'mobile'));

    keep.set('hub', back);
    keep.set('next', back);
    keep.set('back', back);
    keep.set('launcher', back);
    keep.set('return', back);

    keep.set('score', String(summary.score || 0));
    keep.set('miss', String(summary.miss || 0));

    if (summary.stars !== '') keep.set('stars', String(summary.stars));
    if (summary.rank !== '') keep.set('rank', String(summary.rank));
    if (summary.accuracy !== '') keep.set('accuracy', String(summary.accuracy));
    if (summary.goodHits !== '') keep.set('goodHits', String(summary.goodHits));
    if (summary.junkHits !== '') keep.set('junkHits', String(summary.junkHits));
    if (summary.fakeHits !== '') keep.set('fakeHits', String(summary.fakeHits));
    if (summary.bestCombo !== '') keep.set('bestCombo', String(summary.bestCombo));
    if (summary.coins !== '') keep.set('coins', String(summary.coins));
    if (summary.badge !== '') keep.set('badge', String(summary.badge));
    if (summary.missionDone !== '') keep.set('missionDone', String(summary.missionDone));

    keep.set('reason', String((extra && extra.reason) || 'mobile-summary-cooldown'));
    keep.set('from', 'goodjunk-solo-boss-mobile');
    keep.set('v', '20260526-final-single');

    return URLS.warmupGate + '?' + keep.toString();
  }

  function goLauncher(){
    location.href = launcherUrl();
  }

  function goCooldown(extra){
    const url = cooldownUrl(extra || {});
    try{
      localStorage.setItem('GJ_MOBILE_COOLDOWN_FINAL_SINGLE_LAST', JSON.stringify({
        patch: PATCH,
        cooldownUrl: url,
        launcherUrl: launcherUrl(),
        summary: normalizeSummary(extra || {}),
        savedAt: new Date().toISOString()
      }));
    }catch(_){}
    location.href = url;
  }

  function toast(text){
    let t = document.getElementById('gjMobileSingleToast');
    if (!t){
      t = document.createElement('div');
      t.id = 'gjMobileSingleToast';
      t.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:calc(92px + env(safe-area-inset-bottom,0px))',
        'transform:translateX(-50%)',
        'z-index:2147483000',
        'width:min(430px,calc(100vw - 28px))',
        'padding:11px 14px',
        'border-radius:999px',
        'background:rgba(15,23,42,.88)',
        'color:#fff',
        'font-size:13px',
        'font-weight:1000',
        'text-align:center',
        'box-shadow:0 16px 34px rgba(15,23,42,.28)',
        'opacity:0',
        'pointer-events:none',
        'transition:opacity .18s ease'
      ].join(';');
      document.body.appendChild(t);
    }

    t.textContent = text;
    t.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function(){
      t.style.opacity = '0';
    }, 1300);
  }

  function savePowerupUse(type){
    try{
      const key = 'GJ_MOBILE_POWERUP_USE_LAST';
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      data[type] = Number(data[type] || 0) + 1;
      data.lastType = type;
      data.patch = PATCH;
      data.savedAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(data));
    }catch(_){}
  }

  function activatePowerupFromCard(card){
    if (!card) return false;

    const text = String(card.textContent || '').toLowerCase();
    let type = '';

    if (text.includes('shield')) type = 'shield';
    else if (text.includes('magnet')) type = 'magnet';
    else if (text.includes('fever')) type = 'fever';

    if (!type) return false;

    card.classList.add('on');
    card.setAttribute('data-gj-powerup-active', '1');
    savePowerupUse(type);

    if (type === 'shield') toast('🛡️ Shield พร้อมใช้ / เปิดใช้แล้ว');
    if (type === 'magnet') toast('🧲 Magnet พร้อมใช้ / เปิดใช้แล้ว');
    if (type === 'fever') toast('⚡ Fever พร้อมใช้ / เปิดใช้แล้ว');

    try{
      window.dispatchEvent(new CustomEvent('gj:mobile-powerup-activate', {
        detail: { type: type, patch: PATCH }
      }));
    }catch(_){}

    return true;
  }

  function patchPowerups(){
    document.addEventListener('click', function(ev){
      const card = ev.target && ev.target.closest
        ? ev.target.closest('.gjpu-card,[data-powerup],[data-gj-powerup]')
        : null;

      if (!card) return;

      if (activatePowerupFromCard(card)){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }
    }, true);
  }

  function patchSummaryEvent(){
    window.addEventListener('gj:reward-summary-shown', function(ev){
      const summary = ev && ev.detail ? ev.detail : {};
      const normalized = normalizeSummary(summary);

      try{
        localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify(Object.assign({}, normalized, {
          patch: PATCH,
          savedAt: new Date().toISOString()
        })));
      }catch(_){}

      setTimeout(function(){
        const btn = document.getElementById('gjrZoneBtn');
        if (!btn) return;

        btn.innerHTML = '🧘 Cooldown แล้วกลับเลือกโหมด';
        btn.setAttribute('aria-label', 'ไป Cooldown แล้วกลับหน้าเลือกโหมด GoodJunk');
        btn.setAttribute('data-go-cooldown', '1');
      }, 40);
    });
  }

  function patchCooldownButtons(){
    document.addEventListener('click', function(ev){
      const target = ev.target && ev.target.closest
        ? ev.target.closest('#gjrZoneBtn,[data-go-cooldown="1"]')
        : null;

      if (!target) return;

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      goCooldown({ reason:'summary-button' });
    }, true);
  }

  function patchBackButtons(){
    const btn = document.getElementById('shellBackBtn');
    if (btn && !btn.__gjMobileSingleBack){
      btn.__gjMobileSingleBack = true;
      btn.innerHTML = '🎮 กลับเลือกโหมด GoodJunk';
      btn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        goLauncher();
      }, true);
    }

    document.addEventListener('click', function(ev){
      const target = ev.target && ev.target.closest
        ? ev.target.closest('[data-go-launcher="1"],[data-back-launcher="1"]')
        : null;

      if (!target) return;

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      goLauncher();
    }, true);
  }

  function expose(){
    window.GJ_MOBILE_RETURN_COOLDOWN_POWERUPS_FINAL_SINGLE = {
      patch: PATCH,
      launcherUrl: launcherUrl,
      cooldownUrl: cooldownUrl,
      goLauncher: goLauncher,
      goCooldown: goCooldown,
      normalizeSummary: normalizeSummary
    };

    window.GJ_MOBILE_FINAL_SINGLE_CHECK = function(){
      const snap = {
        patch: PATCH,
        launcherUrl: launcherUrl(),
        cooldownUrl: cooldownUrl({ reason:'check' }),
        latestSummary: normalizeSummary({}),
        hasRewardButton: !!document.getElementById('gjrZoneBtn'),
        powerupCards: Array.from(document.querySelectorAll('.gjpu-card,[data-powerup],[data-gj-powerup]')).map(function(n){
          return {
            text: String(n.textContent || '').replace(/\s+/g, ' ').trim(),
            active: n.classList.contains('on') || n.getAttribute('data-gj-powerup-active') === '1'
          };
        })
      };

      console.log('[GJ_MOBILE_FINAL_SINGLE_CHECK]', snap);
      return snap;
    };
  }

  function boot(){
    patchBackButtons();
    patchSummaryEvent();
    patchCooldownButtons();
    patchPowerups();
    expose();

    let count = 0;
    const timer = setInterval(function(){
      count++;
      patchBackButtons();

      const btn = document.getElementById('gjrZoneBtn');
      if (btn){
        btn.innerHTML = '🧘 Cooldown แล้วกลับเลือกโหมด';
        btn.setAttribute('data-go-cooldown', '1');
      }

      if (count > 240) clearInterval(timer);
    }, 500);

    console.info('[GoodJunk Mobile Final Single]', PATCH, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
