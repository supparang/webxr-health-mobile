// === /sgnal-hunt/js/uxq-w1-v9.js ===
// UX Quest • W1 UX Detective
// V9 — Canonical state, direct W2 handoff, strict 60-core Replay Scheduler + 720 Scenario Variants
// Mobile-first Case Investigation

(function () {
  'use strict';

  const CASE_BANK = Array.isArray(window.UXQ_W1_CASE_BANK)
    ? window.UXQ_W1_CASE_BANK
    : [];

  const TUTORIAL_CASES = Array.isArray(window.UXQ_W1_TUTORIAL_CASES)
    ? window.UXQ_W1_TUTORIAL_CASES
    : [];

  const REPLAY_CORES = Array.isArray(window.UXQ_W1_REPLAY_CORE_CASES)
    ? window.UXQ_W1_REPLAY_CORE_CASES
    : [];

  const REPLAY_SCENARIOS = Array.isArray(window.UXQ_W1_REPLAY_SCENARIOS)
    ? window.UXQ_W1_REPLAY_SCENARIOS
    : [];

  const SKILL_META = window.UXQ_W1_SKILL_META || {};
  const ROUND_SIZE = 5;
  const SESSION_KEY = 'uxquest-w1-session-v9';
  const PROGRESS_KEY = 'uxquest-w1-progress-v9';
  const LEGACY_KEYS = [
    'uxquest-w1-session-v6',
    'uxquest-w1-progress-v6',
    'uxquest-w1-session-v5',
    'uxquest-w1-progress-v5',
    'uxquest-w1-case-investigation-v4',
    'uxquest-w1-session-v8',
    'uxquest-w1-progress-v8'
  ];

  const MODE_META = {
    tutorial: {
      short: 'Tutorial',
      label: 'First Run Tutorial',
      title: 'Tutorial Run',
      badge: 'FOUNDATION',
      icon: '◎',
      description: '5 เคสเรียงลำดับเพื่อฝึก User Goal → UX Impact → Design Fix'
    },
    replay: {
      short: 'Replay',
      label: 'Random Replay',
      title: 'Random Replay',
      badge: 'PRACTICE',
      icon: '↻',
      description: 'สุ่ม 5 เคสจาก 60 Core Cases โดยไม่ซ้ำ Core Case จนครบ 12 รอบ'
    },
    challenge: {
      short: 'Challenge',
      label: 'Transfer Challenge',
      title: 'Transfer Challenge',
      badge: 'MASTERY',
      icon: '⚡',
      description: 'ใช้หลัก UX กับบริบทใหม่ โดยไม่มี Principle Hint ระหว่าง Retry'
    }
  };

  const CASE_BY_ID = new Map(CASE_BANK.map((item) => [item.id, item]));
  const SCENARIOS_BY_CORE = new Map();

  REPLAY_SCENARIOS.forEach((scenario) => {
    const existing = SCENARIOS_BY_CORE.get(scenario.coreId) || [];
    existing.push(scenario);
    SCENARIOS_BY_CORE.set(scenario.coreId, existing);
  });

  const $ = (selector) => document.querySelector(selector);

  const stage = $('#gameStage');
  const feedbackDialog = $('#feedbackDialog');
  const feedbackContent = $('#feedbackContent');
  const howDialog = $('#howDialog');

  let progress = freshProgress();
  let state = freshState();

  function freshReplayCycle() {
    return {
      number: 1,
      seenCoreIds: [],
      familyCounts: {}
    };
  }

  function freshProgress() {
    return {
      version: 6,
      tutorialComplete: false,
      tutorialBestStars: 0,
      bestStars: 0,
      bestScore: 0,
      totalRounds: 0,
      replayWins: 0,
      challengeWins: 0,
      replayCycle: freshReplayCycle(),
      scenarioUsage: {},
      caseStats: {},
      familyStats: {},
      roundHistory: [],
      lastUpdated: null
    };
  }

  function freshState() {
    return {
      version: 6,
      mode: null,
      caseIds: [],
      coreIds: [],
      caseVariants: {},
      caseIndex: 0,
      step: 0,
      score: 0,
      stability: 100,
      selectedSuspect: null,
      selectedDiagnosis: null,
      selectedFix: null,
      selectedExplain: [],
      attempts: 0,
      answered: [],
      startedAt: Date.now(),
      complete: false,
      roundRecorded: false
    };
  }

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(input) {
    return String(input).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[character]));
  }

  function shuffle(items) {
    const clone = [...items];

    for (let index = clone.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [clone[index], clone[target]] = [clone[target], clone[index]];
    }

    return clone;
  }

  function unique(items) {
    return [...new Set(items)];
  }

  function current() {
    return CASE_BY_ID.get(state.caseIds[state.caseIndex]) || null;
  }

  function currentMode() {
    return MODE_META[state.mode] || MODE_META.tutorial;
  }

  function saveProgress() {
    progress.lastUpdated = new Date().toISOString();

    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch (error) {
      console.warn('Could not save UX Quest progress.', error);
    }
  }

  function saveSession() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Could not save UX Quest session.', error);
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.warn('Could not clear UX Quest session.', error);
    }
  }

  function loadProgress() {
    const saved = safeParse(localStorage.getItem(PROGRESS_KEY), null);

    if (saved && typeof saved === 'object') {
      progress = {
        ...freshProgress(),
        ...saved,
        replayCycle: {
          ...freshReplayCycle(),
          ...(saved.replayCycle || {})
        },
        scenarioUsage: saved.scenarioUsage || {},
        caseStats: saved.caseStats || {},
        familyStats: saved.familyStats || {},
        roundHistory: Array.isArray(saved.roundHistory)
          ? saved.roundHistory
          : []
      };
    }

    // One-time migration from the current W1 completion state.
    // It preserves the learner's W1 pass and never forces the tutorial again.
    const canonical = window.UXQProgressV9 && typeof window.UXQProgressV9.readW1 === 'function'
      ? window.UXQProgressV9.readW1()
      : null;

    if (canonical && canonical.cleared) {
      progress.tutorialComplete = true;
      progress.tutorialBestStars = Math.max(progress.tutorialBestStars || 0, canonical.stars || 1);
      progress.bestStars = Math.max(progress.bestStars || 0, canonical.stars || 1);
      progress.bestScore = Math.max(progress.bestScore || 0, canonical.score || 0);
      progress.totalRounds = Math.max(progress.totalRounds || 0, canonical.rounds || 0);
      saveProgress();
    }
  }

  function loadSession() {
    const saved = safeParse(localStorage.getItem(SESSION_KEY), null);

    if (
      !saved ||
      !saved.mode ||
      !Array.isArray(saved.caseIds) ||
      !saved.caseIds.length
    ) {
      return;
    }

    // Completion is a report, not a resumable round.
    // Clearing it prevents re-entry from looping back to Tutorial/old results.
    if (saved.complete === true) {
      clearSession();
      return;
    }

    const validCaseIds = saved.caseIds.filter((id) => CASE_BY_ID.has(id));

    if (!validCaseIds.length) {
      clearSession();
      return;
    }

    state = {
      ...freshState(),
      ...saved,
      caseIds: validCaseIds,
      coreIds: Array.isArray(saved.coreIds)
        ? saved.coreIds
        : validCaseIds.map((id) => CASE_BY_ID.get(id).coreId),
      caseVariants: saved.caseVariants || buildCaseVariants(validCaseIds),
      caseIndex: clamp(
        Number(saved.caseIndex) || 0,
        0,
        Math.max(validCaseIds.length - 1, 0)
      ),
      step: clamp(Number(saved.step) || 0, 0, 4),
      selectedExplain: Array.isArray(saved.selectedExplain)
        ? saved.selectedExplain
        : [],
      answered: Array.isArray(saved.answered)
        ? saved.answered
        : []
    };
  }

  function clearLegacyData() {
    LEGACY_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        // Optional cleanup only.
      }
    });
  }

  function resetAllW1() {
    const confirmed = confirm(
      'ล้างความคืบหน้า W1 ทั้งหมด? Tutorial, ดาว, Replay, Challenge และสถิติในเครื่องนี้จะถูกลบ'
    );

    if (!confirmed) {
      return;
    }

    progress = freshProgress();
    state = freshState();

    try {
      localStorage.removeItem(PROGRESS_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.warn('Could not reset UX Quest data.', error);
    }

    clearLegacyData();
    if (window.UXQProgressV9 && typeof window.UXQProgressV9.reset === 'function') {
      window.UXQProgressV9.reset();
    }
    render();
    scrollToTop();
  }

  function returnToModeSelect() {
    state = freshState();
    clearSession();
    render();
    scrollToTop();
  }

  function leaveRound() {
    const confirmed = confirm(
      'ออกจากรอบปัจจุบัน? ระบบจะไม่บันทึกความคืบหน้าของรอบที่ยังเล่นไม่จบ'
    );

    if (confirmed) {
      returnToModeSelect();
    }
  }

  function requestedMode() {
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      if (mode === 'tutorial' || mode === 'replay' || mode === 'challenge') {
        return mode;
      }
      if (params.get('resume') === '1') {
        return 'resume';
      }
    } catch (error) {
      // Query parameters are optional in standalone play.
    }
    return null;
  }

  function clearRequestedMode() {
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      // Keep the round playable even where history APIs are restricted.
    }
  }

  function tutorialReservedCoreIds() {
    return new Set(
      TUTORIAL_CASES
        .map((item) => item.sourceCoreId)
        .filter(Boolean)
    );
  }

  function replayRoundNumber() {
    const seen = (progress.replayCycle && progress.replayCycle.seenCoreIds) || [];
    return Math.floor(seen.length / ROUND_SIZE) + 1;
  }

  function buildCaseVariants(caseIds) {
    const variants = {};

    caseIds.forEach((id) => {
      const caseData = CASE_BY_ID.get(id);

      if (!caseData) {
        return;
      }

      variants[id] = {
        areaIds: shuffle(caseData.screen.areas.map((area) => area.id)),
        diagnosisIds: shuffle(
          caseData.diagnosis.options.map((option) => option.id)
        ),
        fixIds: shuffle(caseData.fixes.map((option) => option.id)),
        explainChoices: shuffle(caseData.explain.choices)
      };
    });

    return variants;
  }

  function currentVariant(caseData) {
    if (!state.caseVariants[caseData.id]) {
      state.caseVariants = {
        ...state.caseVariants,
        ...buildCaseVariants([caseData.id])
      };

      saveSession();
    }

    return state.caseVariants[caseData.id];
  }

  function orderByIds(items, ids) {
    const lookup = new Map(items.map((item) => [item.id, item]));
    const ordered = ids.map((id) => lookup.get(id)).filter(Boolean);

    return ordered.length === items.length ? ordered : items;
  }

  function orderedAreas(caseData) {
    const variant = currentVariant(caseData);

    return orderByIds(caseData.screen.areas, variant.areaIds).map(
      (area, index) => ({
        ...area,
        label: ['A', 'B', 'C'][index] || String(index + 1)
      })
    );
  }

  function orderedDiagnosisOptions(caseData) {
    return orderByIds(
      caseData.diagnosis.options,
      currentVariant(caseData).diagnosisIds
    );
  }

  function orderedFixOptions(caseData) {
    return orderByIds(
      caseData.fixes,
      currentVariant(caseData).fixIds
    );
  }

  function orderedExplainChoices(caseData) {
    const ordered = currentVariant(caseData).explainChoices || [];

    return ordered.length === caseData.explain.choices.length
      ? ordered
      : caseData.explain.choices;
  }

  function familyQuality(skill) {
    const record = progress.familyStats[skill];

    return record && record.plays
      ? record.totalQuality / record.plays
      : 0;
  }

  function recentScenarioIds(mode, rounds = 6) {
    return unique(
      progress.roundHistory
        .filter((round) => round.mode === mode)
        .slice(-rounds)
        .flatMap((round) => round.caseIds || [])
    );
  }

  function recentChallengeCoreIds(rounds = 2) {
    return unique(
      progress.roundHistory
        .filter((round) => round.mode === 'challenge')
        .slice(-rounds)
        .flatMap((round) => round.coreIds || [])
    );
  }

  function ensureReplayCycle() {
    const currentCycle = progress.replayCycle;
    const seen = new Set(currentCycle.seenCoreIds || []);
    const remaining = REPLAY_CORES.filter((core) => !seen.has(core.coreId));

    if (remaining.length >= ROUND_SIZE) {
      return remaining;
    }

    progress.replayCycle = {
      number: (currentCycle.number || 1) + 1,
      seenCoreIds: [],
      familyCounts: {}
    };

    saveProgress();
    return [...REPLAY_CORES];
  }

  function chooseBalancedSkills(availableCores, familyCounts, preferWeakness) {
    const grouped = availableCores.reduce((groups, core) => {
      groups[core.skill] = groups[core.skill] || [];
      groups[core.skill].push(core);
      return groups;
    }, {});

    const skills = Object.keys(grouped);
    const selected = [];

    while (selected.length < ROUND_SIZE && selected.length < skills.length) {
      const candidates = skills.filter((skill) => !selected.includes(skill));

      const sorted = candidates.sort((a, b) => {
        const aCount = familyCounts[a] || 0;
        const bCount = familyCounts[b] || 0;

        if (aCount !== bCount) {
          return aCount - bCount;
        }

        if (preferWeakness) {
          return familyQuality(a) - familyQuality(b);
        }

        return Math.random() - 0.5;
      });

      selected.push(sorted[0]);
    }

    return selected;
  }

  function chooseScenarioForCore(coreId, mode) {
    const all = SCENARIOS_BY_CORE.get(coreId) || [];
    const recent = new Set(recentScenarioIds(mode, 6));
    const used = new Set(progress.scenarioUsage[coreId] || []);

    let candidates = all.filter(
      (scenario) => !used.has(scenario.id) && !recent.has(scenario.id)
    );

    if (!candidates.length) {
      candidates = all.filter((scenario) => !recent.has(scenario.id));
    }

    if (!candidates.length) {
      candidates = all;
    }

    return shuffle(candidates)[0] || null;
  }

  function buildReplayRound() {
    let availableCores = ensureReplayCycle();
    const familyCounts = progress.replayCycle.familyCounts || {};

    // The first three Replay rounds deliberately avoid the five tutorial base cores.
    // Learners therefore meet genuinely new service/skill combinations immediately.
    if (replayRoundNumber() <= 3) {
      const reserved = tutorialReservedCoreIds();
      const freshOnly = availableCores.filter((core) => !reserved.has(core.coreId));
      if (freshOnly.length >= ROUND_SIZE) {
        availableCores = freshOnly;
      }
    }

    const skills = chooseBalancedSkills(
      availableCores,
      familyCounts,
      false
    );

    const coreIds = skills.map((skill) => {
      const candidates = availableCores.filter((core) => core.skill === skill);
      return shuffle(candidates)[0].coreId;
    });

    const caseIds = coreIds
      .map((coreId) => chooseScenarioForCore(coreId, 'replay'))
      .filter(Boolean)
      .map((scenario) => scenario.id);

    return {
      coreIds,
      caseIds: shuffle(caseIds)
    };
  }

  function buildChallengeRound() {
    const recentCores = new Set(recentChallengeCoreIds(2));
    const candidates = REPLAY_CORES.filter(
      (core) => !recentCores.has(core.coreId)
    );

    const availableCores = candidates.length >= ROUND_SIZE
      ? candidates
      : REPLAY_CORES;

    const skills = chooseBalancedSkills(
      availableCores,
      {},
      true
    );

    const coreIds = skills.map((skill) => {
      const pool = availableCores.filter((core) => core.skill === skill);
      return shuffle(pool)[0].coreId;
    });

    const caseIds = coreIds
      .map((coreId) => chooseScenarioForCore(coreId, 'challenge'))
      .filter(Boolean)
      .map((scenario) => scenario.id);

    return {
      coreIds,
      caseIds: shuffle(caseIds)
    };
  }

  function challengeUnlocked() {
    return progress.tutorialBestStars >= 2 || progress.replayWins >= 1;
  }

  function startRound(mode) {
    if (mode === 'replay' && !progress.tutorialComplete) {
      return;
    }

    if (mode === 'challenge' && !challengeUnlocked()) {
      return;
    }

    let round;

    if (mode === 'tutorial') {
      round = {
        caseIds: TUTORIAL_CASES.map((item) => item.id),
        coreIds: TUTORIAL_CASES.map((item) => item.coreId)
      };
    } else if (mode === 'replay') {
      round = buildReplayRound();
    } else {
      round = buildChallengeRound();
    }

    if (!round.caseIds.length) {
      alert('ยังเตรียม Case Bank ไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่');
      return;
    }

    state = {
      ...freshState(),
      mode,
      caseIds: round.caseIds,
      coreIds: round.coreIds,
      caseVariants: buildCaseVariants(round.caseIds),
      startedAt: Date.now()
    };

    clearRequestedMode();
    saveSession();
    render();
    scrollToTop();
  }

  function updateHud() {
    const resetButton = $('#resetBtn');
    const playing = Boolean(
      state.mode && state.caseIds.length && !state.complete
    );

    if (state.complete) {
      $('#caseValue').textContent = 'จบรอบ';
      $('#scoreValue').textContent = state.score;
      $('#stabilityValue').textContent = state.stability;
      resetButton.textContent = 'เลือกโหมด';
      resetButton.dataset.action = 'mode-select';
      return;
    }

    if (playing) {
      $('#caseValue').textContent = `${currentMode().short} ${state.caseIndex + 1}/${state.caseIds.length}`;
      $('#scoreValue').textContent = state.score;
      $('#stabilityValue').textContent = state.stability;
      resetButton.textContent = 'ออกจากรอบ';
      resetButton.dataset.action = 'leave-round';
      return;
    }

    $('#caseValue').textContent = 'เลือกโหมด';
    $('#scoreValue').textContent = progress.bestScore || 0;
    $('#stabilityValue').textContent = 100;
    resetButton.textContent = 'ล้าง W1';
    resetButton.dataset.action = 'reset-all';
  }

  function updateRail() {
    const playing = Boolean(
      state.mode && state.caseIds.length && !state.complete
    );

    document.querySelectorAll('#phaseRail .phase').forEach((node, index) => {
      node.classList.toggle('active', playing && index === state.step);
      node.classList.toggle('done', playing && index < state.step);
    });
  }

  function showFeedback({ title, verdict, message, principle, continueLabel }) {
    const showPrinciple = Boolean(principle && state.mode !== 'challenge');

    feedbackContent.innerHTML = `
      <p class="eyebrow">CASE FEEDBACK</p>
      <h2>${escapeHtml(title)}</h2>

      <div class="verdict ${verdict === 'correct' ? 'good' : 'retry'}">
        ${verdict === 'correct'
          ? '✓ วิเคราะห์ได้ตรงประเด็น'
          : '↻ ลองคิดจากเป้าหมายผู้ใช้อีกครั้ง'}
      </div>

      <p>${escapeHtml(message)}</p>

      ${showPrinciple ? `
        <div class="principle-card">
          <b>Principle</b>
          <span>${escapeHtml(principle)}</span>
        </div>
      ` : ''}

      <button id="feedbackContinue" class="primary-btn full-btn" type="button">
        ${escapeHtml(continueLabel || 'ทำขั้นตอนถัดไป →')}
      </button>
    `;

    feedbackDialog.showModal();

    $('#feedbackContinue').addEventListener(
      'click',
      () => feedbackDialog.close(),
      { once: true }
    );
  }

  function addMistake(basePenalty) {
    const multiplier = state.mode === 'challenge' ? 1.25 : 1;

    state.attempts += 1;
    state.stability = clamp(
      state.stability - Math.ceil(basePenalty * multiplier),
      0,
      100
    );

    saveSession();
  }

  function caseModeKicker(caseData) {
    const mode = currentMode();
    const skillChip = state.mode === 'challenge'
      ? ''
      : `<span>${escapeHtml(SKILL_META[caseData.skill] || caseData.skill)}</span>`;

    return `
      <div class="case-kicker">
        <span>${escapeHtml(mode.badge)}</span>
        <span>CASE ${state.caseIndex + 1} / ${state.caseIds.length}</span>
        ${skillChip}
      </div>
    `;
  }

  function suspectOption(area) {
    const selected = state.selectedSuspect === area.id;
    const detail = Array.isArray(area.detail)
      ? area.detail.join(' • ')
      : area.detail;

    return `
      <button
        class="answer-option ${selected ? 'selected' : ''}"
        data-suspect="${escapeHtml(area.id)}"
        type="button"
      >
        <span class="radio-dot"></span>
        <span>
          <strong>${escapeHtml(area.label)}. ${escapeHtml(area.name)}</strong>
          <br />
          <small>${escapeHtml(detail)}</small>
        </span>
      </button>
    `;
  }

  function cardScreen(caseData, displayAreas) {
    const area = (item) => {
      const selected = state.selectedSuspect === item.id;
      const detail = Array.isArray(item.detail)
        ? `<div class="chip-stack">${item.detail.map((value) => `<span>${escapeHtml(value)}</span>`).join('')}</div>`
        : `<span>${escapeHtml(item.detail)}</span>`;

      return `
        <button
          class="suspect-zone ${selected ? 'selected' : ''}"
          data-suspect="${escapeHtml(item.id)}"
          type="button"
        >
          <b>${escapeHtml(item.label)}</b>
          <small>${escapeHtml(item.name)}</small>
          ${detail}
        </button>
      `;
    };

    return `
      <div class="screen-shell" aria-label="หน้าจอจำลองของบริการ ${escapeHtml(caseData.service)}">
        <div class="screen-top">
          <strong>Smart Campus</strong>
          <span>บริการ • ช่วยเหลือ • บัญชี</span>
        </div>

        <div class="screen-body">
          <h3>${escapeHtml(caseData.screen.heading)}</h3>
          <p>${escapeHtml(caseData.screen.subheading)}</p>
          <div class="wire-line"></div>

          <div class="screen-canvas">
            ${displayAreas.map(area).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function attachSuspectEvents() {
    document.querySelectorAll('[data-suspect]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedSuspect = button.dataset.suspect;
        saveSession();
        renderObserve();
      });
    });
  }

  function renderModeSelect() {
    const replayLocked = !progress.tutorialComplete;
    const challengeLocked = !challengeUnlocked();
    const cycle = progress.replayCycle || freshReplayCycle();
    const coresRemaining = REPLAY_CORES.length - (cycle.seenCoreIds || []).length;
    const replayIsPrimary = progress.tutorialComplete;

    stage.innerHTML = `
      <section class="complete-card mode-select-card">
        <p class="eyebrow">W1 • UX DETECTIVE</p>
        <h2>${replayIsPrimary ? 'พร้อมสำหรับ Random Replay' : 'เริ่ม Tutorial ครั้งแรก'}</h2>

        <p>
          ${replayIsPrimary
            ? 'คุณผ่าน W1 แล้ว รอบต่อไปจะเป็น Case ใหม่จาก Replay Bank ไม่ย้อนกลับไป Tutorial เดิม'
            : 'รอบแรกจะสอนวิธีคิดทีละขั้น ก่อนเปิดคลัง Replay ที่มี Case ใหม่และ Scenario Variant'}
        </p>

        <div class="complete-metrics">
          <div><span>Replay Core Cases</span><b>60</b></div>
          <div><span>Meaningful Scenarios</span><b>720</b></div>
          <div><span>Core ก่อนวนซ้ำ</span><b>${coresRemaining}/60</b></div>
        </div>

        <div class="mode-action-grid">
          <button id="startReplay" class="mode-action replay-action ${replayIsPrimary ? 'is-primary-mode' : ''}" type="button" ${replayLocked ? 'disabled' : ''}>
            <span class="mode-action-icon">↻</span>
            <span>
              <strong>Random Replay • 5 Fresh Cases</strong>
              <small>${replayLocked ? 'ผ่าน Tutorial อย่างน้อย 1 ดาวเพื่อปลดล็อก' : `Replay Cycle ${cycle.number || 1} • ครั้งนี้จะไม่ซ้ำ Core ใน ${Math.max(0, 12 - Math.floor(((cycle.seenCoreIds || []).length) / ROUND_SIZE))} รอบที่เหลือ`}</small>
            </span>
            <b>${replayLocked ? 'ล็อก' : 'เล่น →'}</b>
          </button>

          <button id="startChallenge" class="mode-action challenge-action" type="button" ${challengeLocked ? 'disabled' : ''}>
            <span class="mode-action-icon">⚡</span>
            <span>
              <strong>Transfer Challenge</strong>
              <small>${challengeLocked ? 'ปลดล็อกเมื่อ Tutorial ได้ 2 ดาว หรือผ่าน Replay 1 รอบ' : 'บริบทใหม่ + ตัวลวงใหม่ + ไม่มี Principle Hint ระหว่าง Retry'}</small>
            </span>
            <b>${challengeLocked ? 'ล็อก' : 'ท้าทาย →'}</b>
          </button>

          <button id="startTutorial" class="mode-action tutorial-action" type="button">
            <span class="mode-action-icon">◎</span>
            <span>
              <strong>${progress.tutorialComplete ? 'Review Tutorial' : 'First Run Tutorial'}</strong>
              <small>${progress.tutorialComplete ? 'ทบทวน 5 เคส Scaffolded เดิมโดยตั้งใจ ไม่ใช่ค่าเริ่มต้นของเกม' : '5 เคส Scaffolded เพื่อฝึก User Goal → Diagnose → Fix → Test'}</small>
            </span>
            <b>เปิด →</b>
          </button>
        </div>

        <div class="principle-stack">
          <b>Learning Loop</b>
          <span>User Goal → UI Symptom → UX Impact → Design Fix → User Test → Explain</span>
        </div>
      </section>
    `;

    $('#startTutorial').addEventListener('click', () => startRound('tutorial'));
    $('#startReplay').addEventListener('click', () => { if (!replayLocked) startRound('replay'); });
    $('#startChallenge').addEventListener('click', () => { if (!challengeLocked) startRound('challenge'); });
  }

  function renderObserve() {
    const caseData = current();

    if (!caseData) {
      returnToModeSelect();
      return;
    }

    const displayAreas = orderedAreas(caseData);
    const evidenceTitle = caseData.evidence ? caseData.evidence.title : 'USER SIGNAL';

    stage.innerHTML = `
      <section class="case-layout">
        <article class="mission-card">
          ${caseModeKicker(caseData)}
          <h2>${escapeHtml(caseData.title)}</h2>

          <div class="goal-card">
            <span>USER GOAL</span>
            <b>${escapeHtml(caseData.goal)}</b>
          </div>

          <p class="evidence-label">${escapeHtml(evidenceTitle)}</p>
          <p class="evidence-detail">${escapeHtml(caseData.quote)}</p>

          <p class="muted tiny"><b>ผู้ใช้:</b> ${escapeHtml(caseData.persona)}</p>

          <h3 class="question-title">จากเป้าหมายและหลักฐานนี้ จุดใดควรตรวจสอบก่อน?</h3>

          <div class="answer-list">
            ${displayAreas.map(suspectOption).join('')}
          </div>

          <div class="stage-actions">
            <button id="observeNext" class="primary-btn full-btn" type="button" ${state.selectedSuspect ? '' : 'disabled'}>
              เก็บหลักฐานและวิเคราะห์ →
            </button>
          </div>

          <p class="muted tiny">เลือกคำตอบจากรายการด้านบนได้ทันที ไม่ต้องเลื่อนหาปุ่ม A/B/C ในหน้าจอจำลอง</p>
        </article>

        <article class="screen-card">
          ${cardScreen(caseData, displayAreas)}
          <div class="screen-caption">หน้าจอจำลองสำหรับดูบริบทเพิ่มเติม หรือแตะ A/B/C บนจอนี้ได้เช่นกัน</div>
        </article>
      </section>
    `;

    attachSuspectEvents();

    $('#observeNext').addEventListener('click', () => {
      if (!state.selectedSuspect) {
        return;
      }

      if (state.selectedSuspect !== caseData.suspectId) {
        addMistake(6);

        showFeedback({
          title: 'จุดนี้ยังไม่ใช่ต้นเหตุหลัก',
          verdict: 'retry',
          message: 'ลองย้อนกลับไปดู User Goal: ผู้ใช้ต้องการทำอะไรให้สำเร็จ และส่วนใดขวางเป้าหมายนั้นมากที่สุด?',
          principle: 'Start from the user goal',
          continueLabel: 'เลือกคำตอบใหม่'
        });

        feedbackDialog.addEventListener('close', () => {
          state.selectedSuspect = null;
          saveSession();
          renderObserve();
        }, { once: true });

        return;
      }

      state.step = 1;
      saveSession();
      render();
      scrollToTop();
    });
  }

  function radioOption(option, stateKey) {
    const selected = state[stateKey] === option.id;

    return `
      <button class="answer-option ${selected ? 'selected' : ''}" data-answer="${escapeHtml(option.id)}" type="button">
        <span class="radio-dot"></span>
        <span>${escapeHtml(option.text)}</span>
      </button>
    `;
  }

  function renderDiagnose() {
    const caseData = current();
    const suspectArea = orderedAreas(caseData).find((item) => item.id === caseData.suspectId);
    const suspectDetail = Array.isArray(suspectArea.detail)
      ? suspectArea.detail.join(' • ')
      : suspectArea.detail;

    stage.innerHTML = `
      <section class="single-layout">
        <article class="mission-card wide">
          <p class="eyebrow">EVIDENCE COLLECTED</p>
          <h2>${escapeHtml(suspectArea.name)}</h2>
          <p class="evidence-detail">${escapeHtml(suspectDetail)}</p>

          <div class="instruction-card">
            <span class="step-badge">STEP 2</span>
            <div><b>วิเคราะห์ UI → UX</b><p>เลือกคำอธิบายที่เชื่อมสิ่งที่เห็นบนหน้าจอกับผลที่เกิดกับเป้าหมายของผู้ใช้ได้ดีที่สุด</p></div>
          </div>

          <h3 class="question-title">${escapeHtml(caseData.diagnosis.prompt)}</h3>
          <div class="answer-list">${orderedDiagnosisOptions(caseData).map((option) => radioOption(option, 'selectedDiagnosis')).join('')}</div>
        </article>
      </section>

      <div class="stage-actions left-actions">
        <button id="diagnoseNext" class="primary-btn" type="button" ${state.selectedDiagnosis ? '' : 'disabled'}>ยืนยันการวิเคราะห์ →</button>
      </div>
    `;

    document.querySelectorAll('[data-answer]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedDiagnosis = button.dataset.answer;
        saveSession();
        renderDiagnose();
      });
    });

    $('#diagnoseNext').addEventListener('click', () => {
      const picked = caseData.diagnosis.options.find((option) => option.id === state.selectedDiagnosis);

      if (!picked) {
        return;
      }

      if (!picked.correct) {
        addMistake(5);

        showFeedback({
          title: 'ยังเชื่อมกับผู้ใช้ไม่พอ',
          verdict: 'retry',
          message: 'คำตอบที่แข็งแรงต้องอธิบายได้ทั้ง UI symptom และ UX impact ไม่ใช่เพียงบอกว่าสิ่งใดดูสวยหรือไม่สวย',
          principle: 'UI affects UX',
          continueLabel: 'เลือกคำตอบใหม่'
        });

        feedbackDialog.addEventListener('close', () => {
          state.selectedDiagnosis = null;
          saveSession();
          renderDiagnose();
        }, { once: true });

        return;
      }

      state.score += 18;
      state.step = 2;
      saveSession();
      render();
      scrollToTop();
    });
  }

  function renderFix() {
    const caseData = current();

    stage.innerHTML = `
      <section class="single-layout">
        <article class="mission-card wide">
          <p class="eyebrow">DESIGN DECISION</p>
          <h2>เลือกการแก้ที่ช่วยผู้ใช้ทำงานสำเร็จ</h2>
          <p class="muted">เลือกวิธีแก้ที่ตอบ User Goal มากที่สุด ไม่ใช่วิธีที่ดูสวยเพียงอย่างเดียว</p>

          <div class="instruction-card">
            <span class="step-badge">STEP 3</span>
            <div><b>เลือก Design Fix</b><p>ทุกทางเลือกทำได้ในเชิงเทคนิค แต่มีเพียงหนึ่งแนวทางที่แก้ต้นเหตุของความติดขัด</p></div>
          </div>

          <div class="answer-list fix-list">${orderedFixOptions(caseData).map((option) => radioOption(option, 'selectedFix')).join('')}</div>
        </article>
      </section>

      <div class="stage-actions left-actions">
        <button id="fixNext" class="primary-btn" type="button" ${state.selectedFix ? '' : 'disabled'}>ทดสอบกับผู้ใช้ →</button>
      </div>
    `;

    document.querySelectorAll('[data-answer]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedFix = button.dataset.answer;
        saveSession();
        renderFix();
      });
    });

    $('#fixNext').addEventListener('click', () => {
      const picked = caseData.fixes.find((option) => option.id === state.selectedFix);

      if (!picked) {
        return;
      }

      if (!picked.correct) {
        addMistake(7);

        showFeedback({
          title: 'การแก้นี้ยังไม่ตรงต้นเหตุ',
          verdict: 'retry',
          message: 'ลองกลับมาถามว่า วิธีนี้ทำให้ผู้ใช้บรรลุ User Goal ได้ชัดเจนขึ้นจริงหรือไม่?',
          principle: caseData.diagnosis.principle,
          continueLabel: 'เลือกวิธีแก้ใหม่'
        });

        feedbackDialog.addEventListener('close', () => {
          state.selectedFix = null;
          saveSession();
          renderFix();
        }, { once: true });

        return;
      }

      state.score += 22;
      state.step = 3;
      saveSession();
      render();
      scrollToTop();
    });
  }

  function metric(label, before, after, symbol = '') {
    return `
      <div class="metric-card">
        <span>${escapeHtml(label)}</span>
        <div><b class="before">${escapeHtml(String(before))}${symbol}</b><i>→</i><b class="after">${escapeHtml(String(after))}${symbol}</b></div>
      </div>
    `;
  }

  function renderUserTest() {
    const caseData = current();
    const result = caseData.result;

    stage.innerHTML = `
      <section class="single-layout">
        <article class="mission-card wide">
          <p class="eyebrow">USER TEST SIMULATION</p>
          <h2>ผลลัพธ์หลังปรับการออกแบบ</h2>
          <p>${escapeHtml(result.text)}</p>

          <div class="instruction-card">
            <span class="step-badge">STEP 4</span>
            <div><b>ดูผลที่เกิดกับผู้ใช้</b><p>การแก้ที่ดีไม่ใช่เพียงหน้าจอดูดีขึ้น แต่ต้องช่วยให้ผู้ใช้สำเร็จเร็วขึ้นและมั่นใจขึ้น</p></div>
          </div>

          <div class="metric-grid">
            ${metric('Task success', result.before.success, result.after.success, '%')}
            ${metric('Time to finish', result.before.time, result.after.time)}
            ${metric('User confidence', result.before.confidence, result.after.confidence, '%')}
          </div>

          <div class="test-insight"><b>สิ่งที่ควรจำ</b><span>Design decision ต้องเชื่อมกับผลลัพธ์ที่ผู้ใช้สัมผัสได้</span></div>
        </article>
      </section>

      <div class="stage-actions left-actions"><button id="testNext" class="primary-btn" type="button">อธิบายเหตุผล →</button></div>
    `;

    $('#testNext').addEventListener('click', () => {
      state.score += 10;
      state.step = 4;
      saveSession();
      render();
      scrollToTop();
    });
  }

  function renderExplain() {
    const caseData = current();
    const selected = new Set(state.selectedExplain);

    stage.innerHTML = `
      <section class="single-layout">
        <article class="mission-card wide">
          <p class="eyebrow">EXPLAIN CHECK</p>
          <h2>สรุปด้วยเหตุผลของคุณ</h2>

          <div class="instruction-card">
            <span class="step-badge">STEP 5</span>
            <div><b>เลือก 2 ผลลัพธ์ที่เกิดกับผู้ใช้จริง</b><p>ไม่ใช่คำที่ฟังดูดี แต่เป็นผลลัพธ์ที่ตามมาจาก Design Fix ของคุณ</p></div>
          </div>

          <h3 class="question-title">${escapeHtml(caseData.explain.prompt)}</h3>

          <div class="choice-grid">
            ${orderedExplainChoices(caseData).map((choice) => `
              <button class="explain-chip ${selected.has(choice) ? 'selected' : ''}" data-explain="${escapeHtml(choice)}" type="button">${escapeHtml(choice)}</button>
            `).join('')}
          </div>

          <p class="selection-note">เลือกแล้ว ${state.selectedExplain.length}/2</p>
        </article>
      </section>

      <div class="stage-actions left-actions">
        <button id="explainNext" class="primary-btn" type="button" ${state.selectedExplain.length === 2 ? '' : 'disabled'}>
          ${state.caseIndex === state.caseIds.length - 1 ? 'สรุปผลภารกิจ →' : 'ไป Case ถัดไป →'}
        </button>
      </div>
    `;

    document.querySelectorAll('[data-explain]').forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.dataset.explain;
        const choices = new Set(state.selectedExplain);

        if (choices.has(value)) {
          choices.delete(value);
        } else if (choices.size < 2) {
          choices.add(value);
        }

        state.selectedExplain = Array.from(choices);
        saveSession();
        renderExplain();
      });
    });

    $('#explainNext').addEventListener('click', () => {
      if (state.selectedExplain.length !== 2) {
        return;
      }

      const correct = state.selectedExplain.every((choice) => caseData.explain.correct.includes(choice)) &&
        caseData.explain.correct.every((choice) => state.selectedExplain.includes(choice));

      if (!correct) {
        addMistake(5);

        showFeedback({
          title: 'ลองเชื่อมกับผล User Test',
          verdict: 'retry',
          message: 'เลือกคำที่อธิบายว่าผู้ใช้ทำเป้าหมายได้ดีขึ้นอย่างไร จากผลการทดสอบที่คุณเพิ่งเห็น',
          principle: caseData.diagnosis.principle,
          continueLabel: 'เลือกคำตอบใหม่'
        });

        feedbackDialog.addEventListener('close', () => {
          state.selectedExplain = [];
          saveSession();
          renderExplain();
        }, { once: true });

        return;
      }

      state.score += 20;
      state.answered.push({
        scenarioId: caseData.id,
        coreId: caseData.coreId,
        skill: caseData.skill,
        attempts: state.attempts,
        quality: clamp(100 - (state.attempts * 16), 35, 100)
      });

      if (state.caseIndex >= state.caseIds.length - 1) {
        completeRound();
        return;
      }

      state.caseIndex += 1;
      state.step = 0;
      state.selectedSuspect = null;
      state.selectedDiagnosis = null;
      state.selectedFix = null;
      state.selectedExplain = [];
      state.attempts = 0;
      saveSession();
      render();
      scrollToTop();
    });
  }

  function stars() {
    const stabilityGate = state.mode === 'challenge'
      ? { three: 86, two: 70, one: 52 }
      : { three: 80, two: 60, one: 38 };

    if (state.score >= 320 && state.stability >= stabilityGate.three) {
      return 3;
    }

    if (state.score >= 260 && state.stability >= stabilityGate.two) {
      return 2;
    }

    if (state.score >= 200 && state.stability >= stabilityGate.one) {
      return 1;
    }

    return 0;
  }

  function recordReplayCycle() {
    if (state.mode !== 'replay') {
      return;
    }

    const seen = new Set(progress.replayCycle.seenCoreIds || []);

    state.answered.forEach((answer) => {
      seen.add(answer.coreId);
      progress.replayCycle.familyCounts[answer.skill] = (progress.replayCycle.familyCounts[answer.skill] || 0) + 1;
    });

    progress.replayCycle.seenCoreIds = [...seen];
  }

  function recordScenarioUsage() {
    state.answered.forEach((answer) => {
      const used = new Set(progress.scenarioUsage[answer.coreId] || []);
      used.add(answer.scenarioId);
      progress.scenarioUsage[answer.coreId] = [...used].slice(-12);
    });
  }

  function updateLearningStats() {
    state.answered.forEach((answer) => {
      const caseRecord = progress.caseStats[answer.coreId] || {
        plays: 0,
        totalQuality: 0,
        bestQuality: 0,
        totalAttempts: 0,
        lastPlayed: null
      };

      caseRecord.plays += 1;
      caseRecord.totalQuality += answer.quality;
      caseRecord.bestQuality = Math.max(caseRecord.bestQuality, answer.quality);
      caseRecord.totalAttempts += answer.attempts;
      caseRecord.lastPlayed = new Date().toISOString();
      progress.caseStats[answer.coreId] = caseRecord;

      const familyRecord = progress.familyStats[answer.skill] || {
        plays: 0,
        totalQuality: 0,
        totalAttempts: 0
      };

      familyRecord.plays += 1;
      familyRecord.totalQuality += answer.quality;
      familyRecord.totalAttempts += answer.attempts;
      progress.familyStats[answer.skill] = familyRecord;
    });
  }

  function updateProgressFromRound(starCount) {
    if (state.roundRecorded) {
      return;
    }

    progress.totalRounds += 1;
    progress.bestScore = Math.max(progress.bestScore || 0, state.score);
    progress.bestStars = Math.max(progress.bestStars || 0, starCount);

    if (state.mode === 'tutorial') {
      progress.tutorialComplete = progress.tutorialComplete || starCount >= 1;
      progress.tutorialBestStars = Math.max(progress.tutorialBestStars || 0, starCount);
    }

    if (state.mode === 'replay' && starCount >= 1) {
      progress.replayWins += 1;
    }

    if (state.mode === 'challenge' && starCount >= 1) {
      progress.challengeWins += 1;
    }

    recordReplayCycle();
    recordScenarioUsage();
    updateLearningStats();

    progress.roundHistory = [
      ...progress.roundHistory,
      {
        id: `w1-${Date.now()}`,
        mode: state.mode,
        score: state.score,
        stability: state.stability,
        stars: starCount,
        caseIds: [...state.caseIds],
        coreIds: [...state.coreIds],
        completedAt: new Date().toISOString()
      }
    ].slice(-24);

    state.roundRecorded = true;
    saveProgress();

    // The Hub and W2 only read this explicit canonical state.
    // No DOM scanning and no re-entrant unlock events.
    if (window.UXQProgressV9 && typeof window.UXQProgressV9.writeW1 === 'function') {
      window.UXQProgressV9.writeW1({
        cleared: progress.tutorialComplete || progress.bestStars >= 1,
        stars: progress.bestStars,
        score: progress.bestScore,
        rounds: progress.totalRounds,
        tutorialComplete: progress.tutorialComplete,
        source: 'w1-replay-v9'
      });
    }

    saveSession();

    try {
      window.dispatchEvent(new CustomEvent('uxquest:w1-complete', {
        detail: {
          stars: starCount,
          score: state.score,
          stability: state.stability,
          mode: state.mode,
          coreIds: [...state.coreIds]
        }
      }));
    } catch (error) {
      // Standalone play remains fully functional without an external bridge.
    }
  }

  function learningProfileText() {
    const skills = Object.keys(progress.familyStats);

    if (!skills.length) {
      return 'เริ่ม Tutorial เพื่อสร้าง Learning Profile ของคุณ';
    }

    const weakest = [...skills]
      .sort((a, b) => familyQuality(a) - familyQuality(b))
      .slice(0, 2)
      .map((skill) => SKILL_META[skill] || skill);

    const allStrong = skills.length >= 4 && weakest.every((skill) => familyQuality(Object.keys(SKILL_META).find((key) => SKILL_META[key] === skill)) >= 84);

    if (allStrong) {
      return 'ยังไม่พบจุดอ่อนชัดเจน — ลอง Transfer Challenge เพื่อพิสูจน์การใช้หลัก UX ในบริบทใหม่';
    }

    return `Challenge จะเลือกเคสจากทักษะที่ควรฝึกเพิ่ม เช่น ${weakest.join(' และ ')}`;
  }

  function completeRound() {
    state.complete = true;
    updateProgressFromRound(stars());
    // Do not restore a completed Tutorial on the next W1 visit.
    clearSession();
    render();
    scrollToTop();
  }

  function renderComplete() {
    const starCount = stars();
    const mode = currentMode();
    const challengeOpen = challengeUnlocked();
    const starsHtml = Array.from({ length: 3 }, (_, index) => `<span class="final-star ${index < starCount ? 'earned' : ''}">★</span>`).join('');

    const title = starCount === 3
      ? `${mode.title}: Expert`
      : starCount === 2
        ? `${mode.title}: Mastery`
        : starCount === 1
          ? `${mode.title}: Clear`
          : 'ต้องทบทวนอีกเล็กน้อย';

    stage.innerHTML = `
      <section class="complete-card">
        <p class="eyebrow">MISSION COMPLETE • ${escapeHtml(mode.badge)}</p>
        <div class="final-stars">${starsHtml}</div>
        <h2>${escapeHtml(title)}</h2>
        <p>คุณผ่าน ${state.caseIds.length} Case โดยฝึกเชื่อม User Goal → UI Symptom → UX Impact → Design Fix → User Test</p>

        <div class="complete-metrics">
          <div><span>Final Score</span><b>${state.score}</b></div>
          <div><span>Stability</span><b>${state.stability}</b></div>
          <div><span>Best Stars</span><b>${'★'.repeat(progress.bestStars)}${'☆'.repeat(3 - progress.bestStars)}</b></div>
        </div>

        <div class="principle-stack">
          <b>Learning Profile</b>
          <span>${escapeHtml(learningProfileText())}</span>
        </div>

        <div class="completion-action-grid">
          ${state.mode === 'tutorial' && starCount >= 1 ? `
            <a class="completion-action next-week" href="./w2-design-thinking-sprint.html?from=w1&stars=${progress.bestStars}&score=${progress.bestScore}&v=20260623-w1-v9">
              <span>→</span><strong>ต่อไป: W2 Design Thinking Sprint</strong><small>คุณผ่าน W1 แล้ว ไม่จำเป็นต้องเล่น Tutorial ซ้ำเพื่อปลดล็อก W2</small>
            </a>
          ` : ''}

          <button id="nextReplayBtn" class="completion-action replay" type="button">
            <span>↻</span><strong>เล่น Random Replay</strong><small>สุ่ม 5 Case ใหม่ • ไม่ใช้ Tutorial เดิมเป็นค่าเริ่มต้น</small>
          </button>

          <button id="nextChallengeBtn" class="completion-action challenge" type="button" ${challengeOpen ? '' : 'disabled'}>
            <span>⚡</span><strong>เริ่ม Transfer Challenge</strong><small>${challengeOpen ? 'เปลี่ยนบริบทและตัด Principle Hint เพื่อพิสูจน์ความเข้าใจ' : 'ปลดล็อกเมื่อ Tutorial ได้ 2 ดาว หรือผ่าน Replay 1 รอบ'}</small>
          </button>
        </div>

        <div class="stage-actions center-actions completion-footer">
          <button id="backModeBtn" class="secondary-btn" type="button">เลือกโหมด</button>
          <a class="secondary-btn" href="./index.html">กลับ Mission Control</a>
        </div>
      </section>
    `;

    $('#nextReplayBtn').addEventListener('click', () => {
      if (progress.tutorialComplete) {
        startRound('replay');
      }
    });

    $('#nextChallengeBtn').addEventListener('click', () => {
      if (challengeOpen) {
        startRound('challenge');
      }
    });

    $('#backModeBtn').addEventListener('click', returnToModeSelect);
  }

  function scrollToTop() {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function render() {
    updateHud();
    updateRail();

    if (!state.mode) {
      renderModeSelect();
      return;
    }

    if (state.complete) {
      renderComplete();
      return;
    }

    const renderStep = [
      renderObserve,
      renderDiagnose,
      renderFix,
      renderUserTest,
      renderExplain
    ][state.step] || renderObserve;

    renderStep();
  }

  function wireStaticEvents() {
    $('#howBtn').addEventListener('click', () => howDialog.showModal());

    document.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', () => {
        const dialog = $(`#${button.dataset.close}`);
        if (dialog) {
          dialog.close();
        }
      });
    });

    $('#resetBtn').addEventListener('click', () => {
      const action = $('#resetBtn').dataset.action;

      if (action === 'leave-round') {
        leaveRound();
      } else if (action === 'mode-select') {
        returnToModeSelect();
      } else {
        resetAllW1();
      }
    });

    [howDialog, feedbackDialog].forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        const bounds = dialog.getBoundingClientRect();
        const inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;

        if (!inside) {
          dialog.close();
        }
      });
    });
  }

  loadProgress();
  loadSession();
  wireStaticEvents();

  // Entry policy:
  // - Hub sends ?mode=tutorial only for first-time learners.
  // - After a pass, Hub sends ?mode=replay for fresh cases.
  // - Plain direct visits show the mode lobby; they never silently restart Tutorial.
  const request = requestedMode();
  const hasActiveRound = Boolean(state.mode && state.caseIds.length && !state.complete);

  if (!hasActiveRound && request && request !== 'resume') {
    if (request === 'tutorial') {
      startRound('tutorial');
    } else if (request === 'replay' && progress.tutorialComplete) {
      startRound('replay');
    } else if (request === 'challenge' && challengeUnlocked()) {
      startRound('challenge');
    } else {
      clearRequestedMode();
      render();
    }
  } else if (!hasActiveRound && !request && progress.tutorialComplete) {
    // A learner who already cleared W1 never falls back to Tutorial by accident.
    // Direct visits default to fresh Random Replay; Tutorial is review-only via ?mode=tutorial.
    startRound('replay');
  } else {
    render();
  }
})();
