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
const STYLE_ID = 'goodjunk-phaseboss-style-v20260319c';
const ROOT_ID = 'gjpbRoot';

const GJ_SOLO_LAST_SUMMARY_KEY = `GJ_SOLO_LAST_SUMMARY_${GJ_PID}`;
const GJ_SOLO_SUMMARY_HISTORY_KEY = `GJ_SOLO_SUMMARY_HISTORY_${GJ_PID}`;
const HHA_LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
const HHA_SUMMARY_HISTORY_KEY = 'HHA_SUMMARY_HISTORY';

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
  1: 65,
  2: 165
};

const DIFF_PRESET = {
  easy: {
    p1: { spawnMs: 860, goodRatio: 0.72, speedMin: 90, speedMax: 145, sizeMin: 62, sizeMax: 86 },
    p2: { spawnMs: 690, goodRatio: 0.62, speedMin: 120, speedMax: 190, sizeMin: 58, sizeMax: 82 },
    boss: { hp: 10, stormMs: 960, weakSpeed: 130, weakMoveMs: 1300, weakSize: 84 }
  },
  normal: {
    p1: { spawnMs: 760, goodRatio: 0.68, speedMin: 105, speedMax: 165, sizeMin: 60, sizeMax: 84 },
    p2: { spawnMs: 610, goodRatio: 0.57, speedMin: 135, speedMax: 225, sizeMin: 56, sizeMax: 78 },
    boss: { hp: 13, stormMs: 820, weakSpeed: 165, weakMoveMs: 1100, weakSize: 76 }
  },
  hard: {
    p1: { spawnMs: 660, goodRatio: 0.63, speedMin: 120, speedMax: 190, sizeMin: 58, sizeMax: 80 },
    p2: { spawnMs: 520, goodRatio: 0.50, speedMin: 155, speedMax: 260, sizeMin: 54, sizeMax: 74 },
    boss: { hp: 16, stormMs: 660, weakSpeed: 215, weakMoveMs: 900, weakSize: 68 }
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
  btnExport: null
};

const state = {
  diff: DIFF_PRESET[RUN_CTX.diff] ? RUN_CTX.diff : 'normal',
  phase: 1,
  totalMs: 0,
  timeLeftMs: 0,
  running: false,
  ended: false,
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
    weakMoveMs: 0
  },
  summaryPayload: null
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
    }
    .gjpb-bosswrap.show{
      display:block;
    }
    .gjpb-boss-head{
      display:flex;
      align-items:center;
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
          <div class="gjpb-goal-pill" id="gjpbGoalText">GOAL สะสมคะแนน • เป้าหมาย 65</div>
        </div>

        <div class="gjpb-stage" id="gjpbStage">
          <div class="gjpb-stars"></div>
          <div class="gjpb-layer" id="gjpbLayer"></div>

          <div class="gjpb-banner" id="gjpbBanner">
            <div id="gjpbBannerTitle">GoodJunk Phase Boss</div>
            <small id="gjpbBannerSub">เก็บอาหารดี • หลีกเลี่ยง junk • ผ่าน Phase 1 และ Phase 2 เพื่อไปสู้กับ Junk King</small>
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
          <div class="gjpb-summary-kicker">GOODJUNK SOLO SUMMARY</div>
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
    downloadJson(state.summaryPayload, `goodjunk-solo-${safeFilePart(GJ_PID)}-${Date.now()}.json`);
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

function startGame() {
  state.totalMs = clamp(Math.floor(Number(RUN_CTX.time || 150) * 1000), 60000, 600000);
  state.timeLeftMs = state.totalMs;
  state.running = true;
  state.ended = false;
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
  state.lastFrameTs = performance.now();
  state.spawnAccum = 0;
  state.targetSeq = 0;
  state.targets.clear();
  state.summaryPayload = null;
  resetBossState();

  if (ui.layer) ui.layer.innerHTML = '';
  if (ui.summary) ui.summary.hidden = true;

  showBanner(
    'GoodJunk Phase Boss',
    'เก็บอาหารดี • หลีกเลี่ยง junk • ผ่าน Phase 1 และ Phase 2 เพื่อไปสู้กับ Junk King',
    1800
  );

  updateHint('เริ่มเลย! เก็บอาหารดีให้ได้คะแนน แล้วอย่ากด junk');
  renderHud();
  state.raf = requestAnimationFrame(loop);
}

function resetBossState() {
  const bossPreset = DIFF_PRESET[state.diff].boss;
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
}

function loop(ts) {
  if (!state.running || state.ended) return;

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

  state.spawnAccum += dt;

  while (state.spawnAccum >= preset.spawnMs) {
    state.spawnAccum -= preset.spawnMs;
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
  const bossPreset = DIFF_PRESET[state.diff].boss;

  state.boss.stormAccum += dt;
  state.boss.weakTick += dt;

  if (state.boss.hp <= Math.ceil(state.boss.maxHp / 2) && !state.boss.enrage) {
    state.boss.enrage = true;
    showBanner('Junk King ENRAGE!', 'บอสเร็วขึ้นและปล่อย junk storm ถี่กว่าเดิม', 1300);
    updateHint('ระวัง! Junk King โกรธแล้ว จับ weak spot ให้แม่น');
  }

  const stormMs = state.boss.enrage ? Math.max(360, bossPreset.stormMs - 180) : bossPreset.stormMs;
  while (state.boss.stormAccum >= stormMs) {
    state.boss.stormAccum -= stormMs;
    spawnStormJunk();
  }

  const weak = getWeakspot();
  if (!weak) {
    spawnWeakspot();
  } else {
    moveWeakspot(weak, dt);
  }

  if (state.boss.weakTick >= (state.boss.enrage ? Math.max(560, state.boss.weakMoveMs - 260) : state.boss.weakMoveMs)) {
    state.boss.weakTick = 0;
    const target = getWeakspot();
    if (target) {
      target.vx = randRange(-state.boss.weakSpeed, state.boss.weakSpeed);
      target.vy = randRange(-state.boss.weakSpeed, state.boss.weakSpeed);
      if (Math.abs(target.vx) < 70) target.vx = target.vx < 0 ? -70 : 70;
      if (Math.abs(target.vy) < 70) target.vy = target.vy < 0 ? -70 : 70;
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
  if (!state.running || state.ended) return;
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
    updateHint('เยี่ยมมาก! เก็บของดีต่อไป');
  } else if (target.kind === 'junk' || target.kind === 'storm') {
    state.hitsBad += 1;
    state.miss += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - 8);
    createFx(cx, cy, 'MISS', '#fda4af');
    updateHint(target.kind === 'storm'
      ? 'อย่ากด junk storm! รอ weak spot แล้วโจมตี'
      : 'ระวัง junk! แตะของดีแทน');
  } else if (target.kind === 'weakspot') {
    state.powerHits += 1;
    const damage = 1;
    state.boss.hp = Math.max(0, state.boss.hp - damage);
    state.score += 15;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    createFx(cx, cy, 'POWER HIT!', '#fde68a');
    updateHint(state.boss.hp > 0
      ? 'โดนแล้ว! ตาม weak spot ต่อ'
      : 'Junk King ถูกล้มแล้ว!');
    removeTarget(id);

    if (state.boss.hp <= 0) {
      state.score += 40;
      renderHud();
      endGame('boss-defeated');
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
  updateHint('มีของดีหลุดไปแล้ว รีบเก็บชิ้นต่อไป');
  removeTarget(target.id);
  renderHud();
}

function checkPhaseProgress() {
  if (state.boss.active || state.ended) return;

  if (state.phase === 1 && state.score >= PHASE_GOALS[1]) {
    enterPhase2();
    return;
  }

  if (state.phase === 2 && state.score >= PHASE_GOALS[2]) {
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
  showBanner('PHASE 2', 'เร็วขึ้น • junk มากขึ้น • เก็บให้ถึงเป้าหมาย 165', 1400);
  updateHint('Phase 2 เริ่มแล้ว! อ่านเป้าให้แม่นและอย่ารีบกดผิด');
  renderHud();
}

function enterBossPhase() {
  state.phase = 3;
  state.boss.active = true;
  clearTargets();
  state.spawnAccum = 0;
  state.boss.hp = state.boss.maxHp;
  state.boss.enrage = false;
  state.boss.stormAccum = 0;
  state.boss.weakTick = 0;
  ui.bossWrap?.classList.add('show');
  showBanner('BOSS PHASE', 'ผ่าน Phase 1 และ 2 แล้ว! โจมตี weak spot เพื่อปราบ Junk King', 1700);
  updateHint('กด weak spot 🎯 เพื่อโจมตีบอส และหลบ junk storm');
  renderHud();
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
      ui.goalText.textContent = `GOAL สะสมคะแนน • เป้าหมาย ${PHASE_GOALS[1]}`;
    } else if (state.phase === 2) {
      ui.goalText.textContent = `GOAL เร่งคะแนนต่อ • เป้าหมาย ${PHASE_GOALS[2]}`;
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

  if (ui.bossName) ui.bossName.textContent = 'Junk King';
  if (ui.bossHpText) ui.bossHpText.textContent = `${state.boss.hp} / ${state.boss.maxHp}`;
  if (ui.bossHpBar) {
    const hpRatio = state.boss.maxHp > 0 ? state.boss.hp / state.boss.maxHp : 0;
    ui.bossHpBar.style.transform = `scaleX(${clamp(hpRatio, 0, 1)})`;
  }
  if (ui.bossState) {
    if (!state.boss.active) {
      ui.bossState.textContent = 'รอเข้าสู่บอส';
    } else if (state.boss.enrage) {
      ui.bossState.textContent = 'ENRAGE • junk storm รุนแรงขึ้น';
    } else {
      ui.bossState.textContent = 'มองหา weak spot แล้วโจมตี';
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

  const summary = {
    version: '20260319c-goodjunk-solo-phaseboss',
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
    updatedAt: Date.now()
  };

  state.summaryPayload = summary;
  persistSummary(summary);
  showSummary(summary);
}

function showSummary(summary) {
  if (!ui.summary || !ui.summaryGrid) return;

  const title = summary.bossDefeated
    ? 'ยอดเยี่ยม! ปราบ Junk King ได้แล้ว'
    : summary.phaseReached === 'boss'
      ? 'เกือบชนะแล้ว! ถึงบอสแล้ว'
      : summary.phaseReached === 'phase-2'
        ? 'ผ่าน Phase 1 แล้ว'
        : 'เริ่มต้นได้ดีมาก';

  const sub = summary.bossDefeated
    ? 'คุณผ่าน Phase 1, Phase 2 และโค่นบอสสำเร็จ'
    : 'ลองเล่นใหม่เพื่อไปได้ไกลกว่าเดิม แล้วค่อยไป cooldown ต่อ';

  ui.summaryTitle.textContent = title;
  ui.summarySub.textContent = sub;

  ui.summaryGrid.innerHTML = `
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
      <div class="label">ถึงด่าน</div>
      <div class="value">${escapeHtml(summary.phaseReached)}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Good hit</div>
      <div class="value">${summary.hitsGood}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Junk hit</div>
      <div class="value">${summary.hitsBad}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Good missed</div>
      <div class="value">${summary.missedGood}</div>
    </div>
    <div class="gjpb-summary-item">
      <div class="label">Power hit</div>
      <div class="value">${summary.powerHits}</div>
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