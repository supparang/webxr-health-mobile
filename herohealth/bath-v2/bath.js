import {
  BATH_COPY,
  BATH_COACH_LINES,
  BATH_ITEMS,
  BATH_HOTSPOTS,
  BATH_PHASES,
  BATH_BOSS_TASKS,
  BATH_QUIZ
} from './bath.data.js';

import {
  BATH_AUDIO,
  speakBathText,
  stopBathSpeech
} from './bath.audio.js';

const $ = (sel) => document.querySelector(sel);

const qs = new URLSearchParams(location.search);

const app = {
  phaseBadge: $('#phaseBadge'),
  taskText: $('#taskText'),
  scoreValue: $('#scoreValue'),
  progressValue: $('#progressValue'),
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
  bossHotspot: null
};

let idleHintTimer = null;

function parseHubUrl() {
  return qs.get('hub') || '../hub.html';
}

function buildReplayUrl() {
  return location.href;
}

function logEvent(type, data = {}) {
  console.log('[BathV2]', type, data);
}

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
  state.bossHotspot = {
    id: 'armpit',
    scrubMs: 0,
    scrubDone: false,
    rinsed: false,
    dry: false
  };
}

function coachSay(text, speak = false) {
  app.coachBubble.textContent = text;
  if (speak) speakBathText(text, state.audioEnabled);
}

function setScore(delta) {
  state.score = Math.max(0, state.score + delta);
  app.scoreValue.textContent = String(state.score);
}

function calcStars() {
  if (state.score >= 110) return 3;
  if (state.score >= 70) return 2;
  return 1;
}

function setPhaseUI(title, task) {
  app.phaseBadge.textContent = title;
  app.taskText.textContent = task;
}

function clearLayers() {
  app.hotspotsLayer.innerHTML = '';
  app.itemsLayer.innerHTML = '';
  app.effectsLayer.innerHTML = '';
  app.summaryRoot.innerHTML = '';
  app.quizRoot.innerHTML = '';
}

function clearActiveScrub() {
  if (state.scrubTimer) {
    clearInterval(state.scrubTimer);
    state.scrubTimer = null;
  }
  app.hotspotsLayer.querySelectorAll('.hotspot.is-active').forEach(el => el.classList.remove('is-active'));
}

function showPhaseBurst(text = 'ผ่านด่านแล้ว') {
  const burst = document.createElement('div');
  burst.className = 'phase-burst';
  burst.textContent = `🎉 ${text}`;
  app.effectsLayer.appendChild(burst);
  setTimeout(() => burst.remove(), 900);
}

function spawnSparkleAtHotspot(hotspotId) {
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

function updateProgressBox() {
  const phaseId = BATH_PHASES[state.phaseIndex]?.id;
  let done = 0;
  let total = 0;

  if (phaseId === 'ready') {
    total = BATH_ITEMS.filter(i => i.correct).length;
    done = state.selectedItems.size;
  } else if (phaseId === 'scrub') {
    total = BATH_HOTSPOTS.length;
    done = BATH_HOTSPOTS.filter(h => state.hotspots[h.id].scrubDone).length;
  } else if (phaseId === 'rinseDry') {
    total = BATH_HOTSPOTS.length;
    done = state.substep === 'rinse'
      ? BATH_HOTSPOTS.filter(h => state.hotspots[h.id].rinsed).length
      : BATH_HOTSPOTS.filter(h => state.hotspots[h.id].dry).length;
  } else if (phaseId === 'boss') {
    total = BATH_BOSS_TASKS.length;
    done = state.bossIndex;
  }

  app.progressValue.textContent = `${done}/${total}`;
}

function resetIdleHint() {
  clearTimeout(idleHintTimer);
  idleHintTimer = setTimeout(() => {
    const phaseId = BATH_PHASES[state.phaseIndex]?.id;
    state.hintsUsed += 1;

    if (phaseId === 'ready') coachSay('ลองแตะของที่ใช้ตอนอาบน้ำดูนะ');
    if (phaseId === 'scrub') coachSay('เลือกสบู่ แล้วถูจุดสีเหลืองนะ');
    if (phaseId === 'rinseDry') {
      coachSay(
        state.substep === 'rinse'
          ? 'เลือกฝักบัว แล้วล้างฟองออกนะ'
          : 'เลือกผ้าเช็ดตัว แล้วเช็ดให้แห้งนะ'
      );
    }
    if (phaseId === 'boss') coachSay('ทำทีละขั้นนะ หนูทำได้');
  }, 5000);
}

function showBrief() {
  app.scene.classList.add('hidden');
  app.actionBar.classList.add('hidden');
  setPhaseUI('Bath v2', 'พร้อมเริ่ม');
  updateProgressBox();

  app.briefCard.innerHTML = `
    <h1 class="brief-title">${BATH_COPY.title}</h1>
    <p class="brief-sub">${BATH_COPY.sub}</p>
    <div class="brief-actions">
      <button id="startBtn" class="big-btn primary" type="button">เริ่มอาบน้ำ</button>
      <button id="briefHelpBtn" class="big-btn soft" type="button">ฟังวิธีเล่น</button>
    </div>
  `;

  $('#startBtn').addEventListener('click', () => {
    startGame();
    speakBathText(BATH_AUDIO.readyHelp, state.audioEnabled);
  });

  $('#briefHelpBtn').addEventListener('click', () => {
    coachSay('เลือกของให้ถูก ถูให้ครบ ล้างฟอง แล้วเช็ดตัวให้แห้ง');
    speakBathText('เลือกของให้ถูก ถูให้ครบ ล้างฟอง แล้วเช็ดตัวให้แห้ง', state.audioEnabled);
  });
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
  app.scoreValue.textContent = '0';

  initHotspotsState();
  resetBossHotspot();

  app.briefCard.innerHTML = '';
  app.scene.classList.remove('hidden');
  app.actionBar.classList.remove('hidden');
  renderPhase();
}

function renderPhase() {
  clearActiveScrub();
  clearLayers();

  const phase = BATH_PHASES[state.phaseIndex];
  state.phaseStartedAt = Date.now();
  setPhaseUI(phase.title, phase.task);

  if (phase.id === 'ready') renderReadyPhase();
  if (phase.id === 'scrub') renderScrubPhase();
  if (phase.id === 'rinseDry') renderRinseDryPhase();
  if (phase.id === 'boss') renderBossPhase();

  updateProgressBox();
  resetIdleHint();
}

function nextPhase() {
  clearActiveScrub();
  state.phaseIndex += 1;
  if (state.phaseIndex >= BATH_PHASES.length) {
    showSummary();
    return;
  }
  renderPhase();
}

function renderToolBar(tools = [], opts = {}) {
  const {
    showNext = false,
    nextLabel = 'ไปต่อ',
    nextHandler = nextPhase
  } = opts;

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
  replayBtn.addEventListener('click', () => location.href = buildReplayUrl());
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

function renderReadyChecklist() {
  const checklist = document.createElement('div');
  checklist.className = 'ready-checklist';
  checklist.innerHTML = `
    <h3>ของที่ต้องใช้</h3>
    <ul>
      ${BATH_ITEMS.filter(i => i.correct).map(i => `
        <li class="${state.selectedItems.has(i.id) ? 'done' : ''}" data-check="${i.id}">
          ${i.emoji} ${i.label}
        </li>
      `).join('')}
    </ul>
  `;
  app.itemsLayer.appendChild(checklist);
}

function renderReadyPhase() {
  coachSay(BATH_COACH_LINES.readyStart);

  const wrap = document.createElement('div');
  wrap.className = 'items-grid';

  BATH_ITEMS.forEach(item => {
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
  logEvent('item_tap', { itemId: item.id, correct: item.correct });
  resetIdleHint();

  if (item.correct) {
    if (!state.selectedItems.has(item.id)) {
      state.selectedItems.add(item.id);
      setScore(10);
      el.classList.add('is-correct');
      coachSay(`${BATH_COACH_LINES.readyCorrect}`);
      renderReadyChecklist();
      updateProgressBox();
    } else {
      coachSay(`${item.label} เลือกแล้วจ้า`);
    }
  } else {
    setScore(-1);
    el.classList.add('is-wrong');
    coachSay(BATH_COACH_LINES.readyWrong);
  }

  const correctCount = BATH_ITEMS.filter(x => x.correct).length;
  if (state.selectedItems.size >= correctCount) {
    logEvent('phase_clear', { phase: 'ready', ms: Date.now() - state.phaseStartedAt });
    showPhaseBurst(BATH_COACH_LINES.phaseClear);
    renderToolBar([], {
      showNext: true,
      nextLabel: 'ไปด่านต่อไป'
    });
  }
}

function getFirstPendingHotspotId() {
  const phaseId = BATH_PHASES[state.phaseIndex]?.id;

  if (phaseId === 'scrub') {
    const next = BATH_HOTSPOTS.find(h => !state.hotspots[h.id].scrubDone);
    return next?.id || null;
  }

  if (phaseId === 'rinseDry') {
    if (state.substep === 'rinse') {
      const next = BATH_HOTSPOTS.find(h => state.hotspots[h.id].scrubDone && !state.hotspots[h.id].rinsed);
      return next?.id || null;
    }
    const next = BATH_HOTSPOTS.find(h => state.hotspots[h.id].rinsed && !state.hotspots[h.id].dry);
    return next?.id || null;
  }

  return null;
}

function renderAvatarHotspots(mode = 'normal') {
  app.hotspotsLayer.innerHTML = '';

  const targetId = state.mode === 'learn' && mode !== 'boss' ? getFirstPendingHotspotId() : null;

  BATH_HOTSPOTS.forEach(h => {
    if (mode === 'boss' && h.id !== 'armpit') return;

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

    app.hotspotsLayer.appendChild(div);
  });
}

function updateHotspotProgress(hotspotId, ratio) {
  const bar = app.hotspotsLayer.querySelector(`[data-hotspot="${hotspotId}"] .hotspot-progress > i`);
  if (bar) bar.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
}

function updateHotspotDone(hotspotId) {
  const node = app.hotspotsLayer.querySelector(`[data-hotspot="${hotspotId}"]`);
  if (node) node.classList.add('is-done');
}

function renderFoamDecor() {
  app.effectsLayer.querySelectorAll('.foam-dot').forEach(n => n.remove());

  const phaseId = BATH_PHASES[state.phaseIndex]?.id;
  if (!phaseId) return;

  if (phaseId === 'boss') {
    if (state.bossHotspot.scrubDone && !state.bossHotspot.rinsed) {
      const h = BATH_HOTSPOTS.find(x => x.id === 'armpit');
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

  BATH_HOTSPOTS.forEach(h => {
    const st = state.hotspots[h.id];
    if (!st.scrubDone || st.rinsed) return;

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'foam-dot';
      dot.style.left = `calc(50% - 90px + ${h.x + 4 + (i * 10)}px)`;
      dot.style.top = `${h.y + 8 + (i % 2) * 8}px`;
      app.effectsLayer.appendChild(dot);
    }
  });
}

function renderScrubPhase() {
  coachSay(BATH_COACH_LINES.scrubStart);
  state.selectedTool = 'soap';
  renderAvatarHotspots();
  renderFoamDecor();
  renderToolBar(['soap']);
  updateProgressBox();
}

function onHotspotDown(hotspotId, el) {
  const phaseId = BATH_PHASES[state.phaseIndex].id;
  resetIdleHint();

  if (phaseId === 'scrub') {
    if (state.selectedTool !== 'soap') {
      coachSay('เลือกสบู่ก่อนนะ');
      return;
    }
    startScrub(hotspotId, el);
    return;
  }

  if (phaseId === 'rinseDry') {
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
      coachSay(BATH_COACH_LINES.scrubDone);
      logEvent('hotspot_scrub_done', { hotspotId });
      updateHotspotDone(hotspotId);
      spawnSparkleAtHotspot(hotspotId);
      renderAvatarHotspots();
      renderFoamDecor();
      updateProgressBox();

      const allDone = BATH_HOTSPOTS.every(x => state.hotspots[x.id].scrubDone);
      if (allDone) {
        logEvent('phase_clear', { phase: 'scrub', ms: Date.now() - state.phaseStartedAt });
        showPhaseBurst(BATH_COACH_LINES.phaseClear);
        renderToolBar(['soap'], {
          showNext: true,
          nextLabel: 'ไปด่านต่อไป'
        });
      }
    }
  }, 100);
}

function renderRinseDryPhase() {
  state.substep = 'rinse';
  state.selectedTool = 'shower';
  renderAvatarHotspots();
  renderFoamDecor();
  renderToolBar(['shower', 'towel']);
  updateRinseDryText();
  coachSay(BATH_COACH_LINES.rinseStart);
  updateProgressBox();
}

function updateRinseDryText() {
  app.taskText.textContent = state.substep === 'rinse'
    ? 'เลือกฝักบัว แล้วแตะจุดที่มีฟอง'
    : 'เลือกผ้าเช็ดตัว แล้วแตะจุดที่ล้างแล้ว';
}

function handleRinseDryClick(hotspotId) {
  const st = state.hotspots[hotspotId];
  if (!st?.scrubDone) {
    coachSay('จุดนี้ยังไม่ได้ถูสบู่เลย');
    return;
  }

  if (state.substep === 'rinse') {
    if (state.selectedTool !== 'shower') {
      coachSay('เลือกฝักบัวก่อนนะ');
      return;
    }
    if (!st.rinsed) {
      st.rinsed = true;
      setScore(8);
      coachSay(BATH_COACH_LINES.rinseDone);
      logEvent('rinse_done', { hotspotId });
      spawnSparkleAtHotspot(hotspotId);
      renderAvatarHotspots();
      renderFoamDecor();
      updateProgressBox();
    }

    const allRinsed = BATH_HOTSPOTS.every(h => state.hotspots[h.id].rinsed);
    if (allRinsed) {
      state.substep = 'dry';
      state.selectedTool = 'towel';
      coachSay('เยี่ยมเลย ต่อไปเช็ดตัวให้แห้ง');
      renderAvatarHotspots();
      renderToolBar(['shower', 'towel']);
      updateRinseDryText();
      updateProgressBox();
      return;
    }
    return;
  }

  if (state.substep === 'dry') {
    if (state.selectedTool !== 'towel') {
      coachSay('เลือกผ้าเช็ดตัวก่อนนะ');
      return;
    }
    if (!st.rinsed) {
      coachSay('ต้องล้างฟองก่อนนะ');
      return;
    }
    if (!st.dry) {
      st.dry = true;
      setScore(8);
      coachSay(BATH_COACH_LINES.dryDone);
      logEvent('dry_done', { hotspotId });
      spawnSparkleAtHotspot(hotspotId);
      renderAvatarHotspots();
      updateProgressBox();
    }

    const allDry = BATH_HOTSPOTS.every(h => state.hotspots[h.id].dry);
    if (allDry) {
      logEvent('phase_clear', { phase: 'rinseDry', ms: Date.now() - state.phaseStartedAt });
      showPhaseBurst(BATH_COACH_LINES.phaseClear);
      renderToolBar(['shower', 'towel'], {
        showNext: true,
        nextLabel: 'ไปด่านต่อไป'
      });
    }
  }
}

function renderBossPhase() {
  resetBossHotspot();
  state.bossIndex = 0;
  state.selectedTool = null;
  coachSay(BATH_COACH_LINES.bossStart);
  renderBossStep();
}

function renderBossStep() {
  clearActiveScrub();
  app.hotspotsLayer.innerHTML = '';
  app.itemsLayer.innerHTML = '';
  app.effectsLayer.innerHTML = '';

  const step = BATH_BOSS_TASKS[state.bossIndex];
  if (!step) {
    logEvent('phase_clear', { phase: 'boss', ms: Date.now() - state.phaseStartedAt });
    showSummary();
    return;
  }

  const stepNo = state.bossIndex + 1;
  const totalNo = BATH_BOSS_TASKS.length;
  app.taskText.textContent = `(${stepNo}/${totalNo}) ${step.text}`;

  if (step.type === 'selectTool') {
    if (state.mode === 'learn') {
      coachSay(`ขั้นที่ ${stepNo} เลือกอุปกรณ์ให้ถูกนะ`);
    } else {
      coachSay(step.text);
    }
    renderToolBar(['soap', 'shower', 'towel']);
  } else {
    if (state.mode === 'learn') {
      coachSay(`ขั้นที่ ${stepNo} แตะตรงจุดที่กำหนดนะ`);
    } else {
      coachSay(step.text);
    }
    renderAvatarHotspots('boss');
    renderFoamDecor();
    renderToolBar(['soap', 'shower', 'towel']);
  }

  updateProgressBox();
}

function maybeResolveBossSelectTool(toolId) {
  const step = BATH_BOSS_TASKS[state.bossIndex];
  if (!step || step.type !== 'selectTool') return;

  if (toolId === step.tool) {
    setScore(6);
    coachSay('ถูกต้อง ไปต่อเลย');
    logEvent('boss_step_ok', { type: 'selectTool', tool: step.tool });
    state.bossIndex += 1;
    renderBossStep();
  } else {
    setScore(-1);
    coachSay('ลองดูอีกทีนะ');
  }
  updateProgressBox();
}

function handleBossHotspot(hotspotId, el) {
  const step = BATH_BOSS_TASKS[state.bossIndex];
  if (!step) return;
  if (hotspotId !== 'armpit') return;

  if (step.type === 'scrub') {
    if (state.selectedTool !== 'soap') {
      coachSay('เลือกสบู่ก่อนนะ');
      return;
    }

    clearActiveScrub();
    el.classList.add('is-active');

    state.scrubTimer = setInterval(() => {
      state.bossHotspot.scrubMs += 180;
      updateHotspotProgress('armpit', state.bossHotspot.scrubMs / 1000);

      if (state.bossHotspot.scrubMs >= 1000) {
        clearActiveScrub();
        state.bossHotspot.scrubDone = true;
        setScore(10);
        coachSay('สะอาดแล้ว ไปต่อ');
        logEvent('boss_step_ok', { type: 'scrub', hotspotId });
        spawnSparkleAtHotspot(hotspotId);
        state.bossIndex += 1;
        renderBossStep();
      }
    }, 100);
    return;
  }

  if (step.type === 'rinse') {
    if (state.selectedTool !== 'shower') {
      coachSay('เลือกฝักบัวก่อนนะ');
      return;
    }
    state.bossHotspot.rinsed = true;
    setScore(8);
    coachSay('ล้างฟองแล้ว');
    logEvent('boss_step_ok', { type: 'rinse', hotspotId });
    spawnSparkleAtHotspot(hotspotId);
    state.bossIndex += 1;
    renderBossStep();
    return;
  }

  if (step.type === 'dry') {
    if (state.selectedTool !== 'towel') {
      coachSay('เลือกผ้าเช็ดตัวก่อนนะ');
      return;
    }
    state.bossHotspot.dry = true;
    setScore(8);
    coachSay('แห้งแล้ว เก่งมาก');
    logEvent('boss_step_ok', { type: 'dry', hotspotId });
    spawnSparkleAtHotspot(hotspotId);
    state.bossIndex += 1;
    renderBossStep();
  }
}

function showSummary() {
  clearActiveScrub();
  clearTimeout(idleHintTimer);
  app.scene.classList.add('hidden');
  app.actionBar.classList.add('hidden');

  const stars = calcStars();
  const durationSec = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  const badge =
    stars === 3 ? 'Bath Star 🛁' :
    stars === 2 ? 'Foam Finder 🫧' :
    'Clean Helper ✨';

  logEvent('game_complete', {
    scoreFinal: state.score,
    stars,
    durationSec,
    mode: state.mode,
    hintsUsed: state.hintsUsed
  });

  app.summaryRoot.innerHTML = `
    <div class="summary-card">
      <h2 class="summary-title">อาบน้ำเสร็จแล้ว เยี่ยมเลย</h2>
      <div class="summary-stars">${'⭐'.repeat(stars)}</div>
      <div class="result-pill">${badge}</div>
      <p class="summary-text">
        หนูทำได้ดีมาก ล้างหลายจุดได้สะอาดแล้ว
        สิ่งที่ควรจำคือ ล้างฟองออกให้หมด และเช็ดตัวให้แห้งก่อนใส่เสื้อผ้า
      </p>

      <div class="summary-actions">
        <button id="toQuizBtn" class="big-btn primary" type="button">ทำคำถามสั้น ๆ</button>
        <button id="replayBtn" class="big-btn soft" type="button">เล่นอีกครั้ง</button>
        <button id="hubBtn" class="big-btn soft" type="button">กลับ HUB</button>
      </div>
    </div>
  `;

  $('#toQuizBtn').addEventListener('click', showQuiz);
  $('#replayBtn').addEventListener('click', () => location.href = buildReplayUrl());
  $('#hubBtn').addEventListener('click', () => location.href = parseHubUrl());
}

function showQuiz() {
  app.summaryRoot.innerHTML = '';
  let idx = 0;
  state.quizAnswers = [];

  function renderQuestion() {
    const q = BATH_QUIZ[idx];
    if (!q) {
      showQuizDone();
      return;
    }

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
        const choice = q.choices.find(c => c.id === btn.dataset.choice);
        const correct = !!choice?.correct;
        state.quizAnswers.push({ questionId: q.id, answerId: choice.id, correct });

        btn.classList.add(correct ? 'is-correct' : 'is-wrong');
        if (correct) setScore(5);

        logEvent('quiz_answer', {
          questionId: q.id,
          answerId: choice.id,
          correct
        });

        setTimeout(() => {
          idx += 1;
          renderQuestion();
        }, 450);
      });
    });
  }

  renderQuestion();
}

function showQuizDone() {
  const correctCount = state.quizAnswers.filter(x => x.correct).length;
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

  $('#quizReplayBtn').addEventListener('click', () => location.href = buildReplayUrl());
  $('#quizHubBtn').addEventListener('click', () => location.href = parseHubUrl());
}

function handleHelpButton() {
  const phaseId = BATH_PHASES[Math.min(state.phaseIndex, BATH_PHASES.length - 1)]?.id || 'ready';

  if (phaseId === 'ready') {
    coachSay(BATH_COPY.help.ready);
    speakBathText(BATH_AUDIO.readyHelp, state.audioEnabled);
  }
  if (phaseId === 'scrub') {
    coachSay(BATH_COPY.help.scrub);
    speakBathText(BATH_AUDIO.scrubHelp, state.audioEnabled);
  }
  if (phaseId === 'rinseDry') {
    if (state.substep === 'rinse') {
      coachSay(BATH_COPY.help.rinse);
      speakBathText(BATH_AUDIO.rinseHelp, state.audioEnabled);
    } else {
      coachSay(BATH_COPY.help.dry);
      speakBathText(BATH_AUDIO.dryHelp, state.audioEnabled);
    }
  }
  if (phaseId === 'boss') {
    coachSay(BATH_COPY.help.boss);
    speakBathText(BATH_AUDIO.bossHelp, state.audioEnabled);
  }
}

function bindTopButtons() {
  app.helpBtn.addEventListener('click', handleHelpButton);
  app.homeBtn.addEventListener('click', () => {
    stopBathSpeech();
    location.href = parseHubUrl();
  });
}

window.addEventListener('pointerup', clearActiveScrub);

function init() {
  bindTopButtons();
  initHotspotsState();
  updateProgressBox();
  showBrief();
}

init();