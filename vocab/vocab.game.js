/* =========================================================
   /vocab/vocab.game.js
   TechPath Vocab Arena — Game Engine
   FULL CLEAN PATCH: v20260503x

   Responsibilities:
   - start()
   - answer()
   - nextQuestion()
   - finish()
   - useHint()
   - useAiHelp()
   - updateState()
   - no auto-skip in learn/mission
   - guarded timer support for speed/battle
   - reward/logger/storage integration
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const VERSION = "vocab-game-v20260503x";

  const MODE_RULES = {
    learn: {
      label: "AI Training",
      enemy: "Coach Bot",
      avatar: "🤖",
      skill: "สอนคำศัพท์พร้อมคำอธิบาย",
      baseHp: 5,
      hints: 2,
      aiHelp: 3,
      shields: 1,
      autoSkip: false
    },

    speed: {
      label: "Speed Run",
      enemy: "Time Bug",
      avatar: "⚡",
      skill: "ตอบไว ทำ Combo ให้ต่อเนื่อง",
      baseHp: 4,
      hints: 1,
      aiHelp: 2,
      shields: 1,
      autoSkip: true
    },

    mission: {
      label: "Debug Mission",
      enemy: "Case Hacker",
      avatar: "🎯",
      skill: "อ่านสถานการณ์และเลือกคำศัพท์ให้ตรงบริบท",
      baseHp: 5,
      hints: 2,
      aiHelp: 2,
      shields: 1,
      autoSkip: false
    },

    battle: {
      label: "Boss Battle",
      enemy: "Vocab Virus",
      avatar: "👾",
      skill: "ใช้ Combo และความแม่นยำโจมตีบอส",
      baseHp: 4,
      hints: 1,
      aiHelp: 1,
      shields: 1,
      autoSkip: true
    },

    bossrush: {
      label: "Boss Rush",
      enemy: "Final Syntax Dragon",
      avatar: "🐉",
      skill: "โหมดท้าทายสูงสุด",
      baseHp: 3,
      hints: 1,
      aiHelp: 1,
      shields: 0,
      autoSkip: true
    }
  };

  const DIFF_RULES = {
    easy: {
      label: "Easy",
      scoreBase: 100,
      enemyHp: 600,
      damage: 100,
      wrongDamage: 1
    },

    normal: {
      label: "Normal",
      scoreBase: 120,
      enemyHp: 800,
      damage: 110,
      wrongDamage: 1
    },

    hard: {
      label: "Hard",
      scoreBase: 140,
      enemyHp: 1000,
      damage: 125,
      wrongDamage: 1
    },

    challenge: {
      label: "Challenge",
      scoreBase: 160,
      enemyHp: 1200,
      damage: 140,
      wrongDamage: 1
    }
  };

  const state = {
    running: false,
    ended: false,
    locked: false,

    bank: "A",
    mode: "learn",
    difficulty: "easy",
    diff: "easy",
    seed: "",

    display_name: "Hero",
    student_id: "anon",
    section: "",
    session_code: "",

    session_id: "",
    started_at_ms: 0,
    started_at: "",

    questions: [],
    questionList: [],
    currentQuestion: null,
    questionIndex: 0,
    index: 0,
    questionNo: 0,
    questionCount: 0,

    score: 0,
    raw_score: 0,
    fair_score: 0,

    combo: 0,
    currentCombo: 0,
    comboMax: 0,
    combo_max: 0,

    hp: 5,
    lives: 5,
    maxHp: 5,

    enemyHp: 100,
    enemy_hp: 100,
    enemyMaxHp: 100,
    enemy_max_hp: 100,

    correctCount: 0,
    correct_count: 0,
    wrongCount: 0,
    wrong_count: 0,
    mistakes: 0,

    answeredCount: 0,
    answered_count: 0,

    hints: 0,
    hintCount: 0,
    hint_used: 0,
    hintUsed: 0,

    aiHelp: 0,
    aiHelpLeft: 0,
    ai_help_left: 0,
    ai_help_used: 0,
    aiHelpUsed: 0,

    shields: 0,
    shield: 0,
    shield_used: 0,

    laserReady: false,
    laser_ready: false,
    laser_used: 0,

    fever: false,
    isFever: false,

    weak_terms: [],
    weakTerms: [],
    weakest_term: "",
    weakestTerm: "",

    timeLeft: 0,
    timer: 0,
    questionTimeSec: 0,
    autoSkipQuestion: false,

    stageId: "",
    stage_id: "",
    stageName: "",
    stage_name: "",
    stageGoal: "",
    stage_goal: "",

    enemyName: "Bug Slime",
    enemy_name: "Bug Slime",
    enemyAvatar: "👾",
    enemy_avatar: "👾",
    enemySkill: "Enemy skill",
    enemy_skill: "Enemy skill"
  };

  let answerLock = false;
  let timerId = null;
  let lastAnswerAt = 0;

  /* =========================================================
     BASIC HELPERS
  ========================================================= */

  function log(){
    try{
      console.log.apply(console, ["[VOCAB GAME]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function warn(){
    try{
      console.warn.apply(console, ["[VOCAB GAME]"].concat(Array.from(arguments)));
    }catch(e){}
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

  function clean(s){
    return String(s ?? "").trim();
  }

  function norm(s){
    return clean(s).toLowerCase().replace(/\s+/g, " ");
  }

  function num(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function int(v, fallback){
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function nowMs(){
    return Date.now();
  }

  function bangkokIsoNow(){
    const bangkokMs = Date.now() + (7 * 60 * 60 * 1000);
    return new Date(bangkokMs).toISOString().replace("Z", "+07:00");
  }

  function getParam(name, fallback){
    try{
      const p = new URLSearchParams(location.search);
      return p.get(name) || fallback || "";
    }catch(e){
      return fallback || "";
    }
  }

  function normalizeMode(mode){
    mode = norm(mode || "learn");

    if(mode === "ai" || mode === "training" || mode === "ai_training"){
      return "learn";
    }

    if(mode === "debug" || mode === "debug_mission"){
      return "mission";
    }

    if(mode === "boss" || mode === "boss_battle"){
      return "battle";
    }

    if(["learn", "speed", "mission", "battle", "bossrush"].includes(mode)){
      return mode;
    }

    return "learn";
  }

  function normalizeDifficulty(diff){
    diff = norm(diff || "easy");

    if(["easy", "normal", "hard", "challenge"].includes(diff)){
      return diff;
    }

    return "easy";
  }

  function getModeRule(mode){
    return MODE_RULES[normalizeMode(mode)] || MODE_RULES.learn;
  }

  function getDiffRule(diff){
    return DIFF_RULES[normalizeDifficulty(diff)] || DIFF_RULES.easy;
  }

  function getQuestionRule(){
    if(WIN.VocabTimeTune && typeof WIN.VocabTimeTune.getRule === "function"){
      try{
        return WIN.VocabTimeTune.getRule();
      }catch(e){}
    }

    if(WIN.VocabTimeGuard && typeof WIN.VocabTimeGuard.getRule === "function"){
      try{
        return WIN.VocabTimeGuard.getRule();
      }catch(e){}
    }

    const mode = normalizeMode(state.mode);
    const diff = normalizeDifficulty(state.difficulty);

    const fallback = {
      learn: { easy:60, normal:50, hard:45, challenge:40, autoSkip:false },
      mission: { easy:55, normal:50, hard:45, challenge:40, autoSkip:false },
      speed: { easy:35, normal:30, hard:25, challenge:22, autoSkip:true },
      battle: { easy:40, normal:35, hard:30, challenge:25, autoSkip:true },
      bossrush: { easy:40, normal:35, hard:30, challenge:25, autoSkip:true }
    };

    const group = fallback[mode] || fallback.learn;

    return {
      seconds: Number(group[diff] || group.easy || 60),
      autoSkip: !!group.autoSkip,
      mode: mode,
      difficulty: diff
    };
  }

  function cloneState(){
    return Object.assign({}, state, {
      questions: state.questions,
      questionList: state.questionList,
      currentQuestion: state.currentQuestion
    });
  }

  /* =========================================================
     EXTERNAL MODULE HELPERS
  ========================================================= */

  function patchExternalState(update){
    update = update || {};

    Object.assign(state, update);

    WIN.VOCAB_APP = WIN.VOCAB_APP || {};
    Object.assign(WIN.VOCAB_APP, update);

    try{
      if(WIN.VocabState && typeof WIN.VocabState.set === "function"){
        WIN.VocabState.set(update);
      }else if(WIN.VocabState && WIN.VocabState.state){
        Object.assign(WIN.VocabState.state, update);
      }
    }catch(e){}
  }

  function renderHud(){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.updateHud === "function"){
        WIN.VocabUI.updateHud(cloneState());
      }
    }catch(e){}
  }

  function renderQuestion(){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.renderQuestion === "function"){
        WIN.VocabUI.renderQuestion(state.currentQuestion, cloneState());
      }
    }catch(e){
      warn("renderQuestion failed", e);
    }
  }

  function showExplain(html){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.showExplain === "function"){
        WIN.VocabUI.showExplain(html);
      }
    }catch(e){}
  }

  function showAiHelp(text){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.showAiHelp === "function"){
        WIN.VocabUI.showAiHelp(text);
      }
    }catch(e){}
  }

  function uiPop(text, type){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.pop === "function"){
        WIN.VocabUI.pop(text, type);
        return;
      }

      if(WIN.VocabUI && typeof WIN.VocabUI.floatText === "function"){
        WIN.VocabUI.floatText(text, type);
      }
    }catch(e){}
  }

  function uiScoreBurst(points, combo){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.scoreBurst === "function"){
        WIN.VocabUI.scoreBurst(points, combo);
      }
    }catch(e){}
  }

  function uiBeep(type){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.beep === "function"){
        WIN.VocabUI.beep(type);
      }
    }catch(e){}
  }

  function showBattleScreen(){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.showBattle === "function"){
        WIN.VocabUI.showBattle();
      }
    }catch(e){}
  }

  function showReward(summary){
    try{
      if(WIN.VocabReward && typeof WIN.VocabReward.show === "function"){
        WIN.VocabReward.show(summary);
        return;
      }

      if(WIN.VocabUI && typeof WIN.VocabUI.finishGame === "function"){
        WIN.VocabUI.finishGame(summary);
      }
    }catch(e){
      warn("reward failed", e);
    }
  }

  function logSessionStart(payload){
    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.sessionStart === "function"){
        WIN.VocabLogger.sessionStart(payload);
        return;
      }

      if(typeof WIN.logVocabSessionStartV6 === "function"){
        WIN.logVocabSessionStartV6(payload);
        return;
      }

      if(typeof WIN.logVocabEventV6 === "function"){
        WIN.logVocabEventV6("session_start", payload);
      }
    }catch(e){}
  }

  function logAnswer(payload){
    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.answer === "function"){
        WIN.VocabLogger.answer(payload);
        return;
      }

      if(typeof WIN.logVocabAnswerV6 === "function"){
        WIN.logVocabAnswerV6(payload);
        return;
      }

      if(typeof WIN.logVocabEventV6 === "function"){
        WIN.logVocabEventV6("answer", payload);
      }
    }catch(e){}
  }

  function logSessionEnd(payload){
    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.sessionEnd === "function"){
        WIN.VocabLogger.sessionEnd(payload);
        return;
      }

      if(typeof WIN.logVocabSessionEndV6 === "function"){
        WIN.logVocabSessionEndV6(payload);
        return;
      }

      if(typeof WIN.logVocabEventV6 === "function"){
        WIN.logVocabEventV6("session_end", payload);
      }
    }catch(e){}
  }

  /* =========================================================
     QUESTION HELPERS
  ========================================================= */

  function normalizeChoice(choice){
    if(choice && typeof choice === "object"){
      return {
        text: clean(pick(choice.text, choice.label, choice.value, choice.answer, "")),
        value: clean(pick(choice.value, choice.text, choice.label, choice.answer, "")),
        correct:
          choice.correct === true ||
          choice.isCorrect === true ||
          choice.is_correct === true
      };
    }

    return {
      text: clean(choice),
      value: clean(choice),
      correct: false
    };
  }

  function normalizeQuestion(q){
    q = q || {};

    const rawChoices = q.choices || q.options || q.answers || [];
    const choices = Array.isArray(rawChoices) ? rawChoices.map(normalizeChoice) : [];

    let correct = clean(
      pick(
        q.correct,
        q.correct_answer,
        q.correctAnswer,
        q.answer,
        q.key,
        ""
      )
    );

    if(!correct){
      const flagged = choices.find(c => c.correct);
      if(flagged) correct = flagged.value;
    }

    return Object.assign({}, q, {
      id: clean(pick(q.id, q.qid, q.question_id, "")),
      term: clean(pick(q.term, q.word, q.vocab, q.keyword, "")),
      prompt: clean(pick(q.prompt, q.question, q.question_text, q.questionText, q.text, "")),
      choices: choices,
      options: choices,
      correct: correct,
      correct_answer: correct,
      correctAnswer: correct,
      explain: clean(pick(q.explain, q.explanation, q.feedback, "")),
      hint: clean(pick(q.hint, q.tip, ""))
    });
  }

  function getQuestions(options){
    options = options || {};

    const bank = clean(options.bank || state.bank || "A").toUpperCase();
    const difficulty = normalizeDifficulty(options.difficulty || options.diff || state.difficulty);
    const mode = normalizeMode(options.mode || state.mode);
    const seed = pick(options.seed, state.seed, Date.now());

    const engine = WIN.VocabQuestion || WIN.VocabQuestions || WIN.VocabQuestionEngine;

    if(engine && typeof engine.getQuestions === "function"){
      const questions = engine.getQuestions({
        bank: bank,
        difficulty: difficulty,
        diff: difficulty,
        mode: mode,
        seed: seed
      });

      if(Array.isArray(questions) && questions.length){
        return questions.map(normalizeQuestion);
      }
    }

    if(engine && typeof engine.buildQuestions === "function"){
      const questions = engine.buildQuestions(bank, difficulty, mode);

      if(Array.isArray(questions) && questions.length){
        return questions.map(normalizeQuestion);
      }
    }

    warn("No questions generated");
    return [];
  }

  function setCurrentQuestion(index){
    index = Math.max(0, Math.min(index, state.questions.length - 1));

    state.questionIndex = index;
    state.index = index;
    state.currentIndex = index;

    state.currentQuestion = normalizeQuestion(state.questions[index]);

    state.questionNo = index + 1;
    state.questionCount = state.questions.length;

    state.stageId = "stage-" + state.questionNo;
    state.stage_id = state.stageId;

    state.stageName = "Question " + state.questionNo;
    state.stage_name = state.stageName;

    state.stageGoal = "ตอบให้ถูกและจำความหมาย";
    state.stage_goal = state.stageGoal;

    patchExternalState({
      currentQuestion: state.currentQuestion,
      question: state.currentQuestion,
      activeQuestion: state.currentQuestion,

      questionIndex: state.questionIndex,
      index: state.index,
      currentIndex: state.currentIndex,

      questionNo: state.questionNo,
      question_count: state.questionCount,
      questionCount: state.questionCount,

      stageId: state.stageId,
      stage_id: state.stage_id,
      stageName: state.stageName,
      stage_name: state.stage_name,
      stageGoal: state.stageGoal,
      stage_goal: state.stage_goal
    });

    renderQuestion();
    startQuestionTimer();
  }

  /* =========================================================
     TIMER
  ========================================================= */

  function stopTimer(){
    if(timerId){
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startQuestionTimer(){
    stopTimer();

    const rule = getQuestionRule();

    state.questionTimeSec = Number(rule.seconds || 60);
    state.timeLeft = Number(rule.seconds || 60);
    state.timer = state.timeLeft;
    state.autoSkipQuestion = !!rule.autoSkip;

    patchExternalState({
      questionTimeSec: state.questionTimeSec,
      perQuestionTime: state.questionTimeSec,
      timeLeft: state.timeLeft,
      timer: state.timer,
      autoSkipQuestion: state.autoSkipQuestion
    });

    renderHud();

    /*
      ให้ VocabTimeGuard เป็นตัวหลักถ้ามีอยู่แล้ว
      เพื่อกัน auto-next ซ้อนกัน
    */
    if(WIN.VocabTimeGuard && typeof WIN.VocabTimeGuard.startTimerForQuestion === "function"){
      try{
        WIN.VocabTimeGuard.startTimerForQuestion();
        return;
      }catch(e){}
    }

    timerId = setInterval(function(){
      if(!state.running || state.ended || state.locked){
        return;
      }

      state.timeLeft -= 1;
      state.timer = state.timeLeft;

      patchExternalState({
        timeLeft: state.timeLeft,
        timer: state.timer
      });

      renderHud();

      if(state.timeLeft <= 0){
        stopTimer();

        if(state.autoSkipQuestion){
          timeoutQuestion();
        }else{
          showExplain(
            "⏳ <b>ใช้เวลานานแล้ว</b><br>ข้อนี้จะยังไม่เปลี่ยนเอง ลองเลือกคำตอบที่คิดว่าใกล้เคียงที่สุด"
          );
        }
      }
    }, 1000);
  }

  function timeoutQuestion(){
    if(state.locked || state.ended) return;

    state.locked = true;

    state.wrongCount += 1;
    state.wrong_count = state.wrongCount;
    state.mistakes += 1;
    state.answeredCount += 1;
    state.answered_count = state.answeredCount;
    state.combo = 0;
    state.currentCombo = 0;

    state.hp = Math.max(0, state.hp - getDiffRule(state.difficulty).wrongDamage);
    state.lives = state.hp;

    const q = normalizeQuestion(state.currentQuestion);

    pushWeakTerm(q);

    uiBeep("bad");
    uiPop("⏰ Time!", "bad");

    showExplain(
      "⏰ <b>หมดเวลา</b><br>" +
      (q.correct ? "คำตอบที่ถูกคือ: <b>" + escapeHtml(q.correct) + "</b><br>" : "") +
      "ไปข้อถัดไปกันเลย"
    );

    logAnswer(buildAnswerPayload({
      selected: "",
      correct: false,
      timeout: true,
      q: q
    }));

    renderHud();

    setTimeout(function(){
      state.locked = false;
      nextQuestion({ force:true });
    }, 900);
  }

  /* =========================================================
     ANSWER FLOW
  ========================================================= */

  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function pushWeakTerm(q){
    q = normalizeQuestion(q);

    if(!q.term) return;

    const existing = state.weak_terms.find(x => norm(x.term) === norm(q.term));

    if(existing){
      existing.count = int(existing.count, 1) + 1;
    }else{
      state.weak_terms.push({
        term: q.term,
        meaning: q.correct,
        count: 1
      });
    }

    state.weakTerms = state.weak_terms;
    state.weakest_term = state.weak_terms[0] ? state.weak_terms[0].term : "";
    state.weakestTerm = state.weakest_term;

    patchExternalState({
      weak_terms: state.weak_terms,
      weakTerms: state.weakTerms,
      weakest_term: state.weakest_term,
      weakestTerm: state.weakestTerm
    });
  }

  function computePoints(isCorrect){
    if(!isCorrect) return 0;

    const diffRule = getDiffRule(state.difficulty);
    const comboBonus = Math.max(0, state.combo) * 10;
    const speedBonus = state.timeLeft > 0 ? Math.min(40, state.timeLeft) : 0;

    return diffRule.scoreBase + comboBonus + speedBonus;
  }

  function damageEnemy(isCorrect){
    if(!isCorrect) return 0;

    const diffRule = getDiffRule(state.difficulty);

    const damage =
      diffRule.damage +
      Math.max(0, state.combo) * 8 +
      (state.fever ? 35 : 0);

    state.enemyHp = Math.max(0, state.enemyHp - damage);
    state.enemy_hp = state.enemyHp;

    return damage;
  }

  function updateFeverAndLaser(){
    state.fever = state.combo >= 4;
    state.isFever = state.fever;

    state.laserReady = state.combo >= 6;
    state.laser_ready = state.laserReady;
  }

  function answer(selectedValue, btn){
    if(!state.running || state.ended) return false;

    const now = Date.now();
    if(now - lastAnswerAt < 250) return false;
    lastAnswerAt = now;

    if(answerLock || state.locked) return false;

    answerLock = true;
    state.locked = true;

    stopTimer();

    const q = normalizeQuestion(state.currentQuestion);

    const selected = clean(
      typeof selectedValue === "object" && selectedValue
        ? pick(selectedValue.value, selectedValue.text, selectedValue.label, "")
        : selectedValue
    );

    const correct = clean(q.correct);
    const isCorrect = !!correct && norm(selected) === norm(correct);

    state.answeredCount += 1;
    state.answered_count = state.answeredCount;

    if(isCorrect){
      state.correctCount += 1;
      state.correct_count = state.correctCount;

      const points = computePoints(true);
      state.score += points;
      state.raw_score = state.score;

      state.combo += 1;
      state.currentCombo = state.combo;
      state.comboMax = Math.max(state.comboMax, state.combo);
      state.combo_max = state.comboMax;

      const damage = damageEnemy(true);

      updateFeverAndLaser();

      patchExternalState(scoreStatePatch());

      markChoiceResult(selected, correct, true, q);

      uiBeep("good");
      uiPop("✅ Correct!", "good");
      uiScoreBurst(points, state.combo);

      showExplain(
        q.explain
          ? "✅ <b>ถูกต้อง!</b><br>" + escapeHtml(q.explain)
          : "✅ <b>ถูกต้อง!</b><br>โจมตีบอส -" + damage
      );
    }else{
      state.wrongCount += 1;
      state.wrong_count = state.wrongCount;
      state.mistakes += 1;

      state.combo = 0;
      state.currentCombo = 0;

      state.hp = Math.max(0, state.hp - getDiffRule(state.difficulty).wrongDamage);
      state.lives = state.hp;

      updateFeverAndLaser();
      pushWeakTerm(q);

      patchExternalState(scoreStatePatch());

      markChoiceResult(selected, correct, false, q);

      uiBeep("bad");
      uiPop("❌ Try again", "bad");

      showExplain(
        "❌ <b>ยังไม่ถูก</b><br>" +
        (correct ? "คำตอบที่ถูกคือ: <b>" + escapeHtml(correct) + "</b><br>" : "") +
        (q.explain ? escapeHtml(q.explain) : "ลองดู keyword ในโจทย์ แล้วจำความหมายของคำนี้ไว้")
      );
    }

    logAnswer(buildAnswerPayload({
      selected: selected,
      correct: isCorrect,
      timeout: false,
      q: q
    }));

    renderHud();

    setTimeout(function(){
      answerLock = false;
      state.locked = false;

      if(state.hp <= 0){
        finish({ reason:"hp_zero" });
        return;
      }

      if(state.enemyHp <= 0 && state.mode === "battle"){
        /*
          battle จบเมื่อชนะบอส
        */
        finish({ reason:"boss_defeated" });
        return;
      }

      nextQuestion({ force:true });
    }, 950);

    return true;
  }

  function scoreStatePatch(){
    return {
      score: state.score,
      raw_score: state.raw_score,

      combo: state.combo,
      currentCombo: state.currentCombo,
      comboMax: state.comboMax,
      combo_max: state.combo_max,

      hp: state.hp,
      lives: state.lives,

      enemyHp: state.enemyHp,
      enemy_hp: state.enemy_hp,
      enemyMaxHp: state.enemyMaxHp,
      enemy_max_hp: state.enemy_max_hp,

      correctCount: state.correctCount,
      correct_count: state.correct_count,

      wrongCount: state.wrongCount,
      wrong_count: state.wrong_count,

      mistakes: state.mistakes,

      answeredCount: state.answeredCount,
      answered_count: state.answered_count,

      fever: state.fever,
      isFever: state.isFever,

      laserReady: state.laserReady,
      laser_ready: state.laser_ready
    };
  }

  function markChoiceResult(selected, correct, isCorrect, q){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.markChoiceResult === "function"){
        WIN.VocabUI.markChoiceResult(
          selected,
          correct,
          isCorrect
            ? "✅ ถูกต้อง!"
            : "❌ ยังไม่ถูก"
        );
        return;
      }
    }catch(e){}

    try{
      DOC.querySelectorAll("[data-vocab-choice]").forEach(function(btn){
        const value = clean(btn.dataset.vocabChoice || btn.textContent);

        btn.disabled = true;
        btn.classList.add("locked");

        if(norm(value) === norm(correct)){
          btn.classList.add("correct");
        }

        if(norm(value) === norm(selected) && !isCorrect){
          btn.classList.add("wrong");
        }
      });
    }catch(e){}
  }

  function buildAnswerPayload(data){
    data = data || {};
    const q = normalizeQuestion(data.q || state.currentQuestion);

    return {
      session_id: state.session_id,
      sessionId: state.session_id,

      bank: state.bank,
      mode: state.mode,
      difficulty: state.difficulty,
      diff: state.difficulty,

      display_name: state.display_name,
      displayName: state.display_name,
      student_id: state.student_id,
      studentId: state.student_id,
      section: state.section,
      session_code: state.session_code,
      sessionCode: state.session_code,

      term: q.term,
      word: q.term,
      prompt: q.prompt,
      question_text: q.prompt,
      questionText: q.prompt,

      answer: data.selected || "",
      selected_answer: data.selected || "",
      selectedAnswer: data.selected || "",

      correct_answer: q.correct,
      correctAnswer: q.correct,
      correct: data.correct ? 1 : 0,
      is_correct: data.correct ? 1 : 0,
      isCorrect: data.correct ? 1 : 0,

      timeout: data.timeout ? 1 : 0,

      score: state.score,
      raw_score: state.raw_score,
      combo: state.combo,
      combo_max: state.comboMax,
      comboMax: state.comboMax,
      hp: state.hp,

      enemy_hp: state.enemyHp,
      enemyHp: state.enemyHp,

      question_no: state.questionNo,
      questionNo: state.questionNo,
      question_count: state.questionCount,
      questionCount: state.questionCount,

      correct_count: state.correctCount,
      correctCount: state.correctCount,
      wrong_count: state.wrongCount,
      wrongCount: state.wrongCount,
      mistakes: state.mistakes,

      accuracy: accuracy(),

      ai_help_used: state.ai_help_used,
      aiHelpUsed: state.aiHelpUsed,
      ai_assisted: state.ai_help_used > 0 ? 1 : 0,
      aiAssisted: state.ai_help_used > 0 ? 1 : 0,

      stage_id: state.stage_id,
      stageId: state.stageId,
      stage_name: state.stage_name,
      stageName: state.stageName
    };
  }

  /* =========================================================
     NEXT / FINISH
  ========================================================= */

  function nextQuestion(options){
    options = options || {};

    if(!state.running || state.ended) return false;

    if(state.locked && !options.force){
      return false;
    }

    const nextIndex = state.questionIndex + 1;

    if(nextIndex >= state.questions.length){
      finish({ reason:"completed" });
      return true;
    }

    setCurrentQuestion(nextIndex);
    return true;
  }

  function accuracy(){
    const total = state.correctCount + state.wrongCount;
    if(total <= 0) return 0;
    return Math.round((state.correctCount / total) * 100);
  }

  function durationSec(){
    if(!state.started_at_ms) return 0;
    return Math.max(0, Math.round((Date.now() - state.started_at_ms) / 1000));
  }

  function buildSummary(extra){
    extra = extra || {};

    const duration = durationSec();
    const acc = accuracy();
    const fairScore =
      state.ai_help_used > 0
        ? Math.round(state.score * 0.95)
        : state.score;

    return {
      api: "vocab",
      source: "vocab.html",
      schema: "vocab-split-v1",
      version: VERSION,

      action: "session_end",
      event_type: "session_end",
      eventType: "session_end",

      session_id: state.session_id,
      sessionId: state.session_id,

      client_ts: bangkokIsoNow(),
      clientTs: bangkokIsoNow(),

      display_name: state.display_name,
      displayName: state.display_name,
      student_id: state.student_id,
      studentId: state.student_id,
      section: state.section,
      session_code: state.session_code,
      sessionCode: state.session_code,

      bank: state.bank,
      mode: state.mode,
      difficulty: state.difficulty,
      diff: state.difficulty,

      score: state.score,
      raw_score: state.score,
      rawScore: state.score,

      fair_score: fairScore,
      fairScore: fairScore,

      accuracy: acc,

      correct_count: state.correctCount,
      correctCount: state.correctCount,
      wrong_count: state.wrongCount,
      wrongCount: state.wrongCount,
      mistakes: state.mistakes,

      combo_max: state.comboMax,
      comboMax: state.comboMax,

      question_count: state.questionCount,
      questionCount: state.questionCount,
      answered_count: state.answeredCount,
      answeredCount: state.answeredCount,

      duration_sec: duration,
      durationSec: duration,
      active_time_sec: duration,
      activeTimeSec: duration,

      ai_help_used: state.ai_help_used,
      aiHelpUsed: state.aiHelpUsed,
      ai_assisted: state.ai_help_used > 0 ? 1 : 0,
      aiAssisted: state.ai_help_used > 0 ? 1 : 0,

      hint_used: state.hint_used,
      hintUsed: state.hintUsed,

      shield_used: state.shield_used,
      laser_used: state.laser_used,

      weak_terms: state.weak_terms,
      weakTerms: state.weakTerms,
      weakest_term: state.weakest_term,
      weakestTerm: state.weakestTerm,

      completed: extra.reason === "completed" || state.questionIndex >= state.questions.length - 1 ? 1 : 0,
      boss_defeated: state.enemyHp <= 0 ? 1 : 0,
      bossDefeated: state.enemyHp <= 0 ? 1 : 0,

      end_reason: extra.reason || "completed",
      endReason: extra.reason || "completed"
    };
  }

  function finish(extra){
    if(state.ended) return false;

    stopTimer();

    state.running = false;
    state.ended = true;
    state.locked = true;

    const summary = buildSummary(extra || {});

    state.fair_score = summary.fair_score;

    patchExternalState({
      running: false,
      ended: true,
      fair_score: summary.fair_score,
      fairScore: summary.fair_score,
      accuracy: summary.accuracy,
      completed: summary.completed,
      boss_defeated: summary.boss_defeated,
      bossDefeated: summary.bossDefeated
    });

    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.saveLastSummary === "function"){
        WIN.VocabStorage.saveLastSummary(summary);
      }
    }catch(e){}

    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.updateLeaderboard === "function"){
        WIN.VocabStorage.updateLeaderboard(summary);
      }
    }catch(e){}

    logSessionEnd(summary);

    showReward(summary);

    log("finish", summary);

    return summary;
  }

  /* =========================================================
     HINT / AI HELP / LASER
  ========================================================= */

  function useHint(){
    if(!state.running || state.ended) return false;

    if(state.hints <= 0){
      showExplain("💡 Hint หมดแล้ว ลองใช้ความจำจากคำอธิบายก่อนหน้า");
      return false;
    }

    state.hints -= 1;
    state.hintCount = state.hints;
    state.hint_used += 1;
    state.hintUsed = state.hint_used;

    const q = normalizeQuestion(state.currentQuestion);

    patchExternalState({
      hints: state.hints,
      hintCount: state.hintCount,
      hint_used: state.hint_used,
      hintUsed: state.hintUsed
    });

    showExplain(
      "💡 <b>Hint:</b> " +
      escapeHtml(q.hint || "ลองดู keyword ในโจทย์ แล้วตัดตัวเลือกที่ไม่เกี่ยวข้องออกก่อน")
    );

    renderHud();

    return true;
  }

  function useAiHelp(){
    if(!state.running || state.ended) return false;

    if(state.aiHelpLeft <= 0){
      showAiHelp("AI Help หมดแล้ว ลองตอบด้วยตัวเองเพื่อวัดความจำจริง");
      return false;
    }

    state.aiHelpLeft -= 1;
    state.ai_help_left = state.aiHelpLeft;

    state.ai_help_used += 1;
    state.aiHelpUsed = state.ai_help_used;

    const q = normalizeQuestion(state.currentQuestion);

    patchExternalState({
      aiHelpLeft: state.aiHelpLeft,
      ai_help_left: state.ai_help_left,
      ai_help_used: state.ai_help_used,
      aiHelpUsed: state.aiHelpUsed,
      ai_assisted: 1,
      aiAssisted: 1
    });

    let msg = "มองหาความหมายที่ตรงกับคำว่า “" + q.term + "” มากที่สุด";

    if(q.correct){
      msg += " คำตอบจะเกี่ยวข้องกับ: " + q.correct;
    }

    showAiHelp(msg);

    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.logAiHelp === "function"){
        WIN.VocabLogger.logAiHelp({
          session_id: state.session_id,
          bank: state.bank,
          mode: state.mode,
          difficulty: state.difficulty,
          question_no: state.questionNo,
          question_count: state.questionCount,
          term: q.term,
          ai_help_used: state.ai_help_used
        });
      }
    }catch(e){}

    renderHud();

    return true;
  }

  function useLaser(){
    if(!state.running || state.ended) return false;

    if(!state.laserReady){
      showExplain("🔴 Laser ยังไม่พร้อม ทำ Combo ให้ถึง x6 ก่อน");
      return false;
    }

    state.laserReady = false;
    state.laser_ready = false;
    state.laser_used += 1;

    const damage = 250;
    state.enemyHp = Math.max(0, state.enemyHp - damage);
    state.enemy_hp = state.enemyHp;

    patchExternalState({
      laserReady: false,
      laser_ready: false,
      laser_used: state.laser_used,
      enemyHp: state.enemyHp,
      enemy_hp: state.enemyHp
    });

    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.laserFx === "function"){
        WIN.VocabUI.laserFx();
      }
    }catch(e){}

    showExplain("🔴 <b>Laser Attack!</b><br>โจมตีบอส -" + damage);

    renderHud();

    if(state.enemyHp <= 0 && state.mode === "battle"){
      setTimeout(function(){
        finish({ reason:"boss_defeated" });
      }, 650);
    }

    return true;
  }

  /* =========================================================
     START / RESET
  ========================================================= */

  function newSessionId(){
    return "vocab_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  function readStudentFromOptions(options){
    options = options || {};

    let profile = {};

    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.loadStudentProfile === "function"){
        profile = WIN.VocabStorage.loadStudentProfile() || {};
      }
    }catch(e){}

    return {
      display_name: clean(pick(options.display_name, options.displayName, profile.display_name, profile.displayName, getParam("name"), getParam("nick"), "Hero")),
      student_id: clean(pick(options.student_id, options.studentId, profile.student_id, profile.studentId, getParam("student_id"), getParam("sid"), getParam("pid"), "anon")),
      section: clean(pick(options.section, profile.section, getParam("section"), "")),
      session_code: clean(pick(options.session_code, options.sessionCode, profile.session_code, profile.sessionCode, getParam("session_code"), getParam("studyId"), ""))
    };
  }

  function resetState(options){
    options = options || {};

    const mode = normalizeMode(pick(options.mode, getParam("mode"), "learn"));
    const diff = normalizeDifficulty(pick(options.difficulty, options.diff, getParam("diff"), "easy"));
    const bank = clean(pick(options.bank, getParam("bank"), "A")).toUpperCase();

    const modeRule = getModeRule(mode);
    const diffRule = getDiffRule(diff);
    const student = readStudentFromOptions(options);

    state.running = false;
    state.ended = false;
    state.locked = false;

    state.bank = bank;
    state.mode = mode;
    state.difficulty = diff;
    state.diff = diff;
    state.seed = pick(options.seed, getParam("seed"), Date.now());

    state.display_name = student.display_name;
    state.student_id = student.student_id;
    state.section = student.section;
    state.session_code = student.session_code;

    state.session_id = newSessionId();
    state.started_at_ms = Date.now();
    state.started_at = bangkokIsoNow();

    state.questions = [];
    state.questionList = [];
    state.currentQuestion = null;
    state.questionIndex = 0;
    state.index = 0;
    state.currentIndex = 0;
    state.questionNo = 0;
    state.questionCount = 0;

    state.score = 0;
    state.raw_score = 0;
    state.fair_score = 0;

    state.combo = 0;
    state.currentCombo = 0;
    state.comboMax = 0;
    state.combo_max = 0;

    state.maxHp = modeRule.baseHp;
    state.hp = modeRule.baseHp;
    state.lives = state.hp;

    state.enemyMaxHp = diffRule.enemyHp;
    state.enemy_max_hp = diffRule.enemyHp;
    state.enemyHp = diffRule.enemyHp;
    state.enemy_hp = diffRule.enemyHp;

    state.correctCount = 0;
    state.correct_count = 0;
    state.wrongCount = 0;
    state.wrong_count = 0;
    state.mistakes = 0;

    state.answeredCount = 0;
    state.answered_count = 0;

    state.hints = modeRule.hints;
    state.hintCount = modeRule.hints;
    state.hint_used = 0;
    state.hintUsed = 0;

    state.aiHelp = modeRule.aiHelp;
    state.aiHelpLeft = modeRule.aiHelp;
    state.ai_help_left = modeRule.aiHelp;
    state.ai_help_used = 0;
    state.aiHelpUsed = 0;

    state.shields = modeRule.shields;
    state.shield = modeRule.shields;
    state.shield_used = 0;

    state.laserReady = false;
    state.laser_ready = false;
    state.laser_used = 0;

    state.fever = false;
    state.isFever = false;

    state.weak_terms = [];
    state.weakTerms = [];
    state.weakest_term = "";
    state.weakestTerm = "";

    state.timeLeft = 0;
    state.timer = 0;

    state.enemyName = modeRule.enemy;
    state.enemy_name = modeRule.enemy;
    state.enemyAvatar = modeRule.avatar;
    state.enemy_avatar = modeRule.avatar;
    state.enemySkill = modeRule.skill;
    state.enemy_skill = modeRule.skill;

    state.stageId = "";
    state.stage_id = "";
    state.stageName = "";
    state.stage_name = "";
    state.stageGoal = "";
    state.stage_goal = "";

    answerLock = false;
    lastAnswerAt = 0;

    stopTimer();

    patchExternalState(cloneState());

    renderHud();
  }

  function start(options){
    options = options || {};

    resetState(options);

    const questions = getQuestions({
      bank: state.bank,
      difficulty: state.difficulty,
      diff: state.difficulty,
      mode: state.mode,
      seed: state.seed
    });

    if(!questions.length){
      state.running = false;
      state.ended = true;

      showBattleScreen();

      showExplain("ยังไม่พบคลังคำถามสำหรับ Bank " + state.bank);
      warn("start failed: no questions", options);

      return false;
    }

    state.questions = questions;
    state.questionList = questions;
    state.questionCount = questions.length;

    state.running = true;
    state.ended = false;
    state.locked = false;

    patchExternalState({
      running: true,
      ended: false,
      questions: questions,
      questionList: questions,
      questionCount: questions.length,
      question_count: questions.length
    });

    showBattleScreen();

    logSessionStart({
      session_id: state.session_id,
      sessionId: state.session_id,

      display_name: state.display_name,
      displayName: state.display_name,
      student_id: state.student_id,
      studentId: state.student_id,
      section: state.section,
      session_code: state.session_code,
      sessionCode: state.session_code,

      bank: state.bank,
      mode: state.mode,
      difficulty: state.difficulty,
      diff: state.difficulty,
      seed: state.seed,

      question_count: questions.length,
      questionCount: questions.length,

      started_at: state.started_at,
      startedAt: state.started_at
    });

    setCurrentQuestion(0);

    log("start", {
      bank: state.bank,
      mode: state.mode,
      difficulty: state.difficulty,
      questions: questions.length
    });

    return true;
  }

  function init(){
    patchExternalState({
      gameVersion: VERSION
    });

    return true;
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

  const api = {
    version: VERSION,

    state: state,
    getState: cloneState,
    patchState: patchExternalState,

    init: init,
    boot: init,

    start: start,
    startGame: start,

    answer: answer,
    choose: answer,
    submitAnswer: answer,
    selectAnswer: answer,
    handleAnswer: answer,
    answerQuestion: answer,
    onAnswer: answer,
    checkAnswer: answer,

    nextQuestion: nextQuestion,
    next: nextQuestion,
    advance: nextQuestion,
    renderNext: nextQuestion,
    showNextQuestion: nextQuestion,
    continueGame: nextQuestion,

    finish: finish,
    end: finish,

    useHint: useHint,
    useAiHelp: useAiHelp,
    useLaser: useLaser,

    stopTimer: stopTimer,
    startQuestionTimer: startQuestionTimer,

    buildSummary: buildSummary,
    accuracy: accuracy,

    currentQuestion: null,
    questions: []
  };

  Object.defineProperty(api, "currentQuestion", {
    get: function(){
      return state.currentQuestion;
    }
  });

  Object.defineProperty(api, "questions", {
    get: function(){
      return state.questions;
    }
  });

  Object.defineProperty(api, "index", {
    get: function(){
      return state.index;
    },
    set: function(v){
      state.index = int(v, 0);
      state.questionIndex = state.index;
    }
  });

  Object.defineProperty(api, "currentIndex", {
    get: function(){
      return state.currentIndex;
    },
    set: function(v){
      state.currentIndex = int(v, 0);
      state.index = state.currentIndex;
      state.questionIndex = state.currentIndex;
    }
  });

  WIN.VocabGame = api;
  WIN.vocabGame = api;
  WIN.VOCAB_GAME = api;

  WIN.VocabModules = WIN.VocabModules || {};
  WIN.VocabModules.game = true;

  WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
  WIN.__VOCAB_MODULES__.game = true;

  if(DOC.readyState === "loading"){
    DOC.addEventListener("DOMContentLoaded", init, { once:true });
  }else{
    init();
  }

  log("loaded", VERSION);
})();
