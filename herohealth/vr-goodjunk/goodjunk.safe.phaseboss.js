// === /herohealth/vr-goodjunk/goodjunk.safe.phaseboss.js ===
// FULL PATCH v20260317-GOODJUNK-PHASEBOSS-SPLIT
// Solo-only phase build: Phase 1 -> Phase 2 -> Boss
// Fun / challenging / exciting boss fight version

const __qs = new URLSearchParams(location.search);
const RUN_CTX = window.__GJ_RUN_CTX__ || {
  pid: __qs.get('pid') || 'anon',
  name: __qs.get('name') || '',
  studyId: __qs.get('studyId') || '',
  roomId: '',
  mode: 'solo',
  diff: (__qs.get('diff') || 'normal').toLowerCase(),
  time: __qs.get('time') || '120',
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

const GOODJUNK_STYLE_ID = 'goodjunk-safe-style-phaseboss-20260317';
const GOODJUNK_ROOT_ID = 'gjRoot';

const GJ_SOLO_LAST_SUMMARY_KEY = `GJ_SOLO_LAST_SUMMARY_${GJ_PID}`;
const GJ_SOLO_SUMMARY_HISTORY_KEY = `GJ_SOLO_SUMMARY_HISTORY_${GJ_PID}`;

const GOOD_ITEMS = [
  { emoji: '🍎', label: 'apple' },
  { emoji: '🥕', label: 'carrot' },
  { emoji: '🥦', label: 'broccoli' },
  { emoji: '🍌', label: 'banana' },
  { emoji: '🥛', label: 'milk' },
  { emoji: '🥗', label: 'salad' },
  { emoji: '🍉', label: 'watermelon' }
];

const POWER_ITEMS = [
  { emoji: '⭐', label: 'power-star' },
  { emoji: '💚', label: 'clean-power' },
  { emoji: '⚡', label: 'boost' }
];

const JUNK_ITEMS = [
  { emoji: '🍟', label: 'fries' },
  { emoji: '🍩', label: 'donut' },
  { emoji: '🍭', label: 'candy' },
  { emoji: '🍔', label: 'burger' },
  { emoji: '🥤', label: 'soda' },
  { emoji: '🍕', label: 'pizza' },
  { emoji: '🧁', label: 'cupcake' }
];

const DIFF_PRESET = {
  easy: {
    spawnMs: 900,
    goodRatio: 0.70,
    speedMin: 90,
    speedMax: 150,
    targetSizeMin: 60,
    targetSizeMax: 84,
    bossHp: 120,
    phase1TargetScore: 55,
    phase2TargetScore: 135,
    weakSpotDamage: 22,
    goodBossDamage: 8,
    powerBossDamage: 18,
    stormEveryMs: 3600,
    weakSpotEveryMs: 4200,
    weakSpotOpenMs: 1200
  },
  normal: {
    spawnMs: 760,
    goodRatio: 0.63,
    speedMin: 110,
    speedMax: 190,
    targetSizeMin: 58,
    targetSizeMax: 82,
    bossHp: 150,
    phase1TargetScore: 65,
    phase2TargetScore: 165,
    weakSpotDamage: 20,
    goodBossDamage: 7,
    powerBossDamage: 16,
    stormEveryMs: 3200,
    weakSpotEveryMs: 3700,
    weakSpotOpenMs: 1050
  },
  hard: {
    spawnMs: 610,
    goodRatio: 0.58,
    speedMin: 130,
    speedMax: 240,
    targetSizeMin: 56,
    targetSizeMax: 80,
    bossHp: 185,
    phase1TargetScore: 75,
    phase2TargetScore: 185,
    weakSpotDamage: 18,
    goodBossDamage: 6,
    powerBossDamage: 14,
    stormEveryMs: 2800,
    weakSpotEveryMs: 3300,
    weakSpotOpenMs: 950
  }
};

const state = {
  mode: 'solo',
  diff: DIFF_PRESET[RUN_CTX.diff] ? RUN_CTX.diff : 'normal',
  totalMs: 0,
  timeLeftMs: 0,

  score: 0,
  miss: 0,
  streak: 0,
  bestStreak: 0,

  hitsGood: 0,
  hitsBad: 0,
  hitsPower: 0,
  missedGood: 0,

  spawnedGood: 0,
  spawnedJunk: 0,
  spawnedPower: 0,

  running: false,
  ended: false,
  won: false,

  startTs: 0,
  lastFrameTs: 0,
  lastSpawnAccum: 0,
  frameRaf: 0,

  phase: 1,
  phaseLabel: 'Phase 1',
  phaseChangedAt: 0,
  phase2BurstCd: 0,

  bossActive: false,
  bossIntroShown: false,
  bossDefeated: false,

  boss: {
    hp: 0,
    hpMax: 0,
    x: 0,
    y: 26,
    w: 168,
    h: 118,
    vx: 120,
    stunMs: 0,
    weakSpotReady: false,
    weakSpotOpenMs: 0,
    weakSpotCd: 0,
    stormCd: 0,
    powerCd: 0,
    enrage: false
  },

  targetSeq: 0,
  targets: new Map(),
  rect: { width: 0, height: 0 }
};

const ui = {
  root: null,
  shell: null,
  stage: null,
  layer: null,

  score: null,
  timer: null,
  miss: null,
  streak: null,
  hint: null,
  progress: null,
  stats: null,
  centerTip: null,

  phaseBadge: null,
  phaseSub: null,

  bossWrap: null,
  boss: null,
  bossFace: null,
  bossName: null,
  bossHpFill: null,
  bossHpText: null,
  bossWeakSpot: null,

  soloOverlay: null,
  soloBody: null,
  soloTitle: null,
  soloSub: null,
  soloBtnAgain: null,
  soloBtnExport: null,
  soloBtnHub: null
};

const rng = createSeededRng(RUN_CTX.seed || Date.now());

boot();

function boot() {
  injectGameplayStyle();
  buildGameplayShell();
  bindGameplayShell();
  startGame();

  window.addEventListener('resize', refreshStageRect);
  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(state.frameRaf);
  });
}

function injectGameplayStyle() {
  if (document.getElementById(GOODJUNK_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = GOODJUNK_STYLE_ID;
  style.textContent = `
    #${GOODJUNK_ROOT_ID}{
      position:absolute;inset:0;z-index:2;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation;
      background:
        radial-gradient(circle at 18% 10%, rgba(34,197,94,.12), transparent 25%),
        radial-gradient(circle at 82% 4%, rgba(56,189,248,.10), transparent 24%);
    }
    #${GOODJUNK_ROOT_ID}.phase-1{
      background:
        radial-gradient(circle at 18% 10%, rgba(34,197,94,.12), transparent 25%),
        radial-gradient(circle at 82% 4%, rgba(56,189,248,.10), transparent 24%);
    }
    #${GOODJUNK_ROOT_ID}.phase-2{
      background:
        radial-gradient(circle at 14% 10%, rgba(251,191,36,.16), transparent 26%),
        radial-gradient(circle at 84% 8%, rgba(244,63,94,.12), transparent 26%);
    }
    #${GOODJUNK_ROOT_ID}.phase-boss{
      background:
        radial-gradient(circle at 50% 0%, rgba(244,63,94,.20), transparent 34%),
        radial-gradient(circle at 15% 8%, rgba(250,204,21,.12), transparent 20%),
        radial-gradient(circle at 85% 8%, rgba(56,189,248,.10), transparent 20%);
    }
    #${GOODJUNK_ROOT_ID}.phase-boss.enrage{
      animation: gj-bg-pulse 1.4s ease-in-out infinite;
    }
    @keyframes gj-bg-pulse{
      0%,100%{ filter:none; }
      50%{ filter:saturate(1.12) brightness(1.06); }
    }

    .gj-shell{position:absolute;inset:0;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden}
    .gj-topbar{
      display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;
      padding:60px 14px 12px;padding-top:calc(60px + env(safe-area-inset-top,0px));pointer-events:none
    }
    .gj-chip-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;pointer-events:none}
    .gj-chip{
      display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;
      border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.66);color:#e5e7eb;
      font-weight:900;font-size:13px;backdrop-filter:blur(8px);box-shadow:0 10px 24px rgba(0,0,0,.18)
    }
    .gj-chip span{color:#94a3b8;font-weight:800}
    .gj-chip.phase{
      border-color:rgba(250,204,21,.25);
      background:rgba(250,204,21,.09);
      color:#fde68a;
    }

    .gj-stage-wrap{position:relative;min-height:0;padding:8px 10px 10px}
    .gj-stage{
      position:relative;width:100%;height:100%;min-height:360px;overflow:hidden;border:1px solid rgba(148,163,184,.18);
      border-radius:26px;
      background:
        radial-gradient(circle at 50% 0%, rgba(56,189,248,.09), transparent 30%),
        linear-gradient(180deg, rgba(15,23,42,.74), rgba(2,6,23,.82));
      box-shadow:0 24px 64px rgba(0,0,0,.22)
    }
    .gj-stage::before{
      content:"";position:absolute;inset:0;
      background:
        linear-gradient(180deg, rgba(255,255,255,.04), transparent 30%),
        linear-gradient(0deg, rgba(255,255,255,.03), transparent 30%);
      pointer-events:none
    }

    .gj-target-layer{position:absolute;inset:0;overflow:hidden}
    .gj-center-tip{
      position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
      width:min(86vw,460px);padding:16px 18px;border-radius:18px;background:rgba(2,6,23,.56);
      border:1px solid rgba(148,163,184,.18);color:#e5e7eb;text-align:center;font-weight:900;
      backdrop-filter:blur(6px);pointer-events:none;opacity:.96;transition:opacity .35s ease, transform .35s ease;
      box-shadow:0 16px 36px rgba(0,0,0,.18)
    }
    .gj-center-tip.hide{opacity:0;transform:translate(-50%,-50%) scale(.96)}

    .gj-target{
      position:absolute;display:grid;place-items:center;border-radius:22px;border:1px solid rgba(255,255,255,.16);
      box-shadow:0 14px 28px rgba(0,0,0,.18);transform:translate3d(0,0,0);
      cursor:pointer;outline:none;padding:0;overflow:hidden;background:rgba(15,23,42,.78)
    }
    .gj-target.good{
      background:
        radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), transparent 26%),
        linear-gradient(180deg, rgba(34,197,94,.30), rgba(34,197,94,.18)),
        rgba(15,23,42,.84);
      border-color:rgba(34,197,94,.30)
    }
    .gj-target.power{
      background:
        radial-gradient(circle at 30% 25%, rgba(255,255,255,.30), transparent 28%),
        linear-gradient(180deg, rgba(250,204,21,.36), rgba(234,179,8,.18)),
        rgba(15,23,42,.88);
      border-color:rgba(250,204,21,.34);
      box-shadow:0 14px 34px rgba(250,204,21,.14), 0 14px 28px rgba(0,0,0,.18);
      animation: gj-power-pulse 1s ease-in-out infinite;
    }
    @keyframes gj-power-pulse{
      0%,100%{ transform:translate3d(0,0,0) scale(1); }
      50%{ transform:translate3d(0,0,0) scale(1.04); }
    }
    .gj-target.junk{
      background:
        radial-gradient(circle at 30% 25%, rgba(255,255,255,.20), transparent 26%),
        linear-gradient(180deg, rgba(244,63,94,.26), rgba(244,63,94,.14)),
        rgba(15,23,42,.84);
      border-color:rgba(244,63,94,.28)
    }
    .gj-emoji{font-size:32px;line-height:1;transform:translateY(-2px);filter:drop-shadow(0 6px 10px rgba(0,0,0,.18))}
    .gj-type{
      position:absolute;left:8px;right:8px;bottom:6px;font-size:10px;font-weight:900;letter-spacing:.08em;
      text-transform:uppercase;color:#e2e8f0;opacity:.92;text-align:center;white-space:nowrap
    }

    .gj-fx{
      position:absolute;font-size:16px;font-weight:900;pointer-events:none;transform:translate(-50%,-50%);
      animation:gj-fx-up .75s ease forwards;text-shadow:0 8px 18px rgba(0,0,0,.22)
    }
    @keyframes gj-fx-up{
      from{opacity:1;transform:translate(-50%,-20%)}
      to{opacity:0;transform:translate(-50%,-140%)}
    }

    .gj-bottom{padding:0 12px calc(12px + env(safe-area-inset-bottom,0px))}
    .gj-bottom-card{
      border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:12px;background:rgba(2,6,23,.62);
      backdrop-filter:blur(8px);box-shadow:0 10px 24px rgba(0,0,0,.18)
    }
    .gj-bottom-top{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
    .gj-progress{
      position:relative;width:100%;height:12px;border-radius:999px;overflow:hidden;border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.06)
    }
    .gj-progress-bar{
      width:100%;height:100%;background:linear-gradient(90deg, rgba(56,189,248,.85), rgba(34,197,94,.85));
      transform-origin:left center;transition:transform .12s linear
    }
    .gj-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:13px;color:#cbd5e1;line-height:1.5}
    .gj-legend strong{color:#e5e7eb}

    .gj-boss-wrap{
      position:absolute;left:0;top:0;right:0;height:170px;pointer-events:none;z-index:4
    }
    .gj-boss-wrap[hidden]{display:none!important}
    .gj-boss{
      position:absolute;top:0;left:0;width:168px;height:118px;border-radius:28px;
      background:
        radial-gradient(circle at 35% 28%, rgba(255,255,255,.18), transparent 28%),
        linear-gradient(180deg, rgba(127,29,29,.88), rgba(69,10,10,.94));
      border:1px solid rgba(248,113,113,.32);
      box-shadow:0 18px 44px rgba(0,0,0,.28), 0 0 0 6px rgba(239,68,68,.05);
      display:flex;align-items:center;justify-content:center;pointer-events:auto;overflow:visible;
      transition:transform .08s linear;
    }
    .gj-boss::before{
      content:"";position:absolute;inset:-6px;border-radius:34px;border:2px solid rgba(250,204,21,.22);pointer-events:none;
    }
    .gj-boss-face{
      font-size:54px;line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.28));transform:translateY(-2px);
    }
    .gj-boss-label{
      position:absolute;left:50%;top:-12px;transform:translateX(-50%);
      display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;
      background:rgba(127,29,29,.95);border:1px solid rgba(248,113,113,.30);color:#fecaca;font-weight:900;font-size:12px;
      white-space:nowrap;
    }
    .gj-boss.enrage{
      animation: gj-boss-enrage .7s ease-in-out infinite;
    }
    @keyframes gj-boss-enrage{
      0%,100%{ transform:scale(1); }
      50%{ transform:scale(1.03); }
    }

    .gj-weakspot{
      position:absolute;right:12px;bottom:10px;width:52px;height:52px;border-radius:999px;border:1px solid rgba(250,204,21,.45);
      background:radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), transparent 30%), rgba(250,204,21,.92);
      color:#422006;font-size:24px;font-weight:900;display:grid;place-items:center;cursor:pointer;pointer-events:auto;
      box-shadow:0 12px 24px rgba(250,204,21,.24);animation:gj-weakspot-pop .55s ease-in-out infinite alternate
    }
    .gj-weakspot[hidden]{display:none!important}
    @keyframes gj-weakspot-pop{
      from{transform:scale(1)}
      to{transform:scale(1.08)}
    }

    .gj-boss-hud{
      position:absolute;left:50%;top:8px;transform:translateX(-50%);
      width:min(86vw,420px);
      padding:10px 12px;border-radius:16px;border:1px solid rgba(248,113,113,.22);
      background:rgba(2,6,23,.62);backdrop-filter:blur(8px);box-shadow:0 10px 24px rgba(0,0,0,.18)
    }
    .gj-boss-hud-top{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}
    .gj-boss-kicker{
      display:inline-flex;align-items:center;gap:8px;padding:4px 10px;border-radius:999px;
      background:rgba(239,68,68,.12);border:1px solid rgba(248,113,113,.20);color:#fecaca;font-weight:900;font-size:12px
    }
    .gj-boss-name{font-size:13px;font-weight:900;color:#fde68a}
    .gj-boss-hp-track{
      width:100%;height:14px;border-radius:999px;overflow:hidden;border:1px solid rgba(248,113,113,.22);background:rgba(255,255,255,.06)
    }
    .gj-boss-hp-fill{
      width:100%;height:100%;transform-origin:left center;
      background:linear-gradient(90deg, rgba(250,204,21,.92), rgba(239,68,68,.92));
      transition:transform .12s linear
    }
    .gj-boss-hp-text{margin-top:6px;text-align:right;color:#cbd5e1;font-size:12px;font-weight:800}

    .gj-solo-overlay{
      position:fixed;inset:0;z-index:10010;display:grid;place-items:center;
      padding:calc(16px + env(safe-area-inset-top,0px)) calc(16px + env(safe-area-inset-right,0px))
      calc(16px + env(safe-area-inset-bottom,0px)) calc(16px + env(safe-area-inset-left,0px));
      background:rgba(2,6,23,.82);backdrop-filter:blur(10px)
    }
    .gj-solo-overlay[hidden]{display:none!important}
    .gj-solo-card{
      width:min(94vw,560px);max-height:88vh;overflow:auto;background:rgba(15,23,42,.96);
      border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:20px 18px 18px;color:#e5e7eb;
      box-shadow:0 28px 64px rgba(0,0,0,.35)
    }
    .gj-solo-kicker{
      display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;
      background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.25);color:#7dd3fc;font-weight:900;font-size:13px;margin-bottom:12px
    }
    .gj-solo-title{margin:0 0 8px;font-size:30px;line-height:1.1}
    .gj-solo-sub{margin:0;color:#94a3b8;font-size:14px;line-height:1.6}
    .gj-solo-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}
    .gj-solo-item{border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:12px;background:rgba(2,6,23,.45)}
    .gj-solo-item .label{color:#94a3b8;font-size:12px;font-weight:800;margin-bottom:6px}
    .gj-solo-item .value{color:#e5e7eb;font-size:20px;font-weight:900}
    .gj-solo-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}

    .btn{
      appearance:none;border:0;cursor:pointer;border-radius:14px;padding:12px 16px;font-weight:900;font-size:14px;transition:.12s ease
    }
    .btn:hover{transform:translateY(-1px);filter:brightness(1.04)}
    .btn:active{transform:translateY(0)}
    .btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
    .btn-blue{background:#38bdf8;color:#082f49}
    .btn-good{background:#22c55e;color:#052e16}
    .btn-warn{background:#f59e0b;color:#3b1d00}
    .btn-ghost{background:rgba(255,255,255,.06);color:#e5e7eb;border:1px solid rgba(148,163,184,.18)}

    @media (max-width:640px){
      .gj-topbar{padding-left:10px;padding-right:10px}
      .gj-chip{font-size:12px;padding:7px 9px}
      .gj-emoji{font-size:28px}
      .gj-solo-title{font-size:26px}
      .gj-solo-actions .btn{flex:1 1 calc(50% - 10px)}
      .gj-boss{width:148px;height:104px}
      .gj-boss-face{font-size:48px}
      .gj-boss-hud{width:min(92vw,420px)}
      .gj-boss-wrap{height:158px}
    }
  `;
  document.head.appendChild(style);
}

function buildGameplayShell() {
  GAME_MOUNT.innerHTML = `
    <div id="${GOODJUNK_ROOT_ID}" class="phase-1">
      <div class="gj-shell">
        <header class="gj-topbar">
          <div class="gj-chip-row">
            <div class="gj-chip"><span>Score</span><strong id="gjScore">0</strong></div>
            <div class="gj-chip"><span>Time</span><strong id="gjTimer">0</strong></div>
            <div class="gj-chip"><span>Miss</span><strong id="gjMiss">0</strong></div>
            <div class="gj-chip"><span>Streak</span><strong id="gjStreak">0</strong></div>
          </div>
          <div class="gj-chip-row">
            <div class="gj-chip phase"><span>PHASE</span><strong id="gjPhaseBadge">1</strong></div>
            <div class="gj-chip"><span>GOAL</span><strong id="gjPhaseSub">เก็บอาหารดี สร้างคอมโบ</strong></div>
          </div>
        </header>

        <div class="gj-stage-wrap">
          <div class="gj-stage" id="gjStage">
            <div class="gj-center-tip" id="gjCenterTip">แตะอาหารดีเพื่อได้คะแนน • อย่าแตะ junk • สะสมคะแนนให้ถึงบอส</div>

            <div class="gj-boss-wrap" id="gjBossWrap" hidden>
              <div class="gj-boss-hud">
                <div class="gj-boss-hud-top">
                  <div class="gj-boss-kicker">BOSS PHASE</div>
                  <div class="gj-boss-name" id="gjBossName">Junk King</div>
                </div>
                <div class="gj-boss-hp-track">
                  <div class="gj-boss-hp-fill" id="gjBossHpFill"></div>
                </div>
                <div class="gj-boss-hp-text" id="gjBossHpText">0 / 0</div>
              </div>

              <div class="gj-boss" id="gjBoss">
                <div class="gj-boss-label">👑 JUNK KING</div>
                <div class="gj-boss-face" id="gjBossFace">🍔</div>
                <button type="button" class="gj-weakspot" id="gjBossWeakSpot" hidden>🎯</button>
              </div>
            </div>

            <div class="gj-target-layer" id="gjTargetLayer"></div>
          </div>
        </div>

        <div class="gj-bottom">
          <div class="gj-bottom-card">
            <div class="gj-bottom-top">
              <div class="gj-legend" id="gjStatsText">
                <div><strong>Good hit:</strong> 0</div>
                <div><strong>Power hit:</strong> 0</div>
                <div><strong>Junk hit:</strong> 0</div>
                <div><strong>Good missed:</strong> 0</div>
              </div>
              <div class="gj-legend" id="gjHintText">
                <div>Tip: เก็บของดีให้ต่อเนื่องเพื่อเร่งคอมโบ</div>
              </div>
            </div>
            <div class="gj-progress"><div class="gj-progress-bar" id="gjProgressBar"></div></div>
          </div>
        </div>
      </div>

      <div class="gj-solo-overlay" id="gjSoloSummary" hidden>
        <div class="gj-solo-card">
          <div class="gj-solo-kicker">SOLO SUMMARY</div>
          <h2 class="gj-solo-title" id="gjSoloTitle">สรุปผลการเล่น</h2>
          <p class="gj-solo-sub" id="gjSoloSub">เกมจบแล้ว มาดูผลของรอบนี้กัน</p>
          <div class="gj-solo-list" id="gjSoloBody"></div>
          <div class="gj-solo-actions">
            <button class="btn btn-blue" id="gjSoloAgain" type="button">เล่นใหม่</button>
            <button class="btn btn-warn" id="gjSoloExport" type="button">Export JSON</button>
            <button class="btn btn-ghost" id="gjSoloHub" type="button">กลับ HUB</button>
          </div>
        </div>
      </div>
    </div>
  `;

  ui.root = document.getElementById(GOODJUNK_ROOT_ID);
  ui.shell = ui.root;
  ui.stage = document.getElementById('gjStage');
  ui.layer = document.getElementById('gjTargetLayer');

  ui.score = document.getElementById('gjScore');
  ui.timer = document.getElementById('gjTimer');
  ui.miss = document.getElementById('gjMiss');
  ui.streak = document.getElementById('gjStreak');
  ui.phaseBadge = document.getElementById('gjPhaseBadge');
  ui.phaseSub = document.getElementById('gjPhaseSub');

  ui.hint = document.getElementById('gjHintText');
  ui.progress = document.getElementById('gjProgressBar');
  ui.stats = document.getElementById('gjStatsText');
  ui.centerTip = document.getElementById('gjCenterTip');

  ui.bossWrap = document.getElementById('gjBossWrap');
  ui.boss = document.getElementById('gjBoss');
  ui.bossFace = document.getElementById('gjBossFace');
  ui.bossName = document.getElementById('gjBossName');
  ui.bossHpFill = document.getElementById('gjBossHpFill');
  ui.bossHpText = document.getElementById('gjBossHpText');
  ui.bossWeakSpot = document.getElementById('gjBossWeakSpot');

  ui.soloOverlay = document.getElementById('gjSoloSummary');
  ui.soloBody = document.getElementById('gjSoloBody');
  ui.soloTitle = document.getElementById('gjSoloTitle');
  ui.soloSub = document.getElementById('gjSoloSub');
  ui.soloBtnAgain = document.getElementById('gjSoloAgain');
  ui.soloBtnExport = document.getElementById('gjSoloExport');
  ui.soloBtnHub = document.getElementById('gjSoloHub');

  refreshStageRect();
  renderHud();
  renderBoss();
}

function bindGameplayShell() {
  ui.soloBtnAgain?.addEventListener('click', () => {
    location.href = buildReplayUrl();
  });

  ui.soloBtnExport?.addEventListener('click', () => {
    downloadJson(__gjSoloSummary, `goodjunk-phaseboss-${safeFilePart(GJ_PID)}-${Date.now()}.json`);
  });

  ui.soloBtnHub?.addEventListener('click', () => {
    location.href = GJ_HUB;
  });

  ui.bossWeakSpot?.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    hitBossWeakSpot();
  }, { passive: false });
}

function refreshStageRect() {
  const rect = ui.stage?.getBoundingClientRect();
  if (!rect) return;
  state.rect.width = Math.max(320, rect.width);
  state.rect.height = Math.max(360, rect.height);

  if (state.bossActive) {
    const limitX = Math.max(0, state.rect.width - state.boss.w - 8);
    state.boss.x = clamp(state.boss.x, 8, limitX);
    renderBoss();
  }
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

function rand(){ return rng(); }
function randRange(min, max){ return min + (max - min) * rand(); }
function clamp(value, min, max){ return Math.max(min, Math.min(max, value)); }
function clampInt(value, min, max){ return Math.max(min, Math.min(max, Math.floor(value))); }
function pick(arr){ return arr[Math.floor(rand() * arr.length)] || arr[0]; }

function getPreset() {
  return DIFF_PRESET[state.diff] || DIFF_PRESET.normal;
}

function startGame() {
  if (state.running || state.ended) return;

  const baseTime = clampInt(Number(RUN_CTX.time || 120) * 1000, 60000, 600000);

  state.totalMs = baseTime;
  state.timeLeftMs = baseTime;

  state.score = 0;
  state.miss = 0;
  state.streak = 0;
  state.bestStreak = 0;

  state.hitsGood = 0;
  state.hitsBad = 0;
  state.hitsPower = 0;
  state.missedGood = 0;

  state.spawnedGood = 0;
  state.spawnedJunk = 0;
  state.spawnedPower = 0;

  state.running = true;
  state.ended = false;
  state.won = false;

  state.startTs = performance.now();
  state.lastFrameTs = state.startTs;
  state.lastSpawnAccum = 0;
  state.frameRaf = 0;
  state.targetSeq = 0;
  state.targets.clear();

  state.phase = 1;
  state.phaseLabel = 'Phase 1';
  state.phaseChangedAt = state.startTs;
  state.phase2BurstCd = 2400;

  state.bossActive = false;
  state.bossIntroShown = false;
  state.bossDefeated = false;

  state.boss.hp = 0;
  state.boss.hpMax = 0;
  state.boss.x = Math.max(8, (state.rect.width - state.boss.w) / 2);
  state.boss.y = 28;
  state.boss.vx = 120;
  state.boss.stunMs = 0;
  state.boss.weakSpotReady = false;
  state.boss.weakSpotOpenMs = 0;
  state.boss.weakSpotCd = 0;
  state.boss.stormCd = 0;
  state.boss.powerCd = 0;
  state.boss.enrage = false;

  ui.layer.innerHTML = '';
  ui.soloOverlay.hidden = true;

  setPhaseVisualClass();
  hideBossPhaseUi();

  showCenterTip('แตะอาหารดีเพื่อได้คะแนน • สะสมคอมโบ • ผ่าน Phase 1 และ 2 เพื่อไปสู้ Junk King');
  updateHint('เริ่มรอบแล้ว! เก็บของดีให้ต่อเนื่อง');

  renderHud();
  renderBoss();

  loop(performance.now());
}

function loop(ts) {
  if (!state.running || state.ended) return;

  const dt = Math.min(48, ts - state.lastFrameTs || 16);
  state.lastFrameTs = ts;

  state.timeLeftMs -= dt;
  if (state.timeLeftMs <= 0) {
    state.timeLeftMs = 0;
    renderHud();

    if (state.bossActive && state.boss.hp > 0) {
      endGame('boss-timeout');
    } else {
      endGame('time-up');
    }
    return;
  }

  updatePhaseProgress(dt, ts);
  updateSpawner(dt);
  updateTargets(dt);

  if (state.bossActive) {
    updateBossPhase(dt);
  }

  renderHud();
  state.frameRaf = requestAnimationFrame(loop);
}

function updatePhaseProgress(dt, ts) {
  const preset = getPreset();
  const elapsedRatio = 1 - (state.timeLeftMs / state.totalMs);

  if (!state.bossActive) {
    if (state.phase === 1) {
      const reachedScore = state.score >= preset.phase1TargetScore;
      const reachedTime = elapsedRatio >= 0.34;
      if (reachedScore || reachedTime) {
        startPhase2();
      }
    } else if (state.phase === 2) {
      state.phase2BurstCd -= dt;

      if (state.phase2BurstCd <= 0) {
        state.phase2BurstCd = randRange(2600, 3600);
        spawnPhase2Burst();
      }

      const reachedScore = state.score >= preset.phase2TargetScore;
      const reachedTime = elapsedRatio >= 0.70;
      if (reachedScore || reachedTime) {
        startBossPhase();
      }
    }
  }
}

function startPhase2() {
  if (state.phase >= 2) return;
  state.phase = 2;
  state.phaseLabel = 'Phase 2';
  state.phaseChangedAt = performance.now();
  setPhaseVisualClass();
  showCenterTip('Phase 2! เกมเร็วขึ้น junk มากขึ้น และจะมี rush burst');
  updateHint('Phase 2: อ่านเป้าให้ไวขึ้น อย่าหลุดของดี');
  renderHud();
}

function startBossPhase() {
  if (state.bossActive) return;

  const preset = getPreset();

  state.phase = 3;
  state.phaseLabel = 'Boss';
  state.phaseChangedAt = performance.now();
  state.bossActive = true;
  state.bossIntroShown = true;

  state.boss.hpMax = preset.bossHp;
  state.boss.hp = preset.bossHp;
  state.boss.x = Math.max(8, (state.rect.width - state.boss.w) / 2);
  state.boss.y = 28;
  state.boss.vx = state.diff === 'hard' ? 160 : state.diff === 'easy' ? 105 : 130;
  state.boss.stunMs = 0;
  state.boss.weakSpotReady = false;
  state.boss.weakSpotOpenMs = 0;
  state.boss.weakSpotCd = 1400;
  state.boss.stormCd = 1800;
  state.boss.powerCd = 1700;
  state.boss.enrage = false;

  clearHalfTargetsForBossEntry();
  showBossPhaseUi();
  setPhaseVisualClass();
  showCenterTip('BOSS INCOMING! เก็บของดีเพื่อลด HP บอส • แตะ weak spot ตอนเปิด • ระวัง junk storm');
  updateHint('Boss Phase: good = damage, power = heavy damage, weak spot = stun + big damage');
  renderHud();
  renderBoss();
}

function clearHalfTargetsForBossEntry() {
  const ids = Array.from(state.targets.keys());
  ids.forEach((id, idx) => {
    if (idx % 2 === 0) {
      removeTarget(id);
    }
  });
}

function getSpawnConfig() {
  const preset = getPreset();

  if (state.bossActive) {
    return {
      spawnMs: Math.max(260, preset.spawnMs * 0.62),
      goodRatio: state.diff === 'easy' ? 0.36 : state.diff === 'hard' ? 0.28 : 0.32,
      powerRatio: state.diff === 'easy' ? 0.17 : state.diff === 'hard' ? 0.12 : 0.14,
      speedMin: preset.speedMin * 1.28,
      speedMax: preset.speedMax * 1.48,
      targetSizeMin: Math.max(52, preset.targetSizeMin - 4),
      targetSizeMax: preset.targetSizeMax - 2
    };
  }

  if (state.phase === 2) {
    return {
      spawnMs: Math.max(360, preset.spawnMs * 0.76),
      goodRatio: clamp(preset.goodRatio - 0.08, 0.42, 0.84),
      powerRatio: 0,
      speedMin: preset.speedMin * 1.16,
      speedMax: preset.speedMax * 1.25,
      targetSizeMin: Math.max(52, preset.targetSizeMin - 2),
      targetSizeMax: preset.targetSizeMax - 1
    };
  }

  return {
    spawnMs: Math.max(420, preset.spawnMs * 1.08),
    goodRatio: clamp(preset.goodRatio + 0.08, 0.46, 0.90),
    powerRatio: 0,
    speedMin: preset.speedMin * 0.92,
    speedMax: preset.speedMax * 0.95,
    targetSizeMin: preset.targetSizeMin,
    targetSizeMax: preset.targetSizeMax
  };
}

function updateSpawner(dt) {
  const cfg = getSpawnConfig();
  state.lastSpawnAccum += dt;

  while (state.lastSpawnAccum >= cfg.spawnMs) {
    state.lastSpawnAccum -= cfg.spawnMs;
    spawnRandomTarget(cfg);
  }
}

function spawnRandomTarget(cfg) {
  if (!ui.layer) return;

  refreshStageRect();

  const roll = rand();
  let kind = 'junk';

  if (state.bossActive) {
    if (roll < cfg.powerRatio) kind = 'power';
    else if (roll < cfg.powerRatio + cfg.goodRatio) kind = 'good';
    else kind = 'junk';
  } else {
    kind = roll < cfg.goodRatio ? 'good' : 'junk';
  }

  spawnTarget(kind, cfg);
}

function spawnTarget(kind = 'good', cfg = null, overrides = {}) {
  const config = cfg || getSpawnConfig();
  const size = overrides.size || randRange(config.targetSizeMin, config.targetSizeMax);
  const x = overrides.x ?? randRange(10, Math.max(12, state.rect.width - size - 10));
  const y = overrides.y ?? (-size - randRange(0, 50));
  const speed = overrides.speed ?? randRange(config.speedMin, config.speedMax);
  const drift = overrides.drift ?? randRange(-42, 42);
  const id = `t-${++state.targetSeq}`;

  let emoji = '🍎';
  let label = 'good';
  let typeClass = 'good';
  let scoreGain = 10;
  let bossDamage = 0;

  if (kind === 'power') {
    const item = pick(POWER_ITEMS);
    emoji = item.emoji;
    label = item.label;
    typeClass = 'power';
    scoreGain = 18;
    bossDamage = getPreset().powerBossDamage;
    state.spawnedPower += 1;
  } else if (kind === 'junk') {
    const item = pick(JUNK_ITEMS);
    emoji = item.emoji;
    label = item.label;
    typeClass = 'junk';
    scoreGain = -8;
    bossDamage = 0;
    state.spawnedJunk += 1;
  } else {
    const item = pick(GOOD_ITEMS);
    emoji = item.emoji;
    label = item.label;
    typeClass = 'good';
    scoreGain = 10;
    bossDamage = state.bossActive ? getPreset().goodBossDamage : 0;
    state.spawnedGood += 1;
  }

  const el = document.createElement('button');
  el.type = 'button';
  el.className = `gj-target ${typeClass}`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.innerHTML = `
    <div class="gj-emoji">${emoji}</div>
    <div class="gj-type">${escapeHtml(kind)}</div>
  `;

  const target = {
    id,
    el,
    kind,
    label,
    x,
    y,
    size,
    speed,
    drift,
    dead: false,
    scoreGain,
    bossDamage
  };

  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    hitTarget(id);
  }, { passive: false });

  ui.layer.appendChild(el);
  state.targets.set(id, target);
  drawTarget(target);
}

function spawnPhase2Burst() {
  const cfg = getSpawnConfig();
  const count = state.diff === 'hard' ? 4 : 3;

  for (let i = 0; i < count; i++) {
    const size = randRange(cfg.targetSizeMin - 2, cfg.targetSizeMax + 2);
    spawnTarget(i === 0 ? 'good' : (rand() < 0.35 ? 'good' : 'junk'), cfg, {
      x: clamp(12 + (i * ((state.rect.width - size - 24) / Math.max(1, count - 1))), 8, state.rect.width - size - 8),
      y: -size - randRange(0, 18),
      speed: randRange(cfg.speedMin * 1.10, cfg.speedMax * 1.18),
      drift: randRange(-22, 22),
      size
    });
  }

  createFx(state.rect.width * 0.5, 88, 'RUSH!', '#fbbf24');
  updateHint('Phase 2 Rush: อ่านเป้าเร็วขึ้น');
}

function spawnBossStorm() {
  const count = state.diff === 'easy' ? 4 : state.diff === 'hard' ? 6 : 5;
  const cfg = getSpawnConfig();
  const spacing = state.rect.width / (count + 1);

  for (let i = 0; i < count; i++) {
    const size = randRange(54, 72);
    spawnTarget('junk', cfg, {
      x: clamp((spacing * (i + 1)) - (size / 2), 8, state.rect.width - size - 8),
      y: state.boss.y + state.boss.h - 14,
      speed: randRange(cfg.speedMax * 1.10, cfg.speedMax * 1.45),
      drift: randRange(-18, 18),
      size
    });
  }

  createFx(state.rect.width * 0.5, 92, 'JUNK STORM!', '#fda4af');
  updateHint('Boss ใช้ Junk Storm! เคลียร์จังหวะให้ดี');
}

function spawnBossPowerAid() {
  const cfg = getSpawnConfig();
  const size = randRange(62, 78);

  spawnTarget('power', cfg, {
    x: randRange(10, Math.max(12, state.rect.width - size - 10)),
    y: -size - 6,
    speed: randRange(cfg.speedMin * 0.90, cfg.speedMax * 1.02),
    drift: randRange(-26, 26),
    size
  });

  updateHint('Power food มาแล้ว! รีบแตะเพื่อเจาะบอสแรงขึ้น');
}

function updateTargets(dt) {
  const stageW = state.rect.width;
  const stageH = state.rect.height;
  const toRemove = [];

  state.targets.forEach((target) => {
    if (target.dead) {
      toRemove.push(target.id);
      return;
    }

    target.y += (target.speed * dt) / 1000;
    target.x += (target.drift * dt) / 1000;

    if (target.x < 6) {
      target.x = 6;
      target.drift *= -1;
    }
    if (target.x + target.size > stageW - 6) {
      target.x = stageW - target.size - 6;
      target.drift *= -1;
    }

    drawTarget(target);

    if (target.y > stageH + target.size * 0.6) {
      if (target.kind === 'good' || target.kind === 'power') registerMissGood(target);
      else removeTarget(target.id);
    }
  });

  toRemove.forEach(removeTarget);
}

function drawTarget(target) {
  target.el.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
}

function hitTarget(id) {
  if (!state.running || state.ended) return;
  const target = state.targets.get(id);
  if (!target || target.dead) return;

  if (target.kind === 'good') {
    state.hitsGood += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);

    const comboBonus = Math.min(12, Math.floor(state.streak / 3) * 2);
    const gain = target.scoreGain + comboBonus;
    state.score += gain;

    createFx(target.x + target.size / 2, target.y + target.size / 2, `+${gain}`, '#86efac');

    if (state.bossActive) {
      damageBoss(target.bossDamage, 'GOOD HIT');
      updateHint('โดนบอสแล้ว! เก็บของดีต่อเนื่องเพื่อลด HP');
    } else {
      updateHint('เยี่ยมมาก! คอมโบกำลังมา');
    }
  } else if (target.kind === 'power') {
    state.hitsPower += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);

    const gain = target.scoreGain + Math.min(10, Math.floor(state.streak / 4) * 2);
    state.score += gain;

    createFx(target.x + target.size / 2, target.y + target.size / 2, `POWER +${gain}`, '#fde68a');
    damageBoss(target.bossDamage, 'POWER!');
    state.boss.stunMs = Math.max(state.boss.stunMs, 650);
    updateHint('Power food โดนแล้ว! บอสชะงักและเสีย HP หนัก');
  } else {
    state.hitsBad += 1;
    state.miss += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - 8);

    createFx(target.x + target.size / 2, target.y + target.size / 2, 'MISS', '#fda4af');

    if (state.bossActive) {
      healBoss(4, 'BOSS HEAL');
      updateHint('โดน junk! บอสฟื้น HP เล็กน้อย');
    } else {
      updateHint('ระวัง junk! อ่านเป้าให้ชัด');
    }
  }

  removeTarget(id);
  renderHud();
}

function registerMissGood(target) {
  state.missedGood += 1;
  state.miss += 1;
  state.streak = 0;

  createFx(target.x + target.size / 2, Math.max(28, target.y), target.kind === 'power' ? 'พลาด POWER' : 'พลาดของดี', '#fbbf24');

  if (state.bossActive) {
    const heal = target.kind === 'power' ? 4 : 2;
    healBoss(heal, `+${heal} HP`);
    updateHint('ของดีหลุด! บอสได้จังหวะฟื้น');
  } else {
    updateHint('มีของดีหลุดไปแล้ว รีบกลับมาคุมจังหวะ');
  }

  removeTarget(target.id);
  renderHud();
}

function removeTarget(id) {
  const target = state.targets.get(id);
  if (!target) return;
  target.dead = true;
  target.el.remove();
  state.targets.delete(id);
}

function updateBossPhase(dt) {
  const preset = getPreset();
  const boss = state.boss;

  if (!state.bossActive || state.ended) return;

  if (boss.hp <= 0) {
    endGame('boss-clear');
    return;
  }

  const limitX = Math.max(8, state.rect.width - boss.w - 8);

  if (boss.stunMs > 0) {
    boss.stunMs -= dt;
  } else {
    boss.x += (boss.vx * dt) / 1000;
    if (boss.x <= 8) {
      boss.x = 8;
      boss.vx = Math.abs(boss.vx);
    }
    if (boss.x >= limitX) {
      boss.x = limitX;
      boss.vx = -Math.abs(boss.vx);
    }
  }

  const enrageNow = boss.hp <= boss.hpMax * 0.38;
  if (enrageNow && !boss.enrage) {
    boss.enrage = true;
    boss.vx *= 1.25;
    updateHint('ENRAGE! Junk King เร็วขึ้นและ storm ถี่ขึ้น');
    showCenterTip('ENRAGE! บอสเดือดแล้ว รีบโจมตี weak spot และเก็บ power food');
    setPhaseVisualClass();
  }

  boss.stormCd -= dt;
  boss.weakSpotCd -= dt;
  boss.powerCd -= dt;

  if (boss.stormCd <= 0) {
    spawnBossStorm();
    boss.stormCd = boss.enrage ? preset.stormEveryMs * 0.72 : preset.stormEveryMs;
  }

  if (boss.powerCd <= 0) {
    spawnBossPowerAid();
    boss.powerCd = boss.enrage ? 2200 : 2800;
  }

  if (!boss.weakSpotReady && boss.weakSpotCd <= 0) {
    openBossWeakSpot();
  }

  if (boss.weakSpotReady) {
    boss.weakSpotOpenMs -= dt;
    if (boss.weakSpotOpenMs <= 0) {
      closeBossWeakSpot();
    }
  }

  renderBoss();
}

function openBossWeakSpot() {
  const preset = getPreset();
  state.boss.weakSpotReady = true;
  state.boss.weakSpotOpenMs = preset.weakSpotOpenMs;
  ui.bossWeakSpot.hidden = false;
  createFx(state.boss.x + state.boss.w * 0.78, state.boss.y + state.boss.h * 0.72, 'WEAK SPOT!', '#fde68a');
}

function closeBossWeakSpot() {
  const preset = getPreset();
  state.boss.weakSpotReady = false;
  state.boss.weakSpotOpenMs = 0;
  state.boss.weakSpotCd = state.boss.enrage ? preset.weakSpotEveryMs * 0.75 : preset.weakSpotEveryMs;
  ui.bossWeakSpot.hidden = true;
}

function hitBossWeakSpot() {
  if (!state.running || state.ended || !state.bossActive || !state.boss.weakSpotReady) return;

  const damage = getPreset().weakSpotDamage;
  closeBossWeakSpot();
  state.boss.stunMs = Math.max(state.boss.stunMs, 1100);

  state.score += 14;
  createFx(state.boss.x + state.boss.w * 0.74, state.boss.y + state.boss.h * 0.60, `CRIT -${damage}`, '#fde68a');
  damageBoss(damage, 'CRITICAL');
  updateHint('Critical hit! บอสชะงัก รีบเก็บ good/power ซ้ำ');
  renderHud();
}

function damageBoss(amount = 0, label = '') {
  if (!state.bossActive || amount <= 0) return;

  state.boss.hp = Math.max(0, state.boss.hp - amount);

  if (label) {
    createFx(state.boss.x + state.boss.w / 2, state.boss.y + 14, label, '#fecaca');
  }

  renderBoss();

  if (state.boss.hp <= 0) {
    state.boss.hp = 0;
    renderBoss();
    endGame('boss-clear');
  }
}

function healBoss(amount = 0, label = '') {
  if (!state.bossActive || amount <= 0 || state.boss.hp <= 0) return;

  state.boss.hp = Math.min(state.boss.hpMax, state.boss.hp + amount);

  if (label) {
    createFx(state.boss.x + state.boss.w / 2, state.boss.y + 16, label, '#fda4af');
  }

  renderBoss();
}

function showBossPhaseUi() {
  ui.bossWrap.hidden = false;
  renderBoss();
}

function hideBossPhaseUi() {
  ui.bossWrap.hidden = true;
  ui.bossWeakSpot.hidden = true;
}

function renderBoss() {
  if (!ui.boss || !ui.bossWrap) return;

  if (!state.bossActive) {
    hideBossPhaseUi();
    return;
  }

  showBossPhaseUi();

  ui.boss.style.transform = `translate3d(${state.boss.x}px, ${state.boss.y}px, 0)`;
  ui.boss.classList.toggle('enrage', !!state.boss.enrage);
  ui.bossFace.textContent = state.boss.enrage ? '😈' : '🍔';
  ui.bossName.textContent = state.boss.enrage ? 'Junk King • ENRAGE' : 'Junk King';

  const hpRatio = state.boss.hpMax > 0 ? state.boss.hp / state.boss.hpMax : 0;
  ui.bossHpFill.style.transform = `scaleX(${Math.max(0, Math.min(1, hpRatio))})`;
  ui.bossHpText.textContent = `${Math.ceil(state.boss.hp)} / ${Math.ceil(state.boss.hpMax)}`;
  ui.bossWeakSpot.hidden = !state.boss.weakSpotReady;
}

function setPhaseVisualClass() {
  if (!ui.root) return;

  ui.root.classList.remove('phase-1', 'phase-2', 'phase-boss', 'enrage');

  if (state.phase === 1) {
    ui.root.classList.add('phase-1');
  } else if (state.phase === 2) {
    ui.root.classList.add('phase-2');
  } else {
    ui.root.classList.add('phase-boss');
    if (state.boss.enrage) ui.root.classList.add('enrage');
  }
}

function createFx(x, y, text, color) {
  const fx = document.createElement('div');
  fx.className = 'gj-fx';
  fx.style.left = `${x}px`;
  fx.style.top = `${y}px`;
  fx.style.color = color || '#e5e7eb';
  fx.textContent = text;
  ui.layer?.appendChild(fx);
  setTimeout(() => fx.remove(), 760);
}

function showCenterTip(message) {
  if (!ui.centerTip) return;
  ui.centerTip.textContent = String(message || '');
  ui.centerTip.classList.remove('hide');

  clearTimeout(showCenterTip.__timer);
  showCenterTip.__timer = setTimeout(() => {
    ui.centerTip?.classList.add('hide');
  }, 1900);
}

function updateHint(message) {
  if (!ui.hint) return;
  ui.hint.innerHTML = `<div>${escapeHtml(message)}</div>`;
}

function renderHud() {
  if (ui.score) ui.score.textContent = String(state.score);
  if (ui.timer) ui.timer.textContent = formatSeconds(state.timeLeftMs);
  if (ui.miss) ui.miss.textContent = String(state.miss);
  if (ui.streak) ui.streak.textContent = String(state.streak);

  if (ui.phaseBadge) {
    ui.phaseBadge.textContent = state.bossActive ? 'BOSS' : String(state.phase);
  }

  if (ui.phaseSub) {
    const preset = getPreset();
    if (state.bossActive) {
      ui.phaseSub.textContent = state.boss.enrage
        ? 'ตี weak spot • ใช้ power food • boss enrage'
        : 'ตี weak spot • good = damage • junk storm incoming';
    } else if (state.phase === 2) {
      ui.phaseSub.textContent = `เร่งคะแนนสู่บอส • เป้าหมาย ${preset.phase2TargetScore}`;
    } else {
      ui.phaseSub.textContent = `สะสมคะแนน • เป้าหมาย ${preset.phase1TargetScore}`;
    }
  }

  if (ui.progress) {
    const ratio = state.totalMs > 0 ? state.timeLeftMs / state.totalMs : 0;
    ui.progress.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
  }

  if (ui.stats) {
    ui.stats.innerHTML = `
      <div><strong>Good hit:</strong> ${state.hitsGood}</div>
      <div><strong>Power hit:</strong> ${state.hitsPower}</div>
      <div><strong>Junk hit:</strong> ${state.hitsBad}</div>
      <div><strong>Good missed:</strong> ${state.missedGood}</div>
    `;
  }

  setPhaseVisualClass();
}

function formatSeconds(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

let __gjSoloSummary = null;

function endGame(reason = 'finished') {
  if (state.ended) return;

  state.ended = true;
  state.running = false;
  cancelAnimationFrame(state.frameRaf);
  state.frameRaf = 0;

  state.targets.forEach((t) => t.el.remove());
  state.targets.clear();

  if (reason === 'boss-clear') {
    state.won = true;
    state.bossDefeated = true;
    updateHint('คุณชนะ Junk King แล้ว!');
  }

  const summary = {
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
    score: state.score,
    miss: state.miss,
    streak: state.bestStreak,
    bestStreak: state.bestStreak,
    hitsGood: state.hitsGood,
    hitsBad: state.hitsBad,
    hitsPower: state.hitsPower,
    missedGood: state.missedGood,
    spawnedGood: state.spawnedGood,
    spawnedJunk: state.spawnedJunk,
    spawnedPower: state.spawnedPower,
    phaseReached: state.bossActive ? 'boss' : `phase-${state.phase}`,
    bossActive: state.bossActive,
    bossDefeated: !!state.bossDefeated,
    bossHpLeft: Number(state.boss.hp || 0),
    bossHpMax: Number(state.boss.hpMax || 0),
    updatedAt: Date.now()
  };

  showSoloSummary(summary);
}

function showSoloSummary(summary) {
  __gjSoloSummary = buildSoloSummaryPayload(summary);
  persistSoloSummary(__gjSoloSummary);

  if (!ui.soloOverlay || !ui.soloBody) return;

  if (summary.reason === 'boss-clear') {
    ui.soloTitle.textContent = 'ชนะ Junk King!';
    ui.soloSub.textContent = 'ยอดเยี่ยมมาก คุณผ่านทั้ง Phase 1, Phase 2 และโค่นบอสได้สำเร็จ';
  } else if (summary.reason === 'boss-timeout') {
    ui.soloTitle.textContent = 'บอสยังไม่แตก';
    ui.soloSub.textContent = 'คุณเข้าถึงบอสแล้ว แต่เวลาไม่พอ ลองเร่งคะแนนและเก็บ weak spot ให้มากขึ้น';
  } else if (summary.phaseReached === 'phase-2') {
    ui.soloTitle.textContent = 'ไปได้ถึง Phase 2';
    ui.soloSub.textContent = 'อีกนิดเดียวก็ถึงบอสแล้ว ลองคุม miss และเร่งคอมโบให้สูงขึ้น';
  } else {
    ui.soloTitle.textContent = 'สรุปผลการเล่น';
    ui.soloSub.textContent = 'เริ่มต้นได้ดี ลองเก็บของดีให้แม่นขึ้นเพื่อดันเข้าสู่บอสให้เร็วขึ้น';
  }

  ui.soloBody.innerHTML = `
    <div class="gj-solo-item"><div class="label">คะแนน</div><div class="value">${__gjSoloSummary.score}</div></div>
    <div class="gj-solo-item"><div class="label">Miss</div><div class="value">${__gjSoloSummary.miss}</div></div>
    <div class="gj-solo-item"><div class="label">Best Streak</div><div class="value">${__gjSoloSummary.bestStreak}</div></div>
    <div class="gj-solo-item"><div class="label">Phase Reached</div><div class="value">${escapeHtml(__gjSoloSummary.phaseReached)}</div></div>
    <div class="gj-solo-item"><div class="label">Good hit</div><div class="value">${__gjSoloSummary.hitsGood}</div></div>
    <div class="gj-solo-item"><div class="label">Power hit</div><div class="value">${__gjSoloSummary.hitsPower}</div></div>
    <div class="gj-solo-item"><div class="label">Junk hit</div><div class="value">${__gjSoloSummary.hitsBad}</div></div>
    <div class="gj-solo-item"><div class="label">Good missed</div><div class="value">${__gjSoloSummary.missedGood}</div></div>
    <div class="gj-solo-item"><div class="label">Boss Defeated</div><div class="value">${__gjSoloSummary.bossDefeated ? 'YES' : 'NO'}</div></div>
    <div class="gj-solo-item"><div class="label">Boss HP Left</div><div class="value">${Math.max(0, Math.ceil(__gjSoloSummary.bossHpLeft || 0))}</div></div>
  `;

  ui.soloOverlay.hidden = false;
}

function buildSoloSummaryPayload(summary) {
  return {
    version: '20260317-goodjunk-phaseboss-summary',
    source: 'goodjunk-phaseboss',
    gameId: GJ_GAME_ID,
    title: 'GoodJunk Phase Boss',
    mode: 'solo',
    pid: GJ_PID,
    name: GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    diff: state.diff,
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    seed: RUN_CTX.seed || '',
    finishType: summary.reason === 'boss-clear' ? 'boss-clear' : 'normal',
    dnfReason: '',
    rank: null,
    roomId: '',
    playerCount: 1,
    allFinished: true,
    raceStatusFinal: 'solo',
    score: Number(summary.score || 0),
    miss: Number(summary.miss || 0),
    bestStreak: Number(summary.bestStreak || 0),
    hitsGood: Number(summary.hitsGood || 0),
    hitsBad: Number(summary.hitsBad || 0),
    hitsPower: Number(summary.hitsPower || 0),
    missedGood: Number(summary.missedGood || 0),
    phaseReached: String(summary.phaseReached || `phase-${state.phase}`),
    bossDefeated: !!summary.bossDefeated,
    bossHpLeft: Number(summary.bossHpLeft || 0),
    bossHpMax: Number(summary.bossHpMax || 0),
    reason: String(summary.reason || ''),
    updatedAt: Date.now()
  };
}

function persistSoloSummary(summary) {
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
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
      source: summary.source,
      gameId: summary.gameId,
      title: summary.title,
      mode: summary.mode,
      pid: summary.pid,
      studyId: summary.studyId,
      roomId: summary.roomId,
      score: summary.score,
      miss: summary.miss,
      streak: summary.bestStreak,
      rank: summary.rank,
      finishType: summary.finishType,
      dnfReason: summary.dnfReason,
      playerCount: summary.playerCount,
      allFinished: summary.allFinished,
      raceStatusFinal: summary.raceStatusFinal,
      phaseReached: summary.phaseReached,
      bossDefeated: summary.bossDefeated,
      bossHpLeft: summary.bossHpLeft,
      updatedAt: summary.updatedAt
    }));
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent('gj:solo-summary', { detail: summary }));
    window.dispatchEvent(new CustomEvent('hha:solo-summary', { detail: summary }));
  } catch {}
}

function downloadJson(payload, filename = `goodjunk-${Date.now()}.json`) {
  if (!payload) return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
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

function buildReplayUrl() {
  const q = new URLSearchParams({
    pid: GJ_PID,
    name: GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    diff: state.diff,
    time: String(Math.max(60, Math.round(state.totalMs / 1000))),
    seed: String(Date.now()),
    hub: GJ_HUB,
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    gameId: GJ_GAME_ID,
    mode: 'solo'
  });

  return `./goodjunk-vr.html?${q.toString()}`;
}