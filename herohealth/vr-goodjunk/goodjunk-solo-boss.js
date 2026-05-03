// === /herohealth/vr-goodjunk/goodjunk-solo-boss.js ===
// FULL PATCH v20260503j-GOODJUNK-SOLO-BOSS-V8-5-FINAL-POLISH
// ✅ หน้า /herohealth/vr-goodjunk/goodjunk-solo-boss.html คือหน้าเล่นเกมจริง
// ✅ ไม่ใช่ launcher
// ✅ bindEvents null-safe ไม่พัง addEventListener of null
// ✅ เล่นได้เลย: Intro → Game → Summary
// ✅ ใช้ CFG.hub เท่านั้นเมื่อกลับ เพื่อให้ gate ส่งเข้า cooldown ได้ถูก
// ✅ รองรับ warmup gate → game → cooldown gate
// ✅ Solo Phase Boss v8.5:
//    - Boss HP / Shield / Phase / Final Rush
//    - Boss Skill Identity: Junk Storm / Soda Splash / Fried Wall / Sugar Trap / Burger Shield Regen
//    - Telegraph Warning / Warning Flash / Danger Lane / Danger Meter
//    - HERO HIT / Big HERO HIT Button / Ready Pulse / Hero Cut-in / Finish Move
//    - Power-ups: Shield / Slow Time / Magnet / Clean Blast
//    - Boss Weakness Mission / Combo Skill x5 x10 x15
//    - Daily Challenge / Result Badges / Boss Book / Learning Micro-tip
//    - Kid-friendly Summary
//    - Mobile-safe spawn / Anti-overlap / Pause-safe / Fair difficulty
//    - WebAudio SFX + mobile vibration + toggle controls
// ✅ No Apps Script logging in this version

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const PATCH = 'v20260503j-GOODJUNK-SOLO-BOSS-V8-5-FINAL-POLISH';
  const ROOT = 'https://supparang.github.io/webxr-health-mobile/herohealth/';
  const DEFAULT_HUB = ROOT + 'nutrition-zone.html';

  const qs = new URLSearchParams(location.search);

  function clean(v, fallback = ''){
    v = String(v ?? '').trim();
    return v || fallback;
  }

  function safeUrl(raw, fallback){
    try{
      if(!String(raw || '').trim()) return fallback;
      return new URL(String(raw), location.href).toString();
    }catch(_){
      return fallback;
    }
  }

  function num(v, fallback = 0){
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(v, min, max){
    v = Number(v);
    if(!Number.isFinite(v)) v = min;
    return Math.max(min, Math.min(max, v));
  }

  function now(){
    return performance.now();
  }

  function mulberry32(seed){
    let t = (Number(seed) >>> 0) || 1;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CFG = Object.assign({
    pid: clean(qs.get('pid'), 'anon'),
    name: clean(qs.get('name') || qs.get('nick'), 'Hero'),
    nick: clean(qs.get('nick') || qs.get('name'), 'Hero'),
    diff: clean(qs.get('diff'), 'normal'),
    time: clean(qs.get('time'), '150'),
    seed: clean(qs.get('seed'), String(Date.now())),
    view: clean(qs.get('view'), 'mobile'),
    run: clean(qs.get('run'), 'play'),
    zone: clean(qs.get('zone'), 'nutrition'),
    cat: clean(qs.get('cat'), 'nutrition'),
    game: 'goodjunk',
    gameId: 'goodjunk',
    mode: clean(qs.get('mode'), 'solo-boss'),
    entry: clean(qs.get('entry'), 'solo-boss'),
    phaseBoss: clean(qs.get('phaseBoss'), '1'),
    hub: safeUrl(qs.get('hub'), DEFAULT_HUB),
    hubRoot: safeUrl(qs.get('hubRoot'), DEFAULT_HUB),
    api: clean(qs.get('api'), ''),
    log: clean(qs.get('log'), ''),
    studyId: clean(qs.get('studyId'), ''),
    section: clean(qs.get('section'), ''),
    session_code: clean(qs.get('session_code'), '')
  }, WIN.HHA_GOODJUNK_SOLO_BOSS_CONFIG || WIN.GJ_SOLO_BOSS_CONFIG || {});

  WIN.HHA_GOODJUNK_SOLO_BOSS_CONFIG = CFG;
  WIN.GJ_SOLO_BOSS_CONFIG = CFG;
  WIN.HHA_GAME_CONTEXT = CFG;

  const DIFF = String(CFG.diff || 'normal').toLowerCase();

  const TUNING = {
    easy: {
      time: 120,
      lives: 6,
      bossHp: 420,
      spawnEvery: 880,
      maxTargets: 5,
      junkChance: 0.34,
      speedMin: 1.0,
      speedMax: 1.8,
      bossAttackEvery: 7200,
      finalRushAt: 0.28,
      minWinSec: 65,
      shieldUntilSec: 25,
      heroHitDmg: 54
    },
    normal: {
      time: 150,
      lives: 5,
      bossHp: 620,
      spawnEvery: 720,
      maxTargets: 6,
      junkChance: 0.43,
      speedMin: 1.25,
      speedMax: 2.35,
      bossAttackEvery: 5600,
      finalRushAt: 0.32,
      minWinSec: 80,
      shieldUntilSec: 30,
      heroHitDmg: 68
    },
    hard: {
      time: 180,
      lives: 4,
      bossHp: 820,
      spawnEvery: 590,
      maxTargets: 7,
      junkChance: 0.50,
      speedMin: 1.55,
      speedMax: 2.95,
      bossAttackEvery: 4600,
      finalRushAt: 0.36,
      minWinSec: 95,
      shieldUntilSec: 36,
      heroHitDmg: 82
    },
    challenge: {
      time: 180,
      lives: 4,
      bossHp: 980,
      spawnEvery: 500,
      maxTargets: 8,
      junkChance: 0.56,
      speedMin: 1.85,
      speedMax: 3.35,
      bossAttackEvery: 3900,
      finalRushAt: 0.42,
      minWinSec: 105,
      shieldUntilSec: 42,
      heroHitDmg: 96
    }
  };

  const tune = TUNING[DIFF] || TUNING.normal;
  const plannedTime = clamp(num(CFG.time, tune.time), 90, 180);

  const GOOD = [
    { emoji:'🍎', label:'แอปเปิล', group:'fruit', dmg:10, charge:8 },
    { emoji:'🥦', label:'บรอกโคลี', group:'green', dmg:12, charge:9 },
    { emoji:'🥕', label:'แครอท', group:'green', dmg:10, charge:8 },
    { emoji:'🍉', label:'แตงโม', group:'fruit', dmg:9, charge:7 },
    { emoji:'🐟', label:'ปลา', group:'protein', dmg:13, charge:10 },
    { emoji:'🥚', label:'ไข่', group:'protein', dmg:12, charge:9 },
    { emoji:'🥛', label:'นม', group:'protein', dmg:11, charge:8 },
    { emoji:'🍚', label:'ข้าว', group:'carb', dmg:10, charge:7 },
    { emoji:'🫘', label:'ถั่ว', group:'protein', dmg:12, charge:9 },
    { emoji:'🥬', label:'ผักใบเขียว', group:'green', dmg:12, charge:9 }
  ];

  const JUNK = [
    { emoji:'🍩', label:'โดนัท', group:'sweet', dmg:0, penalty:1 },
    { emoji:'🥤', label:'น้ำอัดลม', group:'soda', dmg:0, penalty:1 },
    { emoji:'🍟', label:'เฟรนช์ฟรายส์', group:'fried', dmg:0, penalty:1 },
    { emoji:'🍔', label:'เบอร์เกอร์มันเยอะ', group:'fatty', dmg:0, penalty:1 },
    { emoji:'🍭', label:'ลูกอม', group:'sweet', dmg:0, penalty:1 },
    { emoji:'🍫', label:'ช็อกโกแลตหวาน', group:'sweet', dmg:0, penalty:1 },
    { emoji:'🧁', label:'คัพเค้ก', group:'sweet', dmg:0, penalty:1 }
  ];

  const BOSS_IDENTITY = {
    name: 'Junk King',
    emoji: '👑🍔',
    title: 'ราชาอาหารขยะ',
    weakness: {
      phase1: {
        key: 'green',
        label: 'อาหารสีเขียว',
        icons: ['🥦','🥬','🥕'],
        tip: 'อาหารสีเขียวช่วยเปิดโล่บอสเร็วขึ้น'
      },
      phase2: {
        key: 'protein',
        label: 'โปรตีนดี',
        icons: ['🐟','🥚','🫘','🥛'],
        tip: 'โปรตีนดีช่วยลดพลัง Junk Storm'
      },
      phase3: {
        key: 'fruit',
        label: 'ผลไม้สด',
        icons: ['🍎','🍉'],
        tip: 'ผลไม้สดช่วยชาร์จ HERO HIT ในช่วงบอสคลั่ง'
      }
    },
    skills: [
      {
        id: 'junkStorm',
        name: 'Junk Storm',
        emoji: '🌪️',
        warning: 'บอสกำลังปล่อยพายุอาหารขยะ!',
        pattern: ['junk','junk','good','junk','good','junk'],
        telegraphMs: 1100,
        waveDelay: 150,
        dangerGain: 12
      },
      {
        id: 'sodaSplash',
        name: 'Soda Splash',
        emoji: '🥤',
        warning: 'Soda Splash! ระวังน้ำอัดลมเด้งเร็ว!',
        pattern: ['soda','soda','good','soda','junk'],
        telegraphMs: 950,
        waveDelay: 120,
        dangerGain: 16
      },
      {
        id: 'friedWall',
        name: 'Fried Wall',
        emoji: '🍟',
        warning: 'Fried Wall! ของทอดกำลังปิดทาง!',
        pattern: ['fried','fried','lane','good','fried','junk'],
        telegraphMs: 1200,
        waveDelay: 135,
        dangerGain: 18
      },
      {
        id: 'sugarTrap',
        name: 'Sugar Trap',
        emoji: '🍩',
        warning: 'Sugar Trap! ของหวานหลอกตากำลังมา!',
        pattern: ['sweet','good','sweet','junk','sweet'],
        telegraphMs: 1050,
        waveDelay: 160,
        dangerGain: 14
      },
      {
        id: 'burgerShield',
        name: 'Burger Shield Regen',
        emoji: '🍔',
        warning: 'Burger Shield! บอสกำลังฟื้นโล่!',
        pattern: ['junk','good','junk','good','burger'],
        telegraphMs: 1250,
        waveDelay: 170,
        dangerGain: 10,
        shieldRegen: true
      }
    ]
  };

  const DAILY_CHALLENGES = [
    {
      id: 'no-soda',
      title: 'ภารกิจวันนี้: ห้ามแตะน้ำอัดลม',
      icon: '🥤',
      rule: 'avoid_emoji',
      value: '🥤',
      reward: 'Soda Dodger'
    },
    {
      id: 'green-power',
      title: 'ภารกิจวันนี้: เก็บผักให้ครบ 8 ครั้ง',
      icon: '🥦',
      rule: 'collect_group',
      value: 'green',
      target: 8,
      reward: 'Green Hero'
    },
    {
      id: 'combo-master',
      title: 'ภารกิจวันนี้: ทำ Combo x15',
      icon: '⚡',
      rule: 'combo',
      target: 15,
      reward: 'Combo Master'
    }
  ];

  const RESULT_BADGES = [
    { id:'boss-breaker', icon:'👑', title:'Boss Breaker', test:s => s.bossDefeated },
    { id:'green-hero', icon:'🥦', title:'Green Hero', test:s => s.greenHits >= 8 },
    { id:'combo-master', icon:'⚡', title:'Combo Master', test:s => s.bestCombo >= 15 },
    { id:'clean-player', icon:'🌟', title:'Clean Player', test:s => s.miss <= 2 },
    { id:'comeback-kid', icon:'💪', title:'Comeback Kid', test:s => s.comebackTriggered },
    { id:'hero-finisher', icon:'🔥', title:'Hero Finisher', test:s => s.finishMoveUsed },
    { id:'protein-power', icon:'🐟', title:'Protein Power', test:s => s.proteinHits >= 6 },
    { id:'fruit-boost', icon:'🍎', title:'Fruit Boost', test:s => s.fruitHits >= 5 },
    { id:'storm-survivor', icon:'🌪️', title:'Storm Survivor', test:s => (s.bossSkillUsed?.junkStorm || 0) >= 1 },
    { id:'soda-dodger', icon:'🥤', title:'Soda Dodger', test:s => !s.dailyFailed && s.dailyChallengeId === 'no-soda' },
    { id:'shield-breaker', icon:'🛡️', title:'Shield Breaker', test:s => s.bossShieldRegenCount >= 1 && s.bossDefeated }
  ];

  const POWER_UPS = [
    {
      id: 'shield',
      emoji: '🛡️',
      label: 'Hero Shield',
      tip: 'กันพลาดจากขยะ 1 ครั้ง',
      durationSec: 0
    },
    {
      id: 'slow',
      emoji: '⏳',
      label: 'Slow Time',
      tip: 'ทำให้เป้าหมายเคลื่อนช้าลงชั่วคราว',
      durationSec: 6
    },
    {
      id: 'magnet',
      emoji: '🧲',
      label: 'Good Magnet',
      tip: 'อาหารดีเด่นชัดและเข้าหาง่ายขึ้น',
      durationSec: 7
    },
    {
      id: 'cleanBlast',
      emoji: '✨',
      label: 'Clean Blast',
      tip: 'ล้างอาหารขยะบนจอทันที',
      durationSec: 0
    }
  ];

  const PHASE_CINEMATIC = {
    phase1: {
      title: 'PHASE 1',
      sub: 'Break the Junk Shield!',
      emoji: '🛡️👑'
    },
    phase2: {
      title: 'PHASE 2',
      sub: 'Junk Storm is coming!',
      emoji: '🌪️🍩'
    },
    phase3: {
      title: 'PHASE 3',
      sub: 'Boss Rage Mode!',
      emoji: '😡🔥'
    },
    finalRush: {
      title: 'FINAL RUSH',
      sub: 'Use HERO HIT to finish!',
      emoji: '🔥🦸'
    }
  };

  const BOSS_SPEECH = {
    intro: [
      'ข้าคือ Junk King! ถ้าแยกอาหารดีไม่ได้ เจ้าผ่านไม่ได้แน่!',
      'อาหารขยะกำลังบุกเมืองสุขภาพแล้ว!'
    ],
    shield: [
      'โล่ของข้ายังแข็งแรงอยู่!',
      'อาหารดีพวกนั้นทำอะไรข้าไม่ได้หรอก!'
    ],
    shieldBreak: [
      'อะไรนะ! โล่ของข้าแตกแล้ว!',
      'เจ้ารู้จักอาหารดีจริง ๆ งั้นหรือ!'
    ],
    phase2: [
      'ถ้าอย่างนั้นรับ Junk Storm ไปเลย!',
      'ขยะจะเยอะขึ้น เจ้าหลบให้ทันก็แล้วกัน!'
    ],
    phase3: [
      'ข้าโกรธแล้ว! Boss Rage!',
      'ตอนนี้ไม่มีเวลาให้ลังเลแล้ว!'
    ],
    finalRush: [
      'FINAL RUSH! ข้าจะไม่ยอมแพ้ง่าย ๆ!',
      'ถ้าจะชนะ ต้องใช้ HERO HIT ให้ถูกจังหวะ!'
    ],
    defeated: [
      'อ๊าก! ข้าแพ้อาหารดีแล้ว!',
      'เมืองสุขภาพปลอดภัย... ครั้งนี้เจ้าชนะ!'
    ]
  };

  const state = {
    patch: PATCH,
    booted: false,
    started: false,
    paused: false,
    ended: false,

    score: 0,
    good: 0,
    junkHit: 0,
    missedGood: 0,
    miss: 0,
    combo: 0,
    bestCombo: 0,

    lives: tune.lives,
    timeLeft: plannedTime,
    bossHp: tune.bossHp,
    bossMaxHp: tune.bossHp,
    heroHit: 0,
    phase: 1,
    finalRush: false,
    rage: 0,

    bossShield: true,
    elapsedSec: 0,
    phaseAnnounced: {
      shieldBreak: false,
      phase2: false,
      phase3: false,
      finalRush: false
    },

    mission: {
      phase1Good: 0,
      phase2Dodge: 0,
      phase3HeroHit: 0,
      bossWavesSurvived: 0
    },

    dailyChallenge: null,
    dailyProgress: 0,
    dailyFailed: false,

    bossSpeechLast: '',
    dangerMeter: 0,
    dangerLaneActive: false,
    dangerLaneX: 0,
    warningActive: false,

    heroCutInActive: false,
    heroHitReadyAnnounced: false,
    finishMoveUsed: false,
    comebackTriggered: false,

    greenHits: 0,
    proteinHits: 0,
    fruitHits: 0,

    comboSkillUsed: {
      x5: false,
      x10: false,
      x15: false
    },

    weaknessMission: {
      active: true,
      hits: 0,
      target: 6,
      label: 'อาหารดี',
      tip: 'เก็บอาหารดีเพื่อเปิดจุดอ่อนบอส'
    },

    activePower: {
      shield: 0,
      slowUntil: 0,
      magnetUntil: 0
    },

    powerUpsCollected: {
      shield: 0,
      slow: 0,
      magnet: 0,
      cleanBlast: 0
    },

    cinematicLock: false,
    phaseCinematicShown: {
      phase1: false,
      phase2: false,
      phase3: false,
      finalRush: false
    },

    damageTotal: 0,
    shieldBlocks: 0,
    microTipsShown: 0,
    lastMicroTipAt: 0,

    bossSkillUsed: {
      junkStorm: 0,
      sodaSplash: 0,
      friedWall: 0,
      sugarTrap: 0,
      burgerShield: 0
    },

    lastBossSkillId: '',
    bossSkillCooldownLock: false,
    bossShieldRegenCount: 0,

    lastFeedbackAt: 0,
    lastSfxAt: 0,
    sfxEnabled: true,
    vibrateEnabled: true,
    finalRushToastLock: false,
    lastFinalRushToastAt: 0,
    safeExitReady: false,

    lastFrame: 0,
    lastSpawn: 0,
    lastBossAttack: 0,
    startTs: 0,
    endTs: 0,

    targets: new Map(),
    seq: 0,

    rng: mulberry32(Number(CFG.seed || Date.now()))
  };

  const el = {};
  let __audioCtx = null;

  function $(id){
    return DOC.getElementById(id);
  }

  function cacheElements(){
    Object.assign(el, {
      app: $('gjSoloBossApp') || $('app') || DOC.body,

      boot: $('gjBoot'),
      bootStatus: $('gjBootStatusText'),
      bootError: $('gjBootError'),
      bootStartBtn: $('gjBootStartBtn'),
      bootBackBtn: $('gjBootBackBtn'),

      introScreen: $('introScreen'),
      introStartBtn: $('introStartBtn') || $('startBtn'),
      introBackBtn: $('introBackBtn'),

      gameScreen: $('gameScreen'),
      summaryScreen: $('summaryScreen'),

      scoreText: $('scoreText'),
      timerText: $('timerText'),
      lifeText: $('lifeText'),
      phaseText: $('phaseText'),
      bossHpText: $('bossHpText'),
      bossHpFill: $('bossHpFill'),
      heroHitText: $('heroHitText'),
      heroHitFill: $('heroHitFill'),
      heroHitBtn: $('heroHitBtn'),
      comboText: $('comboText'),
      goodText: $('goodText'),
      missText: $('missText'),
      rageText: $('rageText'),
      goalText: $('goalText'),

      backBtn: $('backBtn'),
      pauseBtn: $('pauseBtn'),
      resumeBtn: $('resumeBtn'),
      pauseOverlay: $('pauseOverlay'),
      pauseResumeBtn: $('pauseResumeBtn'),
      pauseBackBtn: $('pauseBackBtn'),

      gameWorld: $('gameWorld'),
      targetLayer: $('targetLayer') || $('foodLayer'),
      fxLayer: $('fxLayer') || $('particleLayer') || $('overlayLayer'),

      bossAvatar: $('bossAvatar'),
      bossArena: $('bossArena'),
      coachText: $('coachText'),
      toast: $('toast'),
      toastText: $('toastText'),
      announcer: $('announcer'),
      finalRushText: $('finalRushText'),

      summaryTitle: $('summaryTitle'),
      summaryScore: $('summaryScore'),
      summaryGood: $('summaryGood'),
      summaryMiss: $('summaryMiss'),
      summaryStars: $('summaryStars'),
      summaryTip: $('summaryTip'),
      summaryReplayBtn: $('summaryReplayBtn') || $('replayBtn') || $('restartBtn'),
      summaryBackBtn: $('summaryBackBtn') || $('backHubBtn') || $('hubBtn') || $('homeBtn'),

      replayBtn: $('replayBtn'),
      restartBtn: $('restartBtn'),
      homeBtn: $('homeBtn'),
      hubBtn: $('hubBtn'),
      backHubBtn: $('backHubBtn')
    });
  }

  function on(node, eventName, handler, options){
    if(node && typeof node.addEventListener === 'function'){
      node.addEventListener(eventName, handler, options);
      return true;
    }
    return false;
  }

  function setText(node, text){
    if(node) node.textContent = String(text);
  }

  function show(node){
    if(!node) return;
    node.hidden = false;
    node.style.display = '';
  }

  function hide(node){
    if(!node) return;
    node.hidden = true;
    node.style.display = 'none';
  }

  function hideBoot(){
    if(el.boot){
      el.boot.classList.add('is-hidden');
      el.boot.style.display = 'none';
    }
    if(typeof WIN.GJ_SOLO_HIDE_BOOT === 'function'){
      try{ WIN.GJ_SOLO_HIDE_BOOT(); }catch(_){}
    }
  }

  function showBootError(err){
    if(el.bootStatus) el.bootStatus.textContent = 'โหลดเกมไม่สำเร็จ';
    if(el.bootError){
      el.bootError.style.display = 'block';
      el.bootError.textContent = String(err && (err.stack || err.message) || err || 'Unknown error');
    }
  }

  function isCooldownHub(){
    return String(CFG.hub || '').includes('warmup-gate.html') &&
      String(CFG.hub || '').includes('phase=cooldown');
  }

  function updateExitButtonLabels(){
    const label = isCooldownHub()
      ? 'ไป Cooldown'
      : 'กลับ Nutrition';

    [el.summaryBackBtn, el.backBtn, el.bootBackBtn, el.introBackBtn, el.pauseBackBtn].forEach(btn => {
      if(btn) btn.textContent = label;
    });
  }

  function goHub(){
    try{
      if(state.started && !state.ended && !state.safeExitReady){
        const ok = WIN.confirm('กำลังเล่นอยู่ ต้องการออกจากเกมหรือไม่?');
        if(!ok) return;
      }

      WIN.location.href = CFG.hub || DEFAULT_HUB;
    }catch(_){
      WIN.location.href = DEFAULT_HUB;
    }
  }

  function replayGame(){
    try{
      const u = new URL(location.href);
      u.searchParams.set('seed', String(Date.now()));
      WIN.location.href = u.toString();
    }catch(_){
      WIN.location.reload();
    }
  }

  function rand(){
    return state.rng();
  }

  function pick(arr){
    return arr[Math.floor(rand() * arr.length)];
  }

  function worldRect(){
    const node = el.gameWorld || el.app || DOC.body;
    const r = node.getBoundingClientRect();
    return {
      width: Math.max(320, r.width || WIN.innerWidth),
      height: Math.max(420, r.height || WIN.innerHeight)
    };
  }

  function audioCtx(){
    try{
      if(!__audioCtx){
        const AC = WIN.AudioContext || WIN.webkitAudioContext;
        if(!AC) return null;
        __audioCtx = new AC();
      }
      return __audioCtx;
    }catch(_){
      return null;
    }
  }

  function beep(kind = 'good'){
    if(!state.sfxEnabled) return;

    const t = Date.now();
    if(t - state.lastSfxAt < 55) return;
    state.lastSfxAt = t;

    try{
      const ctx = audioCtx();
      if(!ctx) return;

      if(ctx.state === 'suspended'){
        ctx.resume().catch(()=>{});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const cfg =
        kind === 'bad' ? { f1:180, f2:95, dur:.13, gain:.055, type:'sawtooth' } :
        kind === 'boss' ? { f1:110, f2:70, dur:.18, gain:.065, type:'square' } :
        kind === 'hero' ? { f1:520, f2:880, dur:.18, gain:.060, type:'triangle' } :
        kind === 'power' ? { f1:660, f2:990, dur:.16, gain:.050, type:'sine' } :
        kind === 'win' ? { f1:620, f2:1040, dur:.22, gain:.070, type:'triangle' } :
        { f1:420, f2:620, dur:.11, gain:.045, type:'sine' };

      osc.type = cfg.type;
      osc.frequency.setValueAtTime(cfg.f1, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(cfg.f2, ctx.currentTime + cfg.dur);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(cfg.gain, ctx.currentTime + .018);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + cfg.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + cfg.dur + .02);
    }catch(_){}
  }

  function vibe(pattern = 20){
    if(!state.vibrateEnabled) return;
    try{
      if(navigator.vibrate) navigator.vibrate(pattern);
    }catch(_){}
  }

  function feedback(kind = 'good'){
    if(kind === 'good'){
      beep('good');
      vibe(12);
      return;
    }

    if(kind === 'bad'){
      beep('bad');
      vibe([30, 35, 30]);
      return;
    }

    if(kind === 'boss'){
      beep('boss');
      vibe([45, 30, 45]);
      return;
    }

    if(kind === 'hero'){
      beep('hero');
      vibe([25, 30, 25, 30, 55]);
      return;
    }

    if(kind === 'power'){
      beep('power');
      vibe(18);
      return;
    }

    if(kind === 'win'){
      beep('win');
      vibe([25, 25, 45, 25, 80]);
    }
  }

  function toast(message, ms = 1200){
    const msg = String(message || '');

    if(el.toastText){
      el.toastText.textContent = msg;
    }

    if(el.toast){
      el.toast.textContent = msg;
      el.toast.classList.add('show');
      el.toast.style.display = 'block';
      clearTimeout(toast._t);
      toast._t = setTimeout(() => {
        el.toast.classList.remove('show');
        el.toast.style.display = '';
      }, ms);
      return;
    }

    const t = DOC.createElement('div');
    t.className = 'gjRuntimeToast';
    t.textContent = msg;
    t.style.cssText = [
      'position:absolute',
      'left:50%',
      'bottom:calc(78px + env(safe-area-inset-bottom,0px))',
      'transform:translateX(-50%)',
      'z-index:9999',
      'max-width:min(92vw,640px)',
      'padding:12px 14px',
      'border-radius:999px',
      'background:rgba(15,23,42,.92)',
      'border:1px solid rgba(148,163,184,.18)',
      'color:#f8fafc',
      'font-weight:1000',
      'box-shadow:0 18px 42px rgba(0,0,0,.34)',
      'text-align:center'
    ].join(';');

    (el.app || DOC.body).appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  function safeFinalRushToast(message, ms = 1200){
    const t = Date.now();

    if(state.finalRush){
      if(t - state.lastFinalRushToastAt < 2200) return;
      state.lastFinalRushToastAt = t;
    }

    toast(message, ms);
  }

  function fx(x, y, text, type = 'good'){
    const layer = el.fxLayer || el.app || DOC.body;
    const n = DOC.createElement('div');
    n.textContent = text;
    n.className = `gjFx ${type}`;
    n.style.cssText = [
      'position:absolute',
      `left:${x}px`,
      `top:${y}px`,
      'transform:translate(-50%,-50%)',
      'z-index:60',
      'pointer-events:none',
      'font-size:24px',
      'font-weight:1000',
      `color:${type === 'bad' ? '#fca5a5' : type === 'gold' ? '#fde68a' : '#86efac'}`,
      'text-shadow:0 10px 28px rgba(0,0,0,.42)',
      'animation:gjFxFloat .7s ease-out forwards'
    ].join(';');

    ensureFxStyle();
    layer.appendChild(n);
    setTimeout(() => n.remove(), 760);
  }

  function ensureFxStyle(){
    if(DOC.getElementById('gj-solo-runtime-style')) return;
    const style = DOC.createElement('style');
    style.id = 'gj-solo-runtime-style';
    style.textContent = `
      @keyframes gjFxFloat{
        from{ opacity:1; transform:translate(-50%,-50%) translateY(0) scale(1); }
        to{ opacity:0; transform:translate(-50%,-50%) translateY(-36px) scale(1.12); }
      }
      .gjSoloShake{ animation:gjSoloShake .24s linear 1; }
      @keyframes gjSoloShake{
        0%,100%{ transform:translateX(0); }
        25%{ transform:translateX(-7px); }
        50%{ transform:translateX(7px); }
        75%{ transform:translateX(-4px); }
      }
      .gjTargetPop{ animation:gjTargetPop .18s ease-out 1; }
      @keyframes gjTargetPop{
        from{ transform:translate(-50%,-50%) scale(.6); opacity:.2; }
        to{ transform:translate(-50%,-50%) scale(1); opacity:1; }
      }
      .gjBossShieldPulse{ animation:gjBossShieldPulse .7s ease-in-out 1; }
      @keyframes gjBossShieldPulse{
        0%{ filter:drop-shadow(0 0 0 rgba(96,165,250,0)); }
        50%{ filter:drop-shadow(0 0 28px rgba(96,165,250,.75)); }
        100%{ filter:drop-shadow(0 0 0 rgba(96,165,250,0)); }
      }
      @keyframes gjWarningBlink{
        0%,100%{ opacity:0; }
        30%,70%{ opacity:1; }
      }
      @keyframes gjHeroCutIn{
        0%{ transform:translateX(-110%); opacity:0; }
        18%{ opacity:1; }
        72%{ transform:translateX(0%); opacity:1; }
        100%{ transform:translateX(110%); opacity:0; }
      }
      @keyframes gjDangerPulse{
        from{ opacity:.35; }
        to{ opacity:.95; }
      }
      .gjHeroReadyPulse{
        animation:gjHeroReadyPulse .55s ease-in-out infinite alternate;
      }
      @keyframes gjHeroReadyPulse{
        from{ filter:drop-shadow(0 0 0 rgba(34,197,94,0)); transform:scale(1); }
        to{ filter:drop-shadow(0 0 18px rgba(34,197,94,.85)); transform:scale(1.08); }
      }
      @keyframes gjCinematicInOut{
        0%{ opacity:0; transform:scale(1.04); }
        16%{ opacity:1; transform:scale(1); }
        78%{ opacity:1; transform:scale(1); }
        100%{ opacity:0; transform:scale(1.08); }
      }
      @keyframes gjCinematicCard{
        0%{ transform:scale(.72) rotate(-2deg); opacity:0; }
        22%{ transform:scale(1.08) rotate(1deg); opacity:1; }
        60%{ transform:scale(1) rotate(0deg); opacity:1; }
        100%{ transform:scale(.92) rotate(0deg); opacity:0; }
      }
      @keyframes gjBigDamage{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.6) rotate(-2deg); }
        20%{ opacity:1; transform:translate(-50%,-50%) scale(1.18) rotate(1deg); }
        100%{ opacity:0; transform:translate(-50%,-92%) scale(.96) rotate(0deg); }
      }
      .gjTintShield #gameWorld{
        box-shadow:inset 0 0 120px rgba(96,165,250,.22);
      }
      .gjTintStorm #gameWorld{
        box-shadow:inset 0 0 130px rgba(14,165,233,.24);
      }
      .gjTintRage #gameWorld{
        box-shadow:inset 0 0 140px rgba(239,68,68,.24);
      }
      .gjTintFinal #gameWorld{
        box-shadow:inset 0 0 160px rgba(250,204,21,.28);
      }
      .gjPowerTarget{
        animation:gjPowerPulse .72s ease-in-out infinite alternate;
      }
      @keyframes gjPowerPulse{
        from{ filter:brightness(1) saturate(1); transform:translate(-50%,-50%) scale(1); }
        to{ filter:brightness(1.22) saturate(1.18); transform:translate(-50%,-50%) scale(1.08); }
      }
      #gjMobileHud{
        position:absolute;
        left:calc(10px + env(safe-area-inset-left,0px));
        right:calc(10px + env(safe-area-inset-right,0px));
        top:calc(8px + env(safe-area-inset-top,0px));
        z-index:55;
        pointer-events:none;
        display:grid;
        gap:8px;
      }
      .gjMobileTopRow{
        display:flex;
        gap:7px;
        align-items:center;
        justify-content:center;
      }
      .gjMobilePill{
        min-width:76px;
        min-height:34px;
        padding:6px 9px;
        border-radius:999px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:5px;
        background:rgba(15,23,42,.78);
        border:1px solid rgba(148,163,184,.20);
        color:#f8fafc;
        font-weight:1000;
        box-shadow:0 10px 26px rgba(0,0,0,.28);
        backdrop-filter:blur(8px);
      }
      .gjMobilePill b{
        font-size:14px;
      }
      .gjBossBarWrap{
        width:min(520px,92vw);
        justify-self:center;
        padding:8px 10px 9px;
        border-radius:16px;
        background:rgba(15,23,42,.78);
        border:1px solid rgba(148,163,184,.20);
        box-shadow:0 12px 30px rgba(0,0,0,.28);
        backdrop-filter:blur(8px);
      }
      .gjBossBarTop{
        display:flex;
        align-items:center;
        justify-content:space-between;
        color:#e5e7eb;
        font-size:12px;
        font-weight:1000;
        margin-bottom:6px;
      }
      .gjBossBar{
        height:11px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(2,6,23,.72);
        border:1px solid rgba(148,163,184,.16);
      }
      .gjBossFill{
        height:100%;
        width:100%;
        border-radius:999px;
        background:linear-gradient(90deg,#22c55e,#facc15,#ef4444);
        transition:width .18s ease;
      }
      #gjHeroHitBigBtn{
        position:absolute;
        right:calc(12px + env(safe-area-inset-right,0px));
        bottom:calc(74px + env(safe-area-inset-bottom,0px));
        z-index:75;
        width:116px;
        height:116px;
        border-radius:34px;
        border:3px solid rgba(250,204,21,.78);
        background:
          radial-gradient(circle at 35% 20%,rgba(255,255,255,.45),transparent 32%),
          linear-gradient(180deg,#fde68a,#facc15 50%,#f59e0b);
        color:#422006;
        box-shadow:
          0 0 0 6px rgba(250,204,21,.12),
          0 22px 48px rgba(0,0,0,.38);
        display:grid;
        grid-template-rows:auto auto auto;
        place-items:center;
        gap:1px;
        cursor:pointer;
        font-weight:1000;
        touch-action:manipulation;
        transform:translateZ(0);
      }
      #gjHeroHitBigBtn:active{
        transform:scale(.96);
      }
      #gjHeroHitBigBtn.not-ready{
        opacity:.72;
        filter:saturate(.72);
        border-color:rgba(148,163,184,.38);
        background:
          radial-gradient(circle at 35% 20%,rgba(255,255,255,.22),transparent 32%),
          linear-gradient(180deg,#94a3b8,#64748b);
        color:#f8fafc;
      }
      #gjHeroHitBigBtn.ready{
        animation:gjHeroButtonReady .48s ease-in-out infinite alternate;
      }
      .gjHeroHitIcon{
        font-size:34px;
        line-height:1;
      }
      .gjHeroHitText{
        font-size:13px;
        line-height:1;
        letter-spacing:-.02em;
      }
      .gjHeroHitPct{
        font-size:20px;
        line-height:1;
      }
      @keyframes gjHeroButtonReady{
        from{
          transform:scale(1);
          box-shadow:
            0 0 0 6px rgba(250,204,21,.12),
            0 22px 48px rgba(0,0,0,.38),
            0 0 18px rgba(250,204,21,.38);
        }
        to{
          transform:scale(1.07);
          box-shadow:
            0 0 0 9px rgba(250,204,21,.20),
            0 26px 54px rgba(0,0,0,.42),
            0 0 36px rgba(250,204,21,.75);
        }
      }
      @keyframes gjHeroDenied{
        0%,100%{ transform:translateX(0) scale(1); }
        25%{ transform:translateX(-6px) scale(.98); }
        50%{ transform:translateX(6px) scale(.98); }
        75%{ transform:translateX(-3px) scale(.99); }
      }
      #gjDangerMeter{
        position:absolute;
        left:calc(12px + env(safe-area-inset-left,0px));
        bottom:calc(86px + env(safe-area-inset-bottom,0px));
        z-index:74;
        width:min(210px,44vw);
        padding:8px 10px 9px;
        border-radius:16px;
        background:rgba(15,23,42,.78);
        border:1px solid rgba(148,163,184,.20);
        box-shadow:0 16px 34px rgba(0,0,0,.30);
        backdrop-filter:blur(8px);
        pointer-events:none;
      }
      .gjDangerLabel{
        color:#fecaca;
        font-size:11px;
        font-weight:1000;
        letter-spacing:.08em;
        margin-bottom:5px;
      }
      .gjDangerTrack{
        height:10px;
        border-radius:999px;
        background:rgba(2,6,23,.70);
        overflow:hidden;
        border:1px solid rgba(148,163,184,.16);
      }
      .gjDangerFill{
        width:0%;
        height:100%;
        border-radius:999px;
        background:linear-gradient(90deg,#22c55e,#facc15,#ef4444);
        transition:width .18s ease;
      }
      #gjFeedbackControls{
        position:absolute;
        left:calc(12px + env(safe-area-inset-left,0px));
        top:calc(74px + env(safe-area-inset-top,0px));
        z-index:82;
        display:flex;
        gap:7px;
      }
      #gjFeedbackControls button{
        width:38px;
        height:38px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.22);
        background:rgba(15,23,42,.76);
        color:#f8fafc;
        box-shadow:0 12px 28px rgba(0,0,0,.26);
        backdrop-filter:blur(8px);
        font-size:17px;
        cursor:pointer;
        touch-action:manipulation;
      }
      @media (max-width:720px){
        .gjHud{
          display:none !important;
        }
        #gjMobileHud{
          display:grid;
        }
        #gjHeroHitBigBtn{
          width:104px;
          height:104px;
          border-radius:30px;
          bottom:calc(70px + env(safe-area-inset-bottom,0px));
        }
        .gjHeroHitIcon{
          font-size:30px;
        }
        .gjHeroHitPct{
          font-size:18px;
        }
        #gjDangerMeter{
          width:min(188px,46vw);
          bottom:calc(82px + env(safe-area-inset-bottom,0px));
        }
        #gjFeedbackControls{
          top:calc(122px + env(safe-area-inset-top,0px));
        }
      }
      @media (min-width:721px){
        #gjMobileHud{
          display:none;
        }
      }
    `;
    DOC.head.appendChild(style);
  }

  function shake(){
    const node = el.gameWorld || el.app;
    if(!node) return;
    node.classList.remove('gjSoloShake');
    void node.offsetWidth;
    node.classList.add('gjSoloShake');
  }

  function pulseBossShield(){
    if(!el.bossAvatar) return;
    el.bossAvatar.classList.remove('gjBossShieldPulse');
    void el.bossAvatar.offsetWidth;
    el.bossAvatar.classList.add('gjBossShieldPulse');
  }

  function removeTarget(id){
    const item = state.targets.get(id);
    if(!item) return;
    state.targets.delete(id);
    try{ item.node.remove(); }catch(_){}
  }

  function clearTargets(){
    Array.from(state.targets.keys()).forEach(removeTarget);
  }

  function todayIndex(){
    try{
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone:'Asia/Bangkok',
        year:'numeric',
        month:'2-digit',
        day:'2-digit'
      }).formatToParts(new Date());

      const m = {};
      parts.forEach(p => {
        if(p.type !== 'literal') m[p.type] = p.value;
      });

      return Number(`${m.year}${m.month}${m.day}`) || Date.now();
    }catch(_){
      return Math.floor(Date.now() / 86400000);
    }
  }

  function setupDailyChallenge(){
    const idx = todayIndex() % DAILY_CHALLENGES.length;
    state.dailyChallenge = DAILY_CHALLENGES[idx];
    state.dailyProgress = 0;
    state.dailyFailed = false;
  }

  function calcAccuracy(){
    const total = state.good + state.junkHit + state.missedGood;
    if(total <= 0) return 100;
    return Math.round((state.good / total) * 100);
  }

  function calcStars(){
    const acc = calcAccuracy();
    if(state.bossHp <= 0 && acc >= 88 && state.miss <= 3 && state.bestCombo >= 16) return '⭐⭐⭐';
    if(state.bossHp <= 0 && acc >= 70) return '⭐⭐';
    if(state.bossHp <= 0) return '⭐';
    if(state.score >= 180) return '⭐';
    return '☆';
  }

  function bossSay(group, ms = 1600){
    const arr = BOSS_SPEECH[group] || [];
    if(!arr.length) return;

    const line = arr[Math.floor(rand() * arr.length)];
    state.bossSpeechLast = line;

    toast(`👑 ${line}`, ms);

    if(el.announcer){
      el.announcer.textContent = line;
      el.announcer.style.display = 'block';
    }
  }

  function currentWeakness(){
    if(state.finalRush || state.phase >= 3) return BOSS_IDENTITY.weakness.phase3;
    if(state.phase >= 2) return BOSS_IDENTITY.weakness.phase2;
    return BOSS_IDENTITY.weakness.phase1;
  }

  function bossBookTip(){
    const w = currentWeakness();
    const skill = BOSS_IDENTITY.skills.find(s => s.id === state.lastBossSkillId);

    if(skill){
      return `${skill.name}: จุดอ่อนคือ ${w.label}`;
    }

    return `จุดอ่อนบอส: ${w.label}`;
  }

  function bossBookSummaryTip(){
    const w = currentWeakness();
    const skill = BOSS_IDENTITY.skills.find(s => s.id === state.lastBossSkillId);

    if(skill){
      return `Boss Book: บอสใช้ ${skill.name} รอบนี้ควรเก็บ “${w.label}” เพราะ ${w.tip}`;
    }

    return `Boss Book: บอสแพ้ “${w.label}” เพราะ ${w.tip}`;
  }

  function starGoalIntro(){
    const daily = state.dailyChallenge;
    return [
      '⭐ เป้าหมาย 3 ดาว: ชนะบอส + พลาดไม่เกิน 3 + Combo x16',
      `🎯 Weakness: ${currentWeakness().label}`,
      daily ? `${daily.icon} ${daily.title}` : ''
    ].filter(Boolean);
  }

  function isWeaknessData(data){
    const w = currentWeakness();
    return !!data && w.icons.includes(data.emoji);
  }

  function isWeaknessFood(item){
    return !!item && !!item.data && isWeaknessData(item.data);
  }

  function updateWeaknessMission(item){
    const w = currentWeakness();
    state.weaknessMission.label = w.label;
    state.weaknessMission.tip = w.tip;

    if(item && isWeaknessFood(item)){
      state.weaknessMission.hits++;
      state.score += 5;
      fx(item.x, item.y, 'WEAK!', 'gold');

      if(state.weaknessMission.hits >= state.weaknessMission.target){
        state.bossHp = clamp(state.bossHp - 32, 0, state.bossMaxHp);
        state.weaknessMission.hits = 0;
        state.weaknessMission.target = Math.min(10, state.weaknessMission.target + 1);
        toast(`🎯 จุดอ่อนบอสแตก! ${w.label} ได้ผลมาก!`, 1500);
        shake();
      }
    }
  }

  function updateFoodGroups(item){
    const e = item && item.data ? item.data.emoji : '';

    if(['🥦','🥬','🥕'].includes(e)) state.greenHits++;
    if(['🐟','🥚','🫘','🥛'].includes(e)) state.proteinHits++;
    if(['🍎','🍉'].includes(e)) state.fruitHits++;
  }

  function updateDailyChallengeOnGood(item){
    const dc = state.dailyChallenge;
    if(!dc || state.dailyFailed) return;

    if(dc.rule === 'collect_group' && item.data.group === dc.value){
      state.dailyProgress++;
      if(state.dailyProgress === dc.target){
        toast(`🏅 Daily สำเร็จ! ${dc.reward}`, 1600);
        state.score += 35;
      }
    }

    if(dc.rule === 'combo' && state.combo >= dc.target && state.dailyProgress < dc.target){
      state.dailyProgress = dc.target;
      toast(`🏅 Daily สำเร็จ! ${dc.reward}`, 1600);
      state.score += 35;
    }
  }

  function updateDailyChallengeOnJunk(item){
    const dc = state.dailyChallenge;
    if(!dc || state.dailyFailed) return;

    if(dc.rule === 'avoid_emoji' && item.data.emoji === dc.value){
      state.dailyFailed = true;
      toast('Daily Challenge พลาดแล้ว แต่ยังชนะบอสได้!', 1500);
    }
  }

  function checkComboSkills(){
    if(state.combo >= 5 && !state.comboSkillUsed.x5){
      state.comboSkillUsed.x5 = true;
      state.heroHit = clamp(state.heroHit + 15, 0, 100);
      toast('⚡ Combo Skill x5: HERO charge +15!', 1200);
      fx(worldRect().width / 2, 160, 'COMBO x5', 'gold');
    }

    if(state.combo >= 10 && !state.comboSkillUsed.x10){
      state.comboSkillUsed.x10 = true;
      state.bossHp = clamp(state.bossHp - 28, 0, state.bossMaxHp);
      toast('🔥 Combo Skill x10: Boss damage!', 1200);
      shake();
      fx(worldRect().width / 2, 190, 'COMBO x10', 'gold');
    }

    if(state.combo >= 15 && !state.comboSkillUsed.x15){
      state.comboSkillUsed.x15 = true;
      clearJunkTargets();
      state.lives = clamp(state.lives + 1, 0, tune.lives);
      toast('🌟 Combo Skill x15: ล้างขยะ + ฟื้นหัวใจ!', 1400);
      fx(worldRect().width / 2, 220, 'COMBO x15', 'gold');
    }
  }

  function clearJunkTargets(){
    for(const [id, item] of Array.from(state.targets.entries())){
      if(item.kind === 'junk'){
        removeTarget(id);
      }
    }
  }

  function maybeComebackAssist(){
    if(state.comebackTriggered) return;
    if(state.lives > 1) return;
    if(state.elapsedSec < 25) return;

    state.comebackTriggered = true;
    state.lives = Math.min(tune.lives, state.lives + 1);
    state.heroHit = clamp(state.heroHit + 40, 0, 100);
    clearJunkTargets();
    toast('💪 Comeback Assist! ได้หัวใจ + HERO charge', 1600);
    fx(worldRect().width / 2, worldRect().height / 2, 'COMEBACK!', 'gold');
  }

  function setDangerLane(active){
    state.dangerLaneActive = !!active;

    if(active){
      const r = worldRect();
      state.dangerLaneX = clamp(60 + rand() * (r.width - 120), 60, r.width - 60);
      drawDangerLane();
    }else{
      const old = DOC.getElementById('gjDangerLane');
      if(old) old.remove();
    }
  }

  function drawDangerLane(){
    const parent = el.gameWorld || el.app;
    if(!parent) return;

    let lane = DOC.getElementById('gjDangerLane');
    if(!lane){
      lane = DOC.createElement('div');
      lane.id = 'gjDangerLane';
      lane.style.cssText = [
        'position:absolute',
        'top:0',
        'bottom:0',
        'width:74px',
        'z-index:8',
        'pointer-events:none',
        'background:linear-gradient(90deg,transparent,rgba(239,68,68,.22),transparent)',
        'border-left:2px dashed rgba(248,113,113,.55)',
        'border-right:2px dashed rgba(248,113,113,.55)',
        'animation:gjDangerPulse .6s ease-in-out infinite alternate'
      ].join(';');
      parent.appendChild(lane);
    }

    lane.style.left = `${state.dangerLaneX - 37}px`;
  }

  function warningFlash(text = 'ระวัง!'){
    state.warningActive = true;

    let w = DOC.getElementById('gjWarningFlash');
    if(!w){
      w = DOC.createElement('div');
      w.id = 'gjWarningFlash';
      w.style.cssText = [
        'position:absolute',
        'inset:0',
        'z-index:70',
        'pointer-events:none',
        'display:grid',
        'place-items:center',
        'background:rgba(239,68,68,.16)',
        'color:#fff',
        'font-size:clamp(30px,8vw,72px)',
        'font-weight:1000',
        'text-shadow:0 16px 40px rgba(0,0,0,.55)',
        'animation:gjWarningBlink .42s ease-in-out 3',
        'text-align:center',
        'padding:18px'
      ].join(';');
      (el.app || DOC.body).appendChild(w);
    }

    w.textContent = text;
    w.style.display = 'grid';
    w.style.animation = 'none';
    void w.offsetWidth;
    w.style.animation = 'gjWarningBlink .42s ease-in-out 3';

    setTimeout(() => {
      w.style.display = 'none';
      state.warningActive = false;
    }, 1300);
  }

  function heroCutIn(text = 'HERO HIT READY!'){
    let cut = DOC.getElementById('gjHeroCutIn');
    if(!cut){
      cut = DOC.createElement('div');
      cut.id = 'gjHeroCutIn';
      cut.style.cssText = [
        'position:absolute',
        'left:0',
        'right:0',
        'top:36%',
        'z-index:90',
        'pointer-events:none',
        'padding:18px',
        'background:linear-gradient(90deg,rgba(34,197,94,.0),rgba(34,197,94,.92),rgba(34,197,94,0))',
        'color:#052e16',
        'font-size:clamp(28px,7vw,64px)',
        'font-weight:1000',
        'text-align:center',
        'text-shadow:0 2px 0 rgba(255,255,255,.28)',
        'transform:translateX(-110%)',
        'animation:gjHeroCutIn .92s cubic-bezier(.2,.9,.2,1) forwards'
      ].join(';');
      (el.app || DOC.body).appendChild(cut);
    }

    cut.textContent = `🦸 ${text}`;
    cut.style.animation = 'none';
    void cut.offsetWidth;
    cut.style.animation = 'gjHeroCutIn .92s cubic-bezier(.2,.9,.2,1) forwards';

    setTimeout(() => {
      try{ cut.remove(); }catch(_){}
    }, 1100);
  }

  function cinematicOverlay(key){
    const data = PHASE_CINEMATIC[key];
    if(!data) return;

    let overlay = DOC.getElementById('gjCinematicOverlay');

    if(!overlay){
      overlay = DOC.createElement('div');
      overlay.id = 'gjCinematicOverlay';
      overlay.style.cssText = [
        'position:absolute',
        'inset:0',
        'z-index:120',
        'display:grid',
        'place-items:center',
        'pointer-events:none',
        'background:radial-gradient(circle at 50% 50%,rgba(250,204,21,.22),rgba(2,6,23,.58) 45%,rgba(2,6,23,.72))',
        'color:#fff',
        'text-align:center',
        'padding:18px',
        'opacity:0',
        'animation:gjCinematicInOut 1.55s ease-in-out forwards'
      ].join(';');

      (el.app || DOC.body).appendChild(overlay);
    }

    overlay.innerHTML = `
      <div style="
        transform:scale(.9);
        animation:gjCinematicCard 1.55s ease-in-out forwards;
      ">
        <div style="font-size:clamp(58px,16vw,132px);line-height:1">${data.emoji}</div>
        <div style="
          margin-top:8px;
          font-size:clamp(34px,10vw,86px);
          line-height:.95;
          font-weight:1000;
          letter-spacing:-.06em;
          text-shadow:0 18px 54px rgba(0,0,0,.55);
        ">${data.title}</div>
        <div style="
          margin-top:10px;
          font-size:clamp(17px,4vw,30px);
          font-weight:1000;
          color:#fde68a;
          text-shadow:0 12px 32px rgba(0,0,0,.55);
        ">${data.sub}</div>
      </div>
    `;

    overlay.style.animation = 'none';
    void overlay.offsetWidth;
    overlay.style.animation = 'gjCinematicInOut 1.55s ease-in-out forwards';

    state.cinematicLock = true;

    setTimeout(() => {
      state.cinematicLock = false;
      try{ overlay.remove(); }catch(_){}
    }, 1600);
  }

  function showPhaseCinematic(key){
    if(state.phaseCinematicShown[key]) return;
    state.phaseCinematicShown[key] = true;
    cinematicOverlay(key);
  }

  function screenTint(kind = 'normal'){
    const app = el.app || DOC.body;
    if(!app) return;

    app.classList.remove('gjTintShield','gjTintStorm','gjTintRage','gjTintFinal');

    if(kind === 'shield') app.classList.add('gjTintShield');
    if(kind === 'storm') app.classList.add('gjTintStorm');
    if(kind === 'rage') app.classList.add('gjTintRage');
    if(kind === 'final') app.classList.add('gjTintFinal');
  }

  function bigDamageText(amount, label = 'DMG'){
    const r = worldRect();
    fx(r.width / 2, Math.max(130, r.height * 0.34), `${label} -${amount}`, 'gold');

    let dmg = DOC.getElementById('gjBigDamage');
    if(!dmg){
      dmg = DOC.createElement('div');
      dmg.id = 'gjBigDamage';
      dmg.style.cssText = [
        'position:absolute',
        'left:50%',
        'top:28%',
        'z-index:88',
        'transform:translate(-50%,-50%)',
        'pointer-events:none',
        'font-size:clamp(34px,10vw,86px)',
        'font-weight:1000',
        'color:#fde68a',
        'text-shadow:0 18px 52px rgba(0,0,0,.62)',
        'animation:gjBigDamage .72s ease-out forwards'
      ].join(';');
      (el.app || DOC.body).appendChild(dmg);
    }

    dmg.textContent = `${label} -${amount}`;
    dmg.style.animation = 'none';
    void dmg.offsetWidth;
    dmg.style.animation = 'gjBigDamage .72s ease-out forwards';

    setTimeout(() => {
      try{ dmg.remove(); }catch(_){}
    }, 760);
  }

  function finishMove(){
    if(state.finishMoveUsed) return;
    state.finishMoveUsed = true;

    clearTargets();
    warningFlash('FINISH MOVE!');
    heroCutIn('HEALTHY FINISH!');
    feedback('hero');

    setTimeout(() => {
      bossSay('defeated', 1400);
      shake();
    }, 600);

    setTimeout(() => {
      endGame(true);
    }, 1650);
  }

  function getBadges(summary){
    return RESULT_BADGES
      .filter(b => {
        try{ return b.test(summary); }catch(_){ return false; }
      })
      .map(b => `${b.icon} ${b.title}`);
  }

  function kidLevel(){
    const acc = calcAccuracy();

    if(state.bossHp <= 0 && acc >= 85 && state.miss <= 3){
      return {
        icon: '🌟',
        title: 'ยอดเยี่ยมมาก!',
        good: 'เลือกอาหารดีได้แม่น และรับมือบอสได้ดีมาก',
        caution: 'ครั้งหน้าลองรักษา Combo ให้ยาวขึ้นอีกนิด',
        next: 'ลองเล่นระดับ hard หรือทำ Daily Challenge ให้สำเร็จ'
      };
    }

    if(state.bossHp <= 0){
      return {
        icon: '🎉',
        title: 'ชนะบอสแล้ว!',
        good: 'แยกอาหารดีและอาหารขยะได้ดีขึ้น',
        caution: 'ยังมีบางจังหวะที่แตะอาหารขยะหรือปล่อยอาหารดีหลุด',
        next: 'รอบหน้าลองดู Weakness ของบอสก่อนแตะ'
      };
    }

    if(state.good >= 18){
      return {
        icon: '💪',
        title: 'เกือบชนะแล้ว!',
        good: 'เก็บอาหารดีได้หลายครั้ง แปลว่าเริ่มเข้าใจแล้ว',
        caution: 'ช่วง Junk Storm ต้องใจเย็นและอย่ารีบแตะ',
        next: 'รอบหน้าลองเก็บ HERO HIT ให้เต็มก่อนบอสคลั่ง'
      };
    }

    return {
      icon: '🙂',
      title: 'ลองใหม่ได้!',
      good: 'เริ่มฝึกแยกอาหารดีและอาหารขยะแล้ว',
      caution: 'ให้มองเป้าหมายก่อนแตะ อย่าแตะเร็วเกินไป',
      next: 'จำง่าย ๆ: ผัก ผลไม้ โปรตีนดี ช่วยให้ Hero แข็งแรง'
    };
  }

  function shortBadgeText(badges){
    if(!Array.isArray(badges) || !badges.length) return 'ยังไม่ได้ Badge รอบนี้';
    return badges.slice(0, 3).join(' • ');
  }

  function dailySummaryText(summary){
    if(!summary.dailyChallengeTitle) return 'ไม่มี Daily Challenge ในรอบนี้';

    if(summary.dailyReward){
      return `สำเร็จ: ${summary.dailyReward}`;
    }

    if(summary.dailyFailed){
      return 'พลาดแล้ว ลองใหม่พรุ่งนี้นะ';
    }

    return 'ยังไม่สำเร็จ แต่เล่นต่อได้ดีมาก';
  }

  function learningTipForSummary(summary){
    const miss = Number(summary.miss || 0);
    const acc = Number(summary.accPct || 0);

    if(miss <= 2 && acc >= 80){
      return 'วันนี้ทำได้ดีมาก เพราะแตะอาหารดีมากกว่าอาหารขยะ';
    }

    if(summary.junkHit >= summary.missedGood){
      return 'จุดที่ต้องระวังคืออาหารขยะ เช่น น้ำอัดลม ของทอด และของหวาน';
    }

    if(summary.missedGood > 0){
      return 'จุดที่ต้องฝึกคืออย่าปล่อยอาหารดีหลุด เพราะอาหารดีช่วยชาร์จ HERO HIT';
    }

    return 'ดู Boss Book และ Weakness ก่อน จะช่วยให้ชนะง่ายขึ้น';
  }

  function renderKidSummary(summary){
    const level = kidLevel();
    const badges = shortBadgeText(summary.resultBadges);
    const daily = dailySummaryText(summary);
    const learn = learningTipForSummary(summary);

    return `
${level.icon} ${level.title}

✅ ทำได้ดี:
${level.good}

⚠️ ระวัง:
${level.caution}

🏅 Badge:
${badges}

🎯 Daily:
${daily}

💡 บทเรียน:
${learn}

➡️ ครั้งหน้า:
${level.next}
    `.trim();
  }

  function starTip(win){
    const level = kidLevel();

    if(win){
      return `${level.icon} ${level.title} ${level.good}`;
    }

    return `${level.icon} ${level.title} ${level.next}`;
  }

  function microTip(kind, item){
    const t = Date.now();
    if(t - state.lastMicroTipAt < 6500) return;
    if(state.microTipsShown >= 5) return;
    if(state.finalRush && state.timeLeft < 20) return;

    let msg = '';

    if(kind === 'good'){
      if(item?.data?.group === 'green') msg = '🥦 ผักช่วยให้ร่างกายแข็งแรงและมีใยอาหาร';
      else if(item?.data?.group === 'protein') msg = '🐟 โปรตีนช่วยซ่อมแซมร่างกายและสร้างกล้ามเนื้อ';
      else if(item?.data?.group === 'fruit') msg = '🍎 ผลไม้มีวิตามินและช่วยให้สดชื่น';
      else msg = '✅ อาหารดีช่วยเพิ่มพลังให้ Hero';
    }

    if(kind === 'junk'){
      if(item?.data?.group === 'soda') msg = '🥤 น้ำอัดลมมีน้ำตาลสูง ควรดื่มน้อยลง';
      else if(item?.data?.group === 'fried') msg = '🍟 ของทอดกินบ่อยเกินไปไม่ดีต่อสุขภาพ';
      else if(item?.data?.group === 'sweet') msg = '🍩 ของหวานกินได้บ้าง แต่ไม่ควรกินเยอะ';
      else msg = '⚠️ อาหารขยะทำให้พลัง Hero ลดลง';
    }

    if(!msg) return;

    state.lastMicroTipAt = t;
    state.microTipsShown++;
    toast(msg, 1900);
  }

  function ensureMobileHud(){
    const app = el.app || DOC.body;
    if(!app) return;

    let hud = DOC.getElementById('gjMobileHud');
    if(!hud){
      hud = DOC.createElement('div');
      hud.id = 'gjMobileHud';
      hud.innerHTML = `
        <div class="gjMobileTopRow">
          <div class="gjMobilePill">
            <span>⏱️</span>
            <b id="gjMobileTime">0</b>
          </div>
          <div class="gjMobilePill">
            <span>⭐</span>
            <b id="gjMobileScore">0</b>
          </div>
          <div class="gjMobilePill">
            <span>❤️</span>
            <b id="gjMobileLives">0</b>
          </div>
        </div>

        <div class="gjBossBarWrap">
          <div class="gjBossBarTop">
            <span id="gjMobilePhase">SHIELD</span>
            <span id="gjMobileBossPct">100%</span>
          </div>
          <div class="gjBossBar">
            <div id="gjMobileBossFill" class="gjBossFill"></div>
          </div>
        </div>
      `;
      app.appendChild(hud);
    }

    let hero = DOC.getElementById('gjHeroHitBigBtn');
    if(!hero){
      hero = DOC.createElement('button');
      hero.id = 'gjHeroHitBigBtn';
      hero.type = 'button';
      hero.innerHTML = `
        <span class="gjHeroHitIcon">🦸</span>
        <span class="gjHeroHitText">HERO HIT</span>
        <span class="gjHeroHitPct" id="gjHeroHitBigPct">0%</span>
      `;
      hero.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        useHeroHit();
      }, { passive:false });
      app.appendChild(hero);
    }

    let danger = DOC.getElementById('gjDangerMeter');
    if(!danger){
      danger = DOC.createElement('div');
      danger.id = 'gjDangerMeter';
      danger.innerHTML = `
        <div class="gjDangerLabel">DANGER</div>
        <div class="gjDangerTrack">
          <div id="gjDangerFill" class="gjDangerFill"></div>
        </div>
      `;
      app.appendChild(danger);
    }
  }

  function ensureFeedbackControls(){
    const app = el.app || DOC.body;
    if(!app) return;

    let wrap = DOC.getElementById('gjFeedbackControls');
    if(wrap) return;

    wrap = DOC.createElement('div');
    wrap.id = 'gjFeedbackControls';
    wrap.innerHTML = `
      <button id="gjSfxToggle" type="button" aria-label="toggle sound">🔊</button>
      <button id="gjVibeToggle" type="button" aria-label="toggle vibration">📳</button>
    `;
    app.appendChild(wrap);

    const sfxBtn = DOC.getElementById('gjSfxToggle');
    const vibeBtn = DOC.getElementById('gjVibeToggle');

    sfxBtn?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      state.sfxEnabled = !state.sfxEnabled;
      sfxBtn.textContent = state.sfxEnabled ? '🔊' : '🔇';
      if(state.sfxEnabled) beep('power');
    });

    vibeBtn?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      state.vibrateEnabled = !state.vibrateEnabled;
      vibeBtn.textContent = state.vibrateEnabled ? '📳' : '🚫';
      if(state.vibrateEnabled) vibe(25);
    });
  }

  function updateHud(){
    state.elapsedSec = state.startTs ? Math.max(0, Math.round((Date.now() - state.startTs) / 1000)) : 0;

    setText(el.scoreText, state.score);
    setText(el.timerText, Math.max(0, Math.ceil(state.timeLeft)));
    setText(el.lifeText, '❤️'.repeat(Math.max(0, state.lives)) || '0');

    const phaseLabel =
      state.finalRush ? 'FINAL' :
      state.phase === 3 ? 'RAGE' :
      state.phase === 2 ? 'STORM' :
      state.bossShield ? 'SHIELD' :
      'HUNT';

    setText(el.phaseText, phaseLabel);
    setText(el.bossHpText, `${Math.max(0, Math.ceil((state.bossHp / state.bossMaxHp) * 100))}%`);
    setText(el.heroHitText, `${Math.round(state.heroHit)}%`);
    setText(el.comboText, state.combo);
    setText(el.goodText, state.good);
    setText(el.missText, state.miss);
    setText(el.rageText, state.rage);

    if(el.bossHpFill){
      el.bossHpFill.style.width = `${clamp((state.bossHp / state.bossMaxHp) * 100, 0, 100)}%`;
    }

    if(el.heroHitFill){
      el.heroHitFill.style.width = `${clamp(state.heroHit, 0, 100)}%`;
    }

    if(el.heroHitText){
      if(state.heroHit >= 100){
        el.heroHitText.classList.add('gjHeroReadyPulse');

        if(!state.heroHitReadyAnnounced){
          state.heroHitReadyAnnounced = true;
          heroCutIn('HERO HIT READY!');
          toast('⚡ HERO HIT พร้อมแล้ว! กดใช้ให้ถูกจังหวะ', 1500);
        }
      }else{
        el.heroHitText.classList.remove('gjHeroReadyPulse');
        state.heroHitReadyAnnounced = false;
      }
    }

    if(el.coachText){
      el.coachText.textContent = bossBookTip();
    }

    if(el.goalText){
      let msg = 'Phase 1: Food Hunt — เก็บอาหารดีเพื่อทำลายโล่บอส 🛡️';

      if(!state.bossShield && state.phase === 1){
        msg = 'โล่บอสแตกแล้ว! เก็บอาหารดีต่อเนื่องเพื่อเปิด Phase 2 ⚡';
      }

      if(state.phase === 2){
        msg = 'Phase 2: Junk Storm — เก็บอาหารดี แต่ระวังขยะที่บอสปล่อยมา 🌪️';
      }

      if(state.phase === 3 && !state.finalRush){
        msg = 'Phase 3: Boss Rage — บอสโกรธแล้ว! ใช้ HERO HIT ให้ถูกจังหวะ 😡';
      }

      if(state.finalRush){
        msg = `🔥 FINAL RUSH! เอาตัวรอดและปิดฉากบอส หลังเล่นครบ ${tune.minWinSec}s`;
      }

      const daily = state.dailyChallenge
        ? ` • Daily: ${state.dailyChallenge.title}${state.dailyFailed ? ' (พลาดแล้ว)' : ''}`
        : '';

      el.goalText.textContent = `${msg} • ${bossBookTip()}${daily}`;
    }

    if(el.bossAvatar){
      if(state.bossShield){
        el.bossAvatar.textContent = '🛡️👑🍔';
      }else if(state.finalRush){
        el.bossAvatar.textContent = '🔥👑🍔';
      }else if(state.phase >= 3){
        el.bossAvatar.textContent = '😡🍔';
      }else if(state.phase >= 2){
        el.bossAvatar.textContent = '🌪️🍔';
      }else{
        el.bossAvatar.textContent = '👑🍔';
      }
    }

    ensureMobileHud();
    ensureFeedbackControls();

    const bossPct = clamp((state.bossHp / state.bossMaxHp) * 100, 0, 100);
    const heroPct = clamp(state.heroHit, 0, 100);

    setText($('gjMobileTime'), Math.max(0, Math.ceil(state.timeLeft)));
    setText($('gjMobileScore'), state.score);
    setText($('gjMobileLives'), Math.max(0, state.lives));
    setText($('gjMobilePhase'), state.finalRush ? 'FINAL RUSH' : phaseLabel);
    setText($('gjMobileBossPct'), `${Math.ceil(bossPct)}%`);

    const mbFill = $('gjMobileBossFill');
    if(mbFill) mbFill.style.width = `${bossPct}%`;

    const dangerFill = $('gjDangerFill');
    if(dangerFill) dangerFill.style.width = `${clamp(state.dangerMeter, 0, 100)}%`;

    const bigHero = $('gjHeroHitBigBtn');
    const bigPct = $('gjHeroHitBigPct');

    if(bigPct) bigPct.textContent = `${Math.round(heroPct)}%`;

    if(bigHero){
      bigHero.classList.toggle('ready', heroPct >= 100);
      bigHero.classList.toggle('not-ready', heroPct < 100);
      bigHero.setAttribute('aria-label', heroPct >= 100 ? 'ใช้ HERO HIT' : `HERO HIT ${Math.round(heroPct)} เปอร์เซ็นต์`);
    }
  }

  function isSafeSpawnPoint(x, y, size){
    const safeTop = WIN.innerWidth <= 720 ? 154 : 118;
    const safeBottom = WIN.innerWidth <= 720 ? 136 : 92;

    if(y < safeTop) return false;
    if(y > worldRect().height - safeBottom) return false;

    for(const item of state.targets.values()){
      const dx = item.x - x;
      const dy = item.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if(dist < (item.size + size) * 0.68) return false;
    }

    return true;
  }

  function pickSafeSpawn(size){
    const r = worldRect();
    let x = 0;
    let y = 0;

    for(let tries = 0; tries < 24; tries++){
      x = clamp(44 + rand() * (r.width - 88), 40, r.width - 40);
      y = clamp(164 + rand() * (r.height - 310), 154, r.height - 136);

      if(state.dangerLaneActive && Math.abs(x - state.dangerLaneX) < 70){
        if(rand() < 0.7) continue;
      }

      if(isSafeSpawnPoint(x, y, size)){
        return { x, y };
      }
    }

    return {
      x: clamp(44 + rand() * (r.width - 88), 40, r.width - 40),
      y: clamp(170 + rand() * (r.height - 320), 154, r.height - 136)
    };
  }

  function hasSlowTime(){
    return Date.now() < state.activePower.slowUntil;
  }

  function hasMagnet(){
    return Date.now() < state.activePower.magnetUntil;
  }

  function spawnPowerUp(forceId = ''){
    if(state.ended || state.paused || !state.started) return;

    const data = forceId
      ? POWER_UPS.find(p => p.id === forceId) || pick(POWER_UPS)
      : pick(POWER_UPS);

    const id = `power_${Date.now()}_${++state.seq}`;
    const node = DOC.createElement('button');
    const size = WIN.innerWidth <= 720 ? 62 : 70;
    const p = pickSafeSpawn(size);

    node.type = 'button';
    node.className = 'gjTarget foodTarget target gj-food power gjPowerTarget gjTargetPop';
    node.setAttribute('aria-label', data.label);
    node.textContent = data.emoji;
    node.style.left = `${p.x}px`;
    node.style.top = `${p.y}px`;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.fontSize = `${Math.round(size * .56)}px`;
    node.style.background = 'radial-gradient(circle at 35% 30%,rgba(255,255,255,.44),rgba(250,204,21,.30),rgba(15,23,42,.88))';
    node.style.border = '2px solid rgba(250,204,21,.72)';
    node.style.boxShadow = '0 0 28px rgba(250,204,21,.42), 0 18px 36px rgba(0,0,0,.28)';

    const item = {
      id,
      node,
      kind: 'power',
      data,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      size,
      born: now(),
      ttl: 4800
    };

    on(node, 'pointerdown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      collectPowerUp(id);
    }, { passive:false });

    (el.targetLayer || el.gameWorld || el.app || DOC.body).appendChild(node);
    state.targets.set(id, item);
  }

  function collectPowerUp(id){
    const item = state.targets.get(id);
    if(!item || item.kind !== 'power') return;

    const power = item.data;
    removeTarget(id);

    state.powerUpsCollected[power.id] = (state.powerUpsCollected[power.id] || 0) + 1;

    if(power.id === 'shield'){
      state.activePower.shield++;
      toast('🛡️ Hero Shield พร้อมกันพลาด 1 ครั้ง!', 1300);
    }

    if(power.id === 'slow'){
      state.activePower.slowUntil = Date.now() + power.durationSec * 1000;
      toast('⏳ Slow Time! เป้าหมายช้าลง', 1300);
    }

    if(power.id === 'magnet'){
      state.activePower.magnetUntil = Date.now() + power.durationSec * 1000;
      toast('🧲 Good Magnet! อาหารดีเด่นขึ้น', 1300);
    }

    if(power.id === 'cleanBlast'){
      clearJunkTargets();
      state.score += 18;
      toast('✨ Clean Blast! ล้างขยะบนจอ', 1300);
      shake();
    }

    fx(item.x, item.y, power.label, 'gold');
    feedback('power');
    updateHud();
  }

  function maybeSpawnPowerUp(){
    if(state.ended || state.paused || !state.started) return;

    const chance =
      state.lives <= 1 ? 0.11 :
      state.finalRush ? 0.06 :
      state.phase >= 2 ? 0.045 :
      0.03;

    if(rand() < chance){
      if(state.lives <= 1) spawnPowerUp('shield');
      else spawnPowerUp();
    }
  }

  function pickJunkByGroup(group){
    const list = JUNK.filter(j => j.group === group);
    return list.length ? pick(list) : pick(JUNK);
  }

  function pickGoodByWeakness(){
    const w = currentWeakness();
    const list = GOOD.filter(g => w.icons.includes(g.emoji));
    return list.length ? pick(list) : pick(GOOD);
  }

  function spawnSpecificTarget(token = ''){
    if(state.ended || state.paused || !state.started) return;

    if(token === 'good') return spawnTarget('good');
    if(token === 'junk') return spawnTarget('junk');
    if(token === 'soda') return spawnTargetWithData('junk', pickJunkByGroup('soda'));
    if(token === 'fried') return spawnTargetWithData('junk', pickJunkByGroup('fried'));
    if(token === 'sweet') return spawnTargetWithData('junk', pickJunkByGroup('sweet'));
    if(token === 'burger') return spawnTargetWithData('junk', pickJunkByGroup('fatty'));
    if(token === 'weakness') return spawnTargetWithData('good', pickGoodByWeakness());

    if(token === 'lane'){
      setDangerLane(true);
      setTimeout(() => setDangerLane(false), 3200);
      return spawnTarget('junk');
    }

    return spawnTarget();
  }

  function spawnTargetWithData(forceKind = 'good', forceData = null){
    if(state.ended || state.paused || !state.started) return;

    const extra = state.finalRush ? 2 : state.phase >= 3 ? 1 : 0;
    if(state.targets.size >= tune.maxTargets + extra) return;

    const kind = forceKind === 'junk' ? 'junk' : 'good';
    const data = forceData || (kind === 'good' ? pick(GOOD) : pick(JUNK));

    const id = `gj_${Date.now()}_${++state.seq}`;
    const node = DOC.createElement('button');

    const size = kind === 'good'
      ? 58 + Math.floor(rand() * 20)
      : 56 + Math.floor(rand() * 18);

    const p = pickSafeSpawn(size);
    const x = p.x;
    const y = p.y;

    node.type = 'button';
    node.className = `gjTarget foodTarget target gj-food ${kind} gjTargetPop`;
    node.setAttribute('aria-label', data.label);
    node.textContent = data.emoji;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.fontSize = `${Math.round(size * 0.56)}px`;

    node.style.background = kind === 'good'
      ? 'radial-gradient(circle at 35% 30%,rgba(255,255,255,.32),rgba(34,197,94,.22),rgba(15,23,42,.86))'
      : 'radial-gradient(circle at 35% 30%,rgba(255,255,255,.24),rgba(239,68,68,.24),rgba(15,23,42,.88))';

    if(kind === 'good' && isWeaknessData(data)){
      node.style.border = '2px solid rgba(250,204,21,.86)';
      node.style.boxShadow = '0 0 30px rgba(250,204,21,.42), 0 18px 36px rgba(0,0,0,.28)';
    }

    if(kind === 'good' && hasMagnet()){
      node.style.border = '2px solid rgba(34,197,94,.82)';
      node.style.boxShadow = '0 0 30px rgba(34,197,94,.42), 0 18px 36px rgba(0,0,0,.28)';
      node.style.transform = 'translate(-50%,-50%) scale(1.12)';
    }

    let speedMultiplier =
      state.finalRush ? 1.35 :
      state.phase >= 3 ? 1.22 :
      state.phase >= 2 ? 1.12 :
      1;

    if(hasSlowTime()){
      speedMultiplier *= 0.55;
    }

    const speed = (tune.speedMin + rand() * (tune.speedMax - tune.speedMin)) * speedMultiplier;
    const vx = (rand() < 0.5 ? -1 : 1) * speed;
    const vy = (rand() < 0.5 ? -1 : 1) * speed * 0.62;

    const ttl = kind === 'good'
      ? (state.finalRush ? 2100 : state.phase >= 3 ? 2500 : 3300)
      : (state.finalRush ? 2400 : state.phase >= 3 ? 2800 : 3500);

    const item = {
      id,
      node,
      kind,
      data,
      x,
      y,
      vx,
      vy,
      size,
      born: now(),
      ttl
    };

    on(node, 'pointerdown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      hitTarget(id);
    }, { passive:false });

    (el.targetLayer || el.gameWorld || el.app || DOC.body).appendChild(node);
    state.targets.set(id, item);
  }

  function spawnTarget(forceKind = ''){
    if(forceKind === 'good'){
      return spawnTargetWithData('good', pick(GOOD));
    }

    if(forceKind === 'junk'){
      return spawnTargetWithData('junk', pick(JUNK));
    }

    let junkChance = tune.junkChance;
    if(state.phase === 2) junkChance += 0.08;
    if(state.phase >= 3) junkChance += 0.12;
    if(state.finalRush) junkChance += 0.16;

    const kind = rand() < junkChance ? 'junk' : 'good';
    return spawnTargetWithData(kind, kind === 'good' ? pick(GOOD) : pick(JUNK));
  }

  function hitTarget(id){
    if(state.ended || state.paused) return;

    const item = state.targets.get(id);
    if(!item) return;

    if(item.kind === 'power'){
      collectPowerUp(id);
      return;
    }

    const x = item.x;
    const y = item.y;

    if(item.kind === 'good'){
      let damage = item.data.dmg + Math.floor(state.combo / 7);

      if(state.bossShield){
        damage = Math.max(2, Math.round(damage * 0.35));
        pulseBossShield();
      }

      if(state.phase === 1){
        state.mission.phase1Good++;
      }

      state.score += 10 + Math.min(18, state.combo);
      state.good++;
      state.combo++;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.heroHit = clamp(state.heroHit + item.data.charge + Math.min(7, Math.floor(state.combo / 3)), 0, 100);
      state.bossHp = clamp(state.bossHp - damage, 0, state.bossMaxHp);
      state.damageTotal += damage;

      if(damage >= 16 || state.combo % 10 === 0){
        bigDamageText(damage, state.bossShield ? 'SHIELD' : 'DMG');
      }

      updateFoodGroups(item);
      updateWeaknessMission(item);
      updateDailyChallengeOnGood(item);
      microTip('good', item);
      checkComboSkills();

      fx(x, y, state.bossShield ? `โล่ -${damage}` : `-${damage}`, state.bossShield ? 'gold' : 'good');
      feedback('good');

      if(state.combo > 0 && state.combo % 8 === 0){
        toast(`Combo x${state.combo}! HERO HIT ชาร์จเร็วขึ้น ⚡`);
      }
    }else{
      state.junkHit++;
      state.miss++;
      state.combo = 0;

      if(state.activePower.shield > 0){
        state.activePower.shield--;
        state.shieldBlocks++;
        toast('🛡️ Hero Shield กันขยะไว้ได้!', 1100);
        fx(x, y, 'BLOCK!', 'gold');
      }else{
        state.lives = Math.max(0, state.lives - item.data.penalty);
      }

      state.rage = clamp(state.rage + 10, 0, 100);
      state.dangerMeter = clamp(state.dangerMeter + 14, 0, 100);
      state.score = Math.max(0, state.score - 8);

      updateDailyChallengeOnJunk(item);
      microTip('junk', item);
      maybeComebackAssist();

      fx(x, y, 'พลาด!', 'bad');
      shake();
      feedback('bad');

      if(state.phase >= 2){
        bossMiniPunish();
      }
    }

    removeTarget(id);
    checkPhase();
    updateHud();

    if(state.bossHp <= 0){
      tryWinOrForceRush();
      return;
    }

    if(state.lives <= 0){
      endGame(false);
    }
  }

  function bossMiniPunish(){
    if(rand() < 0.38){
      setTimeout(() => spawnTarget('junk'), 120);
      setTimeout(() => spawnTarget('junk'), 260);
      toast('บอสสวนกลับ! ระวังขยะเพิ่ม ⚠️', 950);
    }
  }

  function tryWinOrForceRush(){
    if(state.elapsedSec >= tune.minWinSec && state.finalRush){
      finishMove();
      return;
    }

    state.bossHp = Math.max(1, Math.round(state.bossMaxHp * 0.08));
    state.finalRush = true;
    state.phase = 3;

    if(!state.phaseAnnounced.finalRush){
      state.phaseAnnounced.finalRush = true;
      toast('🔥 บอสยังไม่ยอมแพ้! Final Rush เริ่มแล้ว!', 1700);
      bossSay('finalRush', 1400);
      showPhaseCinematic('finalRush');
      screenTint('final');
    }else{
      safeFinalRushToast(`🔥 ต้องเอาตัวรอดให้ครบ ${tune.minWinSec}s ก่อนปิดฉาก!`, 1400);
    }

    bossAttack();
    updateHud();
  }

  function missGoodTarget(item){
    state.missedGood++;
    state.miss++;
    state.combo = 0;
    state.lives = Math.max(0, state.lives - 1);
    state.dangerMeter = clamp(state.dangerMeter + 10, 0, 100);
    fx(item.x, item.y, 'หลุด!', 'bad');
    shake();
    feedback('bad');
    maybeComebackAssist();
    updateHud();

    if(state.lives <= 0){
      endGame(false);
    }
  }

  function updateTargets(dt){
    const r = worldRect();
    const t = now();

    for(const [id, item] of Array.from(state.targets.entries())){
      if(item.kind !== 'power'){
        item.x += item.vx * dt * 60;
        item.y += item.vy * dt * 60;

        if(item.x < 32 || item.x > r.width - 32) item.vx *= -1;
        if(item.y < 112 || item.y > r.height - 54) item.vy *= -1;

        item.x = clamp(item.x, 32, r.width - 32);
        item.y = clamp(item.y, 112, r.height - 54);

        item.node.style.left = `${item.x}px`;
        item.node.style.top = `${item.y}px`;

        if(state.dangerLaneActive && Math.abs(item.x - state.dangerLaneX) < 38 && item.kind === 'junk'){
          item.node.style.transform = 'translate(-50%,-50%) scale(1.14)';
        }else if(!(item.kind === 'good' && hasMagnet())){
          item.node.style.transform = 'translate(-50%,-50%)';
        }
      }

      if(t - item.born > item.ttl){
        if(item.kind === 'good'){
          missGoodTarget(item);
        }else if(item.kind === 'junk' && state.phase >= 2){
          state.mission.phase2Dodge++;
          if(state.mission.phase2Dodge % 5 === 0){
            state.score += 6;
            fx(item.x, item.y, 'หลบดี!', 'good');
          }
        }

        removeTarget(id);
      }
    }
  }

  function useHeroHit(){
    if(state.ended || state.paused || !state.started) return;

    if(state.heroHit < 100){
      const need = Math.max(1, Math.ceil(100 - state.heroHit));
      toast(`HERO HIT ยังไม่เต็ม ต้องการอีก ${need}% ⚡`, 1200);

      const btn = $('gjHeroHitBigBtn');
      if(btn){
        btn.style.animation = 'none';
        void btn.offsetWidth;
        btn.style.animation = 'gjHeroDenied .28s ease-in-out 1';
      }

      return;
    }

    let damage = state.finalRush ? tune.heroHitDmg : Math.round(tune.heroHitDmg * 0.68);

    if(state.bossShield){
      damage = Math.round(damage * 0.45);
      toast('🛡️ โล่บอสลดพลัง HERO HIT! ต้องสู้ต่อ!', 1300);
      pulseBossShield();
    }

    state.heroHit = 0;
    state.mission.phase3HeroHit++;
    state.bossHp = clamp(state.bossHp - damage, 0, state.bossMaxHp);
    state.score += 35;
    state.damageTotal += damage;

    clearTargets();
    shake();

    toast(`HERO HIT! โจมตีบอส -${damage} 👊`, 1400);
    feedback('hero');
    bigDamageText(damage, 'HERO HIT');
    fx(worldRect().width / 2, worldRect().height / 2, 'HERO HIT!', 'gold');

    updateHud();

    if(state.bossHp <= 0){
      if(state.elapsedSec >= tune.minWinSec && state.finalRush){
        finishMove();
      }else{
        state.bossHp = Math.max(1, Math.round(state.bossMaxHp * 0.10));
        state.finalRush = true;
        state.phase = 3;
        toast('🔥 บอสเข้าสู่ Rage Mode! ยังไม่จบง่าย ๆ!', 1500);
        showPhaseCinematic('finalRush');
        screenTint('final');
        bossAttack();
        updateHud();
      }
    }
  }

  function bossShieldRegen(){
    if(state.ended || state.paused || !state.started) return;

    state.bossShieldRegenCount++;

    const regenHp = Math.round(state.bossMaxHp * 0.045);
    state.bossHp = clamp(state.bossHp + regenHp, 1, state.bossMaxHp);

    if(!state.bossShield){
      state.bossShield = true;
      setTimeout(() => {
        if(state.started && !state.ended){
          state.bossShield = false;
          toast('🛡️ โล่ฟื้นชั่วคราวหมดแล้ว!', 1100);
          updateHud();
        }
      }, 5200);
    }

    pulseBossShield();
    bigDamageText(regenHp, 'REGEN');
    toast(`🍔 Burger Shield ฟื้นพลังบอส +${regenHp}!`, 1500);
    updateHud();
  }

  function bossAttack(){
    if(state.ended || state.paused || !state.started) return;
    if(state.bossSkillCooldownLock) return;

    state.bossSkillCooldownLock = true;
    setTimeout(() => {
      state.bossSkillCooldownLock = false;
    }, 900);

    let skill = pick(BOSS_IDENTITY.skills);

    for(let i = 0; i < 4; i++){
      if(skill.id !== state.lastBossSkillId) break;
      skill = pick(BOSS_IDENTITY.skills);
    }

    state.lastBossSkillId = skill.id;
    state.bossSkillUsed[skill.id] = (state.bossSkillUsed[skill.id] || 0) + 1;

    warningFlash(skill.warning);
    bossSay(
      state.finalRush ? 'finalRush' :
      state.phase >= 3 ? 'phase3' :
      state.phase >= 2 ? 'phase2' :
      'shield',
      1300
    );

    const baseWave =
      state.finalRush ? 8 :
      state.phase === 3 ? 7 :
      state.phase === 2 ? 6 :
      5;

    const wave = skill.id === 'sodaSplash' ? baseWave + 1 : baseWave;

    safeFinalRushToast(`${skill.emoji} ${skill.name} Wave x${wave}!`, 1200);
    shake();
    feedback('boss');

    if(skill.id === 'dangerLane' || skill.id === 'friedWall'){
      setDangerLane(true);
      setTimeout(() => setDangerLane(false), skill.id === 'friedWall' ? 4200 : 3600);
    }

    if(skill.shieldRegen){
      setTimeout(() => {
        if(!state.paused && !state.ended) bossShieldRegen();
      }, Math.max(500, skill.telegraphMs - 250));
    }

    const pattern = skill.pattern || ['junk','junk','good','junk'];

    for(let i = 0; i < wave; i++){
      setTimeout(() => {
        if(state.ended || state.paused) return;

        let token = pattern[i % pattern.length];

        if(state.finalRush && i === Math.floor(wave / 2)){
          token = 'weakness';
        }

        spawnSpecificTarget(token);
      }, skill.telegraphMs + i * (skill.waveDelay || 160));
    }

    state.rage = clamp(state.rage + 12, 0, 100);
    state.dangerMeter = clamp(state.dangerMeter + (skill.dangerGain || 10), 0, 100);
    state.mission.bossWavesSurvived++;
  }

  function checkPhase(){
    const hpPct = state.bossHp / state.bossMaxHp;

    if(state.bossShield && state.elapsedSec >= tune.shieldUntilSec){
      state.bossShield = false;

      if(!state.phaseAnnounced.shieldBreak){
        state.phaseAnnounced.shieldBreak = true;
        toast('🛡️ โล่บอสแตกแล้ว! โจมตีแรงขึ้น!', 1500);
        bossSay('shieldBreak', 1400);
        screenTint('storm');
        shake();
      }
    }

    if(!state.finalRush && (hpPct <= tune.finalRushAt || state.timeLeft <= 28)){
      state.finalRush = true;
      state.phase = 3;

      if(!state.phaseAnnounced.finalRush){
        state.phaseAnnounced.finalRush = true;
        toast('🔥 FINAL RUSH! บอสคลั่งเต็มพลัง!', 1700);
        bossSay('finalRush', 1400);
        showPhaseCinematic('finalRush');
        screenTint('final');
        shake();
        bossAttack();
      }
      return;
    }

    if(hpPct <= 0.62 && state.phase < 2){
      state.phase = 2;

      if(!state.phaseAnnounced.phase2){
        state.phaseAnnounced.phase2 = true;
        toast('🌪️ Phase 2: Junk Storm เริ่มแล้ว!', 1500);
        bossSay('phase2', 1400);
        showPhaseCinematic('phase2');
        screenTint('storm');
        shake();
        bossAttack();
      }
      return;
    }

    if(hpPct <= 0.36 && state.phase < 3){
      state.phase = 3;

      if(!state.phaseAnnounced.phase3){
        state.phaseAnnounced.phase3 = true;
        toast('😡 Phase 3: Boss Rage!', 1500);
        bossSay('phase3', 1400);
        showPhaseCinematic('phase3');
        screenTint('rage');
        shake();
        bossAttack();
      }
    }
  }

  function gameLoop(ts){
    if(state.ended) return;

    if(!state.lastFrame) state.lastFrame = ts;
    const dt = Math.min(0.05, (ts - state.lastFrame) / 1000);
    state.lastFrame = ts;

    if(!state.paused && state.started){
      state.elapsedSec = Math.max(0, Math.round((Date.now() - state.startTs) / 1000));
      state.timeLeft = Math.max(0, state.timeLeft - dt);

      checkPhase();

      const spawnEvery =
        state.finalRush ? tune.spawnEvery * 0.58 :
        state.phase >= 3 ? tune.spawnEvery * 0.72 :
        state.phase >= 2 ? tune.spawnEvery * 0.86 :
        tune.spawnEvery;

      if(ts - state.lastSpawn >= spawnEvery){
        state.lastSpawn = ts;
        spawnTarget();
        maybeSpawnPowerUp();
      }

      const attackEvery =
        state.finalRush ? tune.bossAttackEvery * 0.62 :
        state.phase >= 3 ? tune.bossAttackEvery * 0.78 :
        state.phase >= 2 ? tune.bossAttackEvery * 0.9 :
        tune.bossAttackEvery;

      if(ts - state.lastBossAttack >= attackEvery){
        state.lastBossAttack = ts;
        bossAttack();
      }

      updateTargets(dt);
      updateHud();

      if(state.timeLeft <= 0){
        const winByScore = state.score >= Math.round(state.bossMaxHp * 0.5);
        const winByBoss = state.bossHp <= 0;
        endGame(winByBoss || winByScore);
        return;
      }
    }

    requestAnimationFrame(gameLoop);
  }

  function showIntro(){
    hideBoot();
    show(el.introScreen);
    hide(el.gameScreen);
    hide(el.summaryScreen);

    if(el.pauseOverlay) el.pauseOverlay.classList.remove('show');

    if(el.goalText){
      el.goalText.innerHTML = starGoalIntro().join(' • ');
    }
  }

  function startGame(){
    if(state.started && !state.ended) return;

    setupDailyChallenge();

    hideBoot();
    hide(el.introScreen);
    show(el.gameScreen);
    hide(el.summaryScreen);

    if(el.pauseOverlay) el.pauseOverlay.classList.remove('show');

    state.started = true;
    state.paused = false;
    state.ended = false;
    state.safeExitReady = false;
    state.startTs = Date.now();
    state.elapsedSec = 0;
    state.lastFrame = 0;
    state.lastSpawn = 0;
    state.lastBossAttack = now() + 2400;

    updateHud();

    toast('Phase 1: ทำลายโล่ Junk King! 🛡️👑', 1600);
    screenTint('shield');
    showPhaseCinematic('phase1');

    setTimeout(() => {
      bossSay('intro', 1700);
    }, 450);

    setTimeout(() => {
      starGoalIntro().forEach((line, i) => {
        setTimeout(() => toast(line, 1500), i * 900);
      });
    }, 1300);

    requestAnimationFrame(gameLoop);
  }

  function pauseGame(){
    if(!state.started || state.ended) return;
    state.paused = true;
    if(el.pauseOverlay) el.pauseOverlay.classList.add('show');
    toast('พักเกม');
  }

  function resumeGame(){
    if(!state.started || state.ended) return;
    state.paused = false;
    state.lastFrame = 0;
    if(el.pauseOverlay) el.pauseOverlay.classList.remove('show');
    toast('เล่นต่อ!');
  }

  function saveSummary(win){
    const payload = {
      game: 'goodjunk',
      mode: 'solo-boss',
      pid: CFG.pid,
      name: CFG.name,
      score: state.score,
      scoreFinal: state.score,
      good: state.good,
      junkHit: state.junkHit,
      missedGood: state.missedGood,
      miss: state.miss,
      misses: state.miss,
      accPct: calcAccuracy(),
      stars: calcStars(),
      win,
      bossDefeated: win,
      bestCombo: state.bestCombo,
      bossWavesSurvived: state.mission.bossWavesSurvived,
      heroHitUsed: state.mission.phase3HeroHit,
      phase1Good: state.mission.phase1Good,
      phase2Dodge: state.mission.phase2Dodge,
      dailyChallengeId: state.dailyChallenge?.id || '',
      dailyChallengeTitle: state.dailyChallenge?.title || '',
      dailyReward: state.dailyChallenge && !state.dailyFailed ? state.dailyChallenge.reward : '',
      dailyFailed: state.dailyFailed,
      dailyProgress: state.dailyProgress,
      greenHits: state.greenHits,
      proteinHits: state.proteinHits,
      fruitHits: state.fruitHits,
      comebackTriggered: state.comebackTriggered,
      finishMoveUsed: state.finishMoveUsed,
      dangerMeter: state.dangerMeter,
      weaknessHits: state.weaknessMission.hits,
      bossSkillUsed: { ...state.bossSkillUsed },
      bossShieldRegenCount: state.bossShieldRegenCount,
      lastBossSkillId: state.lastBossSkillId,
      powerUpsCollected: { ...state.powerUpsCollected },
      shieldBlocks: state.shieldBlocks,
      damageTotal: state.damageTotal,
      microTipsShown: state.microTipsShown,
      heroHitFinalPct: Math.round(state.heroHit),
      dangerMeterFinal: Math.round(state.dangerMeter),
      sfxEnabled: state.sfxEnabled,
      vibrateEnabled: state.vibrateEnabled,
      safeExitTarget: CFG.hub || '',
      exitTargetType: isCooldownHub() ? 'cooldown-gate' : 'zone',
      kidSummaryLevel: kidLevel().title,
      learningTip: learningTipForSummary({
        miss: state.miss,
        accPct: calcAccuracy(),
        junkHit: state.junkHit,
        missedGood: state.missedGood
      }),
      durationSec: Math.max(0, Math.round((Date.now() - state.startTs) / 1000)),
      endedAt: new Date().toISOString(),
      patch: PATCH
    };

    payload.resultBadges = getBadges(payload);
    payload.bossBookTip = bossBookSummaryTip();

    try{
      localStorage.setItem(`HHA_LAST_SUMMARY:goodjunk:${CFG.pid || 'anon'}`, JSON.stringify(payload));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        ts: Date.now(),
        payload,
        ...payload
      }));
    }catch(_){}

    return payload;
  }

  function endGame(win){
    if(state.ended) return;

    state.ended = true;
    state.paused = false;
    state.safeExitReady = true;
    state.endTs = Date.now();

    clearTargets();
    setDangerLane(false);

    hide(el.gameScreen);
    hide(el.introScreen);
    show(el.summaryScreen);

    if(el.pauseOverlay) el.pauseOverlay.classList.remove('show');

    const summary = saveSummary(win);

    setText(el.summaryTitle, win ? 'ชนะ Junk King แล้ว!' : 'หมดพลังแล้ว');
    setText(el.summaryScore, summary.score);
    setText(el.summaryGood, summary.good);
    setText(el.summaryMiss, summary.miss);
    setText(el.summaryStars, summary.stars);

    if(el.summaryScore) el.summaryScore.title = 'คะแนนรวม';
    if(el.summaryGood) el.summaryGood.title = 'จำนวนอาหารดีที่เก็บได้';
    if(el.summaryMiss) el.summaryMiss.title = 'จำนวนครั้งที่พลาด';
    if(el.summaryStars) el.summaryStars.title = 'ดาวจากผลงาน';

    if(el.summaryTip){
      el.summaryTip.textContent = renderKidSummary(summary);
    }

    updateExitButtonLabels();

    if(win) feedback('win');
    else feedback('bad');

    toast(win ? 'Victory! 🎉' : 'ลองใหม่อีกครั้งนะ 💪', 1500);
  }

  function bindEvents(){
    on(el.bootStartBtn, 'click', startGame);
    on(el.bootBackBtn, 'click', goHub);

    on(el.introStartBtn, 'click', startGame);
    on(el.introBackBtn, 'click', goHub);

    on(el.backBtn, 'click', goHub);
    on(el.pauseBtn, 'click', pauseGame);
    on(el.resumeBtn, 'click', resumeGame);

    on(el.pauseResumeBtn, 'click', resumeGame);
    on(el.pauseBackBtn, 'click', goHub);

    on(el.summaryReplayBtn, 'click', replayGame);
    on(el.summaryBackBtn, 'click', goHub);

    on(el.replayBtn, 'click', replayGame);
    on(el.restartBtn, 'click', replayGame);
    on(el.homeBtn, 'click', goHub);
    on(el.hubBtn, 'click', goHub);
    on(el.backHubBtn, 'click', goHub);

    on(el.heroHitBtn, 'click', useHeroHit);

    on(WIN, 'resize', () => {
      updateHud();
      if(state.dangerLaneActive) drawDangerLane();
    });

    on(DOC, 'visibilitychange', () => {
      if(DOC.hidden && state.started && !state.ended){
        pauseGame();
      }
    });

    on(WIN, 'hha:goodjunk:solo:start', () => {
      startGame();
    });

    on(DOC, 'hha:goodjunk:solo:start', () => {
      startGame();
    });

    on(WIN, 'keydown', ev => {
      if(ev.key === 'Escape') pauseGame();
      if(ev.key === ' '){
        ev.preventDefault();
        useHeroHit();
      }
    });
  }

  function ensureRequiredDom(){
    let app = $('gjSoloBossApp') || $('app');

    if(!app){
      app = DOC.createElement('main');
      app.id = 'gjSoloBossApp';
      app.className = 'gj-solo-boss-app';
      DOC.body.appendChild(app);
    }

    function add(id, tag = 'div', parent = app){
      let n = $(id);
      if(!n){
        n = DOC.createElement(tag);
        n.id = id;
        parent.appendChild(n);
      }
      return n;
    }

    add('introScreen', 'section');
    add('gameScreen', 'section');
    add('summaryScreen', 'section');

    add('introStartBtn', 'button');
    add('introBackBtn', 'button');
    add('backBtn', 'button');
    add('pauseBtn', 'button');
    add('resumeBtn', 'button');
    add('summaryReplayBtn', 'button');
    add('summaryBackBtn', 'button');

    add('scoreText');
    add('timerText');
    add('lifeText');
    add('phaseText');
    add('bossHpText');
    add('heroHitText');
    add('heroHitBtn', 'button');
    add('bossHpFill');
    add('heroHitFill');
    add('coachText');
    add('announcer');
    add('toast');
    add('toastText');
    add('comboText');
    add('goodText');
    add('missText');
    add('rageText');

    add('gameWorld');
    add('targetLayer');
    add('fxLayer');

    add('summaryTitle');
    add('summaryScore');
    add('summaryGood');
    add('summaryMiss');
    add('summaryStars');
    add('summaryTip');

    cacheElements();
  }

  function boot(root, cfg){
    if(state.booted) return;
    state.booted = true;

    try{
      if(cfg && typeof cfg === 'object'){
        Object.assign(CFG, cfg);
      }

      ensureFxStyle();
      ensureRequiredDom();
      cacheElements();
      updateExitButtonLabels();
      bindEvents();
      updateHud();

      if(el.bootStatus) el.bootStatus.textContent = 'Game engine ready';

      if(CFG.run === 'play' || qs.get('autostart') === '1'){
        setTimeout(startGame, 220);
      }else{
        showIntro();
      }

      console.log('[GoodJunk Solo Boss] booted', {
        patch: PATCH,
        cfg: CFG
      });
    }catch(err){
      console.error('[GoodJunk Solo Boss] boot failed', err);
      showBootError(err);
    }
  }

  WIN.bootGoodJunkSoloBoss = boot;

  WIN.startGoodJunkSoloBoss = function(root, cfg){
    boot(root, cfg);
    startGame();
  };

  WIN.GoodJunkSoloBoss = {
    PATCH,
    boot,
    start(root, cfg){
      boot(root, cfg);
      startGame();
    },
    pause: pauseGame,
    resume: resumeGame,
    goHub,
    useHeroHit,
    getState(){
      return JSON.parse(JSON.stringify({
        score: state.score,
        good: state.good,
        miss: state.miss,
        lives: state.lives,
        bossHp: state.bossHp,
        bossMaxHp: state.bossMaxHp,
        timeLeft: state.timeLeft,
        phase: state.phase,
        finalRush: state.finalRush,
        bossShield: state.bossShield,
        elapsedSec: state.elapsedSec,
        dailyChallenge: state.dailyChallenge,
        dangerMeter: state.dangerMeter,
        patch: PATCH
      }));
    }
  };

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', () => boot());
  }else{
    boot();
  }
})();
