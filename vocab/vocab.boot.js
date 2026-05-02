/* =========================================================
   /vocab/vocab.boot.js
   TechPath Vocab Arena — Central Boot / Screen Governor
   Version: 20260502a

   ต้องโหลดเป็นไฟล์ท้าย ๆ หลัง:
   - vocab.config.js
   - vocab.utils.js
   - vocab.state.js
   - vocab.data.js
   - vocab.question.js
   - vocab.ui.js
   - vocab.storage.js
   - vocab.game.js
   - vocab.guard.js

   หน้าที่:
   - boot เกมจากจุดเดียว
   - sync UI เริ่มต้น
   - ป้องกันหลาย screen แสดงพร้อมกัน
   - ป้องกัน reward/menu/battle ซ้อนกัน
   - bind ปุ่ม Start / Hint / AI Help / Leaderboard / Reward buttons
   ========================================================= */

(function(){
  "use strict";

  const U = window.VocabUtils;
  const S = window.VocabState;
  const UI = window.VocabUI;
  const Storage = window.VocabStorage;
  const Game = window.VocabGame;
  const Guard = window.VocabGuard;

  if(!U || !S || !UI || !Storage || !Game){
    console.error("[VOCAB] vocab.boot.js requires utils/state/ui/storage/game modules");
    return;
  }

  const Boot = {
    version: "20260502a",
    booted: false,
    governorTimer: null
  };

  function app(){
    return window.VOCAB_APP || {};
  }

  function game(){
    return window.vocabGame || S.game;
  }

  /* =========================================================
     SAFE CALL
  ========================================================= */

  function safeCall(name, fn){
    try{
      if(typeof fn === "function"){
        return fn();
      }
    }catch(err){
      console.warn(`[VOCAB BOOT] ${name} failed`, err);
    }

    return null;
  }

  /* =========================================================
     ELEMENT HELPERS
  ========================================================= */

  function byId(id){
    return document.getElementById(id);
  }

  function show(node, displayValue = ""){
    if(!node) return;

    node.hidden = false;
    node.style.display = displayValue;
    node.style.pointerEvents = "auto";
  }

  function hide(node){
    if(!node) return;

    node.hidden = true;
    node.style.display = "none";
    node.style.pointerEvents = "none";
  }

  function screenEls(){
    return {
      menu: byId("v6MenuPanel"),
      battle: byId("v6BattlePanel"),
      reward: byId("v6RewardPanel")
    };
  }

  /* =========================================================
     SCREEN GOVERNOR
  ========================================================= */

  Boot.showMenu = function showMenu(){
    const { menu, battle, reward } = screenEls();

    if(game().timerId){
      clearInterval(game().timerId);
      clearTimeout(game().timerId);
      game().timerId = null;
    }

    if(game().feverTimerId){
      clearTimeout(game().feverTimerId);
      clearInterval(game().feverTimerId);
      game().feverTimerId = null;
    }

    game().active = false;
    game().fever = false;
    game().feverUntil = 0;

    hide(battle);
    hide(reward);
    show(menu, "");

    window.scrollTo({ top:0, behavior:"auto" });

    safeCall("render leaderboard", () => {
      Storage.renderLeaderboard(app().selectedMode || "learn");
    });
  };

  Boot.showBattle = function showBattle(){
    const { menu, battle, reward } = screenEls();

    hide(menu);
    hide(reward);
    show(battle, "");

    window.scrollTo({ top:0, behavior:"auto" });
  };

  Boot.showReward = function showReward(){
    const { menu, battle, reward } = screenEls();

    hide(menu);
    hide(battle);
    show(reward, "block");

    if(reward){
      reward.style.position = "relative";
      reward.style.zIndex = "20";
      reward.style.minHeight = "auto";
      reward.style.height = "auto";
      reward.style.pointerEvents = "auto";
    }

    window.scrollTo({ top:0, behavior:"auto" });
  };

  Boot.governScreens = function governScreens(){
    const { menu, battle, reward } = screenEls();

    if(!menu || !battle || !reward) return;

    const rewardVisible =
      !reward.hidden &&
      reward.style.display !== "none" &&
      String(reward.innerHTML || "").trim().length > 0;

    if(rewardVisible && !game().active){
      Boot.showReward();
      return;
    }

    if(game().active){
      Boot.showBattle();
      return;
    }

    const anyVisible =
      !menu.hidden ||
      !battle.hidden ||
      !reward.hidden;

    if(!anyVisible){
      Boot.showMenu();
    }
  };

  Boot.startGovernor = function startGovernor(){
    if(Boot.governorTimer){
      clearInterval(Boot.governorTimer);
    }

    Boot.governorTimer = setInterval(Boot.governScreens, 500);

    setTimeout(Boot.governScreens, 300);
    setTimeout(Boot.governScreens, 900);
    setTimeout(Boot.governScreens, 1800);
  };

  /* =========================================================
     CLEAN FX / TIMERS
  ========================================================= */

  Boot.clearTimers = function clearTimers(){
    const g = game();

    if(g.timerId){
      clearInterval(g.timerId);
      clearTimeout(g.timerId);
      g.timerId = null;
    }

    if(g.feverTimerId){
      clearTimeout(g.feverTimerId);
      clearInterval(g.feverTimerId);
      g.feverTimerId = null;
    }

    g.fever = false;
    g.feverUntil = 0;

    safeCall("clearTimerV6", window.clearTimerV6);
    safeCall("stopFeverV62", window.stopFeverV62);
  };

  Boot.clearFx = function clearFx(){
    [
      ".v6-float",
      ".v6-laser-beam",
      ".v6-fx-burst",
      ".v72-announcer",
      ".v72-flash",
      ".v72-particle",
      ".v74-toast",
      ".v78-guard-toast"
    ].forEach(sel => {
      document.querySelectorAll(sel).forEach(node => {
        try{ node.remove(); }catch(e){}
      });
    });

    document.body.classList.remove(
      "v72-screen-shake",
      "v72-hard-hit",
      "v72-boss-rage",
      "v72-fever-rainbow",
      "v73-final-lock"
    );
  };

  /* =========================================================
     MENU SELECTION SYNC
  ========================================================= */

  Boot.syncMenuSelections = function syncMenuSelections(){
    document.querySelectorAll("[data-v6-bank]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.v6Bank === app().selectedBank);
    });

    document.querySelectorAll("[data-v6-diff]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.v6Diff === app().selectedDifficulty);
    });

    document.querySelectorAll("[data-v6-mode]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.v6Mode === app().selectedMode);
    });

    safeCall("update diff preview", UI.updateDiffPreview);
    safeCall("update mode preview", UI.updateModePreview);
    safeCall("update bank label", UI.updateBankLabel);
    safeCall("update mode hud", UI.updateModeHud);
  };

  Boot.getCurrentOptions = function getCurrentOptions(){
    const g = game();

    return {
      bank: g.bank || app().selectedBank || "A",
      difficulty: g.difficulty || app().selectedDifficulty || "normal",
      mode: g.mode || app().selectedMode || "learn"
    };
  };

  Boot.nextDifficulty = function nextDifficulty(diff){
    diff = String(diff || "normal").toLowerCase();

    if(diff === "easy") return "normal";
    if(diff === "normal") return "hard";
    if(diff === "hard") return "challenge";

    return "challenge";
  };

  /* =========================================================
     START RUN
  ========================================================= */

  Boot.startRun = function startRun(options){
    Boot.clearTimers();
    Boot.clearFx();

    options = {
      bank: options?.bank || app().selectedBank || "A",
      difficulty: options?.difficulty || app().selectedDifficulty || "normal",
      mode: options?.mode || app().selectedMode || "learn"
    };

    if(window.VOCAB_APP){
      VOCAB_APP.selectedBank = options.bank;
      VOCAB_APP.selectedDifficulty = options.difficulty;
      VOCAB_APP.selectedMode = options.mode;
    }

    Boot.syncMenuSelections();
    Boot.showBattle();

    setTimeout(() => {
      try{
        Game.start(options);
        Boot.showBattle();

        setTimeout(Boot.showBattle, 80);
        setTimeout(Boot.showBattle, 220);
      }catch(err){
        console.error("[VOCAB BOOT] start run failed", err);
        Boot.showFatalError(err);
      }
    }, 80);
  };

  Boot.playAgain = function playAgain(){
    const options = Boot.getCurrentOptions();
    Boot.startRun(options);
  };

  Boot.nextChallenge = function nextChallenge(){
    const options = Boot.getCurrentOptions();

    options.mode = "mission";
    options.difficulty = Boot.nextDifficulty(options.difficulty);

    Boot.startRun(options);
  };

  Boot.backMenu = function backMenu(){
    Boot.clearTimers();
    Boot.clearFx();
    Boot.showMenu();
  };

  /* =========================================================
     FORM VALIDATION
  ========================================================= */

  Boot.isDemoBypass = function isDemoBypass(){
    try{
      const p = new URLSearchParams(location.search);
      return p.get("demo") === "1" || p.get("qa") === "1" || p.get("debug") === "1";
    }catch(e){
      return false;
    }
  };

  Boot.validateStudentInfo = function validateStudentInfo(){
    if(Boot.isDemoBypass()) return true;

    const fields = [
      ["ชื่อเล่น / Display name", byId("v63DisplayName")],
      ["รหัสนักศึกษา", byId("v63StudentId")],
      ["Section", byId("v63Section")],
      ["Session Code", byId("v63SessionCode")]
    ];

    const missing = fields.filter(([label, el]) => {
      return !el || !String(el.value || "").trim();
    });

    if(missing.length){
      const first = missing[0][1];

      try{
        first.focus();
        first.scrollIntoView({ behavior:"smooth", block:"center" });
      }catch(e){}

      alert("กรุณากรอกข้อมูลผู้เรียนให้ครบก่อนเริ่มเกม: " + missing.map(x => x[0]).join(", "));
      return false;
    }

    Storage.saveStudentContext();
    return true;
  };

  /* =========================================================
     BIND MENU
  ========================================================= */

  Boot.bindMenu = function bindMenu(){
    document.querySelectorAll("[data-v6-bank]").forEach(btn => {
      if(btn.__vocabBound) return;
      btn.__vocabBound = true;

      btn.addEventListener("click", () => {
        VOCAB_APP.selectedBank = btn.dataset.v6Bank || "A";
        Boot.syncMenuSelections();

        safeCall("render v74 menu", window.v74RenderMenu);
      });
    });

    document.querySelectorAll("[data-v6-diff]").forEach(btn => {
      if(btn.__vocabBound) return;
      btn.__vocabBound = true;

      btn.addEventListener("click", () => {
        VOCAB_APP.selectedDifficulty = btn.dataset.v6Diff || "easy";
        Boot.syncMenuSelections();
      });
    });

    document.querySelectorAll("[data-v6-mode]").forEach(btn => {
      if(btn.__vocabBound) return;
      btn.__vocabBound = true;

      btn.addEventListener("click", () => {
        VOCAB_APP.selectedMode = btn.dataset.v6Mode || "learn";
        Boot.syncMenuSelections();
      });
    });

    const startBtn = byId("v6StartBtn");
    if(startBtn && !startBtn.__vocabBound){
      startBtn.__vocabBound = true;

      startBtn.addEventListener("click", e => {
        e.preventDefault();

        if(!Boot.validateStudentInfo()){
          return;
        }

        Boot.startRun({
          bank: app().selectedBank || "A",
          difficulty: app().selectedDifficulty || "easy",
          mode: app().selectedMode || "learn"
        });
      });
    }

    const hintBtn = byId("v6HintBtn");
    if(hintBtn && !hintBtn.__vocabBound){
      hintBtn.__vocabBound = true;
      hintBtn.addEventListener("click", e => {
        e.preventDefault();
        safeCall("use hint", Game.useHint);
      });
    }

    const aiHelpBtn = byId("v67AiHelpBtn");
    if(aiHelpBtn && !aiHelpBtn.__vocabBound){
      aiHelpBtn.__vocabBound = true;
      aiHelpBtn.addEventListener("click", e => {
        e.preventDefault();
        safeCall("use AI help", Game.useAiHelp);
      });
    }

    document.querySelectorAll("[data-lb-mode]").forEach(btn => {
      if(btn.__vocabBound) return;
      btn.__vocabBound = true;

      btn.addEventListener("click", () => {
        const mode = btn.dataset.lbMode || "learn";

        document.querySelectorAll("[data-lb-mode]").forEach(x => {
          x.classList.toggle("active", x === btn);
        });

        Storage.renderLeaderboard(mode);
      });
    });
  };

  /* =========================================================
     REWARD BUTTON DELEGATION
  ========================================================= */

  Boot.bindRewardButtons = function bindRewardButtons(){
    if(window.__VOCAB_BOOT_REWARD_DELEGATED__) return;
    window.__VOCAB_BOOT_REWARD_DELEGATED__ = true;

    document.addEventListener("click", function(e){
      const btn = e.target && e.target.closest
        ? e.target.closest("#v6RewardPanel .v81-btn, #v6RewardPanel [data-vocab-action]")
        : null;

      if(!btn) return;

      let action = btn.getAttribute("data-vocab-action") || btn.getAttribute("data-v814-action") || "";
      const text = String(btn.textContent || "").toLowerCase();

      if(!action){
        if(text.includes("play again")) action = "again";
        else if(text.includes("next challenge")) action = "next";
        else if(text.includes("back to menu")) action = "menu";
      }

      if(!action) return;

      try{
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }catch(err){}

      if(action === "again"){
        Boot.playAgain();
      }else if(action === "next"){
        Boot.nextChallenge();
      }else if(action === "menu"){
        Boot.backMenu();
      }

      return false;
    }, true);
  };

  /* =========================================================
     CLEAN STUDENT MENU
  ========================================================= */

  Boot.cleanStudentMenu = function cleanStudentMenu(){
    const startBtn = byId("v6StartBtn");
    if(!startBtn || !startBtn.closest) return;

    const card = startBtn.closest(".v6-card");
    if(!card) return;

    const h2 = card.querySelector("h2");
    if(h2){
      h2.textContent = "เริ่มเล่น";
    }

    const missionRow = card.querySelector(".v6-mission-row");
    if(missionRow){
      missionRow.style.display = "none";
    }

    if(!byId("vocabStartNote")){
      const note = document.createElement("p");
      note.id = "vocabStartNote";
      note.className = "v63-note";
      note.textContent = "เลือก Word Bank, ระดับ, โหมดการเล่น และกรอกข้อมูลผู้เรียนให้ครบ จากนั้นกด Start เพื่อเริ่มเกม";

      card.insertBefore(note, startBtn);
    }
  };

  /* =========================================================
     FATAL ERROR
  ========================================================= */

  Boot.showFatalError = function showFatalError(err){
    const root = byId("vocabV6App") || document.body;

    const box = document.createElement("div");
    box.className = "v6-fatal";
    box.innerHTML = `
      <h2 style="margin:0 0 8px;">⚠️ Vocab game boot error</h2>
      <p style="margin:0 0 8px;">มี error ตอนเริ่มเกม กรุณาตรวจ console หรือไฟล์ที่เพิ่ง patch</p>
      <pre>${U.escape(err && err.stack ? err.stack : String(err))}</pre>
    `;

    root.prepend(box);
  };

  /* =========================================================
     LEGACY GLOBAL EXPORT
  ========================================================= */

  Boot.exportLegacyGlobals = function exportLegacyGlobals(){
    window.bootVocabApp = Boot.boot;

    window.showMenuScreenV65 = Boot.showMenu;
    window.showBattleScreenV6 = Boot.showBattle;
    window.backToVocabMenuV6 = Boot.backMenu;

    window.__VOCAB_V81_PLAY_AGAIN = Boot.playAgain;
    window.__VOCAB_V81_NEXT_CHALLENGE = Boot.nextChallenge;
    window.__VOCAB_V81_BACK_MENU = Boot.backMenu;
  };

  /* =========================================================
     BOOT
  ========================================================= */

  Boot.boot = function boot(){
    if(Boot.booted) return;
    Boot.booted = true;

    try{
      if(!window.__VOCAB_AUDIO_CTX__){
        document.addEventListener("pointerdown", () => {
          try{
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if(!AudioCtx) return;

            if(!window.__VOCAB_AUDIO_CTX__){
              window.__VOCAB_AUDIO_CTX__ = new AudioCtx();
            }

            if(window.__VOCAB_AUDIO_CTX__.state === "suspended"){
              window.__VOCAB_AUDIO_CTX__.resume().catch(() => {});
            }
          }catch(e){}
        }, { once:true, passive:true });
      }

      safeCall("apply vocabulary expansion", window.applyVocabularyExpansionV71 || window.VocabData?.applyVocabularyExpansion);
      safeCall("init seed", window.initVocabV61Seed || window.VocabUtils?.initSeed);

      Storage.hydrateStudentForm();
      Storage.initLeaderboardStudentListeners();

      Boot.bindMenu();
      Boot.bindRewardButtons();
      Boot.cleanStudentMenu();
      Boot.exportLegacyGlobals();

      Boot.syncMenuSelections();

      UI.updateDiffPreview();
      UI.updateModePreview();
      UI.updateBankLabel();
      UI.updateModeHud();

      Storage.renderLeaderboard("learn");

      if(Guard && typeof Guard.install === "function"){
        Guard.install();
      }

      Boot.showMenu();
      Boot.startGovernor();

      console.log("[VOCAB] central boot complete", Boot.version);
    }catch(err){
      console.error("[VOCAB] central boot failed", err);
      Boot.showFatalError(err);
    }
  };

  window.VocabBoot = Boot;

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", Boot.boot, { once:true });
  }else{
    Boot.boot();
  }

})();
