/* =========================================================
   /vocab/vocab.storage.js
   TechPath Vocab Arena — Storage / Logging / Leaderboard
   Version: 20260502a

   ต้องโหลดหลัง:
   - vocab.config.js
   - vocab.utils.js
   - vocab.state.js

   หน้าที่:
   - อ่าน/บันทึกข้อมูลผู้เรียน
   - local log queue
   - POST ไป Google Apps Script
   - last summary
   - teacher summary
   - student profile
   - leaderboard แยกโหมด
   ========================================================= */

(function(){
  "use strict";

  const U = window.VocabUtils;
  const S = window.VocabState;

  if(!U || !S){
    console.error("[VOCAB] vocab.storage.js requires utils/state modules");
    return;
  }

  const Storage = {};

  /* =========================================================
     CONFIG HELPERS
  ========================================================= */

  function app(){
    return window.VOCAB_APP || {};
  }

  function game(){
    return window.vocabGame || S.game;
  }

  function modeConfig(modeId){
    return window.VOCAB_PLAY_MODES?.[modeId || "learn"] || window.VOCAB_PLAY_MODES?.learn || {
      id:"learn",
      label:"AI Training",
      shortLabel:"AI",
      icon:"🤖"
    };
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function endpointBase(){
    return (
      window.VOCAB_SHEET_ENDPOINT ||
      localStorage.getItem("VOCAB_SHEET_ENDPOINT") ||
      app().sheetEndpoint ||
      ""
    );
  }

  /* =========================================================
     STUDENT CONTEXT
  ========================================================= */

  Storage.getValue = function getValue(id){
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  };

  Storage.setInput = function setInput(id, value){
    const el = document.getElementById(id);
    if(el && value !== undefined && value !== null){
      el.value = value;
    }
  };

  Storage.getParam = function getParam(name, fallback = ""){
    try{
      const url = new URL(location.href);
      return url.searchParams.get(name) || fallback;
    }catch(e){
      return fallback;
    }
  };

  Storage.getStudentContext = function getStudentContext(){
    const saved = U.readJson(app().profileKey || "VOCAB_V71_STUDENT_PROFILE", {});

    const displayName =
      Storage.getValue("v63DisplayName") ||
      Storage.getParam("name") ||
      Storage.getParam("nick") ||
      saved.display_name ||
      "Hero";

    const studentId =
      Storage.getValue("v63StudentId") ||
      Storage.getParam("student_id") ||
      Storage.getParam("sid") ||
      Storage.getParam("pid") ||
      saved.student_id ||
      "anon";

    const section =
      Storage.getValue("v63Section") ||
      Storage.getParam("section") ||
      saved.section ||
      "";

    const sessionCode =
      Storage.getValue("v63SessionCode") ||
      Storage.getParam("session_code") ||
      Storage.getParam("studyId") ||
      saved.session_code ||
      "";

    return {
      display_name: displayName,
      student_id: studentId,
      section,
      session_code: sessionCode
    };
  };

  Storage.saveStudentContext = function saveStudentContext(){
    const ctx = Storage.getStudentContext();

    U.writeJson(app().profileKey || "VOCAB_V71_STUDENT_PROFILE", {
      ...ctx,
      saved_at: nowIso()
    });

    return ctx;
  };

  Storage.hydrateStudentForm = function hydrateStudentForm(){
    const saved = U.readJson(app().profileKey || "VOCAB_V71_STUDENT_PROFILE", {});

    Storage.setInput(
      "v63DisplayName",
      Storage.getParam("name") ||
      Storage.getParam("nick") ||
      saved.display_name ||
      ""
    );

    Storage.setInput(
      "v63StudentId",
      Storage.getParam("student_id") ||
      Storage.getParam("sid") ||
      Storage.getParam("pid") ||
      saved.student_id ||
      ""
    );

    Storage.setInput(
      "v63Section",
      Storage.getParam("section") ||
      saved.section ||
      ""
    );

    Storage.setInput(
      "v63SessionCode",
      Storage.getParam("session_code") ||
      Storage.getParam("studyId") ||
      saved.session_code ||
      ""
    );
  };

  /* =========================================================
     SESSION ID
  ========================================================= */

  Storage.getSessionId = function getSessionId(){
    const g = game();

    if(!g.sessionId){
      g.sessionId = `vocab_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    return g.sessionId;
  };

  /* =========================================================
     ENDPOINT
  ========================================================= */

  Storage.buildEndpoint = function buildEndpoint(url){
    url = String(url || "").trim();

    if(!url) return "";

    try{
      const u = new URL(url, location.href);

      if(!u.searchParams.get("api")){
        u.searchParams.set("api", "vocab");
      }

      return u.toString();
    }catch(e){
      return url.includes("?") ? `${url}&api=vocab` : `${url}?api=vocab`;
    }
  };

  Storage.setSheetEndpoint = function setSheetEndpoint(url){
    const endpoint = Storage.buildEndpoint(String(url || "").trim());

    if(window.VOCAB_APP){
      VOCAB_APP.sheetEndpoint = endpoint;
    }

    localStorage.setItem("VOCAB_SHEET_ENDPOINT", endpoint);

    alert("Saved Vocab Sheet Endpoint");
  };

  /* =========================================================
     LOCAL LOG QUEUE
  ========================================================= */

  Storage.saveLocalLog = function saveLocalLog(payload){
    try{
      const key = app().queueKey || "VOCAB_V71_LOG_QUEUE";
      const queue = U.readJson(key, []);

      queue.push(payload);
      U.writeJson(key, queue.slice(-900));
    }catch(e){
      console.warn("[VOCAB] local log failed", e);
    }
  };

  Storage.readLocalLog = function readLocalLog(){
    return U.readJson(app().queueKey || "VOCAB_V71_LOG_QUEUE", []);
  };

  Storage.clearLocalLog = function clearLocalLog(){
    try{
      localStorage.removeItem(app().queueKey || "VOCAB_V71_LOG_QUEUE");
    }catch(e){}
  };

  /* =========================================================
     POST TO SHEET
  ========================================================= */

  Storage.postSheet = function postSheet(payload){
    const endpoint = Storage.buildEndpoint(endpointBase());

    if(!endpoint) return;

    const body = new URLSearchParams();

    Object.entries(payload || {}).forEach(([key, value]) => {
      if(value === undefined) return;

      if(typeof value === "object" && value !== null){
        body.append(key, JSON.stringify(value));
      }else{
        body.append(key, String(value));
      }
    });

    fetch(endpoint, {
      method:"POST",
      mode:"no-cors",
      headers:{
        "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"
      },
      body
    }).catch(err => {
      console.warn("[VOCAB] sheet post failed", err);
    });
  };

  /* =========================================================
     EVENT LOG
  ========================================================= */

  Storage.logEvent = function logEvent(type, data = {}){
    const g = game();
    const student = Storage.getStudentContext();

    const modeId = g.mode || app().selectedMode || "learn";
    const mode = modeConfig(modeId);

    const payload = {
      api: app().api || "vocab",
      source: app().source || "vocab.html",
      schema: app().schema || "vocab-modular",
      action: type,
      timestamp: nowIso(),

      session_id: Storage.getSessionId(),

      display_name: student.display_name,
      student_id: student.student_id,
      section: student.section,
      session_code: student.session_code,

      bank: g.bank || app().selectedBank || "A",
      difficulty: g.difficulty || app().selectedDifficulty || "easy",
      mode: modeId,
      mode_label: mode.label,

      page_url: location.href,
      user_agent: navigator.userAgent,

      vocab_version: app().version || "modular",
      patch_version: app().version || "modular",

      ...data
    };

    if(app().enableConsoleLog){
      console.log("[VOCAB]", payload);
    }

    Storage.saveLocalLog(payload);

    if(app().enableSheetLog !== false){
      Storage.postSheet(payload);
    }

    return payload;
  };

  /* =========================================================
     LAST SUMMARY
  ========================================================= */

  Storage.saveLastSummary = function saveLastSummary(payload){
    try{
      U.writeJson("VOCAB_V70_LAST_SUMMARY", {
        savedAt: nowIso(),
        ...payload
      });
    }catch(e){
      console.warn("[VOCAB] save last summary failed", e);
    }
  };

  Storage.readLastSummary = function readLastSummary(){
    return U.readJson("VOCAB_V70_LAST_SUMMARY", null);
  };

  /* =========================================================
     TEACHER SUMMARY
  ========================================================= */

  Storage.saveTeacherSummary = function saveTeacherSummary(result, reward, coach){
    const student = Storage.getStudentContext();

    const summary = {
      saved_at: nowIso(),
      session_id: Storage.getSessionId(),

      display_name: student.display_name,
      student_id: student.student_id,
      section: student.section,
      session_code: student.session_code,

      bank: result.bank,
      difficulty: result.difficulty,
      mode: result.mode,
      mode_label: result.modeLabel,

      score: result.score,
      accuracy: result.accuracy,
      correct: result.correct,
      wrong: result.wrong,
      combo_max: result.comboMax,
      duration_sec: result.durationSec,

      boss_defeated: result.bossDefeated,

      stars: reward.stars,
      badge: reward.badge,
      coins: reward.coins,

      ai_next_mode: coach.nextMode,
      ai_reason: coach.reason,

      weakest_terms: result.weakestTerms || [],
      stage_stats: result.stageStats || {},
      power_stats: result.powerStats || {},

      ai_help_used: result.aiHelpUsed || 0,
      ai_assisted: result.aiAssisted ? 1 : 0
    };

    try{
      const key = app().teacherKey || "VOCAB_V71_TEACHER_LAST";
      const list = U.readJson(key, []);

      list.push(summary);
      U.writeJson(key, list.slice(-250));
    }catch(e){
      console.warn("[VOCAB] save teacher summary failed", e);
    }

    return summary;
  };

  Storage.readTeacherSummaries = function readTeacherSummaries(){
    return U.readJson(app().teacherKey || "VOCAB_V71_TEACHER_LAST", []);
  };

  /* =========================================================
     STUDENT PROFILE
  ========================================================= */

  Storage.recommendDifficulty = function recommendDifficulty(result){
    if(result.accuracy >= 90 && result.comboMax >= 5){
      if(result.difficulty === "easy") return "normal";
      if(result.difficulty === "normal") return "hard";
      return "challenge";
    }

    if(result.accuracy < 60){
      return "easy";
    }

    return result.difficulty || "normal";
  };

  Storage.buildMasterySnapshot = function buildMasterySnapshot(result){
    const stageStats = result.stageStats || {};
    const out = {};

    Object.entries(stageStats).forEach(([stageId, s]) => {
      const total = Number(s.correct || 0) + Number(s.wrong || 0);

      out[stageId] = {
        correct: Number(s.correct || 0),
        wrong: Number(s.wrong || 0),
        accuracy: total ? Math.round((Number(s.correct || 0) / total) * 100) : 0,
        avg_response_ms: s.count ? Math.round(Number(s.responseMsTotal || 0) / Number(s.count || 1)) : 0
      };
    });

    return out;
  };

  Storage.updateStudentProfile = function updateStudentProfile(result, reward, coach){
    const student = Storage.getStudentContext();

    const profile = {
      timestamp: nowIso(),

      student_id: student.student_id,
      display_name: student.display_name,
      section: student.section,

      last_session_id: Storage.getSessionId(),

      last_bank: result.bank,
      last_difficulty: result.difficulty,
      last_mode: result.mode,
      last_mode_label: result.modeLabel,

      last_score: result.score,
      last_accuracy: result.accuracy,
      last_combo_max: result.comboMax,

      recommended_mode: coach.nextMode,
      recommended_difficulty: Storage.recommendDifficulty(result),
      ai_reason: coach.reason,

      weak_terms_json: JSON.stringify(result.weakestTerms || []),
      mastery_json: JSON.stringify(Storage.buildMasterySnapshot(result)),

      badge: reward.badge,
      stars: reward.stars,
      coins: reward.coins,

      ai_help_used: result.aiHelpUsed || 0,
      ai_assisted: result.aiAssisted ? 1 : 0,

      leaderboard_rank: result.rank || "",
      fair_score: result.fairScore || result.score || 0,
      personal_best: result.personalBest || "",
      improvement: result.improvement || "",
      class_top_score: result.classTopScore || ""
    };

    Storage.logEvent("student_profile_update", profile);

    U.writeJson(app().profileKey || "VOCAB_V71_STUDENT_PROFILE", {
      ...student,
      last_profile: profile
    });

    return profile;
  };

  /* =========================================================
     LEADERBOARD
  ========================================================= */

  Storage.leaderboardConfig = function leaderboardConfig(){
    return window.VOCAB_LEADERBOARD || {
      key:"VOCAB_V71_LEADERBOARD",
      maxRowsPerMode:30,
      showTop:5,
      assistedScoreMultiplier:0.95
    };
  };

  Storage.readLeaderboard = function readLeaderboard(){
    const cfg = Storage.leaderboardConfig();

    return U.readJson(cfg.key, {
      learn:[],
      speed:[],
      mission:[],
      battle:[],
      bossrush:[]
    });
  };

  Storage.saveLeaderboard = function saveLeaderboard(board){
    const cfg = Storage.leaderboardConfig();
    U.writeJson(cfg.key, board);
  };

  Storage.updateLeaderboard = function updateLeaderboard(result, reward){
    const cfg = Storage.leaderboardConfig();
    const student = Storage.getStudentContext();
    const board = Storage.readLeaderboard();

    const mode = result.mode || "learn";

    if(!board[mode]){
      board[mode] = [];
    }

    const assisted = !!result.aiAssisted;
    const rawScore = Number(result.score || 0);
    const fairScore = assisted
      ? Math.round(rawScore * Number(cfg.assistedScoreMultiplier || 0.95))
      : rawScore;

    const entry = {
      id:`${student.student_id || "anon"}_${mode}_${Date.now()}`,
      session_id:Storage.getSessionId(),
      timestamp:nowIso(),

      display_name:student.display_name || "Hero",
      student_id:student.student_id || "anon",
      section:student.section || "",
      session_code:student.session_code || "",

      bank:result.bank,
      difficulty:result.difficulty,
      mode:result.mode,
      mode_label:result.modeLabel,

      score:rawScore,
      fair_score:fairScore,
      accuracy:result.accuracy,
      combo_max:result.comboMax,
      boss_defeated:result.bossDefeated ? 1 : 0,

      stars:reward.stars,
      badge:reward.badge,

      ai_assisted:assisted ? 1 : 0,
      ai_help_used:result.aiHelpUsed || 0
    };

    const existingRows = board[mode] || [];

    const previousPersonalBest = existingRows
      .filter(x => String(x.student_id) === String(entry.student_id))
      .reduce((best, x) => Math.max(best, Number(x.fair_score || x.score || 0)), 0);

    existingRows.push(entry);

    existingRows.sort((a, b) => {
      const scoreDiff = Number(b.fair_score || b.score || 0) - Number(a.fair_score || a.score || 0);
      if(scoreDiff !== 0) return scoreDiff;

      const accDiff = Number(b.accuracy || 0) - Number(a.accuracy || 0);
      if(accDiff !== 0) return accDiff;

      return Number(b.combo_max || 0) - Number(a.combo_max || 0);
    });

    board[mode] = existingRows.slice(0, Number(cfg.maxRowsPerMode || 30));
    Storage.saveLeaderboard(board);

    const rank = board[mode].findIndex(x => x.session_id === entry.session_id) + 1;
    const personalBest = Math.max(previousPersonalBest, fairScore);
    const improvement = previousPersonalBest ? fairScore - previousPersonalBest : fairScore;
    const classTopScore = board[mode][0]
      ? Number(board[mode][0].fair_score || board[mode][0].score || 0)
      : fairScore;

    Storage.logEvent("leaderboard_update", {
      mode,
      mode_label:result.modeLabel,

      rank,
      score:rawScore,
      fair_score:fairScore,
      personal_best:personalBest,
      improvement,
      class_top_score:classTopScore,

      accuracy:result.accuracy,
      combo_max:result.comboMax,
      boss_defeated:result.bossDefeated ? 1 : 0,

      stars:reward.stars,
      badge:reward.badge,

      ai_assisted:assisted ? 1 : 0,
      ai_help_used:result.aiHelpUsed || 0
    });

    if(typeof window.renderLeaderboardV68 === "function"){
      window.renderLeaderboardV68(mode);
    }

    return {
      rank,
      personalBest,
      improvement,
      classTopScore,
      fairScore
    };
  };

  Storage.renderLeaderboard = function renderLeaderboard(mode = "learn"){
    const box = document.getElementById("v68LeaderboardBox");
    if(!box) return;

    const cfg = Storage.leaderboardConfig();
    const board = Storage.readLeaderboard();
    const rows = board[mode] || [];
    const modeInfo = modeConfig(mode);

    if(!rows.length){
      box.innerHTML = `<div class="v68-lb-empty">${modeInfo.icon} ${modeInfo.label}: ยังไม่มีคะแนนในโหมดนี้</div>`;
      return;
    }

    const topRows = rows.slice(0, Number(cfg.showTop || 5));

    box.innerHTML = `
      ${topRows.map((r, index) => Storage.renderLeaderboardRow(r, index + 1)).join("")}
      ${Storage.renderPersonalBestMini(mode)}
    `;
  };

  Storage.renderLeaderboardRow = function renderLeaderboardRow(row, rank){
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;

    return `
      <div class="v68-lb-row">
        <div class="v68-rank">${medal}</div>

        <div class="v68-lb-name">
          <b>${U.escape(row.display_name || "Hero")}</b>
          <small>${U.escape(row.bank || "")} • ${U.escape(row.difficulty || "")}</small>
        </div>

        <div class="v68-lb-score">${Number(row.fair_score || row.score || 0)}</div>

        <div class="v68-hide-mobile">
          <span class="v68-lb-chip">${Number(row.accuracy || 0)}%</span>
        </div>

        <div class="v68-hide-mobile">
          ${
            Number(row.ai_assisted || 0)
              ? `<span class="v68-lb-chip assisted">🤖 Assisted</span>`
              : `<span class="v68-lb-chip">🏅 No Help</span>`
          }
        </div>
      </div>
    `;
  };

  Storage.renderPersonalBestMini = function renderPersonalBestMini(mode){
    const student = Storage.getStudentContext();
    const board = Storage.readLeaderboard();
    const rows = board[mode] || [];

    const personalRows = rows.filter(r => {
      return String(r.student_id || "") === String(student.student_id || "anon");
    });

    if(!personalRows.length){
      return `<div class="v68-personal-best">Personal Best: ยังไม่มีคะแนนของคุณในโหมดนี้</div>`;
    }

    const best = personalRows.reduce((a, b) => {
      return Number(a.fair_score || a.score || 0) >= Number(b.fair_score || b.score || 0) ? a : b;
    });

    const rank = rows.findIndex(r => r.session_id === best.session_id) + 1;

    return `
      <div class="v68-personal-best">
        ⭐ Personal Best: <b>${Number(best.fair_score || best.score || 0)}</b>
        • Rank #${rank || "-"}
        • Accuracy ${Number(best.accuracy || 0)}%
        ${Number(best.ai_assisted || 0) ? `• 🤖 AI Assisted` : `• 🏅 No AI Help`}
      </div>
    `;
  };

  Storage.renderLeaderboardResult = function renderLeaderboardResult(result){
    const rank = result.rank || "-";
    const personalBest = Number(result.personalBest || result.score || 0);
    const classTop = Number(result.classTopScore || result.score || 0);
    const improvement = Number(result.improvement || 0);

    const improvementText = improvement > 0
      ? `+${improvement}`
      : improvement < 0
        ? `${Math.abs(improvement)} to PB`
        : "0";

    return `
      <div class="v63-teacher-panel">
        <h3>🏆 Leaderboard Result</h3>

        <div class="v63-teacher-grid">
          <div class="v63-teacher-stat">
            <b>#${rank}</b>
            <span>Your Rank</span>
          </div>

          <div class="v63-teacher-stat">
            <b>${personalBest}</b>
            <span>Personal Best</span>
          </div>

          <div class="v63-teacher-stat">
            <b>${classTop}</b>
            <span>Class Top</span>
          </div>

          <div class="v63-teacher-stat">
            <b>${improvementText}</b>
            <span>Progress</span>
          </div>
        </div>

        <p style="color:var(--muted); font-weight:850; line-height:1.5;">
          Leaderboard นี้แยกตามโหมด:
          <b>${U.escape(result.modeLabel || result.mode || "")}</b>
          ${result.aiAssisted ? " • ใช้ AI Help แล้ว จึงใช้ fair score สำหรับอันดับ" : " • ไม่ใช้ AI Help ในรอบนี้"}
        </p>
      </div>
    `;
  };

  Storage.initLeaderboardStudentListeners = function initLeaderboardStudentListeners(){
    ["v63DisplayName", "v63StudentId", "v63Section", "v63SessionCode"].forEach(id => {
      const el = document.getElementById(id);
      if(!el || el.__vocabLeaderboardListener) return;

      el.__vocabLeaderboardListener = true;

      el.addEventListener("input", () => {
        Storage.saveStudentContext();

        const mode = app().selectedMode || "learn";
        Storage.renderLeaderboard(mode);
      });
    });
  };

  /* =========================================================
     EXPORT LEGACY GLOBALS
  ========================================================= */

  window.VocabStorage = Storage;

  window.getV63Param = Storage.getParam;
  window.getValueV63 = Storage.getValue;
  window.setInputV63 = Storage.setInput;

  window.getStudentContextV63 = Storage.getStudentContext;
  window.saveStudentContextV63 = Storage.saveStudentContext;
  window.hydrateStudentFormV63 = Storage.hydrateStudentForm;

  window.getVocabSessionIdV6 = Storage.getSessionId;

  window.buildVocabEndpointV70 = Storage.buildEndpoint;
  window.setVocabSheetEndpointV63 = Storage.setSheetEndpoint;

  window.logVocabEventV6 = Storage.logEvent;
  window.saveLocalLogV63 = Storage.saveLocalLog;
  window.postVocabSheetV63 = Storage.postSheet;

  window.saveLastVocabSummaryV6 = Storage.saveLastSummary;
  window.saveTeacherSummaryV63 = Storage.saveTeacherSummary;
  window.updateStudentProfileV63 = Storage.updateStudentProfile;

  window.recommendDifficultyV63 = Storage.recommendDifficulty;
  window.buildMasterySnapshotV63 = Storage.buildMasterySnapshot;

  window.readLeaderboardV68 = Storage.readLeaderboard;
  window.saveLeaderboardV68 = Storage.saveLeaderboard;
  window.updateLeaderboardV68 = Storage.updateLeaderboard;
  window.renderLeaderboardV68 = Storage.renderLeaderboard;
  window.renderLeaderboardRowV68 = Storage.renderLeaderboardRow;
  window.renderPersonalBestMiniV68 = Storage.renderPersonalBestMini;
  window.renderLeaderboardResultV68 = Storage.renderLeaderboardResult;
  window.initLeaderboardStudentListenersV68 = Storage.initLeaderboardStudentListeners;

  document.addEventListener("DOMContentLoaded", function(){
    Storage.hydrateStudentForm();
    Storage.initLeaderboardStudentListeners();
    Storage.renderLeaderboard("learn");

    console.log("[VOCAB] storage/logging/leaderboard loaded");
  });

})();
