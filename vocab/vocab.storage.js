/* =========================================================
   /vocab/vocab.storage.js
   TechPath Vocab Arena — Storage Service
   FULL CLEAN PATCH: v20260503q

   Includes:
   - loadStudentProfile()
   - saveStudentProfile()
   - hydrateStudentForm()
   - bindStudentAutoSave()
   - pushLocalQueue()
   - readLocalQueue()
   - saveLocalQueue()
   - clearLocalQueue()
   - readLeaderboard()
   - saveLeaderboard()
   - updateLeaderboard()
   - leaderboard dedupe: 1 student / 1 mode
   - saveLastSummary()
   - loadLastSummary()
   - settings helpers
   - legacy aliases
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const VERSION = "vocab-storage-v20260503q";

  const DEFAULT_KEYS = {
    profile: "VOCAB_SPLIT_STUDENT_PROFILE",
    queue: "VOCAB_SPLIT_LOG_QUEUE",
    leaderboard: "VOCAB_SPLIT_LEADERBOARD",
    lastSummary: "VOCAB_SPLIT_LAST_SUMMARY",
    settings: "VOCAB_SPLIT_SETTINGS"
  };

  /* =========================================================
     BASIC HELPERS
  ========================================================= */

  function log(){
    try{
      console.log.apply(console, ["[VOCAB STORAGE]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function warn(){
    try{
      console.warn.apply(console, ["[VOCAB STORAGE]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function getApp(){
    return WIN.VOCAB_APP || WIN.VocabConfig || WIN.VOCAB_CONFIG || {};
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
      warn("readJson failed", key, err);
      return fallback;
    }
  }

  function safeWriteJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(err){
      warn("writeJson failed", key, err);
      return false;
    }
  }

  function safeRemove(key){
    try{
      localStorage.removeItem(key);
      return true;
    }catch(err){
      warn("remove failed", key, err);
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

  function clean(s){
    return String(s ?? "").trim();
  }

  function lower(s){
    return clean(s).toLowerCase();
  }

  function num(v, fallback){
    const n = Number(v);
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

  function nowIso(){
    try{
      return new Date().toISOString();
    }catch(e){
      return "";
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

  function readInput(id){
    const el = DOC.getElementById(id);
    return el ? clean(el.value) : "";
  }

  function writeInput(id, value){
    const el = DOC.getElementById(id);
    if(!el) return;

    if(value !== undefined && value !== null){
      el.value = String(value);
    }
  }

  function normalizeMode(mode){
    mode = lower(mode || "learn");

    if(mode === "ai" || mode === "training" || mode === "ai_training"){
      return "learn";
    }

    if(mode === "debug" || mode === "debug_mission"){
      return "mission";
    }

    if(mode === "boss" || mode === "boss_battle"){
      return "battle";
    }

    return mode || "learn";
  }

  /* =========================================================
     STUDENT PROFILE
  ========================================================= */

  function normalizeStudentProfile(profile){
    profile = profile || {};

    return {
      display_name:
        clean(
          pick(
            profile.display_name,
            profile.displayName,
            profile.name,
            ""
          )
        ),

      displayName:
        clean(
          pick(
            profile.display_name,
            profile.displayName,
            profile.name,
            ""
          )
        ),

      student_id:
        clean(
          pick(
            profile.student_id,
            profile.studentId,
            profile.sid,
            profile.pid,
            ""
          )
        ),

      studentId:
        clean(
          pick(
            profile.student_id,
            profile.studentId,
            profile.sid,
            profile.pid,
            ""
          )
        ),

      section:
        clean(
          pick(
            profile.section,
            profile.classSection,
            profile.class_section,
            ""
          )
        ),

      session_code:
        clean(
          pick(
            profile.session_code,
            profile.sessionCode,
            profile.studyId,
            ""
          )
        ),

      sessionCode:
        clean(
          pick(
            profile.session_code,
            profile.sessionCode,
            profile.studyId,
            ""
          )
        ),

      updated_at:
        clean(
          pick(
            profile.updated_at,
            profile.updatedAt,
            ""
          )
        )
    };
  }

  function loadStudentProfile(){
    const keys = getKeys();

    const saved = normalizeStudentProfile(
      safeReadJson(keys.profile, {})
    );

    /*
      รองรับ key เก่าจาก vocab v7.x / split รุ่นก่อน
    */
    const legacy1 = normalizeStudentProfile(
      safeReadJson("VOCAB_V71_STUDENT_PROFILE", {})
    );

    const legacy2 = normalizeStudentProfile(
      safeReadJson("VOCAB_V74_UNLOCK_PROFILE", {})
    );

    const legacy3 = normalizeStudentProfile(
      safeReadJson("VOCAB_STUDENT_PROFILE", {})
    );

    const displayName =
      clean(
        pick(
          getParam("name"),
          getParam("nick"),
          readInput("vocabDisplayName"),
          readInput("v63DisplayName"),
          saved.display_name,
          legacy1.display_name,
          legacy2.display_name,
          legacy3.display_name,
          "Hero"
        )
      );

    const studentId =
      clean(
        pick(
          getParam("student_id"),
          getParam("studentId"),
          getParam("sid"),
          getParam("pid"),
          readInput("vocabStudentId"),
          readInput("v63StudentId"),
          saved.student_id,
          legacy1.student_id,
          legacy2.student_id,
          legacy3.student_id,
          "anon"
        )
      );

    const section =
      clean(
        pick(
          getParam("section"),
          readInput("vocabSection"),
          readInput("v63Section"),
          saved.section,
          legacy1.section,
          legacy2.section,
          legacy3.section,
          ""
        )
      );

    const sessionCode =
      clean(
        pick(
          getParam("session_code"),
          getParam("sessionCode"),
          getParam("studyId"),
          readInput("vocabSessionCode"),
          readInput("v63SessionCode"),
          saved.session_code,
          legacy1.session_code,
          legacy2.session_code,
          legacy3.session_code,
          ""
        )
      );

    return normalizeStudentProfile({
      display_name: displayName,
      student_id: studentId,
      section: section,
      session_code: sessionCode,
      updated_at: saved.updated_at || legacy1.updated_at || ""
    });
  }

  function saveStudentProfile(profile){
    const keys = getKeys();

    const cleanProfile = normalizeStudentProfile(
      profile || loadStudentProfile()
    );

    cleanProfile.updated_at = nowIso();
    cleanProfile.updatedAt = cleanProfile.updated_at;

    safeWriteJson(keys.profile, cleanProfile);

    /*
      เขียนสำรองลง key เก่า เพื่อให้ logger/teacher เก่าที่อาจอ่านอยู่ไม่พัง
    */
    safeWriteJson("VOCAB_V71_STUDENT_PROFILE", cleanProfile);
    safeWriteJson("VOCAB_STUDENT_PROFILE", cleanProfile);

    return cleanProfile;
  }

  function hydrateStudentForm(){
    const profile = loadStudentProfile();

    writeInput(
      "vocabDisplayName",
      profile.display_name === "Hero" ? "" : profile.display_name
    );

    writeInput(
      "vocabStudentId",
      profile.student_id === "anon" ? "" : profile.student_id
    );

    writeInput("vocabSection", profile.section);
    writeInput("vocabSessionCode", profile.session_code);

    /*
      alias เก่า เผื่อ HTML รุ่นเก่า
    */
    writeInput(
      "v63DisplayName",
      profile.display_name === "Hero" ? "" : profile.display_name
    );

    writeInput(
      "v63StudentId",
      profile.student_id === "anon" ? "" : profile.student_id
    );

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
      const el = DOC.getElementById(id);
      if(!el || el.__vocabStorageBound) return;

      el.__vocabStorageBound = true;

      el.addEventListener("input", function(){
        saveStudentProfile({
          display_name:
            readInput("vocabDisplayName") ||
            readInput("v63DisplayName"),

          student_id:
            readInput("vocabStudentId") ||
            readInput("v63StudentId"),

          section:
            readInput("vocabSection") ||
            readInput("v63Section"),

          session_code:
            readInput("vocabSessionCode") ||
            readInput("v63SessionCode")
        });
      });
    });
  }

  /* =========================================================
     LOCAL LOG QUEUE
  ========================================================= */

  function readLocalQueue(){
    const keys = getKeys();

    const queue =
      safeReadJson(keys.queue, null) ||
      safeReadJson("VOCAB_V71_LOG_QUEUE", null) ||
      safeReadJson("VOCAB_LOG_QUEUE", null) ||
      [];

    return Array.isArray(queue) ? queue : [];
  }

  function saveLocalQueue(queue){
    const keys = getKeys();
    queue = Array.isArray(queue) ? queue : [];

    return safeWriteJson(keys.queue, queue);
  }

  function pushLocalQueue(payload, options){
    const max = Number(options && options.max ? options.max : 900);

    const queue = readLocalQueue();

    queue.push({
      saved_at: nowIso(),
      payload: payload || {}
    });

    const trimmed = queue.slice(-max);
    saveLocalQueue(trimmed);

    return trimmed;
  }

  function clearLocalQueue(){
    const keys = getKeys();

    safeRemove(keys.queue);
    safeRemove("VOCAB_V71_LOG_QUEUE");
    safeRemove("VOCAB_LOG_QUEUE");

    return true;
  }

  function getQueueSize(){
    return readLocalQueue().length;
  }

  /* =========================================================
     LEADERBOARD DEDUPE
  ========================================================= */

  function emptyBoard(){
    return {
      learn: [],
      speed: [],
      mission: [],
      battle: [],
      bossrush: []
    };
  }

  function normalizeBoard(board){
    const out = emptyBoard();

    if(!board || typeof board !== "object"){
      return out;
    }

    Object.keys(out).forEach(function(mode){
      if(Array.isArray(board[mode])){
        out[mode] = board[mode];
      }
    });

    /*
      เผื่อข้อมูลเก่าเก็บเป็น array รวม ไม่แยก mode
    */
    if(Array.isArray(board)){
      board.forEach(function(row){
        const mode = normalizeMode(row && row.mode);
        if(!Array.isArray(out[mode])) out[mode] = [];
        out[mode].push(row);
      });
    }

    return out;
  }

  function getStudentKey(row){
    row = row || {};

    const studentId = clean(
      pick(
        row.student_id,
        row.studentId,
        row.sid,
        ""
      )
    );

    const name = lower(
      pick(
        row.display_name,
        row.displayName,
        row.name,
        "Hero"
      )
    );

    const section = lower(
      pick(
        row.section,
        row.class_section,
        row.classSection,
        ""
      )
    );

    /*
      ถ้ามี student_id จริง ใช้ student_id เป็นหลัก
      ถ้าไม่มี ใช้ชื่อ + section เพื่อกันชื่อซ้ำคนละห้อง
    */
    if(studentId && studentId !== "anon"){
      return "sid:" + studentId;
    }

    return "name:" + name + "|section:" + section;
  }

  function normalizeLeaderboardEntry(row){
    row = row || {};

    const profile = loadStudentProfile();

    const mode = normalizeMode(
      pick(
        row.mode,
        row.selectedMode,
        "learn"
      )
    );

    const rawScore = num(
      pick(
        row.score,
        row.raw_score,
        row.rawScore,
        0
      ),
      0
    );

    const aiHelpUsed = num(
      pick(
        row.ai_help_used,
        row.aiHelpUsed,
        0
      ),
      0
    );

    const fairScore = num(
      row.fair_score !== undefined
        ? row.fair_score
        : row.fairScore !== undefined
          ? row.fairScore
          : aiHelpUsed > 0
            ? Math.round(rawScore * 0.95)
            : rawScore,
      rawScore
    );

    const displayName = clean(
      pick(
        row.display_name,
        row.displayName,
        row.name,
        profile.display_name,
        "Hero"
      )
    );

    const studentId = clean(
      pick(
        row.student_id,
        row.studentId,
        row.sid,
        profile.student_id,
        "anon"
      )
    );

    const section = clean(
      pick(
        row.section,
        row.class_section,
        row.classSection,
        profile.section,
        ""
      )
    );

    const sessionCode = clean(
      pick(
        row.session_code,
        row.sessionCode,
        profile.session_code,
        ""
      )
    );

    const bank = clean(
      pick(
        row.bank,
        row.selectedBank,
        "A"
      )
    );

    const difficulty = clean(
      pick(
        row.difficulty,
        row.diff,
        row.selectedDifficulty,
        "easy"
      )
    );

    const timestamp = clean(
      pick(
        row.timestamp,
        row.ended_at,
        row.endedAt,
        row.client_ts,
        row.clientTs,
        nowIso()
      )
    );

    const sessionId = clean(
      pick(
        row.session_id,
        row.sessionId,
        "vocab_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7)
      )
    );

    const entry = Object.assign({}, row, {
      session_id: sessionId,
      sessionId: sessionId,

      timestamp: timestamp,

      display_name: displayName,
      displayName: displayName,

      student_id: studentId,
      studentId: studentId,

      section: section,
      session_code: sessionCode,
      sessionCode: sessionCode,

      bank: bank,
      difficulty: difficulty,
      diff: difficulty,
      mode: mode,

      score: rawScore,
      raw_score: rawScore,
      rawScore: rawScore,

      fair_score: fairScore,
      fairScore: fairScore,

      accuracy: num(row.accuracy, 0),

      combo_max:
        num(
          pick(
            row.combo_max,
            row.comboMax,
            row.max_combo,
            row.maxCombo,
            0
          ),
          0
        ),

      comboMax:
        num(
          pick(
            row.combo_max,
            row.comboMax,
            row.max_combo,
            row.maxCombo,
            0
          ),
          0
        ),

      ai_help_used: aiHelpUsed,
      aiHelpUsed: aiHelpUsed,

      ai_assisted:
        aiHelpUsed > 0
          ? 1
          : num(
              pick(
                row.ai_assisted,
                row.aiAssisted,
                0
              ),
              0
            ),

      aiAssisted:
        aiHelpUsed > 0
          ? 1
          : num(
              pick(
                row.ai_assisted,
                row.aiAssisted,
                0
              ),
              0
            ),

      attempts:
        num(
          pick(
            row.attempts,
            1
          ),
          1
        )
    });

    return entry;
  }

  function isBetterEntry(newRow, oldRow){
    if(!oldRow) return true;

    const newScore = num(
      pick(
        newRow.fair_score,
        newRow.fairScore,
        newRow.score,
        0
      ),
      0
    );

    const oldScore = num(
      pick(
        oldRow.fair_score,
        oldRow.fairScore,
        oldRow.score,
        0
      ),
      0
    );

    if(newScore !== oldScore){
      return newScore > oldScore;
    }

    const newAcc = num(newRow.accuracy, 0);
    const oldAcc = num(oldRow.accuracy, 0);

    if(newAcc !== oldAcc){
      return newAcc > oldAcc;
    }

    const newCombo = num(
      pick(
        newRow.combo_max,
        newRow.comboMax,
        0
      ),
      0
    );

    const oldCombo = num(
      pick(
        oldRow.combo_max,
        oldRow.comboMax,
        0
      ),
      0
    );

    if(newCombo !== oldCombo){
      return newCombo > oldCombo;
    }

    return String(newRow.timestamp || "") >= String(oldRow.timestamp || "");
  }

  function sortLeaderboardRows(rows){
    return rows.slice().sort(function(a, b){
      const scoreDiff =
        num(
          pick(
            b.fair_score,
            b.fairScore,
            b.score,
            0
          ),
          0
        ) -
        num(
          pick(
            a.fair_score,
            a.fairScore,
            a.score,
            0
          ),
          0
        );

      if(scoreDiff !== 0) return scoreDiff;

      const accDiff =
        num(b.accuracy, 0) -
        num(a.accuracy, 0);

      if(accDiff !== 0) return accDiff;

      const comboDiff =
        num(
          pick(
            b.combo_max,
            b.comboMax,
            0
          ),
          0
        ) -
        num(
          pick(
            a.combo_max,
            a.comboMax,
            0
          ),
          0
        );

      if(comboDiff !== 0) return comboDiff;

      return String(b.timestamp || "").localeCompare(String(a.timestamp || ""));
    });
  }

  function compactRows(rows){
    rows = Array.isArray(rows) ? rows : [];

    const map = new Map();

    rows.forEach(function(row){
      const entry = normalizeLeaderboardEntry(row);
      const key = getStudentKey(entry);
      const old = map.get(key);

      if(isBetterEntry(entry, old)){
        const attempts =
          old
            ? num(old.attempts, 1) + 1
            : num(entry.attempts, 1);

        entry.attempts = attempts;
        entry.best_saved_at = nowIso();

        map.set(key, entry);
      }else if(old){
        old.attempts = num(old.attempts, 1) + 1;
        map.set(key, old);
      }
    });

    return sortLeaderboardRows(Array.from(map.values()));
  }

  function compactBoard(board){
    board = normalizeBoard(board);

    Object.keys(board).forEach(function(mode){
      board[mode] = compactRows(board[mode]).slice(0, 50);
    });

    return board;
  }

  function readLeaderboard(){
    const keys = getKeys();

    let board =
      safeReadJson(keys.leaderboard, null) ||
      safeReadJson("VOCAB_V71_LEADERBOARD", null) ||
      safeReadJson("VOCAB_LEADERBOARD", null) ||
      null;

    board = compactBoard(board);

    /*
      compact ทันที เพื่อเคลียร์รายการซ้ำเก่า
    */
    safeWriteJson(keys.leaderboard, board);

    return board;
  }

  function saveLeaderboard(board){
    const keys = getKeys();

    board = compactBoard(board);

    safeWriteJson(keys.leaderboard, board);

    /*
      สำรอง key เก่า เผื่อ dashboard รุ่นเก่าอ่านอยู่
    */
    safeWriteJson("VOCAB_V71_LEADERBOARD", board);

    return true;
  }

  function getLeaderboardMode(mode){
    mode = normalizeMode(mode || "learn");

    const board = readLeaderboard();
    return Array.isArray(board[mode]) ? board[mode] : [];
  }

  function updateLeaderboard(result){
    const board = readLeaderboard();

    const entry = normalizeLeaderboardEntry(result || {});
    const mode = normalizeMode(entry.mode || "learn");

    if(!Array.isArray(board[mode])){
      board[mode] = [];
    }

    board[mode].push(entry);
    board[mode] = compactRows(board[mode]).slice(0, 50);

    saveLeaderboard(board);

    const studentKey = getStudentKey(entry);

    const rank =
      board[mode].findIndex(function(row){
        return getStudentKey(row) === studentKey;
      }) + 1;

    const best = rank > 0 ? board[mode][rank - 1] : entry;
    const top = board[mode][0] || best;

    const fairScore = num(
      pick(
        best.fair_score,
        best.fairScore,
        best.score,
        0
      ),
      0
    );

    const classTopScore = num(
      pick(
        top.fair_score,
        top.fairScore,
        top.score,
        0
      ),
      0
    );

    return {
      entry: best,
      rank: rank || "-",
      fairScore: fairScore,
      personalBest: fairScore,
      improvement: 0,
      classTopScore: classTopScore,
      board: board
    };
  }

  function clearLeaderboard(){
    const keys = getKeys();

    const board = emptyBoard();

    safeWriteJson(keys.leaderboard, board);
    safeWriteJson("VOCAB_V71_LEADERBOARD", board);

    return board;
  }

  /* =========================================================
     LAST SUMMARY
  ========================================================= */

  function saveLastSummary(summary){
    const keys = getKeys();

    const payload = {
      saved_at: nowIso(),
      summary: summary || {}
    };

    safeWriteJson(keys.lastSummary, payload);

    /*
      key เก่า เผื่อหน้า teacher/dashboard ยังอ่านอยู่
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

  /* =========================================================
     SETTINGS
  ========================================================= */

  function readSettings(){
    const keys = getKeys();
    return safeReadJson(keys.settings, {});
  }

  function saveSettings(settings){
    const keys = getKeys();
    return safeWriteJson(keys.settings, settings || {});
  }

  /* =========================================================
     RESET / MIGRATION
  ========================================================= */

  function resetAllLocalData(){
    const keys = getKeys();

    Object.keys(keys).forEach(function(k){
      safeRemove(keys[k]);
    });

    [
      "VOCAB_V71_STUDENT_PROFILE",
      "VOCAB_STUDENT_PROFILE",
      "VOCAB_V74_UNLOCK_PROFILE",
      "VOCAB_V70_LAST_SUMMARY",
      "VOCAB_V71_LEADERBOARD",
      "VOCAB_LEADERBOARD",
      "VOCAB_V71_LOG_QUEUE",
      "VOCAB_LOG_QUEUE"
    ].forEach(safeRemove);

    return true;
  }

  function compactLeaderboardNow(){
    const board = readLeaderboard();
    saveLeaderboard(board);
    return board;
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

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
    clearLeaderboard,
    compactLeaderboardNow,

    normalizeLeaderboardEntry,
    compactBoard,
    compactRows,

    saveLastSummary,
    loadLastSummary,

    readSettings,
    saveSettings,

    resetAllLocalData
  };

  WIN.VocabStorage = api;
  WIN.vocabStorage = api;

  /*
    legacy aliases เผื่อไฟล์เก่าบางส่วนเรียกชื่ออื่น
  */
  WIN.readJsonV63 = safeReadJson;
  WIN.saveStudentContextV63 = saveStudentProfile;
  WIN.getStudentContextV63 = loadStudentProfile;

  WIN.VocabModules = WIN.VocabModules || {};
  WIN.VocabModules.storage = true;

  WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
  WIN.__VOCAB_MODULES__.storage = true;

  /*
    Compact leaderboard ทันทีตอนโหลด เพื่อเคลียร์รายการซ้ำเก่า
  */
  try{
    compactLeaderboardNow();
  }catch(err){
    warn("compactLeaderboardNow failed", err);
  }

  log("loaded", VERSION);
})();
