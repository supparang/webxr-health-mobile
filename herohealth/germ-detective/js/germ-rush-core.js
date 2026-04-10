// /herohealth/germ-detective/js/germ-rush-core.js
// Germ Detective: Outbreak Rush
// MAIN GAME CORE MODULE
// PATCH v20260410c-germ-rush-core-ui-split

import {
  GAME_META,
  TOOLS,
  UI_TEXT,
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

import {
  createGermRushUI
} from './germ-rush-ui.js';

export function createGermRushGame({ query, ui, refs }) {
  const hazardRoot = refs.hazardRoot;
  const diffCfg = getDifficultyConfig(query.diff);
  const phasePlan = getPhasePlan(query.diff);
  const bossCfg = getBossConfig('cross_contam');

  const uiLayer = createGermRushUI({ ui, query });

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

  function refreshHUD() {
    const bossPct = state.bossTotal > 0
      ? (state.bossClears / state.bossTotal) * 100
      : 0;

    uiLayer.updateHUD({
      infection: state.infection,
      score: state.score,
      combo: state.combo,
      wrongTool: state.wrongTool,
      phaseLabel: phasePlan[state.phaseIndex]?.label || state.phase || 'READY',
      timeLeftMs: state.timeLeftMs,
      bossPct
    });
  }

  function setPrompt(text) {
    uiLayer.setPrompt(text);
  }

  function selectTool(toolId) {
    if (!TOOLS[toolId]) return;
    state.selectedTool = toolId;
    uiLayer.syncToolButtons(toolId);
    setPrompt(`${UI_TEXT.toolSelectedPrefix} ${getToolDef(toolId).label}`);
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
    uiLayer.showFeedback(hz.def.feedback?.bad || 'เชื้อกำลังแพร่เพิ่ม', 'bad');
    uiLayer.flashDamage();

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
    uiLayer.showFeedback(hz.def.feedback?.bad || 'พลาดแล้ว เชื้อแพร่เพิ่ม', 'bad');
    uiLayer.flashDamage();
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

      uiLayer.showFeedback(hz.def.feedback?.good || 'จัดการสำเร็จ', 'good');
      uiLayer.showCombo(state.combo);
      clearHazard(hz, true);
    } else {
      state.combo = 0;
      state.wrongTool += 1;
      state.score = Math.max(0, state.score - 20);
      state.infection = clamp(state.infection + 8, 0, 100);
      uiLayer.showFeedback(`ไม่ใช่ ${getToolDef(state.selectedTool).shortLabel} สำหรับ ${hz.def.shortLabel}`, 'bad');
      uiLayer.flashDamage();
    }

    refreshHUD();
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

    refreshHUD();
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
        uiLayer.showFeedback(bossCfg.successText, 'good');
      } else {
        state.bossCleared = false;
        state.infection = clamp(state.infection + bossCfg.infectionPenaltyOnFail, 0, 100);
        uiLayer.showFeedback(bossCfg.failText, 'bad');
        uiLayer.flashDamage();
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

    uiLayer.showSummary({ win, summary });
  }

  function update(now) {
    if (!state.active) return;

    state.timeLeftMs = Math.max(0, state.roundMs - (now - state.startedAt));
    refreshHUD();

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

    uiLayer.syncToolButtons(state.selectedTool);
    refreshHUD();
    setPrompt(UI_TEXT.promptDefault);
    uiLayer.hideSummary();
    uiLayer.hideStart();
  }

  function startRun() {
    resetRunState();

    state.active = true;
    state.startedAt = performance.now();
    enterPhase(0);

    uiLayer.hideStart();
    state.raf = requestAnimationFrame(update);
  }

  function bindUI() {
    uiLayer.applyIntroText();
    uiLayer.renderToolBar(selectTool);
    uiLayer.syncToolButtons(state.selectedTool);
    uiLayer.bindStaticButtons({
      onStart: startRun,
      onReplay: startRun,
      onGoHub: () => {
        if (query.hub) location.href = query.hub;
      }
    });

    keydownBound = (e) => {
      if (e.key === '1') selectTool('wipe');
      if (e.key === '2') selectTool('spray');
      if (e.key === '3') selectTool('trash');
    };
    document.addEventListener('keydown', keydownBound);

    refreshHUD();
    setPrompt(UI_TEXT.promptDefault);
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