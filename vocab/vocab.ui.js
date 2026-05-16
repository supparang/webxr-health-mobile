/* =========================================================
   /vocab/vocab.ui.js
   TechPath Vocab Arena — UI Controller
   FULL CLEAN PATCH: v20260504a

   Critical fix:
   - UI does NOT check answers
   - UI does NOT capture choice clicks
   - UI only renders buttons
   - VocabGame is the only answer owner
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;
  const VERSION = "vocab-ui-v20260504a";

  let audioCtx = null;

  function $(id){
    return DOC.getElementById(id);
  }

  function qsa(sel, root){
    return Array.from((root || DOC).querySelectorAll(sel));
  }

  function qs(sel, root){
    return (root || DOC).querySelector(sel);
  }

  function clean(s){
    return String(s ?? "").trim();
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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

  function norm(s){
    return clean(s).toLowerCase().replace(/\s+/g, " ");
  }

  function getApp(){
    WIN.VOCAB_APP = WIN.VOCAB_APP || {};
    return WIN.VOCAB_APP;
  }

  function getState(){
    try{
      if(WIN.VocabGame && typeof WIN.VocabGame.getState === "function"){
        return WIN.VocabGame.getState() || {};
      }
    }catch(e){}

    try{
      if(WIN.VocabState && typeof WIN.VocabState.get === "function"){
        return WIN.VocabState.get() || {};
      }
    }catch(e){}

    return getApp();
  }

  function patchState(update){
    update = update || {};

    Object.assign(getApp(), update);

    try{
      if(WIN.VocabState && typeof WIN.VocabState.set === "function"){
        WIN.VocabState.set(update);
      }else if(WIN.VocabState && WIN.VocabState.state){
        Object.assign(WIN.VocabState.state, update);
      }
    }catch(e){}
  }

  /* =========================================================
     CSS / CLASS COMPAT
  ========================================================= */

  function ensureCss(){
    if($("vocabUiFinalCss")) return;

    const style = DOC.createElement("style");
    style.id = "vocabUiFinalCss";
    style.textContent = `
      .vocab-choice.correct,
      .v6-choice.correct{
        background:rgba(68,223,147,.32)!important;
        border-color:rgba(68,223,147,.96)!important;
        box-shadow:0 0 0 4px rgba(68,223,147,.18),0 18px 44px rgba(68,223,147,.20)!important;
      }

      .vocab-choice.wrong,
      .v6-choice.wrong{
        background:rgba(255,110,135,.30)!important;
        border-color:rgba(255,110,135,.96)!important;
        box-shadow:0 0 0 4px rgba(255,110,135,.15),0 18px 44px rgba(255,110,135,.18)!important;
      }

      .vocab-choice.locked,
      .v6-choice.locked{
        pointer-events:none!important;
      }

      .vocab-pop-final{
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
        animation:vocabPopFinal .95s ease forwards;
      }

      .vocab-pop-final.good{
        background:linear-gradient(135deg,#22c55e,#38bdf8);
      }

      .vocab-pop-final.bad{
        background:linear-gradient(135deg,#ef4444,#fb7185);
      }

      .vocab-score-final{
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
        animation:vocabScoreFinal .95s ease forwards;
      }

      .vocab-combo-final{
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
        animation:vocabScoreFinal .95s ease forwards;
      }

      @keyframes vocabPopFinal{
        0%{opacity:0;transform:translate(-50%,-28%) scale(.78);}
        20%{opacity:1;transform:translate(-50%,-50%) scale(1.08);}
        100%{opacity:0;transform:translate(-50%,-92%) scale(.96);}
      }

      @keyframes vocabScoreFinal{
        0%{opacity:0;transform:translateY(18px) scale(.75);}
        20%{opacity:1;transform:translateY(0) scale(1.08);}
        100%{opacity:0;transform:translateY(-62px) scale(.94);}
      }
    `;

    DOC.head.appendChild(style);
  }

  function applyClassAliases(){
    const map = [
      ["vocab-app", "v6-app"],
      ["vocab-screen", "v6-screen"],
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
      qsa("." + pair[0]).forEach(function(el){
        el.classList.add(pair[1]);
      });
    });
  }

  /* =========================================================
     MENU / SELECTION
  ========================================================= */

  function selectedBank(){
    const active = qs("[data-vocab-bank].active");
    return clean(pick(active && active.dataset.vocabBank, getState().bank, "A")).toUpperCase();
  }

  function selectedDifficulty(){
    const active = qs("[data-vocab-diff].active");
    return clean(pick(active && active.dataset.vocabDiff, getState().difficulty, getState().diff, "easy")).toLowerCase();
  }

  function selectedMode(){
    const active = qs("[data-vocab-mode].active");
    return clean(pick(active && active.dataset.vocabMode, getState().mode, "learn")).toLowerCase();
  }

  function diffPreviewText(diff){
    return {
      easy: "✨ Easy: เวลาเยอะ เหมาะกับเริ่มจำความหมาย",
      normal: "🚀 Normal: สมดุลระหว่างเวลาและความท้าทาย",
      hard: "🔥 Hard: เวลาน้อยลง ตัวหลอกท้าทายขึ้น",
      challenge: "⚡ Challenge: ท้าทายสูงสุด เหมาะกับผู้ที่พร้อมแข่ง"
    }[diff] || "✨ Easy: เวลาเยอะ เหมาะกับเริ่มจำความหมาย";
  }

  function modePreviewText(mode){
    return {
      learn: "🤖 AI Training: เรียนรู้คำศัพท์แบบค่อยเป็นค่อยไป มี Hint และคำอธิบายชัด",
      speed: "⚡ Speed Run: ตอบให้ไว ทำ Combo เข้า Fever ได้เร็วขึ้น",
      mission: "🎯 Debug Mission: ฝึกคำศัพท์ในสถานการณ์จริงของงาน CS/AI",
      battle: "👾 Boss Battle: ต่อสู้กับบอส ใช้ Combo, Shield, Fever และ Laser"
    }[mode] || "🤖 AI Training: เรียนรู้คำศัพท์แบบค่อยเป็นค่อยไป";
  }

  function syncMenuState(){
    const bank = selectedBank();
    const difficulty = selectedDifficulty();
    const mode = selectedMode();

    patchState({
      bank,
      selectedBank: bank,
      difficulty,
      diff: difficulty,
      selectedDifficulty: difficulty,
      mode,
      selectedMode: mode
    });

    const diffBox = $("vocabDiffPreview");
    if(diffBox) diffBox.textContent = diffPreviewText(difficulty);

    const modeBox = $("vocabModePreview");
    if(modeBox) modeBox.textContent = modePreviewText(mode);

    return { bank, difficulty, diff: difficulty, mode };
  }

  function bindMenu(){
    qsa("[data-vocab-bank]").forEach(function(btn){
      if(btn.__vocabUiBankBound) return;
      btn.__vocabUiBankBound = true;

      btn.addEventListener("click", function(){
        qsa("[data-vocab-bank]").forEach(b => b.classList.toggle("active", b === btn));
        syncMenuState();
      });
    });

    qsa("[data-vocab-diff]").forEach(function(btn){
      if(btn.__vocabUiDiffBound) return;
      btn.__vocabUiDiffBound = true;

      btn.addEventListener("click", function(){
        qsa("[data-vocab-diff]").forEach(b => b.classList.toggle("active", b === btn));
        syncMenuState();
      });
    });

    qsa("[data-vocab-mode]").forEach(function(btn){
      if(btn.__vocabUiModeBound) return;
      btn.__vocabUiModeBound = true;

      btn.addEventListener("click", function(){
        qsa("[data-vocab-mode]").forEach(b => b.classList.toggle("active", b === btn));
        syncMenuState();
        renderLeaderboard(btn.dataset.vocabMode || "learn");
      });
    });

    qsa("[data-lb-mode]").forEach(function(btn){
      if(btn.__vocabUiLbBound) return;
      btn.__vocabUiLbBound = true;

      btn.addEventListener("click", function(){
        qsa("[data-lb-mode]").forEach(b => b.classList.toggle("active", b === btn));
        renderLeaderboard(btn.dataset.lbMode || "learn");
      });
    });

    const start = $("vocabStartBtn");
    if(start && !start.__vocabUiStartBound){
      start.__vocabUiStartBound = true;

      start.addEventListener("click", function(ev){
        ev.preventDefault();

        const opts = buildStartOptions();

        if(WIN.VocabGame && typeof WIN.VocabGame.start === "function"){
          WIN.VocabGame.start(opts);
        }
      });
    }

    const hint = $("vocabHintBtn");
    if(hint && !hint.__vocabUiHintBound){
      hint.__vocabUiHintBound = true;

      hint.addEventListener("click", function(ev){
        ev.preventDefault();
        if(WIN.VocabGame && typeof WIN.VocabGame.useHint === "function"){
          WIN.VocabGame.useHint();
        }
      });
    }

    const ai = $("vocabAiHelpBtn");
    if(ai && !ai.__vocabUiAiBound){
      ai.__vocabUiAiBound = true;

      ai.addEventListener("click", function(ev){
        ev.preventDefault();
        if(WIN.VocabGame && typeof WIN.VocabGame.useAiHelp === "function"){
          WIN.VocabGame.useAiHelp();
        }
      });
    }
  }

  function readInput(id){
    const el = $(id);
    return el ? clean(el.value) : "";
  }

  function getStudentProfile(){
    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.loadStudentProfile === "function"){
        return WIN.VocabStorage.loadStudentProfile();
      }
    }catch(e){}

    return {
      display_name: pick(readInput("vocabDisplayName"), "Hero"),
      student_id: pick(readInput("vocabStudentId"), "anon"),
      section: readInput("vocabSection"),
      session_code: readInput("vocabSessionCode")
    };
  }

  function buildStartOptions(){
    const menu = syncMenuState();
    const p = getStudentProfile();

    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.saveStudentProfile === "function"){
        WIN.VocabStorage.saveStudentProfile(p);
      }
    }catch(e){}

    return {
      bank: menu.bank,
      difficulty: menu.difficulty,
      diff: menu.difficulty,
      mode: menu.mode,

      display_name: pick(p.display_name, p.displayName, "Hero"),
      displayName: pick(p.display_name, p.displayName, "Hero"),

      student_id: pick(p.student_id, p.studentId, "anon"),
      studentId: pick(p.student_id, p.studentId, "anon"),

      section: p.section || "",
      session_code: pick(p.session_code, p.sessionCode, ""),
      sessionCode: pick(p.session_code, p.sessionCode, ""),

      seed: Date.now(),
      source: "vocab.html",
      schema: "vocab-split-v1",
      version: VERSION
    };
  }

  /* =========================================================
     SCREEN
  ========================================================= */

  function showMenu(){
    const menu = $("vocabMenuPanel");
    const battle = $("vocabBattlePanel");
    const reward = $("vocabRewardPanel");

    if(menu) menu.hidden = false;
    if(battle) battle.hidden = true;
    if(reward) reward.hidden = true;

    renderLeaderboard(selectedMode());
  }

  function showBattle(){
    const menu = $("vocabMenuPanel");
    const battle = $("vocabBattlePanel");
    const reward = $("vocabRewardPanel");

    if(menu) menu.hidden = true;
    if(battle) battle.hidden = false;
    if(reward) reward.hidden = true;
  }

  function showReward(){
    const menu = $("vocabMenuPanel");
    const battle = $("vocabBattlePanel");
    const reward = $("vocabRewardPanel");

    if(menu) menu.hidden = true;
    if(battle) battle.hidden = true;
    if(reward) reward.hidden = false;
  }

  /* =========================================================
     HUD
  ========================================================= */

  function hearts(hp, maxHp){
    hp = Math.max(0, Number(hp || 0));
    maxHp = Math.max(1, Number(maxHp || 5));

    let out = "";
    for(let i = 0; i < maxHp; i++){
      out += i < hp ? "❤️" : "🖤";
    }
    return out;
  }

  function modeHud(mode){
    return {
      learn: "🤖 AI",
      speed: "⚡ Speed",
      mission: "🎯 Mission",
      battle: "👾 Boss"
    }[mode] || "🤖 AI";
  }

  function updateHud(state){
    state = Object.assign({}, getState(), state || {});

    if($("vocabScore")) $("vocabScore").textContent = Number(pick(state.score, 0));
    if($("vocabCombo")) $("vocabCombo").textContent = "x" + Number(pick(state.combo, state.currentCombo, 0));
    if($("vocabHp")) $("vocabHp").textContent = hearts(pick(state.hp, state.lives, 5), pick(state.maxHp, 5));
    if($("vocabTimer")) $("vocabTimer").textContent = Number(pick(state.timeLeft, state.timer, state.questionTimeSec, 0)) + "s";

    const qNo = Number(pick(state.questionNo, state.question_no, 0));
    const qCount = Number(pick(state.questionCount, state.question_count, 0));
    if($("vocabQuestionNo")) $("vocabQuestionNo").textContent = qNo + "/" + qCount;

    if($("vocabModeHud")) $("vocabModeHud").textContent = modeHud(pick(state.mode, "learn"));

    if($("vocabFeverChip")) $("vocabFeverChip").textContent = state.fever ? "🔥 Fever: ON" : "🔥 Fever: OFF";
    if($("vocabHintBtn")) $("vocabHintBtn").textContent = "💡 Hint x" + Number(pick(state.hints, state.hintCount, 0));
    if($("vocabAiHelpBtn")) $("vocabAiHelpBtn").textContent = "🤖 AI Help x" + Number(pick(state.aiHelpLeft, state.ai_help_left, state.aiHelp, 0));
    if($("vocabShieldChip")) $("vocabShieldChip").textContent = "🛡️ Shield x" + Number(pick(state.shields, state.shield, 0));
    if($("vocabLaserChip")) $("vocabLaserChip").textContent = state.laserReady ? "🔴 Laser: Ready" : "🔴 Laser: Not ready";

    if($("vocabStageChip")) $("vocabStageChip").textContent = pick(state.stageName, state.stage_name, "Question " + qNo);
    if($("vocabStageGoal")) $("vocabStageGoal").textContent = "Goal: " + pick(state.stageGoal, state.stage_goal, "ตอบให้ถูกและจำความหมาย");

    const bank = pick(state.bank, "A");
    const mode = pick(state.mode, "learn");
    const modeText = {
      learn: "🤖 AI Training",
      speed: "⚡ Speed Run",
      mission: "🎯 Debug Mission",
      battle: "👾 Boss Battle"
    }[mode] || mode;

    if($("vocabBankLabel")) $("vocabBankLabel").textContent = "Bank " + bank + " • " + modeText;

    updateEnemy(state);
  }

  function updateEnemy(state){
    state = state || {};

    if($("vocabEnemyAvatar")) $("vocabEnemyAvatar").textContent = pick(state.enemyAvatar, state.enemy_avatar, "👾");
    if($("vocabEnemyName")) $("vocabEnemyName").textContent = pick(state.enemyName, state.enemy_name, "Bug Slime");
    if($("vocabEnemySkill")) $("vocabEnemySkill").textContent = pick(state.enemySkill, state.enemy_skill, "Enemy skill");

    const hp = num(pick(state.enemyHp, state.enemy_hp, 100), 100);
    const max = Math.max(1, num(pick(state.enemyMaxHp, state.enemy_max_hp, 100), 100));
    const pct = Math.max(0, Math.min(100, Math.round((hp / max) * 100)));

    if($("vocabEnemyHpText")) $("vocabEnemyHpText").textContent = pct + "%";
    if($("vocabEnemyHpFill")) $("vocabEnemyHpFill").style.width = pct + "%";
  }

  /* =========================================================
     QUESTION RENDER
     IMPORTANT: no click binding here
  ========================================================= */

  function normalizeChoice(c){
    if(c && typeof c === "object"){
      return {
        text: clean(pick(c.text, c.label, c.value, c.answer, "")),
        value: clean(pick(c.value, c.text, c.label, c.answer, "")),
        correct: c.correct === true || c.isCorrect === true || c.is_correct === true
      };
    }

    return {
      text: clean(c),
      value: clean(c),
      correct: false
    };
  }

  function normalizeQuestion(q){
    q = q || {};
    const choices = Array.isArray(q.choices || q.options)
      ? (q.choices || q.options).map(normalizeChoice)
      : [];

    const correct = clean(pick(q.correct, q.correct_answer, q.correctAnswer, q.answer, ""));

    return {
      term: clean(pick(q.term, q.word, "")),
      prompt: clean(pick(q.prompt, q.question, q.question_text, q.questionText, "Question text")),
      hint: clean(pick(q.hint, q.tip, "")),
      explain: clean(pick(q.explain, q.explanation, "")),
      correct,
      choices
    };
  }

  function renderQuestion(question, state){
    const q = normalizeQuestion(question);
    state = state || getState();

    const qText = $("vocabQuestionText");
    if(qText){
      qText.innerHTML = `
        <span class="vocab-question-main v6-question-main">${esc(q.prompt)}</span>
        ${
          q.hint
            ? `<span class="vocab-question-hint v6-question-hint">💡 ${esc(q.hint)}</span>`
            : ""
        }
      `;
    }

    const choicesBox = $("vocabChoices");
    if(choicesBox){
      choicesBox.innerHTML = q.choices.map(function(choice, index){
        const isCorrect = q.correct && norm(choice.value) === norm(q.correct);

        return `
          <button
            class="vocab-choice v6-choice"
            type="button"
            data-vocab-choice-index="${index}"
            data-vocab-choice="${esc(choice.value)}"
            data-vocab-correct="${isCorrect ? "1" : "0"}">
            ${esc(choice.text)}
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

    /*
      ให้ Game เป็นคน bind คลิกปุ่มคำตอบ หลัง render เสร็จ
    */
    setTimeout(function(){
      if(WIN.VocabGame && typeof WIN.VocabGame.bindChoiceButtons === "function"){
        WIN.VocabGame.bindChoiceButtons();
      }
    }, 0);
  }

  function markChoiceResult(selected, correct, isCorrect){
    selected = clean(selected);
    correct = clean(correct);

    qsa("[data-vocab-choice]").forEach(function(btn){
      const value = clean(btn.dataset.vocabChoice || btn.textContent);

      btn.disabled = true;
      btn.classList.add("locked");

      if(correct && norm(value) === norm(correct)){
        btn.classList.add("correct");
      }

      if(norm(value) === norm(selected) && !isCorrect){
        btn.classList.add("wrong");
      }
    });
  }

  function unlockChoices(){
    qsa("[data-vocab-choice]").forEach(function(btn){
      btn.disabled = false;
      btn.classList.remove("locked", "correct", "wrong");
    });
  }

  /* =========================================================
     FEEDBACK
  ========================================================= */

  function pop(message, type){
    ensureCss();

    const el = DOC.createElement("div");
    el.className = "vocab-pop-final " + (type || "");
    el.textContent = message;
    DOC.body.appendChild(el);

    setTimeout(function(){
      try{ el.remove(); }catch(e){}
    }, 1000);
  }

  function scoreBurst(points, combo){
    ensureCss();

    if(points){
      const el = DOC.createElement("div");
      el.className = "vocab-score-final";
      el.textContent = "+" + points;
      DOC.body.appendChild(el);

      setTimeout(function(){
        try{ el.remove(); }catch(e){}
      }, 1000);
    }

    if(combo && combo >= 2){
      const c = DOC.createElement("div");
      c.className = "vocab-combo-final";
      c.textContent = "Combo x" + combo;
      DOC.body.appendChild(c);

      setTimeout(function(){
        try{ c.remove(); }catch(e){}
      }, 1000);
    }
  }

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
    }catch(e){}
  }

  function showExplain(html){
    const box = $("vocabExplainBox");
    if(!box) return;

    box.hidden = false;
    box.innerHTML = String(html || "");
  }

  function showAiHelp(text){
    const box = $("vocabAiHelpBox");
    if(!box) return;

    box.hidden = false;
    box.innerHTML = `<b>🤖 AI Help:</b> ${esc(text || "ลองดู keyword ในโจทย์ก่อน")}`;
  }

  /* =========================================================
     LEADERBOARD
  ========================================================= */

  function readBoard(){
    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.readLeaderboard === "function"){
        return WIN.VocabStorage.readLeaderboard();
      }
    }catch(e){}

    try{
      return JSON.parse(localStorage.getItem("VOCAB_SPLIT_LEADERBOARD") || "{}");
    }catch(e){
      return {};
    }
  }

  function renderLeaderboard(mode){
    mode = mode || selectedMode() || "learn";

    const box = $("vocabLeaderboardBox");
    if(!box) return;

    const board = readBoard();
    const rows = Array.isArray(board[mode]) ? board[mode] : [];

    qsa("[data-lb-mode]").forEach(function(tab){
      tab.classList.toggle("active", tab.dataset.lbMode === mode);
    });

    if(!rows.length){
      box.innerHTML = `<div class="vocab-lb-empty v68-lb-empty">ยังไม่มีคะแนนในโหมดนี้</div>`;
      return;
    }

    const sorted = rows.slice().sort(function(a,b){
      return Number(b.fair_score || b.fairScore || b.score || 0) -
             Number(a.fair_score || a.fairScore || a.score || 0);
    });

    box.innerHTML = sorted.slice(0, 5).map(function(row, index){
      const rank = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "#" + (index + 1);
      const name = pick(row.display_name, row.displayName, "Hero");
      const score = Number(pick(row.fair_score, row.fairScore, row.score, 0));
      const acc = Number(pick(row.accuracy, 0));
      const assisted = Number(pick(row.ai_help_used, row.aiHelpUsed, 0)) > 0;

      return `
        <div class="vocab-lb-row v68-lb-row">
          <div class="vocab-rank v68-rank">${rank}</div>
          <div class="vocab-lb-name v68-lb-name">
            <b>${esc(name)}</b>
            <small>Bank ${esc(row.bank || "A")} • ${esc(row.difficulty || row.diff || "easy")}</small>
          </div>
          <div class="vocab-lb-score v68-lb-score">${score}</div>
          <div class="v68-hide-mobile">
            <span class="vocab-lb-chip v68-lb-chip">${acc}%</span>
          </div>
          <div class="v68-hide-mobile">
            <span class="vocab-lb-chip v68-lb-chip ${assisted ? "assisted" : ""}">
              ${assisted ? "🤖 Assisted" : "🏅 No Help"}
            </span>
          </div>
        </div>
      `;
    }).join("");
  }

  /* =========================================================
     INIT
  ========================================================= */

  function init(){
    ensureCss();
    applyClassAliases();

    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.hydrateStudentForm === "function"){
        WIN.VocabStorage.hydrateStudentForm();
      }
    }catch(e){}

    syncMenuState();
    bindMenu();
    renderLeaderboard(selectedMode());

    console.log("[VOCAB UI] loaded", VERSION);
  }

  const api = {
    version: VERSION,

    init,
    boot: init,

    getState,
    patchState,
    syncMenuState,

    selectedBank,
    selectedDifficulty,
    selectedMode,
    buildStartOptions,

    showMenu,
    showBattle,
    showReward,

    updateHud,
    updateEnemy,

    renderQuestion,
    markChoiceResult,
    unlockChoices,

    pop,
    scoreBurst,
    beep,
    showExplain,
    showAiHelp,

    renderLeaderboard
  };

  WIN.VocabUI = api;
  WIN.VocabUi = api;

  WIN.VocabLeaderboard = {
    render: renderLeaderboard
  };

  WIN.VocabModules = WIN.VocabModules || {};
  WIN.VocabModules.ui = true;

  WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
  WIN.__VOCAB_MODULES__.ui = true;

  if(DOC.readyState === "loading"){
    DOC.addEventListener("DOMContentLoaded", init, { once:true });
  }else{
    init();
  }
})();
