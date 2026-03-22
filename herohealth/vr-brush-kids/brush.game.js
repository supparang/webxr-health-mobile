import { createBrushUI } from './brush.ui.js';
import {
  buildBrushResult,
  saveBrushSummary,
  pushBrushSummaryHistory
} from './brush.summary.js';
import { createBrushLogger } from './brush.logger.js';

const qs = new URLSearchParams(location.search);

const GAME_ID = 'brush';
const GAME_TITLE = 'Brush Kids';
const GAME_VARIANT = qs.get('variant') || 'kids-vr';
const ZONE = 'hygiene';
const TOTAL_ZONES = 6;
const ZONE_TARGET = 100;

const HUB_URL =
  qs.get('hub') ||
  `${location.origin}/webxr-health-mobile/herohealth/hub.html`;

const MODE_CONFIG = {
  learn: {
    id: 'learn',
    label: 'โหมดเรียนรู้ 2 นาที',
    durationSec: 120,
    goalText: 'แปรงให้ครบทุกโซนใน 2 นาที',
    miniMissionGuided: 'เลือกโซน แล้วถูตามลายการแปรง',
    miniMissionRun: 'รักษาลายการแปรงให้ต่อเนื่อง'
  },
  challenge: {
    id: 'challenge',
    label: 'โหมดท้าทาย 3 นาที',
    durationSec: 180,
    goalText: 'แปรงให้ครบทุกโซนใน 3 นาที และเก็บงานให้เรียบร้อย',
    miniMissionGuided: 'เริ่มช้า ๆ แล้วทำตามลายการแปรง',
    miniMissionRun: 'ทำลายการแปรงให้แม่นและสม่ำเสมอ'
  }
};

const PHASE_TEXT = {
  intro: 'เตรียมพร้อม',
  guided: 'ฝึกตามโค้ช',
  cleanRun: 'แปรงให้ทั่ว',
  boss: 'เคลียร์คราบตัวป่วน',
  summary: 'สรุปผล'
};

const PATTERN_META = {
  horizontal: {
    label: 'ซ้าย ↔ ขวา',
    hint: 'ถูซ้าย-ขวาให้ต่อเนื่อง'
  },
  vertical: {
    label: 'ขึ้น ↕ ลง',
    hint: 'ถูขึ้น-ลงให้ต่อเนื่อง'
  },
  circle: {
    label: 'วน ⟳ เป็นวง',
    hint: 'ลากวนเป็นวงกลมเบา ๆ'
  }
};

const COACH_LINES = {
  start: [
    'เริ่มแปรงให้ทั่วทุกโซนกันเลย!',
    'ค่อย ๆ แปรงนะ จะสะอาดกว่า'
  ],
  noZone: [
    'เลือกโซนฟันก่อนนะ',
    'แตะแผนที่ฟันทางซ้ายก่อน'
  ],
  tooFast: [
    'ช้าลงนิดหนึ่งนะ',
    'ค่อย ๆ ถู จะสะอาดกว่า'
  ],
  zoneDone: [
    'เยี่ยม! โซนนี้สะอาดแล้ว',
    'เก่งมาก ไปต่ออีกโซนได้เลย'
  ],
  patternLoop: [
    'ลายการแปรงถูกต้อง เก่งมาก!',
    'เยี่ยมเลย ทำตามลายได้ดีมาก'
  ],
  boss: [
    'คราบตัวป่วนกลับมาแล้ว!',
    'รีบเก็บงานให้ครบเลย'
  ],
  finishGood: [
    'สุดยอด! ฟันสะอาดสดใส',
    'วันนี้ทำได้ดีมากเลย'
  ],
  finishMid: [
    'ดีมากแล้ว ลองเก็บให้ครบอีกนิด',
    'ครั้งหน้าลองให้ทั่วกว่านี้อีกหน่อย'
  ],
  finishLow: [
    'ไม่เป็นไร ลองใหม่อีกรอบได้',
    'ครั้งหน้าค่อย ๆ แปรงให้ทั่วนะ'
  ]
};

const state = {
  mode: MODE_CONFIG[qs.get('mode')] || MODE_CONFIG.learn,
  running: false,
  paused: false,
  phaseId: 'intro',
  elapsedMs: 0,
  lastTs: 0,
  activeZoneId: null,
  isPointerDown: false,
  lastBrushAt: 0,
  combo: 0,
  comboMax: 0,
  warnings: 0,
  sparkleCount: 0,
  speedLabel: 'ปกติ',
  bossTriggered: false,
  zones: buildZones(),
  pattern: buildPatternState('horizontal', 'intro', MODE_CONFIG[qs.get('mode')]?.id || 'learn')
};

const el = {
  coachFace: document.getElementById('coachFace'),
  coachLine: document.getElementById('coachLine'),

  timeText: document.getElementById('timeText'),
  coverageText: document.getElementById('coverageText'),
  comboText: document.getElementById('comboText'),
  phaseText: document.getElementById('phaseText'),

  goalFill: document.getElementById('goalFill'),
  goalMiniText: document.getElementById('goalMiniText'),

  zonesDoneText: document.getElementById('zonesDoneText'),
  activeZoneText: document.getElementById('activeZoneText'),
  speedText: document.getElementById('speedText'),
  warnText: document.getElementById('warnText'),
  miniMissionText: document.getElementById('miniMissionText'),

  patternBadge: document.getElementById('patternBadge'),
  patternHint: document.getElementById('patternHint'),
  patternProgressFill: document.getElementById('patternProgressFill'),
  patternProgressText: document.getElementById('patternProgressText'),

  brushPad: document.getElementById('brushPad'),
  brushCursor: document.getElementById('brushCursor'),

  btnLearn: document.getElementById('btnLearn'),
  btnChallenge: document.getElementById('btnChallenge'),
  btnStart: document.getElementById('btnStart'),
  btnPause: document.getElementById('btnPause'),
  btnHelp: document.getElementById('btnHelp'),
  btnCloseHelp: document.getElementById('btnCloseHelp'),
  btnReplay: document.getElementById('btnReplay'),
  btnBackHub: document.getElementById('btnBackHub'),

  helpModal: document.getElementById('helpModal'),
  summaryModal: document.getElementById('summaryModal'),

  summaryTitle: document.getElementById('summaryTitle'),
  summaryRank: document.getElementById('summaryRank'),
  summaryTime: document.getElementById('summaryTime'),
  summaryCoverage: document.getElementById('summaryCoverage'),
  summaryZones: document.getElementById('summaryZones'),
  summaryWarn: document.getElementById('summaryWarn'),
  summaryAdvice: document.getElementById('summaryAdvice')
};

const ui = createBrushUI(el);
const logger = createBrushLogger(readRunContext());

init();

function init() {
  bindEvents();
  syncLoggerContext();
  setMode(state.mode.id, { silent: true });
  ui.setCoach('neutral', randomPick(COACH_LINES.start));
  renderAll();
}

function readRunContext() {
  return {
    pid: qs.get('pid') || '',
    studyId: qs.get('studyId') || '',
    phase: qs.get('phase') || '',
    conditionGroup: qs.get('conditionGroup') || '',
    runMode: qs.get('runMode') || 'play',
    seed: qs.get('seed') || '',
    view: qs.get('view') || '',
    log: qs.get('log') || '',
    modeId: state.mode.id,
    variant: GAME_VARIANT,
    gameId: GAME_ID,
    gameTitle: GAME_TITLE,
    zone: ZONE
  };
}

function syncLoggerContext() {
  logger.updateContext({
    pid: qs.get('pid') || '',
    studyId: qs.get('studyId') || '',
    phase: qs.get('phase') || '',
    conditionGroup: qs.get('conditionGroup') || '',
    runMode: qs.get('runMode') || 'play',
    seed: qs.get('seed') || '',
    view: qs.get('view') || '',
    log: qs.get('log') || '',
    modeId: state.mode.id,
    variant: GAME_VARIANT,
    gameId: GAME_ID,
    gameTitle: GAME_TITLE,
    zone: ZONE
  });
}

function bindEvents() {
  el.btnLearn?.addEventListener('click', () => setMode('learn'));
  el.btnChallenge?.addEventListener('click', () => setMode('challenge'));
  el.btnStart?.addEventListener('click', startGame);
  el.btnPause?.addEventListener('click', togglePause);

  el.btnHelp?.addEventListener('click', () => ui.openHelp(true));
  el.btnCloseHelp?.addEventListener('click', () => ui.openHelp(false));

  el.btnReplay?.addEventListener('click', replay);
  el.btnBackHub?.addEventListener('click', goCooldownThenHub);

  document.querySelectorAll('.tooth-zone').forEach(btn => {
    btn.addEventListener('click', () => selectZone(btn.dataset.zone || ''));
  });

  bindBrushInput(el.brushPad);

  window.addEventListener('beforeunload', () => {
    logger.flush();
  });
}

function bindBrushInput(node) {
  if (!node) return;

  node.addEventListener('pointerdown', (e) => {
    state.isPointerDown = true;
    node.setPointerCapture?.(e.pointerId);
    ui.moveBrushCursor(e, el.brushPad, el.brushCursor);
    handleBrushMove(e);
  });

  node.addEventListener('pointermove', (e) => {
    ui.moveBrushCursor(e, el.brushPad, el.brushCursor);
    if (state.isPointerDown) handleBrushMove(e);
  });

  node.addEventListener('pointerup', () => {
    state.isPointerDown = false;
    state.pattern.lastPos = null;
    state.pattern.lastAngle = null;
  });

  node.addEventListener('pointercancel', () => {
    state.isPointerDown = false;
    state.pattern.lastPos = null;
    state.pattern.lastAngle = null;
  });
}

function buildZones() {
  return [
    mkZone('upper-left', 'บนซ้าย'),
    mkZone('upper-front', 'บนหน้า'),
    mkZone('upper-right', 'บนขวา'),
    mkZone('lower-left', 'ล่างซ้าย'),
    mkZone('lower-front', 'ล่างหน้า'),
    mkZone('lower-right', 'ล่างขวา')
  ];
}

function mkZone(id, label) {
  return {
    id,
    label,
    clean: 0,
    dwellMs: 0,
    visited: false,
    done: false,
    milestone: 0,
    announcedDone: false
  };
}

function buildPatternState(type, phaseId, modeId) {
  const meta = PATTERN_META[type] || PATTERN_META.horizontal;

  let cyclesTarget = 2;
  if (phaseId === 'cleanRun') cyclesTarget = modeId === 'challenge' ? 3 : 2;
  if (phaseId === 'boss') cyclesTarget = 2;

  return {
    type,
    label: meta.label,
    hint: meta.hint,
    progress: 0,
    cyclesDone: 0,
    cyclesTarget,
    lastPos: null,
    lastAngle: null,
    lastDirection: 0
  };
}

function getPatternTypeForZone(zoneId, phaseId) {
  if (!zoneId) return 'horizontal';
  if (phaseId === 'boss') return 'circle';

  const map = {
    'upper-left': 'horizontal',
    'upper-front': 'circle',
    'upper-right': 'horizontal',
    'lower-left': 'vertical',
    'lower-front': 'circle',
    'lower-right': 'vertical'
  };

  return map[zoneId] || 'horizontal';
}

function assignPatternForCurrentZone() {
  const type = getPatternTypeForZone(state.activeZoneId, state.phaseId);
  state.pattern = buildPatternState(type, state.phaseId, state.mode.id);
}

function setMode(modeId, options = {}) {
  state.mode = MODE_CONFIG[modeId] || MODE_CONFIG.learn;
  syncLoggerContext();

  if (state.activeZoneId) assignPatternForCurrentZone();

  if (!options.silent) {
    logger.event('mode_change', {
      modeId: state.mode.id,
      modeLabel: state.mode.label,
      gameId: GAME_ID,
      gameVariant: GAME_VARIANT
    });
  }

  renderAll();
}

function startGame() {
  resetRunState();
  syncLoggerContext();

  state.running = true;
  state.paused = false;
  state.phaseId = 'guided';
  state.lastTs = performance.now();

  logger.startSession({
    gameId: GAME_ID,
    gameVariant: GAME_VARIANT,
    gameTitle: GAME_TITLE,
    zone: ZONE,
    modeId: state.mode.id,
    modeLabel: state.mode.label,
    durationPlannedSec: state.mode.durationSec
  });

  logger.event('game_start', {
    timeFromStartMs: 0,
    gameId: GAME_ID,
    gameVariant: GAME_VARIANT,
    gameTitle: GAME_TITLE,
    zone: ZONE,
    modeId: state.mode.id,
    durationPlannedSec: state.mode.durationSec
  });

  ui.setCoach('neutral', randomPick(COACH_LINES.start));
  renderAll();
  requestAnimationFrame(loop);
}

function resetRunState() {
  state.running = false;
  state.paused = false;
  state.phaseId = 'intro';
  state.elapsedMs = 0;
  state.lastTs = 0;
  state.activeZoneId = null;
  state.isPointerDown = false;
  state.lastBrushAt = 0;
  state.combo = 0;
  state.comboMax = 0;
  state.warnings = 0;
  state.sparkleCount = 0;
  state.speedLabel = 'ปกติ';
  state.bossTriggered = false;
  state.zones = buildZones();
  state.pattern = buildPatternState('horizontal', 'intro', state.mode.id);

  if (el.btnPause) el.btnPause.textContent = 'พักเกม';
  renderAll();
}

function replay() {
  ui.closeSummary();
  startGame();
}

function togglePause() {
  if (!state.running) return;

  state.paused = !state.paused;
  if (el.btnPause) el.btnPause.textContent = state.paused ? 'เล่นต่อ' : 'พักเกม';

  logger.event(state.paused ? 'pause' : 'resume', {
    timeFromStartMs: Math.round(state.elapsedMs),
    gameId: GAME_ID,
    gameVariant: GAME_VARIANT
  });

  if (!state.paused) {
    state.lastTs = performance.now();
    requestAnimationFrame(loop);
  }
}

function loop(ts) {
  if (!state.running || state.paused) return;

  const dt = Math.max(0, ts - state.lastTs);
  state.lastTs = ts;
  state.elapsedMs += dt;

  updatePhase();
  renderAll();

  if (state.elapsedMs >= state.mode.durationSec * 1000) {
    finishGame();
    return;
  }

  requestAnimationFrame(loop);
}

function updatePhase() {
  const sec = state.elapsedMs / 1000;
  const duration = state.mode.durationSec;

  let nextPhase = 'guided';
  if (!state.bossTriggered && sec >= duration * 0.2) nextPhase = 'cleanRun';
  if (!state.bossTriggered && sec >= duration * 0.82) nextPhase = 'boss';

  if (nextPhase === 'boss' && !state.bossTriggered) {
    state.bossTriggered = true;
    reviveWeakZones();
    ui.setCoach('fever', randomPick(COACH_LINES.boss));
    logger.event('boss_start', {
      timeFromStartMs: Math.round(state.elapsedMs),
      gameId: GAME_ID,
      gameVariant: GAME_VARIANT,
      coveragePercent: getCoveragePercent()
    });
  }

  if (nextPhase !== state.phaseId) {
    state.phaseId = nextPhase;
    if (state.activeZoneId) {
      assignPatternForCurrentZone();
    }
  }
}

function reviveWeakZones() {
  state.zones.forEach(z => {
    if (z.clean < 70) {
      z.clean = Math.max(25, z.clean - 18);
      z.done = false;
      z.announcedDone = false;
      z.milestone = Math.floor(z.clean / 25) * 25;
    }
  });
}

function selectZone(zoneId) {
  state.activeZoneId = zoneId;
  assignPatternForCurrentZone();

  const zone = getActiveZone();
  if (zone) {
    ui.setCoach('neutral', `ตอนนี้แปรงโซน${zone.label}นะ`);
    logger.event('zone_select', {
      timeFromStartMs: Math.round(state.elapsedMs),
      gameId: GAME_ID,
      gameVariant: GAME_VARIANT,
      zoneId: zone.id,
      zoneLabel: zone.label,
      patternType: state.pattern.type
    });
  }

  renderAll();
}

function handleBrushMove(e) {
  if (!state.running || state.paused) return;

  const zone = getActiveZone();
  if (!zone) {
    issueWarning('warning_no_zone', randomPick(COACH_LINES.noZone));
    return;
  }

  const pos = getNormPos(e, el.brushPad);
  if (!pos) return;

  const now = performance.now();
  const delta = now - state.lastBrushAt;
  state.lastBrushAt = now;

  const speed = classifySpeed(delta);
  state.speedLabel = speed.label;

  if (speed.key === 'fast') {
    issueWarning('warning_fast', randomPick(COACH_LINES.tooFast));
    return;
  }

  const patternResult = updatePatternProgress(pos);

  if (patternResult.match < 0.12) {
    renderAll();
    return;
  }

  updateZoneCleaning(zone, speed, patternResult.match, patternResult.cycleCompleted, patternResult.loopCompleted);
  state.combo += 1;
  state.comboMax = Math.max(state.comboMax, state.combo);

  maybeEmitZoneMilestone(zone);
  maybeCelebrateZone(zone);

  if (patternResult.cycleCompleted) {
    logger.event('pattern_cycle', {
      timeFromStartMs: Math.round(state.elapsedMs),
      gameId: GAME_ID,
      gameVariant: GAME_VARIANT,
      zoneId: zone.id,
      patternType: state.pattern.type,
      patternCyclesDone: state.pattern.cyclesDone,
      patternCyclesTarget: state.pattern.cyclesTarget
    });
  }

  if (patternResult.loopCompleted) {
    ui.setCoach('happy', randomPick(COACH_LINES.patternLoop));
    logger.event('pattern_loop_complete', {
      timeFromStartMs: Math.round(state.elapsedMs),
      gameId: GAME_ID,
      gameVariant: GAME_VARIANT,
      zoneId: zone.id,
      patternType: state.pattern.type
    });
  }

  if ((state.combo % 12) === 0) {
    logger.event('brush_combo', {
      timeFromStartMs: Math.round(state.elapsedMs),
      gameId: GAME_ID,
      gameVariant: GAME_VARIANT,
      combo: state.combo,
      comboMax: state.comboMax
    });
  }

  renderAll();
}

function updatePatternProgress(nextPos) {
  const p = state.pattern;
  const prev = p.lastPos;

  if (!prev) {
    p.lastPos = nextPos;
    if (p.type === 'circle') {
      p.lastAngle = Math.atan2(nextPos.y - 0.5, nextPos.x - 0.5);
    }
    return { match: 0, cycleCompleted: false, loopCompleted: false };
  }

  const dx = nextPos.x - prev.x;
  const dy = nextPos.y - prev.y;
  const dist = Math.hypot(dx, dy);

  p.lastPos = nextPos;

  if (dist < 0.004) {
    return { match: 0, cycleCompleted: false, loopCompleted: false };
  }

  let match = 0;
  let progressAdd = 0;

  if (p.type === 'horizontal') {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    match = clamp((ax / (ax + ay + 0.0001) - 0.25) / 0.75, 0, 1);

    const dir = Math.sign(dx);
    progressAdd += match * 14;

    if (ax > 0.014 && dir !== 0 && p.lastDirection !== 0 && dir !== p.lastDirection) {
      progressAdd += 18;
    }
    if (ax > 0.014 && dir !== 0) {
      p.lastDirection = dir;
    }
  } else if (p.type === 'vertical') {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    match = clamp((ay / (ax + ay + 0.0001) - 0.25) / 0.75, 0, 1);

    const dir = Math.sign(dy);
    progressAdd += match * 14;

    if (ay > 0.014 && dir !== 0 && p.lastDirection !== 0 && dir !== p.lastDirection) {
      progressAdd += 18;
    }
    if (ay > 0.014 && dir !== 0) {
      p.lastDirection = dir;
    }
  } else {
    const cx = nextPos.x - 0.5;
    const cy = nextPos.y - 0.5;
    const radius = Math.hypot(cx, cy);
    const angle = Math.atan2(cy, cx);

    let deltaAngle = 0;
    if (p.lastAngle !== null) {
      deltaAngle = normalizeAngle(angle - p.lastAngle);
    }
    p.lastAngle = angle;

    const ringFit = radius > 0.12 && radius < 0.42 ? 1 : 0.35;
    match = clamp((Math.abs(deltaAngle) / 0.14) * ringFit, 0, 1);
    progressAdd += match * 16;
  }

  p.progress = clamp(p.progress + progressAdd, 0, 100);

  let cycleCompleted = false;
  let loopCompleted = false;

  if (p.progress >= 100) {
    cycleCompleted = true;
    p.progress = 0;
    p.cyclesDone += 1;
    p.lastDirection = 0;

    if (p.cyclesDone >= p.cyclesTarget) {
      loopCompleted = true;
      p.cyclesDone = 0;
    }
  }

  return { match, cycleCompleted, loopCompleted };
}

function classifySpeed(deltaMs) {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return { key: 'ok', label: 'ปกติ', gain: 1.0 };
  }
  if (deltaMs < 16) return { key: 'fast', label: 'เร็วไป', gain: 0.25 };
  if (deltaMs < 34) return { key: 'good', label: 'ดีมาก', gain: 1.35 };
  if (deltaMs < 80) return { key: 'ok', label: 'ปกติ', gain: 1.0 };
  return { key: 'slow', label: 'ช้า', gain: 0.72 };
}

function issueWarning(type, coachLine) {
  state.warnings += 1;
  state.combo = 0;
  ui.setCoach('sad', coachLine);

  logger.event(type, {
    timeFromStartMs: Math.round(state.elapsedMs),
    gameId: GAME_ID,
    gameVariant: GAME_VARIANT,
    warnings: state.warnings,
    activeZoneId: state.activeZoneId || ''
  });

  renderAll();
}

function updateZoneCleaning(zone, speed, patternMatch, cycleCompleted, loopCompleted) {
  const phaseBonus = state.phaseId === 'boss' ? 1.10 : 1.0;
  const cycleBonus = cycleCompleted ? 3 : 0;
  const loopBonus = loopCompleted ? 8 : 0;

  const gain = 1.4 * speed.gain * phaseBonus * patternMatch;
  zone.clean = clamp(zone.clean + gain + cycleBonus + loopBonus, 0, ZONE_TARGET);
  zone.dwellMs += 40;
  zone.visited = true;
  zone.done = zone.clean >= ZONE_TARGET;
}

function maybeEmitZoneMilestone(zone) {
  const step = Math.floor(zone.clean / 25) * 25;
  if (step > zone.milestone && step <= 100) {
    zone.milestone = step;

    logger.event('zone_progress', {
      timeFromStartMs: Math.round(state.elapsedMs),
      gameId: GAME_ID,
      gameVariant: GAME_VARIANT,
      zoneId: zone.id,
      zoneLabel: zone.label,
      cleanValue: Math.round(zone.clean),
      milestone: step,
      coveragePercent: getCoveragePercent()
    });
  }
}

function maybeCelebrateZone(zone) {
  if (zone.done && !zone.announcedDone) {
    zone.announcedDone = true;
    state.sparkleCount += 1;
    ui.setCoach('happy', randomPick(COACH_LINES.zoneDone));

    logger.event('zone_complete', {
      timeFromStartMs: Math.round(state.elapsedMs),
      gameId: GAME_ID,
      gameVariant: GAME_VARIANT,
      zoneId: zone.id,
      zoneLabel: zone.label,
      cleanValue: Math.round(zone.clean),
      coveragePercent: getCoveragePercent()
    });
  }
}

function finishGame() {
  state.running = false;
  state.phaseId = 'summary';

  const result = buildBrushResult({
    state,
    totalZones: TOTAL_ZONES,
    modeLabel: state.mode.label
  });

  result.gameId = GAME_ID;
  result.gameVariant = GAME_VARIANT;
  result.gameTitle = GAME_TITLE;
  result.zone = ZONE;

  saveBrushSummary(result);
  pushBrushSummaryHistory(result);

  logger.finish(result);
  logger.event('summary_shown', {
    timeFromStartMs: Math.round(state.elapsedMs),
    gameId: GAME_ID,
    gameVariant: GAME_VARIANT,
    coveragePercent: result.coveragePercent,
    finalRank: result.finalRank
  });
  logger.flush();

  if (result.coveragePercent >= 85) {
    ui.setCoach('happy', randomPick(COACH_LINES.finishGood));
  } else if (result.coveragePercent >= 60) {
    ui.setCoach('neutral', randomPick(COACH_LINES.finishMid));
  } else {
    ui.setCoach('sad', randomPick(COACH_LINES.finishLow));
  }

  ui.openSummary(result);
  renderAll();
}

function goCooldownThenHub() {
  logger.flush();

  const cooldown = new URL('../gate/cooldown-gate.html', import.meta.url);
  cooldown.searchParams.set('game', GAME_ID);
  cooldown.searchParams.set('variant', GAME_VARIANT);
  cooldown.searchParams.set('zone', ZONE);
  cooldown.searchParams.set('hub', HUB_URL);
  cooldown.searchParams.set('next', HUB_URL);

  [
    'pid',
    'studyId',
    'phase',
    'conditionGroup',
    'runMode',
    'seed',
    'view',
    'log'
  ].forEach(k => {
    const v = qs.get(k);
    if (v) cooldown.searchParams.set(k, v);
  });

  location.href = cooldown.href;
}

function getActiveZone() {
  return state.zones.find(z => z.id === state.activeZoneId) || null;
}

function getCoveragePercent() {
  const sum = state.zones.reduce((acc, z) => acc + z.clean, 0);
  return Math.round(sum / (TOTAL_ZONES * ZONE_TARGET) * 100);
}

function getZonesDoneCount() {
  return state.zones.filter(z => z.done).length;
}

function getNormPos(e, pad) {
  if (!pad) return null;
  const rect = pad.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  return {
    x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((e.clientY - rect.top) / rect.height, 0, 1)
  };
}

function renderAll() {
  ui.renderZones(state.zones, state.activeZoneId);
  ui.renderHud({
    timeText: formatTime(
      Math.max(0, state.mode.durationSec - Math.floor(state.elapsedMs / 1000))
    ),
    coveragePercent: getCoveragePercent(),
    comboMax: state.comboMax,
    phaseText: PHASE_TEXT[state.phaseId] || 'เล่นอยู่',
    zonesDone: getZonesDoneCount(),
    zonesTotal: TOTAL_ZONES,
    activeZoneLabel: getActiveZone()?.label || 'ยังไม่ได้เลือก',
    speedLabel: state.speedLabel,
    warnings: state.warnings,
    goalText: state.mode.goalText,
    miniMissionText: getMiniMissionText()
  });

  ui.renderPattern({
    label: state.activeZoneId ? state.pattern.label : 'เลือกโซนก่อน',
    hint: state.activeZoneId ? state.pattern.hint : 'เลือกโซนก่อน แล้วถูตามลายที่บอก',
    progressPercent: state.pattern.progress,
    progressText: `${state.pattern.cyclesDone} / ${state.pattern.cyclesTarget} รอบ`
  });
}

function getMiniMissionText() {
  if (state.phaseId === 'guided') return state.mode.miniMissionGuided;
  if (state.phaseId === 'cleanRun') return state.mode.miniMissionRun;
  if (state.phaseId === 'boss') return 'โหมด boss ใช้การวนเป็นวงกลมเพื่อเก็บงาน';
  if (state.phaseId === 'summary') return 'ดูผลลัพธ์ของวันนี้ได้เลย';
  return 'เริ่มได้เลย';
}

function formatTime(totalSec) {
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function normalizeAngle(rad) {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}