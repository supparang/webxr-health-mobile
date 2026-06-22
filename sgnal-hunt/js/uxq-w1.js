// === /sgnal-hunt/js/uxq-w1.js ===
// UX Quest • W1 UX Detective
// V5 — Tutorial + Random Replay + Challenge + Progress Memory
// Mobile-first Case Investigation

(function () {
  'use strict';

  const CASE_BANK = Array.isArray(window.UXQ_W1_CASE_BANK)
    ? window.UXQ_W1_CASE_BANK
    : [];

  const FIRST_RUN = Array.isArray(window.UXQ_W1_FIRST_RUN)
    ? window.UXQ_W1_FIRST_RUN
    : (Array.isArray(window.UXQ_W1_CASES) ? window.UXQ_W1_CASES : []);

  const ROUND_SIZE = 5;
  const SESSION_KEY = 'uxquest-w1-session-v5';
  const PROGRESS_KEY = 'uxquest-w1-progress-v5';
  const LEGACY_SESSION_KEY = 'uxquest-w1-case-investigation-v4';

  const MODE_META = {
    tutorial: {
      short: 'Tutorial',
      label: 'First Run Tutorial',
      title: 'Tutorial Run',
      description: '5 เคสเรียงลำดับเพื่อฝึกวิธีคิด User Goal → UX Impact → Design Fix',
      badge: 'FOUNDATION'
    },
    replay: {
      short: 'Replay',
      label: 'Random Replay',
      title: 'Random Replay',
      description: 'สุ่ม 5 เคสจากคลัง 36 เคส โดยพยายามไม่ซ้ำกับ 2 รอบล่าสุด',
      badge: 'PRACTICE'
    },
    challenge: {
      short: 'Challenge',
      label: 'Transfer Challenge',
      title: 'Transfer Challenge',
      description: 'เคสต่างบริบทเพื่อพิสูจน์ว่าเข้าใจหลัก ไม่ได้จำเฉลย',
      badge: 'MASTERY'
    }
  };

  const FAMILY_META = {
    'entry-navigation': 'Entry & Navigation',
    'information-label': 'Information Label',
    'cta-action-clarity': 'CTA Clarity',
    'feedback-system-status': 'Feedback & Status',
    'information-priority': 'Information Priority',
    'confirmation-predictability': 'Confirmation'
  };

  const CASE_BY_ID = new Map(CASE_BANK.map((item) => [item.id, item]));
  const $ = (selector) => document.querySelector(selector);

  const stage = $('#gameStage');
  const feedbackDialog = $('#feedbackDialog');
  const feedbackContent = $('#feedbackContent');
  const howDialog = $('#howDialog');

  let progress = freshProgress();
  let state = freshState();

  function freshProgress() {
    return {
      version: 5,
      tutorialComplete: false,
      tutorialBestStars: 0,
      bestStars: 0,
      bestScore: 0,
      totalRounds: 0,
      replayWins: 0,
      challengeWins: 0,
      roundHistory: [],
      caseStats: {},
      familyStats: {},
      lastUpdated: null
    };
  }

  function freshState() {
    return {
      version: 5,
      mode: null,
      caseIds: [],
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function current() {
    return CASE_BY_ID.get(state.caseIds[state.caseIndex]) || null;
  }

  function currentMode() {
    return MODE_META[state.mode] || MODE_META.tutorial;
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

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
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
    try {
      const saved = safeParse(localStorage.getItem(PROGRESS_KEY), null);

      if (saved && typeof saved === 'object') {
        progress = {
          ...freshProgress(),
          ...saved,
          caseStats: saved.caseStats || {},
          familyStats: saved.familyStats || {},
          roundHistory: Array.isArray(saved.roundHistory)
            ? saved.roundHistory
            : []
        };
      }
    } catch (error) {
      console.warn('Could not load UX Quest progress.', error);
    }
  }

  function migrateLegacySession() {
    const legacy = safeParse(localStorage.getItem(LEGACY_SESSION_KEY), null);

    if (!legacy || legacy.complete || typeof legacy.caseIndex !== 'number') {
      return null;
    }

    return {
      ...freshState(),
      mode: 'tutorial',
      caseIds: FIRST_RUN.map((item) => item.id),
      caseVariants: buildCaseVariants(FIRST_RUN.map((item) => item.id)),
      caseIndex: clamp(
        legacy.caseIndex,
        0,
        Math.max(FIRST_RUN.length - 1, 0)
      ),
      step: clamp(legacy.step || 0, 0, 4),
      score: Number(legacy.score) || 0,
      stability: clamp(Number(legacy.stability) || 100, 0, 100),
      selectedSuspect: legacy.selectedSuspect || null,
      selectedDiagnosis: legacy.selectedDiagnosis || null,
      selectedFix: legacy.selectedFix || null,
      selectedExplain: Array.isArray(legacy.selectedExplain)
        ? legacy.selectedExplain
        : [],
      attempts: Number(legacy.attempts) || 0,
      answered: Array.isArray(legacy.answered) ? legacy.answered : [],
      startedAt: legacy.startedAt || Date.now()
    };
  }

  function loadSession() {
    try {
      const saved = safeParse(localStorage.getItem(SESSION_KEY), null);

      if (
        saved &&
        saved.mode &&
        Array.isArray(saved.caseIds) &&
        saved.caseIds.length
      ) {
        const validIds = saved.caseIds.filter((id) => CASE_BY_ID.has(id));

        if (validIds.length) {
          state = {
            ...freshState(),
            ...saved,
            caseIds: validIds,
            caseVariants: saved.caseVariants || buildCaseVariants(validIds),
            caseIndex: clamp(
              Number(saved.caseIndex) || 0,
              0,
              Math.max(validIds.length - 1, 0)
            ),
            step: clamp(Number(saved.step) || 0, 0, 4),
            selectedExplain: Array.isArray(saved.selectedExplain)
              ? saved.selectedExplain
              : [],
            answered: Array.isArray(saved.answered)
              ? saved.answered
              : []
          };

          return;
        }
      }

      const legacy = migrateLegacySession();

      if (legacy) {
        state = legacy;
        saveSession();
      }
    } catch (error) {
      console.warn('Could not load UX Quest session.', error);
    }
  }

  function resetAllW1() {
    const confirmed = confirm(
      'ล้างความคืบหน้า W1 ทั้งหมด? Tutorial, ดาว, Replay และสถิติในเครื่องนี้จะถูกลบ'
    );

    if (!confirmed) {
      return;
    }

    progress = freshProgress();
    state = freshState();

    try {
      localStorage.removeItem(PROGRESS_KEY);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LEGACY_SESSION_KEY);
    } catch (error) {
      console.warn('Could not reset UX Quest data.', error);
    }

    render();
  }

  function abandonRoundToModeSelect() {
    if (!state.mode) {
      return;
    }

    const confirmed = confirm(
      'ออกจากรอบปัจจุบัน? ระบบจะเก็บเฉพาะประวัติที่เล่นจบแล้ว'
    );

    if (!confirmed) {
      return;
    }

    state = freshState();
    clearSession();
    render();
  }

  function shuffle(items) {
    const clone = [...items];

    for (let index = clone.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));

      [clone[index], clone[target]] = [
        clone[target],
        clone[index]
      ];
    }

    return clone;
  }

  function unique(items) {
    return [...new Set(items)];
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
    if (!state.caseVariants || !state.caseVariants[caseData.id]) {
      state.caseVariants = {
        ...(state.caseVariants || {}),
        ...buildCaseVariants([caseData.id])
      };

      saveSession();
    }

    return state.caseVariants[caseData.id];
  }

  function orderById(items, ids) {
    const byId = new Map(items.map((item) => [item.id, item]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

    return ordered.length === items.length ? ordered : items;
  }

  function orderedAreas(caseData) {
    const variant = currentVariant(caseData);

    return orderById(caseData.screen.areas, variant.areaIds).map(
      (area, index) => ({
        ...area,
        label: ['A', 'B', 'C'][index] || String(index + 1)
      })
    );
  }

  function orderedDiagnosisOptions(caseData) {
    const variant = currentVariant(caseData);

    return orderById(
      caseData.diagnosis.options,
      variant.diagnosisIds
    );
  }

  function orderedFixOptions(caseData) {
    const variant = currentVariant(caseData);

    return orderById(caseData.fixes, variant.fixIds);
  }

  function orderedExplainChoices(caseData) {
    const variant = currentVariant(caseData);
    const choices = variant.explainChoices || [];

    return choices.length === caseData.explain.choices.length
      ? choices
      : caseData.explain.choices;
  }

  function recentCaseIds() {
    return unique(
      progress.roundHistory
        .filter((round) => round.mode !== 'tutorial')
        .slice(-2)
        .flatMap((round) => round.caseIds || [])
    );
  }

  function familyAverage(skill) {
    const family = progress.familyStats[skill];

    if (!family || !family.plays) {
      return 0;
    }

    return family.totalQuality / family.plays;
  }

  function buildRandomRound(mode) {
    const allSkills = unique(CASE_BANK.map((item) => item.skill));
    const recent = new Set(recentCaseIds());

    let selectedSkills;

    if (mode === 'challenge') {
      const ranked = [...allSkills].sort(
        (a, b) => familyAverage(a) - familyAverage(b)
      );

      const weakFirst = ranked.slice(0, 3);
      const remaining = shuffle(ranked.slice(3));

      selectedSkills = unique([
        ...weakFirst,
        ...remaining
      ]).slice(0, ROUND_SIZE);
    } else {
      selectedSkills = shuffle(allSkills).slice(0, ROUND_SIZE);
    }

    const selected = [];

    selectedSkills.forEach((skill) => {
      const familyCases = CASE_BANK.filter(
        (item) => item.skill === skill
      );

      const unseenRecently = familyCases.filter(
        (item) =>
          !recent.has(item.id) &&
          !selected.includes(item.id)
      );

      const candidates = unseenRecently.length
        ? unseenRecently
        : familyCases.filter(
          (item) => !selected.includes(item.id)
        );

      const picked = shuffle(candidates)[0];

      if (picked) {
        selected.push(picked.id);
      }
    });

    if (selected.length < ROUND_SIZE) {
      const fallback = shuffle(
        CASE_BANK.filter(
          (item) => !selected.includes(item.id)
        )
      );

      fallback
        .slice(0, ROUND_SIZE - selected.length)
        .forEach((item) => selected.push(item.id));
    }

    return shuffle(selected).slice(0, ROUND_SIZE);
  }

  function challengeUnlocked() {
    return (
      progress.tutorialBestStars >= 2 ||
      progress.replayWins >= 1
    );
  }

  function startRound(mode) {
    if (mode !== 'tutorial' && !progress.tutorialComplete) {
      return;
    }

    if (mode === 'challenge' && !challengeUnlocked()) {
      return;
    }

    const caseIds = mode === 'tutorial'
      ? FIRST_RUN.map((item) => item.id)
      : buildRandomRound(mode);

    state = {
      ...freshState(),
      mode,
      caseIds,
      caseVariants: buildCaseVariants(caseIds),
      startedAt: Date.now()
    };

    saveSession();
    render();
    scrollToTop();
  }

  function updateHud() {
    const isPlaying = Boolean(
      state.mode &&
      state.caseIds.length &&
      !state.complete
    );

    const mode = currentMode();

    $('#caseValue').textContent = isPlaying
      ? `${mode.short} ${state.caseIndex + 1}/${state.caseIds.length}`
      : 'เลือกโหมด';

    $('#scoreValue').textContent = isPlaying
      ? state.score
      : progress.bestScore || 0;

    $('#stabilityValue').textContent = isPlaying
      ? state.stability
      : 100;

    const resetButton = $('#resetBtn');

    if (isPlaying) {
      resetButton.textContent = 'ออกจากรอบ';
      resetButton.dataset.action = 'leave-round';
    } else {
      resetButton.textContent = 'ล้าง W1';
      resetButton.dataset.action = 'reset-all';
    }
  }

  function updateRail() {
    const playing = Boolean(
      state.mode &&
      state.caseIds.length &&
      !state.complete
    );

    document
      .querySelectorAll('#phaseRail .phase')
      .forEach((node, index) => {
        node.classList.toggle(
          'active',
          playing && index === state.step
        );

        node.classList.toggle(
          'done',
          playing && index < state.step
        );
      });
  }

  function showFeedback({
    title,
    verdict,
    message,
    principle,
    continueLabel = 'ทำขั้นตอนถัดไป →'
  }) {
    const showPrinciple = Boolean(
      principle && state.mode !== 'challenge'
    );

    feedbackContent.innerHTML = `
      <p class="eyebrow">CASE FEEDBACK</p>
      <h2>${escapeHtml(title)}</h2>

      <div class="verdict ${verdict === 'correct' ? 'good' : 'retry'}">
        ${
          verdict === 'correct'
            ? '✓ วิเคราะห์ได้ตรงประเด็น'
            : '↻ ลองคิดจากเป้าหมายผู้ใช้อีกครั้ง'
        }
      </div>

      <p>${escapeHtml(message)}</p>

      ${
        showPrinciple
          ? `
            <div class="principle-card">
              <b>Principle</b>
              <span>${escapeHtml(principle)}</span>
            </div>
          `
          : ''
      }

      <button id="feedbackContinue" class="primary-btn full-btn" type="button">
        ${escapeHtml(continueLabel)}
      </button>
    `;

    feedbackDialog.showModal();

    $('#feedbackContinue').addEventListener(
      'click',
      () => feedbackDialog.close(),
      { once: true }
    );
  }

  function penalty(base) {
    const multiplier = state.mode === 'challenge' ? 1.25 : 1;

    return Math.ceil(base * multiplier);
  }

  function addMistake(basePenalty) {
    state.attempts += 1;
    state.stability = clamp(
      state.stability - penalty(basePenalty),
      0,
      100
    );

    saveSession();
  }

  function caseModeKicker(caseData) {
    const mode = currentMode();
    const family = FAMILY_META[caseData.skill] || 'UX Investigation';

    const familyChip = state.mode === 'challenge'
      ? ''
      : `<span>${escapeHtml(family)}</span>`;

    return `
      <div class="case-kicker">
        <span>${mode.badge}</span>
        <span>CASE ${state.caseIndex + 1} / ${state.caseIds.length}</span>
        ${familyChip}
      </div>
    `;
  }

  function suspectOption(area) {
    const isSelected = state.selectedSuspect === area.id;

    const detail = Array.isArray(area.detail)
      ? area.detail.join(' • ')
      : area.detail;

    return `
      <button
        class="answer-option ${isSelected ? 'selected' : ''}"
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

  function cardScreen(
    caseData,
    displayAreas = orderedAreas(caseData)
  ) {
    const area = (item) => {
      const isSelected = state.selectedSuspect === item.id;

      const detail = Array.isArray(item.detail)
        ? `
          <div class="chip-stack">
            ${item.detail
              .map((value) => `<span>${escapeHtml(value)}</span>`)
              .join('')}
          </div>
        `
        : `<span>${escapeHtml(item.detail)}</span>`;

      return `
        <button
          class="suspect-zone ${isSelected ? 'selected' : ''}"
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
      <div
        class="screen-shell"
        aria-label="หน้าจอจำลองของบริการ ${escapeHtml(caseData.service)}"
      >
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
    const tutorialDone = progress.tutorialComplete;
    const challengeOpen = challengeUnlocked();

    const replayHistory = progress.roundHistory.filter(
      (round) => round.mode === 'replay'
    );

    const bestLabel = progress.bestStars
      ? `${'★'.repeat(progress.bestStars)}${'☆'.repeat(3 - progress.bestStars)}`
      : '☆☆☆';

    stage.innerHTML = `
      <section class="complete-card">
        <p class="eyebrow">W1 • UX DETECTIVE</p>
        <h2>เลือกโหมดภารกิจ</h2>

        <p>
          รอบแรกจะสอนวิธีคิดทีละขั้น ส่วน Replay จะสุ่มเคสใหม่จากคลัง 36 เคส
          เพื่อให้คุณฝึกใช้หลัก UX กับบริบทที่ไม่ซ้ำเดิม
        </p>

        <div class="complete-metrics">
          <div>
            <span>Case Bank</span>
            <b>${CASE_BANK.length}</b>
          </div>

          <div>
            <span>Best Stars</span>
            <b>${bestLabel}</b>
          </div>

          <div>
            <span>Rounds Finished</span>
            <b>${progress.totalRounds}</b>
          </div>
        </div>

        <div class="answer-list">
          <button id="startTutorial" class="answer-option" type="button">
            <span class="radio-dot"></span>
            <span>
              <strong>1. ${tutorialDone ? 'Review Tutorial' : 'First Run Tutorial'}</strong>
              <br />
              <small>5 เคสสาธิตแบบมีโครงช่วยคิด เหมาะสำหรับเริ่มเรียน W1</small>
            </span>
          </button>

          <button
            id="startReplay"
            class="answer-option"
            type="button"
            ${tutorialDone ? '' : 'disabled'}
          >
            <span class="radio-dot"></span>
            <span>
              <strong>2. Random Replay</strong>
              <br />
              <small>
                ${
                  tutorialDone
                    ? `สุ่ม 5 เคสจาก 36 เคส • จบรอบ Replay แล้ว ${replayHistory.length} รอบ`
                    : 'ผ่าน Tutorial ก่อนจึงจะเปิด Replay'
                }
              </small>
            </span>
          </button>

          <button
            id="startChallenge"
            class="answer-option"
            type="button"
            ${challengeOpen ? '' : 'disabled'}
          >
            <span class="radio-dot"></span>
            <span>
              <strong>3. Transfer Challenge</strong>
              <br />
              <small>
                ${
                  challengeOpen
                    ? 'สุ่มเคสต่างบริบท เน้นตัดสินใจจาก User Goal โดยไม่มี Principle Hint ระหว่างผิด'
                    : 'ปลดล็อกเมื่อ Tutorial ได้อย่างน้อย 2 ดาว หรือผ่าน Replay 1 รอบ'
                }
              </small>
            </span>
          </button>
        </div>

        <div class="principle-stack">
          <b>W1 Learning Loop</b>
          <span>
            User Goal → UI Symptom → UX Impact → Design Fix → User Test → Explain
          </span>
        </div>
      </section>
    `;

    $('#startTutorial').addEventListener(
      'click',
      () => startRound('tutorial')
    );

    $('#startReplay').addEventListener('click', () => {
      if (progress.tutorialComplete) {
        startRound('replay');
      }
    });

    $('#startChallenge').addEventListener('click', () => {
      if (challengeUnlocked()) {
        startRound('challenge');
      }
    });
  }

  function renderObserve() {
    const caseData = current();

    if (!caseData) {
      state = freshState();
      clearSession();
      render();
      return;
    }

    const displayAreas = orderedAreas(caseData);

    stage.innerHTML = `
      <section class="case-layout">
        <article class="mission-card">
          ${caseModeKicker(caseData)}
          <h2>${escapeHtml(caseData.title)}</h2>

          <div class="goal-card">
            <span>USER GOAL</span>
            <b>${escapeHtml(caseData.goal)}</b>
          </div>

          <p class="evidence-detail">“${escapeHtml(caseData.quote)}”</p>

          <p class="muted tiny">
            <b>ผู้ใช้:</b> ${escapeHtml(caseData.persona)}
          </p>

          <h3 class="question-title">
            จากเป้าหมายและคำพูดของผู้ใช้ จุดใดควรตรวจสอบก่อน?
          </h3>

          <div class="answer-list">
            ${displayAreas.map(suspectOption).join('')}
          </div>

          <div class="stage-actions">
            <button
              id="observeNext"
              class="primary-btn full-btn"
              type="button"
              ${state.selectedSuspect ? '' : 'disabled'}
            >
              เก็บหลักฐานและวิเคราะห์ →
            </button>
          </div>

          <p class="muted tiny">
            เลือกคำตอบจากรายการด้านบนได้ทันที
            ไม่ต้องเลื่อนหาปุ่ม A/B/C ในหน้าจอจำลอง
          </p>
        </article>

        <article class="screen-card">
          ${cardScreen(caseData, displayAreas)}

          <div class="screen-caption">
            หน้าจอจำลองสำหรับดูบริบทเพิ่มเติม
            หรือแตะ A/B/C บนจอนี้ได้เช่นกัน
          </div>
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
          message:
            'ลองย้อนกลับไปดู User Goal: ผู้ใช้ต้องการทำอะไรให้สำเร็จ และส่วนใดขวางเป้าหมายนั้นมากที่สุด?',
          principle: 'Start from the user goal',
          continueLabel: 'เลือกคำตอบใหม่'
        });

        feedbackDialog.addEventListener(
          'close',
          () => {
            state.selectedSuspect = null;
            saveSession();
            renderObserve();
          },
          { once: true }
        );

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
      <button
        class="answer-option ${selected ? 'selected' : ''}"
        data-answer="${escapeHtml(option.id)}"
        type="button"
      >
        <span class="radio-dot"></span>
        <span>${escapeHtml(option.text)}</span>
      </button>
    `;
  }

  function renderDiagnose() {
    const caseData = current();

    const suspectArea = orderedAreas(caseData).find(
      (item) => item.id === caseData.suspectId
    );

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

            <div>
              <b>วิเคราะห์ UI → UX</b>
              <p>
                เลือกคำอธิบายที่เชื่อมสิ่งที่เห็นบนหน้าจอ
                กับผลที่เกิดกับเป้าหมายของผู้ใช้ได้ดีที่สุด
              </p>
            </div>
          </div>

          <h3 class="question-title">
            ${escapeHtml(caseData.diagnosis.prompt)}
          </h3>

          <div class="answer-list">
            ${orderedDiagnosisOptions(caseData)
              .map((option) => radioOption(option, 'selectedDiagnosis'))
              .join('')}
          </div>
        </article>
      </section>

      <div class="stage-actions left-actions">
        <button
          id="diagnoseNext"
          class="primary-btn"
          type="button"
          ${state.selectedDiagnosis ? '' : 'disabled'}
        >
          ยืนยันการวิเคราะห์ →
        </button>
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
      const picked = caseData.diagnosis.options.find(
        (option) => option.id === state.selectedDiagnosis
      );

      if (!picked) {
        return;
      }

      if (!picked.correct) {
        addMistake(5);

        showFeedback({
          title: 'ยังเชื่อมกับผู้ใช้ไม่พอ',
          verdict: 'retry',
          message:
            'คำตอบที่แข็งแรงต้องอธิบายได้ทั้ง UI symptom และ UX impact ไม่ใช่เพียงบอกว่าสิ่งใดดูสวยหรือไม่สวย',
          principle: 'UI affects UX',
          continueLabel: 'เลือกคำตอบใหม่'
        });

        feedbackDialog.addEventListener(
          'close',
          () => {
            state.selectedDiagnosis = null;
            saveSession();
            renderDiagnose();
          },
          { once: true }
        );

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

          <p class="muted">
            เลือกวิธีแก้ที่ตอบ User Goal มากที่สุด
            ไม่ใช่วิธีที่ดูสวยเพียงอย่างเดียว
          </p>

          <div class="instruction-card">
            <span class="step-badge">STEP 3</span>

            <div>
              <b>เลือก Design Fix</b>
              <p>
                ทุกทางเลือกทำได้ในเชิงเทคนิค
                แต่มีเพียงหนึ่งแนวทางที่แก้ต้นเหตุของความติดขัด
              </p>
            </div>
          </div>

          <div class="answer-list fix-list">
            ${orderedFixOptions(caseData)
              .map((option) => radioOption(option, 'selectedFix'))
              .join('')}
          </div>
        </article>
      </section>

      <div class="stage-actions left-actions">
        <button
          id="fixNext"
          class="primary-btn"
          type="button"
          ${state.selectedFix ? '' : 'disabled'}
        >
          ทดสอบกับผู้ใช้ →
        </button>
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
      const picked = caseData.fixes.find(
        (option) => option.id === state.selectedFix
      );

      if (!picked) {
        return;
      }

      if (!picked.correct) {
        addMistake(7);

        showFeedback({
          title: 'การแก้นี้ยังไม่ตรงต้นเหตุ',
          verdict: 'retry',
          message:
            'ลองกลับมาถามว่า วิธีนี้ทำให้ผู้ใช้บรรลุ User Goal ได้ชัดเจนขึ้นจริงหรือไม่?',
          principle: caseData.diagnosis.principle,
          continueLabel: 'เลือกวิธีแก้ใหม่'
        });

        feedbackDialog.addEventListener(
          'close',
          () => {
            state.selectedFix = null;
            saveSession();
            renderFix();
          },
          { once: true }
        );

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

        <div>
          <b class="before">${escapeHtml(String(before))}${symbol}</b>
          <i>→</i>
          <b class="after">${escapeHtml(String(after))}${symbol}</b>
        </div>
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

            <div>
              <b>ดูผลที่เกิดกับผู้ใช้</b>
              <p>
                การแก้ที่ดีไม่ใช่เพียงหน้าจอดูดีขึ้น
                แต่ต้องช่วยให้ผู้ใช้สำเร็จเร็วขึ้นและมั่นใจขึ้น
              </p>
            </div>
          </div>

          <div class="metric-grid">
            ${metric(
              'Task success',
              result.before.success,
              result.after.success,
              '%'
            )}

            ${metric(
              'Time to finish',
              result.before.time,
              result.after.time
            )}

            ${metric(
              'User confidence',
              result.before.confidence,
              result.after.confidence,
              '%'
            )}
          </div>

          <div class="test-insight">
            <b>สิ่งที่ควรจำ</b>
            <span>
              Design decision ต้องเชื่อมกับผลลัพธ์ที่ผู้ใช้สัมผัสได้
            </span>
          </div>
        </article>
      </section>

      <div class="stage-actions left-actions">
        <button id="testNext" class="primary-btn" type="button">
          อธิบายเหตุผล →
        </button>
      </div>
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

            <div>
              <b>เลือก 2 ผลลัพธ์ที่เกิดกับผู้ใช้จริง</b>
              <p>
                ไม่ใช่คำที่ฟังดูดี
                แต่เป็นผลลัพธ์ที่ตามมาจาก Design Fix ของคุณ
              </p>
            </div>
          </div>

          <h3 class="question-title">
            ${escapeHtml(caseData.explain.prompt)}
          </h3>

          <div class="choice-grid">
            ${orderedExplainChoices(caseData)
              .map(
                (choice) => `
                  <button
                    class="explain-chip ${
                      selected.has(choice) ? 'selected' : ''
                    }"
                    data-explain="${escapeHtml(choice)}"
                    type="button"
                  >
                    ${escapeHtml(choice)}
                  </button>
                `
              )
              .join('')}
          </div>

          <p class="selection-note">
            เลือกแล้ว ${state.selectedExplain.length}/2
          </p>
        </article>
      </section>

      <div class="stage-actions left-actions">
        <button
          id="explainNext"
          class="primary-btn"
          type="button"
          ${state.selectedExplain.length === 2 ? '' : 'disabled'}
        >
          ${
            state.caseIndex === state.caseIds.length - 1
              ? 'สรุปผลภารกิจ →'
              : 'ไป Case ถัดไป →'
          }
        </button>
      </div>
    `;

    document.querySelectorAll('[data-explain]').forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.dataset.explain;
        const selectedChoices = new Set(state.selectedExplain);

        if (selectedChoices.has(value)) {
          selectedChoices.delete(value);
        } else if (selectedChoices.size < 2) {
          selectedChoices.add(value);
        }

        state.selectedExplain = Array.from(selectedChoices);
        saveSession();
        renderExplain();
      });
    });

    $('#explainNext').addEventListener('click', () => {
      if (state.selectedExplain.length !== 2) {
        return;
      }

      const correct =
        state.selectedExplain.every((choice) =>
          caseData.explain.correct.includes(choice)
        ) &&
        caseData.explain.correct.every((choice) =>
          state.selectedExplain.includes(choice)
        );

      if (!correct) {
        addMistake(5);

        showFeedback({
          title: 'ลองเชื่อมกับผล User Test',
          verdict: 'retry',
          message:
            'เลือกคำที่อธิบายว่าผู้ใช้ทำเป้าหมายได้ดีขึ้นอย่างไร จากผลการทดสอบที่คุณเพิ่งเห็น',
          principle: caseData.diagnosis.principle,
          continueLabel: 'เลือกคำตอบใหม่'
        });

        feedbackDialog.addEventListener(
          'close',
          () => {
            state.selectedExplain = [];
            saveSession();
            renderExplain();
          },
          { once: true }
        );

        return;
      }

      state.score += 20;

      state.answered.push({
        caseId: caseData.id,
        skill: caseData.skill,
        attempts: state.attempts,
        quality: clamp(
          100 - (state.attempts * 16),
          35,
          100
        )
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
    const thresholds = state.mode === 'challenge'
      ? { three: 86, two: 70, one: 52 }
      : { three: 80, two: 60, one: 38 };

    if (
      state.score >= 320 &&
      state.stability >= thresholds.three
    ) {
      return 3;
    }

    if (
      state.score >= 260 &&
      state.stability >= thresholds.two
    ) {
      return 2;
    }

    if (
      state.score >= 200 &&
      state.stability >= thresholds.one
    ) {
      return 1;
    }

    return 0;
  }

  function updateProgressFromRound(starCount) {
    if (state.roundRecorded) {
      return;
    }

    const round = {
      id: `w1-${Date.now()}`,
      mode: state.mode,
      score: state.score,
      stability: state.stability,
      stars: starCount,
      caseIds: [...state.caseIds],
      completedAt: new Date().toISOString()
    };

    progress.totalRounds += 1;
    progress.bestScore = Math.max(
      progress.bestScore || 0,
      state.score
    );

    progress.bestStars = Math.max(
      progress.bestStars || 0,
      starCount
    );

    if (state.mode === 'tutorial') {
      progress.tutorialComplete =
        progress.tutorialComplete || starCount >= 1;

      progress.tutorialBestStars = Math.max(
        progress.tutorialBestStars || 0,
        starCount
      );
    }

    if (state.mode === 'replay' && starCount >= 1) {
      progress.replayWins += 1;
    }

    if (state.mode === 'challenge' && starCount >= 1) {
      progress.challengeWins += 1;
    }

    state.answered.forEach((answer) => {
      const caseRecord = progress.caseStats[answer.caseId] || {
        plays: 0,
        totalQuality: 0,
        bestQuality: 0,
        totalAttempts: 0,
        lastPlayed: null
      };

      caseRecord.plays += 1;
      caseRecord.totalQuality += answer.quality;
      caseRecord.bestQuality = Math.max(
        caseRecord.bestQuality,
        answer.quality
      );

      caseRecord.totalAttempts += answer.attempts;
      caseRecord.lastPlayed = round.completedAt;

      progress.caseStats[answer.caseId] = caseRecord;

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

    progress.roundHistory = [
      ...progress.roundHistory,
      round
    ].slice(-12);

    state.roundRecorded = true;

    saveProgress();
    saveSession();

    try {
      window.dispatchEvent(
        new CustomEvent('uxquest:w1-complete', {
          detail: {
            stars: starCount,
            score: state.score,
            stability: state.stability,
            mode: state.mode
          }
        })
      );
    } catch (error) {
      // ใช้ได้แม้เป็น standalone prototype
    }
  }

  function skillSummary() {
    const playedSkills = Object.keys(progress.familyStats);

    if (!playedSkills.length) {
      return 'ยังไม่มีข้อมูลทักษะสะสม — เริ่ม Tutorial เพื่อสร้าง Learning Profile';
    }

    const weakest = [...playedSkills]
      .sort((a, b) => familyAverage(a) - familyAverage(b))
      .slice(0, 2)
      .map((skill) => FAMILY_META[skill] || skill);

    return `โหมด Challenge จะเลือกเคสจากจุดที่ควรฝึกเพิ่ม เช่น ${weakest.join(' และ ')}`;
  }

  function completeRound() {
    state.complete = true;

    const starCount = stars();

    updateProgressFromRound(starCount);
    render();
    scrollToTop();
  }

  function renderComplete() {
    const starCount = stars();
    const mode = currentMode();

    const starsHtml = Array.from(
      { length: 3 },
      (_, index) => `
        <span class="final-star ${
          index < starCount ? 'earned' : ''
        }">★</span>
      `
    ).join('');

    const title = starCount === 3
      ? `${mode.title}: Expert`
      : starCount === 2
        ? `${mode.title}: Mastery`
        : starCount === 1
          ? `${mode.title}: Clear`
          : 'ต้องทบทวนอีกเล็กน้อย';

    const challengeOpen = challengeUnlocked();

    stage.innerHTML = `
      <section class="complete-card">
        <p class="eyebrow">
          MISSION COMPLETE • ${escapeHtml(mode.badge)}
        </p>

        <div class="final-stars">${starsHtml}</div>

        <h2>${escapeHtml(title)}</h2>

        <p>
          คุณผ่าน ${state.caseIds.length} Case โดยฝึกเชื่อม
          User Goal → UI Symptom → UX Impact → Design Fix → User Test
        </p>

        <div class="complete-metrics">
          <div>
            <span>Final Score</span>
            <b>${state.score}</b>
          </div>

          <div>
            <span>Stability</span>
            <b>${state.stability}</b>
          </div>

          <div>
            <span>Best Stars</span>
            <b>
              ${'★'.repeat(progress.bestStars)}
              ${'☆'.repeat(3 - progress.bestStars)}
            </b>
          </div>
        </div>

        <div class="principle-stack">
          <b>Learning Profile</b>
          <span>${escapeHtml(skillSummary())}</span>
        </div>

        <div class="answer-list">
          <button
            id="nextReplayBtn"
            class="answer-option"
            type="button"
          >
            <span class="radio-dot"></span>

            <span>
              <strong>Random Replay</strong>
              <br />
              <small>
                สุ่ม 5 เคสใหม่ โดยพยายามไม่ให้ซ้ำกับ 2 รอบล่าสุด
              </small>
            </span>
          </button>

          <button
            id="nextChallengeBtn"
            class="answer-option"
            type="button"
            ${challengeOpen ? '' : 'disabled'}
          >
            <span class="radio-dot"></span>

            <span>
              <strong>Transfer Challenge</strong>
              <br />
              <small>
                ${
                  challengeOpen
                    ? 'ฝึกใช้หลัก UX กับบริบทใหม่และมี Stability Gate ที่เข้มขึ้น'
                    : 'ปลดล็อกเมื่อ Tutorial ได้อย่างน้อย 2 ดาว หรือผ่าน Replay 1 รอบ'
                }
              </small>
            </span>
          </button>
        </div>

        <div class="stage-actions center-actions">
          <button
            id="backModeBtn"
            class="ghost-btn"
            type="button"
          >
            กลับเลือกโหมด
          </button>

          <a class="ghost-btn" href="./index.html">
            กลับ Mission Control
          </a>
        </div>
      </section>
    `;

    $('#nextReplayBtn').addEventListener(
      'click',
      () => startRound('replay')
    );

    $('#nextChallengeBtn').addEventListener('click', () => {
      if (challengeUnlocked()) {
        startRound('challenge');
      }
    });

    $('#backModeBtn').addEventListener('click', () => {
      state = freshState();
      clearSession();
      render();
      scrollToTop();
    });
  }

  function scrollToTop() {
    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
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

    const renderSteps = [
      renderObserve,
      renderDiagnose,
      renderFix,
      renderUserTest,
      renderExplain
    ];

    const renderStep = renderSteps[state.step] || renderObserve;
    renderStep();
  }

  function wireStaticEvents() {
    $('#howBtn').addEventListener('click', () => {
      howDialog.showModal();
    });

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
        abandonRoundToModeSelect();
      }

      if (action === 'reset-all') {
        resetAllW1();
      }
    });

    [howDialog, feedbackDialog].forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        const bounds = dialog.getBoundingClientRect();

        const clickedInsideDialog =
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom;

        if (!clickedInsideDialog) {
          dialog.close();
        }
      });
    });
  }

  loadProgress();
  loadSession();
  wireStaticEvents();
  render();
})();
