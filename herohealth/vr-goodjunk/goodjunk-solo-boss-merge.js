// === /herohealth/vr-goodjunk/goodjunk-solo-boss-merge.js ===
// GoodJunk Solo Boss Main File Merge Bridge
// PATCH v8.40.7-MAIN-FILE-MERGE-BRIDGE
// ✅ auto wire existing food DOM elements
// ✅ read data-food-type / data-type / data-kind
// ✅ bridge click/tap -> GJBS.hit()
// ✅ helper spawn function for main game
// ✅ helper miss/end/summary functions
// ✅ optional auto timer end with ?bossAutoEnd=1
// ✅ works after v8.40.1-8.40.6
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.40.7-MAIN-FILE-MERGE-BRIDGE';

  const CFG = {
    autoBind: QS.get('bridgeAutoBind') !== '0',
    autoStart: QS.get('bridgeAutoStart') !== '0',
    autoEnd: QS.get('bossAutoEnd') === '1',
    debug: QS.get('debugBoss') === '1',
    time: Math.max(30, Number(QS.get('time')) || 120),
    run: QS.get('run') || '',
    mode: QS.get('mode') || QS.get('entry') || ''
  };

  const state = {
    ready:false,
    started:false,
    ended:false,
    startAt:0,
    bindCount:0,
    hitCount:0,
    missCount:0,
    spawned:0,
    observer:null,
    timerId:null,
    lastBindAt:0,
    debugBox:null
  };

  const FOOD_SELECTORS = [
    '[data-gj-food]',
    '[data-food-type]',
    '[data-type]',
    '[data-kind]',
    '.gj-food',
    '.food-target',
    '.food-item',
    '.falling-food',
    '.target-food',
    '.goodjunk-food'
  ].join(',');

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch]));
  }

  function log(){
    if(!CFG.debug) return;
    try{
      console.log.apply(console, ['[GJ Boss Merge]'].concat([].slice.call(arguments)));
    }catch(e){}
  }

  function waitForShim(cb, tries){
    tries = tries || 0;

    if(WIN.GJBS || WIN.GoodJunkSoloBossShim){
      state.ready = true;
      cb(WIN.GJBS || WIN.GoodJunkSoloBossShim);
      return;
    }

    if(tries > 80){
      console.warn('[GJ Boss Merge] GJBS shim not found. Load goodjunk-solo-boss-shim.js before this file.');
      return;
    }

    setTimeout(() => waitForShim(cb, tries + 1), 100);
  }

  function shouldAutoStart(){
    if(!CFG.autoStart) return false;

    return (
      CFG.run === 'play' ||
      CFG.mode === 'solo' ||
      CFG.mode === 'solo_boss' ||
      CFG.mode === 'boss' ||
      QS.get('entry') === 'solo' ||
      QS.get('entry') === 'boss'
    );
  }

  function start(extra){
    if(state.started) return;

    state.started = true;
    state.ended = false;
    state.startAt = Date.now();

    waitForShim(shim => {
      shim.start({
        source:'merge-bridge',
        patch:PATCH,
        ...(extra || {})
      });

      if(CFG.autoEnd){
        startAutoTimer();
      }

      debugRender();
    });
  }

  function startAutoTimer(){
    clearInterval(state.timerId);

    state.timerId = setInterval(() => {
      if(!state.started || state.ended) return;

      const elapsed = Math.floor((Date.now() - state.startAt) / 1000);
      const left = CFG.time - elapsed;

      if(left <= 0){
        clearInterval(state.timerId);
        end('time-up-auto');
      }

      debugRender();
    }, 500);
  }

  function end(reason, extra){
    if(state.ended) return;

    state.ended = true;
    clearInterval(state.timerId);

    waitForShim(shim => {
      shim.end(reason || 'finished', {
        source:'merge-bridge',
        patch:PATCH,
        hitCount:state.hitCount,
        missCount:state.missCount,
        spawned:state.spawned,
        ...(extra || {})
      });

      debugRender();
    });
  }

  function forceSummary(extra){
    waitForShim(shim => {
      if(shim.forceSummary){
        shim.forceSummary({
          source:'merge-bridge',
          patch:PATCH,
          ...(extra || {})
        });
      }else{
        end('force-summary', extra);
      }
    });
  }

  function normalizeType(type, el){
    type = String(type || '').toLowerCase().trim();

    if(type === 'bad') return 'junk';
    if(type === 'trap' || type === 'fakehealthy' || type === 'fake-healthy') return 'fake';

    if(type === 'good' || type === 'junk' || type === 'fake') return type;

    const cls = el ? String(el.className || '').toLowerCase() : '';

    if(cls.includes('junk') || cls.includes('bad')) return 'junk';
    if(cls.includes('fake') || cls.includes('trap')) return 'fake';
    if(cls.includes('good') || cls.includes('healthy')) return 'good';

    return 'good';
  }

  function guessIconFromText(text){
    text = String(text || '');

    const m = text.match(/[\u{1F300}-\u{1FAFF}]/u);
    return m ? m[0] : '';
  }

  function readFoodFromElement(el){
    if(!el) return null;

    const ds = el.dataset || {};

    const type = normalizeType(
      ds.foodType ||
      ds.type ||
      ds.kind ||
      ds.gjType ||
      ds.gjFoodType,
      el
    );

    const text = (el.textContent || '').trim();

    const icon =
      ds.icon ||
      ds.foodIcon ||
      el.getAttribute('aria-label') ||
      guessIconFromText(text) ||
      (type === 'good' ? '🥦' : type === 'fake' ? '🧃' : '🍟');

    const name =
      ds.name ||
      ds.foodName ||
      ds.label ||
      el.getAttribute('title') ||
      text.replace(icon, '').trim() ||
      (type === 'good' ? 'อาหารดี' : type === 'fake' ? 'อาหารหลอกตา' : 'อาหารขยะ');

    return {
      id: ds.id || ds.foodId || el.id || `dom_${Date.now()}_${Math.floor(Math.random() * 99999)}`,
      type,
      icon,
      name,
      group: ds.group || ds.foodGroup || type,
      tip: ds.tip || ds.foodTip || '',
      source:'dom-bridge'
    };
  }

  function getPointerPercent(ev){
    return {
      x: clamp((n(ev && ev.clientX, WIN.innerWidth / 2) / Math.max(1, WIN.innerWidth)) * 100, 0, 100),
      y: clamp((n(ev && ev.clientY, WIN.innerHeight / 2) / Math.max(1, WIN.innerHeight)) * 100, 0, 100)
    };
  }

  function bindElement(el){
    if(!el || el.dataset.gjMergeBound === '1') return false;

    const food = readFoodFromElement(el);
    if(!food) return false;

    el.dataset.gjMergeBound = '1';
    el.dataset.foodType = food.type;
    el.dataset.foodName = food.name;
    el.dataset.foodIcon = food.icon;

    waitForShim(shim => {
      if(shim.decorateElement){
        shim.decorateElement(el, food, {
          bindClick:false
        });
      }
    });

    el.addEventListener('click', function(ev){
      if(el.dataset.gjConsumed === '1') return;

      el.dataset.gjConsumed = '1';

      const xy = getPointerPercent(ev);

      hit(el, {
        x:xy.x,
        y:xy.y
      });
    }, { passive:true });

    state.bindCount += 1;
    return true;
  }

  function bindExisting(){
    if(!CFG.autoBind) return;

    const now = performance.now();
    if(now - state.lastBindAt < 250) return;
    state.lastBindAt = now;

    const nodes = DOC.querySelectorAll(FOOD_SELECTORS);
    nodes.forEach(bindElement);

    debugRender();
  }

  function observeDom(){
    if(!CFG.autoBind || state.observer) return;

    state.observer = new MutationObserver(mutations => {
      let shouldBind = false;

      for(const m of mutations){
        if(m.addedNodes && m.addedNodes.length){
          shouldBind = true;
          break;
        }
      }

      if(shouldBind){
        setTimeout(bindExisting, 30);
      }
    });

    state.observer.observe(DOC.body || DOC.documentElement, {
      childList:true,
      subtree:true
    });
  }

  function hit(elOrFood, extra){
    extra = extra || {};

    waitForShim(shim => {
      let food = null;
      let el = null;

      if(elOrFood && elOrFood.nodeType === 1){
        el = elOrFood;
        food = readFoodFromElement(el);
      }else{
        food = elOrFood;
      }

      if(!food && shim.makeFood){
        food = shim.makeFood();
      }

      state.hitCount += 1;

      shim.hit(food, {
        source:'merge-bridge',
        patch:PATCH,
        el,
        x:n(extra.x, 50),
        y:n(extra.y, 50),
        ...(extra || {})
      });

      debugRender();
    });
  }

  function miss(elOrFood, extra){
    extra = extra || {};

    waitForShim(shim => {
      let food = null;
      let el = null;

      if(elOrFood && elOrFood.nodeType === 1){
        el = elOrFood;
        food = readFoodFromElement(el);
      }else{
        food = elOrFood;
      }

      if(!food && shim.makeFood){
        food = shim.makeFood();
      }

      state.missCount += 1;

      shim.miss(food, {
        source:'merge-bridge',
        patch:PATCH,
        el,
        x:n(extra.x, 50),
        y:n(extra.y, 80),
        ...(extra || {})
      });

      debugRender();
    });
  }

  function createFoodElement(options){
    options = options || {};

    const shim = WIN.GJBS || WIN.GoodJunkSoloBossShim;
    if(!shim){
      return null;
    }

    const food = options.food || shim.makeFood();
    const tag = options.tag || 'button';

    let el;

    if(shim.createFoodElement){
      el = shim.createFoodElement(food, {
        tag,
        className:options.className || 'food-target goodjunk-food',
        bindClick:false,
        html:options.html
      });
    }else{
      el = DOC.createElement(tag);
      el.className = options.className || 'food-target goodjunk-food';
      el.innerHTML = options.html || `<b>${esc(food.icon)}</b><span>${esc(food.name)}</span>`;
    }

    el.dataset.foodType = food.type;
    el.dataset.foodName = food.name;
    el.dataset.foodIcon = food.icon;
    el.dataset.foodGroup = food.group || food.type;

    bindElement(el);

    state.spawned += 1;
    debugRender();

    return el;
  }

  function spawnInto(container, options){
    container = typeof container === 'string'
      ? DOC.querySelector(container)
      : container;

    if(!container) return null;

    const el = createFoodElement(options || {});
    if(!el) return null;

    container.appendChild(el);
    return el;
  }

  function getModifiers(){
    const shim = WIN.GJBS || WIN.GoodJunkSoloBossShim;
    if(!shim || !shim.getModifiers){
      return {
        speedMul:1,
        spawnIntervalMul:1,
        junkBoost:1,
        fakeChanceAdd:0,
        goodHintChance:0
      };
    }

    return shim.getModifiers();
  }

  function getSpeed(baseSpeed){
    const shim = WIN.GJBS || WIN.GoodJunkSoloBossShim;
    if(shim && shim.getItemSpeed){
      return shim.getItemSpeed(baseSpeed);
    }

    return n(baseSpeed, 1) * n(getModifiers().speedMul, 1);
  }

  function getDelay(baseDelay){
    const shim = WIN.GJBS || WIN.GoodJunkSoloBossShim;
    if(shim && shim.getSpawnDelay){
      return shim.getSpawnDelay(baseDelay);
    }

    return Math.max(220, n(baseDelay, 1000) * n(getModifiers().spawnIntervalMul, 1));
  }

  function markFoodMissed(el){
    if(!el) return;
    if(el.dataset.gjConsumed === '1') return;

    const food = readFoodFromElement(el);

    if(food && food.type === 'good'){
      el.dataset.gjConsumed = '1';
      miss(el, { reason:'good-food-escaped' });
    }
  }

  function markAllVisibleGoodMissed(container){
    container = container
      ? (typeof container === 'string' ? DOC.querySelector(container) : container)
      : DOC;

    if(!container) return;

    const nodes = container.querySelectorAll(FOOD_SELECTORS);
    nodes.forEach(el => {
      const food = readFoodFromElement(el);
      if(food && food.type === 'good'){
        markFoodMissed(el);
      }
    });
  }

  function debugRender(){
    if(!CFG.debug) return;

    if(!state.debugBox){
      state.debugBox = DOC.createElement('pre');
      state.debugBox.className = 'gj-boss-debug';
      state.debugBox.style.top = 'auto';
      state.debugBox.style.bottom = '10px';
      state.debugBox.style.left = '10px';
      state.debugBox.style.right = 'auto';
      DOC.body.appendChild(state.debugBox);
    }

    const mod = getModifiers();

    state.debugBox.textContent =
`GoodJunk Merge Bridge
${PATCH}

ready: ${state.ready}
started: ${state.started}
ended: ${state.ended}

bound: ${state.bindCount}
spawned: ${state.spawned}
hit: ${state.hitCount}
miss: ${state.missCount}

pressure: ${mod.pressure ?? '-'}
assist: ${mod.assist ?? '-'}
phase: ${mod.phaseId ?? '-'}
speed: ${mod.speedMul ?? 1}
delay: ${mod.spawnIntervalMul ?? 1}`;
  }

  function init(){
    waitForShim(() => {
      if(shouldAutoStart()){
        start({ auto:true });
      }

      bindExisting();
      observeDom();
      debugRender();

      log('ready', PATCH);
    });
  }

  WIN.GoodJunkSoloBossMerge = {
    version:PATCH,

    start,
    end,
    forceSummary,

    bindExisting,
    bindElement,

    hit,
    miss,
    markFoodMissed,
    markAllVisibleGoodMissed,

    createFoodElement,
    spawnInto,

    getModifiers,
    getSpeed,
    getDelay,

    readFoodFromElement,

    getState:()=>({
      ...state,
      observer:undefined,
      timerId:undefined,
      debugBox:undefined
    })
  };

  WIN.GJBM = WIN.GoodJunkSoloBossMerge;

  DOC.addEventListener('DOMContentLoaded', init);

  WIN.addEventListener('load', () => {
    setTimeout(bindExisting, 250);
    setTimeout(bindExisting, 900);
  });
})();