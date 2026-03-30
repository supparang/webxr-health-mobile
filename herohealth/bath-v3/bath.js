import {
  BATH_COPY,
  BATH_QUIZ,
  BATH_MISSIONS_50,
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

  primaryActionBtn: $('#primaryActionBtn'),
  bonusActionBtn: $('#bonusActionBtn'),
  mistakeBtn: $('#mistakeBtn'),

  cleanText: $('#cleanText'),
  hintText: $('#hintText'),
  comboPill: $('#comboPill'),
  goalText: $('#goalText'),
  subGoalText: $('#subGoalText'),
  bestComboValue: $('#bestComboValue'),
  perfectValue: $('#perfectValue'),
  modeValue: $('#modeValue')
};

const PHASES = [
  {
    id: 'scrub',
    badge: 'Phase 1 • ถูให้สะอาด',
    task: 'ถูให้สะอาดก่อนเข้าสtepถัดไป',
    mission: 'ถูมือให้ครบ 20 วินาที',
    coach: 'เริ่มเลย! ถูมือให้ทั่วก่อนนะ',
    hint: 'เก็บความสะอาดต่อเพื่อปลดล็อกดาวเต็ม',
    goal: 'ผ่าน 3 phase ให้ครบ',
    subGoal: 'ถ้ารักษา combo จะได้คะแนนพุ่งเร็ว',
    primaryText: '🧼 ถูมือ',
    bonusText: '⭐ Perfect Foam',
    tool: 'soap',
    target: 28,
    cleanGain: 10,
    primaryScore: 24,
    bonusCleanGain: 16,
    bonusScore: 40,
    perfectText: 'Perfect Foam!'
  },
  {
    id: 'rinse',
    badge: 'Phase 2 • ล้างฟองออก',
    task: 'ล้างฟองออกให้หมดและต่อเนื่อง',
    mission: 'ล้างฟองออกให้หมด',
    coach: 'ดีมาก! ต่อไปล้างฟองออกให้สะอาด',
    hint: 'ถ้าล้างได้ต่อเนื่องจะได้ Clean Bonus',
    goal: 'ล้างฟองให้หมดเร็วที่สุด',
    subGoal: 'ล้างต่อเนื่องโดยไม่พลาดจะได้คะแนนเพิ่ม',
    primaryText: '🚿 ล้างออก',
    bonusText: '⭐ Super Rinse',
    tool: 'water',
    target: 26,
    cleanGain: 10,
    primaryScore: 28,
    bonusCleanGain: 16,
    bonusScore: 46,
    perfectText: 'Super Rinse!'
  },
  {
    id: 'dry',
    badge: 'Phase 3 • เช็ดให้แห้ง',
    task: 'เช็ดมือให้แห้งและผ่านรอบนี้แบบสวย ๆ',
    mission: 'เช็ดมือให้สะอาดและแห้ง',
    coach: 'สุดท้ายแล้ว เช็ดมือให้แห้งและนุ่มเลย',
    hint: 'อีกนิดเดียวจะได้ 3 ดาวเต็ม',
    goal: 'ปิดท้ายให้เนียนที่สุด',
    subGoal: 'เก็บ perfect ช่วงท้ายเพื่อดันคะแนน',
    primaryText: '🧴 เช็ดให้แห้ง',
    bonusText: '⭐ Perfect Dry',
    tool: 'towel',
    target: 26,
    cleanGain: 10,
    primaryScore: 30,
    bonusCleanGain: 18,
    bonusScore: 52,
    perfectText: 'Perfect Dry!'
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
  maxClean: 80,
  phaseIndex: 0,
  phaseProgress: 0,
  currentTool: 'soap',
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

function setScore(value) {
  state.score = Math.max(0, value);
  app.scoreValue.textContent = String(state.score);
}

function addScore(delta) {
  setScore(state.score + delta);
}

function getCurrentPhase() {
  return PHASES[Math.min(state.phaseIndex, PHASES.length - 1)];
}

function getStarsFromScore(score = state.score) {
  if (score >= 320) return 3;
  if (score >= 220) return 2;
  return 1;
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

function activateTool(toolId) {
  state.currentTool = toolId;
  app.toolSoap.classList.toggle('active', toolId === 'soap');
  app.toolWater.classList.toggle('active', toolId === 'water');
  app.toolTowel.classList.toggle('active', toolId === 'towel');
}

function updateTopStats() {
  app.scoreValue.textContent = String(state.score);
  app.comboValue.textContent = String(state.combo);
  app.livesValue.textContent = String(state.lives);
}

function updatePlayUI() {
  const phase = getCurrentPhase();
  const totalPct = Math.min(100, Math.round((state.clean / state.maxClean) * 100));
  const streakPct = Math.min(100, 12 + state.combo * 14);

  app.phaseBadge.textContent = 'Bath v3';
  app.taskText.textContent = phase.task;
  app.phaseChip.textContent = phase.badge;
  app.missionTitle.textContent = phase.mission;
  app.progressFill.style.width = `${totalPct}%`;
  app.phaseProgressText.textContent = `${state.phaseProgress} / ${phase.target}`;
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

  app.primaryActionBtn.textContent = phase.primaryText;
  app.bonusActionBtn.textContent = phase.bonusText;

  activateTool(phase.tool);
  updateTopStats();
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
  const before = new Set(progress.unlockedRewardIds || []);
  const next = [...before];

  const unlockCount =
    (getStarsFromScore() >= 1 ? 1 : 0) +
    (getStarsFromScore() >= 2 ? 1 : 0) +
    (getStarsFromScore() >= 3 ? 1 : 0) +
    (state.perfectCount >= 2 ? 1 : 0);

  BATH_REWARDS_20.slice(0, unlockCount).forEach(r => {
    if (!before.has(r.id)) next.push(r.id);
  });

  progress.unlockedRewardIds = Array.from(new Set(next));
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

function renderBrief() {
  const previewMission = BATH_MISSIONS_50?.[0];

  app.scene.classList.add('hidden');
  app.summaryRoot.innerHTML = '';
  app.quizRoot.innerHTML = '';

  app.briefCard.innerHTML = `
    <h1 class="brief-title">${BATH_COPY?.title || 'Bath v3'}</h1>
    <p class="brief-sub">${BATH_COPY?.sub || 'เลือก → ถู → ล้าง → เช็ด แล้วจบรอบแบบสนุกขึ้น'}</p>
    <p class="brief-sub" style="margin-top:10px;">
      <strong>${previewMission?.title || 'ภารกิจอาบน้ำสะอาด'}</strong>
      ${previewMission?.subtitle ? `— ${previewMission.subtitle}` : ''}
    </p>

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
    const text = 'ถูให้สะอาด ล้างฟองออก แล้วเช็ดให้แห้ง ทำ combo ต่อเนื่องจะได้คะแนนเพิ่ม';
    coachSay(text, true, 'hint');
  });
}

function resetStateForRun() {
  state.score = 0;
  state.combo = 1;
  state.bestCombo = 1;
  state.perfectCount = 0;
  state.lives = 8;
  state.clean = 0;
  state.phaseIndex = 0;
  state.phaseProgress = 0;
  state.currentTool = 'soap';
  state.runStartedAt = Date.now();
  state.completed = false;
  state.quizAnswers = [];
  state.quizIndex = 0;
  state.newlyUnlockedRewards = [];
}

function startRun() {
  resetStateForRun();
  app.briefCard.innerHTML = '';
  app.summaryRoot.innerHTML = '';
  app.quizRoot.innerHTML = '';
  app.scene.classList.remove('hidden');

  updatePlayUI();
  coachSay(getCurrentPhase().coach, true, 'coach');
}

function addCombo() {
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
}

function markMistake() {
  state.combo = 1;
  state.lives = Math.max(1, state.lives - 1);
  addScore(-12);
  showFeedback('พลาดนิดหน่อย');
  coachSay('ไม่เป็นไร เริ่มใหม่แล้วทำต่อเลย', true, 'hint');
  updatePlayUI();
}

function advancePhase() {
  if (state.phaseIndex < PHASES.length - 1) {
    state.phaseIndex += 1;
    state.phaseProgress = 0;
    showFeedback('Phase Clear!');
    setTimeout(() => {
      updatePlayUI();
      coachSay(getCurrentPhase().coach, true, 'celebration');
    }, 220);
    return;
  }

  state.clean = state.maxClean;
  finishRun();
}

function doAction(kind = 'primary') {
  if (state.completed) return;

  const phase = getCurrentPhase();
  const isBonus = kind === 'bonus';
  const cleanGain = isBonus ? phase.bonusCleanGain : phase.cleanGain;
  const scoreGain = isBonus ? phase.bonusScore : phase.primaryScore;

  addCombo();
  if (isBonus) state.perfectCount += 1;

  state.phaseProgress = Math.min(phase.target, state.phaseProgress + cleanGain);
  state.clean = Math.min(state.maxClean, state.clean + cleanGain);
  addScore(scoreGain);

  showFeedback(isBonus ? phase.perfectText : 'เยี่ยม!');
  updatePlayUI();

  if (state.phaseProgress >= phase.target) {
    advancePhase();
  }
}

function finishRun() {
  if (state.completed) return;
  state.completed = true;
  finalizeRunProgress();
  renderSummary();
}

function renderSummary() {
  app.scene.classList.add('hidden');
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
          ? 'วันนี้ทำได้ลื่นมาก ทั้ง 3 phase ต่อเนื่องดีสุด ๆ'
          : stars === 2
            ? 'รอบนี้ดีขึ้นมาก ลองรักษา combo ให้นานกว่านี้เพื่อเก็บ 3 ดาวเต็ม'
            : 'เริ่มต้นดีแล้ว รอบหน้าลองทำต่อเนื่องในทุก phase จะได้คะแนนพุ่งเร็ว'}
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
        สิ่งที่ควรจำ: ถูให้สะอาด ล้างฟองออก และเช็ดให้แห้ง
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

  if (app.scene.classList.contains('hidden')) {
    coachSay('ถูให้สะอาด ล้างฟอง แล้วเช็ดให้แห้ง ทำ combo ต่อเนื่องจะได้คะแนนเพิ่ม', true, 'hint');
    return;
  }

  const phase = getCurrentPhase();
  const helpMap = {
    scrub: 'เลือกสบู่แล้วถูให้ต่อเนื่อง จะได้คะแนนมากขึ้น',
    rinse: 'ตอนนี้ใช้ฝักบัว ล้างฟองออกให้หมด',
    dry: 'ตอนนี้ใช้ผ้าเช็ดตัว เช็ดให้แห้งและเร็ว'
  };

  coachSay(helpMap[phase.id] || phase.coach, true, 'hint');
}

function bindEvents() {
  app.toolSoap?.addEventListener('click', () => activateTool('soap'));
  app.toolWater?.addEventListener('click', () => activateTool('water'));
  app.toolTowel?.addEventListener('click', () => activateTool('towel'));

  app.primaryActionBtn?.addEventListener('click', () => {
    const phase = getCurrentPhase();
    const toolMap = { scrub: 'soap', rinse: 'water', dry: 'towel' };
    if (state.currentTool !== toolMap[phase.id]) {
      coachSay('เลือกอุปกรณ์ให้ตรงกับภารกิจก่อนนะ', true, 'hint');
      return;
    }
    doAction('primary');
  });

  app.bonusActionBtn?.addEventListener('click', () => {
    const phase = getCurrentPhase();
    const toolMap = { scrub: 'soap', rinse: 'water', dry: 'towel' };
    if (state.currentTool !== toolMap[phase.id]) {
      coachSay('เลือกอุปกรณ์ให้ตรงกับภารกิจก่อนนะ', true, 'hint');
      return;
    }
    doAction('bonus');
  });

  app.mistakeBtn?.addEventListener('click', markMistake);
  app.helpBtn?.addEventListener('click', handleHelp);
  app.homeBtn?.addEventListener('click', () => safeNavigate(parseHubUrl()));

  window.addEventListener('pagehide', cleanupRuntime);
}

function init() {
  state.progress = loadProgress();
  setBathAudioEnabled(state.audioEnabled);
  bindEvents();
  renderBrief();
}

init();