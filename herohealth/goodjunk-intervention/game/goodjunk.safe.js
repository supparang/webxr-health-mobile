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

const RUN_CTX = window.__GJ_RUN_CTX__ || {
  pid: __normalizePid(
    __qs.get('pid') ||
    __qs.get('studentKey') ||
    ''
  ),
  name: (
    __qs.get('name') ||
    __qs.get('nickName') ||
    __qs.get('studentKey') ||
    ''
  ).trim(),
  studyId: __qs.get('studyId') || '',
  roomId: __normalizeRoomId(
    __qs.get('roomId') ||
    __qs.get('room') ||
    ''
  ),
  mode: (__qs.get('mode') || 'solo').toLowerCase(),
  role: (__qs.get('role') || (__qs.get('host') === '1' ? 'host' : 'player')).toLowerCase(),
  diff: __qs.get('diff') || 'easy',
  time: __qs.get('time') || '80',
  seed: __qs.get('seed') || String(Date.now()),
  startAt: Number(__qs.get('startAt') || 0) || 0,
  hub: __qs.get('hub') || '../../hub.html',
  view: __qs.get('view') || 'mobile',
  run: __qs.get('run') || 'play',
  gameId: __qs.get('gameId') || 'goodjunk',

  sessionId: __qs.get('sessionId') || __qs.get('session') || '',
  session: __qs.get('session') || __qs.get('sessionId') || '',
  conditionGroup: __qs.get('conditionGroup') || __qs.get('condition') || '',
  condition: __qs.get('condition') || __qs.get('conditionGroup') || '',
  classRoom: __qs.get('classRoom') || __qs.get('classroom') || '',
  classroom: __qs.get('classroom') || __qs.get('classRoom') || '',
  schoolName: __qs.get('schoolName') || __qs.get('school') || '',
  school: __qs.get('school') || __qs.get('schoolName') || '',
  studentKey: __qs.get('studentKey') || __qs.get('pid') || '',
  nickName: __qs.get('nickName') || __qs.get('name') || '',
  lang: __qs.get('lang') || 'th',
  group: __qs.get('group') || __qs.get('classRoom') || __qs.get('classroom') || __qs.get('conditionGroup') || ''
};

const GJ_PID = __normalizePid(RUN_CTX.pid || '');
const GJ_NAME = String(
  RUN_CTX.nickName ||
  RUN_CTX.name ||
  RUN_CTX.studentKey ||
  GJ_PID
).trim();
const GJ_MODE = (RUN_CTX.mode || 'solo').toLowerCase();
const GJ_ROLE = String(RUN_CTX.role || 'player').trim().toLowerCase();
const GJ_ROOM_ID = __normalizeRoomId(RUN_CTX.roomId || '');
const GJ_START_AT = Number(RUN_CTX.startAt || 0) || 0;
const GJ_HUB = RUN_CTX.hub || '../../hub.html';
const GJ_GAME_ID = RUN_CTX.gameId || 'goodjunk';
const GJ_SESSION = String(RUN_CTX.sessionId || RUN_CTX.session || '').trim();
const GJ_CONDITION = String(RUN_CTX.conditionGroup || RUN_CTX.condition || '').trim();

const GAME_MOUNT = document.getElementById('gameMount') || document.body;
const RACE_UI = window.__gjRaceUi || null;

const GOODJUNK_STYLE_ID = 'goodjunk-safe-style-20260319a';
const GOODJUNK_ROOT_ID = 'gjRoot';

const GJ_SOLO_LAST_SUMMARY_KEY = `GJ_SOLO_LAST_SUMMARY_${GJ_PID}`;
const GJ_SOLO_SUMMARY_HISTORY_KEY = `GJ_SOLO_SUMMARY_HISTORY_${GJ_PID}`;
const GJ_RACE_LAST_SUMMARY_KEY = `GJ_RACE_LAST_SUMMARY_${GJ_PID}`;
const GJ_RACE_SUMMARY_HISTORY_KEY = `GJ_RACE_SUMMARY_HISTORY_${GJ_PID}`;

const GJ_RACE_HEARTBEAT_MS = 2500;
const GJ_RACE_STALE_MS = 45000;
const GJ_RACE_DNF_GRACE_MS = 180000;
const GJ_RACE_WATCHDOG_MS = 3000;
const GJ_FIREBASE_ROOM_PATH = GJ_ROOM_ID ? `hha-battle/goodjunk/rooms/${GJ_ROOM_ID}` : '';

const GJ_MISS_GRACE_MS = 2500;
const GJI_CTX_KEY = 'GJI_CTX';
const GJI_GAME_SUMMARY_KEY = 'GJI_GAME_SUMMARY';
const GJI_GAME_EVENTS_KEY = 'GJI_GAME_EVENTS';
const GJI_GAME_BLOOM_KEY = 'GJI_GAME_BLOOM';

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
let __gjBloomData = null;

let __gjFbReady = false;
let __gjRaceDb = null;
let __gjRaceRoomRef = null;
let __gjRacePlayersRef = null;
let __gjRaceMyPlayerRef = null;
let __gjRecoveredStartAt = 0;
let __gjLocalRunActive = false;

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
  easy:   { spawnMs: 1120, goodRatio: 0.76, speedMin: 72,  speedMax: 120, targetSizeMin: 68, targetSizeMax: 94 },
  normal: { spawnMs: 900,  goodRatio: 0.68, speedMin: 92,  speedMax: 150, targetSizeMin: 64, targetSizeMax: 88 },
  hard:   { spawnMs: 720,  goodRatio: 0.60, speedMin: 112, speedMax: 190, targetSizeMin: 58, targetSizeMax: 82 }
};

const SOLO_PHASE_PRESET = {
  easy: {
    p1: { spawnMs: 980, goodRatio: 0.78, speedMin: 68, speedMax: 112, targetSizeMin: 72, targetSizeMax: 96 },
    p2: { spawnMs: 820, goodRatio: 0.68, speedMin: 84, speedMax: 132, targetSizeMin: 66, targetSizeMax: 90 }
  },
  normal: {
    p1: { spawnMs: 860, goodRatio: 0.72, speedMin: 84, speedMax: 128, targetSizeMin: 68, targetSizeMax: 92 },
    p2: { spawnMs: 700, goodRatio: 0.60, speedMin: 102, speedMax: 156, targetSizeMin: 62, targetSizeMax: 86 }
  },
  hard: {
    p1: { spawnMs: 760, goodRatio: 0.66, speedMin: 98, speedMax: 144, targetSizeMin: 64, targetSizeMax: 88 },
    p2: { spawnMs: 600, goodRatio: 0.54, speedMin: 118, speedMax: 182, targetSizeMin: 58, targetSizeMax: 80 }
  }
};

const SOLO_PHASE_GOALS = {
  easy:   { 1: 50,  2: 120 },
  normal: { 1: 65,  2: 150 },
  hard:   { 1: 80,  2: 185 }
};

const SOLO_BOSS_PRESET = {
  easy:   { hp: 9,  stormMs: 1040, weakSpeed: 118, weakMoveMs: 1380, weakSize: 92, clearBonus: 44 },
  normal: { hp: 13, stormMs: 860,  weakSpeed: 152, weakMoveMs: 1120, weakSize: 80, clearBonus: 52 },
  hard:   { hp: 17, stormMs: 680,  weakSpeed: 190, weakMoveMs: 920,  weakSize: 68, clearBonus: 60 }
};

const state = {
  mode: GJ_MODE === 'race' ? 'race' : 'solo',
  diff: DIFF_PRESET[RUN_CTX.diff] ? RUN_CTX.diff : 'easy',
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
  fruitHit: 0,
  vegHit: 0,
  drinkHit: 0,
  powerHits: 0,
  phase: 1,
  bossStuns: 0,
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
    stunMs: 0
  },
  running: false,
  ended: false,
  startTs: 0,
  lastFrameTs: 0,
  lastSpawnAccum: 0,
  frameRaf: 0,
  targetSeq: 0,
  targets: new Map(),
  rect: { width: 0, height: 0 },
  pendingResultVisible: false,
  eventLog: []
};

const ui = {
  root: null,
  stage: null,
  layer: null,
  score: null,
  timer: null,
  miss: null,
  grade: null,
  phasePill: null,
  bossPill: null,
  hint: null,
  progress: null,
  stats: null,
  centerTip: null,
  soloOverlay: null,
  soloBody: null,
  soloTitle: null,
  soloSub: null,
  soloBtnPostK: null,
  soloBtnParent: null,
  soloBtnAgain: null,
  soloBtnExport: null,
  soloBtnHub: null
};

const rng = createSeededRng(RUN_CTX.seed || Date.now());

console.log('[goodjunk.safe] LIVE BUILD = 20260407a-phaseboss');

persistInterventionCtx();
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
    if (isRaceMode()) {
      const ok = await ensureRaceFirebase();
      if (!ok) {
        showRaceGate('เปิดห้องแข่งไม่สำเร็จ', '...', 'ตรวจสอบ room / invite link แล้วลองใหม่');
        return;
      }

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
    }

    startGame();
  });

  document.addEventListener('visibilitychange', () => {
    if (!isRaceMode() || state.ended) return;
    if (document.visibilityState === 'visible') {
      markRacePresenceDuringRun({
        phase: 'run',
        ready: true,
        connected: true,
        finished: false,
        dnf: false,
        dnfReason: '',
        disconnectedAt: 0
      });
    }
  });

  window.addEventListener('focus', () => {
    if (!isRaceMode() || state.ended) return;
    markRacePresenceDuringRun({
      phase: 'run',
      ready: true,
      connected: true,
      finished: false,
      dnf: false,
      dnfReason: '',
      disconnectedAt: 0
    });
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
    .gj-topbar{display:grid;gap:10px;padding:14px 10px 10px;padding-top:calc(14px + env(safe-area-inset-top,0px));pointer-events:none}
    .gj-chip-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;pointer-events:none}
    .gj-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.66);color:#e5e7eb;font-weight:900;font-size:13px;backdrop-filter:blur(8px);box-shadow:0 10px 24px rgba(0,0,0,.18)}
    .gj-chip span{color:#94a3b8;font-weight:800}
    .gj-stage-wrap{position:relative;min-height:0;padding:6px 10px 10px}
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
    .gj-solo-card{width:min(94vw,760px);max-height:88vh;overflow:auto;background:rgba(15,23,42,.96);border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:20px 18px 18px;color:#e5e7eb;box-shadow:0 28px 64px rgba(0,0,0,.35)}
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
      .gj-solo-list{grid-template-columns:1fr}
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
            <div class="gj-chip">🍎 GoodJunk Intervention</div>
            <div class="gj-chip"><span>Study</span><strong>${escapeHtml(RUN_CTX.studyId || '-')}</strong></div>
            <div class="gj-chip"><span>Student</span><strong>${escapeHtml(GJ_NAME || GJ_PID || '-')}</strong></div>
            <div class="gj-chip"><span>Session</span><strong>${escapeHtml(GJ_SESSION || '-')}</strong></div>
          </div>
          <div class="gj-chip-row">
            <div class="gj-chip"><span>Score</span><strong id="gjScore">0</strong></div>
            <div class="gj-chip"><span>Time</span><strong id="gjTimer">0</strong></div>
            <div class="gj-chip"><span>Miss</span><strong id="gjMiss">0</strong></div>
            <div class="gj-chip"><span>Phase</span><strong id="gjPhase">P1</strong></div>
            <div class="gj-chip"><span>Boss</span><strong id="gjBoss">-</strong></div>
            <div class="gj-chip"><span>Grade</span><strong id="gjGrade">D</strong></div>
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
                <div><strong>Best streak:</strong> 0</div>
              </div>
              <div class="gj-legend" id="gjHintText">
                <div>Tip: เก็บผลไม้/ผัก • หลีกเลี่ยงของหวาน/น้ำอัดลม • Session: ${escapeHtml(GJ_SESSION || '-')} • Group: ${escapeHtml(GJ_CONDITION || '-')}</div>
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
            <button class="btn btn-blue" id="gjSoloPostK" type="button">Post-Knowledge</button>
            <button class="btn btn-violet" id="gjSoloParent" type="button">Parent Summary</button>
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
  ui.grade = document.getElementById('gjGrade');
  ui.phasePill = document.getElementById('gjPhase');
  ui.bossPill = document.getElementById('gjBoss');
  ui.hint = document.getElementById('gjHintText');
  ui.progress = document.getElementById('gjProgressBar');
  ui.stats = document.getElementById('gjStatsText');
  ui.centerTip = document.getElementById('gjCenterTip');
  ui.soloOverlay = document.getElementById('gjSoloSummary');
  ui.soloBody = document.getElementById('gjSoloBody');
  ui.soloTitle = document.getElementById('gjSoloTitle');
  ui.soloSub = document.getElementById('gjSoloSub');
  ui.soloBtnPostK = document.getElementById('gjSoloPostK');
  ui.soloBtnParent = document.getElementById('gjSoloParent');
  ui.soloBtnAgain = document.getElementById('gjSoloAgain');
  ui.soloBtnExport = document.getElementById('gjSoloExport');
  ui.soloBtnHub = document.getElementById('gjSoloHub');

  refreshStageRect();
  renderHud();
}

function bindGameplayShell() {
  if (__gjSoloSummaryBound) return;
  __gjSoloSummaryBound = true;

  ui.soloBtnPostK?.addEventListener('click', () => {
    const check = validateBloomReflection();
    if (!check.ok) {
      ui.soloSub.textContent = check.message;
      return;
    }

    persistInterventionCtx();
    persistBloomReflection('completed');
    ui.soloSub.textContent = 'บันทึก Reflection แล้ว กำลังไป Post-Knowledge';
    location.href = buildPageUrl('../assessments/post-knowledge.html');
  });

  ui.soloBtnParent?.addEventListener('click', () => {
    persistInterventionCtx();
    persistBloomReflection('draft');
    location.href = buildPageUrl('../parent/parent-summary.html');
  });

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

function isSoloPhaseBossMode() {
  return !isRaceMode();
}

function getSoloPhasePreset() {
  const table = SOLO_PHASE_PRESET[state.diff] || SOLO_PHASE_PRESET.easy;
  return state.phase === 1 ? table.p1 : table.p2;
}

function getSoloPhaseGoal(phase) {
  const table = SOLO_PHASE_GOALS[state.diff] || SOLO_PHASE_GOALS.easy;
  return table[phase] || 9999;
}

function getBossBase() {
  return SOLO_BOSS_PRESET[state.diff] || SOLO_BOSS_PRESET.easy;
}

function resetBossState() {
  const boss = getBossBase();
  state.boss.active = false;
  state.boss.maxHp = boss.hp;
  state.boss.hp = boss.hp;
  state.boss.enrage = false;
  state.boss.stormAccum = 0;
  state.boss.weakTick = 0;
  state.boss.weakspotId = '';
  state.boss.weakSpeed = boss.weakSpeed;
  state.boss.weakSize = boss.weakSize;
  state.boss.weakMoveMs = boss.weakMoveMs;
  state.boss.patternIndex = 0;
  state.boss.patternLabel = 'Target Hunt';
  state.boss.patternTimeLeft = 0;
  state.boss.nextPatternIndex = -1;
  state.boss.telegraphMs = 0;
  state.boss.stunMs = 0;
}

function clearTargets() {
  state.targets.forEach((target) => {
    try { target.el.remove(); } catch {}
  });
  state.targets.clear();
  state.boss.weakspotId = '';
}

function setCenterTip(message, ms = 1400) {
  if (!ui.centerTip) return;
  ui.centerTip.textContent = message;
  ui.centerTip.classList.remove('hide');
  if (ms > 0) {
    setTimeout(() => ui.centerTip?.classList.add('hide'), ms);
  }
}

function enterSoloPhase2() {
  state.phase = 2;
  clearTargets();
  state.lastSpawnAccum = 0;
  setCenterTip(`Phase 2 • เก็บให้ถึง ${getSoloPhaseGoal(2)} คะแนน`, 1600);
  updateHint('เข้าสู่ Phase 2 แล้ว • ของ junk จะมาไวขึ้น');
}

function enterBossPhase() {
  state.phase = 3;
  state.boss.active = true;
  clearTargets();
  state.lastSpawnAccum = 0;
  resetBossState();
  state.boss.active = true;
  applyBossPattern(0);
  setCenterTip('Boss Phase • ปราบ Junk Boss ด้วยการแตะดาว!', 1800);
  updateHint('หาเป้าดาวสีทอง แล้วแตะให้โดนเพื่อโจมตีบอส');
}

function getWeakspot() {
  return state.boss.weakspotId ? state.targets.get(state.boss.weakspotId) : null;
}

function getBossPatternName(index) {
  if (index === 1) return 'Junk Storm';
  if (index === 2) return 'Armor Break';
  return 'Target Hunt';
}

function getBossPatternSpec() {
  const base = getBossBase();

  if (state.boss.patternIndex === 1) {
    return {
      label: 'Junk Storm',
      hint: 'หลบ junk ก่อน แล้วค่อยกลับมาตีดาว',
      stormMs: Math.max(260, base.stormMs - 180),
      weakSpeed: base.weakSpeed + 24,
      weakSize: Math.max(54, base.weakSize - 8),
      weakMoveMs: Math.max(760, base.weakMoveMs - 160),
      damage: 1
    };
  }

  if (state.boss.patternIndex === 2) {
    return {
      label: 'Armor Break',
      hint: 'ดาวใหญ่ขึ้นแล้ว ตีโดนแรง x2',
      stormMs: base.stormMs + 120,
      weakSpeed: Math.max(90, base.weakSpeed - 22),
      weakSize: base.weakSize + 18,
      weakMoveMs: base.weakMoveMs + 200,
      damage: 2
    };
  }

  return {
    label: 'Target Hunt',
    hint: 'มองหาดาวที่กำลังเคลื่อนที่แล้วแตะให้แม่น',
    stormMs: base.stormMs,
    weakSpeed: base.weakSpeed,
    weakSize: base.weakSize,
    weakMoveMs: base.weakMoveMs,
    damage: 1
  };
}

function syncWeakspotStyle(target) {
  if (!target) return;
  target.size = state.boss.weakSize;
  target.el.style.width = `${target.size}px`;
  target.el.style.height = `${target.size}px`;
  target.el.style.borderColor = 'rgba(250,204,21,.62)';
  target.el.style.boxShadow = '0 0 0 6px rgba(250,204,21,.18), 0 14px 28px rgba(0,0,0,.18)';
  drawTarget(target);
}

function spawnBossWeakspot() {
  refreshStageRect();

  const size = state.boss.weakSize;
  const x = randRange(14, Math.max(16, state.rect.width - size - 14));
  const y = randRange(92, Math.max(100, state.rect.height - size - 24));
  const id = `t-${++state.targetSeq}`;

  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'gj-target weakspot';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderColor = 'rgba(250,204,21,.62)';
  el.style.boxShadow = '0 0 0 6px rgba(250,204,21,.18), 0 14px 28px rgba(0,0,0,.18)';
  el.style.background = 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.34), transparent 26%), linear-gradient(180deg, rgba(250,204,21,.42), rgba(245,158,11,.24)), rgba(15,23,42,.92)';
  el.innerHTML = `
    <div class="gj-emoji">⭐</div>
    <div class="gj-type">boss</div>
  `;

  const vxBase = randRange(-state.boss.weakSpeed, state.boss.weakSpeed);
  const vyBase = randRange(-state.boss.weakSpeed, state.boss.weakSpeed);

  const target = {
    id,
    el,
    type: 'weakspot',
    label: 'weakspot',
    x,
    y,
    size,
    speed: 0,
    drift: 0,
    vx: Math.abs(vxBase) < 70 ? (vxBase < 0 ? -70 : 70) : vxBase,
    vy: Math.abs(vyBase) < 70 ? (vyBase < 0 ? -70 : 70) : vyBase,
    dead: false
  };

  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    hitTarget(id);
  }, { passive: false });

  ui.layer?.appendChild(el);
  state.targets.set(id, target);
  state.boss.weakspotId = id;
  drawTarget(target);
}

function spawnBossJunk() {
  const boss = getBossBase();
  spawnTarget({
    spawnMs: 0,
    goodRatio: 0,
    speedMin: state.boss.enrage ? boss.weakSpeed + 80 : boss.weakSpeed + 46,
    speedMax: state.boss.enrage ? boss.weakSpeed + 130 : boss.weakSpeed + 90,
    targetSizeMin: 46,
    targetSizeMax: 66
  }, pick(JUNK_ITEMS), 'storm');
}

function moveWeakspot(target, dt) {
  target.x += (target.vx * dt) / 1000;
  target.y += (target.vy * dt) / 1000;

  const minY = 92;
  if (target.x <= 8) {
    target.x = 8;
    target.vx *= -1;
  }
  if (target.x + target.size >= state.rect.width - 8) {
    target.x = state.rect.width - target.size - 8;
    target.vx *= -1;
  }
  if (target.y <= minY) {
    target.y = minY;
    target.vy *= -1;
  }
  if (target.y + target.size >= state.rect.height - 8) {
    target.y = state.rect.height - target.size - 8;
    target.vy *= -1;
  }

  drawTarget(target);
}

function applyBossPattern(index) {
  state.boss.patternIndex = index;
  state.boss.patternLabel = getBossPatternName(index);
  state.boss.nextPatternIndex = -1;
  state.boss.telegraphMs = 0;

  const spec = getBossPatternSpec();
  state.boss.patternTimeLeft = index === 1 ? 4200 : (index === 2 ? 3400 : 4700);
  state.boss.stormAccum = 0;
  state.boss.weakTick = 0;
  state.boss.weakSpeed = spec.weakSpeed;
  state.boss.weakSize = spec.weakSize;
  state.boss.weakMoveMs = spec.weakMoveMs;

  const weak = getWeakspot();
  if (weak) syncWeakspotStyle(weak);

  updateHint(spec.hint);
}

function queueNextBossPattern() {
  state.boss.nextPatternIndex = (state.boss.patternIndex + 1) % 3;
  state.boss.telegraphMs = 800;
  setCenterTip(`เตรียมท่า ${getBossPatternName(state.boss.nextPatternIndex)}`, 760);
}

function updateBossPhase(dt) {
  const bossBase = getBossBase();

  if (state.boss.hp <= Math.ceil(state.boss.maxHp / 2) && !state.boss.enrage) {
    state.boss.enrage = true;
    setCenterTip('Boss โกรธแล้ว! ระวัง junk ให้ดี', 1200);
  }

  if (state.boss.stunMs > 0) {
    state.boss.stunMs -= dt;
    if (state.boss.stunMs < 0) state.boss.stunMs = 0;
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

  while (state.boss.stormAccum >= spec.stormMs) {
    state.boss.stormAccum -= spec.stormMs;
    spawnBossJunk();
  }

  const weak = getWeakspot();
  if (!weak) {
    spawnBossWeakspot();
  } else {
    moveWeakspot(weak, dt);
  }

  if (state.boss.weakTick >= spec.weakMoveMs) {
    state.boss.weakTick = 0;
    const current = getWeakspot();
    if (current) {
      const nextVX = randRange(-state.boss.weakSpeed, state.boss.weakSpeed);
      const nextVY = randRange(-state.boss.weakSpeed, state.boss.weakSpeed);
      current.vx = Math.abs(nextVX) < 70 ? (nextVX < 0 ? -70 : 70) : nextVX;
      current.vy = Math.abs(nextVY) < 70 ? (nextVY < 0 ? -70 : 70) : nextVY;
      syncWeakspotStyle(current);
    }
  }
}

function checkSoloPhaseProgress() {
  if (!isSoloPhaseBossMode() || state.ended || state.boss.active) return;

  if (state.phase === 1 && state.score >= getSoloPhaseGoal(1)) {
    enterSoloPhase2();
    return;
  }

  if (state.phase === 2 && state.score >= getSoloPhaseGoal(2)) {
    enterBossPhase();
  }
}

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
  state.fruitHit = 0;
  state.vegHit = 0;
  state.drinkHit = 0;
  state.powerHits = 0;
  state.phase = 1;
  state.bossStuns = 0;
  resetBossState();

  state.running = true;
  state.ended = false;
  __gjLocalRunActive = true;
  state.pendingResultVisible = false;
  state.startTs = performance.now();
  state.lastFrameTs = state.startTs;
  state.lastSpawnAccum = 0;
  state.targetSeq = 0;
  state.targets.clear();
  state.eventLog = [];

  if (ui.layer) ui.layer.innerHTML = '';

  if (isRaceMode()) {
    setCenterTip('เริ่มพร้อมกันแล้ว • เก็บอาหารดีให้ได้คะแนนสูงสุด', 1800);
  } else {
    setCenterTip(`Phase 1 • เก็บให้ถึง ${getSoloPhaseGoal(1)} คะแนน`, 1800);
    updateHint('เริ่มจากเก็บอาหารดีให้ต่อเนื่อง แล้วค่อยไป Phase 2 และ Boss');
  }

  hideRaceResultOverlay();
  persistInterventionCtx();
  logGameEvent('start', {
    studyId: RUN_CTX.studyId || '',
    sessionId: GJ_SESSION,
    conditionGroup: GJ_CONDITION,
    diff: state.diff,
    view: RUN_CTX.view || 'mobile',
    mode: state.mode
  });

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

  if (!isRaceMode()) {
    checkSoloPhaseProgress();
  }

  renderHud();
  state.frameRaf = requestAnimationFrame(loop);
}

function updateSpawner(dt) {
  if (isRaceMode()) {
    const preset = DIFF_PRESET[state.diff] || DIFF_PRESET.easy;
    state.lastSpawnAccum += dt;

    while (state.lastSpawnAccum >= preset.spawnMs) {
      state.lastSpawnAccum -= preset.spawnMs;
      spawnTarget(preset);
    }
    return;
  }

  if (state.boss.active) {
    updateBossPhase(dt);
    return;
  }

  const preset = getSoloPhasePreset();
  state.lastSpawnAccum += dt;

  while (state.lastSpawnAccum >= preset.spawnMs) {
    state.lastSpawnAccum -= preset.spawnMs;
    spawnTarget(preset);
  }
}

function spawnTarget(presetOverride = null, itemOverride = null, forcedType = '') {
  refreshStageRect();

  const preset = presetOverride || (isRaceMode() ? (DIFF_PRESET[state.diff] || DIFF_PRESET.easy) : getSoloPhasePreset());
  const isGood = forcedType ? forcedType === 'good' : rand() < preset.goodRatio;
  const type = forcedType || (isGood ? 'good' : 'junk');
  const item = itemOverride || pick(isGood ? GOOD_ITEMS : JUNK_ITEMS);

  const size = randRange(preset.targetSizeMin, preset.targetSizeMax);
  const x = randRange(10, Math.max(12, state.rect.width - size - 10));
  const y = -size - randRange(0, 50);
  const speed = randRange(preset.speedMin, preset.speedMax);
  const drift = randRange(-28, 28);
  const id = `t-${++state.targetSeq}`;

  const el = document.createElement('button');
  el.type = 'button';
  el.className = `gj-target ${type === 'good' ? 'good' : 'junk'}`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.innerHTML = `
    <div class="gj-emoji">${item.emoji}</div>
    <div class="gj-type">${type === 'storm' ? 'storm' : (type === 'good' ? 'good' : 'junk')}</div>
  `;

  const target = { id, el, type, label: item.label, x, y, size, speed, drift, dead: false };

  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    hitTarget(id);
  }, { passive: false });

  ui.layer?.appendChild(el);
  state.targets.set(id, target);

  if (type === 'good') state.spawnedGood += 1;
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
    if (target.type === 'weakspot') return;

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

  const cx = target.x + target.size / 2;
  const cy = target.y + target.size / 2;

  if (target.type === 'weakspot') {
    const spec = getBossPatternSpec();
    const damage = spec.damage || 1;

    state.powerHits += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.score += damage >= 2 ? 24 : 16;
    state.boss.hp = Math.max(0, state.boss.hp - damage);
    state.boss.stunMs = damage >= 2 ? 620 : 240;
    state.bossStuns += 1;

    createFx(cx, cy, damage >= 2 ? 'CRUSH!' : 'POWER!', '#fde68a');
    updateHint(state.boss.hp > 0 ? 'โดนแล้ว! รีบตามจังหวะต่อ' : 'ชนะ Junk Boss แล้ว!');
    logGameEvent('hit-boss', {
      damage,
      bossHp: state.boss.hp,
      score: state.score,
      combo: state.streak
    });

    removeTarget(id);
    renderHud();

    if (state.boss.hp <= 0) {
      state.score += getBossBase().clearBonus;
      state.running = false;
      cancelAnimationFrame(state.frameRaf);
      state.frameRaf = 0;
      setCenterTip('Boss Clear! 🎉', 900);
      setTimeout(() => endGame('boss-clear'), 380);
      return;
    }

    return;
  }

  if (target.type === 'good') {
    state.hitsGood += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);

    classifyGoodHit(target.label);

    const comboBonus = Math.min(12, Math.floor(state.streak / 3) * 2);
    const gain = 10 + comboBonus;
    state.score += gain;
    createFx(cx, cy, `+${gain}`, '#86efac');
    updateHint('เยี่ยมมาก! เก็บของดีต่อไป');
    logGameEvent('hit-good', {
      item: target.label,
      label: target.label,
      score: state.score,
      combo: state.streak
    });
  } else {
    state.hitsBad += 1;
    state.miss += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - (target.type === 'storm' ? 10 : 8));
    createFx(cx, cy, target.type === 'storm' ? 'STORM!' : 'MISS', '#fda4af');
    updateHint(target.type === 'storm' ? 'พายุ junk มาแล้ว! รอจังหวะตีดาว' : 'ระวัง junk! แตะของดีแทน');
    logGameEvent(target.type === 'storm' ? 'hit-storm' : 'hit-junk', {
      item: target.label,
      label: target.label,
      score: state.score,
      combo: state.streak
    });
  }

  removeTarget(id);
  renderHud();

  if (isRaceMode() && !state.ended) {
    markRacePresenceDuringRun({
      phase: 'run',
      ready: true,
      connected: true,
      finished: false,
      dnf: false,
      dnfReason: '',
      disconnectedAt: 0,
      finalScore: state.score,
      miss: state.miss,
      streak: state.bestStreak
    });
  }
}

function inMissGracePeriod() {
  if (!state.running || state.ended) return false;
  const elapsed = performance.now() - state.startTs;
  return elapsed < GJ_MISS_GRACE_MS;
}

function registerMissGood(target) {
  if (inMissGracePeriod()) {
    removeTarget(target.id);
    renderHud();
    return;
  }

  state.missedGood += 1;
  state.miss += 1;
  state.streak = 0;
  createFx(target.x + target.size / 2, Math.max(28, target.y), 'พลาดของดี', '#fbbf24');
  updateHint('มีของดีหลุดไปแล้ว รีบเก็บชิ้นต่อไป');
  logGameEvent('miss-good', {
    item: target.label,
    label: target.label,
    score: state.score,
    combo: state.streak
  });
  removeTarget(target.id);
  renderHud();

  if (isRaceMode() && !state.ended) {
    markRacePresenceDuringRun({
      phase: 'run',
      ready: true,
      connected: true,
      finished: false,
      dnf: false,
      dnfReason: '',
      disconnectedAt: 0,
      finalScore: state.score,
      miss: state.miss,
      streak: state.bestStreak
    });
  }
}

function removeTarget(id) {
  const target = state.targets.get(id);
  if (!target) return;
  target.dead = true;
  target.el.remove();
  state.targets.delete(id);
  if (target.type === 'weakspot' && state.boss.weakspotId === id) {
    state.boss.weakspotId = '';
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

function updateHint(message) {
  if (!ui.hint) return;
  ui.hint.innerHTML = `<div>${escapeHtml(message)}</div>`;
}

function renderHud() {
  if (ui.score) ui.score.textContent = String(state.score);
  if (ui.timer) ui.timer.textContent = formatSeconds(state.timeLeftMs);
  if (ui.miss) ui.miss.textContent = String(state.miss);
  if (ui.grade) ui.grade.textContent = computeGrade();

  if (ui.phasePill) {
    if (isRaceMode()) {
      ui.phasePill.textContent = 'RACE';
    } else if (state.phase === 3) {
      ui.phasePill.textContent = 'BOSS';
    } else {
      ui.phasePill.textContent = `P${state.phase}`;
    }
  }

  if (ui.bossPill) {
    if (isRaceMode()) {
      ui.bossPill.textContent = GJ_ROOM_ID || '-';
    } else if (state.phase === 1) {
      ui.bossPill.textContent = `${state.score}/${getSoloPhaseGoal(1)}`;
    } else if (state.phase === 2) {
      ui.bossPill.textContent = `${state.score}/${getSoloPhaseGoal(2)}`;
    } else {
      ui.bossPill.textContent = `${state.boss.hp}/${state.boss.maxHp}`;
    }
  }

  if (ui.progress) {
    const ratio = state.totalMs > 0 ? state.timeLeftMs / state.totalMs : 0;
    ui.progress.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
  }

  if (ui.stats) {
    ui.stats.innerHTML = `
      <div><strong>Good hit:</strong> ${state.hitsGood}</div>
      <div><strong>Junk hit:</strong> ${state.hitsBad}</div>
      <div><strong>Good missed:</strong> ${state.missedGood}</div>
      <div><strong>Best streak:</strong> ${state.bestStreak}</div>
    `;
  }
}

function formatSeconds(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function classifyGoodHit(label) {
  const v = String(label || '').toLowerCase();
  if (['apple', 'banana', 'watermelon'].includes(v)) {
    state.fruitHit += 1;
    return;
  }
  if (['carrot', 'broccoli', 'salad'].includes(v)) {
    state.vegHit += 1;
    return;
  }
  if (['milk'].includes(v)) {
    state.drinkHit += 1;
    return;
  }
}

function computeAccuracy() {
  const total = state.hitsGood + state.hitsBad + state.missedGood;
  if (!total) return 0;
  return Number((state.hitsGood / total).toFixed(4));
}

function computeGrade() {
  const accuracy = computeAccuracy();
  const bossCleared = !isRaceMode() && state.phase === 3 && state.boss.hp <= 0;

  if (bossCleared && accuracy >= 0.72 && state.miss <= 6) return 'A';
  if (state.score >= 140 && accuracy >= 0.85 && state.miss <= 3) return 'A';
  if (state.score >= 90 && accuracy >= 0.72 && state.miss <= 5) return 'B';
  if (state.score >= 45 && accuracy >= 0.58) return 'C';
  return 'D';
}

function computeStageReached() {
  if (isRaceMode()) {
    if (state.hitsGood >= 18) return 'SMART';
    if (state.hitsGood >= 10) return 'STABLE';
    return 'WARM';
  }

  if (state.phase === 3 && state.boss.hp <= 0) return 'BOSS_CLEAR';
  if (state.phase === 3) return 'BOSS';
  if (state.phase === 2) return 'PHASE2';
  return 'PHASE1';
}

function buildGameSummaryCore(reason = 'finished') {
  const elapsedSec = Math.max(0, Math.round((state.totalMs - state.timeLeftMs) / 1000));
  const totalSec = Math.max(0, Math.round(state.totalMs / 1000));
  const accuracy = computeAccuracy();
  const grade = computeGrade();
  const junkAvoided = Math.max(0, state.spawnedJunk - state.hitsBad);

  return {
    version: '20260407a-goodjunk-intervention-phaseboss',
    savedAt: new Date().toISOString(),
    gameId: GJ_GAME_ID,
    source: 'goodjunk-safe',
    reason,

    pid: GJ_PID,
    studentKey: RUN_CTX.studentKey || GJ_PID,
    nickName: RUN_CTX.nickName || GJ_NAME,
    name: GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    sessionId: GJ_SESSION,
    session: GJ_SESSION,
    conditionGroup: GJ_CONDITION,
    condition: GJ_CONDITION,
    classRoom: RUN_CTX.classRoom || RUN_CTX.classroom || '',
    classroom: RUN_CTX.classroom || RUN_CTX.classRoom || '',
    schoolName: RUN_CTX.schoolName || RUN_CTX.school || '',
    school: RUN_CTX.school || RUN_CTX.schoolName || '',

    mode: state.mode,
    diff: state.diff,
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    seed: RUN_CTX.seed || '',
    hub: GJ_HUB,

    score: Number(state.score || 0),
    goodHit: Number(state.hitsGood || 0),
    junkHit: Number(state.hitsBad || 0),
    miss: Number(state.miss || 0),
    junkAvoided: Number(junkAvoided || 0),
    comboBest: Number(state.bestStreak || 0),
    fruitHit: Number(state.fruitHit || 0),
    vegHit: Number(state.vegHit || 0),
    drinkHit: Number(state.drinkHit || 0),
    grade,
    accuracy,
    stageReached: computeStageReached(),
    phaseReached: computeStageReached(),
    bossCleared: !isRaceMode() && state.phase === 3 && state.boss.hp <= 0,
    bossHpRemaining: !isRaceMode() ? Number(state.boss.hp || 0) : null,
    bossStuns: !isRaceMode() ? Number(state.bossStuns || 0) : 0,
    powerHits: !isRaceMode() ? Number(state.powerHits || 0) : 0,
    totalSec,
    elapsedSec
  };
}

function logGameEvent(type, extra = {}) {
  const elapsedMs = Math.max(0, Math.round((state.totalMs - state.timeLeftMs)));
  state.eventLog.push({
    type,
    at: new Date().toISOString(),
    elapsedMs,
    stage: computeStageReached(),
    score: state.score,
    combo: state.streak,
    ...extra
  });

  if (state.eventLog.length > 500) {
    state.eventLog = state.eventLog.slice(-500);
  }
}

function persistInterventionCtx() {
  try {
    const prev = JSON.parse(localStorage.getItem(GJI_CTX_KEY) || '{}');
    const merged = {
      ...prev,
      pid: GJ_PID,
      studentKey: RUN_CTX.studentKey || GJ_PID,
      nickName: RUN_CTX.nickName || GJ_NAME,
      name: GJ_NAME,
      studyId: RUN_CTX.studyId || '',
      group: RUN_CTX.group || RUN_CTX.classRoom || RUN_CTX.classroom || GJ_CONDITION || '',
      condition: RUN_CTX.condition || RUN_CTX.conditionGroup || '',
      conditionGroup: RUN_CTX.conditionGroup || RUN_CTX.condition || '',
      session: RUN_CTX.session || RUN_CTX.sessionId || '',
      sessionId: RUN_CTX.sessionId || RUN_CTX.session || '',
      classroom: RUN_CTX.classroom || RUN_CTX.classRoom || '',
      classRoom: RUN_CTX.classRoom || RUN_CTX.classroom || '',
      school: RUN_CTX.school || RUN_CTX.schoolName || '',
      schoolName: RUN_CTX.schoolName || RUN_CTX.school || '',
      diff: RUN_CTX.diff || state.diff,
      view: RUN_CTX.view || 'mobile',
      mode: GJ_MODE,
      role: GJ_ROLE,
      run: RUN_CTX.run || 'play',
      roomId: GJ_ROOM_ID || '',
      startAt: getEffectiveRaceStartAt() || 0,
      time: RUN_CTX.time || '80',
      lang: RUN_CTX.lang || 'th',
      hub: GJ_HUB
    };
    localStorage.setItem(GJI_CTX_KEY, JSON.stringify(merged));
  } catch {}
}

function persistInterventionGameArtifacts(summary) {
  try {
    localStorage.setItem(GJI_GAME_SUMMARY_KEY, JSON.stringify(summary));
  } catch {}

  try {
    localStorage.setItem(GJI_GAME_EVENTS_KEY, JSON.stringify(state.eventLog));
  } catch {}

  try {
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
      source: 'goodjunk-intervention',
      gameId: GJ_GAME_ID,
      title: 'GoodJunk Intervention',
      mode: state.mode,
      pid: summary.pid,
      studyId: summary.studyId,
      roomId: GJ_ROOM_ID || '',
      score: summary.score,
      miss: summary.miss,
      streak: summary.comboBest,
      rank: null,
      finishType: 'normal',
      dnfReason: '',
      playerCount: state.mode === 'race' ? null : 1,
      allFinished: state.mode === 'race' ? null : true,
      raceStatusFinal: state.mode === 'race' ? 'pending' : 'solo',
      updatedAt: Date.now()
    }));
  } catch {}
}

function getBloomStorageKey() {
  return `${GJI_GAME_BLOOM_KEY}:${GJ_PID}:${GJ_SESSION || 'default'}`;
}

function getDefaultBloomReflection() {
  return {
    evaluateChoice: '',
    evaluateReason: '',
    createFruit: '',
    createVeg: '',
    createDrink: '',
    savedAt: '',
    pid: GJ_PID,
    sessionId: GJ_SESSION,
    studyId: RUN_CTX.studyId || ''
  };
}

function loadBloomReflection() {
  try {
    const raw = localStorage.getItem(getBloomStorageKey());
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...getDefaultBloomReflection(), ...(parsed || {}) };
  } catch {
    return getDefaultBloomReflection();
  }
}

function checkedAttr(current, value) {
  return String(current || '') === String(value) ? 'checked' : '';
}

function selectedAttr(current, value) {
  return String(current || '') === String(value) ? 'selected' : '';
}

function readBloomReflectionFromDom() {
  const evalChoice = document.querySelector('input[name="gj_eval_choice"]:checked')?.value || '';
  const evalReason = document.querySelector('select[name="gj_eval_reason"]')?.value || '';
  const createFruit = document.querySelector('input[name="gj_create_fruit"]:checked')?.value || '';
  const createVeg = document.querySelector('input[name="gj_create_veg"]:checked')?.value || '';
  const createDrink = document.querySelector('input[name="gj_create_drink"]:checked')?.value || '';

  return {
    evaluateChoice: evalChoice,
    evaluateReason: evalReason,
    createFruit,
    createVeg,
    createDrink
  };
}

function attachBloomToStoredArtifacts(bloom) {
  try {
    const raw = localStorage.getItem(GJI_GAME_SUMMARY_KEY);
    const summary = raw ? JSON.parse(raw) : {};
    summary.bloom = bloom;
    localStorage.setItem(GJI_GAME_SUMMARY_KEY, JSON.stringify(summary));
  } catch {}
}

function persistBloomReflection(mode = 'draft') {
  const next = {
    ...loadBloomReflection(),
    ...readBloomReflectionFromDom(),
    savedMode: mode,
    savedAt: new Date().toISOString(),
    pid: GJ_PID,
    sessionId: GJ_SESSION,
    studyId: RUN_CTX.studyId || ''
  };

  try {
    localStorage.setItem(getBloomStorageKey(), JSON.stringify(next));
  } catch {}

  __gjBloomData = next;
  attachBloomToStoredArtifacts(next);
  return next;
}

function validateBloomReflection() {
  const data = readBloomReflectionFromDom();

  if (!data.evaluateChoice) {
    return { ok: false, message: 'เลือกคำตอบในส่วน “คิดและตัดสินใจ” ก่อน' };
  }

  if (!data.evaluateReason) {
    return { ok: false, message: 'เลือกเหตุผลในส่วน “คิดและตัดสินใจ” ก่อน' };
  }

  if (!data.createFruit || !data.createVeg || !data.createDrink) {
    return { ok: false, message: 'จัดชุดอาหารว่างให้ครบ 3 ส่วนก่อน' };
  }

  return { ok: true, data };
}

function renderBloomReflection(summary) {
  const saved = loadBloomReflection();

  const accuracyPct = Math.round(computeAccuracy() * 100);
  const grade = computeGrade();

  ui.soloBody.innerHTML = `
    <div class="gj-solo-item"><div class="label">คะแนน</div><div class="value">${summary.score}</div></div>
    <div class="gj-solo-item"><div class="label">Miss</div><div class="value">${summary.miss}</div></div>
    <div class="gj-solo-item"><div class="label">Best Streak</div><div class="value">${summary.bestStreak}</div></div>
    <div class="gj-solo-item"><div class="label">Good hit</div><div class="value">${summary.hitsGood}</div></div>
    <div class="gj-solo-item"><div class="label">Junk hit</div><div class="value">${summary.hitsBad}</div></div>
    <div class="gj-solo-item"><div class="label">Good missed</div><div class="value">${summary.missedGood}</div></div>
    <div class="gj-solo-item"><div class="label">Phase</div><div class="value">${escapeHtml(summary.phaseReached || '-')}</div></div>
    <div class="gj-solo-item"><div class="label">Power Hit</div><div class="value">${summary.powerHits || 0}</div></div>
    <div class="gj-solo-item"><div class="label">Boss Stuns</div><div class="value">${summary.bossStuns || 0}</div></div>
    <div class="gj-solo-item"><div class="label">Grade</div><div class="value">${grade}</div></div>
    <div class="gj-solo-item"><div class="label">Accuracy</div><div class="value">${accuracyPct}%</div></div>
    <div class="gj-solo-item"><div class="label">Boss Clear</div><div class="value">${summary.bossCleared ? 'YES' : 'NO'}</div></div>

    <div style="grid-column:1/-1;border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:14px;background:rgba(2,6,23,.45);margin-top:6px;">
      <div style="font-size:18px;font-weight:900;margin-bottom:8px;">คิดและตัดสินใจ (Evaluate)</div>
      <div style="color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:10px;">
        หลังเลิกเรียน ถ้าจะเลือกของว่าง 1 ชุด ชุดไหนดีกว่ากัน
      </div>

      <label style="display:block;padding:10px 12px;border:1px solid rgba(148,163,184,.18);border-radius:12px;margin-bottom:8px;cursor:pointer;">
        <input type="radio" name="gj_eval_choice" value="setA" ${checkedAttr(saved.evaluateChoice, 'setA')} />
        ชุด A: 🍩 โดนัท + 🥤 น้ำอัดลม
      </label>

      <label style="display:block;padding:10px 12px;border:1px solid rgba(148,163,184,.18);border-radius:12px;margin-bottom:10px;cursor:pointer;">
        <input type="radio" name="gj_eval_choice" value="setB" ${checkedAttr(saved.evaluateChoice, 'setB')} />
        ชุด B: 🍌 กล้วย + 🥛 นม
      </label>

      <select name="gj_eval_reason" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.88);color:#e5e7eb;">
        <option value="">-- เลือกเหตุผล --</option>
        <option value="less_sugar" ${selectedAttr(saved.evaluateReason, 'less_sugar')}>น้ำตาลน้อยกว่า</option>
        <option value="better_energy" ${selectedAttr(saved.evaluateReason, 'better_energy')}>ให้พลังงานที่ดีกว่า</option>
        <option value="more_nutrients" ${selectedAttr(saved.evaluateReason, 'more_nutrients')}>มีประโยชน์และสารอาหารมากกว่า</option>
      </select>
    </div>

    <div style="grid-column:1/-1;border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:14px;background:rgba(2,6,23,.45);margin-top:6px;">
      <div style="font-size:18px;font-weight:900;margin-bottom:8px;">สร้างชุดอาหารว่าง (Create)</div>
      <div style="color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:10px;">
        เลือก 1 ผลไม้ + 1 ผัก + 1 เครื่องดื่ม เพื่อจัดชุดอาหารว่างสุขภาพ
      </div>

      <div style="margin-bottom:10px;">
        <div style="font-weight:800;margin-bottom:6px;">ผลไม้</div>
        <label style="display:inline-block;margin-right:12px;"><input type="radio" name="gj_create_fruit" value="apple" ${checkedAttr(saved.createFruit, 'apple')} /> 🍎 แอปเปิล</label>
        <label style="display:inline-block;margin-right:12px;"><input type="radio" name="gj_create_fruit" value="banana" ${checkedAttr(saved.createFruit, 'banana')} /> 🍌 กล้วย</label>
        <label style="display:inline-block;"><input type="radio" name="gj_create_fruit" value="watermelon" ${checkedAttr(saved.createFruit, 'watermelon')} /> 🍉 แตงโม</label>
      </div>

      <div style="margin-bottom:10px;">
        <div style="font-weight:800;margin-bottom:6px;">ผัก</div>
        <label style="display:inline-block;margin-right:12px;"><input type="radio" name="gj_create_veg" value="carrot" ${checkedAttr(saved.createVeg, 'carrot')} /> 🥕 แครอท</label>
        <label style="display:inline-block;margin-right:12px;"><input type="radio" name="gj_create_veg" value="broccoli" ${checkedAttr(saved.createVeg, 'broccoli')} /> 🥦 บรอกโคลี</label>
        <label style="display:inline-block;"><input type="radio" name="gj_create_veg" value="salad" ${checkedAttr(saved.createVeg, 'salad')} /> 🥗 สลัด</label>
      </div>

      <div>
        <div style="font-weight:800;margin-bottom:6px;">เครื่องดื่ม</div>
        <label style="display:inline-block;margin-right:12px;"><input type="radio" name="gj_create_drink" value="milk" ${checkedAttr(saved.createDrink, 'milk')} /> 🥛 นม</label>
        <label style="display:inline-block;"><input type="radio" name="gj_create_drink" value="water" ${checkedAttr(saved.createDrink, 'water')} /> 💧 น้ำเปล่า</label>
      </div>
    </div>
  `;

  if (ui.soloBtnPostK) ui.soloBtnPostK.textContent = 'บันทึกและไป Post-Knowledge';
}

function buildPageUrl(relPath) {
  const q = new URLSearchParams({
    pid: GJ_PID,
    name: GJ_NAME,
    studentKey: RUN_CTX.studentKey || GJ_PID,
    nickName: RUN_CTX.nickName || GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    group: RUN_CTX.group || RUN_CTX.classRoom || RUN_CTX.classroom || GJ_CONDITION || '',
    condition: RUN_CTX.condition || RUN_CTX.conditionGroup || '',
    conditionGroup: RUN_CTX.conditionGroup || RUN_CTX.condition || '',
    session: RUN_CTX.session || RUN_CTX.sessionId || '',
    sessionId: RUN_CTX.sessionId || RUN_CTX.session || '',
    lang: RUN_CTX.lang || 'th',
    mode: GJ_MODE,
    role: GJ_ROLE,
    diff: RUN_CTX.diff || 'easy',
    view: RUN_CTX.view || 'mobile',
    time: RUN_CTX.time || '80',
    run: RUN_CTX.run || 'play',
    hub: GJ_HUB,
    roomId: GJ_ROOM_ID || '',
    startAt: String(getEffectiveRaceStartAt() || 0),
    classRoom: RUN_CTX.classRoom || RUN_CTX.classroom || '',
    classroom: RUN_CTX.classroom || RUN_CTX.classRoom || '',
    schoolName: RUN_CTX.schoolName || RUN_CTX.school || '',
    school: RUN_CTX.school || RUN_CTX.schoolName || '',
    gameId: GJ_GAME_ID
  });

  return `${relPath}?${q.toString()}`;
}

function endGame(reason = 'finished') {
  if (state.ended) return;

  state.ended = true;
  state.running = false;
  __gjLocalRunActive = false;
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
    raceStartAt: getEffectiveRaceStartAt(),
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
    fruitHit: state.fruitHit,
    vegHit: state.vegHit,
    drinkHit: state.drinkHit,
    updatedAt: Date.now()
  };

  const interventionSummary = buildGameSummaryCore(reason);
  logGameEvent('end', {
    reason,
    score: interventionSummary.score,
    miss: interventionSummary.miss,
    grade: interventionSummary.grade
  });
  persistInterventionCtx();
  persistInterventionGameArtifacts(interventionSummary);

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

  showSoloSummary(interventionSummary);
}

function showSoloSummary(summary) {
  __gjSoloSummary = buildSoloSummaryPayload(summary);
  persistSoloSummary(__gjSoloSummary);

  if (!ui.soloOverlay || !ui.soloBody) return;

  const grade = computeGrade();

  ui.soloTitle.textContent = __gjSoloSummary.bossCleared
    ? 'ชนะ Junk Boss แล้ว!'
    : (grade === 'A' ? 'ยอดเยี่ยมมาก!' : 'สรุปผลการเล่น');

  ui.soloSub.textContent = __gjSoloSummary.bossCleared
    ? 'ผ่านครบทั้ง Phase 1 • Phase 2 • Boss แล้ว'
    : 'ดูผลเกม แล้วทำกิจกรรมสั้น ๆ ต่อเพื่อสรุปความเข้าใจ';

  renderBloomReflection(__gjSoloSummary);
  ui.soloOverlay.hidden = false;
}

function buildSoloSummaryPayload(summary) {
  return {
    version: '20260407a-goodjunk-solo-phaseboss',
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
    finishType: summary.bossCleared ? 'boss-clear' : 'normal',
    dnfReason: '',
    rank: null,
    roomId: '',
    playerCount: 1,
    allFinished: true,
    raceStatusFinal: 'solo',
    score: Number(summary.score || 0),
    miss: Number(summary.miss || 0),
    bestStreak: Number(summary.comboBest || summary.bestStreak || 0),
    hitsGood: Number(summary.goodHit || summary.hitsGood || 0),
    hitsBad: Number(summary.junkHit || summary.hitsBad || 0),
    missedGood: Number(state.missedGood || 0),
    phaseReached: summary.phaseReached || computeStageReached(),
    bossCleared: !!summary.bossCleared,
    bossHpRemaining: Number(summary.bossHpRemaining || 0),
    bossStuns: Number(summary.bossStuns || 0),
    powerHits: Number(summary.powerHits || 0),
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
}

function isRaceMode() {
  return GJ_MODE === 'race';
}

function getServerTimestampValue() {
  try {
    return window.HHA_FIREBASE?.database?.ServerValue?.TIMESTAMP ?? Date.now();
  } catch {
    return Date.now();
  }
}

function getEffectiveRaceStartAt() {
  return Number(GJ_START_AT || __gjRecoveredStartAt || 0) || 0;
}

function hasValidRaceStart() {
  return !!GJ_ROOM_ID && getEffectiveRaceStartAt() > 0;
}

async function hydrateRaceStartFromRoom() {
  if (!isRaceMode()) return 0;
  if (!GJ_ROOM_ID) return 0;
  if (!await ensureRaceFirebase()) return 0;

  try {
    const snap = await __gjRaceRoomRef.once('value');
    const room = sanitizeRaceRoom(snapshotToRaceRoom(snap.val()));
    if (!room) return 0;

    if (room.startAt) {
      __gjRecoveredStartAt = Number(room.startAt || 0) || 0;
      return __gjRecoveredStartAt;
    }

    if (room.status === 'running') {
      __gjRecoveredStartAt = Date.now();
      return __gjRecoveredStartAt;
    }

    return 0;
  } catch (err) {
    console.warn('[goodjunk.safe] hydrateRaceStartFromRoom failed:', err);
    return 0;
  }
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

  if (!GJ_ROOM_ID) {
    console.warn('[goodjunk.safe] missing roomId for race mode');
    return false;
  }

  if (!GJ_PID) {
    console.warn('[goodjunk.safe] missing pid for race mode');
    return false;
  }

  if (__gjFbReady && __gjRaceDb && __gjRaceRoomRef && __gjRacePlayersRef && __gjRaceMyPlayerRef) {
    return true;
  }

  const ok = await waitForFirebaseReady();
  if (!ok || !window.HHA_FIREBASE_DB) {
    console.warn('[goodjunk.safe] Firebase not ready for race room');
    return false;
  }

  try {
    __gjRaceDb = window.HHA_FIREBASE_DB;
    __gjRaceRoomRef = __gjRaceDb.ref(GJ_FIREBASE_ROOM_PATH);
    __gjRacePlayersRef = __gjRaceRoomRef.child('players');
    __gjRaceMyPlayerRef = __gjRacePlayersRef.child(GJ_PID);
    __gjFbReady = true;
    return true;
  } catch (err) {
    console.error('[goodjunk.safe] ensureRaceFirebase failed:', err);
    __gjFbReady = false;
    __gjRaceDb = null;
    __gjRaceRoomRef = null;
    __gjRacePlayersRef = null;
    __gjRaceMyPlayerRef = null;
    return false;
  }
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
    id: __normalizePid(p.id || ''),
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
    finishedAt: Number(p.finishedAt || 0),
    disconnectedAt: Number(p.disconnectedAt || 0)
  })) : [];
}

function sanitizeRaceRoom(room) {
  if (!room) return null;

  const rawMatch = room.match && typeof room.match === 'object' ? room.match : {};

  const safe = {
    roomId: __normalizeRoomId(room.roomId || GJ_ROOM_ID || ''),
    hostId: __normalizePid(room.hostId || ''),
    mode: String(room.mode || 'race'),
    minPlayers: Math.max(2, Number(room.minPlayers || 2)),
    maxPlayers: Math.max(2, Number(room.maxPlayers || 4)),
    status: ['waiting', 'countdown', 'running', 'finished'].includes(room.status) ? room.status : 'waiting',
    startAt: room.startAt ? Number(room.startAt) : null,
    createdAt: Number(room.createdAt || Date.now()),
    updatedAt: Number(room.updatedAt || Date.now()),
    players: normalizeRacePlayers(room.players || []),
    match: {
      participantIds: Array.isArray(rawMatch.participantIds)
        ? rawMatch.participantIds.map((id) => __normalizePid(id)).filter(Boolean)
        : [],
      lockedAt: rawMatch.lockedAt ? Number(rawMatch.lockedAt) : null,
      status: ['idle', 'countdown', 'running', 'finished'].includes(rawMatch.status)
        ? rawMatch.status
        : 'idle'
    }
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
    players: {},
    match: {
      participantIds: Array.isArray(room.match?.participantIds) ? room.match.participantIds : [],
      lockedAt: room.match?.lockedAt || null,
      status: room.match?.status || 'idle'
    }
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
      finishedAt: Number(p.finishedAt || 0),
      disconnectedAt: Number(p.disconnectedAt || 0)
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

async function saveRaceRoom(room) {
  if (!await ensureRaceFirebase()) return false;
  if (!room) return false;

  try {
    await __gjRaceRoomRef.set(raceRoomToFirebase(room));
    return true;
  } catch (err) {
    console.error('[goodjunk.safe] saveRaceRoom failed:', err);
    return false;
  }
}

function getRoomParticipantIds(room) {
  const ids = Array.isArray(room?.match?.participantIds) ? room.match.participantIds : [];
  return ids.map((id) => __normalizePid(id)).filter(Boolean);
}

function getRacePlayersForRoom(room) {
  const allPlayers = normalizeRacePlayers(room?.players || []);
  const participantIds = getRoomParticipantIds(room);

  if (!participantIds.length) return allPlayers;

  const map = new Map(allPlayers.map((p) => [p.id, p]));
  return participantIds.map((id) => map.get(id)).filter(Boolean);
}

function amIRaceParticipant(room) {
  const ids = getRoomParticipantIds(room);
  if (!ids.length) return true;
  return ids.includes(GJ_PID);
}

async function setupRunOnDisconnect() {
  if (!await ensureRaceFirebase()) return;
  if (!__gjRaceMyPlayerRef) return;

  try {
    await __gjRaceMyPlayerRef.onDisconnect().update({
      connected: false,
      phase: 'run',
      dnf: false,
      dnfReason: '',
      disconnectedAt: getServerTimestampValue()
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
    version: '20260319a-goodjunk-race-summary',
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
    diff: RUN_CTX.diff || 'easy',
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    seed: RUN_CTX.seed || '',
    raceStartAt: getEffectiveRaceStartAt(),
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

  try {
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
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
    }));
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

function hideRaceResultOverlay() {
  const wrap = document.getElementById('raceResult');
  if (wrap) wrap.hidden = true;
  state.pendingResultVisible = false;
}

function shouldShowRaceOverlayForMe(me, allFinished) {
  if (!me) return false;
  if (me.dnf || me.finished) return true;
  if (__gjLocalRunActive && state.running && !state.ended) return false;
  if (!allFinished) return false;
  return false;
}

function showRaceResultOverlay(rows, opts = {}) {
  const wrap = document.getElementById('raceResult');
  const rowsBox = document.getElementById('raceResultRows');
  const badge = document.getElementById('raceResultBadge');
  const sub = document.getElementById('raceResultSub');
  const hint = document.getElementById('raceResultHint');

  const me = getMyRaceRanked(rows);
  const allFinished = rows.length > 0 && rows.every((p) => p.finished);

  if (!shouldShowRaceOverlayForMe(me, allFinished)) {
    return;
  }

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
    } else if (!p.finished && p.connected === false) {
      stateLine = `<div style="margin-top:4px;font-size:12px;color:#fbbf24;font-weight:800;">การเชื่อมต่อขาดช่วง • รอ reconnect</div>`;
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
      if (mine.dnf) {
        badge.textContent = `DNF • ${getDnfReasonLabel(mine.dnfReason)}`;
        badge.style.color = '#86efac';
        badge.style.borderColor = 'rgba(34,197,94,.25)';
        badge.style.background = 'rgba(34,197,94,.12)';
      } else if (!mine.finished && mine.connected === false) {
        badge.textContent = 'รอ reconnect';
        badge.style.color = '#fcd34d';
        badge.style.borderColor = 'rgba(245,158,11,.28)';
        badge.style.background = 'rgba(245,158,11,.10)';
      } else if (!mine.finished) {
        badge.textContent = 'กำลังแข่ง';
        badge.style.color = '#7dd3fc';
        badge.style.borderColor = 'rgba(56,189,248,.28)';
        badge.style.background = 'rgba(56,189,248,.10)';
      } else {
        badge.textContent = `อันดับ #${mine.rank}`;
        badge.style.color = mine.rank === 1 ? '#fde68a' : '#86efac';
        badge.style.borderColor = mine.rank === 1 ? 'rgba(250,204,21,.28)' : 'rgba(34,197,94,.25)';
        badge.style.background = mine.rank === 1 ? 'rgba(250,204,21,.10)' : 'rgba(34,197,94,.12)';
      }
    } else {
      badge.textContent = '-';
    }
  }

  if (sub) {
    const reconnectCount = rows.filter((p) => !p.finished && p.connected === false && !p.dnf).length;
    sub.textContent = pending
      ? `ผลชั่วคราว • จบแล้ว ${doneCount} • DNF ${dnfCount} • รออีก ${waitingCount} • reconnect ${reconnectCount}`
      : `ผลสุดท้าย • จบแล้ว ${doneCount} • DNF ${dnfCount} • ผู้เล่นทั้งหมด ${summary.playerCount} คน`;
  }

  if (hint) {
    hint.textContent = pending
      ? 'ระบบบันทึก race summary แบบ pending ไว้แล้ว ผู้เล่นที่หลุดชั่วคราวยัง reconnect กลับมาแข่งต่อได้ และจะอัปเดตเป็น final เมื่อทุกคนจบหรือถูกตัดสิทธิ์'
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
    diff: RUN_CTX.diff || 'easy',
    time: RUN_CTX.time || '80',
    seed: String(Date.now())),
    hub: GJ_HUB,
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    gameId: GJ_GAME_ID,
    mode: 'race',
    roomId: GJ_ROOM_ID,
    session: GJ_SESSION,
    sessionId: GJ_SESSION,
    condition: GJ_CONDITION,
    conditionGroup: GJ_CONDITION,
    studentKey: RUN_CTX.studentKey || GJ_PID,
    nickName: RUN_CTX.nickName || GJ_NAME,
    classRoom: RUN_CTX.classRoom || RUN_CTX.classroom || '',
    schoolName: RUN_CTX.schoolName || RUN_CTX.school || ''
  });
  return `../goodjunk-race-lobby.html?${q.toString()}`;
}

async function resetRaceRoomForRematch() {
  const room = await loadRaceRoom();
  if (!room) return;

  room.status = 'waiting';
  room.startAt = null;
  room.updatedAt = Date.now();
  room.match = {
    participantIds: [],
    lockedAt: null,
    status: 'idle'
  };

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
    lastSeenAt: Date.now(),
    disconnectedAt: 0
  }));

  const hasCurrentHost = room.players.some((p) => p.id === room.hostId);
  if (!hasCurrentHost) room.hostId = room.players[0]?.id || '';

  await saveRaceRoom(room);
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
      lastSeenAt: Date.now(),
      disconnectedAt: patch.connected === false
        ? (patch.disconnectedAt ?? cur.disconnectedAt ?? Date.now())
        : 0
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
    dnfReason: '',
    disconnectedAt: 0
  });

  __gjRaceHeartbeatTimer = setInterval(() => {
    markRacePresenceDuringRun({
      phase: 'run',
      ready: true,
      connected: true,
      finished: false,
      dnf: false,
      dnfReason: '',
      disconnectedAt: 0
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
      dnfReason: '',
      disconnectedAt: Date.now(),
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

  const participantIds = getRoomParticipantIds(room);
  const participantSet = new Set(participantIds);

  const players = normalizeRacePlayers(room.players).map((p) => {
    const inMatch = participantSet.size ? participantSet.has(p.id) : true;
    if (!inMatch) return p;
    if (p.finished) return p;

    const stale = !p.lastSeenAt || (ts - p.lastSeenAt > GJ_RACE_STALE_MS);
    const disconnectBase = Number(p.disconnectedAt || p.lastSeenAt || ts);
    const disconnectAge = ts - disconnectBase;
    const shouldForceDnf = force || (stale && disconnectAge > GJ_RACE_DNF_GRACE_MS);

    if (shouldForceDnf) {
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
        lastSeenAt: ts,
        disconnectedAt: p.disconnectedAt || ts
      };
    }

    if (stale && !p.finished) {
      const nextDisconnectedAt = p.disconnectedAt || ts;
      if (p.connected !== false || !p.disconnectedAt) {
        changed = true;
        return {
          ...p,
          connected: false,
          phase: 'run',
          finished: false,
          dnf: false,
          dnfReason: '',
          disconnectedAt: nextDisconnectedAt
        };
      }
    }

    return p;
  });

  const racePlayers = participantSet.size
    ? players.filter((p) => participantSet.has(p.id))
    : players;

  if (!racePlayers.length) return;

  const allFinished = racePlayers.every((p) => p.finished);
  const nextStatus = allFinished ? 'finished' : (room.status === 'waiting' ? 'waiting' : 'running');

  if (
    changed ||
    room.status !== nextStatus ||
    JSON.stringify(room.players) !== JSON.stringify(players)
  ) {
    room.players = players;
    room.status = nextStatus;
    room.match = {
      ...(room.match || {}),
      status: allFinished ? 'finished' : (room.status === 'countdown' ? 'running' : (room.match?.status || 'running'))
    };
    room.updatedAt = ts;
    await saveRaceRoom(room);
  }

  if (allFinished) {
    const ranked = rankRacePlayers(racePlayers);
    const me = getMyRaceRanked(ranked);

    if (me) {
      showRaceResultOverlay(ranked, { pending: false });
    }

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
    if (!amIRaceParticipant(room)) return;

    const participantIds = getRoomParticipantIds(room);
    const participantSet = new Set(participantIds);

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
        lastSeenAt: Date.now(),
        disconnectedAt: 0
      };
    });

    const racePlayers = participantSet.size
      ? room.players.filter((p) => participantSet.has(p.id))
      : room.players;

    const allFinished = racePlayers.length > 0 && racePlayers.every((p) => p.finished);

    room.status = allFinished ? 'finished' : 'running';
    room.match = {
      ...(room.match || {}),
      status: allFinished ? 'finished' : 'running'
    };

    await saveRaceRoom(room);

    const ranked = rankRacePlayers(racePlayers);
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
  if (!amIRaceParticipant(room)) {
    hideRaceResultOverlay();
    return;
  }

  const racePlayers = getRacePlayersForRoom(room);
  const ranked = rankRacePlayers(racePlayers);
  const allFinished = ranked.length > 0 && ranked.every((p) => p.finished);
  const me = getMyRaceRanked(ranked);

  if (me?.finished || me?.dnf) {
    showRaceResultOverlay(ranked, { pending: !allFinished });
  }
}

function attachRaceRoomListener() {
  if (!isRaceMode() || __gjRaceRoomListenerBound) return;
  if (!GJ_ROOM_ID) return;

  __gjRaceRoomListenerBound = true;

  ensureRaceFirebase().then((ok) => {
    if (!ok || !__gjRaceRoomRef) return;

    __gjRaceRoomRef.on('value', async (snap) => {
      const room = sanitizeRaceRoom(snapshotToRaceRoom(snap.val()));
      if (!room || !Array.isArray(room.players)) return;

      if (!__gjRecoveredStartAt && room.startAt) {
        __gjRecoveredStartAt = Number(room.startAt || 0) || 0;
      }

      if (!amIRaceParticipant(room)) {
        hideRaceResultOverlay();
        return;
      }

      const racePlayers = getRacePlayersForRoom(room);
      const ranked = rankRacePlayers(racePlayers);
      const me = getMyRaceRanked(ranked);
      if (!me) return;

      const allFinished = ranked.length > 0 && ranked.every((p) => p.finished);

      if (!me.finished && !me.dnf && me.connected !== false) {
        hideRaceResultOverlay();
      }

      if (shouldShowRaceOverlayForMe(me, allFinished)) {
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

async function bootWithRaceGate(startFn) {
  if (__gjRaceBooted) return;
  __gjRaceBooted = true;

  if (!isRaceMode()) {
    startFn();
    return;
  }

  if (!GJ_ROOM_ID) {
    showRaceGate('ยังไม่มี room จากลิงก์นี้', '...', 'กลับไปหน้า lobby แล้วเริ่มใหม่');
    return;
  }

  const room = await loadRaceRoom();
  if (room && !amIRaceParticipant(room)) {
    showRaceGate('คุณไม่ได้อยู่ใน participant ของรอบนี้', '...', 'กลับไปหน้า lobby เพื่อรอรอบถัดไป');
    return;
  }

  if (!hasValidRaceStart()) {
    await hydrateRaceStartFromRoom();
  }

  if (!hasValidRaceStart()) {
    showRaceGate('กำลังรอเริ่มการแข่งขัน', '...', 'ยังไม่มีสัญญาณเริ่มจากห้องแข่ง');
    return;
  }

  const effectiveStartAt = getEffectiveRaceStartAt();
  showRaceGate('กำลังรอสัญญาณเริ่มจากห้องแข่ง', '-', `Room: ${GJ_ROOM_ID}`);
  await waitUntilRaceStart(effectiveStartAt);
  cancelRaceGateLoop();
  hideRaceGate();
  startFn();
}

function buildReplayUrl() {
  const q = new URLSearchParams({
    pid: GJ_PID,
    name: GJ_NAME,
    studentKey: RUN_CTX.studentKey || GJ_PID,
    nickName: RUN_CTX.nickName || GJ_NAME,
    studyId: RUN_CTX.studyId || '',
    diff: RUN_CTX.diff || 'easy',
    time: RUN_CTX.time || '80',
    seed: String(Date.now()),
    hub: GJ_HUB,
    view: RUN_CTX.view || 'mobile',
    run: RUN_CTX.run || 'play',
    gameId: GJ_GAME_ID,
    mode: GJ_MODE,
    role: GJ_ROLE,

    session: RUN_CTX.session || RUN_CTX.sessionId || '',
    sessionId: RUN_CTX.sessionId || RUN_CTX.session || '',
    condition: RUN_CTX.condition || RUN_CTX.conditionGroup || '',
    conditionGroup: RUN_CTX.conditionGroup || RUN_CTX.condition || '',
    classRoom: RUN_CTX.classRoom || RUN_CTX.classroom || '',
    classroom: RUN_CTX.classroom || RUN_CTX.classRoom || '',
    schoolName: RUN_CTX.schoolName || RUN_CTX.school || '',
    school: RUN_CTX.school || RUN_CTX.schoolName || ''
  });

  if (isRaceMode()) {
    q.set('roomId', GJ_ROOM_ID);
    if (getEffectiveRaceStartAt()) {
      q.set('startAt', String(getEffectiveRaceStartAt()));
    }
  }

  return `./goodjunk-vr.html?v=20260407a-phaseboss&${q.toString()}`;
}