/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260521-groups-solo-start-button-fix-07
   File: /herohealth/patches/groups/07-groups-solo-start-button-fix.js

   Purpose:
   - Fix "เริ่มเล่น" button redirecting to Nutrition Zone
   - Force start button to start Groups Solo in-page
   - Block accidental hub/back/return navigation during start
   - Work with canonical run file:
     /herohealth/vr-groups/groups.html
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260521-groups-solo-start-button-fix-07';

  if (window.__HHA_GROUPS_SOLO_START_BUTTON_FIX__) return;
  window.__HHA_GROUPS_SOLO_START_BUTTON_FIX__ = true;

  const qs = new URLSearchParams(location.search);

  const BASE = 'https://supparang.github.io/webxr-health-mobile';
  const HERO = BASE + '/herohealth';
  const CANONICAL = HERO + '/vr-groups/groups.html';
  const ZONE = HERO + '/nutrition-zone.html';

  const state = {
    patch: PATCH_ID,
    startClicked: false,
    started: false,
    lastStartAt: 0,
    startCount: 0
  };

  window.HHA_GROUPS_SOLO_START_FIX = state;

  function getParam(name, fallback){
    const v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function normalizeView(){
    const raw = String(getParam('view', '')).toLowerCase();

    if (['pc','desktop'].includes(raw)) return 'pc';
    if (['mobile','phone','touch'].includes(raw)) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(raw)) return 'cvr';

    return isMobileUA() ? 'mobile' : 'pc';
  }

  function buildCurrentPlayUrl(extra){
    const out = new URL(CANONICAL);

    [
      'pid',
      'name',
      'studentId',
      'studentName',
      'classSection',
      'diff',
      'time',
      'view',
      'seed',
      'studyId',
      'conditionGroup',
      'api',
      'log',
      'hub',
      'back',
      'return',
      'returnTo',
      'qa',
      'debug',
      'teacher'
    ].forEach(function(k){
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('pid', getParam('pid', 'anon'));
    out.searchParams.set('name', getParam('name', 'Hero'));
    out.searchParams.set('diff', getParam('diff', 'normal'));
    out.searchParams.set('time', getParam('time', '90'));
    out.searchParams.set('view', normalizeView());
    out.searchParams.set('run', 'play');
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'groups');
    out.searchParams.set('gameId', 'groups');
    out.searchParams.set('mode', 'solo');
    out.searchParams.set('entry', getParam('entry', 'groups-solo-start-fix'));
    out.searchParams.set('theme', 'food-groups');

    if (!out.searchParams.get('seed')) {
      out.searchParams.set('seed', String(Date.now()));
    }

    const zoneUrl = buildZoneUrl();

    if (!out.searchParams.get('hub')) out.searchParams.set('hub', zoneUrl);
    if (!out.searchParams.get('back')) out.searchParams.set('back', zoneUrl);
    if (!out.searchParams.get('return')) out.searchParams.set('return', zoneUrl);
    if (!out.searchParams.get('returnTo')) out.searchParams.set('returnTo', zoneUrl);

    Object.entries(extra || {}).forEach(function(pair){
      const k = pair[0];
      const v = pair[1];

      if (v === null || v === undefined) out.searchParams.delete(k);
      else out.searchParams.set(k, String(v));
    });

    return out.toString();
  }

  function buildZoneUrl(){
    const out = new URL(ZONE);

    [
      'pid',
      'name',
      'studentId',
      'studentName',
      'classSection',
      'diff',
      'time',
      'view',
      'studyId',
      'conditionGroup',
      'api',
      'log'
    ].forEach(function(k){
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('pid', getParam('pid', 'anon'));
    out.searchParams.set('name', getParam('name', 'Hero'));
    out.searchParams.set('diff', getParam('diff', 'normal'));
    out.searchParams.set('time', getParam('time', '90'));
    out.searchParams.set('view', normalizeView());
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'groups');

    return out.toString();
  }

  function textOf(el){
    return String(el && (
      el.innerText ||
      el.textContent ||
      el.getAttribute('aria-label') ||
      el.value ||
      ''
    ) || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isSummaryVisible(){
    const t = String(document.body && document.body.innerText || '');

    return (
      t.includes('สรุปผลการเล่น') ||
      t.includes('เล่นอีกครั้ง') ||
      t.includes('กลับ Nutrition Zone') ||
      t.includes('Best Score')
    );
  }

  function isStartButton(el){
    if (!el) return false;

    const text = textOf(el);
    const href = String(el.getAttribute && el.getAttribute('href') || '');

    if (!text && !href) return false;

    const looksStart =
      text.includes('เริ่มเล่น') ||
      text.includes('เริ่มเกม') ||
      text.includes('Start') ||
      text.includes('Play') ||
      text.includes('เล่นเลย');

    const looksReplay =
      text.includes('เล่นอีกครั้ง') ||
      text.includes('Replay') ||
      text.includes('Play Again');

    const looksBack =
      text.includes('กลับ') ||
      text.includes('Nutrition Zone') ||
      text.includes('Hub') ||
      text.includes('HUB');

    const hrefLooksWrongZone =
      href.includes('/nutrition-zone.html') ||
      href.includes('/hub.html');

    if (isSummaryVisible()) return false;

    if (looksReplay) return false;
    if (looksBack) return false;

    return looksStart || (hrefLooksWrongZone && text.includes('เริ่ม'));
  }

  function addStyle(){
    if (document.getElementById('hha-groups-start-button-fix-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-start-button-fix-style';
    style.textContent = `
      .hha-groups-start-fixed{
        position:relative !important;
      }

      .hha-groups-start-fixed::after{
        content:"";
        position:absolute;
        inset:-8px;
        border-radius:inherit;
        pointer-events:none;
        box-shadow:0 0 0 4px rgba(126,217,87,.22);
        animation:hhaStartPulse 1.2s ease-in-out infinite;
      }

      @keyframes hhaStartPulse{
        0%,100%{ opacity:.45; transform:scale(1); }
        50%{ opacity:.95; transform:scale(1.035); }
      }

      body.hha-groups-starting .hha-groups-start-fixed{
        filter:brightness(1.05);
      }

      .hha-groups-start-toast{
        position:fixed;
        left:50%;
        bottom:calc(18px + env(safe-area-inset-bottom, 0px));
        transform:translateX(-50%) translateY(12px);
        z-index:999999;
        width:min(92vw, 520px);
        padding:11px 15px;
        border-radius:18px;
        background:rgba(21,48,74,.93);
        color:#fff;
        text-align:center;
        font:900 13px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 16px 36px rgba(0,0,0,.24);
        opacity:0;
        pointer-events:none;
        transition:.18s ease;
      }

      .hha-groups-start-toast.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }
    `;

    document.head.appendChild(style);
  }

  let toastBox = null;
  let toastTimer = null;

  function toast(message){
    addStyle();

    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'hha-groups-start-toast';
      document.body.appendChild(toastBox);
    }

    toastBox.textContent = message;
    toastBox.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){
      toastBox.classList.remove('show');
    }, 1700);

    try {
      window.dispatchEvent(new CustomEvent('hha:toast', {
        detail:{
          type:'info',
          message:message
        }
      }));
    } catch(e) {}
  }

  function callFunctionByName(name){
    try {
      const parts = name.split('.');
      let obj = window;

      for (let i = 0; i < parts.length - 1; i++) {
        obj = obj && obj[parts[i]];
      }

      const fn = obj && obj[parts[parts.length - 1]];

      if (typeof fn !== 'function') return false;

      console.info('[Groups Start Fix] calling', name);

      fn({
        source:'groups-start-button-fix',
        patch:PATCH_ID,
        run:'play',
        mode:'solo',
        view:normalizeView()
      });

      return true;
    } catch(err) {
      console.warn('[Groups Start Fix] function failed:', name, err);
      return false;
    }
  }

  function tryNativeStart(){
    const candidates = [
      'start',
      'startGame',
      'beginGame',
      'begin',
      'play',
      'startSolo',
      'startRun',
      'runGame',
      'launchGame',
      'HHA_GROUPS_START',
      'HHA_GROUPS_SOLO_START',
      'HHA.start',
      'HHA.startGame',
      'GroupsSolo.start',
      'GroupsGame.start',
      'HHA_GROUPS.start',
      'HHA_GROUPS_SOLO.start'
    ];

    for (const name of candidates) {
      if (callFunctionByName(name)) return true;
    }

    return false;
  }

  function dispatchStartEvents(){
    const detail = {
      source:'groups-start-button-fix',
      patch:PATCH_ID,
      run:'play',
      mode:'solo',
      game:'groups',
      gameId:'groups',
      zone:'nutrition',
      view:normalizeView(),
      pid:getParam('pid', 'anon'),
      name:getParam('name', 'Hero')
    };

    [
      'hha:start',
      'hha:game:start',
      'hha:groups:start',
      'hha:groups:solo:start',
      'groups:start',
      'groups:solo:start'
    ].forEach(function(name){
      try {
        window.dispatchEvent(new CustomEvent(name, { detail:detail }));
        document.dispatchEvent(new CustomEvent(name, { detail:detail }));
      } catch(e) {}
    });
  }

  function markStartState(){
    state.startClicked = true;
    state.started = true;
    state.lastStartAt = Date.now();
    state.startCount += 1;

    document.body.classList.add('hha-groups-starting');
    document.body.dataset.hhaRun = 'play';
    document.body.dataset.hhaMode = 'solo';
    document.body.dataset.hhaGame = 'groups';
    document.body.dataset.hhaView = normalizeView();

    try {
      sessionStorage.setItem('HHA_GROUPS_SOLO_START_CLICKED', JSON.stringify({
        patch:PATCH_ID,
        at:new Date().toISOString(),
        url:location.href,
        playUrl:buildCurrentPlayUrl()
      }));
    } catch(e) {}
  }

  function hideIntroFallback(){
    const bodyText = String(document.body && document.body.innerText || '');

    if (!bodyText.includes('แตะหรือ') && !bodyText.includes('เริ่มเล่น')) {
      return false;
    }

    const likelyCards = Array.from(document.querySelectorAll('main,section,article,div'))
      .map(function(el){
        const t = textOf(el);
        const r = el.getBoundingClientRect();
        return { el:el, text:t, area:r.width * r.height };
      })
      .filter(function(x){
        if (x.area < 30000) return false;

        return (
          x.text.includes('Groups Solo Arena') &&
          x.text.includes('เริ่มเล่น') &&
          x.text.includes('แตะ')
        );
      })
      .sort(function(a,b){
        return b.area - a.area;
      });

    if (!likelyCards.length) return false;

    const card = likelyCards[0].el;

    card.style.transition = 'opacity .22s ease, transform .22s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(.985)';

    setTimeout(function(){
      card.style.display = 'none';
    }, 240);

    return true;
  }

  function revealGameplayFallback(){
    const selectors = [
      '#game',
      '#gameRoot',
      '#gameArea',
      '#arena',
      '#playfield',
      '.game',
      '.game-root',
      '.gameArea',
      '.arena',
      '.playfield',
      '.hud',
      '#hud',
      '.topbar',
      '.scorebar',
      '.statusbar'
    ];

    selectors.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(el){
        el.style.display = '';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.pointerEvents = '';
      });
    });
  }

  function fallbackReloadToPlay(){
    const current = new URL(location.href);

    const alreadyAutostart =
      current.searchParams.get('autostart') === '1' ||
      current.searchParams.get('startFix') === '1';

    if (alreadyAutostart) return;

    const target = buildCurrentPlayUrl({
      autostart:'1',
      startFix:'1',
      startTs:Date.now()
    });

    console.info('[Groups Start Fix] fallback reload to play', target);

    setTimeout(function(){
      location.replace(target);
    }, 550);
  }

  function startGameFromButton(ev, el){
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();

      if (typeof ev.stopImmediatePropagation === 'function') {
        ev.stopImmediatePropagation();
      }
    }

    markStartState();

    toast('เริ่ม Groups Solo');

    dispatchStartEvents();

    const nativeStarted = tryNativeStart();

    revealGameplayFallback();

    const hiddenIntro = hideIntroFallback();

    console.info('[Groups Start Fix]', PATCH_ID, {
      nativeStarted:nativeStarted,
      hiddenIntro:hiddenIntro,
      elementText:textOf(el),
      url:location.href
    });

    if (!nativeStarted && !hiddenIntro) {
      fallbackReloadToPlay();
    }

    return false;
  }

  function patchStartButtons(){
    const candidates = Array.from(document.querySelectorAll('a,button,[role="button"],input[type="button"],input[type="submit"],.btn'));

    candidates.forEach(function(el){
      if (!isStartButton(el)) return;

      el.classList.add('hha-groups-start-fixed');
      el.setAttribute('data-hha-start-fixed', PATCH_ID);

      if (el.tagName === 'A') {
        el.href = '#start-groups-solo';
      }

      if (!el.__hhaGroupsStartFixBound) {
        el.__hhaGroupsStartFixBound = true;

        el.addEventListener('click', function(ev){
          return startGameFromButton(ev, el);
        }, true);

        el.addEventListener('keydown', function(ev){
          if (ev.key === 'Enter' || ev.key === ' ') {
            return startGameFromButton(ev, el);
          }
        }, true);
      }
    });
  }

  function globalClickGuard(){
    if (document.__hhaGroupsStartGlobalGuard) return;
    document.__hhaGroupsStartGlobalGuard = true;

    document.addEventListener('click', function(ev){
      const el = ev.target && ev.target.closest && ev.target.closest('a,button,[role="button"],input,.btn');

      if (!el) return;
      if (!isStartButton(el)) return;

      return startGameFromButton(ev, el);
    }, true);
  }

  function patchWrongStartLinks(){
    Array.from(document.querySelectorAll('a')).forEach(function(a){
      if (!isStartButton(a)) return;

      const href = String(a.getAttribute('href') || '');

      if (
        href.includes('/nutrition-zone.html') ||
        href.includes('/hub.html') ||
        href === '' ||
        href === '#'
      ) {
        a.href = '#start-groups-solo';
      }
    });
  }

  function autoStartIfRequested(){
    const auto =
      qs.get('autostart') === '1' ||
      qs.get('startFix') === '1';

    if (!auto) return;

    setTimeout(function(){
      if (state.startClicked) return;

      const btn = Array.from(document.querySelectorAll('a,button,[role="button"],input,.btn'))
        .find(isStartButton);

      if (btn) {
        startGameFromButton(null, btn);
      } else {
        markStartState();
        dispatchStartEvents();
        tryNativeStart();
        revealGameplayFallback();
        hideIntroFallback();
      }
    }, 500);
  }

  function scan(){
    patchWrongStartLinks();
    patchStartButtons();
  }

  function boot(){
    addStyle();

    globalClickGuard();

    scan();

    setTimeout(scan, 250);
    setTimeout(scan, 800);
    setTimeout(scan, 1600);

    autoStartIfRequested();

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_START_FIX_SCAN_TIMER__);
      window.__HHA_GROUPS_START_FIX_SCAN_TIMER__ = setTimeout(scan, 90);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['href','class','style','aria-label','value']
    });

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      view:normalizeView(),
      playUrl:buildCurrentPlayUrl()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
