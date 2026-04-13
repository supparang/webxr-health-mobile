// /herohealth/vr-brush-kids/brush.js
// Brush V5 — first playable integrated build

import {
  GAME_ID,
  GAME_VARIANT,
  GAME_TITLE,
  SCENE_IDS,
  MODE_CONFIG,
  ZONE_DEFS,
  PATTERN_META,
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
  btnBackHub: document.getElementById('btnBackHub'),

  objectiveCard: document.getElementById('objectiveCard'),
  scanCard: document.getElementById('scanCard'),
  bossCard: document.getElementById('bossCard'),
  helperCard: document.getElementById('helperCard'),
  mouthTargets: document.getElementById('mouthTargets'),
  sceneMoodOverlay: document.getElementById('sceneMoodOverlay'),
  sceneSparkleOverlay: document.getElementById('sceneSparkleOverlay'),

  plaqueLayer: document.getElementById('plaqueLayer'),
  scanTargetLayer: document.getElementById('scanTargetLayer'),
  bossWeakPointLayer: document.getElementById('bossWeakPointLayer'),
  fxLayer: document.getElementById('fxLayer'),
  brushTrailLayer: document.getElementById('brushTrailLayer'),

  brushInputLayer: document.getElementById('brushInputLayer'),
  brushCursor: document.getElementById('brushCursor'),

  patternTutorLayer: document.getElementById('patternTutorLayer'),
  patternTutor: document.getElementById('patternTutor'),
  patternTutorGlyph: document.getElementById('patternTutorGlyph'),
  patternTutorLabel: document.getElementById('patternTutorLabel'),

  bossVisualLayer: document.getElementById('bossVisualLayer'),
  bossBody: document.getElementById('bossBody'),
  bossShield: document.getElementById('bossShield'),

  scorePopupLayer: document.getElementById('scorePopupLayer')
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
  bindBrushInputLayer();
  safeHideSummary();
  ui.renderLauncherHint?.(state.ctx.modeLabel || 'Adventure');
  syncScenePresentation(SCENE_IDS.launcher);
  el.brushInputLayer?.classList.add('is-idle');
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

    brushInput: {
      active: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
      lastHitAtMs: 0,
      totalDragPx: 0,
      prevDx: 0,
      prevDy: 0,
      lastQuality: '',
      lastQualityAtMs: 0
    },

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
      finishedInMs: 0,
      targets: [],
      picked: new Set()
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

function bindBrushInputLayer() {
  const layer = el.brushInputLayer;
  if (!layer) return;

  layer.addEventListener('pointerdown', onBrushPointerDown);
  layer.addEventListener('pointermove', onBrushPointerMove);
  layer.addEventListener('pointerup', onBrushPointerUp);
  layer.addEventListener('pointercancel', onBrushPointerUp);
  layer.addEventListener('pointerleave', onBrushPointerUp);
}

function onBrushPointerDown(e) {
  if (!state.running || state.paused) return;
  if (!isBrushInputScene(state.sceneId)) return;

  const point = getPointFromEvent(e);

  state.brushInput.active = true;
  state.brushInput.pointerId = e.pointerId;
  state.brushInput.lastX = point.x;
  state.brushInput.lastY = point.y;
  state.brushInput.lastHitAtMs = 0;
  state.brushInput.totalDragPx = 0;

  el.brushInputLayer?.classList.add('is-active');
  el.brushInputLayer?.classList.remove('is-idle');

  try {
    el.brushInputLayer?.setPointerCapture?.(e.pointerId);
  } catch {}

  updateBrushCursorFromPoint(point);
}

function onBrushPointerMove(e) {
  if (!state.brushInput.active) return;
  if (state.brushInput.pointerId !== e.pointerId) return;
  if (!isBrushInputScene(state.sceneId)) return;

  const point = getPointFromEvent(e);
  const dx = point.x - state.brushInput.lastX;
  const dy = point.y - state.brushInput.lastY;
  const dist = distance2d(point.x, point.y, state.brushInput.lastX, state.brushInput.lastY);
  const now = performance.now();

  state.brushInput.totalDragPx += dist;

  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
  updateBrushCursorFromPoint(point, Number.isFinite(angleDeg) ? angleDeg : -18);

  const enoughDistance = dist >= brushDragDistanceThresholdPx();
  const enoughTime = (now - state.brushInput.lastHitAtMs) >= brushHitThrottleMs();

  if (dist > 3) {
    ui.playTrailAt?.(point.x, point.y, 'weak');
  }

  if (enoughDistance && enoughTime) {
    const dragDirection = detectBrushDirection(dx, dy);

    simulateBrushHit({
      point,
      dx,
      dy,
      dist,
      dragDirection
    });

    state.brushInput.lastHitAtMs = now;
  }

  state.brushInput.prevDx = dx;
  state.brushInput.prevDy = dy;
  state.brushInput.lastX = point.x;
  state.brushInput.lastY = point.y;
}

function onBrushPointerUp(e) {
  if (state.brushInput.pointerId !== null && e.pointerId !== state.brushInput.pointerId) return;
  resetBrushInputState();
  el.brushInputLayer?.classList.remove('is-active');
  el.brushInputLayer?.classList.add('is-idle');
  hideBrushCursor();
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
  resetBrushInputState();
  hideBrushCursor();

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

  syncScenePresentation(SCENE_IDS.intro);
  enterScene(SCENE_IDS.intro);
  requestAnimationFrame(tick);
}

function replayGame() {
  safeHideSummary();
  ui.renderLauncherHint?.(state.ctx.modeLabel || 'Adventure');
  syncScenePresentation(SCENE_IDS.launcher);
  startGame();
}

function togglePause() {
  if (!state.running) return;

  state.paused = !state.paused;
  if (state.paused) {
    resetBrushInputState();
    hideBrushCursor();
  }

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
      updateIntro();
      return;
    case SCENE_IDS.scan:
      updateScan(dt);
      return;
    case SCENE_IDS.guided:
      updateGuided();
      return;
    case SCENE_IDS.pressure:
      updatePressure();
      return;
    case SCENE_IDS.bossBreak:
      updateBossBreak(dt);
      return;
    case SCENE_IDS.boss:
      updateBoss();
      return;
    case SCENE_IDS.finish:
      updateFinish();
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
    Math.floor(state.score.combo) >= FEVER_RULES.comboThreshold
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

  syncScenePresentation(sceneId);

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
  ui.renderObjective?.(`หาจุดสกปรกอันตราย ${state.scan.targetGoal} จุด`, SCENE_IDS.scan);
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
    state.zones.forEach((z) => {
      z.threatPercent = clamp(z.threatPercent - 8, 0, 100);
    });

    logger.event('brush_scan_bonus_awarded', {
      scanRoundId: state.scan.roundId,
      bonusType: state.scan.bonusType,
      bonusValue: state.scan.bonusValue
    });
  }

  logger.event('brush_scan_complete', { ...state.scan });
  ui.renderObjective?.('เริ่มแปรงตามทิศที่โค้ชแนะนำ', SCENE_IDS.guided);

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
  ui.renderObjective?.(`ทำลายจุดอ่อนให้ครบ ${state.bossBreak.targetGoal} จุด`, SCENE_IDS.bossBreak);
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
    ui.showScorePopup?.(50, 34, 'SHIELD BREAK', 'boss');
    audio.shieldBreak();
  } else {
    logger.event('brush_boss_break_fail', { ...state.bossBreak });
    ui.showScorePopup?.(50, 34, 'BREAK FAIL', 'bad');
  }

  enterScene(SCENE_IDS.boss);
}

function startBossPhase() {
  state.boss.active = true;
  state.boss.phase = 'burst';
  state.boss.damageWindowEndAtMs = performance.now() + (state.bossBreak.damageWindowMs || 2500);

  if (!state.bossBreak.success) {
    state.boss.phase = 'shield';
  }

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
  ui.renderObjective?.('โล่แตกแล้ว รีบแปรงโจมตีบอส!', SCENE_IDS.boss);
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

function isBrushPlayableScene(sceneId) {
  return sceneId === SCENE_IDS.guided ||
         sceneId === SCENE_IDS.pressure ||
         sceneId === SCENE_IDS.boss;
}

function isBrushInputScene(sceneId) {
  return isBrushPlayableScene(sceneId);
}

function getPointFromEvent(e) {
  return {
    x: Number(e.clientX || 0),
    y: Number(e.clientY || 0)
  };
}

function distance2d(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function updateBrushCursorFromPoint(point, angleDeg = -18) {
  if (!el.brushCursor) return;
  el.brushCursor.hidden = false;
  el.brushCursor.style.left = `${point.x}px`;
  el.brushCursor.style.top = `${point.y}px`;
  el.brushCursor.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
}

function hideBrushCursor() {
  if (!el.brushCursor) return;
  el.brushCursor.hidden = true;
}

function brushHitThrottleMs() {
  if (state.ctx.view === 'mobile') return 95;
  if (state.ctx.view === 'cvr') return 120;
  return 80;
}

function brushDragDistanceThresholdPx() {
  if (state.ctx.view === 'mobile') return 18;
  return 14;
}

function resetBrushInputState() {
  state.brushInput.active = false;
  state.brushInput.pointerId = null;
  state.brushInput.lastX = 0;
  state.brushInput.lastY = 0;
  state.brushInput.lastHitAtMs = 0;
  state.brushInput.totalDragPx = 0;
  state.brushInput.prevDx = 0;
  state.brushInput.prevDy = 0;
  state.brushInput.lastQuality = '';
  state.brushInput.lastQualityAtMs = 0;
}

function detectBrushDirection(dx, dy) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  if (ax < 2 && ay < 2) return 'none';
  if (ax > ay * 1.35) return 'horizontal';
  if (ay > ax * 1.35) return 'vertical';
  return 'circle';
}

function getPatternMatchScore(expectedPattern, dragDirection) {
  if (!expectedPattern || dragDirection === 'none') return 0;
  if (expectedPattern === dragDirection) return 1;

  if (
    (expectedPattern === 'horizontal' && dragDirection === 'circle') ||
    (expectedPattern === 'vertical' && dragDirection === 'circle')
  ) {
    return 0.45;
  }

  if (
    expectedPattern === 'circle' &&
    (dragDirection === 'horizontal' || dragDirection === 'vertical')
  ) {
    return 0.35;
  }

  return 0;
}

function getPatternResultLabel(score) {
  if (score >= 0.85) return 'perfect';
  if (score >= 0.45) return 'ok';
  return 'bad';
}

function getZoneAnchorMap() {
  return {
    'upper-left':   { x: 22, y: 34 },
    'upper-front':  { x: 50, y: 24 },
    'upper-right':  { x: 78, y: 34 },
    'lower-left':   { x: 22, y: 68 },
    'lower-front':  { x: 50, y: 78 },
    'lower-right':  { x: 78, y: 68 }
  };
}

function getZoneAnchor(zoneId) {
  return getZoneAnchorMap()[zoneId] || { x: 50, y: 50 };
}

function getPlaqueOffsetsByPattern(patternType = 'horizontal') {
  if (patternType === 'vertical') {
    return [
      { dx: 0, dy: -10, type: 'light' },
      { dx: 0, dy: 8, type: 'gap' },
      { dx: -8, dy: 18, type: 'light' },
      { dx: 10, dy: -20, type: 'heavy' },
      { dx: 12, dy: 24, type: 'gap' }
    ];
  }

  if (patternType === 'circle') {
    return [
      { dx: -10, dy: -8, type: 'light' },
      { dx: 12, dy: -6, type: 'gap' },
      { dx: 0, dy: 14, type: 'heavy' },
      { dx: -14, dy: 18, type: 'gap' },
      { dx: 16, dy: 18, type: 'light' }
    ];
  }

  return [
    { dx: -14, dy: 0, type: 'light' },
    { dx: 0, dy: -10, type: 'gap' },
    { dx: 16, dy: 2, type: 'heavy' },
    { dx: -8, dy: 18, type: 'light' },
    { dx: 10, dy: 18, type: 'gap' }
  ];
}

function getVisiblePlaqueCount(cleanPercent, threatPercent) {
  const dirty = Math.max(0, 100 - (cleanPercent || 0));
  const pressureBoost = threatPercent >= 70 ? 1 : 0;

  if (dirty >= 85) return 5 + pressureBoost;
  if (dirty >= 65) return 4 + pressureBoost;
  if (dirty >= 45) return 3 + pressureBoost;
  if (dirty >= 20) return 2;
  if (dirty > 0) return 1;
  return 0;
}

function getPlaqueLevelClass(cleanPercent) {
  const dirty = Math.max(0, 100 - (cleanPercent || 0));
  if (dirty >= 70) return 'high';
  if (dirty >= 35) return 'mid';
  if (dirty > 0) return 'low';
  return 'low';
}

function buildPlaqueVisuals() {
  const items = [];

  state.zones.forEach((zone) => {
    const anchor = getZoneAnchor(zone.id);
    const clean = Math.round(zone.cleanPercent || 0);
    const threat = Math.round(zone.threatPercent || 0);
    const count = getVisiblePlaqueCount(clean, threat);
    const offsets = getPlaqueOffsetsByPattern(zone.patternType);
    const levelClass = getPlaqueLevelClass(clean);
    const active = zone.id === state.activeZoneId;

    for (let i = 0; i < Math.min(count, offsets.length); i++) {
      const off = offsets[i];
      items.push({
        id: `${zone.id}-plaque-${i + 1}`,
        zoneId: zone.id,
        x: anchor.x + off.dx,
        y: anchor.y + off.dy,
        type: off.type,
        hidden: zone.done || clean >= 100,
        dim: clean > 72 && !zone.done,
        active,
        levelClass,
        rank: i + 1
      });
    }
  });

  return items;
}

function buildScanTargetVisuals() {
  if (!state.scan?.active) return [];

  const targets = ensureArray(state.scan.targets || []);
  return targets.map((t) => {
    const anchor = getZoneAnchor(t.zoneId);
    const offsetMap = {
      heavyPlaque: { dx: 0, dy: 0 },
      gumRisk: { dx: -4, dy: -6 },
      gapFood: { dx: 6, dy: 5 },
      decoy: { dx: 0, dy: -10 }
    };
    const off = offsetMap[t.type] || { dx: 0, dy: 0 };

    return {
      id: t.id,
      zoneId: t.zoneId,
      x: anchor.x + off.dx,
      y: anchor.y + off.dy,
      special: !!t.special,
      picked: !!state.scan.picked?.has?.(t.id)
    };
  });
}

function buildBossWeakPointVisuals() {
  if (!state.bossBreak?.active) return [];

  const base = [
    { id: 'wp-1', x: 40, y: 36 },
    { id: 'wp-2', x: 60, y: 36 },
    { id: 'wp-3', x: 50, y: 52 },
    { id: 'wp-4', x: 34, y: 62 },
    { id: 'wp-5', x: 66, y: 62 }
  ];

  const activeCount = Math.max(0, state.bossBreak.targetGoal || 0);
  const hits = state.bossBreak.hits || 0;

  return base.slice(0, activeCount).map((wp, index) => ({
    ...wp,
    hit: index < hits
  }));
}

function buildPatternTutorVm() {
  if (!isBrushPlayableScene(state.sceneId)) {
    return { visible: false };
  }

  const zone = state.zones.find((z) => z.id === state.activeZoneId);
  if (!zone) return { visible: false };

  const anchor = getZoneAnchor(zone.id);
  const meta = PATTERN_META[zone.patternType] || { label: zone.patternType };

  let glyph = '↔';
  if (zone.patternType === 'vertical') glyph = '↕';
  if (zone.patternType === 'circle') glyph = '⟳';

  const now = performance.now();
  const recentMs = now - (state.brushInput.lastQualityAtMs || 0);

  let quality = '';
  if (recentMs <= 520) {
    quality = state.brushInput.lastQuality || '';
  }

  let sceneTone = 'scene-guided';
  if (state.sceneId === SCENE_IDS.pressure || state.sceneId === SCENE_IDS.fever) {
    sceneTone = 'scene-pressure';
  } else if (state.sceneId === SCENE_IDS.boss) {
    sceneTone = 'scene-boss';
  }

  return {
    visible: true,
    x: anchor.x,
    y: anchor.y - 12,
    glyph,
    label: meta.label || zone.patternType,
    patternType: zone.patternType,
    quality,
    sceneTone
  };
}

function buildBossVisualVm() {
  const visible =
    state.sceneId === SCENE_IDS.bossBreak ||
    state.sceneId === SCENE_IDS.boss;

  if (!visible) {
    return {
      visible: false,
      shieldVisible: false,
      bossTone: '',
      hpPercent: 100,
      shieldRatio: 1
    };
  }

  let shieldRatio = 1;

  if (state.sceneId === SCENE_IDS.bossBreak) {
    const goal = Math.max(1, state.bossBreak.targetGoal || 1);
    const remain = Math.max(0, goal - (state.bossBreak.hits || 0));
    shieldRatio = remain / goal;
  } else if (state.sceneId === SCENE_IDS.boss) {
    shieldRatio = state.bossBreak.success ? 0 : 0.35;
  }

  let bossTone = 'is-break';
  if (state.sceneId === SCENE_IDS.boss) bossTone = 'is-burst';
  if ((state.boss.hpPercent || 100) <= 45) bossTone = 'is-weak';

  const hitFlash =
    state.sceneId === SCENE_IDS.boss &&
    (state.boss.hpPercent || 100) < 100;

  return {
    visible: true,
    shieldVisible: true,
    bossTone,
    hpPercent: Math.round(state.boss.hpPercent || 100),
    shieldRatio,
    hitFlash
  };
}

function maybeShowComboPopup(anchorX, anchorY) {
  const combo = Math.floor(state.score.combo || 0);
  if (combo > 0 && combo % 5 === 0) {
    ui.showScorePopup?.(anchorX, anchorY - 8, `COMBO x${combo}`, 'combo');
  }
}

function showPatternResultPopup(anchorX, anchorY, resultLabel, scoreGain) {
  if (resultLabel === 'perfect') {
    ui.showScorePopup?.(anchorX, anchorY - 4, `PERFECT +${Math.round(scoreGain)}`, 'perfect');
    return;
  }

  if (resultLabel === 'ok') {
    ui.showScorePopup?.(anchorX, anchorY - 4, `GOOD +${Math.round(scoreGain)}`, 'good');
    return;
  }

  ui.showScorePopup?.(anchorX, anchorY - 4, 'MISS', 'bad');
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
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

function simulateBrushHit(detail = {}) {
  if (!state.running || state.paused) return;
  if (![SCENE_IDS.guided, SCENE_IDS.pressure, SCENE_IDS.boss].includes(state.sceneId)) return;

  const zone = state.zones.find((z) => z.id === state.activeZoneId);
  if (!zone) return;
  if (zone.done && state.sceneId !== SCENE_IDS.boss) return;

  const dragDirection = detail.dragDirection || 'none';
  const matchScore = getPatternMatchScore(zone.patternType, dragDirection);
  const resultLabel = getPatternResultLabel(matchScore);

  const anchor = getZoneAnchor(zone.id);

  if (resultLabel === 'bad') {
    zone.misses += 1;
    state.metrics.misses += 1;
    state.metrics.warnings += 1;
    zone.threatPercent = clamp(zone.threatPercent + 2.5, 0, 100);

    const statBad = state.metrics.phaseStats[state.sceneId];
    if (statBad) statBad.attempts += 1;

    logger.event('brush_pattern_miss', {
      zoneId: zone.id,
      zoneLabel: zone.label,
      patternType: zone.patternType,
      dragDirection,
      missReason: 'wrongPattern',
      comboBeforeBreak: state.score.combo
    });

    state.brushInput.lastQuality = 'bad';
    state.brushInput.lastQualityAtMs = performance.now();

    state.score.combo = 0;
    ui.playTrailAt?.(detail.point?.x ?? 0, detail.point?.y ?? 0, 'bad');
    ui.playHitFxAt?.(anchor.x, anchor.y, 'miss');
    ui.showScorePopup?.(anchor.x, anchor.y - 4, 'MISS', 'bad');
    ui.renderCoach?.('😵', `โซน ${zone.label} ควรแปรงแบบ ${zone.patternType}`);
    audio.miss();
    renderFrame();
    return;
  }

  const scoreMultiplier = state.score.feverActive ? FEVER_RULES.scoreMultiplier : 1;
  const cleanMultiplier = state.score.feverActive ? FEVER_RULES.cleanMultiplier : 1;

  const baseClean = resultLabel === 'perfect' ? 2.4 : 1.1;
  const cleanGain = baseClean * cleanMultiplier;

  const baseScore = resultLabel === 'perfect' ? SCORE_RULES.patternHit : Math.round(SCORE_RULES.patternHit * 0.55);
  const scoreGain = baseScore * scoreMultiplier;

  const zoneCleanBonus = zone.id === state.activeZoneId ? 0.35 : 0;
  zone.cleanPercent = clamp(zone.cleanPercent + cleanGain + zoneCleanBonus, 0, 100);
  zone.threatPercent = clamp(zone.threatPercent - THREAT_RULES.cleanDropPerHit, 0, 100);
  zone.hits += 1;
  zone.visited = true;
  zone.dwellMs += 120;

  state.metrics.hits += 1;
  state.score.total += Math.round(scoreGain);
  state.score.combo += (resultLabel === 'perfect' ? 1 : 0.5);
  state.score.comboMax = Math.max(state.score.comboMax, Math.floor(state.score.combo));
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
    dragDirection,
    matchScore,
    quality: resultLabel,
    cleanGain,
    combo: Math.floor(state.score.combo),
    threatPercent: Math.round(state.threat.percent)
  });

  state.brushInput.lastQuality = resultLabel;
  state.brushInput.lastQualityAtMs = performance.now();

  showPatternResultPopup(anchor.x, anchor.y, resultLabel, scoreGain);
  maybeShowComboPopup(anchor.x, anchor.y);

  if (state.sceneId === SCENE_IDS.boss) {
    const bossDamageBase = resultLabel === 'perfect' ? 8 : 4;
    const bossDamage = state.score.feverActive ? bossDamageBase * 1.4 : bossDamageBase;

    state.boss.hpPercent = clamp(state.boss.hpPercent - bossDamage, 0, 100);

    logger.event('brush_boss_hit', {
      bossId: state.boss.bossId,
      bossHpPercent: Math.round(state.boss.hpPercent),
      damage: bossDamage,
      quality: resultLabel
    });

    ui.showScorePopup?.(50, 38, `BOSS HIT -${Math.round(bossDamage)}`, 'boss');

    ui.renderBossVisual?.({
      ...buildBossVisualVm(),
      hitFlash: true
    });
  }

  ui.playTrailAt?.(
    detail.point?.x ?? 0,
    detail.point?.y ?? 0,
    resultLabel === 'perfect' ? 'good' : 'weak'
  );
  ui.playHitFxAt?.(anchor.x, anchor.y, 'hit');

  if (!state.score.feverActive && Math.floor(state.score.combo) >= FEVER_RULES.comboThreshold) {
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

    ui.playHitFxAt?.(anchor.x, anchor.y, 'complete');
    ui.showScorePopup?.(anchor.x, anchor.y - 10, 'ZONE CLEAR', 'clear');
    audio.zoneComplete();
  }

  if (resultLabel === 'perfect') {
    ui.renderCoach?.('🪥', `ดีมาก โซน ${zone.label} ใช้ ${zone.patternType} ถูกแล้ว`);
  } else if (resultLabel === 'ok') {
    ui.renderCoach?.('🙂', `เกือบดีแล้ว ลองให้เป็น ${zone.patternType} ชัดขึ้น`);
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

  const zoneAnchor = getZoneAnchor(zone?.id || state.activeZoneId);
  ui.playHitFxAt?.(zoneAnchor.x, zoneAnchor.y, 'miss');

  state.score.combo = 0;
  audio.miss();
  renderFrame();
}

function getSceneObjectiveText(sceneId) {
  switch (sceneId) {
    case SCENE_IDS.launcher:
      return `เริ่มภารกิจ ${state.ctx.modeLabel || 'Adventure'}`;
    case SCENE_IDS.intro:
      return 'สำรวจในโพรงปากและเตรียมเริ่มภารกิจ';
    case SCENE_IDS.scan:
      return 'หาจุดสกปรกอันตรายให้ครบ';
    case SCENE_IDS.guided:
      return 'แปรงตามทิศที่โค้ชแนะนำ';
    case SCENE_IDS.pressure:
      return 'เลือกโซนให้ดีก่อนคราบลุกลาม';
    case SCENE_IDS.fever:
      return 'ช่วงพลังพิเศษ เก็บคราบให้ได้มากที่สุด';
    case SCENE_IDS.bossBreak:
      return 'ทำลายโล่บอสด้วยการโจมตีจุดอ่อน';
    case SCENE_IDS.boss:
      return 'รีบแปรงโจมตีบอสในช่วงเปิดช่อง';
    case SCENE_IDS.finish:
      return 'ภารกิจสำเร็จ กำลังฟื้นฟูทั้งปาก';
    case SCENE_IDS.summary:
      return 'สรุปผลการช่วยฟันของรอบนี้';
    default:
      return 'เตรียมภารกิจกู้ฟัน';
  }
}

function syncScenePresentation(sceneId) {
  ui.renderSceneMood?.(sceneId);
  ui.renderObjective?.(getSceneObjectiveText(sceneId), sceneId);

  const active = isBrushInputScene(sceneId);
  if (el.brushInputLayer) {
    el.brushInputLayer.style.pointerEvents = active ? 'auto' : 'none';
    el.brushInputLayer.classList.toggle('is-active-scene', active);
  }

  if (!active) {
    resetBrushInputState();
    hideBrushCursor();
  }

  if (el.helperCard) {
    if (isBrushInputScene(sceneId)) {
      el.helperCard.innerHTML = 'ลากเพื่อแปรง • <strong>Space</strong> = hit • <strong>Q/W/E/A/S/D</strong> = เลือกโซน';
    } else if (sceneId === SCENE_IDS.scan) {
      el.helperCard.innerHTML = 'แตะเป้าหมายสแกนบนฉากเพื่อหาจุดสกปรก';
    } else if (sceneId === SCENE_IDS.bossBreak) {
      el.helperCard.innerHTML = 'แตะ weak point สีแดงบนฉากเพื่อทำลายโล่';
    } else {
      el.helperCard.innerHTML = 'ปุ่มลัดทดสอบ: <strong>Space</strong> = hit, <strong>Q/W/E/A/S/D</strong> = เลือกโซน';
    }
  }
}

function renderFrame() {
  const accuracyPercent = getRunningAccuracyPercent();
  const coveragePercent = getRunningCoveragePercent();

  ui.renderTopHud?.({
    timeText: `${state.time.remainingSec}s`,
    scoreText: Math.round(state.score.total),
    comboText: Math.floor(state.score.combo),
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
      foundText: `${state.scan.hits || 0} / ${state.scan.targetGoal || 0}`
    });
  } else {
    ui.renderScanHud?.({
      timerText: '',
      foundText: ''
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

  ui.renderPlaques?.(buildPlaqueVisuals());
  ui.renderScanTargets?.(buildScanTargetVisuals());
  ui.renderBossWeakPoints?.(buildBossWeakPointVisuals());
  ui.renderBossVisual?.(buildBossVisualVm());
  ui.renderPatternTutor?.(buildPatternTutorVm());
}

function finishGame() {
  state.running = false;
  resetBrushInputState();
  hideBrushCursor();

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

  ui.renderObjective?.('ดูผลลัพธ์และคำแนะนำของรอบนี้', SCENE_IDS.summary);
  ui.renderSceneMood?.(SCENE_IDS.summary);

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

window.brushHit = simulateBrushHit;
window.brushMiss = simulateBrushMiss;

window.brushScanPick = (id) => {
  const result = scanEngine.pickTarget(id);
  if (!result?.ok) return result;

  const targetVm = buildScanTargetVisuals().find((t) => t.id === id);
  const x = targetVm?.x ?? 50;
  const y = targetVm?.y ?? 50;

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

    ui.playHitFxAt?.(x, y, 'hit');
    ui.showScorePopup?.(x, y - 4, result.target?.special ? 'SCAN +100' : 'SCAN +50', result.target?.special ? 'perfect' : 'good');
    audio.scanHit();
  } else {
    state.scan.misses = (state.scan.misses || 0) + 1;

    logger.event('brush_scan_miss', {
      scanRoundId: state.scan.roundId,
      targetId: id
    });

    ui.playHitFxAt?.(x, y, 'miss');
    ui.showScorePopup?.(x, y - 4, 'WRONG', 'bad');
    audio.miss();
  }

  renderFrame();
  return result;
};

window.brushBossBreakHit = (id) => {
  const result = bossBreakEngine.hitWeakPoint(id);
  if (!result) return result;

  const wpVm = buildBossWeakPointVisuals().find((t) => t.id === id);
  const x = wpVm?.x ?? 50;
  const y = wpVm?.y ?? 50;

  if (result.hit) {
    state.bossBreak.hits = (state.bossBreak.hits || 0) + 1;

    logger.event('brush_boss_break_hit', {
      bossRoundId: state.bossBreak.roundId,
      weakPointId: id,
      hitIndex: state.bossBreak.hits
    });

    ui.playHitFxAt?.(x, y, 'hit');
    ui.showScorePopup?.(x, y - 4, `WEAK +${SCORE_RULES.bossBreakHit}`, 'boss');
    audio.bossBreakHit();
  } else if (result.miss) {
    state.bossBreak.misses = (state.bossBreak.misses || 0) + 1;

    logger.event('brush_boss_break_miss', {
      bossRoundId: state.bossBreak.roundId,
      weakPointId: id
    });

    ui.playHitFxAt?.(x, y, 'miss');
    ui.showScorePopup?.(x, y - 4, 'MISS', 'bad');
    audio.miss();
  }

  renderFrame();
  return result;
};
