/* =========================================================
   /vocab/vocab.storage.js
   TechPath Vocab Arena — Safe Local Storage Utilities
   PATCH: 2026-05-01
   ========================================================= */

(function(){
  "use strict";

  function safeReadJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){
      console.warn("[VOCAB STORAGE] read failed", key, e);
      return fallback;
    }
  }

  function safeWriteJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(e){
      console.warn("[VOCAB STORAGE] write failed", key, e);
      return false;
    }
  }

  function safeRemove(key){
    try{
      localStorage.removeItem(key);
      return true;
    }catch(e){
      return false;
    }
  }

  function pushLocalQueue(key, payload, maxItems){
    maxItems = Number(maxItems || 900);

    const list = safeReadJson(key, []);
    list.push(payload);

    const trimmed = list.slice(-maxItems);
    safeWriteJson(key, trimmed);

    return trimmed;
  }

  function clearQueue(key){
    safeWriteJson(key, []);
  }

  function getQueue(key){
    return safeReadJson(key, []);
  }

  function saveStudentProfile(profile){
    const cfg = window.VOCAB_APP_CONFIG || {};
    const key = cfg.profileKey || "VOCAB_SPLIT_STUDENT_PROFILE";

    const data = Object.assign({}, profile || {}, {
      savedAt: new Date().toISOString()
    });

    safeWriteJson(key, data);
    return data;
  }

  function loadStudentProfile(){
    const cfg = window.VOCAB_APP_CONFIG || {};
    const key = cfg.profileKey || "VOCAB_SPLIT_STUDENT_PROFILE";

    return safeReadJson(key, {});
  }

  function saveLastSummary(summary){
    const cfg = window.VOCAB_APP_CONFIG || {};
    const key = cfg.lastSummaryKey || "VOCAB_SPLIT_LAST_SUMMARY";

    const data = Object.assign({}, summary || {}, {
      savedAt: new Date().toISOString()
    });

    safeWriteJson(key, data);
    return data;
  }

  function loadLastSummary(){
    const cfg = window.VOCAB_APP_CONFIG || {};
    const key = cfg.lastSummaryKey || "VOCAB_SPLIT_LAST_SUMMARY";

    return safeReadJson(key, {});
  }

  window.VocabStorage = {
    safeReadJson,
    safeWriteJson,
    safeRemove,
    pushLocalQueue,
    clearQueue,
    getQueue,
    saveStudentProfile,
    loadStudentProfile,
    saveLastSummary,
    loadLastSummary
  };

  console.log("[VOCAB STORAGE] loaded");
})();
