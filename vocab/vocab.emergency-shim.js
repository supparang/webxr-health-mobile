/* =========================================================
   /vocab/vocab.emergency-shim.js
   TechPath Vocab Arena — Emergency Compatibility Shim
   PATCH: v20260503d
   Purpose:
   - กันเกมพังเมื่อ module บางไฟล์ยังเรียก function legacy
   - ต้องโหลดหลัง vocab.storage.js
   - ต้องโหลดก่อน vocab.logger.js / vocab.ui.js / vocab.game.js / vocab.boot.js

   Fixes:
   - VocabStorage.pushLocalQueue is not a function
   - VocabStorage.loadStudentProfile is not a function
   - VocabStorage.getStudentContext is not a function
   - VocabStorage.saveLastSummary / leaderboard aliases missing
   - ช่วยให้ logger/game/ui เรียกชื่อเก่าได้แม้ storage ยัง cache
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;
  const LS = window.localStorage;

  const SHIM_VERSION = "vocab-emergency-shim-v20260503d";

  const KEYS = {
    profile: "VOCAB_SPLIT_STUDENT_PROFILE",
    profileLegacy: "VOCAB_V71_STUDENT_PROFILE",

    queue: "VOCAB_SPLIT_LOG_QUEUE",
    queueLegacy: "VOCAB_V71_LOG_QUEUE",

    leaderboard: "VOCAB_SPLIT_LEADERBOARD",
    leaderboardLegacy: "VOCAB_V71_LEADERBOARD",

    lastSummary: "VOCAB_SPLIT_LAST_SUMMARY",
    lastSummaryLegacy: "VOCAB_V70_LAST_SUMMARY",

    settings: "VOCAB_SPLIT_SETTINGS"
  };

  /* =========================================================
     BASIC HELPERS
  ========================================================= */

  function safeText(value, fallback = ""){
    const s = String(value ?? "").trim();
    return s || fallback;
  }

  function byId(id){
    return DOC.getElementById(id);
  }

  function readJson(key, fallback){
    try{
      const raw = LS.getItem(key);
      if(!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    }catch(err){
      console.warn("[VOCAB SHIM] readJson failed:", key, err);
      return fallback;
    }
  }

  function writeJson(key, value){
    try{
      LS.setItem(key, JSON.stringify(value));
      return true;
    }catch(err){
      console.warn("[VOCAB SHIM] writeJson failed:", key, err);
      return false;
    }
  }

  function removeKey(key){
    try{
      LS.removeItem(key);
      return true;
    }catch(err){
      return false;
    }
  }

  function getParam(name, fallback = ""){
    try{
      const p = new URLSearchParams(location.search);
      return p.get(name) || fallback;
    }catch(err){
      return fallback;
    }
  }

  function ensureObject(obj){
    return obj && typeof obj === "object" ? obj : {};
  }

  function ensureArray(value){
    return Array.isArray(value) ? value : [];
  }

  /* =========================================================
     ENSURE GLOBAL STORAGE OBJECT
  ========================================================= */

  WIN.VocabStorage = WIN.VocabStorage || {};
  const S = WIN.VocabStorage;

  /* =========================================================
     STUDENT PROFILE FALLBACKS
  ========================================================= */

  function readStudentInputs(){
    return {
      display_name:
        safeText(byId("vocabDisplayName")?.value) ||
        safeText(byId("v63DisplayName")?.value),

      student_id:
        safeText(byId("vocabStudentId")?.value) ||
        safeText(byId("v63StudentId")?.value),

      section:
        safeText(byId("vocabSection")?.value) ||
        safeText(byId("v63Section")?.value),

      session_code:
        safeText(byId("vocabSessionCode")?.value) ||
        safeText(byId("v63SessionCode")?.value)
    };
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
      const el = byId(id);
      if(!el) return;

      if(!safeText(el.value) && safeText(value)){
        el.value = value;
      }
    });
  }

  function normalizeStudentProfile(input){
    input = ensureObject(input);

    return {
      display_name: safeText(
        input.display_name ??
        input.displayName ??
        input.name ??
        input.nick
      ),

      student_id: safeText(
        input.student_id ??
        input.studentId ??
        input.sid ??
        input.pid
      ),

      section: safeText(
        input.section ??
        input.classSection
      ),

      session_code: safeText(
        input.session_code ??
        input.sessionCode ??
        input.studyId
      ),

      saved_at: input.saved_at || input.savedAt || "",
      storage_version: input.storage_version || input.storageVersion || ""
    };
  }

  function shimLoadStudentProfile(){
    const saved =
      readJson(KEYS.profile, null) ||
      readJson(KEYS.profileLegacy, null) ||
      {};

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
        Object.entries(fromUrl).filter(([, value]) => safeText(value))
      )
    });

    return merged;
  }

  function shimSaveStudentProfile(profile){
    const current = shimLoadStudentProfile();
    const next = normalizeStudentProfile({
      ...current,
      ...normalizeStudentProfile(profile),
      saved_at: new Date().toISOString(),
      storage_version: SHIM_VERSION
    });

    writeJson(KEYS.profile, next);
    writeJson(KEYS.profileLegacy, next);

    return next;
  }

  function shimGetStudentContext(){
    const saved = shimLoadStudentProfile();
    const inputs = readStudentInputs();

    const merged = normalizeStudentProfile({
      ...saved,
      ...Object.fromEntries(
        Object.entries(inputs).filter(([, value]) => safeText(value))
      )
    });

    return {
      display_name: merged.display_name || "Hero",
      student_id: merged.student_id || "anon",
      section: merged.section || "",
      session_code: merged.session_code || ""
    };
  }

  function shimHydrateStudentForm(){
    const profile = shimLoadStudentProfile();
    writeStudentInputs(profile);
    return profile;
  }

  function shimSaveStudentContextFromForm(){
    const ctx = shimGetStudentContext();
    return shimSaveStudentProfile(ctx);
  }

  /* =========================================================
     LOG QUEUE FALLBACKS
  ========================================================= */

  function shimReadLogQueue(){
    const q =
      readJson(KEYS.queue, null) ||
      readJson(KEYS.queueLegacy, null) ||
      [];

    return ensureArray(q);
  }

  function shimSaveLogQueue(queue){
    const clean = ensureArray(queue).slice(-900);

    writeJson(KEYS.queue, clean);
    writeJson(KEYS.queueLegacy, clean);

    return clean;
  }

  function shimPushLog(payload){
    const q = shimReadLogQueue();

    q.push({
      ...(payload || {}),
      queued_at: payload?.queued_at || new Date().toISOString(),
      shim_version: SHIM_VERSION
    });

    return shimSaveLogQueue(q);
  }

  function shimClearLogQueue(){
    writeJson(KEYS.queue, []);
    writeJson(KEYS.queueLegacy, []);
    return true;
  }

  /* =========================================================
     LEADERBOARD FALLBACKS
  ========================================================= */

  function defaultLeaderboard(){
    return {
      learn: [],
      speed: [],
      mission: [],
      battle: [],
      bossrush: []
    };
  }

  function shimReadLeaderboard(){
    const board =
      readJson(KEYS.leaderboard, null) ||
      readJson(KEYS.leaderboardLegacy, null) ||
      defaultLeaderboard();

    const clean = {
      ...defaultLeaderboard(),
      ...ensureObject(board)
    };

    Object.keys(defaultLeaderboard()).forEach(mode => {
      clean[mode] = ensureArray(clean[mode]);
    });

    return clean;
  }

  function shimSaveLeaderboard(board){
    const clean = {
      ...defaultLeaderboard(),
      ...ensureObject(board)
    };

    Object.keys(defaultLeaderboard()).forEach(mode => {
      clean[mode] = ensureArray(clean[mode]);
    });

    writeJson(KEYS.leaderboard, clean);
    writeJson(KEYS.leaderboardLegacy, clean);

    return clean;
  }

  function shimAddLeaderboardEntry(mode, entry, maxRows = 30){
    mode = safeText(mode, "learn").toLowerCase();

    const board = shimReadLeaderboard();

    if(!Array.isArray(board[mode])){
      board[mode] = [];
    }

    const row = {
      ...(entry || {}),
      timestamp: entry?.timestamp || new Date().toISOString(),
      saved_at: new Date().toISOString(),
      shim_version: SHIM_VERSION
    };

    board[mode].push(row);

    board[mode].sort((a, b) => {
      const scoreA = Number(a.fair_score ?? a.fairScore ?? a.score ?? 0);
      const scoreB = Number(b.fair_score ?? b.fairScore ?? b.score ?? 0);

      if(scoreB !== scoreA) return scoreB - scoreA;

      const accA = Number(a.accuracy ?? 0);
      const accB = Number(b.accuracy ?? 0);

      if(accB !== accA) return accB - accA;

      const comboA = Number(a.combo_max ?? a.comboMax ?? 0);
      const comboB = Number(b.combo_max ?? b.comboMax ?? 0);

      return comboB - comboA;
    });

    board[mode] = board[mode].slice(0, Number(maxRows || 30));

    shimSaveLeaderboard(board);

    const sessionId = row.session_id || row.sessionId || "";
    const rank = sessionId
      ? board[mode].findIndex(x => String(x.session_id || x.sessionId || "") === String(sessionId)) + 1
      : "";

    return {
      board,
      rows: board[mode],
      rank: rank > 0 ? rank : "",
      topScore: board[mode][0]
        ? Number(board[mode][0].fair_score ?? board[mode][0].fairScore ?? board[mode][0].score ?? 0)
        : 0
    };
  }

  /* =========================================================
     SUMMARY FALLBACKS
  ========================================================= */

  function shimSaveLastSummary(summary){
    const payload = {
      saved_at: new Date().toISOString(),
      shim_version: SHIM_VERSION,
      ...(summary || {})
    };

    writeJson(KEYS.lastSummary, payload);
    writeJson(KEYS.lastSummaryLegacy, payload);

    return payload;
  }

  function shimLoadLastSummary(){
    return (
      readJson(KEYS.lastSummary, null) ||
      readJson(KEYS.lastSummaryLegacy, null)
    );
  }

  /* =========================================================
     SETTINGS FALLBACKS
  ========================================================= */

  function shimLoadSettings(){
    return {
      sound: true,
      guard: true,
      lastBank: "A",
      lastDifficulty: "easy",
      lastMode: "learn",
      ...ensureObject(readJson(KEYS.settings, {}))
    };
  }

  function shimSaveSettings(settings){
    const next = {
      ...shimLoadSettings(),
      ...ensureObject(settings),
      saved_at: new Date().toISOString(),
      shim_version: SHIM_VERSION
    };

    writeJson(KEYS.settings, next);
    return next;
  }

  /* =========================================================
     CLEAR FALLBACK
  ========================================================= */

  function shimClearAllLocalVocabData(){
    Object.values(KEYS).forEach(removeKey);

    try{
      Object.keys(LS).forEach(key => {
        if(String(key).startsWith("VOCAB_")){
          removeKey(key);
        }
      });
    }catch(err){}

    return true;
  }

  /* =========================================================
     PATCH ONLY MISSING FUNCTIONS
     ไม่ทับ function ที่ vocab.storage.js ตัวใหม่มีอยู่แล้ว
  ========================================================= */

  function defineMissing(name, fn){
    if(typeof S[name] !== "function"){
      S[name] = fn;
    }
  }

  defineMissing("safeReadJson", readJson);
  defineMissing("safeWriteJson", writeJson);
  defineMissing("safeRemove", removeKey);

  defineMissing("loadStudentProfile", shimLoadStudentProfile);
  defineMissing("saveStudentProfile", shimSaveStudentProfile);
  defineMissing("getStudentContext", shimGetStudentContext);
  defineMissing("hydrateStudentForm", shimHydrateStudentForm);
  defineMissing("saveStudentContextFromForm", shimSaveStudentContextFromForm);
  defineMissing("readStudentInputs", readStudentInputs);
  defineMissing("writeStudentInputs", writeStudentInputs);

  defineMissing("readLogQueue", shimReadLogQueue);
  defineMissing("saveLogQueue", shimSaveLogQueue);
  defineMissing("pushLog", shimPushLog);
  defineMissing("clearLogQueue", shimClearLogQueue);

  defineMissing("readLeaderboard", shimReadLeaderboard);
  defineMissing("saveLeaderboard", shimSaveLeaderboard);
  defineMissing("addLeaderboardEntry", shimAddLeaderboardEntry);

  defineMissing("saveLastSummary", shimSaveLastSummary);
  defineMissing("loadLastSummary", shimLoadLastSummary);

  defineMissing("loadSettings", shimLoadSettings);
  defineMissing("saveSettings", shimSaveSettings);

  defineMissing("clearAllLocalVocabData", shimClearAllLocalVocabData);

  /* =========================================================
     LEGACY ALIASES
     จุดสำคัญที่แก้ error pushLocalQueue
  ========================================================= */

  defineMissing("pushLocalQueue", S.pushLog || shimPushLog);
  defineMissing("readLocalQueue", S.readLogQueue || shimReadLogQueue);
  defineMissing("saveLocalQueue", S.saveLogQueue || shimSaveLogQueue);

  defineMissing("readQueue", S.readLogQueue || shimReadLogQueue);
  defineMissing("saveQueue", S.saveLogQueue || shimSaveLogQueue);
  defineMissing("pushQueue", S.pushLog || shimPushLog);

  defineMissing("enqueue", S.pushLog || shimPushLog);
  defineMissing("pushEvent", S.pushLog || shimPushLog);

  defineMissing("getProfile", S.loadStudentProfile || shimLoadStudentProfile);
  defineMissing("setProfile", S.saveStudentProfile || shimSaveStudentProfile);
  defineMissing("loadProfile", S.loadStudentProfile || shimLoadStudentProfile);
  defineMissing("saveProfile", S.saveStudentProfile || shimSaveStudentProfile);
  defineMissing("loadStudent", S.loadStudentProfile || shimLoadStudentProfile);
  defineMissing("saveStudent", S.saveStudentProfile || shimSaveStudentProfile);

  defineMissing("loadSummary", S.loadLastSummary || shimLoadLastSummary);
  defineMissing("saveSummary", S.saveLastSummary || shimSaveLastSummary);

  /* =========================================================
     GLOBAL LEGACY ALIASES
     เผื่อบาง module เรียกตรง window.functionName
  ========================================================= */

  WIN.loadStudentProfile = WIN.loadStudentProfile || S.loadStudentProfile;
  WIN.saveStudentProfile = WIN.saveStudentProfile || S.saveStudentProfile;
  WIN.getStudentContextVocab = WIN.getStudentContextVocab || S.getStudentContext;

  WIN.pushLocalQueue = WIN.pushLocalQueue || S.pushLocalQueue;
  WIN.readLocalQueue = WIN.readLocalQueue || S.readLocalQueue;
  WIN.saveLocalQueue = WIN.saveLocalQueue || S.saveLocalQueue;

  WIN.VOCAB_STORAGE = S;

  /* =========================================================
     SELF CHECK
  ========================================================= */

  const selfCheck = {
    loadStudentProfile: typeof S.loadStudentProfile,
    getStudentContext: typeof S.getStudentContext,
    pushLocalQueue: typeof S.pushLocalQueue,
    readLocalQueue: typeof S.readLocalQueue,
    saveLocalQueue: typeof S.saveLocalQueue,
    readLeaderboard: typeof S.readLeaderboard,
    saveLastSummary: typeof S.saveLastSummary
  };

  console.log("[VOCAB SHIM] emergency compatibility ready", SHIM_VERSION, selfCheck);

})();
