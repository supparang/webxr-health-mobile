/* =========================================================
   /vocab/vocab.game.js
   TechPath Vocab Arena — Core Game Engine
   Version: 20260503a
   Depends on:
   - vocab.config.js
   - vocab.utils.js
   - vocab.data.js
   - vocab.state.js
   - vocab.storage.js
   - vocab.logger.js
   - vocab.question.js
   - vocab.ui.js
========================================================= */
(function(){
  "use strict";

  const WIN = window;

  const Config = WIN.VocabConfig || WIN.VOCAB_APP || {};
  const U = WIN.VocabUtils || {};
  const Data = WIN.VocabData || {};
  const State = WIN.VocabState || {};
  const Storage = WIN.VocabStorage || {};
  const Logger = WIN.VocabLogger || {};
  const Question = WIN.VocabQuestion || {};
  const UI = WIN.VocabUI || {};

  const game = State.game || WIN.vocabGame || {};

  const VERSION = "vocab-game-20260503a";

  function now(){
    return Date.now();
  }

  function uid(prefix){
    if(U.uid) return U.uid(prefix || "vocab");
    return `${prefix || "vocab"}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function log(type, data){
    if(Logger.log){
      Logger.log(type, data || {});
      return;
    }

    if(typeof WIN.logVocabEventV6 === "function"){
      WIN.logVocabEventV6(type, data || {});
    }
  }

  function playSfx(type){
    try{
      const AudioCtx = WIN.AudioContext || WIN.webkitAudioContext;
      if(!AudioCtx) return;

      if(!WIN.__VOCAB_AUDIO_CTX__){
        WIN.__VOCAB_AUDIO_CTX__ = new AudioCtx();
      }

      const ctx = WIN.__VOCAB_AUDIO_CTX__;

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
    }catch(e){}
  }

  function getDifficulty(diff){
    const table =
      Config.DIFFICULTY ||
      Config.difficulty ||
      WIN.VOCAB_DIFFICULTY ||
      {};

    return table[diff] || table.easy || {
      label: "Easy",
      totalQuestions: 8,
      timePerQuestion: 18,
      playerHp: 5,
      bossMultiplier: 0.8
    };
  }

  function getMode(mode){
    const table =
      Config.MODES ||
      Config.modes ||
      WIN.VOCAB_PLAY_MODES ||
      {};

    return table[mode] || table.learn || {
      id: "learn",
      label: "AI Training",
      shortLabel: "AI",
      icon: "🤖",
      totalQuestionBonus: 0,
      timeBonus: 5,
      startHints: 3,
      startShield: 2,
      feverComboNeed: 5,
      laserComboNeed: 8,
      scoreMultiplier: 0.9,
      stageOrder: ["warmup", "warmup", "trap", "mission"]
    };
  }

  function getEnemy(bank){
    const table =
      Config.ENEMIES ||
      Config.enemies ||
      WIN.VOCAB_ENEMIES ||
      {};

    return Object.assign({}, table[bank] || table.A || {
      name: "Bug Slime",
      title: "Basic Code Bug",
      avatar: "🟢",
      skill: "Speed pressure: ตอบช้าเสีย combo ง่าย",
      hp: 100
    });
  }

  function getStages(){
    return (
      Config.STAGES ||
      Config.stages ||
      WIN.VOCAB_STAGES ||
      [
        { id:"warmup", name:"Warm-up Round", icon:"✨", goal:"เก็บความมั่นใจ ตอบให้ถูก" },
        { id:"speed", name:"Speed Round", icon:"⚡", goal:"ตอบไวเพื่อเพิ่ม Combo" },
        { id:"trap", name:"Trap Round", icon:"🧠", goal:"ระวังคำที่ความหมายใกล้กัน" },
        { id:"mission", name:"Mini Mission", icon:"🎯", goal:"ใช้คำศัพท์กับสถานการณ์จริง" },
        { id:"boss", name:"Boss Battle", icon:"👾", goal:"โจมตีบอสให้ HP หมด" }
      ]
    );
  }

  function getTerms(bank, difficulty){
    if(Question.buildTermDeck){
      return Question.buildTermDeck(bank, difficulty);
    }

    if(Data.buildTermDeck){
      return Data.buildTermDeck(bank, difficulty);
    }

    if(Data.getTerms){
      return Data.getTerms(bank);
    }

    const banks = WIN.VOCAB_BANKS || {};
    return banks[bank] || banks.A || [];
  }

  function normalizeTerm(t){
    if(U.normalizeTerm) return U.normalizeTerm(t);

    return {
      term: String(t.term || t.word || "").trim(),
      meaning: String(t.meaning || t.definition || "").trim(),
      category: String(t.category || "").trim()
    };
  }

  function shuffle(arr){
    if(U.shuffle) return U.shuffle(arr);
    return [...arr].sort(() => Math.random() - 0.5);
  }

  function buildStagePlan(totalQuestions, stageOrder){
    const stages = getStages();
    const order = Array.isArray(stageOrder) && stageOrder.length
      ? stageOrder
      : stages.map(s => s.id);

    const picked = order
      .map(id => stages.find(s => s.id === id))
      .filter(Boolean);

    if(!picked.length){
      return [{ id:"warmup", name:"Warm-up Round", icon:"✨", goal:"เก็บความมั่นใจ", count:totalQuestions }];
    }

    const each = Math.floor(totalQuestions / picked.length);
    let remain = totalQuestions;

    return picked.map((stage, index) => {
      let count = each;

      if(index < totalQuestions % picked.length){
        count += 1;
      }

      if(index === picked.length - 1){
        count = remain;
      }

      remain -= count;

      return Object.assign({}, stage, { count });
    }).filter(s => s.count > 0);
  }

  function getTotalQuestions(){
    if(Array.isArray(game.stagePlan)){
      return game.stagePlan.reduce((sum, s) => sum + Number(s.count || 0), 0);
    }

    return 0;
  }

  function resetPower(modeCfg){
    game.fever = false;
    game.feverUntil = 0;

    if(game.feverTimerId){
      clearTimeout(game.feverTimerId);
      game.feverTimerId = null;
    }

    game.shield = modeCfg.startShield ?? 1;
    game.hints = modeCfg.startHints ?? 1;
    game.laserReady = false;

    game.aiHelpLeft = calculateAiHelpStart(game.mode, game.difficulty);
    game.aiHelpUsed = 0;
    game.aiHelpPenalty = 0;
    game.currentAiHelpUsed = false;

    game.powerStats = {
      feverCount: 0,
      shieldUsed: 0,
      hintUsed: 0,
      laserUsed: 0,
      bossAttackCount: 0,
      aiHelpUsed: 0
    };
  }

  function calculateAiHelpStart(mode, difficulty){
    const base = {
      learn: 3,
      speed: 1,
      mission: 2,
      battle: 1,
      bossrush: 0
    };

    const bonus = {
      easy: 1,
      normal: 0,
      hard: -1,
      challenge: -1
    };

    return Math.max(0, (base[mode] ?? 1) + (bonus[difficulty] ?? 0));
  }

  function start(options){
    options = options || {};

    const bank = options.bank || Config.selectedBank || "A";
    const difficulty = options.difficulty || Config.selectedDifficulty || "easy";
    const mode = options.mode || Config.selectedMode || "learn";

    const diffCfg = getDifficulty(difficulty);
    const modeCfg = getMode(mode);
    const enemy = getEnemy(bank);

    const terms = getTerms(bank, difficulty)
      .map(normalizeTerm)
      .filter(t => t.term && t.meaning);

    if(terms.length < 4){
      alert("ยังไม่มีคำศัพท์เพียงพอสำหรับ Bank นี้");
      return;
    }

    if(Storage.saveStudentContext){
      Storage.saveStudentContext();
    }else if(UI.saveStudentContext){
      UI.saveStudentContext();
    }

    game.sessionId = uid("vocab");
    game.active = true;

    game.bank = bank;
    game.difficulty = difficulty;
    game.mode = mode;
    game.modeConfig = modeCfg;

    game.terms = shuffle(terms);

    const totalQuestions = Number(diffCfg.totalQuestions || 8) + Number(modeCfg.totalQuestionBonus || 0);
    game.stagePlan = buildStagePlan(totalQuestions, modeCfg.stageOrder);

    game.stageIndex = 0;
    game.questionIndexInStage = 0;
    game.globalQuestionIndex = 0;

    game.currentStage = null;
    game.currentQuestion = null;
    game.questionStartedAt = 0;

    game.score = 0;
    game.combo = 0;
    game.comboMax = 0;
    game.correct = 0;
    game.wrong = 0;
    game.playerHp = Number(diffCfg.playerHp || 5);

    game.enemy = enemy;
    game.enemyHpMax = Math.round(Number(enemy.hp || 100) * Number(diffCfg.bossMultiplier || 1));
    game.enemyHp = game.enemyHpMax;

    game.mistakes = [];
    game.stageStats = {};

    getStages().forEach(stage => {
      game.stageStats[stage.id] = {
        correct: 0,
        wrong: 0,
        responseMsTotal: 0,
        count: 0
      };
    });

    game.startedAt = now();
    game.endedAt = 0;

    resetPower(modeCfg);

    if(UI.showBattleScreen) UI.showBattleScreen();
    if(UI.updateHud) UI.updateHud();
    if(UI.updatePowerHud) UI.updatePowerHud();

    log("session_start", {
      session_id: game.sessionId,
      bank,
      difficulty,
      mode,
      mode_label: modeCfg.label || mode,
      total_questions: getTotalQuestions(),
      enemy_name: enemy.name,
      enemy_hp_max: game.enemyHpMax,
      player_hp_start: game.playerHp,
      started_at: new Date(game.startedAt).toISOString()
    });

    playSfx("start");
    nextQuestion();
  }

  function buildQuestion(stage){
    if(Question.buildQuestion){
      return Question.buildQuestion(stage, game);
    }

    if(Question.create){
      return Question.create(stage, game);
    }

    const term = game.terms[game.globalQuestionIndex % game.terms.length];
    const wrongs = shuffle(game.terms.filter(t => t.term !== term.term)).slice(0, 3);

    return {
      id: uid("q"),
      stageId: stage.id,
      mode: "meaning",
      answerMode: "meaning",
      prompt: `What does "${term.term}" mean?`,
      correctTerm: term,
      choices: shuffle([
        { text: term.meaning, correct: true, term: term.term, meaning: term.meaning },
        ...wrongs.map(t => ({ text: t.meaning, correct: false, term: t.term, meaning: t.meaning }))
      ]),
      explain: `"${term.term}" means "${term.meaning}".`
    };
  }

  function nextQuestion(){
    clearTimer();

    if(!game.active) return;

    const stage = game.stagePlan[game.stageIndex];

    if(!stage){
      end("completed");
      return;
    }

    game.currentStage = stage;

    if(game.questionIndexInStage >= stage.count){
      game.stageIndex += 1;
      game.questionIndexInStage = 0;

      const nextStage = game.stagePlan[game.stageIndex];

      if(!nextStage){
        end("completed");
        return;
      }

      if(UI.showStageIntro) UI.showStageIntro(nextStage);

      setTimeout(nextQuestion, 650);
      return;
    }

    const question = buildQuestion(stage);

    game.currentQuestion = question;
    game.questionStartedAt = now();

    game.questionIndexInStage += 1;
    game.globalQuestionIndex += 1;
    game.currentAiHelpUsed = false;

    if(UI.renderQuestion){
      UI.renderQuestion(question, stage);
    }

    startTimer();

    log("question_show", {
      stage_id: stage.id,
      stage_name: stage.name,
      question_no: game.globalQuestionIndex,
      total_questions: getTotalQuestions(),
      term: question.correctTerm && question.correctTerm.term,
      answer_mode: question.answerMode || "",
      question_mode: question.mode || ""
    });
  }

  function getQuestionTime(){
    const diffCfg = getDifficulty(game.difficulty);
    const modeCfg = getMode(game.mode);

    let time = Number(diffCfg.timePerQuestion || 12) + Number(modeCfg.timeBonus || 0);

    if(game.currentStage && game.currentStage.id === "speed"){
      time -= 3;
    }

    if(game.currentStage && game.currentStage.id === "boss"){
      time -= 2;
    }

    if(game.difficulty === "challenge"){
      time -= 1;
    }

    return Math.max(4, time);
  }

  function startTimer(){
    clearTimer();

    game.timeLeft = getQuestionTime();

    if(UI.renderTimer) UI.renderTimer();

    game.timerId = setInterval(() => {
      game.timeLeft -= 1;

      if(UI.renderTimer) UI.renderTimer();

      if(game.timeLeft <= 3 && game.timeLeft > 0){
        playSfx("tick");
      }

      if(game.timeLeft <= 0){
        clearTimer();
        timeout();
      }
    }, 1000);
  }

  function clearTimer(){
    if(game.timerId){
      clearInterval(game.timerId);
      clearTimeout(game.timerId);
      game.timerId = null;
    }
  }

  function answerQuestion(choice, buttonEl){
    if(!game.active || !game.currentQuestion || !choice) return;

    const question = game.currentQuestion;
    const stage = game.currentStage || { id:"unknown", name:"Unknown" };
    const responseMs = now() - game.questionStartedAt;
    const isCorrect = !!choice.correct;

    clearTimer();

    if(UI.lockChoices) UI.lockChoices();

    const stat = game.stageStats[stage.id] || {
      correct: 0,
      wrong: 0,
      responseMsTotal: 0,
      count: 0
    };

    game.stageStats[stage.id] = stat;
    stat.count += 1;
    stat.responseMsTotal += responseMs;

    if(isCorrect){
      handleCorrect(choice, buttonEl, question, stage, responseMs, stat);
    }else{
      handleWrong(choice, buttonEl, question, stage, responseMs, stat);
    }

    if(UI.updateHud) UI.updateHud();
    if(UI.renderExplain) UI.renderExplain(isCorrect, question);

    logAnswer(choice, question, stage, responseMs, isCorrect);

    if(game.playerHp <= 0){
      setTimeout(() => end("player_defeated"), 900);
      return;
    }

    if(game.enemyHp <= 0){
      setTimeout(() => end("boss_defeated"), 900);
      return;
    }

    setTimeout(nextQuestion, isCorrect ? 700 : 1200);
  }

  function handleCorrect(choice, buttonEl, question, stage, responseMs, stat){
    game.correct += 1;
    game.combo += 1;
    game.comboMax = Math.max(Number(game.comboMax || 0), Number(game.combo || 0));
    stat.correct += 1;

    let damage = calculateDamage(responseMs, stage.id);

    if(game.fever){
      damage = Math.round(damage * 1.6);
    }

    damage += maybeUseLaser();

    game.enemyHp = Math.max(0, Number(game.enemyHp || 0) - damage);

    const speedBonus = responseMs < 2500 ? 30 : responseMs < 5000 ? 15 : 5;
    const comboBonus = Number(game.combo || 0) * 5;
    const modeCfg = getMode(game.mode);

    let gained = 50 + speedBonus + comboBonus + damage;
    gained = Math.round(gained * Number(modeCfg.scoreMultiplier || 1));

    if(game.fever){
      gained = Math.round(gained * 1.5);
    }

    if(game.currentAiHelpUsed){
      gained = Math.round(gained * 0.9);
    }

    game.score += gained;

    if(buttonEl) buttonEl.classList.add("correct");

    if(UI.addEnemyHitFx) UI.addEnemyHitFx();
    if(UI.floatingText) UI.floatingText(`+${damage} HIT!`, "good");

    playSfx("correct");

    rewardPowerByCombo();
    checkFeverAndLaser();
  }

  function handleWrong(choice, buttonEl, question, stage, responseMs, stat){
    game.wrong += 1;
    game.combo = 0;
    stat.wrong += 1;

    if(game.fever){
      stopFever();
    }

    const attack = applyShield(calculateEnemyAttack(stage.id));

    game.playerHp = Math.max(0, Number(game.playerHp || 0) - attack);

    game.mistakes.push({
      term: question.correctTerm && question.correctTerm.term,
      meaning: question.correctTerm && question.correctTerm.meaning,
      selected: choice.text,
      stageId: stage.id
    });

    if(buttonEl) buttonEl.classList.add("wrong");
    if(UI.revealCorrectChoice) UI.revealCorrectChoice(question);

    if(attack > 0){
      if(UI.addBossAttackFx) UI.addBossAttackFx();
      if(UI.floatingText) UI.floatingText(`-${attack} HP`, "bad");
    }else{
      if(UI.floatingText) UI.floatingText("🛡️ BLOCKED!", "stage");
    }

    playSfx("wrong");
  }

  function timeout(){
    if(!game.active || !game.currentQuestion) return;

    const question = game.currentQuestion;
    const stage = game.currentStage || { id:"unknown", name:"Unknown" };

    if(UI.lockChoices) UI.lockChoices();

    game.wrong += 1;
    game.combo = 0;

    if(game.fever){
      stopFever();
    }

    const stat = game.stageStats[stage.id];

    if(stat){
      stat.wrong += 1;
      stat.count += 1;
      stat.responseMsTotal += 99999;
    }

    const attack = applyShield(calculateEnemyAttack(stage.id));
    game.playerHp = Math.max(0, Number(game.playerHp || 0) - attack);

    game.mistakes.push({
      term: question.correctTerm && question.correctTerm.term,
      meaning: question.correctTerm && question.correctTerm.meaning,
      selected: "TIMEOUT",
      stageId: stage.id
    });

    if(UI.revealCorrectChoice) UI.revealCorrectChoice(question);
    if(UI.updateHud) UI.updateHud();

    if(attack > 0 && UI.addBossAttackFx){
      UI.addBossAttackFx();
    }

    playSfx("wrong");

    if(UI.floatingText){
      UI.floatingText(attack > 0 ? "TIME OUT!" : "🛡️ BLOCKED!", attack > 0 ? "bad" : "stage");
    }

    if(UI.renderExplain){
      UI.renderExplain(false, question);
    }

    logAnswer({ text:"TIMEOUT", correct:false }, question, stage, 99999, false);

    if(game.playerHp <= 0){
      setTimeout(() => end("player_defeated"), 900);
      return;
    }

    setTimeout(nextQuestion, 1200);
  }

  function calculateDamage(responseMs, stageId){
    const diffCfg = getDifficulty(game.difficulty);

    let damage = 10;

    if(responseMs < 2200) damage += 10;
    else if(responseMs < 4000) damage += 6;
    else if(responseMs < 7000) damage += 3;

    if(game.combo >= 3) damage += 5;
    if(game.combo >= 5) damage += 8;
    if(game.combo >= 8) damage += 14;

    if(stageId === "boss") damage += 5;
    if(stageId === "speed") damage += 3;

    damage = Math.round(damage / Number(diffCfg.bossMultiplier || 1));

    return Math.max(5, damage);
  }

  function calculateEnemyAttack(stageId){
    let attack = 1;

    if(stageId === "trap") attack += 1;
    if(stageId === "boss") attack += 1;
    if(game.difficulty === "hard") attack += 1;
    if(game.difficulty === "challenge") attack += 2;
    if(game.bank === "C" && stageId === "boss") attack += 1;

    return attack;
  }

  function applyShield(baseAttack){
    const attack = Number(baseAttack || 0);

    if(attack <= 0) return 0;

    if(Number(game.shield || 0) > 0){
      game.shield -= 1;

      if(game.powerStats){
        game.powerStats.shieldUsed += 1;
      }

      log("shield_block", {
        shield_left: game.shield,
        blocked_damage: attack
      });

      return 0;
    }

    if(game.powerStats){
      game.powerStats.bossAttackCount += 1;
    }

    return attack;
  }

  function rewardPowerByCombo(){
    const combo = Number(game.combo || 0);
    const modeCfg = getMode(game.mode);
    const laserNeed = Number(modeCfg.laserComboNeed || 7);

    if(combo === 3){
      game.hints = Math.min(4, Number(game.hints || 0) + 1);
      if(UI.floatingText) UI.floatingText("💡 Hint +1", "stage");
    }

    if(combo === 4){
      game.shield = Math.min(3, Number(game.shield || 0) + 1);
      if(UI.floatingText) UI.floatingText("🛡️ Shield +1", "stage");
    }

    if(combo === laserNeed){
      game.laserReady = true;
      if(UI.floatingText) UI.floatingText("🔴 LASER READY!", "stage");
    }

    if(UI.updatePowerHud) UI.updatePowerHud();
  }

  function checkFeverAndLaser(){
    const modeCfg = getMode(game.mode);
    const feverNeed = Number(modeCfg.feverComboNeed || 5);

    if(Number(game.combo || 0) >= feverNeed && !game.fever){
      startFever();
    }
  }

  function startFever(){
    game.fever = true;
    game.feverUntil = now() + 8500;

    if(game.powerStats){
      game.powerStats.feverCount += 1;
    }

    if(UI.floatingText) UI.floatingText("🔥 FEVER MODE!", "stage");
    if(UI.createBurst) UI.createBurst();

    playSfx("fever");

    if(game.feverTimerId){
      clearTimeout(game.feverTimerId);
    }

    game.feverTimerId = setTimeout(stopFever, 8500);

    if(UI.updatePowerHud) UI.updatePowerHud();

    log("fever_start", {
      combo: game.combo,
      duration_ms: 8500
    });
  }

  function stopFever(){
    game.fever = false;
    game.feverUntil = 0;

    if(game.feverTimerId){
      clearTimeout(game.feverTimerId);
      game.feverTimerId = null;
    }

    if(UI.updatePowerHud) UI.updatePowerHud();

    if(game.active){
      log("fever_end", {
        score: game.score,
        combo: game.combo
      });
    }
  }

  function maybeUseLaser(){
    if(!game.laserReady) return 0;

    game.laserReady = false;

    if(game.powerStats){
      game.powerStats.laserUsed += 1;
    }

    const damage = game.fever ? 38 : 26;

    if(UI.createLaser) UI.createLaser();
    if(UI.createBurst) UI.createBurst();
    if(UI.floatingText) UI.floatingText(`🔴 LASER +${damage}`, "good");

    playSfx("laser");

    log("laser_used", {
      damage,
      fever: game.fever ? 1 : 0
    });

    return damage;
  }

  function useHint(){
    if(!game.active) return;
    if(Number(game.hints || 0) <= 0) return;

    const question = game.currentQuestion;
    if(!question) return;

    const correctText =
      Question.getCorrectChoiceText
        ? Question.getCorrectChoiceText(question)
        : question.answerMode === "meaning"
          ? question.correctTerm.meaning
          : question.correctTerm.term;

    const buttons = Array.from(document.querySelectorAll(".vocab-choice:not(:disabled), .v6-choice:not(:disabled)"));
    const wrongButtons = buttons.filter(btn => !String(btn.textContent || "").includes(correctText));

    if(!wrongButtons.length) return;

    const target = wrongButtons[Math.floor(Math.random() * wrongButtons.length)];
    target.disabled = true;
    target.classList.add("vocab-eliminated", "v6-eliminated");

    game.hints = Math.max(0, Number(game.hints || 0) - 1);

    if(game.powerStats){
      game.powerStats.hintUsed += 1;
    }

    if(UI.floatingText) UI.floatingText("💡 Hint!", "stage");
    if(UI.updatePowerHud) UI.updatePowerHud();

    log("hint_used", {
      hints_left: game.hints,
      stage_id: game.currentStage && game.currentStage.id
    });
  }

  function useAiHelp(){
    if(!game.active || !game.currentQuestion) return;
    if(Number(game.aiHelpLeft || 0) <= 0) return;

    game.aiHelpLeft = Math.max(0, Number(game.aiHelpLeft || 0) - 1);
    game.aiHelpUsed += 1;
    game.currentAiHelpUsed = true;
    game.aiHelpPenalty = Math.min(0.30, Number(game.aiHelpUsed || 0) * 0.10);

    if(game.powerStats){
      game.powerStats.aiHelpUsed = game.aiHelpUsed;
    }

    const html = buildAiHelpText(game.currentQuestion, game.currentStage);

    if(UI.renderAiHelp){
      UI.renderAiHelp(html);
    }

    if(UI.updatePowerHud) UI.updatePowerHud();

    log("ai_help_used", {
      ai_help_left: game.aiHelpLeft,
      ai_help_used: game.aiHelpUsed,
      ai_help_penalty: game.aiHelpPenalty,
      stage_id: game.currentStage && game.currentStage.id,
      term: game.currentQuestion.correctTerm && game.currentQuestion.correctTerm.term
    });
  }

  function buildAiHelpText(question, stage){
    const term = question.correctTerm || {};
    const mode = question.answerMode || "meaning";
    const stageId = stage && stage.id;

    const lines = [];

    lines.push("<b>AI Help</b> ช่วยคิด ไม่เฉลยตรง ๆ");

    if(mode === "term"){
      lines.push("โจทย์นี้ให้ดูสถานการณ์ แล้วเลือกคำศัพท์ที่เหมาะที่สุด");
    }else{
      lines.push("โจทย์นี้ถามความหมายที่ถูกต้องของคำศัพท์");
    }

    if(stageId === "trap"){
      lines.push("ระวังตัวเลือกที่ความหมายใกล้กัน ให้ดูคำหลักในนิยาม");
    }

    if(stageId === "mission" || stageId === "boss"){
      lines.push("ลองถามตัวเองว่าในสถานการณ์นี้ คนกำลังทำอะไรกับระบบ/ข้อมูล/โปรเจกต์");
    }

    lines.push(`แนวคิดหลักเกี่ยวกับคำนี้: <b>${escapeHtml(term.meaning || "")}</b>`);
    lines.push("ใช้ AI Help แล้วคะแนนข้อนี้จะลดลงเล็กน้อยเพื่อความยุติธรรม");

    return lines.join("<br>");
  }

  function escapeHtml(s){
    if(U.escapeHtml) return U.escapeHtml(s);

    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  function logAnswer(choice, question, stage, responseMs, isCorrect){
    const term = question.correctTerm || {};

    log("term_answer", {
      term_id: term.term || "",
      term: term.term || "",
      meaning: term.meaning || "",
      category: term.category || "",

      variant_type: question.mode || "",
      answer_mode: question.answerMode || "",

      stage_id: stage.id,
      stage_name: stage.name || "",

      prompt: question.prompt || "",
      selected: choice.text || "",
      is_correct: isCorrect ? 1 : 0,
      response_ms: responseMs,

      score: game.score,
      combo: game.combo,
      combo_max: game.comboMax,
      player_hp: game.playerHp,
      enemy_hp: game.enemyHp,

      fever: game.fever ? 1 : 0,
      shield_left: game.shield || 0,
      hints_left: game.hints || 0,
      laser_ready: game.laserReady ? 1 : 0,
      ai_help_used_on_question: game.currentAiHelpUsed ? 1 : 0,
      ai_help_left: game.aiHelpLeft || 0,
      ai_help_used_total: game.aiHelpUsed || 0,
      ai_help_penalty: game.aiHelpPenalty || 0
    });
  }

  function buildWeakestTerms(){
    const map = new Map();

    (game.mistakes || []).forEach(m => {
      if(!m.term) return;

      if(!map.has(m.term)){
        map.set(m.term, {
          term: m.term,
          meaning: m.meaning || "",
          count: 0,
          stages: new Set()
        });
      }

      const item = map.get(m.term);
      item.count += 1;

      if(m.stageId){
        item.stages.add(m.stageId);
      }
    });

    return Array.from(map.values())
      .map(x => ({
        term: x.term,
        meaning: x.meaning,
        count: x.count,
        stages: Array.from(x.stages)
      }))
      .sort((a,b) => Number(b.count || 0) - Number(a.count || 0));
  }

  function end(reason){
    clearTimer();
    stopFever();

    game.active = false;
    game.endedAt = now();

    const total = Number(game.correct || 0) + Number(game.wrong || 0);
    const accuracy = total > 0 ? Math.round(Number(game.correct || 0) / total * 100) : 0;
    const durationSec = Math.round((Number(game.endedAt || now()) - Number(game.startedAt || now())) / 1000);
    const bossDefeated = Number(game.enemyHp || 0) <= 0 || reason === "boss_defeated";

    const modeCfg = getMode(game.mode);

    const result = {
      version: VERSION,
      reason,
      bank: game.bank,
      difficulty: game.difficulty,
      mode: game.mode,
      modeLabel: modeCfg.label || game.mode,
      score: Number(game.score || 0),
      correct: Number(game.correct || 0),
      wrong: Number(game.wrong || 0),
      accuracy,
      comboMax: Number(game.comboMax || 0),
      durationSec,
      bossDefeated,
      enemyName: game.enemy && game.enemy.name,
      weakestTerms: buildWeakestTerms(),
      stageStats: game.stageStats || {},
      powerStats: game.powerStats || {},
      feverCount: game.powerStats ? Number(game.powerStats.feverCount || 0) : 0,
      shieldUsed: game.powerStats ? Number(game.powerStats.shieldUsed || 0) : 0,
      hintUsed: game.powerStats ? Number(game.powerStats.hintUsed || 0) : 0,
      laserUsed: game.powerStats ? Number(game.powerStats.laserUsed || 0) : 0,
      aiHelpUsed: Number(game.aiHelpUsed || 0),
      aiHelpLeft: Number(game.aiHelpLeft || 0),
      aiHelpPenalty: Number(game.aiHelpPenalty || 0),
      aiAssisted: Number(game.aiHelpUsed || 0) > 0
    };

    const reward = buildReward(result);
    const coach = buildCoach(result);

    if(Storage.saveSummary){
      Storage.saveSummary(result, reward, coach);
    }

    if(Storage.updateLeaderboard){
      const lb = Storage.updateLeaderboard(result, reward);
      Object.assign(result, lb || {});
    }

    log("session_end", {
      ended_at: new Date(game.endedAt).toISOString(),
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
      weakest_terms_json: JSON.stringify(result.weakestTerms || []),
      stage_stats_json: JSON.stringify(result.stageStats || {}),
      power_stats_json: JSON.stringify(result.powerStats || {}),
      ai_help_used: result.aiHelpUsed,
      ai_assisted: result.aiAssisted ? 1 : 0
    });

    if(WIN.VocabReward && WIN.VocabReward.render){
      WIN.VocabReward.render(result, reward, coach);
      return;
    }

    if(typeof WIN.renderRewardScreenV6 === "function"){
      WIN.renderRewardScreenV6(result, reward, coach);
      return;
    }

    alert(`จบเกม! Score: ${result.score}, Accuracy: ${result.accuracy}%`);
  }

  function buildReward(result){
    let stars = 1;

    if(result.accuracy >= 70) stars = 2;
    if(result.accuracy >= 85 && result.bossDefeated) stars = 3;

    let badge = "Vocabulary Starter";

    if(stars === 2) badge = "Word Fighter";
    if(stars === 3) badge = "Boss Breaker";
    if(stars === 3 && result.comboMax >= 5) badge = "Combo Hero";
    if(stars === 3 && result.accuracy >= 95) badge = "Vocabulary Master";

    const coins =
      Math.round(Number(result.score || 0) / 10) +
      stars * 20 +
      (result.bossDefeated ? 50 : 0);

    return {
      stars,
      badge,
      coins,
      message: result.bossDefeated
        ? "คุณปราบบอสคำศัพท์ได้สำเร็จ!"
        : "จบภารกิจแล้ว ลองเพิ่มความแม่นและ Combo ในรอบต่อไป!"
    };
  }

  function buildCoach(result){
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

    if(result.feverCount >= 1){
      powerTip = "คุณทำ Combo จนเข้า Fever ได้แล้ว รอบหน้าลองรักษา Combo ให้ยาวขึ้น";
    }else if(result.comboMax >= 3){
      powerTip = "คุณเริ่มทำ Combo ได้ดีแล้ว พยายามต่อเนื่องถึง x5 เพื่อเปิด Fever Mode";
    }else{
      powerTip = "รอบหน้าลองตอบคำง่ายให้ต่อเนื่องก่อน เพื่อสะสม Hint, Shield และเปิด Fever";
    }

    const aiHelpTip = result.aiHelpUsed > 0
      ? "คุณใช้ AI Help ได้เหมาะสม รอบหน้าลองลดจำนวนครั้งลงเพื่อเพิ่มคะแนน"
      : "รอบนี้ไม่ใช้ AI Help เลย เยี่ยมมาก สามารถเพิ่มระดับความยากได้";

    return {
      headline,
      nextMode,
      reason,
      powerTip,
      aiHelpTip,
      weakestTerms: result.weakestTerms || []
    };
  }

  const API = {
    version: VERSION,
    start,
    nextQuestion,
    answerQuestion,
    timeout,
    clearTimer,
    startTimer,
    end,

    useHint,
    useAiHelp,

    startFever,
    stopFever,
    playSfx,

    buildWeakestTerms,
    buildReward,
    buildCoach
  };

  WIN.VocabGame = API;
  WIN.VOCAB_GAME = API;

  WIN.startVocabBattleV6 = start;
  WIN.nextQuestionV6 = nextQuestion;
  WIN.answerQuestionV6 = answerQuestion;
  WIN.handleTimeoutV6 = timeout;
  WIN.clearTimerV6 = clearTimer;
  WIN.startTimerV6 = startTimer;
  WIN.endVocabBattleV6 = end;
  WIN.useHintV62 = useHint;
  WIN.useAiHelpV67 = useAiHelp;
  WIN.stopFeverV62 = stopFever;
  WIN.startFeverV62 = startFever;
  WIN.playSfxV6 = playSfx;
  WIN.buildWeakestTermsV6 = buildWeakestTerms;

  console.log("[VOCAB GAME] module ready", VERSION);
})();
