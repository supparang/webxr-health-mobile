/* =========================================================
   /vocab/vocab.boot.js
   TechPath Vocab Arena — Boot Module
   Version: 20260503a
   Purpose:
   - Boot split vocab modules safely
   - Support new module names and legacy aliases
   - Prevent silent blank screen
   - Show clear missing-module diagnostics
========================================================= */
(function(){
  "use strict";

  const BOOT_VERSION = "vocab-boot-20260503a";

  const W = window;
  const D = document;

  let booted = false;

  /* =========================================================
     BASIC HELPERS
  ========================================================= */

  function byId(id){
    return D.getElementById(id);
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function log(){
    try{
      console.log.apply(console, arguments);
    }catch(e){}
  }

  function warn(){
    try{
      console.warn.apply(console, arguments);
    }catch(e){}
  }

  function error(){
    try{
      console.error.apply(console, arguments);
    }catch(e){}
  }

  function onReady(fn){
    if(D.readyState === "loading"){
      D.addEventListener("DOMContentLoaded", fn, { once:true });
    }else{
      fn();
    }
  }

  function safeCall(label, fn){
    try{
      if(typeof fn === "function"){
        return fn();
      }
    }catch(err){
      error(`[VOCAB BOOT] ${label} failed`, err);
      showBootError(`Boot step failed: ${label}`, err);
      return null;
    }
    return null;
  }

  /* =========================================================
     MODULE RESOLUTION
     รองรับหลายชื่อ เพราะตอน split ไฟล์อาจ export ไม่ตรงกัน
  ========================================================= */

  function resolveModules(){
    const config =
      W.VocabConfig ||
      W.VOCAB_CONFIG ||
      W.VOCAB_APP ||
      null;

    const utils =
      W.VocabUtils ||
      W.VOCAB_UTILS ||
      null;

    const data =
      W.VocabData ||
      W.VOCAB_DATA ||
      null;

    const state =
      W.VocabState ||
      W.VOCAB_STATE ||
      W.vocabState ||
      null;

    const storage =
      W.VocabStorage ||
      W.VOCAB_STORAGE ||
      null;

    const logger =
      W.VocabLogger ||
      W.VOCAB_LOGGER ||
      null;

    const question =
      W.VocabQuestion ||
      W.VocabQuestions ||
      W.VOCAB_QUESTION ||
      W.VOCAB_QUESTIONS ||
      null;

    const ui =
      W.VocabUI ||
      W.VOCAB_UI ||
      null;

    const game =
      W.VocabGame ||
      W.VOCAB_GAME ||
      null;

    const reward =
      W.VocabReward ||
      W.VOCAB_REWARD ||
      null;

    const guard =
      W.VocabGuard ||
      W.VOCAB_GUARD ||
      null;

    const endpointTest =
      W.VocabEndpointTest ||
      W.VOCAB_ENDPOINT_TEST ||
      null;

    return {
      config,
      utils,
      data,
      state,
      storage,
      logger,
      question,
      ui,
      game,
      reward,
      guard,
      endpointTest
    };
  }

  function moduleStatus(mods){
    return {
      config: !!mods.config,
      utils: !!mods.utils,
      data: !!mods.data,
      state: !!mods.state,
      storage: !!mods.storage,
      logger: !!mods.logger,
      question: !!mods.question,
      ui: !!mods.ui,
      game: !!mods.game,
      reward: !!mods.reward
    };
  }

  function getMissingRequired(mods){
    const required = [
      "config",
      "utils",
      "data",
      "state",
      "storage",
      "logger",
      "question",
      "ui",
      "game",
      "reward"
    ];

    return required.filter(name => !mods[name]);
  }

  function installLegacyAliases(mods){
    /*
      ทำ alias กลางให้ทุกไฟล์เรียกชื่อเดียวกันได้
    */
    if(mods.config){
      W.VocabConfig = mods.config;
      W.VOCAB_APP = W.VOCAB_APP || mods.config;
      W.VOCAB_CONFIG = W.VOCAB_CONFIG || mods.config;
    }

    if(mods.utils){
      W.VocabUtils = mods.utils;
      W.VOCAB_UTILS = W.VOCAB_UTILS || mods.utils;
    }

    if(mods.data){
      W.VocabData = mods.data;
      W.VOCAB_DATA = W.VOCAB_DATA || mods.data;
    }

    if(mods.state){
      W.VocabState = mods.state;
      W.VOCAB_STATE = W.VOCAB_STATE || mods.state;
      W.vocabState = W.vocabState || mods.state;
    }

    if(mods.storage){
      W.VocabStorage = mods.storage;
      W.VOCAB_STORAGE = W.VOCAB_STORAGE || mods.storage;
    }

    if(mods.logger){
      W.VocabLogger = mods.logger;
      W.VOCAB_LOGGER = W.VOCAB_LOGGER || mods.logger;
    }

    if(mods.question){
      W.VocabQuestion = mods.question;
      W.VocabQuestions = W.VocabQuestions || mods.question;
      W.VOCAB_QUESTION = W.VOCAB_QUESTION || mods.question;
    }

    if(mods.ui){
      W.VocabUI = mods.ui;
      W.VOCAB_UI = W.VOCAB_UI || mods.ui;
    }

    if(mods.game){
      W.VocabGame = mods.game;
      W.VOCAB_GAME = W.VOCAB_GAME || mods.game;
    }

    if(mods.reward){
      W.VocabReward = mods.reward;
      W.VOCAB_REWARD = W.VOCAB_REWARD || mods.reward;
    }

    if(mods.guard){
      W.VocabGuard = mods.guard;
      W.VOCAB_GUARD = W.VOCAB_GUARD || mods.guard;
    }

    if(mods.endpointTest){
      W.VocabEndpointTest = mods.endpointTest;
      W.VOCAB_ENDPOINT_TEST = W.VOCAB_ENDPOINT_TEST || mods.endpointTest;
    }
  }

  /* =========================================================
     BOOT ERROR UI
  ========================================================= */

  function showBootError(title, err, extra){
    const root =
      byId("vocabApp") ||
      byId("vocabV6App") ||
      D.body;

    if(!root) return;

    const old = byId("vocabBootError");
    if(old) old.remove();

    const pre = err && err.stack
      ? err.stack
      : typeof err === "string"
        ? err
        : JSON.stringify(err || {}, null, 2);

    const extraHtml = extra
      ? `<pre style="white-space:pre-wrap;background:#fff;border-radius:14px;padding:14px;overflow:auto">${esc(JSON.stringify(extra, null, 2))}</pre>`
      : "";

    const box = D.createElement("div");
    box.id = "vocabBootError";
    box.style.cssText = [
      "max-width:1100px",
      "margin:18px auto",
      "padding:22px",
      "border-radius:24px",
      "border:1px solid #fecaca",
      "background:#fff1f2",
      "color:#7f1d1d",
      "font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "line-height:1.55",
      "box-shadow:0 14px 44px rgba(0,0,0,.14)"
    ].join(";");

    box.innerHTML = `
      <h1 style="margin:0 0 12px;font-size:34px;letter-spacing:-.03em">
        ⚠️ ${esc(title || "Vocab boot error")}
      </h1>
      <p style="margin:0 0 14px;font-size:20px">
        โหลดไฟล์แล้ว แต่ระบบเริ่มเกมไม่ได้ เพราะ module บางตัวไม่พร้อม
      </p>
      ${pre ? `<pre style="white-space:pre-wrap;background:#fff;border-radius:14px;padding:14px;overflow:auto">${esc(pre)}</pre>` : ""}
      ${extraHtml}
      <p style="margin:14px 0 0;font-size:18px">
        ให้ตรวจว่าแต่ละไฟล์ export เป็นชื่อบน <code>window</code> เช่น
        <code>window.VocabState</code>, <code>window.VocabQuestion</code>,
        <code>window.VocabUI</code>, <code>window.VocabGame</code>,
        <code>window.VocabReward</code>
      </p>
    `;

    root.prepend(box);
  }

  function showMissingModules(mods, missing){
    showBootError(
      "Vocab boot error",
      `Missing: ${missing.join(", ")}`,
      moduleStatus(mods)
    );
  }

  /* =========================================================
     UI COMPATIBILITY
     รองรับ id/class ใหม่ vocab-* และ legacy v6-*
  ========================================================= */

  function installDomAliases(){
    /*
      ถ้า JS เก่าบางไฟล์ยังหา id แบบ v6 อยู่ ให้ alias DOM id แบบไม่เปลี่ยน HTML
      ทำโดยสร้าง getter helper บน window ไม่ไป duplicate id จริง
    */
    W.VocabDom = W.VocabDom || {
      ids: {
        app: ["vocabApp", "vocabV6App"],
        menu: ["vocabMenuPanel", "v6MenuPanel"],
        battle: ["vocabBattlePanel", "v6BattlePanel"],
        reward: ["vocabRewardPanel", "v6RewardPanel"],

        startBtn: ["vocabStartBtn", "v6StartBtn"],

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

        enemyAvatar: ["vocabEnemyAvatar", "v6EnemyAvatar"],
        enemyName: ["vocabEnemyName", "v6EnemyName"],
        enemySkill: ["vocabEnemySkill", "v6EnemySkill"],
        enemyHpText: ["vocabEnemyHpText", "v6EnemyHpText"],
        enemyHpFill: ["vocabEnemyHpFill", "v6EnemyHpFill"],

        bankLabel: ["vocabBankLabel", "v6BankLabel"],
        questionText: ["vocabQuestionText", "v6QuestionText"],
        choices: ["vocabChoices", "v6Choices"],
        explainBox: ["vocabExplainBox", "v6ExplainBox"],
        aiHelpBox: ["vocabAiHelpBox", "v67AiHelpBox"],

        diffPreview: ["vocabDiffPreview", "v6DiffPreview"],
        modePreview: ["vocabModePreview", "v66ModePreview"],

        displayName: ["vocabDisplayName", "v63DisplayName"],
        studentId: ["vocabStudentId", "v63StudentId"],
        section: ["vocabSection", "v63Section"],
        sessionCode: ["vocabSessionCode", "v63SessionCode"],

        leaderboardBox: ["vocabLeaderboardBox", "v68LeaderboardBox"]
      },

      get(key){
        const list = this.ids[key] || [key];
        for(const id of list){
          const el = byId(id);
          if(el) return el;
        }
        return null;
      },

      getByIds(ids){
        for(const id of ids || []){
          const el = byId(id);
          if(el) return el;
        }
        return null;
      }
    };

    W.vocabById = W.vocabById || function(key){
      return W.VocabDom.get(key) || byId(key);
    };
  }

  function installLegacyGlobalFunctions(mods){
    /*
      ให้ inline onclick / patch เก่าเรียกได้
    */
    W.startVocabBattleV6 = W.startVocabBattleV6 || function(options){
      if(mods.game && typeof mods.game.start === "function"){
        return mods.game.start(options || {});
      }
      if(mods.game && typeof mods.game.startGame === "function"){
        return mods.game.startGame(options || {});
      }
      warn("[VOCAB BOOT] startVocabBattleV6 called but VocabGame.start is missing");
      return null;
    };

    W.backToVocabMenuV6 = W.backToVocabMenuV6 || function(){
      if(mods.ui && typeof mods.ui.showMenu === "function"){
        return mods.ui.showMenu();
      }

      const menu = W.VocabDom.get("menu");
      const battle = W.VocabDom.get("battle");
      const reward = W.VocabDom.get("reward");

      if(menu) menu.hidden = false;
      if(battle) battle.hidden = true;
      if(reward) reward.hidden = true;

      try{ W.scrollTo({ top:0, behavior:"auto" }); }catch(e){}
      return null;
    };

    W.renderLeaderboardV68 = W.renderLeaderboardV68 || function(mode){
      if(mods.ui && typeof mods.ui.renderLeaderboard === "function"){
        return mods.ui.renderLeaderboard(mode || "learn");
      }
      if(mods.storage && typeof mods.storage.renderLeaderboard === "function"){
        return mods.storage.renderLeaderboard(mode || "learn");
      }
      return null;
    };

    W.clearTimerV6 = W.clearTimerV6 || function(){
      if(mods.game && typeof mods.game.clearTimer === "function"){
        return mods.game.clearTimer();
      }
      return null;
    };

    W.stopFeverV62 = W.stopFeverV62 || function(){
      if(mods.game && typeof mods.game.stopFever === "function"){
        return mods.game.stopFever();
      }
      return null;
    };
  }

  /* =========================================================
     MODULE INIT ORDER
  ========================================================= */

  function callFirst(mod, names, args){
    if(!mod) return null;

    for(const name of names){
      if(typeof mod[name] === "function"){
        return mod[name].apply(mod, args || []);
      }
    }

    return null;
  }

  function initConfig(mods){
    /*
      config ส่วนใหญ่ไม่ต้อง init แต่เผื่อมี
    */
    callFirst(mods.config, ["init", "boot", "setup"], [mods]);
  }

  function initStorage(mods){
    callFirst(mods.storage, ["init", "boot", "hydrate"], [mods]);
  }

  function initLogger(mods){
    callFirst(mods.logger, ["init", "boot", "setup"], [mods]);
  }

  function initState(mods){
    callFirst(mods.state, ["init", "boot", "reset"], [mods]);
  }

  function initData(mods){
    callFirst(mods.data, ["init", "boot", "applyExpansion"], [mods]);
  }

  function initQuestion(mods){
    callFirst(mods.question, ["init", "boot"], [mods]);
  }

  function initReward(mods){
    callFirst(mods.reward, ["init", "boot", "install"], [mods]);
  }

  function initUI(mods){
    callFirst(mods.ui, ["init", "boot", "bind"], [mods]);
  }

  function initGame(mods){
    callFirst(mods.game, ["init", "boot"], [mods]);
  }

  function initGuard(mods){
    if(mods.guard){
      callFirst(mods.guard, ["init", "boot", "install"], [mods]);
    }
  }

  function initEndpointTest(mods){
    if(mods.endpointTest){
      callFirst(mods.endpointTest, ["init", "boot"], [mods]);
    }
  }

  /* =========================================================
     FALLBACK UI BINDINGS
     ถ้า vocab.ui.js ยัง bind ไม่ครบ boot จะช่วย bind ปุ่มหลักให้
  ========================================================= */

  function getSelectedFromDom(){
    const bankBtn = D.querySelector("[data-vocab-bank].active, [data-v6-bank].active");
    const diffBtn = D.querySelector("[data-vocab-diff].active, [data-v6-diff].active");
    const modeBtn = D.querySelector("[data-vocab-mode].active, [data-v6-mode].active");

    return {
      bank:
        bankBtn?.dataset?.vocabBank ||
        bankBtn?.dataset?.v6Bank ||
        "A",

      difficulty:
        diffBtn?.dataset?.vocabDiff ||
        diffBtn?.dataset?.v6Diff ||
        "easy",

      mode:
        modeBtn?.dataset?.vocabMode ||
        modeBtn?.dataset?.v6Mode ||
        "learn"
    };
  }

  function setActiveButton(selector, btn){
    D.querySelectorAll(selector).forEach(x => {
      x.classList.toggle("active", x === btn);
    });
  }

  function installFallbackBindings(mods){
    /*
      Bank
    */
    D.querySelectorAll("[data-vocab-bank], [data-v6-bank]").forEach(btn => {
      if(btn.__vocabBootBound) return;
      btn.__vocabBootBound = true;

      btn.addEventListener("click", () => {
        setActiveButton("[data-vocab-bank], [data-v6-bank]", btn);

        const bank =
          btn.dataset.vocabBank ||
          btn.dataset.v6Bank ||
          "A";

        if(mods.config){
          mods.config.selectedBank = bank;
        }

        if(W.VOCAB_APP){
          W.VOCAB_APP.selectedBank = bank;
        }

        callFirst(mods.ui, ["updateBankLabel", "refreshMenu", "renderMenu"], [bank]);
      });
    });

    /*
      Difficulty
    */
    D.querySelectorAll("[data-vocab-diff], [data-v6-diff]").forEach(btn => {
      if(btn.__vocabBootBound) return;
      btn.__vocabBootBound = true;

      btn.addEventListener("click", () => {
        setActiveButton("[data-vocab-diff], [data-v6-diff]", btn);

        const diff =
          btn.dataset.vocabDiff ||
          btn.dataset.v6Diff ||
          "easy";

        if(mods.config){
          mods.config.selectedDifficulty = diff;
        }

        if(W.VOCAB_APP){
          W.VOCAB_APP.selectedDifficulty = diff;
        }

        callFirst(mods.ui, ["updateDiffPreview", "refreshMenu", "renderMenu"], [diff]);
      });
    });

    /*
      Mode
    */
    D.querySelectorAll("[data-vocab-mode], [data-v6-mode]").forEach(btn => {
      if(btn.__vocabBootBound) return;
      btn.__vocabBootBound = true;

      btn.addEventListener("click", () => {
        setActiveButton("[data-vocab-mode], [data-v6-mode]", btn);

        const mode =
          btn.dataset.vocabMode ||
          btn.dataset.v6Mode ||
          "learn";

        if(mods.config){
          mods.config.selectedMode = mode;
        }

        if(W.VOCAB_APP){
          W.VOCAB_APP.selectedMode = mode;
        }

        callFirst(mods.ui, ["updateModePreview", "updateBankLabel", "refreshMenu", "renderMenu"], [mode]);
      });
    });

    /*
      Start
    */
    const startBtn =
      W.VocabDom.get("startBtn") ||
      byId("vocabStartBtn") ||
      byId("v6StartBtn");

    if(startBtn && !startBtn.__vocabBootBound){
      startBtn.__vocabBootBound = true;

      startBtn.addEventListener("click", () => {
        const options = getSelectedFromDom();

        if(mods.config){
          mods.config.selectedBank = options.bank;
          mods.config.selectedDifficulty = options.difficulty;
          mods.config.selectedMode = options.mode;
        }

        if(W.VOCAB_APP){
          W.VOCAB_APP.selectedBank = options.bank;
          W.VOCAB_APP.selectedDifficulty = options.difficulty;
          W.VOCAB_APP.selectedMode = options.mode;
        }

        if(mods.game && typeof mods.game.start === "function"){
          mods.game.start(options);
          return;
        }

        if(mods.game && typeof mods.game.startGame === "function"){
          mods.game.startGame(options);
          return;
        }

        if(typeof W.startVocabBattleV6 === "function"){
          W.startVocabBattleV6(options);
          return;
        }

        showBootError("Start failed", "VocabGame.start / startGame not found");
      });
    }

    /*
      Hint / AI Help
    */
    const hintBtn = W.VocabDom.get("hintBtn");
    if(hintBtn && !hintBtn.__vocabBootBound){
      hintBtn.__vocabBootBound = true;
      hintBtn.addEventListener("click", () => {
        callFirst(mods.game, ["useHint", "hint", "useHintV62"], []);
      });
    }

    const aiHelpBtn = W.VocabDom.get("aiHelpBtn");
    if(aiHelpBtn && !aiHelpBtn.__vocabBootBound){
      aiHelpBtn.__vocabBootBound = true;
      aiHelpBtn.addEventListener("click", () => {
        callFirst(mods.game, ["useAiHelp", "aiHelp", "useAiHelpV67"], []);
      });
    }

    /*
      Leaderboard tabs
    */
    D.querySelectorAll("[data-lb-mode]").forEach(btn => {
      if(btn.__vocabBootBound) return;
      btn.__vocabBootBound = true;

      btn.addEventListener("click", () => {
        setActiveButton("[data-lb-mode]", btn);
        const mode = btn.dataset.lbMode || "learn";

        if(mods.ui && typeof mods.ui.renderLeaderboard === "function"){
          mods.ui.renderLeaderboard(mode);
          return;
        }

        if(mods.storage && typeof mods.storage.renderLeaderboard === "function"){
          mods.storage.renderLeaderboard(mode);
        }
      });
    });
  }

  function initialRender(mods){
    /*
      ซ่อน/โชว์หน้าตามค่าเริ่มต้น
    */
    callFirst(mods.ui, ["showMenu", "showMenuScreen", "renderMenu"], []);

    callFirst(mods.ui, ["updateDiffPreview"], []);
    callFirst(mods.ui, ["updateModePreview"], []);
    callFirst(mods.ui, ["updateBankLabel"], []);
    callFirst(mods.ui, ["updateModeHud"], []);

    if(mods.ui && typeof mods.ui.renderLeaderboard === "function"){
      mods.ui.renderLeaderboard("learn");
    }else if(mods.storage && typeof mods.storage.renderLeaderboard === "function"){
      mods.storage.renderLeaderboard("learn");
    }

    /*
      fallback ถ้า ui ไม่มี showMenu
    */
    const menu = W.VocabDom.get("menu");
    const battle = W.VocabDom.get("battle");
    const reward = W.VocabDom.get("reward");

    if(menu && battle && reward){
      menu.hidden = false;
      battle.hidden = true;
      reward.hidden = true;
    }
  }

  /* =========================================================
     PUBLIC DIAGNOSTICS
  ========================================================= */

  function installDiagnostics(){
    W.vocabBootStatus = function(){
      const mods = resolveModules();
      return {
        version: BOOT_VERSION,
        booted,
        modules: moduleStatus(mods),
        missing: getMissingRequired(mods),
        config: W.VocabConfig || W.VOCAB_APP || null,
        currentUrl: location.href
      };
    };

    W.vocabReboot = function(){
      booted = false;
      return bootVocabApp();
    };
  }

  /* =========================================================
     MAIN BOOT
  ========================================================= */

  function bootVocabApp(){
    if(booted){
      log("[VOCAB BOOT] already booted", BOOT_VERSION);
      return true;
    }

    installDomAliases();

    const mods = resolveModules();
    installLegacyAliases(mods);

    const refreshedMods = resolveModules();
    installLegacyAliases(refreshedMods);

    const missing = getMissingRequired(refreshedMods);

    if(missing.length){
      error("[VOCAB BOOT] missing modules", missing, moduleStatus(refreshedMods));
      showMissingModules(refreshedMods, missing);
      installDiagnostics();
      return false;
    }

    try{
      safeCall("initConfig", () => initConfig(refreshedMods));
      safeCall("initUtils", () => callFirst(refreshedMods.utils, ["init", "boot"], [refreshedMods]));
      safeCall("initData", () => initData(refreshedMods));
      safeCall("initState", () => initState(refreshedMods));
      safeCall("initStorage", () => initStorage(refreshedMods));
      safeCall("initLogger", () => initLogger(refreshedMods));
      safeCall("initQuestion", () => initQuestion(refreshedMods));
      safeCall("initReward", () => initReward(refreshedMods));
      safeCall("initUI", () => initUI(refreshedMods));
      safeCall("initGame", () => initGame(refreshedMods));
      safeCall("initGuard", () => initGuard(refreshedMods));
      safeCall("initEndpointTest", () => initEndpointTest(refreshedMods));

      installLegacyGlobalFunctions(refreshedMods);
      installFallbackBindings(refreshedMods);
      initialRender(refreshedMods);
      installDiagnostics();

      const oldError = byId("vocabBootError");
      if(oldError) oldError.remove();

      booted = true;

      log("[VOCAB BOOT] complete", BOOT_VERSION, moduleStatus(refreshedMods));

      try{
        if(refreshedMods.logger && typeof refreshedMods.logger.log === "function"){
          refreshedMods.logger.log("boot_complete", {
            boot_version: BOOT_VERSION,
            modules: moduleStatus(refreshedMods)
          });
        }
      }catch(e){}

      return true;
    }catch(err){
      error("[VOCAB BOOT] failed", err);
      showBootError("Vocab boot failed", err, moduleStatus(refreshedMods));
      installDiagnostics();
      return false;
    }
  }

  /* =========================================================
     EXPORT
  ========================================================= */

  W.VocabBoot = {
    version: BOOT_VERSION,
    boot: bootVocabApp,
    resolveModules,
    moduleStatus,
    getMissingRequired,
    installDomAliases,
    installLegacyAliases
  };

  W.bootVocabApp = bootVocabApp;

  onReady(function(){
    bootVocabApp();
  });

})();
