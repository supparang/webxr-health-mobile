// === js/engine.js — Shadow Breaker core (LATEST) ===
'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';
import { recordSession } from './stats-store.js';
import { AIDirector } from './ai-director.js';

/* ----- DOM refs ----- */
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
let bossPhaseLabel, bossShieldLabel;

let diffSel, timeSel;

let btnPlay, btnResearch, btnBackFromPlay;
let btnPauseToggle, btnResultRetry, btnResultMenu;

let btnDownloadEvents, btnDownloadSession;

let resTime, resScore, resMaxCombo, resMissRes, resPhaseRes, resBossCleared, resAcc, resGrade;

let inputPartId, inputPartGroup, inputPartNote;

/* ----- Boss meta ----- */
const BOSSES = [
  { id: 0, name: 'Bubble Glove', emoji: '🐣', baseShield: 0, hint: 'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน' },
  { id: 1, name: 'Spark Guard',  emoji: '⚡️', baseShield: 1, hint: 'เล็งให้ไว ระวังลูกระเบิดสีแดง' },
  { id: 2, name: 'Shadow Mitt',  emoji: '🕶️', baseShield: 1, hint: 'บางเป้าเป็นเป้าลวง ดูจังหวะแล้วค่อยตี' },
  { id: 3, name: 'Galaxy Punch', emoji: '🌌', baseShield: 2, hint: 'ด่านสุดท้าย เป้าจะเล็กและเร็วมาก' }
];

const DIFF_CONFIG = {
  easy:   { spawnIntervalMin: 950, spawnIntervalMax: 1350, targetLifetime: 1500, baseSize: 150, bossDamageNormal: 0.040, bossDamageBossFace: 0.45 },
  normal: { spawnIntervalMin: 800, spawnIntervalMax: 1200, targetLifetime: 1300, baseSize: 125, bossDamageNormal: 0.035, bossDamageBossFace: 0.40 },
  hard:   { spawnIntervalMin: 650, spawnIntervalMax: 1000, targetLifetime: 1150, baseSize: 110, bossDamageNormal: 0.030, bossDamageBossFace: 0.35 }
};

/* FEVER / HP */
const FEVER_PER_HIT = 0.18;
const FEVER_DECAY_PER_SEC = 0.10;
const FEVER_DURATION_MS = 6000;

const LOWHP_THRESHOLD = 0.3;
const BOSSFACE_THRESHOLD = 0.28;

/* runtime state */
let renderer = null;
let state = null;
let spawnTimer = null;
let gameLoopId = null;

let menuOpenedAt = performance.now();
let wired = false;

const eventLogger = new EventLogger();
const sessionLogger = new SessionLogger();
const aiDirector = new AIDirector();

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

const currentBoss = () => BOSSES[state.bossIndex] || BOSSES[BOSSES.length - 1];

/* view / HUD */
function showView(name) {
  if (viewMenu) viewMenu.classList.remove('is-active');
  if (viewPlay) viewPlay.classList.remove('is-active');
  if (viewResult) viewResult.classList.remove('is-active');

  if (name === 'menu' && viewMenu) viewMenu.classList.add('is-active');
  else if (name === 'play' && viewPlay) viewPlay.classList.add('is-active');
  else if (name === 'result' && viewResult) viewResult.classList.add('is-active');

  if (name === 'menu') menuOpenedAt = performance.now();
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

  aiDirector.reset();
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
    wrap.dataset.diff = state.diffKey;
  }

  if (bossEmojiSide) bossEmojiSide.textContent = boss.emoji;
  if (bossNameSide) bossNameSide.textContent = boss.name;
  if (bossDescSide) bossDescSide.textContent = boss.hint;

  if (bossNameTop) bossNameTop.textContent = `${boss.name} ${boss.emoji}`;
  if (bossPhaseLabel) bossPhaseLabel.textContent = String(state.bossPhase);
  if (bossShieldLabel) bossShieldLabel.textContent = String(boss.baseShield);

  if (statPhase) statPhase.textContent = String(state.bossPhase);
}

/* renderer */
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

/* spawn */
function spawnBossFaceTarget() {
  const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
  const bossMeta = currentBoss();
  const now = performance.now();
  const id = state.nextTargetId++;

  const phaseScale =
    state.bossPhase === 1 ? 1.05 :
    state.bossPhase === 2 ? 0.95 : 0.82;

  const data = {
    id,
    type: 'bossface',
    bossIndex: state.bossIndex,
    bossPhase: state.bossPhase,
    spawnTime: now,
    isBossFace: true,
    bossEmoji: bossMeta.emoji,
    sizePx: cfg.baseSize * 1.9 * phaseScale,
    timeoutAt: now + cfg.targetLifetime * 1.5
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
    logEvent('timeout', data, { grade: 'miss', isRealMiss: true });
  }, cfg.targetLifetime * 1.5);
}

function spawnTargetOfType(kind, extra) {
  const baseCfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
  const tune = (state.mode === 'play') ? aiDirector.proposeTuning() : { spawnMul:1, ttlMul:1, sizeMul:1, bombW:1, decoyW:1 };

  const cfg = {
    ...baseCfg,
    spawnIntervalMin: baseCfg.spawnIntervalMin * tune.spawnMul,
    spawnIntervalMax: baseCfg.spawnIntervalMax * tune.spawnMul,
    targetLifetime: baseCfg.targetLifetime * tune.ttlMul,
    baseSize: baseCfg.baseSize * tune.sizeMul
  };

  const now = performance.now();
  const id = state.nextTargetId++;

  let phaseScale = 1;
  if (state.bossPhase === 1) phaseScale = 1.05;
  else if (state.bossPhase === 2) phaseScale = 0.95;
  else phaseScale = 0.82;

  const ttl = cfg.targetLifetime;
  const base = (extra && extra.size) || cfg.baseSize;
  const size = base * phaseScale;

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
      logEvent('timeout', data, { grade: 'miss', isRealMiss: true });
      aiDirector.update({ type:'timeout', isRealMiss:true });
    } else {
      logEvent('timeout', data, { grade: 'skip', isRealMiss: false });
      aiDirector.update({ type:'timeout', isRealMiss:false });
    }
  }, ttl);
}

function spawnOneTarget() {
  if (!state) return;

  if (!state.bossFaceSpawned && state.bossHp > 0 && state.bossHp <= BOSSFACE_THRESHOLD) {
    state.bossFaceSpawned = true;
    spawnBossFaceTarget();
    return;
  }

  const tune = (state.mode === 'play') ? aiDirector.proposeTuning() : { bombW:1, decoyW:1 };

  const kind = pickWeighted([
    { v: 'normal', w: 64 },
    { v: 'decoy',  w: 10 * tune.decoyW },
    { v: 'bomb',   w: 8  * tune.bombW },
    { v: 'heal',   w: 9 },
    { v: 'shield', w: 9 }
  ]);

  spawnTargetOfType(kind, {});
}

function scheduleNextSpawn() {
  if (!state || !state.running) return;

  const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
  const tune = (state.mode === 'play') ? aiDirector.proposeTuning() : { spawnMul:1 };
  const delay = randRange(cfg.spawnIntervalMin * tune.spawnMul, cfg.spawnIntervalMax * tune.spawnMul);

  spawnTimer = setTimeout(() => {
    if (!state || !state.running) return;
    spawnOneTarget();
    scheduleNextSpawn();
  }, delay);
}

/* hit / miss */
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
    if (rt < 220) { grade = 'perfect'; scoreDelta = 160; }
    else if (rt < 480) { grade = 'good'; scoreDelta = 120; }
    else { grade = 'bad'; scoreDelta = 60; }

    bossDmg = DIFF_CONFIG[state.diffKey].bossDamageNormal;
    state.combo++;
    setFeedback(
      grade === 'perfect' ? 'สุดยอด! PERFECT 🎯' :
      grade === 'good' ? 'เยี่ยม! จังหวะกำลังดี 👍' :
      'ช้าไปนิด ลองเร่งอีกนิดนะ 🔄',
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
  if (hpDeltaPlayer !== 0) state.playerHp = Math.max(0, Math.min(1, state.playerHp + hpDeltaPlayer));
  if (shieldDelta !== 0) state.shield = Math.max(0, state.shield + shieldDelta);
  if (bossDmg > 0) applyHitToBoss(bossDmg);

  state.totalHits++;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;

  if (statScore) statScore.textContent = String(state.score);
  if (statCombo) statCombo.textContent = String(state.combo);
  if (statShield) statShield.textContent = String(state.shield);

  updateHpBars();
  updateFeverUi(now);

  if (renderer) {
    renderer.playHitFx(id, { grade, scoreDelta, clientX: hitInfo?.clientX, clientY: hitInfo?.clientY });
    renderer.removeTarget(id, 'hit');
  }

  logEvent('hit', data, { grade, rtMs: rt, scoreDelta });
  aiDirector.update({ type:'hit', rt_ms: rt });

  if (state.playerHp <= 0) endGame('player-dead');
}

/* logging */
function logEvent(type, targetData, extra) {
  if (!state) return;
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
    score_delta: extra?.scoreDelta || '',
    combo_after: state.combo,
    score_after: state.score,
    player_hp: state.playerHp.toFixed(3),
    boss_hp: state.bossHp.toFixed(3)
  };

  if (state.researchMeta) {
    row.participant_id = state.researchMeta.id;
    row.participant_group = state.researchMeta.group;
    row.participant_note = state.researchMeta.note;
  }

  eventLogger.add(row);
}

/* loop */
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

  gameLoopId = requestAnimationFrame(gameLoop);
}

function gradeFromAccuracy(acc) {
  if (acc >= 98) return 'SSS';
  if (acc >= 95) return 'SS';
  if (acc >= 90) return 'S';
  if (acc >= 80) return 'A';
  if (acc >= 70) return 'B';
  return 'C';
}

function downloadCsv(filename, csvText) {
  if (!csvText) { alert('ยังไม่มีข้อมูลให้ดาวน์โหลด'); return; }
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

/* end game */
function endGame(reason) {
  if (!state || !state.running) return;
  state.running = false;

  if (spawnTimer) { clearTimeout(spawnTimer); spawnTimer = null; }
  if (gameLoopId) { cancelAnimationFrame(gameLoopId); gameLoopId = null; }

  if (renderer) {
    for (const id of state.targets.keys()) renderer.removeTarget(id, 'end');
  }
  state.targets.clear();

  const totalTrials = state.totalHits + state.miss;
  const acc = totalTrials > 0 ? (state.totalHits / totalTrials) * 100 : 0;

  const summary = {
    session_id: Date.now().toString(36),
    build_version: 'shadow-breaker-latest',
    mode: state.mode,
    difficulty: state.diffKey,
    training_phase: state.bossPhase,
    run_index: 0,
    start_ts: state.startedAt,
    end_ts: performance.now(),
    duration_s: state.durationSec,
    end_reason: reason,
    final_score: state.score,
    grade: gradeFromAccuracy(acc),
    total_targets: totalTrials,
    total_hits: state.totalHits,
    total_miss: state.miss,
    total_bombs_hit: 0,
    accuracy_pct: +acc.toFixed(2),
    max_combo: state.maxCombo,
    avg_rt_normal_ms: state.rtNormalCount ? +(state.rtNormalSum / state.rtNormalCount).toFixed(1) : '',
    std_rt_normal_ms: '',
    avg_rt_decoy_ms: state.rtDecoyCount ? +(state.rtDecoySum / state.rtDecoyCount).toFixed(1) : '',
    std_rt_decoy_ms: '',
    fever_count: 0,
    fever_total_time_s: +(state.feverActiveMs / 1000).toFixed(2),
    low_hp_time_s: +(state.lowHpMs / 1000).toFixed(2),
    bosses_cleared: state.clearedBosses,
    menu_to_play_ms: Math.round(state.startedAt - menuOpenedAt),
    participant: '',
    group: '',
    note: '',
    env_ua: navigator.userAgent,
    env_viewport_w: window.innerWidth,
    env_viewport_h: window.innerHeight,
    env_input_mode: 'mouse/touch',
    error_count: 0,
    focus_events: 0
  };

  if (state.researchMeta) {
    summary.participant = state.researchMeta.id;
    summary.group = state.researchMeta.group;
    summary.note = state.researchMeta.note;
  }

  sessionLogger.add(summary);

  try {
    recordSession('shadow-breaker', {
      score: summary.final_score,
      accuracy_pct: summary.accuracy_pct,
      grade: summary.grade,
      bosses_cleared: summary.bosses_cleared,
      duration_s: summary.duration_s,
      diff: summary.difficulty,
      ts: Date.now()
    });
  } catch (e) {
    console.warn('ShadowBreaker: cannot save to stats-store', e);
  }

  if (resTime) resTime.textContent = summary.duration_s.toFixed(1) + ' s';
  if (resScore) resScore.textContent = String(summary.final_score);
  if (resMaxCombo) resMaxCombo.textContent = String(summary.max_combo);
  if (resMissRes) resMissRes.textContent = String(summary.total_miss);
  if (resPhaseRes) resPhaseRes.textContent = String(state.bossPhase);
  if (resBossCleared) resBossCleared.textContent = String(summary.bosses_cleared);
  if (resAcc) resAcc.textContent = summary.accuracy_pct.toFixed(1) + ' %';
  if (resGrade) resGrade.textContent = summary.grade;

  showView('result');
}

/* start game */
function startGame(mode, researchMeta) {
  const diffKey = (diffSel && diffSel.value) || 'normal';
  const durationSec = parseInt((timeSel && timeSel.value) || '60', 10) || 60;

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
    researchMeta: researchMeta || null,
    rtNormalSum: 0,
    rtNormalCount: 0,
    rtDecoySum: 0,
    rtDecoyCount: 0
  };

  if (wrap) { wrap.dataset.diff = diffKey; wrap.dataset.phase = '1'; wrap.dataset.boss = '0'; }

  ensureRenderer().setDifficulty(diffKey);
  updateBossUi();
  updateHpBars();
  updateFeverUi(state.startedAt);

  showView('play');

  state.lastTickAt = performance.now();
  gameLoopId = requestAnimationFrame(gameLoop);
  scheduleNextSpawn();
}

/* init */
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
    bossPhaseLabel = document.getElementById('sb-boss-phase-label');
    bossShieldLabel = document.getElementById('sb-boss-shield-label');

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
    resAcc = document.getElementById('sb-res-acc');
    resGrade = document.getElementById('sb-res-grade');

    inputPartId = document.getElementById('sb-participant-id');
    inputPartGroup = document.getElementById('sb-participant-group');
    inputPartNote = document.getElementById('sb-participant-note');
  }

  if (!wrap || !targetLayer) {
    console.warn('[ShadowBreaker] Missing core DOM (sb-wrap or sb-target-layer).');
    return;
  }

  if (!wired) {
    wired = true;

    if (btnPlay) btnPlay.addEventListener('click', () => startGame('play', null));

    if (btnResearch) {
      btnResearch.addEventListener('click', () => {
        const pid = inputPartId ? inputPartId.value.trim() : '';
        const group = inputPartGroup ? inputPartGroup.value.trim() : '';
        const note = inputPartNote ? inputPartNote.value.trim() : '';
        if (!pid || !group) {
          alert('กรุณากรอกรหัสผู้เข้าร่วม และเลือก/กรอกกลุ่ม ให้ครบก่อนเข้า "โหมดวิจัย"');
          return;
        }
        startGame('research', { id: pid, group, note });
      });
    }

    if (btnBackFromPlay) {
      btnBackFromPlay.addEventListener('click', () => {
        if (state && state.running) endGame('stop-early');
        showView('menu');
      });
    }

    if (btnPauseToggle) {
      btnPauseToggle.addEventListener('change', (e) => {
        if (e.target.checked && state && state.running) endGame('stop-early');
      });
    }

    if (btnResultRetry) {
      btnResultRetry.addEventListener('click', () => {
        if (state && state.mode === 'research' && state.researchMeta) startGame('research', state.researchMeta);
        else startGame('play', null);
      });
    }

    if (btnResultMenu) btnResultMenu.addEventListener('click', () => showView('menu'));

    if (btnDownloadEvents) btnDownloadEvents.addEventListener('click', () => downloadCsv('shadow-breaker-events.csv', eventLogger.toCsv()));
    if (btnDownloadSession) btnDownloadSession.addEventListener('click', () => downloadCsv('shadow-breaker-session.csv', sessionLogger.toCsv()));
  }

  resetHud();
  updateBossUi();
  showView('menu');

  console.log('[ShadowBreaker] init complete');
}