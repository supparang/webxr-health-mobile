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
// ===============================
// Loop + time/spawn/expire
// ===============================
function loop() {
  if (!State.running || State.ended) return;

  const t = nowMs();
  State.tNow = t;

  // lazy init for properties that may be introduced by patches
  if (State.shield == null) State.shield = 0;

  if (!State.paused) {
    const elapsedSec = (t - State.tStart) / 1000;
    const remainSec = Math.max(0, State.durationSec - elapsedSec);

    // end by time
    if (remainSec <= 0) {
      endGame('time_up');
      return;
    }

    // spawn
    if (t >= State.nextSpawnAt) {
      spawnOne();
      // schedule next spawn
      const boss = BOSSES[State.bossIndex];
      const ph = boss.phases[State.phaseIndex];
      const dp = DIFF[State.diff] || DIFF.normal;

      const baseSpawn = ph.spawnMs;
      const spawnMs = clamp(baseSpawn * dp.spawnMul * getSkillSpawnMul(), 240, 1400);
      State.nextSpawnAt = t + spawnMs;
    }

    // expire targets
    expireTargets(t);

    // boss skills
    checkBossSkills();

    // fever timer
    if (State.feverOn) {
      State.feverTtlMs -= (t - (State._lastTickMs || t));
      if (State.feverTtlMs <= 0) {
        State.feverOn = false;
        State.feverTtlMs = 0;
        setMsg('FEVER หมดเวลา', 'miss');
      }
    }

    // update HUD
    updateHUD(remainSec);
  }

  State._lastTickMs = t;
  requestAnimationFrame(loop);
}

function stopGame(reason = 'stop') {
  // stop without result view (used when back to menu)
  State.running = false;
  State.ended = true;

  // remove all targets
  for (const [id] of State.liveTargets.entries()) {
    renderer.removeTarget(id, reason);
  }
  State.liveTargets.clear();

  // renderer cleanup (keep instance)
  setMsg('พร้อมเริ่มใหม่', '');
}

function endGame(endReason = 'end') {
  State.running = false;
  State.ended = true;

  // finalize session stats
  const elapsedSec = clamp((State.tNow - State.tStart) / 1000, 0, State.durationSec);

  // compute accuracy: hits / judged
  const acc = State.totalJudged > 0 ? (State.totalHits / State.totalJudged) * 100 : 0;

  const grade = computeGrade({
    accPct: acc,
    miss: State.miss,
    maxCombo: State.maxCombo,
    bossCleared: State.bossCleared,
    youHpPct: State.youHpMax ? (State.youHp / State.youHpMax) : 0
  });

  // session summary
  sessionLogger.setSummary({
    ts_end_ms: Date.now(),
    end_reason: endReason,
    time_sec: Number(elapsedSec.toFixed(2)),
    score: State.score,
    max_combo: State.maxCombo,
    miss: State.miss,
    boss_cleared: State.bossCleared,
    phase_reached: State.phaseIndex + 1,
    acc_pct: Number(acc.toFixed(2)),
    grade: grade
  });

  // ensure targets removed
  for (const [id] of State.liveTargets.entries()) {
    renderer.removeTarget(id, 'end');
  }
  State.liveTargets.clear();

  // result UI
  if (UI.resTime) UI.resTime.textContent = `${fmt1(elapsedSec)} s`;
  if (UI.resScore) UI.resScore.textContent = String(int(State.score));
  if (UI.resMaxCombo) UI.resMaxCombo.textContent = String(int(State.maxCombo));
  if (UI.resMiss) UI.resMiss.textContent = String(int(State.miss));
  if (UI.resPhase) UI.resPhase.textContent = String(int(State.phaseIndex + 1));
  if (UI.resBossCleared) UI.resBossCleared.textContent = String(int(State.bossCleared));
  if (UI.resAcc) UI.resAcc.textContent = `${fmt1(acc)} %`;
  if (UI.resGrade) UI.resGrade.textContent = grade;

  setActiveView('sb-view-result');
  setMsg('จบเกม!', 'good');
}

function updateHUD(remainSec) {
  // time
  if (UI.textTime) UI.textTime.textContent = `${fmt1(State.durationSec - remainSec)} s`;
  if (UI.textScore) UI.textScore.textContent = String(int(State.score));
  if (UI.textCombo) UI.textCombo.textContent = String(int(State.combo));
  if (UI.textPhase) UI.textPhase.textContent = String(int(State.phaseIndex + 1));
  if (UI.textMiss) UI.textMiss.textContent = String(int(State.miss));
  if (UI.textShield) UI.textShield.textContent = String(int(State.shield || 0));

  // hp bars
  setBar(UI.hpYouTop, State.youHpMax ? (State.youHp / State.youHpMax) : 0);
  setBar(UI.hpBossTop, State.bossHpMax ? (State.bossHp / State.bossHpMax) : 0);
  setBar(UI.hpYouBottom, State.youHpMax ? (State.youHp / State.youHpMax) : 0);
  setBar(UI.hpBossBottom, State.bossHpMax ? (State.bossHp / State.bossHpMax) : 0);

  // fever
  const f = clamp01(State.fever);
  if (UI.feverBar) UI.feverBar.style.transform = `scaleX(${f})`;
  if (UI.feverLabel) {
    if (State.feverOn) {
      UI.feverLabel.textContent = 'ON';
      UI.feverLabel.classList.add('on');
    } else if (f >= 1) {
      UI.feverLabel.textContent = 'READY';
      UI.feverLabel.classList.remove('on');
    } else {
      UI.feverLabel.textContent = 'BUILD';
      UI.feverLabel.classList.remove('on');
    }
  }

  // boss meta side
  if (UI.bossPhaseLabel) UI.bossPhaseLabel.textContent = String(int(State.phaseIndex + 1));
  if (UI.bossShieldLabel) UI.bossShieldLabel.textContent = String(int(State.bossShield || 0));
}

function setBar(el, pct01) {
  if (!el) return;
  const p = clamp01(pct01);
  el.style.transform = `scaleX(${p})`;
}

// ===============================
// Spawn / target lifecycle
// ===============================
function spawnOne() {
  const boss = BOSSES[State.bossIndex];
  const ph = boss.phases[State.phaseIndex];
  const dp = DIFF[State.diff] || DIFF.normal;

  const id = State.nextTargetId++;
  const type = pickTargetType(ph.mix);

  const baseSize = Number(ph.sizePx) || 120;
  const sizePx = clamp(baseSize * dp.sizeMul * getSkillSizeMul(type), 70, 320);

  const baseTtl = Number(ph.ttlMs) || 900;
  const ttlMs = clamp(baseTtl * dp.ttlMul * getSkillTtlMul(type), 320, 2200);

  // sometimes show bossface when boss low
  const bossHpPct = State.bossHpMax ? (State.bossHp / State.bossHpMax) : 1;
  const canBossFace = bossHpPct <= 0.15 && !State._bossFaceShown;
  const finalType = canBossFace ? 'bossface' : type;

  const data = {
    id,
    type: finalType,
    bossEmoji: boss.emoji,
    bornMs: State.tNow,
    expireMs: State.tNow + ttlMs,
    sizePx
  };

  State.liveTargets.set(id, data);
  renderer.spawnTarget(data);

  if (finalType === 'bossface') {
    State._bossFaceShown = true;
  }
}

function pickTargetType(mix) {
  // mix: {normal:0.8, bomb:0.1, heal:0.05, shield:0.05, decoy:0.0}
  const m = mix || { normal: 1 };
  const keys = Object.keys(m);
  let sum = 0;
  for (const k of keys) sum += Math.max(0, Number(m[k]) || 0);
  if (sum <= 0) return 'normal';

  let r = Math.random() * sum;
  for (const k of keys) {
    r -= Math.max(0, Number(m[k]) || 0);
    if (r <= 0) return k;
  }
  return keys[0] || 'normal';
}

function expireTargets(tMs) {
  if (!State.liveTargets.size) return;

  const expired = [];
  for (const [id, d] of State.liveTargets.entries()) {
    if (tMs >= d.expireMs) expired.push(id);
  }

  for (const id of expired) {
    const d = State.liveTargets.get(id);
    if (!d) continue;

    // timeout miss (only if it was hittable)
    if (d.type !== 'heal' && d.type !== 'shield') {
      State.miss += 1;
      State.combo = 0;

      State.totalJudged += 1;
      // no hit

      // log event for research
      eventLogger.add({
        ts_ms: Date.now(),
        mode: State.mode,
        diff: State.diff,
        boss_index: State.bossIndex,
        boss_phase: State.phaseIndex + 1,
        target_id: d.id,
        target_type: d.type,
        is_boss_face: d.type === 'bossface' ? 1 : 0,
        event_type: 'timeout_miss',
        rt_ms: '',
        grade: 'timeout_miss',
        score_delta: 0,
        combo_after: State.combo,
        score_after: State.score,
        player_hp: State.youHp,
        boss_hp: State.bossHp
      });

      // user feedback
      setMsg('MISS (ช้าไป!)', 'miss');
    }

    renderer.removeTarget(id, 'timeout');
    State.liveTargets.delete(id);

    // small penalty in hard (optional)
    applyTimeoutPenalty(d);
  }
}

function applyTimeoutPenalty(d) {
  // optional: punish slightly if hard and you keep missing
  if (State.diff !== 'hard') return;
  if (!d) return;

  // if normal target timed out -> small chip damage
  if (d.type === 'normal' || d.type === 'bossface') {
    const dp = DIFF[State.diff] || DIFF.normal;
    const dmg = Math.round(3 * dp.youDmg);
    damagePlayer(dmg, 'timeout_chip');
  }
}

function damagePlayer(dmg, reason) {
  const n = Math.max(0, Math.round(Number(dmg) || 0));
  if (n <= 0) return;

  // shield blocks first
  if ((State.shield || 0) > 0) {
    State.shield = Math.max(0, (State.shield || 0) - 1);
    // log as blocked damage
    eventLogger.add({
      ts_ms: Date.now(),
      mode: State.mode,
      diff: State.diff,
      boss_index: State.bossIndex,
      boss_phase: State.phaseIndex + 1,
      target_id: '',
      target_type: '',
      is_boss_face: 0,
      event_type: 'shield_block',
      rt_ms: '',
      grade: 'shield_block',
      score_delta: 0,
      combo_after: State.combo,
      score_after: State.score,
      player_hp: State.youHp,
      boss_hp: State.bossHp,
      note: reason || ''
    });
    setMsg('SHIELD BLOCK!', 'good');
    return;
  }

  State.youHp = clamp(State.youHp - n, 0, State.youHpMax);
  if (State.youHp <= 0) {
    endGame('player_dead');
  }
}

function syncBossUI() {
  const boss = BOSSES[State.bossIndex];
  if (!boss) return;

  if (UI.bossName) UI.bossName.textContent = `${boss.name} ${boss.emoji}`;
  if (UI.metaEmoji) UI.metaEmoji.textContent = boss.emoji;
  if (UI.metaName) UI.metaName.textContent = boss.name;
  if (UI.metaDesc) UI.metaDesc.textContent = boss.desc || '';

  State._bossFaceShown = false;

  if (UI.bossPhaseLabel) UI.bossPhaseLabel.textContent = String(int(State.phaseIndex + 1));
  if (UI.bossShieldLabel) UI.bossShieldLabel.textContent = String(int(State.bossShield || 0));
}

// ===============================
// Boss skills system (PackA hooks)
// ===============================
function checkBossSkills() {
  const boss = BOSSES[State.bossIndex];
  if (!boss) return;
  const skills = boss.skills || [];
  if (!skills.length) return;

  const hpPct = State.bossHpMax ? (State.bossHp / State.bossHpMax) : 1;

  for (let i = 0; i < skills.length; i++) {
    const s = skills[i];
    const key = `b${State.bossIndex}_p${State.phaseIndex}_s${i}`;
    if (State.skillFlags[key]) continue;

    const at = Number(s.atHpPct);
    if (!Number.isFinite(at)) continue;

    if (hpPct <= at) {
      State.skillFlags[key] = true;
      triggerSkill(s);
    }
  }

  // decay active skill timers
  if (State._skillActiveUntilMs && State.tNow >= State._skillActiveUntilMs) {
    State._skillActiveUntilMs = 0;
    State._skillKind = '';
    State._skillNote = '';
    State._skillBoost = null;
  }
}

function triggerSkill(s) {
  const kind = s.kind || '';
  const durMs = clamp(Number(s.durMs) || 2200, 800, 7000);
  State._skillKind = kind;
  State._skillNote = s.note || '';
  State._skillActiveUntilMs = State.tNow + durMs;

  // show message
  if (State._skillNote) setMsg(State._skillNote, 'perfect');

  if (kind === 'shieldUp') {
    // boss shield points: reduce boss damage for a while
    State.bossShield = clamp((State.bossShield || 0) + 2, 0, 9);
  }

  if (kind === 'storm') {
    // immediate burst of spawns
    const n = 6;
    for (let i = 0; i < n; i++) spawnOne();
  }

  if (kind === 'fakeouts') {
    // mark boost: increase decoy for duration
    State._skillBoost = { decoyPlus: 0.12 };
  }

  if (kind === 'rage') {
    // mark boost: faster spawn + shorter ttl
    State._skillBoost = { spawnMul: 0.82, ttlMul: 0.88, sizeMul: 0.94 };
  }
}

function getSkillSpawnMul() {
  const b = State._skillBoost || null;
  if (!b) return 1;
  return Number.isFinite(b.spawnMul) ? b.spawnMul : 1;
}
function getSkillTtlMul(type) {
  const b = State._skillBoost || null;
  if (!b) return 1;
  // rage: global ttl
  if (Number.isFinite(b.ttlMul)) return b.ttlMul;
  // storm: a bit shorter on bombs
  if (State._skillKind === 'storm' && type === 'bomb') return 0.92;
  return 1;
}
function getSkillSizeMul(type) {
  const b = State._skillBoost || null;
  if (!b) return 1;
  if (Number.isFinite(b.sizeMul)) return b.sizeMul;
  // fakeouts: decoy slightly smaller
  if (State._skillKind === 'fakeouts' && type === 'decoy') return 0.92;
  return 1;
}

// ... (Part 2 ends here)
// ===============================
// Hit handling (FX + scoring + damage + logs)
// ===============================
function onTargetHit(id, pt = {}) {
  if (!State.running || State.ended || State.paused) return;

  const tMs = State.tNow || nowMs();
  const d = State.liveTargets.get(id);
  if (!d) return;

  // prevent double hit
  State.liveTargets.delete(id);
  renderer.removeTarget(id, 'hit');

  // reaction time
  const rtMs = clamp(tMs - d.bornMs, 0, 5000);

  // judge
  const judge = judgeHit(rtMs, d.type);
  // judge: { grade:'perfect'|'good'|'bad'|'bomb'|'heal'|'shield', scoreDelta, bossDmg, youDmg, feverDelta }

  // combo logic
  const wasMissLike = (judge.grade === 'bad' || judge.grade === 'bomb');
  if (wasMissLike) {
    State.combo = 0;
    State.miss += 1;
  } else {
    State.combo += 1;
    State.maxCombo = Math.max(State.maxCombo, State.combo);
  }

  // totals for accuracy
  State.totalJudged += 1;
  if (!wasMissLike) State.totalHits += 1;

  // apply score
  State.score += judge.scoreDelta;

  // FEVER
  if (!State.feverOn) {
    State.fever = clamp01(State.fever + judge.feverDelta);
    if (State.fever >= 1) {
      State.fever = 1;
      // auto-trigger FEVER when full
      State.feverOn = true;
      State.feverTtlMs = clamp((DIFF[State.diff]?.feverDurMs || 2500), 1200, 6500);
      setMsg('FEVER ON!', 'perfect');
      // tiny FX at center to celebrate
      FxBurstSafeBurst(window.innerWidth * 0.5, window.innerHeight * 0.22, 'sb-fx-fever');
    }
  }

  // apply boss/player damage with shield rules
  if (judge.bossDmg > 0) {
    const actual = applyBossDamage(judge.bossDmg, d.type);
    // boss damage might be reduced by bossShield
    if (actual > 0 && State.bossHp <= 0) {
      // clear boss now
      nextBossOrPhase();
    }
  }

  if (judge.youDmg > 0) {
    damagePlayer(judge.youDmg, 'hit_' + judge.grade);
    if (State.ended) return; // player died -> endGame invoked
  }

  // heal/shield pickups
  if (judge.grade === 'heal') {
    State.youHp = clamp(State.youHp + judge.healHp, 0, State.youHpMax);
  }
  if (judge.grade === 'shield') {
    State.shield = clamp((State.shield || 0) + judge.addShield, 0, 9);
  }

  // FX (IMPORTANT: this is why effects can "disappear" if we forget to call playHitFx)
  renderer.playHitFx(id, {
    clientX: pt.clientX,
    clientY: pt.clientY,
    grade: judge.grade === 'timeout_miss' ? 'bad' : judge.grade,
    scoreDelta: judge.scoreDelta
  });

  // message
  if (judge.grade === 'perfect') setMsg('PERFECT!', 'perfect');
  else if (judge.grade === 'good') setMsg('GOOD!', 'good');
  else if (judge.grade === 'bad') setMsg('OOPS!', 'bad');
  else if (judge.grade === 'bomb') setMsg('BOMB!', 'bad');
  else if (judge.grade === 'heal') setMsg('+HP', 'good');
  else if (judge.grade === 'shield') setMsg('+SHIELD', 'good');

  // log event
  eventLogger.add({
    ts_ms: Date.now(),
    mode: State.mode,
    diff: State.diff,
    boss_index: State.bossIndex,
    boss_phase: State.phaseIndex + 1,
    target_id: d.id,
    target_type: d.type,
    is_boss_face: d.type === 'bossface' ? 1 : 0,
    event_type: 'hit',
    rt_ms: Math.round(rtMs),
    grade: judge.grade,
    score_delta: judge.scoreDelta,
    combo_after: State.combo,
    score_after: State.score,
    player_hp: State.youHp,
    boss_hp: State.bossHp
  });

  // AI micro tip (play only)
  maybeAiTip();

  // update instantly
  const elapsedSec = (tMs - State.tStart) / 1000;
  const remainSec = Math.max(0, State.durationSec - elapsedSec);
  updateHUD(remainSec);
}

function judgeHit(rtMs, type) {
  const dp = DIFF[State.diff] || DIFF.normal;

  // base judgement windows (ms)
  const wPerfect = dp.wPerfectMs ?? 230;
  const wGood = dp.wGoodMs ?? 420;

  // fever multiplier
  const feverMul = State.feverOn ? (dp.feverScoreMul ?? 1.35) : 1;

  // base score and damage
  let grade = 'good';
  let scoreDelta = 0;
  let bossDmg = 0;
  let youDmg = 0;
  let feverDelta = 0;

  // special target types
  if (type === 'bomb') {
    grade = 'bomb';
    scoreDelta = -Math.round(22 * dp.scoreMul);
    youDmg = Math.round(12 * dp.youDmg);
    bossDmg = 0;
    feverDelta = -0.22;
    return { grade, scoreDelta, bossDmg, youDmg, feverDelta };
  }
  if (type === 'decoy') {
    // decoy: not a full miss, but hurts combo/tempo
    const p = (rtMs <= wPerfect) ? 'perfect' : (rtMs <= wGood ? 'good' : 'bad');
    grade = (p === 'bad') ? 'bad' : p; // allow perfect/good
    scoreDelta = (p === 'perfect') ? Math.round(6 * dp.scoreMul * feverMul)
              : (p === 'good') ? Math.round(3 * dp.scoreMul * feverMul)
              : -Math.round(10 * dp.scoreMul);
    bossDmg = (p === 'bad') ? 0 : Math.round(4 * dp.bossDmg * (p === 'perfect' ? 1.2 : 1) * (State.feverOn ? 1.12 : 1));
    youDmg = (p === 'bad') ? Math.round(6 * dp.youDmg) : 0;
    feverDelta = (p === 'perfect') ? 0.10 : (p === 'good' ? 0.06 : -0.12);
    return { grade, scoreDelta, bossDmg, youDmg, feverDelta };
  }
  if (type === 'heal') {
    grade = 'heal';
    scoreDelta = Math.round(4 * dp.scoreMul);
    bossDmg = 0;
    youDmg = 0;
    feverDelta = 0.08;
    return { grade, scoreDelta, bossDmg, youDmg, feverDelta, healHp: Math.round(12) };
  }
  if (type === 'shield') {
    grade = 'shield';
    scoreDelta = Math.round(4 * dp.scoreMul);
    bossDmg = 0;
    youDmg = 0;
    feverDelta = 0.08;
    return { grade, scoreDelta, bossDmg, youDmg, feverDelta, addShield: 1 };
  }

  // bossface behaves like normal but bigger reward
  const isBossFace = (type === 'bossface');

  // normal judgement by RT
  if (rtMs <= wPerfect) grade = 'perfect';
  else if (rtMs <= wGood) grade = 'good';
  else grade = 'bad';

  if (grade === 'perfect') {
    scoreDelta = Math.round((isBossFace ? 20 : 12) * dp.scoreMul * feverMul);
    bossDmg = Math.round((isBossFace ? 24 : 14) * dp.bossDmg * (State.feverOn ? 1.25 : 1));
    feverDelta = isBossFace ? 0.18 : 0.12;
  } else if (grade === 'good') {
    scoreDelta = Math.round((isBossFace ? 12 : 8) * dp.scoreMul * feverMul);
    bossDmg = Math.round((isBossFace ? 14 : 9) * dp.bossDmg * (State.feverOn ? 1.15 : 1));
    feverDelta = isBossFace ? 0.12 : 0.08;
  } else {
    scoreDelta = -Math.round((isBossFace ? 14 : 10) * dp.scoreMul);
    bossDmg = 0;
    youDmg = Math.round((isBossFace ? 10 : 7) * dp.youDmg);
    feverDelta = -0.12;
  }

  return { grade, scoreDelta, bossDmg, youDmg, feverDelta };
}

function applyBossDamage(dmg, type) {
  const n = Math.max(0, Math.round(Number(dmg) || 0));
  if (n <= 0) return 0;

  // boss shield reduces incoming
  let actual = n;
  if ((State.bossShield || 0) > 0) {
    // each shield point absorbs a chunk
    const absorb = Math.min(actual, 6);
    actual = Math.max(0, actual - absorb);
    State.bossShield = Math.max(0, (State.bossShield || 0) - 1);
    if (actual <= 0) {
      setMsg('BOSS SHIELD!', 'miss');
      // log block
      eventLogger.add({
        ts_ms: Date.now(),
        mode: State.mode,
        diff: State.diff,
        boss_index: State.bossIndex,
        boss_phase: State.phaseIndex + 1,
        target_id: '',
        target_type: type || '',
        is_boss_face: type === 'bossface' ? 1 : 0,
        event_type: 'boss_shield_block',
        rt_ms: '',
        grade: 'boss_shield_block',
        score_delta: 0,
        combo_after: State.combo,
        score_after: State.score,
        player_hp: State.youHp,
        boss_hp: State.bossHp
      });
      return 0;
    }
  }

  State.bossHp = clamp(State.bossHp - actual, 0, State.bossHpMax);
  return actual;
}

function nextBossOrPhase() {
  const boss = BOSSES[State.bossIndex];
  if (!boss) return;

  // clear current boss
  State.bossCleared += 1;

  // advance boss index
  State.bossIndex += 1;
  if (State.bossIndex >= BOSSES.length) {
    // win
    endGame('win_all_bosses');
    return;
  }

  // set new boss with phase 1
  State.phaseIndex = 0;
  const nb = BOSSES[State.bossIndex];
  const ph = nb.phases[State.phaseIndex];

  State.bossHpMax = ph.bossHp;
  State.bossHp = ph.bossHp;
  State.bossShield = 0;
  State._bossFaceShown = false;

  // reset skill flags for new boss
  State.skillFlags = {};

  syncBossUI();
  setMsg(`บอสถัดไป: ${nb.name} ${nb.emoji}`, 'good');

  // spawn delay
  State.nextSpawnAt = (State.tNow || nowMs()) + 520;
}

// ===============================
// AI micro-tip (DL-lite predictor)
// ===============================
let _aiLastTipAt = 0;

function maybeAiTip() {
  // locked in research mode
  if (State.mode === 'research') return;
  // allow only when ?ai=1 (or by design you can flip to true)
  if (!WIN.RB_AI || typeof WIN.RB_AI.isAssistEnabled !== 'function') return;
  if (!WIN.RB_AI.isAssistEnabled()) return;

  const t = nowMs();
  if (t - _aiLastTipAt < 1600) return;

  const elapsedSec = (t - State.tStart) / 1000;
  if (elapsedSec < 6) return;

  const accPct = State.totalJudged > 0 ? (State.totalHits / State.totalJudged) * 100 : 0;

  const snap = {
    accPct,
    hitMiss: State.miss,
    combo: State.combo,
    hp: State.youHpMax ? (State.youHp / State.youHpMax) * 100 : 100,
    offsetAbsMean: '', // not used here
    songTime: elapsedSec,
    durationSec: State.durationSec
  };

  const p = WIN.RB_AI.predict(snap);
  if (!p || !p.tip) return;

  _aiLastTipAt = t;

  // show subtle tip near top center
  FxBurstSafeText(window.innerWidth * 0.5, window.innerHeight * 0.14, p.tip, 'sb-fx-tip');
}

// ===============================
// FX safe wrappers (in case FxBurst isn't ready)
// ===============================
function FxBurstSafeBurst(x, y, cls) {
  try {
    if (FxBurst && typeof FxBurst.burst === 'function') FxBurst.burst(x, y, { n: 10, spread: 58, ttlMs: 560, cls });
  } catch {}
}
function FxBurstSafeText(x, y, text, cls) {
  try {
    if (FxBurst && typeof FxBurst.popText === 'function') FxBurst.popText(x, y, text, cls);
  } catch {}
}

// ===============================
// Grade compute
// ===============================
function computeGrade(s) {
  const acc = Number(s.accPct) || 0;
  const miss = Number(s.miss) || 0;
  const combo = Number(s.maxCombo) || 0;
  const cleared = Number(s.bossCleared) || 0;

  // simple rubric
  let g = 'C';
  if (cleared >= 3 && acc >= 88 && miss <= 6 && combo >= 18) g = 'SSS';
  else if (cleared >= 2 && acc >= 84 && miss <= 9 && combo >= 14) g = 'SS';
  else if (cleared >= 2 && acc >= 78 && miss <= 12) g = 'S';
  else if (acc >= 70 && miss <= 16) g = 'A';
  else if (acc >= 58) g = 'B';
  else g = 'C';
  return g;
}

// ... (Part 3 ends here)