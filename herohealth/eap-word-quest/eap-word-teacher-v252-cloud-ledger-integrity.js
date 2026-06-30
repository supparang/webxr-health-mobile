/* =========================================================
   EAP Word Quest • Cloud Ledger Integrity Filter
   File: /herohealth/eap-word-quest/eap-word-teacher-v252-cloud-ledger-integrity.js
   Version: v2.5.2-CLOUD-LEDGER-INTEGRITY-122

   - Removes unsafe legacy v243 rows from cloud reporting.
   - Retires automatic historic backfill.
   - Adds an explicit teacher-confirmed recovery action for the currently
     selected local Student Profile only.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.5.2-CLOUD-LEDGER-INTEGRITY-122";
  const GROUP = "122";
  const LEGACY_SOURCE = "core-state-backfill-v243";
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

  if (window.__EAP_WORD_TEACHER_V252_CLOUD_LEDGER_INTEGRITY__) return;
  window.__EAP_WORD_TEACHER_V252_CLOUD_LEDGER_INTEGRITY__ = true;

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
    return norm(value || "no-id").replace(/[^a-z0-9_-]/gi, "_") || "no-id";
  }

  function threshold(sessionId) {
    if (sessionId === "BG5") return 75;
    return /^BG/.test(sessionId) ? 70 : 60;
  }

  function defaultTotal(sessionId) {
    if (sessionId === "BG5") return 24;
    return /^BG/.test(sessionId) ? 18 : 12;
  }

  function profile() {
    const saved = readJson("EAP_WORD_QUEST_PROFILE_V01", {}) || {};
    return {
      studentId: norm(saved.studentId || saved.id || ""),
      studentName: norm(saved.studentName || saved.name || "")
    };
  }

  function endpoint() {
    const fromHelper = typeof window.getEapWordSheetEndpoint === "function"
      ? window.getEapWordSheetEndpoint()
      : "";
    return norm(fromHelper || (window.EAP_WORD_SHEET_CONFIG && window.EAP_WORD_SHEET_CONFIG.endpoint) || "");
  }

  function validEndpoint(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\//i.test(url);
  }

  function isUnsafeLegacyBackfill(row) {
    return norm(row && row.source).toLowerCase() === LEGACY_SOURCE;
  }

  function install() {
    const original = window.buildEapTeacherReport;
    if (typeof original !== "function" || original.__eapV252CloudLedgerIntegrity) return false;

    const wrapped = function(inputLogs) {
      if (!Array.isArray(inputLogs)) return original.call(this);

      const rows = inputLogs.slice();
      const quarantined = rows.filter(isUnsafeLegacyBackfill);
      const trusted = rows.filter((row) => !isUnsafeLegacyBackfill(row));
      const report = original.call(this, trusted);

      window.EAP_WORD_TEACHER_V252_STATE = {
        version: VERSION,
        inputRows: rows.length,
        trustedRows: trusted.length,
        quarantinedLegacyRows: quarantined.length,
        quarantinedIdentities: Array.from(new Set(quarantined.map((row) => `${norm(row.studentName)} / ${norm(row.studentId)}`))).filter(Boolean),
        updatedAt: new Date().toISOString()
      };
      return report;
    };

    wrapped.__eapV252CloudLedgerIntegrity = true;
    wrapped.__eapV252Original = original;
    window.buildEapTeacherReport = wrapped;
    return true;
  }

  function buildVerifiedCurrentProfileRecords() {
    const who = profile();
    if (!who.studentId || !who.studentName) return { profile:who, records:[], error:"กรอกและบันทึกชื่อกับรหัสนักศึกษาก่อน" };

    const key = `EAP_WORD_QUEST_CORE_V196_STATE_${GROUP}_${safeId(who.studentId)}`;
    const state = readJson(key, {}) || {};
    const sessions = state.sessions && typeof state.sessions === "object" ? state.sessions : {};
    const records = [];

    FLOW.forEach((sessionId) => {
      const row = sessions[sessionId];
      if (!row || (!row.played && !row.passed)) return;

      const total = Math.max(1, Math.round(num(row.total, defaultTotal(sessionId))));
      const accuracy = Math.max(0, Math.min(100, Math.round(num(row.bestAccuracy, row.accuracy))));
      const score = Math.max(0, Math.round(num(row.bestScore, row.lastScore)));
      const passed = Boolean(row.passed) || accuracy >= threshold(sessionId);
      const playedAt = norm(row.lastPlayed || state.updatedAt || new Date().toISOString());

      records.push({
        source: "teacher-confirmed-local-history-v252",
        course: "EAP",
        game: "EAP Word Quest",
        role: "Vocabulary Side Quest",
        group: GROUP,
        section: GROUP,
        studentId: who.studentId,
        studentName: who.studentName,
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
        playedAt,
        fingerprint: ["v252-confirmed-history", GROUP, who.studentId, sessionId, accuracy, score, playedAt.slice(0,19)].join("|")
      });
    });

    return { profile:who, records, stateKey:key };
  }

  async function recoverVerifiedCurrentProfileHistory() {
    const built = buildVerifiedCurrentProfileRecords();
    if (built.error) {
      window.alert(built.error);
      return { ok:false, error:built.error };
    }
    if (!built.records.length) {
      window.alert(`ไม่พบประวัติ Core ของ ${built.profile.studentName} (${built.profile.studentId}) ในเครื่องนี้`);
      return { ok:false, error:"no_local_core_history", profile:built.profile };
    }

    const text = `ยืนยันกู้ประวัติ ${built.records.length} ภารกิจของ ${built.profile.studentName} (${built.profile.studentId}) เข้า Google Sheets?\n\nใช้เฉพาะเมื่อโปรไฟล์นี้คือเจ้าของประวัติในเครื่องจริง ๆ`;
    if (!window.confirm(text)) return { ok:false, error:"cancelled", profile:built.profile };

    const url = endpoint();
    if (!validEndpoint(url)) {
      window.alert("ยังไม่พบ Google Apps Script Web App URL");
      return { ok:false, error:"endpoint_not_configured" };
    }

    const payload = {
      action:"eap_word_batch",
      schemaVersion:VERSION,
      clientTs:new Date().toISOString(),
      pageUrl:location.href,
      userAgent:navigator.userAgent || "",
      records:built.records
    };

    await fetch(url, {
      method:"POST",
      mode:"no-cors",
      credentials:"omit",
      cache:"no-store",
      keepalive:true,
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body:JSON.stringify(payload)
    });

    const button = document.getElementById("loadCloudBtn");
    setTimeout(() => { if (button && typeof button.click === "function") button.click(); }, 1200);
    return { ok:true, sent:built.records.length, profile:built.profile };
  }

  function addRecoveryButton() {
    if (document.getElementById("eapV252RecoverCurrentProfile")) return;
    const anchor = document.getElementById("useLocalBtn") || document.getElementById("loadCloudBtn");
    if (!anchor || !anchor.parentNode) return;
    const button = document.createElement("button");
    button.id = "eapV252RecoverCurrentProfile";
    button.type = "button";
    button.className = "btn secondary";
    button.textContent = "กู้ประวัติโปรไฟล์นี้";
    button.title = "ใช้เฉพาะเมื่อเปิดโปรไฟล์เจ้าของข้อมูลในเครื่องนี้ถูกต้องแล้ว";
    button.addEventListener("click", () => { recoverVerifiedCurrentProfileHistory().catch((err) => window.alert(`กู้ประวัติไม่สำเร็จ: ${String(err && err.message || err)}`)); });
    anchor.parentNode.insertBefore(button, anchor.nextSibling);
  }

  function refreshCloudOnce() {
    addRecoveryButton();
    const source = document.getElementById("sourcePill");
    const inCloudMode = /sheets|google/i.test(norm(source && source.textContent));
    const button = document.getElementById("loadCloudBtn");
    if (inCloudMode && button && typeof button.click === "function") button.click();
  }

  function wait(tries) {
    const ready = typeof window.buildEapTeacherReport === "function" &&
      (window.__EAP_WORD_TEACHER_V246_IDENTITY_NAME_TRUTH__ || window.__EAP_WORD_TEACHER_V251_LOCAL_IDENTITY_TRUTH__ || tries > 160);
    if (ready && install()) {
      setTimeout(refreshCloudOnce, 180);
      return;
    }
    if (tries >= 260) return;
    setTimeout(() => wait(tries + 1), 30);
  }

  wait(0);
  window.recoverEapWordQuestVerifiedHistory = recoverVerifiedCurrentProfileHistory;
  window.inspectEapTeacherV252 = () => Object.assign({
    version: VERSION,
    profile: profile(),
    localHistory: buildVerifiedCurrentProfileRecords().records.length
  }, window.EAP_WORD_TEACHER_V252_STATE || {});
})();
