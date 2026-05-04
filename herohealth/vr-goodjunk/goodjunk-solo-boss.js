// === /herohealth/vr-goodjunk/goodjunk-solo-boss.js ===
// FULL MERGED PATCH
// v20260504n-GOODJUNK-SOLO-BOSS-V8-29-MERGE-STABILIZER
//
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
// ✅ No Apps Script logging in this version

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const PATCH = 'v20260504n-GOODJUNK-SOLO-BOSS-V8-29-MERGE-STABILIZER';

  const qs = new URLSearchParams(location.search);

  const ROOT = 'https://supparang.github.io/webxr-health-mobile/herohealth/';
  const DEFAULT_ZONE = ROOT + 'nutrition-zone.html?pid=anon&diff=normal&time=120&view=mobile&hub=' + encodeURIComponent(ROOT + 'hub.html');

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

  function pick(arr){
    if(!Array.isArray(arr) || !arr.length) return null;
    return arr[Math.floor(state.rng() * arr.length)];
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
    { emoji:'🥦', label:'บรอกโคลี', group:'green', dmg:13, charge:9, tip:'ผักสีเขียวช่วยให้ร่างกายแข็งแรง', lesson:'ผักดี' },
    { emoji:'🥬', label:'ผักใบเขียว', group:'green', dmg:13, charge:9, tip:'ผักมีวิตามินและใยอาหาร', lesson:'ผักดี' },
    { emoji:'🥕', label:'แครอท', group:'green', dmg:11, charge:8, tip:'ผักหลากสีช่วยให้ได้สารอาหารหลากหลาย', lesson:'ผักหลากสี' },
    { emoji:'🍎', label:'แอปเปิล', group:'fruit', dmg:12, charge:10, tip:'ผลไม้สดดีกว่าขนมหวาน', lesson:'ผลไม้สด' },
    { emoji:'🍉', label:'แตงโม', group:'fruit', dmg:11, charge:9, tip:'ผลไม้สดช่วยเติมน้ำและวิตามิน', lesson:'ผลไม้สด' },
    { emoji:'🍌', label:'กล้วย', group:'fruit', dmg:11, charge:9, tip:'กล้วยให้พลังงานและโพแทสเซียม', lesson:'ผลไม้ให้พลังงาน' },
    { emoji:'🐟', label:'ปลา', group:'protein', dmg:13, charge:9, tip:'ปลาเป็นโปรตีนดี', lesson:'โปรตีนดี' },
    { emoji:'🥚', label:'ไข่ต้ม', group:'protein', dmg:12, charge:9, tip:'ไข่ต้มเป็นโปรตีนดีและไม่ใช้น้ำมันมาก', lesson:'วิธีปรุงสำคัญ' },
    { emoji:'🫘', label:'ถั่ว', group:'protein', dmg:12, charge:8, tip:'ถั่วเป็นโปรตีนจากพืช', lesson:'โปรตีนพืช' },
    { emoji:'🍚', label:'ข้าว', group:'carb', dmg:10, charge:7, tip:'ข้าวให้พลังงาน แต่ควรกินพอดี', lesson:'คาร์บพอดี' }
  ];

  const JUNK = [
    { emoji:'🍟', label:'เฟรนช์ฟรายส์', group:'fried', penalty:1, tip:'ของทอดมีน้ำมันมาก กินบ่อยไม่ดี', lesson:'ของทอด' },
    { emoji:'🍭', label:'ลูกอม', group:'sweet', penalty:1, tip:'ลูกอมมีน้ำตาลสูง', lesson:'น้ำตาลสูง' },
    { emoji:'🥤', label:'น้ำอัดลม', group:'soda', penalty:1, tip:'น้ำอัดลมมีน้ำตาลสูง', lesson:'เครื่องดื่มหวาน' },
    { emoji:'🍩', label:'โดนัท', group:'sweet', penalty:1, tip:'โดนัทหวานและมัน', lesson:'หวานและมัน' },
    { emoji:'🍔', label:'เบอร์เกอร์มัน', group:'fatty', penalty:1, tip:'อาหารมันและเค็มมากไม่ควรกินบ่อย', lesson:'มันและเค็ม' },
    { emoji:'🍫', label:'ช็อกโกแลตหวาน', group:'sweet', penalty:1, tip:'ขนมหวานควรกินนาน ๆ ครั้ง', lesson:'ขนมหวาน' }
  ];

  const BOSS = {
    name: 'Junk King',
    emoji: '👑🍔',
    weakness: {
      phase1: { label:'ผักสีเขียว', icons:['🥦','🥬','🥕'], group:'green' },
      phase2: { label:'โปรตีนดี', icons:['🐟','🥚','🫘'], group:'protein' },
      phase3: { label:'ผลไม้สด', icons:['🍎','🍉','🍌'], group:'fruit' }
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
    { id:'green-3', icon:'🥦', title:'เก็บผัก 3 ชิ้น', type:'collect_group', group:'green', target:3, reward:'shield' },
    { id:'protein-3', icon:'🐟', title:'เก็บโปรตีน 3 ชิ้น', type:'collect_group', group:'protein', target:3, reward:'hero' },
    { id:'fruit-3', icon:'🍎', title:'เก็บผลไม้ 3 ชิ้น', type:'collect_group', group:'fruit', target:3, reward:'slow' },
    { id:'combo-8', icon:'⚡', title:'ทำ Combo x8', type:'combo', target:8, reward:'hero' }
  ];

  const DAILY_CHALLENGES = [
    { id:'daily-green', title:'เก็บผัก 6 ชิ้น', group:'green', target:6 },
    { id:'daily-fruit', title:'เก็บผลไม้ 6 ชิ้น', group:'fruit', target:6 },
    { id:'daily-protein', title:'เก็บโปรตีน 5 ชิ้น', group:'protein', target:5 },
    { id:'daily-clean', title:'พลาดไม่เกิน 3 ครั้ง', type:'max_miss', target:3 }
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
      { id:'top', label:'เลนบน', icon:'⬆️', zone:'top', warning:'เลนบนมีขยะพุ่งมา!' },
      { id:'middle', label:'เลนกลาง', icon:'↔️', zone:'middle', warning:'เลนกลางอันตราย!' },
      { id:'bottom', label:'เลนล่าง', icon:'⬇️', zone:'bottom', warning:'เลนล่างมีอาหารขยะ!' }
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
      shield: { icon:'🛡️', label:'Rescue Shield', text:'ช่วยกันพลาด 1 ครั้ง' },
      focus: { icon:'🎯', label:'Focus Food', text:'อาหารดีจะออกมากขึ้น' },
      slow: { icon:'⏳', label:'Calm Time', text:'เวลาเป้าช้าลงชั่วคราว' },
      hero: { icon:'🦸', label:'Hero Boost', text:'HERO HIT เพิ่มเล็กน้อย' }
    }
  };

  const STAR_GOALS = {
    easy: {
      one: { score:120, acc:50, bossHpPct:65, text:'ชนะใจตัวเอง: เก็บอาหารดีให้ได้หลายชิ้น' },
      two: { score:180, acc:65, bossHpPct:35, text:'ฮีโร่พร้อมสู้: ลด HP บอสให้ต่ำกว่า 35%' },
      three: { score:230, acc:80, maxMiss:4, text:'สุดยอดฮีโร่: แม่นยำ 80% และพลาดไม่เกิน 4' }
    },

    normal: {
      one: { score:150, acc:55, bossHpPct:70, text:'เริ่มปราบบอส: เก็บอาหารดีและทำคะแนนให้ถึง 150' },
      two: { score:240, acc:70, bossHpPct:40, text:'ปราบบอสได้ดี: ลด HP บอสให้ต่ำกว่า 40%' },
      three: { score:320, acc:85, maxMiss:3, text:'ฮีโร่ 3 ดาว: แม่นยำ 85% และพลาดไม่เกิน 3' }
    },

    hard: {
      one: { score:180, acc:60, bossHpPct:75, text:'ผ่านด่านยาก: ทำคะแนนให้ถึง 180' },
      two: { score:300, acc:74, bossHpPct:42, text:'สวนกลับเก่ง: ลด HP บอสให้ต่ำกว่า 42%' },
      three: { score:400, acc:88, maxMiss:3, text:'เทพอาหารดี: แม่นยำ 88% และพลาดไม่เกิน 3' }
    },

    challenge: {
      one: { score:220, acc:62, bossHpPct:78, text:'ท้าทายเริ่มต้น: ทำคะแนนให้ถึง 220' },
      two: { score:360, acc:76, bossHpPct:45, text:'ผู้ท้าชิงบอส: ลด HP บอสให้ต่ำกว่า 45%' },
      three: { score:480, acc:90, maxMiss:2, text:'ตำนาน HeroHealth: แม่นยำ 90% และพลาดไม่เกิน 2' }
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
      'gjTouchDebug'
    ],

    minSafeArenaHeight: 120,
    maxBlockedTargets: 0,
    maxMissingDom: 0,
    requireExitHref: true,
    requireTouchReady: true,
    requireFlowReady: true,
    requireBossSystems: true
  };

  const POWER_UPS = [
    { id:'shield', emoji:'🛡️', label:'Shield', type:'shield' },
    { id:'slow', emoji:'⏳', label:'Slow Time', type:'slow' },
    { id:'cleanBlast', emoji:'✨', label:'Clean Blast', type:'cleanBlast' },
    { id:'heart', emoji:'💚', label:'Heart', type:'heart' }
  ];

  const STORAGE_LAST_SUMMARY = 'HHA_LAST_SUMMARY:goodjunk';
  const STORAGE_LAST_GENERIC = 'HHA_LAST_SUMMARY';

  const state = {
    rng: mulberry32(hashSeed(`${CFG.seed}:${CFG.pid}:${DIFF}:goodjunk-solo-boss`)),
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
    }
  };

  const el = {};
    function $(id){
    return DOC.getElementById(id);
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

      *{ box-sizing:border-box; }

      html,body{
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

      body{ min-height:100dvh; }

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

      #powerLayer{ z-index:88; }
      #fxLayer{ z-index:120; }

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

      .gjKidsScoreRow{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:9px;
        margin-top:14px;
      }

      .gjKidsScoreCard{
        border-radius:20px;
        padding:12px 10px;
        background:rgba(15,23,42,.70);
        border:1px solid rgba(148,163,184,.18);
        box-shadow:0 14px 34px rgba(0,0,0,.22);
      }

      .gjKidsScoreCard span{
        display:block;
        color:#cbd5e1;
        font-size:11px;
        font-weight:1000;
        letter-spacing:.04em;
      }

      .gjKidsScoreCard b{
        display:block;
        margin-top:5px;
        color:#f8fafc;
        font-size:clamp(20px,6vw,30px);
        line-height:1;
        font-weight:1000;
      }

      .gjKidsCards{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
        margin-top:14px;
      }

      .gjKidsCard{
        border-radius:22px;
        padding:13px 12px;
        text-align:left;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(15,23,42,.68);
        box-shadow:0 12px 34px rgba(0,0,0,.20);
      }

      .gjKidsCardIcon{
        font-size:28px;
        line-height:1;
      }

      .gjKidsCardTitle{
        margin-top:8px;
        font-size:14px;
        font-weight:1000;
        color:#fde68a;
      }

      .gjKidsCardText{
        margin-top:5px;
        font-size:12px;
        line-height:1.45;
        color:#dbeafe;
        font-weight:850;
      }

      .gjKidsBadgeShelf{
        margin-top:14px;
        padding:12px;
        border-radius:22px;
        background:rgba(2,6,23,.42);
        border:1px dashed rgba(250,204,21,.28);
      }

      .gjKidsBadgeTitle{
        font-size:13px;
        color:#fde68a;
        font-weight:1000;
      }

      .gjKidsBadges{
        margin-top:8px;
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        justify-content:center;
      }

      .gjKidsBadge{
        min-height:34px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:7px 10px;
        border-radius:999px;
        background:rgba(250,204,21,.12);
        border:1px solid rgba(250,204,21,.24);
        color:#fff7ed;
        font-size:12px;
        font-weight:1000;
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

        .gjKidsScoreRow{
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:7px;
        }

        .gjKidsCards{
          grid-template-columns:1fr;
        }

        .gjKidsActions{
          grid-template-columns:1fr;
        }

        .gjKidsBtn,
        .gjBossIntroBtn,
        .gjBtn{
          width:100%;
        }

        .gjIntroActions{
          grid-template-columns:1fr;
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
      try{ n.remove(); }catch(_){}
    }, 700);
  }

  function toast(msg, ms = 1200){
    bossSpeak(msg, ms);
  }

  function feedback(type){
    if(type === 'good') impactFlash();
    if(type === 'bad') warningFlash(420);
    if(type === 'hero') showHeroCutIn('🦸 HERO HIT!', 'พลังอาหารดีโจมตีบอส');
    if(type === 'win') impactFlash();
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
      try{ w.remove(); }catch(_){}
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

  function pickGoodByWeakness(){
    if(state?.learningTip && state.rng && state.rng() < .32){
      const v = normalizeVariantAsGameData(pickWeaknessVariant());
      if(v) return v;
    }

    const w = currentWeakness();
    const list = GOOD.filter(g => w.icons.includes(g.emoji));

    return list.length ? pick(list) : pick(GOOD);
  }

  function pickJunkByGroup(group){
    const list = JUNK.filter(j => {
      if(group === 'burger') return j.emoji === '🍔' || j.group === 'fatty';
      return j.group === group;
    });

    return list.length ? pick(list) : pick(JUNK);
  }

  function pickTrickyTarget(){
    const list = TARGET_VARIANTS.tricky || [];
    return list.length ? pick(list) : null;
  }

  function pickWeaknessVariant(){
    const key = currentBossIdentityKey?.() || '';

    let wanted = 'green';

    if(key === 'storm') wanted = 'protein';
    if(key === 'rage' || key === 'final') wanted = 'fruit';

    const list = (TARGET_VARIANTS.bossWeakness || []).filter(x => x.group === wanted);

    return list.length ? pick(list) : pickGoodByWeakness();
  }

  function normalizeVariantAsGameData(v){
    if(!v) return null;

    const kind = v.kind === 'junk' ? 'junk' : 'good';

    if(kind === 'good'){
      return {
        emoji: v.emoji,
        label: v.label,
        group: v.group || 'good',
        dmg: Number(v.dmg || 10),
        charge: Number(v.charge || 7),
        tip: v.tip || '',
        lesson: v.lesson || '',
        variant: true,
        tricky: !!v.tricky
      };
    }

    return {
      emoji: v.emoji,
      label: v.label,
      group: v.group || 'junk',
      penalty: Number(v.penalty || 1),
      tip: v.tip || '',
      lesson: v.lesson || '',
      variant: true,
      tricky: true
    };
  }

  function balancePushKind(kind){
    state.balance.history.push(kind);
    if(state.balance.history.length > 12) state.balance.history.shift();
  }

  function forcedKindFromBalance(){
    if(state.balance.forcedWeaknessNext > 0){
      state.balance.forcedWeaknessNext--;
      return 'weakness';
    }

    if(state.balance.forcedGoodNext > 0){
      state.balance.forcedGoodNext--;
      return 'good';
    }

    return '';
  }

  function spawnTarget(forceKind = ''){
    if(state.ended || state.paused || !state.started) return;

    const forced = forceKind || forcedKindFromBalance();

    if(forced === 'weakness'){
      const data = pickGoodByWeakness();
      balancePushKind('good');
      return spawnTargetWithData('good', data, {
        variantClass: 'weakness',
        showMiniLabel: true
      });
    }

    if(forced === 'good'){
      const data = pick(GOOD);
      balancePushKind('good');
      return spawnTargetWithData('good', data);
    }

    if(forced === 'junk'){
      const data = pick(JUNK);
      balancePushKind('junk');
      return spawnTargetWithData('junk', data);
    }

    if(['soda','sweet','fried','burger'].includes(forced)){
      const data = pickJunkByGroup(forced);
      balancePushKind('junk');
      return spawnTargetWithData('junk', data);
    }

    if(state.phase >= 2 && state.rng() < .16){
      const tricky = normalizeVariantAsGameData(pickTrickyTarget());

      if(tricky){
        state.learningTip.trickySeen++;
        balancePushKind(tricky.penalty ? 'junk' : 'good');
        return spawnTargetWithData(tricky.penalty ? 'junk' : 'good', tricky, {
          variantClass: 'tricky',
          showMiniLabel: true
        });
      }
    }

    if(state.rng() < (state.finalRush ? .22 : .12)){
      const weak = normalizeVariantAsGameData(pickWeaknessVariant());

      if(weak){
        state.learningTip.weaknessSeen++;
        balancePushKind('good');
        return spawnTargetWithData('good', weak, {
          variantClass: 'weakness',
          showMiniLabel: true
        });
      }
    }

    const calm = Date.now() < state.balance.calmUntil;
    let junkChance = tune.junkChance;

    if(calm) junkChance *= .62;
    if(state.finalRush) junkChance += .06;

    const kind = state.rng() < junkChance ? 'junk' : 'good';

    if(kind === 'good'){
      const data = state.rng() < .30 ? pickGoodByWeakness() : pick(GOOD);
      balancePushKind('good');
      return spawnTargetWithData('good', data);
    }

    const data = pick(JUNK);
    balancePushKind('junk');
    return spawnTargetWithData('junk', data);
  }

  function spawnSpecific(token){
    if(state.ended || state.paused || !state.started) return;

    if(token === 'good') return spawnTarget('good');
    if(token === 'junk') return spawnTarget('junk');
    if(token === 'weakness') return spawnTarget('weakness');

    if(['soda','sweet','fried','burger'].includes(token)){
      return spawnTarget(token);
    }

    return spawnTarget();
  }

  function spawnTargetWithData(kind = 'good', data = null, opts = {}){
    if(!data) data = kind === 'junk' ? pick(JUNK) : pick(GOOD);

    const id = `target_${++state.targetSeq}_${Date.now()}`;

    let size = kind === 'good'
      ? 52 + Math.floor(state.rng() * 15)
      : 50 + Math.floor(state.rng() * 14);

    if(state.finalRush) size += 3;

    const minSize = minTargetSize();

    if(size < minSize){
      size = minSize;
      state.touchSafety.enlargedCount++;
    }

    if(isMobileView() && data?.variant){
      size = Math.max(size, TOUCH_SAFETY.mobilePreferredTargetSize);
    }

    const p = pickSafeSpawn(size);

    const node = DOC.createElement('button');
    node.type = 'button';
    node.className = `gjTarget ${kind}`;
    node.dataset.id = id;
    node.dataset.kind = kind;

    if(opts.variantClass){
      node.classList.add(opts.variantClass);
    }

    if(data?.variant && !opts.variantClass){
      node.classList.add(data.penalty ? 'tricky' : 'weakness');
    }

    if(isMobileView()){
      node.classList.add('gjTouchLarge');
    }

    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.left = `${p.x}px`;
    node.style.top = `${p.y}px`;
    node.style.fontSize = `${Math.round(size * .50)}px`;
    node.textContent = data.emoji;

    if(opts.showMiniLabel || data?.variant){
      const label = DOC.createElement('span');
      label.className = 'gjMiniLabel';
      label.textContent = data.label || '';
      node.appendChild(label);
    }

    node.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      hitTarget(id);
    }, { passive:false });

    const item = {
      id,
      node,
      kind,
      data,
      x: p.x,
      y: p.y,
      size,
      born: now(),
      ttl: calcTargetTtl(kind),
      vx: (state.rng() - .5) * 18,
      vy: (state.rng() - .5) * 12
    };

    state.targets.set(id, item);
    el.targetLayer.appendChild(node);
    raiseTargetNode(node);

    setTimeout(() => {
      raiseTargetNode(node);
      nudgeTargetOutOfBlockedZone(item);
      auditOneTarget(item);
    }, 40);

    return item;
  }

  function calcTargetTtl(kind){
    let base = kind === 'good' ? 2800 : 2500;

    if(DIFF === 'easy') base += 600;
    if(DIFF === 'hard') base -= 250;
    if(DIFF === 'challenge') base -= 420;
    if(state.finalRush) base -= 260;
    if(Date.now() < state.activePower.slowUntil) base += 900;
    if(Date.now() < state.balance.calmUntil) base += 600;

    return Math.max(1250, base);
  }

  function spawnPowerUp(type = ''){
    if(state.ended || state.paused || !state.started) return;

    const p = type
      ? POWER_UPS.find(x => x.id === type) || pick(POWER_UPS)
      : pick(POWER_UPS);

    if(!p) return;

    const id = `power_${++state.powerSeq}_${Date.now()}`;
    const size = isMobileView() ? 58 : 54;
    const point = pickSafeSpawn(size);

    const node = DOC.createElement('button');
    node.type = 'button';
    node.className = 'gjTarget power';
    node.dataset.id = id;
    node.dataset.kind = 'power';
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.left = `${point.x}px`;
    node.style.top = `${point.y}px`;
    node.style.fontSize = `${Math.round(size * .50)}px`;
    node.textContent = p.emoji;

    if(isMobileView()){
      node.classList.add('gjTouchLarge');
    }

    node.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      collectPowerUp(id);
    }, { passive:false });

    const item = {
      id,
      node,
      kind: 'power',
      data: p,
      x: point.x,
      y: point.y,
      size,
      born: now(),
      ttl: 4800,
      vx: 0,
      vy: 0
    };

    state.powerUps.set(id, item);
    el.powerLayer.appendChild(node);
    raiseTargetNode(node);

    setTimeout(() => {
      raiseTargetNode(node);
      nudgeTargetOutOfBlockedZone(item);
      auditOneTarget(item);
    }, 40);

    return item;
  }

  function removeTarget(id){
    const item = state.targets.get(id);
    if(!item) return;

    state.targets.delete(id);
    try{ item.node.remove(); }catch(_){}
  }

  function removePowerUp(id){
    const item = state.powerUps.get(id);
    if(!item) return;

    state.powerUps.delete(id);
    try{ item.node.remove(); }catch(_){}
  }

  function clearTargets(){
    for(const id of Array.from(state.targets.keys())) removeTarget(id);
    for(const id of Array.from(state.powerUps.keys())) removePowerUp(id);
  }

  function clearJunkTargets(){
    for(const [id, item] of Array.from(state.targets.entries())){
      if(item.kind === 'junk'){
        fx(item.x, item.y, 'ล้าง!', 'good');
        removeTarget(id);
      }
    }
  }

  function collectPowerUp(id){
    const item = state.powerUps.get(id);
    if(!item || state.ended) return;

    const p = item.data;
    removePowerUp(id);

    state.powerUpsCollected[p.id] = (state.powerUpsCollected[p.id] || 0) + 1;

    if(p.id === 'shield'){
      state.activePower.shield++;
      toast('🛡️ Shield พร้อมกันพลาด');
    }

    if(p.id === 'slow'){
      state.activePower.slowUntil = Date.now() + 6200;
      toast('⏳ Slow Time!');
    }

    if(p.id === 'cleanBlast'){
      cleanBlastWave();
      clearJunkTargets();
      state.score += 25;
      state.dangerMeter = Math.max(0, state.dangerMeter - 24);
      toast('✨ Clean Blast! ล้างอาหารขยะทั้งจอ');
      impactFlash();
    }

    if(p.id === 'heart'){
      state.lives = Math.min(tune.lives, state.lives + 1);
      toast('💚 ได้หัวใจคืน');
    }

    fx(item.x, item.y, p.label, 'hero');
    updateHud();
  }
    function showLearningTip(text, lesson = '', ms = 1600){
    if(!state.learningTip?.enabled) return;

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
    const idx = Math.abs(hashSeed(`${CFG.pid}:${new Date().toDateString()}:goodjunk`)) % DAILY_CHALLENGES.length;
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
    state.comeback.activeUntil = Date.now() + COMEBACK_RULES.calmWindowMs;
    state.comeback.streakMistakeAtTrigger = state.balance.streakMiss || 0;

    state.balance.calmUntil = Math.max(
      state.balance.calmUntil || 0,
      state.comeback.activeUntil
    );

    state.balance.forcedGoodNext = Math.max(
      state.balance.forcedGoodNext || 0,
      COMEBACK_RULES.forcedGoodCount
    );

    state.balance.forcedWeaknessNext = Math.max(
      state.balance.forcedWeaknessNext || 0,
      COMEBACK_RULES.forcedWeaknessCount
    );

    state.comeback.totalForcedGood += COMEBACK_RULES.forcedGoodCount;
    state.comeback.totalForcedWeakness += COMEBACK_RULES.forcedWeaknessCount;

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

    if(state.finalRush){
      return ARENA_HAZARDS.schedule.finalEvery;
    }

    if(state.phase >= 3){
      return ARENA_HAZARDS.schedule.phase3Every;
    }

    if(state.phase >= 2){
      return ARENA_HAZARDS.schedule.phase2Every;
    }

    return ARENA_HAZARDS.schedule.phase1Every;
  }

  function hazardDurationMs(){
    return ARENA_HAZARDS.durationMs[DIFF] || ARENA_HAZARDS.durationMs.normal || 4200;
  }

  function pickHazardLane(){
    const lanes = ARENA_HAZARDS.lanes || [];
    return pick(lanes.length ? lanes : [{ id:'middle', label:'เลนกลาง', icon:'↔️', zone:'middle', warning:'เลนกลางอันตราย!' }]);
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

  function hitTarget(id){
    const item = state.targets.get(id);
    if(!item || state.ended || state.paused) return;

    const hazardTouched = applyHazardOnHit(item);

    if(item.kind === 'good'){
      state.good++;
      state.combo++;
      state.bestCombo = Math.max(state.bestCombo, state.combo);

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

      state.bossHp = clamp(state.bossHp - damage, 0, state.bossMaxHp);

      gainHeroHit(item.data.charge + Math.min(7, Math.floor(state.combo / 3)));

      const comboBonus =
        state.combo >= 15 ? 9 :
        state.combo >= 10 ? 6 :
        state.combo >= 5 ? 3 :
        0;

      state.score += 10 + comboBonus + (state.finalRush ? 3 : 0);

      fx(item.x, item.y, `+${10 + comboBonus}`, 'good');
      feedback('good');
      impactFlash();
      bossShake(state.bossShield ? 'shield' : 'hit');

      maybeShowLearningTip(item.data, true);

      if(item.data?.variant || item.data?.tricky){
        state.learningTip.correctTricky++;
      }

      updateDailyGood(item.data);
      progressMiniMissionByGood(item.data);
      updateMissionChainByGood(item.data);
      rewardSafeLaneHit(item);

      directorAfterGood();

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

      maybeShowLearningTip(item.data, false);

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
      }else{
        state.lives = Math.max(0, state.lives - penalty);
        state.score = Math.max(0, state.score - 6);
        state.dangerMeter = clamp(state.dangerMeter + 18 + extraDanger * 8, 0, 100);
        fx(item.x, item.y, 'พลาด!', 'bad');
        feedback('bad');
      }

      directorAfterMistake();

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

    state.score = Math.max(0, state.score - 4);
    state.dangerMeter = clamp(state.dangerMeter + 8, 0, 100);

    maybeShowLearningTip(item.data, false);

    fx(item.x, item.y, 'หลุด!', 'bad');
    feedback('bad');

    directorAfterMistake();

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
    const delay = Number(pattern.delay || 140);

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
    if(!minimumFightReached()) return false;
    if(!state.finalRush) return false;
    return true;
  }

  function tryWinOrForceRush(){
    if(applySoftWinHold()){
      updateHud();
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
      state.phase = 3;
      markPhaseChange('final');
      updateBossIdentity(true);
      startMissionChain(true);

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
      state.phase = 3;
      markPhaseChange('final');
      updateBossIdentity(true);
      startMissionChain(true);

      toast('🔥 FINAL RUSH!');
      setArenaTheme('final');
      bossAttack();
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
    showHeroCutIn('🌟 HEALTHY FINISH!', 'Junk King ถูกพลังอาหารดีปราบแล้ว');
    impactFlash();
    bossDefeatFx();

    setTimeout(() => {
      endGame(true);
    }, 1050);
  }

  function fullCoachText(){
    const w = currentWeakness();

    if(state.finalRush){
      const chain = currentMissionChain?.();
      if(chain?.coach) return `${chain.icon} ${chain.coach}`;
      return `🔥 FINAL • เก็บ ${w.label} • ใช้ HERO HIT`;
    }

    const chain = currentMissionChain?.();
    if(chain?.coach){
      return `${chain.icon} ${chain.coach}`;
    }

    if(state.patternScript?.activePatternName){
      return `🎬 Pattern: ${state.patternScript.activePatternName} • ${bossBookTip()}`;
    }

    const identity = currentBossIdentity();

    if(identity?.tip){
      return `${identity.emoji} ${identity.tip}`;
    }

    return bossBookTip();
  }

  function bossBookTip(){
    const w = currentWeakness();
    return `จุดอ่อนตอนนี้: ${w.label}`;
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
    cacheElements();

    setText(el.timeText, Math.max(0, Math.ceil(state.timeLeft)));
    setText(el.scoreText, state.score);
    setText(el.livesText, state.lives);
    setText(el.comboText, state.combo);
    setText(el.heroHitPct, `${Math.round(state.heroHit)}%`);

    if(el.heroHitBtn){
      el.heroHitBtn.classList.toggle('ready', state.heroHit >= 100);
      el.heroHitBtn.disabled = state.heroHit < 100 || state.paused || state.ended;
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

    updateMiniMissionHud();
    updateMissionChainHud();
    updateStarGoalHud();
    updateComebackPill();
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
    if(state.targets.size >= tune.maxTargets) return;

    const nowMs = now();
    let every = tune.spawnEvery;

    if(state.finalRush) every *= .74;
    if(Date.now() < state.activePower.slowUntil) every *= 1.18;
    if(Date.now() < state.balance.calmUntil) every *= 1.24;

    if(nowMs - state.lastSpawn >= every){
      state.lastSpawn = nowMs;
      spawnTarget();

      if(state.rng() < .055){
        spawnPowerUp();
      }
    }
  }

  function gameLoop(ts){
    if(state.ended) return;

    if(!state.lastFrame) state.lastFrame = ts;
    const dt = Math.min(.05, (ts - state.lastFrame) / 1000);
    state.lastFrame = ts;

    if(!state.paused && state.started){
      state.elapsedSec = (performance.now() - state.startTs) / 1000;
      state.timeLeft = Math.max(0, (Number(CFG.time) || tune.time) - state.elapsedSec);

      applyDangerDecay(dt);
      updateArenaHazard();
      tickMissionChain();
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
        startCountdown();
      }

      function onSkip(ev){
        ev.preventDefault();
        ev.stopPropagation();
        finish(true);
      }

      readyBtn?.addEventListener('click', onReady);
      skipBtn?.addEventListener('click', onSkip);
    });
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
      return 'วันนี้แยกอาหารดีได้แม่นมาก และพลาดน้อยมาก';
    }

    if(s.win){
      return 'วันนี้ชนะบอสได้ เพราะเก็บอาหารดีและใช้จังหวะได้ดี';
    }

    if(s.junkHit > s.missedGood){
      return 'ครั้งหน้าให้ระวังอาหารขยะ เช่น น้ำอัดลม ของทอด และของหวาน';
    }

    return 'ครั้งหน้าอย่าปล่อยอาหารดีหลุด เพราะอาหารดีช่วยชาร์จ HERO HIT';
  }

  function kidsWatchTip(s){
    if(s.junkHit >= 5){
      return 'เห็นน้ำอัดลม ขนมหวาน หรือของทอด ให้คิดก่อนแตะ';
    }

    if(s.missedGood >= 5){
      return 'อาหารดีที่หลุดไปทำให้ HERO HIT ช้าลง';
    }

    if(s.bestCombo < 8){
      return 'ลองแตะอาหารดีต่อเนื่อง เพื่อทำ Combo ให้สูงขึ้น';
    }

    return 'รักษาจังหวะดี ๆ แบบนี้ แล้วลองเพิ่ม Combo รอบหน้า';
  }

  function kidsNextTip(s){
    if(!s.win){
      return 'รอบหน้าดูจุดอ่อนบอสด้านล่าง แล้วเก็บอาหารตามจุดอ่อน';
    }

    if(s.stars !== '⭐⭐⭐'){
      return 'รอบหน้าลองเอา 3 ดาว โดยพลาดให้น้อยลง';
    }

    return 'รอบหน้าลองระดับ hard หรือ challenge ได้เลย';
  }

  function summaryText(s){
    const badges = kidsBadges(s);

    return `${kidsWinTitle(s)}

✅ ทำดี:
${kidsMainTip(s)}

⚠️ ระวัง:
${kidsWatchTip(s)}

➡️ รอบหน้า:
${kidsNextTip(s)}

🏅 Badge:
${badges.join(' • ')}`;
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

  function renderKidsSummary(s){
    const badges = kidsBadges(s);
    const title = kidsWinTitle(s);
    const mainTip = kidsMainTip(s);
    const watchTip = kidsWatchTip(s);
    const nextTip = kidsNextTip(s);

    const icon = s.win ? '🏆' : '💪';
    const sub = s.win
      ? 'เก่งมาก! วันนี้ Hero ชนะบอสอาหารขยะได้แล้ว'
      : 'ยังไม่เป็นไร รอบหน้า Hero จะเก่งขึ้นอีก';

    if(!el.summaryScreen) return;

    el.summaryScreen.innerHTML = `
      <div class="gjKidsSummary">
        <div class="gjKidsSummaryIcon">${icon}</div>
        <h1 class="gjKidsSummaryTitle">${title}</h1>
        <div class="gjKidsSummarySub">${sub}</div>

        <div class="gjKidsStars">${s.stars || '☆'}</div>

        <div class="gjKidsBadgeShelf">
          <div class="gjKidsBadgeTitle">เป้าหมายดาวรอบนี้</div>
          <div class="gjKidsBadges">
            <span class="gjKidsBadge">⭐ ได้ ${s.starGoal?.starsText || s.stars || '☆'}</span>
            <span class="gjKidsBadge">🎯 แม่นยำ ${s.accPct || calcAccuracy()}%</span>
            <span class="gjKidsBadge">⚡ Combo สูงสุด ${s.bestCombo || 0}</span>
          </div>
        </div>

        <div class="gjKidsScoreRow">
          <div class="gjKidsScoreCard">
            <span>คะแนน</span>
            <b>${s.score}</b>
          </div>
          <div class="gjKidsScoreCard">
            <span>อาหารดี</span>
            <b>${s.good}</b>
          </div>
          <div class="gjKidsScoreCard">
            <span>พลาด</span>
            <b>${s.miss}</b>
          </div>
        </div>

        <div class="gjKidsCards">
          <div class="gjKidsCard">
            <div class="gjKidsCardIcon">✅</div>
            <div class="gjKidsCardTitle">ทำดี</div>
            <div class="gjKidsCardText">${mainTip}</div>
          </div>

          <div class="gjKidsCard">
            <div class="gjKidsCardIcon">⚠️</div>
            <div class="gjKidsCardTitle">ระวัง</div>
            <div class="gjKidsCardText">${watchTip}</div>
          </div>

          <div class="gjKidsCard">
            <div class="gjKidsCardIcon">➡️</div>
            <div class="gjKidsCardTitle">รอบหน้า</div>
            <div class="gjKidsCardText">${nextTip}</div>
          </div>
        </div>

        <div class="gjKidsBadgeShelf">
          <div class="gjKidsBadgeTitle">รางวัลที่ได้</div>
          <div class="gjKidsBadges">
            ${badges.map(b => `<span class="gjKidsBadge">${b}</span>`).join('')}
          </div>
        </div>

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

  function saveSummary(win){
    const s = buildSummary(win);

    const payload = {
      ...s,

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

    state.ended = true;
    state.paused = false;

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

  function replayGame(){
    resetRunSystems();

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
      try{ n.remove(); }catch(_){}
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

  async function startGame(){
    if(state.startLocked || state.started) return;

    state.startLocked = true;

    cacheElements();
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

    setArenaTheme('shield');
    updateBossIdentity(true);

    await showBossIntro();

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

    state.startLocked = false;

    requestAnimationFrame(gameLoop);
  }

  function refreshUiState(){
    if(el.pauseBtn){
      el.pauseBtn.textContent = state.paused ? '▶️' : '⏸️';
    }

    if(el.backBtn){
      el.backBtn.title = 'ไป Cooldown';
    }
  }

  function togglePause(){
    if(!state.started || state.ended) return;

    state.paused = !state.paused;

    if(state.paused){
      toast('หยุดพัก');
    }else{
      state.lastFrame = 0;
      toast('เล่นต่อ!');
    }

    refreshUiState();
    updateHud();
  }

  function bindEvents(){
    cacheElements();

    if(el.startBtn && !el.startBtn.__gjBound){
      el.startBtn.__gjBound = true;
      el.startBtn.addEventListener('click', ev => {
        ev.preventDefault();
        startGame();
      });
    }

    if(el.backBtnIntro && !el.backBtnIntro.__gjBound){
      el.backBtnIntro.__gjBound = true;
      el.backBtnIntro.addEventListener('click', ev => {
        ev.preventDefault();
        goHub();
      });
    }

    if(el.pauseBtn && !el.pauseBtn.__gjBound){
      el.pauseBtn.__gjBound = true;
      el.pauseBtn.addEventListener('click', ev => {
        ev.preventDefault();
        togglePause();
      });
    }

    if(el.backBtn && !el.backBtn.__gjBound){
      el.backBtn.__gjBound = true;
      el.backBtn.addEventListener('click', ev => {
        ev.preventDefault();

        if(state.ended){
          goCooldownOrExit();
          return;
        }

        const ok = confirm('ออกจากเกมแล้วไป Cooldown เลยไหม?');
        if(ok) goCooldownOrExit();
      });
    }

    if(el.heroHitBtn && !el.heroHitBtn.__gjBound){
      el.heroHitBtn.__gjBound = true;
      el.heroHitBtn.addEventListener('click', ev => {
        ev.preventDefault();
        useHeroHit();
      });
    }

    WIN.addEventListener('resize', () => {
      runFinalLockCheck('resize');
      runQaLock({ show:false });
    }, { passive:true });

    WIN.addEventListener('orientationchange', () => {
      setTimeout(() => {
        runFinalLockCheck('orientationchange');
        runQaLock({ show:false });
      }, 220);
    }, { passive:true });
  }

  function boot(root, cfg = {}){
    if(state.booted) return;

    state.bootStarted = true;

    ensureFxStyle();

    if(root && root.nodeType === 1){
      root.id = root.id || 'gjSoloBossApp';
    }

    ensureRequiredDom();
    cacheElements();
    bindEvents();
    bindWorldTapDebug();

    resolveExitHref();
    showScreen('intro');
    updateHud();
    refreshUiState();
    runFinalLockCheck('boot');
    runQaLock({ show:false });

    state.booted = true;

    // ถ้า URL ส่ง run=auto หรือ autostart=1 ให้เริ่มเอง
    const auto =
      String(qs.get('autostart') || '').trim() === '1' ||
      String(qs.get('auto') || '').trim() === '1';

    if(auto){
      setTimeout(() => startGame(), 120);
    }

    return publicApi;
  }

  function debugTouch(){
    const targets = Array.from(state.targets.values()).map(item => {
      const r = item.node?.getBoundingClientRect?.();

      return {
        id: item.id,
        kind: item.kind,
        label: item.data?.label || '',
        x: Math.round(item.x),
        y: Math.round(item.y),
        size: item.size,
        blocked: isTargetVisiblyBlocked(item),
        rect: r ? {
          left: Math.round(r.left),
          top: Math.round(r.top),
          width: Math.round(r.width),
          height: Math.round(r.height)
        } : null
      };
    });

    return {
      patch: PATCH,
      enabled: !!state.touchSafety.enabled,
      mobile: isMobileView(),
      hitSlop: touchHitSlop(),
      minTargetSize: minTargetSize(),
      minTargetGap: minTargetGap(),
      safeArena: getSafeArenaRect(60),
      relocatedCount: state.touchSafety.relocatedCount,
      enlargedCount: state.touchSafety.enlargedCount,
      tapRescueCount: state.touchSafety.tapRescueCount,
      targetAuditCount: state.touchSafety.targetAuditCount,
      blockedBy: state.touchSafety.blockedBy,
      lastElementAtPoint: state.touchSafety.lastElementAtPoint,
      targets
    };
  }

  const publicApi = {
    PATCH,
    CFG,

    boot,
    startGame,
    replayGame,
    goCooldownOrExit,
    goHub,

    getState(){
      return {
        patch: PATCH,
        started: state.started,
        paused: state.paused,
        ended: state.ended,
        score: state.score,
        lives: state.lives,
        combo: state.combo,
        bossHp: state.bossHp,
        bossMaxHp: state.bossMaxHp,
        heroHit: state.heroHit,
        phase: state.phase,
        finalRush: state.finalRush,
        targets: state.targets.size,
        powerUps: state.powerUps.size
      };
    },

    debugFlow(){
      return {
        patch: PATCH,
        exitHref: resolveExitHref(),
        flow: { ...state.flow },
        hub: CFG.hub,
        defaultZone: DEFAULT_ZONE
      };
    },

    debugFinal(){
      return {
        patch: PATCH,
        finalLock: { ...state.finalLock },
        summarySaved: (() => {
          try{ return JSON.parse(localStorage.getItem(STORAGE_LAST_SUMMARY) || 'null'); }
          catch(_){ return null; }
        })()
      };
    },

    debugVisualFx(){
      return {
        patch: PATCH,
        hasImpactFlash: !!$('gjImpactFlash'),
        hasHeroCutIn: !!$('gjHeroCutIn'),
        hasShieldCrack: !!DOC.querySelector('.gjShieldCrack'),
        bossWrap: !!(el.bossWrap || $('bossWrap') || $('bossAvatar')),
        finalRushGlow: !!(el.gameWorld || DOC.body).classList.contains('gjFinalRushGlow')
      };
    },

    debugPacing(){
      return {
        patch: PATCH,
        diff: DIFF,
        elapsedSec: state.elapsedSec,
        minBossFightSec: tune.minBossFightSec,
        minimumFightReached: state.pacing.minimumFightReached,
        bossHp: state.bossHp,
        bossMaxHp: state.bossMaxHp,
        bossHpPct: Math.round((state.bossHp / state.bossMaxHp) * 100),
        phase: state.phase,
        finalRush: state.finalRush,
        softWinLocked: state.pacing.softWinLocked,
        phaseGate: { ...state.pacing.phaseGate },
        heroHit: state.heroHit,
        heroHitGainedThisSec: state.pacing.heroHitGainedThisSec,
        dangerMeter: state.dangerMeter,
        scoreWinNeed: tune.scoreWinNeed
      };
    },

    debugPattern(){
      return {
        patch: PATCH,
        enabled: !!state.patternScript.enabled,
        currentPhaseKey: state.patternScript.currentPhaseKey,
        activePatternId: state.patternScript.activePatternId,
        activePatternName: state.patternScript.activePatternName,
        activePatternSuccess: state.patternScript.activePatternSuccess,
        activePatternMistake: state.patternScript.activePatternMistake,
        index: { ...state.patternScript.index },
        lastPatternAt: state.patternScript.lastPatternAt,
        cooldownMs: state.patternScript.patternCooldownMs,
        patternRewardGiven: state.patternScript.patternRewardGiven
      };
    },

    debugBossIdentity(){
      return {
        patch: PATCH,
        enabled: !!state.bossIdentity.enabled,
        currentKey: state.bossIdentity.currentKey,
        identity: currentBossIdentity(),
        weakness: currentWeakness(),
        introShown: { ...state.bossIdentity.introShown },
        speechCount: { ...state.bossIdentity.speechCount },
        bossAvatar: el.bossAvatar?.textContent || '',
        hasNamePlate: !!$('gjBossNamePlate')
      };
    },

    debugHazard(){
      return {
        patch: PATCH,
        enabled: !!state.arenaHazard.enabled,
        active: state.arenaHazard.active,
        activeLane: state.arenaHazard.activeLane,
        activeZone: state.arenaHazard.activeZone,
        activeLabel: state.arenaHazard.activeLabel,
        endsInMs: state.arenaHazard.endsAt ? Math.max(0, state.arenaHazard.endsAt - Date.now()) : 0,
        hazardEveryMs: hazardEveryMs(),
        hazardDurationMs: hazardDurationMs(),
        hazardCount: state.arenaHazard.hazardCount,
        hitPenalty: state.arenaHazard.hitPenalty,
        safeHits: state.arenaHazard.safeHits,
        hasLaneDom: !!$('gjDangerLane'),
        hasBannerDom: !!$('gjHazardBanner')
      };
    },

    debugLearning(){
      return {
        patch: PATCH,
        enabled: !!state.learningTip.enabled,
        lastTip: state.learningTip.lastTip,
        lastLesson: state.learningTip.lastLesson,
        shownCount: state.learningTip.shownCount,
        correctTricky: state.learningTip.correctTricky,
        missedTricky: state.learningTip.missedTricky,
        trickySeen: state.learningTip.trickySeen,
        weaknessSeen: state.learningTip.weaknessSeen,
        hasTipDom: !!$('gjLearningTip')
      };
    },

    debugMissionChain(){
      return {
        patch: PATCH,
        enabled: !!state.missionChain.enabled,
        active: state.missionChain.active,
        progress: state.missionChain.progress,
        target: state.missionChain.target,
        completedIds: [...state.missionChain.completedIds],
        failedIds: [...state.missionChain.failedIds],
        rewardGiven: state.missionChain.rewardGiven,
        avoidStartedAt: state.missionChain.avoidStartedAt,
        avoidBroken: state.missionChain.avoidBroken,
        finishBoostReady: state.missionChain.finishBoostReady,
        chainComplete: state.missionChain.chainComplete,
        hasDom: !!$('gjMissionChain')
      };
    },

    debugComeback(){
      return {
        patch: PATCH,
        enabled: !!state.comeback.enabled,
        used: state.comeback.used,
        max: COMEBACK_RULES.maxComebackPerRun,
        active: Date.now() < state.comeback.activeUntil,
        activeLeftMs: state.comeback.activeUntil ? Math.max(0, state.comeback.activeUntil - Date.now()) : 0,
        lastReason: state.comeback.lastReason,
        rescueGiven: state.comeback.rescueGiven,
        calmGiven: state.comeback.calmGiven,
        focusGiven: state.comeback.focusGiven,
        heroGiven: state.comeback.heroGiven,
        totalShieldGiven: state.comeback.totalShieldGiven,
        totalForcedGood: state.comeback.totalForcedGood,
        totalForcedWeakness: state.comeback.totalForcedWeakness,
        totalHeroBoost: state.comeback.totalHeroBoost,
        recoverySuccess: state.comeback.recoverySuccess,
        recoveryFailed: state.comeback.recoveryFailed,
        balance: {
          streakGood: state.balance.streakGood,
          streakMiss: state.balance.streakMiss,
          forcedGoodNext: state.balance.forcedGoodNext,
          forcedWeaknessNext: state.balance.forcedWeaknessNext,
          calmUntil: state.balance.calmUntil
        },
        hasBanner: !!$('gjComebackBanner'),
        hasPill: !!$('gjComebackPill')
      };
    },

    debugIntroGoal(){
      return {
        patch: PATCH,
        enabled: !!state.introGoal.enabled,
        showing: !!state.introGoal.showing,
        skipped: !!state.introGoal.skipped,
        goalRead: !!state.introGoal.goalRead,
        starGoalShown: !!state.introGoal.starGoalShown,
        countdown: state.introGoal.countdown,
        starsNow: evaluateStarGoals(),
        starsText: calcStars(),
        goals: currentStarGoals(),
        hasIntroDom: !!$('gjBossIntro'),
        hasStarGoalHud: !!$('gjStarGoalHud')
      };
    },

    debugTouch,

    debugQA(show = true){
      return runQaLock({ show });
    },

    debugAll(){
      const qa = callMaybe(runQaLock, { show:true }) || null;

      return {
        patch: PATCH,
        qa,
        state: callMaybe(this.getState?.bind(this)),
        flow: callMaybe(this.debugFlow?.bind(this)),
        final: callMaybe(this.debugFinal?.bind(this)),
        touch: callMaybe(this.debugTouch?.bind(this)),
        pacing: callMaybe(this.debugPacing?.bind(this)),
        pattern: callMaybe(this.debugPattern?.bind(this)),
        bossIdentity: callMaybe(this.debugBossIdentity?.bind(this)),
        hazard: callMaybe(this.debugHazard?.bind(this)),
        learning: callMaybe(this.debugLearning?.bind(this)),
        missionChain: callMaybe(this.debugMissionChain?.bind(this)),
        comeback: callMaybe(this.debugComeback?.bind(this)),
        introGoal: callMaybe(this.debugIntroGoal?.bind(this)),
        visualFx: callMaybe(this.debugVisualFx?.bind(this))
      };
    },

    testHazard(lane = ''){
      startArenaHazard(lane);
      return this.debugHazard();
    },

    testTricky(){
      const t = normalizeVariantAsGameData(pickTrickyTarget());
      if(t){
        spawnTargetWithData(t.penalty ? 'junk' : 'good', t, {
          variantClass: 'tricky',
          showMiniLabel: true
        });
      }
      return this.debugLearning();
    },

    testWeakness(){
      const w = normalizeVariantAsGameData(pickWeaknessVariant());
      if(w){
        spawnTargetWithData('good', w, {
          variantClass: 'weakness',
          showMiniLabel: true
        });
      }
      return this.debugLearning();
    },

    nextMissionChain(){
      startMissionChain(true);
      return this.debugMissionChain();
    },

    testComeback(reason = 'manual'){
      triggerComeback(reason);
      return this.debugComeback();
    },

    testIntro(){
      showBossIntro();
      return this.debugIntroGoal();
    },

    toggleTouchDebug(on){
      state.calibration.debugOverlay = typeof on === 'boolean'
        ? on
        : !state.calibration.debugOverlay;

      ensureSafeAreaOverlay();
      updateTouchDebug();

      return this.debugTouch();
    },

    forceEnd(win = true){
      endGame(!!win);
      return this.debugFinal();
    },

    forceHero(){
      state.heroHit = 100;
      updateHud();
      return this.getState();
    },

    forceFinal(){
      state.finalRush = true;
      state.phase = 3;
      setArenaTheme('final');
      updateBossIdentity(true);
      startMissionChain(true);
      updateHud();
      return this.getState();
    }
  };

  WIN.GoodJunkSoloBoss = publicApi;
  WIN.bootGoodJunkSoloBoss = boot;

  WIN.addEventListener('hha:goodjunk:solo:start', () => {
    startGame();
  });

  DOC.addEventListener('hha:goodjunk:solo:start', () => {
    startGame();
  });

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', () => {
      boot($('gjSoloBossApp') || $('app') || DOC.body);
    }, { once:true });
  }else{
    boot($('gjSoloBossApp') || $('app') || DOC.body);
  }

})();
