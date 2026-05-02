/* =========================================================
   /vocab/vocab.storage.js
   TechPath Vocab Arena — Storage Module
   Version: 20260503b
   Fix:
   - เพิ่ม loadStudentProfile() ให้ logger เรียกได้
   - เพิ่ม saveStudentProfile()
   - เพิ่ม getStudentContext()
   - รองรับ localStorage key เดิม/ใหม่
   - export: window.VocabStorage
========================================================= */
(function(){
  "use strict";

  const WIN = window;
  const LS = window.localStorage;

  const STORAGE_VERSION = "vocab-storage-20260503b";

  const KEYS = {
    studentProfile: "VOCAB_STUDENT_PROFILE",
    studentProfileLegacy: "VOCAB_V71_STUDENT_PROFILE",
    leaderboard: "VOCAB_LEADERBOARD",
    leaderboardLegacy: "VOCAB_V71_LEADERBOARD",
    lastSummary: "VOCAB_LAST_SUMMARY",
    lastSummaryLegacy: "VOCAB_V70_LAST_SUMMARY",
    logQueue: "VOCAB_LOG_QUEUE",
    logQueueLegacy: "VOCAB_V71_LOG_QUEUE",
    settings: "VOCAB_SETTINGS"
  };

  function safeReadJson(key, fallback){
    try{
      const raw = LS.getItem(key);
      if(!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    }catch(err){
      console.warn("[VOCAB STORAGE] read failed", key, err);
      return fallback;
    }
  }

  function safeWriteJson(key, value){
    try{
      LS.setItem(key, JSON.stringify(value));
      return true;
    }catch(err){
      console.warn("[VOCAB STORAGE] write failed", key, err);
      return false;
    }
  }

  function safeRemove(key){
    try{
      LS.removeItem(key);
      return true;
    }catch(err){
      return false;
    }
  }

  function getParam(name, fallback = ""){
    try{
      const url = new URL(location.href);
      return url.searchParams.get(name) || fallback;
    }catch(err){
      return fallback;
    }
  }

  function normalizeStudentProfile(input){
    input = input || {};

    const displayName =
      input.display_name ||
      input.displayName ||
      input.name ||
      input.nick ||
      "";

    const studentId =
      input.student_id ||
      input.studentId ||
      input.sid ||
      input.pid ||
      "";

    const section =
      input.section ||
      input.classSection ||
      "";

    const sessionCode =
      input.session_code ||
      input.sessionCode ||
      input.studyId ||
      "";

    return {
      display_name: String(displayName || "").trim(),
      student_id: String(studentId || "").trim(),
      section: String(section || "").trim(),
      session_code: String(sessionCode || "").trim(),
      saved_at: input.saved_at || input.savedAt || "",
      last_profile: input.last_profile || input.lastProfile || null
    };
  }

  function readStudentInputs(){
    const ids = {
      display_name: ["vocabDisplayName", "v63DisplayName"],
      student_id: ["vocabStudentId", "v63StudentId"],
      section: ["vocabSection", "v63Section"],
      session_code: ["vocabSessionCode", "v63SessionCode"]
    };

    const out = {};

    Object.keys(ids).forEach(key => {
      const found = ids[key]
        .map(id => document.getElementById(id))
        .find(Boolean);

      out[key] = found ? String(found.value || "").trim() : "";
    });

    return out;
  }

  function writeStudentInputs(profile){
    profile = normalizeStudentProfile(profile);

    const map = {
      vocabDisplayName: profile.display_name,
      v63DisplayName: profile.display_name,

      vocabStudentId: profile.student_id,
      v63StudentId: profile.student_id,

      vocabSection: profile.section,
      v63Section: profile.section,

      vocabSessionCode: profile.session_code,
      v63SessionCode: profile.session_code
    };

    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if(el && !String(el.value || "").trim()){
        el.value = value || "";
      }
    });
  }

  function loadStudentProfile(){
    const savedNew = safeReadJson(KEYS.studentProfile, null);
    const savedOld = safeReadJson(KEYS.studentProfileLegacy, null);

    const saved = savedNew || savedOld || {};

    const fromUrl = {
      display_name:
        getParam("name") ||
        getParam("nick") ||
        getParam("display_name"),

      student_id:
        getParam("student_id") ||
        getParam("sid") ||
        getParam("pid"),

      section:
        getParam("section"),

      session_code:
        getParam("session_code") ||
        getParam("studyId")
    };

    const merged = normalizeStudentProfile({
      ...saved,
      ...Object.fromEntries(
        Object.entries(fromUrl).filter(([,v]) => String(v || "").trim())
      )
    });

    return merged;
  }

  function saveStudentProfile(profile){
    const current = loadStudentProfile();
    const input = normalizeStudentProfile(profile || {});
    const merged = normalizeStudentProfile({
      ...current,
      ...input,
      saved_at: new Date().toISOString()
    });

    safeWriteJson(KEYS.studentProfile, merged);

    /*
      เขียน key เดิมด้วย เพื่อให้ module เก่าที่ยังอ่าน VOCAB_V71_STUDENT_PROFILE ไม่พัง
    */
    safeWriteJson(KEYS.studentProfileLegacy, merged);

    return merged;
  }

  function hydrateStudentForm(){
    const profile = loadStudentProfile();
    writeStudentInputs(profile);
    return profile;
  }

  function getStudentContext(){
    const saved = loadStudentProfile();
    const inputs = readStudentInputs();

    const merged = normalizeStudentProfile({
      ...saved,
      ...Object.fromEntries(
        Object.entries(inputs).filter(([,v]) => String(v || "").trim())
      )
    });

    return {
      display_name: merged.display_name || "Hero",
      student_id: merged.student_id || "anon",
      section: merged.section || "",
      session_code: merged.session_code || ""
    };
  }

  function saveStudentContextFromForm(){
    return saveStudentProfile(readStudentInputs());
  }

  function readLeaderboard(){
    const board =
      safeReadJson(KEYS.leaderboard, null) ||
      safeReadJson(KEYS.leaderboardLegacy, null) ||
      {};

    return {
      learn: Array.isArray(board.learn) ? board.learn : [],
      speed: Array.isArray(board.speed) ? board.speed : [],
      mission: Array.isArray(board.mission) ? board.mission : [],
      battle: Array.isArray(board.battle) ? board.battle : [],
      bossrush: Array.isArray(board.bossrush) ? board.bossrush : []
    };
  }

  function saveLeaderboard(board){
    const clean = {
      learn: Array.isArray(board?.learn) ? board.learn : [],
      speed: Array.isArray(board?.speed) ? board.speed : [],
      mission: Array.isArray(board?.mission) ? board.mission : [],
      battle: Array.isArray(board?.battle) ? board.battle : [],
      bossrush: Array.isArray(board?.bossrush) ? board.bossrush : []
    };

    safeWriteJson(KEYS.leaderboard, clean);
    safeWriteJson(KEYS.leaderboardLegacy, clean);

    return clean;
  }

  function addLeaderboardEntry(mode, entry, maxRows = 30){
    mode = String(mode || "learn").toLowerCase();

    const board = readLeaderboard();

    if(!Array.isArray(board[mode])){
      board[mode] = [];
    }

    board[mode].push({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString()
    });

    board[mode].sort((a,b) => {
      const scoreA = Number(a.fair_score || a.score || 0);
      const scoreB = Number(b.fair_score || b.score || 0);

      if(scoreB !== scoreA) return scoreB - scoreA;

      const accA = Number(a.accuracy || 0);
      const accB = Number(b.accuracy || 0);

      if(accB !== accA) return accB - accA;

      return Number(b.combo_max || b.comboMax || 0) - Number(a.combo_max || a.comboMax || 0);
    });

    board[mode] = board[mode].slice(0, maxRows);

    saveLeaderboard(board);

    return board;
  }

  function saveLastSummary(summary){
    const payload = {
      saved_at: new Date().toISOString(),
      ...summary
    };

    safeWriteJson(KEYS.lastSummary, payload);
    safeWriteJson(KEYS.lastSummaryLegacy, payload);

    return payload;
  }

  function loadLastSummary(){
    return (
      safeReadJson(KEYS.lastSummary, null) ||
      safeReadJson(KEYS.lastSummaryLegacy, null)
    );
  }

  function readLogQueue(){
    const q =
      safeReadJson(KEYS.logQueue, null) ||
      safeReadJson(KEYS.logQueueLegacy, null) ||
      [];

    return Array.isArray(q) ? q : [];
  }

  function saveLogQueue(queue){
    const clean = Array.isArray(queue) ? queue.slice(-900) : [];
    safeWriteJson(KEYS.logQueue, clean);
    safeWriteJson(KEYS.logQueueLegacy, clean);
    return clean;
  }

  function pushLog(payload){
    const queue = readLogQueue();
    queue.push({
      queued_at: new Date().toISOString(),
      ...payload
    });
    return saveLogQueue(queue);
  }

  function clearLogQueue(){
    safeRemove(KEYS.logQueue);
    safeRemove(KEYS.logQueueLegacy);
    return true;
  }

  function loadSettings(){
    return safeReadJson(KEYS.settings, {});
  }

  function saveSettings(settings){
    const merged = {
      ...loadSettings(),
      ...(settings || {}),
      saved_at: new Date().toISOString()
    };

    safeWriteJson(KEYS.settings, merged);
    return merged;
  }

  function clearAllLocalVocabData(){
    Object.values(KEYS).forEach(safeRemove);

    Object.keys(LS).forEach(key => {
      if(String(key).startsWith("VOCAB_")){
        safeRemove(key);
      }
    });

    return true;
  }

  const api = {
    version: STORAGE_VERSION,
    keys: KEYS,

    safeReadJson,
    safeWriteJson,
    safeRemove,

    loadStudentProfile,
    saveStudentProfile,
    hydrateStudentForm,
    getStudentContext,
    saveStudentContextFromForm,
    readStudentInputs,
    writeStudentInputs,

    readLeaderboard,
    saveLeaderboard,
    addLeaderboardEntry,

    saveLastSummary,
    loadLastSummary,

    readLogQueue,
    saveLogQueue,
    pushLog,
    clearLogQueue,

    loadSettings,
    saveSettings,

    clearAllLocalVocabData
  };

  WIN.VocabStorage = api;
  WIN.VOCAB_STORAGE = api;

  /*
    compatibility aliases สำหรับไฟล์เก่าที่อาจเรียกชื่อเดิม
  */
  WIN.readJsonVocabStorage = safeReadJson;
  WIN.writeJsonVocabStorage = safeWriteJson;

  console.log("[VOCAB STORAGE] loaded", STORAGE_VERSION);
})();
