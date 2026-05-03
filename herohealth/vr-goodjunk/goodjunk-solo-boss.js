// === /herohealth/vr-goodjunk/goodjunk-solo-boss.js ===
// GoodJunk Solo Phase Boss
// FULL MERGED PATCH v20260503-bossv7-balance-mobile-polish
// ✅ Solo Phase Boss
// ✅ Boss HP / shield / attack patterns
// ✅ HERO HIT / power-ups / mission
// ✅ Boss speech / warning flash / danger meter / hero cut-in
// ✅ Final Rush
// ✅ Boss Weakness Mission
// ✅ Combo Skill x5 / x10 / x15
// ✅ Comeback assist
// ✅ Kid-friendly summary
// ✅ Boss Pattern Script
// ✅ Telegraph Warning
// ✅ Finish Move before Summary
// ✅ Daily Challenge
// ✅ Result Badges
// ✅ Boss identity skills
// ✅ Arena hazards / Danger lane
// ✅ HERO HIT ready pulse
// ✅ Boss Book / Learning tip
// ✅ Star goal intro
// ✅ v7 mobile-safe spawn / anti-overlap / pause-safe skills / fair difficulty
// ✅ No Apps Script logging in this version

(() => {
  'use strict';

  const DOC = document;
  const WIN = window;
  const $ = (q) => DOC.querySelector(q);

  const params = new URLSearchParams(WIN.location.search);

  const DIFF = {
    easy: { duration: 150, lives: 5, spawnEvery: 1.02, speed: 0.88, junkRate: 0.30, attackEvery: 8.8 },
    normal: { duration: 150, lives: 4, spawnEvery: 0.88, speed: 1, junkRate: 0.38, attackEvery: 7.4 },
    hard: { duration: 140, lives: 3, spawnEvery: 0.74, speed: 1.15, junkRate: 0.46, attackEvery: 6.2 },
    challenge: { duration: 130, lives: 3, spawnEvery: 0.62, speed: 1.28, junkRate: 0.52, attackEvery: 5.2 }
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
      threshold: 75,
      weakGroup: 'veg',
      weakLabel: 'ผัก',
      weakEmoji: '🥦'
    },
    2: {
      pill: 'PHASE 2',
      title: 'PHASE 2',
      desc: 'เริ่มมีของหลอก!',
      boss: 'Candy Witch',
      face: '🍭',
      state: 'ใช้ของหลอก',
      mission: 'ระวังอาหารขยะปลอมตัว และเก็บของดีต่อเนื่อง',
      threshold: 45,
      weakGroup: 'fruit',
      weakLabel: 'ผลไม้',
      weakEmoji: '🍎'
    },
    3: {
      pill: 'PHASE 3',
      title: 'PHASE 3',
      desc: 'ทำลายโล่บอส',
      boss: 'Fried Monster',
      face: '🍟',
      state: 'มีโล่ป้องกัน',
      mission: 'เก็บอาหารดีให้ครบ 5 หมู่ เพื่อเปิดทางโจมตี',
      threshold: 20,
      weakGroup: 'protein',
      weakLabel: 'โปรตีน',
      weakEmoji: '🥚'
    },
    4: {
      pill: 'FINAL',
      title: 'FINAL RAGE',
      desc: 'บอสคลั่งแล้ว!',
      boss: 'Sugar Dragon',
      face: '🐲',
      state: 'RAGE MODE',
      mission: 'เก็บอาหารดี ชาร์จ HERO HIT แล้วปิดฉากบอส',
      threshold: 0,
      weakGroup: 'all',
      weakLabel: 'อาหารครบ 5 หมู่',
      weakEmoji: '🌈'
    }
  };

  const DAILY_CHALLENGES = [
    { id: 'low_miss', icon: '🛡️', title: 'Junk Dodger', text: 'พลาดไม่เกิน 6 ครั้ง', check: (s) => s.miss <= 6 },
    { id: 'hero_hit', icon: '⚡', title: 'Hero Striker', text: 'ใช้ HERO HIT อย่างน้อย 2 ครั้ง', check: (s) => s.heroHitsUsed >= 2 },
    { id: 'good_collector', icon: '🥗', title: 'Good Collector', text: 'เก็บอาหารดี 30 ชิ้น', check: (s) => s.goodHits >= 30 },
    { id: 'combo_master', icon: '🔥', title: 'Combo Master', text: 'ทำ Combo อย่างน้อย x12', check: (s) => s.maxCombo >= 12 }
  ];

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
    summaryBackBtn: $('#summaryBackBtn'),

    bossSpeech: null,
    dangerMeter: null,
    dangerFill: null,
    warningFlash: null,
    heroCutin: null,
    finalRushBadge: null,
    weaknessCard: null,
    comboBurst: null,
    telegraphLayer: null,
    finishMove: null,
    dailyChallengeCard: null,
    hazardLayer: null,
    bossSkillLabel: null
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

  function random(min, max){ return min + (max - min) * rand(); }
  function chance(p){ return rand() < p; }
  function pick(arr){ return arr[Math.floor(rand() * arr.length) % arr.length]; }
  function now(){ return performance.now(); }
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

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

    streakMiss: 0,
    comboAward5: false,
    comboAward10: false,
    comboAward15: false,
    finalRush: false,
    heroHitsUsed: 0,
    fiveGroupRounds: 0,

    patternIndex: 0,
    dailyChallenge: null,
    finishMovePlaying: false,

    activeHazard: null,
    skillActiveUntil: 0,

    assistModeUntil: 0,
    lastHeroReadyAnnounce: false,
    pausedAt: 0,
    delayedTokens: new Set(),
    skillTokenSeq: 1,

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

  function mountCinematicUI(){
    if(!el.gameArea) return;

    if(!el.bossSpeech){
      const speech = DOC.createElement('div');
      speech.id = 'bossSpeech';
      speech.className = 'boss-speech';
      speech.textContent = 'เจ้าจะผ่านด่านอาหารขยะไม่ได้หรอก!';
      el.gameArea.appendChild(speech);
      el.bossSpeech = speech;
    }

    if(!el.dangerMeter){
      const meter = DOC.createElement('div');
      meter.id = 'dangerMeter';
      meter.className = 'danger-meter';
      meter.innerHTML = `
        <strong>BOSS SKILL</strong>
        <div class="danger-track"><div class="danger-fill" id="dangerFill"></div></div>
      `;
      el.gameArea.appendChild(meter);
      el.dangerMeter = meter;
      el.dangerFill = meter.querySelector('#dangerFill');
    }

    if(!el.warningFlash){
      const warn = DOC.createElement('div');
      warn.id = 'warningFlash';
      warn.className = 'warning-flash';
      warn.innerHTML = `<div><strong>WARNING!</strong><span>บอสกำลังโจมตี</span></div>`;
      el.gameArea.appendChild(warn);
      el.warningFlash = warn;
    }

    if(!el.heroCutin){
      const cut = DOC.createElement('div');
      cut.id = 'heroCutin';
      cut.className = 'hero-cutin';
      cut.innerHTML = `
        <div class="hero-cutin-card">
          <div class="hero-icon">⚡</div>
          <strong>HERO HIT!</strong>
          <span>พลังอาหารดีโจมตีบอส</span>
        </div>
      `;
      el.gameArea.appendChild(cut);
      el.heroCutin = cut;
    }
  }

  function mountBossV4UI(){
    if(!el.gameArea) return;

    if(!el.finalRushBadge){
      const badge = DOC.createElement('div');
      badge.id = 'finalRushBadge';
      badge.className = 'final-rush-badge';
      badge.textContent = '🔥 FINAL RUSH!';
      el.gameArea.appendChild(badge);
      el.finalRushBadge = badge;
    }

    if(!el.weaknessCard){
      const card = DOC.createElement('div');
      card.id = 'weaknessCard';
      card.className = 'weakness-card';
      card.innerHTML = `
        <div class="weak-icon">🥦</div>
        <div>
          <strong>Boss Weakness</strong>
          <span>บอสแพ้: ผัก</span>
        </div>
      `;
      el.gameArea.appendChild(card);
      el.weaknessCard = card;
    }

    if(!el.comboBurst){
      const burst = DOC.createElement('div');
      burst.id = 'comboBurst';
      burst.className = 'combo-burst';
      burst.innerHTML = `<strong>COMBO!</strong><span>เก็บอาหารดีต่อเนื่อง</span>`;
      el.gameArea.appendChild(burst);
      el.comboBurst = burst;
    }
  }

  function mountBossV5UI(){
    if(!el.gameArea) return;

    if(!el.telegraphLayer){
      const layer = DOC.createElement('div');
      layer.id = 'telegraphLayer';
      layer.className = 'telegraph-layer';
      el.gameArea.appendChild(layer);
      el.telegraphLayer = layer;
    }

    if(!el.dailyChallengeCard){
      const card = DOC.createElement('div');
      card.id = 'dailyChallengeCard';
      card.className = 'daily-challenge-card';
      card.innerHTML = `
        <div class="challenge-icon">🎯</div>
        <div>
          <strong>Daily Challenge</strong>
          <span>ทำภารกิจพิเศษ</span>
        </div>
      `;
      el.gameArea.appendChild(card);
      el.dailyChallengeCard = card;
    }

    if(!el.finishMove){
      const finish = DOC.createElement('div');
      finish.id = 'finishMove';
      finish.className = 'finish-move';
      finish.innerHTML = `
        <div class="finish-card">
          <div class="finish-icon">🌈</div>
          <strong>HEALTHY BLAST!</strong>
          <span>พลังอาหารดีปราบบอสสำเร็จ</span>
        </div>
      `;
      el.gameArea.appendChild(finish);
      el.finishMove = finish;
    }
  }

  function mountBossV6UI(){
    if(!el.gameArea) return;

    if(!el.hazardLayer){
      const layer = DOC.createElement('div');
      layer.id = 'hazardLayer';
      layer.className = 'hazard-layer';
      el.gameArea.appendChild(layer);
      el.hazardLayer = layer;
    }

    if(!el.bossSkillLabel){
      const label = DOC.createElement('div');
      label.id = 'bossSkillLabel';
      label.className = 'boss-skill-label';
      label.innerHTML = `<strong>Boss Skill!</strong><span>ระวังให้ดี</span>`;
      el.gameArea.appendChild(label);
      el.bossSkillLabel = label;
    }
  }

  function bossSay(text, ms = 1450){
    if(!el.bossSpeech) return;
    el.bossSpeech.textContent = text;
    el.bossSpeech.classList.remove('show');
    void el.bossSpeech.offsetWidth;
    el.bossSpeech.classList.add('show');

    clearTimeout(bossSay.t);
    bossSay.t = setTimeout(() => {
      if(el.bossSpeech) el.bossSpeech.classList.remove('show');
    }, ms);
  }

  function showWarning(text = 'บอสกำลังโจมตี'){
    if(!el.warningFlash) return;

    const label = el.warningFlash.querySelector('span');
    if(label) label.textContent = text;

    el.warningFlash.classList.remove('show');
    void el.warningFlash.offsetWidth;
    el.warningFlash.classList.add('show');

    clearTimeout(showWarning.t);
    showWarning.t = setTimeout(() => {
      if(el.warningFlash) el.warningFlash.classList.remove('show');
    }, 1100);
  }

  function showHeroCutin(text = 'พลังอาหารดีโจมตีบอส'){
    if(!el.heroCutin) return;

    const label = el.heroCutin.querySelector('span');
    if(label) label.textContent = text;

    el.heroCutin.classList.remove('show');
    void el.heroCutin.offsetWidth;
    el.heroCutin.classList.add('show');

    clearTimeout(showHeroCutin.t);
    showHeroCutin.t = setTimeout(() => {
      if(el.heroCutin) el.heroCutin.classList.remove('show');
    }, 1100);
  }

  function showBossSkillLabel(title, msg){
    if(!el.bossSkillLabel) return;

    const strong = el.bossSkillLabel.querySelector('strong');
    const span = el.bossSkillLabel.querySelector('span');

    if(strong) strong.textContent = title;
    if(span) span.textContent = msg;

    el.bossSkillLabel.classList.remove('show');
    void el.bossSkillLabel.offsetWidth;
    el.bossSkillLabel.classList.add('show');

    clearTimeout(showBossSkillLabel.t);
    showBossSkillLabel.t = setTimeout(() => {
      if(el.bossSkillLabel) el.bossSkillLabel.classList.remove('show');
    }, 980);
  }

  function bossDamageRing(){
    if(!el.fxLayer) return;
    const ring = DOC.createElement('div');
    ring.className = 'boss-damage-ring';
    el.fxLayer.appendChild(ring);
    setTimeout(() => ring.remove(), 620);
  }

  function updateDangerMeter(){
    if(!el.dangerFill || !el.dangerMeter) return;

    const attackEvery = Math.max(3.8, base.attackEvery - (state.phase - 1) * 0.75);
    const pct = clamp((state.attackAcc / attackEvery) * 100, 0, 100);

    el.dangerFill.style.width = `${pct}%`;
    el.dangerMeter.classList.toggle('danger-hot', pct >= 78);
  }

  function updateWeaknessCard(){
    if(!el.weaknessCard) return;

    const p = PHASES[state.phase] || PHASES[1];
    const icon = el.weaknessCard.querySelector('.weak-icon');
    const text = el.weaknessCard.querySelector('span');

    if(icon) icon.textContent = p.weakEmoji || '🥦';
    if(text) text.textContent = `บอสแพ้: ${p.weakLabel || 'ผัก'}`;
  }

  function chooseDailyChallenge(){
    const dayKey = new Date().toISOString().slice(0, 10);
    const idx = hashSeed(`${dayKey}:${CFG.pid}:${CFG.seed}`) % DAILY_CHALLENGES.length;
    state.dailyChallenge = DAILY_CHALLENGES[idx];
    updateDailyChallengeCard();
  }

  function updateDailyChallengeCard(){
    if(!el.dailyChallengeCard || !state.dailyChallenge) return;

    const icon = el.dailyChallengeCard.querySelector('.challenge-icon');
    const text = el.dailyChallengeCard.querySelector('span');
    const title = el.dailyChallengeCard.querySelector('strong');

    if(icon) icon.textContent = state.dailyChallenge.icon;
    if(title) title.textContent = state.dailyChallenge.title;
    if(text) text.textContent = state.dailyChallenge.text;
  }

  function clearTelegraphs(){
    if(el.telegraphLayer) el.telegraphLayer.innerHTML = '';
  }

  function showTelegraphMarks(points, type = 'mark'){
    if(!el.telegraphLayer) return;

    clearTelegraphs();

    points.forEach(p => {
      const n = DOC.createElement('div');
      n.className = type === 'line' ? 'telegraph-line' : 'telegraph-mark';

      if(type === 'line'){
        n.style.top = `${p.y}px`;
      }else{
        n.style.left = `${p.x}px`;
        n.style.top = `${p.y}px`;
      }

      el.telegraphLayer.appendChild(n);
    });

    setTimeout(clearTelegraphs, 760);
  }

  function clearHazards(){
    state.activeHazard = null;
    if(el.hazardLayer) el.hazardLayer.innerHTML = '';
  }

  function addHazard(kind, opt = {}){
    if(!el.hazardLayer) return null;

    const rect = getAreaRect();
    const node = DOC.createElement('div');

    if(kind === 'lane'){
      node.className = 'danger-lane';
      node.style.top = `${opt.y ?? rect.height * 0.45}px`;
      el.hazardLayer.appendChild(node);

      state.activeHazard = {
        kind,
        y: opt.y ?? rect.height * 0.45,
        h: 74,
        until: now() + (opt.ms || 3600)
      };

      setTimeout(() => {
        if(node.parentNode) node.remove();
        if(state.activeHazard && state.activeHazard.kind === 'lane') state.activeHazard = null;
      }, opt.ms || 3600);

      return node;
    }

    node.className = `hazard-zone ${kind}`;

    const w = opt.w ?? Math.min(230, rect.width * 0.44);
    const h = opt.h ?? Math.min(150, rect.height * 0.30);
    const x = opt.x ?? random(35, Math.max(40, rect.width - w - 35));
    const y = opt.y ?? random(rect.height * 0.38, Math.max(rect.height * 0.40, rect.height - h - 30));

    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;

    el.hazardLayer.appendChild(node);

    state.activeHazard = {
      kind,
      x,
      y,
      w,
      h,
      until: now() + (opt.ms || 4500)
    };

    setTimeout(() => {
      if(node.parentNode) node.remove();
      if(state.activeHazard && state.activeHazard.kind === kind) state.activeHazard = null;
    }, opt.ms || 4500);

    return node;
  }

  function itemInsideHazard(item){
    const hz = state.activeHazard;
    if(!hz || now() > hz.until || !item) return false;

    if(hz.kind === 'lane'){
      return Math.abs(item.y - hz.y) <= hz.h * 0.5;
    }

    return item.x >= hz.x && item.x <= hz.x + hz.w && item.y >= hz.y && item.y <= hz.y + hz.h;
  }

  function isMobileView(){
    return CFG.view === 'mobile' || CFG.view === 'cvr' || CFG.view === 'cardboard' || WIN.innerWidth <= 760;
  }

  function safeSpawnBounds(){
    const rect = getAreaRect();
    const mobile = isMobileView();
    const padX = mobile ? 64 : 50;
    const topSafe = mobile ? 105 : 88;
    const bottomSafe = mobile ? 88 : 74;

    return {
      rect,
      padX,
      topSafe,
      bottomSafe,
      minX: padX,
      maxX: Math.max(padX + 1, rect.width - padX),
      minY: topSafe,
      maxY: Math.max(topSafe + 1, rect.height - bottomSafe)
    };
  }

  function safeRandomX(){
    const b = safeSpawnBounds();
    return random(b.minX, b.maxX);
  }

  function safeTelegraphY(ratio = 0.34){
    const b = safeSpawnBounds();
    return random(b.topSafe, Math.max(b.topSafe + 1, b.rect.height * ratio));
  }

  function markUiDanger(ms = 1200){
    el.app.classList.add('ui-danger');

    clearTimeout(markUiDanger.t);
    markUiDanger.t = setTimeout(() => {
      el.app.classList.remove('ui-danger');
    }, ms);
  }

  function delayedSkill(fn, delay = 680){
    const token = state.skillTokenSeq++;
    state.delayedTokens.add(token);

    setTimeout(() => {
      if(!state.delayedTokens.has(token)) return;
      state.delayedTokens.delete(token);
      if(!state.running || state.paused || state.ended) return;
      fn();
    }, delay);

    return token;
  }

  function cancelDelayedSkills(){
    state.delayedTokens.clear();
  }

  function updateFairDifficulty(){
    if(state.miss >= 6 && state.lives <= 2){
      state.assistModeUntil = Math.max(state.assistModeUntil, now() + 6000);
    }

    if(state.timeLeft <= 18 && state.bossHp <= 26 && state.heroCharge < 70){
      state.heroCharge = clamp(state.heroCharge + 0.04, 0, 100);
    }
  }

  function inAssistMode(){
    return now() < state.assistModeUntil;
  }

  function maybeSpawnMercyPower(){
    if(!inAssistMode()) return;
    if(state.items.some(it => it.kind === 'power')) return;
    if(!chance(0.018)) return;

    const p = state.lives <= 1
      ? { id:'heart', emoji:'💖', label:'Heart' }
      : { id:'shield', emoji:'🛡️', label:'Shield' };

    spawnItem('power', {
      power: p,
      x: safeRandomX(),
      speed: random(55, 76) * itemSpeed(),
      lifeMs: 10000,
      mercyPower: true
    });
  }

  function updateCompactSummaryMode(){
    const compact = WIN.innerHeight <= 700 || WIN.innerWidth <= 380;
    el.app.classList.toggle('compact-summary', compact);
  }

  function announceHeroReadyOnce(){
    const ready = state.heroCharge >= 100 && state.running && !state.paused && !state.ended;

    if(ready && !state.lastHeroReadyAnnounce){
      state.lastHeroReadyAnnounce = true;
      showToast('⚡ HERO HIT พร้อมแล้ว!');
      playTone('power');
    }

    if(!ready){
      state.lastHeroReadyAnnounce = false;
    }
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
        f1 = 170;
        f2 = 90;
        dur = 0.18;
      }else if(type === 'boss'){
        f1 = 120;
        f2 = 360;
        dur = 0.28;
      }else if(type === 'power'){
        f1 = 760;
        f2 = 980;
        dur = 0.22;
      }else if(type === 'win'){
        f1 = 650;
        f2 = 1040;
        dur = 0.45;
      }

      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      o.start(t);
      o.stop(t + dur + 0.02);
    }catch(err){
      // Browser may block audio before user interaction.
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

  function showFinalRush(){
    if(state.finalRush) return;

    state.finalRush = true;
    el.app.classList.add('final-rush');

    if(el.finalRushBadge){
      el.finalRushBadge.classList.remove('show');
      void el.finalRushBadge.offsetWidth;
      el.finalRushBadge.classList.add('show');
    }

    showWarning('FINAL RUSH! เร่งปิดฉากบอส');
    bossSay('ไม่ยอมแพ้! ข้าจะโจมตีสุดแรง!');
    playTone('boss');
    shake();

    setTimeout(() => {
      if(el.finalRushBadge) el.finalRushBadge.classList.remove('show');
    }, 1200);
  }

  function showComboBurst(title, msg){
    if(!el.comboBurst) return;

    const strong = el.comboBurst.querySelector('strong');
    const span = el.comboBurst.querySelector('span');

    if(strong) strong.textContent = title;
    if(span) span.textContent = msg;

    el.comboBurst.classList.remove('show');
    void el.comboBurst.offsetWidth;
    el.comboBurst.classList.add('show');

    clearTimeout(showComboBurst.t);
    showComboBurst.t = setTimeout(() => {
      if(el.comboBurst) el.comboBurst.classList.remove('show');
    }, 950);
  }

  function isWeaknessFood(item){
    const p = PHASES[state.phase] || PHASES[1];
    if(!item || item.kind !== 'good') return false;

    if(p.weakGroup === 'all'){
      return state.phaseGroups.size >= 4 || item.bonusGood;
    }

    return item.group === p.weakGroup;
  }

  function applyComboSkill(){
    if(state.combo >= 5 && !state.comboAward5){
      state.comboAward5 = true;
      state.heroCharge = clamp(state.heroCharge + 18, 0, 100);
      showComboBurst('COMBO x5!', '+ Hero Charge');
      showToast('🔥 Combo x5 ชาร์จพลังเพิ่ม!');
      playTone('power');
    }

    if(state.combo >= 10 && !state.comboAward10){
      state.comboAward10 = true;

      let cleared = 0;
      const rect = getAreaRect();
      const cx = rect.width * 0.5;
      const cy = rect.height * 0.55;

      state.items.slice().forEach(it => {
        if(it.kind === 'junk'){
          const dx = it.x - cx;
          const dy = it.y - cy;
          const d = Math.sqrt(dx * dx + dy * dy);

          if(d < 210){
            cleared++;
            popText(it.x, it.y, 'SPARK', 'gold');
            removeItem(it);
          }
        }
      });

      state.score += cleared * 10;
      damageBoss(6 + cleared, 'COMBO SPARK');
      showComboBurst('COMBO x10!', 'Clean Spark ลบอาหารขยะใกล้ ๆ');
      playTone('power');
    }

    if(state.combo >= 15 && !state.comboAward15){
      state.comboAward15 = true;
      showComboBurst('COMBO x15!', 'Mega Good Rain!');
      showToast('🌈 Mega Good Rain มาแล้ว!');
      playTone('win');

      const rect = getAreaRect();
      const groups = ['protein', 'carb', 'veg', 'fruit', 'fat'];

      for(let i = 0; i < 8; i++){
        setTimeout(() => {
          if(!state.running || state.paused || state.ended) return;

          const group = pick(groups);
          const good = pick(FOOD_GOOD.filter(f => f.group === group));

          spawnItem('good', {
            good,
            bonusGood: true,
            x: random(50, rect.width - 50),
            y: random(-120, -45),
            speed: random(84, 122) * itemSpeed()
          });
        }, i * 120);
      }
    }
  }

  function resetComboAwards(){
    state.comboAward5 = false;
    state.comboAward10 = false;
    state.comboAward15 = false;
  }

  function comebackAssist(){
    if(state.streakMiss < 3) return;

    state.streakMiss = 0;

    const p = state.lives <= 1
      ? { id: 'heart', emoji: '💖', label: 'Heart' }
      : { id: 'shield', emoji: '🛡️', label: 'Shield' };

    showToast('💡 ตัวช่วยมาแล้ว! เก็บเพื่อกลับมาเล่นต่อ');
    bossSay('ฮึ่ม... ยังมีตัวช่วยอีกเหรอ!');

    spawnItem('power', {
      power: p,
      x: safeRandomX(),
      speed: random(58, 78) * itemSpeed(),
      lifeMs: 9500,
      mercyPower: true
    });
  }

  function checkFinalRush(){
    if(state.finalRush) return;

    if(state.timeLeft <= 20 || state.bossHp <= 15){
      showFinalRush();
    }
  }

  function skillBurgerBounce(){
    showBossSkillLabel('Burger Bounce!', 'อาหารขยะเด้งซ้ายขวา');
    bossSay('เบอร์เกอร์เด้งมาแล้ว!');
    showWarning('Burger Bounce! ระวังของเด้ง');
    playTone('bad');
    markUiDanger(1400);

    delayedSkill(() => {
      const rect = getAreaRect();
      const count = 5;
      const bounds = safeSpawnBounds();

      const points = [];
      for(let i = 0; i < count; i++){
        points.push({
          x: clamp(((i + 1) / (count + 1)) * rect.width, bounds.minX, bounds.maxX),
          y: safeTelegraphY(0.34)
        });
      }

      showTelegraphMarks(points, 'mark');

      for(let i = 0; i < count; i++){
        setTimeout(() => {
          if(!state.running || state.paused || state.ended) return;

          spawnItem('junk', {
            danger: true,
            x: points[i].x,
            y: -60,
            vx: i % 2 === 0 ? 65 : -65,
            speed: random(96, 130) * itemSpeed()
          });

          const last = state.items[state.items.length - 1];
          if(last && last.node) last.node.classList.add('bouncy');
        }, i * 130);
      }
    }, 680);
  }

  function skillSweetTrap(){
    showBossSkillLabel('Sweet Trap!', 'ของหลอกจะเยอะขึ้น');
    bossSay('ของหวานหลอกตา มาแล้ว!');
    showWarning('Sweet Trap! ดูให้ดีก่อนเก็บ');
    playTone('bad');
    markUiDanger(1450);

    delayedSkill(() => {
      const points = [];

      for(let i = 0; i < 6; i++){
        points.push({
          x: safeRandomX(),
          y: safeTelegraphY(0.38)
        });
      }

      showTelegraphMarks(points, 'mark');

      for(let i = 0; i < 6; i++){
        setTimeout(() => {
          if(!state.running || state.paused || state.ended) return;

          spawnItem(i < 4 ? 'junk' : 'good', {
            fake: i < 4,
            danger: i < 4,
            bonusGood: i >= 4,
            x: points[i].x,
            y: random(-98, -42),
            speed: random(88, 138) * itemSpeed()
          });

          const last = state.items[state.items.length - 1];
          if(last && last.node) last.node.classList.add('sweet-trap');
        }, i * 125);
      }
    }, 700);
  }

  function skillOilSplash(){
    showBossSkillLabel('Oil Splash!', 'พื้นที่น้ำมันทำให้พลาดง่าย');
    bossSay('คราบน้ำมันมาแล้ว ระวังลื่น!');
    showWarning('Oil Splash! อย่ากดมั่วในพื้นที่น้ำมัน');
    playTone('bad');
    markUiDanger(1450);

    delayedSkill(() => {
      addHazard('oil', { ms: 5200 });

      for(let i = 0; i < 5; i++){
        setTimeout(() => {
          if(!state.running || state.paused || state.ended) return;

          spawnItem(i < 3 ? 'junk' : 'good', {
            danger: i < 3,
            x: safeRandomX(),
            speed: random(96, 150) * itemSpeed()
          });
        }, i * 180);
      }
    }, 680);
  }

  function skillSugarBeam(){
    showBossSkillLabel('Sugar Beam!', 'ลำแสงน้ำตาลกำลังกวาดกลางจอ');
    bossSay('ลำแสงน้ำตาลของข้า!');
    showWarning('Sugar Beam! หลบแนวกลางจอ');
    playTone('boss');
    markUiDanger(1500);

    delayedSkill(() => {
      const rect = getAreaRect();
      const bounds = safeSpawnBounds();
      const y = Math.min(bounds.maxY, Math.max(bounds.topSafe + 35, rect.height * 0.45));

      addHazard('lane', { y, ms: 3800 });
      showTelegraphMarks([{ y }], 'line');

      for(let i = 0; i < 7; i++){
        setTimeout(() => {
          if(!state.running || state.paused || state.ended) return;

          spawnItem('junk', {
            danger: true,
            x: clamp(((i + 1) / 8) * rect.width, bounds.minX, bounds.maxX),
            y: -60,
            vx: random(-10, 10),
            speed: random(128, 180) * itemSpeed()
          });

          const last = state.items[state.items.length - 1];
          if(last && last.node) last.node.classList.add('beam-danger');
        }, i * 110);
      }
    }, 680);
  }

  function getBossPattern(){
    if(state.phase === 1) return ['burger', 'rain', 'burger'];
    if(state.phase === 2) return ['sweet', 'fake', 'rain', 'sweet'];
    if(state.phase === 3) return ['oil', 'shield', 'wave', 'oil'];
    return ['beam', 'wave', 'rain', 'shield', 'sweet'];
  }

  function bossAttackPatterned(){
    if(!state.running || state.paused || state.ended) return;

    const pattern = getBossPattern();
    const skill = pattern[state.patternIndex % pattern.length];
    state.patternIndex++;

    if(skill === 'burger'){
      skillBurgerBounce();
    }else if(skill === 'sweet'){
      skillSweetTrap();
    }else if(skill === 'oil'){
      skillOilSplash();
    }else if(skill === 'beam'){
      skillSugarBeam();
    }else if(skill === 'rain'){
      attackJunkRain();
    }else if(skill === 'fake'){
      attackFakeHealthy();
    }else if(skill === 'wave'){
      attackSugarWave();
    }else if(skill === 'shield'){
      attackShield();
    }else{
      attackJunkRain();
    }
  }

  function playFinishMoveThenSummary(win){
    if(!win || !el.finishMove){
      showSummaryNow(win);
      return;
    }

    if(state.finishMovePlaying) return;
    state.finishMovePlaying = true;

    clearTelegraphs();
    clearHazards();

    el.finishMove.classList.remove('show');
    void el.finishMove.offsetWidth;
    el.finishMove.classList.add('show');

    showHeroCutin('HEALTHY RAINBOW BLAST!');
    playTone('win');
    shake();

    setTimeout(() => {
      if(el.finishMove) el.finishMove.classList.remove('show');
      showSummaryNow(win);
    }, 1500);
  }

  function buildBadges(summary){
    const badges = [];

    if(summary.completed) badges.push({ icon: '🏆', text: 'Boss Winner' });
    if(summary.maxCombo >= 10) badges.push({ icon: '🔥', text: 'Combo Master' });
    if(summary.miss <= 6) badges.push({ icon: '🛡️', text: 'Junk Dodger' });
    if(summary.heroHitsUsed >= 2) badges.push({ icon: '⚡', text: 'Hero Striker' });
    if(summary.fiveGroupRounds >= 1) badges.push({ icon: '🌈', text: 'Five Groups' });

    if(state.dailyChallenge && state.dailyChallenge.check(summary)){
      badges.push({ icon: state.dailyChallenge.icon, text: state.dailyChallenge.title });
    }

    return badges;
  }

  function getBossBookText(summary){
    if(summary.completed){
      if(state.phase === 4 || summary.fiveGroupRounds >= 1){
        return '🌈 อาหารครบ 5 หมู่ช่วยให้ร่างกายเติบโต แข็งแรง และมีพลังในการเรียนกับเล่นกีฬา';
      }

      if(summary.goodHits >= 30){
        return '🥗 การเลือกอาหารดีบ่อย ๆ ช่วยให้ร่างกายได้รับสารอาหารที่หลากหลาย';
      }

      return '✅ วันนี้เรียนรู้ว่าอาหารดีช่วยเพิ่มพลัง ส่วนอาหารขยะควรกินให้น้อยลง';
    }

    if(summary.junkHits > summary.goodHits * 0.35){
      return '⚠️ อาหารขยะ เช่น น้ำอัดลม โดนัท และของทอด ควรกินให้น้อย และเลือกอาหารดีให้มากขึ้น';
    }

    return '💪 รอบหน้าเก็บอาหารดีให้ครบหลายหมู่ แล้วใช้ HERO HIT เพื่อชนะบอส';
  }

  function ensureStarGoalIntro(){
    const intro = DOC.querySelector('.intro-card');
    if(!intro || intro.querySelector('.star-goal-card')) return;

    const wrap = DOC.createElement('div');
    wrap.className = 'star-goal-card';
    wrap.innerHTML = `
      <div class="star-goal-line">⭐ ชนะบอสให้ได้</div>
      <div class="star-goal-line">⭐⭐ พลาดไม่เกิน 9 ครั้ง</div>
      <div class="star-goal-line">⭐⭐⭐ พลาดไม่เกิน 4 ครั้ง และคะแนน 650+</div>
    `;

    const ruleGrid = intro.querySelector('.rule-grid');
    if(ruleGrid){
      ruleGrid.insertAdjacentElement('afterend', wrap);
    }else{
      intro.appendChild(wrap);
    }
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

    el.app.classList.remove('phase-1', 'phase-2', 'phase-3', 'phase-4', 'rage');
    el.app.classList.add(`phase-${nextPhase}`);

    el.modePill.textContent = p.pill;
    el.bossName.textContent = p.boss;
    el.bossFace.textContent = p.face;
    el.bossState.textContent = p.state;
    el.missionText.textContent = p.mission;

    updateWeaknessCard();

    if(nextPhase === 4){
      el.app.classList.add('rage');
    }

    if(announce){
      el.phaseTitle.textContent = p.title;
      el.phaseDesc.textContent = p.desc;
      el.phaseBanner.classList.remove('hidden');

      playTone(nextPhase === 4 ? 'boss' : 'power');

      setTimeout(() => {
        el.phaseBanner.classList.add('hidden');
      }, 980);

      if(nextPhase === 2){
        bossSay('ฮ่า ๆ ข้าจะใช้ของหลอกแล้ว!');
      }else if(nextPhase === 3){
        bossSay('เปิดโล่บอส! เก็บให้ครบ 5 หมู่ก่อนสิ!');
      }else if(nextPhase === 4){
        bossSay('RAGE MODE! ข้าจะโจมตีเต็มพลัง!');
      }
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
    el.bossHp.classList.toggle('low', hpPct <= 18 && state.running && !state.ended);

    el.heroChargeText.textContent = `${Math.floor(state.heroCharge)}%`;
    el.heroHitBtn.disabled = state.heroCharge < 100 || !state.running || state.paused;

    el.heroHitBtn.classList.toggle(
      'ready',
      state.heroCharge >= 100 && state.running && !state.paused && !state.ended
    );

    announceHeroReadyOnce();

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
    if(state.finalRush) sp *= 1.08;
    if(now() < state.slowUntil) sp *= 0.55;
    if(inAssistMode()) sp *= 0.88;

    return sp;
  }

  function spawnEvery(){
    let every = base.spawnEvery;

    if(state.phase === 2) every *= 0.9;
    if(state.phase === 3) every *= 0.78;
    if(state.phase === 4) every *= 0.62;

    if(state.combo >= 8) every *= 0.92;
    if(now() < state.slowUntil) every *= 1.14;
    if(state.finalRush) every *= 0.72;

    return every;
  }

  function currentJunkRate(){
    let rate = base.junkRate;

    if(state.phase === 2) rate += 0.08;
    if(state.phase === 3) rate += 0.12;
    if(state.phase === 4) rate += 0.18;
    if(state.finalRush) rate += 0.08;

    if(state.lives <= 1) rate -= 0.10;
    if(inAssistMode()) rate -= 0.14;
    if(state.combo >= 12 && state.lives >= 3) rate += 0.04;

    return clamp(rate, 0.18, 0.72);
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

      if(itemInsideHazard(item) && item.kind === 'good'){
        state.score = Math.max(0, state.score - 6);
        popText(item.x, item.y - 34, 'ลื่น!', 'bad');
        showToast('ระวังพื้นที่อันตราย!');
      }

      hitItem(item.id);
    }, { passive: false });

    return node;
  }

  function spawnItem(kind, opt = {}){
    if(!state.running || state.paused || state.ended) return;

    const b = safeSpawnBounds();

    const x = opt.x ?? random(b.minX, b.maxX);
    const y = opt.y ?? random(-78, -38);

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
      danger: !!opt.danger,
      bonusGood: !!opt.bonusGood,
      weakHit: !!opt.weakHit,
      mercyPower: !!opt.mercyPower,
      x,
      y,
      vx: opt.vx ?? random(-10, 10),
      vy: speed,
      born: now(),
      lifeMs: opt.lifeMs || 7500,
      node: null
    };

    item.node = createTargetNode(item);

    if(item.danger) item.node.classList.add('danger');
    if(item.bonusGood) item.node.classList.add('bonus-good');
    if(item.weakHit) item.node.classList.add('weak-hit');
    if(isMobileView()) item.node.classList.add('mobile-touch');
    if(item.kind === 'good' && inAssistMode()) item.node.classList.add('assist-good');
    if(item.mercyPower) item.node.classList.add('mercy-power');

    state.items.push(item);
    el.targetLayer.appendChild(item.node);
  }

  function spawnNormalWave(){
    const r = currentJunkRate();
    let kind = chance(r) ? 'junk' : 'good';

    if(state.finalRush && chance(0.18)){
      kind = 'good';
    }

    if(state.phase === 2 && kind === 'junk' && chance(0.28)){
      spawnItem('junk', { fake: true });
      return;
    }

    if(state.phase === 3 && state.shieldGate > 0 && chance(0.62)){
      const needed = ['protein', 'carb', 'veg', 'fruit', 'fat'].filter(g => !state.phaseGroups.has(g));
      const group = needed.length ? pick(needed) : pick(['protein', 'carb', 'veg', 'fruit', 'fat']);
      const good = pick(FOOD_GOOD.filter(f => f.group === group));

      spawnItem('good', {
        good,
        bonusGood: true,
        weakHit: good.group === (PHASES[state.phase] || PHASES[1]).weakGroup
      });
      return;
    }

    if(kind === 'good'){
      const phaseInfo = PHASES[state.phase] || PHASES[1];
      let good;

      if(phaseInfo.weakGroup !== 'all' && chance(state.finalRush ? 0.46 : 0.28)){
        good = pick(FOOD_GOOD.filter(f => f.group === phaseInfo.weakGroup));
      }else{
        good = pick(FOOD_GOOD);
      }

      spawnItem('good', {
        good,
        bonusGood: state.phase === 4 && chance(0.28),
        weakHit: phaseInfo.weakGroup !== 'all' && good.group === phaseInfo.weakGroup,
        speed: state.finalRush ? random(92, 140) * itemSpeed() : undefined
      });
      return;
    }

    spawnItem('junk', {
      danger: (state.phase >= 4 || state.finalRush) && chance(0.46),
      speed: state.finalRush ? random(118, 172) * itemSpeed() : undefined
    });
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
      setTimeout(() => {
        if(item.node) item.node.remove();
      }, 120);
    }
  }

  function damageBoss(amount, label = 'HIT!'){
    if(state.ended) return;

    if(state.shieldGate > 0){
      showToast(`ต้องทำลายโล่ก่อน! เหลือ ${state.shieldGate}`);
      return;
    }

    state.bossHp = clamp(state.bossHp - amount, 0, state.bossMaxHp);

    bossDamageRing();

    if(amount >= 15){
      bossSay('โอ๊ย! พลังอาหารดีแรงมาก!');
    }else if(chance(0.28)){
      bossSay('ยังไม่ยอมแพ้หรอก!');
    }

    el.bossFace.animate([
      { transform: 'scale(1) rotate(0deg)' },
      { transform: 'scale(1.18) rotate(-8deg)' },
      { transform: 'scale(1) rotate(0deg)' }
    ], {
      duration: 240,
      easing: 'ease-out'
    });

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

    state.streakMiss = 0;

    const comboBonus = Math.min(18, state.combo * 1.5);
    const add = 10 + comboBonus + (state.phase * 2);

    state.score += add;
    state.heroCharge = clamp(state.heroCharge + 8 + state.combo * 0.8, 0, 100);

    const weak = isWeaknessFood(item);

    if(item.bonusGood){
      state.heroCharge = clamp(state.heroCharge + 8, 0, 100);
      state.score += 10;
      popText(item.x, item.y - 20, 'BONUS!', 'gold');
    }

    if(weak){
      state.score += 14;
      state.heroCharge = clamp(state.heroCharge + 7, 0, 100);
      popText(item.x, item.y - 36, 'WEAK HIT!', 'gold');
      bossSay(`โอ๊ย! ข้าแพ้${PHASES[state.phase].weakLabel}!`);
    }

    applyComboSkill();

    popText(item.x, item.y, `+${Math.round(add)}`, 'good');
    playTone('good');

    if(state.phase === 1){
      if(state.phaseGood >= 6){
        damageBoss(weak ? 10 : 7, weak ? 'WEAK POWER' : 'GOOD POWER');
        state.phaseGood = 0;
      }else{
        damageBoss(weak ? 5.2 : 3.2, weak ? 'WEAK GOOD' : 'GOOD');
      }
    }else if(state.phase === 2){
      if(item.fake){
        return;
      }

      if(state.phaseGood >= 8){
        damageBoss(weak ? 12 : 9, weak ? 'WEAK STRIKE' : 'COMBO STRIKE');
        state.phaseGood = 0;
      }else{
        damageBoss(weak ? 5.8 : 3.5, weak ? 'WEAK GOOD' : 'GOOD');
      }
    }else if(state.phase === 3){
      if(state.shieldGate > 0){
        const before = state.shieldGate;
        state.shieldGate = Math.max(0, 5 - state.phaseGroups.size);

        if(before !== state.shieldGate){
          popText(item.x, item.y, 'โล่ -1', 'gold');
        }

        if(state.shieldGate <= 0){
          state.fiveGroupRounds++;
          showToast('🛡️ โล่บอสแตกแล้ว! โจมตีได้!');
          playTone('power');
          damageBoss(weak ? 13 : 10, weak ? 'WEAK BREAK' : 'SHIELD BREAK');
        }
      }else{
        damageBoss(weak ? 7.2 : 4.5, weak ? 'WEAK HIT' : 'GOOD HIT');
      }
    }else{
      damageBoss(weak ? 8.5 : 5.2, weak ? 'FINAL WEAK' : 'FINAL HIT');
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
    resetComboAwards();
    state.streakMiss++;

    if(state.streakMiss >= 2 || state.lives <= 2){
      state.assistModeUntil = Math.max(state.assistModeUntil, now() + 5200);
    }

    state.lives--;
    state.heroCharge = Math.max(0, state.heroCharge - 7);
    state.bossHp = Math.min(state.bossMaxHp, state.bossHp + 1.4);

    popText(item.x, item.y, '-❤️', 'bad');
    showToast(`โดนอาหารขยะ! ${item.name}`);
    playTone('bad');
    shake();

    comebackAssist();

    if(state.lives <= 0){
      endGame(false);
    }
  }

  function activatePower(item){
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

      if(itemInsideHazard(item)){
        if(state.activeHazard.kind === 'oil'){
          item.x += Math.sin((t + item.id * 77) / 130) * 22 * dt;
          item.y += item.kind === 'junk' ? 28 * dt : 8 * dt;
        }else if(state.activeHazard.kind === 'sugar'){
          item.y -= item.kind === 'good' ? 12 * dt : 0;
        }else if(state.activeHazard.kind === 'lane' && item.kind === 'junk'){
          item.x += Math.sin((t + item.id * 91) / 90) * 34 * dt;
        }
      }

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
          resetComboAwards();
          state.streakMiss++;

          if(state.streakMiss >= 2 || state.lives <= 2){
            state.assistModeUntil = Math.max(state.assistModeUntil, now() + 5200);
          }

          popText(clamp(item.x, 30, rect.width - 30), rect.height - 50, 'MISS', 'bad');
          comebackAssist();
        }

        removeItem(item);
      }
    });
  }

  function attackJunkRain(){
    showWarning('Junk Rain! หลบอาหารขยะ');
    bossSay('ฝนอาหารขยะมาแล้ว!');
    playTone('bad');
    markUiDanger(1450);

    delayedSkill(() => {
      showToast('🌧️ Junk Rain! หลบอาหารขยะ');

      const count = state.phase >= 4 ? 8 : state.phase >= 3 ? 6 : 5;
      const points = [];

      for(let i = 0; i < count; i++){
        points.push({
          x: safeRandomX(),
          y: safeTelegraphY(0.34)
        });
      }

      showTelegraphMarks(points, 'mark');

      for(let i = 0; i < count; i++){
        setTimeout(() => {
          if(!state.running || state.paused || state.ended) return;

          spawnItem('junk', {
            danger: true,
            x: points[i] ? points[i].x : safeRandomX(),
            y: random(-110, -40),
            speed: random(120, 185) * itemSpeed()
          });
        }, i * 120);
      }
    }, 720);
  }

  function attackFakeHealthy(){
    showWarning('Fake Healthy! ดูให้ดีก่อนเก็บ');
    bossSay('แยกออกไหมว่าอันไหนของหลอก?');
    playTone('bad');
    markUiDanger(1450);

    delayedSkill(() => {
      showToast('🎭 ระวัง! อาหารขยะปลอมตัว');

      const points = [];
      for(let i = 0; i < 4; i++){
        points.push({
          x: safeRandomX(),
          y: safeTelegraphY(0.36)
        });
      }

      showTelegraphMarks(points, 'mark');

      for(let i = 0; i < 4; i++){
        setTimeout(() => {
          if(!state.running || state.paused || state.ended) return;

          spawnItem('junk', {
            fake: true,
            danger: true,
            x: points[i] ? points[i].x : safeRandomX(),
            y: random(-90, -38),
            speed: random(85, 130) * itemSpeed()
          });
        }, i * 180);
      }
    }, 720);
  }

  function attackSugarWave(){
    showWarning('Sugar Wave! คลื่นน้ำตาลมาแล้ว');
    bossSay('คลื่นน้ำตาลจะพาเจ้าแพ้!');
    playTone('bad');
    markUiDanger(1450);

    delayedSkill(() => {
      showToast('🥤 Sugar Wave! คลื่นน้ำตาลมาแล้ว');

      const rect = getAreaRect();
      const n = state.phase >= 4 ? 7 : 5;
      const b = safeSpawnBounds();
      const lineY = Math.min(b.maxY, Math.max(b.topSafe + 35, rect.height * 0.36));

      showTelegraphMarks([{ y: lineY }], 'line');

      for(let i = 0; i < n; i++){
        spawnItem('junk', {
          danger: true,
          x: clamp(((i + 1) / (n + 1)) * rect.width, b.minX, b.maxX),
          y: -55 - Math.abs(Math.floor(n / 2) - i) * 18,
          vx: random(-6, 6),
          speed: random(112, 155) * itemSpeed()
        });
      }
    }, 720);
  }

  function attackShield(){
    if(state.phase < 2 || state.shieldGate > 0) return;

    showWarning('Boss Shield! เก็บอาหารดีเพื่อทำลายโล่');
    markUiDanger(1250);

    delayedSkill(() => {
      state.shieldGate = state.phase >= 4 ? 3 : 2;
      showToast(`🛡️ บอสเปิดโล่! เก็บอาหารดี ${state.shieldGate} ครั้ง`);
      bossSay('โล่บอสเปิดแล้ว เจ้าตีข้าไม่ได้หรอก!');
      playTone('boss');
    }, 620);
  }

  function bossAttack(){
    bossAttackPatterned();
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
    state.heroHitsUsed++;

    showHeroCutin(state.phase >= 4 ? 'FINAL HERO HIT!' : 'พลังอาหารดีโจมตีบอส');
    shake();

    let amount = 18;
    if(state.phase === 3) amount = 22;
    if(state.phase === 4) amount = 26;
    if(state.finalRush) amount += 4;

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

        if(state.phase >= 4 && chance(state.finalRush ? 0.32 : 0.22)){
          setTimeout(() => {
            if(state.running && !state.paused && !state.ended) spawnNormalWave();
          }, 160);
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

      updateFairDifficulty();
      maybeSpawnMercyPower();
      checkFinalRush();
      updateDangerMeter();
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

    state.streakMiss = 0;
    state.comboAward5 = false;
    state.comboAward10 = false;
    state.comboAward15 = false;
    state.finalRush = false;
    state.heroHitsUsed = 0;
    state.fiveGroupRounds = 0;

    state.patternIndex = 0;
    state.finishMovePlaying = false;

    state.activeHazard = null;
    state.skillActiveUntil = 0;

    state.assistModeUntil = 0;
    state.lastHeroReadyAnnounce = false;
    state.pausedAt = 0;
    cancelDelayedSkills();

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

    state.items.forEach(item => {
      if(item.node) item.node.remove();
    });

    state.items = [];
    el.fxLayer.innerHTML = '';

    el.app.classList.remove('final-rush', 'ui-danger', 'compact-summary');

    if(el.dangerFill) el.dangerFill.style.width = '0%';
    if(el.dangerMeter) el.dangerMeter.classList.remove('danger-hot');
    if(el.bossSpeech) el.bossSpeech.classList.remove('show');
    if(el.warningFlash) el.warningFlash.classList.remove('show');
    if(el.heroCutin) el.heroCutin.classList.remove('show');
    if(el.finalRushBadge) el.finalRushBadge.classList.remove('show');
    if(el.comboBurst) el.comboBurst.classList.remove('show');
    if(el.finishMove) el.finishMove.classList.remove('show');
    if(el.bossSkillLabel) el.bossSkillLabel.classList.remove('show');

    clearTelegraphs();
    clearHazards();
    chooseDailyChallenge();

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
    bossSay('เข้ามาเลย Hero! ข้าคือราชาอาหารขยะ!');

    setPhase(1, true);

    for(let i = 0; i < 5; i++){
      setTimeout(() => {
        if(state.running && !state.paused && !state.ended){
          spawnItem(i < 3 ? 'good' : 'junk');
        }
      }, i * 260);
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

    clearTelegraphs();
    clearHazards();
    cancelDelayedSkills();

    state.items.forEach(item => {
      if(item.node) item.node.remove();
    });

    state.items = [];

    playFinishMoveThenSummary(win);
  }

  function showSummaryNow(win){
    const stars = starsFor(win);

    const dailyChallengeDone = state.dailyChallenge ? !!state.dailyChallenge.check({
      miss: state.miss,
      heroHitsUsed: state.heroHitsUsed,
      goodHits: state.goodHits,
      maxCombo: state.maxCombo
    }) : false;

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
      heroHitsUsed: state.heroHitsUsed,
      fiveGroupRounds: state.fiveGroupRounds,
      dailyChallengeId: state.dailyChallenge ? state.dailyChallenge.id : '',
      dailyChallengeDone,
      completed: !!win,
      stars,
      ts: new Date().toISOString()
    };

    try{
      localStorage.setItem('GJ_SOLO_BOSS_LAST', JSON.stringify(summary));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    }catch(err){
      // ignore private mode / storage blocked
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

    const oldKid = el.summaryLayer.querySelector('.kid-summary-list');
    if(oldKid) oldKid.remove();

    const oldBadges = el.summaryLayer.querySelector('.badge-row');
    if(oldBadges) oldBadges.remove();

    const oldBook = el.summaryLayer.querySelector('.boss-book');
    if(oldBook) oldBook.remove();

    const kidList = DOC.createElement('div');
    kidList.className = 'kid-summary-list';

    const goodLine = summary.goodHits >= 25
      ? `✅ เก่งมาก เก็บอาหารดีได้ <b>${summary.goodHits}</b> ชิ้น`
      : `✅ เก็บอาหารดีได้ <b>${summary.goodHits}</b> ชิ้น รอบหน้าลองเก็บให้มากขึ้น`;

    const heroLine = state.heroHitsUsed >= 2
      ? `⚡ ใช้ HERO HIT ได้ดีมาก`
      : `⚡ รอบหน้าเก็บอาหารดีเพื่อชาร์จ HERO HIT ให้ไวขึ้น`;

    const missLine = summary.miss <= 6
      ? `🛡️ หลบอาหารขยะได้ดี พลาดไม่เยอะ`
      : `⚠️ ฝึกเพิ่ม: เห็น 🍟🍩🥤 ให้หลบก่อน`;

    const groupLine = state.fiveGroupRounds >= 1
      ? `🌈 ทำอาหารครบ 5 หมู่ได้แล้ว`
      : `🌈 เป้าหมายต่อไป: เก็บอาหารให้ครบ 5 หมู่`;

    kidList.innerHTML = `
      <div class="kid-summary-line">${goodLine}</div>
      <div class="kid-summary-line">${heroLine}</div>
      <div class="kid-summary-line">${missLine}</div>
      <div class="kid-summary-line">${groupLine}</div>
    `;

    el.summaryTip.insertAdjacentElement('afterend', kidList);

    const badges = buildBadges(summary);
    if(badges.length){
      const row = DOC.createElement('div');
      row.className = 'badge-row';
      row.innerHTML = badges.map(b => (
        `<span class="result-badge">${b.icon} ${b.text}</span>`
      )).join('');
      kidList.insertAdjacentElement('afterend', row);
    }

    const book = DOC.createElement('div');
    book.className = 'boss-book';
    book.innerHTML = `
      <strong>📘 วันนี้ได้เรียนรู้</strong>
      <p>${getBossBookText(summary)}</p>
    `;

    const badgeRow = el.summaryLayer.querySelector('.badge-row');
    if(badgeRow){
      badgeRow.insertAdjacentElement('afterend', book);
    }else{
      kidList.insertAdjacentElement('afterend', book);
    }

    updateCompactSummaryMode();
    el.summaryLayer.classList.add('show');

    requestAnimationFrame(() => {
      try{
        el.summaryLayer.scrollTop = 0;
        const card = el.summaryLayer.querySelector('.overlay-card');
        if(card) card.scrollTop = 0;
      }catch(err){}
    });

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

    if(state.paused){
      state.pausedAt = now();
      cancelDelayedSkills();
      clearTelegraphs();
    }

    el.pauseBtn.textContent = state.paused ? '▶️ เล่นต่อ' : '⏸ พัก';
    showToast(state.paused ? 'พักเกม' : 'เล่นต่อ!');
    state.lastTs = 0;
    updateHud();
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
        state.pausedAt = now();
        cancelDelayedSkills();
        clearTelegraphs();
        el.pauseBtn.textContent = '▶️ เล่นต่อ';
        updateHud();
      }
    });

    DOC.addEventListener('visibilitychange', () => {
      if(DOC.hidden && state.running && !state.ended){
        state.paused = true;
        state.pausedAt = now();
        cancelDelayedSkills();
        clearTelegraphs();
        el.pauseBtn.textContent = '▶️ เล่นต่อ';
        updateHud();
      }
    });

    WIN.addEventListener('resize', () => {
      updateCompactSummaryMode();
    });
  }

  function boot(){
    mountCinematicUI();
    mountBossV4UI();
    mountBossV5UI();
    mountBossV6UI();
    ensureStarGoalIntro();
    bindEvents();
    resetGame();

    if(CFG.view === 'cvr' || CFG.view === 'cardboard'){
      showToast('โหมด Cardboard: เล็งกลางจอ แล้วแตะเพื่อยิง', 1600);
    }
  }

  boot();
})();
