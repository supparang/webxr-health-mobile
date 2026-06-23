// === /sgnal-hunt/js/uxq-w1-diversity-v10-4.js ===
// UX Quest • W1 UX Detective • Diversity Game Engine V10
// Keeps the same learning loop, but rotates six different investigation formats.

(function () {
  'use strict';

  console.info('[UXQ W1 V10.4] Clean storage + completion layout engine loaded');

  const DATA = window.UXQ_W1_DIVERSITY_V10 || {};
  const BRIDGE = window.UXQProgressV9 || null;
  const TYPES = Array.isArray(DATA.TYPES) ? DATA.TYPES : [];
  const CORES = Array.isArray(DATA.REPLAY_CORES) ? DATA.REPLAY_CORES : [];
  const TUTORIAL = Array.isArray(DATA.TUTORIAL_CASES) ? DATA.TUTORIAL_CASES : [];
  const TYPE_META = DATA.TYPE_META || {};
  const BALANCED_REPLAY_SCHEDULE = Array.isArray(DATA.BALANCED_REPLAY_SCHEDULE)
    ? DATA.BALANCED_REPLAY_SCHEDULE
    : [];

  const CONTENT_KEY = 'csai2601-uxquest-w1-diversity-v10';
  const SESSION_KEY = 'csai2601-uxquest-w1-diversity-session-v10';
  const ROUND_SIZE = 5;
  const $ = (selector) => document.querySelector(selector);

  const stage = $('#gameStage');
  const feedbackDialog = $('#feedbackDialog');
  const feedbackContent = $('#feedbackContent');
  const howDialog = $('#howDialog');

  const CORE_BY_ID = new Map(CORES.map((item) => [item.id, item]));
  TUTORIAL.forEach((item) => CORE_BY_ID.set(item.id, item));

  let progress = freshProgress();
  let state = freshState();

  /*
    V10.3 storage policy:
    - The in-progress round belongs in sessionStorage only.
    - Old V10 localStorage session snapshots are removed once because they can
      be oversized/corrupted from prior builds and block every subsequent write.
    - If browser storage is unavailable, the game still runs in memory; only
      refresh/resume is unavailable for that one unfinished round.
  */
  let sessionStorageUnavailable = false;
  let progressStorageUnavailable = false;

  function freshProgress() {
    return {
      version: 10,
      tutorialComplete: false,
      tutorialBestStars: 0,
      bestStars: 0,
      bestScore: 0,
      totalRounds: 0,
      replayWins: 0,
      challengeWins: 0,
      replayCycle: {
        cycle: 1,
        roundsInCycle: 0,
        seenCoreIds: []
      },
      recentContextIds: [],
      typeStats: {},
      /* V10.4 intentionally persists no full round history.
         The replay scheduler only needs the compact fields above. */
      roundHistory: []
    };
  }

  function freshState() {
    return {
      mode: null,
      caseIds: [],
      caseIndex: 0,
      step: 0,
      score: 0,
      stability: 100,
      selectedObserve: [],
      selectedDiagnosis: null,
      orders: {},
      selectedFix: null,
      selectedExplain: [],
      attempts: 0,
      answers: [],
      startedAt: Date.now(),
      complete: false
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(input) {
    return String(input).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
  }

  function safeParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; }
    catch (error) { return fallback; }
  }

  function canonicalW1() {
    if (BRIDGE && typeof BRIDGE.readW1 === 'function') {
      return BRIDGE.readW1();
    }
    return { cleared: false, stars: 0, score: 0, rounds: 0, tutorialComplete: false };
  }

  function compactProgressSnapshot() {
    return {
      version: 10.4,
      tutorialComplete: Boolean(progress.tutorialComplete),
      tutorialBestStars: Number(progress.tutorialBestStars) || 0,
      bestStars: Number(progress.bestStars) || 0,
      bestScore: Number(progress.bestScore) || 0,
      totalRounds: Number(progress.totalRounds) || 0,
      replayWins: Number(progress.replayWins) || 0,
      challengeWins: Number(progress.challengeWins) || 0,
      replayCycle: {
        cycle: Number(progress.replayCycle?.cycle) || 1,
        roundsInCycle: Number(progress.replayCycle?.roundsInCycle) || 0,
        seenCoreIds: Array.isArray(progress.replayCycle?.seenCoreIds)
          ? progress.replayCycle.seenCoreIds.slice(-60)
          : []
      },
      recentContextIds: Array.isArray(progress.recentContextIds)
        ? progress.recentContextIds.slice(-10)
        : [],
      typeStats: progress.typeStats && typeof progress.typeStats === 'object'
        ? progress.typeStats
        : {},
      /* Full completed-round logs caused quota failures in older builds. */
      roundHistory: []
    };
  }

  function saveProgress() {
    if (progressStorageUnavailable) return false;

    try {
      localStorage.setItem(CONTENT_KEY, JSON.stringify(compactProgressSnapshot()));
      return true;
    } catch (error) {
      /* Keep the round playable even when another app on this origin uses storage. */
      progressStorageUnavailable = true;
      return false;
    }
  }

  function sessionSnapshot() {
    /* Save only primitives needed to resume the current round. */
    return {
      version: '10.4',
      mode: state.mode,
      caseIds: Array.isArray(state.caseIds) ? [...state.caseIds] : [],
      caseIndex: Number(state.caseIndex) || 0,
      step: Number(state.step) || 0,
      score: Number(state.score) || 0,
      stability: Number(state.stability) || 100,
      selectedObserve: Array.isArray(state.selectedObserve) ? [...state.selectedObserve] : [],
      selectedDiagnosis: state.selectedDiagnosis || null,
      selectedFix: state.selectedFix || null,
      selectedExplain: Array.isArray(state.selectedExplain) ? [...state.selectedExplain] : [],
      attempts: Number(state.attempts) || 0,
      answers: Array.isArray(state.answers) ? state.answers.slice(-5) : [],
      orders: state.orders && typeof state.orders === 'object' ? state.orders : {},
      startedAt: Number(state.startedAt) || Date.now(),
      complete: Boolean(state.complete)
    };
  }

  function saveSession() {
    if (sessionStorageUnavailable) return false;

    const payload = JSON.stringify(sessionSnapshot());

    try {
      sessionStorage.setItem(SESSION_KEY, payload);
      return true;
    } catch (error) {
      /*
        Storage quota must never freeze the learning loop. The round continues
        in memory, and only page-refresh resume is disabled.
      */
      sessionStorageUnavailable = true;
      return false;
    }
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); }
    catch (error) { /* noop */ }

    /* Remove the oversized legacy local snapshot, not W1 progress. */
    try { localStorage.removeItem(SESSION_KEY); }
    catch (error) { /* noop */ }
  }

  function discardLegacyLocalSession() {
    try { localStorage.removeItem(SESSION_KEY); }
    catch (error) { /* noop */ }
  }

  function cleanupLegacyW1Storage() {
    /*
      V10.2 saved a very large unfinished round under this exact key.
      Remove only UX Quest W1 transient snapshots; never delete other course apps.
    */
    const transientKeys = [
      SESSION_KEY,
      'csai2601-uxquest-w1-diversity-session-v10-2',
      'csai2601-uxquest-w1-diversity-session-v10-3'
    ];

    transientKeys.forEach((key) => {
      try { localStorage.removeItem(key); } catch (error) { /* noop */ }
      try { sessionStorage.removeItem(key); } catch (error) { /* noop */ }
    });

    /*
      If an old V10 progress snapshot itself is abnormally large, discard only
      that replay cache. Canonical W1 pass state remains in uxq-progress-v9.
    */
    try {
      const raw = localStorage.getItem(CONTENT_KEY);
      if (raw && raw.length > 16000) {
        localStorage.removeItem(CONTENT_KEY);
      }
    } catch (error) { /* noop */ }
  }

  function loadProgress() {
    const saved = safeParse(localStorage.getItem(CONTENT_KEY), null);
    if (saved && typeof saved === 'object') {
      progress = {
        ...freshProgress(),
        ...saved,
        replayCycle: { ...freshProgress().replayCycle, ...(saved.replayCycle || {}) },
        typeStats: saved.typeStats || {},
        roundHistory: Array.isArray(saved.roundHistory) ? saved.roundHistory : [],
        recentContextIds: Array.isArray(saved.recentContextIds) ? saved.recentContextIds : []
      };
    }

    const canonical = canonicalW1();
    if (canonical.cleared) {
      progress.tutorialComplete = true;
      progress.tutorialBestStars = Math.max(progress.tutorialBestStars, canonical.stars || 1);
      progress.bestStars = Math.max(progress.bestStars, canonical.stars || 1);
      progress.bestScore = Math.max(progress.bestScore, canonical.score || 0);
    }
    saveProgress();
  }

  function loadSession() {
    let saved = null;

    try {
      saved = safeParse(sessionStorage.getItem(SESSION_KEY), null);
    } catch (error) {
      sessionStorageUnavailable = true;
    }

    if (!saved || !saved.mode || !Array.isArray(saved.caseIds) || !saved.caseIds.length || saved.complete) {
      return;
    }

    const validIds = saved.caseIds.filter((id) => CORE_BY_ID.has(id));
    if (!validIds.length) return;

    state = {
      ...freshState(),
      ...saved,
      caseIds: validIds,
      caseIndex: clamp(Number(saved.caseIndex) || 0, 0, validIds.length - 1),
      step: clamp(Number(saved.step) || 0, 0, 4),
      selectedObserve: Array.isArray(saved.selectedObserve) ? saved.selectedObserve : [],
      selectedExplain: Array.isArray(saved.selectedExplain) ? saved.selectedExplain : [],
      answers: Array.isArray(saved.answers) ? saved.answers : [],
      orders: saved.orders || buildOrders(validIds)
    };
  }

  function current() {
    return CORE_BY_ID.get(state.caseIds[state.caseIndex]) || null;
  }

  function buildOrders(caseIds) {
    const orders = {};
    caseIds.forEach((id) => {
      const core = CORE_BY_ID.get(id);
      if (!core) return;
      orders[id] = {
        observe: shuffled(core.observe.options.map((option) => option.id)),
        diagnosis: shuffled(core.diagnosis.options.map((option) => option.id)),
        fix: shuffled(core.fix.options.map((option) => option.id)),
        explain: shuffled(core.explain.choices)
      };
    });
    return orders;
  }

  function ordered(core, part, items, idKey = 'id') {
    const order = state.orders?.[core.id]?.[part];
    if (!Array.isArray(order) || order.length !== items.length) return items;
    const keyOf = typeof idKey === 'function' ? idKey : (item) => item[idKey];
    const byId = new Map(items.map((item) => [keyOf(item), item]));
    return order.map((id) => byId.get(id)).filter(Boolean);
  }

  function shuffled(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function modeMeta() {
    const map = {
      tutorial: { label: 'Tutorial', badge: 'FOUNDATION' },
      replay: { label: 'Random Replay', badge: 'PRACTICE' },
      challenge: { label: 'Transfer Challenge', badge: 'MASTERY' }
    };
    return map[state.mode] || { label: 'W1', badge: 'FOUNDATION' };
  }

  function typeName(type) {
    return TYPE_META[type]?.short || type;
  }

  function tutorialCoreIds() {
    return new Set(TUTORIAL.map((item) => item.id));
  }

  function roundNumber() {
    return (progress.replayCycle.roundsInCycle || 0) + 1;
  }

  function resetReplayCycle() {
    progress.replayCycle = {
      cycle: (progress.replayCycle.cycle || 1) + 1,
      roundsInCycle: 0,
      seenCoreIds: []
    };
  }

  function chooseCoreForType(type, excluded, currentRound) {
    const seen = new Set(progress.replayCycle.seenCoreIds || []);
    const tutorialIds = tutorialCoreIds();
    const earlyReplay = roundNumber() <= 3;

    let candidates = CORES.filter((core) =>
      core.type === type &&
      !seen.has(core.id) &&
      !excluded.has(core.id) &&
      !(earlyReplay && tutorialIds.has(core.id))
    );

    if (!candidates.length) {
      candidates = CORES.filter((core) =>
        core.type === type &&
        !seen.has(core.id) &&
        !excluded.has(core.id)
      );
    }

    const avoidContexts = new Set(progress.recentContextIds || []);
    const freshContext = candidates.filter((core) => !avoidContexts.has(core.contextId));
    if (freshContext.length) candidates = freshContext;

    // Challenge mode biases toward weak formats without forcing a repeated core.
    if (state.mode === 'challenge') {
      candidates.sort((a, b) => typeAverage(a.type) - typeAverage(b.type));
      const lowBand = candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2)));
      candidates = lowBand;
    }

    return shuffled(candidates)[0] || null;
  }

  function buildReplayRound(mode) {
    if ((progress.replayCycle.seenCoreIds || []).length >= CORES.length) {
      resetReplayCycle();
    }

    const roundIndex = (progress.replayCycle.roundsInCycle || 0);
    const seen = new Set(progress.replayCycle.seenCoreIds || []);

    /*
      Preferred schedule: 12 rounds × 5 cases = 60 Core Cases exactly once.
      Each scheduled round uses five different formats and five different contexts.
      This is stronger than a random draw because it proves no core repetition
      within Cycle 1–12 instead of only hoping the random picker avoids it.
    */
    const scheduledRound = BALANCED_REPLAY_SCHEDULE.length
      ? BALANCED_REPLAY_SCHEDULE[
          roundIndex % BALANCED_REPLAY_SCHEDULE.length
        ]
      : null;

    if (Array.isArray(scheduledRound)) {
      const scheduled = scheduledRound
        .map(({ type, contextId }) => CORES.find((core) => (
          core.type === type &&
          core.contextId === contextId &&
          !seen.has(core.id)
        )))
        .filter(Boolean);

      if (scheduled.length === ROUND_SIZE) {
        if (mode === 'challenge') {
          return scheduled
            .sort((a, b) => typeAverage(a.type) - typeAverage(b.type))
            .map((core) => core.id);
        }

        return shuffled(scheduled).map((core) => core.id);
      }
    }

    /* Safe fallback for a missing/corrupted schedule. */
    const omissionIndex = roundIndex % TYPES.length;
    const omittedType = TYPES[omissionIndex];
    const selectedTypes = shuffled(TYPES.filter((type) => type !== omittedType));
    const selectedIds = [];
    const excluded = new Set();
    const usedContexts = new Set();

    selectedTypes.forEach((type) => {
      const candidates = CORES.filter((core) => (
        core.type === type &&
        !seen.has(core.id) &&
        !excluded.has(core.id) &&
        !usedContexts.has(core.contextId)
      ));

      const core = shuffled(candidates)[0] || chooseCoreForType(type, excluded, selectedIds);

      if (core) {
        selectedIds.push(core.id);
        excluded.add(core.id);
        usedContexts.add(core.contextId);
      }
    });

    return selectedIds.slice(0, ROUND_SIZE);
  }

  function challengeUnlocked() {
    return progress.tutorialBestStars >= 2 || progress.replayWins >= 1;
  }

  function startRound(mode) {
    if (mode === 'replay' && !progress.tutorialComplete) return;
    if (mode === 'challenge' && !challengeUnlocked()) return;

    let caseIds = [];
    if (mode === 'tutorial') {
      caseIds = TUTORIAL.map((item) => item.id);
    } else {
      state.mode = mode;
      caseIds = buildReplayRound(mode);
    }

    if (!caseIds.length) return;

    state = {
      ...freshState(),
      mode,
      caseIds,
      orders: buildOrders(caseIds),
      startedAt: Date.now()
    };

    saveSession();
    render();
    scrollTop();
  }

  function updateHud() {
    const active = Boolean(state.mode && state.caseIds.length && !state.complete);
    $('#caseValue').textContent = active
      ? `${modeMeta().label} ${state.caseIndex + 1}/${state.caseIds.length}`
      : 'เลือกโหมด';
    $('#scoreValue').textContent = active ? state.score : progress.bestScore || 0;
    $('#stabilityValue').textContent = active ? state.stability : 100;
    $('#resetBtn').textContent = active ? 'ออกจากรอบ' : 'ล้าง Replay';
  }

  function updateRail() {
    const active = Boolean(state.mode && state.caseIds.length && !state.complete);
    document.querySelectorAll('#phaseRail .phase').forEach((node, index) => {
      node.classList.toggle('active', active && index === state.step);
      node.classList.toggle('done', active && index < state.step);
    });
  }

  function showFeedback({ title, good, message, principle, nextLabel = 'ลองอีกครั้ง' }) {
    feedbackContent.innerHTML = `
      <p class="eyebrow">CASE FEEDBACK</p>
      <h2>${escapeHtml(title)}</h2>
      <div class="verdict ${good ? 'good' : 'retry'}">${good ? '✓ วิเคราะห์ได้ตรงประเด็น' : '↻ ลองย้อนดู User Goal อีกครั้ง'}</div>
      <p>${escapeHtml(message)}</p>
      ${principle && state.mode !== 'challenge' ? `<div class="principle-card"><b>Focus</b><span>${escapeHtml(principle)}</span></div>` : ''}
      <button id="feedbackContinue" class="primary-btn full-btn" type="button">${escapeHtml(nextLabel)} →</button>
    `;
    feedbackDialog.showModal();

    /*
      This listener is intentionally attached to the dynamic button every time
      feedback is rendered. V10.2 created the button but never wired it, so
      “ลองอีกครั้ง” appeared clickable but could not close the dialog.
    */
    feedbackContent.querySelector('#feedbackContinue')?.addEventListener(
      'click',
      () => feedbackDialog.close(),
      { once: true }
    );
  }

  function penalty(points) {
    state.attempts += 1;
    state.stability = clamp(state.stability - points, 0, 100);
    saveSession();
  }

  function singleOption(option, selectedId, dataAttr = 'data-observe') {
    return `
      <button class="answer-option ${selectedId === option.id ? 'selected' : ''}" ${dataAttr}="${escapeHtml(option.id)}" type="button">
        <span class="radio-dot"></span>
        <span>${escapeHtml(option.label || option.text)}</span>
      </button>
    `;
  }

  function renderObserveWidget(core) {
    const observe = core.observe;
    const selected = new Set(state.selectedObserve);

    if (observe.kind === 'budget') {
      const spend = observe.options
        .filter((option) => selected.has(option.id))
        .reduce((sum, option) => sum + option.cost, 0);

      return `
        <div class="budget-bar"><span>Design Energy</span><b>${spend} / ${observe.budget}</b></div>
        <div class="budget-grid">
          ${ordered(core, 'observe', observe.options).map((option) => `
            <button class="budget-card ${selected.has(option.id) ? 'selected' : ''}" data-observe="${escapeHtml(option.id)}" type="button">
              <span class="budget-card__cost">${option.cost} EN</span>
              <strong>${escapeHtml(option.label)}</strong>
              <small>${selected.has(option.id) ? 'เลือกแล้ว' : 'แตะเพื่อเลือก'}</small>
            </button>
          `).join('')}
        </div>
        <p class="selection-note">เลือก ${selected.size}/${observe.required} วิธี • ใช้ได้ไม่เกิน ${observe.budget} Energy</p>
      `;
    }

    if (observe.kind === 'multi') {
      return `
        <div class="split-note">เลือก ${observe.required} ข้อที่เป็น UI symptom โดยตรง</div>
        <div class="answer-list">
          ${ordered(core, 'observe', observe.options).map((option) => `
            <button class="answer-option ${selected.has(option.id) ? 'selected' : ''}" data-observe="${escapeHtml(option.id)}" type="button">
              <span class="check-dot">${selected.has(option.id) ? '✓' : ''}</span>
              <span>${escapeHtml(option.label)}</span>
            </button>
          `).join('')}
        </div>
        <p class="selection-note">เลือกแล้ว ${selected.size}/${observe.required}</p>
      `;
    }

    return `<div class="answer-list">${ordered(core, 'observe', observe.options).map((option) => singleOption(option, state.selectedObserve[0])).join('')}</div>`;
  }

  function renderObserve() {
    const core = current();
    if (!core) return renderModeSelect();
    const observe = core.observe;
    const meta = TYPE_META[core.type] || {};

    stage.innerHTML = `
      <section class="case-layout diversity-layout">
        <article class="mission-card">
          <div class="case-kicker"><span>${escapeHtml(modeMeta().badge)}</span><span>${escapeHtml(meta.title || core.type)}</span><span>CASE ${state.caseIndex + 1}/${state.caseIds.length}</span></div>
          <h2>${escapeHtml(core.screenTitle || observe.title)}</h2>
          <div class="goal-card"><span>USER GOAL</span><b>${escapeHtml(observe.goal)}</b></div>
          <blockquote>${escapeHtml(observe.quote)}</blockquote>
          <p class="muted tiny"><b>ผู้ใช้:</b> ${escapeHtml(observe.persona)}</p>
          <div class="format-ribbon"><span>${escapeHtml(meta.icon || '•')}</span><b>${escapeHtml(meta.description || '')}</b></div>
          <h3 class="question-title">${escapeHtml(observe.question)}</h3>
          ${renderObserveWidget(core)}
          <button id="observeNext" class="primary-btn full-btn" type="button" ${state.selectedObserve.length ? '' : 'disabled'}>ยืนยันหลักฐาน →</button>
        </article>
        <aside class="investigation-panel">
          <p class="eyebrow">MISSION FORMAT</p>
          <h3>${escapeHtml(meta.title || core.type)}</h3>
          <p>${escapeHtml(meta.description || '')}</p>
          <div class="format-progress"><span>รอบนี้จะไม่ซ้ำรูปแบบภารกิจกับ Case อื่น</span><b>${escapeHtml(typeName(core.type))}</b></div>
          <div class="service-chip">${escapeHtml(core.service)}</div>
        </aside>
      </section>
    `;

    document.querySelectorAll('[data-observe]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.observe;
        const selected = new Set(state.selectedObserve);
        if (observe.kind === 'single') {
          state.selectedObserve = [id];
        } else {
          if (selected.has(id)) selected.delete(id);
          else if (selected.size < observe.required) selected.add(id);
          state.selectedObserve = Array.from(selected);
        }
        saveSession();
        renderObserve();
      });
    });

    $('#observeNext').addEventListener('click', () => {
      if (!state.selectedObserve.length) return;
      const selectedIds = new Set(state.selectedObserve);
      const correctIds = observe.options.filter((option) => option.correct).map((option) => option.id);
      const selectedCost = observe.options.filter((option) => selectedIds.has(option.id)).reduce((sum, option) => sum + (option.cost || 0), 0);
      const correct = selectedIds.size === correctIds.length && correctIds.every((id) => selectedIds.has(id)) && (!observe.budget || selectedCost <= observe.budget);

      if (!correct) {
        penalty(observe.kind === 'budget' ? 8 : 6);
        showFeedback({
          title: 'หลักฐานยังไม่ชี้ต้นเหตุ',
          good: false,
          message: 'ลองดูว่าอะไรขวาง User Goal โดยตรง ไม่ใช่สิ่งที่เพียงดูน่าสนใจหรือเพิ่มข้อมูล',
          principle: 'Prioritize the evidence that blocks task success'
        });
        feedbackDialog.addEventListener('close', () => {
          state.selectedObserve = [];
          saveSession();
          renderObserve();
        }, { once: true });
        return;
      }

      state.step = 1;
      saveSession();
      render();
      scrollTop();
    });
  }

  function answerList(core, part, options, selected, attr) {
    return `<div class="answer-list">${ordered(core, part, options).map((option) => `
      <button class="answer-option ${selected === option.id ? 'selected' : ''}" ${attr}="${escapeHtml(option.id)}" type="button">
        <span class="radio-dot"></span><span>${escapeHtml(option.text)}</span>
      </button>
    `).join('')}</div>`;
  }

  function renderDiagnose() {
    const core = current();
    stage.innerHTML = `
      <section class="single-layout"><article class="mission-card wide">
        <p class="eyebrow">DIAGNOSE • ${escapeHtml(typeName(core.type))}</p>
        <h2>เชื่อมสิ่งที่เห็นกับผลที่เกิดกับผู้ใช้</h2>
        <p class="evidence-detail">${escapeHtml(core.diagnosis.prompt)}</p>
        ${answerList(core, 'diagnosis', core.diagnosis.options, state.selectedDiagnosis, 'data-diagnosis')}
        <button id="diagnoseNext" class="primary-btn full-btn" type="button" ${state.selectedDiagnosis ? '' : 'disabled'}>ยืนยันการวิเคราะห์ →</button>
      </article></section>
    `;
    document.querySelectorAll('[data-diagnosis]').forEach((button) => button.addEventListener('click', () => {
      state.selectedDiagnosis = button.dataset.diagnosis;
      saveSession();
      renderDiagnose();
    }));
    $('#diagnoseNext').addEventListener('click', () => {
      const answer = core.diagnosis.options.find((option) => option.id === state.selectedDiagnosis);
      if (!answer?.correct) {
        penalty(5);
        showFeedback({ title: 'ยังไม่เชื่อม UI กับ UX', good: false, message: 'คำตอบที่ถูกต้องต้องอธิบายได้ว่าองค์ประกอบบนจอส่งผลต่อความสำเร็จของผู้ใช้อย่างไร', principle: core.diagnosis.correct });
        feedbackDialog.addEventListener('close', () => { state.selectedDiagnosis = null; saveSession(); renderDiagnose(); }, { once: true });
        return;
      }
      state.score += 20;
      state.step = 2;
      saveSession(); render(); scrollTop();
    });
  }

  function renderFix() {
    const core = current();
    stage.innerHTML = `
      <section class="single-layout"><article class="mission-card wide">
        <p class="eyebrow">DESIGN FIX • ${escapeHtml(typeName(core.type))}</p>
        <h2>ตัดสินใจว่าอะไรควรเริ่มทำก่อน</h2>
        <p class="evidence-detail">${escapeHtml(core.fix.prompt)}</p>
        ${answerList(core, 'fix', core.fix.options, state.selectedFix, 'data-fix')}
        <button id="fixNext" class="primary-btn full-btn" type="button" ${state.selectedFix ? '' : 'disabled'}>ทดสอบผลกับผู้ใช้ →</button>
      </article></section>
    `;
    document.querySelectorAll('[data-fix]').forEach((button) => button.addEventListener('click', () => {
      state.selectedFix = button.dataset.fix;
      saveSession(); renderFix();
    }));
    $('#fixNext').addEventListener('click', () => {
      const answer = core.fix.options.find((option) => option.id === state.selectedFix);
      if (!answer?.correct) {
        penalty(7);
        showFeedback({ title: 'แก้ที่ปลายเหตุ', good: false, message: 'ลองเลือกการแก้ที่ลดอุปสรรคต่อ User Goal ก่อนการเพิ่มความสวยงามหรือโยนภาระให้ผู้ใช้', principle: core.fix.options.find((option) => option.correct)?.text });
        feedbackDialog.addEventListener('close', () => { state.selectedFix = null; saveSession(); renderFix(); }, { once: true });
        return;
      }
      state.score += 25;
      state.step = 3;
      saveSession(); render(); scrollTop();
    });
  }

  function metric(label, before, after) {
    return `<div class="metric-card"><span>${escapeHtml(label)}</span><div><b class="before">${escapeHtml(before)}</b><i>→</i><b class="after">${escapeHtml(after)}</b></div></div>`;
  }

  function renderTest() {
    const core = current();
    const result = core.result;
    stage.innerHTML = `
      <section class="single-layout"><article class="mission-card wide">
        <p class="eyebrow">USER TEST • ${escapeHtml(typeName(core.type))}</p>
        <h2>ผลลัพธ์หลังแก้การออกแบบ</h2>
        <p>${escapeHtml(result.takeaway)}</p>
        <div class="metric-grid">
          ${metric(result.label, result.before.success, result.after.success)}
          ${metric('Time to finish', result.before.time, result.after.time)}
          ${metric('User confidence', result.before.confidence, result.after.confidence)}
        </div>
        <div class="test-insight"><b>ตรวจผล</b><span>ความสำเร็จ เวลา และความมั่นใจต้องดีขึ้นพร้อมกัน ไม่ใช่แค่หน้าจอดูดีขึ้น</span></div>
        <button id="testNext" class="primary-btn full-btn" type="button">อธิบายผลที่เกิดกับผู้ใช้ →</button>
      </article></section>
    `;
    $('#testNext').addEventListener('click', () => { state.score += 10; state.step = 4; saveSession(); render(); scrollTop(); });
  }

  function renderExplain() {
    const core = current();
    const selected = new Set(state.selectedExplain);
    stage.innerHTML = `
      <section class="single-layout"><article class="mission-card wide">
        <p class="eyebrow">EXPLAIN • ${escapeHtml(typeName(core.type))}</p>
        <h2>สรุปผลด้วยเหตุผลของคุณ</h2>
        <p class="evidence-detail">${escapeHtml(core.explain.prompt)}</p>
        <div class="choice-grid">
          ${ordered(core, 'explain', core.explain.choices, (item) => item).map((choice) => `
            <button class="explain-chip ${selected.has(choice) ? 'selected' : ''}" data-explain="${escapeHtml(choice)}" type="button">${escapeHtml(choice)}</button>
          `).join('')}
        </div>
        <p class="selection-note">เลือกแล้ว ${state.selectedExplain.length}/2</p>
        <button id="explainNext" class="primary-btn full-btn" type="button" ${state.selectedExplain.length === 2 ? '' : 'disabled'}>${state.caseIndex === state.caseIds.length - 1 ? 'สรุปรอบภารกิจ →' : 'ไป Case ถัดไป →'}</button>
      </article></section>
    `;
    document.querySelectorAll('[data-explain]').forEach((button) => button.addEventListener('click', () => {
      const choice = button.dataset.explain;
      const next = new Set(state.selectedExplain);
      if (next.has(choice)) next.delete(choice);
      else if (next.size < 2) next.add(choice);
      state.selectedExplain = Array.from(next);
      saveSession(); renderExplain();
    }));
    $('#explainNext').addEventListener('click', () => {
      const correct = state.selectedExplain.length === 2 && core.explain.correct.every((choice) => state.selectedExplain.includes(choice));
      if (!correct) {
        penalty(5);
        showFeedback({ title: 'อ่านผล User Test อีกครั้ง', good: false, message: 'เลือกผลที่สะท้อนว่า User Goal สำเร็จเร็วขึ้น ชัดขึ้น และมั่นใจขึ้น', principle: core.result.takeaway });
        feedbackDialog.addEventListener('close', () => { state.selectedExplain = []; saveSession(); renderExplain(); }, { once: true });
        return;
      }
      state.score += 20;
      state.answers.push({ coreId: core.id, type: core.type, contextId: core.contextId, attempts: state.attempts, quality: clamp(100 - state.attempts * 16, 40, 100) });
      if (state.caseIndex >= state.caseIds.length - 1) {
        completeRound();
      } else {
        state.caseIndex += 1;
        state.step = 0;
        state.selectedObserve = [];
        state.selectedDiagnosis = null;
        state.selectedFix = null;
        state.selectedExplain = [];
        state.attempts = 0;
        saveSession(); render(); scrollTop();
      }
    });
  }

  function stars() {
    /* A high score cannot compensate for a collapsed Stability meter. */
    if (state.score >= 350 && state.stability >= 80) return 3;
    if (state.score >= 275 && state.stability >= 60) return 2;
    if (state.score >= 210 && state.stability >= 35) return 1;
    return 0;
  }

  function typeAverage(type) {
    const record = progress.typeStats[type];
    return record?.plays ? record.totalQuality / record.plays : 0;
  }

  function updateProgress(starCount) {
    progress.totalRounds += 1;
    progress.bestScore = Math.max(progress.bestScore, state.score);
    progress.bestStars = Math.max(progress.bestStars, starCount);

    if (state.mode === 'tutorial') {
      progress.tutorialComplete = progress.tutorialComplete || starCount >= 1;
      progress.tutorialBestStars = Math.max(progress.tutorialBestStars, starCount);
    }
    if (state.mode === 'replay' && starCount >= 1) progress.replayWins += 1;
    if (state.mode === 'challenge' && starCount >= 1) progress.challengeWins += 1;

    if (state.mode === 'replay' || state.mode === 'challenge') {
      const seen = new Set(progress.replayCycle.seenCoreIds || []);
      state.answers.forEach((answer) => seen.add(answer.coreId));
      progress.replayCycle.seenCoreIds = Array.from(seen);
      progress.replayCycle.roundsInCycle += 1;
    }

    state.answers.forEach((answer) => {
      const stat = progress.typeStats[answer.type] || { plays: 0, totalQuality: 0, attempts: 0 };
      stat.plays += 1; stat.totalQuality += answer.quality; stat.attempts += answer.attempts;
      progress.typeStats[answer.type] = stat;
    });

    progress.recentContextIds = state.answers.map((answer) => answer.contextId).slice(-10);
    /* Keep only compact scheduler state; no full round history is persisted. */
    progress.roundHistory = [];
    saveProgress();

    if (BRIDGE && typeof BRIDGE.writeW1 === 'function' && (progress.tutorialComplete || canonicalW1().cleared)) {
      BRIDGE.writeW1({
        cleared: true,
        tutorialComplete: true,
        stars: Math.max(canonicalW1().stars || 0, progress.bestStars || 1),
        score: Math.max(canonicalW1().score || 0, progress.bestScore || 0),
        rounds: progress.totalRounds,
        source: 'w1-diversity-v10-4'
      });
    }
  }

  function weakestTypeText() {
    const played = Object.keys(progress.typeStats);
    if (!played.length) return 'เริ่ม Tutorial เพื่อสร้าง Learning Profile ของคุณ';
    const weakest = [...played].sort((a, b) => typeAverage(a) - typeAverage(b)).slice(0, 2).map(typeName);
    return weakest.length ? `รอบ Challenge จะให้สถานการณ์จากรูปแบบที่ควรฝึกเพิ่ม เช่น ${weakest.join(' และ ')}` : 'พร้อมทดลองกับบริบทใหม่';
  }

  function completeRound() {
    state.complete = true;
    const starCount = stars();
    updateProgress(starCount);
    clearSession();
    renderCompletion(starCount);
    scrollTop();
  }

  function renderModeSelect() {
    const passed = progress.tutorialComplete || canonicalW1().cleared;
    const challengeReady = challengeUnlocked();
    const cycle = progress.replayCycle;
    const remaining = Math.max(0, 12 - (cycle.roundsInCycle || 0));

    stage.innerHTML = `
      <section class="complete-card mode-select-card">
        <p class="eyebrow">W1 • UX DETECTIVE • DIVERSITY ENGINE</p>
        <h2>${passed ? 'พร้อมสำหรับ Random Replay' : 'เริ่ม Tutorial ครั้งแรก'}</h2>
        <p>${passed ? 'คุณผ่าน W1 แล้ว รอบต่อไปเป็น Case ใหม่จากรูปแบบภารกิจที่ต่างกัน ไม่ย้อน Tutorial เดิม' : 'Tutorial ใช้เพียงครั้งแรก เพื่อรู้วิธีอ่าน User Goal และเชื่อม UI ไปสู่ UX impact'}</p>
        <div class="complete-metrics">
          <div><span>Replay Core</span><b>${CORES.length}</b></div>
          <div><span>Mission Formats</span><b>${TYPES.length}</b></div>
          <div><span>Core ก่อนซ้ำ</span><b>${remaining * ROUND_SIZE}/60</b></div>
        </div>
        <div class="mode-stack">
          <button id="startReplay" class="mode-action replay-action ${passed ? 'is-primary-mode' : ''}" type="button" ${passed ? '' : 'disabled'}>
            <span class="mode-action__icon">↻</span><span><strong>Random Replay • 5 Fresh Cases</strong><small>${passed ? 'หนึ่งรอบไม่ซ้ำ Mission Format และ Core Case จะไม่ซ้ำก่อนครบ Cycle' : 'ผ่าน Tutorial อย่างน้อย 1★ เพื่อปลดล็อก'}</small></span><b>${passed ? 'เริ่ม →' : 'ล็อก'}</b>
          </button>
          <button id="startChallenge" class="mode-action challenge-action" type="button" ${challengeReady ? '' : 'disabled'}>
            <span class="mode-action__icon">⚡</span><span><strong>Transfer Challenge</strong><small>${challengeReady ? 'ไม่มี Principle Hint ระหว่าง Retry และเน้นรูปแบบที่ควรฝึกเพิ่ม' : 'ปลดล็อกเมื่อ Tutorial ได้ 2★ หรือผ่าน Replay 1 รอบ'}</small></span><b>${challengeReady ? 'เริ่ม →' : 'ล็อก'}</b>
          </button>
          <button id="startTutorial" class="mode-action tutorial-action" type="button">
            <span class="mode-action__icon">◎</span><span><strong>${passed ? 'Review Tutorial' : 'First Run Tutorial'}</strong><small>${passed ? 'ทบทวนได้เฉพาะเมื่อเลือกเอง ไม่ใช่ค่าเริ่มต้นหลังผ่านแล้ว' : '5 Case Scaffolded จาก 5 รูปแบบภารกิจ'}</small></span><b>เปิด →</b>
          </button>
        </div>
        <div class="principle-stack"><b>Learning Loop</b><span>Observe → Diagnose → Design Fix → User Test → Explain</span></div>
      </section>
    `;
    $('#startReplay').addEventListener('click', () => { if (passed) startRound('replay'); });
    $('#startChallenge').addEventListener('click', () => { if (challengeReady) startRound('challenge'); });
    $('#startTutorial').addEventListener('click', () => startRound('tutorial'));
  }

  function renderCompletion(starCount) {
    const passedW1 = progress.tutorialComplete || canonicalW1().cleared;
    const title = starCount === 3 ? 'Expert' : starCount === 2 ? 'Mastery' : starCount === 1 ? 'Clear' : 'Review Needed';
    const needsReview = starCount === 0;
    const storageNotice = progressStorageUnavailable || sessionStorageUnavailable
      ? '<p class="storage-note">รอบนี้เล่นจบได้ตามปกติ แต่เบราว์เซอร์ไม่พร้อมบันทึกความคืบหน้าชั่วคราว ระบบไม่ขัดขวางการเล่นหรือสถานะผ่าน W1 ของคุณ</p>'
      : '';
    stage.innerHTML = `
      <section class="complete-card ${needsReview ? 'is-review-needed' : ''}">
        <p class="eyebrow">MISSION COMPLETE • ${escapeHtml(modeMeta().badge)}</p>
        <div class="final-stars">${'★'.repeat(starCount)}${'☆'.repeat(3 - starCount)}</div>
        <h2>${escapeHtml(modeMeta().label)}: ${title}</h2>
        <p>รอบนี้คุณใช้รูปแบบภารกิจ 5 แบบ เพื่อฝึกคิดจาก User Goal ไม่ใช่จำลำดับคำตอบ</p>
        <div class="complete-metrics"><div><span>Final Score</span><b>${state.score}</b></div><div><span>Stability</span><b>${state.stability}</b></div><div><span>Best Stars</span><b>${'★'.repeat(progress.bestStars)}${'☆'.repeat(3 - progress.bestStars)}</b></div></div>
        <div class="principle-stack"><b>Learning Profile</b><span>${escapeHtml(weakestTypeText())}</span></div>
        ${storageNotice}
        <div class="completion-actions">
          ${passedW1 ? `<a class="completion-action next" href="./w2-design-thinking-sprint.html?from=w1&stars=${Math.max(1, progress.bestStars)}&score=${progress.bestScore}"><span class="mode-action__icon">→</span><span><strong>ต่อไป: W2 Design Thinking Sprint</strong><small>คุณผ่าน W1 แล้ว ไม่จำเป็นต้องเล่น Tutorial ซ้ำเพื่อปลดล็อก W2</small></span></a>` : ''}
          <button id="nextReplay" class="completion-action replay" type="button"><span class="mode-action__icon">↻</span><span><strong>เล่น Random Replay</strong><small>เริ่ม 5 Case ใหม่ ต่าง Mission Format จากรอบนี้</small></span></button>
          <button id="modeSelect" class="ghost-btn" type="button">เลือกโหมด</button>
        </div>
      </section>
    `;
    $('#nextReplay').addEventListener('click', () => startRound('replay'));
    $('#modeSelect').addEventListener('click', () => { state = freshState(); render(); });
  }

  function render() {
    updateHud(); updateRail();
    if (!state.mode) return renderModeSelect();
    if (state.complete) return renderCompletion(stars());
    [renderObserve, renderDiagnose, renderFix, renderTest, renderExplain][state.step]();
  }

  function scrollTop() {
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  function clearReplayHistory() {
    const accepted = confirm('ล้างประวัติ Replay ของ W1? สถานะผ่าน W1 และสิทธิ์เข้า W2 จะไม่ถูกลบ');
    if (!accepted) return;
    const carry = {
      tutorialComplete: progress.tutorialComplete,
      tutorialBestStars: progress.tutorialBestStars,
      bestStars: progress.bestStars,
      bestScore: progress.bestScore
    };
    progress = { ...freshProgress(), ...carry };
    saveProgress();
    state = freshState(); clearSession(); render();
  }

  function wireStatic() {
    $('#howBtn').addEventListener('click', () => howDialog.showModal());
    document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(`#${button.dataset.close}`)?.close()));
    $('#resetBtn').addEventListener('click', () => {
      if (state.mode && !state.complete) {
        const leave = confirm('ออกจากรอบนี้? ระบบจะเก็บเฉพาะรอบที่จบแล้ว');
        if (!leave) return;
        state = freshState(); clearSession(); render();
      } else {
        clearReplayHistory();
      }
    });
    [howDialog, feedbackDialog].forEach((dialog) => dialog.addEventListener('click', (event) => {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    }));
  }

  /* Clear only legacy unfinished-round storage before loading the safe session copy. */
  cleanupLegacyW1Storage();
  discardLegacyLocalSession();
  loadProgress();
  loadSession();
  wireStatic();
  render();
})();
