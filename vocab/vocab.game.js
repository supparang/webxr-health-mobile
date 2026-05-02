/* =========================================================
   /vocab/vocab.game.js
   TechPath Vocab Arena
   Core Game Engine
   ========================================================= */

"use strict";

/* =========================================================
   GAME START
========================================================= */

function startVocabBattleV6(options = {}){
  forceClearGameTimersVocabUI?.();
  forceRemoveGameFxVocabUI?.();

  const bank = options.bank || getSelectedBankV6?.() || VOCAB_APP.selectedBank || "A";
  const difficulty = options.difficulty || getSelectedDifficultyV6?.() || VOCAB_APP.selectedDifficulty || "easy";
  const mode = options.mode || getSelectedModeV66?.() || VOCAB_APP.selectedMode || "learn";

  const config = VOCAB_DIFFICULTY[difficulty] || VOCAB_DIFFICULTY.easy;
  const modeConfig = getModeConfigV66(mode);
  const enemyBase = VOCAB_ENEMIES[bank] || VOCAB_ENEMIES.A;
  const terms = buildTermDeckV71(bank, difficulty);

  if(!Array.isArray(terms) || terms.length < 4){
    alert("ยังไม่มีคำศัพท์เพียงพอสำหรับ Bank นี้");
    return;
  }

  if(typeof saveStudentContextV63 === "function"){
    saveStudentContextV63();
  }

  VOCAB_APP.selectedBank = bank;
  VOCAB_APP.selectedDifficulty = difficulty;
  VOCAB_APP.selectedMode = mode;

  vocabGame.sessionId = `vocab_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  vocabGame.active = true;

  vocabGame.bank = bank;
  vocabGame.difficulty = difficulty;
  vocabGame.mode = mode;
  vocabGame.modeConfig = modeConfig;

  vocabGame.terms = shuffleV61(terms);
  vocabGame.sessionTermUse = {};

  vocabGame.stagePlan = buildStagePlanV66(
    config.totalQuestions + safeNumber(modeConfig.totalQuestionBonus, 0),
    modeConfig.stageOrder
  );

  vocabGame.stageIndex = 0;
  vocabGame.questionIndexInStage = 0;
  vocabGame.globalQuestionIndex = 0;

  vocabGame.currentStage = null;
  vocabGame.currentQuestion = null;
  vocabGame.questionStartedAt = 0;

  vocabGame.score = 0;
  vocabGame.combo = 0;
  vocabGame.comboMax = 0;
  vocabGame.correct = 0;
  vocabGame.wrong = 0;
  vocabGame.playerHp = config.playerHp;

  vocabGame.enemy = { ...enemyBase };
  vocabGame.enemyHpMax = Math.round(enemyBase.hp * config.bossMultiplier);
  vocabGame.enemyHp = vocabGame.enemyHpMax;

  vocabGame.mistakes = [];
  vocabGame.stageStats = {};

  VOCAB_STAGES.forEach(stage => {
    vocabGame.stageStats[stage.id] = {
      correct: 0,
      wrong: 0,
      responseMsTotal: 0,
      count: 0
    };
  });

  resetPowerStateV62();

  vocabGame.startedAt = Date.now();
  vocabGame.endedAt = 0;

  showBattleScreenV6();
  updateHudV6();
  updatePowerHudV62();

  logVocabEventV6("session_start", {
    started_at: new Date(vocabGame.startedAt).toISOString(),
    total_questions: getTotalPlannedQuestionsV6(),
    enemy_name: vocabGame.enemy.name,
    enemy_hp_max: vocabGame.enemyHpMax,
    player_hp_start: vocabGame.playerHp,
    mode,
    mode_label: modeConfig.label
  });

  playSfxV6("start");
  showFloatingTextV6("READY!", "stage");

  nextQuestionV6();
}

/* =========================================================
   STAGE PLAN
========================================================= */

function buildStagePlanV66(totalQuestions, stageOrder){
  const order = Array.isArray(stageOrder) && stageOrder.length
    ? stageOrder
    : VOCAB_STAGES.map(s => s.id);

  const stages = order
    .map(id => VOCAB_STAGES.find(s => s.id === id))
    .filter(Boolean);

  if(!stages.length){
    return [{
      id:"warmup",
      name:"Warm-up Round",
      icon:"✨",
      goal:"เก็บความมั่นใจ ตอบให้ถูก",
      count: totalQuestions || 8
    }];
  }

  let remaining = Math.max(1, safeNumber(totalQuestions, 8));
  const each = Math.floor(remaining / stages.length);

  return stages.map((stage, index) => {
    let count = each;

    if(index < remaining % stages.length){
      count += 1;
    }

    if(index === stages.length - 1){
      count = remaining;
    }

    remaining -= count;

    return {
      ...stage,
      count
    };
  }).filter(stage => stage.count > 0);
}

function getTotalPlannedQuestionsV6(){
  if(!Array.isArray(vocabGame.stagePlan)) return 0;
  return vocabGame.stagePlan.reduce((sum, s) => sum + safeNumber(s.count, 0), 0);
}

/* =========================================================
   NEXT QUESTION
========================================================= */

function nextQuestionV6(){
  clearTimerV6();

  if(!vocabGame.active) return;

  const stage = vocabGame.stagePlan[vocabGame.stageIndex];

  if(!stage){
    endVocabBattleV6("completed");
    return;
  }

  vocabGame.currentStage = stage;

  if(vocabGame.questionIndexInStage >= stage.count){
    vocabGame.stageIndex += 1;
    vocabGame.questionIndexInStage = 0;

    const nextStage = vocabGame.stagePlan[vocabGame.stageIndex];

    if(!nextStage){
      endVocabBattleV6("completed");
      return;
    }

    showStageIntroV6(nextStage);

    setTimeout(() => {
      if(vocabGame.active){
        nextQuestionV6();
      }
    }, 780);

    return;
  }

  const question = buildQuestionV6(stage);

  vocabGame.currentQuestion = question;
  vocabGame.questionStartedAt = Date.now();

  vocabGame.questionIndexInStage += 1;
  vocabGame.globalQuestionIndex += 1;

  renderQuestionV6(question, stage);
  updateHudV6();
  startTimerV6();

  logVocabEventV6("question_show", {
    stage_id: stage.id,
    stage_name: stage.name,
    question_no: vocabGame.globalQuestionIndex,
    total_questions: getTotalPlannedQuestionsV6(),
    term: question.correctTerm.term,
    mode: question.mode,
    answer_mode: question.answerMode
  });
}

/* =========================================================
   RENDER QUESTION
========================================================= */

function renderQuestionV6(question, stage){
  const panel = byId("v6BattlePanel");
  const stageChip = byId("v6StageChip");
  const stageGoal = byId("v6StageGoal");
  const enemyAvatar = byId("v6EnemyAvatar");
  const enemyName = byId("v6EnemyName");
  const enemySkill = byId("v6EnemySkill");
  const questionText = byId("v6QuestionText");
  const choicesBox = byId("v6Choices");
  const explainBox = byId("v6ExplainBox");

  if(!panel || !stageChip || !choicesBox || !questionText){
    console.warn("[VOCAB] battle UI not found");
    return;
  }

  showBattleScreenV6();

  if(explainBox){
    explainBox.hidden = true;
    explainBox.innerHTML = "";
  }

  vocabGame.currentAiHelpUsed = false;

  if(typeof clearAiHelpBoxV67 === "function"){
    clearAiHelpBoxV67();
  }

  stageChip.textContent = `${stage.icon || "✨"} ${stage.name || "Round"}`;

  if(stageGoal){
    stageGoal.textContent = `Goal: ${stage.goal || "ตอบให้ถูกและทำคะแนนให้สูง"}`;
  }

  if(enemyAvatar){
    enemyAvatar.textContent = vocabGame.enemy?.avatar || "👾";
  }

  if(enemyName){
    enemyName.textContent = `${vocabGame.enemy?.name || "Enemy"} • ${vocabGame.enemy?.title || "Vocabulary Boss"}`;
  }

  if(enemySkill){
    enemySkill.textContent = vocabGame.enemy?.skill || "Enemy skill active";
  }

  const hintText = question.answerMode === "meaning"
    ? "เลือกความหมายที่ถูกต้อง"
    : "เลือกคำศัพท์ที่เหมาะกับสถานการณ์";

  questionText.innerHTML = `
    <span class="v6-question-main">${escapeHtmlV6(question.prompt)}</span>
    <small class="v6-question-hint">${escapeHtmlV6(hintText)}</small>
  `;

  choicesBox.innerHTML = "";

  question.choices.forEach((choice, index) => {
    const btn = document.createElement("button");
    btn.className = "v6-choice";
    btn.type = "button";
    btn.dataset.choiceIndex = String(index);
    btn.innerHTML = `
      <span style="opacity:.72;margin-right:8px;">${String.fromCharCode(65 + index)}.</span>
      <span>${escapeHtmlV6(choice.text)}</span>
    `;

    btn.addEventListener("click", () => {
      answerQuestionV6(choice, btn);
    });

    choicesBox.appendChild(btn);
  });

  updateHudV6();
}

/* =========================================================
   ANSWER
========================================================= */

function answerQuestionV6(choice, buttonEl){
  if(!vocabGame.active || !vocabGame.currentQuestion || !vocabGame.currentStage) return;

  const question = vocabGame.currentQuestion;
  const stage = vocabGame.currentStage;
  const responseMs = Date.now() - vocabGame.questionStartedAt;
  const isCorrect = !!choice.correct;

  clearTimerV6();
  lockChoicesV6();

  const stat = vocabGame.stageStats[stage.id] || {
    correct: 0,
    wrong: 0,
    responseMsTotal: 0,
    count: 0
  };

  vocabGame.stageStats[stage.id] = stat;
  stat.count += 1;
  stat.responseMsTotal += responseMs;

  if(isCorrect){
    handleCorrectAnswerV6({
      choice,
      buttonEl,
      question,
      stage,
      stat,
      responseMs
    });
  }else{
    handleWrongAnswerV6({
      choice,
      buttonEl,
      question,
      stage,
      stat,
      responseMs,
      selectedText: choice.text
    });
  }

  updateHudV6();
  showAnswerExplainV61(isCorrect, question);

  logAnswerEventV6({
    question,
    stage,
    choice,
    isCorrect,
    responseMs,
    selectedText: choice.text
  });

  if(vocabGame.playerHp <= 0){
    setTimeout(() => {
      if(vocabGame.active){
        endVocabBattleV6("player_defeated");
      }
    }, 800);
    return;
  }

  if(vocabGame.enemyHp <= 0){
    setTimeout(() => {
      if(vocabGame.active){
        endVocabBattleV6("boss_defeated");
      }
    }, 800);
    return;
  }

  setTimeout(() => {
    if(vocabGame.active){
      nextQuestionV6();
    }
  }, isCorrect ? 700 : 1150);
}

function handleCorrectAnswerV6(ctx){
  const { buttonEl, question, stage, stat, responseMs } = ctx;

  vocabGame.correct += 1;
  vocabGame.combo += 1;
  vocabGame.comboMax = Math.max(vocabGame.comboMax || 0, vocabGame.combo || 0);
  stat.correct += 1;

  let damage = calculateDamageV6({
    responseMs,
    combo: vocabGame.combo,
    stageId: stage.id,
    difficulty: vocabGame.difficulty
  });

  if(vocabGame.fever){
    damage = Math.round(damage * VOCAB_POWER.feverDamageMultiplier);
  }

  const laserDamage = maybeUseLaserV62();
  damage += laserDamage;

  vocabGame.enemyHp = Math.max(0, vocabGame.enemyHp - damage);

  const gainedScore = calculateScoreGainV6({
    damage,
    responseMs,
    combo: vocabGame.combo,
    stageId: stage.id,
    aiHelpUsed: vocabGame.currentAiHelpUsed
  });

  vocabGame.score += gainedScore;

  if(buttonEl){
    buttonEl.classList.add("correct");
  }

  playSfxV6("correct");

  if(typeof addEnemyHitFxV62 === "function"){
    addEnemyHitFxV62();
  }

  showFloatingTextV6(`+${damage} HIT!`, "good");

  rewardPowerByComboV62();
  checkFeverV62();

  if(typeof updateMasteryFromAnswer === "function"){
    updateMasteryFromAnswer({
      term: question.correctTerm.term,
      meaning: question.correctTerm.meaning,
      bank: vocabGame.bank,
      is_correct: 1,
      response_ms: responseMs,
      stage_id: stage.id,
      mode: vocabGame.mode,
      ai_help_used_on_question: vocabGame.currentAiHelpUsed ? 1 : 0
    });
  }
}

function handleWrongAnswerV6(ctx){
  const { choice, buttonEl, question, stage, stat, responseMs, selectedText } = ctx;

  vocabGame.wrong += 1;
  vocabGame.combo = 0;
  stat.wrong += 1;

  if(vocabGame.fever){
    stopFeverV62();
  }

  const baseAttack = calculateEnemyAttackV6({
    stageId: stage.id,
    difficulty: vocabGame.difficulty,
    bank: vocabGame.bank
  });

  const attack = applyEnemyAttackWithShieldV62(baseAttack);
  vocabGame.playerHp = Math.max(0, vocabGame.playerHp - attack);

  vocabGame.mistakes.push({
    term: question.correctTerm.term,
    meaning: question.correctTerm.meaning,
    selected: selectedText,
    stageId: stage.id,
    responseMs
  });

  if(buttonEl){
    buttonEl.classList.add("wrong");
  }

  revealCorrectChoiceV6();

  if(attack > 0 && typeof addBossAttackFxV62 === "function"){
    addBossAttackFxV62();
    showFloatingTextV6(`-${attack} HP`, "bad");
  }else{
    showFloatingTextV6("🛡️ BLOCKED!", "stage");
  }

  playSfxV6("wrong");

  if(typeof updateMasteryFromAnswer === "function"){
    updateMasteryFromAnswer({
      term: question.correctTerm.term,
      meaning: question.correctTerm.meaning,
      bank: vocabGame.bank,
      is_correct: 0,
      response_ms: responseMs,
      stage_id: stage.id,
      mode: vocabGame.mode,
      ai_help_used_on_question: vocabGame.currentAiHelpUsed ? 1 : 0
    });
  }
}

/* =========================================================
   TIMEOUT
========================================================= */

function startTimerV6(){
  clearTimerV6();

  const config = VOCAB_DIFFICULTY[vocabGame.difficulty] || VOCAB_DIFFICULTY.normal;
  const modeConfig = vocabGame.modeConfig || VOCAB_PLAY_MODES.learn;
  const feel = typeof getDifficultyFeelV71 === "function"
    ? getDifficultyFeelV71(vocabGame.difficulty)
    : { timeAdd:0 };

  let time = config.timePerQuestion;
  time += safeNumber(modeConfig.timeBonus, 0);
  time += safeNumber(feel.timeAdd, 0);

  if(vocabGame.currentStage?.id === "speed"){
    time = Math.max(4, time - 4);
  }

  if(vocabGame.currentStage?.id === "boss"){
    time = Math.max(5, time - 3);
  }

  if(vocabGame.difficulty === "challenge" && vocabGame.currentStage?.id === "trap"){
    time = Math.max(4, time - 2);
  }

  vocabGame.timeLeft = Math.max(4, time);

  renderTimerV6();

  vocabGame.timerId = setInterval(() => {
    if(!vocabGame.active){
      clearTimerV6();
      return;
    }

    vocabGame.timeLeft -= 1;
    renderTimerV6();

    if(vocabGame.timeLeft <= 3 && vocabGame.timeLeft > 0){
      playSfxV6("tick");
    }

    if(vocabGame.timeLeft <= 0){
      clearTimerV6();
      handleTimeoutV6();
    }
  }, 1000);
}

function clearTimerV6(){
  if(vocabGame.timerId){
    clearInterval(vocabGame.timerId);
    clearTimeout(vocabGame.timerId);
    vocabGame.timerId = null;
  }
}

function renderTimerV6(){
  const el = byId("v6Timer");
  if(!el) return;

  el.textContent = `${vocabGame.timeLeft || 0}s`;
  el.classList.toggle("danger", safeNumber(vocabGame.timeLeft, 0) <= 3);
}

function handleTimeoutV6(){
  if(!vocabGame.active || !vocabGame.currentQuestion || !vocabGame.currentStage) return;

  lockChoicesV6();

  const stage = vocabGame.currentStage;
  const question = vocabGame.currentQuestion;

  vocabGame.wrong += 1;
  vocabGame.combo = 0;

  if(vocabGame.fever){
    stopFeverV62();
  }

  const stat = vocabGame.stageStats[stage.id];
  if(stat){
    stat.wrong += 1;
    stat.count += 1;
    stat.responseMsTotal += 99999;
  }

  const baseAttack = calculateEnemyAttackV6({
    stageId: stage.id,
    difficulty: vocabGame.difficulty,
    bank: vocabGame.bank
  });

  const finalAttack = applyEnemyAttackWithShieldV62(baseAttack);
  vocabGame.playerHp = Math.max(0, vocabGame.playerHp - finalAttack);

  vocabGame.mistakes.push({
    term: question.correctTerm.term,
    meaning: question.correctTerm.meaning,
    selected: "TIMEOUT",
    stageId: stage.id,
    responseMs: 99999
  });

  revealCorrectChoiceV6();
  updateHudV6();

  if(finalAttack > 0 && typeof addBossAttackFxV62 === "function"){
    addBossAttackFxV62();
  }

  playSfxV6("wrong");
  showFloatingTextV6(finalAttack > 0 ? "TIME OUT!" : "🛡️ BLOCKED!", finalAttack > 0 ? "bad" : "stage");
  showAnswerExplainV61(false, question);

  logAnswerEventV6({
    question,
    stage,
    choice: { text:"TIMEOUT", correct:false },
    isCorrect:false,
    responseMs:99999,
    selectedText:"TIMEOUT"
  });

  if(typeof updateMasteryFromAnswer === "function"){
    updateMasteryFromAnswer({
      term: question.correctTerm.term,
      meaning: question.correctTerm.meaning,
      bank: vocabGame.bank,
      is_correct: 0,
      response_ms: 99999,
      stage_id: stage.id,
      mode: vocabGame.mode,
      ai_help_used_on_question: vocabGame.currentAiHelpUsed ? 1 : 0
    });
  }

  if(vocabGame.playerHp <= 0){
    setTimeout(() => {
      if(vocabGame.active){
        endVocabBattleV6("player_defeated");
      }
    }, 850);
    return;
  }

  setTimeout(() => {
    if(vocabGame.active){
      nextQuestionV6();
    }
  }, 1150);
}

/* =========================================================
   SCORE / DAMAGE / ENEMY ATTACK
========================================================= */

function calculateScoreGainV6({ damage, responseMs, combo, stageId, aiHelpUsed }){
  const modeConfig = vocabGame.modeConfig || VOCAB_PLAY_MODES.learn;

  const speedBonus = responseMs < 2500 ? 30 : responseMs < 5000 ? 15 : 5;
  const comboBonus = combo * 5;
  let score = 50 + speedBonus + comboBonus + damage;

  if(stageId === "boss") score += 20;
  if(stageId === "mission") score += 12;
  if(stageId === "speed" && responseMs < 2500) score += 15;

  score = Math.round(score * safeNumber(modeConfig.scoreMultiplier, 1));

  if(vocabGame.fever){
    score = Math.round(score * VOCAB_POWER.feverScoreMultiplier);
  }

  if(aiHelpUsed){
    score = Math.round(score * (1 - VOCAB_AI_HELP.scorePenaltyPerUse));
  }

  return Math.max(1, score);
}

function calculateDamageV6({ responseMs, combo, stageId, difficulty }){
  const config = VOCAB_DIFFICULTY[difficulty] || VOCAB_DIFFICULTY.normal;
  const feel = typeof getDifficultyFeelV71 === "function"
    ? getDifficultyFeelV71(difficulty)
    : { damageScale:1 };

  let damage = 10;

  if(responseMs < 1800) damage += 12;
  else if(responseMs < 3500) damage += 7;
  else if(responseMs < 6500) damage += 3;
  else if(difficulty === "challenge") damage -= 2;

  if(combo >= 3) damage += 5;
  if(combo >= 5) damage += 8;
  if(combo >= 8) damage += 14;

  if(stageId === "boss") damage += 5;
  if(stageId === "speed") damage += 3;

  damage = Math.round((damage * safeNumber(feel.damageScale, 1)) / config.bossMultiplier);

  return Math.max(4, damage);
}

function calculateEnemyAttackV6({ stageId, difficulty, bank }){
  const feel = typeof getDifficultyFeelV71 === "function"
    ? getDifficultyFeelV71(difficulty || vocabGame.difficulty || "normal")
    : { attackBase:1, attackStageBonus:1 };

  let attack = safeNumber(feel.attackBase, 1);

  if(stageId === "trap") attack += safeNumber(feel.attackStageBonus, 0);
  if(stageId === "boss") attack += safeNumber(feel.attackStageBonus, 0) + 1;
  if(bank === "C" && stageId === "boss") attack += 1;

  return Math.max(1, attack);
}

/* =========================================================
   POWER STATE
========================================================= */

function resetPowerStateV62(){
  const modeConfig = vocabGame.modeConfig || VOCAB_PLAY_MODES.learn;

  vocabGame.fever = false;
  vocabGame.feverUntil = 0;

  if(vocabGame.feverTimerId){
    clearTimeout(vocabGame.feverTimerId);
    clearInterval(vocabGame.feverTimerId);
  }

  vocabGame.feverTimerId = null;

  vocabGame.shield = modeConfig.startShield ?? 1;
  vocabGame.hints = modeConfig.startHints ?? 1;
  vocabGame.laserReady = false;

  vocabGame.aiHelpLeft = calculateAiHelpStartV67(vocabGame.mode, vocabGame.difficulty);
  vocabGame.aiHelpUsed = 0;
  vocabGame.aiHelpPenalty = 0;
  vocabGame.currentAiHelpUsed = false;

  vocabGame.powerStats = {
    feverCount: 0,
    shieldUsed: 0,
    hintUsed: 0,
    laserUsed: 0,
    bossAttackCount: 0,
    aiHelpUsed: 0
  };
}

function updatePowerHudV62(){
  const feverChip = byId("v6FeverChip");
  const hintBtn = byId("v6HintBtn");
  const aiHelpBtn = byId("v67AiHelpBtn");
  const shieldChip = byId("v6ShieldChip");
  const laserChip = byId("v6LaserChip");
  const battlePanel = byId("v6BattlePanel");

  const feverOn = !!vocabGame.fever;

  if(feverChip){
    feverChip.textContent = feverOn ? "🔥 Fever: ON!" : "🔥 Fever: OFF";
    feverChip.classList.toggle("active", feverOn);
  }

  if(hintBtn){
    hintBtn.textContent = `💡 Hint x${vocabGame.hints || 0}`;
    hintBtn.disabled = !vocabGame.active || safeNumber(vocabGame.hints, 0) <= 0;
  }

  if(aiHelpBtn){
    aiHelpBtn.textContent = `🤖 AI Help x${vocabGame.aiHelpLeft || 0}`;
    aiHelpBtn.disabled = !vocabGame.active || safeNumber(vocabGame.aiHelpLeft, 0) <= 0;
  }

  if(shieldChip){
    shieldChip.textContent = `🛡️ Shield x${vocabGame.shield || 0}`;
  }

  if(laserChip){
    laserChip.textContent = vocabGame.laserReady ? "🔴 Laser: READY" : "🔴 Laser: Not ready";
    laserChip.classList.toggle("active", !!vocabGame.laserReady);
  }

  if(battlePanel){
    battlePanel.classList.toggle("fever", feverOn);
  }
}

function checkFeverV62(){
  if(!vocabGame.active) return;

  const modeConfig = vocabGame.modeConfig || VOCAB_PLAY_MODES.learn;
  const feverNeed = modeConfig.feverComboNeed || VOCAB_POWER.feverComboNeed;
  const laserNeed = modeConfig.laserComboNeed || VOCAB_POWER.laserComboNeed;

  if(vocabGame.combo >= feverNeed && !vocabGame.fever){
    startFeverV62();
  }

  if(vocabGame.combo >= laserNeed && !vocabGame.laserReady){
    vocabGame.laserReady = true;
    showFloatingTextV6("🔴 LASER READY!", "stage");
    playSfxV6("stage");
  }

  updatePowerHudV62();
}

function startFeverV62(){
  vocabGame.fever = true;
  vocabGame.feverUntil = Date.now() + VOCAB_POWER.feverDurationMs;
  vocabGame.powerStats.feverCount += 1;

  showFloatingTextV6("🔥 FEVER MODE!", "stage");
  createBurstV62();
  playSfxV6("fever");

  if(vocabGame.feverTimerId){
    clearTimeout(vocabGame.feverTimerId);
  }

  vocabGame.feverTimerId = setTimeout(stopFeverV62, VOCAB_POWER.feverDurationMs);

  updatePowerHudV62();

  logVocabEventV6("fever_start", {
    combo: vocabGame.combo,
    duration_ms: VOCAB_POWER.feverDurationMs
  });
}

function stopFeverV62(){
  vocabGame.fever = false;
  vocabGame.feverUntil = 0;

  if(vocabGame.feverTimerId){
    clearTimeout(vocabGame.feverTimerId);
    clearInterval(vocabGame.feverTimerId);
    vocabGame.feverTimerId = null;
  }

  updatePowerHudV62();

  if(vocabGame.active){
    logVocabEventV6("fever_end", {
      score: vocabGame.score,
      combo: vocabGame.combo
    });
  }
}

function useHintV62(){
  if(!vocabGame.active) return;
  if(safeNumber(vocabGame.hints, 0) <= 0) return;

  const buttons = qsa(".v6-choice:not(:disabled)");
  const correctText = getCorrectChoiceTextVocabUI(vocabGame.currentQuestion);

  const wrongButtons = buttons.filter(btn => {
    const text = btn.textContent || "";
    return correctText && !text.includes(correctText);
  });

  if(!wrongButtons.length) return;

  const target = wrongButtons[Math.floor(Math.random() * wrongButtons.length)];
  target.disabled = true;
  target.classList.add("v6-eliminated");

  vocabGame.hints = Math.max(0, vocabGame.hints - 1);
  vocabGame.powerStats.hintUsed += 1;

  showFloatingTextV6("💡 Hint!", "stage");
  playSfxV6("tick");
  updatePowerHudV62();

  logVocabEventV6("hint_used", {
    hints_left: vocabGame.hints,
    stage_id: vocabGame.currentStage?.id || ""
  });
}

function applyEnemyAttackWithShieldV62(baseAttack){
  let attack = safeNumber(baseAttack, 0);

  if(attack <= 0) return 0;

  if(safeNumber(vocabGame.shield, 0) > 0){
    vocabGame.shield -= 1;
    vocabGame.powerStats.shieldUsed += 1;

    showFloatingTextV6("🛡️ SHIELD BLOCK!", "stage");
    playSfxV6("shield");

    logVocabEventV6("shield_block", {
      shield_left: vocabGame.shield,
      blocked_damage: attack
    });

    return 0;
  }

  vocabGame.powerStats.bossAttackCount += 1;
  return attack;
}

function maybeUseLaserV62(){
  if(!vocabGame.laserReady) return 0;

  vocabGame.laserReady = false;
  vocabGame.powerStats.laserUsed += 1;

  const laserDamage = vocabGame.fever ? 38 : 26;

  createLaserV62();
  createBurstV62();
  showFloatingTextV6(`🔴 LASER +${laserDamage}`, "good");
  playSfxV6("laser");

  logVocabEventV6("laser_used", {
    damage: laserDamage,
    fever: vocabGame.fever ? 1 : 0
  });

  return laserDamage;
}

function rewardPowerByComboV62(){
  const combo = vocabGame.combo || 0;
  const modeConfig = vocabGame.modeConfig || VOCAB_PLAY_MODES.learn;
  const laserNeed = modeConfig.laserComboNeed || VOCAB_POWER.laserComboNeed;

  if(combo === 3){
    vocabGame.hints = Math.min(VOCAB_POWER.hintMax, safeNumber(vocabGame.hints, 0) + 1);
    showFloatingTextV6("💡 Hint +1", "stage");

    logVocabEventV6("power_reward", {
      power: "hint",
      combo
    });
  }

  if(combo === 4){
    vocabGame.shield = Math.min(VOCAB_POWER.shieldMax, safeNumber(vocabGame.shield, 0) + 1);
    showFloatingTextV6("🛡️ Shield +1", "stage");

    logVocabEventV6("power_reward", {
      power: "shield",
      combo
    });
  }

  if(combo === laserNeed){
    vocabGame.laserReady = true;

    logVocabEventV6("power_reward", {
      power: "laser",
      combo
    });
  }

  updatePowerHudV62();
}

/* =========================================================
   AI HELP
========================================================= */

function calculateAiHelpStartV67(modeId, difficulty){
  const base = VOCAB_AI_HELP.modeBase[modeId] ?? 1;
  const bonus = VOCAB_AI_HELP.difficultyBonus[difficulty] ?? 0;
  return Math.max(0, base + bonus);
}

function useAiHelpV67(){
  if(!vocabGame.active) return;
  if(!vocabGame.currentQuestion) return;
  if(safeNumber(vocabGame.aiHelpLeft, 0) <= 0) return;

  vocabGame.aiHelpLeft = Math.max(0, vocabGame.aiHelpLeft - 1);
  vocabGame.aiHelpUsed += 1;
  vocabGame.powerStats.aiHelpUsed = vocabGame.aiHelpUsed;
  vocabGame.currentAiHelpUsed = true;

  vocabGame.aiHelpPenalty = Math.min(
    VOCAB_AI_HELP.maxPenalty,
    safeNumber(vocabGame.aiHelpUsed, 0) * VOCAB_AI_HELP.scorePenaltyPerUse
  );

  const help = buildAiHelpTextV67(vocabGame.currentQuestion, vocabGame.currentStage);

  renderAiHelpBoxV67(help);
  updatePowerHudV62();
  playSfxV6("stage");

  logVocabEventV6("ai_help_used", {
    ai_help_left: vocabGame.aiHelpLeft,
    ai_help_used: vocabGame.aiHelpUsed,
    ai_help_penalty: vocabGame.aiHelpPenalty,
    stage_id: vocabGame.currentStage?.id || "",
    question_mode: vocabGame.currentQuestion?.mode || "",
    answer_mode: vocabGame.currentQuestion?.answerMode || "",
    term: vocabGame.currentQuestion?.correctTerm?.term || ""
  });
}

function buildAiHelpTextV67(question, stage){
  const term = normalizeTermV61(question.correctTerm || {});
  const prompt = String(question.prompt || "");
  const keywords = extractPromptKeywordsV67(prompt);
  const lines = [];

  lines.push(`<b>AI Help</b> ช่วยคิด ไม่เฉลยตรง ๆ`);

  if(question.answerMode === "term"){
    lines.push(`โจทย์นี้ให้ดู “สถานการณ์” แล้วเลือกคำศัพท์ที่เหมาะที่สุด`);
  }else{
    lines.push(`โจทย์นี้ถาม “ความหมายที่ถูกต้อง” ของคำศัพท์`);
  }

  if(keywords.length){
    lines.push(`Keyword ที่ควรสังเกต: <b>${keywords.slice(0, 5).map(escapeHtmlV6).join(", ")}</b>`);
  }

  const clue = buildConceptClueV67(term);
  if(clue) lines.push(clue);

  if(stage?.id === "trap"){
    lines.push(`ระวังตัวเลือกที่ความหมายใกล้กัน ให้ดูคำหลักในนิยาม`);
  }

  if(stage?.id === "mission" || question.mode === "context" || question.mode === "boss_context"){
    lines.push(`ลองถามตัวเองว่า “ในสถานการณ์นี้ คนกำลังทำอะไรกับระบบ/ข้อมูล/โปรเจกต์?”`);
  }

  lines.push(`ใช้ AI Help แล้วคะแนนข้อนี้ลด 10% เพื่อให้ Leaderboard ยุติธรรม`);

  return lines.join("<br>");
}

function extractPromptKeywordsV67(text){
  const stop = new Set([
    "the","and","for","with","that","this","from","into","your","you","are","can","will",
    "which","word","fits","best","choose","meaning","what","does","mean",
    "คำ","คือ","การ","ของ","และ","ใน","ที่","เป็น","ใช้","หรือ","ให้","ได้"
  ]);

  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\sก-๙]/g, " ")
    .split(/\s+/)
    .map(x => x.trim())
    .filter(x => x.length > 3 && !stop.has(x))
    .slice(0, 8);
}

function buildConceptClueV67(term){
  const w = String(term.term || "").toLowerCase();
  const m = String(term.meaning || "").toLowerCase();

  const clues = [
    { keys:["debug","bug","error","fix"], text:`กลุ่มคำใบ้: error / fix / code problem → คิดถึงการหาข้อผิดพลาดและแก้ไข` },
    { keys:["deploy","release","publish","online"], text:`กลุ่มคำใบ้: online / release / users access → คิดถึงการนำระบบไปให้ผู้ใช้ใช้งาน` },
    { keys:["dataset","data","examples"], text:`กลุ่มคำใบ้: many examples / AI learns / collection → คิดถึงชุดข้อมูล` },
    { keys:["algorithm","step"], text:`กลุ่มคำใบ้: step-by-step / solve problem → คิดถึงลำดับขั้นตอน` },
    { keys:["database","store","records"], text:`กลุ่มคำใบ้: store / accounts / records → คิดถึงระบบจัดเก็บข้อมูล` },
    { keys:["interface","ui","screen","buttons"], text:`กลุ่มคำใบ้: buttons / screen / users interact → คิดถึงส่วนที่ผู้ใช้โต้ตอบ` },
    { keys:["requirement","client","needs"], text:`กลุ่มคำใบ้: client needs / system must do → คิดถึงความต้องการของระบบ` },
    { keys:["deadline","friday","finish"], text:`กลุ่มคำใบ้: final date / must finish → คิดถึงกำหนดส่ง` },
    { keys:["prototype","early","test"], text:`กลุ่มคำใบ้: early version / testing idea → คิดถึงต้นแบบ` },
    { keys:["accuracy","correct"], text:`กลุ่มคำใบ้: how often correct → คิดถึงความแม่นยำ` },
    { keys:["classification","categories","groups"], text:`กลุ่มคำใบ้: put into groups/categories → คิดถึงการจัดประเภท` },
    { keys:["prompt","instruction","ai"], text:`กลุ่มคำใบ้: instruction to AI → คิดถึงคำสั่งที่ส่งให้ AI` }
  ];

  const found = clues.find(c => c.keys.some(k => w.includes(k) || m.includes(k)));

  return found
    ? found.text
    : `ลองเทียบคำตอบกับแนวคิดหลัก: <b>${escapeHtmlV6(term.meaning || "")}</b>`;
}

function renderAiHelpBoxV67(html){
  let box = byId("v67AiHelpBox");

  if(!box){
    box = document.createElement("div");
    box.id = "v67AiHelpBox";
    box.className = "v67-ai-help-box";

    const qCard = qs(".v6-question-card");
    const choices = byId("v6Choices");

    if(qCard && choices){
      qCard.insertBefore(box, choices);
    }else if(qCard){
      qCard.appendChild(box);
    }
  }

  box.hidden = false;
  box.innerHTML = html;
}

function clearAiHelpBoxV67(){
  const box = byId("v67AiHelpBox");
  if(box){
    box.hidden = true;
    box.innerHTML = "";
  }
}

/* =========================================================
   END GAME
========================================================= */

function endVocabBattleV6(reason = "completed"){
  if(!vocabGame.active) return;

  clearTimerV6();
  stopFeverV62();

  vocabGame.active = false;
  vocabGame.endedAt = Date.now();

  const total = vocabGame.correct + vocabGame.wrong;
  const accuracy = total > 0 ? Math.round((vocabGame.correct / total) * 100) : 0;
  const durationSec = Math.round((vocabGame.endedAt - vocabGame.startedAt) / 1000);
  const bossDefeated = vocabGame.enemyHp <= 0 || reason === "boss_defeated";
  const modeConfig = vocabGame.modeConfig || VOCAB_PLAY_MODES.learn;

  const result = {
    version: VOCAB_APP.version,
    reason,
    bank: vocabGame.bank,
    difficulty: vocabGame.difficulty,
    mode: vocabGame.mode,
    modeLabel: modeConfig.label,
    score: vocabGame.score,
    correct: vocabGame.correct,
    wrong: vocabGame.wrong,
    accuracy,
    comboMax: vocabGame.comboMax,
    durationSec,
    bossDefeated,
    enemyName: vocabGame.enemy?.name || "",
    weakestTerms: buildWeakestTermsV6(),
    stageStats: vocabGame.stageStats || {},
    powerStats: vocabGame.powerStats || {},
    feverCount: vocabGame.powerStats?.feverCount || 0,
    shieldUsed: vocabGame.powerStats?.shieldUsed || 0,
    hintUsed: vocabGame.powerStats?.hintUsed || 0,
    laserUsed: vocabGame.powerStats?.laserUsed || 0,
    aiHelpUsed: vocabGame.aiHelpUsed || 0,
    aiHelpLeft: vocabGame.aiHelpLeft || 0,
    aiHelpPenalty: vocabGame.aiHelpPenalty || 0,
    aiAssisted: safeNumber(vocabGame.aiHelpUsed, 0) > 0
  };

  const reward = buildRewardDataV6(result);
  const coach = buildAICoachSummaryV6(result);

  const leaderboardUpdate = updateLeaderboardV68(result, reward);
  result.rank = leaderboardUpdate.rank;
  result.personalBest = leaderboardUpdate.personalBest;
  result.improvement = leaderboardUpdate.improvement;
  result.classTopScore = leaderboardUpdate.classTopScore;
  result.fairScore = leaderboardUpdate.fairScore;

  saveLastVocabSummaryV6({ result, reward, coach });
  saveTeacherSummaryV63(result, reward, coach);
  updateStudentProfileV63(result, reward, coach);

  logVocabEventV6("session_end", {
    ended_at: new Date(vocabGame.endedAt).toISOString(),
    duration_sec: result.durationSec,
    reason: result.reason,
    score: result.score,
    correct: result.correct,
    wrong: result.wrong,
    accuracy: result.accuracy,
    combo_max: result.comboMax,
    boss_defeated: result.bossDefeated ? 1 : 0,
    enemy_name: result.enemyName,
    stars: reward.stars,
    badge: reward.badge,
    coins: reward.coins,
    ai_headline: coach.headline,
    ai_next_mode: coach.nextMode,
    ai_reason: coach.reason,
    weakest_terms_json: JSON.stringify(result.weakestTerms || []),
    stage_stats_json: JSON.stringify(result.stageStats || {}),
    power_stats_json: JSON.stringify(result.powerStats || {}),
    ai_help_used: result.aiHelpUsed || 0,
    ai_assisted: result.aiAssisted ? 1 : 0,
    leaderboard_rank: result.rank || "",
    fair_score: result.fairScore || result.score || 0,
    personal_best: result.personalBest || "",
    improvement: result.improvement || "",
    class_top_score: result.classTopScore || ""
  });

  renderRewardScreenV6(result, reward, coach);
}

function buildRewardDataV6(result){
  let stars = 1;

  if(result.accuracy >= 70) stars = 2;
  if(result.accuracy >= 85 && result.bossDefeated) stars = 3;

  let badge = "Vocabulary Starter";

  if(stars === 2) badge = "Word Fighter";
  if(stars === 3) badge = "Boss Breaker";
  if(stars === 3 && result.comboMax >= 5) badge = "Combo Hero";
  if(stars === 3 && result.accuracy >= 95) badge = "Vocabulary Master";

  const coins = Math.round(result.score / 10) + stars * 20 + (result.bossDefeated ? 50 : 0);

  return {
    stars,
    badge,
    coins,
    message: result.bossDefeated
      ? "คุณปราบบอสคำศัพท์ได้สำเร็จ!"
      : "บอสยังไม่ล้ม ลองแก้มืออีกครั้ง!"
  };
}

function buildAICoachSummaryV6(result){
  let headline = "";
  let nextMode = "";
  let reason = "";

  if(result.mode === "learn" && result.accuracy >= 75){
    nextMode = "Debug Mission";
    headline = "พื้นฐานเริ่มดีแล้ว ลองใช้คำศัพท์ในสถานการณ์จริงต่อ";
    reason = "คุณทำ AI Training ได้ดีพอสำหรับการฝึก context";
  }else if(result.mode === "mission" && result.accuracy >= 75){
    nextMode = "Boss Battle";
    headline = "คุณเริ่มใช้คำศัพท์ในบริบทได้ดี พร้อมลองโหมดต่อสู้";
    reason = "ผลใน Debug Mission แสดงว่าคุณเข้าใจคำในสถานการณ์จริง";
  }else if(result.accuracy >= 90){
    headline = "ยอดเยี่ยมมาก! คุณพร้อมเพิ่มระดับความท้าทายแล้ว";
    nextMode = result.difficulty === "challenge" ? "Challenge Boss Battle" : "Hard / Challenge Mode";
    reason = "คุณตอบแม่น คุมเวลาได้ดี และ combo สูง";
  }else if(result.accuracy >= 70){
    headline = "ทำได้ดีแล้ว เหลือแค่ฝึกคำที่ยังสับสน";
    nextMode = "AI Training + Debug Mission";
    reason = "คุณเข้าใจคำส่วนใหญ่ แต่ยังพลาดคำที่ความหมายใกล้กัน";
  }else{
    headline = "ควรเก็บพื้นฐานอีกนิด แล้วจะชนะบอสง่ายขึ้น";
    nextMode = "AI Training / Easy Review";
    reason = "ระบบพบว่ายังสับสนคำหลักหลายคำ";
  }

  let powerTip = "";

  if(safeNumber(result.feverCount, 0) >= 1){
    powerTip = "คุณทำ Combo จนเข้า Fever ได้แล้ว รอบหน้าลองรักษา Combo ให้ยาวขึ้น";
  }else if(safeNumber(result.comboMax, 0) >= 3){
    powerTip = "คุณเริ่มทำ Combo ได้ดีแล้ว พยายามต่อเนื่องถึง x5 เพื่อเปิด Fever Mode";
  }else{
    powerTip = "รอบหน้าลองตอบคำง่ายให้ต่อเนื่องก่อน เพื่อสะสม Hint, Shield และเปิด Fever";
  }

  let aiHelpTip = "";

  if(safeNumber(result.aiHelpUsed, 0) >= 3){
    aiHelpTip = "คุณใช้ AI Help หลายครั้ง ควรทบทวนคำศัพท์พื้นฐานหรืออ่านโจทย์ช้าลงอีกนิด";
  }else if(safeNumber(result.aiHelpUsed, 0) > 0){
    aiHelpTip = "คุณใช้ AI Help ได้เหมาะสม รอบหน้าลองลดจำนวนครั้งลงเพื่อเพิ่มคะแนนและความมั่นใจ";
  }else{
    aiHelpTip = "รอบนี้ไม่ใช้ AI Help เลย เยี่ยมมาก ถ้ายังแม่นแบบนี้สามารถเพิ่มระดับความยากได้";
  }

  return {
    headline,
    nextMode,
    reason,
    powerTip,
    aiHelpTip,
    bestStage: getBestStageV6(),
    weakestTerms: result.weakestTerms.slice(0, 5)
  };
}

function getBestStageV6(){
  let best = null;

  Object.entries(vocabGame.stageStats || {}).forEach(([stageId, stat]) => {
    const total = safeNumber(stat.correct, 0) + safeNumber(stat.wrong, 0);
    if(total <= 0) return;

    const acc = safeNumber(stat.correct, 0) / total;

    if(!best || acc > best.acc){
      best = { stageId, acc };
    }
  });

  if(!best) return "Warm-up";

  const stage = VOCAB_STAGES.find(s => s.id === best.stageId);
  return stage ? stage.name : best.stageId;
}

function buildWeakestTermsV6(){
  const map = new Map();

  (vocabGame.mistakes || []).forEach(m => {
    if(!m.term) return;

    if(!map.has(m.term)){
      map.set(m.term, {
        term: m.term,
        meaning: m.meaning,
        count: 0,
        stages: new Set()
      });
    }

    const item = map.get(m.term);
    item.count += 1;
    item.stages.add(m.stageId);
  });

  return [...map.values()]
    .map(x => ({
      term: x.term,
      meaning: x.meaning,
      count: x.count,
      stages: [...x.stages]
    }))
    .sort((a,b) => b.count - a.count);
}

/* =========================================================
   LOGGING ANSWER
========================================================= */

function logAnswerEventV6({ question, stage, choice, isCorrect, responseMs, selectedText }){
  logVocabEventV6("term_answer", {
    term_id: question.correctTerm.term,
    term: question.correctTerm.term,
    meaning: question.correctTerm.meaning || question.correctTerm.definition || "",
    category: question.correctTerm.category || "",

    variant_type: question.mode,
    answer_mode: question.answerMode || "",

    stage_id: stage.id,
    stage_name: stage.name,

    prompt: question.prompt,
    selected: selectedText,
    is_correct: isCorrect ? 1 : 0,
    response_ms: responseMs,

    score: vocabGame.score,
    combo: vocabGame.combo,
    combo_max: vocabGame.comboMax,
    player_hp: vocabGame.playerHp,
    enemy_hp: vocabGame.enemyHp,

    fever: vocabGame.fever ? 1 : 0,
    shield_left: vocabGame.shield || 0,
    hints_left: vocabGame.hints || 0,
    laser_ready: vocabGame.laserReady ? 1 : 0,

    ai_help_used_on_question: vocabGame.currentAiHelpUsed ? 1 : 0,
    ai_help_left: vocabGame.aiHelpLeft || 0,
    ai_help_used_total: vocabGame.aiHelpUsed || 0,
    ai_help_penalty: vocabGame.aiHelpPenalty || 0
  });
}

/* =========================================================
   FX HELPERS
========================================================= */

function addEnemyHitFxV62(){
  const card = qs(".v6-enemy-card");
  if(!card) return;

  card.classList.remove("hit");
  void card.offsetWidth;
  card.classList.add("hit");

  setTimeout(() => card.classList.remove("hit"), 320);
}

function addBossAttackFxV62(){
  const enemy = qs(".v6-enemy-card");
  const qCard = qs(".v6-question-card");

  if(enemy){
    enemy.classList.remove("attack");
    void enemy.offsetWidth;
    enemy.classList.add("attack");
    setTimeout(() => enemy.classList.remove("attack"), 380);
  }

  if(qCard){
    qCard.classList.remove("shake");
    void qCard.offsetWidth;
    qCard.classList.add("shake");
    setTimeout(() => qCard.classList.remove("shake"), 320);
  }
}

function createLaserV62(){
  const beam = document.createElement("div");
  beam.className = "v6-laser-beam";
  document.body.appendChild(beam);
  setTimeout(() => beam.remove(), 480);
}

function createBurstV62(){
  const burst = document.createElement("div");
  burst.className = "v6-fx-burst";
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 560);
}

/* =========================================================
   SFX
========================================================= */

function playSfxV6(type){
  try{
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtx) return;

    if(!window.__VOCAB_AUDIO_CTX__){
      window.__VOCAB_AUDIO_CTX__ = new AudioCtx();
    }

    const ctx = window.__VOCAB_AUDIO_CTX__;

    if(ctx.state === "suspended"){
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    let freq = 440;
    let duration = 0.08;

    if(type === "correct"){
      freq = 740;
      duration = 0.09;
    }else if(type === "wrong"){
      freq = 180;
      duration = 0.14;
    }else if(type === "start"){
      freq = 520;
      duration = 0.12;
    }else if(type === "stage"){
      freq = 620;
      duration = 0.10;
    }else if(type === "tick"){
      freq = 320;
      duration = 0.04;
    }else if(type === "laser"){
      freq = 920;
      duration = 0.16;
    }else if(type === "fever"){
      freq = 680;
      duration = 0.18;
    }else if(type === "shield"){
      freq = 520;
      duration = 0.12;
    }else if(type === "combo"){
      freq = 860;
      duration = 0.12;
    }

    osc.frequency.value = freq;
    osc.type = "sine";

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration + 0.03);
  }catch(e){
    // silent
  }
}
