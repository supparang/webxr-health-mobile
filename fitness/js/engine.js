// === /fitness/js/engine.js ===
// Shadow Breaker Engine (Module)
// Note: This file expects to be loaded with <script type="module" src="./js/engine.js"></script>

import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';
import { computeAssist, AIDirector } from './ai-director.js';
import { AIPredictor } from './ai-predictor.js';
import { AICoach } from './ai-coach.js';
import { FeatureTracker } from './dl-features.js';
import { FxBurst } from './fx-burst.js'; // ✅ PATCH: ensure FX is available
import { PatternGen } from './ai-pattern.js';

'use strict';

const DOC = document;
const WIN = window;

const $ = (sel, root = DOC) => root.querySelector(sel);

function clamp(v, a, b) { v = Number(v) || 0; return Math.max(a, Math.min(b, v)); }
function clamp01(v) { return clamp(v, 0, 1); }

function readQS() {
  try { return new URL(location.href).searchParams; }
  catch { return new URLSearchParams(); }
}
const QS = readQS();
const qs = (k, d = null) => (QS.get(k) ?? d);

function nowMs() { return performance.now(); }
function randId(prefix = 'id') { return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`; }

function safeJsonParse(s, fallback = null) {
  try { return JSON.parse(s); } catch { return fallback; }
}

function isTouchDevice() {
  return ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
}

// --------------------------
// DOM refs
// --------------------------
const els = {
  wrap: $('#sb-wrap'),
  viewMenu: $('#sb-view-menu'),
  viewPlay: $('#sb-view-play'),
  viewResult: $('#sb-view-result'),

  // menu
  modeNormal: $('#sb-mode-normal'),
  modeResearch: $('#sb-mode-research'),
  modeDesc: $('#sb-mode-desc'),
  diff: $('#sb-diff'),
  time: $('#sb-time'),
  researchBox: $('#sb-research-box'),
  partId: $('#sb-part-id'),
  partGroup: $('#sb-part-group'),
  partNote: $('#sb-part-note'),
  btnPlay: $('#sb-btn-play'),
  btnResearch: $('#sb-btn-research'),
  btnHowto: $('#sb-btn-howto'),
  howto: $('#sb-howto'),

  // play HUD
  txtTime: $('#sb-text-time'),
  txtScore: $('#sb-text-score'),
  txtCombo: $('#sb-text-combo'),
  txtPhase: $('#sb-text-phase'),
  txtMiss: $('#sb-text-miss'),
  txtShield: $('#sb-text-shield'),

  bossName: $('#sb-current-boss-name'),

  hpYouTop: $('#sb-hp-you-top'),
  hpBossTop: $('#sb-hp-boss-top'),
  hpYouBot: $('#sb-hp-you-bottom'),
  hpBossBot: $('#sb-hp-boss-bottom'),

  feverBar: $('#sb-fever-bar'),
  feverLabel: $('#sb-label-fever'),

  targetLayer: $('#sb-target-layer'),
  msgMain: $('#sb-msg-main'),

  // boss meta
  metaEmoji: $('#sb-meta-emoji'),
  metaName: $('#sb-meta-name'),
  metaDesc: $('#sb-meta-desc'),
  bossPhaseLabel: $('#sb-boss-phase-label'),
  bossShieldLabel: $('#sb-boss-shield-label'),

  // controls
  btnBackMenu: $('#sb-btn-back-menu'),
  togglePause: $('#sb-btn-pause'),

  // result
  resTime: $('#sb-res-time'),
  resScore: $('#sb-res-score'),
  resMaxCombo: $('#sb-res-max-combo'),
  resMiss: $('#sb-res-miss'),
  resPhase: $('#sb-res-phase'),
  resBossCleared: $('#sb-res-boss-cleared'),
  resAcc: $('#sb-res-acc'),
  resGrade: $('#sb-res-grade'),

  btnRetry: $('#sb-btn-result-retry'),
  btnDlEvents: $('#sb-btn-download-events'),
  btnDlSession: $('#sb-btn-download-session'),
  btnResultMenu: $('#sb-btn-result-menu'),
};

// --------------------------
// View / Mode
// --------------------------
function setView(name) {
  const all = [els.viewMenu, els.viewPlay, els.viewResult];
  all.forEach(v => v && v.classList.remove('is-active'));
  if (name === 'menu') els.viewMenu?.classList.add('is-active');
  if (name === 'play') els.viewPlay?.classList.add('is-active');
  if (name === 'result') els.viewResult?.classList.add('is-active');
}

function setMode(mode) {
  // mode: 'normal' | 'research'
  const isResearch = mode === 'research';
  els.modeNormal?.classList.toggle('is-active', !isResearch);
  els.modeResearch?.classList.toggle('is-active', isResearch);
  els.researchBox?.classList.toggle('is-active', isResearch);

  if (els.modeDesc) {
    els.modeDesc.textContent = isResearch
      ? 'Research: สำหรับเก็บข้อมูล (ต้องกรอก Participant ID / Group)'
      : 'Normal: เล่นสนุก/สอนทั่วไป ไม่ต้องกรอกข้อมูลผู้เข้าร่วม';
  }

  // reflect into query for shareability (optional)
  try {
    const url = new URL(location.href);
    url.searchParams.set('mode', isResearch ? 'research' : 'play');
    history.replaceState(null, '', url.toString());
  } catch (_) {}
}

function getMode() {
  const m = (qs('mode', 'play') || '').toLowerCase();
  return (m === 'research') ? 'research' : 'normal';
}

function validateResearchMeta() {
  const id = (els.partId?.value || '').trim();
  const group = (els.partGroup?.value || '').trim();
  if (!id) return { ok: false, msg: 'กรุณากรอก Participant ID' };
  if (!group) return { ok: false, msg: 'กรุณากรอก Group' };
  return { ok: true };
}

// --------------------------
// Game Model
// --------------------------
const BOSSES = [
  { name: 'Bubble Glove', emoji: '🐣', desc: 'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน' },
  { name: 'Iron Pup', emoji: '🐶', desc: 'ตีสลับซ้าย-ขวา ระวังหลง decoy' },
  { name: 'Neon Mantis', emoji: '🦗', desc: 'จังหวะเร็วขึ้น—คุมคอมโบให้ดี' },
  { name: 'Dragon Core', emoji: '🐲', desc: 'เฟสท้ายเดือด—อย่าโลภเป้าล่อ' },
];

const TARGET_TYPES = {
  HIT: 'hit',
  DECOY: 'decoy',
  BOMB: 'bomb',
  HEAL: 'heal',
  SHIELD: 'shield',
  FEVER: 'fever',
  FACE: 'bossface',
};

// --------------------------
// State
// --------------------------
const state = {
  mode: getMode(), // 'normal'|'research'
  diff: (els.diff?.value || 'normal'),
  durationSec: Number(els.time?.value || 70),

  running: false,
  paused: false,
  t0: 0,
  tLast: 0,
  elapsed: 0,

  score: 0,
  combo: 0,
  maxCombo: 0,
  miss: 0,

  hpYou: 100,
  hpBoss: 100,
  phase: 1,
  bossIndex: 0,
  bossesCleared: 0,

  shield: 0,
  fever: 0, // 0..100
  feverOn: false,
  feverLeft: 0,

  hits: 0,
  totalSpawns: 0,

  // RT tracking
  rtSum: 0,
  rtCount: 0,

  // AI snapshot
  lastTipAt: 0,
  lastAssistAt: 0,

  // logging
  sessionId: randId('sb'),
  participantId: '',
  group: '',
  note: '',
};

const logEvents = new EventLogger();
const logSession = new SessionLogger();

// --------------------------
// AI Modules
// --------------------------
const aiDirector = new AIDirector();
const aiPredictor = new AIPredictor();
const aiCoach = new AICoach();
const dlFeat = new FeatureTracker();
const patternGen = new PatternGen();

// --------------------------
// UI helpers
// --------------------------
function pctFill(el, pct) {
  if (!el) return;
  pct = clamp(pct, 0, 100);
  el.style.width = `${pct}%`;
}

function setText(el, text) {
  if (!el) return;
  el.textContent = text;
}

function updateHUD() {
  setText(els.txtTime, `${state.elapsed.toFixed(1)} s`);
  setText(els.txtScore, `${state.score}`);
  setText(els.txtCombo, `${state.combo}`);
  setText(els.txtPhase, `${state.phase}`);
  setText(els.txtMiss, `${state.miss}`);
  setText(els.txtShield, `${state.shield}`);

  const boss = BOSSES[state.bossIndex] || BOSSES[0];
  setText(els.bossName, `${boss.name} ${boss.emoji}`);

  pctFill(els.hpYouTop, state.hpYou);
  pctFill(els.hpYouBot, state.hpYou);
  pctFill(els.hpBossTop, state.hpBoss);
  pctFill(els.hpBossBot, state.hpBoss);

  pctFill(els.feverBar, state.fever);
  setText(els.feverLabel, state.feverOn ? `ON (${state.feverLeft.toFixed(1)}s)` : (state.fever >= 100 ? 'READY' : 'BUILD'));

  // boss meta
  setText(els.metaEmoji, boss.emoji);
  setText(els.metaName, boss.name);
  setText(els.metaDesc, boss.desc);
  setText(els.bossPhaseLabel, `${state.phase}`);
  setText(els.bossShieldLabel, `${state.shield}`);
}

function showMsg(text, cls = '') {
  if (!els.msgMain) return;
  els.msgMain.textContent = text;
  els.msgMain.className = `sb-msg-main ${cls}`.trim();
}

function clearTargets() {
  if (!els.targetLayer) return;
  els.targetLayer.innerHTML = '';
}

function setDiff(diff) {
  state.diff = diff;
  els.wrap?.setAttribute('data-diff', diff);
}

function setBoss(index) {
  state.bossIndex = clamp(index, 0, BOSSES.length - 1);
  els.wrap?.setAttribute('data-boss', `${state.bossIndex}`);
}

function setPhase(p) {
  state.phase = clamp(p, 1, 5);
  els.wrap?.setAttribute('data-phase', `${state.phase}`);
}

function gradeFromScore(accPct, miss, maxCombo) {
  // simple grading
  const acc = clamp01(accPct / 100);
  let g = 'C';
  if (acc >= 0.92 && miss <= 3 && maxCombo >= 12) g = 'SS';
  else if (acc >= 0.85 && miss <= 6) g = 'S';
  else if (acc >= 0.75) g = 'A';
  else if (acc >= 0.60) g = 'B';
  else g = 'C';
  return g;
}

// --------------------------
// Spawn + Hit logic
// --------------------------
function diffParams(diff) {
  if (diff === 'easy') return { ttlMin: 900, ttlMax: 1400, spawnEvery: 760, dmgBoss: 8, dmgYou: 8 };
  if (diff === 'hard') return { ttlMin: 520, ttlMax: 900, spawnEvery: 480, dmgBoss: 11, dmgYou: 12 };
  return { ttlMin: 680, ttlMax: 1100, spawnEvery: 620, dmgBoss: 9, dmgYou: 10 };
}

function targetWeightsByPhase(phase) {
  // as phase increases: more decoy/bomb
  const base = {
    hit: 65,
    decoy: 12,
    bomb: 9,
    heal: 6,
    shield: 5,
    fever: 3,
  };

  if (phase >= 3) { base.decoy += 6; base.bomb += 3; base.hit -= 6; }
  if (phase >= 4) { base.decoy += 6; base.bomb += 4; base.hit -= 7; }
  if (phase >= 5) { base.decoy += 6; base.bomb += 4; base.hit -= 8; base.fever += 2; }

  return base;
}

function pickByWeights(weights, rng01) {
  const keys = Object.keys(weights);
  let sum = 0;
  keys.forEach(k => { sum += Math.max(0, Number(weights[k]) || 0); });
  if (sum <= 0) return keys[0];

  const r = clamp01(rng01) * sum;
  let acc = 0;
  for (const k of keys) {
    acc += Math.max(0, Number(weights[k]) || 0);
    if (r <= acc) return k;
  }
  return keys[keys.length - 1];
}

function makeTarget(type, xPct, yPct, ttlMs) {
  const el = DOC.createElement('button');
  el.type = 'button';
  el.className = `sb-target sb-target--${type}`;
  el.setAttribute('data-type', type);
  el.setAttribute('aria-label', type);
  el.style.left = `${xPct}%`;
  el.style.top = `${yPct}%`;

  const born = nowMs();
  const id = randId('t');
  el.dataset.id = id;
  el.dataset.born = `${born}`;
  el.dataset.ttl = `${ttlMs}`;

  // icon / label
  if (type === TARGET_TYPES.HIT) el.textContent = '🥊';
  else if (type === TARGET_TYPES.DECOY) el.textContent = '🫥';
  else if (type === TARGET_TYPES.BOMB) el.textContent = '💣';
  else if (type === TARGET_TYPES.HEAL) el.textContent = '❤️';
  else if (type === TARGET_TYPES.SHIELD) el.textContent = '🛡️';
  else if (type === TARGET_TYPES.FEVER) el.textContent = '🔥';
  else if (type === TARGET_TYPES.FACE) el.textContent = '👀';
  else el.textContent = '•';

  // click handler
  el.addEventListener('click', () => onHitTarget(el, 'tap'));

  // auto expire
  const timer = setTimeout(() => {
    if (!el.isConnected) return;
    // miss only for hit/face targets
    const t = el.dataset.type;
    if (t === TARGET_TYPES.HIT || t === TARGET_TYPES.FACE) {
      state.miss += 1;
      state.combo = 0;

      // FX miss
      try {
        const r = el.getBoundingClientRect();
        FxBurst.popText(r.left + r.width / 2, r.top + r.height / 2, 'MISS', 'sb-fx-miss');
      } catch (_) {}
    }
    el.remove();
    updateHUD();
  }, ttlMs);

  el.dataset.timer = `${timer}`;
  return el;
}

function onHitTarget(el, source = 'tap') {
  if (!state.running || state.paused) return;
  if (!el || !el.isConnected) return;

  const type = el.dataset.type || TARGET_TYPES.HIT;
  const born = Number(el.dataset.born || 0);
  const rt = Math.max(0, nowMs() - born);

  // compute score delta
  let scoreDelta = 0;
  let dmgBoss = 0;
  let dmgYou = 0;
  let feverAdd = 0;

  const P = diffParams(state.diff);

  if (type === TARGET_TYPES.HIT || type === TARGET_TYPES.FACE) {
    scoreDelta = (type === TARGET_TYPES.FACE) ? 120 : 50;
    dmgBoss = (type === TARGET_TYPES.FACE) ? (P.dmgBoss * 2) : P.dmgBoss;
    feverAdd = 12;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.hits += 1;
    state.rtSum += rt;
    state.rtCount += 1;

    if (state.feverOn) {
      scoreDelta = Math.round(scoreDelta * 1.25);
      dmgBoss = Math.round(dmgBoss * 1.25);
    }
  } else if (type === TARGET_TYPES.DECOY) {
    scoreDelta = -25;
    dmgYou = P.dmgYou;
    state.combo = 0;
  } else if (type === TARGET_TYPES.BOMB) {
    scoreDelta = -40;
    dmgYou = Math.round(P.dmgYou * 1.2);
    state.combo = 0;
  } else if (type === TARGET_TYPES.HEAL) {
    scoreDelta = 10;
    state.hpYou = clamp(state.hpYou + 18, 0, 100);
    feverAdd = 6;
  } else if (type === TARGET_TYPES.SHIELD) {
    scoreDelta = 12;
    state.shield = clamp(state.shield + 1, 0, 9);
    feverAdd = 6;
  } else if (type === TARGET_TYPES.FEVER) {
    scoreDelta = 15;
    feverAdd = 26;
  }

  // apply dmg
  if (dmgBoss > 0) state.hpBoss = clamp(state.hpBoss - dmgBoss, 0, 100);

  if (dmgYou > 0) {
    // shield blocks one hit
    if (state.shield > 0) {
      state.shield -= 1;
      // FX block
      try {
        const r = el.getBoundingClientRect();
        FxBurst.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 10, cls: 'sb-fx-shield' });
        FxBurst.popText(r.left + r.width / 2, r.top - 10, 'BLOCK', 'sb-fx-shield');
      } catch (_) {}
    } else {
      state.hpYou = clamp(state.hpYou - dmgYou, 0, 100);
    }
  }

  // fever
  if (feverAdd > 0) {
    state.fever = clamp(state.fever + feverAdd, 0, 100);
  }

  // FX hit
  try {
    const r = el.getBoundingClientRect();
    if (type === TARGET_TYPES.HIT || type === TARGET_TYPES.FACE) {
      FxBurst.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 12, cls: 'sb-fx-hit' });
      FxBurst.popText(r.left + r.width / 2, r.top - 12, `+${scoreDelta}`, 'sb-fx-plus');
    } else if (type === TARGET_TYPES.HEAL) {
      FxBurst.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 10, cls: 'sb-fx-heal' });
      FxBurst.popText(r.left + r.width / 2, r.top - 12, '+HP', 'sb-fx-heal');
    } else if (type === TARGET_TYPES.SHIELD) {
      FxBurst.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 10, cls: 'sb-fx-shield' });
      FxBurst.popText(r.left + r.width / 2, r.top - 12, '+SHIELD', 'sb-fx-shield');
    } else if (type === TARGET_TYPES.FEVER) {
      FxBurst.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 12, cls: 'sb-fx-fever' });
      FxBurst.popText(r.left + r.width / 2, r.top - 12, '+FEVER', 'sb-fx-fever');
    } else if (type === TARGET_TYPES.BOMB) {
      FxBurst.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 14, cls: 'sb-fx-bomb' });
      FxBurst.popText(r.left + r.width / 2, r.top - 12, '-HP', 'sb-fx-bomb');
    } else if (type === TARGET_TYPES.DECOY) {
      FxBurst.popText(r.left + r.width / 2, r.top - 12, 'DECOY', 'sb-fx-decoy');
    }
  } catch (_) {}

  // remove target
  try {
    const timer = Number(el.dataset.timer || 0);
    if (timer) clearTimeout(timer);
  } catch (_) {}
  el.remove();

  // score
  state.score = Math.max(0, state.score + scoreDelta);

  // event log row
  const row = {
    ts_ms: Date.now(),
    mode: state.mode,
    diff: state.diff,
    boss_index: state.bossIndex,
    boss_phase: state.phase,
    target_id: el.dataset.id || '',
    target_type: type,
    is_boss_face: (type === TARGET_TYPES.FACE),
    event_type: 'hit',
    rt_ms: Math.round(rt),
    grade: '',
    score_delta: scoreDelta,
    combo_after: state.combo,
    score_after: state.score,
    player_hp: Math.round(state.hpYou),
    boss_hp: Math.round(state.hpBoss),
    shield_after: state.shield,
    fever_after: Math.round(state.fever),
    source,
  };
  logEvents.add(row);

  // boss progression
  if (state.hpBoss <= 0) {
    onBossDown();
  }

  // game over
  if (state.hpYou <= 0) {
    endGame('lose');
  }

  updateHUD();
}

function onBossDown() {
  state.bossesCleared += 1;

  // FX boss down
  try {
    FxBurst.popText(WIN.innerWidth * 0.5, WIN.innerHeight * 0.26, 'BOSS DOWN!', 'sb-fx-win');
    FxBurst.burst(WIN.innerWidth * 0.5, WIN.innerHeight * 0.30, { count: 18, cls: 'sb-fx-win' });
  } catch (_) {}

  // next boss / phase
  const nextBoss = state.bossIndex + 1;
  if (nextBoss < BOSSES.length) {
    setBoss(nextBoss);
    state.hpBoss = 100;
    // phase bumps when boss changes
    setPhase(state.phase + 1);
  } else {
    // loop bosses with higher phase
    setBoss(0);
    state.hpBoss = 100;
    setPhase(state.phase + 1);
  }
}

// --------------------------
// FEVER + AI
// --------------------------
function tryStartFever() {
  if (state.feverOn) return;
  if (state.fever < 100) return;
  state.feverOn = true;
  state.feverLeft = 6.0;
  state.fever = 100;

  try {
    FxBurst.popText(WIN.innerWidth * 0.5, WIN.innerHeight * 0.22, 'FEVER!', 'sb-fx-fever');
    FxBurst.burst(WIN.innerWidth * 0.5, WIN.innerHeight * 0.28, { count: 16, cls: 'sb-fx-fever' });
  } catch (_) {}
}

function stepFever(dt) {
  if (!state.feverOn) return;
  state.feverLeft -= dt;
  if (state.feverLeft <= 0) {
    state.feverOn = false;
    state.feverLeft = 0;
    state.fever = clamp(state.fever - 30, 0, 100); // drop a bit
  }
}

// build snapshot for AI predictor
function snapshotForAI() {
  const judged = state.hits + state.miss;
  const accPct = judged > 0 ? (state.hits / judged) * 100 : 0;
  const rtMean = state.rtCount > 0 ? (state.rtSum / state.rtCount) : 0;

  return {
    accPct,
    hitMiss: state.miss,
    combo: state.combo,
    offsetAbsMean: 0, // not used here
    hp: state.hpYou,
    songTime: state.elapsed,
    durationSec: state.durationSec,
    rtMean,
    bossIndex: state.bossIndex,
    phase: state.phase,
    fever: state.fever,
    shield: state.shield,
  };
}

function aiTick(dt) {
  // research mode: lock AI
  if (state.mode === 'research') return;

  // assist enabled if ?ai=1 OR if launched from hub with ai flags
  const assistEnabled = aiPredictor.isAssistEnabled?.() || (qs('ai', '0') === '1');
  if (!assistEnabled) return;

  const snap = snapshotForAI();

  // DL-lite features update
  dlFeat.updateFromSnapshot(snap);

  // predictor
  const pred = aiPredictor.predict(snap);

  // director (difficulty pacing / spawn tuning)
  const assist = computeAssist(pred, snap);
  const dir = aiDirector.step(assist, dt);

  // coach tips (rate-limited)
  const tip = aiCoach.maybeTip(pred, snap);
  if (tip && (nowMs() - state.lastTipAt > 1500)) {
    state.lastTipAt = nowMs();
    try {
      FxBurst.popText(WIN.innerWidth * 0.5, WIN.innerHeight * 0.86, tip, 'sb-fx-tip');
    } catch (_) {}
  }

  // apply adaptive pacing (light)
  // dir.spawnMul in [0.85..1.25]
  state._spawnMul = dir.spawnMul || 1.0;
}

// --------------------------
// Main loop
// --------------------------
function startGame() {
  state.running = true;
  state.paused = false;
  state.t0 = nowMs();
  state.tLast = state.t0;
  state.elapsed = 0;

  // reset play stats
  state.score = 0; state.combo = 0; state.maxCombo = 0; state.miss = 0;
  state.hpYou = 100; state.hpBoss = 100;
  state.phase = 1; state.bossIndex = 0; state.bossesCleared = 0;
  state.shield = 0;
  state.fever = 0; state.feverOn = false; state.feverLeft = 0;
  state.hits = 0; state.totalSpawns = 0;
  state.rtSum = 0; state.rtCount = 0;
  state._spawnMul = 1.0;

  // clear logs
  logEvents.clear();
  logSession.clear();

  clearTargets();
  showMsg('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!');

  setBoss(0);
  setPhase(1);

  // set view
  setView('play');
  updateHUD();

  // schedule spawns
  state._nextSpawnAt = nowMs() + 250;

  requestAnimationFrame(loop);
}

function endGame(reason = 'timeup') {
  if (!state.running) return;
  state.running = false;
  state.paused = false;

  // compute results
  const judged = state.hits + state.miss;
  const accPct = judged > 0 ? (state.hits / judged) * 100 : 0;
  const grade = gradeFromScore(accPct, state.miss, state.maxCombo);

  // fill result UI
  setText(els.resTime, `${state.elapsed.toFixed(1)} s`);
  setText(els.resScore, `${state.score}`);
  setText(els.resMaxCombo, `${state.maxCombo}`);
  setText(els.resMiss, `${state.miss}`);
  setText(els.resPhase, `${state.phase}`);
  setText(els.resBossCleared, `${state.bossesCleared}`);
  setText(els.resAcc, `${accPct.toFixed(1)} %`);
  setText(els.resGrade, grade);

  // session log
  const sess = {
    ts_ms: Date.now(),
    session_id: state.sessionId,
    mode: state.mode,
    diff: state.diff,
    duration_sec: state.durationSec,
    score: state.score,
    max_combo: state.maxCombo,
    miss: state.miss,
    bosses_cleared: state.bossesCleared,
    phase_reached: state.phase,
    acc_pct: accPct.toFixed(1),
    grade,
    reason,
    participant_id: state.participantId,
    group: state.group,
    note: state.note,
  };
  logSession.add(sess);

  // FX end
  try {
    FxBurst.popText(WIN.innerWidth * 0.5, WIN.innerHeight * 0.24, 'FINISH', 'sb-fx-win');
    FxBurst.burst(WIN.innerWidth * 0.5, WIN.innerHeight * 0.30, { count: 18, cls: 'sb-fx-win' });
  } catch (_) {}

  setView('result');
}

function loop() {
  if (!state.running) return;

  const t = nowMs();
  const dt = Math.min(0.05, Math.max(0, (t - state.tLast) / 1000));
  state.tLast = t;

  if (!state.paused) {
    state.elapsed += dt;
    stepFever(dt);
    aiTick(dt);

    // time up
    if (state.elapsed >= state.durationSec) {
      endGame('timeup');
      return;
    }

    // auto fever activation
    if (!state.feverOn && state.fever >= 100) {
      tryStartFever();
    }

    // spawn
    const P = diffParams(state.diff);
    const baseEvery = P.spawnEvery;
    const spawnEvery = baseEvery / (state._spawnMul || 1.0);

    if (t >= (state._nextSpawnAt || 0)) {
      state._nextSpawnAt = t + spawnEvery;

      const weights = targetWeightsByPhase(state.phase);
      // deterministic pattern for fairness using PatternGen
      const rng01 = patternGen.next01(state.phase, state.bossIndex, state.totalSpawns);
      const pick = pickByWeights(weights, rng01);

      // positions: avoid HUD top by y range
      const x = 12 + (rng01 * 76); // 12..88
      const y = 22 + (patternGen.next01(state.bossIndex, state.phase, state.totalSpawns + 77) * 58); // 22..80

      const ttlMs = Math.round(P.ttlMin + (patternGen.next01(state.totalSpawns, state.phase, state.bossIndex) * (P.ttlMax - P.ttlMin)));

      const type = (pick === 'hit') ? TARGET_TYPES.HIT :
        (pick === 'decoy') ? TARGET_TYPES.DECOY :
          (pick === 'bomb') ? TARGET_TYPES.BOMB :
            (pick === 'heal') ? TARGET_TYPES.HEAL :
              (pick === 'shield') ? TARGET_TYPES.SHIELD :
                TARGET_TYPES.FEVER;

      const el = makeTarget(type, x, y, ttlMs);
      els.targetLayer?.appendChild(el);
      state.totalSpawns += 1;
    }
  }

  updateHUD();
  requestAnimationFrame(loop);
}

// --------------------------
// UI wiring
// --------------------------
function init() {
  if (!els.wrap) {
    console.warn('[SB] missing #sb-wrap');
    return;
  }

  // mode
  state.mode = getMode();
  setMode(state.mode);

  els.modeNormal?.addEventListener('click', () => { state.mode = 'normal'; setMode('normal'); });
  els.modeResearch?.addEventListener('click', () => { state.mode = 'research'; setMode('research'); });

  // howto
  els.btnHowto?.addEventListener('click', () => {
    els.howto?.classList.toggle('is-active');
  });

  // diff/time changes
  els.diff?.addEventListener('change', () => setDiff(els.diff.value || 'normal'));
  els.time?.addEventListener('change', () => { state.durationSec = Number(els.time.value || 70); });

  // start
  els.btnPlay?.addEventListener('click', () => {
    state.mode = 'normal';
    setMode('normal');
    setDiff(els.diff.value || 'normal');
    state.durationSec = Number(els.time.value || 70);

    // reset session
    state.sessionId = randId('sb');
    state.participantId = '';
    state.group = '';
    state.note = '';
    startGame();
  });

  els.btnResearch?.addEventListener('click', () => {
    state.mode = 'research';
    setMode('research');

    const v = validateResearchMeta();
    if (!v.ok) { alert(v.msg); return; }

    setDiff(els.diff.value || 'normal');
    state.durationSec = Number(els.time.value || 70);

    // set meta
    state.sessionId = randId('sb');
    state.participantId = (els.partId?.value || '').trim();
    state.group = (els.partGroup?.value || '').trim();
    state.note = (els.partNote?.value || '').trim();

    startGame();
  });

  // controls
  els.btnBackMenu?.addEventListener('click', () => {
    state.running = false;
    setView('menu');
  });

  els.togglePause?.addEventListener('change', () => {
    state.paused = !!els.togglePause.checked;
    if (state.paused) showMsg('PAUSED');
    else showMsg('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!');
  });

  // result actions
  els.btnRetry?.addEventListener('click', () => {
    // restart with current mode/diff/time
    setDiff(els.diff.value || 'normal');
    state.durationSec = Number(els.time.value || 70);
    state.sessionId = randId('sb');
    startGame();
  });

  els.btnResultMenu?.addEventListener('click', () => {
    setView('menu');
  });

  els.btnDlEvents?.addEventListener('click', () => {
    try {
      const csv = logEvents.toCsv();
      if (!csv) { alert('ยังไม่มีข้อมูล events'); return; }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href = url;
      a.download = 'shadow-breaker-events.csv';
      DOC.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('ดาวน์โหลด Events CSV ไม่สำเร็จ');
    }
  });

  els.btnDlSession?.addEventListener('click', () => {
    try {
      const csv = logSession.toCsv();
      if (!csv) { alert('ยังไม่มีข้อมูล session'); return; }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href = url;
      a.download = 'shadow-breaker-session.csv';
      DOC.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('ดาวน์โหลด Session CSV ไม่สำเร็จ');
    }
  });

  // initial view
  setView('menu');
  updateHUD();

  // quick tap feedback for touch devices (optional)
  if (isTouchDevice()) {
    els.wrap.classList.add('is-touch');
  }
}

init();