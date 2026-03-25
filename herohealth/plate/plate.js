// === /herohealth/plate/plate.js ===
// FULL PATCH v20260325-PLATE-CHILDFRIENDLY-HUBV2

(function () {
  'use strict';

  const PASS_KEYS = [
    'pid','nick','name',
    'run','view','diff','time','seed',
    'studyId','phase','conditionGroup','sessionOrder','blockLabel',
    'siteCode','schoolYear','semester',
    'log','api','debug',
    'grade','zone'
  ];

  const GROUP_META = {
    carb:    { label:'คาร์บ',    icon:'🍚' },
    protein: { label:'โปรตีน',  icon:'🥚' },
    veg:     { label:'ผัก',      icon:'🥦' },
    fruit:   { label:'ผลไม้',    icon:'🍎' },
    fat:     { label:'ไขมัน',    icon:'🧈' }
  };

  const FOOD_BANK = [
    { id:'rice',        name:'ข้าว',         emoji:'🍚', group:'carb',    kind:'good' },
    { id:'bread',       name:'ขนมปัง',      emoji:'🍞', group:'carb',    kind:'good' },
    { id:'corn',        name:'ข้าวโพด',     emoji:'🌽', group:'carb',    kind:'good' },
    { id:'potato',      name:'มันฝรั่ง',    emoji:'🥔', group:'carb',    kind:'good' },
    { id:'noodle',      name:'เส้นก๋วยเตี๋ยว', emoji:'🍜', group:'carb', kind:'good' },

    { id:'egg',         name:'ไข่',          emoji:'🥚', group:'protein', kind:'good' },
    { id:'fish',        name:'ปลา',          emoji:'🐟', group:'protein', kind:'good' },
    { id:'chicken',     name:'ไก่',          emoji:'🍗', group:'protein', kind:'good' },
    { id:'tofu',        name:'เต้าหู้',      emoji:'🧊', group:'protein', kind:'good' },
    { id:'milk',        name:'นม',           emoji:'🥛', group:'protein', kind:'good' },

    { id:'broccoli',    name:'บรอกโคลี',    emoji:'🥦', group:'veg',     kind:'good' },
    { id:'carrot',      name:'แครอท',       emoji:'🥕', group:'veg',     kind:'good' },
    { id:'cabbage',     name:'กะหล่ำปลี',   emoji:'🥬', group:'veg',     kind:'good' },
    { id:'tomato',      name:'มะเขือเทศ',   emoji:'🍅', group:'veg',     kind:'good' },
    { id:'cucumber',    name:'แตงกวา',      emoji:'🥒', group:'veg',     kind:'good' },

    { id:'banana',      name:'กล้วย',        emoji:'🍌', group:'fruit',   kind:'good' },
    { id:'apple',       name:'แอปเปิล',      emoji:'🍎', group:'fruit',   kind:'good' },
    { id:'orange',      name:'ส้ม',          emoji:'🍊', group:'fruit',   kind:'good' },
    { id:'watermelon',  name:'แตงโม',       emoji:'🍉', group:'fruit',   kind:'good' },
    { id:'grapes',      name:'องุ่น',        emoji:'🍇', group:'fruit',   kind:'good' },

    { id:'oil',         name:'น้ำมัน',       emoji:'🫗', group:'fat',     kind:'good' },
    { id:'butter',      name:'เนย',          emoji:'🧈', group:'fat',     kind:'good' },
    { id:'coconut',     name:'กะทิ',         emoji:'🥥', group:'fat',     kind:'good' },

    { id:'fries',       name:'เฟรนช์ฟรายส์', emoji:'🍟', group:'fat',    kind:'treat' },
    { id:'donut',       name:'โดนัท',        emoji:'🍩', group:'carb',    kind:'treat' },
    { id:'cake',        name:'เค้ก',         emoji:'🍰', group:'carb',    kind:'treat' },
    { id:'sausage',     name:'ไส้กรอก',      emoji:'🌭', group:'protein', kind:'treat' },
    { id:'chips',       name:'ขนมกรอบ',      emoji:'🍘', group:'fat',     kind:'treat' }
  ];

  const SCENARIOS = [
    {
      id: 'lunch-basic',
      title: 'จัดจานมื้อกลางวัน',
      subtitle: 'เลือกอาหารให้ครบหมู่ แล้วอย่าใส่ของมันมากเกินไป',
      targets: { carb: 2, protein: 1, veg: 2, fruit: 1, fat: 1 },
      coach: 'เริ่มจากคาร์บ 2 ชิ้น แล้วตามด้วยโปรตีน 1 ชิ้น จากนั้นอย่าลืมผัก 2 ชิ้นนะ'
    },
    {
      id: 'breakfast-bright',
      title: 'จัดจานมื้อเช้า',
      subtitle: 'มื้อเช้าควรเบาแต่ครบ และมีผลไม้ด้วย',
      targets: { carb: 1, protein: 1, veg: 1, fruit: 1, fat: 1 },
      coach: 'มื้อเช้าไม่ต้องเยอะเกินไป แต่ควรครบและสดใส'
    },
    {
      id: 'after-play',
      title: 'จัดจานหลังเล่นกีฬา',
      subtitle: 'หลังขยับร่างกาย ควรเติมพลังและซ่อมแซมกล้ามเนื้อ',
      targets: { carb: 2, protein: 2, veg: 1, fruit: 1, fat: 1 },
      coach: 'ลองคิดว่าร่างกายต้องการทั้งพลังงานและโปรตีนเพิ่มขึ้น'
    },
    {
      id: 'rainbow-lunch',
      title: 'จานสีรุ้ง',
      subtitle: 'ใส่ผักผลไม้ให้เด่น แล้วให้จานยังสมดุลอยู่',
      targets: { carb: 1, protein: 1, veg: 2, fruit: 2, fat: 1 },
      coach: 'ด่านนี้ผักกับผลไม้สำคัญมากเป็นพิเศษ'
    },
    {
      id: 'smart-school',
      title: 'จานไปโรงเรียน',
      subtitle: 'อย่าเผลอหยิบขนมหรือของทอดมากเกินไป',
      targets: { carb: 2, protein: 1, veg: 2, fruit: 1, fat: 0 },
      coach: 'ด่านนี้ต้องระวังตัวลวง ถ้าเลี่ยงได้จานจะสวยมาก'
    },
    {
      id: 'balanced-master',
      title: 'จานสมดุลพิเศษ',
      subtitle: 'ครบหมู่พอดี และต้องไม่เกินเป้าหมายเลย',
      targets: { carb: 2, protein: 1, veg: 2, fruit: 2, fat: 0 },
      coach: 'ดูให้ดีว่าด่านนี้ไม่อยากได้ไขมันเพิ่มเลย'
    }
  ];

  const qs = new URLSearchParams(location.search);
  const $ = (sel) => document.querySelector(sel);

  const state = {
    diff: (qs.get('diff') || 'normal').toLowerCase(),
    timeLimit: clampInt(qs.get('time'), 90, 45, 300),
    timeLeft: clampInt(qs.get('time'), 90, 45, 300),
    seed: Number(qs.get('seed') || Date.now()) || Date.now(),
    view: qs.get('view') || 'mobile',
    pid: qs.get('pid') || 'anon',
    nick: qs.get('nick') || qs.get('name') || qs.get('pid') || 'anon',
    hub: qs.get('hub') || new URL('../hub.html', location.href).toString(),
    run: qs.get('run') || 'play',

    roundIndex: 0,
    roundTotal: 4,
    score: 0,
    stars: 0,
    rounds: [],
    currentScenario: null,
    currentFoods: [],
    trayFoods: [],
    filter: 'all',
    locked: false,
    ended: false,
    timerId: null,
    rng: null
  };

  state.roundTotal = state.diff === 'easy' ? 3 : state.diff === 'hard' ? 5 : 4;
  state.rng = mulberry32(state.seed);

  const els = {
    uiStars: $('#uiStars'),
    uiScore: $('#uiScore'),
    uiTime: $('#uiTime'),
    uiRound: $('#uiRound'),
    uiDiff: $('#uiDiff'),
    uiTitle: $('#uiTitle'),
    uiSubtitle: $('#uiSubtitle'),
    targetGrid: $('#targetGrid'),
    uiBalancePct: $('#uiBalancePct'),
    uiBalanceFill: $('#uiBalanceFill'),
    coachBox: $('#coachBox'),
    foodGrid: $('#foodGrid'),
    tabs: $('#tabs'),
    btnUndo: $('#btnUndo'),
    btnReset: $('#btnReset'),
    btnCheck: $('#btnCheck'),
    btnReplay: $('#btnReplay'),
    btnBackHubTop: $('#btnBackHubTop'),
    btnBackHubSummary: $('#btnBackHubSummary'),
    summaryLayer: $('#summaryLayer'),
    sumTitle: $('#sumTitle'),
    sumText: $('#sumText'),
    sumScore: $('#sumScore'),
    sumStars: $('#sumStars'),
    sumRounds: $('#sumRounds'),
    sumRoundsList: $('#sumRoundsList')
  };

  function clampInt(v, fallback, min, max){
    const n = Number(v);
    const base = Number.isFinite(n) ? Math.round(n) : fallback;
    return Math.max(min, Math.min(max, base));
  }

  function mulberry32(a){
    let t = a >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr){
    const copy = arr.slice();
    for(let i = copy.length - 1; i > 0; i--){
      const j = Math.floor(state.rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function pickScenario(roundIndex){
    const pool = shuffle(SCENARIOS);
    return pool[roundIndex % pool.length];
  }

  function buildTrayFoods(scenario){
    const need = [];
    Object.keys(scenario.targets).forEach((group) => {
      const amount = scenario.targets[group];
      const candidates = FOOD_BANK.filter((f) => f.group === group && f.kind === 'good');
      for(let i = 0; i < Math.max(2, amount + 1); i++){
        if(candidates[i % candidates.length]) need.push(candidates[i % candidates.length]);
      }
    });

    const decoyCount = state.diff === 'easy' ? 3 : state.diff === 'hard' ? 7 : 5;
    const decoys = shuffle(
      FOOD_BANK.filter((f) => f.kind === 'treat')
    ).slice(0, decoyCount);

    const extras = shuffle(
      FOOD_BANK.filter((f) => f.kind === 'good' && !need.some((n) => n.id === f.id))
    ).slice(0, state.diff === 'easy' ? 5 : state.diff === 'hard' ? 8 : 6);

    const merged = shuffle([...need, ...decoys, ...extras]);
    const unique = [];
    const seen = new Set();

    merged.forEach((f) => {
      if(!seen.has(f.id)){
        seen.add(f.id);
        unique.push(f);
      }
    });

    return unique;
  }

  function carryQuery(url, extra = {}){
    const u = new URL(url, location.href);
    PASS_KEYS.forEach((k) => {
      if(qs.has(k) && !u.searchParams.has(k)) u.searchParams.set(k, qs.get(k));
    });
    Object.entries(extra).forEach(([k, v]) => {
      if(v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
    });
    return u.toString();
  }

  function getReplayUrl(){
    return carryQuery('../plate-vr.html', {
      diff: state.diff,
      time: state.timeLimit,
      view: state.view,
      seed: Date.now(),
      zone: 'nutrition',
      game: 'plate',
      hub: state.hub
    });
  }

  function updateTop(){
    els.uiStars.textContent = String(state.stars);
    els.uiScore.textContent = String(state.score);
    els.uiTime.textContent = String(state.timeLeft);
    els.uiRound.textContent = `ด่าน ${Math.min(state.roundIndex + 1, state.roundTotal)} / ${state.roundTotal}`;
    els.uiDiff.textContent = state.diff === 'easy' ? 'Easy' : state.diff === 'hard' ? 'Hard' : 'Normal';

    els.btnBackHubTop.href = state.hub;
    els.btnBackHubSummary.href = state.hub;
  }

  function renderTargets(){
    const s = state.currentScenario;
    if(!s) return;

    els.uiTitle.textContent = s.title;
    els.uiSubtitle.textContent = s.subtitle;

    els.targetGrid.innerHTML = Object.entries(s.targets).map(([group, target]) => {
      const now = getCounts()[group];
      const label = group === 'fat' ? `ได้ไม่เกิน ${target}` : `เป้าหมาย ${target}`;
      return `
        <div class="target-item">
          <div class="top">
            <span class="icon">${GROUP_META[group].icon}</span>
            <span>${GROUP_META[group].label}</span>
          </div>
          <div class="goal">${label}</div>
          <div class="now">ตอนนี้ ${now}</div>
        </div>
      `;
    }).join('');

    Object.keys(GROUP_META).forEach((group) => {
      const t = s.targets[group];
      const el = document.getElementById(`target-${group}`);
      if(el){
        el.textContent = group === 'fat' ? `ได้ไม่เกิน ${t}` : `เป้าหมาย ${t}`;
      }
    });

    els.coachBox.innerHTML = `โค้ชเชฟบอกว่า: ${s.coach}`;
  }

  function getCounts(){
    const out = { carb:0, protein:0, veg:0, fruit:0, fat:0, treat:0 };
    state.currentFoods.forEach((f) => {
      out[f.group] += 1;
      if(f.kind === 'treat') out.treat += 1;
    });
    return out;
  }

  function getBalanceScore(){
    const s = state.currentScenario;
    const c = getCounts();
    if(!s) return { pct:0, notes:[] };

    let penalties = 0;
    const notes = [];

    ['carb','protein','veg','fruit'].forEach((group) => {
      const delta = Math.abs(c[group] - s.targets[group]);
      penalties += delta * 12;
      if(c[group] < s.targets[group]) notes.push(`${GROUP_META[group].label}ยังน้อย`);
      if(c[group] > s.targets[group]) notes.push(`${GROUP_META[group].label}เยอะไปนิด`);
    });

    const fatOver = Math.max(0, c.fat - s.targets.fat);
    penalties += fatOver * 16;
    if(fatOver > 0) notes.push('ไขมันมากเกินไป');

    penalties += c.treat * 10;
    if(c.treat > 0) notes.push('มีตัวลวงอยู่ในจาน');

    const pct = Math.max(0, Math.min(100, 100 - penalties));
    return { pct, notes };
  }

  function renderPlate(){
    const counts = getCounts();
    const { pct } = getBalanceScore();

    Object.keys(GROUP_META).forEach((group) => {
      const wrap = document.getElementById(`zone-${group}`);
      const countEl = document.getElementById(`count-${group}`);
      if(countEl) countEl.textContent = String(counts[group]);

      const items = state.currentFoods
        .map((f, idx) => ({ ...f, idx }))
        .filter((f) => f.group === group);

      if(wrap){
        if(items.length === 0){
          wrap.innerHTML = `<span class="empty-zone">ยังไม่มีอาหารในหมู่นี้</span>`;
        }else{
          wrap.innerHTML = items.map((f) => `
            <button class="item-chip ${f.kind === 'treat' ? 'treat' : ''}" type="button" data-remove-index="${f.idx}">
              <span>${f.emoji}</span>
              <span>${f.name}</span>
            </button>
          `).join('');
        }
      }
    });

    document.querySelectorAll('[data-remove-index]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if(state.locked || state.ended) return;
        const idx = Number(btn.getAttribute('data-remove-index'));
        if(Number.isInteger(idx)){
          state.currentFoods.splice(idx, 1);
          renderTargets();
          renderPlate();
          refreshCoach();
        }
      });
    });

    els.uiBalancePct.textContent = `${pct}%`;
    els.uiBalanceFill.style.width = `${pct}%`;
  }

  function foodMetaText(food){
    const groupName = GROUP_META[food.group].label;
    if(food.kind === 'treat') return `${groupName} • ตัวลวง`;
    return `${groupName} • ช่วยจัดจาน`;
  }

  function renderTray(){
    const foods = state.trayFoods.filter((food) => {
      if(state.filter === 'all') return true;
      if(state.filter === 'treat') return food.kind === 'treat';
      return food.group === state.filter;
    });

    els.foodGrid.innerHTML = foods.map((food) => `
      <button class="food-btn group-${food.group} kind-${food.kind}" type="button" data-food-id="${food.id}">
        <div class="emoji">${food.emoji}</div>
        <div class="name">${food.name}</div>
        <div class="meta">${foodMetaText(food)}</div>
      </button>
    `).join('');

    els.foodGrid.querySelectorAll('[data-food-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if(state.locked || state.ended) return;
        const id = btn.getAttribute('data-food-id');
        const food = state.trayFoods.find((f) => f.id === id);
        if(!food) return;

        if(state.currentFoods.length >= 10){
          setCoach('จานนี้เต็มแล้ว ลองกดตรวจจาน หรือเอาบางชิ้นออกก่อน');
          return;
        }

        state.currentFoods.push(food);
        renderTargets();
        renderPlate();
        refreshCoach();
      });
    });
  }

  function bindTabs(){
    els.tabs.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        els.tabs.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        state.filter = tab.dataset.filter || 'all';
        renderTray();
      });
    });
  }

  function setCoach(text){
    els.coachBox.innerHTML = `โค้ชเชฟบอกว่า: ${text}`;
  }

  function refreshCoach(){
    const counts = getCounts();
    const s = state.currentScenario;
    const { pct, notes } = getBalanceScore();

    if(state.currentFoods.length === 0){
      setCoach('เริ่มจากเลือกอาหารทีละชิ้นก่อน ลองให้จานนี้มีผักและผลไม้ด้วยนะ');
      return;
    }

    if(pct >= 90){
      setCoach('ดีมากมาก! จานนี้ใกล้สมดุลแล้ว ลองตรวจจานได้เลย');
      return;
    }

    if(counts.veg < s.targets.veg){
      setCoach('ผักยังน้อยอยู่ ลองเพิ่มผักอีกนิดนะ');
      return;
    }

    if(counts.fruit < s.targets.fruit){
      setCoach('ลองเพิ่มผลไม้สักชิ้น จานจะสดใสขึ้นมาก');
      return;
    }

    if(counts.fat > s.targets.fat){
      setCoach('ไขมันเริ่มเยอะไปแล้ว ลองเอาของมันออกบางชิ้นนะ');
      return;
    }

    if(counts.treat > 0){
      setCoach('มีตัวลวงอยู่ในจาน ลองเอาของหวานหรือของทอดออกดู');
      return;
    }

    if(notes.length){
      setCoach(notes[0]);
      return;
    }

    setCoach('จานนี้ไปในทางที่ดีแล้ว ลองดูว่าครบทุกหมู่หรือยัง');
  }

  function resetRound(){
    if(state.ended) return;
    state.currentFoods = [];
    renderTargets();
    renderPlate();
    refreshCoach();
  }

  function buildRoundFeedback(result){
    if(result.stars === 3) return 'สุดยอดเลย จานนี้สมดุลมาก';
    if(result.stars === 2) return 'ดีมาก ใกล้สมดุลแล้ว';
    if(result.stars === 1) return 'เก่งแล้ว ลองปรับอีกนิดจะดีขึ้น';
    return 'ไม่เป็นไร ลองดูว่าขาดหรือเกินตรงไหน แล้วเล่นใหม่ได้';
  }

  function evaluateRound(){
    const s = state.currentScenario;
    const c = getCounts();
    const { pct, notes } = getBalanceScore();

    let scoreAdd = pct;
    if(state.currentFoods.length === 0) scoreAdd = 0;

    let stars = 0;
    if(pct >= 92) stars = 3;
    else if(pct >= 72) stars = 2;
    else if(pct >= 50) stars = 1;

    const feedback = buildRoundFeedback({ stars, pct });
    const detail = notes.length ? notes.join(' • ') : 'ครบและพอดีมาก';

    const result = {
      round: state.roundIndex + 1,
      title: s.title,
      score: scoreAdd,
      stars,
      pct,
      counts: c,
      feedback,
      detail
    };

    state.rounds.push(result);
    state.score += scoreAdd;
    state.stars += stars;

    return result;
  }

  function onCheck(){
    if(state.locked || state.ended) return;
    state.locked = true;

    const result = evaluateRound();
    updateTop();
    setCoach(`${result.feedback} (${result.pct}%)`);

    window.setTimeout(() => {
      state.locked = false;
      if(state.roundIndex >= state.roundTotal - 1 || state.timeLeft <= 0){
        finishGame();
      }else{
        state.roundIndex += 1;
        loadRound();
      }
    }, 1200);
  }

  function loadRound(){
    state.currentScenario = pickScenario(state.roundIndex);
    state.currentFoods = [];
    state.filter = 'all';
    els.tabs.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.filter === 'all');
    });

    state.trayFoods = buildTrayFoods(state.currentScenario);

    updateTop();
    renderTargets();
    renderPlate();
    renderTray();
    refreshCoach();
  }

  function startTimer(){
    clearInterval(state.timerId);
    state.timerId = window.setInterval(() => {
      if(state.ended) return;
      state.timeLeft -= 1;
      if(state.timeLeft <= 0){
        state.timeLeft = 0;
        updateTop();
        clearInterval(state.timerId);
        if(!state.locked){
          finishGame();
        }
        return;
      }
      updateTop();
    }, 1000);
  }

  function overallStars(){
    if(state.rounds.length === 0) return 0;
    const avg = state.stars / state.rounds.length;
    return avg >= 2.5 ? 3 : avg >= 1.5 ? 2 : avg > 0 ? 1 : 0;
  }

  function overallMessage(){
    const star = overallStars();
    if(star === 3) return 'เยี่ยมมาก หนูจัดจานได้สมดุลและระวังตัวลวงได้ดีมาก';
    if(star === 2) return 'ดีมาก จานเริ่มสมดุลแล้ว เหลือปรับอีกนิดเดียว';
    if(star === 1) return 'เก่งแล้ว ลองสังเกตผัก ผลไม้ และไขมันให้มากขึ้นอีกนิด';
    return 'ไม่เป็นไร ลองใหม่ได้ทุกครั้ง ดูก่อนว่าจานไหนยังขาดหรือเกิน';
  }

  function saveSummary(){
    const summary = {
      timestampIso: new Date().toISOString(),
      zone: 'nutrition',
      game: 'plate',
      gameId: 'plate',
      title: 'Plate Adventure',
      score: Math.round(state.score),
      stars: overallStars(),
      coins: overallStars() * 10,
      note: overallMessage(),
      url: getReplayUrl(),
      replayUrl: getReplayUrl(),
      diff: state.diff,
      time: state.timeLimit,
      view: state.view,
      pid: state.pid,
      nick: state.nick,
      seed: state.seed,
      run: state.run
    };

    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    }catch{}

    try{
      const raw = JSON.parse(localStorage.getItem('HHA_SUMMARY_HISTORY') || '[]');
      const list = Array.isArray(raw) ? raw : [];
      list.push(summary);
      localStorage.setItem('HHA_SUMMARY_HISTORY', JSON.stringify(list.slice(-60)));
    }catch{}
  }

  function renderSummary(){
    const score = Math.round(state.score);
    const stars = state.stars;
    const rounds = state.rounds.length;

    els.sumTitle.textContent = overallStars() >= 2 ? 'เก่งมาก' : 'ลองอีกนิด';
    els.sumText.textContent = overallMessage();
    els.sumScore.textContent = String(score);
    els.sumStars.textContent = String(stars);
    els.sumRounds.textContent = String(rounds);

    els.sumRoundsList.innerHTML = state.rounds.map((r) => `
      <article class="summary-item">
        <div class="top">
          <div class="name">ด่าน ${r.round}: ${r.title}</div>
          <div class="stars">${'⭐'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</div>
        </div>
        <div class="txt">
          ${r.feedback} • ความสมดุล ${r.pct}%<br>
          ${r.detail}
        </div>
      </article>
    `).join('');

    els.summaryLayer.hidden = false;
  }

  function finishGame(){
    if(state.ended) return;
    state.ended = true;
    clearInterval(state.timerId);

    saveSummary();
    renderSummary();
  }

  function bindActions(){
    els.btnUndo.addEventListener('click', () => {
      if(state.locked || state.ended) return;
      state.currentFoods.pop();
      renderTargets();
      renderPlate();
      refreshCoach();
    });

    els.btnReset.addEventListener('click', () => {
      if(state.locked || state.ended) return;
      resetRound();
    });

    els.btnCheck.addEventListener('click', onCheck);

    els.btnReplay.addEventListener('click', () => {
      location.href = getReplayUrl();
    });
  }

  function boot(){
    bindTabs();
    bindActions();
    updateTop();
    loadRound();
    startTimer();
  }

  boot();
})();