/* =========================================================
   /vocab/vocab.storage.js
   TechPath Vocab Arena — Storage Service
   PATCH: v20260503e
   Fix:
   - add loadStudentProfile()
   - add saveStudentProfile()
   - add pushLocalQueue()
   - add readLocalQueue()
   - add clearLocalQueue()
   - add leaderboard helpers
   - add last summary helpers
   - expose window.VocabStorage
========================================================= */

(function(){
  "use strict";

  const VERSION = "vocab-storage-v20260503e";

  const DEFAULT_KEYS = {
    profile: "VOCAB_SPLIT_STUDENT_PROFILE",
    queue: "VOCAB_SPLIT_LOG_QUEUE",
    leaderboard: "VOCAB_SPLIT_LEADERBOARD",
    lastSummary: "VOCAB_SPLIT_LAST_SUMMARY",
    settings: "VOCAB_SPLIT_SETTINGS"
  };

  function getApp(){
    return window.VOCAB_APP || window.VocabConfig || {};
  }

  function getKeys(){
    const app = getApp();

    return {
      profile:
        app.profileKey ||
        app.studentProfileKey ||
        DEFAULT_KEYS.profile,

      queue:
        app.queueKey ||
        app.logQueueKey ||
        DEFAULT_KEYS.queue,

      leaderboard:
        app.leaderboardKey ||
        DEFAULT_KEYS.leaderboard,

      lastSummary:
        app.lastSummaryKey ||
        DEFAULT_KEYS.lastSummary,

      settings:
        app.settingsKey ||
        DEFAULT_KEYS.settings
    };
  }

  function safeReadJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    }catch(err){
      console.warn("[VOCAB STORAGE] readJson failed", key, err);
      return fallback;
    }
  }

  function safeWriteJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(err){
      console.warn("[VOCAB STORAGE] writeJson failed", key, err);
      return false;
    }
  }

  function safeRemove(key){
    try{
      localStorage.removeItem(key);
      return true;
    }catch(err){
      console.warn("[VOCAB STORAGE] remove failed", key, err);
      return false;
    }
  }

  function safeGet(key, fallback){
    try{
      const value = localStorage.getItem(key);
      return value == null ? fallback : value;
    }catch(err){
      return fallback;
    }
  }

  function safeSet(key, value){
    try{
      localStorage.setItem(key, String(value));
      return true;
    }catch(err){
      return false;
    }
  }

  function readInput(id){
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function writeInput(id, value){
    const el = document.getElementById(id);
    if(!el) return;
    if(value !== undefined && value !== null){
      el.value = String(value);
    }
  }

  function getParam(name, fallback){
    try{
      const p = new URLSearchParams(location.search);
      return p.get(name) || fallback || "";
    }catch(err){
      return fallback || "";
    }
  }

  function normalizeStudentProfile(profile){
    profile = profile || {};

    return {
      display_name:
        String(
          profile.display_name ||
          profile.displayName ||
          profile.name ||
          ""
        ).trim(),

      student_id:
        String(
          profile.student_id ||
          profile.studentId ||
          profile.sid ||
          profile.pid ||
          ""
        ).trim(),

      section:
        String(profile.section || profile.classSection || "").trim(),

      session_code:
        String(
          profile.session_code ||
          profile.sessionCode ||
          profile.studyId ||
          ""
        ).trim(),

      updated_at:
        profile.updated_at ||
        profile.updatedAt ||
        ""
    };
  }

  function loadStudentProfile(){
    const keys = getKeys();

    const saved = normalizeStudentProfile(
      safeReadJson(keys.profile, {})
    );

    /*
      รองรับ key เก่าจาก v7.x ด้วย เผื่อเครื่องเคยเล่นก่อน split file
    */
    const legacy1 = normalizeStudentProfile(
      safeReadJson("VOCAB_V71_STUDENT_PROFILE", {})
    );

    const legacy2 = normalizeStudentProfile(
      safeReadJson("VOCAB_V74_UNLOCK_PROFILE", {})
    );

    return normalizeStudentProfile({
      display_name:
        getParam("name") ||
        getParam("nick") ||
        readInput("vocabDisplayName") ||
        readInput("v63DisplayName") ||
        saved.display_name ||
        legacy1.display_name ||
        legacy2.display_name ||
        "Hero",

      student_id:
        getParam("student_id") ||
        getParam("sid") ||
        getParam("pid") ||
        readInput("vocabStudentId") ||
        readInput("v63StudentId") ||
        saved.student_id ||
        legacy1.student_id ||
        legacy2.student_id ||
        "anon",

      section:
        getParam("section") ||
        readInput("vocabSection") ||
        readInput("v63Section") ||
        saved.section ||
        legacy1.section ||
        legacy2.section ||
        "",

      session_code:
        getParam("session_code") ||
        getParam("studyId") ||
        readInput("vocabSessionCode") ||
        readInput("v63SessionCode") ||
        saved.session_code ||
        legacy1.session_code ||
        legacy2.session_code ||
        ""
    });
  }

  function saveStudentProfile(profile){
    const keys = getKeys();

    const clean = normalizeStudentProfile(profile || loadStudentProfile());
    clean.updated_at = new Date().toISOString();

    safeWriteJson(keys.profile, clean);

    /*
      เขียนสำรองลง key เก่า เพื่อให้ logger/teacher ที่ยังอ่าน key เดิมไม่พัง
    */
    safeWriteJson("VOCAB_V71_STUDENT_PROFILE", clean);

    return clean;
  }

  function hydrateStudentForm(){
    const profile = loadStudentProfile();

    writeInput("vocabDisplayName", profile.display_name === "Hero" ? "" : profile.display_name);
    writeInput("vocabStudentId", profile.student_id === "anon" ? "" : profile.student_id);
    writeInput("vocabSection", profile.section);
    writeInput("vocabSessionCode", profile.session_code);

    /*
      alias เก่า ถ้ามี
    */
    writeInput("v63DisplayName", profile.display_name === "Hero" ? "" : profile.display_name);
    writeInput("v63StudentId", profile.student_id === "anon" ? "" : profile.student_id);
    writeInput("v63Section", profile.section);
    writeInput("v63SessionCode", profile.session_code);

    return profile;
  }

  function bindStudentAutoSave(){
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
      const el = document.getElementById(id);
      if(!el || el.__vocabStorageBound) return;

      el.__vocabStorageBound = true;

      el.addEventListener("input", function(){
        saveStudentProfile({
          display_name: readInput("vocabDisplayName") || readInput("v63DisplayName"),
          student_id: readInput("vocabStudentId") || readInput("v63StudentId"),
          section: readInput("vocabSection") || readInput("v63Section"),
          session_code: readInput("vocabSessionCode") || readInput("v63SessionCode")
        });
      });
    });
  }

  function readLocalQueue(){
    const keys = getKeys();
    const queue = safeReadJson(keys.queue, []);
    return Array.isArray(queue) ? queue : [];
  }

  function saveLocalQueue(queue){
    const keys = getKeys();
    queue = Array.isArray(queue) ? queue : [];
    return safeWriteJson(keys.queue, queue);
  }

  function pushLocalQueue(payload, options){
    const keys = getKeys();
    const max = Number(options && options.max ? options.max : 900);

    const queue = readLocalQueue();

    queue.push({
      saved_at: new Date().toISOString(),
      payload: payload || {}
    });

    const trimmed = queue.slice(-max);
    safeWriteJson(keys.queue, trimmed);

    return trimmed;
  }

  function clearLocalQueue(){
    const keys = getKeys();
    safeRemove(keys.queue);
    return true;
  }

  function getQueueSize(){
    return readLocalQueue().length;
  }

  function readLeaderboard(){
    const keys = getKeys();
    const board = safeReadJson(keys.leaderboard, null);

    const fallback = {
      learn: [],
      speed: [],
      mission: [],
      battle: [],
      bossrush: []
    };

    if(!board || typeof board !== "object") return fallback;

    Object.keys(fallback).forEach(function(mode){
      if(!Array.isArray(board[mode])){
        board[mode] = [];
      }
    });

    return board;
  }

  function saveLeaderboard(board){
    const keys = getKeys();
    return safeWriteJson(keys.leaderboard, board || {});
  }

  function getLeaderboardMode(mode){
    mode = mode || "learn";
    const board = readLeaderboard();
    return Array.isArray(board[mode]) ? board[mode] : [];
  }

  function updateLeaderboard(result){
    result = result || {};

    const board = readLeaderboard();
    const profile = loadStudentProfile();

    const mode = String(result.mode || "learn").toLowerCase();
    if(!Array.isArray(board[mode])) board[mode] = [];

    const aiHelpUsed = Number(result.aiHelpUsed || result.ai_help_used || 0);
    const rawScore = Number(result.score || 0);
    const fairScore = aiHelpUsed > 0 ? Math.round(rawScore * 0.95) : rawScore;

    const entry = {
      session_id:
        result.session_id ||
        result.sessionId ||
        "vocab_" + Date.now(),

      timestamp: new Date().toISOString(),

      display_name:
        result.display_name ||
        profile.display_name ||
        "Hero",

      student_id:
        result.student_id ||
        profile.student_id ||
        "anon",

      section:
        result.section ||
        profile.section ||
        "",

      session_code:
        result.session_code ||
        profile.session_code ||
        "",

      bank: result.bank || "A",
      difficulty: result.difficulty || "normal",
      mode: mode,
      mode_label: result.modeLabel || result.mode_label || mode,

      score: rawScore,
      fair_score: fairScore,
      accuracy: Number(result.accuracy || 0),
      combo_max: Number(result.comboMax || result.combo_max || 0),
      ai_help_used: aiHelpUsed,
      ai_assisted: aiHelpUsed > 0 ? 1 : 0,
      boss_defeated: result.bossDefeated || result.boss_defeated ? 1 : 0
    };

    const previousPersonalBest = board[mode]
      .filter(function(row){
        return String(row.student_id || "") === String(entry.student_id || "");
      })
      .reduce(function(best, row){
        return Math.max(best, Number(row.fair_score || row.score || 0));
      }, 0);

    board[mode].push(entry);

    board[mode].sort(function(a, b){
      const scoreDiff =
        Number(b.fair_score || b.score || 0) -
        Number(a.fair_score || a.score || 0);

      if(scoreDiff !== 0) return scoreDiff;

      const accDiff =
        Number(b.accuracy || 0) -
        Number(a.accuracy || 0);

      if(accDiff !== 0) return accDiff;

      return Number(b.combo_max || 0) - Number(a.combo_max || 0);
    });

    board[mode] = board[mode].slice(0, 50);

    saveLeaderboard(board);

    const rank =
      board[mode].findIndex(function(row){
        return row.session_id === entry.session_id;
      }) + 1;

    const personalBest = Math.max(previousPersonalBest, fairScore);
    const improvement = previousPersonalBest ? fairScore - previousPersonalBest : fairScore;
    const classTopScore = board[mode][0]
      ? Number(board[mode][0].fair_score || board[mode][0].score || 0)
      : fairScore;

    return {
      entry: entry,
      rank: rank || "-",
      fairScore: fairScore,
      personalBest: personalBest,
      improvement: improvement,
      classTopScore: classTopScore,
      board: board
    };
  }

  function saveLastSummary(summary){
    const keys = getKeys();

    const payload = {
      saved_at: new Date().toISOString(),
      summary: summary || {}
    };

    safeWriteJson(keys.lastSummary, payload);

    /*
      key เก่า เผื่อหน้า teacher หรือ dashboard ยังอ่านอยู่
    */
    safeWriteJson("VOCAB_V70_LAST_SUMMARY", payload);

    return payload;
  }

  function loadLastSummary(){
    const keys = getKeys();

    return (
      safeReadJson(keys.lastSummary, null) ||
      safeReadJson("VOCAB_V70_LAST_SUMMARY", null)
    );
  }

  function readSettings(){
    const keys = getKeys();
    return safeReadJson(keys.settings, {});
  }

  function saveSettings(settings){
    const keys = getKeys();
    return safeWriteJson(keys.settings, settings || {});
  }

  function resetAllLocalData(){
    const keys = getKeys();

    Object.keys(keys).forEach(function(k){
      safeRemove(keys[k]);
    });

    [
      "VOCAB_V71_STUDENT_PROFILE",
      "VOCAB_V70_LAST_SUMMARY",
      "VOCAB_V71_LEADERBOARD",
      "VOCAB_V71_LOG_QUEUE"
    ].forEach(safeRemove);

    return true;
  }

  const api = {
    version: VERSION,

    keys: getKeys,

    readJson: safeReadJson,
    writeJson: safeWriteJson,
    remove: safeRemove,
    get: safeGet,
    set: safeSet,

    loadStudentProfile,
    saveStudentProfile,
    hydrateStudentForm,
    bindStudentAutoSave,

    readLocalQueue,
    saveLocalQueue,
    pushLocalQueue,
    clearLocalQueue,
    getQueueSize,

    readLeaderboard,
    saveLeaderboard,
    getLeaderboardMode,
    updateLeaderboard,

    saveLastSummary,
    loadLastSummary,

    readSettings,
    saveSettings,

    resetAllLocalData
  };

  window.VocabStorage = api;

  /*
    legacy aliases เผื่อไฟล์เก่าบางส่วนเรียกชื่ออื่น
  */
  window.vocabStorage = api;

  window.readJsonV63 = safeReadJson;
  window.saveStudentContextV63 = saveStudentProfile;
  window.getStudentContextV63 = loadStudentProfile;

  /*
    boot flags หลายเวอร์ชัน
  */
  window.VocabModules = window.VocabModules || {};
  window.VocabModules.storage = true;

  window.__VOCAB_MODULES__ = window.__VOCAB_MODULES__ || {};
  window.__VOCAB_MODULES__.storage = true;

  console.log("[VOCAB STORAGE] loaded", VERSION);
})();
