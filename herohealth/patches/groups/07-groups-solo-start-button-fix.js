/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260522-groups-solo-start-button-fix-07e
   File: /herohealth/patches/groups/07-groups-solo-start-button-fix.js

   Purpose:
   - One-tap start: กดเริ่มเล่นครั้งเดียวแล้วเข้าเกม
   - Do not break native game start handlers
   - Prevent Nutrition Zone / HUB click-through while intro is open
   - Compact gameplay navigation buttons so they do not appear in the middle
   - Works with Arena / Practice / PC / Mobile / cVR
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260522-groups-solo-start-button-fix-07e';

  if (window.__HHA_GROUPS_SOLO_START_BUTTON_FIX_07E__) return;
  window.__HHA_GROUPS_SOLO_START_BUTTON_FIX_07E__ = true;

  const qs = new URLSearchParams(location.search);

  const state = {
    patch: PATCH_ID,
    view: normalizeView(),
    variant: String(qs.get('variant') || 'arena').toLowerCase(),
    started: false,
    starting: false,
    startCount: 0,
    lastStartAt: 0
  };

  window.HHA_GROUPS_SOLO_START_FIX = state;

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function normalizeView(){
    const raw = String(qs.get('view') || '').toLowerCase();

    if (['pc','desktop','notebook','laptop'].includes(raw)) return 'pc';
    if (['mobile','phone','touch','tablet'].includes(raw)) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(raw)) return 'cvr';

    return isMobileUA() ? 'mobile' : 'pc';
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
      t.includes('กลับ Nutrition Zone')
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

  function isGameplayActive(){
    if (isIntroVisible() || isSummaryVisible()) return false;

    const t = pageText();

    const hasHud =
      t.includes('คะแนน') ||
      t.includes('เวลา') ||
      t.includes('หัวใจ') ||
      t.includes('คอมโบ') ||
      t.includes('ถูกต้อง');

    const hasTargets = !!document.querySelector(
      '[data-food],[data-target],[data-group],[data-gate],.food,.food-card,.foodItem,.target,.orb,.item,.gate,.group,.bucket,.answer,.choice'
    );

    return hasHud || hasTargets || state.started;
  }

  function isStartText(text){
    const t = String(text || '').trim();

    if (!t) return false;

    const looksStart =
      t.includes('เริ่มเล่น') ||
      t.includes('เริ่มเกม') ||
      t.includes('Start') ||
      t.includes('Play') ||
      t.includes('เล่นเลย');

    const looksReplay =
      t.includes('เล่นอีกครั้ง') ||
      t.includes('Replay') ||
      t.includes('Play Again');

    const looksBack =
      t.includes('กลับ') ||
      t.includes('Nutrition Zone') ||
      t.includes('Hub') ||
      t.includes('HUB') ||
      t.includes('Zone');

    if (looksReplay) return false;
    if (looksBack) return false;

    return looksStart;
  }

  function isStartElement(el){
    if (!el) return false;

    const text = textOf(el);
    return isStartText(text);
  }

  function isNavElement(el){
    if (!el) return false;

    const text = textOf(el);
    const href = String(el.getAttribute && el.getAttribute('href') || '');

    return (
      text.includes('โหมดเกม') ||
      text.includes('Nutrition Zone') ||
      text.includes('กลับ Nutrition') ||
      text.includes('กลับ Zone') ||
      text.includes('กลับโซน') ||
      text.includes('กลับ HUB') ||
      text.includes('กลับ Hub') ||
      text === 'HUB' ||
      href.includes('/nutrition-zone.html') ||
      href.includes('/hub.html') ||
      href.includes('/groups-vr.html')
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

  function findStartElement(root){
    const scope = root || document;

    const candidates = Array.from(scope.querySelectorAll(
      'button,a,[role="button"],input[type="button"],input[type="submit"],.btn,div,span'
    ))
      .filter(function(el){
        const r = el.getBoundingClientRect();
        return isStartElement(el) && r.width > 20 && r.height > 20;
      })
      .sort(function(a,b){
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();

        return (ar.width * ar.height) - (br.width * br.height);
      });

    return candidates[0] || null;
  }

  function addStyle(){
    if (document.getElementById('hha-groups-start-fix-07e-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-start-fix-07e-style';
    style.textContent = `
      body.hha-groups-intro-lock{
        overflow-x:hidden !important;
      }

      .hha-start-intro-root{
        position:relative !important;
        z-index:999990 !important;
        pointer-events:auto !important;
        isolation:isolate !important;
      }

      .hha-start-btn-fixed{
        position:relative !important;
        z-index:1000000 !important;
        pointer-events:auto !important;
        touch-action:manipulation !important;
        cursor:pointer !important;
        user-select:none !important;
      }

      .hha-start-btn-fixed::after{
        content:"";
        position:absolute;
        inset:-10px;
        border-radius:inherit;
        pointer-events:none;
        box-shadow:0 0 0 5px rgba(126,217,87,.25);
        animation:hhaStartPulse07e 1.05s ease-in-out infinite;
      }

      @keyframes hhaStartPulse07e{
        0%,100%{ opacity:.42; transform:scale(1); }
        50%{ opacity:1; transform:scale(1.04); }
      }

      body.hha-groups-intro-lock .hha-bg-zone-blocked{
        pointer-events:none !important;
        opacity:.12 !important;
        filter:grayscale(.25) blur(.6px) !important;
      }

      body.hha-groups-started .hha-start-intro-root{
        opacity:0 !important;
        transform:scale(.985) !important;
        pointer-events:none !important;
        transition:opacity .18s ease, transform .18s ease !important;
      }

      .hha-game-nav-compact{
        position:fixed !important;
        z-index:99990 !important;
        width:auto !important;
        min-width:0 !important;
        max-width:170px !important;
        min-height:34px !important;
        height:auto !important;
        padding:7px 10px !important;
        border-radius:999px !important;
        font-size:13px !important;
        line-height:1.1 !important;
        transform:none !important;
        opacity:.78 !important;
        box-shadow:0 10px 22px rgba(0,0,0,.13) !important;
        white-space:nowrap !important;
      }

      .hha-game-nav-compact:hover{
        opacity:1 !important;
      }

      body.hha-practice-view-mobile .hha-game-nav-compact,
      body.hha-practice-view-cvr .hha-game-nav-compact,
      body.hha-view-mobile .hha-game-nav-compact,
      body.hha-view-cvr .hha-game-nav-compact{
        max-width:128px !important;
        padding:6px 8px !important;
        font-size:11px !important;
        opacity:.58 !important;
      }

      .hha-start-toast-07e{
        position:fixed;
        left:50%;
        bottom:calc(18px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%) translateY(14px);
        z-index:1000001;
        width:min(92vw,560px);
        padding:12px 16px;
        border-radius:20px;
        background:rgba(21,48,74,.94);
        color:white;
        text-align:center;
        font:900 14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 18px 42px rgba(0,0,0,.24);
        opacity:0;
        pointer-events:none;
        transition:.18s ease;
      }

      .hha-start-toast-07e.show{
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
      toastBox.className = 'hha-start-toast-07e';
      document.body.appendChild(toastBox);
    }

    toastBox.textContent = String(message || '');
    toastBox.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){
      toastBox.classList.remove('show');
    }, 1500);
  }

  function dispatchStartEvents(){
    const detail = {
      source:'groups-start-button-fix-07e',
      patch:PATCH_ID,
      run:'play',
      mode:'solo',
      game:'groups',
      gameId:'groups',
      zone:'nutrition',
      variant:state.variant,
      view:state.view,
      pid:qs.get('pid') || 'anon',
      name:qs.get('name') || 'Hero'
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

  function callPossibleStartFunctions(){
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

    let ok = false;

    candidates.forEach(function(name){
      try {
        const fn = window[name];

        if (typeof fn === 'function') {
          fn({
            source:'groups-start-button-fix-07e',
            patch:PATCH_ID,
            run:'play',
            mode:'solo',
            variant:state.variant,
            view:state.view
          });

          ok = true;
          console.info('[Groups Start Fix 07e] called:', name);
        }
      } catch(e) {}
    });

    return ok;
  }

  function revealGameplay(){
    document.body.dataset.hhaRun = 'play';
    document.body.dataset.hhaMode = 'solo';
    document.body.dataset.hhaVariant = state.variant;
    document.body.dataset.hhaGame = 'groups';
    document.body.dataset.hhaView = state.view;

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

    root.classList.add('hha-start-intro-root');

    document.body.classList.add('hha-groups-started');

    setTimeout(function(){
      root.style.display = 'none';
      root.style.pointerEvents = 'none';

      document.querySelectorAll('.hha-bg-zone-blocked').forEach(function(el){
        el.classList.remove('hha-bg-zone-blocked');
        el.removeAttribute('data-hha-bg-blocked');
      });
    }, 200);

    return true;
  }

  function saveStartIntent(){
    try {
      sessionStorage.setItem('HHA_GROUPS_SOLO_START_INTENT', JSON.stringify({
        patch:PATCH_ID,
        at:new Date().toISOString(),
        url:location.href,
        variant:state.variant,
        view:state.view
      }));
    } catch(e) {}
  }

  function startNow(reason){
    if (state.starting && Date.now() - state.lastStartAt < 400) return;

    state.starting = true;
    state.started = true;
    state.startCount += 1;
    state.lastStartAt = Date.now();

    saveStartIntent();

    document.body.classList.add('hha-groups-starting');
    document.body.classList.add('hha-groups-started');

    toast(state.variant === 'practice' ? 'เริ่ม Groups Practice' : 'เริ่ม Groups Solo');

    dispatchStartEvents();
    callPossibleStartFunctions();
    revealGameplay();
    hideIntro();

    setTimeout(function(){
      document.body.classList.add('hha-groups-gameplay-active');
      compactGameplayNav();
    }, 260);

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'startNow', {
      reason:reason || 'start',
      state:Object.assign({}, state)
    });
  }

  function patchIntroLayer(){
    if (!isIntroVisible() || state.started) return;

    document.body.classList.add('hha-groups-intro-lock');

    const root = findIntroRoot();
    const startEl = findStartElement(root);

    if (root) {
      root.classList.add('hha-start-intro-root');
    }

    if (startEl) {
      startEl.classList.add('hha-start-btn-fixed');
      startEl.setAttribute('data-hha-start-fixed', PATCH_ID);
      startEl.setAttribute('role', 'button');
      startEl.setAttribute('tabindex', '0');

      if (startEl.tagName === 'A') {
        startEl.setAttribute('href', '#start-groups-solo');
      }

      if (!startEl.__hhaStartFix07eBound) {
        startEl.__hhaStartFix07eBound = true;

        startEl.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();

          if (typeof ev.stopImmediatePropagation === 'function') {
            ev.stopImmediatePropagation();
          }

          startNow('direct-start-click');
          return false;
        }, true);

        startEl.addEventListener('keydown', function(ev){
          if (ev.key !== 'Enter' && ev.key !== ' ') return;

          ev.preventDefault();
          ev.stopPropagation();

          if (typeof ev.stopImmediatePropagation === 'function') {
            ev.stopImmediatePropagation();
          }

          startNow('direct-start-key');
          return false;
        }, true);
      }
    }

    Array.from(document.querySelectorAll('a,button,[role="button"],.btn,div,span')).forEach(function(el){
      if (root && root.contains(el)) return;

      if (isNavElement(el)) {
        el.classList.add('hha-bg-zone-blocked');
        el.setAttribute('data-hha-bg-blocked', PATCH_ID);
      }
    });
  }

  function eventPath(ev){
    if (ev.composedPath) return ev.composedPath();

    const path = [];
    let el = ev.target;

    while (el) {
      path.push(el);
      el = el.parentElement;
    }

    path.push(window);
    return path;
  }

  function bindGlobalGuards(){
    if (document.__hhaGroupsStartFix07eGlobalBound) return;
    document.__hhaGroupsStartFix07eGlobalBound = true;

    document.addEventListener('click', function(ev){
      if (!isIntroVisible() || state.started) return;

      const path = eventPath(ev).filter(function(x){
        return x && x.nodeType === 1;
      });

      const startHit = path.find(isStartElement);
      const navHit = path.find(isNavElement);

      if (startHit) {
        ev.preventDefault();
        ev.stopPropagation();

        if (typeof ev.stopImmediatePropagation === 'function') {
          ev.stopImmediatePropagation();
        }

        startNow('global-start-click');
        return false;
      }

      if (navHit) {
        ev.preventDefault();
        ev.stopPropagation();

        if (typeof ev.stopImmediatePropagation === 'function') {
          ev.stopImmediatePropagation();
        }

        toast('กดเริ่มเล่นก่อน ยังไม่ออกไป Zone ตอนนี้');
        return false;
      }
    }, true);
  }

  function compactGameplayNav(){
    if (!isGameplayActive()) return;

    document.body.classList.add('hha-groups-gameplay-active');

    const navs = Array.from(document.querySelectorAll('a,button,[role="button"],.btn,div,span'))
      .filter(function(el){
        if (!isNavElement(el)) return false;

        const t = textOf(el);
        if (t.length > 40) return false;

        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 20) return false;

        return true;
      })
      .slice(0, 4);

    navs.forEach(function(el, i){
      el.classList.add('hha-game-nav-compact');
      el.setAttribute('data-hha-game-nav-compact', PATCH_ID);

      const isSmall =
        state.view === 'mobile' ||
        state.view === 'cvr' ||
        window.innerWidth < 760;

      if (isSmall) {
        el.style.right = '8px';
        el.style.bottom = (8 + i * 42) + 'px';
      } else {
        el.style.bottom = '12px';
        el.style.right = (12 + i * 150) + 'px';
      }
    });
  }

  function scan(){
    addStyle();

    if (isSummaryVisible()) {
      document.body.classList.remove('hha-groups-intro-lock');
      return;
    }

    if (isIntroVisible() && !state.started) {
      patchIntroLayer();
      return;
    }

    if (isGameplayActive()) {
      compactGameplayNav();
    }
  }

  function boot(){
    addStyle();
    bindGlobalGuards();

    scan();

    setTimeout(scan, 250);
    setTimeout(scan, 800);
    setTimeout(scan, 1600);
    setTimeout(scan, 2600);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_START_FIX_07E_SCAN_TIMER__);
      window.__HHA_GROUPS_START_FIX_07E_SCAN_TIMER__ = setTimeout(scan, 110);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['href','class','style','aria-label','value','role']
    });

    window.addEventListener('resize', function(){
      setTimeout(compactGameplayNav, 150);
    }, { passive:true });

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      view:state.view,
      variant:state.variant
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
