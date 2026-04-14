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

  brushInputLayer: document.getElementById('brushInputLayer'),
  brushCursor: document.getElementById('brushCursor')
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

    threat: { percent: 0 },
    zones: createZones(),
    activeZoneId: 'upper-front',

    brushInput: {
      active: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
      lastHitAtMs: 0
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
      completedGoal: false
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
      damageWindowMs: 0
    },

    boss: {
      active: false,
      bossId: 'plaque-king',
      hpPercent: 100,
      cleared: false,
      damageWindowEndAtMs: 0
    },

    metrics: {
      hits: 0,
      misses: 0,
      warnings: 0,
      phaseStats: makePhaseStats()
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

  el.btnPause?.addEventListener('click', togglePause);
  el.btnBackHub?.addEventListener('click', backToHub);

  document.querySelectorAll('[data-zone]').forEach((node) => {
    node.addEventListener('click', () => {
      const zoneId = node.getAttribute('data-zone') || '';
      if (zoneId) onZoneSelect(zoneId, 'manual');
    });
  });

  window.addEventListener('keydown', (e) => {
    if (!state.running || state.paused) return;

    if (e.code === 'Space') {
      e.preventDefault();
      simulateBrushHit({ dragDirection: 'horizontal' });
    }

    if (e.code === 'KeyQ') onZoneSelect('upper-left', 'keyboard');
    if (e.code === 'KeyW') onZoneSelect('upper-front', 'keyboard');
    if (e.code === 'KeyE') onZoneSelect('upper-right', 'keyboard');
    if (e.code === 'KeyA') onZoneSelect('lower-left', 'keyboard');
    if (e.code === 'KeyS') onZoneSelect('lower-front', 'keyboard');
    if (e.code === 'KeyD') onZoneSelect('lower-right', 'keyboard');
  });

  window.addEventListener('beforeunload', () => {
    try { logger.flush(); } catch {}
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

  el.brushInputLayer?.classList.add('is-active');
  el.brushInputLayer?.classList.remove('is-idle');

  try { el.brushInputLayer?.setPointerCapture?.(e.pointerId); } catch {}

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

  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
  updateBrushCursorFromPoint(point, Number.isFinite(angleDeg) ? angleDeg : -18);

  const enoughDistance = dist >= brushDragDistanceThresholdPx();
  const enoughTime = (now - state.brushInput.lastHitAtMs) >= brushHitThrottleMs();

  if (enoughDistance && enoughTime) {
    const dragDirection = detectBrushDirection(dx, dy);
    simulateBrushHit({ point, dx, dy, dist, dragDirection });
    state.brushInput.lastHitAtMs = now;
  }

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
  state.time.remainingSec = Math.max(0, state.time.durationPlannedSec - Math.floor(state.time.elapsedMs / 1000));

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

function updateScene(dt) {
  if (state.sceneId === SCENE_IDS.intro) {
    if (performance.now() - state.sceneEnteredAtMs >= 1200) enterScene(SCENE_IDS.scan);
    return;
  }

  if (state.sceneId === SCENE_IDS.scan) {
    scanEngine.tick(dt);
    if (scanEngine.isComplete()) completeScanMiniGame(scanEngine.buildResult());
    return;
  }

  if (state.sceneId === SCENE_IDS.guided) {
    if (performance.now() - state.sceneEnteredAtMs >= 12000) enterScene(SCENE_IDS.pressure);
    return;
  }

  if (state.sceneId === SCENE_IDS.pressure) {
    if (!state.score.feverActive && Math.floor(state.score.combo) >= FEVER_RULES.comboThreshold) {
      startFever('combo');
    }
    if (performance.now() - state.sceneEnteredAtMs >= 42000) enterScene(SCENE_IDS.bossBreak);
    return;
  }

  if (state.sceneId === SCENE_IDS.bossBreak) {
    bossBreakEngine.tick(dt);
    if (bossBreakEngine.isComplete()) completeBossBreakMiniGame(bossBreakEngine.buildResult());
    return;
  }

  if (state.sceneId === SCENE_IDS.boss) {
    const now = performance.now();
    if (
      state.boss.damageWindowEndAtMs > 0 &&
      now > state.boss.damageWindowEndAtMs &&
      !state.boss.cleared
    ) {
      enterScene(SCENE_IDS.finish, { reason: 'boss_window_end' });
      return;
    }

    if (state.boss.hpPercent <= 0 && !state.boss.cleared) {
      state.boss.cleared = true;
      enterScene(SCENE_IDS.finish, { reason: 'boss_clear' });
    }
    return;
  }

  if (state.sceneId === SCENE_IDS.finish) {
    if (performance.now() - state.sceneEnteredAtMs >= 1000) enterScene(SCENE_IDS.summary);
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
}

function enterScene(sceneId, detail = {}) {
  state.previousSceneId = state.sceneId;
  state.sceneId = sceneId;
  state.sceneEnteredAtMs = performance.now();

  logger.setScene(sceneId);
  logger.event('brush_scene_enter', { sceneId, ...detail });

  syncScenePresentation(sceneId);

  if (sceneId === SCENE_IDS.intro) {
    ui.renderCoach?.('👀', randomPick(COACH_LINES.intro));
  } else if (sceneId === SCENE_IDS.scan) {
    startScanMiniGame();
  } else if (sceneId === SCENE_IDS.guided) {
    ui.renderCoach?.('🙂', randomPick(COACH_LINES.guided));
  } else if (sceneId === SCENE_IDS.pressure) {
    ui.renderCoach?.('⚠️', randomPick(COACH_LINES.pressure));
  } else if (sceneId === SCENE_IDS.bossBreak) {
    startBossBreakMiniGame();
  } else if (sceneId === SCENE_IDS.boss) {
    startBossPhase();
  } else if (sceneId === SCENE_IDS.finish) {
    ui.renderCoach?.('✨', randomPick(COACH_LINES.finish));
    audio.victory();
  } else if (sceneId === SCENE_IDS.summary) {
    finishGame();
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
  state.scan = { ...state.scan, ...result, active: false };

  const scoreGain =
    (state.scan.hits || 0) * SCORE_RULES.scanHit +
    (state.scan.specialHits || 0) * (SCORE_RULES.scanSpecialHit - SCORE_RULES.scanHit);

  state.score.total += scoreGain;

  if ((state.scan.accuracyPercent || 0) >= 75) {
    state.threat.percent = clamp(state.threat.percent - 10, 0, 100);
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
  state.bossBreak = { ...state.bossBreak, ...result, active: false };

  const scoreGain = (state.bossBreak.hits || 0) * SCORE_RULES.bossBreakHit;
  state.score.total += scoreGain;

  if (state.bossBreak.success) {
    state.score.total += SCORE_RULES.bossBreakPerfect;
    audio.shieldBreak();
  }

  enterScene(SCENE_IDS.boss);
}

function startBossPhase() {
  state.boss.active = true;
  state.boss.damageWindowEndAtMs = performance.now() + (state.bossBreak.damageWindowMs || 2500);
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
  if (state.ctx.view === 'mobile') return 60;
  if (state.ctx.view === 'cvr') return 110;
  return 80;
}

function brushDragDistanceThresholdPx() {
  if (state.ctx.view === 'mobile') return 10;
  return 14;
}

function resetBrushInputState() {
  state.brushInput.active = false;
  state.brushInput.pointerId = null;
  state.brushInput.lastX = 0;
  state.brushInput.lastY = 0;
  state.brushInput.lastHitAtMs = 0;
}

function detectBrushDirection(dx, dy) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const bias = state.ctx.view === 'mobile' ? 1.15 : 1.35;

  if (ax < 2 && ay < 2) return 'none';
  if (ax > ay * bias) return 'horizontal';
  if (ay > ax * bias) return 'vertical';
  return 'circle';
}

function getPatternMatchScore(expectedPattern, dragDirection) {
  const mobile = state.ctx.view === 'mobile';

  if (!expectedPattern || dragDirection === 'none') return 0;
  if (expectedPattern === dragDirection) return 1;

  if (
    (expectedPattern === 'horizontal' && dragDirection === 'circle') ||
    (expectedPattern === 'vertical' && dragDirection === 'circle')
  ) {
    return mobile ? 0.70 : 0.45;
  }

  if (
    expectedPattern === 'circle' &&
    (dragDirection === 'horizontal' || dragDirection === 'vertical')
  ) {
    return mobile ? 0.55 : 0.35;
  }

  return mobile ? 0.20 : 0;
}

function getPatternResultLabel(score) {
  if (score >= 0.75) return 'perfect';
  if (score >= 0.20) return 'ok';
  return 'bad';
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

  if (resultLabel === 'bad') {
    zone.misses += 1;
    state.metrics.misses += 1;
    state.metrics.warnings += 1;
    state.score.combo = 0;

    ui.renderCoach?.('🙂', `ลองอีกนิด โซน ${zone.label} ควรแปรงแบบ ${zone.patternType}`);
    renderFrame();
    return;
  }

  const scoreMultiplier = state.score.feverActive ? FEVER_RULES.scoreMultiplier : 1;
  const cleanMultiplier = state.score.feverActive ? FEVER_RULES.cleanMultiplier : 1;

  const baseClean = resultLabel === 'perfect' ? 2.6 : 1.8;
  const cleanGain = baseClean * cleanMultiplier;

  const baseScore = resultLabel === 'perfect'
    ? SCORE_RULES.patternHit
    : Math.round(SCORE_RULES.patternHit * 0.8);

  const scoreGain = baseScore * scoreMultiplier;

  zone.cleanPercent = clamp(zone.cleanPercent + cleanGain, 0, 100);
  zone.threatPercent = clamp(zone.threatPercent - THREAT_RULES.cleanDropPerHit, 0, 100);
  zone.hits += 1;
  zone.visited = true;
  zone.dwellMs += 120;

  state.metrics.hits += 1;
  state.score.total += Math.round(scoreGain);
  state.score.combo += (resultLabel === 'perfect' ? 1 : 0.5);
  state.score.comboMax = Math.max(state.score.comboMax, Math.floor(state.score.combo));
  state.threat.percent = clamp(state.threat.percent - THREAT_RULES.cleanDropPerHit, 0, 100);

  if (!state.score.feverActive && Math.floor(state.score.combo) >= FEVER_RULES.comboThreshold) {
    startFever('combo');
  }

  if (!zone.done && zone.cleanPercent >= 100) {
    zone.done = true;
    zone.completedAtMs = Math.round(state.time.elapsedMs);
    state.score.total += SCORE_RULES.zoneComplete;
    audio.zoneComplete();
  }

  if (state.sceneId === SCENE_IDS.boss) {
    const bossDamageBase = resultLabel === 'perfect' ? 8 : 4;
    const bossDamage = state.score.feverActive ? bossDamageBase * 1.4 : bossDamageBase;
    state.boss.hpPercent = clamp(state.boss.hpPercent - bossDamage, 0, 100);
  }

  if (resultLabel === 'perfect') {
    ui.renderCoach?.('🪥', `ดีมาก โซน ${zone.label} ใช้ ${zone.patternType} ถูกแล้ว`);
  } else {
    ui.renderCoach?.('🙂', `เกือบดีแล้ว ลองให้เป็น ${zone.patternType} ชัดขึ้น`);
  }

  audio.hit();
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
}

function getSceneObjectiveText(sceneId) {
  switch (sceneId) {
    case SCENE_IDS.launcher: return `เริ่มภารกิจ ${state.ctx.modeLabel || 'Adventure'}`;
    case SCENE_IDS.intro: return 'สำรวจในโพรงปากและเตรียมเริ่มภารกิจ';
    case SCENE_IDS.scan: return 'หาจุดสกปรกอันตรายให้ครบ';
    case SCENE_IDS.guided: return 'แปรงตามทิศที่โค้ชแนะนำ';
    case SCENE_IDS.pressure: return 'เลือกโซนให้ดีก่อนคราบลุกลาม';
    case SCENE_IDS.bossBreak: return 'ทำลายโล่บอสด้วยการโจมตีจุดอ่อน';
    case SCENE_IDS.boss: return 'รีบแปรงโจมตีบอสในช่วงเปิดช่อง';
    case SCENE_IDS.finish: return 'ภารกิจสำเร็จ กำลังฟื้นฟูทั้งปาก';
    case SCENE_IDS.summary: return 'สรุปผลการช่วยฟันของรอบนี้';
    default: return 'เตรียมภารกิจกู้ฟัน';
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
  ui.renderTopHud?.({
    timeText: `${state.time.remainingSec}s`,
    scoreText: Math.round(state.score.total),
    comboText: Math.floor(state.score.combo),
    threatText: `${Math.round(state.threat.percent)}%`,
    sceneText: state.sceneId,
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
    ui.renderScanHud?.({ timerText: '', foundText: '' });
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
    ui.renderBossBreakHud?.({ shieldText: '', timerText: '', countText: '' });
  }
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

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}