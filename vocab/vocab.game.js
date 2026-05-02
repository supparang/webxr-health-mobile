/* =========================================================
   /vocab/vocab.game.js
   TechPath Vocab Arena — Core Game Engine
   Version: 20260502a

   ต้องโหลดหลัง:
   - vocab.config.js
   - vocab.utils.js
   - vocab.state.js
   - vocab.data.js
   - vocab.question.js
   - vocab.ui.js

   หน้าที่:
   - เริ่มเกม
   - สร้าง stage plan
   - สร้างคำถามถัดไป
   - จับคำตอบ
   - จัดการ timeout
   - คำนวณ damage / score / HP / combo
   - จบเกมและส่ง result ไป reward
   ========================================================= */

(function(){
  "use strict";

  const U = window.VocabUtils;
  const S = window.VocabState;
  const D = window.VocabData;
  const Q = window.VocabQuestion;
  const UI = window.VocabUI;

  if(!U || !S || !D || !Q || !UI){
    console.error("[VOCAB] vocab.game.js requires utils/state/data/question/ui modules");
    return;
  }

  const Game = {};

  /* =========================================================
     INTERNAL HELPERS
  ========================================================= */

  function app(){
    return window.VOCAB_APP || {};
  }

  function game(){
    return window.vocabGame || S.game;
  }

  function difficultyConfig(diff){
    return window.VOCAB_DIFFICULTY?.[diff] || window.VOCAB_DIFFICULTY?.easy || {
      label:"Easy",
      totalQuestions:8,
      timePerQuestion:18,
      playerHp:5,
      bossMultiplier:0.8
    };
  }

  function modeConfig(mode){
    return window.VOCAB_PLAY_MODES?.[mode] || window.VOCAB_PLAY_MODES?.learn || {
      id:"learn",
      label:"AI Training",
      shortLabel:"AI",
      icon:"🤖",
      totalQuestionBonus:0,
      timeBonus:5,
      startHints:3,
      startShield:2,
      feverComboNeed:5,
      laserComboNeed:8,
      scoreMultiplier:0.9,
      stageOrder:["warmup","warmup","trap","mission"]
    };
  }

  function enemyConfig(bank){
    return window.VOCAB_ENEMIES?.[bank] || window.VOCAB_ENEMIES?.A || {
      name:"Bug Slime",
      title:"Basic Code Bug",
      avatar:"🟢",
      skill:"ตอบถูกเพื่อโจมตีบอส",
      hp:100
    };
  }

  function stages(){
    return window.VOCAB_STAGES || [
      { id:"warmup", name:"Warm-up Round", icon:"✨", goal:"เก็บความมั่นใจ ตอบให้ถูก" },
      { id:"speed", name:"Speed Round", icon:"⚡", goal:"ตอบไวเพื่อเพิ่ม Combo" },
      { id:"trap", name:"Trap Round", icon:"🧠", goal:"ระวังคำที่ความหมายใกล้กัน" },
      { id:"mission", name:"Mini Mission", icon:"🎯", goal:"ใช้คำศัพท์กับสถานการณ์จริง" },
      { id:"boss", name:"Boss Battle", icon:"👾", goal:"โจมตีบอสให้ HP หมด" }
    ];
  }

  function power(){
    return window.VOCAB_POWER || {
      feverComboNeed:5,
      laserComboNeed:7,
      feverDurationMs:8500,
      feverDamageMultiplier:1.6,
      feverScoreMultiplier:1.5,
      shieldMax:3,
      hintMax:4
    };
  }

  function aiHelpConfig(){
    return window.VOCAB_AI_HELP || {
      scorePenaltyPerUse:0.10,
      maxPenalty:0.30,
      modeBase:{ learn:3, speed:1, mission:2, battle:1, bossrush:1 },
      difficultyBonus:{ easy:1, normal:0, hard:-1, challenge:-1 }
    };
  }

  function log(type, data){
    if(typeof window.logVocabEventV6 === "function"){
      window.logVocabEventV6(type, data || {});
    }
  }

  function playSfx(type){
    if(typeof window.playSfxV6 === "function"){
      window.playSfxV6(type);
    }
  }

  function saveStudent(){
    if(typeof window.saveStudentContextV63 === "function"){
      return window.saveStudentContextV63();
    }

    return {};
  }

  /* =========================================================
     STAGE PLAN
  ========================================================= */

  Game.buildStagePlan = function buildStagePlan(totalQuestions, stageOrder){
    const allStages = stages();

    const order = Array.isArray(stageOrder) && stageOrder.length
      ? stageOrder
      : allStages.map(s => s.id);

    const selectedStages = order
      .map(id => allStages.find(s => s.id === id))
      .filter(Boolean);

    const safeTotal = Math.max(1, Number(totalQuestions || 1));
    const each = Math.floor(safeTotal / selectedStages.length);
    let remaining = safeTotal;

    return selectedStages.map((stage, index) => {
      let count = each;

      if(index < safeTotal % selectedStages.length){
        count += 1;
      }

      if(index === selectedStages.length - 1){
        count = remaining;
      }

      remaining -= count;

      return {
        ...stage,
        count: Math.max(0, count)
      };
    }).filter(stage => stage.count > 0);
  };

  Game.getTotalQuestions = function getTotalQuestions(){
    const g = game();
    return (g.stagePlan || []).reduce((sum, s) => sum + Number(s.count || 0), 0);
  };

  /* =========================================================
     POWER STATE
  ========================================================= */

  Game.calculateAiHelpStart = function calculateAiHelpStart(modeId, difficulty){
    const cfg = aiHelpConfig();
    const base = cfg.modeBase?.[modeId] ?? 1;
    const bonus = cfg.difficultyBonus?.[difficulty] ?? 0;

    return Math.max(0, base + bonus);
  };

  Game.resetPowerState = function resetPowerState(){
    const g = game();
    const m = g.modeConfig || modeConfig(g.mode);

    g.fever = false;
    g.feverUntil = 0;

    if(g.feverTimerId){
      clearTimeout(g.feverTimerId);
      clearInterval(g.feverTimerId);
    }

    g.feverTimerId = null;
    g.shield = m.startShield ?? 1;
    g.hints = m.startHints ?? 1;
    g.laserReady = false;
    g.aiHelpLeft = Game.calculateAiHelpStart(g.mode, g.difficulty);
    g.aiHelpUsed = 0;
    g.aiHelpPenalty = 0;
    g.currentAiHelpUsed = false;

    g.powerStats = {
      feverCount:0,
      shieldUsed:0,
      hintUsed:0,
      laserUsed:0,
      bossAttackCount:0
    };
  };

  Game.updatePowerHud = function updatePowerHud(){
    const g = game();

    const feverChip = UI.byId("v6FeverChip");
    const hintBtn = UI.byId("v6HintBtn");
    const aiHelpBtn = UI.byId("v67AiHelpBtn");
    const shieldChip = UI.byId("v6ShieldChip");
    const laserChip = UI.byId("v6LaserChip");
    const battlePanel = UI.byId("v6BattlePanel");

    const feverOn = !!g.fever;

    if(feverChip){
      feverChip.textContent = feverOn ? "🔥 Fever: ON!" : "🔥 Fever: OFF";
      feverChip.classList.toggle("active", feverOn);
    }

    if(hintBtn){
      hintBtn.textContent = `💡 Hint x${g.hints || 0}`;
      hintBtn.disabled = !g.active || (g.hints || 0) <= 0;
    }

    if(aiHelpBtn){
      aiHelpBtn.textContent = `🤖 AI Help x${g.aiHelpLeft || 0}`;
      aiHelpBtn.disabled = !g.active || (g.aiHelpLeft || 0) <= 0;
    }

    if(shieldChip){
      shieldChip.textContent = `🛡️ Shield x${g.shield || 0}`;
    }

    if(laserChip){
      laserChip.textContent = g.laserReady ? "🔴 Laser: READY" : "🔴 Laser: Not ready";
      laserChip.classList.toggle("active", !!g.laserReady);
    }

    if(battlePanel){
      battlePanel.classList.toggle("fever", feverOn);
    }
  };

  /* =========================================================
     GAME START
  ========================================================= */

  Game.start = function start(options = {}){
    const bank = options.bank || app().selectedBank || "A";
    const difficulty = options.difficulty || app().selectedDifficulty || "easy";
    const mode = options.mode || app().selectedMode || "learn";

    const diffCfg = difficultyConfig(difficulty);
    const mCfg = modeConfig(mode);
    const eBase = enemyConfig(bank);

    const terms = D.buildTermDeck
      ? D.buildTermDeck(bank, difficulty)
      : D.getTermsForBank(bank);

    if(!Array.isArray(terms) || terms.length < 4){
      alert("ยังไม่มีคำศัพท์เพียงพอสำหรับ Bank นี้");
      return;
    }

    saveStudent();

    const g = game();

    Game.clearTimer();
    Game.stopFever();

    S.resetGameSession({
      bank,
      difficulty,
      mode
    });

    g.sessionId = `vocab_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    g.active = true;

    g.bank = bank;
    g.difficulty = difficulty;
    g.mode = mode;
    g.modeConfig = mCfg;
    g.terms = U.shuffle(terms);

    const totalQuestions = Number(diffCfg.totalQuestions || 8) + Number(mCfg.totalQuestionBonus || 0);

    g.stagePlan = Game.buildStagePlan(totalQuestions, mCfg.stageOrder);

    g.stageIndex = 0;
    g.questionIndexInStage = 0;
    g.globalQuestionIndex = 0;

    g.score = 0;
    g.combo = 0;
    g.comboMax = 0;
    g.correct = 0;
    g.wrong = 0;
    g.playerHp = Number(diffCfg.playerHp || 5);

    g.enemy = { ...eBase };
    g.enemyHpMax = Math.round(Number(eBase.hp || 100) * Number(diffCfg.bossMultiplier || 1));
    g.enemyHp = g.enemyHpMax;

    g.mistakes = [];
    g.sessionTermUse = {};
    g.stageStats = {};
    g.startedAt = Date.now();
    g.endedAt = 0;

    stages().forEach(stage => {
      g.stageStats[stage.id] = {
        correct:0,
        wrong:0,
        responseMsTotal:0,
        count:0
      };
    });

    Game.resetPowerState();
    UI.showOnlyBattle();
    UI.updateHud();
    Game.updatePowerHud();

    log("session_start", {
      started_at:new Date(g.startedAt).toISOString(),
      total_questions:Game.getTotalQuestions(),
      enemy_name:g.enemy.name,
      enemy_hp_max:g.enemyHpMax,
      player_hp_start:g.playerHp,
      mode,
      mode_label:mCfg.label
    });

    playSfx("start");
    Game.nextQuestion();
  };

  /* =========================================================
     NEXT QUESTION
  ========================================================= */

  Game.nextQuestion = function nextQuestion(){
    const g = game();

    Game.clearTimer();

    if(!g.active) return;

    const stage = g.stagePlan[g.stageIndex];

    if(!stage){
      Game.end("completed");
      return;
    }

    g.currentStage = stage;

    if(g.questionIndexInStage >= stage.count){
      g.stageIndex += 1;
      g.questionIndexInStage = 0;

      const nextStage = g.stagePlan[g.stageIndex];

      if(!nextStage){
        Game.end("completed");
        return;
      }

      UI.floatText(`${nextStage.icon} ${nextStage.name}`, "stage");
      playSfx("stage");

      setTimeout(Game.nextQuestion, 850);
      return;
    }

    const question = Q.buildQuestion(stage);

    g.currentQuestion = question;
    g.questionStartedAt = Date.now();
    g.currentAiHelpUsed = false;

    g.questionIndexInStage += 1;
    g.globalQuestionIndex += 1;

    UI.renderQuestion(question, stage);
    Game.startTimer();

    log("question_show", {
      stage_id:stage.id,
      question_no:g.globalQuestionIndex,
      term:question.correctTerm?.term || "",
      mode:question.mode || "",
      answer_mode:question.answerMode || ""
    });
  };

  /* =========================================================
     TIMER
  ========================================================= */

  Game.clearTimer = function clearTimer(){
    const g = game();

    if(g.timerId){
      clearInterval(g.timerId);
      clearTimeout(g.timerId);
      g.timerId = null;
    }
  };

  Game.startTimer = function startTimer(){
    const g = game();
    const diffCfg = difficultyConfig(g.difficulty);
    const mCfg = g.modeConfig || modeConfig(g.mode);
    const feel = D.getDifficultyFeel ? D.getDifficultyFeel(g.difficulty) : {};

    let time = Number(diffCfg.timePerQuestion || 12);
    time += Number(mCfg.timeBonus || 0);
    time += Number(feel.timeAdd || 0);

    if(g.currentStage?.id === "speed"){
      time = Math.max(4, time - 4);
    }

    if(g.currentStage?.id === "boss"){
      time = Math.max(5, time - 3);
    }

    if(g.difficulty === "challenge" && g.currentStage?.id === "trap"){
      time = Math.max(4, time - 2);
    }

    g.timeLeft = Math.max(4, Math.round(time));
    UI.renderTimer();

    g.timerId = setInterval(() => {
      g.timeLeft -= 1;
      UI.renderTimer();

      if(g.timeLeft <= 3 && g.timeLeft > 0){
        playSfx("tick");
      }

      if(g.timeLeft <= 0){
        Game.clearTimer();
        Game.timeout();
      }
    }, 1000);
  };

  /* =========================================================
     ANSWER
  ========================================================= */

  Game.answer = function answer(choice, buttonEl){
    const g = game();

    if(!g.active || !g.currentQuestion || !g.currentStage) return;

    const question = g.currentQuestion;
    const stage = g.currentStage;
    const responseMs = Date.now() - Number(g.questionStartedAt || Date.now());
    const isCorrect = !!choice.correct;

    Game.clearTimer();
    UI.lockChoices();

    const stat = g.stageStats[stage.id] || {
      correct:0,
      wrong:0,
      responseMsTotal:0,
      count:0
    };

    g.stageStats[stage.id] = stat;
    stat.count += 1;
    stat.responseMsTotal += responseMs;

    if(isCorrect){
      Game.handleCorrect(choice, buttonEl, question, stage, responseMs, stat);
    }else{
      Game.handleWrong(choice, buttonEl, question, stage, responseMs, stat);
    }

    UI.updateHud();
    UI.showAnswerExplain(isCorrect, question);

    log("term_answer", {
      term_id:question.correctTerm?.term || "",
      term:question.correctTerm?.term || "",
      meaning:question.correctTerm?.meaning || question.correctTerm?.definition || "",
      category:question.correctTerm?.category || "",
      variant_type:question.mode || "",
      answer_mode:question.answerMode || "",
      stage_id:stage.id,
      stage_name:stage.name,
      prompt:question.prompt,
      selected:choice.text,
      is_correct:isCorrect ? 1 : 0,
      response_ms:responseMs,
      score:g.score,
      combo:g.combo,
      combo_max:g.comboMax,
      player_hp:g.playerHp,
      enemy_hp:g.enemyHp,
      fever:g.fever ? 1 : 0,
      shield_left:g.shield || 0,
      hints_left:g.hints || 0,
      laser_ready:g.laserReady ? 1 : 0,
      ai_help_used_on_question:g.currentAiHelpUsed ? 1 : 0,
      ai_help_left:g.aiHelpLeft || 0,
      ai_help_used_total:g.aiHelpUsed || 0,
      ai_help_penalty:g.aiHelpPenalty || 0
    });

    if(g.playerHp <= 0){
      setTimeout(() => Game.end("player_defeated"), 900);
      return;
    }

    if(g.enemyHp <= 0){
      setTimeout(() => Game.end("boss_defeated"), 900);
      return;
    }

    setTimeout(Game.nextQuestion, isCorrect ? 700 : 1200);
  };

  Game.handleCorrect = function handleCorrect(choice, buttonEl, question, stage, responseMs, stat){
    const g = game();

    g.correct += 1;
    g.combo += 1;
    g.comboMax = Math.max(Number(g.comboMax || 0), Number(g.combo || 0));

    stat.correct += 1;

    let damage = Game.calculateDamage({
      responseMs,
      combo:g.combo,
      stageId:stage.id,
      difficulty:g.difficulty
    });

    if(g.fever){
      damage = Math.round(damage * Number(power().feverDamageMultiplier || 1.6));
    }

    const laserDamage = Game.maybeUseLaser();
    damage += laserDamage;

    g.enemyHp = Math.max(0, Number(g.enemyHp || 0) - damage);

    const speedBonus = responseMs < 2500 ? 30 : responseMs < 5000 ? 15 : 5;
    const comboBonus = Number(g.combo || 0) * 5;

    let gainedScore = 50 + speedBonus + comboBonus + damage;

    const mCfg = g.modeConfig || modeConfig(g.mode);
    gainedScore = Math.round(gainedScore * Number(mCfg.scoreMultiplier || 1));

    if(g.fever){
      gainedScore = Math.round(gainedScore * Number(power().feverScoreMultiplier || 1.5));
    }

    if(g.currentAiHelpUsed){
      gainedScore = Math.round(gainedScore * (1 - Number(aiHelpConfig().scorePenaltyPerUse || 0.10)));
    }

    g.score += gainedScore;

    if(buttonEl) buttonEl.classList.add("correct");

    playSfx("correct");
    UI.floatText(`+${damage} HIT!`, "good");

    Game.rewardPowerByCombo();
    Game.checkFever();
  };

  Game.handleWrong = function handleWrong(choice, buttonEl, question, stage, responseMs, stat){
    const g = game();

    g.wrong += 1;
    g.combo = 0;

    stat.wrong += 1;

    if(g.fever){
      Game.stopFever();
    }

    const baseAttack = Game.calculateEnemyAttack({
      stageId:stage.id,
      difficulty:g.difficulty,
      bank:g.bank
    });

    const attack = Game.applyEnemyAttackWithShield(baseAttack);
    g.playerHp = Math.max(0, Number(g.playerHp || 0) - attack);

    g.mistakes.push({
      term:question.correctTerm?.term || "",
      meaning:question.correctTerm?.meaning || "",
      selected:choice.text,
      stageId:stage.id
    });

    if(buttonEl) buttonEl.classList.add("wrong");

    UI.revealCorrectChoice(question);

    if(attack > 0){
      UI.floatText(`-${attack} HP`, "bad");
      playSfx("wrong");
    }else{
      UI.floatText("🛡️ BLOCKED!", "stage");
      playSfx("shield");
    }
  };

  /* =========================================================
     TIMEOUT
  ========================================================= */

  Game.timeout = function timeout(){
    const g = game();

    if(!g.active || !g.currentQuestion || !g.currentStage) return;

    const question = g.currentQuestion;
    const stage = g.currentStage;

    UI.lockChoices();

    g.wrong += 1;
    g.combo = 0;

    if(g.fever){
      Game.stopFever();
    }

    const stat = g.stageStats[stage.id];

    if(stat){
      stat.wrong += 1;
      stat.count += 1;
      stat.responseMsTotal += 99999;
    }

    const baseAttack = Game.calculateEnemyAttack({
      stageId:stage.id,
      difficulty:g.difficulty,
      bank:g.bank
    });

    const finalAttack = Game.applyEnemyAttackWithShield(baseAttack);
    g.playerHp = Math.max(0, Number(g.playerHp || 0) - finalAttack);

    g.mistakes.push({
      term:question.correctTerm?.term || "",
      meaning:question.correctTerm?.meaning || "",
      selected:"TIMEOUT",
      stageId:stage.id
    });

    UI.revealCorrectChoice(question);
    UI.updateHud();

    UI.floatText(
      finalAttack > 0 ? "TIME OUT!" : "🛡️ BLOCKED!",
      finalAttack > 0 ? "bad" : "stage"
    );

    playSfx("wrong");
    UI.showAnswerExplain(false, question);

    log("term_answer", {
      term_id:question.correctTerm?.term || "",
      term:question.correctTerm?.term || "",
      meaning:question.correctTerm?.meaning || "",
      category:question.correctTerm?.category || "",
      variant_type:question.mode || "",
      answer_mode:question.answerMode || "",
      stage_id:stage.id,
      stage_name:stage.name,
      prompt:question.prompt,
      selected:"TIMEOUT",
      is_correct:0,
      response_ms:99999,
      score:g.score,
      combo:g.combo,
      combo_max:g.comboMax,
      player_hp:g.playerHp,
      enemy_hp:g.enemyHp,
      fever:g.fever ? 1 : 0,
      shield_left:g.shield || 0,
      hints_left:g.hints || 0,
      laser_ready:g.laserReady ? 1 : 0,
      ai_help_used_on_question:g.currentAiHelpUsed ? 1 : 0,
      ai_help_left:g.aiHelpLeft || 0,
      ai_help_used_total:g.aiHelpUsed || 0,
      ai_help_penalty:g.aiHelpPenalty || 0
    });

    if(g.playerHp <= 0){
      setTimeout(() => Game.end("player_defeated"), 900);
      return;
    }

    setTimeout(Game.nextQuestion, 1200);
  };

  /* =========================================================
     DAMAGE / ATTACK
  ========================================================= */

  Game.calculateDamage = function calculateDamage({ responseMs, combo, stageId, difficulty }){
    const diffCfg = difficultyConfig(difficulty);
    const feel = D.getDifficultyFeel ? D.getDifficultyFeel(difficulty) : {};

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

    damage = Math.round(
      (damage * Number(feel.damageScale || 1)) /
      Number(diffCfg.bossMultiplier || 1)
    );

    return Math.max(4, damage);
  };

  Game.calculateEnemyAttack = function calculateEnemyAttack({ stageId, difficulty, bank }){
    const feel = D.getDifficultyFeel ? D.getDifficultyFeel(difficulty || "normal") : {};

    let attack = Number(feel.attackBase || 1);

    if(stageId === "trap"){
      attack += Number(feel.attackStageBonus || 0);
    }

    if(stageId === "boss"){
      attack += Number(feel.attackStageBonus || 0) + 1;
    }

    if(bank === "C" && stageId === "boss"){
      attack += 1;
    }

    return Math.max(1, attack);
  };

  Game.applyEnemyAttackWithShield = function applyEnemyAttackWithShield(baseAttack){
    const g = game();

    let attack = Number(baseAttack || 0);
    if(attack <= 0) return 0;

    if((g.shield || 0) > 0){
      g.shield -= 1;
      g.powerStats.shieldUsed += 1;

      log("shield_block", {
        shield_left:g.shield,
        blocked_damage:attack
      });

      return 0;
    }

    g.powerStats.bossAttackCount += 1;
    return attack;
  };

  /* =========================================================
     FEVER / LASER / HINT / AI HELP
  ========================================================= */

  Game.checkFever = function checkFever(){
    const g = game();

    if(!g.active) return;

    const mCfg = g.modeConfig || modeConfig(g.mode);
    const feverNeed = Number(mCfg.feverComboNeed || power().feverComboNeed || 5);
    const laserNeed = Number(mCfg.laserComboNeed || power().laserComboNeed || 7);

    if(g.combo >= feverNeed && !g.fever){
      Game.startFever();
    }

    if(g.combo >= laserNeed && !g.laserReady){
      g.laserReady = true;
      UI.floatText("🔴 LASER READY!", "stage");
      playSfx("stage");
    }

    Game.updatePowerHud();
  };

  Game.startFever = function startFever(){
    const g = game();

    g.fever = true;
    g.feverUntil = Date.now() + Number(power().feverDurationMs || 8500);
    g.powerStats.feverCount += 1;

    UI.floatText("🔥 FEVER MODE!", "stage");
    playSfx("fever");

    if(g.feverTimerId){
      clearTimeout(g.feverTimerId);
    }

    g.feverTimerId = setTimeout(Game.stopFever, Number(power().feverDurationMs || 8500));

    Game.updatePowerHud();

    log("fever_start", {
      combo:g.combo,
      duration_ms:Number(power().feverDurationMs || 8500)
    });
  };

  Game.stopFever = function stopFever(){
    const g = game();

    g.fever = false;
    g.feverUntil = 0;

    if(g.feverTimerId){
      clearTimeout(g.feverTimerId);
      clearInterval(g.feverTimerId);
      g.feverTimerId = null;
    }

    Game.updatePowerHud();

    if(g.active){
      log("fever_end", {
        score:g.score,
        combo:g.combo
      });
    }
  };

  Game.rewardPowerByCombo = function rewardPowerByCombo(){
    const g = game();
    const combo = Number(g.combo || 0);
    const mCfg = g.modeConfig || modeConfig(g.mode);
    const laserNeed = Number(mCfg.laserComboNeed || power().laserComboNeed || 7);

    if(combo === 3){
      g.hints = Math.min(Number(power().hintMax || 4), Number(g.hints || 0) + 1);
      UI.floatText("💡 Hint +1", "stage");

      log("power_reward", {
        power:"hint",
        combo
      });
    }

    if(combo === 4){
      g.shield = Math.min(Number(power().shieldMax || 3), Number(g.shield || 0) + 1);
      UI.floatText("🛡️ Shield +1", "stage");

      log("power_reward", {
        power:"shield",
        combo
      });
    }

    if(combo === laserNeed){
      g.laserReady = true;

      log("power_reward", {
        power:"laser",
        combo
      });
    }

    Game.updatePowerHud();
  };

  Game.maybeUseLaser = function maybeUseLaser(){
    const g = game();

    if(!g.laserReady) return 0;

    g.laserReady = false;
    g.powerStats.laserUsed += 1;

    const laserDamage = g.fever ? 38 : 26;

    UI.floatText(`🔴 LASER +${laserDamage}`, "good");
    playSfx("laser");

    log("laser_used", {
      damage:laserDamage,
      fever:!!g.fever
    });

    return laserDamage;
  };

  Game.useHint = function useHint(){
    const g = game();

    if(!g.active) return;
    if((g.hints || 0) <= 0) return;

    const buttons = UI.qsa(".v6-choice:not(:disabled)");
    const correctText = Q.getCorrectChoiceText(g.currentQuestion);

    const wrongButtons = buttons.filter(btn => {
      const text = btn.textContent || "";
      return correctText && !text.includes(correctText);
    });

    if(!wrongButtons.length) return;

    const target = wrongButtons[Math.floor(U.rand() * wrongButtons.length)];
    target.disabled = true;
    target.classList.add("v6-eliminated");

    g.hints = Math.max(0, Number(g.hints || 0) - 1);
    g.powerStats.hintUsed += 1;

    UI.floatText("💡 Hint!", "stage");
    playSfx("tick");
    Game.updatePowerHud();

    log("hint_used", {
      hints_left:g.hints,
      stage_id:g.currentStage?.id || ""
    });
  };

  Game.useAiHelp = function useAiHelp(){
    const g = game();

    if(!g.active) return;
    if(!g.currentQuestion) return;
    if((g.aiHelpLeft || 0) <= 0) return;

    const cfg = aiHelpConfig();

    g.aiHelpLeft = Math.max(0, Number(g.aiHelpLeft || 0) - 1);
    g.aiHelpUsed += 1;
    g.currentAiHelpUsed = true;
    g.aiHelpPenalty = Math.min(
      Number(cfg.maxPenalty || 0.30),
      Number(g.aiHelpUsed || 0) * Number(cfg.scorePenaltyPerUse || 0.10)
    );

    const help = Q.buildAiHelpText
      ? Q.buildAiHelpText(g.currentQuestion, g.currentStage)
      : "<b>AI Help</b><br>อ่าน keyword ในโจทย์ แล้วเทียบกับความหมายของคำศัพท์";

    UI.showAiHelp(help);
    Game.updatePowerHud();
    playSfx("stage");

    log("ai_help_used", {
      ai_help_left:g.aiHelpLeft,
      ai_help_used:g.aiHelpUsed,
      ai_help_penalty:g.aiHelpPenalty,
      stage_id:g.currentStage?.id || "",
      question_mode:g.currentQuestion?.mode || "",
      answer_mode:g.currentQuestion?.answerMode || "",
      term:g.currentQuestion?.correctTerm?.term || ""
    });
  };

  /* =========================================================
     END GAME
  ========================================================= */

  Game.buildWeakestTerms = function buildWeakestTerms(){
    const g = game();
    const map = new Map();

    (g.mistakes || []).forEach(m => {
      if(!m.term) return;

      if(!map.has(m.term)){
        map.set(m.term, {
          term:m.term,
          meaning:m.meaning,
          count:0,
          stages:new Set()
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
        term:x.term,
        meaning:x.meaning,
        count:x.count,
        stages:Array.from(x.stages)
      }))
      .sort((a,b) => b.count - a.count);
  };

  Game.buildRewardData = function buildRewardData(result){
    let stars = 1;

    if(result.accuracy >= 70) stars = 2;
    if(result.accuracy >= 85 && result.bossDefeated) stars = 3;

    let badge = "Vocabulary Starter";

    if(stars === 2) badge = "Word Fighter";
    if(stars === 3) badge = "Boss Breaker";
    if(stars === 3 && result.comboMax >= 5) badge = "Combo Hero";
    if(stars === 3 && result.accuracy >= 95) badge = "Vocabulary Master";

    const coins = Math.round(Number(result.score || 0) / 10) + stars * 20 + (result.bossDefeated ? 50 : 0);

    return {
      stars,
      badge,
      coins,
      message: result.bossDefeated
        ? "คุณปราบบอสคำศัพท์ได้สำเร็จ!"
        : "บอสยังไม่ล้ม ลองแก้มืออีกครั้ง!"
    };
  };

  Game.buildCoachSummary = function buildCoachSummary(result){
    let headline = "";
    let nextMode = "";
    let reason = "";

    if(result.mode === "learn" && result.accuracy >= 75){
      nextMode = "Debug Mission";
      headline = "พื้นฐานเริ่มดีแล้ว ลองใช้คำศัพท์ในสถานการณ์จริงต่อ";
      reason = "คุณทำ Learn Mode ได้ดีพอสำหรับการฝึก context";
    }else if(result.mode === "mission" && result.accuracy >= 75){
      nextMode = "Boss Battle";
      headline = "คุณเริ่มใช้คำศัพท์ในบริบทได้ดี พร้อมลองโหมดต่อสู้";
      reason = "ผลใน Mission Mode แสดงว่าคุณเข้าใจคำในสถานการณ์จริง";
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

    if((result.feverCount || 0) >= 1){
      powerTip = "คุณทำ Combo จนเข้า Fever ได้แล้ว รอบหน้าลองรักษา Combo ให้ยาวขึ้นเพื่อยิงบอสแรงกว่าเดิม";
    }else if((result.comboMax || 0) >= 3){
      powerTip = "คุณเริ่มทำ Combo ได้ดีแล้ว พยายามต่อเนื่องถึง x5 เพื่อเปิด Fever Mode";
    }else{
      powerTip = "รอบหน้าลองตอบคำง่ายให้ต่อเนื่องก่อน เพื่อสะสม Hint, Shield และเปิด Fever";
    }

    let aiHelpTip = "";

    if((result.aiHelpUsed || 0) >= 3){
      aiHelpTip = "คุณใช้ AI Help หลายครั้ง ควรทบทวนคำศัพท์พื้นฐานหรืออ่านโจทย์ช้าลงอีกนิด";
    }else if((result.aiHelpUsed || 0) > 0){
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
      bestStage:Game.getBestStage(),
      weakestTerms:result.weakestTerms.slice(0, 5)
    };
  };

  Game.getBestStage = function getBestStage(){
    const g = game();
    let best = null;

    Object.entries(g.stageStats || {}).forEach(([stageId, stat]) => {
      const total = Number(stat.correct || 0) + Number(stat.wrong || 0);
      if(total <= 0) return;

      const acc = Number(stat.correct || 0) / total;

      if(!best || acc > best.acc){
        best = { stageId, acc };
      }
    });

    if(!best) return "Warm-up";

    const stage = stages().find(s => s.id === best.stageId);
    return stage ? stage.name : best.stageId;
  };

  Game.end = function end(reason = "completed"){
    const g = game();

    Game.clearTimer();
    Game.stopFever();

    g.active = false;
    g.endedAt = Date.now();

    const total = Number(g.correct || 0) + Number(g.wrong || 0);
    const accuracy = total > 0 ? Math.round((Number(g.correct || 0) / total) * 100) : 0;
    const durationSec = Math.round((Number(g.endedAt || Date.now()) - Number(g.startedAt || Date.now())) / 1000);
    const bossDefeated = Number(g.enemyHp || 0) <= 0 || reason === "boss_defeated";
    const mCfg = g.modeConfig || modeConfig(g.mode);

    const result = {
      version:app().version || "modular",
      reason,
      bank:g.bank,
      difficulty:g.difficulty,
      mode:g.mode,
      modeLabel:mCfg.label,
      score:g.score,
      correct:g.correct,
      wrong:g.wrong,
      accuracy,
      comboMax:g.comboMax,
      durationSec,
      bossDefeated,
      enemyName:g.enemy?.name || "",
      weakestTerms:Game.buildWeakestTerms(),
      stageStats:g.stageStats || {},
      powerStats:g.powerStats || {},
      feverCount:g.powerStats?.feverCount || 0,
      shieldUsed:g.powerStats?.shieldUsed || 0,
      hintUsed:g.powerStats?.hintUsed || 0,
      laserUsed:g.powerStats?.laserUsed || 0,
      aiHelpUsed:g.aiHelpUsed || 0,
      aiHelpLeft:g.aiHelpLeft || 0,
      aiHelpPenalty:g.aiHelpPenalty || 0,
      aiAssisted:(g.aiHelpUsed || 0) > 0
    };

    const reward = Game.buildRewardData(result);
    const coach = Game.buildCoachSummary(result);

    if(typeof window.updateLeaderboardV68 === "function"){
      const lb = window.updateLeaderboardV68(result, reward) || {};
      result.rank = lb.rank;
      result.personalBest = lb.personalBest;
      result.improvement = lb.improvement;
      result.classTopScore = lb.classTopScore;
      result.fairScore = lb.fairScore;
    }

    if(typeof window.saveLastVocabSummaryV6 === "function"){
      window.saveLastVocabSummaryV6({ result, reward, coach });
    }

    if(typeof window.saveTeacherSummaryV63 === "function"){
      window.saveTeacherSummaryV63(result, reward, coach);
    }

    if(typeof window.updateStudentProfileV63 === "function"){
      window.updateStudentProfileV63(result, reward, coach);
    }

    UI.renderReward(result, reward, coach);

    log("session_end", {
      ended_at:new Date(g.endedAt).toISOString(),
      duration_sec:result.durationSec,
      reason:result.reason,
      score:result.score,
      correct:result.correct,
      wrong:result.wrong,
      accuracy:result.accuracy,
      combo_max:result.comboMax,
      boss_defeated:result.bossDefeated ? 1 : 0,
      enemy_name:result.enemyName,
      stars:reward.stars,
      badge:reward.badge,
      coins:reward.coins,
      ai_headline:coach.headline,
      ai_next_mode:coach.nextMode,
      ai_reason:coach.reason,
      ai_power_tip:coach.powerTip || "",
      ai_best_stage:coach.bestStage,
      weakest_terms_json:JSON.stringify(result.weakestTerms || []),
      stage_stats_json:JSON.stringify(result.stageStats || {}),
      power_stats_json:JSON.stringify(result.powerStats || {}),
      ai_help_used:result.aiHelpUsed || 0,
      ai_help_left:result.aiHelpLeft || 0,
      ai_help_penalty:result.aiHelpPenalty || 0,
      ai_assisted:result.aiAssisted ? 1 : 0,
      leaderboard_rank:result.rank || "",
      fair_score:result.fairScore || result.score || 0,
      personal_best:result.personalBest || "",
      improvement:result.improvement || "",
      class_top_score:result.classTopScore || ""
    });
  };

  /* =========================================================
     BOOT / EXPORTS
  ========================================================= */

  Game.bindPowerButtons = function bindPowerButtons(){
    const hintBtn = UI.byId("v6HintBtn");
    if(hintBtn && !hintBtn.__vocabHintBound){
      hintBtn.__vocabHintBound = true;
      hintBtn.addEventListener("click", Game.useHint);
    }

    const aiBtn = UI.byId("v67AiHelpBtn");
    if(aiBtn && !aiBtn.__vocabAiBound){
      aiBtn.__vocabAiBound = true;
      aiBtn.addEventListener("click", Game.useAiHelp);
    }
  };

  window.VocabGame = Game;

  window.startVocabBattleV6 = Game.start;
  window.nextQuestionV6 = Game.nextQuestion;
  window.answerQuestionV6 = Game.answer;
  window.handleTimeoutV6 = Game.timeout;
  window.clearTimerV6 = Game.clearTimer;
  window.startTimerV6 = Game.startTimer;
  window.endVocabBattleV6 = Game.end;
  window.getTotalPlannedQuestionsV6 = Game.getTotalQuestions;

  window.resetPowerStateV62 = Game.resetPowerState;
  window.updatePowerHudV62 = Game.updatePowerHud;
  window.checkFeverV62 = Game.checkFever;
  window.startFeverV62 = Game.startFever;
  window.stopFeverV62 = Game.stopFever;
  window.useHintV62 = Game.useHint;
  window.useAiHelpV67 = Game.useAiHelp;
  window.calculateAiHelpStartV67 = Game.calculateAiHelpStart;
  window.calculateDamageV6 = Game.calculateDamage;
  window.calculateEnemyAttackV6 = Game.calculateEnemyAttack;
  window.applyEnemyAttackWithShieldV62 = Game.applyEnemyAttackWithShield;
  window.maybeUseLaserV62 = Game.maybeUseLaser;
  window.rewardPowerByComboV62 = Game.rewardPowerByCombo;
  window.buildWeakestTermsV6 = Game.buildWeakestTerms;
  window.buildRewardDataV6 = Game.buildRewardData;
  window.buildAICoachSummaryV6 = Game.buildCoachSummary;
  window.getBestStageV6 = Game.getBestStage;

  document.addEventListener("DOMContentLoaded", function(){
    Game.bindPowerButtons();
    Game.updatePowerHud();
    console.log("[VOCAB] core game engine loaded");
  });

})();
