/* =========================================================
   /vocab/vocab.boot.js
   TechPath Vocab Arena — Boot Controller
   PATCH: v20260503g
   Fix:
   - Detect modules from real window exports, not flags only
   - Do not double-bind Start button when VocabUI exists
   - Auto hydrate student profile
   - Auto bind menu selectors
   - Auto render leaderboard on first page
   - Add CSS class compatibility for vocab-* / v6-* split versions
   - Tolerate missing reward by installing fallback reward module
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const VERSION = "vocab-boot-v20260503g";

  const REQUIRED_MODULES = [
    "config",
    "utils",
    "data",
    "state",
    "storage",
    "question",
    "ui",
    "game"
  ];

  const SOFT_MODULES = [
    "logger",
    "reward",
    "leaderboard",
    "guard"
  ];

  let BOOTED = false;
  let BOOT_TIMER = null;
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

  function nowIso(){
    try{
      return new Date().toISOString();
    }catch(e){
      return "";
    }
  }

  function log(){
    try{
      console.log.apply(console, ["[VOCAB BOOT]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function warn(){
    try{
      console.warn.apply(console, ["[VOCAB BOOT]"].concat(Array.from(arguments)));
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

  function setHidden(el, hidden){
    if(!el) return;
    el.hidden = !!hidden;
  }

  function addClass(el, cls){
    if(el && cls) el.classList.add(cls);
  }

  /* =========================================================
     CONFIG / APP GLOBAL
  ========================================================= */

  function ensureAppGlobal(){
    const config =
      WIN.VocabConfig ||
      WIN.VOCAB_CONFIG ||
      {};

    const app =
      WIN.VOCAB_APP ||
      {};

    WIN.VOCAB_APP = Object.assign({}, config, app);

    if(!WIN.VOCAB_APP.version){
      WIN.VOCAB_APP.version = "vocab-split-v1";
    }

    if(!WIN.VOCAB_APP.schema){
      WIN.VOCAB_APP.schema = "vocab-split-v1";
    }

    if(!WIN.VOCAB_APP.source){
      WIN.VOCAB_APP.source = "vocab.html";
    }

    if(!WIN.VOCAB_APP.selectedBank){
      WIN.VOCAB_APP.selectedBank = getParam("bank", "A") || "A";
    }

    if(!WIN.VOCAB_APP.selectedDifficulty){
      WIN.VOCAB_APP.selectedDifficulty =
        getParam("diff", getParam("difficulty", "easy")) ||
        "easy";
    }

    if(!WIN.VOCAB_APP.selectedMode){
      WIN.VOCAB_APP.selectedMode =
        getParam("mode", "learn") ||
        "learn";
    }

    if(!WIN.VOCAB_APP.bootVersion){
      WIN.VOCAB_APP.bootVersion = VERSION;
    }

    return WIN.VOCAB_APP;
  }

  /* =========================================================
     MODULE DETECTION
  ========================================================= */

  function hasFunction(obj, names){
    if(!obj) return false;

    for(const name of names){
      if(typeof obj[name] === "function"){
        return true;
      }
    }

    return false;
  }

  function getModules(){
    const config =
      WIN.VocabConfig ||
      WIN.VOCAB_CONFIG ||
      WIN.VOCAB_APP ||
      null;

    const data =
      WIN.VocabData ||
      WIN.VocabBankData ||
      WIN.VOCAB_DATA ||
      WIN.VOCAB_BANKS ||
      null;

    const question =
      WIN.VocabQuestion ||
      WIN.VocabQuestions ||
      WIN.VocabQuestionBank ||
      WIN.VocabQuestionEngine ||
      null;

    const ui =
      WIN.VocabUI ||
      WIN.VocabUi ||
      null;

    const game =
      WIN.VocabGame ||
      WIN.vocabGame ||
      WIN.VOCAB_GAME ||
      null;

    const reward =
      WIN.VocabReward ||
      WIN.vocabReward ||
      WIN.VOCAB_REWARD ||
      null;

    const logger =
      WIN.VocabLogger ||
      WIN.vocabLogger ||
      (typeof WIN.logVocabEventV6 === "function" ? { log: WIN.logVocabEventV6 } : null);

    const leaderboard =
      WIN.VocabLeaderboard ||
      null;

    const guard =
      WIN.VocabGuard ||
      null;

    return {
      config,
      utils: WIN.VocabUtils || null,
      data,
      state: WIN.VocabState || null,
      storage: WIN.VocabStorage || null,
      logger,
      question,
      ui,
      game,
      reward,
      leaderboard,
      guard
    };
  }

  function getModuleStatus(){
    const m = getModules();

    return {
      config: !!m.config,
      utils: !!m.utils,
      data: !!m.data,
      state: !!m.state,
      storage: !!m.storage,
      logger: !!m.logger,
      question: !!m.question,
      ui: !!m.ui,
      game: !!m.game,
      reward: !!m.reward,
      leaderboard: !!m.leaderboard,
      guard: !!m.guard
    };
  }

  function getMissingRequired(status){
    return REQUIRED_MODULES.filter(function(name){
      return !status[name];
    });
  }

  function markModuleFlags(status){
    WIN.VocabModules = WIN.VocabModules || {};
    WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};

    Object.keys(status).forEach(function(key){
      if(status[key]){
        WIN.VocabModules[key] = true;
        WIN.__VOCAB_MODULES__[key] = true;
      }
    });

    WIN.VocabModules.boot = true;
    WIN.__VOCAB_MODULES__.boot = true;
  }

  /* =========================================================
     CSS COMPATIBILITY
     รองรับกรณี HTML ใช้ vocab-* แต่ CSS ยังเป็น v6/v63/v66/v68
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

  function installCriticalCss(){
    if($("vocabBootCriticalCss")) return;

    const style = DOC.createElement("style");
    style.id = "vocabBootCriticalCss";
    style.textContent = `
      .vocab-boot-error{
        margin:0;
        min-height:100dvh;
        padding:32px;
        background:#fff4f4;
        color:#7f1d1d;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .vocab-boot-error h1{
        margin:0 0 18px;
        font-size:clamp(30px,5vw,48px);
      }

      .vocab-boot-error p{
        font-size:clamp(18px,3vw,28px);
        line-height:1.55;
      }

      .vocab-boot-error pre{
        white-space:pre-wrap;
        overflow:auto;
        background:#fff;
        border-radius:22px;
        padding:22px;
        font-size:16px;
        line-height:1.55;
      }

      .vocab-boot-badge{
        position:fixed;
        right:14px;
        top:14px;
        z-index:99999;
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding:9px 13px;
        border-radius:999px;
        background:rgba(7,17,31,.72);
        border:1px solid rgba(255,255,255,.16);
        color:#eef7ff;
        font-weight:900;
        font-size:12px;
        backdrop-filter:blur(12px);
      }
    `;

    DOC.head.appendChild(style);
  }

  function installBootBadge(){
    if($("vocabBootBadge")) return;

    const badge = DOC.createElement("div");
    badge.id = "vocabBootBadge";
    badge.className = "vocab-boot-badge";
    badge.textContent = "PROTECTED CLASSROOM";

    DOC.body.appendChild(badge);
  }

  /* =========================================================
     ERROR SCREEN
  ========================================================= */

  function showBootError(missing, status){
    installCriticalCss();

    const app = $("vocabApp") || DOC.body;

    const html = `
      <section class="vocab-boot-error">
        <h1>⚠️ Vocab boot error</h1>
        <p>
          โหลดไฟล์แล้ว แต่ยังไม่พบ module ที่ boot ต้องใช้
        </p>
        <p>
          Missing: <b>${esc(missing.join(", "))}</b>
        </p>
        <pre>${esc(JSON.stringify(status, null, 2))}</pre>
        <p>
          ให้ตรวจว่าไฟล์ export เป็นชื่อ window.VocabUtils, window.VocabState,
          window.VocabQuestion, window.VocabUI, window.VocabGame
          และเรียง script ตามลำดับถูกต้อง
        </p>
      </section>
    `;

    if(app && app !== DOC.body){
      app.innerHTML = html;
      app.hidden = false;
    }else{
      DOC.body.innerHTML = html;
    }
  }

  /* =========================================================
     STATE HELPERS
  ========================================================= */

  function getState(){
    const app = ensureAppGlobal();
    const stateMod = WIN.VocabState;

    try{
      if(stateMod && typeof stateMod.get === "function"){
        const s = stateMod.get();
        if(s && typeof s === "object") return s;
      }
    }catch(e){}

    if(stateMod && stateMod.state && typeof stateMod.state === "object"){
      return stateMod.state;
    }

    return app;
  }

  function patchState(update){
    update = update || {};

    const app = ensureAppGlobal();
    Object.assign(app, update);

    try{
      if(WIN.VocabState && typeof WIN.VocabState.set === "function"){
        WIN.VocabState.set(update);
      }else if(WIN.VocabState && WIN.VocabState.state){
        Object.assign(WIN.VocabState.state, update);
      }
    }catch(e){}
  }

  function getSelectedBank(){
    const state = getState();
    const active = qs("[data-vocab-bank].active");

    return (
      active?.dataset?.vocabBank ||
      state.selectedBank ||
      state.bank ||
      WIN.VOCAB_APP?.selectedBank ||
      "A"
    );
  }

  function getSelectedDifficulty(){
    const state = getState();
    const active = qs("[data-vocab-diff].active");

    return (
      active?.dataset?.vocabDiff ||
      active?.dataset?.difficulty ||
      state.selectedDifficulty ||
      state.difficulty ||
      WIN.VOCAB_APP?.selectedDifficulty ||
      "easy"
    );
  }

  function getSelectedMode(){
    const state = getState();
    const active = qs("[data-vocab-mode].active");

    return (
      active?.dataset?.vocabMode ||
      state.selectedMode ||
      state.mode ||
      WIN.VOCAB_APP?.selectedMode ||
      "learn"
    );
  }

  function syncActiveFromState(){
    const bank = getSelectedBank();
    const diff = getSelectedDifficulty();
    const mode = getSelectedMode();

    qsa("[data-vocab-bank]").forEach(function(btn){
      btn.classList.toggle("active", btn.dataset.vocabBank === bank);
    });

    qsa("[data-vocab-diff]").forEach(function(btn){
      btn.classList.toggle("active", btn.dataset.vocabDiff === diff);
    });

    qsa("[data-vocab-mode]").forEach(function(btn){
      btn.classList.toggle("active", btn.dataset.vocabMode === mode);
    });

    patchState({
      selectedBank: bank,
      selectedDifficulty: diff,
      selectedMode: mode,
      bank: bank,
      difficulty: diff,
      mode: mode
    });
  }

  /* =========================================================
     MENU PREVIEWS
  ========================================================= */

  function diffPreviewText(diff){
    const map = {
      easy: "✨ Easy: เวลาเยอะ เหมาะกับเริ่มจำความหมาย",
      normal: "🚀 Normal: สมดุลระหว่างเวลาและความท้าทาย",
      hard: "🔥 Hard: เวลาน้อยขึ้น โจทย์ไวขึ้น เหมาะกับฝึกจริงจัง",
      challenge: "⚡ Challenge: โหมดท้าทายสูงสุด คะแนนดีมีโอกาสติดอันดับ"
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

  function updatePreviews(){
    const diff = getSelectedDifficulty();
    const mode = getSelectedMode();

    const diffBox = $("vocabDiffPreview") || $("v6DiffPreview");
    if(diffBox){
      diffBox.textContent = diffPreviewText(diff);
    }

    const modeBox = $("vocabModePreview") || $("v6ModePreview");
    if(modeBox){
      modeBox.textContent = modePreviewText(mode);
    }
  }

  function bindMenuSelectors(){
    qsa("[data-vocab-bank]").forEach(function(btn){
      if(btn.__vocabBootBankBound) return;
      btn.__vocabBootBankBound = true;

      btn.addEventListener("click", function(){
        const value = btn.dataset.vocabBank || "A";

        qsa("[data-vocab-bank]").forEach(function(b){
          b.classList.toggle("active", b === btn);
        });

        patchState({
          selectedBank: value,
          bank: value
        });
      });
    });

    qsa("[data-vocab-diff]").forEach(function(btn){
      if(btn.__vocabBootDiffBound) return;
      btn.__vocabBootDiffBound = true;

      btn.addEventListener("click", function(){
        const value = btn.dataset.vocabDiff || "easy";

        qsa("[data-vocab-diff]").forEach(function(b){
          b.classList.toggle("active", b === btn);
        });

        patchState({
          selectedDifficulty: value,
          difficulty: value
        });

        updatePreviews();
      });
    });

    qsa("[data-vocab-mode]").forEach(function(btn){
      if(btn.__vocabBootModeBound) return;
      btn.__vocabBootModeBound = true;

      btn.addEventListener("click", function(){
        const value = btn.dataset.vocabMode || "learn";

        qsa("[data-vocab-mode]").forEach(function(b){
          b.classList.toggle("active", b === btn);
        });

        patchState({
          selectedMode: value,
          mode: value
        });

        updatePreviews();

        if(WIN.VocabLeaderboard && typeof WIN.VocabLeaderboard.render === "function"){
          WIN.VocabLeaderboard.render(value);
        }else if(typeof WIN.renderLeaderboardV68 === "function"){
          WIN.renderLeaderboardV68(value);
        }else{
          renderLeaderboardFallback(value);
        }
      });
    });
  }

  /* =========================================================
     STUDENT PROFILE
  ========================================================= */

  function loadStudentProfile(){
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
        getParam("name") ||
        getParam("nick") ||
        readInput("vocabDisplayName") ||
        saved.display_name ||
        saved.displayName ||
        "Hero",

      student_id:
        getParam("student_id") ||
        getParam("sid") ||
        getParam("pid") ||
        readInput("vocabStudentId") ||
        saved.student_id ||
        saved.studentId ||
        "anon",

      section:
        getParam("section") ||
        readInput("vocabSection") ||
        saved.section ||
        "",

      session_code:
        getParam("session_code") ||
        getParam("studyId") ||
        readInput("vocabSessionCode") ||
        saved.session_code ||
        saved.sessionCode ||
        ""
    };
  }

  function saveStudentProfile(){
    const profile = {
      display_name:
        readInput("vocabDisplayName") ||
        readInput("v63DisplayName") ||
        getParam("name") ||
        getParam("nick") ||
        "Hero",

      student_id:
        readInput("vocabStudentId") ||
        readInput("v63StudentId") ||
        getParam("student_id") ||
        getParam("sid") ||
        getParam("pid") ||
        "anon",

      section:
        readInput("vocabSection") ||
        readInput("v63Section") ||
        getParam("section") ||
        "",

      session_code:
        readInput("vocabSessionCode") ||
        readInput("v63SessionCode") ||
        getParam("session_code") ||
        getParam("studyId") ||
        "",

      updated_at: nowIso()
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
      }catch(e){
        warn("hydrateStudentForm failed", e);
      }
    }

    if(WIN.VocabStorage && typeof WIN.VocabStorage.bindStudentAutoSave === "function"){
      try{
        WIN.VocabStorage.bindStudentAutoSave();
      }catch(e){
        warn("bindStudentAutoSave failed", e);
      }
    }

    const profile = loadStudentProfile();

    const fields = {
      vocabDisplayName: profile.display_name === "Hero" ? "" : profile.display_name,
      vocabStudentId: profile.student_id === "anon" ? "" : profile.student_id,
      vocabSection: profile.section || "",
      vocabSessionCode: profile.session_code || "",

      v63DisplayName: profile.display_name === "Hero" ? "" : profile.display_name,
      v63StudentId: profile.student_id === "anon" ? "" : profile.student_id,
      v63Section: profile.section || "",
      v63SessionCode: profile.session_code || ""
    };

    Object.keys(fields).forEach(function(id){
      const el = $(id);
      if(el && !String(el.value || "").trim()){
        el.value = fields[id];
      }
    });

    [
      "vocabDisplayName",
      "vocabStudentId",
      "vocabSection",
      "vocabSessionCode",
      "v63DisplayName",
      "v63StudentId",
      "v63Section",
      "v63SessionCode"
    ].forEach(function(id){
      const el = $(id);
      if(!el || el.__vocabBootAutoSaveBound) return;

      el.__vocabBootAutoSaveBound = true;
      el.addEventListener("input", function(){
        saveStudentProfile();
      });
    });
  }

  /* =========================================================
     LEADERBOARD FALLBACK
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

  function readLeaderboardFallback(){
    if(WIN.VocabStorage && typeof WIN.VocabStorage.readLeaderboard === "function"){
      try{
        return normalizeBoard(WIN.VocabStorage.readLeaderboard());
      }catch(e){}
    }

    return normalizeBoard(
      readJson("VOCAB_SPLIT_LEADERBOARD", null) ||
      readJson("VOCAB_V71_LEADERBOARD", null) ||
      readJson("VOCAB_LEADERBOARD", null)
    );
  }

  function leaderboardBox(){
    return $("vocabLeaderboardBox") || $("v68LeaderboardBox");
  }

  function leaderboardModeInfo(mode){
    const map = {
      learn: ["🤖", "AI Training"],
      speed: ["⚡", "Speed Run"],
      mission: ["🎯", "Debug Mission"],
      battle: ["👾", "Boss Battle"],
      bossrush: ["💀", "Boss Rush"]
    };

    return map[mode] || map.learn;
  }

  function leaderboardRowHtml(row, index){
    const rank =
      index === 0 ? "🥇" :
      index === 1 ? "🥈" :
      index === 2 ? "🥉" :
      "#" + (index + 1);

    const score = Number(row.fair_score || row.score || 0);
    const acc = Number(row.accuracy || 0);
    const name = row.display_name || row.displayName || "Hero";
    const bank = row.bank || "-";
    const diff = row.difficulty || row.diff || "-";
    const assisted = Number(row.ai_assisted || row.ai_help_used || row.aiHelpUsed || 0) > 0;

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
          ${
            assisted
              ? `<span class="vocab-lb-chip v68-lb-chip assisted">🤖 Assisted</span>`
              : `<span class="vocab-lb-chip v68-lb-chip">🏅 No Help</span>`
          }
        </div>
      </div>
    `;
  }

  function renderLeaderboardFallback(mode){
    mode = mode || getSelectedMode();

    const box = leaderboardBox();
    if(!box) return;

    const board = readLeaderboardFallback();
    const rows = Array.isArray(board[mode]) ? board[mode] : [];
    const info = leaderboardModeInfo(mode);

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
        Number(b.fair_score || b.score || 0) -
        Number(a.fair_score || a.score || 0);

      if(s !== 0) return s;

      return Number(b.accuracy || 0) - Number(a.accuracy || 0);
    });

    box.innerHTML = sorted.slice(0, 5).map(leaderboardRowHtml).join("");
  }

  function installLeaderboardFallback(){
    if(WIN.VocabLeaderboard && typeof WIN.VocabLeaderboard.render === "function"){
      return;
    }

    WIN.VocabLeaderboard = {
      version: "leaderboard-fallback-from-" + VERSION,
      render: renderLeaderboardFallback,
      readBoard: readLeaderboardFallback
    };

    WIN.renderLeaderboardV68 = renderLeaderboardFallback;
  }

  function bindLeaderboardTabs(){
    qsa("[data-lb-mode]").forEach(function(tab){
      if(tab.__vocabBootLbBound) return;

      tab.__vocabBootLbBound = true;
      tab.addEventListener("click", function(){
        const mode = tab.dataset.lbMode || "learn";

        patchState({
          selectedMode: mode,
          mode: mode
        });

        if(WIN.VocabLeaderboard && typeof WIN.VocabLeaderboard.render === "function"){
          WIN.VocabLeaderboard.render(mode);
        }else{
          renderLeaderboardFallback(mode);
        }
      });
    });
  }

  function renderLeaderboardSoon(){
    const mode = getSelectedMode();

    function run(){
      try{
        if(WIN.VocabLeaderboard && typeof WIN.VocabLeaderboard.render === "function"){
          WIN.VocabLeaderboard.render(mode);
        }else{
          renderLeaderboardFallback(mode);
        }
      }catch(e){
        warn("leaderboard render failed", e);
      }
    }

    run();
    setTimeout(run, 250);
    setTimeout(run, 900);
  }

  /* =========================================================
     REWARD FALLBACK
  ========================================================= */

  function installRewardFallback(){
    if(WIN.VocabReward && typeof WIN.VocabReward.show === "function"){
      return;
    }

    WIN.VocabReward = {
      version: "reward-fallback-from-" + VERSION,

      show: function(summary){
        summary = summary || {};

        const panel = $("vocabRewardPanel");
        const menu = $("vocabMenuPanel");
        const battle = $("vocabBattlePanel");

        if(!panel){
          alert(
            "Score: " + Number(summary.score || 0) +
            "\nAccuracy: " + Number(summary.accuracy || 0) + "%"
          );
          return;
        }

        setHidden(menu, true);
        setHidden(battle, true);
        setHidden(panel, false);

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
            setHidden(panel, true);
            setHidden(battle, true);
            setHidden(menu, false);
            renderLeaderboardSoon();
          });
        }
      }
    };

    WIN.VocabModules = WIN.VocabModules || {};
    WIN.VocabModules.reward = true;

    WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
    WIN.__VOCAB_MODULES__.reward = true;
  }

  /* =========================================================
     START FALLBACK
     ไม่ผูกซ้ำถ้า VocabUI มี init/bind แล้ว
  ========================================================= */

  function collectStartOptions(){
    const profile = saveStudentProfile();

    const bank = getSelectedBank();
    const difficulty = getSelectedDifficulty();
    const mode = getSelectedMode();

    patchState({
      selectedBank: bank,
      selectedDifficulty: difficulty,
      selectedMode: mode,
      bank: bank,
      difficulty: difficulty,
      mode: mode
    });

    return {
      bank: bank,
      difficulty: difficulty,
      diff: difficulty,
      mode: mode,

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

  function callGameStart(options){
    const game =
      WIN.VocabGame ||
      WIN.vocabGame ||
      WIN.VOCAB_GAME;

    if(!game){
      showBootError(["game"], getModuleStatus());
      return;
    }

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

    throw new Error("VocabGame exists but has no start/startGame/boot function");
  }

  function bindStartFallback(){
    const btn =
      $("vocabStartBtn") ||
      $("v6StartBtn") ||
      qs("[data-vocab-start]");

    if(!btn) return;

    /*
      ถ้า VocabUI มี init/bindEvents ให้ UI เป็นคนผูกปุ่มหลัก
      boot จะไม่ผูกซ้ำ เพื่อกัน start 2 รอบ
    */
    const ui = WIN.VocabUI || WIN.VocabUi;
    const uiCanBind =
      ui &&
      (
        typeof ui.init === "function" ||
        typeof ui.bind === "function" ||
        typeof ui.bindEvents === "function" ||
        typeof ui.boot === "function"
      );

    if(uiCanBind){
      return;
    }

    if(btn.__vocabBootStartBound) return;

    btn.__vocabBootStartBound = true;

    btn.addEventListener("click", function(ev){
      ev.preventDefault();

      const now = Date.now();
      if(now - LAST_START_AT < 650) return;
      LAST_START_AT = now;

      try{
        const options = collectStartOptions();
        callGameStart(options);
      }catch(err){
        console.error("[VOCAB BOOT] start failed", err);
        alert("เริ่มเกมไม่ได้: " + (err && err.message ? err.message : err));
      }
    });
  }

  /* =========================================================
     INIT MODULES
  ========================================================= */

  function callOptionalInit(){
    const state = WIN.VocabState;
    const ui = WIN.VocabUI || WIN.VocabUi;
    const game = WIN.VocabGame || WIN.vocabGame || WIN.VOCAB_GAME;
    const guard = WIN.VocabGuard;

    try{
      if(state && typeof state.init === "function" && !state.__vocabBootInitDone){
        state.__vocabBootInitDone = true;
        state.init({
          bank: getSelectedBank(),
          difficulty: getSelectedDifficulty(),
          mode: getSelectedMode()
        });
      }
    }catch(e){
      warn("VocabState.init failed", e);
    }

    /*
      UI init เป็นตัวสำคัญ เพราะมัก bind Start, choices, leaderboard
    */
    try{
      if(ui && typeof ui.init === "function" && !ui.__vocabBootInitDone){
        ui.__vocabBootInitDone = true;
        ui.init();
      }else if(ui && typeof ui.boot === "function" && !ui.__vocabBootInitDone){
        ui.__vocabBootInitDone = true;
        ui.boot();
      }else if(ui && typeof ui.bindEvents === "function" && !ui.__vocabBootInitDone){
        ui.__vocabBootInitDone = true;
        ui.bindEvents();
      }else if(ui && typeof ui.bind === "function" && !ui.__vocabBootInitDone){
        ui.__vocabBootInitDone = true;
        ui.bind();
      }
    }catch(e){
      warn("VocabUI init failed", e);
    }

    /*
      Game init ต้องระวังไม่ให้เริ่มเกมเอง
    */
    try{
      if(game && typeof game.init === "function" && !game.__vocabBootInitDone){
        game.__vocabBootInitDone = true;
        game.init({
          silent: true,
          bootedBy: VERSION
        });
      }
    }catch(e){
      warn("VocabGame.init failed", e);
    }

    try{
      if(guard && typeof guard.init === "function" && !guard.__vocabBootInitDone){
        guard.__vocabBootInitDone = true;
        guard.init();
      }
    }catch(e){
      warn("VocabGuard.init failed", e);
    }
  }

  /* =========================================================
     MAIN BOOT
  ========================================================= */

  function boot(){
    if(BOOTED) return;

    ensureAppGlobal();
    installCriticalCss();
    applyClassAliases();

    const status = getModuleStatus();
    markModuleFlags(status);

    const missing = getMissingRequired(status);

    if(missing.length){
      warn("missing modules", missing, status);
      showBootError(missing, status);
      return;
    }

    BOOTED = true;

    installBootBadge();
    installRewardFallback();
    installLeaderboardFallback();

    syncActiveFromState();
    hydrateStudentForm();
    bindMenuSelectors();
    updatePreviews();

    bindLeaderboardTabs();
    callOptionalInit();
    bindStartFallback();

    renderLeaderboardSoon();

    WIN.VocabBoot = {
      version: VERSION,
      booted: true,
      booted_at: nowIso(),
      getStatus: getModuleStatus,
      getModules: getModules,
      renderLeaderboard: renderLeaderboardSoon,
      startOptions: collectStartOptions
    };

    WIN.VocabModules = WIN.VocabModules || {};
    WIN.VocabModules.boot = true;

    WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
    WIN.__VOCAB_MODULES__.boot = true;

    log("ready", VERSION, getModuleStatus());
  }

  function bootWhenReady(){
    let tries = 0;
    const maxTries = 50;

    function tick(){
      tries += 1;

      ensureAppGlobal();
      applyClassAliases();

      const status = getModuleStatus();
      markModuleFlags(status);

      const missing = getMissingRequired(status);

      if(!missing.length){
        clearInterval(BOOT_TIMER);
        BOOT_TIMER = null;
        boot();
        return;
      }

      if(tries >= maxTries){
        clearInterval(BOOT_TIMER);
        BOOT_TIMER = null;

        warn("boot timeout missing modules", missing, status);
        showBootError(missing, status);
      }
    }

    tick();

    if(!BOOTED && !BOOT_TIMER){
      BOOT_TIMER = setInterval(tick, 100);
    }
  }

  if(DOC.readyState === "loading"){
    DOC.addEventListener("DOMContentLoaded", bootWhenReady, { once:true });
  }else{
    bootWhenReady();
  }

  log("loaded", VERSION);
})();
