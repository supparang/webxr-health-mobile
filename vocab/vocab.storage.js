/* =========================================================
   /vocab/vocab.storage.js
   TechPath Vocab Arena — Storage / Local Profile / Queue
   PATCH: v20260503c
   Fix:
   - add loadStudentProfile()
   - add pushLocalQueue() alias for logger
   - add compatibility aliases for old split modules
   - safe localStorage read/write
   ========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const STORAGE_VERSION = "vocab-storage-v20260503c";

  if(!WIN.VocabUtils){
    console.error("[VOCAB STORAGE] VocabUtils is not defined. Load vocab.utils.js first");
  }

  const U = WIN.VocabUtils || {};

  const KEYS = {
    profile: "VOCAB_SPLIT_STUDENT_PROFILE",
    leaderboard: "VOCAB_SPLIT_LEADERBOARD",
    logQueue: "VOCAB_SPLIT_LOG_QUEUE",
    lastSummary: "VOCAB_SPLIT_LAST_SUMMARY",
    settings: "VOCAB_SPLIT_SETTINGS"
  };

  /* =========================================================
     BASIC SAFE STORAGE
  ========================================================= */

  function safeReadJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      return JSON.parse(raw);
    }catch(err){
      console.warn("[VOCAB STORAGE] read json failed:", key, err);
      return fallback;
    }
  }

  function safeWriteJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(err){
      console.warn("[VOCAB STORAGE] write json failed:", key, err);
      return false;
    }
  }

  function safeRemove(key){
    try{
      localStorage.removeItem(key);
      return true;
    }catch(err){
      console.warn("[VOCAB STORAGE] remove failed:", key, err);
      return false;
    }
  }

  function safeText(v, fallback = ""){
    if(U.safeText) return U.safeText(v, fallback);
    const s = String(v ?? "").trim();
    return s || fallback;
  }

  function qsParam(name, fallback = ""){
    try{
      const p = new URLSearchParams(location.search);
      return p.get(name) || fallback;
    }catch(e){
      return fallback;
    }
  }

  function byId(id){
    return DOC.getElementById(id);
  }

  /* =========================================================
     STUDENT PROFILE
  ========================================================= */

  function readStudentInputs(){
    return {
      display_name: safeText(byId("vocabDisplayName")?.value),
      student_id: safeText(byId("vocabStudentId")?.value),
      section: safeText(byId("vocabSection")?.value),
      session_code: safeText(byId("vocabSessionCode")?.value)
    };
  }

  function writeStudentInputs(profile = {}){
    const map = {
      vocabDisplayName: profile.display_name || profile.name || "",
      vocabStudentId: profile.student_id || profile.sid || profile.pid || "",
      vocabSection: profile.section || "",
      vocabSessionCode: profile.session_code || profile.sessionCode || profile.studyId || ""
    };

    Object.entries(map).forEach(([id, value]) => {
      const el = byId(id);
      if(el && value !== undefined && value !== null){
        el.value = String(value);
      }
    });
  }

  function loadStudentProfile(){
    const saved = safeReadJson(KEYS.profile, {}) || {};

    return {
      display_name:
        qsParam("name") ||
        qsParam("nick") ||
        saved.display_name ||
        saved.name ||
        "",

      student_id:
        qsParam("student_id") ||
        qsParam("sid") ||
        qsParam("pid") ||
        saved.student_id ||
        saved.sid ||
        saved.pid ||
        "",

      section:
        qsParam("section") ||
        saved.section ||
        "",

      session_code:
        qsParam("session_code") ||
        qsParam("studyId") ||
        saved.session_code ||
        saved.sessionCode ||
        saved.studyId ||
        ""
    };
  }

  function saveStudentProfile(profile = {}){
    const current = loadStudentProfile();

    const next = {
      ...current,
      ...profile,
      display_name: safeText(profile.display_name ?? profile.name ?? current.display_name),
      student_id: safeText(profile.student_id ?? profile.sid ?? profile.pid ?? current.student_id),
      section: safeText(profile.section ?? current.section),
      session_code: safeText(profile.session_code ?? profile.sessionCode ?? profile.studyId ?? current.session_code),
      saved_at: new Date().toISOString(),
      storage_version: STORAGE_VERSION
    };

    safeWriteJson(KEYS.profile, next);
    return next;
  }

  function hydrateStudentForm(){
    const profile = loadStudentProfile();
    writeStudentInputs(profile);
    return profile;
  }

  function saveStudentContextFromForm(){
    const inputs = readStudentInputs();

    const profile = saveStudentProfile({
      display_name: inputs.display_name || qsParam("name") || qsParam("nick") || "Hero",
      student_id: inputs.student_id || qsParam("student_id") || qsParam("sid") || qsParam("pid") || "anon",
      section: inputs.section || qsParam("section") || "",
      session_code: inputs.session_code || qsParam("session_code") || qsParam("studyId") || ""
    });

    return profile;
  }

  function getStudentContext(){
    const saved = loadStudentProfile();
    const inputs = readStudentInputs();

    return {
      display_name:
        inputs.display_name ||
        saved.display_name ||
        qsParam("name") ||
        qsParam("nick") ||
        "Hero",

      student_id:
        inputs.student_id ||
        saved.student_id ||
        qsParam("student_id") ||
        qsParam("sid") ||
        qsParam("pid") ||
        "anon",

      section:
        inputs.section ||
        saved.section ||
        qsParam("section") ||
        "",

      session_code:
        inputs.session_code ||
        saved.session_code ||
        qsParam("session_code") ||
        qsParam("studyId") ||
        ""
    };
  }

  /* =========================================================
     LEADERBOARD
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

  function readLeaderboard(){
    const board = safeReadJson(KEYS.leaderboard, defaultLeaderboard()) || defaultLeaderboard();

    ["learn", "speed", "mission", "battle", "bossrush"].forEach(mode => {
      if(!Array.isArray(board[mode])) board[mode] = [];
    });

    return board;
  }

  function saveLeaderboard(board){
    return safeWriteJson(KEYS.leaderboard, board || defaultLeaderboard());
  }

  function addLeaderboardEntry(mode, entry, maxRows = 30){
    mode = safeText(mode, "learn");

    const board = readLeaderboard();
    if(!Array.isArray(board[mode])) board[mode] = [];

    board[mode].push({
      ...entry,
      saved_at: new Date().toISOString()
    });

    board[mode].sort((a, b) => {
      const sa = Number(a.fair_score ?? a.score ?? 0);
      const sb = Number(b.fair_score ?? b.score ?? 0);
      if(sb !== sa) return sb - sa;

      const aa = Number(a.accuracy ?? 0);
      const ab = Number(b.accuracy ?? 0);
      if(ab !== aa) return ab - aa;

      return Number(b.combo_max ?? b.comboMax ?? 0) - Number(a.combo_max ?? a.comboMax ?? 0);
    });

    board[mode] = board[mode].slice(0, maxRows);
    saveLeaderboard(board);

    const sessionId = entry.session_id || entry.sessionId || "";
    const rank = sessionId
      ? board[mode].findIndex(x => String(x.session_id || x.sessionId || "") === String(sessionId)) + 1
      : board[mode].indexOf(entry) + 1;

    return {
      board,
      rows: board[mode],
      rank: rank > 0 ? rank : "",
      topScore: board[mode][0] ? Number(board[mode][0].fair_score ?? board[mode][0].score ?? 0) : 0
    };
  }

  /* =========================================================
     LOG QUEUE
  ========================================================= */

  function readLogQueue(){
    const list = safeReadJson(KEYS.logQueue, []);
    return Array.isArray(list) ? list : [];
  }

  function saveLogQueue(list){
    const clean = Array.isArray(list) ? list.slice(-900) : [];
    return safeWriteJson(KEYS.logQueue, clean);
  }

  function pushLog(payload){
    const queue = readLogQueue();

    queue.push({
      ...payload,
      queued_at: payload?.queued_at || new Date().toISOString()
    });

    saveLogQueue(queue);
    return queue;
  }

  function clearLogQueue(){
    return saveLogQueue([]);
  }

  /* =========================================================
     SUMMARY
  ========================================================= */

  function saveLastSummary(summary){
    const payload = {
      saved_at: new Date().toISOString(),
      storage_version: STORAGE_VERSION,
      ...summary
    };

    safeWriteJson(KEYS.lastSummary, payload);
    return payload;
  }

  function loadLastSummary(){
    return safeReadJson(KEYS.lastSummary, null);
  }

  /* =========================================================
     SETTINGS
  ========================================================= */

  function loadSettings(){
    return safeReadJson(KEYS.settings, {
      sound: true,
      guard: true,
      lastBank: "A",
      lastDifficulty: "easy",
      lastMode: "learn"
    });
  }

  function saveSettings(settings = {}){
    const old = loadSettings();

    const next = {
      ...old,
      ...settings,
      saved_at: new Date().toISOString()
    };

    safeWriteJson(KEYS.settings, next);
    return next;
  }

  /* =========================================================
     CLEAR
  ========================================================= */

  function clearAllLocalVocabData(){
    Object.values(KEYS).forEach(key => safeRemove(key));
    return true;
  }

  /* =========================================================
     COMPATIBILITY ALIASES
     สำคัญ: รองรับ logger/game/ui รุ่นก่อนหน้า
  ========================================================= */

  function getProfile(){
    return loadStudentProfile();
  }

  function setProfile(profile){
    return saveStudentProfile(profile);
  }

  function loadProfile(){
    return loadStudentProfile();
  }

  function saveProfile(profile){
    return saveStudentProfile(profile);
  }

  function loadStudent(){
    return loadStudentProfile();
  }

  function saveStudent(profile){
    return saveStudentProfile(profile);
  }

  function readQueue(){
    return readLogQueue();
  }

  function saveQueue(list){
    return saveLogQueue(list);
  }

  function pushQueue(payload){
    return pushLog(payload);
  }

  function pushLocalQueue(payload){
    return pushLog(payload);
  }

  function readLocalQueue(){
    return readLogQueue();
  }

  function saveLocalQueue(list){
    return saveLogQueue(list);
  }

  function enqueue(payload){
    return pushLog(payload);
  }

  function pushEvent(payload){
    return pushLog(payload);
  }

  /* =========================================================
     EXPORT
  ========================================================= */

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

    clearAllLocalVocabData,

    // compatibility aliases
    getProfile,
    setProfile,
    loadProfile,
    saveProfile,
    loadStudent,
    saveStudent,

    readQueue,
    saveQueue,
    pushQueue,

    pushLocalQueue,
    readLocalQueue,
    saveLocalQueue,

    enqueue,
    pushEvent
  };

  WIN.VocabStorage = api;

  // legacy globals, เผื่อไฟล์อื่นเรียกตรง ๆ
  WIN.loadStudentProfile = WIN.loadStudentProfile || loadStudentProfile;
  WIN.saveStudentProfile = WIN.saveStudentProfile || saveStudentProfile;
  WIN.getStudentContextVocab = WIN.getStudentContextVocab || getStudentContext;
  WIN.pushLocalQueue = WIN.pushLocalQueue || pushLocalQueue;

  console.log("[VOCAB STORAGE] loaded", STORAGE_VERSION);
})();
