// /herohealth/bath-v2/bath.js

import {
  BATH_COPY,
  BATH_COACH_LINES,
  BATH_ITEMS,
  BATH_HOTSPOTS,
  BATH_PHASES,
  BATH_QUIZ,
  BATH_READY_CORRECT_IDS,
  BATH_READY_WRONG_POOL,
  BATH_SCRUB_POOL,
  BATH_BOSS_TEMPLATES,
  BATH_COACH_VARIANTS,
  BATH_MISSIONS_50,
  BATH_REWARDS_20
} from './bath.data.js';

import {
  BATH_AUDIO,
  setBathAudioEnabled,
  unlockBathAudio,
  speakBathText,
  speakBathCoachLine,
  speakBathHint,
  speakBathCelebration,
  stopBathSpeech
} from './bath.audio.js';

const $ = (sel) => document.querySelector(sel);
const qs = new URLSearchParams(location.search);
const BATH_PROGRESS_KEY = 'HH_BATH_PROGRESS_V1';

const app = {
  phaseBadge: $('#phaseBadge'),
  taskText: $('#taskText'),
  scoreValue: $('#scoreValue'),
  progressValue: $('#progressValue'),
  timerBox: $('#timerBox'),
  timerValue: $('#timerValue'),
  briefCard: $('#briefCard'),
  scene: $('#scene'),
  roomStage: $('#roomStage'),
  hotspotsLayer: $('#hotspotsLayer'),
  itemsLayer: $('#itemsLayer'),
  effectsLayer: $('#effectsLayer'),
  actionBar: $('#actionBar'),
  coachBubble: $('#coachBubble'),
  summaryRoot: $('#summaryRoot'),
  quizRoot: $('#quizRoot'),
  helpBtn: $('#helpBtn'),
  homeBtn: $('#homeBtn')
};

const state = {
  mode: qs.get('mode') || 'learn',
  score: 0,
  hintsUsed: 0,
  selectedTool: null,
  selectedItems: new Set(),
  phaseIndex: 0,
  startedAt: 0,
  phaseStartedAt: 0,
  scrubTimer: null,
  substep: 'rinse',
  quizAnswers: [],
  bossIndex: 0,
  audioEnabled: qs.get('audio') !== '0',
  hotspots: {},
  bossHotspot: null,
  isPhaseLocked: false,
  isNavigating: false,
  quizAnswered: false,
  memoryPassed: false,
  runFinalized: false,
  progress: null,
  sessionRewards: [],
  timer: {
    active: false,
    intervalId: null,
    currentKey: '',
    deadlineTs: 0,
    totalSec: 0
  },
  runConfig: {
    mission: null,
    badge: null,
    readyCorrectIds: [],
    readyWrongIds: [],
    scrubHotspotIds: [],
    bossTemplateId: null,
    bossSteps: [],
    timeLimitSec: null,
    maxWrong: null,
    memoryPrompt: null
  }
};

let idleHintTimer = null;

/* basic */

function parseHubUrl() {
  return qs.get('hub') || '../hub.html';
}

function buildReplayUrl() {
  return location.href;
}

function logEvent(type, data = {}) {
  console.log('[BathV2]', type, data);
}

function lockPhase(flag = true) {
  state.isPhaseLocked = flag;
  if (app.scene) app.scene.classList.toggle('is-locked', flag);
}

function cleanupRuntime() {
  clearActiveScrub();
  clearTimeout(idleHintTimer);
  clearMissionTimer(true);
  stopBathSpeech();
}

function safeNavigate(url) {
  if (state.isNavigating) return;
  state.isNavigating = true;
  cleanupRuntime();
  location.href = url;
}

function speakByType(text, type = 'coach') {
  if (!state.audioEnabled || !text) return;
  if (type === 'hint') return speakBathHint(text, state.audioEnabled);
  if (type === 'celebration') return speakBathCelebration(text, state.audioEnabled);
  return speakBathCoachLine(text, state.audioEnabled);
}

function coachSay(text, speak = false, type = 'coach') {
  if (app.coachBubble) app.coachBubble.textContent = text;
  if (speak) speakByType(text, type);
}

function setScore(delta) {
  state.score = Math.max(0, state.score + delta);
  if (app.scoreValue) app.scoreValue.textContent = String(state.score);
}

function calcStars() {
  if (state.score >= 110) return 3;
  if (state.score >= 70) return 2;
  return 1;
}

function setPhaseUI(title, task) {
  if (app.phaseBadge) app.phaseBadge.textContent = title;
  if (app.taskText) app.taskText.textContent = task;
}

function clearEffectDecor() {
  if (app.effectsLayer) app.effectsLayer.innerHTML = '';
}

function clearPlayLayers() {
  if (app.hotspotsLayer) app.hotspotsLayer.innerHTML = '';
  if (app.itemsLayer) app.itemsLayer.innerHTML = '';
  clearEffectDecor();
}

function clearPanels() {
  if (app.summaryRoot) app.summaryRoot.innerHTML = '';
  if (app.quizRoot) app.quizRoot.innerHTML = '';
}

function clearActiveScrub() {
  if (state.scrubTimer) {
    clearInterval(state.scrubTimer);
    state.scrubTimer = null;
  }
  if (app.hotspotsLayer) {
    app.hotspotsLayer.querySelectorAll('.hotspot.is-active').forEach(el => {
      el.classList.remove('is-active');
    });
  }
}

function showPhaseBurst(text = 'ผ่านด่านแล้ว') {
  if (!app.effectsLayer) return;
  const burst = document.createElement('div');
  burst.className = 'phase-burst';
  burst.textContent = `🎉 ${text}`;
  app.effectsLayer.appendChild(burst);
  setTimeout(() => burst.remove(), 900);
}

function spawnSparkleAtHotspot(hotspotId) {
  if (!app.hotspotsLayer || !app.roomStage || !app.effectsLayer) return;
  const node = app.hotspotsLayer.querySelector(`[data-hotspot="${hotspotId}"]`);
  if (!node) return;

  const stageRect = app.roomStage.getBoundingClientRect();
  const rect = node.getBoundingClientRect();

  const sp = document.createElement('div');
  sp.className = 'sparkle';
  sp.textContent = '✨';
  sp.style.left = `${rect.left - stageRect.left + rect.width / 2 - 10}px`;
  sp.style.top = `${rect.top - stageRect.top + rect.height / 2 - 10}px`;
  app.effectsLayer.appendChild(sp);
  setTimeout(() => sp.remove(), 700);
}

/* random */

function makeSeededRandom(seedStr) {
  let h = 1779033703 ^ String(seedStr || 'bath').length;
  for (let i = 0; i < String(seedStr || 'bath').length; i++) {
    h = Math.imul(h ^ String(seedStr || 'bath').charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shuffleWithRand(arr, rand) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sampleWithRand(arr, n, rand) {
  return shuffleWithRand(arr, rand).slice(0, Math.max(0, Math.min(n, arr.length)));
}

function pickOne(arr, rand) {
  if (!arr?.length) return null;
  return arr[Math.floor(rand() * arr.length)];
}

/* progress / rewards */

function createDefaultProgress() {
  return {
    version: 1,
    starsTotal: 0,
    missionsCompleted: 0,
    uniqueMissionIds: [],
    familyCounts: {
      ready: 0,
      scrub: 0,
      rinse: 0,
      dry: 0,
      memory: 0,
      boss: 0
    },
    timedMissionsCompleted: 0,
    dailyStreak: 0,
    lastPlayedDate: '',
    lastMissionId: '',
    lastFamily: '',
    unlockedRewardIds: [],
    history: []
  };
}

function normalizeProgress(raw) {
  const base = createDefaultProgress();
  const out = { ...base, ...(raw || {}) };
  out.uniqueMissionIds = Array.isArray(out.uniqueMissionIds) ? out.uniqueMissionIds : [];
  out.unlockedRewardIds = Array.isArray(out.unlockedRewardIds) ? out.unlockedRewardIds : [];
  out.history = Array.isArray(out.history) ? out.history : [];
  out.familyCounts = { ...base.familyCounts, ...(out.familyCounts || {}) };
  return out;
}

function loadBathProgress() {
  try {
    const raw = localStorage.getItem(BATH_PROGRESS_KEY);
    if (!raw) return createDefaultProgress();
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return createDefaultProgress();
  }
}

function saveBathProgress(progress) {
  try {
    localStorage.setItem(BATH_PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}

function getLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayNumberFromKey(key) {
  if (!key) return null;
  const dt = new Date(`${key}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return Math.floor(dt.getTime() / 86400000);
}

function updateDailyStreak(progress) {
  const today = getLocalDateKey();

  if (progress.lastPlayedDate === today) return;

  if (!progress.lastPlayedDate) {
    progress.dailyStreak = 1;
    progress.lastPlayedDate = today;
    return;
  }

  const prevDay = getDayNumberFromKey(progress.lastPlayedDate);
  const todayDay = getDayNumberFromKey(today);

  if (prevDay == null || todayDay == null) {
    progress.dailyStreak = 1;
    progress.lastPlayedDate = today;
    return;
  }

  const diff = todayDay - prevDay;
  if (diff === 1) progress.dailyStreak += 1;
  else if (diff > 1) progress.dailyStreak = 1;

  progress.lastPlayedDate = today;
}

function isRewardUnlocked(reward, progress) {
  const unlock = reward?.unlock || {};
  const kind = unlock.kind;

  if (kind === 'missions_completed') return progress.missionsCompleted >= (unlock.value || 0);
  if (kind === 'stars_total') return progress.starsTotal >= (unlock.value || 0);
  if (kind === 'family_completed') return (progress.familyCounts?.[unlock.family] || 0) >= (unlock.value || 0);
  if (kind === 'unique_missions_completed') return (progress.uniqueMissionIds?.length || 0) >= (unlock.value || 0);
  if (kind === 'timed_missions_completed') return progress.timedMissionsCompleted >= (unlock.value || 0);
  if (kind === 'daily_streak') return progress.dailyStreak >= (unlock.value || 0);

  return false;
}

function computeRewardUnlocks(progress) {
  const already = new Set(progress.unlockedRewardIds || []);
  const newly = [];

  BATH_REWARDS_20.forEach(reward => {
    if (!already.has(reward.id) && isRewardUnlocked(reward, progress)) {
      newly.push(reward);
    }
  });

  progress.unlockedRewardIds = Array.from(new Set([
    ...(progress.unlockedRewardIds || []),
    ...newly.map(r => r.id)
  ]));

  return newly;
}

function finalizeRunProgress() {
  if (state.runFinalized) return;
  state.runFinalized = true;

  const starsEarned = calcStars();
  const progress = normalizeProgress(state.progress || loadBathProgress());
  const mission = state.runConfig.mission;

  updateDailyStreak(progress);

  progress.starsTotal += starsEarned;
  progress.missionsCompleted += 1;

  if (mission?.id && !progress.uniqueMissionIds.includes(mission.id)) {
    progress.uniqueMissionIds.push(mission.id);
  }

  if (mission?.family) {
    progress.familyCounts[mission.family] = (progress.familyCounts[mission.family] || 0) + 1;
    progress.lastFamily = mission.family;
  }

  if (mission?.config?.timeLimitSec) {
    progress.timedMissionsCompleted += 1;
  }

  progress.lastMissionId = mission?.id || '';

  progress.history.unshift({
    at: new Date().toISOString(),
    missionId: mission?.id || '',
    missionTitle: mission?.title || '',
    family: mission?.family || '',
    score: state.score,
    stars: starsEarned,
    mode: state.mode
  });
  progress.history = progress.history.slice(0, 30);

  const newlyUnlocked = computeRewardUnlocks(progress);
  saveBathProgress(progress);

  state.progress = progress;
  state.sessionRewards = newlyUnlocked;
}

/* timer */

function formatSec(sec) {
  return `${Math.max(0, Math.ceil(sec))}`;
}

function setTimerUI(visible, sec = 0) {
  if (!app.timerBox || !app.timerValue) return;

  app.timerBox.classList.toggle('hidden', !visible);
  app.timerValue.textContent = formatSec(sec);

  app.timerBox.classList.remove('is-warn', 'is-danger');
  if (sec <= 5) app.timerBox.classList.add('is-danger');
  else if (sec <= 10) app.timerBox.classList.add('is-warn');
}

function clearMissionTimer(hide = true) {
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }
  state.timer.active = false;
  state.timer.currentKey = '';
  state.timer.deadlineTs = 0;
  state.timer.totalSec = 0;
  if (hide) setTimerUI(false, 0);
}

function getCurrentTimerPhaseKey() {
  const mission = state.runConfig.mission;
  if (!mission?.config?.timeLimitSec) return null;

  const focus = mission.phaseFocus;
  const currentPhase = BATH_PHASES[state.phaseIndex]?.id;

  if (focus === 'ready' && currentPhase === 'ready') return 'ready';
  if (focus === 'scrub' && currentPhase === 'scrub') return 'scrub';
  if (focus === 'rinse' && currentPhase === 'rinseDry' && state.substep === 'rinse') return 'rinse';
  if (focus === 'dry' && currentPhase === 'rinseDry' && state.substep === 'dry') return 'dry';
  if (focus === 'boss' && currentPhase === 'boss') return 'boss';

  return null;
}

function renderTimeoutActions() {
  if (!app.actionBar) return;
  app.actionBar.innerHTML = `
    <div class="next-wrap" style="margin-left:0;width:100%;justify-content:flex-end">
      <button id="retryPhaseBtn" class="next-btn" type="button">ลองด่านนี้อีก</button>
      <button id="restartRunBtn" class="soft-btn" type="button">เริ่มใหม่</button>
    </div>
  `;
  $('#retryPhaseBtn')?.addEventListener('click', retryCurrentPhase);
  $('#restartRunBtn')?.addEventListener('click', () => safeNavigate(buildReplayUrl()));
}

function resetCurrentPhaseState() {
  const phaseId = BATH_PHASES[state.phaseIndex]?.id;

  if (phaseId === 'ready') {
    state.selectedItems = new Set();
    return;
  }

  if (phaseId === 'scrub') {
    state.runConfig.scrubHotspotIds.forEach(id => {
      state.hotspots[id].scrubMs = 0;
      state.hotspots[id].scrubDone = false;
      state.hotspots[id].rinsed = false;
      state.hotspots[id].dry = false;
    });
    return;
  }

  if (phaseId === 'rinseDry') {
    if (state.substep === 'rinse') {
      state.runConfig.scrubHotspotIds.forEach(id => {
        state.hotspots[id].rinsed = false;
        state.hotspots[id].dry = false;
      });
    } else {
      state.runConfig.scrubHotspotIds.forEach(id => {
        state.hotspots[id].dry = false;
      });
    }
    return;
  }

  if (phaseId === 'boss') {
    state.bossIndex = 0;
    state.selectedTool = null;
    resetBossHotspot();
  }
}

function handleMissionTimeout() {
  clearMissionTimer(false);
  lockPhase(true);
  coachSay('หมดเวลาแล้ว ลองใหม่อีกครั้งนะ', true, 'hint');
  setPhaseUI(BATH_PHASES[state.phaseIndex]?.title || 'หมดเวลา', 'หมดเวลาแล้ว ลองใหม่อีกครั้ง');
  renderTimeoutActions();
  setTimerUI(true, 0);
}

function startMissionTimerForCurrentPhase() {
  const key = getCurrentTimerPhaseKey();
  const totalSec = state.runConfig.timeLimitSec;

  if (!key || !totalSec) {
    clearMissionTimer(true);
    return;
  }

  if (state.timer.active && state.timer.currentKey === key) return;

  clearMissionTimer(false);

  state.timer.active = true;
  state.timer.currentKey = key;
  state.timer.totalSec = totalSec;
  state.timer.deadlineTs = Date.now() + totalSec * 1000;

  setTimerUI(true, totalSec);

  state.timer.intervalId = setInterval(() => {
    const remainMs = state.timer.deadlineTs - Date.now();
    const remainSec = Math.max(0, Math.ceil(remainMs / 1000));
    setTimerUI(true, remainSec);

    if (remainMs <= 0) {
      handleMissionTimeout();
    }
  }, 200);
}

function retryCurrentPhase() {
  clearMissionTimer(true);
  lockPhase(false);
  resetCurrentPhaseState();
  renderPhase();
}

/* mission selection */

function getMissionPoolForMode(mode) {
  let pool = [...BATH_MISSIONS_50];

  if (mode === 'learn') {
    pool = pool.filter(m => m.difficulty !== 'hard' && m.family !== 'boss');
  }

  if (mode === 'research') {
    const researchIds = [
      'm01-ready-basic-4',
      'm16-scrub-4-points',
      'm24-rinse-foam-hunt',
      'm34-dry-before-clothes',
      'm50-boss-bath-hero'
    ];
    pool = BATH_MISSIONS_50.filter(m => researchIds.includes(m.id));
  }

  return pool.length ? pool : [...BATH_MISSIONS_50];
}

function chooseMissionForRun(rand) {
  const pool = getMissionPoolForMode(state.mode);
  const progress = normalizeProgress(state.progress || loadBathProgress());

  let preferred = progress.lastFamily
    ? pool.filter(m => m.family !== progress.lastFamily)
    : pool;

  if (!preferred.length) preferred = pool;

  const unplayed = preferred.filter(m => !progress.uniqueMissionIds.includes(m.id));
  const source = unplayed.length ? unplayed : preferred;

  return pickOne(source, rand) || source[0] || pool[0];
}

function getHotspotLabel(hotspotId) {
  return BATH_HOTSPOTS.find(h => h.id === hotspotId)?.label || 'จุดนี้';
}

function resolveBossStepText(step, hotspotId) {
  if (!step?.text) return '';
  const label = getHotspotLabel(hotspotId);
  return step.text
    .replace('TARGET_LABEL', label)
    .replace('จุดสำคัญ', label)
    .replace('จุดนี้', label);
}

function buildBathRunConfig() {
  const baseSeed = qs.get('seed') || String(Date.now());
  const mode = state.mode;

  const deterministicSeed = mode === 'research'
    ? `bath-research-${baseSeed}`
    : `bath-play-${baseSeed}-${Date.now()}`;

  const rand = makeSeededRandom(deterministicSeed);
  const mission = chooseMissionForRun(rand);

  const readyCorrectIds = mission?.config?.readyCorrectIds || BATH_READY_CORRECT_IDS;

  const explicitWrongIds = mission?.config?.readyWrongIds || null;
  const readyWrongCount = mission?.config?.readyWrongCount ??
    (explicitWrongIds ? explicitWrongIds.length : (mode === 'learn' ? 2 : 4));

  const readyWrongIds = explicitWrongIds
    ? explicitWrongIds.filter(id => !readyCorrectIds.includes(id))
    : sampleWithRand(
        BATH_READY_WRONG_POOL.filter(id => !readyCorrectIds.includes(id)),
        readyWrongCount,
        rand
      );

  let scrubHotspotIds = mission?.config?.scrubHotspotIds
    ? [...mission.config.scrubHotspotIds]
    : sampleWithRand(
        BATH_SCRUB_POOL,
        mission?.config?.scrubRandomCount || 4,
        rand
      );

  if (mission.family === 'memory' && !scrubHotspotIds.length) {
    scrubHotspotIds = ['neck', 'armpit', 'feet'];
  }

  const bossTemplateId = mission?.config?.bossTemplateId
    || (mode === 'research'
      ? (BATH_BOSS_TEMPLATES?.[0]?.id || 'classic')
      : (pickOne(BATH_BOSS_TEMPLATES, rand)?.id || 'classic'));

  const bossTemplate = BATH_BOSS_TEMPLATES.find(t => t.id === bossTemplateId)
    || BATH_BOSS_TEMPLATES[0];

  const bossTarget = scrubHotspotIds.includes('armpit')
    ? 'armpit'
    : (scrubHotspotIds[0] || 'neck');

  const bossSteps = (bossTemplate?.steps || []).map(step => {
    const hotspot = step.hotspot === 'TARGET' ? bossTarget : step.hotspot;
    return {
      ...step,
      hotspot,
      text: resolveBossStepText(step, hotspot)
    };
  });

  state.runConfig = {
    mission,
    badge: null,
    readyCorrectIds,
    readyWrongIds,
    scrubHotspotIds,
    bossTemplateId,
    bossSteps,
    timeLimitSec: mission?.config?.timeLimitSec || null,
    maxWrong: mission?.config?.maxWrong || null,
    memoryPrompt: mission?.config?.memoryPrompt || null
  };
}

function pickCoachVariant(key) {
  const list = BATH_COACH_VARIANTS?.[key];
  if (!list?.length) return null;
  const rand = makeSeededRandom(`${qs.get('seed') || 'bath'}-${state.phaseIndex}-${key}`);
  return pickOne(list, rand);
}

function getPreviewMission() {
  const rand = makeSeededRandom(qs.get('seed') || 'bath-preview');
  const pool = getMissionPoolForMode('play');
  return pickOne(pool, rand) || pool[0] || null;
}

/* memory gate */

function getMemoryQuestionForMission(mission) {
  const prompt = mission?.config?.memoryPrompt || 'core-chant';

  if (prompt === 'first-step') {
    return {
      title: 'ขั้นตอนแรกคืออะไร',
      subtitle: 'เลือกขั้นตอนแรกของการอาบน้ำ',
      choices: [
        { id: 'ready', text: 'เลือกของอาบน้ำ', correct: true },
        { id: 'scrub', text: 'ถูสบู่' },
        { id: 'rinse', text: 'ล้างฟอง' },
        { id: 'dry', text: 'เช็ดตัว' }
      ]
    };
  }

  if (prompt === 'after-soap') {
    return {
      title: 'หลังถูสบู่แล้วทำอะไรต่อ',
      subtitle: 'เลือกขั้นตอนถัดไปให้ถูก',
      choices: [
        { id: 'rinse', text: 'ล้างฟองออก', correct: true },
        { id: 'dry', text: 'เช็ดตัวให้แห้ง' },
        { id: 'ready', text: 'เลือกของใหม่อีกครั้ง' }
      ]
    };
  }

  if (prompt === 'last-step') {
    return {
      title: 'ขั้นตอนสุดท้ายคืออะไร',
      subtitle: 'เลือกขั้นตอนสุดท้ายของการอาบน้ำ',
      choices: [
        { id: 'dry', text: 'เช็ดตัวให้แห้ง', correct: true },
        { id: 'scrub', text: 'ถูสบู่' },
        { id: 'rinse', text: 'ล้างฟอง' }
      ]
    };
  }

  if (prompt === 'order-4' || prompt === 'core-chant') {
    return {
      title: 'ลำดับที่ถูกคืออะไร',
      subtitle: 'จำคำหลักให้ได้: เลือก–ถู–ล้าง–เช็ด',
      choices: [
        { id: 'a', text: 'เลือก → ถู → ล้าง → เช็ด', correct: true },
        { id: 'b', text: 'ถู → เลือก → เช็ด → ล้าง' },
        { id: 'c', text: 'เลือก → ล้าง → ถู → เช็ด' }
      ]
    };
  }

  if (prompt === 'fill-missing') {
    return {
      title: 'ขั้นตอนไหนหายไป',
      subtitle: 'เลือก → ถู → ? → เช็ด',
      choices: [
        { id: 'rinse', text: 'ล้างฟอง', correct: true },
        { id: 'ready', text: 'เลือกของ' },
        { id: 'dry', text: 'เช็ดตัว' }
      ]
    };
  }

  if (prompt === 'find-wrong-step') {
    return {
      title: 'ขั้นตอนไหนผิด',
      subtitle: 'เลือกของ → ล้างฟอง → ถูสบู่ → เช็ดตัว',
      choices: [
        { id: 'wrong', text: 'ล้างฟองอยู่ผิดที่', correct: true },
        { id: 'ok1', text: 'เลือกของถูกแล้ว' },
        { id: 'ok2', text: 'เช็ดตัวเป็นขั้นตอนท้าย' }
      ]
    };
  }

  return {
    title: 'จำลำดับอาบน้ำ',
    subtitle: 'เลือก–ถู–ล้าง–เช็ด',
    choices: [
      { id: 'a', text: 'เลือก → ถู → ล้าง → เช็ด', correct: true },
      { id: 'b', text: 'ล้าง → เลือก → ถู → เช็ด' },
      { id: 'c', text: 'เลือก → เช็ด → ถู → ล้าง' }
    ]
  };
}

function renderMemoryGate() {
  const mission = state.runConfig.mission;
  const q = getMemoryQuestionForMission(mission);

  if (app.scene) app.scene.classList.add('hidden');
  if (app.actionBar) app.actionBar.classList.add('hidden');
  clearPanels();

  if (!app.briefCard) return;
  app.briefCard.innerHTML = `
    <div class="memory-card">
      <h2 class="memory-title">${mission?.title || 'Memory Bath'}</h2>
      <p class="memory-sub">${q.title}</p>
      <p class="memory-sub" style="margin-top:8px;">${q.subtitle}</p>
      <div class="memory-options">
        ${q.choices.map(c => `
          <button class="memory-option" type="button" data-choice="${c.id}">
            ${c.text}
          </button>
        `).join('')}
      </div>
    </div>
  `;

  coachSay('ลองจำขั้นตอนอาบน้ำก่อนเริ่มเล่นนะ', true, 'hint');

  app.briefCard.querySelectorAll('.memory-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const choice = q.choices.find(c => c.id === btn.dataset.choice);
      const correct = !!choice?.correct;

      app.briefCard.querySelectorAll('.memory-option').forEach(x => { x.disabled = true; });
      btn.classList.add(correct ? 'is-correct' : 'is-wrong');

      if (!correct) {
        coachSay('ยังไม่ใช่ ลองใหม่รอบหน้านะ', true, 'hint');
        setTimeout(() => {
          state.memoryPassed = false;
          showBrief();
        }, 700);
        return;
      }

      coachSay('ถูกต้อง เริ่มอาบน้ำกันเลย', true, 'celebration');
      state.memoryPassed = true;
      setScore(5);

      setTimeout(() => {
        if (app.briefCard) app.briefCard.innerHTML = '';
        if (app.scene) app.scene.classList.remove('hidden');
        if (app.actionBar) app.actionBar.classList.remove('hidden');
        renderPhase();
      }, 500);
    });
  });
}

/* run init */

function initHotspotsState() {
  state.hotspots = {};
  BATH_HOTSPOTS.forEach(h => {
    state.hotspots[h.id] = {
      scrubMs: 0,
      scrubDone: false,
      rinsed: false,
      dry: false
    };
  });
}

function resetBossHotspot() {
  const target = state.runConfig?.bossSteps?.find(s => s.hotspot)?.hotspot || 'armpit';
  state.bossHotspot = {
    id: target,
    scrubMs: 0,
    scrubDone: false,
    rinsed: false,
    dry: false
  };
}

function updateProgressBox() {
  const progressEl = document.getElementById('progressValue');
  if (!progressEl) return;

  const phaseId = BATH_PHASES[state.phaseIndex]?.id;
  let done = 0;
  let total = 0;

  if (phaseId === 'ready') {
    total = state.runConfig.readyCorrectIds.length;
    done = state.selectedItems.size;
  } else if (phaseId === 'scrub') {
    total = state.runConfig.scrubHotspotIds.length;
    done = state.runConfig.scrubHotspotIds.filter(id => state.hotspots[id]?.scrubDone).length;
  } else if (phaseId === 'rinseDry') {
    total = state.runConfig.scrubHotspotIds.length;
    done = state.substep === 'rinse'
      ? state.runConfig.scrubHotspotIds.filter(id => state.hotspots[id]?.rinsed).length
      : state.runConfig.scrubHotspotIds.filter(id => state.hotspots[id]?.dry).length;
  } else if (phaseId === 'boss') {
    total = state.runConfig.bossSteps.length;
    done = state.bossIndex;
  }

  progressEl.textContent = `${done}/${total}`;
}

function resetIdleHint() {
  clearTimeout(idleHintTimer);
  if (state.isPhaseLocked || state.isNavigating) return;

  idleHintTimer = setTimeout(() => {
    const phaseId = BATH_PHASES[state.phaseIndex]?.id;
    state.hintsUsed += 1;

    if (phaseId === 'ready') {
      coachSay('ลองแตะของที่ใช้ตอนอาบน้ำดูนะ', true, 'hint');
    }
    if (phaseId === 'scrub') {
      coachSay('เลือกสบู่ แล้วถูจุดสีเหลืองนะ', true, 'hint');
    }
    if (phaseId === 'rinseDry') {
      coachSay(
        state.substep === 'rinse'
          ? 'เลือกฝักบัว แล้วล้างฟองออกนะ'
          : 'เลือกผ้าเช็ดตัว แล้วเช็ดให้แห้งนะ',
        true,
        'hint'
      );
    }
    if (phaseId === 'boss') {
      coachSay('ทำทีละขั้นนะ หนูทำได้', true, 'hint');
    }
  }, 5000);
}

function startGame() {
  state.startedAt = Date.now();
  state.phaseIndex = 0;
  state.score = 0;
  state.hintsUsed = 0;
  state.selectedTool = null;
  state.selectedItems = new Set();
  state.quizAnswers = [];
  state.bossIndex = 0;
  state.isNavigating = false;
  state.isPhaseLocked = false;
  state.quizAnswered = false;
  state.memoryPassed = false;
  state.runFinalized = false;
  state.sessionRewards = [];
  if (app.scoreValue) app.scoreValue.textContent = '0';

  initHotspotsState();
  buildBathRunConfig();
  resetBossHotspot();

  if (app.briefCard) app.briefCard.innerHTML = '';
  clearPanels();
  clearMissionTimer(true);

  if (state.runConfig.mission?.family === 'memory') {
    renderMemoryGate();
    return;
  }

  if (app.scene) app.scene.classList.remove('hidden');
  if (app.actionBar) app.actionBar.classList.remove('hidden');

  renderPhase();
}

function showBrief() {
  if (app.scene) app.scene.classList.add('hidden');
  if (app.actionBar) app.actionBar.classList.add('hidden');
  setPhaseUI('Bath v2', 'พร้อมเริ่ม');
  updateProgressBox();

  const previewMission = getPreviewMission();
  const progress = state.progress || createDefaultProgress();

  if (!app.briefCard) return;
  app.briefCard.innerHTML = `
    <h1 class="brief-title">${BATH_COPY.title}</h1>
    <p class="brief-sub">${BATH_COPY.sub}</p>
    <p class="brief-sub" style="margin-top:10px;">
      <strong>${previewMission?.title || 'ภารกิจอาบน้ำสะอาด'}</strong>
      ${previewMission?.subtitle ? `— ${previewMission.subtitle}` : ''}
    </p>

    <div class="brief-stats">
      <div class="brief-pill">⭐ ดาวสะสม ${progress.starsTotal}</div>
      <div class="brief-pill">🎯 ไม่ซ้ำ ${progress.uniqueMissionIds.length}</div>
      <div class="brief-pill">🔥 ต่อเนื่อง ${progress.dailyStreak} วัน</div>
      <div class="brief-pill">🏅 รางวัล ${progress.unlockedRewardIds.length}</div>
    </div>

    <div class="brief-actions">
      <button id="startBtn" class="big-btn primary" type="button">เริ่มอาบน้ำ</button>
      <button id="briefHelpBtn" class="big-btn soft" type="button">ฟังวิธีเล่น</button>
    </div>
  `;

  $('#startBtn')?.addEventListener('click', () => {
    unlockBathAudio();
    startGame();
    speakBathHint(BATH_AUDIO.readyHelp, state.audioEnabled);
  });

  $('#briefHelpBtn')?.addEventListener('click', () => {
    unlockBathAudio();
    const text = 'เลือกของให้ถูก ถูให้ครบ ล้างฟอง แล้วเช็ดตัวให้แห้ง';
    coachSay(text, true, 'hint');
  });
}

function renderPhase() {
  cleanupRuntime();
  clearPlayLayers();
  clearPanels();
  lockPhase(false);

  const phase = BATH_PHASES[state.phaseIndex];
  state.phaseStartedAt = Date.now();

  setPhaseUI(phase.title, phase.task);

  if (phase.id === 'ready') renderReadyPhase();
  if (phase.id === 'scrub') renderScrubPhase();
  if (phase.id === 'rinseDry') renderRinseDryPhase();
  if (phase.id === 'boss') renderBossPhase();

  updateProgressBox();
  startMissionTimerForCurrentPhase();
  resetIdleHint();
}

function completePhase(nextLabel = 'ไปด่านต่อไป') {
  if (state.isPhaseLocked) return;

  clearMissionTimer(true);
  lockPhase(true);
  showPhaseBurst(BATH_COACH_LINES.phaseClear);
  coachSay(BATH_COACH_LINES.phaseClear, true, 'celebration');

  const currentPhase = BATH_PHASES[state.phaseIndex]?.id;
  const tools =
    currentPhase === 'scrub' ? ['soap']
    : currentPhase === 'rinseDry' ? ['shower', 'towel']
    : [];

  renderToolBar(tools, {
    showNext: true,
    nextLabel,
    nextHandler: nextPhase
  });
}

function nextPhase() {
  if (!state.isPhaseLocked) return;
  state.phaseIndex += 1;

  if (state.phaseIndex >= BATH_PHASES.length) {
    showSummary();
    return;
  }

  renderPhase();
}

/* toolbar */

function renderToolBar(tools = [], opts = {}) {
  const {
    showNext = false,
    nextLabel = 'ไปต่อ',
    nextHandler = nextPhase
  } = opts;

  if (!app.actionBar) return;
  app.actionBar.innerHTML = '';

  tools.forEach(toolId => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool-btn' + (state.selectedTool === toolId ? ' is-selected' : '');
    btn.dataset.tool = toolId;
    btn.textContent = BATH_COPY.tools[toolId] || toolId;
    btn.addEventListener('click', () => selectTool(toolId, tools, opts));
    app.actionBar.appendChild(btn);
  });

  const nextWrap = document.createElement('div');
  nextWrap.className = 'next-wrap';

  const replayBtn = document.createElement('button');
  replayBtn.type = 'button';
  replayBtn.className = 'soft-btn';
  replayBtn.textContent = 'เริ่มใหม่';
  replayBtn.addEventListener('click', () => safeNavigate(buildReplayUrl()));
  nextWrap.appendChild(replayBtn);

  if (showNext) {
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'next-btn';
    nextBtn.textContent = nextLabel;
    nextBtn.addEventListener('click', nextHandler);
    nextWrap.appendChild(nextBtn);
  }

  app.actionBar.appendChild(nextWrap);
}

function selectTool(toolId, tools, opts) {
  if (state.isNavigating) return;
  if (state.isPhaseLocked && BATH_PHASES[state.phaseIndex]?.id !== 'boss') return;

  state.selectedTool = toolId;
  logEvent('tool_select', {
    toolId,
    phase: BATH_PHASES[state.phaseIndex].id
  });

  renderToolBar(tools, opts);
  resetIdleHint();

  if (BATH_PHASES[state.phaseIndex].id === 'boss') {
    maybeResolveBossSelectTool(toolId);
  }
}

/* ready phase */

function renderReadyChecklist() {
  if (!app.itemsLayer) return;
  const old = app.itemsLayer.querySelector('.ready-checklist');
  if (old) old.remove();

  const correctItems = BATH_ITEMS.filter(i => state.runConfig.readyCorrectIds.includes(i.id));

  const checklist = document.createElement('div');
  checklist.className = 'ready-checklist';
  checklist.innerHTML = `
    <h3>ของที่ต้องใช้</h3>
    <ul>
      ${correctItems.map(i => `
        <li class="${state.selectedItems.has(i.id) ? 'done' : ''}" data-check="${i.id}">
          ${i.emoji} ${i.label}
        </li>
      `).join('')}
    </ul>
  `;
  app.itemsLayer.appendChild(checklist);
}

function renderReadyPhase() {
  const intro = state.runConfig.mission?.title ? `${state.runConfig.mission.title} • ` : '';
  coachSay(
    `${intro}${pickCoachVariant('readyStart') || BATH_COACH_LINES.readyStart}`,
    true,
    'coach'
  );

  if (!app.itemsLayer) return;

  const wrap = document.createElement('div');
  wrap.className = 'items-grid';

  const readyItems = BATH_ITEMS.filter(item =>
    state.runConfig.readyCorrectIds.includes(item.id) ||
    state.runConfig.readyWrongIds.includes(item.id)
  );

  readyItems.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'item-btn';
    btn.innerHTML = `<span>${item.emoji}</span>${item.label}`;
    btn.addEventListener('click', () => handleReadyItem(item, btn));
    wrap.appendChild(btn);
  });

  app.itemsLayer.appendChild(wrap);
  renderReadyChecklist();
  renderToolBar([]);
}

function handleReadyItem(item, el) {
  if (state.isPhaseLocked) return;

  const isCorrect = state.runConfig.readyCorrectIds.includes(item.id);

  logEvent('item_tap', { itemId: item.id, correct: isCorrect });
  resetIdleHint();

  if (isCorrect) {
    if (!state.selectedItems.has(item.id)) {
      state.selectedItems.add(item.id);
      setScore(10);
      el.classList.add('is-correct');
      el.disabled = true;
      coachSay(BATH_COACH_LINES.readyCorrect, true, 'coach');
      renderReadyChecklist();
      updateProgressBox();
    } else {
      coachSay(`${item.label} เลือกแล้วจ้า`);
    }
  } else {
    setScore(-1);
    el.classList.add('is-wrong');
    coachSay(BATH_COACH_LINES.readyWrong, true, 'coach');
  }

  if (state.selectedItems.size >= state.runConfig.readyCorrectIds.length) {
    logEvent('phase_clear', { phase: 'ready', ms: Date.now() - state.phaseStartedAt });
    completePhase();
  }
}

/* hotspot helpers */

function getFirstPendingHotspotId() {
  const phaseId = BATH_PHASES[state.phaseIndex]?.id;

  if (phaseId === 'scrub') {
    return state.runConfig.scrubHotspotIds.find(id => !state.hotspots[id]?.scrubDone) || null;
  }

  if (phaseId === 'rinseDry') {
    if (state.substep === 'rinse') {
      return state.runConfig.scrubHotspotIds.find(id =>
        state.hotspots[id]?.scrubDone && !state.hotspots[id]?.rinsed
      ) || null;
    }
    return state.runConfig.scrubHotspotIds.find(id =>
      state.hotspots[id]?.rinsed && !state.hotspots[id]?.dry
    ) || null;
  }

  return null;
}

function getBossTargetHotspotId() {
  const step = state.runConfig.bossSteps[state.bossIndex];
  return step?.hotspot || state.bossHotspot?.id || 'armpit';
}

function renderAvatarHotspots(mode = 'normal') {
  if (!app.hotspotsLayer) return;
  app.hotspotsLayer.innerHTML = '';

  const allowedIds = mode === 'boss'
    ? [getBossTargetHotspotId()]
    : (state.runConfig.scrubHotspotIds?.length ? state.runConfig.scrubHotspotIds : BATH_SCRUB_POOL);

  const targetId = state.mode === 'learn' && mode !== 'boss' ? getFirstPendingHotspotId() : null;

  BATH_HOTSPOTS.forEach(h => {
    if (!allowedIds.includes(h.id)) return;

    const st = mode === 'boss' ? state.bossHotspot : state.hotspots[h.id];

    const div = document.createElement('div');
    div.className = 'hotspot';
    div.dataset.hotspot = h.id;
    div.style.left = `calc(50% - 90px + ${h.x}px)`;
    div.style.top = `${h.y}px`;
    div.style.width = `${h.w}px`;
    div.style.height = `${h.h}px`;

    if (st.scrubDone) div.classList.add('is-done');
    if (st.rinsed && mode !== 'boss') div.classList.add('is-rinsed');
    if (st.dry && mode !== 'boss') div.classList.add('is-dry');
    if (targetId && h.id === targetId) div.classList.add('is-target');

    const label = document.createElement('div');
    label.className = 'hotspot-label';
    label.textContent = h.label;

    const prog = document.createElement('div');
    prog.className = 'hotspot-progress';
    const bar = document.createElement('i');
    const ratio = Math.min(1, st.scrubMs / (mode === 'boss' ? 1000 : h.needMs));
    bar.style.width = `${Math.round(ratio * 100)}%`;
    prog.appendChild(bar);

    div.appendChild(label);
    div.appendChild(prog);

    if (mode !== 'boss') {
      const chip = document.createElement('div');
      chip.className = 'state-chip';
      if (st.dry) chip.textContent = '✨';
      else if (st.rinsed) chip.textContent = '💧';
      else if (st.scrubDone) chip.textContent = '🫧';
      else chip.textContent = '🧼';
      div.appendChild(chip);
    }

    div.addEventListener('pointerdown', () => onHotspotDown(h.id, div));
    div.addEventListener('pointerup', clearActiveScrub);
    div.addEventListener('pointerleave', clearActiveScrub);
    div.addEventListener('pointercancel', clearActiveScrub);

    app.hotspotsLayer.appendChild(div);
  });
}

function updateHotspotProgress(hotspotId, ratio) {
  if (!app.hotspotsLayer) return;
  const bar = app.hotspotsLayer.querySelector(`[data-hotspot="${hotspotId}"] .hotspot-progress > i`);
  if (bar) bar.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
}

function updateHotspotDone(hotspotId) {
  if (!app.hotspotsLayer) return;
  const node = app.hotspotsLayer.querySelector(`[data-hotspot="${hotspotId}"]`);
  if (node) node.classList.add('is-done');
}

function renderFoamDecor() {
  if (!app.effectsLayer) return;
  app.effectsLayer.querySelectorAll('.foam-dot').forEach(n => n.remove());

  const phaseId = BATH_PHASES[state.phaseIndex]?.id;
  if (!phaseId) return;

  if (phaseId === 'boss') {
    const currentTarget = getBossTargetHotspotId();
    if (state.bossHotspot.scrubDone && !state.bossHotspot.rinsed) {
      const h = BATH_HOTSPOTS.find(x => x.id === currentTarget);
      if (!h) return;
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'foam-dot';
        dot.style.left = `calc(50% - 90px + ${h.x + 4 + (i * 10)}px)`;
        dot.style.top = `${h.y + 8 + (i % 2) * 8}px`;
        app.effectsLayer.appendChild(dot);
      }
    }
    return;
  }

  state.runConfig.scrubHotspotIds.forEach(id => {
    const h = BATH_HOTSPOTS.find(x => x.id === id);
    const st = state.hotspots[id];
    if (!h || !st || !st.scrubDone || st.rinsed) return;

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'foam-dot';
      dot.style.left = `calc(50% - 90px + ${h.x + 4 + (i * 10)}px)`;
      dot.style.top = `${h.y + 8 + (i % 2) * 8}px`;
      app.effectsLayer.appendChild(dot);
    }
  });
}

/* scrub phase */

function renderScrubPhase() {
  state.selectedTool = 'soap';
  coachSay(
    pickCoachVariant('scrubStart') || BATH_COACH_LINES.scrubStart,
    true,
    'coach'
  );
  renderAvatarHotspots();
  renderFoamDecor();
  renderToolBar(['soap']);
  updateProgressBox();
}

function onHotspotDown(hotspotId, el) {
  if (state.isPhaseLocked || state.isNavigating) return;

  const phaseId = BATH_PHASES[state.phaseIndex].id;
  resetIdleHint();

  if (phaseId === 'scrub') {
    if (!state.runConfig.scrubHotspotIds.includes(hotspotId)) return;
    if (state.selectedTool !== 'soap') {
      coachSay('เลือกสบู่ก่อนนะ', true, 'hint');
      return;
    }
    startScrub(hotspotId, el);
    return;
  }

  if (phaseId === 'rinseDry') {
    if (!state.runConfig.scrubHotspotIds.includes(hotspotId)) return;
    handleRinseDryClick(hotspotId);
    return;
  }

  if (phaseId === 'boss') {
    handleBossHotspot(hotspotId, el);
  }
}

function startScrub(hotspotId, el) {
  const h = BATH_HOTSPOTS.find(x => x.id === hotspotId);
  const st = state.hotspots[hotspotId];
  if (!h || !st || st.scrubDone) return;

  clearActiveScrub();
  el.classList.add('is-active');
  coachSay(`ถู${h.label}ต่ออีกนิดนะ`);

  state.scrubTimer = setInterval(() => {
    st.scrubMs += 140;
    updateHotspotProgress(hotspotId, st.scrubMs / h.needMs);

    if (st.scrubMs >= h.needMs * 0.72 && st.scrubMs < h.needMs * 0.9) {
      coachSay(BATH_COACH_LINES.scrubAlmost);
    }

    if (st.scrubMs >= h.needMs) {
      st.scrubDone = true;
      setScore(10);
      clearActiveScrub();
      coachSay(BATH_COACH_LINES.scrubDone, true, 'celebration');
      logEvent('hotspot_scrub_done', { hotspotId });

      updateHotspotDone(hotspotId);
      spawnSparkleAtHotspot(hotspotId);
      renderAvatarHotspots();
      renderFoamDecor();
      updateProgressBox();

      const allDone = state.runConfig.scrubHotspotIds.every(id => state.hotspots[id]?.scrubDone);
      if (allDone) {
        logEvent('phase_clear', { phase: 'scrub', ms: Date.now() - state.phaseStartedAt });
        completePhase();
      }
    }
  }, 100);
}

/* rinse / dry */

function renderRinseDryPhase() {
  state.substep = 'rinse';
  state.selectedTool = 'shower';
  renderAvatarHotspots();
  renderFoamDecor();
  renderToolBar(['shower', 'towel']);
  updateRinseDryText();
  coachSay(
    pickCoachVariant('rinseStart') || BATH_COACH_LINES.rinseStart,
    true,
    'coach'
  );
  updateProgressBox();
}

function updateRinseDryText() {
  if (!app.taskText) return;
  app.taskText.textContent = state.substep === 'rinse'
    ? 'เลือกฝักบัว แล้วแตะจุดที่มีฟอง'
    : 'เลือกผ้าเช็ดตัว แล้วแตะจุดที่ล้างแล้ว';
}

function handleRinseDryClick(hotspotId) {
  const st = state.hotspots[hotspotId];
  if (!st?.scrubDone) {
    coachSay('จุดนี้ยังไม่ได้ถูสบู่เลย', true, 'hint');
    return;
  }

  if (state.substep === 'rinse') {
    if (state.selectedTool !== 'shower') {
      coachSay('เลือกฝักบัวก่อนนะ', true, 'hint');
      return;
    }

    if (!st.rinsed) {
      st.rinsed = true;
      setScore(8);
      coachSay(BATH_COACH_LINES.rinseDone, true, 'celebration');
      logEvent('rinse_done', { hotspotId });
      spawnSparkleAtHotspot(hotspotId);
      renderAvatarHotspots();
      renderFoamDecor();
      updateProgressBox();
    }

    const allRinsed = state.runConfig.scrubHotspotIds.every(id => state.hotspots[id]?.rinsed);
    if (allRinsed) {
      clearMissionTimer(true);
      state.substep = 'dry';
      state.selectedTool = 'towel';
      coachSay(
        pickCoachVariant('dryStart') || 'เยี่ยมเลย ต่อไปเช็ดตัวให้แห้ง',
        true,
        'celebration'
      );
      renderAvatarHotspots();
      renderToolBar(['shower', 'towel']);
      updateRinseDryText();
      updateProgressBox();
      startMissionTimerForCurrentPhase();
    }
    return;
  }

  if (state.substep === 'dry') {
    if (state.selectedTool !== 'towel') {
      coachSay('เลือกผ้าเช็ดตัวก่อนนะ', true, 'hint');
      return;
    }
    if (!st.rinsed) {
      coachSay('ต้องล้างฟองก่อนนะ', true, 'hint');
      return;
    }

    if (!st.dry) {
      st.dry = true;
      setScore(8);
      coachSay(BATH_COACH_LINES.dryDone, true, 'celebration');
      logEvent('dry_done', { hotspotId });
      spawnSparkleAtHotspot(hotspotId);
      renderAvatarHotspots();
      updateProgressBox();
    }

    const allDry = state.runConfig.scrubHotspotIds.every(id => state.hotspots[id]?.dry);
    if (allDry) {
      clearMissionTimer(true);
      logEvent('phase_clear', { phase: 'rinseDry', ms: Date.now() - state.phaseStartedAt });
      completePhase();
    }
  }
}

/* boss */

function renderBossPhase() {
  resetBossHotspot();
  state.bossIndex = 0;
  state.selectedTool = null;
  coachSay(BATH_COACH_LINES.bossStart, true, 'coach');
  renderBossStep();
}

function renderBossStep() {
  cleanupRuntime();
  clearPlayLayers();

  const step = state.runConfig.bossSteps[state.bossIndex];
  if (!step) {
    logEvent('phase_clear', { phase: 'boss', ms: Date.now() - state.phaseStartedAt });
    showSummary();
    return;
  }

  const stepNo = state.bossIndex + 1;
  const totalNo = state.runConfig.bossSteps.length;
  if (app.taskText) {
    app.taskText.textContent = `(${stepNo}/${totalNo}) ${step.text}`;
  }

  state.bossHotspot.id = step.hotspot || state.bossHotspot.id;

  if (step.type === 'selectTool') {
    coachSay(
      state.mode === 'learn'
        ? `ขั้นที่ ${stepNo} เลือกอุปกรณ์ให้ถูกนะ`
        : step.text,
      true,
      state.mode === 'learn' ? 'hint' : 'coach'
    );
    renderToolBar(['soap', 'shower', 'towel']);
  } else {
    coachSay(
      state.mode === 'learn'
        ? `ขั้นที่ ${stepNo} แตะตรง${getHotspotLabel(step.hotspot)}นะ`
        : step.text,
      true,
      state.mode === 'learn' ? 'hint' : 'coach'
    );
    renderAvatarHotspots('boss');
    renderFoamDecor();
    renderToolBar(['soap', 'shower', 'towel']);
  }

  updateProgressBox();
  lockPhase(false);
  resetIdleHint();
}

function maybeResolveBossSelectTool(toolId) {
  const step = state.runConfig.bossSteps[state.bossIndex];
  if (!step || step.type !== 'selectTool') return;
  if (state.isPhaseLocked) return;

  if (toolId === step.tool) {
    lockPhase(true);
    setScore(6);
    coachSay('ถูกต้อง ไปต่อเลย', true, 'celebration');
    logEvent('boss_step_ok', { type: 'selectTool', tool: step.tool });
    state.bossIndex += 1;
    updateProgressBox();
    setTimeout(() => {
      renderBossStep();
    }, 220);
  } else {
    setScore(-1);
    coachSay('ลองดูอีกทีนะ', true, 'hint');
  }
}

function handleBossHotspot(hotspotId, el) {
  const step = state.runConfig.bossSteps[state.bossIndex];
  if (!step || state.isPhaseLocked) return;
  if (hotspotId !== step.hotspot) return;

  if (step.type === 'scrub') {
    if (state.selectedTool !== 'soap') {
      coachSay('เลือกสบู่ก่อนนะ', true, 'hint');
      return;
    }

    clearActiveScrub();
    el.classList.add('is-active');

    state.scrubTimer = setInterval(() => {
      state.bossHotspot.scrubMs += 180;
      updateHotspotProgress(hotspotId, state.bossHotspot.scrubMs / 1000);

      if (state.bossHotspot.scrubMs >= 1000) {
        clearActiveScrub();
        lockPhase(true);
        state.bossHotspot.scrubDone = true;
        setScore(10);
        coachSay('สะอาดแล้ว ไปต่อ', true, 'celebration');
        logEvent('boss_step_ok', { type: 'scrub', hotspotId });
        spawnSparkleAtHotspot(hotspotId);
        state.bossIndex += 1;
        updateProgressBox();
        setTimeout(() => {
          renderBossStep();
        }, 220);
      }
    }, 100);
    return;
  }

  if (step.type === 'rinse') {
    if (state.selectedTool !== 'shower') {
      coachSay('เลือกฝักบัวก่อนนะ', true, 'hint');
      return;
    }
    lockPhase(true);
    state.bossHotspot.rinsed = true;
    setScore(8);
    coachSay('ล้างฟองแล้ว', true, 'celebration');
    logEvent('boss_step_ok', { type: 'rinse', hotspotId });
    spawnSparkleAtHotspot(hotspotId);
    state.bossIndex += 1;
    updateProgressBox();
    setTimeout(() => {
      renderBossStep();
    }, 220);
    return;
  }

  if (step.type === 'dry') {
    if (state.selectedTool !== 'towel') {
      coachSay('เลือกผ้าเช็ดตัวก่อนนะ', true, 'hint');
      return;
    }
    lockPhase(true);
    state.bossHotspot.dry = true;
    setScore(8);
    coachSay('แห้งแล้ว เก่งมาก', true, 'celebration');
    logEvent('boss_step_ok', { type: 'dry', hotspotId });
    spawnSparkleAtHotspot(hotspotId);
    state.bossIndex += 1;
    updateProgressBox();
    setTimeout(() => {
      renderBossStep();
    }, 220);
  }
}

/* summary / quiz */

function showSummary() {
  cleanupRuntime();
  finalizeRunProgress();

  if (app.scene) app.scene.classList.add('hidden');
  if (app.actionBar) app.actionBar.classList.add('hidden');

  const stars = calcStars();
  const durationSec = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  const missionTitle = state.runConfig.mission?.title || 'ภารกิจอาบน้ำสะอาด';

  const progress = state.progress || createDefaultProgress();
  const rewardLine = state.sessionRewards.length
    ? `รางวัลใหม่: ${state.sessionRewards.map(r => r.label).join(' • ')}`
    : `ดาวสะสม ${progress.starsTotal} • mission ไม่ซ้ำ ${progress.uniqueMissionIds.length} • เล่นต่อเนื่อง ${progress.dailyStreak} วัน`;

  logEvent('game_complete', {
    scoreFinal: state.score,
    stars,
    durationSec,
    mode: state.mode,
    missionId: state.runConfig.mission?.id || '',
    rewardIds: state.sessionRewards.map(r => r.id)
  });

  if (!app.summaryRoot) return;
  app.summaryRoot.innerHTML = `
    <div class="summary-card">
      <h2 class="summary-title">อาบน้ำเสร็จแล้ว เยี่ยมเลย</h2>
      <div class="summary-stars">${'⭐'.repeat(stars)}</div>
      <div class="result-pill">${missionTitle}</div>
      <p class="summary-text">
        หนูทำได้ดีมาก สิ่งที่ควรจำคือ เลือกของให้ถูก ถูจุดสำคัญ ล้างฟองออก และเช็ดตัวให้แห้ง
      </p>
      <p class="summary-text">${rewardLine}</p>

      <div class="summary-actions">
        <button id="toQuizBtn" class="big-btn primary" type="button">ทำคำถามสั้น ๆ</button>
        <button id="replayBtn" class="big-btn soft" type="button">เล่นอีกครั้ง</button>
        <button id="hubBtn" class="big-btn soft" type="button">กลับ HUB</button>
      </div>
    </div>
  `;

  $('#toQuizBtn')?.addEventListener('click', showQuiz);
  $('#replayBtn')?.addEventListener('click', () => safeNavigate(buildReplayUrl()));
  $('#hubBtn')?.addEventListener('click', () => safeNavigate(parseHubUrl()));
}

function showQuiz() {
  if (app.summaryRoot) app.summaryRoot.innerHTML = '';
  let idx = 0;
  state.quizAnswers = [];

  function renderQuestion() {
    state.quizAnswered = false;
    const q = BATH_QUIZ[idx];
    if (!q) {
      showQuizDone();
      return;
    }

    if (!app.quizRoot) return;
    app.quizRoot.innerHTML = `
      <div class="quiz-card">
        <h2 class="quiz-title">คำถามสั้น ๆ</h2>
        <div class="result-pill">ข้อ ${idx + 1} / ${BATH_QUIZ.length}</div>
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
        if (state.quizAnswered) return;
        state.quizAnswered = true;

        const choice = q.choices.find(c => c.id === btn.dataset.choice);
        const correct = !!choice?.correct;
        state.quizAnswers.push({ questionId: q.id, answerId: choice.id, correct });

        app.quizRoot.querySelectorAll('.quiz-option').forEach(opt => {
          opt.disabled = true;
        });

        btn.classList.add(correct ? 'is-correct' : 'is-wrong');
        if (correct) {
          setScore(5);
          coachSay('ตอบถูกแล้ว เก่งมาก', true, 'celebration');
        } else {
          coachSay('ไม่เป็นไร ลองข้อต่อไปนะ', true, 'coach');
        }

        logEvent('quiz_answer', {
          questionId: q.id,
          answerId: choice.id,
          correct
        });

        setTimeout(() => {
          idx += 1;
          renderQuestion();
        }, 500);
      });
    });
  }

  renderQuestion();
}

function showQuizDone() {
  const correctCount = state.quizAnswers.filter(x => x.correct).length;
  coachSay(`ตอบถูก ${correctCount} จาก ${BATH_QUIZ.length} ข้อ เก่งมากเลย`, true, 'celebration');

  if (!app.quizRoot) return;
  app.quizRoot.innerHTML = `
    <div class="quiz-card">
      <h2 class="quiz-title">เก่งมาก ตอบเสร็จแล้ว</h2>
      <div class="result-pill">ตอบถูก ${correctCount} / ${BATH_QUIZ.length}</div>
      <p class="quiz-sub">
        สิ่งที่ควรจำ: อาบน้ำให้สะอาด ล้างฟองออก และเช็ดตัวให้แห้ง
      </p>
      <div class="quiz-actions">
        <button id="quizReplayBtn" class="big-btn primary" type="button">เล่นอีกครั้ง</button>
        <button id="quizHubBtn" class="big-btn soft" type="button">กลับ HUB</button>
      </div>
    </div>
  `;

  $('#quizReplayBtn')?.addEventListener('click', () => safeNavigate(buildReplayUrl()));
  $('#quizHubBtn')?.addEventListener('click', () => safeNavigate(parseHubUrl()));
}

/* help / init */

function handleHelpButton() {
  unlockBathAudio();

  const phaseId = BATH_PHASES[Math.min(state.phaseIndex, BATH_PHASES.length - 1)]?.id || 'ready';

  if (phaseId === 'ready') {
    coachSay(BATH_COPY.help.ready, true, 'hint');
    speakBathText(BATH_AUDIO.readyHelp, state.audioEnabled);
  }
  if (phaseId === 'scrub') {
    coachSay(BATH_COPY.help.scrub, true, 'hint');
    speakBathText(BATH_AUDIO.scrubHelp, state.audioEnabled);
  }
  if (phaseId === 'rinseDry') {
    if (state.substep === 'rinse') {
      coachSay(BATH_COPY.help.rinse, true, 'hint');
      speakBathText(BATH_AUDIO.rinseHelp, state.audioEnabled);
    } else {
      coachSay(BATH_COPY.help.dry, true, 'hint');
      speakBathText(BATH_AUDIO.dryHelp, state.audioEnabled);
    }
  }
  if (phaseId === 'boss') {
    coachSay(BATH_COPY.help.boss, true, 'hint');
    speakBathText(BATH_AUDIO.bossHelp, state.audioEnabled);
  }
}

function bindTopButtons() {
  app.helpBtn?.addEventListener('click', handleHelpButton);
  app.homeBtn?.addEventListener('click', () => {
    safeNavigate(parseHubUrl());
  });
}

window.addEventListener('pointerup', clearActiveScrub);
window.addEventListener('pointercancel', clearActiveScrub);
window.addEventListener('pagehide', cleanupRuntime);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cleanupRuntime();
});

function init() {
  state.progress = loadBathProgress();
  setBathAudioEnabled(state.audioEnabled);
  bindTopButtons();
  initHotspotsState();
  updateProgressBox();
  showBrief();
}

init();