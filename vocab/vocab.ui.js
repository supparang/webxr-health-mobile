/* =========================================================
   /vocab/vocab.ui.js
   TechPath Vocab Arena — UI Controller
   PATCH v20260502b
   Fix:
   - ใช้ window.VOCAB_APP แบบปลอดภัย
   - ไม่พังถ้า config โหลดช้า/บางค่าไม่มี
   - bind menu / bank / difficulty / mode / student form / leaderboard tabs
   - รองรับ start button gate
   - ไม่ซ่อนจอผิด state
   ========================================================= */
(function(){
  "use strict";

  const W = window;
  const D = document;

  /* =========================================================
     SAFE CONFIG
  ========================================================= */

  function getApp(){
    if(W.VOCAB_APP) return W.VOCAB_APP;

    const cfg = W.VOCAB_APP_CONFIG || {};

    W.VOCAB_APP = {
      version: cfg.version || "vocab-split-ui-20260502b",

      sheetEndpoint: cfg.endpoint || W.VOCAB_SHEET_ENDPOINT || "",
      api: cfg.api || "vocab",
      source: cfg.source || "vocab.html",
      schema: cfg.schema || "vocab-split-v1",

      queueKey: cfg.storage?.queueKey || "VOCAB_SPLIT_LOG_QUEUE",
      profileKey: cfg.storage?.profileKey || "VOCAB_SPLIT_STUDENT_PROFILE",
      teacherKey: cfg.storage?.teacherKey || "VOCAB_SPLIT_TEACHER_LAST",
      leaderboardKey: cfg.storage?.leaderboardKey || "VOCAB_SPLIT_LEADERBOARD",
      lastSummaryKey: cfg.storage?.lastSummaryKey || "VOCAB_SPLIT_LAST_SUMMARY",
      soundKey: cfg.storage?.soundKey || "VOCAB_SPLIT_SOUND_ON",

      enableSheetLog: cfg.defaults?.enableSheetLog !== false,
      enableConsoleLog: cfg.defaults?.enableConsoleLog !== false,

      selectedBank: cfg.defaults?.bank || "A",
      selectedDifficulty: cfg.defaults?.difficulty || "easy",
      selectedMode: cfg.defaults?.mode || "learn"
    };

    return W.VOCAB_APP;
  }

  function getDifficultyMap(){
    return W.VOCAB_DIFFICULTY ||
      W.VOCAB_APP_CONFIG?.difficulty ||
      {
        easy:{
          label:"Easy",
          preview:"✨ Easy: 8 ข้อ เวลาเยอะ HP มาก เหมาะกับการทบทวน"
        },
        normal:{
          label:"Normal",
          preview:"⚔️ Normal: 10 ข้อ เริ่มมีแรงกดดัน และตัวเลือกหลอกดีขึ้น"
        },
        hard:{
          label:"Hard",
          preview:"🔥 Hard: 12 ข้อ HP น้อยลง ตัวเลือกยากขึ้น และต้องตอบแม่น"
        },
        challenge:{
          label:"Challenge",
          preview:"💀 Challenge: 15 ข้อ เวลาน้อย HP น้อย ตัวเลือกหลอกหนักสุด"
        }
      };
  }

  function getModeMap(){
    return W.VOCAB_PLAY_MODES ||
      W.VOCAB_APP_CONFIG?.modes ||
      {
        learn:{
          id:"learn",
          label:"AI Training",
          shortLabel:"AI",
          icon:"🤖",
          description:"เรียนรู้คำศัพท์แบบค่อยเป็นค่อยไป มี Hint และคำอธิบายชัด"
        },
        speed:{
          id:"speed",
          label:"Speed Run",
          shortLabel:"Speed",
          icon:"⚡",
          description:"ตอบให้ไว ทำ Combo เก็บคะแนน และเข้า Fever เร็ว"
        },
        mission:{
          id:"mission",
          label:"Debug Mission",
          shortLabel:"Mission",
          icon:"🎯",
          description:"อ่านสถานการณ์จริง แล้วเลือกคำศัพท์ที่เหมาะสมที่สุด"
        },
        battle:{
          id:"battle",
          label:"Boss Battle",
          shortLabel:"Boss",
          icon:"👾",
          description:"โหมดต่อสู้เต็มระบบ มีบอส HP, Fever, Laser และ Shield"
        }
      };
  }

  function getBankMeta(){
    return W.VOCAB_BANK_META ||
      W.VOCAB_APP_CONFIG?.banks ||
      {
        A:{
          label:"Bank A",
          title:"Basic CS Words",
          desc:"คำพื้นฐานสาย Coding / Software"
        },
        B:{
          label:"Bank B",
          title:"AI / Data Words",
          desc:"คำศัพท์ AI, Data, Dashboard"
        },
        C:{
          label:"Bank C",
          title:"Workplace / Project",
          desc:"คำใช้จริงในงาน ทีม ลูกค้า และโปรเจกต์"
        }
      };
  }

  /* =========================================================
     BASIC HELPERS
  ========================================================= */

  function byId(id){
    return D.getElementById(id);
  }

  function qsa(sel, root){
    return Array.from((root || D).querySelectorAll(sel));
  }

  function qs(sel, root){
    return (root || D).querySelector(sel);
  }

  function setText(id, value){
    const el = byId(id);
    if(el) el.textContent = String(value ?? "");
  }

  function setHtml(id, html){
    const el = byId(id);
    if(el) el.innerHTML = String(html ?? "");
  }

  function hideEl(id, hidden){
    const el = byId(id);
    if(!el) return;
    el.hidden = !!hidden;
    el.style.display = hidden ? "none" : "";
    el.style.pointerEvents = hidden ? "none" : "auto";
  }

  function esc(s){
    if(typeof W.escapeHtmlV6 === "function") return W.escapeHtmlV6(s);

    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
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
      console.warn("[VOCAB UI] writeJson failed", key, e);
      return false;
    }
  }

  function getParam(name, fallback){
    try{
      const url = new URL(location.href);
      return url.searchParams.get(name) || fallback || "";
    }catch(e){
      return fallback || "";
    }
  }

  function normalizeMode(mode){
    mode = String(mode || "learn").toLowerCase();
    const modes = getModeMap();
    return modes[mode] ? mode : "learn";
  }

  function normalizeDiff(diff){
    diff = String(diff || "easy").toLowerCase();
    const map = getDifficultyMap();
    return map[diff] ? diff : "easy";
  }

  function normalizeBank(bank){
    bank = String(bank || "A").toUpperCase();
    const meta = getBankMeta();
    return meta[bank] ? bank : "A";
  }

  /* =========================================================
     SELECTED STATE
  ========================================================= */

  function getSelectedBank(){
    const app = getApp();
    app.selectedBank = normalizeBank(app.selectedBank || "A");
    return app.selectedBank;
  }

  function getSelectedDifficulty(){
    const app = getApp();
    app.selectedDifficulty = normalizeDiff(app.selectedDifficulty || "easy");
    return app.selectedDifficulty;
  }

  function getSelectedMode(){
    const app = getApp();
    app.selectedMode = normalizeMode(app.selectedMode || "learn");
    return app.selectedMode;
  }

  function setSelectedBank(bank){
    const app = getApp();
    app.selectedBank = normalizeBank(bank);
    return app.selectedBank;
  }

  function setSelectedDifficulty(diff){
    const app = getApp();
    app.selectedDifficulty = normalizeDiff(diff);
    return app.selectedDifficulty;
  }

  function setSelectedMode(mode){
    const app = getApp();
    app.selectedMode = normalizeMode(mode);
    return app.selectedMode;
  }

  function getModeConfig(mode){
    const modes = getModeMap();
    mode = normalizeMode(mode || getSelectedMode());
    return modes[mode] || modes.learn;
  }

  function getDifficultyConfig(diff){
    const map = getDifficultyMap();
    diff = normalizeDiff(diff || getSelectedDifficulty());
    return map[diff] || map.easy;
  }

  /* =========================================================
     STUDENT CONTEXT
  ========================================================= */

  function getInputValue(id){
    const el = byId(id);
    return el ? String(el.value || "").trim() : "";
  }

  function setInputValue(id, value){
    const el = byId(id);
    if(el && value !== undefined && value !== null){
      el.value = String(value);
    }
  }

  function getStudentContext(){
    const app = getApp();
    const saved = readJson(app.profileKey, {});

    const displayName =
      getInputValue("v63DisplayName") ||
      getParam("name") ||
      getParam("nick") ||
      saved.display_name ||
      saved.displayName ||
      "Hero";

    const studentId =
      getInputValue("v63StudentId") ||
      getParam("student_id") ||
      getParam("studentId") ||
      getParam("sid") ||
      getParam("pid") ||
      saved.student_id ||
      saved.studentId ||
      "anon";

    const section =
      getInputValue("v63Section") ||
      getParam("section") ||
      saved.section ||
      "";

    const sessionCode =
      getInputValue("v63SessionCode") ||
      getParam("session_code") ||
      getParam("sessionCode") ||
      getParam("studyId") ||
      saved.session_code ||
      saved.sessionCode ||
      "";

    return {
      display_name: displayName,
      student_id: studentId,
      section,
      session_code: sessionCode
    };
  }

  function saveStudentContext(){
    const app = getApp();
    const ctx = getStudentContext();

    writeJson(app.profileKey, {
      ...ctx,
      saved_at: new Date().toISOString()
    });

    return ctx;
  }

  function hydrateStudentForm(){
    const app = getApp();
    const saved = readJson(app.profileKey, {});

    setInputValue(
      "v63DisplayName",
      getParam("name") ||
      getParam("nick") ||
      saved.display_name ||
      saved.displayName ||
      ""
    );

    setInputValue(
      "v63StudentId",
      getParam("student_id") ||
      getParam("studentId") ||
      getParam("sid") ||
      getParam("pid") ||
      saved.student_id ||
      saved.studentId ||
      ""
    );

    setInputValue(
      "v63Section",
      getParam("section") ||
      saved.section ||
      ""
    );

    setInputValue(
      "v63SessionCode",
      getParam("session_code") ||
      getParam("sessionCode") ||
      getParam("studyId") ||
      saved.session_code ||
      saved.sessionCode ||
      ""
    );
  }

  function isDemoMode(){
    try{
      const p = new URL(location.href).searchParams;
      return p.get("demo") === "1" || p.get("qa") === "1" || p.get("debug") === "1";
    }catch(e){
      return false;
    }
  }

  function validateStudentInfoBeforeStart(){
    if(isDemoMode()) return true;

    const missing = [];

    const fields = [
      ["ชื่อเล่น / Display name", byId("v63DisplayName"), getInputValue("v63DisplayName")],
      ["รหัสนักศึกษา", byId("v63StudentId"), getInputValue("v63StudentId")],
      ["Section", byId("v63Section"), getInputValue("v63Section")],
      ["Session Code", byId("v63SessionCode"), getInputValue("v63SessionCode")]
    ];

    fields.forEach(([label, el, value]) => {
      if(!value) missing.push([label, el]);
    });

    if(!missing.length){
      saveStudentContext();
      return true;
    }

    const first = missing[0][1];

    try{
      first.focus();
      first.scrollIntoView({ behavior:"smooth", block:"center" });
    }catch(e){}

    showToast(
      "กรุณากรอกข้อมูลผู้เรียนให้ครบก่อนเริ่มเกม: " +
      missing.map(x => x[0]).join(", "),
      "warn"
    );

    return false;
  }

  /* =========================================================
     SCREEN STATE
  ========================================================= */

  function showMenuScreen(){
    hideEl("v6MenuPanel", false);
    hideEl("v6BattlePanel", true);
    hideEl("v6RewardPanel", true);

    const menu = byId("v6MenuPanel");
    if(menu){
      menu.style.display = "";
      menu.style.pointerEvents = "auto";
    }

    try{
      window.scrollTo({ top:0, behavior:"auto" });
    }catch(e){}
  }

  function showBattleScreen(){
    hideEl("v6MenuPanel", true);
    hideEl("v6BattlePanel", false);
    hideEl("v6RewardPanel", true);

    const battle = byId("v6BattlePanel");
    if(battle){
      battle.style.display = "";
      battle.style.pointerEvents = "auto";
    }

    try{
      window.scrollTo({ top:0, behavior:"auto" });
    }catch(e){}
  }

  function showRewardScreen(){
    hideEl("v6MenuPanel", true);
    hideEl("v6BattlePanel", true);
    hideEl("v6RewardPanel", false);

    const reward = byId("v6RewardPanel");
    if(reward){
      reward.style.display = "block";
      reward.style.pointerEvents = "auto";
    }

    try{
      window.scrollTo({ top:0, behavior:"auto" });
    }catch(e){}
  }

  function backToMenu(){
    try{
      if(W.vocabGame){
        W.vocabGame.active = false;
      }

      if(typeof W.clearTimerV6 === "function") W.clearTimerV6();
      if(typeof W.stopFeverV62 === "function") W.stopFeverV62();
    }catch(e){}

    showMenuScreen();

    if(typeof W.renderLeaderboardV68 === "function"){
      W.renderLeaderboardV68(getSelectedMode());
    }
  }

  /* =========================================================
     UI UPDATES
  ========================================================= */

  function syncActiveButtons(){
    const bank = getSelectedBank();
    const diff = getSelectedDifficulty();
    const mode = getSelectedMode();

    qsa("[data-v6-bank]").forEach(btn => {
      btn.classList.toggle("active", String(btn.dataset.v6Bank || "").toUpperCase() === bank);
    });

    qsa("[data-v6-diff]").forEach(btn => {
      btn.classList.toggle("active", String(btn.dataset.v6Diff || "").toLowerCase() === diff);
    });

    qsa("[data-v6-mode]").forEach(btn => {
      btn.classList.toggle("active", String(btn.dataset.v6Mode || "").toLowerCase() === mode);
    });
  }

  function updateDiffPreview(){
    const el = byId("v6DiffPreview");
    if(!el) return;

    const diff = getSelectedDifficulty();
    const cfg = getDifficultyConfig(diff);

    el.textContent = cfg.preview || `${cfg.label || diff}: พร้อมเริ่มเล่น`;
  }

  function updateModePreview(){
    const el = byId("v66ModePreview");
    if(!el) return;

    const mode = getModeConfig(getSelectedMode());
    el.textContent = `${mode.icon || "🎮"} ${mode.label || "Mode"}: ${mode.description || ""}`;
  }

  function updateBankLabel(){
    const el = byId("v6BankLabel");
    if(!el) return;

    const game = W.vocabGame || {};
    const bank = normalizeBank(game.bank || getSelectedBank());
    const mode = getModeConfig(game.mode || getSelectedMode());

    el.textContent = `Bank ${bank} • ${mode.icon || "🎮"} ${mode.label || mode.id || "Mode"}`;
  }

  function updateModeHud(){
    const el = byId("v66ModeHud");
    if(!el) return;

    const game = W.vocabGame || {};
    const mode = getModeConfig(game.mode || getSelectedMode());

    el.textContent = `${mode.icon || "🎮"} ${mode.shortLabel || mode.label || "Mode"}`;
  }

  function updateHeroTitle(){
    const cfg = W.VOCAB_APP_CONFIG || {};
    const h1 = qs(".v6-hero-card h1");
    const subtitle = qs(".v6-subtitle");

    if(h1 && cfg.publicTitle){
      h1.textContent = cfg.publicTitle;
    }

    if(subtitle && cfg.publicSubtitle){
      subtitle.textContent = "ฝึกศัพท์สาย CS/AI สำหรับนักศึกษาปี 2 ผ่านโหมดท้าทายและระบบ AI Learning";
    }
  }

  function updateAllStaticUi(){
    syncActiveButtons();
    updateDiffPreview();
    updateModePreview();
    updateBankLabel();
    updateModeHud();
    updateHeroTitle();
  }

  /* =========================================================
     HUD HELPERS USED BY GAME
  ========================================================= */

  function updateHud(){
    const game = W.vocabGame || {};

    setText("v6Score", game.score || 0);
    setText("v6Combo", `x${game.combo || 0}`);

    const hp = Number(game.playerHp || 0);
    setText("v6Hp", hp > 0 ? "❤️".repeat(Math.min(10, hp)) : "💔");

    const total = typeof W.getTotalPlannedQuestionsV6 === "function"
      ? W.getTotalPlannedQuestionsV6()
      : (Array.isArray(game.stagePlan) ? game.stagePlan.reduce((s, x) => s + Number(x.count || 0), 0) : 0);

    setText("v6QuestionNo", `${game.globalQuestionIndex || 0}/${total || 0}`);

    const enemyHpFill = byId("v6EnemyHpFill");
    const enemyHpText = byId("v6EnemyHpText");

    const max = Number(game.enemyHpMax || 0);
    const hpNow = Number(game.enemyHp || 0);
    const pct = max > 0 ? Math.max(0, Math.min(100, hpNow / max * 100)) : 100;

    if(enemyHpFill) enemyHpFill.style.width = `${pct}%`;
    if(enemyHpText) enemyHpText.textContent = `${Math.round(pct)}%`;

    updateBankLabel();
    updateModeHud();

    if(typeof W.updatePowerHudV62 === "function"){
      try{ W.updatePowerHudV62(); }catch(e){}
    }
  }

  function renderTimer(){
    const game = W.vocabGame || {};
    const el = byId("v6Timer");
    if(!el) return;

    const time = Number(game.timeLeft || 0);
    el.textContent = `${time}s`;
    el.classList.toggle("danger", time <= 3);
  }

  function lockChoices(){
    qsa(".v6-choice").forEach(btn => {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
    });
  }

  function unlockChoices(){
    qsa(".v6-choice").forEach(btn => {
      btn.disabled = false;
      btn.removeAttribute("aria-disabled");
    });
  }

  function getCorrectChoiceText(question){
    if(!question) return "";

    const term = question.correctTerm || {};

    if(question.answerMode === "meaning"){
      return term.meaning || term.definition || "";
    }

    return term.term || term.word || "";
  }

  function revealCorrectChoice(){
    const game = W.vocabGame || {};
    const correctText = getCorrectChoiceText(game.currentQuestion);

    if(!correctText) return;

    qsa(".v6-choice").forEach(btn => {
      const text = btn.textContent || "";
      if(text.includes(correctText)){
        btn.classList.add("correct");
      }
    });
  }

  function showAnswerExplain(isCorrect, question){
    const box = byId("v6ExplainBox");
    if(!box || !question) return;

    const word = question.correctTerm?.term || question.correctTerm?.word || "";
    const meaning = question.correctTerm?.meaning || question.correctTerm?.definition || "";

    box.hidden = false;
    box.innerHTML = isCorrect
      ? `✅ ถูกต้อง! <b>${esc(word)}</b> = ${esc(meaning)}`
      : `💡 คำตอบที่ถูกคือ <b>${esc(word)}</b> = ${esc(meaning)}`;

    clearTimeout(showAnswerExplain._t);
    showAnswerExplain._t = setTimeout(() => {
      if(box) box.hidden = true;
    }, isCorrect ? 900 : 1500);
  }

  /* =========================================================
     QUESTION RENDER
  ========================================================= */

  function clearAiHelpBox(){
    const box = byId("v67AiHelpBox");
    if(box){
      box.hidden = true;
      box.innerHTML = "";
    }
  }

  function renderQuestion(question, stage){
    const game = W.vocabGame || {};

    const panel = byId("v6BattlePanel");
    const stageChip = byId("v6StageChip");
    const stageGoal = byId("v6StageGoal");
    const enemyAvatar = byId("v6EnemyAvatar");
    const enemyName = byId("v6EnemyName");
    const enemySkill = byId("v6EnemySkill");
    const enemyHpFill = byId("v6EnemyHpFill");
    const enemyHpText = byId("v6EnemyHpText");
    const questionText = byId("v6QuestionText");
    const choicesBox = byId("v6Choices");
    const explainBox = byId("v6ExplainBox");

    if(!panel || !stageChip || !choicesBox || !questionText){
      console.warn("[VOCAB UI] battle UI not found");
      return;
    }

    showBattleScreen();

    if(explainBox){
      explainBox.hidden = true;
      explainBox.innerHTML = "";
    }

    clearAiHelpBox();

    stage = stage || game.currentStage || {
      icon:"✨",
      name:"Warm-up Round",
      goal:"เก็บความมั่นใจ ตอบให้ถูก"
    };

    stageChip.textContent = `${stage.icon || "✨"} ${stage.name || "Stage"}`;

    if(stageGoal){
      stageGoal.textContent = `Goal: ${stage.goal || "ตอบให้ถูก"}`;
    }

    if(enemyAvatar){
      enemyAvatar.textContent = game.enemy?.avatar || "👾";
    }

    if(enemyName){
      const name = game.enemy?.name || "Bug Slime";
      const title = game.enemy?.title || "Enemy";
      enemyName.textContent = `${name} • ${title}`;
    }

    if(enemySkill){
      enemySkill.textContent = game.enemy?.skill || "Enemy skill";
    }

    const max = Number(game.enemyHpMax || 100);
    const hp = Number(game.enemyHp || max);
    const pct = max > 0 ? Math.max(0, Math.min(100, hp / max * 100)) : 100;

    if(enemyHpFill) enemyHpFill.style.width = `${pct}%`;
    if(enemyHpText) enemyHpText.textContent = `${Math.round(pct)}%`;

    const prompt = question?.prompt || "Question text";
    const hint = question?.answerMode === "meaning"
      ? "เลือกความหมายที่ถูกต้อง"
      : "เลือกคำศัพท์ที่เหมาะกับสถานการณ์";

    questionText.innerHTML = `
      <span class="v6-question-main">${esc(prompt)}</span>
      <small class="v6-question-hint">${esc(hint)}</small>
    `;

    choicesBox.innerHTML = "";

    const choices = Array.isArray(question?.choices) ? question.choices : [];

    choices.forEach((choice, index) => {
      const btn = D.createElement("button");
      btn.className = "v6-choice";
      btn.type = "button";
      btn.dataset.choiceIndex = String(index);
      btn.innerHTML = `
        <span style="opacity:.72; margin-right:8px;">${String.fromCharCode(65 + index)}.</span>
        <span>${esc(choice.text)}</span>
      `;

      btn.addEventListener("click", () => {
        if(typeof W.answerQuestionV6 === "function"){
          W.answerQuestionV6(choice, btn);
        }else{
          console.warn("[VOCAB UI] answerQuestionV6 missing");
        }
      });

      choicesBox.appendChild(btn);
    });

    updateHud();
  }

  /* =========================================================
     POWER HUD
  ========================================================= */

  function updatePowerHud(){
    const game = W.vocabGame || {};
    const feverChip = byId("v6FeverChip");
    const hintBtn = byId("v6HintBtn");
    const aiHelpBtn = byId("v67AiHelpBtn");
    const shieldChip = byId("v6ShieldChip");
    const laserChip = byId("v6LaserChip");
    const battlePanel = byId("v6BattlePanel");

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

  /* =========================================================
     TOAST / FX
  ========================================================= */

  function showToast(message, type){
    let box = byId("vocabUiToast");

    if(!box){
      box = D.createElement("div");
      box.id = "vocabUiToast";
      box.style.position = "fixed";
      box.style.right = "14px";
      box.style.bottom = "14px";
      box.style.zIndex = "2147483647";
      box.style.width = "min(420px, calc(100vw - 28px))";
      box.style.padding = "14px 16px";
      box.style.borderRadius = "22px";
      box.style.border = "1px solid rgba(255,255,255,.20)";
      box.style.background = "rgba(4,10,20,.92)";
      box.style.color = "#eef7ff";
      box.style.fontWeight = "950";
      box.style.lineHeight = "1.45";
      box.style.boxShadow = "0 18px 54px rgba(0,0,0,.38)";
      box.style.backdropFilter = "blur(16px)";
      D.body.appendChild(box);
    }

    const icon = type === "warn" ? "⚠️" : type === "bad" ? "❌" : "✅";
    box.innerHTML = `${icon} ${esc(message)}`;
    box.hidden = false;

    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      if(box) box.hidden = true;
    }, 2600);
  }

  function showFloatingText(text, type){
    const fx = D.createElement("div");
    fx.className = `v6-float ${type || "good"}`;
    fx.textContent = String(text || "");

    D.body.appendChild(fx);

    setTimeout(() => {
      try{ fx.remove(); }catch(e){}
    }, 900);
  }

  function removeFx(){
    [
      ".v6-float",
      ".v6-laser-beam",
      ".v6-fx-burst",
      ".v72-announcer",
      ".v72-flash",
      ".v72-particle",
      ".v74-toast",
      "#vocabUiToast"
    ].forEach(sel => {
      qsa(sel).forEach(node => {
        try{ node.remove(); }catch(e){}
      });
    });

    D.body.classList.remove(
      "v72-screen-shake",
      "v72-hard-hit",
      "v72-boss-rage",
      "v72-fever-rainbow",
      "v73-final-lock"
    );
  }

  /* =========================================================
     LEADERBOARD MINI RENDER
  ========================================================= */

  function readLeaderboard(){
    const app = getApp();
    const key = app.leaderboardKey || "VOCAB_SPLIT_LEADERBOARD";
    return readJson(key, {
      learn: [],
      speed: [],
      mission: [],
      battle: []
    });
  }

  function saveLeaderboard(board){
    const app = getApp();
    const key = app.leaderboardKey || "VOCAB_SPLIT_LEADERBOARD";
    writeJson(key, board);
  }

  function renderLeaderboard(mode){
    mode = normalizeMode(mode || getSelectedMode());

    const box = byId("v68LeaderboardBox");
    if(!box) return;

    const board = readLeaderboard();
    const rows = Array.isArray(board[mode]) ? board[mode] : [];
    const modeCfg = getModeConfig(mode);

    if(!rows.length){
      box.innerHTML = `<div class="v68-lb-empty">${esc(modeCfg.icon || "🎮")} ${esc(modeCfg.label || mode)}: ยังไม่มีคะแนนในโหมดนี้</div>`;
      return;
    }

    const top = rows
      .slice()
      .sort((a,b) => Number(b.fair_score || b.score || 0) - Number(a.fair_score || a.score || 0))
      .slice(0, 5);

    box.innerHTML = top.map((r, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
      const score = Number(r.fair_score || r.score || 0);
      const acc = Number(r.accuracy || 0);
      const assisted = Number(r.ai_assisted || 0) ? "🤖 Assisted" : "🏅 No Help";

      return `
        <div class="v68-lb-row">
          <div class="v68-rank">${esc(medal)}</div>
          <div class="v68-lb-name">
            <b>${esc(r.display_name || "Hero")}</b>
            <small>${esc(r.bank || "")} • ${esc(r.difficulty || "")}</small>
          </div>
          <div class="v68-lb-score">${score}</div>
          <div class="v68-hide-mobile"><span class="v68-lb-chip">${acc}%</span></div>
          <div class="v68-hide-mobile"><span class="v68-lb-chip">${esc(assisted)}</span></div>
        </div>
      `;
    }).join("");
  }

  function bindLeaderboardTabs(){
    qsa("[data-lb-mode]").forEach(btn => {
      if(btn.__vocabUiBound) return;
      btn.__vocabUiBound = true;

      btn.addEventListener("click", () => {
        const mode = normalizeMode(btn.dataset.lbMode || "learn");

        qsa("[data-lb-mode]").forEach(x => {
          x.classList.toggle("active", x === btn);
        });

        renderLeaderboard(mode);
      });
    });
  }

  /* =========================================================
     BIND MENU
  ========================================================= */

  function bindBankButtons(){
    qsa("[data-v6-bank]").forEach(btn => {
      if(btn.__vocabUiBound) return;
      btn.__vocabUiBound = true;

      btn.addEventListener("click", () => {
        const bank = setSelectedBank(btn.dataset.v6Bank || "A");
        syncActiveButtons();
        updateBankLabel();

        if(typeof W.v74RenderMenu === "function"){
          try{ W.v74RenderMenu(); }catch(e){}
        }

        try{
          localStorage.setItem("VOCAB_LAST_BANK", bank);
        }catch(e){}
      });
    });
  }

  function bindDifficultyButtons(){
    qsa("[data-v6-diff]").forEach(btn => {
      if(btn.__vocabUiBound) return;
      btn.__vocabUiBound = true;

      btn.addEventListener("click", () => {
        const diff = setSelectedDifficulty(btn.dataset.v6Diff || "easy");
        syncActiveButtons();
        updateDiffPreview();

        try{
          localStorage.setItem("VOCAB_LAST_DIFFICULTY", diff);
        }catch(e){}
      });
    });
  }

  function bindModeButtons(){
    qsa("[data-v6-mode]").forEach(btn => {
      if(btn.__vocabUiBound) return;
      btn.__vocabUiBound = true;

      btn.addEventListener("click", () => {
        const mode = setSelectedMode(btn.dataset.v6Mode || "learn");
        syncActiveButtons();
        updateModePreview();
        updateBankLabel();

        try{
          localStorage.setItem("VOCAB_LAST_MODE", mode);
        }catch(e){}
      });
    });
  }

  function bindStudentInputs(){
    [
      "v63DisplayName",
      "v63StudentId",
      "v63Section",
      "v63SessionCode"
    ].forEach(inputId => {
      const el = byId(inputId);
      if(!el || el.__vocabUiBound) return;
      el.__vocabUiBound = true;

      el.addEventListener("input", () => {
        saveStudentContext();

        if(typeof W.renderLeaderboardV68 === "function"){
          try{ W.renderLeaderboardV68(getSelectedMode()); }catch(e){}
        }else{
          renderLeaderboard(getSelectedMode());
        }
      });

      el.addEventListener("change", saveStudentContext);
    });
  }

  function bindStartButton(){
    const startBtn = byId("v6StartBtn");
    if(!startBtn || startBtn.__vocabUiBound) return;

    startBtn.__vocabUiBound = true;

    startBtn.addEventListener("click", (e) => {
      if(!validateStudentInfoBeforeStart()){
        try{
          e.preventDefault();
          e.stopPropagation();
        }catch(err){}
        return false;
      }

      saveStudentContext();

      const options = {
        bank: getSelectedBank(),
        difficulty: getSelectedDifficulty(),
        mode: getSelectedMode()
      };

      removeFx();
      showBattleScreen();

      if(typeof W.startVocabBattleV6 === "function"){
        W.startVocabBattleV6(options);
      }else{
        console.error("[VOCAB UI] startVocabBattleV6 missing");
        showToast("ยังโหลดไฟล์เกมไม่ครบ: ไม่พบ startVocabBattleV6", "bad");
      }

      return true;
    });
  }

  function bindPowerButtons(){
    const hintBtn = byId("v6HintBtn");
    if(hintBtn && !hintBtn.__vocabUiBound){
      hintBtn.__vocabUiBound = true;
      hintBtn.addEventListener("click", () => {
        if(typeof W.useHintV62 === "function"){
          W.useHintV62();
        }
      });
    }

    const aiBtn = byId("v67AiHelpBtn");
    if(aiBtn && !aiBtn.__vocabUiBound){
      aiBtn.__vocabUiBound = true;
      aiBtn.addEventListener("click", () => {
        if(typeof W.useAiHelpV67 === "function"){
          W.useAiHelpV67();
        }
      });
    }
  }

  function bindAllUi(){
    bindBankButtons();
    bindDifficultyButtons();
    bindModeButtons();
    bindStudentInputs();
    bindStartButton();
    bindPowerButtons();
    bindLeaderboardTabs();
  }

  /* =========================================================
     CLEAN STUDENT MENU
  ========================================================= */

  function cleanStudentMenu(){
    const startBtn = byId("v6StartBtn");
    if(!startBtn || !startBtn.closest) return;

    const card = startBtn.closest(".v6-card");
    if(!card) return;

    const h2 = card.querySelector("h2");
    if(h2 && /ภารกิจวันนี้|เริ่มเล่น/.test(h2.textContent || "")){
      h2.textContent = "เริ่มเล่น";
    }

    const missionRow = card.querySelector(".v6-mission-row");
    if(missionRow){
      missionRow.style.display = "none";
    }

    if(!byId("vocabStartNote")){
      const note = D.createElement("p");
      note.id = "vocabStartNote";
      note.className = "v63-note";
      note.textContent = "เลือก Word Bank, ระดับ, โหมดการเล่น และกรอกข้อมูลผู้เรียนให้ครบ จากนั้นกด Start เพื่อเริ่มเกม";

      card.insertBefore(note, startBtn);
    }
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

  W.byId = W.byId || byId;
  W.setTextV6 = W.setTextV6 || setText;
  W.hideEl = W.hideEl || hideEl;
  W.escapeHtmlV6 = W.escapeHtmlV6 || esc;

  W.getSelectedBankV6 = getSelectedBank;
  W.getSelectedDifficultyV6 = getSelectedDifficulty;
  W.getSelectedModeV66 = getSelectedMode;

  W.getModeConfigV66 = getModeConfig;

  W.getStudentContextV63 = getStudentContext;
  W.saveStudentContextV63 = saveStudentContext;
  W.hydrateStudentFormV63 = hydrateStudentForm;

  W.validateStudentInfoBeforeStart = validateStudentInfoBeforeStart;

  W.updateV6DiffPreview = updateDiffPreview;
  W.updateV66ModePreview = updateModePreview;
  W.updateV6BankLabel = updateBankLabel;
  W.updateV66ModeHud = updateModeHud;
  W.updateHudV6 = updateHud;
  W.renderTimerV6 = renderTimer;
  W.lockChoicesV6 = lockChoices;
  W.unlockChoicesV6 = unlockChoices;
  W.revealCorrectChoiceV6 = revealCorrectChoice;
  W.showAnswerExplainV61 = showAnswerExplain;
  W.renderQuestionV6 = renderQuestion;

  W.showMenuScreenV65 = showMenuScreen;
  W.showBattleScreenV6 = showBattleScreen;
  W.showRewardScreenVocab = showRewardScreen;
  W.backToVocabMenuV6 = backToMenu;

  W.updatePowerHudV62 = W.updatePowerHudV62 || updatePowerHud;
  W.clearAiHelpBoxV67 = W.clearAiHelpBoxV67 || clearAiHelpBox;

  W.showFloatingTextV6 = W.showFloatingTextV6 || showFloatingText;
  W.vocabUiToast = showToast;

  W.renderLeaderboardV68 = W.renderLeaderboardV68 || renderLeaderboard;
  W.readLeaderboardV68 = W.readLeaderboardV68 || readLeaderboard;
  W.saveLeaderboardV68 = W.saveLeaderboardV68 || saveLeaderboard;

  W.initVocabV6UI = function(){
    getApp();
    hydrateStudentForm();
    bindAllUi();
    updateAllStaticUi();
    cleanStudentMenu();
    renderLeaderboard("learn");
  };

  /* =========================================================
     BOOT
  ========================================================= */

  function boot(){
    try{
      getApp();
      hydrateStudentForm();
      bindAllUi();
      updateAllStaticUi();
      cleanStudentMenu();

      if(typeof W.renderLeaderboardV68 === "function"){
        W.renderLeaderboardV68("learn");
      }else{
        renderLeaderboard("learn");
      }

      showMenuScreen();

      console.log("[VOCAB UI] loaded v20260502b");
    }catch(err){
      console.error("[VOCAB UI] boot failed", err);
      showToast("โหลด UI ไม่สำเร็จ: " + (err.message || err), "bad");
    }
  }

  if(D.readyState === "loading"){
    D.addEventListener("DOMContentLoaded", boot, { once:true });
  }else{
    boot();
  }

})();
