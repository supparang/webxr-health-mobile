/* =========================================================
   /vocab/vocab.ui.js
   TechPath Vocab Arena — UI Controller
   PATCH: v20260503i
   Fix:
   - export window.VocabUI
   - boot no longer missing ui
   - bind menu / start / leaderboard tabs
   - render question choices
   - update HUD
   - support vocab-* ids/classes + old v6/v68 aliases
   - include leaderboard first page renderer
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const VERSION = "vocab-ui-v20260503i";

  let BOUND = false;
  let LAST_START_AT = 0;

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

  function setHidden(idOrEl, hidden){
    const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
    if(el) el.hidden = !!hidden;
  }

  function show(idOrEl){
    setHidden(idOrEl, false);
  }

  function hide(idOrEl){
    setHidden(idOrEl, true);
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

  /* =========================================================
     STATE
  ========================================================= */

  function getApp(){
    WIN.VOCAB_APP = WIN.VOCAB_APP || {};
    return WIN.VOCAB_APP;
  }

  function getState(){
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

  function selectedBank(){
    const active = qs("[data-vocab-bank].active");
    const state = getState();

    return (
      active?.dataset?.vocabBank ||
      state.selectedBank ||
      state.bank ||
      getParam("bank") ||
      "A"
    );
  }

  function selectedDifficulty(){
    const active = qs("[data-vocab-diff].active");
    const state = getState();

    return (
      active?.dataset?.vocabDiff ||
      state.selectedDifficulty ||
      state.difficulty ||
      state.diff ||
      getParam("diff") ||
      getParam("difficulty") ||
      "easy"
    );
  }

  function selectedMode(){
    const active = qs("[data-vocab-mode].active");
    const state = getState();

    return (
      active?.dataset?.vocabMode ||
      state.selectedMode ||
      state.mode ||
      getParam("mode") ||
      "learn"
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

    return {
      bank,
      difficulty,
      diff: difficulty,
      mode
    };
  }

  function syncActiveButtons(){
    const s = syncStateFromMenu();

    qsa("[data-vocab-bank]").forEach(function(btn){
      btn.classList.toggle("active", btn.dataset.vocabBank === s.bank);
    });

    qsa("[data-vocab-diff]").forEach(function(btn){
      btn.classList.toggle("active", btn.dataset.vocabDiff === s.difficulty);
    });

    qsa("[data-vocab-mode]").forEach(function(btn){
      btn.classList.toggle("active", btn.dataset.vocabMode === s.mode);
    });
  }

  /* =========================================================
     PROFILE
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
        pick(
          readInput("vocabDisplayName"),
          saved.display_name,
          saved.displayName,
          getParam("name"),
          getParam("nick"),
          "Hero"
        ),

      student_id:
        pick(
          readInput("vocabStudentId"),
          saved.student_id,
          saved.studentId,
          getParam("student_id"),
          getParam("sid"),
          getParam("pid"),
          "anon"
        ),

      section:
        pick(
          readInput("vocabSection"),
          saved.section,
          getParam("section"),
          ""
        ),

      session_code:
        pick(
          readInput("vocabSessionCode"),
          saved.session_code,
          saved.sessionCode,
          getParam("session_code"),
          getParam("studyId"),
          ""
        )
    };
  }

  function saveStudentProfile(){
    const profile = {
      display_name:
        pick(
          readInput("vocabDisplayName"),
          getParam("name"),
          getParam("nick"),
          "Hero"
        ),

      student_id:
        pick(
          readInput("vocabStudentId"),
          getParam("student_id"),
          getParam("sid"),
          getParam("pid"),
          "anon"
        ),

      section:
        pick(
          readInput("vocabSection"),
          getParam("section"),
          ""
        ),

      session_code:
        pick(
          readInput("vocabSessionCode"),
          getParam("session_code"),
          getParam("studyId"),
          ""
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
    let profile = getStudentProfile();

    if(WIN.VocabStorage && typeof WIN.VocabStorage.hydrateStudentForm === "function"){
      try{
        WIN.VocabStorage.hydrateStudentForm();
        profile = getStudentProfile();
      }catch(e){}
    }

    const map = {
      vocabDisplayName: profile.display_name === "Hero" ? "" : profile.display_name,
      vocabStudentId: profile.student_id === "anon" ? "" : profile.student_id,
      vocabSection: profile.section || "",
      vocabSessionCode: profile.session_code || ""
    };

    Object.keys(map).forEach(function(id){
      const el = $(id);
      if(el && !String(el.value || "").trim()){
        el.value = map[id];
      }
    });
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
    const diff = selectedDifficulty();
    const mode = selectedMode();

    const diffBox = $("vocabDiffPreview") || $("v6DiffPreview");
    if(diffBox) diffBox.textContent = diffPreviewText(diff);

    const modeBox = $("vocabModePreview") || $("v6ModePreview");
    if(modeBox) modeBox.textContent = modePreviewText(mode);
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

  function updateHud(state){
    state = state || getState();

    setText("vocabScore", toInt(pick(state.score, 0), 0));
    setText("vocabCombo", "x" + toInt(pick(state.combo, state.currentCombo, 0), 0));
    setText("vocabHp", hearts(pick(state.hp, state.lives, 5), pick(state.maxHp, 5)));
    setText("vocabTimer", toInt(pick(state.timeLeft, state.timer, state.time, 0), 0) + "s");

    const qNo = toInt(pick(state.questionNo, state.question_no, state.index, 0), 0);
    const total = toInt(pick(state.questionCount, state.question_count, state.totalQuestions, state.total, 0), 0);
    setText("vocabQuestionNo", qNo + "/" + total);

    const mode = pick(state.mode, selectedMode(), "learn");
    const modeLabel = {
      learn: "🤖 AI",
      speed: "⚡ Speed",
      mission: "🎯 Mission",
      battle: "👾 Boss"
    }[mode] || mode;

    setText("vocabModeHud", modeLabel);

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

    if(state.bank || state.mode){
      const bank = pick(state.bank, selectedBank(), "A");
      const modeText = {
        learn: "🤖 AI Training",
        speed: "⚡ Speed Run",
        mission: "🎯 Debug Mission",
        battle: "👾 Boss Battle"
      }[mode] || mode;

      setText("vocabBankLabel", "Bank " + bank + " • " + modeText);
    }

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
     QUESTION RENDER
  ========================================================= */

  function normalizeQuestion(q){
    q = q || {};

    const choices =
      q.choices ||
      q.options ||
      q.answers ||
      q.choiceList ||
      [];

    return {
      id: pick(q.id, q.question_id, q.qid, ""),
      term: pick(q.term, q.word, q.vocab, ""),
      prompt: pick(q.prompt, q.question, q.question_text, q.text, "Question text"),
      hint: pick(q.hint, q.tip, ""),
      choices: Array.isArray(choices) ? choices : [],
      correct:
        pick(q.correct, q.correct_answer, q.correctAnswer, q.answer, q.key, "")
    };
  }

  function renderQuestion(question, state){
    const q = normalizeQuestion(question);
    state = state || getState();

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
      const choices = q.choices.length ? q.choices : ["Option A", "Option B", "Option C", "Option D"];

      choicesBox.innerHTML = choices.map(function(choice, index){
        const text = typeof choice === "object"
          ? pick(choice.text, choice.label, choice.value, "")
          : choice;

        const value = typeof choice === "object"
          ? pick(choice.value, choice.text, choice.label, "")
          : choice;

        return `
          <button
            class="vocab-choice v6-choice"
            type="button"
            data-vocab-choice-index="${index}"
            data-vocab-choice="${esc(value)}">
            ${esc(text)}
          </button>
        `;
      }).join("");
    }

    hide("vocabExplainBox");
    hide("vocabAiHelpBox");

    updateHud(state);
  }

  function markChoiceResult(selectedValue, correctValue, explain){
    const selected = String(selectedValue ?? "");
    const correct = String(correctValue ?? "");

    qsa("[data-vocab-choice]").forEach(function(btn){
      const value = String(btn.dataset.vocabChoice ?? "");

      btn.disabled = true;

      if(value === correct){
        btn.classList.add("correct");
      }

      if(value === selected && value !== correct){
        btn.classList.add("wrong");
      }
    });

    const box = $("vocabExplainBox");
    if(box && explain){
      box.innerHTML = esc(explain);
      show(box);
    }
  }

  function showAiHelp(text){
    const box = $("vocabAiHelpBox");
    if(!box) return;

    box.innerHTML = `<b>🤖 AI Help:</b> ${esc(text || "ลองดูคำสำคัญในโจทย์ แล้วตัดตัวเลือกที่ไม่เกี่ยวข้องออกก่อน")}`;
    show(box);
  }

  function showExplain(text){
    const box = $("vocabExplainBox");
    if(!box) return;

    box.innerHTML = esc(text || "");
    show(box);
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
     EFFECTS
  ========================================================= */

  function floatText(text, type){
    const el = DOC.createElement("div");
    el.className = "vocab-float v6-float " + (type || "");
    el.textContent = text;

    DOC.body.appendChild(el);

    setTimeout(function(){
      try{ el.remove(); }catch(e){}
    }, 950);
  }

  function laserFx(){
    const beam = DOC.createElement("div");
    beam.className = "vocab-laser-beam v6-laser-beam";
    DOC.body.appendChild(beam);

    const burst = DOC.createElement("div");
    burst.className = "vocab-fx-burst v6-fx-burst";
    DOC.body.appendChild(burst);

    setTimeout(function(){
      try{ beam.remove(); }catch(e){}
      try{ burst.remove(); }catch(e){}
    }, 600);
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
      schema: WIN.VOCAB_APP?.schema || "vocab-split-v1",
      version: WIN.VOCAB_APP?.version || "vocab-split-v1"
    };
  }

  function startGame(){
    const now = Date.now();
    if(now - LAST_START_AT < 650) return;
    LAST_START_AT = now;

    const options = buildStartOptions();

    const game =
      WIN.VocabGame ||
      WIN.vocabGame ||
      WIN.VOCAB_GAME;

    if(!game){
      alert("ยังไม่พบ VocabGame");
      return;
    }

    showBattle();

    if(typeof game.start === "function"){
      game.start(options);
      return;
    }

    if(typeof game.startGame === "function"){
      game.startGame(options);
      return;
    }

    if(typeof game.boot === "function"){
      game.boot(options);
      return;
    }

    alert("VocabGame ไม่มี start/startGame/boot");
  }

  /* =========================================================
     LEADERBOARD
  ========================================================= */

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
      if(!Array.isArray(board[mode])) board[mode] = [];
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
    const fairScore = toNum(pick(result.fair_score, result.fairScore, aiHelpUsed > 0 ? Math.round(rawScore * 0.95) : rawScore), rawScore);

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

    writeJson("VOCAB_SPLIT_LEADERBOARD", board);
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
        qsa("[data-vocab-diff]").forEach(function(b){
          b.classList.toggle("active", b === btn);
        });

        patchState({
          difficulty: btn.dataset.vocabDiff || "easy",
          diff: btn.dataset.vocabDiff || "easy",
          selectedDifficulty: btn.dataset.vocabDiff || "easy"
        });

        updateMenuPreview();
      });
    });

    qsa("[data-vocab-mode]").forEach(function(btn){
      if(btn.__vocabUiModeBound) return;
      btn.__vocabUiModeBound = true;

      btn.addEventListener("click", function(){
        qsa("[data-vocab-mode]").forEach(function(b){
          b.classList.toggle("active", b === btn);
        });

        const mode = btn.dataset.vocabMode || "learn";

        patchState({
          mode,
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
        const mode = tab.dataset.lbMode || "learn";
        renderLeaderboard(mode);
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

  function bindChoiceButtons(){
    DOC.addEventListener("click", function(ev){
      const btn = ev.target.closest("[data-vocab-choice]");
      if(!btn) return;

      const value = btn.dataset.vocabChoice || "";

      const game =
        WIN.VocabGame ||
        WIN.vocabGame ||
        WIN.VOCAB_GAME;

      if(game && typeof game.answer === "function"){
        game.answer(value, btn);
        return;
      }

      if(game && typeof game.choose === "function"){
        game.choose(value, btn);
        return;
      }

      if(game && typeof game.submitAnswer === "function"){
        game.submitAnswer(value, btn);
      }
    });
  }

  function bindPowerButtons(){
    const hint = $("vocabHintBtn");
    if(hint && !hint.__vocabUiBound){
      hint.__vocabUiBound = true;
      hint.addEventListener("click", function(){
        const game = WIN.VocabGame || WIN.vocabGame || WIN.VOCAB_GAME;
        if(game && typeof game.useHint === "function") game.useHint();
      });
    }

    const ai = $("vocabAiHelpBtn");
    if(ai && !ai.__vocabUiBound){
      ai.__vocabUiBound = true;
      ai.addEventListener("click", function(){
        const game = WIN.VocabGame || WIN.vocabGame || WIN.VOCAB_GAME;
        if(game && typeof game.useAiHelp === "function"){
          game.useAiHelp();
        }else{
          showAiHelp();
        }
      });
    }
  }

  function bindEvents(){
    if(BOUND) return;
    BOUND = true;

    bindMenuSelectors();
    bindLeaderboardTabs();
    bindStartButton();
    bindChoiceButtons();
    bindPowerButtons();
  }

  /* =========================================================
     CSS COMPAT FOR LEADERBOARD
  ========================================================= */

  function ensureCssCompat(){
    if($("vocabUiCompatCss")) return;

    const style = DOC.createElement("style");
    style.id = "vocabUiCompatCss";
    style.textContent = `
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
     INIT
  ========================================================= */

  function init(){
    ensureCssCompat();

    hydrateStudentForm();
    syncActiveButtons();
    updateMenuPreview();
    bindEvents();
    renderLeaderboard(selectedMode());

    setTimeout(function(){
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
    renderQuestion,
    markChoiceResult,
    showAiHelp,
    showExplain,

    floatText,
    laserFx,

    buildStartOptions,
    startGame,

    renderLeaderboard,
    updateLeaderboardFromResult,
    readBoard
  };

  WIN.VocabUI = api;
  WIN.VocabUi = api;

  WIN.VocabLeaderboard = WIN.VocabLeaderboard || {
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

  console.log("[VOCAB UI] loaded", VERSION);
})();
