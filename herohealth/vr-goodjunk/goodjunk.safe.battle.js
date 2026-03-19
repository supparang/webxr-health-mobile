const __qs = new URLSearchParams(location.search);

function __makeDevicePid() {
  try {
    const KEY = 'GJ_DEVICE_PID';
    let pid = localStorage.getItem(KEY);
    if (!pid) {
      pid = `p-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, pid);
    }
    return pid;
  } catch {
    return `p-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function __normalizePid(rawPid) {
  const v = String(rawPid || '').trim().replace(/[.#$[\]/]/g, '-');
  if (!v) return __makeDevicePid();
  if (v.toLowerCase() === 'anon') return __makeDevicePid();
  return v;
}

function __normalizeRoomId(rawRoomId) {
  return String(rawRoomId || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
}

const RUN_CTX = window.__GJ_BATTLE_CTX__ || {
  pid: __normalizePid(__qs.get('pid') || ''),
  name: __qs.get('name') || '',
  studyId: __qs.get('studyId') || '',
  roomId: __normalizeRoomId(__qs.get('roomId') || ''),
  mode: 'battle',
  diff: __qs.get('diff') || 'normal',
  time: __qs.get('time') || '120',
  seed: __qs.get('seed') || String(Date.now()),
  startAt: Number(__qs.get('startAt') || 0) || 0,
  hub: __qs.get('hub') || '../hub.html',
  view: __qs.get('view') || 'mobile',
  run: __qs.get('run') || 'play',
  gameId: __qs.get('gameId') || 'goodjunk'
};

const GJ_PID = __normalizePid(RUN_CTX.pid || '');
const GJ_NAME = String(RUN_CTX.name || GJ_PID).trim();
const GJ_ROOM_ID = __normalizeRoomId(RUN_CTX.roomId || '');
const GJ_START_AT = Number(RUN_CTX.startAt || 0) || 0;
const GJ_HUB = RUN_CTX.hub || '../hub.html';
const GJ_GAME_ID = RUN_CTX.gameId || 'goodjunk';
const ROOM_PATH = GJ_ROOM_ID ? `hha-battle/goodjunk/rooms/${GJ_ROOM_ID}` : '';
const GAME_MOUNT = document.getElementById('gameMount') || document.body;
const BATTLE_UI = window.__gjBattleUi || null;

const STYLE_ID = 'goodjunk-safe-battle-style-20260319-attack-v1';
const ROOT_ID = 'gjBattleRoot';
const HEARTBEAT_MS = 2500;
const STALE_MS = 45000;
const ATTACK_COST = 100;
const SHIELD_COST = 100;
const SHIELD_DURATION_MS = 3600;
const ATTACK_DEBUFF_MS = 3200;
const ATTACK_PENALTY_SCORE = 10;
const ATTACK_JUNK_BURST = 6;
const ATTACK_BURST_STEP_MS = 260;

let fbReady = false;
let db = null;
let roomRef = null;
let myPlayerRef = null;
let roomListenerBound = false;
let gateRAF = 0;
let heartbeatTimer = 0;
let watchdogTimer = 0;
let booted = false;
let localRunActive = false;
let summaryBound = false;
let recoveredStartAt = 0;
let lastSummary = null;
let liveRoom = null;

const handledAttackIds = new Set();
const handlingAttackIds = new Set();

const GOOD_ITEMS = [
  { emoji: '🍎', label: 'apple' },
  { emoji: '🥕', label: 'carrot' },
  { emoji: '🥦', label: 'broccoli' },
  { emoji: '🍌', label: 'banana' },
  { emoji: '🥛', label: 'milk' },
  { emoji: '🥗', label: 'salad' },
  { emoji: '🍉', label: 'watermelon' }
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
  easy:   { spawnMs: 930, goodRatio: 0.68, speedMin: 90,  speedMax: 150, targetSizeMin: 60, targetSizeMax: 84 },
  normal: { spawnMs: 760, goodRatio: 0.63, speedMin: 110, speedMax: 190, targetSizeMin: 58, targetSizeMax: 82 },
  hard:   { spawnMs: 610, goodRatio: 0.58, speedMin: 130, speedMax: 240, targetSizeMin: 56, targetSizeMax: 80 }
};

const state = {
  diff: DIFF_PRESET[RUN_CTX.diff] ? RUN_CTX.diff : 'normal',
  totalMs: 0,
  timeLeftMs: 0,
  score: 0,
  miss: 0,
  streak: 0,
  bestStreak: 0,
  hitsGood: 0,
  hitsBad: 0,
  missedGood: 0,
  spawnedGood: 0,
  spawnedJunk: 0,
  attackMeter: 0,
  shieldMeter: 0,
  shieldActiveUntil: 0,
  debuffUntil: 0,
  junkBurstRemaining: 0,
  junkBurstAccum: 0,
  running: false,
  ended: false,
  startTs: 0,
  lastFrameTs: 0,
  lastSpawnAccum: 0,
  frameRaf: 0,
  targetSeq: 0,
  targets: new Map(),
  rect: { width: 0, height: 0 }
};

const ui = {
  root: null,
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
  attackFill: null,
  shieldFill: null,
  attackLabel: null,
  shieldLabel: null,
  attackBtn: null,
  shieldBtn: null,
  targetLabel: null,
  effectBadge: null
};

const rng = createSeededRng(RUN_CTX.seed || Date.now());

boot();

function boot() {
  injectStyle();
  buildShell();
  bindShell();
  attachRoomListener();

  bootWithGate(async () => {
    const ok = await ensureFirebase();
    if (!ok) {
      showGate('เปิดห้อง Battle ไม่สำเร็จ', '...', 'ตรวจสอบ room แล้วลองใหม่');
      return;
    }

    await setupOnDisconnect();
    await markPresence({
      phase: 'run',
      ready: true,
      connected: true,
      finished: false
    });

    startHeartbeat();
    startWatchdog();
    startGame();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !state.ended) {
      markPresence({
        phase: 'run',
        ready: true,
        connected: true,
        finished: false
      });
    }
  });

  window.addEventListener('focus', () => {
    if (!state.ended) {
      markPresence({
        phase: 'run',
        ready: true,
        connected: true,
        finished: false
      });
    }
  });

  window.addEventListener('beforeunload', () => {
    stopHeartbeat();
    stopWatchdog();
    if (!state.ended) markDisconnected();
  });

  window.addEventListener('resize', refreshStageRect);
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID}{position:absolute;inset:0;z-index:2;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation}
    .gj-shell{position:absolute;inset:0;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden}
    .gj-topbar{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;padding:60px 14px 10px;padding-top:calc(60px + env(safe-area-inset-top,0px));pointer-events:none}
    .gj-chip-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;pointer-events:none}
    .gj-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.66);color:#e5e7eb;font-weight:900;font-size:13px;backdrop-filter:blur(8px);box-shadow:0 10px 24px rgba(0,0,0,.18)}
    .gj-chip span{color:#94a3b8;font-weight:800}
    .gj-stage-wrap{position:relative;min-height:0;padding:8px 10px 10px}
    .gj-stage{
      position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;border:1px solid rgba(148,163,184,.18);
      border-radius:26px;background:
      radial-gradient(circle at 50% 0%, rgba(245,158,11,.10), transparent 30%),
      linear-gradient(180deg, rgba(15,23,42,.72), rgba(2,6,23,.78));
      box-shadow:0 24px 64px rgba(0,0,0,.22)
    }
    .gj-stage::before{
      content:"";position:absolute;inset:0;
      background:linear-gradient(180deg, rgba(255,255,255,.04), transparent 30%),linear-gradient(0deg, rgba(255,255,255,.03), transparent 30%);
      pointer-events:none
    }
    .gj-stage.under-attack::after{
      content:"";
      position:absolute;inset:0;
      background:
        radial-gradient(circle at 20% 30%, rgba(239,68,68,.12), transparent 22%),
        radial-gradient(circle at 80% 40%, rgba(239,68,68,.12), transparent 24%),
        linear-gradient(180deg, rgba(239,68,68,.08), rgba(0,0,0,.10));
      animation: gj-danger-pulse .55s ease-in-out infinite alternate;
      pointer-events:none;
    }
    .gj-stage.shield-on{
      box-shadow:0 0 0 2px rgba(56,189,248,.28), 0 24px 64px rgba(0,0,0,.22);
    }
    .gj-stage.shield-on::before{
      content:"";
      position:absolute;inset:0;
      background:linear-gradient(180deg, rgba(56,189,248,.08), transparent 34%);
      pointer-events:none;
    }
    @keyframes gj-danger-pulse{
      from{opacity:.55}
      to{opacity:1}
    }
    .gj-target-layer{position:absolute;inset:0;overflow:hidden}
    .gj-center-tip{
      position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(86vw,440px);padding:16px 18px;border-radius:18px;
      background:rgba(2,6,23,.52);border:1px solid rgba(148,163,184,.18);color:#e5e7eb;text-align:center;font-weight:900;
      backdrop-filter:blur(6px);pointer-events:none;opacity:.96;transition:opacity .35s ease, transform .35s ease;box-shadow:0 16px 36px rgba(0,0,0,.18)
    }
    .gj-center-tip.hide{opacity:0;transform:translate(-50%,-50%) scale(.96)}
    .gj-target{
      position:absolute;display:grid;place-items:center;border-radius:20px;border:1px solid rgba(255,255,255,.16);
      box-shadow:0 14px 28px rgba(0,0,0,.18);transform:translate3d(0,0,0);cursor:pointer;outline:none;padding:0;overflow:hidden;background:rgba(15,23,42,.78)
    }
    .gj-target.good{
      background:radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), transparent 26%),linear-gradient(180deg, rgba(34,197,94,.30), rgba(34,197,94,.18)),rgba(15,23,42,.84);
      border-color:rgba(34,197,94,.30)
    }
    .gj-target.junk{
      background:radial-gradient(circle at 30% 25%, rgba(255,255,255,.20), transparent 26%),linear-gradient(180deg, rgba(244,63,94,.26), rgba(244,63,94,.14)),rgba(15,23,42,.84);
      border-color:rgba(244,63,94,.28)
    }
    .gj-emoji{font-size:32px;line-height:1;transform:translateY(-2px);filter:drop-shadow(0 6px 10px rgba(0,0,0,.18))}
    .gj-type{
      position:absolute;left:8px;right:8px;bottom:6px;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#e2e8f0;
      opacity:.92;text-align:center;white-space:nowrap
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
    .gj-bottom-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px}
    .gj-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:13px;color:#cbd5e1;line-height:1.5}
    .gj-legend strong{color:#e5e7eb}
    .gj-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:min(100%,480px)}
    .gj-action{
      border:1px solid rgba(148,163,184,.18);
      border-radius:16px;
      background:rgba(255,255,255,.04);
      padding:10px;
      display:grid;
      gap:8px;
      min-width:180px;
    }
    .gj-action-head{
      display:flex;
      justify-content:space-between;
      gap:10px;
      align-items:center;
      font-size:13px;
      font-weight:900;
      color:#e5e7eb;
    }
    .gj-meter{
      position:relative;
      width:100%;
      height:12px;
      border-radius:999px;
      overflow:hidden;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(255,255,255,.06);
    }
    .gj-meter-fill{
      width:100%;
      height:100%;
      transform-origin:left center;
      transition:transform .12s linear;
    }
    .gj-meter-fill.attack{background:linear-gradient(90deg, rgba(245,158,11,.95), rgba(234,179,8,.95))}
    .gj-meter-fill.shield{background:linear-gradient(90deg, rgba(56,189,248,.95), rgba(14,165,233,.95))}
    .gj-action-btn{
      appearance:none;border:0;cursor:pointer;border-radius:12px;padding:10px 12px;font-weight:900;font-size:13px;transition:.12s ease
    }
    .gj-action-btn:hover{transform:translateY(-1px);filter:brightness(1.05)}
    .gj-action-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
    .gj-action-btn.attack{background:#f59e0b;color:#3b1d00}
    .gj-action-btn.shield{background:#38bdf8;color:#082f49}
    .gj-targeting{
      margin-top:8px;
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      align-items:center;
      font-size:13px;
      color:#cbd5e1;
    }
    .gj-badge{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:6px 10px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(255,255,255,.05);
      font-weight:800;
    }
    .gj-badge.warn{
      border-color:rgba(245,158,11,.28);
      background:rgba(245,158,11,.12);
      color:#fcd34d;
    }
    .gj-badge.info{
      border-color:rgba(56,189,248,.28);
      background:rgba(56,189,248,.12);
      color:#7dd3fc;
    }
    .gj-progress{
      position:relative;width:100%;height:12px;border-radius:999px;overflow:hidden;border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.06)
    }
    .gj-progress-bar{
      width:100%;height:100%;background:linear-gradient(90deg, rgba(245,158,11,.85), rgba(56,189,248,.85));transform-origin:left center;transition:transform .12s linear
    }
    @media (max-width:700px){
      .gj-actions{grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(style);
}

function buildShell() {
  GAME_MOUNT.innerHTML = `
    <div id="${ROOT_ID}">
      <div class="gj-shell">
        <header class="gj-topbar">
          <div class="gj-chip-row">
            <div class="gj-chip"><span>My Score</span><strong id="gjScore">0</strong></div>
            <div class="gj-chip"><span>Time</span><strong id="gjTimer">0</strong></div>
            <div class="gj-chip"><span>Miss</span><strong id="gjMiss">0</strong></div>
            <div class="gj-chip"><span>Best Streak</span><strong id="gjStreak">0</strong></div>
          </div>
        </header>

        <div class="gj-stage-wrap">
          <div class="gj-stage" id="gjStage">
            <div class="gj-center-tip" id="gjCenterTip">เก็บของดีเพื่อชาร์จ ATTACK และใช้ SHIELD กันอีกฝ่าย</div>
            <div class="gj-target-layer" id="gjTargetLayer"></div>
          </div>
        </div>

        <div class="gj-bottom">
          <div class="gj-bottom-card">
            <div class="gj-bottom-top">
              <div>
                <div class="gj-legend" id="gjStatsText">
                  <div><strong>Good hit:</strong> 0</div>
                  <div><strong>Junk hit:</strong> 0</div>
                  <div><strong>Good missed:</strong> 0</div>
                </div>

                <div class="gj-targeting">
                  <div class="gj-badge">เป้าหมาย: <strong id="gjTargetLabel">-</strong></div>
                  <div class="gj-badge warn" id="gjEffectBadge">สถานะปกติ</div>
                </div>
              </div>

              <div class="gj-actions">
                <div class="gj-action">
                  <div class="gj-action-head">
                    <span>ATTACK</span>
                    <strong id="gjAttackLabel">0%</strong>
                  </div>
                  <div class="gj-meter"><div class="gj-meter-fill attack" id="gjAttackFill"></div></div>
                  <button class="gj-action-btn attack" id="btnBattleAttack" type="button">ส่ง Junk Storm</button>
                </div>

                <div class="gj-action">
                  <div class="gj-action-head">
                    <span>SHIELD</span>
                    <strong id="gjShieldLabel">0%</strong>
                  </div>
                  <div class="gj-meter"><div class="gj-meter-fill shield" id="gjShieldFill"></div></div>
                  <button class="gj-action-btn shield" id="btnBattleShield" type="button">เปิด Shield</button>
                </div>
              </div>
            </div>

            <div class="gj-legend" id="gjHintText" style="margin-bottom:10px;">
              <div>Tip: combo ดี ๆ เพื่อเร่ง ATTACK meter</div>
            </div>

            <div class="gj-progress"><div class="gj-progress-bar" id="gjProgressBar"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  ui.root = document.getElementById(ROOT_ID);
  ui.stage = document.getElementById('gjStage');
  ui.layer = document.getElementById('gjTargetLayer');
  ui.score = document.getElementById('gjScore');
  ui.timer = document.getElementById('gjTimer');
  ui.miss = document.getElementById('gjMiss');
  ui.streak = document.getElementById('gjStreak');
  ui.hint = document.getElementById('gjHintText');
  ui.progress = document.getElementById('gjProgressBar');
  ui.stats = document.getElementById('gjStatsText');
  ui.centerTip = document.getElementById('gjCenterTip');
  ui.attackFill = document.getElementById('gjAttackFill');
  ui.shieldFill = document.getElementById('gjShieldFill');
  ui.attackLabel = document.getElementById('gjAttackLabel');
  ui.shieldLabel = document.getElementById('gjShieldLabel');
  ui.attackBtn = document.getElementById('btnBattleAttack');
  ui.shieldBtn = document.getElementById('btnBattleShield');
  ui.targetLabel = document.getElementById('gjTargetLabel');
  ui.effectBadge = document.getElementById('gjEffectBadge');

  refreshStageRect();
  renderHud();
}

function bindShell() {
  if (summaryBound) return;
  summaryBound = true;

  ui.attackBtn?.addEventListener('click', fireAttack);
  ui.shieldBtn?.addEventListener('click', activateShield);

  document.getElementById('btnBattleRematch')?.addEventListener('click', async () => {
    await resetRoomForRematch();
    location.href = buildLobbyUrl();
  });

  document.getElementById('btnBattleBackLobby')?.addEventListener('click', () => {
    location.href = buildLobbyUrl();
  });

  document.getElementById('btnBattleExport')?.addEventListener('click', () => {
    downloadJson(lastSummary, `goodjunk-battle-${safeFilePart(GJ_ROOM_ID)}-${Date.now()}.json`);
  });

  document.getElementById('btnBattleBackHub')?.addEventListener('click', () => {
    location.href = GJ_HUB;
  });
}

function refreshStageRect() {
  const rect = ui.stage?.getBoundingClientRect();
  if (!rect) return;
  state.rect.width = Math.max(300, rect.width);
  state.rect.height = Math.max(320, rect.height);
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
function clampInt(v, min, max){ return Math.max(min, Math.min(max, Math.floor(v))); }
function pick(arr){ return arr[Math.floor(rand() * arr.length)]; }
function clamp01(v){ return Math.max(0, Math.min(1, v)); }

function startGame() {
  if (state.running || state.ended) return;

  state.totalMs = clampInt(Number(RUN_CTX.time || 120) * 1000, 30000, 600000);
  state.timeLeftMs = state.totalMs;
  state.score = 0;
  state.miss = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.hitsGood = 0;
  state.hitsBad = 0;
  state.missedGood = 0;
  state.spawnedGood = 0;
  state.spawnedJunk = 0;
  state.attackMeter = 0;
  state.shieldMeter = 0;
  state.shieldActiveUntil = 0;
  state.debuffUntil = 0;
  state.junkBurstRemaining = 0;
  state.junkBurstAccum = 0;
  state.running = true;
  state.ended = false;
  state.startTs = performance.now();
  state.lastFrameTs = state.startTs;
  state.lastSpawnAccum = 0;
  state.targetSeq = 0;
  state.targets.clear();
  localRunActive = true;

  if (ui.layer) ui.layer.innerHTML = '';
  if (ui.centerTip) {
    ui.centerTip.classList.remove('hide');
    ui.centerTip.textContent = 'เก็บของดีเพื่อชาร์จ ATTACK และใช้ SHIELD กันอีกฝ่าย';
    setTimeout(() => ui.centerTip?.classList.add('hide'), 2000);
  }

  if (BATTLE_UI?.setStatus) BATTLE_UI.setStatus('running');

  hideSummary();
  renderHud();
  refreshStageRect();
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
    endGame('time-up');
    return;
  }

  updateSpawner(dt);
  updateBattleEffects(dt);
  updateTargets(dt);
  renderHud();

  state.frameRaf = requestAnimationFrame(loop);
}

function getEffectivePreset() {
  const base = DIFF_PRESET[state.diff] || DIFF_PRESET.normal;
  const debuffed = Date.now() < state.debuffUntil;

  if (!debuffed) return base;

  return {
    spawnMs: Math.max(240, Math.round(base.spawnMs * 0.72)),
    goodRatio: Math.max(0.28, base.goodRatio - 0.22),
    speedMin: Math.round(base.speedMin * 1.15),
    speedMax: Math.round(base.speedMax * 1.18),
    targetSizeMin: Math.max(42, base.targetSizeMin - 6),
    targetSizeMax: Math.max(68, base.targetSizeMax - 6)
  };
}

function updateSpawner(dt) {
  const preset = getEffectivePreset();
  state.lastSpawnAccum += dt;

  while (state.lastSpawnAccum >= preset.spawnMs) {
    state.lastSpawnAccum -= preset.spawnMs;
    spawnTarget();
  }
}

function updateBattleEffects(dt) {
  const nowTs = Date.now();

  if (nowTs < state.debuffUntil && state.junkBurstRemaining > 0) {
    state.junkBurstAccum += dt;
    while (state.junkBurstAccum >= ATTACK_BURST_STEP_MS && state.junkBurstRemaining > 0) {
      state.junkBurstAccum -= ATTACK_BURST_STEP_MS;
      spawnTarget('junk');
      state.junkBurstRemaining -= 1;
    }
  }

  if (nowTs >= state.debuffUntil) {
    state.junkBurstAccum = 0;
    state.junkBurstRemaining = 0;
  }

  refreshEffectClasses();
}

function refreshEffectClasses() {
  if (!ui.stage) return;
  const shieldOn = Date.now() < state.shieldActiveUntil;
  const underAttack = Date.now() < state.debuffUntil;

  ui.stage.classList.toggle('shield-on', shieldOn);
  ui.stage.classList.toggle('under-attack', underAttack);
}

function spawnTarget(forceType = '') {
  refreshStageRect();

  const preset = getEffectivePreset();
  const isGood = forceType === 'good' ? true : forceType === 'junk' ? false : rand() < preset.goodRatio;
  const item = pick(isGood ? GOOD_ITEMS : JUNK_ITEMS);

  const size = randRange(preset.targetSizeMin, preset.targetSizeMax);
  const x = randRange(10, Math.max(12, state.rect.width - size - 10));
  const y = -size - randRange(0, 50);
  const speed = randRange(preset.speedMin, preset.speedMax);
  const drift = randRange(-36, 36);
  const id = `t-${++state.targetSeq}`;

  const el = document.createElement('button');
  el.type = 'button';
  el.className = `gj-target ${isGood ? 'good' : 'junk'}`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.innerHTML = `
    <div class="gj-emoji">${item.emoji}</div>
    <div class="gj-type">${isGood ? 'good' : 'junk'}</div>
  `;

  const target = { id, el, type: isGood ? 'good' : 'junk', x, y, size, speed, drift, dead: false };

  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    hitTarget(id);
  }, { passive: false });

  ui.layer?.appendChild(el);
  state.targets.set(id, target);

  if (isGood) state.spawnedGood += 1;
  else state.spawnedJunk += 1;

  drawTarget(target);
}

function drawTarget(target) {
  target.el.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
}

function updateTargets(dt) {
  const stageW = state.rect.width;
  const stageH = state.rect.height;

  state.targets.forEach((target) => {
    if (target.dead) return;

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
      if (target.type === 'good') registerMissGood(target);
      else removeTarget(target.id);
    }
  });
}

function gainAttack(v) {
  state.attackMeter = Math.min(ATTACK_COST, state.attackMeter + v);
}

function gainShield(v) {
  state.shieldMeter = Math.min(SHIELD_COST, state.shieldMeter + v);
}

function hitTarget(id) {
  if (!state.running || state.ended) return;
  const target = state.targets.get(id);
  if (!target || target.dead) return;

  if (target.type === 'good') {
    state.hitsGood += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    const comboBonus = Math.min(12, Math.floor(state.streak / 3) * 2);
    const gain = 10 + comboBonus;
    state.score += gain;
    gainAttack(12);
    gainShield(5);
    createFx(target.x + target.size / 2, target.y + target.size / 2, `+${gain}`, '#86efac');
    updateHint('ดีมาก! สะสม ATTACK ให้เต็มแล้วกดยิง');
  } else {
    state.hitsBad += 1;
    state.miss += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - 8);
    gainShield(20);
    createFx(target.x + target.size / 2, target.y + target.size / 2, 'MISS', '#fda4af');
    updateHint('โดน junk แล้ว รีบเติม SHIELD ไว้กันอีกฝ่าย');
  }

  removeTarget(id);
  renderHud();
  publishProgress();
}

function registerMissGood(target) {
  state.missedGood += 1;
  state.miss += 1;
  state.streak = 0;
  gainShield(14);
  createFx(target.x + target.size / 2, Math.max(28, target.y), 'พลาดของดี', '#fbbf24');
  updateHint('ของดีหลุดไปแล้ว ระวังและเตรียม SHIELD ไว้');
  removeTarget(target.id);
  renderHud();
  publishProgress();
}

function removeTarget(id) {
  const target = state.targets.get(id);
  if (!target) return;
  target.dead = true;
  target.el.remove();
  state.targets.delete(id);
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

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function updateHint(message) {
  if (!ui.hint) return;
  ui.hint.innerHTML = `<div>${escapeHtml(message)}</div>`;
}

function getOpponentCandidates(room = liveRoom) {
  const players = getBattlePlayers(room);
  return players.filter((p) => p.id !== GJ_PID && p.connected !== false && !p.finished);
}

function pickAttackTarget(room = liveRoom) {
  const opponents = getOpponentCandidates(room);
  if (!opponents.length) return null;

  return [...opponents].sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (a.miss !== b.miss) return a.miss - b.miss;
    return b.streak - a.streak;
  })[0];
}

async function fireAttack() {
  if (!state.running || state.ended) return;
  if (state.attackMeter < ATTACK_COST) {
    toast('Attack meter ยังไม่เต็ม');
    return;
  }

  const room = await loadRoom();
  if (!room) {
    toast('ยังโหลดห้องไม่สำเร็จ');
    return;
  }

  const target = pickAttackTarget(room);
  if (!target) {
    toast('ยังไม่มีเป้าหมายให้โจมตี');
    return;
  }

  const attackId = `atk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const payload = {
    id: attackId,
    type: 'junkstorm',
    fromPid: GJ_PID,
    fromName: GJ_NAME,
    toPid: target.id,
    toName: target.name || target.id,
    createdAt: Date.now(),
    penaltyScore: ATTACK_PENALTY_SCORE,
    durationMs: ATTACK_DEBUFF_MS,
    junkBurst: ATTACK_JUNK_BURST,
    handled: {}
  };

  try {
    await roomRef.child('match').child('battle').child('attacks').child(attackId).set(payload);
    state.attackMeter = 0;
    renderHud();
    toast(`ส่ง Junk Storm ไปหา ${target.name || target.id} แล้ว`);
    updateHint(`โจมตี ${target.name || target.id} แล้ว!`);
  } catch (err) {
    console.error('[battle] fireAttack failed:', err);
    toast('ส่งการโจมตีไม่สำเร็จ');
  }
}

function activateShield() {
  if (!state.running || state.ended) return;
  if (state.shieldMeter < SHIELD_COST) {
    toast('Shield meter ยังไม่เต็ม');
    return;
  }

  state.shieldMeter = 0;
  state.shieldActiveUntil = Date.now() + SHIELD_DURATION_MS;
  renderHud();
  refreshEffectClasses();
  toast('Shield พร้อมกันการโจมตีแล้ว');
  updateHint('Shield ทำงานอยู่! ถ้าอีกฝ่ายยิงมาจะกันได้');
}

async function handleIncomingAttacks(room) {
  const attacks = room?.match?.battle?.attacks || {};
  const list = Object.values(attacks).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

  for (const attack of list) {
    const attackId = String(attack?.id || '');
    if (!attackId) continue;
    if (String(attack.toPid || '') !== GJ_PID) continue;
    if (handledAttackIds.has(attackId)) continue;
    if (handlingAttackIds.has(attackId)) continue;
    if (attack?.handled?.[GJ_PID]) {
      handledAttackIds.add(attackId);
      continue;
    }

    handlingAttackIds.add(attackId);

    try {
      await applyIncomingAttack(attack);
      await roomRef
        .child('match')
        .child('battle')
        .child('attacks')
        .child(attackId)
        .child('handled')
        .child(GJ_PID)
        .set(true);
      handledAttackIds.add(attackId);
    } catch (err) {
      console.error('[battle] handleIncomingAttack failed:', err);
    } finally {
      handlingAttackIds.delete(attackId);
    }
  }
}

async function applyIncomingAttack(attack) {
  const fromName = String(attack?.fromName || attack?.fromPid || 'คู่แข่ง');
  const nowTs = Date.now();

  if (nowTs < state.shieldActiveUntil) {
    state.shieldActiveUntil = 0;
    refreshEffectClasses();
    renderHud();
    toast(`Shield กันการโจมตีจาก ${fromName} สำเร็จ`);
    updateHint(`กันการโจมตีจาก ${fromName} ได้แล้ว`);
    return;
  }

  state.score = Math.max(0, state.score - Number(attack?.penaltyScore || ATTACK_PENALTY_SCORE));
  state.miss += 1;
  state.streak = 0;
  gainShield(28);

  state.debuffUntil = Math.max(state.debuffUntil, nowTs + Number(attack?.durationMs || ATTACK_DEBUFF_MS));
  state.junkBurstRemaining += Number(attack?.junkBurst || ATTACK_JUNK_BURST);
  state.junkBurstAccum = 0;

  createFx(state.rect.width * 0.5, 90, `-${Number(attack?.penaltyScore || ATTACK_PENALTY_SCORE)}`, '#fda4af');
  toast(`โดน ${fromName} โจมตี! junk จะเพิ่มช่วงสั้น ๆ`);
  updateHint(`โดน ${fromName} ยิงใส่ รีบเก็บของดีและหาโอกาสยิงกลับ`);
  refreshEffectClasses();
  renderHud();
  publishProgress();
}

function renderHud() {
  if (ui.score) ui.score.textContent = String(state.score);
  if (ui.timer) ui.timer.textContent = formatSeconds(state.timeLeftMs);
  if (ui.miss) ui.miss.textContent = String(state.miss);
  if (ui.streak) ui.streak.textContent = String(state.bestStreak);

  if (ui.progress) {
    const ratio = state.totalMs > 0 ? clamp01(state.timeLeftMs / state.totalMs) : 0;
    ui.progress.style.transform = `scaleX(${ratio})`;
  }

  if (ui.stats) {
    ui.stats.innerHTML = `
      <div><strong>Good hit:</strong> ${state.hitsGood}</div>
      <div><strong>Junk hit:</strong> ${state.hitsBad}</div>
      <div><strong>Good missed:</strong> ${state.missedGood}</div>
    `;
  }

  if (ui.attackFill) ui.attackFill.style.transform = `scaleX(${clamp01(state.attackMeter / ATTACK_COST)})`;
  if (ui.shieldFill) ui.shieldFill.style.transform = `scaleX(${clamp01(state.shieldMeter / SHIELD_COST)})`;
  if (ui.attackLabel) ui.attackLabel.textContent = `${Math.round(clamp01(state.attackMeter / ATTACK_COST) * 100)}%`;
  if (ui.shieldLabel) ui.shieldLabel.textContent = `${Math.round(clamp01(state.shieldMeter / SHIELD_COST) * 100)}%`;

  if (ui.attackBtn) ui.attackBtn.disabled = state.attackMeter < ATTACK_COST || state.ended || !pickAttackTarget(liveRoom);
  if (ui.shieldBtn) ui.shieldBtn.disabled = state.shieldMeter < SHIELD_COST || state.ended;

  const target = pickAttackTarget(liveRoom);
  if (ui.targetLabel) ui.targetLabel.textContent = target ? (target.name || target.id) : '-';

  if (ui.effectBadge) {
    if (Date.now() < state.shieldActiveUntil) {
      ui.effectBadge.className = 'gj-badge info';
      ui.effectBadge.textContent = 'Shield ทำงานอยู่';
    } else if (Date.now() < state.debuffUntil) {
      ui.effectBadge.className = 'gj-badge warn';
      ui.effectBadge.textContent = 'โดนโจมตีอยู่ • junk เพิ่ม';
    } else {
      ui.effectBadge.className = 'gj-badge';
      ui.effectBadge.textContent = 'สถานะปกติ';
    }
  }

  refreshEffectClasses();
}

function formatSeconds(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function toast(message) {
  if (window.__gjShowBattleRunMessage) {
    window.__gjShowBattleRunMessage(message);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      window.__gjHideBattleRunMessage?.();
    }, 2200);
  }
}

function endGame(reason = 'finished') {
  if (state.ended) return;

  state.ended = true;
  state.running = false;
  localRunActive = false;
  cancelAnimationFrame(state.frameRaf);
  state.frameRaf = 0;

  state.targets.forEach((t) => t.el.remove());
  state.targets.clear();

  publishFinish(reason);
}

function showGate(msg = 'กำลังรอเริ่ม', count = '-', sub = '') {
  if (BATTLE_UI?.showGate) BATTLE_UI.showGate(msg, count, sub);
}

function hideGate() {
  if (BATTLE_UI?.hideGate) BATTLE_UI.hideGate();
}

function cancelGateLoop() {
  if (gateRAF) cancelAnimationFrame(gateRAF);
  gateRAF = 0;
}

function waitUntilStart(startAt) {
  return new Promise((resolve) => {
    const tick = () => {
      const left = startAt - Date.now();

      if (left <= 0) {
        showGate('เริ่ม Battle', 'GO!', 'กำลังเข้าสู่เกม...');
        window.setTimeout(resolve, 220);
        return;
      }

      showGate(
        'กำลังนับถอยหลังก่อนเริ่มพร้อมกัน',
        String(Math.ceil(left / 1000)),
        `Room: ${GJ_ROOM_ID || '-'}`
      );

      gateRAF = requestAnimationFrame(tick);
    };

    tick();
  });
}

function getEffectiveStartAt() {
  return Number(GJ_START_AT || recoveredStartAt || 0) || 0;
}

function normalizePlayers(players) {
  return Array.isArray(players) ? players.filter(Boolean).map((p) => ({
    id: __normalizePid(p.id || ''),
    name: String(p.name || '').trim(),
    ready: !!p.ready,
    connected: p.connected !== false,
    phase: String(p.phase || (p.finished ? 'done' : 'run')).trim(),
    finished: !!p.finished,
    finalScore: Number(p.finalScore || 0),
    miss: Number(p.miss || 0),
    streak: Number(p.streak || 0),
    joinedAt: Number(p.joinedAt || 0),
    lastSeenAt: Number(p.lastSeenAt || 0),
    finishedAt: Number(p.finishedAt || 0)
  })) : [];
}

function sanitizeAttacks(attacks) {
  const out = {};
  if (!attacks || typeof attacks !== 'object') return out;

  for (const [id, raw] of Object.entries(attacks)) {
    if (!raw || typeof raw !== 'object') continue;
    out[id] = {
      id: String(raw.id || id),
      type: String(raw.type || 'junkstorm'),
      fromPid: __normalizePid(raw.fromPid || ''),
      fromName: String(raw.fromName || '').trim(),
      toPid: __normalizePid(raw.toPid || ''),
      toName: String(raw.toName || '').trim(),
      createdAt: Number(raw.createdAt || 0),
      penaltyScore: Number(raw.penaltyScore || ATTACK_PENALTY_SCORE),
      durationMs: Number(raw.durationMs || ATTACK_DEBUFF_MS),
      junkBurst: Number(raw.junkBurst || ATTACK_JUNK_BURST),
      handled: raw.handled && typeof raw.handled === 'object' ? raw.handled : {}
    };
  }

  return out;
}

function sanitizeRoom(room) {
  if (!room) return null;

  const rawMatch = room.match && typeof room.match === 'object' ? room.match : {};
  const rawBattle = rawMatch.battle && typeof rawMatch.battle === 'object' ? rawMatch.battle : {};

  return {
    roomId: __normalizeRoomId(room.roomId || GJ_ROOM_ID || ''),
    hostId: __normalizePid(room.hostId || ''),
    mode: String(room.mode || 'battle'),
    minPlayers: Math.max(2, Number(room.minPlayers || 2)),
    maxPlayers: Math.max(2, Number(room.maxPlayers || 4)),
    status: ['waiting', 'countdown', 'running', 'finished'].includes(room.status) ? room.status : 'waiting',
    startAt: room.startAt ? Number(room.startAt) : null,
    createdAt: Number(room.createdAt || Date.now()),
    updatedAt: Number(room.updatedAt || Date.now()),
    players: normalizePlayers(room.players || []),
    match: {
      participantIds: Array.isArray(rawMatch.participantIds)
        ? rawMatch.participantIds.map((id) => __normalizePid(id)).filter(Boolean)
        : [],
      lockedAt: rawMatch.lockedAt ? Number(rawMatch.lockedAt) : null,
      status: ['idle', 'countdown', 'running', 'finished'].includes(rawMatch.status) ? rawMatch.status : 'idle',
      battle: {
        finishedAt: Number(rawBattle.finishedAt || 0),
        attacks: sanitizeAttacks(rawBattle.attacks || {})
      }
    }
  };
}

function snapshotToRoom(val) {
  if (!val) return null;
  const playersMap = val.players || {};
  return {
    ...val,
    players: Object.keys(playersMap).map((pid) => ({
      id: pid,
      ...playersMap[pid]
    }))
  };
}

function roomToFirebase(room) {
  const out = {
    roomId: room.roomId,
    hostId: room.hostId,
    mode: room.mode,
    minPlayers: room.minPlayers,
    maxPlayers: room.maxPlayers,
    status: room.status,
    startAt: room.startAt || null,
    createdAt: room.createdAt || Date.now(),
    updatedAt: Date.now(),
    players: {},
    match: {
      participantIds: Array.isArray(room.match?.participantIds) ? room.match.participantIds : [],
      lockedAt: room.match?.lockedAt || null,
      status: room.match?.status || 'idle',
      battle: {
        finishedAt: Number(room.match?.battle?.finishedAt || 0),
        attacks: room.match?.battle?.attacks || {}
      }
    }
  };

  normalizePlayers(room.players).forEach((p) => {
    out.players[p.id] = {
      name: p.name || '',
      ready: !!p.ready,
      connected: p.connected !== false,
      phase: p.phase || 'run',
      finished: !!p.finished,
      finalScore: Number(p.finalScore || 0),
      miss: Number(p.miss || 0),
      streak: Number(p.streak || 0),
      joinedAt: Number(p.joinedAt || 0),
      lastSeenAt: Number(p.lastSeenAt || 0),
      finishedAt: Number(p.finishedAt || 0)
    };
  });

  return out;
}

function getParticipantIds(room) {
  const ids = Array.isArray(room?.match?.participantIds) ? room.match.participantIds : [];
  return ids.map((id) => __normalizePid(id)).filter(Boolean);
}

function getBattlePlayers(room) {
  const allPlayers = normalizePlayers(room?.players || []);
  const participantIds = getParticipantIds(room);
  if (!participantIds.length) return allPlayers;
  const map = new Map(allPlayers.map((p) => [p.id, p]));
  return participantIds.map((id) => map.get(id)).filter(Boolean);
}

function amIParticipant(room) {
  const ids = getParticipantIds(room);
  if (!ids.length) return true;
  return ids.includes(GJ_PID);
}

function buildBattleSummaryPayload(room, players, pending = false, reason = '') {
  return {
    version: '20260319-battle-attack-v1',
    source: 'goodjunk-battle',
    gameId: GJ_GAME_ID,
    mode: 'battle',
    pid: GJ_PID,
    name: GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    roomId: GJ_ROOM_ID,
    pending,
    reason,
    playerCount: players.length,
    updatedAt: Date.now(),
    players: players.map((p) => ({
      pid: p.id,
      name: p.name || p.id,
      finished: !!p.finished,
      connected: p.connected !== false,
      score: Number(p.finalScore || 0),
      miss: Number(p.miss || 0),
      streak: Number(p.streak || 0)
    }))
  };
}

function hideSummary() {
  const wrap = document.getElementById('battleSummary');
  if (wrap) wrap.hidden = true;
}

function safeFilePart(value) {
  return String(value || 'file').replace(/[^a-z0-9_-]/gi, '-');
}

function downloadJson(payload, filename = `goodjunk-battle-${Date.now()}.json`) {
  if (!payload) return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadRoom() {
  if (!await ensureFirebase()) return null;
  try {
    const snap = await roomRef.once('value');
    return sanitizeRoom(snapshotToRoom(snap.val()));
  } catch (err) {
    console.error('[goodjunk.safe.battle] loadRoom failed:', err);
    return null;
  }
}

async function saveRoom(room) {
  if (!await ensureFirebase()) return false;
  try {
    await roomRef.set(roomToFirebase(room));
    return true;
  } catch (err) {
    console.error('[goodjunk.safe.battle] saveRoom failed:', err);
    return false;
  }
}

async function ensureFirebase() {
  if (fbReady && db && roomRef && myPlayerRef) return true;

  const ok = await new Promise((resolve) => {
    if (window.HHA_FIREBASE_READY && window.HHA_FIREBASE_DB) {
      resolve(true);
      return;
    }

    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      resolve(!!value);
    };

    const timer = setTimeout(() => finish(false), 12000);

    window.addEventListener('hha:firebase_ready', (ev) => {
      clearTimeout(timer);
      finish(!!ev?.detail?.ok && !!window.HHA_FIREBASE_DB);
    }, { once: true });
  });

  if (!ok || !window.HHA_FIREBASE_DB) return false;

  db = window.HHA_FIREBASE_DB;
  roomRef = db.ref(ROOM_PATH);
  myPlayerRef = roomRef.child('players').child(GJ_PID);
  fbReady = true;
  return true;
}

async function setupOnDisconnect() {
  if (!await ensureFirebase()) return;
  try {
    await myPlayerRef.onDisconnect().update({
      connected: false,
      phase: 'run'
    });
  } catch {}
}

async function markPresence(patch = {}) {
  if (!await ensureFirebase()) return;

  try {
    const snap = await myPlayerRef.once('value');
    const cur = snap.exists() ? snap.val() : {};

    await myPlayerRef.update({
      name: GJ_NAME || cur.name || GJ_PID,
      ready: patch.ready ?? cur.ready ?? true,
      connected: patch.connected ?? true,
      phase: patch.phase || cur.phase || 'run',
      finished: patch.finished ?? cur.finished ?? false,
      finalScore: patch.finalScore ?? cur.finalScore ?? 0,
      miss: patch.miss ?? cur.miss ?? 0,
      streak: patch.streak ?? cur.streak ?? 0,
      joinedAt: cur.joinedAt || Date.now(),
      finishedAt: patch.finishedAt ?? cur.finishedAt ?? 0,
      lastSeenAt: Date.now()
    });

    await roomRef.child('updatedAt').set(Date.now());
  } catch (err) {
    console.error('[goodjunk.safe.battle] markPresence failed:', err);
  }
}

async function markDisconnected() {
  if (!await ensureFirebase()) return;

  try {
    const snap = await myPlayerRef.once('value');
    if (!snap.exists()) return;
    const cur = snap.val();
    if (cur.finished) return;

    await myPlayerRef.update({
      connected: false,
      phase: 'run',
      lastSeenAt: Date.now()
    });

    await roomRef.child('updatedAt').set(Date.now());
  } catch {}
}

function startHeartbeat() {
  stopHeartbeat();
  markPresence({
    phase: 'run',
    ready: true,
    connected: true,
    finished: false
  });

  heartbeatTimer = setInterval(() => {
    markPresence({
      phase: 'run',
      ready: true,
      connected: true,
      finished: false,
      finalScore: state.score,
      miss: state.miss,
      streak: state.bestStreak
    });
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = 0;
  }
}

function startWatchdog() {
  stopWatchdog();
  watchdogTimer = setInterval(() => {
    maybeFinalizeRoom(false);
  }, 3000);
}

function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = 0;
  }
}

async function maybeFinalizeRoom(force = false) {
  const room = await loadRoom();
  if (!room) return;
  if (!amIParticipant(room)) return;

  const players = normalizePlayers(room.players);
  const participantIds = getParticipantIds(room);
  const set = new Set(participantIds);
  const battlePlayers = set.size ? players.filter((p) => set.has(p.id)) : players;

  if (!battlePlayers.length) return;

  const ts = Date.now();
  let changed = false;

  const nextPlayers = players.map((p) => {
    const inMatch = set.size ? set.has(p.id) : true;
    if (!inMatch) return p;
    if (p.finished) return p;

    const stale = !p.lastSeenAt || (ts - p.lastSeenAt > STALE_MS);
    if (force || stale) {
      changed = true;
      return {
        ...p,
        connected: false,
        phase: 'done',
        finished: true,
        finishedAt: ts
      };
    }

    return p;
  });

  const nextBattlePlayers = set.size ? nextPlayers.filter((p) => set.has(p.id)) : nextPlayers;
  const allFinished = nextBattlePlayers.every((p) => p.finished);

  if (allFinished) {
    room.status = 'finished';
    room.match = {
      ...(room.match || {}),
      status: 'finished',
      battle: {
        ...(room.match?.battle || {}),
        finishedAt: ts,
        attacks: room.match?.battle?.attacks || {}
      }
    };
    changed = true;
  }

  if (changed) {
    room.players = nextPlayers;
    room.updatedAt = ts;
    await saveRoom(room);
  }

  if (room.status === 'finished') {
    state.running = false;
    state.ended = true;
    localRunActive = false;
    stopHeartbeat();
    stopWatchdog();
    showSummary(room, nextBattlePlayers, false, 'finished');
  }
}

async function publishProgress() {
  await markPresence({
    phase: 'run',
    ready: true,
    connected: true,
    finished: false,
    finalScore: state.score,
    miss: state.miss,
    streak: state.bestStreak
  });
}

async function publishFinish(reason = 'finished') {
  await markPresence({
    phase: 'done',
    ready: true,
    connected: true,
    finished: true,
    finalScore: state.score,
    miss: state.miss,
    streak: state.bestStreak,
    finishedAt: Date.now()
  });

  const room = await loadRoom();
  if (!room) return;
  if (!amIParticipant(room)) return;

  const players = getBattlePlayers(room);
  const allFinished = players.every((p) => p.finished);

  if (allFinished) {
    room.status = 'finished';
    room.match = {
      ...(room.match || {}),
      status: 'finished',
      battle: {
        ...(room.match?.battle || {}),
        finishedAt: Date.now(),
        attacks: room.match?.battle?.attacks || {}
      }
    };
    room.updatedAt = Date.now();

    await saveRoom(room);

    state.running = false;
    state.ended = true;
    stopHeartbeat();
    stopWatchdog();

    showSummary(room, players, false, reason);
    return;
  }

  showSummary(room, players, true, reason);
}

function showSummary(room, players, pending = false, reason = '') {
  const wrap = document.getElementById('battleSummary');
  const rowsBox = document.getElementById('battleSummaryRows');
  const badge = document.getElementById('battleSummaryBadge');
  const sub = document.getElementById('battleSummarySub');
  const hint = document.getElementById('battleSummaryHint');

  if (!wrap || !rowsBox) return;
  if (!amIParticipant(room)) return;

  const sorted = [...players].sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (a.miss !== b.miss) return a.miss - b.miss;
    return b.streak - a.streak;
  });

  const myRank = Math.max(1, sorted.findIndex((p) => p.id === GJ_PID) + 1);

  rowsBox.innerHTML = sorted.map((p) => {
    const isMe = p.id === GJ_PID;
    const statusText = p.finished ? 'รอบนี้จบแล้ว' : (p.connected === false ? 'ขาดการเชื่อมต่อ' : 'ยังไม่จบ');

    return `
      <div class="result-row ${isMe ? 'is-me' : ''}">
        <div>
          <div style="font-weight:800;">
            ${escapeHtml(p.name || p.id)}
            ${isMe ? '<span style="color:#fcd34d;"> • คุณ</span>' : ''}
          </div>
          <div style="margin-top:4px;font-size:12px;color:${p.finished ? '#86efac' : '#fbbf24'};font-weight:800;">
            ${escapeHtml(statusText)}
          </div>
        </div>
        <div>${Number(p.finalScore || 0)}</div>
        <div>${Number(p.miss || 0)}</div>
        <div>${Number(p.streak || 0)}</div>
      </div>
    `;
  }).join('');

  if (badge) {
    badge.textContent = pending ? 'PENDING' : `อันดับ #${myRank}`;
  }

  if (sub) {
    sub.textContent = pending
      ? 'ผลชั่วคราว • คุณจบรอบแล้ว แต่ยังรอผู้เล่นคนอื่น'
      : `ผลสุดท้าย • ผู้เล่นทั้งหมด ${sorted.length} คน`;
  }

  if (hint) {
    hint.textContent = pending
      ? 'summary นี้ยังไม่ final จนกว่าผู้เล่นใน participant จะจบครบหรือถูกตัดสิทธิ์'
      : 'Battle นี้จัดอันดับจากคะแนนก่อน แล้วดู miss และ best streak';
  }

  lastSummary = buildBattleSummaryPayload(room, sorted, pending, reason);
  wrap.hidden = false;
  if (BATTLE_UI?.setStatus) BATTLE_UI.setStatus(pending ? 'pending' : 'finished');
}

async function resetRoomForRematch() {
  const room = await loadRoom();
  if (!room) return;

  room.status = 'waiting';
  room.startAt = null;
  room.match = {
    participantIds: [],
    lockedAt: null,
    status: 'idle',
    battle: {
      finishedAt: 0,
      attacks: {}
    }
  };
  room.updatedAt = Date.now();

  room.players = normalizePlayers(room.players).map((p) => ({
    ...p,
    ready: false,
    connected: true,
    phase: 'lobby',
    finished: false,
    finalScore: 0,
    miss: 0,
    streak: 0,
    finishedAt: 0,
    lastSeenAt: Date.now()
  }));

  await saveRoom(room);
  hideSummary();
}

function buildLobbyUrl() {
  const q = new URLSearchParams({
    pid: GJ_PID,
    name: GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    diff: RUN_CTX.diff || 'normal',
    time: RUN_CTX.time || '120',
    seed: String(Date.now()),
    hub: GJ_HUB,
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    gameId: GJ_GAME_ID,
    mode: 'battle',
    roomId: GJ_ROOM_ID
  });
  return `./goodjunk-battle-lobby.html?${q.toString()}`;
}

async function bootWithGate(startFn) {
  if (booted) return;
  booted = true;

  if (!GJ_ROOM_ID) {
    showGate('ยังไม่มี room จากลิงก์นี้', '...', 'กลับไป lobby แล้วเริ่มใหม่');
    return;
  }

  const room = await loadRoom();
  if (room) {
    if (!amIParticipant(room)) {
      showGate('คุณไม่ได้อยู่ใน participant ของรอบนี้', '...', 'กลับไป lobby เพื่อรอรอบถัดไป');
      return;
    }
  }

  if (!getEffectiveStartAt()) {
    const currentRoom = room || await loadRoom();
    if (currentRoom?.startAt) recoveredStartAt = Number(currentRoom.startAt || 0);
  }

  if (!getEffectiveStartAt()) {
    showGate('กำลังรอเริ่ม Battle', '...', 'ยังไม่มีสัญญาณเริ่มจากห้อง');
    return;
  }

  showGate('กำลังนับถอยหลังก่อนเริ่มพร้อมกัน', '-', `Room: ${GJ_ROOM_ID}`);
  await waitUntilStart(getEffectiveStartAt());
  cancelGateLoop();
  hideGate();
  startFn();
}

function attachRoomListener() {
  if (roomListenerBound) return;
  roomListenerBound = true;

  ensureFirebase().then((ok) => {
    if (!ok || !roomRef) return;

    roomRef.on('value', async (snap) => {
      const room = sanitizeRoom(snapshotToRoom(snap.val()));
      if (!room) return;

      liveRoom = room;
      recoveredStartAt = Number(room.startAt || recoveredStartAt || 0);

      if (!amIParticipant(room)) {
        hideSummary();
        return;
      }

      await handleIncomingAttacks(room);

      if (room.status === 'finished') {
        state.running = false;
        state.ended = true;
        localRunActive = false;
        stopHeartbeat();
        stopWatchdog();
        showSummary(room, getBattlePlayers(room), false, 'finished');
        return;
      }

      if (room.status === 'running' && BATTLE_UI?.setStatus) {
        BATTLE_UI.setStatus('running');
      }

      const players = getBattlePlayers(room);
      const me = players.find((p) => p.id === GJ_PID);

      if (me && !me.finished && localRunActive && !state.ended) {
        hideSummary();
      }

      renderHud();
      await maybeFinalizeRoom(false);
    });
  });
}