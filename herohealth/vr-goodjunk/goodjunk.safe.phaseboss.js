const __qs = new URLSearchParams(location.search);

const RUN_CTX = window.__GJ_RUN_CTX__ || {
  pid: __qs.get('pid') || 'anon',
  name: __qs.get('name') || '',
  studyId: __qs.get('studyId') || '',
  roomId: '',
  mode: (__qs.get('mode') || 'solo').toLowerCase(),
  diff: __qs.get('diff') || 'normal',
  time: __qs.get('time') || '150',
  seed: __qs.get('seed') || String(Date.now()),
  startAt: 0,
  hub: __qs.get('hub') || '../hub.html',
  view: __qs.get('view') || 'mobile',
  run: __qs.get('run') || 'play',
  gameId: __qs.get('gameId') || 'goodjunk'
};

const GJ_PID = RUN_CTX.pid || 'anon';
const GJ_NAME = String(RUN_CTX.name || GJ_PID).trim();
const GJ_HUB = RUN_CTX.hub || '../hub.html';
const GJ_GAME_ID = RUN_CTX.gameId || 'goodjunk';

const GAME_MOUNT = document.getElementById('gameMount') || document.body;
const STYLE_ID = 'goodjunk-phaseboss-style-v20260328-v2';
const ROOT_ID = 'gjpbRoot';

const GJ_SOLO_LAST_SUMMARY_KEY = `GJ_SOLO_LAST_SUMMARY_${GJ_PID}`;
const GJ_SOLO_SUMMARY_HISTORY_KEY = `GJ_SOLO_SUMMARY_HISTORY_${GJ_PID}`;
const GJ_SOLO_BOSS_REWARD_KEY = 'GJ_SOLO_BOSS_REWARD_V2';

const HHA_LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
const HHA_SUMMARY_HISTORY_KEY = 'HHA_SUMMARY_HISTORY';
const HHA_EVENT_QUEUE_KEY = 'HHA_EVENT_QUEUE';
const HHA_SESSION_SUMMARY_QUEUE_KEY = 'HHA_SESSION_SUMMARY_QUEUE';
const HHA_EVENTS_SCHEMA_QUEUE_KEY = 'HHA_EVENTS_SCHEMA_QUEUE';
const HHA_SESSIONS_SCHEMA_QUEUE_KEY = 'HHA_SESSIONS_SCHEMA_QUEUE';

const SESSION_ID = `gjsolo-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const PATCH_VERSION = '20260328-goodjunk-solo-phaseboss-v2';

const GOOD_ITEMS = [
  { emoji: '🍎', label: 'apple' },
  { emoji: '🥕', label: 'carrot' },
  { emoji: '🥦', label: 'broccoli' },
  { emoji: '🍌', label: 'banana' },
  { emoji: '🥛', label: 'milk' },
  { emoji: '🥗', label: 'salad' },
  { emoji: '🍉', label: 'watermelon' },
  { emoji: '🐟', label: 'fish' }
];

const JUNK_ITEMS = [
  { emoji: '🍟', label: 'fries' },
  { emoji: '🍩', label: 'donut' },
  { emoji: '🍭', label: 'candy' },
  { emoji: '🍔', label: 'burger' },
  { emoji: '🥤', label: 'soda' },
  { emoji: '🍕', label: 'pizza' },
  { emoji: '🧁', label: 'cupcake' },
  { emoji: '🍫', label: 'chocolate' }
];

const PHASE_GOALS = {
  easy:   { 1: 70,  2: 170 },
  normal: { 1: 90,  2: 220 },
  hard:   { 1: 110, 2: 260 }
};

const DIFF_PRESET = {
  easy: {
    p1: { spawnMs: 900, goodRatio: 0.76, speedMin: 86, speedMax: 138, sizeMin: 66, sizeMax: 90 },
    p2: { spawnMs: 740, goodRatio: 0.67, speedMin: 112, speedMax: 178, sizeMin: 62, sizeMax: 86 },
    boss: {
      hp: 18,
      stormMs: 1120,
      weakSpeed: 122,
      weakMoveMs: 1480,
      weakSize: 96,
      stunBonusMs: 160,
      clearBonus: 70,
      stormBurst: 4,
      enrageStormPenalty: 80
    }
  },

  normal: {
    p1: { spawnMs: 760, goodRatio: 0.68, speedMin: 105, speedMax: 165, sizeMin: 60, sizeMax: 84 },
    p2: { spawnMs: 610, goodRatio: 0.57, speedMin: 135, speedMax: 225, sizeMin: 56, sizeMax: 78 },
    boss: {
      hp: 24,
      stormMs: 930,
      weakSpeed: 172,
      weakMoveMs: 1160,
      weakSize: 82,
      stunBonusMs: 80,
      clearBonus: 80,
      stormBurst: 5,
      enrageStormPenalty: 110
    }
  },

  hard: {
    p1: { spawnMs: 650, goodRatio: 0.60, speedMin: 126, speedMax: 198, sizeMin: 56, sizeMax: 78 },
    p2: { spawnMs: 500, goodRatio: 0.48, speedMin: 168, speedMax: 276, sizeMin: 52, sizeMax: 72 },
    boss: {
      hp: 30,
      stormMs: 760,
      weakSpeed: 230,
      weakMoveMs: 920,
      weakSize: 72,
      stunBonusMs: 0,
      clearBonus: 96,
      stormBurst: 6,
      enrageStormPenalty: 140
    }
  }
};

const BOSS_STAGE_TUNING = {
  easy: {
    1: { weakSizeAdd: 16, weakSpeedMul: 0.86, weakMoveMul: 1.10, stormMul: 1.18, armorBreakDamage: 2, label: 'LEARN' },
    2: { weakSizeAdd: 8,  weakSpeedMul: 1.00, weakMoveMul: 1.00, stormMul: 1.00, armorBreakDamage: 2, label: 'PRESSURE' },
    3: { weakSizeAdd: 2,  weakSpeedMul: 1.08, weakMoveMul: 0.92, stormMul: 0.84, armorBreakDamage: 2, label: 'FINAL' }
  },
  normal: {
    1: { weakSizeAdd: 12, weakSpeedMul: 0.90, weakMoveMul: 1.08, stormMul: 1.14, armorBreakDamage: 2, label: 'LEARN' },
    2: { weakSizeAdd: 4,  weakSpeedMul: 1.02, weakMoveMul: 1.00, stormMul: 0.98, armorBreakDamage: 2, label: 'PRESSURE' },
    3: { weakSizeAdd: -2, weakSpeedMul: 1.10, weakMoveMul: 0.90, stormMul: 0.82, armorBreakDamage: 2, label: 'FINAL' }
  },
  hard: {
    1: { weakSizeAdd: 10, weakSpeedMul: 0.92, weakMoveMul: 1.06, stormMul: 1.10, armorBreakDamage: 2, label: 'LEARN' },
    2: { weakSizeAdd: 2,  weakSpeedMul: 1.04, weakMoveMul: 0.98, stormMul: 0.94, armorBreakDamage: 2, label: 'PRESSURE' },
    3: { weakSizeAdd: -4, weakSpeedMul: 1.12, weakMoveMul: 0.88, stormMul: 0.78, armorBreakDamage: 2, label: 'FINAL' }
  }
};

const BOSS_COMBO_REWARD = {
  easy:   { threshold: 5, stunMs: 440, bonusScore: 10 },
  normal: { threshold: 6, stunMs: 380, bonusScore: 8 },
  hard:   { threshold: 7, stunMs: 320, bonusScore: 6 }
};

const ui = {
  root: null,
  stage: null,
  layer: null,
  score: null,
  timer: null,
  miss: null,
  streak: null,
  phasePill: null,
  goalText: null,
  hint: null,
  progress: null,
  stats: null,
  banner: null,
  bossWrap: null,
  bossIcon: null,
  bossName: null,
  bossHpBar: null,
  bossHpText: null,
  bossState: null,
  bossStagePill: null,
  summary: null,
  summaryTitle: null,
  summarySub: null,
  summaryGrid: null,
  btnAgain: null,
  btnCooldown: null,
  btnHub: null,
  btnExport: null
};

const state = {
  diff: DIFF_PRESET[RUN_CTX.diff] ? RUN_CTX.diff : 'normal',
  phase: 1,
  totalMs: 0,
  timeLeftMs: 0,
  running: false,
  ended: false,
  finishing: false,

  score: 0,
  miss: 0,
  streak: 0,
  bestStreak: 0,
  hitsGood: 0,
  hitsBad: 0,
  missedGood: 0,
  powerHits: 0,
  spawnedGood: 0,
  spawnedJunk: 0,

  bossStuns: 0,

  lastFrameTs: 0,
  spawnAccum: 0,
  raf: 0,
  targetSeq: 0,
  targets: new Map(),
  rect: { width: 320, height: 420 },

  recentMistakeAt: [],

  boss: {
    active: false,
    maxHp: 0,
    hp: 0,
    enrage: false,
    stormAccum: 0,
    weakTick: 0,
    weakspotId: '',
    weakSpeed: 0,
    weakSize: 0,
    weakMoveMs: 0,

    patternIndex: 0,
    patternLabel: 'Target Hunt',
    patternTimeLeft: 0,
    nextPatternIndex: -1,
    telegraphMs: 0,

    burstShots: 0,
    burstGapMs: 0,

    stunMs: 0,
    victoryShown: false,

    stage: 1,
    lastStageShown: 0,
    lastComboRewardTier: 0
  },

  summaryPayload: null,

  research: {
    reachedBossAtMs: 0,
    bossStartTimeLeftMs: 0,
    bossDurationMs: 0,

    weakspotSpawned: 0,
    weakspotHit: 0,

    stormSpawned: 0,
    stormHits: 0,

    patternStarts: {
      targetHunt: 0,
      junkStorm: 0,
      armorBreak: 0
    },

    patternWeakHits: {
      targetHunt: 0,
      junkStorm: 0,
      armorBreak: 0
    }
  }
};

const rng = createSeededRng(RUN_CTX.seed || Date.now());

boot();

function boot() {
  injectStyle();
  buildShell();
  bindShell();
  refreshStageRect();
  renderHud();
  requestAnimationFrame(() => startGame());
  window.addEventListener('resize', refreshStageRect);
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID}{
      position:absolute;
      inset:0;
      overflow:hidden;
      user-select:none;
      -webkit-user-select:none;
      touch-action:manipulation;
      color:#e5e7eb;
    }
    .gjpb-shell{
      position:absolute;
      inset:0;
      display:grid;
      grid-template-rows:auto auto 1fr auto;
      gap:10px;
      padding:
        calc(12px + env(safe-area-inset-top,0px))
        calc(12px + env(safe-area-inset-right,0px))
        calc(12px + env(safe-area-inset-bottom,0px))
        calc(12px + env(safe-area-inset-left,0px));
    }
    .gjpb-topbar{
      display:flex;
      justify-content:space-between;
      gap:10px;
      flex-wrap:wrap;
      align-items:flex-start;
      z-index:3;
    }
    .gjpb-chip-row{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }
    .gjpb-chip{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:9px 12px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.72);
      box-shadow:0 12px 28px rgba(0,0,0,.2);
      backdrop-filter:blur(8px);
      font-size:13px;
      font-weight:900;
      color:#e5e7eb;
    }
    .gjpb-chip span{
      color:#94a3b8;
      font-weight:800;
    }
    .gjpb-phasebar{
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px;
      flex-wrap:wrap;
      z-index:2;
    }
    .gjpb-phase-pill,
    .gjpb-goal-pill{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:10px 14px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.72);
      backdrop-filter:blur(8px);
      box-shadow:0 12px 28px rgba(0,0,0,.2);
      font-size:13px;
      font-weight:1000;
    }
    .gjpb-stage{
      position:relative;
      min-height:340px;
      border:1px solid rgba(148,163,184,.18);
      border-radius:26px;
      overflow:hidden;
      background:
        radial-gradient(circle at 50% 0%, rgba(56,189,248,.08), transparent 30%),
        radial-gradient(circle at 20% 20%, rgba(167,139,250,.08), transparent 26%),
        linear-gradient(180deg, rgba(15,23,42,.78), rgba(2,6,23,.9));
      box-shadow:0 24px 64px rgba(0,0,0,.24);
      isolation:isolate;
    }
    .gjpb-stage::before{
      content:"";
      position:absolute;
      inset:0;
      pointer-events:none;
      background:
        linear-gradient(180deg, rgba(255,255,255,.04), transparent 24%),
        linear-gradient(0deg, rgba(255,255,255,.02), transparent 22%);
      z-index:0;
    }
    .gjpb-stars{
      position:absolute;
      inset:0;
      background-image:
        radial-gradient(circle at 10% 15%, rgba(255,255,255,.55) 0 1px, transparent 1.5px),
        radial-gradient(circle at 28% 68%, rgba(255,255,255,.35) 0 1px, transparent 1.5px),
        radial-gradient(circle at 44% 24%, rgba(255,255,255,.42) 0 1px, transparent 1.5px),
        radial-gradient(circle at 72% 38%, rgba(255,255,255,.32) 0 1px, transparent 1.5px),
        radial-gradient(circle at 82% 72%, rgba(255,255,255,.4) 0 1px, transparent 1.5px),
        radial-gradient(circle at 90% 20%, rgba(255,255,255,.28) 0 1px, transparent 1.5px);
      opacity:.85;
      z-index:0;
      pointer-events:none;
    }
    .gjpb-layer{
      position:absolute;
      inset:0;
      overflow:hidden;
      z-index:1;
    }
    .gjpb-banner{
      position:absolute;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      min-width:min(80vw,520px);
      padding:16px 18px;
      border-radius:20px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.72);
      color:#e5e7eb;
      text-align:center;
      backdrop-filter:blur(8px);
      box-shadow:0 24px 50px rgba(0,0,0,.26);
      font-weight:1000;
      z-index:5;
      transition:opacity .2s ease, transform .2s ease;
    }
    .gjpb-banner.hide{
      opacity:0;
      transform:translate(-50%,-56%) scale(.98);
      pointer-events:none;
    }
    .gjpb-banner small{
      display:block;
      margin-top:6px;
      color:#cbd5e1;
      font-size:13px;
      font-weight:700;
      line-height:1.55;
    }
    .gjpb-target{
      position:absolute;
      display:grid;
      place-items:center;
      border-radius:20px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(15,23,42,.86);
      box-shadow:0 14px 28px rgba(0,0,0,.22);
      overflow:hidden;
      cursor:pointer;
      padding:0;
      transform:translate3d(0,0,0);
      z-index:2;
    }
    .gjpb-target.good{
      background:
        radial-gradient(circle at 30% 22%, rgba(255,255,255,.22), transparent 24%),
        linear-gradient(180deg, rgba(34,197,94,.34), rgba(34,197,94,.18)),
        rgba(15,23,42,.9);
      border-color:rgba(34,197,94,.34);
    }
    .gjpb-target.junk,
    .gjpb-target.storm{
      background:
        radial-gradient(circle at 30% 22%, rgba(255,255,255,.18), transparent 24%),
        linear-gradient(180deg, rgba(244,63,94,.28), rgba(244,63,94,.12)),
        rgba(15,23,42,.9);
      border-color:rgba(244,63,94,.32);
    }
    .gjpb-target.weakspot{
      background:
        radial-gradient(circle at 30% 22%, rgba(255,255,255,.32), transparent 24%),
        linear-gradient(180deg, rgba(250,204,21,.32), rgba(249,115,22,.18)),
        rgba(15,23,42,.94);
      border-color:rgba(250,204,21,.42);
      box-shadow:0 0 0 4px rgba(250,204,21,.08), 0 18px 42px rgba(0,0,0,.28);
      animation: gjpb-weakspot-pulse .9s ease-in-out infinite;
    }
    @keyframes gjpb-weakspot-pulse{
      0%,100%{
        box-shadow:0 0 0 0 rgba(250,204,21,.10), 0 18px 42px rgba(0,0,0,.28);
      }
      50%{
        box-shadow:0 0 0 8px rgba(250,204,21,.08), 0 18px 42px rgba(0,0,0,.28);
      }
    }
    .gjpb-emoji{
      font-size:34px;
      line-height:1;
      filter:drop-shadow(0 6px 12px rgba(0,0,0,.2));
      transform:translateY(-2px);
      pointer-events:none;
    }
    .gjpb-tag{
      position:absolute;
      left:8px;
      right:8px;
      bottom:6px;
      text-align:center;
      font-size:10px;
      font-weight:1000;
      letter-spacing:.08em;
      text-transform:uppercase;
      color:#e2e8f0;
      opacity:.94;
      pointer-events:none;
      white-space:nowrap;
    }
    .gjpb-fx{
      position:absolute;
      font-size:16px;
      font-weight:1000;
      pointer-events:none;
      transform:translate(-50%,-50%);
      text-shadow:0 8px 18px rgba(0,0,0,.24);
      animation:gjpb-fx-up .72s ease forwards;
      z-index:6;
    }
    @keyframes gjpb-fx-up{
      from{ opacity:1; transform:translate(-50%,-20%); }
      to{ opacity:0; transform:translate(-50%,-145%); }
    }
    .gjpb-bosswrap{
      position:absolute;
      left:12px;
      top:12px;
      width:min(280px, calc(100% - 24px));
      border:1px solid rgba(148,163,184,.18);
      border-radius:20px;
      background:rgba(2,6,23,.7);
      backdrop-filter:blur(8px);
      box-shadow:0 20px 40px rgba(0,0,0,.18);
      padding:12px;
      z-index:4;
      display:none;
      transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease;
    }
    .gjpb-bosswrap.show{
      display:block;
    }
    .gjpb-boss-head{
      display:flex;
      align-items:flex-start;
      gap:10px;
      margin-bottom:10px;
    }
    .gjpb-boss-icon{
      width:54px;
      height:54px;
      border-radius:16px;
      display:grid;
      place-items:center;
      font-size:28px;
      background:linear-gradient(180deg, rgba(239,68,68,.26), rgba(120,53,15,.2));
      border:1px solid rgba(239,68,68,.28);
      box-shadow:0 10px 20px rgba(0,0,0,.2);
      flex:0 0 auto;
    }
    .gjpb-boss-name{
      font-size:18px;
      font-weight:1000;
      margin:0;
    }
    .gjpb-boss-state{
      color:#cbd5e1;
      font-size:12px;
      font-weight:800;
      margin-top:2px;
    }
    .gjpb-boss-stagepill{
      display:inline-flex;
      align-items:center;
      gap:8px;
      margin-top:6px;
      padding:6px 10px;
      border-radius:999px;
      background:rgba(125,211,252,.14);
      border:1px solid rgba(125,211,252,.28);
      color:#bae6fd;
      font-size:11px;
      font-weight:1000;
      letter-spacing:.04em;
    }
    .gjpb-boss-bar{
      height:14px;
      border-radius:999px;
      overflow:hidden;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(255,255,255,.06);
      margin-top:6px;
    }
    .gjpb-boss-barfill{
      height:100%;
      width:100%;
      transform-origin:left center;
      background:linear-gradient(90deg, rgba(250,204,21,.95), rgba(249,115,22,.95));
      transition:transform .16s linear;
    }
    .gjpb-boss-hptext{
      margin-top:6px;
      color:#e5e7eb;
      font-size:12px;
      font-weight:1000;
      text-align:right;
    }
    .gjpb-bottom{
      z-index:3;
    }
    .gjpb-bottom-card{
      border:1px solid rgba(148,163,184,.18);
      border-radius:18px;
      padding:12px;
      background:rgba(2,6,23,.7);
      box-shadow:0 12px 28px rgba(0,0,0,.2);
      backdrop-filter:blur(8px);
    }
    .gjpb-bottom-top{
      display:flex;
      justify-content:space-between;
      gap:10px;
      flex-wrap:wrap;
      align-items:center;
      margin-bottom:10px;
    }
    .gjpb-hint{
      color:#cbd5e1;
      font-size:13px;
      line-height:1.55;
    }
    .gjpb-stats{
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      color:#cbd5e1;
      font-size:13px;
      line-height:1.55;
    }
    .gjpb-stats strong{
      color:#e5e7eb;
    }
    .gjpb-progress{
      position:relative;
      width:100%;
      height:12px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.18);
      overflow:hidden;
      background:rgba(255,255,255,.06);
    }
    .gjpb-progress-bar{
      height:100%;
      width:100%;
      transform-origin:left center;
      background:linear-gradient(90deg, rgba(56,189,248,.92), rgba(34,197,94,.88));
      transition:transform .1s linear;
    }
    .gjpb-summary{
      position:fixed;
      inset:0;
      display:grid;
      place-items:center;
      padding:
        calc(16px + env(safe-area-inset-top,0px))
        calc(16px + env(safe-area-inset-right,0px))
        calc(16px + env(safe-area-inset-bottom,0px))
        calc(16px + env(safe-area-inset-left,0px));
      background:rgba(2,6,23,.82);
      backdrop-filter:blur(10px);
      z-index:20;
    }
    .gjpb-summary[hidden]{
      display:none !important;
    }
    .gjpb-summary-card{
      width:min(94vw,760px);
      max-height:88vh;
      overflow:auto;
      border:1px solid rgba(148,163,184,.18);
      border-radius:24px;
      background:rgba(15,23,42,.96);
      box-shadow:0 28px 64px rgba(0,0,0,.38);
      padding:20px 18px 18px;
    }
    .gjpb-summary-kicker{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:6px 12px;
      border-radius:999px;
      background:rgba(56,189,248,.12);
      border:1px solid rgba(56,189,248,.24);
      color:#7dd3fc;
      font-size:13px;
      font-weight:1000;
      margin-bottom:12px;
    }
    .gjpb-summary-title{
      margin:0 0 8px;
      font-size:clamp(26px, 5vw, 38px);
      line-height:1.08;
      font-weight:1000;
    }
    .gjpb-summary-sub{
      margin:0;
      color:#94a3b8;
      font-size:14px;
      line-height:1.65;
    }
    .gjpb-summary-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
      margin-top:16px;
    }
    .gjpb-summary-item{
      border:1px solid rgba(148,163,184,.18);
      border-radius:18px;
      padding:12px;
      background:rgba(2,6,23,.45);
    }
    .gjpb-summary-item .label{
      color:#94a3b8;
      font-size:12px;
      font-weight:900;
      margin-bottom:6px;
    }
    .gjpb-summary-item .value{
      color:#e5e7eb;
      font-size:22px;
      font-weight:1000;
      line-height:1.2;
    }
    .gjpb-summary-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:18px;
    }
    .gjpb-btn{
      appearance:none;
      border:0;
      cursor:pointer;
      border-radius:16px;
      padding:12px 16px;
      font-size:14px;
      font-weight:1000;
      transition:.12s ease;
    }
    .gjpb-btn:hover{ transform:translateY(-1px); filter:brightness(1.05); }
    .gjpb-btn:active{ transform:translateY(0); }
    .gjpb-btn.good{ background:#22c55e; color:#052e16; }
    .gjpb-btn.blue{ background:#38bdf8; color:#082f49; }
    .gjpb-btn.warn{ background:#f59e0b; color:#3b1d00; }
    .gjpb-btn.ghost{
      background:rgba(255,255,255,.06);
      color:#e5e7eb;
      border:1px solid rgba(148,163,184,.18);
    }

    #${ROOT_ID}.gjpb-shake .gjpb-stage{
      animation: gjpb-stage-shake .22s linear 1;
    }
    @keyframes gjpb-stage-shake{
      0%{ transform:translate3d(0,0,0); }
      20%{ transform:translate3d(-6px, 2px, 0); }
      40%{ transform:translate3d(6px, -2px, 0); }
      60%{ transform:translate3d(-4px, 1px, 0); }
      80%{ transform:translate3d(4px, -1px, 0); }
      100%{ transform:translate3d(0,0,0); }
    }
    .gjpb-bosswrap.flash{
      border-color:rgba(250,204,21,.48);
      box-shadow:
        0 0 0 3px rgba(250,204,21,.10),
        0 20px 40px rgba(0,0,0,.18);
      transform:scale(1.02);
    }

    .gjpb-stage.stunned::after{
      content:"";
      position:absolute;
      inset:0;
      background:linear-gradient(180deg, rgba(250,204,21,.10), rgba(255,255,255,.02));
      pointer-events:none;
      z-index:4;
    }

    .gjpb-victory-burst{
      position:absolute;
      font-size:20px;
      font-weight:1000;
      pointer-events:none;
      transform:translate(-50%,-50%);
      animation:gjpb-victory-burst 900ms ease-out forwards;
      z-index:8;
      text-shadow:0 10px 24px rgba(0,0,0,.28);
    }
    @keyframes gjpb-victory-burst{
      from{
        opacity:1;
        transform:translate(-50%,-50%) scale(.7);
      }
      to{
        opacity:0;
        transform:translate(var(--tx), var(--ty)) scale(1.25);
      }
    }

    .gjpb-stage.telegraph-storm{
      box-shadow:
        0 0 0 2px rgba(244,63,94,.18),
        0 24px 64px rgba(0,0,0,.24);
    }
    .gjpb-stage.telegraph-storm::after{
      content:"";
      position:absolute;
      inset:0;
      background:linear-gradient(180deg, rgba(244,63,94,.10), transparent 40%);
      pointer-events:none;
      z-index:3;
    }

    .gjpb-stage.telegraph-break{
      box-shadow:
        0 0 0 2px rgba(250,204,21,.18),
        0 24px 64px rgba(0,0,0,.24);
    }
    .gjpb-stage.telegraph-break::after{
      content:"";
      position:absolute;
      inset:0;
      background:linear-gradient(180deg, rgba(250,204,21,.10), transparent 40%);
      pointer-events:none;
      z-index:3;
    }

    .gjpb-stage.telegraph-hunt{
      box-shadow:
        0 0 0 2px rgba(56,189,248,.18),
        0 24px 64px rgba(0,0,0,.24);
    }
    .gjpb-stage.telegraph-hunt::after{
      content:"";
      position:absolute;
      inset:0;
      background:linear-gradient(180deg, rgba(56,189,248,.10), transparent 40%);
      pointer-events:none;
      z-index:3;
    }

    .gjpb-bosswrap.defeated{
      border-color:rgba(34,197,94,.34);
      background:
        linear-gradient(180deg, rgba(34,197,94,.12), rgba(2,6,23,.7));
      transform:scale(1.03);
    }

    .gjpb-bosswrap.defeated .gjpb-boss-icon{
      background:linear-gradient(180deg, rgba(34,197,94,.30), rgba(20,83,45,.18));
      border-color:rgba(34,197,94,.30);
    }

    @media (max-width:760px){
      .gjpb-shell{
        grid-template-rows:auto auto 1fr auto;
        gap:8px;
        padding:10px;
      }
      .gjpb-bosswrap{
        width:calc(100% - 24px);
      }
      .gjpb-summary-grid{
        grid-template-columns:1fr 1fr;
      }
      .gjpb-summary-actions .gjpb-btn{
        flex:1 1 calc(50% - 10px);
      }
    }
    @media (max-width:540px){
      .gjpb-summary-grid{
        grid-template-columns:1fr;
      }
      .gjpb-summary-actions .gjpb-btn{
        flex:1 1 100%;
      }
    }
  `;
  document.head.appendChild(style);
}

function buildShell() {
  GAME_MOUNT.innerHTML = `
    <div id="${ROOT_ID}">
      <div class="gjpb-shell">
        <div class="gjpb-topbar">
          <div class="gjpb-chip-row">
            <div class="gjpb-chip"><span>Score</span><strong id="gjpbScore">0</strong></div>
            <div class="gjpb-chip"><span>Time</span><strong id="gjpbTimer">0:00</strong></div>
            <div class="gjpb-chip"><span>Miss</span><strong id="gjpbMiss">0</strong></div>
            <div class="gjpb-chip"><span>Streak</span><strong id="gjpbStreak">0</strong></div>
          </div>
        </div>

        <div class="gjpb-phasebar">
          <div class="gjpb-phase-pill" id="gjpbPhasePill">PHASE 1</div>
          <div class="gjpb-goal-pill" id="gjpbGoalText">GOAL สะสมคะแนน</div>
        </div>

        <div class="gjpb-stage" id="gjpbStage">
          <div class="gjpb-stars"></div>
          <div class="gjpb-layer" id="gjpbLayer"></div>

          <div class="gjpb-banner" id="gjpbBanner">
            <div id="gjpbBannerTitle">GoodJunk Phase Boss v2</div>
            <small id="gjpbBannerSub">เก็บอาหารดี • หลีกเลี่ยง junk • ผ่าน 2 phase แล้วเข้าสู้กับ Junk King</small>
          </div>

          <div class="gjpb-bosswrap" id="gjpbBossWrap">
            <div class="gjpb-boss-head">
              <div class="gjpb-boss-icon">🍔</div>
              <div>
                <h3 class="gjpb-boss-name" id="gjpbBossName">Junk King</h3>
                <div class="gjpb-boss-state" id="gjpbBossState">รอเข้าสู่บอส</div>
                <div class="gjpb-boss-stagepill" id="gjpbBossStagePill">STAGE 1 • LEARN</div>
              </div>
            </div>
            <div class="gjpb-boss-bar">
              <div class="gjpb-boss-barfill" id="gjpbBossHpBar"></div>
            </div>
            <div class="gjpb-boss-hptext" id="gjpbBossHpText">0 / 0</div>
          </div>
        </div>

        <div class="gjpb-bottom">
          <div class="gjpb-bottom-card">
            <div class="gjpb-bottom-top">
              <div class="gjpb-hint" id="gjpbHint">เก็บอาหารดีให้ได้คะแนนสูงขึ้น • อย่ากด junk</div>
              <div class="gjpb-stats" id="gjpbStats">
                <div><strong>Good hit:</strong> 0</div>
                <div><strong>Junk hit:</strong> 0</div>
                <div><strong>Good missed:</strong> 0</div>
                <div><strong>Power hit:</strong> 0</div>
              </div>
            </div>
            <div class="gjpb-progress">
              <div class="gjpb-progress-bar" id="gjpbProgressBar"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="gjpb-summary" id="gjpbSummary" hidden>
        <div class="gjpb-summary-card">
          <div class="gjpb-summary-kicker">GOODJUNK SOLO BOSS v2</div>
          <h2 class="gjpb-summary-title" id="gjpbSummaryTitle">สรุปผลการเล่น</h2>
          <p class="gjpb-summary-sub" id="gjpbSummarySub">จบรอบแล้ว มาดูผลของรอบนี้กัน</p>
          <div class="gjpb-summary-grid" id="gjpbSummaryGrid"></div>
          <div class="gjpb-summary-actions">
            <button class="gjpb-btn blue" id="gjpbBtnAgain" type="button">เล่นใหม่</button>
            <button class="gjpb-btn good" id="gjpbBtnCooldown" type="button">ไป Cooldown</button>
            <button class="gjpb-btn warn" id="gjpbBtnExport" type="button">Export JSON</button>
            <button class="gjpb-btn ghost" id="gjpbBtnHub" type="button">กลับ HUB</button>
          </div>
        </div>
      </div>
    </div>
  `;

  ui.root = document.getElementById(ROOT_ID);
  ui.stage = document.getElementById('gjpbStage');
  ui.layer = document.getElementById('gjpbLayer');
  ui.score = document.getElementById('gjpbScore');
  ui.timer = document.getElementById('gjpbTimer');
  ui.miss = document.getElementById('gjpbMiss');
  ui.streak = document.getElementById('gjpbStreak');
  ui.phasePill = document.getElementById('gjpbPhasePill');
  ui.goalText = document.getElementById('gjpbGoalText');
  ui.hint = document.getElementById('gjpbHint');
  ui.progress = document.getElementById('gjpbProgressBar');
  ui.stats = document.getElementById('gjpbStats');
  ui.banner = document.getElementById('gjpbBanner');
  ui.bossWrap = document.getElementById('gjpbBossWrap');
  ui.bossIcon = ui.bossWrap?.querySelector('.gjpb-boss-icon') || null;
  ui.bossName = document.getElementById('gjpbBossName');
  ui.bossHpBar = document.getElementById('gjpbBossHpBar');
  ui.bossHpText = document.getElementById('gjpbBossHpText');
  ui.bossState = document.getElementById('gjpbBossState');
  ui.bossStagePill = document.getElementById('gjpbBossStagePill');
  ui.summary = document.getElementById('gjpbSummary');
  ui.summaryTitle = document.getElementById('gjpbSummaryTitle');
  ui.summarySub = document.getElementById('gjpbSummarySub');
  ui.summaryGrid = document.getElementById('gjpbSummaryGrid');
  ui.btnAgain = document.getElementById('gjpbBtnAgain');
  ui.btnCooldown = document.getElementById('gjpbBtnCooldown');
  ui.btnHub = document.getElementById('gjpbBtnHub');
  ui.btnExport = document.getElementById('gjpbBtnExport');
}

function bindShell() {
  ui.btnAgain?.addEventListener('click', () => {
    location.href = buildReplayUrl();
  });

  ui.btnCooldown?.addEventListener('click', () => {
    location.href = buildCooldownUrl();
  });

  ui.btnHub?.addEventListener('click', () => {
    location.href = GJ_HUB;
  });

  ui.btnExport?.addEventListener('click', () => {
    downloadJson(
      makeResearchSnapshot(state.summaryPayload),
      `goodjunk-solo-research-${safeFilePart(GJ_PID)}-${Date.now()}.json`
    );
  });
}

function refreshStageRect() {
  const rect = ui.stage?.getBoundingClientRect();
  if (!rect) return;
  state.rect.width = Math.max(320, rect.width);
  state.rect.height = Math.max(360, rect.height);
}

function createSeededRng(seedInput) {
  const seedText = String(seedInput || Date.now());
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function rand() {
  return rng();
}

function randRange(min, max) {
  return min + (max - min) * rand();
}

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getRunTimeSeconds() {
  return clamp(Number(RUN_CTX.time || 150), 90, 180);
}

function getTimeBand() {
  const t = getRunTimeSeconds();
  if (t <= 100) return 'short';
  if (t <= 135) return 'medium';
  if (t <= 165) return 'standard';
  return 'long';
}

function getTimeBalance() {
  const band = getTimeBand();

  if (band === 'short') {
    return {
      band,
      goalScale: 0.82,
      spawnScale: 0.90,
      patternScale: 0.82,
      stormScale: 0.88,
      bossHpDelta: -2,
      weakSpeedDelta: 10,
      clearBonusDelta: 0
    };
  }

  if (band === 'medium') {
    return {
      band,
      goalScale: 0.92,
      spawnScale: 0.96,
      patternScale: 0.92,
      stormScale: 0.95,
      bossHpDelta: -1,
      weakSpeedDelta: 4,
      clearBonusDelta: 0
    };
  }

  if (band === 'long') {
    return {
      band,
      goalScale: 1.12,
      spawnScale: 1.03,
      patternScale: 1.12,
      stormScale: 1.08,
      bossHpDelta: 2,
      weakSpeedDelta: -8,
      clearBonusDelta: 8
    };
  }

  return {
    band: 'standard',
    goalScale: 1,
    spawnScale: 1,
    patternScale: 1,
    stormScale: 1,
    bossHpDelta: 0,
    weakSpeedDelta: 0,
    clearBonusDelta: 0
  };
}

function getPhaseGoal(phase) {
  const diffKey = DIFF_PRESET[state.diff] ? state.diff : 'normal';
  const base = PHASE_GOALS[diffKey]?.[phase] ?? (phase === 1 ? 90 : 220);
  const scale = getTimeBalance().goalScale || 1;
  return Math.max(20, Math.round(base * scale));
}

function getBossBase() {
  const raw = DIFF_PRESET[state.diff]?.boss || DIFF_PRESET.normal.boss;
  const tb = getTimeBalance();

  return {
    ...raw,
    hp: Math.max(6, raw.hp + (tb.bossHpDelta || 0)),
    weakSpeed: Math.max(90, raw.weakSpeed + (tb.weakSpeedDelta || 0)),
    clearBonus: Math.max(20, raw.clearBonus + (tb.clearBonusDelta || 0))
  };
}

function noteMistakeNow() {
  const now = Date.now();
  state.recentMistakeAt.push(now);
  state.recentMistakeAt = state.recentMistakeAt.filter(ts => now - ts <= 8000);
}

function getRecentMistakeCount(windowMs = 8000) {
  const now = Date.now();
  state.recentMistakeAt = state.recentMistakeAt.filter(ts => now - ts <= windowMs);
  return state.recentMistakeAt.length;
}

function getBossStage() {
  if (!state.boss.maxHp) return 1;
  const ratio = state.boss.hp / state.boss.maxHp;
  if (ratio > 0.66) return 1;
  if (ratio > 0.33) return 2;
  return 3;
}

function getBossStageConfig() {
  const diffMap = BOSS_STAGE_TUNING[state.diff] || BOSS_STAGE_TUNING.normal;
  return diffMap[getBossStage()] || diffMap[1];
}

function syncBossStage(force = false) {
  const stage = getBossStage();
  state.boss.stage = stage;

  if (!force && stage === state.boss.lastStageShown) return;

  state.boss.lastStageShown = stage;

  if (stage === 1) {
    showBanner('BOSS STAGE 1', 'อ่านจังหวะบอสก่อน แล้วแตะเป้าทองให้แม่น', 1200);
    updateHint('Stage 1: เรียนรู้จังหวะก่อน');
  } else if (stage === 2) {
    showBanner('BOSS STAGE 2', 'เริ่มเร็วขึ้นแล้ว! อ่าน telegraph แล้วรีบตอบสนอง', 1200);
    updateHint('Stage 2: กดดันขึ้นแล้ว อย่าพลาด junk');
  } else {
    showBanner('FINAL STAGE', 'ช่วงสุดท้ายแล้ว! รักษาคอมโบเพื่อ stun บอส', 1400);
    updateHint('Stage 3: ลุ้นสุด แต่ยัง comeback ได้');
  }

  logGameEvent('boss_stage_change', {
    bossStage: stage,
    bossHp: state.boss.hp,
    bossMaxHp: state.boss.maxHp
  });
}

function maybeTriggerBossComboReward() {
  if (!state.boss.active || state.boss.hp <= 0) return;

  const cfg = BOSS_COMBO_REWARD[state.diff] || BOSS_COMBO_REWARD.normal;
  const tier = Math.floor((state.streak || 0) / cfg.threshold);

  if (tier <= 0) return;
  if (tier <= state.boss.lastComboRewardTier) return;

  state.boss.lastComboRewardTier = tier;
  state.score += cfg.bonusScore;

  createFx(state.rect.width * 0.5, 118, 'COMBO POWER!', '#93c5fd');
  startBossStun(cfg.stunMs, 'COMBO STUN!');
  updateHint('คอมโบดีมาก! บอสชะงักแล้ว');

  logGameEvent('boss_combo_reward', {
    combo: state.streak,
    rewardTier: tier,
    stunMs: cfg.stunMs,
    bonusScore: cfg.bonusScore
  });
}

function getBossClearBonus() {
  return getBossBase().clearBonus || 40;
}

function getBossPressureRatio() {
  if (!state.totalMs) return 1;
  const used = 1 - (state.timeLeftMs / state.totalMs);
  return clamp(used, 0, 1);
}

function getEasyGraceWeakSizeBonus() {
  if (state.diff !== 'easy') return 0;
  if (!state.boss.active) return 0;
  if (state.miss < 6) return 0;
  return 10;
}

function getElapsedMs() {
  return Math.max(0, state.totalMs - state.timeLeftMs);
}

function getPatternKey(index = state.boss.patternIndex) {
  if (index === 1) return 'junkStorm';
  if (index === 2) return 'armorBreak';
  return 'targetHunt';
}

function getWeakspotHitRatePct() {
  const total = state.research.weakspotSpawned || 0;
  if (!total) return 0;
  return Math.round((state.research.weakspotHit / total) * 100);
}

function getStormAvoidRatePct() {
  const total = state.research.stormSpawned || 0;
  if (!total) return 100;
  const avoided = Math.max(0, total - state.research.stormHits);
  return Math.round((avoided / total) * 100);
}

function nowIso() {
  return new Date().toISOString();
}

function makeBaseLogFields() {
  return {
    timestampIso: nowIso(),
    sessionId: SESSION_ID,
    projectTag: 'herohealth',
    source: 'goodjunk-solo-phaseboss-v2',
    version: PATCH_VERSION,

    gameId: GJ_GAME_ID,
    mode: 'solo',
    diff: state.diff,
    runMode: RUN_CTX.run || 'play',
    view: RUN_CTX.view || 'mobile',

    pid: GJ_PID,
    name: GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    roomId: '',
    seed: RUN_CTX.seed || '',

    timeTotalSec: Math.round(state.totalMs / 1000) || Number(RUN_CTX.time || 150),
    timeLeftMs: Math.max(0, Math.round(state.timeLeftMs || 0)),
    elapsedMs: Math.round(getElapsedMs())
  };
}

function appendQueue(key, item, limit = 800) {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(arr) ? arr : [];
    next.push(item);
    while (next.length > limit) next.shift();
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
}

function getStudentMeta() {
  return {
    studentKey: __qs.get('studentKey') || GJ_PID,
    schoolCode: __qs.get('schoolCode') || '',
    classRoom: __qs.get('classRoom') || '',
    studentNo: __qs.get('studentNo') || '',
    nickName: __qs.get('nickName') || GJ_NAME,
    conditionGroup: __qs.get('conditionGroup') || '',
    phaseTag: __qs.get('phase') || ''
  };
}

function makeRowId(prefix = 'row') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

function currentPhaseLabel() {
  if (state.boss.active) return `boss:${getPatternKey()}:stage${getBossStage()}`;
  return `phase-${state.phase}`;
}

function currentGoalProgress() {
  if (state.boss.active) {
    return `${state.boss.maxHp - state.boss.hp}/${state.boss.maxHp}`;
  }
  return `${state.score}/${getPhaseGoal(state.phase)}`;
}

function currentMiniProgress() {
  if (state.boss.active) {
    return `weak:${state.research.weakspotHit}/${state.research.weakspotSpawned}`;
  }
  return `good:${state.hitsGood}|junk:${state.hitsBad}|miss:${state.missedGood}`;
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}

function makeHhaEventRow(payload) {
  const meta = getStudentMeta();

  return {
    rowId: makeRowId('evt'),
    timestampIso: payload.timestampIso || nowIso(),
    projectTag: 'herohealth',
    runMode: payload.runMode || RUN_CTX.run || 'play',
    studyId: payload.studyId || RUN_CTX.studyId || '',
    phase: currentPhaseLabel(),
    conditionGroup: meta.conditionGroup,
    sessionId: SESSION_ID,
    eventType: payload.eventType || '',
    gameMode: 'solo',
    diff: state.diff,
    timeFromStartMs: payload.elapsedMs ?? Math.round(getElapsedMs()),

    targetId: payload.targetId || '',
    emoji: payload.emoji || '',
    itemType: payload.itemType || '',
    lane: payload.lane || '',
    rtMs: payload.rtMs ?? '',
    judgment: payload.judgment || '',

    totalScore: state.score,
    combo: state.streak,
    isGood: typeof payload.isGood === 'boolean' ? payload.isGood : '',
    feverState: '',
    feverValue: '',

    goalProgress: currentGoalProgress(),
    miniProgress: currentMiniProgress(),
    extra: safeJson(payload.extra || payload),

    studentKey: meta.studentKey,
    schoolCode: meta.schoolCode,
    classRoom: meta.classRoom,
    studentNo: meta.studentNo,
    nickName: meta.nickName
  };
}

function makeHhaSessionRow(summary) {
  const meta = getStudentMeta();

  return {
    rowId: makeRowId('ses'),
    timestampIso: nowIso(),
    projectTag: 'herohealth',
    sessionId: SESSION_ID,

    pid: summary.pid || GJ_PID,
    studyId: summary.studyId || RUN_CTX.studyId || '',
    gameId: summary.gameId || GJ_GAME_ID,
    gameMode: 'solo',
    diff: summary.diff || state.diff,
    runMode: RUN_CTX.run || 'play',
    view: RUN_CTX.view || 'mobile',

    score: summary.score,
    miss: summary.miss,
    bestStreak: summary.bestStreak,
    bossDefeated: summary.bossDefeated,
    phaseReached: summary.phaseReached,
    reachedBossAtMs: summary.reachedBossAtMs,
    bossDurationMs: summary.bossDurationMs,

    weakspotHitRatePct: summary.weakspotHitRatePct,
    stormAvoidRatePct: summary.stormAvoidRatePct,
    bossStuns: summary.bossStuns,
    timeBand: summary.timeBand,

    studentKey: meta.studentKey,
    schoolCode: meta.schoolCode,
    classRoom: meta.classRoom,
    studentNo: meta.studentNo,
    nickName: meta.nickName,

    extra: safeJson(summary)
  };
}

function tryBridgeCall(kind, row) {
  try {
    const bridge = window.HHACloudLogger;
    if (!bridge) return false;

    if (kind === 'event') {
      if (typeof bridge.logEventRow === 'function') { bridge.logEventRow(row); return true; }
      if (typeof bridge.pushEventRow === 'function') { bridge.pushEventRow(row); return true; }
      if (typeof bridge.logEvent === 'function') { bridge.logEvent(row); return true; }
    }

    if (kind === 'session') {
      if (typeof bridge.logSessionRow === 'function') { bridge.logSessionRow(row); return true; }
      if (typeof bridge.pushSessionRow === 'function') { bridge.pushSessionRow(row); return true; }
      if (typeof bridge.logSession === 'function') { bridge.logSession(row); return true; }
      if (typeof bridge.logSummary === 'function') { bridge.logSummary(row); return true; }
    }
  } catch {}

  return false;
}

function emitExternalLog(type, payload) {
  try {
    window.dispatchEvent(new CustomEvent(type, { detail: payload }));
  } catch {}

  try {
    if (window.HHACloudLogger && typeof window.HHACloudLogger.logEvent === 'function') {
      window.HHACloudLogger.logEvent(payload);
    }
  } catch {}

  try {
    if (window.SessionLogger && typeof window.SessionLogger.push === 'function') {
      window.SessionLogger.push(payload);
    }
  } catch {}
}

function logGameEvent(eventType, extra = {}) {
  const payload = {
    ...makeBaseLogFields(),
    eventType,
    phase: state.phase,
    score: state.score,
    miss: state.miss,
    streak: state.streak,
    bestStreak: state.bestStreak,
    hitsGood: state.hitsGood,
    hitsBad: state.hitsBad,
    missedGood: state.missedGood,
    powerHits: state.powerHits,
    bossActive: state.boss.active,
    bossHp: state.boss.hp,
    bossMaxHp: state.boss.maxHp,
    bossPattern: state.boss.patternLabel,
    bossStage: state.boss.stage,
    ...extra
  };

  appendQueue(HHA_EVENT_QUEUE_KEY, payload, 1200);

  const eventRow = makeHhaEventRow(payload);
  appendQueue(HHA_EVENTS_SCHEMA_QUEUE_KEY, eventRow, 1200);

  emitExternalLog('hha:log-event', payload);
  emitExternalLog('hha:event-row', eventRow);
  tryBridgeCall('event', eventRow);

  return payload;
}

function logSessionSummary(summary) {
  const payload = {
    ...makeBaseLogFields(),
    eventType: 'session_summary',
    summary
  };

  appendQueue(HHA_SESSION_SUMMARY_QUEUE_KEY, payload, 120);

  const sessionRow = makeHhaSessionRow(summary);
  appendQueue(HHA_SESSIONS_SCHEMA_QUEUE_KEY, sessionRow, 120);

  emitExternalLog('hha:log-summary', payload);
  emitExternalLog('hha:session-row', sessionRow);
  tryBridgeCall('session', sessionRow);

  return payload;
}

function startGame() {
  state.totalMs = clamp(Math.floor(Number(RUN_CTX.time || 150) * 1000), 60000, 600000);
  state.timeLeftMs = state.totalMs;
  state.running = true;
  state.ended = false;
  state.finishing = false;
  state.phase = 1;
  state.score = 0;
  state.miss = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.hitsGood = 0;
  state.hitsBad = 0;
  state.missedGood = 0;
  state.powerHits = 0;
  state.spawnedGood = 0;
  state.spawnedJunk = 0;
  state.bossStuns = 0;
  state.lastFrameTs = performance.now();
  state.spawnAccum = 0;
  state.targetSeq = 0;
  state.targets.clear();
  state.summaryPayload = null;
  state.recentMistakeAt = [];

  state.research = {
    reachedBossAtMs: 0,
    bossStartTimeLeftMs: 0,
    bossDurationMs: 0,

    weakspotSpawned: 0,
    weakspotHit: 0,

    stormSpawned: 0,
    stormHits: 0,

    patternStarts: {
      targetHunt: 0,
      junkStorm: 0,
      armorBreak: 0
    },

    patternWeakHits: {
      targetHunt: 0,
      junkStorm: 0,
      armorBreak: 0
    }
  };

  resetBossState();

  if (ui.layer) ui.layer.innerHTML = '';
  if (ui.summary) ui.summary.hidden = true;
  ui.stage?.classList.remove('stunned', 'telegraph-storm', 'telegraph-break', 'telegraph-hunt');
  ui.bossWrap?.classList.remove('show', 'flash', 'defeated');
  if (ui.bossIcon) ui.bossIcon.textContent = '🍔';
  if (ui.bossName) ui.bossName.textContent = 'Junk King';
  if (ui.bossState) ui.bossState.textContent = 'รอเข้าสู่บอส';
  if (ui.bossStagePill) ui.bossStagePill.textContent = 'STAGE 1 • LEARN';

  showBanner(
    'GoodJunk Phase Boss v2',
    'เก็บอาหารดี • หลีกเลี่ยง junk • ผ่าน Phase 1 และ Phase 2 เพื่อไปสู้กับ Junk King',
    1800
  );

  updateHint('เริ่มเลย! เก็บอาหารดีให้ได้คะแนน แล้วอย่ากด junk');
  renderHud();

  logGameEvent('session_start', {
    phaseGoal1: getPhaseGoal(1),
    phaseGoal2: getPhaseGoal(2),
    timeBand: getTimeBand()
  });

  state.raf = requestAnimationFrame(loop);
}

function resetBossState() {
  const bossPreset = getBossBase();
  state.boss.active = false;
  state.boss.maxHp = bossPreset.hp;
  state.boss.hp = bossPreset.hp;
  state.boss.enrage = false;
  state.boss.stormAccum = 0;
  state.boss.weakTick = 0;
  state.boss.weakspotId = '';
  state.boss.weakSpeed = bossPreset.weakSpeed;
  state.boss.weakSize = bossPreset.weakSize;
  state.boss.weakMoveMs = bossPreset.weakMoveMs;

  state.boss.patternIndex = 0;
  state.boss.patternLabel = 'Target Hunt';
  state.boss.patternTimeLeft = 0;
  state.boss.nextPatternIndex = -1;
  state.boss.telegraphMs = 0;

  state.boss.burstShots = 0;
  state.boss.burstGapMs = 0;

  state.boss.stunMs = 0;
  state.boss.victoryShown = false;

  state.boss.stage = 1;
  state.boss.lastStageShown = 0;
  state.boss.lastComboRewardTier = 0;
}

function getBossPatternName(index) {
  if (index === 1) return 'Junk Storm';
  if (index === 2) return 'Armor Break';
  return 'Target Hunt';
}

function getBossPatternSpec() {
  const base = getBossBase();
  const pressure = getBossPressureRatio();
  const easyWeakBonus = getEasyGraceWeakSizeBonus();
  const tb = getTimeBalance();
  const stageCfg = getBossStageConfig();

  if (state.boss.patternIndex === 1) {
    return {
      label: 'Junk Storm',
      hint: 'หลบ junk ก่อน แล้วค่อยตีเป้าทอง',
      stormMs: Math.max(
        state.diff === 'hard' ? 240 : 320,
        Math.round((base.stormMs - 170 - (state.boss.enrage ? base.enrageStormPenalty : 0)) * stageCfg.stormMul * (tb.stormScale || 1))
      ),
      weakSpeed: Math.max(90, Math.round((base.weakSpeed + (state.boss.enrage ? 60 : 26) + Math.round(pressure * 12)) * stageCfg.weakSpeedMul)),
      weakSize: Math.max(58, Math.round(base.weakSize - 8 + stageCfg.weakSizeAdd + easyWeakBonus)),
      weakMoveMs: Math.max(620, Math.round((base.weakMoveMs - 140) * stageCfg.weakMoveMul)),
      damage: 1
    };
  }

  if (state.boss.patternIndex === 2) {
    return {
      label: 'Armor Break',
      hint: 'ตอนนี้จุดอ่อนเปิดกว้างขึ้น ตีให้ทัน',
      stormMs: Math.max(260, Math.round((base.stormMs + 90) * stageCfg.stormMul * (tb.stormScale || 1))),
      weakSpeed: Math.max(100, Math.round((base.weakSpeed - 28) * stageCfg.weakSpeedMul)),
      weakSize: Math.max(62, Math.round(base.weakSize + 14 + stageCfg.weakSizeAdd + easyWeakBonus)),
      weakMoveMs: Math.max(700, Math.round((base.weakMoveMs + 180) * stageCfg.weakMoveMul)),
      damage: stageCfg.armorBreakDamage || 2
    };
  }

  return {
    label: 'Target Hunt',
    hint: 'มองหาเป้าทองที่กำลังวิ่ง แล้วแตะให้แม่น',
    stormMs: Math.max(
      state.diff === 'hard' ? 300 : 360,
      Math.round((base.stormMs - (state.boss.enrage ? Math.round(base.enrageStormPenalty * 0.42) : 0)) * stageCfg.stormMul * (tb.stormScale || 1))
    ),
    weakSpeed: Math.max(90, Math.round((base.weakSpeed + Math.round(pressure * (state.diff === 'hard' ? 18 : 10))) * stageCfg.weakSpeedMul)),
    weakSize: Math.max(58, Math.round(base.weakSize + stageCfg.weakSizeAdd + easyWeakBonus)),
    weakMoveMs: Math.max(720, Math.round((base.weakMoveMs - Math.round(pressure * 80)) * stageCfg.weakMoveMul)),
    damage: 1
  };
}

function syncWeakspotStyle(target) {
  if (!target) return;
  target.w = state.boss.weakSize;
  target.h = state.boss.weakSize;
  target.el.style.width = `${target.w}px`;
  target.el.style.height = `${target.h}px`;
  drawTarget(target);
}

function clearTelegraphTheme() {
  ui.stage?.classList.remove('telegraph-storm', 'telegraph-break', 'telegraph-hunt');
}

function setTelegraphTheme(kind) {
  clearTelegraphTheme();
  if (kind === 'storm') ui.stage?.classList.add('telegraph-storm');
  else if (kind === 'break') ui.stage?.classList.add('telegraph-break');
  else if (kind === 'hunt') ui.stage?.classList.add('telegraph-hunt');
}

function applyBossPattern(index) {
  clearTelegraphTheme();

  state.boss.patternIndex = index;
  state.boss.patternLabel = getBossPatternName(index);
  state.research.patternStarts[getPatternKey(index)] += 1;
  state.boss.nextPatternIndex = -1;
  state.boss.telegraphMs = 0;
  const tb = getTimeBalance();
  const basePatternMs =
    state.diff === 'easy'
      ? (state.boss.enrage ? 4500 : 5600)
      : state.diff === 'hard'
        ? (state.boss.enrage ? 3600 : 4700)
        : (state.boss.enrage ? 4200 : 5200);

  state.boss.patternTimeLeft = Math.max(2400, Math.round(basePatternMs * (tb.patternScale || 1)));
  state.boss.stormAccum = 0;
  state.boss.weakTick = 0;

  const spec = getBossPatternSpec();
  state.boss.weakSpeed = spec.weakSpeed;
  state.boss.weakSize = spec.weakSize;
  state.boss.weakMoveMs = spec.weakMoveMs;

  const burstBase = getBossBase().stormBurst || 5;
  state.boss.burstShots = index === 1
    ? (state.boss.enrage ? burstBase + 1 : burstBase)
    : 0;
  state.boss.burstGapMs = 0;

  const weak = getWeakspot();
  if (weak) syncWeakspotStyle(weak);

  if (ui.bossIcon) {
    ui.bossIcon.textContent =
      index === 1 ? '🌪️' :
      index === 2 ? '🛡️' :
      '🎯';
  }

  updateHint(spec.hint);

  logGameEvent('boss_pattern_start', {
    patternIndex: index,
    patternKey: getPatternKey(index),
    patternLabel: state.boss.patternLabel,
    patternTimeLeftMs: state.boss.patternTimeLeft,
    weakSize: state.boss.weakSize,
    weakSpeed: state.boss.weakSpeed
  });
}

function queueNextBossPattern() {
  state.boss.nextPatternIndex = (state.boss.patternIndex + 1) % 3;
  state.boss.telegraphMs = 850;

  if (state.boss.nextPatternIndex === 1) {
    setTelegraphTheme('storm');
    showBanner('ระวังพายุขยะ!', 'อีกครู่ junk จะตกมาเป็นชุด รีบหลบก่อน', 780);
    updateHint('เตรียมหลบ junk storm');
    logGameEvent('boss_telegraph', {
      nextPattern: 'junkStorm',
      telegraphMs: state.boss.telegraphMs
    });
    return;
  }

  if (state.boss.nextPatternIndex === 2) {
    setTelegraphTheme('break');
    showBanner('เกราะบอสเปิด!', 'เป้าทองจะใหญ่ขึ้น ตีโดนจะเจ็บแรง', 780);
    updateHint('รอเป้าทองใหญ่แล้วแตะ');
    logGameEvent('boss_telegraph', {
      nextPattern: 'armorBreak',
      telegraphMs: state.boss.telegraphMs
    });
    return;
  }

  setTelegraphTheme('hunt');
  showBanner('เป้าทองกำลังวิ่ง!', 'อ่านจังหวะแล้วแตะเป้าทองให้แม่น', 780);
  updateHint('เป้าทองจะเคลื่อนไหวไวขึ้น');
  logGameEvent('boss_telegraph', {
    nextPattern: 'targetHunt',
    telegraphMs: state.boss.telegraphMs
  });
}

function loop(ts) {
  if (!state.running || state.ended || state.finishing) return;

  const dt = Math.min(48, ts - state.lastFrameTs || 16);
  state.lastFrameTs = ts;

  state.timeLeftMs -= dt;
  if (state.timeLeftMs <= 0) {
    state.timeLeftMs = 0;
    renderHud();
    endGame('time-up');
    return;
  }

  if (!state.boss.active) {
    updateFoodPhase(dt);
  } else {
    updateBossPhase(dt);
  }

  updateTargets(dt);
  checkPhaseProgress();
  renderHud();

  state.raf = requestAnimationFrame(loop);
}

function updateFoodPhase(dt) {
  const preset = state.phase === 1
    ? DIFF_PRESET[state.diff].p1
    : DIFF_PRESET[state.diff].p2;

  const tb = getTimeBalance();
  const spawnMs = Math.max(260, preset.spawnMs * (tb.spawnScale || 1));

  state.spawnAccum += dt;

  while (state.spawnAccum >= spawnMs) {
    state.spawnAccum -= spawnMs;
    spawnFoodTarget(preset);
  }
}

function spawnFoodTarget(preset) {
  refreshStageRect();

  const isGood = rand() < preset.goodRatio;
  const item = pick(isGood ? GOOD_ITEMS : JUNK_ITEMS);
  const size = randRange(preset.sizeMin, preset.sizeMax);
  const x = randRange(12, Math.max(18, state.rect.width - size - 12));
  const y = -size - randRange(0, 40);
  const speed = randRange(preset.speedMin, preset.speedMax);
  const drift = randRange(-42, 42);

  createTarget({
    kind: isGood ? 'good' : 'junk',
    emoji: item.emoji,
    label: isGood ? 'good' : 'junk',
    x,
    y,
    w: size,
    h: size,
    vx: drift,
    vy: speed
  });

  if (isGood) state.spawnedGood += 1;
  else state.spawnedJunk += 1;
}

function updateBossPhase(dt) {
  syncBossStage();

  if (getBossStage() === 3 && !state.boss.enrage && getRecentMistakeCount(8000) >= 3) {
    state.boss.enrage = true;
    showBanner('Junk King โกรธแล้ว!', 'พลาดติดกันหลายครั้ง บอสเร่งจังหวะขึ้น', 1300);
    updateHint('ตั้งสติ อ่าน telegraph แล้วกลับมาคุมเกม');
    applyBossPattern(state.boss.patternIndex);
  }

  if (state.boss.stunMs > 0) {
    state.boss.stunMs -= dt;
    if (state.boss.stunMs <= 0) {
      state.boss.stunMs = 0;
      ui.stage?.classList.remove('stunned');
      updateHint('บอสกลับมาแล้ว อ่านจังหวะแล้วแตะต่อ');
    }
    return;
  }

  if (state.boss.telegraphMs > 0) {
    state.boss.telegraphMs -= dt;
    if (state.boss.telegraphMs <= 0 && state.boss.nextPatternIndex >= 0) {
      applyBossPattern(state.boss.nextPatternIndex);
    }
    return;
  }

  state.boss.patternTimeLeft -= dt;
  if (state.boss.patternTimeLeft <= 0) {
    queueNextBossPattern();
    return;
  }

  const spec = getBossPatternSpec();

  state.boss.stormAccum += dt;
  state.boss.weakTick += dt;

  if (state.boss.burstShots > 0) {
    state.boss.burstGapMs -= dt;
    if (state.boss.burstGapMs <= 0) {
      spawnStormJunk();
      state.boss.burstShots -= 1;
      state.boss.burstGapMs = state.boss.enrage ? 120 : 160;
    }
  }

  while (state.boss.stormAccum >= spec.stormMs) {
    state.boss.stormAccum -= spec.stormMs;
    spawnStormJunk();
  }

  const weak = getWeakspot();
  if (!weak) {
    spawnWeakspot();
  } else {
    moveWeakspot(weak, dt);
  }

  if (state.boss.weakTick >= spec.weakMoveMs) {
    state.boss.weakTick = 0;
    const target = getWeakspot();
    if (target) {
      target.vx = randRange(-spec.weakSpeed, spec.weakSpeed);
      target.vy = randRange(-spec.weakSpeed, spec.weakSpeed);

      if (Math.abs(target.vx) < 70) target.vx = target.vx < 0 ? -70 : 70;
      if (Math.abs(target.vy) < 70) target.vy = target.vy < 0 ? -70 : 70;

      syncWeakspotStyle(target);
    }
  }
}

function spawnWeakspot() {
  refreshStageRect();

  const size = state.boss.weakSize;
  const x = randRange(18, Math.max(20, state.rect.width - size - 18));
  const y = randRange(90, Math.max(96, state.rect.height - size - 24));
  const speed = state.boss.weakSpeed;

  const id = createTarget({
    kind: 'weakspot',
    emoji: '🎯',
    label: 'weak',
    x,
    y,
    w: size,
    h: size,
    vx: randRange(-speed, speed),
    vy: randRange(-speed, speed)
  });

  state.boss.weakspotId = id;
  state.research.weakspotSpawned += 1;

  logGameEvent('weakspot_spawn', {
    targetId: id,
    emoji: '🎯',
    itemType: 'weakspot',
    weakspotSpawned: state.research.weakspotSpawned,
    patternKey: getPatternKey(),
    x: Math.round(x),
    y: Math.round(y),
    size: Math.round(size)
  });
}

function spawnStormJunk() {
  refreshStageRect();

  const item = pick(JUNK_ITEMS);
  const size = randRange(44, 64);
  const x = randRange(10, Math.max(12, state.rect.width - size - 10));
  const y = -size - randRange(0, 36);
  const vy = state.boss.enrage ? randRange(210, 320) : randRange(170, 260);
  const vx = randRange(-65, 65);

  createTarget({
    kind: 'storm',
    emoji: item.emoji,
    label: 'storm',
    x,
    y,
    w: size,
    h: size,
    vx,
    vy
  });

  state.spawnedJunk += 1;
  state.research.stormSpawned += 1;

  logGameEvent('storm_spawn', {
    emoji: item.emoji,
    itemType: 'storm',
    stormSpawned: state.research.stormSpawned,
    patternKey: getPatternKey(),
    x: Math.round(x),
    size: Math.round(size)
  });
}

function moveWeakspot(target, dt) {
  target.x += (target.vx * dt) / 1000;
  target.y += (target.vy * dt) / 1000;

  const minY = 92;
  if (target.x <= 8) {
    target.x = 8;
    target.vx *= -1;
  }
  if (target.x + target.w >= state.rect.width - 8) {
    target.x = state.rect.width - target.w - 8;
    target.vx *= -1;
  }
  if (target.y <= minY) {
    target.y = minY;
    target.vy *= -1;
  }
  if (target.y + target.h >= state.rect.height - 8) {
    target.y = state.rect.height - target.h - 8;
    target.vy *= -1;
  }

  drawTarget(target);
}

function updateTargets(dt) {
  const stageW = state.rect.width;
  const stageH = state.rect.height;
  const removeIds = [];

  state.targets.forEach((target) => {
    if (target.dead) {
      removeIds.push(target.id);
      return;
    }

    if (target.kind === 'weakspot') return;

    target.x += (target.vx * dt) / 1000;
    target.y += (target.vy * dt) / 1000;

    if (target.x <= 6) {
      target.x = 6;
      target.vx *= -1;
    }
    if (target.x + target.w >= stageW - 6) {
      target.x = stageW - target.w - 6;
      target.vx *= -1;
    }

    drawTarget(target);

    if (target.y > stageH + target.h * 0.7) {
      if (target.kind === 'good') {
        registerMissedGood(target);
      } else {
        removeTarget(target.id);
      }
    }
  });

  removeIds.forEach(removeTarget);
}

function createTarget({
  kind,
  emoji,
  label,
  x,
  y,
  w,
  h,
  vx = 0,
  vy = 0
}) {
  const id = `t-${++state.targetSeq}`;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `gjpb-target ${kind}`;
  btn.style.width = `${w}px`;
  btn.style.height = `${h}px`;
  btn.innerHTML = `
    <div class="gjpb-emoji">${emoji}</div>
    <div class="gjpb-tag">${label}</div>
  `;

  btn.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    hitTarget(id);
  }, { passive: false });

  const target = {
    id,
    kind,
    emoji,
    label,
    x,
    y,
    w,
    h,
    vx,
    vy,
    el: btn,
    dead: false
  };

  ui.layer?.appendChild(btn);
  state.targets.set(id, target);
  drawTarget(target);
  return id;
}

function drawTarget(target) {
  target.el.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
}

function removeTarget(id) {
  const target = state.targets.get(id);
  if (!target) return;
  target.dead = true;
  target.el.remove();
  state.targets.delete(id);
  if (target.kind === 'weakspot' && state.boss.weakspotId === id) {
    state.boss.weakspotId = '';
  }
}

function getWeakspot() {
  return state.boss.weakspotId ? state.targets.get(state.boss.weakspotId) : null;
}

function hitTarget(id) {
  if (!state.running || state.ended || state.finishing) return;
  const target = state.targets.get(id);
  if (!target || target.dead) return;

  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;

  if (target.kind === 'good') {
    state.hitsGood += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    const comboBonus = Math.min(12, Math.floor(state.streak / 3) * 2);
    const gain = 10 + comboBonus;
    state.score += gain;
    createFx(cx, cy, `+${gain}`, '#86efac');
    playSfx('good');
    updateHint('เยี่ยมมาก! เก็บของดีต่อไป');

    logGameEvent('target_hit_good', {
      targetId: target.id,
      emoji: target.emoji || '',
      itemType: 'good',
      judgment: 'hit',
      isGood: true,
      gain,
      comboBonus,
      x: Math.round(cx),
      y: Math.round(cy)
    });
  } else if (target.kind === 'junk' || target.kind === 'storm') {
    state.hitsBad += 1;
    state.miss += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - 8);
    noteMistakeNow();

    if (target.kind === 'storm') {
      state.research.stormHits += 1;
    }

    createFx(cx, cy, 'MISS', '#fda4af');
    playSfx('junk');
    updateHint(target.kind === 'storm'
      ? 'อย่ากด junk storm! รอ weak spot แล้วโจมตี'
      : 'ระวัง junk! แตะของดีแทน');

    logGameEvent(target.kind === 'storm' ? 'target_hit_storm' : 'target_hit_junk', {
      targetId: target.id,
      emoji: target.emoji || '',
      itemType: target.kind === 'storm' ? 'storm' : 'junk',
      judgment: 'hit-bad',
      isGood: false,
      penalty: 8,
      stormHits: state.research.stormHits,
      x: Math.round(cx),
      y: Math.round(cy)
    });
  } else if (target.kind === 'weakspot') {
    const spec = getBossPatternSpec();
    const damage = spec.damage || 1;

    state.powerHits += 1;
    state.research.weakspotHit += 1;
    state.research.patternWeakHits[getPatternKey()] += 1;
    state.boss.hp = Math.max(0, state.boss.hp - damage);
    state.score += damage >= 2 ? 24 : 15;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    maybeTriggerBossComboReward();

    createFx(cx, cy, damage >= 2 ? 'CRUSH HIT!' : 'POWER HIT!', '#fde68a');
    triggerBossHitFeedback(damage);
    playSfx(damage >= 2 ? 'boss-crush' : 'boss-hit');

    const stunBonus = getBossBase().stunBonusMs || 0;

    if (damage >= 2) {
      startBossStun(620 + stunBonus, 'เกราะแตก! บอสชะงัก');
    } else {
      startBossStun(220 + stunBonus, 'โดนจัง ๆ');
    }

    updateHint(state.boss.hp > 0
      ? (damage >= 2 ? 'แรงมาก! ตอนนี้บอสชะงักอยู่' : 'โดนแล้ว! รีบตามจังหวะต่อ')
      : 'Junk King ถูกล้มแล้ว!');

    logGameEvent('weakspot_hit', {
      targetId: target.id,
      emoji: target.emoji || '🎯',
      itemType: 'weakspot',
      judgment: damage >= 2 ? 'crush-hit' : 'power-hit',
      isGood: true,
      damage,
      weakspotHit: state.research.weakspotHit,
      weakspotHitRatePct: getWeakspotHitRatePct(),
      patternKey: getPatternKey(),
      bossHpAfter: state.boss.hp,
      x: Math.round(cx),
      y: Math.round(cy)
    });

    removeTarget(id);

    if (state.boss.hp <= 0) {
      state.score += getBossClearBonus();
      renderHud();
      beginBossDefeatSequence();
      return;
    }
  }

  removeTarget(id);
  renderHud();
}

function registerMissedGood(target) {
  state.missedGood += 1;
  state.miss += 1;
  state.streak = 0;
  noteMistakeNow();
  createFx(target.x + target.w / 2, Math.max(24, target.y), 'พลาดของดี', '#fbbf24');
  playSfx('miss-good');
  updateHint('มีของดีหลุดไปแล้ว รีบเก็บชิ้นต่อไป');
  removeTarget(target.id);
  renderHud();

  logGameEvent('target_missed_good', {
    targetId: target.id,
    emoji: target.emoji || '',
    itemType: 'good',
    judgment: 'missed-good',
    isGood: true,
    missedGood: state.missedGood,
    miss: state.miss,
    x: Math.round(target.x + target.w / 2),
    y: Math.round(target.y)
  });
}

function checkPhaseProgress() {
  if (state.boss.active || state.ended || state.finishing) return;

  if (state.phase === 1 && state.score >= getPhaseGoal(1)) {
    enterPhase2();
    return;
  }

  if (state.phase === 2 && state.score >= getPhaseGoal(2)) {
    enterBossPhase();
  }
}

function clearTargets() {
  state.targets.forEach((target) => target.el.remove());
  state.targets.clear();
  state.boss.weakspotId = '';
}

function enterPhase2() {
  state.phase = 2;
  clearTargets();
  state.spawnAccum = 0;
  showBanner('PHASE 2', `เร็วขึ้น • junk มากขึ้น • เก็บให้ถึงเป้าหมาย ${getPhaseGoal(2)}`, 1400);
  updateHint('Phase 2 เริ่มแล้ว! อ่านเป้าให้แม่นและอย่ารีบกดผิด');
  renderHud();

  logGameEvent('phase_transition', {
    toPhase: 2,
    goalNow: getPhaseGoal(2)
  });
}

function enterBossPhase() {
  state.phase = 3;
  state.boss.active = true;
  state.research.reachedBossAtMs = getElapsedMs();
  state.research.bossStartTimeLeftMs = state.timeLeftMs;

  clearTargets();
  state.spawnAccum = 0;
  state.boss.hp = state.boss.maxHp;
  state.boss.enrage = false;
  state.boss.stormAccum = 0;
  state.boss.weakTick = 0;
  ui.bossWrap?.classList.add('show');

  applyBossPattern(0);
  state.boss.patternTimeLeft = 3200;
  syncBossStage(true);

  showBanner(
    'BOSS PHASE',
    `โหมดเวลา ${getRunTimeSeconds()} วินาที • อ่านสัญญาณเตือน แล้วแตะเป้าทองเพื่อโจมตี Junk King`,
    1700
  );
  updateHint('รอเป้าทอง แล้วแตะให้แม่น');
  renderHud();

  logGameEvent('boss_enter', {
    reachedBossAtMs: state.research.reachedBossAtMs,
    bossHpStart: state.boss.hp,
    timeBand: getTimeBand()
  });
}

function showBanner(title, sub, autoHideMs = 1200) {
  if (!ui.banner) return;
  const titleEl = ui.banner.querySelector('#gjpbBannerTitle');
  const subEl = ui.banner.querySelector('#gjpbBannerSub');
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;
  ui.banner.classList.remove('hide');
  if (autoHideMs > 0) {
    setTimeout(() => ui.banner?.classList.add('hide'), autoHideMs);
  }
}

function updateHint(message) {
  if (ui.hint) ui.hint.textContent = message;
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderHud() {
  if (ui.score) ui.score.textContent = String(state.score);
  if (ui.timer) ui.timer.textContent = formatTime(state.timeLeftMs);
  if (ui.miss) ui.miss.textContent = String(state.miss);
  if (ui.streak) ui.streak.textContent = String(state.streak);

  if (ui.phasePill) {
    ui.phasePill.textContent = state.boss.active ? 'BOSS PHASE' : `PHASE ${state.phase}`;
  }

  if (ui.goalText) {
    if (state.phase === 1) {
      ui.goalText.textContent = `GOAL สะสมคะแนน • เป้าหมาย ${getPhaseGoal(1)}`;
    } else if (state.phase === 2) {
      ui.goalText.textContent = `GOAL เร่งคะแนนต่อ • เป้าหมาย ${getPhaseGoal(2)}`;
    } else {
      ui.goalText.textContent = `GOAL โจมตี weak spot • HP เหลือ ${state.boss.hp}`;
    }
  }

  if (ui.progress) {
    const ratio = state.totalMs > 0 ? state.timeLeftMs / state.totalMs : 0;
    ui.progress.style.transform = `scaleX(${clamp(ratio, 0, 1)})`;
  }

  if (ui.stats) {
    ui.stats.innerHTML = `
      <div><strong>Good hit:</strong> ${state.hitsGood}</div>
      <div><strong>Junk hit:</strong> ${state.hitsBad}</div>
      <div><strong>Good missed:</strong> ${state.missedGood}</div>
      <div><strong>Power hit:</strong> ${state.powerHits}</div>
    `;
  }

  if (ui.bossName) ui.bossName.textContent = ui.bossWrap?.classList.contains('defeated') ? 'Junk King Down!' : 'Junk King';
  if (ui.bossHpText) ui.bossHpText.textContent = `${state.boss.hp} / ${state.boss.maxHp}`;
  if (ui.bossHpBar) {
    const hpRatio = state.boss.maxHp > 0 ? state.boss.hp / state.boss.maxHp : 0;
    ui.bossHpBar.style.transform = `scaleX(${clamp(hpRatio, 0, 1)})`;
  }
  if (ui.bossState) {
    if (!state.boss.active) {
      ui.bossState.textContent = 'รอเข้าสู่บอส';
    } else if (state.boss.telegraphMs > 0) {
      ui.bossState.textContent = `เตรียมท่า: ${getBossPatternName(state.boss.nextPatternIndex)}`;
    } else if (state.boss.enrage) {
      ui.bossState.textContent = `${state.boss.patternLabel} • ENRAGE`;
    } else {
      ui.bossState.textContent = state.boss.patternLabel;
    }
  }
  if (ui.bossStagePill) {
    const stage = getBossStage();
    const label = getBossStageConfig().label || 'LEARN';
    ui.bossStagePill.textContent = `STAGE ${stage} • ${label}`;
  }
}

function endGame(reason = 'finished') {
  if (state.ended) return;

  state.ended = true;
  state.running = false;
  cancelAnimationFrame(state.raf);
  clearTargets();

  const bossDefeated = reason === 'boss-defeated';
  const phaseReached = state.boss.active ? 'boss' : `phase-${state.phase}`;

  if (state.research.bossStartTimeLeftMs > 0) {
    state.research.bossDurationMs = Math.max(0, state.research.bossStartTimeLeftMs - state.timeLeftMs);
  } else {
    state.research.bossDurationMs = 0;
  }

  const summary = {
    version: PATCH_VERSION,
    source: 'goodjunk-solo-phaseboss-v2',
    gameId: GJ_GAME_ID,
    mode: 'solo',
    pid: GJ_PID,
    name: GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    diff: state.diff,
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    seed: RUN_CTX.seed || '',
    roomId: '',
    reason,
    phaseReached,
    bossDefeated,
    score: state.score,
    miss: state.miss,
    bestStreak: state.bestStreak,
    hitsGood: state.hitsGood,
    hitsBad: state.hitsBad,
    missedGood: state.missedGood,
    powerHits: state.powerHits,
    spawnedGood: state.spawnedGood,
    spawnedJunk: state.spawnedJunk,
    bossEntered: state.research.reachedBossAtMs > 0 || phaseReached === 'boss' || bossDefeated,
    bossHpRemaining: state.boss.hp,
    bossPatternLast: state.boss.patternLabel,
    bossEnraged: state.boss.enrage,
    bossVictoryShown: state.finishing,
    bossStuns: state.bossStuns,
    bossStageFinal: getBossStage(),
    phaseGoal1: getPhaseGoal(1),
    phaseGoal2: getPhaseGoal(2),
    timeBand: getTimeBand(),
    reachedBossAtMs: state.research.reachedBossAtMs,
    bossDurationMs: state.research.bossDurationMs,
    weakspotSpawned: state.research.weakspotSpawned,
    weakspotHit: state.research.weakspotHit,
    weakspotHitRatePct: getWeakspotHitRatePct(),
    stormSpawned: state.research.stormSpawned,
    stormHits: state.research.stormHits,
    stormAvoidRatePct: getStormAvoidRatePct(),
    patternStarts: { ...state.research.patternStarts },
    patternWeakHits: { ...state.research.patternWeakHits },
    updatedAt: Date.now()
  };

  logGameEvent('session_end', {
    reason,
    bossDefeated,
    phaseReached,
    weakspotHitRatePct: getWeakspotHitRatePct(),
    stormAvoidRatePct: getStormAvoidRatePct(),
    bossDurationMs: state.research.bossDurationMs
  });

  state.summaryPayload = summary;
  persistSummary(summary);
  persistSoloBossReward(summary);
  logSessionSummary(summary);
  showSummary(summary);
}

function getBossOutcomeLabel(summary) {
  if (summary.bossDefeated) return 'Boss Clear';
  if (summary.phaseReached === 'boss') return 'Reached Boss';
  if (summary.phaseReached === 'phase-2') return 'Reached Phase 2';
  return 'Reached Phase 1';
}

function getSoloBossStars(summary) {
  if (summary.bossDefeated && summary.miss <= 6 && summary.weakspotHitRatePct >= 65) return 3;
  if (summary.bossDefeated || summary.phaseReached === 'boss') return 2;
  return 1;
}

function getSoloBossReason(summary) {
  if (summary.bossDefeated && summary.weakspotHitRatePct >= 70) return 'แม่นจุดอ่อนมาก';
  if (summary.stormAvoidRatePct >= 75) return 'หลบ Junk Storm ดีมาก';
  if (summary.bestStreak >= 8) return 'รักษาคอมโบได้ยอดเยี่ยม';
  if (summary.phaseReached === 'boss') return 'อ่านเกมจนถึงบอสได้แล้ว';
  return 'เริ่มต้นได้ดี';
}

function showSummary(summary) {
  if (!ui.summary || !ui.summaryGrid) return;

  const stars = getSoloBossStars(summary);
  const reason = getSoloBossReason(summary);

  const title = summary.bossDefeated
    ? 'เยี่ยมมาก! ปราบ Junk King ได้แล้ว'
    : summary.phaseReached === 'boss'
      ? 'เกือบชนะแล้ว! ถึงบอสแล้ว'
      : summary.phaseReached === 'phase-2'
        ? 'ผ่านด่านก่อนบอสแล้ว'
        : 'เริ่มต้นได้ดีมาก';

  const sub = summary.bossDefeated
    ? `วันนี้เด่นเรื่อง “${reason}” • ได้ ${stars} ดาว`
    : `วันนี้เด่นเรื่อง “${reason}” • รอบหน้าไปได้อีกไกล`;

  ui.summaryTitle.textContent = title;
  ui.summarySub.textContent = sub;

  ui.summaryGrid.innerHTML = `
    <div class="gjpb-summary-item">
      <div class="label">Stars</div>
      <div class="value">${'⭐'.repeat(stars)}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">ผลงานเด่น</div>
      <div class="value">${escapeHtml(reason)}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">คะแนน</div>
      <div class="value">${summary.score}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Miss</div>
      <div class="value">${summary.miss}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Best Streak</div>
      <div class="value">${summary.bestStreak}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">ผลลัพธ์</div>
      <div class="value">${escapeHtml(getBossOutcomeLabel(summary))}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Weakspot Hit Rate</div>
      <div class="value">${summary.weakspotHitRatePct}%</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Storm Avoid Rate</div>
      <div class="value">${summary.stormAvoidRatePct}%</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Reached Boss At</div>
      <div class="value">${summary.reachedBossAtMs ? Math.round(summary.reachedBossAtMs / 1000) + 's' : '-'}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Boss Duration</div>
      <div class="value">${summary.bossDurationMs ? Math.round(summary.bossDurationMs / 1000) + 's' : '-'}</div>
    </div>
  `;

  ui.summary.hidden = false;
}

function buildReplayUrl() {
  const url = new URL('./goodjunk-vr.html', location.href);
  url.searchParams.set('pid', GJ_PID);
  url.searchParams.set('name', GJ_NAME);
  url.searchParams.set('studyId', RUN_CTX.studyId || '');
  url.searchParams.set('diff', state.diff);
  url.searchParams.set('time', String(Number(RUN_CTX.time || 150)));
  url.searchParams.set('seed', String(Date.now()));
  url.searchParams.set('hub', GJ_HUB);
  url.searchParams.set('view', RUN_CTX.view || 'mobile');
  url.searchParams.set('run', RUN_CTX.run || 'play');
  url.searchParams.set('gameId', GJ_GAME_ID);
  url.searchParams.set('mode', 'solo');
  return url.toString();
}

function buildCooldownUrl() {
  const gate = new URL('../warmup-gate.html', location.href);
  gate.searchParams.set('phase', 'cooldown');
  gate.searchParams.set('game', 'goodjunk');
  gate.searchParams.set('gameId', 'goodjunk');
  gate.searchParams.set('theme', 'goodjunk');
  gate.searchParams.set('cat', 'nutrition');
  gate.searchParams.set('zone', 'nutrition');
  gate.searchParams.set('pid', GJ_PID);
  gate.searchParams.set('name', GJ_NAME);
  gate.searchParams.set('studyId', RUN_CTX.studyId || '');
  gate.searchParams.set('diff', state.diff);
  gate.searchParams.set('time', String(Number(RUN_CTX.time || 150)));
  gate.searchParams.set('seed', RUN_CTX.seed || String(Date.now()));
  gate.searchParams.set('hub', GJ_HUB);
  gate.searchParams.set('view', RUN_CTX.view || 'mobile');
  gate.searchParams.set('run', RUN_CTX.run || 'play');
  gate.searchParams.set('forcegate', '1');
  return gate.toString();
}

function persistSummary(summary) {
  try {
    localStorage.setItem(GJ_SOLO_LAST_SUMMARY_KEY, JSON.stringify(summary));
  } catch {}

  try {
    const raw = localStorage.getItem(GJ_SOLO_SUMMARY_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(list) ? list : [];
    next.unshift(summary);
    localStorage.setItem(GJ_SOLO_SUMMARY_HISTORY_KEY, JSON.stringify(next.slice(0, 30)));
  } catch {}

  try {
    localStorage.setItem(HHA_LAST_SUMMARY_KEY, JSON.stringify({
      source: summary.source,
      gameId: summary.gameId,
      title: 'GoodJunk Solo Phase Boss v2',
      mode: summary.mode,
      pid: summary.pid,
      studyId: summary.studyId,
      roomId: summary.roomId,
      score: summary.score,
      miss: summary.miss,
      streak: summary.bestStreak,
      rank: null,
      finishType: summary.bossDefeated ? 'boss-defeated' : 'normal',
      dnfReason: '',
      playerCount: 1,
      allFinished: true,
      raceStatusFinal: 'solo',
      updatedAt: summary.updatedAt
    }));
  } catch {}

  try {
    const raw = localStorage.getItem(HHA_SUMMARY_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(list) ? list : [];
    next.unshift(summary);
    localStorage.setItem(HHA_SUMMARY_HISTORY_KEY, JSON.stringify(next.slice(0, 40)));
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent('gj:solo-summary', { detail: summary }));
    window.dispatchEvent(new CustomEvent('hha:solo-summary', { detail: summary }));
  } catch {}
}

function persistSoloBossReward(summary) {
  const stars = getSoloBossStars(summary);
  const reward = {
    updatedAt: Date.now(),
    pid: GJ_PID,
    stars,
    bossDefeated: !!summary.bossDefeated,
    bestStreak: summary.bestStreak || 0,
    weakspotHitRatePct: summary.weakspotHitRatePct || 0,
    stormAvoidRatePct: summary.stormAvoidRatePct || 0,
    score: summary.score || 0
  };

  try {
    localStorage.setItem(GJ_SOLO_BOSS_REWARD_KEY, JSON.stringify(reward));
  } catch {}
}

function playTone(freq = 440, duration = 0.08, type = 'triangle', gainValue = 0.028) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!playTone._ctx) playTone._ctx = new AC();
    const ctx = playTone._ctx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainValue;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  } catch {}
}

function playSfx(kind = 'good') {
  if (kind === 'good') {
    playTone(700, 0.05, 'triangle', 0.018);
    setTimeout(() => playTone(880, 0.05, 'triangle', 0.014), 35);
    return;
  }

  if (kind === 'junk') {
    playTone(220, 0.08, 'sawtooth', 0.018);
    return;
  }

  if (kind === 'miss-good') {
    playTone(300, 0.06, 'square', 0.015);
    setTimeout(() => playTone(220, 0.07, 'square', 0.014), 40);
    return;
  }

  if (kind === 'boss-hit') {
    playTone(560, 0.06, 'square', 0.02);
    setTimeout(() => playTone(760, 0.07, 'triangle', 0.018), 40);
    return;
  }

  if (kind === 'boss-crush') {
    playTone(520, 0.07, 'square', 0.024);
    setTimeout(() => playTone(740, 0.09, 'triangle', 0.02), 45);
    setTimeout(() => playTone(980, 0.09, 'triangle', 0.018), 95);
    return;
  }

  if (kind === 'boss-clear') {
    playTone(784, 0.10, 'triangle', 0.03);
    setTimeout(() => playTone(988, 0.12, 'triangle', 0.03), 110);
    setTimeout(() => playTone(1174, 0.16, 'triangle', 0.032), 240);
  }
}

function triggerBossHitFeedback(damage = 1) {
  if (ui.root) {
    ui.root.classList.remove('gjpb-shake');
    void ui.root.offsetWidth;
    ui.root.classList.add('gjpb-shake');
    setTimeout(() => ui.root?.classList.remove('gjpb-shake'), 260);
  }

  if (ui.bossWrap) {
    ui.bossWrap.classList.add('flash');
    setTimeout(() => ui.bossWrap?.classList.remove('flash'), 220);
  }

  if (damage >= 2) {
    showBanner('โดนจุดอ่อนแรง!', 'ตอนนี้ตีเข้าแรงมาก เยี่ยมเลย', 520);
  }
}

function startBossStun(ms = 300, label = 'STUN!') {
  state.boss.stunMs = Math.max(state.boss.stunMs, ms);
  state.bossStuns += 1;
  ui.stage?.classList.add('stunned');
  showBanner(label, 'บอสชะงักอยู่ชั่วครู่ รีบเตรียมจังหวะถัดไป', Math.min(ms, 700));
  setTimeout(() => ui.stage?.classList.remove('stunned'), ms + 40);

  logGameEvent('boss_stun', {
    stunMs: ms,
    bossStuns: state.bossStuns,
    label
  });
}

function spawnVictoryBurst(cx, cy, count = 18) {
  if (!ui.layer) return;
  const pool = ['✨','⭐','💥','🌟','🎉'];

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'gjpb-victory-burst';
    el.textContent = pool[Math.floor(rand() * pool.length)];
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;

    const tx = `${randRange(-180, 180)}px`;
    const ty = `${randRange(-160, 120)}px`;
    el.style.setProperty('--tx', tx);
    el.style.setProperty('--ty', ty);

    ui.layer.appendChild(el);
    setTimeout(() => el.remove(), 940);
  }
}

function beginBossDefeatSequence() {
  if (state.finishing) return;
  state.finishing = true;
  state.running = false;
  cancelAnimationFrame(state.raf);
  clearTargets();

  const cx = state.rect.width / 2;
  const cy = Math.max(120, state.rect.height / 2);

  ui.bossWrap?.classList.add('flash');
  ui.bossWrap?.classList.add('defeated');
  ui.stage?.classList.remove('stunned');
  clearTelegraphTheme();

  if (ui.bossIcon) ui.bossIcon.textContent = '💫';
  if (ui.bossName) ui.bossName.textContent = 'Junk King Down!';
  if (ui.bossState) ui.bossState.textContent = 'แพ้แล้ว • ทางสะอาดขึ้นแล้ว';

  showBanner('Junk King แพ้แล้ว!', 'ยอดเยี่ยม! คุณผ่านบอสสำเร็จ', 900);
  updateHint('ชนะบอสแล้ว กำลังเข้าสู่หน้าสรุปผล');

  logGameEvent('boss_defeat_sequence_start', {
    bossHpRemaining: state.boss.hp,
    bossDurationMs: state.research.bossStartTimeLeftMs > 0
      ? Math.max(0, state.research.bossStartTimeLeftMs - state.timeLeftMs)
      : 0
  });

  playSfx('boss-clear');

  spawnVictoryBurst(cx, cy, 20);
  setTimeout(() => spawnVictoryBurst(cx, cy, 14), 180);

  setTimeout(() => {
    endGame('boss-defeated');
  }, 900);
}

function makeResearchSnapshot(summary) {
  let eventQueue = [];
  let summaryQueue = [];
  let eventRows = [];
  let sessionRows = [];

  try {
    const raw = localStorage.getItem(HHA_EVENT_QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    eventQueue = Array.isArray(arr) ? arr.filter(x => x.sessionId === SESSION_ID) : [];
  } catch {}

  try {
    const raw = localStorage.getItem(HHA_SESSION_SUMMARY_QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    summaryQueue = Array.isArray(arr) ? arr.filter(x => x.sessionId === SESSION_ID) : [];
  } catch {}

  try {
    const raw = localStorage.getItem(HHA_EVENTS_SCHEMA_QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    eventRows = Array.isArray(arr) ? arr.filter(x => x.sessionId === SESSION_ID) : [];
  } catch {}

  try {
    const raw = localStorage.getItem(HHA_SESSIONS_SCHEMA_QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    sessionRows = Array.isArray(arr) ? arr.filter(x => x.sessionId === SESSION_ID) : [];
  } catch {}

  return {
    identity: {
      pid: summary.pid,
      name: summary.name,
      studyId: summary.studyId,
      mode: summary.mode,
      diff: summary.diff,
      timeBand: summary.timeBand,
      sessionId: SESSION_ID
    },
    performance: {
      score: summary.score,
      miss: summary.miss,
      bestStreak: summary.bestStreak,
      hitsGood: summary.hitsGood,
      hitsBad: summary.hitsBad,
      missedGood: summary.missedGood,
      powerHits: summary.powerHits
    },
    boss: {
      bossEntered: summary.bossEntered,
      bossDefeated: summary.bossDefeated,
      bossHpRemaining: summary.bossHpRemaining,
      bossDurationMs: summary.bossDurationMs,
      reachedBossAtMs: summary.reachedBossAtMs,
      bossStuns: summary.bossStuns,
      bossPatternLast: summary.bossPatternLast,
      bossStageFinal: summary.bossStageFinal
    },
    precision: {
      weakspotSpawned: summary.weakspotSpawned,
      weakspotHit: summary.weakspotHit,
      weakspotHitRatePct: summary.weakspotHitRatePct,
      stormSpawned: summary.stormSpawned,
      stormHits: summary.stormHits,
      stormAvoidRatePct: summary.stormAvoidRatePct
    },
    patterns: {
      patternStarts: summary.patternStarts,
      patternWeakHits: summary.patternWeakHits
    },
    raw: {
      eventQueue,
      summaryQueue,
      eventRows,
      sessionRows
    },
    meta: {
      updatedAt: summary.updatedAt,
      source: summary.source,
      version: summary.version,
      patchVersion: PATCH_VERSION
    }
  };
}

function downloadJson(payload, filename) {
  if (!payload) return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `goodjunk-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFilePart(value) {
  return String(value || 'file').replace(/[^a-z0-9_-]/gi, '-');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function createFx(x, y, text, color) {
  const fx = document.createElement('div');
  fx.className = 'gjpb-fx';
  fx.style.left = `${x}px`;
  fx.style.top = `${y}px`;
  fx.style.color = color || '#e5e7eb';
  fx.textContent = text;
  ui.layer?.appendChild(fx);
  setTimeout(() => fx.remove(), 760);
}