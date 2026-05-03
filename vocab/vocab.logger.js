/* =========================================================
   /vocab/vocab.logger.js
   TechPath Vocab Arena — Logger Service
   PATCH: v20260503h
   Purpose:
   - Send vocab events to latest Apps Script endpoint
   - Always use Bangkok +07 timestamp
   - Prevent detail fields becoming 0 when game sends mixed names
   - Support session_start / answer / term / session_end / leaderboard
   - Queue locally if endpoint fails
   - Compatible with split modules and old v6/v7 function names
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const VERSION = "vocab-logger-v20260503h";

  const DEFAULT_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbwsW0ffV5W_A81bNdcj32TDvgVBEUOk6IDPqqmqpePCVhY0X56dEv1XIOh2ygu0AG7i/exec";

  const QUEUE_KEY = "VOCAB_SPLIT_LOG_QUEUE";
  const SESSION_KEY = "VOCAB_SPLIT_CURRENT_SESSION";
  const MAX_QUEUE = 900;

  let SESSION = null;
  let DISABLED_UNTIL = 0;

  /* =========================================================
     BASIC HELPERS
  ========================================================= */

  function nowMs(){
    return Date.now();
  }

  function bangkokIsoNow(){
    /*
      เก็บเป็น ISO +07:00 จริง เช่น 2026-05-03T10:17:17.365+07:00
      ไม่ใช่ UTC Z
    */
    const utcNow = Date.now();
    const bangkokMs = utcNow + (7 * 60 * 60 * 1000);
    return new Date(bangkokMs).toISOString().replace("Z", "+07:00");
  }

  function utcIsoNow(){
    return new Date().toISOString();
  }

  function log(){
    try{
      console.log.apply(console, ["[VOCAB LOG]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function warn(){
    try{
      console.warn.apply(console, ["[VOCAB LOG]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function readJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){
      return fallback;
    }
  }

  function writeJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(e){
      warn("writeJson failed", key, e);
      return false;
    }
  }

  function getParam(name, fallback){
    try{
      const p = new URLSearchParams(location.search);
      return p.get(name) || fallback || "";
    }catch(e){
      return fallback || "";
    }
  }

  function readInput(id){
    const el = DOC.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function toNum(value, fallback){
    const n = Number(value);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function toInt(value, fallback){
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function toBool01(value){
    if(value === true) return 1;
    if(value === false) return 0;

    const s = String(value ?? "").toLowerCase().trim();

    if(["1", "true", "yes", "y", "ok", "completed", "done", "win", "passed"].includes(s)){
      return 1;
    }

    return 0;
  }

  function pick(){
    for(let i = 0; i < arguments.length; i++){
      const v = arguments[i];

      if(v !== undefined && v !== null && v !== ""){
        return v;
      }
    }

    return "";
  }

  function safeString(value){
    return String(value ?? "").trim();
  }

  function clone(obj){
    try{
      return JSON.parse(JSON.stringify(obj || {}));
    }catch(e){
      return Object.assign({}, obj || {});
    }
  }

  /* =========================================================
     CONFIG
  ========================================================= */

  function getConfig(){
    return (
      WIN.VOCAB_APP ||
      WIN.VocabConfig ||
      WIN.VOCAB_CONFIG ||
      {}
    );
  }

  function getEndpoint(){
    const config = getConfig();

    return (
      getParam("api") ||
      getParam("endpoint") ||
      config.endpoint ||
      config.sheetEndpoint ||
      config.apiEndpoint ||
      config.vocabEndpoint ||
      DEFAULT_ENDPOINT
    );
  }

  function getSchema(){
    const config = getConfig();

    return (
      config.schema ||
      config.logSchema ||
      "vocab-split-v1"
    );
  }

  function getSource(){
    const config = getConfig();

    return (
      config.source ||
      "vocab.html"
    );
  }

  function getVersion(){
    const config = getConfig();

    return (
      config.version ||
      config.appVersion ||
      "vocab-split-v1"
    );
  }

  /* =========================================================
     STUDENT CONTEXT
  ========================================================= */

  function getStudentContext(){
    let profile = {};

    if(WIN.VocabStorage && typeof WIN.VocabStorage.loadStudentProfile === "function"){
      try{
        profile = WIN.VocabStorage.loadStudentProfile() || {};
      }catch(e){
        profile = {};
      }
    }

    if(!profile || typeof profile !== "object"){
      profile = {};
    }

    const saved =
      readJson("VOCAB_SPLIT_STUDENT_PROFILE", {}) ||
      readJson("VOCAB_V71_STUDENT_PROFILE", {}) ||
      {};

    return {
      display_name:
        safeString(
          pick(
            profile.display_name,
            profile.displayName,
            profile.name,
            readInput("vocabDisplayName"),
            readInput("v63DisplayName"),
            getParam("name"),
            getParam("nick"),
            saved.display_name,
            saved.displayName,
            "Hero"
          )
        ),

      student_id:
        safeString(
          pick(
            profile.student_id,
            profile.studentId,
            profile.sid,
            profile.pid,
            readInput("vocabStudentId"),
            readInput("v63StudentId"),
            getParam("student_id"),
            getParam("studentId"),
            getParam("sid"),
            getParam("pid"),
            saved.student_id,
            saved.studentId,
            "anon"
          )
        ),

      section:
        safeString(
          pick(
            profile.section,
            profile.classSection,
            readInput("vocabSection"),
            readInput("v63Section"),
            getParam("section"),
            saved.section,
            ""
          )
        ),

      session_code:
        safeString(
          pick(
            profile.session_code,
            profile.sessionCode,
            readInput("vocabSessionCode"),
            readInput("v63SessionCode"),
            getParam("session_code"),
            getParam("studyId"),
            saved.session_code,
            saved.sessionCode,
            ""
          )
        )
    };
  }

  /* =========================================================
     GAME CONTEXT
  ========================================================= */

  function getState(){
    try{
      if(WIN.VocabState && typeof WIN.VocabState.get === "function"){
        return WIN.VocabState.get() || {};
      }
    }catch(e){}

    try{
      if(WIN.VocabState && WIN.VocabState.state){
        return WIN.VocabState.state || {};
      }
    }catch(e){}

    return WIN.VOCAB_APP || {};
  }

  function getGameContext(extra){
    extra = extra || {};

    const state = getState();
    const app = getConfig();

    const selectedBank =
      pick(
        extra.bank,
        extra.selectedBank,
        state.bank,
        state.selectedBank,
        app.bank,
        app.selectedBank,
        getParam("bank"),
        "A"
      );

    const selectedMode =
      pick(
        extra.mode,
        extra.selectedMode,
        state.mode,
        state.selectedMode,
        app.mode,
        app.selectedMode,
        getParam("mode"),
        "learn"
      );

    const selectedDifficulty =
      pick(
        extra.difficulty,
        extra.diff,
        extra.selectedDifficulty,
        state.difficulty,
        state.diff,
        state.selectedDifficulty,
        app.difficulty,
        app.diff,
        app.selectedDifficulty,
        getParam("difficulty"),
        getParam("diff"),
        "easy"
      );

    return {
      bank: safeString(selectedBank || "A"),
      mode: safeString(selectedMode || "learn"),
      difficulty: safeString(selectedDifficulty || "easy"),
      diff: safeString(selectedDifficulty || "easy"),

      run:
        safeString(
          pick(extra.run, state.run, app.run, getParam("run"), "play")
        ),

      seed:
        safeString(
          pick(extra.seed, state.seed, app.seed, getParam("seed"), "")
        ),

      page_url: location.href,
      user_agent: navigator.userAgent || ""
    };
  }

  /* =========================================================
     SESSION STATE
  ========================================================= */

  function newSessionId(){
    return "vocab_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  function loadSession(){
    if(SESSION) return SESSION;

    const saved = readJson(SESSION_KEY, null);

    if(saved && saved.session_id){
      SESSION = saved;
      return SESSION;
    }

    SESSION = {
      session_id: newSessionId(),
      visit_id: "visit_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      started_at_ms: nowMs(),
      started_at: bangkokIsoNow(),
      last_active_at_ms: nowMs(),
      last_active_at: bangkokIsoNow(),

      actions_count: 0,
      correct_count: 0,
      wrong_count: 0,
      mistakes: 0,
      question_count: 0,
      answered_count: 0,

      score: 0,
      combo_max: 0,
      ai_help_used: 0,
      hint_used: 0,
      shield_used: 0,
      laser_used: 0,

      weakest_terms: {},
      stage_id: "",
      stage_name: ""
    };

    saveSession();
    return SESSION;
  }

  function saveSession(){
    if(!SESSION) return;
    writeJson(SESSION_KEY, SESSION);
  }

  function resetSession(){
    SESSION = null;
    try{
      localStorage.removeItem(SESSION_KEY);
    }catch(e){}
  }

  function touchSession(){
    const s = loadSession();

    s.last_active_at_ms = nowMs();
    s.last_active_at = bangkokIsoNow();
    s.actions_count = toInt(s.actions_count, 0) + 1;

    saveSession();

    return s;
  }

  function enrichSessionFromEvent(action, data){
    const s = loadSession();
    data = data || {};

    if(action === "session_start"){
      s.started_at_ms = nowMs();
      s.started_at = bangkokIsoNow();
    }

    if(action === "answer" || action === "term_answer" || action === "question_answer"){
      s.answered_count = toInt(s.answered_count, 0) + 1;
      s.question_count = Math.max(
        toInt(s.question_count, 0),
        toInt(pick(data.question_no, data.questionNo, data.index, s.answered_count), s.answered_count)
      );

      const correct = toBool01(pick(data.correct, data.is_correct, data.isCorrect, 0));

      if(correct){
        s.correct_count = toInt(s.correct_count, 0) + 1;
      }else{
        s.wrong_count = toInt(s.wrong_count, 0) + 1;
        s.mistakes = toInt(s.mistakes, 0) + 1;

        const term = safeString(pick(data.term, data.word, data.question_term, data.prompt, ""));
        if(term){
          s.weakest_terms[term] = toInt(s.weakest_terms[term], 0) + 1;
        }
      }
    }

    if(data.score !== undefined) s.score = Math.max(toNum(s.score, 0), toNum(data.score, 0));
    if(data.combo_max !== undefined) s.combo_max = Math.max(toInt(s.combo_max, 0), toInt(data.combo_max, 0));
    if(data.comboMax !== undefined) s.combo_max = Math.max(toInt(s.combo_max, 0), toInt(data.comboMax, 0));

    if(data.ai_help_used !== undefined) s.ai_help_used = Math.max(toInt(s.ai_help_used, 0), toInt(data.ai_help_used, 0));
    if(data.aiHelpUsed !== undefined) s.ai_help_used = Math.max(toInt(s.ai_help_used, 0), toInt(data.aiHelpUsed, 0));

    if(data.hint_used !== undefined) s.hint_used = Math.max(toInt(s.hint_used, 0), toInt(data.hint_used, 0));
    if(data.hintUsed !== undefined) s.hint_used = Math.max(toInt(s.hint_used, 0), toInt(data.hintUsed, 0));

    if(data.shield_used !== undefined) s.shield_used = Math.max(toInt(s.shield_used, 0), toInt(data.shield_used, 0));
    if(data.laser_used !== undefined) s.laser_used = Math.max(toInt(s.laser_used, 0), toInt(data.laser_used, 0));

    if(data.stage_id || data.stageId) s.stage_id = safeString(pick(data.stage_id, data.stageId));
    if(data.stage_name || data.stageName) s.stage_name = safeString(pick(data.stage_name, data.stageName));

    s.last_active_at_ms = nowMs();
    s.last_active_at = bangkokIsoNow();

    saveSession();

    return s;
  }

  function getDurationSec(data){
    data = data || {};
    const s = loadSession();

    return Math.max(
      0,
      toInt(
        pick(
          data.duration_sec,
          data.durationSec,
          data.duration,
          data.play_time_sec,
          data.playTimeSec,
          Math.round((nowMs() - toNum(s.started_at_ms, nowMs())) / 1000)
        ),
        0
      )
    );
  }

  function getActiveTimeSec(data){
    data = data || {};
    const duration = getDurationSec(data);

    return Math.max(
      0,
      toInt(
        pick(
          data.active_time_sec,
          data.activeTimeSec,
          data.active_sec,
          data.activeSec,
          duration
        ),
        duration
      )
    );
  }

  function getWeakestTerm(data){
    data = data || {};
    const s = loadSession();

    const explicit =
      safeString(
        pick(
          data.weakest_term,
          data.weakestTerm,
          data.weakest_word,
          data.weakestWord,
          ""
        )
      );

    if(explicit) return explicit;

    const entries = Object.entries(s.weakest_terms || {});
    if(!entries.length) return "";

    entries.sort(function(a, b){
      return Number(b[1] || 0) - Number(a[1] || 0);
    });

    return entries[0][0] || "";
  }

  function calculateAccuracy(data){
    data = data || {};
    const s = loadSession();

    const explicit = pick(data.accuracy, data.accuracy_pct, data.accuracyPct, "");

    if(explicit !== ""){
      return Math.round(toNum(explicit, 0));
    }

    const correct = toInt(pick(data.correct_count, data.correctCount, s.correct_count), 0);
    const wrong = toInt(pick(data.wrong_count, data.wrongCount, data.mistakes, s.wrong_count), 0);
    const total = correct + wrong;

    if(total <= 0) return 0;

    return Math.round((correct / total) * 100);
  }

  /* =========================================================
     LOCAL QUEUE
  ========================================================= */

  function readQueue(){
    if(WIN.VocabStorage && typeof WIN.VocabStorage.readLocalQueue === "function"){
      try{
        return WIN.VocabStorage.readLocalQueue() || [];
      }catch(e){}
    }

    const q = readJson(QUEUE_KEY, []);
    return Array.isArray(q) ? q : [];
  }

  function saveQueue(queue){
    queue = Array.isArray(queue) ? queue.slice(-MAX_QUEUE) : [];

    if(WIN.VocabStorage && typeof WIN.VocabStorage.saveLocalQueue === "function"){
      try{
        WIN.VocabStorage.saveLocalQueue(queue);
        return true;
      }catch(e){}
    }

    return writeJson(QUEUE_KEY, queue);
  }

  function pushQueue(payload){
    if(WIN.VocabStorage && typeof WIN.VocabStorage.pushLocalQueue === "function"){
      try{
        WIN.VocabStorage.pushLocalQueue(payload, { max: MAX_QUEUE });
        return true;
      }catch(e){
        warn("VocabStorage.pushLocalQueue failed, fallback local queue", e);
      }
    }

    const queue = readQueue();

    queue.push({
      saved_at: bangkokIsoNow(),
      payload: payload || {}
    });

    saveQueue(queue);
    return true;
  }

  function clearQueue(){
    if(WIN.VocabStorage && typeof WIN.VocabStorage.clearLocalQueue === "function"){
      try{
        WIN.VocabStorage.clearLocalQueue();
        return true;
      }catch(e){}
    }

    try{
      localStorage.removeItem(QUEUE_KEY);
      return true;
    }catch(e){
      return false;
    }
  }

  /* =========================================================
     PAYLOAD NORMALIZATION
  ========================================================= */

  function normalizeAction(action){
    action = safeString(action || "event");

    const map = {
      start: "session_start",
      begin: "session_start",
      play_start: "session_start",

      end: "session_end",
      finish: "session_end",
      complete: "session_end",
      completed: "session_end",
      summary: "session_end",

      choice: "answer",
      question: "answer",
      answer_click: "answer",

      term: "term_answer",
      term_log: "term_answer"
    };

    return map[action] || action;
  }

  function buildPayload(action, data){
    action = normalizeAction(action);
    data = clone(data || {});

    const student = getStudentContext();
    const game = getGameContext(data);
    const s = enrichSessionFromEvent(action, data);

    const correctCount = toInt(
      pick(data.correct_count, data.correctCount, s.correct_count),
      0
    );

    const wrongCount = toInt(
      pick(data.wrong_count, data.wrongCount, data.mistakes, s.wrong_count),
      0
    );

    const mistakes = toInt(
      pick(data.mistakes, data.wrong_count, data.wrongCount, s.mistakes, wrongCount),
      0
    );

    const score = toNum(
      pick(data.score, data.total_score, data.totalScore, s.score),
      0
    );

    const comboMax = toInt(
      pick(data.combo_max, data.comboMax, data.max_combo, data.maxCombo, s.combo_max),
      0
    );

    const aiHelpUsed = toInt(
      pick(data.ai_help_used, data.aiHelpUsed, s.ai_help_used),
      0
    );

    const accuracy = calculateAccuracy(Object.assign({}, data, {
      correct_count: correctCount,
      wrong_count: wrongCount
    }));

    const fairScore = toNum(
      pick(
        data.fair_score,
        data.fairScore,
        aiHelpUsed > 0 ? Math.round(score * 0.95) : score
      ),
      score
    );

    const durationSec = getDurationSec(data);
    const activeTimeSec = getActiveTimeSec(data);

    const questionNo = toInt(
      pick(data.question_no, data.questionNo, data.q_no, data.qNo, s.answered_count),
      0
    );

    const questionCount = toInt(
      pick(data.question_count, data.questionCount, data.total_questions, data.totalQuestions, s.question_count),
      0
    );

    const completed = toBool01(
      pick(
        data.completed,
        data.complete,
        data.is_completed,
        data.isCompleted,
        action === "session_end" ? 1 : 0
      )
    );

    const bossDefeated = toBool01(
      pick(data.boss_defeated, data.bossDefeated, data.win, data.victory, 0)
    );

    const term =
      safeString(
        pick(
          data.term,
          data.word,
          data.vocab,
          data.keyword,
          data.question_term,
          data.questionTerm,
          ""
        )
      );

    const prompt =
      safeString(
        pick(
          data.prompt,
          data.question,
          data.question_text,
          data.questionText,
          data.text,
          ""
        )
      );

    const answer =
      safeString(
        pick(
          data.answer,
          data.selected,
          data.selected_answer,
          data.selectedAnswer,
          data.choice,
          ""
        )
      );

    const correctAnswer =
      safeString(
        pick(
          data.correct_answer,
          data.correctAnswer,
          data.key,
          data.solution,
          ""
        )
      );

    const isCorrect = toBool01(
      pick(data.correct, data.is_correct, data.isCorrect, "")
    );

    const payload = {
      api: "vocab",
      source: getSource(),
      schema: getSchema(),
      version: getVersion(),

      action: action,
      event_type: action,
      eventType: action,

      client_ts: bangkokIsoNow(),
      clientTs: bangkokIsoNow(),
      client_ts_utc: utcIsoNow(),

      session_id:
        safeString(
          pick(data.session_id, data.sessionId, s.session_id)
        ),

      sessionId:
        safeString(
          pick(data.session_id, data.sessionId, s.session_id)
        ),

      visit_id:
        safeString(
          pick(data.visit_id, data.visitId, s.visit_id)
        ),

      visitId:
        safeString(
          pick(data.visit_id, data.visitId, s.visit_id)
        ),

      display_name: student.display_name,
      displayName: student.display_name,
      student_id: student.student_id,
      studentId: student.student_id,
      section: student.section,
      class_section: student.section,
      session_code: student.session_code,
      sessionCode: student.session_code,

      bank: game.bank,
      mode: game.mode,
      difficulty: game.difficulty,
      diff: game.difficulty,
      run: game.run,
      seed: game.seed,

      started_at:
        safeString(
          pick(data.started_at, data.startedAt, s.started_at)
        ),

      startedAt:
        safeString(
          pick(data.started_at, data.startedAt, s.started_at)
        ),

      ended_at:
        action === "session_end"
          ? safeString(pick(data.ended_at, data.endedAt, bangkokIsoNow()))
          : safeString(pick(data.ended_at, data.endedAt, "")),

      endedAt:
        action === "session_end"
          ? safeString(pick(data.ended_at, data.endedAt, bangkokIsoNow()))
          : safeString(pick(data.ended_at, data.endedAt, "")),

      duration_sec: durationSec,
      durationSec: durationSec,
      active_time_sec: activeTimeSec,
      activeTimeSec: activeTimeSec,
      actions_count:
        toInt(pick(data.actions_count, data.actionsCount, s.actions_count), 0),
      actionsCount:
        toInt(pick(data.actions_count, data.actionsCount, s.actions_count), 0),

      score: score,
      raw_score: score,
      rawScore: score,
      fair_score: fairScore,
      fairScore: fairScore,

      accuracy: accuracy,
      correct_count: correctCount,
      correctCount: correctCount,
      wrong_count: wrongCount,
      wrongCount: wrongCount,
      mistakes: mistakes,

      question_no: questionNo,
      questionNo: questionNo,
      question_count: questionCount,
      questionCount: questionCount,

      combo:
        toInt(pick(data.combo, data.current_combo, data.currentCombo, 0), 0),
      combo_max: comboMax,
      comboMax: comboMax,

      hp:
        toInt(pick(data.hp, data.health, data.player_hp, data.playerHp, 0), 0),
      enemy_hp:
        toInt(pick(data.enemy_hp, data.enemyHp, data.boss_hp, data.bossHp, 0), 0),

      stage_id:
        safeString(pick(data.stage_id, data.stageId, s.stage_id, "")),
      stageId:
        safeString(pick(data.stage_id, data.stageId, s.stage_id, "")),
      stage_name:
        safeString(pick(data.stage_name, data.stageName, s.stage_name, "")),
      stageName:
        safeString(pick(data.stage_name, data.stageName, s.stage_name, "")),

      term: term,
      word: term,
      prompt: prompt,
      question_text: prompt,
      questionText: prompt,
      answer: answer,
      selected_answer: answer,
      selectedAnswer: answer,
      correct_answer: correctAnswer,
      correctAnswer: correctAnswer,
      correct: isCorrect,
      is_correct: isCorrect,
      isCorrect: isCorrect,

      weakest_term: getWeakestTerm(data),
      weakestTerm: getWeakestTerm(data),

      ai_help_used: aiHelpUsed,
      aiHelpUsed: aiHelpUsed,
      ai_assisted:
        toBool01(pick(data.ai_assisted, data.aiAssisted, aiHelpUsed > 0 ? 1 : 0)),
      aiAssisted:
        toBool01(pick(data.ai_assisted, data.aiAssisted, aiHelpUsed > 0 ? 1 : 0)),

      hint_used:
        toInt(pick(data.hint_used, data.hintUsed, s.hint_used), 0),
      hintUsed:
        toInt(pick(data.hint_used, data.hintUsed, s.hint_used), 0),

      shield_used:
        toInt(pick(data.shield_used, data.shieldUsed, s.shield_used), 0),
      shieldUsed:
        toInt(pick(data.shield_used, data.shieldUsed, s.shield_used), 0),

      laser_used:
        toInt(pick(data.laser_used, data.laserUsed, s.laser_used), 0),
      laserUsed:
        toInt(pick(data.laser_used, data.laserUsed, s.laser_used), 0),

      boss_defeated: bossDefeated,
      bossDefeated: bossDefeated,
      completed: completed,

      ai_recommended_mode:
        safeString(pick(data.ai_recommended_mode, data.aiRecommendedMode, "")),
      aiRecommendedMode:
        safeString(pick(data.ai_recommended_mode, data.aiRecommendedMode, "")),
      ai_recommended_difficulty:
        safeString(pick(data.ai_recommended_difficulty, data.aiRecommendedDifficulty, "")),
      aiRecommendedDifficulty:
        safeString(pick(data.ai_recommended_difficulty, data.aiRecommendedDifficulty, "")),
      ai_reason:
        safeString(pick(data.ai_reason, data.aiReason, "")),
      aiReason:
        safeString(pick(data.ai_reason, data.aiReason, "")),

      page_url: game.page_url,
      pageUrl: game.page_url,
      user_agent: game.user_agent,
      userAgent: game.user_agent,

      extra_json:
        safeString(
          pick(
            data.extra_json,
            data.extraJson,
            JSON.stringify({
              loggerVersion: VERSION,
              rawAction: action,
              raw: data
            })
          )
        ),

      extraJson:
        safeString(
          pick(
            data.extra_json,
            data.extraJson,
            JSON.stringify({
              loggerVersion: VERSION,
              rawAction: action,
              raw: data
            })
          )
        )
    };

    /*
      สำคัญ: ให้ raw data ทับเพิ่มได้ แต่ห้ามทับค่าหลักให้กลายเป็นว่าง
    */
    Object.keys(data).forEach(function(k){
      if(payload[k] === undefined || payload[k] === null || payload[k] === ""){
        payload[k] = data[k];
      }
    });

    return payload;
  }

  /* =========================================================
     SEND
  ========================================================= */

  function shouldDisableRemote(){
    return nowMs() < DISABLED_UNTIL;
  }

  function disableRemoteFor(ms){
    DISABLED_UNTIL = nowMs() + Number(ms || 120000);
  }

  async function postPayload(payload){
    const endpoint = getEndpoint();

    if(!endpoint){
      throw new Error("Missing vocab endpoint");
    }

    if(shouldDisableRemote()){
      throw new Error("Remote logger temporarily disabled");
    }

    const res = await fetch(endpoint, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    if(res.status === 401 || res.status === 403){
      disableRemoteFor(180000);
    }

    let json = null;
    let text = "";

    try{
      text = await res.text();
      json = text ? JSON.parse(text) : null;
    }catch(e){
      json = null;
    }

    if(!res.ok){
      throw new Error("HTTP " + res.status + " " + (text || ""));
    }

    return json || { ok: true };
  }

  async function logEvent(action, data, options){
    options = options || {};

    const payload = buildPayload(action, data || {});

    log(payload);

    /*
      เก็บ local ก่อนเสมอ กันเน็ตหลุด/ปิดหน้าเร็ว
    */
    if(options.local !== false){
      pushQueue(payload);
    }

    if(options.remote === false){
      return {
        ok: true,
        queued: true,
        payload: payload
      };
    }

    try{
      const result = await postPayload(payload);

      return {
        ok: true,
        result: result,
        payload: payload
      };
    }catch(err){
      warn("remote log failed; kept in local queue", err);

      return {
        ok: false,
        queued: true,
        error: String(err && err.message ? err.message : err),
        payload: payload
      };
    }
  }

  async function flushQueue(){
    const queue = readQueue();

    if(!queue.length){
      return {
        ok: true,
        sent: 0,
        remaining: 0
      };
    }

    const remaining = [];
    let sent = 0;

    for(const item of queue){
      const payload = item && item.payload ? item.payload : item;

      try{
        await postPayload(payload);
        sent += 1;
      }catch(err){
        remaining.push(item);
      }
    }

    saveQueue(remaining);

    return {
      ok: true,
      sent: sent,
      remaining: remaining.length
    };
  }

  /* =========================================================
     PUBLIC SHORTCUTS
  ========================================================= */

  function sessionStart(data){
    resetSession();
    loadSession();
    return logEvent("session_start", data || {});
  }

  function answer(data){
    return logEvent("answer", data || {});
  }

  function term(data){
    return logEvent("term_answer", data || {});
  }

  async function sessionEnd(data){
    data = data || {};

    const result = await logEvent("session_end", data);

    const payload = result.payload || buildPayload("session_end", data);

    /*
      update local leaderboard ทันทีหลังจบเกม
    */
    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.updateLeaderboard === "function"){
        WIN.VocabStorage.updateLeaderboard(payload);
      }

      if(WIN.VocabLeaderboard && typeof WIN.VocabLeaderboard.render === "function"){
        WIN.VocabLeaderboard.render(payload.mode || "learn");
      }else if(typeof WIN.renderLeaderboardV68 === "function"){
        WIN.renderLeaderboardV68(payload.mode || "learn");
      }
    }catch(e){
      warn("leaderboard update failed", e);
    }

    /*
      save last summary
    */
    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.saveLastSummary === "function"){
        WIN.VocabStorage.saveLastSummary(payload);
      }else{
        writeJson("VOCAB_SPLIT_LAST_SUMMARY", {
          saved_at: bangkokIsoNow(),
          summary: payload
        });
      }
    }catch(e){}

    return result;
  }

  function logDetail(data){
    return logEvent("detail", data || {});
  }

  function logPowerup(data){
    return logEvent("powerup", data || {});
  }

  function logAiHelp(data){
    data = data || {};
    data.ai_help_used = pick(data.ai_help_used, data.aiHelpUsed, 1);
    data.ai_assisted = 1;
    return logEvent("ai_help", data);
  }

  /* =========================================================
     UNLOAD FLUSH-HARDENING
  ========================================================= */

  function sendBeaconPayload(payload){
    const endpoint = getEndpoint();

    if(!endpoint || !navigator.sendBeacon) return false;

    try{
      const blob = new Blob([JSON.stringify(payload)], {
        type: "text/plain;charset=utf-8"
      });

      return navigator.sendBeacon(endpoint, blob);
    }catch(e){
      return false;
    }
  }

  function flushOnPageHide(){
    const s = loadSession();

    if(!s || !s.session_id) return;

    const payload = buildPayload("heartbeat", {
      duration_sec: Math.round((nowMs() - toNum(s.started_at_ms, nowMs())) / 1000),
      active_time_sec: Math.round((nowMs() - toNum(s.started_at_ms, nowMs())) / 1000),
      actions_count: s.actions_count,
      score: s.score,
      correct_count: s.correct_count,
      wrong_count: s.wrong_count,
      mistakes: s.mistakes,
      combo_max: s.combo_max
    });

    sendBeaconPayload(payload);
  }

  if(!WIN.__VOCAB_LOGGER_PAGEHIDE_BOUND__){
    WIN.__VOCAB_LOGGER_PAGEHIDE_BOUND__ = true;

    WIN.addEventListener("pagehide", flushOnPageHide);
    WIN.addEventListener("beforeunload", flushOnPageHide);
  }

  /* =========================================================
     EXPOSE API
  ========================================================= */

  const api = {
    version: VERSION,

    bangkokIsoNow,
    utcIsoNow,

    getEndpoint,
    getStudentContext,
    getGameContext,
    getSession: loadSession,
    resetSession,
    buildPayload,

    logEvent,
    sessionStart,
    answer,
    term,
    sessionEnd,
    logDetail,
    logPowerup,
    logAiHelp,

    flushQueue,
    readQueue,
    clearQueue,

    disableRemoteFor
  };

  WIN.VocabLogger = api;
  WIN.vocabLogger = api;

  /*
    Legacy aliases สำหรับไฟล์เก่าที่เรียกชื่อเดิม
  */
  WIN.logVocabEventV6 = function(action, data, options){
    return logEvent(action, data || {}, options || {});
  };

  WIN.logVocabSessionStartV6 = function(data){
    return sessionStart(data || {});
  };

  WIN.logVocabAnswerV6 = function(data){
    return answer(data || {});
  };

  WIN.logVocabTermV6 = function(data){
    return term(data || {});
  };

  WIN.logVocabSessionEndV6 = function(data){
    return sessionEnd(data || {});
  };

  WIN.flushVocabLogQueueV6 = flushQueue;

  WIN.VocabModules = WIN.VocabModules || {};
  WIN.VocabModules.logger = true;

  WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
  WIN.__VOCAB_MODULES__.logger = true;

  log("loaded", VERSION);
})();
