// === js/engine.js — Shadow Breaker core (2025-12-05, HUD sync + FEVER + CSV) ===
'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';
import { recordSession } from '../fitness/js/stats-store.js';

// ----- DOM refs -----
let wrap;
let viewMenu, viewPlay, viewResult;
let targetLayer;
let feedbackEl;
let feverFill, feverStatus;
let hpYouTop, hpBossTop;
let hpYouBottom, hpBossBottom;
let statTime, statScore, statCombo, statPhase, statMiss, statShield;
let statScoreBox, statMaxComboBox, statMissBox;
let bossNameTop;
let bossEmojiSide, bossNameSide, bossDescSide;
let bossPhaseSide, bossShieldSide;
let diffSel, timeSel;
let btnPlay, btnResearch, btnBackFromPlay;
let btnPauseToggle, btnResultRetry, btnResultMenu;
let btnCsvEvents, btnCsvSessions;
let resGrade, resAcc, resBosses;
let resTime, resScore, resMaxCombo, resMissRes, resPhaseRes;
let resRtNormal, resRtDecoy, resFeverTime, resLowHpTime;

// ----- config -----
const BOSSES = [
  { id: 0, name: 'Bubble Glove', emoji: '🐣', hint: 'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน' },
  { id: 1, name: 'Spark Guard', emoji: '⚡️', hint: 'เล็งเป้าเร็ว ๆ ระวังลูกระเบิด' },
  { id: 2, name: 'Shadow Mitt', emoji: '🕶️', hint: 'เป้าบางอันจะลวง ให้ดูจังหวะดี ๆ' },
  { id: 3, name: 'Galaxy Punch', emoji: '🌌', hint: 'ด่านสุดท้าย เป้าจะเล็กและเร็วมาก' }
];

const DIFF_CONFIG = {
  easy: {
    label: 'Easy — ผ่อนคลาย',
    spawnIntervalMin: 850,
    spawnIntervalMax: 1200,
    targetLifetime: 1500,
    baseSize: 140,
    bossDamageNormal: 0.05,
    bossDamageBossFace: 0.45
  },
  normal: {
    label: 'Normal — สมดุล',
    spawnIntervalMin: 700,
    spawnIntervalMax: 1100,
    targetLifetime: 1250,
    baseSize: 120,
    bossDamageNormal: 0.04,
    bossDamageBossFace: 0.4
  },
  hard: {
    label: 'Hard — ท้าทาย',
    spawnIntervalMin: 580,
    spawnIntervalMax: 950,
    targetLifetime: 1050,
    baseSize: 105,
    bossDamageNormal: 0.035,
    bossDamageBossFace: 0.36
  }
};

const FEVER_PER_HIT = 0.12;
const FEVER_DECAY_PER_SEC = 0.10;
const FEVER_DURATION_MS = 6000;
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

function computeGrade(score, accPct) {
  if (accPct >= 95 && score >= 2200) return 'SSS';
  if (accPct >= 90 && score >= 1800) return 'SS';
  if (accPct >= 85 && score >= 1400) return 'S';
  if (accPct >= 75) return 'A';
  if (accPct >= 60) return 'B';
  return 'C';
}

function downloadCsv(filename, csv) {
  if (!csv) {
    alert('ยังไม่มีข้อมูลให้ดาวน์โหลดในรอบนี้');
    return;
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

// ===== view / HUD =====
function showView(name) {
  if (viewMenu) viewMenu.classList.remove('is-active');
  if (viewPlay) viewPlay.classList.remove('is-active');
  if (viewResult) viewResult.classList.remove('is-active');

  if (name === 'menu' && viewMenu) viewMenu.classList.add('is-active');
  else if (name === 'play' && viewPlay) viewPlay.classList.add('is-active');
  else if (name === 'result' && viewResult) viewResult.classList.add('is-active');
}

function resetHud() {
  if (statTime) statTime.textContent = '0.0 s';
  if (statScore) statScore.textContent = '0';
  if (statCombo) statCombo.textContent = '0';
  if (statPhase) statPhase.textContent = '1';
  if (statMiss) statMiss.textContent = '0';
  if (statShield) statShield.textContent = '0';

  if (statScoreBox) statScoreBox.textContent = '0';
  if (statMaxComboBox) statMaxComboBox.textContent = '0';
  if (statMissBox) statMissBox.textContent = '0';

  if (feverStatus) {
    feverStatus.textContent = 'READY';
    feverStatus.classList.remove('on');
  }
  if (feverFill) feverFill.style.transform = 'scaleX(0)';

  if (hpYouBottom) hpYouBottom.style.transform = 'scaleX(1)';
  if (hpBossBottom) hpBossBottom.style.transform = 'scaleX(1)';
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
  if (!state) return;
  const vPlayer = Math.max(0, Math.min(1, state.playerHp));
  const vBoss = Math.max(0, Math.min(1, state.bossHp));

  if (hpYouBottom) hpYouBottom.style.transform = `scaleX(${vPlayer})`;
  if (hpBossBottom) hpBossBottom.style.transform = `scaleX(${vBoss})`;
  if (hpYouTop) hpYouTop.style.transform = `scaleX(${vPlayer})`;
  if (hpBossTop) hpBossTop.style.transform = `scaleX(${vBoss})`;
}

function updateFeverUi(now) {
  if (!state || !feverFill) return;
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
  if (!state) return;
  const boss = currentBoss();
  if (wrap) {
    wrap.dataset.boss = String(boss.id);
    wrap.dataset.phase = String(state.bossPhase);
  }

  if (bossEmojiSide) bossEmojiSide.textContent = boss.emoji;
  if (bossNameSide) bossNameSide.textContent = boss.name;
  if (bossDescSide) bossDescSide.textContent = boss.hint;
  if (bossPhaseSide) bossPhaseSide.textContent = `Phase ${state.bossPhase}`;
  if (bossShieldSide) bossShieldSide.textContent = String(state.shield);

  if (bossNameTop) bossNameTop.textContent = `${boss.name} ${boss.emoji}`;
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
    if (!state || !state.running) return;
    if (!state.targets.has(id)) return;
    state.targets.delete(id);
    if (renderer) renderer.removeTarget(id, 'timeout');

    state.miss++;
    if (statMiss) statMiss.textContent = String(state.miss);
    if (statMissBox) statMissBox.textContent = String(state.miss);
    state.combo = 0;
    if (statCombo) statCombo.textContent = '0';

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
    isBossFace: (extra && extra.isBossFace) || false,
    bossEmoji: extra && extra.bossEmoji,
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
    if (!state || !state.running) return;
    if (!state.targets.has(id)) return;

    state.targets.delete(id);
    if (renderer) renderer.removeTarget(id, 'timeout');

    const isRealMiss = data.type === 'normal';

    if (isRealMiss) {
      state.miss++;
      if (statMiss) statMiss.textContent = String(state.miss);
      if (statMissBox) statMissBox.textContent = String(state.miss);
      state.combo = 0;
      if (statCombo) statCombo.textContent = '0';
      setFeedback('พลาดจังหวะ! ลองมองเป้าให้ชัดแล้วลองใหม่ 👀', 'miss');
      logEvent('timeout', data, { grade: 'miss' });
    } else {
      logEvent('timeout', data, { grade: 'skip' });
    }
  }, ttl);
}

function spawnOneTarget() {
  const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;

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
    bossDmg = DIFF_CONFIG[state.diffKey].bossDamageBossFace;
    setFeedback('หมัดเด็ดใส่หน้าบอส! 💥', 'perfect');
    state.combo++;
  } else {
    if (rt < 220) {
      grade = 'perfect';
      scoreDelta = 160;
    } else if (rt < 480) {
      grade = 'good';
      scoreDelta = 120;
    } else {
      grade = 'bad';
      scoreDelta = 60;
    }
    bossDmg = DIFF_CONFIG[state.diffKey].bossDamageNormal;
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

  if (data.type === 'normal') {
    state.fever += FEVER_PER_HIT;
    if (!state.feverOn && state.fever >= 1) {
      state.feverOn = true;
      state.feverUntil = now + FEVER_DURATION_MS;
      state.fever = 1;
      if (feverStatus) {
        feverStatus.textContent = 'ON';
        feverStatus.classList.add('on');
      }
    }
  }

  if (state.feverOn) {
    scoreDelta = Math.round(scoreDelta * 1.5);
    bossDmg *= 1.25;
  }

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

  if (statScore) statScore.textContent = String(state.score);
  if (statScoreBox) statScoreBox.textContent = String(state.score);
  if (statCombo) statCombo.textContent = String(state.combo);
  if (statMaxComboBox) statMaxComboBox.textContent = String(state.maxCombo);
  if (statShield) statShield.textContent = String(state.shield);

  updateHpBars();
  updateFeverUi(now);
  updateBossUi();

  if (renderer) {
    renderer.playHitFx(id, {
      grade,
      scoreDelta,
      clientX: hitInfo && hitInfo.clientX,
      clientY: hitInfo && hitInfo.clientY
    });
    renderer.removeTarget(id, 'hit');
  }

  logEvent('hit', data, { grade, rtMs: rt, scoreDelta });

  if (state.playerHp <= 0) {
    endGame('player-dead');
  }
}

// ===== logging / loop =====
function logEvent(type, targetData, extra) {
  const now = performance.now();
  const row = {
    session_id: state.sessionId,
    run_index: state.runIndex,
    ts_ms: Math.round(now - state.startedAt),
    mode: state.mode,
    diff: state.diffKey,
    boss_index: state.bossIndex,
    boss_phase: state.bossPhase,
    target_id: targetData ? targetData.id : '',
    target_type: targetData ? targetData.type : '',
    is_boss_face: targetData ? !!targetData.isBossFace : '',
    event_type: type,
    rt_ms: extra && extra.rtMs != null ? Math.round(extra.rtMs) : '',
    grade: (extra && extra.grade) || '',
    score_delta: (extra && extra.scoreDelta) || '',
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
    if (statTime) statTime.textContent = '0.0 s';
    endGame('time-up');
    return;
  }

  if (statTime) statTime.textContent = (state.timeLeftMs / 1000).toFixed(1) + ' s';
  updateFeverUi(now);

  const nowTargets = Array.from(state.targets.values());
  for (const t of nowTargets) {
    if (now >= t.timeoutAt) {
      if (t.timeoutHandle) clearTimeout(t.timeoutHandle);
      state.targets.delete(t.id);
      if (renderer) renderer.removeTarget(t.id, 'timeout');

      const isRealMiss = t.type === 'normal' || t.isBossFace;

      if (isRealMiss) {
        state.miss++;
        if (statMiss) statMiss.textContent = String(state.miss);
        if (statMissBox) statMissBox.textContent = String(state.miss);
        state.combo = 0;
        if (statCombo) statCombo.textContent = '0';
        logEvent('timeout', t, { grade: 'miss' });
      } else {
        logEvent('timeout', t, { grade: 'skip' });
      }
    }
  }

  gameLoopId = requestAnimationFrame(gameLoop);
}

// ===== end game =====
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
    session_id: state.sessionId,
    build_version: 'shadow-breaker-2025-12-05',
    mode: state.mode,
    difficulty: state.diffKey,
    diff_label: DIFF_CONFIG[state.diffKey].label,
    training_phase: '',
    run_index: state.runIndex,
    start_ts: state.startedAt,
    end_ts: performance.now(),
    duration_s: state.durationSec,
    end_reason: reason,
    final_score: state.score,
    grade: computeGrade(state.score, acc),
    total_targets: totalTrials,
    total_hits: state.totalHits,
    total_miss: state.miss,
    total_bombs_hit: 0,
    accuracy_pct: +acc.toFixed(2),
    max_combo: state.maxCombo,
    perfect_count: null,
    good_count: null,
    bad_count: null,
    avg_rt_normal_ms: state.rtNormalCount ? +(state.rtNormalSum / state.rtNormalCount).toFixed(1) : '',
    std_rt_normal_ms: '',
    avg_rt_decoy_ms: state.rtDecoyCount ? +(state.rtDecoySum / state.rtDecoyCount).toFixed(1) : '',
    std_rt_decoy_ms: '',
    fever_count: null,
    fever_total_time_s: +(state.feverActiveMs / 1000).toFixed(2),
    low_hp_time_s: +(state.lowHpMs / 1000).toFixed(2),
    bosses_cleared: state.clearedBosses,
    menu_to_play_ms: Math.round(state.startedAt - menuOpenedAt),
    participant: '',
    group: '',
    note: '',
    env_ua: navigator.userAgent || '',
    env_viewport_w: window.innerWidth,
    env_viewport_h: window.innerHeight,
    env_input_mode: 'touch/mouse',
    error_count: 0,
    focus_events: 0
  };

  sessionLogger.add(summary);
  recordSession('shadow-breaker', summary);

  if (resGrade) resGrade.textContent = summary.grade;
  if (resAcc) resAcc.textContent = summary.accuracy_pct.toFixed
    ? summary.accuracy_pct.toFixed(1) + ' %'
    : summary.accuracy_pct + ' %';
  if (resBosses) resBosses.textContent = String(summary.bosses_cleared);

  if (resTime) resTime.textContent = summary.duration_s.toFixed(1) + ' s';
  if (resScore) resScore.textContent = String(summary.final_score);
  if (resMaxCombo) resMaxCombo.textContent = String(summary.max_combo);
  if (resMissRes) resMissRes.textContent = String(summary.total_miss);
  if (resPhaseRes) resPhaseRes.textContent = String(state.bossPhase);

  if (resRtNormal) {
    resRtNormal.textContent =
      summary.avg_rt_normal_ms !== '' ? summary.avg_rt_normal_ms + ' ms' : '–';
  }
  if (resRtDecoy) {
    resRtDecoy.textContent =
      summary.avg_rt_decoy_ms !== '' ? summary.avg_rt_decoy_ms + ' ms' : '–';
  }
  if (resFeverTime) resFeverTime.textContent = summary.fever_total_time_s + ' s';
  if (resLowHpTime) resLowHpTime.textContent = summary.low_hp_time_s + ' s';

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

  const now = performance.now();

  state = {
    sessionId: 'sb-' + Date.now(),
    runIndex: 1,
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
    startedAt: now,
    lastTickAt: now,
    researchMeta: null,
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
    hpYouBottom = document.getElementById('sb-hp-you-bottom');
    hpBossBottom = document.getElementById('sb-hp-boss-bottom');

    statTime = document.getElementById('sb-text-time');
    statScore = document.getElementById('sb-text-score');
    statCombo = document.getElementById('sb-text-combo');
    statPhase = document.getElementById('sb-text-phase');
    statMiss = document.getElementById('sb-text-miss');
    statShield = document.getElementById('sb-text-shield');

    statScoreBox = document.getElementById('sb-text-score-box');
    statMaxComboBox = document.getElementById('sb-text-maxcombo-box');
    statMissBox = document.getElementById('sb-text-miss-box');

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
    btnCsvEvents = document.getElementById('sb-btn-dl-event');
    btnCsvSessions = document.getElementById('sb-btn-dl-session');

    resGrade = document.getElementById('sb-res-grade');
    resAcc = document.getElementById('sb-res-acc');
    resBosses = document.getElementById('sb-res-bosses');
    resTime = document.getElementById('sb-res-time');
    resScore = document.getElementById('sb-res-score');
    resMaxCombo = document.getElementById('sb-res-max-combo');
    resMissRes = document.getElementById('sb-res-miss');
    resPhaseRes = document.getElementById('sb-res-phase');
    resRtNormal = document.getElementById('sb-res-rt-normal');
    resRtDecoy = document.getElementById('sb-res-rt-decoy');
    resFeverTime = document.getElementById('sb-res-fever-time');
    resLowHpTime = document.getElementById('sb-res-lowhp-time');
  }

  if (!wrap || !targetLayer) {
    console.warn('[ShadowBreaker] Missing core DOM (sb-wrap or sb-target-layer).');
    return;
  }

  if (!wired) {
    wired = true;

    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        startGame('play');
      });
    }

    if (btnResearch) {
      btnResearch.addEventListener('click', () => {
        startGame('research');
      });
    }

    if (btnBackFromPlay) {
      btnBackFromPlay.addEventListener('click', () => {
        if (state && state.running) {
          endGame('stop-early');
        }
        showView('menu');
      });
    }

    if (btnPauseToggle) {
      btnPauseToggle.addEventListener('change', (e) => {
        if (e.target.checked && state && state.running) {
          endGame('stop-early');
        }
      });
    }

    if (btnResultRetry) {
      btnResultRetry.addEventListener('click', () => {
        startGame('play');
      });
    }

    if (btnResultMenu) {
      btnResultMenu.addEventListener('click', () => {
        showView('menu');
      });
    }

    if (btnCsvEvents) {
      btnCsvEvents.addEventListener('click', () => {
        const csv = eventLogger.toCsv();
        downloadCsv('shadow-breaker-events.csv', csv);
      });
    }

    if (btnCsvSessions) {
      btnCsvSessions.addEventListener('click', () => {
        const csv = sessionLogger.toCsv();
        downloadCsv('shadow-breaker-sessions.csv', csv);
      });
    }
  }

  resetHud();
  showView('menu');
  menuOpenedAt = performance.now();

  console.log('[ShadowBreaker] init complete');
}
