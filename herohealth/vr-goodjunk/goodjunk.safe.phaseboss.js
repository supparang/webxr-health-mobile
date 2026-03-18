const __qs = new URLSearchParams(location.search);
const RUN_CTX = window.__GJ_RUN_CTX__ || {
  pid: __qs.get('pid') || 'anon',
  name: __qs.get('name') || '',
  studyId: __qs.get('studyId') || '',
  roomId: '',
  mode: 'solo',
  diff: (__qs.get('diff') || 'normal').toLowerCase(),
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

const GOOD_ITEMS = ['🍎','🥕','🥦','🍌','🥛','🥗','🍉'];
const JUNK_ITEMS = ['🍟','🍩','🍭','🍔','🥤','🍕','🧁'];
const POWER_ITEMS = ['⭐','⚡','💚'];

const PRESET = {
  easy:   { spawnMs: 900, goodRatio: .70, speedMin: 90,  speedMax: 150, phase1: 55, phase2: 135, bossHp: 120 },
  normal: { spawnMs: 760, goodRatio: .63, speedMin: 110, speedMax: 190, phase1: 65, phase2: 165, bossHp: 150 },
  hard:   { spawnMs: 610, goodRatio: .58, speedMin: 130, speedMax: 240, phase1: 75, phase2: 185, bossHp: 185 }
};

const state = {
  diff: PRESET[RUN_CTX.diff] ? RUN_CTX.diff : 'normal',
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
  running: false,
  ended: false,
  phase: 1,
  bossActive: false,
  bossTriggered: false,
  bossDefeated: false,
  lastFrameTs: 0,
  lastSpawnAccum: 0,
  frameRaf: 0,
  targetSeq: 0,
  targets: new Map(),
  rect: { width: 0, height: 0 },
  boss: {
    hp: 0, hpMax: 0, x: 0, y: 28, w: 168, h: 118,
    vx: 130, weakSpotReady: false, weakSpotCd: 0, weakSpotOpenMs: 0,
    stunMs: 0, stormCd: 0, powerCd: 0, enrage: false
  }
};

const ui = {};
const rng = createSeededRng(RUN_CTX.seed || Date.now());

boot();

function boot(){
  injectStyle();
  buildShell();
  bindUi();
  hideBootShell();
  startGame();
  window.addEventListener('resize', refreshStageRect);
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
function randRange(min,max){ return min + (max-min)*rand(); }
function clamp(v,min,max){ return Math.max(min, Math.min(max,v)); }

function injectStyle(){
  if (document.getElementById('gj-phaseboss-style-lock1')) return;
  const style = document.createElement('style');
  style.id = 'gj-phaseboss-style-lock1';
  style.textContent = `
    #gjRoot{position:absolute;inset:0;z-index:2;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation}
    .gj-shell{position:absolute;inset:0;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden}
    .gj-topbar{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;padding:60px 14px 12px;padding-top:calc(60px + env(safe-area-inset-top,0px));pointer-events:none}
    .gj-chip-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .gj-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.66);color:#e5e7eb;font-weight:900;font-size:13px;backdrop-filter:blur(8px)}
    .gj-chip span{color:#94a3b8}
    .gj-stage-wrap{position:relative;min-height:0;padding:8px 10px 10px}
    .gj-stage{position:relative;width:100%;height:100%;min-height:360px;overflow:hidden;border:1px solid rgba(148,163,184,.18);border-radius:26px;background:radial-gradient(circle at 50% 0%, rgba(56,189,248,.09), transparent 30%),linear-gradient(180deg, rgba(15,23,42,.74), rgba(2,6,23,.82))}
    .gj-target-layer{position:absolute;inset:0;overflow:hidden}
    .gj-center-tip{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(86vw,460px);padding:16px 18px;border-radius:18px;background:rgba(2,6,23,.56);border:1px solid rgba(148,163,184,.18);color:#e5e7eb;text-align:center;font-weight:900;backdrop-filter:blur(6px);pointer-events:none;transition:opacity .35s ease}
    .gj-center-tip.hide{opacity:0}
    .gj-target{position:absolute;display:grid;place-items:center;border-radius:22px;border:1px solid rgba(255,255,255,.16);box-shadow:0 14px 28px rgba(0,0,0,.18);cursor:pointer;outline:none;padding:0;overflow:hidden;background:rgba(15,23,42,.78)}
    .gj-target.good{background:linear-gradient(180deg, rgba(34,197,94,.30), rgba(34,197,94,.18)),rgba(15,23,42,.84)}
    .gj-target.power{background:linear-gradient(180deg, rgba(250,204,21,.36), rgba(234,179,8,.18)),rgba(15,23,42,.88)}
    .gj-target.junk{background:linear-gradient(180deg, rgba(244,63,94,.26), rgba(244,63,94,.14)),rgba(15,23,42,.84)}
    .gj-emoji{font-size:32px;line-height:1}
    .gj-type{position:absolute;left:8px;right:8px;bottom:6px;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#e2e8f0;opacity:.92;text-align:center}
    .gj-fx{position:absolute;font-size:16px;font-weight:900;pointer-events:none;transform:translate(-50%,-50%);animation:gj-fx-up .75s ease forwards}
    @keyframes gj-fx-up{from{opacity:1;transform:translate(-50%,-20%)}to{opacity:0;transform:translate(-50%,-140%)}}
    .gj-bottom{padding:0 12px calc(12px + env(safe-area-inset-bottom,0px))}
    .gj-bottom-card{border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:12px;background:rgba(2,6,23,.62);backdrop-filter:blur(8px)}
    .gj-bottom-top{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
    .gj-progress{position:relative;width:100%;height:12px;border-radius:999px;overflow:hidden;border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.06)}
    .gj-progress-bar{width:100%;height:100%;background:linear-gradient(90deg, rgba(56,189,248,.85), rgba(34,197,94,.85));transform-origin:left center;transition:transform .12s linear}
    .gj-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:13px;color:#cbd5e1;line-height:1.5}
    .gj-legend strong{color:#e5e7eb}
    .gj-boss-wrap{position:absolute;left:0;top:0;right:0;height:170px;pointer-events:none;z-index:4}
    .gj-boss-wrap[hidden]{display:none!important}
    .gj-boss{position:absolute;top:0;left:0;width:168px;height:118px;border-radius:28px;background:linear-gradient(180deg, rgba(127,29,29,.88), rgba(69,10,10,.94));border:1px solid rgba(248,113,113,.32);display:flex;align-items:center;justify-content:center;pointer-events:auto}
    .gj-boss-face{font-size:54px;line-height:1}
    .gj-boss-label{position:absolute;left:50%;top:-12px;transform:translateX(-50%);display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(127,29,29,.95);color:#fecaca;font-weight:900;font-size:12px;white-space:nowrap}
    .gj-weakspot{position:absolute;right:12px;bottom:10px;width:52px;height:52px;border-radius:999px;border:1px solid rgba(250,204,21,.45);background:rgba(250,204,21,.92);color:#422006;font-size:24px;font-weight:900;display:grid;place-items:center;cursor:pointer;pointer-events:auto}
    .gj-weakspot[hidden]{display:none!important}
    .gj-boss-hud{position:absolute;left:50%;top:8px;transform:translateX(-50%);width:min(86vw,420px);padding:10px 12px;border-radius:16px;border:1px solid rgba(248,113,113,.22);background:rgba(2,6,23,.62);backdrop-filter:blur(8px)}
    .gj-boss-hud-top{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}
    .gj-boss-kicker{display:inline-flex;align-items:center;gap:8px;padding:4px 10px;border-radius:999px;background:rgba(239,68,68,.12);color:#fecaca;font-weight:900;font-size:12px}
    .gj-boss-name{font-size:13px;font-weight:900;color:#fde68a}
    .gj-boss-hp-track{width:100%;height:14px;border-radius:999px;overflow:hidden;border:1px solid rgba(248,113,113,.22);background:rgba(255,255,255,.06)}
    .gj-boss-hp-fill{width:100%;height:100%;transform-origin:left center;background:linear-gradient(90deg, rgba(250,204,21,.92), rgba(239,68,68,.92));transition:transform .12s linear}
    .gj-boss-hp-text{margin-top:6px;text-align:right;color:#cbd5e1;font-size:12px;font-weight:800}
    .gj-solo-overlay{position:fixed;inset:0;z-index:10010;display:grid;place-items:center;padding:16px;background:rgba(2,6,23,.82);backdrop-filter:blur(10px)}
    .gj-solo-overlay[hidden]{display:none!important}
    .gj-solo-card{width:min(94vw,560px);max-height:88vh;overflow:auto;background:rgba(15,23,42,.96);border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:20px 18px 18px;color:#e5e7eb}
    .gj-solo-kicker{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.25);color:#7dd3fc;font-weight:900;font-size:13px;margin-bottom:12px}
    .gj-solo-title{margin:0 0 8px;font-size:30px;line-height:1.1}
    .gj-solo-sub{margin:0;color:#94a3b8;font-size:14px;line-height:1.6}
    .gj-solo-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}
    .gj-solo-item{border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:12px;background:rgba(2,6,23,.45)}
    .gj-solo-item .label{color:#94a3b8;font-size:12px;font-weight:800;margin-bottom:6px}
    .gj-solo-item .value{color:#e5e7eb;font-size:20px;font-weight:900}
    .gj-solo-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
    .btn{appearance:none;border:0;cursor:pointer;border-radius:14px;padding:12px 16px;font-weight:900;font-size:14px}
    .btn-blue{background:#38bdf8;color:#082f49}.btn-warn{background:#f59e0b;color:#3b1d00}.btn-ghost{background:rgba(255,255,255,.06);color:#e5e7eb;border:1px solid rgba(148,163,184,.18)}
  `;
  document.head.appendChild(style);
}

function buildShell(){
  GAME_MOUNT.innerHTML = `
    <div id="gjRoot" class="phase-1">
      <div class="gj-shell">
        <header class="gj-topbar">
          <div class="gj-chip-row">
            <div class="gj-chip"><span>Score</span><strong id="gjScore">0</strong></div>
            <div class="gj-chip"><span>Time</span><strong id="gjTimer">0</strong></div>
            <div class="gj-chip"><span>Miss</span><strong id="gjMiss">0</strong></div>
            <div class="gj-chip"><span>Streak</span><strong id="gjStreak">0</strong></div>
          </div>
          <div class="gj-chip-row">
            <div class="gj-chip"><span>PHASE</span><strong id="gjPhaseBadge">1</strong></div>
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
                <div class="gj-boss-hp-track"><div class="gj-boss-hp-fill" id="gjBossHpFill"></div></div>
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

  ui.root = document.getElementById('gjRoot');
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

function bindUi(){
  ui.soloBtnAgain?.addEventListener('click', () => {
    location.href = buildWarmupGateUrl(String(Date.now()));
  });
  ui.soloBtnExport?.addEventListener('click', () => {
    downloadJson(__gjSoloSummary, `goodjunk-phaseboss-${safeFilePart(GJ_PID)}-${Date.now()}.json`);
  });
  ui.soloBtnHub?.addEventListener('click', () => {
    location.href = buildCooldownGateUrl();
  });
  ui.bossWeakSpot?.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    hitBossWeakSpot();
  }, { passive:false });
}

function hideBootShell(){
  const boot = document.querySelector('.boot-shell');
  if (!boot) return;
  boot.style.transition = 'opacity .28s ease';
  boot.style.opacity = '0';
  setTimeout(() => { boot.style.display = 'none'; }, 320);
}

function refreshStageRect(){
  const rect = ui.stage?.getBoundingClientRect();
  if (!rect) return;
  state.rect.width = Math.max(320, rect.width);
  state.rect.height = Math.max(360, rect.height);
}

function getCfg(){
  return PRESET[state.diff] || PRESET.normal;
}

function startGame(){
  const cfg = getCfg();
  state.totalMs = Math.max(60000, Number(RUN_CTX.time || 150) * 1000);
  state.timeLeftMs = state.totalMs;
  state.score = 0;
  state.miss = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.hitsGood = 0;
  state.hitsBad = 0;
  state.hitsPower = 0;
  state.missedGood = 0;
  state.running = true;
  state.ended = false;
  state.phase = 1;
  state.bossActive = false;
  state.bossTriggered = false;
  state.bossDefeated = false;
  state.lastFrameTs = performance.now();
  state.lastSpawnAccum = 0;
  state.targets.clear();
  state.boss.hp = 0;
  state.boss.hpMax = cfg.bossHp;
  state.boss.x = Math.max(8, (state.rect.width - state.boss.w) / 2);
  state.boss.vx = state.diff === 'hard' ? 160 : 130;
  state.boss.weakSpotReady = false;
  state.boss.weakSpotCd = 1500;
  state.boss.weakSpotOpenMs = 0;
  state.boss.stormCd = 1800;
  state.boss.powerCd = 1700;
  state.boss.stunMs = 0;
  state.boss.enrage = false;

  ui.layer.innerHTML = '';
  ui.soloOverlay.hidden = true;
  showCenterTip('เริ่มรอบแล้ว! ผ่าน Phase 1 และ 2 เพื่อไปสู้บอส');
  renderHud();
  renderBoss();
  console.log('[GJ] startGame', { diff: state.diff, totalMs: state.totalMs });
  loop(performance.now());
}

function loop(ts){
  if (!state.running || state.ended) return;

  const dt = Math.min(48, ts - state.lastFrameTs || 16);
  state.lastFrameTs = ts;

  state.timeLeftMs -= dt;
  if (state.timeLeftMs <= 0) {
    state.timeLeftMs = 0;
    endGame(state.bossActive ? 'boss-timeout' : 'time-up');
    return;
  }

  updatePhase(dt);
  updateSpawner(dt);
  updateTargets(dt);
  if (state.bossActive) updateBoss(dt);

  renderHud();
  state.frameRaf = requestAnimationFrame(loop);
}

function updatePhase(dt){
  const cfg = getCfg();
  const elapsedRatio = 1 - (state.timeLeftMs / state.totalMs);

  if (!state.bossActive && state.phase === 1) {
    if (state.score >= cfg.phase1 || elapsedRatio >= 0.34) {
      state.phase = 2;
      showCenterTip('Phase 2! เกมเร็วขึ้น junk มากขึ้น');
      console.log('[GJ] enter phase 2');
    }
  }

  if (!state.bossActive && state.phase === 2) {
    if (state.score >= cfg.phase2 || elapsedRatio >= 0.70) {
      startBossPhase();
    }
  }
}

function startBossPhase(){
  if (state.bossActive || state.bossTriggered) return;
  const cfg = getCfg();

  state.phase = 3;
  state.bossTriggered = true;
  state.bossActive = true;
  state.boss.hp = cfg.bossHp;
  state.boss.hpMax = cfg.bossHp;
  state.boss.x = Math.max(8, (state.rect.width - state.boss.w) / 2);
  state.boss.weakSpotCd = 1200;
  state.boss.stormCd = 1800;
  state.boss.powerCd = 1600;

  Array.from(state.targets.keys()).forEach((id, i) => { if (i % 2 === 0) removeTarget(id); });

  showCenterTip('BOSS INCOMING! good = damage • power = heavy damage • weak spot = critical');
  updateHint('Boss Phase เริ่มแล้ว');
  renderBoss();
  renderHud();
  console.log('[GJ] startBossPhase() fired');
}

function getSpawnCfg(){
  const cfg = getCfg();

  if (state.bossActive) {
    return {
      spawnMs: Math.max(260, cfg.spawnMs * 0.62),
      goodRatio: state.diff === 'easy' ? 0.36 : 0.32,
      powerRatio: state.diff === 'hard' ? 0.12 : 0.14,
      speedMin: cfg.speedMin * 1.28,
      speedMax: cfg.speedMax * 1.48,
      sizeMin: 52,
      sizeMax: 78
    };
  }

  if (state.phase === 2) {
    return {
      spawnMs: Math.max(360, cfg.spawnMs * 0.76),
      goodRatio: Math.max(0.42, cfg.goodRatio - 0.08),
      powerRatio: 0,
      speedMin: cfg.speedMin * 1.16,
      speedMax: cfg.speedMax * 1.25,
      sizeMin: 54,
      sizeMax: 80
    };
  }

  return {
    spawnMs: Math.max(420, cfg.spawnMs * 1.08),
    goodRatio: Math.min(0.90, cfg.goodRatio + 0.08),
    powerRatio: 0,
    speedMin: cfg.speedMin * 0.92,
    speedMax: cfg.speedMax * 0.95,
    sizeMin: cfg.targetSizeMin || 58,
    sizeMax: cfg.targetSizeMax || 82
  };
}

function updateSpawner(dt){
  const cfg = getSpawnCfg();
  state.lastSpawnAccum += dt;

  while (state.lastSpawnAccum >= cfg.spawnMs) {
    state.lastSpawnAccum -= cfg.spawnMs;
    spawnRandomTarget(cfg);
  }
}

function spawnRandomTarget(cfg){
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

function spawnTarget(kind, cfg, overrides = {}){
  const size = overrides.size || randRange(cfg.sizeMin, cfg.sizeMax);
  const x = overrides.x ?? randRange(10, Math.max(12, state.rect.width - size - 10));
  const y = overrides.y ?? (-size - randRange(0, 50));
  const speed = overrides.speed ?? randRange(cfg.speedMin, cfg.speedMax);
  const drift = overrides.drift ?? randRange(-42, 42);
  const id = `t-${++state.targetSeq}`;

  let emoji = '🍎', scoreGain = 10, bossDamage = 0, klass = 'good';
  if (kind === 'power') {
    emoji = pick(POWER_ITEMS); scoreGain = 18; bossDamage = state.diff === 'hard' ? 14 : 16; klass = 'power';
  } else if (kind === 'junk') {
    emoji = pick(JUNK_ITEMS); scoreGain = -8; bossDamage = 0; klass = 'junk';
  } else {
    emoji = pick(GOOD_ITEMS); scoreGain = 10; bossDamage = state.bossActive ? (state.diff === 'hard' ? 6 : 7) : 0; klass = 'good';
  }

  const el = document.createElement('button');
  el.type = 'button';
  el.className = `gj-target ${klass}`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.innerHTML = `<div class="gj-emoji">${emoji}</div><div class="gj-type">${kind}</div>`;

  const target = { id, el, kind, x, y, size, speed, drift, dead:false, scoreGain, bossDamage };
  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    hitTarget(id);
  }, { passive:false });

  ui.layer.appendChild(el);
  state.targets.set(id, target);
  drawTarget(target);
}

function updateTargets(dt){
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

    if (target.x < 6) { target.x = 6; target.drift *= -1; }
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

function drawTarget(t){
  t.el.style.transform = `translate3d(${t.x}px, ${t.y}px, 0)`;
}

function hitTarget(id){
  if (!state.running || state.ended) return;
  const t = state.targets.get(id);
  if (!t || t.dead) return;

  if (t.kind === 'good') {
    state.hitsGood += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    const comboBonus = Math.min(12, Math.floor(state.streak / 3) * 2);
    const gain = t.scoreGain + comboBonus;
    state.score += gain;
    createFx(t.x + t.size/2, t.y + t.size/2, `+${gain}`, '#86efac');
    if (state.bossActive) damageBoss(t.bossDamage, 'GOOD HIT');
  } else if (t.kind === 'power') {
    state.hitsPower += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.score += t.scoreGain;
    createFx(t.x + t.size/2, t.y + t.size/2, `POWER +${t.scoreGain}`, '#fde68a');
    damageBoss(t.bossDamage, 'POWER!');
    state.boss.stunMs = Math.max(state.boss.stunMs, 650);
  } else {
    state.hitsBad += 1;
    state.miss += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - 8);
    createFx(t.x + t.size/2, t.y + t.size/2, 'MISS', '#fda4af');
  }

  removeTarget(id);
  renderHud();
}

function registerMissGood(t){
  state.missedGood += 1;
  state.miss += 1;
  state.streak = 0;
  createFx(t.x + t.size/2, Math.max(28, t.y), t.kind === 'power' ? 'พลาด POWER' : 'พลาดของดี', '#fbbf24');
  removeTarget(t.id);
  renderHud();
}

function removeTarget(id){
  const t = state.targets.get(id);
  if (!t) return;
  t.dead = true;
  t.el.remove();
  state.targets.delete(id);
}

function updateBoss(dt){
  const boss = state.boss;
  if (!state.bossActive || state.ended) return;

  const limitX = Math.max(8, state.rect.width - boss.w - 8);

  if (boss.stunMs > 0) {
    boss.stunMs -= dt;
  } else {
    boss.x += (boss.vx * dt) / 1000;
    if (boss.x <= 8) { boss.x = 8; boss.vx = Math.abs(boss.vx); }
    if (boss.x >= limitX) { boss.x = limitX; boss.vx = -Math.abs(boss.vx); }
  }

  if (boss.hp <= boss.hpMax * 0.38 && !boss.enrage) {
    boss.enrage = true;
    boss.vx *= 1.25;
    showCenterTip('ENRAGE! บอสเร็วขึ้นแล้ว');
  }

  boss.stormCd -= dt;
  boss.weakSpotCd -= dt;
  boss.powerCd -= dt;

  if (boss.stormCd <= 0) {
    spawnBossStorm();
    boss.stormCd = boss.enrage ? 2300 : 3200;
  }

  if (boss.powerCd <= 0) {
    spawnBossPowerAid();
    boss.powerCd = boss.enrage ? 2200 : 2800;
  }

  if (!boss.weakSpotReady && boss.weakSpotCd <= 0) {
    boss.weakSpotReady = true;
    boss.weakSpotOpenMs = boss.enrage ? 900 : 1050;
    ui.bossWeakSpot.hidden = false;
    createFx(boss.x + boss.w * 0.78, boss.y + boss.h * 0.72, 'WEAK SPOT!', '#fde68a');
  }

  if (boss.weakSpotReady) {
    boss.weakSpotOpenMs -= dt;
    if (boss.weakSpotOpenMs <= 0) {
      boss.weakSpotReady = false;
      boss.weakSpotCd = boss.enrage ? 2700 : 3700;
      ui.bossWeakSpot.hidden = true;
    }
  }

  renderBoss();
}

function spawnBossStorm(){
  const count = state.diff === 'hard' ? 6 : 5;
  const cfg = getSpawnCfg();
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
}

function spawnBossPowerAid(){
  const cfg = getSpawnCfg();
  const size = randRange(62, 78);
  spawnTarget('power', cfg, {
    x: randRange(10, Math.max(12, state.rect.width - size - 10)),
    y: -size - 6,
    speed: randRange(cfg.speedMin * 0.90, cfg.speedMax * 1.02),
    drift: randRange(-26, 26),
    size
  });
}

function hitBossWeakSpot(){
  if (!state.running || state.ended || !state.bossActive || !state.boss.weakSpotReady) return;
  const damage = state.diff === 'hard' ? 18 : 20;
  state.boss.weakSpotReady = false;
  state.boss.weakSpotCd = state.boss.enrage ? 2700 : 3700;
  state.boss.stunMs = Math.max(state.boss.stunMs, 1100);
  ui.bossWeakSpot.hidden = true;
  state.score += 14;
  createFx(state.boss.x + state.boss.w * 0.74, state.boss.y + state.boss.h * 0.60, `CRIT -${damage}`, '#fde68a');
  damageBoss(damage, 'CRITICAL');
  renderHud();
}

function damageBoss(amount = 0){
  if (!state.bossActive || amount <= 0) return;
  state.boss.hp = Math.max(0, state.boss.hp - amount);
  renderBoss();
  if (state.boss.hp <= 0) {
    state.boss.hp = 0;
    state.bossDefeated = true;
    endGame('boss-clear');
  }
}

function renderBoss(){
  if (!ui.bossWrap || !ui.boss) return;

  if (!state.bossActive) {
    ui.bossWrap.hidden = true;
    return;
  }

  ui.bossWrap.hidden = false;
  ui.boss.style.transform = `translate3d(${state.boss.x}px, ${state.boss.y}px, 0)`;
  ui.bossFace.textContent = state.boss.enrage ? '😈' : '🍔';
  ui.bossName.textContent = state.boss.enrage ? 'Junk King • ENRAGE' : 'Junk King';

  const hpRatio = state.boss.hpMax > 0 ? state.boss.hp / state.boss.hpMax : 0;
  ui.bossHpFill.style.transform = `scaleX(${Math.max(0, Math.min(1, hpRatio))})`;
  ui.bossHpText.textContent = `${Math.ceil(state.boss.hp)} / ${Math.ceil(state.boss.hpMax)}`;
  ui.bossWeakSpot.hidden = !state.boss.weakSpotReady;
}

function renderHud(){
  ui.score.textContent = String(state.score);
  ui.timer.textContent = formatSeconds(state.timeLeftMs);
  ui.miss.textContent = String(state.miss);
  ui.streak.textContent = String(state.streak);
  ui.phaseBadge.textContent = state.bossActive ? 'BOSS' : String(state.phase);

  if (state.bossActive) {
    ui.phaseSub.textContent = state.boss.enrage
      ? 'ตี weak spot • ใช้ power food • boss enrage'
      : 'ตี weak spot • good = damage • junk storm incoming';
  } else if (state.phase === 2) {
    ui.phaseSub.textContent = `เร่งคะแนนสู่บอส • เป้าหมาย ${getCfg().phase2}`;
  } else {
    ui.phaseSub.textContent = `สะสมคะแนน • เป้าหมาย ${getCfg().phase1}`;
  }

  const ratio = state.totalMs > 0 ? state.timeLeftMs / state.totalMs : 0;
  ui.progress.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;

  ui.stats.innerHTML = `
    <div><strong>Good hit:</strong> ${state.hitsGood}</div>
    <div><strong>Power hit:</strong> ${state.hitsPower}</div>
    <div><strong>Junk hit:</strong> ${state.hitsBad}</div>
    <div><strong>Good missed:</strong> ${state.missedGood}</div>
  `;
}

function formatSeconds(ms){
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function showCenterTip(message){
  if (!ui.centerTip) return;
  ui.centerTip.textContent = String(message || '');
  ui.centerTip.classList.remove('hide');
  clearTimeout(showCenterTip.__timer);
  showCenterTip.__timer = setTimeout(() => ui.centerTip?.classList.add('hide'), 1900);
}

function updateHint(message){
  ui.hint.innerHTML = `<div>${escapeHtml(message)}</div>`;
}

function createFx(x, y, text, color){
  const fx = document.createElement('div');
  fx.className = 'gj-fx';
  fx.style.left = `${x}px`;
  fx.style.top = `${y}px`;
  fx.style.color = color || '#e5e7eb';
  fx.textContent = text;
  ui.layer?.appendChild(fx);
  setTimeout(() => fx.remove(), 760);
}

function endGame(reason = 'finished'){
  if (state.ended) return;
  state.ended = true;
  state.running = false;
  cancelAnimationFrame(state.frameRaf);
  state.frameRaf = 0;

  state.targets.forEach((t) => t.el.remove());
  state.targets.clear();

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
    bestStreak: state.bestStreak,
    hitsGood: state.hitsGood,
    hitsBad: state.hitsBad,
    hitsPower: state.hitsPower,
    missedGood: state.missedGood,
    phaseReached: state.bossActive ? 'boss' : `phase-${state.phase}`,
    bossDefeated: !!state.bossDefeated,
    bossHpLeft: Number(state.boss.hp || 0),
    bossHpMax: Number(state.boss.hpMax || 0),
    updatedAt: Date.now()
  };

  console.log('[GJ] endGame()', summary);
  showSoloSummary(summary);
}

function showSoloSummary(summary){
  __gjSoloSummary = {
    version: '20260318-phaseboss-return-lock1',
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
    score: Number(summary.score || 0),
    miss: Number(summary.miss || 0),
    bestStreak: Number(summary.bestStreak || 0),
    hitsGood: Number(summary.hitsGood || 0),
    hitsBad: Number(summary.hitsBad || 0),
    hitsPower: Number(summary.hitsPower || 0),
    missedGood: Number(summary.missedGood || 0),
    phaseReached: String(summary.phaseReached || ''),
    bossDefeated: !!summary.bossDefeated,
    bossHpLeft: Number(summary.bossHpLeft || 0),
    bossHpMax: Number(summary.bossHpMax || 0),
    reason: String(summary.reason || ''),
    updatedAt: Date.now()
  };

  persistSoloSummary(__gjSoloSummary);

  if (summary.reason === 'boss-clear') {
    ui.soloTitle.textContent = 'ชนะ Junk King!';
    ui.soloSub.textContent = 'ยอดเยี่ยมมาก คุณผ่านทั้ง Phase 1, Phase 2 และโค่นบอสได้สำเร็จ';
  } else if (summary.reason === 'boss-timeout') {
    ui.soloTitle.textContent = 'บอสยังไม่แตก';
    ui.soloSub.textContent = 'คุณเข้าถึงบอสแล้ว แต่เวลาไม่พอ ลองเร่งคะแนนและเก็บ weak spot ให้มากขึ้น';
  } else {
    ui.soloTitle.textContent = 'สรุปผลการเล่น';
    ui.soloSub.textContent = 'ลองเร่งคะแนนให้ถึงบอสในรอบต่อไป';
  }

  ui.soloBody.innerHTML = `
    <div class="gj-solo-item"><div class="label">คะแนน</div><div class="value">${__gjSoloSummary.score}</div></div>
    <div class="gj-solo-item"><div class="label">Miss</div><div class="value">${__gjSoloSummary.miss}</div></div>
    <div class="gj-solo-item"><div class="label">Best Streak</div><div class="value">${__gjSoloSummary.bestStreak}</div></div>
    <div class="gj-solo-item"><div class="label">Phase Reached</div><div class="value">${escapeHtml(__gjSoloSummary.phaseReached)}</div></div>
    <div class="gj-solo-item"><div class="label">Good hit</div><div class="value">${__gjSoloSummary.hitsGood}</div></div>
    <div class="gj-solo-item"><div class="label">Power hit</div><div class="value">${__gjSoloSummary.hitsPower}</div></div>
    <div class="gj-solo-item"><div class="label">Junk hit</div><div class="value">${__gjSoloSummary.hitsBad}</div></div>
    <div class="gj-solo-item"><div class="label">Boss Defeated</div><div class="value">${__gjSoloSummary.bossDefeated ? 'YES' : 'NO'}</div></div>
  `;

  ui.soloOverlay.hidden = false;
}

function persistSoloSummary(summary){
  try { localStorage.setItem(`GJ_SOLO_LAST_SUMMARY_${GJ_PID}`, JSON.stringify(summary)); } catch {}
  try {
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
      source: summary.source,
      gameId: summary.gameId,
      title: summary.title,
      mode: summary.mode,
      pid: summary.pid,
      studyId: summary.studyId,
      score: summary.score,
      miss: summary.miss,
      streak: summary.bestStreak,
      phaseReached: summary.phaseReached,
      bossDefeated: summary.bossDefeated,
      updatedAt: summary.updatedAt
    }));
  } catch {}
}

function downloadJson(payload, filename){
  if (!payload) return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `goodjunk-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFilePart(value){
  return String(value || 'file').replace(/[^a-z0-9_-]/gi, '-');
}

function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getHeroHealthRootUrl() {
  return new URL('../', location.href);
}
function getUnifiedGateUrl() {
  return new URL('warmup-gate.html', getHeroHealthRootUrl()).toString();
}
function getHubUrl() {
  try {
    return new URL(GJ_HUB, getHeroHealthRootUrl()).toString();
  } catch {
    return new URL('hub.html', getHeroHealthRootUrl()).toString();
  }
}
function buildRunUrl(seedOverride = '') {
  const q = new URLSearchParams({
    pid: GJ_PID,
    name: GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    diff: state.diff,
    time: String(Math.max(60, Math.round(state.totalMs / 1000))),
    seed: seedOverride || String(Date.now()),
    hub: getHubUrl(),
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    gameId: GJ_GAME_ID,
    mode: 'solo'
  });
  if (__qs.get('bossdebug') === '1') q.set('bossdebug', '1');
  if (__qs.get('debug') === '1') q.set('debug', '1');
  return `./goodjunk-vr.html?${q.toString()}`;
}
function buildWarmupGateUrl(seedOverride = '') {
  const q = new URLSearchParams({
    phase: 'warmup',
    game: 'goodjunk',
    gameId: GJ_GAME_ID,
    next: buildRunUrl(seedOverride || String(Date.now())),
    hub: getHubUrl()
  });
  if (__qs.get('forcegate') === '1') q.set('forcegate', '1');
  if (__qs.get('resetGate') === '1') q.set('resetGate', '1');
  return `${getUnifiedGateUrl()}?${q.toString()}`;
}
function buildCooldownGateUrl() {
  const q = new URLSearchParams({
    phase: 'cooldown',
    game: 'goodjunk',
    gameId: GJ_GAME_ID,
    hub: getHubUrl()
  });
  if (__qs.get('forcegate') === '1') q.set('forcegate', '1');
  if (__qs.get('resetGate') === '1') q.set('resetGate', '1');
  return `${getUnifiedGateUrl()}?${q.toString()}`;
}