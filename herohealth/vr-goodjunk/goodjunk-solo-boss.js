// === /herohealth/vr-goodjunk/goodjunk-solo-boss.js ===
// FULL MERGED PATCH v8.40
// v20260504y-GOODJUNK-SOLO-BOSS-V8-40-FINAL-POLISH-CHILD-SUMMARY
//
// GoodJunk Solo Phase Boss
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
// ✅ Mobile-safe spawn / anti-overlap / pause-safe skills / fair difficulty
// ✅ Replay Variety / Boss Drama
// ✅ Reward Loop / Boss Book
// ✅ Sound / Haptic / Juice
// ✅ Micro Tutorial
// ✅ Difficulty Personality
// ✅ Final Balance / Anti-Frustration
// ✅ Runtime Guard / QA Hardening
// ✅ Balance Tuning
// ✅ Child-friendly final summary
// ✅ No Apps Script logging in this version

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const PATCH = 'v20260504y-GOODJUNK-SOLO-BOSS-V8-40-FINAL-POLISH-CHILD-SUMMARY';

  const qs = new URLSearchParams(location.search);

  const ROOT = 'https://supparang.github.io/webxr-health-mobile/herohealth/';
  const DEFAULT_ZONE =
    ROOT +
    'nutrition-zone.html?pid=anon&diff=normal&time=120&view=mobile&hub=' +
    encodeURIComponent(ROOT + 'hub.html');

  function first(){
    for(let i = 0; i < arguments.length; i++){
      const v = arguments[i];
      if(String(v || '').trim()) return String(v).trim();
    }
    return '';
  }

  function clean(v, fallback = ''){
    v = String(v ?? '').trim();
    return v || fallback;
  }

  function safeUrl(raw, fallback = ''){
    try{
      if(!String(raw || '').trim()) return fallback;
      return new URL(String(raw), location.href).toString();
    }catch(_){
      return fallback;
    }
  }

  const CFG = {
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
    multiplayer: clean(qs.get('multiplayer'), '0'),

    hub: safeUrl(qs.get('hub'), DEFAULT_ZONE),
    hubRoot: safeUrl(qs.get('hubRoot'), DEFAULT_ZONE),

    api: clean(qs.get('api'), ''),
    log: clean(qs.get('log'), ''),
    studyId: clean(qs.get('studyId'), ''),
    section: clean(qs.get('section'), ''),
    session_code: clean(qs.get('session_code'), '')
  };

  const DIFF = ['easy','normal','hard','challenge'].includes(String(CFG.diff).toLowerCase())
    ? String(CFG.diff).toLowerCase()
    : 'normal';

  function hashSeed(s){
    s = String(s || 'goodjunk');
    let h = 2166136261 >>> 0;

    for(let i = 0; i < s.length; i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }

    return h >>> 0;
  }

  function mulberry32(seed){
    let t = (seed >>> 0) || 1;

    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, a, b){
    v = Number(v);

    if(!Number.isFinite(v)) v = a;

    return Math.max(a, Math.min(b, v));
  }

  function now(){
    return performance.now();
  }

  function safeCall(fn, fallback = null){
    try{
      if(typeof fn === 'function') return fn();
    }catch(err){
      console.warn('[GoodJunk safeCall]', err);
    }

    return fallback;
  }

  function callMaybe(fn, ...args){
    try{
      if(typeof fn === 'function') return fn(...args);
    }catch(err){
      console.warn('[GoodJunk callMaybe]', err);
    }

    return undefined;
  }

  function safeOnce(obj, key, fn){
    try{
      if(!obj || obj[key]) return false;
      obj[key] = true;

      if(typeof fn === 'function') fn();

      return true;
    }catch(err){
      console.warn('[GoodJunk safeOnce]', key, err);
      return false;
    }
  }

  function safeNumber(v, fallback = 0){
    v = Number(v);
    return Number.isFinite(v) ? v : fallback;
  }

  function safeArray(v){
    return Array.isArray(v) ? v : [];
  }

  function safeObject(v){
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  }

  function safeSetText(id, text){
    const n = $(id);
    if(n) n.textContent = String(text ?? '');
  }

  function safeClass(node, method, ...classes){
    try{
      if(node && node.classList && typeof node.classList[method] === 'function'){
        node.classList[method](...classes.filter(Boolean));
      }
    }catch(_){}
  }

  function safeRemoveNode(node){
    try{
      if(node && node.parentNode) node.remove();
    }catch(_){}
  }

  function safeTimeout(fn, ms = 0){
    return setTimeout(() => {
      try{
        if(typeof fn === 'function') fn();
      }catch(err){
        console.warn('[GoodJunk timeout]', err);
      }
    }, ms);
  }

  function pick(arr){
    if(!Array.isArray(arr) || !arr.length) return null;

    const r = typeof state?.rng === 'function'
      ? state.rng()
      : Math.random();

    return arr[Math.floor(r * arr.length)] || arr[0];
  }

  const TUNING = {
    easy: {
      time: 120,
      lives: 6,
      bossHp: 520,
      spawnEvery: 900,
      maxTargets: 5,
      junkChance: .30,
      speedMin: .78,
      speedMax: 1.38,
      bossAttackEvery: 8000,
      finalRushAt: .28,
      minWinSec: 65,
      shieldUntilSec: 20,
      heroHitDmg: 56,
      minBossFightSec: 62,
      softWinHoldHpPct: .06,
      phaseHoldSec: 16,
      dangerDecayPerSec: 3.8,
      heroHitMaxPerSec: 1.7,
      scoreWinNeed: 220
    },

    normal: {
      time: 150,
      lives: 5,
      bossHp: 760,
      spawnEvery: 760,
      maxTargets: 6,
      junkChance: .39,
      speedMin: 1.00,
      speedMax: 1.88,
      bossAttackEvery: 6200,
      finalRushAt: .32,
      minWinSec: 78,
      shieldUntilSec: 26,
      heroHitDmg: 66,
      minBossFightSec: 78,
      softWinHoldHpPct: .06,
      phaseHoldSec: 18,
      dangerDecayPerSec: 3.2,
      heroHitMaxPerSec: 1.55,
      scoreWinNeed: 280
    },

    hard: {
      time: 180,
      lives: 4,
      bossHp: 980,
      spawnEvery: 650,
      maxTargets: 7,
      junkChance: .46,
      speedMin: 1.18,
      speedMax: 2.30,
      bossAttackEvery: 5200,
      finalRushAt: .36,
      minWinSec: 95,
      shieldUntilSec: 32,
      heroHitDmg: 80,
      minBossFightSec: 96,
      softWinHoldHpPct: .07,
      phaseHoldSec: 20,
      dangerDecayPerSec: 2.6,
      heroHitMaxPerSec: 1.38,
      scoreWinNeed: 340
    },

    challenge: {
      time: 180,
      lives: 4,
      bossHp: 1120,
      spawnEvery: 560,
      maxTargets: 8,
      junkChance: .51,
      speedMin: 1.32,
      speedMax: 2.65,
      bossAttackEvery: 4500,
      finalRushAt: .40,
      minWinSec: 108,
      shieldUntilSec: 38,
      heroHitDmg: 92,
      minBossFightSec: 108,
      softWinHoldHpPct: .08,
      phaseHoldSec: 22,
      dangerDecayPerSec: 2.2,
      heroHitMaxPerSec: 1.22,
      scoreWinNeed: 400
    }
  };

  const tune = TUNING[DIFF] || TUNING.normal;

  const GOOD = [
    {
      emoji:'🥦',
      label:'บรอกโคลี',
      group:'green',
      dmg:13,
      charge:9,
      tip:'ผักสีเขียวช่วยให้ร่างกายแข็งแรง',
      lesson:'ผักดี'
    },
    {
      emoji:'🥬',
      label:'ผักใบเขียว',
      group:'green',
      dmg:13,
      charge:9,
      tip:'ผักมีวิตามินและใยอาหาร',
      lesson:'ผักดี'
    },
    {
      emoji:'🥕',
      label:'แครอท',
      group:'green',
      dmg:11,
      charge:8,
      tip:'ผักหลากสีช่วยให้ได้สารอาหารหลากหลาย',
      lesson:'ผักหลากสี'
    },
    {
      emoji:'🍎',
      label:'แอปเปิล',
      group:'fruit',
      dmg:12,
      charge:10,
      tip:'ผลไม้สดดีกว่าขนมหวาน',
      lesson:'ผลไม้สด'
    },
    {
      emoji:'🍉',
      label:'แตงโม',
      group:'fruit',
      dmg:11,
      charge:9,
      tip:'ผลไม้สดช่วยเติมน้ำและวิตามิน',
      lesson:'ผลไม้สด'
    },
    {
      emoji:'🍌',
      label:'กล้วย',
      group:'fruit',
      dmg:11,
      charge:9,
      tip:'กล้วยให้พลังงานและโพแทสเซียม',
      lesson:'ผลไม้ให้พลังงาน'
    },
    {
      emoji:'🐟',
      label:'ปลา',
      group:'protein',
      dmg:13,
      charge:9,
      tip:'ปลาเป็นโปรตีนดี',
      lesson:'โปรตีนดี'
    },
    {
      emoji:'🥚',
      label:'ไข่ต้ม',
      group:'protein',
      dmg:12,
      charge:9,
      tip:'ไข่ต้มเป็นโปรตีนดีและไม่ใช้น้ำมันมาก',
      lesson:'วิธีปรุงสำคัญ'
    },
    {
      emoji:'🫘',
      label:'ถั่ว',
      group:'protein',
      dmg:12,
      charge:8,
      tip:'ถั่วเป็นโปรตีนจากพืช',
      lesson:'โปรตีนพืช'
    },
    {
      emoji:'🍚',
      label:'ข้าว',
      group:'carb',
      dmg:10,
      charge:7,
      tip:'ข้าวให้พลังงาน แต่ควรกินพอดี',
      lesson:'คาร์บพอดี'
    }
  ];

  const JUNK = [
    {
      emoji:'🍟',
      label:'เฟรนช์ฟรายส์',
      group:'fried',
      penalty:1,
      tip:'ของทอดมีน้ำมันมาก กินบ่อยไม่ดี',
      lesson:'ของทอด'
    },
    {
      emoji:'🍭',
      label:'ลูกอม',
      group:'sweet',
      penalty:1,
      tip:'ลูกอมมีน้ำตาลสูง',
      lesson:'น้ำตาลสูง'
    },
    {
      emoji:'🥤',
      label:'น้ำอัดลม',
      group:'soda',
      penalty:1,
      tip:'น้ำอัดลมมีน้ำตาลสูง',
      lesson:'เครื่องดื่มหวาน'
    },
    {
      emoji:'🍩',
      label:'โดนัท',
      group:'sweet',
      penalty:1,
      tip:'โดนัทหวานและมัน',
      lesson:'หวานและมัน'
    },
    {
      emoji:'🍔',
      label:'เบอร์เกอร์มัน',
      group:'fatty',
      penalty:1,
      tip:'อาหารมันและเค็มมากไม่ควรกินบ่อย',
      lesson:'มันและเค็ม'
    },
    {
      emoji:'🍫',
      label:'ช็อกโกแลตหวาน',
      group:'sweet',
      penalty:1,
      tip:'ขนมหวานควรกินนาน ๆ ครั้ง',
      lesson:'ขนมหวาน'
    }
  ];

  const BOSS = {
    name: 'Junk King',
    emoji: '👑🍔',
    weakness: {
      phase1: {
        label:'ผักสีเขียว',
        icons:['🥦','🥬','🥕'],
        group:'green'
      },
      phase2: {
        label:'โปรตีนดี',
        icons:['🐟','🥚','🫘'],
        group:'protein'
      },
      phase3: {
        label:'ผลไม้สด',
        icons:['🍎','🍉','🍌'],
        group:'fruit'
      }
    },
    skills: [
      {
        id:'junkStorm',
        emoji:'🌪️',
        name:'Junk Storm',
        warning:'พายุขยะมาแล้ว!',
        telegraphMs:900,
        waveDelay:150,
        dangerGain:14,
        pattern:['junk','junk','good','weakness','junk']
      },
      {
        id:'sodaSplash',
        emoji:'🥤',
        name:'Soda Splash',
        warning:'น้ำอัดลมเด้งเร็ว!',
        telegraphMs:850,
        waveDelay:125,
        dangerGain:16,
        pattern:['soda','good','soda','weakness','junk']
      },
      {
        id:'sugarTrap',
        emoji:'🍩',
        name:'Sugar Trap',
        warning:'ขนมหวานหลอกตา!',
        telegraphMs:950,
        waveDelay:135,
        dangerGain:13,
        pattern:['sweet','good','junk','weakness','sweet']
      },
      {
        id:'friedWall',
        emoji:'🍟',
        name:'Fried Wall',
        warning:'กำแพงของทอด!',
        telegraphMs:1000,
        waveDelay:145,
        dangerGain:15,
        pattern:['fried','fried','weakness','good','junk']
      },
      {
        id:'burgerShield',
        emoji:'🍔',
        name:'Burger Shield',
        warning:'บอสฟื้นโล่!',
        telegraphMs:1100,
        waveDelay:150,
        dangerGain:12,
        shieldRegen:true,
        pattern:['burger','junk','good','weakness']
      }
    ]
  };

  const MINI_MISSIONS = [
    {
      id:'green-3',
      icon:'🥦',
      title:'เก็บผัก 3 ชิ้น',
      type:'collect_group',
      group:'green',
      target:3,
      reward:'shield'
    },
    {
      id:'protein-3',
      icon:'🐟',
      title:'เก็บโปรตีน 3 ชิ้น',
      type:'collect_group',
      group:'protein',
      target:3,
      reward:'hero'
    },
    {
      id:'fruit-3',
      icon:'🍎',
      title:'เก็บผลไม้ 3 ชิ้น',
      type:'collect_group',
      group:'fruit',
      target:3,
      reward:'slow'
    },
    {
      id:'combo-8',
      icon:'⚡',
      title:'ทำ Combo x8',
      type:'combo',
      target:8,
      reward:'hero'
    }
  ];

  const DAILY_CHALLENGES = [
    {
      id:'daily-green',
      title:'เก็บผัก 6 ชิ้น',
      group:'green',
      target:6
    },
    {
      id:'daily-fruit',
      title:'เก็บผลไม้ 6 ชิ้น',
      group:'fruit',
      target:6
    },
    {
      id:'daily-protein',
      title:'เก็บโปรตีน 5 ชิ้น',
      group:'protein',
      target:5
    },
    {
      id:'daily-clean',
      title:'พลาดไม่เกิน 3 ครั้ง',
      type:'max_miss',
      target:3
    }
  ];
    const BOSS_PATTERN_SCRIPT = {
    phase1: [
      {
        id: 'p1-teach-good',
        name: 'Good Food Test',
        speech: 'แยกอาหารดีให้ทัน!',
        warning: 'เก็บอาหารดี อย่าแตะขยะ',
        tokens: ['good', 'good', 'junk', 'weakness'],
        reward: 'hero',
        delay: 150
      },
      {
        id: 'p1-shield-check',
        name: 'Shield Check',
        speech: 'โล่ข้ายังแข็งแรง!',
        warning: 'เก็บผักเพื่อทำลายโล่',
        tokens: ['weakness', 'good', 'junk', 'weakness'],
        reward: 'shieldBreak',
        delay: 170
      }
    ],

    phase2: [
      {
        id: 'p2-junk-storm',
        name: 'Junk Storm',
        speech: 'พายุขยะมาแล้ว!',
        warning: 'หลบอาหารขยะ แล้วเก็บจุดอ่อน',
        tokens: ['junk', 'junk', 'good', 'weakness', 'junk'],
        reward: 'hero',
        delay: 135
      },
      {
        id: 'p2-soda-wave',
        name: 'Soda Wave',
        speech: 'น้ำอัดลมเด้งเร็ว!',
        warning: 'อย่าแตะน้ำอัดลม',
        tokens: ['soda', 'good', 'soda', 'weakness', 'junk'],
        reward: 'slow',
        delay: 125
      }
    ],

    phase3: [
      {
        id: 'p3-rage-mix',
        name: 'Rage Mix',
        speech: 'ข้าจะสับสนเจ้า!',
        warning: 'ดูให้ดี ก่อนแตะ',
        tokens: ['sweet', 'good', 'junk', 'weakness', 'fried', 'good'],
        reward: 'hero',
        delay: 115
      },
      {
        id: 'p3-burger-wall',
        name: 'Burger Wall',
        speech: 'กำแพงเบอร์เกอร์!',
        warning: 'เก็บโปรตีนดีเพื่อสวนกลับ',
        tokens: ['burger', 'burger', 'weakness', 'good', 'junk'],
        reward: 'cleanBlast',
        delay: 130
      }
    ],

    final: [
      {
        id: 'final-hero-chance',
        name: 'Hero Chance',
        speech: 'นี่คือโอกาสสุดท้าย!',
        warning: 'เก็บผลไม้ แล้วใช้ HERO HIT',
        tokens: ['weakness', 'weakness', 'good', 'junk', 'weakness', 'good'],
        reward: 'hero',
        delay: 100
      },
      {
        id: 'final-chaos',
        name: 'Final Chaos',
        speech: 'ข้ายังไม่แพ้!',
        warning: 'หลบขยะ เก็บจุดอ่อนให้ไว',
        tokens: ['junk', 'soda', 'weakness', 'sweet', 'good', 'weakness', 'junk'],
        reward: 'shield',
        delay: 95
      }
    ]
  };

  const BOSS_IDENTITY = {
    shield: {
      id: 'shield-king',
      name: 'Junk King',
      title: 'ราชาอาหารขยะ',
      emoji: '👑🍔',
      color: '#facc15',
      bgClass: 'bossIdentityShield',
      intro: 'ข้าคือ Junk King! โล่ขยะของข้าไม่มีวันแตก!',
      weakness: 'ผักสีเขียว',
      speech: [
        'โล่ข้ายังแข็งแรง!',
        'อาหารดีทำอะไรข้าไม่ได้หรอก!',
        'ลองเก็บผักให้ทันสิ!'
      ],
      skillBias: ['burgerShield', 'friedWall'],
      tip: 'เก็บผักสีเขียวเพื่อทำให้โล่บอสอ่อนลง'
    },

    storm: {
      id: 'storm-soda',
      name: 'Soda Storm',
      title: 'พายุน้ำตาล',
      emoji: '🌪️🥤',
      color: '#38bdf8',
      bgClass: 'bossIdentityStorm',
      intro: 'พายุน้ำตาลมาแล้ว! อย่าแตะน้ำอัดลม!',
      weakness: 'โปรตีนดี',
      speech: [
        'น้ำอัดลมเด้งเร็ว!',
        'พายุขยะจะทำให้เจ้าสับสน!',
        'โปรตีนดีจะช่วยเจ้าได้ไหมนะ?'
      ],
      skillBias: ['sodaSplash', 'junkStorm'],
      tip: 'เก็บโปรตีนดีเพื่อสวนกลับพายุขยะ'
    },

    rage: {
      id: 'rage-sweet',
      name: 'Sugar Rage',
      title: 'คลั่งขนมหวาน',
      emoji: '😡🍩',
      color: '#fb7185',
      bgClass: 'bossIdentityRage',
      intro: 'ข้าจะหลอกตาด้วยขนมหวาน!',
      weakness: 'ผลไม้สด',
      speech: [
        'ขนมหวานมาแล้ว!',
        'ดูให้ดี ก่อนแตะ!',
        'เจ้าจะแยกออกไหมว่าอะไรดีจริง?'
      ],
      skillBias: ['sugarTrap', 'junkStorm'],
      tip: 'เก็บผลไม้สดเพื่อชาร์จพลัง HERO HIT'
    },

    final: {
      id: 'final-chaos',
      name: 'Junk King Final',
      title: 'ร่างสุดท้าย',
      emoji: '🔥👑',
      color: '#f97316',
      bgClass: 'bossIdentityFinal',
      intro: 'FINAL RUSH! ข้าจะไม่ยอมแพ้ง่าย ๆ!',
      weakness: 'ผลไม้สด + HERO HIT',
      speech: [
        'นี่คือร่างสุดท้าย!',
        'หลบขยะ แล้วเก็บจุดอ่อนให้ไว!',
        'ถ้า HERO HIT เต็ม เจ้าถึงจะชนะข้า!'
      ],
      skillBias: ['junkStorm', 'sodaSplash', 'sugarTrap', 'friedWall'],
      tip: 'เก็บจุดอ่อนให้ไว แล้วใช้ HERO HIT ปิดฉาก'
    }
  };

  const ARENA_HAZARDS = {
    lanes: [
      {
        id:'top',
        label:'เลนบน',
        icon:'⬆️',
        zone:'top',
        warning:'เลนบนมีขยะพุ่งมา!'
      },
      {
        id:'middle',
        label:'เลนกลาง',
        icon:'↔️',
        zone:'middle',
        warning:'เลนกลางอันตราย!'
      },
      {
        id:'bottom',
        label:'เลนล่าง',
        icon:'⬇️',
        zone:'bottom',
        warning:'เลนล่างมีอาหารขยะ!'
      }
    ],

    schedule: {
      phase1Every: 18000,
      phase2Every: 13500,
      phase3Every: 10500,
      finalEvery: 7800
    },

    durationMs: {
      easy: 3600,
      normal: 4200,
      hard: 4800,
      challenge: 5200
    }
  };

  const TARGET_VARIANTS = {
    tricky: [
      {
        emoji: '🧃',
        label: 'น้ำผลไม้หวาน',
        kind: 'junk',
        group: 'sweetDrink',
        penalty: 1,
        tip: 'น้ำผลไม้กล่องบางชนิดมีน้ำตาลสูง ควรดูฉลากก่อนดื่ม',
        lesson: 'ดูฉลากน้ำตาล'
      },
      {
        emoji: '🥗',
        label: 'สลัดผัก',
        kind: 'good',
        group: 'green',
        dmg: 13,
        charge: 9,
        tip: 'สลัดผักเป็นอาหารดี แต่ควรระวังน้ำสลัดหวานหรือมันมาก',
        lesson: 'ผักดี แต่ดูน้ำสลัดด้วย'
      },
      {
        emoji: '🍞',
        label: 'ขนมปังโฮลวีต',
        kind: 'good',
        group: 'carb',
        dmg: 11,
        charge: 7,
        tip: 'โฮลวีตให้พลังงานและใยอาหารมากกว่าขนมปังขาว',
        lesson: 'เลือกคาร์บดี'
      },
      {
        emoji: '🥣',
        label: 'ซีเรียลหวาน',
        kind: 'junk',
        group: 'sweet',
        penalty: 1,
        tip: 'ซีเรียลบางชนิดหวานมาก ควรเลือกแบบน้ำตาลน้อย',
        lesson: 'หวานซ่อนอยู่'
      },
      {
        emoji: '🍗',
        label: 'ไก่ทอด',
        kind: 'junk',
        group: 'fried',
        penalty: 1,
        tip: 'ไก่ทอดมีน้ำมันมาก กินบ่อยไม่ดีต่อสุขภาพ',
        lesson: 'ของทอดควรกินนาน ๆ ครั้ง'
      },
      {
        emoji: '🍳',
        label: 'ไข่ดาวน้ำมันเยอะ',
        kind: 'junk',
        group: 'fatty',
        penalty: 1,
        tip: 'ไข่เป็นโปรตีนดี แต่ถ้าใช้น้ำมันเยอะจะไม่ดีเท่าไข่ต้ม',
        lesson: 'วิธีปรุงสำคัญ'
      },
      {
        emoji: '🥔',
        label: 'มันต้ม',
        kind: 'good',
        group: 'carb',
        dmg: 10,
        charge: 7,
        tip: 'มันต้มให้พลังงาน ดีกว่ามันทอด',
        lesson: 'ต้มดีกว่าทอด'
      },
      {
        emoji: '🥜',
        label: 'ถั่วไม่เค็ม',
        kind: 'good',
        group: 'protein',
        dmg: 12,
        charge: 9,
        tip: 'ถั่วไม่เค็มเป็นโปรตีนจากพืชที่ดี',
        lesson: 'เลือกแบบไม่เค็ม'
      }
    ],

    bossWeakness: [
      {
        emoji: '🥦',
        label: 'ผักบอสแพ้',
        kind: 'good',
        group: 'green',
        dmg: 16,
        charge: 11,
        tip: 'ผักสีเขียวช่วยทำให้โล่บอสอ่อนลง',
        lesson: 'จุดอ่อน Phase 1'
      },
      {
        emoji: '🐟',
        label: 'โปรตีนสวนกลับ',
        kind: 'good',
        group: 'protein',
        dmg: 16,
        charge: 11,
        tip: 'โปรตีนดีช่วยให้ร่างกายแข็งแรงและสู้พายุขยะ',
        lesson: 'จุดอ่อน Phase 2'
      },
      {
        emoji: '🍎',
        label: 'ผลไม้ฮีโร่',
        kind: 'good',
        group: 'fruit',
        dmg: 15,
        charge: 12,
        tip: 'ผลไม้สดช่วยชาร์จพลัง HERO HIT',
        lesson: 'จุดอ่อน Final'
      }
    ]
  };

  const BOSS_MISSION_CHAIN = [
    {
      id: 'chain-green-shield',
      phaseKey: 'shield',
      icon: '🥦',
      title: 'ทำลายโล่ขยะ',
      instruction: 'เก็บผักสีเขียว 4 ชิ้น',
      type: 'collect_group',
      group: 'green',
      target: 4,
      reward: 'shieldBreak',
      rewardText: 'โล่บอสอ่อนลง!',
      coach: 'เก็บผักสีเขียวเพื่อทำให้โล่ Junk King แตก'
    },
    {
      id: 'chain-avoid-soda',
      phaseKey: 'storm',
      icon: '🥤',
      title: 'หลบพายุน้ำตาล',
      instruction: 'อย่าแตะน้ำอัดลม 10 วินาที',
      type: 'avoid_group_time',
      group: 'soda',
      target: 10,
      reward: 'slow',
      rewardText: 'ได้ Slow Time!',
      coach: 'อย่าแตะน้ำอัดลม แล้วรอจังหวะสวนกลับ'
    },
    {
      id: 'chain-protein-counter',
      phaseKey: 'storm',
      icon: '🐟',
      title: 'สวนกลับด้วยโปรตีน',
      instruction: 'เก็บโปรตีนดี 3 ชิ้น',
      type: 'collect_group',
      group: 'protein',
      target: 3,
      reward: 'hero',
      rewardText: 'HERO HIT +25%',
      coach: 'โปรตีนดีช่วยให้ Hero สวนกลับพายุขยะ'
    },
    {
      id: 'chain-fruit-focus',
      phaseKey: 'rage',
      icon: '🍎',
      title: 'โฟกัสผลไม้สด',
      instruction: 'เก็บผลไม้ 3 ชิ้น',
      type: 'collect_group',
      group: 'fruit',
      target: 3,
      reward: 'hero',
      rewardText: 'HERO HIT +30%',
      coach: 'ผลไม้สดช่วยชาร์จพลัง Hero'
    },
    {
      id: 'chain-combo-final',
      phaseKey: 'final',
      icon: '⚡',
      title: 'จังหวะปิดฉาก',
      instruction: 'ทำ Combo x8 หรือใช้ HERO HIT',
      type: 'combo_or_hero',
      target: 8,
      reward: 'finishBoost',
      rewardText: 'พลังปิดฉากพร้อม!',
      coach: 'รักษา Combo แล้วใช้ HERO HIT ปิดฉาก'
    }
  ];

  const COMEBACK_RULES = {
    mercyAfterMissStreak: 3,
    rescueAfterLives: 1,
    maxComebackPerRun: 4,
    calmWindowMs: 5200,
    forcedGoodCount: 3,
    forcedWeaknessCount: 2,

    rewards: {
      shield: {
        icon:'🛡️',
        label:'Rescue Shield',
        text:'ช่วยกันพลาด 1 ครั้ง'
      },
      focus: {
        icon:'🎯',
        label:'Focus Food',
        text:'อาหารดีจะออกมากขึ้น'
      },
      slow: {
        icon:'⏳',
        label:'Calm Time',
        text:'เวลาเป้าช้าลงชั่วคราว'
      },
      hero: {
        icon:'🦸',
        label:'Hero Boost',
        text:'HERO HIT เพิ่มเล็กน้อย'
      }
    }
  };

  const STAR_GOALS = {
    easy: {
      one: {
        score:120,
        acc:50,
        bossHpPct:65,
        text:'ชนะใจตัวเอง: เก็บอาหารดีให้ได้หลายชิ้น'
      },
      two: {
        score:180,
        acc:65,
        bossHpPct:35,
        text:'ฮีโร่พร้อมสู้: ลด HP บอสให้ต่ำกว่า 35%'
      },
      three: {
        score:230,
        acc:80,
        maxMiss:4,
        text:'สุดยอดฮีโร่: แม่นยำ 80% และพลาดไม่เกิน 4'
      }
    },

    normal: {
      one: {
        score:150,
        acc:55,
        bossHpPct:70,
        text:'เริ่มปราบบอส: เก็บอาหารดีและทำคะแนนให้ถึง 150'
      },
      two: {
        score:240,
        acc:70,
        bossHpPct:40,
        text:'ปราบบอสได้ดี: ลด HP บอสให้ต่ำกว่า 40%'
      },
      three: {
        score:320,
        acc:85,
        maxMiss:3,
        text:'ฮีโร่ 3 ดาว: แม่นยำ 85% และพลาดไม่เกิน 3'
      }
    },

    hard: {
      one: {
        score:180,
        acc:60,
        bossHpPct:75,
        text:'ผ่านด่านยาก: ทำคะแนนให้ถึง 180'
      },
      two: {
        score:300,
        acc:74,
        bossHpPct:42,
        text:'สวนกลับเก่ง: ลด HP บอสให้ต่ำกว่า 42%'
      },
      three: {
        score:400,
        acc:88,
        maxMiss:3,
        text:'เทพอาหารดี: แม่นยำ 88% และพลาดไม่เกิน 3'
      }
    },

    challenge: {
      one: {
        score:220,
        acc:62,
        bossHpPct:78,
        text:'ท้าทายเริ่มต้น: ทำคะแนนให้ถึง 220'
      },
      two: {
        score:360,
        acc:76,
        bossHpPct:45,
        text:'ผู้ท้าชิงบอส: ลด HP บอสให้ต่ำกว่า 45%'
      },
      three: {
        score:480,
        acc:90,
        maxMiss:2,
        text:'ตำนาน HeroHealth: แม่นยำ 90% และพลาดไม่เกิน 2'
      }
    }
  };
    const TOUCH_SAFETY = {
    mobileMinTargetSize: 54,
    mobilePreferredTargetSize: 60,
    desktopMinTargetSize: 48,

    hitSlopMobile: 14,
    hitSlopDesktop: 8,

    minGapMobile: 12,
    minGapDesktop: 8,

    topSafeMobile: 190,
    bottomSafeMobile: 122,
    topSafeDesktop: 150,
    bottomSafeDesktop: 100,

    avoidHudSamplePoints: [
      [0.50, 0.50],
      [0.20, 0.50],
      [0.80, 0.50],
      [0.50, 0.20],
      [0.50, 0.80]
    ]
  };

  const QA_LOCK = {
    requiredDom: [
      'gjSoloBossApp',
      'introScreen',
      'gameScreen',
      'summaryScreen',
      'gameWorld',
      'targetLayer',
      'fxLayer',
      'bossAvatar',
      'bossHpFill',
      'heroHitBtn',
      'summaryBackBtn',

      'gjBossSpeech',
      'gjWarningFlash',
      'gjMiniMission',
      'gjBossNamePlate',
      'gjDangerLane',
      'gjLearningTip',
      'gjMissionChain',
      'gjComebackBanner',
      'gjBossIntro',
      'gjStarGoalHud',
      'gjTouchDebug',

      'gjArenaThemeHud',
      'gjBonusRoundBanner',
      'gjSoundBtn',
      'gjComboJuiceBanner',
      'gjMicroTutorial',
      'gjTutorialSkipHint',
      'gjDifficultyBadge'
    ],

    minSafeArenaHeight: 120,
    maxBlockedTargets: 0,
    maxMissingDom: 0,
    requireExitHref: true,
    requireTouchReady: true,
    requireFlowReady: true,
    requireBossSystems: true
  };

  const REPLAY_VARIETY = {
    enabled: true,

    arenaThemes: [
      {
        id: 'market',
        name: 'ตลาดอาหาร',
        emoji: '🛒',
        intro: 'วันนี้ Junk King ซ่อนตัวในตลาดอาหาร!',
        goodBias: ['green', 'fruit'],
        junkBias: ['sweet', 'fried'],
        hazardBias: 'middle'
      },
      {
        id: 'school',
        name: 'โรงอาหารโรงเรียน',
        emoji: '🏫',
        intro: 'ศึกนี้เกิดในโรงอาหารโรงเรียน!',
        goodBias: ['protein', 'carb'],
        junkBias: ['soda', 'sweet'],
        hazardBias: 'bottom'
      },
      {
        id: 'festival',
        name: 'งานเทศกาลขนม',
        emoji: '🎪',
        intro: 'งานเทศกาลเต็มไปด้วยอาหารหลอก!',
        goodBias: ['fruit'],
        junkBias: ['sweet', 'fried', 'fatty'],
        hazardBias: 'top'
      },
      {
        id: 'space',
        name: 'ครัวอวกาศ',
        emoji: '🚀',
        intro: 'Junk King หนีไปครัวอวกาศแล้ว!',
        goodBias: ['protein', 'green'],
        junkBias: ['soda', 'fatty'],
        hazardBias: 'middle'
      }
    ],

    trickSets: [
      {
        id: 'sugar-watch',
        name: 'Sugar Watch',
        focus: 'ดูน้ำตาลซ่อนอยู่',
        groups: ['sweetDrink', 'sweet', 'soda']
      },
      {
        id: 'fried-watch',
        name: 'Fried Watch',
        focus: 'ระวังของทอด',
        groups: ['fried', 'fatty']
      },
      {
        id: 'smart-choice',
        name: 'Smart Choice',
        focus: 'อาหารดีขึ้นกับวิธีปรุง',
        groups: ['green', 'protein', 'carb']
      }
    ],

    bonusRoundEvery: 42,
    bonusRoundDurationMs: 8500
  };

  const BOSS_DRAMA = {
    enabled: true,

    comboReact: [
      { at: 5, text: 'หืม... Combo เริ่มมาแล้วเหรอ!' },
      { at: 10, text: 'หยุดนะ! เจ้าเก็บอาหารดีเร็วเกินไปแล้ว!' },
      { at: 15, text: 'เป็นไปไม่ได้! Combo สูงขนาดนี้!' }
    ],

    heroReady: [
      'ไม่นะ... HERO HIT พร้อมแล้ว!',
      'อย่าใช้พลังอาหารดีนะ!',
      'ข้าต้องรีบเรียกขยะมาขวาง!'
    ],

    lowHp: [
      { pct: 55, text: 'โล่ของข้าเริ่มสั่นแล้ว!' },
      { pct: 35, text: 'ข้ายังไม่แพ้หรอก!' },
      { pct: 18, text: 'หยุดนะ! ข้าใกล้หมดพลังแล้ว!' }
    ],

    mistakeTaunt: [
      'ฮ่า ๆ แตะผิดแล้ว!',
      'อาหารขยะหลอกเจ้าได้!',
      'ดูให้ดีสิ Hero!'
    ],

    comebackRespect: [
      'อะไรกัน! กลับมาได้อีกเหรอ!',
      'Hero ยังไม่ยอมแพ้จริง ๆ!',
      'ข้าประมาทเจ้าไม่ได้แล้ว!'
    ],

    finalFear: [
      'ไม่นะ... Final Rush แล้ว!',
      'ข้าจะใช้พลังสุดท้าย!',
      'ถ้า HERO HIT โดน ข้าแพ้แน่!'
    ]
  };

  const REWARD_LOOP = {
    enabled: true,

    storageKeys: {
      profile: 'GJ_SOLO_BOSS_PROFILE',
      bossBook: 'GJ_SOLO_BOSS_BOSS_BOOK',
      badgeBook: 'GJ_SOLO_BOSS_BADGE_BOOK',
      lastChallenge: 'GJ_SOLO_BOSS_NEXT_CHALLENGE'
    },

    ranks: [
      { id:'rookie', label:'Rookie Hero', emoji:'🌱', minScore:0 },
      { id:'clean', label:'Clean Hero', emoji:'🧼', minScore:160 },
      { id:'smart', label:'Smart Picker', emoji:'🎯', minScore:260 },
      { id:'boss', label:'Boss Breaker', emoji:'👑', minScore:360 },
      { id:'legend', label:'Nutrition Legend', emoji:'🏆', minScore:480 }
    ],

    badges: [
      {
        id:'first_win',
        emoji:'👑',
        title:'First Boss Breaker',
        desc:'ชนะ Junk King ครั้งแรก',
        test:s => !!s.win
      },
      {
        id:'three_star',
        emoji:'⭐⭐⭐',
        title:'Three Star Hero',
        desc:'ได้ 3 ดาว',
        test:s => Number(s.starGoal?.starsEarned || 0) >= 3
      },
      {
        id:'combo_15',
        emoji:'⚡',
        title:'Combo Master',
        desc:'ทำ Combo สูงสุด 15+',
        test:s => Number(s.bestCombo || 0) >= 15
      },
      {
        id:'clean_player',
        emoji:'🌟',
        title:'Clean Player',
        desc:'พลาดไม่เกิน 2 ครั้ง',
        test:s => Number(s.miss || 0) <= 2
      },
      {
        id:'green_hero',
        emoji:'🥦',
        title:'Green Hero',
        desc:'เก็บผักได้เยอะ',
        test:s => Number(s.greenHits || 0) >= 8
      },
      {
        id:'protein_power',
        emoji:'🐟',
        title:'Protein Power',
        desc:'เก็บโปรตีนดีได้เยอะ',
        test:s => Number(s.proteinHits || 0) >= 6
      },
      {
        id:'fruit_fighter',
        emoji:'🍎',
        title:'Fruit Fighter',
        desc:'เก็บผลไม้ได้เยอะ',
        test:s => Number(s.fruitHits || 0) >= 5
      },
      {
        id:'comeback_hero',
        emoji:'💚',
        title:'Comeback Hero',
        desc:'กลับมาได้หลังพลาด',
        test:s => Number(s.comeback?.used || 0) > 0
      },
      {
        id:'hazard_safe',
        emoji:'🚧',
        title:'Safe Lane Hero',
        desc:'เก็บอาหารดีในเลนปลอดภัยได้หลายครั้ง',
        test:s => Number(s.arenaHazard?.safeHits || 0) >= 5
      },
      {
        id:'mission_chain',
        emoji:'🎯',
        title:'Mission Chainer',
        desc:'ทำ Boss Mission Chain สำเร็จหลายขั้น',
        test:s => Number(s.missionChain?.completedIds?.length || 0) >= 3
      }
    ],

    nextChallenges: [
      {
        id:'next-clean',
        emoji:'🌟',
        title:'รอบหน้า: พลาดไม่เกิน 3',
        desc:'เล่นรอบหน้าโดยพยายามแตะอาหารขยะให้น้อยลง',
        goal:'miss_lte_3'
      },
      {
        id:'next-combo',
        emoji:'⚡',
        title:'รอบหน้า: Combo x10',
        desc:'แตะอาหารดีต่อเนื่องให้ได้ Combo สูง',
        goal:'combo_10'
      },
      {
        id:'next-fruit',
        emoji:'🍎',
        title:'รอบหน้า: เก็บผลไม้ 6 ชิ้น',
        desc:'ฝึกเลือกผลไม้สดแทนขนมหวาน',
        goal:'fruit_6'
      },
      {
        id:'next-green',
        emoji:'🥦',
        title:'รอบหน้า: เก็บผัก 8 ชิ้น',
        desc:'ช่วยทำลายโล่บอสให้เร็วขึ้น',
        goal:'green_8'
      },
      {
        id:'next-hero',
        emoji:'🦸',
        title:'รอบหน้า: ใช้ HERO HIT ให้ทัน',
        desc:'ชาร์จพลังอาหารดีแล้วใช้ปิดฉาก',
        goal:'hero_hit'
      }
    ]
  };

  const POLISH_JUICE = {
    enabled: true,

    sound: {
      enabled: true,
      mutedByDefault: false,
      volume: 0.18,
      cooldownMs: 45
    },

    haptic: {
      enabled: true,
      cooldownMs: 70,
      patterns: {
        good: [18],
        bad: [35],
        hero: [28, 30, 42],
        win: [35, 35, 55],
        shield: [18, 20, 18],
        bonus: [22, 24, 22]
      }
    },

    screen: {
      shakeEnabled: true,
      maxShakeMs: 360
    },

    comboJuice: {
      pulseAt: [5, 10, 15, 20],
      bannerMs: 820
    }
  };

  const MICRO_TUTORIAL = {
    enabled: true,
    storageKey: 'GJ_SOLO_BOSS_TUTORIAL_DONE',
    firstRunOnly: false,
    minGapMs: 5200,
    maxTipsPerRun: 9,

    tips: {
      firstGood: {
        id: 'firstGood',
        icon: '✅',
        title: 'แตะอาหารดี',
        text: 'แตะผัก ผลไม้ โปรตีนดี เพื่อโจมตีบอส'
      },
      firstJunk: {
        id: 'firstJunk',
        icon: '⚠️',
        title: 'อย่าแตะอาหารขยะ',
        text: 'น้ำอัดลม ขนมหวาน ของทอด ทำให้เสียหัวใจ'
      },
      heroReady: {
        id: 'heroReady',
        icon: '🦸',
        title: 'HERO HIT พร้อมแล้ว',
        text: 'กดปุ่มเหลืองเพื่อโจมตีบอสแรง ๆ'
      },
      shield: {
        id: 'shield',
        icon: '🛡️',
        title: 'โล่ช่วยกันพลาด',
        text: 'ถ้ามี Shield แตะพลาดครั้งหนึ่งจะไม่เสียหัวใจ'
      },
      mission: {
        id: 'mission',
        icon: '🎯',
        title: 'ทำภารกิจบอส',
        text: 'ดูแถบภารกิจด้านบน แล้วเก็บอาหารตามที่กำหนด'
      },
      dangerLane: {
        id: 'dangerLane',
        icon: '🚧',
        title: 'ระวังเลนอันตราย',
        text: 'ถ้าเลนสีแดงขึ้น ให้เลือกเป้านอกเลนก่อน'
      },
      finalRush: {
        id: 'finalRush',
        icon: '🔥',
        title: 'FINAL RUSH',
        text: 'เก็บจุดอ่อนให้ไว แล้วใช้ HERO HIT ปิดฉาก'
      },
      combo: {
        id: 'combo',
        icon: '⚡',
        title: 'Combo ช่วยชาร์จพลัง',
        text: 'แตะอาหารดีต่อเนื่อง HERO HIT จะพร้อมเร็วขึ้น'
      },
      trick: {
        id: 'trick',
        icon: '💡',
        title: 'อาหารหลอก',
        text: 'อาหารบางอย่างดูดี แต่ต้องดูน้ำตาล น้ำมัน และวิธีปรุง'
      }
    }
  };

  const DIFFICULTY_PERSONALITY = {
    easy: {
      id: 'easy',
      label: 'Easy Coach',
      emoji: '🌱',
      intro: 'โหมดสอนเล่น: อาหารดีจะออกชัดขึ้น และบอสใจดีขึ้น',
      coachStyle: 'สอนเยอะขึ้น',
      goodBias: 0.16,
      junkBias: -0.08,
      trickyBias: -0.08,
      weaknessBias: 0.14,
      hazardBias: -0.06,
      bossPatternSpeed: 1.18,
      bossDramaTone: 'coach',
      comebackBoost: 1.18,
      tutorialBoost: true,
      bonusChanceBoost: 0.006
    },

    normal: {
      id: 'normal',
      label: 'Normal Adventure',
      emoji: '🎮',
      intro: 'โหมดผจญภัย: สมดุลระหว่างสนุก ท้าทาย และเรียนรู้',
      coachStyle: 'สมดุล',
      goodBias: 0.04,
      junkBias: 0,
      trickyBias: 0,
      weaknessBias: 0.04,
      hazardBias: 0,
      bossPatternSpeed: 1,
      bossDramaTone: 'normal',
      comebackBoost: 1,
      tutorialBoost: false,
      bonusChanceBoost: 0
    },

    hard: {
      id: 'hard',
      label: 'Hard Storm',
      emoji: '🌪️',
      intro: 'โหมดพายุขยะ: บอสจะใช้เลนอันตรายและอาหารหลอกมากขึ้น',
      coachStyle: 'เตือนสั้น',
      goodBias: -0.02,
      junkBias: 0.06,
      trickyBias: 0.08,
      weaknessBias: 0.02,
      hazardBias: 0.08,
      bossPatternSpeed: 0.88,
      bossDramaTone: 'taunt',
      comebackBoost: 0.88,
      tutorialBoost: false,
      bonusChanceBoost: -0.002
    },

    challenge: {
      id: 'challenge',
      label: 'Challenge Chaos',
      emoji: '🔥',
      intro: 'โหมดท้าทาย: บอสเร็วขึ้น หลอกมากขึ้น และ Final Rush ดุขึ้น',
      coachStyle: 'น้อยแต่คม',
      goodBias: -0.04,
      junkBias: 0.10,
      trickyBias: 0.14,
      weaknessBias: 0,
      hazardBias: 0.12,
      bossPatternSpeed: 0.78,
      bossDramaTone: 'bossy',
      comebackBoost: 0.72,
      tutorialBoost: false,
      bonusChanceBoost: -0.004
    }
  };

  const FINAL_BALANCE = {
    enabled: true,

    maxJunkStreak: {
      easy: 1,
      normal: 2,
      hard: 3,
      challenge: 3
    },

    missGraceMs: {
      easy: 1400,
      normal: 1050,
      hard: 780,
      challenge: 620
    },

    openingGraceSec: {
      easy: 16,
      normal: 12,
      hard: 8,
      challenge: 6
    },

    dangerReliefAt: {
      easy: 56,
      normal: 68,
      hard: 78,
      challenge: 86
    },

    bossProgressHelpEverySec: {
      easy: 18,
      normal: 24,
      hard: 32,
      challenge: 42
    },

    lateGameRushSecLeft: {
      easy: 36,
      normal: 32,
      hard: 28,
      challenge: 24
    },

    maxLifeLossPerWindow: 2,
    lifeLossWindowMs: 3800,
    overlayQuietMsAfterHit: 900
  };

  const BALANCE_TUNING = {
    enabled: true,

    fightPacing: {
      easy: {
        minPlaySecBeforeWin: 62,
        idealWinSec: 88,
        finalRushMinSec: 18,
        maxBossDamagePerHit: 26,
        maxHeroHitDamage: 70,
        bossHpFloorBeforeFinal: 42
      },
      normal: {
        minPlaySecBeforeWin: 78,
        idealWinSec: 110,
        finalRushMinSec: 22,
        maxBossDamagePerHit: 30,
        maxHeroHitDamage: 82,
        bossHpFloorBeforeFinal: 48
      },
      hard: {
        minPlaySecBeforeWin: 92,
        idealWinSec: 128,
        finalRushMinSec: 26,
        maxBossDamagePerHit: 34,
        maxHeroHitDamage: 96,
        bossHpFloorBeforeFinal: 56
      },
      challenge: {
        minPlaySecBeforeWin: 105,
        idealWinSec: 142,
        finalRushMinSec: 30,
        maxBossDamagePerHit: 38,
        maxHeroHitDamage: 110,
        bossHpFloorBeforeFinal: 64
      }
    },

    spawnPacing: {
      easy: {
        minSpawnMs: 760,
        maxTargets: 5,
        powerChance: 0.070,
        weaknessChanceBoost: 0.08
      },
      normal: {
        minSpawnMs: 660,
        maxTargets: 6,
        powerChance: 0.060,
        weaknessChanceBoost: 0.04
      },
      hard: {
        minSpawnMs: 580,
        maxTargets: 7,
        powerChance: 0.052,
        weaknessChanceBoost: 0.02
      },
      challenge: {
        minSpawnMs: 520,
        maxTargets: 8,
        powerChance: 0.046,
        weaknessChanceBoost: 0
      }
    },

    scorePacing: {
      goodBase: {
        easy: 9,
        normal: 10,
        hard: 11,
        challenge: 12
      },
      junkPenaltyScore: {
        easy: 4,
        normal: 6,
        hard: 7,
        challenge: 8
      },
      missedGoodPenaltyScore: {
        easy: 2,
        normal: 4,
        hard: 5,
        challenge: 6
      },
      comboBonusCap: {
        easy: 7,
        normal: 9,
        hard: 11,
        challenge: 13
      }
    },

    finalRush: {
      forceWeaknessOnEnter: {
        easy: 4,
        normal: 3,
        hard: 3,
        challenge: 2
      },
      spawnBoost: {
        easy: 0.84,
        normal: 0.78,
        hard: 0.74,
        challenge: 0.70
      },
      junkChanceAdd: {
        easy: 0.02,
        normal: 0.04,
        hard: 0.06,
        challenge: 0.08
      }
    }
  };

  const CHILD_POLISH = {
    enabled: true,

    summary: {
      maxBadgesShown: 5,
      maxRewardBadgesShown: 4,
      maxTextLineLength: 58,
      preferSimpleWords: true
    },

    coach: {
      maxLength: 58,
      rotateMinMs: 2800,
      simpleMode: true
    },

    endMessages: {
      win: [
        'เก่งมาก! ชนะบอสอาหารขยะแล้ว',
        'สุดยอด Hero! เลือกอาหารดีได้เยี่ยม',
        'วันนี้ปราบ Junk King สำเร็จแล้ว'
      ],
      lose: [
        'ไม่เป็นไร รอบหน้าทำได้ดีขึ้นแน่',
        'ฝึกอีกนิด Hero จะเก่งขึ้นมาก',
        'วันนี้ได้เรียนรู้แล้ว รอบหน้าลุยใหม่'
      ]
    },

    summaryTips: {
      good: [
        'เลือกอาหารดีต่อเนื่อง ช่วยให้ชนะบอสเร็วขึ้น',
        'ผัก ผลไม้ และโปรตีนดี ช่วยชาร์จพลัง Hero',
        'ดูจุดอ่อนบอส แล้วเก็บอาหารให้ตรงเป้าหมาย'
      ],
      caution: [
        'น้ำอัดลม ขนมหวาน และของทอด ทำให้เสียหัวใจ',
        'อาหารบางอย่างดูดี แต่ต้องดูน้ำตาลและน้ำมันด้วย',
        'ถ้าเลนแดงขึ้น ให้เลือกเป้านอกเลนก่อน'
      ],
      next: [
        'รอบหน้าลองพลาดให้น้อยลง',
        'รอบหน้าลองทำ Combo ให้สูงขึ้น',
        'รอบหน้าลองใช้ HERO HIT ตอน Final Rush'
      ]
    },

    shortLabels: {
      score: 'คะแนน',
      good: 'อาหารดี',
      miss: 'พลาด',
      accuracy: 'แม่นยำ',
      combo: 'Combo',
      best: 'สถิติดีสุด',
      next: 'รอบหน้า'
    }
  };

  const POWER_UPS = [
    {
      id:'shield',
      emoji:'🛡️',
      label:'Shield',
      type:'shield'
    },
    {
      id:'slow',
      emoji:'⏳',
      label:'Slow Time',
      type:'slow'
    },
    {
      id:'cleanBlast',
      emoji:'✨',
      label:'Clean Blast',
      type:'cleanBlast'
    },
    {
      id:'heart',
      emoji:'💚',
      label:'Heart',
      type:'heart'
    }
  ];

  const STORAGE_LAST_SUMMARY = 'HHA_LAST_SUMMARY:goodjunk';
  const STORAGE_LAST_GENERIC = 'HHA_LAST_SUMMARY';
    const state = {
    rng: null,

    bootStarted: false,
    booted: false,
    startLocked: false,
    started: false,
    paused: false,
    ended: false,
    summaryRendered: false,
    safeExitReady: false,

    startTs: 0,
    elapsedSec: 0,
    lastFrame: 0,
    timeLeft: Number(CFG.time) || tune.time,

    score: 0,
    good: 0,
    miss: 0,
    missedGood: 0,
    junkHit: 0,
    combo: 0,
    bestCombo: 0,
    lives: tune.lives,

    bossHp: tune.bossHp,
    bossMaxHp: tune.bossHp,
    bossShield: true,
    phase: 1,
    finalRush: false,

    heroHit: 0,
    dangerMeter: 0,

    targets: new Map(),
    powerUps: new Map(),
    targetSeq: 0,
    powerSeq: 0,
    lastSpawn: 0,
    lastBossAttack: 0,
    bossSkillCooldownLock: false,

    phaseAnnounced: {
      shieldBreak: false,
      phase2: false,
      phase3: false,
      finalRush: false
    },

    activePower: {
      shield: 0,
      slowUntil: 0
    },

    powerUpsCollected: {
      shield: 0,
      slow: 0,
      cleanBlast: 0,
      heart: 0
    },

    greenHits: 0,
    proteinHits: 0,
    fruitHits: 0,

    daily: {
      challenge: null,
      progress: 0,
      done: false
    },

    balance: {
      streakGood: 0,
      streakMiss: 0,
      stress: 0,
      lastAssistAt: 0,
      calmUntil: 0,
      forcedGoodNext: 0,
      forcedWeaknessNext: 0,
      history: []
    },

    flow: {
      exitHref: '',
      detectedCooldownGate: false,
      detectedZone: false,
      isDirectGame: false,
      lastResolveAt: 0
    },

    calibration: {
      debugOverlay: false,
      safeTopAdjust: 0,
      safeBottomAdjust: 0,
      safeSideAdjust: 0,
      lastSafeRect: null,
      lastTapX: 0,
      lastTapY: 0,
      lastBlockedElement: ''
    },

    tapSafety: {
      blockedTapCount: 0,
      lastTargetTapAt: 0,
      lastEmptyTapAt: 0
    },

    singleHand: {
      enabled: true,
      side: 'right'
    },

    bossExperience: {
      introReady: false,
      introDone: false,
      speechReady: false,
      warningReady: false,
      miniMissionReady: false,
      currentMission: null,
      missionProgress: 0,
      missionTarget: 0,
      missionRewardReady: false,
      lastSpeechAt: 0,
      lastWarningAt: 0,
      lastMissionAt: 0,
      finalRushBoostGiven: false
    },

    pacing: {
      lastPhaseChangeSec: 0,
      lastHeroHitGainAt: 0,
      heroHitGainedThisSec: 0,
      softWinLocked: false,
      softWinUnlockedAt: 0,
      bossEnrageCount: 0,
      lastDangerDecayAt: 0,
      lastPacingToastAt: 0,
      minimumFightReached: false,
      phaseGate: {
        shield: false,
        phase2: false,
        phase3: false,
        final: false
      }
    },

    patternScript: {
      enabled: true,
      currentPhaseKey: 'phase1',
      index: {
        phase1: 0,
        phase2: 0,
        phase3: 0,
        final: 0
      },
      activePatternId: '',
      activePatternName: '',
      activePatternStartedAt: 0,
      activePatternSuccess: 0,
      activePatternMistake: 0,
      lastPatternAt: 0,
      patternCooldownMs: 2600,
      patternRewardGiven: false
    },

    bossIdentity: {
      enabled: true,
      currentKey: 'shield',
      lastKey: '',
      changedAt: 0,
      introShown: {
        shield: false,
        storm: false,
        rage: false,
        final: false
      },
      speechCount: {
        shield: 0,
        storm: 0,
        rage: 0,
        final: 0
      },
      lastIdentitySpeechAt: 0
    },

    arenaHazard: {
      enabled: true,
      active: false,
      activeLane: '',
      activeZone: '',
      activeLabel: '',
      activeIcon: '',
      startedAt: 0,
      endsAt: 0,
      lastHazardAt: 0,
      warningShownAt: 0,
      hitPenalty: 0,
      dodgedGood: 0,
      safeHits: 0,
      hazardCount: 0,
      lastSafeRewardAt: 0
    },

    learningTip: {
      enabled: true,
      lastTip: '',
      lastLesson: '',
      lastShownAt: 0,
      shownCount: 0,
      correctTricky: 0,
      missedTricky: 0,
      trickySeen: 0,
      weaknessSeen: 0
    },

    missionChain: {
      enabled: true,
      index: 0,
      active: null,
      progress: 0,
      target: 0,
      startedAt: 0,
      completedIds: [],
      failedIds: [],
      lastUpdateAt: 0,
      rewardGiven: false,
      avoidStartedAt: 0,
      avoidBroken: false,
      finishBoostReady: false,
      chainComplete: false
    },

    comeback: {
      enabled: true,
      used: 0,
      lastTriggeredAt: 0,
      lastReason: '',
      activeUntil: 0,
      streakMistakeAtTrigger: 0,
      rescueGiven: false,
      calmGiven: false,
      focusGiven: false,
      heroGiven: false,
      totalShieldGiven: 0,
      totalForcedGood: 0,
      totalForcedWeakness: 0,
      totalHeroBoost: 0,
      recoverySuccess: 0,
      recoveryFailed: 0,
      lastRecoveryCheckAt: 0
    },

    introGoal: {
      enabled: true,
      showing: false,
      countdown: 3,
      countdownTimer: 0,
      readyAt: 0,
      skipped: false,
      goalRead: false,
      starGoalShown: false,
      introStartedAt: 0,
      introEndedAt: 0
    },

    touchSafety: {
      enabled: true,
      hitSlop: 12,
      lastBlockedAt: 0,
      blockedBy: '',
      relocatedCount: 0,
      enlargedCount: 0,
      tapRescueCount: 0,
      lastTapTargetId: '',
      lastPointerX: 0,
      lastPointerY: 0,
      lastElementAtPoint: '',
      safeRectVersion: 0,
      lastSafeRectAt: 0,
      targetAuditCount: 0
    },

    qaLock: {
      enabled: true,
      lastRunAt: 0,
      ready: false,
      score: 0,
      status: 'not-run',
      errors: [],
      warnings: [],
      checks: {},
      snapshot: null
    },

    finalLock: {
      domReady: false,
      layoutReady: false,
      tapReady: false,
      flowReady: false,
      calibrationReady: false,
      singleHandReady: false,
      lastCheckAt: 0,
      warnings: [],
      errors: []
    },

    replayVariety: {
      enabled: true,
      runIndex: 0,
      arenaTheme: null,
      trickSet: null,
      bonusRoundActive: false,
      bonusRoundStartedAt: 0,
      bonusRoundEndsAt: 0,
      bonusRoundCount: 0,
      lastBonusAtSec: 0,
      themeAnnounced: false,
      trickAnnounced: false
    },

    bossDrama: {
      enabled: true,
      comboReacted: {},
      lowHpReacted: {},
      heroReadyReacted: false,
      lastTauntAt: 0,
      lastDramaAt: 0,
      finalFearShown: false,
      comebackReacted: false
    },

    rewardLoop: {
      enabled: true,
      profile: null,
      bossBook: null,
      badgeBook: null,
      earnedBadgesThisRun: [],
      rankBefore: null,
      rankAfter: null,
      personalBestBefore: 0,
      personalBestAfter: 0,
      isNewBest: false,
      nextChallenge: null,
      rewardSaved: false
    },

    polishJuice: {
      enabled: true,
      soundEnabled: true,
      muted: false,
      audioCtx: null,
      lastSoundAt: 0,
      lastHapticAt: 0,
      comboJuiceShown: {},
      lastShakeAt: 0,
      soundUnlocked: false
    },

    microTutorial: {
      enabled: true,
      doneBefore: false,
      shown: {},
      shownCount: 0,
      lastShownAt: 0,
      suppressedUntil: 0,
      firstGoodSeen: false,
      firstJunkSeen: false,
      heroReadyTipShown: false,
      dangerTipShown: false,
      finalTipShown: false,
      missionTipShown: false,
      trickTipShown: false
    },

    difficultyPersonality: {
      enabled: true,
      profile: null,
      introShown: false,
      adjustedGoodBias: 0,
      adjustedJunkBias: 0,
      adjustedTrickyBias: 0,
      adjustedWeaknessBias: 0,
      adjustedHazardBias: 0,
      bossPatternSpeed: 1,
      comebackBoost: 1
    },

    finalBalance: {
      enabled: true,
      junkStreak: 0,
      goodStreak: 0,
      lastGoodMissPenaltyAt: 0,
      lastLifeLossAt: 0,
      lifeLossInWindow: 0,
      lifeLossWindowStartedAt: 0,
      lastReliefAt: 0,
      lastBossProgressHelpAt: 0,
      lastOverlayQuietAt: 0,
      forcedReliefCount: 0,
      preventedLifeLoss: 0,
      preventedMissPenalty: 0,
      lateRushTriggered: false,
      openingGraceUsed: false
    },

    balanceTuning: {
      enabled: true,
      finalRushStartedAtSec: 0,
      finalRushMinMet: false,
      damageCappedCount: 0,
      heroDamageCappedCount: 0,
      winHeldCount: 0,
      lastBalanceNoteAt: 0,
      lastTuningSnapshot: null
    },

    childPolish: {
      enabled: true,
      lastCoachText: '',
      lastCoachAt: 0,
      simplifiedSummary: true,
      endMessage: '',
      summaryLevel: ''
    },

    runtimeGuard: {
      enabled: true,
      errors: [],
      warnings: [],
      lastErrorAt: 0,
      errorCount: 0,
      recoveredCount: 0,
      lastRecovery: ''
    }
  };

  state.rng = mulberry32(hashSeed(`${CFG.seed}:${CFG.pid}:${DIFF}:goodjunk-solo-boss`));

  const el = {};

  function $(id){
    return DOC.getElementById(id);
  }

  function recordRuntimeError(label, err){
    if(!state.runtimeGuard?.enabled) return;

    const item = {
      label: String(label || 'runtime'),
      message: String(err && (err.message || err) || ''),
      stack: String(err && err.stack || '').slice(0, 1200),
      ts: Date.now()
    };

    state.runtimeGuard.errors.push(item);

    if(state.runtimeGuard.errors.length > 20){
      state.runtimeGuard.errors.shift();
    }

    state.runtimeGuard.errorCount++;
    state.runtimeGuard.lastErrorAt = Date.now();

    console.warn('[GoodJunk Runtime]', label, err);
  }

  function recordRuntimeWarning(label, msg){
    if(!state.runtimeGuard?.enabled) return;

    const item = {
      label: String(label || 'warning'),
      message: String(msg || ''),
      ts: Date.now()
    };

    state.runtimeGuard.warnings.push(item);

    if(state.runtimeGuard.warnings.length > 20){
      state.runtimeGuard.warnings.shift();
    }
  }

  function recoverRuntime(reason = 'unknown'){
    state.runtimeGuard.recoveredCount++;
    state.runtimeGuard.lastRecovery = reason;

    try{
      cacheElements();
      ensureAllOverlayDom();
      refreshUiState();
      updateHud();
    }catch(err){
      recordRuntimeError('recoverRuntime', err);
    }
  }

  function ensureFxStyle(){
    if($('gjSoloBossMergedStyle')) return;

    const style = DOC.createElement('style');
    style.id = 'gjSoloBossMergedStyle';
    style.textContent = `
      :root{
        --gj-bg:#020617;
        --gj-panel:#0f172a;
        --gj-line:rgba(148,163,184,.18);
        --gj-text:#f8fafc;
        --gj-muted:#cbd5e1;
        --gj-good:#22c55e;
        --gj-bad:#ef4444;
        --gj-gold:#facc15;
        --gj-blue:#38bdf8;
        --gj-shadow:0 22px 70px rgba(0,0,0,.38);
        --sat:env(safe-area-inset-top,0px);
        --sar:env(safe-area-inset-right,0px);
        --sab:env(safe-area-inset-bottom,0px);
        --sal:env(safe-area-inset-left,0px);
      }

      *{
        box-sizing:border-box;
      }

      html,
      body{
        margin:0;
        width:100%;
        min-height:100%;
        overflow:hidden;
        background:
          radial-gradient(circle at 15% 0%, rgba(34,197,94,.16), transparent 28%),
          radial-gradient(circle at 85% 0%, rgba(56,189,248,.14), transparent 30%),
          linear-gradient(180deg,#020617 0%,#0f172a 55%,#111827 100%);
        color:var(--gj-text);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
        -webkit-tap-highlight-color:transparent;
        touch-action:none;
        overscroll-behavior:none;
      }

      body{
        min-height:100dvh;
      }

      button{
        font:inherit;
      }

      #gjSoloBossApp{
        width:100vw;
        height:100dvh;
        min-height:100dvh;
        overflow:hidden;
        position:relative;
        isolation:isolate;
      }

      .gjScreen{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        display:none;
      }

      .gjScreen.show{
        display:block;
      }

      #introScreen{
        display:none;
        place-items:center;
        padding:
          calc(18px + var(--sat))
          calc(18px + var(--sar))
          calc(18px + var(--sab))
          calc(18px + var(--sal));
        background:
          radial-gradient(circle at 50% 0%, rgba(250,204,21,.18), transparent 36%),
          linear-gradient(180deg,#020617,#0f172a);
      }

      #introScreen.show{
        display:grid;
      }

      .gjIntroCard{
        width:min(92vw,720px);
        border-radius:30px;
        border:1px solid rgba(148,163,184,.18);
        background:
          radial-gradient(circle at 50% -10%, rgba(34,197,94,.16), transparent 42%),
          linear-gradient(180deg,rgba(15,23,42,.94),rgba(2,6,23,.90));
        box-shadow:var(--gj-shadow);
        padding:24px;
        text-align:center;
      }

      .gjIntroIcon{
        font-size:clamp(68px,18vw,120px);
        line-height:1;
        filter:drop-shadow(0 22px 44px rgba(0,0,0,.42));
      }

      .gjIntroTitle{
        margin:10px 0 0;
        font-size:clamp(30px,8vw,54px);
        line-height:1.02;
        font-weight:1000;
        letter-spacing:-.045em;
      }

      .gjIntroSub{
        margin:10px auto 0;
        max-width:560px;
        color:#dbeafe;
        font-size:15px;
        line-height:1.6;
        font-weight:900;
      }

      .gjIntroActions{
        margin-top:18px;
        display:grid;
        grid-template-columns:1.2fr 1fr;
        gap:10px;
      }

      .gjBtn{
        min-height:52px;
        border:0;
        border-radius:18px;
        padding:0 16px;
        font:inherit;
        font-weight:1000;
        cursor:pointer;
        touch-action:manipulation;
      }

      .gjBtn.primary{
        background:linear-gradient(180deg,#86efac,#22c55e);
        color:#052e16;
      }

      .gjBtn.secondary{
        background:rgba(15,23,42,.82);
        color:#f8fafc;
        border:1px solid rgba(148,163,184,.20);
      }

      #gameScreen.show{
        display:block;
      }

      #gameWorld{
        position:absolute;
        inset:0;
        overflow:hidden;
        background:
          radial-gradient(circle at 50% 8%, rgba(250,204,21,.08), transparent 28%),
          radial-gradient(circle at 15% 92%, rgba(34,197,94,.10), transparent 32%),
          linear-gradient(180deg,#020617 0%,#0f172a 64%,#111827 100%);
      }

      #gameWorld.gjArenaShield,
      #gameWorld.gjArenaStorm,
      #gameWorld.gjArenaRage,
      #gameWorld.gjArenaFinal{
        transition:box-shadow .25s ease, filter .25s ease;
      }

      #gameWorld.gjArenaShield{
        box-shadow:inset 0 0 80px rgba(250,204,21,.10);
      }

      #gameWorld.gjArenaStorm{
        box-shadow:inset 0 0 90px rgba(56,189,248,.14);
      }

      #gameWorld.gjArenaRage{
        box-shadow:inset 0 0 100px rgba(239,68,68,.16);
      }

      #gameWorld.gjArenaFinal{
        box-shadow:inset 0 0 120px rgba(249,115,22,.20);
      }

      #topHud{
        position:absolute;
        left:0;
        right:0;
        top:0;
        z-index:70;
        padding:
          calc(10px + var(--sat))
          calc(10px + var(--sar))
          8px
          calc(10px + var(--sal));
        display:grid;
        gap:8px;
        pointer-events:none;
      }

      .gjHudRow{
        display:flex;
        gap:8px;
        align-items:center;
        justify-content:space-between;
        flex-wrap:wrap;
      }

      .gjPill{
        min-height:34px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        border-radius:999px;
        background:rgba(15,23,42,.78);
        border:1px solid rgba(148,163,184,.18);
        color:#e5e7eb;
        font-size:12px;
        font-weight:1000;
        box-shadow:0 12px 32px rgba(0,0,0,.20);
        backdrop-filter:blur(8px);
      }

      .gjBossBarWrap{
        width:min(92vw,760px);
        margin:0 auto;
        border-radius:999px;
        padding:5px;
        background:rgba(2,6,23,.78);
        border:1px solid rgba(148,163,184,.18);
        box-shadow:0 16px 40px rgba(0,0,0,.26);
      }

      .gjBossBar{
        height:18px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(15,23,42,.94);
      }

      #bossHpFill{
        height:100%;
        width:100%;
        border-radius:999px;
        background:linear-gradient(90deg,#22c55e,#facc15,#ef4444);
        transition:width .18s ease;
      }

      #bossHpText{
        text-align:center;
        margin-top:4px;
        color:#fde68a;
        font-size:11px;
        font-weight:1000;
      }

      #bossWrap{
        position:absolute;
        left:50%;
        top:130px;
        z-index:55;
        transform:translateX(-50%) scale(.68);
        transform-origin:center;
        pointer-events:none;
      }

      #bossAvatar{
        font-size:clamp(88px,20vw,150px);
        line-height:1;
        filter:drop-shadow(0 24px 46px rgba(0,0,0,.42));
      }

      #targetLayer,
      #powerLayer,
      #fxLayer{
        position:absolute;
        inset:0;
        z-index:80;
        pointer-events:none;
      }

      #powerLayer{
        z-index:88;
      }

      #fxLayer{
        z-index:120;
      }

      .gjTarget{
        position:absolute;
        transform:translate(-50%,-50%);
        width:58px;
        height:58px;
        border-radius:999px;
        display:grid;
        place-items:center;
        border:3px solid rgba(255,255,255,.20);
        background:rgba(255,255,255,.92);
        box-shadow:0 18px 36px rgba(0,0,0,.28);
        font-size:30px;
        cursor:pointer;
        pointer-events:auto;
        z-index:90;
        -webkit-tap-highlight-color:transparent;
        touch-action:manipulation;
        user-select:none;
        -webkit-user-select:none;
        outline:none;
      }

      .gjTarget.good{
        background:linear-gradient(180deg,#dcfce7,#86efac);
        color:#052e16;
      }

      .gjTarget.junk{
        background:linear-gradient(180deg,#fee2e2,#fb7185);
        color:#450a0a;
      }

      .gjTarget.power{
        background:linear-gradient(180deg,#dbeafe,#93c5fd);
        color:#082f49;
      }

      .gjTarget::after{
        content:"";
        position:absolute;
        inset:-10px;
        border-radius:999px;
        pointer-events:auto;
      }

      .gjTarget.gjTouchLarge::after{
        inset:-16px;
      }

      .gjTarget.gjTouchAudit{
        box-shadow:
          0 0 0 3px rgba(56,189,248,.36),
          0 18px 36px rgba(0,0,0,.28) !important;
      }

      .gjTarget.tricky{
        border-style:dashed !important;
        box-shadow:
          0 0 0 4px rgba(250,204,21,.10),
          0 0 26px rgba(250,204,21,.26),
          0 18px 36px rgba(0,0,0,.28) !important;
      }

      .gjTarget.weakness{
        border-color:rgba(250,204,21,.80) !important;
        box-shadow:
          0 0 0 4px rgba(250,204,21,.16),
          0 0 34px rgba(250,204,21,.42),
          0 18px 36px rgba(0,0,0,.28) !important;
      }

      .gjTarget .gjMiniLabel{
        position:absolute;
        left:50%;
        top:100%;
        transform:translateX(-50%);
        margin-top:4px;
        min-width:max-content;
        max-width:120px;
        padding:3px 7px;
        border-radius:999px;
        background:rgba(15,23,42,.82);
        border:1px solid rgba(148,163,184,.18);
        color:#f8fafc;
        font-size:9px;
        font-weight:1000;
        pointer-events:none;
        white-space:nowrap;
      }
            #bottomControls{
        position:absolute;
        left:0;
        right:0;
        bottom:0;
        z-index:95;
        padding:
          10px
          calc(10px + var(--sar))
          calc(10px + var(--sab))
          calc(10px + var(--sal));
        display:flex;
        gap:10px;
        align-items:center;
        justify-content:center;
        pointer-events:none;
      }

      #bottomControls button{
        pointer-events:auto;
      }

      #heroHitBtn,
      #gjHeroHitBigBtn{
        min-height:58px;
        min-width:180px;
        border:0;
        border-radius:22px;
        padding:0 18px;
        font:inherit;
        font-weight:1000;
        cursor:pointer;
        background:linear-gradient(180deg,#fef3c7,#facc15);
        color:#422006;
        box-shadow:0 18px 38px rgba(250,204,21,.22);
        touch-action:manipulation;
      }

      #heroHitBtn.ready,
      #gjHeroHitBigBtn.ready{
        animation:gjHeroReadyPulse .72s ease-in-out infinite alternate;
      }

      @keyframes gjHeroReadyPulse{
        from{ transform:scale(1); filter:brightness(1); }
        to{ transform:scale(1.05); filter:brightness(1.22); }
      }

      .gjControlBtn{
        min-height:48px;
        min-width:52px;
        border-radius:18px;
        border:1px solid rgba(148,163,184,.20);
        background:rgba(15,23,42,.84);
        color:#f8fafc;
        font:inherit;
        font-weight:1000;
        cursor:pointer;
        touch-action:manipulation;
      }

      #coachText{
        position:absolute;
        left:50%;
        bottom:148px;
        z-index:72;
        transform:translateX(-50%);
        max-width:min(86vw,520px);
        padding:9px 12px;
        border-radius:999px;
        background:rgba(15,23,42,.82);
        border:1px solid rgba(148,163,184,.18);
        color:#dbeafe;
        font-size:12px;
        font-weight:1000;
        text-align:center;
        pointer-events:none;
      }

      #gjDangerMeter{
        position:absolute;
        right:12px;
        top:46%;
        z-index:72;
        width:12px;
        height:150px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(15,23,42,.75);
        overflow:hidden;
        pointer-events:none;
      }

      #gjDangerMeterFill{
        position:absolute;
        left:0;
        right:0;
        bottom:0;
        height:0%;
        background:linear-gradient(180deg,#facc15,#ef4444);
        transition:height .18s ease;
      }

      .gjFx{
        position:absolute;
        transform:translate(-50%,-50%);
        z-index:130;
        pointer-events:none;
        color:#fff;
        font-weight:1000;
        text-shadow:0 10px 28px rgba(0,0,0,.44);
        animation:gjFxFloat .62s ease-out forwards;
      }

      .gjFx.good{ color:#86efac; }
      .gjFx.bad{ color:#fca5a5; }
      .gjFx.hero{ color:#fde68a; }

      @keyframes gjFxFloat{
        from{
          opacity:1;
          transform:translate(-50%,-50%) translateY(0) scale(1);
        }
        to{
          opacity:0;
          transform:translate(-50%,-50%) translateY(-28px) scale(1.08);
        }
      }

      #summaryScreen{
        position:absolute;
        inset:0;
        z-index:200;
        display:none;
        place-items:center;
        padding:
          calc(16px + var(--sat))
          calc(16px + var(--sar))
          calc(16px + var(--sab))
          calc(16px + var(--sal));
        background:rgba(2,6,23,.82);
        backdrop-filter:blur(10px);
      }

      #summaryScreen.show{
        display:grid;
      }

      .gjKidsSummary{
        width:min(94vw,720px);
        max-height:92dvh;
        overflow:auto;
        border-radius:30px;
        padding:18px;
        background:
          radial-gradient(circle at 50% -10%, rgba(250,204,21,.20), transparent 42%),
          linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.92));
        border:2px solid rgba(250,204,21,.28);
        box-shadow:0 26px 80px rgba(0,0,0,.45);
        color:#f8fafc;
        text-align:center;
      }

      .gjKidsSummaryIcon{
        font-size:clamp(54px,14vw,92px);
        line-height:1;
        filter:drop-shadow(0 18px 34px rgba(0,0,0,.38));
      }

      .gjKidsSummaryTitle{
        margin:8px 0 0;
        font-size:clamp(26px,7vw,44px);
        line-height:1.04;
        font-weight:1000;
        letter-spacing:-.035em;
      }

      .gjKidsSummarySub{
        margin:8px auto 0;
        max-width:560px;
        color:#dbeafe;
        font-size:14px;
        line-height:1.55;
        font-weight:900;
      }

      .gjKidsStars{
        margin:12px 0 0;
        font-size:clamp(28px,8vw,44px);
        letter-spacing:.05em;
        text-shadow:0 12px 30px rgba(250,204,21,.22);
      }

      .gjKidsActions{
        margin-top:16px;
        display:grid;
        grid-template-columns:1.2fr 1fr;
        gap:10px;
      }

      .gjKidsBtn{
        min-height:52px;
        border:none;
        border-radius:18px;
        padding:0 14px;
        font:inherit;
        font-weight:1000;
        cursor:pointer;
        touch-action:manipulation;
      }

      .gjKidsBtn.primary{
        background:linear-gradient(180deg,#86efac,#22c55e);
        color:#052e16;
        box-shadow:0 16px 34px rgba(34,197,94,.22);
      }

      .gjKidsBtn.secondary{
        background:rgba(15,23,42,.78);
        color:#f8fafc;
        border:1px solid rgba(148,163,184,.20);
      }

      #gjBossSpeech{
        position:absolute;
        left:50%;
        top:178px;
        z-index:78;
        transform:translateX(-50%);
        max-width:min(86vw,520px);
        padding:10px 14px;
        border-radius:18px;
        background:rgba(15,23,42,.92);
        border:2px solid rgba(250,204,21,.45);
        color:#fde68a;
        font-weight:1000;
        text-align:center;
        box-shadow:0 18px 42px rgba(0,0,0,.35);
        pointer-events:none;
        display:none;
      }

      #gjBossSpeech.show{
        display:block;
        animation:gjSpeechPop .28s ease-out;
      }

      @keyframes gjSpeechPop{
        from{
          opacity:0;
          transform:translateX(-50%) translateY(8px) scale(.94);
        }
        to{
          opacity:1;
          transform:translateX(-50%) translateY(0) scale(1);
        }
      }

      #gjWarningFlash{
        position:absolute;
        inset:0;
        z-index:74;
        pointer-events:none;
        background:rgba(239,68,68,.20);
        display:none;
      }

      #gjWarningFlash.show{
        display:block;
        animation:gjWarningBlink .45s ease-in-out 2;
      }

      @keyframes gjWarningBlink{
        0%,100%{ opacity:0; }
        45%{ opacity:1; }
      }

      #gjMiniMission{
        position:absolute;
        left:50%;
        top:92px;
        z-index:77;
        transform:translateX(-50%);
        width:min(88vw,430px);
        padding:8px 12px;
        border-radius:999px;
        background:rgba(2,6,23,.78);
        border:1px solid rgba(148,163,184,.22);
        color:#e5e7eb;
        font-size:12px;
        font-weight:1000;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        pointer-events:none;
        box-shadow:0 12px 32px rgba(0,0,0,.28);
      }

      #gjMiniMission b{
        color:#fde68a;
      }

      #gjMiniMissionFill{
        position:absolute;
        left:0;
        bottom:0;
        height:3px;
        width:0%;
        border-radius:999px;
        background:linear-gradient(90deg,#22c55e,#facc15);
      }

      .gjBossHitShake{
        animation:gjBossHitShake .26s ease-in-out;
      }

      @keyframes gjBossHitShake{
        0%,100%{ transform:translateX(-50%) scale(.68); }
        20%{ transform:translateX(calc(-50% - 8px)) scale(.70) rotate(-4deg); }
        45%{ transform:translateX(calc(-50% + 8px)) scale(.70) rotate(4deg); }
        70%{ transform:translateX(calc(-50% - 4px)) scale(.69) rotate(-2deg); }
      }

      .gjBossShieldPulse{
        animation:gjBossShieldPulse .7s ease-in-out;
      }

      @keyframes gjBossShieldPulse{
        0%{ filter:drop-shadow(0 0 0 rgba(96,165,250,0)); }
        50%{ filter:drop-shadow(0 0 28px rgba(96,165,250,.85)); }
        100%{ filter:drop-shadow(0 0 0 rgba(96,165,250,0)); }
      }

      .gjBossDefeatSpin{
        animation:gjBossDefeatSpin 1s ease-in-out forwards;
      }

      @keyframes gjBossDefeatSpin{
        0%{ transform:translateX(-50%) scale(.72) rotate(0deg); opacity:1; }
        40%{ transform:translateX(-50%) scale(.86) rotate(-10deg); opacity:1; }
        100%{ transform:translateX(-50%) scale(.25) rotate(28deg); opacity:0; }
      }

      #gjImpactFlash{
        position:absolute;
        inset:0;
        z-index:73;
        pointer-events:none;
        display:none;
        background:radial-gradient(circle at center, rgba(250,204,21,.28), transparent 48%);
      }

      #gjImpactFlash.show{
        display:block;
        animation:gjImpactFlash .36s ease-out;
      }

      @keyframes gjImpactFlash{
        from{ opacity:1; transform:scale(.92); }
        to{ opacity:0; transform:scale(1.12); }
      }

      #gjHeroCutIn{
        position:absolute;
        left:50%;
        top:50%;
        z-index:130;
        pointer-events:none;
        transform:translate(-50%,-50%);
        width:min(86vw,560px);
        padding:16px 18px;
        border-radius:26px;
        background:
          radial-gradient(circle at 20% 20%, rgba(250,204,21,.30), transparent 42%),
          linear-gradient(135deg, rgba(15,23,42,.96), rgba(2,6,23,.88));
        border:2px solid rgba(250,204,21,.55);
        color:#fef3c7;
        text-align:center;
        box-shadow:0 26px 80px rgba(0,0,0,.46);
        display:none;
      }

      #gjHeroCutIn.show{
        display:block;
        animation:gjHeroCutIn .75s ease-out forwards;
      }

      @keyframes gjHeroCutIn{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.82) rotate(-2deg); }
        20%{ opacity:1; transform:translate(-50%,-50%) scale(1.04) rotate(1deg); }
        70%{ opacity:1; transform:translate(-50%,-50%) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(1.08); }
      }

      .gjHeroCutInBig{
        font-size:clamp(30px,9vw,58px);
        line-height:1;
        font-weight:1000;
      }

      .gjHeroCutInSmall{
        margin-top:8px;
        font-size:clamp(13px,4vw,18px);
        font-weight:1000;
        color:#fde68a;
      }

      .gjShieldCrack{
        position:absolute;
        left:50%;
        top:145px;
        z-index:79;
        transform:translate(-50%,-50%);
        width:130px;
        height:130px;
        display:none;
        pointer-events:none;
      }

      .gjShieldCrack.show{
        display:block;
        animation:gjShieldCrack .65s ease-out forwards;
      }

      .gjShieldCrack::before{
        content:"🛡️";
        position:absolute;
        inset:0;
        display:grid;
        place-items:center;
        font-size:76px;
        filter:drop-shadow(0 20px 36px rgba(96,165,250,.40));
      }

      .gjShieldCrack::after{
        content:"⚡";
        position:absolute;
        inset:0;
        display:grid;
        place-items:center;
        font-size:54px;
        color:#fde68a;
        transform:rotate(-18deg);
      }

      @keyframes gjShieldCrack{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.65); }
        20%{ opacity:1; transform:translate(-50%,-50%) scale(1.08); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(1.35) rotate(12deg); }
      }

      .gjCleanBlastWave{
        position:absolute;
        left:50%;
        top:50%;
        z-index:120;
        width:40px;
        height:40px;
        border-radius:999px;
        border:4px solid rgba(134,239,172,.92);
        transform:translate(-50%,-50%);
        pointer-events:none;
        animation:gjCleanBlastWave .72s ease-out forwards;
      }

      @keyframes gjCleanBlastWave{
        from{
          opacity:1;
          width:40px;
          height:40px;
          background:rgba(34,197,94,.20);
        }
        to{
          opacity:0;
          width:120vw;
          height:120vw;
          background:rgba(34,197,94,0);
        }
      }

      .gjFinalRushGlow{
        animation:gjFinalRushGlow 1.2s ease-in-out infinite alternate;
      }

      @keyframes gjFinalRushGlow{
        from{ box-shadow:inset 0 0 0 rgba(250,204,21,0); }
        to{ box-shadow:inset 0 0 70px rgba(250,204,21,.20); }
      }

      #gjBossNamePlate{
        position:absolute;
        left:50%;
        top:116px;
        z-index:65;
        transform:translateX(-50%);
        min-width:min(82vw,340px);
        padding:8px 12px;
        border-radius:999px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        background:rgba(15,23,42,.78);
        border:1px solid rgba(148,163,184,.22);
        box-shadow:0 14px 34px rgba(0,0,0,.28);
        pointer-events:none;
        backdrop-filter:blur(8px);
      }

      #gjBossNameIcon{
        font-size:20px;
        line-height:1;
      }

      #gjBossNameText{
        font-size:13px;
        font-weight:1000;
        color:#f8fafc;
      }

      #gjBossNameWeakness{
        font-size:11px;
        font-weight:900;
        color:#fde68a;
      }

      .gjBossIdentityChange{
        animation:gjBossIdentityChange .52s ease-out;
      }

      @keyframes gjBossIdentityChange{
        0%{ transform:translateX(-50%) scale(.82); filter:brightness(1); }
        45%{ transform:translateX(-50%) scale(1.12); filter:brightness(1.28); }
        100%{ transform:translateX(-50%) scale(1); filter:brightness(1); }
      }

      .bossIdentityShield{ box-shadow:inset 0 0 80px rgba(250,204,21,.12); }
      .bossIdentityStorm{ box-shadow:inset 0 0 80px rgba(56,189,248,.14); }
      .bossIdentityRage{ box-shadow:inset 0 0 90px rgba(239,68,68,.16); }
      .bossIdentityFinal{ box-shadow:inset 0 0 110px rgba(249,115,22,.20); }

      #gjDangerLane{
        position:absolute;
        left:0;
        right:0;
        z-index:66;
        pointer-events:none;
        display:none;
        border-top:2px solid rgba(239,68,68,.70);
        border-bottom:2px solid rgba(239,68,68,.70);
        background:
          repeating-linear-gradient(
            45deg,
            rgba(239,68,68,.20) 0px,
            rgba(239,68,68,.20) 10px,
            rgba(127,29,29,.10) 10px,
            rgba(127,29,29,.10) 20px
          );
        box-shadow:
          inset 0 0 40px rgba(239,68,68,.25),
          0 0 30px rgba(239,68,68,.22);
        animation:gjDangerLanePulse .55s ease-in-out infinite alternate;
      }

      #gjDangerLane.show{ display:block; }
      #gjDangerLane.top{ top:165px; height:26%; }
      #gjDangerLane.middle{ top:38%; height:25%; }
      #gjDangerLane.bottom{ bottom:86px; height:25%; }

      @keyframes gjDangerLanePulse{
        from{ opacity:.56; filter:brightness(1); }
        to{ opacity:.86; filter:brightness(1.28); }
      }

      #gjHazardBanner{
        position:absolute;
        left:50%;
        top:138px;
        z-index:82;
        transform:translateX(-50%);
        max-width:min(88vw,520px);
        display:none;
        align-items:center;
        justify-content:center;
        gap:8px;
        padding:9px 13px;
        border-radius:999px;
        background:rgba(127,29,29,.88);
        border:2px solid rgba(248,113,113,.56);
        color:#fee2e2;
        font-size:13px;
        font-weight:1000;
        box-shadow:0 18px 44px rgba(0,0,0,.34);
        pointer-events:none;
      }

      #gjHazardBanner.show{
        display:flex;
        animation:gjHazardBannerIn .28s ease-out;
      }

      @keyframes gjHazardBannerIn{
        from{ opacity:0; transform:translateX(-50%) translateY(-8px) scale(.94); }
        to{ opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
      }

      .gjHazardSafeGlow{
        animation:gjHazardSafeGlow .5s ease-out;
      }

      @keyframes gjHazardSafeGlow{
        0%{ box-shadow:0 0 0 rgba(34,197,94,0); }
        50%{ box-shadow:0 0 36px rgba(34,197,94,.42); }
        100%{ box-shadow:0 0 0 rgba(34,197,94,0); }
      }

      #gjLearningTip{
        position:absolute;
        left:50%;
        bottom:46px;
        z-index:83;
        transform:translateX(-50%);
        max-width:min(88vw,560px);
        display:none;
        align-items:center;
        justify-content:center;
        gap:8px;
        padding:9px 13px;
        border-radius:18px;
        background:rgba(15,23,42,.92);
        border:1px solid rgba(56,189,248,.30);
        color:#dbeafe;
        font-size:12px;
        line-height:1.35;
        font-weight:900;
        box-shadow:0 16px 40px rgba(0,0,0,.34);
        pointer-events:none;
      }

      #gjLearningTip.show{
        display:flex;
        animation:gjLearningTipIn .22s ease-out;
      }

      @keyframes gjLearningTipIn{
        from{ opacity:0; transform:translateX(-50%) translateY(8px) scale(.96); }
        to{ opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
      }

      #gjMissionChain{
        position:absolute;
        left:50%;
        top:52px;
        z-index:84;
        transform:translateX(-50%);
        width:min(92vw,520px);
        padding:10px 12px;
        border-radius:20px;
        background:rgba(15,23,42,.88);
        border:1px solid rgba(250,204,21,.30);
        box-shadow:0 16px 42px rgba(0,0,0,.34);
        color:#f8fafc;
        pointer-events:none;
      }

      .gjMissionChainTop{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .gjMissionChainTitle{
        display:flex;
        align-items:center;
        gap:7px;
        min-width:0;
        font-size:12px;
        font-weight:1000;
        color:#fde68a;
      }

      .gjMissionChainTitle span:last-child{
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .gjMissionChainCount{
        font-size:12px;
        font-weight:1000;
        color:#dbeafe;
        white-space:nowrap;
      }

      .gjMissionChainInstruction{
        margin-top:5px;
        font-size:11px;
        line-height:1.35;
        color:#cbd5e1;
        font-weight:900;
      }

      .gjMissionChainTrack{
        margin-top:8px;
        height:7px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(2,6,23,.72);
        border:1px solid rgba(148,163,184,.16);
      }

      #gjMissionChainFill{
        height:100%;
        width:0%;
        border-radius:999px;
        background:linear-gradient(90deg,#22c55e,#facc15);
        transition:width .18s ease;
      }

      .gjMissionChainDone{
        animation:gjMissionChainDone .7s ease-out;
      }

      @keyframes gjMissionChainDone{
        0%{ transform:translateX(-50%) scale(1); filter:brightness(1); }
        45%{ transform:translateX(-50%) scale(1.05); filter:brightness(1.35); }
        100%{ transform:translateX(-50%) scale(1); filter:brightness(1); }
      }

      #gjComebackBanner{
        position:absolute;
        left:50%;
        top:50%;
        z-index:132;
        transform:translate(-50%,-50%);
        width:min(88vw,520px);
        display:none;
        padding:16px 18px;
        border-radius:26px;
        background:
          radial-gradient(circle at 20% 20%, rgba(34,197,94,.22), transparent 42%),
          linear-gradient(135deg, rgba(15,23,42,.96), rgba(2,6,23,.90));
        border:2px solid rgba(134,239,172,.46);
        box-shadow:0 26px 80px rgba(0,0,0,.46);
        color:#f8fafc;
        text-align:center;
        pointer-events:none;
      }

      #gjComebackBanner.show{
        display:block;
        animation:gjComebackIn .9s ease-out forwards;
      }

      @keyframes gjComebackIn{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.82); }
        18%{ opacity:1; transform:translate(-50%,-50%) scale(1.04); }
        70%{ opacity:1; transform:translate(-50%,-50%) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(1.06); }
      }

      .gjComebackIcon{
        font-size:clamp(42px,12vw,72px);
        line-height:1;
      }

      .gjComebackTitle{
        margin-top:8px;
        font-size:clamp(22px,6vw,34px);
        line-height:1.05;
        font-weight:1000;
        color:#bbf7d0;
      }

      .gjComebackText{
        margin-top:7px;
        color:#dbeafe;
        font-size:14px;
        line-height:1.45;
        font-weight:900;
      }

      #gjComebackPill{
        position:absolute;
        right:86px;
        bottom:84px;
        z-index:71;
        display:none;
        min-height:34px;
        padding:7px 10px;
        border-radius:999px;
        background:rgba(22,101,52,.88);
        border:1px solid rgba(134,239,172,.42);
        color:#dcfce7;
        font-size:11px;
        font-weight:1000;
        box-shadow:0 14px 34px rgba(0,0,0,.28);
        pointer-events:none;
      }

      #gjComebackPill.show{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
      }

      #gjBossIntro{
        position:absolute;
        inset:0;
        z-index:180;
        display:none;
        place-items:center;
        padding:18px;
        background:
          radial-gradient(circle at 50% 10%, rgba(250,204,21,.18), transparent 38%),
          radial-gradient(circle at 20% 90%, rgba(34,197,94,.12), transparent 34%),
          rgba(2,6,23,.88);
        backdrop-filter:blur(10px);
        color:#f8fafc;
      }

      #gjBossIntro.show{
        display:grid;
      }

      .gjBossIntroCard{
        width:min(94vw,760px);
        max-height:92dvh;
        overflow:auto;
        border-radius:32px;
        padding:20px;
        border:2px solid rgba(250,204,21,.30);
        background:
          radial-gradient(circle at 50% -8%, rgba(250,204,21,.22), transparent 44%),
          linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.92));
        box-shadow:0 30px 90px rgba(0,0,0,.52);
        text-align:center;
      }

      .gjBossIntroBoss{
        font-size:clamp(62px,18vw,118px);
        line-height:1;
        filter:drop-shadow(0 24px 48px rgba(0,0,0,.42));
        animation:gjBossIntroBoss 1.1s ease-in-out infinite alternate;
      }

      @keyframes gjBossIntroBoss{
        from{ transform:translateY(0) scale(1); }
        to{ transform:translateY(-5px) scale(1.04); }
      }

      .gjBossIntroKicker{
        margin-top:8px;
        color:#fde68a;
        font-size:13px;
        font-weight:1000;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .gjBossIntroTitle{
        margin:6px 0 0;
        font-size:clamp(28px,8vw,52px);
        line-height:1.02;
        font-weight:1000;
        letter-spacing:-.04em;
      }

      .gjBossIntroSub{
        margin:9px auto 0;
        max-width:600px;
        color:#dbeafe;
        font-size:14px;
        line-height:1.55;
        font-weight:900;
      }

      .gjStarGoalGrid{
        margin-top:16px;
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
      }

      .gjStarGoalCard{
        position:relative;
        overflow:hidden;
        min-height:132px;
        border-radius:22px;
        padding:14px 12px;
        text-align:left;
        background:rgba(15,23,42,.72);
        border:1px solid rgba(148,163,184,.18);
        box-shadow:0 14px 36px rgba(0,0,0,.22);
      }

      .gjStarGoalStars{
        position:relative;
        font-size:24px;
        line-height:1;
        letter-spacing:.03em;
      }

      .gjStarGoalTitle{
        position:relative;
        margin-top:9px;
        font-size:14px;
        font-weight:1000;
        color:#fde68a;
      }

      .gjStarGoalText{
        position:relative;
        margin-top:6px;
        color:#dbeafe;
        font-size:12px;
        line-height:1.45;
        font-weight:850;
      }

      .gjBossIntroActions{
        margin-top:16px;
        display:grid;
        grid-template-columns:1.2fr 1fr;
        gap:10px;
      }

      .gjBossIntroBtn{
        min-height:52px;
        border:none;
        border-radius:18px;
        padding:0 14px;
        font:inherit;
        font-weight:1000;
        cursor:pointer;
        touch-action:manipulation;
      }

      .gjBossIntroBtn.primary{
        background:linear-gradient(180deg,#86efac,#22c55e);
        color:#052e16;
        box-shadow:0 16px 34px rgba(34,197,94,.22);
      }

      .gjBossIntroBtn.secondary{
        background:rgba(15,23,42,.78);
        color:#f8fafc;
        border:1px solid rgba(148,163,184,.20);
      }

      .gjCountdownBubble{
        margin:15px auto 0;
        width:78px;
        height:78px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:linear-gradient(180deg,#fef3c7,#facc15);
        color:#422006;
        font-size:38px;
        font-weight:1000;
        box-shadow:0 20px 42px rgba(250,204,21,.25);
        animation:gjCountdownPop .72s ease-in-out infinite alternate;
      }

      @keyframes gjCountdownPop{
        from{ transform:scale(.96); }
        to{ transform:scale(1.06); }
      }

      #gjStarGoalHud{
        position:absolute;
        left:14px;
        bottom:84px;
        z-index:72;
        display:none;
        min-height:34px;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        border-radius:999px;
        background:rgba(15,23,42,.82);
        border:1px solid rgba(250,204,21,.26);
        color:#fde68a;
        font-size:11px;
        font-weight:1000;
        box-shadow:0 14px 34px rgba(0,0,0,.28);
        pointer-events:none;
      }

      #gjStarGoalHud.show{
        display:inline-flex;
      }

      #gjTouchDebug,
      #gjQaBadge{
        position:absolute;
        left:10px;
        top:10px;
        z-index:250;
        max-width:min(92vw,520px);
        display:none;
        padding:9px 11px;
        border-radius:14px;
        background:rgba(2,6,23,.88);
        border:1px solid rgba(56,189,248,.34);
        color:#dbeafe;
        font-size:11px;
        line-height:1.45;
        font-weight:800;
        white-space:pre-wrap;
        pointer-events:none;
      }

      #gjQaBadge{
        top:54px;
        border-color:rgba(148,163,184,.22);
      }

      #gjTouchDebug.show,
      #gjQaBadge.show{
        display:block;
      }

      #gjQaBadge.pass{
        border-color:rgba(34,197,94,.46);
        color:#dcfce7;
      }

      #gjQaBadge.warn{
        border-color:rgba(250,204,21,.52);
        color:#fef3c7;
      }

      #gjQaBadge.fail{
        border-color:rgba(239,68,68,.52);
        color:#fecaca;
      }

      .gjTapRescueFx{
        position:absolute;
        z-index:160;
        transform:translate(-50%,-50%);
        pointer-events:none;
        color:#bae6fd;
        font-size:13px;
        font-weight:1000;
        text-shadow:0 10px 28px rgba(0,0,0,.44);
        animation:gjTapRescueFx .55s ease-out forwards;
      }

      @keyframes gjTapRescueFx{
        from{
          opacity:1;
          transform:translate(-50%,-50%) translateY(0) scale(1);
        }
        to{
          opacity:0;
          transform:translate(-50%,-50%) translateY(-22px) scale(1.08);
        }
      }

      #gjArenaThemeHud{
        position:absolute;
        right:14px;
        bottom:124px;
        z-index:72;
        min-height:34px;
        display:none;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        border-radius:999px;
        background:rgba(15,23,42,.84);
        border:1px solid rgba(56,189,248,.28);
        color:#dbeafe;
        font-size:11px;
        font-weight:1000;
        box-shadow:0 14px 34px rgba(0,0,0,.28);
        pointer-events:none;
      }

      #gjArenaThemeHud.show{
        display:inline-flex;
      }

      #gjBonusRoundBanner{
        position:absolute;
        left:50%;
        top:50%;
        z-index:134;
        transform:translate(-50%,-50%);
        width:min(88vw,540px);
        display:none;
        padding:16px 18px;
        border-radius:28px;
        background:
          radial-gradient(circle at 50% 0%, rgba(250,204,21,.26), transparent 44%),
          linear-gradient(135deg, rgba(15,23,42,.96), rgba(2,6,23,.90));
        border:2px solid rgba(250,204,21,.55);
        box-shadow:0 28px 84px rgba(0,0,0,.48);
        color:#f8fafc;
        text-align:center;
        pointer-events:none;
      }

      #gjBonusRoundBanner.show{
        display:block;
        animation:gjBonusRoundPop .95s ease-out forwards;
      }

      @keyframes gjBonusRoundPop{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.82); }
        18%{ opacity:1; transform:translate(-50%,-50%) scale(1.05); }
        72%{ opacity:1; transform:translate(-50%,-50%) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(1.06); }
      }

      .gjBonusRoundBig{
        font-size:clamp(28px,8vw,52px);
        line-height:1.05;
        font-weight:1000;
        color:#fde68a;
      }

      .gjBonusRoundSmall{
        margin-top:8px;
        color:#dbeafe;
        font-size:14px;
        line-height:1.45;
        font-weight:900;
      }

      .gjThemeMarket{
        background:
          radial-gradient(circle at 15% 88%, rgba(34,197,94,.13), transparent 32%),
          radial-gradient(circle at 88% 18%, rgba(250,204,21,.12), transparent 34%),
          linear-gradient(180deg,#052e16 0%,#0f172a 58%,#111827 100%) !important;
      }

      .gjThemeSchool{
        background:
          radial-gradient(circle at 20% 14%, rgba(56,189,248,.12), transparent 32%),
          radial-gradient(circle at 80% 88%, rgba(250,204,21,.10), transparent 34%),
          linear-gradient(180deg,#082f49 0%,#0f172a 58%,#111827 100%) !important;
      }

      .gjThemeFestival{
        background:
          radial-gradient(circle at 15% 14%, rgba(251,113,133,.14), transparent 34%),
          radial-gradient(circle at 85% 20%, rgba(250,204,21,.16), transparent 34%),
          linear-gradient(180deg,#3b0764 0%,#0f172a 58%,#111827 100%) !important;
      }

      .gjThemeSpace{
        background:
          radial-gradient(circle at 20% 20%, rgba(96,165,250,.12), transparent 30%),
          radial-gradient(circle at 88% 14%, rgba(167,139,250,.14), transparent 34%),
          linear-gradient(180deg,#020617 0%,#111827 58%,#1e1b4b 100%) !important;
      }

      .gjBonusRoundActive #targetLayer .gjTarget.good{
        box-shadow:
          0 0 0 4px rgba(250,204,21,.18),
          0 0 36px rgba(250,204,21,.34),
          0 18px 36px rgba(0,0,0,.28) !important;
      }

      .gjScreenShake{
        animation:gjScreenShake .22s ease-in-out;
      }

      @keyframes gjScreenShake{
        0%,100%{ transform:translate3d(0,0,0); }
        20%{ transform:translate3d(-4px,2px,0); }
        40%{ transform:translate3d(4px,-2px,0); }
        60%{ transform:translate3d(-3px,-1px,0); }
        80%{ transform:translate3d(3px,1px,0); }
      }

      #gjComboJuiceBanner{
        position:absolute;
        left:50%;
        top:42%;
        z-index:133;
        transform:translate(-50%,-50%);
        display:none;
        min-width:min(82vw,380px);
        padding:14px 18px;
        border-radius:26px;
        background:
          radial-gradient(circle at 50% 0%, rgba(250,204,21,.32), transparent 48%),
          linear-gradient(135deg, rgba(15,23,42,.96), rgba(2,6,23,.90));
        border:2px solid rgba(250,204,21,.55);
        color:#fde68a;
        text-align:center;
        box-shadow:0 26px 80px rgba(0,0,0,.46);
        pointer-events:none;
      }

      #gjComboJuiceBanner.show{
        display:block;
        animation:gjComboJuicePop .78s ease-out forwards;
      }

      @keyframes gjComboJuicePop{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.78) rotate(-2deg); }
        22%{ opacity:1; transform:translate(-50%,-50%) scale(1.08) rotate(1deg); }
        70%{ opacity:1; transform:translate(-50%,-50%) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(1.06); }
      }

      .gjComboJuiceBig{
        font-size:clamp(30px,9vw,58px);
        line-height:1;
        font-weight:1000;
      }

      .gjComboJuiceSmall{
        margin-top:7px;
        font-size:clamp(12px,3.6vw,17px);
        color:#dbeafe;
        font-weight:900;
      }

      #gjSoundBtn{
        position:absolute;
        right:14px;
        top:calc(10px + env(safe-area-inset-top,0px));
        z-index:96;
        min-width:42px;
        min-height:34px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.22);
        background:rgba(15,23,42,.82);
        color:#f8fafc;
        font:inherit;
        font-size:14px;
        font-weight:1000;
        cursor:pointer;
        box-shadow:0 12px 28px rgba(0,0,0,.24);
        touch-action:manipulation;
      }

      .gjHitPulse{
        animation:gjHitPulse .20s ease-out;
      }

      @keyframes gjHitPulse{
        0%{ transform:translate(-50%,-50%) scale(1); }
        60%{ transform:translate(-50%,-50%) scale(1.16); }
        100%{ transform:translate(-50%,-50%) scale(1); }
      }

      .gjHeroButtonBlast{
        animation:gjHeroButtonBlast .42s ease-out;
      }

      @keyframes gjHeroButtonBlast{
        0%{ transform:scale(1); filter:brightness(1); }
        45%{ transform:scale(1.12); filter:brightness(1.35); }
        100%{ transform:scale(1); filter:brightness(1); }
      }

      #gjMicroTutorial{
        position:absolute;
        left:50%;
        top:62%;
        z-index:136;
        transform:translate(-50%,-50%);
        width:min(88vw,460px);
        display:none;
        padding:14px 16px;
        border-radius:24px;
        background:
          radial-gradient(circle at 12% 12%, rgba(56,189,248,.22), transparent 40%),
          linear-gradient(135deg, rgba(15,23,42,.96), rgba(2,6,23,.92));
        border:2px solid rgba(56,189,248,.42);
        box-shadow:0 26px 80px rgba(0,0,0,.46);
        color:#f8fafc;
        pointer-events:none;
      }

      #gjMicroTutorial.show{
        display:flex;
        align-items:center;
        gap:12px;
        animation:gjMicroTutorialIn .35s ease-out;
      }

      @keyframes gjMicroTutorialIn{
        from{
          opacity:0;
          transform:translate(-50%,-50%) translateY(10px) scale(.94);
        }
        to{
          opacity:1;
          transform:translate(-50%,-50%) translateY(0) scale(1);
        }
      }

      .gjMicroTutorialIcon{
        flex:0 0 auto;
        width:48px;
        height:48px;
        border-radius:18px;
        display:grid;
        place-items:center;
        background:rgba(56,189,248,.16);
        border:1px solid rgba(125,211,252,.30);
        font-size:28px;
      }

      .gjMicroTutorialBody{
        min-width:0;
        text-align:left;
      }

      .gjMicroTutorialTitle{
        color:#bae6fd;
        font-size:14px;
        font-weight:1000;
        line-height:1.2;
      }

      .gjMicroTutorialText{
        margin-top:4px;
        color:#dbeafe;
        font-size:12px;
        line-height:1.42;
        font-weight:850;
      }

      #gjTutorialSkipHint{
        position:absolute;
        left:50%;
        bottom:18px;
        z-index:137;
        transform:translateX(-50%);
        display:none;
        padding:6px 9px;
        border-radius:999px;
        background:rgba(15,23,42,.78);
        border:1px solid rgba(148,163,184,.18);
        color:#cbd5e1;
        font-size:10px;
        font-weight:900;
        pointer-events:none;
      }

      #gjTutorialSkipHint.show{
        display:block;
      }

      #gjDifficultyBadge{
        position:absolute;
        left:14px;
        bottom:124px;
        z-index:72;
        min-height:34px;
        display:none;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        border-radius:999px;
        background:rgba(15,23,42,.84);
        border:1px solid rgba(134,239,172,.28);
        color:#dcfce7;
        font-size:11px;
        font-weight:1000;
        box-shadow:0 14px 34px rgba(0,0,0,.28);
        pointer-events:none;
      }

      #gjDifficultyBadge.show{
        display:inline-flex;
      }

      .gjDiffEasy{
        filter:saturate(1.08) brightness(1.04);
      }

      .gjDiffNormal{
        filter:none;
      }

      .gjDiffHard{
        filter:saturate(1.12) contrast(1.04);
      }

      .gjDiffChallenge{
        filter:saturate(1.18) contrast(1.08);
      }

      .gjRewardShelf{
        margin-top:14px;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }

      .gjRewardPanel{
        border-radius:22px;
        padding:13px 12px;
        background:rgba(15,23,42,.68);
        border:1px solid rgba(148,163,184,.18);
        box-shadow:0 12px 34px rgba(0,0,0,.20);
        text-align:left;
      }

      .gjRewardPanelTitle{
        display:flex;
        align-items:center;
        gap:7px;
        color:#fde68a;
        font-size:13px;
        font-weight:1000;
      }

      .gjRewardPanelText{
        margin-top:6px;
        color:#dbeafe;
        font-size:12px;
        line-height:1.45;
        font-weight:850;
      }

      .gjNewBestRibbon{
        margin-top:12px;
        padding:10px 12px;
        border-radius:18px;
        background:linear-gradient(135deg,rgba(250,204,21,.22),rgba(34,197,94,.16));
        border:1px solid rgba(250,204,21,.36);
        color:#fef3c7;
        font-size:13px;
        font-weight:1000;
        text-align:center;
        box-shadow:0 14px 36px rgba(0,0,0,.24);
      }

      .gjKidsSummary.v840{
        text-align:center;
      }

      .gjKidsQuickResult{
        margin-top:12px;
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .gjKidsQuickItem{
        border-radius:18px;
        padding:10px 8px;
        background:rgba(15,23,42,.66);
        border:1px solid rgba(148,163,184,.16);
      }

      .gjKidsQuickIcon{
        font-size:24px;
        line-height:1;
      }

      .gjKidsQuickLabel{
        margin-top:5px;
        color:#cbd5e1;
        font-size:10px;
        font-weight:1000;
      }

      .gjKidsQuickValue{
        margin-top:3px;
        color:#f8fafc;
        font-size:20px;
        line-height:1;
        font-weight:1000;
      }

      .gjKidsMiniTipBox{
        margin-top:13px;
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:9px;
      }

      .gjKidsMiniTip{
        border-radius:20px;
        padding:12px 10px;
        background:rgba(2,6,23,.38);
        border:1px solid rgba(148,163,184,.16);
        text-align:left;
      }

      .gjKidsMiniTipIcon{
        font-size:25px;
        line-height:1;
      }

      .gjKidsMiniTipTitle{
        margin-top:7px;
        font-size:12px;
        font-weight:1000;
        color:#fde68a;
      }

      .gjKidsMiniTipText{
        margin-top:5px;
        font-size:11px;
        line-height:1.42;
        color:#dbeafe;
        font-weight:850;
      }

      .gjKidsSmallNote{
        margin-top:10px;
        color:#cbd5e1;
        font-size:11px;
        line-height:1.45;
        font-weight:850;
      }

      .gjKidsCompactBadges{
        margin-top:12px;
        display:flex;
        justify-content:center;
        flex-wrap:wrap;
        gap:6px;
      }

      .gjKidsCompactBadge{
        min-height:30px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:6px 9px;
        border-radius:999px;
        background:rgba(250,204,21,.11);
        border:1px solid rgba(250,204,21,.22);
        color:#fff7ed;
        font-size:11px;
        font-weight:1000;
      }

      .gjKidsCompactBadge.new{
        background:rgba(34,197,94,.13);
        border-color:rgba(134,239,172,.32);
        color:#dcfce7;
      }

      .gjSummarySoftDivider{
        height:1px;
        margin:14px 0 10px;
        background:linear-gradient(90deg,transparent,rgba(148,163,184,.24),transparent);
      }

      @media (max-width:720px){
        #bossWrap{
          top:118px;
          transform:translateX(-50%) scale(.55);
        }

        .gjPill{
          min-height:30px;
          padding:6px 8px;
          font-size:10px;
        }

        .gjBossBarWrap{
          width:min(94vw,760px);
        }

        #coachText{
          bottom:138px;
          font-size:10.5px;
          padding:7px 10px;
        }

        #gjDangerMeter{
          right:8px;
          height:124px;
        }

        #gjBossSpeech{
          top:154px;
          font-size:12px;
          padding:8px 11px;
        }

        #gjMiniMission{
          top:72px;
          font-size:10px;
          padding:7px 10px;
          width:min(88vw,360px);
        }

        .gjShieldCrack{
          top:128px;
          width:96px;
          height:96px;
        }

        .gjShieldCrack::before{ font-size:58px; }
        .gjShieldCrack::after{ font-size:42px; }

        #gjBossNamePlate{
          top:104px;
          min-width:min(86vw,320px);
          padding:6px 9px;
          gap:6px;
        }

        #gjBossNameIcon{ font-size:17px; }
        #gjBossNameText{ font-size:11px; }
        #gjBossNameWeakness{ font-size:9.5px; }

        #gjDangerLane.top{
          top:170px;
          height:23%;
        }

        #gjDangerLane.middle{
          top:41%;
          height:22%;
        }

        #gjDangerLane.bottom{
          bottom:92px;
          height:22%;
        }

        #gjHazardBanner{
          top:136px;
          font-size:11px;
          padding:7px 10px;
          max-width:92vw;
        }

        #gjLearningTip{
          bottom:38px;
          font-size:10.5px;
          padding:7px 10px;
          max-width:92vw;
        }

        .gjTarget .gjMiniLabel{
          font-size:8px;
          max-width:96px;
        }

        #gjMissionChain{
          top:42px;
          padding:8px 10px;
          width:min(94vw,390px);
          border-radius:18px;
        }

        .gjMissionChainTitle,
        .gjMissionChainCount{
          font-size:10.5px;
        }

        .gjMissionChainInstruction{
          font-size:9.8px;
        }

        #gjComebackBanner{
          width:min(92vw,390px);
          padding:14px;
          border-radius:22px;
        }

        #gjComebackPill{
          right:78px;
          bottom:84px;
          font-size:9.5px;
          min-height:30px;
          padding:6px 8px;
        }

        .gjBossIntroCard{
          border-radius:24px;
          padding:14px;
        }

        .gjStarGoalGrid{
          grid-template-columns:1fr;
        }

        .gjStarGoalCard{
          min-height:auto;
        }

        .gjBossIntroActions{
          grid-template-columns:1fr;
        }

        .gjCountdownBubble{
          width:62px;
          height:62px;
          font-size:30px;
        }

        #gjStarGoalHud{
          left:10px;
          bottom:80px;
          font-size:9.5px;
          min-height:30px;
          padding:6px 8px;
        }

        .gjTarget::after{
          inset:-14px;
        }

        .gjTarget.gjTouchLarge::after{
          inset:-20px;
        }

        #gjTouchDebug{
          top:calc(env(safe-area-inset-top,0px) + 8px);
          left:8px;
          font-size:10px;
        }

        #gjQaBadge{
          left:8px;
          top:calc(env(safe-area-inset-top,0px) + 46px);
          font-size:9.5px;
          max-width:88vw;
        }

        .gjKidsSummary{
          border-radius:24px;
          padding:14px;
          max-height:94dvh;
        }

        .gjKidsActions,
        .gjIntroActions,
        .gjBossIntroActions{
          grid-template-columns:1fr;
        }

        .gjKidsBtn,
        .gjBossIntroBtn,
        .gjBtn{
          width:100%;
        }

        #gjArenaThemeHud{
          right:10px;
          bottom:118px;
          font-size:9.5px;
          min-height:30px;
          padding:6px 8px;
        }

        #gjBonusRoundBanner{
          width:min(92vw,390px);
          padding:14px;
          border-radius:22px;
        }

        .gjBonusRoundSmall{
          font-size:12px;
        }

        #gjSoundBtn{
          right:10px;
          top:calc(8px + env(safe-area-inset-top,0px));
          min-height:30px;
          min-width:38px;
          font-size:12px;
        }

        #gjComboJuiceBanner{
          min-width:min(88vw,340px);
          padding:12px 14px;
          border-radius:22px;
        }

        #gjMicroTutorial{
          top:60%;
          width:min(92vw,360px);
          padding:12px 13px;
          border-radius:20px;
          gap:10px;
        }

        .gjMicroTutorialIcon{
          width:42px;
          height:42px;
          border-radius:15px;
          font-size:24px;
        }

        .gjMicroTutorialTitle{
          font-size:12.5px;
        }

        .gjMicroTutorialText{
          font-size:10.8px;
        }

        #gjTutorialSkipHint{
          bottom:12px;
          font-size:9px;
        }

        #gjDifficultyBadge{
          left:10px;
          bottom:118px;
          font-size:9.5px;
          min-height:30px;
          padding:6px 8px;
        }

        .gjRewardShelf{
          grid-template-columns:1fr;
        }

        .gjRewardPanelTitle{
          font-size:12px;
        }

        .gjRewardPanelText{
          font-size:11px;
        }

        .gjKidsQuickResult{
          gap:6px;
        }

        .gjKidsQuickItem{
          padding:8px 6px;
          border-radius:15px;
        }

        .gjKidsQuickIcon{
          font-size:21px;
        }

        .gjKidsQuickLabel{
          font-size:9px;
        }

        .gjKidsQuickValue{
          font-size:18px;
        }

        .gjKidsMiniTipBox{
          grid-template-columns:1fr;
        }

        .gjKidsMiniTip{
          padding:10px;
          border-radius:17px;
        }

        .gjKidsMiniTipText{
          font-size:10.5px;
        }

        .gjKidsCompactBadge{
          font-size:10px;
          min-height:28px;
          padding:5px 8px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureRequiredDom(){
    let app = $('gjSoloBossApp') || $('app') || DOC.querySelector('.gj-solo-boss-app');

    if(!app){
      app = DOC.createElement('main');
      app.id = 'gjSoloBossApp';
      DOC.body.appendChild(app);
    }

    el.app = app;

    app.innerHTML = `
      <section id="introScreen" class="gjScreen show">
        <div class="gjIntroCard">
          <div class="gjIntroIcon">👑🍔</div>
          <h1 class="gjIntroTitle">GoodJunk Solo Boss</h1>
          <p class="gjIntroSub">
            เก็บอาหารดี หลบอาหารขยะ ทำภารกิจ แล้วใช้ HERO HIT ปราบ Junk King
          </p>
          <div class="gjIntroActions">
            <button id="startBtn" class="gjBtn primary" type="button">เริ่ม Solo Boss</button>
            <button id="backBtnIntro" class="gjBtn secondary" type="button">กลับ Nutrition</button>
          </div>
        </div>
      </section>

      <section id="gameScreen" class="gjScreen">
        <div id="gameWorld">
          <div id="topHud">
            <div class="gjHudRow">
              <div class="gjPill">⏱️ <span id="timeText">0</span>s</div>
              <div class="gjPill">⭐ <span id="scoreText">0</span></div>
              <div class="gjPill">❤️ <span id="livesText">0</span></div>
              <div class="gjPill">🔥 x<span id="comboText">0</span></div>
            </div>

            <div class="gjBossBarWrap">
              <div class="gjBossBar">
                <div id="bossHpFill"></div>
              </div>
              <div id="bossHpText">Boss HP</div>
            </div>
          </div>

          <div id="bossWrap">
            <div id="bossAvatar">👑🍔</div>
          </div>

          <div id="targetLayer"></div>
          <div id="powerLayer"></div>
          <div id="fxLayer"></div>

          <div id="coachText">เก็บอาหารดีเพื่อทำลายโล่บอส</div>

          <div id="gjDangerMeter">
            <div id="gjDangerMeterFill"></div>
          </div>

          <div id="bottomControls">
            <button id="pauseBtn" class="gjControlBtn" type="button">⏸️</button>
            <button id="heroHitBtn" type="button">🦸 HERO HIT <span id="heroHitPct">0%</span></button>
            <button id="backBtn" class="gjControlBtn" type="button">↩</button>
          </div>
        </div>
      </section>

      <section id="summaryScreen"></section>
    `;

    cacheElements();
    ensureAllOverlayDom();
  }

  function cacheElements(){
    el.app = $('gjSoloBossApp') || el.app;
    el.introScreen = $('introScreen');
    el.gameScreen = $('gameScreen');
    el.summaryScreen = $('summaryScreen');
    el.gameWorld = $('gameWorld');
    el.targetLayer = $('targetLayer');
    el.powerLayer = $('powerLayer');
    el.fxLayer = $('fxLayer');

    el.startBtn = $('startBtn');
    el.backBtnIntro = $('backBtnIntro');
    el.pauseBtn = $('pauseBtn');
    el.backBtn = $('backBtn');
    el.heroHitBtn = $('heroHitBtn');

    el.timeText = $('timeText');
    el.scoreText = $('scoreText');
    el.livesText = $('livesText');
    el.comboText = $('comboText');
    el.heroHitPct = $('heroHitPct');

    el.bossWrap = $('bossWrap');
    el.bossAvatar = $('bossAvatar');
    el.bossHpFill = $('bossHpFill');
    el.bossHpText = $('bossHpText');

    el.coachText = $('coachText');
    el.dangerMeterFill = $('gjDangerMeterFill');

    el.summaryBackBtn = $('summaryBackBtn');
    el.summaryReplayBtn = $('summaryReplayBtn');
  }

  function ensureBossExperienceDom(){
    const app = el.app || DOC.body;

    if(!$('gjBossSpeech')){
      const s = DOC.createElement('div');
      s.id = 'gjBossSpeech';
      s.textContent = 'Junk King มาแล้ว!';
      app.appendChild(s);
    }

    if(!$('gjWarningFlash')){
      const w = DOC.createElement('div');
      w.id = 'gjWarningFlash';
      app.appendChild(w);
    }

    if(!$('gjMiniMission')){
      const m = DOC.createElement('div');
      m.id = 'gjMiniMission';
      m.innerHTML = `
        <span id="gjMiniMissionText">🎯 ภารกิจ: พร้อมเริ่ม</span>
        <b id="gjMiniMissionCount">0/0</b>
        <span id="gjMiniMissionFill"></span>
      `;
      app.appendChild(m);
    }

    state.bossExperience.speechReady = true;
    state.bossExperience.warningReady = true;
    state.bossExperience.miniMissionReady = true;
  }

  function ensureVisualFxDom(){
    const app = el.app || DOC.body;

    if(!$('gjImpactFlash')){
      const n = DOC.createElement('div');
      n.id = 'gjImpactFlash';
      app.appendChild(n);
    }

    if(!$('gjHeroCutIn')){
      const n = DOC.createElement('div');
      n.id = 'gjHeroCutIn';
      n.innerHTML = `
        <div class="gjHeroCutInBig">🦸 HERO HIT!</div>
        <div class="gjHeroCutInSmall">พลังอาหารดีโจมตีบอส</div>
      `;
      app.appendChild(n);
    }

    if(!DOC.querySelector('.gjShieldCrack')){
      const n = DOC.createElement('div');
      n.className = 'gjShieldCrack';
      app.appendChild(n);
    }
  }

  function ensureBossIdentityDom(){
    const app = el.app || DOC.body;

    if(!$('gjBossNamePlate')){
      const n = DOC.createElement('div');
      n.id = 'gjBossNamePlate';
      n.innerHTML = `
        <span id="gjBossNameIcon">👑🍔</span>
        <span id="gjBossNameText">Junk King</span>
        <span id="gjBossNameWeakness">จุดอ่อน: ผักสีเขียว</span>
      `;
      app.appendChild(n);
    }
  }

  function ensureArenaHazardDom(){
    const app = el.app || DOC.body;

    if(!$('gjDangerLane')){
      const lane = DOC.createElement('div');
      lane.id = 'gjDangerLane';
      app.appendChild(lane);
    }

    if(!$('gjHazardBanner')){
      const b = DOC.createElement('div');
      b.id = 'gjHazardBanner';
      b.innerHTML = `
        <span id="gjHazardIcon">⚠️</span>
        <span id="gjHazardText">เลนอันตราย!</span>
      `;
      app.appendChild(b);
    }
  }

  function ensureLearningTipDom(){
    const app = el.app || DOC.body;

    if(!$('gjLearningTip')){
      const n = DOC.createElement('div');
      n.id = 'gjLearningTip';
      n.innerHTML = `
        <span>💡</span>
        <span id="gjLearningTipText">เลือกอาหารดี แล้วหลบอาหารขยะ</span>
      `;
      app.appendChild(n);
    }
  }

  function ensureMissionChainDom(){
    const app = el.app || DOC.body;

    if(!$('gjMissionChain')){
      const n = DOC.createElement('div');
      n.id = 'gjMissionChain';
      n.innerHTML = `
        <div class="gjMissionChainTop">
          <div class="gjMissionChainTitle">
            <span id="gjMissionChainIcon">🎯</span>
            <span id="gjMissionChainTitle">ภารกิจบอส</span>
          </div>
          <div class="gjMissionChainCount" id="gjMissionChainCount">0/0</div>
        </div>
        <div class="gjMissionChainInstruction" id="gjMissionChainInstruction">เตรียมพร้อม</div>
        <div class="gjMissionChainTrack">
          <div id="gjMissionChainFill"></div>
        </div>
      `;
      app.appendChild(n);
    }
  }

  function ensureComebackDom(){
    const app = el.app || DOC.body;

    if(!$('gjComebackBanner')){
      const n = DOC.createElement('div');
      n.id = 'gjComebackBanner';
      n.innerHTML = `
        <div class="gjComebackIcon" id="gjComebackIcon">💚</div>
        <div class="gjComebackTitle" id="gjComebackTitle">Comeback!</div>
        <div class="gjComebackText" id="gjComebackText">Hero ได้โอกาสกลับมา</div>
      `;
      app.appendChild(n);
    }

    if(!$('gjComebackPill')){
      const p = DOC.createElement('div');
      p.id = 'gjComebackPill';
      p.innerHTML = `<span>💚</span><span id="gjComebackPillText">Comeback</span>`;
      app.appendChild(p);
    }
  }

  function ensureIntroGoalDom(){
    const app = el.app || DOC.body;

    if(!$('gjBossIntro')){
      const n = DOC.createElement('div');
      n.id = 'gjBossIntro';
      n.innerHTML = `
        <div class="gjBossIntroCard">
          <div class="gjBossIntroBoss" id="gjBossIntroBoss">👑🍔</div>
          <div class="gjBossIntroKicker">Solo Phase Boss</div>
          <h1 class="gjBossIntroTitle" id="gjBossIntroTitle">Junk King มาแล้ว!</h1>
          <div class="gjBossIntroSub" id="gjBossIntroSub">
            เก็บอาหารดี หลบอาหารขยะ ทำภารกิจ แล้วใช้ HERO HIT ปิดฉาก
          </div>

          <div class="gjStarGoalGrid" id="gjStarGoalGrid"></div>

          <div class="gjCountdownBubble" id="gjCountdownBubble" style="display:none;">3</div>

          <div class="gjBossIntroActions">
            <button id="gjIntroReadyBtn" class="gjBossIntroBtn primary" type="button">✅ พร้อมสู้</button>
            <button id="gjIntroSkipBtn" class="gjBossIntroBtn secondary" type="button">⏩ ข้าม Intro</button>
          </div>
        </div>
      `;
      app.appendChild(n);
    }

    if(!$('gjStarGoalHud')){
      const h = DOC.createElement('div');
      h.id = 'gjStarGoalHud';
      h.innerHTML = `<span>⭐</span><span id="gjStarGoalHudText">เป้าหมายดาว</span>`;
      app.appendChild(h);
    }
  }

  function ensureTouchDebugDom(){
    const app = el.app || DOC.body;

    if(!$('gjTouchDebug')){
      const n = DOC.createElement('div');
      n.id = 'gjTouchDebug';
      n.textContent = 'touch debug';
      app.appendChild(n);
    }
  }

  function ensureQaLockDom(){
    const app = el.app || DOC.body;

    if(!$('gjQaBadge')){
      const n = DOC.createElement('div');
      n.id = 'gjQaBadge';
      n.textContent = 'QA not run';
      app.appendChild(n);
    }
  }

  function ensureReplayVarietyDom(){
    const app = el.app || DOC.body;

    if(!$('gjArenaThemeHud')){
      const n = DOC.createElement('div');
      n.id = 'gjArenaThemeHud';
      n.innerHTML = `<span id="gjArenaThemeIcon">🛒</span><span id="gjArenaThemeText">Arena</span>`;
      app.appendChild(n);
    }

    if(!$('gjBonusRoundBanner')){
      const n = DOC.createElement('div');
      n.id = 'gjBonusRoundBanner';
      n.innerHTML = `
        <div class="gjBonusRoundBig">⭐ Bonus Round!</div>
        <div class="gjBonusRoundSmall">เก็บอาหารดีให้ไว ขยะจะน้อยลงชั่วคราว</div>
      `;
      app.appendChild(n);
    }
  }

  function ensurePolishJuiceDom(){
    const app = el.app || DOC.body;

    if(!$('gjComboJuiceBanner')){
      const n = DOC.createElement('div');
      n.id = 'gjComboJuiceBanner';
      n.innerHTML = `
        <div class="gjComboJuiceBig">COMBO!</div>
        <div class="gjComboJuiceSmall">แตะอาหารดีต่อเนื่อง</div>
      `;
      app.appendChild(n);
    }

    if(!$('gjSoundBtn')){
      const b = DOC.createElement('button');
      b.id = 'gjSoundBtn';
      b.type = 'button';
      b.textContent = '🔊';
      b.title = 'เปิด/ปิดเสียง';
      app.appendChild(b);
    }

    const btn = $('gjSoundBtn');
    if(btn){
      safeOnce(btn, '__gjSoundBound', () => {
        btn.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          toggleSound();
        });
      });
    }
  }

  function ensureMicroTutorialDom(){
    const app = el.app || DOC.body;

    if(!$('gjMicroTutorial')){
      const n = DOC.createElement('div');
      n.id = 'gjMicroTutorial';
      n.innerHTML = `
        <div class="gjMicroTutorialIcon" id="gjMicroTutorialIcon">💡</div>
        <div class="gjMicroTutorialBody">
          <div class="gjMicroTutorialTitle" id="gjMicroTutorialTitle">คำแนะนำ</div>
          <div class="gjMicroTutorialText" id="gjMicroTutorialText">แตะอาหารดีเพื่อเริ่มเล่น</div>
        </div>
      `;
      app.appendChild(n);
    }

    if(!$('gjTutorialSkipHint')){
      const h = DOC.createElement('div');
      h.id = 'gjTutorialSkipHint';
      h.textContent = 'คำแนะนำจะหายเอง ไม่ต้องกดปิด';
      app.appendChild(h);
    }
  }

  function ensureDifficultyPersonalityDom(){
    const app = el.app || DOC.body;

    if(!$('gjDifficultyBadge')){
      const n = DOC.createElement('div');
      n.id = 'gjDifficultyBadge';
      n.innerHTML = `<span id="gjDifficultyIcon">🎮</span><span id="gjDifficultyText">Normal Adventure</span>`;
      app.appendChild(n);
    }
  }

  function ensureAdvancedDom(){
    callMaybe(ensureReplayVarietyDom);
    callMaybe(ensurePolishJuiceDom);
    callMaybe(ensureMicroTutorialDom);
    callMaybe(ensureDifficultyPersonalityDom);
  }

  function ensureAllOverlayDom(){
    callMaybe(ensureBossExperienceDom);
    callMaybe(ensureVisualFxDom);
    callMaybe(ensureBossIdentityDom);
    callMaybe(ensureArenaHazardDom);
    callMaybe(ensureLearningTipDom);
    callMaybe(ensureMissionChainDom);
    callMaybe(ensureComebackDom);
    callMaybe(ensureIntroGoalDom);
    callMaybe(ensureTouchDebugDom);
    callMaybe(ensureQaLockDom);
    ensureAdvancedDom();
  }
    function showScreen(name){
    cacheElements();

    [el.introScreen, el.gameScreen, el.summaryScreen].forEach(n => {
      if(n) n.classList.remove('show');
    });

    if(name === 'intro' && el.introScreen) el.introScreen.classList.add('show');
    if(name === 'game' && el.gameScreen) el.gameScreen.classList.add('show');
    if(name === 'summary' && el.summaryScreen) el.summaryScreen.classList.add('show');
  }

  function setText(node, text){
    if(node) node.textContent = String(text ?? '');
  }

  function isMobileView(){
    return (
      String(CFG.view || '').toLowerCase() === 'mobile' ||
      WIN.innerWidth <= 720 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
    );
  }

  function worldRect(){
    const w = el.gameWorld || $('gameWorld') || DOC.body;
    return w.getBoundingClientRect();
  }

  function touchHitSlop(){
    return isMobileView()
      ? TOUCH_SAFETY.hitSlopMobile
      : TOUCH_SAFETY.hitSlopDesktop;
  }

  function minTargetSize(){
    return isMobileView()
      ? TOUCH_SAFETY.mobileMinTargetSize
      : TOUCH_SAFETY.desktopMinTargetSize;
  }

  function minTargetGap(){
    return isMobileView()
      ? TOUCH_SAFETY.minGapMobile
      : TOUCH_SAFETY.minGapDesktop;
  }

  function getSafeArenaRect(size = 60){
    const wr = worldRect();
    const vw = Math.max(320, wr.width || WIN.innerWidth);
    const vh = Math.max(420, wr.height || WIN.innerHeight);

    let safeLeft = 18 + state.calibration.safeSideAdjust;
    let safeRight = vw - 18 - state.calibration.safeSideAdjust;

    let safeTop = isMobileView()
      ? TOUCH_SAFETY.topSafeMobile
      : TOUCH_SAFETY.topSafeDesktop;

    let safeBottom = vh - (
      isMobileView()
        ? TOUCH_SAFETY.bottomSafeMobile
        : TOUCH_SAFETY.bottomSafeDesktop
    );

    safeTop += state.calibration.safeTopAdjust;
    safeBottom -= state.calibration.safeBottomAdjust;

    safeTop = clamp(safeTop, 86, vh - 180);
    safeBottom = clamp(safeBottom, safeTop + 120, vh - 74);

    const pad = Math.max(12, size / 2 + 4);

    const rect = {
      left: safeLeft + pad,
      right: safeRight - pad,
      top: safeTop + pad,
      bottom: safeBottom - pad,
      width: Math.max(80, safeRight - safeLeft - pad * 2),
      height: Math.max(100, safeBottom - safeTop - pad * 2)
    };

    state.calibration.lastSafeRect = rect;
    state.touchSafety.safeRectVersion++;
    state.touchSafety.lastSafeRectAt = Date.now();

    return rect;
  }

  function isSafeSpawnPoint(x, y, size){
    const safe = getSafeArenaRect(size);

    if(x < safe.left || x > safe.right || y < safe.top || y > safe.bottom){
      return false;
    }

    const boss = el.bossWrap || $('bossWrap');
    if(boss){
      const br = boss.getBoundingClientRect();
      const wr = worldRect();

      const bx = br.left - wr.left + br.width / 2;
      const by = br.top - wr.top + br.height / 2;
      const d = Math.sqrt((x - bx) ** 2 + (y - by) ** 2);

      if(d < 98) return false;
    }

    for(const item of state.targets.values()){
      const dx = x - item.x;
      const dy = y - item.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const gap = minTargetGap();

      if(dist < ((item.size + size) * .62 + gap)) return false;
    }

    return true;
  }

  function pickSafeSpawn(size = 58){
    const safe = getSafeArenaRect(size);

    for(let i = 0; i < 80; i++){
      const x = safe.left + state.rng() * Math.max(40, safe.right - safe.left);
      const y = safe.top + state.rng() * Math.max(40, safe.bottom - safe.top);

      if(isSafeSpawnPoint(x, y, size)){
        if(state.arenaHazard?.active && state.rng() < .55 && isInDangerLane(y)){
          continue;
        }

        return { x, y };
      }
    }

    return {
      x: (safe.left + safe.right) / 2,
      y: (safe.top + safe.bottom) / 2
    };
  }

  function raiseTargetNode(node){
    if(!node) return;

    node.style.zIndex = '90';
    node.style.pointerEvents = 'auto';
    node.style.touchAction = 'manipulation';
  }

  function describeElement(node){
    if(!node) return '';

    const id = node.id ? `#${node.id}` : '';
    const cls = String(node.className || '')
      .replace(/\s+/g, '.')
      .slice(0, 80);

    return `${node.tagName || 'node'}${id}${cls ? '.' + cls : ''}`;
  }

  function isGameControlElement(node){
    if(!node) return false;

    const id = String(node.id || '');
    const cls = String(node.className || '');

    return (
      id === 'gjHeroHitBigBtn' ||
      id === 'heroHitBtn' ||
      id === 'pauseBtn' ||
      id === 'backBtn' ||
      id === 'resumeBtn' ||
      id === 'summaryBackBtn' ||
      id === 'summaryReplayBtn' ||
      id === 'gjIntroReadyBtn' ||
      id === 'gjIntroSkipBtn' ||
      id === 'gjSoundBtn' ||
      cls.includes('gjKidsBtn') ||
      cls.includes('gjBossIntroBtn')
    );
  }

  function isHudOrOverlayElement(node){
    if(!node) return false;

    const id = String(node.id || '');
    const cls = String(node.className || '');

    return (
      id === 'gjMobileHud' ||
      id === 'gjDangerMeter' ||
      id === 'coachText' ||
      id === 'gjBossSpeech' ||
      id === 'gjMiniMission' ||
      id === 'gjBossNamePlate' ||
      id === 'gjHazardBanner' ||
      id === 'gjLearningTip' ||
      id === 'gjMissionChain' ||
      id === 'gjComebackPill' ||
      id === 'gjStarGoalHud' ||
      id === 'gjArenaThemeHud' ||
      id === 'gjDifficultyBadge' ||
      id === 'bossHpText' ||
      cls.includes('gjCompatCoach') ||
      cls.includes('gjMobilePill') ||
      cls.includes('gjBossBarWrap') ||
      cls.includes('gate-') ||
      cls.includes('gjKidsSummary')
    );
  }

  function isElementBlockingTarget(top, targetNode){
    if(!top) return false;
    if(targetNode && (top === targetNode || targetNode.contains(top))) return false;

    const tl = el.targetLayer || $('targetLayer');

    if(tl && tl.contains(top)) return false;

    if(isGameControlElement(top)) return true;
    if(isHudOrOverlayElement(top)) return true;

    return false;
  }

  function isTargetVisiblyBlocked(item){
    if(!item?.node) return false;

    const r = item.node.getBoundingClientRect();

    if(r.width <= 0 || r.height <= 0) return true;

    const points = TOUCH_SAFETY.avoidHudSamplePoints || [[.5,.5]];

    for(const [px, py] of points){
      const x = r.left + r.width * px;
      const y = r.top + r.height * py;

      if(x < 0 || y < 0 || x > WIN.innerWidth || y > WIN.innerHeight){
        return true;
      }

      const top = DOC.elementFromPoint(x, y);

      if(isElementBlockingTarget(top, item.node)){
        state.touchSafety.blockedBy = describeElement(top);
        state.touchSafety.lastBlockedAt = Date.now();
        return true;
      }
    }

    return false;
  }

  function nudgeTargetOutOfBlockedZone(item){
    if(!item?.node) return;

    const safe = getSafeArenaRect(item.size || 58);

    let changed = false;

    if(item.y < safe.top){
      item.y = safe.top;
      changed = true;
    }

    if(item.y > safe.bottom){
      item.y = safe.bottom;
      changed = true;
    }

    if(item.x < safe.left){
      item.x = safe.left;
      changed = true;
    }

    if(item.x > safe.right){
      item.x = safe.right;
      changed = true;
    }

    if(changed){
      item.node.style.left = `${item.x}px`;
      item.node.style.top = `${item.y}px`;
      state.touchSafety.relocatedCount++;
    }
  }

  function relocateTargetToSafePoint(item){
    if(!item?.node) return false;

    const p = pickSafeSpawn(item.size || minTargetSize());

    item.x = p.x;
    item.y = p.y;

    item.node.style.left = `${item.x}px`;
    item.node.style.top = `${item.y}px`;

    state.touchSafety.relocatedCount++;

    return true;
  }

  function auditOneTarget(item){
    if(!item?.node || state.ended) return;

    state.touchSafety.targetAuditCount++;

    raiseTargetNode(item.node);

    if(isTargetVisiblyBlocked(item)){
      relocateTargetToSafePoint(item);

      setTimeout(() => {
        if(isTargetVisiblyBlocked(item)){
          item.node.classList.add('gjTouchAudit');
        }else{
          item.node.classList.remove('gjTouchAudit');
        }
      }, 60);
    }else{
      item.node.classList.remove('gjTouchAudit');
    }
  }

  function auditTargets(){
    if(!state.touchSafety.enabled) return;

    for(const item of state.targets.values()){
      auditOneTarget(item);
    }
  }

  function fx(x, y, text, kind = 'good'){
    const layer = el.fxLayer || $('fxLayer') || DOC.body;

    const n = DOC.createElement('div');
    n.className = `gjFx ${kind}`;
    n.style.left = `${x}px`;
    n.style.top = `${y}px`;
    n.textContent = text;

    layer.appendChild(n);

    setTimeout(() => {
      safeRemoveNode(n);
    }, 700);
  }

  function toast(msg, ms = 1200){
    bossSpeak(msg, ms);
  }

  function impactFlash(){
    ensureVisualFxDom();

    const n = $('gjImpactFlash');
    if(!n) return;

    n.classList.remove('show');
    void n.offsetWidth;
    n.classList.add('show');

    clearTimeout(impactFlash._t);
    impactFlash._t = setTimeout(() => {
      n.classList.remove('show');
    }, 420);
  }

  function bossShake(kind = 'hit'){
    const boss = el.bossWrap || $('bossWrap') || $('bossAvatar');
    if(!boss) return;

    const cls = kind === 'shield' ? 'gjBossShieldPulse' : 'gjBossHitShake';

    boss.classList.remove(cls);
    void boss.offsetWidth;
    boss.classList.add(cls);

    clearTimeout(bossShake._t);
    bossShake._t = setTimeout(() => {
      boss.classList.remove(cls);
    }, 760);
  }

  function showShieldCrack(){
    ensureVisualFxDom();

    const n = DOC.querySelector('.gjShieldCrack');
    if(!n) return;

    n.classList.remove('show');
    void n.offsetWidth;
    n.classList.add('show');

    clearTimeout(showShieldCrack._t);
    showShieldCrack._t = setTimeout(() => {
      n.classList.remove('show');
    }, 720);
  }

  function showHeroCutIn(text = '🦸 HERO HIT!', sub = 'พลังอาหารดีโจมตีบอส'){
    ensureVisualFxDom();

    const n = $('gjHeroCutIn');
    if(!n) return;

    n.innerHTML = `
      <div class="gjHeroCutInBig">${text}</div>
      <div class="gjHeroCutInSmall">${sub}</div>
    `;

    n.classList.remove('show');
    void n.offsetWidth;
    n.classList.add('show');

    clearTimeout(showHeroCutIn._t);
    showHeroCutIn._t = setTimeout(() => {
      n.classList.remove('show');
    }, 820);
  }

  function cleanBlastWave(){
    const parent = el.gameWorld || el.app || DOC.body;

    const w = DOC.createElement('div');
    w.className = 'gjCleanBlastWave';
    parent.appendChild(w);

    setTimeout(() => {
      safeRemoveNode(w);
    }, 780);
  }

  function bossDefeatFx(){
    const boss = el.bossWrap || $('bossWrap') || $('bossAvatar');
    if(!boss) return;

    boss.classList.remove('gjBossDefeatSpin');
    void boss.offsetWidth;
    boss.classList.add('gjBossDefeatSpin');
  }

  function bossSpeak(text, ms = 1200){
    ensureBossExperienceDom();

    const box = $('gjBossSpeech');
    if(!box) return;

    box.textContent = String(text || '');
    box.classList.add('show');

    state.bossExperience.lastSpeechAt = Date.now();

    clearTimeout(bossSpeak._t);
    bossSpeak._t = setTimeout(() => {
      box.classList.remove('show');
    }, ms);
  }

  function warningFlash(ms = 900){
    ensureBossExperienceDom();

    const w = $('gjWarningFlash');
    if(!w) return;

    w.classList.remove('show');
    void w.offsetWidth;
    w.classList.add('show');

    state.bossExperience.lastWarningAt = Date.now();

    clearTimeout(warningFlash._t);
    warningFlash._t = setTimeout(() => {
      w.classList.remove('show');
    }, ms);
  }

  function safeFinalRushToast(text, ms = 1200){
    bossSpeak(text, ms);
  }

  function setArenaTheme(theme){
    const n = el.gameWorld || $('gameWorld') || DOC.body;

    n.classList.remove(
      'gjArenaShield',
      'gjArenaStorm',
      'gjArenaRage',
      'gjArenaFinal',
      'gjFinalRushGlow'
    );

    n.classList.add(
      theme === 'storm'
        ? 'gjArenaStorm'
        : theme === 'rage'
          ? 'gjArenaRage'
          : theme === 'final'
            ? 'gjArenaFinal'
            : 'gjArenaShield'
    );

    if(theme === 'final'){
      n.classList.add('gjFinalRushGlow');
    }
  }

  function unlockAudio(){
    if(!POLISH_JUICE.sound.enabled) return null;

    try{
      const Ctx = WIN.AudioContext || WIN.webkitAudioContext;
      if(!Ctx) return null;

      if(!state.polishJuice.audioCtx){
        state.polishJuice.audioCtx = new Ctx();
      }

      if(state.polishJuice.audioCtx.state === 'suspended'){
        state.polishJuice.audioCtx.resume?.();
      }

      state.polishJuice.soundUnlocked = true;
      return state.polishJuice.audioCtx;
    }catch(_){
      return null;
    }
  }

  function playTone(freq = 440, duration = 0.06, type = 'sine', gain = 0.18){
    if(!state.polishJuice.enabled || !POLISH_JUICE.sound.enabled) return;
    if(state.polishJuice.muted || !state.polishJuice.soundEnabled) return;

    const t = Date.now();
    if(t - state.polishJuice.lastSoundAt < POLISH_JUICE.sound.cooldownMs) return;

    state.polishJuice.lastSoundAt = t;

    const ctx = unlockAudio();
    if(!ctx) return;

    try{
      const osc = ctx.createOscillator();
      const g = ctx.createGain();

      osc.type = type;
      osc.frequency.value = freq;

      const vol = POLISH_JUICE.sound.volume * gain;

      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), ctx.currentTime + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(g);
      g.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.02);
    }catch(_){}
  }

  function playSound(kind){
    if(kind === 'good'){
      playTone(660, 0.055, 'sine', 0.80);
      return;
    }

    if(kind === 'bad'){
      playTone(190, 0.08, 'sawtooth', 0.62);
      return;
    }

    if(kind === 'hero'){
      playTone(520, 0.07, 'triangle', 0.82);
      setTimeout(() => playTone(780, 0.09, 'triangle', 0.70), 80);
      return;
    }

    if(kind === 'win'){
      playTone(523, 0.07, 'sine', 0.78);
      setTimeout(() => playTone(659, 0.07, 'sine', 0.78), 75);
      setTimeout(() => playTone(784, 0.10, 'sine', 0.78), 150);
      return;
    }

    if(kind === 'shield'){
      playTone(420, 0.055, 'triangle', 0.55);
      setTimeout(() => playTone(360, 0.055, 'triangle', 0.45), 60);
      return;
    }

    if(kind === 'bonus'){
      playTone(740, 0.06, 'sine', 0.72);
      setTimeout(() => playTone(980, 0.08, 'sine', 0.70), 90);
    }
  }

  function haptic(kind){
    if(!state.polishJuice.enabled || !POLISH_JUICE.haptic.enabled) return;
    if(!navigator.vibrate) return;

    const t = Date.now();
    if(t - state.polishJuice.lastHapticAt < POLISH_JUICE.haptic.cooldownMs) return;

    state.polishJuice.lastHapticAt = t;

    const pattern = POLISH_JUICE.haptic.patterns[kind] || [15];

    try{
      navigator.vibrate(pattern);
    }catch(_){}
  }

  function screenShake(kind = 'small'){
    if(!state.polishJuice.enabled || !POLISH_JUICE.screen.shakeEnabled) return;

    const t = Date.now();
    if(t - state.polishJuice.lastShakeAt < 120) return;

    state.polishJuice.lastShakeAt = t;

    const world = el.gameWorld || $('gameWorld');
    if(!world) return;

    world.classList.remove('gjScreenShake');
    void world.offsetWidth;
    world.classList.add('gjScreenShake');

    clearTimeout(screenShake._t);
    screenShake._t = setTimeout(() => {
      world.classList.remove('gjScreenShake');
    }, POLISH_JUICE.screen.maxShakeMs);
  }

  function pulseTargetNode(node){
    if(!node) return;

    node.classList.remove('gjHitPulse');
    void node.offsetWidth;
    node.classList.add('gjHitPulse');
  }

  function pulseHeroButton(){
    const btn = el.heroHitBtn || $('heroHitBtn');
    if(!btn) return;

    btn.classList.remove('gjHeroButtonBlast');
    void btn.offsetWidth;
    btn.classList.add('gjHeroButtonBlast');
  }

  function showComboJuice(combo){
    ensurePolishJuiceDom();

    const box = $('gjComboJuiceBanner');
    if(!box) return;

    box.innerHTML = `
      <div class="gjComboJuiceBig">x${combo} COMBO!</div>
      <div class="gjComboJuiceSmall">อาหารดีต่อเนื่อง ชาร์จพลัง Hero!</div>
    `;

    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');

    clearTimeout(showComboJuice._t);
    showComboJuice._t = setTimeout(() => {
      box.classList.remove('show');
    }, POLISH_JUICE.comboJuice.bannerMs);
  }

  function checkComboJuice(){
    const combo = state.combo;

    if(!POLISH_JUICE.comboJuice.pulseAt.includes(combo)) return;
    if(state.polishJuice.comboJuiceShown[combo]) return;

    state.polishJuice.comboJuiceShown[combo] = true;

    showComboJuice(combo);
    playSound('bonus');
    haptic('bonus');
  }

  function feedback(type){
    if(type === 'good'){
      impactFlash();
      playSound('good');
      haptic('good');
      return;
    }

    if(type === 'bad'){
      warningFlash(420);
      playSound('bad');
      haptic('bad');
      screenShake('small');
      return;
    }

    if(type === 'hero'){
      showHeroCutIn('🦸 HERO HIT!', 'พลังอาหารดีโจมตีบอส');
      playSound('hero');
      haptic('hero');
      screenShake('hero');
      pulseHeroButton();
      return;
    }

    if(type === 'win'){
      impactFlash();
      playSound('win');
      haptic('win');
      return;
    }

    if(type === 'shield'){
      playSound('shield');
      haptic('shield');
    }
  }

  function tutorialStorageKey(){
    return `${MICRO_TUTORIAL.storageKey}:${CFG.pid || 'anon'}`;
  }

  function loadMicroTutorialState(){
    try{
      state.microTutorial.doneBefore = localStorage.getItem(tutorialStorageKey()) === '1';
    }catch(_){
      state.microTutorial.doneBefore = false;
    }
  }

  function markMicroTutorialDone(){
    try{
      localStorage.setItem(tutorialStorageKey(), '1');
    }catch(_){}
  }

  function canShowMicroTutorial(id){
    if(!state.microTutorial.enabled || !MICRO_TUTORIAL.enabled) return false;
    if(state.ended || state.paused || !state.started) return false;

    if(MICRO_TUTORIAL.firstRunOnly && state.microTutorial.doneBefore){
      return false;
    }

    if(DIFF === 'easy' && currentDifficultyPersonality().tutorialBoost){
      // easy อนุญาตให้แสดง tip ได้มากขึ้นเล็กน้อย
    }else if(state.microTutorial.doneBefore && state.microTutorial.shownCount >= 3){
      return false;
    }

    if(state.microTutorial.shown[id]) return false;
    if(state.microTutorial.shownCount >= MICRO_TUTORIAL.maxTipsPerRun) return false;

    const t = Date.now();

    if(t < state.microTutorial.suppressedUntil) return false;
    if(t - state.microTutorial.lastShownAt < MICRO_TUTORIAL.minGapMs) return false;

    return true;
  }

  function showMicroTutorial(id, ms = 3200){
    const tip = MICRO_TUTORIAL.tips[id];

    if(!tip || !canShowMicroTutorial(id)) return false;
    if(overlayQuietActive()) return false;

    ensureMicroTutorialDom();

    const box = $('gjMicroTutorial');
    const icon = $('gjMicroTutorialIcon');
    const title = $('gjMicroTutorialTitle');
    const text = $('gjMicroTutorialText');
    const hint = $('gjTutorialSkipHint');

    if(icon) icon.textContent = tip.icon || '💡';
    if(title) title.textContent = tip.title || 'คำแนะนำ';
    if(text) text.textContent = tip.text || '';

    if(box){
      box.classList.add('show');
    }

    if(hint){
      hint.classList.add('show');
    }

    state.microTutorial.shown[id] = true;
    state.microTutorial.shownCount++;
    state.microTutorial.lastShownAt = Date.now();
    state.microTutorial.suppressedUntil = Date.now() + ms + 900;

    playSound?.('bonus');
    haptic?.('bonus');

    clearTimeout(showMicroTutorial._t);
    showMicroTutorial._t = setTimeout(() => {
      box?.classList.remove('show');
      hint?.classList.remove('show');

      if(state.microTutorial.shownCount >= 4){
        markMicroTutorialDone();
      }
    }, ms);

    return true;
  }

  function hideMicroTutorial(){
    $('gjMicroTutorial')?.classList.remove('show');
    $('gjTutorialSkipHint')?.classList.remove('show');
  }

  function resetMicroTutorialRun(){
    state.microTutorial.shown = {};
    state.microTutorial.shownCount = 0;
    state.microTutorial.lastShownAt = 0;
    state.microTutorial.suppressedUntil = 0;
    state.microTutorial.firstGoodSeen = false;
    state.microTutorial.firstJunkSeen = false;
    state.microTutorial.heroReadyTipShown = false;
    state.microTutorial.dangerTipShown = false;
    state.microTutorial.finalTipShown = false;
    state.microTutorial.missionTipShown = false;
    state.microTutorial.trickTipShown = false;
  }

  function getRunIndex(){
    try{
      const key = `GJ_SOLO_BOSS_RUN_INDEX:${CFG.pid || 'anon'}`;
      const n = Number(localStorage.getItem(key) || '0') || 0;
      localStorage.setItem(key, String(n + 1));
      return n + 1;
    }catch(_){
      return Math.floor(state.rng() * 9999);
    }
  }

  function setupReplayVariety(){
    if(!state.replayVariety.enabled) return;

    state.replayVariety.runIndex = getRunIndex();

    const themes = REPLAY_VARIETY.arenaThemes || [];
    const tricks = REPLAY_VARIETY.trickSets || [];

    const themeIndex = Math.abs(hashSeed(`${CFG.seed}:${CFG.pid}:theme:${state.replayVariety.runIndex}`)) % Math.max(1, themes.length);
    const trickIndex = Math.abs(hashSeed(`${CFG.seed}:${CFG.pid}:trick:${state.replayVariety.runIndex}`)) % Math.max(1, tricks.length);

    state.replayVariety.arenaTheme = themes[themeIndex] || themes[0] || null;
    state.replayVariety.trickSet = tricks[trickIndex] || tricks[0] || null;

    state.replayVariety.themeAnnounced = false;
    state.replayVariety.trickAnnounced = false;

    applyReplayArenaTheme();
    updateArenaThemeHud();
  }

  function applyReplayArenaTheme(){
    const world = el.gameWorld || $('gameWorld');
    if(!world) return;

    world.classList.remove(
      'gjThemeMarket',
      'gjThemeSchool',
      'gjThemeFestival',
      'gjThemeSpace'
    );

    const theme = state.replayVariety.arenaTheme;
    if(!theme) return;

    const cls =
      theme.id === 'market' ? 'gjThemeMarket' :
      theme.id === 'school' ? 'gjThemeSchool' :
      theme.id === 'festival' ? 'gjThemeFestival' :
      theme.id === 'space' ? 'gjThemeSpace' :
      '';

    if(cls) world.classList.add(cls);
  }

  function updateArenaThemeHud(){
    ensureReplayVarietyDom();

    const hud = $('gjArenaThemeHud');
    const icon = $('gjArenaThemeIcon');
    const text = $('gjArenaThemeText');

    const theme = state.replayVariety.arenaTheme;
    const trick = state.replayVariety.trickSet;

    if(!hud || !theme) return;

    hud.classList.add('show');

    if(icon) icon.textContent = theme.emoji || '🎮';
    if(text) text.textContent = `${theme.name}${trick ? ' • ' + trick.name : ''}`;
  }

  function currentDifficultyPersonality(){
    return DIFFICULTY_PERSONALITY[DIFF] || DIFFICULTY_PERSONALITY.normal;
  }

  function setupDifficultyPersonality(){
    if(!state.difficultyPersonality.enabled) return;

    const p = currentDifficultyPersonality();

    state.difficultyPersonality.profile = p;
    state.difficultyPersonality.adjustedGoodBias = Number(p.goodBias || 0);
    state.difficultyPersonality.adjustedJunkBias = Number(p.junkBias || 0);
    state.difficultyPersonality.adjustedTrickyBias = Number(p.trickyBias || 0);
    state.difficultyPersonality.adjustedWeaknessBias = Number(p.weaknessBias || 0);
    state.difficultyPersonality.adjustedHazardBias = Number(p.hazardBias || 0);
    state.difficultyPersonality.bossPatternSpeed = Number(p.bossPatternSpeed || 1);
    state.difficultyPersonality.comebackBoost = Number(p.comebackBoost || 1);

    updateDifficultyBadge();
    applyDifficultyWorldClass();
  }

  function applyDifficultyWorldClass(){
    const world = el.gameWorld || $('gameWorld');
    if(!world) return;

    world.classList.remove('gjDiffEasy', 'gjDiffNormal', 'gjDiffHard', 'gjDiffChallenge');

    const cls =
      DIFF === 'easy' ? 'gjDiffEasy' :
      DIFF === 'hard' ? 'gjDiffHard' :
      DIFF === 'challenge' ? 'gjDiffChallenge' :
      'gjDiffNormal';

    world.classList.add(cls);
  }

  function updateDifficultyBadge(){
    ensureDifficultyPersonalityDom();

    const badge = $('gjDifficultyBadge');
    const icon = $('gjDifficultyIcon');
    const text = $('gjDifficultyText');
    const p = currentDifficultyPersonality();

    if(!badge || !p) return;

    badge.classList.add('show');

    if(icon) icon.textContent = p.emoji || '🎮';
    if(text) text.textContent = p.label || DIFF;
  }

  function announceDifficultyPersonality(){
    const p = currentDifficultyPersonality();

    if(!p || state.difficultyPersonality.introShown) return;

    state.difficultyPersonality.introShown = true;

    bossSpeak(`${p.emoji} ${p.intro}`, 1800);

    if(DIFF === 'easy'){
      setTimeout(() => showMicroTutorial('firstGood', 3200), 1200);
    }

    if(DIFF === 'challenge'){
      setTimeout(() => {
        showLearningTip('ระดับ Challenge จะมีอาหารหลอกและเลนอันตรายมากขึ้น', 'ระวัง', 2200);
      }, 1200);
    }
  }

  function difficultyAdjustedChance(base, bias){
    return clamp(Number(base || 0) + Number(bias || 0), 0, 1);
  }

  function difficultyPatternDelay(delay){
    const speed = Number(state.difficultyPersonality.bossPatternSpeed || 1);
    return Math.max(70, Math.round(Number(delay || 140) * speed));
  }

  function setupAdvancedDefaults(){
    state.replayVariety = state.replayVariety || {};
    state.bossDrama = state.bossDrama || {};
    state.rewardLoop = state.rewardLoop || {};
    state.polishJuice = state.polishJuice || {};
    state.microTutorial = state.microTutorial || {};
    state.difficultyPersonality = state.difficultyPersonality || {};
    state.finalBalance = state.finalBalance || {};
    state.balanceTuning = state.balanceTuning || {};
    state.childPolish = state.childPolish || {};

    state.replayVariety.enabled = state.replayVariety.enabled !== false;
    state.bossDrama.enabled = state.bossDrama.enabled !== false;
    state.rewardLoop.enabled = state.rewardLoop.enabled !== false;
    state.polishJuice.enabled = state.polishJuice.enabled !== false;
    state.microTutorial.enabled = state.microTutorial.enabled !== false;
    state.difficultyPersonality.enabled = state.difficultyPersonality.enabled !== false;
    state.finalBalance.enabled = state.finalBalance.enabled !== false;
    state.balanceTuning.enabled = state.balanceTuning.enabled !== false;
    state.childPolish.enabled = state.childPolish.enabled !== false;
  }

  function updateSoundButton(){
    const btn = $('gjSoundBtn');
    if(!btn) return;

    const on = state.polishJuice.soundEnabled && !state.polishJuice.muted;
    btn.textContent = on ? '🔊' : '🔇';
    btn.title = on ? 'ปิดเสียง' : 'เปิดเสียง';
  }

  function toggleSound(){
    state.polishJuice.muted = !state.polishJuice.muted;
    state.polishJuice.soundEnabled = !state.polishJuice.muted;

    if(!state.polishJuice.muted){
      unlockAudio();
      playSound('good');
    }

    updateSoundButton();

    try{
      localStorage.setItem(
        `GJ_SOLO_BOSS_SOUND_MUTED:${CFG.pid || 'anon'}`,
        state.polishJuice.muted ? '1' : '0'
      );
    }catch(_){}

    return {
      muted: state.polishJuice.muted,
      soundEnabled: state.polishJuice.soundEnabled
    };
  }

  function loadSoundPreference(){
    try{
      const raw = localStorage.getItem(`GJ_SOLO_BOSS_SOUND_MUTED:${CFG.pid || 'anon'}`);

      if(raw === '1'){
        state.polishJuice.muted = true;
        state.polishJuice.soundEnabled = false;
      }else if(raw === '0'){
        state.polishJuice.muted = false;
        state.polishJuice.soundEnabled = true;
      }else{
        state.polishJuice.muted = !!POLISH_JUICE.sound.mutedByDefault;
        state.polishJuice.soundEnabled = !state.polishJuice.muted;
      }
    }catch(_){
      state.polishJuice.muted = !!POLISH_JUICE.sound.mutedByDefault;
      state.polishJuice.soundEnabled = !state.polishJuice.muted;
    }

    updateSoundButton();
  }

  function setupRunMetaSystems(){
    setupAdvancedDefaults();
    ensureAdvancedDom();

    setupReplayVariety();
    setupDifficultyPersonality();
    loadRewardLoop();
    loadMicroTutorialState();
    loadSoundPreference();

    applyReplayArenaTheme();
    applyDifficultyWorldClass();

    updateArenaThemeHud();
    updateDifficultyBadge();
    updateSoundButton();
  }

  function announceRunMetaSystems(){
    const theme = state.replayVariety.arenaTheme;
    const trick = state.replayVariety.trickSet;

    announceDifficultyPersonality();

    if(theme && !state.replayVariety.themeAnnounced){
      state.replayVariety.themeAnnounced = true;
      setTimeout(() => {
        bossSpeak(`${theme.emoji} ${theme.intro}`, 1700);
      }, 650);
    }

    if(trick && !state.replayVariety.trickAnnounced){
      state.replayVariety.trickAnnounced = true;
      setTimeout(() => {
        showLearningTip(trick.focus, trick.name, 1800);
      }, 1450);
    }

    setTimeout(() => {
      showMicroTutorial('firstGood', 3300);
    }, 2200);

    setTimeout(() => {
      showMicroTutorial('mission', 3300);
    }, 7200);
  }
    function rewardKey(name){
    return `${REWARD_LOOP.storageKeys[name] || name}:${CFG.pid || 'anon'}`;
  }

  function readJsonStorage(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      return JSON.parse(raw);
    }catch(_){
      return fallback;
    }
  }

  function writeJsonStorage(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(_){
      return false;
    }
  }

  function emptyRewardProfile(){
    return {
      pid: CFG.pid,
      name: CFG.name,
      nick: CFG.nick,
      runs: 0,
      wins: 0,
      bestScore: 0,
      bestStars: 0,
      bestCombo: 0,
      totalGood: 0,
      totalMiss: 0,
      lastPlayedAt: 0,
      rankId: 'rookie'
    };
  }

  function emptyBossBook(){
    return {
      bosses: {
        shield: { seen: 0, defeated: 0 },
        storm: { seen: 0, defeated: 0 },
        rage: { seen: 0, defeated: 0 },
        final: { seen: 0, defeated: 0 }
      },
      themes: {},
      trickSets: {}
    };
  }

  function emptyBadgeBook(){
    return {
      earned: {},
      earnedOrder: []
    };
  }

  function loadRewardLoop(){
    if(!state.rewardLoop.enabled) return;

    state.rewardLoop.profile = readJsonStorage(
      rewardKey('profile'),
      emptyRewardProfile()
    );

    state.rewardLoop.bossBook = readJsonStorage(
      rewardKey('bossBook'),
      emptyBossBook()
    );

    state.rewardLoop.badgeBook = readJsonStorage(
      rewardKey('badgeBook'),
      emptyBadgeBook()
    );

    state.rewardLoop.personalBestBefore = Number(state.rewardLoop.profile.bestScore || 0);
    state.rewardLoop.rankBefore = getRankByScore(state.rewardLoop.personalBestBefore);
  }

  function getRankByScore(score){
    const s = Number(score || 0);
    let rank = REWARD_LOOP.ranks[0];

    for(const r of REWARD_LOOP.ranks){
      if(s >= r.minScore) rank = r;
    }

    return rank;
  }

  function evaluateRewardBadges(summary){
    const earned = [];

    for(const b of REWARD_LOOP.badges){
      let ok = false;

      try{
        ok = !!b.test(summary);
      }catch(_){
        ok = false;
      }

      if(ok){
        earned.push({
          id: b.id,
          emoji: b.emoji,
          title: b.title,
          desc: b.desc
        });
      }
    }

    return earned;
  }

  function chooseNextChallenge(summary){
    const list = REWARD_LOOP.nextChallenges || [];

    if(!list.length) return null;

    if(Number(summary.miss || 0) >= 5){
      return list.find(x => x.goal === 'miss_lte_3') || pick(list);
    }

    if(Number(summary.bestCombo || 0) < 10){
      return list.find(x => x.goal === 'combo_10') || pick(list);
    }

    if(Number(summary.fruitHits || 0) < 5){
      return list.find(x => x.goal === 'fruit_6') || pick(list);
    }

    if(Number(summary.greenHits || 0) < 8){
      return list.find(x => x.goal === 'green_8') || pick(list);
    }

    return pick(list);
  }

  function updateBossBook(summary){
    const book = state.rewardLoop.bossBook || emptyBossBook();

    const seenKeys = ['shield'];

    if(state.bossIdentity.introShown?.storm) seenKeys.push('storm');
    if(state.bossIdentity.introShown?.rage) seenKeys.push('rage');
    if(state.bossIdentity.introShown?.final || state.finalRush) seenKeys.push('final');

    seenKeys.forEach(k => {
      book.bosses[k] = book.bosses[k] || { seen:0, defeated:0 };
      book.bosses[k].seen++;
      if(summary.win) book.bosses[k].defeated++;
    });

    const theme = state.replayVariety.arenaTheme;

    if(theme?.id){
      book.themes[theme.id] = book.themes[theme.id] || {
        name: theme.name,
        emoji: theme.emoji,
        runs: 0,
        wins: 0
      };
      book.themes[theme.id].runs++;
      if(summary.win) book.themes[theme.id].wins++;
    }

    const trick = state.replayVariety.trickSet;

    if(trick?.id){
      book.trickSets[trick.id] = book.trickSets[trick.id] || {
        name: trick.name,
        focus: trick.focus,
        runs: 0,
        wins: 0
      };
      book.trickSets[trick.id].runs++;
      if(summary.win) book.trickSets[trick.id].wins++;
    }

    state.rewardLoop.bossBook = book;
    return book;
  }

  function updateBadgeBook(newBadges){
    const book = state.rewardLoop.badgeBook || emptyBadgeBook();
    const earnedThisRun = [];

    newBadges.forEach(b => {
      if(!book.earned[b.id]){
        book.earned[b.id] = {
          ...b,
          firstEarnedAt: Date.now(),
          count: 1
        };

        book.earnedOrder.push(b.id);
        earnedThisRun.push({ ...b, isNew:true });
      }else{
        book.earned[b.id].count = Number(book.earned[b.id].count || 0) + 1;
        earnedThisRun.push({ ...b, isNew:false });
      }
    });

    state.rewardLoop.badgeBook = book;
    state.rewardLoop.earnedBadgesThisRun = earnedThisRun;

    return book;
  }

  function updateRewardProfile(summary){
    const p = state.rewardLoop.profile || emptyRewardProfile();

    p.pid = CFG.pid;
    p.name = CFG.name;
    p.nick = CFG.nick;
    p.runs = Number(p.runs || 0) + 1;
    p.wins = Number(p.wins || 0) + (summary.win ? 1 : 0);
    p.totalGood = Number(p.totalGood || 0) + Number(summary.good || 0);
    p.totalMiss = Number(p.totalMiss || 0) + Number(summary.miss || 0);
    p.bestCombo = Math.max(Number(p.bestCombo || 0), Number(summary.bestCombo || 0));
    p.bestStars = Math.max(Number(p.bestStars || 0), Number(summary.starGoal?.starsEarned || 0));
    p.bestScore = Math.max(Number(p.bestScore || 0), Number(summary.score || 0));
    p.lastPlayedAt = Date.now();

    const rank = getRankByScore(p.bestScore);
    p.rankId = rank.id;

    state.rewardLoop.profile = p;
    state.rewardLoop.personalBestAfter = p.bestScore;
    state.rewardLoop.isNewBest = Number(summary.score || 0) > state.rewardLoop.personalBestBefore;
    state.rewardLoop.rankAfter = rank;

    return p;
  }

  function updateRewardLoop(summary){
    if(!state.rewardLoop.enabled) return null;

    if(!state.rewardLoop.profile || !state.rewardLoop.bossBook || !state.rewardLoop.badgeBook){
      loadRewardLoop();
    }

    const profile = updateRewardProfile(summary);
    const bossBook = updateBossBook(summary);

    const badges = evaluateRewardBadges({
      ...summary,
      arenaHazard: {
        hazardCount: state.arenaHazard.hazardCount,
        hitPenalty: state.arenaHazard.hitPenalty,
        safeHits: state.arenaHazard.safeHits
      },
      missionChain: {
        completedIds: [...state.missionChain.completedIds],
        failedIds: [...state.missionChain.failedIds]
      }
    });

    const badgeBook = updateBadgeBook(badges);
    const nextChallenge = chooseNextChallenge(summary);

    state.rewardLoop.nextChallenge = nextChallenge;
    state.rewardLoop.rewardSaved = true;

    writeJsonStorage(rewardKey('profile'), profile);
    writeJsonStorage(rewardKey('bossBook'), bossBook);
    writeJsonStorage(rewardKey('badgeBook'), badgeBook);
    writeJsonStorage(rewardKey('lastChallenge'), nextChallenge);

    return {
      profile,
      bossBook,
      badgeBook,
      earnedBadgesThisRun: state.rewardLoop.earnedBadgesThisRun,
      rankBefore: state.rewardLoop.rankBefore,
      rankAfter: state.rewardLoop.rankAfter,
      personalBestBefore: state.rewardLoop.personalBestBefore,
      personalBestAfter: state.rewardLoop.personalBestAfter,
      isNewBest: state.rewardLoop.isNewBest,
      nextChallenge
    };
  }

  function currentBossIdentityKey(){
    if(state.finalRush) return 'final';
    if(state.phase >= 3) return 'rage';
    if(state.phase >= 2) return 'storm';
    return 'shield';
  }

  function currentBossIdentity(){
    const key = currentBossIdentityKey();
    return BOSS_IDENTITY[key] || BOSS_IDENTITY.shield;
  }

  function currentWeakness(){
    const key = currentBossIdentityKey();

    if(key === 'final') return BOSS.weakness.phase3;
    if(key === 'rage') return BOSS.weakness.phase3;
    if(key === 'storm') return BOSS.weakness.phase2;

    return BOSS.weakness.phase1;
  }

  function updateBossIdentity(force = false){
    if(!state.bossIdentity?.enabled) return;

    ensureBossIdentityDom();

    const key = currentBossIdentityKey();
    const identity = BOSS_IDENTITY[key] || BOSS_IDENTITY.shield;

    const changed = force || state.bossIdentity.currentKey !== key;

    state.bossIdentity.lastKey = state.bossIdentity.currentKey;
    state.bossIdentity.currentKey = key;

    const icon = $('gjBossNameIcon');
    const text = $('gjBossNameText');
    const weak = $('gjBossNameWeakness');

    if(icon) icon.textContent = identity.emoji;
    if(text) text.textContent = `${identity.name} • ${identity.title}`;
    if(weak) weak.textContent = `จุดอ่อน: ${identity.weakness}`;

    if(el.bossAvatar){
      el.bossAvatar.textContent = identity.emoji;
    }

    const world = el.gameWorld || $('gameWorld') || DOC.body;

    world.classList.remove(
      'bossIdentityShield',
      'bossIdentityStorm',
      'bossIdentityRage',
      'bossIdentityFinal'
    );

    world.classList.add(identity.bgClass);

    if(changed){
      state.bossIdentity.changedAt = Date.now();

      const boss = el.bossWrap || $('bossWrap') || $('bossAvatar');

      if(boss){
        boss.classList.remove('gjBossIdentityChange');
        void boss.offsetWidth;
        boss.classList.add('gjBossIdentityChange');
      }

      if(!state.bossIdentity.introShown[key]){
        state.bossIdentity.introShown[key] = true;
        bossSpeak(identity.intro, 1800);
        safeFinalRushToast(`${identity.emoji} ${identity.name}!`, 1400);
      }
    }
  }

  function bossIdentitySpeech(){
    const key = currentBossIdentityKey();
    const identity = BOSS_IDENTITY[key] || BOSS_IDENTITY.shield;
    const lines = identity.speech || [];

    if(!lines.length) return '';

    const idx = state.bossIdentity.speechCount[key] || 0;
    state.bossIdentity.speechCount[key] = idx + 1;

    return lines[idx % lines.length];
  }

  function pickBossSkillByIdentity(){
    const identity = currentBossIdentity();
    const bias = Array.isArray(identity.skillBias) ? identity.skillBias : [];

    if(bias.length && state.rng() < .68){
      const id = pick(bias);
      const found = BOSS.skills.find(s => s.id === id);
      if(found) return found;
    }

    return pick(BOSS.skills);
  }

  function showLearningTip(text, lesson = '', ms = 1600){
    if(!state.learningTip?.enabled) return;
    if(overlayQuietActive()) return;

    ensureLearningTipDom();

    const box = $('gjLearningTip');
    const textEl = $('gjLearningTipText');

    if(!box || !textEl) return;

    const msg = lesson ? `${lesson}: ${text}` : text;

    textEl.textContent = msg;
    box.classList.add('show');

    state.learningTip.lastTip = text;
    state.learningTip.lastLesson = lesson;
    state.learningTip.lastShownAt = Date.now();
    state.learningTip.shownCount++;

    clearTimeout(showLearningTip._t);
    showLearningTip._t = setTimeout(() => {
      box.classList.remove('show');
    }, ms);
  }

  function maybeShowLearningTip(data, correct = true){
    if(!data || !state.learningTip?.enabled) return;

    const t = Date.now();

    if(t - state.learningTip.lastShownAt < 1200) return;

    if(correct){
      if(data.tip){
        showLearningTip(data.tip, data.lesson || 'เรียนรู้');
      }
    }else{
      showLearningTip(data.tip || 'ดูให้ดีก่อนแตะอาหาร', data.lesson || 'ลองใหม่');
    }
  }

  function simpleText(text, maxLen = CHILD_POLISH.summary.maxTextLineLength){
    let s = String(text || '').trim();

    s = s
      .replace(/Junk King/g, 'บอสอาหารขยะ')
      .replace(/Final Rush/g, 'ช่วงสุดท้าย')
      .replace(/HERO HIT/g, 'พลัง Hero')
      .replace(/Challenge/g, 'โหมดท้าทาย');

    if(s.length > maxLen){
      s = s.slice(0, maxLen - 1).trim() + '…';
    }

    return s;
  }

  function pickChildTip(type, fallback = ''){
    const list = CHILD_POLISH.summaryTips[type] || [];
    return pick(list) || fallback;
  }

  function childSummaryLevel(s){
    if(s.win && Number(s.starGoal?.starsEarned || 0) >= 3) return 'great';
    if(s.win) return 'win';
    if(Number(s.score || 0) >= 180 || Number(s.good || 0) >= 12) return 'almost';
    return 'try';
  }

  function childEndMessage(s){
    const level = childSummaryLevel(s);
    state.childPolish.summaryLevel = level;

    if(s.win){
      return pick(CHILD_POLISH.endMessages.win) || 'เก่งมาก! ชนะบอสแล้ว';
    }

    return pick(CHILD_POLISH.endMessages.lose) || 'ไม่เป็นไร รอบหน้าลุยใหม่';
  }

  function shortBadgeText(b){
    return String(b || '')
      .replace('Boss Breaker', 'ชนะบอส')
      .replace('Combo Master', 'Combo สูง')
      .replace('Combo Starter', 'เริ่ม Combo')
      .replace('Clean Player', 'พลาดน้อย')
      .replace('Green Hero', 'สายผัก')
      .replace('Protein Power', 'โปรตีนดี')
      .replace('Fruit Fighter', 'ผลไม้ดี')
      .replace('Shield User', 'ใช้ Shield')
      .replace('Comeback Hero', 'กลับมาได้')
      .replace('Last Heart Save', 'รอดหัวใจสุดท้าย')
      .replace('Keep Trying Hero', 'พยายามดีมาก');
  }

  function kidsBadges(s){
    const list = [];

    if(s.win){
      list.push('👑 Boss Breaker');
    }

    if(s.bestCombo >= 15){
      list.push('⚡ Combo Master');
    }else if(s.bestCombo >= 8){
      list.push('✨ Combo Starter');
    }

    if(s.miss <= 2){
      list.push('🌟 Clean Player');
    }

    if(s.greenHits >= 8){
      list.push('🥦 Green Hero');
    }

    if(s.proteinHits >= 6){
      list.push('🐟 Protein Power');
    }

    if(s.fruitHits >= 5){
      list.push('🍎 Fruit Fighter');
    }

    if((s.powerUpsCollected?.shield || 0) > 0){
      list.push('🛡️ Shield User');
    }

    if((s.comeback?.used || 0) > 0){
      list.push('💚 Comeback Hero');
    }

    if((s.comeback?.rescueGiven || false)){
      list.push('🛡️ Last Heart Save');
    }

    return list.length ? list : ['💪 Keep Trying Hero'];
  }

  function kidsWinTitle(s){
    if(s.win && s.stars === '⭐⭐⭐') return 'สุดยอดฮีโร่อาหารดี!';
    if(s.win) return 'ชนะ Junk King แล้ว!';
    if(s.score >= 180) return 'เกือบชนะแล้ว!';
    return 'ฝึกได้ดีมาก!';
  }

  function kidsMainTip(s){
    if(s.win && s.miss <= 2){
      return 'แยกอาหารดีได้แม่น และพลาดน้อยมาก';
    }

    if(s.win){
      return 'ชนะบอสได้ เพราะเก็บอาหารดีและทำภารกิจสำเร็จ';
    }

    if(Number(s.good || 0) >= 12){
      return 'เก็บอาหารดีได้เยอะแล้ว รอบหน้าลองพลาดให้น้อยลง';
    }

    return pickChildTip('good', 'เก็บอาหารดีเพื่อชาร์จพลัง Hero');
  }

  function kidsWatchTip(s){
    if(s.junkHit > s.missedGood){
      return 'ระวังน้ำอัดลม ขนมหวาน และของทอด';
    }

    if(s.missedGood >= 5){
      return 'อย่าปล่อยอาหารดีหลุด เพราะช่วยโจมตีบอส';
    }

    if(s.bestCombo < 8){
      return 'ลองแตะอาหารดีต่อเนื่องเพื่อเพิ่ม Combo';
    }

    return pickChildTip('caution', 'ดูให้ชัดก่อนแตะอาหาร');
  }

  function kidsNextTip(s){
    if(!s.win){
      return 'ดูจุดอ่อนบอส แล้วเก็บอาหารให้ตรงเป้าหมาย';
    }

    if(Number(s.starGoal?.starsEarned || 0) < 3){
      return 'ลองเอา 3 ดาว โดยพลาดให้น้อยลง';
    }

    return pickChildTip('next', 'ลองระดับที่ท้าทายขึ้นได้เลย');
  }

  function summaryText(s){
    const badges = kidsBadges(s)
      .slice(0, CHILD_POLISH.summary.maxBadgesShown)
      .map(shortBadgeText);

    return `${childEndMessage(s)}

✅ ทำดี:
${simpleText(kidsMainTip(s), 70)}

⚠️ ระวัง:
${simpleText(kidsWatchTip(s), 70)}

➡️ รอบหน้า:
${simpleText(kidsNextTip(s), 70)}

🏅 รางวัล:
${badges.join(' • ')}`;
  }

  function fullCoachText(){
    let text = '';

    const w = currentWeakness();

    if(state.finalRush){
      const chain = currentMissionChain?.();

      if(chain?.coach){
        text = `${chain.icon} ${chain.coach}`;
      }else{
        text = `🔥 ช่วงสุดท้าย: เก็บ ${w.label} แล้วใช้พลัง Hero`;
      }
    }else{
      const chain = currentMissionChain?.();

      if(chain?.coach){
        text = `${chain.icon} ${chain.coach}`;
      }else if(state.patternScript?.activePatternName){
        text = `🎬 ดูจังหวะบอส แล้วเก็บอาหารดี`;
      }else{
        const identity = currentBossIdentity();

        if(identity?.tip){
          text = `${identity.emoji} ${identity.tip}`;
        }else{
          text = bossBookTip();
        }
      }
    }

    text = simpleText(text, CHILD_POLISH.coach.maxLength);

    const t = Date.now();

    if(
      state.childPolish.lastCoachText &&
      text !== state.childPolish.lastCoachText &&
      t - state.childPolish.lastCoachAt < CHILD_POLISH.coach.rotateMinMs
    ){
      return state.childPolish.lastCoachText;
    }

    state.childPolish.lastCoachText = text;
    state.childPolish.lastCoachAt = t;

    return text;
  }

  function bossBookTip(){
    const w = currentWeakness();
    return `จุดอ่อนตอนนี้: ${w.label}`;
  }

  function updateDailyGood(data){
    const d = state.daily.challenge;
    if(!d || state.daily.done) return;

    if(d.type === 'max_miss'){
      state.daily.progress = Math.max(0, d.target - state.miss);
      return;
    }

    if(data?.group === d.group){
      state.daily.progress++;
    }

    if(state.daily.progress >= d.target){
      state.daily.done = true;
      state.score += 25;
      toast('🏅 Daily Challenge สำเร็จ!');
      spawnPowerUp('cleanBlast');
    }
  }

  function updateDailyJunk(data){
    const d = state.daily.challenge;
    if(!d || state.daily.done) return;

    if(d.type === 'max_miss'){
      state.daily.progress = Math.max(0, d.target - state.miss);

      if(state.miss <= d.target){
        state.daily.done = true;
      }
    }
  }

  function setupDailyChallenge(){
    const idx = Math.abs(
      hashSeed(`${CFG.pid}:${new Date().toDateString()}:goodjunk:${state.replayVariety.runIndex || 0}`)
    ) % DAILY_CHALLENGES.length;

    state.daily.challenge = DAILY_CHALLENGES[idx] || DAILY_CHALLENGES[0];
    state.daily.progress = 0;
    state.daily.done = false;
  }

  function directorAfterGood(){
    state.balance.streakGood++;
    state.balance.streakMiss = 0;
    state.balance.stress = clamp(state.balance.stress - 8, 0, 100);

    if(Date.now() < state.comeback.activeUntil){
      state.comeback.recoverySuccess += state.balance.streakGood === 3 ? 1 : 0;
    }
  }

  function directorAfterMistake(){
    state.balance.streakGood = 0;
    state.balance.streakMiss++;
    state.balance.stress = clamp(state.balance.stress + 15, 0, 100);

    if(state.balance.streakMiss >= 2){
      state.balance.forcedGoodNext = Math.max(state.balance.forcedGoodNext, 1);
    }

    if(state.balance.streakMiss >= 3){
      state.balance.forcedWeaknessNext = Math.max(state.balance.forcedWeaknessNext, 1);
    }

    checkComebackTrigger();
    directorMaybeAssist();
  }

  function showComebackBanner(type = 'focus', reason = ''){
    ensureComebackDom();

    const reward = COMEBACK_RULES.rewards[type] || COMEBACK_RULES.rewards.focus;

    const banner = $('gjComebackBanner');
    const icon = $('gjComebackIcon');
    const title = $('gjComebackTitle');
    const text = $('gjComebackText');

    if(icon) icon.textContent = reward.icon;
    if(title) title.textContent = reward.label;
    if(text) text.textContent = reason || reward.text;

    if(banner){
      banner.classList.remove('show');
      void banner.offsetWidth;
      banner.classList.add('show');

      clearTimeout(showComebackBanner._t);
      showComebackBanner._t = setTimeout(() => {
        banner.classList.remove('show');
      }, 950);
    }
  }

  function updateComebackPill(){
    ensureComebackDom();

    const pill = $('gjComebackPill');
    const text = $('gjComebackPillText');

    if(!pill) return;

    const active = Date.now() < state.comeback.activeUntil;

    pill.classList.toggle('show', active);

    if(text){
      const left = Math.ceil(Math.max(0, state.comeback.activeUntil - Date.now()) / 1000);
      text.textContent = active ? `Comeback ${left}s` : 'Comeback';
    }
  }

  function canTriggerComeback(){
    if(!state.comeback?.enabled) return false;
    if(state.comeback.used >= COMEBACK_RULES.maxComebackPerRun) return false;
    if(Date.now() - state.comeback.lastTriggeredAt < 9000) return false;
    if(state.ended || state.paused || !state.started) return false;

    return true;
  }

  function triggerComeback(reason = 'mistake-streak'){
    if(!canTriggerComeback()) return false;

    state.comeback.used++;
    state.comeback.lastTriggeredAt = Date.now();
    state.comeback.lastReason = reason;
    state.comeback.activeUntil = Date.now() + Math.round(
      COMEBACK_RULES.calmWindowMs * state.difficultyPersonality.comebackBoost
    );
    state.comeback.streakMistakeAtTrigger = state.balance.streakMiss || 0;

    state.balance.calmUntil = Math.max(
      state.balance.calmUntil || 0,
      state.comeback.activeUntil
    );

    const comebackBoost = Number(state.difficultyPersonality.comebackBoost || 1);
    const forcedGood = Math.max(1, Math.round(COMEBACK_RULES.forcedGoodCount * comebackBoost));
    const forcedWeakness = Math.max(1, Math.round(COMEBACK_RULES.forcedWeaknessCount * comebackBoost));

    state.balance.forcedGoodNext = Math.max(
      state.balance.forcedGoodNext || 0,
      forcedGood
    );

    state.balance.forcedWeaknessNext = Math.max(
      state.balance.forcedWeaknessNext || 0,
      forcedWeakness
    );

    state.comeback.totalForcedGood += forcedGood;
    state.comeback.totalForcedWeakness += forcedWeakness;

    let rewardType = 'focus';

    if(state.lives <= COMEBACK_RULES.rescueAfterLives && !state.comeback.rescueGiven){
      state.activePower.shield++;
      state.comeback.rescueGiven = true;
      state.comeback.totalShieldGiven++;
      rewardType = 'shield';
    }else if(!state.comeback.calmGiven){
      state.activePower.slowUntil = Date.now() + 4800;
      state.comeback.calmGiven = true;
      rewardType = 'slow';
    }else if(!state.comeback.heroGiven){
      state.heroHit = clamp(state.heroHit + 16, 0, 100);
      state.comeback.heroGiven = true;
      state.comeback.totalHeroBoost += 16;
      rewardType = 'hero';
    }else{
      state.comeback.focusGiven = true;
      rewardType = 'focus';
    }

    showComebackBanner(rewardType, 'พลาดได้ แต่กลับมาได้! มองหาอาหารดี');

    bossSpeak('Hero ยังมีโอกาสกลับมา!', 1400);
    checkBossDramaComeback();
    feedback('win');
    updateHud();

    return true;
  }

  function checkComebackTrigger(){
    if(!canTriggerComeback()) return;

    if(state.balance.streakMiss >= COMEBACK_RULES.mercyAfterMissStreak){
      triggerComeback('miss-streak');
      return;
    }

    if(state.lives <= COMEBACK_RULES.rescueAfterLives && !state.comeback.rescueGiven){
      triggerComeback('low-life');
    }
  }

  function checkComebackRecovery(){
    if(!state.comeback.activeUntil) return;

    const active = Date.now() < state.comeback.activeUntil;

    if(active){
      updateComebackPill();
      return;
    }

    updateComebackPill();

    if(Date.now() - state.comeback.lastRecoveryCheckAt < 2500) return;

    state.comeback.lastRecoveryCheckAt = Date.now();

    if(state.comeback.streakMistakeAtTrigger > 0){
      if((state.balance.streakGood || 0) >= 3){
        state.comeback.recoverySuccess++;
        state.score += 12;
        toast('💚 กลับมาได้ดี! +12 คะแนน');
      }else if((state.balance.streakMiss || 0) >= state.comeback.streakMistakeAtTrigger){
        state.comeback.recoveryFailed++;
      }
    }

    state.comeback.streakMistakeAtTrigger = 0;
  }

  function directorMaybeAssist(){
    checkComebackTrigger();

    const t = Date.now();

    if(t - state.balance.lastAssistAt < 10000) return;

    if(state.lives <= 1 || state.balance.streakMiss >= 3){
      state.balance.lastAssistAt = t;
      state.balance.calmUntil = Math.max(state.balance.calmUntil || 0, t + 5200);
      state.balance.forcedWeaknessNext = Math.max(state.balance.forcedWeaknessNext || 0, 2);

      if(state.activePower.shield <= 0 && state.comeback.used < COMEBACK_RULES.maxComebackPerRun){
        state.activePower.shield++;
        state.comeback.totalShieldGiven++;
      }

      toast('💚 เกมให้จังหวะสวนกลับแล้ว!');
    }
  }

  function missionChainActive(){
    return !!(state.missionChain?.enabled && state.missionChain.active);
  }

  function currentMissionChain(){
    return state.missionChain.active || null;
  }

  function pickMissionForCurrentPhase(){
    const key = currentBossIdentityKey?.() || 'shield';

    const idx = state.missionChain.index || 0;
    const remaining = BOSS_MISSION_CHAIN.filter(m => {
      if(state.missionChain.completedIds.includes(m.id)) return false;

      if(m.phaseKey === key) return true;

      if(key === 'final') return m.phaseKey === 'final';

      return false;
    });

    if(remaining.length){
      return remaining[0];
    }

    return BOSS_MISSION_CHAIN[idx % BOSS_MISSION_CHAIN.length] || null;
  }

  function startMissionChain(force = false){
    if(!state.missionChain?.enabled) return;

    if(state.missionChain.chainComplete && !force) return;

    const m = pickMissionForCurrentPhase();

    if(!m) return;

    state.missionChain.active = m;
    state.missionChain.progress = 0;
    state.missionChain.target = Math.max(1, Number(m.target || 1));
    state.missionChain.startedAt = Date.now();
    state.missionChain.lastUpdateAt = Date.now();
    state.missionChain.rewardGiven = false;
    state.missionChain.avoidStartedAt = m.type === 'avoid_group_time' ? Date.now() : 0;
    state.missionChain.avoidBroken = false;

    updateMissionChainHud();

    if(m.coach){
      toast(`${m.icon} ${m.title}`);
      bossSpeak(m.coach, 1500);
    }
  }

  function updateMissionChainHud(){
    ensureMissionChainDom();

    const m = state.missionChain.active;

    const icon = $('gjMissionChainIcon');
    const title = $('gjMissionChainTitle');
    const count = $('gjMissionChainCount');
    const instruction = $('gjMissionChainInstruction');
    const fill = $('gjMissionChainFill');

    if(!m){
      if(icon) icon.textContent = '🎯';
      if(title) title.textContent = 'ภารกิจบอส';
      if(count) count.textContent = '0/0';
      if(instruction) instruction.textContent = 'เตรียมพร้อม';
      if(fill) fill.style.width = '0%';
      return;
    }

    const progress = clamp(state.missionChain.progress, 0, state.missionChain.target);
    const target = Math.max(1, state.missionChain.target);
    const pct = clamp((progress / target) * 100, 0, 100);

    if(icon) icon.textContent = m.icon || '🎯';
    if(title) title.textContent = m.title || 'ภารกิจบอส';
    if(count) count.textContent = `${Math.floor(progress)}/${target}`;
    if(instruction) instruction.textContent = m.instruction || '';
    if(fill) fill.style.width = `${pct}%`;
  }

  function completeMissionChain(){
    const m = state.missionChain.active;

    if(!m || state.missionChain.rewardGiven) return;

    state.missionChain.rewardGiven = true;
    state.missionChain.completedIds.push(m.id);

    const box = $('gjMissionChain');
    if(box){
      box.classList.remove('gjMissionChainDone');
      void box.offsetWidth;
      box.classList.add('gjMissionChainDone');
    }

    giveMissionChainReward(m);

    state.missionChain.index++;

    if(state.missionChain.completedIds.length >= BOSS_MISSION_CHAIN.length){
      state.missionChain.chainComplete = true;
      toast('🏆 Boss Mission Chain ครบแล้ว!');
    }

    setTimeout(() => {
      if(state.ended) return;
      startMissionChain(true);
    }, 1500);
  }

  function giveMissionChainReward(m){
    const reward = m.reward || '';

    if(reward === 'shieldBreak'){
      const dmg = Math.round(state.bossMaxHp * .055);
      state.bossHp = clamp(state.bossHp - dmg, 0, state.bossMaxHp);
      state.bossShield = false;
      showShieldCrack?.();
      impactFlash?.();
      bossShake?.('shield');
      toast(`🏅 ${m.rewardText || 'โล่บอสอ่อนลง!'}`);
    }else if(reward === 'slow'){
      state.activePower.slowUntil = Date.now() + 6000;
      toast(`🏅 ${m.rewardText || 'Slow Time!'}`);
    }else if(reward === 'hero'){
      state.heroHit = clamp(state.heroHit + 25, 0, 100);
      toast(`🏅 ${m.rewardText || 'HERO HIT +25%'}`);
    }else if(reward === 'finishBoost'){
      state.missionChain.finishBoostReady = true;
      state.heroHit = clamp(state.heroHit + 20, 0, 100);
      state.score += 25;
      toast(`🏅 ${m.rewardText || 'พลังปิดฉากพร้อม!'}`);
    }else{
      state.score += 25;
      toast(`🏅 ${m.rewardText || '+25 คะแนน'}`);
    }

    feedback('win');
    playSound('bonus');
    haptic('bonus');
    updateHud();
  }

  function updateMissionChainByGood(data){
    const m = currentMissionChain();
    if(!m || state.missionChain.rewardGiven) return;

    if(m.type === 'collect_group' && data?.group === m.group){
      state.missionChain.progress++;
    }

    if(m.type === 'combo_or_hero' && state.combo >= m.target){
      state.missionChain.progress = m.target;
    }

    updateMissionChainHud();

    if(state.missionChain.progress >= state.missionChain.target){
      completeMissionChain();
    }
  }

  function updateMissionChainByJunk(data){
    const m = currentMissionChain();
    if(!m || state.missionChain.rewardGiven) return;

    if(m.type === 'avoid_group_time' && data?.group === m.group){
      state.missionChain.avoidBroken = true;
      state.missionChain.failedIds.push(m.id);
      toast('ภารกิจหลบน้ำอัดลมพลาดแล้ว เริ่มใหม่!');
      startMissionChain(true);
    }
  }

  function updateMissionChainByHeroHit(){
    const m = currentMissionChain();
    if(!m || state.missionChain.rewardGiven) return;

    if(m.type === 'combo_or_hero'){
      state.missionChain.progress = m.target;
      updateMissionChainHud();
      completeMissionChain();
    }
  }

  function tickMissionChain(){
    const m = currentMissionChain();
    if(!m || state.missionChain.rewardGiven) return;

    if(m.type === 'avoid_group_time'){
      if(!state.missionChain.avoidStartedAt){
        state.missionChain.avoidStartedAt = Date.now();
      }

      const sec = Math.floor((Date.now() - state.missionChain.avoidStartedAt) / 1000);
      state.missionChain.progress = clamp(sec, 0, state.missionChain.target);

      updateMissionChainHud();

      if(state.missionChain.progress >= state.missionChain.target){
        completeMissionChain();
      }
    }
  }

  function hazardEveryMs(){
    if(!state.arenaHazard.enabled) return Infinity;

    let base;

    if(state.finalRush){
      base = ARENA_HAZARDS.schedule.finalEvery;
    }else if(state.phase >= 3){
      base = ARENA_HAZARDS.schedule.phase3Every;
    }else if(state.phase >= 2){
      base = ARENA_HAZARDS.schedule.phase2Every;
    }else{
      base = ARENA_HAZARDS.schedule.phase1Every;
    }

    const bias = Number(state.difficultyPersonality.adjustedHazardBias || 0);
    const factor = clamp(1 - bias, .72, 1.18);

    return Math.round(base * factor);
  }

  function hazardDurationMs(){
    return ARENA_HAZARDS.durationMs[DIFF] || ARENA_HAZARDS.durationMs.normal || 4200;
  }

  function pickHazardLane(){
    const lanes = ARENA_HAZARDS.lanes || [];
    return pick(lanes.length ? lanes : [
      { id:'middle', label:'เลนกลาง', icon:'↔️', zone:'middle', warning:'เลนกลางอันตราย!' }
    ]);
  }

  function showHazardBanner(text, icon = '⚠️', ms = 1400){
    ensureArenaHazardDom();

    const banner = $('gjHazardBanner');
    const iconEl = $('gjHazardIcon');
    const textEl = $('gjHazardText');

    if(iconEl) iconEl.textContent = icon;
    if(textEl) textEl.textContent = text;

    if(!banner) return;

    banner.classList.add('show');

    clearTimeout(showHazardBanner._t);
    showHazardBanner._t = setTimeout(() => {
      banner.classList.remove('show');
    }, ms);
  }

  function startArenaHazard(forceLane = ''){
    if(!state.arenaHazard.enabled || state.ended || state.paused || !state.started) return;

    ensureArenaHazardDom();

    const lane = forceLane
      ? ARENA_HAZARDS.lanes.find(l => l.id === forceLane) || pickHazardLane()
      : pickHazardLane();

    state.arenaHazard.active = true;
    state.arenaHazard.activeLane = lane.id;
    state.arenaHazard.activeZone = lane.zone;
    state.arenaHazard.activeLabel = lane.label;
    state.arenaHazard.activeIcon = lane.icon;
    state.arenaHazard.startedAt = Date.now();
    state.arenaHazard.endsAt = Date.now() + hazardDurationMs();
    state.arenaHazard.lastHazardAt = Date.now();
    state.arenaHazard.hazardCount++;

    const laneEl = $('gjDangerLane');

    if(laneEl){
      laneEl.className = '';
      laneEl.id = 'gjDangerLane';
      laneEl.classList.add('show', lane.zone);
    }

    showHazardBanner(lane.warning || 'เลนอันตราย!', lane.icon || '⚠️', 1600);

    if(!state.microTutorial.dangerTipShown){
      state.microTutorial.dangerTipShown = true;
      showMicroTutorial('dangerLane', 3300);
    }

    bossSpeak(`${lane.icon} ${lane.warning}`, 1400);

    state.dangerMeter = clamp(state.dangerMeter + 10, 0, 100);
    updateHud();
  }

  function endArenaHazard(){
    state.arenaHazard.active = false;
    state.arenaHazard.activeLane = '';
    state.arenaHazard.activeZone = '';
    state.arenaHazard.activeLabel = '';
    state.arenaHazard.activeIcon = '';
    state.arenaHazard.endsAt = 0;

    const laneEl = $('gjDangerLane');

    if(laneEl){
      laneEl.classList.remove('show', 'top', 'middle', 'bottom');
    }
  }

  function updateArenaHazard(){
    if(!state.arenaHazard.enabled || state.ended || state.paused || !state.started) return;

    const t = Date.now();

    if(state.arenaHazard.active && t >= state.arenaHazard.endsAt){
      endArenaHazard();
      return;
    }

    if(!state.arenaHazard.active && t - state.arenaHazard.lastHazardAt >= hazardEveryMs()){
      startArenaHazard();
    }
  }

  function laneFromY(y){
    const wr = worldRect();
    const h = wr.height || WIN.innerHeight;

    if(y < h * .38) return 'top';
    if(y < h * .66) return 'middle';

    return 'bottom';
  }

  function isInDangerLane(y){
    if(!state.arenaHazard.active) return false;
    return laneFromY(y) === state.arenaHazard.activeZone;
  }

  function applyHazardOnHit(item){
    if(!item || !state.arenaHazard.active) return false;
    if(!isInDangerLane(item.y)) return false;

    state.arenaHazard.hitPenalty++;

    if(item.kind === 'good'){
      state.dangerMeter = clamp(state.dangerMeter + 8, 0, 100);
      state.score = Math.max(0, state.score - 4);
      fx(item.x, item.y, 'เลนอันตราย!', 'bad');
      toast('⚠️ เก็บได้ แต่ระวังเลนอันตราย!');
      return true;
    }

    if(item.kind === 'junk'){
      state.dangerMeter = clamp(state.dangerMeter + 18, 0, 100);
      return true;
    }

    return false;
  }

  function rewardSafeLaneHit(item){
    if(!item || !state.arenaHazard.active) return;
    if(isInDangerLane(item.y)) return;
    if(item.kind !== 'good') return;

    state.arenaHazard.safeHits++;

    if(state.arenaHazard.safeHits % 5 === 0){
      state.heroHit = clamp(state.heroHit + 10, 0, 100);
      toast('✅ เก็บในเลนปลอดภัย: HERO HIT +10%');

      const world = el.gameWorld || DOC.body;
      world.classList.remove('gjHazardSafeGlow');
      void world.offsetWidth;
      world.classList.add('gjHazardSafeGlow');
    }
  }

  function fbCfg(key){
    const v = FINAL_BALANCE[key];

    if(v && typeof v === 'object' && !Array.isArray(v)){
      return v[DIFF] ?? v.normal;
    }

    return v;
  }

  function openingGraceActive(){
    return state.elapsedSec <= Number(fbCfg('openingGraceSec') || 0);
  }

  function canLoseLifeNow(){
    const t = Date.now();
    const win = Number(FINAL_BALANCE.lifeLossWindowMs || 3800);

    if(t - state.finalBalance.lifeLossWindowStartedAt > win){
      state.finalBalance.lifeLossWindowStartedAt = t;
      state.finalBalance.lifeLossInWindow = 0;
    }

    if(state.finalBalance.lifeLossInWindow >= Number(FINAL_BALANCE.maxLifeLossPerWindow || 2)){
      state.finalBalance.preventedLifeLoss++;
      return false;
    }

    state.finalBalance.lifeLossInWindow++;
    state.finalBalance.lastLifeLossAt = t;
    return true;
  }

  function canApplyGoodMissPenalty(){
    const t = Date.now();
    const grace = Number(fbCfg('missGraceMs') || 1000);

    if(t - state.finalBalance.lastGoodMissPenaltyAt < grace){
      state.finalBalance.preventedMissPenalty++;
      return false;
    }

    state.finalBalance.lastGoodMissPenaltyAt = t;
    return true;
  }

  function markOverlayQuiet(){
    state.finalBalance.lastOverlayQuietAt = Date.now();
  }

  function overlayQuietActive(){
    return Date.now() - state.finalBalance.lastOverlayQuietAt < Number(FINAL_BALANCE.overlayQuietMsAfterHit || 900);
  }

  function shouldForceReliefTarget(){
    if(!state.finalBalance.enabled) return '';

    const t = Date.now();

    if(t - state.finalBalance.lastReliefAt < 3200) return '';

    const dangerLimit = Number(fbCfg('dangerReliefAt') || 70);

    if(state.dangerMeter >= dangerLimit){
      state.finalBalance.lastReliefAt = t;
      state.finalBalance.forcedReliefCount++;
      return state.rng() < .62 ? 'weakness' : 'good';
    }

    if(state.lives <= 1 && state.balance.streakMiss >= 1){
      state.finalBalance.lastReliefAt = t;
      state.finalBalance.forcedReliefCount++;
      return 'weakness';
    }

    const maxJunk = Number(fbCfg('maxJunkStreak') || 2);

    if(state.finalBalance.junkStreak >= maxJunk){
      state.finalBalance.lastReliefAt = t;
      state.finalBalance.forcedReliefCount++;
      return 'good';
    }

    return '';
  }

  function maybeBossProgressHelp(){
    if(!state.finalBalance.enabled || state.ended || state.paused || !state.started) return;

    const every = Number(fbCfg('bossProgressHelpEverySec') || 24);

    if(state.elapsedSec - state.finalBalance.lastBossProgressHelpAt < every) return;

    state.finalBalance.lastBossProgressHelpAt = state.elapsedSec;

    const expectedProgress = clamp(state.elapsedSec / Math.max(40, Number(CFG.time || tune.time)), 0, 1);
    const hpPct = state.bossHp / state.bossMaxHp;
    const shouldHaveHpBelow = 1 - expectedProgress * .52;

    if(hpPct > shouldHaveHpBelow && !state.finalRush){
      state.balance.forcedWeaknessNext = Math.max(state.balance.forcedWeaknessNext || 0, 2);
      state.balance.forcedGoodNext = Math.max(state.balance.forcedGoodNext || 0, 1);
      state.finalBalance.forcedReliefCount++;
      pacingToast('จุดอ่อนบอสกำลังออกมาแล้ว เก็บให้ทัน! 🎯', 1300);
    }
  }

  function maybeLateGameRush(){
    if(!state.finalBalance.enabled) return;
    if(state.finalRush || state.finalBalance.lateRushTriggered) return;

    const left = Number(fbCfg('lateGameRushSecLeft') || 28);

    if(state.timeLeft <= left){
      state.finalBalance.lateRushTriggered = true;
      state.finalRush = true;
      markFinalRushStart();
      state.phase = 3;
      markPhaseChange('final');
      updateBossIdentity(true);
      startMissionChain(true);
      checkBossDramaFinal();

      state.balance.forcedWeaknessNext = Math.max(state.balance.forcedWeaknessNext || 0, 3);
      setArenaTheme('final');
      toast('🔥 เข้าสู่ Final Rush แล้ว!');
    }
  }

  function applyOpeningGrace(){
    if(!openingGraceActive()) return;

    if(!state.finalBalance.openingGraceUsed){
      state.finalBalance.openingGraceUsed = true;
      state.balance.forcedGoodNext = Math.max(state.balance.forcedGoodNext || 0, 2);

      if(DIFF === 'easy'){
        state.balance.forcedWeaknessNext = Math.max(state.balance.forcedWeaknessNext || 0, 1);
      }
    }
  }

  function btCfg(section){
    const s = BALANCE_TUNING[section] || {};
    return s[DIFF] || s.normal || {};
  }

  function btScore(key){
    const s = BALANCE_TUNING.scorePacing || {};
    const v = s[key];

    if(v && typeof v === 'object'){
      return v[DIFF] ?? v.normal ?? 0;
    }

    return Number(v || 0);
  }

  function btFinal(key){
    const s = BALANCE_TUNING.finalRush || {};
    const v = s[key];

    if(v && typeof v === 'object'){
      return v[DIFF] ?? v.normal ?? 0;
    }

    return Number(v || 0);
  }

  function finalRushElapsedSec(){
    if(!state.balanceTuning.finalRushStartedAtSec) return 0;
    return Math.max(0, state.elapsedSec - state.balanceTuning.finalRushStartedAtSec);
  }

  function markFinalRushStart(){
    if(state.balanceTuning.finalRushStartedAtSec > 0) return;

    state.balanceTuning.finalRushStartedAtSec = state.elapsedSec;
    state.balanceTuning.finalRushMinMet = false;

    const forced = Number(btFinal('forceWeaknessOnEnter') || 3);
    state.balance.forcedWeaknessNext = Math.max(state.balance.forcedWeaknessNext || 0, forced);

    state.balanceTuning.lastTuningSnapshot = {
      at: Date.now(),
      diff: DIFF,
      finalRushStartedAtSec: state.balanceTuning.finalRushStartedAtSec,
      forcedWeakness: forced
    };
  }

  function finalRushMinimumMet(){
    const cfg = btCfg('fightPacing');
    const min = Number(cfg.finalRushMinSec || 20);

    if(finalRushElapsedSec() >= min){
      state.balanceTuning.finalRushMinMet = true;
    }

    return !!state.balanceTuning.finalRushMinMet;
  }

  function capBossDamage(dmg){
    const cfg = btCfg('fightPacing');
    const cap = Number(cfg.maxBossDamagePerHit || dmg);

    if(dmg > cap){
      state.balanceTuning.damageCappedCount++;
      return cap;
    }

    return dmg;
  }

  function capHeroDamage(dmg){
    const cfg = btCfg('fightPacing');
    const cap = Number(cfg.maxHeroHitDamage || dmg);

    if(dmg > cap){
      state.balanceTuning.heroDamageCappedCount++;
      return cap;
    }

    return dmg;
  }

  function bossHpFloorBeforeFinal(){
    const cfg = btCfg('fightPacing');
    return Number(cfg.bossHpFloorBeforeFinal || 1);
  }

  function minPlaySecBeforeWin(){
    const cfg = btCfg('fightPacing');
    return Number(cfg.minPlaySecBeforeWin || tune.minBossFightSec || 70);
  }

  function canWinByBalance(){
    if(state.timeLeft <= 0) return true;

    if(state.elapsedSec < minPlaySecBeforeWin()){
      return false;
    }

    if(state.finalRush && !finalRushMinimumMet()){
      return false;
    }

    return true;
  }

  function holdWinForBalance(reason = 'balance-hold'){
    const floor = bossHpFloorBeforeFinal();

    state.bossHp = Math.max(1, floor);
    state.balanceTuning.winHeldCount++;

    if(!state.finalRush){
      state.finalRush = true;
      markFinalRushStart();
      state.phase = 3;
      markPhaseChange('final');
      updateBossIdentity(true);
      startMissionChain(true);
      setArenaTheme('final');
      checkBossDramaFinal();
    }

    const t = Date.now();

    if(t - state.balanceTuning.lastBalanceNoteAt > 2800){
      state.balanceTuning.lastBalanceNoteAt = t;
      pacingToast('🔥 บอสเข้าสู่ Final Rush แล้ว เก็บจุดอ่อนให้ไว!', 1500);
    }

    updateHud();
    return true;
  }
    function normalizeVariantAsGameData(v){
    if(!v) return null;

    if(v.kind === 'junk'){
      return {
        emoji: v.emoji,
        label: v.label,
        group: v.group,
        penalty: Number(v.penalty || 1),
        tip: v.tip,
        lesson: v.lesson,
        variant: true,
        tricky: true
      };
    }

    return {
      emoji: v.emoji,
      label: v.label,
      group: v.group,
      dmg: Number(v.dmg || 10),
      charge: Number(v.charge || 8),
      tip: v.tip,
      lesson: v.lesson,
      variant: true,
      tricky: !!v.tricky
    };
  }

  function pickTrickyTarget(){
    const list = TARGET_VARIANTS.tricky || [];
    const trick = state.replayVariety.trickSet;

    if(trick?.groups?.length){
      const focused = list.filter(x => trick.groups.includes(x.group));
      if(focused.length && state.rng() < .72) return pick(focused);
    }

    return list.length ? pick(list) : null;
  }

  function pickWeaknessVariant(){
    const w = currentWeakness();
    const list = TARGET_VARIANTS.bossWeakness || [];
    const filtered = list.filter(x => x.group === w.group);

    return filtered.length ? pick(filtered) : pick(list);
  }

  function balancePushKind(kind){
    state.balance.history.push(kind);

    if(state.balance.history.length > 8){
      state.balance.history.shift();
    }
  }

  function spawnTargetWithData(kind, data, options = {}){
    if(state.ended || state.paused || !state.started) return null;

    const id = `t${++state.targetSeq}`;
    const size = Math.max(
      minTargetSize(),
      Number(options.size || (isMobileView() ? TOUCH_SAFETY.mobilePreferredTargetSize : 58))
    );

    const p = pickSafeSpawn(size);
    const speed = tune.speedMin + state.rng() * (tune.speedMax - tune.speedMin);
    const angle = state.rng() * Math.PI * 2;

    const node = DOC.createElement('button');
    node.type = 'button';
    node.className = `gjTarget ${kind}`;
    node.id = id;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.left = `${p.x}px`;
    node.style.top = `${p.y}px`;
    node.textContent = data.emoji || (kind === 'good' ? '🥦' : '🍟');
    node.setAttribute('aria-label', data.label || kind);

    if(options.variantClass){
      node.classList.add(options.variantClass);
    }

    if(options.showMiniLabel){
      const lab = DOC.createElement('span');
      lab.className = 'gjMiniLabel';
      lab.textContent = data.label || '';
      node.appendChild(lab);
    }

    if(isMobileView()){
      node.classList.add('gjTouchLarge');
    }

    const item = {
      id,
      kind,
      data,
      node,
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * speed * 18,
      vy: Math.sin(angle) * speed * 18,
      size,
      born: now(),
      ttl: Number(options.ttl || (kind === 'good' ? 5600 : 5200))
    };

    node.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      hitTarget(id);
    }, { passive:false });

    raiseTargetNode(node);

    const layer = el.targetLayer || $('targetLayer') || DOC.body;
    layer.appendChild(node);

    state.targets.set(id, item);

    setTimeout(() => auditOneTarget(item), 80);

    if(data.variant || data.tricky){
      state.learningTip.trickySeen++;
    }

    if(options.variantClass === 'weakness'){
      state.learningTip.weaknessSeen++;
    }

    return item;
  }

  function spawnSpecific(token){
    if(!token) return null;

    if(token === 'good'){
      const data = pick(GOOD);
      balancePushKind('good');
      state.finalBalance.goodStreak++;
      state.finalBalance.junkStreak = 0;
      return spawnTargetWithData('good', data, { showMiniLabel: state.rng() < .28 });
    }

    if(token === 'weakness'){
      const v = normalizeVariantAsGameData(pickWeaknessVariant());
      if(v){
        balancePushKind('good');
        state.finalBalance.goodStreak++;
        state.finalBalance.junkStreak = 0;
        return spawnTargetWithData('good', v, {
          variantClass: 'weakness',
          showMiniLabel: true,
          ttl: 6500
        });
      }
    }

    if(['junk','soda','sweet','fried','burger'].includes(token)){
      let list = JUNK;

      if(token === 'soda') list = JUNK.filter(x => x.group === 'soda');
      if(token === 'sweet') list = JUNK.filter(x => x.group === 'sweet');
      if(token === 'fried') list = JUNK.filter(x => x.group === 'fried');
      if(token === 'burger') list = JUNK.filter(x => x.group === 'fatty');

      const data = pick(list.length ? list : JUNK);
      balancePushKind('junk');
      state.finalBalance.junkStreak++;
      state.finalBalance.goodStreak = 0;

      return spawnTargetWithData('junk', data, {
        showMiniLabel: state.rng() < .34
      });
    }

    return spawnTarget();
  }

  function spawnTarget(forceKind = ''){
    if(state.ended || state.paused || !state.started) return null;

    applyOpeningGrace();

    const reliefKind = shouldForceReliefTarget();
    if(!forceKind && reliefKind){
      return spawnTarget(reliefKind);
    }

    if(forceKind === 'good'){
      const data = pick(GOOD);
      balancePushKind('good');
      state.finalBalance.goodStreak++;
      state.finalBalance.junkStreak = 0;
      return spawnTargetWithData('good', data, { showMiniLabel: state.rng() < .25 });
    }

    if(forceKind === 'weakness'){
      const v = normalizeVariantAsGameData(pickWeaknessVariant());
      if(v){
        balancePushKind('good');
        state.finalBalance.goodStreak++;
        state.finalBalance.junkStreak = 0;
        return spawnTargetWithData('good', v, {
          variantClass: 'weakness',
          showMiniLabel: true,
          ttl: 6500
        });
      }
    }

    if(forceKind === 'junk'){
      const data = pick(JUNK);
      balancePushKind('junk');
      state.finalBalance.junkStreak++;
      state.finalBalance.goodStreak = 0;
      return spawnTargetWithData('junk', data, { showMiniLabel: state.rng() < .30 });
    }

    if(state.balance.forcedWeaknessNext > 0){
      state.balance.forcedWeaknessNext--;
      return spawnTarget('weakness');
    }

    if(state.balance.forcedGoodNext > 0){
      state.balance.forcedGoodNext--;
      return spawnTarget('good');
    }

    if(state.phase >= 2 && state.rng() < difficultyAdjustedChance(.16, state.difficultyPersonality.adjustedTrickyBias)){
      const tv = pickTrickyTarget();
      const data = normalizeVariantAsGameData(tv);

      if(data){
        const kind = tv.kind === 'junk' ? 'junk' : 'good';
        balancePushKind(kind);

        if(kind === 'good'){
          state.finalBalance.goodStreak++;
          state.finalBalance.junkStreak = 0;
        }else{
          state.finalBalance.junkStreak++;
          state.finalBalance.goodStreak = 0;
        }

        return spawnTargetWithData(kind, data, {
          variantClass: 'tricky',
          showMiniLabel: true
        });
      }
    }

    const spawnCfg = btCfg('spawnPacing');
    const weaknessBase = state.finalRush ? .22 : .12;
    const weaknessChance = difficultyAdjustedChance(
      weaknessBase + Number(spawnCfg.weaknessChanceBoost || 0),
      state.difficultyPersonality.adjustedWeaknessBias
    );

    if(state.rng() < weaknessChance){
      return spawnTarget('weakness');
    }

    const theme = state.replayVariety.arenaTheme;

    if(theme && state.rng() < .18){
      const useGoodBias = state.rng() < .55;
      const groups = useGoodBias ? theme.goodBias : theme.junkBias;

      if(groups?.length){
        const g = pick(groups);

        if(useGoodBias){
          const found = GOOD.filter(x => x.group === g);

          if(found.length){
            balancePushKind('good');
            state.finalBalance.goodStreak++;
            state.finalBalance.junkStreak = 0;
            return spawnTargetWithData('good', pick(found), {
              showMiniLabel: state.rng() < .35
            });
          }
        }else{
          const found = JUNK.filter(x => x.group === g);

          if(found.length){
            balancePushKind('junk');
            state.finalBalance.junkStreak++;
            state.finalBalance.goodStreak = 0;
            return spawnTargetWithData('junk', pick(found), {
              showMiniLabel: state.rng() < .35
            });
          }
        }
      }
    }

    const calm = Date.now() < state.balance.calmUntil;
    let junkChance = difficultyAdjustedChance(tune.junkChance, state.difficultyPersonality.adjustedJunkBias);

    if(state.finalRush) junkChance += Number(btFinal('junkChanceAdd') || .06);
    if(calm) junkChance -= .10;

    if(state.difficultyPersonality.adjustedGoodBias > 0){
      junkChance = clamp(junkChance - state.difficultyPersonality.adjustedGoodBias, 0, 1);
    }

    junkChance = clamp(junkChance, .12, .68);

    const kind = state.rng() < junkChance ? 'junk' : 'good';

    if(kind === 'good'){
      const data = pick(GOOD);
      balancePushKind('good');
      state.finalBalance.goodStreak++;
      state.finalBalance.junkStreak = 0;
      return spawnTargetWithData('good', data, { showMiniLabel: state.rng() < .22 });
    }

    const data = pick(JUNK);
    balancePushKind('junk');
    state.finalBalance.junkStreak++;
    state.finalBalance.goodStreak = 0;
    return spawnTargetWithData('junk', data, { showMiniLabel: state.rng() < .28 });
  }

  function spawnPowerUp(forceType = ''){
    if(state.ended || state.paused || !state.started) return null;

    const p = pickSafeSpawn(54);
    const data = forceType
      ? POWER_UPS.find(x => x.id === forceType || x.type === forceType) || pick(POWER_UPS)
      : pick(POWER_UPS);

    if(!data) return null;

    const id = `p${++state.powerSeq}`;

    const node = DOC.createElement('button');
    node.type = 'button';
    node.className = 'gjTarget power';
    node.id = id;
    node.style.width = '54px';
    node.style.height = '54px';
    node.style.left = `${p.x}px`;
    node.style.top = `${p.y}px`;
    node.textContent = data.emoji;
    node.setAttribute('aria-label', data.label);

    const item = {
      id,
      kind: 'power',
      data,
      node,
      x: p.x,
      y: p.y,
      size: 54,
      born: now(),
      ttl: 7400
    };

    node.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      collectPowerUp(id);
    }, { passive:false });

    const layer = el.powerLayer || $('powerLayer') || DOC.body;
    layer.appendChild(node);

    state.powerUps.set(id, item);

    return item;
  }

  function removeTarget(id){
    const item = state.targets.get(id);
    if(!item) return;

    safeRemoveNode(item.node);
    state.targets.delete(id);
  }

  function removePowerUp(id){
    const item = state.powerUps.get(id);
    if(!item) return;

    safeRemoveNode(item.node);
    state.powerUps.delete(id);
  }

  function clearTargets(){
    for(const id of Array.from(state.targets.keys())){
      removeTarget(id);
    }

    for(const id of Array.from(state.powerUps.keys())){
      removePowerUp(id);
    }
  }

  function collectPowerUp(id){
    const p = state.powerUps.get(id);
    if(!p) return;

    const type = p.data.type || p.data.id;

    if(type === 'shield'){
      state.activePower.shield++;
      state.powerUpsCollected.shield++;
      fx(p.x, p.y, 'Shield!', 'hero');
      toast('🛡️ Shield พร้อมแล้ว');
      showMicroTutorial('shield', 2800);
    }else if(type === 'slow'){
      state.activePower.slowUntil = Date.now() + 6000;
      state.powerUpsCollected.slow++;
      fx(p.x, p.y, 'Slow!', 'hero');
      toast('⏳ Slow Time!');
    }else if(type === 'cleanBlast'){
      state.powerUpsCollected.cleanBlast++;
      fx(p.x, p.y, 'Clean Blast!', 'hero');
      toast('✨ Clean Blast ล้างขยะ!');
      cleanBlastWave();

      for(const item of Array.from(state.targets.values())){
        if(item.kind === 'junk'){
          removeTarget(item.id);
          state.score += 3;
        }
      }
    }else if(type === 'heart'){
      state.lives = Math.min(tune.lives + 1, state.lives + 1);
      state.powerUpsCollected.heart++;
      fx(p.x, p.y, '+Heart', 'hero');
      toast('💚 ได้หัวใจเพิ่ม!');
    }

    playSound('bonus');
    haptic('bonus');

    removePowerUp(id);
    updateHud();
  }

  function hitTarget(id){
    const item = state.targets.get(id);
    if(!item || state.ended || state.paused) return;

    const hazardTouched = applyHazardOnHit(item);
    markOverlayQuiet();

    if(item.kind === 'good'){
      state.good++;
      state.combo++;
      state.bestCombo = Math.max(state.bestCombo, state.combo);

      if(!state.microTutorial.firstGoodSeen){
        state.microTutorial.firstGoodSeen = true;
        showMicroTutorial('combo', 2800);
      }

      if(item.data.group === 'green') state.greenHits++;
      if(item.data.group === 'protein') state.proteinHits++;
      if(item.data.group === 'fruit') state.fruitHits++;

      let damage = item.data.dmg + Math.floor(state.combo / 9);

      if(state.elapsedSec < 22){
        damage = Math.max(2, Math.round(damage * .72));
      }

      if(state.finalRush){
        damage = Math.round(damage * 1.12);
      }

      if(state.bossShield){
        damage = Math.max(2, Math.round(damage * .35));
      }

      damage = capBossDamage(damage);

      state.bossHp = clamp(state.bossHp - damage, 0, state.bossMaxHp);

      gainHeroHit(item.data.charge + Math.min(7, Math.floor(state.combo / 3)));

      const comboBonus =
        state.combo >= 15 ? 9 :
        state.combo >= 10 ? 6 :
        state.combo >= 5 ? 3 :
        0;

      const baseScore = Number(btScore('goodBase') || 10);
      const maxComboBonus = Number(btScore('comboBonusCap') || 9);
      const tunedComboBonus = Math.min(comboBonus, maxComboBonus);
      const finalBonus = state.finalRush ? 3 : 0;
      const gainedScore = baseScore + tunedComboBonus + finalBonus;

      state.score += gainedScore;

      fx(item.x, item.y, `+${gainedScore}`, 'good');
      feedback('good');
      impactFlash();
      bossShake(state.bossShield ? 'shield' : 'hit');

      maybeShowLearningTip(item.data, true);

      if((item.data?.variant || item.data?.tricky) && !state.microTutorial.trickTipShown){
        state.microTutorial.trickTipShown = true;
        showMicroTutorial('trick', 3300);
      }

      if(item.data?.variant || item.data?.tricky){
        state.learningTip.correctTricky++;
      }

      updateDailyGood(item.data);
      progressMiniMissionByGood(item.data);
      updateMissionChainByGood(item.data);
      rewardSafeLaneHit(item);

      directorAfterGood();
      checkBossDramaAfterGood();
      pulseTargetNode(item.node);
      checkComboJuice();

      if(state.patternScript?.activePatternId){
        state.patternScript.activePatternSuccess++;
      }

      removeTarget(id);
      checkPhase();

      if(state.bossHp <= 0){
        tryWinOrForceRush();
      }

      updateHud();
      return;
    }

    if(item.kind === 'junk'){
      state.junkHit++;
      state.miss++;
      state.combo = 0;

      if(!state.microTutorial.firstJunkSeen){
        state.microTutorial.firstJunkSeen = true;
        showMicroTutorial('firstJunk', 3200);
      }

      maybeShowLearningTip(item.data, false);

      if((item.data?.variant || item.data?.tricky) && !state.microTutorial.trickTipShown){
        state.microTutorial.trickTipShown = true;
        showMicroTutorial('trick', 3300);
      }

      if(item.data?.variant || item.data?.tricky){
        state.learningTip.missedTricky++;
      }

      updateDailyJunk(item.data);
      updateMissionChainByJunk(item.data);

      let extraDanger = hazardTouched ? 1 : 0;
      let penalty = item.data.penalty + extraDanger;

      if(Date.now() < state.comeback.activeUntil){
        penalty = Math.max(1, penalty - 1);
      }

      if(state.activePower.shield > 0){
        state.activePower.shield--;
        fx(item.x, item.y, 'Shield!', 'hero');
        toast('🛡️ Shield กันพลาดแล้ว');
        feedback('shield');
      }else{
        const lifeLossAllowed = canLoseLifeNow();

        if(lifeLossAllowed){
          state.lives = Math.max(0, state.lives - penalty);
        }else{
          state.score = Math.max(0, state.score - 3);
          fx(item.x, item.y, 'ระวัง!', 'bad');
          toast('เกมให้โอกาสตั้งหลักอีกครั้ง');
        }

        state.score = Math.max(0, state.score - Number(btScore('junkPenaltyScore') || 6));
        state.dangerMeter = clamp(state.dangerMeter + 18 + extraDanger * 8, 0, 100);
        fx(item.x, item.y, lifeLossAllowed ? 'พลาด!' : 'กันหัวร้อน!', 'bad');
        feedback('bad');
      }

      directorAfterMistake();
      checkBossDramaAfterMistake();

      if(state.patternScript?.activePatternId){
        state.patternScript.activePatternMistake++;
      }

      removeTarget(id);
      updateHud();

      if(state.lives <= 0){
        if(!state.comeback.rescueGiven && triggerComeback('last-heart-rescue')){
          state.lives = 1;
          toast('💚 Last Heart Rescue!');
          updateHud();
        }else{
          endGame(false);
        }
      }

      return;
    }
  }

  function missGoodTarget(item){
    if(!item || state.ended) return;

    state.missedGood++;
    state.miss++;
    state.combo = 0;

    if(canApplyGoodMissPenalty()){
      state.score = Math.max(0, state.score - Number(btScore('missedGoodPenaltyScore') || 4));
      state.dangerMeter = clamp(state.dangerMeter + 8, 0, 100);
    }else{
      state.score = Math.max(0, state.score - 1);
    }

    maybeShowLearningTip(item.data, false);

    fx(item.x, item.y, 'หลุด!', 'bad');
    feedback('bad');

    directorAfterMistake();
    checkBossDramaAfterMistake();

    if(state.patternScript?.activePatternId){
      state.patternScript.activePatternMistake++;
    }

    updateHud();

    if(state.lives <= 0){
      if(!state.comeback.rescueGiven && triggerComeback('last-heart-rescue')){
        state.lives = 1;
        toast('💚 Last Heart Rescue!');
        updateHud();
      }else{
        endGame(false);
      }
    }
  }

  function pickMiniMission(){
    const list = MINI_MISSIONS.slice();
    return list[Math.floor(state.rng() * list.length)] || MINI_MISSIONS[0];
  }

  function startMiniMission(force = false){
    if(!force && Date.now() - state.bossExperience.lastMissionAt < 18000) return;

    const m = pickMiniMission();

    state.bossExperience.currentMission = m;
    state.bossExperience.missionProgress = 0;
    state.bossExperience.missionTarget = m.target || 1;
    state.bossExperience.missionRewardReady = false;
    state.bossExperience.lastMissionAt = Date.now();

    updateMiniMissionHud();
  }

  function updateMiniMissionHud(){
    ensureBossExperienceDom();

    const m = state.bossExperience.currentMission;
    const text = $('gjMiniMissionText');
    const count = $('gjMiniMissionCount');
    const fill = $('gjMiniMissionFill');

    if(!m){
      if(text) text.textContent = '🎯 ภารกิจ: พร้อมเริ่ม';
      if(count) count.textContent = '0/0';
      if(fill) fill.style.width = '0%';
      return;
    }

    const p = clamp(state.bossExperience.missionProgress, 0, state.bossExperience.missionTarget);
    const t = Math.max(1, state.bossExperience.missionTarget);

    if(text) text.textContent = `${m.icon} ภารกิจ: ${m.title}`;
    if(count) count.textContent = `${p}/${t}`;
    if(fill) fill.style.width = `${clamp((p / t) * 100, 0, 100)}%`;
  }

  function rewardMiniMission(){
    const m = state.bossExperience.currentMission;
    if(!m || state.bossExperience.missionRewardReady) return;

    state.bossExperience.missionRewardReady = true;

    if(m.reward === 'shield'){
      state.activePower.shield++;
      toast('🏅 ภารกิจสำเร็จ: ได้ Shield!');
    }else if(m.reward === 'hero'){
      state.heroHit = clamp(state.heroHit + 28, 0, 100);
      toast('🏅 ภารกิจสำเร็จ: HERO HIT +28%!');
    }else if(m.reward === 'slow'){
      state.activePower.slowUntil = Date.now() + 5500;
      toast('🏅 ภารกิจสำเร็จ: Slow Time!');
    }else{
      state.score += 25;
      toast('🏅 ภารกิจสำเร็จ: +25 คะแนน!');
    }

    feedback('win');
    playSound('bonus');
    haptic('bonus');
    updateHud();

    setTimeout(() => {
      startMiniMission(true);
    }, 1400);
  }

  function progressMiniMissionByGood(data){
    const m = state.bossExperience.currentMission;
    if(!m) return;

    if(m.type === 'collect_group' && data.group === m.group){
      state.bossExperience.missionProgress++;
    }

    if(m.type === 'combo' && state.combo >= m.target){
      state.bossExperience.missionProgress = m.target;
    }

    updateMiniMissionHud();

    if(state.bossExperience.missionProgress >= state.bossExperience.missionTarget){
      rewardMiniMission();
    }
  }

  function currentPatternPhaseKey(){
    if(state.finalRush) return 'final';
    if(state.phase >= 3) return 'phase3';
    if(state.phase >= 2) return 'phase2';
    return 'phase1';
  }

  function getNextBossPattern(){
    const key = currentPatternPhaseKey();
    const list = BOSS_PATTERN_SCRIPT[key] || BOSS_PATTERN_SCRIPT.phase1 || [];

    if(!list.length) return null;

    const idx = state.patternScript.index[key] || 0;
    const pattern = list[idx % list.length];

    state.patternScript.index[key] = idx + 1;
    state.patternScript.currentPhaseKey = key;

    return pattern;
  }

  function resetPatternStats(pattern){
    state.patternScript.activePatternId = pattern?.id || '';
    state.patternScript.activePatternName = pattern?.name || '';
    state.patternScript.activePatternStartedAt = Date.now();
    state.patternScript.activePatternSuccess = 0;
    state.patternScript.activePatternMistake = 0;
    state.patternScript.patternRewardGiven = false;
  }

  function givePatternReward(pattern){
    if(!pattern || state.patternScript.patternRewardGiven) return;

    state.patternScript.patternRewardGiven = true;

    const reward = pattern.reward || '';

    if(reward === 'hero'){
      state.heroHit = clamp(state.heroHit + 18, 0, 100);
      toast('🎁 Pattern Reward: HERO HIT +18%');
    }else if(reward === 'slow'){
      state.activePower.slowUntil = Date.now() + 4500;
      toast('🎁 Pattern Reward: Slow Time');
    }else if(reward === 'shield'){
      state.activePower.shield++;
      toast('🎁 Pattern Reward: Shield');
    }else if(reward === 'cleanBlast'){
      spawnPowerUp('cleanBlast');
      toast('🎁 Pattern Reward: Clean Blast');
    }else if(reward === 'shieldBreak'){
      state.bossHp = clamp(state.bossHp - Math.round(state.bossMaxHp * .035), 0, state.bossMaxHp);
      toast('🎁 Pattern Reward: โล่บอสอ่อนลง!');
      bossShake('shield');
    }else{
      state.score += 18;
      toast('🎁 Pattern Reward: +18 คะแนน');
    }

    updateHud();
  }

  function runBossPattern(pattern){
    if(!pattern || state.ended || state.paused || !state.started) return false;

    resetPatternStats(pattern);

    state.patternScript.lastPatternAt = Date.now();

    bossSpeak(`${pattern.speech}`, 1300);
    warningFlash(900);
    safeFinalRushToast(`⚠️ ${pattern.warning}`, 1300);

    if(state.phase >= 2 && state.rng() < (state.finalRush ? .70 : .42)){
      setTimeout(() => {
        startArenaHazard();
      }, 450);
    }

    const tokens = Array.isArray(pattern.tokens) ? pattern.tokens : [];
    const delay = difficultyPatternDelay(pattern.delay || 140);

    tokens.forEach((token, i) => {
      setTimeout(() => {
        if(state.ended || state.paused || !state.started) return;
        spawnSpecific(token);
      }, 850 + i * delay);
    });

    setTimeout(() => {
      if(state.ended || state.paused || !state.started) return;

      const total = state.patternScript.activePatternSuccess + state.patternScript.activePatternMistake;
      const goodRate = total ? state.patternScript.activePatternSuccess / total : 0;

      if(goodRate >= .62 && state.patternScript.activePatternSuccess >= 2){
        givePatternReward(pattern);
      }else{
        toast('จังหวะต่อไป ดูเป้าให้ชัดขึ้นนะ');
      }
    }, 850 + tokens.length * delay + 1050);

    return true;
  }

  function bossAttack(){
    if(state.ended || state.paused || !state.started || state.bossSkillCooldownLock) return;

    state.bossSkillCooldownLock = true;

    setTimeout(() => {
      state.bossSkillCooldownLock = false;
    }, 900);

    const nowMs = Date.now();

    if(
      state.patternScript?.enabled &&
      nowMs - state.patternScript.lastPatternAt >= state.patternScript.patternCooldownMs
    ){
      const pattern = getNextBossPattern();

      if(pattern && runBossPattern(pattern)){
        state.dangerMeter = clamp(state.dangerMeter + 8, 0, 100);

        if(!state.finalRush){
          updateHud();
          return;
        }

        if(state.rng() < .55){
          updateHud();
          return;
        }
      }
    }

    const skill = pickBossSkillByIdentity();
    if(!skill) return;

    const identityLine = bossIdentitySpeech();

    if(identityLine){
      bossSpeak(identityLine, 1050);
    }

    safeFinalRushToast(`${skill.emoji} ${skill.name}!`, 1200);

    setTimeout(() => {
      bossSpeak(`${skill.emoji} ${skill.warning}`, Math.max(900, skill.telegraphMs));
    }, identityLine ? 780 : 0);

    warningFlash(skill.telegraphMs || 900);

    state.dangerMeter = clamp(state.dangerMeter + (skill.dangerGain || 12), 0, 100);

    if(skill.shieldRegen && !state.finalRush){
      state.bossShield = true;
      bossShake('shield');
    }

    const pattern = Array.isArray(skill.pattern) ? skill.pattern : ['junk','good','weakness'];

    pattern.forEach((token, i) => {
      setTimeout(() => {
        if(state.ended || state.paused || !state.started) return;
        spawnSpecific(token);
      }, (skill.telegraphMs || 800) + i * (skill.waveDelay || 140));
    });

    updateHud();
  }

  function dramaSpeak(text, ms = 1300, minGap = 1800){
    if(!state.bossDrama.enabled) return false;

    const t = Date.now();

    if(t - state.bossDrama.lastDramaAt < minGap) return false;

    state.bossDrama.lastDramaAt = t;
    bossSpeak(text, ms);
    return true;
  }

  function checkBossDramaAfterGood(){
    if(!state.bossDrama.enabled) return;

    for(const r of BOSS_DRAMA.comboReact){
      if(state.combo >= r.at && !state.bossDrama.comboReacted[r.at]){
        state.bossDrama.comboReacted[r.at] = true;
        dramaSpeak(r.text, 1300);
        break;
      }
    }

    if(state.heroHit >= 100 && !state.bossDrama.heroReadyReacted){
      state.bossDrama.heroReadyReacted = true;
      dramaSpeak(pick(BOSS_DRAMA.heroReady), 1500);
    }

    const hpPct = bossHpPct();

    for(const r of BOSS_DRAMA.lowHp){
      if(hpPct <= r.pct && !state.bossDrama.lowHpReacted[r.pct]){
        state.bossDrama.lowHpReacted[r.pct] = true;
        dramaSpeak(r.text, 1400);
        break;
      }
    }
  }

  function checkBossDramaAfterMistake(){
    if(!state.bossDrama.enabled) return;

    const t = Date.now();

    if(t - state.bossDrama.lastTauntAt < 3600) return;

    state.bossDrama.lastTauntAt = t;

    const tone = currentDifficultyPersonality().bossDramaTone;

    let line = pick(BOSS_DRAMA.mistakeTaunt);

    if(tone === 'coach'){
      line = 'ไม่เป็นไร ลองดูให้ชัดก่อนแตะนะ!';
    }else if(tone === 'bossy'){
      line = 'Challenge นี้ข้าไม่ยอมให้ผ่านง่าย ๆ หรอก!';
    }

    dramaSpeak(line, 1100);
  }

  function checkBossDramaFinal(){
    if(!state.bossDrama.enabled) return;
    if(!state.finalRush || state.bossDrama.finalFearShown) return;

    state.bossDrama.finalFearShown = true;
    dramaSpeak(pick(BOSS_DRAMA.finalFear), 1600, 0);
  }

  function checkBossDramaComeback(){
    if(!state.bossDrama.enabled) return;
    if(state.bossDrama.comebackReacted) return;

    state.bossDrama.comebackReacted = true;
    dramaSpeak(pick(BOSS_DRAMA.comebackRespect), 1500, 0);
  }

  function canChangePhase(minWait = 0){
    return state.elapsedSec - state.pacing.lastPhaseChangeSec >= minWait;
  }

  function markPhaseChange(name = ''){
    state.pacing.lastPhaseChangeSec = state.elapsedSec;

    if(name){
      state.pacing.phaseGate[name] = true;
    }
  }

  function minimumFightReached(){
    return state.elapsedSec >= (tune.minBossFightSec || tune.minWinSec || 70);
  }

  function pacingToast(msg, ms = 1200){
    const t = Date.now();

    if(t - state.pacing.lastPacingToastAt < 3000) return;

    state.pacing.lastPacingToastAt = t;
    toast(msg, ms);
  }

  function applyDangerDecay(dt){
    const rate = Number(tune.dangerDecayPerSec || 0);

    if(rate <= 0) return;

    if(state.dangerMeter > 0){
      state.dangerMeter = clamp(state.dangerMeter - rate * dt, 0, 100);
    }
  }

  function gainHeroHit(amount){
    const t = Math.floor(Date.now() / 1000);

    if(state.pacing.lastHeroHitGainAt !== t){
      state.pacing.lastHeroHitGainAt = t;
      state.pacing.heroHitGainedThisSec = 0;
    }

    const cap = Number(tune.heroHitMaxPerSec || 1.5);
    const remaining = Math.max(0, cap - state.pacing.heroHitGainedThisSec);
    const gain = Math.min(Number(amount) || 0, remaining);

    state.pacing.heroHitGainedThisSec += gain;
    state.heroHit = clamp(state.heroHit + gain, 0, 100);

    return gain;
  }

  function shouldSoftHoldWin(){
    if(minimumFightReached()) return false;
    if(state.timeLeft <= 18) return false;
    return true;
  }

  function applySoftWinHold(){
    if(!shouldSoftHoldWin()) return false;

    const holdHp = Math.max(1, Math.round(state.bossMaxHp * (tune.softWinHoldHpPct || .06)));

    if(state.bossHp <= 0){
      state.bossHp = holdHp;
    }

    if(!state.pacing.softWinLocked){
      state.pacing.softWinLocked = true;
      state.pacing.softWinUnlockedAt = Date.now() + 3000;
      state.pacing.bossEnrageCount++;
      pacingToast('บอสยังไม่ยอมแพ้! ต้องผ่าน Final Rush ก่อน 🔥', 1600);

      state.finalRush = true;
      markFinalRushStart();
      state.phase = 3;

      setArenaTheme('final');
      updateBossIdentity(true);
      startMissionChain(true);

      if(state.balance){
        state.balance.forcedWeaknessNext = Math.max(state.balance.forcedWeaknessNext || 0, 3);
      }

      bossSpeak('ข้ายังไม่แพ้! Final Rush!', 1600);
      bossAttack();
    }

    return true;
  }

  function canActuallyWin(){
    if(state.timeLeft <= 0) return true;
    if(!canWinByBalance()) return false;
    if(!state.finalRush) return false;
    return true;
  }

  function tryWinOrForceRush(){
    if(applySoftWinHold()){
      updateHud();
      return;
    }

    if(!canWinByBalance()){
      holdWinForBalance('tryWinOrForceRush');
      return;
    }

    if(canActuallyWin()){
      return finishMove();
    }

    state.bossHp = Math.max(
      1,
      Math.round(state.bossMaxHp * (tune.softWinHoldHpPct || .06))
    );

    state.finalRush = true;
    markFinalRushStart();
    state.phase = 3;

    setArenaTheme('final');
    updateBossIdentity(true);
    startMissionChain(true);

    pacingToast('🔥 Final Rush! เก็บอาหารจุดอ่อนแล้วใช้ HERO HIT', 1600);

    if(state.balance){
      state.balance.forcedWeaknessNext = Math.max(state.balance.forcedWeaknessNext || 0, 3);
    }

    bossAttack();
    updateHud();
  }

  function checkPhase(){
    const hp = state.bossHp / state.bossMaxHp;

    if(!state.pacing.minimumFightReached && minimumFightReached()){
      state.pacing.minimumFightReached = true;
      pacingToast('จังหวะบอสเต็มรูปแบบแล้ว ลุยให้จบ! ⚡', 1400);
    }

    if(state.bossShield && state.elapsedSec >= tune.shieldUntilSec && canChangePhase(10)){
      state.bossShield = false;
      markPhaseChange('shield');
      updateBossIdentity(true);
      startMissionChain(true);

      if(!state.phaseAnnounced.shieldBreak){
        state.phaseAnnounced.shieldBreak = true;
        toast('🛡️ โล่บอสแตกแล้ว!');
        showShieldCrack();
        impactFlash();
        bossSpeak('โล่ข้าแตกแล้ว! แต่พายุขยะกำลังมา!', 1600);
        setArenaTheme('storm');
      }
    }

    if(!state.finalRush && hp <= tune.finalRushAt && canChangePhase(tune.phaseHoldSec || 18)){
      state.finalRush = true;
      markFinalRushStart();
      state.phase = 3;
      markPhaseChange('final');
      updateBossIdentity(true);
      startMissionChain(true);
      checkBossDramaFinal();

      if(!state.phaseAnnounced.finalRush){
        state.phaseAnnounced.finalRush = true;
        toast('🔥 FINAL RUSH!');
        setArenaTheme('final');

        if(state.bossExperience && !state.bossExperience.finalRushBoostGiven){
          state.bossExperience.finalRushBoostGiven = true;
          state.heroHit = clamp(state.heroHit + 25, 0, 100);
          state.balance.forcedWeaknessNext = Math.max(state.balance.forcedWeaknessNext || 0, 3);
          bossSpeak('🔥 Final Rush! เก็บผลไม้แล้วใช้ HERO HIT!', 1800);
        }

        bossAttack();
      }

      checkBossDramaFinal();

      if(state.finalRush && !state.microTutorial.finalTipShown){
        state.microTutorial.finalTipShown = true;
        showMicroTutorial('finalRush', 3400);
      }

      return;
    }

    if(hp <= .62 && state.phase < 2 && canChangePhase(tune.phaseHoldSec || 18)){
      state.phase = 2;
      markPhaseChange('phase2');
      updateBossIdentity(true);
      startMissionChain(true);

      if(!state.phaseAnnounced.phase2){
        state.phaseAnnounced.phase2 = true;
        toast('🌪️ Phase 2: Junk Storm');
        setArenaTheme('storm');
        bossAttack();
      }

      return;
    }

    if(hp <= .36 && state.phase < 3 && canChangePhase(tune.phaseHoldSec || 18)){
      state.phase = 3;
      markPhaseChange('phase3');
      updateBossIdentity(true);
      startMissionChain(true);

      if(!state.phaseAnnounced.phase3){
        state.phaseAnnounced.phase3 = true;
        toast('😡 Phase 3: Boss Rage');
        setArenaTheme('rage');
        bossAttack();
      }
    }

    if(state.timeLeft <= 28 && !state.finalRush){
      state.finalRush = true;
      markFinalRushStart();
      state.phase = 3;
      markPhaseChange('final');
      updateBossIdentity(true);
      startMissionChain(true);

      toast('🔥 FINAL RUSH!');
      setArenaTheme('final');
      bossAttack();
    }

    checkBossDramaFinal();

    if(state.finalRush && !state.microTutorial.finalTipShown){
      state.microTutorial.finalTipShown = true;
      showMicroTutorial('finalRush', 3400);
    }
  }

  function useHeroHit(){
    if(state.ended || state.paused || !state.started) return;

    if(state.heroHit < 100){
      toast('HERO HIT ยังไม่พร้อม');
      return;
    }

    const base = tune.heroHitDmg || 66;
    let dmg = base;

    if(state.finalRush) dmg = Math.round(dmg * 1.25);
    if(state.missionChain.finishBoostReady) dmg = Math.round(dmg * 1.18);

    dmg = capHeroDamage(dmg);

    state.heroHit = 0;
    state.score += 35;
    state.combo = Math.max(state.combo, 1);

    state.bossHp = clamp(state.bossHp - dmg, 0, state.bossMaxHp);

    clearTargets();

    showHeroCutIn('🦸 HERO HIT!', `โจมตีบอส -${dmg}`);
    impactFlash();
    bossShake('hit');
    feedback('hero');

    updateMissionChainByHeroHit();

    if(state.bossHp <= 0 && applySoftWinHold()){
      updateHud();
      return;
    }

    if(state.bossHp <= 0){
      tryWinOrForceRush();
    }

    updateHud();
  }

  function finishMove(){
    if(state.ended) return;

    clearTargets();
    endArenaHazard();

    feedback('hero');
    toast('HEALTHY FINISH!');
    playSound('win');
    haptic('win');
    screenShake('win');
    showHeroCutIn('🌟 HEALTHY FINISH!', 'Junk King ถูกพลังอาหารดีปราบแล้ว');
    impactFlash();
    bossDefeatFx();

    setTimeout(() => {
      endGame(true);
    }, 1050);
  }

  function calcAccuracy(){
    const total = state.good + state.junkHit + state.missedGood;
    if(!total) return 0;
    return Math.round((state.good / total) * 100);
  }

  function bossHpPct(){
    return Math.round((state.bossHp / state.bossMaxHp) * 100);
  }

  function currentStarGoals(){
    return STAR_GOALS[DIFF] || STAR_GOALS.normal;
  }

  function evaluateStarGoals(){
    const g = currentStarGoals();
    const acc = calcAccuracy();
    const hp = bossHpPct();

    const one =
      state.score >= g.one.score ||
      acc >= g.one.acc ||
      hp <= g.one.bossHpPct;

    const two =
      state.score >= g.two.score &&
      (acc >= g.two.acc || hp <= g.two.bossHpPct);

    const three =
      state.score >= g.three.score &&
      acc >= g.three.acc &&
      state.miss <= g.three.maxMiss;

    if(three) return 3;
    if(two) return 2;
    if(one) return 1;
    return 0;
  }

  function starTextFromCount(n){
    if(n >= 3) return '⭐⭐⭐';
    if(n === 2) return '⭐⭐';
    if(n === 1) return '⭐';
    return '☆';
  }

  function calcStars(){
    const n = evaluateStarGoals();

    if(state.bossHp <= 0 && n < 1){
      return '⭐';
    }

    return starTextFromCount(n);
  }

  function updateStarGoalHud(){
    ensureIntroGoalDom();

    const hud = $('gjStarGoalHud');
    const text = $('gjStarGoalHudText');

    if(!hud) return;

    if(!state.started || state.ended){
      hud.classList.remove('show');
      return;
    }

    const stars = evaluateStarGoals();

    hud.classList.add('show');

    if(text){
      text.textContent = `${starTextFromCount(stars)} • คะแนน ${state.score}`;
    }
  }

  function updateHud(){
    try{
      cacheElements();

      setText(el.timeText, Math.max(0, Math.ceil(state.timeLeft)));
      setText(el.scoreText, state.score);
      setText(el.livesText, state.lives);
      setText(el.comboText, state.combo);
      setText(el.heroHitPct, `${Math.round(state.heroHit)}%`);

      if(el.heroHitBtn){
        el.heroHitBtn.classList.toggle('ready', state.heroHit >= 100);
        el.heroHitBtn.disabled = state.heroHit < 100 || state.paused || state.ended;

        if(state.heroHit >= 100 && !state.microTutorial.heroReadyTipShown){
          state.microTutorial.heroReadyTipShown = true;
          showMicroTutorial('heroReady', 3300);
        }
      }

      if(el.bossHpFill){
        const pct = clamp((state.bossHp / state.bossMaxHp) * 100, 0, 100);
        el.bossHpFill.style.width = `${pct}%`;
      }

      if(el.bossHpText){
        const shield = state.bossShield ? '🛡️ ' : '';
        el.bossHpText.textContent = `${shield}${currentBossIdentity().name} HP ${Math.max(0, Math.round(state.bossHp))}/${state.bossMaxHp}`;
      }

      if(el.dangerMeterFill){
        el.dangerMeterFill.style.height = `${clamp(state.dangerMeter, 0, 100)}%`;
      }

      if(el.coachText){
        el.coachText.textContent = fullCoachText();
      }

      callMaybe(updateMiniMissionHud);
      callMaybe(updateMissionChainHud);
      callMaybe(updateStarGoalHud);
      callMaybe(updateComebackPill);
      callMaybe(updateArenaThemeHud);
      callMaybe(updateDifficultyBadge);
      callMaybe(updateSoundButton);
    }catch(err){
      recordRuntimeError('updateHud', err);
    }
  }

  function updateTargets(dt){
    const t = now();

    for(const [id, item] of Array.from(state.targets.entries())){
      const age = t - item.born;

      if(age >= item.ttl){
        if(item.kind === 'good'){
          missGoodTarget(item);
        }

        removeTarget(id);
        continue;
      }

      const slow = Date.now() < state.activePower.slowUntil ? .35 : 1;
      item.x += item.vx * dt * slow;
      item.y += item.vy * dt * slow;

      const safe = getSafeArenaRect(item.size || 58);

      if(item.x < safe.left || item.x > safe.right) item.vx *= -1;
      if(item.y < safe.top || item.y > safe.bottom) item.vy *= -1;

      item.x = clamp(item.x, safe.left, safe.right);
      item.y = clamp(item.y, safe.top, safe.bottom);

      item.node.style.left = `${item.x}px`;
      item.node.style.top = `${item.y}px`;
    }

    for(const [id, item] of Array.from(state.powerUps.entries())){
      const age = t - item.born;

      if(age >= item.ttl){
        removePowerUp(id);
        continue;
      }
    }
  }

  function maybeSpawn(dt){
    const spawnCfg = btCfg('spawnPacing');
    const maxTargets = Number(spawnCfg.maxTargets || tune.maxTargets);

    if(state.targets.size >= maxTargets) return;

    const nowMs = now();
    let every = tune.spawnEvery;

    if(state.finalRush) every *= Number(btFinal('spawnBoost') || .74);
    if(Date.now() < state.activePower.slowUntil) every *= 1.18;
    if(Date.now() < state.balance.calmUntil) every *= 1.24;

    const minSpawnMs = Number(spawnCfg.minSpawnMs || 520);
    every = Math.max(minSpawnMs, every);

    if(nowMs - state.lastSpawn >= every){
      state.lastSpawn = nowMs;
      spawnTarget();

      const powerChance = Number(spawnCfg.powerChance || .055);

      if(state.rng() < powerChance){
        spawnPowerUp();
      }
    }
  }

  function showBonusRoundBanner(){
    ensureReplayVarietyDom();

    const box = $('gjBonusRoundBanner');
    if(!box) return;

    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');

    clearTimeout(showBonusRoundBanner._t);
    showBonusRoundBanner._t = setTimeout(() => {
      box.classList.remove('show');
    }, 980);
  }

  function startBonusRound(){
    if(!state.replayVariety.enabled) return;
    if(state.replayVariety.bonusRoundActive) return;
    if(state.ended || state.paused || !state.started) return;

    state.replayVariety.bonusRoundActive = true;
    state.replayVariety.bonusRoundStartedAt = Date.now();
    state.replayVariety.bonusRoundEndsAt = Date.now() + REPLAY_VARIETY.bonusRoundDurationMs;
    state.replayVariety.bonusRoundCount++;
    state.replayVariety.lastBonusAtSec = state.elapsedSec;

    const world = el.gameWorld || $('gameWorld');
    world?.classList.add('gjBonusRoundActive');

    showBonusRoundBanner();
    playSound('bonus');
    haptic('bonus');
    bossSpeak('อะไรนะ! อาหารดีออกมาเยอะเกินไปแล้ว!', 1500);

    state.balance.forcedGoodNext = Math.max(state.balance.forcedGoodNext, 5);
    state.balance.forcedWeaknessNext = Math.max(state.balance.forcedWeaknessNext, 2);
  }

  function updateBonusRound(){
    if(!state.replayVariety.enabled) return;

    if(
      !state.replayVariety.bonusRoundActive &&
      state.elapsedSec >= 20 &&
      state.elapsedSec - state.replayVariety.lastBonusAtSec >= REPLAY_VARIETY.bonusRoundEvery &&
      state.rng() < (.018 + Number(currentDifficultyPersonality().bonusChanceBoost || 0))
    ){
      startBonusRound();
    }

    if(state.replayVariety.bonusRoundActive && Date.now() >= state.replayVariety.bonusRoundEndsAt){
      state.replayVariety.bonusRoundActive = false;
      const world = el.gameWorld || $('gameWorld');
      world?.classList.remove('gjBonusRoundActive');
      toast('Bonus Round จบแล้ว!');
    }
  }

  function gameLoop(ts){
    if(state.ended) return;

    try{
      if(!state.lastFrame) state.lastFrame = ts;
      const dt = Math.min(.05, (ts - state.lastFrame) / 1000);
      state.lastFrame = ts;

      if(!state.paused && state.started){
        state.elapsedSec = (performance.now() - state.startTs) / 1000;
        state.timeLeft = Math.max(0, (Number(CFG.time) || tune.time) - state.elapsedSec);

        applyDangerDecay(dt);
        updateArenaHazard();
        tickMissionChain();
        updateBonusRound();
        maybeBossProgressHelp();
        maybeLateGameRush();
        finalRushMinimumMet();
        checkComebackRecovery();
        updateComebackPill();

        updateTargets(dt);

        if(state.rng() < .08){
          auditTargets();
        }

        maybeSpawn(dt);

        if(now() - state.lastBossAttack > tune.bossAttackEvery){
          state.lastBossAttack = now();
          bossAttack();
        }

        checkPhase();
        checkBossDramaFinal();

        if(state.finalRush && !state.microTutorial.finalTipShown){
          state.microTutorial.finalTipShown = true;
          showMicroTutorial('finalRush', 3400);
        }

        updateHud();
        updateTouchDebug();

        if(state.rng() < .012){
          runQaLock({ show:false });
        }

        if(state.timeLeft <= 0){
          const scoreNeed = Number(tune.scoreWinNeed || Math.round(state.bossMaxHp * .45));
          const winByScore = state.score >= scoreNeed && state.bossHp <= Math.round(state.bossMaxHp * .28);
          const winByBoss = state.bossHp <= 0;

          endGame(winByBoss || winByScore);
          return;
        }
      }
    }catch(err){
      recordRuntimeError('gameLoop', err);
      recoverRuntime('gameLoop-error');
    }

    requestAnimationFrame(gameLoop);
  }
    function renderStarGoalsIntro(){
    ensureIntroGoalDom();

    const grid = $('gjStarGoalGrid');
    const g = currentStarGoals();

    if(!grid) return;

    grid.innerHTML = `
      <div class="gjStarGoalCard">
        <div class="gjStarGoalStars">⭐</div>
        <div class="gjStarGoalTitle">1 ดาว</div>
        <div class="gjStarGoalText">${g.one.text}</div>
      </div>

      <div class="gjStarGoalCard">
        <div class="gjStarGoalStars">⭐⭐</div>
        <div class="gjStarGoalTitle">2 ดาว</div>
        <div class="gjStarGoalText">${g.two.text}</div>
      </div>

      <div class="gjStarGoalCard">
        <div class="gjStarGoalStars">⭐⭐⭐</div>
        <div class="gjStarGoalTitle">3 ดาว</div>
        <div class="gjStarGoalText">${g.three.text}</div>
      </div>
    `;
  }

  function showBossIntro(){
    if(!state.introGoal.enabled || state.introGoal.skipped){
      return Promise.resolve();
    }

    ensureIntroGoalDom();
    updateBossIdentity(true);
    renderStarGoalsIntro();

    const overlay = $('gjBossIntro');
    const boss = $('gjBossIntroBoss');
    const title = $('gjBossIntroTitle');
    const sub = $('gjBossIntroSub');
    const readyBtn = $('gjIntroReadyBtn');
    const skipBtn = $('gjIntroSkipBtn');
    const count = $('gjCountdownBubble');

    const identity = currentBossIdentity();

    if(boss) boss.textContent = identity.emoji || '👑🍔';
    if(title) title.textContent = `${identity.name} มาแล้ว!`;
    if(sub) sub.textContent = `${identity.tip || 'เก็บอาหารดี หลบอาหารขยะ แล้วใช้ HERO HIT ปิดฉาก'}`;

    if(count){
      count.style.display = 'none';
      count.textContent = '3';
    }

    if(overlay){
      overlay.classList.add('show');
    }

    state.introGoal.showing = true;
    state.introGoal.introStartedAt = Date.now();
    state.introGoal.starGoalShown = true;

    return new Promise(resolve => {
      let done = false;

      function cleanup(){
        readyBtn?.removeEventListener('click', onReady);
        skipBtn?.removeEventListener('click', onSkip);
        clearInterval(state.introGoal.countdownTimer);
      }

      function finish(skipped = false){
        if(done) return;
        done = true;

        cleanup();

        state.introGoal.skipped = !!skipped;
        state.introGoal.showing = false;
        state.introGoal.introEndedAt = Date.now();

        if(overlay){
          overlay.classList.remove('show');
        }

        resolve();
      }

      function startCountdown(){
        state.introGoal.goalRead = true;
        state.introGoal.countdown = 3;

        if(count){
          count.style.display = 'grid';
          count.textContent = '3';
        }

        if(readyBtn){
          readyBtn.disabled = true;
          readyBtn.textContent = 'เริ่มใน 3...';
        }

        state.introGoal.countdownTimer = setInterval(() => {
          state.introGoal.countdown--;

          const left = Math.max(1, state.introGoal.countdown);

          if(count){
            count.textContent = String(left);
          }

          if(readyBtn){
            readyBtn.textContent = `เริ่มใน ${left}...`;
          }

          if(state.introGoal.countdown <= 0){
            finish(false);
          }
        }, 700);
      }

      function onReady(ev){
        ev.preventDefault();
        ev.stopPropagation();
        unlockAudio();
        startCountdown();
      }

      function onSkip(ev){
        ev.preventDefault();
        ev.stopPropagation();
        unlockAudio();
        finish(true);
      }

      readyBtn?.addEventListener('click', onReady);
      skipBtn?.addEventListener('click', onSkip);
    });
  }

  function renderRewardLoopCompact(s){
    const r = s.rewardLoop;
    if(!r || r.enabled === false) return '';

    const rank = r.rankAfter || getRankByScore(s.score || 0);
    const before = Number(r.personalBestBefore || 0);
    const after = Number(r.personalBestAfter || s.score || 0);
    const isNewBest = !!r.isNewBest;

    const earned = Array.isArray(r.earnedBadgesThisRun)
      ? r.earnedBadgesThisRun.slice(0, CHILD_POLISH.summary.maxRewardBadgesShown)
      : [];

    const next = r.nextChallenge;

    return `
      ${isNewBest ? `<div class="gjNewBestRibbon">🏆 สถิติใหม่! ${before} → ${after} คะแนน</div>` : ''}

      <div class="gjSummarySoftDivider"></div>

      <div class="gjRewardShelf">
        <div class="gjRewardPanel">
          <div class="gjRewardPanelTitle">
            <span>${rank.emoji || '🏅'}</span>
            <span>${rank.label || 'Hero'}</span>
          </div>
          <div class="gjRewardPanelText">
            สถิติดีสุด ${after} คะแนน • ชนะ ${r.profile?.wins || 0}/${r.profile?.runs || 0} รอบ
          </div>
        </div>

        <div class="gjRewardPanel">
          <div class="gjRewardPanelTitle">
            <span>${next?.emoji || '🎯'}</span>
            <span>รอบหน้า</span>
          </div>
          <div class="gjRewardPanelText">
            ${simpleText(next?.title || 'ลองเล่นอีกครั้ง', 46)}<br>
            ${simpleText(next?.desc || '', 56)}
          </div>
        </div>
      </div>

      <div class="gjKidsCompactBadges">
        ${
          earned.length
            ? earned.map(b => `
              <span class="gjKidsCompactBadge ${b.isNew ? 'new' : ''}">
                ${b.emoji} ${simpleText(b.title, 22)}${b.isNew ? ' ใหม่!' : ''}
              </span>
            `).join('')
            : `<span class="gjKidsCompactBadge">💪 รอบหน้าลุ้น Badge ใหม่</span>`
        }
      </div>
    `;
  }

  function renderKidsSummary(s){
    const badges = kidsBadges(s)
      .slice(0, CHILD_POLISH.summary.maxBadgesShown)
      .map(shortBadgeText);

    const endMsg = childEndMessage(s);
    state.childPolish.endMessage = endMsg;

    const icon =
      s.win && Number(s.starGoal?.starsEarned || 0) >= 3 ? '🏆' :
      s.win ? '🎉' :
      '💪';

    const sub = s.win
      ? 'วันนี้เลือกอาหารดีได้เยี่ยมมาก'
      : 'ยังไม่เป็นไร รอบหน้าลองใหม่ได้';

    const goodTip = simpleText(kidsMainTip(s) || pickChildTip('good'), 72);
    const cautionTip = simpleText(kidsWatchTip(s) || pickChildTip('caution'), 72);
    const nextTip = simpleText(kidsNextTip(s) || pickChildTip('next'), 72);

    if(!el.summaryScreen) return;

    el.summaryScreen.innerHTML = `
      <div class="gjKidsSummary v840">
        <div class="gjKidsSummaryIcon">${icon}</div>
        <h1 class="gjKidsSummaryTitle">${simpleText(endMsg, 42)}</h1>
        <div class="gjKidsSummarySub">${sub}</div>

        <div class="gjKidsStars">${s.stars || '☆'}</div>

        <div class="gjKidsQuickResult">
          <div class="gjKidsQuickItem">
            <div class="gjKidsQuickIcon">⭐</div>
            <div class="gjKidsQuickLabel">${CHILD_POLISH.shortLabels.score}</div>
            <div class="gjKidsQuickValue">${s.score}</div>
          </div>

          <div class="gjKidsQuickItem">
            <div class="gjKidsQuickIcon">✅</div>
            <div class="gjKidsQuickLabel">${CHILD_POLISH.shortLabels.good}</div>
            <div class="gjKidsQuickValue">${s.good}</div>
          </div>

          <div class="gjKidsQuickItem">
            <div class="gjKidsQuickIcon">⚡</div>
            <div class="gjKidsQuickLabel">${CHILD_POLISH.shortLabels.combo}</div>
            <div class="gjKidsQuickValue">${s.bestCombo}</div>
          </div>
        </div>

        <div class="gjKidsSmallNote">
          🎯 แม่นยำ ${s.accPct || calcAccuracy()}% • พลาด ${s.miss || 0} ครั้ง
        </div>

        <div class="gjKidsMiniTipBox">
          <div class="gjKidsMiniTip">
            <div class="gjKidsMiniTipIcon">✅</div>
            <div class="gjKidsMiniTipTitle">ทำดี</div>
            <div class="gjKidsMiniTipText">${goodTip}</div>
          </div>

          <div class="gjKidsMiniTip">
            <div class="gjKidsMiniTipIcon">⚠️</div>
            <div class="gjKidsMiniTipTitle">ระวัง</div>
            <div class="gjKidsMiniTipText">${cautionTip}</div>
          </div>

          <div class="gjKidsMiniTip">
            <div class="gjKidsMiniTipIcon">➡️</div>
            <div class="gjKidsMiniTipTitle">รอบหน้า</div>
            <div class="gjKidsMiniTipText">${nextTip}</div>
          </div>
        </div>

        <div class="gjKidsCompactBadges">
          ${
            badges.length
              ? badges.map(b => `<span class="gjKidsCompactBadge">${b}</span>`).join('')
              : `<span class="gjKidsCompactBadge">💪 พยายามดีมาก</span>`
          }
        </div>

        ${renderRewardLoopCompact(s)}

        <div class="gjKidsActions">
          <button id="summaryBackBtn" class="gjKidsBtn primary" type="button">
            🌙 ไป Cooldown
          </button>
          <button id="summaryReplayBtn" class="gjKidsBtn secondary" type="button">
            🔁 เล่นอีกครั้ง
          </button>
        </div>
      </div>
    `;

    cacheElements();

    if(el.summaryBackBtn){
      el.summaryBackBtn.addEventListener('click', goCooldownOrExit);
    }

    if(el.summaryReplayBtn){
      el.summaryReplayBtn.addEventListener('click', replayGame);
    }

    updateExitButtonLabels();
  }

  function buildSummary(win){
    const acc = calcAccuracy();
    const stars = calcStars();

    return {
      win: !!win,
      patch: PATCH,
      pid: CFG.pid,
      name: CFG.name,
      nick: CFG.nick,
      diff: DIFF,
      score: state.score,
      good: state.good,
      miss: state.miss,
      missedGood: state.missedGood,
      junkHit: state.junkHit,
      accPct: acc,
      stars,
      bestCombo: state.bestCombo,
      greenHits: state.greenHits,
      proteinHits: state.proteinHits,
      fruitHits: state.fruitHits,
      durationSec: Math.round(state.elapsedSec),
      bossHp: Math.round(state.bossHp),
      bossMaxHp: state.bossMaxHp,
      bossHpPct: bossHpPct(),
      finalRush: !!state.finalRush,
      powerUpsCollected: { ...state.powerUpsCollected },

      comeback: {
        enabled: !!state.comeback.enabled,
        used: state.comeback.used,
        lastReason: state.comeback.lastReason,
        rescueGiven: !!state.comeback.rescueGiven,
        calmGiven: !!state.comeback.calmGiven,
        focusGiven: !!state.comeback.focusGiven,
        heroGiven: !!state.comeback.heroGiven,
        totalShieldGiven: state.comeback.totalShieldGiven,
        totalForcedGood: state.comeback.totalForcedGood,
        totalForcedWeakness: state.comeback.totalForcedWeakness,
        totalHeroBoost: state.comeback.totalHeroBoost,
        recoverySuccess: state.comeback.recoverySuccess,
        recoveryFailed: state.comeback.recoveryFailed
      },

      starGoal: {
        diff: DIFF,
        starsEarned: evaluateStarGoals(),
        starsText: stars,
        goals: currentStarGoals(),
        goalRead: !!state.introGoal.goalRead,
        introSkipped: !!state.introGoal.skipped,
        starGoalShown: !!state.introGoal.starGoalShown
      }
    };
  }

  function saveSummary(win){
    const s = buildSummary(win);
    const reward = updateRewardLoop(s);

    const payload = {
      ...s,

      rewardLoop: reward || { enabled:false },

      miniMission: {
        id: state.bossExperience.currentMission?.id || '',
        title: state.bossExperience.currentMission?.title || '',
        progress: state.bossExperience.missionProgress || 0,
        target: state.bossExperience.missionTarget || 0,
        rewardReady: !!state.bossExperience.missionRewardReady
      },

      bossExperience: {
        finalRushBoostGiven: !!state.bossExperience.finalRushBoostGiven,
        lastSpeechAt: state.bossExperience.lastSpeechAt || 0,
        lastWarningAt: state.bossExperience.lastWarningAt || 0,
        lastMissionAt: state.bossExperience.lastMissionAt || 0
      },

      patternScript: {
        activePatternId: state.patternScript.activePatternId,
        activePatternName: state.patternScript.activePatternName,
        success: state.patternScript.activePatternSuccess,
        mistake: state.patternScript.activePatternMistake
      },

      bossIdentity: {
        currentKey: state.bossIdentity.currentKey,
        lastKey: state.bossIdentity.lastKey,
        changedAt: state.bossIdentity.changedAt,
        introShown: { ...state.bossIdentity.introShown },
        speechCount: { ...state.bossIdentity.speechCount }
      },

      arenaHazard: {
        enabled: !!state.arenaHazard.enabled,
        hazardCount: state.arenaHazard.hazardCount,
        hitPenalty: state.arenaHazard.hitPenalty,
        safeHits: state.arenaHazard.safeHits,
        dodgedGood: state.arenaHazard.dodgedGood,
        lastLane: state.arenaHazard.activeLane
      },

      learningTip: {
        enabled: !!state.learningTip.enabled,
        lastTip: state.learningTip.lastTip,
        lastLesson: state.learningTip.lastLesson,
        shownCount: state.learningTip.shownCount,
        correctTricky: state.learningTip.correctTricky,
        missedTricky: state.learningTip.missedTricky,
        trickySeen: state.learningTip.trickySeen,
        weaknessSeen: state.learningTip.weaknessSeen
      },

      missionChain: {
        enabled: !!state.missionChain.enabled,
        index: state.missionChain.index,
        activeId: state.missionChain.active?.id || '',
        activeTitle: state.missionChain.active?.title || '',
        progress: state.missionChain.progress,
        target: state.missionChain.target,
        completedIds: [...state.missionChain.completedIds],
        failedIds: [...state.missionChain.failedIds],
        finishBoostReady: !!state.missionChain.finishBoostReady,
        chainComplete: !!state.missionChain.chainComplete
      },

      introGoal: {
        enabled: !!state.introGoal.enabled,
        skipped: !!state.introGoal.skipped,
        goalRead: !!state.introGoal.goalRead,
        starGoalShown: !!state.introGoal.starGoalShown,
        introStartedAt: state.introGoal.introStartedAt,
        introEndedAt: state.introGoal.introEndedAt
      },

      touchSafety: {
        enabled: !!state.touchSafety.enabled,
        hitSlop: touchHitSlop(),
        relocatedCount: state.touchSafety.relocatedCount,
        enlargedCount: state.touchSafety.enlargedCount,
        tapRescueCount: state.touchSafety.tapRescueCount,
        targetAuditCount: state.touchSafety.targetAuditCount,
        blockedBy: state.touchSafety.blockedBy,
        lastElementAtPoint: state.touchSafety.lastElementAtPoint
      },

      qaLock: {
        ready: !!state.qaLock.ready,
        status: state.qaLock.status,
        score: state.qaLock.score,
        errors: [...state.qaLock.errors],
        warnings: [...state.qaLock.warnings],
        lastRunAt: state.qaLock.lastRunAt
      },

      replayVariety: {
        enabled: !!state.replayVariety.enabled,
        runIndex: state.replayVariety.runIndex,
        arenaTheme: state.replayVariety.arenaTheme,
        trickSet: state.replayVariety.trickSet,
        bonusRoundCount: state.replayVariety.bonusRoundCount
      },

      bossDrama: {
        enabled: !!state.bossDrama.enabled,
        comboReacted: { ...state.bossDrama.comboReacted },
        lowHpReacted: { ...state.bossDrama.lowHpReacted },
        heroReadyReacted: !!state.bossDrama.heroReadyReacted,
        finalFearShown: !!state.bossDrama.finalFearShown,
        comebackReacted: !!state.bossDrama.comebackReacted
      },

      polishJuice: {
        enabled: !!state.polishJuice.enabled,
        soundEnabled: !!state.polishJuice.soundEnabled,
        muted: !!state.polishJuice.muted,
        soundUnlocked: !!state.polishJuice.soundUnlocked,
        comboJuiceShown: { ...state.polishJuice.comboJuiceShown }
      },

      microTutorial: {
        enabled: !!state.microTutorial.enabled,
        doneBefore: !!state.microTutorial.doneBefore,
        shown: { ...state.microTutorial.shown },
        shownCount: state.microTutorial.shownCount,
        firstGoodSeen: !!state.microTutorial.firstGoodSeen,
        firstJunkSeen: !!state.microTutorial.firstJunkSeen,
        heroReadyTipShown: !!state.microTutorial.heroReadyTipShown,
        dangerTipShown: !!state.microTutorial.dangerTipShown,
        finalTipShown: !!state.microTutorial.finalTipShown,
        trickTipShown: !!state.microTutorial.trickTipShown
      },

      difficultyPersonality: {
        enabled: !!state.difficultyPersonality.enabled,
        diff: DIFF,
        profile: state.difficultyPersonality.profile,
        introShown: !!state.difficultyPersonality.introShown,
        adjustedGoodBias: state.difficultyPersonality.adjustedGoodBias,
        adjustedJunkBias: state.difficultyPersonality.adjustedJunkBias,
        adjustedTrickyBias: state.difficultyPersonality.adjustedTrickyBias,
        adjustedWeaknessBias: state.difficultyPersonality.adjustedWeaknessBias,
        adjustedHazardBias: state.difficultyPersonality.adjustedHazardBias,
        bossPatternSpeed: state.difficultyPersonality.bossPatternSpeed,
        comebackBoost: state.difficultyPersonality.comebackBoost
      },

      finalBalance: {
        enabled: !!state.finalBalance.enabled,
        junkStreak: state.finalBalance.junkStreak,
        goodStreak: state.finalBalance.goodStreak,
        forcedReliefCount: state.finalBalance.forcedReliefCount,
        preventedLifeLoss: state.finalBalance.preventedLifeLoss,
        preventedMissPenalty: state.finalBalance.preventedMissPenalty,
        lateRushTriggered: !!state.finalBalance.lateRushTriggered,
        openingGraceUsed: !!state.finalBalance.openingGraceUsed
      },

      balanceTuning: {
        enabled: !!state.balanceTuning.enabled,
        finalRushStartedAtSec: state.balanceTuning.finalRushStartedAtSec,
        finalRushElapsedSec: finalRushElapsedSec(),
        finalRushMinMet: !!state.balanceTuning.finalRushMinMet,
        damageCappedCount: state.balanceTuning.damageCappedCount,
        heroDamageCappedCount: state.balanceTuning.heroDamageCappedCount,
        winHeldCount: state.balanceTuning.winHeldCount,
        minPlaySecBeforeWin: minPlaySecBeforeWin(),
        canWinByBalance: canWinByBalance(),
        lastTuningSnapshot: state.balanceTuning.lastTuningSnapshot
      },

      childPolish: {
        enabled: !!state.childPolish.enabled,
        simplifiedSummary: !!state.childPolish.simplifiedSummary,
        endMessage: state.childPolish.endMessage,
        summaryLevel: state.childPolish.summaryLevel,
        lastCoachText: state.childPolish.lastCoachText
      }
    };

    try{
      const item = {
        ts: Date.now(),
        game: 'goodjunk',
        mode: 'solo-boss',
        payload,
        ...payload
      };

      localStorage.setItem(STORAGE_LAST_SUMMARY, JSON.stringify(item));
      localStorage.setItem(STORAGE_LAST_GENERIC, JSON.stringify(item));
    }catch(_){}

    return payload;
  }

  function endGame(win){
    if(state.ended) return;

    try{
      state.ended = true;
      state.paused = false;

      hideMicroTutorial();
      clearTargets();
      endArenaHazard();

      const payload = saveSummary(win);

      showScreen('summary');
      el.summaryScreen.classList.add('show');

      renderKidsSummary(payload);

      updateHud();
      feedback(win ? 'win' : 'bad');
      toast(win ? 'Victory! 🎉' : 'ลองใหม่อีกครั้งนะ 💪');

      runFinalLockCheck('endGame');
      runQaLock({ show:true });
    }catch(err){
      recordRuntimeError('endGame', err);

      try{
        showScreen('summary');

        if(el.summaryScreen){
          el.summaryScreen.innerHTML = `
            <div class="gjKidsSummary">
              <div class="gjKidsSummaryIcon">💪</div>
              <h1 class="gjKidsSummaryTitle">จบรอบแล้ว</h1>
              <div class="gjKidsSummarySub">ระบบสรุปมีปัญหาเล็กน้อย แต่ผลการเล่นจบแล้ว</div>
              <div class="gjKidsActions">
                <button id="summaryBackBtn" class="gjKidsBtn primary" type="button">🌙 ไป Cooldown</button>
                <button id="summaryReplayBtn" class="gjKidsBtn secondary" type="button">🔁 เล่นอีกครั้ง</button>
              </div>
            </div>
          `;

          cacheElements();
          el.summaryBackBtn?.addEventListener('click', goCooldownOrExit);
          el.summaryReplayBtn?.addEventListener('click', replayGame);
        }
      }catch(e2){
        recordRuntimeError('endGame-fallback', e2);
      }
    }
  }

  function resolveExitHref(){
    const params = new URLSearchParams();

    params.set('pid', CFG.pid);
    params.set('name', CFG.name);
    params.set('nick', CFG.nick);
    params.set('diff', DIFF);
    params.set('time', CFG.time || '150');
    params.set('view', CFG.view || 'mobile');
    params.set('run', CFG.run || 'play');
    params.set('zone', 'nutrition');
    params.set('cat', 'nutrition');
    params.set('game', 'goodjunk');
    params.set('gameId', 'goodjunk');
    params.set('mode', 'solo-boss');
    params.set('entry', 'solo-boss');
    params.set('phase', 'cooldown');
    params.set('gatePhase', 'cooldown');

    const zone = CFG.hub || DEFAULT_ZONE;
    params.set('hub', zone);
    params.set('hubRoot', zone);
    params.set('cdnext', zone);

    const cooldown = new URL('../warmup-gate.html', location.href);
    cooldown.search = params.toString();

    state.flow.exitHref = cooldown.toString();
    state.flow.detectedCooldownGate = true;
    state.flow.detectedZone = String(zone).includes('nutrition-zone.html');
    state.flow.lastResolveAt = Date.now();

    return cooldown.toString();
  }

  function updateExitButtonLabels(){
    cacheElements();

    if(el.summaryBackBtn){
      el.summaryBackBtn.textContent = '🌙 ไป Cooldown';
    }
  }

  function goCooldownOrExit(){
    const href = resolveExitHref();
    location.href = href;
  }

  function goHub(){
    location.href = CFG.hub || DEFAULT_ZONE;
  }

  function resetRunSystems(){
    try{ endArenaHazard?.(); }catch(_){}
    try{ clearTargets?.(); }catch(_){}

    if(state.bossExperience){
      state.bossExperience.currentMission = null;
      state.bossExperience.missionProgress = 0;
      state.bossExperience.missionRewardReady = false;
      state.bossExperience.finalRushBoostGiven = false;
    }

    if(state.patternScript){
      state.patternScript.activePatternId = '';
      state.patternScript.activePatternName = '';
      state.patternScript.activePatternSuccess = 0;
      state.patternScript.activePatternMistake = 0;
      state.patternScript.patternRewardGiven = false;
    }

    if(state.arenaHazard){
      state.arenaHazard.active = false;
      state.arenaHazard.activeLane = '';
      state.arenaHazard.endsAt = 0;
    }

    if(state.missionChain){
      state.missionChain.active = null;
      state.missionChain.progress = 0;
      state.missionChain.rewardGiven = false;
    }

    if(state.comeback){
      state.comeback.activeUntil = 0;
      state.comeback.lastReason = '';
    }

    if(state.introGoal){
      clearInterval(state.introGoal.countdownTimer);
      state.introGoal.showing = false;
    }

    document.querySelectorAll(
      '#gjBossIntro,#gjBossSpeech,#gjWarningFlash,#gjComebackBanner,#gjQaBadge,#gjDangerLane'
    ).forEach(n => {
      n.classList.remove('show', 'pass', 'warn', 'fail', 'top', 'middle', 'bottom');
    });
  }

  function resetAdvancedRunSystems(){
    state.replayVariety.bonusRoundActive = false;
    state.replayVariety.bonusRoundStartedAt = 0;
    state.replayVariety.bonusRoundEndsAt = 0;
    state.replayVariety.lastBonusAtSec = 0;
    state.replayVariety.themeAnnounced = false;
    state.replayVariety.trickAnnounced = false;

    state.bossDrama.comboReacted = {};
    state.bossDrama.lowHpReacted = {};
    state.bossDrama.heroReadyReacted = false;
    state.bossDrama.lastTauntAt = 0;
    state.bossDrama.lastDramaAt = 0;
    state.bossDrama.finalFearShown = false;
    state.bossDrama.comebackReacted = false;

    state.rewardLoop.earnedBadgesThisRun = [];
    state.rewardLoop.rankBefore = null;
    state.rewardLoop.rankAfter = null;
    state.rewardLoop.personalBestBefore = 0;
    state.rewardLoop.personalBestAfter = 0;
    state.rewardLoop.isNewBest = false;
    state.rewardLoop.nextChallenge = null;
    state.rewardLoop.rewardSaved = false;

    state.polishJuice.comboJuiceShown = {};
    state.polishJuice.lastShakeAt = 0;

    resetMicroTutorialRun();

    state.difficultyPersonality.introShown = false;
    state.difficultyPersonality.profile = null;

    state.finalBalance.junkStreak = 0;
    state.finalBalance.goodStreak = 0;
    state.finalBalance.lastGoodMissPenaltyAt = 0;
    state.finalBalance.lastLifeLossAt = 0;
    state.finalBalance.lifeLossInWindow = 0;
    state.finalBalance.lifeLossWindowStartedAt = 0;
    state.finalBalance.lastReliefAt = 0;
    state.finalBalance.lastBossProgressHelpAt = 0;
    state.finalBalance.lastOverlayQuietAt = 0;
    state.finalBalance.forcedReliefCount = 0;
    state.finalBalance.preventedLifeLoss = 0;
    state.finalBalance.preventedMissPenalty = 0;
    state.finalBalance.lateRushTriggered = false;
    state.finalBalance.openingGraceUsed = false;

    state.balanceTuning.finalRushStartedAtSec = 0;
    state.balanceTuning.finalRushMinMet = false;
    state.balanceTuning.damageCappedCount = 0;
    state.balanceTuning.heroDamageCappedCount = 0;
    state.balanceTuning.winHeldCount = 0;
    state.balanceTuning.lastBalanceNoteAt = 0;
    state.balanceTuning.lastTuningSnapshot = null;

    const world = el.gameWorld || $('gameWorld');

    if(world){
      world.classList.remove(
        'gjThemeMarket',
        'gjThemeSchool',
        'gjThemeFestival',
        'gjThemeSpace',
        'gjBonusRoundActive',
        'gjDiffEasy',
        'gjDiffNormal',
        'gjDiffHard',
        'gjDiffChallenge',
        'gjScreenShake'
      );
    }

    hideMicroTutorial();
  }

  function replayGame(){
    resetRunSystems();
    resetAdvancedRunSystems();

    state.rng = mulberry32(hashSeed(`${CFG.seed}:${CFG.pid}:${DIFF}:goodjunk-replay:${Date.now()}`));

    state.started = false;
    state.paused = false;
    state.ended = false;
    state.summaryRendered = false;

    state.startTs = 0;
    state.elapsedSec = 0;
    state.lastFrame = 0;
    state.timeLeft = Number(CFG.time) || tune.time;

    state.score = 0;
    state.good = 0;
    state.miss = 0;
    state.missedGood = 0;
    state.junkHit = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.lives = tune.lives;

    state.bossHp = tune.bossHp;
    state.bossMaxHp = tune.bossHp;
    state.bossShield = true;
    state.phase = 1;
    state.finalRush = false;
    state.heroHit = 0;
    state.dangerMeter = 0;

    state.targets.clear();
    state.powerUps.clear();
    state.targetSeq = 0;
    state.powerSeq = 0;
    state.lastSpawn = 0;
    state.lastBossAttack = 0;
    state.bossSkillCooldownLock = false;

    state.phaseAnnounced = {
      shieldBreak: false,
      phase2: false,
      phase3: false,
      finalRush: false
    };

    state.activePower = {
      shield: 0,
      slowUntil: 0
    };

    state.powerUpsCollected = {
      shield: 0,
      slow: 0,
      cleanBlast: 0,
      heart: 0
    };

    state.greenHits = 0;
    state.proteinHits = 0;
    state.fruitHits = 0;

    state.balance.streakGood = 0;
    state.balance.streakMiss = 0;
    state.balance.stress = 0;
    state.balance.lastAssistAt = 0;
    state.balance.calmUntil = 0;
    state.balance.forcedGoodNext = 0;
    state.balance.forcedWeaknessNext = 0;
    state.balance.history = [];

    state.introGoal.skipped = false;
    state.introGoal.goalRead = false;

    setupDailyChallenge();

    showScreen('intro');
    updateHud();
  }

  function distanceToItem(x, y, item){
    const dx = x - item.x;
    const dy = y - item.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function findNearestTouchableTarget(x, y){
    const slop = touchHitSlop();

    let best = null;
    let bestDist = Infinity;

    for(const item of state.targets.values()){
      if(!item || !item.node) continue;

      const r = (item.size || minTargetSize()) / 2 + slop;
      const d = distanceToItem(x, y, item);

      if(d <= r && d < bestDist){
        best = item;
        bestDist = d;
      }
    }

    return best;
  }

  function tapRescueFx(x, y, text = 'แตะโดน!'){
    const layer = el.fxLayer || el.app || DOC.body;

    const n = DOC.createElement('div');
    n.className = 'gjTapRescueFx';
    n.style.left = `${x}px`;
    n.style.top = `${y}px`;
    n.textContent = text;

    layer.appendChild(n);

    setTimeout(() => {
      safeRemoveNode(n);
    }, 560);
  }

  function handleWorldTapRescue(ev){
    if(!state.touchSafety.enabled) return;
    if(state.ended || state.paused || !state.started) return;

    const target = ev.target;

    if(target?.classList?.contains('gjTarget') || target?.closest?.('.gjTarget')) return;
    if(isGameControlElement(target)) return;
    if(target?.closest?.('#gjBossIntro') || target?.closest?.('#summaryScreen')) return;

    const x = ev.clientX;
    const y = ev.clientY;

    state.touchSafety.lastPointerX = x;
    state.touchSafety.lastPointerY = y;

    const top = DOC.elementFromPoint(x, y);
    state.touchSafety.lastElementAtPoint = describeElement(top);

    const item = findNearestTouchableTarget(x, y);

    if(!item) return;

    state.touchSafety.tapRescueCount++;
    state.touchSafety.lastTapTargetId = item.id;

    tapRescueFx(x, y, 'แตะโดน!');
    hitTarget(item.id);
  }

  function bindWorldTapDebug(){
    const world = el.gameWorld || $('gameWorld');
    if(!world || world.__gjTapBound) return;

    world.__gjTapBound = true;

    world.addEventListener('pointerdown', ev => {
      state.calibration.lastTapX = ev.clientX;
      state.calibration.lastTapY = ev.clientY;
      state.touchSafety.lastPointerX = ev.clientX;
      state.touchSafety.lastPointerY = ev.clientY;

      const isTarget =
        ev.target?.classList?.contains('gjTarget') ||
        ev.target?.closest?.('.gjTarget');

      if(isTarget){
        state.tapSafety.lastTargetTapAt = Date.now();
        return;
      }

      const top = DOC.elementFromPoint(ev.clientX, ev.clientY);

      state.calibration.lastBlockedElement = top
        ? `${top.tagName || ''}#${top.id || ''}.${String(top.className || '').slice(0, 80)}`
        : '';

      state.touchSafety.lastElementAtPoint = describeElement(top);
      state.tapSafety.lastEmptyTapAt = Date.now();

      handleWorldTapRescue(ev);
    }, { passive:true });
  }

  function ensureSafeAreaOverlay(){
    const td = $('gjTouchDebug');

    if(td){
      td.classList.toggle('show', !!state.calibration.debugOverlay);
    }

    const qa = $('gjQaBadge');

    if(qa){
      qa.classList.toggle('show', !!state.calibration.debugOverlay);
    }
  }

  function runFinalLockCheck(reason = ''){
    cacheElements();
    ensureAllOverlayDom();

    state.finalLock.lastCheckAt = Date.now();
    state.finalLock.errors = [];
    state.finalLock.warnings = [];

    if(!el.app) state.finalLock.errors.push('missing app');
    if(!el.gameWorld) state.finalLock.errors.push('missing gameWorld');
    if(!el.targetLayer) state.finalLock.errors.push('missing targetLayer');
    if(!el.heroHitBtn) state.finalLock.warnings.push('missing heroHitBtn');

    state.finalLock.domReady = state.finalLock.errors.length === 0;
    state.finalLock.layoutReady = !!getSafeArenaRect(60);
    state.finalLock.tapReady = !!el.targetLayer;
    state.finalLock.flowReady = !!resolveExitHref();
    state.finalLock.calibrationReady = true;
    state.finalLock.singleHandReady = true;

    bindWorldTapDebug();

    return {
      reason,
      ...state.finalLock
    };
  }

  function qaMissingDom(){
    return QA_LOCK.requiredDom.filter(id => !$(id));
  }

  function qaBlockedTargets(){
    const arr = [];

    for(const item of state.targets.values()){
      if(isTargetVisiblyBlocked(item)){
        arr.push({
          id: item.id,
          kind: item.kind,
          label: item.data?.label || '',
          x: Math.round(item.x),
          y: Math.round(item.y),
          size: item.size,
          blockedBy: state.touchSafety.blockedBy || ''
        });
      }
    }

    return arr;
  }

  function qaSafeArena(){
    const safe = getSafeArenaRect(60);
    const height = Math.round((safe.bottom || 0) - (safe.top || 0));

    return {
      ...safe,
      height,
      ok: height >= QA_LOCK.minSafeArenaHeight
    };
  }

  function qaExitHref(){
    let href = '';

    try{
      href = resolveExitHref();
    }catch(_){
      href = '';
    }

    return {
      href,
      ok: !QA_LOCK.requireExitHref || !!href
    };
  }

  function qaBossSystems(){
    return {
      bossExperience: !!state.bossExperience,
      patternScript: !!state.patternScript,
      bossIdentity: !!state.bossIdentity,
      arenaHazard: !!state.arenaHazard,
      learningTip: !!state.learningTip,
      missionChain: !!state.missionChain,
      comeback: !!state.comeback,
      introGoal: !!state.introGoal,
      touchSafety: !!state.touchSafety,
      ok:
        !!state.bossExperience &&
        !!state.patternScript &&
        !!state.bossIdentity &&
        !!state.arenaHazard &&
        !!state.learningTip &&
        !!state.missionChain &&
        !!state.comeback &&
        !!state.introGoal &&
        !!state.touchSafety
    };
  }

  function qaTouchReady(){
    const tl = $('targetLayer');
    const safe = qaSafeArena();

    return {
      targetLayerExists: !!tl,
      targetLayerPointerEvents: tl ? getComputedStyle(tl).pointerEvents : '',
      hitSlop: touchHitSlop(),
      minTargetSize: minTargetSize(),
      safeArenaHeight: safe.height,
      ok:
        !!tl &&
        safe.ok &&
        touchHitSlop() > 0 &&
        minTargetSize() >= 48
    };
  }

  function qaFlowReady(){
    const exit = qaExitHref();

    return {
      exitHref: exit.href,
      isCooldownGate:
        String(exit.href || '').includes('warmup-gate.html') &&
        String(exit.href || '').includes('phase=cooldown'),
      isNutritionZone:
        String(exit.href || '').includes('nutrition-zone.html'),
      ok: !!exit.href
    };
  }

  function qaAdvancedSystems(){
    return {
      replayVariety: !!state.replayVariety,
      bossDrama: !!state.bossDrama,
      rewardLoop: !!state.rewardLoop,
      polishJuice: !!state.polishJuice,
      microTutorial: !!state.microTutorial,
      difficultyPersonality: !!state.difficultyPersonality,
      finalBalance: !!state.finalBalance,
      balanceTuning: !!state.balanceTuning,
      childPolish: !!state.childPolish,

      dom: {
        arenaThemeHud: !!$('gjArenaThemeHud'),
        bonusRoundBanner: !!$('gjBonusRoundBanner'),
        soundBtn: !!$('gjSoundBtn'),
        comboJuiceBanner: !!$('gjComboJuiceBanner'),
        microTutorial: !!$('gjMicroTutorial'),
        difficultyBadge: !!$('gjDifficultyBadge')
      },

      ok:
        !!state.replayVariety &&
        !!state.bossDrama &&
        !!state.rewardLoop &&
        !!state.polishJuice &&
        !!state.microTutorial &&
        !!state.difficultyPersonality &&
        !!state.finalBalance &&
        !!state.balanceTuning &&
        !!state.childPolish &&
        !!$('gjSoundBtn') &&
        !!$('gjDifficultyBadge')
    };
  }

  function qaRequiredFunctions(){
    const checks = {
      setupRunMetaSystems,
      announceRunMetaSystems,
      resetAdvancedRunSystems,
      setupReplayVariety,
      setupDifficultyPersonality,
      loadRewardLoop,
      loadSoundPreference,
      loadMicroTutorialState,
      updateBonusRound,
      maybeBossProgressHelp,
      maybeLateGameRush
    };

    const missing = Object.keys(checks).filter(k => typeof checks[k] !== 'function');

    return {
      missing,
      ok: missing.length === 0
    };
  }

  function runQaLock(options = {}){
    const show = options.show !== false;

    ensureQaLockDom();

    const errors = [];
    const warnings = [];

    const missingDom = qaMissingDom();
    const blockedTargets = qaBlockedTargets();
    const safeArena = qaSafeArena();
    const exit = qaExitHref();
    const bossSystems = qaBossSystems();
    const touchReady = qaTouchReady();
    const flowReady = qaFlowReady();
    const advancedSystems = qaAdvancedSystems();
    const requiredFunctions = qaRequiredFunctions();

    if(missingDom.length > QA_LOCK.maxMissingDom){
      errors.push(`Missing DOM: ${missingDom.join(', ')}`);
    }

    if(blockedTargets.length > QA_LOCK.maxBlockedTargets){
      errors.push(`Blocked targets: ${blockedTargets.length}`);
    }

    if(!safeArena.ok){
      errors.push(`Safe arena too small: ${safeArena.height}px`);
    }

    if(QA_LOCK.requireExitHref && !exit.ok){
      errors.push('Exit href missing');
    }

    if(QA_LOCK.requireBossSystems && !bossSystems.ok){
      errors.push('Boss systems not ready');
    }

    if(QA_LOCK.requireTouchReady && !touchReady.ok){
      errors.push('Touch system not ready');
    }

    if(QA_LOCK.requireFlowReady && !flowReady.ok){
      errors.push('Flow not ready');
    }

    if(!advancedSystems.ok){
      warnings.push('Advanced systems incomplete');
    }

    if(!requiredFunctions.ok){
      warnings.push(`Missing functions: ${requiredFunctions.missing.join(', ')}`);
    }

    if(state.runtimeGuard.errorCount > 0){
      warnings.push(`Runtime errors: ${state.runtimeGuard.errorCount}`);
    }

    if(state.targets.size === 0 && state.started && !state.ended && !state.paused){
      warnings.push('No active targets right now');
    }

    if(state.touchSafety.relocatedCount > 0){
      warnings.push(`Targets relocated: ${state.touchSafety.relocatedCount}`);
    }

    if(state.touchSafety.tapRescueCount > 0){
      warnings.push(`Tap rescue used: ${state.touchSafety.tapRescueCount}`);
    }

    if(state.comeback.used > 0){
      warnings.push(`Comeback used: ${state.comeback.used}`);
    }

    const checks = {
      missingDom,
      blockedTargets,
      safeArena,
      exit,
      bossSystems,
      touchReady,
      flowReady,
      advancedSystems,
      requiredFunctions,
      runtimeGuard: {
        errorCount: state.runtimeGuard.errorCount,
        recoveredCount: state.runtimeGuard.recoveredCount,
        lastRecovery: state.runtimeGuard.lastRecovery,
        recentErrors: state.runtimeGuard.errors.slice(-3)
      },
      state: {
        started: state.started,
        paused: state.paused,
        ended: state.ended,
        targets: state.targets.size,
        bossHp: state.bossHp,
        bossMaxHp: state.bossMaxHp,
        timeLeft: state.timeLeft,
        phase: state.phase,
        finalRush: state.finalRush
      }
    };

    const ready = errors.length === 0;
    const status = ready
      ? (warnings.length ? 'warn' : 'pass')
      : 'fail';

    const score = Math.max(
      0,
      100 - errors.length * 18 - warnings.length * 4
    );

    const result = {
      patch: PATCH,
      ready,
      status,
      score,
      errors,
      warnings,
      checks,
      timestamp: new Date().toISOString()
    };

    state.qaLock.lastRunAt = Date.now();
    state.qaLock.ready = ready;
    state.qaLock.status = status;
    state.qaLock.score = score;
    state.qaLock.errors = errors;
    state.qaLock.warnings = warnings;
    state.qaLock.checks = checks;
    state.qaLock.snapshot = result;

    if(show){
      showQaBadge(result);
    }

    return result;
  }

  function showQaBadge(result){
    ensureQaLockDom();

    const box = $('gjQaBadge');
    if(!box) return;

    box.classList.remove('pass', 'warn', 'fail');

    const cls = result.status === 'pass'
      ? 'pass'
      : result.status === 'warn'
        ? 'warn'
        : 'fail';

    box.classList.add('show', cls);

    const icon = result.status === 'pass'
      ? '✅'
      : result.status === 'warn'
        ? '⚠️'
        : '❌';

    box.textContent = [
      `${icon} QA ${result.status.toUpperCase()} • ${result.score}/100`,
      `errors: ${result.errors.length}`,
      `warnings: ${result.warnings.length}`,
      result.errors[0] ? `first: ${result.errors[0]}` : '',
      result.warnings[0] ? `warn: ${result.warnings[0]}` : ''
    ].filter(Boolean).join('\n');

    clearTimeout(showQaBadge._t);
    showQaBadge._t = setTimeout(() => {
      if(!state.calibration.debugOverlay){
        box.classList.remove('show');
      }
    }, 2600);
  }

  function updateTouchDebug(){
    const box = $('gjTouchDebug');
    if(!box || !state.calibration.debugOverlay) return;

    box.classList.add('show');

    box.textContent = [
      `PATCH: ${PATCH}`,
      `targets: ${state.targets.size}`,
      `relocated: ${state.touchSafety.relocatedCount}`,
      `enlarged: ${state.touchSafety.enlargedCount}`,
      `tapRescue: ${state.touchSafety.tapRescueCount}`,
      `blockedBy: ${state.touchSafety.blockedBy || '-'}`,
      `lastPoint: ${Math.round(state.touchSafety.lastPointerX)},${Math.round(state.touchSafety.lastPointerY)}`,
      `atPoint: ${state.touchSafety.lastElementAtPoint || '-'}`
    ].join('\n');
  }
    function refreshUiState(){
    cacheElements();

    if(el.pauseBtn){
      el.pauseBtn.textContent = state.paused ? '▶️' : '⏸️';
    }

    if(el.backBtn){
      el.backBtn.title = 'กลับ Nutrition Zone';
    }

    updateExitButtonLabels();
  }

  function togglePause(){
    if(!state.started || state.ended) return;

    state.paused = !state.paused;

    if(state.paused){
      hideMicroTutorial();
    }

    refreshUiState();
    updateHud();
    toast(state.paused ? 'หยุดชั่วคราว' : 'เล่นต่อ');
  }

  async function startGame(){
    if(state.startLocked || state.started) return;

    state.startLocked = true;

    try{
      unlockAudio();

      cacheElements();
      setupAdvancedDefaults();
      ensureAllOverlayDom();

      showScreen('game');

      state.started = true;
      state.paused = false;
      state.ended = false;
      state.summaryRendered = false;

      state.startTs = performance.now();
      state.lastFrame = 0;
      state.elapsedSec = 0;
      state.timeLeft = Number(CFG.time) || tune.time;

      setupDailyChallenge();
      setupRunMetaSystems();

      setArenaTheme('shield');
      updateBossIdentity(true);

      await showBossIntro();

      announceRunMetaSystems();

      refreshUiState();
      updateHud();
      runFinalLockCheck('startGame');
      runQaLock({ show:true });

      toast('Phase 1: ทำลายโล่ Junk King! 🛡️👑', 1600);

      ensureBossExperienceDom();
      bossSpeak('ข้าคือ Junk King! ลองจับอาหารดีให้ได้สิ!', 1600);
      startMiniMission(true);
      startMissionChain(true);

      state.lastSpawn = now() - tune.spawnEvery;
      state.lastBossAttack = now();

      requestAnimationFrame(gameLoop);
    }catch(err){
      recordRuntimeError('startGame', err);
      recoverRuntime('startGame-error');

      state.started = false;
      showScreen('intro');
      toast('โหลดเกมไม่สำเร็จ ลองเริ่มใหม่อีกครั้ง');
    }finally{
      state.startLocked = false;
    }
  }

  function bindEvents(){
    cacheElements();

    if(el.startBtn){
      safeOnce(el.startBtn, '__gjStartBound', () => {
        el.startBtn.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          startGame();
        });
      });
    }

    if(el.backBtnIntro){
      safeOnce(el.backBtnIntro, '__gjBackIntroBound', () => {
        el.backBtnIntro.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          goHub();
        });
      });
    }

    if(el.pauseBtn){
      safeOnce(el.pauseBtn, '__gjPauseBound', () => {
        el.pauseBtn.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          togglePause();
        });
      });
    }

    if(el.backBtn){
      safeOnce(el.backBtn, '__gjBackBound', () => {
        el.backBtn.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();

          if(state.started && !state.ended){
            const ok = confirm('ออกจากเกมและไป Nutrition Zone ใช่ไหม?');
            if(!ok) return;
          }

          goHub();
        });
      });
    }

    if(el.heroHitBtn){
      safeOnce(el.heroHitBtn, '__gjHeroBound', () => {
        el.heroHitBtn.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          unlockAudio();
          useHeroHit();
        });
      });
    }

    DOC.addEventListener('visibilitychange', () => {
      if(DOC.hidden && state.started && !state.ended){
        state.paused = true;
        refreshUiState();
      }
    });

    WIN.addEventListener('resize', () => {
      state.touchSafety.safeRectVersion++;
      setTimeout(() => {
        auditTargets();
        updateHud();
      }, 180);
    });
  }

  function boot(root, cfg = {}){
    if(state.booted) return publicApi;

    state.bootStarted = true;

    ensureFxStyle();

    if(root && root.nodeType === 1){
      root.id = root.id || 'gjSoloBossApp';
    }

    ensureRequiredDom();
    cacheElements();
    setupAdvancedDefaults();
    ensureAllOverlayDom();

    bindEvents();
    bindWorldTapDebug();

    resolveExitHref();
    loadSoundPreference();
    loadMicroTutorialState();

    showScreen('intro');
    updateHud();
    refreshUiState();
    updateSoundButton();

    runFinalLockCheck('boot');
    runQaLock({ show:false });

    state.booted = true;

    const auto =
      String(qs.get('autostart') || '').trim() === '1' ||
      String(qs.get('auto') || '').trim() === '1';

    if(auto){
      setTimeout(() => startGame(), 120);
    }

    return publicApi;
  }

  function getState(){
    return {
      patch: PATCH,
      cfg: { ...CFG, diff: DIFF },
      started: state.started,
      paused: state.paused,
      ended: state.ended,
      timeLeft: state.timeLeft,
      elapsedSec: state.elapsedSec,
      score: state.score,
      good: state.good,
      miss: state.miss,
      lives: state.lives,
      combo: state.combo,
      bestCombo: state.bestCombo,
      bossHp: state.bossHp,
      bossMaxHp: state.bossMaxHp,
      bossHpPct: bossHpPct(),
      bossShield: state.bossShield,
      phase: state.phase,
      finalRush: state.finalRush,
      heroHit: state.heroHit,
      targets: state.targets.size,
      powerUps: state.powerUps.size,
      exitHref: state.flow.exitHref
    };
  }

  function debugFlow(){
    return {
      patch: PATCH,
      flow: { ...state.flow },
      exitHref: resolveExitHref(),
      hub: CFG.hub,
      defaultZone: DEFAULT_ZONE
    };
  }

  function debugFinal(){
    return {
      patch: PATCH,
      finalLock: { ...state.finalLock },
      safeArena: qaSafeArena(),
      qa: state.qaLock.snapshot || runQaLock({ show:false })
    };
  }

  function debugTouch(){
    return {
      patch: PATCH,
      touchSafety: { ...state.touchSafety },
      calibration: { ...state.calibration },
      tapSafety: { ...state.tapSafety },
      safeArena: qaSafeArena(),
      blockedTargets: qaBlockedTargets()
    };
  }

  function debugPacing(){
    return {
      patch: PATCH,
      pacing: { ...state.pacing },
      minFightReached: minimumFightReached(),
      minPlaySecBeforeWin: minPlaySecBeforeWin(),
      canWinByBalance: canWinByBalance(),
      timeLeft: state.timeLeft,
      elapsedSec: state.elapsedSec
    };
  }

  function debugPattern(){
    return {
      patch: PATCH,
      patternScript: { ...state.patternScript },
      currentPhaseKey: currentPatternPhaseKey(),
      nextPatternPreview: getNextBossPattern()
    };
  }

  function debugBossIdentity(){
    return {
      patch: PATCH,
      bossIdentity: { ...state.bossIdentity },
      currentKey: currentBossIdentityKey(),
      current: currentBossIdentity(),
      weakness: currentWeakness()
    };
  }

  function debugHazard(){
    return {
      patch: PATCH,
      arenaHazard: { ...state.arenaHazard },
      everyMs: hazardEveryMs(),
      durationMs: hazardDurationMs(),
      active: state.arenaHazard.active,
      activeLane: state.arenaHazard.activeLane
    };
  }

  function debugLearning(){
    return {
      patch: PATCH,
      learningTip: { ...state.learningTip },
      trickSet: state.replayVariety.trickSet
    };
  }

  function debugMissionChain(){
    return {
      patch: PATCH,
      missionChain: {
        ...state.missionChain,
        active: state.missionChain.active
      },
      current: currentMissionChain()
    };
  }

  function debugComeback(){
    return {
      patch: PATCH,
      comeback: { ...state.comeback },
      active: Date.now() < state.comeback.activeUntil,
      leftMs: Math.max(0, state.comeback.activeUntil - Date.now())
    };
  }

  function debugIntroGoal(){
    return {
      patch: PATCH,
      introGoal: { ...state.introGoal },
      starGoals: currentStarGoals(),
      starsNow: evaluateStarGoals()
    };
  }

  function debugVisualFx(){
    return {
      patch: PATCH,
      hasImpactFlash: !!$('gjImpactFlash'),
      hasHeroCutIn: !!$('gjHeroCutIn'),
      hasShieldCrack: !!DOC.querySelector('.gjShieldCrack'),
      hasBossSpeech: !!$('gjBossSpeech')
    };
  }

  function debugReplayVariety(){
    return {
      patch: PATCH,
      enabled: !!state.replayVariety.enabled,
      runIndex: state.replayVariety.runIndex,
      arenaTheme: state.replayVariety.arenaTheme,
      trickSet: state.replayVariety.trickSet,
      bonusRoundActive: state.replayVariety.bonusRoundActive,
      bonusRoundCount: state.replayVariety.bonusRoundCount,
      bonusEndsInMs: state.replayVariety.bonusRoundEndsAt
        ? Math.max(0, state.replayVariety.bonusRoundEndsAt - Date.now())
        : 0,
      hasThemeHud: !!$('gjArenaThemeHud'),
      hasBonusBanner: !!$('gjBonusRoundBanner')
    };
  }

  function debugBossDrama(){
    return {
      patch: PATCH,
      enabled: !!state.bossDrama.enabled,
      comboReacted: { ...state.bossDrama.comboReacted },
      lowHpReacted: { ...state.bossDrama.lowHpReacted },
      heroReadyReacted: state.bossDrama.heroReadyReacted,
      finalFearShown: state.bossDrama.finalFearShown,
      comebackReacted: state.bossDrama.comebackReacted,
      lastTauntAt: state.bossDrama.lastTauntAt,
      lastDramaAt: state.bossDrama.lastDramaAt
    };
  }

  function debugRewardLoop(){
    return {
      patch: PATCH,
      enabled: !!state.rewardLoop.enabled,
      profile: state.rewardLoop.profile || readJsonStorage(rewardKey('profile'), emptyRewardProfile()),
      bossBook: state.rewardLoop.bossBook || readJsonStorage(rewardKey('bossBook'), emptyBossBook()),
      badgeBook: state.rewardLoop.badgeBook || readJsonStorage(rewardKey('badgeBook'), emptyBadgeBook()),
      earnedBadgesThisRun: state.rewardLoop.earnedBadgesThisRun,
      rankBefore: state.rewardLoop.rankBefore,
      rankAfter: state.rewardLoop.rankAfter,
      personalBestBefore: state.rewardLoop.personalBestBefore,
      personalBestAfter: state.rewardLoop.personalBestAfter,
      isNewBest: state.rewardLoop.isNewBest,
      nextChallenge: state.rewardLoop.nextChallenge,
      rewardSaved: state.rewardLoop.rewardSaved
    };
  }

  function clearRewardLoop(){
    try{
      localStorage.removeItem(rewardKey('profile'));
      localStorage.removeItem(rewardKey('bossBook'));
      localStorage.removeItem(rewardKey('badgeBook'));
      localStorage.removeItem(rewardKey('lastChallenge'));
    }catch(_){}

    state.rewardLoop.profile = null;
    state.rewardLoop.bossBook = null;
    state.rewardLoop.badgeBook = null;
    state.rewardLoop.earnedBadgesThisRun = [];
    state.rewardLoop.rewardSaved = false;

    return debugRewardLoop();
  }

  function debugPolishJuice(){
    return {
      patch: PATCH,
      enabled: !!state.polishJuice.enabled,
      soundEnabled: !!state.polishJuice.soundEnabled,
      muted: !!state.polishJuice.muted,
      soundUnlocked: !!state.polishJuice.soundUnlocked,
      hasAudioCtx: !!state.polishJuice.audioCtx,
      audioState: state.polishJuice.audioCtx?.state || '',
      comboJuiceShown: { ...state.polishJuice.comboJuiceShown },
      hasSoundBtn: !!$('gjSoundBtn'),
      hasComboBanner: !!$('gjComboJuiceBanner')
    };
  }

  function debugMicroTutorial(){
    return {
      patch: PATCH,
      enabled: !!state.microTutorial.enabled,
      doneBefore: !!state.microTutorial.doneBefore,
      shown: { ...state.microTutorial.shown },
      shownCount: state.microTutorial.shownCount,
      lastShownAt: state.microTutorial.lastShownAt,
      suppressedUntil: state.microTutorial.suppressedUntil,
      firstGoodSeen: state.microTutorial.firstGoodSeen,
      firstJunkSeen: state.microTutorial.firstJunkSeen,
      heroReadyTipShown: state.microTutorial.heroReadyTipShown,
      dangerTipShown: state.microTutorial.dangerTipShown,
      finalTipShown: state.microTutorial.finalTipShown,
      trickTipShown: state.microTutorial.trickTipShown,
      hasDom: !!$('gjMicroTutorial'),
      hasHint: !!$('gjTutorialSkipHint')
    };
  }

  function debugDifficultyPersonality(){
    return {
      patch: PATCH,
      enabled: !!state.difficultyPersonality.enabled,
      diff: DIFF,
      profile: state.difficultyPersonality.profile || currentDifficultyPersonality(),
      introShown: state.difficultyPersonality.introShown,
      adjustedGoodBias: state.difficultyPersonality.adjustedGoodBias,
      adjustedJunkBias: state.difficultyPersonality.adjustedJunkBias,
      adjustedTrickyBias: state.difficultyPersonality.adjustedTrickyBias,
      adjustedWeaknessBias: state.difficultyPersonality.adjustedWeaknessBias,
      adjustedHazardBias: state.difficultyPersonality.adjustedHazardBias,
      bossPatternSpeed: state.difficultyPersonality.bossPatternSpeed,
      comebackBoost: state.difficultyPersonality.comebackBoost,
      hasBadge: !!$('gjDifficultyBadge')
    };
  }

  function debugFinalBalance(){
    return {
      patch: PATCH,
      enabled: !!state.finalBalance.enabled,
      diff: DIFF,
      cfg: {
        maxJunkStreak: fbCfg('maxJunkStreak'),
        missGraceMs: fbCfg('missGraceMs'),
        openingGraceSec: fbCfg('openingGraceSec'),
        dangerReliefAt: fbCfg('dangerReliefAt'),
        bossProgressHelpEverySec: fbCfg('bossProgressHelpEverySec'),
        lateGameRushSecLeft: fbCfg('lateGameRushSecLeft')
      },
      state: {
        junkStreak: state.finalBalance.junkStreak,
        goodStreak: state.finalBalance.goodStreak,
        lifeLossInWindow: state.finalBalance.lifeLossInWindow,
        forcedReliefCount: state.finalBalance.forcedReliefCount,
        preventedLifeLoss: state.finalBalance.preventedLifeLoss,
        preventedMissPenalty: state.finalBalance.preventedMissPenalty,
        lateRushTriggered: state.finalBalance.lateRushTriggered,
        openingGraceUsed: state.finalBalance.openingGraceUsed
      },
      live: {
        openingGraceActive: openingGraceActive(),
        overlayQuietActive: overlayQuietActive(),
        dangerMeter: state.dangerMeter,
        lives: state.lives,
        timeLeft: state.timeLeft,
        bossHpPct: bossHpPct()
      }
    };
  }

  function debugBalanceTuning(){
    return {
      patch: PATCH,
      enabled: !!state.balanceTuning.enabled,
      diff: DIFF,
      fightPacing: btCfg('fightPacing'),
      spawnPacing: btCfg('spawnPacing'),
      scorePacing: {
        goodBase: btScore('goodBase'),
        junkPenaltyScore: btScore('junkPenaltyScore'),
        missedGoodPenaltyScore: btScore('missedGoodPenaltyScore'),
        comboBonusCap: btScore('comboBonusCap')
      },
      finalRush: {
        forceWeaknessOnEnter: btFinal('forceWeaknessOnEnter'),
        spawnBoost: btFinal('spawnBoost'),
        junkChanceAdd: btFinal('junkChanceAdd')
      },
      state: {
        finalRushStartedAtSec: state.balanceTuning.finalRushStartedAtSec,
        finalRushElapsedSec: finalRushElapsedSec(),
        finalRushMinMet: state.balanceTuning.finalRushMinMet,
        damageCappedCount: state.balanceTuning.damageCappedCount,
        heroDamageCappedCount: state.balanceTuning.heroDamageCappedCount,
        winHeldCount: state.balanceTuning.winHeldCount,
        minPlaySecBeforeWin: minPlaySecBeforeWin(),
        canWinByBalance: canWinByBalance(),
        bossHp: state.bossHp,
        bossHpPct: bossHpPct(),
        timeLeft: state.timeLeft
      }
    };
  }

  function debugChildPolish(){
    return {
      patch: PATCH,
      enabled: !!state.childPolish.enabled,
      simplifiedSummary: !!state.childPolish.simplifiedSummary,
      endMessage: state.childPolish.endMessage,
      summaryLevel: state.childPolish.summaryLevel,
      lastCoachText: state.childPolish.lastCoachText,
      lastCoachAt: state.childPolish.lastCoachAt,
      cfg: CHILD_POLISH
    };
  }

  function debugRuntimeGuard(){
    return {
      patch: PATCH,
      enabled: !!state.runtimeGuard.enabled,
      errorCount: state.runtimeGuard.errorCount,
      recoveredCount: state.runtimeGuard.recoveredCount,
      lastRecovery: state.runtimeGuard.lastRecovery,
      errors: [...state.runtimeGuard.errors],
      warnings: [...state.runtimeGuard.warnings]
    };
  }

  function debugAdvancedStatus(){
    return {
      patch: PATCH,
      dom: {
        replayVariety: !!$('gjArenaThemeHud') && !!$('gjBonusRoundBanner'),
        polishJuice: !!$('gjSoundBtn') && !!$('gjComboJuiceBanner'),
        microTutorial: !!$('gjMicroTutorial') && !!$('gjTutorialSkipHint'),
        difficultyPersonality: !!$('gjDifficultyBadge')
      },
      state: {
        replayVariety: !!state.replayVariety,
        bossDrama: !!state.bossDrama,
        rewardLoop: !!state.rewardLoop,
        polishJuice: !!state.polishJuice,
        microTutorial: !!state.microTutorial,
        difficultyPersonality: !!state.difficultyPersonality,
        finalBalance: !!state.finalBalance,
        balanceTuning: !!state.balanceTuning,
        childPolish: !!state.childPolish
      },
      setup: {
        runIndex: state.replayVariety?.runIndex || 0,
        theme: state.replayVariety?.arenaTheme || null,
        trickSet: state.replayVariety?.trickSet || null,
        difficulty: state.difficultyPersonality?.profile || null,
        muted: !!state.polishJuice?.muted,
        tutorialDoneBefore: !!state.microTutorial?.doneBefore
      }
    };
  }

  function debugAll(){
    const qa = callMaybe(runQaLock, { show:true }) || null;

    return {
      patch: PATCH,
      qa,
      state: callMaybe(getState),
      flow: callMaybe(debugFlow),
      final: callMaybe(debugFinal),
      touch: callMaybe(debugTouch),
      pacing: callMaybe(debugPacing),
      pattern: callMaybe(debugPattern),
      bossIdentity: callMaybe(debugBossIdentity),
      hazard: callMaybe(debugHazard),
      learning: callMaybe(debugLearning),
      missionChain: callMaybe(debugMissionChain),
      comeback: callMaybe(debugComeback),
      introGoal: callMaybe(debugIntroGoal),
      visualFx: callMaybe(debugVisualFx),

      replayVariety: callMaybe(debugReplayVariety),
      bossDrama: callMaybe(debugBossDrama),
      rewardLoop: callMaybe(debugRewardLoop),
      polishJuice: callMaybe(debugPolishJuice),
      microTutorial: callMaybe(debugMicroTutorial),
      difficultyPersonality: callMaybe(debugDifficultyPersonality),
      finalBalance: callMaybe(debugFinalBalance),
      balanceTuning: callMaybe(debugBalanceTuning),
      childPolish: callMaybe(debugChildPolish),
      runtimeGuard: callMaybe(debugRuntimeGuard)
    };
  }

  const publicApi = {
    patch: PATCH,
    boot,
    startGame,
    replayGame,
    togglePause,
    useHeroHit,
    goHub,
    goCooldownOrExit,
    updateHud,
    runQaLock,
    getState,

    debugFlow,
    debugFinal,
    debugTouch,
    debugPacing,
    debugPattern,
    debugBossIdentity,
    debugHazard,
    debugLearning,
    debugMissionChain,
    debugComeback,
    debugIntroGoal,
    debugVisualFx,

    debugReplayVariety,
    debugBossDrama,
    debugRewardLoop,
    clearRewardLoop,
    debugPolishJuice,
    debugMicroTutorial,
    debugDifficultyPersonality,
    debugFinalBalance,
    debugBalanceTuning,
    debugChildPolish,
    debugRuntimeGuard,
    debugAdvancedStatus,

    debugMergeLock(){
      return {
        patch: PATCH,
        advanced: debugAdvancedStatus(),
        requiredFunctions: qaRequiredFunctions(),
        qa: runQaLock({ show:false })
      };
    },

    debugAll,

    forceSpawn(kind = ''){
      return spawnTarget(kind);
    },

    forcePower(type = ''){
      return spawnPowerUp(type);
    },

    forceBossAttack(){
      return bossAttack();
    },

    forceHazard(lane = ''){
      return startArenaHazard(lane);
    },

    forceEnd(win = true){
      endGame(!!win);
      return getState();
    },

    forceFinalRush(){
      state.finalRush = true;
      markFinalRushStart();
      state.phase = 3;
      markPhaseChange('final');
      setArenaTheme('final');
      updateBossIdentity(true);
      startMissionChain(true);
      updateHud();
      return getState();
    },

    testBonusRound(){
      startBonusRound();
      return debugReplayVariety();
    },

    testDrama(){
      dramaSpeak('ข้าคือ Junk King! รอบนี้ไม่เหมือนเดิมแน่!', 1600, 0);
      return debugBossDrama();
    },

    testSound(){
      unlockAudio();
      playSound('good');
      setTimeout(() => playSound('hero'), 150);
      setTimeout(() => playSound('win'), 380);
      haptic('bonus');
      return debugPolishJuice();
    },

    testComboJuice(combo = 10){
      showComboJuice(combo);
      playSound('bonus');
      haptic('bonus');
      return debugPolishJuice();
    },

    toggleSound,

    testTutorial(id = 'firstGood'){
      showMicroTutorial(id, 3400);
      return debugMicroTutorial();
    },

    clearTutorialDone(){
      try{
        localStorage.removeItem(tutorialStorageKey());
      }catch(_){}

      state.microTutorial.doneBefore = false;
      resetMicroTutorialRun();
      return debugMicroTutorial();
    },

    testDifficultyPersonality(){
      setupDifficultyPersonality();
      announceDifficultyPersonality();
      return debugDifficultyPersonality();
    },

    testFinalBalance(){
      state.dangerMeter = 90;
      const relief = shouldForceReliefTarget();
      return {
        relief,
        debug: debugFinalBalance()
      };
    },

    testBalanceHold(){
      state.bossHp = 0;
      tryWinOrForceRush();
      return debugBalanceTuning();
    },

    testChildSummary(win = true){
      const s = buildSummary(!!win);
      s.rewardLoop = updateRewardLoop(s) || { enabled:false };
      renderKidsSummary(s);
      showScreen('summary');
      return debugChildPolish();
    },

    clearRuntimeErrors(){
      state.runtimeGuard.errors = [];
      state.runtimeGuard.warnings = [];
      state.runtimeGuard.errorCount = 0;
      state.runtimeGuard.recoveredCount = 0;
      state.runtimeGuard.lastRecovery = '';
      return debugRuntimeGuard();
    }
  };

  WIN.GoodJunkSoloBoss = publicApi;

  DOC.addEventListener('DOMContentLoaded', () => {
    const root =
      $('gjSoloBossApp') ||
      $('app') ||
      DOC.body;

    boot(root);
  });

  if(DOC.readyState !== 'loading'){
    setTimeout(() => {
      const root =
        $('gjSoloBossApp') ||
        $('app') ||
        DOC.body;

      boot(root);
    }, 0);
  }

})();
