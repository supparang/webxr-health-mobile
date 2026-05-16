/* =========================================================
   /vocab/vocab.game.js
   TechPath Vocab Arena — Game Engine
   FULL CLEAN PATCH: v20260504a

   Critical fix:
   - VocabGame is the ONLY answer owner
   - answers checked from currentQuestion.correct
   - visible correct button gets data-vocab-correct="1"
   - no duplicate answer logs
   - no UI capture
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;
  const VERSION = "vocab-game-v20260504a";

  const MODE_RULES = {
    learn: {
      label: "AI Training",
      enemy: "Coach Bot",
      avatar: "🤖",
      skill: "สอนคำศัพท์พร้อมคำอธิบาย",
      hp: 5,
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
      hp: 4,
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
      hp: 5,
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
      hp: 4,
      hints: 1,
      aiHelp: 1,
      shields: 1,
      autoSkip: true
    }
  };

  const DIFF_RULES = {
    easy: { score:100, enemyHp:600, damage:100 },
    normal: { score:120, enemyHp:800, damage:110 },
    hard: { score:140, enemyHp:1000, damage:125 },
    challenge: { score:160, enemyHp:1200, damage:140 }
  };

  const TIME_RULES = {
    learn: { easy:60, normal:50, hard:45, challenge:40, autoSkip:false },
    mission: { easy:55, normal:50, hard:45, challenge:40, autoSkip:false },
    speed: { easy:35, normal:30, hard:25, challenge:22, autoSkip:true },
    battle: { easy:40, normal:35, hard:30, challenge:25, autoSkip:true }
  };

  const state = {
    running:false,
    ended:false,
    locked:false,

    bank:"A",
    mode:"learn",
    difficulty:"easy",
    diff:"easy",
    seed:"",

    display_name:"Hero",
    student_id:"anon",
    section:"",
    session_code:"",

    session_id:"",
    started_at_ms:0,
    started_at:"",

    questions:[],
    questionList:[],
    currentQuestion:null,
    questionIndex:0,
    index:0,
    currentIndex:0,
    questionNo:0,
    questionCount:0,

    score:0,
    raw_score:0,
    fair_score:0,

    combo:0,
    currentCombo:0,
    comboMax:0,
    combo_max:0,

    hp:5,
    lives:5,
    maxHp:5,

    enemyHp:600,
    enemy_hp:600,
    enemyMaxHp:600,
    enemy_max_hp:600,

    correctCount:0,
    correct_count:0,
    wrongCount:0,
    wrong_count:0,
    mistakes:0,
    answeredCount:0,
    answered_count:0,

    hints:2,
    hintCount:2,
    hint_used:0,
    hintUsed:0,

    aiHelpLeft:3,
    ai_help_left:3,
    ai_help_used:0,
    aiHelpUsed:0,

    shields:1,
    shield:1,

    fever:false,
    isFever:false,
    laserReady:false,
    laser_ready:false,

    weak_terms:[],
    weakTerms:[],
    weakest_term:"",
    weakestTerm:"",

    timeLeft:0,
    timer:0,
    questionTimeSec:0,
    autoSkipQuestion:false,

    stageName:"Question 1",
    stage_name:"Question 1",
    stageGoal:"ตอบให้ถูกและจำความหมาย",
    stage_goal:"ตอบให้ถูกและจำความหมาย",

    enemyName:"Coach Bot",
    enemy_name:"Coach Bot",
    enemyAvatar:"🤖",
    enemy_avatar:"🤖",
    enemySkill:"สอนคำศัพท์พร้อมคำอธิบาย",
    enemy_skill:"สอนคำศัพท์พร้อมคำอธิบาย"
  };

  let timerId = null;
  let answerLock = false;
  let lastAnswerAt = 0;

  function clean(s){
    return String(s ?? "").trim();
  }

  function norm(s){
    return clean(s).toLowerCase().replace(/\s+/g, " ");
  }

  function pick(){
    for(let i = 0; i < arguments.length; i++){
      const v = arguments[i];
      if(v !== undefined && v !== null && v !== "") return v;
    }
    return "";
  }

  function num(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function bangkokIsoNow(){
    const bangkokMs = Date.now() + (7 * 60 * 60 * 1000);
    return new Date(bangkokMs).toISOString().replace("Z", "+07:00");
  }

  function normalizeMode(mode){
    mode = norm(mode || "learn");

    if(mode === "ai" || mode === "training" || mode === "ai_training") return "learn";
    if(mode === "debug" || mode === "debug_mission") return "mission";
    if(mode === "boss" || mode === "boss_battle") return "battle";

    return ["learn","speed","mission","battle"].includes(mode) ? mode : "learn";
  }

  function normalizeDifficulty(diff){
    diff = norm(diff || "easy");
    return ["easy","normal","hard","challenge"].includes(diff) ? diff : "easy";
  }

  function getModeRule(){
    return MODE_RULES[state.mode] || MODE_RULES.learn;
  }

  function getDiffRule(){
    return DIFF_RULES[state.difficulty] || DIFF_RULES.easy;
  }

  function getTimeRule(){
    const group = TIME_RULES[state.mode] || TIME_RULES.learn;

    return {
      seconds:Number(group[state.difficulty] || group.easy || 60),
      autoSkip:!!group.autoSkip
    };
  }

  function cloneState(){
    return Object.assign({}, state, {
      questions:state.questions,
      questionList:state.questionList,
      currentQuestion:state.currentQuestion
    });
  }

  function patchExternal(update){
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

  function updateHud(){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.updateHud === "function"){
        WIN.VocabUI.updateHud(cloneState());
      }
    }catch(e){}
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

  function pop(text, type){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.pop === "function"){
        WIN.VocabUI.pop(text, type);
      }
    }catch(e){}
  }

  function scoreBurst(points, combo){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.scoreBurst === "function"){
        WIN.VocabUI.scoreBurst(points, combo);
      }
    }catch(e){}
  }

  function beep(type){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.beep === "function"){
        WIN.VocabUI.beep(type);
      }
    }catch(e){}
  }

  function showBattle(){
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
    }catch(e){}

    alert("Score: " + summary.score + "\nAccuracy: " + summary.accuracy + "%");
  }

  function logEvent(action, payload){
    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.logEvent === "function"){
        WIN.VocabLogger.logEvent(action, payload);
        return;
      }

      if(typeof WIN.logVocabEventV6 === "function"){
        WIN.logVocabEventV6(action, payload);
      }
    }catch(e){}
  }

  function logSessionStart(payload){
    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.sessionStart === "function"){
        WIN.VocabLogger.sessionStart(payload);
        return;
      }
    }catch(e){}
    logEvent("session_start", payload);
  }

  function logAnswer(payload){
    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.answer === "function"){
        WIN.VocabLogger.answer(payload);
        return;
      }
    }catch(e){}
    logEvent("answer", payload);
  }

  function logSessionEnd(payload){
    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.sessionEnd === "function"){
        WIN.VocabLogger.sessionEnd(payload);
        return;
      }
    }catch(e){}
    logEvent("session_end", payload);
  }

  /* =========================================================
     QUESTION
  ========================================================= */

  function normalizeChoice(c){
    if(c && typeof c === "object"){
      return {
        text:clean(pick(c.text, c.label, c.value, c.answer, "")),
        value:clean(pick(c.value, c.text, c.label, c.answer, "")),
        correct:c.correct === true || c.isCorrect === true || c.is_correct === true
      };
    }

    return {
      text:clean(c),
      value:clean(c),
      correct:false
    };
  }

  function normalizeQuestion(q){
    q = q || {};

    const choices = Array.isArray(q.choices || q.options)
      ? (q.choices || q.options).map(normalizeChoice)
      : [];

    let correct = clean(pick(q.correct, q.correct_answer, q.correctAnswer, q.answer, ""));

    if(!correct){
      const flagged = choices.find(c => c.correct);
      if(flagged) correct = flagged.value;
    }

    return Object.assign({}, q, {
      term:clean(pick(q.term, q.word, q.vocab, "")),
      prompt:clean(pick(q.prompt, q.question, q.question_text, q.questionText, "Question text")),
      choices,
      options:choices,
      correct,
      correct_answer:correct,
      correctAnswer:correct,
      hint:clean(pick(q.hint, q.tip, "")),
      explain:clean(pick(q.explain, q.explanation, q.feedback, ""))
    });
  }

  function getQuestions(options){
    const engine = WIN.VocabQuestion || WIN.VocabQuestions || WIN.VocabQuestionEngine;

    if(engine && typeof engine.getQuestions === "function"){
      const qs = engine.getQuestions({
        bank:options.bank,
        difficulty:options.difficulty,
        diff:options.difficulty,
        mode:options.mode,
        seed:options.seed
      });

      if(Array.isArray(qs) && qs.length){
        return qs.map(normalizeQuestion);
      }
    }

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

    state.stageName = "Question " + state.questionNo;
    state.stage_name = state.stageName;
    state.stageGoal = "ตอบให้ถูกและจำความหมาย";
    state.stage_goal = state.stageGoal;

    patchExternal({
      currentQuestion:state.currentQuestion,
      question:state.currentQuestion,
      activeQuestion:state.currentQuestion,
      questionIndex:state.questionIndex,
      index:state.index,
      currentIndex:state.currentIndex,
      questionNo:state.questionNo,
      question_count:state.questionCount,
      questionCount:state.questionCount,
      stageName:state.stageName,
      stage_name:state.stage_name,
      stageGoal:state.stageGoal,
      stage_goal:state.stage_goal
    });

    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.renderQuestion === "function"){
        WIN.VocabUI.renderQuestion(state.currentQuestion, cloneState());
      }
    }catch(e){}

    bindChoiceButtons();
    startTimer();
  }

  function getButtonValue(btn){
    return clean(
      pick(
        btn && btn.dataset ? btn.dataset.vocabChoice : "",
        btn && btn.dataset ? btn.dataset.choice : "",
        btn ? btn.textContent : ""
      )
    );
  }

  function bindChoiceButtons(){
    const q = normalizeQuestion(state.currentQuestion);
    const correct = q.correct;

    const buttons = Array.from(DOC.querySelectorAll("[data-vocab-choice]"));

    buttons.forEach(function(btn){
      const value = getButtonValue(btn);
      const isCorrect = correct && norm(value) === norm(correct);

      btn.dataset.vocabCorrect = isCorrect ? "1" : "0";
      btn.disabled = false;
      btn.classList.remove("correct", "wrong", "locked");

      /*
        ตัวนี้เป็น owner เดียวของการตอบ
      */
      btn.onclick = function(ev){
        ev.preventDefault();
        ev.stopPropagation();

        if(typeof ev.stopImmediatePropagation === "function"){
          ev.stopImmediatePropagation();
        }

        answer(value, btn);
        return false;
      };
    });

    console.log("[VOCAB ANSWER OWNER] synced", {
      term:q.term,
      correct:q.correct,
      buttons:buttons.map(btn => ({
        text:btn.textContent.trim(),
        value:getButtonValue(btn),
        correct:btn.dataset.vocabCorrect
      }))
    });
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

  function startTimer(){
    stopTimer();

    const rule = getTimeRule();

    state.questionTimeSec = rule.seconds;
    state.timeLeft = rule.seconds;
    state.timer = rule.seconds;
    state.autoSkipQuestion = rule.autoSkip;

    patchExternal({
      questionTimeSec:state.questionTimeSec,
      perQuestionTime:state.questionTimeSec,
      timeLeft:state.timeLeft,
      timer:state.timer,
      autoSkipQuestion:state.autoSkipQuestion
    });

    updateHud();

    timerId = setInterval(function(){
      if(!state.running || state.ended || state.locked) return;

      state.timeLeft -= 1;
      state.timer = state.timeLeft;

      patchExternal({
        timeLeft:state.timeLeft,
        timer:state.timer
      });

      updateHud();

      if(state.timeLeft <= 0){
        stopTimer();

        if(state.autoSkipQuestion){
          timeoutQuestion();
        }else{
          showExplain("⏳ <b>ใช้เวลานานแล้ว</b><br>ข้อนี้จะยังไม่เปลี่ยนเอง ลองเลือกคำตอบที่คิดว่าใกล้เคียงที่สุด");
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
    state.hp = Math.max(0, state.hp - 1);
    state.lives = state.hp;

    const q = normalizeQuestion(state.currentQuestion);
    pushWeakTerm(q);

    patchExternal(scorePatch());

    pop("⏰ Time!", "bad");
    beep("bad");

    showExplain(
      "⏰ <b>หมดเวลา</b><br>" +
      "คำตอบที่ถูกคือ: <b>" + esc(q.correct) + "</b>"
    );

    logAnswer(buildAnswerPayload({
      selected:"",
      isCorrect:false,
      timeout:true,
      q
    }));

    updateHud();

    setTimeout(function(){
      state.locked = false;
      nextQuestion({ force:true });
    }, 900);
  }

  /* =========================================================
     ANSWER
  ========================================================= */

  function answer(selectedValue, btn){
    if(!state.running || state.ended) return false;

    const now = Date.now();
    if(now - lastAnswerAt < 350) return false;
    lastAnswerAt = now;

    if(answerLock || state.locked) return false;

    answerLock = true;
    state.locked = true;
    stopTimer();

    const q = normalizeQuestion(state.currentQuestion);
    const selected = clean(pick(selectedValue, btn ? getButtonValue(btn) : ""));
    const correct = clean(q.correct);
    const isCorrect = !!correct && norm(selected) === norm(correct);

    console.log("[VOCAB ANSWER CHECK]", {
      term:q.term,
      selected,
      correct,
      isCorrect
    });

    state.answeredCount += 1;
    state.answered_count = state.answeredCount;

    let points = 0;

    if(isCorrect){
      state.correctCount += 1;
      state.correct_count = state.correctCount;

      points = computePoints();
      state.score += points;
      state.raw_score = state.score;

      state.combo += 1;
      state.currentCombo = state.combo;
      state.comboMax = Math.max(state.comboMax, state.combo);
      state.combo_max = state.comboMax;

      const damage = computeDamage();
      state.enemyHp = Math.max(0, state.enemyHp - damage);
      state.enemy_hp = state.enemyHp;

      state.fever = state.combo >= 4;
      state.isFever = state.fever;
      state.laserReady = state.combo >= 6;
      state.laser_ready = state.laserReady;

      markChoices(selected, correct, true);
      pop("✅ Correct!", "good");
      scoreBurst(points, state.combo);
      beep("good");

      showExplain(
        q.explain
          ? "✅ <b>ถูกต้อง!</b><br>" + esc(q.explain)
          : "✅ <b>ถูกต้อง!</b><br>คำตอบคือ <b>" + esc(correct) + "</b>"
      );
    }else{
      state.wrongCount += 1;
      state.wrong_count = state.wrongCount;
      state.mistakes += 1;

      state.combo = 0;
      state.currentCombo = 0;

      state.hp = Math.max(0, state.hp - 1);
      state.lives = state.hp;

      state.fever = false;
      state.isFever = false;
      state.laserReady = false;
      state.laser_ready = false;

      pushWeakTerm(q);

      markChoices(selected, correct, false);
      pop("❌ Try again", "bad");
      beep("bad");

      showExplain(
        "❌ <b>ยังไม่ถูก</b><br>" +
        "คำตอบที่ถูกคือ: <b>" + esc(correct) + "</b><br>" +
        (q.explain ? esc(q.explain) : "")
      );
    }

    patchExternal(scorePatch());
    updateHud();

    logAnswer(buildAnswerPayload({
      selected,
      isCorrect,
      timeout:false,
      q
    }));

    setTimeout(function(){
      answerLock = false;
      state.locked = false;

      if(state.hp <= 0){
        finish({ reason:"hp_zero" });
        return;
      }

      if(state.mode === "battle" && state.enemyHp <= 0){
        finish({ reason:"boss_defeated" });
        return;
      }

      nextQuestion({ force:true });
    }, 950);

    return true;
  }

  function computePoints(){
    const diff = getDiffRule();
    const comboBonus = Math.max(0, state.combo) * 10;
    const speedBonus = Math.max(0, Math.min(40, state.timeLeft || 0));
    return diff.score + comboBonus + speedBonus;
  }

  function computeDamage(){
    const diff = getDiffRule();
    return diff.damage + Math.max(0, state.combo) * 8 + (state.fever ? 35 : 0);
  }

  function markChoices(selected, correct, isCorrect){
    Array.from(DOC.querySelectorAll("[data-vocab-choice]")).forEach(function(btn){
      const value = getButtonValue(btn);

      btn.disabled = true;
      btn.classList.add("locked");

      if(norm(value) === norm(correct)){
        btn.classList.add("correct");
      }

      if(norm(value) === norm(selected) && !isCorrect){
        btn.classList.add("wrong");
      }
    });
  }

  function scorePatch(){
    return {
      score:state.score,
      raw_score:state.raw_score,

      combo:state.combo,
      currentCombo:state.currentCombo,
      comboMax:state.comboMax,
      combo_max:state.combo_max,

      hp:state.hp,
      lives:state.lives,

      enemyHp:state.enemyHp,
      enemy_hp:state.enemy_hp,
      enemyMaxHp:state.enemyMaxHp,
      enemy_max_hp:state.enemy_max_hp,

      correctCount:state.correctCount,
      correct_count:state.correct_count,
      wrongCount:state.wrongCount,
      wrong_count:state.wrong_count,
      mistakes:state.mistakes,

      answeredCount:state.answeredCount,
      answered_count:state.answered_count,

      fever:state.fever,
      isFever:state.isFever,
      laserReady:state.laserReady,
      laser_ready:state.laser_ready,

      accuracy:accuracy()
    };
  }

  function pushWeakTerm(q){
    q = normalizeQuestion(q);

    if(!q.term) return;

    const found = state.weak_terms.find(x => norm(x.term) === norm(q.term));

    if(found){
      found.count = Number(found.count || 1) + 1;
    }else{
      state.weak_terms.push({
        term:q.term,
        meaning:q.correct,
        count:1
      });
    }

    state.weakTerms = state.weak_terms;
    state.weakest_term = state.weak_terms[0] ? state.weak_terms[0].term : "";
    state.weakestTerm = state.weakest_term;
  }

  function buildAnswerPayload(data){
    const q = normalizeQuestion(data.q || state.currentQuestion);

    return {
      session_id:state.session_id,
      sessionId:state.session_id,

      bank:state.bank,
      mode:state.mode,
      difficulty:state.difficulty,
      diff:state.difficulty,

      display_name:state.display_name,
      displayName:state.display_name,
      student_id:state.student_id,
      studentId:state.student_id,
      section:state.section,
      session_code:state.session_code,
      sessionCode:state.session_code,

      term:q.term,
      prompt:q.prompt,
      question_text:q.prompt,
      questionText:q.prompt,

      answer:data.selected,
      selected_answer:data.selected,
      selectedAnswer:data.selected,

      correct_answer:q.correct,
      correctAnswer:q.correct,

      correct:data.isCorrect ? 1 : 0,
      is_correct:data.isCorrect ? 1 : 0,
      isCorrect:data.isCorrect ? 1 : 0,

      timeout:data.timeout ? 1 : 0,

      score:state.score,
      raw_score:state.raw_score,
      combo:state.combo,
      combo_max:state.comboMax,
      comboMax:state.comboMax,
      hp:state.hp,

      question_no:state.questionNo,
      questionNo:state.questionNo,
      question_count:state.questionCount,
      questionCount:state.questionCount,

      correct_count:state.correctCount,
      correctCount:state.correctCount,
      wrong_count:state.wrongCount,
      wrongCount:state.wrongCount,
      mistakes:state.mistakes,

      accuracy:accuracy(),

      ai_help_used:state.ai_help_used,
      aiHelpUsed:state.aiHelpUsed,
      ai_assisted:state.ai_help_used > 0 ? 1 : 0,
      aiAssisted:state.ai_help_used > 0 ? 1 : 0
    };
  }

  /* =========================================================
     NEXT / FINISH
  ========================================================= */

  function nextQuestion(options){
    options = options || {};

    if(!state.running || state.ended) return false;
    if(state.locked && !options.force) return false;

    const next = state.questionIndex + 1;

    if(next >= state.questions.length){
      finish({ reason:"completed" });
      return true;
    }

    setCurrentQuestion(next);
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

    const fairScore =
      state.ai_help_used > 0
        ? Math.round(state.score * 0.95)
        : state.score;

    return {
      api:"vocab",
      source:"vocab.html",
      schema:"vocab-split-v1",
      version:VERSION,

      action:"session_end",
      event_type:"session_end",
      eventType:"session_end",

      session_id:state.session_id,
      sessionId:state.session_id,

      client_ts:bangkokIsoNow(),
      clientTs:bangkokIsoNow(),

      display_name:state.display_name,
      displayName:state.display_name,
      student_id:state.student_id,
      studentId:state.student_id,
      section:state.section,
      session_code:state.session_code,
      sessionCode:state.session_code,

      bank:state.bank,
      mode:state.mode,
      difficulty:state.difficulty,
      diff:state.difficulty,

      score:state.score,
      raw_score:state.score,
      rawScore:state.score,

      fair_score:fairScore,
      fairScore:fairScore,

      accuracy:accuracy(),

      correct_count:state.correctCount,
      correctCount:state.correctCount,
      wrong_count:state.wrongCount,
      wrongCount:state.wrongCount,
      mistakes:state.mistakes,

      combo_max:state.comboMax,
      comboMax:state.comboMax,

      question_count:state.questionCount,
      questionCount:state.questionCount,
      answered_count:state.answeredCount,
      answeredCount:state.answeredCount,

      duration_sec:durationSec(),
      durationSec:durationSec(),
      active_time_sec:durationSec(),
      activeTimeSec:durationSec(),

      ai_help_used:state.ai_help_used,
      aiHelpUsed:state.aiHelpUsed,
      ai_assisted:state.ai_help_used > 0 ? 1 : 0,
      aiAssisted:state.ai_help_used > 0 ? 1 : 0,

      hint_used:state.hint_used,
      hintUsed:state.hintUsed,

      weak_terms:state.weak_terms,
      weakTerms:state.weakTerms,
      weakest_term:state.weakest_term,
      weakestTerm:state.weakestTerm,

      completed:extra.reason === "completed" ? 1 : 0,
      boss_defeated:state.enemyHp <= 0 ? 1 : 0,
      bossDefeated:state.enemyHp <= 0 ? 1 : 0,

      end_reason:extra.reason || "completed",
      endReason:extra.reason || "completed"
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

    patchExternal({
      running:false,
      ended:true,
      fair_score:summary.fair_score,
      fairScore:summary.fair_score,
      accuracy:summary.accuracy,
      completed:summary.completed
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

    return summary;
  }

  /* =========================================================
     POWER
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

    patchExternal({
      hints:state.hints,
      hintCount:state.hintCount,
      hint_used:state.hint_used,
      hintUsed:state.hintUsed
    });

    showExplain("💡 <b>Hint:</b> " + esc(q.hint || "ลองดู keyword ในโจทย์ แล้วตัดตัวเลือกที่ไม่เกี่ยวข้องออกก่อน"));
    updateHud();

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

    patchExternal({
      aiHelpLeft:state.aiHelpLeft,
      ai_help_left:state.ai_help_left,
      ai_help_used:state.ai_help_used,
      aiHelpUsed:state.aiHelpUsed,
      ai_assisted:1,
      aiAssisted:1
    });

    showAiHelp("มองหาความหมายที่ตรงกับคำว่า “" + q.term + "” มากที่สุด" + (q.correct ? " คำตอบเกี่ยวข้องกับ: " + q.correct : ""));
    updateHud();

    return true;
  }

  /* =========================================================
     START
  ========================================================= */

  function newSessionId(){
    return "vocab_" + Date.now() + "_" + Math.random().toString(36).slice(2,8);
  }

  function readStudent(options){
    options = options || {};
    let profile = {};

    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.loadStudentProfile === "function"){
        profile = WIN.VocabStorage.loadStudentProfile() || {};
      }
    }catch(e){}

    return {
      display_name:clean(pick(options.display_name, options.displayName, profile.display_name, profile.displayName, "Hero")),
      student_id:clean(pick(options.student_id, options.studentId, profile.student_id, profile.studentId, "anon")),
      section:clean(pick(options.section, profile.section, "")),
      session_code:clean(pick(options.session_code, options.sessionCode, profile.session_code, profile.sessionCode, ""))
    };
  }

  function reset(options){
    options = options || {};

    const mode = normalizeMode(pick(options.mode, "learn"));
    const diff = normalizeDifficulty(pick(options.difficulty, options.diff, "easy"));
    const bank = clean(pick(options.bank, "A")).toUpperCase();
    const modeRule = MODE_RULES[mode] || MODE_RULES.learn;
    const diffRule = DIFF_RULES[diff] || DIFF_RULES.easy;
    const student = readStudent(options);

    stopTimer();

    state.running = false;
    state.ended = false;
    state.locked = false;

    state.bank = bank;
    state.mode = mode;
    state.difficulty = diff;
    state.diff = diff;
    state.seed = pick(options.seed, Date.now());

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

    state.maxHp = modeRule.hp;
    state.hp = modeRule.hp;
    state.lives = modeRule.hp;

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

    state.aiHelpLeft = modeRule.aiHelp;
    state.ai_help_left = modeRule.aiHelp;
    state.ai_help_used = 0;
    state.aiHelpUsed = 0;

    state.shields = modeRule.shields;
    state.shield = modeRule.shields;

    state.fever = false;
    state.isFever = false;
    state.laserReady = false;
    state.laser_ready = false;

    state.weak_terms = [];
    state.weakTerms = [];
    state.weakest_term = "";
    state.weakestTerm = "";

    state.enemyName = modeRule.enemy;
    state.enemy_name = modeRule.enemy;
    state.enemyAvatar = modeRule.avatar;
    state.enemy_avatar = modeRule.avatar;
    state.enemySkill = modeRule.skill;
    state.enemy_skill = modeRule.skill;

    answerLock = false;
    lastAnswerAt = 0;

    patchExternal(cloneState());
    updateHud();
  }

  function start(options){
    options = options || {};

    reset(options);

    const questions = getQuestions({
      bank:state.bank,
      difficulty:state.difficulty,
      mode:state.mode,
      seed:state.seed
    });

    if(!questions.length){
      showBattle();
      showExplain("ยังไม่พบคลังคำถามสำหรับ Bank " + state.bank);
      return false;
    }

    state.questions = questions;
    state.questionList = questions;
    state.questionCount = questions.length;
    state.running = true;
    state.ended = false;
    state.locked = false;

    patchExternal({
      running:true,
      ended:false,
      questions,
      questionList:questions,
      questionCount:questions.length,
      question_count:questions.length
    });

    showBattle();

    logSessionStart({
      session_id:state.session_id,
      sessionId:state.session_id,
      display_name:state.display_name,
      displayName:state.display_name,
      student_id:state.student_id,
      studentId:state.student_id,
      section:state.section,
      session_code:state.session_code,
      sessionCode:state.session_code,
      bank:state.bank,
      mode:state.mode,
      difficulty:state.difficulty,
      diff:state.difficulty,
      seed:state.seed,
      question_count:questions.length,
      questionCount:questions.length,
      started_at:state.started_at,
      startedAt:state.started_at
    });

    setCurrentQuestion(0);

    console.log("[VOCAB GAME] start", {
      bank:state.bank,
      mode:state.mode,
      difficulty:state.difficulty,
      questions:questions.length
    });

    return true;
  }

  function init(){
    patchExternal({
      gameVersion:VERSION
    });
  }

  const api = {
    version:VERSION,
    state,
    getState:cloneState,
    patchState:patchExternal,

    init,
    boot:init,

    start,
    startGame:start,

    answer,
    choose:answer,
    submitAnswer:answer,
    selectAnswer:answer,
    handleAnswer:answer,

    bindChoiceButtons,

    nextQuestion,
    next:nextQuestion,

    finish,
    end:finish,

    useHint,
    useAiHelp,

    stopTimer,
    startTimer,

    buildSummary,
    accuracy
  };

  Object.defineProperty(api, "currentQuestion", {
    get:function(){ return state.currentQuestion; }
  });

  Object.defineProperty(api, "questions", {
    get:function(){ return state.questions; }
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

  console.log("[VOCAB GAME] loaded", VERSION);
})();
