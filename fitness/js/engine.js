/* === Shadow Breaker Engine — PRODUCTION (Pack D) ===
   ✅ Mode: normal/research
   ✅ Diff: easy/normal/hard
   ✅ Boss phases + HP
   ✅ Shield pickups + FEVER
   ✅ Miss tracking (meta + HUD)
   ✅ AI: Director + Coach + DL-lite predictor (play only)
   ✅ Pack D: PatternGenerator (designed spawn), FxBurst (juice), Rival meter
*/

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { SessionLogger } from './session-logger.js';
import { EventLogger } from './event-logger.js';
import { StatsStore } from './stats-store.js';

import { AIDirector } from './ai-director.js';
import { AICoach } from './ai-coach.js';
import { DllitePredictor } from './ai-dl-lite.js';
import { PatternGenerator } from './ai-pattern.js';
import { FxBurst } from './fx-burst.js';

// ===== UI refs =====
let viewMenu, viewPlay;
let btnModeNormal, btnModeResearch, modeDesc, researchBox;
let btnStart, btnHow, howBox;
let btnExit;

let diffSel, timeInput;
let inputPartId, inputPartGroup, inputPartNote;

let statTime, statScore, statCombo, statPhase, statMiss, statShield;
let metaMiss;

let rivalBar, rivalText;

let metaDiff, metaMode;
let nowText, tipText;
let coachText;
let feedbackEl;

let metaRt, metaAcc, metaStyle;

let playerHpBar, bossHpBar, bossNameEl;
let feverFill, feverText;

let renderer = null;
let state = null;

const urlParams = new URL(location.href).searchParams;
const AI_QUERY = urlParams.get('ai');
const SEED_QUERY = urlParams.get('seed');
const SESSION_SEED = (SEED_QUERY != null && SEED_QUERY !== '') ? Number(SEED_QUERY) : Date.now();

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nowMs = () => performance.now();

// ===== config =====
const BOSSES = [
  { name: 'Shadow Ogre', emoji: '👹', hp: 240 },
  { name: 'Neon Wraith', emoji: '👻', hp: 280 },
  { name: 'Void Titan',  emoji: '🧟', hp: 330 }
];

const TARGETS = {
  normal: ['🎯','🥊','⚡','💎'],
  decoy:  ['💣','🧨','🕳️','🧊'],
  shield: ['🛡️'],
  heal:   ['💙']
};

const SCORE = {
  perfect: 120,
  good: 80,
  ok: 50,
  miss: -20,
  bossface: 160
};

function getDifficulty(key) {
  const diff = (key || 'normal').toLowerCase();
  if (diff === 'easy') {
    return {
      key: 'easy',
      spawnMs: 780,
      targetLifeMs: 1350,
      sizePx: 132,
      decoyRate: 0.06,
      shieldRate: 0.08,
      healRate: 0.05,
      bossFaceRate: 0.10,
      feverGain: 0.11,
      feverDrain: 0.04
    };
  }
  if (diff === 'hard') {
    return {
      key: 'hard',
      spawnMs: 520,
      targetLifeMs: 980,
      sizePx: 112,
      decoyRate: 0.20,
      shieldRate: 0.07,
      healRate: 0.04,
      bossFaceRate: 0.16,
      feverGain: 0.13,
      feverDrain: 0.05
    };
  }
  return {
    key: 'normal',
    spawnMs: 640,
    targetLifeMs: 1120,
    sizePx: 120,
    decoyRate: 0.12,
    shieldRate: 0.08,
    healRate: 0.05,
    bossFaceRate: 0.13,
    feverGain: 0.12,
    feverDrain: 0.045
  };
}

// ===== init =====
initShadowBreaker();

function initShadowBreaker() {
  // views
  viewMenu = document.getElementById('sb-view-menu');
  viewPlay = document.getElementById('sb-view-play');

  // buttons
  btnModeNormal = document.getElementById('sb-btn-mode-normal');
  btnModeResearch = document.getElementById('sb-btn-mode-research');
  modeDesc = document.getElementById('sb-mode-desc');
  researchBox = document.getElementById('sb-research-box');

  btnStart = document.getElementById('sb-btn-start');
  btnHow = document.getElementById('sb-btn-how');
  howBox = document.getElementById('sb-howbox');
  btnExit = document.getElementById('sb-btn-exit');

  // controls
  diffSel = document.getElementById('sb-diff');
  timeInput = document.getElementById('sb-time');

  inputPartId = document.getElementById('sb-participant-id');
  inputPartGroup = document.getElementById('sb-participant-group');
  inputPartNote = document.getElementById('sb-participant-note');

  // HUD
  statTime = document.getElementById('sb-text-time');
  statScore = document.getElementById('sb-text-score');
  statCombo = document.getElementById('sb-text-combo');
  statPhase = document.getElementById('sb-text-phase');
  statMiss = document.getElementById('sb-text-miss');
  metaMiss = document.getElementById('sb-meta-miss');

  rivalBar = document.getElementById('sb-rival-bar');
  rivalText = document.getElementById('sb-text-rival');

  statShield = document.getElementById('sb-text-shield');
  metaDiff = document.getElementById('sb-meta-diff');
  metaMode = document.getElementById('sb-meta-mode');

  nowText = document.getElementById('sb-now-text');
  tipText = document.getElementById('sb-tip');
  coachText = document.getElementById('sb-coach-text');
  feedbackEl = document.getElementById('sb-feedback');

  metaRt = document.getElementById('sb-meta-rt');
  metaAcc = document.getElementById('sb-meta-acc');
  metaStyle = document.getElementById('sb-meta-style');

  playerHpBar = document.getElementById('sb-player-hp');
  bossHpBar = document.getElementById('sb-boss-hp');
  bossNameEl = document.getElementById('sb-boss-name');

  feverFill = document.getElementById('sb-fever-fill');
  feverText = document.getElementById('sb-fever-text');

  // events
  btnModeNormal.addEventListener('click', () => setMode('normal'));
  btnModeResearch.addEventListener('click', () => setMode('research'));
  btnHow.addEventListener('click', () => {
    howBox.classList.toggle('sb-hide');
  });

  btnStart.addEventListener('click', () => {
    const mode = getMode();
    const diffKey = diffSel.value || 'normal';
    const t = clamp(parseInt(timeInput.value || '70', 10), 30, 300);

    if (mode === 'research') {
      const pid = (inputPartId.value || '').trim();
      if (!pid) {
        alert('กรุณากรอก Participant ID');
        return;
      }
    }

    startGame({ mode, diffKey, durationSec: t });
  });

  btnExit.addEventListener('click', () => stopGame(true));

  // default
  setMode('normal');
  showView('menu');
}

function showView(which) {
  if (which === 'menu') {
    viewMenu.classList.add('sb-view--active');
    viewPlay.classList.remove('sb-view--active');
  } else {
    viewMenu.classList.remove('sb-view--active');
    viewPlay.classList.add('sb-view--active');
  }
}

function getMode() {
  return viewMenu.dataset.mode || 'normal';
}

function setMode(mode) {
  const m = (mode === 'research') ? 'research' : 'normal';
  viewMenu.dataset.mode = m;

  btnModeNormal.classList.toggle('sb-mode--active', m === 'normal');
  btnModeResearch.classList.toggle('sb-mode--active', m === 'research');

  if (m === 'research') {
    researchBox.classList.remove('sb-hide');
    modeDesc.textContent = 'Research: บันทึก CSV (Session/Event) สำหรับงานวิจัย (พัก Google Sheet ไว้ก่อน)';
  } else {
    researchBox.classList.add('sb-hide');
    modeDesc.textContent = 'Normal: สำหรับเล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
  }
}

// ===== renderer helpers =====
function ensureRenderer() {
  if (renderer) return renderer;
  const layer = document.getElementById('sb-target-layer');
  renderer = new DomRendererShadow(layer);
  renderer.setOnHit((id, x, y) => handleTargetHit(id, { clientX: x, clientY: y }));
  return renderer;
}

// ===== core game =====
function startGame(opts) {
  stopGame(false);

  const diff = getDifficulty(opts.diffKey);
  const mode = opts.mode || 'normal';
  const durationSec = clamp(Number(opts.durationSec) || 70, 30, 300);

  const bossIndex = 0;
  const bossMeta = BOSSES[bossIndex];

  state = {
    mode,
    diffKey: diff.key,
    durationSec,
    startedAt: nowMs(),
    timeLeftMs: durationSec * 1000,

    score: 0,
    combo: 0,
    hits: 0,
    attempts: 0,
    miss: 0,
    shield: 0,

    fever01: 0,
    feverActive: false,
    feverLastTick: nowMs(),

    bossIndex,
    bossPhase: 1,
    bossHp: bossMeta.hp,
    bossHpMax: bossMeta.hp,
    playerHp: 100,
    playerHpMax: 100,

    nextSpawnAt: nowMs() + 350,
    activeTargets: new Map(), // id -> { bornAt, lifeMs, type, isBossFace }

    // analytics
    lastHitAt: 0,
    lastRtMs: null,
    emaRt: null,
    emaAcc: null,
    rtGoodCount: 0,
    rtDecoyCount: 0,
    seed: SESSION_SEED,
    pattern: new PatternGenerator(SESSION_SEED, { gridX: 5, gridY: 3 }),
    lastHitGrade: ''
  };

  // AI (play only)
  const aiEnabled = (AI_QUERY === '1') && (mode === 'normal');
  state.aiEnabled = aiEnabled;
  state.aiDirector = new AIDirector();
  state.aiCoach = new AICoach();
  state.aiPredictor = new DllitePredictor();

  state.sessionLogger = (mode === 'research') ? new SessionLogger() : null;
  state.eventLogger = (mode === 'research') ? new EventLogger() : null;
  state.statsStore = new StatsStore();

  if (metaDiff) metaDiff.textContent = diff.key;
  if (metaMode) metaMode.textContent = mode;

  resetHud();
  ensureRenderer().clear();
  showView('play');

  setFeedback('READY', true);
  nowText.textContent = 'GO!';
  tipText.textContent = 'ตีเป้าให้ไว! สะสม COMBO เพื่อ FEVER!';

  updateBossUi();
  updateFeverUi(state.startedAt);
  updateRivalUi();

  // start loop
  state._raf = requestAnimationFrame(gameLoop);

  // session open (research)
  if (state.sessionLogger) {
    const pid = (inputPartId.value || '').trim();
    const group = (inputPartGroup.value || '').trim();
    const note = (inputPartNote.value || '').trim();
    state.sessionLogger.open({
      ts_ms: Date.now(),
      participant_id: pid,
      group,
      note,
      mode,
      diff: diff.key,
      duration_sec: durationSec,
      seed: SESSION_SEED
    });
  }
}

function stopGame(goMenu) {
  if (!state) {
    if (goMenu) showView('menu');
    return;
  }
  if (state._raf) cancelAnimationFrame(state._raf);
  state._raf = null;

  // finalize logs (research) — local only for now
  if (state.sessionLogger) {
    state.sessionLogger.close({
      ts_ms: Date.now(),
      score: state.score,
      hits: state.hits,
      attempts: state.attempts,
      miss: state.miss,
      combo_max: state.comboMax || 0
    });
  }

  state = null;
  if (renderer) renderer.clear();

  if (goMenu) showView('menu');
}

function resetHud() {
  if (statTime) statTime.textContent = String(timeInput ? timeInput.value : '70');
  if (statScore) statScore.textContent = '0';
  if (statCombo) statCombo.textContent = '0';
  if (statPhase) statPhase.textContent = '1';
  if (statMiss) statMiss.textContent = '0';
  if (metaMiss) metaMiss.textContent = '0';
  if (statShield) statShield.textContent = '0';

  if (rivalBar) rivalBar.style.transform = 'scaleX(0)';
  if (rivalText) rivalText.textContent = '0%';

  if (metaRt) metaRt.textContent = '—';
  if (metaAcc) metaAcc.textContent = '—';
  if (metaStyle) metaStyle.textContent = 'mix';

  if (bossNameEl) bossNameEl.textContent = '—';
  if (playerHpBar) playerHpBar.style.transform = 'scaleX(1)';
  if (bossHpBar) bossHpBar.style.transform = 'scaleX(1)';

  if (feverFill) feverFill.style.transform = 'scaleX(0)';
  if (feverText) feverText.textContent = '0%';

  setFeedback('', true);
  if (coachText) coachText.textContent = '…';
}

function setFeedback(text, hidden) {
  if (!feedbackEl) return;
  if (hidden) {
    feedbackEl.classList.add('sb-hide');
    feedbackEl.textContent = '';
  } else {
    feedbackEl.classList.remove('sb-hide');
    feedbackEl.textContent = text;
  }
}

function updateBossUi() {
  if (!state) return;
  const boss = BOSSES[state.bossIndex];
  if (bossNameEl) bossNameEl.textContent = `${boss.emoji} ${boss.name}`;
  if (statPhase) statPhase.textContent = String(state.bossPhase);

  const p01 = clamp(state.playerHp / state.playerHpMax, 0, 1);
  const b01 = clamp(state.bossHp / state.bossHpMax, 0, 1);
  if (playerHpBar) playerHpBar.style.transform = `scaleX(${p01})`;
  if (bossHpBar) bossHpBar.style.transform = `scaleX(${b01})`;
}

function updateRivalUi() {
  if (!state || !rivalBar || !rivalText) return;
  const t01 = state.durationSec > 0 ? (1 - (state.timeLeftMs / (state.durationSec * 1000))) : 0;
  const diffK = state.diffKey || 'normal';
  const baseRate = diffK === 'easy' ? 120 : diffK === 'hard' ? 170 : 145; // points per second (approx)
  const expected = Math.max(1, Math.round(baseRate * (t01 * state.durationSec)));
  const ratio = Math.max(0, Math.min(2, state.score / expected));
  rivalBar.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio / 1.25))})`;

  const deltaPct = Math.round((ratio - 1) * 100);
  rivalText.textContent = (deltaPct >= 0 ? '+' : '') + deltaPct + '%';
  rivalText.style.opacity = '1';
}

function updateFeverUi(now) {
  if (!state) return;
  const v = clamp(state.fever01, 0, 1);
  if (feverFill) feverFill.style.transform = `scaleX(${v})`;
  if (feverText) feverText.textContent = Math.round(v * 100) + '%';
}

// ===== loop =====
function gameLoop(now) {
  if (!state) return;

  const dt = Math.max(0, now - state.startedAt);
  state.timeLeftMs = Math.max(0, (state.durationSec * 1000) - dt);

  if (statTime) statTime.textContent = String(Math.ceil(state.timeLeftMs / 1000));

  // FEVER drain/gain
  tickFever(now);

  // spawn
  if (now >= state.nextSpawnAt) {
    spawnOneTarget(now);
    scheduleNextSpawn(now);
  }

  // expire targets
  expireTargets(now);

  // update small analytics
  updateMetaUi();

  // update bars
  updateBossUi();
  updateFeverUi(now);
  updateRivalUi();

  // finish
  if (state.timeLeftMs <= 0 || state.playerHp <= 0 || state.bossHp <= 0) {
    endGame();
    return;
  }

  state._raf = requestAnimationFrame(gameLoop);
}

function tickFever(now) {
  if (!state) return;
  const diff = getDifficulty(state.diffKey);
  const dt = Math.max(0, now - state.feverLastTick);
  state.feverLastTick = now;

  const drain = diff.feverDrain * (dt / 1000);
  if (state.fever01 > 0) state.fever01 = Math.max(0, state.fever01 - drain);

  state.feverActive = state.fever01 >= 0.85;
}

function scheduleNextSpawn(now) {
  const diff = getDifficulty(state.diffKey);
  let base = diff.spawnMs;

  // fair adaptive pacing (AI director play only)
  if (state.aiEnabled && state.aiDirector) {
    base = state.aiDirector.adjustSpawnMs(base, {
      emaRt: state.emaRt,
      emaAcc: state.emaAcc,
      phase: state.bossPhase,
      feverActive: state.feverActive
    });
  }

  // fever speeds a bit
  if (state.feverActive) base *= 0.88;

  // clamp
  base = clamp(base, 340, 1100);
  state.nextSpawnAt = now + base;
}

// ===== spawning =====
let _idSeq = 1;

function spawnOneTarget(now) {
  const diff = getDifficulty(state.diffKey);

  // choose type
  const r = Math.random();
  let type = 'normal';

  // boss face chance (higher in later phase)
  const bossFaceChance = diff.bossFaceRate + (state.bossPhase - 1) * 0.03;
  if (r < bossFaceChance) {
    spawnBossFaceTarget(now);
    return;
  }

  // decoy / shield / heal
  const r2 = Math.random();
  if (r2 < diff.decoyRate) type = 'decoy';
  else if (r2 < diff.decoyRate + diff.shieldRate) type = 'shield';
  else if (r2 < diff.decoyRate + diff.shieldRate + diff.healRate) type = 'heal';

  spawnTargetOfType(type, now, diff);
}

function spawnBossFaceTarget(now) {
  const id = 't' + (_idSeq++);
  const diff = getDifficulty(state.diffKey);

  const bossMeta = BOSSES[state.bossIndex];

  const p = state.pattern ? state.pattern.next({ phase: state.bossPhase, diffKey: state.diffKey, t01: 1 - (state.timeLeftMs / (state.durationSec * 1000)), lastHitGrade: state.lastHitGrade }) : null;

  const data = {
    id,
    type: 'normal',
    isBossFace: true,
    emoji: bossMeta.emoji,
    bossEmoji: bossMeta.emoji,
    xPct: p ? p.xPct : undefined,
    yPct: p ? p.yPct : undefined,
    patternTag: p ? p.tag : '',
    bornAt: now,
    lifeMs: clamp(diff.targetLifeMs * 0.92, 520, 1600),
    sizePx: clamp(diff.sizePx * 1.02, 92, 190)
  };

  state.activeTargets.set(id, data);
  ensureRenderer().spawnTarget(data);

  logEvent('spawn', data, { tag: 'bossface' });
}

function spawnTargetOfType(type, now, diff, extra) {
  const id = 't' + (_idSeq++);
  const emoji = pickEmoji(type);

  const p = state.pattern ? state.pattern.next({ phase: state.bossPhase, diffKey: state.diffKey, t01: 1 - (state.timeLeftMs / (state.durationSec * 1000)), lastHitGrade: state.lastHitGrade }) : null;

  const data = {
    id,
    type,
    isBossFace: false,
    emoji,
    bossEmoji: extra && extra.bossEmoji,
    xPct: p ? p.xPct : undefined,
    yPct: p ? p.yPct : undefined,
    patternTag: p ? p.tag : '',
    bornAt: now,
    lifeMs: diff.targetLifeMs,
    sizePx: diff.sizePx
  };

  state.activeTargets.set(id, data);
  ensureRenderer().spawnTarget(data);

  logEvent('spawn', data, { tag: type });
}

function pickEmoji(type) {
  if (type === 'decoy') return TARGETS.decoy[Math.floor(Math.random() * TARGETS.decoy.length)];
  if (type === 'shield') return TARGETS.shield[0];
  if (type === 'heal') return TARGETS.heal[0];
  return TARGETS.normal[Math.floor(Math.random() * TARGETS.normal.length)];
}

function expireTargets(now) {
  for (const [id, t] of state.activeTargets.entries()) {
    const alive = (now - t.bornAt) <= t.lifeMs;
    if (!alive) {
      state.activeTargets.delete(id);
      ensureRenderer().despawn(id);

      // miss only if it was hittable normal/bossface (decoy expiring is fine)
      if (t.type !== 'decoy') {
        state.miss++;
        state.attempts++;
        state.combo = 0;
        if (statCombo) statCombo.textContent = String(state.combo);

        if (statMiss) statMiss.textContent = String(state.miss);
        if (metaMiss) metaMiss.textContent = String(state.miss);

        // damage player a bit (pressure)
        state.playerHp = Math.max(0, state.playerHp - (t.isBossFace ? 7 : 3));

        setFeedback('MISS', false);
        setTimeout(() => setFeedback('', true), 220);

        logEvent('miss', t, { reason: 'timeout' });
      } else {
        logEvent('despawn', t, { reason: 'timeout' });
      }
    }
  }
}

function handleTargetHit(id, hitInfo) {
  if (!state) return;
  const t = state.activeTargets.get(id);
  if (!t) return;

  // remove from scene
  state.activeTargets.delete(id);
  ensureRenderer().despawn(id);

  const now = nowMs();
  const rt = (t.bornAt != null) ? Math.max(0, Math.round(now - t.bornAt)) : null;

  let grade = 'ok';
  // simple timing grade
  if (rt != null) {
    if (rt <= 240) grade = 'perfect';
    else if (rt <= 360) grade = 'good';
    else grade = 'ok';
  }
  if (t.isBossFace) grade = 'perfect';

  // attempts/hits
  state.attempts++;
  if (t.type !== 'decoy') state.hits++;

  // combo
  if (t.type === 'decoy') {
    state.combo = 0;
    state.miss++;
    if (statMiss) statMiss.textContent = String(state.miss);
    if (metaMiss) metaMiss.textContent = String(state.miss);

    // penalty
    state.score = Math.max(0, state.score + SCORE.miss);
    state.playerHp = Math.max(0, state.playerHp - 5);
    setFeedback('DECOY!', false);
    setTimeout(() => setFeedback('', true), 240);

    logEvent('hit', t, { grade: 'decoy', rtMs: rt, scoreDelta: SCORE.miss });
    updateHud();
    return;
  }

  // rewards
  let scoreDelta = 0;
  if (grade === 'perfect') scoreDelta = SCORE.perfect;
  else if (grade === 'good') scoreDelta = SCORE.good;
  else scoreDelta = SCORE.ok;

  // fever bonus
  if (state.feverActive) scoreDelta = Math.round(scoreDelta * 1.25);

  // bossface bonus
  if (t.isBossFace) scoreDelta += 30;

  // apply
  state.score += scoreDelta;
  state.combo++;
  state.comboMax = Math.max(state.comboMax || 0, state.combo);

  // fever gain
  const diff = getDifficulty(state.diffKey);
  state.fever01 = Math.min(1, state.fever01 + diff.feverGain);

  // shield/heal
  if (t.type === 'shield') {
    state.shield = Math.min(5, state.shield + 1);
    scoreDelta += 20;
  } else if (t.type === 'heal') {
    state.playerHp = Math.min(state.playerHpMax, state.playerHp + 10);
    scoreDelta += 10;
  }

  // boss damage
  const dmg = t.isBossFace ? 14 : 9;
  state.bossHp = Math.max(0, state.bossHp - dmg);

  // phase transitions
  maybeAdvanceBossPhase();

  // analytics update
  updateEma(rt, t.type !== 'decoy');

  // feedback
  if (grade === 'perfect') setFeedback('PERFECT!', false);
  else if (grade === 'good') setFeedback('GREAT!', false);
  else setFeedback('HIT', false);
  setTimeout(() => setFeedback('', true), 180);

  state.lastHitGrade = grade;

  // Pack D: extra juice
  if (hitInfo && Number.isFinite(hitInfo.clientX) && Number.isFinite(hitInfo.clientY)) {
    if (grade === 'perfect' || grade === 'bossface') {
      FxBurst.burst(hitInfo.clientX, hitInfo.clientY, { count: 14, spread: 62 });
      FxBurst.popText(hitInfo.clientX, hitInfo.clientY - 6, '+ ' + scoreDelta, 'perfect');
    } else if (grade === 'good') {
      FxBurst.popText(hitInfo.clientX, hitInfo.clientY - 6, '+ ' + scoreDelta, 'good');
    } else {
      FxBurst.popText(hitInfo.clientX, hitInfo.clientY - 6, '+ ' + scoreDelta, '');
    }
  }

  logEvent('hit', t, { grade, rtMs: rt, scoreDelta });

  // AI coach (play only)
  if (state.aiEnabled && state.aiCoach && coachText) {
    const msg = state.aiCoach.maybeTip({
      emaRt: state.emaRt,
      emaAcc: state.emaAcc,
      combo: state.combo,
      miss: state.miss,
      phase: state.bossPhase,
      fever01: state.fever01
    });
    if (msg) coachText.textContent = msg;
  }

  updateHud();
}

function maybeAdvanceBossPhase() {
  const boss = BOSSES[state.bossIndex];
  const hp01 = state.bossHp / state.bossHpMax;

  const prevPhase = state.bossPhase;
  let nextPhase = 1;
  if (hp01 <= 0.66) nextPhase = 2;
  if (hp01 <= 0.33) nextPhase = 3;

  if (nextPhase !== prevPhase) {
    state.bossPhase = nextPhase;
    state.fever01 = Math.min(1, state.fever01 + 0.12);
    setFeedback('PHASE ' + nextPhase, false);
    setTimeout(() => setFeedback('', true), 240);
    logEvent('phase', { bossPhase: nextPhase }, {});
  }
}

function updateEma(rtMs, ok) {
  if (rtMs == null) return;

  // EMA RT
  const a = 0.15;
  state.emaRt = (state.emaRt == null) ? rtMs : (state.emaRt * (1 - a) + rtMs * a);

  // EMA accuracy proxy
  const acc = ok ? 1 : 0;
  state.emaAcc = (state.emaAcc == null) ? acc : (state.emaAcc * (1 - a) + acc * a);

  state.lastRtMs = rtMs;
}

function updateHud() {
  if (!state) return;
  if (statScore) statScore.textContent = String(state.score);
  if (statCombo) statCombo.textContent = String(state.combo);
  if (statShield) statShield.textContent = String(state.shield);

  if (statMiss) statMiss.textContent = String(state.miss);
  if (metaMiss) metaMiss.textContent = String(state.miss);
}

function updateMetaUi() {
  if (!state) return;

  // RT / ACC
  if (metaRt) metaRt.textContent = (state.lastRtMs != null) ? (Math.round(state.lastRtMs) + 'ms') : '—';

  const acc01 = (state.attempts > 0) ? (state.hits / state.attempts) : null;
  if (metaAcc) metaAcc.textContent = (acc01 == null) ? '—' : (Math.round(acc01 * 100) + '%');

  // style: simplistic label
  let style = 'mix';
  if ((state.emaRt != null) && state.emaRt < 280 && acc01 != null && acc01 > 0.85) style = 'rush';
  if (state.miss > 8 && state.combo < 3) style = 'steady';
  if (metaStyle) metaStyle.textContent = style;
}

function endGame() {
  if (!state) return;

  // store summary
  const summary = {
    ts_ms: Date.now(),
    mode: state.mode,
    diff: state.diffKey,
    duration_sec: state.durationSec,
    score: state.score,
    hits: state.hits,
    attempts: state.attempts,
    miss: state.miss,
    combo_max: state.comboMax || 0,
    phase: state.bossPhase,
    boss_hp_end: state.bossHp,
    player_hp_end: state.playerHp
  };

  if (state.statsStore) state.statsStore.push(summary);

  nowText.textContent = 'FINISH';
  tipText.textContent = `Score ${state.score} | Hits ${state.hits}/${state.attempts} | Miss ${state.miss} | MaxCombo ${state.comboMax || 0}`;
  if (coachText) coachText.textContent = 'จบเกมแล้ว — ถ้าจะให้เดือดขึ้น ลอง Hard + ai=1';

  setFeedback('RESULT SAVED (LOCAL)', false);
  setTimeout(() => setFeedback('', true), 900);

  stopGame(true);
}

// ===== logging =====
function logEvent(eventType, target, extra) {
  if (!state || !state.eventLogger) return;

  const row = Object.assign({
    ts_ms: Date.now(),
    mode: state.mode,
    diff: state.diffKey,
    boss_index: state.bossIndex,
    boss_phase: state.bossPhase,
    event_type: eventType,
    score_after: state.score,
    combo_after: state.combo,
    player_hp: state.playerHp,
    boss_hp: state.bossHp,
    miss: state.miss,
    shield: state.shield,
    fever01: Math.round(state.fever01 * 100) / 100
  }, extra || {});

  if (target && typeof target === 'object') {
    if (target.id) row.target_id = target.id;
    if (target.type) row.target_type = target.type;
    if (target.isBossFace) row.is_boss_face = 1;
    if (target.emoji) row.target_emoji = target.emoji;
    if (target.patternTag) row.pattern = target.patternTag;
    if (target.bornAt != null) row.target_born_ms = Math.round(target.bornAt);
    if (target.lifeMs != null) row.target_life_ms = Math.round(target.lifeMs);
  }

  state.eventLogger.add(row);
}
