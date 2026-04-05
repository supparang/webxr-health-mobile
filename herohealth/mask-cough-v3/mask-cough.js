import { createHhaSfx } from '../shared/hha-sfx.js';
import { createRewardEngine } from '../shared/hha-rewards.js';
import {
  hhaNowRunMs,
  hhaEnsurePhaseStat,
  hhaPushEvent,
  hhaPersistArtifacts,
  hhaCopyJson
} from '../shared/hha-logger.js';
import { createHhaDirector } from '../shared/hha-director.js';
import { createHhaCoach } from '../shared/hha-coach.js';
import {
  hhaSetTimerChip,
  hhaSetDirectorChip,
  hhaSetCoachHint,
  hhaSetActiveButtons,
  hhaSetDisabledPhase,
  hhaShake,
  hhaSpawnFloatingScore,
  hhaShowBurst,
  hhaShowPhaseFlash,
  hhaSpawnIconBurst,
  hhaBuildSummaryRank,
  hhaBuildRewardBadges
} from '../shared/hha-ui.js';
import {
  hhaRenderPills,
  hhaRenderRewardGrid,
  hhaRenderActionButtons,
  hhaRenderSummaryShell
} from '../shared/hha-shell.js';

const $ = (sel) => document.querySelector(sel);
const qs = new URLSearchParams(location.search);

const PID = qs.get('pid') || '';
const STUDY_ID = qs.get('studyId') || '';
const DISPLAY_NAME = qs.get('name') || qs.get('nick') || '';
const DEVICE_TYPE = /android|iphone|ipad|mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

const APP_FAMILY = 'HeroHealth';
const GAME_ID = 'mask-cough-v3';
const GAME_VERSION = 'v3';
const GAME_ZONE = 'hygiene';

const MASK_PROGRESS_KEY = 'HH_MASK_COUGH_V3_PROGRESS';
const MASK_REWARD_STORE_KEY = 'HH_MASK_COUGH_V3_REWARDS';

const READY_ITEMS = {
  mask: { id: 'mask', label: 'หน้ากาก', emoji: '😷', correct: true },
  tissue: { id: 'tissue', label: 'ทิชชู', emoji: '🧻', correct: true },
  bin: { id: 'bin', label: 'ถังขยะ', emoji: '🗑️', correct: true },
  toy: { id: 'toy', label: 'ของเล่น', emoji: '🧸', correct: false },
  chips: { id: 'chips', label: 'ขนม', emoji: '🍟', correct: false },
  shoe: { id: 'shoe', label: 'รองเท้า', emoji: '👟', correct: false }
};

const MASK_ZONES = [
  { id: 'strap-left', label: 'สายซ้าย', x: 28, y: 33, w: 12, h: 14 },
  { id: 'cover-center', label: 'ปิดจมูกปาก', x: 40, y: 40, w: 22, h: 18 },
  { id: 'strap-right', label: 'สายขวา', x: 62, y: 33, w: 12, h: 14 }
];

const COUGH_TARGETS = [
  { id: 'cough-a', label: 'ไอจุด 1', emoji: '💨', x: 66, y: 38 },
  { id: 'cough-b', label: 'ไอจุด 2', emoji: '💨', x: 76, y: 48 },
  { id: 'cough-c', label: 'ไอจุด 3', emoji: '💨', x: 62, y: 56 }
];

const USED_TISSUES = [
  { id: 'used-a', label: 'ทิชชูใช้แล้ว 1', emoji: '🧻', x: 24, y: 72 },
  { id: 'used-b', label: 'ทิชชูใช้แล้ว 2', emoji: '🧻', x: 46, y: 78 }
];

const PHASES = [
  {
    id: 'ready',
    badge: 'Step 1 • เตรียมอุปกรณ์',
    task: 'เลือกหน้ากาก ทิชชู และถังขยะให้ถูก',
    mission: 'เตรียมอุปกรณ์ป้องกันการไอจาม',
    coach: 'เริ่มเลย! เลือกหน้ากาก ทิชชู และถังขยะก่อนนะ',
    goal: 'เลือกของที่ถูก 3 ชิ้น',
    subGoal: 'ของผิดจะโดนหักคะแนน',
    hint: 'เลือกหน้ากาก ทิชชู และถังขยะ'
  },
  {
    id: 'mask',
    badge: 'Step 2 • ใส่หน้ากาก',
    task: 'ใส่หน้ากากให้ถูกตำแหน่ง',
    mission: 'ใส่หน้ากากปิดจมูกและปาก',
    coach: 'ต่อไปใส่หน้ากากให้ครบทั้งสายซ้าย กลาง และสายขวา',
    goal: 'ติดหน้ากากครบ 3 จุด',
    subGoal: 'เริ่มจากจุดที่ไฮไลต์จะได้ perfect',
    hint: 'ใช้หน้ากากแตะจุดบนใบหน้า'
  },
  {
    id: 'cover',
    badge: 'Step 3 • ปิดปากเวลาไอ',
    task: 'ใช้ทิชชูปิดจุดไอให้ครบ',
    mission: 'ปิดปากเวลาไอจามอย่างปลอดภัย',
    coach: 'มีจุดไอออกมาแล้ว ใช้ทิชชูปิดให้ครบเลย',
    goal: 'ปิดจุดไอครบทุกจุด',
    subGoal: 'เริ่มจากจุดที่ไฮไลต์ก่อน',
    hint: 'ใช้ทิชชูแตะจุดไอ'
  },
  {
    id: 'dispose',
    badge: 'Step 4 • ทิ้งทิชชู',
    task: 'ทิ้งทิชชูใช้แล้วลงถังให้ครบ',
    mission: 'กำจัดทิชชูใช้แล้วให้เรียบร้อย',
    coach: 'ตอนนี้ทิ้งทิชชูใช้แล้วลงถังให้ครบเลย',
    goal: 'ทิ้งทิชชูใช้แล้วครบ',
    subGoal: 'เริ่มจากชิ้นที่ไฮไลต์ก่อน',
    hint: 'ใช้ถังขยะแตะทิชชูใช้แล้ว'
  },
  {
    id: 'boss',
    badge: 'Boss • Final Check',
    task: 'แตะจุดหน้ากากที่ไฮไลต์ตามลำดับ',
    mission: 'Final Check ตรวจความปลอดภัย',
    coach: 'ถึงช่วง Final Check แล้ว แตะจุดที่ไฮไลต์ให้ครบเลย',
    goal: 'ตรวจครบ 3 จุดแบบไม่พลาด',
    subGoal: 'แตะถูกต่อเนื่องจะได้โบนัส',
    hint: 'แตะเฉพาะจุดที่ไฮไลต์',
    bossCount: 3
  }
];

const MASK_QUIZ = [
  {
    id: 'q1',
    text: 'หน้ากากที่ถูกต้องควรปิดส่วนไหน',
    choices: [
      { id: 'a', text: 'ปิดทั้งจมูกและปาก', correct: true },
      { id: 'b', text: 'ปิดแค่คาง' },
      { id: 'c', text: 'แขวนไว้ที่หูอย่างเดียว' }
    ]
  },
  {
    id: 'q2',
    text: 'เวลาไอหรือจามควรใช้อะไรช่วยปิด',
    choices: [
      { id: 'a', text: 'ทิชชูสะอาด', correct: true },
      { id: 'b', text: 'ของเล่น' },
      { id: 'c', text: 'ขนม' }
    ]
  },
  {
    id: 'q3',
    text: 'ทิชชูใช้แล้วควรทำอย่างไร',
    choices: [
      { id: 'a', text: 'ทิ้งลงถังขยะ', correct: true },
      { id: 'b', text: 'วางไว้บนพื้น' },
      { id: 'c', text: 'เก็บไว้ในมือ' }
    ]
  }
];

const app = {
  phaseBadge: $('#phaseBadge'),
  taskText: $('#taskText'),
  scoreValue: $('#scoreValue'),
  comboValue: $('#comboValue'),
  livesValue: $('#livesValue'),
  helpBtn: $('#helpBtn'),
  homeBtn: $('#homeBtn'),

  briefCard: $('#briefCard'),
  scene: $('#scene'),
  summaryRoot: $('#summaryRoot'),
  quizRoot: $('#quizRoot'),

  phaseChip: $('#phaseChip'),
  directorChip: $('#directorChip'),
  timerChip: $('#timerChip'),
  timerValue: $('#timerValue'),
  missionTitle: $('#missionTitle'),
  progressFill: $('#progressFill'),
  phaseProgressText: $('#phaseProgressText'),
  streakFill: $('#streakFill'),
  speechBubble: $('#speechBubble'),
  coachHintChip: $('#coachHintChip'),
  feedbackPop: $('#feedbackPop'),

  toolMask: $('#toolMask'),
  toolTissue: $('#toolTissue'),
  toolBin: $('#toolBin'),

  hotspotsLayer: $('#hotspotsLayer'),
  effectsLayer: $('#effectsLayer'),
  stageCard: $('#stageCard'),

  retryBtn: $('#retryBtn'),
  mistakeBtn: $('#mistakeBtn'),

  cleanText: $('#cleanText'),
  hintText: $('#hintText'),
  comboPill: $('#comboPill'),
  goalText: $('#goalText'),
  subGoalText: $('#subGoalText'),
  bestComboValue: $('#bestComboValue'),
  perfectValue: $('#perfectValue'),
  modeValue: $('#modeValue'),
  focusValue: $('#focusValue')
};

const maskSfx = createHhaSfx({ enabled: qs.get('audio') !== '0' });
const rewardEngine = createRewardEngine({ storageKey: MASK_REWARD_STORE_KEY });

const state = {
  mode: qs.get('mode') || 'play',
  audioEnabled: qs.get('audio') !== '0',

  score: 0,
  combo: 1,
  bestCombo: 1,
  perfectCount: 0,
  lives: 8,

  clean: 0,
  maxClean: MASK_ZONES.length + COUGH_TARGETS.length + USED_TISSUES.length,

  phaseIndex: 0,
  focusId: null,
  currentTool: null,

  selectedReadyItems: new Set(),
  maskZones: {},
  coughTargets: {},
  wasteItems: {},

  timer: {
    active: false,
    phaseId: '',
    remainSec: 0,
    deadlineTs: 0,
    intervalId: null
  },

  director: {
    mode: 'normal',
    timerScale: 1,
    soapNeedScale: 1,
    wetSwipeNeed: 14,
    rinseSwipeNeed: 14,
    drySwipeNeed: 22,
    bossBonus: 0,
    label: 'AI ปกติ'
  },

  coach: {
    lastTipAt: 0,
    totalTips: 0,
    mood: 'normal',
    lastReason: ''
  },

  rewardStore: null,
  rewardOutcome: null,

  runStartedAt: 0,
  runId: '',
  completed: false,
  eventLog: [],
  phaseStats: {},
  quizAnswers: [],
  quizIndex: 0,

  bossQueue: [],
  bossIndex: 0,

  progress: null,
  timeoutCount: 0
};

const directorEngine = createHhaDirector({
  mode: state.mode,
  onChange: (next) => {
    state.director = { ...next };
    updateDirectorChip();
  }
});

const coachEngine = createHhaCoach({
  minGapMs: 2200,
  setHint: (text, mood) => setCoachHint(text, mood),
  speak: (text) => coachSay(text),
  onTip: ({ reason, mood, text, snapshot }) => {
    state.coach = {
      ...state.coach,
      lastTipAt: snapshot.lastTipAt,
      totalTips: snapshot.totalTips,
      mood: snapshot.mood,
      lastReason: snapshot.lastReason
    };

    if (state.runId) {
      ensurePhaseStat(currentPhaseId()).tips += 1;
      logEvent('coach_tip', { reason, mood, text });
    }
  }
});

function createDefaultProgress() {
  return {
    version: 1,
    runs: 0,
    starsTotal: 0,
    bestScore: 0,
    lastScore: 0,
    recentRuns: []
  };
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(MASK_PROGRESS_KEY);
    if (!raw) return createDefaultProgress();
    const obj = JSON.parse(raw);
    return {
      ...createDefaultProgress(),
      ...(obj || {}),
      recentRuns: Array.isArray(obj?.recentRuns) ? obj.recentRuns : []
    };
  } catch {
    return createDefaultProgress();
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(MASK_PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}

function nowRunMs() {
  return hhaNowRunMs(state.runStartedAt);
}

function currentPhaseId() {
  return getCurrentPhase()?.id || 'boot';
}

function ensurePhaseStat(phaseId = currentPhaseId()) {
  return hhaEnsurePhaseStat(state.phaseStats, phaseId);
}

function logEvent(type, data = {}) {
  return hhaPushEvent({
    eventLog: state.eventLog,
    runId: state.runId,
    runStartedAt: state.runStartedAt,
    phaseId: currentPhaseId(),
    type,
    data
  });
}

function parseHubUrl() {
  return qs.get('hub') || '../hub.html';
}

function buildReplayUrl() {
  return location.href;
}

function cleanupRuntime() {}

function safeNavigate(url) {
  cleanupRuntime();
  location.href = url;
}

function coachSay(text) {
  if (app.speechBubble) app.speechBubble.textContent = text;
}

function setCoachHint(text, mood = 'normal') {
  hhaSetCoachHint(app.coachHintChip, text, mood);
}

function coachTip(reason, opts = {}) {
  const phase = getCurrentPhase();
  const maskLabel = MASK_ZONES.find(z => z.id === state.focusId)?.label;
  const coughLabel = COUGH_TARGETS.find(c => c.id === state.focusId)?.label;
  const wasteLabel = USED_TISSUES.find(w => w.id === state.focusId)?.label;
  const focusLabel = maskLabel || coughLabel || wasteLabel || 'จุดที่ไฮไลต์';

  const tipMap = {
    ready_start: { text: 'เลือกหน้ากาก ทิชชู และถังขยะให้ครบ', mood: 'normal' },
    wrong_item: { text: 'เลือกเฉพาะของที่ใช้ป้องกันการไอจาม', mood: 'warn' },
    wrong_tool: {
      text: `ตอนนี้ใช้ ${
        phase?.id === 'mask' ? 'หน้ากาก'
        : phase?.id === 'cover' ? 'ทิชชู'
        : phase?.id === 'dispose' ? 'ถังขยะ'
        : 'อุปกรณ์ที่ถูก'
      } นะ`,
      mood: 'warn'
    },
    focus_target: { text: `เริ่มที่ ${focusLabel} ก่อน`, mood: 'normal' },
    timeout: { text: 'หมดเวลาแล้ว รอบนี้ระบบช่วยผ่อนให้เล็กน้อย', mood: 'alert' },
    combo3: { text: 'ดีมาก รักษาจังหวะนี้ไว้', mood: 'good' },
    combo5: { text: 'สุดยอด! ตอนนี้คอมโบกำลังแรงมาก', mood: 'good' },
    boss_wrong: { text: 'แตะเฉพาะจุดที่ไฮไลต์ตามลำดับ', mood: 'alert' },
    boss_start: { text: 'Final Check: แตะจุดหน้ากากที่ไฮไลต์ให้ครบ', mood: 'warn' },
    assist_on: { text: 'รอบนี้ระบบช่วยให้เล่นลื่นขึ้น', mood: 'good' },
    challenge_on: { text: 'เก่งมาก รอบนี้ระบบเพิ่มความท้าทายให้นิดหนึ่ง', mood: 'warn' }
  };

  const tip = tipMap[reason];
  if (!tip) return false;

  return coachEngine.push(reason, {
    text: tip.text,
    mood: tip.mood,
    speakText: tip.text,
    speakEnabled: !!opts.speak
  });
}

function updateDirectorChip() {
  hhaSetDirectorChip(app.directorChip, state.director?.label || 'AI ปกติ', state.director?.mode || 'normal');
}

function setScore(value) {
  state.score = Math.max(0, value);
  app.scoreValue.textContent = String(state.score);
}

function addScore(delta) {
  setScore(state.score + delta);
}

function addCombo() {
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  app.comboValue.textContent = String(state.combo);
}

function resetCombo() {
  state.combo = 1;
  app.comboValue.textContent = '1';
}

function getStarsFromScore() {
  if (state.score >= 260) return 3;
  if (state.score >= 170) return 2;
  return 1;
}

function showFeedback(text) {
  if (!app.feedbackPop) return;
  app.feedbackPop.textContent = text;
  app.feedbackPop.classList.add('show');
  setTimeout(() => app.feedbackPop.classList.remove('show'), 720);
}

function shakeStage() {
  hhaShake(app.stageCard, 'shake', 380);
}

function setTimerUI(sec = 0, hide = false) {
  hhaSetTimerChip(app.timerChip, app.timerValue, sec, hide);
}

function activateTool(toolId) {
  state.currentTool = toolId || null;

  hhaSetActiveButtons(
    { mask: app.toolMask, tissue: app.toolTissue, bin: app.toolBin },
    toolId || ''
  );

  hhaSetDisabledPhase(
    { mask: app.toolMask, tissue: app.toolTissue, bin: app.toolBin },
    !toolId
  );
}

function getCurrentPhase() {
  return PHASES[Math.min(state.phaseIndex, PHASES.length - 1)];
}

function recomputeCleanCount() {
  let c = 0;
  MASK_ZONES.forEach(z => { if (state.maskZones[z.id]?.masked) c += 1; });
  COUGH_TARGETS.forEach(cg => { if (state.coughTargets[cg.id]?.covered) c += 1; });
  USED_TISSUES.forEach(w => { if (state.wasteItems[w.id]?.cleared) c += 1; });
  state.clean = c;
}

function chooseNextFocus() {
  const phase = getCurrentPhase();

  if (phase.id === 'boss') {
    state.focusId = state.bossQueue[state.bossIndex] || null;
    return;
  }

  if (phase.id === 'mask') {
    const pending = MASK_ZONES.filter(z => !state.maskZones[z.id]?.masked);
    state.focusId = pending.length ? pending[0].id : null;
    return;
  }

  if (phase.id === 'cover') {
    const pending = COUGH_TARGETS.filter(c => !state.coughTargets[c.id]?.covered);
    state.focusId = pending.length ? pending[0].id : null;
    return;
  }

  if (phase.id === 'dispose') {
    const pending = USED_TISSUES.filter(w => !state.wasteItems[w.id]?.cleared);
    state.focusId = pending.length ? pending[0].id : null;
  }
}

function getPhaseDoneCount(phaseId) {
  if (phaseId === 'ready') return state.selectedReadyItems.size;
  if (phaseId === 'boss') return state.bossIndex;
  if (phaseId === 'mask') return MASK_ZONES.filter(z => state.maskZones[z.id]?.masked).length;
  if (phaseId === 'cover') return COUGH_TARGETS.filter(c => state.coughTargets[c.id]?.covered).length;
  if (phaseId === 'dispose') return USED_TISSUES.filter(w => state.wasteItems[w.id]?.cleared).length;
  return 0;
}

function phaseTargetCount(phaseId) {
  if (phaseId === 'ready') return 3;
  if (phaseId === 'boss') return state.bossQueue.length || 3;
  if (phaseId === 'mask') return MASK_ZONES.length;
  if (phaseId === 'cover') return COUGH_TARGETS.length;
  if (phaseId === 'dispose') return USED_TISSUES.length;
  return 0;
}

function spawnFx(targetId, emoji = '✨') {
  const node =
    app.hotspotsLayer?.querySelector(`[data-mask-zone="${targetId}"]`) ||
    app.hotspotsLayer?.querySelector(`[data-cough="${targetId}"]`) ||
    app.hotspotsLayer?.querySelector(`[data-waste="${targetId}"]`);

  if (!node || !app.effectsLayer) return;

  const box = node.getBoundingClientRect();
  const parent = app.hotspotsLayer.getBoundingClientRect();

  const fx = document.createElement('div');
  fx.className = 'fx';
  fx.textContent = emoji;
  fx.style.left = `${box.left - parent.left + box.width / 2 - 10}px`;
  fx.style.top = `${box.top - parent.top + box.height / 2 - 10}px`;

  app.effectsLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 760);
}

function spawnScorePopupAtClient(x, y, text = '+10', kind = 'good') {
  if (!app.stageCard) return;
  const rect = app.stageCard.getBoundingClientRect();

  hhaSpawnFloatingScore(app.stageCard, {
    x: x - rect.left - 10,
    y: y - rect.top - 10,
    text,
    kind,
    className: 'floating-score',
    lifeMs: 860
  });
}

function spawnScorePopupAtTarget(targetId, text = '+10', kind = 'good') {
  const node =
    app.hotspotsLayer?.querySelector(`[data-mask-zone="${targetId}"]`) ||
    app.hotspotsLayer?.querySelector(`[data-cough="${targetId}"]`) ||
    app.hotspotsLayer?.querySelector(`[data-waste="${targetId}"]`);

  if (!node || !app.stageCard) return;

  const r = node.getBoundingClientRect();
  spawnScorePopupAtClient(r.left + r.width / 2, r.top + r.height / 2, text, kind);
}

function showComboBurst(text = 'Combo!') {
  hhaShowBurst(app.stageCard, {
    text,
    className: 'combo-burst',
    lifeMs: 820
  });
}

function showPhaseFlash(title = 'Phase Clear!', sub = '') {
  hhaShowPhaseFlash(app.stageCard, {
    title,
    sub,
    className: 'phase-flash',
    cardClassName: 'phase-flash-card',
    titleClassName: 'phase-flash-title',
    subClassName: 'phase-flash-sub',
    lifeMs: 760
  });
}

function spawnWinBurst() {
  hhaSpawnIconBurst(app.stageCard, {
    count: 12,
    icons: ['⭐', '✨', '💨', '😷'],
    className: 'win-burst',
    itemClassName: 'win-star',
    leftRange: [10, 90],
    topRange: [45, 70],
    staggerMs: 40,
    lifeMs: 1100
  });
}

function spawnStickerBurst(gain = 1) {
  hhaSpawnIconBurst(app.stageCard, {
    count: Math.max(1, gain),
    icons: ['⭐', '🏅', '✨', '🎖️'],
    className: 'sticker-burst',
    itemClassName: 'sticker-pop',
    leftRange: [28, 72],
    topRange: [42, 58],
    staggerMs: 60,
    lifeMs: 1100
  });
}

function createStateMark(z, className, badgeText = '') {
  const mark = document.createElement('div');
  mark.className = `state-mark ${className}`;
  mark.style.left = `${z.x}%`;
  mark.style.top = `${z.y}%`;
  mark.style.width = `${z.w}%`;
  mark.style.height = `${z.h}%`;

  if (badgeText) {
    const badge = document.createElement('div');
    badge.className = 'state-badge';
    badge.textContent = badgeText;
    mark.appendChild(badge);
  }

  return mark;
}

function addShine(mark) {
  const s1 = document.createElement('div');
  const s2 = document.createElement('div');
  s1.className = 'state-shine';
  s2.className = 'state-shine';
  s1.textContent = '✨';
  s2.textContent = '✨';
  s1.style.left = '10%';
  s1.style.top = '-8px';
  s2.style.right = '10%';
  s2.style.bottom = '-8px';
  mark.appendChild(s1);
  mark.appendChild(s2);
}

function initState() {
  state.maskZones = {};
  MASK_ZONES.forEach(z => {
    state.maskZones[z.id] = { masked: false, inspected: false };
  });

  state.coughTargets = {};
  COUGH_TARGETS.forEach(c => {
    state.coughTargets[c.id] = { covered: false };
  });

  state.wasteItems = {};
  USED_TISSUES.forEach(w => {
    state.wasteItems[w.id] = { cleared: false };
  });
}

function renderStateDecor() {
  if (!app.effectsLayer) return;
  app.effectsLayer.querySelector('.state-layer')?.remove();

  const layer = document.createElement('div');
  layer.className = 'state-layer';

  MASK_ZONES.forEach(z => {
    const st = state.maskZones[z.id];
    if (!st) return;

    let mark = null;
    if (st.masked && st.inspected) {
      mark = createStateMark(z, 'is-safe', '✨');
      addShine(mark);
    } else if (st.masked) {
      mark = createStateMark(z, 'is-masked', '😷');
    }

    if (mark) layer.appendChild(mark);
  });

  app.effectsLayer.prepend(layer);
}

function renderHotspots() {
  if (!app.hotspotsLayer) return;
  app.hotspotsLayer.innerHTML = '';
  const phase = getCurrentPhase();

  if (phase.id === 'ready') {
    renderStateDecor();
    return;
  }

  if (phase.id === 'mask' || phase.id === 'boss') {
    MASK_ZONES.forEach(z => {
      const st = state.maskZones[z.id];
      const el = document.createElement('div');
      el.className = 'hotspot';
      el.dataset.maskZone = z.id;
      el.style.left = `${z.x}%`;
      el.style.top = `${z.y}%`;
      el.style.width = `${z.w}%`;
      el.style.height = `${z.h}%`;

      const done =
        (phase.id === 'mask' && st.masked) ||
        (phase.id === 'boss' && st.inspected);

      if (done) el.classList.add('is-done');
      if (state.focusId === z.id) el.classList.add('is-focus');
      if (phase.id === 'boss' && state.focusId === z.id) el.classList.add('is-boss-target');

      el.innerHTML = `
        <div class="hotspot-label">${z.label}</div>
        <div class="hotspot-progress"><i style="width:${done ? 100 : 0}%"></i></div>
      `;

      el.addEventListener('click', () => {
        if (phase.id === 'mask') handleMask(z.id);
        else handleBossTap(z.id);
      });

      app.hotspotsLayer.appendChild(el);
    });

    renderStateDecor();
    return;
  }

  if (phase.id === 'cover') {
    COUGH_TARGETS.forEach(c => {
      const st = state.coughTargets[c.id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cough-target';
      btn.dataset.cough = c.id;
      btn.style.left = `${c.x}%`;
      btn.style.top = `${c.y}%`;
      btn.textContent = c.emoji;

      if (state.focusId === c.id) btn.classList.add('is-focus');
      if (st.covered) btn.classList.add('is-cleared');

      btn.addEventListener('click', () => handleCough(c.id));
      app.hotspotsLayer.appendChild(btn);
    });

    renderStateDecor();
    return;
  }

  if (phase.id === 'dispose') {
    USED_TISSUES.forEach(w => {
      const st = state.wasteItems[w.id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'waste-item';
      btn.dataset.waste = w.id;
      btn.style.left = `${w.x}%`;
      btn.style.top = `${w.y}%`;
      btn.textContent = w.emoji;

      if (state.focusId === w.id) btn.classList.add('is-focus');
      if (st.cleared) btn.classList.add('is-cleared');

      btn.addEventListener('click', () => handleWaste(w.id));
      app.hotspotsLayer.appendChild(btn);
    });

    renderStateDecor();
  }
}

function handleComboJuice() {
  if (state.combo === 3) showComboBurst('Combo x3!');
  else if (state.combo === 5) showComboBurst('Perfect Combo!');
}

function rewardScoreVisual(targetId, baseScore, isFocus = false) {
  const total = baseScore + (isFocus ? 8 : 0);
  spawnScorePopupAtTarget(targetId, `+${total}`, isFocus ? 'bonus' : 'good');
}

function rewardForSuccess(targetId, baseScore, emoji) {
  const isFocus = state.focusId === targetId;

  addCombo();
  addScore(baseScore + (isFocus ? 8 : 0));
  rewardScoreVisual(targetId, baseScore, isFocus);
  handleComboJuice();

  ensurePhaseStat(currentPhaseId()).correctHits += 1;
  logEvent('success', {
    targetId,
    phaseId: currentPhaseId(),
    baseScore,
    focus: isFocus,
    combo: state.combo
  });

  if (isFocus) {
    state.perfectCount += 1;
    showFeedback('Perfect!');
    maskSfx.play('perfect');
  } else {
    showFeedback('เยี่ยม!');
    maskSfx.play('good');
  }

  if (state.combo === 3) coachTip('combo3');
  if (state.combo === 5) coachTip('combo5');

  recomputeCleanCount();
  spawnFx(targetId, emoji);
  chooseNextFocus();
  updatePlayUI();
  maybeCompletePhase();
}

function getAdaptiveBaseline(progress = state.progress, mode = state.mode) {
  directorEngine.setMode(mode);
  return directorEngine.baselineFromRecentRuns({ progress, mode });
}

function applyDirectorPreset(kind = 'normal') {
  directorEngine.setMode(state.mode);
  directorEngine.apply(kind);
  return state.director;
}

function configureDirectorForRun() {
  directorEngine.setMode(state.mode);
  return directorEngine.configureForRun(state.progress);
}

function directorOnTimeout() {
  directorEngine.setMode(state.mode);
  directorEngine.onTimeout({
    phaseId: currentPhaseId(),
    bossRemaining: Math.max(0, (state.bossQueue.length || 0) - state.bossIndex)
  });

  if (currentPhaseId() === 'boss' && state.director.mode === 'assist' && state.bossQueue.length - state.bossIndex > 2) {
    state.bossQueue.pop();
  }
}

function directorOnPhaseClear() {
  directorEngine.setMode(state.mode);
  return directorEngine.onPhaseClear({
    combo: state.combo,
    perfectCount: state.perfectCount,
    timeoutCount: state.timeoutCount,
    phaseId: currentPhaseId()
  });
}

function startPhaseTimer() {
  const phase = getCurrentPhase();
  clearPhaseTimer(false);

  const base =
    phase.id === 'ready' ? 18 :
    phase.id === 'mask' ? 12 :
    phase.id === 'cover' ? 10 :
    phase.id === 'dispose' ? 10 : 8;

  const adjusted = Math.max(5, Math.round(base * state.director.timerScale));

  state.timer.active = true;
  state.timer.phaseId = phase.id;
  state.timer.deadlineTs = Date.now() + adjusted * 1000;
  state.timer.remainSec = adjusted;

  ensurePhaseStat(phase.id).enters += 1;
  logEvent('phase_timer_start', {
    phaseId: phase.id,
    adjustedSec: adjusted,
    director: state.director.mode
  });

  setTimerUI(adjusted, false);
  setCoachHint(phase.hint, state.director.mode === 'assist' ? 'good' : state.director.mode === 'challenge' ? 'warn' : 'normal');

  state.timer.intervalId = setInterval(() => {
    const remain = Math.max(0, Math.ceil((state.timer.deadlineTs - Date.now()) / 1000));
    state.timer.remainSec = remain;
    setTimerUI(remain, false);

    if (remain <= 0) handlePhaseTimeout();
  }, 200);
}

function clearPhaseTimer(hide = true) {
  if (state.timer.intervalId) clearInterval(state.timer.intervalId);
  state.timer.intervalId = null;
  state.timer.active = false;
  state.timer.phaseId = '';
  state.timer.remainSec = 0;
  state.timer.deadlineTs = 0;
  if (hide) setTimerUI(0, true);
}

function handlePhaseTimeout() {
  clearPhaseTimer(false);

  state.timeoutCount += 1;
  state.lives = Math.max(1, state.lives - 1);
  addScore(-15);
  resetCombo();

  ensurePhaseStat(currentPhaseId()).timeouts += 1;
  logEvent('phase_timeout', {
    phaseId: currentPhaseId(),
    timeoutCount: state.timeoutCount
  });

  resetCurrentPhaseProgress();
  directorOnTimeout();

  showFeedback('หมดเวลา!');
  shakeStage();
  maskSfx.play('bad');
  showPhaseFlash('หมดเวลา!', 'ลองด่านนี้อีกครั้งนะ');
  coachTip('timeout', { speak: true });

  rerenderPhase();
}

function resetCurrentPhaseProgress() {
  const phase = getCurrentPhase();

  if (phase.id === 'ready') {
    state.selectedReadyItems = new Set();
    return;
  }

  if (phase.id === 'mask') {
    MASK_ZONES.forEach(z => {
      state.maskZones[z.id].masked = false;
      state.maskZones[z.id].inspected = false;
    });
  } else if (phase.id === 'cover') {
    COUGH_TARGETS.forEach(c => {
      state.coughTargets[c.id].covered = false;
    });
  } else if (phase.id === 'dispose') {
    USED_TISSUES.forEach(w => {
      state.wasteItems[w.id].cleared = false;
    });
  } else if (phase.id === 'boss') {
    MASK_ZONES.forEach(z => {
      state.maskZones[z.id].inspected = false;
    });
    state.bossIndex = 0;
  }

  recomputeCleanCount();
}

function rerenderPhase() {
  if (getCurrentPhase().id === 'ready') {
    renderReadyPhase();
    updatePlayUI();
    startPhaseTimer();
    return;
  }

  chooseNextFocus();
  updatePlayUI();
  renderStateDecor();
  startPhaseTimer();
}

function maybeCompletePhase() {
  const phase = getCurrentPhase();

  if (phase.id === 'boss') {
    if (state.bossIndex >= state.bossQueue.length) finishRun();
    return;
  }

  if (getPhaseDoneCount(phase.id) >= phaseTargetCount(phase.id)) {
    markPhaseAdvance();
  }
}

function markPhaseAdvance() {
  clearPhaseTimer(true);
  directorOnPhaseClear();

  if (state.phaseIndex < PHASES.length - 1) {
    const finished = getCurrentPhase();
    ensurePhaseStat(finished.id).clears += 1;
    logEvent('phase_clear', { phaseId: finished.id, atMs: nowRunMs() });

    state.phaseIndex += 1;

    if (getCurrentPhase().id === 'boss') {
      buildBossQueue();
      MASK_ZONES.forEach(z => {
        state.maskZones[z.id].inspected = false;
      });
      coachTip('boss_start');
    }

    chooseNextFocus();
    showFeedback('Phase Clear!');
    showPhaseFlash('Phase Clear!', `${finished.badge} ผ่านแล้ว`);
    maskSfx.play('phase');
    updatePlayUI();
    renderStateDecor();

    setTimeout(() => {
      coachSay(getCurrentPhase().coach);
      startPhaseTimer();
    }, 260);
    return;
  }

  finishRun();
}

function buildBossQueue() {
  state.bossQueue = MASK_ZONES.map(z => z.id).slice(0, 3);
  state.bossIndex = 0;
}

function handleMask(zoneId) {
  const phase = getCurrentPhase();
  if (phase.id !== 'mask') return;

  if (state.currentTool !== 'mask') {
    ensurePhaseStat('mask').wrongHits += 1;
    logEvent('wrong_tool', { expected: 'mask', got: state.currentTool, zoneId });
    coachTip('wrong_tool', { speak: true });
    return;
  }

  if (!state.maskZones[zoneId].masked) {
    state.maskZones[zoneId].masked = true;
    rewardForSuccess(zoneId, 12, '😷');
    renderStateDecor();
  }
}

function handleCough(coughId) {
  const phase = getCurrentPhase();
  if (phase.id !== 'cover') return;

  if (state.currentTool !== 'tissue') {
    ensurePhaseStat('cover').wrongHits += 1;
    logEvent('wrong_tool', { expected: 'tissue', got: state.currentTool, coughId });
    coachTip('wrong_tool', { speak: true });
    return;
  }

  if (!state.coughTargets[coughId].covered) {
    state.coughTargets[coughId].covered = true;
    rewardForSuccess(coughId, 12, '🧻');
    updatePlayUI();
  }
}

function handleWaste(wasteId) {
  const phase = getCurrentPhase();
  if (phase.id !== 'dispose') return;

  if (state.currentTool !== 'bin') {
    ensurePhaseStat('dispose').wrongHits += 1;
    logEvent('wrong_tool', { expected: 'bin', got: state.currentTool, wasteId });
    coachTip('wrong_tool', { speak: true });
    return;
  }

  if (!state.wasteItems[wasteId].cleared) {
    state.wasteItems[wasteId].cleared = true;
    rewardForSuccess(wasteId, 12, '🗑️');
    updatePlayUI();
  }
}

function handleBossTap(zoneId) {
  const targetId = state.bossQueue[state.bossIndex];
  if (!targetId) return;

  if (zoneId !== targetId) {
    addScore(-10);
    resetCombo();
    state.lives = Math.max(1, state.lives - 1);
    ensurePhaseStat('boss').wrongHits += 1;
    logEvent('boss_wrong_tap', { zoneId, targetId });
    showFeedback('ผิดจุด!');
    shakeStage();
    maskSfx.play('bad');
    spawnScorePopupAtTarget(zoneId, '-10', 'bad');
    coachTip('boss_wrong', { speak: true });
    updatePlayUI();
    return;
  }

  state.maskZones[zoneId].inspected = true;
  addCombo();
  addScore(22 + (state.combo >= 3 ? 8 : 0));
  rewardScoreVisual(zoneId, 22, state.combo >= 3);
  handleComboJuice();
  maskSfx.play('boss');

  ensurePhaseStat('boss').correctHits += 1;
  logEvent('boss_correct_tap', {
    zoneId,
    index: state.bossIndex,
    combo: state.combo
  });

  showFeedback('Check ผ่าน!');
  spawnFx(zoneId, '✅');

  state.bossIndex += 1;
  chooseNextFocus();
  updatePlayUI();

  if (state.bossIndex >= state.bossQueue.length) {
    clearPhaseTimer(true);
    ensurePhaseStat('boss').clears += 1;
    logEvent('phase_clear', { phaseId: 'boss', atMs: nowRunMs() });
    showPhaseFlash('Boss Clear!', 'ตรวจครบแล้ว ปลอดภัยแล้ว');
    spawnWinBurst();
    coachSay('ตรวจครบแล้ว ปลอดภัยแล้ว');
    setTimeout(() => finishRun(), 420);
  }
}

function updatePlayUI() {
  const phase = getCurrentPhase();
  const totalPct = Math.min(100, Math.round((state.clean / state.maxClean) * 100));
  const streakPct = Math.min(100, 12 + state.combo * 14);
  const phaseDone = getPhaseDoneCount(phase.id);

  app.phaseBadge.textContent = 'Mask & Cough v3';
  app.taskText.textContent = phase.task;
  app.phaseChip.textContent = phase.badge;
  app.missionTitle.textContent = phase.mission;
  app.progressFill.style.width = `${totalPct}%`;
  app.phaseProgressText.textContent = `${phaseDone} / ${phaseTargetCount(phase.id)}`;
  app.streakFill.style.width = `${streakPct}%`;

  app.cleanText.textContent = `${state.clean} / ${state.maxClean}`;
  app.hintText.textContent = phase.hint;
  app.goalText.textContent = phase.goal;
  app.subGoalText.textContent = phase.subGoal;

  app.comboPill.textContent =
    state.combo >= 5 ? '🌟 Perfect Run ใกล้สำเร็จ'
    : state.combo >= 3 ? `🔥 Combo x${state.combo}`
    : '✨ เริ่มต้นได้ดี';

  const maskLabel = MASK_ZONES.find(z => z.id === state.focusId)?.label;
  const coughLabel = COUGH_TARGETS.find(c => c.id === state.focusId)?.label;
  const wasteLabel = USED_TISSUES.find(w => w.id === state.focusId)?.label;

  app.bestComboValue.textContent = String(state.bestCombo);
  app.perfectValue.textContent = String(state.perfectCount);
  app.modeValue.textContent = state.mode;
  app.focusValue.textContent = maskLabel || coughLabel || wasteLabel || '-';

  app.scoreValue.textContent = String(state.score);
  app.comboValue.textContent = String(state.combo);
  app.livesValue.textContent = String(state.lives);

  if (phase.id === 'ready') {
    app.scene.classList.add('hidden');
  } else {
    app.scene.classList.remove('hidden');

    const toolMap = {
      mask: 'mask',
      cover: 'tissue',
      dispose: 'bin',
      boss: null
    };
    activateTool(toolMap[phase.id] ?? null);
  }

  renderHotspots();
}

function renderReadyPhase() {
  app.scene.classList.add('hidden');
  app.summaryRoot.innerHTML = '';
  app.quizRoot.innerHTML = '';
  clearPhaseTimer(true);
  ensurePhaseStat('ready').enters += 1;
  setCoachHint('เลือกหน้ากาก ทิชชู และถังขยะให้ครบ', 'normal');
  coachTip('ready_start');

  const pool = ['mask', 'tissue', 'bin', 'toy', 'chips', 'shoe'];

  app.briefCard.innerHTML = `
    <h1 class="brief-title">Mask & Cough v3</h1>
    <p class="brief-sub">${getCurrentPhase().coach}</p>

    <div class="brief-stats">
      ${hhaRenderPills([
        'เลือกหน้ากาก ทิชชู และถังขยะ',
        state.director.label,
        'ทำต่อเนื่องจะได้ combo'
      ])}
    </div>

    <div class="items-grid">
      ${pool.map(id => {
        const item = READY_ITEMS[id];
        return `
          <button class="item-btn" type="button" data-item="${item.id}">
            <span>${item.emoji}</span> ${item.label}
          </button>
        `;
      }).join('')}
    </div>

    <div class="brief-actions">
      <button id="readyHelpBtn" class="big-btn soft" type="button">ฟังวิธีเล่น</button>
      <button id="readyRestartBtn" class="big-btn soft" type="button">เริ่มรอบใหม่</button>
    </div>
  `;

  app.briefCard.querySelectorAll('[data-item]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await maskSfx.unlock();

      const id = btn.dataset.item;
      const item = READY_ITEMS[id];
      const isCorrect = !!item.correct;

      if (isCorrect && !state.selectedReadyItems.has(id)) {
        state.selectedReadyItems.add(id);
        addScore(10);
        addCombo();
        ensurePhaseStat('ready').correctHits += 1;
        logEvent('ready_item_correct', { itemId: id });
        btn.classList.add('is-correct');
        btn.disabled = true;
        showFeedback('ถูกต้อง!');
        handleComboJuice();
        maskSfx.play('good');
      } else if (!isCorrect) {
        addScore(-2);
        resetCombo();
        ensurePhaseStat('ready').wrongHits += 1;
        logEvent('ready_item_wrong', { itemId: id });
        btn.classList.add('is-wrong');
        btn.disabled = true;
        showFeedback('ยังไม่ใช่');
        shakeStage();
        maskSfx.play('bad');
        coachTip('wrong_item', { speak: true });
      }

      updatePlayUI();

      if (state.selectedReadyItems.size >= 3) {
        ensurePhaseStat('ready').clears += 1;
        logEvent('phase_clear', { phaseId: 'ready', atMs: nowRunMs() });
        showFeedback('พร้อมแล้ว!');
        showPhaseFlash('Mission Start!', 'ใส่หน้ากากและป้องกันการไอจามให้ถูกต้อง');
        maskSfx.play('phase');

        setTimeout(() => {
          state.phaseIndex = 1;
          state.clean = 0;
          chooseNextFocus();
          app.briefCard.innerHTML = '';
          updatePlayUI();
          startPhaseTimer();
          coachTip('focus_target');
        }, 520);
      }
    });
  });

  $('#readyHelpBtn')?.addEventListener('click', () => coachSay('เลือกหน้ากาก ทิชชู และถังขยะ'));
  $('#readyRestartBtn')?.addEventListener('click', () => safeNavigate(buildReplayUrl()));

  startPhaseTimer();
}

function computeRewardOutcome() {
  const outcome = rewardEngine.computeOutcome({
    score: state.score,
    timeoutCount: state.timeoutCount,
    perfectCount: state.perfectCount,
    bestCombo: state.bestCombo,
    store: state.rewardStore
  });

  state.rewardStore = outcome.store;

  return {
    rank: outcome.rank,
    newly: outcome.newly,
    stickerGain: outcome.stickerGain,
    totalStickers: outcome.store.stickerCount,
    allBadges: outcome.badges
  };
}

function finalizeRunProgress() {
  const progress = state.progress || createDefaultProgress();
  progress.runs += 1;
  progress.starsTotal += getStarsFromScore();
  progress.lastScore = state.score;
  progress.bestScore = Math.max(progress.bestScore || 0, state.score);
  progress.recentRuns.unshift({
    at: new Date().toISOString(),
    score: state.score,
    stars: getStarsFromScore(),
    timeoutCount: state.timeoutCount,
    bestCombo: state.bestCombo,
    perfectCount: state.perfectCount
  });
  progress.recentRuns = progress.recentRuns.slice(0, 8);
  state.progress = progress;
  saveProgress(progress);
}

function finishRun() {
  if (state.completed) return;
  state.completed = true;

  state.rewardOutcome = computeRewardOutcome();

  clearPhaseTimer(true);
  spawnWinBurst();
  spawnStickerBurst(state.rewardOutcome?.stickerGain || 1);
  maskSfx.play('win');

  logEvent('run_finish', {
    score: state.score,
    stars: getStarsFromScore(),
    timeout_count: state.timeoutCount,
    best_combo: state.bestCombo,
    perfect_count: state.perfectCount,
    rank: state.rewardOutcome?.rank || ''
  });

  finalizeRunProgress();
  flushLastRunLog();
  renderSummary();
}

function flushLastRunLog() {
  const payload = {
    runId: state.runId,
    gameId: GAME_ID,
    zone: GAME_ZONE,
    mode: state.mode,
    pid: PID,
    studyId: STUDY_ID,
    displayName: DISPLAY_NAME,
    appFamily: APP_FAMILY,
    gameVersion: GAME_VERSION,
    deviceType: DEVICE_TYPE,
    score: state.score,
    stars: getStarsFromScore(),
    eventCount: state.eventLog.length,
    events: state.eventLog,
    phaseStats: state.phaseStats
  };

  hhaPersistArtifacts({
    storageEntries: {
      HH_MASK_COUGH_V3_LAST_LOG: payload
    },
    windowEntries: {
      HH_MASK_COUGH_V3_LAST_RUN: payload
    }
  });
}

async function copyLastRunLog() {
  try {
    await hhaCopyJson(window.HH_MASK_COUGH_V3_LAST_RUN || {});
    showFeedback('คัดลอก log แล้ว');
  } catch {
    showFeedback('คัดลอกไม่สำเร็จ');
  }
}

function renderSummary() {
  app.scene.classList.add('hidden');
  app.briefCard.innerHTML = '';
  app.quizRoot.innerHTML = '';

  const reward = state.rewardOutcome || computeRewardOutcome();
  const stars = getStarsFromScore();

  const rewardGridHtml = hhaRenderRewardGrid([
    { k: 'Sticker Gain', v: `+${reward.stickerGain}` },
    { k: 'Total Stickers', v: `${reward.totalStickers}` },
    { k: 'Events', v: `${state.eventLog.length}` }
  ]);

  const statsPillsHtml = hhaRenderPills([
    `🔥 best combo ${state.bestCombo}`,
    `⭐ perfect ${state.perfectCount}`,
    `✅ final check ${state.bossIndex}/${state.bossQueue.length || 0}`,
    `⏱ timeout ${state.timeoutCount}`,
    `🤖 ${state.director.label}`
  ]);

  const actionsHtml = hhaRenderActionButtons([
    { id: 'toQuizBtn', label: 'ทำคำถามสั้น ๆ', className: 'big-btn primary' },
    { id: 'copyLogBtn', label: 'คัดลอก log', className: 'big-btn soft' },
    { id: 'replayBtn', label: 'เล่นอีกครั้ง', className: 'big-btn soft' },
    { id: 'hubBtn', label: 'กลับ HUB', className: 'big-btn soft' }
  ]);

  app.summaryRoot.innerHTML = hhaRenderSummaryShell({
    title: stars === 3 ? 'ป้องกันได้เก่งมาก!' : stars === 2 ? 'ดีมาก!' : 'ลองอีกครั้งนะ!',
    starsText: `${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}`,
    rankHtml: hhaBuildSummaryRank(reward.rank),
    resultPill: `Mask & Cough v3 • Score ${state.score}`,
    intro: 'รอบนี้หนูเลือกของถูก ใส่หน้ากากถูก ปิดปากเวลาไอ และทิ้งทิชชูเรียบร้อยมาก',
    rewardGridHtml,
    rewardBadgesHtml: hhaBuildRewardBadges(reward.allBadges, reward.newly),
    statsPillsHtml,
    body: [
      'Mask & Cough v3 เป็น vertical slice อีกตัวที่พิสูจน์ว่า shared modules ของ HeroHealth reuse ได้จริงต่อเนื่อง',
      'ตอนนี้ Hygiene Zone มีโครงเกมหลายตัวที่ใช้ pattern กลางเดียวกันแล้ว'
    ],
    actionsHtml
  });

  $('#toQuizBtn')?.addEventListener('click', renderQuiz);
  $('#copyLogBtn')?.addEventListener('click', copyLastRunLog);
  $('#replayBtn')?.addEventListener('click', () => safeNavigate(buildReplayUrl()));
  $('#hubBtn')?.addEventListener('click', () => safeNavigate(parseHubUrl()));
}

function renderQuiz() {
  app.summaryRoot.innerHTML = '';
  state.quizIndex = 0;
  state.quizAnswers = [];

  function draw() {
    const q = MASK_QUIZ[state.quizIndex];
    if (!q) {
      renderQuizDone();
      return;
    }

    app.quizRoot.innerHTML = `
      <div class="quiz-card">
        <h2 class="quiz-title">คำถามสั้น ๆ</h2>
        <div class="result-pill">ข้อ ${state.quizIndex + 1} / ${MASK_QUIZ.length}</div>
        <p class="quiz-sub">${q.text}</p>

        <div class="quiz-options">
          ${q.choices.map(c => `
            <button class="quiz-option" type="button" data-choice="${c.id}">
              ${c.text}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    app.quizRoot.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const choice = q.choices.find(c => c.id === btn.dataset.choice);
        const correct = !!choice?.correct;

        app.quizRoot.querySelectorAll('.quiz-option').forEach(x => x.disabled = true);
        btn.classList.add(correct ? 'is-correct' : 'is-wrong');
        state.quizAnswers.push({ questionId: q.id, answerId: choice?.id, correct });

        if (correct) {
          addScore(5);
          maskSfx.play('good');
        } else {
          maskSfx.play('bad');
        }

        setTimeout(() => {
          state.quizIndex += 1;
          draw();
        }, 480);
      });
    });
  }

  draw();
}

function renderQuizDone() {
  const correctCount = state.quizAnswers.filter(x => x.correct).length;

  app.quizRoot.innerHTML = `
    <div class="quiz-card">
      <h2 class="quiz-title">ตอบเสร็จแล้ว เก่งมาก!</h2>
      <div class="result-pill">ตอบถูก ${correctCount} / ${MASK_QUIZ.length}</div>
      <p class="quiz-sub">สิ่งที่ควรจำ: เลือกอุปกรณ์ให้ถูก ใส่หน้ากากให้ปิดจมูกและปาก ปิดปากเวลาไอ และทิ้งทิชชูใช้แล้วลงถัง</p>

      <div class="quiz-actions">
        <button id="quizReplayBtn" class="big-btn primary" type="button">เล่นอีกครั้ง</button>
        <button id="quizHubBtn" class="big-btn soft" type="button">กลับ HUB</button>
      </div>
    </div>
  `;

  $('#quizReplayBtn')?.addEventListener('click', () => safeNavigate(buildReplayUrl()));
  $('#quizHubBtn')?.addEventListener('click', () => safeNavigate(parseHubUrl()));
}

function resetStateForRun() {
  state.runId = `maskcoughv3-${Date.now()}`;
  state.score = 0;
  state.combo = 1;
  state.bestCombo = 1;
  state.perfectCount = 0;
  state.lives = 8;
  state.clean = 0;
  state.maxClean = MASK_ZONES.length + COUGH_TARGETS.length + USED_TISSUES.length;
  state.phaseIndex = 0;
  state.focusId = null;
  state.currentTool = null;
  state.selectedReadyItems = new Set();
  state.completed = false;
  state.quizAnswers = [];
  state.quizIndex = 0;
  state.rewardOutcome = null;
  state.bossQueue = [];
  state.bossIndex = 0;
  state.timeoutCount = 0;

  coachEngine.reset();
  state.coach = {
    lastTipAt: 0,
    totalTips: 0,
    mood: 'normal',
    lastReason: ''
  };

  state.eventLog = [];
  state.phaseStats = {};

  directorEngine.setMode(state.mode);
  configureDirectorForRun();
  initState();
  clearPhaseTimer(true);

  state.runStartedAt = Date.now();
  logEvent('run_start', {
    mode: state.mode,
    director: state.director.mode
  });
}

function startRun() {
  resetStateForRun();
  app.summaryRoot.innerHTML = '';
  app.quizRoot.innerHTML = '';
  renderReadyPhase();
  updatePlayUI();
}

function bindEvents() {
  app.toolMask?.addEventListener('click', async () => {
    await maskSfx.unlock();
    activateTool('mask');
  });

  app.toolTissue?.addEventListener('click', async () => {
    await maskSfx.unlock();
    activateTool('tissue');
  });

  app.toolBin?.addEventListener('click', async () => {
    await maskSfx.unlock();
    activateTool('bin');
  });

  app.retryBtn?.addEventListener('click', () => safeNavigate(buildReplayUrl()));
  app.mistakeBtn?.addEventListener('click', async () => {
    await maskSfx.unlock();
    state.lives = Math.max(1, state.lives - 1);
    resetCombo();
    addScore(-12);
    ensurePhaseStat(currentPhaseId()).mistakes += 1;
    logEvent('manual_mistake', { phaseId: currentPhaseId() });
    showFeedback('พลาดนิดหน่อย');
    shakeStage();
    maskSfx.play('bad');
    spawnScorePopupAtClient(window.innerWidth * 0.5, window.innerHeight * 0.3, '-12', 'bad');
    updatePlayUI();
  });

  app.helpBtn?.addEventListener('click', async () => {
    await maskSfx.unlock();
    coachSay(getCurrentPhase().hint);
  });

  app.homeBtn?.addEventListener('click', () => safeNavigate(parseHubUrl()));
  window.addEventListener('pagehide', cleanupRuntime);
}

function init() {
  state.progress = loadProgress();
  state.rewardStore = rewardEngine.load();

  maskSfx.setEnabled(state.audioEnabled);
  bindEvents();

  applyDirectorPreset(getAdaptiveBaseline(state.progress, state.mode));
  app.modeValue.textContent = state.mode;
  updateDirectorChip();
  setCoachHint('พร้อมช่วยเสมอ', 'normal');

  app.briefCard.innerHTML = `
    <h1 class="brief-title">Mask & Cough v3</h1>
    <p class="brief-sub">นี่คือ vertical slice ของเกมป้องกันการไอจาม ที่ใช้ shared modules ชุดเดียวกับ Bath, Brush, Handwash และ Clean Objects</p>

    <div class="brief-stats">
      ${hhaRenderPills([
        `⭐ ดาวสะสม ${state.progress?.starsTotal || 0}`,
        `🏆 best score ${state.progress?.bestScore || 0}`,
        `🎮 เล่นแล้ว ${state.progress?.runs || 0} รอบ`,
        `🤖 ${state.director.label}`,
        `🏅 stickers ${state.rewardStore?.stickerCount || 0}`
      ])}
    </div>

    <div class="brief-actions">
      <button id="startBtn" class="big-btn primary" type="button">เริ่ม Mask & Cough v3</button>
      <button id="briefHelpBtn" class="big-btn soft" type="button">ฟังวิธีเล่น</button>
    </div>
  `;

  $('#startBtn')?.addEventListener('click', async () => {
    await maskSfx.unlock();
    startRun();
  });

  $('#briefHelpBtn')?.addEventListener('click', async () => {
    await maskSfx.unlock();
    coachSay('เลือกหน้ากาก ทิชชู และถังขยะ จากนั้นใส่หน้ากาก ปิดปากเวลาไอ และทิ้งทิชชูใช้แล้ว');
  });
}

init();