/* =========================================================
   EAP Word Quest • Logger Core
   File: /herohealth/eap-word-quest/eap-word-logger.js
   Version: v1.8.2-STUDENT-LEARNING-LOGGER

   Role:
   - Standard learning log for Student -> Teacher
   - Group 122
   - Works with v172 Summary Overlay
   - LocalStorage first, ready for CSV / Teacher Dashboard
========================================================= */

"use strict";

(function(){
  const VERSION = "v1.8.2-STUDENT-LEARNING-LOGGER";

  if(window.__EAP_WORD_QUEST_LOGGER_CORE__){
    console.info("[EAP Word Quest] logger already loaded");
    return;
  }

  window.__EAP_WORD_QUEST_LOGGER_CORE__ = true;

  const GROUP = "122";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const LOG_KEY = "EAP_WORD_QUEST_LEARNING_LOGS_V182";
  const STATS_KEYS = [
    "EAP_WORD_QUEST_STATS_V160",
    "EAP_WORD_QUEST_STATS_V161",
    "EAP_WORD_QUEST_STATS_V01"
  ];

  const SESSION_META = {
    S1:{ arcId:"ARC1", arc:"Arc 1", title:"Academic Profile", type:"session" },
    S2:{ arcId:"ARC1", arc:"Arc 1", title:"Project Introduction", type:"session" },
    S3:{ arcId:"ARC1", arc:"Arc 1", title:"Project Rationale & Target Users", type:"session" },
    BG1:{ arcId:"ARC1", arc:"Arc 1", title:"Vocabulary Boss 1", type:"boss" },

    S4:{ arcId:"ARC2", arc:"Arc 2", title:"Tech Careers & Academic Roles", type:"session" },
    S5:{ arcId:"ARC2", arc:"Arc 2", title:"Team Communication", type:"session" },
    S6:{ arcId:"ARC2", arc:"Arc 2", title:"Progress Report & Responsibility", type:"session" },
    BG2:{ arcId:"ARC2", arc:"Arc 2", title:"Vocabulary Boss 2", type:"boss" },

    S7:{ arcId:"ARC3", arc:"Arc 3", title:"Academic Email", type:"session" },
    S8:{ arcId:"ARC3", arc:"Arc 3", title:"Discussion & Meeting Language", type:"session" },
    S9:{ arcId:"ARC3", arc:"Arc 3", title:"Summary & Action Items", type:"session" },
    BG3:{ arcId:"ARC3", arc:"Arc 3", title:"Vocabulary Boss 3", type:"boss" },

    S10:{ arcId:"ARC4", arc:"Arc 4", title:"System Explanation", type:"session" },
    S11:{ arcId:"ARC4", arc:"Arc 4", title:"Problem Report & Solution", type:"session" },
    S12:{ arcId:"ARC4", arc:"Arc 4", title:"User Guide & Instruction", type:"session" },
    BG4:{ arcId:"ARC4", arc:"Arc 4", title:"Vocabulary Boss 4", type:"boss" },

    S13:{ arcId:"ARC5", arc:"Arc 5", title:"AI Report & Academic Summary", type:"session" },
    S14:{ arcId:"ARC5", arc:"Arc 5", title:"Portfolio, CV & Pitch", type:"session" },
    S15:{ arcId:"ARC5", arc:"Arc 5", title:"Final Presentation & Reflection", type:"session" },
    BG5:{ arcId:"ARC5", arc:"Arc 5", title:"Final Vocabulary Boss", type:"finalBoss" }
  };

  function norm(v){
    return String(v == null ? "" : v).replace(/\s+/g," ").trim();
  }

  function number(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function readJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      return JSON.parse(raw);
    }catch(err){
      return fallback;
    }
  }

  function saveJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(err){
      console.warn("[EAP Word Quest] logger storage skipped:",err);
      window.EAP_WORD_QUEST_LOG_MEMORY = value;
      return false;
    }
  }

  function readProfile(){
    const p = readJson(PROFILE_KEY,{}) || {};

    const profile = {
      studentName:norm(p.studentName || p.name || ""),
      studentId:norm(p.studentId || p.id || ""),
      group:GROUP,
      section:GROUP,
      course:"English for Academic Purposes",
      year:"Year 2"
    };

    if(!profile.studentName) profile.studentName = "Anonymous";
    if(!profile.studentId) profile.studentId = "anon";

    return profile;
  }

  function statusFromAccuracy(acc){
    if(acc >= 90) return "Vocabulary Mastery";
    if(acc >= 75) return "Vocabulary Strong";
    if(acc >= 60) return "Vocabulary Ready";
    return "Keep Practicing";
  }

  function predictionFromAccuracy(acc){
    if(acc >= 75) return "Ready for Main Mission";
    if(acc >= 60) return "Ready, but review recommended";
    return "At Risk — replay with AI Help";
  }

  function difficultyFromAccuracy(acc){
    if(acc >= 90) return "B1+";
    if(acc >= 75) return "B1";
    if(acc >= 60) return "A2+";
    return "A2";
  }

  function passThreshold(sessionId){
    if(sessionId === "BG5") return 75;
    if(/^BG[1-4]$/.test(sessionId)) return 70;
    return 60;
  }

  function toArray(v){
    if(Array.isArray(v)) return v.map(norm).filter(Boolean);

    if(typeof v === "string"){
      return v
        .split(/[,|;]/)
        .map(norm)
        .filter(Boolean);
    }

    return [];
  }

  function makeFingerprint(r){
    return [
      r.group,
      r.studentId,
      r.studentName,
      r.sessionId,
      r.correct,
      r.total,
      r.accuracy,
      r.playedAt ? String(r.playedAt).slice(0,19) : ""
    ].join("|");
  }

  function normalizeRecord(input){
    const profile = Object.assign(readProfile(), input.profile || {});
    const sessionId = norm(input.sessionId || input.session || input.id || "S1");
    const meta = SESSION_META[sessionId] || {
      arcId:"UNKNOWN",
      arc:"Unknown Arc",
      title:input.sessionTitle || input.name || sessionId,
      type:/^BG/.test(sessionId) ? "boss" : "session"
    };

    const correct = number(input.correct,0);
    const total = Math.max(1, number(input.total || input.questions, correct || 1));
    const accuracy = number(
      input.accuracy,
      Math.round((correct / total) * 100)
    );

    const passed = typeof input.passed === "boolean"
      ? input.passed
      : accuracy >= passThreshold(sessionId);

    const weakWords = toArray(input.weakWords || input.weak || input.weakWord);

    const record = {
      logVersion:VERSION,
      source:input.source || "student-game",

      course:"EAP",
      game:"EAP Word Quest",
      role:"Vocabulary Side Quest",
      mainGame:"EAP Hero Save the Society",

      group:GROUP,
      section:GROUP,
      studentName:norm(profile.studentName || input.studentName || "Anonymous"),
      studentId:norm(profile.studentId || input.studentId || "anon"),

      arcId:meta.arcId,
      arc:meta.arc,
      sessionId,
      sessionTitle:norm(input.sessionTitle || input.name || meta.title),
      sessionType:meta.type,

      correct,
      total,
      accuracy,
      xp:number(input.xp,0),
      maxCombo:number(input.maxCombo || input.combo,0),

      passed,
      passThreshold:passThreshold(sessionId),
      passStatus:input.passStatus || statusFromAccuracy(accuracy),

      cefrLevel:input.cefrLevel || input.level || difficultyFromAccuracy(accuracy),
      aiDifficulty:input.aiDifficulty || difficultyFromAccuracy(accuracy),
      aiPrediction:input.aiPrediction || predictionFromAccuracy(accuracy),
      hintUsed:number(input.hintUsed || input.hintsUsed,0),

      weakWords,
      itemTypeWeak:toArray(input.itemTypeWeak),
      levelWeak:toArray(input.levelWeak),

      responseTimeAvg:number(input.responseTimeAvg,0),
      attempt:number(input.attempt,1),

      bossHp:number(input.bossHp,0),
      bossMaxHp:number(input.bossMaxHp,0),
      isBoss:Boolean(input.isBoss || /^BG/.test(sessionId)),

      playedAt:input.playedAt || input.at || input.updatedAt || new Date().toISOString()
    };

    record.studentKey = `${record.group}|${record.studentId}|${record.studentName}`;
    record.fingerprint = makeFingerprint(record);

    return record;
  }

  function readOwnLogs(){
    const logs = readJson(LOG_KEY,[]);
    return Array.isArray(logs) ? logs : [];
  }

  function writeOwnLogs(logs){
    const cleaned = Array.isArray(logs) ? logs.slice(-500) : [];
    saveJson(LOG_KEY, cleaned);
    return cleaned;
  }

  function appendLog(input){
    const record = normalizeRecord(input);
    const logs = readOwnLogs();

    if(!logs.some(r => r.fingerprint === record.fingerprint)){
      logs.push(record);
      writeOwnLogs(logs);
    }

    window.EAP_LAST_LEARNING_LOG = record;

    console.info("[EAP Word Quest] learning log saved:",record);
    return record;
  }

  function readStatsHistories(){
    const out = [];

    STATS_KEYS.forEach(key => {
      const stats = readJson(key,null);
      if(!stats || !Array.isArray(stats.history)) return;

      stats.history.forEach(h => {
        out.push(normalizeRecord(Object.assign({},h,{
          source:"stats-history",
          playedAt:h.at || h.playedAt || h.updatedAt
        })));
      });
    });

    return out;
  }

  function readAllLogs(){
    const merged = [
      ...readStatsHistories(),
      ...readOwnLogs()
    ];

    const map = new Map();

    merged.forEach(r => {
      const record = normalizeRecord(r);
      map.set(record.fingerprint, record);
    });

    return Array.from(map.values())
      .sort((a,b) => new Date(a.playedAt) - new Date(b.playedAt));
  }

  function importStatsToLogs(){
    const statsLogs = readStatsHistories();
    const own = readOwnLogs();
    const map = new Map();

    [...own, ...statsLogs].forEach(r => {
      const record = normalizeRecord(r);
      map.set(record.fingerprint, record);
    });

    const logs = Array.from(map.values())
      .sort((a,b) => new Date(a.playedAt) - new Date(b.playedAt));

    writeOwnLogs(logs);

    console.info("[EAP Word Quest] imported stats history to learning logs:",{
      count:logs.length
    });

    return logs;
  }

  function csvEscape(v){
    const s = String(v == null ? "" : v);
    return `"${s.replace(/"/g,'""')}"`;
  }

  function logsToCsv(logs){
    const fields = [
      "playedAt",
      "group",
      "studentName",
      "studentId",
      "arcId",
      "arc",
      "sessionId",
      "sessionTitle",
      "sessionType",
      "correct",
      "total",
      "accuracy",
      "xp",
      "maxCombo",
      "passed",
      "passStatus",
      "cefrLevel",
      "aiDifficulty",
      "aiPrediction",
      "hintUsed",
      "weakWords",
      "itemTypeWeak",
      "levelWeak",
      "responseTimeAvg",
      "attempt",
      "bossHp",
      "bossMaxHp",
      "source"
    ];

    const rows = logs.map(r => fields.map(f => {
      const value = Array.isArray(r[f]) ? r[f].join("|") : r[f];
      return csvEscape(value);
    }).join(","));

    return [
      fields.join(","),
      ...rows
    ].join("\n");
  }

  function downloadCsv(filename, csv){
    const blob = new Blob(["\uFEFF" + csv],{
      type:"text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    },300);
  }

  function downloadLogsCsv(){
    const logs = readAllLogs();
    const csv = logsToCsv(logs);
    const date = new Date().toISOString().slice(0,10);

    downloadCsv(`eap-word-quest-group122-learning-logs-${date}.csv`,csv);

    return {
      count:logs.length,
      filename:`eap-word-quest-group122-learning-logs-${date}.csv`
    };
  }

  function logV172SummaryNow(){
    const state = window.EAP_V172_SUMMARY_STATE;
    if(!state || !state.result){
      console.warn("[EAP Word Quest] no v172 summary state found");
      return null;
    }

    const r = state.result;

    return appendLog({
      source:"v172-summary-overlay",
      sessionId:r.id,
      sessionTitle:r.title,
      correct:r.correct,
      total:r.total,
      accuracy:r.accuracy,
      xp:r.xp,
      maxCombo:r.maxCombo,
      passed:r.passed,
      isBoss:r.isBoss,
      bossHp:r.boss && r.boss.hp,
      bossMaxHp:r.boss && r.boss.max,
      playedAt:state.renderedAt || new Date().toISOString()
    });
  }

  /*
    Auto capture from v172 summary overlay.
    เบา ๆ: ตรวจทุก 1 วิ เฉพาะ renderedAt ใหม่
  */
  let lastV172RenderedAt = "";

  setInterval(() => {
    const state = window.EAP_V172_SUMMARY_STATE;
    if(!state || !state.renderedAt || !state.result) return;
    if(state.renderedAt === lastV172RenderedAt) return;

    lastV172RenderedAt = state.renderedAt;
    logV172SummaryNow();
  },1000);

  window.EAP_WORD_LOGGER_VERSION = VERSION;
  window.EAP_SESSION_META = SESSION_META;

  window.logEapWordQuestResult = appendLog;
  window.readEapWordQuestLogs = readAllLogs;
  window.readEapWordQuestOwnLogs = readOwnLogs;
  window.importEapStatsHistoryToLogs = importStatsToLogs;
  window.downloadEapWordQuestLogsCsv = downloadLogsCsv;
  window.eapWordQuestLogsToCsv = logsToCsv;
  window.logEapV172SummaryNow = logV172SummaryNow;

  console.info("[EAP Word Quest] logger core ready:",{
    version:VERSION,
    group:GROUP,
    helpers:[
      "logEapWordQuestResult(record)",
      "readEapWordQuestLogs()",
      "importEapStatsHistoryToLogs()",
      "downloadEapWordQuestLogsCsv()",
      "logEapV172SummaryNow()"
    ]
  });
})();
