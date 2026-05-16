/* =========================================================
   /vocab/vocab.ui.js
   TechPath Vocab Arena — UI Controller
   FULL CLEAN PATCH: v20260504b

   Important:
   - UI renders screens/HUD/questions/leaderboard only
   - UI does NOT check answers
   - UI does NOT bind global answer capture
   - VocabGame is the only answer owner
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;
  const VERSION = "vocab-ui-v20260504b";

  let UI_BOUND = false;
  let audioCtx = null;

  /* =========================================================
     HELPERS
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
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function clean(s){
    return String(s ?? "").trim();
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

  function num(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function int(v, fallback){
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : Number(fallback || 0);
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

  function show(idOrEl){
    const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
    if(el) el.hidden = false;
  }

  function hide(idOrEl){
    const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
    if(el) el.hidden = true;
  }

  function setText(id, value){
    const el = $(id);
    if(el) el.textContent = String(value ?? "");
  }

  function setHtml(id, value){
    const el = $(id);
    if(el) el.innerHTML = String(value ?? "");
  }

  function getParam(name, fallback){
    try{
      return new URLSearchParams(location.search).get(name) || fallback || "";
    }catch(e){
      return fallback || "";
    }
  }

  function getApp(){
    WIN.VOCAB_APP = WIN.VOCAB_APP || {};
    return WIN.VOCAB_APP;
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

  function getState(){
    let s = {};

    try{
      if(WIN.VocabState && typeof WIN.VocabState.get === "function"){
        s = WIN.VocabState.get() || {};
      }else if(WIN.VocabState && WIN.VocabState.state){
        s = WIN.VocabState.state || {};
      }
    }catch(e){}

    return Object.assign({}, getApp(), s);
  }

  function selectedBank(){
    const active = qs("[data-vocab-bank].active");
    return clean(pick(
      active && active.dataset ? active.dataset.vocabBank : "",
      getState().bank,
      getParam("bank"),
      "A"
    )).toUpperCase();
  }

  function selectedDifficulty(){
    const active = qs("[data-vocab-diff].active");
    return clean(pick(
      active && active.dataset ? active.dataset.vocabDiff : "",
      getState().difficulty,
      getState().diff,
      getParam("diff"),
      "easy"
    )).toLowerCase();
  }

  function selectedMode(){
    const active = qs("[data-vocab-mode].active");
    return clean(pick(
      active && active.dataset ? active.dataset.vocabMode : "",
      getState().mode,
      getParam("mode"),
      "learn"
    )).toLowerCase();
  }

  /* =========================================================
     CSS ALIAS / FX CSS
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

  function ensureFxCss(){
    if($("vocabUiFxCss")) return;

    const style = DOC.createElement("style");
    style.id = "vocabUiFxCss";
    style.textContent = `
      .vocab-choice.correct,
      .v6-choice.correct{
        background:rgba(68,223,147,.32)!important;
        border-color:rgba(68,223,147,.98)!important;
        box-shadow:0 0 0 4px rgba(68,223,147,.18),0 18px 44px rgba(68,223,147,.22)!important;
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

      .vocab-fx-pop{
        position:fixed;
        z-index:999999;
        left:50%;
        top:42%;
        transform:translate(-50%,-50%);
        padding:18px 28px;
        border-radius:999px;
        color:#fff;
        font-size:clamp(28px,6vw,56px);
        font-weight:1000;
        pointer-events:none;
        text-shadow:0 8px 24px rgba(0,0,0,.35);
        animation:vocabFxPop .9s ease forwards;
      }

      .vocab-fx-pop.good{
        background:linear-gradient(135deg,#22c55e,#38bdf8);
      }

      .vocab-fx-pop.bad{
        background:linear-gradient(135deg,#ef4444,#fb7185);
      }

      .vocab-fx-score{
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
        animation:vocabFxScore .95s ease forwards;
      }

      .vocab-lb-row{
        display:grid;
        grid-template-columns:52px 1fr 100px 90px 110px;
        gap:10px;
        align-items:center;
        padding:12px 14px;
        border-bottom:1px solid rgba(255,255,255,.10);
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

      .vocab-lb-name b{display:block;}
      .vocab-lb-name small{display:block;color:var(--muted,#a8bdd6);margin-top:3px;}
      .vocab-lb-score{font-size:20px;font-weight:1000;text-align:right;}
      .vocab-lb-chip{
        display:inline-flex;
        justify-content:center;
        padding:6px 9px;
        border-radius:999px;
        background:rgba(255,255,255,.10);
        border:1px solid rgba(255,255,255,.14);
        color:var(--muted,#a8bdd6);
        font-weight:900;
        font-size:12px;
      }

      .vocab-lb-empty{
        padding:16px;
        color:var(--muted,#a8bdd6);
        font-weight:900;
        text-align:center;
      }

      .vocab-personal-best{
        margin:12px;
        padding:12px 14px;
        border-radius:18px;
        background:rgba(68,223,147,.12);
        border:1px solid rgba(68,223,147,.35);
        color:var(--text,#eef7ff);
        font-weight:900;
        line-height:1.45;
      }

      @keyframes vocabFxPop{
        0%{opacity:0;transform:translate(-50%,-28%) scale(.78);}
        20%{opacity:1;transform:translate(-50%,-50%) scale(1.08);}
        100%{opacity:0;transform:translate(-50%,-92%) scale(.96);}
      }

      @keyframes vocabFxScore{
        0%{opacity:0;transform:translateY(18px) scale(.75);}
        20%{opacity:1;transform:translateY(0) scale(1.08);}
        100%{opacity:0;transform:translateY(-62px) scale(.94);}
      }

      @media(max-width:720px){
        .vocab-lb-row{
          grid-template-columns:42px 1fr 80px;
        }
        .v68-hide-mobile{
          display:none;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  /* =========================================================
     MENU
  ========================================================= */

  function diffPreviewText(diff){
    return {
      easy: "✨ Easy: เวลาเยอะ เหมาะกับเริ่มจำความหมาย",
      normal: "🚀 Normal: สมดุลระหว่างเวลาและความท้าทาย",
      hard: "🔥 Hard: เวลาน้อยลง ศัตรูแรงขึ้น เหมาะกับฝึกจริงจัง",
      challenge: "⚡ Challenge: ท้าทายสูงสุด คะแนนดีมีโอกาสติดอันดับ"
    }[diff] || "✨ Easy: เวลาเยอะ เหมาะกับเริ่มจำความหมาย";
  }

  function modePreviewText(mode){
    return {
      learn: "🤖 AI Training: เรียนรู้คำศัพท์แบบค่อยเป็นค่อยไป มี Hint และคำอธิบายชัด",
      speed: "⚡ Speed Run: ตอบให้ไว ทำ Combo เข้า Fever ได้เร็วขึ้น",
      mission: "🎯 Debug Mission: ฝึกคำศัพท์ในสถานการณ์จริงของงาน CS/AI",
      battle: "👾 Boss Battle: ต่อสู้กับบอส ใช้ Combo, Shield, Fever และ Laser ให้คุ้ม"
    }[mode] || "🤖 AI Training: เรียนรู้คำศัพท์แบบค่อยเป็นค่อยไป มี Hint และคำอธิบายชัด";
  }

  function updateMenuPreview(){
    setText("vocabDiffPreview", diffPreviewText(selectedDifficulty()));
    setText("vocabModePreview", modePreviewText(selectedMode()));

    patchState({
      bank: selectedBank(),
      selectedBank: selectedBank(),
      difficulty: selectedDifficulty(),
      diff: selectedDifficulty(),
      selectedDifficulty: selectedDifficulty(),
      mode: selectedMode(),
      selectedMode: selectedMode()
    });
  }

  function bindMenuSelectors(){
    qsa("[data-vocab-bank]").forEach(function(btn){
      if(btn.__vocabUiBankBound) return;
      btn.__vocabUiBankBound = true;

      btn.addEventListener("click", function(){
        qsa("[data-vocab-bank]").forEach(b => b.classList.toggle("active", b === btn));
        updateMenuPreview();
      });
    });

    qsa("[data-vocab-diff]").forEach(function(btn){
      if(btn.__vocabUiDiffBound) return;
      btn.__vocabUiDiffBound = true;

      btn.addEventListener("click", function(){
        qsa("[data-vocab-diff]").forEach(b => b.classList.toggle("active", b === btn));
        updateMenuPreview();
      });
    });

    qsa("[data-vocab-mode]").forEach(function(btn){
      if(btn.__vocabUiModeBound) return;
      btn.__vocabUiModeBound = true;

      btn.addEventListener("click", function(){
        qsa("[data-vocab-mode]").forEach(b => b.classList.toggle("active", b === btn));
        updateMenuPreview();
        renderLeaderboard(btn.dataset.vocabMode || "learn");
      });
    });
  }

  function hydrateStudentForm(){
    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.hydrateStudentForm === "function"){
        WIN.VocabStorage.hydrateStudentForm();
      }
    }catch(e){}
  }

  /* =========================================================
     SCREENS
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
    hp = Math.max(0, int(hp, 5));
    maxHp = Math.max(1, int(maxHp, 5));

    let out = "";
    for(let i = 0; i < maxHp; i++){
      out += i < hp ? "❤️" : "🖤";
    }
    return out;
  }

  function modeHudLabel(mode){
    return {
      learn: "🤖 AI",
      speed: "⚡ Speed",
      mission: "🎯 Mission",
      battle: "👾 Boss",
      bossrush: "🐉 Boss"
    }[mode] || "🤖 AI";
  }

  function updateHud(input){
    const s = Object.assign({}, getState(), input || {});

    const score = int(pick(s.score, 0), 0);
    const combo = int(pick(s.combo, s.currentCombo, 0), 0);
    const hp = int(pick(s.hp, s.lives, 5), 5);
    const maxHp = int(pick(s.maxHp, 5), 5);
    const timeLeft = int(pick(s.timeLeft, s.timer, s.questionTimeSec, 0), 0);
    const qNo = int(pick(s.questionNo, s.question_no, 0), 0);
    const qCount = int(pick(s.questionCount, s.question_count, 0), 0);
    const mode = clean(pick(s.mode, selectedMode(), "learn"));

    setText("vocabScore", score);
    setText("vocabCombo", "x" + combo);
    setText("vocabHp", hearts(hp, maxHp));
    setText("vocabTimer", timeLeft + "s");
    setText("vocabQuestionNo", qNo + "/" + qCount);
    setText("vocabModeHud", modeHudLabel(mode));

    setText("vocabFeverChip", s.fever || s.isFever ? "🔥 Fever: ON" : "🔥 Fever: OFF");
    setText("vocabHintBtn", "💡 Hint x" + int(pick(s.hints, s.hintCount, 0), 0));
    setText("vocabAiHelpBtn", "🤖 AI Help x" + int(pick(s.aiHelpLeft, s.ai_help_left, s.aiHelp, 0), 0));
    setText("vocabShieldChip", "🛡️ Shield x" + int(pick(s.shields, s.shield, 0), 0));
    setText("vocabLaserChip", s.laserReady || s.laser_ready ? "🔴 Laser: Ready" : "🔴 Laser: Not ready");

    setText("vocabStageChip", pick(s.stageName, s.stage_name, qNo ? "Question " + qNo : "Question"));
    setText("vocabStageGoal", "Goal: " + pick(s.stageGoal, s.stage_goal, "ตอบให้ถูกและจำความหมาย"));

    const bank = pick(s.bank, selectedBank(), "A");
    const modeText = {
      learn: "🤖 AI Training",
      speed: "⚡ Speed Run",
      mission: "🎯 Debug Mission",
      battle: "👾 Boss Battle",
      bossrush: "🐉 Boss Rush"
    }[mode] || mode;

    setText("vocabBankLabel", "Bank " + bank + " • " + modeText);

    updateEnemy(s);
  }

  function updateEnemy(input){
    const s = input || getState();

    setText("vocabEnemyAvatar", pick(s.enemyAvatar, s.enemy_avatar, "👾"));
    setText("vocabEnemyName", pick(s.enemyName, s.enemy_name, "Bug Slime"));
    setText("vocabEnemySkill", pick(s.enemySkill, s.enemy_skill, "Enemy skill"));

    const hp = Math.max(0, num(pick(s.enemyHp, s.enemy_hp, 100), 100));
    const max = Math.max(1, num(pick(s.enemyMaxHp, s.enemy_max_hp, 100), 100));
    const pct = Math.max(0, Math.min(100, Math.round((hp / max) * 100)));

    setText("vocabEnemyHpText", pct + "%");

    const fill = $("vocabEnemyHpFill");
    if(fill) fill.style.width = pct + "%";
  }

  /* =========================================================
     QUESTION RENDER
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
    const rawChoices = q.choices || q.options || q.answers || [];

    const choices = Array.isArray(rawChoices) ? rawChoices.map(normalizeChoice) : [];

    let correct = clean(pick(q.correct, q.correct_answer, q.correctAnswer, q.answer, ""));

    if(!correct){
      const flagged = choices.find(x => x.correct);
      if(flagged) correct = flagged.value;
    }

    return Object.assign({}, q, {
      term: clean(pick(q.term, q.word, q.vocab, "")),
      prompt: clean(pick(q.prompt, q.question, q.question_text, q.questionText, q.text, "Question text")),
      choices,
      options: choices,
      correct,
      correct_answer: correct,
      correctAnswer: correct,
      hint: clean(pick(q.hint, q.tip, "")),
      explain: clean(pick(q.explain, q.explanation, q.feedback, ""))
    });
  }

  function renderQuestion(question, inputState){
    const q = normalizeQuestion(question);
    const s = Object.assign({}, getState(), inputState || {});

    patchState({
      currentQuestion: q,
      question: q,
      activeQuestion: q,
      questionNo: pick(s.questionNo, s.question_no, 1),
      questionCount: pick(s.questionCount, s.question_count, 0)
    });

    const questionBox = $("vocabQuestionText");
    if(questionBox){
      questionBox.innerHTML = `
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
      const choices = q.choices.length ? q.choices : [
        { text:"Option A", value:"Option A" },
        { text:"Option B", value:"Option B" },
        { text:"Option C", value:"Option C" },
        { text:"Option D", value:"Option D" }
      ];

      choicesBox.innerHTML = choices.map(function(choice, index){
        const value = clean(choice.value || choice.text);
        const text = clean(choice.text || value);
        const isCorrect = q.correct && value.toLowerCase() === q.correct.toLowerCase();

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

    updateHud(s);

    /*
      สำคัญ: UI ไม่ bind click เอง
      ให้ VocabGame.syncChoiceButtons() เป็นเจ้าของปุ่มคำตอบ
    */
    setTimeout(function(){
      try{
        if(WIN.VocabGame && typeof WIN.VocabGame.syncChoiceButtons === "function"){
          WIN.VocabGame.syncChoiceButtons();
        }
      }catch(e){}
    }, 0);

    return q;
  }

  function markChoiceResult(selected, correct, isCorrect){
    selected = clean(selected);
    correct = clean(correct);

    qsa("[data-vocab-choice]").forEach(function(btn){
      const value = clean(btn.dataset.vocabChoice || btn.textContent);
      const correctBtn = correct && value.toLowerCase() === correct.toLowerCase();

      btn.disabled = true;
      btn.classList.add("locked");

      if(correctBtn){
        btn.classList.add("correct");
        btn.classList.remove("wrong");
      }

      if(value.toLowerCase() === selected.toLowerCase() && !correctBtn){
        btn.classList.add("wrong");
      }
    });
  }

  function unlockChoiceButtons(){
    qsa("[data-vocab-choice]").forEach(function(btn){
      btn.disabled = false;
      btn.classList.remove("locked", "correct", "wrong");
    });
  }

  /* =========================================================
     FEEDBACK
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
    }catch(e){}
  }

  function pop(message, type){
    ensureFxCss();

    const el = DOC.createElement("div");
    el.className = "vocab-fx-pop " + (type || "");
    el.textContent = message;
    DOC.body.appendChild(el);

    setTimeout(function(){
      try{ el.remove(); }catch(e){}
    }, 1000);
  }

  function scoreBurst(points){
    if(!points) return;

    ensureFxCss();

    const el = DOC.createElement("div");
    el.className = "vocab-fx-score";
    el.textContent = "+" + points;
    DOC.body.appendChild(el);

    setTimeout(function(){
      try{ el.remove(); }catch(e){}
    }, 1000);
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

    box.hidden = false;
    box.innerHTML = `<b>🤖 AI Help:</b> ${esc(text || "ลองดู keyword ในโจทย์ แล้วตัดตัวเลือกที่ไม่เกี่ยวข้องออกก่อน")}`;
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

    return readJson("VOCAB_SPLIT_LEADERBOARD", {
      learn: [],
      speed: [],
      mission: [],
      battle: [],
      bossrush: []
    });
  }

  function normalizeMode(mode){
    mode = clean(mode || "learn").toLowerCase();

    if(mode === "ai" || mode === "training") return "learn";
    if(mode === "debug") return "mission";
    if(mode === "boss") return "battle";

    return mode || "learn";
  }

  function renderLeaderboard(mode){
    mode = normalizeMode(mode || selectedMode());

    const box = $("vocabLeaderboardBox");
    if(!box) return;

    qsa("[data-lb-mode]").forEach(function(tab){
      tab.classList.toggle("active", normalizeMode(tab.dataset.lbMode) === mode);
    });

    const board = readBoard();
    const rows = Array.isArray(board[mode]) ? board[mode] : [];

    if(!rows.length){
      box.innerHTML = `<div class="vocab-lb-empty v68-lb-empty">ยังไม่มีคะแนนในโหมดนี้</div>`;
      return;
    }

    const sorted = rows.slice().sort(function(a, b){
      const sa = num(pick(a.fair_score, a.fairScore, a.score, 0), 0);
      const sb = num(pick(b.fair_score, b.fairScore, b.score, 0), 0);

      if(sb !== sa) return sb - sa;

      return num(b.accuracy,0) - num(a.accuracy,0);
    });

    box.innerHTML = sorted.slice(0, 5).map(function(row, idx){
      const rank =
        idx === 0 ? "🥇" :
        idx === 1 ? "🥈" :
        idx === 2 ? "🥉" :
        "#" + (idx + 1);

      const score = num(pick(row.fair_score, row.fairScore, row.score, 0), 0);
      const acc = num(row.accuracy, 0);
      const name = pick(row.display_name, row.displayName, row.name, "Hero");
      const bank = pick(row.bank, "A");
      const diff = pick(row.difficulty, row.diff, "easy");
      const ai = num(pick(row.ai_help_used, row.aiHelpUsed, row.ai_assisted, 0), 0);

      return `
        <div class="vocab-lb-row v68-lb-row">
          <div class="vocab-rank v68-rank">${rank}</div>
          <div class="vocab-lb-name v68-lb-name">
            <b>${esc(name)}</b>
            <small>Bank ${esc(bank)} • ${esc(diff)}</small>
          </div>
          <div class="vocab-lb-score v68-lb-score">${score}</div>
          <div class="v68-hide-mobile">
            <span class="vocab-lb-chip v68-lb-chip">${acc}%</span>
          </div>
          <div class="v68-hide-mobile">
            <span class="vocab-lb-chip v68-lb-chip">${ai > 0 ? "🤖 Assisted" : "🏅 No Help"}</span>
          </div>
        </div>
      `;
    }).join("");
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

  /* =========================================================
     POWER BUTTONS
  ========================================================= */

  function bindPowerButtons(){
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

    const laser = $("vocabLaserChip");
    if(laser && !laser.__vocabUiLaserBound){
      laser.__vocabUiLaserBound = true;
      laser.addEventListener("click", function(ev){
        ev.preventDefault();
        if(WIN.VocabGame && typeof WIN.VocabGame.useLaser === "function"){
          WIN.VocabGame.useLaser();
        }
      });
    }
  }

  /* =========================================================
     START BUTTON
  ========================================================= */

  function getStudentProfile(){
    if(WIN.VocabStorage && typeof WIN.VocabStorage.loadStudentProfile === "function"){
      try{
        return WIN.VocabStorage.loadStudentProfile();
      }catch(e){}
    }

    return {
      display_name: clean(pick($("vocabDisplayName") && $("vocabDisplayName").value, "Hero")),
      student_id: clean(pick($("vocabStudentId") && $("vocabStudentId").value, "anon")),
      section: clean(pick($("vocabSection") && $("vocabSection").value, "")),
      session_code: clean(pick($("vocabSessionCode") && $("vocabSessionCode").value, ""))
    };
  }

  function buildStartOptions(){
    const p = getStudentProfile();

    return {
      bank: selectedBank(),
      difficulty: selectedDifficulty(),
      diff: selectedDifficulty(),
      mode: selectedMode(),

      display_name: pick(p.display_name, p.displayName, "Hero"),
      displayName: pick(p.display_name, p.displayName, "Hero"),
      student_id: pick(p.student_id, p.studentId, "anon"),
      studentId: pick(p.student_id, p.studentId, "anon"),
      section: pick(p.section, ""),
      session_code: pick(p.session_code, p.sessionCode, ""),
      sessionCode: pick(p.session_code, p.sessionCode, ""),

      seed: Number(getParam("seed", Date.now())) || Date.now()
    };
  }

  function bindStartButton(){
    const btn = $("vocabStartBtn");
    if(!btn || btn.__vocabUiStartBound) return;

    btn.__vocabUiStartBound = true;

    btn.addEventListener("click", function(ev){
      ev.preventDefault();

      const options = buildStartOptions();

      try{
        if(WIN.VocabStorage && typeof WIN.VocabStorage.saveStudentProfile === "function"){
          WIN.VocabStorage.saveStudentProfile({
            display_name: options.display_name,
            student_id: options.student_id,
            section: options.section,
            session_code: options.session_code
          });
        }
      }catch(e){}

      if(WIN.VocabGame && typeof WIN.VocabGame.start === "function"){
        WIN.VocabGame.start(options);
      }
    });
  }

  /* =========================================================
     DISABLED CHOICE CAPTURE
  ========================================================= */

  function bindChoiceCapture(){
    /*
      v20260504b:
      Intentionally disabled.
      UI must not capture/check answers.
      VocabGame is the only answer owner.
    */
    return;
  }

  /* =========================================================
     INIT
  ========================================================= */

  function bindEvents(){
    if(UI_BOUND) return;
    UI_BOUND = true;

    bindMenuSelectors();
    bindLeaderboardTabs();
    bindPowerButtons();
    bindStartButton();
    bindChoiceCapture();
  }

  function init(){
    ensureFxCss();
    applyClassAliases();
    hydrateStudentForm();
    updateMenuPreview();
    bindEvents();
    updateHud(getState());
    renderLeaderboard(selectedMode());

    setTimeout(function(){
      applyClassAliases();
      renderLeaderboard(selectedMode());
    }, 300);

    return true;
  }

  const api = {
    version: VERSION,

    init,
    boot: init,
    bind: bindEvents,
    bindEvents,

    getState,
    patchState,

    selectedBank,
    selectedDifficulty,
    selectedMode,
    buildStartOptions,

    showMenu,
    showBattle,
    showReward,

    updateHud,
    updateEnemy,

    normalizeQuestion,
    renderQuestion,
    markChoiceResult,
    unlockChoiceButtons,

    showExplain,
    showAiHelp,
    pop,
    scoreBurst,
    beep,

    renderLeaderboard,

    bindChoiceCapture
  };

  WIN.VocabUI = api;
  WIN.VocabUi = api;

  WIN.VocabLeaderboard = {
    version: "leaderboard-from-" + VERSION,
    render: renderLeaderboard
  };

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
