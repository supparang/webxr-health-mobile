/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260522-groups-solo-skip-intro-autostart-11
   File: /herohealth/patches/groups/11-groups-solo-skip-intro-autostart.js

   Purpose:
   - If player comes from groups-vr.html launcher with run=play,
     skip the intro screen completely
   - Solo Arena / Practice should enter gameplay directly
   - Intro screen is only for direct/manual debug links
   - Use ?intro=1 or ?holdIntro=1 to force showing intro
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260522-groups-solo-skip-intro-autostart-11';

  if (window.__HHA_GROUPS_SOLO_SKIP_INTRO_AUTOSTART_11__) return;
  window.__HHA_GROUPS_SOLO_SKIP_INTRO_AUTOSTART_11__ = true;

  const qs = new URLSearchParams(location.search);

  const state = {
    patch: PATCH_ID,
    started: false,
    tried: 0,
    variant: String(qs.get('variant') || 'arena').toLowerCase(),
    view: String(qs.get('view') || 'pc').toLowerCase()
  };

  window.HHA_GROUPS_SOLO_SKIP_INTRO = state;

  function shouldSkipIntro(){
    const forcedIntro =
      qs.get('intro') === '1' ||
      qs.get('holdIntro') === '1' ||
      qs.get('nointro') === '0';

    if (forcedIntro) return false;

    const mode = String(qs.get('mode') || 'solo').toLowerCase();
    const run = String(qs.get('run') || '').toLowerCase();
    const entry = String(qs.get('entry') || '').toLowerCase();

    const isSolo = mode === 'solo';
    const isPlay = run === 'play' || run === 'start' || run === '';
    const fromLauncher =
      entry.includes('groups-vr') ||
      entry.includes('launcher') ||
      qs.get('autostart') === '1' ||
      qs.get('skipIntro') === '1' ||
      qs.get('nointro') === '1';

    const variantOk =
      state.variant === 'arena' ||
      state.variant === 'practice';

    // ถ้ามาจาก launcher หรือ URL มี run=play ชัดเจน ให้เข้าเกมเลย
    return isSolo && isPlay && variantOk && (fromLauncher || qs.has('variant'));
  }

  function textOf(el){
    return String(el && (
      el.innerText ||
      el.textContent ||
      (el.getAttribute && el.getAttribute('aria-label')) ||
      el.value ||
      ''
    ) || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pageText(){
    return String(document.body && document.body.innerText || '');
  }

  function isSummaryVisible(){
    const t = pageText();

    return (
      t.includes('สรุปผลการเล่น') ||
      t.includes('สรุปผลการฝึก') ||
      t.includes('Food Hero') ||
      t.includes('Practice Hero') ||
      t.includes('เล่นอีกครั้ง') ||
      t.includes('Best Score')
    );
  }

  function isIntroVisible(){
    if (isSummaryVisible()) return false;

    const t = pageText();

    return (
      t.includes('Groups Solo Arena') ||
      t.includes('Groups Practice Arena') ||
      t.includes('แตะหรือ') ||
      t.includes('เริ่มเล่น') ||
      t.includes('โหมดซ้อม')
    );
  }

  function findIntroRoot(){
    const candidates = Array.from(document.querySelectorAll('main,section,article,div'))
      .map(function(el){
        const t = textOf(el);
        const r = el.getBoundingClientRect();

        return {
          el: el,
          text: t,
          area: r.width * r.height
        };
      })
      .filter(function(x){
        if (x.area < 18000) return false;

        return (
          x.text.includes('Groups Solo Arena') ||
          x.text.includes('Groups Practice Arena') ||
          (
            x.text.includes('เริ่มเล่น') &&
            x.text.includes('ประตูหมู่')
          )
        );
      })
      .sort(function(a,b){
        return b.area - a.area;
      });

    return candidates.length ? candidates[0].el : null;
  }

  function dispatchStartEvents(){
    const detail = {
      source: 'groups-skip-intro-autostart-11',
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
        window.dispatchEvent(new CustomEvent(name, { detail: detail }));
        document.dispatchEvent(new CustomEvent(name, { detail: detail }));
      } catch(e) {}
    });
  }

  function callStartFunctions(){
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
      'HHA_GROUPS_SOLO_START'
    ];

    let called = false;

    candidates.forEach(function(name){
      try {
        const fn = window[name];

        if (typeof fn === 'function') {
          fn({
            source: 'groups-skip-intro-autostart-11',
            patch: PATCH_ID,
            run: 'play',
            mode: 'solo',
            variant: state.variant,
            view: state.view
          });

          called = true;
          console.info('[Groups Skip Intro 11] called:', name);
        }
      } catch(e) {}
    });

    return called;
  }

  function revealGameplay(){
    document.body.dataset.hhaRun = 'play';
    document.body.dataset.hhaMode = 'solo';
    document.body.dataset.hhaVariant = state.variant;
    document.body.dataset.hhaGame = 'groups';
    document.body.dataset.hhaView = state.view;

    document.body.classList.add('hha-groups-started');
    document.body.classList.add('hha-groups-starting');
    document.body.classList.add('hha-groups-gameplay-active');
    document.documentElement.classList.add('hha-groups-gameplay-active');

    const selectors = [
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
    ];

    selectors.forEach(function(sel){
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
    const root = findIntroRoot();

    if (!root) return false;

    root.setAttribute('data-hha-intro-skipped', PATCH_ID);
    root.style.display = 'none';
    root.style.visibility = 'hidden';
    root.style.opacity = '0';
    root.style.pointerEvents = 'none';

    return true;
  }

  function saveIntent(){
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

  function autoStart(reason){
    if (state.started) return;
    if (!shouldSkipIntro()) return;
    if (isSummaryVisible()) return;

    state.started = true;
    state.tried += 1;

    saveIntent();
    revealGameplay();
    dispatchStartEvents();
    callStartFunctions();

    const hidden = hideIntro();

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'autoStart', {
      reason: reason || 'auto',
      hiddenIntro: hidden,
      variant: state.variant,
      view: state.view,
      url: location.href
    });
  }

  function scan(){
    if (!shouldSkipIntro()) return;
    if (isSummaryVisible()) return;

    if (isIntroVisible() || state.tried < 3) {
      autoStart('scan');
    }
  }

  function boot(){
    if (!shouldSkipIntro()) {
      console.info('[HeroHealth Groups Solo]', PATCH_ID, 'intro allowed', {
        query: Object.fromEntries(qs.entries())
      });
      return;
    }

    scan();

    setTimeout(scan, 80);
    setTimeout(scan, 220);
    setTimeout(scan, 500);
    setTimeout(scan, 900);
    setTimeout(scan, 1400);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_SKIP_INTRO_SCAN_TIMER__);
      window.__HHA_GROUPS_SKIP_INTRO_SCAN_TIMER__ = setTimeout(scan, 60);
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'href', 'aria-label', 'role']
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
