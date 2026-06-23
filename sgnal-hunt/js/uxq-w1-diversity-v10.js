// === /sgnal-hunt/js/uxq-w1-diversity-v10.js ===
// UX Quest • W1 UX Detective • Diversity Game Engine V10
// Compatible with uxq-w1-data-v10.js (coreCases / tutorialCases / scenarioVariants).
// Tutorial runs once; passed learners enter Random Replay by default.

(function () {
  'use strict';

  const DATA = window.UXQ_W1_DIVERSITY_V10;
  const BRIDGE = window.UXQProgressV9 || null;

  const CONTENT_KEY = 'csai2601-uxquest-w1-diversity-v10';
  const SESSION_KEY = 'csai2601-uxquest-w1-diversity-session-v10';
  const ROUND_SIZE = 5;
  const PHASES = ['observe', 'diagnose', 'fix', 'test', 'explain'];

  const PHASE_LABELS = {
    observe: 'Observe',
    diagnose: 'Diagnose',
    fix: 'Design Fix',
    test: 'User Test',
    explain: 'Explain'
  };

  const FORMAT_ICONS = {
    'evidence-triage': '⌁',
    'goal-route': '↗',
    'ui-ux-split': '⇄',
    'budget-tradeoff': '◈',
    'ab-audit': 'A/B',
    'test-forecast': '◌'
  };

  const stage = document.querySelector('#gameStage');
  const feedbackDialog = document.querySelector('#feedbackDialog');
  const feedbackContent = document.querySelector('#feedbackContent');
  const howDialog = document.querySelector('#howDialog');
  const caseValue = document.querySelector('#caseValue');
  const scoreValue = document.querySelector('#scoreValue');
  const stabilityValue = document.querySelector('#stabilityValue');
  const phaseRail = document.querySelector('#phaseRail');

  if (
    !stage ||
    !DATA ||
    !Array.isArray(DATA.coreCases) ||
    !Array.isArray(DATA.tutorialCases)
  ) {
    if (stage) {
      stage.innerHTML = `
        <section class="single-layout">
          <article class="complete-card">
            <p class="eyebrow">W1 LOAD CHECK</p>
            <h2>ยังโหลดชุดข้อมูลภารกิจไม่ครบ</h2>
            <p>
              ตรวจว่า <code>uxq-w1-data-v10.js</code>
              ถูกอัปโหลดและเรียกก่อน Game Engine
            </p>
          </article>
        </section>
      `;
    }
    return;
  }

  const CORES = DATA.coreCases.map(clone);

  const TUTORIAL = DATA.tutorialCases.map(clone);

  const VARIANTS = Array.isArray(DATA.scenarioVariants)
    ? DATA.scenarioVariants.map(clone)
    : [];

  const FORMAT_IDS = Object.keys(DATA.formatMeta || {});

  const CORE_BY_ID = new Map(
    CORES.map((item) => [item.id, item])
  );

  const TUTORIAL_IDS = new Set(
    TUTORIAL.map((item) => item.id)
  );

  let progress = loadProgress();

  let state = loadSession() || freshState();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
  }

  function shuffled(items) {
    const copy = [...items];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));

      [copy[index], copy[target]] = [
        copy[target],
        copy[index]
      ];
    }

    return copy;
  }

  function hash(text) {
    let result = 0;

    String(text).split('').forEach((character) => {
      result = ((result << 5) - result) + character.charCodeAt(0);
      result |= 0;
    });

    return result;
  }

  function freshProgress() {
    return {
      version: 10,
      updatedAt: null,

      tutorialComplete: false,
      tutorialBestStars: 0,

      bestStars: 0,
      bestScore: 0,

      totalRounds: 0,
      replayWins: 0,
      challengeWins: 0,

      recentContextIds: [],

      typeStats: {},

      variantHistory: {},

      replayCycle: {
        cycle: 1,
        roundsInCycle: 0,
        seenCoreIds: []
      },

      roundHistory: []
    };
  }

  function freshState() {
    return {
      mode: null,

      casePlan: [],
      caseIndex: 0,
      stepIndex: 0,

      score: 0,
      stability: 100,

      wrongAttempts: 0,
      correctSteps: 0,

      selections: {},
      phaseAttempts: {},
      answerLog: [],

      startedAt: null,
      finished: false
    };
  }

  function readBridgeW1() {
    if (!BRIDGE || typeof BRIDGE.readW1 !== 'function') {
      return {
        cleared: false,
        stars: 0,
        score: 0,
        rounds: 0,
        tutorialComplete: false
      };
    }

    try {
      return BRIDGE.readW1() || {};
    } catch (error) {
      return {
        cleared: false,
        stars: 0,
        score: 0,
        rounds: 0,
        tutorialComplete: false
      };
    }
  }

  function normalizeProgress(saved) {
    const base = freshProgress();

    const result = {
      ...base,
      ...(saved && typeof saved === 'object' ? saved : {}),

      replayCycle: {
        ...base.replayCycle,
        ...(saved?.replayCycle || {})
      },

      typeStats:
        saved?.typeStats &&
        typeof saved.typeStats === 'object'
          ? saved.typeStats
          : {},

      variantHistory:
        saved?.variantHistory &&
        typeof saved.variantHistory === 'object'
          ? saved.variantHistory
          : {},

      recentContextIds: Array.isArray(saved?.recentContextIds)
        ? saved.recentContextIds.slice(-16)
        : [],

      roundHistory: Array.isArray(saved?.roundHistory)
        ? saved.roundHistory.slice(-36)
        : []
    };

    result.replayCycle.seenCoreIds = Array.isArray(
      result.replayCycle.seenCoreIds
    )
      ? result.replayCycle.seenCoreIds.filter((id) =>
          CORE_BY_ID.has(id)
        )
      : [];

    return result;
  }

  function loadProgress() {
    const saved = safeParse(
      localStorage.getItem(CONTENT_KEY),
      null
    );

    const result = normalizeProgress(saved);

    const canonical = readBridgeW1();

    if (
      canonical.cleared ||
      canonical.tutorialComplete ||
      number(canonical.stars) >= 1
    ) {
      result.tutorialComplete = true;

      result.tutorialBestStars = Math.max(
        result.tutorialBestStars,
        number(canonical.stars, 1)
      );

      result.bestStars = Math.max(
        result.bestStars,
        number(canonical.stars, 1)
      );

      result.bestScore = Math.max(
        result.bestScore,
        number(canonical.score)
      );
    }

    persistProgress(result);

    return result;
  }

  function persistProgress(next = progress) {
    next.updatedAt = new Date().toISOString();

    try {
      localStorage.setItem(
        CONTENT_KEY,
        JSON.stringify(next)
      );
    } catch (error) {
      console.warn(
        '[UXQ W1 V10] Progress was not saved.',
        error
      );
    }
  }

  function normalizeState(saved) {
    if (
      !saved ||
      typeof saved !== 'object' ||
      saved.finished ||
      !saved.mode
    ) {
      return null;
    }

    const plan = Array.isArray(saved.casePlan)
      ? saved.casePlan.filter((entry) =>
          CORE_BY_ID.has(entry?.coreId)
        )
      : [];

    if (!plan.length) {
      return null;
    }

    return {
      ...freshState(),
      ...saved,

      casePlan: plan,

      caseIndex: clamp(
        number(saved.caseIndex),
        0,
        plan.length - 1
      ),

      stepIndex: clamp(
        number(saved.stepIndex),
        0,
        PHASES.length - 1
      ),

      selections:
        saved.selections &&
        typeof saved.selections === 'object'
          ? saved.selections
          : {},

      phaseAttempts:
        saved.phaseAttempts &&
        typeof saved.phaseAttempts === 'object'
          ? saved.phaseAttempts
          : {},

      answerLog: Array.isArray(saved.answerLog)
        ? saved.answerLog
        : [],

      stability: clamp(
        number(saved.stability, 100),
        0,
        100
      ),

      score: Math.max(
        0,
        number(saved.score)
      ),

      wrongAttempts: Math.max(
        0,
        number(saved.wrongAttempts)
      ),

      correctSteps: Math.max(
        0,
        number(saved.correctSteps)
      )
    };
  }

  function loadSession() {
    return normalizeState(
      safeParse(
        localStorage.getItem(SESSION_KEY),
        null
      )
    );
  }

  function persistSession() {
    if (!state.mode || state.finished) {
      return;
    }

    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      console.warn(
        '[UXQ W1 V10] Session was not saved.',
        error
      );
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      // Ignore storage restriction.
    }
  }

  function isPassed() {
    const canonical = readBridgeW1();

    return Boolean(
      progress.tutorialComplete ||
      canonical.cleared ||
      canonical.tutorialComplete ||
      number(canonical.stars) >= 1
    );
  }

  function modeMeta(mode) {
    const map = {
      tutorial: {
        label: 'Tutorial Run',
        badge: 'FOUNDATION',
        icon: '✦'
      },

      replay: {
        label: 'Random Replay',
        badge: 'PRACTICE',
        icon: '↻'
      },

      challenge: {
        label: 'Transfer Challenge',
        badge: 'MASTERY',
        icon: '◆'
      }
    };

    return map[mode] || {
      label: 'W1',
      badge: 'MISSION',
      icon: '•'
    };
  }

  function currentPlanItem() {
    return state.casePlan[state.caseIndex] || null;
  }

  function currentCase() {
    const entry = currentPlanItem();

    const core = entry
      ? CORE_BY_ID.get(entry.coreId)
      : null;

    const variant = entry
      ? VARIANTS.find(
          (item) => item.id === entry.variantId
        )
      : null;

    if (!core) {
      return null;
    }

    const result = clone(core);

    result.scenarioVariant = variant
      ? clone(variant)
      : null;

    result.contextCondition =
      variant?.condition ||
      'ผู้ใช้กำลังพยายามทำงานนี้ให้เสร็จ';

    result.contextLens =
      variant?.lens ||
      'ทำให้เส้นทางหลักชัดเจน';

    result.quote = variant?.quoteSuffix
      ? `${result.quote} — ${variant.quoteSuffix}`
      : result.quote;

    return result;
  }

  function selectionFor(caseId) {
    if (!state.selections[caseId]) {
      state.selections[caseId] = {
        observe: null,
        diagnose: null,
        fix: null,
        test: null,
        explain: []
      };
    }

    return state.selections[caseId];
  }

  function attemptsFor(caseId, phase) {
    const key = `${caseId}::${phase}`;

    return Math.max(
      0,
      number(state.phaseAttempts[key])
    );
  }

  function addAttempt(caseId, phase) {
    const key = `${caseId}::${phase}`;

    state.phaseAttempts[key] =
      attemptsFor(caseId, phase) + 1;
  }

  function typeStat(formatId) {
    const current =
      progress.typeStats[formatId] || {};

    return {
      correct: Math.max(
        0,
        number(current.correct)
      ),

      attempts: Math.max(
        0,
        number(current.attempts)
      )
    };
  }

  function registerTypePerformance(
    formatId,
    correct
  ) {
    const stat = typeStat(formatId);

    stat.attempts += 1;

    if (correct) {
      stat.correct += 1;
    }

    progress.typeStats[formatId] = stat;
  }

  function accuracyForType(formatId) {
    const stat = typeStat(formatId);

    return stat.attempts
      ? stat.correct / stat.attempts
      : 0.5;
  }

  function currentReplayRoundNumber() {
    return number(
      progress.replayCycle.roundsInCycle
    ) + 1;
  }

  function resetCycle() {
    progress.replayCycle = {
      cycle: number(
        progress.replayCycle.cycle,
        1
      ) + 1,

      roundsInCycle: 0,

      seenCoreIds: []
    };
  }

  function replayTypesForRound(roundIndex) {
    const formats = FORMAT_IDS.length
      ? FORMAT_IDS
      : [
          ...new Set(
            CORES.map((item) => item.formatId)
          )
        ];

    /*
      12 replay rounds × 5 formats = 60 slots
      One format is omitted per round.
      In 12 rounds every format is omitted exactly twice.
    */
    const omitted =
      formats[roundIndex % formats.length];

    return shuffled(
      formats.filter(
        (formatId) => formatId !== omitted
      )
    );
  }

  function candidateCores(
    formatId,
    options
  ) {
    const seen = new Set(
      options.seenCoreIds || []
    );

    const usedContexts =
      options.usedContexts || new Set();

    const avoidContexts = new Set(
      progress.recentContextIds || []
    );

    const earlyReplay =
      options.mode === 'replay' &&
      currentReplayRoundNumber() <= 3;

    let candidates = CORES.filter((core) => (
      core.formatId === formatId &&
      !seen.has(core.id) &&
      !usedContexts.has(core.contextId) &&
      !(earlyReplay && TUTORIAL_IDS.has(core.id))
    ));

    if (!candidates.length) {
      candidates = CORES.filter((core) => (
        core.formatId === formatId &&
        !seen.has(core.id) &&
        !usedContexts.has(core.contextId)
      ));
    }

    const freshContexts = candidates.filter(
      (core) => !avoidContexts.has(core.contextId)
    );

    if (freshContexts.length) {
      candidates = freshContexts;
    }

    if (options.mode === 'challenge') {
      candidates = candidates.sort((a, b) => (
        accuracyForType(a.formatId) -
        accuracyForType(b.formatId)
      ));
    }

    return shuffled(candidates);
  }

  function backtrackPlan(
    types,
    index,
    selected,
    usedContexts,
    seenCoreIds,
    mode
  ) {
    if (index >= types.length) {
      return selected;
    }

    const formatId = types[index];

    const candidates = candidateCores(
      formatId,
      {
        mode,
        usedContexts,
        seenCoreIds
      }
    );

    for (const core of candidates) {
      const nextSelected = [
        ...selected,
        core
      ];

      const nextContexts = new Set(
        usedContexts
      );

      const nextSeen = new Set(
        seenCoreIds
      );

      nextContexts.add(core.contextId);
      nextSeen.add(core.id);

      const result = backtrackPlan(
        types,
        index + 1,
        nextSelected,
        nextContexts,
        nextSeen,
        mode
      );

      if (result) {
        return result;
      }
    }

    return null;
  }

  function chooseVariant(coreId, salt) {
    const used = new Set(
      progress.variantHistory[coreId] || []
    );

    let available = VARIANTS.filter(
      (variant) => !used.has(variant.id)
    );

    if (!available.length) {
      available = VARIANTS;
    }

    if (!available.length) {
      return null;
    }

    const seed = Math.abs(
      hash(`${coreId}:${salt}:${Date.now()}`)
    );

    return available[
      seed % available.length
    ];
  }

  function buildReplayPlan(mode) {
    if (
      progress.replayCycle.seenCoreIds.length >=
      CORES.length
    ) {
      resetCycle();
    }

    const roundIndex = number(
      progress.replayCycle.roundsInCycle
    );

    let formatIds = replayTypesForRound(
      roundIndex
    );

    if (mode === 'challenge') {
      formatIds = formatIds.sort(
        (a, b) => accuracyForType(a) - accuracyForType(b)
      );
    }

    const strictSeen = new Set(
      progress.replayCycle.seenCoreIds || []
    );

    let selected = backtrackPlan(
      formatIds,
      0,
      [],
      new Set(),
      strictSeen,
      mode
    );

    if (!selected) {
      /*
        Fallback protects against corrupt localStorage.
        Normal Cycle 1–12 should never enter this block.
      */
      resetCycle();

      selected = backtrackPlan(
        formatIds,
        0,
        [],
        new Set(),
        new Set(),
        mode
      );
    }

    return (selected || []).map(
      (core, index) => ({
        coreId: core.id,

        variantId:
          chooseVariant(
            core.id,
            `${mode}:${roundIndex}:${index}`
          )?.id || null
      })
    );
  }

  function buildTutorialPlan() {
    return TUTORIAL.map(
      (core, index) => ({
        coreId: core.id,

        variantId:
          VARIANTS[
            index % Math.max(1, VARIANTS.length)
          ]?.id || null
      })
    );
  }

  function beginMode(mode) {
    const allowed = [
      'tutorial',
      'replay',
      'challenge'
    ];

    if (!allowed.includes(mode)) {
      return;
    }

    if (
      (mode === 'replay' || mode === 'challenge') &&
      !isPassed()
    ) {
      openFeedback({
        good: false,
        title: 'ยังไม่ปลดล็อก Random Replay',
        message:
          'ผ่าน Tutorial W1 อย่างน้อย 1★ ก่อน เพื่อให้ระบบบันทึกพื้นฐานการสืบ UX'
      });

      return;
    }

    const plan = mode === 'tutorial'
      ? buildTutorialPlan()
      : buildReplayPlan(mode);

    if (plan.length !== ROUND_SIZE) {
      openFeedback({
        good: false,
        title: 'สร้างชุด Case ไม่สำเร็จ',
        message:
          'ตรวจว่าไฟล์ Data V10 มี 60 Core Cases และ 12 Scenario Variants ครบ'
      });

      return;
    }

    state = {
      ...freshState(),

      mode,

      casePlan: plan,

      startedAt: Date.now()
    };

    persistSession();

    renderGame();
  }

  function phaseConfig(caseData, phase) {
    if (phase === 'observe') {
      return {
        ...caseData.observe,

        phase,

        title:
          caseData.observe.title || 'Observe',

        multi: false
      };
    }

    if (phase === 'diagnose') {
      return {
        ...caseData.diagnose,

        phase,

        title: 'Diagnose',

        multi: false
      };
    }

    if (phase === 'fix') {
      return {
        ...caseData.fix,

        phase,

        title: 'Design Fix',

        multi: false
      };
    }

    if (phase === 'test') {
      const before = caseData.test.before;
      const after = caseData.test.after;

      return {
        phase,

        title: 'User Test',

        kind: 'forecast',

        multi: false,

        prompt:
          'ผลใดสะท้อนว่าแบบที่ปรับช่วยผู้ใช้สำเร็จจริง?',

        options: [
          {
            id: 'correct',

            correct: true,

            text:
              `Task success ${before.success}% → ${after.success}% • ` +
              `เวลา ${before.time} → ${after.time} • ` +
              `ความมั่นใจ ${before.confidence}% → ${after.confidence}%`
          },

          {
            id: 'decoy-1',

            correct: false,

            text:
              `Task success ลดลง • ` +
              `เวลา ${before.time} → นานขึ้น • ` +
              `ผู้ใช้ต้องเดาขั้นตอนต่อไป`
          },

          {
            id: 'decoy-2',

            correct: false,

            text:
              'จำนวนองค์ประกอบบนหน้าจอเพิ่มขึ้น จึงถือว่าประสบการณ์ดีขึ้นโดยอัตโนมัติ'
          }
        ]
      };
    }

    return {
      ...caseData.explain,

      phase: 'explain',

      title: 'Explain',

      multi: true,

      options: caseData.explain.choices
    };
  }

  function isSelectionReady(config, selection) {
    if (config.multi) {
      return (
        Array.isArray(selection) &&
        selection.length === number(config.require, 2)
      );
    }

    return Boolean(selection);
  }

  function isCorrect(config, selection) {
    if (!config.multi) {
      return config.options.some(
        (option) =>
          option.id === selection &&
          option.correct
      );
    }

    const selected = new Set(selection || []);

    const correct = config.options
      .filter((option) => option.correct)
      .map((option) => option.id);

    return (
      selected.size === correct.length &&
      correct.every((id) => selected.has(id))
    );
  }

  function messageFor(
    caseData,
    phase,
    correct
  ) {
    if (!correct) {
      const tips = {
        observe:
          'กลับไปมองว่า evidence ใดขวาง User Goal โดยตรง ไม่ใช่รายละเอียดตกแต่ง',

        diagnose:
          'เชื่อม “สิ่งที่เห็นบนหน้าจอ” กับ “ผลต่อการทำงานของผู้ใช้” ให้ครบ',

        fix:
          'เลือกการแก้ที่ลดอุปสรรคหลักก่อน ไม่ใช่เพิ่มสิ่งใหม่ที่ไม่ช่วยให้ทำงานสำเร็จ',

        test:
          'พิจารณา Task success เวลา และความมั่นใจของผู้ใช้ ไม่ใช่ความสวยงามของหน้าจอ',

        explain:
          'เลือกผลลัพธ์ที่พิสูจน์ได้ว่าผู้ใช้ทำงานสำเร็จง่ายขึ้นจริง'
      };

      return (
        tips[phase] ||
        'ลองวิเคราะห์ใหม่จากเป้าหมายของผู้ใช้'
      );
    }

    const messages = {
      observe:
        `ถูกต้อง: จุดสำคัญคือ ${caseData.contextLens}`,

      diagnose:
        `ถูกต้อง: หลักคิดคือ ${caseData.diagnose.principle}`,

      fix:
        `ถูกต้อง: ${
          caseData.fix.options.find(
            (option) => option.correct
          )?.text || ''
        }`,

      test:
        `ถูกต้อง: ${caseData.test.result}`,

      explain:
        'ถูกต้อง: คุณเชื่อมการแก้กับผลลัพธ์ของผู้ใช้ได้แล้ว'
    };

    return (
      messages[phase] ||
      'วิเคราะห์ได้ถูกต้อง'
    );
  }

  function selectOption(optionId) {
    const caseData = currentCase();

    if (!caseData) {
      return;
    }

    const phase = PHASES[state.stepIndex];

    const config = phaseConfig(
      caseData,
      phase
    );

    const selected = selectionFor(caseData.id);

    if (config.multi) {
      const values = Array.isArray(
        selected[phase]
      )
        ? selected[phase]
        : [];

      if (values.includes(optionId)) {
        selected[phase] = values.filter(
          (id) => id !== optionId
        );
      } else if (
        values.length < number(config.require, 2)
      ) {
        selected[phase] = [
          ...values,
          optionId
        ];
      }
    } else {
      selected[phase] = optionId;
    }

    persistSession();

    renderGame();
  }

  function submitPhase() {
    const caseData = currentCase();

    if (!caseData) {
      return;
    }

    const phase = PHASES[state.stepIndex];

    const config = phaseConfig(
      caseData,
      phase
    );

    const selected = selectionFor(
      caseData.id
    )[phase];

    if (!isSelectionReady(config, selected)) {
      openFeedback({
        good: false,

        title: 'เลือกคำตอบก่อน',

        message: config.multi
          ? `เลือกให้ครบ ${config.require} ผลลัพธ์`
          : 'เลือกคำตอบที่คิดว่าอธิบาย User Goal ได้ดีที่สุด'
      });

      return;
    }

    const correct = isCorrect(
      config,
      selected
    );

    addAttempt(caseData.id, phase);

    registerTypePerformance(
      caseData.formatId,
      correct
    );

    state.answerLog.push({
      coreId: caseData.id,
      formatId: caseData.formatId,
      phase,
      correct,
      at: Date.now()
    });

    if (!correct) {
      state.wrongAttempts += 1;

      state.stability = clamp(
        state.stability - 8,
        0,
        100
      );

      persistProgress();
      persistSession();

      openFeedback({
        good: false,

        title:
          'ยังไม่ใช่จุดที่ตอบ User Goal',

        message: messageFor(
          caseData,
          phase,
          false
        )
      });

      return;
    }

    const attemptCount = attemptsFor(
      caseData.id,
      phase
    );

    const firstTry = attemptCount === 1;

    const base = phase === 'explain'
      ? 32
      : phase === 'test'
        ? 28
        : 24;

    const points = base + (
      firstTry ? 8 : 0
    );

    state.score += points;

    state.correctSteps += 1;

    persistProgress();
    persistSession();

    openFeedback({
      good: true,

      title: `+${points} Evidence Confirmed`,

      message: messageFor(
        caseData,
        phase,
        true
      ),

      next: true
    });
  }

  function advancePhase() {
    if (state.stepIndex < PHASES.length - 1) {
      state.stepIndex += 1;

      persistSession();

      renderGame();

      return;
    }

    if (
      state.caseIndex <
      state.casePlan.length - 1
    ) {
      state.caseIndex += 1;
      state.stepIndex = 0;

      persistSession();

      renderGame();

      return;
    }

    finishRound();
  }

  function starsForResult() {
    if (
      state.stability >= 84 &&
      state.wrongAttempts <= 3
    ) {
      return 3;
    }

    if (state.stability >= 56) {
      return 2;
    }

    return 1;
  }

  function finishRound() {
    const stars = starsForResult();

    const usedCoreIds = state.casePlan.map(
      (item) => item.coreId
    );

    const usedVariants = state.casePlan
      .filter((item) => item.variantId)
      .map((item) => ({
        coreId: item.coreId,
        variantId: item.variantId
      }));

    if (state.mode === 'tutorial') {
      progress.tutorialComplete = true;

      progress.tutorialBestStars = Math.max(
        progress.tutorialBestStars,
        stars
      );
    }

    if (state.mode === 'replay') {
      progress.replayWins += 1;

      progress.replayCycle.seenCoreIds = [
        ...new Set([
          ...(progress.replayCycle.seenCoreIds || []),
          ...usedCoreIds
        ])
      ];

      progress.replayCycle.roundsInCycle += 1;
    }

    if (state.mode === 'challenge') {
      progress.challengeWins += 1;
    }

    usedVariants.forEach(
      ({ coreId, variantId }) => {
        const existing = new Set(
          progress.variantHistory[coreId] || []
        );

        existing.add(variantId);

        progress.variantHistory[coreId] = [
          ...existing
        ];
      }
    );

    const recentContexts = state.casePlan
      .map(
        (item) =>
          CORE_BY_ID.get(item.coreId)
            ?.contextId
      )
      .filter(Boolean);

    progress.recentContextIds = [
      ...(progress.recentContextIds || []),
      ...recentContexts
    ].slice(-16);

    progress.bestStars = Math.max(
      progress.bestStars,
      stars
    );

    progress.bestScore = Math.max(
      progress.bestScore,
      state.score
    );

    progress.totalRounds += 1;

    progress.roundHistory = [
      ...progress.roundHistory,
      {
        id: `W1-${Date.now()}`,

        mode: state.mode,

        stars,

        score: state.score,

        stability: state.stability,

        wrongAttempts: state.wrongAttempts,

        coreIds: usedCoreIds,

        finishedAt:
          new Date().toISOString()
      }
    ].slice(-36);

    if (
      state.mode === 'tutorial' ||
      isPassed()
    ) {
      writeCanonicalW1(stars);
    }

    state.finished = true;

    persistProgress();
    clearSession();

    renderCompletion(
      stars,
      usedCoreIds
    );
  }

  function writeCanonicalW1(stars) {
    if (
      !BRIDGE ||
      typeof BRIDGE.writeW1 !== 'function'
    ) {
      return;
    }

    try {
      BRIDGE.writeW1({
        cleared: true,

        tutorialComplete: true,

        stars: Math.max(
          1,
          stars,
          progress.bestStars
        ),

        score: Math.max(
          state.score,
          progress.bestScore
        ),

        rounds: progress.totalRounds,

        source: 'w1-diversity-v10'
      });
    } catch (error) {
      console.warn(
        '[UXQ W1 V10] Canonical progress bridge was not updated.',
        error
      );
    }
  }

  function renderOptions(
    config,
    selected
  ) {
    const options = config.options || [];

    if (config.multi) {
      const active = new Set(
        Array.isArray(selected)
          ? selected
          : []
      );

      return `
        <div
          class="choice-grid"
          role="group"
          aria-label="${escapeHtml(config.prompt)}"
        >
          ${options.map((option) => `
            <button
              type="button"
              class="explain-chip ${
                active.has(option.id)
                  ? 'selected'
                  : ''
              }"
              data-option-id="${escapeHtml(option.id)}"
              aria-pressed="${active.has(option.id)}"
            >${escapeHtml(option.text)}</button>
          `).join('')}
        </div>

        <p class="muted selection-note">
          เลือก ${config.require} ข้อ •
          เลือกแล้ว ${active.size}/${config.require}
        </p>
      `;
    }

    return `
      <div
        class="answer-list"
        role="radiogroup"
        aria-label="${escapeHtml(config.prompt)}"
      >
        ${options.map((option) => {
          const active = selected === option.id;

          const cost = option.cost
            ? `<small>ใช้ ${escapeHtml(
                option.cost
              )} Design Energy</small>`
            : '';

          return `
            <button
              type="button"
              class="answer-option ${
                active ? 'selected' : ''
              }"
              data-option-id="${escapeHtml(option.id)}"
              role="radio"
              aria-checked="${active}"
            >
              <span
                class="radio-dot"
                aria-hidden="true"
              ></span>

              <span>
                <strong>${escapeHtml(option.text)}</strong>
                ${cost}
              </span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderTestMetrics(caseData) {
    const before = caseData.test.before;
    const after = caseData.test.after;

    return `
      <div
        class="metric-grid"
        aria-label="ผล User Test ก่อนและหลังปรับแบบ"
      >
        <div class="metric-card">
          <span>Task success</span>
          <div>
            <b class="before">${escapeHtml(
              before.success
            )}%</b>
            <i>→</i>
            <b class="after">${escapeHtml(
              after.success
            )}%</b>
          </div>
        </div>

        <div class="metric-card">
          <span>Time to complete</span>
          <div>
            <b class="before">${escapeHtml(
              before.time
            )}</b>
            <i>→</i>
            <b class="after">${escapeHtml(
              after.time
            )}</b>
          </div>
        </div>

        <div class="metric-card">
          <span>Confidence</span>
          <div>
            <b class="before">${escapeHtml(
              before.confidence
            )}%</b>
            <i>→</i>
            <b class="after">${escapeHtml(
              after.confidence
            )}%</b>
          </div>
        </div>
      </div>

      <div class="test-insight">
        <b>Test insight</b>
        <span>${escapeHtml(
          caseData.test.result
        )}</span>
      </div>
    `;
  }

  function renderInvestigationPanel(caseData) {
    const format =
      caseData.format ||
      DATA.formatMeta?.[caseData.formatId] ||
      {};

    const currentRound =
      state.mode === 'replay'
        ? `Replay ${currentReplayRoundNumber()} • Cycle ${
            progress.replayCycle.cycle
          }`
        : modeMeta(state.mode).label;

    return `
      <article class="investigation-panel">
        <span class="service-chip">
          ${escapeHtml(caseData.service)}
        </span>

        <p class="eyebrow">
          ${escapeHtml(currentRound)}
        </p>

        <h3>${escapeHtml(caseData.title)}</h3>

        <p>${escapeHtml(caseData.screen)}</p>

        <div class="format-progress">
          <span>${escapeHtml(
            format.label || 'UX Investigation'
          )}</span>

          <b>${escapeHtml(
            format.description ||
            'วิเคราะห์จากหลักฐานผู้ใช้'
          )}</b>
        </div>
      </article>
    `;
  }

  function renderScreenMock(caseData) {
    const variant = caseData.scenarioVariant;

    const format =
      caseData.format ||
      DATA.formatMeta?.[caseData.formatId] ||
      {};

    return `
      <div
        class="screen-shell"
        aria-label="หลักฐานสถานการณ์จำลอง"
      >
        <div class="screen-top">
          <b>${escapeHtml(caseData.service)}</b>
          <span>Smart Campus Preview</span>
        </div>

        <div class="screen-body">
          <h3>${escapeHtml(caseData.title)}</h3>

          <p>${escapeHtml(
            caseData.contextCondition
          )}</p>

          <div class="wire-line"></div>

          <div class="screen-canvas">
            <div
              class="suspect-zone"
              aria-hidden="true"
            >
              <b>01</b>
              <small>USER GOAL</small>
              <span>${escapeHtml(
                caseData.goal
              )}</span>
            </div>

            <div
              class="suspect-zone"
              aria-hidden="true"
            >
              <b>02</b>
              <small>USER VOICE</small>
              <span>${escapeHtml(
                caseData.quote
              )}</span>
            </div>

            <div
              class="suspect-zone"
              aria-hidden="true"
            >
              <b>03</b>
              <small>CONTEXT LENS</small>
              <span>${escapeHtml(
                caseData.contextLens
              )}</span>
            </div>

            <div
              class="suspect-zone"
              aria-hidden="true"
            >
              <b>04</b>
              <small>MISSION FORMAT</small>
              <span>${escapeHtml(
                format.description || ''
              )}</span>

              <div class="chip-stack">
                <span>${escapeHtml(
                  variant?.label || 'Scenario'
                )}</span>

                <span>${escapeHtml(
                  format.short || 'UX'
                )}</span>
              </div>
            </div>
          </div>

          <p class="screen-caption">
            สังเกต User Goal → เลือกหลักฐาน →
            อธิบายผลต่อผู้ใช้
          </p>
        </div>
      </div>
    `;
  }

  function renderGame() {
    const caseData = currentCase();

    if (!caseData) {
      state = freshState();
      clearSession();
      renderModeSelect();
      return;
    }

    const phase = PHASES[state.stepIndex];

    const config = phaseConfig(
      caseData,
      phase
    );

    const selected = selectionFor(
      caseData.id
    )[phase];

    const format =
      caseData.format ||
      DATA.formatMeta?.[caseData.formatId] ||
      {};

    const ready = isSelectionReady(
      config,
      selected
    );

    const mode = modeMeta(state.mode);

    const budgetNotice =
      caseData.observe.kind === 'budget'
        ? `
          <div class="budget-bar">
            <span>Design Energy</span>
            <b>${escapeHtml(
              caseData.observe.energy || 40
            )} / ${escapeHtml(
              caseData.observe.energy || 40
            )}</b>
          </div>
        `
        : '';

    updateHud();
    updatePhaseRail();

    stage.innerHTML = `
      <section class="case-layout diversity-layout">
        <article class="mission-card">
          <div class="case-kicker">
            <span>${escapeHtml(mode.badge)}</span>
            <span>${escapeHtml(
              format.short ||
              format.label ||
              'UX'
            )}</span>
            <span>
              Case ${state.caseIndex + 1}/${
                state.casePlan.length
              }
            </span>
          </div>

          <h2>${escapeHtml(
            PHASE_LABELS[phase]
          )}</h2>

          <div class="format-ribbon">
            <span>${escapeHtml(
              FORMAT_ICONS[caseData.formatId] ||
              '•'
            )}</span>

            <b>${escapeHtml(
              format.label ||
              'UX Investigation'
            )}</b>

            <em>${escapeHtml(
              format.description || ''
            )}</em>
          </div>

          <div class="goal-card">
            <span>USER GOAL</span>
            <b>${escapeHtml(caseData.goal)}</b>
          </div>

          <div class="persona-card">
            <b>${escapeHtml(caseData.persona)}</b>
            <span>${escapeHtml(
              caseData.contextCondition
            )}</span>
          </div>

          <p class="evidence-label">USER VOICE</p>

          <p class="evidence-detail">
            “${escapeHtml(caseData.quote)}”
          </p>

          <p class="muted tiny">
            Focus lens:
            ${escapeHtml(caseData.contextLens)}
          </p>

          ${renderInvestigationPanel(caseData)}
        </article>

        <article class="screen-card">
          ${renderScreenMock(caseData)}

          <div class="instruction-card">
            <span class="step-badge">
              ${state.stepIndex + 1}/5
            </span>

            <div>
              <b>${escapeHtml(config.title)}</b>
              <p>${escapeHtml(config.prompt)}</p>
            </div>
          </div>

          ${budgetNotice}

          ${phase === 'test'
            ? renderTestMetrics(caseData)
            : ''}

          <h3 class="question-title">
            ${escapeHtml(config.prompt)}
          </h3>

          ${renderOptions(config, selected)}

          <div class="stage-actions left-actions">
            <button
              type="button"
              class="primary-btn"
              data-action="submit"
              ${ready ? '' : 'disabled'}
            >
              ตรวจคำตอบ
            </button>

            <button
              type="button"
              class="secondary-btn"
              data-action="back-to-modes"
            >
              ออกจากรอบนี้
            </button>
          </div>
        </article>
      </section>
    `;
  }

  function renderModeSelect() {
    state = freshState();

    updateHud();
    updatePhaseRail();

    const passed = isPassed();

    const challengeUnlocked =
      passed &&
      (
        progress.replayWins >= 3 ||
        progress.bestStars >= 2
      );

    stage.innerHTML = `
      <section class="single-layout">
        <article class="complete-card mode-select-card">
          <p class="eyebrow">
            W1 • UX DETECTIVE
          </p>

          <h2>
            ${
              passed
                ? 'พร้อมสำหรับ Random Replay'
                : 'เริ่ม Tutorial ครั้งแรก'
            }
          </h2>

          <p>
            ${
              passed
                ? 'Tutorial ผ่านแล้ว จึงไม่บังคับวนเคสเดิมอีก รอบต่อไปจะเป็น Random Replay ที่ใช้ 5 รูปแบบภารกิจและ 5 บริบทไม่ซ้ำกัน'
                : 'Tutorial 5 Case จะสอนวงจร Observe → Diagnose → Design Fix → User Test → Explain ครั้งเดียว แล้วจึงปลดล็อก Replay'
            }
          </p>

          <div class="mode-stack">
            ${
              passed
                ? `
                  <button
                    type="button"
                    class="mode-action is-primary-mode"
                    data-action="start-replay"
                  >
                    <span class="mode-action__icon">↻</span>

                    <span>
                      <strong>Random Replay</strong>
                      <small>
                        5 Fresh Cases • ไม่ซ้ำ Format •
                        ไม่ซ้ำบริบทในรอบเดียว
                      </small>
                    </span>

                    <b>เริ่ม ›</b>
                  </button>
                `
                : `
                  <button
                    type="button"
                    class="mode-action is-primary-mode"
                    data-action="start-tutorial"
                  >
                    <span class="mode-action__icon">✦</span>

                    <span>
                      <strong>เริ่ม Tutorial</strong>
                      <small>
                        5 Case เพื่อเรียนรู้เครื่องมือคิด UX พื้นฐาน
                      </small>
                    </span>

                    <b>เริ่ม ›</b>
                  </button>
                `
            }

            <button
              type="button"
              class="mode-action tutorial-action"
              data-action="start-tutorial"
            >
              <span class="mode-action__icon">⌂</span>

              <span>
                <strong>Review Tutorial</strong>
                <small>
                  เปิดเฉพาะเมื่ออยากทบทวน
                  ไม่ใช่เส้นทางเริ่มต้นหลังผ่านแล้ว
                </small>
              </span>

              <b>ทบทวน ›</b>
            </button>

            <button
              type="button"
              class="mode-action challenge-action"
              data-action="start-challenge"
              ${challengeUnlocked ? '' : 'disabled'}
            >
              <span class="mode-action__icon">◆</span>

              <span>
                <strong>Transfer Challenge</strong>
                <small>
                  ${
                    challengeUnlocked
                      ? 'โจทย์เน้น Format ที่คุณยังพลาดบ่อย และไม่ให้ Principle Hint ระหว่างเล่น'
                      : 'ปลดล็อกเมื่อได้ 2★ หรือชนะ Replay 3 รอบ'
                  }
                </small>
              </span>

              <b>
                ${
                  challengeUnlocked
                    ? 'เริ่ม ›'
                    : 'ล็อก'
                }
              </b>
            </button>
          </div>

          <div class="principle-stack">
            <span>
              <b>Replay cycle</b> •
              รอบ ${currentReplayRoundNumber()} / 12 •
              ใช้แล้ว ${
                progress.replayCycle.seenCoreIds.length
              }/60 Core Cases
            </span>

            <span>
              <b>Best record</b> •
              ${progress.bestStars}★ •
              ${progress.bestScore} คะแนน •
              ${progress.replayWins} Replay wins
            </span>
          </div>

          <div class="completion-footer">
            <a
              class="secondary-btn"
              href="./index.html"
            >
              กลับ Mission Control
            </a>
          </div>
        </article>
      </section>
    `;
  }

  function renderCompletion(
    stars,
    usedCoreIds
  ) {
    const mode = modeMeta(state.mode);

    const earned = [1, 2, 3]
      .map((value) => `
        <span class="final-star ${
          value <= stars
            ? 'earned'
            : ''
        }">★</span>
      `)
      .join('');

    const uniqueFormats = new Set(
      usedCoreIds.map(
        (id) =>
          CORE_BY_ID.get(id)?.formatId
      )
    ).size;

    const canOpenW2 = isPassed();

    updateHud();
    updatePhaseRail(true);

    stage.innerHTML = `
      <section class="single-layout">
        <article class="complete-card">
          <p class="eyebrow">
            ${escapeHtml(mode.label)} • COMPLETE
          </p>

          <h2>
            ${
              stars === 3
                ? 'UX Evidence Mastered!'
                : stars === 2
                  ? 'Strong UX Investigation!'
                  : 'Mission Complete!'
            }
          </h2>

          <div class="final-stars">
            ${earned}
          </div>

          <p>
            ${
              state.mode === 'tutorial'
                ? 'Tutorial ผ่านแล้ว รอบถัดไปจะเปิด Random Replay เป็นค่าเริ่มต้น และ W2 ถูกปลดล็อกทันที'
                : 'คุณผ่าน Case ที่ต่างรูปแบบกันแล้ว ระบบบันทึก Core Case และ Scenario ที่ใช้เพื่อหลีกเลี่ยงการวนซ้ำ'
            }
          </p>

          <div class="complete-metrics">
            <div>
              <span>Score</span>
              <b>${state.score}</b>
            </div>

            <div>
              <span>Stability</span>
              <b>${state.stability}%</b>
            </div>

            <div>
              <span>Formats</span>
              <b>${uniqueFormats}/5</b>
            </div>
          </div>

          <div class="principle-stack">
            <span>
              <b>Replay record:</b>
              ${
                progress.replayCycle.seenCoreIds.length
              }/60 Core Cases used in Cycle
              ${progress.replayCycle.cycle}
            </span>

            <span>
              <b>Learning signal:</b>
              Review the formats where incorrect attempts occurred,
              then retry with a new Smart Campus context.
            </span>
          </div>

          <div class="completion-actions">
            ${
              canOpenW2
                ? `
                  <a
                    class="completion-action next"
                    href="./w2-design-thinking-sprint.html?v=w1-v10-complete"
                  >
                    <span>→</span>

                    <span>
                      <strong>
                        ต่อไป: W2 Design Thinking Sprint
                      </strong>

                      <small>
                        W1 ผ่านแล้ว •
                        ไม่ต้องกลับไปทำ Tutorial ซ้ำ
                      </small>
                    </span>
                  </a>
                `
                : ''
            }

            <button
              type="button"
              class="completion-action replay"
              data-action="start-replay"
            >
              <span>↻</span>

              <span>
                <strong>เริ่ม Random Replay</strong>
                <small>
                  ชุดถัดไปเปลี่ยน Core Case,
                  Format และ Scenario
                </small>
              </span>
            </button>

            <button
              type="button"
              class="completion-action"
              data-action="back-to-modes"
            >
              <span>⌂</span>

              <span>
                <strong>กลับหน้าเลือกโหมด W1</strong>
                <small>
                  เลือก Review Tutorial หรือ
                  Transfer Challenge ได้จากที่นี่
                </small>
              </span>
            </button>
          </div>
        </article>
      </section>
    `;
  }

  function updateHud() {
    if (caseValue) {
      caseValue.textContent =
        state.mode && state.casePlan.length
          ? `${state.caseIndex + 1}/${state.casePlan.length}`
          : 'เลือกโหมด';
    }

    if (scoreValue) {
      scoreValue.textContent = String(
        state.score || 0
      );
    }

    if (stabilityValue) {
      stabilityValue.textContent =
        `${Math.round(
          state.stability || 100
        )}%`;
    }
  }

  function updatePhaseRail(complete = false) {
    if (!phaseRail) {
      return;
    }

    const nodes = [
      ...phaseRail.querySelectorAll('.phase')
    ];

    nodes.forEach((node, index) => {
      node.classList.toggle(
        'active',
        !complete &&
          state.mode &&
          index === state.stepIndex
      );

      node.classList.toggle(
        'done',
        complete ||
          (
            state.mode &&
            index < state.stepIndex
          )
      );
    });
  }

  function closeDialog(dialog) {
    if (dialog?.open) {
      dialog.close();
    }
  }

  function openFeedback({
    good,
    title,
    message,
    next = false
  }) {
    const tone = good
      ? 'good'
      : 'retry';

    const label = good
      ? 'CONFIRMED'
      : 'RECHECK';

    if (
      !feedbackDialog ||
      !feedbackContent ||
      typeof feedbackDialog.showModal !== 'function'
    ) {
      window.alert(`${title}\n\n${message}`);

      if (next) {
        advancePhase();
      }

      return;
    }

    feedbackContent.innerHTML = `
      <p class="verdict ${tone}">
        ${label}
      </p>

      <h2>${escapeHtml(title)}</h2>

      <p>${escapeHtml(message)}</p>

      <div class="stage-actions left-actions">
        <button
          type="button"
          class="primary-btn"
          data-feedback-next="${
            next ? 'true' : 'false'
          }"
        >
          ${
            next
              ? 'ต่อไป'
              : 'กลับไปวิเคราะห์อีกครั้ง'
          }
        </button>
      </div>
    `;

    feedbackDialog.showModal();
  }

  function resetReplayOnly() {
    const shouldReset = window.confirm(
      'ล้างเฉพาะคิว Random Replay และประวัติ Case ที่ใช้แล้วหรือไม่?\n\nสถานะผ่าน W1 และสิทธิ์เข้า W2 จะยังคงอยู่'
    );

    if (!shouldReset) {
      return;
    }

    const canonicalPassed = isPassed();

    progress = freshProgress();

    if (canonicalPassed) {
      progress.tutorialComplete = true;

      progress.tutorialBestStars = Math.max(
        progress.tutorialBestStars,
        1
      );

      progress.bestStars = Math.max(
        progress.bestStars,
        1
      );
    }

    state = freshState();

    persistProgress();
    clearSession();

    renderModeSelect();
  }

  function handleStageClick(event) {
    const option = event.target.closest(
      '[data-option-id]'
    );

    if (option) {
      selectOption(option.dataset.optionId);
      return;
    }

    const action = event.target.closest(
      '[data-action]'
    );

    if (!action || action.disabled) {
      return;
    }

    const name = action.dataset.action;

    if (name === 'submit') {
      submitPhase();
    }

    if (name === 'start-tutorial') {
      beginMode('tutorial');
    }

    if (name === 'start-replay') {
      beginMode('replay');
    }

    if (name === 'start-challenge') {
      beginMode('challenge');
    }

    if (name === 'back-to-modes') {
      state = freshState();

      clearSession();

      renderModeSelect();
    }
  }

  stage.addEventListener(
    'click',
    handleStageClick
  );

  document.addEventListener(
    'click',
    (event) => {
      const closeButton = event.target.closest(
        '[data-close]'
      );

      if (closeButton) {
        closeDialog(
          document.querySelector(
            `#${closeButton.dataset.close}`
          )
        );

        return;
      }

      const feedbackNext = event.target.closest(
        '[data-feedback-next]'
      );

      if (feedbackNext) {
        const shouldAdvance =
          feedbackNext.dataset.feedbackNext === 'true';

        closeDialog(feedbackDialog);

        if (shouldAdvance) {
          advancePhase();
        }
      }
    }
  );

  document
    .querySelector('#howBtn')
    ?.addEventListener('click', () => {
      if (howDialog?.showModal) {
        howDialog.showModal();
      }
    });

  document
    .querySelector('#resetBtn')
    ?.addEventListener(
      'click',
      resetReplayOnly
    );

  if (
    state.mode &&
    state.casePlan.length
  ) {
    renderGame();
  } else {
    renderModeSelect();
  }
})();
