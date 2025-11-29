// === js/engine.js — Shadow Breaker core (2025-12-05, 3-cols HUD + FX + CSV) ===
'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';
import { recordSession } from './stats-store.js';

// ----- DOM refs -----
let wrap;
let viewMenu, viewPlay, viewResult;
let targetLayer;
let feedbackEl;
let feverFill, feverStatus;
let hpYouTop, hpBossTop;
let statTime, statScore, statCombo, statPhase, statMiss, statShield;

// panel ซ้าย "สถิติเกมนี้"
let panelScore, panelMaxCombo, panelMiss, panelShield;

// boss info ขวา
let bossNameTop;
let bossEmojiSide, bossNameSide, bossDescSide;
let bossPhaseSide, bossShieldSide;

// controls
let diffSel, timeSel;
let btnPlay, btnResearch, btnBackFromPlay;
let btnPauseToggle, btnResultRetry, btnResultMenu;
let btnDlEvents, btnDlSessions;

// result labels
let resTime, resScore, resMaxCombo, resMissRes, resPhaseRes, resGrade, resAcc, resBosses;

// ----- config -----
const BOSSES = [
  { id: 0, name: 'Bubble Glove', emoji: '🐣', hint: 'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน' },
  { id: 1, name: 'Spark Guard',  emoji: '⚡️', hint: 'เล็งเป้าเร็ว ๆ ระวังลูกระเบิด' },
  { id: 2, name: 'Shadow Mitt',  emoji: '🕶️', hint: 'เป้าบางอันจะลวง ให้ดูจังหวะดี ๆ' },
  { id: 3, name: 'Galaxy Punch', emoji: '🌌', hint: 'ด่านสุดท้าย เป้าจะเล็กและเร็วมาก' }
];

const DIFF_CONFIG = {
  easy: {
    label: 'Easy — ผ่อนคลาย',
    spawnIntervalMin: 900,
    spawnIntervalMax: 1300,
    targetLifetime: 1400,
    baseSize: 140,
    bossDamageNormal: 0.04,
    bossDamageBossFace: 0.40,
    feverPerHit: 0.14
  },
  normal: {
    label: 'Normal — สมดุล',
    spawnIntervalMin: 750,
    spawnIntervalMax: 1150,
    targetLifetime: 1200,
    baseSize: 120,
    bossDamageNormal: 0.035,
    bossDamageBossFace: 0.36,
    feverPerHit: 0.11
  },
  hard: {
    label: 'Hard — ท้าทาย',
    spawnIntervalMin: 600,
    spawnIntervalMax: 950,
    targetLifetime: 1050,
    baseSize: 105,
    bossDamageNormal: 0.03,
    bossDamageBossFace: 0.32,
    feverPerHit: 0.09
  }
};

const FEVER_DECAY_PER_SEC = 0.12;
const FEVER_DURATION_MS = 7000;
const LOWHP_THRESHOLD = 0.3;
const BOSSFACE_THRESHOLD = 0.28;

// ----- runtime state -----
let renderer = null;
let state = null;
let spawnTimer = null;
let gameLoopId = null;
let menuOpenedAt = performance.now();
let wired = false;

// loggers
const eventLogger = new EventLogger();
const sessionLogger = new SessionLogger();

// ===== utilities =====
const randRange = (min, max) => min + Math.random() * (max - min);

function pickWeighted(weights) {
  const total = weights.reduce((acc, w) => acc + w.w, 0);
  let r = Math.random() * total;
  for (const item of weights) {
    if (r < item.w) return item.v;
    r -= item.w;
  }
  return weights[weights.length - 1].v;
}

const currentBoss = () =>
  BOSSES[state.bossIndex] || BOSSES[BOSSES.length - 1];

// ===== view / HUD =====
function showView(name) {
  viewMenu?.classList.remove('is-active');
  viewPlay?.classList.remove('is-active');
  viewResult?.classList.remove('is-active');

  if (name === 'menu')      viewMenu?.classList.add('is-active');
  else if (name === 'play') viewPlay?.classList.add('is-active');
  else if (name === 'result') viewResult?.classList.add('is-active');
}

function resetHud() {
  statTime && (statTime.textContent = '0.0 s');
  statScore && (statScore.textContent = '0');
  statCombo && (statCombo.textContent = '0');
  statPhase && (statPhase.textContent = '1');
  statMiss && (statMiss.textContent = '0');
  statShield && (statShield.textContent = '0');

  panelScore && (panelScore.textContent = '0');
  panelMaxCombo && (panelMaxCombo.textContent = '0');
  panelMiss && (panelMiss.textContent = '0');
  panelShield && (panelShield.textContent = '0');

  feverStatus && feverStatus.classList.remove('on');
  feverStatus && (feverStatus.textContent = 'READY');
  feverFill && (feverFill.style.transform = 'scaleX(0)');

  if (hpYouTop) hpYouTop.style.transform = 'scaleX(1)';
  if (hpBossTop) hpBossTop.style.transform = 'scaleX(1)';

  if (feedbackEl) {
    feedbackEl.textContent = 'แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!';
    feedbackEl.className = 'sb-msg-main';
  }
}

function setFeedback(msg, tone) {
  if (!feedbackEl) return;
  feedbackEl.textContent = msg;
  feedbackEl.className = 'sb-msg-main';
  if (tone) feedbackEl.classList.add(tone);
}

function updateHpBars() {
  const vPlayer = Math.max(0, Math.min(1, state.playerHp));
  const vBoss = Math.max(0, Math.min(1, state.bossHp));

  if (hpYouTop) hpYouTop.style.transform = `scaleX(${vPlayer})`;
  if (hpBossTop) hpBossTop.style.transform = `scaleX(${vBoss})`;
}

function updateFeverUi(now) {
  if (!feverFill) return;
  const v = Math.max(0, Math.min(1, state.fever));
  feverFill.style.transform = `scaleX(${v})`;

  if (state.feverOn && now >= state.feverUntil) {
    state.feverOn = false;
    if (feverStatus) {
      feverStatus.textContent = 'READY';
      feverStatus.classList.remove('on');
    }
  }
}

function updateBossUi() {
  const boss = currentBoss();
  if (wrap) {
    wrap.dataset.boss = String(boss.id);
    wrap.dataset.phase = String(state.bossPhase);
  }

  // ชื่อที่ HUD กลาง
  if (bossNameTop) bossNameTop.textContent = `${boss.name} ${boss.emoji}`;

  // การ์ดด้านขวา
  if (bossEmojiSide) bossEmojiSide.textContent = boss.emoji;
  if (bossNameSide) bossNameSide.textContent = boss.name;
  if (bossDescSide) bossDescSide.textContent = boss.hint;
  if (bossPhaseSide) bossPhaseSide.textContent = String(state.bossPhase);
  if (bossShieldSide) bossShieldSide.textContent = String(state.shield || 0);

  if (statPhase) statPhase.textContent = String(state.bossPhase);
}

// ===== renderer helpers =====
function ensureRenderer() {
  if (renderer) return renderer;
  renderer = new DomRendererShadow(targetLayer, {
    wrapEl: wrap,
    feedbackEl,
    onTargetHit: handleTargetHit
  });
  renderer.setDifficulty(state?.diffKey || 'normal');
  return renderer;
}

function clearRenderer() {
  if (renderer) {
    renderer.destroy();
    renderer = null;
  }
}

// ===== spawn targets =====
function spawnBossFaceTarget() {
  const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
  const bossMeta = currentBoss();
  const now = performance.now();
  const id = state.nextTargetId++;

  const data = {
    id,
    type: 'bossface',
    bossIndex: state.bossIndex,
    bossPhase: state.bossPhase,
    spawnTime: now,
    isBossFace: true,
    bossEmoji: bossMeta.emoji,
    sizePx: cfg.baseSize * 1.9,
    timeoutAt: now + cfg.targetLifetime * 1.4
  };

  state.targets.set(id, data);
  ensureRenderer().spawnTarget(data);

  data.timeoutHandle = setTimeout(() => {
    if (!state.running || !state.targets.has(id)) return;
    state.targets.delete(id);
    renderer?.removeTarget(id, 'timeout');

    // boss face พลาด = miss
    state.miss++;
    statMiss && (statMiss.textContent = String(state.miss));
    panelMiss && (panelMiss.textContent = String(state.miss));
    state.combo = 0;
    statCombo && (statCombo.textContent = '0');
    setFeedback('พลาดหน้า boss! รอบหน้าลองโฟกัสให้ทัน 💥', 'miss');
    logEvent('timeout', data, { grade: 'miss' });
  }, cfg.targetLifetime * 1.4);
}

function spawnTargetOfType(kind, extra) {
  const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
  const now = performance.now();
  const id = state.nextTargetId++;
  const ttl = cfg.targetLifetime;
  const size = (extra && extra.size) || cfg.baseSize;

  const data = {
    id,
    type: kind,
    bossIndex: state.bossIndex,
    bossPhase: state.bossPhase,
    spawnTime: now,
    isBossFace: extra?.isBossFace || false,
    bossEmoji: extra?.bossEmoji,
    sizePx: size,
    timeoutAt: now + ttl,
    isDecoy: kind === 'decoy',
    isBomb: kind === 'bomb',
    isHeal: kind === 'heal',
    isShield: kind === 'shield'
  };

  state.targets.set(id, data);
  ensureRenderer().spawnTarget(data);

  data.timeoutHandle = setTimeout(() => {
    if (!state || !state.running || !state.targets.has(id)) return;

    state.targets.delete(id);
    renderer?.removeTarget(id, 'timeout');

    const isRealMiss = data.type === 'normal';

    if (isRealMiss) {
      state.miss++;
      statMiss && (statMiss.textContent = String(state.miss));
      panelMiss && (panelMiss.textContent = String(state.miss));
      state.combo = 0;
      statCombo && (statCombo.textContent = '0');
      setFeedback('พลาดจังหวะ! ลองมองเป้าให้ชัดแล้วลองใหม่ 👀', 'miss');
      logEvent('timeout', data, { grade: 'miss' });
    } else {
      logEvent('timeout', data, { grade: 'skip' });
    }
  }, ttl);
}

function spawnOneTarget() {
  const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;

  // boss ใกล้ตาย → spawn bossface ก่อน
  if (!state.bossFaceSpawned && state.bossHp > 0 && state.bossHp <= BOSSFACE_THRESHOLD) {
    state.bossFaceSpawned = true;
    spawnBossFaceTarget();
    return;
  }

  const kind = pickWeighted([
    { v: 'normal', w: 70 },
    { v: 'decoy',  w: 10 },
    { v: 'bomb',   w: 8 },
    { v: 'heal',   w: 6 },
    { v: 'shield', w: 6 }
  ]);

  spawnTargetOfType(kind, { size: cfg.baseSize });
}

function scheduleNextSpawn() {
  if (!state || !state.running) return;
  const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
  const delay = randRange(cfg.spawnIntervalMin, cfg.spawnIntervalMax);
  spawnTimer = setTimeout(() => {
    if (!state || !state.running) return;
    spawnOneTarget();
    scheduleNextSpawn();
  }, delay);
}

// ===== hit / miss =====
function applyHitToBoss(amount) {
  state.bossHp = Math.max(0, state.bossHp - amount);
  const prevPhase = state.bossPhase;

  if (state.bossHp > 0.66) state.bossPhase = 1;
  else if (state.bossHp > 0.33) state.bossPhase = 2;
  else state.bossPhase = 3;

  if (state.bossPhase !== prevPhase) updateBossUi();
  updateHpBars();

  if (state.bossHp <= 0) {
    state.clearedBosses++;
    state.bossIndex++;
    if (state.bossIndex >= BOSSES.length) {
      endGame('all-boss-cleared');
    } else {
      state.bossHp = 1;
      state.bossPhase = 1;
      state.bossFaceSpawned = false;
      updateBossUi();
    }
  }
}

function handleTargetHit(id, hitInfo) {
  if (!state || !state.running) return;
  const data = state.targets.get(id);
  if (!data) return;

  state.targets.delete(id);
  if (data.timeoutHandle) clearTimeout(data.timeoutHandle);

  const now = performance.now();
  const rt = now - data.spawnTime;

  let grade = 'good';
  let scoreDelta = 100;
  let hpDeltaPlayer = 0;
  let bossDmg = 0;
  let shieldDelta = 0;

  if (data.type === 'bomb' || data.type === 'decoy') {
    grade = 'bomb';
    scoreDelta = -80;
    if (state.shield > 0) {
      shieldDelta = -1;
      setFeedback('เกราะช่วยไว้! แต่ระวังเป้าลวงให้ดี 👀', 'bad');
    } else {
      hpDeltaPlayer = -0.17;
      setFeedback('โดนระเบิด! HP ลดลง รีบตั้งหลักใหม่ 💥', 'bad');
    }
    state.combo = 0;
  } else if (data.type === 'heal') {
    grade = 'heal';
    scoreDelta = 60;
    hpDeltaPlayer = +0.15;
    setFeedback('เยี่ยม! ได้ HP เพิ่มขึ้น 🩹', 'good');
    state.combo++;
  } else if (data.type === 'shield') {
    grade = 'shield';
    scoreDelta = 60;
    shieldDelta = +1;
    setFeedback('ได้เกราะเพิ่ม ต้านระเบิดได้ชั่วคราว 🛡️', 'good');
    state.combo++;
  } else if (data.isBossFace) {
    grade = 'perfect';
    scoreDelta = 260;
    bossDmg = (DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal).bossDamageBossFace;
    setFeedback('หมัดเด็ดใส่หน้าบอส! 💥', 'perfect');
    state.combo++;
  } else {
    // normal
    if (rt < 220) {
      grade = 'perfect';
      scoreDelta = 170;
    } else if (rt < 480) {
      grade = 'good';
      scoreDelta = 130;
    } else {
      grade = 'bad';
      scoreDelta = 70;
    }
    bossDmg = (DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal).bossDamageNormal;
    state.combo++;
    setFeedback(
      grade === 'perfect'
        ? 'สุดยอด! PERFECT 🎯'
        : grade === 'good'
        ? 'เยี่ยม! จังหวะกำลังดี 👍'
        : 'ช้าไปนิด ลองเร่งอีกนิดนะ 🔄',
      grade
    );
  }

  // FEVER
  if (data.type === 'normal') {
    const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
    state.fever += cfg.feverPerHit;
    if (!state.feverOn && state.fever >= 1) {
      state.feverOn = true;
      state.feverUntil = now + FEVER_DURATION_MS;
      state.fever = 1;
      feverStatus && (feverStatus.textContent = 'ON');
      feverStatus && feverStatus.classList.add('on');
    }
  }

  // fever bonus
  if (state.feverOn) {
    scoreDelta = Math.round(scoreDelta * 1.5);
    bossDmg *= 1.25;
  }

  // apply
  state.score = Math.max(0, state.score + scoreDelta);
  if (hpDeltaPlayer !== 0) {
    state.playerHp = Math.max(0, Math.min(1, state.playerHp + hpDeltaPlayer));
  }
  if (shieldDelta !== 0) {
    state.shield = Math.max(0, state.shield + shieldDelta);
  }
  if (bossDmg > 0) {
    applyHitToBoss(bossDmg);
  }
  state.totalHits++;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;

  statScore && (statScore.textContent = String(state.score));
  statCombo && (statCombo.textContent = String(state.combo));
  statShield && (statShield.textContent = String(state.shield));

  panelScore && (panelScore.textContent = String(state.score));
  panelMaxCombo && (panelMaxCombo.textContent = String(state.maxCombo));
  panelShield && (panelShield.textContent = String(state.shield));
  bossShieldSide && (bossShieldSide.textContent = String(state.shield));

  updateHpBars();
  updateFeverUi(now);

  renderer?.playHitFx(id, {
    grade,
    scoreDelta,
    clientX: hitInfo?.clientX,
    clientY: hitInfo?.clientY
  });
  renderer?.removeTarget(id, 'hit');

  logEvent('hit', data, { grade, rtMs: rt, scoreDelta });

  if (state.playerHp <= 0) {
    endGame('player-dead');
  }
}

// ===== logging / loop =====
function logEvent(type, targetData, extra) {
  const now = performance.now();
  const row = {
    ts_ms: Math.round(now - state.startedAt),
    mode: state.mode,
    diff: state.diffKey,
    boss_index: state.bossIndex,
    boss_phase: state.bossPhase,
    target_id: targetData ? targetData.id : '',
    target_type: targetData ? targetData.type : '',
    is_boss_face: targetData ? !!targetData.isBossFace : '',
    event_type: type,
    rt_ms: extra?.rtMs != null ? Math.round(extra.rtMs) : '',
    grade: extra?.grade || '',
    score_delta: extra?.scoreDelta ?? '',
    combo_after: state.combo,
    score_after: state.score,
    player_hp: state.playerHp.toFixed(3),
    boss_hp: state.bossHp.toFixed(3)
  };
  eventLogger.add(row);

  if (type === 'hit') {
    if (targetData.type === 'decoy') {
      state.rtDecoySum += extra.rtMs;
      state.rtDecoyCount++;
    } else if (!targetData.isBossFace && targetData.type === 'normal') {
      state.rtNormalSum += extra.rtMs;
      state.rtNormalCount++;
    }
  }
}

function gameLoop(now) {
  if (!state || !state.running) return;

  const elapsed = now - state.lastTickAt;
  state.lastTickAt = now;
  state.timeLeftMs -= elapsed;

  if (state.fever > 0 && !state.feverOn) {
    state.fever = Math.max(0, state.fever - FEVER_DECAY_PER_SEC * (elapsed / 1000));
  }
  if (state.feverOn) state.feverActiveMs += elapsed;
  if (state.playerHp <= LOWHP_THRESHOLD) state.lowHpMs += elapsed;

  if (state.timeLeftMs <= 0) {
    statTime && (statTime.textContent = '0.0 s');
    endGame('time-up');
    return;
  }

  statTime && (statTime.textContent = (state.timeLeftMs / 1000).toFixed(1) + ' s');
  updateFeverUi(now);

  // safety timeout
  const nowTargets = Array.from(state.targets.values());
  for (const t of nowTargets) {
    if (now >= t.timeoutAt) {
      if (t.timeoutHandle) clearTimeout(t.timeoutHandle);
      state.targets.delete(t.id);
      renderer?.removeTarget(t.id, 'timeout');

      const isRealMiss = t.type === 'normal' || t.isBossFace;
      if (isRealMiss) {
        state.miss++;
        statMiss && (statMiss.textContent = String(state.miss));
        panelMiss && (panelMiss.textContent = String(state.miss));
        state.combo = 0;
        statCombo && (statCombo.textContent = '0');
        logEvent('timeout', t, { grade: 'miss' });
      } else {
        logEvent('timeout', t, { grade: 'skip' });
      }
    }
  }

  gameLoopId = requestAnimationFrame(gameLoop);
}

// ===== end game =====
function gradeFromScoreAcc(score, acc) {
  if (score >= 3500 && acc >= 96) return 'SSS';
  if (score >= 2800 && acc >= 92) return 'SS';
  if (score >= 2200 && acc >= 88) return 'S';
  if (score >= 1600 && acc >= 80) return 'A';
  if (score >= 1000 && acc >= 70) return 'B';
  return 'C';
}

function endGame(reason) {
  if (!state || !state.running) return;
  state.running = false;

  if (spawnTimer) {
    clearTimeout(spawnTimer);
    spawnTimer = null;
  }
  if (gameLoopId) {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
  }

  if (renderer) {
    for (const id of state.targets.keys()) {
      renderer.removeTarget(id, 'end');
    }
  }
  state.targets.clear();

  const totalTrials = state.totalHits + state.miss;
  const acc = totalTrials > 0 ? (state.totalHits / totalTrials) * 100 : 0;

  const summary = {
    mode: state.mode,
    diff: state.diffKey,
    diff_label: DIFF_CONFIG[state.diffKey].label,
    reason,
    duration_sec: state.durationSec,
    time_left_sec: +(state.timeLeftMs / 1000).toFixed(2),
    score: state.score,
    accuracy_pct: +acc.toFixed(2),
    max_combo: state.maxCombo,
    total_hits: state.totalHits,
    miss: state.miss,
    fever_time_sec: +(state.feverActiveMs / 1000).toFixed(2),
    lowhp_time_sec: +(state.lowHpMs / 1000).toFixed(2),
    bosses_cleared: state.clearedBosses,
    menu_latency_ms: Math.round(state.startedAt - menuOpenedAt),
    rt_normal_ms: state.rtNormalCount ? +(state.rtNormalSum / state.rtNormalCount).toFixed(1) : '',
    rt_decoy_ms: state.rtDecoyCount ? +(state.rtDecoySum / state.rtDecoyCount).toFixed(1) : ''
  };

  sessionLogger.add(summary);
  recordSession('shadow-breaker', summary);

  // อัปเดตหน้า result
  resTime && (resTime.textContent = summary.duration_sec.toFixed(1));
  resScore && (resScore.textContent = String(summary.score));
  resMaxCombo && (resMaxCombo.textContent = String(summary.max_combo));
  resMissRes && (resMissRes.textContent = String(summary.miss));
  resPhaseRes && (resPhaseRes.textContent = String(state.bossPhase));
  resAcc && (resAcc.textContent = summary.accuracy_pct.toFixed(1) + ' %');
  resBosses && (resBosses.textContent = String(summary.bosses_cleared));

  const g = gradeFromScoreAcc(summary.score, summary.accuracy_pct);
  resGrade && (resGrade.textContent = g);

  showView('result');
}

// ===== start game =====
function startGame(mode) {
  const diffKey = (diffSel && diffSel.value) || 'normal';
  const durationSec = parseInt((timeSel && timeSel.value) || '60', 10) || 60;
  DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;

  clearRenderer();
  resetHud();
  eventLogger.clear();

  state = {
    mode: mode || 'play',
    diffKey,
    durationSec,
    running: true,
    timeLeftMs: durationSec * 1000,
    score: 0,
    combo: 0,
    maxCombo: 0,
    miss: 0,
    shield: 0,
    fever: 0,
    feverOn: false,
    feverUntil: 0,
    feverActiveMs: 0,
    lowHpMs: 0,
    playerHp: 1,
    bossHp: 1,
    bossIndex: 0,
    bossPhase: 1,
    bossFaceSpawned: false,
    clearedBosses: 0,
    totalHits: 0,
    targets: new Map(),
    nextTargetId: 1,
    startedAt: performance.now(),
    lastTickAt: performance.now(),
    rtNormalSum: 0,
    rtNormalCount: 0,
    rtDecoySum: 0,
    rtDecoyCount: 0
  };

  if (wrap) {
    wrap.dataset.diff = diffKey;
    wrap.dataset.phase = '1';
    wrap.dataset.boss = '0';
  }

  ensureRenderer().setDifficulty(diffKey);
  updateBossUi();
  updateHpBars();
  updateFeverUi(state.startedAt);

  showView('play');
  state.lastTickAt = performance.now();
  gameLoopId = requestAnimationFrame(gameLoop);
  scheduleNextSpawn();
}

// ===== CSV download =====
function downloadCsv(filename, text) {
  if (!text) return;
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ===== public init =====
export function initShadowBreaker() {
  if (!wrap) {
    wrap = document.getElementById('sb-wrap');
    viewMenu = document.getElementById('sb-view-menu');
    viewPlay = document.getElementById('sb-view-play');
    viewResult = document.getElementById('sb-view-result');

    targetLayer = document.getElementById('sb-target-layer');
    feedbackEl = document.getElementById('sb-msg-main');

    feverFill = document.getElementById('sb-fever-bar');
    feverStatus = document.getElementById('sb-label-fever');

    hpYouTop = document.getElementById('sb-hp-you-top');
    hpBossTop = document.getElementById('sb-hp-boss-top');

    statTime = document.getElementById('sb-text-time');
    statScore = document.getElementById('sb-text-score');
    statCombo = document.getElementById('sb-text-combo');
    statPhase = document.getElementById('sb-text-phase');
    statMiss = document.getElementById('sb-text-miss');
    statShield = document.getElementById('sb-text-shield');

    panelScore = document.getElementById('sb-panel-score');
    panelMaxCombo = document.getElementById('sb-panel-maxcombo');
    panelMiss = document.getElementById('sb-panel-miss');
    panelShield = document.getElementById('sb-panel-shield');

    bossNameTop = document.getElementById('sb-current-boss-name');
    bossEmojiSide = document.getElementById('sb-meta-emoji');
    bossNameSide = document.getElementById('sb-meta-name');
    bossDescSide = document.getElementById('sb-meta-desc');
    bossPhaseSide = document.getElementById('sb-meta-phase');
    bossShieldSide = document.getElementById('sb-meta-shield');

    diffSel = document.getElementById('sb-diff');
    timeSel = document.getElementById('sb-time');

    btnPlay = document.getElementById('sb-btn-play');
    btnResearch = document.getElementById('sb-btn-research');
    btnBackFromPlay = document.getElementById('sb-btn-back-menu');
    btnPauseToggle = document.getElementById('sb-btn-pause');
    btnResultRetry = document.getElementById('sb-btn-result-retry');
    btnResultMenu = document.getElementById('sb-btn-result-menu');
    btnDlEvents = document.getElementById('sb-btn-dl-events');
    btnDlSessions = document.getElementById('sb-btn-dl-sessions');

    resTime = document.getElementById('sb-res-time');
    resScore = document.getElementById('sb-res-score');
    resMaxCombo = document.getElementById('sb-res-max-combo');
    resMissRes = document.getElementById('sb-res-miss');
    resPhaseRes = document.getElementById('sb-res-phase');
    resGrade = document.getElementById('sb-res-grade');
    resAcc = document.getElementById('sb-res-acc');
    resBosses = document.getElementById('sb-res-bosses');
  }

  if (!wrap || !targetLayer) {
    console.warn('[ShadowBreaker] Missing core DOM');
    return;
  }

  if (!wired) {
    wired = true;

    btnPlay?.addEventListener('click', () => startGame('play'));
    btnResearch?.addEventListener('click', () => startGame('research'));

    btnBackFromPlay?.addEventListener('click', () => {
      if (state && state.running) endGame('stop-early');
      showView('menu');
    });

    btnPauseToggle?.addEventListener('change', (e) => {
      if (e.target.checked && state && state.running) {
        endGame('stop-early');
      }
    });

    btnResultRetry?.addEventListener('click', () => startGame('play'));
    btnResultMenu?.addEventListener('click', () => showView('menu'));

    btnDlEvents?.addEventListener('click', () => {
      const csv = eventLogger.toCsv();
      downloadCsv('shadow-breaker-events.csv', csv);
    });

    btnDlSessions?.addEventListener('click', () => {
      const csv = sessionLogger.toCsv();
      downloadCsv('shadow-breaker-sessions.csv', csv);
    });
  }

  resetHud();
  showView('menu');
  menuOpenedAt = performance.now();

  console.log('[ShadowBreaker] init complete (3-cols HUD)');
}

// auto init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShadowBreaker);
} else {
  initShadowBreaker();
}
