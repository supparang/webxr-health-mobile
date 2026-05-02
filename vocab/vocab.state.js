/* =========================================================
   /vocab/vocab.state.js
   TechPath Vocab Arena — State Manager
   Version: 20260502a

   ต้องโหลดหลัง:
   - /vocab/vocab.config.js
   - /vocab/vocab.utils.js

   หน้าที่:
   - เก็บ vocabGame state กลาง
   - student context
   - session id
   - screen state
   - timer cleanup
   - reset game state ก่อนเริ่มรอบใหม่
   - summary/result snapshot
   ========================================================= */

(function(){
  "use strict";

  const U = window.VocabUtils;

  if(!U){
    console.error("[VOCAB] vocab.state.js requires vocab.utils.js");
    return;
  }

  const S = {};

  /* =========================================================
     STORAGE KEYS
  ========================================================= */

  S.keys = {
    profile: window.VOCAB_APP?.profileKey || "VOCAB_STUDENT_PROFILE",
    lastSummary: "VOCAB_LAST_SUMMARY",
    teacherLast: window.VOCAB_APP?.teacherKey || "VOCAB_TEACHER_LAST",
    sessionContext: "VOCAB_SESSION_CONTEXT",
    screenState: "VOCAB_SCREEN_STATE"
  };

  /* =========================================================
     GAME STATE
  ========================================================= */

  S.createDefaultGameState = function createDefaultGameState(){
    return {
      active: false,
      locked: false,
      ended: false,

      sessionId: "",
      visitId: "",
      startedAt: 0,
      endedAt: 0,

      bank: "A",
      difficulty: "easy",
      mode: "learn",
      modeConfig: null,

      terms: [],
      stagePlan: [],
      stageIndex: 0,
      questionIndexInStage: 0,
      globalQuestionIndex: 0,

      currentStage: null,
      currentQuestion: null,
      questionStartedAt: 0,
      answerLocked: false,

      timerId: null,
      timeLeft: 0,

      score: 0,
      combo: 0,
      comboMax: 0,
      correct: 0,
      wrong: 0,
      playerHp: 5,

      enemy: null,
      enemyHp: 100,
      enemyHpMax: 100,

      mistakes: [],
      sessionTermUse: {},
      stageStats: {},

      fever: false,
      feverUntil: 0,
      feverTimerId: null,

      shield: 1,
      hints: 1,
      laserReady: false,

      aiHelpLeft: 0,
      aiHelpUsed: 0,
      aiHelpPenalty: 0,
      currentAiHelpUsed: false,

      powerStats: {
        feverCount: 0,
        shieldUsed: 0,
        hintUsed: 0,
        laserUsed: 0,
        bossAttackCount: 0,
        aiHelpUsed: 0
      },

      detailStats: {
        totalResponseMs: 0,
        answeredCount: 0,
        timeoutCount: 0,
        fastestMs: 0,
        slowestMs: 0,
        avgResponseMs: 0,
        correctResponseMs: 0,
        wrongResponseMs: 0,
        correctAnsweredCount: 0,
        wrongAnsweredCount: 0
      },

      meta: {
        version: window.VOCAB_APP?.version || "",
        schema: window.VOCAB_APP?.schema || "",
        source: window.VOCAB_APP?.source || "vocab.html"
      }
    };
  };

  const initialState = S.createDefaultGameState();

  /*
    ใช้ object เดิมเพื่อให้ patch เก่าที่อ้าง window.vocabGame ยังไม่พัง
  */
  const game = window.vocabGame || {};
  Object.assign(game, initialState);

  window.vocabGame = game;
  window.vocabGameV6 = game;

  S.game = game;

  /* =========================================================
     SESSION ID / VISIT ID
  ========================================================= */

  S.newId = function newId(prefix){
    return `${prefix || "vocab"}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  S.getSessionId = function getSessionId(){
    if(!game.sessionId){
      game.sessionId = S.newId("vocab");
    }
    return game.sessionId;
  };

  S.newSessionId = function newSessionId(){
    game.sessionId = S.newId("vocab");
    return game.sessionId;
  };

  S.getVisitId = function getVisitId(){
    if(!game.visitId){
      const saved = U.getStorage("VOCAB_VISIT_ID", "");
      game.visitId = saved || S.newId("visit");
      U.setStorage("VOCAB_VISIT_ID", game.visitId);
    }

    return game.visitId;
  };

  /* =========================================================
     STUDENT CONTEXT
  ========================================================= */

  S.getValue = function getValue(id){
    const el = U.byId(id);
    return el ? String(el.value || "").trim() : "";
  };

  S.setValue = function setValue(id, value){
    const el = U.byId(id);
    if(el && value !== undefined && value !== null){
      el.value = String(value);
    }
  };

  S.getStudentContext = function getStudentContext(){
    const saved = U.readJson(S.keys.profile, {}) || {};

    const displayName =
      S.getValue("v63DisplayName") ||
      U.getParam("name") ||
      U.getParam("nick") ||
      saved.display_name ||
      saved.displayName ||
      "Hero";

    const studentId =
      S.getValue("v63StudentId") ||
      U.getParam("student_id") ||
      U.getParam("studentId") ||
      U.getParam("sid") ||
      U.getParam("pid") ||
      saved.student_id ||
      saved.studentId ||
      "anon";

    const section =
      S.getValue("v63Section") ||
      U.getParam("section") ||
      saved.section ||
      "";

    const sessionCode =
      S.getValue("v63SessionCode") ||
      U.getParam("session_code") ||
      U.getParam("sessionCode") ||
      U.getParam("studyId") ||
      saved.session_code ||
      saved.sessionCode ||
      "";

    return {
      display_name: displayName,
      student_id: studentId,
      section,
      session_code: sessionCode
    };
  };

  S.saveStudentContext = function saveStudentContext(){
    const ctx = S.getStudentContext();

    U.writeJson(S.keys.profile, {
      ...ctx,
      saved_at: U.nowIso(),
      saved_at_bangkok: U.bangkokIsoNow()
    });

    return ctx;
  };

  S.hydrateStudentForm = function hydrateStudentForm(){
    const saved = U.readJson(S.keys.profile, {}) || {};

    S.setValue(
      "v63DisplayName",
      U.getParam("name") ||
      U.getParam("nick") ||
      saved.display_name ||
      saved.displayName ||
      ""
    );

    S.setValue(
      "v63StudentId",
      U.getParam("student_id") ||
      U.getParam("studentId") ||
      U.getParam("sid") ||
      U.getParam("pid") ||
      saved.student_id ||
      saved.studentId ||
      ""
    );

    S.setValue(
      "v63Section",
      U.getParam("section") ||
      saved.section ||
      ""
    );

    S.setValue(
      "v63SessionCode",
      U.getParam("session_code") ||
      U.getParam("sessionCode") ||
      U.getParam("studyId") ||
      saved.session_code ||
      saved.sessionCode ||
      ""
    );
  };

  S.validateStudentContext = function validateStudentContext(options = {}){
    const requireStudent = options.requireStudent !== false;
    const allowDemo = U.hasParamOn(["demo", "qa", "debug"]);

    if(!requireStudent || allowDemo){
      return { ok:true, missing:[], context:S.getStudentContext() };
    }

    const fields = [
      {
        key: "display_name",
        label: "ชื่อเล่น / Display name",
        el: U.byId("v63DisplayName")
      },
      {
        key: "student_id",
        label: "รหัสนักศึกษา",
        el: U.byId("v63StudentId")
      },
      {
        key: "section",
        label: "Section",
        el: U.byId("v63Section")
      },
      {
        key: "session_code",
        label: "Session Code",
        el: U.byId("v63SessionCode")
      }
    ];

    const context = S.getStudentContext();
    const missing = fields.filter(f => !String(context[f.key] || "").trim());

    if(missing.length){
      U.focusAndScroll(missing[0].el);
      return {
        ok: false,
        missing: missing.map(x => x.label),
        context
      };
    }

    return { ok:true, missing:[], context };
  };

  /* =========================================================
     SELECTED MENU STATE
  ========================================================= */

  S.getSelectedBank = function getSelectedBank(){
    return window.VOCAB_APP?.selectedBank || game.bank || "A";
  };

  S.getSelectedDifficulty = function getSelectedDifficulty(){
    return window.VOCAB_APP?.selectedDifficulty || game.difficulty || "easy";
  };

  S.getSelectedMode = function getSelectedMode(){
    return window.VOCAB_APP?.selectedMode || game.mode || "learn";
  };

  S.setSelected = function setSelected(options = {}){
    const app = window.VOCAB_APP || {};

    if(options.bank){
      app.selectedBank = options.bank;
    }

    if(options.difficulty){
      app.selectedDifficulty = options.difficulty;
    }

    if(options.mode){
      app.selectedMode = options.mode;
    }

    window.VOCAB_APP = app;

    document.querySelectorAll("[data-v6-bank]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.v6Bank === app.selectedBank);
    });

    document.querySelectorAll("[data-v6-diff]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.v6Diff === app.selectedDifficulty);
    });

    document.querySelectorAll("[data-v6-mode]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.v6Mode === app.selectedMode);
    });

    try{ window.updateV6DiffPreview && window.updateV6DiffPreview(); }catch(e){}
    try{ window.updateV66ModePreview && window.updateV66ModePreview(); }catch(e){}
    try{ window.updateV6BankLabel && window.updateV6BankLabel(); }catch(e){}
    try{ window.updateV66ModeHud && window.updateV66ModeHud(); }catch(e){}

    return {
      bank: app.selectedBank,
      difficulty: app.selectedDifficulty,
      mode: app.selectedMode
    };
  };

  S.getRunOptions = function getRunOptions(options = {}){
    return {
      bank: options.bank || S.getSelectedBank(),
      difficulty: options.difficulty || S.getSelectedDifficulty(),
      mode: options.mode || S.getSelectedMode()
    };
  };

  S.getNextChallengeOptions = function getNextChallengeOptions(lastResult){
    const bank = game.bank || S.getSelectedBank() || "A";
    const accuracy = lastResult ? Number(lastResult.accuracy || 0) : 90;
    const currentDiff = game.difficulty || S.getSelectedDifficulty() || "normal";
    const currentMode = game.mode || S.getSelectedMode() || "learn";

    return {
      bank,
      difficulty: U.nextDifficulty(currentDiff, accuracy),
      mode: U.nextMode(currentMode, accuracy)
    };
  };

  /* =========================================================
     TIMER / CLEANUP
  ========================================================= */

  S.clearTimers = function clearTimers(){
    try{
      if(game.timerId){
        clearInterval(game.timerId);
        clearTimeout(game.timerId);
        game.timerId = null;
      }

      if(game.feverTimerId){
        clearInterval(game.feverTimerId);
        clearTimeout(game.feverTimerId);
        game.feverTimerId = null;
      }

      game.fever = false;
      game.feverUntil = 0;
    }catch(e){}

    try{
      if(typeof window.clearTimerV6 === "function"){
        window.clearTimerV6();
      }
    }catch(e){}

    try{
      if(typeof window.stopFeverV62 === "function"){
        window.stopFeverV62();
      }
    }catch(e){}
  };

  S.fullCleanup = function fullCleanup(){
    S.clearTimers();
    U.cleanFx();

    game.answerLocked = false;
    game.locked = false;
  };

  /* =========================================================
     STAGE / DETAIL STATS
  ========================================================= */

  S.createStageStats = function createStageStats(){
    const stats = {};

    (window.VOCAB_STAGES || []).forEach(stage => {
      stats[stage.id] = {
        correct: 0,
        wrong: 0,
        responseMsTotal: 0,
        count: 0,
        timeout: 0,
        fastestMs: 0,
        slowestMs: 0,
        avgResponseMs: 0
      };
    });

    return stats;
  };

  S.ensureStageStat = function ensureStageStat(stageId){
    if(!stageId) stageId = "unknown";

    if(!game.stageStats){
      game.stageStats = {};
    }

    if(!game.stageStats[stageId]){
      game.stageStats[stageId] = {
        correct: 0,
        wrong: 0,
        responseMsTotal: 0,
        count: 0,
        timeout: 0,
        fastestMs: 0,
        slowestMs: 0,
        avgResponseMs: 0
      };
    }

    return game.stageStats[stageId];
  };

  S.recordAnswerStats = function recordAnswerStats({
    stageId,
    isCorrect,
    responseMs,
    timeout = false
  }){
    responseMs = Number(responseMs || 0);

    const stat = S.ensureStageStat(stageId);

    stat.count += 1;
    stat.responseMsTotal += responseMs;
    stat.avgResponseMs = stat.count ? Math.round(stat.responseMsTotal / stat.count) : 0;

    if(timeout){
      stat.timeout += 1;
    }

    if(isCorrect){
      stat.correct += 1;
    }else{
      stat.wrong += 1;
    }

    if(responseMs > 0 && responseMs < 99999){
      if(!stat.fastestMs || responseMs < stat.fastestMs){
        stat.fastestMs = responseMs;
      }

      if(!stat.slowestMs || responseMs > stat.slowestMs){
        stat.slowestMs = responseMs;
      }
    }

    const d = game.detailStats;

    d.answeredCount += 1;
    d.totalResponseMs += responseMs;
    d.avgResponseMs = d.answeredCount ? Math.round(d.totalResponseMs / d.answeredCount) : 0;

    if(timeout){
      d.timeoutCount += 1;
    }

    if(responseMs > 0 && responseMs < 99999){
      if(!d.fastestMs || responseMs < d.fastestMs){
        d.fastestMs = responseMs;
      }

      if(!d.slowestMs || responseMs > d.slowestMs){
        d.slowestMs = responseMs;
      }
    }

    if(isCorrect){
      d.correctAnsweredCount += 1;
      d.correctResponseMs += responseMs;
    }else{
      d.wrongAnsweredCount += 1;
      d.wrongResponseMs += responseMs;
    }

    return { stageStat: stat, detailStats: d };
  };

  S.recomputeDetailStats = function recomputeDetailStats(){
    const stageStats = game.stageStats || {};

    let correct = 0;
    let wrong = 0;
    let count = 0;
    let totalMs = 0;
    let timeout = 0;
    let fastest = 0;
    let slowest = 0;

    Object.values(stageStats).forEach(s => {
      correct += Number(s.correct || 0);
      wrong += Number(s.wrong || 0);
      count += Number(s.count || 0);
      totalMs += Number(s.responseMsTotal || 0);
      timeout += Number(s.timeout || 0);

      if(Number(s.fastestMs || 0) > 0){
        fastest = !fastest ? Number(s.fastestMs) : Math.min(fastest, Number(s.fastestMs));
      }

      if(Number(s.slowestMs || 0) > 0){
        slowest = Math.max(slowest, Number(s.slowestMs));
      }
    });

    game.detailStats = {
      ...game.detailStats,
      totalResponseMs: totalMs,
      answeredCount: count,
      timeoutCount: timeout,
      fastestMs: fastest,
      slowestMs: slowest,
      avgResponseMs: count ? Math.round(totalMs / count) : 0,
      correctAnsweredCount: correct,
      wrongAnsweredCount: wrong
    };

    return game.detailStats;
  };

  /* =========================================================
     RESET BEFORE START
  ========================================================= */

  S.resetForNewRun = function resetForNewRun(options = {}){
    S.fullCleanup();

    const run = S.getRunOptions(options);
    const diffConfig = U.getDifficulty(run.difficulty);
    const modeConfig = U.getMode(run.mode);
    const enemyBase = U.getEnemy(run.bank);

    const keepVisitId = S.getVisitId();
    const fresh = S.createDefaultGameState();

    Object.keys(game).forEach(k => {
      delete game[k];
    });

    Object.assign(game, fresh);

    game.visitId = keepVisitId;
    game.sessionId = S.newSessionId();
    game.active = true;
    game.locked = false;
    game.ended = false;
    game.startedAt = Date.now();
    game.endedAt = 0;

    game.bank = run.bank;
    game.difficulty = run.difficulty;
    game.mode = run.mode;
    game.modeConfig = modeConfig;

    game.playerHp = Number(diffConfig.playerHp || 5);

    game.enemy = { ...enemyBase };
    game.enemyHpMax = Math.round(Number(enemyBase.hp || 100) * Number(diffConfig.bossMultiplier || 1));
    game.enemyHp = game.enemyHpMax;

    game.stageStats = S.createStageStats();

    game.powerStats = {
      feverCount: 0,
      shieldUsed: 0,
      hintUsed: 0,
      laserUsed: 0,
      bossAttackCount: 0,
      aiHelpUsed: 0
    };

    game.detailStats = {
      totalResponseMs: 0,
      answeredCount: 0,
      timeoutCount: 0,
      fastestMs: 0,
      slowestMs: 0,
      avgResponseMs: 0,
      correctResponseMs: 0,
      wrongResponseMs: 0,
      correctAnsweredCount: 0,
      wrongAnsweredCount: 0
    };

    game.shield = Number(modeConfig.startShield ?? 1);
    game.hints = Number(modeConfig.startHints ?? 1);
    game.aiHelpLeft = S.calculateAiHelpStart(run.mode, run.difficulty);
    game.aiHelpUsed = 0;
    game.aiHelpPenalty = 0;

    S.setSelected(run);
    S.saveStudentContext();
    S.saveSessionContext();

    return game;
  };

  S.calculateAiHelpStart = function calculateAiHelpStart(modeId, difficulty){
    const cfg = window.VOCAB_AI_HELP || {
      modeBase: { learn:3, speed:1, mission:2, battle:1, bossrush:0 },
      difficultyBonus: { easy:1, normal:0, hard:-1, challenge:-1 }
    };

    const base = Number(cfg.modeBase?.[modeId] ?? 1);
    const bonus = Number(cfg.difficultyBonus?.[difficulty] ?? 0);

    return Math.max(0, base + bonus);
  };

  /* =========================================================
     SESSION CONTEXT SAVE
  ========================================================= */

  S.saveSessionContext = function saveSessionContext(){
    const ctx = {
      session_id: S.getSessionId(),
      visit_id: S.getVisitId(),
      started_at: game.startedAt ? new Date(game.startedAt).toISOString() : "",
      started_at_bangkok: U.bangkokIsoNow(),
      bank: game.bank,
      difficulty: game.difficulty,
      mode: game.mode,
      mode_label: game.modeConfig?.label || "",
      student: S.getStudentContext(),
      version: window.VOCAB_APP?.version || "",
      schema: window.VOCAB_APP?.schema || ""
    };

    U.writeJson(S.keys.sessionContext, ctx);
    return ctx;
  };

  S.getSessionContext = function getSessionContext(){
    return U.readJson(S.keys.sessionContext, {}) || {};
  };

  /* =========================================================
     RESULT SNAPSHOT
  ========================================================= */

  S.buildWeakestTerms = function buildWeakestTerms(){
    const map = new Map();

    (game.mistakes || []).forEach(m => {
      const key = U.termKey(m.term);
      if(!key) return;

      if(!map.has(key)){
        map.set(key, {
          term: m.term,
          meaning: m.meaning || "",
          count: 0,
          stages: new Set(),
          selected: []
        });
      }

      const item = map.get(key);
      item.count += 1;

      if(m.stageId){
        item.stages.add(m.stageId);
      }

      if(m.selected){
        item.selected.push(m.selected);
      }
    });

    return [...map.values()]
      .map(x => ({
        term: x.term,
        meaning: x.meaning,
        count: x.count,
        stages: [...x.stages],
        selected: x.selected.slice(-3)
      }))
      .sort((a,b) => Number(b.count || 0) - Number(a.count || 0));
  };

  S.buildResult = function buildResult(reason = "completed"){
    S.recomputeDetailStats();

    const total = Number(game.correct || 0) + Number(game.wrong || 0);
    const accuracy = total > 0 ? Math.round((Number(game.correct || 0) / total) * 100) : 0;

    game.endedAt = game.endedAt || Date.now();

    const durationSec = game.startedAt
      ? Math.max(0, Math.round((game.endedAt - game.startedAt) / 1000))
      : 0;

    const bossDefeated = Number(game.enemyHp || 0) <= 0 || reason === "boss_defeated";

    return {
      version: window.VOCAB_APP?.version || "",
      schema: window.VOCAB_APP?.schema || "",
      source: window.VOCAB_APP?.source || "vocab.html",

      reason,
      sessionId: S.getSessionId(),
      visitId: S.getVisitId(),

      bank: game.bank,
      difficulty: game.difficulty,
      mode: game.mode,
      modeLabel: game.modeConfig?.label || game.mode,

      score: Number(game.score || 0),
      correct: Number(game.correct || 0),
      wrong: Number(game.wrong || 0),
      total,
      accuracy,

      comboMax: Number(game.comboMax || 0),
      durationSec,

      bossDefeated,
      enemyName: game.enemy?.name || "",
      enemyHp: Number(game.enemyHp || 0),
      enemyHpMax: Number(game.enemyHpMax || 0),

      weakestTerms: S.buildWeakestTerms(),
      stageStats: game.stageStats || {},
      detailStats: game.detailStats || {},

      powerStats: game.powerStats || {},
      feverCount: Number(game.powerStats?.feverCount || 0),
      shieldUsed: Number(game.powerStats?.shieldUsed || 0),
      hintUsed: Number(game.powerStats?.hintUsed || 0),
      laserUsed: Number(game.powerStats?.laserUsed || 0),

      aiHelpUsed: Number(game.aiHelpUsed || 0),
      aiHelpLeft: Number(game.aiHelpLeft || 0),
      aiHelpPenalty: Number(game.aiHelpPenalty || 0),
      aiAssisted: Number(game.aiHelpUsed || 0) > 0,

      startedAt: game.startedAt ? new Date(game.startedAt).toISOString() : "",
      endedAt: game.endedAt ? new Date(game.endedAt).toISOString() : "",
      bangkokEndedAt: U.bangkokIsoNow(),

      student: S.getStudentContext()
    };
  };

  S.saveLastSummary = function saveLastSummary(payload){
    const data = {
      savedAt: U.nowIso(),
      savedAtBangkok: U.bangkokIsoNow(),
      ...payload
    };

    U.writeJson(S.keys.lastSummary, data);
    return data;
  };

  S.readLastSummary = function readLastSummary(){
    return U.readJson(S.keys.lastSummary, null);
  };

  S.saveTeacherSummary = function saveTeacherSummary(result, reward, coach){
    const student = S.getStudentContext();

    const summary = {
      saved_at: U.nowIso(),
      saved_at_bangkok: U.bangkokIsoNow(),

      session_id: S.getSessionId(),
      visit_id: S.getVisitId(),

      display_name: student.display_name,
      student_id: student.student_id,
      section: student.section,
      session_code: student.session_code,

      bank: result.bank,
      difficulty: result.difficulty,
      mode: result.mode,
      mode_label: result.modeLabel,

      score: result.score,
      accuracy: result.accuracy,
      correct: result.correct,
      wrong: result.wrong,
      total: result.total,

      combo_max: result.comboMax,
      duration_sec: result.durationSec,
      boss_defeated: result.bossDefeated ? 1 : 0,

      stars: reward?.stars || 0,
      badge: reward?.badge || "",
      coins: reward?.coins || 0,

      ai_next_mode: coach?.nextMode || "",
      ai_reason: coach?.reason || "",
      weakest_terms: result.weakestTerms || [],
      stage_stats: result.stageStats || {},
      detail_stats: result.detailStats || {},
      power_stats: result.powerStats || {}
    };

    const list = U.readJson(S.keys.teacherLast, []) || [];
    list.push(summary);
    U.writeJson(S.keys.teacherLast, list.slice(-300));

    return summary;
  };

  /* =========================================================
     SCREEN STATE GOVERNOR
  ========================================================= */

  S.screen = {
    current: "menu"
  };

  S.showMenu = function showMenu(){
    S.clearTimers();

    game.active = false;
    game.locked = false;
    game.answerLocked = false;

    U.showOnlyMenu();

    S.screen.current = "menu";
    U.writeJson(S.keys.screenState, {
      screen: "menu",
      at: U.nowIso()
    });

    return "menu";
  };

  S.showBattle = function showBattle(){
    U.showOnlyBattle();

    S.screen.current = "battle";
    U.writeJson(S.keys.screenState, {
      screen: "battle",
      at: U.nowIso()
    });

    return "battle";
  };

  S.showReward = function showReward(){
    game.active = false;
    game.ended = true;

    S.clearTimers();
    U.showOnlyReward();

    S.screen.current = "reward";
    U.writeJson(S.keys.screenState, {
      screen: "reward",
      at: U.nowIso()
    });

    return "reward";
  };

  S.governScreen = function governScreen(){
    const menu = U.byId("v6MenuPanel");
    const battle = U.byId("v6BattlePanel");
    const reward = U.byId("v6RewardPanel");

    if(!menu || !battle || !reward) return;

    const rewardVisible = !reward.hidden && reward.style.display !== "none" && reward.innerHTML.trim();
    const battleActive = !!game.active;

    if(rewardVisible){
      U.showOnlyReward();
      S.screen.current = "reward";
      return;
    }

    if(battleActive){
      U.showOnlyBattle();
      S.screen.current = "battle";
      return;
    }
  };

  S.installScreenGovernor = function installScreenGovernor(){
    if(S.installScreenGovernor.installed) return;
    S.installScreenGovernor.installed = true;

    setInterval(S.governScreen, 400);

    U.onReady(() => {
      setTimeout(S.governScreen, 500);
      setTimeout(S.governScreen, 1200);
      setTimeout(S.governScreen, 2500);
    });
  };

  /* =========================================================
     COMPATIBILITY GLOBALS
  ========================================================= */

  window.VocabState = S;

  window.getVocabSessionIdV6 = S.getSessionId;
  window.getStudentContextV63 = S.getStudentContext;
  window.saveStudentContextV63 = S.saveStudentContext;
  window.hydrateStudentFormV63 = S.hydrateStudentForm;

  window.showMenuScreenV65 = S.showMenu;
  window.showBattleScreenV6 = S.showBattle;

  window.backToVocabMenuV6 = function backToVocabMenuV6(){
    S.showMenu();

    try{
      if(typeof window.renderLeaderboardV68 === "function"){
        window.renderLeaderboardV68(window.VOCAB_APP?.selectedMode || "learn");
      }
    }catch(e){}

    return true;
  };

  window.buildWeakestTermsV6 = S.buildWeakestTerms;
  window.saveLastVocabSummaryV6 = S.saveLastSummary;
  window.saveTeacherSummaryV63 = S.saveTeacherSummary;

  window.validateStudentInfoBeforeStart = function validateStudentInfoBeforeStart(){
    const v = S.validateStudentContext();

    if(!v.ok){
      alert("กรุณากรอกข้อมูลผู้เรียนให้ครบก่อนเริ่มเกม: " + v.missing.join(", "));
      return false;
    }

    return true;
  };

  /* =========================================================
     BOOT
  ========================================================= */

  U.onReady(() => {
    S.getVisitId();
    S.hydrateStudentForm();
    S.installScreenGovernor();

    console.log("[VOCAB] state loaded", window.VOCAB_APP?.version || "");
  });

})();
