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

const RUN_CTX = window.__GJ_COOP_CTX__ || {
  pid: __normalizePid(__qs.get('pid') || ''),
  name: __qs.get('name') || '',
  studyId: __qs.get('studyId') || '',
  roomId: __normalizeRoomId(__qs.get('roomId') || ''),
  mode: 'coop',
  diff: __qs.get('diff') || 'normal',
  time: __qs.get('time') || '80',
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
const COOP_UI = window.__gjCoopUi || null;

const STYLE_ID = 'goodjunk-safe-coop-style-20260318';
const ROOT_ID = 'gjCoopRoot';
const HEARTBEAT_MS = 2500;
const STALE_MS = 45000;

let fbReady = false;
let db = null;
let roomRef = null;
let myPlayerRef = null;
let roomListenerBound = false;
let raceGateRAF = 0;
let heartbeatTimer = 0;
let watchdogTimer = 0;
let booted = false;
let localRunActive = false;
let summaryBound = false;
let recoveredStartAt = 0;
let recoveredGoal = 0;
let lastSummary = null;
let enteredFinish = false;

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
  running: false,
  ended: false,
  startTs: 0,
  lastFrameTs: 0,
  lastSpawnAccum: 0,
  frameRaf: 0,
  targetSeq: 0,
  targets: new Map(),
  rect: { width: 0, height: 0 },
  teamGoal: 0,
  teamScore: 0,
  teamMiss: 0,
  teamFinished: false
};

const ui = {
  root: null,
  stage: null,
  layer: null,
  myScore: null,
  timer: null,
  teamScore: null,
  teamGoal: null,
  teamMiss: null,
  hint: null,
  progress: null,
  stats: null,
  centerTip: null
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
      showGate('เปิดห้องร่วมมือไม่สำเร็จ', '...', 'ตรวจสอบ room แล้วลองใหม่');
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
    .gj-topbar{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;padding:60px 14px 12px;padding-top:calc(60px + env(safe-area-inset-top,0px));pointer-events:none}
    .gj-chip-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;pointer-events:none}
    .gj-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.66);color:#e5e7eb;font-weight:900;font-size:13px;backdrop-filter:blur(8px);box-shadow:0 10px 24px rgba(0,0,0,.18)}
    .gj-chip span{color:#94a3b8;font-weight:800}
    .gj-stage-wrap{position:relative;min-height:0;padding:8px 10px 10px}
    .gj-stage{position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;border:1px solid rgba(148,163,184,.18);border-radius:26px;background:radial-gradient(circle at 50% 0%, rgba(167,139,250,.10), transparent 30%),linear-gradient(180deg, rgba(15,23,42,.72), rgba(2,6,23,.78));box-shadow:0 24px 64px rgba(0,0,0,.22)}
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
    .gj-progress-bar{width:100%;height:100%;background:linear-gradient(90deg, rgba(167,139,250,.85), rgba(34,197,94,.85));transform-origin:left center;transition:transform .12s linear}
    .gj-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:13px;color:#cbd5e1;line-height:1.5}
    .gj-legend strong{color:#e5e7eb}
  `;
  document.head.appendChild(style);
}

function buildShell() {
  GAME_MOUNT.innerHTML = `
    <div id="${ROOT_ID}">
      <div class="gj-shell">
        <header class="gj-topbar">
          <div class="gj-chip-row">
            <div class="gj-chip"><span>My Score</span><strong id="gjMyScore">0</strong></div>
            <div class="gj-chip"><span>Team Score</span><strong id="gjTeamScore">0</strong></div>
            <div class="gj-chip"><span>Goal</span><strong id="gjTeamGoal">0</strong></div>
            <div class="gj-chip"><span>Time</span><strong id="gjTimer">0</strong></div>
            <div class="gj-chip"><span>Team Miss</span><strong id="gjTeamMiss">0</strong></div>
          </div>
        </header>

        <div class="gj-stage-wrap">
          <div class="gj-stage" id="gjStage">
            <div class="gj-center-tip" id="gjCenterTip">ช่วยกันเก็บของดีให้ถึง goal ทีม และอย่าแตะ junk</div>
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
                <div>Tip: ช่วยกันเก็บของดีให้ถึงคะแนนเป้าหมาย</div>
              </div>
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
  ui.myScore = document.getElementById('gjMyScore');
  ui.teamScore = document.getElementById('gjTeamScore');
  ui.teamGoal = document.getElementById('gjTeamGoal');
  ui.timer = document.getElementById('gjTimer');
  ui.teamMiss = document.getElementById('gjTeamMiss');
  ui.hint = document.getElementById('gjHintText');
  ui.progress = document.getElementById('gjProgressBar');
  ui.stats = document.getElementById('gjStatsText');
  ui.centerTip = document.getElementById('gjCenterTip');

  refreshStageRect();
  renderHud();
}

function bindShell() {
  if (summaryBound) return;
  summaryBound = true;

  document.getElementById('btnCoopRematch')?.addEventListener('click', async () => {
    await resetRoomForRematch();
    location.href = buildLobbyUrl();
  });

  document.getElementById('btnCoopBackLobby')?.addEventListener('click', () => {
    location.href = buildLobbyUrl();
  });

  document.getElementById('btnCoopExport')?.addEventListener('click', () => {
    downloadJson(lastSummary, `goodjunk-coop-${safeFilePart(GJ_ROOM_ID)}-${Date.now()}.json`);
  });

  document.getElementById('btnCoopBackHub')?.addEventListener('click', () => {
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

function startGame() {
  if (state.running || state.ended) return;

  state.totalMs = clampInt(Number(RUN_CTX.time || 80) * 1000, 30000, 600000);
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
  state.startTs = performance.now();
  state.lastFrameTs = state.startTs;
  state.lastSpawnAccum = 0;
  state.targetSeq = 0;
  state.targets.clear();
  localRunActive = true;
  enteredFinish = false;

  if (ui.layer) ui.layer.innerHTML = '';
  if (ui.centerTip) {
    ui.centerTip.classList.remove('hide');
    ui.centerTip.textContent = 'ช่วยกันเก็บของดีให้ถึง goal ทีม';
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
    updateHint('ดีมาก! ทีมกำลังไปได้สวย');
  } else {
    state.hitsBad += 1;
    state.miss += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - 8);
    createFx(target.x + target.size / 2, target.y + target.size / 2, 'MISS', '#fda4af');
    updateHint('ระวัง junk! ช่วยกันรักษาคะแนนทีม');
  }

  removeTarget(id);
  renderHud();
  publishProgress();
}

function registerMissGood(target) {
  state.missedGood += 1;
  state.miss += 1;
  state.streak = 0;
  createFx(target.x + target.size / 2, Math.max(28, target.y), 'พลาดของดี', '#fbbf24');
  updateHint('มีของดีหลุดไปแล้ว รีบช่วยกันเก็บชิ้นต่อไป');
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

function updateHint(message) {
  if (!ui.hint) return;
  ui.hint.innerHTML = `<div>${escapeHtml(message)}</div>`;
}

function renderHud() {
  if (ui.myScore) ui.myScore.textContent = String(state.score);
  if (ui.teamScore) ui.teamScore.textContent = String(state.teamScore);
  if (ui.teamGoal) ui.teamGoal.textContent = String(state.teamGoal);
  if (ui.timer) ui.timer.textContent = formatSeconds(state.timeLeftMs);
  if (ui.teamMiss) ui.teamMiss.textContent = String(state.teamMiss);

  if (ui.progress) {
    const ratio = state.teamGoal > 0 ? Math.max(0, Math.min(1, state.teamScore / state.teamGoal)) : 0;
    ui.progress.style.transform = `scaleX(${ratio})`;
  }

  if (ui.stats) {
    ui.stats.innerHTML = `
      <div><strong>My Good hit:</strong> ${state.hitsGood}</div>
      <div><strong>My Junk hit:</strong> ${state.hitsBad}</div>
      <div><strong>My Good missed:</strong> ${state.missedGood}</div>
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
  localRunActive = false;
  cancelAnimationFrame(state.frameRaf);
  state.frameRaf = 0;

  state.targets.forEach((t) => t.el.remove());
  state.targets.clear();

  publishFinish(reason);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function showGate(msg = 'กำลังรอเริ่ม', count = '-', sub = '') {
  if (COOP_UI?.showGate) {
    COOP_UI.showGate(msg, count, sub);
  }
}

function hideGate() {
  if (COOP_UI?.hideGate) {
    COOP_UI.hideGate();
  }
}

function cancelGateLoop() {
  if (raceGateRAF) cancelAnimationFrame(raceGateRAF);
  raceGateRAF = 0;
}

function waitUntilStart(startAt) {
  return new Promise((resolve) => {
    const tick = () => {
      const left = startAt - Date.now();

      if (left <= 0) {
        showGate('เริ่มเกมร่วมกัน', 'GO!', 'กำลังเข้าสู่เกม...');
        window.setTimeout(resolve, 220);
        return;
      }

      showGate(
        'กำลังนับถอยหลังก่อนเริ่มพร้อมกัน',
        String(Math.ceil(left / 1000)),
        `Room: ${GJ_ROOM_ID || '-'}`
      );

      raceGateRAF = requestAnimationFrame(tick);
    };

    tick();
  });
}

function getEffectiveStartAt() {
  return Number(GJ_START_AT || recoveredStartAt || 0) || 0;
}

function getEffectiveGoal() {
  return Number(recoveredGoal || 0) || 0;
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

function sanitizeRoom(room) {
  if (!room) return null;

  const rawMatch = room.match && typeof room.match === 'object' ? room.match : {};
  const rawCoop = rawMatch.coop && typeof rawMatch.coop === 'object' ? rawMatch.coop : {};

  return {
    roomId: __normalizeRoomId(room.roomId || GJ_ROOM_ID || ''),
    hostId: __normalizePid(room.hostId || ''),
    mode: String(room.mode || 'coop'),
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
      coop: {
        goal: Number(rawCoop.goal || 0),
        success: !!rawCoop.success,
        finishedAt: Number(rawCoop.finishedAt || 0)
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
      coop: {
        goal: Number(room.match?.coop?.goal || 0),
        success: !!room.match?.coop?.success,
        finishedAt: Number(room.match?.coop?.finishedAt || 0)
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

function getCoopPlayers(room) {
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

function computeTeam(players) {
  return players.reduce((acc, p) => {
    acc.score += Number(p.finalScore || 0);
    acc.miss += Number(p.miss || 0);
    return acc;
  }, { score: 0, miss: 0 });
}

async function loadRoom() {
  if (!await ensureFirebase()) return null;
  try {
    const snap = await roomRef.once('value');
    return sanitizeRoom(snapshotToRoom(snap.val()));
  } catch (err) {
    console.error('[goodjunk.safe.coop] loadRoom failed:', err);
    return null;
  }
}

async function saveRoom(room) {
  if (!await ensureFirebase()) return false;
  try {
    await roomRef.set(roomToFirebase(room));
    return true;
  } catch (err) {
    console.error('[goodjunk.safe.coop] saveRoom failed:', err);
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
    console.error('[goodjunk.safe.coop] markPresence failed:', err);
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

async function maybeFinalizeRoom(force = false) {
  const room = await loadRoom();
  if (!room) return;

  const players = normalizePlayers(room.players);
  const participantIds = getParticipantIds(room);
  const set = new Set(participantIds);
  const coopPlayers = set.size ? players.filter((p) => set.has(p.id)) : players;

  if (!coopPlayers.length) return;

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

  const nextCoopPlayers = set.size ? nextPlayers.filter((p) => set.has(p.id)) : nextPlayers;
  const team = computeTeam(nextCoopPlayers);
  const goal = Number(room.match?.coop?.goal || recoveredGoal || 0);
  const allFinished = nextCoopPlayers.every((p) => p.finished);
  const success = goal > 0 ? team.score >= goal : false;

  if (success || allFinished) {
    room.status = 'finished';
    room.match = {
      ...(room.match || {}),
      status: 'finished',
      coop: {
        ...(room.match?.coop || {}),
        goal,
        success,
        finishedAt: ts
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
    showSummary(room, nextCoopPlayers);
    stopHeartbeat();
    stopWatchdog();
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

  const room = await loadRoom();
  if (!room) return;
  if (!amIParticipant(room)) return;

  const players = getCoopPlayers(room);
  const team = computeTeam(players);
  const goal = Number(room.match?.coop?.goal || recoveredGoal || 0);

  state.teamScore = team.score;
  state.teamMiss = team.miss;
  state.teamGoal = goal;
  renderHud();

  if (goal > 0 && team.score >= goal && !enteredFinish) {
    enteredFinish = true;
    room.status = 'finished';
    room.match = {
      ...(room.match || {}),
      status: 'finished',
      coop: {
        ...(room.match?.coop || {}),
        goal,
        success: true,
        finishedAt: Date.now()
      }
    };
    room.updatedAt = Date.now();
    await saveRoom(room);
    showSummary(room, players);
    stopHeartbeat();
    stopWatchdog();
    state.running = false;
    state.ended = true;
  }
}

async function publishFinish(reason = 'finished') {
  if (enteredFinish) return;
  enteredFinish = true;

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

  const players = getCoopPlayers(room);
  const team = computeTeam(players);
  const goal = Number(room.match?.coop?.goal || recoveredGoal || 0);
  const allFinished = players.every((p) => p.finished);
  const success = goal > 0 ? team.score >= goal : false;

  if (success || allFinished) {
    room.status = 'finished';
    room.match = {
      ...(room.match || {}),
      status: 'finished',
      coop: {
        ...(room.match?.coop || {}),
        goal,
        success,
        finishedAt: Date.now()
      }
    };
    room.updatedAt = Date.now();
    await saveRoom(room);
    showSummary(room, getCoopPlayers(room));
    stopHeartbeat();
    stopWatchdog();
    return;
  }

  showSummary(room, getCoopPlayers(room), true, reason);
}

function showSummary(room, players, pending = false, reason = '') {
  const wrap = document.getElementById('coopSummary');
  const rowsBox = document.getElementById('coopSummaryRows');
  const badge = document.getElementById('coopSummaryBadge');
  const sub = document.getElementById('coopSummarySub');
  const hint = document.getElementById('coopSummaryHint');

  if (!wrap || !rowsBox) return;
  if (!amIParticipant(room)) return;

  const goal = Number(room?.match?.coop?.goal || recoveredGoal || 0);
  const success = !!room?.match?.coop?.success;
  const team = computeTeam(players);

  state.teamScore = team.score;
  state.teamMiss = team.miss;
  state.teamGoal = goal;
  renderHud();

  rowsBox.innerHTML = players.map((p) => {
    const isMe = p.id === GJ_PID;
    return `
      <div class="result-row ${isMe ? 'is-me' : ''}">
        <div>
          <div style="font-weight:800;">${escapeHtml(p.name || p.id)}${isMe ? '<span style="color:#c4b5fd;"> • คุณ</span>' : ''}</div>
          <div style="margin-top:4px;font-size:12px;color:${p.finished ? '#86efac' : '#fbbf24'};font-weight:800;">${p.finished ? 'รอบนี้จบแล้ว' : 'ยังไม่จบ'}</div>
        </div>
        <div>${Number(p.finalScore || 0)}</div>
        <div>${Number(p.miss || 0)}</div>
        <div>${Number(p.streak || 0)}</div>
      </div>
    `;
  }).join('');

  if (badge) {
    badge.textContent = success ? 'TEAM CLEAR' : (pending ? 'PENDING' : 'NOT YET');
    badge.style.color = success ? '#86efac' : '#fcd34d';
    badge.style.borderColor = success ? 'rgba(34,197,94,.25)' : 'rgba(245,158,11,.28)';
    badge.style.background = success ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.10)';
  }

  if (sub) {
    sub.textContent = pending
      ? `ผลชั่วคราว • Team Score ${team.score}/${goal} • รอเพื่อนร่วมทีม`
      : `ผลทีม • Team Score ${team.score}/${goal} • ${success ? 'ทีมทำเป้าสำเร็จ' : 'ทีมยังไม่ถึงเป้า'}`;
  }

  if (hint) {
    hint.textContent = pending
      ? 'ผู้เล่นคนนี้จบรอบแล้ว แต่ยังรอ participant คนอื่นหรือรอการ finalize ของห้อง'
      : (reason ? `สาเหตุจบ: ${reason}` : 'คะแนนรวมทีมถูกคำนวณจาก participant ของรอบนี้');
  }

  lastSummary = {
    version: '20260318-coop-v1',
    source: 'goodjunk-coop',
    gameId: GJ_GAME_ID,
    mode: 'coop',
    pid: GJ_PID,
    name: GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    roomId: GJ_ROOM_ID,
    goal,
    success,
    pending,
    teamScore: team.score,
    teamMiss: team.miss,
    players: players.map((p) => ({
      pid: p.id,
      name: p.name || p.id,
      finished: !!p.finished,
      score: Number(p.finalScore || 0),
      miss: Number(p.miss || 0),
      streak: Number(p.streak || 0)
    })),
    updatedAt: Date.now()
  };

  wrap.hidden = false;
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
    coop: {
      goal: 0,
      success: false,
      finishedAt: 0
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
}

function buildLobbyUrl() {
  const q = new URLSearchParams({
    pid: GJ_PID,
    name: GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    diff: RUN_CTX.diff || 'normal',
    time: RUN_CTX.time || '80',
    seed: String(Date.now()),
    hub: GJ_HUB,
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    gameId: GJ_GAME_ID,
    mode: 'coop',
    roomId: GJ_ROOM_ID
  });
  return `./goodjunk-coop-lobby.html?${q.toString()}`;
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

    recoveredGoal = Number(room?.match?.coop?.goal || 0);
    if (COOP_UI?.setGoal) COOP_UI.setGoal(recoveredGoal);
  }

  if (!getEffectiveStartAt()) {
    const currentRoom = room || await loadRoom();
    if (currentRoom?.startAt) recoveredStartAt = Number(currentRoom.startAt || 0);
  }

  if (!getEffectiveStartAt()) {
    showGate('กำลังรอเริ่มเกมร่วมกัน', '...', 'ยังไม่มีสัญญาณเริ่มจากห้อง');
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

      recoveredStartAt = Number(room.startAt || recoveredStartAt || 0);
      recoveredGoal = Number(room?.match?.coop?.goal || recoveredGoal || 0);
      if (COOP_UI?.setGoal) COOP_UI.setGoal(recoveredGoal);

      if (!amIParticipant(room)) return;

      const players = getCoopPlayers(room);
      const team = computeTeam(players);

      state.teamScore = team.score;
      state.teamMiss = team.miss;
      state.teamGoal = recoveredGoal;
      renderHud();

      if (room.status === 'finished') {
        showSummary(room, players, false);
        stopHeartbeat();
        stopWatchdog();
        state.running = false;
        state.ended = true;
      } else {
        const me = players.find((p) => p.id === GJ_PID);
        if (!me?.finished) {
          const wrap = document.getElementById('coopSummary');
          if (wrap) wrap.hidden = true;
        }
      }

      await maybeFinalizeRoom(false);
    });
  });
}