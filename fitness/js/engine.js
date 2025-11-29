// === js/engine.js — Shadow Breaker core (2025-12-xx, CSV + Grade + Loggers + Research Gate) ===
'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { EventLogger } from './event-logger.js';
import * as SessionLoggerModule from './session-logger.js';
import { recordSession } from './stats-store.js';

// ----- build meta -----
const BUILD_VERSION = 'sb-2025-12-xx';

// ===== SessionLogger fallback =====
// ถ้า session-logger.js ไม่มี export ชื่อ SessionLogger ให้ใช้ class ด้านล่างแทน
const SessionLoggerClass = SessionLoggerModule.SessionLogger || class {
  constructor() {
    this.sessions = [];
  }
  add(row) {
    if (!row || typeof row !== 'object') return;
    this.sessions.push(row);
  }
  clear() {
    this.sessions.length = 0;
  }
  toCsv() {
    if (!this.sessions.length) return '';
    const cols = Object.keys(this.sessions[0]);
    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const lines = [];
    lines.push(cols.join(','));
    for (const row of this.sessions) {
      const line = cols.map(col => esc(row[col]));
      lines.push(line.join(','));
    }
    return lines.join('\n');
  }
};

// ----- Loggers -----
const eventLogger = new EventLogger();         // event-level รอบปัจจุบัน
const sessionLogger = new SessionLoggerClass(); // session-level สะสมหลายรอบ

// ----- DOM refs -----
let wrap;
let viewMenu, viewPlay, viewResult;
let targetLayer;
let feedbackEl;
let feverFill, feverStatus;
let hpYouTop, hpBossTop;
let hpYouBottom, hpBossBottom;
let statTime, statScore, statCombo, statPhase, statMiss, statShield;
let bossNameTop;
let bossEmojiSide, bossNameSide, bossDescSide;
let diffSel, timeSel;
let btnPlay, btnResearch, btnBackFromPlay;
let btnPauseToggle, btnResultRetry, btnResultMenu;
let btnDownloadEvents, btnDownloadSession;
let resTime, resScore, resMaxCombo, resMissRes, resPhaseRes, resBossCleared, resAccRes, resGradeRes;

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
    spawnIntervalMin: 900,
    spawnIntervalMax: 1300,
    targetLifetime: 1400,
    baseSize: 150,    // เป้าใหญ่สุด
    bossDamageNormal: 0.04,
    bossDamageBossFace: 0.4
  },
  normal: {
    label: 'Normal — สมดุล',
    spawnIntervalMin: 750,
    spawnIntervalMax: 1150,
    targetLifetime: 1200,
    baseSize: 120,
    bossDamageNormal: 0.035,
    bossDamageBossFace: 0.35
  },
  hard: {
    label: 'Hard — ท้าทาย',
    spawnIntervalMin: 600,
    spawnIntervalMax: 950,
    targetLifetime: 1050,
    baseSize: 100,    // เป้าเล็กสุด
    bossDamageNormal: 0.03,
    bossDamageBossFace: 0.3
  }
};

// FEVER ปรับให้ง่ายขึ้น
const FEVER_PER_HIT = 0.12;
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
let sessionSummary = null;
let wired = false;

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

// เกรดตาม accuracy (%)
function gradeFromAccuracy(acc) {
  if (acc >= 98) return 'SSS';
  if (acc >= 95) return 'SS';
  if (acc >= 90) return 'S';
  if (acc >= 80) return 'A';
  if (acc >= 70) return 'B';
  return 'C';
}

// ดาวน์โหลด CSV ช่วย ๆ
function downloadCsvText(csvText, filename) {
  if (!csvText) {
    alert('ยังไม่มีข้อมูลสำหรับดาวน์โหลด');
    return;
  }
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
  const vPlayer = Math.max(0, Math.min(1, state.playerHp));
  const vBoss = Math.max(0, Math.min(1, state.bossHp));

  if (hpYouBottom) hpYouBottom.style.transform = `scaleX(${vPlayer})`;
  if (hpBossBottom) hpBossBottom.style.transform = `scaleX(${vBoss})`;
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

  if (bossEmojiSide) bossEmojiSide.textContent = boss.emoji;
  if (bossNameSide) bossNameSide.textContent = boss.name;
  if (bossDescSide) bossDescSide.textContent = boss.hint;

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
    sizePx: cfg.baseSize * 1.8,
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

    const isRealMiss = data.type === 'normal' || data.isBossFace;

    if (isRealMiss) {
      state.miss++;
      if (statMiss) statMiss.textContent = String(state.miss);
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

  const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
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
    scoreDelta = 250;
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
  if (statCombo) statCombo.textContent = String(state.combo);
  if (statShield) statShield.textContent = String(state.shield);
  if (statMiss) statMiss.textContent = String(state.miss);

  updateHpBars();
  updateFeverUi(now);

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
  const grade = gradeFromAccuracy(acc);

  sessionSummary = {
    session_id: Date.now(),
    build_version: BUILD_VERSION,

    mode: state.mode,
    diff: state.diffKey,
    diff_label: DIFF_CONFIG[state.diffKey].label,
    reason,
    duration_sec: state.durationSec,
    time_left_sec: +(state.timeLeftMs / 1000).toFixed(2),
    score: state.score,
    accuracy_pct: +acc.toFixed(2),
    grade,

    max_combo: state.maxCombo,
    total_hits: state.totalHits,
    miss: state.miss,
    fever_time_sec: +(state.feverActiveMs / 1000).toFixed(2),
    lowhp_time_sec: +(state.lowHpMs / 1000).toFixed(2),
    bosses_cleared: state.clearedBosses,

    participant_id: (state.researchMeta && state.researchMeta.id) || '',
    participant_group: (state.researchMeta && state.researchMeta.group) || '',
    participant_note: (state.researchMeta && state.researchMeta.note) || '',

    menu_latency_ms: Math.round(state.startedAt - menuOpenedAt),
    rt_normal_ms: state.rtNormalCount ? +(state.rtNormalSum / state.rtNormalCount).toFixed(1) : '',
    rt_decoy_ms: state.rtDecoyCount ? +(state.rtDecoySum / state.rtDecoyCount).toFixed(1) : ''
  };

  sessionLogger.add(sessionSummary);

  try {
    recordSession('shadow-breaker', sessionSummary);
  } catch (e) {
    console.warn('recordSession failed', e);
  }

  if (resTime) resTime.textContent = sessionSummary.duration_sec.toFixed(1) + ' s';
  if (resScore) resScore.textContent = String(sessionSummary.score);
  if (resMaxCombo) resMaxCombo.textContent = String(sessionSummary.max_combo);
  if (resMissRes) resMissRes.textContent = String(sessionSummary.miss);
  if (resPhaseRes) resPhaseRes.textContent = String(state.bossPhase);
  if (resBossCleared) resBossCleared.textContent = String(sessionSummary.bosses_cleared);
  if (resAccRes) resAccRes.textContent = sessionSummary.accuracy_pct + ' %';
  if (resGradeRes) resGradeRes.textContent = sessionSummary.grade;

  showView('result');
}

// ===== start game =====
// เพิ่ม researchMeta เพื่อโหมดวิจัยต้องมีข้อมูลผู้เล่นก่อน
function startGame(mode, researchMeta) {
  const diffKey = (diffSel && diffSel.value) || 'normal';
  const durationSec = parseInt((timeSel && timeSel.value) || '60', 10) || 60;

  clearRenderer();
  resetHud();
  eventLogger.clear();

  const now = performance.now();
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
    startedAt: now,
    lastTickAt: now,
    researchMeta: researchMeta || null,
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

    bossNameTop = document.getElementById('sb-current-boss-name');
    bossEmojiSide = document.getElementById('sb-meta-emoji');
    bossNameSide = document.getElementById('sb-meta-name');
    bossDescSide = document.getElementById('sb-meta-desc');

    diffSel = document.getElementById('sb-diff');
    timeSel = document.getElementById('sb-time');

    btnPlay = document.getElementById('sb-btn-play');
    btnResearch = document.getElementById('sb-btn-research');
    btnBackFromPlay = document.getElementById('sb-btn-back-menu');
    btnPauseToggle = document.getElementById('sb-btn-pause');
    btnResultRetry = document.getElementById('sb-btn-result-retry');
    btnResultMenu = document.getElementById('sb-btn-result-menu');
    btnDownloadEvents = document.getElementById('sb-btn-download-events');
    btnDownloadSession = document.getElementById('sb-btn-download-session');

    resTime = document.getElementById('sb-res-time');
    resScore = document.getElementById('sb-res-score');
    resMaxCombo = document.getElementById('sb-res-max-combo');
    resMissRes = document.getElementById('sb-res-miss');
    resPhaseRes = document.getElementById('sb-res-phase');
    resBossCleared = document.getElementById('sb-res-boss-cleared');
    resAccRes = document.getElementById('sb-res-acc');
    resGradeRes = document.getElementById('sb-res-grade');
  }

  if (!wrap || !targetLayer) {
    console.warn('[ShadowBreaker] Missing core DOM (sb-wrap or sb-target-layer).');
    return;
  }

  if (!wired) {
    wired = true;

    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        startGame('play', null);
      });
    }

    if (btnResearch) {
      btnResearch.addEventListener('click', () => {
        // บังคับให้กรอกข้อมูลก่อนเข้าโหมดวิจัย
        const id = prompt('กรอกรหัสผู้เข้าร่วม (เช่น P001):');
        if (!id) {
          alert('กรุณากรอกรหัสผู้เข้าร่วมก่อนเริ่มโหมดวิจัย');
          return;
        }
        const group = prompt('กลุ่มทดลอง (เช่น G1 / Control):') || '';
        const note = prompt('หมายเหตุเพิ่มเติม (ถ้าไม่มีให้เว้นว่าง):') || '';
        const meta = { id, group, note };
        startGame('research', meta);
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
        startGame('play', null);
      });
    }

    if (btnResultMenu) {
      btnResultMenu.addEventListener('click', () => {
        showView('menu');
      });
    }

    if (btnDownloadEvents) {
      btnDownloadEvents.addEventListener('click', () => {
        const csv = eventLogger.toCsv();
        if (!csv) {
          alert('ยังไม่มีข้อมูลเหตุการณ์ในรอบนี้');
          return;
        }
        downloadCsvText(csv, 'shadow-breaker-events.csv');
      });
    }

    if (btnDownloadSession) {
      btnDownloadSession.addEventListener('click', () => {
        const csv = sessionLogger.toCsv();
        if (!csv) {
          alert('ยังไม่มีข้อมูลสรุป session');
          return;
        }
        downloadCsvText(csv, 'shadow-breaker-sessions.csv');
      });
    }
  }

  resetHud();
  showView('menu');
  menuOpenedAt = performance.now();

  console.log('[ShadowBreaker] init complete (CSV loggers + research gate)');
}
