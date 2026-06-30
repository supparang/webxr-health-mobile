/* =========================================================
   EAP Word Quest • Strict Local Identity Separation
   File: /herohealth/eap-word-quest/eap-word-teacher-v248-strict-identity-separation.js
   Version: v2.4.8-STRICT-IDENTITY-SEPARATION-122

   Rule:
   Student IDs are never merged. A local dashboard can show only records
   whose own stored studentId matches the currently saved Student Profile.

   This prevents a previous learner's Core ledger on the same browser from
   being displayed under a later test profile.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.4.8-STRICT-IDENTITY-SEPARATION-122";
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

  if (window.__EAP_WORD_TEACHER_V248_STRICT_IDENTITY_SEPARATION__) return;
  window.__EAP_WORD_TEACHER_V248_STRICT_IDENTITY_SEPARATION__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function safeId(value) {
    return norm(value || "anon").replace(/[^a-z0-9_-]/gi, "_") || "anon";
  }

  function currentProfile() {
    const saved = readJson("EAP_WORD_QUEST_PROFILE_V01", {}) || {};
    return {
      studentId: norm(saved.studentId || saved.id || "anon"),
      studentName: norm(saved.studentName || saved.name || "Anonymous")
    };
  }

  function defaultTotal(sessionId) {
    if (sessionId === "BG5") return 24;
    return /^BG/.test(sessionId) ? 18 : 12;
  }

  function threshold(sessionId) {
    if (sessionId === "BG5") return 75;
    return /^BG/.test(sessionId) ? 70 : 60;
  }

  function currentProfileLogs() {
    const profile = currentProfile();
    const raw = typeof window.readEapWordQuestLogs === "function"
      ? window.readEapWordQuestLogs()
      : [];

    return (Array.isArray(raw) ? raw : [])
      .filter((record) => norm(record && record.studentId) === profile.studentId)
      .map((record) => Object.assign({}, record, {
        group: GROUP,
        section: GROUP,
        studentId: profile.studentId,
        studentName: profile.studentName,
        studentKey: `${GROUP}|${profile.studentId}`
      }));
  }

  function verifiedCurrentStateRecords() {
    const profile = currentProfile();
    const key = `EAP_WORD_QUEST_CORE_V196_STATE_${GROUP}_${safeId(profile.studentId)}`;
    const state = readJson(key, {}) || {};
    const sessions = state && typeof state.sessions === "object" ? state.sessions : {};
    const records = [];

    FLOW.forEach((sessionId) => {
      const row = sessions[sessionId];
      if (!row || (!row.played && !row.passed)) return;

      // A state slot is accepted only when its own last result belongs to
      // this profile. Never infer ownership from a key or from the current
      // profile name, because profiles can change during local testing.
      const last = row.lastResult && typeof row.lastResult === "object" ? row.lastResult : null;
      if (!last || norm(last.studentId) !== profile.studentId) return;

      const total = Math.max(1, Math.round(num(last.total, defaultTotal(sessionId))));
      const accuracy = Math.max(0, Math.min(100, Math.round(num(row.bestAccuracy, num(last.accuracy, 0)))));
      const passed = Boolean(row.passed) || Boolean(last.passed) || accuracy >= threshold(sessionId);
      const score = Math.max(0, Math.round(num(row.bestScore, num(last.score, last.xp))));

      records.push({
        logVersion: VERSION,
        source: "verified-current-profile-state-v248",
        group: GROUP,
        section: GROUP,
        studentId: profile.studentId,
        studentName: profile.studentName,
        studentKey: `${GROUP}|${profile.studentId}`,
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
        playedAt: norm(row.lastPlayed || last.playedAt || last.endedAt || new Date().toISOString())
      });
    });

    return records;
  }

  function preferBest(records) {
    const best = new Map();
    (records || []).forEach((record) => {
      const key = `${norm(record.studentId)}|${norm(record.sessionId).toUpperCase()}`;
      const old = best.get(key);
      const newer = new Date(record.playedAt || 0).getTime() >= new Date(old && old.playedAt || 0).getTime();
      if (!old ||
          (Boolean(record.passed) && !Boolean(old.passed)) ||
          num(record.accuracy) > num(old.accuracy) ||
          (num(record.accuracy) === num(old.accuracy) && newer)) {
        best.set(key, record);
      }
    });
    return Array.from(best.values());
  }

  function reportCoreBase() {
    const top = window.buildEapTeacherReport;
    const fromV246 = top && top.__eapV246Original;
    const fromV241 = fromV246 && fromV246.__eapV241Original;
    return typeof fromV241 === "function" ? fromV241 : null;
  }

  function improveLocalReport(report) {
    if (!report || !Array.isArray(report.students)) return report;
    report.students.forEach((student) => {
      const completed = num(student.passedSessions) >= FLOW.length;
      const accuracy = num(student.averageAccuracy);
      student.isComplete = completed;
      student.status = completed
        ? (accuracy >= 90 ? "Mastery" : accuracy >= 75 ? "Strong" : "Ready")
        : accuracy < 60 ? "At Risk"
        : accuracy >= 75 ? "Strong"
        : (student.weakWords || []).length >= 5 ? "Needs Review"
        : "Ready";
    });
    if (report.overview) {
      report.overview.studentsPlayed = report.students.length;
      report.overview.vocabularyReady = report.students.filter((student) => ["Ready", "Strong", "Mastery"].includes(student.status)).length;
      report.overview.atRisk = report.students.filter((student) => student.status === "At Risk").length;
      report.overview.needsReview = report.students.filter((student) => student.status === "Needs Review").length;
      report.overview.completeStudents = report.students.filter((student) => student.isComplete).length;
      report.overview.totalAttempts = (report.logs || []).length;
    }
    return report;
  }

  function install() {
    const original = window.buildEapTeacherReport;
    const base = reportCoreBase();
    if (typeof original !== "function" || typeof base !== "function" || original.__eapV248StrictIdentitySeparation) return false;

    const wrapped = function(inputLogs) {
      // Cloud mode supplies explicit logs; do not rewrite or merge them.
      if (Array.isArray(inputLogs)) return original.call(this, inputLogs);

      const local = preferBest([
        ...currentProfileLogs(),
        ...verifiedCurrentStateRecords()
      ]);
      return improveLocalReport(base.call(this, local));
    };

    wrapped.__eapV248StrictIdentitySeparation = true;
    wrapped.__eapV248Original = original;
    window.buildEapTeacherReport = wrapped;
    return true;
  }

  function wait(tries) {
    if (install()) return;
    if (tries >= 200) return;
    setTimeout(() => wait(tries + 1), 30);
  }

  wait(0);
  window.inspectEapTeacherV248 = () => ({
    version: VERSION,
    profile: currentProfile(),
    localLogs: currentProfileLogs().length,
    verifiedStateSessions: verifiedCurrentStateRecords().length,
    installed: Boolean(window.buildEapTeacherReport && window.buildEapTeacherReport.__eapV248StrictIdentitySeparation)
  });
})();
