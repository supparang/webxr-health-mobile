(() => {
  'use strict';

  const DOC = document;
  const WIN = window;
  const $ = (q) => DOC.querySelector(q);

  const params = new URLSearchParams(WIN.location.search);

  const DIFF = {
    easy: {
      duration: 150,
      lives: 5,
      spawnEvery: 1.02,
      speed: 0.88,
      junkRate: 0.30,
      attackEvery: 8.8
    },
    normal: {
      duration: 150,
      lives: 4,
      spawnEvery: 0.88,
      speed: 1,
      junkRate: 0.38,
      attackEvery: 7.4
    },
    hard: {
      duration: 140,
      lives: 3,
      spawnEvery: 0.74,
      speed: 1.15,
      junkRate: 0.46,
      attackEvery: 6.2
    },
    challenge: {
      duration: 130,
      lives: 3,
      spawnEvery: 0.62,
      speed: 1.28,
      junkRate: 0.52,
      attackEvery: 5.2
    }
  };

  const diff = (params.get('diff') || 'normal').toLowerCase();
  const view = (params.get('view') || 'pc').toLowerCase();
  const safeDiff = DIFF[diff] ? diff : 'normal';
  const base = DIFF[safeDiff];

  const CFG = {
    name: params.get('name') || params.get('nick') || 'Hero',
    pid: params.get('pid') || 'anon',
    diff: safeDiff,
    duration: Math.max(60, Number(params.get('time') || base.duration) || base.duration),
    seed: params.get('seed') || String(Date.now()),
    hub: params.get('hub') || '../nutrition-zone.html',
    view
  };

  DOC.body.classList.toggle('view-cvr', CFG.view === 'cvr' || CFG.view === 'cardboard');

  const FOOD_GOOD = [
    { emoji: '🥚', group: 'protein', name: 'โปรตีน' },
    { emoji: '🐟', group: 'protein', name: 'ปลา' },
    { emoji: '🍗', group: 'protein', name: 'ไก่' },
    { emoji: '🫘', group: 'protein', name: 'ถั่ว' },

    { emoji: '🍚', group: 'carb', name: 'ข้าว' },
    { emoji: '🍞', group: 'carb', name: 'ขนมปัง' },
    { emoji: '🥔', group: 'carb', name: 'มัน' },

    { emoji: '🥦', group: 'veg', name: 'ผัก' },
    { emoji: '🥬', group: 'veg', name: 'ผักใบเขียว' },
    { emoji: '🥕', group: 'veg', name: 'แครอท' },

    { emoji: '🍎', group: 'fruit', name: 'ผลไม้' },
    { emoji: '🍌', group: 'fruit', name: 'กล้วย' },
    { emoji: '🍊', group: 'fruit', name: 'ส้ม' },

    { emoji: '🥑', group: 'fat', name: 'ไขมันดี' },
    { emoji: '🥜', group: 'fat', name: 'ถั่วเปลือกแข็ง' }
  ];

  const FOOD_JUNK = [
    { emoji: '🍟', name: 'เฟรนช์ฟรายส์' },
    { emoji: '🍩', name: 'โดนัท' },
    { emoji: '🥤', name: 'น้ำอัดลม' },
    { emoji: '🍔', name: 'เบอร์เกอร์' },
    { emoji: '🍕', name: 'พิซซ่า' },
    { emoji: '🍭', name: 'ลูกอม' },
    { emoji: '🍰', name: 'เค้ก' },
    { emoji: '🍪', name: 'คุกกี้' }
  ];

  const POWERUPS = [
    { id: 'shield', emoji: '🛡️', label: 'Shield' },
    { id: 'magnet', emoji: '🧲', label: 'Magnet' },
    { id: 'blast', emoji: '✨', label: 'Clean Blast' },
    { id: 'slow', emoji: '⏱️', label: 'Slow Time' },
    { id: 'heart', emoji: '💖', label: 'Heart' }
  ];

  const PHASES = {
    1: {
      pill: 'PHASE 1',
      title: 'PHASE 1',
      desc: 'เก็บอาหารดีให้ไว',
      boss: 'King Burger',
      face: '🍔',
      state: 'ยังไม่โกรธ',
      mission: 'เก็บอาหารดี 6 ชิ้น เพื่อชาร์จพลัง',
      threshold: 75
    },
    2: {
      pill: 'PHASE 2',
      title: 'PHASE 2',
      desc: 'เริ่มมีของหลอก!',
      boss: 'Candy Witch',
      face: '🍭',
      state: 'ใช้ของหลอก',
      mission: 'ระวังอาหารขยะปลอมตัว และเก็บของดีต่อเนื่อง',
      threshold: 45
    },
    3: {
      pill: 'PHASE 3',
      title: 'PHASE 3',
      desc: 'ทำลายโล่บอส',
      boss: 'Fried Monster',
      face: '🍟',
      state: 'มีโล่ป้องกัน',
      mission: 'เก็บอาหารดีให้ครบ 5 หมู่ เพื่อเปิดทางโจมตี',
      threshold: 20
    },
    4: {
      pill: 'FINAL',
      title: 'FINAL RAGE',
      desc: 'บอสคลั่งแล้ว!',
      boss: 'Sugar Dragon',
      face: '🐲',
      state: 'RAGE MODE',
      mission: 'เก็บอาหารดี ชาร์จ HERO HIT แล้วปิดฉากบอส',
      threshold: 0
    }
  };

  const el = {
    app: $('#app'),
    scoreText: $('#scoreText'),
    timeText: $('#timeText'),
    lifeText: $('#lifeText'),
    modePill: $('#modePill'),
    bossFace: $('#bossFace'),
    bossName: $('#bossName'),
    bossState: $('#bossState'),
    bossHp: $('#bossHp'),
    gameArea: $('#gameArea'),
    targetLayer: $('#targetLayer'),
    fxLayer: $('#fxLayer'),
    toast: $('#toast'),
    missionTitle: $('#missionTitle'),
    missionText: $('#missionText'),
    missionCard: $('#missionCard'),
    phaseBanner: $('#phaseBanner'),
    phaseTitle: $('#phaseTitle'),
    phaseDesc: $('#phaseDesc'),
    heroHitBtn: $('#heroHitBtn'),
    heroChargeText: $('#heroChargeText'),
    comboText: $('#comboText'),
    powerText: $('#powerText'),
    startBtn: $('#startBtn'),
    pauseBtn: $('#pauseBtn'),
    soundBtn: $('#soundBtn'),
    backBtn: $('#backBtn'),
    introBackBtn: $('#introBackBtn'),
    introLayer: $('#introLayer'),
    summaryLayer: $('#summaryLayer'),
    summaryEmoji: $('#summaryEmoji'),
    summaryTitle: $('#summaryTitle'),
    summaryMessage: $('#summaryMessage'),
    sumScore: $('#sumScore'),
    sumGood: $('#sumGood'),
    sumMiss: $('#sumMiss'),
    sumStars: $('#sumStars'),
    summaryTip: $('#summaryTip'),
    replayBtn: $('#replayBtn'),
    summaryBackBtn: $('#summaryBackBtn')
  };

  function hashSeed(str){
    let h = 2166136261;
    str = String(str || 'goodjunk');
    for(let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rand = mulberry32(hashSeed(`${CFG.seed}:${CFG.pid}:${CFG.diff}`));

  function random(min, max){
    return min + (max - min) * rand();
  }

  function chance(p){
    return rand() < p;
  }

  function pick(arr){
    return arr[Math.floor(rand() * arr.length) % arr.length];
  }

  const state = {
    running: false,
    paused: false,
    ended: false,

    timeLeft: CFG.duration,
    score: 0,
    lives: base.lives,

    bossMaxHp: 100,
    bossHp: 100,
    phase: 1,

    goodHits: 0,
    junkHits: 0,
    miss: 0,
    combo: 0,
    maxCombo: 0,

    heroCharge: 0,
    shieldUses: 0,
    slowUntil: 0,
    magnetUntil: 0,
    powerLabel: '-',

    phaseGood: 0,
    phaseGroups: new Set(),
    shieldGate: 0,

    items: [],
    itemId: 1,

    lastTs: 0,
    spawnAcc: 0,
    attackAcc: 0,
    powerAcc: 0,

    muted: false,
    audioReady: false,
    audioCtx: null
  };

  function now(){
    return performance.now();
  }

  function clamp(v, min, max){
    return Math.max(min, Math.min(max, v));
  }

  function playTone(type){
    if(state.muted) return;

    try{
      if(!state.audioCtx){
        const AC = WIN.AudioContext || WIN.webkitAudioContext;
        if(!AC) return;
        state.audioCtx = new AC();
      }

      const ctx = state.audioCtx;
      if(ctx.state === 'suspended') ctx.resume();

      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);

      const t = ctx.currentTime;
      let f1 = 520;
      let f2 = 760;
      let dur = 0.12;

      if(type === 'bad'){
        f1 = 170; f2 = 90; dur = 0.18;
      }else if(type === 'boss'){
        f1 = 120; f2 = 360; dur = 0.28;
      }else if(type === 'power'){
        f1 = 760; f2 = 980; dur = 0.22;
      }else if(type === 'win'){
        f1 = 650; f2 = 1040; dur = 0.45;
      }

      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      o.start(t);
      o.stop(t + dur + 0.02);
    }catch(err){
      // keep silent if browser blocks audio
    }
  }

  function showToast(msg, ms = 950){
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => {
      el.toast.classList.add('hidden');
    }, ms);
  }

  function popText(x, y, text, cls = 'good'){
    const n = DOC.createElement('div');
    n.className = `score-pop ${cls}`;
    n.textContent = text;
    n.style.left = `${x}px`;
    n.style.top = `${y}px`;
    el.fxLayer.appendChild(n);
    setTimeout(() => n.remove(), 720);
  }

  function shake(){
    el.gameArea.classList.remove('shake');
    void el.gameArea.offsetWidth;
    el.gameArea.classList.add('shake');
  }

  function setPhase(nextPhase, announce = true){
    nextPhase = clamp(nextPhase, 1, 4);
    if(state.phase === nextPhase && announce) return;

    state.phase = nextPhase;
    state.phaseGood = 0;
    state.phaseGroups = new Set();

    if(nextPhase === 3){
      state.shieldGate = 5;
    }else if(nextPhase === 4){
      state.shieldGate = 0;
    }

    const p = PHASES[nextPhase];

    el.app.classList.remove('phase-1','phase-2','phase-3','phase-4','rage');
    el.app.classList.add(`phase-${nextPhase}`);

    el.modePill.textContent = p.pill;
    el.bossName.textContent = p.boss;
    el.bossFace.textContent = p.face;
    el.bossState.textContent = p.state;
    el.missionText.textContent = p.mission;

    if(nextPhase === 4){
      el.app.classList.add('rage');
    }

    if(announce){
      el.phaseTitle.textContent = p.title;
      el.phaseDesc.textContent = p.desc;
      el.phaseBanner.classList.remove('hidden');
      playTone(nextPhase === 4 ? 'boss' : 'power');
      setTimeout(() => el.phaseBanner.classList.add('hidden'), 980);
    }
  }

  function updatePhaseFromHp(){
    if(state.bossHp <= 20 && state.phase < 4){
      setPhase(4);
    }else if(state.bossHp <= 45 && state.phase < 3){
      setPhase(3);
    }else if(state.bossHp <= 75 && state.phase < 2){
      setPhase(2);
    }
  }

  function updateMissionText(){
    let text = PHASES[state.phase].mission;

    if(state.phase === 1){
      text = `เก็บอาหารดี ${state.phaseGood}/6 ชิ้น เพื่อชาร์จพลัง`;
    }else if(state.phase === 2){
      text = `ระวังของหลอก! เก็บอาหารดีต่อเนื่อง ${state.phaseGood}/8`;
    }else if(state.phase === 3){
      const groups = state.phaseGroups.size;
      if(state.shieldGate > 0){
        text = `โล่บอสยังอยู่! เก็บให้ครบ 5 หมู่: ${groups}/5`;
      }else{
        text = `โล่แตกแล้ว! โจมตีบอสได้เลย`;
      }
    }else{
      text = `FINAL! ชาร์จ HERO HIT แล้วปิดฉากบอส`;
    }

    el.missionText.textContent = text;
  }

  function updateHud(){
    el.scoreText.textContent = String(Math.max(0, Math.round(state.score)));
    el.timeText.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
    el.lifeText.textContent = '❤️'.repeat(Math.max(0, state.lives)) || '💔';

    const hpPct = clamp((state.bossHp / state.bossMaxHp) * 100, 0, 100);
    el.bossHp.style.width = `${hpPct}%`;

    el.heroChargeText.textContent = `${Math.floor(state.heroCharge)}%`;
    el.heroHitBtn.disabled = state.heroCharge < 100 || !state.running || state.paused;

    el.comboText.textContent = `Combo x${state.combo}`;
    el.powerText.textContent = `Power: ${state.powerLabel}`;

    if(state.shieldGate > 0){
      el.bossState.textContent = `โล่ ${state.shieldGate}`;
    }else if(state.phase === 4){
      el.bossState.textContent = 'RAGE MODE';
    }else{
      el.bossState.textContent = PHASES[state.phase].state;
    }

    updateMissionText();
  }

  function itemSpeed(){
    let sp = base.speed;

    if(state.phase === 2) sp *= 1.08;
    if(state.phase === 3) sp *= 1.2;
    if(state.phase === 4) sp *= 1.38;
    if(now() < state.slowUntil) sp *= 0.55;

    return sp;
  }

  function spawnEvery(){
    let every = base.spawnEvery;

    if(state.phase === 2) every *= 0.9;
    if(state.phase === 3) every *= 0.78;
    if(state.phase === 4) every *= 0.62;

    if(state.combo >= 8) every *= 0.92;
    if(now() < state.slowUntil) every *= 1.14;

    return every;
  }

  function currentJunkRate(){
    let rate = base.junkRate;

    if(state.phase === 2) rate += 0.08;
    if(state.phase === 3) rate += 0.12;
    if(state.phase === 4) rate += 0.18;

    if(state.lives <= 1) rate -= 0.10;

    return clamp(rate, 0.22, 0.68);
  }

  function getAreaRect(){
    return el.gameArea.getBoundingClientRect();
  }

  function createTargetNode(item){
    const node = DOC.createElement('button');
    node.type = 'button';
    node.className = `target ${item.kind}`;
    if(item.fake) node.classList.add('fake');
    node.textContent = item.emoji;
    node.setAttribute('aria-label', item.label || item.name || item.kind);
    node.style.left = `${item.x}px`;
    node.style.top = `${item.y}px`;

    node.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      hitItem(item.id);
    }, { passive: false });

    return node;
  }

  function spawnItem(kind, opt = {}){
    if(!state.running || state.paused || state.ended) return;

    const rect = getAreaRect();
    const pad = 46;
    const x = opt.x ?? random(pad, Math.max(pad + 1, rect.width - pad));
    const y = opt.y ?? random(-70, -35);

    let data;
    let fake = false;

    if(kind === 'power'){
      data = opt.power || pick(POWERUPS);
    }else if(kind === 'junk'){
      data = pick(FOOD_JUNK);
      if(opt.fake){
        const fakeGood = pick(FOOD_GOOD);
        data = {
          emoji: fakeGood.emoji,
          name: `ของหลอก: ${data.name}`
        };
        fake = true;
      }
    }else{
      data = opt.good || pick(FOOD_GOOD);
    }

    const speed = opt.speed ?? random(72, 118) * itemSpeed();

    const item = {
      id: state.itemId++,
      kind,
      emoji: data.emoji,
      name: data.name || data.label || kind,
      label: data.label || data.name || kind,
      group: data.group || '',
      fake,
      x,
      y,
      vx: opt.vx ?? random(-10, 10),
      vy: speed,
      born: now(),
      lifeMs: opt.lifeMs || 7500,
      node: null
    };

    item.node = createTargetNode(item);
    state.items.push(item);
    el.targetLayer.appendChild(item.node);
  }

  function spawnNormalWave(){
    const r = currentJunkRate();
    let kind = chance(r) ? 'junk' : 'good';

    if(state.phase === 2 && kind === 'junk' && chance(0.28)){
      spawnItem('junk', { fake: true });
      return;
    }

    if(state.phase === 3 && state.shieldGate > 0 && chance(0.62)){
      const needed = ['protein','carb','veg','fruit','fat'].filter(g => !state.phaseGroups.has(g));
      const group = needed.length ? pick(needed) : pick(['protein','carb','veg','fruit','fat']);
      const good = pick(FOOD_GOOD.filter(f => f.group === group));
      spawnItem('good', { good });
      return;
    }

    spawnItem(kind);
  }

  function spawnPower(){
    const p = pick(POWERUPS);
    spawnItem('power', {
      power: p,
      speed: random(60, 92) * itemSpeed(),
      lifeMs: 8500
    });
  }

  function removeItem(item){
    const idx = state.items.findIndex(v => v.id === item.id);
    if(idx >= 0) state.items.splice(idx, 1);

    if(item.node){
      item.node.classList.add('hit');
      setTimeout(() => item.node && item.node.remove(), 120);
    }
  }

  function damageBoss(amount, label = 'HIT!'){
    if(state.ended) return;

    if(state.shieldGate > 0){
      showToast(`ต้องทำลายโล่ก่อน! เหลือ ${state.shieldGate}`);
      return;
    }

    state.bossHp = clamp(state.bossHp - amount, 0, state.bossMaxHp);
    el.bossFace.animate([
      { transform: 'scale(1) rotate(0deg)' },
      { transform: 'scale(1.18) rotate(-8deg)' },
      { transform: 'scale(1) rotate(0deg)' }
    ], { duration: 240, easing: 'ease-out' });

    showToast(`⚡ ${label} บอส -${Math.round(amount)}`);
    playTone('boss');
    updatePhaseFromHp();

    if(state.bossHp <= 0){
      endGame(true);
    }
  }

  function handleGood(item){
    state.goodHits++;
    state.phaseGood++;
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    if(item.group) state.phaseGroups.add(item.group);

    const comboBonus = Math.min(18, state.combo * 1.5);
    const add = 10 + comboBonus + (state.phase * 2);
    state.score += add;
    state.heroCharge = clamp(state.heroCharge + 8 + state.combo * 0.8, 0, 100);

    popText(item.x, item.y, `+${Math.round(add)}`, 'good');
    playTone('good');

    if(state.phase === 1){
      if(state.phaseGood >= 6){
        damageBoss(7, 'GOOD POWER');
        state.phaseGood = 0;
      }else{
        damageBoss(3.2, 'GOOD');
      }
    }else if(state.phase === 2){
      if(item.fake){
        return;
      }
      if(state.phaseGood >= 8){
        damageBoss(9, 'COMBO STRIKE');
        state.phaseGood = 0;
      }else{
        damageBoss(3.5, 'GOOD');
      }
    }else if(state.phase === 3){
      if(state.shieldGate > 0){
        const before = state.shieldGate;
        state.shieldGate = Math.max(0, 5 - state.phaseGroups.size);

        if(before !== state.shieldGate){
          popText(item.x, item.y, `โล่ -1`, 'gold');
        }

        if(state.shieldGate <= 0){
          showToast('🛡️ โล่บอสแตกแล้ว! โจมตีได้!');
          playTone('power');
          damageBoss(10, 'SHIELD BREAK');
        }
      }else{
        damageBoss(4.5, 'GOOD HIT');
      }
    }else{
      damageBoss(5.2, 'FINAL HIT');
    }
  }

  function handleJunk(item){
    if(state.shieldUses > 0){
      state.shieldUses--;
      state.score += 4;
      popText(item.x, item.y, 'BLOCK!', 'gold');
      showToast('🛡️ Shield กันอาหารขยะแล้ว');
      playTone('power');
      if(state.shieldUses <= 0){
        state.powerLabel = '-';
      }
      return;
    }

    state.junkHits++;
    state.miss++;
    state.combo = 0;
    state.lives--;
    state.heroCharge = Math.max(0, state.heroCharge - 7);
    state.bossHp = Math.min(state.bossMaxHp, state.bossHp + 1.4);

    popText(item.x, item.y, '-❤️', 'bad');
    showToast(`โดนอาหารขยะ! ${item.name}`);
    playTone('bad');
    shake();

    if(state.lives <= 0){
      endGame(false);
    }
  }

  function activatePower(item){
    const id = item.name || item.label;
    const raw = POWERUPS.find(p => p.emoji === item.emoji) || pick(POWERUPS);
    const powerId = raw.id;

    playTone('power');

    if(powerId === 'shield'){
      state.shieldUses = Math.max(state.shieldUses, 1);
      state.powerLabel = 'Shield x1';
      showToast('🛡️ Shield พร้อมกันพลาด 1 ครั้ง');
    }else if(powerId === 'magnet'){
      state.magnetUntil = now() + 6500;
      state.powerLabel = 'Magnet';
      showToast('🧲 ดูดอาหารดี 6 วินาที');
    }else if(powerId === 'blast'){
      let cleared = 0;
      state.items.slice().forEach(it => {
        if(it.kind === 'junk'){
          cleared++;
          popText(it.x, it.y, 'CLEAR', 'gold');
          removeItem(it);
        }
      });
      state.score += cleared * 8;
      damageBoss(8 + cleared * 0.7, 'CLEAN BLAST');
      state.powerLabel = 'Blast!';
    }else if(powerId === 'slow'){
      state.slowUntil = now() + 6000;
      state.powerLabel = 'Slow Time';
      showToast('⏱️ อาหารช้าลง 6 วินาที');
    }else if(powerId === 'heart'){
      state.lives = Math.min(base.lives + 1, state.lives + 1);
      state.powerLabel = 'Heart +1';
      showToast('💖 ได้หัวใจเพิ่ม');
    }

    popText(item.x, item.y, raw.label, 'gold');
  }

  function hitItem(id){
    if(!state.running || state.paused || state.ended) return;

    const item = state.items.find(v => v.id === id);
    if(!item) return;

    removeItem(item);

    if(item.kind === 'good'){
      handleGood(item);
    }else if(item.kind === 'junk'){
      handleJunk(item);
    }else{
      activatePower(item);
    }

    updateHud();
  }

  function updateItems(dt){
    const rect = getAreaRect();
    const t = now();

    state.items.slice().forEach(item => {
      const slow = t < state.slowUntil ? 0.58 : 1;

      item.y += item.vy * dt * slow;
      item.x += item.vx * dt * slow;

      if(t < state.magnetUntil && item.kind === 'good'){
        const cx = rect.width * 0.5;
        const cy = rect.height * 0.58;
        item.x += (cx - item.x) * dt * 1.35;
        item.y += (cy - item.y) * dt * 0.9;
      }

      if(item.x < 34 || item.x > rect.width - 34){
        item.vx *= -1;
        item.x = clamp(item.x, 34, rect.width - 34);
      }

      if(item.node){
        item.node.style.left = `${item.x}px`;
        item.node.style.top = `${item.y}px`;
      }

      const expiredByTime = t - item.born > item.lifeMs;
      const expiredByBottom = item.y > rect.height + 86;

      if(expiredByTime || expiredByBottom){
        if(item.kind === 'good'){
          state.miss++;
          state.combo = 0;
          popText(clamp(item.x, 30, rect.width - 30), rect.height - 50, 'MISS', 'bad');
        }
        removeItem(item);
      }
    });
  }

  function attackJunkRain(){
    showToast('🌧️ Junk Rain! หลบอาหารขยะ');
    playTone('bad');

    const rect = getAreaRect();
    const count = state.phase >= 4 ? 8 : state.phase >= 3 ? 6 : 5;

    for(let i = 0; i < count; i++){
      setTimeout(() => {
        spawnItem('junk', {
          x: random(50, rect.width - 50),
          y: random(-110, -40),
          speed: random(120, 185) * itemSpeed()
        });
      }, i * 120);
    }
  }

  function attackFakeHealthy(){
    showToast('🎭 ระวัง! อาหารขยะปลอมตัว');
    playTone('bad');

    const rect = getAreaRect();
    for(let i = 0; i < 4; i++){
      setTimeout(() => {
        spawnItem('junk', {
          fake: true,
          x: random(55, rect.width - 55),
          y: random(-90, -38),
          speed: random(85, 130) * itemSpeed()
        });
      }, i * 180);
    }
  }

  function attackSugarWave(){
    showToast('🥤 Sugar Wave! คลื่นน้ำตาลมาแล้ว');
    playTone('bad');

    const rect = getAreaRect();
    const n = state.phase >= 4 ? 7 : 5;

    for(let i = 0; i < n; i++){
      spawnItem('junk', {
        x: ((i + 1) / (n + 1)) * rect.width,
        y: -55 - Math.abs(Math.floor(n / 2) - i) * 18,
        vx: random(-6, 6),
        speed: random(112, 155) * itemSpeed()
      });
    }
  }

  function attackShield(){
    if(state.phase < 2 || state.shieldGate > 0) return;

    state.shieldGate = state.phase >= 4 ? 3 : 2;
    showToast(`🛡️ บอสเปิดโล่! เก็บอาหารดี ${state.shieldGate} ครั้ง`);
    playTone('boss');
  }

  function bossAttack(){
    if(!state.running || state.paused || state.ended) return;

    const pool = [];

    pool.push(attackJunkRain);

    if(state.phase >= 2) pool.push(attackFakeHealthy);
    if(state.phase >= 3) pool.push(attackSugarWave);
    if(state.phase >= 2) pool.push(attackShield);

    pick(pool)();
  }

  function cvrHitNearest(){
    if(!(CFG.view === 'cvr' || CFG.view === 'cardboard')) return;

    const rect = getAreaRect();
    const cx = rect.width * 0.5;
    const cy = rect.height * 0.5;
    let best = null;
    let bestD = Infinity;

    state.items.forEach(item => {
      const dx = item.x - cx;
      const dy = item.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if(d < bestD){
        bestD = d;
        best = item;
      }
    });

    if(best && bestD < 92){
      hitItem(best.id);
    }else{
      showToast('เล็งให้ใกล้อาหารก่อนแตะยิง');
    }
  }

  function heroHit(){
    if(state.heroCharge < 100 || state.paused || state.ended) return;

    state.heroCharge = 0;

    let amount = 18;
    if(state.phase === 3) amount = 22;
    if(state.phase === 4) amount = 26;

    if(state.shieldGate > 0){
      state.shieldGate = Math.max(0, state.shieldGate - 2);
      showToast('⚡ HERO HIT ทำลายโล่!');
      playTone('boss');

      if(state.shieldGate <= 0){
        damageBoss(12, 'HERO BREAK');
      }
    }else{
      damageBoss(amount, 'HERO HIT');
    }

    updateHud();
  }

  function tick(ts){
    if(!state.running || state.ended) return;

    if(!state.lastTs) state.lastTs = ts;
    const rawDt = Math.min(0.05, (ts - state.lastTs) / 1000);
    state.lastTs = ts;

    if(!state.paused){
      state.timeLeft -= rawDt;

      state.spawnAcc += rawDt;
      state.attackAcc += rawDt;
      state.powerAcc += rawDt;

      if(state.spawnAcc >= spawnEvery()){
        state.spawnAcc = 0;
        spawnNormalWave();

        if(state.phase >= 4 && chance(0.22)){
          setTimeout(spawnNormalWave, 160);
        }
      }

      const attackEvery = Math.max(3.8, base.attackEvery - (state.phase - 1) * 0.75);
      if(state.attackAcc >= attackEvery){
        state.attackAcc = 0;
        bossAttack();
      }

      const powerEvery = state.phase >= 4 ? 10.5 : 13.5;
      if(state.powerAcc >= powerEvery){
        state.powerAcc = 0;
        spawnPower();
      }

      updateItems(rawDt);

      if(now() > state.slowUntil && state.powerLabel === 'Slow Time'){
        state.powerLabel = '-';
      }

      if(now() > state.magnetUntil && state.powerLabel === 'Magnet'){
        state.powerLabel = '-';
      }

      updateHud();

      if(state.timeLeft <= 0){
        endGame(state.bossHp <= 8);
        return;
      }
    }

    requestAnimationFrame(tick);
  }

  function resetGame(){
    state.running = false;
    state.paused = false;
    state.ended = false;
    state.timeLeft = CFG.duration;
    state.score = 0;
    state.lives = base.lives;
    state.bossHp = 100;
    state.phase = 1;
    state.goodHits = 0;
    state.junkHits = 0;
    state.miss = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.heroCharge = 0;
    state.shieldUses = 0;
    state.slowUntil = 0;
    state.magnetUntil = 0;
    state.powerLabel = '-';
    state.phaseGood = 0;
    state.phaseGroups = new Set();
    state.shieldGate = 0;
    state.itemId = 1;
    state.lastTs = 0;
    state.spawnAcc = 0;
    state.attackAcc = 0;
    state.powerAcc = 0;

    state.items.forEach(item => item.node && item.node.remove());
    state.items = [];
    el.fxLayer.innerHTML = '';

    setPhase(1, false);
    updateHud();
  }

  function startGame(){
    resetGame();

    el.introLayer.classList.remove('show');
    el.summaryLayer.classList.remove('show');

    state.running = true;
    state.paused = false;
    state.ended = false;

    playTone('power');
    showToast(`เริ่มเลย ${CFG.name}!`);
    setPhase(1, true);

    for(let i = 0; i < 5; i++){
      setTimeout(() => spawnItem(i < 3 ? 'good' : 'junk'), i * 260);
    }

    requestAnimationFrame(tick);
  }

  function starsFor(win){
    if(!win) return state.score >= 250 ? 2 : 1;
    if(state.miss <= 4 && state.score >= 650) return 3;
    if(state.miss <= 9 && state.score >= 420) return 2;
    return 1;
  }

  function endGame(win){
    if(state.ended) return;

    state.ended = true;
    state.running = false;

    state.items.forEach(item => item.node && item.node.remove());
    state.items = [];

    const stars = starsFor(win);
    const summary = {
      gameId: 'goodjunk',
      mode: 'solo-phase-boss',
      pid: CFG.pid,
      name: CFG.name,
      diff: CFG.diff,
      score: Math.round(state.score),
      goodHits: state.goodHits,
      junkHits: state.junkHits,
      miss: state.miss,
      maxCombo: state.maxCombo,
      bossHpLeft: Math.round(state.bossHp),
      completed: !!win,
      stars,
      ts: new Date().toISOString()
    };

    try{
      localStorage.setItem('GJ_SOLO_BOSS_LAST', JSON.stringify(summary));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    }catch(err){
      // ignore private mode
    }

    el.summaryEmoji.textContent = win ? '🏆' : '💪';
    el.summaryTitle.textContent = win ? 'ชนะบอสแล้ว!' : 'เกือบชนะแล้ว!';
    el.summaryMessage.textContent = win
      ? 'ยอดเยี่ยม! เลือกอาหารดีและใช้พลังได้ดีมาก'
      : 'ลองอีกครั้ง เก็บอาหารดีให้ครบหมู่และหลบอาหารขยะ';

    el.sumScore.textContent = String(summary.score);
    el.sumGood.textContent = String(summary.goodHits);
    el.sumMiss.textContent = String(summary.miss);
    el.sumStars.textContent = '⭐'.repeat(stars);

    if(summary.miss <= 4){
      el.summaryTip.textContent = 'เก่งมาก! พลาดน้อยมาก จำไว้ว่าอาหารดีช่วยให้ร่างกายแข็งแรง';
    }else if(summary.junkHits > summary.goodHits * 0.35){
      el.summaryTip.textContent = 'เคล็ดลับ: เห็น 🍟🍩🥤 ให้หลบก่อน แล้วค่อยเก็บ 🍎🥦🥚';
    }else{
      el.summaryTip.textContent = 'ดีมาก! รอบหน้าใช้ HERO HIT ตอนบอสเข้า Rage Mode จะชนะง่ายขึ้น';
    }

    el.summaryLayer.classList.add('show');

    playTone(win ? 'win' : 'bad');
  }

  function goHub(){
    try{
      WIN.location.href = CFG.hub || '../nutrition-zone.html';
    }catch(err){
      WIN.location.href = '../nutrition-zone.html';
    }
  }

  function togglePause(){
    if(!state.running || state.ended) return;

    state.paused = !state.paused;
    el.pauseBtn.textContent = state.paused ? '▶️ เล่นต่อ' : '⏸ พัก';
    showToast(state.paused ? 'พักเกม' : 'เล่นต่อ!');
    state.lastTs = 0;
  }

  function bindEvents(){
    el.startBtn.addEventListener('click', startGame);
    el.replayBtn.addEventListener('click', startGame);

    el.backBtn.addEventListener('click', goHub);
    el.introBackBtn.addEventListener('click', goHub);
    el.summaryBackBtn.addEventListener('click', goHub);

    el.pauseBtn.addEventListener('click', togglePause);

    el.soundBtn.addEventListener('click', () => {
      state.muted = !state.muted;
      el.soundBtn.textContent = state.muted ? '🔇 ปิดเสียง' : '🔊 เสียง';
      if(!state.muted) playTone('power');
    });

    el.heroHitBtn.addEventListener('click', heroHit);

    el.gameArea.addEventListener('pointerdown', (ev) => {
      if(ev.target && ev.target.classList && ev.target.classList.contains('target')) return;
      cvrHitNearest();
    }, { passive: false });

    WIN.addEventListener('blur', () => {
      if(state.running && !state.ended){
        state.paused = true;
        el.pauseBtn.textContent = '▶️ เล่นต่อ';
        updateHud();
      }
    });

    DOC.addEventListener('visibilitychange', () => {
      if(DOC.hidden && state.running && !state.ended){
        state.paused = true;
        el.pauseBtn.textContent = '▶️ เล่นต่อ';
        updateHud();
      }
    });
  }

  function boot(){
    bindEvents();
    resetGame();

    if(CFG.view === 'cvr' || CFG.view === 'cardboard'){
      showToast('โหมด Cardboard: เล็งกลางจอ แล้วแตะเพื่อยิง', 1600);
    }
  }

  boot();
})();