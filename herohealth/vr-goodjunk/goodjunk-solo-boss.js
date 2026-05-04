// === /herohealth/vr-goodjunk/goodjunk-solo-boss.js ===
// FULL PATCH v20260503t-GOODJUNK-SOLO-BOSS-V8-15-FINAL-FULL-MERGE-LOCK
// GoodJunk Solo Boss — หน้าเล่นเกมจริง ไม่ใช่ launcher
// ✅ Mobile-safe HUD / compact single-hand mode
// ✅ Tap priority: targets clickable
// ✅ Safe spawn / calibration / debugFinal()
// ✅ Boss phases / skills / HERO HIT / power-ups / summary
// ✅ Uses CFG.hub as exit target, so launcher can send it to cooldown gate
// ✅ No Apps Script logging in this version

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const PATCH = 'v20260503t-GOODJUNK-SOLO-BOSS-V8-15-FINAL-FULL-MERGE-LOCK';
  const ROOT = 'https://supparang.github.io/webxr-health-mobile/herohealth/';
  const DEFAULT_HUB = ROOT + 'nutrition-zone.html';
  const qs = new URLSearchParams(location.search);

  function $(id){
    return DOC.getElementById(id);
  }

  function clean(v, d = ''){
    v = String(v ?? '').trim();
    return v || d;
  }

  function num(v, d = 0){
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function clamp(v, a, b){
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function now(){
    return performance.now();
  }

  function safeUrl(raw, fallback){
    try{
      if(!String(raw || '').trim()) return fallback;
      return new URL(String(raw), location.href).toString();
    }catch(_){
      return fallback;
    }
  }

  function safeDecode(v){
    try{
      return decodeURIComponent(String(v || ''));
    }catch(_){
      return String(v || '');
    }
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

  function pick(arr){
    return arr[Math.floor(state.rng() * arr.length)];
  }

  function on(node, evt, fn, opt){
    if(node && typeof node.addEventListener === 'function'){
      node.addEventListener(evt, fn, opt);
      return true;
    }
    return false;
  }

  function setText(node, text){
    if(node) node.textContent = String(text);
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
    launcher: clean(qs.get('launcher'), ''),
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
      spawnEvery: 900,
      maxTargets: 5,
      junkChance: .32,
      speedMin: .80,
      speedMax: 1.45,
      bossAttackEvery: 7800,
      finalRushAt: .28,
      minWinSec: 55,
      shieldUntilSec: 22,
      heroHitDmg: 54
    },

    normal: {
      time: 150,
      lives: 5,
      bossHp: 620,
      spawnEvery: 760,
      maxTargets: 6,
      junkChance: .40,
      speedMin: 1.00,
      speedMax: 1.90,
      bossAttackEvery: 6200,
      finalRushAt: .32,
      minWinSec: 70,
      shieldUntilSec: 28,
      heroHitDmg: 68
    },

    hard: {
      time: 180,
      lives: 4,
      bossHp: 820,
      spawnEvery: 650,
      maxTargets: 7,
      junkChance: .47,
      speedMin: 1.20,
      speedMax: 2.35,
      bossAttackEvery: 5200,
      finalRushAt: .36,
      minWinSec: 85,
      shieldUntilSec: 34,
      heroHitDmg: 82
    },

    challenge: {
      time: 180,
      lives: 4,
      bossHp: 980,
      spawnEvery: 560,
      maxTargets: 8,
      junkChance: .52,
      speedMin: 1.35,
      speedMax: 2.70,
      bossAttackEvery: 4500,
      finalRushAt: .40,
      minWinSec: 95,
      shieldUntilSec: 38,
      heroHitDmg: 96
    }
  };

  const tune = TUNING[DIFF] || TUNING.normal;
  const plannedTime = clamp(num(CFG.time, tune.time), 60, 180);

  const GOOD = [
    { emoji:'🍎', label:'แอปเปิล', group:'fruit', dmg:10, charge:8, tip:'ผลไม้มีวิตามิน' },
    { emoji:'🍉', label:'แตงโม', group:'fruit', dmg:9, charge:7, tip:'ผลไม้สดช่วยให้สดชื่น' },
    { emoji:'🥦', label:'บรอกโคลี', group:'green', dmg:12, charge:9, tip:'ผักมีใยอาหาร' },
    { emoji:'🥬', label:'ผักใบเขียว', group:'green', dmg:12, charge:9, tip:'ผักช่วยให้แข็งแรง' },
    { emoji:'🥕', label:'แครอท', group:'green', dmg:10, charge:8, tip:'ผักสีส้มมีประโยชน์' },
    { emoji:'🐟', label:'ปลา', group:'protein', dmg:13, charge:10, tip:'โปรตีนช่วยซ่อมแซมร่างกาย' },
    { emoji:'🥚', label:'ไข่', group:'protein', dmg:12, charge:9, tip:'ไข่เป็นโปรตีนดี' },
    { emoji:'🥛', label:'นม', group:'protein', dmg:11, charge:8, tip:'นมช่วยเสริมแคลเซียม' },
    { emoji:'🫘', label:'ถั่ว', group:'protein', dmg:12, charge:9, tip:'ถั่วเป็นโปรตีนจากพืช' },
    { emoji:'🍚', label:'ข้าว', group:'carb', dmg:10, charge:7, tip:'ข้าวให้พลังงาน' }
  ];

  const JUNK = [
    { emoji:'🥤', label:'น้ำอัดลม', group:'soda', penalty:1, tip:'น้ำตาลสูง' },
    { emoji:'🍟', label:'เฟรนช์ฟรายส์', group:'fried', penalty:1, tip:'ของทอดกินบ่อยไม่ดี' },
    { emoji:'🍩', label:'โดนัท', group:'sweet', penalty:1, tip:'หวานและมัน' },
    { emoji:'🍭', label:'ลูกอม', group:'sweet', penalty:1, tip:'หวานมาก' },
    { emoji:'🍫', label:'ช็อกโกแลตหวาน', group:'sweet', penalty:1, tip:'กินมากไม่ดี' },
    { emoji:'🧁', label:'คัพเค้ก', group:'sweet', penalty:1, tip:'หวานมาก' },
    { emoji:'🍔', label:'เบอร์เกอร์มันเยอะ', group:'fatty', penalty:1, tip:'ไขมันและเค็มสูง' }
  ];

  const BOSS = {
    name: 'Junk King',

    weakness: {
      phase1: {
        key: 'green',
        label: 'ผักสีเขียว',
        icons: ['🥦','🥬','🥕'],
        tip: 'ช่วยทำลายโล่บอส'
      },

      phase2: {
        key: 'protein',
        label: 'โปรตีนดี',
        icons: ['🐟','🥚','🫘','🥛'],
        tip: 'ช่วยต้าน Junk Storm'
      },

      phase3: {
        key: 'fruit',
        label: 'ผลไม้สด',
        icons: ['🍎','🍉'],
        tip: 'ช่วยชาร์จ HERO HIT'
      }
    },

    skills: [
      {
        id: 'junkStorm',
        name: 'Junk Storm',
        emoji: '🌪️',
        warning: 'พายุอาหารขยะ!',
        pattern: ['junk','junk','good','junk','weakness'],
        telegraphMs: 900,
        waveDelay: 150,
        dangerGain: 12
      },

      {
        id: 'sodaSplash',
        name: 'Soda Splash',
        emoji: '🥤',
        warning: 'น้ำอัดลมเด้งเร็ว!',
        pattern: ['soda','soda','good','junk','weakness'],
        telegraphMs: 820,
        waveDelay: 120,
        dangerGain: 16
      },

      {
        id: 'friedWall',
        name: 'Fried Wall',
        emoji: '🍟',
        warning: 'ของทอดปิดทาง!',
        pattern: ['fried','fried','lane','good','weakness'],
        telegraphMs: 1050,
        waveDelay: 135,
        dangerGain: 18
      },

      {
        id: 'sugarTrap',
        name: 'Sugar Trap',
        emoji: '🍩',
        warning: 'ของหวานหลอกตา!',
        pattern: ['sweet','good','sweet','junk','weakness'],
        telegraphMs: 950,
        waveDelay: 150,
        dangerGain: 14
      },

      {
        id: 'burgerShield',
        name: 'Burger Shield',
        emoji: '🍔',
        warning: 'บอสฟื้นโล่!',
        pattern: ['junk','good','burger','weakness'],
        telegraphMs: 1100,
        waveDelay: 160,
        dangerGain: 10,
        shieldRegen: true
      }
    ]
  };

  const POWER_UPS = [
    { id:'shield', emoji:'🛡️', label:'Hero Shield', durationSec:0 },
    { id:'slow', emoji:'⏳', label:'Slow Time', durationSec:6 },
    { id:'magnet', emoji:'🧲', label:'Good Magnet', durationSec:7 },
    { id:'cleanBlast', emoji:'✨', label:'Clean Blast', durationSec:0 }
  ];

  const DAILY = [
    {
      id: 'no-soda',
      title: 'ห้ามแตะน้ำอัดลม',
      icon: '🥤',
      rule: 'avoid_emoji',
      value: '🥤',
      reward: 'Soda Dodger'
    },

    {
      id: 'green-power',
      title: 'เก็บผักให้ครบ 8 ครั้ง',
      icon: '🥦',
      rule: 'collect_group',
      value: 'green',
      target: 8,
      reward: 'Green Hero'
    },

    {
      id: 'combo-master',
      title: 'ทำ Combo x15',
      icon: '⚡',
      rule: 'combo',
      target: 15,
      reward: 'Combo Master'
    }
  ];

  const el = {};

  const state = {
    patch: PATCH,

    bootStarted: false,
    booted: false,
    started: false,
    paused: false,
    ended: false,

    startLocked: false,
    heroHitLocked: false,
    exitLocked: false,
    summaryRendered: false,

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
    bossShield: true,
    elapsedSec: 0,
    rage: 0,
    dangerMeter: 0,

    dailyChallenge: null,
    dailyProgress: 0,
    dailyFailed: false,

    greenHits: 0,
    proteinHits: 0,
    fruitHits: 0,

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

    targets: new Map(),
    seq: 0,
    rng: mulberry32(CFG.seed),

    lastFrame: 0,
    lastSpawn: 0,
    lastBossAttack: 0,
    startTs: 0,
    endTs: 0,

    phaseAnnounced: {
      shieldBreak: false,
      phase2: false,
      phase3: false,
      finalRush: false
    },

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

    finalRushToastAt: 0,
    safeExitReady: false,
    finishMoveUsed: false,
    comebackTriggered: false,

    balance: {
      enabled: true,
      streakGood: 0,
      streakMiss: 0,
      recentKinds: [],
      recentMistakes: [],
      forcedGoodNext: 0,
      forcedWeaknessNext: 0,
      junkLimit: 4,
      calmUntil: 0,
      lastAssistAt: 0,
      lastDirectorAt: 0,
      level: 0,
      stress: 0,
      mercy: 0
    },

    tapSafety: {
      enabled: true,
      targetZ: 105,
      blockedTapCount: 0,
      forcedRaisedTargets: 0,
      lastTargetTapAt: 0,
      lastEmptyTapAt: 0
    },

    singleHand: {
      enabled: true,
      mobileOnly: true,
      side: 'right',
      safePadTop: 186,
      safePadBottom: 118,
      safePadSide: 18,
      lastModeSyncAt: 0
    },

    calibration: {
      enabled: true,
      debugOverlay: false,
      safeTopAdjust: 0,
      safeBottomAdjust: 0,
      safeSideAdjust: 0,
      minArenaHeight: 210,
      lastSafeRect: null,
      lastBlockedElement: '',
      lastTapX: 0,
      lastTapY: 0
    },

    flow: {
      fromWarmupGate: false,
      toCooldownGate: false,
      launcher: '',
      rawHub: '',
      safeHub: ''
    },

    finalLock: {
      enabled: true,
      version: 'v8.15',
      lastCheckAt: 0,
      layoutReady: false,
      tapReady: false,
      flowReady: false,
      calibrationReady: false,
      singleHandReady: false,
      domReady: false,
      warnings: [],
      errors: []
    },

    sfxEnabled: true,
    vibrateEnabled: true,
    lastSfxAt: 0,
    lastStartAt: 0,
    lastHeroHitAt: 0,
    lastExitAt: 0,
    lastClickAt: 0,

    domMode: 'unknown'
  };
    /* ---------- DOM / CSS ---------- */

  function cacheElements(){
    Object.assign(el, {
      app: $('gjSoloBossApp') || $('app') || DOC.body,

      boot: $('gjBoot'),
      bootStatus: $('gjBootStatusText'),
      bootError: $('gjBootError'),
      bootStartBtn: $('gjBootStartBtn'),
      bootBackBtn: $('gjBootBackBtn'),

      introScreen: $('introScreen'),
      gameScreen: $('gameScreen'),
      summaryScreen: $('summaryScreen'),

      introStartBtn: $('introStartBtn') || $('startBtn'),
      introBackBtn: $('introBackBtn'),

      gameWorld: $('gameWorld'),
      targetLayer: $('targetLayer'),
      fxLayer: $('fxLayer'),

      bossAvatar: $('bossAvatar'),
      bossWrap: $('bossWrap') || $('bossArena') || $('bossAvatar')?.parentElement,

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

      coachText: $('coachText'),
      goalText: $('goalText'),
      announcer: $('announcer'),
      toast: $('toast'),

      pauseBtn: $('pauseBtn'),
      backBtn: $('backBtn'),
      resumeBtn: $('resumeBtn'),

      pauseOverlay: $('pauseOverlay'),
      pauseResumeBtn: $('pauseResumeBtn'),
      pauseBackBtn: $('pauseBackBtn'),

      summaryTitle: $('summaryTitle'),
      summaryScore: $('summaryScore'),
      summaryGood: $('summaryGood'),
      summaryMiss: $('summaryMiss'),
      summaryStars: $('summaryStars'),
      summaryTip: $('summaryTip'),

      summaryReplayBtn: $('summaryReplayBtn') || $('replayBtn') || $('restartBtn'),
      summaryBackBtn: $('summaryBackBtn') || $('backHubBtn') || $('hubBtn') || $('homeBtn'),
      goCooldownBtn: $('goCooldownBtn') || $('summaryBackBtn'),

      topHud: $('gjMobileHud'),
      mobileHud: $('gjMobileHud'),
      heroHitBigBtn: $('gjHeroHitBigBtn'),
      dangerMeter: $('gjDangerMeter'),
      feedbackControls: $('gjFeedbackControls')
    });
  }

  function ensureScreenMarkup(){
    let app = $('gjSoloBossApp') || $('app') || DOC.body;

    if(!$('introScreen')){
      const intro = DOC.createElement('section');
      intro.id = 'introScreen';
      intro.innerHTML = `
        <div class="gjCompatPanel">
          <div class="gjCompatIcon">👑🍔</div>
          <h1>GoodJunk Solo Boss</h1>
          <p>เลือกอาหารดี หลบอาหารขยะ ทำลาย Junk King ให้ได้!</p>
          <div id="goalText" class="gjCompatGoal">⭐ เตรียมพร้อมก่อนเริ่ม</div>
          <div class="gjCompatActions">
            <button id="introStartBtn" type="button">เริ่มสู้บอส</button>
            <button id="introBackBtn" type="button">กลับ Nutrition</button>
          </div>
        </div>
      `;
      app.appendChild(intro);
    }

    if(!$('gameScreen')){
      const game = DOC.createElement('section');
      game.id = 'gameScreen';
      game.innerHTML = `
        <div id="gameWorld" class="gjCompatWorld">
          <div class="gjCompatBossBox" id="bossWrap">
            <div id="bossAvatar" class="gjCompatBoss">👑🍔</div>
            <div class="gjCompatBossHp">
              <div id="bossHpFill"></div>
            </div>
            <div id="bossHpText">100%</div>
          </div>

          <div id="targetLayer"></div>
          <div id="fxLayer"></div>

          <div class="gjCompatHud gjHud">
            <div>⭐ <b id="scoreText">0</b></div>
            <div>⏱️ <b id="timerText">0</b></div>
            <div>❤️ <b id="lifeText">0</b></div>
            <div>PHASE <b id="phaseText">SHIELD</b></div>
            <div>COMBO <b id="comboText">0</b></div>
            <div>GOOD <b id="goodText">0</b></div>
            <div>MISS <b id="missText">0</b></div>
            <div>RAGE <b id="rageText">0</b></div>
          </div>

          <div class="gjCompatHeroMini">
            <button id="heroHitBtn" type="button">
              🦸 HERO HIT <span id="heroHitText">0%</span>
            </button>
            <div class="gjCompatHeroBar">
              <div id="heroHitFill"></div>
            </div>
          </div>

          <div id="coachText" class="gjCompatCoach">จุดอ่อนบอส: ผักสีเขียว</div>
          <div id="announcer" class="gjCompatAnnouncer"></div>
          <div id="toast" class="gjCompatToast"></div>

          <div class="gjCompatGameBtns">
            <button id="pauseBtn" type="button">พัก</button>
            <button id="backBtn" type="button">ออก</button>
          </div>
        </div>

        <div id="pauseOverlay" class="gjCompatPause">
          <div>
            <h2>พักเกม</h2>
            <button id="pauseResumeBtn" type="button">เล่นต่อ</button>
            <button id="pauseBackBtn" type="button">ออก</button>
          </div>
        </div>
      `;
      app.appendChild(game);
    }

    if(!$('summaryScreen')){
      const sum = DOC.createElement('section');
      sum.id = 'summaryScreen';
      sum.innerHTML = `
        <div class="gjCompatPanel gjCompatSummary">
          <div class="gjCompatIcon">🏆</div>
          <h1 id="summaryTitle">สรุปผล</h1>

          <div class="gjCompatSummaryGrid">
            <div><span>คะแนน</span><b id="summaryScore">0</b></div>
            <div><span>อาหารดี</span><b id="summaryGood">0</b></div>
            <div><span>พลาด</span><b id="summaryMiss">0</b></div>
            <div><span>ดาว</span><b id="summaryStars">☆</b></div>
          </div>

          <pre id="summaryTip" class="gjCompatSummaryTip"></pre>

          <div class="gjCompatActions">
            <button id="summaryReplayBtn" type="button">เล่นอีกครั้ง</button>
            <button id="summaryBackBtn" type="button">ไป Cooldown</button>
          </div>
        </div>
      `;
      app.appendChild(sum);
    }

    state.domMode = 'compat-ready';
  }

  function ensureRequiredDom(){
    let app = $('gjSoloBossApp') || $('app');

    if(!app){
      app = DOC.createElement('main');
      app.id = 'gjSoloBossApp';
      app.className = 'gj-solo-boss-app';
      DOC.body.appendChild(app);
    }

    ensureScreenMarkup();
    cacheElements();
  }

  function ensureFxStyle(){
    if($('gj-solo-runtime-style')) return;

    const style = DOC.createElement('style');
    style.id = 'gj-solo-runtime-style';

    style.textContent = `
      *{
        box-sizing:border-box;
      }

      html,body{
        margin:0;
        width:100%;
        height:100%;
        overflow:hidden;
        background:#020617;
        color:#f8fafc;
        font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
        -webkit-tap-highlight-color:transparent;
      }

      #gjSoloBossApp,
      #app{
        position:relative;
        width:100vw;
        height:100dvh;
        overflow:hidden;
        isolation:isolate;
        background:linear-gradient(180deg,#020617,#0f172a 56%,#111827);
      }

      #introScreen,
      #gameScreen,
      #summaryScreen{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        overflow:hidden;
      }

      #introScreen,
      #summaryScreen{
        z-index:180;
        display:grid;
        place-items:center;
        padding:16px;
      }

      #gameScreen{
        z-index:10;
        display:block;
      }

      #gameWorld,
      .gjCompatWorld{
        position:absolute !important;
        inset:0 !important;
        overflow:hidden !important;
        touch-action:manipulation !important;
        background:linear-gradient(180deg,#061329,#0f172a 58%,#020617);
      }

      #targetLayer{
        position:absolute !important;
        inset:0 !important;
        z-index:100 !important;
        pointer-events:none !important;
      }

      #fxLayer{
        position:absolute !important;
        inset:0 !important;
        z-index:140 !important;
        pointer-events:none !important;
      }

      .gjTarget,
      .foodTarget,
      .target,
      .gj-food,
      .gjPowerTarget{
        position:absolute !important;
        z-index:105 !important;
        pointer-events:auto !important;
        touch-action:manipulation !important;
        cursor:pointer !important;
        user-select:none !important;
        -webkit-user-select:none !important;
        -webkit-tap-highlight-color:transparent !important;
        display:grid;
        place-items:center;
        border-radius:999px;
        border:2px solid rgba(255,255,255,.18);
        transform:translate(-50%,-50%);
        box-shadow:0 16px 34px rgba(0,0,0,.30);
        font-weight:1000;
      }

      .gjTarget:active{
        transform:translate(-50%,-50%) scale(.92) !important;
      }

      .gjTarget.good{
        background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.34),rgba(34,197,94,.24),rgba(15,23,42,.86));
        box-shadow:
          0 0 0 4px rgba(34,197,94,.12),
          0 0 28px rgba(34,197,94,.30),
          0 18px 36px rgba(0,0,0,.28) !important;
      }

      .gjTarget.junk{
        background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.24),rgba(239,68,68,.24),rgba(15,23,42,.88));
        border-color:rgba(248,113,113,.55);
        animation:gjJunkPulse .66s ease-in-out infinite alternate;
      }

      .gjTarget.power{
        background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.44),rgba(250,204,21,.30),rgba(15,23,42,.88));
        border-color:rgba(250,204,21,.72);
        animation:gjPowerPulse .72s ease-in-out infinite alternate;
      }

      @keyframes gjJunkPulse{
        from{
          filter:saturate(1) brightness(1);
        }
        to{
          filter:saturate(1.2) brightness(1.16) drop-shadow(0 0 16px rgba(239,68,68,.36));
        }
      }

      @keyframes gjPowerPulse{
        from{
          filter:brightness(1);
          transform:translate(-50%,-50%) scale(1);
        }
        to{
          filter:brightness(1.2);
          transform:translate(-50%,-50%) scale(1.06);
        }
      }

      .gjCompatPanel{
        width:min(92vw,680px);
        margin:0 auto;
        padding:20px;
        border-radius:28px;
        background:linear-gradient(180deg,rgba(15,23,42,.94),rgba(2,6,23,.90));
        color:#f8fafc;
        border:1px solid rgba(148,163,184,.18);
        box-shadow:0 24px 70px rgba(0,0,0,.38);
        text-align:center;
      }

      .gjCompatPanel h1{
        margin:8px 0;
        font-size:clamp(28px,7vw,48px);
        line-height:1.02;
        font-weight:1000;
      }

      .gjCompatPanel p{
        color:#cbd5e1;
        font-weight:800;
        line-height:1.6;
      }

      .gjCompatIcon{
        font-size:clamp(54px,14vw,96px);
        line-height:1;
      }

      .gjCompatGoal{
        margin:14px 0;
        padding:12px;
        border-radius:18px;
        background:rgba(15,23,42,.62);
        border:1px solid rgba(148,163,184,.16);
        color:#fde68a;
        font-weight:1000;
        line-height:1.45;
      }

      .gjCompatActions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        justify-content:center;
        margin-top:14px;
      }

      .gjCompatActions button,
      .gjCompatGameBtns button,
      .gjCompatHeroMini button,
      .gjCompatPause button{
        min-height:48px;
        padding:0 16px;
        border:0;
        border-radius:16px;
        font:inherit;
        font-weight:1000;
        cursor:pointer;
        background:linear-gradient(180deg,#86efac,#22c55e);
        color:#052e16;
      }

      .gjCompatActions button + button,
      .gjCompatGameBtns button,
      .gjCompatPause button + button{
        background:rgba(15,23,42,.78);
        border:1px solid rgba(148,163,184,.18);
        color:#f8fafc;
      }

      .gjCompatBossBox{
        position:absolute;
        left:50%;
        top:76px;
        transform:translateX(-50%);
        z-index:42;
        display:grid;
        place-items:center;
        gap:6px;
        pointer-events:none;
      }

      .gjCompatBoss{
        font-size:clamp(54px,13vw,96px);
        filter:drop-shadow(0 18px 36px rgba(0,0,0,.45));
        pointer-events:none;
      }

      .gjCompatBossHp{
        width:min(320px,72vw);
        height:14px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(2,6,23,.78);
        border:1px solid rgba(148,163,184,.22);
        pointer-events:none;
      }

      .gjCompatBossHp #bossHpFill{
        height:100%;
        width:100%;
        background:linear-gradient(90deg,#22c55e,#facc15,#ef4444);
        border-radius:999px;
      }

      #bossHpText{
        color:#e5e7eb;
        font-weight:1000;
        text-shadow:0 8px 18px rgba(0,0,0,.45);
        pointer-events:none;
      }

      .gjCompatHud{
        position:absolute;
        left:12px;
        top:12px;
        z-index:50;
        display:grid;
        grid-template-columns:repeat(2,minmax(82px,auto));
        gap:7px;
        pointer-events:none;
      }

      .gjCompatHud > div{
        min-height:32px;
        padding:6px 9px;
        border-radius:999px;
        background:rgba(15,23,42,.76);
        border:1px solid rgba(148,163,184,.18);
        color:#f8fafc;
        font-weight:900;
        box-shadow:0 10px 24px rgba(0,0,0,.24);
      }

      .gjCompatHeroMini{
        position:absolute;
        right:12px;
        bottom:14px;
        z-index:58;
        width:160px;
      }

      .gjCompatHeroMini button{
        width:100%;
        pointer-events:auto;
      }

      .gjCompatHeroBar{
        margin-top:6px;
        height:10px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(2,6,23,.74);
        border:1px solid rgba(148,163,184,.18);
      }

      .gjCompatHeroBar #heroHitFill{
        height:100%;
        width:0%;
        border-radius:999px;
        background:linear-gradient(90deg,#38bdf8,#facc15);
      }

      .gjCompatCoach{
        position:absolute;
        left:50%;
        bottom:16px;
        transform:translateX(-50%);
        z-index:48;
        max-width:min(52vw,520px);
        padding:9px 12px;
        border-radius:999px;
        background:rgba(15,23,42,.78);
        border:1px solid rgba(148,163,184,.18);
        color:#dbeafe;
        font-size:13px;
        font-weight:900;
        text-align:center;
        pointer-events:none;
      }

      .gjCompatAnnouncer{
        position:absolute;
        left:50%;
        top:174px;
        transform:translateX(-50%);
        z-index:62;
        max-width:min(90vw,640px);
        padding:10px 14px;
        border-radius:18px;
        background:rgba(15,23,42,.82);
        color:#fde68a;
        font-weight:1000;
        text-align:center;
        display:none;
        pointer-events:none;
      }

      .gjCompatToast,
      .gjRuntimeToast{
        position:absolute;
        left:50%;
        bottom:96px;
        transform:translateX(-50%);
        z-index:95;
        max-width:min(92vw,620px);
        padding:10px 14px;
        border-radius:999px;
        background:rgba(15,23,42,.92);
        color:#fff;
        border:1px solid rgba(148,163,184,.18);
        font-weight:1000;
        box-shadow:0 18px 42px rgba(0,0,0,.34);
        text-align:center;
        display:none;
        pointer-events:none;
      }

      .gjCompatGameBtns{
        position:absolute;
        right:12px;
        top:12px;
        z-index:64;
        display:flex;
        gap:8px;
      }

      .gjCompatGameBtns button{
        pointer-events:auto;
      }

      .gjCompatPause{
        position:absolute;
        inset:0;
        z-index:150;
        display:none;
        place-items:center;
        background:rgba(2,6,23,.72);
        backdrop-filter:blur(8px);
      }

      .gjCompatPause.show{
        display:grid;
      }

      .gjCompatPause > div{
        width:min(90vw,420px);
        padding:18px;
        border-radius:24px;
        background:rgba(15,23,42,.94);
        border:1px solid rgba(148,163,184,.18);
        color:#fff;
        text-align:center;
      }

      .gjCompatSummaryGrid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
        margin:14px 0;
      }

      .gjCompatSummaryGrid > div{
        border-radius:16px;
        background:rgba(15,23,42,.62);
        border:1px solid rgba(148,163,184,.16);
        padding:10px;
      }

      .gjCompatSummaryGrid span{
        display:block;
        color:#cbd5e1;
        font-size:12px;
        font-weight:900;
      }

      .gjCompatSummaryGrid b{
        display:block;
        margin-top:4px;
        font-size:20px;
      }

      .gjCompatSummaryTip{
        max-height:min(42vh,360px);
        overflow:auto;
        white-space:pre-wrap;
        text-align:left;
        margin:12px 0 0;
        padding:14px;
        border-radius:18px;
        background:rgba(15,23,42,.62);
        border:1px solid rgba(148,163,184,.16);
        color:#e5e7eb;
        font:inherit;
        font-size:14px;
        line-height:1.55;
        font-weight:800;
      }

      #gjMobileHud{
        position:absolute;
        left:10px;
        right:10px;
        top:6px;
        z-index:55;
        pointer-events:none;
        display:grid;
        gap:5px;
      }

      .gjMobileTopRow{
        display:flex;
        gap:6px;
        align-items:center;
        justify-content:center;
        transform:scale(.88);
        transform-origin:top center;
      }

      .gjMobilePill{
        min-width:68px;
        min-height:30px;
        padding:5px 8px;
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

      .gjBossBarWrap{
        width:min(390px,86vw);
        justify-self:center;
        padding:5px 8px;
        border-radius:14px;
        background:rgba(15,23,42,.78);
        border:1px solid rgba(148,163,184,.20);
        box-shadow:0 12px 30px rgba(0,0,0,.28);
        backdrop-filter:blur(8px);
        pointer-events:none;
      }

      .gjBossBarTop{
        display:flex;
        justify-content:space-between;
        color:#e5e7eb;
        font-size:11px;
        font-weight:1000;
        margin-bottom:5px;
      }

      .gjBossBar{
        height:9px;
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
        right:7px;
        bottom:76px;
        z-index:72;
        width:66px;
        height:66px;
        border-radius:20px;
        border:2px solid rgba(250,204,21,.78);
        background:linear-gradient(180deg,#fde68a,#facc15 50%,#f59e0b);
        color:#422006;
        box-shadow:0 18px 38px rgba(0,0,0,.35);
        display:grid;
        grid-template-rows:auto auto auto;
        place-items:center;
        gap:0;
        cursor:pointer;
        font-weight:1000;
        touch-action:manipulation;
        pointer-events:auto;
      }

      .gjHeroHitIcon{
        font-size:19px;
        line-height:1;
      }

      .gjHeroHitText{
        font-size:8.5px;
        line-height:1;
      }

      .gjHeroHitPct{
        font-size:13px;
        line-height:1;
      }

      #gjHeroHitBigBtn.ready{
        animation:gjHeroReady .48s ease-in-out infinite alternate;
      }

      #gjHeroHitBigBtn.not-ready{
        opacity:.74;
        filter:saturate(.72);
        background:linear-gradient(180deg,#94a3b8,#64748b);
        color:#f8fafc;
      }

      @keyframes gjHeroReady{
        from{
          transform:scale(1);
        }
        to{
          transform:scale(1.07);
          box-shadow:0 0 28px rgba(250,204,21,.75),0 22px 44px rgba(0,0,0,.40);
        }
      }

      #gjDangerMeter{
        position:absolute;
        left:7px;
        bottom:80px;
        z-index:70;
        width:84px;
        padding:5px 6px;
        border-radius:13px;
        background:rgba(15,23,42,.78);
        border:1px solid rgba(148,163,184,.20);
        box-shadow:0 16px 34px rgba(0,0,0,.30);
        backdrop-filter:blur(8px);
        pointer-events:none;
      }

      .gjDangerLabel{
        color:#fecaca;
        font-size:8.5px;
        font-weight:1000;
        letter-spacing:.08em;
        margin-bottom:3px;
      }

      .gjDangerTrack{
        height:7px;
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
        left:7px;
        top:98px;
        z-index:76;
        display:flex;
        gap:6px;
        transform:scale(.78);
        transform-origin:top left;
        opacity:.68;
      }

      #gjFeedbackControls button{
        width:32px;
        height:32px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.22);
        background:rgba(15,23,42,.76);
        color:#f8fafc;
        box-shadow:0 12px 28px rgba(0,0,0,.26);
        backdrop-filter:blur(8px);
        font-size:14px;
        cursor:pointer;
        touch-action:manipulation;
        pointer-events:auto;
      }

      .gjSingleHandLeft #gjHeroHitBigBtn{
        left:7px;
        right:auto;
      }

      .gjSingleHandLeft #gjDangerMeter{
        right:7px;
        left:auto;
      }

      .gjSingleHandMode #coachText,
      .gjSingleHandMode .gjCompatCoach{
        left:7px !important;
        right:7px !important;
        bottom:5px !important;
        transform:none !important;
        max-width:none !important;
        min-height:30px !important;
        max-height:32px !important;
        padding:6px 9px !important;
        font-size:10px !important;
        line-height:1.15 !important;
        text-align:center !important;
        border-radius:999px !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:ellipsis !important;
        display:block !important;
      }

      .gjSingleHandMode .gjCompatGameBtns{
        top:98px !important;
        right:7px !important;
        transform:scale(.78) !important;
        transform-origin:top right;
      }

      .gjSingleHandMode .gjCompatGameBtns button{
        min-height:32px !important;
        padding:0 9px !important;
        border-radius:999px !important;
        font-size:11px !important;
      }

      .gjSingleHandMode .gjCompatBossBox{
        top:126px !important;
        transform:translateX(-50%) scale(.68) !important;
      }

      .gjSingleHandMode #bossAvatar,
      .gjSingleHandMode .gjCompatBoss{
        font-size:50px !important;
      }

      .is-playing #summaryScreen,
      .is-playing #summaryBackBtn,
      .is-playing #goCooldownBtn,
      .is-playing #resumeBtn,
      .is-playing #pauseResumeBtn{
        display:none !important;
      }

      .is-paused #pauseBtn{
        display:none !important;
      }

      .is-ended #gameScreen,
      .is-ended #pauseBtn,
      .is-ended #backBtn,
      .is-ended #resumeBtn,
      .is-ended #pauseResumeBtn,
      .is-ended #gjHeroHitBigBtn,
      .is-ended #gjDangerMeter,
      .is-ended #coachText,
      .is-ended .gjCompatCoach{
        display:none !important;
      }

      .is-ended #summaryScreen{
        display:grid !important;
      }

      @keyframes gjFxFloat{
        from{
          opacity:1;
          transform:translate(-50%,-50%) translateY(0) scale(1);
        }
        to{
          opacity:0;
          transform:translate(-50%,-50%) translateY(-36px) scale(1.12);
        }
      }

      .gjFx{
        position:absolute;
        z-index:140;
        pointer-events:none;
        font-size:22px;
        font-weight:1000;
        text-shadow:0 10px 28px rgba(0,0,0,.42);
        animation:gjFxFloat .7s ease-out forwards;
      }

      .gjArenaShield{
        background:
          radial-gradient(circle at 50% 8%,rgba(96,165,250,.20),transparent 34%),
          linear-gradient(180deg,#061329,#0f172a 58%,#020617) !important;
      }

      .gjArenaStorm{
        background:
          radial-gradient(circle at 20% 12%,rgba(14,165,233,.26),transparent 32%),
          linear-gradient(180deg,#082f49,#0f172a 58%,#020617) !important;
      }

      .gjArenaRage{
        background:
          radial-gradient(circle at 18% 18%,rgba(239,68,68,.25),transparent 30%),
          linear-gradient(180deg,#3b0a0a,#111827 56%,#020617) !important;
      }

      .gjArenaFinal{
        background:
          radial-gradient(circle at 50% 0%,rgba(250,204,21,.30),transparent 34%),
          linear-gradient(180deg,#451a03,#111827 50%,#020617) !important;
      }

      #gjCinematicOverlay,
      #gjWarningFlash,
      #gjFinalRushOverlay,
      #gjHeroCutIn,
      #gjBigDamage,
      .gjShieldCrack,
      #gjSafeAreaOverlay{
        pointer-events:none !important;
      }

      @media (min-width:721px){
        #gjMobileHud{
          display:none;
        }
      }
    `;

    DOC.head.appendChild(style);
  }
    /* ---------- UI helpers ---------- */

  function show(node){
    if(!node) return;
    node.hidden = false;

    if(node.id === 'introScreen' || node.id === 'summaryScreen'){
      node.style.display = 'grid';
    }else{
      node.style.display = 'block';
    }
  }

  function hide(node){
    if(!node) return;
    node.hidden = true;
    node.style.display = 'none';
  }

  function toggleNode(node, yes, display = ''){
    if(!node) return;
    node.hidden = !yes;
    node.style.display = yes ? display : 'none';
  }

  function clickGuard(key = 'default', ms = 450){
    const t = Date.now();

    const map = {
      start: 'lastStartAt',
      hero: 'lastHeroHitAt',
      exit: 'lastExitAt',
      default: 'lastClickAt'
    };

    const prop = map[key] || map.default;

    if(t - state[prop] < ms) return false;

    state[prop] = t;
    return true;
  }

  function syncActionButtons(){
    const playing = state.started && !state.paused && !state.ended;
    const paused = state.started && state.paused && !state.ended;
    const ended = state.ended;

    toggleNode(el.pauseBtn, playing);
    toggleNode(el.backBtn, !ended);

    toggleNode(el.resumeBtn, paused);
    toggleNode(el.pauseResumeBtn, paused);

    toggleNode(el.summaryBackBtn, ended, 'inline-flex');

    if(el.pauseOverlay){
      el.pauseOverlay.classList.toggle('show', paused);
      el.pauseOverlay.style.display = paused ? 'grid' : 'none';
    }

    const big = $('gjHeroHitBigBtn');
    if(big) big.style.display = ended ? 'none' : '';

    const danger = $('gjDangerMeter');
    if(danger) danger.style.display = ended ? 'none' : '';
  }

  function refreshUiState(){
    const app = el.app || DOC.body;

    app.classList.toggle('is-playing', state.started && !state.paused && !state.ended);
    app.classList.toggle('is-paused', state.paused && !state.ended);
    app.classList.toggle('is-ended', state.ended);

    syncActionButtons();
  }

  function isMobileView(){
    return WIN.innerWidth <= 720 || String(CFG.view || '').toLowerCase() === 'mobile';
  }

  function syncSingleHandMode(){
    const app = el.app || DOC.body;
    const active = state.singleHand.enabled && (!state.singleHand.mobileOnly || isMobileView());

    app.classList.toggle('gjSingleHandMode', active);
    app.classList.toggle('gjSingleHandRight', active && state.singleHand.side === 'right');
    app.classList.toggle('gjSingleHandLeft', active && state.singleHand.side === 'left');

    state.singleHand.lastModeSyncAt = Date.now();
  }

  function ensureMobileHud(){
    const app = el.app || DOC.body;

    if(!$('gjMobileHud')){
      const hud = DOC.createElement('div');
      hud.id = 'gjMobileHud';
      hud.innerHTML = `
        <div class="gjMobileTopRow">
          <div class="gjMobilePill">⏱️ <b id="gjMobileTime">0</b></div>
          <div class="gjMobilePill">⭐ <b id="gjMobileScore">0</b></div>
          <div class="gjMobilePill">❤️ <b id="gjMobileLives">0</b></div>
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

    if(!$('gjHeroHitBigBtn')){
      const btn = DOC.createElement('button');
      btn.id = 'gjHeroHitBigBtn';
      btn.type = 'button';
      btn.innerHTML = `
        <span class="gjHeroHitIcon">🦸</span>
        <span class="gjHeroHitText">HERO HIT</span>
        <span class="gjHeroHitPct" id="gjHeroHitBigPct">0%</span>
      `;

      btn.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        useHeroHit();
      }, { passive:false });

      app.appendChild(btn);
    }

    if(!$('gjDangerMeter')){
      const d = DOC.createElement('div');
      d.id = 'gjDangerMeter';
      d.innerHTML = `
        <div class="gjDangerLabel">DANGER</div>
        <div class="gjDangerTrack">
          <div id="gjDangerFill" class="gjDangerFill"></div>
        </div>
      `;
      app.appendChild(d);
    }

    cacheElements();
  }

  function ensureFeedbackControls(){
    const app = el.app || DOC.body;

    if($('gjFeedbackControls')) return;

    const wrap = DOC.createElement('div');
    wrap.id = 'gjFeedbackControls';
    wrap.innerHTML = `
      <button id="gjSfxToggle" type="button" aria-label="toggle sound">🔊</button>
      <button id="gjVibeToggle" type="button" aria-label="toggle vibration">📳</button>
      <button id="gjHandToggle" type="button" aria-label="switch hand">🤚</button>
      <button id="gjSafeDebugToggle" type="button" aria-label="safe area">□</button>
    `;

    app.appendChild(wrap);

    $('gjSfxToggle')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();

      state.sfxEnabled = !state.sfxEnabled;
      ev.currentTarget.textContent = state.sfxEnabled ? '🔊' : '🔇';
    });

    $('gjVibeToggle')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();

      state.vibrateEnabled = !state.vibrateEnabled;
      ev.currentTarget.textContent = state.vibrateEnabled ? '📳' : '🚫';
    });

    $('gjHandToggle')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();

      state.singleHand.side = state.singleHand.side === 'right' ? 'left' : 'right';
      ev.currentTarget.textContent = state.singleHand.side === 'right' ? '🤚' : '✋';

      syncSingleHandMode();
      updateHud();

      toast(state.singleHand.side === 'right' ? 'โหมดมือขวา' : 'โหมดมือซ้าย', 900);
    });

    $('gjSafeDebugToggle')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();

      state.calibration.debugOverlay = !state.calibration.debugOverlay;
      ev.currentTarget.textContent = state.calibration.debugOverlay ? '▣' : '□';

      getSafeArenaRect(60);
      ensureSafeAreaOverlay();

      toast(state.calibration.debugOverlay ? 'แสดงพื้นที่ spawn' : 'ซ่อนพื้นที่ spawn', 900);
    });
  }

  function ensureTapPriority(){
    const world = el.gameWorld || $('gameWorld') || el.app || DOC.body;
    const targetLayer = el.targetLayer || $('targetLayer');
    const fxLayer = el.fxLayer || $('fxLayer');

    if(world){
      world.style.position = world.style.position || 'absolute';
      world.style.touchAction = 'manipulation';
    }

    if(targetLayer){
      targetLayer.style.position = 'absolute';
      targetLayer.style.inset = '0';
      targetLayer.style.zIndex = '100';
      targetLayer.style.pointerEvents = 'none';
    }

    if(fxLayer){
      fxLayer.style.position = 'absolute';
      fxLayer.style.inset = '0';
      fxLayer.style.zIndex = '140';
      fxLayer.style.pointerEvents = 'none';
    }

    [
      $('gjMobileHud'),
      $('gjDangerMeter'),
      $('coachText'),
      DOC.querySelector('.gjCompatCoach'),
      $('announcer'),
      $('bossHpText'),
      $('bossHpFill')?.parentElement
    ].forEach(n => {
      if(n) n.style.pointerEvents = 'none';
    });

    [
      $('gjHeroHitBigBtn'),
      $('heroHitBtn'),
      $('pauseBtn'),
      $('backBtn'),
      $('resumeBtn'),
      $('pauseResumeBtn'),
      $('pauseBackBtn'),
      $('summaryReplayBtn'),
      $('summaryBackBtn')
    ].forEach(n => {
      if(n) n.style.pointerEvents = 'auto';
    });
  }

  function raiseTargetNode(node){
    if(!node) return;

    node.style.position = 'absolute';
    node.style.zIndex = '105';
    node.style.pointerEvents = 'auto';
    node.style.touchAction = 'manipulation';
    node.style.userSelect = 'none';
    node.style.webkitUserSelect = 'none';
    node.style.webkitTapHighlightColor = 'transparent';

    state.tapSafety.forcedRaisedTargets++;
  }

  function toast(message, ms = 1200){
    const msg = String(message || '');

    if(el.toast){
      el.toast.textContent = msg;
      el.toast.style.display = 'block';

      clearTimeout(toast._t);
      toast._t = setTimeout(() => {
        if(el.toast) el.toast.style.display = 'none';
      }, ms);

      return;
    }

    const t = DOC.createElement('div');
    t.className = 'gjRuntimeToast';
    t.textContent = msg;
    t.style.display = 'block';

    (el.app || DOC.body).appendChild(t);

    setTimeout(() => {
      try{ t.remove(); }catch(_){}
    }, ms);
  }

  function safeFinalRushToast(msg, ms = 1200){
    const t = Date.now();

    if(state.finalRush && t - state.finalRushToastAt < 2200) return;

    state.finalRushToastAt = t;
    toast(msg, ms);
  }

  let __audioCtx = null;

  function beep(kind = 'good'){
    if(!state.sfxEnabled) return;

    const t = Date.now();
    if(t - state.lastSfxAt < 60) return;
    state.lastSfxAt = t;

    try{
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if(!AC) return;

      __audioCtx = __audioCtx || new AC();
      const ctx = __audioCtx;

      if(ctx.state === 'suspended'){
        ctx.resume().catch(() => {});
      }

      const o = ctx.createOscillator();
      const g = ctx.createGain();

      const cfg =
        kind === 'bad'
          ? [180, 95, .13, .055, 'sawtooth']
          : kind === 'hero'
            ? [520, 880, .18, .06, 'triangle']
            : kind === 'boss'
              ? [110, 70, .18, .06, 'square']
              : kind === 'win'
                ? [620, 1040, .22, .07, 'triangle']
                : [420, 620, .11, .045, 'sine'];

      o.type = cfg[4];
      o.frequency.setValueAtTime(cfg[0], ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(cfg[1], ctx.currentTime + cfg[2]);

      g.gain.setValueAtTime(.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(cfg[3], ctx.currentTime + .018);
      g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + cfg[2]);

      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + cfg[2] + .02);
    }catch(_){}
  }

  function vibe(p = 20){
    if(state.vibrateEnabled && navigator.vibrate){
      try{ navigator.vibrate(p); }catch(_){}
    }
  }

  function feedback(kind = 'good'){
    beep(kind);

    if(kind === 'bad'){
      vibe([30, 35, 30]);
    }else if(kind === 'hero'){
      vibe([25, 30, 25, 30, 55]);
    }else if(kind === 'win'){
      vibe([25, 25, 45, 25, 80]);
    }else{
      vibe(12);
    }
  }

  function fx(x, y, text, type = 'good'){
    const layer = el.fxLayer || el.app || DOC.body;

    const n = DOC.createElement('div');
    n.className = 'gjFx';
    n.textContent = text;
    n.style.left = `${x}px`;
    n.style.top = `${y}px`;

    n.style.color =
      type === 'bad'
        ? '#fca5a5'
        : type === 'gold'
          ? '#fde68a'
          : '#86efac';

    layer.appendChild(n);

    setTimeout(() => {
      try{ n.remove(); }catch(_){}
    }, 760);
  }

  /* ---------- flow ---------- */

  function buildCooldownFallback(){
    try{
      const u = new URL('../warmup-gate.html', location.href);

      [
        'pid',
        'name',
        'nick',
        'diff',
        'time',
        'view',
        'run',
        'zone',
        'cat',
        'seed',
        'studyId',
        'section',
        'session_code',
        'api',
        'log'
      ].forEach(k => {
        const v = CFG[k] || qs.get(k);
        if(String(v || '').trim()){
          u.searchParams.set(k, String(v).trim());
        }
      });

      u.searchParams.set('phase', 'cooldown');
      u.searchParams.set('game', 'goodjunk');
      u.searchParams.set('gameId', 'goodjunk');
      u.searchParams.set('mode', 'solo-boss');
      u.searchParams.set('entry', 'solo-boss');
      u.searchParams.set('phaseBoss', '1');

      const zone = new URL('../nutrition-zone.html', location.href).toString();

      u.searchParams.set('hub', zone);
      u.searchParams.set('next', zone);

      return u.toString();
    }catch(_){
      return DEFAULT_HUB;
    }
  }

  function resolveExitHref(){
    const raw = String(CFG.hub || '').trim();

    try{
      if(raw){
        const u = new URL(raw, location.href);

        if(u.pathname.includes('/warmup-gate.html') && u.searchParams.get('phase') === 'cooldown'){
          return u.toString();
        }

        if(u.pathname.includes('/nutrition-zone.html')){
          return u.toString();
        }

        if(u.pathname.includes('/hub.html') || u.pathname.includes('/hub-v2.html')){
          return new URL('../nutrition-zone.html', location.href).toString();
        }

        return u.toString();
      }
    }catch(_){}

    if(state.flow.fromWarmupGate || CFG.entry === 'solo-boss'){
      return buildCooldownFallback();
    }

    return DEFAULT_HUB;
  }

  function isCooldownHub(){
    const h = resolveExitHref();
    return h.includes('warmup-gate.html') && h.includes('phase=cooldown');
  }

  function readFlowSafety(){
    const href = location.href;
    const hub = String(CFG.hub || '');

    state.flow.fromWarmupGate =
      document.referrer.includes('warmup-gate.html') ||
      href.includes('fromWarmup=1') ||
      href.includes('entry=solo-boss');

    state.flow.toCooldownGate =
      hub.includes('warmup-gate.html') &&
      hub.includes('phase=cooldown');

    state.flow.rawHub = hub;
    state.flow.safeHub = resolveExitHref();
  }

  function updateExitButtonLabels(){
    const label = isCooldownHub() ? 'ไป Cooldown' : 'กลับ Nutrition';

    [
      el.summaryBackBtn,
      el.backBtn,
      el.bootBackBtn,
      el.introBackBtn,
      el.pauseBackBtn
    ].forEach(b => {
      if(b) b.textContent = label;
    });
  }

  function goHub(){
    if(!clickGuard('exit', 650)) return;

    try{
      if(state.started && !state.ended && !state.safeExitReady){
        if(!WIN.confirm('กำลังเล่นอยู่ ต้องการออกจากเกมหรือไม่?')) return;
      }

      state.exitLocked = true;
      WIN.location.href = resolveExitHref();
    }catch(_){
      WIN.location.href = DEFAULT_HUB;
    }
  }

  function replayGame(){
    if(!clickGuard('start', 850)) return;

    try{
      const u = new URL(location.href);
      u.searchParams.set('seed', String(Date.now()));
      u.searchParams.set('run', 'play');
      u.searchParams.set('autostart', '1');

      WIN.location.href = u.toString();
    }catch(_){
      WIN.location.reload();
    }
  }

  /* ---------- layout / safe area ---------- */

  function visibleRect(node){
    if(!node) return null;

    try{
      const st = getComputedStyle(node);

      if(st.display === 'none' || st.visibility === 'hidden' || node.hidden) return null;

      const r = node.getBoundingClientRect();

      if(r.width <= 0 || r.height <= 0) return null;

      return r;
    }catch(_){
      return null;
    }
  }

  function worldRect(){
    const node = el.gameWorld || el.app || DOC.body;
    const r = node.getBoundingClientRect();

    return {
      width: Math.max(320, r.width || WIN.innerWidth),
      height: Math.max(420, r.height || WIN.innerHeight)
    };
  }

  function ensureSafeAreaOverlay(){
    let o = $('gjSafeAreaOverlay');

    if(!state.calibration.debugOverlay){
      if(o) o.remove();
      return;
    }

    const parent = el.gameWorld || el.app || DOC.body;

    if(!o){
      o = DOC.createElement('div');
      o.id = 'gjSafeAreaOverlay';
      o.style.cssText = [
        'position:absolute',
        'z-index:130',
        'pointer-events:none',
        'border:2px dashed rgba(34,197,94,.88)',
        'background:rgba(34,197,94,.08)',
        'box-shadow:0 0 0 9999px rgba(2,6,23,.28)',
        'border-radius:18px'
      ].join(';');

      parent.appendChild(o);
    }

    const r = state.calibration.lastSafeRect;
    if(!r) return;

    o.style.left = `${r.left}px`;
    o.style.top = `${r.top}px`;
    o.style.width = `${Math.max(1, r.right - r.left)}px`;
    o.style.height = `${Math.max(1, r.bottom - r.top)}px`;
  }

  function getSafeArenaRect(size = 60){
    const wr = (el.gameWorld || el.app || DOC.body).getBoundingClientRect();

    const vw = Math.max(320, wr.width || WIN.innerWidth);
    const vh = Math.max(420, wr.height || WIN.innerHeight);

    const single = state.singleHand.enabled && isMobileView();

    let safeTop = WIN.innerWidth <= 720
      ? (single ? state.singleHand.safePadTop : 178)
      : 132;

    let safeBottom = vh - (
      WIN.innerWidth <= 720
        ? (single ? state.singleHand.safePadBottom : 112)
        : 96
    );

    [
      visibleRect($('gjMobileHud')),
      visibleRect(el.bossWrap),
      visibleRect(el.bossAvatar)
    ].filter(Boolean).forEach(r => {
      safeTop = Math.max(safeTop, r.bottom - wr.top + 12);
    });

    [
      visibleRect($('gjHeroHitBigBtn')),
      visibleRect($('gjDangerMeter')),
      visibleRect($('coachText')),
      visibleRect(DOC.querySelector('.gjCompatCoach'))
    ].filter(Boolean).forEach(r => {
      safeBottom = Math.min(safeBottom, r.top - wr.top - 12);
    });

    if(safeBottom - safeTop < state.calibration.minArenaHeight){
      safeTop = WIN.innerWidth <= 720 ? 184 : 150;
      safeBottom = vh - (WIN.innerWidth <= 720 ? 106 : 110);
    }

    const sidePad = single ? state.singleHand.safePadSide : 18;

    let rect = {
      left: sidePad + size / 2 + state.calibration.safeSideAdjust,
      right: vw - sidePad - size / 2 - state.calibration.safeSideAdjust,
      top: safeTop + size / 2 + state.calibration.safeTopAdjust,
      bottom: safeBottom - size / 2 - state.calibration.safeBottomAdjust
    };

    if(rect.bottom - rect.top < state.calibration.minArenaHeight){
      const mid = (rect.top + rect.bottom) / 2;
      rect.top = clamp(mid - state.calibration.minArenaHeight / 2, 120, vh - 160);
      rect.bottom = clamp(rect.top + state.calibration.minArenaHeight, rect.top + 120, vh - 80);
    }

    rect.left = clamp(rect.left, size / 2 + 8, vw - size / 2 - 8);
    rect.right = clamp(rect.right, rect.left + 80, vw - size / 2 - 8);
    rect.top = clamp(rect.top, size / 2 + 90, vh - size / 2 - 90);
    rect.bottom = clamp(rect.bottom, rect.top + 120, vh - size / 2 - 56);

    state.calibration.lastSafeRect = { ...rect };
    ensureSafeAreaOverlay();

    return rect;
  }

  function isSafeSpawnPoint(x, y, size){
    const a = getSafeArenaRect(size);

    if(x < a.left || x > a.right) return false;
    if(y < a.top || y > a.bottom) return false;

    for(const item of state.targets.values()){
      const dx = item.x - x;
      const dy = item.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if(dist < (item.size + size) * .72) return false;
    }

    return true;
  }

  function pickSafeSpawn(size){
    const a = getSafeArenaRect(size);

    for(let i = 0; i < 36; i++){
      const x = clamp(
        a.left + state.rng() * Math.max(1, a.right - a.left),
        a.left,
        a.right
      );

      const y = clamp(
        a.top + state.rng() * Math.max(1, a.bottom - a.top),
        a.top,
        a.bottom
      );

      if(isSafeSpawnPoint(x, y, size)){
        return { x, y };
      }
    }

    return {
      x: clamp((a.left + a.right) / 2 + (state.rng() - .5) * 120, a.left, a.right),
      y: clamp((a.top + a.bottom) / 2 + (state.rng() - .5) * 120, a.top, a.bottom)
    };
  }

  function isPointCoveredByUi(x, y, node){
    const top = DOC.elementFromPoint(x, y);

    if(!top) return false;
    if(top === node) return false;
    if(node && node.contains(top)) return false;

    const tl = el.targetLayer || $('targetLayer');

    if(tl && tl.contains(top)) return false;

    const id = String(top.id || '');
    const cls = String(top.className || '');

    if(
      id === 'gjHeroHitBigBtn' ||
      id === 'heroHitBtn' ||
      id === 'pauseBtn' ||
      id === 'backBtn' ||
      id === 'summaryBackBtn'
    ){
      return true;
    }

    if(
      id === 'coachText' ||
      id === 'gjMobileHud' ||
      id === 'gjDangerMeter' ||
      cls.includes('gjCompatCoach') ||
      cls.includes('gjMobilePill') ||
      cls.includes('gjBossBarWrap')
    ){
      return true;
    }

    return false;
  }

  function nudgeTargetOutOfBlockedZone(item){
    if(!item || !item.node) return;

    const r = item.node.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    if(!isPointCoveredByUi(cx, cy, item.node)) return;

    state.tapSafety.blockedTapCount++;

    const a = getSafeArenaRect(item.size);

    item.x = clamp((a.left + a.right) / 2 + (state.rng() - .5) * 120, a.left, a.right);
    item.y = clamp((a.top + a.bottom) / 2 + (state.rng() - .5) * 120, a.top, a.bottom);

    item.node.style.left = `${item.x}px`;
    item.node.style.top = `${item.y}px`;
  }
    /* ---------- game logic ---------- */

  function todayIndex(){
    return Math.floor(Date.now() / 86400000);
  }

  function setupDailyChallenge(){
    state.dailyChallenge = DAILY[todayIndex() % DAILY.length];
  }

  function currentWeakness(){
    if(state.finalRush || state.phase >= 3){
      return BOSS.weakness.phase3;
    }

    if(state.phase >= 2){
      return BOSS.weakness.phase2;
    }

    return BOSS.weakness.phase1;
  }

  function pickGoodByWeakness(){
    const w = currentWeakness();
    const list = GOOD.filter(g => w.icons.includes(g.emoji));
    return list.length ? pick(list) : pick(GOOD);
  }

  function pickJunkByGroup(g){
    const list = JUNK.filter(j => j.group === g);
    return list.length ? pick(list) : pick(JUNK);
  }

  function hasSlowTime(){
    return Date.now() < state.activePower.slowUntil;
  }

  function hasMagnet(){
    return Date.now() < state.activePower.magnetUntil;
  }

  function calcAccuracy(){
    const total = state.good + state.junkHit + state.missedGood;
    return total ? Math.round((state.good / total) * 100) : 100;
  }

  function calcStars(){
    const acc = calcAccuracy();

    if(state.bossHp <= 0 && acc >= 85 && state.miss <= 3 && state.bestCombo >= 15){
      return '⭐⭐⭐';
    }

    if(state.bossHp <= 0 && acc >= 70){
      return '⭐⭐';
    }

    if(state.bossHp <= 0 || state.score >= 180){
      return '⭐';
    }

    return '☆';
  }

  function bossBookTip(){
    const w = currentWeakness();
    const skill = BOSS.skills.find(s => s.id === state.lastBossSkillId);

    if(skill){
      return `${skill.emoji} ${skill.name} • จุดอ่อน: ${w.label}`;
    }

    return `🎯 จุดอ่อน: ${w.label}`;
  }

  function fullCoachText(){
    const w = currentWeakness();

    if(state.finalRush){
      return `🔥 FINAL • เก็บ ${w.label} • ใช้ HERO HIT`;
    }

    return bossBookTip();
  }

  function updateCoachText(){
    setText(el.coachText, fullCoachText());
    setText(el.goalText, fullCoachText());
  }

  /* ---------- balance director ---------- */

  function balancePushKind(k){
    state.balance.recentKinds.push(k);

    if(state.balance.recentKinds.length > 10){
      state.balance.recentKinds.shift();
    }
  }

  function recentJunkRun(){
    let n = 0;

    for(let i = state.balance.recentKinds.length - 1; i >= 0; i--){
      if(state.balance.recentKinds[i] === 'junk'){
        n++;
      }else{
        break;
      }
    }

    return n;
  }

  function isCalmWindow(){
    return Date.now() < state.balance.calmUntil;
  }

  function directorJunkChance(base){
    let c = base;

    if(state.balance.streakGood >= 8){
      c += .04;
    }

    if(state.balance.streakMiss >= 2){
      c -= .12;
    }

    if(state.balance.streakMiss >= 3 || state.lives <= 1 || isCalmWindow()){
      c -= .12;
    }

    if(recentJunkRun() >= state.balance.junkLimit){
      c = .05;
    }

    return clamp(c, .16, .62);
  }

  function directorScale(){
    let s = 1;

    if(state.balance.streakGood >= 10){
      s += .10;
    }

    if(state.balance.streakMiss >= 2 || state.lives <= 1 || isCalmWindow()){
      s -= .18;
    }

    if(state.finalRush){
      s += .10;
    }

    return clamp(s, .68, 1.28);
  }

  function directorAfterGood(){
    state.balance.streakGood++;
    state.balance.streakMiss = 0;
    state.balance.stress = clamp(state.balance.stress - 8, 0, 100);
  }

  function directorAfterMistake(){
    state.balance.streakMiss++;
    state.balance.streakGood = 0;
    state.balance.stress = clamp(state.balance.stress + 16, 0, 100);
    state.balance.mercy = clamp(state.balance.mercy + 18, 0, 100);

    if(state.balance.streakMiss >= 2){
      state.balance.forcedGoodNext = Math.max(state.balance.forcedGoodNext, 1);
    }

    if(state.balance.streakMiss >= 3){
      state.balance.forcedWeaknessNext = Math.max(state.balance.forcedWeaknessNext, 1);
      state.balance.calmUntil = Date.now() + 5200;
    }
  }

  function directorMaybeAssist(){
    const t = Date.now();

    if(t - state.balance.lastAssistAt < 10000) return;

    if(state.lives <= 1 || state.balance.streakMiss >= 3){
      state.balance.lastAssistAt = t;
      state.balance.calmUntil = t + 5200;
      state.balance.forcedWeaknessNext = 2;

      if(state.activePower.shield <= 0){
        spawnPowerUp('shield');
      }

      toast('💚 เกมให้จังหวะสวนกลับแล้ว!', 1200);
    }
  }

  /* ---------- spawn ---------- */

  function spawnTarget(forceKind = ''){
    if(state.ended || state.paused || !state.started) return;

    if(forceKind === 'good'){
      balancePushKind('good');
      return spawnTargetWithData('good', pick(GOOD));
    }

    if(forceKind === 'junk'){
      if(recentJunkRun() >= state.balance.junkLimit){
        balancePushKind('good');
        return spawnTargetWithData('good', pickGoodByWeakness());
      }

      balancePushKind('junk');
      return spawnTargetWithData('junk', pick(JUNK));
    }

    if(state.balance.forcedWeaknessNext > 0){
      state.balance.forcedWeaknessNext--;
      balancePushKind('good');
      return spawnTargetWithData('good', pickGoodByWeakness());
    }

    if(state.balance.forcedGoodNext > 0){
      state.balance.forcedGoodNext--;
      balancePushKind('good');
      return spawnTargetWithData('good', pick(GOOD));
    }

    let jc =
      tune.junkChance +
      (state.phase === 2 ? .08 : 0) +
      (state.phase >= 3 ? .12 : 0) +
      (state.finalRush ? .14 : 0);

    jc = directorJunkChance(jc);

    const kind = state.rng() < jc ? 'junk' : 'good';

    balancePushKind(kind);

    if(kind === 'good'){
      return spawnTargetWithData(
        'good',
        state.phase >= 2 && state.rng() < .34 ? pickGoodByWeakness() : pick(GOOD)
      );
    }

    return spawnTargetWithData('junk', pick(JUNK));
  }

  function spawnTargetWithData(kind = 'good', data = null){
    if(state.ended || state.paused || !state.started) return;

    const extra =
      state.finalRush ? 2 :
      state.phase >= 3 ? 1 :
      0;

    if(state.targets.size >= tune.maxTargets + extra) return;

    kind = kind === 'junk' ? 'junk' : 'good';
    data = data || (kind === 'good' ? pick(GOOD) : pick(JUNK));

    const mobile = isMobileView();
    const single = state.singleHand.enabled && isMobileView();

    const size = kind === 'good'
      ? (
          single
            ? 46 + Math.floor(state.rng() * 12)
            : mobile
              ? 50 + Math.floor(state.rng() * 14)
              : 58 + Math.floor(state.rng() * 20)
        )
      : (
          single
            ? 45 + Math.floor(state.rng() * 11)
            : mobile
              ? 48 + Math.floor(state.rng() * 13)
              : 56 + Math.floor(state.rng() * 18)
        );

    const p = pickSafeSpawn(size);
    const id = `gj_${Date.now()}_${++state.seq}`;

    const node = DOC.createElement('button');
    node.type = 'button';
    node.className = `gjTarget foodTarget target gj-food ${kind}`;
    node.textContent = data.emoji;
    node.setAttribute('aria-label', data.label);
    node.style.left = `${p.x}px`;
    node.style.top = `${p.y}px`;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.fontSize = `${Math.round(size * .56)}px`;

    raiseTargetNode(node);

    let speedMul =
      (
        state.finalRush ? 1.25 :
        state.phase >= 3 ? 1.15 :
        state.phase >= 2 ? 1.08 :
        1
      ) * directorScale();

    if(hasSlowTime()){
      speedMul *= .55;
    }

    if(isCalmWindow()){
      speedMul *= .82;
    }

    const speed = (
      tune.speedMin +
      state.rng() * (tune.speedMax - tune.speedMin)
    ) * speedMul;

    const item = {
      id,
      node,
      kind,
      data,
      x: p.x,
      y: p.y,
      vx: (state.rng() < .5 ? -1 : 1) * speed,
      vy: (state.rng() < .5 ? -1 : 1) * speed * .62,
      size,
      born: now(),
      ttl: kind === 'good'
        ? (
            state.finalRush ? 2200 :
            state.phase >= 3 ? 2600 :
            3400
          )
        : (
            state.finalRush ? 2500 :
            state.phase >= 3 ? 2900 :
            3600
          )
    };

    node.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      hitTarget(id);
    }, { passive:false });

    (el.targetLayer || el.gameWorld || el.app || DOC.body).appendChild(node);
    state.targets.set(id, item);

    setTimeout(() => {
      raiseTargetNode(node);
      nudgeTargetOutOfBlockedZone(item);
    }, 40);
  }

  function spawnPowerUp(force = ''){
    if(state.ended || state.paused || !state.started) return;

    const data = force
      ? POWER_UPS.find(p => p.id === force) || pick(POWER_UPS)
      : pick(POWER_UPS);

    const size = state.singleHand.enabled && isMobileView()
      ? 48
      : isMobileView()
        ? 52
        : 70;

    const p = pickSafeSpawn(size);
    const id = `power_${Date.now()}_${++state.seq}`;

    const node = DOC.createElement('button');
    node.type = 'button';
    node.className = 'gjTarget foodTarget target gj-food power gjPowerTarget';
    node.textContent = data.emoji;
    node.setAttribute('aria-label', data.label);
    node.style.left = `${p.x}px`;
    node.style.top = `${p.y}px`;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.fontSize = `${Math.round(size * .56)}px`;

    raiseTargetNode(node);

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

    node.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      collectPowerUp(id);
    }, { passive:false });

    (el.targetLayer || el.gameWorld || el.app || DOC.body).appendChild(node);
    state.targets.set(id, item);

    setTimeout(() => {
      nudgeTargetOutOfBlockedZone(item);
    }, 40);
  }

  function maybeSpawnPowerUp(){
    const chance =
      state.lives <= 1 ? .11 :
      state.finalRush ? .05 :
      state.phase >= 2 ? .04 :
      .025;

    if(state.rng() < chance){
      spawnPowerUp(state.lives <= 1 ? 'shield' : '');
    }
  }

  function collectPowerUp(id){
    const item = state.targets.get(id);
    if(!item) return;

    const p = item.data;

    removeTarget(id);

    state.powerUpsCollected[p.id] = (state.powerUpsCollected[p.id] || 0) + 1;

    if(p.id === 'shield'){
      state.activePower.shield++;
      toast('🛡️ Shield กันพลาด 1 ครั้ง');
    }

    if(p.id === 'slow'){
      state.activePower.slowUntil = Date.now() + p.durationSec * 1000;
      toast('⏳ Slow Time!');
    }

    if(p.id === 'magnet'){
      state.activePower.magnetUntil = Date.now() + p.durationSec * 1000;
      toast('🧲 Good Magnet!');
    }

    if(p.id === 'cleanBlast'){
      clearJunkTargets();
      state.score += 18;
      toast('✨ Clean Blast!');
    }

    fx(item.x, item.y, p.label, 'gold');
    feedback('power');
    updateHud();
  }

  function removeTarget(id){
    const item = state.targets.get(id);
    if(!item) return;

    state.targets.delete(id);

    try{
      item.node.remove();
    }catch(_){}
  }

  function clearTargets(){
    Array.from(state.targets.keys()).forEach(removeTarget);
  }

  function clearJunkTargets(){
    for(const [id, item] of Array.from(state.targets.entries())){
      if(item.kind === 'junk'){
        removeTarget(id);
      }
    }
  }

  /* ---------- hit / miss ---------- */

  function updateGroups(data){
    if(['🥦','🥬','🥕'].includes(data.emoji)){
      state.greenHits++;
    }

    if(['🐟','🥚','🫘','🥛'].includes(data.emoji)){
      state.proteinHits++;
    }

    if(['🍎','🍉'].includes(data.emoji)){
      state.fruitHits++;
    }
  }

  function updateDailyGood(data){
    const d = state.dailyChallenge;

    if(!d || state.dailyFailed) return;

    if(d.rule === 'collect_group' && data.group === d.value){
      state.dailyProgress++;

      if(state.dailyProgress === d.target){
        state.score += 35;
        toast(`🏅 Daily สำเร็จ! ${d.reward}`);
      }
    }

    if(d.rule === 'combo' && state.combo >= d.target && state.dailyProgress < d.target){
      state.dailyProgress = d.target;
      state.score += 35;
      toast(`🏅 Daily สำเร็จ! ${d.reward}`);
    }
  }

  function updateDailyJunk(data){
    const d = state.dailyChallenge;

    if(!d || state.dailyFailed) return;

    if(d.rule === 'avoid_emoji' && data.emoji === d.value){
      state.dailyFailed = true;
      toast('Daily พลาดแล้ว แต่ยังชนะบอสได้!');
    }
  }

  function hitTarget(id){
    if(state.ended || state.paused) return;

    const item = state.targets.get(id);
    if(!item) return;

    if(item.kind === 'power'){
      return collectPowerUp(id);
    }

    if(item.kind === 'good'){
      directorAfterGood();

      let damage = item.data.dmg + Math.floor(state.combo / 7);

      if(state.bossShield){
        damage = Math.max(2, Math.round(damage * .35));
      }

      state.score += 10 + Math.min(18, state.combo);
      state.good++;
      state.combo++;
      state.bestCombo = Math.max(state.bestCombo, state.combo);

      state.heroHit = clamp(
        state.heroHit + item.data.charge + Math.min(7, Math.floor(state.combo / 3)),
        0,
        100
      );

      state.bossHp = clamp(state.bossHp - damage, 0, state.bossMaxHp);

      updateGroups(item.data);
      updateDailyGood(item.data);

      fx(
        item.x,
        item.y,
        state.bossShield ? `โล่ -${damage}` : `-${damage}`,
        'good'
      );

      feedback('good');

      if(state.combo % 8 === 0){
        toast(`Combo x${state.combo}! ⚡`);
      }
    }else{
      directorAfterMistake();

      state.junkHit++;
      state.miss++;
      state.combo = 0;

      if(state.activePower.shield > 0){
        state.activePower.shield--;
        fx(item.x, item.y, 'BLOCK!', 'gold');
        toast('🛡️ Shield กันไว้ได้!');
      }else{
        state.lives = Math.max(0, state.lives - item.data.penalty);
      }

      state.score = Math.max(0, state.score - 8);
      state.dangerMeter = clamp(state.dangerMeter + 14, 0, 100);

      updateDailyJunk(item.data);

      fx(item.x, item.y, 'พลาด!', 'bad');
      feedback('bad');
      directorMaybeAssist();
    }

    removeTarget(id);

    checkPhase();
    updateHud();

    if(state.bossHp <= 0){
      tryWinOrForceRush();
    }

    if(state.lives <= 0){
      endGame(false);
    }
  }

  function missGoodTarget(item){
    state.missedGood++;
    state.miss++;
    state.combo = 0;
    state.lives = Math.max(0, state.lives - 1);
    state.dangerMeter = clamp(state.dangerMeter + 10, 0, 100);

    directorAfterMistake();
    directorMaybeAssist();

    fx(item.x, item.y, 'หลุด!', 'bad');
    feedback('bad');

    updateHud();

    if(state.lives <= 0){
      endGame(false);
    }
  }

  function updateTargets(dt){
    const t = now();

    for(const [id, item] of Array.from(state.targets.entries())){
      if(item.kind !== 'power'){
        item.x += item.vx * dt * 60;
        item.y += item.vy * dt * 60;

        const safe = getSafeArenaRect(item.size);

        item.x = clamp(item.x, safe.left, safe.right);
        item.y = clamp(item.y, safe.top, safe.bottom);

        if(item.x <= safe.left || item.x >= safe.right){
          item.vx *= -1;
        }

        if(item.y <= safe.top || item.y >= safe.bottom){
          item.vy *= -1;
        }

        item.node.style.left = `${item.x}px`;
        item.node.style.top = `${item.y}px`;

        if(state.tapSafety.enabled && Math.random() < .02){
          nudgeTargetOutOfBlockedZone(item);
        }
      }

      if(t - item.born > item.ttl){
        if(item.kind === 'good'){
          missGoodTarget(item);
        }

        removeTarget(id);
      }
    }
  }
    /* ---------- boss attack / phase ---------- */

  function spawnSpecific(token){
    if(token === 'good') return spawnTarget('good');
    if(token === 'junk') return spawnTarget('junk');
    if(token === 'soda') return spawnTargetWithData('junk', pickJunkByGroup('soda'));
    if(token === 'fried') return spawnTargetWithData('junk', pickJunkByGroup('fried'));
    if(token === 'sweet') return spawnTargetWithData('junk', pickJunkByGroup('sweet'));
    if(token === 'burger') return spawnTargetWithData('junk', pickJunkByGroup('fatty'));
    if(token === 'weakness') return spawnTargetWithData('good', pickGoodByWeakness());

    return spawnTarget();
  }

  function bossShieldRegen(){
    state.bossShieldRegenCount++;

    const regen = Math.round(state.bossMaxHp * .045);

    state.bossHp = clamp(state.bossHp + regen, 1, state.bossMaxHp);
    state.bossShield = true;

    setTimeout(() => {
      if(state.started && !state.ended){
        state.bossShield = false;
        updateHud();
      }
    }, 5200);

    toast(`🍔 บอสฟื้นโล่ +${regen}`);
    updateHud();
  }

  function bossAttack(){
    if(state.ended || state.paused || !state.started || state.bossSkillCooldownLock) return;

    state.bossSkillCooldownLock = true;

    setTimeout(() => {
      state.bossSkillCooldownLock = false;
    }, 900);

    let skill = pick(BOSS.skills);

    for(let i = 0; i < 4; i++){
      if(skill.id !== state.lastBossSkillId) break;
      skill = pick(BOSS.skills);
    }

    state.lastBossSkillId = skill.id;
    state.bossSkillUsed[skill.id] = (state.bossSkillUsed[skill.id] || 0) + 1;

    safeFinalRushToast(`${skill.emoji} ${skill.name}!`, 1200);
    feedback('boss');

    const base =
      state.finalRush ? 8 :
      state.phase === 3 ? 7 :
      state.phase === 2 ? 6 :
      5;

    let adjust = 0;

    if(state.balance.streakMiss >= 2){
      adjust--;
    }

    if(state.lives <= 1){
      adjust--;
    }

    if(state.balance.streakGood >= 10 && state.lives >= 3){
      adjust++;
    }

    const wave = clamp(
      base + adjust + (skill.id === 'sodaSplash' ? 1 : 0),
      3,
      9
    );

    if(skill.shieldRegen){
      setTimeout(() => {
        bossShieldRegen();
      }, Math.max(500, skill.telegraphMs - 250));
    }

    for(let i = 0; i < wave; i++){
      setTimeout(() => {
        if(state.ended || state.paused) return;

        let token = skill.pattern[i % skill.pattern.length];

        if(state.finalRush && i === Math.floor(wave / 2)){
          token = 'weakness';
        }

        spawnSpecific(token);
      }, skill.telegraphMs + i * (skill.waveDelay || 160));
    }

    setTimeout(() => {
      if(!state.ended && !state.paused){
        spawnTargetWithData('good', pickGoodByWeakness());
        toast('🎯 โอกาสสวนกลับ!');
      }
    }, skill.telegraphMs + wave * (skill.waveDelay || 160) + 420);

    state.dangerMeter = clamp(
      state.dangerMeter + (skill.dangerGain || 10),
      0,
      100
    );
  }

  function checkPhase(){
    const hp = state.bossHp / state.bossMaxHp;

    if(state.bossShield && state.elapsedSec >= tune.shieldUntilSec){
      state.bossShield = false;

      if(!state.phaseAnnounced.shieldBreak){
        state.phaseAnnounced.shieldBreak = true;
        toast('🛡️ โล่บอสแตกแล้ว!');
        setArenaTheme('storm');
      }
    }

    if(!state.finalRush && (hp <= tune.finalRushAt || state.timeLeft <= 28)){
      state.finalRush = true;
      state.phase = 3;

      if(!state.phaseAnnounced.finalRush){
        state.phaseAnnounced.finalRush = true;
        toast('🔥 FINAL RUSH!');
        setArenaTheme('final');
        bossAttack();
      }

      return;
    }

    if(hp <= .62 && state.phase < 2){
      state.phase = 2;

      if(!state.phaseAnnounced.phase2){
        state.phaseAnnounced.phase2 = true;
        toast('🌪️ Phase 2: Junk Storm');
        setArenaTheme('storm');
        bossAttack();
      }

      return;
    }

    if(hp <= .36 && state.phase < 3){
      state.phase = 3;

      if(!state.phaseAnnounced.phase3){
        state.phaseAnnounced.phase3 = true;
        toast('😡 Phase 3: Boss Rage');
        setArenaTheme('rage');
        bossAttack();
      }
    }
  }

  function setArenaTheme(theme){
    const n = el.gameWorld || DOC.body;

    n.classList.remove(
      'gjArenaShield',
      'gjArenaStorm',
      'gjArenaRage',
      'gjArenaFinal'
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
  }

  /* ---------- HERO HIT / finish ---------- */

  function useHeroHit(){
    if(!clickGuard('hero', 420) || state.heroHitLocked) return;

    state.heroHitLocked = true;

    setTimeout(() => {
      state.heroHitLocked = false;
    }, 520);

    if(state.ended || state.paused || !state.started) return;

    if(state.heroHit < 100){
      toast(`HERO HIT ยังไม่เต็ม ${Math.round(state.heroHit)}%`);
      return;
    }

    let dmg = state.finalRush
      ? tune.heroHitDmg
      : Math.round(tune.heroHitDmg * .68);

    if(state.bossShield){
      dmg = Math.round(dmg * .45);
    }

    state.heroHit = 0;
    state.bossHp = clamp(state.bossHp - dmg, 0, state.bossMaxHp);
    state.score += 35;

    clearTargets();

    fx(
      worldRect().width / 2,
      worldRect().height / 2,
      `HERO -${dmg}`,
      'gold'
    );

    feedback('hero');
    updateHud();

    if(state.bossHp <= 0){
      if(state.finalRush && state.elapsedSec >= tune.minWinSec){
        finishMove();
      }else{
        tryWinOrForceRush();
      }
    }
  }

  function tryWinOrForceRush(){
    if(state.finalRush && state.elapsedSec >= tune.minWinSec){
      return finishMove();
    }

    state.bossHp = Math.max(1, Math.round(state.bossMaxHp * .08));
    state.finalRush = true;
    state.phase = 3;

    setArenaTheme('final');
    toast('🔥 บอสยังไม่ยอมแพ้! Final Rush!');
    bossAttack();
    updateHud();
  }

  function finishMove(){
    if(state.finishMoveUsed || state.ended || state.summaryRendered) return;

    state.finishMoveUsed = true;

    clearTargets();
    feedback('hero');
    toast('HEALTHY FINISH!');

    setTimeout(() => {
      endGame(true);
    }, 1050);
  }

  /* ---------- loop ---------- */

  function gameLoop(ts){
    if(state.ended) return;

    if(!state.lastFrame){
      state.lastFrame = ts;
    }

    const dt = Math.min(.05, (ts - state.lastFrame) / 1000);
    state.lastFrame = ts;

    if(!state.paused && state.started){
      state.elapsedSec = Math.max(
        0,
        Math.round((Date.now() - state.startTs) / 1000)
      );

      state.timeLeft = Math.max(0, state.timeLeft - dt);

      checkPhase();
      directorMaybeAssist();

      const spEvery =
        state.finalRush ? tune.spawnEvery * .58 :
        state.phase >= 3 ? tune.spawnEvery * .72 :
        state.phase >= 2 ? tune.spawnEvery * .86 :
        tune.spawnEvery;

      if(ts - state.lastSpawn >= spEvery){
        state.lastSpawn = ts;
        spawnTarget();
        maybeSpawnPowerUp();
      }

      const atkEvery =
        state.finalRush ? tune.bossAttackEvery * .62 :
        state.phase >= 3 ? tune.bossAttackEvery * .78 :
        state.phase >= 2 ? tune.bossAttackEvery * .9 :
        tune.bossAttackEvery;

      if(ts - state.lastBossAttack >= atkEvery){
        state.lastBossAttack = ts;
        bossAttack();
      }

      updateTargets(dt);
      updateHud();

      if(state.timeLeft <= 0){
        endGame(state.bossHp <= 0 || state.score >= Math.round(state.bossMaxHp * .50));
        return;
      }
    }

    requestAnimationFrame(gameLoop);
  }

  /* ---------- HUD / summary ---------- */

  function updateHud(){
    state.elapsedSec = state.startTs
      ? Math.max(0, Math.round((Date.now() - state.startTs) / 1000))
      : 0;

    const bossPct = clamp((state.bossHp / state.bossMaxHp) * 100, 0, 100);

    const phaseLabel =
      state.finalRush ? 'FINAL' :
      state.phase === 3 ? 'RAGE' :
      state.phase === 2 ? 'STORM' :
      state.bossShield ? 'SHIELD' :
      'HUNT';

    setText(el.scoreText, state.score);
    setText(el.timerText, Math.ceil(state.timeLeft));
    setText(el.lifeText, '❤️'.repeat(Math.max(0, state.lives)) || '0');
    setText(el.phaseText, phaseLabel);
    setText(el.bossHpText, `${Math.ceil(bossPct)}%`);

    if(el.bossHpFill){
      el.bossHpFill.style.width = `${bossPct}%`;
    }

    setText(el.heroHitText, `${Math.round(state.heroHit)}%`);

    if(el.heroHitFill){
      el.heroHitFill.style.width = `${state.heroHit}%`;
    }

    setText(el.comboText, state.combo);
    setText(el.goodText, state.good);
    setText(el.missText, state.miss);
    setText(el.rageText, state.rage);

    setText($('gjMobileTime'), Math.ceil(state.timeLeft));
    setText($('gjMobileScore'), state.score);
    setText($('gjMobileLives'), Math.max(0, state.lives));
    setText($('gjMobilePhase'), phaseLabel);
    setText($('gjMobileBossPct'), `${Math.ceil(bossPct)}%`);

    const mb = $('gjMobileBossFill');
    if(mb){
      mb.style.width = `${bossPct}%`;
    }

    const df = $('gjDangerFill');
    if(df){
      df.style.width = `${clamp(state.dangerMeter, 0, 100)}%`;
    }

    const hb = $('gjHeroHitBigBtn');
    const hp = $('gjHeroHitBigPct');

    if(hp){
      hp.textContent = `${Math.round(state.heroHit)}%`;
    }

    if(hb){
      hb.classList.toggle('ready', state.heroHit >= 100);
      hb.classList.toggle('not-ready', state.heroHit < 100);
    }

    updateCoachText();
    syncSingleHandMode();
    refreshUiState();
  }

  function summaryText(s){
    const win = s.win;
    const badge = [];

    if(win){
      badge.push('👑 Boss Breaker');
    }

    if(s.bestCombo >= 15){
      badge.push('⚡ Combo Master');
    }

    if(s.miss <= 2){
      badge.push('🌟 Clean Player');
    }

    if(s.greenHits >= 8){
      badge.push('🥦 Green Hero');
    }

    const badges = badge.length
      ? badge.slice(0, 3).join(' • ')
      : 'ยังไม่ได้ Badge รอบนี้';

    const title = win
      ? '🎉 ชนะบอสแล้ว!'
      : '💪 เกือบชนะแล้ว!';

    const good = win
      ? 'แยกอาหารดีและรับมือบอสได้ดีขึ้น'
      : 'เริ่มเก็บอาหารดีได้แล้ว';

    const caution = s.junkHit >= s.missedGood
      ? 'ระวังอาหารขยะ เช่น น้ำอัดลม ของทอด และของหวาน'
      : 'อย่าปล่อยอาหารดีหลุด เพราะช่วยชาร์จ HERO HIT';

    const next = win
      ? 'ครั้งหน้าลองรักษา Combo ให้ยาวขึ้น'
      : 'ครั้งหน้าดูจุดอ่อนบอสก่อนแตะ';

    return `${title}

✅ ทำได้ดี:
${good}

⚠️ ระวัง:
${caution}

🏅 Badge:
${badges}

🎯 Daily:
${s.dailyChallengeTitle ? (s.dailyFailed ? 'พลาดแล้ว ลองใหม่พรุ่งนี้นะ' : 'พยายามต่อได้ดีมาก') : 'ไม่มี Daily Challenge'}

💡 บทเรียน:
ผัก ผลไม้ และโปรตีนดีช่วยให้ Hero แข็งแรง

➡️ ครั้งหน้า:
${next}`;
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

      greenHits: state.greenHits,
      proteinHits: state.proteinHits,
      fruitHits: state.fruitHits,

      dailyChallengeId: state.dailyChallenge?.id || '',
      dailyChallengeTitle: state.dailyChallenge?.title || '',
      dailyFailed: state.dailyFailed,
      dailyProgress: state.dailyProgress,

      bossSkillUsed: { ...state.bossSkillUsed },
      powerUpsCollected: { ...state.powerUpsCollected },

      durationSec: Math.max(0, Math.round((Date.now() - state.startTs) / 1000)),

      exitTargetType: isCooldownHub() ? 'cooldown-gate' : 'zone',
      safeExitTarget: resolveExitHref(),

      calibration: {
        lastSafeRect: state.calibration.lastSafeRect,
        lastBlockedElement: state.calibration.lastBlockedElement
      },

      tapSafety: {
        blockedTapCount: state.tapSafety.blockedTapCount,
        forcedRaisedTargets: state.tapSafety.forcedRaisedTargets
      },

      finalLock: {
        version: state.finalLock.version,
        domReady: state.finalLock.domReady,
        layoutReady: state.finalLock.layoutReady,
        tapReady: state.finalLock.tapReady,
        flowReady: state.finalLock.flowReady
      },

      patch: PATCH,
      endedAt: new Date().toISOString()
    };

    try{
      localStorage.setItem(
        `HHA_LAST_SUMMARY:goodjunk:${CFG.pid || 'anon'}`,
        JSON.stringify(payload)
      );

      localStorage.setItem(
        'HHA_LAST_SUMMARY',
        JSON.stringify({
          ts: Date.now(),
          payload,
          ...payload
        })
      );
    }catch(_){}

    return payload;
  }

  function endGame(win){
    if(state.ended || state.summaryRendered) return;

    state.ended = true;
    state.summaryRendered = true;
    state.paused = false;
    state.safeExitReady = true;
    state.endTs = Date.now();

    clearTargets();

    hide(el.gameScreen);
    hide(el.introScreen);
    show(el.summaryScreen);

    const s = saveSummary(win);

    setText(el.summaryTitle, win ? 'ชนะ Junk King แล้ว!' : 'หมดพลังแล้ว');
    setText(el.summaryScore, s.score);
    setText(el.summaryGood, s.good);
    setText(el.summaryMiss, s.miss);
    setText(el.summaryStars, s.stars);

    if(el.summaryTip){
      el.summaryTip.textContent = summaryText(s);
    }

    updateExitButtonLabels();
    refreshUiState();

    feedback(win ? 'win' : 'bad');
    toast(win ? 'Victory! 🎉' : 'ลองใหม่อีกครั้งนะ 💪');

    runFinalLockCheck('endGame');
  }
    /* ---------- start / pause / boot ---------- */

  function showIntro(){
    hide(el.boot);
    show(el.introScreen);
    hide(el.gameScreen);
    hide(el.summaryScreen);

    setupDailyChallenge();
    updateCoachText();
    refreshUiState();
  }

  function startGame(){
    if(!clickGuard('start', 900) || state.startLocked) return;

    state.startLocked = true;

    setTimeout(() => {
      state.startLocked = false;
    }, 1000);

    if(state.started && !state.ended) return;

    setupDailyChallenge();

    hide(el.boot);
    hide(el.introScreen);
    show(el.gameScreen);
    hide(el.summaryScreen);

    state.started = true;
    state.paused = false;
    state.ended = false;
    state.safeExitReady = false;
    state.summaryRendered = false;

    state.startTs = Date.now();
    state.lastFrame = 0;
    state.lastSpawn = 0;
    state.lastBossAttack = now() + 2400;

    setArenaTheme('shield');
    refreshUiState();
    updateHud();
    runFinalLockCheck('startGame');

    toast('Phase 1: ทำลายโล่ Junk King! 🛡️👑', 1600);

    requestAnimationFrame(gameLoop);
  }

  function pauseGame(){
    if(!state.started || state.ended) return;

    state.paused = true;
    refreshUiState();
    toast('พักเกม');
    runFinalLockCheck('pause');
  }

  function resumeGame(){
    if(!state.started || state.ended) return;

    state.paused = false;
    state.lastFrame = 0;
    refreshUiState();
    toast('เล่นต่อ!');
    runFinalLockCheck('resume');
  }

  function bindWorldTapDebug(){
    const world = el.gameWorld || $('gameWorld');

    if(!world || world.dataset.tapDebugReady === '1') return;

    world.dataset.tapDebugReady = '1';

    world.addEventListener('pointerdown', ev => {
      state.calibration.lastTapX = ev.clientX;
      state.calibration.lastTapY = ev.clientY;

      const isTarget = ev.target?.classList?.contains('gjTarget');

      if(isTarget){
        state.tapSafety.lastTargetTapAt = Date.now();
        return;
      }

      const top = DOC.elementFromPoint(ev.clientX, ev.clientY);

      state.calibration.lastBlockedElement = top
        ? `${top.tagName || ''}#${top.id || ''}.${String(top.className || '').slice(0, 80)}`
        : '';

      state.tapSafety.lastEmptyTapAt = Date.now();
    }, { passive:true });
  }

  function bindEvents(){
    on(el.bootStartBtn, 'click', startGame);
    on(el.bootBackBtn, 'click', goHub);

    on(el.introStartBtn, 'click', startGame);
    on(el.introBackBtn, 'click', goHub);

    on(el.pauseBtn, 'click', pauseGame);
    on(el.backBtn, 'click', goHub);
    on(el.resumeBtn, 'click', resumeGame);

    on(el.pauseResumeBtn, 'click', resumeGame);
    on(el.pauseBackBtn, 'click', goHub);

    on(el.summaryReplayBtn, 'click', replayGame);
    on(el.summaryBackBtn, 'click', goHub);

    on(el.heroHitBtn, 'click', useHeroHit);

    on(WIN, 'resize', () => {
      cacheElements();
      syncSingleHandMode();
      runFinalLockCheck('resize');
      updateHud();
    });

    on(DOC, 'visibilitychange', () => {
      if(DOC.hidden && state.started && !state.ended){
        pauseGame();
      }
    });

    on(WIN, 'hha:goodjunk:solo:start', startGame);
    on(DOC, 'hha:goodjunk:solo:start', startGame);

    on(WIN, 'keydown', ev => {
      if(ev.key === 'Escape'){
        pauseGame();
      }

      if(ev.key === ' '){
        ev.preventDefault();
        useHeroHit();
      }
    });
  }

  /* ---------- final lock ---------- */

  function requiredFinalElements(){
    return [
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
      'heroHitText',
      'summaryBackBtn'
    ];
  }

  function finalLockWarn(msg, data = null){
    state.finalLock.warnings.push({
      t: Date.now(),
      msg,
      data
    });

    if(state.finalLock.warnings.length > 20){
      state.finalLock.warnings.shift();
    }

    console.warn('[GoodJunk FinalLock]', msg, data || '');
  }

  function finalLockError(msg, err = null){
    state.finalLock.errors.push({
      t: Date.now(),
      msg,
      err: String(err?.stack || err?.message || err || '')
    });

    if(state.finalLock.errors.length > 20){
      state.finalLock.errors.shift();
    }

    console.error('[GoodJunk FinalLock]', msg, err || '');
  }

  function runFinalLockCheck(reason = 'manual'){
    try{
      state.finalLock.lastCheckAt = Date.now();

      if(requiredFinalElements().filter(id => !$(id)).length){
        ensureRequiredDom();
        cacheElements();
      }

      ensureFxStyle();
      ensureMobileHud();
      ensureFeedbackControls();
      ensureTapPriority();
      syncSingleHandMode();
      readFlowSafety();
      bindWorldTapDebug();

      state.finalLock.domReady =
        requiredFinalElements().filter(id => !$(id)).length === 0;

      const safe = getSafeArenaRect(60);

      state.finalLock.layoutReady =
        !!safe &&
        safe.bottom > safe.top &&
        safe.bottom - safe.top >= 120;

      state.finalLock.tapReady =
        !!$('targetLayer') &&
        getComputedStyle($('targetLayer')).pointerEvents === 'none';

      state.finalLock.flowReady = !!resolveExitHref();
      state.finalLock.calibrationReady = !!state.calibration.lastSafeRect;

      state.finalLock.singleHandReady =
        !isMobileView() ||
        (el.app || DOC.body).classList.contains('gjSingleHandMode');

      refreshUiState();

      const ok =
        state.finalLock.domReady &&
        state.finalLock.layoutReady &&
        state.finalLock.tapReady &&
        state.finalLock.flowReady &&
        state.finalLock.calibrationReady &&
        state.finalLock.singleHandReady;

      if(!ok){
        finalLockWarn('final lock not fully ready', {
          reason,
          finalLock: { ...state.finalLock }
        });
      }

      return ok;
    }catch(err){
      finalLockError('final lock failed', err);
      return false;
    }
  }

  function boot(root, cfg){
    if(state.bootStarted || state.booted) return;

    state.bootStarted = true;
    state.booted = true;

    try{
      if(cfg && typeof cfg === 'object'){
        Object.assign(CFG, cfg);
      }

      ensureFxStyle();
      ensureRequiredDom();
      cacheElements();
      readFlowSafety();
      syncSingleHandMode();
      bindEvents();
      runFinalLockCheck('boot');
      updateExitButtonLabels();
      updateHud();

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

      if(el.bootError){
        el.bootError.style.display = 'block';
        el.bootError.textContent = String(err?.stack || err);
      }
    }
  }

  /* ---------- debug API ---------- */

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

    setSingleHandMode(on = true, side = ''){
      state.singleHand.enabled = !!on;

      if(side === 'left' || side === 'right'){
        state.singleHand.side = side;
      }

      syncSingleHandMode();
      updateHud();

      return this.debugSingleHand();
    },

    setSafeAdjust(top = 0, bottom = 0, side = 0){
      state.calibration.safeTopAdjust = Number(top) || 0;
      state.calibration.safeBottomAdjust = Number(bottom) || 0;
      state.calibration.safeSideAdjust = Number(side) || 0;

      getSafeArenaRect(60);
      ensureSafeAreaOverlay();

      return this.debugCalibration();
    },

    toggleSafeOverlay(on){
      state.calibration.debugOverlay = typeof on === 'boolean'
        ? on
        : !state.calibration.debugOverlay;

      getSafeArenaRect(60);
      ensureSafeAreaOverlay();

      return this.debugCalibration();
    },

    debugFlow(){
      return {
        patch: PATCH,
        cfg: { ...CFG },
        flow: { ...state.flow },
        exitHref: resolveExitHref(),
        isCooldownHub: isCooldownHub(),
        started: state.started,
        ended: state.ended
      };
    },

    debugLayout(){
      return {
        patch: PATCH,
        safeArena: getSafeArenaRect(60),
        mobile: isMobileView(),
        viewport: {
          w: WIN.innerWidth,
          h: WIN.innerHeight
        },
        hero: visibleRect($('gjHeroHitBigBtn')),
        danger: visibleRect($('gjDangerMeter')),
        coach: visibleRect($('coachText')) || visibleRect(DOC.querySelector('.gjCompatCoach')),
        hud: visibleRect($('gjMobileHud')),
        boss: visibleRect(el.bossAvatar)
      };
    },

    debugTap(){
      const targets = Array.from(state.targets.values()).map(item => {
        const r = item.node.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const top = DOC.elementFromPoint(cx, cy);

        return {
          id: item.id,
          kind: item.kind,
          x: Math.round(item.x),
          y: Math.round(item.y),
          size: item.size,
          topElementId: top?.id || '',
          topElementClass: String(top?.className || '').slice(0, 80),
          covered: isPointCoveredByUi(cx, cy, item.node)
        };
      });

      return {
        patch: PATCH,
        targetCount: state.targets.size,
        blockedTapCount: state.tapSafety.blockedTapCount,
        targets
      };
    },

    debugCalibration(){
      return {
        patch: PATCH,
        calibration: { ...state.calibration },
        safeArena: getSafeArenaRect(60),
        viewport: {
          w: WIN.innerWidth,
          h: WIN.innerHeight
        },
        lastBlockedElement: state.calibration.lastBlockedElement
      };
    },

    debugSingleHand(){
      return {
        patch: PATCH,
        enabled: state.singleHand.enabled,
        side: state.singleHand.side,
        active: state.singleHand.enabled && isMobileView(),
        safeArena: getSafeArenaRect(60),
        viewport: {
          w: WIN.innerWidth,
          h: WIN.innerHeight
        }
      };
    },

    debugFinal(){
      runFinalLockCheck('debugFinal');

      return {
        patch: PATCH,
        finalLock: { ...state.finalLock },
        flow: { ...state.flow },
        safeArena: getSafeArenaRect(60),
        requiredMissingNow: requiredFinalElements().filter(id => !$(id)),
        targetCount: state.targets.size,
        targets: this.debugTap().targets
      };
    },

    debugHealth(){
      return this.debugFinal();
    },

    getState(){
      return {
        patch: PATCH,
        score: state.score,
        good: state.good,
        miss: state.miss,
        lives: state.lives,
        bossHp: state.bossHp,
        bossMaxHp: state.bossMaxHp,
        timeLeft: state.timeLeft,
        phase: state.phase,
        finalRush: state.finalRush,
        started: state.started,
        paused: state.paused,
        ended: state.ended
      };
    }
  };

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', () => boot());
  }else{
    boot();
  }
})();
