// === /fitness/js/engine.js ===
// Shadow Breaker Engine — PRODUCTION (PackD FIXVIEW v2)
// ✅ View switching (menu/play/result)
// ✅ DOM targets + FX burst
// ✅ Session/Event CSV download
// ✅ Research mode lock (no AI adjust) + Play mode AI assist optional
// ✅ Boss phases + skills hooks (PackA BossSkills v3)

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { SessionLogger } from './session-logger.js';
import { EventLogger, downloadEventCsv } from './event-logger.js';
import { downloadSessionCsv } from './session-logger.js';

// ---- small helpers ----
const WIN = window;
const DOC = document;

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const clamp01 = (v) => clamp(v, 0, 1);
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function qs(sel) { return DOC.querySelector(sel); }
function qsa(sel) { return Array.from(DOC.querySelectorAll(sel)); }

function setActiveView(id) {
  const views = qsa('.sb-view');
  for (const v of views) v.classList.remove('is-active');
  const el = DOC.getElementById(id);
  if (el) el.classList.add('is-active');
}

function setMsg(text, cls = '') {
  const el = qs('#sb-msg-main');
  if (!el) return;
  el.className = 'sb-msg-main' + (cls ? ' ' + cls : '');
  el.textContent = text || '';
}

function fmt1(v) { return (Number(v) || 0).toFixed(1); }
function int(v) { return Math.round(Number(v) || 0); }

function readModeFromUI() {
  const btnR = qs('#sb-mode-research');
  return btnR && btnR.classList.contains('is-active') ? 'research' : 'normal';
}

function isResearchMode() {
  // 1) URL mode has priority if present
  try {
    const m = (new URL(location.href).searchParams.get('mode') || '').toLowerCase();
    if (m === 'research') return true;
    if (m === 'normal') return false;
  } catch (_) {}
  // 2) fallback to UI toggle
  return readModeFromUI() === 'research';
}

function shouldEnableAI() {
  // Research locks adaptive/AI
  if (isResearchMode()) return false;

  // optional: require ai=1 to enable assist in play mode
  try {
    const v = (new URL(location.href).searchParams.get('ai') || '').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  } catch (_) {
    return false;
  }
}

// ---- Boss definitions ----
const BOSSES = [
  {
    name: 'Bubble Glove',
    emoji: '🐣',
    desc: 'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน',
    phases: [
      { hp: 100, spawnMs: 820, ttlMs: 950, sizePx: 128, mix: { normal: 0.82, bomb: 0.10, heal: 0.04, shield: 0.04 } },
      { hp: 120, spawnMs: 740, ttlMs: 900, sizePx: 122, mix: { normal: 0.78, bomb: 0.12, heal: 0.05, shield: 0.05 } },
      { hp: 140, spawnMs: 680, ttlMs: 860, sizePx: 118, mix: { normal: 0.74, bomb: 0.14, heal: 0.06, shield: 0.06 } },
    ],
    skills: [
      { atHpPct: 0.72, kind: 'storm', durMs: 2200, note: 'Bubble Storm!' },
      { atHpPct: 0.42, kind: 'fakeouts', durMs: 2400, note: 'Decoy Blink!' },
    ]
  },
  {
    name: 'Neon Horn',
    emoji: '🦄',
    desc: 'เฟสเร็วขึ้น—ต้องคุมจังหวะให้เนียน',
    phases: [
      { hp: 120, spawnMs: 760, ttlMs: 900, sizePx: 122, mix: { normal: 0.78, decoy: 0.10, bomb: 0.07, heal: 0.03, shield: 0.02 } },
      { hp: 140, spawnMs: 690, ttlMs: 850, sizePx: 118, mix: { normal: 0.74, decoy: 0.12, bomb: 0.08, heal: 0.04, shield: 0.02 } },
      { hp: 160, spawnMs: 640, ttlMs: 820, sizePx: 114, mix: { normal: 0.70, decoy: 0.14, bomb: 0.09, heal: 0.05, shield: 0.02 } },
    ],
    skills: [
      { atHpPct: 0.66, kind: 'shieldUp', durMs: 2600, note: 'Boss Shield Up!' },
      { atHpPct: 0.36, kind: 'storm', durMs: 2400, note: 'Neon Storm!' },
    ]
  },
  {
    name: 'Iron Mask',
    emoji: '🤖',
    desc: 'หนักจริง—ดีเลย์สั้นลง + กับดักเยอะ',
    phases: [
      { hp: 140, spawnMs: 720, ttlMs: 860, sizePx: 118, mix: { normal: 0.72, decoy: 0.10, bomb: 0.10, heal: 0.04, shield: 0.04 } },
      { hp: 170, spawnMs: 650, ttlMs: 820, sizePx: 114, mix: { normal: 0.68, decoy: 0.12, bomb: 0.12, heal: 0.04, shield: 0.04 } },
      { hp: 200, spawnMs: 600, ttlMs: 780, sizePx: 110, mix: { normal: 0.64, decoy: 0.14, bomb: 0.14, heal: 0.04, shield: 0.04 } },
    ],
    skills: [
      { atHpPct: 0.70, kind: 'fakeouts', durMs: 2600, note: 'Mirror Decoy!' },
      { atHpPct: 0.40, kind: 'rage', durMs: 2600, note: 'Rage Rush!' },
    ]
  }
];

// ---- Difficulty presets ----
const DIFF = {
  easy:   { youHp: 140, scoreMul: 0.90, bossDmg: 1.10, youDmg: 0.85, feverGain: 1.10, spawnMul: 1.08, ttlMul: 1.10, sizeMul: 1.06 },
  normal: { youHp: 120, scoreMul: 1.00, bossDmg: 1.00, youDmg: 1.00, feverGain: 1.00, spawnMul: 1.00, ttlMul: 1.00, sizeMul: 1.00 },
  hard:   { youHp: 100, scoreMul: 1.08, bossDmg: 0.95, youDmg: 1.18, feverGain: 0.92, spawnMul: 0.92, ttlMul: 0.90, sizeMul: 0.94 },
};

// ---- Engine state ----
const State = {
  running: false,
  ended: false,
  paused: false,

  mode: 'normal',
  diff: 'normal',
  durationSec: 70,

  tStart: 0,
  tNow: 0,

  // counters
  score: 0,
  combo: 0,
  maxCombo: 0,
  miss: 0,

  // HP
  youHpMax: 120,
  youHp: 120,
  bossHpMax: 100,
  bossHp: 100,

  // fever
  fever: 0,        // 0..1
  feverOn: false,  // active fever window
  feverTtlMs: 0,

  // boss & phase
  bossIndex: 0,
  bossCleared: 0,
  phaseIndex: 0,

  // target ids
  nextTargetId: 1,
  liveTargets: new Map(), // id -> data

  // spawn
  nextSpawnAt: 0,

  // skill triggers per boss
  skillFlags: {},

  // accuracy-ish
  totalHits: 0,
  totalJudged: 0,

  // ai snapshot
  aiLastTipAt: 0
};

// ---- UI refs ----
const UI = {
  // menu
  modeNormal: qs('#sb-mode-normal'),
  modeResearch: qs('#sb-mode-research'),
  modeDesc: qs('#sb-mode-desc'),

  selDiff: qs('#sb-diff'),
  selTime: qs('#sb-time'),

  researchBox: qs('#sb-research-box'),
  inpPid: qs('#sb-part-id'),
  inpGroup: qs('#sb-part-group'),
  inpNote: qs('#sb-part-note'),

  btnPlay: qs('#sb-btn-play'),
  btnResearch: qs('#sb-btn-research'),
  btnHowto: qs('#sb-btn-howto'),
  howto: qs('#sb-howto'),

  // play
  viewMenu: qs('#sb-view-menu'),
  viewPlay: qs('#sb-view-play'),
  viewResult: qs('#sb-view-result'),

  textTime: qs('#sb-text-time'),
  textScore: qs('#sb-text-score'),
  textCombo: qs('#sb-text-combo'),
  textPhase: qs('#sb-text-phase'),
  textMiss: qs('#sb-text-miss'),
  textShield: qs('#sb-text-shield'),

  bossName: qs('#sb-current-boss-name'),
  metaEmoji: qs('#sb-meta-emoji'),
  metaName: qs('#sb-meta-name'),
  metaDesc: qs('#sb-meta-desc'),
  bossPhaseLabel: qs('#sb-boss-phase-label'),
  bossShieldLabel: qs('#sb-boss-shield-label'),

  hpYouTop: qs('#sb-hp-you-top'),
  hpBossTop: qs('#sb-hp-boss-top'),
  hpYouBottom: qs('#sb-hp-you-bottom'),
  hpBossBottom: qs('#sb-hp-boss-bottom'),

  feverBar: qs('#sb-fever-bar'),
  feverLabel: qs('#sb-label-fever'),

  btnBackMenu: qs('#sb-btn-back-menu'),
  chkPause: qs('#sb-btn-pause'),

  // result
  resTime: qs('#sb-res-time'),
  resScore: qs('#sb-res-score'),
  resMaxCombo: qs('#sb-res-max-combo'),
  resMiss: qs('#sb-res-miss'),
  resPhase: qs('#sb-res-phase'),
  resBossCleared: qs('#sb-res-boss-cleared'),
  resAcc: qs('#sb-res-acc'),
  resGrade: qs('#sb-res-grade'),

  btnRetry: qs('#sb-btn-result-retry'),
  btnMenu: qs('#sb-btn-result-menu'),
  btnDLEvents: qs('#sb-btn-download-events'),
  btnDLSession: qs('#sb-btn-download-session'),
};

// ---- Layers ----
const targetLayer = qs('#sb-target-layer');

if (!targetLayer) {
  console.error('[ShadowBreaker] missing #sb-target-layer');
}

const sessionLogger = new SessionLogger();
const eventLogger = new EventLogger();

const renderer = new DomRendererShadow(targetLayer, {
  wrapEl: qs('#sb-wrap'),
  feedbackEl: qs('#sb-msg-main'),
  onTargetHit: onTargetHit
});

// ---- init UI toggles ----
function syncModeUI(mode) {
  State.mode = mode === 'research' ? 'research' : 'normal';

  UI.modeNormal?.classList.toggle('is-active', State.mode === 'normal');
  UI.modeResearch?.classList.toggle('is-active', State.mode === 'research');

  if (UI.researchBox) UI.researchBox.classList.toggle('is-on', State.mode === 'research');

  if (UI.modeDesc) {
    UI.modeDesc.textContent = State.mode === 'research'
      ? 'Research: เก็บข้อมูล session/event (แนะนำกรอก Participant ID) และล็อค AI/Adaptive เพื่อความเที่ยงตรง'
      : 'Normal: เล่นสนุก/สอนทั่วไป ไม่ต้องกรอกข้อมูลผู้เข้าร่วม';
  }

  // control which start button is visible-ish
  if (UI.btnResearch) UI.btnResearch.style.display = State.mode === 'research' ? '' : 'none';
}

function bootFromQuery() {
  // mode
  try {
    const m = (new URL(location.href).searchParams.get('mode') || '').toLowerCase();
    if (m === 'research') syncModeUI('research');
    else syncModeUI('normal');
  } catch (_) {
    syncModeUI('normal');
  }

  // diff/time
  try {
    const q = new URL(location.href).searchParams;
    const d = (q.get('diff') || '').toLowerCase();
    const t = Number(q.get('time'));
    if (UI.selDiff && (d === 'easy' || d === 'normal' || d === 'hard')) UI.selDiff.value = d;
    if (UI.selTime && Number.isFinite(t)) UI.selTime.value = String(t);
  } catch (_) {}
}

bootFromQuery();

// ---- wire events ----
UI.modeNormal?.addEventListener('click', () => syncModeUI('normal'));
UI.modeResearch?.addEventListener('click', () => syncModeUI('research'));

UI.btnHowto?.addEventListener('click', () => {
  UI.howto?.classList.toggle('is-on');
});

UI.btnPlay?.addEventListener('click', () => startGame('normal'));
UI.btnResearch?.addEventListener('click', () => startGame('research'));

UI.btnBackMenu?.addEventListener('click', () => {
  stopGame('back_to_menu');
  setActiveView('sb-view-menu');
});

UI.chkPause?.addEventListener('change', () => {
  State.paused = !!UI.chkPause?.checked;
  if (State.paused) setMsg('หยุดชั่วคราว (Stop)', 'miss');
  else setMsg('ไปต่อ! แตะ/ชกเป้าให้ทัน', 'good');
});

UI.btnRetry?.addEventListener('click', () => {
  setActiveView('sb-view-menu');
  // keep mode/diff/time as is, user presses Start again
});

UI.btnMenu?.addEventListener('click', () => {
  setActiveView('sb-view-menu');
});

UI.btnDLEvents?.addEventListener('click', () => {
  downloadEventCsv(eventLogger, `shadow-breaker-events_${Date.now()}.csv`);
});

UI.btnDLSession?.addEventListener('click', () => {
  downloadSessionCsv(sessionLogger, `shadow-breaker-session_${Date.now()}.csv`);
});

// ============================================================
// Core: start/stop loop
// ============================================================

function startGame(mode) {
  // apply UI -> state
  syncModeUI(mode);

  State.diff = (UI.selDiff?.value || 'normal');
  if (!DIFF[State.diff]) State.diff = 'normal';

  State.durationSec = Number(UI.selTime?.value || 70) || 70;
  State.durationSec = clamp(State.durationSec, 20, 180);

  // init boss/phases
  State.bossIndex = 0;
  State.phaseIndex = 0;
  State.bossCleared = 0;

  // init hp
  const dp = DIFF[State.diff];
  State.youHpMax = dp.youHp;
  State.youHp = dp.youHp;

  const boss = BOSSES[State.bossIndex];
  const ph = boss.phases[State.phaseIndex];
  State.bossHpMax = ph.hp;
  State.bossHp = ph.hp;

  State.skillFlags = {};

  // init stats
  State.score = 0;
  State.combo = 0;
  State.maxCombo = 0;
  State.miss = 0;
  State.fever = 0;
  State.feverOn = false;
  State.feverTtlMs = 0;
  State.totalHits = 0;
  State.totalJudged = 0;

  // clear targets
  for (const [id] of State.liveTargets.entries()) {
    renderer.removeTarget(id, 'reset');
  }
  State.liveTargets.clear();
  State.nextTargetId = 1;

  // log init
  sessionLogger.clear();
  eventLogger.clear();

  const pid = (UI.inpPid?.value || '').trim();
  const grp = (UI.inpGroup?.value || '').trim();
  const note = (UI.inpNote?.value || '').trim();

  sessionLogger.setMeta({
    ts_start_ms: Date.now(),
    mode: State.mode,
    diff: State.diff,
    duration_sec: State.durationSec,
    participant_id: pid,
    group: grp,
    note: note
  });

  // view play
  setActiveView('sb-view-play');
  setMsg('เริ่มเลย! แตะ/ชกเป้าให้ทัน', 'good');

  // time
  State.running = true;
  State.ended = false;
  State.paused = false;
  if (UI.chkPause) UI.chkPause.checked = false;

  State.tStart = nowMs();
  State.tNow = State.tStart;
  State.nextSpawnAt = State.tStart + 250;

  // boss ui
  syncBossUI();

  // tick
  requestAnimationFrame(loop);
}

// ... (Part 1 ends here)