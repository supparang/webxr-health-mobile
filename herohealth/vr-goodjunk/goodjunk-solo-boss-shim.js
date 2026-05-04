// === /herohealth/vr-goodjunk/goodjunk-solo-boss-shim.js ===
// GoodJunk Solo Boss Main Game Integration Shim
// PATCH v8.40.6-MAIN-GAME-INTEGRATION-SHIM
// ✅ one API for start / spawn / hit / miss / end
// ✅ bridges Ultimate + Drama + Juice + Reward + Director
// ✅ reduces duplicated event wiring in main game
// ✅ item decoration helpers
// ✅ CSS classes for hint / power / fake phase
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.40.6-MAIN-GAME-INTEGRATION-SHIM';

  const CFG = {
    autoStart: QS.get('autoBoss') !== '0',
    debug: QS.get('debugBoss') === '1',
    run: QS.get('run') || '',
    mode: QS.get('mode') || QS.get('entry') || 'solo_boss',
    diff: QS.get('diff') || 'normal'
  };

  const state = {
    started:false,
    ended:false,
    startAt:0,
    lastEventKey:'',
    lastEventAt:0,
    spawnCount:0,
    hitCount:0,
    missCount:0,
    goodCount:0,
    junkCount:0,
    fakeCount:0,
    endReason:'',
    latestFood:null,
    latestModifiers:null,
    debugBox:null
  };

  const DEFAULT_GOOD = [
    { type:'good', icon:'🍎', name:'แอปเปิล', group:'fruit', tip:'ผลไม้ช่วยเพิ่มวิตามิน' },
    { type:'good', icon:'🥦', name:'บรอกโคลี', group:'veg', tip:'ผักช่วยให้ร่างกายแข็งแรง' },
    { type:'good', icon:'🥚', name:'ไข่', group:'protein', tip:'โปรตีนช่วยซ่อมแซมร่างกาย' },
    { type:'good', icon:'🐟', name:'ปลา', group:'protein', tip:'ปลาเป็นโปรตีนที่ดี' },
    { type:'good', icon:'🍚', name:'ข้าว', group:'carb', tip:'คาร์โบไฮเดรตให้พลังงาน' }
  ];

  const DEFAULT_JUNK = [
    { type:'junk', icon:'🍟', name:'เฟรนช์ฟรายส์', group:'junk', tip:'ของทอดควรกินแต่น้อย' },
    { type:'junk', icon:'🍩', name:'โดนัท', group:'junk', tip:'หวานมาก กินบ่อยไม่ดี' },
    { type:'junk', icon:'🥤', name:'น้ำอัดลม', group:'junk', tip:'น้ำตาลสูง ดื่มบ่อยไม่ดี' }
  ];

  const DEFAULT_FAKE = [
    { type:'fake', icon:'🧃', name:'น้ำผลไม้หวาน', group:'fake', tip:'ดูเหมือนผลไม้ แต่บางชนิดน้ำตาลสูงมาก' },
    { type:'fake', icon:'🥗', name:'สลัดราดครีมเยอะ', group:'fake', tip:'ผักดี แต่ซอสครีมมากไปไม่ดี' }
  ];

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }

  function pick(arr){
    return arr[Math.floor(Math.random() * arr.length)];
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

  function now(){
    return performance.now();
  }

  function ensureStyle(){
    if(DOC.getElementById('gjSoloBossShimStyle')) return;

    const css = DOC.createElement('style');
    css.id = 'gjSoloBossShimStyle';
    css.textContent = `
      .gj-boss-item{
        position:relative;
        transition:
          transform .16s ease,
          filter .16s ease,
          box-shadow .16s ease,
          outline-color .16s ease;
      }

      .gj-boss-item.gj-good-hint{
        outline:4px solid rgba(34,197,94,.72);
        outline-offset:3px;
        filter:drop-shadow(0 0 14px rgba(34,197,94,.50));
        animation:gjBossHintPulse .82s ease-in-out infinite alternate;
      }

      .gj-boss-item.gj-power-food{
        outline:4px solid rgba(250,204,21,.78);
        outline-offset:4px;
        filter:drop-shadow(0 0 18px rgba(250,204,21,.62));
        animation:gjBossPowerFood .72s ease-in-out infinite alternate;
      }

      .gj-boss-item.gj-fake-warning{
        outline:4px solid rgba(249,115,22,.82);
        outline-offset:3px;
        filter:drop-shadow(0 0 16px rgba(249,115,22,.58));
        animation:gjBossFakeBlink .62s ease-in-out infinite alternate;
      }

      .gj-boss-item.gj-hit-pop{
        animation:gjBossItemHit .24s ease forwards;
      }

      .gj-boss-item.gj-miss-pop{
        animation:gjBossItemMiss .28s ease forwards;
      }

      .gj-boss-item .gj-boss-mini-tag{
        position:absolute;
        left:50%;
        top:-10px;
        transform:translateX(-50%);
        min-width:max-content;
        border-radius:999px;
        padding:4px 8px;
        background:rgba(15,23,42,.82);
        color:#fff;
        font-size:11px;
        font-weight:1000;
        line-height:1;
        box-shadow:0 8px 18px rgba(15,23,42,.22);
        pointer-events:none;
      }

      .gj-boss-debug{
        position:fixed;
        right:10px;
        top:calc(10px + env(safe-area-inset-top));
        z-index:100060;
        width:min(300px, calc(100vw - 20px));
        border-radius:16px;
        background:rgba(15,23,42,.86);
        color:#e5e7eb;
        font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        font-size:11px;
        line-height:1.35;
        padding:10px;
        box-shadow:0 12px 30px rgba(15,23,42,.28);
        pointer-events:none;
        white-space:pre-wrap;
      }

      @keyframes gjBossHintPulse{
        from{ transform:scale(1); }
        to{ transform:scale(1.045); }
      }

      @keyframes gjBossPowerFood{
        from{ transform:scale(1) rotate(-1deg); }
        to{ transform:scale(1.06) rotate(1deg); }
      }

      @keyframes gjBossFakeBlink{
        from{ filter:drop-shadow(0 0 9px rgba(249,115,22,.42)); }
        to{ filter:drop-shadow(0 0 20px rgba(239,68,68,.70)); }
      }

      @keyframes gjBossItemHit{
        0%{ transform:scale(1); opacity:1; }
        55%{ transform:scale(1.16); opacity:1; }
        100%{ transform:scale(.6); opacity:0; }
      }

      @keyframes gjBossItemMiss{
        0%{ transform:translateX(0) scale(1); opacity:1; }
        25%{ transform:translateX(-5px) scale(1.03); }
        50%{ transform:translateX(5px) scale(1.03); }
        100%{ transform:translateY(12px) scale(.74); opacity:0; }
      }
    `;
    DOC.head.appendChild(css);
  }

  function dispatch(name, detail){
    WIN.dispatchEvent(new CustomEvent(name, {
      detail: {
        patch: PATCH,
        ...(detail || {})
      }
    }));
  }

  function acceptEvent(type, payload){
    const t = now();
    const food = payload && (payload.food || payload.item || payload);
    const id = payload && (payload.id || payload.itemId || food?.id || food?.name || food?.icon || '');
    const x = payload && (payload.x || payload.xy?.x || '');
    const y = payload && (payload.y || payload.xy?.y || '');

    const key = `${type}|${id}|${x}|${y}`;
    if(key === state.lastEventKey && t - state.lastEventAt < 85){
      return false;
    }

    state.lastEventKey = key;
    state.lastEventAt = t;
    return true;
  }

  function getModifiers(){
    const mod = WIN.GoodJunkSoloBossDirector?.getModifiers?.() || {
      pressure:0,
      assist:false,
      phaseId:'opening',
      hpPercent:100,
      speedMul:1,
      spawnIntervalMul:1,
      junkBoost:1,
      fakeChanceAdd:0,
      bossAttackMul:1,
      goodHintChance:0,
      missionGraceSec:0
    };

    state.latestModifiers = mod;
    return mod;
  }

  function fallbackFood(){
    const mod = getModifiers();
    const fakeChance = clamp(0.12 + n(mod.fakeChanceAdd), 0.06, 0.35);
    const junkChance = clamp(0.30 * n(mod.junkBoost, 1), 0.18, 0.55);

    const r = Math.random();

    if(r < fakeChance) return { ...pick(DEFAULT_FAKE) };
    if(r < fakeChance + junkChance) return { ...pick(DEFAULT_JUNK) };
    return { ...pick(DEFAULT_GOOD) };
  }

  function normalizeFood(food){
    if(!food || typeof food !== 'object'){
      food = fallbackFood();
    }

    const type = String(food.type || food.kind || '').toLowerCase();

    let normalizedType = type;
    if(!normalizedType){
      normalizedType = food.group === 'junk' ? 'junk' : 'good';
    }
    if(normalizedType === 'bad') normalizedType = 'junk';
    if(normalizedType === 'trap' || normalizedType === 'fakehealthy') normalizedType = 'fake';

    return {
      id: food.id || `gjfood_${Date.now()}_${Math.floor(Math.random() * 99999)}`,
      type: normalizedType,
      icon: food.icon || (normalizedType === 'good' ? '🥦' : normalizedType === 'fake' ? '🧃' : '🍟'),
      name: food.name || (normalizedType === 'good' ? 'อาหารดี' : normalizedType === 'fake' ? 'อาหารหลอกตา' : 'อาหารขยะ'),
      group: food.group || normalizedType,
      tip: food.tip || '',
      ...food,
      type: normalizedType
    };
  }

  function makeFood(options){
    options = options || {};

    let food = null;

    if(options.food){
      food = options.food;
    }else{
      food = WIN.GoodJunkSoloBossUltimate?.makeFoodSuggestion?.();
    }

    if(!food){
      food = fallbackFood();
    }

    food = normalizeFood(food);

    if(WIN.GoodJunkSoloBossDirector?.directFood){
      food = WIN.GoodJunkSoloBossDirector.directFood(food) || food;
      food = normalizeFood(food);
    }

    const hint = WIN.GoodJunkSoloBossDirector?.shouldShowGoodHint?.();
    if(hint && food.type === 'good'){
      food.goodHint = true;
    }

    state.spawnCount += 1;
    state.latestFood = food;

    dispatch('gj:shim-food-created', {
      food,
      spawnCount:state.spawnCount,
      modifiers:getModifiers()
    });

    debugRender();

    return food;
  }

  function createFoodElement(food, options){
    ensureStyle();

    food = normalizeFood(food || makeFood());
    options = options || {};

    const el = DOC.createElement(options.tag || 'button');
    el.type = options.tag === 'button' || !options.tag ? 'button' : undefined;
    el.className = options.className || 'gj-food gj-boss-item';
    el.innerHTML = options.html || `<span class="gj-food-icon">${esc(food.icon)}</span><span class="gj-food-name">${esc(food.name)}</span>`;

    decorateElement(el, food, options);

    return el;
  }

  function decorateElement(el, food, options){
    if(!el) return el;

    ensureStyle();

    food = normalizeFood(food);
    options = options || {};

    el.classList.add('gj-boss-item');
    el.dataset.gjBossShim = '1';
    el.dataset.foodId = food.id || '';
    el.dataset.foodType = food.type || '';
    el.dataset.foodName = food.name || '';
    el.dataset.foodGroup = food.group || '';

    if(food.goodHint){
      el.classList.add('gj-good-hint');
      addMiniTag(el, 'GOOD!');
    }

    if(food.powerFood){
      el.classList.add('gj-power-food');
      addMiniTag(el, 'POWER');
    }

    if(food.warningGlow || food.directorPhase === 'fakeParade'){
      el.classList.add('gj-fake-warning');
      addMiniTag(el, 'ดูให้ดี!');
    }

    if(options.bindClick !== false){
      bindElementHit(el, food, options);
    }

    return el;
  }

  function addMiniTag(el, text){
    if(!el || el.querySelector('.gj-boss-mini-tag')) return;

    const tag = DOC.createElement('i');
    tag.className = 'gj-boss-mini-tag';
    tag.textContent = text;
    el.appendChild(tag);
  }

  function bindElementHit(el, food, options){
    if(!el || el.dataset.gjBossHitBound === '1') return el;

    el.dataset.gjBossHitBound = '1';

    el.addEventListener('click', function(ev){
      if(options && options.preventDefault !== false){
        ev.preventDefault();
      }

      const xy = getPointerPercent(ev);
      hit(food, {
        x:xy.x,
        y:xy.y,
        el
      });
    });

    return el;
  }

  function getPointerPercent(ev){
    const x = ev && typeof ev.clientX === 'number'
      ? clamp((ev.clientX / Math.max(1, WIN.innerWidth)) * 100, 0, 100)
      : 50;

    const y = ev && typeof ev.clientY === 'number'
      ? clamp((ev.clientY / Math.max(1, WIN.innerHeight)) * 100, 0, 100)
      : 50;

    return { x, y };
  }

  function start(extra){
    if(state.started) return;

    state.started = true;
    state.ended = false;
    state.startAt = Date.now();

    state.spawnCount = 0;
    state.hitCount = 0;
    state.missCount = 0;
    state.goodCount = 0;
    state.junkCount = 0;
    state.fakeCount = 0;
    state.endReason = '';

    ensureStyle();

    dispatch('gj:solo-boss-start', {
      source:'shim',
      mode:CFG.mode,
      diff:CFG.diff,
      ...(extra || {})
    });

    debugRender();
  }

  function hit(foodOrPayload, extra){
    let payload = {};

    if(foodOrPayload && foodOrPayload.food){
      payload = { ...foodOrPayload };
    }else{
      payload = {
        food: foodOrPayload,
        ...(extra || {})
      };
    }

    const food = normalizeFood(payload.food || payload.item || payload);
    const type = String(payload.type || food.type || '').toLowerCase();

    payload = {
      ...payload,
      type,
      food,
      item:payload.item || food,
      x:n(payload.x, n(payload.xy?.x, 50)),
      y:n(payload.y, n(payload.xy?.y, 50)),
      source:'shim'
    };

    if(!acceptEvent('hit', payload)) return false;

    state.hitCount += 1;

    if(type === 'good') state.goodCount += 1;
    else if(type === 'fake') state.fakeCount += 1;
    else if(type === 'junk') state.junkCount += 1;

    if(payload.el){
      payload.el.classList.add(type === 'good' ? 'gj-hit-pop' : 'gj-miss-pop');
    }

    dispatch('gj:item-hit', payload);

    debugRender();

    return true;
  }

  function miss(foodOrPayload, extra){
    let payload = {};

    if(foodOrPayload && foodOrPayload.food){
      payload = { ...foodOrPayload };
    }else{
      payload = {
        food: foodOrPayload,
        ...(extra || {})
      };
    }

    const food = normalizeFood(payload.food || payload.item || payload);

    payload = {
      ...payload,
      food,
      item:payload.item || food,
      x:n(payload.x, n(payload.xy?.x, 50)),
      y:n(payload.y, n(payload.xy?.y, 50)),
      source:'shim'
    };

    if(!acceptEvent('miss', payload)) return false;

    state.missCount += 1;

    if(payload.el){
      payload.el.classList.add('gj-miss-pop');
    }

    dispatch('gj:miss-good', payload);

    debugRender();

    return true;
  }

  function end(reason, extra){
    if(state.ended) return;

    state.ended = true;
    state.endReason = reason || 'finished';

    const elapsedSec = state.startAt
      ? Math.max(0, Math.round((Date.now() - state.startAt) / 1000))
      : 0;

    const payload = {
      reason:state.endReason,
      elapsedSec,
      spawnCount:state.spawnCount,
      hitCount:state.hitCount,
      missCount:state.missCount,
      goodHits:state.goodCount,
      junkHits:state.junkCount,
      fakeHits:state.fakeCount,
      modifiers:getModifiers(),
      ...(extra || {})
    };

    dispatch('gj:game-end', payload);

    try{
      localStorage.setItem('GJ_SOLO_BOSS_SHIM_LAST', JSON.stringify({
        patch:PATCH,
        ...payload,
        savedAt:new Date().toISOString()
      }));
    }catch(e){}

    debugRender();
  }

  function forceSummary(extra){
    const reward = WIN.GoodJunkSoloBossReward;
    if(reward?.showSummary){
      return reward.showSummary({
        reason:'force-summary',
        ...(extra || {})
      });
    }

    end('force-summary', extra);
    return null;
  }

  function applyModifiersToGlobals(target){
    const mod = getModifiers();

    target = target || WIN;

    target.GJ_BOSS_SPEED_MUL = mod.speedMul;
    target.GJ_BOSS_SPAWN_INTERVAL_MUL = mod.spawnIntervalMul;
    target.GJ_BOSS_JUNK_BOOST = mod.junkBoost;
    target.GJ_BOSS_FAKE_CHANCE_ADD = mod.fakeChanceAdd;
    target.GJ_BOSS_GOOD_HINT_CHANCE = mod.goodHintChance;
    target.GJ_BOSS_ASSIST = mod.assist;

    return mod;
  }

  function getSpawnDelay(baseDelay){
    const mod = getModifiers();
    return Math.max(220, n(baseDelay, 1000) * n(mod.spawnIntervalMul, 1));
  }

  function getItemSpeed(baseSpeed){
    const mod = getModifiers();
    return n(baseSpeed, 1) * n(mod.speedMul, 1);
  }

  function shouldPreferJunk(baseChance){
    const mod = getModifiers();
    return Math.random() < clamp(n(baseChance, 0.25) * n(mod.junkBoost, 1), 0, 0.65);
  }

  function getFakeChance(baseChance){
    const mod = getModifiers();
    return clamp(n(baseChance, 0.10) + n(mod.fakeChanceAdd, 0), 0, 0.45);
  }

  function debugRender(){
    if(!CFG.debug) return;

    ensureStyle();

    if(!state.debugBox){
      state.debugBox = DOC.createElement('pre');
      state.debugBox.className = 'gj-boss-debug';
      DOC.body.appendChild(state.debugBox);
    }

    const mod = getModifiers();

    state.debugBox.textContent =
`GoodJunk Solo Boss Shim
${PATCH}

started: ${state.started}
ended: ${state.ended}
spawn: ${state.spawnCount}
hit: ${state.hitCount}
miss: ${state.missCount}
good/junk/fake: ${state.goodCount}/${state.junkCount}/${state.fakeCount}

pressure: ${mod.pressure}
assist: ${mod.assist}
phase: ${mod.phaseId}
hp: ${Math.round(mod.hpPercent || 0)}%

speedMul: ${mod.speedMul}
spawnMul: ${mod.spawnIntervalMul}
junkBoost: ${mod.junkBoost}
fakeAdd: ${mod.fakeChanceAdd}

latestFood:
${state.latestFood ? `${state.latestFood.icon} ${state.latestFood.name} (${state.latestFood.type})` : '-'}`;
  }

  function autoStart(){
    if(!CFG.autoStart) return;

    const shouldStart =
      CFG.run === 'play' ||
      CFG.mode === 'solo' ||
      CFG.mode === 'solo_boss' ||
      CFG.mode === 'boss' ||
      QS.get('entry') === 'solo' ||
      QS.get('entry') === 'boss';

    if(shouldStart){
      setTimeout(() => start({ auto:true }), 180);
    }
  }

  function bridgeVRShot(){
    WIN.addEventListener('hha:shoot', function(e){
      dispatch('gj:shim-shoot', {
        source:'hha:shoot',
        raw:e.detail || {}
      });
    });
  }

  WIN.GoodJunkSoloBossShim = {
    version:PATCH,

    start,
    end,
    forceSummary,

    makeFood,
    createFoodElement,
    decorateElement,
    bindElementHit,

    hit,
    miss,

    getModifiers,
    applyModifiersToGlobals,
    getSpawnDelay,
    getItemSpeed,
    shouldPreferJunk,
    getFakeChance,

    dispatch,

    getState:()=>JSON.parse(JSON.stringify({
      ...state,
      debugBox:undefined
    }))
  };

  // ชื่อสั้น เผื่อเรียกง่ายในเกมหลัก
  WIN.GJBS = WIN.GoodJunkSoloBossShim;

  WIN.addEventListener('gj:director-pressure', () => {
    applyModifiersToGlobals(WIN);
    debugRender();
  });

  WIN.addEventListener('gj:boss-hp-change', () => debugRender());
  WIN.addEventListener('gj:reward-summary-shown', () => debugRender());

  DOC.addEventListener('DOMContentLoaded', function(){
    ensureStyle();
    bridgeVRShot();
    autoStart();
    debugRender();
  });
})();