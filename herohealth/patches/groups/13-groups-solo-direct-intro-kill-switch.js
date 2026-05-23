/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260523-groups-solo-direct-intro-kill-switch-13
   File: /herohealth/patches/groups/13-groups-solo-direct-intro-kill-switch.js

   Purpose:
   - Final hard fix for PC direct flow
   - If groups.html opens with direct/autostart flags, remove duplicated intro card
   - Block old intro "เริ่มเล่น" from navigating back to groups-vr.html
   - Reveal gameplay layer immediately
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260523-groups-solo-direct-intro-kill-switch-13';

  if (window.__HHA_GROUPS_SOLO_DIRECT_INTRO_KILL_SWITCH_13__) return;
  window.__HHA_GROUPS_SOLO_DIRECT_INTRO_KILL_SWITCH_13__ = true;

  var qs = new URLSearchParams(location.search);

  function hasDirectFlag(){
    return (
      qs.get('skipIntro') === '1' ||
      qs.get('nointro') === '1' ||
      qs.get('autostart') === '1' ||
      qs.get('direct') === '1' ||
      qs.get('startFix') === '1' ||
      String(qs.get('entry') || '').indexOf('groups-pc') >= 0 ||
      String(qs.get('from') || '').indexOf('groups-pc') >= 0 ||
      String(qs.get('from') || '').indexOf('groups-vr') >= 0
    );
  }

  if (!hasDirectFlag()) {
    console.info('[Groups Intro Kill 13]', PATCH_ID, 'skipped: no direct flag');
    return;
  }

  var state = {
    patch: PATCH_ID,
    view: String(qs.get('view') || 'pc').toLowerCase(),
    variant: String(qs.get('variant') || 'arena').toLowerCase(),
    killed: 0,
    blocked: 0,
    scans: 0
  };

  window.HHA_GROUPS_DIRECT_INTRO_KILL_SWITCH = state;

  function textOf(el){
    return String(el && (
      el.innerText ||
      el.textContent ||
      (el.getAttribute && el.getAttribute('aria-label')) ||
      el.value ||
      ''
    ) || '').replace(/\s+/g, ' ').trim();
  }

  function pageText(){
    return String(document.body && document.body.innerText || '');
  }

  function isSummary(){
    var t = pageText();
    return (
      t.indexOf('สรุปผลการเล่น') >= 0 ||
      t.indexOf('Food Hero') >= 0 ||
      t.indexOf('Practice Hero') >= 0 ||
      t.indexOf('เล่นอีกครั้ง') >= 0 ||
      t.indexOf('Best Score') >= 0
    );
  }

  function addStyle(){
    if (document.getElementById('hha-groups-intro-kill-13-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-groups-intro-kill-13-style';
    style.textContent = [
      '.hha-groups-direct-intro-killed,',
      '[data-hha-direct-intro-killed]{',
      'display:none!important;',
      'visibility:hidden!important;',
      'opacity:0!important;',
      'pointer-events:none!important;',
      '}',
      'body.hha-groups-direct-play-active .hha-start-intro-root{',
      'display:none!important;',
      'visibility:hidden!important;',
      'opacity:0!important;',
      'pointer-events:none!important;',
      '}',
      'body.hha-groups-direct-play-active a[href*="groups-vr.html"],',
      'body.hha-groups-direct-play-active a[href*="group-v1.html"]{',
      'display:none!important;',
      'visibility:hidden!important;',
      'pointer-events:none!important;',
      '}'
    ].join('');

    document.head.appendChild(style);
  }

  function markPlay(){
    document.body.dataset.hhaRun = 'play';
    document.body.dataset.hhaMode = 'solo';
    document.body.dataset.hhaVariant = state.variant;
    document.body.dataset.hhaView = state.view;
    document.body.dataset.hhaGame = 'groups';

    document.body.classList.add('hha-groups-started');
    document.body.classList.add('hha-groups-starting');
    document.body.classList.add('hha-groups-gameplay-active');
    document.body.classList.add('hha-groups-direct-play-active');
    document.documentElement.classList.add('hha-groups-gameplay-active');

    try {
      sessionStorage.setItem('HHA_GROUPS_SOLO_START_INTENT', JSON.stringify({
        patch: PATCH_ID,
        at: new Date().toISOString(),
        url: location.href,
        view: state.view,
        variant: state.variant,
        direct: true
      }));
    } catch(e) {}
  }

  function revealGameplay(){
    [
      '#game',
      '#gameRoot',
      '#gameArea',
      '#arena',
      '#playfield',
      '#hud',
      '.game',
      '.game-root',
      '.gameArea',
      '.arena',
      '.playfield',
      '.hud',
      '.topbar',
      '.scorebar',
      '.statusbar',
      '[data-game]',
      '[data-arena]',
      '[data-playfield]'
    ].forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(el){
        el.style.display = '';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.pointerEvents = '';
        el.style.filter = '';
      });
    });
  }

  function dispatchStart(){
    var detail = {
      source: 'groups-direct-intro-kill-switch-13',
      patch: PATCH_ID,
      run: 'play',
      mode: 'solo',
      game: 'groups',
      gameId: 'groups',
      zone: 'nutrition',
      view: state.view,
      variant: state.variant,
      pid: qs.get('pid') || 'anon',
      name: qs.get('name') || 'Hero'
    };

    [
      'hha:start',
      'hha:game:start',
      'hha:groups:start',
      'hha:groups:solo:start',
      'hha:groups:practice:start',
      'groups:start',
      'groups:solo:start',
      'groups:practice:start'
    ].forEach(function(name){
      try {
        window.dispatchEvent(new CustomEvent(name, { detail: detail }));
        document.dispatchEvent(new CustomEvent(name, { detail: detail }));
      } catch(e) {}
    });
  }

  function callStartFns(){
    [
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
      'HHA_GROUPS_SOLO_START'
    ].forEach(function(name){
      try {
        var fn = window[name];

        if (typeof fn === 'function') {
          fn({
            source: 'groups-direct-intro-kill-switch-13',
            patch: PATCH_ID,
            run: 'play',
            mode: 'solo',
            view: state.view,
            variant: state.variant
          });

          console.info('[Groups Intro Kill 13] called:', name);
        }
      } catch(e) {}
    });
  }

  function isIntroText(t){
    return (
      (
        t.indexOf('Groups Solo Arena') >= 0 ||
        t.indexOf('Groups Practice Arena') >= 0
      ) &&
      (
        t.indexOf('เริ่มเล่น') >= 0 ||
        t.indexOf('โหมดซ้อม') >= 0 ||
        t.indexOf('แตะหรือ') >= 0 ||
        t.indexOf('ประตูหมู่') >= 0
      )
    );
  }

  function findIntroCards(){
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll('main,section,article,div')
    );

    return nodes.map(function(el){
      var t = textOf(el);
      var r = el.getBoundingClientRect();

      return {
        el: el,
        text: t,
        area: r.width * r.height
      };
    }).filter(function(x){
      if (!x.el || x.el === document.body) return false;
      if (x.area < 6000) return false;
      return isIntroText(x.text);
    }).sort(function(a,b){
      return a.area - b.area;
    }).map(function(x){
      return x.el;
    });
  }

  function killIntro(){
    var cards = findIntroCards();

    if (!cards.length) return false;

    /*
      เลือก card ที่เล็กที่สุดก่อน
      ถ้าเล็กเกิน/ผิด container ตัว scan รอบถัดไปยังตามลบ ancestor อื่นได้
    */
    cards.slice(0, 3).forEach(function(el){
      el.classList.add('hha-groups-direct-intro-killed');
      el.setAttribute('data-hha-direct-intro-killed', PATCH_ID);

      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';

      state.killed += 1;
    });

    return true;
  }

  function isStartOrOldNav(el){
    if (!el) return false;

    var t = textOf(el);
    var href = String(el.getAttribute && el.getAttribute('href') || '');

    var isStart =
      t.indexOf('เริ่มเล่น') >= 0 ||
      t.indexOf('เริ่มเกม') >= 0 ||
      t.indexOf('Start') >= 0 ||
      t.indexOf('Play') >= 0;

    var isOldNav =
      t.indexOf('โหมดเกม') >= 0 ||
      href.indexOf('/groups-vr.html') >= 0 ||
      href.indexOf('/group-v1.html') >= 0;

    var isReplay =
      t.indexOf('เล่นอีกครั้ง') >= 0 ||
      t.indexOf('Replay') >= 0;

    return (isStart && !isReplay) || isOldNav;
  }

  function blockOldClicks(){
    if (document.__hhaGroupsIntroKill13ClicksBound) return;
    document.__hhaGroupsIntroKill13ClicksBound = true;

    ['pointerdown','mousedown','touchstart','click'].forEach(function(evtName){
      document.addEventListener(evtName, function(ev){
        if (!hasDirectFlag()) return;
        if (isSummary()) return;

        var path = ev.composedPath ? ev.composedPath() : [];
        var hit = path.find(function(x){
          return x && x.nodeType === 1 && isStartOrOldNav(x);
        });

        if (!hit) return;

        ev.preventDefault();
        ev.stopPropagation();

        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        state.blocked += 1;

        forcePlay('blocked-' + evtName);

        return false;
      }, true);
    });
  }

  function neutralizeLinks(){
    document.querySelectorAll('a[href*="groups-vr.html"],a[href*="group-v1.html"]').forEach(function(a){
      a.setAttribute('data-hha-old-groups-link-blocked', PATCH_ID);
      a.setAttribute('href', '#direct-play');
      a.onclick = null;
    });

    Array.prototype.slice.call(document.querySelectorAll('a,button,[role="button"],.btn,div,span')).forEach(function(el){
      if (!isStartOrOldNav(el)) return;

      el.setAttribute('data-hha-direct-start-neutralized', PATCH_ID);
      el.onclick = null;
    });
  }

  function forcePlay(reason){
    if (isSummary()) return;

    markPlay();
    revealGameplay();
    dispatchStart();
    callStartFns();
    neutralizeLinks();

    var killed = killIntro();

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'forcePlay', {
      reason: reason || 'scan',
      killedIntro: killed,
      killedCount: state.killed,
      blocked: state.blocked,
      view: state.view,
      variant: state.variant
    });
  }

  function scan(){
    if (!hasDirectFlag()) return;
    if (isSummary()) return;

    state.scans += 1;

    forcePlay('scan-' + state.scans);
  }

  function boot(){
    addStyle();
    blockOldClicks();

    scan();

    [60,120,220,360,520,750,1000,1400,1900,2600,3600,5000,7000].forEach(function(ms){
      setTimeout(scan, ms);
    });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_INTRO_KILL_13_SCAN__);
      window.__HHA_GROUPS_INTRO_KILL_13_SCAN__ = setTimeout(scan, 45);
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class','style','href','role','aria-label']
    });

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      direct: true,
      view: state.view,
      variant: state.variant
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
