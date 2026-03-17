const __qs = new URLSearchParams(location.search);
const RUN_CTX = window.__GJ_RUN_CTX__ || {
  pid: __qs.get('pid') || 'anon',
  name: __qs.get('name') || '',
  studyId: __qs.get('studyId') || '',
  roomId: __qs.get('roomId') || '',
  mode: (__qs.get('mode') || 'solo').toLowerCase(),
  diff: __qs.get('diff') || 'normal',
  time: __qs.get('time') || '120',
  seed: __qs.get('seed') || String(Date.now()),
  startAt: Number(__qs.get('startAt') || 0) || 0,
  hub: __qs.get('hub') || '../hub.html',
  view: __qs.get('view') || 'mobile',
  run: __qs.get('run') || 'play',
  gameId: __qs.get('gameId') || 'goodjunk'
};

const GJ_PID = RUN_CTX.pid || 'anon';
const GJ_NAME = String(RUN_CTX.name || GJ_PID).trim();
const GJ_MODE = (RUN_CTX.mode || 'solo').toLowerCase();
const GJ_ROOM_ID = RUN_CTX.roomId || '';
const GJ_START_AT = Number(RUN_CTX.startAt || 0) || 0;
const GJ_HUB = RUN_CTX.hub || '../hub.html';
const GJ_GAME_ID = RUN_CTX.gameId || 'goodjunk';

const GAME_MOUNT = document.getElementById('gameMount') || document.body;
const RACE_UI = window.__gjRaceUi || null;

const GOODJUNK_STYLE_ID = 'goodjunk-safe-style-20260317-fb';
const GOODJUNK_ROOT_ID = 'gjRoot';

const GJ_SOLO_LAST_SUMMARY_KEY = `GJ_SOLO_LAST_SUMMARY_${GJ_PID}`;
const GJ_SOLO_SUMMARY_HISTORY_KEY = `GJ_SOLO_SUMMARY_HISTORY_${GJ_PID}`;
const GJ_RACE_LAST_SUMMARY_KEY = `GJ_RACE_LAST_SUMMARY_${GJ_PID}`;
const GJ_RACE_SUMMARY_HISTORY_KEY = `GJ_RACE_SUMMARY_HISTORY_${GJ_PID}`;

const GJ_RACE_HEARTBEAT_MS = 2500;
const GJ_RACE_STALE_MS = 12000;
const GJ_RACE_WATCHDOG_MS = 3000;
const GJ_FIREBASE_ROOM_PATH = GJ_ROOM_ID ? `hha-battle/goodjunk/rooms/${GJ_ROOM_ID}` : '';

let __gjRaceBooted = false;
let __gjRaceRAF = 0;
let __gjRaceFinished = false;
let __gjRaceResultBound = false;
let __gjRaceHeartbeatTimer = 0;
let __gjRaceWatchdogTimer = 0;
let __gjRaceLastSummary = null;
let __gjRaceLastSummarySig = '';
let __gjSoloSummary = null;
let __gjSoloSummaryBound = false;
let __gjRaceRoomListenerBound = false;

let __gjFbReady = false;
let __gjRaceDb = null;
let __gjRaceRoomRef = null;
let __gjRacePlayersRef = null;
let __gjRaceMyPlayerRef = null;

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
  mode: GJ_MODE === 'race' ? 'race' : 'solo',
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
  running: false,
  ended: false,
  startTs: 0,
  lastFrameTs: 0,
  lastSpawnAccum: 0,
  frameRaf: 0,
  targetSeq: 0,
  targets: new Map(),
  rect: { width: 0, height: 0 },
  pendingResultVisible: false
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
  attachRaceRoomListener();

  if (isRaceMode()) {
    openRaceResultFromRoom();
  }

  bootWithRaceGate(async () => {
    await ensureRaceFirebase();
    await setupRunOnDisconnect();

    await markRacePresenceDuringRun({
      phase: 'run',
      ready: true,
      connected: true,
      finished: false,
      dnf: false,
      dnfReason: ''
    });

    startRaceHeartbeat();
    startRaceWatchdog();
    startGame();
  });

  window.addEventListener('beforeunload', () => {
    try {
      stopRaceHeartbeat();
      stopRaceWatchdog();

      if (isRaceMode() && !__gjRaceFinished) {
        markMyRaceDisconnected('left-run');
      }
    } catch {}
  });

  window.addEventListener('resize', refreshStageRect);
}

function injectGameplayStyle() {
  if (document.getElementById(GOODJUNK_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = GOODJUNK_STYLE_ID;
  style.textContent = `
    #${GOODJUNK_ROOT_ID}{position:absolute;inset:0;z-index:2;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation}
    .gj-shell{position:absolute;inset:0;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden}
    .gj-topbar{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;padding:60px 14px 12px;padding-top:calc(60px + env(safe-area-inset-top,0px));pointer-events:none}
    .gj-chip-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;pointer-events:none}
    .gj-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.66);color:#e5e7eb;font-weight:900;font-size:13px;backdrop-filter:blur(8px);box-shadow:0 10px 24px rgba(0,0,0,.18)}
    .gj-chip span{color:#94a3b8;font-weight:800}
    .gj-stage-wrap{position:relative;min-height:0;padding:8px 10px 10px}
    .gj-stage{position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;border:1px solid rgba(148,163,184,.18);border-radius:26px;background:radial-gradient(circle at 50% 0%, rgba(56,189,248,.08), transparent 30%),linear-gradient(180deg, rgba(15,23,42,.72), rgba(2,6,23,.78));box-shadow:0 24px 64px rgba(0,0,0,.22)}
    .gj-stage::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg, rgba(255,255,255,.04), transparent 30%),linear-gradient(0deg, rgba(255,255,255,.03), transparent 30%);pointer-events:none}
    .gj-target-layer{position:absolute;inset:0;overflow:hidden}
    .gj-center-tip{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(86vw,420px);padding:16px 18px;border-radius:18px;background:rgba(2,6,23,.50);border:1px solid rgba(148,163,184,.18);color:#e5e7eb;text-align:center;font-weight:900;backdrop-filter:blur(6px);pointer-events:none;opacity:.96;transition:opacity .35s ease, transform .35s ease;box-shadow:0 16px 36px rgba(0,0,0,.18)}
    .gj-center-tip.hide{opacity:0;transform:translate(-50%,-50%) scale(.96)}
    .gj-target{position:absolute;display:grid;place-items:center;border-radius:20px;border:1px solid rgba(255,255,255,.16);box-shadow:0 14px 28px rgba(0,0,0,.18);transform:translate3d(0,0,0);cursor:pointer;outline:none;padding:0;overflow:hidden;background:rgba(15,23,42,.78)}
    .gj-target.good{background:radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), transparent 26%),linear-gradient(180deg, rgba(34,197,94,.30), rgba(34,197,94,.18)),rgba(15,23,42,.84);border-color:rgba(34,197,94,.30)}
    .gj-target.junk{background:radial-gradient(circle at 30% 25%, rgba(255,255,255,.20), transparent 26%),linear-gradient(180deg, rgba(244,63,94,.26), rgba(244,63,94,.14)),rgba(15,23,42,.84);border-color:rgba(244,63,94,.28)}
    .gj-emoji{font-size:32px;line-height:1;transform:translateY(-2px);filter:drop-shadow(0 6px 10px rgba(0,0,0,.18))}
    .gj-type{position:absolute;left:8px;right:8px;bottom:6px;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#e2e8f0;opacity:.92;text-align:center;white-space:nowrap}
    .gj-fx{position:absolute;font-size:16px;font-weight:900;pointer-events:none;transform:translate(-50%,-50%);animation:gj-fx-up .75s ease forwards;text-shadow:0 8px 18px rgba(0,0,0,.22)}
    @keyframes gj-fx-up{from{opacity:1;transform:translate(-50%,-20%)}to{opacity:0;transform:translate(-50%,-140%)}}
    .gj-bottom{padding:0 12px calc(12px + env(safe-area-inset-bottom,0px))}
    .gj-bottom-card{border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:12px;background:rgba(2,6,23,.62);backdrop-filter:blur(8px);box-shadow:0 10px 24px rgba(0,0,0,.18)}
    .gj-bottom-top{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
    .gj-progress{position:relative;width:100%;height:12px;border-radius:999px;overflow:hidden;border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.06)}
    .gj-progress-bar{width:100%;height:100%;background:linear-gradient(90deg, rgba(56,189,248,.85), rgba(34,197,94,.85));transform-origin:left center;transition:transform .12s linear}
    .gj-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:13px;color:#cbd5e1;line-height:1.5}
    .gj-legend strong{color:#e5e7eb}
    .gj-solo-overlay{position:fixed;inset:0;z-index:10010;display:grid;place-items:center;padding:calc(16px + env(safe-area-inset-top,0px)) calc(16px + env(safe-area-inset-right,0px)) calc(16px + env(safe-area-inset-bottom,0px)) calc(16px + env(safe-area-inset-left,0px));background:rgba(2,6,23,.82);backdrop-filter:blur(10px)}
    .gj-solo-overlay[hidden]{display:none!important}
    .gj-solo-card{width:min(94vw,520px);max-height:88vh;overflow:auto;background:rgba(15,23,42,.96);border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:20px 18px 18px;color:#e5e7eb;box-shadow:0 28px 64px rgba(0,0,0,.35)}
    .gj-solo-kicker{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.25);color:#7dd3fc;font-weight:900;font-size:13px;margin-bottom:12px}
    .gj-solo-title{margin:0 0 8px;font-size:30px;line-height:1.1}
    .gj-solo-sub{margin:0;color:#94a3b8;font-size:14px;line-height:1.6}
    .gj-solo-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}
    .gj-solo-item{border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:12px;background:rgba(2,6,23,.45)}
    .gj-solo-item .label{color:#94a3b8;font-size:12px;font-weight:800;margin-bottom:6px}
    .gj-solo-item .value{color:#e5e7eb;font-size:20px;font-weight:900}
    .gj-solo-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
    @media (max-width:640px){
      .gj-topbar{padding-left:10px;padding-right:10px}
      .gj-chip{font-size:12px;padding:7px 9px}
      .gj-emoji{font-size:28px}
      .gj-solo-title{font-size:26px}
      .gj-solo-actions .btn{flex:1 1 calc(50% - 10px)}
    }
  `;
  document.head.appendChild(style);
}

function buildGameplayShell() {
  GAME_MOUNT.innerHTML = `
    <div id="${GOODJUNK_ROOT_ID}">
      <div class="gj-shell">
        <header class="gj-topbar">
          <div class="gj-chip-row">
            <div class="gj-chip"><span>Score</span><strong id="gjScore">0</strong></div>
            <div class="gj-chip"><span>Time</span><strong id="gjTimer">0</strong></div>
            <div class="gj-chip"><span>Miss</span><strong id="gjMiss">0</strong></div>
            <div class="gj-chip"><span>Streak</span><strong id="gjStreak">0</strong></div>
          </div>
          <div class="gj-chip-row">
            <div class="gj-chip"><span>Goal</span><strong>เก็บของดี • อย่าแตะ junk</strong></div>
          </div>
        </header>

        <div class="gj-stage-wrap">
          <div class="gj-stage" id="gjStage">
            <div class="gj-center-tip" id="gjCenterTip">แตะอาหารดีเพื่อได้คะแนน • หลีกเลี่ยง junk ไม่ให้เสีย Miss</div>
            <div class="gj-target-layer" id="gjTargetLayer"></div>
          </div>
        </div>

        <div class="gj-bottom">
          <div class="gj-bottom-card">
            <div class="gj-bottom-top">
              <div class="gj-legend" id="gjStatsText">
                <div><strong>Good hit:</strong> 0</div>
                <div><strong>Junk hit:</strong> 0</div>
                <div><strong>Good missed:</strong> 0</div>
              </div>
              <div class="gj-legend" id="gjHintText">
                <div>Tip: เก็บผลไม้/ผัก • หลีกเลี่ยงของหวาน/น้ำอัดลม</div>
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
  ui.soloOverlay = document.getElementById('gjSoloSummary');
  ui.soloBody = document.getElementById('gjSoloBody');
  ui.soloTitle = document.getElementById('gjSoloTitle');
  ui.soloSub = document.getElementById('gjSoloSub');
  ui.soloBtnAgain = document.getElementById('gjSoloAgain');
  ui.soloBtnExport = document.getElementById('gjSoloExport');
  ui.soloBtnHub = document.getElementById('gjSoloHub');

  refreshStageRect();
  renderHud();
}

function bindGameplayShell() {
  if (__gjSoloSummaryBound) return;
  __gjSoloSummaryBound = true;

  ui.soloBtnAgain?.addEventListener('click', () => {
    location.href = buildReplayUrl();
  });

  ui.soloBtnExport?.addEventListener('click', () => {
    downloadJson(__gjSoloSummary, `goodjunk-solo-${safeFilePart(GJ_PID)}-${Date.now()}.json`);
  });

  ui.soloBtnHub?.addEventListener('click', () => {
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
function clampInt(value, min, max){ return Math.max(min, Math.min(max, Math.floor(value))); }
function pick(arr){ return arr[Math.floor(rand() * arr.length)]; }

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
  state.running = true;
  state.ended = false;
  state.pendingResultVisible = false;
  state.startTs = performance.now();
  state.lastFrameTs = state.startTs;
  state.lastSpawnAccum = 0;
  state.targetSeq = 0;
  state.targets.clear();

  if (ui.layer) ui.layer.innerHTML = '';
  if (ui.centerTip) {
    ui.centerTip.classList.remove('hide');
    ui.centerTip.textContent = state.mode === 'race'
      ? 'เริ่มพร้อมกันแล้ว • เก็บอาหารดีให้ได้คะแนนสูงสุด'
      : 'เก็บอาหารดีให้ได้คะแนนสูงสุด • อย่าแตะ junk';
    setTimeout(() => ui.centerTip?.classList.add('hide'), 1800);
  }

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
  updateTargets(dt);
  renderHud();

  state.frameRaf = requestAnimationFrame(loop);
}

function updateSpawner(dt) {
  const preset = DIFF_PRESET[state.diff] || DIFF_PRESET.normal;
  state.lastSpawnAccum += dt;

  while (state.lastSpawnAccum >= preset.spawnMs) {
    state.lastSpawnAccum -= preset.spawnMs;
    spawnTarget();
  }
}

function spawnTarget() {
  refreshStageRect();

  const preset = DIFF_PRESET[state.diff] || DIFF_PRESET.normal;
  const isGood = rand() < preset.goodRatio;
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
      if (target.type === 'good') registerMissGood(target);
      else removeTarget(target.id);
    }
  });

  toRemove.forEach(removeTarget);
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
    createFx(target.x + target.size / 2, target.y + target.size / 2, `+${gain}`, '#86efac');
    updateHint('เยี่ยมมาก! เก็บของดีต่อไป');
  } else {
    state.hitsBad += 1;
    state.miss += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - 8);
    createFx(target.x + target.size / 2, target.y + target.size / 2, 'MISS', '#fda4af');
    updateHint('ระวัง junk! แตะของดีแทน');
  }

  removeTarget(id);
  renderHud();
}

function registerMissGood(target) {
  state.missedGood += 1;
  state.miss += 1;
  state.streak = 0;

  createFx(target.x + target.size / 2, Math.max(28, target.y), 'พลาดของดี', '#fbbf24');
  updateHint('มีของดีหลุดไปแล้ว รีบเก็บชิ้นต่อไป');
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

function updateHint(message) {
  if (!ui.hint) return;
  ui.hint.innerHTML = `<div>${escapeHtml(message)}</div>`;
}

function renderHud() {
  if (ui.score) ui.score.textContent = String(state.score);
  if (ui.timer) ui.timer.textContent = formatSeconds(state.timeLeftMs);
  if (ui.miss) ui.miss.textContent = String(state.miss);
  if (ui.streak) ui.streak.textContent = String(state.streak);

  if (ui.progress) {
    const ratio = state.totalMs > 0 ? state.timeLeftMs / state.totalMs : 0;
    ui.progress.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
  }

  if (ui.stats) {
    ui.stats.innerHTML = `
      <div><strong>Good hit:</strong> ${state.hitsGood}</div>
      <div><strong>Junk hit:</strong> ${state.hitsBad}</div>
      <div><strong>Good missed:</strong> ${state.missedGood}</div>
    `;
  }
}

function formatSeconds(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function endGame(reason = 'finished') {
  if (state.ended) return;

  state.ended = true;
  state.running = false;
  cancelAnimationFrame(state.frameRaf);
  state.frameRaf = 0;

  stopRaceHeartbeat();

  const finalStats = {
    gameId: GJ_GAME_ID,
    mode: state.mode,
    pid: GJ_PID,
    name: GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    diff: state.diff,
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    seed: RUN_CTX.seed || '',
    roomId: GJ_ROOM_ID,
    raceStartAt: GJ_START_AT,
    reason,
    score: state.score,
    miss: state.miss,
    streak: state.bestStreak,
    bestStreak: state.bestStreak,
    hitsGood: state.hitsGood,
    hitsBad: state.hitsBad,
    missedGood: state.missedGood,
    spawnedGood: state.spawnedGood,
    spawnedJunk: state.spawnedJunk,
    updatedAt: Date.now()
  };

  state.targets.forEach((t) => t.el.remove());
  state.targets.clear();

  if (isRaceMode()) {
    publishRaceFinish({
      score: finalStats.score,
      miss: finalStats.miss,
      streak: finalStats.bestStreak
    });
    return;
  }

  showSoloSummary(finalStats);
}

function showSoloSummary(summary) {
  __gjSoloSummary = buildSoloSummaryPayload(summary);
  persistSoloSummary(__gjSoloSummary);

  if (!ui.soloOverlay || !ui.soloBody) return;

  ui.soloTitle.textContent = __gjSoloSummary.score >= 100 ? 'ยอดเยี่ยมมาก!' : 'สรุปผลการเล่น';
  ui.soloSub.textContent = 'เก็บของดีให้มากขึ้น และอย่าแตะ junk ในรอบถัดไป';

  ui.soloBody.innerHTML = `
    <div class="gj-solo-item"><div class="label">คะแนน</div><div class="value">${__gjSoloSummary.score}</div></div>
    <div class="gj-solo-item"><div class="label">Miss</div><div class="value">${__gjSoloSummary.miss}</div></div>
    <div class="gj-solo-item"><div class="label">Best Streak</div><div class="value">${__gjSoloSummary.bestStreak}</div></div>
    <div class="gj-solo-item"><div class="label">Good hit</div><div class="value">${__gjSoloSummary.hitsGood}</div></div>
    <div class="gj-solo-item"><div class="label">Junk hit</div><div class="value">${__gjSoloSummary.hitsBad}</div></div>
    <div class="gj-solo-item"><div class="label">Good missed</div><div class="value">${__gjSoloSummary.missedGood}</div></div>
  `;

  ui.soloOverlay.hidden = false;
}

function buildSoloSummaryPayload(summary) {
  return {
    version: '20260317-goodjunk-solo-summary',
    source: 'goodjunk-solo',
    gameId: GJ_GAME_ID,
    mode: 'solo',
    pid: GJ_PID,
    name: GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    diff: state.diff,
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    seed: RUN_CTX.seed || '',
    finishType: 'normal',
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
    missedGood: Number(summary.missedGood || 0),
    updatedAt: Date.now()
  };
}

function persistSoloSummary(summary) {
  try { localStorage.setItem(GJ_SOLO_LAST_SUMMARY_KEY, JSON.stringify(summary)); } catch {}
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
      title: 'GoodJunk Solo',
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
      updatedAt: summary.updatedAt
    }));
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent('gj:solo-summary', { detail: summary }));
    window.dispatchEvent(new CustomEvent('hha:solo-summary', { detail: summary }));
  } catch {}
}

function isRaceMode() {
  return GJ_MODE === 'race';
}

function hasValidRaceStart() {
  return !!GJ_ROOM_ID && Number.isFinite(GJ_START_AT) && GJ_START_AT > 0;
}

function showRaceGate(msg = 'กำลังรอสัญญาณเริ่ม', count = '-', sub = '') {
  if (RACE_UI?.showGate) {
    RACE_UI.showGate(msg, count, sub);
    return;
  }

  const wrap = document.getElementById('raceGate');
  const text = document.getElementById('raceGateText');
  const num  = document.getElementById('raceGateCount');
  const subEl = document.getElementById('raceGateSub');

  if (wrap) wrap.hidden = false;
  if (text) text.textContent = msg;
  if (num) num.textContent = count;
  if (subEl) subEl.textContent = sub || 'เกมจะเริ่มพร้อมกันเมื่อถึงเวลา startAt';
}

function hideRaceGate() {
  if (RACE_UI?.hideGate) {
    RACE_UI.hideGate();
    return;
  }
  const wrap = document.getElementById('raceGate');
  if (wrap) wrap.hidden = true;
}

function cancelRaceGateLoop() {
  if (__gjRaceRAF) cancelAnimationFrame(__gjRaceRAF);
  __gjRaceRAF = 0;
}

function waitUntilRaceStart(startAt) {
  return new Promise((resolve) => {
    const tick = () => {
      const left = startAt - Date.now();

      if (left <= 0) {
        showRaceGate('เริ่มการแข่งขัน', 'GO!', 'กำลังเข้าสู่เกม...');
        window.setTimeout(resolve, 220);
        return;
      }

      showRaceGate(
        'กำลังนับถอยหลังก่อนเริ่มพร้อมกัน',
        String(Math.ceil(left / 1000)),
        `Room: ${GJ_ROOM_ID || '-'}`
      );

      __gjRaceRAF = requestAnimationFrame(tick);
    };

    tick();
  });
}

async function bootWithRaceGate(startFn) {
  if (__gjRaceBooted) return;
  __gjRaceBooted = true;

  if (!isRaceMode()) {
    startFn();
    return;
  }

  if (!hasValidRaceStart()) {
    showRaceGate('ยังไม่มีสัญญาณเริ่มจากห้องแข่ง', '...', 'กลับไปหน้า lobby แล้วเริ่มใหม่');
    return;
  }

  showRaceGate('กำลังรอสัญญาณเริ่มจากห้องแข่ง', '-', `Room: ${GJ_ROOM_ID}`);
  await waitUntilRaceStart(GJ_START_AT);
  cancelRaceGateLoop();
  hideRaceGate();
  startFn();
}

function waitForFirebaseReady(timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (window.HHA_FIREBASE_READY && window.HHA_FIREBASE_DB) {
      resolve(true);
      return;
    }

    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      resolve(!!ok);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    window.addEventListener('hha:firebase_ready', (ev) => {
      clearTimeout(timer);
      finish(!!ev?.detail?.ok && !!window.HHA_FIREBASE_DB);
    }, { once: true });
  });
}

async function ensureRaceFirebase() {
  if (!isRaceMode()) return false;
  if (__gjFbReady && __gjRaceDb && __gjRaceRoomRef) return true;

  const ok = await waitForFirebaseReady();
  if (!ok || !window.HHA_FIREBASE_DB) {
    console.warn('[goodjunk.safe] Firebase not ready for race room');
    return false;
  }

  __gjRaceDb = window.HHA_FIREBASE_DB;
  __gjRaceRoomRef = __gjRaceDb.ref(GJ_FIREBASE_ROOM_PATH);
  __gjRacePlayersRef = __gjRaceRoomRef.child('players');
  __gjRaceMyPlayerRef = __gjRacePlayersRef.child(GJ_PID);
  __gjFbReady = true;
  return true;
}

function snapshotToRaceRoom(val) {
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

function normalizeRacePlayers(players) {
  return Array.isArray(players) ? players.filter(Boolean).map((p) => ({
    id: String(p.id || '').trim(),
    name: String(p.name || '').trim(),
    ready: !!p.ready,
    connected: p.connected !== false,
    phase: String(p.phase || (p.finished ? 'done' : 'run')).trim(),
    finished: !!p.finished,
    dnf: !!p.dnf,
    dnfReason: String(p.dnfReason || '').trim(),
    finalScore: Number(p.finalScore || 0),
    miss: Number(p.miss || 0),
    streak: Number(p.streak || 0),
    joinedAt: Number(p.joinedAt || 0),
    lastSeenAt: Number(p.lastSeenAt || 0),
    finishedAt: Number(p.finishedAt || 0)
  })) : [];
}

function sanitizeRaceRoom(room) {
  if (!room) return null;

  const safe = {
    roomId: String(room.roomId || GJ_ROOM_ID || ''),
    hostId: String(room.hostId || ''),
    mode: String(room.mode || 'race'),
    minPlayers: Math.max(2, Number(room.minPlayers || 2)),
    maxPlayers: Math.max(2, Number(room.maxPlayers || 4)),
    status: ['waiting', 'countdown', 'running', 'finished'].includes(room.status) ? room.status : 'waiting',
    startAt: room.startAt ? Number(room.startAt) : null,
    createdAt: Number(room.createdAt || Date.now()),
    updatedAt: Number(room.updatedAt || Date.now()),
    players: normalizeRacePlayers(room.players || [])
  };

  if (!safe.players.some((p) => p.id === safe.hostId)) {
    safe.hostId = safe.players[0]?.id || '';
  }

  return safe;
}

function raceRoomToFirebase(room) {
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
    players: {}
  };

  normalizeRacePlayers(room.players).forEach((p) => {
    out.players[p.id] = {
      name: p.name || '',
      ready: !!p.ready,
      connected: p.connected !== false,
      phase: p.phase || 'run',
      finished: !!p.finished,
      dnf: !!p.dnf,
      dnfReason: p.dnfReason || '',
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

async function loadRaceRoom() {
  if (!await ensureRaceFirebase()) return null;
  try {
    const snap = await __gjRaceRoomRef.once('value');
    return sanitizeRaceRoom(snapshotToRaceRoom(snap.val()));
  } catch (err) {
    console.error('[goodjunk.safe] loadRaceRoom failed:', err);
    return null;
  }
}

async function saveRaceRoom(room, source = 'run') {
  if (!await ensureRaceFirebase()) return false;
  if (!room) return false;

  try {
    const payload = raceRoomToFirebase(room);
    payload._source = source;
    await __gjRaceRoomRef.set(payload);
    return true;
  } catch (err) {
    console.error('[goodjunk.safe] saveRaceRoom failed:', err);
    return false;
  }
}

async function setupRunOnDisconnect() {
  if (!await ensureRaceFirebase()) return;
  if (!__gjRaceMyPlayerRef) return;

  try {
    await __gjRaceMyPlayerRef.onDisconnect().update({
      connected: false,
      lastSeenAt: Date.now(),
      dnfReason: 'disconnect'
    });
  } catch (err) {
    console.warn('[goodjunk.safe] setupRunOnDisconnect failed:', err);
  }
}

function rankRacePlayers(players) {
  return normalizeRacePlayers(players)
    .sort((a, b) => {
      if (!!a.dnf !== !!b.dnf) return a.dnf ? 1 : -1;
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.streak !== a.streak) return b.streak - a.streak;
      return a.finishedAt - b.finishedAt;
    })
    .map((p, idx) => ({ ...p, rank: idx + 1 }));
}

function getMyRaceRanked(rows) {
  return rows.find((p) => p.id === GJ_PID) || null;
}

function getDnfReasonLabel(reason) {
  const key = String(reason || '').trim().toLowerCase();
  if (key === 'left-run') return 'ออกจากหน้าเกม';
  if (key === 'disconnect') return 'การเชื่อมต่อหลุด';
  if (key === 'timeout') return 'หมดเวลา / ไม่ตอบสนอง';
  if (key) return key;
  return 'ไม่ทราบสาเหตุ';
}

function getRaceCounts(rows) {
  const total = rows.length;
  const finishedNormal = rows.filter((p) => p.finished && !p.dnf).length;
  const dnfCount = rows.filter((p) => p.dnf).length;
  const waitingCount = rows.filter((p) => !p.finished).length;
  return { total, finishedNormal, dnfCount, waitingCount };
}

function buildRaceSummaryPayload(rows, opts = {}) {
  const mine = getMyRaceRanked(rows) || {};
  const counts = getRaceCounts(rows);
  const allFinished = !!opts.allFinished || rows.every((p) => p.finished);
  const raceStatusFinal = allFinished ? 'finished' : 'pending';

  return {
    version: '20260317-goodjunk-race-summary',
    source: 'goodjunk-race',
    gameId: GJ_GAME_ID,
    mode: 'race',
    pid: GJ_PID,
    name: GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    roomId: GJ_ROOM_ID,
    playerCount: counts.total,
    finishedCount: counts.finishedNormal,
    dnfCount: counts.dnfCount,
    waitingCount: counts.waitingCount,
    allFinished,
    raceStatusFinal,
    finishType: mine.dnf ? 'dnf' : 'normal',
    dnfReason: mine.dnf ? (mine.dnfReason || '') : '',
    rank: Number(mine.rank || 0) || null,
    score: Number(mine.finalScore || 0),
    miss: Number(mine.miss || 0),
    streak: Number(mine.streak || 0),
    diff: RUN_CTX.diff || 'normal',
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    seed: RUN_CTX.seed || '',
    raceStartAt: Number(GJ_START_AT || 0) || 0,
    updatedAt: Date.now(),
    leaderboard: rows.map((p) => ({
      pid: p.id,
      name: p.name || p.id,
      rank: Number(p.rank || 0) || null,
      finishType: p.dnf ? 'dnf' : (p.finished ? 'normal' : 'pending'),
      dnfReason: p.dnf ? (p.dnfReason || '') : '',
      finished: !!p.finished,
      connected: p.connected !== false,
      score: p.dnf ? null : Number(p.finalScore || 0),
      miss: p.dnf ? null : Number(p.miss || 0),
      streak: p.dnf ? null : Number(p.streak || 0)
    }))
  };
}

function getRaceSummarySignature(summary) {
  return JSON.stringify({
    roomId: summary.roomId,
    pid: summary.pid,
    rank: summary.rank,
    finishType: summary.finishType,
    dnfReason: summary.dnfReason,
    score: summary.score,
    miss: summary.miss,
    streak: summary.streak,
    playerCount: summary.playerCount,
    finishedCount: summary.finishedCount,
    dnfCount: summary.dnfCount,
    waitingCount: summary.waitingCount,
    allFinished: summary.allFinished,
    raceStatusFinal: summary.raceStatusFinal
  });
}

function buildCompatLastSummary(summary) {
  return {
    source: 'goodjunk-race',
    gameId: GJ_GAME_ID,
    title: 'GoodJunk Race',
    mode: 'race',
    pid: summary.pid,
    studyId: summary.studyId,
    roomId: summary.roomId,
    score: summary.score,
    miss: summary.miss,
    streak: summary.streak,
    rank: summary.rank,
    finishType: summary.finishType,
    dnfReason: summary.dnfReason,
    playerCount: summary.playerCount,
    allFinished: summary.allFinished,
    raceStatusFinal: summary.raceStatusFinal,
    updatedAt: summary.updatedAt
  };
}

function persistRaceSummary(summary) {
  __gjRaceLastSummary = summary;

  try { localStorage.setItem(GJ_RACE_LAST_SUMMARY_KEY, JSON.stringify(summary)); } catch {}
  try {
    const raw = localStorage.getItem(GJ_RACE_SUMMARY_HISTORY_KEY);
    const hist = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(hist) ? hist : [];
    next.unshift(summary);
    localStorage.setItem(GJ_RACE_SUMMARY_HISTORY_KEY, JSON.stringify(next.slice(0, 30)));
  } catch {}
  try { localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(buildCompatLastSummary(summary))); } catch {}

  try {
    window.dispatchEvent(new CustomEvent('gj:race-summary', { detail: summary }));
    window.dispatchEvent(new CustomEvent('hha:race-summary', { detail: summary }));
  } catch {}
}

function storeRaceSummaryFromRows(rows, opts = {}) {
  const summary = buildRaceSummaryPayload(rows, opts);
  const sig = getRaceSummarySignature(summary);

  __gjRaceLastSummary = summary;
  if (sig !== __gjRaceLastSummarySig) {
    __gjRaceLastSummarySig = sig;
    persistRaceSummary(summary);
  }
  return summary;
}

function downloadRaceSummaryJson(summary = __gjRaceLastSummary) {
  if (!summary) return;
  downloadJson(summary, `goodjunk-race-${safeFilePart(summary.roomId || 'room')}-${safeFilePart(summary.pid || 'player')}-${safeFilePart(summary.raceStatusFinal || 'pending')}.json`);
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

function showRaceResultOverlay(rows, opts = {}) {
  const wrap = document.getElementById('raceResult');
  const rowsBox = document.getElementById('raceResultRows');
  const badge = document.getElementById('raceResultBadge');
  const sub = document.getElementById('raceResultSub');
  const hint = document.getElementById('raceResultHint');

  if (!wrap || !rowsBox) return;

  const pending = !!opts.pending;
  const summary = storeRaceSummaryFromRows(rows, { allFinished: !pending });
  const mine = getMyRaceRanked(rows);
  const doneCount = summary.finishedCount;
  const dnfCount = summary.dnfCount;
  const waitingCount = summary.waitingCount;

  rowsBox.innerHTML = rows.map((p) => {
    const isMe = p.id === GJ_PID;

    let stateLine = '';
    if (p.dnf) {
      stateLine = `<div style="margin-top:4px;font-size:12px;color:#fda4af;font-weight:800;">DNF • ${escapeHtml(getDnfReasonLabel(p.dnfReason))}</div>`;
    } else if (!p.finished) {
      stateLine = `<div style="margin-top:4px;font-size:12px;color:#fbbf24;font-weight:800;">ยังไม่จบ</div>`;
    } else {
      stateLine = `<div style="margin-top:4px;font-size:12px;color:#86efac;font-weight:800;">แข่งจบแล้ว</div>`;
    }

    return `
      <div class="result-row ${isMe ? 'is-me' : ''}">
        <div style="font-weight:900;">#${p.rank}</div>
        <div>
          <div style="font-weight:800;">
            ${escapeHtml(p.name || p.id || 'player')}
            ${isMe ? '<span style="color:#7dd3fc;"> • คุณ</span>' : ''}
          </div>
          ${stateLine}
        </div>
        <div>${p.dnf ? '—' : p.finalScore}</div>
        <div>${p.dnf ? '—' : p.miss}</div>
        <div>${p.dnf ? '—' : p.streak}</div>
      </div>
    `;
  }).join('');

  if (badge) {
    if (mine) {
      badge.textContent = mine.dnf ? `DNF • ${getDnfReasonLabel(mine.dnfReason)}` : `อันดับ #${mine.rank}`;
      badge.style.color = mine.rank === 1 && !mine.dnf ? '#fde68a' : '#86efac';
      badge.style.borderColor = mine.rank === 1 && !mine.dnf ? 'rgba(250,204,21,.28)' : 'rgba(34,197,94,.25)';
      badge.style.background = mine.rank === 1 && !mine.dnf ? 'rgba(250,204,21,.10)' : 'rgba(34,197,94,.12)';
    } else {
      badge.textContent = '-';
    }
  }

  if (sub) {
    sub.textContent = pending
      ? `ผลชั่วคราว • จบแล้ว ${doneCount} • DNF ${dnfCount} • รออีก ${waitingCount}`
      : `ผลสุดท้าย • จบแล้ว ${doneCount} • DNF ${dnfCount} • ผู้เล่นทั้งหมด ${summary.playerCount} คน`;
  }

  if (hint) {
    hint.textContent = pending
      ? 'ระบบบันทึก race summary แบบ pending ไว้แล้ว และจะอัปเดตเป็น final เมื่อทุกคนจบหรือถูกตัดสิทธิ์'
      : 'Race summary final ถูกบันทึกแยกจาก solo แล้ว พร้อม export JSON';
  }

  wrap.hidden = false;
  state.pendingResultVisible = pending;
  bindRaceResultButtons();
}

function buildRaceLobbyUrl() {
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
    mode: 'race',
    roomId: GJ_ROOM_ID
  });
  return `../goodjunk-race-lobby.html?${q.toString()}`;
}

async function resetRaceRoomForRematch() {
  const room = await loadRaceRoom();
  if (!room) return;

  room.status = 'waiting';
  room.startAt = null;
  room.updatedAt = Date.now();

  room.players = normalizeRacePlayers(room.players).map((p) => ({
    ...p,
    ready: false,
    connected: true,
    phase: 'lobby',
    finished: false,
    dnf: false,
    dnfReason: '',
    finalScore: 0,
    miss: 0,
    streak: 0,
    finishedAt: 0,
    lastSeenAt: Date.now()
  }));

  const hasCurrentHost = room.players.some((p) => p.id === room.hostId);
  if (!hasCurrentHost) room.hostId = room.players[0]?.id || '';

  await saveRaceRoom(room, 'rematch-reset');
}

function bindRaceResultButtons() {
  if (__gjRaceResultBound) return;
  __gjRaceResultBound = true;

  const btnRematch = document.getElementById('btnRaceRematch');
  const btnLobby = document.getElementById('btnRaceBackLobby');
  const btnExport = document.getElementById('btnRaceExport');
  const btnHub = document.getElementById('btnRaceBackHub');

  btnRematch?.addEventListener('click', async () => {
    const room = await loadRaceRoom();
    if (!room || !Array.isArray(room.players) || !room.players.length) {
      location.href = GJ_HUB;
      return;
    }
    await forceFinalizeRaceRoom();
    await resetRaceRoomForRematch();
    location.href = buildRaceLobbyUrl();
  });

  btnLobby?.addEventListener('click', async () => {
    await forceFinalizeRaceRoom();
    location.href = buildRaceLobbyUrl();
  });

  btnExport?.addEventListener('click', () => {
    downloadRaceSummaryJson(__gjRaceLastSummary);
  });

  btnHub?.addEventListener('click', async () => {
    await forceFinalizeRaceRoom();
    location.href = GJ_HUB;
  });
}

async function markRacePresenceDuringRun(patch = {}) {
  if (!isRaceMode()) return;
  if (!await ensureRaceFirebase()) return;

  try {
    const snap = await __gjRaceMyPlayerRef.once('value');
    const cur = snap.exists() ? snap.val() : {};

    await __gjRaceMyPlayerRef.update({
      name: GJ_NAME || cur.name || GJ_PID,
      ready: patch.ready ?? cur.ready ?? true,
      connected: patch.connected ?? true,
      phase: patch.phase || cur.phase || 'run',
      finished: patch.finished ?? cur.finished ?? false,
      dnf: patch.dnf ?? cur.dnf ?? false,
      dnfReason: patch.dnfReason ?? cur.dnfReason ?? '',
      finalScore: patch.finalScore ?? cur.finalScore ?? 0,
      miss: patch.miss ?? cur.miss ?? 0,
      streak: patch.streak ?? cur.streak ?? 0,
      joinedAt: cur.joinedAt || Date.now(),
      finishedAt: patch.finishedAt ?? cur.finishedAt ?? 0,
      lastSeenAt: Date.now()
    });

    await __gjRaceRoomRef.child('updatedAt').set(Date.now());
  } catch (err) {
    console.error('[goodjunk.safe] markRacePresenceDuringRun failed:', err);
  }
}

function stopRaceHeartbeat() {
  if (__gjRaceHeartbeatTimer) {
    clearInterval(__gjRaceHeartbeatTimer);
    __gjRaceHeartbeatTimer = 0;
  }
}

function stopRaceWatchdog() {
  if (__gjRaceWatchdogTimer) {
    clearInterval(__gjRaceWatchdogTimer);
    __gjRaceWatchdogTimer = 0;
  }
}

function startRaceHeartbeat() {
  if (!isRaceMode() || __gjRaceHeartbeatTimer) return;

  markRacePresenceDuringRun({
    phase: 'run',
    ready: true,
    connected: true,
    finished: false,
    dnf: false,
    dnfReason: ''
  });

  __gjRaceHeartbeatTimer = setInterval(() => {
    markRacePresenceDuringRun({
      phase: 'run',
      ready: true,
      connected: true,
      finished: false,
      dnf: false,
      dnfReason: ''
    });
  }, GJ_RACE_HEARTBEAT_MS);
}

async function markMyRaceDisconnected(reason = 'disconnect') {
  if (!isRaceMode()) return;
  if (!await ensureRaceFirebase()) return;

  try {
    const snap = await __gjRaceMyPlayerRef.once('value');
    if (!snap.exists()) return;

    const cur = snap.val();
    if (cur.finished) return;

    await __gjRaceMyPlayerRef.update({
      connected: false,
      phase: 'run',
      dnf: false,
      dnfReason: reason,
      lastSeenAt: Date.now()
    });

    await __gjRaceRoomRef.child('updatedAt').set(Date.now());
  } catch (err) {
    console.error('[goodjunk.safe] markMyRaceDisconnected failed:', err);
  }
}

async function maybeFinalizeRaceRoom(force = false) {
  if (!isRaceMode()) return;
  const room = await loadRaceRoom();
  if (!room || !Array.isArray(room.players) || !room.players.length) return;

  let changed = false;
  const ts = Date.now();

  const players = normalizeRacePlayers(room.players).map((p) => {
    if (p.finished) return p;

    const stale = !p.lastSeenAt || (ts - p.lastSeenAt > GJ_RACE_STALE_MS);
    if (!force && !stale) return p;

    changed = true;

    let reason = p.dnfReason || '';
    if (!reason) {
      if (force) reason = 'timeout';
      else if (p.connected === false) reason = 'disconnect';
      else reason = 'timeout';
    }

    return {
      ...p,
      connected: false,
      phase: 'done',
      finished: true,
      dnf: true,
      dnfReason: reason,
      finalScore: 0,
      miss: 9999,
      streak: 0,
      finishedAt: ts,
      lastSeenAt: ts
    };
  });

  const allFinished = players.every((p) => p.finished);
  const nextStatus = allFinished ? 'finished' : (room.status === 'waiting' ? 'waiting' : 'running');

  if (
    changed ||
    room.status !== nextStatus ||
    JSON.stringify(room.players) !== JSON.stringify(players)
  ) {
    room.players = players;
    room.status = nextStatus;
    room.updatedAt = ts;
    await saveRaceRoom(room, 'watchdog');
  }

  if (allFinished) {
    const ranked = rankRacePlayers(players);
    const me = getMyRaceRanked(ranked);

    if (me) showRaceResultOverlay(ranked, { pending: false });

    stopRaceHeartbeat();
    stopRaceWatchdog();
  }
}

async function forceFinalizeRaceRoom() {
  await maybeFinalizeRaceRoom(true);
}

function startRaceWatchdog() {
  if (!isRaceMode() || __gjRaceWatchdogTimer) return;

  maybeFinalizeRaceRoom(false);

  __gjRaceWatchdogTimer = setInterval(() => {
    maybeFinalizeRaceRoom(false);
  }, GJ_RACE_WATCHDOG_MS);
}

async function publishRaceFinish(result = {}) {
  if (!isRaceMode()) return;
  if (__gjRaceFinished) return;
  if (!await ensureRaceFirebase()) return;

  __gjRaceFinished = true;
  stopRaceHeartbeat();

  try {
    const room = await loadRaceRoom();
    if (!room || !Array.isArray(room.players)) return;

    room.updatedAt = Date.now();
    room.players = normalizeRacePlayers(room.players).map((p) => {
      if (p.id !== GJ_PID) return p;

      return {
        ...p,
        name: GJ_NAME || p.name || p.id,
        ready: true,
        connected: true,
        phase: 'done',
        finished: true,
        dnf: false,
        dnfReason: '',
        finalScore: Number(result.score || 0),
        miss: Number(result.miss || 0),
        streak: Number(result.streak || result.bestStreak || 0),
        finishedAt: Date.now(),
        lastSeenAt: Date.now()
      };
    });

    const allFinished = room.players.length > 0 && room.players.every((p) => p.finished);
    room.status = allFinished ? 'finished' : 'running';

    await saveRaceRoom(room, 'finish');

    const ranked = rankRacePlayers(room.players);
    showRaceResultOverlay(ranked, { pending: !allFinished });

    await maybeFinalizeRaceRoom(false);
  } catch (err) {
    console.error('[goodjunk.safe] publishRaceFinish failed:', err);
  }
}

async function openRaceResultFromRoom() {
  if (!isRaceMode()) return;
  const room = await loadRaceRoom();
  if (!room || !Array.isArray(room.players)) return;

  const ranked = rankRacePlayers(room.players);
  const allFinished = ranked.length > 0 && ranked.every((p) => p.finished);
  const me = getMyRaceRanked(ranked);

  if (me?.finished || me?.dnf) {
    showRaceResultOverlay(ranked, { pending: !allFinished });
  }
}

function attachRaceRoomListener() {
  if (!isRaceMode() || __gjRaceRoomListenerBound) return;
  __gjRaceRoomListenerBound = true;

  ensureRaceFirebase().then((ok) => {
    if (!ok || !__gjRaceRoomRef) return;

    __gjRaceRoomRef.on('value', async (snap) => {
      const room = sanitizeRaceRoom(snapshotToRaceRoom(snap.val()));
      if (!room || !Array.isArray(room.players)) return;

      const ranked = rankRacePlayers(room.players);
      const me = getMyRaceRanked(ranked);
      if (!me) return;

      const allFinished = ranked.length > 0 && ranked.every((p) => p.finished);
      if (me.finished || me.dnf) {
        showRaceResultOverlay(ranked, { pending: !allFinished });
      }

      if (!allFinished) {
        await maybeFinalizeRaceRoom(false);
      }
    });
  });
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
    diff: RUN_CTX.diff || 'normal',
    time: RUN_CTX.time || '120',
    seed: String(Date.now()),
    hub: GJ_HUB,
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    gameId: GJ_GAME_ID,
    mode: state.mode
  });

  if (isRaceMode()) {
    q.set('roomId', GJ_ROOM_ID);
    q.set('startAt', String(GJ_START_AT));
  }

  return `./goodjunk-vr.html?${q.toString()}`;
}
