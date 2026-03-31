import {
  BATH_COPY,
  BATH_QUIZ,
  BATH_REWARDS_20
} from '../bath-v2/bath.data.js';

import {
  setBathAudioEnabled,
  unlockBathAudio,
  speakBathCoachLine,
  speakBathHint,
  speakBathCelebration,
  stopBathSpeech
} from '../bath-v2/bath.audio.js';

const $ = (sel) => document.querySelector(sel);
const qs = new URLSearchParams(location.search);

const BATH_V3_PROGRESS_KEY = 'HH_BATH_V3_PROGRESS_V1';

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
  missionTitle: $('#missionTitle'),
  progressFill: $('#progressFill'),
  phaseProgressText: $('#phaseProgressText'),
  streakFill: $('#streakFill'),
  speechBubble: $('#speechBubble'),
  feedbackPop: $('#feedbackPop'),

  toolSoap: $('#toolSoap'),
  toolWater: $('#toolWater'),
  toolTowel: $('#toolTowel'),

  avatarWrap: $('#avatarWrap'),
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

const EQUIPMENT = {
  soap: { id: 'soap', label: 'สบู่', emoji: '🧼', correct: true },
  water: { id: 'water', label: 'ฝักบัว', emoji: '🚿', correct: true },
  towel: { id: 'towel', label: 'ผ้าเช็ดตัว', emoji: '🧴', correct: true },
  clothes: { id: 'clothes', label: 'เสื้อผ้าสะอาด', emoji: '👕', correct: true },

  toy: { id: 'toy', label: 'ของเล่น', emoji: '🧸', correct: false },
  fries: { id: 'fries', label: 'ของกินเล่น', emoji: '🍟', correct: false },
  shoes: { id: 'shoes', label: 'รองเท้า', emoji: '👟', correct: false },
  book: { id: 'book', label: 'หนังสือ', emoji: '📘', correct: false }
};

const HOTSPOTS = [
  { id: 'neck', label: 'คอ', x: 41, y: 26, w: 18, h: 10, needMs: 900 },
  { id: 'arm', label: 'แขน', x: 17, y: 42, w: 20, h: 16, needMs: 850 },
  { id: 'armpit', label: 'รักแร้', x: 35, y: 43, w: 16, h: 13, needMs: 900 },
  { id: 'leg', label: 'ขา', x: 34, y: 72, w: 18, h: 18, needMs: 850 },
  { id: 'feet', label: 'เท้า', x: 30, y: 92, w: 24, h: 10, needMs: 800 }
];

const PHASES = [
  {
    id: 'ready',
    badge: 'Step 1 • เตรียมของ',
    task: 'เลือกของอาบน้ำให้ถูกก่อนเริ่มเล่น',
    mission: 'เตรียมของอาบน้ำให้ครบ',
    coach: 'เริ่มเลย! เลือกของที่ใช้ตอนอาบน้ำให้ครบก่อนนะ',
    goal: 'เลือกของที่ถูกให้ครบ 4 ชิ้น',
    subGoal: 'ของผิดจะโดนหักคะแนนเล็กน้อย',
    hint: 'เลือกสบู่ ฝักบัว ผ้าเช็ดตัว และเสื้อผ้าสะอาด'
  },
  {
    id: 'wet',
    badge: 'Step 2 • ทำตัวเปียก',
    task: 'เลือกฝักบัวแล้วแตะจุดบนตัวให้เปียกครบ',
    mission: 'ทำตัวให้เปียกก่อนถูสบู่',
    coach: 'ใช้ฝักบัวแตะจุดสำคัญให้เปียกก่อนนะ',
    goal: 'ทำให้จุดสำคัญเปียกครบทุกจุด',
    subGoal: 'โดนจุดเป้าหมายจะได้โบนัสเพิ่ม',
    hint: 'เริ่มทำตัวเปียกจากจุดที่ไฮไลต์'
  },
  {
    id: 'soap',
    badge: 'Step 3 • ถูสบู่',
    task: 'เลือกสบู่แล้วกดค้างถูตามจุดสำคัญ',
    mission: 'ถูสบู่ตามจุดสำคัญให้ครบ',
    coach: 'ต่อไปเลือกสบู่ แล้วถูจุดสำคัญให้สะอาด',
    goal: 'ถูให้ครบทุกจุดโดยไม่หลุด combo',
    subGoal: 'กดค้างบนจุดจนแถบเต็ม',
    hint: 'กดค้างที่จุดบนตัวจนแถบเขียวเต็ม'
  },
  {
    id: 'rinse',
    badge: 'Step 4 • ล้างฟอง',
    task: 'เลือกฝักบัวแล้วล้างฟองออกให้หมด',
    mission: 'ล้างฟองสบู่ออกให้หมด',
    coach: 'ดีมาก! ตอนนี้ล้างฟองออกให้สะอาดเลย',
    goal: 'ล้างครบทุกจุดที่มีฟอง',
    subGoal: 'โดนจุดเป้าหมายจะได้คะแนนพิเศษ',
    hint: 'แตะจุดที่ยังมีฟองเพื่อให้สะอาด'
  },
  {
    id: 'dry',
    badge: 'Step 5 • เช็ดให้แห้ง',
    task: 'เลือกผ้าเช็ดตัวแล้วเช็ดให้แห้งครบ',
    mission: 'เช็ดตัวให้สะอาดและแห้ง',
    coach: 'สุดท้ายแล้ว ใช้ผ้าเช็ดตัวเช็ดให้แห้งนะ',
    goal: 'เช็ดให้ครบทุกจุดและเก็บคะแนนช่วงท้าย',
    subGoal: 'เก็บ perfect ช่วงท้ายเพื่อดันคะแนน',
    hint: 'แตะหรือปาดผ่านจุดเปียกให้ครบ'
  }
];

const state = {
  mode: qs.get('mode') || 'play',
  audioEnabled: qs.get('audio') !== '0',

  score: 0,
  combo: 1,
  bestCombo: 1,
  perfectCount: 0,
  lives: 8,

  clean: 0,
  maxClean: HOTSPOTS.length * 4,

  phaseIndex: 0,
  focusId: null,
  currentTool: null,

  selectedReadyItems: new Set(),
  hotspots: {},
  pointerDown: false,
  activeHold: null,
  activeHoldTimer: null,

  runStartedAt: 0,
  completed: false,
  quizAnswers: [],
  quizIndex: 0,

  progress: null,
  newlyUnlockedRewards: []
};

function parseHubUrl() {
  return qs.get('hub') || '../hub.html';
}

function buildReplayUrl() {
  return location.href;
}

function cleanupRuntime() {
  clearActiveHold();
  stopBathSpeech();
}

function safeNavigate(url) {
  cleanupRuntime();
  location.href = url;
}

function speakCoach(text, type = 'coach') {
  if (!state.audioEnabled || !text) return;
  if (type === 'hint') speakBathHint(text, state.audioEnabled);
  else if (type === 'celebration') speakBathCelebration(text, state.audioEnabled);
  else speakBathCoachLine(text, state.audioEnabled);
}

function coachSay(text, speak = false, type = 'coach') {
  if (app.speechBubble) app.speechBubble.textContent = text;
  if (speak) speakCoach(text, type);
}

function getStarsFromScore(score = state.score) {
  if (score >= 320) return 3;
  if (score >= 220) return 2;
  return 1;
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
}

function resetCombo() {
  state.combo = 1;
}

function showFeedback(text) {
  if (!app.feedbackPop || !app.avatarWrap) return;
  app.feedbackPop.textContent = text;
  app.feedbackPop.classList.add('show');
  app.avatarWrap.classList.add('bump');

  setTimeout(() => {
    app.feedbackPop.classList.remove('show');
    app.avatarWrap.classList.remove('bump');
  }, 720);
}

function randFromSeed(seedText) {
  let h = 1779033703 ^ String(seedText).length;
  for (let i = 0; i < String(seedText).length; i++) {
    h = Math.imul(h ^ String(seedText).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand = Math.random) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getCurrentPhase() {
  return PHASES[Math.min(state.phaseIndex, PHASES.length - 1)];
}

function createDefaultProgress() {
  return {
    version: 1,
    runs: 0,
    starsTotal: 0,
    bestScore: 0,
    lastScore: 0,
    unlockedRewardIds: []
  };
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(BATH_V3_PROGRESS_KEY);
    if (!raw) return createDefaultProgress();
    const obj = JSON.parse(raw);
    return {
      ...createDefaultProgress(),
      ...(obj || {}),
      unlockedRewardIds: Array.isArray(obj?.unlockedRewardIds) ? obj.unlockedRewardIds : []
    };
  } catch {
    return createDefaultProgress();
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(BATH_V3_PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}

function computeUnlockedRewards() {
  const progress = state.progress || createDefaultProgress();
  const already = new Set(progress.unlockedRewardIds || []);
  const unlockCount =
    (getStarsFromScore() >= 1 ? 1 : 0) +
    (getStarsFromScore() >= 2 ? 1 : 0) +
    (getStarsFromScore() >= 3 ? 1 : 0) +
    (state.perfectCount >= 2 ? 1 : 0);

  BATH_REWARDS_20.slice(0, unlockCount).forEach(r => already.add(r.id));
  progress.unlockedRewardIds = Array.from(already);
  state.newlyUnlockedRewards = BATH_REWARDS_20.filter(r => progress.unlockedRewardIds.includes(r.id));
}

function finalizeRunProgress() {
  const progress = state.progress || loadProgress();
  progress.runs += 1;
  progress.starsTotal += getStarsFromScore();
  progress.lastScore = state.score;
  progress.bestScore = Math.max(progress.bestScore || 0, state.score);

  state.progress = progress;
  computeUnlockedRewards();
  saveProgress(progress);
}

function initHotspotsState() {
  state.hotspots = {};
  HOTSPOTS.forEach(h => {
    state.hotspots[h.id] = {
      wet: false,
      soaped: false,
      rinsed: false,
      dried: false,
      holdMs: 0
    };
  });
}

function activateTool(toolId) {
  state.currentTool = toolId;
  app.toolSoap.classList.toggle('active', toolId === 'soap');
  app.toolWater.classList.toggle('active', toolId === 'water');
  app.toolTowel.classList.toggle('active', toolId === 'towel');
}

function chooseNextFocus() {
  const phase = getCurrentPhase();
  const pending = HOTSPOTS.filter(h => {
    const st = state.hotspots[h.id];
    if (phase.id === 'wet') return !st.wet;
    if (phase.id === 'soap') return st.wet && !st.soaped;
    if (phase.id === 'rinse') return st.soaped && !st.rinsed;
    if (phase.id === 'dry') return st.rinsed && !st.dried;
    return false;
  });

  if (!pending.length) {
    state.focusId = null;
    return;
  }

  const seedBase = `${qs.get('seed') || 'bath-v3'}-${phase.id}-${state.score}-${pending.length}`;
  const rand = randFromSeed(seedBase);
  const next = shuffle(pending, rand)[0];
  state.focusId = next?.id || null;
}

function getPhaseDoneCount(phaseId) {
  return HOTSPOTS.filter(h => {
    const st = state.hotspots[h.id];
    if (phaseId === 'wet') return st.wet;
    if (phaseId === 'soap') return st.soaped;
    if (phaseId === 'rinse') return st.rinsed;
    if (phaseId === 'dry') return st.dried;
    return false;
  }).length;
}

function phaseTargetCount(phaseId) {
  if (phaseId === 'ready') return 4;
  return HOTSPOTS.length;
}

function renderHotspots() {
  if (!app.hotspotsLayer) return;
  app.hotspotsLayer.innerHTML = '';

  const phase = getCurrentPhase();
  if (phase.id === 'ready') return;

  HOTSPOTS.forEach(h => {
    const st = state.hotspots[h.id];
    const el = document.createElement('div');
    el.className = 'hotspot';
    el.dataset.hotspot = h.id;

    el.style.left = `${h.x}%`;
    el.style.top = `${h.y}%`;
    el.style.width = `${h.w}%`;
    el.style.height = `${h.h}%`;

    const isDone =
      (phase.id === 'wet' && st.wet) ||
      (phase.id === 'soap' && st.soaped) ||
      (phase.id === 'rinse' && st.rinsed) ||
      (phase.id === 'dry' && st.dried);

    if (isDone) el.classList.add('is-done');
    if (state.focusId === h.id) el.classList.add('is-focus');

    el.innerHTML = `
      <div class="hotspot-label">${h.label}</div>
      <div class="hotspot-progress"><i style="width:${Math.min(100, Math.round((st.holdMs / h.needMs) * 100))}%"></i></div>
    `;

    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      state.pointerDown = true;
      handleHotspotPointerDown(h.id, el);
    });

    el.addEventListener('pointerenter', (ev) => {
      ev.preventDefault();
      if (state.pointerDown) handleHotspotPointerEnter(h.id, el);
    });

    el.addEventListener('pointerup', () => {
      state.pointerDown = false;
      clearActiveHold();
    });

    el.addEventListener('pointerleave', () => {
      if (state.activeHold?.id === h.id) clearActiveHold();
    });

    app.hotspotsLayer.appendChild(el);
  });
}

function spawnFx(hotspotId, emoji = '✨') {
  const node = app.hotspotsLayer?.querySelector(`[data-hotspot="${hotspotId}"]`);
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

function updatePlayUI() {
  const phase = getCurrentPhase();
  const totalPct = Math.min(100, Math.round((state.clean / state.maxClean) * 100));
  const streakPct = Math.min(100, 12 + state.combo * 14);
  const phaseDone = phase.id === 'ready' ? state.selectedReadyItems.size : getPhaseDoneCount(phase.id);

  app.phaseBadge.textContent = 'Bath v3';
  app.taskText.textContent = phase.task;
  app.phaseChip.textContent = phase.badge;
  app.missionTitle.textContent = phase.mission;
  app.progressFill.style.width = `${totalPct}%`;
  app.phaseProgressText.textContent = `${phaseDone} / ${phaseTargetCount(phase.id)}`;
  app.streakFill.style.width = `${streakPct}%`;

  app.cleanText.textContent = `${state.clean} / ${state.maxClean}`;
  app.hintText.textContent = totalPct >= 75 ? 'อีกนิดเดียวจะได้ 3 ดาวเต็ม' : phase.hint;
  app.goalText.textContent = phase.goal;
  app.subGoalText.textContent = phase.subGoal;

  app.comboPill.textContent =
    state.combo >= 5 ? '🌟 Perfect Run ใกล้สำเร็จ'
    : state.combo >= 3 ? `🔥 Combo x${state.combo}`
    : '✨ เริ่มต้นได้ดี';

  app.bestComboValue.textContent = String(state.bestCombo);
  app.perfectValue.textContent = String(state.perfectCount);
  app.modeValue.textContent = state.mode;
  app.focusValue.textContent = state.focusId ? (HOTSPOTS.find(h => h.id === state.focusId)?.label || '-') : '-';

  app.scoreValue.textContent = String(state.score);
  app.comboValue.textContent = String(state.combo);
  app.livesValue.textContent = String(state.lives);

  if (phase.id === 'ready') {
    app.scene.classList.add('hidden');
  } else {
    app.scene.classList.remove('hidden');
    const toolMap = { wet: 'water', soap: 'soap', rinse: 'water', dry: 'towel' };
    activateTool(toolMap[phase.id] || state.currentTool || 'soap');
  }

  renderHotspots();
}

function renderReadyPhase() {
  app.scene.classList.add('hidden');
  app.summaryRoot.innerHTML = '';
  app.quizRoot.innerHTML = '';

  const correct = ['soap', 'water', 'towel', 'clothes'];
  const wrong = ['toy', 'fries', 'shoes', 'book'];
  const pool = shuffle([...correct, ...wrong], randFromSeed(`${qs.get('seed') || 'bath-v3'}-ready`));

  app.briefCard.innerHTML = `
    <h1 class="brief-title">${BATH_COPY?.title || 'Bath v3'}</h1>
    <p class="brief-sub">${getCurrentPhase().coach}</p>
    <div class="brief-stats">
      <div class="brief-pill">เลือกของให้ถูก 4 ชิ้น</div>
      <div class="brief-pill">ของผิดจะโดน -2</div>
      <div class="brief-pill">เก็บ combo ไปต่อในด่านถัดไป</div>
    </div>

    <div class="items-grid">
      ${pool.map(id => {
        const item = EQUIPMENT[id];
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
    btn.addEventListener('click', () => {
      if (state.completed) return;

      const id = btn.dataset.item;
      const item = EQUIPMENT[id];
      const isCorrect = !!item.correct;

      if (isCorrect && !state.selectedReadyItems.has(id)) {
        state.selectedReadyItems.add(id);
        addScore(10);
        addCombo();
        btn.classList.add('is-correct');
        btn.disabled = true;
        showFeedback('ถูกต้อง!');
        coachSay('ดีมาก เลือกของถูกแล้ว', true, 'coach');
      } else if (!isCorrect) {
        addScore(-2);
        resetCombo();
        btn.classList.add('is-wrong');
        btn.disabled = true;
        showFeedback('ยังไม่ใช่');
        coachSay('ของชิ้นนี้ไม่ได้ใช้ตอนอาบน้ำนะ', true, 'hint');
      }

      updatePlayUI();

      if (state.selectedReadyItems.size >= 4) {
        showFeedback('พร้อมแล้ว!');
        coachSay('พร้อมอาบน้ำแล้ว ไปต่อกันเลย', true, 'celebration');
        setTimeout(() => {
          state.phaseIndex = 1;
          state.clean = 0;
          state.focusId = null;
          chooseNextFocus();
          app.briefCard.innerHTML = '';
          updatePlayUI();
          coachSay(getCurrentPhase().coach, true, 'coach');
        }, 420);
      }
    });
  });

  $('#readyHelpBtn')?.addEventListener('click', () => {
    unlockBathAudio();
    coachSay('เลือกสบู่ ฝักบัว ผ้าเช็ดตัว และเสื้อผ้าสะอาด', true, 'hint');
  });

  $('#readyRestartBtn')?.addEventListener('click', () => safeNavigate(buildReplayUrl()));
}

function clearActiveHold() {
  if (state.activeHoldTimer) {
    clearInterval(state.activeHoldTimer);
    state.activeHoldTimer = null;
  }
  if (state.activeHold?.el) {
    state.activeHold.el.classList.remove('is-active');
  }
  state.activeHold = null;
}

function markMistake() {
  if (state.completed) return;
  state.lives = Math.max(1, state.lives - 1);
  resetCombo();
  addScore(-12);
  showFeedback('พลาดนิดหน่อย');
  coachSay('ไม่เป็นไร เริ่มใหม่แล้วทำต่อเลย', true, 'hint');
  updatePlayUI();
}

function markPhaseAdvance() {
  if (state.phaseIndex < PHASES.length - 1) {
    state.phaseIndex += 1;
    chooseNextFocus();
    showFeedback('Phase Clear!');
    updatePlayUI();
    setTimeout(() => {
      coachSay(getCurrentPhase().coach, true, 'celebration');
    }, 220);
    return;
  }

  finishRun();
}

function maybeCompletePhase() {
  const phase = getCurrentPhase();

  if (phase.id === 'ready') return;

  const doneCount = getPhaseDoneCount(phase.id);
  if (doneCount >= HOTSPOTS.length) {
    markPhaseAdvance();
  }
}

function rewardForHotspotSuccess(hotspotId, baseScore, emoji = '✨') {
  const isFocus = state.focusId === hotspotId;
  addCombo();
  addScore(baseScore + (isFocus ? 8 : 0));
  state.clean = Math.min(state.maxClean, state.clean + 1);

  if (isFocus) {
    state.perfectCount += 1;
    showFeedback('Perfect!');
  } else {
    showFeedback('เยี่ยม!');
  }

  spawnFx(hotspotId, emoji);
  chooseNextFocus();
  updatePlayUI();
  maybeCompletePhase();
}

function handleWetHotspot(hotspotId) {
  const st = state.hotspots[hotspotId];
  if (!st || st.wet) return;
  if (state.currentTool !== 'water') {
    coachSay('ตอนนี้ต้องใช้ฝักบัวนะ', true, 'hint');
    return;
  }

  st.wet = true;
  rewardForHotspotSuccess(hotspotId, 12, '💧');
}

function startSoapHold(hotspotId, el) {
  const st = state.hotspots[hotspotId];
  const hotspot = HOTSPOTS.find(h => h.id === hotspotId);

  if (!st || !hotspot || st.soaped) return;
  if (!st.wet) {
    coachSay('ต้องทำตัวเปียกก่อนนะ', true, 'hint');
    return;
  }
  if (state.currentTool !== 'soap') {
    coachSay('ตอนนี้ต้องใช้สบู่ก่อนนะ', true, 'hint');
    return;
  }

  clearActiveHold();
  state.activeHold = { id: hotspotId, el };
  el.classList.add('is-active');

  state.activeHoldTimer = setInterval(() => {
    st.holdMs += 120;
    const bar = el.querySelector('.hotspot-progress > i');
    if (bar) bar.style.width = `${Math.min(100, Math.round((st.holdMs / hotspot.needMs) * 100))}%`;

    if (st.holdMs >= hotspot.needMs) {
      clearActiveHold();
      st.soaped = true;
      rewardForHotspotSuccess(hotspotId, 16, '🫧');
      coachSay('จุดนี้สะอาดแล้ว ไปต่อเลย', true, 'coach');
    }
  }, 90);
}

function handleRinseHotspot(hotspotId) {
  const st = state.hotspots[hotspotId];
  if (!st || st.rinsed) return;
  if (!st.soaped) {
    coachSay('ต้องถูสบู่ก่อนล้างนะ', true, 'hint');
    return;
  }
  if (state.currentTool !== 'water') {
    coachSay('ตอนนี้ต้องใช้ฝักบัวนะ', true, 'hint');
    return;
  }

  st.rinsed = true;
  rewardForHotspotSuccess(hotspotId, 14, '🚿');
}

function handleDryHotspot(hotspotId) {
  const st = state.hotspots[hotspotId];
  if (!st || st.dried) return;
  if (!st.rinsed) {
    coachSay('ต้องล้างฟองก่อนเช็ดนะ', true, 'hint');
    return;
  }
  if (state.currentTool !== 'towel') {
    coachSay('ตอนนี้ต้องใช้ผ้าเช็ดตัวนะ', true, 'hint');
    return;
  }

  st.dried = true;
  rewardForHotspotSuccess(hotspotId, 16, '✨');
}

function handleHotspotPointerDown(hotspotId, el) {
  const phase = getCurrentPhase();
  if (state.completed) return;

  if (phase.id === 'wet') {
    handleWetHotspot(hotspotId);
    return;
  }

  if (phase.id === 'soap') {
    startSoapHold(hotspotId, el);
    return;
  }

  if (phase.id === 'rinse') {
    handleRinseHotspot(hotspotId);
    return;
  }

  if (phase.id === 'dry') {
    handleDryHotspot(hotspotId);
  }
}

function handleHotspotPointerEnter(hotspotId, el) {
  const phase = getCurrentPhase();
  if (phase.id === 'wet') {
    handleWetHotspot(hotspotId);
    return;
  }

  if (phase.id === 'rinse') {
    handleRinseHotspot(hotspotId);
    return;
  }

  if (phase.id === 'dry') {
    handleDryHotspot(hotspotId);
    return;
  }

  if (phase.id === 'soap' && state.currentTool === 'soap' && !state.activeHold) {
    startSoapHold(hotspotId, el);
  }
}

function resetStateForRun() {
  state.score = 0;
  state.combo = 1;
  state.bestCombo = 1;
  state.perfectCount = 0;
  state.lives = 8;
  state.clean = 0;
  state.phaseIndex = 0;
  state.focusId = null;
  state.currentTool = null;
  state.selectedReadyItems = new Set();
  state.pointerDown = false;
  state.runStartedAt = Date.now();
  state.completed = false;
  state.quizAnswers = [];
  state.quizIndex = 0;
  state.newlyUnlockedRewards = [];
  initHotspotsState();
  clearActiveHold();
}

function startRun() {
  resetStateForRun();
  app.summaryRoot.innerHTML = '';
  app.quizRoot.innerHTML = '';
  renderReadyPhase();
  updatePlayUI();
}

function finishRun() {
  if (state.completed) return;
  state.completed = true;
  finalizeRunProgress();
  renderSummary();
}

function renderSummary() {
  app.scene.classList.add('hidden');
  app.briefCard.innerHTML = '';
  app.quizRoot.innerHTML = '';

  const stars = getStarsFromScore();
  const best = state.progress?.bestScore || 0;
  const prevBest = Math.max(0, best === state.score ? (state.progress?.lastScore || 0) : best);
  const diff = state.score - prevBest;
  const nextGoal = Math.max(0, 320 - state.score);
  const coins = 20 + stars * 20 + state.perfectCount * 4;

  app.summaryRoot.innerHTML = `
    <div class="summary-card">
      <h2 class="summary-title">${stars === 3 ? 'Amazing Job!' : stars === 2 ? 'Great Job!' : 'Good Try!'}</h2>
      <div class="summary-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>

      <div class="result-pill">Score ${state.score}</div>

      <p class="summary-text">
        ${stars === 3
          ? 'วันนี้ทำได้ลื่นมาก ทั้ง 5 ขั้นต่อเนื่องดีสุด ๆ'
          : stars === 2
            ? 'รอบนี้ดีขึ้นมาก ลองรักษา combo ให้นานกว่านี้เพื่อเก็บ 3 ดาวเต็ม'
            : 'เริ่มต้นดีแล้ว รอบหน้าลองทำต่อเนื่องในทุกขั้นจะได้คะแนนพุ่งเร็ว'}
      </p>

      <div class="brief-stats" style="margin-top:14px;">
        <div class="brief-pill">🪙 ได้เหรียญ ${coins}</div>
        <div class="brief-pill">🔥 best combo ${state.bestCombo}</div>
        <div class="brief-pill">⭐ perfect ${state.perfectCount}</div>
        <div class="brief-pill">🏆 best score ${state.progress?.bestScore || 0}</div>
      </div>

      <p class="summary-text">
        ${nextGoal > 0
          ? `อีก ${nextGoal} คะแนน จะได้ 3 ดาวเต็ม`
          : 'ผ่านเกณฑ์ 3 ดาวเต็มแล้ว!'}
      </p>

      <p class="summary-text">
        ${diff > 0
          ? `รอบนี้ดีกว่ารอบก่อน +${diff} คะแนน`
          : `ยังไม่ชนะสถิติเดิม ลองอีกครั้งเพื่อแซง ${state.progress?.bestScore || 0}`}
      </p>

      <p class="summary-text">
        รางวัลที่ปลดล็อกแล้ว: ${state.newlyUnlockedRewards.slice(0, 4).map(r => r.label).join(' • ') || 'ยังไม่มี'}
      </p>

      <div class="summary-actions">
        <button id="toQuizBtn" class="big-btn primary" type="button">ทำคำถามสั้น ๆ</button>
        <button id="replayBtn" class="big-btn soft" type="button">เล่นอีกครั้ง</button>
        <button id="hubBtn" class="big-btn soft" type="button">กลับ HUB</button>
      </div>
    </div>
  `;

  $('#toQuizBtn')?.addEventListener('click', renderQuiz);
  $('#replayBtn')?.addEventListener('click', () => safeNavigate(buildReplayUrl()));
  $('#hubBtn')?.addEventListener('click', () => safeNavigate(parseHubUrl()));
}

function renderQuiz() {
  app.summaryRoot.innerHTML = '';
  state.quizIndex = 0;
  state.quizAnswers = [];

  const questions = (BATH_QUIZ || []).slice(0, 3);

  function draw() {
    const q = questions[state.quizIndex];
    if (!q) {
      renderQuizDone(questions.length);
      return;
    }

    app.quizRoot.innerHTML = `
      <div class="quiz-card">
        <h2 class="quiz-title">คำถามสั้น ๆ</h2>
        <div class="result-pill">ข้อ ${state.quizIndex + 1} / ${questions.length}</div>
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

        state.quizAnswers.push({
          questionId: q.id,
          answerId: choice?.id,
          correct
        });

        if (correct) {
          addScore(5);
          coachSay('ตอบถูกแล้ว เก่งมาก', true, 'celebration');
        } else {
          coachSay('ไม่เป็นไร ลองข้อต่อไปนะ', true, 'coach');
        }

        setTimeout(() => {
          state.quizIndex += 1;
          draw();
        }, 520);
      });
    });
  }

  draw();
}

function renderQuizDone(total) {
  const correctCount = state.quizAnswers.filter(x => x.correct).length;

  app.quizRoot.innerHTML = `
    <div class="quiz-card">
      <h2 class="quiz-title">เก่งมาก ตอบเสร็จแล้ว</h2>
      <div class="result-pill">ตอบถูก ${correctCount} / ${total}</div>
      <p class="quiz-sub">
        สิ่งที่ควรจำ: เตรียมของ ทำตัวเปียก ถูสบู่ ล้างฟอง และเช็ดให้แห้ง
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

function handleHelp() {
  unlockBathAudio();

  const phase = getCurrentPhase();
  const helpText = {
    ready: 'เลือกสบู่ ฝักบัว ผ้าเช็ดตัว และเสื้อผ้าสะอาด',
    wet: 'เลือกฝักบัว แล้วแตะจุดบนตัวให้เปียกครบ',
    soap: 'เลือกสบู่ แล้วกดค้างที่จุดบนตัวจนแถบเขียวเต็ม',
    rinse: 'เลือกฝักบัว แล้วแตะจุดที่ยังมีฟอง',
    dry: 'เลือกผ้าเช็ดตัว แล้วแตะจุดที่ยังเปียก'
  };

  coachSay(helpText[phase.id] || phase.coach, true, 'hint');
}

function bindEvents() {
  app.toolSoap?.addEventListener('click', () => activateTool('soap'));
  app.toolWater?.addEventListener('click', () => activateTool('water'));
  app.toolTowel?.addEventListener('click', () => activateTool('towel'));

  app.retryBtn?.addEventListener('click', () => safeNavigate(buildReplayUrl()));
  app.mistakeBtn?.addEventListener('click', markMistake);

  app.helpBtn?.addEventListener('click', handleHelp);
  app.homeBtn?.addEventListener('click', () => safeNavigate(parseHubUrl()));

  document.addEventListener('pointerup', () => {
    state.pointerDown = false;
    clearActiveHold();
  });
  document.addEventListener('pointercancel', () => {
    state.pointerDown = false;
    clearActiveHold();
  });

  window.addEventListener('pagehide', cleanupRuntime);
}

function init() {
  state.progress = loadProgress();
  setBathAudioEnabled(state.audioEnabled);
  bindEvents();

  app.modeValue.textContent = state.mode;
  app.briefCard.innerHTML = `
    <h1 class="brief-title">${BATH_COPY?.title || 'Bath v3'}</h1>
    <p class="brief-sub">Bath v3 เปลี่ยนจากกดปุ่มอย่างเดียวเป็นเล่นบนตัวละครจริงด้วย hotspot แล้ว</p>

    <div class="brief-stats">
      <div class="brief-pill">⭐ ดาวสะสม ${state.progress?.starsTotal || 0}</div>
      <div class="brief-pill">🏆 best score ${state.progress?.bestScore || 0}</div>
      <div class="brief-pill">🎮 เล่นแล้ว ${state.progress?.runs || 0} รอบ</div>
      <div class="brief-pill">🧠 mode ${state.mode}</div>
    </div>

    <div class="brief-actions">
      <button id="startBtn" class="big-btn primary" type="button">เริ่ม Bath v3</button>
      <button id="briefHelpBtn" class="big-btn soft" type="button">ฟังวิธีเล่น</button>
    </div>
  `;

  $('#startBtn')?.addEventListener('click', () => {
    unlockBathAudio();
    startRun();
  });

  $('#briefHelpBtn')?.addEventListener('click', () => {
    unlockBathAudio();
    coachSay('เริ่มจากเลือกของ แล้วเล่นบนตัวละครจริงด้วย hotspot ทีละขั้น', true, 'hint');
  });
}

init();