/* =========================================================
   /vocab/vocab.ui.js
   TechPath Vocab Arena — UI Controller
   Version: 20260503a
   Depends on:
   - vocab.config.js
   - vocab.utils.js
   - vocab.state.js
   - vocab.question.js
   Optional:
   - vocab.storage.js
   - vocab.logger.js
========================================================= */
(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const APP =
    WIN.VocabConfig ||
    WIN.VOCAB_APP ||
    WIN.VOCAB_CONFIG ||
    {};

  const U =
    WIN.VocabUtils ||
    WIN.VOCAB_UTILS ||
    {};

  const State =
    WIN.VocabState ||
    WIN.VOCAB_STATE ||
    {};

  const Question =
    WIN.VocabQuestion ||
    WIN.VOCAB_QUESTION ||
    {};

  const Storage =
    WIN.VocabStorage ||
    WIN.VOCAB_STORAGE ||
    {};

  const Logger =
    WIN.VocabLogger ||
    WIN.VOCAB_LOGGER ||
    {};

  const game =
    State.game ||
    WIN.vocabGame ||
    {};

  function byId(id){
    return DOC.getElementById(id);
  }

  /*
    รองรับทั้งชุด id ใหม่ vocab* และ id เก่า v6*
    เพื่อให้ไม่พังถ้า html/css ยังปนกันอยู่
  */
  const IDS = {
    app: ["vocabApp", "vocabV6App"],
    menuPanel: ["vocabMenuPanel", "v6MenuPanel"],
    battlePanel: ["vocabBattlePanel", "v6BattlePanel"],
    rewardPanel: ["vocabRewardPanel", "v6RewardPanel"],

    startBtn: ["vocabStartBtn", "v6StartBtn"],

    diffPreview: ["vocabDiffPreview", "v6DiffPreview"],
    modePreview: ["vocabModePreview", "v66ModePreview"],

    displayName: ["vocabDisplayName", "v63DisplayName"],
    studentId: ["vocabStudentId", "v63StudentId"],
    section: ["vocabSection", "v63Section"],
    sessionCode: ["vocabSessionCode", "v63SessionCode"],

    score: ["vocabScore", "v6Score"],
    combo: ["vocabCombo", "v6Combo"],
    hp: ["vocabHp", "v6Hp"],
    timer: ["vocabTimer", "v6Timer"],
    questionNo: ["vocabQuestionNo", "v6QuestionNo"],
    modeHud: ["vocabModeHud", "v66ModeHud"],

    powerHud: ["vocabPowerHud", "v6PowerHud"],
    feverChip: ["vocabFeverChip", "v6FeverChip"],
    hintBtn: ["vocabHintBtn", "v6HintBtn"],
    aiHelpBtn: ["vocabAiHelpBtn", "v67AiHelpBtn"],
    shieldChip: ["vocabShieldChip", "v6ShieldChip"],
    laserChip: ["vocabLaserChip", "v6LaserChip"],

    stageChip: ["vocabStageChip", "v6StageChip"],
    stageGoal: ["vocabStageGoal", "v6StageGoal"],

    bankLabel: ["vocabBankLabel", "v6BankLabel"],
    enemyAvatar: ["vocabEnemyAvatar", "v6EnemyAvatar"],
    enemyName: ["vocabEnemyName", "v6EnemyName"],
    enemySkill: ["vocabEnemySkill", "v6EnemySkill"],
    enemyHpText: ["vocabEnemyHpText", "v6EnemyHpText"],
    enemyHpFill: ["vocabEnemyHpFill", "v6EnemyHpFill"],

    questionText: ["vocabQuestionText", "v6QuestionText"],
    aiHelpBox: ["vocabAiHelpBox", "v67AiHelpBox"],
    choices: ["vocabChoices", "v6Choices"],
    explainBox: ["vocabExplainBox", "v6ExplainBox"],

    leaderboardBox: ["vocabLeaderboardBox", "v68LeaderboardBox"]
  };

  function get(idKey){
    const list = IDS[idKey] || [idKey];

    for(const id of list){
      const el = byId(id);
      if(el) return el;
    }

    return null;
  }

  function getAllSelectors(newSelector, oldSelector){
    const out = [];

    DOC.querySelectorAll(newSelector).forEach(x => out.push(x));

    if(oldSelector){
      DOC.querySelectorAll(oldSelector).forEach(x => {
        if(!out.includes(x)) out.push(x);
      });
    }

    return out;
  }

  function escapeHtml(s){
    if(U.escapeHtml) return U.escapeHtml(s);

    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setText(idKey, value){
    const el = get(idKey);
    if(el) el.textContent = String(value ?? "");
  }

  function setHtml(idKey, html){
    const el = get(idKey);
    if(el) el.innerHTML = String(html ?? "");
  }

  function show(idKey){
    const el = get(idKey);
    if(!el) return;

    el.hidden = false;
    el.style.display = "";
    el.style.pointerEvents = "auto";
  }

  function hide(idKey){
    const el = get(idKey);
    if(!el) return;

    el.hidden = true;
    el.style.display = "none";
    el.style.pointerEvents = "none";
  }

  function clearElement(idKey){
    const el = get(idKey);
    if(el) el.innerHTML = "";
  }

  function getSelectedBank(){
    return APP.selectedBank || game.bank || "A";
  }

  function getSelectedDifficulty(){
    return APP.selectedDifficulty || game.difficulty || "easy";
  }

  function getSelectedMode(){
    return APP.selectedMode || game.mode || "learn";
  }

  function getDifficultyConfig(diff){
    const d =
      APP.DIFFICULTY ||
      APP.difficulty ||
      WIN.VOCAB_DIFFICULTY ||
      {};

    return d[diff] || d.easy || {
      label: "Easy",
      totalQuestions: 8,
      timePerQuestion: 18,
      playerHp: 5
    };
  }

  function getModeConfig(modeId){
    const modes =
      APP.MODES ||
      APP.modes ||
      WIN.VOCAB_PLAY_MODES ||
      {};

    return modes[modeId || "learn"] || modes.learn || {
      id: "learn",
      label: "AI Training",
      shortLabel: "AI",
      icon: "🤖",
      description: "เรียนรู้คำศัพท์แบบค่อยเป็นค่อยไป มี Hint และคำอธิบายชัด"
    };
  }

  function getStageName(stage){
    if(!stage) return "Warm-up Round";
    return stage.name || stage.label || stage.id || "Warm-up Round";
  }

  function getStageIcon(stage){
    if(!stage) return "✨";
    return stage.icon || "✨";
  }

  function getStageGoal(stage){
    if(!stage) return "เก็บความมั่นใจ ตอบให้ถูก";
    return stage.goal || "เก็บความมั่นใจ ตอบให้ถูก";
  }

  function getStudentContext(){
    if(Storage.getStudentContext) return Storage.getStudentContext();

    const displayNameEl = get("displayName");
    const studentIdEl = get("studentId");
    const sectionEl = get("section");
    const sessionCodeEl = get("sessionCode");

    return {
      display_name: displayNameEl ? String(displayNameEl.value || "").trim() : "",
      student_id: studentIdEl ? String(studentIdEl.value || "").trim() : "",
      section: sectionEl ? String(sectionEl.value || "").trim() : "",
      session_code: sessionCodeEl ? String(sessionCodeEl.value || "").trim() : ""
    };
  }

  function saveStudentContext(){
    if(Storage.saveStudentContext) return Storage.saveStudentContext();

    try{
      const ctx = getStudentContext();
      localStorage.setItem("VOCAB_STUDENT_PROFILE", JSON.stringify({
        ...ctx,
        saved_at: new Date().toISOString()
      }));
      return ctx;
    }catch(e){
      return getStudentContext();
    }
  }

  function hydrateStudentForm(){
    if(Storage.hydrateStudentForm) return Storage.hydrateStudentForm();

    try{
      const saved = JSON.parse(localStorage.getItem("VOCAB_STUDENT_PROFILE") || "{}") || {};
      const url = new URL(location.href);

      const map = [
        ["displayName", url.searchParams.get("name") || url.searchParams.get("nick") || saved.display_name || ""],
        ["studentId", url.searchParams.get("student_id") || url.searchParams.get("sid") || url.searchParams.get("pid") || saved.student_id || ""],
        ["section", url.searchParams.get("section") || saved.section || ""],
        ["sessionCode", url.searchParams.get("session_code") || url.searchParams.get("studyId") || saved.session_code || ""]
      ];

      map.forEach(([key, value]) => {
        const el = get(key);
        if(el && value !== undefined && value !== null) el.value = value;
      });
    }catch(e){}
  }

  function validateStudentInfo(){
    const ctx = getStudentContext();

    const missing = [];

    if(!ctx.display_name) missing.push(["ชื่อเล่น / Display name", get("displayName")]);
    if(!ctx.student_id) missing.push(["รหัสนักศึกษา", get("studentId")]);
    if(!ctx.section) missing.push(["Section", get("section")]);
    if(!ctx.session_code) missing.push(["Session Code", get("sessionCode")]);

    if(missing.length){
      const first = missing[0][1];

      try{
        if(first){
          first.focus();
          first.scrollIntoView({ behavior:"smooth", block:"center" });
        }
      }catch(e){}

      toast("กรุณากรอกข้อมูลผู้เรียนให้ครบ: " + missing.map(x => x[0]).join(", "), "warn");
      return false;
    }

    return true;
  }

  function updateDifficultyPreview(){
    const el = get("diffPreview");
    if(!el) return;

    const diff = getSelectedDifficulty();
    const feel =
      Question.getDifficultyFeel
        ? Question.getDifficultyFeel(diff)
        : null;

    const fallback = {
      easy: "✨ Easy: เวลาเยอะ เหมาะกับเริ่มจำความหมาย",
      normal: "⚔️ Normal: สลับนิยาม/สถานการณ์ มีตัวเลือกหลอกมากขึ้น",
      hard: "🔥 Hard: 5 ตัวเลือก มีคำข้าม Bank และโจทย์บริบทมากขึ้น",
      challenge: "💀 Challenge: 5 ตัวเลือก ผสมหลาย Bank เวลาเร็ว และตัวหลอกหนัก"
    };

    el.textContent = (feel && feel.preview) || fallback[diff] || fallback.easy;
  }

  function updateModePreview(){
    const el = get("modePreview");
    if(!el) return;

    const mode = getModeConfig(getSelectedMode());
    el.textContent = `${mode.icon || "🤖"} ${mode.label || "AI Training"}: ${mode.description || ""}`;
  }

  function updateBankLabel(){
    const el = get("bankLabel");
    if(!el) return;

    const bank = game.bank || getSelectedBank();
    const mode = getModeConfig(game.mode || getSelectedMode());

    el.textContent = `Bank ${bank} • ${mode.icon || "🤖"} ${mode.label || "AI Training"}`;
  }

  function updateModeHud(){
    const mode = getModeConfig(game.mode || getSelectedMode());
    setText("modeHud", `${mode.icon || "🤖"} ${mode.shortLabel || mode.label || "AI"}`);
  }

  function updateSelectors(){
    const bank = getSelectedBank();
    const diff = getSelectedDifficulty();
    const mode = getSelectedMode();

    getAllSelectors("[data-vocab-bank]", "[data-v6-bank]").forEach(btn => {
      const v = btn.dataset.vocabBank || btn.dataset.v6Bank;
      btn.classList.toggle("active", v === bank);
    });

    getAllSelectors("[data-vocab-diff]", "[data-v6-diff]").forEach(btn => {
      const v = btn.dataset.vocabDiff || btn.dataset.v6Diff;
      btn.classList.toggle("active", v === diff);
    });

    getAllSelectors("[data-vocab-mode]", "[data-v6-mode]").forEach(btn => {
      const v = btn.dataset.vocabMode || btn.dataset.v6Mode;
      btn.classList.toggle("active", v === mode);
    });
  }

  function showMenuScreen(){
    if(game.timerId){
      try{ clearInterval(game.timerId); }catch(e){}
      try{ clearTimeout(game.timerId); }catch(e){}
      game.timerId = null;
    }

    game.active = false;

    show("menuPanel");
    hide("battlePanel");
    hide("rewardPanel");

    try{
      window.scrollTo({ top:0, behavior:"auto" });
    }catch(e){}
  }

  function showBattleScreen(){
    hide("menuPanel");
    show("battlePanel");
    hide("rewardPanel");

    try{
      window.scrollTo({ top:0, behavior:"auto" });
    }catch(e){}
  }

  function showRewardScreen(){
    hide("menuPanel");
    hide("battlePanel");
    show("rewardPanel");

    try{
      window.scrollTo({ top:0, behavior:"auto" });
    }catch(e){}
  }

  function updateHud(){
    const total = State.getTotalPlannedQuestions
      ? State.getTotalPlannedQuestions()
      : Array.isArray(game.stagePlan)
        ? game.stagePlan.reduce((sum, s) => sum + Number(s.count || 0), 0)
        : 0;

    setText("score", game.score || 0);
    setText("combo", `x${game.combo || 0}`);
    setText("hp", game.playerHp > 0 ? "❤️".repeat(game.playerHp) : "💔");
    setText("questionNo", `${game.globalQuestionIndex || 0}/${total || 0}`);

    const hpMax = Number(game.enemyHpMax || 0);
    const hp = Number(game.enemyHp || 0);
    const pct = hpMax ? Math.max(0, Math.min(100, hp / hpMax * 100)) : 100;

    const enemyFill = get("enemyHpFill");
    const enemyText = get("enemyHpText");

    if(enemyFill) enemyFill.style.width = `${pct}%`;
    if(enemyText) enemyText.textContent = `${Math.round(pct)}%`;

    updateBankLabel();
    updateModeHud();
    updatePowerHud();
  }

  function renderTimer(){
    const el = get("timer");
    if(!el) return;

    el.textContent = `${game.timeLeft || 0}s`;
    el.classList.toggle("danger", Number(game.timeLeft || 0) <= 3);
  }

  function updatePowerHud(){
    const feverChip = get("feverChip");
    const hintBtn = get("hintBtn");
    const aiHelpBtn = get("aiHelpBtn");
    const shieldChip = get("shieldChip");
    const laserChip = get("laserChip");
    const battlePanel = get("battlePanel");

    const feverOn = !!game.fever;

    if(feverChip){
      feverChip.textContent = feverOn ? "🔥 Fever: ON!" : "🔥 Fever: OFF";
      feverChip.classList.toggle("active", feverOn);
    }

    if(hintBtn){
      hintBtn.textContent = `💡 Hint x${game.hints || 0}`;
      hintBtn.disabled = !game.active || Number(game.hints || 0) <= 0;
    }

    if(aiHelpBtn){
      aiHelpBtn.textContent = `🤖 AI Help x${game.aiHelpLeft || 0}`;
      aiHelpBtn.disabled = !game.active || Number(game.aiHelpLeft || 0) <= 0;
    }

    if(shieldChip){
      shieldChip.textContent = `🛡️ Shield x${game.shield || 0}`;
    }

    if(laserChip){
      laserChip.textContent = game.laserReady ? "🔴 Laser: READY" : "🔴 Laser: Not ready";
      laserChip.classList.toggle("active", !!game.laserReady);
    }

    if(battlePanel){
      battlePanel.classList.toggle("fever", feverOn);
    }
  }

  function renderEnemy(){
    const enemy = game.enemy || {};

    const avatar = get("enemyAvatar");
    const name = get("enemyName");
    const skill = get("enemySkill");

    if(avatar) avatar.textContent = enemy.avatar || "👾";
    if(name) name.textContent = `${enemy.name || "Bug Slime"}${enemy.title ? " • " + enemy.title : ""}`;
    if(skill) skill.textContent = enemy.skill || "Enemy skill";
  }

  function renderStage(stage){
    const st = stage || game.currentStage || {};

    setText("stageChip", `${getStageIcon(st)} ${getStageName(st)}`);
    setText("stageGoal", `Goal: ${getStageGoal(st)}`);
  }

  function clearAiHelpBox(){
    const box = get("aiHelpBox");
    if(!box) return;

    box.hidden = true;
    box.innerHTML = "";
  }

  function renderAiHelp(html){
    const box = get("aiHelpBox");
    if(!box) return;

    box.hidden = false;
    box.innerHTML = String(html || "");
  }

  function clearExplainBox(){
    const box = get("explainBox");
    if(!box) return;

    box.hidden = true;
    box.innerHTML = "";
  }

  function renderExplain(isCorrect, question){
    const box = get("explainBox");
    if(!box) return;

    const term = question && question.correctTerm ? question.correctTerm : {};
    const word = term.term || term.word || "";
    const meaning = term.meaning || term.definition || "";

    box.hidden = false;
    box.innerHTML = isCorrect
      ? `✅ ถูกต้อง! <b>${escapeHtml(word)}</b> = ${escapeHtml(meaning)}`
      : `💡 คำตอบที่ถูกคือ <b>${escapeHtml(word)}</b> = ${escapeHtml(meaning)}`;

    clearTimeout(renderExplain._t);
    renderExplain._t = setTimeout(() => {
      if(box) box.hidden = true;
    }, isCorrect ? 900 : 1500);
  }

  function lockChoices(){
    DOC.querySelectorAll(".vocab-choice, .v6-choice").forEach(btn => {
      btn.disabled = true;
    });
  }

  function revealCorrectChoice(question){
    const correctText =
      Question.getCorrectChoiceText
        ? Question.getCorrectChoiceText(question || game.currentQuestion)
        : "";

    DOC.querySelectorAll(".vocab-choice, .v6-choice").forEach(btn => {
      const text = btn.textContent || "";
      if(correctText && text.includes(correctText)){
        btn.classList.add("correct");
      }
    });
  }

  function renderQuestion(question, stage){
    if(!question) return;

    showBattleScreen();

    game.currentQuestion = question;
    if(stage) game.currentStage = stage;

    renderStage(stage || game.currentStage);
    renderEnemy();
    clearAiHelpBox();
    clearExplainBox();

    const questionText = get("questionText");
    const choicesBox = get("choices");

    if(questionText){
      const hintText =
        question.answerMode === "meaning"
          ? "เลือกความหมายที่ถูกต้อง"
          : "เลือกคำศัพท์ที่เหมาะกับสถานการณ์";

      questionText.innerHTML = `
        <span class="vocab-question-main v6-question-main">${escapeHtml(question.prompt)}</span>
        <small class="vocab-question-hint v6-question-hint">${escapeHtml(hintText)}</small>
      `;
    }

    if(choicesBox){
      choicesBox.innerHTML = "";

      (question.choices || []).forEach((choice, index) => {
        const btn = DOC.createElement("button");

        /*
          ใส่ทั้ง class ใหม่และเก่า เพื่อให้ CSS เดิม/ใหม่ทำงานทั้งคู่
        */
        btn.className = "vocab-choice v6-choice";
        btn.type = "button";
        btn.dataset.choiceIndex = String(index);

        btn.innerHTML = `
          <span style="opacity:.72; margin-right:8px;">${String.fromCharCode(65 + index)}.</span>
          <span>${escapeHtml(choice.text)}</span>
        `;

        btn.addEventListener("click", () => {
          if(WIN.VocabGame && WIN.VocabGame.answerQuestion){
            WIN.VocabGame.answerQuestion(choice, btn);
            return;
          }

          if(typeof WIN.answerQuestionV6 === "function"){
            WIN.answerQuestionV6(choice, btn);
          }
        });

        choicesBox.appendChild(btn);
      });
    }

    updateHud();
  }

  function showStageIntro(stage){
    floatingText(`${getStageIcon(stage)} ${getStageName(stage)}`, "stage");
  }

  function floatingText(text, type){
    const fx = DOC.createElement("div");
    fx.className = `vocab-float v6-float ${type || "good"}`;
    fx.textContent = String(text || "");

    DOC.body.appendChild(fx);

    setTimeout(() => {
      try{ fx.remove(); }catch(e){}
    }, 900);
  }

  function toast(text, type){
    let box = byId("vocabToast");

    if(!box){
      box = DOC.createElement("div");
      box.id = "vocabToast";
      box.className = "vocab-toast";
      DOC.body.appendChild(box);
    }

    box.textContent = String(text || "");
    box.classList.remove("good", "warn", "bad");
    box.classList.add(type || "good");
    box.hidden = false;

    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      if(box) box.hidden = true;
    }, 2600);
  }

  function addEnemyHitFx(){
    const card = DOC.querySelector(".vocab-enemy-card, .v6-enemy-card");
    if(!card) return;

    card.classList.remove("hit");
    void card.offsetWidth;
    card.classList.add("hit");

    setTimeout(() => card.classList.remove("hit"), 320);
  }

  function addBossAttackFx(){
    const enemy = DOC.querySelector(".vocab-enemy-card, .v6-enemy-card");
    const qCard = DOC.querySelector(".vocab-question-card, .v6-question-card");

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

  function createLaser(){
    const beam = DOC.createElement("div");
    beam.className = "vocab-laser-beam v6-laser-beam";
    DOC.body.appendChild(beam);
    setTimeout(() => beam.remove(), 480);
  }

  function createBurst(){
    const burst = DOC.createElement("div");
    burst.className = "vocab-fx-burst v6-fx-burst";
    DOC.body.appendChild(burst);
    setTimeout(() => burst.remove(), 560);
  }

  function renderLeaderboard(mode){
    if(Storage.renderLeaderboard){
      return Storage.renderLeaderboard(mode);
    }

    const box = get("leaderboardBox");
    if(!box) return;

    let board = {};
    try{
      board = JSON.parse(localStorage.getItem("VOCAB_LEADERBOARD") || "{}") || {};
    }catch(e){
      board = {};
    }

    const modeId = mode || getSelectedMode() || "learn";
    const rows = board[modeId] || [];
    const modeCfg = getModeConfig(modeId);

    if(!rows.length){
      box.innerHTML = `<div class="vocab-lb-empty v68-lb-empty">${modeCfg.icon || "🏆"} ${escapeHtml(modeCfg.label || modeId)}: ยังไม่มีคะแนนในโหมดนี้</div>`;
      return;
    }

    box.innerHTML = rows.slice(0, 5).map((r, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "#" + (index + 1);

      return `
        <div class="vocab-lb-row v68-lb-row">
          <div class="vocab-rank v68-rank">${medal}</div>
          <div class="vocab-lb-name v68-lb-name">
            <b>${escapeHtml(r.display_name || "Hero")}</b>
            <small>${escapeHtml(r.bank || "")} • ${escapeHtml(r.difficulty || "")}</small>
          </div>
          <div class="vocab-lb-score v68-lb-score">${Number(r.fair_score || r.score || 0)}</div>
          <div class="v68-hide-mobile"><span class="vocab-lb-chip v68-lb-chip">${Number(r.accuracy || 0)}%</span></div>
          <div class="v68-hide-mobile">
            ${Number(r.ai_assisted || 0)
              ? `<span class="vocab-lb-chip v68-lb-chip assisted">🤖 Assisted</span>`
              : `<span class="vocab-lb-chip v68-lb-chip">🏅 No Help</span>`}
          </div>
        </div>
      `;
    }).join("");
  }

  function bindMenuEvents(){
    getAllSelectors("[data-vocab-bank]", "[data-v6-bank]").forEach(btn => {
      if(btn.__vocabBoundBank) return;
      btn.__vocabBoundBank = true;

      btn.addEventListener("click", () => {
        const bank = btn.dataset.vocabBank || btn.dataset.v6Bank || "A";
        APP.selectedBank = bank;
        if(WIN.VOCAB_APP) WIN.VOCAB_APP.selectedBank = bank;

        updateSelectors();
        updateBankLabel();

        if(Logger.log){
          Logger.log("select_bank", { bank });
        }
      });
    });

    getAllSelectors("[data-vocab-diff]", "[data-v6-diff]").forEach(btn => {
      if(btn.__vocabBoundDiff) return;
      btn.__vocabBoundDiff = true;

      btn.addEventListener("click", () => {
        const diff = btn.dataset.vocabDiff || btn.dataset.v6Diff || "easy";
        APP.selectedDifficulty = diff;
        if(WIN.VOCAB_APP) WIN.VOCAB_APP.selectedDifficulty = diff;

        updateSelectors();
        updateDifficultyPreview();

        if(Logger.log){
          Logger.log("select_difficulty", { difficulty: diff });
        }
      });
    });

    getAllSelectors("[data-vocab-mode]", "[data-v6-mode]").forEach(btn => {
      if(btn.__vocabBoundMode) return;
      btn.__vocabBoundMode = true;

      btn.addEventListener("click", () => {
        const mode = btn.dataset.vocabMode || btn.dataset.v6Mode || "learn";
        APP.selectedMode = mode;
        if(WIN.VOCAB_APP) WIN.VOCAB_APP.selectedMode = mode;

        updateSelectors();
        updateModePreview();
        updateBankLabel();
        renderLeaderboard(mode);

        if(Logger.log){
          Logger.log("select_mode", { mode });
        }
      });
    });

    getAllSelectors("[data-lb-mode]").forEach(btn => {
      if(btn.__vocabBoundLb) return;
      btn.__vocabBoundLb = true;

      btn.addEventListener("click", () => {
        const mode = btn.dataset.lbMode || "learn";

        getAllSelectors("[data-lb-mode]").forEach(x => {
          x.classList.toggle("active", x === btn);
        });

        renderLeaderboard(mode);
      });
    });

    const startBtn = get("startBtn");

    if(startBtn && !startBtn.__vocabBoundStart){
      startBtn.__vocabBoundStart = true;

      startBtn.addEventListener("click", () => {
        if(!validateStudentInfo()) return;

        saveStudentContext();

        const options = {
          bank: getSelectedBank(),
          difficulty: getSelectedDifficulty(),
          mode: getSelectedMode()
        };

        if(WIN.VocabGame && WIN.VocabGame.start){
          WIN.VocabGame.start(options);
          return;
        }

        if(typeof WIN.startVocabBattleV6 === "function"){
          WIN.startVocabBattleV6(options);
          return;
        }

        console.error("[VOCAB UI] VocabGame.start not found");
        toast("ยังโหลด game module ไม่ครบ: ไม่พบ VocabGame.start", "bad");
      });
    }

    const hintBtn = get("hintBtn");

    if(hintBtn && !hintBtn.__vocabBoundHint){
      hintBtn.__vocabBoundHint = true;

      hintBtn.addEventListener("click", () => {
        if(WIN.VocabGame && WIN.VocabGame.useHint){
          WIN.VocabGame.useHint();
          return;
        }

        if(typeof WIN.useHintV62 === "function"){
          WIN.useHintV62();
        }
      });
    }

    const aiBtn = get("aiHelpBtn");

    if(aiBtn && !aiBtn.__vocabBoundAi){
      aiBtn.__vocabBoundAi = true;

      aiBtn.addEventListener("click", () => {
        if(WIN.VocabGame && WIN.VocabGame.useAiHelp){
          WIN.VocabGame.useAiHelp();
          return;
        }

        if(typeof WIN.useAiHelpV67 === "function"){
          WIN.useAiHelpV67();
        }
      });
    }

    ["displayName", "studentId", "section", "sessionCode"].forEach(key => {
      const el = get(key);
      if(!el || el.__vocabBoundInput) return;
      el.__vocabBoundInput = true;

      el.addEventListener("input", () => {
        saveStudentContext();
        renderLeaderboard(getSelectedMode());
      });
    });
  }

  function boot(){
    hydrateStudentForm();
    bindMenuEvents();
    updateSelectors();
    updateDifficultyPreview();
    updateModePreview();
    updateBankLabel();
    updateModeHud();
    updatePowerHud();
    renderLeaderboard("learn");
    showMenuScreen();

    console.log("[VOCAB UI] loaded", UI.version);
  }

  const UI = {
    version: "vocab-ui-20260503a",

    ids: IDS,
    get,
    show,
    hide,
    setText,
    setHtml,
    clearElement,

    getStudentContext,
    saveStudentContext,
    hydrateStudentForm,
    validateStudentInfo,

    getSelectedBank,
    getSelectedDifficulty,
    getSelectedMode,
    getDifficultyConfig,
    getModeConfig,

    updateSelectors,
    updateDifficultyPreview,
    updateModePreview,
    updateBankLabel,
    updateModeHud,

    showMenuScreen,
    showBattleScreen,
    showRewardScreen,

    updateHud,
    renderTimer,
    updatePowerHud,
    renderEnemy,
    renderStage,
    renderQuestion,
    renderExplain,
    renderAiHelp,
    clearAiHelpBox,
    clearExplainBox,

    lockChoices,
    revealCorrectChoice,

    showStageIntro,
    floatingText,
    toast,
    addEnemyHitFx,
    addBossAttackFx,
    createLaser,
    createBurst,

    renderLeaderboard,
    bindMenuEvents,
    boot
  };

  WIN.VocabUI = UI;
  WIN.VOCAB_UI = UI;

  /*
    Alias สำหรับโค้ดเก่า
  */
  WIN.byId = WIN.byId || byId;
  WIN.setTextV6 = setText;
  WIN.hideEl = function(id, hidden){
    const el = DOC.getElementById(id);
    if(el) el.hidden = !!hidden;
  };

  WIN.getStudentContextV63 = getStudentContext;
  WIN.saveStudentContextV63 = saveStudentContext;
  WIN.hydrateStudentFormV63 = hydrateStudentForm;

  WIN.getSelectedBankV6 = getSelectedBank;
  WIN.getSelectedDifficultyV6 = getSelectedDifficulty;
  WIN.getSelectedModeV66 = getSelectedMode;
  WIN.getModeConfigV66 = getModeConfig;

  WIN.updateV6DiffPreview = updateDifficultyPreview;
  WIN.updateV66ModePreview = updateModePreview;
  WIN.updateV6BankLabel = updateBankLabel;
  WIN.updateV66ModeHud = updateModeHud;

  WIN.showMenuScreenV65 = showMenuScreen;
  WIN.showBattleScreenV6 = showBattleScreen;
  WIN.backToVocabMenuV6 = showMenuScreen;

  WIN.updateHudV6 = updateHud;
  WIN.renderTimerV6 = renderTimer;
  WIN.updatePowerHudV62 = updatePowerHud;
  WIN.renderQuestionV6 = renderQuestion;
  WIN.showAnswerExplainV61 = renderExplain;
  WIN.renderAiHelpBoxV67 = renderAiHelp;
  WIN.clearAiHelpBoxV67 = clearAiHelpBox;
  WIN.lockChoicesV6 = lockChoices;
  WIN.revealCorrectChoiceV6 = revealCorrectChoice;
  WIN.showStageIntroV6 = showStageIntro;
  WIN.showFloatingTextV6 = floatingText;
  WIN.addEnemyHitFxV62 = addEnemyHitFx;
  WIN.addBossAttackFxV62 = addBossAttackFx;
  WIN.createLaserV62 = createLaser;
  WIN.createBurstV62 = createBurst;
  WIN.renderLeaderboardV68 = renderLeaderboard;

  console.log("[VOCAB UI] module ready", UI.version);
})();
