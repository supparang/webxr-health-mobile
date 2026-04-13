// /herohealth/vr-brush-kids/brush.js
// Brush V5 — first playable skeleton
// PATCH v20260413-brush-v5-first-playable-skeleton

import {
  GAME_ID,
  GAME_VARIANT,
  GAME_TITLE,
  SCENE_IDS,
  MODE_CONFIG,
  ZONE_DEFS,
  COACH_LINES,
  THREAT_RULES,
  FEVER_RULES,
  SCORE_RULES
} from './brush.constants.js';

import { createBrushUI } from './brush.ui.js';
import { createBrushLogger } from './brush.logger.js';
import { buildBrushV5Result } from './brush.summary.js';
import { createBrushScanEngine } from './brush.scan.js';
import { createBrushBossBreakEngine } from './brush.bossbreak.js';
import { createBrushStorage } from './brush.storage.js';
import { createBrushAudio } from './brush.audio.js';

const qs = new URLSearchParams(location.search);

const el = {
  app: document.getElementById('brushApp'),
  sceneStage: document.getElementById('sceneStage'),

  timeText: document.getElementById('timeText'),
  scoreText: document.getElementById('scoreText'),
  comboText: document.getElementById('comboText'),
  threatText: document.getElementById('threatText'),
  sceneText: document.getElementById('sceneText'),

  coachFace: document.getElementById('coachFace'),
  coachLine: document.getElementById('coachLine'),

  scanTimerText: document.getElementById('scanTimerText'),
  scanFoundText: document.getElementById('scanFoundText'),
  objectiveText: document.getElementById('objectiveText'),

  bossShieldText: document.getElementById('bossShieldText'),
  bossBreakTimerText: document.getElementById('bossBreakTimerText'),
  bossBreakCountText: document.getElementById('bossBreakCountText'),

  summaryModal: document.getElementById('summaryModal'),
  summaryRank: document.getElementById('summaryRank'),
  summaryScore: document.getElementById('summaryScore'),
  summaryCoverage: document.getElementById('summaryCoverage'),
  summaryAccuracy: document.getElementById('summaryAccuracy'),
  summaryAdvice: document.getElementById('summaryAdvice'),

  btnStart: document.getElementById('btnStart'),
  btnReplay: document.getElementById('btnReplay'),
  btnPause: document.getElementById('btnPause'),
  btnBackHub: document.getElementById('btnBackHub')
};

const ui = createBrushUI(el);
const storage = createBrushStorage();
const audio = createBrushAudio();

const ctx = readRunContext();
const logger = createBrushLogger(ctx);
const scanEngine = createBrushScanEngine();
const bossBreakEngine = createBrushBossBreakEngine();

const state = createInitialState(ctx);

init();

function init() {
  bindEvents();
  safeHideSummary();
  ui.renderCoach?.('🪥', 'พร้อมช่วยฟันแล้ว กดเริ่มได้เลย');
  renderFrame();
}

function readRunContext() {
  const modeId = qs.get('mode') || 'adventure';
  const mode = MODE_CONFIG[modeId] || MODE_CONFIG.adventure;

  return {
    sessionId: '',
    pid: qs.get('pid') || 'anon',
    name: qs.get('name') || 'Hero',
    studyId: qs.get('studyId') || '',
    phase: qs.get('phase') || '',
    conditionGroup: qs.get('conditionGroup') || '',
    modeId: mode.id,
    modeLabel: mode.label,
    diff: qs.get('diff') || 'normal',
    view: qs.get('view') || 'mobile',
    runMode: qs.get('run') || 'play',
    seed: qs.get('seed') || '',
    hub: qs.get('hub') || '../hub.html',
    gameId: GAME_ID,
    gameVariant: GAME_VARIANT,
    gameTitle: GAME_TITLE
  };
}

function createZone(def, index) {
  const patternRotation = ['horizontal', 'circle', 'horizontal', 'vertical', 'circle', 'vertical'];

  return {
    id: def.id,
    label: def.label,
    order: index,
    cleanPercent: 0,
    threatPercent: 0,
    visited: false,
    done: false,
    hits: 0,
    misses: 0,
    dwellMs: 0,
    patternType: patternRotation[index] || 'horizontal',
    completedAtMs: 0
  };
}

function createZones() {
  return ZONE_DEFS.map(createZone);
}

function createInitialState(runCtx) {
  const mode = MODE_CONFIG[runCtx.modeId] || MODE_CONFIG.adventure;

  return {
    ctx: runCtx,
    running: false,
    paused: false,

    sceneId: SCENE_IDS.launcher,
    previousSceneId: '',
    sceneEnteredAtMs: 0,

    time: {
      startedAtIso: '',
      lastTs: 0,
      elapsedMs: 0,
      durationPlannedSec: mode.durationSec,
      remainingSec: mode.durationSec
    },

    score: {
      total: 0,
      combo: 0,
      comboMax: 0,
      feverActive: false,
      feverEndAtMs: 0
    },

    threat: {
      percent: 0
    },

    zones: createZones(),
    activeZoneId: 'upper-front',

    scan: {
      played: false,
      active: false,
      roundId: '',
      startedAtMs: 0,
      durationSec: 0,
      targetGoal: 0,
      hits: 0,
      misses: 0,
      specialHits: 0,
      accuracyPercent: 0,
      completedGoal: false,
      bonusType: '',
      bonusValue: 0,
      finishedInMs: 0
    },

    bossBreak: {
      played: false,
      active: false,
      roundId: '',
      startedAtMs: 0,
      durationSec: 0,
      targetGoal: 0,
      hits: 0,
      misses: 0,
      accuracyPercent: 0,
      success: false,
      damageWindowMs: 0,
      finishedInMs: 0
    },

    boss: {
      active: false,
      bossId: 'plaque-king',
      phase: 'shield',
      hpPercent: 100,
      weakPointHits: 0,
      cleared: false,
      damageWindowEndAtMs: 0
    },

    metrics: {
      hits: 0,
      misses: 0,
      warnings: 0,
      phaseStats: makePhaseStats(),
      lastAdvice: ''
    }
  };
}

function makePhaseStats() {
  return {
    intro: makePhaseStat(),
    scan: makePhaseStat(),
    guided: makePhaseStat(),
    pressure: makePhaseStat(),
    fever: makePhaseStat(),
    bossBreak: makePhaseStat(),
    boss: makePhaseStat()
  };
}

function makePhaseStat() {
  return {
    durationMs: 0,
    attempts: 0,
    valid: 0,
    cleanGain: 0,
    scoreGain: 0
  };
}

function bindEvents() {
  el.btnStart?.addEventListener('click', async () => {
    await audio.unlock();
    startGame();
  });

  el.btnReplay?.addEventListener('click', async () => {
    await audio.unlock();
    replayGame();
  });

  el.btnPause?.addEventListener('click', () => {
    togglePause();
  });

  el.btnBackHub?.addEventListener('click', () => {
    backToHub();
  });

  document.querySelectorAll('[data-zone]').forEach((node) => {
    node.addEventListener('click', () => {
      const zoneId = node.getAttribute('data-zone') || '';
      if (!zoneId) return;
      onZoneSelect(zoneId, 'manual');
    });
  });

  window.addEventListener('keydown', (e) => {
    if (!state.running || state.paused) return;

    if (e.code === 'Space') {
      e.preventDefault();
      simulateBrushHit();
    }

    if (e.code === 'KeyQ') onZoneSelect('upper-left', 'keyboard');
    if (e.code === 'KeyW') onZoneSelect('upper-front', 'keyboard');
    if (e.code === 'KeyE') onZoneSelect('upper-right', 'keyboard');
    if (e.code === 'KeyA') onZoneSelect('lower-left', 'keyboard');
    if (e.code === 'KeyS') onZoneSelect('lower-front', 'keyboard');
    if (e.code === 'KeyD') onZoneSelect('lower-right', 'keyboard');
  });

  window.addEventListener('beforeunload', () => {
    try {
      logger.flush();
    } catch {}
  });
}

function safeHideSummary() {
  if (el.summaryModal) el.summaryModal.hidden = true;
}

function startGame() {
  const fresh = createInitialState(ctx);
  Object.assign(state, fresh);

  safeHideSummary();

  state.running = true;
  state.paused = false;
  state.time.startedAtIso = new Date().toISOString();
  state.time.lastTs = performance.now();

  logger.startSession({
    pid: state.ctx.pid,
    modeId: state.ctx.modeId,
    modeLabel: state.ctx.modeLabel,
    diff: state.ctx.diff,
    view: state.ctx.view,
    durationPlannedSec: state.time.durationPlannedSec
  });

  logger.event('brush_mission_start_click', {
    modeId: state.ctx.modeId,
    diff: state.ctx.diff,
    view: state.ctx.view
  });

  enterScene(SCENE_IDS.intro);
  requestAnimationFrame(tick);
}

function replayGame() {
  startGame();
}

function togglePause() {
  if (!state.running) return;

  state.paused = !state.paused;

  logger.event(state.paused ? 'brush_pause' : 'brush_resume', {
    sceneId: state.sceneId,
    elapsedMs: Math.round(state.time.elapsedMs)
  });

  if (!state.paused) {
    state.time.lastTs = performance.now();
    requestAnimationFrame(tick);
  }

  ui.renderCoach?.(state.paused ? '⏸️' : '🪥', state.paused ? 'พักเกมอยู่' : 'กลับมาเล่นต่อแล้ว');
}

function backToHub() {
  logger.event('brush_back_hub_click', {
    sceneId: state.sceneId,
    elapsedMs: Math.round(state.time.elapsedMs)
  });
  logger.flush();
  location.href = state.ctx.hub;
}

function tick(ts) {
  if (!state.running || state.paused) return;

  const dt = Math.max(0, ts - state.time.lastTs);
  state.time.lastTs = ts;

  state.time.elapsedMs += dt;
  state.time.remainingSec = Math.max(
    0,
    state.time.durationPlannedSec - Math.floor(state.time.elapsedMs / 1000)
  );

  accumulatePhaseDuration(state.sceneId, dt);
  updateScene(dt);
  updateGlobalSystems(dt);
  renderFrame();

  if (
    state.time.remainingSec <= 0 &&
    state.sceneId !== SCENE_IDS.finish &&
    state.sceneId !== SCENE_IDS.summary
  ) {
    enterScene(SCENE_IDS.finish, { reason: 'timer_end' });
    return;
  }

  requestAnimationFrame(tick);
}

function accumulatePhaseDuration(sceneId, dt) {
  const stat = state.metrics.phaseStats?.[sceneId];
  if (stat) stat.durationMs += dt;
}

function updateScene(dt) {
  switch (state.sceneId) {
    case SCENE_IDS.intro:
      updateIntro(dt);
      return;
    case SCENE_IDS.scan:
      updateScan(dt);
      return;
    case SCENE_IDS.guided:
      updateGuided(dt);
      return;
    case SCENE_IDS.pressure:
      updatePressure(dt);
      return;
    case SCENE_IDS.bossBreak:
      updateBossBreak(dt);
      return;
    case SCENE_IDS.boss:
      updateBoss(dt);
      return;
    case SCENE_IDS.finish:
      updateFinish(dt);
      return;
    default:
      return;
  }
}

function updateIntro() {
  const sceneAge = performance.now() - state.sceneEnteredAtMs;
  if (sceneAge >= 1600) {
    enterScene(SCENE_IDS.scan);
  }
}

function updateScan(dt) {
  scanEngine.tick(dt);

  if (scanEngine.isComplete()) {
    completeScanMiniGame(scanEngine.buildResult());
  }
}

function updateGuided() {
  const sceneAge = performance.now() - state.sceneEnteredAtMs;
  if (sceneAge >= 12000) {
    enterScene(SCENE_IDS.pressure);
  }
}

function updatePressure() {
  if (
    !state.score.feverActive &&
    state.score.combo >= FEVER_RULES.comboThreshold
  ) {
    startFever('combo');
  }

  const sceneAge = performance.now() - state.sceneEnteredAtMs;
  if (sceneAge >= 42000) {
    enterScene(SCENE_IDS.bossBreak);
  }
}

function updateBossBreak(dt) {
  bossBreakEngine.tick(dt);

  if (bossBreakEngine.isComplete()) {
    completeBossBreakMiniGame(bossBreakEngine.buildResult());
  }
}

function updateBoss() {
  const now = performance.now();

  if (
    state.boss.damageWindowEndAtMs > 0 &&
    now > state.boss.damageWindowEndAtMs &&
    !state.boss.cleared
  ) {
    state.boss.phase = 'shield';
    logger.event('brush_boss_damage_window_end', {
      bossId: state.boss.bossId,
      bossHpPercent: Math.round(state.boss.hpPercent)
    });
    enterScene(SCENE_IDS.finish, { reason: 'boss_window_end' });
  }

  if (state.boss.hpPercent <= 0 && !state.boss.cleared) {
    state.boss.cleared = true;
    logger.event('brush_boss_clear', {
      bossId: state.boss.bossId,
      weakPointHits: state.boss.weakPointHits
    });
    enterScene(SCENE_IDS.finish, { reason: 'boss_clear' });
  }
}

function updateFinish() {
  const sceneAge = performance.now() - state.sceneEnteredAtMs;
  if (sceneAge >= 1200) {
    enterScene(SCENE_IDS.summary);
  }
}

function updateGlobalSystems(dt) {
  const dtSec = dt / 1000;

  if (
    state.sceneId === SCENE_IDS.guided ||
    state.sceneId === SCENE_IDS.pressure ||
    state.sceneId === SCENE_IDS.boss
  ) {
    let rise = THREAT_RULES.passiveRisePerSec;

    if (state.sceneId === SCENE_IDS.pressure) rise += 1.5;
    if (state.sceneId === SCENE_IDS.boss) rise += 2;

    state.threat.percent = clamp(state.threat.percent + rise * dtSec, 0, 100);
  }

  if (state.score.feverActive && performance.now() >= state.score.feverEndAtMs) {
    endFever();
  }

  updateZoneThreatSpread(dtSec);
  updateActiveZoneAutoCompletion();
}

function updateZoneThreatSpread(dtSec) {
  const activeId = state.activeZoneId;

  state.zones.forEach((zone) => {
    if (zone.done) return;

    if (zone.id === activeId) {
      zone.threatPercent = clamp(zone.threatPercent - THREAT_RULES.cleanDropPerHit * dtSec, 0, 100);
      return;
    }

    zone.threatPercent = clamp(
      zone.threatPercent + THREAT_RULES.zoneIgnoredRisePerSec * 0.25 * dtSec,
      0,
      100
    );
  });
}

function updateActiveZoneAutoCompletion() {
  state.zones.forEach((zone) => {
    if (!zone.done && zone.cleanPercent >= 100) {
      zone.done = true;
      zone.completedAtMs = Math.round(state.time.elapsedMs);
    }
  });
}

function enterScene(sceneId, detail = {}) {
  state.previousSceneId = state.sceneId;
  state.sceneId = sceneId;
  state.sceneEnteredAtMs = performance.now();

  logger.setScene(sceneId);
  logger.event('brush_scene_enter', { sceneId, ...detail });

  switch (sceneId) {
    case SCENE_IDS.intro:
      ui.renderCoach?.('👀', randomPick(COACH_LINES.intro));
      logger.event('brush_intro_start', {
        highlightedZoneId: state.activeZoneId
      });
      break;

    case SCENE_IDS.scan:
      startScanMiniGame();
      break;

    case SCENE_IDS.guided:
      ui.renderCoach?.('🙂', randomPick(COACH_LINES.guided));
      logger.event('brush_guided_start', {
        activeZoneId: state.activeZoneId
      });
      break;

    case SCENE_IDS.pressure:
      ui.renderCoach?.('⚠️', randomPick(COACH_LINES.pressure));
      logger.event('brush_pressure_phase_start', {
        threatPercent: Math.round(state.threat.percent)
      });
      break;

    case SCENE_IDS.bossBreak:
      startBossBreakMiniGame();
      break;

    case SCENE_IDS.boss:
      startBossPhase();
      break;

    case SCENE_IDS.finish:
      ui.renderCoach?.('✨', randomPick(COACH_LINES.finish));
      logger.event('brush_finish_sequence_start', {
        bossCleared: state.boss.cleared
      });
      audio.victory();
      break;

    case SCENE_IDS.summary:
      finishGame();
      break;

    default:
      break;
  }

  renderFrame();
}

function startScanMiniGame() {
  const mode = MODE_CONFIG[state.ctx.modeId] || MODE_CONFIG.adventure;

  const scanState = scanEngine.start({
    durationSec: mode.scanSec,
    targetGoal: mode.targetScanCount
  });

  state.scan = {
    ...state.scan,
    ...scanState,
    played: true,
    active: true
  };

  logger.event('brush_scan_start', {
    scanRoundId: state.scan.roundId,
    scanTargetGoal: state.scan.targetGoal,
    scanDurationSec: state.scan.durationSec
  });

  ui.renderCoach?.('🔎', randomPick(COACH_LINES.scan));
}

function completeScanMiniGame(result) {
  state.scan = {
    ...state.scan,
    ...result,
    active: false
  };

  const scoreGain =
    (state.scan.hits || 0) * SCORE_RULES.scanHit +
    (state.scan.specialHits || 0) * (SCORE_RULES.scanSpecialHit - SCORE_RULES.scanHit);

  state.score.total += scoreGain;

  const scanStat = state.metrics.phaseStats.scan;
  scanStat.attempts += (state.scan.hits || 0) + (state.scan.misses || 0);
  scanStat.valid += (state.scan.hits || 0);
  scanStat.scoreGain += scoreGain;

  if ((state.scan.accuracyPercent || 0) >= 75) {
    state.scan.bonusType = 'threatReduction';
    state.scan.bonusValue = 10;
    state.threat.percent = clamp(state.threat.percent - 10, 0, 100);

    logger.event('brush_scan_bonus_awarded', {
      scanRoundId: state.scan.roundId,
      bonusType: state.scan.bonusType,
      bonusValue: state.scan.bonusValue
    });
  }

  logger.event('brush_scan_complete', {
    ...state.scan
  });

  enterScene(SCENE_IDS.guided);
}

function startBossBreakMiniGame() {
  const mode = MODE_CONFIG[state.ctx.modeId] || MODE_CONFIG.adventure;

  const bossBreakState = bossBreakEngine.start({
    durationSec: mode.bossBreakSec,
    targetGoal: 4
  });

  state.bossBreak = {
    ...state.bossBreak,
    ...bossBreakState,
    played: true,
    active: true
  };

  logger.event('brush_boss_break_start', {
    bossRoundId: state.bossBreak.roundId,
    targetGoal: state.bossBreak.targetGoal,
    timerSec: state.bossBreak.durationSec
  });

  ui.renderCoach?.('💥', randomPick(COACH_LINES.bossBreak));
}

function completeBossBreakMiniGame(result) {
  state.bossBreak = {
    ...state.bossBreak,
    ...result,
    active: false
  };

  const scoreGain = (state.bossBreak.hits || 0) * SCORE_RULES.bossBreakHit;
  state.score.total += scoreGain;
  state.boss.weakPointHits += state.bossBreak.hits || 0;

  const bossBreakStat = state.metrics.phaseStats.bossBreak;
  bossBreakStat.attempts += (state.bossBreak.hits || 0) + (state.bossBreak.misses || 0);
  bossBreakStat.valid += (state.bossBreak.hits || 0);
  bossBreakStat.scoreGain += scoreGain;

  if (state.bossBreak.success) {
    state.score.total += SCORE_RULES.bossBreakPerfect;
    logger.event('brush_boss_break_success', { ...state.bossBreak });
    audio.shieldBreak();
  } else {
    logger.event('brush_boss_break_fail', { ...state.bossBreak });
  }

  enterScene(SCENE_IDS.boss);
}

function startBossPhase() {
  state.boss.active = true;
  state.boss.phase = 'burst';
  state.boss.damageWindowEndAtMs = performance.now() + (state.bossBreak.damageWindowMs || 2500);

  logger.event('brush_boss_start', {
    bossId: state.boss.bossId,
    bossType: 'plaqueKing',
    damageWindowMs: state.bossBreak.damageWindowMs || 2500
  });

  logger.event('brush_boss_damage_window_open', {
    bossId: state.boss.bossId,
    damageWindowMs: state.boss.damageWindowEndAtMs - performance.now()
  });

  ui.renderCoach?.('👑', randomPick(COACH_LINES.boss));
}

function onZoneSelect(zoneId, source = 'manual') {
  if (!state.running) return;

  const zone = state.zones.find((z) => z.id === zoneId);
  if (!zone) return;

  const previousZoneId = state.activeZoneId;
  state.activeZoneId = zoneId;
  zone.visited = true;

  logger.event('brush_zone_select', {
    zoneId,
    zoneLabel: zone.label,
    source,
    previousZoneId
  });

  ui.renderCoach?.('🦷', `ตอนนี้ช่วยโซน ${zone.label}`);
  renderFrame();
}

function simulateBrushHit() {
  if (!state.running || state.paused) return;
  if (![SCENE_IDS.guided, SCENE_IDS.pressure, SCENE_IDS.boss].includes(state.sceneId)) return;

  const zone = state.zones.find((z) => z.id === state.activeZoneId);
  if (!zone) return;

  const scoreMultiplier = state.score.feverActive ? FEVER_RULES.scoreMultiplier : 1;
  const cleanMultiplier = state.score.feverActive ? FEVER_RULES.cleanMultiplier : 1;

  const cleanGain = 2 * cleanMultiplier;
  const scoreGain = SCORE_RULES.patternHit * scoreMultiplier;

  zone.cleanPercent = clamp(zone.cleanPercent + cleanGain, 0, 100);
  zone.threatPercent = clamp(zone.threatPercent - THREAT_RULES.cleanDropPerHit, 0, 100);
  zone.hits += 1;
  zone.visited = true;
  zone.dwellMs += 120;

  state.metrics.hits += 1;
  state.score.total += Math.round(scoreGain);
  state.score.combo += 1;
  state.score.comboMax = Math.max(state.score.comboMax, state.score.combo);
  state.threat.percent = clamp(state.threat.percent - THREAT_RULES.cleanDropPerHit, 0, 100);

  const stat = state.metrics.phaseStats[state.sceneId];
  if (stat) {
    stat.attempts += 1;
    stat.valid += 1;
    stat.cleanGain += cleanGain;
    stat.scoreGain += scoreGain;
  }

  logger.event('brush_pattern_hit', {
    zoneId: zone.id,
    zoneLabel: zone.label,
    patternType: zone.patternType,
    cleanGain,
    combo: state.score.combo,
    threatPercent: Math.round(state.threat.percent)
  });

  if (state.sceneId === SCENE_IDS.boss) {
    const bossDamage = state.score.feverActive ? 10 : 6;
    state.boss.hpPercent = clamp(state.boss.hpPercent - bossDamage, 0, 100);

    logger.event('brush_boss_hit', {
      bossId: state.boss.bossId,
      bossHpPercent: Math.round(state.boss.hpPercent),
      damage: bossDamage
    });
  }

  if (!state.score.feverActive && state.score.combo >= FEVER_RULES.comboThreshold) {
    startFever('combo');
  }

  if (!zone.done && zone.cleanPercent >= 100) {
    zone.done = true;
    zone.completedAtMs = Math.round(state.time.elapsedMs);
    state.score.total += SCORE_RULES.zoneComplete;

    logger.event('brush_zone_complete', {
      zoneId: zone.id,
      zoneLabel: zone.label,
      completedAtMs: zone.completedAtMs
    });

    audio.zoneComplete();
  }

  audio.hit();
  renderFrame();
}

function simulateBrushMiss(reason = 'wrongPattern') {
  if (!state.running || state.paused) return;

  const zone = state.zones.find((z) => z.id === state.activeZoneId);
  if (zone) zone.misses += 1;

  state.metrics.misses += 1;
  state.metrics.warnings += 1;

  const stat = state.metrics.phaseStats[state.sceneId];
  if (stat) stat.attempts += 1;

  logger.event('brush_pattern_miss', {
    zoneId: zone?.id || '',
    zoneLabel: zone?.label || '',
    missReason: reason,
    comboBeforeBreak: state.score.combo
  });

  state.score.combo = 0;
  audio.miss();
  renderFrame();
}

function startFever(triggerType = 'combo') {
  state.score.feverActive = true;
  state.score.feverEndAtMs = performance.now() + FEVER_RULES.durationMs;

  logger.event('brush_fever_start', {
    triggerType,
    multiplier: FEVER_RULES.scoreMultiplier,
    durationMs: FEVER_RULES.durationMs
  });

  ui.renderCoach?.('🔥', randomPick(COACH_LINES.fever));
  audio.feverStart();
}

function endFever() {
  state.score.feverActive = false;
  state.score.feverEndAtMs = 0;

  logger.event('brush_fever_end', {
    comboMax: state.score.comboMax
  });
}

function renderFrame() {
  const accuracyPercent = getRunningAccuracyPercent();
  const coveragePercent = getRunningCoveragePercent();

  ui.renderTopHud?.({
    timeText: `${state.time.remainingSec}s`,
    scoreText: state.score.total,
    comboText: state.score.combo,
    threatText: `${Math.round(state.threat.percent)}%`,
    sceneText: state.sceneId,
    accuracyText: `${accuracyPercent}%`,
    coverageText: `${coveragePercent}%`,
    feverActive: state.score.feverActive
  });

  ui.renderMiniMap?.(
    state.zones.map((z) => ({
      ...z,
      active: z.id === state.activeZoneId
    }))
  );

  if (state.sceneId === SCENE_IDS.scan && state.scan.active) {
    const remain = Math.max(
      0,
      Math.ceil(state.scan.durationSec - ((performance.now() - state.scan.startedAtMs) / 1000))
    );

    ui.renderScanHud?.({
      timerText: `${remain}s`,
      foundText: `${state.scan.hits || 0} / ${state.scan.targetGoal || 0}`,
      objectiveText: 'หาจุดสกปรกอันตราย'
    });
  } else {
    ui.renderScanHud?.({
      timerText: '',
      foundText: '',
      objectiveText: ''
    });
  }

  if (state.sceneId === SCENE_IDS.bossBreak && state.bossBreak.active) {
    const remain = Math.max(
      0,
      Math.ceil(state.bossBreak.durationSec - ((performance.now() - state.bossBreak.startedAtMs) / 1000))
    );

    ui.renderBossBreakHud?.({
      shieldText: `${Math.max(0, (state.bossBreak.targetGoal || 0) - (state.bossBreak.hits || 0))}`,
      timerText: `${remain}s`,
      countText: `${state.bossBreak.hits || 0} / ${state.bossBreak.targetGoal || 0}`
    });
  } else {
    ui.renderBossBreakHud?.({
      shieldText: '',
      timerText: '',
      countText: ''
    });
  }
}

function finishGame() {
  state.running = false;

  const result = buildBrushV5Result({
    state,
    ctx: {
      ...state.ctx,
      sessionId: logger.sessionId
    }
  });

  storage.saveLastResult(result);
  storage.appendCsvRow(result.csvRow);

  logger.event('brush_summary_show', {
    finalRank: result.finalRank,
    finalScore: result.finalScore,
    coveragePercent: result.coveragePercent,
    accuracyPercent: result.accuracyPercent
  });

  logger.finish(result);
  logger.flush();

  ui.renderSummary?.(result);
}

function getRunningCoveragePercent() {
  const total = state.zones.reduce((acc, z) => acc + (z.cleanPercent || 0), 0);
  return Math.round(total / Math.max(1, state.zones.length));
}

function getRunningAccuracyPercent() {
  const attempts = state.metrics.hits + state.metrics.misses;
  return attempts ? Math.round((state.metrics.hits / attempts) * 100) : 0;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// debug hooks
window.brushHit = simulateBrushHit;
window.brushMiss = simulateBrushMiss;
window.brushScanPick = (id) => {
  const result = scanEngine.pickTarget(id);
  if (!result?.ok) return result;

  if (result.hit) {
    state.scan.hits = (state.scan.hits || 0) + 1;
    if (result.target?.special) {
      state.scan.specialHits = (state.scan.specialHits || 0) + 1;
    }
    logger.event('brush_scan_hit', {
      scanRoundId: state.scan.roundId,
      targetId: result.target?.id || id,
      targetType: result.target?.type || '',
      zoneId: result.target?.zoneId || '',
      special: !!result.target?.special
    });
    audio.scanHit();
  } else {
    state.scan.misses = (state.scan.misses || 0) + 1;
    logger.event('brush_scan_miss', {
      scanRoundId: state.scan.roundId,
      targetId: id
    });
    audio.miss();
  }

  renderFrame();
  return result;
};

window.brushBossBreakHit = (id) => {
  const result = bossBreakEngine.hitWeakPoint(id);
  if (!result) return result;

  if (result.hit) {
    state.bossBreak.hits = (state.bossBreak.hits || 0) + 1;
    logger.event('brush_boss_break_hit', {
      bossRoundId: state.bossBreak.roundId,
      weakPointId: id,
      hitIndex: state.bossBreak.hits
    });
    audio.bossBreakHit();
  } else if (result.miss) {
    state.bossBreak.misses = (state.bossBreak.misses || 0) + 1;
    logger.event('brush_boss_break_miss', {
      bossRoundId: state.bossBreak.roundId,
      weakPointId: id
    });
    audio.miss();
  }

  renderFrame();
  return result;
};