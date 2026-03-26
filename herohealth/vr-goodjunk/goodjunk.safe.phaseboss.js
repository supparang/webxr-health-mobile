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
const STYLE_ID = 'goodjunk-phaseboss-style-v20260326';
const ROOT_ID = 'gjpbRoot';

const GJ_SOLO_LAST_SUMMARY_KEY = `GJ_SOLO_LAST_SUMMARY_${GJ_PID}`;
const GJ_SOLO_SUMMARY_HISTORY_KEY = `GJ_SOLO_SUMMARY_HISTORY_${GJ_PID}`;
const HHA_LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
const HHA_SUMMARY_HISTORY_KEY = 'HHA_SUMMARY_HISTORY';
const HHA_EVENT_QUEUE_KEY = 'HHA_EVENT_QUEUE';
const HHA_SESSION_SUMMARY_QUEUE_KEY = 'HHA_SESSION_SUMMARY_QUEUE';
const HHA_EVENTS_SCHEMA_QUEUE_KEY = 'HHA_EVENTS_SCHEMA_QUEUE';
const HHA_SESSIONS_SCHEMA_QUEUE_KEY = 'HHA_SESSIONS_SCHEMA_QUEUE';

const SESSION_ID = `gjsolo-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const PATCH_VERSION = '20260326-goodjunk-solo-theme-pack4';
const HHA_ENDPOINT = String(__qs.get('api') || window.HHA_CLOUD_ENDPOINT || '').trim();

let __cloudLogger = null;
let __cloudSessionStarted = false;

console.log('[GJ-CLOUD] phaseboss patch loaded', {
  patch: PATCH_VERSION,
  endpoint: HHA_ENDPOINT,
  hasFactory: typeof window.createHHACloudLogger === 'function'
});

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
  easy:   { 1: 50, 2: 130 },
  normal: { 1: 65, 2: 165 },
  hard:   { 1: 80, 2: 205 }
};

const DIFF_PRESET = {
  easy: {
    p1: { spawnMs: 900, goodRatio: 0.76, speedMin: 86, speedMax: 138, sizeMin: 66, sizeMax: 90 },
    p2: { spawnMs: 740, goodRatio: 0.67, speedMin: 112, speedMax: 178, sizeMin: 62, sizeMax: 86 },
    boss: {
      hp: 9,
      stormMs: 1060,
      weakSpeed: 118,
      weakMoveMs: 1420,
      weakSize: 92,
      stunBonusMs: 120,
      clearBonus: 50,
      stormBurst: 4,
      enrageStormPenalty: 90
    }
  },

  normal: {
    p1: { spawnMs: 760, goodRatio: 0.68, speedMin: 105, speedMax: 165, sizeMin: 60, sizeMax: 84 },
    p2: { spawnMs: 610, goodRatio: 0.57, speedMin: 135, speedMax: 225, sizeMin: 56, sizeMax: 78 },
    boss: {
      hp: 13,
      stormMs: 820,
      weakSpeed: 165,
      weakMoveMs: 1100,
      weakSize: 76,
      stunBonusMs: 0,
      clearBonus: 40,
      stormBurst: 5,
      enrageStormPenalty: 120
    }
  },

  hard: {
    p1: { spawnMs: 650, goodRatio: 0.60, speedMin: 126, speedMax: 198, sizeMin: 56, sizeMax: 78 },
    p2: { spawnMs: 500, goodRatio: 0.48, speedMin: 168, speedMax: 276, sizeMin: 52, sizeMax: 72 },
    boss: {
      hp: 18,
      stormMs: 620,
      weakSpeed: 230,
      weakMoveMs: 860,
      weakSize: 64,
      stunBonusMs: -40,
      clearBonus: 32,
      stormBurst: 6,
      enrageStormPenalty: 150
    }
  }
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
  summary: null,
  summaryTitle: null,
  summarySub: null,
  summaryGrid: null,
  btnAgain: null,
  btnCooldown: null,
  btnHub: null,
  btnExport: null,
  rewardCoins: null,
  rewardStars: null,
  rewardBadge: null,
  summaryRibbon: null,
  summaryScoreValue: null,
  stageBadge: null,
  playerAvatar: null,
  playerName: null,
  playerSub: null,
  levelBadge: null,
  miniMission: null,
  summaryHeroAvatar: null,
  summaryHeroName: null,
  summaryHeroDesc: null,
  hubTitle: null,
  hubDesc: null
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
    victoryShown: false
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
  injectThemePack4Extras();
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

      --hh-sky:#dff4ff;
      --hh-sky-2:#bfe8ff;
      --hh-cream:#fff9e8;
      --hh-card:#fffdf6;
      --hh-card-2:#f7fff3;
      --hh-line:#bfe3f2;
      --hh-text:#4d4a42;
      --hh-muted:#7c7a73;
      --hh-green:#7ed957;
      --hh-green-2:#58c33f;
      --hh-blue:#7fcfff;
      --hh-blue-2:#58b7f5;
      --hh-yellow:#ffd45c;
      --hh-orange:#ffb547;
      --hh-pink:#ffa9c9;
      --hh-danger:#ff9494;
      --hh-shadow:0 18px 40px rgba(86,155,194,.18);

      color:var(--hh-text);
      background:
        radial-gradient(circle at 12% 10%, rgba(255,255,255,.92), transparent 18%),
        radial-gradient(circle at 84% 14%, rgba(255,255,255,.78), transparent 16%),
        linear-gradient(180deg,var(--hh-sky),var(--hh-sky-2) 54%, var(--hh-cream));
    }

    .gjpb-shell{
      position:absolute;
      inset:0;
      display:grid;
      grid-template-rows:auto auto auto 1fr auto;
      gap:12px;
      padding:
        calc(12px + env(safe-area-inset-top,0px))
        calc(12px + env(safe-area-inset-right,0px))
        calc(12px + env(safe-area-inset-bottom,0px))
        calc(12px + env(safe-area-inset-left,0px));
    }

    .gjpb-topbar{
      display:flex;
      justify-content:space-between;
      gap:12px;
      flex-wrap:wrap;
      align-items:flex-start;
      z-index:3;
    }

    .gjpb-chip-row{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      width:100%;
    }

    .gjpb-chip{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:10px 14px;
      border-radius:999px;
      border:2px solid var(--hh-line);
      background:#fff;
      box-shadow:0 10px 22px rgba(86,155,194,.12);
      font-size:13px;
      font-weight:1000;
      color:var(--hh-text);
    }

    .gjpb-chip span{
      color:#6fa6c4;
      font-weight:1000;
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
      padding:11px 16px;
      border-radius:999px;
      border:2px solid var(--hh-line);
      background:linear-gradient(180deg,#fffef8,#f7fff5);
      box-shadow:0 10px 22px rgba(86,155,194,.12);
      font-size:13px;
      font-weight:1000;
      color:var(--hh-text);
    }

    .gjpb-stage{
      position:relative;
      min-height:340px;
      border:3px solid var(--hh-line);
      border-radius:30px;
      overflow:hidden;
      background:
        linear-gradient(180deg, #dff4ff 0%, #d8f1ff 48%, #fdf4ce 100%);
      box-shadow:var(--hh-shadow);
      isolation:isolate;
    }

    .gjpb-stage::before{
      content:"";
      position:absolute;
      inset:0;
      pointer-events:none;
      background:
        radial-gradient(circle at 16% 12%, rgba(255,255,255,.95), transparent 12%),
        radial-gradient(circle at 78% 16%, rgba(255,255,255,.82), transparent 10%),
        linear-gradient(180deg, rgba(255,255,255,.25), transparent 30%);
      z-index:0;
    }

    .gjpb-stars{
      position:absolute;
      inset:0;
      background-image:
        radial-gradient(circle at 10% 15%, rgba(255,255,255,.95) 0 2px, transparent 2.5px),
        radial-gradient(circle at 28% 68%, rgba(255,255,255,.72) 0 2px, transparent 2.5px),
        radial-gradient(circle at 44% 24%, rgba(255,255,255,.86) 0 2px, transparent 2.5px),
        radial-gradient(circle at 72% 38%, rgba(255,255,255,.72) 0 2px, transparent 2.5px),
        radial-gradient(circle at 82% 72%, rgba(255,255,255,.78) 0 2px, transparent 2.5px),
        radial-gradient(circle at 90% 20%, rgba(255,255,255,.66) 0 2px, transparent 2.5px);
      opacity:.88;
      z-index:0;
      pointer-events:none;
    }

    .gjpb-scene{
      position:absolute;
      inset:0;
      z-index:0;
      pointer-events:none;
      overflow:hidden;
    }

    .gjpb-cloud{
      position:absolute;
      border-radius:999px;
      background:rgba(255,255,255,.82);
      filter:blur(.2px);
      box-shadow:0 6px 18px rgba(255,255,255,.28);
    }

    .gjpb-cloud.c1{ width:120px; height:34px; left:7%; top:11%; }
    .gjpb-cloud.c2{ width:86px; height:28px; left:23%; top:18%; }
    .gjpb-cloud.c3{ width:132px; height:36px; right:12%; top:13%; }
    .gjpb-cloud.c4{ width:94px; height:30px; right:28%; top:22%; }

    .gjpb-cloud::before,
    .gjpb-cloud::after{
      content:"";
      position:absolute;
      border-radius:999px;
      background:inherit;
    }

    .gjpb-cloud::before{
      width:42%;
      height:130%;
      left:12%;
      bottom:30%;
    }

    .gjpb-cloud::after{
      width:38%;
      height:115%;
      right:12%;
      bottom:20%;
    }

    .gjpb-hill{
      position:absolute;
      left:-5%;
      right:-5%;
      border-radius:999px;
      background:linear-gradient(180deg,#b9ed8b,#8fdb61);
    }

    .gjpb-hill.h1{
      bottom:10%;
      height:28%;
      z-index:0;
    }

    .gjpb-hill.h2{
      bottom:3%;
      height:24%;
      background:linear-gradient(180deg,#8cde66,#66c746);
      z-index:0;
    }

    .gjpb-path{
      position:absolute;
      left:50%;
      bottom:-8%;
      width:36%;
      height:34%;
      transform:translateX(-50%);
      background:linear-gradient(180deg,#fff6d7,#efd69b);
      border-radius:50% 50% 0 0/65% 65% 0 0;
      opacity:.85;
      z-index:0;
    }

    .gjpb-stage-badge{
      position:absolute;
      right:14px;
      bottom:14px;
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 12px;
      border-radius:999px;
      border:2px solid var(--hh-line);
      background:rgba(255,255,255,.92);
      color:#6a7b52;
      font-size:12px;
      font-weight:1000;
      z-index:2;
      box-shadow:0 10px 18px rgba(86,155,194,.1);
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
      width:min(88vw,560px);
      padding:18px 18px;
      border-radius:24px;
      border:3px solid var(--hh-line);
      background:linear-gradient(180deg,#fffdf6,#f6fff5);
      color:var(--hh-text);
      text-align:center;
      box-shadow:var(--hh-shadow);
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
      margin-top:8px;
      color:var(--hh-muted);
      font-size:14px;
      font-weight:900;
      line-height:1.55;
    }

    .gjpb-target{
      position:absolute;
      display:grid;
      place-items:center;
      border-radius:24px;
      border:2px solid rgba(255,255,255,.92);
      box-shadow:0 12px 24px rgba(93,155,196,.18);
      overflow:hidden;
      cursor:pointer;
      padding:0;
      transform:translate3d(0,0,0);
      z-index:2;
    }

    .gjpb-target.good{
      background:
        radial-gradient(circle at 30% 22%, rgba(255,255,255,.45), transparent 24%),
        linear-gradient(180deg, rgba(126,217,87,.88), rgba(95,198,63,.92));
      border-color:#efffe4;
    }

    .gjpb-target.junk,
    .gjpb-target.storm{
      background:
        radial-gradient(circle at 30% 22%, rgba(255,255,255,.35), transparent 24%),
        linear-gradient(180deg, rgba(255,177,71,.95), rgba(255,143,143,.92));
      border-color:#fff1eb;
    }

    .gjpb-target.weakspot{
      background:
        radial-gradient(circle at 30% 22%, rgba(255,255,255,.55), transparent 24%),
        linear-gradient(180deg, rgba(255,212,92,.98), rgba(255,181,71,.95));
      border-color:#fff8d6;
      box-shadow:0 0 0 6px rgba(255,212,92,.22), 0 16px 28px rgba(93,155,196,.2);
      animation: gjpb-weakspot-pulse .9s ease-in-out infinite;
    }

    @keyframes gjpb-weakspot-pulse{
      0%,100%{ box-shadow:0 0 0 0 rgba(255,212,92,.18), 0 16px 28px rgba(93,155,196,.2); }
      50%{ box-shadow:0 0 0 8px rgba(255,212,92,.18), 0 16px 28px rgba(93,155,196,.2); }
    }

    .gjpb-emoji{
      font-size:36px;
      line-height:1;
      filter:drop-shadow(0 5px 8px rgba(255,255,255,.28));
      transform:translateY(-2px);
      pointer-events:none;
    }

    .gjpb-tag{
      position:absolute;
      left:8px;
      right:8px;
      bottom:7px;
      text-align:center;
      font-size:10px;
      font-weight:1000;
      letter-spacing:.08em;
      text-transform:uppercase;
      color:#fffef8;
      text-shadow:0 1px 0 rgba(0,0,0,.12);
      pointer-events:none;
      white-space:nowrap;
    }

    .gjpb-fx{
      position:absolute;
      font-size:18px;
      font-weight:1000;
      pointer-events:none;
      transform:translate(-50%,-50%);
      text-shadow:0 3px 0 #fff;
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
      width:min(300px, calc(100% - 24px));
      border:3px solid var(--hh-line);
      border-radius:24px;
      background:linear-gradient(180deg,#fffdf8,#f8fff3);
      box-shadow:var(--hh-shadow);
      padding:12px;
      z-index:4;
      display:none;
      transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease;
    }

    .gjpb-bosswrap.show{ display:block; }

    .gjpb-boss-head{
      display:flex;
      align-items:center;
      gap:10px;
      margin-bottom:10px;
    }

    .gjpb-boss-icon{
      width:56px;
      height:56px;
      border-radius:18px;
      display:grid;
      place-items:center;
      font-size:28px;
      background:linear-gradient(180deg,#ffe4ae,#ffd077);
      border:2px solid #ffecc6;
      box-shadow:0 8px 18px rgba(255,181,71,.22);
      flex:0 0 auto;
    }

    .gjpb-boss-name{
      font-size:18px;
      font-weight:1000;
      margin:0;
      color:#67a91c;
    }

    .gjpb-boss-state{
      color:var(--hh-muted);
      font-size:12px;
      font-weight:1000;
      margin-top:2px;
    }

    .gjpb-boss-bar{
      height:16px;
      border-radius:999px;
      overflow:hidden;
      border:2px solid var(--hh-line);
      background:#eef9ff;
      margin-top:6px;
    }

    .gjpb-boss-barfill{
      height:100%;
      width:100%;
      transform-origin:left center;
      background:linear-gradient(90deg, var(--hh-yellow), var(--hh-orange));
      transition:transform .16s linear;
    }

    .gjpb-boss-hptext{
      margin-top:6px;
      color:var(--hh-text);
      font-size:12px;
      font-weight:1000;
      text-align:right;
    }

    .gjpb-bottom{ z-index:3; }

    .gjpb-bottom-card{
      border:3px solid var(--hh-line);
      border-radius:24px;
      padding:14px;
      background:linear-gradient(180deg,#fffef9,#f7fff4);
      box-shadow:var(--hh-shadow);
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
      color:var(--hh-text);
      font-size:14px;
      line-height:1.55;
      font-weight:1000;
    }

    .gjpb-stats{
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      color:var(--hh-muted);
      font-size:13px;
      line-height:1.55;
      font-weight:900;
    }

    .gjpb-stats strong{ color:#67a91c; }

    .gjpb-progress{
      position:relative;
      width:100%;
      height:16px;
      border-radius:999px;
      border:2px solid var(--hh-line);
      overflow:hidden;
      background:#eef9ff;
    }

    .gjpb-progress-bar{
      height:100%;
      width:100%;
      transform-origin:left center;
      background:linear-gradient(90deg,var(--hh-green),var(--hh-blue));
      transition:transform .1s linear;
    }

    .gjpb-reward-strip{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:12px;
    }

    .gjpb-reward-card{
      flex:1 1 160px;
      min-height:60px;
      display:flex;
      align-items:center;
      gap:10px;
      padding:10px 12px;
      border-radius:20px;
      border:2px solid var(--hh-line);
      background:#fff;
      box-shadow:0 8px 18px rgba(86,155,194,.08);
    }

    .gjpb-reward-icon{
      width:42px;
      height:42px;
      border-radius:14px;
      display:grid;
      place-items:center;
      font-size:22px;
      background:linear-gradient(180deg,#fff7d7,#eefaff);
      border:2px solid var(--hh-line);
      flex:0 0 auto;
    }

    .gjpb-reward-copy{
      display:grid;
      gap:2px;
    }

    .gjpb-reward-copy .label{
      font-size:11px;
      color:#79a9c4;
      font-weight:1000;
    }

    .gjpb-reward-copy .value{
      font-size:20px;
      color:var(--hh-text);
      font-weight:1000;
      line-height:1.1;
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
      background:rgba(183,233,255,.52);
      backdrop-filter:blur(8px);
      z-index:20;
    }

    .gjpb-summary[hidden]{
      display:none !important;
    }

    .gjpb-summary-card{
      width:min(94vw,780px);
      max-height:88vh;
      overflow:auto;
      border:3px solid var(--hh-line);
      border-radius:30px;
      background:linear-gradient(180deg,#fffef9,#f8fff4);
      box-shadow:0 24px 56px rgba(86,155,194,.18);
      padding:22px 18px 18px;
    }

    .gjpb-summary-kicker{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 14px;
      border-radius:999px;
      background:#eaf8ff;
      border:2px solid var(--hh-line);
      color:#5fa7cf;
      font-size:13px;
      font-weight:1000;
      margin-bottom:12px;
    }

    .gjpb-summary-ribbon{
      margin:8px auto 10px;
      width:min(100%, 520px);
      padding:14px 18px;
      border-radius:22px;
      background:linear-gradient(180deg,#7fcfff,#58b7f5);
      color:#fffef9;
      text-align:center;
      font-size:18px;
      font-weight:1000;
      box-shadow:0 14px 24px rgba(88,183,245,.22);
      position:relative;
    }

    .gjpb-summary-ribbon::before,
    .gjpb-summary-ribbon::after{
      content:"⭐";
      position:absolute;
      top:50%;
      transform:translateY(-50%);
      font-size:26px;
    }

    .gjpb-summary-ribbon::before{ left:14px; }
    .gjpb-summary-ribbon::after{ right:14px; }

    .gjpb-summary-title{
      margin:0 0 6px;
      font-size:clamp(28px,5vw,44px);
      line-height:1.06;
      font-weight:1000;
      color:#67a91c;
      text-shadow:0 2px 0 #fff;
      text-align:center;
    }

    .gjpb-summary-sub{
      margin:0;
      color:var(--hh-muted);
      font-size:14px;
      line-height:1.65;
      font-weight:900;
      text-align:center;
    }

    .gjpb-stars-row{
      display:flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      margin:16px 0 10px;
      font-size:42px;
      line-height:1;
    }

    .gjpb-star.on{ filter:drop-shadow(0 3px 0 rgba(255,255,255,.75)); }
    .gjpb-star.off{ opacity:.26; }

    .gjpb-summary-score{
      margin:0 auto 14px;
      width:min(100%, 420px);
      border-radius:24px;
      border:2px solid var(--hh-line);
      background:#fff;
      padding:14px 18px;
      text-align:center;
      box-shadow:0 8px 18px rgba(86,155,194,.08);
    }

    .gjpb-summary-score .label{
      color:#6ea8c7;
      font-size:13px;
      font-weight:1000;
      margin-bottom:6px;
    }

    .gjpb-summary-score .value{
      color:var(--hh-text);
      font-size:52px;
      font-weight:1000;
      line-height:1;
    }

    .gjpb-coach{
      display:flex;
      gap:12px;
      align-items:center;
      margin:14px 0 0;
      padding:14px;
      border-radius:22px;
      border:2px solid var(--hh-line);
      background:#fff;
    }

    .gjpb-coach-avatar{
      width:68px;
      height:68px;
      border-radius:18px;
      display:grid;
      place-items:center;
      font-size:34px;
      background:linear-gradient(180deg,#e8f8ff,#fff7d8);
      border:2px solid var(--hh-line);
      flex:0 0 auto;
    }

    .gjpb-coach-text{
      color:var(--hh-text);
      font-size:15px;
      line-height:1.55;
      font-weight:900;
    }

    .gjpb-summary-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
      margin-top:16px;
    }

    .gjpb-summary-item{
      border:2px solid var(--hh-line);
      border-radius:20px;
      padding:12px;
      background:#fff;
      box-shadow:0 8px 18px rgba(86,155,194,.08);
    }

    .gjpb-summary-item .label{
      color:#72a7c6;
      font-size:12px;
      font-weight:1000;
      margin-bottom:6px;
    }

    .gjpb-summary-item .value{
      color:var(--hh-text);
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
      border-radius:18px;
      padding:13px 16px;
      font-size:15px;
      font-weight:1000;
      transition:.12s ease;
      box-shadow:0 10px 18px rgba(86,155,194,.12);
    }

    .gjpb-btn:hover{ transform:translateY(-1px); filter:brightness(1.03); }
    .gjpb-btn:active{ transform:translateY(0); }

    .gjpb-btn.good{
      background:linear-gradient(180deg,var(--hh-green),var(--hh-green-2));
      color:#fffef8;
    }

    .gjpb-btn.blue{
      background:linear-gradient(180deg,var(--hh-blue),var(--hh-blue-2));
      color:#fffef8;
    }

    .gjpb-btn.warn{
      background:linear-gradient(180deg,var(--hh-yellow),var(--hh-orange));
      color:#6d4e00;
    }

    .gjpb-btn.ghost{
      background:linear-gradient(180deg,#edf8ff,#dbefff);
      color:#5d8eab;
      border:2px solid var(--hh-line);
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
      border-color:#ffe0a2;
      box-shadow:0 0 0 4px rgba(255,212,92,.18), var(--hh-shadow);
      transform:scale(1.02);
    }

    .gjpb-stage.stunned::after{
      content:"";
      position:absolute;
      inset:0;
      background:linear-gradient(180deg, rgba(255,212,92,.16), rgba(255,255,255,.06));
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
      text-shadow:0 2px 0 #fff;
    }

    @keyframes gjpb-victory-burst{
      from{ opacity:1; transform:translate(-50%,-50%) scale(.7); }
      to{ opacity:0; transform:translate(var(--tx), var(--ty)) scale(1.25); }
    }

    .gjpb-stage.telegraph-storm{
      box-shadow:0 0 0 4px rgba(255,169,201,.22), var(--hh-shadow);
    }

    .gjpb-stage.telegraph-storm::after{
      content:"";
      position:absolute;
      inset:0;
      background:linear-gradient(180deg, rgba(255,169,201,.16), transparent 40%);
      pointer-events:none;
      z-index:3;
    }

    .gjpb-stage.telegraph-break{
      box-shadow:0 0 0 4px rgba(255,212,92,.24), var(--hh-shadow);
    }

    .gjpb-stage.telegraph-break::after{
      content:"";
      position:absolute;
      inset:0;
      background:linear-gradient(180deg, rgba(255,212,92,.16), transparent 40%);
      pointer-events:none;
      z-index:3;
    }

    .gjpb-stage.telegraph-hunt{
      box-shadow:0 0 0 4px rgba(127,207,255,.24), var(--hh-shadow);
    }

    .gjpb-stage.telegraph-hunt::after{
      content:"";
      position:absolute;
      inset:0;
      background:linear-gradient(180deg, rgba(127,207,255,.16), transparent 40%);
      pointer-events:none;
      z-index:3;
    }

    .gjpb-bosswrap.defeated{
      border-color:#bde895;
      background:linear-gradient(180deg,#faffef,#f6fff1);
      transform:scale(1.03);
    }

    .gjpb-bosswrap.defeated .gjpb-boss-icon{
      background:linear-gradient(180deg,#dff7bf,#fff3c4);
      border-color:#d3efae;
    }

    @media (max-width:760px){
      .gjpb-shell{
        gap:10px;
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
      .gjpb-reward-card{
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
      .gjpb-coach{
        align-items:flex-start;
      }
      .gjpb-reward-card{
        flex:1 1 100%;
      }
      .gjpb-summary-score .value{
        font-size:42px;
      }
    }
  `;
  document.head.appendChild(style);
}

function injectThemePack4Extras() {
  const extraId = STYLE_ID + '-pack4';
  if (document.getElementById(extraId)) return;

  const style = document.createElement('style');
  style.id = extraId;
  style.textContent = `
    .gjpb-topdeck{
      display:grid;
      grid-template-columns:minmax(0,1fr) auto;
      gap:12px;
      align-items:start;
      z-index:4;
    }

    .gjpb-player-card{
      display:flex;
      align-items:center;
      gap:12px;
      min-width:0;
      padding:12px 14px;
      border-radius:24px;
      border:3px solid var(--hh-line);
      background:linear-gradient(180deg,#fffef8,#f7fff4);
      box-shadow:var(--hh-shadow);
    }

    .gjpb-player-avatar{
      width:64px;
      height:64px;
      border-radius:20px;
      display:grid;
      place-items:center;
      flex:0 0 auto;
      font-size:34px;
      background:linear-gradient(180deg,#e8f8ff,#fff7d8);
      border:2px solid var(--hh-line);
      box-shadow:0 8px 16px rgba(86,155,194,.12);
    }

    .gjpb-player-meta{
      min-width:0;
      display:grid;
      gap:2px;
    }

    .gjpb-player-kicker{
      color:#74a8c5;
      font-size:12px;
      font-weight:1000;
      line-height:1.2;
    }

    .gjpb-player-name{
      color:var(--hh-text);
      font-size:18px;
      font-weight:1000;
      line-height:1.15;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }

    .gjpb-player-sub{
      color:var(--hh-muted);
      font-size:12px;
      font-weight:900;
      line-height:1.25;
    }

    .gjpb-level-card{
      display:grid;
      gap:8px;
      justify-items:end;
    }

    .gjpb-level-badge{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:10px 14px;
      border-radius:999px;
      border:3px solid var(--hh-line);
      background:linear-gradient(180deg,#fffef7,#f7fff4);
      box-shadow:var(--hh-shadow);
      color:#6a6a61;
      font-size:13px;
      font-weight:1000;
    }

    .gjpb-level-badge strong{
      color:#67a91c;
      font-size:15px;
    }

    .gjpb-mini-mission{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 12px;
      border-radius:999px;
      border:2px solid var(--hh-line);
      background:#fff;
      color:#6f6d65;
      font-size:12px;
      font-weight:1000;
      box-shadow:0 8px 18px rgba(86,155,194,.08);
    }

    .gjpb-summary-hero{
      display:grid;
      grid-template-columns:110px 1fr;
      gap:14px;
      align-items:center;
      margin:0 0 14px;
      padding:14px;
      border-radius:24px;
      border:2px solid var(--hh-line);
      background:linear-gradient(180deg,#fffef8,#f7fff4);
      box-shadow:0 8px 18px rgba(86,155,194,.08);
    }

    .gjpb-summary-hero-avatar{
      width:110px;
      height:110px;
      border-radius:28px;
      display:grid;
      place-items:center;
      font-size:58px;
      background:linear-gradient(180deg,#e8f8ff,#fff7d8);
      border:3px solid var(--hh-line);
      box-shadow:0 10px 18px rgba(86,155,194,.1);
    }

    .gjpb-summary-hero-copy{
      display:grid;
      gap:6px;
      min-width:0;
    }

    .gjpb-summary-hero-copy .name{
      color:#67a91c;
      font-size:24px;
      font-weight:1000;
      line-height:1.08;
    }

    .gjpb-summary-hero-copy .desc{
      color:var(--hh-muted);
      font-size:14px;
      font-weight:900;
      line-height:1.55;
    }

    .gjpb-hub-card{
      margin-top:14px;
      padding:14px;
      border-radius:22px;
      border:2px solid var(--hh-line);
      background:#fff;
      box-shadow:0 8px 18px rgba(86,155,194,.08);
      display:flex;
      align-items:center;
      gap:12px;
    }

    .gjpb-hub-icon{
      width:54px;
      height:54px;
      border-radius:16px;
      display:grid;
      place-items:center;
      flex:0 0 auto;
      font-size:28px;
      background:linear-gradient(180deg,#e8f8ff,#fff7d8);
      border:2px solid var(--hh-line);
    }

    .gjpb-hub-copy{
      min-width:0;
      display:grid;
      gap:2px;
    }

    .gjpb-hub-copy .title{
      color:var(--hh-text);
      font-size:16px;
      font-weight:1000;
      line-height:1.15;
    }

    .gjpb-hub-copy .desc{
      color:var(--hh-muted);
      font-size:13px;
      font-weight:900;
      line-height:1.45;
    }

    .gjpb-summary-actions{
      margin-top:16px;
    }

    @media (max-width:760px){
      .gjpb-topdeck{
        grid-template-columns:1fr;
      }
      .gjpb-level-card{
        justify-items:start;
      }
      .gjpb-summary-hero{
        grid-template-columns:1fr;
        justify-items:center;
        text-align:center;
      }
      .gjpb-summary-hero-copy .name{
        font-size:22px;
      }
    }
  `;
  document.head.appendChild(style);
}

function buildShell() {
  GAME_MOUNT.innerHTML = `
    <div id="${ROOT_ID}">
      <div class="gjpb-shell">
        <div class="gjpb-topdeck">
          <div class="gjpb-player-card">
            <div class="gjpb-player-avatar" id="gjpbPlayerAvatar">🙂</div>
            <div class="gjpb-player-meta">
              <div class="gjpb-player-kicker">PLAYER</div>
              <div class="gjpb-player-name" id="gjpbPlayerName">${escapeHtml(GJ_NAME || GJ_PID || 'Food Hero')}</div>
              <div class="gjpb-player-sub" id="gjpbPlayerSub">พร้อมเริ่มภารกิจอาหารดี</div>
            </div>
          </div>

          <div class="gjpb-level-card">
            <div class="gjpb-level-badge">🏅 <span>Level</span> <strong id="gjpbLevelBadge">1</strong></div>
            <div class="gjpb-mini-mission" id="gjpbMiniMission">🌱 Beginner Food Hero</div>
          </div>
        </div>

        <div class="gjpb-topbar">
          <div class="gjpb-chip-row">
            <div class="gjpb-chip">🪙 <span>Score</span><strong id="gjpbScore">0</strong></div>
            <div class="gjpb-chip">⏰ <span>Time</span><strong id="gjpbTimer">0:00</strong></div>
            <div class="gjpb-chip">❤️ <span>Miss</span><strong id="gjpbMiss">0</strong></div>
            <div class="gjpb-chip">⭐ <span>Streak</span><strong id="gjpbStreak">0</strong></div>
          </div>
        </div>

        <div class="gjpb-phasebar">
          <div class="gjpb-phase-pill" id="gjpbPhasePill">Mission 1</div>
          <div class="gjpb-goal-pill" id="gjpbGoalText">เก็บอาหารดีให้ถึงเป้า</div>
        </div>

        <div class="gjpb-stage" id="gjpbStage">
          <div class="gjpb-scene">
            <div class="gjpb-cloud c1"></div>
            <div class="gjpb-cloud c2"></div>
            <div class="gjpb-cloud c3"></div>
            <div class="gjpb-cloud c4"></div>
            <div class="gjpb-hill h1"></div>
            <div class="gjpb-hill h2"></div>
            <div class="gjpb-path"></div>
          </div>

          <div class="gjpb-stars"></div>
          <div class="gjpb-layer" id="gjpbLayer"></div>

          <div class="gjpb-banner" id="gjpbBanner">
            <div id="gjpbBannerTitle">HeroHealth Food Mission</div>
            <small id="gjpbBannerSub">เก็บอาหารดี หลีกเลี่ยง junk food แล้วไปช่วยปราบ Junk King</small>
          </div>

          <div class="gjpb-bosswrap" id="gjpbBossWrap">
            <div class="gjpb-boss-head">
              <div class="gjpb-boss-icon">🍔</div>
              <div>
                <h3 class="gjpb-boss-name" id="gjpbBossName">Junk King</h3>
                <div class="gjpb-boss-state" id="gjpbBossState">รอเข้าสู่บอส</div>
              </div>
            </div>
            <div class="gjpb-boss-bar">
              <div class="gjpb-boss-barfill" id="gjpbBossHpBar"></div>
            </div>
            <div class="gjpb-boss-hptext" id="gjpbBossHpText">0 / 0</div>
          </div>

          <div class="gjpb-stage-badge" id="gjpbStageBadge">🌱 Healthy Town</div>
        </div>

        <div class="gjpb-bottom">
          <div class="gjpb-bottom-card">
            <div class="gjpb-bottom-top">
              <div class="gjpb-hint" id="gjpbHint">แตะอาหารดีให้เร็ว และอย่าแตะ junk food</div>
              <div class="gjpb-stats" id="gjpbStats">
                <div><strong>Good:</strong> 0</div>
                <div><strong>Junk:</strong> 0</div>
                <div><strong>Missed:</strong> 0</div>
                <div><strong>Power:</strong> 0</div>
              </div>
            </div>

            <div class="gjpb-progress">
              <div class="gjpb-progress-bar" id="gjpbProgressBar"></div>
            </div>

            <div class="gjpb-reward-strip">
              <div class="gjpb-reward-card">
                <div class="gjpb-reward-icon">🪙</div>
                <div class="gjpb-reward-copy">
                  <div class="label">Reward Coins</div>
                  <div class="value" id="gjpbRewardCoins">0</div>
                </div>
              </div>

              <div class="gjpb-reward-card">
                <div class="gjpb-reward-icon">⭐</div>
                <div class="gjpb-reward-copy">
                  <div class="label">Star Rank</div>
                  <div class="value" id="gjpbRewardStars">1</div>
                </div>
              </div>

              <div class="gjpb-reward-card">
                <div class="gjpb-reward-icon">🏅</div>
                <div class="gjpb-reward-copy">
                  <div class="label">Mission Badge</div>
                  <div class="value" id="gjpbRewardBadge">Start</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="gjpb-summary" id="gjpbSummary" hidden>
        <div class="gjpb-summary-card">
          <div class="gjpb-summary-kicker">🌟 GOODJUNK SOLO SUMMARY</div>
          <div class="gjpb-summary-ribbon" id="gjpbSummaryRibbon">Great Job!</div>

          <div class="gjpb-summary-hero">
            <div class="gjpb-summary-hero-avatar" id="gjpbSummaryHeroAvatar">😄</div>
            <div class="gjpb-summary-hero-copy">
              <div class="name" id="gjpbSummaryHeroName">Food Hero Complete!</div>
              <div class="desc" id="gjpbSummaryHeroDesc">เธอช่วยปกป้องเมืองอาหารดีได้สำเร็จ</div>
            </div>
          </div>

          <h2 class="gjpb-summary-title" id="gjpbSummaryTitle">Great Job!</h2>
          <p class="gjpb-summary-sub" id="gjpbSummarySub">มาดูผลของรอบนี้กัน</p>

          <div class="gjpb-stars-row" id="gjpbStarsRow"></div>

          <div class="gjpb-summary-score">
            <div class="label">Score</div>
            <div class="value" id="gjpbSummaryScoreValue">0</div>
          </div>

          <div class="gjpb-summary-grid" id="gjpbSummaryGrid"></div>

          <div class="gjpb-coach" id="gjpbCoachCard">
            <div class="gjpb-coach-avatar">🦸</div>
            <div class="gjpb-coach-text" id="gjpbCoachText">ยอดเยี่ยมมาก! วันนี้เธอช่วยปกป้องอาหารดีได้ดีเลย</div>
          </div>

          <div class="gjpb-hub-card" id="gjpbHubCard">
            <div class="gjpb-hub-icon">🏠</div>
            <div class="gjpb-hub-copy">
              <div class="title" id="gjpbHubTitle">กลับไปที่ HeroHealth Hub</div>
              <div class="desc" id="gjpbHubDesc">เลือกภารกิจถัดไปหรือเล่น GoodJunk อีกรอบได้เลย</div>
            </div>
          </div>

          <div class="gjpb-summary-actions">
            <button class="gjpb-btn blue" id="gjpbBtnAgain" type="button">เล่นอีกครั้ง</button>
            <button class="gjpb-btn good" id="gjpbBtnCooldown" type="button">ไป Cooldown</button>
            <button class="gjpb-btn ghost" id="gjpbBtnHub" type="button">กลับ HUB</button>
            <button class="gjpb-btn warn" id="gjpbBtnExport" type="button">Export JSON</button>
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
  ui.summary = document.getElementById('gjpbSummary');
  ui.summaryTitle = document.getElementById('gjpbSummaryTitle');
  ui.summarySub = document.getElementById('gjpbSummarySub');
  ui.summaryGrid = document.getElementById('gjpbSummaryGrid');
  ui.btnAgain = document.getElementById('gjpbBtnAgain');
  ui.btnCooldown = document.getElementById('gjpbBtnCooldown');
  ui.btnHub = document.getElementById('gjpbBtnHub');
  ui.btnExport = document.getElementById('gjpbBtnExport');

  ui.rewardCoins = document.getElementById('gjpbRewardCoins');
  ui.rewardStars = document.getElementById('gjpbRewardStars');
  ui.rewardBadge = document.getElementById('gjpbRewardBadge');
  ui.summaryRibbon = document.getElementById('gjpbSummaryRibbon');
  ui.summaryScoreValue = document.getElementById('gjpbSummaryScoreValue');
  ui.stageBadge = document.getElementById('gjpbStageBadge');

  ui.playerAvatar = document.getElementById('gjpbPlayerAvatar');
  ui.playerName = document.getElementById('gjpbPlayerName');
  ui.playerSub = document.getElementById('gjpbPlayerSub');
  ui.levelBadge = document.getElementById('gjpbLevelBadge');
  ui.miniMission = document.getElementById('gjpbMiniMission');

  ui.summaryHeroAvatar = document.getElementById('gjpbSummaryHeroAvatar');
  ui.summaryHeroName = document.getElementById('gjpbSummaryHeroName');
  ui.summaryHeroDesc = document.getElementById('gjpbSummaryHeroDesc');
  ui.hubTitle = document.getElementById('gjpbHubTitle');
  ui.hubDesc = document.getElementById('gjpbHubDesc');
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
  const base = PHASE_GOALS[diffKey]?.[phase] ?? (phase === 1 ? 65 : 165);
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
    source: 'goodjunk-solo-phaseboss',
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
  if (state.boss.active) return `boss:${getPatternKey()}`;
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

function getCloudLogger() {
  if (__cloudLogger) return __cloudLogger;
  if (typeof window.createHHACloudLogger !== 'function') return null;

  __cloudLogger = window.createHHACloudLogger({
    endpoint: HHA_ENDPOINT,
    enabled: true,
    debug: true,

    game: GJ_GAME_ID,
    zone: 'nutrition',
    run: RUN_CTX.run || 'play',
    pid: GJ_PID,
    seed: RUN_CTX.seed || '',
    view: RUN_CTX.view || 'mobile',
    difficulty: state.diff,
    studyId: RUN_CTX.studyId || '',
    researchPhase: __qs.get('phase') || '',
    conditionGroup: __qs.get('conditionGroup') || '',
    variant: 'goodjunk-solo-phaseboss',
    appVersion: 'herohealth',
    gameVersion: PATCH_VERSION
  });

  console.log('[GJ-CLOUD] logger created', {
    endpoint: HHA_ENDPOINT,
    pid: GJ_PID,
    game: GJ_GAME_ID
  });

  return __cloudLogger;
}

function startCloudSessionIfNeeded() {
  console.log('[GJ-CLOUD] startCloudSessionIfNeeded()', {
    alreadyStarted: __cloudSessionStarted,
    endpoint: HHA_ENDPOINT,
    hasFactory: typeof window.createHHACloudLogger === 'function'
  });

  if (__cloudSessionStarted) return;

  const logger = getCloudLogger();
  if (!logger) {
    console.warn('[GJ-CLOUD] createHHACloudLogger not found');
    return;
  }

  logger.hhaSessionStart({
    session_id: SESSION_ID,
    pid: GJ_PID,
    player_name: GJ_NAME,
    game: GJ_GAME_ID,
    game_title: 'GoodJunk Solo Phase Boss',
    zone: 'nutrition',
    mode: 'solo',
    run: RUN_CTX.run || 'play',
    study_id: RUN_CTX.studyId || '',
    condition_group: __qs.get('conditionGroup') || '',
    variant: 'goodjunk-solo-phaseboss',
    difficulty: state.diff,
    session_time_sec_setting: Number(RUN_CTX.time || 150),
    view_mode: RUN_CTX.view || 'mobile',
    seed: RUN_CTX.seed || '',
    warmup_used: 1,
    cooldown_used: 1,
    app_version: 'herohealth',
    game_version: PATCH_VERSION
  });

  __cloudSessionStarted = true;
  console.log('[GJ-CLOUD] session started', SESSION_ID);
}

function pushCloudEvent(eventType, extra = {}) {
  console.log('[GJ-CLOUD] pushCloudEvent', eventType, {
    sessionStarted: __cloudSessionStarted,
    endpoint: HHA_ENDPOINT
  });

  const logger = getCloudLogger();
  if (!logger || !__cloudSessionStarted) return;

  logger.hhaEvent(eventType, {
    session_id: SESSION_ID,
    pid: GJ_PID,
    game: GJ_GAME_ID,
    zone: 'nutrition',
    mode: 'solo',
    run: RUN_CTX.run || 'play',
    study_id: RUN_CTX.studyId || '',
    condition_group: __qs.get('conditionGroup') || '',
    difficulty: state.diff,
    view_mode: RUN_CTX.view || 'mobile',
    seed: RUN_CTX.seed || '',

    phase: typeof currentPhaseLabel === 'function' ? currentPhaseLabel() : '',
    event_type: eventType,
    event_name: eventType,
    action: eventType,

    target_id: extra.targetId || '',
    target_type: extra.itemType || '',
    target_label: extra.emoji || '',

    lane: extra.lane ?? '',
    correct: typeof extra.isGood === 'boolean' ? extra.isGood : '',
    score_delta: extra.gain ?? extra.penalty ?? extra.damage ?? 0,
    combo: state.streak,
    rt_ms: extra.rtMs ?? '',
    x: extra.x ?? '',
    y: extra.y ?? '',
    value_num: extra.damage ?? extra.weakspotHitRatePct ?? '',
    value_num2: extra.stormHits ?? extra.comboBonus ?? '',

    meta_json: {
      reason: extra.reason || '',
      patternKey: extra.patternKey || '',
      patternLabel: extra.patternLabel || '',
      bossHpAfter: extra.bossHpAfter ?? '',
      weakspotHit: extra.weakspotHit ?? '',
      weakspotHitRatePct: extra.weakspotHitRatePct ?? '',
      bossDurationMs: extra.bossDurationMs ?? '',
      nextPattern: extra.nextPattern || '',
      telegraphMs: extra.telegraphMs ?? '',
      extra
    }
  });
}

function endCloudSession(summary) {
  const logger = getCloudLogger();
  if (!logger || !__cloudSessionStarted) return;

  console.log('[GJ-CLOUD] endCloudSession', summary);

  logger.hhaSummaryAndEnd(
    summary,
    {
      completed: summary.bossDefeated ? 1 : 0,
      quit_reason: summary.reason || '',
      score: summary.score,
      hits: Number(summary.hitsGood || 0) + Number(summary.powerHits || 0),
      miss: summary.miss,
      combo_max: summary.bestStreak,
      boss_phase_reached: summary.bossEntered ? 1 : 0,
      difficulty: summary.diff,
      summary_json: summary
    },
    { flushNow: true }
  );
}

function getCloudStatusSnapshot() {
  const logger = getCloudLogger();
  if (!logger || typeof logger.getStatusSummary !== 'function') {
    return {
      queueTotal: 0,
      queueSessions: 0,
      queueEvents: 0,
      queueProfiles: 0,
      lastFlushAt: 0,
      lastOkAt: 0,
      lastError: ''
    };
  }

  const s = logger.getStatusSummary();
  return {
    queueTotal: Number(s.queue?.total || 0),
    queueSessions: Number(s.queue?.sessions || 0),
    queueEvents: Number(s.queue?.events || 0),
    queueProfiles: Number(s.queue?.students_profile || 0),
    lastFlushAt: Number(s.lastFlushAt || 0),
    lastOkAt: Number(s.lastOkAt || 0),
    lastError: String(s.lastError || '')
  };
}

function formatCloudTs(ms) {
  const n = Number(ms || 0);
  if (!n) return '-';
  try {
    return new Date(n).toLocaleString('th-TH');
  } catch {
    return '-';
  }
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
    ...extra
  };

  appendQueue(HHA_EVENT_QUEUE_KEY, payload, 1200);

  const eventRow = makeHhaEventRow(payload);
  appendQueue(HHA_EVENTS_SCHEMA_QUEUE_KEY, eventRow, 1200);

  emitExternalLog('hha:log-event', payload);
  emitExternalLog('hha:event-row', eventRow);
  tryBridgeCall('event', eventRow);
  pushCloudEvent(eventType, extra || {});

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
  endCloudSession(summary);

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

  showBanner(
    'Food Hero Mission',
    'เก็บอาหารดี • หลีกเลี่ยง junk • ผ่าน Mission 1 และ Mission 2 เพื่อไปสู้กับ Junk King',
    1800
  );

  updateHint('เริ่มเลย! เก็บอาหารดีให้ได้คะแนน แล้วอย่ากด junk');
  renderHud();

  logGameEvent('session_start', {
    phaseGoal1: getPhaseGoal(1),
    phaseGoal2: getPhaseGoal(2),
    timeBand: getTimeBand()
  });

  startCloudSessionIfNeeded();
  pushCloudEvent('session_start', {
    reason: 'session_start',
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

  if (state.boss.patternIndex === 1) {
    return {
      label: 'Junk Storm',
      hint: 'ระวังพายุขยะก่อน แล้วค่อยตีเป้าทอง',
      stormMs: Math.max(
        state.diff === 'hard' ? 230 : 300,
        (base.stormMs - 220 - (state.boss.enrage ? base.enrageStormPenalty : 0)) * (tb.stormScale || 1)
      ),
      weakSpeed: base.weakSpeed + (state.boss.enrage ? 70 : 30) + Math.round(pressure * 12),
      weakSize: Math.max(54, base.weakSize - 8 + easyWeakBonus),
      weakMoveMs: Math.max(620, base.weakMoveMs - 160),
      damage: 1
    };
  }

  if (state.boss.patternIndex === 2) {
    return {
      label: 'Armor Break',
      hint: 'ตอนนี้เป้าทองใหญ่ขึ้น ตีโดนจะเจ็บแรง',
      stormMs: Math.max(260, (base.stormMs + 120) * (tb.stormScale || 1)),
      weakSpeed: Math.max(100, base.weakSpeed - 34),
      weakSize: base.weakSize + 16 + easyWeakBonus,
      weakMoveMs: base.weakMoveMs + 220,
      damage: 2
    };
  }

  return {
    label: 'Target Hunt',
    hint: 'มองหาเป้าทองที่กำลังวิ่ง แล้วแตะให้แม่น',
    stormMs: Math.max(
      state.diff === 'hard' ? 280 : 340,
      (base.stormMs - (state.boss.enrage ? Math.round(base.enrageStormPenalty * 0.45) : 0)) * (tb.stormScale || 1)
    ),
    weakSpeed: base.weakSpeed + Math.round(pressure * (state.diff === 'hard' ? 22 : 10)),
    weakSize: base.weakSize + easyWeakBonus,
    weakMoveMs: Math.max(700, base.weakMoveMs - Math.round(pressure * 80)),
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
  if (state.boss.hp <= Math.ceil(state.boss.maxHp / 2) && !state.boss.enrage) {
    state.boss.enrage = true;
    showBanner('Junk King โกรธแล้ว!', 'บอสเร็วขึ้นและพายุขยะถี่ขึ้น', 1300);
    updateHint('ระวัง! บอสโกรธแล้ว อ่านสัญญาณเตือนให้ดี');
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

function getTargetTheme(kind) {
  if (kind === 'good') {
    return {
      face: '😊',
      sticker: 'GOOD',
      tilt: randRange(-8, 8),
      scale: 1
    };
  }

  if (kind === 'weakspot') {
    return {
      face: '⭐',
      sticker: 'HIT!',
      tilt: randRange(-6, 6),
      scale: 1.02
    };
  }

  if (kind === 'storm') {
    return {
      face: '😵',
      sticker: 'OH NO',
      tilt: randRange(-10, 10),
      scale: 1
    };
  }

  return {
    face: '😬',
    sticker: 'JUNK',
    tilt: randRange(-10, 10),
    scale: 1
  };
}

function getPhaseLabelText() {
  if (state.boss.active) return 'Boss Mission';
  if (state.phase === 1) return 'Mission 1';
  if (state.phase === 2) return 'Mission 2';
  return 'Mission';
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
  const theme = getTargetTheme(kind);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `gjpb-target ${kind}`;
  btn.style.width = `${w}px`;
  btn.style.height = `${h}px`;
  btn.dataset.tilt = String(theme.tilt || 0);
  btn.dataset.scale = String(theme.scale || 1);
  btn.innerHTML = `
    <div style="
      position:absolute; inset:0;
      background:
        radial-gradient(circle at 28% 22%, rgba(255,255,255,.35), transparent 24%),
        linear-gradient(180deg, rgba(255,255,255,.12), transparent 45%);
      pointer-events:none;"></div>

    <div style="
      position:absolute; top:6px; right:7px;
      min-width:24px; height:24px; padding:0 6px;
      border-radius:999px;
      display:grid; place-items:center;
      background:rgba(255,255,255,.88);
      border:2px solid rgba(255,255,255,.95);
      color:#7b6b53;
      font-size:12px;
      font-weight:1000;
      box-shadow:0 4px 10px rgba(0,0,0,.08);
      pointer-events:none;">${theme.face}</div>

    <div class="gjpb-emoji">${emoji}</div>
    <div class="gjpb-tag">${theme.sticker}</div>
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
    dead: false,
    tilt: theme.tilt || 0,
    scale: theme.scale || 1
  };

  ui.layer?.appendChild(btn);
  state.targets.set(id, target);
  drawTarget(target);
  return id;
}

function drawTarget(target) {
  const tilt = Number(target.tilt || 0);
  const scale = Number(target.scale || 1);
  target.el.style.transform =
    `translate3d(${target.x}px, ${target.y}px, 0) rotate(${tilt}deg) scale(${scale})`;
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
  showBanner('Mission 2', `เก่งมาก! ต่อไปเก็บให้ถึง ${getPhaseGoal(2)} คะแนน`, 1400);
  updateHint('ด่าน 2 เริ่มแล้ว เก็บของดีต่อไป และระวัง junk ให้มากขึ้น');
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

  showBanner(
    'Boss Mission!',
    `ถึงเวลาไปช่วยกันปราบ Junk King แล้ว แตะจุดอ่อนให้แม่นนะ`,
    1700
  );
  updateHint('มองหาดาวเป้าหมาย แล้วแตะให้แม่นเพื่อโจมตีบอส');
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

function getSummaryStars(summary) {
  if (summary.bossDefeated && Number(summary.miss || 0) <= 1) return 3;
  if (summary.bossDefeated) return 3;
  if (summary.phaseReached === 'boss') return 2;
  if (summary.phaseReached === 'phase-2') return 2;
  return 1;
}

function getCoachMessage(summary) {
  if (summary.bossDefeated && Number(summary.miss || 0) === 0) {
    return 'สุดยอดมาก! เธอเลือกอาหารดีได้แม่นมาก และปกป้องเมืองจาก Junk King ได้สำเร็จ';
  }
  if (summary.bossDefeated) {
    return 'เก่งมาก! เธอผ่านภารกิจและช่วยให้เมืองอาหารดีปลอดภัยแล้ว';
  }
  if (summary.phaseReached === 'boss') {
    return 'เกือบชนะแล้ว! รอบหน้าลองอ่านจังหวะเป้าทองอีกนิด แล้วจะผ่านบอสได้แน่';
  }
  if (summary.phaseReached === 'phase-2') {
    return 'ดีมาก! เธอผ่านด่านแรกได้แล้ว ลองลด miss ลงอีกนิดเพื่อไปถึงบอส';
  }
  return 'เริ่มต้นได้ดีมาก! ลองเก็บอาหารดีให้ต่อเนื่อง แล้วจะทำคะแนนได้สูงขึ้น';
}

function getRewardCoinsNow() {
  return Math.max(0, Math.round(
    Number(state.score || 0) +
    Number(state.powerHits || 0) * 5 +
    Math.max(0, 10 - Number(state.miss || 0)) * 2
  ));
}

function getMissionBadgeNow() {
  if (state.boss.active) return state.boss.enrage ? 'Boss Hero' : 'Boss Ready';
  if (state.phase === 2) return 'Food Guard';
  return 'Starter';
}

function getSummaryRibbonText(summary) {
  if (summary.bossDefeated) return 'Great Job!';
  if (summary.phaseReached === 'boss') return 'Almost There!';
  if (summary.phaseReached === 'phase-2') return 'Nice Work!';
  return 'Keep Going!';
}

function getPlayerDisplayName() {
  return String(GJ_NAME || GJ_PID || 'Food Hero').trim() || 'Food Hero';
}

function getAvatarMoodNow() {
  if (state.boss.active && state.boss.hp <= 0) return '🥳';
  if (state.boss.active && state.boss.enrage) return '😤';
  if (state.streak >= 8) return '😎';
  if (state.miss >= 6) return '😅';
  if (state.phase >= 2) return '😄';
  return '🙂';
}

function getLevelNow() {
  const score = Number(state.score || 0);
  if (score >= 220) return 5;
  if (score >= 160) return 4;
  if (score >= 100) return 3;
  if (score >= 50) return 2;
  return 1;
}

function getMiniMissionText() {
  if (state.boss.active) return '🏰 Boss Mission Active';
  if (state.phase === 2) return '🍎 Collect More Good Food';
  return '🌱 Beginner Food Hero';
}

function getSummaryHeroAvatar(summary) {
  if (summary.bossDefeated) return '🥳';
  if (summary.phaseReached === 'boss') return '😄';
  if (summary.phaseReached === 'phase-2') return '🙂';
  return '😊';
}

function getSummaryHeroName(summary) {
  if (summary.bossDefeated) return 'Food Hero Complete!';
  if (summary.phaseReached === 'boss') return 'Boss Mission Reached!';
  if (summary.phaseReached === 'phase-2') return 'Mission 2 Complete!';
  return 'Good Start!';
}

function getSummaryHeroDesc(summary) {
  if (summary.bossDefeated) return 'เธอช่วยปกป้องเมืองอาหารดีและเอาชนะ Junk King ได้แล้ว';
  if (summary.phaseReached === 'boss') return 'เธอไปถึงด่านบอสแล้ว รอบหน้าอีกนิดเดียวจะชนะได้แน่';
  if (summary.phaseReached === 'phase-2') return 'เธอผ่านภารกิจช่วงแรกได้ดีมาก เหลืออีกนิดเดียวจะถึงบอส';
  return 'เริ่มต้นได้ดีมาก ลองเก็บอาหารดีต่อเนื่องอีกนิดนะ';
}

function getHubReturnTitle(summary) {
  if (summary.bossDefeated) return 'กลับไปเลือกภารกิจใหม่ได้เลย';
  return 'พร้อมลองอีกครั้งหรือไปภารกิจถัดไป';
}

function getHubReturnDesc(summary) {
  if (summary.bossDefeated) {
    return 'ไปที่ HeroHealth Hub เพื่อเลือกเกมโซนอื่น หรือกลับมาเก็บคะแนนเพิ่มก็ได้';
  }
  return 'กลับไปที่ HeroHealth Hub เพื่อเลือกโหมดอื่น หรือเล่น GoodJunk ต่อเพื่อทำดาวเพิ่ม';
}

function renderHud() {
  if (ui.score) ui.score.textContent = String(state.score);
  if (ui.timer) ui.timer.textContent = formatTime(state.timeLeftMs);
  if (ui.miss) ui.miss.textContent = String(state.miss);
  if (ui.streak) ui.streak.textContent = String(state.streak);

  if (ui.phasePill) {
    ui.phasePill.textContent = getPhaseLabelText();
  }

  if (ui.goalText) {
    if (state.phase === 1 && !state.boss.active) {
      ui.goalText.textContent = `เก็บอาหารดีให้ถึง ${getPhaseGoal(1)} คะแนน`;
    } else if (state.phase === 2 && !state.boss.active) {
      ui.goalText.textContent = `เร่งคะแนนต่อให้ถึง ${getPhaseGoal(2)} คะแนน`;
    } else {
      ui.goalText.textContent = `แตะจุดอ่อนของ Junk King • HP ${state.boss.hp}`;
    }
  }

  if (ui.progress) {
    const ratio = state.totalMs > 0 ? state.timeLeftMs / state.totalMs : 0;
    ui.progress.style.transform = `scaleX(${clamp(ratio, 0, 1)})`;
  }

  if (ui.stats) {
    ui.stats.innerHTML = `
      <div><strong>Good:</strong> ${state.hitsGood}</div>
      <div><strong>Junk:</strong> ${state.hitsBad}</div>
      <div><strong>Missed:</strong> ${state.missedGood}</div>
      <div><strong>Power:</strong> ${state.powerHits}</div>
    `;
  }

  if (ui.rewardCoins) {
    ui.rewardCoins.textContent = String(getRewardCoinsNow());
  }

  if (ui.rewardStars) {
    ui.rewardStars.textContent = String(getSummaryStars({
      bossDefeated: state.boss.active && state.boss.hp <= 0,
      phaseReached: state.boss.active ? 'boss' : (state.phase === 2 ? 'phase-2' : 'phase-1'),
      miss: state.miss
    }));
  }

  if (ui.rewardBadge) {
    ui.rewardBadge.textContent = getMissionBadgeNow();
  }

  if (ui.stageBadge) {
    ui.stageBadge.textContent = state.boss.active ? '🏰 Boss Garden' : '🌱 Healthy Town';
  }

  if (ui.playerAvatar) {
    ui.playerAvatar.textContent = getAvatarMoodNow();
  }

  if (ui.playerName) {
    ui.playerName.textContent = getPlayerDisplayName();
  }

  if (ui.playerSub) {
    ui.playerSub.textContent = state.boss.active
      ? 'กำลังสู้กับ Junk King'
      : (state.phase === 2 ? 'ภารกิจระดับกลางแล้ว' : 'พร้อมเริ่มภารกิจอาหารดี');
  }

  if (ui.levelBadge) {
    ui.levelBadge.textContent = String(getLevelNow());
  }

  if (ui.miniMission) {
    ui.miniMission.textContent = getMiniMissionText();
  }

  if (ui.bossName) {
    ui.bossName.textContent = ui.bossWrap?.classList.contains('defeated')
      ? 'Junk King Down!'
      : 'Junk King';
  }

  if (ui.bossHpText) {
    ui.bossHpText.textContent = `${state.boss.hp} / ${state.boss.maxHp}`;
  }

  if (ui.bossHpBar) {
    const hpRatio = state.boss.maxHp > 0 ? state.boss.hp / state.boss.maxHp : 0;
    ui.bossHpBar.style.transform = `scaleX(${clamp(hpRatio, 0, 1)})`;
  }

  if (ui.bossState) {
    if (!state.boss.active) {
      ui.bossState.textContent = 'เตรียมตัวก่อนเข้าด่านบอส';
    } else if (state.boss.telegraphMs > 0) {
      ui.bossState.textContent = `เตรียมท่า: ${getBossPatternName(state.boss.nextPatternIndex)}`;
    } else if (state.boss.enrage) {
      ui.bossState.textContent = `${state.boss.patternLabel} • โหมดโกรธ`;
    } else {
      ui.bossState.textContent = state.boss.patternLabel;
    }
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

  const cloudLoggerReady = !!getCloudLogger();
  const cloudEndpointReady = !!HHA_ENDPOINT;
  const cloudStatus = getCloudStatusSnapshot();

  const summary = {
    version: PATCH_VERSION,
    source: 'goodjunk-solo-phaseboss',
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
    cloudLoggerReady,
    cloudEndpointReady,
    cloudQueueTotal: cloudStatus.queueTotal,
    cloudQueueSessions: cloudStatus.queueSessions,
    cloudQueueEvents: cloudStatus.queueEvents,
    cloudQueueProfiles: cloudStatus.queueProfiles,
    cloudLastFlushAt: cloudStatus.lastFlushAt,
    cloudLastOkAt: cloudStatus.lastOkAt,
    cloudLastError: cloudStatus.lastError,
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
  logSessionSummary(summary);
  showSummary(summary);
}

function getBossOutcomeLabel(summary) {
  if (summary.bossDefeated) return 'Boss Clear';
  if (summary.phaseReached === 'boss') return 'Reached Boss';
  if (summary.phaseReached === 'phase-2') return 'Reached Phase 2';
  return 'Reached Phase 1';
}

function showSummary(summary) {
  if (!ui.summary || !ui.summaryGrid) return;

  const stars = getSummaryStars(summary);
  const title = summary.bossDefeated
    ? 'Great Job!'
    : summary.phaseReached === 'boss'
      ? 'Almost There!'
      : summary.phaseReached === 'phase-2'
        ? 'Nice Work!'
        : 'Good Start!';

  const sub = summary.bossDefeated
    ? `เธอปราบ Junk King ได้แล้ว • weakspot ${summary.weakspotHitRatePct}%`
    : summary.phaseReached === 'boss'
      ? `ถึงบอสแล้ว • หลบ storm ได้ ${summary.stormAvoidRatePct}%`
      : `เล่นต่ออีกนิด แล้วจะไปได้ไกลกว่าเดิม`;

  ui.summaryTitle.textContent = title;
  ui.summarySub.textContent = sub;
  if (ui.summaryRibbon) ui.summaryRibbon.textContent = getSummaryRibbonText(summary);
  if (ui.summaryScoreValue) ui.summaryScoreValue.textContent = String(summary.score || 0);

  if (ui.summaryHeroAvatar) ui.summaryHeroAvatar.textContent = getSummaryHeroAvatar(summary);
  if (ui.summaryHeroName) ui.summaryHeroName.textContent = getSummaryHeroName(summary);
  if (ui.summaryHeroDesc) ui.summaryHeroDesc.textContent = getSummaryHeroDesc(summary);
  if (ui.hubTitle) ui.hubTitle.textContent = getHubReturnTitle(summary);
  if (ui.hubDesc) ui.hubDesc.textContent = getHubReturnDesc(summary);

  const starsRow = document.getElementById('gjpbStarsRow');
  if (starsRow) {
    starsRow.innerHTML = `
      <span class="gjpb-star ${stars >= 1 ? 'on' : 'off'}">⭐</span>
      <span class="gjpb-star ${stars >= 2 ? 'on' : 'off'}">⭐</span>
      <span class="gjpb-star ${stars >= 3 ? 'on' : 'off'}">⭐</span>
    `;
  }

  ui.summaryGrid.innerHTML = `
    <div class="gjpb-summary-item">
      <div class="label">Miss</div>
      <div class="value">${summary.miss}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Best Streak</div>
      <div class="value">${summary.bestStreak}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Reached</div>
      <div class="value">${escapeHtml(getBossOutcomeLabel(summary))}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Reward Coins</div>
      <div class="value">${Math.max(0, Math.round(
        Number(summary.score || 0) +
        Number(summary.powerHits || 0) * 5 +
        Math.max(0, 10 - Number(summary.miss || 0)) * 2
      ))}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Good Hit</div>
      <div class="value">${summary.hitsGood}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Power Hit</div>
      <div class="value">${summary.powerHits}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Weakspot Rate</div>
      <div class="value">${summary.weakspotHitRatePct}%</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Storm Avoid</div>
      <div class="value">${summary.stormAvoidRatePct}%</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Time Profile</div>
      <div class="value">${escapeHtml(summary.timeBand || 'standard')}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Cloud Client</div>
      <div class="value">${summary.cloudLoggerReady ? 'ready' : 'missing'}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Cloud Endpoint</div>
      <div class="value">${summary.cloudEndpointReady ? 'ready' : 'missing'}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Last Flush</div>
      <div class="value">${escapeHtml(typeof formatCloudTs === 'function' ? formatCloudTs(summary.cloudLastOkAt || summary.cloudLastFlushAt) : '-')}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Queue Left</div>
      <div class="value">${summary.cloudQueueTotal ?? 0}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Queue Events</div>
      <div class="value">${summary.cloudQueueEvents ?? 0}</div>
    </div>
  `;

  const coachText = document.getElementById('gjpbCoachText');
  if (coachText) coachText.textContent = getCoachMessage(summary);

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
  if (HHA_ENDPOINT) url.searchParams.set('api', HHA_ENDPOINT);
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
  if (HHA_ENDPOINT) gate.searchParams.set('api', HHA_ENDPOINT);
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
      title: 'GoodJunk Solo Phase Boss',
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

  if (ui.bossIcon) ui.bossIcon.textContent = '🏆';
  if (ui.bossName) ui.bossName.textContent = 'Mission Clear!';
  if (ui.bossState) ui.bossState.textContent = 'เธอช่วยเมืองอาหารดีได้แล้ว';

  showBanner('Great Job!', 'เธอชนะแล้วและช่วยปราบ Junk King สำเร็จ', 900);
  updateHint('ภารกิจสำเร็จ กำลังเข้าสู่หน้าสรุปผล');

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
      bossPatternLast: summary.bossPatternLast
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