/* =========================================================
   EAP Word Quest • Teacher Core Truth + Detail Layout
   File: /herohealth/eap-word-quest/eap-word-teacher-v241-core-truth-layout.js
   Version: v2.4.1-TEACHER-CORE-TRUTH-122

   Fixes three teacher-report problems:
   1) The local dashboard previously counted only saved historical log rows,
      so a learner who had passed all 20 Core missions could appear as 14/20.
   2) Historical Weak Words could downgrade a complete 90% learner to
      "Needs Review" even though the pass ledger says the learner is complete.
   3) Five Arc cards were squeezed into the narrow Individual Report column.

   This patch is display/report-only. It never changes student pass state,
   question pools, scores, gates, or stored logs.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.4.1-TEACHER-CORE-TRUTH-122";
  const GROUP = "122";
  const FLOW = [
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];
  const TITLES = {
    S1:"Mission Passport", S2:"UK Campus Decoder", S3:"The Broken Brief", BG1:"Global Learner Clearance",
    S4:"Signal Relay", S5:"Evidence Court", S6:"Summary Press Room", BG2:"Evidence Court Live",
    S7:"Tone Switchboard", S8:"Paragraph Repair Lab", S9:"Campus Solution Pitch", BG3:"Academic Makeover Studio",
    S10:"Data Detective", S11:"International Help Desk", S12:"Integrity Escape Room", BG4:"International Help Desk Crisis",
    S13:"Mini Lecture Heist", S14:"Presentation Under Pressure", S15:"Global Solution Summit", BG5:"Human Override Summit"
  };

  if (window.__EAP_WORD_TEACHER_V241_CORE_TRUTH__) return;
  window.__EAP_WORD_TEACHER_V241_CORE_TRUTH__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const bool = (value) => value === true || String(value).toLowerCase() === "true";

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function safeStudentId(value) {
    return norm(value || "no-id").replace(/[^a-z0-9_-]/gi, "_") || "no-id";
  }

  function currentProfile() {
    const profile = readJson("EAP_WORD_QUEST_PROFILE_V01", {}) || {};
    return {
      studentId: norm(profile.studentId || profile.id || "anon"),
      studentName: norm(profile.studentName || profile.name || "Anonymous")
    };
  }

  function defaultTotal(sessionId) {
    if (sessionId === "BG5") return 24;
    if (/^BG/.test(sessionId)) return 18;
    return 12;
  }

  function threshold(sessionId) {
    if (sessionId === "BG5") return 75;
    if (/^BG/.test(sessionId)) return 70;
    return 60;
  }

  function stateKeys() {
    const profile = currentProfile();
    const keys = [];
    const primary = `EAP_WORD_QUEST_CORE_V196_STATE_${GROUP}_${safeStudentId(profile.studentId)}`;
    keys.push(primary);

    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (/^EAP_WORD_QUEST_CORE_V196_STATE_122_/i.test(key || "") && !keys.includes(key)) keys.push(key);
      }
    } catch (err) {}

    return keys;
  }

  function stateSnapshotRecords() {
    const profile = currentProfile();
    const best = new Map();

    stateKeys().forEach((key) => {
      const state = readJson(key, null);
      if (!state || typeof state !== "object" || !state.sessions || typeof state.sessions !== "object") return;

      FLOW.forEach((sessionId) => {
        const row = state.sessions[sessionId];
        if (!row || !row.played) return;

        const last = row.lastResult && typeof row.lastResult === "object" ? row.lastResult : {};
        const studentId = norm(last.studentId || profile.studentId || key.split("_").pop() || "anon");
        const studentName = norm(last.studentName || profile.studentName || "Anonymous");
        const total = Math.max(1, Math.round(num(last.total, defaultTotal(sessionId))));
        const accuracy = Math.max(0, Math.min(100, Math.round(num(row.bestAccuracy, num(row.accuracy, num(last.accuracy, 0))))));
        const passed = Boolean(row.passed) || bool(last.passed) || accuracy >= threshold(sessionId);
        const score = Math.max(0, Math.round(num(row.bestScore, num(last.score, last.xp))));
        const playedAt = norm(row.lastPlayed || last.playedAt || last.endedAt || new Date().toISOString());
        const record = {
          logVersion: VERSION,
          source: "core-state-snapshot-v241",
          group: GROUP,
          section: GROUP,
          studentId,
          studentName,
          studentKey: `${GROUP}|${studentId}|${studentName}`,
          arcId: norm(last.arcId),
          arc: norm(last.arc),
          sessionId,
          sessionTitle: norm(last.sessionTitle || TITLES[sessionId] || sessionId),
          sessionType: norm(last.sessionType || (sessionId === "BG5" ? "finalBoss" : /^BG/.test(sessionId) ? "boss" : "session")),
          correct: Math.max(0, Math.min(total, Math.round((accuracy / 100) * total))),
          total,
          accuracy,
          xp: score,
          score,
          maxCombo: Math.max(0, Math.round(num(row.maxCombo, last.maxCombo))),
          passed,
          passThreshold: threshold(sessionId),
          passStatus: norm(last.passStatus),
          cefrLevel: norm(last.cefrLevel),
          aiDifficulty: norm(last.aiDifficulty),
          aiPrediction: norm(last.aiPrediction),
          hintUsed: Math.max(0, Math.round(num(last.hintUsed))),
          weakWords: Array.isArray(last.weakWords) ? last.weakWords : [],
          itemTypeWeak: Array.isArray(last.itemTypeWeak) ? last.itemTypeWeak : [],
          levelWeak: Array.isArray(last.levelWeak) ? last.levelWeak : [],
          responseTimeAvg: Math.max(0, num(last.responseTimeAvg)),
          attempt: Math.max(1, Math.round(num(row.totalAttempts, last.attempt || 1))),
          bossHp: passed && /^BG/.test(sessionId) ? 0 : Math.max(0, Math.round(num(last.bossHp))),
          bossMaxHp: Math.max(0, Math.round(num(last.bossMaxHp, /^BG/.test(sessionId) ? total : 0))),
          isBoss: /^BG/.test(sessionId),
          playedAt
        };

        const identity = `${studentId}|${sessionId}`;
        const old = best.get(identity);
        if (!old || (record.passed && !old.passed) || record.accuracy > old.accuracy || (record.accuracy === old.accuracy && new Date(record.playedAt) > new Date(old.playedAt))) {
          best.set(identity, record);
        }
      });
    });

    return Array.from(best.values());
  }

  function mergeLogsWithCoreTruth(logs) {
    const merged = Array.isArray(logs) ? logs.slice() : [];
    const bestLog = new Map();

    merged.forEach((record) => {
      const key = `${norm(record.studentId)}|${norm(record.sessionId).toUpperCase()}`;
      const old = bestLog.get(key);
      if (!old || (record.passed && !old.passed) || num(record.accuracy) > num(old.accuracy)) bestLog.set(key, record);
    });

    let injected = 0;
    stateSnapshotRecords().forEach((snapshot) => {
      const key = `${snapshot.studentId}|${snapshot.sessionId}`;
      const old = bestLog.get(key);
      const needed = !old || (snapshot.passed && !old.passed) || num(snapshot.accuracy) > num(old.accuracy);
      if (needed) {
        merged.push(snapshot);
        bestLog.set(key, snapshot);
        injected += 1;
      }
    });

    window.EAP_WORD_TEACHER_V241_STATE = {
      version: VERSION,
      injectedCoreSnapshots: injected,
      localCoreSnapshots: stateSnapshotRecords().length,
      updatedAt: new Date().toISOString()
    };
    return merged;
  }

  function bestRouteXp(records) {
    const bestBySession = {};
    (records || []).forEach((record) => {
      const id = norm(record.sessionId).toUpperCase();
      if (!FLOW.includes(id)) return;
      const old = bestBySession[id];
      if (!old || (record.passed && !old.passed) || num(record.accuracy) > num(old.accuracy) || (num(record.accuracy) === num(old.accuracy) && num(record.xp, record.score) > num(old.xp, old.score))) {
        bestBySession[id] = record;
      }
    });
    return Object.values(bestBySession).reduce((sum, record) => sum + Math.max(0, Math.round(num(record.xp, record.score))), 0);
  }

  function normalizeStatus(student) {
    const completed = num(student.passedSessions) >= FLOW.length;
    const accuracy = num(student.averageAccuracy);

    if (completed) return accuracy >= 90 ? "Mastery" : accuracy >= 75 ? "Strong" : "Ready";
    if (accuracy < 60) return "At Risk";
    if (accuracy >= 90) return "Strong";
    if (accuracy >= 75) return "Strong";
    if ((student.weakWords || []).length >= 5) return "Needs Review";
    return "Ready";
  }

  function improveReport(report) {
    if (!report || !Array.isArray(report.students)) return report;

    report.students.forEach((student) => {
      student.status = normalizeStatus(student);
      student.bestRouteXp = bestRouteXp(student.records);
      student.totalXp = student.bestRouteXp;
      student.isComplete = num(student.passedSessions) >= FLOW.length;
      const passed = new Set((student.records || []).filter((record) => record && record.passed).map((record) => norm(record.sessionId).toUpperCase()));
      student.missingSessions = FLOW.filter((id) => !passed.has(id));
      student.nextMission = student.missingSessions[0] || "DONE";
      student.pathGap = FLOW.find((id, index) => !passed.has(id) && FLOW.slice(index + 1).some((later) => passed.has(later))) || "";
    });

    if (report.overview) {
      report.overview.studentsPlayed = report.students.length;
      report.overview.vocabularyReady = report.students.filter((s) => ["Ready","Strong","Mastery"].includes(s.status)).length;
      report.overview.atRisk = report.students.filter((s) => s.status === "At Risk").length;
      report.overview.needsReview = report.students.filter((s) => s.status === "Needs Review").length;
      report.overview.completeStudents = report.students.filter((s) => s.isComplete).length;
    }

    return report;
  }

  function installLayout() {
    if (document.getElementById("eapTeacherV241Style")) return;
    const style = document.createElement("style");
    style.id = "eapTeacherV241Style";
    style.textContent = `
      #studentDetail .arc-grid{grid-template-columns:1fr!important;gap:8px!important}
      #studentDetail .arc-card{min-height:auto!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;column-gap:10px!important;align-items:center!important;overflow:hidden!important}
      #studentDetail .arc-card h4{font-size:14px!important;line-height:1.3!important;margin:0!important;overflow-wrap:anywhere!important}
      #studentDetail .arc-card .mini-progress{grid-column:1 / -1!important;margin:8px 0 4px!important}
      #studentDetail .arc-card small{grid-column:1 / -1!important;color:#64748b!important;font-weight:800!important;line-height:1.45!important}
      #studentDetail .weak-list{margin-top:8px!important}
      #studentDetail .detail-card{overflow:hidden!important}
    `;
    document.head.appendChild(style);
  }

  function wrapReportCore() {
    const original = window.buildEapTeacherReport;
    if (typeof original !== "function" || original.__eapV241CoreTruth) return;

    const wrapped = function(inputLogs) {
      const hasExplicitInput = Array.isArray(inputLogs);
      const source = hasExplicitInput
        ? inputLogs
        : (typeof window.readEapWordQuestLogs === "function" ? window.readEapWordQuestLogs() : []);
      const merged = hasExplicitInput ? source : mergeLogsWithCoreTruth(source);
      const report = original.call(this, merged);
      return improveReport(report);
    };

    wrapped.__eapV241CoreTruth = true;
    wrapped.__eapV241Original = original;
    window.buildEapTeacherReport = wrapped;
  }

  installLayout();
  wrapReportCore();

  window.inspectEapTeacherV241 = () => Object.assign({ version:VERSION }, window.EAP_WORD_TEACHER_V241_STATE || {});
  console.info("[EAP Word Quest] teacher core truth + layout ready", window.inspectEapTeacherV241());
})();
