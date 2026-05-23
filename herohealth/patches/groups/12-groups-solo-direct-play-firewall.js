/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260523-groups-solo-direct-play-firewall-12
   File: /herohealth/patches/groups/12-groups-solo-direct-play-firewall.js

   Purpose:
   - Fix PC direct flow stuck on duplicated intro
   - Stop intro "เริ่มเล่น" from returning to groups-vr.html
   - When direct/autostart flags exist, force gameplay state
   - Hide intro card and block old launcher/navigation handlers during play
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260523-groups-solo-direct-play-firewall-12';

  if (window.__HHA_GROUPS_SOLO_DIRECT_PLAY_FIREWALL_12__) return;
  window.__HHA_GROUPS_SOLO_DIRECT_PLAY_FIREWALL_12__ = true;

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
    console.info('[Groups Direct Firewall 12]', PATCH_ID, 'skipped: no direct flag');
    return;
  }

  var state = {
    patch: PATCH_ID,
    view: String(qs.get('view') || 'pc').toLowerCase(),
    variant: String(qs.get('variant') || 'arena').toLowerCase(),
    forced: false,
    introHidden: false,
    clickBlocked: 0
  };

  window.HHA_GROUPS_DIRECT_PLAY_FIREWALL = state;

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
      t.indexOf('เล่นอีกครั้ง') >= 0
    );
  }

  function isStartText(t){
    return (
      t.indexOf('เริ่มเล่น') >= 0 ||
      t.indexOf('เริ่มเกม') >= 0 ||
      t.indexOf('Start') >= 0 ||
      t.indexOf('Play') >= 0
    );
  }

  function isBackOrModeText(t){
    return (
      t.indexOf('โหมดเกม') >= 0 ||
      t.indexOf('Nutrition Zone') >= 0 ||
      t.indexOf('HUB') >= 0 ||
      t.indexOf('กลับ') >= 0
    );
  }

  function isIntroStart(el){
    if (!el) return false;

    var t = textOf(el);
    if (!isStartText(t)) return false;
    if (t.indexOf('เล่นอีกครั้ง') >= 0) return false;
    if (isBackOrModeText(t)) return false;

    var r = el.getBoundingClientRect();
    return r.width > 30 && r.height > 20;
  }

  function findIntroRoot(){
    var nodes = Array.prototype.slice.call(document.querySelectorAll('main,section,article,div'));

    var found = nodes.map(function(el){
      var t = textOf(el);
      var r = el.getBoundingClientRect();
      return { el: el, text: t, area: r.width * r.height };
    }).filter(function(x){
      if (x.area < 8000) return false;

      return (
        x.text.indexOf('Groups Solo Arena') >= 0 && x.text.indexOf('เริ่มเล่น') >= 0 ||
        x.text.indexOf('Groups Practice Arena') >= 0 && x.text.indexOf('เริ่มเล่น') >= 0 ||
        x.text.indexOf('แตะหรือ') >= 0 && x.text.indexOf('ประตูหมู่') >= 0 ||
        x.text.indexOf('โหมดซ้อม') >= 0 && x.text.indexOf('เริ่มเล่น') >= 0
      );
    }).sort(function(a,b){
      return b.area - a.area;
    });

    return found.length ? found[0].el : null;
  }

  function markPlayState(){
    document.body.dataset.hhaRun = 'play';
    document.body.dataset.hhaMode = 'solo';
    document.body.dataset.hhaVariant = state.variant;
    document.body.dataset.hhaView = state.view;
    document.body.dataset.hhaGame = 'groups';

    document.body.classList.add('hha-groups-started');
    document.body.classList.add('hha-groups-starting');
    document.body.classList.add('hha-groups-gameplay-active');
    document.documentElement.classList.add('hha-groups-gameplay-active');

    try {
      sessionStorage.setItem('HHA_GROUPS_SOLO_START_INTENT', JSON.stringify({
        patch: PATCH_ID,
        at: new Date().toISOString(),
        url: location.href,
        forced: true,
        view: state.view,
        variant: state.variant
      }));
    } catch(e) {}
  }

  function revealGame(){
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

  function hideIntro(){
    var root = findIntroRoot();

    if (!root) return false;

    root.setAttribute('data-hha-direct-firewall-hidden', PATCH_ID);
    root.style.display = 'none';
    root.style.visibility = 'hidden';
    root.style.opacity = '0';
    root.style.pointerEvents = 'none';

    state.introHidden = true;
    return true;
  }

  function dispatchStart(){
    var detail = {
      source: 'groups-direct-play-firewall-12',
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
      'groups:start',
      'groups:solo:start'
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
        if (typeof window[name] === 'function') {
          window[name]({
            source: 'groups-direct-play-firewall-12',
            patch: PATCH_ID,
            run: 'play',
            mode: 'solo',
            view: state.view,
            variant: state.variant
          });
          console.info('[Groups Direct Firewall 12] called:', name);
        }
      } catch(e) {}
    });
  }

  function forcePlay(reason){
    if (isSummary()) return;

    markPlayState();
    revealGame();
    dispatchStart();
    callStartFns();
    hideIntro();

    state.forced = true;

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'forcePlay', {
      reason: reason || 'auto',
      view: state.view,
      variant: state.variant,
      introHidden: state.introHidden
    });
  }

  function neutralizeIntroButtons(){
    Array.prototype.slice.call(document.querySelectorAll('a,button,[role="button"],.btn,div,span')).forEach(function(el){
      if (!isIntroStart(el)) return;

      el.setAttribute('data-hha-direct-firewall-start', PATCH_ID);
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');

      if (el.tagName === 'A') {
        el.setAttribute('href', '#direct-play');
      }

      el.onclick = null;
    });
  }

  function blockBadClicks(){
    if (document.__hhaGroupsDirectFirewallClickBound) return;
    document.__hhaGroupsDirectFirewallClickBound = true;

    document.addEventListener('click', function(ev){
      if (isSummary()) return;

      var path = ev.composedPath ? ev.composedPath() : [];
      var hit = path.find(function(x){
        return x && x.nodeType === 1 && isIntroStart(x);
      });

      if (!hit) return;

      ev.preventDefault();
      ev.stopPropagation();

      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      state.clickBlocked += 1;
      forcePlay('blocked-intro-start-click');

      return false;
    }, true);
  }

  function blockOldNavClicks(){
    if (document.__hhaGroupsDirectFirewallNavBound) return;
    document.__hhaGroupsDirectFirewallNavBound = true;

    document.addEventListener('click', function(ev){
      if (isSummary()) return;

      var el = ev.target && ev.target.closest &&
        ev.target.closest('a,button,[role="button"],.btn,div,span');

      if (!el) return;

      var t = textOf(el);
      var href = String(el.getAttribute && el.getAttribute('href') || '');

      var isOldNav =
        t.indexOf('โหมดเกม') >= 0 ||
        href.indexOf('/groups-vr.html') >= 0 ||
        href.indexOf('/group-v1.html') >= 0;

      if (!isOldNav) return;

      ev.preventDefault();
      ev.stopPropagation();

      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      forcePlay('blocked-old-nav-click');

      return false;
    }, true);
  }

  function scan(){
    if (!hasDirectFlag()) return;
    if (isSummary()) return;

    neutralizeIntroButtons();
    forcePlay('scan');
  }

  function boot(){
    blockBadClicks();
    blockOldNavClicks();

    scan();

    [80,180,320,600,1000,1600,2500,4000,6000].forEach(function(ms){
      setTimeout(scan, ms);
    });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_FIREWALL_12_SCAN_TIMER__);
      window.__HHA_GROUPS_FIREWALL_12_SCAN_TIMER__ = setTimeout(scan, 60);
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class','style','href','role','aria-label']
    });

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      view: state.view,
      variant: state.variant,
      direct: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
