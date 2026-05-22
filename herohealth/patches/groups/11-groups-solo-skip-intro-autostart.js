/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260522-groups-solo-skip-intro-autostart-11c
   File: /herohealth/patches/groups/11-groups-solo-skip-intro-autostart.js

   Purpose:
   - If direct/autostart/skipIntro is present, remove duplicated intro
   - Coming from groups-vr / groups-pc must enter gameplay directly
   - Keep scanning until intro is removed
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260522-groups-solo-skip-intro-autostart-11c';

  if (window.__HHA_GROUPS_SOLO_SKIP_INTRO_AUTOSTART_11C__) return;
  window.__HHA_GROUPS_SOLO_SKIP_INTRO_AUTOSTART_11C__ = true;

  var qs = new URLSearchParams(location.search);

  var state = {
    patch: PATCH_ID,
    tries: 0,
    maxTries: 120,
    introHidden: false,
    variant: String(qs.get('variant') || 'arena').toLowerCase(),
    view: String(qs.get('view') || 'pc').toLowerCase()
  };

  window.HHA_GROUPS_SOLO_SKIP_INTRO = state;

  function shouldSkipIntro(){
    if (
      qs.get('intro') === '1' ||
      qs.get('holdIntro') === '1' ||
      qs.get('nointro') === '0'
    ) {
      return false;
    }

    var mode = String(qs.get('mode') || 'solo').toLowerCase();
    var run = String(qs.get('run') || '').toLowerCase();
    var entry = String(qs.get('entry') || '').toLowerCase();
    var from = String(qs.get('from') || '').toLowerCase();

    var directFlags =
      qs.get('skipIntro') === '1' ||
      qs.get('nointro') === '1' ||
      qs.get('autostart') === '1' ||
      qs.get('direct') === '1' ||
      qs.get('startFix') === '1';

    var fromKnown =
      entry.indexOf('groups-vr') >= 0 ||
      entry.indexOf('groups-pc') >= 0 ||
      entry.indexOf('launcher') >= 0 ||
      from.indexOf('groups-vr') >= 0 ||
      from.indexOf('groups-pc') >= 0;

    var variantOk =
      state.variant === 'arena' ||
      state.variant === 'practice';

    var isPlay =
      run === 'play' ||
      run === 'start' ||
      run === '';

    return mode === 'solo' && isPlay && variantOk && (directFlags || fromKnown);
  }

  function textOf(el){
    return String(el && (
      el.innerText ||
      el.textContent ||
      (el.getAttribute && el.getAttribute('aria-label')) ||
      el.value ||
      ''
    ) || '')
      .replace(/\s+/g,' ')
      .trim();
  }

  function pageText(){
    return String(document.body && document.body.innerText || '');
  }

  function isSummaryVisible(){
    var t = pageText();

    return (
      t.indexOf('สรุปผลการเล่น') >= 0 ||
      t.indexOf('สรุปผลการฝึก') >= 0 ||
      t.indexOf('Food Hero') >= 0 ||
      t.indexOf('Practice Hero') >= 0 ||
      t.indexOf('เล่นอีกครั้ง') >= 0 ||
      t.indexOf('Best Score') >= 0
    );
  }

  function findIntroRoot(){
    var candidates = Array.prototype.slice.call(document.querySelectorAll('main,section,article,div'))
      .map(function(el){
        var txt = textOf(el);
        var r = el.getBoundingClientRect();

        return {
          el: el,
          text: txt,
          area: r.width * r.height
        };
      })
      .filter(function(x){
        if (x.area < 9000) return false;

        return (
          x.text.indexOf('Groups Solo Arena') >= 0 && x.text.indexOf('เริ่มเล่น') >= 0 ||
          x.text.indexOf('Groups Practice Arena') >= 0 && x.text.indexOf('เริ่มเล่น') >= 0 ||
          x.text.indexOf('โหมดซ้อม') >= 0 && x.text.indexOf('เริ่มเล่น') >= 0 ||
          x.text.indexOf('แตะหรือ') >= 0 && x.text.indexOf('ประตูหมู่') >= 0
        );
      })
      .sort(function(a,b){
        return b.area - a.area;
      });

    return candidates.length ? candidates[0].el : null;
  }

  function hideIntro(){
    var root = findIntroRoot();

    if (!root) return false;

    root.setAttribute('data-hha-intro-skipped', PATCH_ID);
    root.style.display = 'none';
    root.style.visibility = 'hidden';
    root.style.opacity = '0';
    root.style.pointerEvents = 'none';

    state.introHidden = true;

    return true;
  }

  function markGameplay(){
    document.body.dataset.hhaRun = 'play';
    document.body.dataset.hhaMode = 'solo';
    document.body.dataset.hhaVariant = state.variant;
    document.body.dataset.hhaGame = 'groups';
    document.body.dataset.hhaView = state.view;

    document.body.classList.add('hha-groups-started');
    document.body.classList.add('hha-groups-starting');
    document.body.classList.add('hha-groups-gameplay-active');
    document.documentElement.classList.add('hha-groups-gameplay-active');

    try {
      sessionStorage.setItem('HHA_GROUPS_SOLO_START_INTENT', JSON.stringify({
        patch: PATCH_ID,
        at: new Date().toISOString(),
        url: location.href,
        variant: state.variant,
        view: state.view,
        skippedIntro: true
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

  function dispatchStartEvents(){
    var detail = {
      source: 'groups-skip-intro-autostart-11c',
      patch: PATCH_ID,
      run: 'play',
      mode: 'solo',
      game: 'groups',
      gameId: 'groups',
      zone: 'nutrition',
      variant: state.variant,
      view: state.view,
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
        window.dispatchEvent(new CustomEvent(name, { detail:detail }));
        document.dispatchEvent(new CustomEvent(name, { detail:detail }));
      } catch(e) {}
    });
  }

  function callStartFunctions(){
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
            source: 'groups-skip-intro-autostart-11c',
            patch: PATCH_ID,
            run: 'play',
            mode: 'solo',
            variant: state.variant,
            view: state.view
          });

          console.info('[Groups Skip Intro 11c] called:', name);
        }
      } catch(e) {}
    });
  }

  function scan(){
    if (!shouldSkipIntro()) return;
    if (isSummaryVisible()) return;
    if (state.tries > state.maxTries) return;

    state.tries += 1;

    markGameplay();
    revealGameplay();
    dispatchStartEvents();
    callStartFunctions();

    var hidden = hideIntro();

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'scan', {
      tryNo: state.tries,
      hiddenIntro: hidden,
      variant: state.variant,
      view: state.view
    });
  }

  function boot(){
    if (!shouldSkipIntro()) {
      console.info('[HeroHealth Groups Solo]', PATCH_ID, 'intro allowed', {
        query: Object.fromEntries(qs.entries())
      });
      return;
    }

    scan();

    [
      40,80,140,220,360,520,750,1000,
      1350,1700,2200,3000,4200,5500
    ].forEach(function(ms){
      setTimeout(scan, ms);
    });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_SKIP_INTRO_11C_TIMER__);
      window.__HHA_GROUPS_SKIP_INTRO_11C_TIMER__ = setTimeout(scan, 40);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','style','href','aria-label','role']
    });

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      skipIntro: true,
      variant: state.variant,
      view: state.view
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
