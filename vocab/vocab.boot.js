/* =========================================================
   /vocab/vocab.boot.js
   TechPath Vocab Arena — Boot Loader
   PATCH v20260502e
   Fix:
   - รองรับ module alias หลายชื่อ
   - ตรวจ module หลัง DOM พร้อม
   - ไม่ boot ซ้ำ
   - แสดง missing module ชัดเจน
   - ใช้กับ HTML ชุดใหม่ id/class prefix = vocab-
   ========================================================= */
(function(){
  "use strict";

  const BOOT_VERSION = "vocab-boot-v20260502e";

  if(window.__VOCAB_BOOT_RUNNING__){
    console.warn("[VOCAB BOOT] duplicate boot ignored");
    return;
  }

  window.__VOCAB_BOOT_RUNNING__ = true;

  function get(name){
    return window[name];
  }

  function firstExisting(names){
    for(const name of names){
      if(window[name]) return window[name];
    }
    return null;
  }

  function exposeCanonicalModules(){
    /*
      ทำ alias ให้ boot เห็น module แม้แต่ละไฟล์ใช้ชื่อไม่เหมือนกัน
    */

    window.VocabUtils = window.VocabUtils || firstExisting([
      "VOCAB_UTILS",
      "VocabUtil",
      "vocabUtils"
    ]);

    window.VocabState = window.VocabState || firstExisting([
      "VOCAB_STATE",
      "VocabStore",
      "vocabState"
    ]);

    window.VocabStorage = window.VocabStorage || firstExisting([
      "VOCAB_STORAGE",
      "VocabStoreLocal",
      "vocabStorage"
    ]);

    window.VocabLogger = window.VocabLogger || firstExisting([
      "VOCAB_LOGGER",
      "vocabLogger"
    ]);

    window.VocabData = window.VocabData || firstExisting([
      "VOCAB_DATA",
      "VOCAB_BANKS",
      "vocabData"
    ]);

    window.VocabQuestion = window.VocabQuestion || firstExisting([
      "VOCAB_QUESTION",
      "VocabQuestions",
      "vocabQuestion"
    ]);

    window.VocabUI = window.VocabUI || firstExisting([
      "VOCAB_UI",
      "vocabUI"
    ]);

    window.VocabGame = window.VocabGame || firstExisting([
      "VOCAB_GAME",
      "vocabGameEngine",
      "vocabGame"
    ]);

    window.VocabReward = window.VocabReward || firstExisting([
      "VOCAB_REWARD",
      "vocabReward"
    ]);

    window.VocabGuard = window.VocabGuard || firstExisting([
      "VOCAB_GUARD",
      "vocabGuard"
    ]);
  }

  function moduleStatus(){
    exposeCanonicalModules();

    return {
      config: !!window.VOCAB_APP,
      utils: !!window.VocabUtils,
      data: !!window.VocabData,
      state: !!window.VocabState,
      storage: !!window.VocabStorage,
      logger: !!window.VocabLogger,
      question: !!window.VocabQuestion,
      ui: !!window.VocabUI,
      game: !!window.VocabGame,
      reward: !!window.VocabReward
    };
  }

  function missingRequiredModules(){
    const s = moduleStatus();

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

    return required.filter(k => !s[k]);
  }

  function showFatalBootError(missing){
    const root =
      document.getElementById("vocabApp") ||
      document.body;

    const old = document.getElementById("vocabBootFatal");
    if(old) old.remove();

    const box = document.createElement("div");
    box.id = "vocabBootFatal";
    box.style.cssText = [
      "max-width:900px",
      "margin:18px auto",
      "padding:16px",
      "border-radius:18px",
      "background:#fff4f4",
      "color:#7f1d1d",
      "border:1px solid #fecaca",
      "font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "line-height:1.55"
    ].join(";");

    box.innerHTML = `
      <h2 style="margin:0 0 8px">⚠️ Vocab boot error</h2>
      <p style="margin:0 0 8px">
        โหลดไฟล์แล้ว แต่ยังไม่พบ module ที่ boot ต้องใช้
      </p>
      <p style="margin:0 0 8px">
        Missing: <b>${missing.join(", ")}</b>
      </p>
      <pre style="white-space:pre-wrap;background:#fff;padding:12px;border-radius:12px;overflow:auto">${JSON.stringify(moduleStatus(), null, 2)}</pre>
      <p style="margin:8px 0 0">
        ให้ตรวจว่าแต่ละไฟล์ export เป็น <code>window.VocabUtils</code>, <code>window.VocabState</code>, <code>window.VocabUI</code>, <code>window.VocabStorage</code>, <code>window.VocabGame</code> หรือมี alias ที่ boot รองรับ
      </p>
    `;

    root.prepend(box);
  }

  function safeCall(obj, methodNames, args){
    if(!obj) return false;

    for(const name of methodNames){
      if(typeof obj[name] === "function"){
        obj[name].apply(obj, args || []);
        return true;
      }
    }

    return false;
  }

  function boot(){
    if(window.__VOCAB_BOOTED__){
      console.warn("[VOCAB BOOT] already booted");
      return;
    }

    exposeCanonicalModules();

    const missing = missingRequiredModules();

    if(missing.length){
      console.error(
        "[VOCAB] vocab.boot.js requires modules:",
        missing,
        moduleStatus()
      );

      showFatalBootError(missing);
      return;
    }

    window.__VOCAB_BOOTED__ = true;

    /*
      1) Config normalize
    */
    if(window.VOCAB_APP){
      window.VOCAB_APP.version = window.VOCAB_APP.version || BOOT_VERSION;
      window.VOCAB_APP.source = window.VOCAB_APP.source || "vocab.html";
      window.VOCAB_APP.schema = window.VOCAB_APP.schema || "vocab-split-v1";
    }

    /*
      2) Storage / profile hydrate
    */
    safeCall(window.VocabStorage, [
      "hydrateStudentForm",
      "hydrateProfile",
      "init",
      "boot"
    ]);

    /*
      3) UI init
    */
    safeCall(window.VocabUI, [
      "init",
      "boot",
      "mount"
    ]);

    /*
      4) Game init
    */
    safeCall(window.VocabGame, [
      "init",
      "boot",
      "mount"
    ]);

    /*
      5) Reward init
    */
    safeCall(window.VocabReward, [
      "init",
      "boot",
      "mount"
    ]);

    /*
      6) Guard init
    */
    safeCall(window.VocabGuard, [
      "init",
      "boot",
      "mount"
    ]);

    /*
      7) Leaderboard render
    */
    safeCall(window.VocabUI, [
      "renderLeaderboard",
      "updateLeaderboard"
    ], ["learn"]);

    console.log("[VOCAB BOOT] loaded", BOOT_VERSION, moduleStatus());
  }

  function bootWhenReady(){
    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", function(){
        setTimeout(boot, 0);
      }, { once:true });
    }else{
      setTimeout(boot, 0);
    }
  }

  bootWhenReady();

})();
