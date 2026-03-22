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
    miniMissionGuided: 'เลือกโซน แล้วค่อย ๆ ถูให้สะอาด',
    miniMissionRun: 'แปรงให้ครบทุกโซนและอย่ารีบเกินไป'
  },
  challenge: {
    id: 'challenge',
    label: 'โหมดท้าทาย 3 นาที',
    durationSec: 180,
    goalText: 'แปรงให้ครบทุกโซนใน 3 นาที และเก็บงานให้เรียบร้อย',
    miniMissionGuided: 'เริ่มช้า ๆ แล้วคุมจังหวะให้สม่ำเสมอ',
    miniMissionRun: 'รักษาความสม่ำเสมอและเก็บงานปลายเกม'
  }
};

const PHASE_TEXT = {
  intro: 'เตรียมพร้อม',
  guided: 'ฝึกตามโค้ช',
  cleanRun: 'แปรงให้ทั่ว',
  boss: 'เคลียร์คราบตัวป่วน',
  summary: 'สรุปผล'
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
  zones: buildZones()
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
  });

  node.addEventListener('pointercancel', () => {
    state.isPointerDown = false;
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

function setMode(modeId, options = {}) {
  state.mode = MODE_CONFIG[modeId] || MODE_CONFIG.learn;
  syncLoggerContext();

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

  if (!state.bossTriggered && sec >= duration * 0.82) {
    state.phaseId = 'boss';
    state.bossTriggered = true;
    reviveWeakZones();
    ui.setCoach('fever', randomPick(COACH_LINES.boss));

    logger.event('boss_start', {
      timeFromStartMs: Math.round(state.elapsedMs),
      gameId: GAME_ID,
      gameVariant: GAME_VARIANT,
      coveragePercent: getCoveragePercent()
    });
    return;
  }

  if (!state.bossTriggered && sec >= duration * 0.2) {
    state.phaseId = 'cleanRun';
    return;
  }

  if (!state.bossTriggered) {
    state.phaseId = 'guided';
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
  const zone = getActiveZone();

  if (zone) {
    ui.setCoach('neutral', `ตอนนี้แปรงโซน${zone.label}นะ`);
    logger.event('zone_select', {
      timeFromStartMs: Math.round(state.elapsedMs),
      gameId: GAME_ID,
      gameVariant: GAME_VARIANT,
      zoneId: zone.id,
      zoneLabel: zone.label
    });
  }

  renderAll();
}

function handleBrushMove() {
  if (!state.running || state.paused) return;

  const zone = getActiveZone();
  if (!zone) {
    issueWarning('warning_no_zone', randomPick(COACH_LINES.noZone));
    return;
  }

  const now = performance.now();
  const delta = now - state.lastBrushAt;
  state.lastBrushAt = now;

  const speed = classifySpeed(delta);
  state.speedLabel = speed.label;

  if (speed.key === 'fast') {
    issueWarning('warning_fast', randomPick(COACH_LINES.tooFast));
    return;
  }

  updateZoneCleaning(zone, speed);
  state.combo += 1;
  state.comboMax = Math.max(state.comboMax, state.combo);

  maybeEmitZoneMilestone(zone);
  maybeCelebrateZone(zone);

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

function updateZoneCleaning(zone, speed) {
  const phaseBonus = state.phaseId === 'boss' ? 1.10 : 1.0;
  const gain = 2.2 * speed.gain * phaseBonus;

  zone.clean = clamp(zone.clean + gain, 0, ZONE_TARGET);
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
}

function getMiniMissionText() {
  if (state.phaseId === 'guided') return state.mode.miniMissionGuided;
  if (state.phaseId === 'cleanRun') return state.mode.miniMissionRun;
  if (state.phaseId === 'boss') return 'คราบตัวป่วนกลับมาแล้ว รีบเก็บงานให้ครบ';
  if (state.phaseId === 'summary') return 'ดูผลลัพธ์ของวันนี้ได้เลย';
  return 'เริ่มได้เลย';
}

function formatTime(totalSec) {
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}