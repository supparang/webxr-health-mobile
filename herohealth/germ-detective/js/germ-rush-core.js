// /herohealth/germ-detective/js/germ-rush-core.js
// Germ Detective: Outbreak Rush
// MAIN GAME CORE MODULE
// PATCH v20260410b-germ-rush-core-mvp

import {
  GAME_META,
  TOOLS,
  TOOL_ORDER,
  UI_TEXT,
  DIFFICULTY,
  getDifficultyConfig,
  getPhasePlan,
  getWaveScript,
  getBossConfig,
  getSpot,
  getToolDef,
  getHazardDef,
  isCorrectTool,
  buildSummarySnapshot,
  clamp
} from './germ-rush-data.js';

export function createGermRushGame({ query, ui, refs }) {
  const sceneEl = refs.sceneEl;
  const hazardRoot = refs.hazardRoot;

  const diffCfg = getDifficultyConfig(query.diff);
  const phasePlan = getPhasePlan(query.diff);
  const bossCfg = getBossConfig('cross_contam');

  const TOOL_MATCH_COLORS = {
    wipe: '#67c8ff',
    spray: '#7ae582',
    trash: '#ffb84d'
  };

  const state = {
    active: false,
    phaseIndex: 0,
    phase: phasePlan[0]?.id || 'intro',
    phaseStartedAt: 0,
    startedAt: 0,
    endedAt: 0,
    roundMs: phasePlan.filter(p => p.id !== 'summary').reduce((a, b) => a + b.ms, 0),
    timeLeftMs: phasePlan.filter(p => p.id !== 'summary').reduce((a, b) => a + b.ms, 0),

    selectedTool: 'wipe',

    score: 0,
    hp: 100,
    infection: diffCfg.infectionStart,
    combo: 0,
    bestCombo: 0,
    cleared: 0,
    missed: 0,
    wrongTool: 0,

    bossActive: false,
    bossCleared: false,
    bossTotal: 0,
    bossClears: 0,

    hazards: new Map(),
    scheduledEvents: [],
    phaseEventCursor: 0,

    raf: 0
  };

  let isMounted = false;
  let keydownBound = null;

  function fmtTime(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function setPrompt(text) {
    if (ui.promptBox) ui.promptBox.textContent = text;
  }

  function updateHUD() {
    if (ui.infectionValue) ui.infectionValue.textContent = Math.round(state.infection);
    if (ui.infectionFill) {
      ui.infectionFill.style.width = `${clamp(state.infection, 0, 100)}%`;
      if (state.infection < 35) ui.infectionFill.style.filter = 'saturate(1)';
      else if (state.infection < 70) ui.infectionFill.style.filter = 'saturate(1.15)';
      else ui.infectionFill.style.filter = 'saturate(1.4)';
    }

    if (ui.scoreText) ui.scoreText.textContent = `SCORE ${String(Math.round(state.score)).padStart(4, '0')}`;
    if (ui.comboValue) ui.comboValue.textContent = state.combo;
    if (ui.wrongToolValue) ui.wrongToolValue.textContent = state.wrongTool;
    if (ui.phaseText) ui.phaseText.textContent = (phasePlan[state.phaseIndex]?.label || state.phase || 'READY').toUpperCase();
    if (ui.timerText) ui.timerText.textContent = fmtTime(state.timeLeftMs);

    const bossPct = state.bossTotal > 0 ? (state.bossClears / state.bossTotal) * 100 : 0;
    if (ui.bossFill) ui.bossFill.style.width = `${clamp(bossPct, 0, 100)}%`;
  }

  function showFeedback(text, kind = 'good') {
    if (!ui.feedbackChip) return;

    ui.feedbackChip.textContent = text;
    ui.feedbackChip.style.display = 'block';
    ui.feedbackChip.style.background = kind === 'good'
      ? 'rgba(119,239,157,.16)'
      : 'rgba(255,122,139,.16)';
    ui.feedbackChip.style.border = kind === 'good'
      ? '1px solid rgba(119,239,157,.30)'
      : '1px solid rgba(255,122,139,.30)';
    ui.feedbackChip.style.color = kind === 'good' ? '#e7fff0' : '#ffe4e8';

    clearTimeout(showFeedback._t);
    showFeedback._t = setTimeout(() => {
      ui.feedbackChip.style.display = 'none';
    }, 900);
  }

  function flashDamage() {
    if (!ui.damageFlash) return;

    ui.damageFlash.style.display = 'block';
    ui.damageFlash.style.opacity = '1';

    clearTimeout(flashDamage._t1);
    clearTimeout(flashDamage._t2);

    flashDamage._t1 = setTimeout(() => {
      ui.damageFlash.style.opacity = '0';
    }, 180);

    flashDamage._t2 = setTimeout(() => {
      ui.damageFlash.style.display = 'none';
    }, 650);
  }

  function showComboChip() {
    if (!ui.comboChip || state.combo < 2) return;

    let label = `COMBO x${state.combo}`;
    if (state.combo >= 8) label = `SUPER CLEAN x${state.combo}`;
    else if (state.combo >= 5) label = `GREAT x${state.combo}`;
    else if (state.combo >= 3) label = `NICE x${state.combo}`;

    ui.comboChip.textContent = label;
    ui.comboChip.style.display = 'block';

    clearTimeout(showComboChip._t);
    showComboChip._t = setTimeout(() => {
      ui.comboChip.style.display = 'none';
    }, 900);
  }

  function syncToolBar() {
    if (!ui.toolBar) return;

    [...ui.toolBar.querySelectorAll('.tool-btn')].forEach((btn) => {
      const toolId = btn.dataset.toolId;
      const active = toolId === state.selectedTool;
      btn.classList.toggle('is-selected', active);
      btn.style.background = active
        ? `${TOOL_MATCH_COLORS[toolId]}22`
        : 'rgba(255,255,255,.07)';
      btn.style.borderColor = active
        ? `${TOOL_MATCH_COLORS[toolId]}aa`
        : 'rgba(255,255,255,.10)';
    });
  }

  function selectTool(toolId) {
    if (!TOOLS[toolId]) return;
    state.selectedTool = toolId;
    syncToolBar();
    setPrompt(`${UI_TEXT.toolSelectedPrefix} ${getToolDef(toolId).label}`);
  }

  function makeToolBar() {
    if (!ui.toolBar) return;

    ui.toolBar.innerHTML = '';
    for (const toolId of TOOL_ORDER) {
      const tool = getToolDef(toolId);
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.dataset.toolId = tool.id;
      btn.innerHTML = `
        <span class="tool-icon">${tool.icon}</span>
        <span class="tool-name">${tool.shortLabel}</span>
        <span class="tool-key">กด ${tool.key}</span>
      `;
      btn.addEventListener('click', () => selectTool(tool.id));
      ui.toolBar.appendChild(btn);
    }

    syncToolBar();
  }

  function makeId(prefix = 'hz') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function activeHazardCount() {
    let count = 0;
    for (const hz of state.hazards.values()) {
      if (hz.state === 'active') count += 1;
    }
    return count;
  }

  function getUsedSpotIds() {
    const used = new Set();
    for (const hz of state.hazards.values()) {
      if (hz.state === 'active') used.add(hz.spotId);
    }
    return used;
  }

  function randomFreeSpotId() {
    const keys = ['counter_left', 'counter_mid', 'counter_right', 'table_left', 'table_mid', 'table_right'];
    const used = getUsedSpotIds();
    const free = keys.filter(k => !used.has(k));
    const pool = free.length ? free : keys;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function buildHazardVisual(hazardType, hazardId) {
    const def = getHazardDef(hazardType);
    const color = def.visual?.color || '#ff7a8b';

    const wrap = document.createElement('a-entity');
    wrap.setAttribute('data-hazard-id', hazardId);
    wrap.setAttribute('class', 'clickable');

    if (def.visual?.shape === 'spill') {
      const blob1 = document.createElement('a-sphere');
      blob1.setAttribute('radius', '0.18');
      blob1.setAttribute('position', '0 0.10 0');
      blob1.setAttribute('color', color);
      blob1.setAttribute('material', `emissive:${color}; emissiveIntensity:0.45; opacity:0.96`);
      wrap.appendChild(blob1);

      const blob2 = document.createElement('a-sphere');
      blob2.setAttribute('radius', '0.10');
      blob2.setAttribute('position', '0.18 0.08 0.04');
      blob2.setAttribute('color', color);
      blob2.setAttribute('material', `emissive:${color}; emissiveIntensity:0.35; opacity:0.94`);
      wrap.appendChild(blob2);

      const ring = document.createElement('a-ring');
      ring.setAttribute('radiusInner', '0.20');
      ring.setAttribute('radiusOuter', '0.27');
      ring.setAttribute('rotation', '-90 0 0');
      ring.setAttribute('position', '0 -0.02 0');
      ring.setAttribute('color', '#ffffff');
      ring.setAttribute('material', 'shader:flat; opacity:0.9');
      wrap.appendChild(ring);
    } else if (def.visual?.shape === 'cloud') {
      const puff = document.createElement('a-sphere');
      puff.setAttribute('radius', '0.15');
      puff.setAttribute('position', '0 0.16 0');
      puff.setAttribute('color', color);
      puff.setAttribute('material', `emissive:${color}; emissiveIntensity:0.5; opacity:0.9`);
      wrap.appendChild(puff);

      const puff2 = document.createElement('a-sphere');
      puff2.setAttribute('radius', '0.09');
      puff2.setAttribute('position', '-0.16 0.17 0.02');
      puff2.setAttribute('color', color);
      puff2.setAttribute('material', `emissive:${color}; emissiveIntensity:0.45; opacity:0.88`);
      wrap.appendChild(puff2);

      const puff3 = document.createElement('a-sphere');
      puff3.setAttribute('radius', '0.08');
      puff3.setAttribute('position', '0.15 0.18 0.04');
      puff3.setAttribute('color', color);
      puff3.setAttribute('material', `emissive:${color}; emissiveIntensity:0.45; opacity:0.88`);
      wrap.appendChild(puff3);

      const ring = document.createElement('a-ring');
      ring.setAttribute('radiusInner', '0.22');
      ring.setAttribute('radiusOuter', '0.29');
      ring.setAttribute('rotation', '-90 0 0');
      ring.setAttribute('position', '0 -0.01 0');
      ring.setAttribute('color', '#ffffff');
      ring.setAttribute('material', 'shader:flat; opacity:0.92');
      wrap.appendChild(ring);
    } else {
      const core = document.createElement('a-sphere');
      core.setAttribute('radius', '0.14');
      core.setAttribute('position', '0 0.14 0');
      core.setAttribute('color', color);
      core.setAttribute('material', `emissive:${color}; emissiveIntensity:0.6; opacity:0.95`);
      wrap.appendChild(core);

      const n1 = document.createElement('a-sphere');
      n1.setAttribute('radius', '0.07');
      n1.setAttribute('position', '0.14 0.20 0.03');
      n1.setAttribute('color', color);
      n1.setAttribute('material', `emissive:${color}; emissiveIntensity:0.45; opacity:0.92`);
      wrap.appendChild(n1);

      const n2 = document.createElement('a-sphere');
      n2.setAttribute('radius', '0.06');
      n2.setAttribute('position', '-0.13 0.17 -0.02');
      n2.setAttribute('color', color);
      n2.setAttribute('material', `emissive:${color}; emissiveIntensity:0.45; opacity:0.92`);
      wrap.appendChild(n2);

      const ring = document.createElement('a-ring');
      ring.setAttribute('radiusInner', '0.20');
      ring.setAttribute('radiusOuter', '0.27');
      ring.setAttribute('rotation', '-90 0 0');
      ring.setAttribute('position', '0 -0.01 0');
      ring.setAttribute('color', '#ffffff');
      ring.setAttribute('material', 'shader:flat; opacity:0.92');
      wrap.appendChild(ring);
    }

    const label = document.createElement('a-text');
    label.setAttribute('value', def.shortLabel || def.label);
    label.setAttribute('align', 'center');
    label.setAttribute('color', '#ffffff');
    label.setAttribute('width', '3.2');
    label.setAttribute('position', '0 0.42 0');
    wrap.appendChild(label);

    wrap.setAttribute(
      'animation__float',
      'property: position; dir: alternate; dur: 820; loop: true; to: 0 0.04 0'
    );

    wrap.addEventListener('click', () => onHazardClicked(hazardId));
    return wrap;
  }

  function spawnHazard(type, spotId, source = 'wave') {
    if (!state.active) return null;
    if (activeHazardCount() >= diffCfg.maxConcurrent && source !== 'boss') return null;

    const def = getHazardDef(type);
    const safeView = query.view === 'cvr' ? 'mobile' : query.view;
    const spot = getSpot(safeView, spotId);
    const id = makeId(type);

    const entityWrap = document.createElement('a-entity');
    entityWrap.setAttribute('position', `${spot.x} ${spot.y} ${spot.z}`);

    const visual = buildHazardVisual(type, id);
    entityWrap.appendChild(visual);
    hazardRoot.appendChild(entityWrap);

    const now = performance.now();
    const hz = {
      id,
      type,
      spotId,
      source,
      def,
      el: entityWrap,
      bornAt: now,
      spreadAt: now + (def.spreadDelayMs * diffCfg.spreadMultiplier),
      expireAt: now + def.expireMs,
      spreadCount: 0,
      state: 'active'
    };

    state.hazards.set(id, hz);
    return hz;
  }

  function despawnHazard(hz) {
    hz.state = 'gone';
    if (hz.el && hz.el.parentNode) hz.el.parentNode.removeChild(hz.el);
    state.hazards.delete(hz.id);
  }

  function clearHazard(hz, correct = true) {
    if (!hz || hz.state !== 'active') return;

    if (hz.el) {
      hz.el.setAttribute('animation__gone', 'property: scale; to: 0.01 0.01 0.01; dur: 180; easing: easeInBack');
    }

    setTimeout(() => {
      despawnHazard(hz);
    }, 200);

    if (correct) {
      state.cleared += 1;
      if (hz.source === 'boss') state.bossClears += 1;
    }
  }

  function punishSpread(hz, source = 'spread') {
    state.infection = clamp(state.infection + hz.def.infectionOnSpread, 0, 100);
    state.combo = 0;
    showFeedback(hz.def.feedback?.bad || 'เชื้อกำลังแพร่เพิ่ม', 'bad');
    flashDamage();

    if (source === 'miss') {
      state.missed += 1;
    }
  }

  function handleSpread(hz) {
    if (!hz || hz.state !== 'active') return;

    hz.spreadCount += 1;
    punishSpread(hz, 'spread');

    if (hz.type === 'raw_spill') {
      if (hz.el) hz.el.setAttribute('scale', '1.35 1.35 1.35');
    } else if (hz.type === 'sneeze_cloud') {
      const newSpot = randomFreeSpotId();
      spawnHazard('sneeze_cloud', newSpot, hz.source);
      clearHazard(hz, false);
      return;
    } else if (hz.type === 'mold_food') {
      const newSpot = randomFreeSpotId();
      spawnHazard('raw_spill', newSpot, hz.source);
    }

    hz.spreadAt = performance.now() + (hz.def.spreadDelayMs * 1.35 * diffCfg.spreadMultiplier);
  }

  function markMissed(hz) {
    if (!hz || hz.state !== 'active') return;
    state.infection = clamp(state.infection + hz.def.infectionOnMiss, 0, 100);
    state.combo = 0;
    state.missed += 1;
    showFeedback(hz.def.feedback?.bad || 'พลาดแล้ว เชื้อแพร่เพิ่ม', 'bad');
    flashDamage();
    clearHazard(hz, false);
  }

  function onHazardClicked(hazardId) {
    if (!state.active) return;
    const hz = state.hazards.get(hazardId);
    if (!hz || hz.state !== 'active') return;

    const correct = isCorrectTool(hz.type, state.selectedTool);

    if (correct) {
      const tool = getToolDef(state.selectedTool);
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.score += (hz.def.score || 100) + (tool.scoreBonus || 50) + Math.max(0, state.combo - 1) * 20;
      state.infection = clamp(state.infection - (8 + Math.floor(tool.spreadBlock * 10)), 0, 100);

      showFeedback(hz.def.feedback?.good || 'จัดการสำเร็จ', 'good');
      showComboChip();
      clearHazard(hz, true);
    } else {
      state.combo = 0;
      state.wrongTool += 1;
      state.score = Math.max(0, state.score - 20);
      state.infection = clamp(state.infection + 8, 0, 100);
      showFeedback(`ไม่ใช่ ${getToolDef(state.selectedTool).shortLabel} สำหรับ ${hz.def.shortLabel}`, 'bad');
      flashDamage();
    }

    updateHUD();
    checkLose();
  }

  function enterPhase(index) {
    state.phaseIndex = index;
    state.phase = phasePlan[index]?.id || 'summary';
    state.phaseStartedAt = performance.now();
    state.phaseEventCursor = 0;
    state.scheduledEvents = [];

    const phaseId = state.phase;

    if (phaseId === 'wave1' || phaseId === 'wave2' || phaseId === 'final_rush') {
      state.scheduledEvents = getWaveScript(query.diff, phaseId);
      state.bossActive = false;
      setPrompt(UI_TEXT.promptDefault);
    } else if (phaseId === 'boss') {
      state.bossActive = true;
      state.bossTotal = bossCfg.pattern.length;
      state.bossClears = 0;
      state.scheduledEvents = bossCfg.pattern.map((e) => ({ ...e }));
      setPrompt(UI_TEXT.promptBoss);
    } else if (phaseId === 'intro') {
      setPrompt(UI_TEXT.introShort);
    }

    updateHUD();
  }

  function nextPhase() {
    const nextIndex = state.phaseIndex + 1;
    if (nextIndex >= phasePlan.length || phasePlan[nextIndex].id === 'summary') {
      finishRun(state.infection < 100);
      return;
    }

    if (state.phase === 'boss') {
      if (state.bossClears >= state.bossTotal) {
        state.bossCleared = true;
        state.score += bossCfg.scoreBonus;
        state.infection = clamp(state.infection - bossCfg.infectionRewardOnClear, 0, 100);
        showFeedback(bossCfg.successText, 'good');
      } else {
        state.bossCleared = false;
        state.infection = clamp(state.infection + bossCfg.infectionPenaltyOnFail, 0, 100);
        showFeedback(bossCfg.failText, 'bad');
        flashDamage();
      }
    }

    enterPhase(nextIndex);
    checkLose();
  }

  function updatePhaseSpawns(now) {
    const elapsed = now - state.phaseStartedAt;
    while (state.phaseEventCursor < state.scheduledEvents.length) {
      const event = state.scheduledEvents[state.phaseEventCursor];
      if (elapsed < event.t) break;

      spawnHazard(event.type, event.spot, state.phase === 'boss' ? 'boss' : 'wave');
      state.phaseEventCursor += 1;
    }
  }

  function updateHazards(now) {
    for (const hz of [...state.hazards.values()]) {
      if (hz.state !== 'active') continue;

      if (now >= hz.expireAt) {
        markMissed(hz);
        continue;
      }

      if (now >= hz.spreadAt) {
        handleSpread(hz);
      }
    }
  }

  function checkLose() {
    if (state.infection >= diffCfg.infectionLoseAt) {
      finishRun(false);
    }
  }

  function finishRun(win) {
    if (!state.active) return;

    state.active = false;
    state.endedAt = performance.now();

    cancelAnimationFrame(state.raf);

    for (const hz of [...state.hazards.values()]) {
      despawnHazard(hz);
    }

    const summary = buildSummarySnapshot({
      score: state.score,
      hp: state.hp,
      infection: state.infection,
      cleared: state.cleared,
      missed: state.missed,
      wrongTool: state.wrongTool,
      bestCombo: state.bestCombo,
      bossCleared: !!state.bossCleared
    });

    try {
      localStorage.setItem('HHA_LAST_GERM_RUSH_SUMMARY', JSON.stringify({
        ...summary,
        diff: query.diff,
        view: query.view,
        hub: query.hub || '',
        patch: GAME_META.gameId
      }));
    } catch (_) {}

    if (ui.summaryTitle) {
      ui.summaryTitle.textContent = win ? 'Mission Clear!' : 'Mission Incomplete';
      ui.summaryTitle.style.color = win ? '#86ffb2' : '#ff9aa5';
    }

    if (ui.summarySub) {
      ui.summarySub.textContent = win
        ? 'คุณหยุดการแพร่เชื้อได้ดีมาก'
        : 'ยังมีการแพร่เชื้อเกินควบคุมในรอบนี้';
    }

    if (ui.starsText) {
      ui.starsText.textContent =
        summary.stars === 3 ? '⭐ ⭐ ⭐' :
        summary.stars === 2 ? '⭐ ⭐' : '⭐';
    }

    if (ui.sumScore) ui.sumScore.textContent = summary.score;
    if (ui.sumCombo) ui.sumCombo.textContent = summary.bestCombo;
    if (ui.sumCleared) ui.sumCleared.textContent = summary.cleared;
    if (ui.sumWrong) ui.sumWrong.textContent = summary.wrongTool;
    if (ui.sumInfection) ui.sumInfection.textContent = summary.infection;
    if (ui.sumBadge) ui.sumBadge.textContent = summary.badge;

    if (ui.adviceList) {
      ui.adviceList.innerHTML = '';
      summary.advice.forEach((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        ui.adviceList.appendChild(li);
      });
    }

    if (ui.summaryOverlay) ui.summaryOverlay.classList.add('is-open');
  }

  function update(now) {
    if (!state.active) return;

    state.timeLeftMs = Math.max(0, state.roundMs - (now - state.startedAt));
    updateHUD();

    const phaseCfg = phasePlan[state.phaseIndex];
    if (phaseCfg && phaseCfg.id !== 'summary') {
      const phaseElapsed = now - state.phaseStartedAt;
      updatePhaseSpawns(now);
      updateHazards(now);

      if (phaseElapsed >= phaseCfg.ms) {
        nextPhase();
      }
    }

    checkLose();

    if (state.active) {
      state.raf = requestAnimationFrame(update);
    }
  }

  function resetRunState() {
    cancelAnimationFrame(state.raf);

    for (const hz of [...state.hazards.values()]) {
      despawnHazard(hz);
    }

    state.active = false;
    state.phaseIndex = 0;
    state.phase = phasePlan[0]?.id || 'intro';
    state.phaseStartedAt = 0;
    state.startedAt = 0;
    state.endedAt = 0;
    state.timeLeftMs = state.roundMs;

    state.selectedTool = 'wipe';

    state.score = 0;
    state.hp = 100;
    state.infection = diffCfg.infectionStart;
    state.combo = 0;
    state.bestCombo = 0;
    state.cleared = 0;
    state.missed = 0;
    state.wrongTool = 0;

    state.bossActive = false;
    state.bossCleared = false;
    state.bossTotal = 0;
    state.bossClears = 0;

    state.scheduledEvents = [];
    state.phaseEventCursor = 0;

    syncToolBar();
    updateHUD();
    setPrompt(UI_TEXT.promptDefault);

    if (ui.summaryOverlay) ui.summaryOverlay.classList.remove('is-open');
    if (ui.startOverlay) ui.startOverlay.classList.remove('is-open');
  }

  function startRun() {
    resetRunState();

    state.active = true;
    state.startedAt = performance.now();
    enterPhase(0);

    if (ui.startOverlay) ui.startOverlay.classList.remove('is-open');
    state.raf = requestAnimationFrame(update);
  }

  function bindUI() {
    makeToolBar();
    selectTool('wipe');
    updateHUD();
    setPrompt(UI_TEXT.promptDefault);

    if (ui.startTitle) ui.startTitle.textContent = UI_TEXT.introTitle;
    if (ui.startSub) ui.startSub.textContent = UI_TEXT.introShort;

    if (query.hub) {
      if (ui.backHubBtn) {
        ui.backHubBtn.style.display = 'inline-flex';
        ui.backHubBtn.onclick = () => location.href = query.hub;
      }
      if (ui.summaryHubBtn) {
        ui.summaryHubBtn.style.display = 'inline-flex';
        ui.summaryHubBtn.onclick = () => location.href = query.hub;
      }
    }

    if (ui.startBtn) ui.startBtn.addEventListener('click', startRun);
    if (ui.replayBtn) ui.replayBtn.addEventListener('click', startRun);

    keydownBound = (e) => {
      if (e.key === '1') selectTool('wipe');
      if (e.key === '2') selectTool('spray');
      if (e.key === '3') selectTool('trash');
    };
    document.addEventListener('keydown', keydownBound);
  }

  function unbindUI() {
    if (keydownBound) {
      document.removeEventListener('keydown', keydownBound);
      keydownBound = null;
    }
  }

  function mount() {
    if (isMounted) return api;
    isMounted = true;
    bindUI();
    return api;
  }

  function destroy() {
    cancelAnimationFrame(state.raf);

    for (const hz of [...state.hazards.values()]) {
      despawnHazard(hz);
    }

    unbindUI();
    isMounted = false;
  }

  const api = {
    mount,
    destroy,
    start: startRun,
    selectTool,
    getState: () => ({ ...state }),
    getQuery: () => ({ ...query }),
    getDiffConfig: () => ({ ...diffCfg })
  };

  return api;
}