// === /herohealth/vr-goodjunk/goodjunk-solo-boss-foodbank.js ===
// GoodJunk Solo Boss Challenge Tuning + Anti-Repetition Food Bank
// PATCH v8.41.3-CHALLENGE-TUNING-ANTI-REPETITION-FOODBANK
// ✅ bigger food bank
// ✅ anti-repetition food picker
// ✅ wave-aware good/junk/fake tuning
// ✅ rare / power / trap food tags
// ✅ director-aware pressure + assist tuning
// ✅ patches GJBS.makeFood()
// ✅ patches GJBS.decorateElement() for extra visual tags
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.41.3-CHALLENGE-TUNING-ANTI-REPETITION-FOODBANK';

  const CFG = {
    diff: String(QS.get('diff') || 'normal').toLowerCase(),
    seed: Number(QS.get('seed')) || Date.now(),
    debug: QS.get('debugBoss') === '1',
    enabled: QS.get('foodbank') !== '0'
  };

  const DIFF = {
    easy: {
      good: 0.66,
      junk: 0.24,
      fake: 0.10,
      rareChance: 0.09,
      powerChance: 0.08,
      repeatWindow: 4
    },
    normal: {
      good: 0.58,
      junk: 0.29,
      fake: 0.13,
      rareChance: 0.11,
      powerChance: 0.075,
      repeatWindow: 5
    },
    hard: {
      good: 0.52,
      junk: 0.32,
      fake: 0.16,
      rareChance: 0.12,
      powerChance: 0.07,
      repeatWindow: 6
    },
    challenge: {
      good: 0.48,
      junk: 0.34,
      fake: 0.18,
      rareChance: 0.14,
      powerChance: 0.065,
      repeatWindow: 7
    }
  };

  const D = DIFF[CFG.diff] || DIFF.normal;

  let rngState = CFG.seed >>> 0;
  function rand(){
    rngState += 0x6D2B79F5;
    let t = rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function pick(arr){
    if(!arr || !arr.length) return null;
    return arr[Math.floor(rand() * arr.length)];
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
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

  const BANK = {
    good: [
      // fruit
      { icon:'🍎', name:'แอปเปิล', group:'fruit', level:'basic', tip:'ผลไม้ช่วยเพิ่มวิตามินและใยอาหาร' },
      { icon:'🍌', name:'กล้วย', group:'fruit', level:'basic', tip:'กล้วยให้พลังงานที่ดีและกินง่าย' },
      { icon:'🍊', name:'ส้ม', group:'fruit', level:'basic', tip:'ส้มมีวิตามินซี ช่วยดูแลร่างกาย' },
      { icon:'🍉', name:'แตงโม', group:'fruit', level:'basic', tip:'ผลไม้มีน้ำมาก ช่วยสดชื่น' },
      { icon:'🍍', name:'สับปะรด', group:'fruit', level:'normal', tip:'ผลไม้รสเปรี้ยวหวาน ควรกินพอดี' },
      { icon:'🫐', name:'เบอร์รี', group:'fruit', level:'rare', tip:'ผลไม้สีเข้มมีสารอาหารที่ดี' },

      // vegetable
      { icon:'🥦', name:'บรอกโคลี', group:'veg', level:'basic', tip:'ผักช่วยให้ร่างกายแข็งแรง' },
      { icon:'🥕', name:'แครอท', group:'veg', level:'basic', tip:'ผักสีส้มมีประโยชน์ต่อสายตา' },
      { icon:'🥬', name:'ผักใบเขียว', group:'veg', level:'basic', tip:'ผักใบเขียวมีใยอาหารและวิตามิน' },
      { icon:'🥒', name:'แตงกวา', group:'veg', level:'basic', tip:'ผักกินง่าย ช่วยเพิ่มความสดชื่น' },
      { icon:'🌽', name:'ข้าวโพด', group:'veg', level:'normal', tip:'ข้าวโพดให้พลังงานและใยอาหาร' },
      { icon:'🍅', name:'มะเขือเทศ', group:'veg', level:'normal', tip:'มะเขือเทศมีวิตามินและสีสันในจานอาหาร' },

      // protein
      { icon:'🥚', name:'ไข่', group:'protein', level:'basic', tip:'ไข่เป็นโปรตีนที่ช่วยซ่อมแซมร่างกาย' },
      { icon:'🐟', name:'ปลา', group:'protein', level:'basic', tip:'ปลาเป็นโปรตีนที่ดีต่อร่างกาย' },
      { icon:'🍗', name:'ไก่ไม่ติดหนัง', group:'protein', level:'normal', tip:'โปรตีนช่วยสร้างกล้ามเนื้อและซ่อมแซมร่างกาย' },
      { icon:'🫘', name:'ถั่ว', group:'protein', level:'basic', tip:'ถั่วเป็นโปรตีนจากพืช' },
      { icon:'🥛', name:'นม', group:'protein', level:'basic', tip:'นมช่วยดูแลกระดูกและฟัน' },
      { icon:'🧀', name:'ชีสพอดีคำ', group:'protein', level:'normal', tip:'ชีสมีโปรตีนและแคลเซียม แต่ควรกินพอดี' },

      // carb / energy
      { icon:'🍚', name:'ข้าว', group:'carb', level:'basic', tip:'ข้าวให้พลังงานสำหรับทำกิจกรรม' },
      { icon:'🍞', name:'ขนมปังโฮลวีต', group:'carb', level:'normal', tip:'โฮลวีตมีใยอาหารมากกว่าขนมปังขาว' },
      { icon:'🥔', name:'มันฝรั่งต้ม', group:'carb', level:'normal', tip:'ต้ม/อบดีกว่าทอด เพราะน้ำมันน้อยกว่า' },
      { icon:'🍠', name:'มันเทศ', group:'carb', level:'rare', tip:'มันเทศให้พลังงานและมีใยอาหาร' },

      // power balanced
      { icon:'🍱', name:'ข้าวกล่องครบหมู่', group:'balanced', level:'rare', tip:'อาหารครบหมู่ช่วยให้ได้สารอาหารหลากหลาย' },
      { icon:'🥗', name:'สลัดผักพอดีซอส', group:'veg', level:'rare', tip:'ผักดี และควรใส่ซอสพอดี' }
    ],

    junk: [
      { icon:'🍟', name:'เฟรนช์ฟรายส์', group:'fried', level:'basic', tip:'ของทอดควรกินแต่น้อย' },
      { icon:'🍩', name:'โดนัท', group:'sweet', level:'basic', tip:'โดนัทมีน้ำตาลและไขมันสูง' },
      { icon:'🍭', name:'ลูกอม', group:'sweet', level:'basic', tip:'ลูกอมมีน้ำตาลสูงและอาจทำให้ฟันผุ' },
      { icon:'🥤', name:'น้ำอัดลม', group:'sweetDrink', level:'basic', tip:'น้ำอัดลมมีน้ำตาลสูง' },
      { icon:'🍔', name:'เบอร์เกอร์มันเยอะ', group:'fastfood', level:'normal', tip:'อาหารจานด่วนบางอย่างมีไขมันและโซเดียมสูง' },
      { icon:'🍕', name:'พิซซ่าชีสเยอะ', group:'fastfood', level:'normal', tip:'ควรกินพอดี ไม่บ่อยเกินไป' },
      { icon:'🌭', name:'ฮอตดอก', group:'processed', level:'normal', tip:'อาหารแปรรูปมักมีโซเดียมสูง' },
      { icon:'🍰', name:'เค้กครีม', group:'sweet', level:'normal', tip:'เค้กครีมมีน้ำตาลและไขมันสูง' },
      { icon:'🍫', name:'ช็อกโกแลตหวาน', group:'sweet', level:'normal', tip:'ขนมหวานควรกินเป็นครั้งคราว' },
      { icon:'🍪', name:'คุกกี้หวาน', group:'sweet', level:'normal', tip:'คุกกี้มีน้ำตาลและไขมันแฝงได้' },
      { icon:'🧋', name:'ชานมไข่มุกหวาน', group:'sweetDrink', level:'hard', tip:'เครื่องดื่มหวานอาจมีน้ำตาลสูงมาก' },
      { icon:'🍜', name:'บะหมี่กึ่งสำเร็จรูป', group:'sodium', level:'hard', tip:'บะหมี่กึ่งสำเร็จรูปมักมีโซเดียมสูง' }
    ],

    fake: [
      { icon:'🧃', name:'น้ำผลไม้หวาน', group:'fakeDrink', level:'basic', tip:'ดูเหมือนผลไม้ แต่บางชนิดน้ำตาลสูงมาก' },
      { icon:'🥣', name:'ซีเรียลหวาน', group:'fakeBreakfast', level:'basic', tip:'ซีเรียลบางแบบมีน้ำตาลแฝงสูง' },
      { icon:'🍌', name:'กล้วยทอด', group:'fakeFried', level:'basic', tip:'กล้วยดี แต่ทอดแล้วมีน้ำมันมาก' },
      { icon:'🥗', name:'สลัดราดครีมเยอะ', group:'fakeSauce', level:'normal', tip:'ผักดี แต่ซอสครีมเยอะเกินไปไม่ดี' },
      { icon:'🍵', name:'ชาเขียวหวาน', group:'fakeDrink', level:'normal', tip:'ชื่อดูดี แต่ถ้าหวานมากก็ไม่ควรดื่มบ่อย' },
      { icon:'🥤', name:'สมูทตี้หวานจัด', group:'fakeDrink', level:'normal', tip:'สมูทตี้บางแก้วใส่น้ำเชื่อมหรือนมข้นมาก' },
      { icon:'🥜', name:'ถั่วเคลือบน้ำตาล', group:'fakeSweet', level:'hard', tip:'ถั่วดี แต่เคลือบน้ำตาลทำให้หวานเกินไป' },
      { icon:'🍠', name:'มันทอดกรอบ', group:'fakeFried', level:'hard', tip:'มันเป็นอาหารให้พลังงาน แต่ทอดกรอบมีน้ำมันมาก' },
      { icon:'🍞', name:'ขนมปังหวานไส้ครีม', group:'fakeBakery', level:'hard', tip:'ขนมปังบางชนิดมีน้ำตาลและครีมแฝง' },
      { icon:'🧀', name:'ชีสบอลทอด', group:'fakeFried', level:'challenge', tip:'ชีสมีประโยชน์บ้าง แต่ทอดแล้วไขมันสูงขึ้น' },
      { icon:'🍱', name:'กล่องอาหารซอสหวานเยอะ', group:'fakeSauce', level:'challenge', tip:'อาหารดูครบหมู่ แต่ซอสหวานหรือเค็มมากเกินไปไม่ดี' }
    ]
  };

  const state = {
    started:false,
    ended:false,
    spawnCount:0,
    hpPercent:100,
    directorPhase:'opening',
    pressure:0,
    assist:false,
    goodHits:0,
    junkHits:0,
    fakeHits:0,
    misses:0,
    recent:[],
    recentTypes:[],
    patched:false,
    originalMakeFood:null,
    originalDecorate:null,
    debugBox:null
  };

  function levelAllowed(item){
    const level = item.level || 'basic';

    if(CFG.diff === 'easy'){
      return level === 'basic' || level === 'normal' || rand() < 0.18;
    }

    if(CFG.diff === 'normal'){
      return level !== 'challenge' || rand() < 0.20;
    }

    if(CFG.diff === 'hard'){
      return level !== 'challenge' || rand() < 0.48;
    }

    return true;
  }

  function getWave(){
    const phase = state.directorPhase || '';
    const hp = n(state.hpPercent, 100);

    if(phase === 'lastBite' || hp <= 10) return 'lastBite';
    if(phase === 'finalClean' || hp <= 25) return 'finalClean';
    if(phase === 'fakeParade' || hp <= 48) return 'fakeParade';
    if(phase === 'junkGate' || hp <= 72) return 'junkGate';
    return 'opening';
  }

  function getDirectorModifiers(){
    try{
      return WIN.GoodJunkSoloBossDirector?.getModifiers?.() ||
             WIN.GJBS?.getModifiers?.() ||
             {};
    }catch(e){
      return {};
    }
  }

  function getTypeWeights(){
    const mod = getDirectorModifiers();
    const wave = getWave();

    let good = D.good;
    let junk = D.junk;
    let fake = D.fake;

    const pressure = n(mod.pressure, state.pressure);
    const assist = Boolean(mod.assist || state.assist);

    junk += pressure * 0.018;
    fake += pressure * 0.010;
    good -= pressure * 0.025;

    if(wave === 'junkGate'){
      junk += 0.07;
      good -= 0.04;
    }else if(wave === 'fakeParade'){
      fake += 0.09;
      junk -= 0.02;
      good -= 0.05;
    }else if(wave === 'finalClean'){
      good += 0.05;
      junk += 0.02;
      fake += 0.02;
    }else if(wave === 'lastBite'){
      good += 0.04;
      fake += 0.05;
      junk += 0.01;
    }

    if(assist){
      good += 0.16;
      junk -= 0.09;
      fake -= 0.07;
    }

    good = clamp(good, 0.36, 0.78);
    junk = clamp(junk, 0.12, 0.48);
    fake = clamp(fake, 0.04, 0.34);

    const total = good + junk + fake;

    return {
      good: good / total,
      junk: junk / total,
      fake: fake / total,
      wave,
      pressure,
      assist
    };
  }

  function chooseType(){
    const w = getTypeWeights();
    const r = rand();

    if(r < w.good) return 'good';
    if(r < w.good + w.junk) return 'junk';
    return 'fake';
  }

  function recentKey(food){
    return `${food.type}:${food.icon}:${food.name}`;
  }

  function isRecent(food){
    const key = recentKey(food);
    return state.recent.includes(key);
  }

  function remember(food){
    const key = recentKey(food);

    state.recent.unshift(key);
    state.recentTypes.unshift(food.type);

    const windowSize = D.repeatWindow;
    state.recent = state.recent.slice(0, windowSize);
    state.recentTypes = state.recentTypes.slice(0, Math.max(4, windowSize));
  }

  function avoidTooManySameType(type){
    const last3 = state.recentTypes.slice(0, 3);
    return last3.length >= 3 && last3.every(x => x === type);
  }

  function filterByWave(arr, type){
    const wave = getWave();

    let out = arr.filter(levelAllowed);

    if(type === 'good'){
      if(wave === 'opening'){
        out = out.filter(x => ['basic','normal'].includes(x.level || 'basic'));
      }else if(wave === 'finalClean' || wave === 'lastBite'){
        const powerGroups = ['protein','veg','fruit','balanced'];
        const preferred = out.filter(x => powerGroups.includes(x.group));
        if(preferred.length && rand() < 0.72) out = preferred;
      }
    }

    if(type === 'junk'){
      if(wave === 'junkGate'){
        const preferred = out.filter(x => ['fried','sweetDrink','fastfood','sodium'].includes(x.group));
        if(preferred.length && rand() < 0.75) out = preferred;
      }
    }

    if(type === 'fake'){
      if(wave === 'fakeParade' || wave === 'lastBite'){
        const preferred = out.filter(x => ['fakeDrink','fakeSauce','fakeFried','fakeSweet'].includes(x.group));
        if(preferred.length && rand() < 0.80) out = preferred;
      }
    }

    return out.length ? out : arr;
  }

  function pickFoodOfType(type){
    let arr = BANK[type] || BANK.good;
    arr = filterByWave(arr, type);

    let candidates = arr.filter(x => !isRecent({ ...x, type }));

    if(!candidates.length){
      candidates = arr.slice();
    }

    return {
      type,
      ...pick(candidates)
    };
  }

  function chooseFood(){
    let type = chooseType();

    if(avoidTooManySameType(type)){
      if(type === 'good'){
        type = rand() < 0.65 ? 'junk' : 'fake';
      }else{
        type = 'good';
      }
    }

    let food = pickFoodOfType(type);
    food = enrichFood(food);

    remember(food);
    state.spawnCount += 1;

    return food;
  }

  function enrichFood(food){
    const wave = getWave();
    const mod = getDirectorModifiers();

    food = {
      id: food.id || `gjfb_${Date.now()}_${Math.floor(rand() * 99999)}`,
      type: food.type || 'good',
      icon: food.icon || '🥦',
      name: food.name || 'อาหาร',
      group: food.group || food.type || 'good',
      tip: food.tip || '',
      level: food.level || 'basic',
      foodbankPatch: PATCH,
      wave
    };

    const rareChance = D.rareChance + n(mod.pressure, 0) * 0.006;
    const powerChance = D.powerChance + (wave === 'finalClean' || wave === 'lastBite' ? 0.07 : 0);

    if(food.level === 'rare' || rand() < rareChance){
      food.rareFood = true;
    }

    if(food.type === 'good' && rand() < powerChance){
      food.powerFood = true;
      food.goodHint = true;
      food.tip = food.tip || 'อาหารดีช่วยโจมตีบอสแรงขึ้น';
    }

    if(food.type === 'fake'){
      food.warningGlow = true;
      food.trapFood = true;
    }

    if(wave === 'fakeParade' && food.type === 'fake'){
      food.directorPhase = 'fakeParade';
      food.warningGlow = true;
    }

    if(wave === 'lastBite' && food.type === 'good'){
      food.finalStrikeFood = true;
      food.powerFood = true;
      food.goodHint = true;
    }

    // ให้เกมหลัก/summary รู้ว่าอาหารนี้ยากขึ้น
    if(food.type === 'fake' || food.level === 'hard' || food.level === 'challenge'){
      food.challengeFood = true;
    }

    return food;
  }

  function ensureStyle(){
    if(DOC.getElementById('gjFoodBankStyle')) return;

    const css = DOC.createElement('style');
    css.id = 'gjFoodBankStyle';
    css.textContent = `
      .gjfb-rare{
        outline:4px solid rgba(168,85,247,.70) !important;
        outline-offset:4px;
        filter:drop-shadow(0 0 18px rgba(168,85,247,.38));
      }

      .gjfb-power{
        outline:4px solid rgba(250,204,21,.86) !important;
        outline-offset:4px;
        filter:drop-shadow(0 0 20px rgba(250,204,21,.55));
      }

      .gjfb-trap{
        outline:4px solid rgba(249,115,22,.82) !important;
        outline-offset:4px;
        filter:drop-shadow(0 0 19px rgba(249,115,22,.46));
      }

      .gjfb-final{
        animation:gjfbFinalPulse .58s ease-in-out infinite alternate;
      }

      .gjfb-mini{
        position:absolute;
        left:50%;
        top:-13px;
        transform:translateX(-50%);
        min-width:max-content;
        border-radius:999px;
        padding:4px 8px;
        color:#fff;
        background:rgba(15,23,42,.82);
        border:1px solid rgba(255,255,255,.55);
        box-shadow:0 9px 18px rgba(15,23,42,.20);
        font-size:10px;
        font-weight:1000;
        line-height:1;
        pointer-events:none;
      }

      .gjfb-debug{
        position:fixed;
        left:10px;
        bottom:calc(110px + env(safe-area-inset-bottom));
        z-index:100085;
        width:min(300px, calc(100vw - 20px));
        border-radius:16px;
        padding:10px;
        background:rgba(15,23,42,.86);
        color:#e5e7eb;
        font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        font-size:11px;
        line-height:1.35;
        white-space:pre-wrap;
        pointer-events:none;
      }

      @keyframes gjfbFinalPulse{
        from{ transform:scale(1) rotate(-1deg); }
        to{ transform:scale(1.075) rotate(1deg); }
      }
    `;

    DOC.head.appendChild(css);
  }

  function addTag(el, text){
    if(!el || el.querySelector('.gjfb-mini')) return;

    const tag = DOC.createElement('i');
    tag.className = 'gjfb-mini';
    tag.textContent = text;
    el.appendChild(tag);
  }

  function decorateFoodElement(el, food){
    if(!el || !food) return el;

    ensureStyle();

    el.dataset.foodbank = '1';
    el.dataset.foodWave = food.wave || getWave();

    if(food.rareFood){
      el.classList.add('gjfb-rare');
      addTag(el, 'RARE');
    }

    if(food.powerFood){
      el.classList.add('gjfb-power');
      addTag(el, 'POWER');
    }

    if(food.trapFood || food.type === 'fake'){
      el.classList.add('gjfb-trap');
      addTag(el, 'ดูให้ดี!');
    }

    if(food.finalStrikeFood){
      el.classList.add('gjfb-final');
      addTag(el, 'FINAL!');
    }

    if(food.challengeFood){
      el.dataset.challengeFood = '1';
    }

    return el;
  }

  function patchShim(shim){
    if(!shim || state.patched || !CFG.enabled) return;

    state.originalMakeFood = typeof shim.makeFood === 'function'
      ? shim.makeFood.bind(shim)
      : null;

    state.originalDecorate = typeof shim.decorateElement === 'function'
      ? shim.decorateElement.bind(shim)
      : null;

    shim.makeFood = function(options){
      options = options || {};

      let food;

      if(options.forceOriginal && state.originalMakeFood){
        food = state.originalMakeFood(options);
      }else{
        food = chooseFood();
      }

      if(WIN.GoodJunkSoloBossDirector?.directFood){
        food = WIN.GoodJunkSoloBossDirector.directFood(food) || food;
      }

      food = {
        ...food,
        foodbankPatch: PATCH
      };

      WIN.dispatchEvent(new CustomEvent('gj:foodbank-food-created', {
        detail:{
          patch:PATCH,
          food,
          wave:getWave(),
          weights:getTypeWeights(),
          recent:state.recent.slice(0, 5)
        }
      }));

      renderDebug();

      return food;
    };

    shim.decorateElement = function(el, food, options){
      let out = el;

      if(state.originalDecorate){
        out = state.originalDecorate(el, food, options);
      }

      decorateFoodElement(out || el, food);

      return out || el;
    };

    state.patched = true;

    WIN.dispatchEvent(new CustomEvent('gj:foodbank-patched', {
      detail:{
        patch:PATCH,
        diff:CFG.diff,
        bankSize:{
          good:BANK.good.length,
          junk:BANK.junk.length,
          fake:BANK.fake.length
        }
      }
    }));

    renderDebug();
  }

  function waitForShim(cb, tries){
    tries = tries || 0;

    const shim = WIN.GJBS || WIN.GoodJunkSoloBossShim;
    if(shim || tries >= 100){
      cb(shim || null);
      return;
    }

    setTimeout(() => waitForShim(cb, tries + 1), 80);
  }

  function onStart(){
    state.started = true;
    state.ended = false;
    state.spawnCount = 0;
    state.hpPercent = 100;
    state.directorPhase = 'opening';
    state.pressure = 0;
    state.assist = false;
    state.goodHits = 0;
    state.junkHits = 0;
    state.fakeHits = 0;
    state.misses = 0;
    state.recent = [];
    state.recentTypes = [];
    renderDebug();
  }

  function onItemHit(e){
    const d = e.detail || {};
    const food = d.food || d.item || d;
    const type = String(d.type || food.type || '').toLowerCase();

    if(type === 'good') state.goodHits += 1;
    else if(type === 'junk' || type === 'bad'){
      state.junkHits += 1;
      state.misses += 1;
    }else if(type === 'fake' || type === 'trap'){
      state.fakeHits += 1;
      state.misses += 1;
    }

    renderDebug();
  }

  function onMissGood(){
    state.misses += 1;
    renderDebug();
  }

  function onBossHp(e){
    const d = e.detail || {};
    const hp = n(d.hp, 0);
    const hpMax = Math.max(1, n(d.hpMax, 1));

    state.hpPercent = clamp((hp / hpMax) * 100, 0, 100);
    renderDebug();
  }

  function onDirectorPhase(e){
    const d = e.detail || {};
    if(d.phaseId) state.directorPhase = d.phaseId;
    if(d.hpPercent !== undefined) state.hpPercent = n(d.hpPercent, state.hpPercent);
    renderDebug();
  }

  function onDirectorPressure(e){
    const d = e.detail || {};
    state.pressure = n(d.pressure, state.pressure);
    state.assist = Boolean(d.assist);
    if(d.phaseId) state.directorPhase = d.phaseId;
    if(d.hpPercent !== undefined) state.hpPercent = n(d.hpPercent, state.hpPercent);
    renderDebug();
  }

  function onEnd(){
    state.ended = true;

    const summary = {
      patch:PATCH,
      spawnCount:state.spawnCount,
      goodHits:state.goodHits,
      junkHits:state.junkHits,
      fakeHits:state.fakeHits,
      misses:state.misses,
      wave:getWave(),
      recent:state.recent.slice(0, 8),
      bankSize:{
        good:BANK.good.length,
        junk:BANK.junk.length,
        fake:BANK.fake.length
      },
      savedAt:new Date().toISOString()
    };

    try{
      localStorage.setItem('GJ_SOLO_BOSS_FOODBANK_LAST', JSON.stringify(summary));
    }catch(e){}

    WIN.dispatchEvent(new CustomEvent('gj:foodbank-summary', {
      detail:summary
    }));

    renderDebug();
  }

  function renderDebug(){
    if(!CFG.debug) return;

    ensureStyle();

    let box = DOC.getElementById('gjFoodBankDebug');
    if(!box){
      box = DOC.createElement('pre');
      box.id = 'gjFoodBankDebug';
      box.className = 'gjfb-debug';
      DOC.body.appendChild(box);
      state.debugBox = box;
    }

    const w = getTypeWeights();

    box.textContent =
`GoodJunk FoodBank
${PATCH}

patched: ${state.patched}
diff: ${CFG.diff}
wave: ${w.wave}
hp: ${Math.round(state.hpPercent)}%
pressure: ${w.pressure}
assist: ${w.assist}

weights:
good ${Math.round(w.good * 100)}%
junk ${Math.round(w.junk * 100)}%
fake ${Math.round(w.fake * 100)}%

spawn: ${state.spawnCount}
hit G/J/F: ${state.goodHits}/${state.junkHits}/${state.fakeHits}
misses: ${state.misses}

recent:
${state.recent.slice(0, 5).join('\n') || '-'}`;
  }

  function boot(){
    ensureStyle();

    waitForShim(shim => {
      if(!shim){
        if(CFG.debug) console.warn('[GoodJunk FoodBank] GJBS shim not found.');
        return;
      }
      patchShim(shim);
    });

    WIN.addEventListener('gj:solo-boss-start', onStart);
    WIN.addEventListener('gj:game-start', onStart);
    WIN.addEventListener('gj:boss-start', onStart);

    WIN.addEventListener('gj:item-hit', onItemHit);
    WIN.addEventListener('gj:hit-good', onItemHit);
    WIN.addEventListener('gj:hit-junk', onItemHit);
    WIN.addEventListener('gj:hit-fake', onItemHit);
    WIN.addEventListener('gj:miss-good', onMissGood);

    WIN.addEventListener('gj:boss-hp-change', onBossHp);
    WIN.addEventListener('gj:director-finale-phase', onDirectorPhase);
    WIN.addEventListener('gj:director-pressure', onDirectorPressure);

    WIN.addEventListener('gj:game-end', onEnd);
    WIN.addEventListener('gj:boss-end', onEnd);
    WIN.addEventListener('gj:boss-defeated', onEnd);

    setInterval(() => {
      waitForShim(patchShim);
      renderDebug();
    }, CFG.debug ? 1000 : 2500);

    WIN.dispatchEvent(new CustomEvent('gj:foodbank-ready', {
      detail:{
        patch:PATCH,
        diff:CFG.diff,
        enabled:CFG.enabled,
        bankSize:{
          good:BANK.good.length,
          junk:BANK.junk.length,
          fake:BANK.fake.length
        }
      }
    }));
  }

  WIN.GoodJunkSoloBossFoodBank = {
    version:PATCH,
    bank:BANK,
    chooseFood,
    getTypeWeights,
    getWave,
    patchShim,
    decorateFoodElement,
    getState:()=>({
      patch:PATCH,
      patched:state.patched,
      started:state.started,
      ended:state.ended,
      spawnCount:state.spawnCount,
      hpPercent:state.hpPercent,
      directorPhase:state.directorPhase,
      pressure:state.pressure,
      assist:state.assist,
      goodHits:state.goodHits,
      junkHits:state.junkHits,
      fakeHits:state.fakeHits,
      misses:state.misses,
      recent:state.recent.slice(0, 8),
      weights:getTypeWeights(),
      bankSize:{
        good:BANK.good.length,
        junk:BANK.junk.length,
        fake:BANK.fake.length
      }
    })
  };

  WIN.GJFB = WIN.GoodJunkSoloBossFoodBank;

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();
