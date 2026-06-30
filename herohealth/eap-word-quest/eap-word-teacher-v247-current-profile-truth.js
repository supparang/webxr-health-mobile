/* =========================================================
   EAP Word Quest • Teacher Current-Profile Truth
   File: /herohealth/eap-word-quest/eap-word-teacher-v247-current-profile-truth.js
   Version: v2.4.7-TEACHER-CURRENT-PROFILE-TRUTH-122

   Prevents a local browser dashboard from borrowing Core state from another
   saved test identity on the same device. Cloud data is never changed here.

   Example fixed:
   - old completed test: KK / 12
   - current profile: KP / 50
   The local dashboard must not present KK's 20/20 history as KP / 50.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.4.7-TEACHER-CURRENT-PROFILE-TRUTH-122";
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

  if (window.__EAP_WORD_TEACHER_V247_CURRENT_PROFILE_TRUTH__) return;
  window.__EAP_WORD_TEACHER_V247_CURRENT_PROFILE_TRUTH__ = true;

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

  function safeId(value) {
    return norm(value || "anon").replace(/[^a-z0-9_-]/gi, "_") || "anon";
  }

  function profile() {
    const saved = readJson("EAP_WORD_QUEST_PROFILE_V01", {}) || {};
    return {
      studentId: norm(saved.studentId || saved.id || "anon"),
      studentName: norm(saved.studentName || saved.name || "Anonymous")
    };
  }

  function currentState() {
    const p = profile();
    return readJson(`EAP_WORD_QUEST_CORE_V196_STATE_${GROUP}_${safeId(p.studentId)}`, {}) || {};
  }

  function defaultTotal(sessionId) {
    if (sessionId === "BG5") return 24;
    return /^BG/.test(sessionId) ? 18 : 12;
  }

  function threshold(sessionId) {
    if (sessionId === "BG5") return 75;
    return /^BG/.test(sessionId) ? 70 : 60;
  }

  function localLogsForCurrentProfile() {
    const p = profile();
    const all = typeof window.readEapWordQuestLogs === "function"
      ? window.readEapWordQuestLogs()
      : [];

    return (Array.isArray(all) ? all : [])
      .filter((record) => norm(record && record.studentId) === p.studentId)
      .map((record) => Object.assign({}, record, {
        group: GROUP,
        section: GROUP,
        studentId: p.studentId,
        studentName: p.studentName,
        studentKey: `${GROUP}|${p.studentId}`
      }));
  }

  function currentStateRecords() {
    const p = profile();
    const state = currentState();
    const sessions = state && typeof state.sessions === "object" ? state.sessions : {};
    const records = [];

    FLOW.forEach((sessionId) => {
      const row = sessions[sessionId];
      if (!row || (!row.played && !row.passed)) return;

      const total = Math.max(1, Math.round(num(row.total, defaultTotal(sessionId))));
      const accuracy = Math.max(0, Math.min(100, Math.round(num(row.bestAccuracy, row.accuracy))));
      const passed = Boolean(row.passed) || accuracy >= threshold(sessionId);
      const score = Math.max(0, Math.round(num(row.bestScore, row.lastScore)));

      records.push({
        logVersion: VERSION,
        source: "current-profile-state-v247",
        group: GROUP,
        section: GROUP,
        studentId: p.studentId,
        studentName: p.studentName,
        studentKey: `${GROUP}|${p.studentId}`,
        sessionId,
        sessionTitle: TITLES[sessionId] || sessionId,
        sessionType: sessionId === "BG5" ? "finalBoss" : (/^BG/.test(sessionId) ? "boss" : "session"),
        correct: Math.max(0, Math.min(total, Math.round((accuracy / 100) * total))),
        total,
        accuracy,
        xp: score,
        score,
        maxCombo: Math.max(0, Math.round(num(row.maxCombo))),
        passed,
        passThreshold: threshold(sessionId),
        passStatus: passed ? "Passed" : "Needs Practice",
        cefrLevel: "",
        aiDifficulty: "",
        aiPrediction: "",
        hintUsed: 0,
        weakWords: [],
        itemTypeWeak: [],
        levelWeak: [],
        responseTimeAvg: 0,
        attempt: Math.max(1, Math.round(num(row.totalAttempts, 1))),
        bossHp: passed && /^BG/.test(sessionId) ? 0 : 1,
        bossMaxHp: /^BG/.test(sessionId) ? total : 0,
        isBoss: /^BG/.test(sessionId),
        playedAt: norm(row.lastPlayed || state.updatedAt || new Date().toISOString())
      });
    });

    return records;
  }

  function mergeBest(records) {
    const best = new Map();
    (records || []).forEach((record) => {
      const key = `${norm(record.studentId)}|${norm(record.sessionId).toUpperCase()}`;
      const old = best.get(key);
      const better = !old ||
        (Boolean(record.passed) && !Boolean(old.passed)) ||
        num(record.accuracy) > num(old.accuracy) ||
        (num(record.accuracy) === num(old.accuracy) && new Date(record.playedAt || 0) >= new Date(old.playedAt || 0));
      if (better) best.set(key, record);
    });
    return Array.from(best.values());
  }

  function baseReportBuilder() {
    const latest = window.buildEapTeacherReport;
    const v246Original = latest && latest.__eapV246Original;
    const v241Original = v246Original && v246Original.__eapV241Original;
    return typeof v241Original === "function" ? v241Original : null;
  }

  function improve(report) {
    if (!report || !Array.isArray(report.students)) return report;
    report.students.forEach((student) => {
      const completed = num(student.passedSessions) >= FLOW.length;
      const accuracy = num(student.averageAccuracy);
      student.status = completed ? (accuracy >= 90 ? "Mastery" : accuracy >= 75 ? "Strong" : "Ready")
        : accuracy < 60 ? "At Risk"
        : accuracy >= 75 ? "Strong"
        : (student.weakWords || []).length >= 5 ? "Needs Review"
        : "Ready";
      student.isComplete = completed;
    });
    if (report.overview) {
      report.overview.studentsPlayed = report.students.length;
      report.overview.vocabularyReady = report.students.filter((student) => ["Ready", "Strong", "Mastery"].includes(student.status)).length;
      report.overview.atRisk = report.students.filter((student) => student.status === "At Risk").length;
      report.overview.needsReview = report.students.filter((student) => student.status === "Needs Review").length;
      report.overview.totalAttempts = report.logs ? report.logs.length : 0;
    }
    return report;
  }

  function install() {
    if (!window.__EAP_WORD_TEACHER_V241_CORE_TRUTH__) return false;
    if (!window.__EAP_WORD_TEACHER_V246_IDENTITY_NAME_TRUTH__) return false;

    const original = window.buildEapTeacherReport;
    const base = baseReportBuilder();
    if (typeof original !== "function" || typeof base !== "function" || original.__eapV247CurrentProfileTruth) return false;

    const wrapped = function(inputLogs) {
      // Cloud logs are supplied explicitly and must be reported exactly as
      // returned by Sheets. Only local mode receives the profile scope guard.
      if (Array.isArray(inputLogs)) return original.call(this, inputLogs);

      const logs = mergeBest([
        ...localLogsForCurrentProfile(),
        ...currentStateRecords()
      ]);
      const report = base.call(this, logs);
      return improve(report);
    };

    wrapped.__eapV247CurrentProfileTruth = true;
    wrapped.__eapV247Original = original;
    window.buildEapTeacherReport = wrapped;
    return true;
  }

  function wait(tries) {
    if (install()) return;
    if (tries >= 180) return;
    setTimeout(() => wait(tries + 1), 30);
  }

  wait(0);
  window.inspectEapTeacherV247 = () => ({
    version: VERSION,
    profile: profile(),
    localLogCount: localLogsForCurrentProfile().length,
    currentStateSessions: currentStateRecords().length,
    installed: Boolean(window.buildEapTeacherReport && window.buildEapTeacherReport.__eapV247CurrentProfileTruth)
  });
})();
