/* =========================================================
   /vocab/vocab.ui.js
   TechPath Vocab Arena — UI Controller
   FULL CLEAN PATCH: v20260503n

   Includes:
   - window.VocabUI export
   - menu binding
   - start game binding
   - HUD update
   - question render
   - correct/wrong feedback
   - popup + score burst + combo burst
   - SFX correct/wrong
   - answer logging
   - auto next question
   - reward handoff
   - leaderboard first-page render
   - compatibility with vocab-* and old v6/v68 CSS
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const VERSION = "vocab-ui-v20260503n";

  let UI_BOUND = false;
  let CHOICE_LOCK = false;
  let LAST_START_AT = 0;
  let audioCtx = null;

  const UI_STATE = {
    questions: [],
    currentQuestion: null,
    questionIndex: 0,
    questionNo: 0,
    questionCount: 0,
    score: 0,
    combo: 0,
    comboMax: 0,
    hp: 5,
    maxHp: 5,
    correctCount: 0,
    wrongCount: 0,
    mistakes: 0,
    aiHelpUsed: 0,
    hintUsed: 0,
    startedAtMs: 0,
    ended: false
  };

  /* =========================================================
     BASIC HELPERS
  ========================================================= */

  function $(id){
    return DOC.getElementById(id);
  }

  function qs(sel, root){
    return (root || DOC).querySelector(sel);
  }

  function qsa(sel, root){
    return Array.from((root || DOC).querySelectorAll(sel));
  }

  function log(){
    try{
      console.log.apply(console, ["[VOCAB UI]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function warn(){
    try{
      console.warn.apply(console, ["[VOCAB UI]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function esc(s){
    if(WIN.VocabUtils && typeof WIN.VocabUtils.escapeHtml === "function"){
      return WIN.VocabUtils.escapeHtml(s);
    }

    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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
    const el = $(id);
    return el ? String(el.value || "").trim() : "";
  }

  function setText(id, value){
    const el = $(id);
    if(el) el.textContent = String(value ?? "");
  }

  function setHtml(id, value){
    const el = $(id);
    if(el) el.innerHTML = String(value ?? "");
  }

  function show(idOrEl){
    const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
    if(el) el.hidden = false;
  }

  function hide(idOrEl){
    const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
    if(el) el.hidden = true;
  }

  function toNum(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function toInt(v, fallback){
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : Number(fallback || 0);
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

  function bool01(v){
    if(v === true) return 1;
    if(v === false) return 0;

    const s = String(v ?? "").toLowerCase().trim();
    return ["1", "true", "yes", "y", "ok", "correct"].includes(s) ? 1 : 0;
  }

  function nowMs(){
    return Date.now();
  }

  function normalizeText(s){
    return String(s ?? "").trim();
  }

  /* =========================================================
     APP / STATE
  ========================================================= */

  function getApp(){
    WIN.VOCAB_APP = WIN.VOCAB_APP || {};
    return WIN.VOCAB_APP;
  }

  function getExternalState(){
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

    return getApp();
  }

  function getState(){
    return Object.assign({}, getApp(), getExternalState(), UI_STATE);
  }

  function patchState(update){
    update = update || {};

    Object.assign(UI_STATE, update);
    Object.assign(getApp(), update);

    try{
      if(WIN.VocabState && typeof WIN.VocabState.set === "function"){
        WIN.VocabState.set(update);
      }else if(WIN.VocabState && WIN.VocabState.state){
        Object.assign(WIN.VocabState.state, update);
      }
    }catch(e){}
  }

  function getGame(){
    return WIN.VocabGame || WIN.vocabGame || WIN.VOCAB_GAME || {};
  }

  function selectedBank(){
    const active = qs("[data-vocab-bank].active");
    const s = getState();

    return normalizeText(
      pick(
        active && active.dataset ? active.dataset.vocabBank : "",
        s.selectedBank,
        s.bank,
        getParam("bank"),
        "A"
      )
    );
  }

  function selectedDifficulty(){
    const active = qs("[data-vocab-diff].active");
    const s = getState();

    return normalizeText(
      pick(
        active && active.dataset ? active.dataset.vocabDiff : "",
        s.selectedDifficulty,
        s.difficulty,
        s.diff,
        getParam("diff"),
        getParam("difficulty"),
        "easy"
      )
    );
  }

  function selectedMode(){
    const active = qs("[data-vocab-mode].active");
    const s = getState();

    return normalizeText(
      pick(
        active && active.dataset ? active.dataset.vocabMode : "",
        s.selectedMode,
        s.mode,
        getParam("mode"),
        "learn"
      )
    );
  }

  function syncStateFromMenu(){
    const bank = selectedBank();
    const difficulty = selectedDifficulty();
    const mode = selectedMode();

    patchState({
      selectedBank: bank,
      bank: bank,
      selectedDifficulty: difficulty,
      difficulty: difficulty,
      diff: difficulty,
      selectedMode: mode,
      mode: mode
    });

    return { bank, difficulty, diff: difficulty, mode };
  }

  function syncActiveButtons(){
    const bank = selectedBank();
    const difficulty = selectedDifficulty();
    const mode = selectedMode();

    qsa("[data-vocab-bank]").forEach(function(btn){
      btn.classList.toggle("active", btn.dataset.vocabBank === bank);
    });

    qsa("[data-vocab-diff]").forEach(function(btn){
      btn.classList.toggle("active", btn.dataset.vocabDiff === difficulty);
    });

    qsa("[data-vocab-mode]").forEach(function(btn){
      btn.classList.toggle("active", btn.dataset.vocabMode === mode);
    });

    patchState({
      bank: bank,
      difficulty: difficulty,
      diff: difficulty,
      mode: mode,
      selectedBank: bank,
      selectedDifficulty: difficulty,
      selectedMode: mode
    });
  }

  /* =========================================================
     STUDENT PROFILE
  ========================================================= */

  function getStudentProfile(){
    if(WIN.VocabStorage && typeof WIN.VocabStorage.loadStudentProfile === "function"){
      try{
        return WIN.VocabStorage.loadStudentProfile();
      }catch(e){}
    }

    const saved =
      readJson("VOCAB_SPLIT_STUDENT_PROFILE", {}) ||
      readJson("VOCAB_V71_STUDENT_PROFILE", {}) ||
      {};

    return {
      display_name:
        normalizeText(
          pick(
            readInput("vocabDisplayName"),
            saved.display_name,
            saved.displayName,
            getParam("name"),
            getParam("nick"),
            "Hero"
          )
        ),

      student_id:
        normalizeText(
          pick(
            readInput("vocabStudentId"),
            saved.student_id,
            saved.studentId,
            getParam("student_id"),
            getParam("sid"),
            getParam("pid"),
            "anon"
          )
        ),

      section:
        normalizeText(
          pick(
            readInput("vocabSection"),
            saved.section,
            getParam("section"),
            ""
          )
        ),

      session_code:
        normalizeText(
          pick(
            readInput("vocabSessionCode"),
            saved.session_code,
            saved.sessionCode,
            getParam("session_code"),
            getParam("studyId"),
            ""
          )
        )
    };
  }

  function saveStudentProfile(){
    const old = getStudentProfile();

    const profile = {
      display_name:
        normalizeText(
          pick(
            readInput("vocabDisplayName"),
            old.display_name,
            getParam("name"),
            getParam("nick"),
            "Hero"
          )
        ),

      student_id:
        normalizeText(
          pick(
            readInput("vocabStudentId"),
            old.student_id,
            getParam("student_id"),
            getParam("sid"),
            getParam("pid"),
            "anon"
          )
        ),

      section:
        normalizeText(
          pick(
            readInput("vocabSection"),
            old.section,
            getParam("section"),
            ""
          )
        ),

      session_code:
        normalizeText(
          pick(
            readInput("vocabSessionCode"),
            old.session_code,
            getParam("session_code"),
            getParam("studyId"),
            ""
          )
        ),

      updated_at: new Date().toISOString()
    };

    if(WIN.VocabStorage && typeof WIN.VocabStorage.saveStudentProfile === "function"){
      try{
        return WIN.VocabStorage.saveStudentProfile(profile);
      }catch(e){}
    }

    writeJson("VOCAB_SPLIT_STUDENT_PROFILE", profile);
    writeJson("VOCAB_V71_STUDENT_PROFILE", profile);

    return profile;
  }

  function hydrateStudentForm(){
    if(WIN.VocabStorage && typeof WIN.VocabStorage.hydrateStudentForm === "function"){
      try{
        WIN.VocabStorage.hydrateStudentForm();
      }catch(e){}
    }

    const p = getStudentProfile();

    const map = {
      vocabDisplayName: p.display_name === "Hero" ? "" : p.display_name,
      vocabStudentId: p.student_id === "anon" ? "" : p.student_id,
      vocabSection: p.section || "",
      vocabSessionCode: p.session_code || ""
    };

    Object.keys(map).forEach(function(id){
      const el = $(id);
      if(el && !normalizeText(el.value)){
        el.value = map[id];
      }
    });

    [
      "vocabDisplayName",
      "vocabStudentId",
      "vocabSection",
      "vocabSessionCode"
    ].forEach(function(id){
      const el = $(id);
      if(!el || el.__vocabUiProfileBound) return;

      el.__vocabUiProfileBound = true;
      el.addEventListener("input", function(){
        saveStudentProfile();
      });
    });
  }

  /* =========================================================
     CSS COMPAT + FX CSS
  ========================================================= */

  function applyClassAliases(){
    const map = [
      ["vocab-app", "v6-app"],
      ["vocab-screen", "v6-screen"],
      ["vocab-menu-screen", "v6-menu-screen"],
      ["vocab-battle-panel", "v6-battle-panel"],

      ["vocab-hero-card", "v6-hero-card"],
      ["vocab-logo", "v6-logo"],
      ["vocab-kicker", "v6-kicker"],
      ["vocab-subtitle", "v6-subtitle"],

      ["vocab-menu-grid", "v6-menu-grid"],
      ["vocab-card", "v6-card"],
      ["vocab-wide", "v6-wide"],

      ["vocab-bank-grid", "v6-bank-grid"],
      ["vocab-select-card", "v6-select-card"],

      ["vocab-level-grid", "v6-level-grid"],
      ["vocab-pill", "v6-pill"],
      ["vocab-preview", "v6-diff-preview"],

      ["vocab-mode-grid", "v66-mode-grid"],
      ["vocab-mode-card", "v66-mode-card"],

      ["vocab-student-grid", "v63-student-grid"],
      ["vocab-input", "v63-input"],
      ["vocab-note", "v63-note"],

      ["vocab-start-btn", "v6-start-btn"],

      ["vocab-lb-tabs", "v68-lb-tabs"],
      ["vocab-lb-tab", "v68-lb-tab"],
      ["vocab-lb-box", "v68-lb-box"],
      ["vocab-lb-empty", "v68-lb-empty"],
      ["vocab-lb-row", "v68-lb-row"],
      ["vocab-rank", "v68-rank"],
      ["vocab-lb-name", "v68-lb-name"],
      ["vocab-lb-score", "v68-lb-score"],
      ["vocab-lb-chip", "v68-lb-chip"],
      ["vocab-personal-best", "v68-personal-best"],

      ["vocab-top-hud", "v6-top-hud"],
      ["vocab-hud-box", "v6-hud-box"],

      ["vocab-power-hud", "v6-power-hud"],
      ["vocab-power-chip", "v6-power-chip"],
      ["vocab-power-btn", "v6-power-btn"],
      ["vocab-ai-help-btn", "v67-ai-help-btn"],

      ["vocab-stage-line", "v6-stage-line"],
      ["vocab-stage-chip", "v6-stage-chip"],
      ["vocab-stage-goal", "v6-stage-goal"],

      ["vocab-battle-layout", "v6-battle-layout"],
      ["vocab-enemy-card", "v6-enemy-card"],
      ["vocab-enemy-glow", "v6-enemy-glow"],
      ["vocab-enemy-avatar", "v6-enemy-avatar"],

      ["vocab-hp-label", "v6-hp-label"],
      ["vocab-hp-bar", "v6-hp-bar"],
      ["vocab-hp-fill", "v6-hp-fill"],
      ["vocab-boss-note", "v6-boss-note"],

      ["vocab-question-card", "v6-question-card"],
      ["vocab-question-meta", "v6-question-meta"],
      ["vocab-question-text", "v6-question-text"],
      ["vocab-choices", "v6-choices"],
      ["vocab-choice", "v6-choice"],
      ["vocab-explain-box", "v6-explain-box"],
      ["vocab-ai-help-box", "v67-ai-help-box"]
    ];

    map.forEach(function(pair){
      const from = pair[0];
      const to = pair[1];

      qsa("." + from).forEach(function(el){
        el.classList.add(to);
      });
    });
  }

  function ensureUiCss(){
    if($("vocabUiFullCss")) return;

    const style = DOC.createElement("style");
    style.id = "vocabUiFullCss";
    style.textContent = `
      .vocab-choice.correct,
      .v6-choice.correct{
        background:rgba(68,223,147,.30)!important;
        border-color:rgba(68,223,147,.95)!important;
        box-shadow:0 0 0 4px rgba(68,223,147,.16),0 18px 44px rgba(68,223,147,.20)!important;
        transform:translateY(-2px) scale(1.01)!important;
      }

      .vocab-choice.wrong,
      .v6-choice.wrong{
        background:rgba(255,110,135,.30)!important;
        border-color:rgba(255,110,135,.95)!important;
        box-shadow:0 0 0 4px rgba(255,110,135,.14),0 18px 44px rgba(255,110,135,.18)!important;
        animation:vocabWrongShakeN .22s linear 2;
      }

      .vocab-choice.locked,
      .v6-choice.locked{
        pointer-events:none!important;
      }

      .vocab-pop-n{
        position:fixed;
        z-index:999999;
        left:50%;
        top:42%;
        transform:translate(-50%,-50%);
        min-width:220px;
        max-width:90vw;
        padding:18px 28px;
        border-radius:999px;
        color:#fff;
        text-align:center;
        font-size:clamp(28px,6vw,56px);
        font-weight:1000;
        pointer-events:none;
        text-shadow:0 8px 24px rgba(0,0,0,.35);
        animation:vocabPopN .95s ease forwards;
      }

      .vocab-pop-n.good{
        background:linear-gradient(135deg,#22c55e,#38bdf8);
        box-shadow:0 24px 70px rgba(34,197,94,.38);
      }

      .vocab-pop-n.bad{
        background:linear-gradient(135deg,#ef4444,#fb7185);
        box-shadow:0 24px 70px rgba(239,68,68,.35);
      }

      .vocab-score-n{
        position:fixed;
        z-index:999999;
        right:7vw;
        top:25vh;
        padding:12px 18px;
        border-radius:999px;
        background:rgba(255,209,102,.98);
        color:#3b2500;
        font-size:clamp(24px,5vw,44px);
        font-weight:1000;
        pointer-events:none;
        box-shadow:0 22px 54px rgba(255,209,102,.35);
        animation:vocabScoreN .95s ease forwards;
      }

      .vocab-combo-n{
        position:fixed;
        z-index:999999;
        left:7vw;
        top:25vh;
        padding:10px 16px;
        border-radius:999px;
        background:rgba(139,92,246,.98);
        color:#fff;
        font-size:clamp(20px,4vw,36px);
        font-weight:1000;
        pointer-events:none;
        box-shadow:0 22px 54px rgba(139,92,246,.35);
        animation:vocabScoreN .95s ease forwards;
      }

      .vocab-screen-shake-n{
        animation:vocabScreenShakeN .28s linear 1;
      }

      .vocab-lb-box{
        border-radius:22px;
        border:1px solid rgba(255,255,255,.16);
        background:rgba(255,255,255,.07);
        overflow:hidden;
      }

      .vocab-lb-row{
        display:grid;
        grid-template-columns:52px 1fr 100px 90px 110px;
        gap:10px;
        align-items:center;
        padding:12px 14px;
        border-bottom:1px solid rgba(255,255,255,.10);
      }

      .vocab-lb-row:last-child{
        border-bottom:0;
      }

      .vocab-rank{
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
        border-radius:14px;
        background:rgba(255,255,255,.10);
        font-weight:1000;
      }

      .vocab-lb-name b{
        display:block;
      }

      .vocab-lb-name small{
        display:block;
        color:var(--muted);
        margin-top:3px;
      }

      .vocab-lb-score{
        font-size:20px;
        font-weight:1000;
        text-align:right;
      }

      .vocab-lb-chip{
        display:inline-flex;
        justify-content:center;
        padding:6px 9px;
        border-radius:999px;
        background:rgba(255,255,255,.10);
        border:1px solid rgba(255,255,255,.14);
        color:var(--muted);
        font-weight:900;
        font-size:12px;
      }

      .vocab-lb-chip.assisted{
        color:#f5d0fe;
        background:rgba(139,92,246,.16);
        border-color:rgba(139,92,246,.38);
      }

      .vocab-lb-empty{
        padding:16px;
        color:var(--muted);
        font-weight:900;
        text-align:center;
      }

      .vocab-personal-best{
        margin:12px;
        padding:12px 14px;
        border-radius:18px;
        background:rgba(68,223,147,.12);
        border:1px solid rgba(68,223,147,.35);
        color:var(--text);
        font-weight:900;
        line-height:1.45;
      }

      @keyframes vocabPopN{
        0%{opacity:0;transform:translate(-50%,-28%) scale(.78);}
        20%{opacity:1;transform:translate(-50%,-50%) scale(1.08);}
        100%{opacity:0;transform:translate(-50%,-92%) scale(.96);}
      }

      @keyframes vocabScoreN{
        0%{opacity:0;transform:translateY(18px) scale(.75);}
        20%{opacity:1;transform:translateY(0) scale(1.08);}
        100%{opacity:0;transform:translateY(-62px) scale(.94);}
      }

      @keyframes vocabWrongShakeN{
        0%,100%{transform:translateX(0);}
        25%{transform:translateX(-8px);}
        75%{transform:translateX(8px);}
      }

      @keyframes vocabScreenShakeN{
        0%,100%{transform:translateX(0);}
        25%{transform:translateX(-6px);}
        50%{transform:translateX(6px);}
        75%{transform:translateX(-4px);}
      }

      @media(max-width:720px){
        .vocab-lb-row{
          grid-template-columns:42px 1fr 80px;
        }

        .vocab-lb-row .v68-hide-mobile{
          display:none;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  /* =========================================================
     MENU PREVIEW
  ========================================================= */

  function diffPreviewText(diff){
    const map = {
      easy: "✨ Easy: เวลาเยอะ เหมาะกับเริ่มจำความหมาย",
      normal: "🚀 Normal: สมดุลระหว่างเวลาและความท้าทาย",
      hard: "🔥 Hard: เวลาน้อยลง ศัตรูแรงขึ้น เหมาะกับฝึกจริงจัง",
      challenge: "⚡ Challenge: ท้าทายสูงสุด คะแนนดีมีโอกาสติดอันดับ"
    };

    return map[diff] || map.easy;
  }

  function modePreviewText(mode){
    const map = {
      learn: "🤖 AI Training: เรียนรู้คำศัพท์แบบค่อยเป็นค่อยไป มี Hint และคำอธิบายชัด",
      speed: "⚡ Speed Run: ตอบให้ไว ทำ Combo เข้า Fever ได้เร็วขึ้น",
      mission: "🎯 Debug Mission: ฝึกคำศัพท์ในสถานการณ์จริงของงาน CS/AI",
      battle: "👾 Boss Battle: ต่อสู้กับบอส ใช้ Combo, Shield, Fever และ Laser ให้คุ้ม"
    };

    return map[mode] || map.learn;
  }

  function updateMenuPreview(){
    const diffBox = $("vocabDiffPreview") || $("v6DiffPreview");
    if(diffBox) diffBox.textContent = diffPreviewText(selectedDifficulty());

    const modeBox = $("vocabModePreview") || $("v6ModePreview");
    if(modeBox) modeBox.textContent = modePreviewText(selectedMode());
  }

  /* =========================================================
     SCREEN
  ========================================================= */

  function showMenu(){
    show("vocabMenuPanel");
    hide("vocabBattlePanel");
    hide("vocabRewardPanel");
    renderLeaderboard(selectedMode());
  }

  function showBattle(){
    hide("vocabMenuPanel");
    show("vocabBattlePanel");
    hide("vocabRewardPanel");
  }

  function showReward(){
    hide("vocabMenuPanel");
    hide("vocabBattlePanel");
    show("vocabRewardPanel");
  }

  /* =========================================================
     HUD
  ========================================================= */

  function hearts(hp, maxHp){
    hp = Math.max(0, toInt(hp, 5));
    maxHp = Math.max(1, toInt(maxHp, 5));

    let out = "";
    for(let i = 0; i < maxHp; i++){
      out += i < hp ? "❤️" : "🖤";
    }

    return out;
  }

  function modeHudLabel(mode){
    const map = {
      learn: "🤖 AI",
      speed: "⚡ Speed",
      mission: "🎯 Mission",
      battle: "👾 Boss"
    };

    return map[mode] || mode || "🤖 AI";
  }

  function updateHud(state){
    state = Object.assign({}, getState(), state || {});

    setText("vocabScore", toInt(pick(state.score, 0), 0));
    setText("vocabCombo", "x" + toInt(pick(state.combo, state.currentCombo, 0), 0));
    setText("vocabHp", hearts(pick(state.hp, state.lives, 5), pick(state.maxHp, 5)));
    setText("vocabTimer", toInt(pick(state.timeLeft, state.timer, state.time, 0), 0) + "s");

    const qNo = toInt(pick(state.questionNo, state.question_no, UI_STATE.questionNo, 0), 0);
    const total = toInt(pick(state.questionCount, state.question_count, state.totalQuestions, UI_STATE.questionCount, 0), 0);
    setText("vocabQuestionNo", qNo + "/" + total);

    setText("vocabModeHud", modeHudLabel(pick(state.mode, selectedMode(), "learn")));

    const fever = !!pick(state.fever, state.isFever, false);
    setText("vocabFeverChip", fever ? "🔥 Fever: ON" : "🔥 Fever: OFF");

    setText("vocabHintBtn", "💡 Hint x" + toInt(pick(state.hints, state.hintCount, state.hint, 0), 0));
    setText("vocabAiHelpBtn", "🤖 AI Help x" + toInt(pick(state.aiHelp, state.aiHelpLeft, state.ai_help_left, 0), 0));
    setText("vocabShieldChip", "🛡️ Shield x" + toInt(pick(state.shields, state.shield, state.shieldCount, 0), 0));

    const laserReady = !!pick(state.laserReady, state.laser_ready, false);
    setText("vocabLaserChip", laserReady ? "🔴 Laser: Ready" : "🔴 Laser: Not ready");

    if(state.stageName || state.stage_name){
      setText("vocabStageChip", pick(state.stageName, state.stage_name));
    }

    if(state.stageGoal || state.stage_goal){
      setText("vocabStageGoal", "Goal: " + pick(state.stageGoal, state.stage_goal));
    }

    const bank = pick(state.bank, selectedBank(), "A");
    const mode = pick(state.mode, selectedMode(), "learn");
    const modeText = {
      learn: "🤖 AI Training",
      speed: "⚡ Speed Run",
      mission: "🎯 Debug Mission",
      battle: "👾 Boss Battle"
    }[mode] || mode;

    setText("vocabBankLabel", "Bank " + bank + " • " + modeText);

    updateEnemy(state);
  }

  function updateEnemy(state){
    state = state || {};

    setText("vocabEnemyAvatar", pick(state.enemyAvatar, state.enemy_avatar, "👾"));
    setText("vocabEnemyName", pick(state.enemyName, state.enemy_name, "Bug Slime"));
    setText("vocabEnemySkill", pick(state.enemySkill, state.enemy_skill, "Enemy skill"));

    const hp = Math.max(0, toNum(pick(state.enemyHp, state.enemy_hp, 100), 100));
    const max = Math.max(1, toNum(pick(state.enemyMaxHp, state.enemy_max_hp, 100), 100));
    const pct = Math.max(0, Math.min(100, Math.round((hp / max) * 100)));

    setText("vocabEnemyHpText", pct + "%");

    const fill = $("vocabEnemyHpFill");
    if(fill) fill.style.width = pct + "%";
  }

  /* =========================================================
     QUESTION NORMALIZATION / SOURCE
  ========================================================= */

  function getQuestionsFromData(bank, difficulty, mode){
    const out = [];

    const dataSources = [
      WIN.VocabQuestion,
      WIN.VocabQuestions,
      WIN.VocabQuestionBank,
      WIN.VocabQuestionEngine,
      WIN.VocabData,
      WIN.VocabBankData,
      WIN.VOCAB_DATA,
      WIN.VOCAB_BANKS
    ].filter(Boolean);

    for(const src of dataSources){
      try{
        if(typeof src.getQuestions === "function"){
          const q = src.getQuestions({
            bank: bank,
            difficulty: difficulty,
            diff: difficulty,
            mode: mode,
            count: 8
          });

          if(Array.isArray(q) && q.length) return q;
        }

        if(typeof src.buildQuestions === "function"){
          const q = src.buildQuestions(bank, difficulty, mode, 8);
          if(Array.isArray(q) && q.length) return q;
        }

        if(typeof src.pickQuestions === "function"){
          const q = src.pickQuestions(bank, difficulty, mode, 8);
          if(Array.isArray(q) && q.length) return q;
        }

        if(src.banks && src.banks[bank] && Array.isArray(src.banks[bank])){
          return src.banks[bank].slice(0, 8);
        }

        if(src[bank] && Array.isArray(src[bank])){
          return src[bank].slice(0, 8);
        }

        if(Array.isArray(src.questions)){
          return src.questions.slice(0, 8);
        }
      }catch(e){}
    }

    return out;
  }

  function normalizeChoice(choice){
    if(choice && typeof choice === "object"){
      return {
        text: normalizeText(pick(choice.text, choice.label, choice.value, choice.answer, "")),
        value: normalizeText(pick(choice.value, choice.text, choice.label, choice.answer, "")),
        correct: !!pick(choice.correct, choice.isCorrect, choice.is_correct, false)
      };
    }

    return {
      text: normalizeText(choice),
      value: normalizeText(choice),
      correct: false
    };
  }

  function normalizeQuestion(q){
    q = q || {};

    const rawChoices =
      q.choices ||
      q.options ||
      q.answers ||
      q.choiceList ||
      [];

    const choices = Array.isArray(rawChoices)
      ? rawChoices.map(normalizeChoice)
      : [];

    let correct = normalizeText(
      pick(
        q.correct,
        q.correct_answer,
        q.correctAnswer,
        q.answer,
        q.key,
        q.solution,
        ""
      )
    );

    const correctIndex = pick(q.correctIndex, q.correct_index, q.answerIndex, q.answer_index, "");

    if(correct === "" && correctIndex !== "" && choices[Number(correctIndex)]){
      correct = choices[Number(correctIndex)].value;
    }

    if(correct === ""){
      const found = choices.find(function(c){
        return c.correct === true;
      });
      if(found) correct = found.value;
    }

    const prompt = normalizeText(
      pick(
        q.prompt,
        q.question,
        q.question_text,
        q.questionText,
        q.text,
        q.title,
        "Question text"
      )
    );

    return {
      id: normalizeText(pick(q.id, q.qid, q.question_id, "")),
      term: normalizeText(pick(q.term, q.word, q.vocab, q.keyword, "")),
      prompt: prompt,
      hint: normalizeText(pick(q.hint, q.tip, "")),
      choices: choices,
      correct: correct,
      explain: normalizeText(pick(q.explain, q.explanation, q.feedback, q.reason, "")),
      raw: q
    };
  }

  function getCurrentQuestion(){
    const game = getGame();
    const s = getState();

    const q =
      game.currentQuestion ||
      game.question ||
      s.currentQuestion ||
      s.question ||
      s.activeQuestion ||
      UI_STATE.currentQuestion ||
      null;

    return q ? normalizeQuestion(q) : null;
  }

  function setQuestions(questions){
    questions = Array.isArray(questions) ? questions : [];

    UI_STATE.questions = questions;
    UI_STATE.questionCount = questions.length;
    UI_STATE.questionIndex = 0;
    UI_STATE.questionNo = questions.length ? 1 : 0;
    UI_STATE.currentQuestion = questions.length ? questions[0] : null;

    const game = getGame();
    try{
      game.questions = questions;
      game.questionList = questions;
      game.index = 0;
      game.currentIndex = 0;
      game.currentQuestion = questions.length ? questions[0] : null;
    }catch(e){}

    patchState({
      questions: questions,
      questionList: questions,
      questionIndex: 0,
      index: 0,
      questionNo: UI_STATE.questionNo,
      questionCount: UI_STATE.questionCount,
      currentQuestion: UI_STATE.currentQuestion
    });
  }

  /* =========================================================
     QUESTION RENDER
  ========================================================= */

  function renderQuestion(question, state){
    const q = normalizeQuestion(question);
    state = Object.assign({}, getState(), state || {});

    UI_STATE.currentQuestion = question;
    UI_STATE.questionNo = toInt(pick(state.questionNo, state.question_no, UI_STATE.questionIndex + 1), 1);
    UI_STATE.questionCount = toInt(pick(state.questionCount, state.question_count, UI_STATE.questions.length), UI_STATE.questions.length);

    patchState({
      currentQuestion: question,
      question: question,
      questionNo: UI_STATE.questionNo,
      questionCount: UI_STATE.questionCount
    });

    const questionBox = $("vocabQuestionText");
    if(questionBox){
      const hint = q.hint
        ? `<span class="vocab-question-hint v6-question-hint">💡 ${esc(q.hint)}</span>`
        : "";

      questionBox.innerHTML = `
        <span class="vocab-question-main v6-question-main">${esc(q.prompt)}</span>
        ${hint}
      `;
    }

    const choicesBox = $("vocabChoices");
    if(choicesBox){
      const choices = q.choices.length
        ? q.choices
        : [
            { text:"Option A", value:"Option A" },
            { text:"Option B", value:"Option B" },
            { text:"Option C", value:"Option C" },
            { text:"Option D", value:"Option D" }
          ];

      choicesBox.innerHTML = choices.map(function(choice, index){
        const value = normalizeText(choice.value);
        const text = normalizeText(choice.text || value);
        const isCorrect = q.correct && value === q.correct;

        return `
          <button
            class="vocab-choice v6-choice"
            type="button"
            data-vocab-choice-index="${index}"
            data-vocab-choice="${esc(value)}"
            data-vocab-correct="${isCorrect ? "1" : "0"}">
            ${esc(text)}
          </button>
        `;
      }).join("");
    }

    const explainBox = $("vocabExplainBox");
    if(explainBox){
      explainBox.hidden = true;
      explainBox.innerHTML = "";
    }

    const aiBox = $("vocabAiHelpBox");
    if(aiBox){
      aiBox.hidden = true;
      aiBox.innerHTML = "";
    }

    updateHud(state);
  }

  /* =========================================================
     FEEDBACK / SFX
  ========================================================= */

  function beep(type){
    try{
      audioCtx = audioCtx || new (WIN.AudioContext || WIN.webkitAudioContext)();
      const ctx = audioCtx;

      const o = ctx.createOscillator();
      const g = ctx.createGain();

      o.type = "sine";
      o.frequency.value = type === "good" ? 740 : 180;

      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);

      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.2);

      if(type === "good"){
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();

        o2.type = "sine";
        o2.frequency.value = 980;

        g2.gain.setValueAtTime(0.0001, ctx.currentTime + 0.08);
        g2.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.11);
        g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);

        o2.connect(g2);
        g2.connect(ctx.destination);
        o2.start(ctx.currentTime + 0.08);
        o2.stop(ctx.currentTime + 0.3);
      }
    }catch(e){}
  }

  function pop(message, type){
    ensureUiCss();

    const el = DOC.createElement("div");
    el.className = "vocab-pop-n " + (type || "");
    el.textContent = message;
    DOC.body.appendChild(el);

    setTimeout(function(){
      try{ el.remove(); }catch(e){}
    }, 1000);
  }

  function scoreBurst(points, combo){
    ensureUiCss();

    if(points){
      const s = DOC.createElement("div");
      s.className = "vocab-score-n";
      s.textContent = "+" + points;
      DOC.body.appendChild(s);

      setTimeout(function(){
        try{ s.remove(); }catch(e){}
      }, 1000);
    }

    if(combo && combo >= 2){
      const c = DOC.createElement("div");
      c.className = "vocab-combo-n";
      c.textContent = "Combo x" + combo;
      DOC.body.appendChild(c);

      setTimeout(function(){
        try{ c.remove(); }catch(e){}
      }, 1000);
    }
  }

  function showExplain(html){
    const box = $("vocabExplainBox");
    if(!box) return;

    box.hidden = false;
    box.innerHTML = html;
  }

  function showAiHelp(text){
    const box = $("vocabAiHelpBox");
    if(!box) return;

    UI_STATE.aiHelpUsed += 1;

    patchState({
      aiHelpUsed: UI_STATE.aiHelpUsed,
      ai_help_used: UI_STATE.aiHelpUsed
    });

    box.hidden = false;
    box.innerHTML =
      `<b>🤖 AI Help:</b> ${
        esc(text || "ลองดู keyword ในโจทย์ แล้วตัดตัวเลือกที่ไม่เกี่ยวข้องออกก่อน")
      }`;

    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.logAiHelp === "function"){
        WIN.VocabLogger.logAiHelp({
          ai_help_used: UI_STATE.aiHelpUsed,
          question_no: UI_STATE.questionNo,
          question_count: UI_STATE.questionCount,
          bank: selectedBank(),
          mode: selectedMode(),
          difficulty: selectedDifficulty()
        });
      }
    }catch(e){}
  }

  function markChoices(selected, correct){
    selected = normalizeText(selected);
    correct = normalizeText(correct);

    qsa("[data-vocab-choice]").forEach(function(btn){
      const value = normalizeText(btn.dataset.vocabChoice || btn.textContent);

      btn.disabled = true;
      btn.classList.add("locked");

      if(correct && value === correct){
        btn.classList.add("correct");
      }

      if(value === selected && value !== correct){
        btn.classList.add("wrong");
      }
    });
  }

  function applyAnswerToHud(isCorrect){
    const score = toInt(UI_STATE.score, 0);
    const combo = toInt(UI_STATE.combo, 0);
    const hp = toInt(UI_STATE.hp, 5);

    const points = isCorrect ? 100 + combo * 10 : 0;
    const nextScore = score + points;
    const nextCombo = isCorrect ? combo + 1 : 0;
    const nextHp = isCorrect ? hp : Math.max(0, hp - 1);

    UI_STATE.score = nextScore;
    UI_STATE.combo = nextCombo;
    UI_STATE.comboMax = Math.max(toInt(UI_STATE.comboMax, 0), nextCombo);
    UI_STATE.hp = nextHp;

    if(isCorrect){
      UI_STATE.correctCount += 1;
    }else{
      UI_STATE.wrongCount += 1;
      UI_STATE.mistakes += 1;
    }

    patchState({
      score: nextScore,
      combo: nextCombo,
      currentCombo: nextCombo,
      comboMax: UI_STATE.comboMax,
      combo_max: UI_STATE.comboMax,
      hp: nextHp,
      lives: nextHp,
      correctCount: UI_STATE.correctCount,
      correct_count: UI_STATE.correctCount,
      wrongCount: UI_STATE.wrongCount,
      wrong_count: UI_STATE.wrongCount,
      mistakes: UI_STATE.mistakes
    });

    updateHud();

    return {
      points: points,
      score: nextScore,
      combo: nextCombo,
      comboMax: UI_STATE.comboMax,
      hp: nextHp
    };
  }

  function markChoiceResult(selected, correct, explainText){
    markChoices(selected, correct);
    showExplain(explainText || "");
  }

  /* =========================================================
     LOGGING
  ========================================================= */

  function logAnswer(payload){
    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.answer === "function"){
        WIN.VocabLogger.answer(payload);
      }else if(typeof WIN.logVocabAnswerV6 === "function"){
        WIN.logVocabAnswerV6(payload);
      }else if(typeof WIN.logVocabEventV6 === "function"){
        WIN.logVocabEventV6("answer", payload);
      }
    }catch(e){}
  }

  function logSessionStart(options){
    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.sessionStart === "function"){
        WIN.VocabLogger.sessionStart(options || {});
      }else if(typeof WIN.logVocabSessionStartV6 === "function"){
        WIN.logVocabSessionStartV6(options || {});
      }else if(typeof WIN.logVocabEventV6 === "function"){
        WIN.logVocabEventV6("session_start", options || {});
      }
    }catch(e){}
  }

  function logSessionEnd(summary){
    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.sessionEnd === "function"){
        WIN.VocabLogger.sessionEnd(summary || {});
      }else if(typeof WIN.logVocabSessionEndV6 === "function"){
        WIN.logVocabSessionEndV6(summary || {});
      }else if(typeof WIN.logVocabEventV6 === "function"){
        WIN.logVocabEventV6("session_end", summary || {});
      }
    }catch(e){}
  }

  /* =========================================================
     ANSWER + NEXT
  ========================================================= */

  function currentAccuracy(){
    const total = UI_STATE.correctCount + UI_STATE.wrongCount;
    if(total <= 0) return 0;
    return Math.round((UI_STATE.correctCount / total) * 100);
  }

  function handleChoice(btn){
    if(CHOICE_LOCK || UI_STATE.ended) return;

    CHOICE_LOCK = true;

    const q = getCurrentQuestion();
    const selected = normalizeText(btn.dataset.vocabChoice || btn.textContent);
    const correct = q ? normalizeText(q.correct) : "";
    const isCorrect = correct
      ? selected === correct
      : bool01(btn.dataset.vocabCorrect) === 1;

    markChoices(selected, correct);

    const hud = applyAnswerToHud(isCorrect);

    if(isCorrect){
      beep("good");
      pop("✅ Correct!", "good");
      scoreBurst(hud.points, hud.combo);

      showExplain(
        q && q.explain
          ? "✅ <b>ถูกต้อง!</b><br>" + esc(q.explain)
          : "✅ <b>ถูกต้อง!</b><br>เยี่ยมมาก ไปข้อต่อไปกันเลย"
      );
    }else{
      beep("bad");
      pop("❌ Try again", "bad");

      DOC.body.classList.add("vocab-screen-shake-n");
      setTimeout(function(){
        DOC.body.classList.remove("vocab-screen-shake-n");
      }, 320);

      showExplain(
        "❌ <b>ยังไม่ถูก</b><br>" +
        (correct ? "คำตอบที่ถูกคือ: <b>" + esc(correct) + "</b><br>" : "") +
        (q && q.explain ? esc(q.explain) : "ลองดู keyword ในโจทย์ แล้วจำความหมายของคำนี้ไว้")
      );
    }

    logAnswer({
      term: q ? q.term : "",
      prompt: q ? q.prompt : "",
      answer: selected,
      selected_answer: selected,
      selectedAnswer: selected,
      correct_answer: correct,
      correctAnswer: correct,
      correct: isCorrect ? 1 : 0,
      is_correct: isCorrect ? 1 : 0,
      isCorrect: isCorrect ? 1 : 0,
      score: hud.score,
      combo: hud.combo,
      combo_max: hud.comboMax,
      comboMax: hud.comboMax,
      hp: hud.hp,
      question_no: UI_STATE.questionNo,
      questionNo: UI_STATE.questionNo,
      question_count: UI_STATE.questionCount,
      questionCount: UI_STATE.questionCount,
      correct_count: UI_STATE.correctCount,
      correctCount: UI_STATE.correctCount,
      wrong_count: UI_STATE.wrongCount,
      wrongCount: UI_STATE.wrongCount,
      mistakes: UI_STATE.mistakes,
      accuracy: currentAccuracy(),
      ai_help_used: UI_STATE.aiHelpUsed,
      aiHelpUsed: UI_STATE.aiHelpUsed,
      ai_assisted: UI_STATE.aiHelpUsed > 0 ? 1 : 0,
      aiAssisted: UI_STATE.aiHelpUsed > 0 ? 1 : 0,
      bank: selectedBank(),
      mode: selectedMode(),
      difficulty: selectedDifficulty(),
      diff: selectedDifficulty()
    });

    setTimeout(function(){
      nextQuestion();
      CHOICE_LOCK = false;
    }, 950);
  }

  function nextQuestion(){
    if(UI_STATE.ended) return true;

    const game = getGame();

    const questions =
      UI_STATE.questions.length
        ? UI_STATE.questions
        : (
            game.questions ||
            game.questionList ||
            getState().questions ||
            getState().questionList ||
            []
          );

    if(Array.isArray(questions) && questions.length){
      const nextIndex = UI_STATE.questionIndex + 1;

      if(nextIndex >= questions.length){
        finishGame();
        return true;
      }

      UI_STATE.questionIndex = nextIndex;
      UI_STATE.questionNo = nextIndex + 1;
      UI_STATE.currentQuestion = questions[nextIndex];

      try{
        game.index = nextIndex;
        game.currentIndex = nextIndex;
        game.currentQuestion = questions[nextIndex];
      }catch(e){}

      patchState({
        index: nextIndex,
        questionIndex: nextIndex,
        questionNo: UI_STATE.questionNo,
        questionCount: questions.length,
        currentQuestion: questions[nextIndex],
        question: questions[nextIndex]
      });

      renderQuestion(questions[nextIndex], getState());
      return true;
    }

    const methods = [
      "nextQuestion",
      "next",
      "advance",
      "renderNext",
      "showNextQuestion",
      "continueGame"
    ];

    for(const name of methods){
      if(typeof game[name] === "function"){
        try{
          game[name]();
          return true;
        }catch(e){
          warn("next method failed", name, e);
        }
      }
    }

    return false;
  }

  function finishGame(){
    if(UI_STATE.ended) return;

    UI_STATE.ended = true;

    const durationSec = UI_STATE.startedAtMs
      ? Math.round((nowMs() - UI_STATE.startedAtMs) / 1000)
      : 0;

    const summary = {
      score: UI_STATE.score,
      raw_score: UI_STATE.score,
      fair_score: UI_STATE.aiHelpUsed > 0 ? Math.round(UI_STATE.score * 0.95) : UI_STATE.score,
      accuracy: currentAccuracy(),
      correct_count: UI_STATE.correctCount,
      wrong_count: UI_STATE.wrongCount,
      mistakes: UI_STATE.mistakes,
      combo_max: UI_STATE.comboMax,
      ai_help_used: UI_STATE.aiHelpUsed,
      ai_assisted: UI_STATE.aiHelpUsed > 0 ? 1 : 0,
      duration_sec: durationSec,
      active_time_sec: durationSec,
      question_count: UI_STATE.questionCount,
      completed: 1,
      boss_defeated: UI_STATE.score > 0 ? 1 : 0,
      bank: selectedBank(),
      mode: selectedMode(),
      difficulty: selectedDifficulty(),
      diff: selectedDifficulty()
    };

    logSessionEnd(summary);

    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.updateLeaderboard === "function"){
        WIN.VocabStorage.updateLeaderboard(summary);
      }else{
        updateLeaderboardFromResult(summary);
      }
    }catch(e){
      warn("leaderboard update failed", e);
    }

    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.saveLastSummary === "function"){
        WIN.VocabStorage.saveLastSummary(summary);
      }else{
        writeJson("VOCAB_SPLIT_LAST_SUMMARY", {
          saved_at: new Date().toISOString(),
          summary: summary
        });
      }
    }catch(e){}

    if(WIN.VocabReward && typeof WIN.VocabReward.show === "function"){
      WIN.VocabReward.show(summary);
      return;
    }

    showRewardFallback(summary);
  }

  function showRewardFallback(summary){
    showReward();

    const panel = $("vocabRewardPanel");
    if(!panel) return;

    panel.innerHTML = `
      <div class="vocab-card v6-card vocab-wide v6-wide" style="max-width:880px;margin:20px auto;">
        <h1>🏆 Vocab Result</h1>
        <p class="vocab-note v63-note">สรุปผลการเล่นรอบนี้</p>

        <div class="vocab-menu-grid v6-menu-grid" style="grid-template-columns:repeat(2,1fr);">
          <div class="vocab-card v6-card">
            <h2>Score</h2>
            <p style="font-size:42px;font-weight:1000;margin:0;">${Number(summary.score || 0)}</p>
          </div>
          <div class="vocab-card v6-card">
            <h2>Accuracy</h2>
            <p style="font-size:42px;font-weight:1000;margin:0;">${Number(summary.accuracy || 0)}%</p>
          </div>
        </div>

        <button id="vocabRewardBackBtn" class="vocab-start-btn v6-start-btn" type="button">
          กลับหน้าแรก
        </button>
      </div>
    `;

    const back = $("vocabRewardBackBtn");
    if(back){
      back.addEventListener("click", function(){
        showMenu();
      });
    }
  }

  /* =========================================================
     START GAME
  ========================================================= */

  function buildStartOptions(){
    const profile = saveStudentProfile();
    const menu = syncStateFromMenu();

    return {
      bank: menu.bank,
      difficulty: menu.difficulty,
      diff: menu.difficulty,
      mode: menu.mode,

      display_name: profile.display_name,
      displayName: profile.display_name,
      student_id: profile.student_id,
      studentId: profile.student_id,
      section: profile.section,
      session_code: profile.session_code,
      sessionCode: profile.session_code,

      seed: Number(getParam("seed", Date.now())) || Date.now(),
      run: getParam("run", "play") || "play",

      source: "vocab.html",
      schema: WIN.VOCAB_APP && WIN.VOCAB_APP.schema ? WIN.VOCAB_APP.schema : "vocab-split-v1",
      version: WIN.VOCAB_APP && WIN.VOCAB_APP.version ? WIN.VOCAB_APP.version : "vocab-split-v1"
    };
  }

  function resetRoundState(options){
    options = options || {};

    UI_STATE.questions = [];
    UI_STATE.currentQuestion = null;
    UI_STATE.questionIndex = 0;
    UI_STATE.questionNo = 0;
    UI_STATE.questionCount = 0;
    UI_STATE.score = 0;
    UI_STATE.combo = 0;
    UI_STATE.comboMax = 0;
    UI_STATE.hp = 5;
    UI_STATE.maxHp = 5;
    UI_STATE.correctCount = 0;
    UI_STATE.wrongCount = 0;
    UI_STATE.mistakes = 0;
    UI_STATE.aiHelpUsed = 0;
    UI_STATE.hintUsed = 0;
    UI_STATE.startedAtMs = nowMs();
    UI_STATE.ended = false;

    patchState(Object.assign({}, options, {
      score: 0,
      combo: 0,
      currentCombo: 0,
      comboMax: 0,
      combo_max: 0,
      hp: 5,
      lives: 5,
      maxHp: 5,
      correctCount: 0,
      correct_count: 0,
      wrongCount: 0,
      wrong_count: 0,
      mistakes: 0,
      aiHelpUsed: 0,
      ai_help_used: 0,
      questionNo: 0,
      questionCount: 0
    }));

    updateHud();
  }

  function startGame(){
    const now = Date.now();
    if(now - LAST_START_AT < 650) return;
    LAST_START_AT = now;

    const options = buildStartOptions();

    resetRoundState(options);
    showBattle();

    logSessionStart(options);

    const game = getGame();
    let gameStarted = false;

    if(game && typeof game.start === "function"){
      try{
        game.start(options);
        gameStarted = true;
      }catch(e){
        warn("game.start failed", e);
      }
    }else if(game && typeof game.startGame === "function"){
      try{
        game.startGame(options);
        gameStarted = true;
      }catch(e){
        warn("game.startGame failed", e);
      }
    }else if(game && typeof game.boot === "function"){
      try{
        game.boot(options);
        gameStarted = true;
      }catch(e){
        warn("game.boot failed", e);
      }
    }

    /*
      Give VocabGame a moment. If it did not set questions/current question,
      UI creates a safe question set from VocabQuestion/VocabData.
    */
    setTimeout(function(){
      const existing =
        game.questions ||
        game.questionList ||
        getState().questions ||
        getState().questionList ||
        [];

      const current =
        game.currentQuestion ||
        getState().currentQuestion ||
        null;

      if(Array.isArray(existing) && existing.length && current){
        setQuestions(existing);

        UI_STATE.currentQuestion = current;
        UI_STATE.questionIndex = toInt(pick(game.index, game.currentIndex, getState().index, 0), 0);
        UI_STATE.questionNo = UI_STATE.questionIndex + 1;
        UI_STATE.questionCount = existing.length;

        patchState({
          currentQuestion: current,
          question: current,
          questionIndex: UI_STATE.questionIndex,
          index: UI_STATE.questionIndex,
          questionNo: UI_STATE.questionNo,
          questionCount: UI_STATE.questionCount
        });

        renderQuestion(current, getState());
        return;
      }

      if(Array.isArray(existing) && existing.length){
        setQuestions(existing);
        renderQuestion(existing[0], getState());
        return;
      }

      const generated = getQuestionsFromData(options.bank, options.difficulty, options.mode);

      if(generated.length){
        setQuestions(generated);
        renderQuestion(generated[0], getState());
        return;
      }

      if(!gameStarted){
        showExplain("ยังไม่พบ VocabGame หรือคลังคำถามสำหรับเริ่มเกม");
      }
    }, 80);
  }

  /* =========================================================
     LEADERBOARD
  ========================================================= */

  function normalizeBoard(board){
    const fallback = {
      learn: [],
      speed: [],
      mission: [],
      battle: [],
      bossrush: []
    };

    if(!board || typeof board !== "object"){
      return fallback;
    }

    Object.keys(fallback).forEach(function(mode){
      if(!Array.isArray(board[mode])){
        board[mode] = [];
      }
    });

    return board;
  }

  function readBoard(){
    let board = null;

    if(WIN.VocabStorage && typeof WIN.VocabStorage.readLeaderboard === "function"){
      try{
        board = WIN.VocabStorage.readLeaderboard();
      }catch(e){
        board = null;
      }
    }

    if(!board){
      board =
        readJson("VOCAB_SPLIT_LEADERBOARD", null) ||
        readJson("VOCAB_V71_LEADERBOARD", null) ||
        readJson("VOCAB_LEADERBOARD", null);
    }

    return normalizeBoard(board);
  }

  function saveBoard(board){
    board = normalizeBoard(board);

    if(WIN.VocabStorage && typeof WIN.VocabStorage.saveLeaderboard === "function"){
      try{
        WIN.VocabStorage.saveLeaderboard(board);
        return true;
      }catch(e){}
    }

    return writeJson("VOCAB_SPLIT_LEADERBOARD", board);
  }

  function modeInfo(mode){
    const map = {
      learn: ["🤖", "AI Training"],
      speed: ["⚡", "Speed Run"],
      mission: ["🎯", "Debug Mission"],
      battle: ["👾", "Boss Battle"],
      bossrush: ["💀", "Boss Rush"]
    };

    return map[mode] || map.learn;
  }

  function getLeaderboardBox(){
    return $("vocabLeaderboardBox") || $("v68LeaderboardBox");
  }

  function rowHtml(row, rank){
    const medal =
      rank === 1 ? "🥇" :
      rank === 2 ? "🥈" :
      rank === 3 ? "🥉" :
      "#" + rank;

    const score = Number(row.fair_score || row.fairScore || row.score || 0);
    const acc = Number(row.accuracy || 0);
    const diff = row.difficulty || row.diff || "-";
    const bank = row.bank || "-";
    const name = row.display_name || row.displayName || "Hero";
    const assisted = Number(row.ai_assisted || row.aiAssisted || row.ai_help_used || row.aiHelpUsed || 0) > 0;

    return `
      <div class="vocab-lb-row v68-lb-row">
        <div class="vocab-rank v68-rank">${medal}</div>

        <div class="vocab-lb-name v68-lb-name">
          <b>${esc(name)}</b>
          <small>Bank ${esc(bank)} • ${esc(diff)}</small>
        </div>

        <div class="vocab-lb-score v68-lb-score">${score}</div>

        <div class="v68-hide-mobile">
          <span class="vocab-lb-chip v68-lb-chip">${acc}%</span>
        </div>

        <div class="v68-hide-mobile">
          ${
            assisted
              ? `<span class="vocab-lb-chip v68-lb-chip assisted">🤖 Assisted</span>`
              : `<span class="vocab-lb-chip v68-lb-chip">🏅 No Help</span>`
          }
        </div>
      </div>
    `;
  }

  function personalBestHtml(mode, rows){
    const profile = getStudentProfile();
    const sid = String(profile.student_id || "anon");

    const mine = rows.filter(function(row){
      return String(row.student_id || row.studentId || "anon") === sid;
    });

    if(!mine.length){
      return `
        <div class="vocab-personal-best v68-personal-best">
          ⭐ Personal Best: ยังไม่มีคะแนนของคุณในโหมดนี้
        </div>
      `;
    }

    const best = mine.reduce(function(a, b){
      return Number(a.fair_score || a.fairScore || a.score || 0) >= Number(b.fair_score || b.fairScore || b.score || 0)
        ? a
        : b;
    });

    const rank = rows.findIndex(function(row){
      return String(row.session_id || row.sessionId || "") === String(best.session_id || best.sessionId || "");
    }) + 1;

    return `
      <div class="vocab-personal-best v68-personal-best">
        ⭐ Personal Best:
        <b>${Number(best.fair_score || best.fairScore || best.score || 0)}</b>
        • Rank #${rank || "-"}
        • Accuracy ${Number(best.accuracy || 0)}%
      </div>
    `;
  }

  function renderLeaderboard(mode){
    mode = mode || selectedMode() || "learn";

    const box = getLeaderboardBox();
    if(!box) return;

    const board = readBoard();
    const rows = Array.isArray(board[mode]) ? board[mode] : [];
    const info = modeInfo(mode);

    qsa("[data-lb-mode]").forEach(function(tab){
      tab.classList.toggle("active", tab.dataset.lbMode === mode);
    });

    if(!rows.length){
      box.innerHTML = `
        <div class="vocab-lb-empty v68-lb-empty">
          ${info[0]} ${esc(info[1])}: ยังไม่มีคะแนนในโหมดนี้
        </div>
      `;
      return;
    }

    const sorted = rows.slice().sort(function(a, b){
      const s =
        Number(b.fair_score || b.fairScore || b.score || 0) -
        Number(a.fair_score || a.fairScore || a.score || 0);

      if(s !== 0) return s;

      const acc =
        Number(b.accuracy || 0) -
        Number(a.accuracy || 0);

      if(acc !== 0) return acc;

      return Number(b.combo_max || b.comboMax || 0) - Number(a.combo_max || a.comboMax || 0);
    });

    box.innerHTML =
      sorted.slice(0, 5).map(function(row, index){
        return rowHtml(row, index + 1);
      }).join("") +
      personalBestHtml(mode, sorted);
  }

  function updateLeaderboardFromResult(result){
    result = result || {};

    if(WIN.VocabStorage && typeof WIN.VocabStorage.updateLeaderboard === "function"){
      const out = WIN.VocabStorage.updateLeaderboard(result);
      renderLeaderboard(result.mode || selectedMode());
      return out;
    }

    const board = readBoard();
    const mode = String(result.mode || selectedMode() || "learn").toLowerCase();

    if(!Array.isArray(board[mode])) board[mode] = [];

    const aiHelpUsed = toInt(pick(result.ai_help_used, result.aiHelpUsed, 0), 0);
    const rawScore = toNum(pick(result.score, 0), 0);
    const fairScore = toNum(
      pick(result.fair_score, result.fairScore, aiHelpUsed > 0 ? Math.round(rawScore * 0.95) : rawScore),
      rawScore
    );

    const profile = getStudentProfile();

    const entry = {
      session_id: pick(result.session_id, result.sessionId, "vocab_" + Date.now()),
      timestamp: new Date().toISOString(),
      display_name: pick(result.display_name, result.displayName, profile.display_name, "Hero"),
      student_id: pick(result.student_id, result.studentId, profile.student_id, "anon"),
      section: pick(result.section, profile.section, ""),
      session_code: pick(result.session_code, result.sessionCode, profile.session_code, ""),
      bank: pick(result.bank, selectedBank(), "A"),
      difficulty: pick(result.difficulty, result.diff, selectedDifficulty(), "easy"),
      mode: mode,
      score: rawScore,
      fair_score: fairScore,
      accuracy: toNum(pick(result.accuracy, 0), 0),
      combo_max: toInt(pick(result.combo_max, result.comboMax, 0), 0),
      ai_help_used: aiHelpUsed,
      ai_assisted: aiHelpUsed > 0 ? 1 : 0
    };

    board[mode].push(entry);

    board[mode] = board[mode]
      .sort(function(a, b){
        return Number(b.fair_score || b.fairScore || b.score || 0) - Number(a.fair_score || a.fairScore || a.score || 0);
      })
      .slice(0, 50);

    saveBoard(board);
    renderLeaderboard(mode);

    return {
      entry,
      rank: board[mode].findIndex(function(row){
        return row.session_id === entry.session_id;
      }) + 1,
      fairScore
    };
  }

  /* =========================================================
     EVENTS
  ========================================================= */

  function bindMenuSelectors(){
    qsa("[data-vocab-bank]").forEach(function(btn){
      if(btn.__vocabUiBankBound) return;
      btn.__vocabUiBankBound = true;

      btn.addEventListener("click", function(){
        qsa("[data-vocab-bank]").forEach(function(b){
          b.classList.toggle("active", b === btn);
        });

        patchState({
          bank: btn.dataset.vocabBank || "A",
          selectedBank: btn.dataset.vocabBank || "A"
        });
      });
    });

    qsa("[data-vocab-diff]").forEach(function(btn){
      if(btn.__vocabUiDiffBound) return;
      btn.__vocabUiDiffBound = true;

      btn.addEventListener("click", function(){
        const diff = btn.dataset.vocabDiff || "easy";

        qsa("[data-vocab-diff]").forEach(function(b){
          b.classList.toggle("active", b === btn);
        });

        patchState({
          difficulty: diff,
          diff: diff,
          selectedDifficulty: diff
        });

        updateMenuPreview();
      });
    });

    qsa("[data-vocab-mode]").forEach(function(btn){
      if(btn.__vocabUiModeBound) return;
      btn.__vocabUiModeBound = true;

      btn.addEventListener("click", function(){
        const mode = btn.dataset.vocabMode || "learn";

        qsa("[data-vocab-mode]").forEach(function(b){
          b.classList.toggle("active", b === btn);
        });

        patchState({
          mode: mode,
          selectedMode: mode
        });

        updateMenuPreview();
        renderLeaderboard(mode);
      });
    });
  }

  function bindLeaderboardTabs(){
    qsa("[data-lb-mode]").forEach(function(tab){
      if(tab.__vocabUiLbBound) return;
      tab.__vocabUiLbBound = true;

      tab.addEventListener("click", function(){
        renderLeaderboard(tab.dataset.lbMode || "learn");
      });
    });
  }

  function bindStartButton(){
    const btn = $("vocabStartBtn") || $("v6StartBtn") || qs("[data-vocab-start]");
    if(!btn || btn.__vocabUiStartBound) return;

    btn.__vocabUiStartBound = true;

    btn.addEventListener("click", function(ev){
      ev.preventDefault();
      startGame();
    });
  }

  function bindPowerButtons(){
    const hint = $("vocabHintBtn");
    if(hint && !hint.__vocabUiHintBound){
      hint.__vocabUiHintBound = true;

      hint.addEventListener("click", function(ev){
        ev.preventDefault();

        const q = getCurrentQuestion();

        UI_STATE.hintUsed += 1;
        patchState({
          hintUsed: UI_STATE.hintUsed,
          hint_used: UI_STATE.hintUsed
        });

        if(q && q.hint){
          showExplain("💡 <b>Hint:</b> " + esc(q.hint));
        }else if(q && q.correct){
          showExplain("💡 <b>Hint:</b> คำตอบเกี่ยวข้องกับความหมายของ <b>" + esc(q.term || q.prompt) + "</b>");
        }else{
          showExplain("💡 <b>Hint:</b> ลองตัดตัวเลือกที่ไม่เกี่ยวข้องออกก่อน");
        }
      });
    }

    const ai = $("vocabAiHelpBtn");
    if(ai && !ai.__vocabUiAiBound){
      ai.__vocabUiAiBound = true;

      ai.addEventListener("click", function(ev){
        ev.preventDefault();

        const q = getCurrentQuestion();
        showAiHelp(
          q && q.correct
            ? "คำตอบที่ควรมองหาเกี่ยวข้องกับ: " + q.correct
            : "อ่าน keyword สำคัญในโจทย์ก่อน แล้วเลือกคำตอบที่ตรงความหมายที่สุด"
        );
      });
    }
  }

  function bindChoiceCapture(){
    if(WIN.__VOCAB_UI_CHOICE_CAPTURE_BOUND__) return;
    WIN.__VOCAB_UI_CHOICE_CAPTURE_BOUND__ = true;

    WIN.addEventListener("click", function(ev){
      const btn = ev.target && ev.target.closest
        ? ev.target.closest("[data-vocab-choice]")
        : null;

      if(!btn) return;

      ev.preventDefault();
      ev.stopPropagation();

      if(typeof ev.stopImmediatePropagation === "function"){
        ev.stopImmediatePropagation();
      }

      handleChoice(btn);
    }, true);
  }

  function bindEvents(){
    if(UI_BOUND) return;
    UI_BOUND = true;

    bindMenuSelectors();
    bindLeaderboardTabs();
    bindStartButton();
    bindPowerButtons();
    bindChoiceCapture();
  }

  /* =========================================================
     INIT
  ========================================================= */

  function init(){
    ensureUiCss();
    applyClassAliases();
    hydrateStudentForm();
    syncActiveButtons();
    updateMenuPreview();
    bindEvents();
    updateHud();
    renderLeaderboard(selectedMode());

    setTimeout(function(){
      applyClassAliases();
      bindMenuSelectors();
      bindLeaderboardTabs();
      renderLeaderboard(selectedMode());
    }, 300);

    setTimeout(function(){
      renderLeaderboard(selectedMode());
    }, 900);

    return true;
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

  const api = {
    version: VERSION,

    init,
    boot: init,
    bind: bindEvents,
    bindEvents,

    getState,
    patchState,
    syncStateFromMenu,
    selectedBank,
    selectedDifficulty,
    selectedMode,

    getStudentProfile,
    saveStudentProfile,
    hydrateStudentForm,

    showMenu,
    showBattle,
    showReward,

    updateHud,
    updateEnemy,

    normalizeQuestion,
    renderQuestion,
    setQuestions,
    getCurrentQuestion,

    handleChoice,
    nextQuestion,
    finishGame,

    showAiHelp,
    showExplain,
    markChoiceResult,
    floatText: pop,
    pop,
    scoreBurst,
    beep,

    buildStartOptions,
    startGame,

    renderLeaderboard,
    updateLeaderboardFromResult,
    readBoard
  };

  WIN.VocabUI = api;
  WIN.VocabUi = api;

  WIN.VocabLeaderboard = {
    version: "leaderboard-from-" + VERSION,
    render: renderLeaderboard,
    updateFromResult: updateLeaderboardFromResult,
    readBoard: readBoard
  };

  WIN.renderLeaderboardV68 = renderLeaderboard;
  WIN.updateLeaderboardV68 = updateLeaderboardFromResult;

  WIN.VocabModules = WIN.VocabModules || {};
  WIN.VocabModules.ui = true;
  WIN.VocabModules.leaderboard = true;

  WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
  WIN.__VOCAB_MODULES__.ui = true;
  WIN.__VOCAB_MODULES__.leaderboard = true;

  if(DOC.readyState === "loading"){
    DOC.addEventListener("DOMContentLoaded", init, { once:true });
  }else{
    init();
  }

  log("loaded", VERSION);
})();
/* =========================================================
   /vocab/vocab.ui.js — Question Time Guard
   PATCH: v20260503r

   Fix:
   - เวลาแต่ละข้อสั้นเกินไป
   - คำถามเปลี่ยนเองระหว่างกำลังทำ
   - allow next only after answer feedback
   - learn/mission = no auto-skip
   - speed/battle = longer timer, but guarded
========================================================= */
(function(){
  "use strict";

  const WIN = window;
  const DOC = document;
  const VERSION = "vocab-question-time-guard-v20260503r";

  const SETTINGS = {
    learn: {
      easy: 45,
      normal: 40,
      hard: 35,
      challenge: 30,
      autoSkip: false
    },
    mission: {
      easy: 45,
      normal: 40,
      hard: 35,
      challenge: 30,
      autoSkip: false
    },
    speed: {
      easy: 30,
      normal: 25,
      hard: 22,
      challenge: 18,
      autoSkip: true
    },
    battle: {
      easy: 35,
      normal: 30,
      hard: 25,
      challenge: 22,
      autoSkip: true
    }
  };

  let currentKey = "";
  let currentQuestion = null;
  let questionStartedAt = 0;
  let answered = false;
  let forceNextUntil = 0;
  let timerId = null;
  let remaining = 0;

  function $(id){
    return DOC.getElementById(id);
  }

  function pick(){
    for(let i = 0; i < arguments.length; i++){
      const v = arguments[i];
      if(v !== undefined && v !== null && v !== "") return v;
    }
    return "";
  }

  function getState(){
    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.getState === "function"){
        return WIN.VocabUI.getState() || {};
      }
    }catch(e){}

    try{
      if(WIN.VocabState && typeof WIN.VocabState.get === "function"){
        return WIN.VocabState.get() || {};
      }
    }catch(e){}

    return WIN.VOCAB_APP || {};
  }

  function setState(update){
    update = update || {};

    WIN.VOCAB_APP = WIN.VOCAB_APP || {};
    Object.assign(WIN.VOCAB_APP, update);

    try{
      if(WIN.VocabState && typeof WIN.VocabState.set === "function"){
        WIN.VocabState.set(update);
      }else if(WIN.VocabState && WIN.VocabState.state){
        Object.assign(WIN.VocabState.state, update);
      }
    }catch(e){}

    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.patchState === "function"){
        WIN.VocabUI.patchState(update);
      }
    }catch(e){}
  }

  function mode(){
    const s = getState();
    return String(pick(s.mode, s.selectedMode, "learn")).toLowerCase();
  }

  function difficulty(){
    const s = getState();
    return String(pick(s.difficulty, s.diff, s.selectedDifficulty, "easy")).toLowerCase();
  }

  function getRule(){
    const m = mode();
    const d = difficulty();

    const group = SETTINGS[m] || SETTINGS.learn;

    return {
      seconds: Number(group[d] || group.easy || 40),
      autoSkip: !!group.autoSkip
    };
  }

  function questionKey(q){
    q = q || {};

    return String(
      pick(
        q.id,
        q.qid,
        q.term,
        q.word,
        q.prompt,
        q.question,
        q.question_text,
        q.questionText,
        JSON.stringify(q).slice(0, 120)
      )
    );
  }

  function updateTimerDisplay(sec){
    const el = $("vocabTimer");
    if(el){
      el.textContent = Math.max(0, Math.ceil(sec)) + "s";
    }

    setState({
      timeLeft: Math.max(0, Math.ceil(sec)),
      timer: Math.max(0, Math.ceil(sec))
    });
  }

  function stopTimer(){
    if(timerId){
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimerForQuestion(){
    stopTimer();

    const rule = getRule();
    remaining = rule.seconds;

    updateTimerDisplay(remaining);

    timerId = setInterval(function(){
      if(answered){
        stopTimer();
        return;
      }

      remaining -= 1;
      updateTimerDisplay(remaining);

      if(remaining <= 0){
        stopTimer();

        if(rule.autoSkip){
          handleTimeout();
        }else{
          /*
            learn / mission ไม่เปลี่ยนข้อเอง
            ค้างไว้ให้ผู้เรียนตอบ แต่แจ้งเตือนว่าใช้เวลานานแล้ว
          */
          updateTimerDisplay(0);
          showSoftTimeoutMessage();
        }
      }
    }, 1000);
  }

  function showSoftTimeoutMessage(){
    const box = $("vocabExplainBox");
    if(!box) return;

    box.hidden = false;
    box.innerHTML = `
      ⏳ <b>ใช้เวลานานแล้ว</b><br>
      ข้อนี้จะยังไม่เปลี่ยนเอง ลองเลือกคำตอบที่คิดว่าใกล้เคียงที่สุด
    `;
  }

  function handleTimeout(){
    if(answered) return;

    answered = true;

    const box = $("vocabExplainBox");
    if(box){
      box.hidden = false;
      box.innerHTML = `
        ⏰ <b>หมดเวลา</b><br>
        ระบบจะไปข้อถัดไป แต่ไม่ตัดคะแนนแรง เพื่อให้ฝึกต่อได้
      `;
    }

    setTimeout(function(){
      allowNextBriefly();

      if(WIN.VocabUI && typeof WIN.VocabUI.nextQuestion === "function"){
        WIN.VocabUI.nextQuestion();
      }
    }, 850);
  }

  function allowNextBriefly(){
    forceNextUntil = Date.now() + 1600;
  }

  function isForcedNext(){
    return Date.now() < forceNextUntil;
  }

  function onNewQuestion(q){
    currentQuestion = q || null;
    currentKey = questionKey(q);
    questionStartedAt = Date.now();
    answered = false;

    startTimerForQuestion();
  }

  function shouldBlockRender(q){
    if(!currentQuestion) return false;
    if(answered) return false;
    if(isForcedNext()) return false;

    const nextKey = questionKey(q);

    if(!nextKey || nextKey === currentKey){
      return false;
    }

    /*
      ถ้ายังไม่ได้ตอบ ห้าม render คำถามใหม่ทับ
      กันกรณี timer/old game loop แอบ next เอง
    */
    return true;
  }

  function installRenderGuard(){
    if(!WIN.VocabUI || WIN.VocabUI.__timeGuardRenderInstalled) return;

    const originalRender = WIN.VocabUI.renderQuestion;

    if(typeof originalRender !== "function") return;

    WIN.VocabUI.__timeGuardRenderInstalled = true;

    WIN.VocabUI.renderQuestion = function(question, state){
      if(shouldBlockRender(question)){
        console.warn("[VOCAB TIME GUARD] blocked unexpected auto-question change");

        return originalRender.call(WIN.VocabUI, currentQuestion, getState());
      }

      const result = originalRender.call(WIN.VocabUI, question, state);

      onNewQuestion(question);

      return result;
    };
  }

  function installChoiceGuard(){
    if(!WIN.VocabUI || WIN.VocabUI.__timeGuardChoiceInstalled) return;

    const originalHandle = WIN.VocabUI.handleChoice;

    if(typeof originalHandle !== "function") return;

    WIN.VocabUI.__timeGuardChoiceInstalled = true;

    WIN.VocabUI.handleChoice = function(btn){
      answered = true;
      stopTimer();
      allowNextBriefly();

      return originalHandle.call(WIN.VocabUI, btn);
    };
  }

  function installNextGuard(){
    if(!WIN.VocabUI || WIN.VocabUI.__timeGuardNextInstalled) return;

    const originalNext = WIN.VocabUI.nextQuestion;

    if(typeof originalNext !== "function") return;

    WIN.VocabUI.__timeGuardNextInstalled = true;

    WIN.VocabUI.nextQuestion = function(){
      /*
        ถ้าไม่ได้ตอบ และไม่ได้ timeout ที่อนุญาต ห้ามไปข้อถัดไปเอง
      */
      if(!answered && !isForcedNext()){
        console.warn("[VOCAB TIME GUARD] blocked nextQuestion before answer");
        return false;
      }

      allowNextBriefly();
      return originalNext.call(WIN.VocabUI);
    };
  }

  function installGameGuard(){
    const game = WIN.VocabGame || WIN.vocabGame || WIN.VOCAB_GAME;

    if(!game || game.__vocabTimeGuardInstalled) return;

    game.__vocabTimeGuardInstalled = true;

    [
      "nextQuestion",
      "next",
      "advance",
      "renderNext",
      "showNextQuestion",
      "continueGame"
    ].forEach(function(name){
      if(typeof game[name] !== "function") return;

      const original = game[name];

      game[name] = function(){
        if(!answered && !isForcedNext()){
          console.warn("[VOCAB TIME GUARD] blocked game auto-next:", name);
          return false;
        }

        allowNextBriefly();
        return original.apply(game, arguments);
      };
    });
  }

  function patchSettingsToApp(){
    const rule = getRule();

    setState({
      questionTimeSec: rule.seconds,
      perQuestionTime: rule.seconds,
      autoSkipQuestion: rule.autoSkip,
      noAutoNextBeforeAnswer: true
    });
  }

  function install(){
    if(!WIN.VocabUI){
      setTimeout(install, 120);
      return;
    }

    patchSettingsToApp();
    installRenderGuard();
    installChoiceGuard();
    installNextGuard();
    installGameGuard();

    console.log("[VOCAB TIME GUARD] loaded", VERSION, getRule());
  }

  if(DOC.readyState === "loading"){
    DOC.addEventListener("DOMContentLoaded", install, { once:true });
  }else{
    install();
  }

  WIN.VocabTimeGuard = {
    version: VERSION,
    getRule,
    stopTimer,
    startTimerForQuestion,
    allowNextBriefly
  };
})();
